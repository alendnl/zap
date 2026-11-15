from typing import List, Optional, Union, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from app.db.mongodb import get_database
from app.contests.models import (
    Contest,
    ContestCreate,
    ContestUpdate,
    ContestSummary,
    ContestStartResponse,
    ContestSubmitRequest,
    ContestSubmitResponse,
    ContestSessionSyncRequest,
)
from app.contests.service import ContestService
from app.admin.service import AdminService

router = APIRouter(prefix="", tags=["contests"])


def get_contest_service(db=Depends(get_database)) -> ContestService:
    return ContestService(db)


def verify_admin_access(
    x_admin_email: Optional[str] = Header(None, alias="X-Admin-Email"),
    db=Depends(get_database)
):
    if not x_admin_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin credentials missing. Please sign in as an authorized admin."
        )
    admin_service = AdminService(db)
    if not admin_service.is_admin(x_admin_email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: '{x_admin_email}' does not possess admin privileges."
        )
    return x_admin_email


@router.get("/contests", response_model=Union[List[ContestSummary], List[Contest]])
@router.get("/api/v1/contests", response_model=Union[List[ContestSummary], List[Contest]])
def list_contests(
    status: Optional[str] = Query(None, description="Filter by status (PUBLISHED, DRAFT, ARCHIVED)"),
    summary: bool = Query(True, description="Return lightweight summaries"),
    service: ContestService = Depends(get_contest_service)
):
    return service.list_contests(status=status, summary=summary)


@router.post("/contests/seed-sample", response_model=Contest)
@router.post("/api/v1/contests/seed-sample", response_model=Contest)
def seed_sample_contest(
    force: bool = Query(False, description="Force re-seed sample contest"),
    service: ContestService = Depends(get_contest_service)
):
    contest = service.seed_sample_contest(force=force)
    if not contest:
        raise HTTPException(status_code=500, detail="Failed to seed sample contest")
    return contest


@router.get("/contests/{contest_id_or_slug}", response_model=Contest)
@router.get("/api/v1/contests/{contest_id_or_slug}", response_model=Contest)
def get_contest(
    contest_id_or_slug: str,
    service: ContestService = Depends(get_contest_service)
):
    contest = service.get_contest(contest_id_or_slug)
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contest '{contest_id_or_slug}' not found"
        )
    return contest


@router.post("/contests", response_model=Contest, status_code=status.HTTP_201_CREATED)
@router.post("/api/v1/contests", response_model=Contest, status_code=status.HTTP_201_CREATED)
def create_contest(
    payload: ContestCreate,
    service: ContestService = Depends(get_contest_service),
    admin_email: str = Depends(verify_admin_access)
):
    return service.create_contest(payload, created_by=admin_email)


@router.put("/contests/{contest_id}", response_model=Contest)
@router.put("/api/v1/contests/{contest_id}", response_model=Contest)
def update_contest(
    contest_id: str,
    payload: ContestUpdate,
    service: ContestService = Depends(get_contest_service),
    admin_email: str = Depends(verify_admin_access)
):
    updated = service.update_contest(contest_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contest '{contest_id}' not found"
        )
    return updated


@router.delete("/contests/{contest_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/api/v1/contests/{contest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contest(
    contest_id: str,
    service: ContestService = Depends(get_contest_service),
    admin_email: str = Depends(verify_admin_access)
):
    success = service.delete_contest(contest_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contest '{contest_id}' not found"
        )
    return None


@router.post("/contests/{contest_id_or_slug}/start", response_model=ContestStartResponse)
@router.post("/api/v1/contests/{contest_id_or_slug}/start", response_model=ContestStartResponse)
def start_contest(
    contest_id_or_slug: str,
    student_id: str = Query("student-anonymous"),
    student_email: Optional[str] = Query(None),
    student_name: Optional[str] = Query(None),
    service: ContestService = Depends(get_contest_service)
):
    try:
        return service.start_contest_session(
            contest_id_or_slug,
            student_id=student_id,
            student_email=student_email,
            student_name=student_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/contests/{contest_id_or_slug}/sync")
@router.post("/api/v1/contests/{contest_id_or_slug}/sync")
def sync_contest(
    contest_id_or_slug: str,
    payload: ContestSessionSyncRequest,
    service: ContestService = Depends(get_contest_service)
):
    try:
        return service.sync_contest_session(contest_id_or_slug, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/contests/{contest_id_or_slug}/submit", response_model=ContestSubmitResponse)
@router.post("/api/v1/contests/{contest_id_or_slug}/submit", response_model=ContestSubmitResponse)
def submit_contest(
    contest_id_or_slug: str,
    payload: ContestSubmitRequest,
    service: ContestService = Depends(get_contest_service)
):
    try:
        return service.submit_contest(contest_id_or_slug, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
