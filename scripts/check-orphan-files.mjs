#!/usr/bin/env node
/**
 * Orphaned-file ratchet for the web client (AUDIT-018).
 *
 * WHY THIS EXISTS. Four separate stories have now hand-rolled the same
 * import-graph walk to answer "can a user actually reach this file?" —
 * AUDIT-014 (LIVE vs DEAD broken nav targets), AUDIT-016 (delete-vs-wire on
 * unrouted dashboards), COP-E01 (nine unrouted CRM pages), PROD-006 and
 * EDGE-020 (endpoints whose only callers are orphaned files). Each walk was
 * correct and each was thrown away, so the answer had to be re-derived from
 * scratch every time and went stale in between. AUDIT-016's own closing lesson
 * says it plainly: "a recorded deadness claim expires, and the reachability
 * walk must be re-run, not re-read."
 *
 * The cost of not having this is not theoretical. Batches 1-3 of CR-034 typed
 * five role dashboards under client/src/pages/dashboards/ and found real
 * defects in each, before anyone checked that the entire directory is imported
 * by nothing and appears in no bundle chunk.
 *
 * WHAT IT DOES. Breadth-first from the real Vite entry (client/index.html loads
 * /src/main.tsx — App.tsx is NOT the entry, it is one hop in), following every
 * static and dynamic import, and reports the .ts/.tsx files under client/src
 * that are never reached. New orphans fail. Known ones live in the baseline and
 * are expected to shrink.
 *
 * WHAT IT CANNOT SEE, stated so a pass is never read as proof:
 *   - An import whose specifier is a variable. There is no import.meta.glob and
 *     no computed import() in client/src today; if one is added, whatever it
 *     loads will be reported as an orphan and must be baselined with a comment.
 *   - Files pulled in outside the module graph (a <script> tag, a worker URL,
 *     a Vite plugin). index.html references only /src/main.tsx.
 *   - Whether a REACHED file is actually rendered. Reachability is a floor, not
 *     a claim that a page is wired to a route. A component imported by App.tsx
 *     and never placed in a <Route> passes this check — that is check:nav's job.
 *
 * TEST-ONLY FILES ARE MARKED, NOT EXCUSED. A source file imported only by a
 * test is dead product code that cannot be deleted without touching the test,
 * which is worth knowing and is a different remedy, so it is reported with a
 * (test-only) tag and still baselined.
 *
 *   node scripts/check-orphan-files.mjs
 *   node scripts/check-orphan-files.mjs --update-baseline
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const clientSrc = join(repoRoot, 'client', 'src');
const ENTRY = join(clientSrc, 'main.tsx');
const BASELINE = join(repoRoot, 'docs', 'orphan-files-baseline.json');

const UPDATE = process.argv.includes('--update-baseline');

const rel = (f) => relative(repoRoot, f).split(sep).join('/');

const isTestFile = (f) =>
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || f.split(sep).includes('__tests__');

/** Declaration files describe types for the compiler; they are never imported. */
const isDeclaration = (f) => f.endsWith('.d.ts');

/**
 * Vendored shadcn/ui primitives. `npx shadcn add` drops a whole component in
 * whether or not anything imports it yet, so an unused one is the tool working
 * as designed, not dead code someone left behind. 31 of them were unreachable
 * when this check was written. Firing on those would have made the first run a
 * wall of noise and taught everyone to skip the check, so they are out of scope
 * — deliberately, and not because they are reachable.
 */
const isVendoredPrimitive = (f) => f.split(sep).join('/').includes('client/src/components/ui/');

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Mirror Vite's resolution for the two specifier kinds this app uses. */
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(clientSrc, spec.slice(2));
  else if (spec.startsWith('.')) base = join(fromFile, '..', spec);
  else return null; // a package, or an alias that does not point into client/src
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

function reachableFrom(entries) {
  const seen = new Set();
  const queue = [...entries];
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
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(src)) !== null) {
      const target = resolveImport(m[1], file);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
  }
  return out;
}

if (!existsSync(ENTRY)) {
  console.error(`✗ Entry point not found: ${rel(ENTRY)}`);
  console.error('  client/index.html loads /src/main.tsx — if that moved, update ENTRY here.');
  process.exit(2);
}

const allFiles = walk(clientSrc);
const testFiles = allFiles.filter(isTestFile);

const liveFromApp = reachableFrom([ENTRY]);
// Everything the test suite pulls in, so a source file kept alive only by a
// test can be labelled rather than silently lumped in with the truly unused.
const liveFromTests = reachableFrom(testFiles);

const orphans = allFiles
  .filter(
    (f) => !isTestFile(f) && !isDeclaration(f) && !isVendoredPrimitive(f) && !liveFromApp.has(f),
  )
  .map((f) => ({ path: rel(f), testOnly: liveFromTests.has(f) }))
  .sort((a, b) => a.path.localeCompare(b.path));

const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { note: '', allowed: [] };
const allowed = new Set(baseline.allowed ?? []);

const added = orphans.filter((o) => !allowed.has(o.path));
const currentPaths = new Set(orphans.map((o) => o.path));
const resolved = [...allowed].filter((p) => !currentPaths.has(p)).sort();

if (UPDATE) {
  const next = {
    note:
      'AUDIT-018 orphaned-file ratchet. scripts/check-orphan-files.mjs fails CI when a .ts/.tsx ' +
      'file under client/src becomes unreachable from the Vite entry (client/src/main.tsx). ' +
      'Entries here are files no user can reach, each awaiting a delete-or-wire decision. ' +
      'Shrink this list, never grow it: node scripts/check-orphan-files.mjs --update-baseline. ' +
      'Reachable is a FLOOR, not proof a page is routed — that is check:nav. ' +
      'client/src/components/ui/ (vendored shadcn primitives) is out of scope.',
    count: orphans.length,
    allowed: orphans.map((o) => o.path),
  };
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`✓ Baseline updated: ${orphans.length} orphaned files recorded.`);
  process.exit(0);
}

if (added.length > 0) {
  console.error(`✗ ${added.length} newly orphaned file(s) under client/src:\n`);
  for (const o of added) {
    console.error(`    ${o.path}${o.testOnly ? '   (reachable from tests only)' : ''}`);
  }
  console.error(
    '\n  Nothing imports these from client/src/main.tsx, so no user can reach them and\n' +
      '  they are not in the bundle. Either wire the file up, delete it, or — if it is\n' +
      '  deliberately parked — record it with:\n' +
      '      node scripts/check-orphan-files.mjs --update-baseline\n',
  );
  process.exit(1);
}

const testOnlyCount = orphans.filter((o) => o.testOnly).length;
console.log(
  `✓ No new orphaned files — ${orphans.length} known (${testOnlyCount} reachable from tests only).`,
);
if (resolved.length > 0) {
  console.log(
    `\n  ${resolved.length} baseline entr${resolved.length === 1 ? 'y is' : 'ies are'} no longer orphaned ` +
      '(deleted, or now imported). Tighten the ratchet:\n' +
      '      node scripts/check-orphan-files.mjs --update-baseline\n',
  );
  for (const p of resolved.slice(0, 20)) console.log(`    ${p}`);
  if (resolved.length > 20) console.log(`    ... and ${resolved.length - 20} more`);
}
