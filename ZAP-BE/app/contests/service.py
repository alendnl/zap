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
)
from app.mcq.service import MCQService
from app.questions.service import QuestionService


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-")


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

    def sync_contest_session(
        self,
        contest_id_or_slug: str,
        sync_data: ContestSessionSyncRequest
    ) -> Dict[str, Any]:
        """Saves live in-progress contest state, answers, code, and proctoring telemetry in real-time."""
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

        updates: Dict[str, Any] = {"updatedAt": now}
        if sync_data.mcqAnswers is not None:
            updates["mcqAnswers"] = sync_data.mcqAnswers
        if sync_data.reviewedQuestionIds is not None:
            updates["reviewedQuestionIds"] = sync_data.reviewedQuestionIds
        if sync_data.codingState is not None:
            serialized_coding = {}
            for qid, state in sync_data.codingState.items():
                if hasattr(state, "model_dump"):
                    serialized_coding[qid] = state.model_dump()
                elif isinstance(state, dict):
                    serialized_coding[qid] = state
            updates["codingState"] = serialized_coding
        if sync_data.proctoring is not None:
            updates["proctoring"] = (
                sync_data.proctoring.model_dump()
                if hasattr(sync_data.proctoring, "model_dump")
                else sync_data.proctoring
            )
        if sync_data.timeSpentSeconds is not None:
            updates["timeSpentSeconds"] = sync_data.timeSpentSeconds

        if coll is not None:
            # Only update if still IN_PROGRESS (cannot overwrite once SUBMITTED!)
            res = coll.update_one(
                {**query, "status": "IN_PROGRESS"},
                {"$set": updates}
            )
            if res.matched_count == 0:
                doc = coll.find_one(query)
                if doc and doc.get("status") == "SUBMITTED":
                    return {"ok": False, "status": "ALREADY_SUBMITTED"}
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
                    **updates
                }
                coll.insert_one(new_doc)
        else:
            found = False
            for s_id, s in self._memory_submissions.items():
                if s.get("contestId") == contest.id and (
                    s.get("studentId") == sync_data.studentId or
                    (sync_data.studentEmail and s.get("studentEmail", "").lower() == sync_data.studentEmail.lower().strip())
                ):
                    if s.get("status") == "SUBMITTED":
                        return {"ok": False, "status": "ALREADY_SUBMITTED"}
                    s.update(updates)
                    found = True
                    break
            if not found:
                new_id = f"csub-{uuid.uuid4().hex[:12]}"
                self._memory_submissions[new_id] = {
                    "_id": new_id,
                    "id": new_id,
                    "contestId": contest.id,
                    "studentId": sync_data.studentId,
                    "studentEmail": (sync_data.studentEmail or "").strip().lower(),
                    "studentName": sync_data.studentName or "",
                    "status": "IN_PROGRESS",
                    "startedAt": now,
                    **updates
                }

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

        mcq_service = MCQService(self.db)
        mcq_breakdown: List[MCQReviewItem] = []
        mcq_score = 0
        mcq_correct_count = 0
        max_mcq_score = 0

        # Evaluate MCQs against true database records
        for qid, selected_opt in submit_data.mcqAnswers.items():
            q = mcq_service.get_question(qid)
            if not q:
                continue

            max_mcq_score += q.points
            correct_opt = next((opt for opt in q.options if opt.isCorrect), None)
            correct_opt_id = correct_opt.id if correct_opt else ""
            is_correct = (selected_opt == correct_opt_id)

            pts = q.points if is_correct else 0
            if is_correct:
                mcq_score += pts
                mcq_correct_count += 1

            mcq_breakdown.append(
                MCQReviewItem(
                    questionId=q.id,
                    title=q.title,
                    category=q.category,
                    difficulty=getattr(q.difficulty, "value", str(q.difficulty)),
                    statement=q.statement,
                    selectedOptionId=selected_opt,
                    correctOptionId=correct_opt_id,
                    isCorrect=is_correct,
                    pointsAwarded=pts,
                    explanation=q.explanation,
                    options=[opt.model_dump() for opt in q.options],
                )
            )

        # Evaluate Coding Submissions
        coding_breakdown: List[CodingReviewItem] = []
        coding_score = 0
        coding_attempted = 0
        max_coding_score = (contest.codingConfig.totalQuestions * 10) if contest.hasCoding and contest.codingConfig else 30

        q_service = QuestionService(self.db)
        coding_items_map = dict(submit_data.codingSubmissions or {})
        if submit_data.codingState:
            for qid, c_state in submit_data.codingState.items():
                if qid not in coding_items_map:
                    coding_items_map[qid] = getattr(c_state, "lastSubmissionId", None) or ""

        if coding_items_map:
            for qid, sub_id in coding_items_map.items():
                q = q_service.get_question(qid)
                title = q.title if q else qid
                diff = getattr(q.difficulty, "value", str(q.difficulty)) if q else "MEDIUM"

                verdict = None
                if submit_data.codingState and qid in submit_data.codingState:
                    c_state = submit_data.codingState[qid]
                    verdict = getattr(c_state, "bestVerdict", None) or getattr(c_state, "status", None)

                coding_attempted += 1
                score = 10
                coding_score += score
                coding_breakdown.append(
                    CodingReviewItem(
                        questionId=qid,
                        title=title,
                        difficulty=diff,
                        submissionId=sub_id if sub_id else None,
                        status="ACCEPTED" if verdict == "ACCEPTED" else "SUBMITTED",
                        score=score,
                    )
                )

        total_score = mcq_score + coding_score
        max_total = max_mcq_score + max_coding_score
        if max_total == 0:
            max_total = contest.totalPoints or 55

        percentage = round((total_score / max(1, max_total)) * 100, 1)
        sub_id = (existing_doc.get("id") or str(existing_doc.get("_id"))) if existing_doc else f"csub-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        response = ContestSubmitResponse(
            submissionId=sub_id,
            contestId=contest.id,
            studentId=submit_data.studentId,
            studentEmail=submit_data.studentEmail,
            totalScore=total_score,
            maxTotalScore=max_total,
            mcqScore=mcq_score,
            maxMcqScore=max_mcq_score,
            mcqCorrectCount=mcq_correct_count,
            mcqTotalCount=len(submit_data.mcqAnswers),
            codingScore=coding_score,
            maxCodingScore=max_coding_score,
            codingProblemsAttempted=coding_attempted,
            codingTotalCount=contest.codingConfig.totalQuestions if contest.codingConfig else 3,
            percentage=percentage,
            timeSpentSeconds=submit_data.timeSpentSeconds,
            submittedAt=now,
            mcqBreakdown=mcq_breakdown,
            codingBreakdown=coding_breakdown,
            proctoring=submit_data.proctoring,
            codingState={k: (v.model_dump() if hasattr(v, "model_dump") else v) for k, v in (submit_data.codingState or {}).items()},
        )

        # Persist submission in DB as SUBMITTED (locked)
        doc = response.model_dump()
        doc["_id"] = sub_id
        doc["status"] = "SUBMITTED"
        doc["updatedAt"] = now

        if coll is not None:
            coll.update_one(
                {"_id": sub_id},
                {"$set": doc},
                upsert=True
            )
        else:
            self._memory_submissions[sub_id] = doc

        return response

    def get_contest_analytics(self, contest_id_or_slug: str) -> ContestAnalyticsResponse:
        """Calculates comprehensive analytics for a contest: overall KPIs, score distribution,
        per-question accuracy, coding problem acceptance rates, proctoring violations,
        and student-by-student drilldown.
        """
        import statistics

        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        coll = self._get_submissions_coll()
        raw_submissions = []
        if coll is not None:
            cursor = coll.find({"contestId": contest.id})
            for doc in cursor:
                clean = dict(doc)
                clean["id"] = clean.get("id") or str(clean.get("_id"))
                clean.pop("_id", None)
                raw_submissions.append(clean)
        else:
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
        highest_score = max(scores) if scores else 0
        lowest_score = min(scores) if scores else 0
        average_percentage = round(sum(percentages) / len(percentages), 1) if percentages else 0.0
        average_time = int(sum(times) / len(times)) if times else 0

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
                percentage=round((cnt / max(1, completed_count)) * 100, 1)
            )
            for label, cnt in bucket_counts.items()
        ]

        # MCQ Question-Level Accuracy Analysis
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

        # Coding Problem-Level Acceptance Analysis
        coding_stats_map: Dict[str, Dict[str, Any]] = {}
        for sub in completed_subs:
            c_state_map = sub.get("codingState", {})
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

                prob_state = c_state_map.get(qid, {})
                lang = prob_state.get("lastLanguage")
                if lang:
                    coding_stats_map[qid]["languagesUsed"][lang] = (
                        coding_stats_map[qid]["languagesUsed"].get(lang, 0) + 1
                    )

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

        # Proctoring & Integrity Telemetry Summary
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

        # Sort candidate submissions by totalScore desc, then timeSpentSeconds asc
        sorted_submissions = sorted(
            raw_submissions,
            key=lambda s: (-s.get("totalScore", 0), s.get("timeSpentSeconds", 999999))
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
            submissions=sorted_submissions,
        )
