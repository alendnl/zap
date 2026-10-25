from typing import Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid


class ProblemActivitySummary(BaseModel):
    status: str = "ATTEMPTED"  # "ATTEMPTED" | "SOLVED"
    attemptsCount: int = 1
    submitsCount: int = 0
    runsCount: int = 0
    bestVerdict: Optional[str] = None
    latestSubmissionId: Optional[str] = None
    latestVerdict: Optional[str] = None
    firstAttemptedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    lastAttemptedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    solvedAt: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class SubmissionActivityBrief(BaseModel):
    submissionId: str
    questionId: str
    language: str
    mode: str
    status: str
    verdict: Optional[str] = None
    createdAt: str

    model_config = ConfigDict(populate_by_name=True)


class UserActivity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    totalSolved: int = 0
    totalAttempted: int = 0
    solvedQuestionIds: List[str] = Field(default_factory=list)
    attemptedQuestionIds: List[str] = Field(default_factory=list)
    problems: Dict[str, ProblemActivitySummary] = Field(default_factory=dict)
    recentSubmissions: List[SubmissionActivityBrief] = Field(default_factory=list)
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = ConfigDict(populate_by_name=True)


class UserActivitySummary(BaseModel):
    userId: str
    totalSolved: int = 0
    totalAttempted: int = 0
    solvedQuestionIds: List[str] = Field(default_factory=list)
    attemptedQuestionIds: List[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)
