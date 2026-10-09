# GitHub Issue Specification

## Issue Details
- **Issue ID / Title**: `[ISSUE-009] Python Template Clean-up & C Language Compiler Support`
- **Type**: `Feature`
- **Target Subsystem**: `ZAP-BE`, `ZAP-FE`, `Compiler`
- **Suggested Branch**: `feature/issue-009-c-language-and-python-cleanup`

## Problem Statement / Context
1. In Python starter code templates, the `pass` keyword was explicitly placed. The user requested removing `pass` from the Python template code so it only shows `# Write your solution here`. The Python harness must be updated to ensure that if a student runs an empty function body, the harness handles it gracefully without a fatal `IndentationError`.
2. The platform currently supports Python, Java, C++, and Node.js. The user requested adding C programming language support across the entire stack:
   - Compiler/Runner for C (using `gcc` or `clang` with `-O2`)
   - Driver harness for C
   - Supported languages list in models and APIs
   - Language selector and Monaco editor syntax support in frontend
   - Starter code templates for C across all published questions

## Architectural Constraints & Scope Boundary
- [x] Preserves loose coupling between Question CRUD and Compiler Engine.
- [x] Standard C (C11/C17) compilation and execution using standard tooling.
- [x] Backwards-compatible: user-defined standard `main()` scripts run unmodified.

## Detailed Acceptance Criteria
- [ ] Remove `pass` from `DEFAULT_STARTER_CODE["python"]` in `ZAP-BE` and `ZAP-FE`.
- [ ] Update `_prepare_python_harness` to inject a fallback `pass` if the function body is empty, preventing `IndentationError`.
- [ ] Create `CRunner` in `ZAP-BE/executor/languages/c/runner.py`.
- [ ] Register `c` in `ZAP-BE/executor/languages/__init__.py`.
- [ ] Implement `_prepare_c_harness` in `ZAP-BE/executor/core/harness.py`.
- [ ] Add `"c"` to supported languages in `app/questions/models.py`.
- [ ] Add `"c"` to `StudentWorkspace.tsx` language dropdown, editor syntax mappings, and default templates.
- [ ] Update published questions in database with C starter code and cleaned Python starter code.
- [ ] Unit tests in `tests/test_runners.py` and `tests/test_harness.py` for C compilation and execution.
