# ZAP — Central Project Context

## 1. Product

**Company:** ZAP

**Current product focus:** DSA and technical-interview preparation/training.

**First major engineering capability:** a clean online coding/compiler platform that can support bursty usage and grow from a small deployment to roughly 20,000 users over the longer term.

The initial compiler workload is expected to have periods where roughly **200–500 students may use the compiler at the same time**, especially during tests or content sessions. The system should be designed so the execution layer can grow toward larger bursts, including a target of roughly **0–1,000 student users/day** without requiring a permanently large server fleet.

The initial cost target for compiler infrastructure is approximately **₹2,000–₹4,000/month**, but this is a budget target rather than a guaranteed ceiling. Actual cost depends mainly on the number of executions, test cases per submission, execution time, CPU, memory, and concurrency.

---

## 2. Product principles

### 2.1 Question and compiler are loosely coupled

Questions are stored centrally and contain their own test cases and metadata.

The compiler/executor must not contain question-specific rules.

The compiler should work for any valid question by receiving an execution request such as:

```text
submissionId
language
sourceCode
input/test-case reference
execution limits
expected-output information when judging
```

This makes the compiler reusable for:

- DSA questions
- future course questions
- mock interviews
- assessments
- coding tests
- other future learning products

### 2.2 Do not execute student code in the application API

The web/API layer must never execute arbitrary student code directly.

Student code is untrusted workload and must run inside the isolated execution layer.

### 2.3 Scale execution independently

Frontend/API capacity and compiler capacity are different workloads.

A traffic spike should increase compiler workers without requiring a proportionally larger frontend/backend deployment.

### 2.4 Start simple

Do not start with Kubernetes or a large microservice estate.

Use managed services and scale-to-zero/on-demand execution where practical.

---

## 3. Initial technology stack

| Area | Technology | Purpose |
|---|---|---|
| Frontend | Next.js + React + TypeScript | Main web application |
| UI | Tailwind CSS + shadcn/ui | Clean, reusable UI |
| Code editor | Monaco Editor | Online coding editor |
| Backend | Python + FastAPI | REST APIs and application logic |
| Database | MongoDB Atlas | Application data |
| Cache / optional queueing | Managed Redis (e.g. Upstash) | Cache, rate limits, and queueing where needed |
| Frontend hosting | Vercel | Frontend deployment |
| Compiler execution | GCP Cloud Run | On-demand execution workers |
| Execution isolation | Container sandbox with strict limits | Safety and resource control |
| Object storage | GCP Cloud Storage, only when needed | Large artifacts/test data |
| CI/CD | GitHub Actions | Build, test, deploy gates |
| Source control | GitHub | Two repositories |
| Observability | GCP Cloud Logging/Monitoring + application logs/metrics | Operations and debugging |

### Important hosting boundary

Vercel can host the Next.js application and can also host thin Python/FastAPI API functions. The compiler itself must **not** run in Vercel Functions.

Vercel's Python runtime supports FastAPI, while Vercel Functions have plan-dependent execution-duration limits. Keep the API lightweight and asynchronous around compiler jobs. See the official references at the end of this document.

---

## 4. Language support

Initial supported languages:

1. Java 21
2. Python 3.14.2
3. C++23
4. Node.js 22.8.0

### Version policy

Exact versions are product requirements where explicitly specified, but do **not** assume that a custom compiler/runtime image is required for optimization.

The implementation should use well-maintained official/stable runtime images and pin versions deliberately.

For C++23, remember that **C++23 is the language standard, not a compiler release**. The executor must select and document an explicit GCC/Clang toolchain version that provides the required C++23 support.

---

## 5. Question system

Questions are stored centrally in MongoDB.

For the current scale, `testCases` should be embedded inside each question document.

A question should contain, at minimum:

- title/heading
- slug or stable identifier
- difficulty (for example: easy, medium, hard)
- tags/topics
- problem statement
- examples
- constraints
- explanation
- solutions/reference solutions
- public test cases
- hidden test cases
- execution limits
- publication status
- timestamps/version information

Example logical structure:

```text
question
├── identity
├── content
├── difficulty
├── tags[]
├── examples[]
├── constraints[]
├── explanation
├── solutions[]          # hidden from students
├── testCases[]
│   ├── public
│   └── hidden
├── executionLimits
└── metadata
```

### Important MongoDB boundary

Embedding test cases is appropriate now, but MongoDB documents have a finite document-size limit. If a future problem contains unusually large/generated test data, move large data to object storage or a separate test-data collection without changing the public compiler API.

---

## 6. Initial collections

Keep the model intentionally small.

```text
users
faculty
questions
submissions
```

### Future collection: courses

A `courses` model is allowed as a future capability because ZAP is expected to expand into a course platform.

Questions should be reusable across courses rather than owned exclusively by a single course.

Tags do not need their own collection initially. Store them directly on questions:

```json
{
  "tags": ["array", "hash-map", "easy"]
}
```

---

## 7. Frontend product structure

### Student question + compiler page

The UI is conceptually split into two loosely coupled areas:

```text
Question panel                 Compiler panel
------------------             -------------------------
Heading                        Language selector
Tags / difficulty              Report bug
Question                       Format code
Examples                       Reset code
Constraints                    Code editor
Explanation                    Test case
                               Output
                               Run
                               Submit
```

The visual direction should be clean and modern, inspired by the NeetCode problem-solving experience.

Reference:
https://neetcode.io/problems/is-anagram/question

### Hidden information

Students must not receive:

- hidden test inputs
- hidden expected outputs
- faculty-only reference solutions
- internal evaluator metadata

Only the backend/execution layer may access these.

---

## 8. Faculty/admin UI

Faculty need a clean UI to:

- create questions
- edit questions
- delete/archive questions
- update public test cases
- update hidden test cases
- update descriptions, constraints, examples, explanations, tags, and difficulty
- manage reference solutions
- publish/unpublish questions

### JSON import/update capability

Provide a JSON editor/import box in the faculty UI.

Purpose:

Faculty may use an AI coding assistant to generate the complete question JSON and paste it into ZAP instead of editing every field manually.

Required behaviour:

1. Paste JSON.
2. Validate against schema.
3. Show validation errors clearly.
4. Preview the interpreted question.
5. Require explicit confirmation before writing/updating MongoDB.
6. Preserve version/audit information.

Do not directly insert arbitrary JSON into MongoDB without validation.

---

## 9. Submission model

A submission represents one execution/judging attempt.

Recommended logical fields:

```text
submissionId
userId
questionId
language
languageVersion
sourceCode
mode                # RUN / SUBMIT
status
resultSummary
executionTimeMs
memoryUsedBytes
createdAt
completedAt
errorCode
errorMessage
```

Do not store hidden test data in the submission returned to the frontend.

---

## 10. Run vs Submit

### Run

Intended for fast feedback while coding.

Possible inputs:

- selected public test case
- custom user input
- a small set of public tests

The exact behaviour can be configured by product requirements.

### Submit

Used for official judging.

It should:

1. Compile once where applicable.
2. Execute against the question's test suite.
3. Include hidden tests.
4. Stop early or continue according to judging policy.
5. Return a safe summary, not hidden test data.

Possible verdicts:

```text
ACCEPTED
WRONG_ANSWER
COMPILE_ERROR
RUNTIME_ERROR
TIME_LIMIT_EXCEEDED
MEMORY_LIMIT_EXCEEDED
OUTPUT_LIMIT_EXCEEDED
SYSTEM_ERROR
CANCELLED
```

---

## 11. Two repositories

### `ZAP-FE`

Contains:

- Next.js app
- React components
- student UI
- faculty/admin UI
- Monaco editor integration
- frontend tests
- frontend deployment configuration

### `ZAP-BE`

Contains:

- FastAPI application
- authentication/authorization
- question APIs
- submission APIs
- faculty APIs
- MongoDB models/repositories
- compiler job/execution orchestration
- executor code and Dockerfiles
- backend tests

The executor can be a separate deployable service inside the `ZAP-BE` repository initially. Do not create a third repository unless there is a future organizational reason.

---

## 12. CI/CD

Production deployment starts from the `main` branch after merge and successful CI checks.

Target flow:

```text
feature branch
      ↓
Pull Request
      ↓
CI checks
      ↓
Merge to main
      ↓
Production build/deploy
```

At minimum CI should perform:

- lint
- unit tests
- type checks where applicable
- build
- Docker image build for executor
- security/dependency checks

Production deployment:

- `ZAP-FE` → Vercel
- `ZAP-BE` → initial chosen serverless/managed deployment
- compiler executor image → GCP Cloud Run

Protect `main` so untested code cannot be merged directly.

---

## 13. Scaling target

The system should scale from low usage to bursty test sessions.

The important capacity metric is **code executions**, not only registered/online students.

For example, 1,000 online students do not necessarily mean 1,000 simultaneous executions.

Sizing must consider:

- submissions per second
- average execution time
- number of test cases per submission
- CPU per execution
- memory per execution
- Java/C++ compile cost
- peak concurrency
- queue depth

Cloud Run is intended to scale service instances with demand and can scale to zero when no instances are needed; maximum instance limits should be used as a cost-control mechanism.

---

## 14. Cost philosophy

Target low idle cost.

Do not keep a large compiler server fleet running 24/7 when usage is bursty.

Prefer:

```text
idle → near-zero execution cost
peak → temporary additional workers
peak ends → workers scale down
```

The ₹2,000–₹4,000/month target is a planning target, not a guaranteed billing amount.

---

## 15. Security principles

The executor is a security boundary.

Every student execution should have:

- non-root execution
- CPU limit
- memory limit
- wall-clock timeout
- process/PID limit
- output-size limit
- file-size limit
- restricted/ephemeral filesystem
- no application secrets
- network disabled by default
- no access to host files
- no privileged container
- isolated temporary execution directory
- cleanup after every execution

For stronger isolation later, evaluate gVisor or a microVM-based sandbox. The implementation must validate whether the selected Cloud Run/container isolation model is sufficient for truly hostile arbitrary code. If it is not, use a dedicated sandbox execution platform/runtime.

---

## 16. Official references

- Vercel Python runtime / FastAPI support: https://vercel.com/docs/functions/runtimes/python
- Vercel Functions: https://vercel.com/docs/functions
- Vercel Function limits: https://vercel.com/docs/functions/limitations
- FastAPI deployment: https://fastapi.tiangolo.com/deployment/
- Cloud Run: https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run
- Cloud Run autoscaling: https://docs.cloud.google.com/run/docs/about-instance-autoscaling
- MongoDB Atlas: https://www.mongodb.com/docs/atlas/
- MongoDB indexes: https://www.mongodb.com/docs/manual/indexes/
- Redis Streams: https://redis.io/docs/latest/develop/data-types/streams/
