#!/usr/bin/env node
/**
 * AUDIT-020 guard: keep Math.random() out of reported measurements.
 *
 * THE SHAPE: an object property whose value is derived from Math.random().
 *
 *     completionRate: 92 + Math.random() * 8,
 *     customerSatisfaction: 4.2 + Math.random() * 0.6,
 *     diskUsage: 45 + Math.random() * 20,
 *     totalMonthlyCost: activeCount * 50 + Math.random() * 200,
 *
 * This is WORSE than the hardcoded fixtures AUDIT-019 removed, which is why it
 * needs its own guard. A literal is stable, so it eventually reads as a
 * placeholder. A random one changes on every request - exactly what real
 * telemetry does - so refreshing the page appears to confirm the number is
 * live. server/integrations/dashboard-service.ts invented about 45 values this
 * way, including a monthly cost and an estimated saving, on a screen an admin
 * would use to justify spend.
 *
 * WHY A PROPERTY AND NOT EVERY Math.random(): the legitimate uses are ids,
 * jitter, sampling and retry backoff, and they read as
 * `Math.random().toString(36)` or `if (Math.random() > 0.05)`, never as the
 * value of a named field in a payload. Anchoring on `key:` is what separates
 * the two without a judgement call.
 *
 * SEEDS AND TESTS ARE EXCLUDED, deliberately. Seeding demo data with random
 * values is the one honest use of this pattern: the rows are openly fake and
 * are written to a database rather than reported as measurement.
 *
 * WHAT IT CANNOT SEE, stated so a pass is never read as proof of correctness:
 *   - A single-line object literal. The rule is line-anchored, so
 *     `const x = { rate: Math.random() * 100 };` escapes it while the same
 *     object spread over lines does not. Prettier splits multi-property objects,
 *     which is why this is rare rather than theoretical - but it is the way
 *     through, and it is how a probe slipped past this guard while it was being
 *     written.
 *   - A value computed into a variable first, then assigned to the property.
 *   - Randomness from anything but Math.random (crypto, a helper, a library).
 *
 * Ratchet: the existing offenders are baselined by file and property name, not
 * by line, so ordinary edits do not churn it. Do not grow the list.
 *
 *   node scripts/check-no-random-metrics.mjs
 *   node scripts/check-no-random-metrics.mjs --update-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BASELINE = join(ROOT, 'docs', 'random-metrics-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const ROOTS = ['server', 'supabase/functions'];

/** Seeds and tests may randomise: the data is openly fake, not reported. */
const EXEMPT = /(^|\/)(seed|seeds)[^/]*|\.test\.ts$|\.spec\.ts$|(^|\/)tests?\//;

const PROPERTY_RANDOM = /^\s*([A-Za-z_$][\w$]*)\s*:\s*[^,]*Math\.random\s*\(\)/;

/**
 * `Math.random().toString(36)` is an ID, not a measurement - it is how
 * invoice_number and friends get a suffix. It matches the property rule because
 * it IS a property, so it is excluded here rather than baselined. A baseline
 * carrying known false positives is worse than a shorter one: a real offender
 * hides among them.
 */
const RANDOM_AS_ID = /Math\.random\s*\(\)\s*\.toString\s*\(/;

/**
 * Random interpolated into a template literal is a NAME - `assignment-${...}`,
 * `ticket-${...}` - not a quantity. Excluded for the same reason as the
 * toString form. A number built by arithmetic is the thing this guard is for,
 * which is why `lat: 40.7128 + (Math.random() - 0.5) * 0.1` still trips it:
 * that is a technician's position on a dispatch map, invented.
 */
const RANDOM_IN_TEMPLATE = /`[^`]*\$\{[^}]*Math\.random/;

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const rel = (f) => relative(ROOT, f).split(sep).join('/');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const found = {};
for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    const path = rel(file);
    if (EXEMPT.test(path)) continue;

    const code = stripComments(readFileSync(file, 'utf8'));
    for (const line of code.split('\n')) {
      const m = PROPERTY_RANDOM.exec(line);
      if (!m) continue;
      if (RANDOM_AS_ID.test(line) || RANDOM_IN_TEMPLATE.test(line)) continue;
      (found[path] ??= new Set()).add(m[1]);
    }
  }
}

const current = Object.fromEntries(
  Object.entries(found)
    .map(([file, keys]) => [file, [...keys].sort()])
    .sort(([a], [b]) => a.localeCompare(b)),
);
const total = Object.values(current).reduce((n, keys) => n + keys.length, 0);

if (UPDATE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Object properties whose value comes from Math.random(), i.e. a measurement someone ' +
          'made up. Keyed by file and property name so line moves do not churn it. Do not grow ' +
          'this list; see scripts/check-no-random-metrics.mjs and AUDIT-020.',
        total,
        offenders: current,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Baseline updated: ${total} propert(ies) across ${Object.keys(current).length} file(s).`,
  );
  process.exit(0);
}

const baseline = existsSync(BASELINE)
  ? (JSON.parse(readFileSync(BASELINE, 'utf8')).offenders ?? {})
  : {};

const added = [];
for (const [file, keys] of Object.entries(current)) {
  const known = new Set(baseline[file] ?? []);
  for (const key of keys) if (!known.has(key)) added.push(`${file}  ${key}`);
}

if (added.length > 0) {
  console.error(`✗ ${added.length} NEW fabricated measurement(s):\n`);
  for (const entry of added) console.error(`    ${entry}`);
  console.error(
    '\nA field an operator reads as a measurement must not come from Math.random().\n' +
      'Derive it, or drop the field and say what is not measured. If this is genuinely\n' +
      'not a measurement, rename it or move it out of the payload rather than baselining.',
  );
  process.exit(1);
}

console.log(
  `✓ No new fabricated measurements — ${total} baselined across ${Object.keys(current).length} file(s).`,
);
