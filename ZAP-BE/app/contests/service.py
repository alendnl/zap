import random
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from app.contests.models import (
    Contest,
    ContestCreate,
    ContestUpdate,
    ContestSummary,
    ContestStatus,
    SelectionMode,
    MCQSectionConfig,
    CodingSectionConfig,
    MCQRandomRule,
    CodingRandomRule,
    ContestStartResponse,
    ContestSubmitRequest,
    ContestSubmitResponse,
    MCQReviewItem,
    CodingReviewItem,
    ProctoringViolation,
    ProctoringTelemetry,
    CodingProblemState,
    ContestSessionSyncRequest,
    ScoreBucket,
    QuestionAccuracyStat,
    ProblemAcceptanceStat,
    ProctoringSummaryStats,
    ContestAnalyticsResponse,
    ContestSubmissionsResponse,
)
from app.mcq.service import MCQService
from app.questions.service import QuestionService
from app.submissions.service import SubmissionService


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-")


def _safe_get(obj: Any, key: str, default: Any = None) -> Any:
    """Helper to safely retrieve a property from either a dict or an object."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


class ContestService:
    def __init__(self, db):
        self.db = db
        self._memory_contests: Dict[str, Dict[str, Any]] = {}
        self._memory_submissions: Dict[str, Dict[str, Any]] = {}

    def _get_contests_coll(self):
        if self.db is not None:
            if hasattr(self.db, "contests"):
                return self.db.contests
            if hasattr(self.db, "__getitem__"):
                try:
                    return self.db["contests"]
                except Exception:
                    pass
        return None

    def _get_submissions_coll(self):
        if self.db is not None:
            if hasattr(self.db, "contest_submissions"):
                return self.db.contest_submissions
            if hasattr(self.db, "__getitem__"):
                try:
                    return self.db["contest_submissions"]
                except Exception:
                    pass
        return None

    def seed_sample_contest(self, force: bool = False) -> Optional[Contest]:
        """Seeds the standard 25 MCQ + 3 Coding question contest."""
        coll = self._get_contests_coll()
        if coll is not None and not force:
            doc = coll.find_one({"$or": [{"slug": "zap-grand-assessment-1"}, {"_id": "contest-grand-01"}]})
            if doc:
                doc["id"] = str(doc.get("id") or doc.get("_id"))
                doc.pop("_id", None)
                return Contest(**doc)
        elif coll is None and not force:
            doc = self._memory_contests.get("contest-grand-01")
            if doc:
                clean = dict(doc)
                clean["id"] = str(clean.get("id") or clean.get("_id"))
                clean.pop("_id", None)
                return Contest(**clean)

        # Fetch available MCQs from DB/memory
        mcq_service = MCQService(self.db)
        mcqs = mcq_service.list_questions(status="PUBLISHED", summary=True)
        mcq_ids = [q.id for q in mcqs[:25]] if mcqs else []

        # Fetch available coding questions from DB/memory
        q_service = QuestionService(self.db)
        questions = q_service.list_questions(status="PUBLISHED", summary=True)
        coding_ids = [q.id for q in questions[:3]] if questions else []

        sample_contest = Contest(
            id="contest-grand-01",
            title="ZAP Grand Assessment #1: Core CS & Programming",
            slug="zap-grand-assessment-1",
            description=(
                "Comprehensive full-stack technical evaluation featuring 25 core Computer Science "
                "multiple-choice questions (covering Data Structures, DBMS, Networks, and OOPS) "
                "and 3 hands-on algorithm coding challenges in Monaco multi-language judge."
            ),
            durationMinutes=90,
            hasMcq=True,
            hasCoding=True,
            mcqConfig=MCQSectionConfig(
                enabled=True,
                mode=SelectionMode.MANUAL if len(mcq_ids) >= 25 else SelectionMode.RANDOM,
                questionIds=mcq_ids,
                randomRules=[
                    MCQRandomRule(category="DSA", count=10),
                    MCQRandomRule(category="DBMS", count=5),
                    MCQRandomRule(category="NETWORKS", count=5),
                    MCQRandomRule(category="OOPS", count=5),
                ],
                totalQuestions=25,
                pointsPerQuestion=1,
            ),
            codingConfig=CodingSectionConfig(
                enabled=True,
                mode=SelectionMode.MANUAL if len(coding_ids) >= 3 else SelectionMode.RANDOM,
                questionIds=coding_ids,
                randomRules=[
                    CodingRandomRule(difficulty="EASY", count=1),
                    CodingRandomRule(difficulty="MEDIUM", count=1),
                    CodingRandomRule(difficulty="HARD", count=1),
                ],
                totalQuestions=3,
                pointsPerQuestion=10,
            ),
            status=ContestStatus.PUBLISHED,
            totalPoints=55,
            createdBy="system-seed",
        )

        coll = self._get_contests_coll()
        doc = sample_contest.model_dump()
        doc["_id"] = sample_contest.id
        if coll is not None:
            coll.update_one(
                {"$or": [{"_id": sample_contest.id}, {"slug": sample_contest.slug}]},
                {"$set": doc},
                upsert=True,
            )
        else:
            self._memory_contests[sample_contest.id] = doc

        return sample_contest

    def list_contests(self, status: Optional[str] = None, summary: bool = True) -> List[Any]:
        coll = self._get_contests_coll()
        # Auto-seed sample contest if completely empty
        if coll is not None:
            count = coll.count_documents({})
            if count == 0:
                self.seed_sample_contest(force=False)
        else:
            if len(self._memory_contests) == 0:
                self.seed_sample_contest(force=False)

        query = {}
        if status and status != "ALL":
            query["status"] = status

        results = []
        if coll is not None:
            cursor = coll.find(query).sort("createdAt", -1)
            for doc in cursor:
                doc["id"] = str(doc.get("id") or doc.get("_id"))
                doc.pop("_id", None)
                results.append(doc)
        else:
            for doc in self._memory_contests.values():
                if status and status != "ALL" and doc.get("status") != status:
                    continue
                clean = dict(doc)
                clean["id"] = str(clean.get("id") or clean.get("_id"))
                clean.pop("_id", None)
                results.append(clean)

        if summary:
            summaries = []
            for r in results:
                mcq_count = 0
                if r.get("hasMcq") and r.get("mcqConfig"):
                    cfg = r["mcqConfig"]
                    mcq_count = len(cfg.get("questionIds", [])) if cfg.get("mode") == "MANUAL" else cfg.get("totalQuestions", 25)

                coding_count = 0
                if r.get("hasCoding") and r.get("codingConfig"):
                    cfg = r["codingConfig"]
                    coding_count = len(cfg.get("questionIds", [])) if cfg.get("mode") == "MANUAL" else cfg.get("totalQuestions", 3)

                summaries.append(
                    ContestSummary(
                        id=r["id"],
                        title=r["title"],
                        slug=r["slug"],
                        description=r["description"],
                        durationMinutes=r.get("durationMinutes", 90),
                        hasMcq=r.get("hasMcq", True),
                        hasCoding=r.get("hasCoding", True),
                        mcqQuestionsCount=mcq_count,
                        codingQuestionsCount=coding_count,
                        totalPoints=r.get("totalPoints", 55),
                        status=r.get("status", ContestStatus.PUBLISHED),
                        createdAt=r.get("createdAt", ""),
                        updatedAt=r.get("updatedAt", ""),
                    )
                )
            return summaries

        return [Contest(**r) for r in results]

    def get_contest(self, contest_id_or_slug: str) -> Optional[Contest]:
        key = (contest_id_or_slug or "").strip()
        if not key:
            return None

        coll = self._get_contests_coll()
        if coll is not None:
            doc = coll.find_one({
                "$or": [
                    {"_id": key},
                    {"id": key},
                    {"slug": key},
                    {"slug": key.lower()},
                ]
            })
            if doc:
                doc["id"] = str(doc.get("id") or doc.get("_id"))
                doc.pop("_id", None)
                return Contest(**doc)
            if key.lower() in ["zap-grand-assessment-1", "contest-grand-01"]:
                return self.seed_sample_contest(force=False)
            return None

        for doc in self._memory_contests.values():
            if (
                doc.get("id") == key
                or doc.get("slug") == key
                or (doc.get("slug") and doc.get("slug").lower() == key.lower())
            ):
                clean = dict(doc)
                clean["id"] = str(clean.get("id") or clean.get("_id"))
                clean.pop("_id", None)
                return Contest(**clean)
        if key.lower() in ["zap-grand-assessment-1", "contest-grand-01"]:
            return self.seed_sample_contest(force=False)
        return None

    def create_contest(self, payload: ContestCreate, created_by: str = "admin") -> Contest:
        slug = slugify(payload.slug) if payload.slug else slugify(payload.title)
        if not slug:
            slug = f"contest-{uuid.uuid4().hex[:6]}"
        payload.slug = slug

        existing = self.get_contest(payload.slug)
        if existing:
            payload.slug = f"{payload.slug}-{uuid.uuid4().hex[:4]}"

        now = datetime.now(timezone.utc).isoformat()
        contest = Contest(
            **payload.model_dump(),
            id=f"contest-{uuid.uuid4().hex[:8]}",
            createdBy=created_by,
            createdAt=now,
            updatedAt=now,
        )

        coll = self._get_contests_coll()
        doc = contest.model_dump()
        doc["_id"] = contest.id
        if coll is not None:
            coll.insert_one(doc)
        else:
            self._memory_contests[contest.id] = doc

        return contest

    def update_contest(self, contest_id: str, payload: ContestUpdate) -> Optional[Contest]:
        existing = self.get_contest(contest_id)
        if not existing:
            return None

        update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
        update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

        coll = self._get_contests_coll()
        if coll is not None:
            coll.update_one(
                {"$or": [{"_id": existing.id}, {"id": existing.id}]},
                {"$set": update_data},
            )
        else:
            self._memory_contests[existing.id].update(update_data)

        return self.get_contest(existing.id)

    def delete_contest(self, contest_id: str) -> bool:
        existing = self.get_contest(contest_id)
        if not existing:
            return False

        coll = self._get_contests_coll()
        if coll is not None:
            coll.delete_one({"$or": [{"_id": existing.id}, {"id": existing.id}]})
            subs_coll = self._get_submissions_coll()
            if subs_coll is not None:
                subs_coll.delete_many({"contestId": existing.id})
        else:
            self._memory_contests.pop(existing.id, None)
            to_remove = [k for k, v in self._memory_submissions.items() if v.get("contestId") == existing.id]
            for k in to_remove:
                self._memory_submissions.pop(k, None)

        return True

    def get_candidate_submission(self, contest_id_or_slug: str, student_id_or_sub_id: str) -> Optional[Dict[str, Any]]:
        """Fetches the full submission details (including codingState and proctoring logs) for a single candidate."""
        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        coll = self._get_submissions_coll()
        target = student_id_or_sub_id.strip()
        query = {
            "contestId": contest.id,
            "$or": [
                {"_id": target},
                {"id": target},
                {"submissionId": target},
                {"studentId": target},
                {"studentEmail": target.lower()},
            ],
        }

        if coll is not None:
            doc = coll.find_one(query)
            if doc:
                clean = dict(doc)
                clean["id"] = clean.get("id") or str(clean.get("_id"))
                clean.pop("_id", None)
                return clean
            return None
        else:
            for s in self._memory_submissions.values():
                if s.get("contestId") == contest.id:
                    sid = str(s.get("id") or s.get("_id") or s.get("submissionId") or "")
                    st_id = str(s.get("studentId") or "")
                    st_email = str(s.get("studentEmail") or "").lower()
                    if target in (sid, st_id, st_email):
                        clean = dict(s)
                        clean["id"] = clean.get("id") or str(clean.get("_id"))
                        clean.pop("_id", None)
                        return clean
            return None

    def delete_contest_submission(self, contest_id_or_slug: str, student_id_or_sub_id: str) -> bool:
        """Deletes/resets a particular candidate's contest submission and session so they can retake it."""
        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        coll = self._get_submissions_coll()
        target = student_id_or_sub_id.strip()
        query = {
            "contestId": contest.id,
            "$or": [
                {"_id": target},
                {"id": target},
                {"studentId": target},
                {"studentEmail": target.lower()},
            ],
        }

        deleted = False
        if coll is not None:
            res = coll.delete_many(query)
            deleted = res.deleted_count > 0

        # Also clean memory submissions
        to_delete = [
            k for k, v in self._memory_submissions.items()
            if v.get("contestId") == contest.id and (
                v.get("id") == target or
                v.get("studentId") == target or
                v.get("studentEmail", "").lower() == target.lower() or
                k == target
            )
        ]
        for k in to_delete:
            self._memory_submissions.pop(k, None)
            deleted = True

        return deleted

    def _is_session_expired(self, contest: Contest, session_doc: Dict[str, Any]) -> bool:
        """Checks whether a candidate's session has exceeded the contest duration or contest window."""
        if not contest or not session_doc:
            return False
        if session_doc.get("status") == "SUBMITTED":
            return True

        duration_mins = contest.durationMinutes or 90
        duration_secs = duration_mins * 60

        # 1. Check timeSpentSeconds
        if session_doc.get("timeSpentSeconds", 0) >= duration_secs:
            return True

        # 2. Check wall-clock elapsed time since startedAt
        started_at_str = session_doc.get("startedAt")
        if started_at_str:
            try:
                started_at = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
                now_dt = datetime.now(timezone.utc)
                if (now_dt - started_at).total_seconds() >= duration_secs:
                    return True
            except Exception:
                pass

        # 3. Check contest.endTime
        if contest.endTime:
            try:
                end_dt = datetime.fromisoformat(contest.endTime.replace("Z", "+00:00"))
                now_dt = datetime.now(timezone.utc)
                if now_dt >= end_dt:
                    return True
            except Exception:
                pass

        return False

    def _auto_submit_session(self, contest: Contest, session_doc: Dict[str, Any]) -> ContestSubmitResponse:
        """Automatically evaluates and submits an expired contest session using whatever synced state
        is currently saved in the database."""
        student_id = session_doc.get("studentId") or "student-anonymous"
        student_email = session_doc.get("studentEmail") or ""
        student_name = session_doc.get("studentName") or ""
        mcq_answers = session_doc.get("mcqAnswers") or {}
        coding_state_raw = session_doc.get("codingState") or {}
        proctoring_raw = session_doc.get("proctoring")

        coding_submissions = {}
        coding_state_dict = {}
        for qid, st in coding_state_raw.items():
            if isinstance(st, dict):
                sub_id = st.get("lastSubmissionId")
                if sub_id:
                    coding_submissions[qid] = sub_id
                coding_state_dict[qid] = CodingProblemState(**st)
            elif hasattr(st, "lastSubmissionId"):
                if st.lastSubmissionId:
                    coding_submissions[qid] = st.lastSubmissionId
                coding_state_dict[qid] = st

        proctoring_obj = None
        if proctoring_raw:
            if isinstance(proctoring_raw, dict):
                proctoring_obj = ProctoringTelemetry(**proctoring_raw)
            else:
                proctoring_obj = proctoring_raw

        duration_secs = (contest.durationMinutes or 90) * 60
        time_spent = session_doc.get("timeSpentSeconds") or duration_secs
        started_at_str = session_doc.get("startedAt")
        if started_at_str:
            try:
                started_at = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
                now_dt = datetime.now(timezone.utc)
                time_spent = max(time_spent, int((now_dt - started_at).total_seconds()))
            except Exception:
                pass
        time_spent = min(time_spent, duration_secs)

        submit_req = ContestSubmitRequest(
            studentId=student_id,
            studentEmail=student_email,
            studentName=student_name,
            mcqAnswers=mcq_answers,
            codingSubmissions=coding_submissions,
            codingState=coding_state_dict,
            proctoring=proctoring_obj,
            timeSpentSeconds=time_spent,
            isAutoSubmitted=True,
        )
        return self.submit_contest(contest.id, submit_req)

    def _auto_finalize_expired_sessions(self, contest: Contest) -> None:
        """Finds all IN_PROGRESS sessions for this contest that have expired,
        and automatically finalizes them so scores, leaderboards, and analytics are up to date."""
        coll = self._get_submissions_coll()
        if coll is not None:
            try:
                cursor = coll.find({"contestId": contest.id, "status": "IN_PROGRESS"})
                for doc in list(cursor):
                    if self._is_session_expired(contest, doc):
                        try:
                            self._auto_submit_session(contest, doc)
                        except Exception:
                            pass
            except Exception:
                pass
        else:
            for s_id, s in list(self._memory_submissions.items()):
                if s.get("contestId") == contest.id and s.get("status") == "IN_PROGRESS":
                    if self._is_session_expired(contest, s):
                        try:
                            self._auto_submit_session(contest, s)
                        except Exception:
                            pass

    def start_contest_session(
        self,
        contest_id_or_slug: str,
        student_id: str,
        student_email: Optional[str] = None,
        student_name: Optional[str] = None,
    ) -> ContestStartResponse:
        """Resolves questions for this contest session, masking correct answers for security.
        Maintains persistent in-progress state and prevents re-attempting if already submitted.
        """
        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        coll = self._get_submissions_coll()
        now = datetime.now(timezone.utc).isoformat()

        # Build student match conditions
        id_conditions = [{"studentId": student_id}]
        if student_email:
            id_conditions.append({"studentEmail": student_email.lower().strip()})
        query = {
            "contestId": contest.id,
            "$or": id_conditions
        }

        existing_doc = None
        if coll is not None:
            existing_doc = coll.find_one(query)
        else:
            for s in self._memory_submissions.values():
                if s.get("contestId") == contest.id and (
                    s.get("studentId") == student_id or
                    (student_email and s.get("studentEmail", "").lower() == student_email.lower().strip())
                ):
                    existing_doc = s
                    break

        if existing_doc:
            session_status = existing_doc.get("status", "IN_PROGRESS")
            # If already finalized/submitted, return completed record
            if session_status == "SUBMITTED":
                clean_sub = dict(existing_doc)
                clean_sub.pop("_id", None)
                return ContestStartResponse(
                    contest=contest,
                    mcqQuestions=clean_sub.get("mcqQuestions", []),
                    codingQuestions=clean_sub.get("codingQuestions", []),
                    startedAt=clean_sub.get("startedAt", now),
                    sessionId=existing_doc.get("id") or str(existing_doc.get("_id")),
                    alreadySubmitted=True,
                    submission=clean_sub,
                    mcqAnswers=clean_sub.get("mcqAnswers", {}),
                    reviewedQuestionIds=clean_sub.get("reviewedQuestionIds", []),
                    codingState=clean_sub.get("codingState", {}),
                    proctoring=clean_sub.get("proctoring"),
                    timeSpentSeconds=clean_sub.get("timeSpentSeconds", 0),
                )

            # Check if this session has expired (exceeded duration or window) -> Auto submit!
            if self._is_session_expired(contest, existing_doc):
                auto_resp = self._auto_submit_session(contest, existing_doc)
                clean_sub = auto_resp.model_dump()
                return ContestStartResponse(
                    contest=contest,
                    mcqQuestions=clean_sub.get("mcqQuestions", existing_doc.get("mcqQuestions", [])),
                    codingQuestions=clean_sub.get("codingQuestions", existing_doc.get("codingQuestions", [])),
                    startedAt=existing_doc.get("startedAt", now),
                    sessionId=existing_doc.get("id") or str(existing_doc.get("_id")),
                    alreadySubmitted=True,
                    submission=clean_sub,
                    mcqAnswers=clean_sub.get("mcqAnswers", {}),
                    reviewedQuestionIds=clean_sub.get("reviewedQuestionIds", []),
                    codingState=clean_sub.get("codingState", {}),
                    proctoring=clean_sub.get("proctoring"),
                    timeSpentSeconds=clean_sub.get("timeSpentSeconds", (contest.durationMinutes or 90) * 60),
                )

            # Resuming IN_PROGRESS session
            return ContestStartResponse(
                contest=contest,
                mcqQuestions=existing_doc.get("mcqQuestions", []),
                codingQuestions=existing_doc.get("codingQuestions", []),
                startedAt=existing_doc.get("startedAt", now),
                sessionId=existing_doc.get("id") or str(existing_doc.get("_id")),
                alreadySubmitted=False,
                submission=None,
                mcqAnswers=existing_doc.get("mcqAnswers", {}),
                reviewedQuestionIds=existing_doc.get("reviewedQuestionIds", []),
                codingState=existing_doc.get("codingState", {}),
                proctoring=existing_doc.get("proctoring"),
                timeSpentSeconds=existing_doc.get("timeSpentSeconds", 0),
            )

        # First-time candidate entry: resolve questions and initialize session
        resolved_mcqs = []
        if contest.hasMcq and contest.mcqConfig and contest.mcqConfig.enabled:
            resolved_mcqs = self._resolve_mcq_questions(contest.mcqConfig)

        resolved_coding = []
        if contest.hasCoding and contest.codingConfig and contest.codingConfig.enabled:
            resolved_coding = self._resolve_coding_questions(contest.codingConfig)

        session_id = f"csub-{uuid.uuid4().hex[:12]}"
        init_proctoring = {
            "tabSwitchCount": 0,
            "copyPasteAttempts": 0,
            "fullscreenExitCount": 0,
            "violationsLog": [],
        }

        initial_doc = {
            "_id": session_id,
            "id": session_id,
            "contestId": contest.id,
            "studentId": student_id,
            "studentEmail": (student_email or "").strip().lower(),
            "studentName": student_name or "",
            "status": "IN_PROGRESS",
            "startedAt": now,
            "updatedAt": now,
            "mcqQuestions": resolved_mcqs,
            "codingQuestions": resolved_coding,
            "mcqAnswers": {},
            "reviewedQuestionIds": [],
            "codingState": {},
            "proctoring": init_proctoring,
            "timeSpentSeconds": 0,
        }

        if coll is not None:
            coll.insert_one(initial_doc)
        else:
            self._memory_submissions[session_id] = initial_doc

        return ContestStartResponse(
            contest=contest,
            mcqQuestions=resolved_mcqs,
            codingQuestions=resolved_coding,
            startedAt=now,
            sessionId=session_id,
            alreadySubmitted=False,
            mcqAnswers={},
            reviewedQuestionIds=[],
            codingState={},
            proctoring=ProctoringTelemetry(**init_proctoring),
            timeSpentSeconds=0,
        )

    def _apply_sync_to_doc_dict(
        self,
        doc: Dict[str, Any],
        sync_data: ContestSessionSyncRequest,
        now: str
    ) -> None:
        """Applies delta and full sync updates in-place to an in-memory contest submission document."""
        doc["updatedAt"] = now
        if sync_data.timeSpentSeconds is not None:
            doc["timeSpentSeconds"] = sync_data.timeSpentSeconds

        # 1. MCQ Delta
        if sync_data.mcqDelta:
            if "mcqAnswers" not in doc or not isinstance(doc["mcqAnswers"], dict):
                doc["mcqAnswers"] = {}
            if sync_data.mcqDelta.selectedOptionId:
                doc["mcqAnswers"][sync_data.mcqDelta.questionId] = sync_data.mcqDelta.selectedOptionId
            else:
                doc["mcqAnswers"].pop(sync_data.mcqDelta.questionId, None)

        # 2. Review Delta
        if sync_data.reviewDelta:
            if "reviewedQuestionIds" not in doc or not isinstance(doc["reviewedQuestionIds"], list):
                doc["reviewedQuestionIds"] = []
            r_list = doc["reviewedQuestionIds"]
            qid = sync_data.reviewDelta.questionId
            if sync_data.reviewDelta.isReviewed:
                if qid not in r_list:
                    r_list.append(qid)
            else:
                if qid in r_list:
                    r_list.remove(qid)

        # 3. Coding Delta
        if sync_data.codingDelta:
            if "codingState" not in doc or not isinstance(doc["codingState"], dict):
                doc["codingState"] = {}
            cd = sync_data.codingDelta
            qid = cd.questionId
            if qid not in doc["codingState"] or not isinstance(doc["codingState"][qid], dict):
                doc["codingState"][qid] = {
                    "code": {},
                    "lastLanguage": cd.language,
                    "status": cd.status or "ATTEMPTED",
                    "passedTestCases": 0,
                    "totalTestCases": 0,
                    "passPercentage": 0.0,
                }
            target = doc["codingState"][qid]
            if "code" not in target or not isinstance(target["code"], dict):
                target["code"] = {}
            target["code"][cd.language] = cd.code
            target["lastLanguage"] = cd.lastLanguage or cd.language
            if cd.status is not None:
                target["status"] = cd.status
            if cd.bestVerdict is not None:
                target["bestVerdict"] = cd.bestVerdict
            if cd.lastSubmissionId is not None:
                target["lastSubmissionId"] = cd.lastSubmissionId
            if cd.passedTestCases is not None:
                target["passedTestCases"] = cd.passedTestCases
            if cd.totalTestCases is not None:
                target["totalTestCases"] = cd.totalTestCases
            if cd.passPercentage is not None:
                target["passPercentage"] = cd.passPercentage
            if cd.submittedAt is not None:
                target["submittedAt"] = cd.submittedAt
            if cd.timeSpentSeconds is not None:
                target["timeSpentSeconds"] = cd.timeSpentSeconds

        # 4. Proctoring Delta
        if sync_data.proctoringDelta:
            if "proctoring" not in doc or not isinstance(doc["proctoring"], dict):
                doc["proctoring"] = {
                    "tabSwitchCount": 0,
                    "copyPasteAttempts": 0,
                    "fullscreenExitCount": 0,
                    "violationsLog": [],
                }
            pd = sync_data.proctoringDelta
            if pd.tabSwitchCount is not None:
                doc["proctoring"]["tabSwitchCount"] = pd.tabSwitchCount
            if pd.copyPasteAttempts is not None:
                doc["proctoring"]["copyPasteAttempts"] = pd.copyPasteAttempts
            if pd.fullscreenExitCount is not None:
                doc["proctoring"]["fullscreenExitCount"] = pd.fullscreenExitCount
            if pd.newViolation is not None:
                v_dict = (
                    pd.newViolation.model_dump()
                    if hasattr(pd.newViolation, "model_dump")
                    else pd.newViolation
                )
                doc["proctoring"].setdefault("violationsLog", []).append(v_dict)

        # 5. Full/Bulk fields
        is_delta_mode = sync_data.isDelta if sync_data.isDelta is not None else False
        if sync_data.mcqAnswers is not None:
            if "mcqAnswers" not in doc or not isinstance(doc["mcqAnswers"], dict):
                doc["mcqAnswers"] = {}
            if is_delta_mode:
                doc["mcqAnswers"].update(sync_data.mcqAnswers)
            else:
                doc["mcqAnswers"] = dict(sync_data.mcqAnswers)

        if sync_data.reviewedQuestionIds is not None:
            doc["reviewedQuestionIds"] = list(sync_data.reviewedQuestionIds)

        if sync_data.codingState is not None:
            if "codingState" not in doc or not isinstance(doc["codingState"], dict):
                doc["codingState"] = {}
            if is_delta_mode:
                for qid, state in sync_data.codingState.items():
                    s_dict = state.model_dump() if hasattr(state, "model_dump") else dict(state)
                    if qid not in doc["codingState"]:
                        doc["codingState"][qid] = s_dict
                    else:
                        if "code" in s_dict and isinstance(s_dict["code"], dict):
                            doc["codingState"][qid].setdefault("code", {}).update(s_dict["code"])
                        for k, v in s_dict.items():
                            if k != "code":
                                doc["codingState"][qid][k] = v
            else:
                serialized = {}
                for qid, state in sync_data.codingState.items():
                    serialized[qid] = state.model_dump() if hasattr(state, "model_dump") else dict(state)
                doc["codingState"] = serialized

        if sync_data.proctoring is not None:
            doc["proctoring"] = (
                sync_data.proctoring.model_dump()
                if hasattr(sync_data.proctoring, "model_dump")
                else dict(sync_data.proctoring)
            )

    def sync_contest_session(
        self,
        contest_id_or_slug: str,
        sync_data: ContestSessionSyncRequest
    ) -> Dict[str, Any]:
        """Saves live in-progress contest state, answers, code, and proctoring telemetry in real-time.
        Supports both granular deltas and full state updates without overwriting untouched data.
        """
        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        coll = self._get_submissions_coll()
        now = datetime.now(timezone.utc).isoformat()

        id_conditions = [{"studentId": sync_data.studentId}]
        if sync_data.studentEmail:
            id_conditions.append({"studentEmail": sync_data.studentEmail.lower().strip()})
        query = {
            "contestId": contest.id,
            "$or": id_conditions
        }

        set_fields: Dict[str, Any] = {"updatedAt": now}
        unset_fields: Dict[str, Any] = {}
        add_to_set_fields: Dict[str, Any] = {}
        pull_fields: Dict[str, Any] = {}
        push_fields: Dict[str, Any] = {}

        if sync_data.timeSpentSeconds is not None:
            set_fields["timeSpentSeconds"] = sync_data.timeSpentSeconds

        # 1. MCQ Delta
        if sync_data.mcqDelta:
            qid = sync_data.mcqDelta.questionId
            opt = sync_data.mcqDelta.selectedOptionId
            if opt:
                set_fields[f"mcqAnswers.{qid}"] = opt
            else:
                unset_fields[f"mcqAnswers.{qid}"] = ""

        # 2. Review Delta
        if sync_data.reviewDelta:
            qid = sync_data.reviewDelta.questionId
            if sync_data.reviewDelta.isReviewed:
                add_to_set_fields["reviewedQuestionIds"] = qid
            else:
                pull_fields["reviewedQuestionIds"] = qid

        # 3. Coding Delta
        if sync_data.codingDelta:
            cd = sync_data.codingDelta
            qid = cd.questionId
            lang = cd.language
            set_fields[f"codingState.{qid}.code.{lang}"] = cd.code
            set_fields[f"codingState.{qid}.lastLanguage"] = cd.lastLanguage or lang
            if cd.status is not None:
                set_fields[f"codingState.{qid}.status"] = cd.status
            if cd.bestVerdict is not None:
                set_fields[f"codingState.{qid}.bestVerdict"] = cd.bestVerdict
            if cd.lastSubmissionId is not None:
                set_fields[f"codingState.{qid}.lastSubmissionId"] = cd.lastSubmissionId
            if cd.passedTestCases is not None:
                set_fields[f"codingState.{qid}.passedTestCases"] = cd.passedTestCases
            if cd.totalTestCases is not None:
                set_fields[f"codingState.{qid}.totalTestCases"] = cd.totalTestCases
            if cd.passPercentage is not None:
                set_fields[f"codingState.{qid}.passPercentage"] = cd.passPercentage
            if cd.submittedAt is not None:
                set_fields[f"codingState.{qid}.submittedAt"] = cd.submittedAt
            if cd.timeSpentSeconds is not None:
                set_fields[f"codingState.{qid}.timeSpentSeconds"] = cd.timeSpentSeconds

        # 4. Proctoring Delta
        if sync_data.proctoringDelta:
            pd = sync_data.proctoringDelta
            if pd.tabSwitchCount is not None:
                set_fields["proctoring.tabSwitchCount"] = pd.tabSwitchCount
            if pd.copyPasteAttempts is not None:
                set_fields["proctoring.copyPasteAttempts"] = pd.copyPasteAttempts
            if pd.fullscreenExitCount is not None:
                set_fields["proctoring.fullscreenExitCount"] = pd.fullscreenExitCount
            if pd.newViolation is not None:
                v_dict = (
                    pd.newViolation.model_dump()
                    if hasattr(pd.newViolation, "model_dump")
                    else pd.newViolation
                )
                push_fields["proctoring.violationsLog"] = v_dict

        # 5. Full/Bulk fields
        is_delta_mode = sync_data.isDelta if sync_data.isDelta is not None else False
        if sync_data.mcqAnswers is not None:
            if is_delta_mode:
                for qid, ans in sync_data.mcqAnswers.items():
                    set_fields[f"mcqAnswers.{qid}"] = ans
            else:
                set_fields["mcqAnswers"] = sync_data.mcqAnswers

        if sync_data.reviewedQuestionIds is not None:
            set_fields["reviewedQuestionIds"] = sync_data.reviewedQuestionIds

        if sync_data.codingState is not None:
            if is_delta_mode:
                for qid, state in sync_data.codingState.items():
                    s_dict = state.model_dump() if hasattr(state, "model_dump") else state
                    if isinstance(s_dict, dict):
                        for lang, code in s_dict.get("code", {}).items():
                            set_fields[f"codingState.{qid}.code.{lang}"] = code
                        for f in ["lastLanguage", "status", "bestVerdict", "lastSubmissionId", "passedTestCases", "totalTestCases", "passPercentage"]:
                            if f in s_dict:
                                set_fields[f"codingState.{qid}.{f}"] = s_dict[f]
            else:
                serialized_coding = {}
                for qid, state in sync_data.codingState.items():
                    if hasattr(state, "model_dump"):
                        serialized_coding[qid] = state.model_dump()
                    elif isinstance(state, dict):
                        serialized_coding[qid] = state
                set_fields["codingState"] = serialized_coding

        if sync_data.proctoring is not None:
            set_fields["proctoring"] = (
                sync_data.proctoring.model_dump()
                if hasattr(sync_data.proctoring, "model_dump")
                else sync_data.proctoring
            )

        mongo_update: Dict[str, Any] = {}
        if set_fields:
            mongo_update["$set"] = set_fields
        if unset_fields:
            mongo_update["$unset"] = unset_fields
        if add_to_set_fields:
            mongo_update["$addToSet"] = add_to_set_fields
        if pull_fields:
            mongo_update["$pull"] = pull_fields
        if push_fields:
            mongo_update["$push"] = push_fields

        if coll is not None:
            existing = coll.find_one(query)
            if existing:
                if existing.get("status") == "SUBMITTED":
                    clean = dict(existing)
                    clean.pop("_id", None)
                    return {"ok": False, "status": "ALREADY_SUBMITTED", "alreadySubmitted": True, "submission": clean}
                if self._is_session_expired(contest, existing):
                    self._apply_sync_to_doc_dict(existing, sync_data, now)
                    auto_resp = self._auto_submit_session(contest, existing)
                    clean_sub = auto_resp.model_dump()
                    return {
                        "ok": True,
                        "status": "SUBMITTED",
                        "alreadySubmitted": True,
                        "timeExpired": True,
                        "submission": clean_sub,
                    }

            # Only update if still IN_PROGRESS (cannot overwrite once SUBMITTED!)
            res = coll.update_one(
                {**query, "status": "IN_PROGRESS"},
                mongo_update
            )
            if res.matched_count == 0:
                doc = coll.find_one(query)
                if doc and doc.get("status") == "SUBMITTED":
                    clean = dict(doc)
                    clean.pop("_id", None)
                    return {"ok": False, "status": "ALREADY_SUBMITTED", "alreadySubmitted": True, "submission": clean}
                new_id = f"csub-{uuid.uuid4().hex[:12]}"
                new_doc = {
                    "_id": new_id,
                    "id": new_id,
                    "contestId": contest.id,
                    "studentId": sync_data.studentId,
                    "studentEmail": (sync_data.studentEmail or "").strip().lower(),
                    "studentName": sync_data.studentName or "",
                    "status": "IN_PROGRESS",
                    "startedAt": now,
                    "updatedAt": now,
                    "mcqQuestions": [],
                    "codingQuestions": [],
                    "mcqAnswers": {},
                    "reviewedQuestionIds": [],
                    "codingState": {},
                    "proctoring": {
                        "tabSwitchCount": 0,
                        "copyPasteAttempts": 0,
                        "fullscreenExitCount": 0,
                        "violationsLog": [],
                    },
                    "timeSpentSeconds": 0,
                }
                self._apply_sync_to_doc_dict(new_doc, sync_data, now)
                coll.insert_one(new_doc)
        else:
            found = False
            for s_id, s in self._memory_submissions.items():
                if s.get("contestId") == contest.id and (
                    s.get("studentId") == sync_data.studentId or
                    (sync_data.studentEmail and s.get("studentEmail", "").lower() == sync_data.studentEmail.lower().strip())
                ):
                    if s.get("status") == "SUBMITTED":
                        clean = dict(s)
                        clean.pop("_id", None)
                        return {"ok": False, "status": "ALREADY_SUBMITTED", "alreadySubmitted": True, "submission": clean}
                    self._apply_sync_to_doc_dict(s, sync_data, now)
                    if self._is_session_expired(contest, s):
                        auto_resp = self._auto_submit_session(contest, s)
                        clean_sub = auto_resp.model_dump()
                        return {
                            "ok": True,
                            "status": "SUBMITTED",
                            "alreadySubmitted": True,
                            "timeExpired": True,
                            "submission": clean_sub,
                        }
                    found = True
                    break
            if not found:
                new_id = f"csub-{uuid.uuid4().hex[:12]}"
                new_doc = {
                    "_id": new_id,
                    "id": new_id,
                    "contestId": contest.id,
                    "studentId": sync_data.studentId,
                    "studentEmail": (sync_data.studentEmail or "").strip().lower(),
                    "studentName": sync_data.studentName or "",
                    "status": "IN_PROGRESS",
                    "startedAt": now,
                    "updatedAt": now,
                    "mcqQuestions": [],
                    "codingQuestions": [],
                    "mcqAnswers": {},
                    "reviewedQuestionIds": [],
                    "codingState": {},
                    "proctoring": {
                        "tabSwitchCount": 0,
                        "copyPasteAttempts": 0,
                        "fullscreenExitCount": 0,
                        "violationsLog": [],
                    },
                    "timeSpentSeconds": 0,
                }
                self._apply_sync_to_doc_dict(new_doc, sync_data, now)
                self._memory_submissions[new_id] = new_doc

        return {"ok": True, "status": "SYNCED"}

    def _resolve_mcq_questions(self, config: MCQSectionConfig) -> List[Dict[str, Any]]:
        mcq_service = MCQService(self.db)
        selected_docs = []

        if config.mode == SelectionMode.MANUAL and config.questionIds:
            for qid in config.questionIds:
                q = mcq_service.get_question(qid)
                if q:
                    selected_docs.append(q.model_dump())
        else:
            # RANDOM mode based on categories / rules
            all_mcqs = mcq_service.list_questions(status="PUBLISHED", summary=False)
            by_category: Dict[str, List[Any]] = {}
            for q in all_mcqs:
                by_category.setdefault(q.category.upper(), []).append(q)

            if config.randomRules:
                for rule in config.randomRules:
                    cat = rule.category.upper()
                    pool = by_category.get(cat, []) if cat != "ALL" else all_mcqs
                    sample_size = min(len(pool), rule.count)
                    if sample_size > 0:
                        sampled = random.sample(pool, sample_size)
                        for item in sampled:
                            if item.id not in [x["id"] for x in selected_docs]:
                                selected_docs.append(item.model_dump())
            else:
                target_count = config.totalQuestions or 25
                sample_size = min(len(all_mcqs), target_count)
                sampled = random.sample(all_mcqs, sample_size) if sample_size > 0 else []
                selected_docs = [q.model_dump() for q in sampled]

        # Security: mask isCorrect and remove explanations during active contest session
        masked_mcqs = []
        for doc in selected_docs:
            clean = dict(doc)
            clean.pop("explanation", None)
            masked_options = []
            for opt in clean.get("options", []):
                opt_copy = dict(opt)
                opt_copy.pop("isCorrect", None)
                opt_copy.pop("explanation", None)
                masked_options.append(opt_copy)
            clean["options"] = masked_options
            masked_mcqs.append(clean)

        return masked_mcqs

    def _resolve_coding_questions(self, config: CodingSectionConfig) -> List[Dict[str, Any]]:
        q_service = QuestionService(self.db)
        selected_docs = []

        if config.mode == SelectionMode.MANUAL and config.questionIds:
            for qid in config.questionIds:
                q = q_service.get_question(qid)
                if q:
                    selected_docs.append(self._format_coding_question(q))
        else:
            # RANDOM mode based on difficulty / tags
            all_questions = q_service.list_questions(status="PUBLISHED", summary=False)
            by_difficulty: Dict[str, List[Any]] = {}
            for q in all_questions:
                diff = getattr(q.difficulty, "value", str(q.difficulty)).upper()
                by_difficulty.setdefault(diff, []).append(q)

            if config.randomRules:
                for rule in config.randomRules:
                    diff = rule.difficulty.upper()
                    pool = by_difficulty.get(diff, []) if diff != "ALL" else all_questions
                    sample_size = min(len(pool), rule.count)
                    if sample_size > 0:
                        sampled = random.sample(pool, sample_size)
                        for item in sampled:
                            if item.id not in [x["id"] for x in selected_docs]:
                                selected_docs.append(self._format_coding_question(item))
            else:
                target_count = config.totalQuestions or 3
                sample_size = min(len(all_questions), target_count)
                sampled = random.sample(all_questions, sample_size) if sample_size > 0 else []
                selected_docs = [self._format_coding_question(q) for q in sampled]

        return selected_docs

    def _format_coding_question(self, question: Any) -> Dict[str, Any]:
        """Converts Question to candidate-facing contest format."""
        examples = []
        for ex in getattr(question, "examples", []):
            if hasattr(ex, "model_dump"):
                examples.append(ex.model_dump())
            elif isinstance(ex, dict):
                examples.append(ex)

        return {
            "id": question.id,
            "slug": question.slug,
            "title": question.title,
            "difficulty": getattr(question.difficulty, "value", str(question.difficulty)),
            "tags": getattr(question, "tags", []),
            "statement": question.statement,
            "examples": examples,
            "constraints": getattr(question, "constraints", []),
            "starterCode": getattr(question, "starterCode", {}),
            "points": 10,
        }

    def submit_contest(self, contest_id_or_slug: str, submit_data: ContestSubmitRequest) -> ContestSubmitResponse:
        """Evaluates student's contest answers, locks the session as SUBMITTED, and persists scorecard."""
        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        coll = self._get_submissions_coll()
        id_conditions = [{"studentId": submit_data.studentId}]
        if submit_data.studentEmail:
            id_conditions.append({"studentEmail": submit_data.studentEmail.lower().strip()})
        query = {
            "contestId": contest.id,
            "$or": id_conditions
        }

        existing_doc = None
        if coll is not None:
            existing_doc = coll.find_one(query)
        else:
            for s in self._memory_submissions.values():
                if s.get("contestId") == contest.id and (
                    s.get("studentId") == submit_data.studentId or
                    (submit_data.studentEmail and s.get("studentEmail", "").lower() == submit_data.studentEmail.lower().strip())
                ):
                    existing_doc = s
                    break

        # Single attempt rule: If already finalized, return the locked scorecard
        if existing_doc and existing_doc.get("status") == "SUBMITTED":
            clean = dict(existing_doc)
            clean.pop("_id", None)
            return ContestSubmitResponse(**clean)

        # Detect timeout and auto-submit flag
        is_timeout = self._is_session_expired(contest, existing_doc) if existing_doc else False
        is_auto = getattr(submit_data, "isAutoSubmitted", False) or is_timeout

        # Merge MCQ answers: whatever was synced in DB coalesced with any incoming answers
        existing_mcq_answers = existing_doc.get("mcqAnswers", {}) if existing_doc else {}
        merged_mcq_answers = dict(existing_mcq_answers)
        if submit_data.mcqAnswers:
            merged_mcq_answers.update(submit_data.mcqAnswers)

        # Merge Coding State: whatever was synced in DB coalesced with any incoming coding state
        existing_coding_state = existing_doc.get("codingState", {}) if existing_doc else {}
        merged_coding_state = dict(existing_coding_state)
        if submit_data.codingState:
            for qid, cs in submit_data.codingState.items():
                cs_dict = cs.model_dump() if hasattr(cs, "model_dump") else (dict(cs) if isinstance(cs, dict) else cs)
                if qid in merged_coding_state and isinstance(merged_coding_state[qid], dict):
                    merged_coding_state[qid].update(cs_dict)
                else:
                    merged_coding_state[qid] = cs_dict

        # Merge Coding Submissions
        existing_coding_subs = existing_doc.get("codingSubmissions", {}) if existing_doc else {}
        merged_coding_subs = dict(existing_coding_subs)
        if submit_data.codingSubmissions:
            merged_coding_subs.update(submit_data.codingSubmissions)
        for qid, cs in merged_coding_state.items():
            sub_id = _safe_get(cs, "lastSubmissionId")
            if sub_id and qid not in merged_coding_subs:
                merged_coding_subs[qid] = sub_id

        # 1. Resolve complete set of MCQs for this contest session
        contest_mcqs = []
        if existing_doc and existing_doc.get("mcqQuestions"):
            contest_mcqs = existing_doc.get("mcqQuestions", [])
        elif contest.hasMcq and contest.mcqConfig and contest.mcqConfig.enabled:
            contest_mcqs = self._resolve_mcq_questions(contest.mcqConfig)

        # Fallback if still empty but answers provided
        if not contest_mcqs and merged_mcq_answers:
            contest_mcqs = [{"id": qid} for qid in merged_mcq_answers.keys()]

        mcq_service = MCQService(self.db)
        mcq_breakdown: List[MCQReviewItem] = []
        mcq_correct_count = 0
        mcq_total_count = len(contest_mcqs)
        if mcq_total_count == 0 and contest.hasMcq and contest.mcqConfig:
            mcq_total_count = contest.mcqConfig.totalQuestions or 25

        for mq in contest_mcqs:
            qid = mq.get("id") if isinstance(mq, dict) else getattr(mq, "id", str(mq))
            q_db = mcq_service.get_question(qid)

            title = q_db.title if q_db else mq.get("title", f"Question {qid}")
            category = q_db.category if q_db else mq.get("category", "General")
            difficulty = getattr(q_db.difficulty, "value", str(q_db.difficulty)) if q_db else mq.get("difficulty", "MEDIUM")
            statement = q_db.statement if q_db else mq.get("statement", "")
            explanation = q_db.explanation if q_db else mq.get("explanation")
            options = [opt.model_dump() for opt in q_db.options] if q_db else mq.get("options", [])
            points = q_db.points if q_db else mq.get("points", 1)

            correct_opt = next((opt for opt in q_db.options if opt.isCorrect), None) if q_db else None
            correct_opt_id = correct_opt.id if correct_opt else ""

            selected_opt = merged_mcq_answers.get(qid)
            is_attempted = bool(selected_opt)
            is_correct = bool(is_attempted and correct_opt_id and selected_opt == correct_opt_id)

            pts = points if is_correct else 0
            if is_correct:
                mcq_correct_count += 1

            mcq_breakdown.append(
                MCQReviewItem(
                    questionId=qid,
                    title=title,
                    category=category,
                    difficulty=difficulty,
                    statement=statement,
                    selectedOptionId=selected_opt,
                    correctOptionId=correct_opt_id,
                    isCorrect=is_correct,
                    pointsAwarded=pts,
                    explanation=explanation,
                    options=options,
                )
            )

        mcq_percentage = round((mcq_correct_count / max(1, mcq_total_count)) * 100, 1) if mcq_total_count > 0 else 0.0

        # 2. Resolve complete set of Coding questions for this contest session
        contest_coding = []
        if existing_doc and existing_doc.get("codingQuestions"):
            contest_coding = existing_doc.get("codingQuestions", [])
        elif contest.hasCoding and contest.codingConfig and contest.codingConfig.enabled:
            contest_coding = self._resolve_coding_questions(contest.codingConfig)

        # Fallback if empty but submissions or state provided
        if not contest_coding:
            coding_keys = list(merged_coding_subs.keys())
            for k in merged_coding_state.keys():
                if k not in coding_keys:
                    coding_keys.append(k)
            contest_coding = [{"id": k} for k in coding_keys]

        coding_breakdown: List[CodingReviewItem] = []
        coding_attempted = 0
        total_coding_percentage = 0.0
        coding_total_count = len(contest_coding)
        if coding_total_count == 0 and contest.hasCoding and contest.codingConfig:
            coding_total_count = contest.codingConfig.totalQuestions or 3

        sub_service = SubmissionService(self.db)
        q_service = QuestionService(self.db)

        for cq in contest_coding:
            qid = cq.get("id") if isinstance(cq, dict) else getattr(cq, "id", str(cq))
            q_db = q_service.get_question(qid)
            title = q_db.title if q_db else cq.get("title", qid)
            diff = getattr(q_db.difficulty, "value", str(q_db.difficulty)) if q_db else cq.get("difficulty", "MEDIUM")

            c_state = merged_coding_state.get(qid)
            sub_id = merged_coding_subs.get(qid) or _safe_get(c_state, "lastSubmissionId")

            passed_tests = 0
            total_tests = 0
            verdict = None

            # Look up submission in database
            if sub_id:
                sub_doc = sub_service.get_submission(sub_id)
                if sub_doc:
                    if sub_doc.tests:
                        total_tests = getattr(sub_doc.tests, "total", 0)
                        passed_tests = getattr(sub_doc.tests, "passed", 0)
                    verdict = getattr(sub_doc.verdict, "value", str(sub_doc.verdict)) if sub_doc.verdict else None
            else:
                # Query submissions collection if candidate submitted during contest
                try:
                    user_subs = sub_service.list_submissions(
                        user_id=submit_data.studentId,
                        question_id=qid,
                        contest_id=contest.id,
                        limit=5
                    )
                    if not user_subs and submit_data.studentEmail:
                        user_subs = sub_service.list_submissions(
                            user_id=submit_data.studentEmail,
                            question_id=qid,
                            contest_id=contest.id,
                            limit=5
                        )
                    if user_subs:
                        best_sub = next(
                            (s for s in user_subs if str(getattr(s, "verdict", "")).upper() == "ACCEPTED"),
                            user_subs[0]
                        )
                        sub_id = getattr(best_sub, "id", None) or getattr(best_sub, "submissionId", None)
                        if getattr(best_sub, "tests", None):
                            total_tests = getattr(best_sub.tests, "total", 0)
                            passed_tests = getattr(best_sub.tests, "passed", 0)
                        verdict = str(getattr(best_sub, "verdict", "")) if getattr(best_sub, "verdict", None) else None
                except Exception:
                    pass

            # Fallback to c_state telemetry
            if c_state:
                if total_tests == 0 and _safe_get(c_state, "totalTestCases", 0):
                    total_tests = int(_safe_get(c_state, "totalTestCases", 0))
                    passed_tests = int(_safe_get(c_state, "passedTestCases", 0))
                if not verdict:
                    verdict = _safe_get(c_state, "bestVerdict", None) or _safe_get(c_state, "status", None)

            # Determine whether question was attempted
            is_attempted = bool(sub_id) or (_safe_get(c_state, "status", "UNATTEMPTED") not in ["UNATTEMPTED", "", None])

            if not is_attempted:
                # Unattempted: 0% / 0 marks
                score_pct = 0.0
                status_label = "UNATTEMPTED"
            else:
                coding_attempted += 1
                if verdict == "ACCEPTED":
                    score_pct = 100.0
                    status_label = "ACCEPTED"
                    if total_tests == 0:
                        total_tests = 1
                        passed_tests = 1
                elif total_tests > 0:
                    score_pct = round((passed_tests / total_tests) * 100, 1)
                    if score_pct == 100.0:
                        status_label = "ACCEPTED"
                    elif score_pct > 0.0:
                        status_label = "PARTIAL"
                    else:
                        status_label = verdict or "FAILED"
                elif _safe_get(c_state, "passPercentage", None) is not None and float(_safe_get(c_state, "passPercentage", 0)) > 0:
                    score_pct = float(_safe_get(c_state, "passPercentage"))
                    status_label = "ACCEPTED" if score_pct == 100.0 else "PARTIAL"
                else:
                    # Attempted with errors or 0 test cases passed
                    score_pct = 0.0
                    status_label = verdict or "FAILED"

            total_coding_percentage += score_pct
            coding_item_submitted_at = _safe_get(c_state, "submittedAt") or (getattr(sub_doc, "submittedAt", None) if 'sub_doc' in locals() and sub_doc else None) or (getattr(sub_doc, "createdAt", None) if 'sub_doc' in locals() and sub_doc else None)
            coding_item_time_spent = _safe_get(c_state, "timeSpentSeconds") or (getattr(sub_doc, "timeSpentSeconds", None) if 'sub_doc' in locals() and sub_doc else None)

            coding_breakdown.append(
                CodingReviewItem(
                    questionId=qid,
                    title=title,
                    difficulty=diff,
                    submissionId=sub_id if sub_id else None,
                    status=status_label,
                    score=score_pct,
                    passedTestCases=passed_tests,
                    totalTestCases=total_tests,
                    percentage=score_pct,
                    submittedAt=coding_item_submitted_at,
                    timeSpentSeconds=coding_item_time_spent,
                )
            )

        avg_coding_score = round(total_coding_percentage / max(1, coding_total_count), 1) if coding_total_count > 0 else 0.0

        # Calculate section percentages & overall percentage without raw-point mixing
        has_mcq_section = contest.hasMcq and mcq_total_count > 0
        has_coding_section = contest.hasCoding and coding_total_count > 0

        if has_mcq_section and has_coding_section:
            overall_percentage = round((mcq_percentage + avg_coding_score) / 2, 1)
        elif has_mcq_section:
            overall_percentage = mcq_percentage
        elif has_coding_section:
            overall_percentage = avg_coding_score
        else:
            overall_percentage = 0.0

        sub_id = (existing_doc.get("id") or str(existing_doc.get("_id"))) if existing_doc else f"csub-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        # Resolve accurate timeSpentSeconds: never exceed duration limit, but reflect elapsed
        time_spent = submit_data.timeSpentSeconds or (existing_doc.get("timeSpentSeconds", 0) if existing_doc else 0)
        if existing_doc and existing_doc.get("startedAt"):
            try:
                st_dt = datetime.fromisoformat(existing_doc["startedAt"].replace("Z", "+00:00"))
                now_dt = datetime.now(timezone.utc)
                elapsed_sec = int((now_dt - st_dt).total_seconds())
                time_spent = max(time_spent, elapsed_sec)
            except Exception:
                pass
        max_duration_sec = (contest.durationMinutes or 90) * 60
        time_spent = min(time_spent, max_duration_sec)

        # Resolve proctoring telemetry
        proctoring_val = submit_data.proctoring
        if not proctoring_val and existing_doc and existing_doc.get("proctoring"):
            if isinstance(existing_doc["proctoring"], dict):
                proctoring_val = ProctoringTelemetry(**existing_doc["proctoring"])
            else:
                proctoring_val = existing_doc["proctoring"]

        coding_state_to_save = {}
        for k, v in merged_coding_state.items():
            if hasattr(v, "model_dump"):
                coding_state_to_save[k] = v.model_dump()
            elif isinstance(v, dict):
                coding_state_to_save[k] = v

        response = ContestSubmitResponse(
            submissionId=sub_id,
            contestId=contest.id,
            studentId=submit_data.studentId,
            studentEmail=submit_data.studentEmail or (existing_doc.get("studentEmail", "") if existing_doc else ""),
            totalScore=overall_percentage,
            maxTotalScore=100.0,
            mcqScore=mcq_percentage,
            maxMcqScore=100.0,
            mcqCorrectCount=mcq_correct_count,
            mcqTotalCount=mcq_total_count,
            mcqPercentage=mcq_percentage,
            codingScore=avg_coding_score,
            maxCodingScore=100.0,
            codingProblemsAttempted=coding_attempted,
            codingTotalCount=coding_total_count,
            percentage=overall_percentage,
            timeSpentSeconds=time_spent,
            submittedAt=now,
            mcqBreakdown=mcq_breakdown,
            codingBreakdown=coding_breakdown,
            proctoring=proctoring_val,
            codingState=coding_state_to_save,
            isAutoSubmitted=is_auto,
        )

        # Persist submission in DB as SUBMITTED (locked)
        doc = response.model_dump()
        doc["_id"] = sub_id
        doc["status"] = "SUBMITTED"
        doc["updatedAt"] = now
        doc["isAutoSubmitted"] = is_auto
        doc["mcqAnswers"] = merged_mcq_answers
        doc["codingSubmissions"] = merged_coding_subs
        if existing_doc:
            if "mcqQuestions" in existing_doc and "mcqQuestions" not in doc:
                doc["mcqQuestions"] = existing_doc["mcqQuestions"]
            if "codingQuestions" in existing_doc and "codingQuestions" not in doc:
                doc["codingQuestions"] = existing_doc["codingQuestions"]
            if "startedAt" in existing_doc:
                doc["startedAt"] = existing_doc["startedAt"]

        if coll is not None:
            coll.update_one(
                {"_id": sub_id},
                {"$set": doc},
                upsert=True
            )
        else:
            self._memory_submissions[sub_id] = doc

        return response

    def get_contest_submissions(
        self,
        contest_id_or_slug: str,
        page: Optional[int] = 1,
        limit: Optional[int] = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: Optional[str] = "rank_asc",
    ) -> ContestSubmissionsResponse:
        """Retrieves paginated, lightweight candidate submissions directly from the DB layer.
        Excludes full question catalogs and code states to keep the payload minimal.
        """
        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        # Auto-finalize any sessions that have exceeded duration
        self._auto_finalize_expired_sessions(contest)

        coll = self._get_submissions_coll()
        page_num = max(1, page or 1)
        limit_num = max(1, min(100, limit or 10))
        skip_num = (page_num - 1) * limit_num

        if coll is not None:
            candidate_filter: dict = {"contestId": contest.id}
            if status and status.strip() and status.strip().upper() != "ALL":
                candidate_filter["status"] = status.strip().upper()
            if search and search.strip():
                sq = re.escape(search.strip())
                candidate_filter["$or"] = [
                    {"studentName": {"$regex": sq, "$options": "i"}},
                    {"studentEmail": {"$regex": sq, "$options": "i"}},
                    {"studentId": {"$regex": sq, "$options": "i"}},
                ]

            try:
                total_subs_count = coll.count_documents(candidate_filter)
            except Exception:
                total_subs_count = 0
            total_pages = max(1, (total_subs_count + limit_num - 1) // limit_num)

            sort_spec = [("totalScore", -1), ("timeSpentSeconds", 1)]
            if sort_by == "score_asc":
                sort_spec = [("totalScore", 1), ("timeSpentSeconds", 1)]
            elif sort_by == "time_asc":
                sort_spec = [("timeSpentSeconds", 1)]
            elif sort_by == "infractions_desc":
                sort_spec = [("proctoring.tabSwitchCount", -1)]

            candidate_projection = {
                "_id": 1,
                "id": 1,
                "submissionId": 1,
                "contestId": 1,
                "studentId": 1,
                "studentName": 1,
                "studentEmail": 1,
                "status": 1,
                "startedAt": 1,
                "submittedAt": 1,
                "updatedAt": 1,
                "isAutoSubmitted": 1,
                "totalScore": 1,
                "maxTotalScore": 1,
                "percentage": 1,
                "mcqScore": 1,
                "maxMcqScore": 1,
                "mcqCorrectCount": 1,
                "mcqTotalCount": 1,
                "codingScore": 1,
                "maxCodingScore": 1,
                "codingProblemsAttempted": 1,
                "codingTotalCount": 1,
                "timeSpentSeconds": 1,
                "proctoring.tabSwitchCount": 1,
                "proctoring.copyPasteAttempts": 1,
                "proctoring.fullscreenExitCount": 1,
            }

            cursor = coll.find(candidate_filter, candidate_projection).sort(sort_spec).skip(skip_num).limit(limit_num)
            lightweight_submissions = []
            for s in cursor:
                proc = s.get("proctoring") or {}
                lightweight_submissions.append({
                    "id": s.get("id") or str(s.get("_id")),
                    "submissionId": s.get("submissionId") or s.get("id") or str(s.get("_id")),
                    "contestId": s.get("contestId"),
                    "studentId": s.get("studentId"),
                    "studentName": s.get("studentName"),
                    "studentEmail": s.get("studentEmail"),
                    "status": s.get("status"),
                    "isAutoSubmitted": s.get("isAutoSubmitted", False),
                    "startedAt": s.get("startedAt"),
                    "submittedAt": s.get("submittedAt"),
                    "updatedAt": s.get("updatedAt"),
                    "totalScore": s.get("totalScore", 0),
                    "maxTotalScore": s.get("maxTotalScore", 100),
                    "percentage": s.get("percentage", 0.0),
                    "mcqScore": s.get("mcqScore", 0),
                    "maxMcqScore": s.get("maxMcqScore", 0),
                    "mcqCorrectCount": s.get("mcqCorrectCount", 0),
                    "mcqTotalCount": s.get("mcqTotalCount", 0),
                    "codingScore": s.get("codingScore", 0),
                    "maxCodingScore": s.get("maxCodingScore", 0),
                    "codingProblemsAttempted": s.get("codingProblemsAttempted", 0),
                    "codingTotalCount": s.get("codingTotalCount", 0),
                    "timeSpentSeconds": s.get("timeSpentSeconds", 0),
                    "proctoring": {
                        "tabSwitchCount": proc.get("tabSwitchCount", 0),
                        "copyPasteAttempts": proc.get("copyPasteAttempts", 0),
                        "fullscreenExitCount": proc.get("fullscreenExitCount", 0),
                    },
                })

            return ContestSubmissionsResponse(
                submissions=lightweight_submissions,
                totalSubmissions=total_subs_count,
                page=page_num,
                limit=limit_num,
                totalPages=total_pages,
            )
        else:
            raw_submissions = []
            for s in self._memory_submissions.values():
                if s.get("contestId") == contest.id:
                    clean = dict(s)
                    clean["id"] = clean.get("id") or str(clean.get("_id"))
                    clean.pop("_id", None)
                    raw_submissions.append(clean)

            if status and status.strip() and status.strip().upper() != "ALL":
                raw_submissions = [s for s in raw_submissions if s.get("status") == status.strip().upper()]
            if search and search.strip():
                sq = search.strip().lower()
                raw_submissions = [
                    s for s in raw_submissions
                    if sq in (s.get("studentName") or "").lower()
                    or sq in (s.get("studentEmail") or "").lower()
                    or sq in (s.get("studentId") or "").lower()
                ]

            if sort_by == "score_asc":
                sorted_submissions = sorted(
                    raw_submissions,
                    key=lambda s: (s.get("totalScore", 0), s.get("timeSpentSeconds", 999999))
                )
            elif sort_by == "time_asc":
                sorted_submissions = sorted(
                    raw_submissions,
                    key=lambda s: s.get("timeSpentSeconds", 999999)
                )
            elif sort_by == "infractions_desc":
                sorted_submissions = sorted(
                    raw_submissions,
                    key=lambda s: -(s.get("proctoring", {}).get("tabSwitchCount", 0) if isinstance(s.get("proctoring"), dict) else 0)
                )
            else:
                sorted_submissions = sorted(
                    raw_submissions,
                    key=lambda s: (-s.get("totalScore", 0), s.get("timeSpentSeconds", 999999))
                )

            total_subs_count = len(sorted_submissions)
            total_pages = max(1, (total_subs_count + limit_num - 1) // limit_num)
            subs_slice = sorted_submissions[skip_num : skip_num + limit_num]

            lightweight_submissions = []
            for s in subs_slice:
                proc = s.get("proctoring") or {}
                lightweight_submissions.append({
                    "id": s.get("id"),
                    "submissionId": s.get("submissionId") or s.get("id"),
                    "contestId": s.get("contestId"),
                    "studentId": s.get("studentId"),
                    "studentName": s.get("studentName"),
                    "studentEmail": s.get("studentEmail"),
                    "status": s.get("status"),
                    "startedAt": s.get("startedAt"),
                    "submittedAt": s.get("submittedAt"),
                    "updatedAt": s.get("updatedAt"),
                    "totalScore": s.get("totalScore", 0),
                    "maxTotalScore": s.get("maxTotalScore", 100),
                    "percentage": s.get("percentage", 0.0),
                    "mcqScore": s.get("mcqScore", 0),
                    "maxMcqScore": s.get("maxMcqScore", 0),
                    "mcqCorrectCount": s.get("mcqCorrectCount", 0),
                    "mcqTotalCount": s.get("mcqTotalCount", 0),
                    "codingScore": s.get("codingScore", 0),
                    "maxCodingScore": s.get("maxCodingScore", 0),
                    "codingProblemsAttempted": s.get("codingProblemsAttempted", 0),
                    "codingTotalCount": s.get("codingTotalCount", 0),
                    "timeSpentSeconds": s.get("timeSpentSeconds", 0),
                    "proctoring": {
                        "tabSwitchCount": proc.get("tabSwitchCount", 0),
                        "copyPasteAttempts": proc.get("copyPasteAttempts", 0),
                        "fullscreenExitCount": proc.get("fullscreenExitCount", 0),
                    },
                })

            return ContestSubmissionsResponse(
                submissions=lightweight_submissions,
                totalSubmissions=total_subs_count,
                page=page_num,
                limit=limit_num,
                totalPages=total_pages,
            )

    def get_contest_analytics(
        self,
        contest_id_or_slug: str,
        page: Optional[int] = 1,
        limit: Optional[int] = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: Optional[str] = "rank_asc",
        include_submissions: bool = True,
    ) -> ContestAnalyticsResponse:
        """Calculates comprehensive analytics for a contest: overall KPIs, score distribution,
        per-question accuracy, coding problem acceptance rates, and proctoring violations.
        Optionally includes initial page of candidate submissions.
        """
        import statistics

        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        # Auto-finalize any sessions that have exceeded duration
        self._auto_finalize_expired_sessions(contest)

        coll = self._get_submissions_coll()
        page_num = max(1, page or 1)
        limit_num = max(1, min(100, limit or 10))

        if include_submissions:
            sub_res = self.get_contest_submissions(
                contest_id_or_slug=contest.id,
                page=page_num,
                limit=limit_num,
                search=search,
                status=status,
                sort_by=sort_by,
            )
            lightweight_submissions = sub_res.submissions
            total_subs_count = sub_res.totalSubmissions
            total_pages = sub_res.totalPages
        else:
            lightweight_submissions = []
            total_subs_count = 0
            total_pages = 1

        if coll is not None:
            # Fast cohort overview aggregations across all candidates for this contest
            totals_agg = []
            try:
                totals_agg = list(coll.aggregate([
                    {"$match": {"contestId": contest.id}},
                    {
                        "$group": {
                            "_id": None,
                            "totalCandidates": {"$sum": 1},
                            "completedCount": {"$sum": {"$cond": [{"$eq": ["$status", "SUBMITTED"]}, 1, 0]}},
                            "inProgressCount": {"$sum": {"$cond": [{"$eq": ["$status", "IN_PROGRESS"]}, 1, 0]}},
                            "avgScore": {"$avg": {"$cond": [{"$eq": ["$status", "SUBMITTED"]}, "$totalScore", "$$REMOVE"]}},
                            "maxScore": {"$max": {"$cond": [{"$eq": ["$status", "SUBMITTED"]}, "$totalScore", "$$REMOVE"]}},
                            "minScore": {"$min": {"$cond": [{"$eq": ["$status", "SUBMITTED"]}, "$totalScore", "$$REMOVE"]}},
                            "avgPercentage": {"$avg": {"$cond": [{"$eq": ["$status", "SUBMITTED"]}, "$percentage", "$$REMOVE"]}},
                            "avgTime": {"$avg": {"$cond": [{"$eq": ["$status", "SUBMITTED"]}, "$timeSpentSeconds", "$$REMOVE"]}},
                            "totalTabSwitches": {"$sum": "$proctoring.tabSwitchCount"},
                            "totalCopyPaste": {"$sum": "$proctoring.copyPasteAttempts"},
                            "totalFullscreenExits": {"$sum": "$proctoring.fullscreenExitCount"},
                            "scores": {"$push": {"$cond": [{"$eq": ["$status", "SUBMITTED"]}, "$totalScore", "$$REMOVE"]}},
                            "percentages": {"$push": {"$cond": [{"$eq": ["$status", "SUBMITTED"]}, "$percentage", "$$REMOVE"]}},
                        }
                    }
                ]))
            except Exception:
                pass

            total_candidates = 0
            completed_count = 0
            in_progress_count = 0
            completion_rate = 0.0
            average_score = 0.0
            median_score = 0.0
            highest_score = 0.0
            lowest_score = 0.0
            average_percentage = 0.0
            average_time = 0
            scores: List[float] = []
            percentages: List[float] = []
            total_tab_switches = 0
            total_copy_paste = 0
            total_fullscreen_exits = 0

            if totals_agg and totals_agg[0]:
                t_doc = totals_agg[0]
                total_candidates = t_doc.get("totalCandidates", 0)
                completed_count = t_doc.get("completedCount", 0)
                in_progress_count = t_doc.get("inProgressCount", 0)
                completion_rate = round((completed_count / max(1, total_candidates)) * 100, 1) if total_candidates > 0 else 0.0
                average_score = round(float(t_doc.get("avgScore") or 0.0), 1)
                highest_score = float(t_doc.get("maxScore") or 0.0)
                lowest_score = float(t_doc.get("minScore") or 0.0)
                average_percentage = round(float(t_doc.get("avgPercentage") or 0.0), 1)
                average_time = int(t_doc.get("avgTime") or 0)
                scores = [float(s) for s in t_doc.get("scores", []) if s is not None]
                median_score = round(statistics.median(scores), 1) if scores else 0.0
                percentages = [float(p) for p in t_doc.get("percentages", []) if p is not None]
                total_tab_switches = int(t_doc.get("totalTabSwitches") or 0)
                total_copy_paste = int(t_doc.get("totalCopyPaste") or 0)
                total_fullscreen_exits = int(t_doc.get("totalFullscreenExits") or 0)

            # Score Distribution Buckets (0-20%, 21-40%, 41-60%, 61-80%, 81-100%)
            bucket_counts = {"0-20%": 0, "21-40%": 0, "41-60%": 0, "61-80%": 0, "81-100%": 0}
            for pct in percentages:
                if pct <= 20:
                    bucket_counts["0-20%"] += 1
                elif pct <= 40:
                    bucket_counts["21-40%"] += 1
                elif pct <= 60:
                    bucket_counts["41-60%"] += 1
                elif pct <= 80:
                    bucket_counts["61-80%"] += 1
                else:
                    bucket_counts["81-100%"] += 1

            score_distribution = [
                ScoreBucket(
                    range=label,
                    count=cnt,
                    percentage=round((cnt / max(1, completed_count)) * 100, 1) if completed_count > 0 else 0.0
                )
                for label, cnt in bucket_counts.items()
            ]

            # Proctoring infractions & risk counts
            clean_candidates = 0
            flagged_candidates = 0
            high_risk_candidates = 0
            try:
                proc_docs = list(coll.aggregate([
                    {"$match": {"contestId": contest.id}},
                    {
                        "$project": {
                            "infr": {
                                "$add": [
                                    {"$ifNull": ["$proctoring.tabSwitchCount", 0]},
                                    {"$ifNull": ["$proctoring.copyPasteAttempts", 0]},
                                    {"$ifNull": ["$proctoring.fullscreenExitCount", 0]}
                                ]
                            }
                        }
                    },
                    {
                        "$group": {
                            "_id": None,
                            "cleanCount": {"$sum": {"$cond": [{"$eq": ["$infr", 0]}, 1, 0]}},
                            "flaggedCount": {"$sum": {"$cond": [{"$gt": ["$infr", 0]}, 1, 0]}},
                            "highRiskCount": {"$sum": {"$cond": [{"$gte": ["$infr", 3]}, 1, 0]}}
                        }
                    }
                ]))
                if proc_docs and proc_docs[0]:
                    clean_candidates = proc_docs[0].get("cleanCount", 0)
                    flagged_candidates = proc_docs[0].get("flaggedCount", 0)
                    high_risk_candidates = proc_docs[0].get("highRiskCount", 0)
            except Exception:
                pass

            total_infractions = total_tab_switches + total_copy_paste + total_fullscreen_exits
            clean_rate = round((clean_candidates / max(1, total_candidates)) * 100, 1) if total_candidates > 0 else 100.0

            proctoring_stats = ProctoringSummaryStats(
                totalTabSwitches=total_tab_switches,
                totalCopyPasteAttempts=total_copy_paste,
                totalFullscreenExits=total_fullscreen_exits,
                totalInfractions=total_infractions,
                cleanCandidatesCount=clean_candidates,
                flaggedCandidatesCount=flagged_candidates,
                highRiskCandidatesCount=high_risk_candidates,
                cleanRate=clean_rate,
            )

            # MCQ Question accuracy
            mcq_question_stats = []
            try:
                mcq_agg = list(coll.aggregate([
                    {"$match": {"contestId": contest.id, "status": "SUBMITTED"}},
                    {"$unwind": "$mcqBreakdown"},
                    {
                        "$group": {
                            "_id": "$mcqBreakdown.questionId",
                            "title": {"$first": "$mcqBreakdown.title"},
                            "category": {"$first": "$mcqBreakdown.category"},
                            "difficulty": {"$first": "$mcqBreakdown.difficulty"},
                            "totalAttempts": {"$sum": 1},
                            "correctCount": {
                                "$sum": {"$cond": [{"$eq": ["$mcqBreakdown.isCorrect", True]}, 1, 0]}
                            }
                        }
                    }
                ]))
                for item in mcq_agg:
                    qid = str(item["_id"])
                    tot = item.get("totalAttempts", 0)
                    corr = item.get("correctCount", 0)
                    acc = round((corr / max(1, tot)) * 100, 1) if tot > 0 else 0.0
                    mcq_question_stats.append(
                        QuestionAccuracyStat(
                            questionId=qid,
                            title=item.get("title") or f"Question {qid}",
                            category=item.get("category") or "General",
                            difficulty=item.get("difficulty") or "MEDIUM",
                            totalAttempts=tot,
                            correctCount=corr,
                            accuracyRate=acc,
                        )
                    )
            except Exception:
                pass

            # Coding problem accuracy
            coding_problem_stats = []
            try:
                coding_agg = list(coll.aggregate([
                    {"$match": {"contestId": contest.id, "status": "SUBMITTED"}},
                    {"$unwind": "$codingBreakdown"},
                    {
                        "$group": {
                            "_id": "$codingBreakdown.questionId",
                            "title": {"$first": "$codingBreakdown.title"},
                            "difficulty": {"$first": "$codingBreakdown.difficulty"},
                            "attemptedCount": {"$sum": 1},
                            "acceptedCount": {
                                "$sum": {"$cond": [{"$eq": ["$codingBreakdown.status", "ACCEPTED"]}, 1, 0]}
                            }
                        }
                    }
                ]))
                for item in coding_agg:
                    qid = str(item["_id"])
                    tot = item.get("attemptedCount", 0)
                    acc = item.get("acceptedCount", 0)
                    acc_rate = round((acc / max(1, tot)) * 100, 1) if tot > 0 else 0.0
                    coding_problem_stats.append(
                        ProblemAcceptanceStat(
                            questionId=qid,
                            title=item.get("title") or qid,
                            difficulty=item.get("difficulty") or "MEDIUM",
                            attemptedCount=tot,
                            acceptedCount=acc,
                            acceptanceRate=acc_rate,
                            languagesUsed={},
                        )
                    )
            except Exception:
                pass

        else:
            # In-memory fallback for testing without a remote database
            raw_submissions = []
            for s in self._memory_submissions.values():
                if s.get("contestId") == contest.id:
                    clean = dict(s)
                    clean["id"] = clean.get("id") or str(clean.get("_id"))
                    clean.pop("_id", None)
                    raw_submissions.append(clean)

            total_candidates = len(raw_submissions)
            completed_subs = [s for s in raw_submissions if s.get("status") == "SUBMITTED"]
            in_progress_subs = [s for s in raw_submissions if s.get("status") == "IN_PROGRESS"]

            completed_count = len(completed_subs)
            in_progress_count = len(in_progress_subs)
            completion_rate = round((completed_count / max(1, total_candidates)) * 100, 1) if total_candidates > 0 else 0.0

            scores = [s.get("totalScore", 0) for s in completed_subs]
            percentages = [s.get("percentage", 0.0) for s in completed_subs]
            times = [s.get("timeSpentSeconds", 0) for s in completed_subs if s.get("timeSpentSeconds")]

            average_score = round(sum(scores) / len(scores), 1) if scores else 0.0
            median_score = round(statistics.median(scores), 1) if scores else 0.0
            highest_score = max(scores) if scores else 0.0
            lowest_score = min(scores) if scores else 0.0
            average_percentage = round(sum(percentages) / len(percentages), 1) if percentages else 0.0
            average_time = int(sum(times) / len(times)) if times else 0

            bucket_counts = {"0-20%": 0, "21-40%": 0, "41-60%": 0, "61-80%": 0, "81-100%": 0}
            for pct in percentages:
                if pct <= 20:
                    bucket_counts["0-20%"] += 1
                elif pct <= 40:
                    bucket_counts["21-40%"] += 1
                elif pct <= 60:
                    bucket_counts["41-60%"] += 1
                elif pct <= 80:
                    bucket_counts["61-80%"] += 1
                else:
                    bucket_counts["81-100%"] += 1

            score_distribution = [
                ScoreBucket(
                    range=label,
                    count=cnt,
                    percentage=round((cnt / max(1, completed_count)) * 100, 1) if completed_count > 0 else 0.0
                )
                for label, cnt in bucket_counts.items()
            ]

            mcq_stats_map: Dict[str, Dict[str, Any]] = {}
            for sub in completed_subs:
                for item in sub.get("mcqBreakdown", []):
                    qid = item.get("questionId")
                    if not qid:
                        continue
                    if qid not in mcq_stats_map:
                        mcq_stats_map[qid] = {
                            "questionId": qid,
                            "title": item.get("title", f"Question {qid}"),
                            "category": item.get("category", "General"),
                            "difficulty": item.get("difficulty", "MEDIUM"),
                            "totalAttempts": 0,
                            "correctCount": 0,
                        }
                    mcq_stats_map[qid]["totalAttempts"] += 1
                    if item.get("isCorrect"):
                        mcq_stats_map[qid]["correctCount"] += 1

            mcq_question_stats = []
            for qid, qstat in mcq_stats_map.items():
                tot = qstat["totalAttempts"]
                corr = qstat["correctCount"]
                acc = round((corr / max(1, tot)) * 100, 1) if tot > 0 else 0.0
                mcq_question_stats.append(
                    QuestionAccuracyStat(
                        questionId=qid,
                        title=qstat["title"],
                        category=qstat["category"],
                        difficulty=qstat["difficulty"],
                        totalAttempts=tot,
                        correctCount=corr,
                        accuracyRate=acc,
                    )
                )

            coding_stats_map: Dict[str, Dict[str, Any]] = {}
            for sub in completed_subs:
                for item in sub.get("codingBreakdown", []):
                    qid = item.get("questionId")
                    if not qid:
                        continue
                    if qid not in coding_stats_map:
                        coding_stats_map[qid] = {
                            "questionId": qid,
                            "title": item.get("title", qid),
                            "difficulty": item.get("difficulty", "MEDIUM"),
                            "attemptedCount": 0,
                            "acceptedCount": 0,
                            "languagesUsed": {},
                        }
                    coding_stats_map[qid]["attemptedCount"] += 1
                    if item.get("status") == "ACCEPTED":
                        coding_stats_map[qid]["acceptedCount"] += 1

            coding_problem_stats = []
            for qid, cstat in coding_stats_map.items():
                tot = cstat["attemptedCount"]
                acc = cstat["acceptedCount"]
                acc_rate = round((acc / max(1, tot)) * 100, 1) if tot > 0 else 0.0
                coding_problem_stats.append(
                    ProblemAcceptanceStat(
                        questionId=qid,
                        title=cstat["title"],
                        difficulty=cstat["difficulty"],
                        attemptedCount=tot,
                        acceptedCount=acc,
                        acceptanceRate=acc_rate,
                        languagesUsed=cstat["languagesUsed"],
                    )
                )

            total_tab_switches = 0
            total_copy_paste = 0
            total_fullscreen_exits = 0
            clean_candidates = 0
            flagged_candidates = 0
            high_risk_candidates = 0

            for sub in raw_submissions:
                proc = sub.get("proctoring") or {}
                tabs = proc.get("tabSwitchCount", 0)
                copy_paste = proc.get("copyPasteAttempts", 0)
                fs = proc.get("fullscreenExitCount", 0)
                infr = tabs + copy_paste + fs

                total_tab_switches += tabs
                total_copy_paste += copy_paste
                total_fullscreen_exits += fs

                if infr == 0:
                    clean_candidates += 1
                else:
                    flagged_candidates += 1
                    if infr >= 3:
                        high_risk_candidates += 1

            total_infractions = total_tab_switches + total_copy_paste + total_fullscreen_exits
            clean_rate = round((clean_candidates / max(1, total_candidates)) * 100, 1) if total_candidates > 0 else 100.0

            proctoring_stats = ProctoringSummaryStats(
                totalTabSwitches=total_tab_switches,
                totalCopyPasteAttempts=total_copy_paste,
                totalFullscreenExits=total_fullscreen_exits,
                totalInfractions=total_infractions,
                cleanCandidatesCount=clean_candidates,
                flaggedCandidatesCount=flagged_candidates,
                highRiskCandidatesCount=high_risk_candidates,
                cleanRate=clean_rate,
            )

        mcq_count = contest.mcqConfig.totalQuestions if contest.hasMcq and contest.mcqConfig else len(mcq_question_stats)
        coding_count = contest.codingConfig.totalQuestions if contest.hasCoding and contest.codingConfig else len(coding_problem_stats)
        contest_summary = ContestSummary(
            id=contest.id,
            title=contest.title,
            slug=contest.slug,
            description=contest.description,
            durationMinutes=contest.durationMinutes,
            hasMcq=contest.hasMcq,
            hasCoding=contest.hasCoding,
            mcqQuestionsCount=mcq_count,
            codingQuestionsCount=coding_count,
            totalPoints=contest.totalPoints,
            status=contest.status,
            createdAt=contest.createdAt,
            updatedAt=contest.updatedAt,
        )

        return ContestAnalyticsResponse(
            contest=contest_summary,
            totalCandidates=total_candidates,
            completedCount=completed_count,
            inProgressCount=in_progress_count,
            completionRate=completion_rate,
            averageScore=average_score,
            medianScore=median_score,
            highestScore=highest_score,
            lowestScore=lowest_score,
            averagePercentage=average_percentage,
            averageTimeSpentSeconds=average_time,
            scoreDistribution=score_distribution,
            mcqStats={
                "totalQuestions": len(mcq_question_stats),
                "questions": [q.model_dump() for q in mcq_question_stats],
            },
            codingStats={
                "totalProblems": len(coding_problem_stats),
                "problems": [p.model_dump() for p in coding_problem_stats],
            },
            proctoringStats=proctoring_stats,
            submissions=lightweight_submissions,
            totalSubmissions=total_subs_count,
            page=page_num,
            limit=limit_num,
            totalPages=total_pages,
        )
