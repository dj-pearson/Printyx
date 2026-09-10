#!/usr/bin/env node
/**
 * `toISOString().split('T')[0]` is a date in UTC, not a date where the user is.
 *
 * For a US dealer that is TOMORROW from late afternoon onward: a technician
 * submitting a meter reading at 5pm Pacific dated it into the next day, and
 * sometimes the next billing period. A payment recorded after 7pm Eastern
 * landed on the wrong day for aging and month-end close. In the other
 * direction, a task due date picked from the calendar in Europe saved as
 * YESTERDAY, because the picker hands back local midnight and toISOString walks
 * it back across the boundary.
 *
 * A date-only business value is a calendar date, not an instant. Use
 * todayLocalDate() or toDateInputValue() from @/lib/date-utils, or date-fns
 * format(d, 'yyyy-MM-dd') - which several files already did correctly, which is
 * how the wrong copies went unnoticed.
 *
 * EXPORT FILENAMES ARE EXEMPT BY RULE, not baselined: `audit-logs-2026-09-11.csv`
 * naming tomorrow is untidy and harmless, and baselining known non-defects is
 * where a real one hides.
 *
 * Hard gate at zero.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/src';
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(ROOT);

/** A download name, not a stored value. */
const FILENAME_CONTEXT = /a\.download|filename|\.csv|\.json|\.xlsx|\.pdf|`[\w-]+-\$\{/;

const findings = [];
for (const file of files) {
  const src = fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '');
    if (!/toISOString\(\)\s*\.\s*split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]/.test(line)) return;
    if (FILENAME_CONTEXT.test(line)) return;
    findings.push(`${file}:${i + 1}  ${line.trim()}`);
  });
}

if (findings.length) {
  console.error('UTC date used as a local calendar date (off by one for most of the day):\n');
  for (const f of findings) console.error('  ' + f);
  console.error(
    `\n${findings.length} finding(s). Use todayLocalDate/toDateInputValue from @/lib/date-utils.`,
  );
  process.exit(1);
}
console.log(`check:local-dates - ${files.length} files, no UTC dates standing in for local ones.`);
