#!/usr/bin/env node
/**
 * check-unwrapped-response.mjs — PROD-008 hard gate.
 *
 * Flags an API response mapped over directly: `(response || []).map(...)`.
 *
 * `|| []` looks like it makes this safe. It does not - it only guards null and
 * undefined. Every list endpoint on the edge side returns an ENVELOPE
 * (`{ data, total, page, limit }`), and `.map` on an object is a TypeError, so
 * the page white-screens on load. It survives review because dev is fine: the
 * Express handler these domains still carry returns a bare array, so the crash
 * only happens in production.
 *
 * Three pages were found this way in three consecutive rounds - JournalEntries,
 * contracts + MeterReadings, Leases - before the pattern was swept: ten of the
 * seventeen call sites were against a confirmed envelope.
 *
 * The fix is always extractRecords(response) from @/lib/queryClient, which
 * accepts an array, `{ data }` or `{ records }` and returns [] for anything
 * else. It never throws, so it is safe even where the endpoint's shape is
 * unknown.
 *
 * This is a HARD GATE, not a ratchet: the count is zero and there is no case
 * where the raw form is correct.
 *
 * Usage: node scripts/check-unwrapped-response.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');

// Comments are stripped first. A comment that QUOTES the pattern - and the ones
// explaining these very fixes do - otherwise reports as a finding. Line count is
// preserved so reported lines still point at the real source.
function stripComments(src) {
  return src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

// `(response || []).map`, `(res ?? []).map`, and the bare `response.map` on a
// name that came straight off an await.
const PATTERNS = [
  /\(\s*(\w*[Rr]es(?:ponse)?\w*)\s*(?:\|\||\?\?)\s*\[\]\s*\)\s*\.map\s*\(/g,
  /\bawait\s+apiRequest\([^)]*\)\s*\)?\s*\.map\s*\(/g,
];

const findings = [];
for (const file of walk(join(repo, 'client', 'src'))) {
  if (/\.(test|spec)\./.test(file)) continue;
  const src = stripComments(readFileSync(file, 'utf8'));
  for (const re of PATTERNS) {
    for (const m of src.matchAll(re)) {
      findings.push({
        file: relative(repo, file).replace(/\\/g, '/'),
        line: src.slice(0, m.index).split('\n').length,
        snippet: m[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }
}
findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

if (findings.length > 0) {
  console.error(`✗ ${findings.length} API response(s) mapped without unwrapping:\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.snippet}`);
  console.error(
    '\n`|| []` only guards null and undefined. Every edge list endpoint returns\n' +
      '{ data, total, page, limit }, and .map on an object is a TypeError - the page\n' +
      'white-screens in production while dev, still served by Express, looks fine.\n' +
      'Use extractRecords(response) from @/lib/queryClient.',
  );
  process.exit(1);
}

console.log('✓ No API responses mapped without unwrapping.');
