#!/usr/bin/env node
/**
 * Query loading/error-state ratchet (CR-033).
 *
 * THE FAILURE is a page that looks fine and is wrong. A component that calls
 * useQuery and never reads isError renders its layout the same way whether the
 * request succeeded, is still in flight, or failed outright — so an outage is
 * presented as an empty account, and on the pages that carry `|| mockData`
 * fallbacks it is presented as real numbers. PlatformAnalytics showed $89,000
 * MRR and a full year of invented chart data on a failed request.
 *
 * A file counts as handling its query states when it either reads `isError`
 * itself or hands its query results to the shared wrapper in
 * client/src/components/ui/query-state.tsx.
 *
 * SCOPE. Only files REACHABLE from the Vite entry are counted: an unreachable
 * page cannot show a user anything, and 39 of the files with useQuery calls are
 * orphaned (see check:orphans). Counting those would pad the number with work
 * that has no user on the other end.
 *
 * WHAT IT CANNOT SEE, stated so a pass is never read as proof:
 *   - Whether the error UI is any good, or reachable, or placed where the reader
 *     is looking. This is a presence check on a name, not a review.
 *   - A file that reads isError for one of its five queries counts as handled.
 *     The unit is the file, because that is the unit a person fixes.
 *   - Error handling that lives in a child component the page renders.
 *
 *   node scripts/check-query-states.mjs
 *   node scripts/check-query-states.mjs --update-baseline
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const clientSrc = join(repoRoot, 'client', 'src');
const ENTRY = join(clientSrc, 'main.tsx');
const BASELINE = join(repoRoot, 'docs', 'query-states-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const rel = (f) => relative(repoRoot, f).split(sep).join('/');
const isTestFile = (f) =>
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || f.split(sep).includes('__tests__');

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(clientSrc, spec.slice(2));
  else if (spec.startsWith('.')) base = join(fromFile, '..', spec);
  else return null;
  return [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ].find((c) => existsSync(c) && statSync(c).isFile());
}

function reachableFrom(entry) {
  const seen = new Set();
  const queue = [entry];
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    let src;
    try {
      src = stripComments(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const t = resolveImport(m[1], file);
      if (t && !seen.has(t)) queue.push(t);
    }
  }
  return seen;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

const live = reachableFrom(ENTRY);
const unhandled = [];

for (const file of walk(clientSrc)) {
  if (isTestFile(file) || !live.has(file)) continue;
  const src = stripComments(readFileSync(file, 'utf8'));
  if (!/\buseQuery[<(]/.test(src)) continue;
  const readsIsError = /\bisError\b/.test(src);
  const usesWrapper = /\bQueryStates?\b/.test(src);
  if (!readsIsError && !usesWrapper) unhandled.push(rel(file));
}
unhandled.sort();

const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { note: '', allowed: [] };
const allowed = new Set(baseline.allowed ?? []);
const added = unhandled.filter((f) => !allowed.has(f));
const current = new Set(unhandled);
const resolved = [...allowed].filter((f) => !current.has(f)).sort();

if (UPDATE) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        note:
          'CR-033 query-state ratchet. scripts/check-query-states.mjs fails CI when a REACHABLE ' +
          'component calls useQuery and neither reads isError nor uses the shared QueryState / ' +
          'QueryStates wrapper (client/src/components/ui/query-state.tsx). Such a component ' +
          'renders the same markup whether the request succeeded, is in flight, or failed. ' +
          'Shrink this list, never grow it: node scripts/check-query-states.mjs --update-baseline.',
        count: unhandled.length,
        allowed: unhandled,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline updated: ${unhandled.length} files without query-state handling.`);
  process.exit(0);
}

if (added.length > 0) {
  console.error(`✗ ${added.length} file(s) call useQuery with no loading/error handling:\n`);
  for (const f of added) console.error(`    ${f}`);
  console.error(
    '\n  These render identically on success, while loading, and on failure.\n' +
      '  Wrap the data in <QueryState> / <QueryStates> from @/components/ui/query-state,\n' +
      '  or read isError directly. If this is deliberate, record it with:\n' +
      '      node scripts/check-query-states.mjs --update-baseline\n',
  );
  process.exit(1);
}

console.log(`✓ No new unhandled query states (${unhandled.length} known).`);
if (resolved.length > 0) {
  console.log(
    `\n  ${resolved.length} baseline entr${resolved.length === 1 ? 'y' : 'ies'} now handled. Tighten the ratchet:\n` +
      '      node scripts/check-query-states.mjs --update-baseline\n',
  );
  for (const f of resolved.slice(0, 20)) console.log(`    ${f}`);
}
