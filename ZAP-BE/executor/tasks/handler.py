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
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from app.config import get_settings
from app.db.mongodb import get_database_for_env
from app.submissions.models import SubmissionStatus, SubmissionVerdict
from app.submissions.queue import get_queue_for_env
from app.submissions.service import SubmissionService
from executor.languages import get_runner
from executor.judge.judge import JudgeEngine
from executor.core.runner import ExecutionLimits

router = APIRouter(prefix="/internal/tasks", tags=["internal-tasks"])


def create_app():
    """Build the minimal HTTP app used by the separately deployed executor."""
    from fastapi import FastAPI

    app = FastAPI(title="ZAP Executor", docs_url=None, redoc_url=None, openapi_url=None)
    app.include_router(router)

    @app.get("/health")
    def health_check():
        return {"status": "healthy", "service": "ZAP-EXECUTOR", "environment": get_settings().ENVIRONMENT}

    return app


class TaskPayload(BaseModel):
    submissionId: str
    environment: str = "production"


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
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from google.oauth2 import id_token

        claims = id_token.verify_oauth2_token(
            token[7:],
            GoogleAuthRequest(),
            audience=settings.TASKS_OIDC_AUDIENCE,
        )
        if claims.get("email") != settings.TASKS_SERVICE_ACCOUNT or not claims.get("email_verified"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unexpected Cloud Tasks caller identity",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Cloud Tasks token: {exc}",
        )


@router.post("/execute")
def execute_task(
    request: Request,
    payload: TaskPayload,
):
    verify_cloud_tasks(request)

    submission_id = payload.submissionId
    if not submission_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing submissionId in task payload",
        )

    env = payload.environment
    db = get_database_for_env(env)
    service = SubmissionService(db, get_queue_for_env(env), env)

    submission = service.get_submission(submission_id)
    if not submission:
        # Submission no longer exists; acknowledge to stop retries.
        return {"status": "acknowledged", "reason": "submission_not_found"}

    # Atomically claim QUEUED -> RUNNING. Duplicate task delivery is acknowledged.
    running = service.claim_submission(submission_id)
    if not running:
        latest = service.get_submission(submission_id)
        if latest and latest.status in [SubmissionStatus.COMPLETED, SubmissionStatus.FAILED]:
            return {"status": "acknowledged", "reason": "already_terminal"}
        # Do not acknowledge a task whose submission is actively being processed;
        # an executor may have timed out while Cloud Tasks is retrying it.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Submission is already being processed; retry later",
        )

    try:
        result = _run_judge(submission_id, submission, env)
        _persist_result(service, submission_id, result)
        return {"status": "completed", "verdict": result.verdict}
    except Exception as exc:
        retry_count = int(request.headers.get("X-CloudTasks-TaskRetryCount", "0"))
        max_retries = 5
        if retry_count >= max_retries - 1:
            service.update_submission_status(
                submission_id=submission_id,
                status=SubmissionStatus.FAILED,
                verdict=SubmissionVerdict.SYSTEM_ERROR,
                error_message=f"Execution failed after {max_retries} attempts: {exc}",
            )
            return {"status": "failed", "reason": "retry_limit_exceeded"}

        # Make the job claimable before returning 5xx so Cloud Tasks can retry.
        service.requeue_submission(submission_id, str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Execution failed: {exc}",
        )


def _run_judge(submission_id: str, submission, environment: str = "production") -> Any:
    """Runs the JudgeEngine for a submission loaded from MongoDB."""
    from app.questions.service import QuestionService

    db = get_database_for_env(environment)
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
        status=SubmissionStatus.FAILED if result.verdict == "SYSTEM_ERROR" else SubmissionStatus.COMPLETED,
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