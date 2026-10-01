from typing import Optional, List
from datetime import datetime, timezone
from app.submissions.models import (
    Submission,
    SubmissionCreateRequest,
    SubmissionStatus,
    SubmissionVerdict,
)


class SubmissionQueue:
    """Loose-coupled queue interface to decouple submission API from judge execution."""
    def __init__(self):
        self._jobs = []

    def enqueue(self, job: dict):
        self._jobs.append(job)

    def dequeue(self) -> Optional[dict]:
        if self._jobs:
            return self._jobs.pop(0)
        return None

    def size(self) -> int:
        return len(self._jobs)


default_queue = SubmissionQueue()


class SubmissionService:
    def __init__(self, db, queue: SubmissionQueue = default_queue):
        self.db = db
        self.queue = queue
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

        # Hand off to async queue
        self.queue.enqueue({
            "submissionId": submission.id,
            "questionId": submission.questionId,
            "language": submission.language,
            "mode": submission.mode.value,
            "createdAt": submission.createdAt
        })

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

    def update_submission_status(
        self,
        submission_id: str,
        status: SubmissionStatus,
        verdict: Optional[SubmissionVerdict] = None,
        execution_time_ms: Optional[int] = None,
        memory_used_bytes: Optional[int] = None,
        tests: Optional[dict] = None,
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
