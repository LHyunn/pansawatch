#!/usr/bin/env bash
# Verify both vLLM containers (Gemma 4 generation + KURE-v1 embedding) are healthy.
# Run on the GPU server, in the same dir as docker-compose.yml.

set -euo pipefail

LLM_PORT="${LLM_PORT:-8000}"
EMBED_PORT="${EMBED_PORT:-8001}"
LLM_BASE="http://localhost:${LLM_PORT}"
EMBED_BASE="http://localhost:${EMBED_PORT}"

step()    { printf "\n\033[1;34m▸ %s\033[0m\n" "$1"; }
ok()      { printf "  \033[1;32m✓\033[0m %s\n" "$1"; }
fail()    { printf "  \033[1;31m✗\033[0m %s\n" "$1"; exit 1; }

# ───── Generation: pansawatch-llm (Gemma 4) ──────────────────────────
step "[1/2] Generation — pansawatch-llm container"
state=$(docker inspect -f '{{.State.Status}}' pansawatch-llm 2>/dev/null || echo "missing")
[ "$state" = "running" ] || fail "container not running (state: $state) — run: docker compose up -d"
ok "container running"

step "vLLM /health (generation)"
for i in {1..6}; do
  if curl -fsS "$LLM_BASE/health" > /dev/null 2>&1; then ok "/health OK"; break; fi
  echo "    waiting for Gemma 4 to load... (${i}/6, retry in 30s)"
  sleep 30
  [ "$i" = "6" ] && fail "/health never came up — docker logs pansawatch-llm --tail 100"
done

step "Generation /v1/models"
gen_model=$(curl -fsS "$LLM_BASE/v1/models" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")
[ -n "$gen_model" ] || fail "no generation model loaded"
ok "model loaded: $gen_model"

step "Smoke test — Korean chat"
response=$(curl -fsS "$LLM_BASE/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$gen_model"'",
    "messages": [{"role":"user","content":"한 단어로 답해라: 대한민국의 최고 사법기관은?"}],
    "max_tokens": 20,
    "temperature": 0
  }')
content=$(echo "$response" | grep -oE '"content":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
[ -n "$content" ] || fail "empty response: $response"
ok "completion: $content"

step "Smoke test — schema-strict JSON"
response=$(curl -fsS "$LLM_BASE/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$gen_model"'",
    "messages": [{"role":"user","content":"서울고등법원의 정보를 JSON으로 답하라. 마크다운 없이."}],
    "max_tokens": 200,
    "temperature": 0,
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "court",
        "schema": {
          "type": "object",
          "properties": {
            "court_name": {"type": "string"},
            "level": {"type": "string"},
            "instance_type": {"type": "string"}
          },
          "required": ["court_name", "level", "instance_type"]
        }
      }
    }
  }')
content=$(echo "$response" | grep -oE '"content":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
[ -n "$content" ] || fail "guided JSON failed: $response"
ok "guided JSON: $content"

# ───── Embedding: pansawatch-embed (KURE-v1) ─────────────────────────
step "[2/2] Embedding — pansawatch-embed container"
state=$(docker inspect -f '{{.State.Status}}' pansawatch-embed 2>/dev/null || echo "missing")
[ "$state" = "running" ] || fail "container not running (state: $state) — run: docker compose up -d"
ok "container running"

step "vLLM /health (embedding)"
for i in {1..6}; do
  if curl -fsS "$EMBED_BASE/health" > /dev/null 2>&1; then ok "/health OK"; break; fi
  echo "    waiting for KURE-v1 to load... (${i}/6, retry in 15s)"
  sleep 15
  [ "$i" = "6" ] && fail "/health never came up — docker logs pansawatch-embed --tail 100"
done

step "Embedding /v1/models"
emb_model=$(curl -fsS "$EMBED_BASE/v1/models" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")
[ -n "$emb_model" ] || fail "no embedding model loaded"
ok "model loaded: $emb_model"

step "Smoke test — Korean embedding"
response=$(curl -fsS "$EMBED_BASE/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$emb_model"'",
    "input": "김건희 도이치모터스 주가조작 항소심 징역 4년"
  }')
dim=$(echo "$response" | grep -oE '"embedding":\[[^]]+\]' | head -1 | tr ',' '\n' | wc -l || echo "0")
[ "$dim" -gt 100 ] || fail "embedding dim too small ($dim) or missing: $response"
ok "embedding dim: $dim (KURE-v1 expected: 1024)"

printf "\n\033[1;32m✅ All checks passed. Both vLLM services ready.\033[0m\n"
printf "Generation: %s/v1  (model: %s)\n" "$LLM_BASE" "$gen_model"
printf "Embedding:  %s/v1  (model: %s)\n" "$EMBED_BASE" "$emb_model"
