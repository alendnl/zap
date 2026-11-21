#!/usr/bin/env bash
# ==============================================================================
# ZAP Scaling Profile Switcher
# Usage:
#   ./infra/scripts/switch-scaling.sh normal
#   ./infra/scripts/switch-scaling.sh contest
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PROFILE="${1:-}"
if [[ "$PROFILE" != "normal" && "$PROFILE" != "contest" ]]; then
  echo "Usage: $0 [normal|contest]"
  echo "  normal  : Scales down to 0 instances when idle, reduces CPU/RAM (zero idle cost)"
  echo "  contest : Pre-warms instances, sets 4 CPU / 4 GiB executor, high queue throughput"
  exit 1
fi

PROFILE_FILE="${ROOT_DIR}/infra/profiles/${PROFILE}.env"
if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Error: Profile file not found: $PROFILE_FILE"
  exit 1
fi

# Load profile
# shellcheck disable=SC1090
source "$PROFILE_FILE"

PROJECT_ID="${GCP_PROJECT_ID:-zap-platform-prod}"
REGION="${GCP_LOCATION:-us-central1}"
API_SERVICE="zap-api"
EXECUTOR_SERVICE="zap-executor"
QUEUE="zap-submissions"

echo "================================================================================"
echo "Applying ZAP Scaling Profile: [${PROFILE_NAME^^}]"
echo "Project: $PROJECT_ID | Region: $REGION"
echo "================================================================================"

# 1. Update Cloud Tasks Queue
echo "Updating Cloud Tasks queue: $QUEUE..."
gcloud tasks queues update "$QUEUE" \
  --project="$PROJECT_ID" --location="$REGION" \
  --max-dispatches-per-second="$TASKS_MAX_RATE" \
  --max-concurrent-dispatches="$TASKS_MAX_CONCURRENT" \
  --max-attempts="$TASKS_MAX_ATTEMPTS" \
  --quiet

# 2. Update zap-api
echo "Updating Cloud Run service: $API_SERVICE..."
gcloud run services update "$API_SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" \
  --min-instances="$API_MIN_INSTANCES" \
  --max-instances="$API_MAX_INSTANCES" \
  --cpu="$API_CPU" \
  --memory="$API_MEMORY" \
  --concurrency="$API_CONCURRENCY" \
  --scaling-concurrency-target="$API_CONCURRENCY_TARGET" \
  --quiet

# 3. Update zap-executor
echo "Updating Cloud Run service: $EXECUTOR_SERVICE..."
if ! gcloud run services update "$EXECUTOR_SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" \
  --min-instances="$EXECUTOR_MIN_INSTANCES" \
  --max-instances="$EXECUTOR_MAX_INSTANCES" \
  --cpu="$EXECUTOR_CPU" \
  --memory="$EXECUTOR_MEMORY" \
  --concurrency="$EXECUTOR_CONCURRENCY" \
  --scaling-concurrency-target="$EXECUTOR_CONCURRENCY_TARGET" \
  --timeout="$EXECUTOR_TIMEOUT" \
  --quiet 2>/tmp/update_exec.err; then
    cat /tmp/update_exec.err
    echo "Warning: Target max-instances ($EXECUTOR_MAX_INSTANCES) with CPU=$EXECUTOR_CPU exceeded regional quota."
    echo "Falling back to maximum permitted 14 instances (14 * 4 CPU = 56 vCPUs)..."
    gcloud run services update "$EXECUTOR_SERVICE" \
      --project="$PROJECT_ID" --region="$REGION" \
      --min-instances="$EXECUTOR_MIN_INSTANCES" \
      --max-instances=14 \
      --cpu="$EXECUTOR_CPU" \
      --memory="$EXECUTOR_MEMORY" \
      --concurrency="$EXECUTOR_CONCURRENCY" \
      --scaling-concurrency-target="$EXECUTOR_CONCURRENCY_TARGET" \
      --timeout="$EXECUTOR_TIMEOUT" \
      --quiet
fi

echo "================================================================================"
echo "Successfully switched to [${PROFILE_NAME^^}] profile!"
echo "================================================================================"
