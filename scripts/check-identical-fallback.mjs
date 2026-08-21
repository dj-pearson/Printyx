#!/usr/bin/env node
/**
 * check-identical-fallback.mjs — AUDIT-011 ratchet.
 *
 * Flags `x.a || x.a` and `x.a ?? x.a`: a fallback whose two sides are the same
 * expression. It can never fall back to anything, so it is either dead weight or,
 * far more often here, a typo for a key that is now never read.
 *
 * This is not a style nit. These sit inside the dual-casing normalizers that
 * bridge snake_case PostgREST rows to camelCase page code, where the intended
 * shape is `row.snake_case || row.camelCase`. When both sides say camelCase, the
 * snake_case column - the one production actually returns - is never read, and
 * the field renders blank. AUDIT-011 found five of them in Invoices.tsx and the
 * symptom was blank invoice numbers, $NaN totals and "Invalid Date" against real
 * data. That was fixed in one file; nothing stopped the pattern spreading.
 *
 * Usage:
 *   node scripts/check-identical-fallback.mjs                  # check (CI)
 *   node scripts/check-identical-fallback.mjs --update-baseline
 *   node scripts/check-identical-fallback.mjs --list
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const baselinePath = join(repo, 'docs', 'identical-fallback-baseline.json');
const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

const ROOTS = ['client/src', 'server', 'supabase/functions', 'shared'];

// Preserves line count so reported lines point at the real source; see
// check-nav-targets.mjs for the three bugs that live in getting this wrong
// (`\s` matching newlines, CRLF vs `.`, and deletion shifting later findings).
function stripComments(src) {
  return src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

// A property chain: an identifier followed by one or more .prop or ['prop']
// steps. Optional chaining is included because `a?.b || a?.b` is the same bug.
const CHAIN = String.raw`[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*|\[['"][^'"\]]+['"]\])+`;
//
// Two lookarounds carry real weight, and the second was learned by breaking
// working code with the first version of this check:
//
//   (?<![!\w$.])  - `!x.a || x.a === 'y'` is a legitimate and common guard
//                   ("unset, or set to this"). The bare chains either side of
//                   the || ARE identical, so without excluding a leading `!`
//                   the check reports it - and a sweep that "fixes" it changes
//                   behaviour. Same for a leading . or word char, which would
//                   mean the match started mid-chain.
//   (?!...)       - the right operand must END the expression. `x.a || x.a === 'y'`
//                   and `x.a || x.a.b` are not fallbacks to the same value.
const IDENTICAL = new RegExp(
  String.raw`(?<![!\w$.])(${CHAIN})\s*(\|\||\?\?)\s*(${CHAIN})(?![\w$.\[]|\s*(?:[=!<>]=|[<>]|\())`,
  'g',
);

/** `a?.b` and `a['b']` normalize to `a.b` so the two sides compare on meaning. */
function normalize(chain) {
  return chain.replace(/\?\./g, '.').replace(/\[['"]([^'"\]]+)['"]\]/g, '.$1');
}

const findings = [];
for (const root of ROOTS) {
  for (const file of walk(join(repo, root))) {
    if (/\.(test|spec)\./.test(file)) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(IDENTICAL)) {
      if (normalize(m[1]) !== normalize(m[3])) continue;
      findings.push({
        file: relative(repo, file).replace(/\\/g, '/'),
        line: src.slice(0, m.index).split('\n').length,
        expr: `${m[1]} ${m[2]} ${m[3]}`,
      });
    }
  }
}
findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

// Keyed on file + expression, not line: reformatting a file must not look like
// a new finding, and must not silently retire an old one either.
const key = (f) => `${f.file}:${f.expr}`;

if (list) {
  for (const f of findings) console.log(`  ${f.file}:${f.line}  ${f.expr}`);
  console.log(`\n${findings.length} identical fallback(s).`);
  process.exit(0);
}

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'AUDIT-011: `x.a || x.a` fallbacks that cannot fall back. Each is either dead ' +
          'weight or a typo for a key that is now never read. This list only shrinks - ' +
          'fix one and tighten, never add.',
        allowed: [...new Set(findings.map(key))],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${findings.length} identical fallback(s) recorded.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${relative(repo, baselinePath)}. Run with --update-baseline first.`);
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).allowed);
const novel = findings.filter((f) => !allowed.has(key(f)));

if (novel.length > 0) {
  console.error(`✗ ${novel.length} NEW identical fallback(s):\n`);
  for (const f of novel) console.error(`  ${f.file}:${f.line}  ${f.expr}`);
  console.error(
    '\nBoth sides of this fallback are the same expression, so it can never fall back.\n' +
      'In a dual-casing normalizer the intended shape is `row.snake_case || row.camelCase`;\n' +
      'as written, the column production returns is never read and the field renders blank.',
  );
  process.exit(1);
}

const fixed = [...allowed].filter((a) => !findings.some((f) => key(f) === a));
if (fixed.length > 0) {
  console.log(`✓ No new identical fallbacks. ${fixed.length} baselined entr(ies) now resolve:`);
  for (const f of fixed.slice(0, 10)) console.log(`    ${f}`);
  if (fixed.length > 10) console.log(`    …and ${fixed.length - 10} more`);
  console.log('  Tighten with: node scripts/check-identical-fallback.mjs --update-baseline');
} else {
  console.log(`✓ No new identical fallbacks (${allowed.size} known).`);
}
