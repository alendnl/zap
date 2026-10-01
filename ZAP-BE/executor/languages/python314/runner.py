import sys
from pathlib import Path
from executor.core.runner import ExecutionContext, CompileResult, RunResult
from executor.sandbox.sandbox import Sandbox


class PythonRunner:
    language = "python"
    version = "3.14.2"

    def get_source_filename(self) -> str:
        return "solution.py"

    def validate_source(self, source: str) -> None:
        if not source.strip():
            raise ValueError("Source code cannot be empty.")

    def compile(self, context: ExecutionContext) -> CompileResult:
        source_file = context.work_dir / "source" / context.source_filename
        sandbox = Sandbox(context.submission_id, base_dir=context.work_dir.parent, limits=context.limits)
        res = sandbox.run_command(
            [sys.executable, "-m", "py_compile", str(source_file)],
            cwd=context.work_dir / "source",
            timeout=5.0
        )
        if res.exit_code != 0:
            return CompileResult(
                success=False,
                error=res.stderr or res.stdout,
                output=res.stdout
            )
        return CompileResult(success=True, output="Syntax validation passed")

    def run(self, context: ExecutionContext, stdin: str) -> RunResult:
        sandbox = Sandbox(context.submission_id, base_dir=context.work_dir.parent, limits=context.limits)
        source_file = context.work_dir / "source" / context.source_filename
        return sandbox.run_command(
            [sys.executable, str(source_file)],
            cwd=context.work_dir / "source",
            stdin_text=stdin,
            timeout=context.limits.timeout_seconds
        )
