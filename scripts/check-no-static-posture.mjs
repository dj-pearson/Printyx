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
const DIRS = ['client/src/pages/admin'];

const FILES = [
  'client/src/pages/AIServiceIntelligence.tsx',
  'client/src/pages/PredictiveContractProfitability.tsx',
  'client/src/pages/MeetingTranscription.tsx',
  'client/src/pages/SecurityComplianceManagement.tsx',
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

const problems = [];
for (const rel of [...DIRS, ...FILES].flatMap(collect)) {
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
}

if (problems.length > 0) {
  console.error(`check:no-static-posture: ${problems.length} fabricated value(s)\n`);
  for (const p of problems) {
    console.error(`  ${p.rel}:${p.line}  ${p.why}`);
    console.error(`    ${p.text}`);
  }
  console.error(
    '\nDelete the claim or derive it from a query. A value an admin reads as a\n' +
      'measurement must not be typed in. See AUDIT-019.',
  );
  process.exit(1);
}

console.log('check:no-static-posture: 0 offenders');
