from typing import Optional, Dict, Any, List
from dataclasses import dataclass


@dataclass
class ExecutionJob:
    job_id: str
    submission_id: str
    question_id: str
    language: str
    source_code: str
    test_cases: List[Dict[str, Any]]
    timeout_seconds: float = 2.0


class MemoryExecutionQueue:
    def __init__(self):
        self._queue: List[ExecutionJob] = []

    def enqueue(self, job: ExecutionJob):
        self._queue.append(job)

    def dequeue(self) -> Optional[ExecutionJob]:
        if self._queue:
            return self._queue.pop(0)
        return None

    def size(self) -> int:
        return len(self._queue)
