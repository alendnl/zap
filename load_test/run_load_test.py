#!/usr/bin/env python3
"""Master Load Test Runner for ZAP Platform.

Orchestrates:
1. Config validation & safety guardrails.
2. Step 1: Syncing questions from production to lower DB.
3. Step 2: Running high-performance load test (Native Async Engine by default, or Locust via --locust / --web).

Usage:
    # Run active scenario using high-performance async engine (recommended):
    .venv/bin/python load_test/run_load_test.py

    # Run realistic ramp-up scenario:
    .venv/bin/python load_test/run_load_test.py --scenario ramp_up_realistic

    # Run with custom users and duration:
    .venv/bin/python load_test/run_load_test.py --users 50 --duration 30

    # Launch Locust Web UI:
    .venv/bin/python load_test/run_load_test.py --web
"""
import os
import sys
import json
import asyncio
import argparse
import subprocess
from pathlib import Path

LOAD_TEST_DIR = Path(__file__).resolve().parent
REPO_ROOT = LOAD_TEST_DIR.parent
CONFIG_PATH = LOAD_TEST_DIR / "config.json"

if str(LOAD_TEST_DIR) not in sys.path:
    sys.path.insert(0, str(LOAD_TEST_DIR))


def load_config():
    if not CONFIG_PATH.exists():
        print(f"FATAL: Config not found at {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="ZAP Platform Load Test Runner")
    parser.add_argument(
        "--scenario",
        choices=["burst_worst_case", "ramp_up_realistic"],
        help="Override active scenario from config.json"
    )
    parser.add_argument("--users", type=int, help="Override number of users")
    parser.add_argument("--duration", type=int, help="Override duration in seconds")
    parser.add_argument("--engine", choices=["async", "locust"], default="async", help="Load testing engine (default: async)")
    parser.add_argument("--web", action="store_true", help="Launch interactive Locust Web UI on http://localhost:8089")
    parser.add_argument("--skip-sync", action="store_true", help="Skip syncing questions from prod to lower DB")
    args = parser.parse_args()

    config = load_config()

    # Guardrails
    server_url = config.get("server_url")
    env_header = config.get("env_header", "qa")
    lower_db = config.get("lower_db_name", "zap_platform_lower")

    if env_header != "qa":
        print(f"FATAL GUARDRAIL: env_header must be 'qa', got '{env_header}'!", file=sys.stderr)
        sys.exit(1)

    if lower_db != "zap_platform_lower":
        print(f"FATAL GUARDRAIL: lower_db_name must be 'zap_platform_lower', got '{lower_db}'!", file=sys.stderr)
        sys.exit(1)

    scenario_name = args.scenario or config.get("active_scenario", "burst_worst_case")
    scenario_cfg = config.get("scenarios", {}).get(scenario_name)
    if not scenario_cfg:
        print(f"FATAL: Unknown scenario '{scenario_name}'!", file=sys.stderr)
        sys.exit(1)

    users = args.users or scenario_cfg.get("users", 100)
    spawn_rate = scenario_cfg.get("spawn_rate", 100)
    duration = args.duration or scenario_cfg.get("duration_seconds", 60)

    # Step 1: Sync questions if not skipped
    if not args.skip_sync:
        print("\n--- STEP 1: Syncing questions from prod to lower DB ---")
        from sync_questions import sync_questions
        synced = sync_questions()
        if synced == 0:
            print("Warning: 0 questions were synced. Check your config.json question_ids.", file=sys.stderr)
    else:
        print("\n--- STEP 1: Question sync skipped (--skip-sync) ---")

    # Step 2: Run Load Test Engine
    if args.web or args.engine == "locust":
        locustfile = LOAD_TEST_DIR / "locustfile.py"
        locust_bin = REPO_ROOT / ".venv" / "bin" / "locust"
        if not locust_bin.exists():
            locust_bin = "locust"

        cmd = [
            str(locust_bin),
            "-f", str(locustfile),
            "--host", server_url,
        ]

        if args.web:
            print("\n--- STEP 2: Launching Locust Web UI on http://localhost:8089 ---")
            cmd.extend(["--web-port", "8089"])
        else:
            print("\n--- STEP 2: Running Locust Headless Load Test ---")
            cmd.extend([
                "--headless",
                "-u", str(users),
                "-r", str(spawn_rate),
                "--run-time", f"{duration}s",
                "--only-summary",
            ])

        print(f"Executing: {' '.join(cmd)}\n")
        try:
            proc = subprocess.run(cmd, cwd=str(REPO_ROOT))
            sys.exit(proc.returncode)
        except KeyboardInterrupt:
            print("\nLoad test interrupted by user.")
    else:
        # Default: High-performance native Async runner
        print("\n--- STEP 2: Running High-Performance Native Async Load Test ---")
        from async_runner import AsyncLoadTester
        tester = AsyncLoadTester(
            config=config,
            scenario_name=scenario_name,
            override_users=users,
            override_duration=duration
        )
        try:
            asyncio.run(tester.run())
        except KeyboardInterrupt:
            print("\nLoad test interrupted by user.")


if __name__ == "__main__":
    main()
