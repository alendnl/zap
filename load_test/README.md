# ZAP Platform Load Testing Suite

Comprehensive load testing suite designed to simulate real user experience against the **Production Server** while strictly directing all writes/reads to the **Lower Database** (`zap_platform_lower`).

---

## 🔒 Safety Guardrails

1. **Strict QA Environment Isolation**: Every single HTTP request automatically and immutably includes the `X-ZAP-ENV: qa` header. If missing or altered, the runner aborts immediately.
2. **Database Protection**: The cleanup script is hardcoded to refuse execution on any database other than `zap_platform_lower`, preventing accidental operations on production.
3. **Automated Seeding**: Syncs only the specified question IDs from production into lower before testing begins.

---

## 📁 Directory Structure

- [`config.json`](file:///Users/apilav068@apac.comcast.com/zap/load_test/config.json): Central configuration for server URL, scenarios, user counts, intervals, and question IDs.
- [`clean_lower_db.py`](file:///Users/apilav068@apac.comcast.com/zap/load_test/clean_lower_db.py): Drops/cleans all data in `zap_platform_lower` and re-indexes.
- [`sync_questions.py`](file:///Users/apilav068@apac.comcast.com/zap/load_test/sync_questions.py): Copies the configured question IDs from `zap_platform_prod` to `zap_platform_lower`.
- [`locustfile.py`](file:///Users/apilav068@apac.comcast.com/zap/load_test/locustfile.py): Locust user simulation (sign-up/login ➔ submit code ➔ poll status).
- [`run_load_test.py`](file:///Users/apilav068@apac.comcast.com/zap/load_test/run_load_test.py): CLI runner orchestrating sync and headless / web execution.

---

## ⚙️ Configuration (`config.json`)

To switch between scenarios, change `"active_scenario"` in [`config.json`](file:///Users/apilav068@apac.comcast.com/zap/load_test/config.json):

```json
{
  "active_scenario": "burst_worst_case"
}
```

### Supported Scenarios:
1. **`burst_worst_case`** (Worst Case):
   - 100 simultaneous users spawned instantly.
   - Submits code every 5 seconds for 60 seconds.
   - Spawns background polling workers for submission tracking.
2. **`ramp_up_realistic`** (Realistic DSA Candidate Journey):
   - 100 users spawned gradually at 5 users/sec.
   - Submits code and polls until evaluation is `COMPLETED` or `FAILED`.
   - Takes realistic think time (5–15 seconds) before resubmitting.

---

## 🚀 Execution Guide

### Step 1: Clean Lower Environment DB
Run this first to ensure the lower environment is completely clean:
```bash
.venv/bin/python load_test/clean_lower_db.py
```
*(Or use `--force` to bypass the interactive confirmation).*

### Step 2: Run the Load Test

#### Option A: Headless CLI (Default Scenario from config)
```bash
.venv/bin/python load_test/run_load_test.py
```

#### Option B: Switch Scenario via CLI Flag
```bash
# Run realistic ramp-up scenario
.venv/bin/python load_test/run_load_test.py --scenario ramp_up_realistic

# Run with customized user count and duration
.venv/bin/python load_test/run_load_test.py --scenario burst_worst_case --users 50 --duration 30
```

#### Option C: Interactive Web UI (Locust Dashboard)
```bash
.venv/bin/python load_test/run_load_test.py --web
```
Open **`http://localhost:8089`** in your browser to view real-time latency percentiles, charts, and RPS.
