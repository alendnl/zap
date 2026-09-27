# GitHub Issue Specification Template

## Issue Details
- **Issue ID / Title**: `[ISSUE-005] Backend Foundation & Question CRUD`
- **Type**: `Feature`
- **Target Subsystem**: `ZAP-BE`
- **Suggested Branch**: `feature/issue-005-be-foundation-crud`

## Problem Statement / Context
Initialize the ZAP-BE FastAPI project and establish the core MongoDB connection. Implement the data models for Users, Faculty, and Questions based on the Low-Level Design schema. Build the core Question CRUD APIs required to support the faculty question management UI.

## Architectural Constraints & Scope Boundary
- [x] Question API must remain separate from compiler execution logic.
- [x] Follow schema shapes defined in `docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md`.

## Detailed Acceptance Criteria
- [ ] Initialize FastAPI project with dependency injection for MongoDB.
- [ ] Create MongoDB connection utilities.
- [ ] Implement Question Model (including test cases array, limits, etc.).
- [ ] Implement REST endpoints: `GET /questions`, `GET /questions/{id}`, `POST /questions`, `PUT /questions/{id}`, `DELETE /questions/{id}`.
- [ ] Implement basic payload validation.

## Implementation Tasks
- [ ] Setup FastAPI directory structure (`app/api`, `app/db`, `app/questions`).
- [ ] Configure environment variables for MongoDB URI.
- [ ] Write integration tests for Question CRUD operations.

## Verification & Test Checklist
- [ ] Unit / Integration test added for all CRUD operations.
- [ ] Run `.agents/skills/build-issue/scripts/verify_build.sh` cleanly.
