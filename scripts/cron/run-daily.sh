#!/usr/bin/env bash
# PansaWatch — daily pipeline cron entrypoint.
# Single shell script registered in crontab. Loads runtime env, runs daily pipeline, rotates logs.
#
# crontab:
#   TZ=Asia/Seoul
#   0 12 * * * /home/gpuadmin/pansawatch/scripts/cron/run-daily.sh
#   0 18 * * * /home/gpuadmin/pansawatch/scripts/cron/run-daily.sh

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

# Load runtime env (NAVER_*, LOCAL_LLM_BASE_URL, EMBED_BASE_URL, LLM_MODEL, EMBED_MODEL).
# Format: KEY=VALUE per line. Operator creates this file once at deploy time.
if [ ! -f "${ROOT}/.env.runtime" ]; then
  echo "[${TS}] FATAL: .env.runtime not found at ${ROOT}/.env.runtime" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "${ROOT}/.env.runtime"
set +a

# Sanity check vLLM endpoints before launching.
LLM_BASE="${LOCAL_LLM_BASE_URL:-http://localhost:8000/v1}"
EMBED_BASE="${EMBED_BASE_URL:-http://localhost:8001/v1}"

if ! curl -fsS --max-time 5 "${LLM_BASE%/v1}/health" > /dev/null 2>&1; then
  echo "[${TS}] FATAL: generation vLLM not healthy at ${LLM_BASE}" >&2
  exit 2
fi
if ! curl -fsS --max-time 5 "${EMBED_BASE%/v1}/health" > /dev/null 2>&1; then
  echo "[${TS}] FATAL: embedding vLLM not healthy at ${EMBED_BASE}" >&2
  exit 3
fi

# Run the pipeline. node path may vary by install; use full path or rely on PATH.
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [ -z "${NODE_BIN}" ]; then
  echo "[${TS}] FATAL: node not found in PATH" >&2
  exit 4
fi

echo "[${TS}] starting pipeline for date=${DATE}" | tee -a "${LOG}"
"${NODE_BIN}" scripts/daily-court-pipeline.mjs --date "${DATE}" --query "법원 선고" \
  >> "${LOG}" 2>&1

EXIT=$?
echo "[$(date +%FT%H%M)] pipeline exited with code ${EXIT}" | tee -a "${LOG}"

# Rotate logs older than 14 days
find "${LOG_DIR}" -name 'pipeline-*.log' -type f -mtime +14 -delete 2>/dev/null || true

exit "${EXIT}"
