import shutil
from pathlib import Path
from executor.core.runner import ExecutionContext, CompileResult, RunResult
from executor.sandbox.sandbox import Sandbox


class CRunner:
    language = "c"
    version = "17"

    def get_source_filename(self) -> str:
        return "solution.c"

    def validate_source(self, source: str) -> None:
        if not source.strip():
            raise ValueError("Source code cannot be empty.")

    def compile(self, context: ExecutionContext) -> CompileResult:
        compiler_bin = shutil.which("gcc") or shutil.which("clang")
        if not compiler_bin:
            return CompileResult(success=False, error="C compiler (gcc / clang) not installed on system.")

        source_file = context.work_dir / "source" / context.source_filename
        output_bin = context.work_dir / "build" / "solution"
        sandbox = Sandbox(context.submission_id, base_dir=context.work_dir.parent, limits=context.limits)

        res = sandbox.run_command(
            [compiler_bin, "-O2", str(source_file), "-o", str(output_bin), "-lm"],
            cwd=context.work_dir / "source",
            timeout=10.0
        )

        if res.exit_code != 0:
            return CompileResult(
                success=False,
                error=res.stderr or res.stdout,
                output=res.stdout
            )
        context.compiled_artifact = str(output_bin)
        return CompileResult(success=True, output="Compilation successful", compiled_artifact=str(output_bin))

    def run(self, context: ExecutionContext, stdin: str) -> RunResult:
        output_bin = context.work_dir / "build" / "solution"
        if not output_bin.exists():
            return RunResult(exit_code=-1, stderr="Compiled binary does not exist.")

        sandbox = Sandbox(context.submission_id, base_dir=context.work_dir.parent, limits=context.limits)
        return sandbox.run_command(
            [str(output_bin)],
            cwd=context.work_dir / "build",
            stdin_text=stdin,
            timeout=context.limits.timeout_seconds
        )
