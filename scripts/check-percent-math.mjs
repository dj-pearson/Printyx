#!/usr/bin/env node
/**
 * A percentage written inline divides by a total that a new tenant has none of
 * (PRICING-MARGIN-002). Hard gate at zero.
 *
 * `(a / b) * 100` is correct until b is zero, and b is nearly always a total,
 * a target, a limit or a previous period - things an empty pipeline, an
 * un-costed contract or a customer in their first month legitimately have none
 * of. JavaScript then yields Infinity, or NaN when both sides are zero, and
 * because these land in a template string or a bar width what ships is
 * "Infinity% of target" or a bar a thousand screens wide. Nothing throws and
 * nothing logs, so it is only ever seen by whoever the empty tenant is.
 *
 * THE FIX IS percentOf / percentOfOr / formatPercent in client/src/lib/utils.ts,
 * and the split between the first two is the judgement this guard cannot make
 * for you: percentOf returns null for a text slot, because 0% of target is a
 * specific and quite bad claim to make about a tenant who has set no target
 * (AUDIT-028); percentOfOr returns a clamped number for BAR GEOMETRY, where an
 * empty bar asserts nothing because no figure is printed.
 *
 * EXCLUDED BY RULE, not baselined:
 *   - a numeric literal divisor - `(score / 5) * 100` cannot be zero;
 *   - a `.length` divisor, which is a rendered list and is guarded by the fact
 *     that the loop producing it did not run;
 *   - anything inside client/src/lib/utils.ts, which is the implementation.
 * A baseline holding known-safe entries is where a real one hides, which is why
 * there is no baseline file here at all.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/src';
const IMPL = 'client/src/lib/utils.ts';

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(entry.name)) files.push(p);
  }
})(ROOT);

// Blanked in place: a comment explaining a fix quotes the expression it
// replaced, and deleting the comment would shift every line below it.
const stripComments = (s) =>
  s
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, (m, p1) => p1 + ' '.repeat(m.length - p1.length)))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const DIVISION = /\/\s*([A-Za-z_$][\w$.?[\]]*)\s*\)\s*\*\s*100/g;

const findings = [];
for (const file of files) {
  if (file === IMPL) continue;
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  const lines = src.split('\n');
  for (const m of src.matchAll(DIVISION)) {
    const divisor = m[1];
    if (/\.length$/.test(divisor)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    findings.push({ file, line, divisor, text: lines[line - 1].trim().slice(0, 100) });
  }
}

if (findings.length) {
  console.error(`\n${findings.length} inline percentage division(s) by business data:\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  / ${f.divisor}\n      ${f.text}`);
  console.error(`
  Use percentOf(part, whole) for a value a reader sees - it returns null when
  the divisor is zero, and formatPercent renders that as an em dash. Use
  percentOfOr(part, whole) for a bar width or a Progress value, where an empty
  bar is the honest rendering of a ratio with no denominator.
`);
  process.exit(1);
}

console.log(
  `check:percent-math - ${files.length} files, no inline percentage divisions ` +
    `(literal and .length divisors excluded by rule).`,
);
