from typing import List, Optional, Dict
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone


class AdminCheckResponse(BaseModel):
    isAdmin: bool
    email: str

    model_config = ConfigDict(populate_by_name=True)


class SolvedDifficultyBreakdown(BaseModel):
    easy: int = 0
    medium: int = 0
    hard: int = 0

    model_config = ConfigDict(populate_by_name=True)


class UserAdminStats(BaseModel):
    id: str
    name: str
    email: str
    studentId: str
    collegeName: str
    createdAt: str
    totalSolved: int = 0
    totalAttempted: int = 0
    totalSubmissions: int = 0
    accuracyRate: float = 0.0
    solvedBreakdown: SolvedDifficultyBreakdown = Field(default_factory=SolvedDifficultyBreakdown)
    lastActiveAt: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class CollegeMetric(BaseModel):
    collegeName: str
    studentCount: int
    totalSolved: int

    model_config = ConfigDict(populate_by_name=True)


class AdminUsersOverview(BaseModel):
    totalStudents: int = 0
    totalColleges: int = 0
    totalSolvedQuestions: int = 0
    totalSubmissions: int = 0
    topColleges: List[CollegeMetric] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class AdminUsersResponse(BaseModel):
    overview: AdminUsersOverview
    users: List[UserAdminStats]
    colleges: List[str]

    model_config = ConfigDict(populate_by_name=True)


class SolvedQuestionBrief(BaseModel):
    id: str
    title: str
    slug: str
    difficulty: str
    solvedAt: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class UserDetailActivityResponse(BaseModel):
    id: str
    name: str
    email: str
    studentId: str
    collegeName: str
    createdAt: str
    totalSolved: int
    totalAttempted: int
    totalSubmissions: int
    accuracyRate: float
    solvedBreakdown: SolvedDifficultyBreakdown
    solvedQuestions: List[SolvedQuestionBrief]
    recentSubmissions: List[dict]

    model_config = ConfigDict(populate_by_name=True)
