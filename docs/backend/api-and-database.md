# ZAP Backend API & Database

The backend is built with **FastAPI** (`ZAP-BE/app`), backed by **MongoDB Atlas** with an automatic in-memory mock fallback for local development.

---

## 1. REST API Endpoints

### 1.1 Question Management (`/api/v1/questions`)
Managed by faculty or administrators to configure problem statements, code templates, and test cases:

- `GET /api/v1/questions?summary=true` — Retrieve list of questions (lightweight summaries for problem catalogs).
- `GET /api/v1/questions/{question_id}` — Get full question details, statement, starter code, and visible sample test cases.
- `POST /api/v1/questions` — Create new question (requires unique `slug`).
- `PUT /api/v1/questions/{question_id}` — Update question metadata, templates, or test cases.
- `DELETE /api/v1/questions/{question_id}` — Remove a question.

### 1.2 Submissions (`/api/v1/submissions`)
Handles student code submissions and run requests:

- `POST /api/v1/submissions` (HTTP 202 Accepted) — Submit code for evaluation.
  - Body: `{ questionId, language, mode: "RUN"|"SUBMIT", sourceCode, userId }`.
  - Response: `{ submissionId, status: "QUEUED" }`.
  - Rate Limiting (per user):
    - Max 2 submissions within 10 seconds (returns HTTP 429: `"Too many submissions, please wait 5 seconds"` with `Retry-After: 5`).
    - Max 6 submissions within 60 seconds (returns HTTP 429: `"Too many submissions, please wait 30 seconds"` with `Retry-After: 30`).
  - Behavior: Saves submission with status `QUEUED` and enqueues execution task to Cloud Tasks.
- `GET /api/v1/submissions/{submission_id}` — Get full submission details, code, and individual test case results.
- `GET /api/v1/submissions?userId=&questionId=&mode=&limit=50` — Query submission history with filtering. Returns lightweight `SubmissionSummary[]` (omits large `sourceCode` and detailed `testResults` for fast responses).
- `POST /api/v1/submissions/{submission_id}/cancel` — Abort a pending or queued submission.

### 1.3 Direct Playground Compiler (`/api/v1/compiler/run`)
- `POST /api/v1/compiler/run` — Synchronous playground execution endpoint.
  - Body: `{ language, sourceCode, stdin, timeoutMs, memoryMb }`.
  - Response: `{ status, stdout, stderr, exitCode, executionTimeMs, timedOut }`.
  - Used for quick scratchpad compilation without creating question/submission database entries.

### 1.4 Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/signup` — Register student or faculty user.
- `POST /api/v1/auth/login` — Authenticate and receive session token.
- `GET /api/v1/auth/me` — Retrieve active session profile.

---

## 2. MongoDB Data Models

### 2.1 Question Schema (`questions` collection)
```json
{
  "_id": "question-uuid-or-slug",
  "title": "Two Sum",
  "slug": "two-sum",
  "difficulty": "EASY",
  "tags": ["array", "hash-table"],
  "statement": "Given an array of integers nums and an integer target...",
  "templates": {
    "python": "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        pass",
    "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{};\n    }\n}",
    "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n    }\n};",
    "node": "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n};",
    "c": "int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n}"
  },
  "testCases": [
    {
      "id": "tc-1",
      "input": "[2,7,11,15]\n9",
      "expectedOutput": "[0,1]",
      "visibility": "PUBLIC",
      "enabled": true
    },
    {
      "id": "tc-2",
      "input": "[3,2,4]\n6",
      "expectedOutput": "[1,2]",
      "visibility": "HIDDEN",
      "enabled": true
    }
  ]
}
```

### 2.2 Submission Schema (`submissions` collection)
```json
{
  "_id": "550e8400-e29b-41d4-a716-446655440000",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "b47c9f80-1a2b-4c3d-8e5f-112233445566",
  "userEmail": "student@college.edu",
  "questionId": "two-sum",
  "language": "python",
  "mode": "SUBMIT",
  "sourceCode": "...",
  "status": "COMPLETED",
  "verdict": "ACCEPTED",
  "executionTimeMs": 42,
  "memoryUsedBytes": 14200000,
  "tests": {
    "total": 10,
    "passed": 10,
    "failed": 0
  },
  "testResults": [
    {
      "id": "tc-1",
      "visibility": "PUBLIC",
      "passed": true,
      "status": "ACCEPTED",
      "executionTimeMs": 12,
      "input": "[2,7,11,15]\n9",
      "expectedOutput": "[0,1]",
      "actualOutput": "[0, 1]"
    }
  ],
  "createdAt": "2026-10-25T01:00:00Z",
  "completedAt": "2026-10-25T01:00:02Z"
}
```

**Indexes on `submissions`:**
- `{ "userId": 1, "createdAt": -1 }` — Fast query for a user's recent submissions.
- `{ "questionId": 1, "createdAt": -1 }` — Fast query for problem-level submission analytics.
- `{ "userId": 1, "questionId": 1, "createdAt": -1 }` — Fast query for user submissions within a specific problem workspace.

### 2.3 User Activity Schema (`user_activities` collection)
Stores high-level progress, solved problems, and statistics per user (one document per user) to allow standard catalog and dashboard pages to load in <10ms without scanning the `submissions` collection:

```json
{
  "_id": "b47c9f80-1a2b-4c3d-8e5f-112233445566",
  "userId": "b47c9f80-1a2b-4c3d-8e5f-112233445566",
  "totalSolved": 1,
  "totalAttempted": 2,
  "solvedQuestionIds": ["two-sum"],
  "attemptedQuestionIds": ["two-sum", "valid-anagram"],
  "problems": {
    "two-sum": {
      "status": "SOLVED",
      "attemptsCount": 2,
      "submitsCount": 2,
      "runsCount": 0,
      "bestVerdict": "ACCEPTED",
      "latestSubmissionId": "550e8400-e29b-41d4-a716-446655440000",
      "latestVerdict": "ACCEPTED",
      "firstAttemptedAt": "2026-10-25T00:55:00Z",
      "lastAttemptedAt": "2026-10-25T01:00:00Z",
      "solvedAt": "2026-10-25T01:00:00Z"
    }
  },
  "recentSubmissions": [
    {
      "submissionId": "550e8400-e29b-41d4-a716-446655440000",
      "questionId": "two-sum",
      "language": "python",
      "mode": "SUBMIT",
      "status": "COMPLETED",
      "verdict": "ACCEPTED",
      "createdAt": "2026-10-25T01:00:00Z"
    }
  ],
  "createdAt": "2026-10-25T00:50:00Z",
  "updatedAt": "2026-10-25T01:00:02Z"
}
```

**Indexes on `user_activities`:**
- `{ "userId": 1 }` (Unique) — Instant single-user lookup.
- `{ "updatedAt": -1 }` — Activity timelines.

**Activity Endpoints:**
- `GET /api/v1/users/{userId}/activity/summary` — Lightweight summary (`totalSolved`, `totalAttempted`, `solvedQuestionIds`, `attemptedQuestionIds`) used by standard catalog pages.
- `GET /api/v1/users/{userId}/activity` — Full problem-by-problem breakdown and recent submissions history.

---

## 3. Database Connection & Environment Switching

The database layer (`app/db/mongodb.py`) dynamically routes queries according to the `X-ZAP-ENV` header:

```python
# app/db/mongodb.py
def get_request_environment(request: Optional[Request] = None) -> str:
    env = request.headers.get("X-ZAP-ENV", settings.DEFAULT_ENVIRONMENT)
    return "qa" if env == "qa" else "production"

def get_database_for_env(env: str):
    # Returns cached client for 'zap_platform_prod' or 'zap_platform_lower'
    ...
```

- When connecting to remote Atlas (`MONGODB_URI`), the client pools connections per database name.
- When `MONGODB_URI` is absent or set to localhost without a running daemon, it seamlessly falls back to `mongomock` for testing and offline local development.
