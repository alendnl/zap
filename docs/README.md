# ZAP Project Documentation

This folder is the implementation handoff for the ZAP platform.

ZAP is a DSA and technical-interview preparation platform. The first major product capability is an online coding environment with a reusable problem/question system and a scalable code-execution engine.

## Documents

1. `01-ZAP-PROJECT-CONTEXT.md`
   - Centralized product and technology decisions.
   - Scope, repositories, data model direction, deployment, and future growth.

2. `02-ZAP-COMPILER-ARCHITECTURE.md`
   - Compiler/execution subsystem only.
   - High-level and low-level architecture diagrams.
   - Submission lifecycle, scaling, sandboxing, testing, and failure handling.

3. `03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md`
   - API contracts, MongoDB question/submission models, execution states, worker behaviour, resource limits, and security requirements.

4. `04-ZAP-FUTURE-PLATFORM-ARCHITECTURE.md`
   - Overall future ZAP platform direction.
   - Courses, assessments, progress, faculty/admin, analytics, and reusable questions.

5. `05-ZAP-IMPLEMENTATION-PLAN.md`
   - Practical phased build plan for another AI/developer.
   - Build the smallest correct system first; do not introduce unnecessary infrastructure.

## Core implementation rule

The **question system and compiler/execution system must be loosely coupled**.

A question contains problem metadata and test cases. The compiler service only receives an execution request and runs code according to the request. It must not contain question-specific logic.

## Initial repositories

```text
ZAP-FE    -> Next.js + React + TypeScript frontend
ZAP-BE    -> FastAPI/Python backend + compiler/executor code
```

Keep the executor as a separate deployable service inside `ZAP-BE` initially. A separate repository is not required at the start.

## Important scope boundary

Do not build the full future course platform during the first compiler release.

Build the reusable foundations now:

- authentication/authorization structure
- question model
- question CRUD
- test-case model
- submission model
- compiler/execution API
- faculty/admin question management
- CI/CD
- observability hooks

Then add course and learning features incrementally.

