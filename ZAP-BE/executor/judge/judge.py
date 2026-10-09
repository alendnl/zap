from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from pathlib import Path
from executor.core.runner import LanguageRunner, ExecutionLimits
from executor.sandbox.sandbox import Sandbox


@dataclass
class TestCaseResult:
    id: str
    visibility: str
    passed: bool
    status: str
    execution_time_ms: int = 0
    input: Optional[str] = None
    actual_output: Optional[str] = None
    expected_output: Optional[str] = None
    error: Optional[str] = None


@dataclass
class JudgeResult:
    verdict: str
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    execution_time_ms: int = 0
    memory_used_bytes: int = 0
    compile_output: Optional[str] = None
    error_message: Optional[str] = None
    test_results: List[TestCaseResult] = field(default_factory=list)


class JudgeEngine:
    """Orchestrates compilation, test case execution, output comparison, and verdict resolution."""

    @staticmethod
    def normalize_output(text: str) -> str:
        """Normalizes line endings and trailing whitespace for fair comparison."""
        if text is None:
            return ""
        lines = [line.rstrip() for line in text.strip().splitlines()]
        return "\n".join(lines)

    def judge(
        self,
        runner: LanguageRunner,
        source_code: str,
        test_cases: List[Dict[str, Any]],
        limits: Optional[ExecutionLimits] = None,
        submission_id: str = "judge-exec",
        base_dir: Optional[Path] = None,
        fail_fast: bool = True
    ) -> JudgeResult:
        sandbox = Sandbox(submission_id, base_dir=base_dir, limits=limits)
        limits = sandbox.limits

        try:
            # 1. Source setup
            context = sandbox.setup(runner.get_source_filename(), source_code)
            runner.validate_source(source_code)

            # 2. Compilation step
            compile_res = runner.compile(context)
            if not compile_res.success:
                return JudgeResult(
                    verdict="COMPILE_ERROR",
                    compile_output=compile_res.error or compile_res.output,
                    error_message="Compilation failed."
                )

            # Filter enabled test cases
            enabled_tests = [tc for tc in test_cases if tc.get("enabled", True)]
            total = len(enabled_tests)
            passed = 0
            failed = 0
            max_exec_time = 0
            test_results: List[TestCaseResult] = []
            final_verdict = "ACCEPTED"

            # 3. Execute test cases
            for tc in enabled_tests:
                tc_id = tc.get("id", "tc-anon")
                visibility = tc.get("visibility", "PUBLIC")
                stdin_input = tc.get("input", "")
                expected_output = tc.get("expectedOutput", "")

                run_res = runner.run(context, stdin=stdin_input)
                max_exec_time = max(max_exec_time, run_res.execution_time_ms)

                # Check timeouts
                if run_res.timed_out:
                    failed += 1
                    final_verdict = "TIME_LIMIT_EXCEEDED"
                    test_results.append(TestCaseResult(
                        id=tc_id,
                        visibility=visibility,
                        passed=False,
                        status="TIME_LIMIT_EXCEEDED",
                        execution_time_ms=run_res.execution_time_ms,
                        input=stdin_input if visibility == "PUBLIC" else None,
                        expected_output=self.normalize_output(expected_output) if visibility == "PUBLIC" else None,
                        actual_output=self.normalize_output(run_res.stdout) if visibility == "PUBLIC" else None,
                        error="Execution timed out."
                    ))
                    if fail_fast:
                        break
                    continue

                # Check output limit
                if run_res.output_limit_exceeded:
                    failed += 1
                    final_verdict = "OUTPUT_LIMIT_EXCEEDED"
                    test_results.append(TestCaseResult(
                        id=tc_id,
                        visibility=visibility,
                        passed=False,
                        status="OUTPUT_LIMIT_EXCEEDED",
                        execution_time_ms=run_res.execution_time_ms,
                        input=stdin_input if visibility == "PUBLIC" else None,
                        expected_output=self.normalize_output(expected_output) if visibility == "PUBLIC" else None,
                        actual_output=self.normalize_output(run_res.stdout) if visibility == "PUBLIC" else None,
                        error="Output size limit exceeded."
                    ))
                    if fail_fast:
                        break
                    continue

                # Check runtime error
                if run_res.exit_code != 0:
                    failed += 1
                    final_verdict = "RUNTIME_ERROR"
                    test_results.append(TestCaseResult(
                        id=tc_id,
                        visibility=visibility,
                        passed=False,
                        status="RUNTIME_ERROR",
                        execution_time_ms=run_res.execution_time_ms,
                        input=stdin_input if visibility == "PUBLIC" else None,
                        expected_output=self.normalize_output(expected_output) if visibility == "PUBLIC" else None,
                        actual_output=self.normalize_output(run_res.stdout) if visibility == "PUBLIC" else None,
                        error=run_res.stderr or f"Non-zero exit code: {run_res.exit_code}"
                    ))
                    if fail_fast:
                        break
                    continue

                # Output comparison
                actual_norm = self.normalize_output(run_res.stdout)
                expected_norm = self.normalize_output(expected_output)

                is_match = (actual_norm == expected_norm)
                if is_match:
                    passed += 1
                    test_results.append(TestCaseResult(
                        id=tc_id,
                        visibility=visibility,
                        passed=True,
                        status="PASSED",
                        execution_time_ms=run_res.execution_time_ms,
                        input=stdin_input if visibility == "PUBLIC" else None,
                        actual_output=actual_norm if visibility == "PUBLIC" else None,
                        expected_output=expected_norm if visibility == "PUBLIC" else None
                    ))
                else:
                    failed += 1
                    final_verdict = "WRONG_ANSWER"
                    test_results.append(TestCaseResult(
                        id=tc_id,
                        visibility=visibility,
                        passed=False,
                        status="WRONG_ANSWER",
                        execution_time_ms=run_res.execution_time_ms,
                        input=stdin_input if visibility == "PUBLIC" else None,
                        actual_output=actual_norm if visibility == "PUBLIC" else None,
                        expected_output=expected_norm if visibility == "PUBLIC" else None
                    ))
                    if fail_fast:
                        break

            return JudgeResult(
                verdict=final_verdict if failed == 0 and total > 0 else (final_verdict if failed > 0 else "ACCEPTED"),
                total_tests=total,
                passed_tests=passed,
                failed_tests=failed,
                execution_time_ms=max_exec_time,
                test_results=test_results
            )

        finally:
            sandbox.cleanup()
