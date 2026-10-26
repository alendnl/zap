from fastapi import APIRouter, Depends, HTTPException, Query, Header, status, Request
from typing import Optional
from app.db.mongodb import get_database
from app.admin.models import (
    AdminCheckResponse,
    AdminUsersResponse,
    UserDetailActivityResponse,
)
from app.admin.service import AdminService

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def get_admin_service(request: Request, db=Depends(get_database)) -> AdminService:
    return AdminService(db)


def get_request_email(
    email: Optional[str] = Query(None, description="Admin email address"),
    x_admin_email: Optional[str] = Header(None, alias="X-Admin-Email"),
) -> str:
    admin_email = (email or x_admin_email or "").strip()
    return admin_email


@router.get("/check-access", response_model=AdminCheckResponse)
def check_admin_access(
    email: Optional[str] = Query(None, description="User email to check"),
    x_admin_email: Optional[str] = Header(None, alias="X-Admin-Email"),
    service: AdminService = Depends(get_admin_service),
):
    target_email = (email or x_admin_email or "").strip()
    is_admin = service.is_admin(target_email)
    return AdminCheckResponse(isAdmin=is_admin, email=target_email)


@router.get("/users", response_model=AdminUsersResponse)
def get_users_dashboard(
    email: Optional[str] = Query(None, description="Admin user email"),
    x_admin_email: Optional[str] = Header(None, alias="X-Admin-Email"),
    college: Optional[str] = Query(None, description="Filter by college name"),
    search: Optional[str] = Query(None, description="Search by student name, email, id, or college"),
    service: AdminService = Depends(get_admin_service),
):
    target_email = (email or x_admin_email or "").strip()
    if not target_email or not service.is_admin(target_email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Admin access required. User email is not present in admin collection.",
        )

    return service.get_users_dashboard(college=college, search=search)


@router.get("/users/{user_id}", response_model=UserDetailActivityResponse)
def get_user_detail(
    user_id: str,
    email: Optional[str] = Query(None, description="Admin user email"),
    x_admin_email: Optional[str] = Header(None, alias="X-Admin-Email"),
    service: AdminService = Depends(get_admin_service),
):
    target_email = (email or x_admin_email or "").strip()
    if not target_email or not service.is_admin(target_email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Admin access required.",
        )

    detail = service.get_user_details(user_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )

    return detail
