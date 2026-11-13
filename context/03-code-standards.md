# 03. Code Standards & Engineering Guidelines: ZAP Platform

## 1. Core Engineering Meta-Principle
> **Reduce the cost of being wrong. Reduce the cognitive load of being right.**  
> When engineering principles conflict, use this as the primary tiebreaker.

---

## 2. Defensive Engineering Principles (Reduce Cost of Being Wrong)

### 2.1 Fail Fast, Recover Gracefully
- Never swallow exceptions or use silent fallbacks (`or {}`, empty `except: pass`, empty `catch {}`).
- Validate inputs strictly at system boundaries (HTTP request headers, query parameters, request bodies).
- Error messages must be actionable: explain *what failed*, *why it failed*, and *how the caller can correct it*.
- Separate detection (failing fast at the gateway/boundary) from handling (graceful state recovery).

### 2.2 Zero-Trust at Boundaries
- Treat all external and upstream data as untrusted until validated through Pydantic (Backend) or Zod / TypeScript (Frontend).
- Use parameterized queries or ORM/ODM abstractions to prevent injection attacks (MongoDB injection, command injection, XSS).
- Never hardcode secrets, API keys, or database credentials. Access credentials through environment variables or GCP Secret Manager.
- Enforce size bounds and payload limits on code submissions and custom test inputs.

### 2.3 Backward Compatibility by Default
- Schema changes in MongoDB must be additive (add optional fields with sensible defaults, never rename or drop fields without a migration strategy).
- API changes must preserve backward compatibility for existing frontend clients and automated runners.
- Breaking changes require explicit deprecation periods and phased rollout.

### 2.4 Chesterton’s Fence & Root Cause Discipline
- Never remove, disable, or alter existing code or tests without understanding *why* it was introduced in the first place.
- Do not refactor unrelated code unless it is demonstrably broken or directly blocks the immediate task.
- When resolving bugs, investigate root causes (*"why was this system state reachable?"*) rather than patching superficial symptoms.

### 2.5 Trace Second-Order Effects
- Modifying component A impacts consumer B; consumer B affects downstream data stores C and D.
- Inspect all callers, consumers, tests, and configuration schemas before altering interfaces or shared contracts.

---

## 3. Clarity & Maintainability Principles (Reduce Cognitive Load)

### 3.1 Simplicity over Cleverness (Principle of Least Astonishment)
- Prefer clean, self-explanatory code over dense one-liners.
- Favor explicit variable naming and early guard-clause returns over deeply nested branching.
- Comments must explain **why** (rationale, business constraints, edge cases), never **what** (the code already expresses what).

### 3.2 Convention over Configuration
- Follow established project conventions consistently across the monorepo.
- Make the easiest, most natural path the correct and safe path.

### 3.3 Pit of Success
- Design service interfaces and function signatures so that standard usage is automatically correct and secure.
- Encapsulate internal lifecycle details inside services; consumers should not need to understand internal plumbing.

### 3.4 Avoid Premature Abstraction
- Adhere to the **Rule of Three**: do not extract an abstraction until you have three concrete, verified use cases.
- One interface with one implementation is unnecessary indirection, not good abstraction. Keep it simple (YAGNI).

### 3.5 Complete Observability
- Emit structured logs with operation names, submission IDs, and environment tags (`production` vs `qa`).
- Avoid flooding `DEBUG` logs with large binary/source payloads or starving `INFO`/`ERROR` logs on critical paths.
- Ensure all background worker failures and sandbox timeouts log structured diagnostics for debugging.

---

## 4. Stack-Specific Guidelines

### 4.1 Python & FastAPI (`ZAP-BE`)
- **Type Annotations**: All functions must declare explicit argument and return types using Python 3.12+ type hinting.
- **Async I/O**: Use `async def` for I/O-bound endpoints (database reads, Cloud Tasks calls, HTTP requests). Use standard `def` or background threads for CPU-heavy tasks.
- **Pydantic v2**: Define explicit request and response schemas. Use `Field(..., description=...)` for API documentation.
- **Database Access**: Isolate MongoDB queries inside domain repositories or helper services; never write raw queries directly in router handlers.
- **Resource Management**: Always use `with` or `async with` context managers for files, temporary directories, and network sessions.

### 4.2 TypeScript & Next.js (`ZAP-FE`)
- **Strict Typing**: No `any` types. Define clear interfaces in `src/types/` for all data structures.
- **Component Separation**: Keep presentation components stateless where possible; encapsulate state in custom hooks or lightweight context.
- **Tailwind CSS**: Use semantic utility classes. Respect design tokens defined in `globals.css` and `tailwind.config.js`.
- **Environment Propagation**: Always import `apiFetch` or relevant service functions from `src/services/` to ensure `X-ZAP-ENV` header injection is preserved.

---

## 5. Testing & Performance Standards

### 5.1 Testing Mindset
- Focus tests on critical invariants, business rules, edge cases, and failure modes.
- Every bug fix **must** be accompanied by a regression test verifying the fix.
- Test suites must be deterministic and run cleanly offline or with mock services.

### 5.2 Anti-Patterns to Flag & Avoid
| Anti-Pattern | Description | Correct Alternative |
|---|---|---|
| **Testing Implementation, Not Behavior** | Asserting on private variables or internal mock order. | Assert on public function output, state change, or API response. |
| **Silent Exception Catching** | `except Exception: pass` or `catch (e) {}` | Log error with stack trace and re-raise or return structured failure. |
| **N+1 Queries** | Looping over items and fetching from DB individually. | Batch queries using `$in` filters in MongoDB. |
| **Unbounded Queries** | Querying collections without `limit()` or pagination. | Always specify `limit` and offset/cursor pagination. |
| **Missing Timeouts** | Making network or subprocess calls without a timeout. | Always specify explicit timeouts (`timeout=5.0`). |
| **Excessive Mocking** | Mocking everything so that only the mock framework is tested. | Use lightweight real in-memory data structures or focused integration tests. |

