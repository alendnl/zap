"""Locust Load Test Suite for ZAP Platform.

Features & Guardrails:
1. Strict Safety Guardrail: Every HTTP request is enforced to have 'X-ZAP-ENV: qa'.
2. Config-Driven: Scenarios, target host, question IDs, intervals are loaded from config.json.
3. Two Selectable Scenarios:
   - burst_worst_case: 100 users submitting every 5s for 60s (background polling).
   - ramp_up_realistic: 100 users ramped gradually, waiting for evaluation before next submission.
4. Auto-Seeding: Automatically syncs production questions to lower DB at test start.

Usage:
    # Run via CLI runner (recommended):
    .venv/bin/python load_test/run_load_test.py

    # Or run directly via Locust:
    .venv/bin/locust -f load_test/locustfile.py --host https://zap-api-394729648143.us-central1.run.app
"""
import os
import sys
import json
import uuid
import random
from pathlib import Path
import gevent
from locust import HttpUser, task, between, constant, events

LOAD_TEST_DIR = Path(__file__).resolve().parent
REPO_ROOT = LOAD_TEST_DIR.parent
CONFIG_PATH = LOAD_TEST_DIR / "config.json"

if str(LOAD_TEST_DIR) not in sys.path:
    sys.path.insert(0, str(LOAD_TEST_DIR))



def load_config():
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Config file not found: {CONFIG_PATH}")
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


CONFIG = load_config()
ACTIVE_SCENARIO_NAME = CONFIG.get("active_scenario", "burst_worst_case")
SCENARIO = CONFIG.get("scenarios", {}).get(ACTIVE_SCENARIO_NAME, {})
EXPECTED_ENV = CONFIG.get("env_header", "qa")


# ==============================================================================
# SAFETY GUARDRAIL: Strict Header Enforcement
# ==============================================================================
@events.init.add_listener
def on_locust_init(environment, **kwargs):
    """Enforce strict guardrails across all Locust HTTP requests."""
    if EXPECTED_ENV != "qa":
        raise RuntimeError(f"GUARDRAIL VIOLATION: Config env_header must be 'qa', got '{EXPECTED_ENV}'!")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Sync configured questions from prod to lower DB before traffic starts."""
    print("=" * 60)
    print(f" ZAP LOAD TEST INITIALIZING")
    print(f" Target Host:     {environment.host}")
    print(f" Active Scenario: {ACTIVE_SCENARIO_NAME}")
    print(f" Guardrail Env:   {EXPECTED_ENV}")
    print("=" * 60)

    try:
        from sync_questions import sync_questions
        sync_questions()
    except Exception as exc:
        print(f"Warning: Failed auto-syncing questions: {exc}", file=sys.stderr)


# ==============================================================================
# LOCUST USER DEFINITION
# ==============================================================================
class ZapPlatformUser(HttpUser):
    # Dynamic wait time based on active scenario
    if ACTIVE_SCENARIO_NAME == "burst_worst_case":
        submit_interval = SCENARIO.get("submit_interval_seconds", 5)
        wait_time = constant(submit_interval)
    else:
        min_think = SCENARIO.get("think_time_min_seconds", 5)
        max_think = SCENARIO.get("think_time_max_seconds", 15)
        wait_time = between(min_think, max_think)

    def on_start(self):
        """Executed when a simulated user starts: sign up and authenticate."""
        # Hardcoded Guardrail: Always attach X-ZAP-ENV: qa
        self.client.headers["X-ZAP-ENV"] = EXPECTED_ENV

        user_hex = uuid.uuid4().hex[:8]
        self.user_email = f"loadtest_{user_hex}@codezap.test"
        self.student_id = f"LT-{user_hex}"
        self.password = "Password123!"
        self.user_id = None
        self.token = None

        signup_payload = {
            "name": f"LoadTest User {user_hex}",
            "studentId": self.student_id,
            "collegeName": "Load Test Institute",
            "email": self.user_email,
            "password": self.password,
        }

        # Sign up user
        with self.client.post(
            "/api/v1/auth/signup",
            json=signup_payload,
            headers={"X-ZAP-ENV": EXPECTED_ENV},
            catch_response=True,
            name="POST /api/v1/auth/signup"
        ) as resp:
            if resp.status_code in [200, 201]:
                data = resp.json()
                self.token = data.get("token")
                self.user_id = data.get("student", {}).get("id")
                resp.success()
            elif resp.status_code == 409:
                # If already exists, login
                with self.client.post(
                    "/api/v1/auth/login",
                    json={"email": self.user_email, "password": self.password},
                    headers={"X-ZAP-ENV": EXPECTED_ENV},
                    catch_response=True,
                    name="POST /api/v1/auth/login"
                ) as login_resp:
                    if login_resp.status_code == 200:
                        data = login_resp.json()
                        self.token = data.get("token")
                        self.user_id = data.get("student", {}).get("id")
                        login_resp.success()
                    else:
                        login_resp.failure(f"Login failed: {login_resp.status_code}")
            else:
                resp.failure(f"Signup failed: {resp.status_code} - {resp.text}")

        if self.token:
            self.client.headers["Authorization"] = f"Bearer {self.token}"

    def poll_submission(self, submission_id: str):
        """Poll the submission status endpoint until complete or max attempts reached."""
        poll_interval = SCENARIO.get("poll_interval_seconds", 1)
        max_attempts = SCENARIO.get("max_poll_attempts", 15)

        for attempt in range(max_attempts):
            gevent.sleep(poll_interval)
            # Guardrail check
            with self.client.get(
                f"/api/v1/submissions/{submission_id}",
                headers={"X-ZAP-ENV": EXPECTED_ENV},
                catch_response=True,
                name="GET /api/v1/submissions/{id}"
            ) as poll_resp:
                if poll_resp.status_code == 200:
                    status = poll_resp.json().get("status")
                    verdict = poll_resp.json().get("verdict")
                    if status in ["COMPLETED", "FAILED"]:
                        poll_resp.success()
                        return
                    poll_resp.success()
                elif poll_resp.status_code == 429:
                    poll_resp.failure("Rate limit reached on polling")
                    return
                else:
                    poll_resp.failure(f"Poll error: {poll_resp.status_code}")

    @task
    def submit_and_poll(self):
        """Submit code and poll results according to scenario rules."""
        if not self.user_id:
            return

        question_ids = CONFIG.get("question_ids", ["q-49c9f560"])
        q_id = random.choice(question_ids)

        # Get code from config
        code_info = CONFIG.get("sample_code_by_question", {}).get(
            q_id,
            CONFIG.get("sample_code_by_question", {}).get("default", {
                "language": "python",
                "sourceCode": "class Solution:\n    def solution(self):\n        return True\n"
            })
        )

        sub_payload = {
            "questionId": q_id,
            "language": code_info.get("language", "python"),
            "mode": "SUBMIT",
            "sourceCode": code_info.get("sourceCode"),
            "userId": self.user_id,
        }

        # Strict Guardrail Check: headers must have X-ZAP-ENV: qa
        submission_id = None
        with self.client.post(
            "/api/v1/submissions",
            json=sub_payload,
            headers={"X-ZAP-ENV": EXPECTED_ENV},
            catch_response=True,
            name="POST /api/v1/submissions"
        ) as sub_resp:
            if sub_resp.status_code == 202:
                submission_id = sub_resp.json().get("submissionId")
                sub_resp.success()
            elif sub_resp.status_code == 429:
                sub_resp.failure("Rate limit hit (429 Too Many Requests)")
            else:
                sub_resp.failure(f"Submit error {sub_resp.status_code}: {sub_resp.text}")

        if not submission_id:
            return

        # Handle polling: background vs blocking based on scenario
        wait_for_completion = SCENARIO.get("wait_for_completion", False)
        if wait_for_completion:
            self.poll_submission(submission_id)
        else:
            # Burst worst-case: spawn background greenlet so submission loop runs every 5s
            gevent.spawn(self.poll_submission, submission_id)
