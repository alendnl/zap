# GitHub Issue Specification Template

## Issue Details
- **Issue ID / Title**: `[ISSUE-002] Compiler Language Runners & Sandbox Foundation`
- **Type**: `Feature`
- **Target Subsystem**: `Compiler Sandbox`
- **Suggested Branch**: `feature/issue-002-compiler-runners-sandbox`

## Problem Statement / Context
Implement the language-specific execution runners (Java, Python, C++, Node.js) and the foundational security sandbox environment to isolate student code execution. The sandbox must enforce resource constraints (CPU, Memory, Time) and security restrictions (no network, non-root, ephemeral filesystem).

## Architectural Constraints & Scope Boundary
- [x] Preserves loose coupling between Question CRUD and Compiler Engine.
- [x] Aligns with design specs in `docs/01-ZAP-PROJECT-CONTEXT.md` and `docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md`.

## Detailed Acceptance Criteria
- [ ] Define the `LanguageRunner` interface/protocol.
- [ ] Implement adapters for Java (21), Python (3.14.2), C++ (23), and Node.js (22.8.0).
- [ ] Implement Sandbox abstraction that prepares temporary workspace (`/work/submissions/<id>/...`) and enforces security restrictions.
- [ ] Implement compilation step (compile once) for compiled languages (Java, C++).
- [ ] Sandbox must ensure non-root execution, restricted network, and limited resource execution.

## Implementation Tasks
- [ ] Create `ZAP-BE/executor/core/` and `ZAP-BE/executor/sandbox/` structures.
- [ ] Implement language adapter classes in `ZAP-BE/executor/languages/`.
- [ ] Define Dockerfiles for the execution environments in `ZAP-BE/executor/Dockerfiles/`.
- [ ] Write unit tests for language adapters simulating success and compilation/runtime failures.

## Verification & Test Checklist
- [ ] Unit / Integration test added.
- [ ] Run `.agents/skills/build-issue/scripts/verify_build.sh` cleanly.
- [ ] Adversarial tests pass (infinite loop, memory abuse, file access).
