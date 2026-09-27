# GitHub Issue Specification Template

## Issue Details
- **Issue ID / Title**: `[ISSUE-003] Compiler Judge Engine & Queue Worker`
- **Type**: `Feature`
- **Target Subsystem**: `Compiler Sandbox / ZAP-BE`
- **Suggested Branch**: `feature/issue-003-compiler-judge-worker`

## Problem Statement / Context
Implement the Judge engine that orchestrates the execution of test cases and compares the actual output with expected output to produce a final verdict (ACCEPTED, WRONG_ANSWER, etc.). Connect the Execution Worker to a Queue mechanism to process submission jobs asynchronously and update the Submission record in the database upon completion.

## Architectural Constraints & Scope Boundary
- [x] Preserves loose coupling between Question CRUD and Compiler Engine.
- [x] Aligns with design specs in `docs/01-ZAP-PROJECT-CONTEXT.md` and `docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md`.

## Detailed Acceptance Criteria
- [ ] Implement Judge Engine to run all enabled test cases for a submission.
- [ ] Implement output comparison logic (exact match initially).
- [ ] Implement Fail-Fast policy (stop testing on first failure/compile error).
- [ ] Implement Queue consumer/worker that pulls `Submission` jobs.
- [ ] Worker updates the Submission status in MongoDB to `RUNNING` on start, and updates to the final verdict/metrics upon completion.
- [ ] Worker performs proper cleanup of the sandbox directory after processing.

## Implementation Tasks
- [ ] Implement `JudgeEngine` in `ZAP-BE/executor/judge/`.
- [ ] Implement Queue polling/processing logic in `ZAP-BE/executor/worker/`.
- [ ] Wire the backend API queue push with the worker queue pull.
- [ ] Add integration tests for end-to-end execution flow.

## Verification & Test Checklist
- [ ] Unit / Integration test added for Judge engine.
- [ ] Run `.agents/skills/build-issue/scripts/verify_build.sh` cleanly.
