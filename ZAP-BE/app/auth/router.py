from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.db.mongodb import get_database
from app.auth.models import (
    StudentSignUpRequest,
    StudentLoginRequest,
    StudentProfile,
    AuthResponse,
)
from app.auth.service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def get_auth_service(db = Depends(get_database)) -> AuthService:
    return AuthService(db)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(
    payload: StudentSignUpRequest,
    service: AuthService = Depends(get_auth_service),
):
    try:
        profile, token = service.sign_up(payload)
        return AuthResponse(token=token, student=profile)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(err)
        )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: StudentLoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    try:
        profile, token = service.login(payload)
        return AuthResponse(token=token, student=profile)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(err)
        )


@router.get("/profile", response_model=StudentProfile)
def get_profile(
    student_id: str = Query(..., description="Student ID or database ID"),
    service: AuthService = Depends(get_auth_service),
):
    profile = service.get_profile(student_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student '{student_id}' not found."
        )
    return profile
