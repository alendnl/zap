# Google Cloud Platform (GCP) Reference: ZAP Platform

This reference provides the technical specifications, IAM topologies, Cloud Run service configs, Cloud Tasks queues, logging filters, and scaling commands for ZAP infrastructure.

---

## 1. Project Specifications

| Attribute | Value |
|---|---|
| **Project ID** | `zap-platform-prod` |
| **Project Number** | `394729648143` |
| **Primary Region** | `us-central1` |
| **Artifact Registry** | `zap-images` (`us-central1-docker.pkg.dev/zap-platform-prod/zap-images`) |
| **Secret Manager Secret** | `zap-mongodb-uri` (MongoDB Atlas connection string) |

---

## 2. Serverless Cloud Run Services

### 2.1 `zap-api` (Public Backend Gateway)
- **Role**: Handles REST requests, question CRUD, auth, user profiles, and submission enqueuing.
- **Access**: Public (`--allow-unauthenticated`).
- **URL**: `https://zap-api-394729648143.us-central1.run.app`
- **Sizing & Scaling**:
  - CPU: `2`
  - Memory: `2Gi`
  - Concurrency: `40`
  - Scaling Concurrency Target: `0.80` (80%)
  - CPU Boost: Enabled
  - Min Instances: `2`
  - Max Instances: `15`
- **Runtime Identity**: `zap-api-runtime@zap-platform-prod.iam.gserviceaccount.com`
- **Permissions**: `roles/cloudtasks.enqueuer` on `zap-submissions`.

### 2.2 `zap-executor` (Private Sandbox Execution Subsystem)
- **Role**: Executes untrusted code inside isolated child processes with memory and CPU boundaries.
- **Access**: Strictly private (`--no-allow-unauthenticated`). Invocable only via authenticated OIDC tokens from Cloud Tasks.
- **URL**: `https://zap-executor-394729648143.us-central1.run.app`
- **Sizing & Scaling**:
  - CPU: `4`
  - Memory: `4Gi`
  - Concurrency: `8` (limits test runs to 8 per container)
  - Scaling Concurrency Target: `0.40` (40%)
  - CPU Boost: Enabled
  - Request Timeout: `120s`
  - Min Instances: `3`
  - Max Instances: `25` (capped at 14 until regional 56 vCPU quota is increased in GCP console)
- **Runtime Identity**: `zap-executor-runtime@zap-platform-prod.iam.gserviceaccount.com`
- **Security Context**: Runs as non-root Linux user `runner` (uid 2000).

---

## 3. Google Cloud Tasks Queue Topology

| Queue Name | Max Dispatches/s | Max Concurrent | Retry Backoff | Target Service |
|---|---|---|---|---|
| `zap-submissions` | 10.0 / sec | 40 | 3s – 60s (max 3 attempts) | `zap-executor /internal/tasks/execute` |

### Queue State Management
```bash
# Inspect queues:
.agents/skills/project-operations/scripts/zap-ops gcp tasks

# Pause or resume queue:
.agents/skills/project-operations/scripts/zap-ops gcp queue-state zap-submissions pause --confirm-prod
.agents/skills/project-operations/scripts/zap-ops gcp queue-state zap-submissions resume --confirm-prod
```

---

## 4. Service Accounts & IAM Matrix

| Service Account | Email | Bound Roles |
|---|---|---|
| **Deployer** | `zap-github-deployer@...` | Workload Identity User, Cloud Run Admin, Artifact Registry Writer |
| **API Runtime** | `zap-api-runtime@...` | `roles/cloudtasks.enqueuer`, `roles/secretmanager.secretAccessor` |
| **Task Caller** | `zap-tasks-invoker@...` | Attached to Cloud Tasks HTTP headers; granted `roles/run.invoker` on `zap-executor` |
| **Executor Runtime**| `zap-executor-runtime@...` | `roles/secretmanager.secretAccessor` |

---

## 5. Cloud Logging & Log Inspection

Logs are produced by Cloud Run revisions and can be queried with native `gcloud` or through `zap-ops`.

### Common Log Queries
```bash
# 1. Fetch recent errors on zap-api:
.agents/skills/project-operations/scripts/zap-ops gcp logs --service api --severity ERROR --limit 20

# 2. Fetch execution logs for zap-executor:
.agents/skills/project-operations/scripts/zap-ops gcp logs --service executor --limit 30

# 3. Search logs for a specific submission ID:
.agents/skills/project-operations/scripts/zap-ops gcp logs --service executor --search "550e8400-e29b-41d4" --limit 10

# 4. Search for HTTP 500 status codes:
.agents/skills/project-operations/scripts/zap-ops gcp logs --service api --search "500 Internal" --limit 15
```

### Direct `gcloud logging` Query Syntax
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="zap-api" AND severity>=WARNING' \
  --project=zap-platform-prod \
  --limit=25 \
  --format="table(timestamp,severity,textPayload)"
```

---

## 6. Scaling Profiles & Resource Modification

ZAP defines two scaling profiles:
- **`normal`** (`infra/profiles/normal.env`): Scale-to-zero when idle, 1 vCPU / 1 GiB for API (`min=0, max=5`), 2 vCPU / 2 GiB for Executor (`min=0, max=5`).
- **`contest`** (`infra/profiles/contest.env`): Pre-warmed high capacity, 2 vCPU / 2 GiB for API (`min=2, max=15`), 4 vCPU / 4 GiB for Executor (`min=3, max=25` [capped at 14 by regional quota]), Cloud Tasks 10 dispatches/sec (max 40 concurrent).

### Switching Scaling Profiles via Script
```bash
# Switch to normal day-to-day mode (zero idle cost):
./infra/scripts/switch-scaling.sh normal

# Switch to high-capacity contest mode:
./infra/scripts/switch-scaling.sh contest
```

### Manual Scaling via `zap-ops` or `gcloud`
```bash
# Scale zap-executor instances during high load or contest events:
.agents/skills/project-operations/scripts/zap-ops gcp scale --service executor --min-instances 2 --max-instances 20

# Increase memory on zap-api:
.agents/skills/project-operations/scripts/zap-ops gcp scale --service api --memory 1Gi
```

---

## 7. Deployment Sync & Verification

Verify whether the deployed revisions match local Git repository HEAD:
```bash
.agents/skills/project-operations/scripts/zap-ops gcp deploy-status
```

Output highlights the current revision name, container image URI, and Git commit tag match.
