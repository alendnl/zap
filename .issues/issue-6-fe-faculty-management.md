# GitHub Issue Specification Template

## Issue Details
- **Issue ID / Title**: `[ISSUE-006] Faculty Question Management UI`
- **Type**: `Feature`
- **Target Subsystem**: `ZAP-FE`
- **Suggested Branch**: `feature/issue-006-fe-faculty-management`

## Problem Statement / Context
Implement the admin/faculty UI to manage questions. Faculty must be able to create, edit, archive, and publish questions, including managing public/hidden test cases, configuring execution limits, and optionally importing question definitions via JSON payloads.

## Architectural Constraints & Scope Boundary
- [x] Integrate with the `ZAP-BE` Question CRUD APIs defined in ISSUE-005.

## Detailed Acceptance Criteria
- [ ] Implement Question list dashboard for faculty.
- [ ] Implement Question Editor (fields for title, description, constraints, tags, difficulty).
- [ ] Implement Test Case manager (add/edit public and hidden test cases).
- [ ] Implement Execution limits configuration UI.
- [ ] Implement JSON import flow (paste JSON -> validate -> preview -> save).

## Implementation Tasks
- [ ] Create faculty routes in Next.js.
- [ ] Build forms using React Hook Form and Zod validation (matching backend schemas).
- [ ] Wire UI components to backend REST endpoints.

## Verification & Test Checklist
- [ ] Run `.agents/skills/build-issue/scripts/verify_build.sh` cleanly.
- [ ] Manual verification of JSON import and form submission flow.
