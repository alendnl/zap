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
        coll = self._get_contests_coll()
        if coll is not None:
            doc = coll.find_one({"$or": [{"_id": contest_id_or_slug}, {"id": contest_id_or_slug}, {"slug": contest_id_or_slug}]})
            if doc:
                doc["id"] = str(doc.get("id") or doc.get("_id"))
                doc.pop("_id", None)
                return Contest(**doc)
            if contest_id_or_slug in ["zap-grand-assessment-1", "contest-grand-01"]:
                return self.seed_sample_contest(force=False)
            return None

        for doc in self._memory_contests.values():
            if doc.get("id") == contest_id_or_slug or doc.get("slug") == contest_id_or_slug:
                clean = dict(doc)
                clean["id"] = str(clean.get("id") or clean.get("_id"))
                clean.pop("_id", None)
                return Contest(**clean)
        if contest_id_or_slug in ["zap-grand-assessment-1", "contest-grand-01"]:
            return self.seed_sample_contest(force=False)
        return None

    def create_contest(self, payload: ContestCreate, created_by: str = "admin") -> Contest:
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
        else:
            self._memory_contests.pop(existing.id, None)

        return True

    def start_contest_session(self, contest_id_or_slug: str, student_id: str) -> ContestStartResponse:
        """Resolves questions for this contest session, masking correct answers for security."""
        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

        resolved_mcqs = []
        if contest.hasMcq and contest.mcqConfig and contest.mcqConfig.enabled:
            resolved_mcqs = self._resolve_mcq_questions(contest.mcqConfig)

        resolved_coding = []
        if contest.hasCoding and contest.codingConfig and contest.codingConfig.enabled:
            resolved_coding = self._resolve_coding_questions(contest.codingConfig)

        now = datetime.now(timezone.utc).isoformat()
        session_id = f"sess-{uuid.uuid4().hex[:12]}"

        return ContestStartResponse(
            contest=contest,
            mcqQuestions=resolved_mcqs,
            codingQuestions=resolved_coding,
            startedAt=now,
            sessionId=session_id,
        )

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
        """Evaluates student's contest answers and produces score and breakdown."""
        contest = self.get_contest(contest_id_or_slug)
        if not contest:
            raise ValueError(f"Contest '{contest_id_or_slug}' not found")

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
        if submit_data.codingSubmissions:
            for qid, sub_id in submit_data.codingSubmissions.items():
                q = q_service.get_question(qid)
                title = q.title if q else qid
                diff = getattr(q.difficulty, "value", str(q.difficulty)) if q else "MEDIUM"
                coding_attempted += 1
                score = 10  # Full credit for attempted submission in contest
                coding_score += score
                coding_breakdown.append(
                    CodingReviewItem(
                        questionId=qid,
                        title=title,
                        difficulty=diff,
                        submissionId=sub_id,
                        status="SUBMITTED",
                        score=score,
                    )
                )

        total_score = mcq_score + coding_score
        max_total = max_mcq_score + max_coding_score
        if max_total == 0:
            max_total = contest.totalPoints or 55

        percentage = round((total_score / max(1, max_total)) * 100, 1)
        sub_id = f"csub-{uuid.uuid4().hex[:12]}"
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
        )

        # Persist submission in DB
        coll = self._get_submissions_coll()
        doc = response.model_dump()
        doc["_id"] = sub_id
        if coll is not None:
            coll.insert_one(doc)
        else:
            self._memory_submissions[sub_id] = doc

        return response
