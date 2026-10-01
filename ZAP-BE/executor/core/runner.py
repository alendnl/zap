from typing import Protocol, Optional
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ExecutionLimits:
    timeout_seconds: float = 2.0
    memory_mb: int = 256
    output_limit_bytes: int = 1024 * 1024  # 1MB


@dataclass
class ExecutionContext:
    submission_id: str
    work_dir: Path
    limits: ExecutionLimits = field(default_factory=ExecutionLimits)
    source_filename: str = ""
    compiled_artifact: Optional[str] = None


@dataclass
class CompileResult:
    success: bool
    output: str = ""
    error: str = ""
    compiled_artifact: Optional[str] = None


@dataclass
class RunResult:
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    execution_time_ms: int = 0
    memory_used_bytes: int = 0
    timed_out: bool = False
    output_limit_exceeded: bool = False


class LanguageRunner(Protocol):
    language: str
    version: str

    def get_source_filename(self) -> str:
        """Returns the appropriate source file name (e.g. Solution.java or solution.py)."""
        ...

    def validate_source(self, source: str) -> None:
        """Validates source code syntax or simple rules."""
        ...

    def compile(self, context: ExecutionContext) -> CompileResult:
        """Compiles the source code if necessary."""
        ...

    def run(self, context: ExecutionContext, stdin: str) -> RunResult:
        """Executes the code/artifact against given stdin."""
        ...
