#!/usr/bin/env node
/**
 * REPORT, not a gate. Every loop in the edge tree containing an awaited
 * PostgREST call - the "one query per row" shape.
 *
 * It is a reading list, not a defect list. Many hits are legitimate: explicit
 * pagination loops (`for (let offset = 0; ; offset += 1000)`), insert batching
 * (`for (const batch of chunk(rows, 500))`), and retry loops. The ones that
 * matter iterate over TENANT DATA, where the row count is the customer's
 * business rather than a constant.
 *
 * It found predictive-failure, which ran two queries per active machine: a
 * dealer with 800 machines made 1,600 sequential round trips in a single
 * invocation, so the endpoint timed out for precisely the customers the feature
 * exists for. It passed testing because a seeded tenant has a dozen machines.
 *
 * The fix shape is in supabase/functions/_shared/batch-fetch.ts - chunked
 * `.in()` reads, explicit paging past PostgREST's silent 1000-row cap, and
 * grouping in memory.
 *
 * PERF-NPLUS1-002 TAUGHT IT THE DIFFERENCE. The first version reported 99
 * serial loops, and most of them must not be "fixed": a pagination loop, a
 * chunked insert and a retry loop all have exactly the shape it matches. A
 * reading list where two thirds of the entries are correct code is a list
 * nobody reads, which is the same failure a baseline full of non-defects has.
 *
 * So each hit is now CLASSIFIED from the loop header and body:
 *
 *   paging    `for (let offset = 0; ; offset += 1000)`, or a body that calls
 *             fetchAllRows / .range(. Bounded by the result set by design, and
 *             the queries are the point rather than an accident.
 *   batching   `for (const batch of chunk(rows, 500))` or an index step of more
 *             than one. One query per BATCH is the fix for N+1, not an instance
 *             of it.
 *   retry      a loop over attempts.
 *   bounded    the iterable is a literal array or a constant - the count cannot
 *              grow with a customer's business.
 *   unreachable the loop is in an edge function listed in
 *              docs/unreferenced-edge-fns-baseline.json, so it does not scale
 *              with tenant data because it does not run at all. Reading the
 *              baseline is a RULE, not a second baseline: the day something
 *              calls that function the loop reappears as a candidate, which is
 *              exactly when it starts to matter. Converting one now would be
 *              careful work on code nothing runs (PROD-011), and the owning
 *              story is AUDIT-025 / AUDIT-024, not this one.
 *   TENANT     everything else: the row count is the customer's business, and
 *              these are the ones that pass every test and fail in production,
 *              because a seeded tenant is small.
 *
 * Only TENANT rows are candidates. The rest are counted and printed as a
 * summary so the classification stays visible - a rule that silently drops
 * two-thirds of the findings is indistinguishable from a rule that is broken.
 *
 * Limits, and they are why this is a report rather than a gate: the loop body is
 * read by indentation for 45 lines, so a longer body or an unusually formatted
 * one is missed; a query behind a helper function call is invisible; and the
 * classifier reads the loop HEADER, so a paging loop written unusually lands in
 * TENANT and wants reading rather than converting. A clean line here is not
 * proof.
 *
 * Usage: node scripts/report-nplus1-loops.mjs [--all]
 */
import fs from 'fs';
import path from 'path';
import { classify } from './lib/nplus1-classify.mjs';

/**
 * Functions no client tree, proxy alias, server.ts mapping or cron job can
 * reach. A loop inside one of them cannot scale with a customer's business
 * because no customer can trigger it.
 */
const unreachable = new Set(
  JSON.parse(fs.readFileSync('docs/unreferenced-edge-fns-baseline.json', 'utf8')).unreferenced ??
    [],
);
const fnOf = (file) => file.split(path.sep).slice(2, 3)[0] ?? '';

const files = [];
(function w(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) w(p);
    else if (e.name.endsWith('.ts')) files.push(p);
  }
})('supabase/functions');
const out = [];
for (const f of files) {
  const src = fs
    .readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = src.split('\n').map((l) => l.replace(/\/\/.*$/, ''));
  lines.forEach((l, i) => {
    if (!/\b(for|while)\s*\(|\.map\(\s*async|\.forEach\(\s*async/.test(l)) return;
    // scan the next 40 lines for an await on a db call, stopping at a dedent
    const indent = l.search(/\S/);
    const body = [];
    for (let k = i + 1; k < Math.min(lines.length, i + 45); k++) {
      const cur = lines[k];
      if (cur.trim() && cur.search(/\S/) <= indent) break;
      body.push(cur);
    }
    const b = body.join('\n');
    const m = b.match(
      /await\s+(?:admin|db|supabase|client)[\s\S]{0,60}?\.from\(\s*['"]([a-z0-9_]+)['"]/,
    );
    if (!m) return;
    // Promise.all wrapping means it's parallel, still N queries but not serial
    const parallel = /Promise\.all/.test(l) || /Promise\.all/.test(lines[Math.max(0, i - 1)]);
    out.push({
      f,
      line: i + 1,
      table: m[1],
      parallel,
      head: l.trim().slice(0, 80),
      // Shape first, reachability second: a paging loop in an unreachable
      // function is still a paging loop, and collapsing the two would hide how
      // many of the deliberate shapes the rule actually recognises.
      kind:
        classify(l, b) === 'TENANT' && unreachable.has(fnOf(f)) ? 'unreachable' : classify(l, b),
    });
  });
}

const candidates = out.filter((o) => !o.parallel && o.kind === 'TENANT');
const showAll = process.argv.includes('--all');
for (const o of showAll ? out.filter((o) => !o.parallel) : candidates) {
  console.log(`${o.f}:${o.line}  -> ${o.table}${showAll ? `  [${o.kind}]` : ''}\n      ${o.head}`);
}

const counts = {};
for (const o of out.filter((o) => !o.parallel)) counts[o.kind] = (counts[o.kind] || 0) + 1;
const deliberate = Object.entries(counts)
  .filter(([k]) => k !== 'TENANT')
  .map(([k, v]) => `${v} ${k}`)
  .join(', ');
console.log(
  `\nloops over tenant rows (candidates): ${candidates.length}` +
    `\ndeliberate by shape, not reported: ${deliberate || 'none'}` +
    `\nalready parallel: ${out.filter((o) => o.parallel).length}` +
    (showAll ? '' : `\n\nRun with --all to see every serial loop and its classification.`),
);
