# Architecture Rules

> **Canonical Source**: This rule set is harmonized with [`context/02-architecture.md`](file:///Users/apilav068@apac.comcast.com/zap/context/02-architecture.md). Refer to `context/` for the complete system topology and invariants.

1. **Loose Coupling Boundary**:
   - The question/problem system contains metadata, hints, and test cases.
   - The compiler/execution engine accepts code, language ID, and test input payload only. It must NOT contain problem-specific domain logic or hardcoded question rules.

2. **Component Separation**:
   - `ZAP-FE`: Next.js + React + TypeScript web application for users and faculty.
   - `ZAP-BE`: FastAPI / Python service containing API endpoints, database schemas (MongoDB), and compiler worker pool execution.

3. **Incremental Execution**:
   - Build foundational APIs first (Auth, Question CRUD, Submissions, Execution sandbox) before implementing course/learning management extensions.

4. **Compiler Request Lifecycle Synchronization**:
   - The end-to-end request flow is specified in [`docs/architecture/compiler-request-lifecycle.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/architecture/compiler-request-lifecycle.md). Any modifications to submission endpoints, sequential polling latches, Cloud Tasks queues, atomic claim leases, or execution sandboxing must be kept up-to-date in that document.
