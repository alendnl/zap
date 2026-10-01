from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid


class DifficultyLevel(str, Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class TestCaseVisibility(str, Enum):
    PUBLIC = "PUBLIC"
    HIDDEN = "HIDDEN"


class QuestionStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Example(BaseModel):
    input: str
    output: str
    explanation: Optional[str] = None


class TestCase(BaseModel):
    id: str = Field(default_factory=lambda: f"tc-{uuid.uuid4().hex[:6]}")
    visibility: TestCaseVisibility = TestCaseVisibility.PUBLIC
    input: str
    expectedOutput: str
    enabled: bool = True


class Solution(BaseModel):
    language: str
    code: str
    visibility: str = "FACULTY_ONLY"


class ExecutionLimits(BaseModel):
    timeMs: int = 2000
    memoryMb: int = 256
    outputKb: int = 1024


class QuestionBase(BaseModel):
    slug: str
    title: str
    difficulty: DifficultyLevel = DifficultyLevel.EASY
    tags: List[str] = Field(default_factory=list)
    statement: str
    examples: List[Example] = Field(default_factory=list)
    constraints: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None
    solutions: List[Solution] = Field(default_factory=list)
    testCases: List[TestCase] = Field(default_factory=list)
    executionLimits: ExecutionLimits = Field(default_factory=ExecutionLimits)
    supportedLanguages: List[str] = Field(
        default_factory=lambda: ["python", "java", "cpp", "node"]
    )
    status: QuestionStatus = QuestionStatus.PUBLISHED


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    tags: Optional[List[str]] = None
    statement: Optional[str] = None
    examples: Optional[List[Example]] = None
    constraints: Optional[List[str]] = None
    explanation: Optional[str] = None
    solutions: Optional[List[Solution]] = None
    testCases: Optional[List[TestCase]] = None
    executionLimits: Optional[ExecutionLimits] = None
    supportedLanguages: Optional[List[str]] = None
    status: Optional[QuestionStatus] = None


class Question(QuestionBase):
    id: str = Field(default_factory=lambda: f"q-{uuid.uuid4().hex[:8]}")
    version: int = 1
    createdBy: Optional[str] = "faculty-default"
    updatedBy: Optional[str] = "faculty-default"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = ConfigDict(populate_by_name=True)
