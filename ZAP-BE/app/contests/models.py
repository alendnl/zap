import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ContestStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class SelectionMode(str, Enum):
    MANUAL = "MANUAL"
    RANDOM = "RANDOM"


class MCQRandomRule(BaseModel):
    category: str = "ALL"  # "DSA", "DBMS", "NETWORKS", "OOPS", "ALL"
    difficulty: str = "ALL"  # "EASY", "MEDIUM", "HARD", "ALL"
    count: int = 5


class CodingRandomRule(BaseModel):
    difficulty: str = "ALL"  # "EASY", "MEDIUM", "HARD", "ALL"
    tag: str = "ALL"  # e.g. "array", "string", "ALL"
    count: int = 1


class MCQSectionConfig(BaseModel):
    enabled: bool = True
    mode: SelectionMode = SelectionMode.MANUAL
    questionIds: List[str] = Field(default_factory=list)
    randomRules: List[MCQRandomRule] = Field(default_factory=list)
    totalQuestions: int = 25
    pointsPerQuestion: int = 1


class CodingSectionConfig(BaseModel):
    enabled: bool = True
    mode: SelectionMode = SelectionMode.MANUAL
    questionIds: List[str] = Field(default_factory=list)
    randomRules: List[CodingRandomRule] = Field(default_factory=list)
    totalQuestions: int = 3
    pointsPerQuestion: int = 10


class ContestBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    slug: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=10)
    durationMinutes: int = Field(default=90, ge=5, le=1440)
    hasMcq: bool = True
    hasCoding: bool = True
    mcqConfig: Optional[MCQSectionConfig] = None
    codingConfig: Optional[CodingSectionConfig] = None
    status: ContestStatus = ContestStatus.PUBLISHED
    totalPoints: int = 55
    startTime: Optional[str] = None
    endTime: Optional[str] = None


class ContestCreate(ContestBase):
    pass


class ContestUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    durationMinutes: Optional[int] = None
    hasMcq: Optional[bool] = None
    hasCoding: Optional[bool] = None
    mcqConfig: Optional[MCQSectionConfig] = None
    codingConfig: Optional[CodingSectionConfig] = None
    status: Optional[ContestStatus] = None
    totalPoints: Optional[int] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None


class Contest(ContestBase):
    id: str = Field(default_factory=lambda: f"contest-{uuid.uuid4().hex[:8]}")
    createdBy: Optional[str] = "admin"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = ConfigDict(populate_by_name=True)


class ContestSummary(BaseModel):
    id: str
    title: str
    slug: str
    description: str
    durationMinutes: int
    hasMcq: bool
    hasCoding: bool
    mcqQuestionsCount: int
    codingQuestionsCount: int
    totalPoints: int
    status: ContestStatus
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(populate_by_name=True)


class ProctoringViolation(BaseModel):
    type: str  # "TAB_SWITCH", "COPY_PASTE", "FULLSCREEN_EXIT"
    timestamp: str
    details: Optional[str] = None


class ProctoringTelemetry(BaseModel):
    tabSwitchCount: int = 0
    copyPasteAttempts: int = 0
    fullscreenExitCount: int = 0
    violationsLog: List[ProctoringViolation] = Field(default_factory=list)


class CodingProblemState(BaseModel):
    code: Dict[str, str] = Field(default_factory=dict)  # language -> source code
    lastLanguage: str = "python"
    status: str = "UNATTEMPTED"  # "UNATTEMPTED", "ATTEMPTED", "SUBMITTED", "ACCEPTED"
    bestVerdict: Optional[str] = None
    lastSubmissionId: Optional[str] = None


class ContestStartResponse(BaseModel):
    contest: Contest
    mcqQuestions: List[Dict[str, Any]]
    codingQuestions: List[Dict[str, Any]]
    startedAt: str
    sessionId: str
    alreadySubmitted: bool = False
    submission: Optional[Dict[str, Any]] = None
    mcqAnswers: Dict[str, str] = Field(default_factory=dict)
    reviewedQuestionIds: List[str] = Field(default_factory=list)
    codingState: Dict[str, CodingProblemState] = Field(default_factory=dict)
    proctoring: Optional[ProctoringTelemetry] = None
    timeSpentSeconds: int = 0


class ContestSessionSyncRequest(BaseModel):
    studentId: str
    studentEmail: Optional[str] = None
    studentName: Optional[str] = None
    mcqAnswers: Optional[Dict[str, str]] = None
    reviewedQuestionIds: Optional[List[str]] = None
    codingState: Optional[Dict[str, CodingProblemState]] = None
    proctoring: Optional[ProctoringTelemetry] = None
    timeSpentSeconds: Optional[int] = None


class ContestSubmitRequest(BaseModel):
    studentId: str
    studentEmail: str
    studentName: Optional[str] = None
    mcqAnswers: Dict[str, str] = Field(default_factory=dict)  # questionId -> selectedOptionId
    codingSubmissions: Dict[str, str] = Field(default_factory=dict)  # questionId -> submissionId
    codingState: Optional[Dict[str, CodingProblemState]] = None
    proctoring: Optional[ProctoringTelemetry] = None
    timeSpentSeconds: int = 0


class MCQReviewItem(BaseModel):
    questionId: str
    title: str
    category: str
    difficulty: str
    statement: str
    selectedOptionId: Optional[str] = None
    correctOptionId: str
    isCorrect: bool
    pointsAwarded: int
    explanation: Optional[str] = None
    options: List[Dict[str, Any]]


class CodingReviewItem(BaseModel):
    questionId: str
    title: str
    difficulty: str
    submissionId: Optional[str] = None
    status: str
    score: int


class ContestSubmitResponse(BaseModel):
    submissionId: str
    contestId: str
    studentId: str
    studentEmail: str
    totalScore: int
    maxTotalScore: int
    mcqScore: int
    maxMcqScore: int
    mcqCorrectCount: int
    mcqTotalCount: int
    codingScore: int
    maxCodingScore: int
    codingProblemsAttempted: int
    codingTotalCount: int
    percentage: float
    timeSpentSeconds: int
    submittedAt: str
    mcqBreakdown: List[MCQReviewItem]
    codingBreakdown: List[CodingReviewItem]
    proctoring: Optional[ProctoringTelemetry] = None
    codingState: Optional[Dict[str, Any]] = None
