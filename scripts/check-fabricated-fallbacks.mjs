#!/usr/bin/env node
/**
 * Fabricated-fallback guard (AUDIT-019 / CR-033).
 *
 * THE SHAPE: a read off query data OR'd with a plausible-looking literal.
 *
 *     value={formatCurrency(revenueMetrics?.mrr || 89000)}
 *     const revenueData = growthTrends?.revenueData || [{ month: 'Jan', mrr: 45000, … }]
 *     select: (data) => data || { leadToQualifiedRate: 65, … }
 *
 * When the request fails or returns nothing, the page does not go blank and does
 * not show an error — it shows those numbers, indistinguishable from measurement.
 * PlatformAnalytics presented a $89,000 MRR, 14.1% growth, 347 active tenants and
 * a full year of invented chart data this way; PlatformCohortAnalysis built three
 * whole cohort studies from sample rows.
 *
 * This is a DIFFERENT failure from the one check:no-mocks catches. That guard
 * looks for mock IDENTIFIERS and catch-blocks returning invented data, and it is
 * scoped to CRM/sales. Neither rule sees an inline `|| 89000`.
 *
 * THE RULE, and the part that makes it trustworthy: a fallback is only flagged
 * when it looks like DATA rather than like EMPTINESS.
 *   - Numbers: flagged above 1. `|| 0` and `|| 1` are honest "nothing yet".
 *   - Objects and arrays: flagged only when POPULATED — a literal containing a
 *     non-zero number or a non-empty string. ArticleRatingWidget falls back to
 *     { average: 0, total: 0, distribution: {5:0,…} }, which is an honest empty
 *     shape, and is deliberately NOT reported.
 *   - Strings are never flagged. `status || 'text'`, `err?.message || 'An error
 *     occurred'` and `sortConfig?.field || 'createdAt'` are ordinary defaults,
 *     and nothing in the source separates them from a fabricated `|| 'healthy'`.
 *     An earlier draft flagged strings and produced 149 findings that were almost
 *     all legitimate, which would have made the guard worthless.
 *
 * SCOPE: only reads whose base identifier is provably assigned from a useQuery in
 * the same file. That is what keeps form defaults and config constants out.
 *
 * WHAT IT CANNOT SEE, stated so a pass is never read as proof:
 *   - A fabricated STRING (see above). AdminHub's `stats?.systemHealth ||
 *     'healthy'` was real and this guard would not have caught it.
 *   - A page built entirely from literals with no query at all — that is
 *     AUDIT-019's SystemSecurity, and it needs a different check.
 *   - Fixtures assigned to a variable first, then used as the fallback.
 *   - Query data passed through a helper before the fallback is applied.
 *
 *   node scripts/check-fabricated-fallbacks.mjs
 *   node scripts/check-fabricated-fallbacks.mjs --update-baseline
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const clientSrc = join(repoRoot, 'client', 'src');
const BASELINE = join(repoRoot, 'docs', 'fabricated-fallbacks-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const rel = (f) => relative(repoRoot, f).split(sep).join('/');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Identifiers in this file that provably hold query data.
 *
 * Three assignment shapes, and the third is resolved rather than name-matched:
 * an earlier version looked for `const x = <something>Query.data` by NAMING
 * CONVENTION, so a query held in `const q = useQuery(...)` and read as `q.data`
 * was invisible and every fallback under it went unchecked. The result set is
 * built from the useQuery holders first, then `.data` reads off those holders.
 */
function queryBackedNames(code) {
  const names = new Set();
  const holders = new Set();

  for (const m of code.matchAll(/const\s*\{[^}]*\bdata\s*:\s*(\w+)[^}]*\}\s*=\s*useQuery/g)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/const\s+(\w+)\s*=\s*useQuery/g)) {
    names.add(m[1]);
    holders.add(m[1]);
  }
  for (const m of code.matchAll(/const\s+(\w+)\s*=\s*(\w+)\.data\b/g)) {
    if (holders.has(m[2])) names.add(m[1]);
  }
  return names;
}

/** Balanced literal starting at `open`, capped so a runaway never scans the file. */
function literalAt(code, open, cap = 4000) {
  let depth = 0;
  for (let i = open; i < Math.min(code.length, open + cap); i++) {
    const c = code[i];
    if (c === '[' || c === '{') depth += 1;
    else if (c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  return null;
}

/** Populated = holds a non-zero number or a non-empty string. See THE RULE above. */
function isPopulated(literal) {
  if (!literal) return false;
  const body = literal.slice(1, -1);
  if (!body.trim()) return false;
  if (/:\s*-?(?!0(\.0+)?\b)\d[\d_.]*/.test(body)) return true;
  if (/:\s*['"`][^'"`]+['"`]/.test(body)) return true;
  if (/^\s*['"`][^'"`]+['"`]\s*(,|$)/m.test(body)) return true;
  if (/^\s*-?(?!0\b)\d[\d_.]*\s*(,|$)/m.test(body)) return true;
  return false;
}

const lineOf = (code, index) => code.slice(0, index).split('\n').length;

const findings = [];
for (const file of walk(clientSrc)) {
  const code = stripComments(readFileSync(file, 'utf8'));
  if (!code.includes('useQuery')) continue;
  const path = rel(file);
  const backed = queryBackedNames(code);

  if (backed.size > 0) {
    for (const m of code.matchAll(/(\w+)((?:\?\.\w+)+)\s*(?:\|\||\?\?)\s*/g)) {
      if (!backed.has(m[1])) continue;
      const at = m.index + m[0].length;
      const rest = code.slice(at);
      const scalar = rest
        .split(/[;,\n]/)[0]
        .trim()
        .replace(/[)\]}]+$/, '');
      let kind = null;
      if (/^-?\d[\d_.]*$/.test(scalar) && Math.abs(parseFloat(scalar)) > 1) kind = 'number';
      else if ((rest[0] === '[' || rest[0] === '{') && isPopulated(literalAt(code, at)))
        kind = 'collection';
      if (kind) {
        findings.push({ id: `${path}:${m[1]}${m[2]}`, path, line: lineOf(code, m.index), kind });
      }
    }
  }

  // Fixtures injected through `select`, which only runs on SUCCESS — so these
  // present invented numbers for an empty response and vanish on a real error.
  for (const m of code.matchAll(/select\s*:\s*\([^)]*\)\s*=>\s*(\w+)\s*(?:\|\||\?\?)\s*/g)) {
    const at = m.index + m[0].length;
    if (code[at] !== '[' && code[at] !== '{') continue;
    if (!isPopulated(literalAt(code, at))) continue;
    const line = lineOf(code, m.index);
    findings.push({ id: `${path}:select@${line}`, path, line, kind: 'select-fixture' });
  }
}
findings.sort((a, b) => a.id.localeCompare(b.id) || a.line - b.line);

const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { note: '', allowed: [] };
const allowed = new Set(baseline.allowed ?? []);
const added = findings.filter((f) => !allowed.has(f.id));
const present = new Set(findings.map((f) => f.id));
const resolved = [...allowed].filter((id) => !present.has(id)).sort();

if (UPDATE) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        note:
          'AUDIT-019 fabricated-fallback ratchet. scripts/check-fabricated-fallbacks.mjs fails CI ' +
          'when a read off useQuery data falls back to a literal that looks like DATA rather than ' +
          'like emptiness — a number above 1, or a populated object/array. Those render as ' +
          'measurements when the request failed or returned nothing. Honest empty defaults (|| 0, ' +
          '|| [], an all-zero shape) are not reported, and strings are never reported. Shrink this ' +
          'list, never grow it: node scripts/check-fabricated-fallbacks.mjs --update-baseline.',
        count: findings.length,
        allowed: findings.map((f) => f.id),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline updated: ${findings.length} fabricated fallbacks recorded.`);
  process.exit(0);
}

if (added.length > 0) {
  console.error(`✗ ${added.length} new fabricated fallback(s):\n`);
  for (const f of added) console.error(`    ${f.path}:${f.line}  [${f.kind}]  ${f.id}`);
  console.error(
    '\n  When the request fails or comes back empty, this renders a plausible number\n' +
      '  instead of an error or an empty state, and nothing on screen says which.\n' +
      '  Fall back to an empty value and show the state (see @/components/ui/query-state),\n' +
      '  or record a deliberate default with:\n' +
      '      node scripts/check-fabricated-fallbacks.mjs --update-baseline\n',
  );
  process.exit(1);
}

console.log(`✓ No new fabricated fallbacks (${findings.length} known).`);
if (resolved.length > 0) {
  console.log(
    `\n  ${resolved.length} baseline entr${resolved.length === 1 ? 'y is' : 'ies are'} gone. Tighten the ratchet:\n` +
      '      node scripts/check-fabricated-fallbacks.mjs --update-baseline\n',
  );
  for (const id of resolved.slice(0, 20)) console.log(`    ${id}`);
}
