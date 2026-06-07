#!/usr/bin/env node
// Fetch Naver news articles for the query "법원 선고" and output them as JSON.
// Judgment of *which* articles depict controversially lenient sentencing is
// delegated to Sonnet sub-agents downstream — this script does no scoring.
//
// Usage:
//   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... \
//     node scripts/find-controversial-articles.mjs \
//       [--query "법원 선고"] [--display 100] \
//       [--state-file data/seen-articles.json] \
//       [--ignore-state] [--dry-run] [--all-links]
//
// Flags:
//   --display N        Total items to fetch (1-1000; paginates in 100-item chunks)
//   --state-file P     Where to persist seen-link cache (default data/seen-articles.json)
//   --ignore-state     Skip the state check (re-fetch everything)
//   --dry-run          Don't update state on disk
//   --all-links        Keep non-mirror Naver URLs (default drops them)
//
// Output (stdout, JSON array of NEW items only):
//   [{ title, desc, link, originallink, pubDate }, ...]

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "NAVER_CLIENT_ID and NAVER_CLIENT_SECRET env vars are required (see usage header)."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const QUERY = flag("--query", "법원 선고");
const TOTAL = Math.min(1000, Math.max(1, +flag("--display", 100)));
const STATE_FILE = flag("--state-file", "data/seen-articles.json");
const IGNORE_STATE = args.includes("--ignore-state");
const DRY_RUN = args.includes("--dry-run");
const MIRROR_ONLY = !args.includes("--all-links");

const STATE_LINK_CAP = 5000; // ring-buffer cap to keep state file small

function stripHtml(s) {
  return s
    .replace(/<\/?b>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

async function searchNaver(query, display, start) {
  const url =
    `https://openapi.naver.com/v1/search/news.json` +
    `?query=${encodeURIComponent(query)}` +
    `&display=${display}&start=${start}&sort=date`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": CLIENT_ID,
      "X-Naver-Client-Secret": CLIENT_SECRET,
    },
  });
  if (!res.ok) throw new Error(`Naver API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.items.map((it) => ({
    title: stripHtml(it.title),
    desc: stripHtml(it.description),
    link: it.link,
    originallink: it.originallink,
    pubDate: it.pubDate,
  }));
}

async function searchNaverPaginated(query, total) {
  const all = [];
  for (let start = 1; start <= 1000 && all.length < total; ) {
    const display = Math.min(100, total - all.length);
    process.stderr.write(`  fetching start=${start} display=${display} ... `);
    const items = await searchNaver(query, display, start);
    process.stderr.write(`${items.length} items\n`);
    if (items.length === 0) break;
    all.push(...items);
    start += display;
    await new Promise((r) => setTimeout(r, 150)); // gentle rate-limit
  }
  return all;
}

function loadState() {
  if (IGNORE_STATE || !existsSync(STATE_FILE)) {
    return { lastRunAt: null, latestPubDate: null, seenLinks: [] };
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch (e) {
    process.stderr.write(`  ⚠ state file unreadable, treating as empty: ${e.message}\n`);
    return { lastRunAt: null, latestPubDate: null, seenLinks: [] };
  }
}

function saveState(state) {
  if (DRY_RUN) {
    process.stderr.write(`  (dry-run: state file NOT updated)\n`);
    return;
  }
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  const state = loadState();
  process.stderr.write(
    `State: ${state.seenLinks.length} known links` +
      (state.lastRunAt ? ` (last run: ${state.lastRunAt})` : "") +
      `\n`,
  );

  process.stderr.write(`→ Querying Naver News: "${QUERY}" (total=${TOTAL})\n`);
  const all = await searchNaverPaginated(QUERY, TOTAL);
  process.stderr.write(`  ${all.length} items returned\n`);

  const mirrors = MIRROR_ONLY
    ? all.filter((a) => /n\.news\.naver\.com/.test(a.link))
    : all;
  if (MIRROR_ONLY) {
    process.stderr.write(`  ${mirrors.length} kept (Naver mirror only)\n`);
  }

  const seen = new Set(state.seenLinks);
  const fresh = mirrors.filter((a) => !seen.has(a.link));
  process.stderr.write(
    `  ${fresh.length} fresh (${mirrors.length - fresh.length} already in state)\n`,
  );

  // Commit all fetched mirror links to state (regardless of downstream judgment)
  const merged = [...state.seenLinks, ...mirrors.map((a) => a.link)];
  state.seenLinks = [...new Set(merged)].slice(-STATE_LINK_CAP);
  state.lastRunAt = new Date().toISOString();
  if (mirrors.length) {
    // sort=date returns newest-first; mirrors[0] is the newest of this run
    state.latestPubDate = mirrors[0].pubDate;
  }
  saveState(state);

  console.log(JSON.stringify(fresh, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
