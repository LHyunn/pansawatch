#!/usr/bin/env node
// Retry IE for cases that failed in a daily report (e.g. max_tokens overflow).
// Patches the report in place.
//
// Usage:
//   LOCAL_LLM_BASE_URL=... node scripts/retry-failed-cases.mjs --report data/reports/daily-2026-05-02.json

import fs from "node:fs/promises";

const args = process.argv.slice(2);
function flag(name, fallback) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; }

const reportPath = flag("report");
const baseUrl = process.env.LOCAL_LLM_BASE_URL;
const model = process.env.LLM_MODEL || "google/gemma-4-31B-it";
if (!reportPath || !baseUrl) { console.error("Usage: --report <path>; need LOCAL_LLM_BASE_URL"); process.exit(1); }

const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
const casesData = JSON.parse(await fs.readFile(`data/eval/cases-${report.query.replace(/\s+/g, "-")}-${report.date_kst}.json`, "utf8"));
const search = JSON.parse(await fs.readFile(casesData.source, "utf8"));
const bodies = JSON.parse(await fs.readFile(`data/news/bodies/${report.query.replace(/\s+/g, "-")}-${report.date_kst}.json`, "utf8"));
const bodyByLink = new Map(bodies.items.map((b) => [b.source_url, b]));

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["case_belongs_to_query", "defendant", "court", "judges", "sentencing_date", "charges", "sentence", "previous_instance", "field_confidence", "disagreements", "summary_one_paragraph"],
  properties: {
    case_belongs_to_query: { type: "boolean" },
    defendant: { type: "object", additionalProperties: false, properties: { name: { type: ["string", "null"] }, anonymized: { type: "boolean" } }, required: ["name", "anonymized"] },
    court: { type: "object", additionalProperties: false, properties: { name: { type: ["string", "null"] }, division: { type: ["string", "null"] }, instance: { type: ["string", "null"], enum: ["1심", "2심", "3심", "항소심", "상고심", "대법원", "파기환송", "기타", null] } }, required: ["name", "division", "instance"] },
    judges: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, role: { type: "string", enum: ["부장판사", "판사", "배석", "재판장", "대법관"] } }, required: ["name", "role"] } },
    sentencing_date: { type: ["string", "null"] },
    charges: { type: "array", items: { type: "object", additionalProperties: false, properties: { law: { type: "string" }, type: { type: ["string", "null"] }, details: { type: ["string", "null"] } }, required: ["law", "type", "details"] } },
    sentence: { type: "object", additionalProperties: false, properties: { verdict: { type: ["string", "null"], enum: ["유죄", "무죄", "일부유죄", "공소기각", "각하", "기타", null] }, imprisonment: { type: ["object", "null"], additionalProperties: false, properties: { years: { type: "integer" }, months: { type: "integer" }, suspended: { type: "boolean" } }, required: ["years", "months", "suspended"] }, fine_krw: { type: ["integer", "null"] }, forfeiture_krw: { type: ["integer", "null"] }, probation_years: { type: ["number", "null"] } }, required: ["verdict", "imprisonment", "fine_krw", "forfeiture_krw", "probation_years"] },
    previous_instance: { type: ["object", "null"], additionalProperties: false, properties: { instance: { type: "string" }, imprisonment: { type: ["object", "null"], additionalProperties: false, properties: { years: { type: "integer" }, months: { type: "integer" }, suspended: { type: "boolean" } }, required: ["years", "months", "suspended"] }, verdict: { type: ["string", "null"] } }, required: ["instance", "imprisonment", "verdict"] },
    field_confidence: { type: "object", additionalProperties: false, properties: { court: { type: "string", enum: ["high", "medium", "low"] }, judges: { type: "string", enum: ["high", "medium", "low"] }, sentence: { type: "string", enum: ["high", "medium", "low"] }, charges: { type: "string", enum: ["high", "medium", "low"] }, previous_instance: { type: "string", enum: ["high", "medium", "low"] } }, required: ["court", "judges", "sentence", "charges", "previous_instance"] },
    disagreements: { type: "array", items: { type: "object", additionalProperties: false, properties: { field: { type: "string" }, values: { type: "string" }, resolution: { type: "string" } }, required: ["field", "values", "resolution"] } },
    summary_one_paragraph: { type: "string" },
  },
};

const SYSTEM = `당신은 한국 형사판결 보도 통합 IE 시스템입니다. 본문 사실만 추출. charges.law은 정식 법령명, 매핑 모르면 항목 빼세요. 양형 "1년 8개월" → years=1,months=8. 금액 정수 원 단위. summary_one_paragraph: 1~2문장.`;

const failed = report.cases.filter((c) => c.error || !c.ie);
console.error(`Found ${failed.length} failed cases.\n`);

for (const failedCase of failed) {
  // Find the original cluster by case_id
  const cluster = casesData.cases.find((c) => c.case_id === failedCase.case_id);
  if (!cluster) { console.error(`  ${failedCase.case_id}: cluster not found, skip`); continue; }

  // Pick top 3 articles
  const scored = cluster.title_indices.map((idx) => {
    const item = search.items[idx];
    const body = bodyByLink.get(item?.originallink);
    if (!body || !body.body || body.body_chars < 300) return null;
    const titleHasActor = cluster.main_actors.some((a) => (item.title || "").includes(a));
    return { item, body, score: (titleHasActor ? 100000 : 0) + Math.min(body.body_chars, 6000) };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  const usedHosts = new Set();
  const picked = [];
  for (const s of scored) {
    const m = (s.item.originallink || "").match(/^https?:\/\/(?:www\.)?([^/]+)/);
    const host = m ? m[1] : "?";
    if (usedHosts.has(host) && picked.length < 2) continue;
    picked.push(s); usedHosts.add(host);
    if (picked.length >= 3) break;
  }

  const articlesText = picked.map((p, i) => `<기사 ${i + 1} — ${p.body.publisher} | ${p.body.pub_date}>\n${p.body.body}\n</기사 ${i + 1}>`).join("\n\n");
  const userMsg = `타겟 피고인: ${cluster.main_actors[0] || "?"}\n\n${articlesText}\n\n위 ${picked.length}개 매체의 보도를 통합한 단일 JSON.`;

  process.stderr.write(`  Retry ${cluster.case_id} ${cluster.case_name.slice(0, 40)} ... `);
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }],
        temperature: 0.1, max_tokens: 4096,
        response_format: { type: "json_schema", json_schema: { name: "court_case", schema: SCHEMA, strict: true } },
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const idx = report.cases.findIndex((c) => c.case_id === cluster.case_id);
    report.cases[idx] = {
      case_id: cluster.case_id,
      case_name_cluster: cluster.case_name,
      category: cluster.category,
      title_count: cluster.title_count,
      publisher_count: cluster.publisher_count,
      sources_used: picked.map((p) => ({ publisher: p.body.publisher, url: p.body.mirror_url || p.body.source_url, pub_date: p.body.pub_date, body_chars: p.body.body_chars })),
      ie: parsed,
      latency_ms: Date.now() - t0,
      usage: data.usage,
      retried: true,
    };
    process.stderr.write(`OK (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
  } catch (e) {
    process.stderr.write(`STILL FAIL: ${e.message}\n`);
  }
}

// Update stats
const ie = report.cases.filter((c) => c.ie);
report.stats.cases_ie_succeeded = ie.length;
report.stats.cases_ie_failed = report.cases.length - ie.length;

await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
console.error(`\nReport patched: ${ie.length}/${report.cases.length} cases now have IE.`);
console.error(`→ ${reportPath}`);
