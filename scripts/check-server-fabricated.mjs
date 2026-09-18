#!/usr/bin/env node
/**
 * DASH-METRICS-001 AC5: a fabricated measurement on the SERVER side.
 *
 * WHY THIS EXISTS. All three fabrication guards read client/src and nothing
 * else - check:fabricated wants a query read OR'd with a literal, and
 * check:no-static-posture and check:no-mocks are both scoped to the page tree.
 * So ten fabricated dashboard widgets sat in an Express router, answering the
 * first screen after login with $125,432 of revenue at 12.5% growth, 23 tickets
 * at -3.1%, a six-month revenue line and a five-person sales leaderboard, and
 * every one of those guards passed on every run. A page that renders whatever
 * its endpoint sends is a correct page; the fabrication was one layer down.
 *
 * WHAT IT MATCHES. A MEASUREMENT-SHAPED KEY holding a LITERAL inside a response
 * call - res.json(...), res.send(...), createCorsResponse(...), jsonResponse(...).
 * The key list is the vocabulary of things a dashboard claims to have measured
 * (revenue, change, rate, score, uptime, satisfaction); the value has to look
 * like a measurement rather than a flag or a page number.
 *
 * WHAT COUNTS AS A LITERAL WORTH REPORTING:
 *   - a currency or percentage string: '$125,430', '98.7%'
 *   - a decimal: 12.5, -3.1, 4.8
 *   - an integer of four digits or more: 1247, 45789
 * and NOT:
 *   - 0, 1 or any small whole number. A zeroed count is a measurement and an
 *     honest empty state; `{ total: 0 }` must not be a finding or the guard
 *     becomes noise and stops being read.
 *   - null. Answering null is the CORRECTION this story applied, so flagging it
 *     would punish the fix.
 *   - anything under a pagination key (page, limit, offset, per_page).
 *
 * BLIND SPOTS, stated so a clean run is never read as proof. The scan is
 * textual: a fabricated value assigned to a variable and spread into the
 * response is invisible, as is one built by a helper, and so is a whole
 * fabricated fixture module imported from elsewhere - check:phantom-tables
 * covers one shape of that. It also cannot tell a genuine constant (a tax rate,
 * a threshold) from an invented measurement, which is what the baseline is for.
 *
 * Shrink-only ratchet. Usage:
 *   node scripts/check-server-fabricated.mjs [--update-baseline]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['server', 'supabase/functions'];
const BASELINE = path.join(ROOT, 'docs/server-fabricated-baseline.json');

/**
 * Fixtures BY DESIGN, excluded by rule rather than baselined - a baseline
 * holding known non-defects is where a real one hides.
 *
 *   tests, seeds/, seed-*.ts   demo rows are supposed to be typed in
 *   database-updater/          stores SQL for report definitions to run later
 *   openapi/                   request and response EXAMPLES in a spec
 */
const SKIP = /(^|\/)(tests?|__tests__|node_modules|seeds|database-updater|openapi)(\/|$)/;
const SKIP_FILE = /(^|\/)seed-[^/]*\.(ts|mts|js|mjs)$/;

/**
 * Keys a reader takes as a measurement. Deliberately not "any key": `id`,
 * `status` and `name` hold literals all day and none of them claims anything.
 */
const MEASUREMENT_KEY =
  /^(.*_)?(revenue|mrr|arr|ltv|cac|amount|total|subtotal|balance|cost|price|spend|count|change|growth|rate|ratio|percent|percentage|score|value|uptime|accuracy|satisfaction|attainment|utilization|efficiency|throughput|latency|duration|average|avg|median|compliance|readiness|coverage|adherence|completion|conversion)$/i;

const PAGINATION_KEY = /^(page|limit|offset|per_?page|page_?size|max|top|take|skip)$/i;

/** A value that reads as a measurement rather than a flag or a page number. */
function isFabricatedLiteral(raw) {
  const v = raw.trim();
  if (/^(null|undefined|true|false)$/.test(v)) return false;
  // '$125,430' / "98.7%" / '1.2TB'
  if (/^['"`]\s*[$€£]?\s*[\d,]+(\.\d+)?\s*(%|[KMB]|TB|GB|ms|s|hrs?|days?)?\s*['"`]$/.test(v)) {
    return /\d/.test(v) && !/^['"`]\s*[$€£]?\s*0+(\.0+)?\s*/.test(v);
  }
  if (!/^-?\d+(\.\d+)?$/.test(v)) return false;
  const n = Number(v);
  if (!Number.isFinite(n)) return false;
  // A decimal is a measurement; a small whole number is a flag, a rank or a
  // zeroed count.
  if (!Number.isInteger(n)) return Math.abs(n) > 0;
  return Math.abs(n) >= 1000;
}

function stripComments(src) {
  // Line comments FIRST, keeping the https:// lookbehind - a block-comment pass
  // run first reads the `/*` inside a line comment as an opener and blanks the
  // rest of the file (check:shared-helper-imports learned this the hard way).
  const noLine = src.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return noLine.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (SKIP.test(`/${rel}`) || SKIP_FILE.test(`/${rel}`)) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|mts|js|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const findings = [];
for (const dir of DIRS) {
  for (const rel of walk(path.join(ROOT, dir))) {
    const lines = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8')).split('\n');
    // NOT anchored to a response call, and that was the first version's mistake:
    // it opened a 40-line window at `res.json(`/`createCorsResponse(` and matched
    // inside it, which misses every handler that BUILDS an object and returns it
    // for a caller to serialise - the shape this whole story is made of. Mutating
    // a derived metric back into `{ value: 1247, change: 12.5 }` did not trip it.
    // A `key: literal` pair only occurs in an object literal anyway, so dropping
    // the anchor costs precision the baseline already has to absorb.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // The value is EITHER a quoted string or a comma-free token. Splitting on
      // the comma alone truncated '$125,432' to '$125 and the currency test then
      // failed on it - a fabricated dollar figure is exactly what this is for.
      for (const m of line.matchAll(
        /(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\s*:\s*('[^'\n]*'|"[^"\n]*"|`[^`\n]*`|[^,;{}\n]+)/g,
      )) {
        const key = m[2];
        if (PAGINATION_KEY.test(key)) continue;
        if (!MEASUREMENT_KEY.test(key)) continue;
        if (!isFabricatedLiteral(m[3])) continue;
        findings.push({ file: rel, key, value: m[3].trim(), line: i + 1 });
      }
    }
  }
}

const keyOf = (f) => `${f.file} :: ${f.key} = ${f.value}`;
const found = [...new Set(findings.map(keyOf))].sort();

if (process.argv.includes('--update-baseline')) {
  fs.writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        note: 'Measurement-shaped keys holding literals inside a server or edge response. Shrink-only: see scripts/check-server-fabricated.mjs for what each entry has to be checked against.',
        entries: found,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`baseline updated: ${found.length} entr(ies)`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE)
  ? new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).entries)
  : new Set();

const added = found.filter((f) => !baseline.has(f));
const fixed = [...baseline].filter((f) => !found.includes(f));

if (added.length > 0) {
  console.error(`\n✗ ${added.length} NEW fabricated server value(s):\n`);
  for (const entry of added) console.error(`  ${entry}`);
  console.error(
    '\nA number a caller reads as a measurement has to come from a row. If nothing\n' +
      'measures it, answer null and name it in an `unbacked` list - an absence must\n' +
      'not read as a zero.\n',
  );
  process.exit(1);
}

if (fixed.length > 0) {
  console.log(
    `ℹ ${fixed.length} baseline entr(ies) appear fixed — tighten with --update-baseline`,
  );
}
console.log(
  `✓ No new fabricated server values (${found.length} baselined across ${DIRS.join(', ')}).`,
);
