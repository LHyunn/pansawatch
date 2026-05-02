#!/usr/bin/env node
// Fetch full article bodies for items in a Naver search JSON.
// Prefers the Naver mirror (n.news.naver.com) — consistent DOM, parseable.
//
// Usage:
//   node scripts/fetch-news-bodies.mjs \
//     --in data/news/raw/kim-gh-2sim-search.json \
//     --out data/news/bodies/kim-gh-2sim.json \
//     --html-cache data/news/raw/html
//
// Output JSON shape:
//   [{ source_url, mirror_url, press_id, sid, title, body, body_chars,
//      pub_date, fetched_at, publisher, fetch_status }, ...]

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const inPath = flag("in");
const outPath = flag("out");
const cacheDir = flag("html-cache", "data/news/raw/html");
const concurrency = parseInt(flag("concurrency", "4"), 10);
const onlyMirror = flag("only-mirror", "true") === "true"; // skip external URLs by default

if (!inPath || !outPath) {
  console.error("Usage: --in <search.json> --out <bodies.json> [--html-cache dir] [--concurrency N] [--only-mirror false]");
  process.exit(1);
}

const UA = "Mozilla/5.0 PansaWatch/0.1 (research; contact dns05018@gmail.com)";

// ─── HTML decode + strip ────────────────────────────────────────────
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

// ─── Naver mirror DOM extraction ────────────────────────────────────
function parseNaverMirror(html) {
  const out = {
    title: null,
    body: null,
    publisher: null,
    pub_date: null,
    byline: null,
  };

  // Title: <h2 class="media_end_head_headline">…</h2> or og:title
  const titleEl = html.match(/<h2[^>]*class="media_end_head_headline[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
  if (titleEl) out.title = decodeEntities(stripTags(titleEl[1]));
  if (!out.title) {
    const og = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
    if (og) out.title = decodeEntities(og[1]);
  }

  // Body: <article id="dic_area"> ... </article>  OR  <div id="dic_area"> ... </div>
  const articleEl =
    html.match(/<article[^>]+id="dic_area"[^>]*>([\s\S]*?)<\/article>/) ||
    html.match(/<div[^>]+id="dic_area"[^>]*>([\s\S]*?)<\/div>/);
  if (articleEl) {
    let bodyHtml = articleEl[1];
    // Drop image captions and end-of-article boxes
    bodyHtml = bodyHtml.replace(/<em\s+class="img_desc"[\s\S]*?<\/em>/g, "");
    bodyHtml = bodyHtml.replace(/<div\s+class="end_photo_org"[\s\S]*?<\/div>/g, "");
    out.body = decodeEntities(stripTags(bodyHtml));
  }

  // Publisher: <a class="media_end_head_top_logo" title="…"> or og:article:author
  const pubEl =
    html.match(/<a[^>]+class="media_end_head_top_logo[^"]*"[^>]*title="([^"]+)"/) ||
    html.match(/<meta\s+property="og:article:author"\s+content="([^"]+)"/);
  if (pubEl) out.publisher = decodeEntities(pubEl[1]).trim();

  // Pub date — data-date-time attribute or datetime attribute
  const dateEl =
    html.match(/data-date-time="([^"]+)"/) ||
    html.match(/<meta\s+property="article:published_time"\s+content="([^"]+)"/);
  if (dateEl) out.pub_date = dateEl[1];

  // Byline (reporter)
  const byline = html.match(/<em[^>]+class="media_end_head_journalist_name"[^>]*>([\s\S]*?)<\/em>/);
  if (byline) out.byline = decodeEntities(stripTags(byline[1]));

  return out;
}

// ─── URL classification ─────────────────────────────────────────────
function classifyLink(item) {
  const link = item.link || item.originallink;
  const m = link.match(/n\.news\.naver\.com\/(?:mnews\/)?article\/(\d+)\/(\d+)\?(?:.*?sid=(\d+))?/);
  if (m) {
    return {
      kind: "naver-mirror",
      url: link,
      press_id: m[1],
      article_id: m[2],
      sid: m[3] ? parseInt(m[3], 10) : null,
    };
  }
  // sports.naver.com or m.sports.naver.com — different DOM, treat as external for now
  return { kind: "external", url: item.originallink, press_id: null, article_id: null, sid: null };
}

// ─── Fetch with retry + cache ───────────────────────────────────────
async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function fetchHtml(url, cachePath) {
  try {
    const cached = await fs.readFile(cachePath, "utf8");
    return { html: cached, cached: true };
  } catch {}

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await fs.writeFile(cachePath, html, "utf8");
      return { html, cached: false };
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────
const search = JSON.parse(await fs.readFile(inPath, "utf8"));
console.error(`Loaded ${search.items.length} items from ${inPath}`);

await ensureDir(cacheDir);
await ensureDir(path.dirname(outPath));

const results = [];
let i = 0;
let okCount = 0;
let skipCount = 0;
let failCount = 0;

async function processItem(item) {
  const cls = classifyLink(item);

  if (cls.kind !== "naver-mirror" && onlyMirror) {
    skipCount++;
    return {
      source_url: item.originallink,
      mirror_url: null,
      press_id: null,
      sid: null,
      title: item.title.replace(/<\/?b>/g, ""),
      body: null,
      body_chars: 0,
      pub_date: item.pubDate,
      publisher: null,
      byline: null,
      fetch_status: "skipped-external",
      fetched_at: new Date().toISOString(),
    };
  }

  const cacheFile = path.join(
    cacheDir,
    `${cls.press_id || "ext"}_${cls.article_id || crypto.createHash("md5").update(cls.url).digest("hex").slice(0, 12)}.html`,
  );

  try {
    const { html, cached } = await fetchHtml(cls.url, cacheFile);
    const parsed = cls.kind === "naver-mirror" ? parseNaverMirror(html) : { title: null, body: null, publisher: null, pub_date: null, byline: null };
    okCount++;
    return {
      source_url: item.originallink,
      mirror_url: cls.url,
      press_id: cls.press_id,
      sid: cls.sid,
      title: parsed.title || item.title.replace(/<\/?b>/g, ""),
      body: parsed.body,
      body_chars: parsed.body?.length ?? 0,
      pub_date: parsed.pub_date || item.pubDate,
      publisher: parsed.publisher,
      byline: parsed.byline,
      fetch_status: cached ? "ok-cached" : "ok-fresh",
      fetched_at: new Date().toISOString(),
    };
  } catch (e) {
    failCount++;
    return {
      source_url: item.originallink,
      mirror_url: cls.url,
      press_id: cls.press_id,
      sid: cls.sid,
      title: item.title.replace(/<\/?b>/g, ""),
      body: null,
      body_chars: 0,
      pub_date: item.pubDate,
      publisher: null,
      byline: null,
      fetch_status: `error: ${e.message}`,
      fetched_at: new Date().toISOString(),
    };
  }
}

// Simple concurrency pool
async function pool(items, n, fn) {
  const queue = items.slice();
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
      i++;
      if (i % 5 === 0 || i === items.length) {
        console.error(`  ${i}/${items.length} (ok:${okCount} skip:${skipCount} fail:${failCount})`);
      }
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

const bodies = await pool(search.items, concurrency, processItem);

await fs.writeFile(
  outPath,
  JSON.stringify(
    {
      source: inPath,
      query: search.query,
      fetched_at: new Date().toISOString(),
      counts: { total: bodies.length, ok: okCount, skipped: skipCount, failed: failCount },
      items: bodies,
    },
    null,
    2,
  ),
  "utf8",
);
console.error(`\nSaved ${bodies.length} bodies → ${outPath}`);
console.error(`HTML cache: ${cacheDir}/`);
