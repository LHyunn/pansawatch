#!/usr/bin/env node
// PansaWatch — Daily court news pipeline.
//
//   1) Naver search "법원 선고" 1000건
//   2) 사건 클러스터링 + 5대 방송·통신 ≥3 필터
//   3) 각 사건별 multi-doc IE (top 3 기사)
//   4) 일일 리포트 JSON 출력
//   5) 사건 마스터 매칭 + dedup (KURE-v1 임베딩 + 룰)
//
// Usage:
//   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... \
//     LOCAL_LLM_BASE_URL=http://localhost:8000/v1 \
//     EMBED_BASE_URL=http://localhost:8001/v1 \
//     node scripts/daily-court-pipeline.mjs [--date YYYY-MM-DD] [--query "법원 선고"]

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  loadMaster, saveMaster, matchCase, embed, caseEmbeddingText,
  bumpStats, shouldRerunIE, registerNewCase, recordCardEmission,
} from "./lib/case-master.mjs";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const date = flag("date", new Date().toISOString().slice(0, 10));
const query = flag("query", "법원 선고");
// Broadcaster filter — KBS·YTN·연합·SBS·MBC 중 ≥3 보도 조건이 1순위 게이트.
const majorPressIds = flag("major-press-ids", "001,052,055,056,214");
const majorPressMin = parseInt(flag("major-press-min", "3"), 10);
// Baseline filters (loose) — broadcaster filter가 사실상 임계 결정함.
const minPublishers = parseInt(flag("min-publishers", "1"), 10);
const minTitles = parseInt(flag("min-titles", "3"), 10);
const topN = parseInt(flag("top-n", "3"), 10);
const baseUrl = process.env.LOCAL_LLM_BASE_URL;
const model = process.env.LLM_MODEL || "google/gemma-4-31B-it";

if (!baseUrl) {
  console.error("Missing LOCAL_LLM_BASE_URL");
  process.exit(1);
}

const querySlug = query.replace(/\s+/g, "-");
const ROOT = "data/news/raw";
const REPORTS = "data/reports";
const SEARCH_PATH = `${ROOT}/${querySlug}-${date}.json`;
const SUBSET_PATH = `${ROOT}/${querySlug}-${date}-subset.json`;
const BODIES_PATH = `data/news/bodies/${querySlug}-${date}.json`;
const CASES_PATH = `data/eval/cases-${querySlug}-${date}.json`;
const REPORT_PATH = `${REPORTS}/daily-${date}.json`;
const MATCH_REPORT_PATH = `${REPORTS}/match-daily-${date}.json`;

// ─── Civic policy §2-5: 기사 본문 휘발 처리 ─────────────────────────
// IE 입력으로만 본문을 사용하고, 파이프라인 종료 시 (정상·비정상·SIGINT 무관)
// 즉시 폐기. 디버그·재시도가 필요하면 PIPELINE_KEEP_BODIES=1 으로 실행.
let civicCleanupRan = false;
async function civicCleanup(reason) {
  if (civicCleanupRan) return;
  civicCleanupRan = true;
  if (process.env.PIPELINE_KEEP_BODIES === "1") {
    console.error(`[civic-cleanup:${reason}] PIPELINE_KEEP_BODIES=1 — 본문 보존 (디버그 모드)`);
    return;
  }
  let removed = 0;
  for (const p of [BODIES_PATH, SUBSET_PATH]) {
    try {
      await fs.unlink(p);
      removed++;
    } catch (e) {
      if (e.code !== "ENOENT") console.error(`[civic-cleanup] ${p}: ${e.message}`);
    }
  }
  console.error(`[civic-cleanup:${reason}] ${removed}개 파일 폐기됨 (시빅 정책 §2-5)`);
}
// Signal handlers — Ctrl+C, SIGTERM, uncaught error 모두 cleanup 후 종료.
process.on("SIGINT", () => civicCleanup("SIGINT").finally(() => process.exit(130)));
process.on("SIGTERM", () => civicCleanup("SIGTERM").finally(() => process.exit(143)));
process.on("uncaughtException", (e) => {
  console.error("Uncaught exception:", e.stack || e);
  civicCleanup("exception").finally(() => process.exit(1));
});
process.on("unhandledRejection", (e) => {
  console.error("Unhandled rejection:", e);
  civicCleanup("rejection").finally(() => process.exit(1));
});

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function runSubprocess(cmd, scriptArgs, label) {
  return new Promise((resolve, reject) => {
    // process.execPath = 현재 Node 바이너리의 절대경로.
    // cron 환경처럼 PATH 제한적인 곳에서도 안정적으로 spawn 됨.
    const proc = spawn(process.execPath, [cmd, ...scriptArgs], {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });
    proc.on("exit", (code) => {
      if (code !== 0) reject(new Error(`${label} exited with code ${code}`));
      else resolve();
    });
    proc.on("error", reject);
  });
}

console.error(`\n━━━ PansaWatch daily pipeline ━━━`);
console.error(`date:           ${date}`);
console.error(`query:          ${query}`);
console.error(`filter:         ≥${majorPressMin} of [${majorPressIds}] (KBS·YTN·연합·SBS·MBC)`);
console.error(`baseline:       ≥${minTitles} titles, ≥${minPublishers} publishers`);
console.error(`top per case:   ${topN} articles for IE`);
console.error(`LLM:            ${model} @ ${baseUrl}`);
console.error(`Embedding:      ${process.env.EMBED_MODEL || "nlpai-lab/KURE-v1"} @ ${process.env.EMBED_BASE_URL || "http://localhost:8001/v1"}`);
console.error(`Master file:    data/cases-master/index.json\n`);

await ensureDir(ROOT);
await ensureDir("data/news/bodies");
await ensureDir("data/eval");
await ensureDir(REPORTS);

// ─── Step 1: Naver search 1000 ──────────────────────────────────────
console.error(`▸ [1/5] Naver search (1000)`);
await runSubprocess(
  "scripts/naver-search.mjs",
  [query, "--display", "100", "--pages", "10", "--sort", "date", "--out", SEARCH_PATH],
  "naver-search",
);

// ─── Step 2a: Cluster cases + broadcaster filter ────────────────────
console.error(`\n▸ [2/5] Cluster cases (5대 방송·통신 ≥${majorPressMin})`);
await runSubprocess(
  "scripts/extract-cases-from-titles.mjs",
  [
    "--in", SEARCH_PATH,
    "--out", CASES_PATH,
    "--chunk-size", "200",
    "--min-titles", String(minTitles),
    "--min-publishers", String(minPublishers),
    "--major-press-ids", majorPressIds,
    "--major-press-min", String(majorPressMin),
  ],
  "extract-cases",
);

const caseData = JSON.parse(await fs.readFile(CASES_PATH, "utf8"));
const search = JSON.parse(await fs.readFile(SEARCH_PATH, "utf8"));

if (caseData.cases.length === 0) {
  console.error(`No cases passed filter. Stopping.`);
  process.exit(0);
}
console.error(`  → ${caseData.cases.length} 사건 통과 필터.\n`);

// ─── Step 2b: Fetch bodies for selected cases only ──────────────────
console.error(`▸ [2b/5] Fetch bodies for case-relevant articles only`);
// Build a subset of search items containing only title_indices from kept cases
const usedIndices = new Set();
for (const c of caseData.cases) for (const i of c.title_indices) usedIndices.add(i);
const subsetItems = [...usedIndices].map((i) => search.items[i]);
await fs.writeFile(
  SUBSET_PATH,
  JSON.stringify({ ...search, items: subsetItems, _note: "subset of titles in qualifying cases" }, null, 2),
);
await runSubprocess(
  "scripts/fetch-news-bodies.mjs",
  ["--in", SUBSET_PATH, "--out", BODIES_PATH, "--html-cache", "data/news/raw/html", "--concurrency", "6"],
  "fetch-news-bodies",
);

const bodies = JSON.parse(await fs.readFile(BODIES_PATH, "utf8"));
const bodyByOriginalLink = new Map(bodies.items.map((b) => [b.source_url, b]));

// ─── Step 3: Multi-doc IE per case ──────────────────────────────────
console.error(`\n▸ [3/5] Multi-doc IE per case (top ${topN} 기사)`);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "case_belongs_to_query", "defendant", "court", "judges",
    "sentencing_date", "charges", "sentence", "previous_instance",
    "field_confidence", "disagreements", "summary_one_paragraph",
  ],
  properties: {
    case_belongs_to_query: { type: "boolean" },
    defendant: {
      type: "object", additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        anonymized: { type: "boolean" },
      },
      required: ["name", "anonymized"],
    },
    court: {
      type: "object", additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        division: { type: ["string", "null"] },
        instance: {
          type: ["string", "null"],
          enum: ["1심", "2심", "3심", "항소심", "상고심", "대법원", "파기환송", "기타", null],
        },
      },
      required: ["name", "division", "instance"],
    },
    judges: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          name: { type: "string" },
          role: { type: "string", enum: ["부장판사", "판사", "배석", "재판장", "대법관"] },
        },
        required: ["name", "role"],
      },
    },
    sentencing_date: { type: ["string", "null"] },
    charges: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          law: { type: "string" },
          type: { type: ["string", "null"] },
          details: { type: ["string", "null"] },
        },
        required: ["law", "type", "details"],
      },
    },
    sentence: {
      type: "object", additionalProperties: false,
      properties: {
        verdict: {
          type: ["string", "null"],
          enum: ["유죄", "무죄", "일부유죄", "공소기각", "각하", "기타", null],
        },
        imprisonment: {
          type: ["object", "null"], additionalProperties: false,
          properties: {
            years: { type: "integer" },
            months: { type: "integer" },
            suspended: { type: "boolean" },
          },
          required: ["years", "months", "suspended"],
        },
        fine_krw: { type: ["integer", "null"] },
        forfeiture_krw: { type: ["integer", "null"] },
        probation_years: { type: ["number", "null"] },
      },
      required: ["verdict", "imprisonment", "fine_krw", "forfeiture_krw", "probation_years"],
    },
    previous_instance: {
      type: ["object", "null"], additionalProperties: false,
      properties: {
        instance: { type: "string" },
        imprisonment: {
          type: ["object", "null"], additionalProperties: false,
          properties: {
            years: { type: "integer" },
            months: { type: "integer" },
            suspended: { type: "boolean" },
          },
          required: ["years", "months", "suspended"],
        },
        verdict: { type: ["string", "null"] },
      },
      required: ["instance", "imprisonment", "verdict"],
    },
    field_confidence: {
      type: "object", additionalProperties: false,
      properties: {
        court: { type: "string", enum: ["high", "medium", "low"] },
        judges: { type: "string", enum: ["high", "medium", "low"] },
        sentence: { type: "string", enum: ["high", "medium", "low"] },
        charges: { type: "string", enum: ["high", "medium", "low"] },
        previous_instance: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["court", "judges", "sentence", "charges", "previous_instance"],
    },
    disagreements: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          field: { type: "string" },
          values: { type: "string" },
          resolution: { type: "string" },
        },
        required: ["field", "values", "resolution"],
      },
    },
    summary_one_paragraph: {
      type: "string",
      description: "PansaWatch 사건 카드용 1~2 문장 요약. 본문 사실만으로 작성.",
    },
  },
};

const SYSTEM = `당신은 한국 형사판결 보도 통합 IE 시스템입니다.
여러 매체의 보도가 같이 제공됩니다. 본문에 명시된 사실만 추출하고, 매체 간 충돌이 있으면 disagreements에 기록.
- charges.law은 정식 법령명 ("자본시장법", "정치자금법" 등). 매핑 모르면 그 항목 빼세요. "null" 문자열 금지.
- 양형: "징역 1년 8개월" → years=1, months=8.
- 금액: 정수 원 단위. "5000만원" → 50000000.
- summary_one_paragraph: 시민이 1초에 사건 핵심을 파악할 수 있는 1~2 문장. 추측 금지.`;

const FEW_SHOT = `<예시 입력>
<기사 1 — 연합뉴스>
서울고법 형사15-2부(부장 신종오)는 28일 김건희 여사에게 자본시장법 위반 등으로 징역 4년을 선고했다. 1심은 1년 8개월.
</기사 1>
<기사 2 — 한국일보>
서울고법 형사15-2부(부장 신종오 성언주 원익선)는 김 여사 도이치모터스 주가조작 공동정범 인정. 징역 4년·벌금 5000만원·추징금 2094만원.
</기사 2>
<기사 3 — YTN>
김건희 항소심 통일교 금품수수도 유죄. 1심보다 2년 4개월 가중.
</기사 3>

<예시 출력>
{"case_belongs_to_query":true,"defendant":{"name":"김건희","anonymized":false},"court":{"name":"서울고등법원","division":"형사15-2부","instance":"2심"},"judges":[{"name":"신종오","role":"부장판사"},{"name":"성언주","role":"배석"},{"name":"원익선","role":"배석"}],"sentencing_date":"2026-04-28","charges":[{"law":"자본시장법","type":"위반","details":"도이치모터스 주가조작 (공동정범)"},{"law":"정치자금법","type":"위반","details":"통일교 금품수수"}],"sentence":{"verdict":"유죄","imprisonment":{"years":4,"months":0,"suspended":false},"fine_krw":50000000,"forfeiture_krw":20940000,"probation_years":null},"previous_instance":{"instance":"1심","imprisonment":{"years":1,"months":8,"suspended":false},"verdict":"일부유죄"},"field_confidence":{"court":"high","judges":"medium","sentence":"high","charges":"high","previous_instance":"high"},"disagreements":[],"summary_one_paragraph":"김건희 여사가 도이치모터스 주가조작 및 통일교 금품수수 혐의 항소심에서 징역 4년·벌금 5000만원·추징금 2094만원을 선고받아 1심(1년 8개월)보다 형량이 가중됐다."}
</예시 출력>`;

function pickTopArticles(c, n) {
  // For each title index, get the body record. Score by:
  //   + body length (prefer detailed)
  //   + title contains main_actors
  //   - skip articles without bodies (e.g., external sites)
  const scored = c.title_indices
    .map((idx) => {
      const item = search.items[idx];
      const body = bodyByOriginalLink.get(item?.originallink);
      if (!body || !body.body || body.body_chars < 300) return null;
      const titleText = (item.title || "").replace(/<\/?b>/g, "");
      const titleHasActor = c.main_actors.some((a) => titleText.includes(a));
      const score =
        (titleHasActor ? 100000 : 0) +
        (body.title?.includes(c.main_actors[0] || "") ? 50000 : 0) +
        Math.min(body.body_chars, 6000) -
        (body.title?.includes("헤드라인") || body.title?.includes("이 시각") ? 50000 : 0);
      return { idx, item, body, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  // Diversity: prefer different publishers in top N
  const picked = [];
  const usedHosts = new Set();
  for (const cand of scored) {
    const m = (cand.item.originallink || "").match(/^https?:\/\/(?:www\.)?([^/]+)/);
    const host = m ? m[1] : "?";
    if (usedHosts.has(host) && picked.length < n - 1) continue; // try diverse first; allow late
    picked.push(cand);
    usedHosts.add(host);
    if (picked.length >= n) break;
  }
  return picked;
}

async function ieMultiDoc(c, picked) {
  const articlesText = picked
    .map(
      (p, i) =>
        `<기사 ${i + 1} — ${p.body.publisher || "?"} | ${p.body.pub_date}>\n${p.body.body}\n</기사 ${i + 1}>`,
    )
    .join("\n\n");

  const userMsg = `타겟 피고인: ${c.main_actors[0] || "?"} — 다른 피고인 등장해도 타겟 정보만 추출.\n\n${articlesText}\n\n위 ${picked.length}개 매체의 보도를 통합한 단일 JSON.`;

  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM + "\n\n" + FEW_SHOT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.1,
      max_tokens: 4096,  // raised from 2048 — Korean multi-doc + disagreements + summary can exceed 2K
      response_format: {
        type: "json_schema",
        json_schema: { name: "court_case", schema: SCHEMA, strict: true },
      },
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return { parsed, latency_ms: Date.now() - t0, usage: data.usage };
}

const caseReports = [];
let totalLat = 0;
let succ = 0;
let fail = 0;

for (const [i, c] of caseData.cases.entries()) {
  process.stderr.write(`  [${i + 1}/${caseData.cases.length}] ${c.case_name.slice(0, 50)} ... `);
  const picked = pickTopArticles(c, topN);
  if (picked.length === 0) {
    process.stderr.write("SKIP (no bodies)\n");
    caseReports.push({ ...c, error: "no body articles available" });
    fail++;
    continue;
  }
  try {
    const { parsed, latency_ms, usage } = await ieMultiDoc(c, picked);
    totalLat += latency_ms;
    succ++;
    process.stderr.write(`OK (${(latency_ms / 1000).toFixed(1)}s, ${usage?.completion_tokens}t, ${picked.length}매체)\n`);
    caseReports.push({
      case_id: c.case_id,
      case_name_cluster: c.case_name,
      category: c.category,
      title_count: c.title_count,
      publisher_count: c.publisher_count,
      sources_used: picked.map((p) => ({
        publisher: p.body.publisher,
        url: p.body.mirror_url || p.body.source_url,
        pub_date: p.body.pub_date,
        body_chars: p.body.body_chars,
      })),
      ie: parsed,
      latency_ms,
      usage,
    });
  } catch (e) {
    process.stderr.write(`FAIL: ${e.message}\n`);
    caseReports.push({ ...c, error: e.message });
    fail++;
  }
}

// ─── Step 4: Master matching + dedup ────────────────────────────────
// Enrich each caseReport with case_uid, match_tier, is_new_card, is_update_card.
// Updates persistent master at data/cases-master/index.json.
console.error(`\n▸ [4/5] 사건 마스터 매칭 + dedup`);
const master = await loadMaster();
const masterBefore = Object.keys(master.cases).length;
const matchOutcomes = [];
let newCardCount = 0;
let updateCardCount = 0;
let statsOnlyCount = 0;
const matchTs = new Date().toISOString();

for (const caseReport of caseReports) {
  if (!caseReport.ie) {
    matchOutcomes.push({ case_id: caseReport.case_id, _outcome: "skip-no-ie" });
    continue;
  }

  const cluster = {
    case_name: caseReport.case_name_cluster,
    category: caseReport.category,
    title_count: caseReport.title_count,
    publisher_count: caseReport.publisher_count,
  };

  let match;
  try {
    match = await matchCase(caseReport.ie, master);
  } catch (e) {
    matchOutcomes.push({ case_id: caseReport.case_id, _outcome: "match-error", error: e.message });
    caseReport.match_tier = "error";
    caseReport.is_new_card = false;
    caseReport.is_update_card = false;
    continue;
  }

  if (match.uid) {
    // Existing case
    const masterCase = master.cases[match.uid];
    bumpStats(masterCase, matchTs, caseReport.title_count, caseReport.publisher_count);
    const rerun = shouldRerunIE(masterCase, cluster);
    if (rerun) {
      masterCase.ie_snapshot = caseReport.ie;
      masterCase.last_ie_at = matchTs;
      masterCase.last_ie_title_count = caseReport.title_count;
      recordCardEmission(masterCase, null, "update", matchTs, "stats growth or low-conf rerun");
      updateCardCount++;
    } else {
      statsOnlyCount++;
    }
    caseReport.case_uid = match.uid;
    caseReport.match_tier = String(match.tier);
    caseReport.match_confidence = match.confidence;
    caseReport.is_new_card = false;
    caseReport.is_update_card = rerun;
    matchOutcomes.push({
      case_id: caseReport.case_id,
      uid: match.uid,
      _outcome: rerun ? "existing-updated" : "existing-stats-only",
      match_tier: match.tier,
      match_confidence: match.confidence,
    });
  } else {
    // New case (or gray-zone treated as new in v0)
    const text = match.embedding_text || caseEmbeddingText(caseReport.ie);
    let newEmb;
    try {
      newEmb = match.embedding || (await embed(text));
    } catch (e) {
      matchOutcomes.push({ case_id: caseReport.case_id, _outcome: "embed-failed", error: e.message });
      caseReport.match_tier = "error";
      caseReport.is_new_card = false;
      caseReport.is_update_card = false;
      continue;
    }
    const uid = registerNewCase(master, caseReport.ie, newEmb, text, matchTs, cluster);
    newCardCount++;
    caseReport.case_uid = uid;
    caseReport.match_tier = match.tier === "gray-zone" ? "new-gray" : "new";
    caseReport.is_new_card = true;
    caseReport.is_update_card = false;
    matchOutcomes.push({
      case_id: caseReport.case_id,
      uid,
      _outcome: match.tier === "gray-zone" ? "new-but-near-existing" : "new",
      gray_zone_sim: match.sim,
      gray_zone_candidate: match.candidate,
    });
  }
}

await saveMaster(master);
const masterAfter = Object.keys(master.cases).length;
console.error(`  Master: ${masterBefore} → ${masterAfter} (+${masterAfter - masterBefore} 신규)`);
console.error(`  Cards: ${newCardCount} 신규, ${updateCardCount} 업데이트, ${statsOnlyCount} stats-only`);

// ─── Step 5: Save daily + match reports ─────────────────────────────
console.error(`\n▸ [5/5] Save reports`);
const report = {
  date_kst: date,
  query,
  filter: { min_publishers: minPublishers, min_titles: minTitles, top_n: topN, major_press_ids: majorPressIds, major_press_min: majorPressMin },
  generated_at: new Date().toISOString(),
  model,
  stats: {
    total_titles_searched: search.items.length,
    cases_passing_filter: caseData.cases.length,
    cases_ie_succeeded: succ,
    cases_ie_failed: fail,
    avg_ie_latency_sec: succ > 0 ? (totalLat / succ / 1000).toFixed(1) : null,
    new_cards: newCardCount,
    update_cards: updateCardCount,
    stats_only: statsOnlyCount,
    master_size_after: masterAfter,
  },
  cases: caseReports,
};

await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

const matchSummary = {
  date_kst: date,
  matched_at: matchTs,
  master_size_before: masterBefore,
  master_size_after: masterAfter,
  outcomes_count: matchOutcomes.reduce((acc, o) => { acc[o._outcome] = (acc[o._outcome] || 0) + 1; return acc; }, {}),
  outcomes: matchOutcomes,
};
await fs.writeFile(MATCH_REPORT_PATH, JSON.stringify(matchSummary, null, 2), "utf8");

console.error(`\n━━━ Done ━━━`);
console.error(`Titles searched:   ${report.stats.total_titles_searched}`);
console.error(`Cases (filter):    ${report.stats.cases_passing_filter}`);
console.error(`IE succeeded:      ${report.stats.cases_ie_succeeded}`);
console.error(`IE failed:         ${report.stats.cases_ie_failed}`);
console.error(`New cards:         ${newCardCount}`);
console.error(`Update cards:      ${updateCardCount}`);
console.error(`Stats-only:        ${statsOnlyCount}`);
console.error(`Master size:       ${masterBefore} → ${masterAfter}`);
console.error(`Avg IE latency:    ${report.stats.avg_ie_latency_sec ?? "n/a"}s/case`);
console.error(`\nReport       → ${REPORT_PATH}`);
console.error(`Match report → ${MATCH_REPORT_PATH}\n`);

// ─── Civic policy §2-5: 정상 종료 시 본문 휘발 처리 ──────────────────
await civicCleanup("normal-exit");

// Brief preview
for (const r of caseReports.filter((r) => r.ie)) {
  const ie = r.ie;
  console.error(`▷ ${r.case_name_cluster}  [${r.title_count}건/${r.publisher_count}매체]`);
  console.error(`   ${ie.summary_one_paragraph}`);
  console.error("");
}
