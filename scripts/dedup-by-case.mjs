#!/usr/bin/env node
// Group articles that cover the same case, then pick one representative per
// group following the rules:
//   1. Drop 속보·1보·2보 stubs (no real content)
//   2. Prefer 연합뉴스 → YTN → KBS → SBS → MBC
//   3. Else random (well, deterministic by published date — newest first)
//
// Two clustering modes:
//   (default) heuristic Jaccard token similarity
//   --clusters-file PATH  use pre-computed clusters (e.g. from an LLM call)
//
// Usage:
//   echo '[{title, link, originallink, pubDate, ...}, ...]' \
//     | node scripts/dedup-by-case.mjs [--threshold 0.25]
//
//   echo '[{...articles...}]' \
//     | node scripts/dedup-by-case.mjs --clusters-file path/to/clusters.json
//
//   The clusters file is an array of arrays of links:
//     [ ["https://...A", "https://...B"], ["https://...C"] ]
//
// Stdin:  JSON array of articles
// Stdout: JSON array of representatives (one per cluster), with `clusterSize`
// Stderr: cluster preview

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const THRESHOLD = +flag("--threshold", 0.25);
const CLUSTERS_FILE = flag("--clusters-file", null);

// Tokens that appear in almost every court-news title — exclude from similarity
const STOPWORDS = new Set([
  "항소심", "1심", "2심", "3심", "선고", "법원", "판결",
  "징역", "벌금", "집행유예", "형", "형량", "공판",
  "기소", "구속", "사건", "혐의", "재판",
  "수원고법", "서울고법", "서울중앙지법", "대법원", "지법", "고법",
  "대해", "대한", "대상", "관련", "기소된", "이번",
  "단독", "속보", "자막뉴스", "종합", "포토",
]);

const STUB_RE = /\[?(속보|1보|2보|3보)\]?/;

const PRIORITY = [
  { name: "연합뉴스", domain: /(yna\.co\.kr|연합뉴스)/i, code: "001" },
  { name: "YTN",     domain: /ytn\.co\.kr/i,           code: "052" },
  { name: "KBS",     domain: /(news\.kbs\.co\.kr|kbs\.co\.kr)/i, code: "056" },
  { name: "SBS",     domain: /sbs\.co\.kr/i,           code: "055" },
  { name: "MBC",     domain: /(imbc\.com|mbc\.co\.kr)/i, code: "214" },
];

function isStub(article) {
  return STUB_RE.test(article.title);
}

function tokenize(title) {
  return title
    .replace(/[\[\]【】(){}<>'"…·,.!?·~\-—‘’“”]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function jaccard(a, b) {
  const sa = new Set(a),
    sb = new Set(b);
  let intersection = 0;
  for (const x of sa) if (sb.has(x)) intersection++;
  const unionSize = sa.size + sb.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

function cluster(articles, threshold) {
  const tokens = articles.map((a) => tokenize(a.title));
  const parent = articles.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i, j) => {
    const ri = find(i),
      rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      if (jaccard(tokens[i], tokens[j]) >= threshold) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < articles.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(articles[i]);
  }
  return [...groups.values()];
}

function detectMedia(article) {
  const orig = article.originallink || "";
  const link = article.link || "";
  for (const p of PRIORITY) {
    if (p.domain.test(orig)) return { name: p.name, priority: PRIORITY.indexOf(p) };
    // fallback: press-code in Naver mirror URL: /article/<code>/
    const m = link.match(/\/article\/(\d{3})\//);
    if (m && m[1] === p.code) {
      return { name: p.name, priority: PRIORITY.indexOf(p) };
    }
  }
  return { name: "기타", priority: 999 };
}

function pickRepresentative(group) {
  const nonStubs = group.filter((a) => !isStub(a));
  if (nonStubs.length === 0) return null;

  // Sort: priority asc, then pubDate desc (newest first as tiebreak)
  nonStubs.sort((a, b) => {
    const pa = detectMedia(a).priority;
    const pb = detectMedia(b).priority;
    if (pa !== pb) return pa - pb;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });
  return nonStubs[0];
}

function clusterFromFile(articles, path) {
  const linkClusters = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(linkClusters) || !linkClusters.every(Array.isArray)) {
    throw new Error("clusters file must be array of arrays of links");
  }
  const byLink = new Map(articles.map((a) => [a.link, a]));
  const seen = new Set();
  const groups = [];
  for (const linkArr of linkClusters) {
    const g = linkArr.map((l) => byLink.get(l)).filter(Boolean);
    g.forEach((a) => seen.add(a.link));
    if (g.length) groups.push(g);
  }
  // Any article not in any cluster → singleton
  for (const a of articles) {
    if (!seen.has(a.link)) groups.push([a]);
  }
  return groups;
}

// ─── Main ────────────────────────────────────────────────────────────
const input = readFileSync(0, "utf8");
const articles = JSON.parse(input);
process.stderr.write(`Input: ${articles.length} articles\n`);

const groups = CLUSTERS_FILE
  ? clusterFromFile(articles, CLUSTERS_FILE)
  : cluster(articles, THRESHOLD);
const mode = CLUSTERS_FILE ? `pre-clustered from ${CLUSTERS_FILE}` : `Jaccard threshold=${THRESHOLD}`;
process.stderr.write(`Clustered: ${groups.length} cases (${mode})\n\n`);

const reps = [];
for (const g of groups) {
  const rep = pickRepresentative(g);
  if (!rep) {
    process.stderr.write(
      `  ⊘ [${g.length}] (all stubs, skipped) — ${g[0].title}\n`,
    );
    continue;
  }
  const media = detectMedia(rep);
  process.stderr.write(`  ✓ [${g.length}] ${media.name.padEnd(5)} ${rep.title}\n`);
  if (g.length > 1) {
    for (const o of g) {
      if (o.link === rep.link) continue;
      const om = detectMedia(o);
      process.stderr.write(
        `       └ ${isStub(o) ? "(stub) " : "       "}${om.name.padEnd(5)} ${o.title}\n`,
      );
    }
  }
  reps.push({ ...rep, clusterSize: g.length, media: media.name });
}

console.log(JSON.stringify(reps, null, 2));
