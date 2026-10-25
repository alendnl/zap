from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.activity.models import (
    UserActivity,
    UserActivitySummary,
    ProblemActivitySummary,
    SubmissionActivityBrief,
)
from app.submissions.models import Submission, SubmissionVerdict, SubmissionMode


class ActivityService:
    def __init__(self, db):
        self.db = db
        self._memory_store: dict[str, dict] = {}

    def _get_collection(self):
        if self.db is not None and hasattr(self.db, "user_activities"):
            return self.db.user_activities
        return None

    def get_activity(self, user_id: str) -> UserActivity:
        coll = self._get_collection()
        if coll is not None:
            doc = coll.find_one({"$or": [{"userId": user_id}, {"_id": user_id}]})
            if doc:
                doc.pop("_id", None)
                return UserActivity(**doc)
        elif user_id in self._memory_store:
            clean = dict(self._memory_store[user_id])
            clean.pop("_id", None)
            return UserActivity(**clean)

        # Default empty activity document if user hasn't attempted anything yet
        return UserActivity(userId=user_id)

    def get_summary(self, user_id: str) -> UserActivitySummary:
        coll = self._get_collection()
        if coll is not None:
            doc = coll.find_one(
                {"$or": [{"userId": user_id}, {"_id": user_id}]},
                {"_id": 0, "userId": 1, "totalSolved": 1, "totalAttempted": 1, "solvedQuestionIds": 1, "attemptedQuestionIds": 1}
            )
            if doc:
                return UserActivitySummary(
                    userId=doc.get("userId", user_id),
                    totalSolved=doc.get("totalSolved", 0),
                    totalAttempted=doc.get("totalAttempted", 0),
                    solvedQuestionIds=doc.get("solvedQuestionIds", []),
                    attemptedQuestionIds=doc.get("attemptedQuestionIds", []),
                )
        elif user_id in self._memory_store:
            doc = self._memory_store[user_id]
            return UserActivitySummary(
                userId=doc.get("userId", user_id),
                totalSolved=doc.get("totalSolved", 0),
                totalAttempted=doc.get("totalAttempted", 0),
                solvedQuestionIds=doc.get("solvedQuestionIds", []),
                attemptedQuestionIds=doc.get("attemptedQuestionIds", []),
            )

        return UserActivitySummary(
            userId=user_id,
            totalSolved=0,
            totalAttempted=0,
            solvedQuestionIds=[],
            attemptedQuestionIds=[],
        )

    def record_submission(self, submission: Submission) -> UserActivity:
        user_id = submission.userId
        if not user_id:
            return UserActivity(userId="anonymous")

        now = datetime.now(timezone.utc).isoformat()
        current = self.get_activity(user_id)

        qid = submission.questionId
        verdict_str = submission.verdict.value if submission.verdict else None
        is_accepted = verdict_str == SubmissionVerdict.ACCEPTED.value or verdict_str == "ACCEPTED"
        is_submit_mode = (
            submission.mode == SubmissionMode.SUBMIT
            or getattr(submission.mode, "value", None) == "SUBMIT"
            or str(submission.mode).upper() == "SUBMIT"
        )

        prob = current.problems.get(qid)
        if prob is None:
            prob = ProblemActivitySummary(
                status="SOLVED" if is_accepted else "ATTEMPTED",
                attemptsCount=1,
                submitsCount=1 if is_submit_mode else 0,
                runsCount=0 if is_submit_mode else 1,
                bestVerdict=verdict_str,
                latestSubmissionId=submission.id,
                latestVerdict=verdict_str,
                firstAttemptedAt=now,
                lastAttemptedAt=now,
                solvedAt=now if is_accepted else None,
            )
        else:
            prob.attemptsCount += 1
            if is_submit_mode:
                prob.submitsCount += 1
            else:
                prob.runsCount += 1

            prob.latestSubmissionId = submission.id
            prob.latestVerdict = verdict_str
            prob.lastAttemptedAt = now

            if is_accepted:
                prob.status = "SOLVED"
                prob.bestVerdict = "ACCEPTED"
                if not prob.solvedAt:
                    prob.solvedAt = now
            elif prob.bestVerdict is None or prob.bestVerdict != "ACCEPTED":
                prob.bestVerdict = verdict_str

        current.problems[qid] = prob

        # Update solvedQuestionIds & attemptedQuestionIds sets
        solved_set = set(current.solvedQuestionIds)
        attempted_set = set(current.attemptedQuestionIds)

        attempted_set.add(qid)
        if is_accepted:
            solved_set.add(qid)

        current.solvedQuestionIds = sorted(list(solved_set))
        current.attemptedQuestionIds = sorted(list(attempted_set))
        current.totalSolved = len(current.solvedQuestionIds)
        current.totalAttempted = len(current.attemptedQuestionIds)
        current.updatedAt = now

        # Add to recent submissions
        brief = SubmissionActivityBrief(
            submissionId=submission.id,
            questionId=qid,
            language=submission.language,
            mode=submission.mode.value if hasattr(submission.mode, "value") else str(submission.mode),
            status=submission.status.value if hasattr(submission.status, "value") else str(submission.status),
            verdict=verdict_str,
            createdAt=submission.createdAt or now,
        )
        current.recentSubmissions.insert(0, brief)
        current.recentSubmissions = current.recentSubmissions[:20]

        # Persist
        doc = current.model_dump()
        doc["_id"] = current.userId
        coll = self._get_collection()
        if coll is not None:
            coll.replace_one({"$or": [{"userId": current.userId}, {"_id": current.userId}]}, doc, upsert=True)
        else:
            self._memory_store[current.userId] = doc

        return current
