import concurrent.futures
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from pathlib import Path
from executor.core.runner import LanguageRunner, ExecutionLimits, ExecutionContext
from executor.sandbox.sandbox import Sandbox
from executor.core.harness import prepare_executable_code, outputs_match


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

    def _execute_test_case(
        self,
        runner: LanguageRunner,
        context: ExecutionContext,
        tc: Dict[str, Any]
    ) -> TestCaseResult:
        """Executes a single test case in its own isolated run context and returns the TestCaseResult."""
        tc_id = tc.get("id", "tc-anon")
        visibility = tc.get("visibility", "PUBLIC")
        stdin_input = tc.get("input", "")
        expected_output = tc.get("expectedOutput", "")

        try:
            run_res = runner.run(context, stdin=stdin_input)
        except Exception as exc:
            return TestCaseResult(
                id=tc_id,
                visibility=visibility,
                passed=False,
                status="RUNTIME_ERROR",
                execution_time_ms=0,
                input=stdin_input if visibility == "PUBLIC" else None,
                expected_output=self.normalize_output(expected_output) if visibility == "PUBLIC" else None,
                actual_output=None,
                error=f"Execution exception: {exc}"
            )

        # Check timeouts
        if run_res.timed_out:
            return TestCaseResult(
                id=tc_id,
                visibility=visibility,
                passed=False,
                status="TIME_LIMIT_EXCEEDED",
                execution_time_ms=run_res.execution_time_ms,
                input=stdin_input if visibility == "PUBLIC" else None,
                expected_output=self.normalize_output(expected_output) if visibility == "PUBLIC" else None,
                actual_output=self.normalize_output(run_res.stdout) if visibility == "PUBLIC" else None,
                error="Execution timed out."
            )

        # Check output limit
        if run_res.output_limit_exceeded:
            return TestCaseResult(
                id=tc_id,
                visibility=visibility,
                passed=False,
                status="OUTPUT_LIMIT_EXCEEDED",
                execution_time_ms=run_res.execution_time_ms,
                input=stdin_input if visibility == "PUBLIC" else None,
                expected_output=self.normalize_output(expected_output) if visibility == "PUBLIC" else None,
                actual_output=self.normalize_output(run_res.stdout) if visibility == "PUBLIC" else None,
                error="Output size limit exceeded."
            )

        # Check runtime error
        if run_res.exit_code != 0:
            return TestCaseResult(
                id=tc_id,
                visibility=visibility,
                passed=False,
                status="RUNTIME_ERROR",
                execution_time_ms=run_res.execution_time_ms,
                input=stdin_input if visibility == "PUBLIC" else None,
                expected_output=self.normalize_output(expected_output) if visibility == "PUBLIC" else None,
                actual_output=self.normalize_output(run_res.stdout) if visibility == "PUBLIC" else None,
                error=run_res.stderr or f"Non-zero exit code: {run_res.exit_code}"
            )

        # Output comparison
        actual_norm = self.normalize_output(run_res.stdout)
        expected_norm = self.normalize_output(expected_output)

        is_match = outputs_match(actual_norm, expected_norm)
        if is_match:
            return TestCaseResult(
                id=tc_id,
                visibility=visibility,
                passed=True,
                status="PASSED",
                execution_time_ms=run_res.execution_time_ms,
                input=stdin_input if visibility == "PUBLIC" else None,
                actual_output=actual_norm if visibility == "PUBLIC" else None,
                expected_output=expected_norm if visibility == "PUBLIC" else None
            )
        else:
            return TestCaseResult(
                id=tc_id,
                visibility=visibility,
                passed=False,
                status="WRONG_ANSWER",
                execution_time_ms=run_res.execution_time_ms,
                input=stdin_input if visibility == "PUBLIC" else None,
                actual_output=actual_norm if visibility == "PUBLIC" else None,
                expected_output=expected_norm if visibility == "PUBLIC" else None
            )

    def judge(
        self,
        runner: LanguageRunner,
        source_code: str,
        test_cases: List[Dict[str, Any]],
        limits: Optional[ExecutionLimits] = None,
        submission_id: str = "judge-exec",
        base_dir: Optional[Path] = None,
        fail_fast: bool = False,
        parallel: bool = True,
        max_workers: Optional[int] = None
    ) -> JudgeResult:
        sandbox = Sandbox(submission_id, base_dir=base_dir, limits=limits)
        limits = sandbox.limits

        try:
            # 1. Source setup (applies automated driver harness for function-based submissions)
            prepared_code = prepare_executable_code(runner.language, source_code)
            context = sandbox.setup(runner.get_source_filename(), prepared_code)
            runner.validate_source(prepared_code)

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
            test_results: List[TestCaseResult] = []

            verdict_severity = {
                "ACCEPTED": 0,
                "WRONG_ANSWER": 1,
                "OUTPUT_LIMIT_EXCEEDED": 2,
                "TIME_LIMIT_EXCEEDED": 3,
                "RUNTIME_ERROR": 4,
            }

            # 3. Execute test cases (parallel by default, sequential when fail_fast=True)
            if fail_fast:
                for tc in enabled_tests:
                    res = self._execute_test_case(runner, context, tc)
                    test_results.append(res)
                    if not res.passed:
                        break
            elif len(enabled_tests) <= 1 or not parallel:
                for tc in enabled_tests:
                    test_results.append(self._execute_test_case(runner, context, tc))
            else:
                workers = max_workers or min(len(enabled_tests), 10)
                with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
                    futures = [
                        pool.submit(self._execute_test_case, runner, context, tc)
                        for tc in enabled_tests
                    ]
                    test_results = [f.result() for f in futures]

            passed = sum(1 for tr in test_results if tr.passed)
            failed = sum(1 for tr in test_results if not tr.passed)
            max_exec_time = max((tr.execution_time_ms for tr in test_results), default=0)

            if failed == 0 and total > 0:
                final_verdict = "ACCEPTED"
            elif failed > 0:
                final_verdict = max(
                    (tr.status for tr in test_results if not tr.passed),
                    key=lambda s: verdict_severity.get(s, 1),
                    default="ACCEPTED"
                )
            else:
                final_verdict = "ACCEPTED"

            return JudgeResult(
                verdict=final_verdict,
                total_tests=total,
                passed_tests=passed,
                failed_tests=failed,
                execution_time_ms=max_exec_time,
                test_results=test_results
            )

        finally:
            sandbox.cleanup()
