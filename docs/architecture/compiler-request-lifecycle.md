# Compiler Request Lifecycle: Top-to-Bottom Breakdown

> **Status**: Living Architectural Specification  
> **Applicability**: `ZAP-FE`, `ZAP-BE` (`zap-api`), `ZAP-BE/executor` (`zap-executor`), Google Cloud Tasks, MongoDB Atlas.  
> **Notice**: Any modifications to the submission pipeline, polling cadence, Cloud Tasks payloads, executor sandbox, or MongoDB submission schemas **must be updated in this document**.

---

## 1. Executive Summary

In the ZAP platform, running and submitting code is an **asynchronous, loosely coupled, multi-stage pipeline**. Untrusted user code is never executed inside the main web API. Instead, execution is delegated to an isolated execution microservice (`zap-executor`) via Google Cloud Tasks, while the frontend maintains an anti-hammering sequential polling latch against MongoDB Atlas.

---

## 2. End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant FE as ZAP-FE (Next.js / Monaco)
    participant API as zap-api (FastAPI)
    participant DB as MongoDB Atlas
    participant GCT as Google Cloud Tasks
    participant Exec as zap-executor (Cloud Run)
    participant Box as Sandbox Process (/tmp)

    %% Phase 1: Submit Code
    rect rgb(240, 248, 255)
    Note over User, API: Phase 1: Submission Request & Initial Latch
    User->>FE: Click "Submit solution" / "Run code"
    FE->>FE: Lock UI (isRunning = true), bump activePollIdRef
    FE->>API: POST /api/v1/submissions (code, lang, questionId, mode, submittedAt, timeSpentSeconds)
    API->>API: Check Rate Limiter (sliding window per user)
    API->>DB: Insert Submission (status: "QUEUED", mode, sourceCode, submittedAt, timeSpentSeconds)
    API->>GCT: Enqueue HTTP Task (with OIDC Bearer Token)
    API-->>FE: HTTP 202 Accepted { submissionId, status: "QUEUED" }
    end

    %% Phase 2 & 3: Polling Loop & Cloud Tasks Dispatch in Parallel
    rect rgb(255, 250, 240)
    Note over FE, DB: Phase 2: Client Sequential Polling Loop Starts
    FE->>API: GET /api/v1/submissions/{submissionId} (Poll #1)
    API->>DB: Query submission by ID
    DB-->>API: Return doc (status: "QUEUED")
    API-->>FE: HTTP 200 { status: "QUEUED" }
    FE->>FE: Latch: Wait max(0, 5000ms - callDuration)
    end

    rect rgb(245, 255, 245)
    Note over GCT, Box: Phase 3: Cloud Tasks Trigger & Atomic Claim
    GCT->>Exec: POST /internal/tasks/execute (OIDC Authenticated)
    Exec->>Exec: Verify OIDC claims & Service Account identity
    Exec->>DB: find_one_and_update (Atomic claim: QUEUED -> RUNNING)
    Note over DB, Exec: Atomic lease lock prevents duplicate task runners
    Exec->>DB: Fetch Question & Test Cases (Public + Hidden)
    end

    %% Phase 4: Compiling & Sandboxed Execution
    rect rgb(255, 245, 245)
    Note over Exec, Box: Phase 4: Sandbox & Judge Execution
    Exec->>Box: Sandbox.setup(): Create /tmp/zap/submissions/{id}
    Exec->>Box: runner.compile(): Compile binary (C/C++/Java)
    par Parallel Test Execution
        Exec->>Box: runner.run() for TC 1 (isolated process & stdin pipe)
        Exec->>Box: runner.run() for TC 2 (isolated process & stdin pipe)
        Exec->>Box: runner.run() for TC N (isolated process & stdin pipe)
    end
    Box-->>Exec: Return outputs, times, exit codes
    Exec->>Exec: JudgeEngine: Compare normalized outputs, mask hidden cases, preserve order
    Exec->>Box: sandbox.cleanup(): Delete /tmp workspace (finally block)
    end

    %% Concurrent Polling during execution
    FE->>API: GET /api/v1/submissions/{submissionId} (Poll #2)
    API->>DB: Query submission
    DB-->>API: Return doc (status: "RUNNING")
    API-->>FE: HTTP 200 { status: "RUNNING" }
    FE->>FE: Latch: Sleep remainder of 5000ms interval

    %% Phase 5: Result Persistence
    rect rgb(240, 255, 255)
    Note over Exec, DB: Phase 5: Verdict Resolution & Persistence
    Exec->>DB: update_submission_status(status: "COMPLETED", verdict: "ACCEPTED", testResults)
    Exec-->>GCT: HTTP 200 OK (Task Acknowledged)
    end

    %% Phase 6: Final Terminal Poll
    rect rgb(245, 240, 255)
    Note over FE, User: Phase 6: Terminal Poll Detection & UI Render
    FE->>API: GET /api/v1/submissions/{submissionId} (Poll #3)
    API->>DB: Query submission
    DB-->>API: Return doc (status: "COMPLETED", verdict: "ACCEPTED", masked testResults)
    API-->>FE: HTTP 200 { status: "COMPLETED", verdict: "ACCEPTED", ... }
    FE->>FE: isTerminalStatus("COMPLETED") == true -> Exit polling loop
    FE->>FE: Update submission history table & unlock UI
    FE-->>User: Display Green "Accepted", execution runtime & test breakdown
    end
```
```

---

## 3. Phase-by-Phase Technical Walkthrough

### Phase 1: Frontend Submission Initiation & Polling Latch
- **Source Files**: [`StudentWorkspace.tsx`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-FE/src/components/StudentWorkspace.tsx#L400-L425), [`EditorPane.tsx`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-FE/src/components/EditorPane.tsx#L103-L119), [`submissionsApi.ts`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-FE/src/services/submissionsApi.ts#L113-L116)
- **Actions**:
  1. User triggers either **"Run code"** (`mode: "RUN"`, public test cases only) or **"Submit solution"** (`mode: "SUBMIT"`, full public + hidden suite).
  2. The frontend increments `activePollIdRef.current`. Any previously running poll loop detects this ID change and self-terminates, preventing race conditions or ghost updates.
  3. UI enters running state (`isRunning = true`), disabling the editor and run buttons.
  4. Client dispatches `POST /api/v1/submissions` carrying `{ questionId, language, mode, sourceCode, userId, submittedAt, timeSpentSeconds }`.

### Phase 2: API Gateway Ingestion & Asynchronous Decoupling
- **Source Files**: [`router.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/app/submissions/router.py#L24-L39), [`service.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/app/submissions/service.py#L30-L89), [`queue.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/app/submissions/queue.py#L37-L79)
- **Actions**:
  1. **Rate Limiting**: `rate_limiter.check_rate_limit(user_key)` enforces sliding-window quotas (max 4 combined code runs/submissions per 60 seconds; attempt 5 is cut off with HTTP 429 `"Too many attempts, please wait for one minute or try after one minute."`).
  2. **Database Insertion**: `SubmissionService.create_submission()` writes a document to MongoDB's `submissions` collection with:
     - `status: "QUEUED"`
     - `createdAt: <ISO Timestamp>`
     - `submittedAt: <ISO Timestamp>` (client-provided timestamp or server UTC default)
     - `timeSpentSeconds: <int>` (time spent by user on the coding problem prior to submission)
     - `mode`, `language`, `sourceCode`, `questionId`, `userId`
  3. **Cloud Tasks Enqueue**: `CloudTasksQueue.enqueue()` submits an HTTP task to Google Cloud Tasks (`zap-submissions` in prod, `zap-submissions-lower` in QA):
     - **Target URL**: `https://<zap-executor-host>/internal/tasks/execute`
     - **Auth**: Google OIDC Bearer Token signed for `TASKS_SERVICE_ACCOUNT` with audience `TASKS_OIDC_AUDIENCE`.
     - **Payload**: `{ "submissionId": "...", "environment": "production" }`
  4. **Fail-Safe Rollback**: If Cloud Tasks rejects the enqueue operation, the API updates the submission immediately to `FAILED` (`SYSTEM_ERROR`), preventing zombie `QUEUED` records.
  5. API responds with `HTTP 202 Accepted` returning `{ submissionId, status: "QUEUED" }`.

### Phase 3: Client Sequential Polling Loop
- **Source Files**: [`StudentWorkspace.tsx`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-FE/src/components/StudentWorkspace.tsx#L427-L495)
- **Actions**:
  1. The client enters a sequential `while (!isDone && attempts < 60)` loop.
  2. **Anti-Hammering Latch**: Rather than using a naive `setInterval` (which stacks concurrent requests if the backend lags), it waits for the active `GET` request to finish, measures its elapsed duration, and sleeps only the remaining milliseconds:
     $$\text{sleepTime} = \max(0, 5000 - \text{callDuration})$$
  3. The request includes `Cache-Control: no-cache, no-store` headers and a unique timestamp query parameter `?_t=...` to bypass intermediate CDN/proxy caches.

### Phase 4: Cloud Tasks Delivery & Atomic Lease Lock
- **Source Files**: [`handler.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/executor/tasks/handler.py#L53-L144), [`service.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/app/submissions/service.py#L230-L274)
- **Actions**:
  1. Cloud Tasks delivers the HTTP POST to `zap-executor`.
  2. **OIDC Verification**: `verify_cloud_tasks()` verifies the signature with Google Auth libraries to guarantee only the authorized Cloud Tasks queue can trigger the runner.
  3. **Atomic State Transition**: `service.claim_submission()` issues an atomic MongoDB `find_one_and_update`:
     ```python
     coll.find_one_and_update(
         {
             "_id": submission_id,
             "$or": [
                 {"status": "QUEUED"},
                 {"status": "RUNNING", "startedAt": {"$lte": stale_lease_timestamp}}
             ]
         },
         {"$set": {"status": "RUNNING", "startedAt": now_timestamp}}
     )
     ```
  4. If another worker already claimed the task or if it already finished, the request is acknowledged and skipped, completely preventing duplicate execution.

### Phase 5: Sandboxed Compilation & Test Case Evaluation
- **Source Files**: [`judge.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/executor/judge/judge.py#L46-L206), [`sandbox.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/executor/sandbox/sandbox.py#L26-L117), [`harness.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/executor/core/harness.py)
- **Actions**:
  1. **Sandbox Creation**: Ephemeral directory created at `/tmp/zap/submissions/{id}/` with `source`, `build`, `stdin`, `stdout`, `stderr`.
  2. **Driver Harness**: If the question expects a function signature (e.g., LeetCode style), `prepare_executable_code()` automatically injects language-specific test drivers.
  3. **Compilation**:
     - C/C++: GCC with `-O2 -std=c++23`
     - Java: OpenJDK 21
     - Python & Node.js: Syntax & import validation
     - If compilation fails, the run aborts with verdict `COMPILE_ERROR`.
  4. **Parallel Test Case Execution**:
     - Single build compiles the artifact once.
     - Tests are evaluated concurrently using `ThreadPoolExecutor`, spawning independent OS subprocesses.
     - Each process has dedicated standard I/O pipes without disk file collision.
     - Enforces CPU/wall-clock timeout (`run_res.timed_out`), memory limits, and output limits per test case.
     - Collects results preserving the exact original order of test cases.
     - Normalizes line endings/whitespace and compares `stdout` with `expectedOutput`.
     - Applies the **verdict severity hierarchy**:
       $$\text{ACCEPTED} < \text{WRONG\_ANSWER} < \text{OUTPUT\_LIMIT\_EXCEEDED} < \text{TIME\_LIMIT\_EXCEEDED} < \text{RUNTIME\_ERROR} < \text{COMPILE\_ERROR}$$
  5. **Confidentiality Masking & DB-Level Sanitization**: For test cases with `visibility == "HIDDEN"`, `input`, `expectedOutput`, `actualOutput`, and `error` are masked to `None`/`null`. Furthermore, at the MongoDB database level (`SubmissionService.get_submission()`), an aggregation pipeline using `$map` and `$cond` projects only `id`, `visibility: "HIDDEN"`, `passed`, `status`, and `executionTimeMs` for hidden test cases, ensuring large test case payloads (e.g. 1 MB+) are never transmitted from MongoDB or delivered to client browsers.
  6. **Ephemeral Cleanup**: In a `finally` block, `sandbox.cleanup()` recursively executes `shutil.rmtree` on the workspace directory.

### Phase 6: Result Persistence & Terminal Delivery
- **Source Files**: [`handler.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/executor/tasks/handler.py#L257-L288), [`service.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/app/submissions/service.py#L289-L337), [`StudentWorkspace.tsx`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-FE/src/components/StudentWorkspace.tsx#L451-L485)
- **Actions**:
  1. Executor updates the MongoDB submission document:
     - `status`: `"COMPLETED"` (or `"FAILED"` if system error)
     - `verdict`: `"ACCEPTED"`, `"WRONG_ANSWER"`, etc.
     - `executionTimeMs`, `tests: { total, passed, failed }`
     - `testResults: [...]` (with hidden cases masked)
     - `completedAt: <ISO Timestamp>`
  2. Records activity metrics for student dashboards.
  3. Executor returns `HTTP 200 OK` to Google Cloud Tasks, acknowledging task completion.
  4. On the frontend's subsequent poll (`GET /api/v1/submissions/{id}`), it receives the `COMPLETED` payload.
  5. `isTerminalStatus(sub.status)` evaluates to `true`:
     - Polling stops.
     - Editor unlocks (`isRunning = false`).
     - If mode was `SUBMIT`, prepends the submission to the local history table.
     - Test results drawer opens, focusing on the first failing test case (if any).
     - Renders complete test cases breakdown (both visible sample test cases and hidden evaluation cases).
     - Displays explicit sentence feedback summarizing hidden test cases passed/failed (e.g. `X of Y hidden test cases passed (Z failed)`).
     - For hidden test cases, displays pass/fail result and execution status with a privacy notice, strictly omitting test case inputs, expected outputs, and execution stdout.

---

## 4. Architectural Invariants & Failure Guards

| Mechanism | Purpose | Implementation Detail |
|---|---|---|
| **Atomic Lease Lock** | Prevents duplicate execution | `find_one_and_update` on `{"status": "QUEUED"}` ensures only 1 worker claims a task. |
| **Lease Timeout Reclaim** | Prevents stuck submissions | If an executor crashes mid-execution, a lease older than `TASKS_EXECUTION_LEASE_SECONDS` is reclaimable. |
| **OIDC Task Verification** | Prevents unauthorized execution | Cloud Tasks Bearer tokens are cryptographically checked against Google's public certs. |
| **Sequential Polling Latch** | Protects API from client hammering | Client awaits HTTP response before calculating sleep duration ($\ge 5000\text{ms}$). |
| **Active Poll ID Guard** | Prevents race conditions | Switching questions or re-clicking Run invalidates previous poll tokens immediately. |
| **Sandbox Ephemeral Cleanup** | Prevents disk exhaustion on Cloud Run | Workspace directory is deleted inside a `finally` block regardless of pass, fail, or crash. |
| **Test Case Masking & DB Filtering** | Prevents cheating, test exposure & large I/O | Hidden test case inputs, actual outputs, and expected outputs are scrubbed at the executor boundary and sanitized at the MongoDB query level via `$map`. |

---

## 5. Primary Code References

| Layer | Responsibility | File Path |
|---|---|---|
| **Frontend UI** | Submit/Run buttons & Monaco editor | [`ZAP-FE/src/components/EditorPane.tsx`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-FE/src/components/EditorPane.tsx) |
| **Frontend Workspace** | Polling latch loop & verdict rendering | [`ZAP-FE/src/components/StudentWorkspace.tsx`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-FE/src/components/StudentWorkspace.tsx) |
| **Frontend API Client** | Submissions HTTP client & terminal check | [`ZAP-FE/src/services/submissionsApi.ts`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-FE/src/services/submissionsApi.ts) |
| **API Router** | `POST /submissions`, `GET /submissions/{id}` | [`ZAP-BE/app/submissions/router.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/app/submissions/router.py) |
| **Submission Service** | MongoDB document lifecycle & atomic claim | [`ZAP-BE/app/submissions/service.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/app/submissions/service.py) |
| **Task Queue** | Google Cloud Tasks producer | [`ZAP-BE/app/submissions/queue.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/app/submissions/queue.py) |
| **Executor Task Consumer** | OIDC validation & task claim handler | [`ZAP-BE/executor/tasks/handler.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/executor/tasks/handler.py) |
| **Judge Engine** | Test iteration, normalization, output diff | [`ZAP-BE/executor/judge/judge.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/executor/judge/judge.py) |
| **Execution Sandbox** | Ephemeral file isolation & process limits | [`ZAP-BE/executor/sandbox/sandbox.py`](file:///Users/apilav068@apac.comcast.com/zap/ZAP-BE/executor/sandbox/sandbox.py) |

---

## 6. Document Maintenance Guideline

Whenever modifying any of the following systems, **update this document accordingly**:
1. Changing polling frequency, retry limits, or backoff algorithms in `ZAP-FE`.
2. Adding new submission lifecycle states (e.g. `CANCELLED`, `RETRYING`).
3. Altering Google Cloud Tasks payload structure or authentication methods.
4. Modifying how `zap-executor` claims jobs, isolates processes, or structures test case verdicts.
5. Updating test case visibility rules or output masking logic.

