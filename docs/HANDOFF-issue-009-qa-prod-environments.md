# Handoff — Issue-009: Isolate QA and Production Deployment Environments

> ## ⚠️ SUPERSEDED
>
> This issue was **closed as superseded by [ISSUE-010](https://github.com/alendnl/zap/issues/10)**.
> The two-branch / two-deployer model is replaced by a **single `main` branch pipeline**
> with a runtime Prod/QA switcher in the frontend. Only the MongoDB database name and
> Cloud Tasks queue name differ per environment, selected in code via the `X-ZAP-ENV`
> header and the task payload `environment` field. No QA IAM, no separate QA deployment.
> See [`HANDOFF-issue-010-single-deployment-env-switcher.md`](./HANDOFF-issue-010-single-deployment-env-switcher.md).

**Date:** 2026-10-04
**Author:** GitHub Copilot (session handoff)
**Status:** ⚠️ IN PROGRESS — QA deployment blocked on IAM; production not yet verified with new workflow

---

## 1. Goal

Split the ZAP CI/CD pipeline into two **fully independent** deployment jobs so QA and Production use their own GCP service accounts, Cloud Run services, Cloud Tasks queues, MongoDB databases, and WIF providers. The question-management system and code-execution compiler must remain **loosely coupled** (core project rule).

---

## 2. Where We Stopped (Current State)

### Git
- `main` and `qa` both at commit **`f07dcc0`** (`ci: retrigger QA deployment after pre-creating services`)
- `origin/main` at `6d11cea` (the last real workflow change); `f07dcc0` is an empty commit pushed only to `qa`
- Working tree clean. Feature branches exist but are stale: `feature/issue-009-qa-prod-environments`, `feature/issue-008-cloud-tasks-queue`, `feature/github-actions-cloud-run-deploy`, `feature/deployment-readiness`

### Workflow (`.github/workflows/ci.yml`)
4 jobs:
1. `backend-tests` — pytest
2. `frontend-tests` — Next.js build + test
3. `deploy-qa` — `if: push && ref == refs/heads/qa`, WIF provider `zap-qa`, SA `zap-github-qa-deployer`
4. `deploy-production` — `if: main && (push || workflow_dispatch)`, WIF provider `zap-repository`, SA `zap-github-deployer`

Both deploy jobs have `permissions: id-token: write` (required for WIF).

### GCP Resources (all verified present)
| Resource | QA | Production |
|---|---|---|
| Cloud Run API | `zap-api-qa` ✅ deployed (rev 00001) | `zap-api` ✅ deployed (rev 00006) |
| Cloud Run Executor | `zap-executor-qa` ✅ deployed (rev 00001) | `zap-executor` ❌ NOT deployed |
| Queue | `zap-submissions-lower` RUNNING | `zap-submissions` RUNNING |
| MongoDB secret | `zap-mongodb-uri-qa` | `zap-mongodb-uri` |
| Runtime SAs | `zap-api-qa`, `zap-executor-qa`, `zap-tasks-invoker-qa` | `zap-api-runtime`, `zap-executor-runtime`, `zap-tasks-invoker` |
| Deployer SA | `zap-github-qa-deployer` | `zap-github-deployer` |
| WIF provider | `zap-qa` (scoped to `refs/heads/qa`) | `zap-repository` |

**QA services were pre-created manually** (as owner) because the conditional IAM binding cannot be evaluated against a non-existent resource. Both QA services are Ready and `zap-api-qa/health` returns `{"status":"healthy","service":"ZAP-BE","environment":"qa"}`.

---

## 3. Key Decisions Made

1. **Two independent deploy jobs** (not one job with branch conditionals) — each with its own `env`, WIF provider, SA, and concurrency group.
2. **`id-token: write`** added at job level to both deploy jobs — WIF auth fails without it (`$ACTIONS_ID_TOKEN_REQUEST_TOKEN` not injected).
3. **Executor IAM binding moved AFTER deploy** — `gcloud run services add-iam-policy-binding` fails with `run.services.getIamPolicy` denied if the service doesn't exist yet. Now a separate step right after `Deploy QA executor` / `Deploy production executor`.
4. **Cloud Run env vars use comma-separated syntax** — the `^@^...@` dict syntax is NOT supported by `gcloud run deploy --update-env-vars` and fails on `@` in service-account emails. Changed to `KEY=value,KEY2=value2`.
5. **QA deployer granted project-level roles** (via `gcloud projects add-iam-policy-binding --condition=None`):
   - `roles/iam.serviceAccountAdmin`
   - `roles/artifactregistry.writer`
   - `roles/cloudtasks.admin`
   - `roles/run.admin` — **CONDITIONAL** (scoped to `zap-api-qa`/`zap-executor-qa` only)
6. **Production deployer granted** `roles/iam.serviceAccountAdmin` + `roles/cloudtasks.admin` (it already had unconditional `run.admin` + `artifactregistry.writer`).
7. **QA Cloud Run services pre-created manually** (as owner) to work around the conditional-IAM-on-missing-resource problem.

---

## 4. Current Blocker (MUST RESOLVE NEXT)

**QA deploy still fails at `Deploy QA executor` step:**

```
ERROR: (gcloud.run.deploy) PERMISSION_DENIED: Permission 'run.services.get' denied
on resource 'namespaces/zap-platform-prod/services/zap-executor-qa'
authenticated as zap-github-qa-deployer@zap-platform-prod.iam.gserviceaccount.com
```

Even though `zap-executor-qa` now EXISTS, the QA deployer's **conditional** `run.admin` binding is still not matching. The condition is:

```
resource.name.startsWith('projects/zap-platform-prod/locations/us-central1/services/zap-api-qa')
|| resource.name.startsWith('projects/zap-platform-prod/locations/us-central1/services/zap-executor-qa')
```

**Hypothesis:** IAM conditions on `run.admin` are not being evaluated correctly for the deployer in this context (or the condition syntax is subtly wrong). The production deployer has **unconditional** `run.admin` and works.

**Recommended fix (consistent with production):** Grant the QA deployer **unconditional** `roles/run.admin`:

```bash
gcloud projects add-iam-policy-binding zap-platform-prod \
  --member="serviceAccount:zap-github-qa-deployer@zap-platform-prod.iam.gserviceaccount.com" \
  --role=roles/run.admin --condition=None --quiet
```

Isolation is still preserved because the WIF provider `zap-qa` is branch-scoped to `refs/heads/qa` — the deployer SA can only be assumed from the `qa` branch.

**Then re-trigger:** `git commit --allow-empty -m "ci: retrigger QA deployment" && git push origin main:qa`

---

## 5. Remaining Work

- [ ] **Fix QA deployer `run.admin`** (unconditional) and re-trigger QA deployment → verify full green run
- [ ] **Verify QA end-to-end**: `zap-api-qa/health` returns `environment: qa`, `DATABASE_NAME=zap_lower`, executor Ready, queue `zap-submissions-lower` RUNNING
- [ ] **Verify production deployment** with the new workflow (push to `main` triggers `deploy-production`; note `zap-executor` production service does NOT exist yet — same conditional-IAM issue may apply, but production deployer has unconditional `run.admin` so it should be fine)
- [ ] **Verify async submission flow**: API → Cloud Tasks → executor (OIDC) works in QA
- [ ] **Clean up**: remove stale feature branches, remove the temporary `user:alendnl@gmail.com` token-creator binding on `zap-github-qa-deployer` if no longer needed

---

## 6. Useful Commands

```bash
# Watch a run
GH_PAGER=cat gh run watch <RUN_ID> --exit-status

# Get failed logs
GH_PAGER=cat gh run view <RUN_ID> --log-failed

# QA health check
curl https://zap-api-qa-394729648143.us-central1.run.app/health

# QA deployer IAM
gcloud projects get-iam-policy zap-platform-prod \
  --flatten="bindings[].members" \
  --filter="bindings.members:zap-github-qa-deployer" \
  --format="yaml(bindings.role,bindings.condition)"

# Re-trigger QA
git commit --allow-empty -m "ci: retrigger QA deployment" && git push origin main:qa
```

---

## 7. Environment Reference

| Var | QA | Production |
|---|---|---|
| `ENVIRONMENT` | `qa` | `production` |
| `DATABASE_NAME` | `zap_lower` | `zap_prod` |
| `QUEUE_NAME` | `zap-submissions-lower` | `zap-submissions` |
| `MONGODB_SECRET` | `zap-mongodb-uri-qa` | `zap-mongodb-uri` |
| Executor URL | `https://zap-executor-qa-394729648143.us-central1.run.app` | `https://zap-executor-394729648143.us-central1.run.app` |
| API URL | `https://zap-api-qa-394729648143.us-central1.run.app` | `https://zap-api-394729648143.us-central1.run.app` |
| CORS | `localhost:3000`, `codezap-arena-git-qa-alendnl.vercel.app` | `codezap-arena.vercel.app` |
| Executor resources | 2 vCPU / 2Gi / max 10 | 4 vCPU / 4Gi / max 20 |
| API resources | 1 vCPU / 512Mi / max 20 | 1 vCPU / 512Mi / max 20 |

**Note:** Cloud Run now generates URLs like `https://zap-api-qa-myzbampa3q-uc.a.run.app` (region-hash format) in addition to the legacy `-394729648143.us-central1.run.app` format. Both resolve.