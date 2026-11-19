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
- [x] **Contest Submissions Analytics Dashboard**: Executive telemetry dashboard at `/admin/contests/analytics` featuring cohort metrics (completion rate, score distribution histogram, MCQ accuracy, coding acceptance), proctoring infraction analytics, candidate submissions leaderboard, and individual candidate inspection modal with chronological proctoring violation timeline and full source code viewer.
- [x] **Cloud & Database Operations Skill (`cloud-ops`)**: Dedicated operational agent skill and zero-setup CLI tool (`zap-ops`) unifying MongoDB Atlas queries/schema inspection, GCP Cloud Run/Tasks/Logs management, and GitHub CI/CD monitoring with strict production safety guardrails.
- [x] **In-Browser Admin Load Testing Studio (`/admin/load-test`)**: Replaced unmaintainable local CLI load testing scripts with a full-featured, zero-setup in-browser load testing studio. Features dual target subsystems (ZAP API & ZAP Executor), configurable concurrency, linear vs instant spike ramp-up schedules, multi-language compiler stress (C++, Java, Python, C, JavaScript) across Light/Medium/Heavy workloads, live telemetry streaming, response time percentiles (p50, p75, p90, p95, p99), historical run recording in `zap_platform_lower`, and strict environment isolation with an automated lower DB synthetic data cleanup modal.

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

### ADR-006: Dedicated Cloud & Database Operational Agent Skill (`cloud-ops`)
- **Status**: Accepted
- **Context**: Managing, troubleshooting, and querying MongoDB Atlas, GCP Cloud Run/Tasks/Logs, and GitHub CI/CD required disparate ad-hoc scripts with risks of accidental mutation on production.
- **Decision**: Implement the `cloud-ops` agent skill with a dedicated, safe CLI tool (`zap-ops`) providing unified diagnostic health checks, read-only defaults, production write guardrails, one-way sync to QA, and log inspection.
- **Consequences**: Instant operational visibility and safe developer troubleshooting across cloud infrastructure with zero accidental production blast radius.

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




