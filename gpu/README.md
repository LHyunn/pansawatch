# PansaWatch GPU Server — vLLM deployment

Local LLM serving for Korean legal information extraction (IE) on **RTX 6000 Ada Generation (48GB VRAM)**.

Default model: **Qwen 3.6 27B** (recommended) — Apache 2.0, hybrid attention, strong Korean.
Alternative: **Gemma 4 31B** (Apache 2.0, multimodal-capable).

The vLLM server exposes an **OpenAI-compatible HTTP API** at `:8000/v1/*`. PansaWatch calls it via the `openai` npm client over the local network (Tailscale or direct).

## Prerequisites on the GPU server

```bash
# 1. NVIDIA driver — check (need ≥ 550 for Ada FP8)
nvidia-smi

# 2. Docker + NVIDIA Container Toolkit
docker --version
docker compose version
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi  # smoke test

# If missing, on Ubuntu:
#   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
#   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
#   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
#   sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker
```

## Deploy

PansaWatch는 GPU 서버의 `/home/hyun/` 을 프로젝트 root로 사용. gpu/, scripts/, data/ 가 home 직하 위치.

```bash
# 1. 프로젝트 sync (로컬 → GPU 서버)
rsync -avz -e "ssh -p 10002" --exclude='node_modules' --exclude='.next' \
  ./ hyun@115.145.134.192:/home/hyun/

# 2. SSH in
ssh -p 10002 hyun@115.145.134.192
cd /home/hyun/gpu

# 3. Configure
cp .env.example .env
$EDITOR .env  # Set HF_TOKEN, MODEL

# 4. (수동 테스트) 컨테이너 기동 + 헬스 체크
docker compose pull
docker compose up -d
./healthcheck.sh

# 5. (수동 테스트 종료 후) 컨테이너 내림
docker compose down

# 6. 운영은 cron이 자동 처리 — gpu/crontab.example 참조

# 6. Verify
chmod +x healthcheck.sh
./healthcheck.sh
```

## Model selection

The `.env.example` file documents the candidate model names. Verify the exact name on HuggingFace before setting `MODEL=`:

```bash
# Check if a model name resolves on HF
curl -fsSL "https://huggingface.co/api/models/Qwen/Qwen3.6-27B-AWQ" | jq -r '.id, .gated, .downloads' 2>/dev/null
```

### Recommendation matrix

| Goal | Model | Quantization | Approx VRAM |
|---|---|---|---|
| **Default — best balance** | Qwen 3.6 27B | AWQ INT4 | ~14GB weights + KV cache |
| **Max quality, FP8 native** | Qwen 3.6 27B | FP8 (Ada Transformer Engine) | ~27GB weights |
| **Multimodal use case** | Gemma 4 31B | FP8 or AWQ | ~31GB / ~16GB |
| **Fast iteration / smaller** | Qwen 3.6 14B (if exists) | BF16 or AWQ | ~28GB / ~7GB |

If **the model name doesn't exist** on HF (e.g., -AWQ variant not yet released by community), fall back to:
1. Base BF16 model + vLLM online quantization: add `--quantization fp8` to docker-compose command (works only if BF16 fits in VRAM, which 27B ≈ 54GB does NOT — so this requires renting a bigger GPU briefly to quantize once, OR using GPTQ/AWQ tooling locally).
2. Pick a smaller variant of the same family.

## Endpoints

After deployment, available at `http://localhost:8000/v1/*` (or `http://<gpu-host>:8000/v1/*` if accessing from PansaWatch):

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check |
| `GET /v1/models` | List loaded models |
| `POST /v1/chat/completions` | Chat-style inference (use `messages: [...]`) |
| `POST /v1/completions` | Raw completion |

Both completion endpoints accept `guided_json: <jsonschema>` (vLLM extension) for **schema-strict structured output** — essential for legal IE.

## Connectivity from PansaWatch

The GPU server has restricted inbound. Use one of:

### Tailscale (recommended for v1)
```bash
# On GPU server
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Note the tailnet IP/hostname
tailscale ip -4
# Then in PansaWatch .env.local:
#   LOCAL_LLM_BASE_URL=http://<tailnet-ip>:8000/v1
```

### Cloudflare Tunnel (alternative)
```bash
# Issues a public hostname without opening ports
cloudflared tunnel --url http://localhost:8000
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `OutOfMemoryError` on startup | Model too big for 48GB | Use AWQ/GPTQ INT4 variant; lower `MAX_MODEL_LEN` |
| `unsupported quantization method` | vLLM version too old for hybrid arch | `docker compose pull` to grab latest; check vLLM release notes for Qwen 3.6 support |
| `CUDA error: no kernel image is available` | FP8 not supported | Driver < 550, or running on non-Ada GPU. Switch to AWQ. |
| `/health` 503 for >5 min | Still downloading model from HF | `docker logs pansawatch-llm` — watch for "Loading checkpoint" progress |
| `xgrammar` decoding errors | Tokenizer mismatch | Drop `--guided-decoding-backend xgrammar`, fall back to `outlines` |
| Throughput much lower than expected | Prefix cache cold | Send the same system prompt 2-3x; subsequent calls are 5-10x faster |

## Operational notes

- **Container lifecycle (운영)**: `restart: "no"` 정책. cron entrypoint (`scripts/cron/run-daily.sh`) 가 매 실행 시 자동으로 `docker compose up -d` → `down` 으로 라이프사이클 관리. **평소엔 컨테이너가 떠있지 않음** — GPU 자유.
- **Cold start cost**: 매 cron 실행마다 콜드 스타트. Gemma 4 31B FP8 ~3-5분, KURE-v1 ~30초 로드. HF 캐시는 `./hf-cache/` 영속이므로 weight 재다운로드 없음.
- **Total run time**: 컨테이너 기동 ~5분 + 파이프라인 ~17분 + down ~10초 = **약 22분/run**. cron 12:00, 18:00 = 일일 GPU 점유 ~44분.
- **Disk**: 모델 캐시 `./hf-cache/`. Gemma 4 31B ~62GB (BF16) → FP8로 양자화되어 GPU에 31GB 로드. KURE-v1 ~1.1GB.
- **Logs**: pipeline 로그는 `~/logs/pipeline-*.log`, vLLM 로그는 `docker compose logs vllm-gemma4`.
- **수동 디버그**: `cd gpu/ && docker compose up -d && ./healthcheck.sh` 로 컨테이너 띄워두고 ad-hoc 호출 가능. 작업 후 `docker compose down`.
- **Single-GPU exposure**: 단일 GPU 호스트 배포로 failover 없음. vLLM 콜드 스타트 실패 시 cron 종료 (코드 2). 다음 run에서 자동 재시도.
