from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid


class DifficultyLevel(str, Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class MCQCategory(str, Enum):
    DSA = "DSA"
    DBMS = "DBMS"
    NETWORKS = "NETWORKS"
    OOPS = "OOPS"
    OS = "OS"
    GENERAL = "GENERAL"


class QuestionStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class ContentType(str, Enum):
    TEXT = "text"
    CODE = "code"
    IMAGE = "image"


class MCQOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: ContentType = ContentType.TEXT
    text: Optional[str] = ""
    code: Optional[str] = None
    codeLanguage: Optional[str] = "python"
    imageUrl: Optional[str] = None
    isCorrect: bool = False
    explanation: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class MCQQuestionBase(BaseModel):
    title: str
    slug: Optional[str] = None
    category: str = "DSA"
    difficulty: DifficultyLevel = DifficultyLevel.EASY
    tags: List[str] = Field(default_factory=list)
    questionType: ContentType = ContentType.TEXT
    statement: str
    codeSnippet: Optional[str] = None
    codeLanguage: Optional[str] = "python"
    imageUrl: Optional[str] = None
    options: List[MCQOption] = Field(default_factory=list)
    explanation: Optional[str] = None
    points: int = 1
    status: QuestionStatus = QuestionStatus.PUBLISHED

    model_config = ConfigDict(populate_by_name=True)


class MCQQuestionCreate(MCQQuestionBase):
    pass


class MCQQuestionUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    tags: Optional[List[str]] = None
    questionType: Optional[ContentType] = None
    statement: Optional[str] = None
    codeSnippet: Optional[str] = None
    codeLanguage: Optional[str] = None
    imageUrl: Optional[str] = None
    options: Optional[List[MCQOption]] = None
    explanation: Optional[str] = None
    points: Optional[int] = None
    status: Optional[QuestionStatus] = None

    model_config = ConfigDict(populate_by_name=True)


class MCQQuestion(MCQQuestionBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version: int = 1
    createdBy: Optional[str] = "admin"
    updatedBy: Optional[str] = "admin"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = ConfigDict(populate_by_name=True)


class MCQQuestionSummary(BaseModel):
    id: str
    slug: Optional[str] = None
    title: str
    category: str
    difficulty: DifficultyLevel = DifficultyLevel.EASY
    tags: List[str] = Field(default_factory=list)
    questionType: ContentType = ContentType.TEXT
    statement: str = ""
    codeSnippet: Optional[str] = None
    imageUrl: Optional[str] = None
    optionsCount: int = 0
    correctOptionsCount: int = 0
    points: int = 1
    status: QuestionStatus = QuestionStatus.PUBLISHED
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(populate_by_name=True)
