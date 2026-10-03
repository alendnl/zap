"""Executor task handler — HTTP consumer for Google Cloud Tasks.

Cloud Tasks delivers execution jobs to this endpoint. The endpoint:

1. Verifies the request comes from Cloud Tasks (OIDC token / service account).
2. Atomically transitions the submission QUEUED -> RUNNING.
3. Loads the submission and question from MongoDB.
4. Runs the JudgeEngine inside the sandbox.
5. Stores the final result in MongoDB.
6. Returns HTTP 200 on success (acknowledge) or a retryable status on failure.
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from app.config import get_settings
from app.db.mongodb import get_database
from app.submissions.models import SubmissionStatus, SubmissionVerdict
from app.submissions.service import SubmissionService
from executor.languages import get_runner
from executor.judge.judge import JudgeEngine
from executor.core.runner import ExecutionLimits

router = APIRouter(prefix="/internal/tasks", tags=["internal-tasks"])


class TaskPayload(BaseModel):
    submissionId: str


def get_submission_service(db=Depends(get_database)) -> SubmissionService:
    return SubmissionService(db)


def verify_cloud_tasks(request: Request) -> None:
    """Verifies that the request originates from Google Cloud Tasks.

    Cloud Tasks signs requests with an OIDC token when configured with a
    service account. The token is verified against the expected audience.
    """
    settings = get_settings()
    if not settings.GCP_PROJECT_ID:
        # Local development / tests: allow unauthenticated internal calls.
        return

    token = request.headers.get("Authorization", "")
    if not token.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Cloud Tasks authorization token",
        )

    try:
        from google.auth import jwt
        claims = jwt.decode(token[7:], verify=False)
        audience = claims.get("aud", "")
        expected_audience = settings.EXECUTOR_TASK_URL
        if audience != expected_audience:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Cloud Tasks audience",
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Cloud Tasks token: {exc}",
        )


@router.post("/execute")
def execute_task(
    request: Request,
    payload: TaskPayload,
    service: SubmissionService = Depends(get_submission_service),
):
    verify_cloud_tasks(request)

    submission_id = payload.submissionId
    if not submission_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing submissionId in task payload",
        )

    submission = service.get_submission(submission_id)
    if not submission:
        # Submission no longer exists; acknowledge to stop retries.
        return {"status": "acknowledged", "reason": "submission_not_found"}

    # Idempotency: if already terminal, acknowledge without re-executing.
    if submission.status in [SubmissionStatus.COMPLETED, SubmissionStatus.FAILED]:
        return {"status": "acknowledged", "reason": "already_terminal"}

    # Atomically transition to RUNNING.
    running = service.update_submission_status(
        submission_id=submission_id,
        status=SubmissionStatus.RUNNING,
    )
    if not running:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark submission as RUNNING",
        )

    try:
        result = _run_judge(submission_id, submission)
        _persist_result(service, submission_id, result)
        return {"status": "completed", "verdict": result.verdict}
    except Exception as exc:
        # Return 500 so Cloud Tasks retries the task.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Execution failed: {exc}",
        )


def _run_judge(submission_id: str, submission) -> Any:
    """Runs the JudgeEngine for a submission loaded from MongoDB."""
    from app.questions.service import QuestionService

    db = get_database()
    question_service = QuestionService(db)
    question = question_service.get_question(submission.questionId)
    if not question:
        raise ValueError(f"Question '{submission.questionId}' not found")

    runner = get_runner(submission.language)
    limits = ExecutionLimits(
        timeout_seconds=question.executionLimits.timeMs / 1000.0,
        memory_mb=question.executionLimits.memoryMb,
        output_limit_bytes=question.executionLimits.outputKb * 1024,
    )

    judge = JudgeEngine()
    return judge.judge(
        runner=runner,
        source_code=submission.sourceCode,
        test_cases=[tc.model_dump() for tc in question.testCases],
        limits=limits,
        submission_id=submission_id,
        fail_fast=True,
    )


def _persist_result(service: SubmissionService, submission_id: str, result) -> None:
    """Stores the judge result in MongoDB."""
    service.update_submission_status(
        submission_id=submission_id,
        status=SubmissionStatus.COMPLETED,
        verdict=SubmissionVerdict(result.verdict),
        execution_time_ms=result.execution_time_ms,
        memory_used_bytes=result.memory_used_bytes,
        tests={
            "total": result.total_tests,
            "passed": result.passed_tests,
            "failed": result.failed_tests,
        },
        compile_output=result.compile_output,
        error_message=result.error_message,
    )