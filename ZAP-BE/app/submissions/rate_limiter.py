import time
from threading import Lock
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from app.config import get_settings, Settings


class SubmissionRateLimiter:
    """In-memory sliding window rate limiter for submissions configured via Settings.

    Configurable settings:
      - RATE_LIMIT_BURST_WINDOW_SECONDS: Time window for burst check (default: 10s)
      - RATE_LIMIT_BURST_MAX_SUBMISSIONS: Max submissions in burst window (default: 2)
      - RATE_LIMIT_BURST_WAIT_SECONDS: Retry wait message / header (default: 5s)
      - RATE_LIMIT_SUSTAINED_WINDOW_SECONDS: Time window for sustained check (default: 60s)
      - RATE_LIMIT_SUSTAINED_MAX_SUBMISSIONS: Max submissions in sustained window (default: 6)
      - RATE_LIMIT_SUSTAINED_WAIT_SECONDS: Retry wait message / header (default: 30s)
    """

    def __init__(self, settings: Optional[Settings] = None):
        self._lock = Lock()
        self._history: Dict[str, List[float]] = {}
        self._settings = settings

    @property
    def settings(self) -> Settings:
        return self._settings or get_settings()

    def check_rate_limit(self, user_id: str) -> None:
        cfg = self.settings
        now = time.time()
        with self._lock:
            timestamps = self._history.get(user_id, [])

            # Prune timestamps older than sustained window
            max_window = max(cfg.RATE_LIMIT_BURST_WINDOW_SECONDS, cfg.RATE_LIMIT_SUSTAINED_WINDOW_SECONDS)
            cutoff_max = now - float(max_window)
            timestamps = [t for t in timestamps if t > cutoff_max]

            # Rule 1: Burst window check (default: max 2 submissions within 10s -> wait 5s)
            cutoff_burst = now - float(cfg.RATE_LIMIT_BURST_WINDOW_SECONDS)
            count_burst = sum(1 for t in timestamps if t > cutoff_burst)
            if count_burst >= cfg.RATE_LIMIT_BURST_MAX_SUBMISSIONS:
                self._history[user_id] = timestamps
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many submissions, please wait {cfg.RATE_LIMIT_BURST_WAIT_SECONDS} seconds",
                    headers={"Retry-After": str(cfg.RATE_LIMIT_BURST_WAIT_SECONDS)},
                )

            # Rule 2: Sustained window check (default: max 6 submissions within 60s -> wait 30s)
            cutoff_sustained = now - float(cfg.RATE_LIMIT_SUSTAINED_WINDOW_SECONDS)
            count_sustained = sum(1 for t in timestamps if t > cutoff_sustained)
            if count_sustained >= cfg.RATE_LIMIT_SUSTAINED_MAX_SUBMISSIONS:
                self._history[user_id] = timestamps
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many submissions, please wait {cfg.RATE_LIMIT_SUSTAINED_WAIT_SECONDS} seconds",
                    headers={"Retry-After": str(cfg.RATE_LIMIT_SUSTAINED_WAIT_SECONDS)},
                )

            # Record this attempt
            timestamps.append(now)
            self._history[user_id] = timestamps

    def reset(self) -> None:
        with self._lock:
            self._history.clear()


# Global singleton instance
submission_rate_limiter = SubmissionRateLimiter()


def get_submission_rate_limiter() -> SubmissionRateLimiter:
    return submission_rate_limiter
