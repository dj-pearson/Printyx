#!/usr/bin/env node
/**
 * Undefined and unused identifiers in the Deno edge tree (COP-B04).
 *
 * `supabase/functions/**` is ignored by eslint.config.js, whose comment says it
 * is "checked by `deno check` / check:edge-paths, not ESLint". Neither does the
 * job: there is no deno.json anywhere and no deno step in CI, and
 * check:edge-paths only checks path normalization. So across 257 edge functions
 * NOTHING has ever reported an identifier that does not exist - and Deno is
 * outside the tsc project, so that is a ReferenceError the first time the code
 * path runs, not a compile error.
 *
 * WHAT THE FIRST RUN FOUND, all of them live:
 *
 *   opportunity-radar   runScan returned `drafts`, `inserted` and `equipment`,
 *                       none of them declared. The radar detected nothing from
 *                       the day it shipped (COP-B04).
 *   webhooks            five gated write branches called requireIntegrationAdmin
 *                       declared inside an `if (!tenantId) { return ... }` block
 *                       that had never been closed - so every webhook create,
 *                       test, regenerate-secret, update and delete threw.
 *   sales-rep-assignments  the same unclosed block, same consequence on three
 *                       assignment writes.
 *   printer-monitoring  `tenantId` used 26 lines above its own declaration, in
 *                       another branch: every agent metrics submission threw
 *                       "Cannot access 'tenantId' before initialization".
 *   calendar-oauth      `admin` borrowed from a branch that returns first.
 *   manufacturer-adapters  `Buffer.from(...)` and `require('crypto')` - both
 *                       Node globals that do not exist in Deno.
 *
 * TWO RULES, TWO POSTURES. `no-undef` is a HARD GATE at zero: every finding is
 * a guaranteed runtime error, and there is no correct version of one. The
 * unused-variable half is a SHRINK-ONLY ratchet, because most of its findings
 * are harmless (an unused type import, a destructured field nobody reads) while
 * a few are the COP-B04 tell - a local computed and never read is usually a
 * body that was removed or never written. Mixing them would mean either
 * tolerating real ReferenceErrors or blocking on cosmetics, and a gate that
 * blocks on cosmetics stops being run.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'docs/edge-unused-vars-baseline.json');
const update = process.argv.includes('--update-baseline');

let raw = '';
try {
  raw = execFileSync(
    'npx',
    [
      'eslint',
      'supabase/functions',
      '--config',
      'eslint.edge.config.js',
      '--no-inline-config',
      '--format',
      'json',
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
} catch (err) {
  // ESLint exits non-zero when it reports anything; the JSON is still on stdout.
  raw = err.stdout ?? '';
  if (!raw) {
    console.error('check:edge-undef - eslint produced no output:', err.message);
    process.exit(1);
  }
}

const results = JSON.parse(raw);
// A run that linted nothing must fail rather than pass in silence.
if (results.length < 200) {
  console.error(`check:edge-undef - only ${results.length} files linted; refusing to pass.`);
  process.exit(1);
}

const undef = [];
const unused = [];
for (const file of results) {
  const rel = file.filePath.slice(root.length + 1);
  for (const m of file.messages) {
    if (m.ruleId === 'no-undef') undef.push(`${rel}:${m.line} ${m.message}`);
    else if (m.ruleId === 'no-unused-vars') unused.push(`${rel} ${m.message.split('.')[0]}`);
  }
}

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify({ count: unused.length, entries: unused.sort() }, null, 2) + '\n',
  );
  console.log(`Baseline written: ${unused.length} unused-variable finding(s).`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const known = new Set(baseline.entries);
const newUnused = unused.filter((u) => !known.has(u));

let failed = false;
if (undef.length > 0) {
  console.error(`\n✗ ${undef.length} undefined identifier(s) in the edge tree:\n`);
  for (const u of undef) console.error(`    ${u}`);
  console.error(`
  Every one of these is a ReferenceError the first time its code path runs.
  Nothing else in this repo checks for them.
`);
  failed = true;
}

if (newUnused.length > 0) {
  console.error(`\n✗ ${newUnused.length} NEW unused variable(s) in the edge tree:\n`);
  for (const u of newUnused) console.error(`    ${u}`);
  console.error(`
  Usually harmless - but a LOCAL computed and never read is how COP-B04's empty
  scan looked. Check whether a function body is missing before baselining:
      node scripts/check-edge-undef.mjs --update-baseline
`);
  failed = true;
}

if (failed) process.exit(1);
console.log(
  `check:edge-undef - ${results.length} edge files, no undefined identifiers (${unused.length} unused-variable finding(s) baselined).`,
);
