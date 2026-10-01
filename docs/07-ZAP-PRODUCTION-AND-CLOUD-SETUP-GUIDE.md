# ZAP — Production and Cloud Setup Guide

This document details the production deployment, infrastructure topology, and cloud operations strategy for **ZAP**.

---

## 1. Production Architecture Overview

The production architecture is designed around two strict principles from the ZAP specifications:
1. **Loose Coupling**: Question metadata/CRUD is strictly decoupled from code execution.
2. **Cost Efficiency**: No permanent large compiler fleet. The platform relies on **on-demand execution with scale-to-zero** on Google Cloud Platform (GCP).

```text
[ Browser / Client ]
        │
        ▼ (HTTPS)
[ Cloudflare / Vercel Edge CDN ]
        │
        ├── Next.js Frontend (ZAP-FE)
        │
        ▼ (API Routes / Proxy)
[ GCP Cloud Run — API Service (ZAP-BE) ]
   ├── Question CRUD
   ├── Submission Ingestion (Status: QUEUED)
   │
   ├──▶ [ MongoDB Atlas ] (Questions, Test Cases, Submissions)
   │
   └──▶ [ Asynchronous Queue: Cloud Tasks / Redis Streams ]
              │
              ▼ (Dispatch Execution Jobs)
[ GCP Cloud Run — Isolated Executor Workers (ZAP-BE) ]
   ├── Language Sandbox (Python, Java, C++, Node.js)
   ├── Memory & CPU Limits
   ├── Execution Timeout Enforcement
   └── Output Truncation & Verdict Determination
```

---

## 2. Infrastructure Components

| Layer | Service / Provider | Purpose | Scaling Characteristics |
|---|---|---|---|
| **Frontend** | Vercel or GCP Cloud Run | Hosts Next.js SSR & static assets | Auto-scales instantly; global edge CDN |
| **API Gateway** | GCP Cloud Run | FastAPI REST endpoints (`/questions`, `/submissions`) | Auto-scales `0 → N`, scales to zero when idle |
| **Job Queue** | GCP Cloud Tasks or Memorystore (Redis) | Decouples submission creation from compilation | Managed, high-throughput, automatic retry |
| **Executor Workers** | GCP Cloud Run | Sandboxed code execution & test case evaluation | Scale-to-zero, dedicated container per execution |
| **Database** | MongoDB Atlas (Serverless / M10+) | Questions, Submissions, User records | Multi-AZ, automated backups, encrypted at rest |
| **Secrets** | GCP Secret Manager | Database URI, API credentials, service tokens | Encrypted, versioned, IAM-restricted |
| **Registry** | GCP Artifact Registry | Production multi-runtime Docker images | Regional vulnerability scanning |

---

## 3. Containerization Strategy

### 3.1: API Service (`ZAP-BE/Dockerfile.api`)

Lightweight container for handling HTTP traffic:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as non-privileged user
RUN useradd -u 1000 -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
```

### 3.2: Multi-Language Executor Worker (`ZAP-BE/Dockerfile.worker`)

Multi-runtime image containing compilers and runtimes for all supported interview languages:

```dockerfile
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install runtimes: Python 3.14/3.12, Node.js 22, OpenJDK 21, GCC/G++ 14
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    build-essential \
    g++ \
    openjdk-21-jdk-headless \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

COPY . .

# Sandboxed execution user
RUN useradd -u 2000 -m runner && \
    mkdir -p /tmp/zap-executions && \
    chown -R runner:runner /tmp/zap-executions /app

USER runner

EXPOSE 8080

CMD ["python3", "-m", "executor.worker.worker"]
```

---

## 4. Step-by-Step GCP Deployment

### Step 4.1: GCP Project & IAM Setup

```bash
# 1. Set GCP project ID
export PROJECT_ID="zap-platform-prod"
gcloud config set project $PROJECT_ID

# 2. Enable required Google Cloud APIs
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudtasks.googleapis.com \
    monitoring.googleapis.com \
    logging.googleapis.com

# 3. Create Artifact Registry repository
gcloud artifacts repositories create zap-images \
    --repository-format=docker \
    --location=us-central1 \
    --description="ZAP Container Images"
```

### Step 4.2: Secret Management

Store sensitive credentials in Secret Manager:

```bash
# Store MongoDB Atlas URI
echo -n "mongodb+srv://zap_user:<PASSWORD>@cluster0.mongodb.net/zap_prod?retryWrites=true&w=majority" | \
gcloud secrets create zap-mongodb-uri --data-file=-

# Grant Cloud Run Service Account access to secrets
export SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding zap-mongodb-uri \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor"
```

### Step 4.3: Deploy API Service to Cloud Run

```bash
# Build & tag API image
docker build -t us-central1-docker.pkg.dev/$PROJECT_ID/zap-images/zap-be-api:latest -f ZAP-BE/Dockerfile.api ZAP-BE/
docker push us-central1-docker.pkg.dev/$PROJECT_ID/zap-images/zap-be-api:latest

# Deploy to Cloud Run
gcloud run deploy zap-api \
    --image=us-central1-docker.pkg.dev/$PROJECT_ID/zap-images/zap-be-api:latest \
    --region=us-central1 \
    --platform=managed \
    --allow-unauthenticated \
    --min-instances=0 \
    --max-instances=20 \
    --cpu=1 \
    --memory=512Mi \
    --concurrency=80 \
    --set-secrets="MONGODB_URI=zap-mongodb-uri:latest" \
    --set-env-vars="ENVIRONMENT=production,DEBUG=false,DATABASE_NAME=zap_prod"
```

### Step 4.4: Deploy Executor Workers to Cloud Run

Executor workers must be tightly bounded with strict timeouts and memory caps:

```bash
# Build & tag Worker image
docker build -t us-central1-docker.pkg.dev/$PROJECT_ID/zap-images/zap-be-worker:latest -f ZAP-BE/Dockerfile.worker ZAP-BE/
docker push us-central1-docker.pkg.dev/$PROJECT_ID/zap-images/zap-be-worker:latest

# Deploy to Cloud Run with scale-to-zero and sandboxing
gcloud run deploy zap-executor \
    --image=us-central1-docker.pkg.dev/$PROJECT_ID/zap-images/zap-be-worker:latest \
    --region=us-central1 \
    --platform=managed \
    --no-allow-unauthenticated \
    --min-instances=0 \
    --max-instances=50 \
    --cpu=2 \
    --memory=1Gi \
    --timeout=30s \
    --concurrency=1 \
    --set-secrets="MONGODB_URI=zap-mongodb-uri:latest" \
    --set-env-vars="ENVIRONMENT=production,DEBUG=false,MAX_EXECUTION_TIME_SECONDS=5.0"
```

> [!IMPORTANT]
> The worker is deployed with `--concurrency=1` to guarantee dedicated CPU and memory isolation for each user's code execution, preventing CPU throttling and cross-process interference.

---

## 5. Security & Sandbox Hardening

Before opening compiler endpoints to student code, enforce these mandatory protections:

1. **Non-Root Execution**: Container processes run under UID `2000` (`runner`).
2. **Resource Boundaries**:
   - `timeout_seconds`: Hard ceiling (default `2.0s` for student test runs, `5.0s` maximum).
   - `memory_mb`: Process cap (default `256MB`).
   - `output_limit_bytes`: Truncated at `1MB` to prevent disk and memory exhaustion attacks.
3. **Restricted Environment Variables**: The sandbox passes only safe environment variables (`PATH`, `LANG`, `LC_ALL`, `USER`, `HOME`) to student processes. Database credentials and secrets are never injected into subprocesses.
4. **Filesystem Cleanup**: Every execution runs in a uniquely generated directory `/tmp/zap-executions/<submission_id>` which is purged immediately upon completion via `shutil.rmtree`.
5. **Network Egress Denial**: Cloud Run egress connectors or container iptables drop external connections during code execution to prevent unauthorized network requests or cryptocurrency miners.

---

## 6. Pre-Flight Production Checklist

- [ ] All 13 Pytest test suites passing in CI pipeline.
- [ ] Next.js production build (`npm run build`) generates cleanly with zero TypeScript errors.
- [ ] MongoDB indexes created:
  - `questions`: `slug` (unique), `status`, `tags`
  - `submissions`: `id` (unique), `questionId`, `userId`, `status`, `createdAt`
- [ ] Cloud Run scale-to-zero tested and cold-start measured (<2.5 seconds).
- [ ] Adversarial test suite passed (fork bomb, infinite loops, huge stdout, unauthorized `/etc/passwd` reads).
- [ ] Cloud Monitoring alerts established:
  - API 5xx Error Rate > 1%
  - Worker Execution Timeout Rate > 5%
  - Queue Age > 10 seconds
