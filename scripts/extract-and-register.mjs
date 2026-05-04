#!/usr/bin/env node
// Extract a Naver news URL and register it into the PansaWatch project.
//
// Wraps `scripts/extract-from-naver-url.mjs`:
//   1. Pre-check articles.json — skip URLs already registered (no GPU spin-up wasted).
//   2. Run extraction (starts vLLM container, runs Gemma 4, stops container).
//   3. For each result:
//      - Save full extraction → data/news-extractions/article-N.json
//      - Append simplified entry → data/articles.json
//   4. Print summary.
//
// Usage:
//   HF_TOKEN=hf_xxx node scripts/extract-and-register.mjs <naver-url> [naver-url2] ...
//
// Idempotent: re-running on the same URL no-ops with a clear message.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, "..");
const EXTRACT_SCRIPT = path.join(__dirname, "extract-from-naver-url.mjs");
const ARTICLES_PATH = path.join(PROJECT, "data", "articles.json");
const JUDGES_PATH = path.join(PROJECT, "data", "judges.json");
const JUDGE_ARTICLES_PATH = path.join(PROJECT, "data", "judgeArticles.json");
const RICH_DIR = path.join(PROJECT, "data", "news-extractions");

// ─── Judge matching ───────────────────────────────────────────────────
function findJudgeId(judges, { judgeStr, court, bench }) {
  if (!judgeStr) return null;
  // "송병훈 부장판사" → "송병훈"
  const nameMatch = judgeStr.match(/^([가-힣]{2,4})/);
  if (!nameMatch) return null;
  const name = nameMatch[1];

  // 1. exact name + court
  let candidates = judges.filter((j) => j.name === name && j.court === court);

  // 2. exact name + court basename match (e.g., "수원지법" → "수원지방법원")
  if (candidates.length === 0 && court) {
    const courtBase = court.replace(/(지방법원|고등법원|지법|고법)$/, "");
    candidates = judges.filter((j) => j.name === name && j.court.startsWith(courtBase));
  }

  // 3. name only (warn — court mismatch possible)
  let usedFallback = false;
  if (candidates.length === 0) {
    candidates = judges.filter((j) => j.name === name);
    if (candidates.length > 0) usedFallback = true;
  }

  if (candidates.length === 0) return null;

  // Disambiguate by bench/division if multiple
  if (candidates.length > 1 && bench) {
    const benchNum = bench.match(/\d+/)?.[0];
    if (benchNum) {
      const byBench = candidates.find((c) =>
        c.division && c.division.includes(benchNum) && c.division.includes(bench.replace(/\d+/, "").replace(/부$/, "")),
      );
      if (byBench) return byBench.id;
    }
  }

  if (usedFallback) {
    return { id: candidates[0].id, warn: `name-only match — extracted court "${court}" ≠ judges.json "${candidates[0].court}"` };
  }
  return candidates[0].id;
}

// ─── Args ─────────────────────────────────────────────────────────────
const urlsIn = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const KEEP = process.argv.includes("--keep");
if (urlsIn.length === 0) {
  console.error("Usage: node scripts/extract-and-register.mjs <naver-url> [naver-url2] ... [--keep]");
  console.error("");
  console.error("  Extracts via Gemma 4 31B (vLLM on GPU server) and appends to data/articles.json,");
  console.error("  then auto-links to data/judges.json via data/judgeArticles.json.");
  console.error("  Re-running on the same URL is a no-op (deduped by URL).");
  console.error("");
  console.error("Options:");
  console.error("  --keep    실행 후 GPU 컨테이너 유지 — 다음 호출 시 warm reuse (모델 재로드 없음).");
  console.error("            기본은 실행 후 컨테이너 제거 + GPU 메모리 회수.");
  console.error("            여러 번에 나눠 추가할 땐 마지막 호출만 --keep 빼면 자연스럽게 정리됨.");
  console.error("");
  console.error("Env:");
  console.error("  HF_TOKEN  optional, raises HuggingFace download rate limits");
  process.exit(1);
}

// ─── Pre-check: skip already-registered URLs ──────────────────────────
const articles = JSON.parse(fs.readFileSync(ARTICLES_PATH, "utf8"));
const existingUrls = new Set(articles.map((a) => a.url));

const urls = [];
const skipped = [];
for (const url of urlsIn) {
  if (existingUrls.has(url)) {
    const existing = articles.find((a) => a.url === url);
    skipped.push({ url, existingId: existing.id });
  } else {
    urls.push(url);
  }
}

if (skipped.length > 0) {
  console.error(`⊘ Already registered (skipping ${skipped.length}):`);
  for (const s of skipped) console.error(`    ${s.existingId}  ${s.url}`);
}

if (urls.length === 0) {
  console.error("\nNothing to do — all URLs are already registered. Exiting (no GPU spin-up).");
  process.exit(0);
}

console.error(`\n→ Extracting ${urls.length} URL${urls.length > 1 ? "s" : ""} …`);

// ─── Run extraction script (container lifecycle handled there) ────────
const extractArgs = [EXTRACT_SCRIPT, ...urls, ...(KEEP ? ["--keep"] : [])];
const r = spawnSync("node", extractArgs, {
  stdio: ["inherit", "pipe", "inherit"], // stderr → user's terminal for progress
  env: process.env,
  encoding: "utf8",
});

if (r.status !== 0) {
  console.error(`\nExtract script failed (exit ${r.status})`);
  process.exit(r.status ?? 1);
}

let extractions;
try {
  extractions = JSON.parse(r.stdout);
} catch (e) {
  console.error("\nFailed to parse extract script JSON:");
  console.error("  Error:", e.message);
  console.error("  Stdout (first 1000 chars):", r.stdout.slice(0, 1000));
  process.exit(1);
}

const items = Array.isArray(extractions) ? extractions : [extractions];

// ─── Register each item ───────────────────────────────────────────────
fs.mkdirSync(RICH_DIR, { recursive: true });

// Avoid ID collision with mock data: even if articles.json was reset to [],
// judgeArticles.json may still reference article-N from prior mock data.
// Pick max(N) across BOTH sources so we never reuse an ID with stale links.
const _existingJa = JSON.parse(fs.readFileSync(JUDGE_ARTICLES_PATH, "utf8"));
let nextNum =
  Math.max(
    0,
    ...articles
      .map((a) => parseInt((a.id || "").replace("article-", ""), 10))
      .filter((n) => !isNaN(n)),
    ..._existingJa
      .map((ja) => parseInt((ja.articleId || "").replace("article-", ""), 10))
      .filter((n) => !isNaN(n)),
  ) + 1;

const registered = [];
const failed = [];
const newIdByUrl = new Map(); // url → newly-assigned articleId

for (const item of items) {
  if (item.error) {
    failed.push({ url: item.url, error: item.error });
    continue;
  }

  const id = `article-${nextNum++}`;
  newIdByUrl.set(item.url, id);
  const sourceClean = (item.source?.publisher || "").replace(/\s*\|\s*네이버\s*$/, "").trim();

  // 'YYYY-MM-DD HH:MM:SS' → ISO8601
  let isoPub = item.source?.pub_date || "";
  if (isoPub && !isoPub.includes("T")) isoPub = isoPub.replace(" ", "T");
  if (isoPub && !isoPub.endsWith("Z")) isoPub = isoPub + "Z";

  // Save rich extraction
  const richPath = path.join(RICH_DIR, `${id}.json`);
  fs.writeFileSync(
    richPath,
    JSON.stringify(
      {
        id,
        url: item.url,
        fetched_at: new Date().toISOString(),
        source: item.source,
        extraction: item.extraction,
      },
      null,
      2,
    ),
    "utf8",
  );

  // Append simplified Article entry
  const article = {
    id,
    title: item.source?.title || "",
    url: item.url,
    source: sourceClean,
    publishedAt: isoPub,
    aiSummary: item.extraction?.summary2 || "",
    collectedAt: new Date().toISOString(),
  };
  articles.push(article);
  registered.push({ id, title: article.title, source: sourceClean });
}

if (registered.length > 0) {
  fs.writeFileSync(ARTICLES_PATH, JSON.stringify(articles, null, 2), "utf8");
}

// ─── Judge linking ────────────────────────────────────────────────────
const judges = JSON.parse(fs.readFileSync(JUDGES_PATH, "utf8"));
const judgeArticles = JSON.parse(fs.readFileSync(JUDGE_ARTICLES_PATH, "utf8"));
const judgeArticleByPair = new Set(judgeArticles.map((ja) => `${ja.judgeId}|${ja.articleId}`));
let nextJaNum =
  judgeArticles
    .map((ja) => parseInt((ja.id || "").replace("ja-", ""), 10))
    .filter((n) => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0) + 1;

const linked = [];
const unlinked = [];

// Build link tasks from BOTH freshly-extracted items AND already-registered (skipped) URLs
// — so retroactive runs catch up missed links from prior manual registrations.
const linkTasks = [];
for (const item of items) {
  if (item.error || !item.extraction) continue;
  const articleId = newIdByUrl.get(item.url);
  if (articleId) linkTasks.push({ articleId, extraction: item.extraction });
}
for (const s of skipped) {
  const richPath = path.join(RICH_DIR, `${s.existingId}.json`);
  if (!fs.existsSync(richPath)) continue;
  try {
    const rich = JSON.parse(fs.readFileSync(richPath, "utf8"));
    if (rich.extraction) linkTasks.push({ articleId: s.existingId, extraction: rich.extraction });
  } catch {}
}

for (const { articleId, extraction } of linkTasks) {
  const result = findJudgeId(judges, {
    judgeStr: extraction.judge,
    court: extraction.court,
    bench: extraction.bench,
  });

  if (!result) {
    unlinked.push({
      articleId,
      reason: extraction.judge
        ? `no judge match for "${extraction.judge}" (${extraction.court})`
        : "no judge field in extraction",
    });
    continue;
  }

  const judgeId = typeof result === "string" ? result : result.id;
  const warn = typeof result === "object" ? result.warn : null;
  const pairKey = `${judgeId}|${articleId}`;
  if (judgeArticleByPair.has(pairKey)) continue; // already linked

  judgeArticles.push({
    id: `ja-${nextJaNum++}`,
    judgeId,
    articleId,
    relevanceScore: 1.0, // direct LLM extraction → high confidence
  });
  judgeArticleByPair.add(pairKey);
  const judge = judges.find((j) => j.id === judgeId);
  linked.push({ articleId, judgeId, judgeName: judge?.name, judgeCourt: judge?.court, warn });
}

if (linked.length > 0) {
  fs.writeFileSync(JUDGE_ARTICLES_PATH, JSON.stringify(judgeArticles, null, 2), "utf8");
}

// ─── Need to register article-id back into rich JSON for traceability ──
// (registered items now have ids — we already saved them, but add quick log)

// ─── Summary ──────────────────────────────────────────────────────────
console.error("\n=== Registered articles ===");
for (const r of registered) {
  console.error(`  ✓ ${r.id}  [${r.source}]  ${r.title.slice(0, 60)}`);
}
if (failed.length > 0) {
  console.error("\n=== Failed ===");
  for (const f of failed) console.error(`  ✗ ${f.url} — ${f.error}`);
}

console.error("\n=== Judge links ===");
for (const l of linked) {
  const w = l.warn ? `  ⚠ ${l.warn}` : "";
  console.error(`  ✓ ${l.articleId} → ${l.judgeId} (${l.judgeName}, ${l.judgeCourt})${w}`);
}
for (const u of unlinked) {
  console.error(`  ⊘ ${u.articleId}: ${u.reason}`);
}

console.error(
  `\nTotal: ${registered.length} articles registered, ${linked.length} judge links, ${failed.length} failed, ${skipped.length} skipped.`,
);
console.error(
  `articles.json: ${articles.length} entries  |  judgeArticles.json: ${judgeArticles.length} entries`,
);

// Print one-line JSON summary to stdout for piping/scripting
console.log(
  JSON.stringify({
    registered: registered.map((r) => r.id),
    linked: linked.map((l) => ({ articleId: l.articleId, judgeId: l.judgeId })),
    unlinked: unlinked.map((u) => u.articleId),
    failed: failed.map((f) => f.url),
    skipped: skipped.map((s) => ({ url: s.url, id: s.existingId })),
    total_articles: articles.length,
    total_judge_links: judgeArticles.length,
  }),
);
