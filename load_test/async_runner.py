#!/usr/bin/env python3
"""High-Performance Native Async Load Testing Engine for ZAP Platform.

Powered by `asyncio` + `httpx`.
Guarantees full compatibility across all Python versions (including 3.12, 3.13, 3.14 on macOS/Linux).

Safety Guardrails:
- Hard-locked verification that every request includes 'X-ZAP-ENV: qa'.
- Throws an immediate exception before transmission if any request lacks this header.
"""
import os
import sys
import json
import time
import uuid
import random
import asyncio
from pathlib import Path
from typing import Dict, Any, List
import httpx

LOAD_TEST_DIR = Path(__file__).resolve().parent
REPO_ROOT = LOAD_TEST_DIR.parent
CONFIG_PATH = LOAD_TEST_DIR / "config.json"


class MetricsCollector:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.requests = []  # dict of (endpoint, status, duration_ms, error)
        self.start_time = None
        self.end_time = None

    def start(self):
        self.start_time = time.time()

    def stop(self):
        self.end_time = time.time()

    async def record(self, endpoint: str, status_code: int, duration_ms: float, error: str = None):
        async with self.lock:
            self.requests.append({
                "endpoint": endpoint,
                "status": status_code,
                "duration_ms": duration_ms,
                "error": error,
                "timestamp": time.time(),
            })

    def get_summary(self) -> Dict[str, Any]:
        total_time = (self.end_time or time.time()) - (self.start_time or time.time())
        total_reqs = len(self.requests)

        endpoints_data = {}
        status_counts = {}

        for req in self.requests:
            ep = req["endpoint"]
            st = req["status"]
            dur = req["duration_ms"]
            status_counts[st] = status_counts.get(st, 0) + 1

            if ep not in endpoints_data:
                endpoints_data[ep] = {"durations": [], "statuses": {}, "fails": 0}
            endpoints_data[ep]["durations"].append(dur)
            endpoints_data[ep]["statuses"][st] = endpoints_data[ep]["statuses"].get(st, 0) + 1
            if st >= 400 or req["error"]:
                endpoints_data[ep]["fails"] += 1

        summary = {
            "total_time_seconds": round(total_time, 2),
            "total_requests": total_reqs,
            "overall_rps": round(total_reqs / total_time, 2) if total_time > 0 else 0,
            "status_counts": status_counts,
            "endpoints": {}
        }

        for ep, data in endpoints_data.items():
            durs = sorted(data["durations"])
            count = len(durs)
            def p(pct):
                return round(durs[min(int(len(durs) * pct / 100), len(durs) - 1)], 1) if durs else 0

            summary["endpoints"][ep] = {
                "count": count,
                "fails": data["fails"],
                "avg_ms": round(sum(durs) / count, 1) if count else 0,
                "min_ms": round(durs[0], 1) if durs else 0,
                "max_ms": round(durs[-1], 1) if durs else 0,
                "p50_ms": p(50),
                "p90_ms": p(90),
                "p95_ms": p(95),
                "p99_ms": p(99),
            }

        return summary


class AsyncLoadTester:
    def __init__(self, config: Dict[str, Any], scenario_name: str, override_users: int = None, override_duration: int = None):
        self.config = config
        self.server_url = config.get("server_url").rstrip("/")
        self.env_header = config.get("env_header", "qa")
        self.scenario_name = scenario_name
        self.scenario_cfg = config.get("scenarios", {}).get(scenario_name, {})
        self.users_count = override_users or self.scenario_cfg.get("users", 100)
        self.duration_seconds = override_duration or self.scenario_cfg.get("duration_seconds", 60)
        self.question_ids = config.get("question_ids", ["q-49c9f560"])
        self.sample_codes = config.get("sample_code_by_question", {})
        self.metrics = MetricsCollector()

        # Strict Guardrail Check
        if self.env_header != "qa":
            raise RuntimeError(f"FATAL GUARDRAIL: env_header must be 'qa', got '{self.env_header}'!")

    def _guardrail_headers(self, custom_headers: Dict[str, str] = None) -> Dict[str, str]:
        headers = custom_headers.copy() if custom_headers else {}
        headers["X-ZAP-ENV"] = "qa"  # Immutable guardrail
        assert headers.get("X-ZAP-ENV") == "qa", "Guardrail Violation: Missing X-ZAP-ENV: qa"
        return headers

    async def _poll_submission(self, client: httpx.AsyncClient, sub_id: str, auth_headers: Dict[str, str], max_attempts: int, poll_interval: float, stop_event: asyncio.Event = None):
        """Poll submission status in background or inline."""
        for _ in range(max_attempts):
            if stop_event and stop_event.is_set():
                return
            await asyncio.sleep(poll_interval)
            if stop_event and stop_event.is_set():
                return
            t0 = time.time()
            ep = "GET /api/v1/submissions/{id}"
            try:
                resp = await client.get(
                    f"{self.server_url}/api/v1/submissions/{sub_id}",
                    headers=self._guardrail_headers(auth_headers),
                    timeout=8.0
                )
                dur = (time.time() - t0) * 1000
                await self.metrics.record(ep, resp.status_code, dur)
                if resp.status_code == 200:
                    status = resp.json().get("status")
                    if status in ["COMPLETED", "FAILED"]:
                        return
            except asyncio.CancelledError:
                return
            except Exception as err:
                dur = (time.time() - t0) * 1000
                await self.metrics.record(ep, 599, dur, str(err))

    async def _simulate_user(self, user_index: int, client: httpx.AsyncClient, stop_event: asyncio.Event):
        """Simulate a single user workflow."""
        user_hex = f"{user_index}_{uuid.uuid4().hex[:6]}"
        user_email = f"loadtest_u{user_hex}@codezap.test"
        student_id = f"LT-U{user_hex}"
        password = "Password123!"

        signup_payload = {
            "name": f"LoadTest Student {user_hex}",
            "studentId": student_id,
            "collegeName": "Load Test Institute",
            "email": user_email,
            "password": password,
        }

        # Step 1: Sign Up / Login
        auth_headers = {}
        user_id = None
        ep_signup = "POST /api/v1/auth/signup"
        t0 = time.time()
        try:
            resp = await client.post(
                f"{self.server_url}/api/v1/auth/signup",
                json=signup_payload,
                headers=self._guardrail_headers(),
                timeout=15.0
            )
            dur = (time.time() - t0) * 1000
            await self.metrics.record(ep_signup, resp.status_code, dur)
            if resp.status_code in [200, 201]:
                data = resp.json()
                token = data.get("token")
                user_id = data.get("student", {}).get("id")
                auth_headers = {"Authorization": f"Bearer {token}"}
            elif resp.status_code == 409:
                # Login
                ep_login = "POST /api/v1/auth/login"
                t_log = time.time()
                l_resp = await client.post(
                    f"{self.server_url}/api/v1/auth/login",
                    json={"email": user_email, "password": password},
                    headers=self._guardrail_headers(),
                    timeout=15.0
                )
                dur_log = (time.time() - t_log) * 1000
                await self.metrics.record(ep_login, l_resp.status_code, dur_log)
                if l_resp.status_code == 200:
                    data = l_resp.json()
                    token = data.get("token")
                    user_id = data.get("student", {}).get("id")
                    auth_headers = {"Authorization": f"Bearer {token}"}
        except Exception as err:
            dur = (time.time() - t0) * 1000
            await self.metrics.record(ep_signup, 599, dur, str(err))
            return

        if not user_id:
            return

        # Scenario Execution
        is_burst = (self.scenario_name == "burst_worst_case")
        submit_interval = self.scenario_cfg.get("submit_interval_seconds", 5)
        poll_interval = self.scenario_cfg.get("poll_interval_seconds", 1 if is_burst else 2)
        max_poll_attempts = self.scenario_cfg.get("max_poll_attempts", 10 if is_burst else 30)
        wait_for_completion = self.scenario_cfg.get("wait_for_completion", False)

        background_tasks = []

        while not stop_event.is_set():
            q_id = random.choice(self.question_ids)
            code_info = self.sample_codes.get(q_id, self.sample_codes.get("default", {
                "language": "python",
                "sourceCode": "class Solution:\n    def solution(self):\n        return True\n"
            }))

            sub_payload = {
                "questionId": q_id,
                "language": code_info.get("language", "python"),
                "mode": "SUBMIT",
                "sourceCode": code_info.get("sourceCode"),
                "userId": user_id,
            }

            ep_sub = "POST /api/v1/submissions"
            t_sub = time.time()
            sub_id = None
            try:
                sub_resp = await client.post(
                    f"{self.server_url}/api/v1/submissions",
                    json=sub_payload,
                    headers=self._guardrail_headers(auth_headers),
                    timeout=15.0
                )
                dur_sub = (time.time() - t_sub) * 1000
                await self.metrics.record(ep_sub, sub_resp.status_code, dur_sub)
                if sub_resp.status_code == 202:
                    sub_id = sub_resp.json().get("submissionId")
            except Exception as err:
                dur_sub = (time.time() - t_sub) * 1000
                await self.metrics.record(ep_sub, 599, dur_sub, str(err))

            # Handle Polling
            if sub_id:
                if wait_for_completion:
                    await self._poll_submission(client, sub_id, auth_headers, max_poll_attempts, poll_interval, stop_event)
                else:
                    # Burst mode: background polling task, loop continues immediately after interval
                    bg_task = asyncio.create_task(
                        self._poll_submission(client, sub_id, auth_headers, max_poll_attempts, poll_interval, stop_event)
                    )
                    background_tasks.append(bg_task)

            # Wait interval before next submit
            if is_burst:
                await asyncio.sleep(submit_interval)
            else:
                think = random.uniform(
                    self.scenario_cfg.get("think_time_min_seconds", 5),
                    self.scenario_cfg.get("think_time_max_seconds", 15)
                )
                await asyncio.sleep(think)

        if background_tasks:
            for t in background_tasks:
                if not t.done():
                    t.cancel()


    async def run(self):
        print("=" * 70)
        print(" ⚡ ZAP ASYNC LOAD TEST RUNNER")
        print(f" Target Server:  {self.server_url}")
        print(f" Target DB:      {self.config.get('lower_db_name')} (Header: X-ZAP-ENV: {self.env_header})")
        print(f" Scenario:       {self.scenario_name}")
        print(f" Description:    {self.scenario_cfg.get('description')}")
        print(f" Total Users:    {self.users_count} concurrent")
        print(f" Duration:       {self.duration_seconds} seconds")
        print("=" * 70)

        self.metrics.start()
        stop_event = asyncio.Event()

        # Timer task to signal stop
        async def timer():
            start_t = time.time()
            while time.time() - start_t < self.duration_seconds:
                elapsed = int(time.time() - start_t)
                remaining = self.duration_seconds - elapsed
                total_reqs = len(self.metrics.requests)
                sys.stdout.write(f"\r[Running] Elapsed: {elapsed:3d}s / {self.duration_seconds}s | Total Requests: {total_reqs:5d}")
                sys.stdout.flush()
                await asyncio.sleep(1.0)
            print()
            stop_event.set()

        timer_task = asyncio.create_task(timer())

        # Spawn users
        spawn_rate = self.scenario_cfg.get("spawn_rate", self.users_count)
        spawn_delay = 1.0 / spawn_rate if spawn_rate > 0 else 0

        limits = httpx.Limits(max_connections=500, max_keepalive_connections=200)
        async with httpx.AsyncClient(limits=limits) as client:
            user_tasks = []
            for i in range(self.users_count):
                task = asyncio.create_task(self._simulate_user(i + 1, client, stop_event))
                user_tasks.append(task)
                if spawn_delay > 0 and self.scenario_name != "burst_worst_case":
                    await asyncio.sleep(spawn_delay)

            await timer_task
            await asyncio.gather(*user_tasks, return_exceptions=True)

        self.metrics.stop()
        self._print_report()

    def _print_report(self):
        summary = self.metrics.get_summary()
        print("\n" + "=" * 70)
        print(" 📊 LOAD TEST EXECUTION REPORT")
        print("=" * 70)
        print(f" Total Duration:  {summary['total_time_seconds']} seconds")
        print(f" Total Requests:  {summary['total_requests']}")
        print(f" Overall RPS:     {summary['overall_rps']} req/s")
        print(f" Status Codes:    {summary['status_counts']}")
        print("-" * 70)
        print(f"{'Endpoint':<32} {'Reqs':<6} {'Fails':<6} {'Avg(ms)':<8} {'p50':<7} {'p95':<7} {'p99':<7}")
        print("-" * 70)
        for ep, data in summary["endpoints"].items():
            print(f"{ep:<32} {data['count']:<6} {data['fails']:<6} {data['avg_ms']:<8} {data['p50_ms']:<7} {data['p95_ms']:<7} {data['p99_ms']:<7}")
        print("=" * 70)


def run_standalone():
    if not CONFIG_PATH.exists():
        print(f"FATAL: Config not found at {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(CONFIG_PATH, "r") as f:
        config = json.load(f)

    scenario = config.get("active_scenario", "burst_worst_case")
    tester = AsyncLoadTester(config, scenario)
    asyncio.run(tester.run())


if __name__ == "__main__":
    run_standalone()
