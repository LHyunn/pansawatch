#!/usr/bin/env node
// Extract structured legal-case info from a Naver news article using Gemma 4 31B (vLLM).
//
// Pipeline:
//   1. Stop any prior vLLM container (clean state)
//   2. Start vllm/vllm-openai:v0.20.1-cu129 with google/gemma-4-31B-it (FP8 online quantization)
//   3. Wait for /health
//   4. Open SSH tunnel local:8000 → remote:8000
//   5. For each Naver URL:
//        fetch HTML → parse mirror DOM → call LLM → schema-strict JSON
//   6. Stop & remove container (frees GPU memory)
//
// Usage:
//   HF_TOKEN=hf_xxx node scripts/extract-from-naver-url.mjs <url1> [url2] ...
//   node scripts/extract-from-naver-url.mjs https://n.news.naver.com/mnews/article/469/0000928371?sid=102
//
// Output schema (per article):
//   { date, court, bench, case_number, judge, charges, demand, sentence, summary1, summary2 }

import { spawn, spawnSync } from "node:child_process";

// ─── Config ───────────────────────────────────────────────────────────
const SSH_USER = "gpuadmin";
const SSH_HOST = "115.145.134.192";
const SSH_PORT = "10002";

const CONTAINER_NAME = "pansawatch-extract";
const VLLM_IMAGE = "vllm/vllm-openai:v0.20.1-cu129";
const MODEL = "google/gemma-4-31B-it";
const VLLM_PORT = "8000";

const HF_TOKEN = process.env.HF_TOKEN || "";
const UA = "Mozilla/5.0 PansaWatch/0.1 (research)";

// ─── SSH helpers ──────────────────────────────────────────────────────
function ssh(remoteCmd, opts = {}) {
  const r = spawnSync(
    "ssh",
    ["-o", "ConnectTimeout=10", "-p", SSH_PORT, `${SSH_USER}@${SSH_HOST}`, remoteCmd],
    { encoding: "utf8", ...opts },
  );
  return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function spawnSshTunnel() {
  // -N: no command, -T: no PTY. Auto-dies when parent exits.
  const proc = spawn(
    "ssh",
    [
      "-N", "-T",
      "-o", "ExitOnForwardFailure=yes",
      "-o", "ServerAliveInterval=30",
      "-p", SSH_PORT,
      "-L", `${VLLM_PORT}:localhost:${VLLM_PORT}`,
      `${SSH_USER}@${SSH_HOST}`,
    ],
    { stdio: "ignore" },
  );
  return proc;
}

// ─── Container lifecycle ──────────────────────────────────────────────
async function startContainer() {
  console.error("→ Cleaning prior containers (any taking port 8000)…");
  // Stop the named one + any other vLLM tests we've left around
  ssh(`docker rm -f ${CONTAINER_NAME} vllm-gemma4 vllm-test 2>/dev/null; true`);

  console.error(`→ Starting ${VLLM_IMAGE} with ${MODEL}…`);
  // Hardware-fit args for RTX 6000 Ada 48GB:
  //  - --quantization fp8: online FP8 quantization (Gemma 4 31B BF16 = 62GB → 31GB)
  //  - --kv-cache-dtype fp8: halves KV cache memory
  //  - --max-model-len 16384: Gemma 4 has wide head_dim so KV is expensive; 16K fits
  const startCmd = [
    `docker run -d --name ${CONTAINER_NAME}`,
    `--gpus '"device=0"'`,
    `-v ~/.cache/huggingface:/root/.cache/huggingface`,
    HF_TOKEN ? `--env "HF_TOKEN=${HF_TOKEN}"` : "",
    `-p ${VLLM_PORT}:8000`,
    `--ipc=host`,
    VLLM_IMAGE,
    `--model ${MODEL}`,
    `--quantization fp8`,
    `--kv-cache-dtype fp8`,
    `--max-model-len 16384`,
    `--max-num-batched-tokens 16384`,
    `--max-num-seqs 4`,
    `--gpu-memory-utilization 0.95`,
    `--enable-prefix-caching`,
  ]
    .filter(Boolean)
    .join(" ");

  const r = ssh(startCmd);
  if (r.code !== 0) throw new Error(`docker run failed: ${r.stderr || r.stdout}`);
  console.error(`  Container started: ${r.stdout.trim().slice(0, 12)}`);
}

async function waitForHealth(timeoutMs = 1_200_000) {
  console.error("→ Waiting for vLLM /health (model load + compile takes 1–10 min)…");
  const t0 = Date.now();
  let lastDots = 0;
  while (Date.now() - t0 < timeoutMs) {
    const r = ssh(`curl -fsS http://localhost:${VLLM_PORT}/health -m 5 -o /dev/null && echo OK || echo WAIT`);
    if (r.stdout.includes("OK")) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.error(`\n  ✓ vLLM ready (${elapsed}s)`);
      return;
    }
    // Detect early crash
    const psR = ssh(`docker ps -q --filter name=${CONTAINER_NAME}`);
    if (!psR.stdout.trim()) {
      const logs = ssh(`docker logs ${CONTAINER_NAME} 2>&1 | tail -30`);
      throw new Error(`Container exited unexpectedly. Last logs:\n${logs.stdout}`);
    }
    if (++lastDots % 6 === 0) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      process.stderr.write(` ${elapsed}s `);
    } else {
      process.stderr.write(".");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`vLLM did not become ready within ${timeoutMs / 1000}s`);
}

async function stopContainer() {
  console.error("→ Stopping & removing container (freeing GPU)…");
  ssh(`docker rm -f ${CONTAINER_NAME} 2>/dev/null; true`);
  // Verify GPU memory freed
  const g = ssh(`nvidia-smi --query-gpu=index,memory.used --format=csv,noheader 2>&1`);
  console.error(`  GPU state:\n    ${g.stdout.trim().split("\n").join("\n    ")}`);
}

// ─── Naver article fetch + parse ──────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseNaverMirror(html) {
  const out = { title: null, body: null, publisher: null, pub_date: null };

  const titleEl = html.match(/<h2[^>]*class="media_end_head_headline[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
  if (titleEl) out.title = decodeEntities(stripTags(titleEl[1]));
  if (!out.title) {
    const og = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
    if (og) out.title = decodeEntities(og[1]);
  }

  const articleEl =
    html.match(/<article[^>]+id="dic_area"[^>]*>([\s\S]*?)<\/article>/) ||
    html.match(/<div[^>]+id="dic_area"[^>]*>([\s\S]*?)<\/div>/);
  if (articleEl) {
    let bodyHtml = articleEl[1]
      .replace(/<em\s+class="img_desc"[\s\S]*?<\/em>/g, "")
      .replace(/<div\s+class="end_photo_org"[\s\S]*?<\/div>/g, "");
    out.body = decodeEntities(stripTags(bodyHtml));
  }

  const pubEl =
    html.match(/<a[^>]+class="media_end_head_top_logo[^"]*"[^>]*title="([^"]+)"/) ||
    html.match(/<meta\s+property="og:article:author"\s+content="([^"]+)"/);
  if (pubEl) out.publisher = decodeEntities(pubEl[1]).trim();

  const dateEl =
    html.match(/data-date-time="([^"]+)"/) ||
    html.match(/<meta\s+property="article:published_time"\s+content="([^"]+)"/);
  if (dateEl) out.pub_date = dateEl[1];

  return out;
}

async function fetchNaverArticle(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  const parsed = parseNaverMirror(html);
  if (!parsed.body) throw new Error(`Could not extract body — is this a Naver mirror URL? (${url})`);
  return { url, ...parsed, body_chars: parsed.body.length };
}

// ─── Schema + Prompt ──────────────────────────────────────────────────
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "date", "court", "bench", "case_number", "judge",
    "charges", "demand", "sentence", "summary1", "summary2",
  ],
  properties: {
    date:        { type: ["string", "null"], description: "선고일 YYYY-MM-DD" },
    court:       { type: ["string", "null"], description: "법원 정식명, 예: 서울고등법원" },
    bench:       { type: ["string", "null"], description: "재판부, 예: 형사15-2부" },
    case_number: { type: ["string", "null"], description: "사건번호, 예: 2024노1234. 본문에 없으면 null" },
    judge:       { type: ["string", "null"], description: "재판장 (이름 + 직위), 예: 신종오 부장판사" },
    charges:     { type: ["string", "null"], description: "혐의 (적용 법령). 여러 개면 쉼표로 구분 한 문자열" },
    demand:      { type: ["string", "null"], description: "검찰 구형, 예: 징역 15년. 본문에 없으면 null" },
    sentence:    { type: ["string", "null"], description: "선고 결과 — 자유형·벌금·추징금·집행유예 등 종합" },
    summary1:    { type: "string",          description: "10어절 내외 한 줄 핵심 요약 (절대 12어절 초과 금지)" },
    summary2:    { type: "string",          description: "20어절 내외 두 줄 요약 (절대 22어절 초과 금지)" },
  },
};

const SYSTEM_PROMPT = `당신은 한국 형사 사건 보도에서 구조화된 사실을 추출하는 시스템입니다.

규칙:
1. 본문에 명시된 정보만 추출. 추론·가정 금지. 본문에 없으면 null.
2. 한국 사법 표준 표기 사용: "1심","2심","대법원","징역","벌금","추징금","집행유예","항소심","파기환송" 등.
3. court는 정식 법원명 — "서울고등법원","광주지방법원","대법원" 등 (약어 풀어서).
4. bench는 형사부 표기 — "형사15-2부","형사5단독","형사3부" 등.
5. case_number는 한국 사건번호 형식 — "2024노1234","2023고합567","2024도789" 등. 본문에 없으면 null.
6. judge: 재판장만 추출. 형식 "이름 직위" (예: "신종오 부장판사"). 배석 판사·합의부 다른 판사는 제외.
7. charges: 적용 법령명 한 문자열 — "자본시장법 위반","정치자금법 위반, 특정범죄가중처벌법상 알선수재" 등.
8. sentence: 본문에 명시된 모든 결과 구성요소를 한 문자열에 빠짐없이 결합.
   포함 대상: 자유형(징역/금고/구류), 벌금, 추징금, 집행유예 기간, 보호관찰, 사회봉사,
            수강명령, 자격정지, 선고유예, 면소, 무죄, 공소기각, 각하 등 본문에 등장하는 모든 양형 요소.
   예: "징역 4년, 벌금 5,000만원, 추징금 2,094만원" / "징역 6개월, 집행유예 2년, 사회봉사 120시간"
       / "무죄" / "공소기각".
   ⚠ 본문에 추징금·벌금이 명시되어 있는데 sentence에 누락하면 안 됨.
9. demand: 검찰 구형(求刑). 본문에 명시된 경우만. 예: "징역 15년".
10. summary1: 10어절 내외 한 줄 요약. 절대 12어절 초과 금지. 정보성 기술. 추측·논평 금지.
    가능하면 "{재판장 이름} {직위}, {핵심 결과}" 형식.
    예: "송병훈 부장판사, 변기 출산 17세 산모 실형 선고" (8어절)
11. summary2: 20어절 내외 두 줄 요약. 절대 22어절 초과 금지.
    ⚠ **반드시** "{재판장 이름} {법원 약식} {직위}, {사건 개요 + 결과}" 형식으로 시작.
    법원 약식: 수원지법, 서울고법, 광주지법, 대법원 등 (정식 명칭은 court 필드만, summary는 약식).
    예: "송병훈 수원지법 부장판사, 변기에서 출산한 아기를 방치해 숨지게 한 17세 산모에게 장기 2년 6월·단기 2년 선고."
    예: "신종오 서울고법 부장판사, 김건희 전 영부인의 도이치 주가조작 항소심에서 징역 4년·벌금 5,000만원 선고."
    재판장 정보가 본문에 없는 경우에만 법원 약식으로 시작 ("수원지법 형사11부, …").
    어절 = 띄어쓰기로 나뉘는 단위. "징역 4년" = 2어절.
12. 출력은 제공된 JSON Schema에 정확히 맞아야 합니다.`;

const FEW_SHOT = `<예시 입력>
서울고법 형사15-2부(부장 신종오 성언주 원익선)는 28일 자본시장법 위반(주가조작 공동정범) 등 혐의로 기소된 김건희 전 영부인에 대해 징역 4년과 벌금 5,000만원, 추징금 2,094만원을 선고했다(2024노1234). 검찰은 1심에서 징역 15년을 구형했으며, 1심 재판부는 1년 8개월을 선고한 바 있다. 김건희 측은 즉시 상고했다.
</예시 입력>

<예시 출력>
{"date":"2026-04-28","court":"서울고등법원","bench":"형사15-2부","case_number":"2024노1234","judge":"신종오 부장판사","charges":"자본시장법 위반","demand":"징역 15년","sentence":"징역 4년, 벌금 5,000만원, 추징금 2,094만원","summary1":"신종오 부장판사, 김건희 자본시장법 위반 징역 4년 선고","summary2":"신종오 서울고법 부장판사, 김건희 전 영부인의 도이치모터스 주가조작 혐의 항소심에서 징역 4년·벌금 5,000만원·추징금 2,094만원 선고."}
</예시 출력>`;

async function extract(article) {
  const userMsg = `발행일: ${article.pub_date || "unknown"}
매체: ${article.publisher || "unknown"}
제목: ${article.title || ""}

<기사 본문>
${article.body}
</기사 본문>

위 본문에서 사건 정보를 JSON으로 추출하세요. 본문에 없는 필드는 null. 모든 schema 필수 키는 출력에 포함되어야 합니다.`;

  const t0 = Date.now();
  const res = await fetch(`http://localhost:${VLLM_PORT}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + FEW_SHOT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: {
        type: "json_schema",
        json_schema: { name: "case_extract", schema: SCHEMA, strict: true },
      },
    }),
  });

  if (!res.ok) throw new Error(`vLLM HTTP ${res.status}: ${(await res.text()).slice(0, 600)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  return {
    extracted: JSON.parse(content),
    latency_ms: Date.now() - t0,
    usage: data.usage,
  };
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const urls = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (urls.length === 0) {
    console.error("Usage: node scripts/extract-from-naver-url.mjs <naver-url> [naver-url2] ...");
    console.error("");
    console.error("  Reads each Naver news URL, extracts structured case info via Gemma 4 31B,");
    console.error("  prints final JSON to stdout. Container is removed at end (GPU memory freed).");
    console.error("");
    console.error("  Env: HF_TOKEN — optional, raises HF download rate limits");
    process.exit(1);
  }

  let tunnel = null;
  let containerStarted = false;

  const cleanup = async () => {
    if (tunnel) {
      try { tunnel.kill("SIGTERM"); } catch {}
      tunnel = null;
    }
    if (containerStarted) {
      await stopContainer();
      containerStarted = false;
    }
  };

  process.on("SIGINT", async () => { console.error("\n[SIGINT] cleanup…"); await cleanup(); process.exit(130); });
  process.on("SIGTERM", async () => { await cleanup(); process.exit(143); });

  try {
    await startContainer();
    containerStarted = true;
    await waitForHealth();

    console.error("→ Opening SSH tunnel localhost:8000 → remote:8000…");
    tunnel = spawnSshTunnel();
    await new Promise((r) => setTimeout(r, 2500));

    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.error(`\n[${i + 1}/${urls.length}] ${url}`);
      try {
        const article = await fetchNaverArticle(url);
        console.error(`  Fetched: ${article.publisher || "?"} | ${article.pub_date || "?"} | ${article.body_chars}자`);
        console.error(`  Title:   ${article.title?.slice(0, 80) || ""}`);
        const { extracted, latency_ms, usage } = await extract(article);
        console.error(`  Extracted in ${(latency_ms / 1000).toFixed(1)}s, ${usage?.completion_tokens || "?"}t out`);
        results.push({
          url: article.url,
          source: {
            publisher: article.publisher,
            pub_date: article.pub_date,
            title: article.title,
          },
          extraction: extracted,
        });
      } catch (e) {
        console.error(`  ERROR: ${e.message}`);
        results.push({ url, error: e.message });
      }
    }

    // Final JSON to stdout (single object if 1 url, array otherwise)
    const out = results.length === 1 ? results[0] : results;
    console.error("\n=== Output ===");
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await cleanup();
  }
}

main().catch(async (e) => {
  console.error("\nFATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
