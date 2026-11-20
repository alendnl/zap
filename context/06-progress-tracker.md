# 06. Progress Tracker & Decision Log: ZAP Platform

## 1. Development Roadmap & Phase Status

| Phase | Description | Status | Key Deliverables |
|---|---|---|---|
| **Phase 1: Foundation & Monorepo** | Core monorepo setup, basic FastAPI backend, Next.js frontend, MongoDB models, initial runners. | ✅ Completed | FastAPI REST API, basic Monaco editor, MongoDB connection. |
| **Phase 2: Compiler & Cloud Tasks** | Decoupled sandboxed executor, Google Cloud Tasks queue, multi-language auto-harness, hidden test masking. | ✅ Completed | `zap-executor`, Cloud Tasks worker, LeetCode auto-harness for 5 languages. |
| **Phase 3: Multi-Tenancy & Load Testing** | `X-ZAP-ENV` header routing, isolated QA database, headless Locust load testing suite, burst validation. | 🚀 Active | Locust suite (`load_test`), db sync scripts, dynamic header injection. |
| **Phase 4: Platform Polish & Contest Engine** | Timed contest modes, interview live-pairing, faculty analytics dashboard, contest leaderboards. | ⏳ Planned | WebSockets / Live pairing, contest scoring engine, batch user invites. |

---

## 2. Completed Milestones Breakdown

- [x] **Monorepo Architecture**: Clean separation between `ZAP-BE` (FastAPI + Executor) and `ZAP-FE` (Next.js 15).
- [x] **Sandboxed Language Runners**:
  - Python 3.14 runner with resource limits.
  - Node.js (JavaScript) runner with V8 execution.
  - Java 21 runner with single-source execution.
  - C++23 runner with GCC `-O2 -std=c++23`.
  - C runner with GCC `-O2`.
- [x] **Automated Harness Generator**: Auto-generates drivers, parses JSON/array inputs, and handles standard I/O formatters.
- [x] **Asynchronous Execution Pipeline**: Google Cloud Tasks (`zap-submissions`) to prevent HTTP request timeouts during complex evaluations.
- [x] **Dynamic Multi-Tenant Environment Routing**: Single deployment on GCP Cloud Run supporting `production` and `qa` via `X-ZAP-ENV` header.
- [x] **Student Coding Arena**: Monaco editor with language switcher, split-screen layout, Run/Submit workflows, and real-time output terminal.
- [x] **Faculty Question Management**: CRUD operations for questions, starter templates, and test cases with visibility toggling (`PUBLIC` vs `HIDDEN`).
- [x] **Admin Question Management Console**: Dedicated `/admin/questions` portal with admin authentication gating, full question CRUD (create, update, delete), live search, multi-filter, test cases editor, starter code management, and JSON import/export.
- [x] **MCQ Question Subsystem & Admin Portal**: Dedicated MongoDB collection `mcq_questions` with 10 curated seed questions (DSA, DBMS, Networks, OOPS), FastAPI CRUD endpoints (`/api/v1/mcq/questions`), and full-featured Admin MCQ Manager portal at `/admin/mcq` with rich support for text, code snippet, and diagram image questions and options.
- [x] **Contest Engine & Anti-Cheat Proctoring**: Dedicated timed assessment environment with isolated contest sessions, auto-sync, client proctoring guards (fullscreen enforcement, clipboard copy/paste interception, tab switch detection), and isolated submission pipeline.
- [x] **Contest Timeout Auto-Submission & Control Locking**: Guaranteed assessment auto-submission upon duration timeout, immediate locking of all candidate inputs (full-screen blocking modal, disabled MCQ/coding controls), server-side evaluation coalescing existing synced database state, and automatic finalization of expired sessions across session resumption, delta sync, and admin analytics queries.
- [x] **Contest Submissions Analytics Dashboard**: Executive telemetry dashboard at `/admin/contests/analytics` featuring cohort metrics (completion rate, score distribution histogram, MCQ accuracy, coding acceptance), proctoring infraction analytics, candidate submissions leaderboard, and individual candidate inspection modal with chronological proctoring violation timeline and full source code viewer.
- [x] **Unified Cloud & Repository Operations Skill (`project-operations`)**: Dedicated operational agent skill and zero-setup CLI tool (`zap-ops`) unifying MongoDB Atlas queries/schema inspection/aggregations/writes/backups, GCP Cloud Run/Tasks/Logs/Scaling management, and Git/GitHub CI/CD monitoring with cross-system intelligence and production safety guardrails. (Superseded `cloud-ops`).
- [x] **In-Browser Admin Load Testing Studio (`/admin/load-test`)**: Replaced unmaintainable local CLI load testing scripts with a full-featured, zero-setup in-browser load testing studio. Features dual target subsystems (ZAP API & ZAP Executor), configurable concurrency, linear vs instant spike ramp-up schedules, multi-language compiler stress (C++, Java, Python, C, JavaScript) across Light/Medium/Heavy workloads, live telemetry streaming, response time percentiles (p50, p75, p90, p95, p99), historical run recording in `zap_platform_lower`, and strict environment isolation with an automated lower DB synthetic data cleanup modal.
- [x] **Universal Full Test Case Breakdown & DB-Level Sanitization**: In SUBMIT mode, all test cases (both public and hidden) are evaluated and returned in `testResults`. Hidden test case data (`input`, `expectedOutput`, `actualOutput`, `error`) is sanitized at the MongoDB query level via `$map`/`$cond` projection to avoid heavy I/O network transfers. In the frontend (`StudentWorkspace`), both practice and contest areas display all test case tabs (with hidden lock badges), clear sentence feedback on hidden test pass/fail counts, and privacy lock notices that protect confidential evaluation data while delivering full transparency.

---

## 3. Active Work & Current Focus Areas

- [ ] **Load Testing Verification**: Run burst scenarios (`burst_worst_case` and `ramp_up_realistic`) to verify Cloud Run auto-scaling latency under load.
- [ ] **Test Case Authoring UX Improvements**: Enhance faculty form for bulk importing LeetCode-format test cases.
- [ ] **Submission History & Diff Viewer**: Allow candidates to view previous submission code and visual diffs against failing test cases.

---

## 4. Architectural Decision Records (ADR Log)

### ADR-001: Strict Separation of Question Management and Sandboxed Executor
- **Status**: Accepted
- **Context**: Tightly coupling problem metadata with execution leads to brittle compilers and security risks.
- **Decision**: Keep `ZAP-BE/app` (Question CRUD, DB) strictly decoupled from `ZAP-BE/executor` (domain-agnostic compiler engine).
- **Consequences**: Executor is reusable across contests, homework, and playgrounds with zero domain leak.

### ADR-002: Dynamic Multi-Tenant Routing via `X-ZAP-ENV` Header
- **Status**: Accepted
- **Context**: Deploying duplicate GCP Cloud Run instances for staging/QA doubles idle cost and operational overhead.
- **Decision**: Use a single GCP Cloud Run deployment. Direct requests dynamically to `zap_platform_prod` vs `zap_platform_lower` based on the `X-ZAP-ENV` header.
- **Consequences**: Cuts cloud costs in half while providing isolated QA testing.

### ADR-003: Serverless Scale-to-Zero on GCP Cloud Run + Cloud Tasks
- **Status**: Accepted
- **Context**: Coding platforms experience extreme burstiness (coding contests, homework deadlines) followed by prolonged idle periods.
- **Decision**: Deploy both `zap-api` and `zap-executor` as autoscaling Cloud Run services behind Google Cloud Tasks.
- **Consequences**: Zero compute spend when idle; elastic scaling up to 100+ concurrent executions during spikes.

### ADR-004: LeetCode-Style Auto-Harness and Hidden Test Masking
- **Status**: Accepted
- **Context**: Candidates should write focused algorithmic methods rather than manual stdin parsing, while hidden tests must remain secret.
- **Decision**: Compiler synthesizes language-specific harness files at execution time. API strips hidden test inputs/outputs before returning results to students.
- **Consequences**: Clean user experience and tamper-proof evaluation.

### ADR-005: Adoption of the Six-File Context Methodology
- **Status**: Accepted
- **Context**: Scattered documentation and prompt drift degrade AI agent effectiveness over time.
- **Decision**: Consolidate all core context into 6 canonical files in `context/`, while keeping `.agents/rules/` and `AGENTS.md` synchronized as direct harness bridges.
- **Consequences**: Standardized context architecture compatible with Antigravity IDE, Cursor, Claude Code, and human engineers with zero breakage.

### ADR-006: Unified Cloud & Repository Operations Skill (`project-operations`)
- **Status**: Accepted (Supersedes legacy `cloud-ops`)
- **Context**: Managing, troubleshooting, and querying MongoDB Atlas, GCP Cloud Run/Tasks/Logs, and GitHub CI/CD required disparate ad-hoc scripts with risks of accidental mutation on production.
- **Decision**: Implement the unified `project-operations` agent skill with a dedicated, safe CLI tool (`zap-ops`) providing multi-system diagnostic health checks, read-only defaults, production write guardrails, one-way sync to QA, log inspection, full aggregation/export capabilities, scaling management, deployment sync verification, and cross-system root cause troubleshooting.
- **Consequences**: Instant operational visibility and safe developer troubleshooting across cloud infrastructure with cross-system synthesis and zero accidental production blast radius.

### ADR-007: Independent Percentage Scoring for Contest MCQs and Coding Problems
- **Status**: Accepted
- **Context**: In previous versions, coding problems were awarded flat placeholder points (e.g. 10 pts each) without verifying test case pass rates, and MCQ denominators only counted attempted questions, artificially skewing student scores. Combining raw points into a single composite total also obscured candidate strengths.
- **Decision**:
  1. Evaluate contest MCQs against the full question count (`unattempted = 0%`, `incorrect = 0%`, `correct = proportional %`), producing a clean, separate MCQ section percentage mark.
  2. Evaluate each coding problem independently in percentage based on test cases passed `(passed / total) * 100` (`unattempted = 0%`, `0 tests passed / error = 0%`, `partial tests passed = proportional %`, `all tests passed = 100%`).
  3. Keep MCQ and individual coding problem percentages distinct and un-cumulated on scorecards and analytics drilldowns for transparent candidate evaluation.
- **Consequences**: Accurate, fair assessment reporting with zero phantom marks.

### ADR-008: Configurable Navigation Tabs Architecture
- **Status**: Accepted
- **Context**: Different operational scenarios require toggling specific navigation areas (e.g. DSA problems, basic concepts, compiler, contests) without removing the underlying views or logic.
- **Decision**: Centralize workbench navigation tab configuration in `ZAP-FE/src/config/tabs.ts` (`TAB_CONFIG`) with simple boolean flags (`enabled: boolean`) and optional environment variable overrides (`NEXT_PUBLIC_ENABLE_TAB_*`). Tabs default safely to the first enabled tab, URL parameters for disabled tabs gracefully fallback, and DSA problems tab is disabled by default while retaining full underlying code.
- **Consequences**: Zero code deletion, instant one-line toggle to enable/disable any tab, and robust fallback handling.

### ADR-009: Strict Field Projections, On-Demand Candidate Drilldown, and 10-Item Pagination
- **Status**: Accepted
- **Context**: The `contest_submissions` collection grew beyond 21 MB after a major contest. Full-document scans (including heavy `codingState` source code across 5 languages, compiler logs, and proctoring violation logs) caused severe memory pressure, payload bloat, and API timeouts across dashboards and question banks.
- **Decision**:
  1. **Minimal Database Projections**: Omit heavy fields (`codingState`, `proctoring.violationsLog`, testcase payloads, option explanations) from list and analytics queries across `contest_submissions`, `questions`, `mcq_questions`, `submissions`, and `users`.
  2. **On-Demand Candidate Dossier Fetching**: Fetch full source code, test execution outputs, and proctoring logs only when an administrator inspects an individual student via `GET /api/v1/contests/{contest_id_or_slug}/submissions/{student_id_or_sub_id}`.
  3. **10-per-Page Pagination**: Standardize 10-item pagination with clean navigation controls across Student Home catalog, Admin Users, Contest Analytics, Admin Coding Questions, Admin MCQs, Faculty Questions, and Contest Directories.
- **Consequences**: Main analytics payloads reduced by >98% (<25 KB), zero API timeouts, responsive UI rendering, and scalable to large candidate cohorts.

### ADR-010: 5-Second Polling Cadence and 4 Attempt/Minute Execution Guardrail
- **Status**: Accepted
- **Context**: Polling submission status at 1-second intervals caused unnecessary database and API load under concurrent usage. Additionally, users could spam execution runs without rate throttling.
- **Decision**:
  1. Increase the sequential polling interval in `StudentWorkspace.tsx` and `compilerApi.ts` from 1 second to 5 seconds (`Math.max(0, 5000 - callDuration)`), while maintaining the anti-hammering sequential latch.
  2. Enforce a combined 4-attempt per minute rate limit across both code execution (`mode: "RUN"`) and solution submission (`mode: "SUBMIT"`).
  3. Pre-emptively block the 5th attempt on the client and cut off requests at the API gateway with HTTP 429 (`"Too many attempts, please wait for one minute or try after one minute."`), ensuring untrusted code is never queued or executed on the server beyond 4 attempts per minute.
  4. Display an amber warning banner across the editor, workspace header, and console drawer alerting the user.
- **Consequences**: API polling load decreased by ~80%, server compute protected from spam, and clear user warnings on excess submission frequency.

### ADR-011: Contest Timeout Auto-Submission, Immediate Control Lockdown, and Backend State Coalescence
- **Status**: Accepted
- **Context**: In timed assessments, when contest duration expires, candidates could potentially continue interacting with the arena or encounter state loss if the client submitted an un-hydrated payload. Furthermore, expired sessions left in `IN_PROGRESS` distorted cohort completion rates and delayed scorecard generation.
- **Decision**:
  1. **Dual-Trigger Auto-Submission**: Calculate remaining time via client wall-clock elapsed time (`(Date.now() - startedAtMs) >= durationMinutes * 60`). When timer expires, immediately trigger `handleAutoSubmit()` with `isAutoSubmitted: true`.
  2. **Immediate Control Lockdown**: Upon timeout, display a high-z-index (`z-50`), non-dismissible full-screen blocking overlay informing the candidate that the contest time has expired and the assessment is being calculated and submitted. Disable all interactive controls: MCQ option buttons, clear choice, review toggle, and the bottom bar action button.
  3. **Backend Synced State Coalescence**: In `submit_contest`, coalesce the incoming request payload with the existing document in MongoDB (`existing_doc`). If any MCQ answers or coding problem states were previously synced to the backend but omitted or empty in the submission payload, preserve the backend's synced state. Fetch latest compiler evaluation runs via `sub_service.list_submissions` if submission references are missing.
  4. **Automatic Server-Side Finalization**: Implement `_auto_submit_session` and `_auto_finalize_expired_sessions`. Expired `IN_PROGRESS` sessions are automatically evaluated against synced database state and transitioned to `SUBMITTED` with `isAutoSubmitted=True` when candidates re-enter (`start_contest_session`), during periodic delta sync (`sync_contest_session`), and during administrator queries (`get_contest_submissions` / `get_contest_analytics`).
- **Consequences**: Zero candidate work lost on timeout, tamper-proof control locking, accurate cohort completion analytics, and fair scoring calculated strictly from pre-synced backend data.

### ADR-012: DB-Level Sanitization and Complete Test Breakdown for Hidden Evaluation Cases
- **Status**: Accepted
- **Context**: In SUBMIT mode, candidates previously only saw 2 sample test cases because hidden test cases were filtered out entirely to protect evaluation confidentiality. Large test case payloads (e.g. 1 MB+) could also saturate network and memory if fetched and stripped at the application layer.
- **Decision**:
  1. In `get_submission()`, MongoDB executes an aggregation pipeline with `$map` and `$cond` to project only `id`, `visibility: "HIDDEN"`, `passed`, `status`, and `executionTimeMs` for hidden test cases directly in the database engine, omitting heavy inputs, expected outputs, actual outputs, and execution errors.
  2. The frontend workspace across all code editors (practice and contest arena) renders all test case results with passed/failed badges, provides human-readable sentence feedback on hidden test pass/fail counts (e.g. `X of Y hidden test cases passed (Z failed)`), and displays privacy notices on hidden test cases to protect test case integrity.
- **Consequences**: Candidates get complete visibility into all evaluation test cases without exposing confidential test data or imposing heavy database-to-API network overhead.

### ADR-013: Submission Timing and Time Spent Tracking Across Coding Runs and Submissions
- **Status**: Accepted
- **Context**: Submissions previously only persisted a server-side `createdAt` timestamp when queued. There was no explicit tracking of exact client dispatch time (`submittedAt`) or duration spent on writing code/solving a problem (`timeSpentSeconds`) prior to running or submitting code.
- **Decision**:
  1. Add `submittedAt` (ISO string timestamp) and `timeSpentSeconds` (integer duration in seconds) to `SubmissionCreateRequest`, `Submission`, and `SubmissionSummary` in `ZAP-BE`. Default `submittedAt` to `createdAt` / current UTC time if not provided by client.
  2. Maintain `problemOpenedAtRef` in `StudentWorkspace.tsx` to accurately calculate elapsed seconds from opening a problem to executing code.
  3. Propagate `submittedAt` and `timeSpentSeconds` through Cloud Tasks enqueuing, MongoDB persistence, `list_submissions` projections, `UserActivity` recent submission briefs, and contest `CodingDelta` / `CodingProblemState`.
  4. Render both the submission time and formatted time taken in the workspace submission history and submission details modal.
- **Consequences**: Accurate historical and analytical insight into candidate problem completion times and submission moments across practice problems and contests without breaking backward compatibility.






