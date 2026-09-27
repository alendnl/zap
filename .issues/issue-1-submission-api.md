# GitHub Issue Specification Template

## Issue Details
- **Issue ID / Title**: `[ISSUE-001] Compiler Submission API & Models`
- **Type**: `Feature`
- **Target Subsystem**: `ZAP-BE`
- **Suggested Branch**: `feature/issue-001-compiler-submission-api`

## Problem Statement / Context
Create the core foundation for the ZAP compiler execution in the backend. This includes setting up the Submission database models, state enums (QUEUED, RUNNING, ACCEPTED, etc.), and the REST API endpoints to accept submission requests and check their status. Execution will be handed off to a queue mechanism (which can be mocked initially).

## Architectural Constraints & Scope Boundary
- [x] Preserves loose coupling between Question CRUD and Compiler Engine.
- [x] Aligns with design specs in `docs/01-ZAP-PROJECT-CONTEXT.md` and `docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md`.

## Detailed Acceptance Criteria
- [ ] Implement Submission MongoDB document schema based on `docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md`.
- [ ] Implement finite state machine states for submission status (QUEUED, RUNNING, etc.).
- [ ] Implement `POST /api/v1/submissions` endpoint that accepts submission payload, creates a DB record with status QUEUED, and returns `submissionId`.
- [ ] Implement `GET /api/v1/submissions/{submissionId}` endpoint to fetch submission status and details.
- [ ] Ensure API does not wait for execution to complete (asynchronous execution design).

## Implementation Tasks
- [ ] Create `Submission` model in `ZAP-BE/app/submissions/models.py`.
- [ ] Create API routes in `ZAP-BE/app/submissions/router.py`.
- [ ] Add basic unit tests for the endpoints.

## Verification & Test Checklist
- [ ] Unit / Integration test added for API endpoints and model validation.
- [ ] Run `.agents/skills/build-issue/scripts/verify_build.sh` cleanly.
