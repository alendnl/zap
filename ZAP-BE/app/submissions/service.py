from __future__ import annotations
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from app.submissions.models import (
    Submission,
    SubmissionCreateRequest,
    SubmissionMode,
    SubmissionStatus,
    SubmissionVerdict,
    SubmissionSummary,
    SubmissionTestsSummary,
)
import uuid
from app.submissions.queue import get_queue_for_env
from app.config import get_settings


class SubmissionService:
    def __init__(self, db, queue=None, environment: str = "production"):
        self.db = db
        self.environment = environment
        self.queue = queue if queue is not None else get_queue_for_env(environment)
        self._memory_store = {}

    def _get_collection(self):
        if self.db is not None and hasattr(self.db, "submissions"):
            return self.db.submissions
        return None

    def create_submission(self, req: SubmissionCreateRequest) -> Submission:
        raw_user_id = (req.userId or "").strip()
        user_id = raw_user_id or str(uuid.uuid4())
        user_email = None

        users_coll = getattr(self.db, "users", None) if self.db is not None else None
        if users_coll is not None and raw_user_id:
            user_doc = users_coll.find_one({
                "$or": [
                    {"_id": raw_user_id},
                    {"id": raw_user_id},
                    {"email": raw_user_id.lower()},
                    {"studentId": raw_user_id},
                ]
            })
            if user_doc:
                user_id = user_doc.get("id") or user_doc.get("_id")
                user_email = user_doc.get("email")

        submission = Submission(
            userId=user_id,
            userEmail=user_email,
            questionId=req.questionId,
            language=req.language,
            mode=req.mode,
            sourceCode=req.sourceCode,
            status=SubmissionStatus.QUEUED
        )

        doc = submission.model_dump()
        doc["_id"] = submission.id
        coll = self._get_collection()
        if coll is not None:
            coll.insert_one(doc)
        else:
            self._memory_store[submission.id] = doc

        # Hand off to async queue (Cloud Tasks in production, memory locally).
        # The environment is included so the executor selects the correct DB.
        try:
            self.queue.enqueue({
                "submissionId": submission.id,
                "questionId": submission.questionId,
                "language": submission.language,
                "mode": submission.mode.value,
                "createdAt": submission.createdAt,
                "environment": self.environment
            })
        except Exception as exc:
            # Do not leave a submission QUEUED forever if the database write
            # succeeded but Cloud Tasks rejected the enqueue request.
            self.update_submission_status(
                submission_id=submission.id,
                status=SubmissionStatus.FAILED,
                verdict=SubmissionVerdict.SYSTEM_ERROR,
                error_message=f"Failed to enqueue submission: {exc}",
            )
            raise

        return submission

    def get_submission(self, submission_id: str) -> Optional[Submission]:
        coll = self._get_collection()
        if coll is not None:
            doc = coll.find_one({"$or": [{"_id": submission_id}, {"id": submission_id}]})
            if doc:
                doc.pop("_id", None)
                return Submission(**doc)
            return None
        doc = self._memory_store.get(submission_id)
        if doc:
            clean = dict(doc)
            clean.pop("_id", None)
            return Submission(**clean)
        return None

    def list_submissions(
        self,
        user_id: Optional[str] = None,
        question_id: Optional[str] = None,
        mode: Optional[SubmissionMode] = None,
        limit: int = 50,
    ) -> List[SubmissionSummary]:
        coll = self._get_collection()
        query = {}
        user_match_ids = []
        if user_id:
            raw_uid = user_id.strip()
            user_match_ids.append(raw_uid)
            users_coll = getattr(self.db, "users", None) if self.db is not None else None
            if users_coll is not None:
                user_doc = users_coll.find_one({
                    "$or": [
                        {"_id": raw_uid},
                        {"id": raw_uid},
                        {"email": raw_uid.lower()},
                        {"studentId": raw_uid},
                    ]
                })
                if user_doc:
                    canonical_id = str(user_doc.get("id") or user_doc.get("_id"))
                    email = user_doc.get("email")
                    sid = user_doc.get("studentId")
                    if canonical_id and canonical_id not in user_match_ids:
                        user_match_ids.append(canonical_id)
                    if email and email not in user_match_ids:
                        user_match_ids.append(email)
                    if sid and sid not in user_match_ids:
                        user_match_ids.append(sid)

            query["$or"] = [
                {"userId": {"$in": user_match_ids}},
                {"userEmail": {"$in": [uid.lower() for uid in user_match_ids if "@" in uid]}},
            ]

        q_match_ids = []
        if question_id:
            raw_qid = question_id.strip()
            q_match_ids.append(raw_qid)
            questions_coll = getattr(self.db, "questions", None) if self.db is not None else None
            if questions_coll is not None:
                q_doc = questions_coll.find_one({
                    "$or": [
                        {"_id": raw_qid},
                        {"id": raw_qid},
                        {"slug": raw_qid},
                    ]
                })
                if q_doc:
                    canonical_qid = str(q_doc.get("id") or q_doc.get("_id"))
                    slug = q_doc.get("slug")
                    if canonical_qid and canonical_qid not in q_match_ids:
                        q_match_ids.append(canonical_qid)
                    if slug and slug not in q_match_ids:
                        q_match_ids.append(slug)

            query["questionId"] = {"$in": q_match_ids}

        if mode:
            query["mode"] = mode.value if hasattr(mode, "value") else mode

        if coll is not None:
            projection = {
                "_id": 0,
                "id": 1,
                "userId": 1,
                "userEmail": 1,
                "questionId": 1,
                "language": 1,
                "mode": 1,
                "status": 1,
                "verdict": 1,
                "executionTimeMs": 1,
                "tests": 1,
                "createdAt": 1,
            }
            cursor = coll.find(query, projection).sort("createdAt", -1).limit(limit)
            results = []
            for doc in cursor:
                results.append(SubmissionSummary(**doc))
            return results

        matching = []
        for doc in self._memory_store.values():
            if user_match_ids:
                doc_uid = doc.get("userId")
                doc_email = doc.get("userEmail")
                if doc_uid not in user_match_ids and (not doc_email or doc_email.lower() not in [u.lower() for u in user_match_ids if "@" in u]):
                    continue
            if q_match_ids:
                if doc.get("questionId") not in q_match_ids:
                    continue
            if mode:
                expected_mode = mode.value if hasattr(mode, "value") else mode
                if doc.get("mode") != expected_mode:
                    continue
            summary_dict = {
                "id": doc.get("id") or doc.get("_id"),
                "userId": doc.get("userId", "student-123"),
                "userEmail": doc.get("userEmail"),
                "questionId": doc.get("questionId", ""),
                "language": doc.get("language", ""),
                "mode": doc.get("mode", SubmissionMode.SUBMIT),
                "status": doc.get("status", SubmissionStatus.QUEUED),
                "verdict": doc.get("verdict"),
                "executionTimeMs": doc.get("executionTimeMs"),
                "tests": doc.get("tests") or SubmissionTestsSummary(),
                "createdAt": doc.get("createdAt", ""),
            }
            matching.append(SubmissionSummary(**summary_dict))

        matching.sort(key=lambda s: s.createdAt, reverse=True)
        return matching[:limit]

    def claim_submission(self, submission_id: str) -> Optional[Submission]:
        """Atomically claim a queued submission or recover an expired lease."""
        from pymongo import ReturnDocument
        from app.config import get_settings

        coll = self._get_collection()
        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()
        stale_before = (now_dt - timedelta(
            seconds=get_settings().TASKS_EXECUTION_LEASE_SECONDS
        )).isoformat()
        if coll is not None:
            doc = coll.find_one_and_update(
                {
                    "_id": submission_id,
                    "$or": [
                        {"status": SubmissionStatus.QUEUED.value},
                        {
                            "status": SubmissionStatus.RUNNING.value,
                            "startedAt": {"$lte": stale_before},
                        },
                    ],
                },
                {"$set": {
                    "status": SubmissionStatus.RUNNING.value,
                    "startedAt": now,
                }},
                return_document=ReturnDocument.AFTER,
            )
            if not doc:
                return None
            doc.pop("_id", None)
            return Submission(**doc)

        doc = self._memory_store.get(submission_id)
        if not doc:
            return None
        is_queued = doc.get("status") == SubmissionStatus.QUEUED.value
        is_expired = (
            doc.get("status") == SubmissionStatus.RUNNING.value
            and doc.get("startedAt")
            and doc["startedAt"] <= stale_before
        )
        if not (is_queued or is_expired):
            return None
        doc["status"] = SubmissionStatus.RUNNING.value
        doc["startedAt"] = now
        clean = dict(doc)
        clean.pop("_id", None)
        return Submission(**clean)

    def requeue_submission(self, submission_id: str, error_message: str) -> Optional[Submission]:
        """Make a failed transient attempt eligible for Cloud Tasks retry."""
        coll = self._get_collection()
        updates = {"status": SubmissionStatus.QUEUED.value, "errorMessage": error_message}
        if coll is not None:
            coll.update_one(
                {"_id": submission_id, "status": SubmissionStatus.RUNNING.value},
                {"$set": updates, "$unset": {"startedAt": ""}},
            )
        elif submission_id in self._memory_store:
            self._memory_store[submission_id].update(updates)
        return self.get_submission(submission_id)

    def update_submission_status(
        self,
        submission_id: str,
        status: SubmissionStatus,
        verdict: Optional[SubmissionVerdict] = None,
        execution_time_ms: Optional[int] = None,
        memory_used_bytes: Optional[int] = None,
        tests: Optional[dict] = None,
        test_results: Optional[list] = None,
        compile_output: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> Optional[Submission]:
        coll = self._get_collection()
        updates = {"status": status.value}
        if status == SubmissionStatus.RUNNING:
            updates["startedAt"] = datetime.now(timezone.utc).isoformat()
        if status in [SubmissionStatus.COMPLETED, SubmissionStatus.FAILED]:
            updates["completedAt"] = datetime.now(timezone.utc).isoformat()
        if verdict:
            updates["verdict"] = verdict.value
        if execution_time_ms is not None:
            updates["executionTimeMs"] = execution_time_ms
        if memory_used_bytes is not None:
            updates["memoryUsedBytes"] = memory_used_bytes
        if tests:
            updates["tests"] = tests
        if test_results is not None:
            updates["testResults"] = test_results
        if compile_output is not None:
            updates["compileOutput"] = compile_output
        if error_message is not None:
            updates["errorMessage"] = error_message

        if coll is not None:
            coll.update_one({"$or": [{"_id": submission_id}, {"id": submission_id}]}, {"$set": updates})
        else:
            if submission_id in self._memory_store:
                self._memory_store[submission_id].update(updates)

        sub = self.get_submission(submission_id)
        if sub and sub.status in [SubmissionStatus.COMPLETED, SubmissionStatus.FAILED]:
            try:
                from app.activity.service import ActivityService
                act_svc = ActivityService(self.db)
                act_svc.record_submission(sub)
            except Exception:
                pass

        return sub
