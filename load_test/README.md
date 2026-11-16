# ZAP Platform Load Testing Architecture

> **Notice**: Local CLI load testing scripts (`locust`, `run_load_test.py`, `async_runner.py`) have been deprecated and retired.
> All load testing is now managed, configured, executed, and analyzed directly in the **ZAP Front-End Admin Portal** at `/admin/load-test`.

---

## 🚀 Modern In-Browser Load Testing Studio (`/admin/load-test`)

Platform administrators can now launch and monitor load tests directly from their browser without maintaining local Python scripts, dependencies, or command-line harnesses.

### Features:
1. **Zero-Configuration In-Browser Engine**:
   - The test runner runs inside the client browser, executing real HTTP requests against the backend.
   - Live telemetry: active virtual users, real-time RPS, latency percentiles (p50, p90, p95, p99), success rate %, error breakdown, and a live terminal event stream.
2. **Two Configurable Target Subsystems**:
   - **ZAP API**: Tests REST endpoints (Questions, MCQs, Contests, Submissions feed, and synthetic user signups) with configurable concurrency, durations, and ramp-up schedules (instant spike vs gradual linear).
   - **ZAP Executor**: Tests the compiler sandbox execution engine.
     - Direct Compiler Benchmark (`POST /api/v1/compiler/run`) for raw container compilation & execution throughput.
     - Full Async Submission Lifecycle (`POST /api/v1/submissions` + polling `GET /api/v1/submissions/{id}`) testing Cloud Tasks and database polling latches.
     - Configurable programming languages (C++, Java, Python, C, JavaScript) and code complexity (Light, Medium, Compilation-Intensive / Heavy).
3. **Strict Environment & Database Isolation (Invariant)**:
   - All load test requests automatically and immutably append `X-ZAP-ENV: qa`.
   - All test configurations and historical run reports are stored in `zap_platform_lower` in MongoDB collections `load_test_configs` and `load_test_runs`.
   - **Production Database (`zap_platform_prod`) remains 100% untouched and isolated.**
4. **Data Management & Clean Lower DB**:
   - One-click modal in the Admin Portal to purge synthetic test accounts (`loadtest_*`), submissions, and logs from `zap_platform_lower`.
   - Hardcoded failsafe in backend API that prevents any purge from ever touching databases with "prod" in their name.
