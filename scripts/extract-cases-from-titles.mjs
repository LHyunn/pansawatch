#!/usr/bin/env node
// Cluster ~1000 news titles into distinct cases via LLM.
//
// Strategy:
//   1. Chunk titles into batches of ~200 (fits 16K context).
//   2. Per-chunk: LLM extracts {case_name, actors, category, indices[]}.
//   3. Merge: LLM consolidates cases mentioned across chunks (compact input).
//   4. Stitch back full title_indices from chunk outputs.
//
// Usage:
//   LOCAL_LLM_BASE_URL=http://localhost:8000/v1 \
//     node scripts/extract-cases-from-titles.mjs \
//       --in data/news/raw/court-sentencing-1000.json \
//       --out data/eval/cases-court-1000.json \
//       --chunk-size 200

import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const inPath = flag("in");
const outPath = flag("out");
const chunkSize = parseInt(flag("chunk-size", "200"), 10);
const minTitles = parseInt(flag("min-titles", "1"), 10);
const minPublishers = parseInt(flag("min-publishers", "1"), 10);
// "Major broadcasters & wire" filter — 사건이 사회적으로 다뤄졌는지 강한 신호.
// Default: KBS(056) + YTN(052) + 연합뉴스(001) + SBS(055) + MBC(214) 중 ≥3 보도 필요.
const majorPressIds = (flag("major-press-ids", "001,052,055,056,214") || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const majorPressMin = parseInt(flag("major-press-min", "3"), 10);
const baseUrl = process.env.LOCAL_LLM_BASE_URL || flag("base-url");
const model = process.env.LLM_MODEL || flag("model", "google/gemma-4-31B-it");

if (!inPath || !outPath) {
  console.error("Usage: --in <search.json> --out <cases.json> [--chunk-size 200]");
  process.exit(1);
}

// ─── HTML decode (titles have entities like &quot;) ─────────────────
function decode(s) {
  return s
    .replace(/<\/?b>/g, "")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

// ─── Schemas ────────────────────────────────────────────────────────
const CATEGORIES = [
  "형사판결", "정치", "사회·사건", "경제·기업",
  "외교·국제", "스포츠", "연예", "노동·복지", "기타",
];

const CHUNK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cases"],
  properties: {
    cases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["case_name", "main_actors", "category", "summary", "court_instance", "title_indices"],
        properties: {
          case_name: { type: "string" },
          main_actors: { type: "array", items: { type: "string" } },
          category: { type: "string", enum: CATEGORIES },
          summary: { type: "string" },
          court_instance: {
            type: ["string", "null"],
            enum: ["1심", "2심", "3심", "항소심", "상고심", "대법원", "파기환송", "기타", null],
          },
          title_indices: { type: "array", items: { type: "integer" } },
        },
      },
    },
  },
};

const MERGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cases"],
  properties: {
    cases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["case_name", "main_actors", "category", "summary", "court_instance", "merged_from"],
        properties: {
          case_name: { type: "string" },
          main_actors: { type: "array", items: { type: "string" } },
          category: { type: "string", enum: CATEGORIES },
          summary: { type: "string" },
          court_instance: {
            type: ["string", "null"],
            enum: ["1심", "2심", "3심", "항소심", "상고심", "대법원", "파기환송", "기타", null],
          },
          merged_from: {
            type: "array",
            items: { type: "string" },
            description: 'Source IDs like "C1#0", "C3#5" referring to chunk_id#case_index',
          },
        },
      },
    },
  },
};

// ─── Prompts ────────────────────────────────────────────────────────
const CHUNK_SYSTEM = `당신은 한국 뉴스 제목에서 사건을 그룹화하여 추출하는 시스템입니다.

뉴스 제목들이 [인덱스] 제목 형식으로 제공됩니다. 같은 사건의 여러 보도(속보·반응·해설·사설·인터뷰)를 하나의 사건으로 묶어 추출하세요.

원칙:
1. **사건 식별 단위**: 동일 행위자(피고인·피해자·기관) + 동일 핵심 사건(혐의·내용·심급)
   - 같은 인물의 다른 사건은 별도 사건. 예: "김건희 도이치" vs "김건희 통일교 청탁"
   - 같은 사건의 다른 심급은 별도 사건. 예: "윤석열 1심" vs "윤석열 항소심"
2. **case_name**: 짧고 식별성 강하게. 예: "김건희 도이치모터스 주가조작 항소심", "버스기사 폭행 60대 집행유예"
3. **main_actors**: 핵심 인물·기관. 1-3명. 익명("A씨")이면 직업·나이·소속 등 식별자.
4. **category**: 형사판결·정치·사회·사건·경제·기업·외교·국제·스포츠·연예·노동·복지·기타
5. **summary**: 1-2 문장으로 사건 요약
6. **court_instance**: 본문에 명시된 심급 ("1심"/"2심"/"항소심"/"대법원"/"파기환송"). 명시 없으면 null
7. **title_indices**: 그 사건에 해당하는 모든 제목의 인덱스
8. **단일 제목으로 식별 어려운 산발적 사건**: title_indices에 1개만 들어가도 무방. 단, 사건성 자체가 약한 일반 보도(헤드라인 묶음·칼럼)는 제외.

출력은 JSON Schema 정확 준수.`;

const CHUNK_FEW_SHOT = `<예시 입력 (제목 8개)>
[1] 김건희 항소심 징역 4년 선고
[2] 김 여사 측 대법원 상고
[3] 카페 돌진 60대 금고 2년 4개월
[4] [사설] 사법부 책임 무거워졌다
[5] 윤석열 체포방해 항소심 징역 7년
[6] 김건희 통일교 금품수수도 유죄
[7] 윤 대통령 부부 형량 늘어난 이유
[8] 카페 돌진 사건 피해자 가족 인터뷰
</예시 입력>

<예시 출력>
{"cases":[
  {"case_name":"김건희 도이치모터스·통일교 항소심","main_actors":["김건희"],"category":"형사판결","summary":"도이치모터스 주가조작 및 통일교 금품수수 등 혐의 항소심에서 징역 4년 선고. 1심(1년 8개월)보다 가중. 측은 대법원에 상고.","court_instance":"2심","title_indices":[1,2,6,7]},
  {"case_name":"카페 돌진 60대 운전자 사건","main_actors":["60대 운전자"],"category":"사회·사건","summary":"카페 돌진 교통사고로 다수 사상자 발생. 운전자에게 금고 2년 4개월 선고.","court_instance":"1심","title_indices":[3,8]},
  {"case_name":"윤석열 체포방해 항소심","main_actors":["윤석열"],"category":"형사판결","summary":"체포영장 집행방해 등 혐의 항소심에서 징역 7년 선고. 1심(5년)보다 가중.","court_instance":"2심","title_indices":[5,7]}
]}
</예시 출력>`;

const MERGE_SYSTEM = `여러 청크에서 각각 추출된 사건 리스트를 통합하세요.

청크별 사건은 [청크ID#인덱스] 형식으로 식별됩니다 (예: C0#0, C2#3). 같은 사건이 여러 청크에서 중복 추출됐을 가능성이 있어 통합 필요.

원칙:
1. 같은 사건은 하나로 통합 — case_name이 약간 달라도 main_actors가 동일하고 사건 내용이 같으면 통합.
2. case_name은 가장 정보 풍부한 버전을 채택하거나 통합 후 재작성.
3. main_actors는 합집합.
4. category, court_instance는 다수의 입력에서 자주 나오는 값 채택.
5. summary는 입력들을 종합한 1-2 문장.
6. **merged_from**: 통합한 원본 청크 사건 ID들의 배열. 예: ["C0#1","C2#0","C3#2"]

출력은 JSON Schema 정확 준수.`;

// ─── LLM call helper ────────────────────────────────────────────────
async function callLLM(systemPrompt, userMsg, schema, schemaName, maxTokens = 4096) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, schema, strict: true },
      },
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 800)}`);
  }
  const data = await res.json();
  const content = data.choices[0].message.content;
  return { parsed: JSON.parse(content), usage: data.usage };
}

// ─── Main ───────────────────────────────────────────────────────────
const search = JSON.parse(await fs.readFile(inPath, "utf8"));
const titles = search.items.map((it, idx) => ({
  idx,
  title: decode(it.title),
  pubDate: it.pubDate,
  originallink: it.originallink,
  link: it.link,
}));
console.error(`Loaded ${titles.length} titles from ${inPath}`);

// Chunk
const chunks = [];
for (let i = 0; i < titles.length; i += chunkSize) {
  chunks.push(titles.slice(i, i + chunkSize));
}
console.error(`Split into ${chunks.length} chunks of ~${chunkSize} titles each\n`);

// Pass 1: per-chunk extraction
const chunkResults = [];
for (let ci = 0; ci < chunks.length; ci++) {
  const chunk = chunks[ci];
  const titlesText = chunk.map((t) => `[${t.idx}] ${t.title}`).join("\n");
  const userMsg = `다음은 ${chunk.length}개 뉴스 제목입니다 (인덱스 ${chunk[0].idx}~${chunk[chunk.length - 1].idx}).\n\n${titlesText}\n\n위 제목들에서 주요 사건들을 추출하여 JSON으로.`;

  const t0 = Date.now();
  process.stderr.write(`Chunk ${ci + 1}/${chunks.length} (titles ${chunk[0].idx}-${chunk[chunk.length - 1].idx}): `);
  try {
    const { parsed, usage } = await callLLM(
      CHUNK_SYSTEM + "\n\n" + CHUNK_FEW_SHOT,
      userMsg,
      CHUNK_SCHEMA,
      "case_chunk",
      4096,
    );
    chunkResults.push({ chunk_id: `C${ci}`, cases: parsed.cases });
    process.stderr.write(`${parsed.cases.length} cases (${((Date.now() - t0) / 1000).toFixed(1)}s, ${usage?.completion_tokens}t)\n`);
  } catch (e) {
    process.stderr.write(`FAIL: ${e.message}\n`);
    chunkResults.push({ chunk_id: `C${ci}`, cases: [], error: e.message });
  }
}

// Pass 2: merge
console.error("\nMerging across chunks...");
const mergeInput = chunkResults
  .flatMap((cr) =>
    cr.cases.map((c, i) => ({
      id: `${cr.chunk_id}#${i}`,
      case_name: c.case_name,
      main_actors: c.main_actors,
      category: c.category,
      court_instance: c.court_instance,
      title_count: c.title_indices.length,
    })),
  );

const compactList = mergeInput
  .map(
    (c) =>
      `[${c.id}] ${c.case_name} | actors: ${c.main_actors.join(",")} | ${c.category} | ${c.court_instance ?? "—"} | titles: ${c.title_count}건`,
  )
  .join("\n");

const mergeUserMsg = `다음은 ${chunkResults.length}개 청크에서 추출된 총 ${mergeInput.length}개 사건의 압축 목록입니다.

${compactList}

위 사건들을 통합 (중복 제거)하여 최종 사건 리스트로 정리하세요. merged_from에는 원본 ID들 (예: ["C0#1","C2#3"]) 배열로 표기.`;

const t0 = Date.now();
const { parsed: mergedRaw, usage: mergeUsage } = await callLLM(
  MERGE_SYSTEM,
  mergeUserMsg,
  MERGE_SCHEMA,
  "case_merge",
  6144,
);
console.error(`Merged ${mergeInput.length} → ${mergedRaw.cases.length} cases (${((Date.now() - t0) / 1000).toFixed(1)}s, ${mergeUsage?.completion_tokens}t)`);

// Stitch back title_indices from chunk results
function lookupChunkCase(id) {
  const m = id.match(/^C(\d+)#(\d+)$/);
  if (!m) return null;
  const cr = chunkResults[parseInt(m[1], 10)];
  return cr?.cases?.[parseInt(m[2], 10)];
}

const finalCases = mergedRaw.cases.map((mc, idx) => {
  const indices = new Set();
  for (const srcId of mc.merged_from) {
    const src = lookupChunkCase(srcId);
    if (src) for (const i of src.title_indices) indices.add(i);
  }
  const sorted = [...indices].sort((a, b) => a - b);
  return {
    case_id: `case-${String(idx + 1).padStart(3, "0")}`,
    case_name: mc.case_name,
    main_actors: mc.main_actors,
    category: mc.category,
    summary: mc.summary,
    court_instance: mc.court_instance,
    title_count: sorted.length,
    title_indices: sorted,
    sample_titles: sorted.slice(0, 5).map((i) => titles[i]?.title).filter(Boolean),
    merged_from: mc.merged_from,
  };
});

// Compute unique publisher count + Naver press_id presence per case
function publisherHost(item) {
  const m = (item?.originallink || "").match(/^https?:\/\/(?:www\.)?([^/]+)/);
  return m ? m[1].toLowerCase() : null;
}
function naverPressId(item) {
  const link = item?.link || "";
  const m = link.match(/n\.news\.naver\.com\/(?:mnews\/)?article\/(\d+)\//);
  if (m) return m[1];
  // Fallback for major broadcasters when no naver mirror
  const host = (item?.originallink || "").match(/^https?:\/\/(?:www\.|m\.)?([^/]+)/)?.[1] || "";
  if (host.includes("yna.co.kr")) return "001";
  if (host.includes("ytn.co.kr")) return "052";
  if (host.includes("sbs.co.kr")) return "055";
  if (host.includes("kbs.co.kr")) return "056";
  if (host.includes("imbc.com") || host.includes("mbc.co.kr")) return "214";
  return null;
}
for (const c of finalCases) {
  const hosts = new Set();
  const pids = new Set();
  for (const idx of c.title_indices) {
    const item = search.items[idx];
    const h = publisherHost(item);
    if (h) hosts.add(h);
    const pid = naverPressId(item);
    if (pid) pids.add(pid);
  }
  c.publisher_count = hosts.size;
  c.publishers = [...hosts];
  c.naver_press_count = pids.size;
  c.major_press_hits = majorPressIds.filter((p) => pids.has(p));
  c.major_press_count = c.major_press_hits.length;
}

// Sort by title_count desc (largest cases first)
finalCases.sort((a, b) => b.title_count - a.title_count);

// Filter — broadcaster majors AND baseline thresholds
const passes = (c) =>
  c.title_count >= minTitles &&
  c.publisher_count >= minPublishers &&
  c.major_press_count >= majorPressMin;
const keptCases = finalCases.filter(passes);
const dropped = finalCases.filter((c) => !passes(c));
if (minTitles > 1 || minPublishers > 1 || majorPressMin > 0) {
  console.error(`\nFilter: kept ${keptCases.length} / ${finalCases.length} cases`);
  console.error(`  Conditions: min_titles=${minTitles}, min_publishers=${minPublishers}, ` +
                `major_press≥${majorPressMin} of [${majorPressIds.join(",")}]`);
  console.error(`  Dropped ${dropped.length} cases (${dropped.reduce((s, c) => s + c.title_count, 0)} titles → uncovered)`);
}

// Coverage stats — only count titles in KEPT cases
const allCovered = new Set();
for (const c of keptCases) for (const i of c.title_indices) allCovered.add(i);
const uncoveredIdxs = titles.map((t) => t.idx).filter((i) => !allCovered.has(i));

const out = {
  source: inPath,
  query: search.query,
  total_titles: titles.length,
  total_unique_cases: keptCases.length,
  filter: { min_titles: minTitles, dropped_cases: dropped.length, dropped_titles: dropped.reduce((s, c) => s + c.title_count, 0) },
  coverage: {
    covered: allCovered.size,
    uncovered: uncoveredIdxs.length,
    coverage_pct: ((allCovered.size / titles.length) * 100).toFixed(1),
  },
  model,
  cases: keptCases,
  uncovered_title_indices: uncoveredIdxs,
};

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
console.error(`\n=== Summary ===`);
console.error(`Titles:   ${out.total_titles}`);
console.error(`Cases:    ${out.total_unique_cases}`);
console.error(`Coverage: ${out.coverage.covered}/${out.total_titles} (${out.coverage.coverage_pct}%)`);
console.error(`Cases passed (sorted by major_press desc):`);
const sortedKept = [...keptCases].sort((a, b) => b.major_press_count - a.major_press_count);
for (const c of sortedKept) {
  const majors = c.major_press_hits.map((p) => ({"001":"연합","052":"YTN","055":"SBS","056":"KBS","214":"MBC"}[p]||p)).join("+");
  console.error(`  [${c.title_count.toString().padStart(3)}건/${(c.publisher_count + "").padStart(3)}매체/${c.major_press_count}대] ${c.case_name}  ← ${majors}`);
}
console.error(`\nFull output → ${outPath}`);
