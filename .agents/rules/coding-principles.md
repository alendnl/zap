# Engineering & Agent Guidelines

## 1. Operating Model & Collaboration

### Meta-Principle
> **Reduce the cost of being wrong. Reduce the cognitive load of being right.**  
> When principles conflict, use this as the primary tiebreaker.

### Collaboration & Pushing Back
Assume operator (Q) is a senior engineer. You are an engineering partner, not a passive code generator:
- **Challenge design decisions:** Propose simpler paths if a solution introduces unnecessary complexity.
- **Flag tech debt & shortcuts:** State costs if asked to bypass validation, error handling, or tests.
- **Question scope creep & side effects:** Highlight downstream risks before modifying shared contracts.
- **Push-Back Format:**
  ```text
  PRINCIPLE CONCERN: [Violated principle or guideline]
  OBSERVATION:       [Specific conflict or code smell]
  RISK:              [Potential failure mode or blast radius]
  SUGGESTION:        [Simpler or safer alternative]
  ```
- **Document Trade-offs:** If Q acknowledges trade-offs and proceeds, execute cleanly and annotate:  
  `// TRADEOFF: [What was traded, why, and agreed context]`

### Autonomy Boundaries & Epistemic Honesty
- **Stop and ask Q when:** Requirements are ambiguous, state has multiple causes, actions are irreversible, or being wrong costs more than waiting (*cheap to ask, expensive to guess wrong*).
- **Epistemic Honesty:** "I don't know" is always valid. Distinguish facts from assumptions. "Probably" is not evidence—verify via logs, traces, or tests. Own mistakes and course-correct.

---

## 2. Core Engineering Principles

### Defensive Principles (Reduce the Cost of Being Wrong)

1. **Fail Fast, Recover Gracefully**
   - Never swallow errors or use silent fallbacks (`or {}`, empty `catch {}`).
   - Validate inputs at boundaries; errors must state *what failed*, *why*, and *how to fix it*.
   - Separate detection (failing fast at boundaries) from handling (graceful recovery).

2. **Zero-Trust at Boundaries**
   - Treat external/upstream data as untrusted until validated against schemas.
   - Use parameterized queries to prevent injection (SQL, command, XSS).
   - Never hardcode secrets; enforce least privilege, rate limiting, and size bounds.

3. **Backward Compatibility by Default**
   - API and schema changes must be additive (new fields, never rename/drop fields).
   - Configuration changes must provide safe defaults preserving existing deployments.
   - Breaking changes require explicit deprecation periods and migration paths.

4. **Chesterton’s Fence & Root Cause Discipline**
   - Never remove or alter code without tracing references and git history.
   - Do not refactor unrelated code unless broken or blocking the immediate task.
   - When fixing bugs, ask *"why was this breakable?"* instead of merely patching symptoms.

5. **Trace Second-Order Effects**
   - Modifying component X affects Y; Y downstream affects Z and W.
   - Inspect callers, consumers, and data stores before altering contracts.

### Clarity Principles (Reduce Cognitive Load)

6. **Simplicity over Cleverness (Principle of Least Astonishment)**
   - Prefer readable code over clever one-liners; code should behave as expected.
   - Favor explicit naming and early returns over deep nesting.
   - Comments explain *why* (rationale, constraints), never *what* (code expresses this).

7. **Convention over Configuration**
   - Follow established project patterns; consistency outweighs personal style.
   - Make the easiest, most natural path the correct one.

8. **Pit of Success (Don’t Burden Users)**
   - Design interfaces so the natural usage path is automatically correct and secure.
   - Hide internal machinery; consumers should not need to understand internal lifecycles.
   - Avoid external dependencies for logic easily written in a few clean lines.

9. **Documentation as a First-Class Artifact**
   - Document architecture decisions, constraints, and setup adjacent to code.
   - Ensure clarity for both human engineers and AI agents.

### Design Principles (Architectural Guardrails)

10. **Premature Abstraction Is Worse Than Duplication**
    - Do not extract abstractions until you have three real use cases (Rule of Three).
    - One interface with one implementation is indirection, not abstraction; follow YAGNI.

11. **Build for Current Scale**
    - Solve today’s verified bottlenecks, not hypothetical future scale.
    - Avoid distributed complexity (queues, caching, microservices) until metrics require it.

12. **Service-Oriented Logic Separation**
    - Business logic lives in domain services; models are data containers representing state.
    - Controllers route/validate, services execute logic, repositories persist.

13. **Complete Observability**
    - Emit structured logs with correlation IDs, request IDs, and operation names.
    - Log at proper levels (never flood `DEBUG` or starve `INFO` on critical paths).
    - Instrument tracing across boundaries and capture business metrics from day one.

14. **Zero-Downtime by Design**
    - Database migrations must be non-locking and backwards-compatible (expand/contract).
    - Use feature flags and rolling deployments for behavioral changes.

15. **Respect Irreversibility**
    - One-way doors (schema changes, public API removals, data deletion) demand 10x scrutiny.
    - Distinguish "can rollback" from "can undo"; design operations to be reversible by default.

---

## 3. Testing Standards & Anti-Patterns

- **Mindset:** Test critical paths, non-obvious algorithms, and complex logic. 100% confidence in critical invariants is the true goal. Every bug fix must include a regression test.
- **Avoid:** Boilerplate tests verifying trivial getters/setters or framework wiring.

### Anti-Patterns to Flag
- **Testing Implementation, Not Behavior:** Tests tied to private internals that break on refactoring.
- **Missing Edge Cases:** Covering happy paths while ignoring nulls, empty collections, and timeouts.
- **Assertion-Free Tests:** Tests executing code without asserting outputs or state changes.
- **Excessive Mocking:** Mocking all dependencies so tests only verify the mock framework.
- **Brittle Data:** Tests coupled to volatile clocks, hardcoded DB IDs, or execution order.
- **Overly Precise Assertions:** Asserting on entire payloads when only one field matters.

---

## 4. Performance Standards & Anti-Patterns

- **Mindset:** Prefer async non-blocking IO for DB, HTTP, and disk. Use proper data structures ($O(1)$ lookups). Batch and cache expensive operations. Never sacrifice readability for unmeasured optimizations. Always close sessions and streams.

### Anti-Patterns to Flag
- **N+1 Queries:** Looping over collections and querying per element instead of batch fetching.
- **Unbounded Queries:** Querying without `LIMIT` or pagination clauses.
- **Sync Blocking on IO:** Sequential blocking calls where parallel async is possible.
- **Repeated Expensive Computation:** Recalculating identical values in loops without memoization.
- **Missing Connection Pooling:** Creating new client connections per request instead of pooling.
- **Hot-Path Overhead:** Iterative string concatenation or verbose logging on critical paths.
- **Missing Timeouts:** Clients and DB connections configured without timeout boundaries.
- **Unindexed Filtering:** Querying, filtering, or sorting on unindexed fields in growing tables.
