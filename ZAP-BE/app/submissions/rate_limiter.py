import time
from threading import Lock
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from app.config import get_settings, Settings


class SubmissionRateLimiter:
    """In-memory sliding window rate limiter for submissions configured via Settings.

    Configurable settings:
      - RATE_LIMIT_BURST_WINDOW_SECONDS: Time window for burst check (default: 10s)
      - RATE_LIMIT_BURST_MAX_SUBMISSIONS: Max submissions in burst window (default: 4)
      - RATE_LIMIT_BURST_WAIT_SECONDS: Retry wait message / header (default: 60s)
      - RATE_LIMIT_SUSTAINED_WINDOW_SECONDS: Time window for sustained check (default: 60s)
      - RATE_LIMIT_SUSTAINED_MAX_SUBMISSIONS: Max combined submissions/runs in window (default: 4)
      - RATE_LIMIT_SUSTAINED_WAIT_SECONDS: Retry wait message / header (default: 60s)
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

            # Rule 1: Burst window check (default: max 4 submissions within 10s -> wait 60s)
            if cfg.RATE_LIMIT_BURST_WINDOW_SECONDS > 0 and cfg.RATE_LIMIT_BURST_MAX_SUBMISSIONS > 0:
                cutoff_burst = now - float(cfg.RATE_LIMIT_BURST_WINDOW_SECONDS)
                count_burst = sum(1 for t in timestamps if t > cutoff_burst)
                if count_burst >= cfg.RATE_LIMIT_BURST_MAX_SUBMISSIONS:
                    self._history[user_id] = timestamps
                    wait_sec = cfg.RATE_LIMIT_BURST_WAIT_SECONDS
                    msg = (
                        "Too many attempts, please wait for one minute or try after one minute."
                        if wait_sec >= 60
                        else f"Too many attempts, please wait {wait_sec} seconds"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=msg,
                        headers={"Retry-After": str(wait_sec)},
                    )

            # Rule 2: Sustained window check (default: max 4 combined submissions/runs within 60s -> wait 60s)
            cutoff_sustained = now - float(cfg.RATE_LIMIT_SUSTAINED_WINDOW_SECONDS)
            count_sustained = sum(1 for t in timestamps if t > cutoff_sustained)
            if count_sustained >= cfg.RATE_LIMIT_SUSTAINED_MAX_SUBMISSIONS:
                self._history[user_id] = timestamps
                wait_sec = cfg.RATE_LIMIT_SUSTAINED_WAIT_SECONDS
                msg = (
                    "Too many attempts, please wait for one minute or try after one minute."
                    if wait_sec >= 60
                    else f"Too many attempts, please wait {wait_sec} seconds"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=msg,
                    headers={"Retry-After": str(wait_sec)},
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
