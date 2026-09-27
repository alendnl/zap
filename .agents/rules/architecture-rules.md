# Architecture Rules

1. **Loose Coupling Boundary**:
   - The question/problem system contains metadata, hints, and test cases.
   - The compiler/execution engine accepts code, language ID, and test input payload only. It must NOT contain problem-specific domain logic or hardcoded question rules.

2. **Component Separation**:
   - `ZAP-FE`: Next.js + React + TypeScript web application for users and faculty.
   - `ZAP-BE`: FastAPI / Python service containing API endpoints, database schemas (MongoDB), and compiler worker pool execution.

3. **Incremental Execution**:
   - Build foundational APIs first (Auth, Question CRUD, Submissions, Execution sandbox) before implementing course/learning management extensions.
