// PansaWatch — Case master persistence + 3-layer matcher.
//
// Layer 1: deterministic rule (defendant + court + sentencing_date)
// Layer 2: embedding cosine similarity (KURE-v1 via local vLLM)
// Layer 3: (optional, not implemented in v0) LLM disambiguation
//
// Master file: data/cases-master/index.json

import fs from "node:fs/promises";
import path from "node:path";

const MASTER_PATH = "data/cases-master/index.json";
const EMBED_BASE_URL = process.env.EMBED_BASE_URL || "http://localhost:8001/v1";
const EMBED_MODEL = process.env.EMBED_MODEL || "nlpai-lab/KURE-v1";

// ─── Load / save master ─────────────────────────────────────────────
export async function loadMaster() {
  try {
    const raw = await fs.readFile(MASTER_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") {
      return { case_uid_seq: 0, cases: {}, schema_version: "0.1" };
    }
    throw e;
  }
}

export async function saveMaster(master) {
  await fs.mkdir(path.dirname(MASTER_PATH), { recursive: true });
  await fs.writeFile(MASTER_PATH, JSON.stringify(master, null, 2), "utf8");
}

export function nextCaseUid(master) {
  master.case_uid_seq += 1;
  const yyyy = new Date().getFullYear();
  return `KR-${yyyy}-${String(master.case_uid_seq).padStart(4, "0")}`;
}

// ─── Embedding ──────────────────────────────────────────────────────
export async function embed(text) {
  const res = await fetch(`${EMBED_BASE_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embed HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Build embedding text from a case IE result ─────────────────────
export function caseEmbeddingText(ie) {
  const parts = [];
  if (ie.defendant?.name) parts.push(`피고인: ${ie.defendant.name}`);
  if (ie.court?.name || ie.court?.division)
    parts.push(`재판부: ${[ie.court.name, ie.court.division, ie.court.instance].filter(Boolean).join(" ")}`);
  if (ie.sentencing_date) parts.push(`선고일: ${ie.sentencing_date}`);
  if (ie.charges?.length)
    parts.push(`혐의: ${ie.charges.map((c) => `${c.law}${c.type ? " " + c.type : ""}`).join(", ")}`);
  if (ie.summary_one_paragraph) parts.push(`요약: ${ie.summary_one_paragraph}`);
  return parts.join("\n");
}

// ─── Build deterministic rule key ───────────────────────────────────
export function ruleKey(ie) {
  const def = (ie.defendant?.name || "").trim();
  const court = ie.court?.name || "";
  const div = ie.court?.division || "";
  const date = ie.sentencing_date || "";
  return `${def}|${court}|${div}|${date}`;
}

// ─── 3-layer match ──────────────────────────────────────────────────
export async function matchCase(newIe, master, opts = {}) {
  const { embeddingHigh = 0.92, embeddingGray = 0.75, embedFn = embed } = opts;

  // Layer 1: rule key
  const newKey = ruleKey(newIe);
  const def = (newIe.defendant?.name || "").trim();
  if (def && newIe.court?.name && newIe.sentencing_date) {
    for (const [uid, c] of Object.entries(master.cases)) {
      if (c.rule_key === newKey) {
        return { uid, tier: 1, confidence: 1.0, reason: "exact rule match" };
      }
    }
  }

  // Layer 2: embedding cosine
  const text = caseEmbeddingText(newIe);
  let newEmb = null;
  try {
    newEmb = await embedFn(text);
  } catch (e) {
    return { uid: null, tier: "embedding-failed", error: e.message, embedding_text: text };
  }

  let best = { uid: null, sim: -1 };
  for (const [uid, c] of Object.entries(master.cases)) {
    if (!c.embedding) continue;
    const s = cosine(newEmb, c.embedding);
    if (s > best.sim) best = { uid, sim: s };
  }

  if (best.sim >= embeddingHigh) {
    // require defendant.name agreement when embedding match
    const cand = master.cases[best.uid];
    const candDef = cand.match_keys?.defendant_name || "";
    const sameDefendant = candDef && def && candDef === def;
    if (sameDefendant || candDef === "" || def === "") {
      return { uid: best.uid, tier: 2, confidence: best.sim, reason: "embedding ≥ high" };
    }
    return { uid: null, tier: "embedding-defendant-mismatch", sim: best.sim, candidate: best.uid };
  }
  if (best.sim >= embeddingGray) {
    return { uid: null, tier: "gray-zone", sim: best.sim, candidate: best.uid, embedding: newEmb, embedding_text: text };
  }
  return { uid: null, tier: "no-match", sim: best.sim, embedding: newEmb, embedding_text: text };
}

// ─── Helpers — apply match result ──────────────────────────────────
export function bumpStats(masterCase, statsTs, titleCount, publisherCount) {
  if (!masterCase.stats_history) masterCase.stats_history = [];
  masterCase.stats_history.push({ ts: statsTs, title_count: titleCount, publisher_count: publisherCount });
  masterCase.last_updated_at = statsTs;
}

export function shouldRerunIE(masterCase, newCluster, opts = {}) {
  const { staleDays = 7, growthThreshold = 1.3 } = opts;
  const lastIe = masterCase.last_ie_at ? new Date(masterCase.last_ie_at) : null;
  if (!lastIe) return true;
  const days = (Date.now() - lastIe.getTime()) / 86_400_000;
  if (days >= staleDays) return true;
  const lastIeTitleCount = masterCase.last_ie_title_count || 0;
  if (lastIeTitleCount > 0 && newCluster.title_count / lastIeTitleCount >= growthThreshold) return true;
  // Also re-run when previous IE had any "low" confidence — chance to improve
  const conf = masterCase.ie_snapshot?.field_confidence || {};
  if (Object.values(conf).some((v) => v === "low")) return true;
  return false;
}

export function registerNewCase(master, ie, embedding, embeddingText, statsTs, cluster, recId) {
  const uid = nextCaseUid(master);
  master.cases[uid] = {
    case_uid: uid,
    case_name: cluster.case_name,
    rule_key: ruleKey(ie),
    match_keys: {
      defendant_name: ie.defendant?.name || null,
      court_name: ie.court?.name || null,
      court_division: ie.court?.division || null,
      sentencing_date: ie.sentencing_date || null,
      category: cluster.category || null,
    },
    first_seen_at: statsTs,
    last_updated_at: statsTs,
    last_ie_at: statsTs,
    last_ie_title_count: cluster.title_count,
    embedding,
    embedding_text: embeddingText,
    ie_snapshot: ie,
    stats_history: [{ ts: statsTs, title_count: cluster.title_count, publisher_count: cluster.publisher_count }],
    cards_emitted: recId ? [{ rec_id: recId, type: "first", emitted_at: statsTs }] : [],
  };
  return uid;
}

export function recordCardEmission(masterCase, recId, type, statsTs, reason = "") {
  if (!masterCase.cards_emitted) masterCase.cards_emitted = [];
  masterCase.cards_emitted.push({ rec_id: recId, type, emitted_at: statsTs, reason });
}
