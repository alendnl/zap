import shutil
from pathlib import Path
from executor.core.runner import ExecutionContext, CompileResult, RunResult
from executor.sandbox.sandbox import Sandbox


class NodeRunner:
    language = "node"
    version = "22.8.0"

    def get_source_filename(self) -> str:
        return "solution.js"

    def validate_source(self, source: str) -> None:
        if not source.strip():
            raise ValueError("Source code cannot be empty.")

    def compile(self, context: ExecutionContext) -> CompileResult:
        node_bin = shutil.which("node") or "node"
        source_file = context.work_dir / "source" / context.source_filename
        sandbox = Sandbox(context.submission_id, base_dir=context.work_dir.parent, limits=context.limits)
        res = sandbox.run_command(
            [node_bin, "--check", str(source_file)],
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
        node_bin = shutil.which("node") or "node"
        source_file = context.work_dir / "source" / context.source_filename
        sandbox = Sandbox(context.submission_id, base_dir=context.work_dir.parent, limits=context.limits)
        return sandbox.run_command(
            [node_bin, str(source_file)],
            cwd=context.work_dir / "source",
            stdin_text=stdin,
            timeout=context.limits.timeout_seconds
        )
