from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class StudentSignUpRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    studentId: str = Field(..., min_length=1, max_length=50)
    collegeName: str = Field(..., min_length=2, max_length=150)
    email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4, max_length=100)


class StudentLoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class StudentProfile(BaseModel):
    id: str = Field(default_factory=lambda: f"std-{uuid.uuid4().hex[:8]}")
    name: str
    studentId: str
    collegeName: str
    email: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AuthResponse(BaseModel):
    token: str
    student: StudentProfile
