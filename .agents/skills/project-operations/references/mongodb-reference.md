# MongoDB Atlas Reference Guide: ZAP Platform

This reference provides the technical details, data models, aggregation pipelines, index structures, and operational procedures for MongoDB Atlas on ZAP.

---

## 1. Cluster & Database Topology

- **Cluster Provider**: MongoDB Atlas Replica Set (`ac-e7inuki-shard-00-*.go7jp0b.mongodb.net`)
- **Connection Configuration**: Loaded securely via `MONGO_URI` / `MONGODB_URI` from `.env` or GCP Secret Manager (`zap-mongodb-uri`).
- **Read Preference**: Uses `ReadPreference.PRIMARY_PREFERRED` to ensure resilience during replica elections or node rebalancing.

### Databases & Environment Mapping
| Environment Parameter | Database Name | Purpose | Guardrails |
|---|---|---|---|
| `--env prod` / `production` | `zap_platform_prod` | Live production data (student submissions, published questions, live contests) | Hard-locked against unrequested destructive writes. |
| `--env lower` / `qa` | `zap_platform_lower` | QA, staging, and automated integration testing | Sandbox for testing features and seed data. |

---

## 2. Collection Catalog

The platform database comprises 9 primary collections:

| Collection | Description | Key Identifier |
|---|---|---|
| `questions` | Coding challenges, starter code templates, problem statements, test cases | `slug`, `id`, `_id` |
| `submissions` | Student code submissions, execution status, verdicts, test case results | `id`, `_id`, `userId` |
| `users` | User accounts, profiles, roles (`student`, `faculty`, `admin`), college affiliation | `email`, `id`, `studentId` |
| `user_activities` | User session logs, daily activity streaks, problem completion tracking | `userId`, `_id` |
| `contests` | Timed contest metadata, scheduled windows, problem references, rules | `slug`, `id` |
| `contest_submissions`| Submissions tied to active contest sessions | `contestId`, `studentId` |
| `mcq_questions` | Multiple choice questions, options, explanations, tags | `slug`, `id` |
| `mcq_questions_archive` | Deprecated or archived MCQ questions | `slug`, `id` |
| `admin` | System administrator email whitelist and permission records | `email`, `_id` |

---

## 3. Core Schemas & Document Structures

### 3.1 `questions` Collection
```json
{
  "_id": "q-49c9f560",
  "id": "q-49c9f560",
  "slug": "two-sum-basics",
  "title": "Two Sum",
  "difficulty": "EASY",
  "status": "PUBLISHED",
  "tags": ["array", "hash-map"],
  "statement": "Given an array of integers nums and an integer target, return indices of the two numbers...",
  "constraints": ["2 <= n <= 10000", "Exactly one pair exists"],
  "supportedLanguages": ["c", "python", "java", "cpp", "node"],
  "starterCode": {
    "python": "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        pass",
    "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n    }\n};"
  },
  "executionLimits": {
    "timeMs": 2000,
    "memoryMb": 256
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
  ],
  "version": 3,
  "createdAt": "2026-10-04T12:18:49.694912+00:00",
  "updatedAt": "2026-10-09T15:21:01.692821+00:00"
}
```

### 3.2 `submissions` Collection
```json
{
  "_id": "550e8400-e29b-41d4-a716-446655440000",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "b47c9f80-1a2b-4c3d-8e5f-112233445566",
  "userEmail": "student@college.edu",
  "questionId": "two-sum-basics",
  "language": "python",
  "mode": "SUBMIT",
  "sourceCode": "class Solution:\n    def twoSum(self, nums, target):\n        ...",
  "status": "COMPLETED",
  "verdict": "ACCEPTED",
  "passedCount": 15,
  "totalCount": 15,
  "executionTimeMs": 142,
  "memoryUsedMb": 38.4,
  "testResults": [
    {
      "testCaseId": "tc-1",
      "passed": true,
      "executionTimeMs": 12,
      "visibility": "PUBLIC"
    }
  ],
  "createdAt": "2026-11-19T14:32:00.000Z",
  "completedAt": "2026-11-19T14:32:02.150Z"
}
```

---

## 4. Production Index Specifications

Required indexes to guarantee sub-10ms query times and uniqueness constraints:

```python
index_specs = {
    "submissions": [
        [("userId", 1), ("createdAt", -1)],
        [("questionId", 1), ("createdAt", -1)],
        [("userId", 1), ("questionId", 1), ("createdAt", -1)],
    ],
    "user_activities": [
        [("userId", 1)],  # unique=True
        [("updatedAt", -1)],
    ],
    "users": [
        [("email", 1)],   # unique=True
        [("studentId", 1)],
    ],
    "questions": [
        [("slug", 1)],    # unique=True
        [("status", 1)],
    ],
    "mcq_questions": [
        [("slug", 1)],    # unique=True, sparse=True
        [("category", 1)],
        [("difficulty", 1)],
        [("status", 1)],
        [("createdAt", -1)],
    ],
    "contests": [
        [("slug", 1)],    # unique=True, sparse=True
        [("status", 1)],
        [("createdAt", -1)],
    ],
    "contest_submissions": [
        [("contestId", 1), ("studentId", 1)],
        [("submittedAt", -1)],
    ],
}
```

Verify or recreate indexes at any time using:
```bash
.agents/skills/project-operations/scripts/zap-ops mongo ensure-indexes --env prod
```

---

## 5. Aggregation Pipeline Cookbook

### 5.1 Submission Status Breakdown
Group submissions by status (`COMPLETED`, `FAILED`, `RUNNING`, `QUEUED`):
```bash
.agents/skills/project-operations/scripts/zap-ops mongo aggregate --env prod -c submissions --pipeline '[
  {"$group": {"_id": "$status", "count": {"$sum": 1}}},
  {"$sort": {"count": -1}}
]'
```

### 5.2 Pass Rate by Question
Calculate the percentage of successful submissions per question:
```bash
.agents/skills/project-operations/scripts/zap-ops mongo aggregate --env prod -c submissions --pipeline '[
  {"$match": {"mode": "SUBMIT", "status": "COMPLETED"}},
  {"$group": {
    "_id": "$questionId",
    "total": {"$sum": 1},
    "accepted": {"$sum": {"$cond": [{"$eq": ["$verdict", "ACCEPTED"]}, 1, 0]}}
  }},
  {"$project": {
    "questionId": "$_id",
    "total": 1,
    "accepted": 1,
    "passRatePercent": {"$round": [{"$multiply": [{"$divide": ["$accepted", "$total"]}, 100]}, 2]}
  }},
  {"$sort": {"total": -1}},
  {"$limit": 10}
]'
```

### 5.3 Top Active Users / Solvers
Find candidates who solved the highest number of unique questions:
```bash
.agents/skills/project-operations/scripts/zap-ops mongo aggregate --env prod -c submissions --pipeline '[
  {"$match": {"verdict": "ACCEPTED"}},
  {"$group": {"_id": {"userId": "$userId", "questionId": "$questionId"}, "userEmail": {"$first": "$userEmail"}}},
  {"$group": {"_id": "$_id.userId", "userEmail": {"$first": "$userEmail"}, "uniqueSolved": {"$sum": 1}}},
  {"$sort": {"uniqueSolved": -1}},
  {"$limit": 10}
]'
```

---

## 6. Data Import, Export & Backup

### Export to JSON or CSV
```bash
# Export all published questions to JSON:
.agents/skills/project-operations/scripts/zap-ops mongo export --env prod -c questions -o ./exports/questions.json

# Export submission summary to CSV with field projection:
.agents/skills/project-operations/scripts/zap-ops mongo export --env prod -c submissions \
  --fields id,userId,userEmail,questionId,verdict,createdAt \
  --limit 500 \
  -o ./exports/recent_submissions.csv
```

### Import or Upsert from File
```bash
# Upsert questions into lower (QA) database using 'id' as key:
.agents/skills/project-operations/scripts/zap-ops mongo import --env lower -c questions -i ./exports/questions.json --upsert
```

### Full Database Backup
```bash
# Dump all collections in QA/lower database to JSON directory:
.agents/skills/project-operations/scripts/zap-ops mongo backup --env lower -o ./backups/qa_snapshot
```
