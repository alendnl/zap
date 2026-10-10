from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import uuid
from executor.languages import get_runner
from executor.sandbox.sandbox import Sandbox
from executor.core.runner import ExecutionLimits

router = APIRouter(prefix="/api/v1/compiler", tags=["compiler"])


class CompilerRunRequest(BaseModel):
    language: str
    sourceCode: str
    stdin: Optional[str] = ""
    timeoutMs: Optional[int] = 5000
    memoryMb: Optional[int] = 256


class CompilerRunResponse(BaseModel):
    status: str
    stdout: str
    stderr: str
    exitCode: int
    executionTimeMs: int
    timedOut: bool = False


@router.post("/run", response_model=CompilerRunResponse)
def run_compiler_code(payload: CompilerRunRequest):
    try:
        runner = get_runner(payload.language)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported language: '{payload.language}'"
        )

    limits = ExecutionLimits(
        timeout_seconds=(payload.timeoutMs or 5000) / 1000.0,
        memory_mb=payload.memoryMb or 256,
        output_limit_bytes=1024 * 1024,
    )

    sub_id = f"play-{uuid.uuid4().hex[:8]}"
    sandbox = Sandbox(sub_id, limits=limits)

    try:
        context = sandbox.setup(runner.get_source_filename(), payload.sourceCode)
        compile_res = runner.compile(context)
        if not compile_res.success:
            return CompilerRunResponse(
                status="COMPILE_ERROR",
                stdout="",
                stderr=compile_res.error or compile_res.output or "Compilation error",
                exitCode=1,
                executionTimeMs=0,
                timedOut=False,
            )

        run_res = runner.run(context, stdin=payload.stdin or "")
        is_success = run_res.exit_code == 0 and not run_res.timed_out
        res_status = "SUCCESS" if is_success else ("TIME_LIMIT_EXCEEDED" if run_res.timed_out else "RUNTIME_ERROR")

        return CompilerRunResponse(
            status=res_status,
            stdout=run_res.stdout or "",
            stderr=run_res.stderr or "",
            exitCode=run_res.exit_code,
            executionTimeMs=run_res.execution_time_ms,
            timedOut=run_res.timed_out,
        )
    finally:
        sandbox.cleanup()
