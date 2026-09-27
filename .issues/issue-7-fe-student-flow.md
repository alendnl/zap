# GitHub Issue Specification Template

## Issue Details
- **Issue ID / Title**: `[ISSUE-007] End-to-End Student Flow (Compiler Wiring)`
- **Type**: `Feature`
- **Target Subsystem**: `ZAP-FE`
- **Suggested Branch**: `feature/issue-007-fe-student-flow`

## Problem Statement / Context
Connect the ZAP-FE student workspace (created in ISSUE-004) to the actual ZAP-BE Compiler endpoints (created in ISSUE-001). Implement the "Run" and "Submit" flows, polling the backend for execution status, and displaying the results (Compilation success/error, Test Cases passed/failed, and Final Verdict).

## Architectural Constraints & Scope Boundary
- [x] Must handle polling or asynchronous updates for compiler status gracefully (do not block the UI).
- [x] Hidden test cases must never be exposed to the client in the response payload.

## Detailed Acceptance Criteria
- [ ] Implement API client to `POST /api/v1/submissions` on "Submit" click.
- [ ] Implement polling mechanism on `GET /api/v1/submissions/{submissionId}` while status is `QUEUED` or `RUNNING`.
- [ ] Display compilation output/errors.
- [ ] Display test results summary (passed vs failed) without exposing hidden inputs.
- [ ] Handle backend network errors or timeouts elegantly in the UI.

## Implementation Tasks
- [ ] Add Submission API integration to `ZAP-FE` services.
- [ ] Implement React hooks for polling execution status.
- [ ] Update `StudentWorkspace` UI to render dynamic states based on real API responses.

## Verification & Test Checklist
- [ ] Run `.agents/skills/build-issue/scripts/verify_build.sh` cleanly.
- [ ] Test the full End-to-End flow by submitting real Python/Java code against a mocked or running backend.
