#!/usr/bin/env node
// Search Naver News API and save raw results.
//
// Usage:
//   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... \
//     node scripts/naver-search.mjs "김건희 2심 선고" --display 100 --pages 3 --out data/news/raw/kim-gh-2sim-search.json
//
// Notes:
// - Each call returns up to 100 items; up to 10 pages (start <= 1000) per query.
// - Total fetchable = 1000 items per query, no matter what `total` says.
// - Dedupes by originallink across pages.

import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const query = args[0];
if (!query) {
  console.error("Usage: node scripts/naver-search.mjs '<query>' [--display N] [--pages N] [--out <file>] [--sort sim|date]");
  process.exit(1);
}

function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const display = Math.min(parseInt(flag("display", "100"), 10), 100);
const pages = Math.min(parseInt(flag("pages", "1"), 10), 10);
const sort = flag("sort", "date");
const outPath = flag("out", `data/news/raw/${query.replace(/\s+/g, "-")}.json`);

const clientId = process.env.NAVER_CLIENT_ID;
const clientSecret = process.env.NAVER_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Missing NAVER_CLIENT_ID / NAVER_CLIENT_SECRET in env");
  process.exit(1);
}

const all = new Map(); // originallink -> item
let total = 0;
let lastBuildDate = null;

for (let page = 0; page < pages; page++) {
  const start = page * display + 1;
  if (start > 1000) break; // API ceiling

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("start", String(start));
  url.searchParams.set("sort", sort);

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  if (!res.ok) {
    console.error(`page ${page + 1} failed: ${res.status} ${await res.text()}`);
    break;
  }
  const data = await res.json();
  total = data.total;
  lastBuildDate = data.lastBuildDate;

  for (const item of data.items ?? []) {
    if (!all.has(item.originallink)) all.set(item.originallink, item);
  }
  console.error(`  page ${page + 1}: +${data.items?.length ?? 0} items (cumulative unique: ${all.size})`);

  // Polite — 10 RPS limit per docs
  await new Promise((r) => setTimeout(r, 150));
}

const out = {
  query,
  fetched_at: new Date().toISOString(),
  last_build_date: lastBuildDate,
  total_matching: total,
  unique_count: all.size,
  items: [...all.values()],
};

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
console.error(`\nSaved ${all.size} unique items → ${outPath}`);
console.error(`(API reports ${total.toLocaleString()} total matching; max retrievable per query is 1000)`);
