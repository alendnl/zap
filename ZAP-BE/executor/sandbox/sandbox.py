import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Optional, List, Dict
from executor.core.runner import ExecutionContext, ExecutionLimits, RunResult


class Sandbox:
    SAFE_ENV_VARS = ["PATH", "LANG", "LC_ALL", "USER", "HOME", "TERM"]

    def __init__(self, submission_id: str, base_dir: Optional[Path] = None, limits: Optional[ExecutionLimits] = None):
        self.submission_id = submission_id
        self.base_dir = base_dir or Path("/tmp/zap/submissions")
        self.work_dir = self.base_dir / submission_id
        self.limits = limits or ExecutionLimits()

        self.source_dir = self.work_dir / "source"
        self.build_dir = self.work_dir / "build"

    def setup(self, source_filename: str, source_code: str) -> ExecutionContext:
        self.source_dir.mkdir(parents=True, exist_ok=True)
        self.build_dir.mkdir(parents=True, exist_ok=True)

        source_file = self.source_dir / source_filename
        source_file.write_text(source_code, encoding="utf-8")

        return ExecutionContext(
            submission_id=self.submission_id,
            work_dir=self.work_dir,
            limits=self.limits,
            source_filename=source_filename
        )

    def get_clean_env(self) -> Dict[str, str]:
        env = {}
        for var in self.SAFE_ENV_VARS:
            if var in os.environ:
                env[var] = os.environ[var]
        env["PYTHONUNBUFFERED"] = "1"
        return env

    def run_command(
        self,
        cmd: List[str],
        cwd: Path,
        stdin_text: str = "",
        timeout: Optional[float] = None
    ) -> RunResult:
        actual_timeout = timeout if timeout is not None else self.limits.timeout_seconds
        start_time = time.perf_counter()
        clean_env = self.get_clean_env()

        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(cwd),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=clean_env,
                text=True
            )

            stdout, stderr = proc.communicate(input=stdin_text, timeout=actual_timeout)
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            output_limit_exceeded = False
            if len(stdout.encode("utf-8")) > self.limits.output_limit_bytes:
                stdout = stdout[: self.limits.output_limit_bytes] + "\n[OUTPUT TRUNCATED: Limit Exceeded]"
                output_limit_exceeded = True

            return RunResult(
                exit_code=proc.returncode,
                stdout=stdout,
                stderr=stderr,
                execution_time_ms=duration_ms,
                timed_out=False,
                output_limit_exceeded=output_limit_exceeded
            )

        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                proc.communicate(timeout=0.5)
            except Exception:
                pass
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            return RunResult(
                exit_code=-1,
                stdout="",
                stderr="Execution timed out.",
                execution_time_ms=duration_ms,
                timed_out=True
            )
        except Exception as e:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            return RunResult(
                exit_code=-1,
                stdout="",
                stderr=f"System execution error: {str(e)}",
                execution_time_ms=duration_ms
            )

    def cleanup(self):
        if self.work_dir.exists():
            shutil.rmtree(self.work_dir, ignore_errors=True)
