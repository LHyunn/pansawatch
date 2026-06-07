---
name: register-controversial-news
description: End-to-end pipeline that searches Naver News for "법원 선고", filters articles depicting controversially-lenient sentences (Sonnet sub-agents in parallel), clusters duplicate coverage, picks representative per case (연합뉴스→YTN→KBS→SBS→MBC priority), and AUTO-REGISTERS each representative into PansaWatch via scripts/extract-and-register.mjs (vLLM Gemma 4 31B extraction → data/articles.json + data/judgeArticles.json link). Use when the user asks to find AND ingest controversial sentencing news in one shot — typical phrasings include "최근 양형 논란 기사 찾아서 등록까지 해줘", "/register-controversial-news 50", "솜방망이 사건 데이터셋에 자동 추가". For find-only without registration, use find-controversial-news instead. Idempotent across runs via persistent state at data/seen-articles.json.
---

# Find & register controversially-lenient sentencing news (Naver → PansaWatch)

Combines `find-controversial-news` discovery with `extract-naver-news` registration in a single skill. Use when the user wants automatic ingest of newly-found controversy cases.

## When to use

Trigger when the user asks for **discovery + registration** in one step:
- "최근 양형 논란 기사 찾아서 등록까지 해줘"
- "솜방망이 사건 자동으로 데이터셋에 추가"
- `/register-controversial-news`
- `/register-controversial-news 50`

**Skip this skill** when:
- User wants find-only without registration → `find-controversial-news`
- User provides specific URLs → `extract-naver-news`

## Argument

`/register-controversial-news [N]`
- `N` = how many Naver News results to fetch (default **100**, max **1000**, paginated)
- Larger N → more candidates → potentially more registrations → more vLLM time

## Pipeline

### Steps 1–5 — same as `find-controversial-news`

1. **Fetch** — `node scripts/find-controversial-articles.mjs --display <N> > data/temp/naver-news-batch.json`
2. **Batch & dispatch judgment** — split into 14-item batches → parallel sonnet sub-agents using `agent-prompt.md` (in this skill folder)
3. **Aggregate** controversial=true → `data/temp/judgments-controversial.json`
4. **Cluster** — single sonnet sub-agent reads `data/temp/cluster-input.json` (extracted from step 3) using `cluster-prompt.md` → writes `data/temp/clusters.json`
5. **Dedup** — `node scripts/dedup-by-case.mjs --clusters-file data/temp/clusters.json < data/temp/judgments-controversial.json > data/temp/representatives.json`

If step 3 yields 0 controversial articles, skip to cleanup and report "no new controversial cases found".

### Step 6 — Auto-register each representative

```bash
node scripts/extract-and-register.mjs \
  <rep1-url> <rep2-url> <rep3-url> ...
```

This invokes the `extract-naver-news` pipeline:
- Spins up vLLM container (~3.5 min cold start, amortized across all URLs)
- Extracts `{date, court, bench, judge, charges, demand, sentence, summary1, summary2}` per URL
- Writes `data/news-extractions/article-N.json` per article
- Appends entry to `data/articles.json`
- Auto-links to `data/judges.json` via name+court → updates `data/judgeArticles.json`
- Stops & removes container (frees GPU)

The wrapper is idempotent on its own — URLs already in `data/articles.json` are skipped, no GPU spin-up. So running this skill twice in a row on overlapping discovery is safe.

### Step 7 — Report to user

For each representative:
- Title + media + cluster size
- Registration result: `article-N` ID, judge link, or unlinked reason
- One-line summary from extraction (`summary1`)

Surface any failures (extract pipeline failures, judge-not-found, etc.) clearly.

### Step 8 — Cleanup

```bash
rm -rf data/temp/
```

(Always do this even on partial failure.)

## Persistent state

- `data/seen-articles.json` — search dedup ledger (do not delete)
- `data/articles.json` — PansaWatch article feed (the extract pipeline appends here)
- `data/judgeArticles.json` — judge↔article M2M links (the extract pipeline appends here)
- `data/news-extractions/article-*.json` — rich per-article extractions (the extract pipeline writes here)

## Token & resource budget

For `N=100`:
- Discovery (steps 1–5): ~190K Sonnet tokens, ~40s wall clock (parallel)
- Registration (step 6): ~3.5 min cold start + ~10s per URL on warm vLLM. For 5–10 reps, ~5–6 min total.
- **Total wall clock: ~6–7 min for N=100, ~5 reps to register**

For `N=300`: ~3× discovery cost. Registration cost depends only on # of reps (typically saturates around 10–15 even at higher N).

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `0 fresh` from fetch | All N already seen | Pass `--ignore-state` to re-process |
| Cluster sub-agent malformed JSON | Sonnet drift | Re-dispatch single agent; if persistent, fall back to `dedup-by-case.mjs --threshold 0.25` (heuristic) |
| `extract-and-register.mjs` fails for some URL | Non-mirror URL or DOM parse failure | Wrapper output's `failed[]` array — the rest still register; manual retry of failed |
| `unlinked.length > 0` | Judge not in `data/judges.json` | Article is registered but has no judge link; user can verify via `data/news-extractions/article-N.json` |
| HF_TOKEN missing warning | Optional; first model pull is just slow without it | If you need it for repeated runs: `export HF_TOKEN=hf_...` |
| GPU memory occupied | Stale container | The wrapper auto-removes prior `pansawatch-extract` container; for rare orphans run `ssh ... docker rm -f pansawatch-extract` manually |

## Examples

### Default (100 results)
```
/register-controversial-news
```
→ Searches 100 latest "법원 선고" articles, filters to ~10–15 controversial → ~5–10 unique cases → registers each. Total ~6–7 min.

### Smaller batch
```
/register-controversial-news 30
```
→ Quick run on the most recent 30 results. Useful for daily cron-like usage.

### Larger sweep
```
/register-controversial-news 500
```
→ Pulls 5 paginated requests, may surface ~20+ unique cases. Heavier on tokens (~1M Sonnet) but extract step still bounded by # of reps.

## Related

- `find-controversial-news` — same discovery, no registration
- `extract-naver-news` — manual single/batch URL registration
- Sub-agent prompts: `../find-controversial-news/agent-prompt.md`, `../find-controversial-news/cluster-prompt.md` (shared)
