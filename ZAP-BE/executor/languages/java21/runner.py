import shutil
from pathlib import Path
from executor.core.runner import ExecutionContext, CompileResult, RunResult
from executor.sandbox.sandbox import Sandbox


class JavaRunner:
    language = "java"
    version = "21"

    def get_source_filename(self) -> str:
        return "Solution.java"

    def validate_source(self, source: str) -> None:
        if not source.strip():
            raise ValueError("Source code cannot be empty.")

    def compile(self, context: ExecutionContext) -> CompileResult:
        javac_bin = shutil.which("javac")
        if not javac_bin:
            return CompileResult(success=False, error="Java compiler (javac) not installed on system.")

        source_file = context.work_dir / "source" / context.source_filename
        build_dir = context.work_dir / "build"
        sandbox = Sandbox(context.submission_id, base_dir=context.work_dir.parent, limits=context.limits)

        res = sandbox.run_command(
            [javac_bin, "-d", str(build_dir), str(source_file)],
            cwd=context.work_dir / "source",
            timeout=10.0
        )

        if res.exit_code != 0:
            return CompileResult(
                success=False,
                error=res.stderr or res.stdout,
                output=res.stdout
            )
        context.compiled_artifact = "Solution"
        return CompileResult(success=True, output="Compilation successful", compiled_artifact="Solution")

    def run(self, context: ExecutionContext, stdin: str) -> RunResult:
        java_bin = shutil.which("java")
        if not java_bin:
            return RunResult(exit_code=-1, stderr="Java runtime (java) not installed.")

        build_dir = context.work_dir / "build"
        sandbox = Sandbox(context.submission_id, base_dir=context.work_dir.parent, limits=context.limits)
        return sandbox.run_command(
            [java_bin, "-cp", str(build_dir), "Solution"],
            cwd=build_dir,
            stdin_text=stdin,
            timeout=context.limits.timeout_seconds
        )
