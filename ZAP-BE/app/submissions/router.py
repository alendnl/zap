from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from app.db.mongodb import get_database, get_request_environment
from app.submissions.models import (
    Submission,
    SubmissionCreateRequest,
    SubmissionCreateResponse,
    SubmissionMode,
    SubmissionStatus,
    SubmissionVerdict,
    SubmissionSummary,
)
from app.submissions.queue import get_queue_for_env
from app.submissions.service import SubmissionService
from app.submissions.rate_limiter import get_submission_rate_limiter, SubmissionRateLimiter

router = APIRouter(prefix="/api/v1/submissions", tags=["submissions"])

def get_submission_service(request: Request, db = Depends(get_database)) -> SubmissionService:
    env = get_request_environment(request)
    return SubmissionService(db, get_queue_for_env(env), env)

@router.post("", response_model=SubmissionCreateResponse, status_code=status.HTTP_202_ACCEPTED)
@router.post("/", response_model=SubmissionCreateResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_code(
    payload: SubmissionCreateRequest,
    request: Request,
    service: SubmissionService = Depends(get_submission_service),
    rate_limiter: SubmissionRateLimiter = Depends(get_submission_rate_limiter),
):
    user_key = (payload.userId or "").strip() or (request.client.host if request.client else "anonymous")
    rate_limiter.check_rate_limit(user_key)

    submission = service.create_submission(payload)
    return SubmissionCreateResponse(
        submissionId=submission.id,
        status=submission.status
    )

@router.get("", response_model=List[SubmissionSummary])
@router.get("/", response_model=List[SubmissionSummary])
def list_submissions(
    response: Response,
    userId: Optional[str] = None,
    questionId: Optional[str] = None,
    mode: Optional[SubmissionMode] = None,
    limit: int = 50,
    service: SubmissionService = Depends(get_submission_service)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return service.list_submissions(
        user_id=userId,
        question_id=questionId,
        mode=mode,
        limit=limit
    )

@router.get("/{submission_id}", response_model=Submission)
def get_submission_status(
    submission_id: str,
    response: Response,
    service: SubmissionService = Depends(get_submission_service)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    submission = service.get_submission(submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission '{submission_id}' not found"
        )
    return submission

@router.post("/{submission_id}/cancel", response_model=Submission)
def cancel_submission(
    submission_id: str,
    service: SubmissionService = Depends(get_submission_service)
):
    submission = service.get_submission(submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission '{submission_id}' not found"
        )
    if submission.status in [SubmissionStatus.COMPLETED, SubmissionStatus.FAILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel an already finished submission"
        )
    cancelled = service.update_submission_status(
        submission_id=submission_id,
        status=SubmissionStatus.COMPLETED,
        verdict=SubmissionVerdict.CANCELLED
    )
    return cancelled
