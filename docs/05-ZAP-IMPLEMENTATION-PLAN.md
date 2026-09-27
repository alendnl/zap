# ZAP — Implementation Plan / AI Build Instructions

This is the practical build order for another AI/developer.

The goal is to get a clean, working system without overengineering.

---

# Phase 0 — Repository and CI/CD foundation

Create:

```text
ZAP-FE
ZAP-BE
```

Set up:

- GitHub repositories
- protected `main`
- feature branch workflow
- Pull Requests
- GitHub Actions
- environment configuration
- development/staging/production separation where appropriate

CI must run on pull requests.

Production deployment starts only after merge to `main` and successful CI.

---

# Phase 1 — Frontend shell

Build the Next.js application with:

- TypeScript
- Tailwind CSS
- shadcn/ui
- Monaco Editor

Create the core student page:

```text
Question pane
+
Compiler pane
```

Do not connect the compiler yet. Use mocked submission states initially.

---

# Phase 2 — MongoDB and backend foundation

Create FastAPI project.

Implement:

- MongoDB connection
- configuration management
- health endpoint
- user model
- faculty model
- question model
- submission model
- repository/service structure

Build question CRUD first.

---

# Phase 3 — Faculty question management

Implement faculty/admin UI:

- create question
- edit question
- archive/delete
- test-case editor
- public/hidden test-case toggle
- solution editor
- difficulty/tags
- publish/unpublish

Add JSON import:

```text
paste JSON
    ↓
validate
    ↓
preview
    ↓
confirm
    ↓
save
```

Add strong validation before database writes.

---

# Phase 4 — Compiler contract

Define the compiler-facing contract before writing sandbox code.

Minimum API:

```text
POST /api/v1/submissions
GET  /api/v1/submissions/{submissionId}
```

The backend should return quickly with:

```text
submissionId
status=QUEUED
```

Do not wait in the frontend request for compilation to finish.

---

# Phase 5 — Language runner MVP

Implement language adapters:

```text
JavaRunner
PythonRunner
CppRunner
NodeRunner
```

First make them work in controlled local development containers.

Test:

```text
Hello world
stdin/stdout
compile error
runtime error
```

Do not expose the compiler to real student traffic yet.

---

# Phase 6 — Sandbox/security

Implement and verify:

- non-root execution
- CPU limits
- memory limits
- timeout
- process/PID limit
- output limit
- filesystem limit
- no network
- no privileged execution
- no host mounts
- no application secrets
- cleanup

Create explicit adversarial tests:

```text
infinite loop
large memory allocation
large stdout
fork/process abuse
filesystem traversal
network access attempt
environment-secret access attempt
```

A security review is mandatory before production use.

---

# Phase 7 — Judge engine

Implement:

```text
compile
 ↓
run test cases
 ↓
compare result
 ↓
produce verdict
```

Support:

- public test cases
- hidden test cases
- compile errors
- runtime errors
- timeout
- memory limit
- output limit
- accepted
- wrong answer

Compile once for compiled languages and reuse the artifact across tests.

---

# Phase 8 — Queue and asynchronous execution

Introduce managed queueing.

Initial choice can be Redis/Redis Streams if that remains the selected infrastructure.

Keep queue details behind an internal interface:

```text
ExecutionQueue.enqueue(job)
ExecutionQueue.ack(job)
ExecutionQueue.retry(job)
```

This allows the implementation to move later to a cloud-native queue without changing the application API.

---

# Phase 9 — Cloud execution

Package language runners into production images.

Deploy executor workers on GCP Cloud Run.

Configure:

- maximum instances
- CPU
- memory
- timeout
- concurrency
- region
- logging

Start with conservative limits and benchmark before increasing concurrency.

---

# Phase 10 — End-to-end student flow

Implement:

```text
Question page
    ↓
Select language
    ↓
Write code
    ↓
Run
    ↓
See output

Then:

Submit
    ↓
Queue
    ↓
Compile
    ↓
Run public + hidden tests
    ↓
Verdict
    ↓
Submission history
```

---

# Phase 11 — Load testing

Before a real ZAP test event, test progressively:

```text
10
50
100
250
500
```

Measure:

- API latency
- queue wait time
- worker startup latency
- execution time
- database latency
- error rate
- CPU
- memory
- concurrent workers
- cost

Only then decide whether the system needs more capacity.

---

# Phase 12 — Production hardening

Add:

- rate limiting
- per-user execution quota
- structured logs
- dashboards
- alerts
- retry handling
- idempotency
- audit logs for faculty changes
- question versioning
- backup/recovery plan
- dependency/image vulnerability scanning

---

# Rules for the implementation AI

## Rule 1 — Do not overengineer

Do not introduce Kubernetes, service meshes, Kafka, multiple databases, or many microservices unless the requirements force them.

## Rule 2 — Keep compiler isolated

Never run student code inside the normal FastAPI application process.

## Rule 3 — Hide secrets and hidden tests

The browser must never receive hidden test inputs/expected outputs or execution-service credentials.

## Rule 4 — Keep question/compiler coupling low

The compiler receives a generic execution contract.

It must not contain question-specific code.

## Rule 5 — Make execution idempotent

A retry of the same execution job must not create duplicate final results.

Use `submissionId` as the primary idempotency/correlation key.

## Rule 6 — Treat cost as a product requirement

Use on-demand execution and maximum worker limits. Do not run a permanently large compiler fleet.

## Rule 7 — Build for future reuse

Question data must be reusable by future courses, mock interviews, and assessments.

## Rule 8 — Prefer managed infrastructure

The ZAP team currently has limited cloud-infrastructure expertise. Managed services are preferred over self-managed clusters.

---

# First production milestone

The first production release should contain only:

```text
Student
 ├── Login
 ├── Question page
 ├── Monaco editor
 ├── Run
 ├── Submit
 └── Submission history

Faculty
 ├── Question CRUD
 ├── Test-case management
 ├── Solution management
 └── JSON import

Platform
 ├── MongoDB
 ├── FastAPI
 ├── Queue
 ├── Cloud Run executor
 ├── Sandbox
 └── CI/CD
```

Everything else is a future enhancement unless explicitly required.
