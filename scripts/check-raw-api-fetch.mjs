#!/usr/bin/env node
// Raw-fetch ratchet (PROD-013).
//
// A bare `fetch('/api/...')` in client code is broken in PRODUCTION in two
// independent ways, and works fine in dev, so it never shows up in local
// testing:
//
//   1. It never passes through getApiUrl (client/src/lib/config.ts). In
//      production that helper rewrites /api/x to the edge-function host; a
//      relative path instead hits whatever origin serves the static bundle, so
//      the request goes nowhere near the API.
//   2. `credentials: 'include'` sends cookies only. Edge functions authenticate
//      with a Bearer JWT, so even a correctly-addressed call 401s.
//
// The fix is apiRequest() from lib/queryClient (JSON) or a helper modelled on
// lib/invoice-pdf.ts (binary/blob downloads), both of which attach the base URL
// and the token.
//
// Like check-nav-targets.mjs this splits LIVE (file reachable from App.tsx, a
// user can actually trigger it) from DEAD (orphaned file), and only LIVE call
// sites gate CI. Shrink the baseline, never grow it:
//   node scripts/check-raw-api-fetch.mjs --update-baseline

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const appTsx = join(repo, 'client', 'src', 'App.tsx');
const clientSrc = join(repo, 'client', 'src');
const baselinePath = join(repo, 'docs', 'raw-api-fetch-baseline.json');

const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

// Shared with check-nav-targets.mjs: strip comments while PRESERVING LINE COUNT
// so reported line numbers still point at the real source.
function stripComments(src) {
  return src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(clientSrc, spec.slice(2));
  else if (spec.startsWith('.')) base = join(fromFile, '..', spec);
  else return null;
  const tries = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ];
  return tries.find((t) => existsSync(t) && statSync(t).isFile()) ?? null;
}

function reachableFrom(entry) {
  const seen = new Set();
  const queue = [entry];
  const re = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
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
    let m;
    while ((m = re.exec(src)) !== null) {
      const target = resolveImport(m[1], file);
      if (target && !seen.has(target)) queue.push(target);
    }
    re.lastIndex = 0;
  }
  return seen;
}

// A call site is only a finding when the URL argument is a RELATIVE /api literal.
// `fetch(getApiUrl('/api/x'))` and `fetch(url)` are fine and must not report —
// the opening quote has to follow `fetch(` with nothing but whitespace between.
const CALL_RE = /\bfetch\(\s*(['"`])(\/api\/[^'"`\n]*)\1/g;

const live = reachableFrom(appTsx);
const findings = [];

for (const file of walk(clientSrc)) {
  const src = stripComments(readFileSync(file, 'utf8'));
  let m;
  while ((m = CALL_RE.exec(src)) !== null) {
    const rel = file.slice(repo.length + 1).replace(/\\/g, '/');
    findings.push({
      file: rel,
      line: src.slice(0, m.index).split('\n').length,
      url: m[2].replace(/\$\{[^}]*\}/g, '__DYN__'),
      live: live.has(file),
    });
  }
  CALL_RE.lastIndex = 0;
}

const liveFindings = findings.filter((f) => f.live);
const deadFindings = findings.filter((f) => !f.live);
const key = (f) => `${f.file}:${f.url}`;

if (list) {
  console.log(`LIVE — reachable from App.tsx, these break in production (${liveFindings.length}):`);
  for (const f of liveFindings) console.log(`  ${f.file}:${f.line}  ${f.url}`);
  console.log(`\nDEAD — file not reachable from App.tsx (${deadFindings.length}):`);
  for (const f of deadFindings) console.log(`  ${f.file}:${f.line}  ${f.url}`);
  process.exit(0);
}

/**
 * The hand-written note and the per-entry reasons survive a tighten.
 *
 * Round 82 records a writer regenerating its default note and silently
 * discarding the paragraph that stopped a reader misreading the count. This
 * baseline now carries BOTH a note and a `reasons` map, and both are what make
 * it a worklist rather than a tally, so both are read back.
 */
function existingBaselineNote() {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8')).note ?? null;
  } catch {
    return null;
  }
}

function existingReasons() {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8')).reasons ?? {};
  } catch {
    return {};
  }
}

if (update) {
  const allowed = [...new Set(liveFindings.map(key))].sort();
  const keptReasons = Object.fromEntries(
    Object.entries(existingReasons()).filter(([k]) => allowed.includes(k)),
  );
  const existingNote = existingBaselineNote();
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        note:
          existingNote ??
          'PROD-013 raw-fetch ratchet. scripts/check-raw-api-fetch.mjs fails CI when a NEW bare fetch("/api/...") is added to a file reachable from App.tsx. Such a call skips getApiUrl (so it hits the static origin in production, not the edge function) and sends cookies instead of a Bearer JWT. Use apiRequest() from lib/queryClient, or a helper modelled on lib/invoice-pdf.ts for blob downloads. Shrink this list, never grow it: node scripts/check-raw-api-fetch.mjs --update-baseline',
        allowed,
        reasons: keptReasons,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline updated: ${allowed.length} known raw fetch call site(s) recorded.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`✗ Missing baseline ${baselinePath}. Create it with --update-baseline.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const allowed = new Set(baseline.allowed);

// EVERY BASELINED ENTRY SAYS WHY IT IS STILL HERE. A flat list reads the same
// whether a call site was examined and found unportable or whether nobody
// looked - which is what let nine broken call sites sit here being quoted as
// harmless. A reason under 40 characters is not one.
const unreasoned = [...allowed].filter((k) => ((baseline.reasons ?? {})[k] ?? '').length < 40);
if (unreasoned.length > 0) {
  console.error(`✗ ${unreasoned.length} baselined raw fetch(es) with no reason:`);
  for (const k of unreasoned) console.error(`    ${k}`);
  console.error(
    '  Add an entry to `reasons` in docs/raw-api-fetch-baseline.json saying what the host\n' +
      '  production sends it to would answer, so the list stays a worklist.',
  );
  process.exit(1);
}

const added = liveFindings.filter((f) => !allowed.has(key(f)));
const seenNow = new Set(liveFindings.map(key));
const resolved = [...allowed].filter((k) => !seenNow.has(k));

if (added.length > 0) {
  console.error(
    `✗ ${added.length} NEW raw fetch("/api/...") call site(s) — these 404 or 401 in production:`,
  );
  for (const f of added) console.error(`    ${f.file}:${f.line}  ${f.url}`);
  console.error(
    '  Use apiRequest() from lib/queryClient, or a blob helper like lib/invoice-pdf.ts.',
  );
  process.exit(1);
}

if (resolved.length > 0) {
  console.log(`✓ No new raw fetch call sites. ${resolved.length} baselined site(s) now resolve:`);
  for (const k of resolved) console.log(`    ${k}`);
  console.log('  Tighten with: node scripts/check-raw-api-fetch.mjs --update-baseline');
} else {
  // THE OLD WORDING WAS "(N baselined, M on unreachable files)" AND IT READ AS
  // ONE FACT (round 128). The baseline holds LIVE findings only - `allowed` is
  // built from liveFindings above - so the two numbers describe disjoint sets,
  // and when both happened to be 9 the line read as "the nine baselined ones
  // are the nine unreachable ones". CLAUDE.md quoted it exactly that way:
  // "all of them now on unreachable files - no reachable page makes one",
  // about nine raw fetches on ROUTED pages, each one broken in production.
  // Say what each number is.
  console.log(
    `✓ No new raw fetch call sites. ${allowed.size} baselined, and every one is on a page ` +
      `reachable from App.tsx - they break in production until converted. ` +
      `(${deadFindings.length} more sit on files nothing imports and are not baselined.)`,
  );
}
