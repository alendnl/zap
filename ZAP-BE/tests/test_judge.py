import pytest
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
