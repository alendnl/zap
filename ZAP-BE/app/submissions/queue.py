"""Google Cloud Tasks producer for submission execution jobs.

This module decouples the submission API from the executor. When Cloud Tasks
is configured (GCP_PROJECT_ID is set), submissions are enqueued as HTTP tasks
that Cloud Tasks delivers to the executor service. Otherwise, an in-memory
queue is used as a local-development fallback.
"""
from typing import Optional, Dict, Any
from fastapi import Request
from app.config import get_settings
from app.db.mongodb import get_request_environment


class CloudTasksQueue:
    """Producer that creates HTTP tasks in a Google Cloud Tasks queue.

    A single queue instance is bound to a single environment; the queue name
    is resolved from the per-environment config.
    """

    def __init__(self, settings=None, environment: str = "production"):
        self.settings = settings or get_settings()
        self.environment = environment
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
        """Creates a Cloud Task for the given job. Returns task name or None.

        The task payload is stamped with the environment so the executor can
        select the correct database.
        """
        if not self.enabled:
            return None

        # Stamp the environment onto the payload so the executor can select
        # the correct database.
        job = {**job, "environment": self.environment}

        env_cfg = self.settings.get_environment_config(self.environment)
        parent = self.client.queue_path(
            self.settings.GCP_PROJECT_ID,
            self.settings.GCP_LOCATION,
            env_cfg.queue_name,
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


def get_queue_for_env(env: str, settings=None):
    """Returns the queue implementation for the given environment.

    When Cloud Tasks is configured (GCP_PROJECT_ID set), a CloudTasksQueue
    bound to the environment's queue name is returned; otherwise an
    in-memory queue is used for local development and tests.
    """
    cache_instance = settings is None
    if cache_instance and env in _queue_instances:
        return _queue_instances[env]

    settings = settings or get_settings()
    if settings.GCP_PROJECT_ID:
        queue = CloudTasksQueue(settings, environment=env)
    else:
        queue = MemorySubmissionQueue()
    if cache_instance:
        _queue_instances[env] = queue
    return queue


def get_queue(request: Optional[Request] = None):
    """FastAPI dependency: returns the queue for the request's environment
    (X-ZAP-ENV header, defaulting to DEFAULT_ENVIRONMENT)."""
    return get_queue_for_env(get_request_environment(request))


_queue_instances: dict[str, Any] = {}