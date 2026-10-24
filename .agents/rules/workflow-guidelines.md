# Development & Workflow Guidelines

1. **Prompt-to-Implementation Flow**:
   - Features, bug fixes, and refactoring tasks are received directly via user prompts.
   - Use the `build` skill to understand the requirement, gather context, clarify with options (only if absolutely essential), plan, execute, test, and document.

2. **Strict Verification Gate**:
   - Always verify changes before marking tasks complete:
     - Run backend tests: `.venv/bin/pytest -v` (or `.agents/skills/build/scripts/verify_build.sh`)
     - Run frontend builds: `npm run build --workspace=ZAP-FE`
   - Ensure zero regressions and zero broken imports.

3. **Loose Coupling & Separation of Concerns**:
   - Keep Question CRUD strictly independent from Compiler Execution.
   - The compiler must only process code execution requests and test cases without problem-specific domain logic.

4. **Capped Iterative Refinement**:
   - Limit automatic fix-and-retry loops to 2–3 attempts. If failures persist, halt and ask the user for guidance with clear context and diagnostic findings.
