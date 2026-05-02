#!/usr/bin/env bash
# PansaWatch — daily pipeline cron entrypoint.
#
# Lifecycle:
#   1. Start vLLM containers (gpu/docker-compose.yml)
#   2. Wait for /health on both endpoints (cold start ~3-5 min for Gemma 4)
#   3. Run daily-court-pipeline.mjs
#   4. Stop vLLM containers (trap on EXIT — runs even on failure)
#
# 결과: GPU는 cron 실행 시간(~20분)만 점유, 그 외엔 자유.
#
# crontab:
#   TZ=Asia/Seoul
#   0 12 * * * /home/hyun/scripts/cron/run-daily.sh
#   0 18 * * * /home/hyun/scripts/cron/run-daily.sh

set -euo pipefail

# Project root (this script lives at <root>/scripts/cron/run-daily.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT}"

DATE="$(date +%F)"
TS="$(date +%FT%H%M)"
LOG_DIR="${ROOT}/logs"
LOG="${LOG_DIR}/pipeline-${TS}.log"
mkdir -p "${LOG_DIR}"

log() { echo "[$(date +%FT%H%M)] $*" | tee -a "${LOG}"; }

# Load runtime env (NAVER_*, LOCAL_LLM_BASE_URL, EMBED_BASE_URL, LLM_MODEL, EMBED_MODEL).
if [ ! -f "${ROOT}/.env.runtime" ]; then
  echo "[${TS}] FATAL: .env.runtime not found at ${ROOT}/.env.runtime" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "${ROOT}/.env.runtime"
set +a

COMPOSE_FILE="${ROOT}/gpu/docker-compose.yml"
LLM_BASE="${LOCAL_LLM_BASE_URL:-http://localhost:8000/v1}"
EMBED_BASE="${EMBED_BASE_URL:-http://localhost:8001/v1}"
LLM_HEALTH="${LLM_BASE%/v1}/health"
EMBED_HEALTH="${EMBED_BASE%/v1}/health"

# Cleanup — stop containers on exit, success or failure.
cleanup() {
  local code=$?
  log "stopping vLLM containers (exit=${code})"
  docker compose -f "${COMPOSE_FILE}" down >> "${LOG}" 2>&1 || true
  # Log rotation
  find "${LOG_DIR}" -name 'pipeline-*.log' -type f -mtime +14 -delete 2>/dev/null || true
  exit "${code}"
}
trap cleanup EXIT

# ─── Step A: bring up vLLM ──────────────────────────────────────────
log "starting vLLM containers (Gemma 4 + KURE-v1)"
docker compose -f "${COMPOSE_FILE}" up -d >> "${LOG}" 2>&1

# ─── Step B: wait for /health ───────────────────────────────────────
log "waiting for vLLM /health (Gemma 4 cold start ~3-5 min, KURE ~30 sec)"
HEALTH_OK=0
for i in $(seq 1 120); do
  llm_ok=0
  embed_ok=0
  curl -fsS --max-time 5 "${LLM_HEALTH}" > /dev/null 2>&1 && llm_ok=1
  curl -fsS --max-time 5 "${EMBED_HEALTH}" > /dev/null 2>&1 && embed_ok=1
  if [ "${llm_ok}" = "1" ] && [ "${embed_ok}" = "1" ]; then
    log "both vLLM services healthy after ${i} attempts (~$((i * 15))s)"
    HEALTH_OK=1
    break
  fi
  sleep 15
done
if [ "${HEALTH_OK}" != "1" ]; then
  log "FATAL: vLLM not healthy after 30 min — check 'docker compose logs'"
  exit 2
fi

# ─── Step C: run pipeline ───────────────────────────────────────────
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [ -z "${NODE_BIN}" ]; then
  log "FATAL: node not found in PATH (set NODE_BIN env)"
  exit 4
fi

log "starting pipeline (date=${DATE})"
set +e  # don't trap exit code yet, we want to log it
"${NODE_BIN}" scripts/daily-court-pipeline.mjs --date "${DATE}" --query "법원 선고" \
  >> "${LOG}" 2>&1
PIPELINE_EXIT=$?
set -e
log "pipeline exited with code ${PIPELINE_EXIT}"

# trap cleanup will run docker compose down + log rotation on EXIT
exit "${PIPELINE_EXIT}"
