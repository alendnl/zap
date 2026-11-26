# ZAP Architectural & Engineering Invariants

Read this reference before implementing changes across backend routes, MongoDB queries, submissions, contests, the code executor, frontend services, or infrastructure scaling.

---

## 1. Strict Loose Coupling (`ZAP-BE/app` vs `ZAP-BE/executor`)
- **Boundary**: Question management (`ZAP-BE/app/questions`) owns metadata, markdown statements, hints, starter templates, and test cases. The execution engine (`ZAP-BE/executor`) accepts only generic payloads: `sourceCode`, `language`, and `testCases` (`input`, `expectedOutput`, `visibility`).
- **Rule**: Keep `ZAP-BE/executor` completely domain-agnostic — never reference question IDs, problem-specific rules, user scores, or contest semantics inside `executor/`. This preserves reusability across practice problems, contests, and load tests.

## 2. Untrusted Code Isolation
- Student-submitted code is untrusted and must **never** execute inside the `zap-api` process.
- Route all execution through `zap-executor`, which compiles and runs code inside isolated ephemeral directories (`/tmp/zap/submissions/<id>/`) with explicit CPU/wall-clock timeouts and memory bounds, cleaning up temp artifacts immediately afterward.

## 3. Hidden Test Confidentiality & DB-Level Sanitization
- Test cases marked `visibility: "HIDDEN"` must never expose `input`, `expectedOutput`, `actualOutput`, or execution `error` traces to public/student API responses.
- Prefer **MongoDB-level projection/sanitization** (e.g., `$map` / `$cond` in `get_submission()`) rather than fetching huge raw test case arrays into Python and stripping them afterward, preventing unnecessary network and memory overhead.

## 4. Multi-Tenant Routing & Frontend Environment Policy
- **Backend (`ZAP-BE/app/config.py`)**: A single Cloud Run deployment serves both `production` (`zap_platform_prod`) and `qa` (`zap_platform_lower`) databases dynamically via the `X-ZAP-ENV` header, sharing the unified `zap-submissions` Cloud Tasks queue.
- **Frontend (`ZAP-FE/src/services/environment.ts`)**: All standard student, faculty, and admin pages strictly route to `"production"` (`ENABLE_QA_ENVIRONMENT = false`), while `/admin/load-test` explicitly targets `"qa"` (`zap_platform_lower`).
- **Rule**: Always route frontend HTTP calls through `src/services/` (`apiFetch`) rather than raw `fetch()` so `X-ZAP-ENV` headers, base URLs, and auth handling stay consistent.

## 5. Field Projections, On-Demand Drilldown & Pagination
- List and analytics endpoints (`questions`, `mcq_questions`, `submissions`, `contest_submissions`, `users`) must project out heavy blobs (`codingState`, `proctoring.violationsLog`, full testcase arrays, option explanations) and paginate (standard: 10 items per page).
- Fetch heavy candidate dossiers only on demand when inspecting an individual record, and avoid N+1 or unbounded MongoDB queries (always enforce `limit` / `$in` batching).

## 6. Polling Cadence & Execution Rate Limits
- Frontend submission polling (`StudentWorkspace.tsx`, `compilerApi.ts`) uses a **5-second sequential latch** (`Math.max(0, 5000 - callDuration)`), never overlapping `setInterval` timers, to prevent API hammering.
- Code execution (`RUN` + `SUBMIT` combined) is rate-limited to **4 attempts per minute** both preemptively in the client UI and authoritatively at the API gateway (`HTTP 429`). Preserve both layers when modifying submission flows.

## 7. Contest Scoring, Timeout Lockdown & Timing Metadata
- **Independent scoring**: Contest MCQ score (%) and each coding problem's test-pass score (%) remain independent, un-cumulated metrics.
- **Timeout auto-submission**: Client timeout locks controls immediately (`z-50` overlay) and triggers `isAutoSubmitted: true`; backend `submit_contest` coalesces incoming payloads with pre-synced MongoDB state and auto-finalizes expired `IN_PROGRESS` sessions.
- **Timing metadata**: `submittedAt` and `timeSpentSeconds` are additive fields propagated from client -> submissions -> activity/contests; keep defaults safe for older callers.

## 8. Backward Compatibility & Additive Schemas
- MongoDB schema updates must be additive (optional fields with safe defaults; avoid renaming/dropping live fields without a migration plan).
- API responses and config settings must preserve backward compatibility for existing frontend clients and tests.

## 9. Frontend UI, Config & TypeScript Standards
- **Strict typing**: Avoid `any`; define shared interfaces in `ZAP-FE/src/types/`.
- **Design tokens (`context/05-ui-context.md`)**: Dark-mode first (`globals.css` CSS variables), `Inter` for UI prose and `JetBrains Mono` for code/terminal views.
- **Configurable tabs**: Workbench navigation visibility is controlled centrally in `ZAP-FE/src/config/tabs.ts` (`TAB_CONFIG` + `NEXT_PUBLIC_ENABLE_TAB_*` env vars) with safe fallbacks.

## 10. Infrastructure & Dual Scaling Profiles
- Capacity presets live in `infra/profiles/normal.env` (scale-to-zero, `$0` idle) and `infra/profiles/contest.env` (pre-warmed high-concurrency), applied via `infra/scripts/switch-scaling.sh` and `.github/workflows/ci.yml`.
- Keep changes to Cloud Run / Cloud Tasks settings synchronized across profiles and CI rather than hardcoding ad-hoc overrides.
