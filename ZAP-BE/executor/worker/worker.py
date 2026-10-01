from typing import Optional, Callable
from executor.worker.queue import MemoryExecutionQueue, ExecutionJob
from executor.languages import get_runner
from executor.judge.judge import JudgeEngine, JudgeResult
from executor.core.runner import ExecutionLimits


class ExecutionWorker:
    """Worker daemon that pulls submission jobs from the queue and runs the Judge Engine."""

    def __init__(
        self,
        queue: MemoryExecutionQueue,
        status_update_cb: Optional[Callable[[str, str, Optional[JudgeResult]], None]] = None
    ):
        self.queue = queue
        self.judge_engine = JudgeEngine()
        self.status_update_cb = status_update_cb

    def process_one_job(self) -> Optional[JudgeResult]:
        job = self.queue.dequeue()
        if not job:
            return None

        # 1. Notify status RUNNING
        if self.status_update_cb:
            self.status_update_cb(job.submission_id, "RUNNING", None)

        try:
            runner = get_runner(job.language)
            limits = ExecutionLimits(timeout_seconds=job.timeout_seconds)
            
            # 2. Run judge
            result = self.judge_engine.judge(
                runner=runner,
                source_code=job.source_code,
                test_cases=job.test_cases,
                limits=limits,
                submission_id=job.submission_id,
                fail_fast=True
            )

            # 3. Notify terminal status
            if self.status_update_cb:
                self.status_update_cb(job.submission_id, "COMPLETED", result)

            return result

        except Exception as e:
            err_result = JudgeResult(
                verdict="SYSTEM_ERROR",
                error_message=str(e)
            )
            if self.status_update_cb:
                self.status_update_cb(job.submission_id, "FAILED", err_result)
            return err_result
