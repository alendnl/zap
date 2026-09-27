# ZAP — Compiler Low-Level Design

This document defines the implementation-level contract for the first compiler service.

---

# 1. Internal repository structure

The initial implementation can remain inside `ZAP-BE`.

Suggested structure:

```text
ZAP-BE/
├── app/
│   ├── api/
│   ├── auth/
│   ├── questions/
│   ├── submissions/
│   ├── faculty/
│   ├── db/
│   ├── common/
│   └── main.py
│
├── executor/
│   ├── core/
│   ├── languages/
│   │   ├── java21/
│   │   ├── python314/
│   │   ├── cpp23/
│   │   └── node2208/
│   ├── sandbox/
│   ├── judge/
│   ├── worker/
│   └── Dockerfiles/
│
├── tests/
├── scripts/
├── requirements.txt / pyproject.toml
└── .github/workflows/
```

The API and executor should compile/deploy independently even though they live in one repository.

---

# 2. MongoDB question document

Recommended shape:

```json
{
  "_id": "question-id",
  "slug": "valid-anagram",
  "title": "Valid Anagram",
  "difficulty": "EASY",
  "tags": ["string", "hash-map"],
  "statement": "...",
  "examples": [
    {
      "input": "anagram, nagaram",
      "output": "true",
      "explanation": "..."
    }
  ],
  "constraints": [
    "..."
  ],
  "explanation": "...",
  "solutions": [
    {
      "language": "python",
      "code": "...",
      "visibility": "FACULTY_ONLY"
    }
  ],
  "testCases": [
    {
      "id": "tc-001",
      "visibility": "PUBLIC",
      "input": "...",
      "expectedOutput": "...",
      "enabled": true
    },
    {
      "id": "tc-999",
      "visibility": "HIDDEN",
      "input": "...",
      "expectedOutput": "...",
      "enabled": true
    }
  ],
  "executionLimits": {
    "timeMs": 2000,
    "memoryMb": 256,
    "outputKb": 1024
  },
  "supportedLanguages": [
    "java",
    "python",
    "cpp",
    "node"
  ],
  "status": "PUBLISHED",
  "version": 1,
  "createdBy": "faculty-id",
  "updatedBy": "faculty-id",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Do not require this exact field naming if the implementation has a strong naming convention. Keep the logical structure stable.

---

# 3. Submission document

Suggested shape:

```json
{
  "_id": "sub-12345",
  "userId": "user-123",
  "questionId": "valid-anagram",
  "questionVersion": 1,
  "language": "python",
  "languageVersion": "3.14.2",
  "mode": "SUBMIT",
  "sourceCode": "...",
  "status": "RUNNING",
  "verdict": null,
  "executionTimeMs": null,
  "memoryUsedBytes": null,
  "tests": {
    "total": 50,
    "passed": 0,
    "failed": 0
  },
  "errorCode": null,
  "errorMessage": null,
  "createdAt": "ISO-8601",
  "startedAt": null,
  "completedAt": null
}
```

### Do not persist unnecessary hidden-test details

For normal student-facing submission records, store aggregate information rather than every hidden input/output.

---

# 4. Submission states

Use a finite state machine.

```text
QUEUED
  ↓
RUNNING
  ↓
┌───────────────────────────────┐
│ terminal result               │
├───────────────────────────────┤
│ ACCEPTED                      │
│ WRONG_ANSWER                  │
│ COMPILE_ERROR                 │
│ RUNTIME_ERROR                 │
│ TIME_LIMIT_EXCEEDED           │
│ MEMORY_LIMIT_EXCEEDED         │
│ OUTPUT_LIMIT_EXCEEDED         │
│ SYSTEM_ERROR                  │
│ CANCELLED                     │
└───────────────────────────────┘
```

`SYSTEM_ERROR` is retryable only when the underlying failure is confirmed to be infrastructure-related.

---

# 5. Job payload

Recommended internal queue message:

```json
{
  "jobId": "job-12345",
  "submissionId": "sub-12345",
  "questionId": "valid-anagram",
  "questionVersion": 1,
  "language": "python",
  "languageVersion": "3.14.2",
  "mode": "SUBMIT"
}
```

The worker should load the authoritative question/test cases from a trusted backend/data layer rather than trusting test cases supplied directly by the browser.

---

# 6. Question versioning

Question data can change after students have submitted code.

A submission should therefore store:

```text
questionId
questionVersion
```

This allows historical results to remain reproducible when possible.

When faculty edits a published question:

```text
Version 1
   ↓
Version 2
```

Do not silently mutate the meaning of old submissions without tracking the version.

---

# 7. Execution directory

Each job gets an isolated temporary directory:

```text
/work/
└── submissions/
    └── <submissionId>/
        ├── source/
        ├── build/
        ├── stdin/
        ├── stdout/
        └── stderr/
```

The exact filesystem layout is implementation-defined.

Requirements:

- never share directories between jobs
- cleanup after completion/failure
- enforce storage limits
- never expose the directory to the HTTP API

---

# 8. Runtime adapters

Do not place all compiler commands in one large conditional block.

Use a language adapter interface conceptually similar to:

```python
class LanguageRunner(Protocol):
    def validate_source(self, source: str) -> None: ...
    def compile(self, context: ExecutionContext) -> CompileResult: ...
    def run(self, context: ExecutionContext, stdin: str) -> RunResult: ...
```

Implement:

```text
JavaRunner
PythonRunner
CppRunner
NodeRunner
```

This makes language additions easier later.

---

# 9. Judge engine

Separate execution from judging.

```text
Runtime runner
    ↓
raw stdout/stderr/exit code/time/memory
    ↓
Judge engine
    ↓
PASS / FAIL / ERROR / LIMIT
```

The judge engine is responsible for output comparison policy.

Start with normalized exact output comparison where the problem type requires it.

Future comparison policies may include:

- exact token comparison
- whitespace-normalized comparison
- floating-point tolerance
- custom checker

Do not add custom checkers until a real product requirement exists.

---

# 10. Test execution algorithm

Conceptual algorithm:

```text
1. Load question by questionId/version.
2. Validate language support.
3. Apply execution limits.
4. Create sandbox.
5. Prepare source files.
6. Compile if the language requires compilation.
7. If compilation fails -> COMPILE_ERROR.
8. For each enabled test case:
      a. prepare stdin
      b. execute program
      c. enforce timeout/memory/output limits
      d. capture result
      e. compare output
      f. update counters
      g. follow fail-fast policy
9. Produce final verdict.
10. Persist result.
11. Delete sandbox.
```

### Compile once

For Java/C++:

```text
source
  ↓
compile once
  ↓
run compiled artifact against multiple tests
```

Do not recompile for every test case unless language/runtime requirements force it.

---

# 11. Fail-fast policy

Default `SUBMIT` policy may be:

```text
Compile failure → stop
Runtime/sandbox failure → stop or classify according to policy
Wrong answer → stop after first failure
All tests pass → ACCEPTED
```

This reduces execution cost during normal judging.

A future assessment mode may require running all tests for analytics, but that should be an explicit mode.

---

# 12. Security controls

Required controls before production:

```text
[ ] non-root
[ ] network disabled
[ ] no privileged execution
[ ] CPU limit
[ ] memory limit
[ ] PID/process limit
[ ] wall-clock limit
[ ] output limit
[ ] filesystem quota
[ ] read-only runtime image where possible
[ ] ephemeral writable directory only
[ ] no host mounts
[ ] no cloud credentials in execution environment
[ ] no metadata endpoint access
[ ] cleanup on every exit path
```

### Important

The executor environment must not contain:

```text
MONGO_URI
REDIS_PASSWORD
JWT_SECRET
API_SECRET
CLOUD_CREDENTIALS
```

or any other sensitive application secret that student code could read.

Use a minimal execution image.

---

# 13. API endpoints

Minimum API set:

### Create submission

```http
POST /api/v1/submissions
```

Request:

```json
{
  "questionId": "valid-anagram",
  "language": "python",
  "mode": "SUBMIT",
  "sourceCode": "..."
}
```

Response:

```json
{
  "submissionId": "sub-12345",
  "status": "QUEUED"
}
```

### Get status/result

```http
GET /api/v1/submissions/{submissionId}
```

### Cancel submission

```http
POST /api/v1/submissions/{submissionId}/cancel
```

Cancellation is optional for the first release but should be considered in the interface design.

---

# 14. Rate limits

Protect against accidental or abusive execution floods.

Rate limit at multiple levels if needed:

```text
per user
per IP/session
per assessment
per organization/batch
```

Example policy values are not fixed by this document. Define them in configuration.

---

# 15. Indexes

Initial MongoDB indexes should be based on actual queries.

Likely useful indexes:

```text
questions.slug (unique)
questions.status
questions.difficulty
questions.tags
submissions.userId + createdAt
submissions.questionId + createdAt
submissions.status + createdAt
submissions.submissionId / _id
```

Do not create dozens of speculative indexes. MongoDB indexes improve reads but add write/maintenance cost.

---

# 16. Faculty JSON contract

The faculty UI should support a complete question document import.

Example minimal JSON:

```json
{
  "slug": "two-sum",
  "title": "Two Sum",
  "difficulty": "EASY",
  "tags": ["array", "hash-map"],
  "statement": "...",
  "examples": [],
  "constraints": [],
  "explanation": "...",
  "solutions": [],
  "testCases": [],
  "executionLimits": {
    "timeMs": 2000,
    "memoryMb": 256,
    "outputKb": 1024
  }
}
```

Validation sequence:

```text
JSON input
   ↓
Parse
   ↓
Schema validation
   ↓
Business validation
   ↓
Preview
   ↓
Confirm
   ↓
Create/update question
```

---

# 17. Testing strategy

### Unit tests

Test independently:

- source validation
- language adapter commands
- output normalization
- judge logic
- state transitions
- rate limits
- JSON schema validation

### Integration tests

Use small real programs for:

- accepted code
- compile error
- runtime error
- infinite loop
- memory abuse
- huge output
- file abuse
- network attempt

### Load tests

Test:

```text
10 concurrent
50 concurrent
100 concurrent
250 concurrent
500 concurrent
```

Measure:

```text
queue wait
compile time
execution time
end-to-end latency
worker startup time
CPU
memory
failure rate
cost
```

Do not declare support for a concurrency target until it is benchmarked with realistic ZAP workloads.

---

# 18. Definition of done for compiler MVP

The compiler MVP is ready when:

- [ ] four supported languages execute correctly
- [ ] Run works
- [ ] Submit works
- [ ] public + hidden tests work
- [ ] compile/runtime/timeout/memory/output errors are classified
- [ ] hidden tests never reach the browser
- [ ] every execution is sandboxed
- [ ] execution limits are enforced
- [ ] queueing works during bursts
- [ ] worker failure does not lose a submission permanently
- [ ] retries are safe/idempotent
- [ ] submission history is stored
- [ ] basic metrics/logging exist
- [ ] CI builds and tests executor images
- [ ] production deployment is automated
- [ ] a 200–500 concurrent load test has been run before a real student test event

