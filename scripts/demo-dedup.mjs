#!/usr/bin/env node
// Demo: prove dedup works by running match-cases-to-master.mjs twice on the same report.
// Run 1: master empty → all 14 cases become NEW.
// Run 2: master has 14 → all 14 should match (tier 1, exact rule key).
// If a 2nd-run case is reported as NEW, dedup is broken.
//
// Usage:
//   EMBED_BASE_URL=http://localhost:8001/v1 \
//     node scripts/demo-dedup.mjs --report data/reports/daily-2026-05-02.json

import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
function flag(name, fb) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fb; }

const reportPath = flag("report", "data/reports/daily-2026-05-02.json");

// 1. Reset master
try { await fs.rm("data/cases-master/index.json"); } catch {}
console.error("✓ Reset master\n");

async function runMatch(label) {
  console.error(`━━━ ${label} ━━━`);
  await new Promise((res, rej) => {
    const p = spawn("node", ["scripts/match-cases-to-master.mjs", "--report", reportPath], {
      stdio: ["ignore", "inherit", "inherit"], env: process.env,
    });
    p.on("exit", (c) => (c === 0 ? res() : rej(new Error(`exit ${c}`))));
  });
  console.error("");
}

await runMatch("RUN 1 — empty master, expect 14 NEW");
await runMatch("RUN 2 — primed master, expect 14 EXISTING (tier 1)");
