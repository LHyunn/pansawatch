---
name: extract-naver-news
description: Extract structured court-case info from a Naver news URL using vLLM + Gemma 4 31B and auto-register into PansaWatch (data/articles.json + data/judgeArticles.json link). Use when the user provides one or more Naver news URLs (n.news.naver.com/...) and asks to extract, ingest, or register them as PansaWatch articles — typical phrasings include "이 기사 추출해줘", "이 URL articles에 등록", "데이터 수집 후 json으로 정리해서 최근 뉴스 탭에 뜨게", or pasting a raw Naver URL with no other instruction. Wraps scripts/extract-and-register.mjs which manages the GPU container lifecycle end-to-end (start vLLM → extract → cleanup GPU memory) and matches the extracted 재판장 to data/judges.json automatically.
---

# Extract & register Naver news article

Wraps `scripts/extract-and-register.mjs` for ingesting a Naver news article into the PansaWatch civic-tech project's article feed and linking it to the relevant judge.

## When to use

Trigger this skill when **all** of the following hold:

1. The user has provided ≥1 URL on the host `n.news.naver.com` (or `news.naver.com`)
2. The user wants the article(s) ingested — phrasings like:
   - "이 기사 추출해줘 / 등록해줘 / 처리해줘"
   - "이 URL을 articles에 추가"
   - "데이터 수집 후 articles.json에 …"
   - "최근 뉴스 탭에 뜨게 해줘"
   - Or just pastes the URL with no other instruction (in PansaWatch context)
3. The user has not asked for a different output format (PDF, Excel, summary-only, etc.)

**Skip this skill** for: non-Naver URLs, "just summarize this article" without persistence, or when the user explicitly says they don't want it registered into the dataset.

## What the wrapper does (one command, end-to-end)

```bash
HF_TOKEN=hf_xxx node scripts/extract-and-register.mjs <naver-url> [<url2> ...] [--keep]
```

### `--keep` 옵션 — 컨테이너 유지/정리 선택

- **default** (no flag): 실행 끝나면 컨테이너 제거 + GPU 메모리 회수.
- **`--keep`**: 실행 끝나도 컨테이너 유지. 다음 호출 시 자동으로 warm reuse (모델 재로드 없음, 호출당 ~10초만 추가).

권장 패턴:
- 한 번에 끝낼 작업 → 옵션 없이 (기본).
- 여러 번에 나눠 올릴 때 → 중간 호출은 `--keep`, **마지막 호출에선 `--keep` 빼기** → 자연스럽게 정리됨.
- 명시적으로 즉시 내리고 싶으면: `ssh -p <GPU_SSH_PORT> <GPU_SSH_USER>@<GPU_SSH_HOST> 'docker rm -f pansawatch-extract'`

### Steps inside

1. **Pre-check** — drops URLs already present in `data/articles.json` (idempotent; same URL re-run = no GPU cost).
2. **Extract** — invokes `scripts/extract-from-naver-url.mjs`:
   - **Warm reuse**: 컨테이너가 이미 떠있고 `/health` OK면 그대로 재사용 (모델 재로드 skip).
   - 그렇지 않으면 vLLM 컨테이너 `vllm/vllm-openai:v0.20.1-cu129` + `google/gemma-4-31B-it` (FP8 online quantization) 신규 시작.
   - Waits for `/health` (~3.5 min cold, ~30s warm if cache hot).
   - Fetches each URL → parses Naver mirror DOM → calls LLM with strict JSON schema.
   - Returns `{date, court, bench, case_number, judge, charges, demand, sentence, summary1, summary2}` per URL.
   - `--keep` 미지정 시 컨테이너 종료 + GPU 메모리 회수.
3. **Register** — for each successful extraction:
   - Saves full extraction → `data/news-extractions/article-N.json`.
   - Appends simplified entry → `data/articles.json` (`id, title, url, source, publishedAt, aiSummary=summary2, collectedAt`).
   - **Auto-link to judge** — searches `data/judges.json` by `name + court`, appends entry to `data/judgeArticles.json` (relevanceScore=1.0).
   - Article ID = `max(articles.json IDs, judgeArticles.json articleIds) + 1` — avoids collision with mock-data leftovers.

## Required environment

| Var | Required | Source |
|---|---|---|
| `HF_TOKEN` | recommended | https://huggingface.co/settings/tokens (raises HF download rate; without it the first model pull is slow but still works) |
| SSH access to `<GPU_SSH_USER>@<GPU_SSH_HOST>:<GPU_SSH_PORT>` | required | The script SSH-orchestrates the remote vLLM container |

## Output

**Stdout** (JSON, pipeable):
```json
{
  "registered": ["article-N"],
  "linked": [{"articleId": "article-N", "judgeId": "judge-M"}],
  "unlinked": ["article-K"],
  "failed": ["url"],
  "skipped": [{"url": "...", "id": "article-X"}],
  "total_articles": <count>,
  "total_judge_links": <count>
}
```

**Stderr** (human-readable progress + summary).

**Side effects**:
- `data/articles.json` ← new entry appended
- `data/judgeArticles.json` ← new judge↔article link
- `data/news-extractions/article-N.json` ← rich extraction file

## After-run checklist (the agent should also do)

After invoking the script, the agent should:

1. **Confirm registration** by reading the `registered` array from stdout JSON.
2. **Report unlinked articles** — if `unlinked` is non-empty, the article registered fine but no judge match was found (judge not in `judges.json`, or court name mismatch). Show the unlinked entries to the user.
3. **Note dev-server caching** — Next.js dev (`npm run dev`) caches `articlesByJudge` map at module init. The home page (`/`) shows new articles immediately, but `/judges/<id>` profile pages may need a dev server restart to reflect the new `judgeArticles.json` link.

## Examples

### Single URL
```bash
HF_TOKEN=hf_xxx node scripts/extract-and-register.mjs \
  "https://n.news.naver.com/mnews/article/088/0001008109?sid=102"
```
→ Result: `article-N` registered, linked to `judge-1818 (송병훈, 수원지방법원)`. ~4 min total (cold start).

### Batch (single container start amortized across all URLs)
```bash
HF_TOKEN=hf_xxx node scripts/extract-and-register.mjs \
  "https://n.news.naver.com/mnews/article/001/0016053856?sid=102" \
  "https://n.news.naver.com/mnews/article/052/0002347474?sid=102" \
  "https://n.news.naver.com/mnews/article/469/0000928371?sid=102"
```
→ ~5 min total for 3 URLs (model loads once, ~10s per URL after).

### Idempotency demo
Re-running on the same URL → skipped instantly, no GPU spin-up:
```
⊘ Already registered (skipping 1):
    article-N  https://n.news.naver.com/...
Nothing to do — all URLs are already registered. Exiting (no GPU spin-up).
```

### Warm-reuse 패턴 (여러 번 나눠 올릴 때)
```bash
# 첫 번째 — 컨테이너 시작 + 기사 1 등록 + 컨테이너 유지
HF_TOKEN=hf_xxx node scripts/extract-and-register.mjs <url1> --keep      # 3.8분

# 두 번째 — warm reuse + 기사 2 등록 + 컨테이너 유지  
HF_TOKEN=hf_xxx node scripts/extract-and-register.mjs <url2> --keep      # ~12초

# 세 번째 — warm reuse + 기사 3 등록 + 컨테이너 유지
HF_TOKEN=hf_xxx node scripts/extract-and-register.mjs <url3> --keep      # ~12초

# … 마지막 — warm reuse + 등록 + **컨테이너 정리** (--keep 빼기)
HF_TOKEN=hf_xxx node scripts/extract-and-register.mjs <urlN>             # ~14초 (정리 포함)
```

3건 미만일 때도 warm reuse 덕에 다중 URL 한 번에 묶는 것보다 시간 거의 동일. **단점은 GPU가 그동안 ~32GB 점유 상태**라는 것뿐.

## Output schema details

`data/articles.json` entry (visible on home + `/news`):
```json
{
  "id": "article-N",
  "title": "기사 원제목",
  "url": "https://n.news.naver.com/...",
  "source": "매체명 (예: 매일신문, 연합뉴스)",
  "publishedAt": "2026-05-02T17:10:11Z",
  "aiSummary": "{재판장} {법원약식} {직위}, {사건 개요 + 결과}. ~22어절",
  "collectedAt": "<ISO timestamp>"
}
```

`data/news-extractions/article-N.json` entry (full extraction, used for case detail / debugging):
```json
{
  "id": "article-N",
  "url": "...",
  "fetched_at": "...",
  "source": { "publisher", "pub_date", "title" },
  "extraction": {
    "date": "YYYY-MM-DD",        // 선고일
    "court": "서울고등법원",       // 정식 법원명
    "bench": "형사15-2부",         // 재판부
    "case_number": "2024노1234",  // 사건번호 (없으면 null)
    "judge": "신종오 부장판사",   // 재판장
    "charges": "자본시장법 위반", // 적용 법령
    "demand": "징역 15년",        // 검찰 구형 (없으면 null)
    "sentence": "징역 4년, 벌금 5,000만원, 추징금 2,094만원",
    "summary1": "10어절 한 줄 요약",
    "summary2": "20어절 두 줄 요약, 재판장+법원으로 시작"
  }
}
```

## Limitations & known issues

- **Naver mirror only** — `n.news.naver.com/...` URLs work reliably. External publisher URLs (originallink to munhwa.com, hani.co.kr, etc.) often fail the DOM parser.
- **Judge matching coverage** — only matches judges already in `data/judges.json` (2,709 entries from 법원공보 PDFs). Articles about judges not in the dataset are registered but go to `unlinked` (no judge link).
- **Driver/CUDA pinning** — requires `vllm/vllm-openai:v0.20.1-cu129` (NOT `:latest`, which needs CUDA 13.0+ / driver 575+). Server has driver 560, max CUDA 12.6.
- **Cold start cost** — ~3.5 min (model load + torch.compile + warm-up). Amortized across multi-URL batches.
- **Dev-server cache** — `lib/data.ts` builds `articlesByJudge` Map at module init; new judge links may not reflect on `/judges/<id>` until `npm run dev` restart. Home `/` and `/news` paths read `articles[]` directly and update immediately.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `"Could not extract body"` | Non-mirror URL or unusual DOM | Use Naver mirror URL (n.news.naver.com), or fetch original publisher manually |
| `failed.length > 0` in output | LLM call timeout or schema-strict failure | Re-run with `--keep-container` to retry without cold-start cost (TODO: not yet implemented) |
| `unlinked.length > 0` | 재판장 not in `judges.json`, or court name mismatch | Verify by reading `data/news-extractions/article-N.json` `extraction.judge` and `extraction.court` — adjust judges.json or accept as-is |
| HTTP 500 on container start | GPU memory occupied / port 8000 taken | The script auto-removes prior `pansawatch-extract` container; for orphans run `ssh ... docker rm -f <name>` manually |
| `cuda>=13.0 unsatisfied` | Tried `:latest` image | Stay on `:v0.20.1-cu129` (already pinned in script) |

## Related files

- `scripts/extract-and-register.mjs` — the wrapper (this skill invokes)
- `scripts/extract-from-naver-url.mjs` — the underlying extractor (vLLM lifecycle, parsing, LLM call)
- `data/articles.json` — flat article feed (visible on `/`, `/news`)
- `data/judgeArticles.json` — judge ↔ article M2M links
- `data/news-extractions/article-*.json` — rich extractions per article
- `data/judges.json` — judge master (read-only, source of judge matching)
