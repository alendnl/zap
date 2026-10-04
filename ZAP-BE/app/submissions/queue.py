"""Google Cloud Tasks producer for submission execution jobs.

This module decouples the submission API from the executor. When Cloud Tasks
is configured (GCP_PROJECT_ID is set), submissions are enqueued as HTTP tasks
that Cloud Tasks delivers to the executor service. Otherwise, an in-memory
queue is used as a local-development fallback.
"""
from typing import Optional, Dict, Any
from app.config import get_settings


class CloudTasksQueue:
    """Producer that creates HTTP tasks in a Google Cloud Tasks queue."""

    def __init__(self, settings=None):
        self.settings = settings or get_settings()
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from google.cloud import tasks_v2
            self._client = tasks_v2.CloudTasksClient()
        return self._client

    @property
    def enabled(self) -> bool:
        return bool(self.settings.GCP_PROJECT_ID)

    def enqueue(self, job: dict) -> Optional[str]:
        """Creates a Cloud Task for the given job. Returns task name or None."""
        if not self.enabled:
            return None

        parent = self.client.queue_path(
            self.settings.GCP_PROJECT_ID,
            self.settings.GCP_LOCATION,
            self.settings.TASKS_QUEUE_NAME,
        )

        if not self.settings.TASKS_SERVICE_ACCOUNT:
            raise RuntimeError("TASKS_SERVICE_ACCOUNT must be configured for Cloud Tasks")

        if not self.settings.TASKS_OIDC_AUDIENCE:
            raise RuntimeError("TASKS_OIDC_AUDIENCE must be configured for Cloud Tasks")

        task = {
            "http_request": {
                "http_method": "POST",
                "url": self.settings.EXECUTOR_TASK_URL,
                "headers": {"Content-Type": "application/json"},
                "body": json_dumps(job).encode("utf-8"),
            }
        }

        task["http_request"]["oidc_token"] = {
            "service_account_email": self.settings.TASKS_SERVICE_ACCOUNT,
            "audience": self.settings.TASKS_OIDC_AUDIENCE,
        }

        response = self.client.create_task(parent=parent, task=task)
        return response.name

    def size(self) -> int:
        # Cloud Tasks does not expose a simple queue depth via the client.
        return 0


def json_dumps(data: Dict[str, Any]) -> str:
    import json
    return json.dumps(data, default=str)


class MemorySubmissionQueue:
    """In-memory fallback queue for local development and tests."""

    def __init__(self):
        self._jobs = []

    def enqueue(self, job: dict):
        self._jobs.append(job)

    def dequeue(self) -> Optional[dict]:
        if self._jobs:
            return self._jobs.pop(0)
        return None

    def size(self) -> int:
        return len(self._jobs)


def get_queue():
    """Returns the appropriate queue implementation based on configuration.

    The queue instance is cached so the API service and tests share the same
    in-memory queue when Cloud Tasks is not configured.
    """
    global _queue_instance
    if _queue_instance is not None:
        return _queue_instance

    settings = get_settings()
    if settings.GCP_PROJECT_ID:
        _queue_instance = CloudTasksQueue(settings)
    else:
        _queue_instance = MemorySubmissionQueue()
    return _queue_instance


_queue_instance = None