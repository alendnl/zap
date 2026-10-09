from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid


class SubmissionStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SubmissionVerdict(str, Enum):
    ACCEPTED = "ACCEPTED"
    WRONG_ANSWER = "WRONG_ANSWER"
    COMPILE_ERROR = "COMPILE_ERROR"
    RUNTIME_ERROR = "RUNTIME_ERROR"
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED"
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
    OUTPUT_LIMIT_EXCEEDED = "OUTPUT_LIMIT_EXCEEDED"
    SYSTEM_ERROR = "SYSTEM_ERROR"
    CANCELLED = "CANCELLED"


class SubmissionMode(str, Enum):
    RUN = "RUN"
    SUBMIT = "SUBMIT"


class SubmissionTestsSummary(BaseModel):
    total: int = 0
    passed: int = 0
    failed: int = 0


class SubmissionTestCaseResult(BaseModel):
    id: str
    visibility: str = "PUBLIC"
    passed: bool
    status: str
    executionTimeMs: int = 0
    input: Optional[str] = None
    expectedOutput: Optional[str] = None
    actualOutput: Optional[str] = None
    error: Optional[str] = None


class SubmissionCreateRequest(BaseModel):
    questionId: str
    language: str
    mode: SubmissionMode = SubmissionMode.SUBMIT
    sourceCode: str
    userId: Optional[str] = "student-123"


class SubmissionCreateResponse(BaseModel):
    submissionId: str
    status: SubmissionStatus


class Submission(BaseModel):
    id: str = Field(default_factory=lambda: f"sub-{uuid.uuid4().hex[:10]}")
    userId: str = "student-123"
    questionId: str
    questionVersion: int = 1
    language: str
    languageVersion: Optional[str] = None
    mode: SubmissionMode = SubmissionMode.SUBMIT
    sourceCode: str
    status: SubmissionStatus = SubmissionStatus.QUEUED
    verdict: Optional[SubmissionVerdict] = None
    executionTimeMs: Optional[int] = None
    memoryUsedBytes: Optional[int] = None
    tests: SubmissionTestsSummary = Field(default_factory=SubmissionTestsSummary)
    testResults: list[SubmissionTestCaseResult] = Field(default_factory=list)
    compileOutput: Optional[str] = None
    errorCode: Optional[str] = None
    errorMessage: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
