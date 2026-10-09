# GitHub Issue Specification

## Issue Details
- **Issue ID / Title**: `[ISSUE-010] Student Submission History, Per-Language Code Persistence, and Problem Completion Status`
- **Type**: `Feature`
- **Target Subsystem**: `ZAP-BE`, `ZAP-FE`
- **Suggested Branch**: `feature/issue-010-student-submissions-history-and-completion`

## Problem Statement / Context
1. When a student submits code, that problem should be marked as completed if accepted.
2. In the student workspace, a Submissions tab should display all past submissions for that problem (timestamp, verdict, runtime, language, tests passed).
3. If the user submits code in a language, reopening that question should restore their latest submitted code in the editor for that language.
4. If the user submits in multiple languages (e.g. Python and C), all are listed in the Submissions tab, and switching languages restores the respective submitted code.
5. Re-submitting code records a new submission and updates the history tab.

## Architectural Constraints & Scope Boundary
- [x] Submissions filtered by `userId` and `questionId`.
- [x] State synchronized between MongoDB backend and client workspace.

## Detailed Acceptance Criteria
- [ ] Add `GET /api/v1/submissions?userId=...&questionId=...` endpoint to `ZAP-BE/app/submissions/router.py` and service.
- [ ] Add `submissionsApi.listByQuestion(questionId, userId)` in `ZAP-FE/src/services/submissionsApi.ts`.
- [ ] Add Submissions tab in `StudentWorkspace.tsx` alongside Test Cases/Results.
- [ ] Auto-load latest submitted code per language into Monaco editor when opening a question or switching languages.
- [ ] Display "Completed" / "Solved" badge on problem catalog cards when user has an ACCEPTED submission.
- [ ] Add unit tests for submissions querying in backend and frontend.
