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

```bash
# 1. Copy this gpu/ directory to the GPU server
#    (from your local machine)
scp -P 10002 -r gpu/ gpuadmin@115.145.134.192:~/pansawatch-llm/

# 2. SSH in
ssh -p 10002 gpuadmin@115.145.134.192
cd ~/pansawatch-llm

# 3. Configure
cp .env.example .env
$EDITOR .env  # Set HF_TOKEN, MODEL

# 4. Start (first run will download the model — 15-50GB depending on quant)
docker compose pull
docker compose up -d

# 5. Watch logs while loading (model load takes 1-3 min once downloaded)
docker compose logs -f vllm

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

- **Disk**: model cache lives in `./hf-cache/` (mapped from `HF_CACHE_DIR`). 27B AWQ ~14GB on disk; FP8 ~27GB; BF16 ~54GB.
- **Restart cost**: container restart reloads the model from disk (~1-3 min). HF downloads happen only on first run with that model name.
- **Logs**: `docker compose logs -f vllm` (rotated at 100MB × 5 files).
- **Updates**: `docker compose pull && docker compose up -d` — vLLM is rapidly evolving, especially for new models.
- **Single-GPU exposure**: this is a single-GPU deployment with no failover. If vLLM crashes, the IE pipeline blocks. PansaWatch should implement Claude API fallback for critical-path requests (see hybrid IE design in `docs/pipeline-architecture.md`).
