---
name: find-controversial-news
description: Search Naver News for the query "법원 선고", filter to court-ruling articles whose sentence may be controversially lenient (delegated to Sonnet sub-agents in parallel batches), cluster duplicate coverage of the same case, and return a ranked list of representative article URLs (one per case). Use when the user asks to find/discover/curate news of lenient sentencing controversies, "솜방망이" 판결, 양형 논란 사건 등 — typical phrasings include "최근 양형 논란 기사 찾아줘", "/find-controversial-news 50", "선고 논란 뉴스 모아줘". Idempotent across runs via persistent seen-link state at data/seen-articles.json. Does NOT register articles — for find+register use register-controversial-news instead.
---

# Find controversially-lenient sentencing news (Naver)

End-to-end pipeline: Naver News API → LLM judgment (parallel) → case clustering (LLM) → media-priority dedup → ranked URL list.

## When to use

Trigger this skill when the user asks for **discovery** of news articles about court rulings that may be controversial for lenient sentencing — without asking for them to be ingested into PansaWatch's article feed.

Phrasings:
- "최근 양형 논란 뉴스 찾아줘"
- "솜방망이 판결 기사 모아봐"
- "선고 형량 낮아서 논란인 사건 리스트"
- `/find-controversial-news`
- `/find-controversial-news 50`

**Skip this skill** when:
- The user wants articles registered into `data/articles.json` (use `register-controversial-news` instead)
- The user provides specific URLs to extract (use `extract-naver-news`)
- The user wants articles other than court-ruling controversy

## Argument

`/find-controversial-news [N]`
- `N` = how many Naver News results to fetch from the search query "법원 선고" (default **100**, max **1000**, paginated in 100-item chunks)
- Larger N → more candidates but more LLM tokens and time

## Pipeline (the agent must execute these steps)

### Step 1 — Fetch (deterministic)

```bash
node scripts/find-controversial-articles.mjs --display <N> > data/temp/naver-news-batch.json
```

The fetch script:
- Calls Naver News API for query "법원 선고"
- Drops links already present in `data/seen-articles.json` (persistent dedup)
- Writes fresh items to stdout (redirect to temp file)
- Updates `data/seen-articles.json` with all newly-seen links

If the script returns 0 fresh items, report that to the user and exit (no LLM cost).

### Step 2 — Batch & dispatch judgment (parallel LLM)

Read the fetched items. Split into batches of **14 articles**. Save each batch as `data/temp/batch-<i>.json`.

Dispatch **one Agent call per batch in a single message** (parallel):
- `subagent_type: general-purpose`
- `model: sonnet`
- Prompt: see `agent-prompt.md` in this skill folder. Substitute the batch file path.

Each sub-agent returns a JSON array of `{link, title, controversial, confidence, reason}`.

### Step 3 — Aggregate & save

Combine all batch outputs into a single list. Write to `data/temp/judgments.json`.

Filter to `controversial: true` entries. If empty, report "no controversial cases found" and skip to cleanup.

### Step 4 — Cluster (single LLM)

Write the controversial articles (just `link` and `title`) to `data/temp/cluster-input.json`.

Dispatch **one** Agent call:
- `subagent_type: general-purpose`
- `model: sonnet`
- Prompt: see `cluster-prompt.md`. Reads `data/temp/cluster-input.json`, returns `[[link, link], [link]]` array.

Save the returned cluster array to `data/temp/clusters.json`.

### Step 5 — Dedup (deterministic)

```bash
node scripts/dedup-by-case.mjs --clusters-file data/temp/clusters.json < data/temp/judgments-controversial.json
```

(First write the controversial subset to `data/temp/judgments-controversial.json`.)

The dedup script:
- Drops `[속보]`, `[1보]`, `[2보]` stubs from each cluster
- Picks representative per cluster: 연합뉴스 → YTN → KBS → SBS → MBC, else newest by pubDate
- Outputs JSON array of `{link, title, controversial, confidence, reason, clusterSize, media}`

### Step 6 — Report to user

Show a markdown table or list with:
- Title
- Source (media)
- Cluster size (how many outlets covered this case)
- Confidence + reason
- Link

### Step 7 — Cleanup

```bash
rm -rf data/temp/
```

(Always do this even on partial failure — temp files are not durable artifacts.)

## Persistent state

`data/seen-articles.json` — **DO NOT DELETE**. This is the cross-run dedup ledger:
```json
{
  "lastRunAt": "ISO timestamp",
  "latestPubDate": "RFC2822 from latest article",
  "seenLinks": ["url1", "url2", ...]   // capped at 5000 (ring buffer)
}
```

If the user wants to re-search articles already seen, pass `--ignore-state` to the fetch script (Step 1).

## Token budget (rule of thumb)

For `N=100`:
- ~7 batches × ~24K tokens (judge) ≈ 170K tokens
- 1 cluster call ≈ 20K tokens
- Total: ~190K tokens, ~40 seconds wall clock (parallel)

For `N=300`: ~3× the above (~550K tokens). Above this, consider splitting into multiple runs.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `0 fresh` returned by fetch | All N results already in state | Pass `--ignore-state` or wait for newer articles |
| Sub-agent returns malformed JSON | Sonnet output drift | Re-dispatch the affected batch; if persistent, lower batch size |
| Cluster sub-agent groups unrelated cases | Edge case | Manual review; for known false positives, fall back to heuristic via `--threshold 0.4` (no `--clusters-file`) |
| Naver API 401 | Bad credentials | Check `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` env vars |

## Related

- `register-controversial-news` — same pipeline, but feeds the representatives into `extract-naver-news` for full ingest
- `extract-naver-news` — manual single/batch URL extraction
- `scripts/find-controversial-articles.mjs` — fetch step
- `scripts/dedup-by-case.mjs` — cluster + media priority + stub filter
