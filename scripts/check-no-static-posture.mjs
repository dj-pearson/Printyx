#!/usr/bin/env node
/**
 * AUDIT-019 guard: keep fabricated operational values off admin and security
 * surfaces.
 *
 * check:no-mocks catches a mock IDENTIFIER used as a data source
 * (`generateMockTodayData()`, `const mockAnomalies = [...]`) and a mock
 * returned from a catch block. SystemSecurity.tsx had neither and was still
 * entirely fabricated: 442 lines of JSX in which every number, badge and date
 * was written inline as a literal. It asserted the database was encrypted, the
 * firewall had blocked 847 requests today, and the TLS certificate was valid
 * until a date that had already passed - all of it green, none of it measured.
 *
 * So this is a sibling guard, not an extension: it works on the SHAPE of the
 * rendered value rather than on the name of its source. A value an admin reads
 * as a measurement must arrive through an expression. A literal in that slot is
 * the defect.
 *
 * Usage: node scripts/check-no-static-posture.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Surfaces where a fabricated value is read as a statement about the system. */
// Widened from client/src/pages/admin to the whole page tree (PA-040). The
// original scope was set to the surface AUDIT-019 was cleaning; PA-040 named
// nine more pages elsewhere that render mock constants and make no API call at
// all, and picking them off by name is how the next one gets missed. Components
// are deliberately NOT included: a presentational component receiving values
// through props legitimately holds none of its own, and scanning them buries
// the finding in noise.
const DIRS = ['client/src/pages'];

const FILES = [
  'client/src/pages/MeetingTranscription.tsx',
  'client/src/pages/ServicePredictions.tsx',
  'client/src/pages/ContractProfitability.tsx',
  'client/src/pages/ERPIntegration.tsx',
];

/**
 * A JSX text node that is nothing but a value: >847<, >99.9%<, >1.2TB<,
 * >47/47<, >$18,750<. Real data arrives as {expression}; a literal here is a
 * number someone typed.
 *
 * A bare single digit is NOT matched. Ordered-step markers ("1", "2", "3" in a
 * numbered list) are written exactly that way and are labels, not
 * measurements - matching them would have made this guard noise. A value worth
 * asserting carries a unit, a separator, a decimal, a ratio, or two digits.
 */
const NUMERIC_TEXT = new RegExp(
  '>\\s*(?:' +
    [
      '\\$\\d[\\d.,]*', // currency
      '\\d[\\d.,]*\\s*(?:%|TB|GB|MB|KB|ms)', // unit
      '\\d[\\d.,]*\\s*/\\s*\\d[\\d.,]*', // ratio
      '\\d[\\d.,]*[.,]\\d+', // decimal or thousands separator
      '\\d{2,}', // two digits or more
    ].join('|') +
    ')\\s*<',
  'g',
);

/** Posture words asserted as a complete JSX text node. */
const POSTURE_TEXT =
  />\s*(Encrypted|Secured|Secure|Protected|Compliant|Hardened|Up to date|No vulnerabilities|No threats detected)\s*</g;

/** A gauge whose fill is a typed-in percentage. */
const LITERAL_GAUGE = /<Progress[^>]*\svalue=\{\s*\d/g;

/** A certificate or licence expiry written as a string. */
const LITERAL_EXPIRY = /Valid until\s+\d/g;

/**
 * WF-G-04: a page-level array of realistic records in a file that fetches
 * nothing.
 *
 * The four rules above all work on a RENDERED slot - a JSX text node, a gauge,
 * an expiry string. AssetManagement.tsx and VehicleManagement.tsx evade every
 * one of them, and check:no-mocks too: their data is a typed const array
 * (`const assets: Asset[] = [...]`), so it is not named mock*, and it reaches
 * the screen through {asset.purchasePrice} rather than as a literal text node.
 * A reader sees a fleet with serial numbers, purchase prices and warranty dates
 * and has no way to tell it is typed in.
 *
 * THE FILE-LEVEL CONDITION IS WHAT MAKES THIS SAFE. A page that queries anything
 * is not flagged, so a real page holding a small fixture beside live data does
 * not trip it; the finding is specifically "this page fetches nothing and
 * renders records anyway".
 *
 * THREE THINGS KEEP IT OFF LOOKUP TABLES, which is the failure mode that would
 * make it noise. A status-colour or label map is an OBJECT, not an array, so it
 * is not matched at all. An array of short option objects fails the five-field
 * test. And the array must carry at least one value that is data rather than
 * configuration - a currency amount, a date, or a serial-like string - which a
 * list of tab definitions or filter options does not.
 *
 * THE THREE-RECORD THRESHOLD IS COUNTED PER FILE, NOT PER ARRAY, and that is a
 * deliberate reading of the AC rather than a convenience. VehicleManagement.tsx
 * holds TWO arrays of TWO records each - four fabricated vehicles and
 * maintenance jobs with VINs, lease expiries and monthly payments - and a
 * per-array threshold of three would have missed it entirely while catching
 * AssetManagement.tsx beside it. The point of the threshold is to skip small
 * option lists, and a file is the unit the finding is about.
 */
/**
 * A field key inside a record object, whether the object is formatted across
 * lines or collapsed onto one.
 *
 * The obvious form, /^\s*\w+:/ with the m flag, is LINE-ANCHORED, and prettier
 * keeps a short object on a single line - so a five-field record written
 * `{ id: '1', amount: 12500, ... }` counted as ONE field and slipped through.
 * That is the blind spot check:no-random-metrics records in its own header, and
 * it is avoidable here: anchor on the brace or comma that precedes the key
 * instead of on the newline.
 */
const RECORD_FIELD = /(?:^|[{,])\s*\w+:\s*/;
const DATAISH_VALUE =
  /(?::\s*\d{3,}(?:\.\d+)?\s*[,}])|(?:new Date\(')|(?:\d{4}-\d{2}-\d{2})|(?::\s*'[A-Z]{2,}[-_]?\d{4,})/;

/** Page-level `const x = [` / `const x: T[] = [` and its balanced body. */
function recordArrays(code) {
  const out = [];
  const re = /(?:^|\n)(\s*)const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*\[/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const open = code.indexOf('[', m.index + m[0].length - 1);
    let depth = 0;
    let end = -1;
    for (let i = open; i < code.length; i++) {
      const c = code[i];
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    out.push({ name: m[2], body: code.slice(open, end + 1), at: m.index });
  }
  return out;
}

function fabricatedRecordArrays(code) {
  // A page that fetches ANYTHING is out of scope - see the header.
  if (/\buseQuery\b|\buseMutation\b|\bapiRequest\b|\bfetch\s*\(/.test(code)) return [];

  const candidates = [];
  for (const { name, body, at } of recordArrays(code)) {
    const objects = body.split(/\}\s*,\s*\{/);
    const fields = (objects[0].match(new RegExp(RECORD_FIELD.source, 'gm')) ?? []).length;
    if (fields < 5) continue;
    if (!DATAISH_VALUE.test(body)) continue;
    candidates.push({
      name,
      line: code.slice(0, at).split('\n').length,
      count: objects.length,
      fields,
    });
  }
  // Per FILE, for the reason in the header.
  const records = candidates.reduce((sum, c) => sum + c.count, 0);
  return records >= 3 ? candidates : [];
}

const RULES = [
  [NUMERIC_TEXT, 'numeric value rendered as a literal, not from data'],
  [POSTURE_TEXT, 'security posture asserted as a literal'],
  [LITERAL_GAUGE, 'Progress gauge filled from a literal percentage'],
  [LITERAL_EXPIRY, 'expiry date asserted as a literal'],
];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collect(target) {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [target];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? collect(path.join(target, e.name))
        : /\.(ts|tsx)$/.test(e.name)
          ? [path.join(target, e.name)]
          : [],
    );
}

/**
 * Marketing pages are prose, not instrumentation.
 *
 * client/src/pages/marketing/* is public copy - "52 integrations", "24/7" -
 * written by a person to be read as a claim about the product, not rendered as
 * a measurement of this tenant's data. Excluded by RULE rather than baselined:
 * a baseline holding known non-defects is where a real one hides, and every
 * future marketing page would need adding to it by hand.
 */
const EXCLUDED = /^client\/src\/pages\/marketing\//;

const problems = [];
for (const rel of [...DIRS, ...FILES].flatMap(collect)) {
  if (EXCLUDED.test(rel.replace(/\\/g, '/'))) continue;
  const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

  code.split('\n').forEach((line, i) => {
    for (const [re, why] of RULES) {
      re.lastIndex = 0;
      if (re.test(line)) {
        problems.push({ rel, line: i + 1, why, text: line.trim().slice(0, 120) });
        break;
      }
    }
  });

  // WF-G-04. Keyed by the variable name rather than a line of source, because
  // the finding is the whole array and quoting its first line would churn the
  // baseline every time a field moved.
  for (const fabricated of fabricatedRecordArrays(code)) {
    problems.push({
      rel,
      line: fabricated.line,
      why: 'page-level array of records in a file that fetches nothing',
      text: `const ${fabricated.name} = [ ${fabricated.count} records x ${fabricated.fields} fields ]`,
    });
  }
}

// Keyed by file + the offending text, not by line, so moving code does not
// churn the list. The scope widened from client/src/pages/admin to the whole
// page tree (PA-040) and inherited what was already there; the baseline is that
// inheritance and nothing else. It must only ever shrink.
const BASELINE = path.join(ROOT, 'docs', 'static-posture-baseline.json');
const key = (p) => `${p.rel}  ${p.text}`;
const found = problems.map(key);

if (process.argv.includes('--update-baseline')) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Values typed into a page instead of read from data, inherited when this check widened ' +
          'from client/src/pages/admin to the whole page tree (PA-040). Each is a claim to delete ' +
          'or derive. Shrink this list, never grow it. See scripts/check-no-static-posture.mjs.',
        total: found.length,
        offenders: [...new Set(found)].sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: ${found.length} static value(s).`);
  process.exit(0);
}

const baseline = new Set(
  fs.existsSync(BASELINE) ? (JSON.parse(fs.readFileSync(BASELINE, 'utf8')).offenders ?? []) : [],
);
const added = problems.filter((p) => !baseline.has(key(p)));

if (added.length > 0) {
  console.error(`check:no-static-posture: ${added.length} NEW fabricated value(s)\n`);
  for (const p of added) {
    console.error(`  ${p.rel}:${p.line}  ${p.why}`);
    console.error(`    ${p.text}`);
  }
  console.error(
    '\nDelete the claim or derive it from a query. A value an admin reads as a\n' +
      'measurement must not be typed in. See AUDIT-019.',
  );
  process.exit(1);
}

const fixed = [...baseline].filter((b) => !found.includes(b));
if (fixed.length > 0) {
  console.log(
    `check:no-static-posture: no new fabricated values. ${fixed.length} baselined entr(ies) gone.\n` +
      '  Tighten with: node scripts/check-no-static-posture.mjs --update-baseline',
  );
} else {
  console.log(`check:no-static-posture: no new fabricated values (${found.length} baselined).`);
}
