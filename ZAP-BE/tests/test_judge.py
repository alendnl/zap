from executor.languages import get_runner
from executor.judge.judge import JudgeEngine
from executor.worker.queue import MemoryExecutionQueue, ExecutionJob
from executor.worker.worker import ExecutionWorker


def test_judge_accepted():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
import sys
data = sys.stdin.read().split()
if data:
    a = int(data[0])
    b = int(data[1])
    print(a + b)
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "2 3", "expectedOutput": "5", "enabled": True},
        {"id": "tc2", "visibility": "HIDDEN", "input": "10 20", "expectedOutput": "30", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases, submission_id="judge-test-acc")
    assert result.verdict == "ACCEPTED"
    assert result.total_tests == 2
    assert result.passed_tests == 2
    assert result.failed_tests == 0


def test_judge_wrong_answer_fail_fast():
    runner = get_runner("python")
    judge = JudgeEngine()

    # Always prints 5
    code = "print(5)"
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "2 3", "expectedOutput": "5", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "10 20", "expectedOutput": "30", "enabled": True},
        {"id": "tc3", "visibility": "HIDDEN", "input": "1 1", "expectedOutput": "2", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases, submission_id="judge-test-wa", fail_fast=True)
    assert result.verdict == "WRONG_ANSWER"
    assert result.passed_tests == 1
    assert result.failed_tests == 1
    # Stopped early due to fail-fast
    assert len(result.test_results) == 2


def test_judge_compile_error():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = "def faulty_syntax(: pass"
    test_cases = [{"id": "tc1", "visibility": "PUBLIC", "input": "", "expectedOutput": "", "enabled": True}]

    result = judge.judge(runner, code, test_cases, submission_id="judge-test-ce")
    assert result.verdict == "COMPILE_ERROR"
    assert result.compile_output is not None


def test_judge_runs_all_test_cases_without_fail_fast():
    runner = get_runner("python")
    judge = JudgeEngine()

    # Always prints 5
    code = "print(5)"
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "2 3", "expectedOutput": "5", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "10 20", "expectedOutput": "30", "enabled": True},
        {"id": "tc3", "visibility": "PUBLIC", "input": "2 3", "expectedOutput": "5", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases, submission_id="judge-test-all", fail_fast=False)
    assert result.verdict == "WRONG_ANSWER"
    assert result.passed_tests == 2
    assert result.failed_tests == 1
    # All 3 test cases were evaluated
    assert len(result.test_results) == 3
    assert result.test_results[0].passed is True
    assert result.test_results[1].passed is False
    assert result.test_results[2].passed is True



def test_judge_parallel_test_cases_order_and_severity():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
import sys, time
val = sys.stdin.read().strip()
if val == "sleep":
    time.sleep(0.1)
    print("slept")
elif val == "error":
    raise RuntimeError("Intentional error")
elif val == "wrong":
    print("wrong_output")
else:
    print(f"ok_{val}")
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "sleep", "expectedOutput": "slept", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "1", "expectedOutput": "ok_1", "enabled": True},
        {"id": "tc3", "visibility": "PUBLIC", "input": "wrong", "expectedOutput": "expected_wrong", "enabled": True},
        {"id": "tc4", "visibility": "HIDDEN", "input": "2", "expectedOutput": "ok_2", "enabled": True},
        {"id": "tc5", "visibility": "HIDDEN", "input": "error", "expectedOutput": "ignored", "enabled": True},
        {"id": "tc6", "visibility": "PUBLIC", "input": "3", "expectedOutput": "ok_3", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases, submission_id="judge-test-parallel", fail_fast=False, parallel=True)

    # Total and counts
    assert result.total_tests == 6
    assert result.passed_tests == 4  # tc1, tc2, tc4, tc6
    assert result.failed_tests == 2  # tc3 (WRONG_ANSWER), tc5 (RUNTIME_ERROR)

    # Severity hierarchy: RUNTIME_ERROR > WRONG_ANSWER
    assert result.verdict == "RUNTIME_ERROR"

    # Order must be strictly preserved
    assert len(result.test_results) == 6
    assert [tr.id for tr in result.test_results] == ["tc1", "tc2", "tc3", "tc4", "tc5", "tc6"]
    assert result.test_results[0].passed is True
    assert result.test_results[1].passed is True
    assert result.test_results[2].passed is False
    assert result.test_results[2].status == "WRONG_ANSWER"
    assert result.test_results[3].passed is True
    assert result.test_results[4].passed is False
    assert result.test_results[4].status == "RUNTIME_ERROR"
    assert result.test_results[5].passed is True

    # Hidden masking check
    assert result.test_results[3].input is None
    assert result.test_results[3].actual_output is None
    assert result.test_results[4].input is None


def test_execution_worker():
    queue = MemoryExecutionQueue()
    history = []

    def status_callback(sub_id: str, status: str, res):
        history.append((sub_id, status, res.verdict if res else None))

    worker = ExecutionWorker(queue, status_update_cb=status_callback)

    job = ExecutionJob(
        job_id="job-101",
        submission_id="sub-101",
        question_id="sum-problem",
        language="python",
        source_code="import sys\nprint(sum(map(int, sys.stdin.read().split())))",
        test_cases=[{"id": "tc1", "input": "4 6", "expectedOutput": "10"}]
    )
    queue.enqueue(job)
    assert queue.size() == 1

    worker.process_one_job()
    assert queue.size() == 0
    assert len(history) == 2
    assert history[0] == ("sub-101", "RUNNING", None)
    assert history[1] == ("sub-101", "COMPLETED", "ACCEPTED")
