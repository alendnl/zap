from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.db.mongodb import get_database, get_request_environment
from app.submissions.models import (
    Submission,
    SubmissionCreateRequest,
    SubmissionCreateResponse,
    SubmissionStatus,
    SubmissionVerdict,
)
from app.submissions.queue import get_queue_for_env
from app.submissions.service import SubmissionService

router = APIRouter(prefix="/api/v1/submissions", tags=["submissions"])

def get_submission_service(request: Request, db = Depends(get_database)) -> SubmissionService:
    env = get_request_environment(request)
    return SubmissionService(db, get_queue_for_env(env), env)

@router.post("", response_model=SubmissionCreateResponse, status_code=status.HTTP_202_ACCEPTED)
@router.post("/", response_model=SubmissionCreateResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_code(
    payload: SubmissionCreateRequest,
    service: SubmissionService = Depends(get_submission_service)
):
    submission = service.create_submission(payload)
    return SubmissionCreateResponse(
        submissionId=submission.id,
        status=submission.status
    )

@router.get("/{submission_id}", response_model=Submission)
def get_submission_status(
    submission_id: str,
    service: SubmissionService = Depends(get_submission_service)
):
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
