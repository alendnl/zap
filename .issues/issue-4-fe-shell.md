# GitHub Issue Specification Template

## Issue Details
- **Issue ID / Title**: `[ISSUE-004] Frontend Shell & Monaco Editor`
- **Type**: `Feature`
- **Target Subsystem**: `ZAP-FE`
- **Suggested Branch**: `feature/issue-004-fe-shell`

## Problem Statement / Context
Initialize the ZAP-FE Next.js application with TypeScript, Tailwind CSS, and shadcn/ui. Create the core student page containing the Question pane and the Monaco Editor pane for code editing. This phase does not connect to the real backend compiler yet; it should use mocked submission states.

## Architectural Constraints & Scope Boundary
- [x] Must remain fully decoupled from backend compiler logic.

## Detailed Acceptance Criteria
- [ ] Initialize Next.js project with Tailwind CSS and shadcn/ui.
- [ ] Integrate Monaco Editor for code input.
- [ ] Implement UI layout for the student workspace (Question description pane + Code editor pane).
- [ ] Mock state management for "Run" and "Submit" buttons (simulate QUEUED -> RUNNING -> ACCEPTED transitions).

## Implementation Tasks
- [ ] Setup Next.js repository/directory.
- [ ] Configure Tailwind and install required shadcn/ui components.
- [ ] Build `StudentWorkspace` component.

## Verification & Test Checklist
- [ ] Run `.agents/skills/build-issue/scripts/verify_build.sh` cleanly.
- [ ] Verify UI layout responsiveness.
