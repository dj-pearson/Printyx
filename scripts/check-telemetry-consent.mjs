#!/usr/bin/env node
/**
 * LEGAL-001 guard: no telemetry outside the consent gate.
 *
 * The failure this exists to prevent already happened once. The repo had a
 * complete, well-built consent model in client/src/lib/cookie-consent.ts whose
 * own header comment said every non-essential script "MUST be gated behind
 * hasConsent(category)" — and hasConsent() had zero call sites, while Sentry
 * Session Replay initialized at boot and recorded 10% of all sessions. The
 * banner recorded a choice nothing read.
 *
 * Nothing about that was visible in review, because the two halves lived in
 * different files and each looked correct on its own. So it gets a build guard.
 *
 * Two rules:
 *
 *  1. Sentry.init and telemetry-integration calls may appear only in
 *     client/src/lib/telemetry.ts, which owns the lifecycle and the gate.
 *  2. No known third-party analytics/marketing SDK may be referenced anywhere
 *     in the client bundle. Adding one is fine — route it through telemetry.ts
 *     behind hasConsent() and add it to the allowlist here in the same commit.
 *
 *  3. client/index.html carries no cross-origin <script src>. This rule exists
 *     because the first scan missed a real one: index.html loaded
 *     replit-dev-banner.js from replit.com on every production page view, and a
 *     client/src-only scan could never see it. Anything a page loads before
 *     React mounts is by definition outside the consent gate.
 *
 * Usage: node scripts/check-telemetry-consent.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = path.join(ROOT, 'client/src');

/** The one module allowed to start telemetry. Relative to repo root. */
const TELEMETRY_OWNER = 'client/src/lib/telemetry.ts';

/**
 * Calls that start or extend telemetry collection. Allowed only in the owner
 * module, where each one sits behind hasConsent().
 */
const INIT_PATTERNS = [
  { re: /\bSentry\s*\.\s*init\s*\(/, what: 'Sentry.init()' },
  { re: /\bSentry\s*\.\s*addIntegration\s*\(/, what: 'Sentry.addIntegration()' },
  { re: /\breplayIntegration\s*\(/, what: 'replayIntegration()' },
  { re: /\bbrowserTracingIntegration\s*\(/, what: 'browserTracingIntegration()' },
];

/**
 * Third-party analytics, replay and marketing SDKs. None of these are in the
 * bundle today; the guard is here so adding one is a deliberate act that
 * updates this list, rather than a transitive import nobody noticed.
 */
const SDK_PATTERNS = [
  { re: /\bgtag\s*\(|googletagmanager\.com|google-analytics\.com/, what: 'Google Analytics / GTM' },
  { re: /\bfbq\s*\(|connect\.facebook\.net/, what: 'Meta Pixel' },
  { re: /\bhj\s*\(|static\.hotjar\.com/, what: 'Hotjar' },
  { re: /\bmixpanel\s*\./, what: 'Mixpanel' },
  { re: /\bposthog\s*\./, what: 'PostHog' },
  { re: /\bamplitude\s*\./, what: 'Amplitude' },
  { re: /\bFS\s*\.\s*identify\s*\(|fullstory\.com/, what: 'FullStory' },
  { re: /\banalytics\s*\.\s*(track|identify|page)\s*\(/, what: 'Segment' },
  { re: /clarity\.ms|\bclarity\s*\(/, what: 'Microsoft Clarity' },
  { re: /\bltq\s*\(|snap\.licdn\.com/, what: 'LinkedIn Insight Tag' },
  { re: /static\.ads-twitter\.com|\btwq\s*\(/, what: 'X / Twitter Pixel' },
];

/** Strip comments so a pattern named in prose is not read as a call site. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const file of walk(SCAN_DIR)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const isOwner = rel === TELEMETRY_OWNER;
  // The guard's own patterns are written as source; don't scan test fixtures
  // for SDK names they only mention.
  const isTest = /\.test\.(ts|tsx)$/.test(rel);

  const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');

  lines.forEach((line, i) => {
    if (!isOwner) {
      for (const { re, what } of INIT_PATTERNS) {
        if (re.test(line)) {
          violations.push({
            rel,
            line: i + 1,
            msg: `${what} outside ${TELEMETRY_OWNER}. Telemetry must start from the consent gate.`,
          });
        }
      }
    }
    if (!isTest) {
      for (const { re, what } of SDK_PATTERNS) {
        if (re.test(line)) {
          violations.push({
            rel,
            line: i + 1,
            msg: `${what} referenced in the client bundle. Route it through ${TELEMETRY_OWNER} behind hasConsent() and allowlist it here.`,
          });
        }
      }
    }
  });
}

// Rule 3: no cross-origin scripts in the HTML shell, which loads before the
// consent gate can possibly run.
const HTML_SHELL = 'client/index.html';
const htmlPath = path.join(ROOT, HTML_SHELL);
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const lines = html.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/src\s*=\s*["'](https?:)?\/\/[^"']+["']/i);
    if (m) {
      violations.push({
        rel: HTML_SHELL,
        line: i + 1,
        msg: `Cross-origin script ${m[0]} in the HTML shell. It loads before the consent gate exists.`,
      });
    }
  });
}

// The owner module must actually consult the gate, or the whole thing is theatre.
const ownerPath = path.join(ROOT, TELEMETRY_OWNER);
if (!fs.existsSync(ownerPath)) {
  violations.push({ rel: TELEMETRY_OWNER, line: 0, msg: 'Telemetry owner module is missing.' });
} else if (!/hasConsent\s*\(/.test(fs.readFileSync(ownerPath, 'utf8'))) {
  violations.push({
    rel: TELEMETRY_OWNER,
    line: 0,
    msg: 'Telemetry owner module never calls hasConsent(). The gate is not connected.',
  });
}

if (violations.length > 0) {
  console.error(`\ncheck:telemetry FAILED with ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  ${v.msg}`);
  }
  console.error(
    '\nNon-essential telemetry must be gated behind hasConsent() in ' +
      `${TELEMETRY_OWNER}. See LEGAL-001 in prd.json.\n`,
  );
  process.exit(1);
}

console.log('check:telemetry passed — no telemetry initialized outside the consent gate.');
