from __future__ import annotations
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from app.submissions.models import (
    Submission,
    SubmissionCreateRequest,
    SubmissionMode,
    SubmissionStatus,
    SubmissionVerdict,
)
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
        submission = Submission(
            userId=req.userId or "student-123",
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
    ) -> List[Submission]:
        coll = self._get_collection()
        query = {}
        if user_id:
            query["userId"] = user_id
        if question_id:
            query["questionId"] = question_id
        if mode:
            query["mode"] = mode.value if hasattr(mode, "value") else mode

        if coll is not None:
            cursor = coll.find(query).sort("createdAt", -1).limit(limit)
            results = []
            for doc in cursor:
                doc.pop("_id", None)
                results.append(Submission(**doc))
            return results

        matching = []
        for doc in self._memory_store.values():
            if user_id and doc.get("userId") != user_id:
                continue
            if question_id and doc.get("questionId") != question_id:
                continue
            if mode:
                expected_mode = mode.value if hasattr(mode, "value") else mode
                if doc.get("mode") != expected_mode:
                    continue
            clean = dict(doc)
            clean.pop("_id", None)
            matching.append(Submission(**clean))

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

        return self.get_submission(submission_id)
