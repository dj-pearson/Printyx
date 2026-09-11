#!/usr/bin/env node
/**
 * SHRINK-ONLY RATCHET. A range filter on a CALENDAR-DATE column whose bound
 * carries a time of day.
 *
 * DATE-LOCAL-001 fixed the client, which was writing UTC dates for local
 * calendar days. DATE-LOCAL-002 is the other side of the same seam: a column
 * that holds a calendar date is `timestamp` in this schema, so the value lands
 * at midnight, and a bound built from `new Date()` sits half a day later. The
 * comparison is then wrong by exactly one day, silently, in whichever direction
 * the operator points.
 *
 * Three live instances, each a different consequence:
 *
 *   - customer-portal usage analytics: the 30-day window excluded every reading
 *     dated on its first day, and because the same boundary SPLITS this period
 *     from the previous one, those readings were counted in the wrong half of
 *     the comparison the page is built on.
 *   - tasks stats: "overdue" was `due_date < now`, which from 00:00 onward
 *     includes everything due TODAY - and the "due today" tile beside it
 *     counted the same rows again, so the two figures overlapped.
 *   - teams analytics: a 30-day hours total was 29 days of entries.
 *
 * WHOSE MIDNIGHT. `tenants` has no timezone column - checked, not assumed - and
 * `user_settings.timezone` is per-user and unavailable to a cron. So boundaries
 * are UTC midnight, which is what the stored values are, making the comparison
 * exact rather than approximately right. The day that changes, it changes in
 * _shared/date-months.ts and nowhere else.
 *
 * A RATCHET, NOT A GATE, because the column list is a NAMING CONVENTION and not
 * a type: everything here is `timestamp`, so nothing distinguishes
 * `reading_date` (a calendar date) from `sent_date` (a real instant) except
 * reading the feature. Each remaining entry needs that reading. The number may
 * only go down.
 *
 *   node scripts/check-calendar-date-bounds.mjs [--update-baseline]
 */
import fs from 'node:fs';
import path from 'node:path';

const BASELINE = 'docs/calendar-date-bounds-baseline.json';
const UPDATE = process.argv.includes('--update-baseline');

/**
 * Columns that hold a calendar date rather than an instant. Hand-picked from
 * the ones a user types into a date picker or a report window covers - the
 * `_date` suffix alone also catches `sent_date` and `accepted_date`, which are
 * stamped by the server at a real moment and are correctly compared to one.
 */
const CALENDAR_COLUMNS = [
  'reading_date',
  'entry_date',
  'due_date',
  'invoice_date',
  'paid_date',
  'metric_date',
  'start_date',
  'end_date',
  'next_due_date',
  'contract_start_date',
  'contract_end_date',
  'effective_date',
  'expiry_date',
  'scheduled_date',
  'service_date',
  'payment_date',
  'date_value',
  'publish_date',
];

/** Something that has already been snapped to a day boundary. */
const DAY_BOUNDED =
  /startOfUtcDay|startOfNextUtcDay|utcDateOnly|toDateInputValue|todayLocalDate|slice\(0,\s*10\)|substring\(0,\s*10\)|split\('T'\)\[0\]|format\([^)]*yyyy-MM-dd/;

/**
 * True when `name` is declared in this file from an expression that is itself
 * day-bounded, directly or through one more variable. Two levels, deliberately:
 * beyond that the answer stops being readable to a person either.
 */
function isDayBoundedVariable(src, name, depth = 0) {
  if (depth > 2) return false;
  const decl = new RegExp(`(?:const|let|var)\\s+${name}\\s*(?::[^=]*)?=\\s*([^;\\n]{0,200})`).exec(
    src,
  );
  if (!decl) return false;
  const rhs = decl[1];
  if (DAY_BOUNDED.test(rhs)) return true;
  for (const ident of rhs.matchAll(/[A-Za-z_$][\w$]*/g)) {
    if (ident[0] === name) continue;
    if (isDayBoundedVariable(src, ident[0], depth + 1)) return true;
  }
  return false;
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p.split(path.sep).join('/'));
  }
})('supabase/functions');

const found = [];
for (const file of files) {
  const src = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  for (const col of CALENDAR_COLUMNS) {
    const re = new RegExp(`\\.(gte|lte|lt|gt)\\(\\s*['"]${col}['"]\\s*,\\s*([^)]{0,160})\\)`, 'g');
    let m;
    while ((m = re.exec(src))) {
      const [, op, bound] = m;
      if (DAY_BOUNDED.test(bound)) continue;
      // Resolve one level of indirection. The corrected customer-portal window
      // reads `.gte('reading_date', previousStart.toISOString())`, where
      // previousStart is derived from a startOfUtcDay value several lines up -
      // without this the ratchet would hold two entries it knows are correct,
      // which is exactly where a real one hides.
      const root = bound.trim().split(/[.\s(]/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(root) && isDayBoundedVariable(src, root)) continue;
      // A bound that is a bare identifier came off the query string - the
      // caller sent `?dateFrom=2026-09-01`, which is already a calendar date.
      if (/^[A-Za-z_$][\w$.]*$/.test(bound.trim()) && !/\bnow\b/i.test(bound)) continue;
      found.push(`${file}::${op}('${col}', ${bound.trim().replace(/\s+/g, ' ')})`);
    }
  }
}
found.sort();

if (UPDATE) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'DATE-LOCAL-002 ratchet. A range filter on a calendar-date column whose bound carries a time of day - off by one day, silently. Shrink this, never grow it.',
        total: found.length,
        allowed: found,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: ${found.length} time-of-day bound(s) on a calendar-date column.`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const added = found.filter((f) => !baseline.allowed.includes(f));
if (added.length) {
  console.error('New time-of-day bound on a calendar-date column:\n');
  for (const a of added) console.error('  ' + a);
  console.error(
    '\nThe column holds midnight, so a bound carrying a time of day is off by a day. Snap it' +
      ' with startOfUtcDay / startOfNextUtcDay from supabase/functions/_shared/date-months.ts.',
  );
  process.exit(1);
}
if (found.length < baseline.total) {
  console.log(
    `check:calendar-date-bounds - down to ${found.length} (baseline ${baseline.total}).` +
      ' Tighten with --update-baseline.',
  );
  process.exit(0);
}
console.log(`check:calendar-date-bounds - holds at ${found.length}, none new.`);
