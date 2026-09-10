#!/usr/bin/env node
/**
 * SHRINK-ONLY RATCHET on local formatCurrency definitions in client/src.
 *
 * There were 53, in six different behaviours, and the differences were not
 * stylistic. Thirteen dropped cents - including the three rendering dealer
 * cost, rep cost, suggested retail and MSRP, so a copier costing $3,499.50
 * displayed as $3,500 to the rep quoting from it. Thirty-five did not coerce a
 * string, which matters because a Drizzle `decimal` column arrives from Express
 * as a string and from PostgREST as a number: the same field is both, depending
 * on which backend answered. Thirty-two had no null handling and rendered
 * "$NaN".
 *
 * The one formatter is formatCurrency in client/src/lib/utils.ts: cents by
 * default, string-coercing, and an em dash for a missing value rather than
 * $0.00, because a missing price is not a free one.
 *
 * A ratchet rather than a hard gate because the remaining copies each need
 * their call sites read - a dashboard aggregate showing whole dollars may be a
 * deliberate choice, and converting it blindly would be churn, not a fix. The
 * number may only go down.
 *
 *   node scripts/check-currency-copies.mjs
 *   node scripts/check-currency-copies.mjs --update-baseline
 */
import fs from 'node:fs';
import path from 'node:path';

const BASELINE = 'docs/currency-copies-baseline.json';
const UPDATE = process.argv.includes('--update-baseline');
const CANONICAL = 'client/src/lib/utils.ts';

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})('client/src');

const found = [];
for (const file of files) {
  if (file.split(path.sep).join('/') === CANONICAL) continue;
  const src = fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  for (const m of src.matchAll(/(?:const|function)\s+formatCurrency\b/g)) {
    // Not an import of the canonical one, and not a re-export.
    const line = src.slice(0, m.index).split('\n').length;
    found.push(`${file.split(path.sep).join('/')}:${line}`);
  }
}
found.sort();

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify({ count: found.length, sites: found }, null, 2) + '\n');
  console.log(`Baseline written: ${found.length} local formatCurrency definitions.`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
if (found.length > baseline.count) {
  const added = found.filter((f) => !baseline.sites.includes(f));
  console.error(
    `Local formatCurrency definitions rose from ${baseline.count} to ${found.length}:\n`,
  );
  for (const a of added) console.error('  ' + a);
  console.error('\nImport formatCurrency from @/lib/utils instead of writing another copy.');
  process.exit(1);
}
if (found.length < baseline.count) {
  console.log(
    `check:currency-copies - down to ${found.length} (baseline ${baseline.count}). Tighten with --update-baseline.`,
  );
  process.exit(0);
}
console.log(`check:currency-copies - holds at ${found.length} local definitions.`);
