/**
 * DATE-SETMONTH-001. Bans the `d.setMonth(d.getMonth() +/- n)` idiom.
 *
 * Date.setMonth OVERFLOWS rather than clamping. Asking a 31 March date for month
 * index 2 gives "31 February", which JavaScript resolves to 3 March. So every use
 * of this idiom is wrong on the 29th, 30th and 31st - about four days in twelve
 * of every year - and silently right the rest of the time, which is exactly why
 * none of it was ever reported.
 *
 * What it cost before this guard existed:
 *   - financial/: `period=month` returned a window starting INSIDE the current
 *     month, so the month being reported on was excluded. Five endpoints shared
 *     that one calculation.
 *   - financial/: the MRR series skipped February; the six-month forecast put two
 *     points in May and none in April.
 *   - contract-renewal/: a one-month term starting 31 March ended on 1 May.
 *   - maintenance/: a monthly service completed on 31 January was rescheduled for
 *     3 March, skipping a service entirely.
 *
 * Use supabase/functions/_shared/date-months.ts instead: subtractMonths and
 * addMonths clamp the day, monthsBetween enumerates months without skipping, and
 * termEndDate gives the last day of a term rather than the first day of the next.
 *
 * setDate and setFullYear are NOT flagged: setDate is the documented way to add
 * days and rolls correctly, and setFullYear is only wrong on a leap day, which is
 * a narrower case than this guard's signal can distinguish without noise.
 *
 * SHRINK-ONLY RATCHET. Twenty-six call sites remain and each is a real defect, not
 * a false positive - they are a TODO list (DATE-SETMONTH-001), not settled debt.
 * Several are money: automated-billing-service computes the next billing date this
 * way, leases builds a payment schedule, reports/handlers/scheduled picks the next
 * run. Fix them and tighten:
 *
 *   node scripts/check-month-arithmetic.mjs --update-baseline
 *
 * Run: node scripts/check-month-arithmetic.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['server', 'supabase/functions', 'client/src'];
// The helper module is the sanctioned implementation; the tests demonstrate the
// defect on purpose and must keep the idiom to do so. Exempting them by NAME
// rather than by a `tests/` glob is deliberate - a real offence in a test helper
// should still be reported, and a blanket exemption is how one hides.
const EXEMPT = new Set([
  'supabase/functions/_shared/date-months.ts',
  'server/tests/unit/financial-period-months.test.ts',
  'server/tests/unit/contract-and-maintenance-dates.test.ts',
  'server/tests/unit/lease-schedule-months.test.ts',
  'scripts/check-month-arithmetic.mjs',
]);

const IDIOM = /\.setMonth\(\s*[\w.$]*\.getMonth\(\)\s*[-+]/;

const files = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!/node_modules|dist|build/.test(p)) walk(p);
      } else if (/\.(ts|tsx|mjs|js)$/.test(p)) {
        files.push(p);
      }
    }
  })(root);
}

const offenders = [];
for (const file of files) {
  if (EXEMPT.has(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Strip the line comment first: the notes explaining these fixes quote the
    // idiom verbatim, and a guard that reads its own explanation reports it.
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    if (IDIOM.test(code)) offenders.push({ file, line: i + 1, code: line.trim() });
  });
}

const BASELINE_PATH = 'docs/month-arithmetic-baseline.json';
// Keyed by file plus the code, not by line number, so unrelated edits above a
// known site do not churn the baseline or read as a new offence.
const keyOf = (o) => `${o.file}::${o.code}`;

if (process.argv.includes('--update-baseline')) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note:
          'DATE-SETMONTH-001 ratchet. Each entry is a real defect on the 29th, 30th and 31st ' +
          'of a month - a TODO list, not settled debt. Shrink this, never grow it. See ' +
          'scripts/check-month-arithmetic.mjs.',
        total: offenders.length,
        allowed: offenders.map(keyOf).sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${offenders.length} known site(s).`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE_PATH)
  ? new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).allowed ?? [])
  : new Set();

const added = offenders.filter((o) => !baseline.has(keyOf(o)));
const fixed = [...baseline].filter((k) => !offenders.some((o) => keyOf(o) === k));

if (added.length > 0) {
  console.error(`\n✗ ${added.length} NEW use(s) of the overflowing setMonth idiom:\n`);
  added.forEach((o) => console.error(`    ${o.file}:${o.line}  ${o.code.slice(0, 90)}`));
  console.error(`
  Date.setMonth overflows: 31 March minus one month is 3 March, not 28 February.
  Use subtractMonths / addMonths / monthsBetween / termEndDate from
  supabase/functions/_shared/date-months.ts.
`);
  process.exit(1);
}

console.log(
  `✓ No new overflowing setMonth arithmetic (${offenders.length} known, ${files.length} files checked).`,
);
if (fixed.length > 0) {
  console.log(`\n  ${fixed.length} baseline entr(ies) fixed. Tighten the ratchet:`);
  console.log('      node scripts/check-month-arithmetic.mjs --update-baseline');
}
