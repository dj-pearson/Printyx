#!/usr/bin/env node
/**
 * check-nav-targets.mjs — AUDIT-014 nav-target ratchet.
 *
 * Every in-app navigation target in client/src must resolve to a route registered
 * in client/src/App.tsx. Anything else lands the user on the NotFound catch-all.
 * This is CI-checkable, and the whole story exists because it wasn't:
 * a first-time login redirected to /dashboard (not a route) and dropped brand-new
 * users on the 404 page immediately after authenticating.
 *
 * Usage:
 *   node scripts/check-nav-targets.mjs                 # check against baseline (CI)
 *   node scripts/check-nav-targets.mjs --update-baseline
 *   node scripts/check-nav-targets.mjs --list          # print every broken target
 *
 * ── Why it collects EVERY "/" string literal ────────────────────────────────
 * The throwaway script this replaces only matched navigation via
 * setLocation/navigate/href=/to=/window.location/drillThroughUrl. Route paths held
 * as OBJECT VALUES were invisible to it — the command palette's `path: '/dashboard'`,
 * the keyboard-shortcut map's `h: '/dashboard'`, and Login's
 * `const redirectTo = lastRoute || '/dashboard'`. That last one is how a post-login
 * 404 survived a whole audit pass. So: collect every string literal that starts with
 * "/", then allowlist the noise (below). False positives are cheap to allowlist; a
 * false negative ships a 404.
 *
 * ── Known-imprecise by design ───────────────────────────────────────────────
 * Template literals (`/deals/${id}`) are normalized to a placeholder segment and
 * accepted if they match a route exactly, or if some route lives STRICTLY UNDER the
 * static prefix. That distinction is the whole check:
 *   /blog/${post.slug} → three literal post paths are registered under /blog/ → fine.
 *   /deals/${deal.id}  → only the exact route /deals exists, nothing under /deals/
 *                        → every drill-through 404s → reported.
 * The softening can still miss a wrong dynamic target that sits under a real prefix,
 * which beats crying wolf on every template literal in the codebase.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const appTsx = join(repo, 'client', 'src', 'App.tsx');
const clientSrc = join(repo, 'client', 'src');
const baselinePath = join(repo, 'docs', 'nav-targets-baseline.json');

const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

// ── Noise allowlist ─────────────────────────────────────────────────────────
// Strings that start with "/" but are not in-app navigation.
const IGNORE_PREFIXES = [
  '/api/', // backend endpoints, not routes
  '/assets/',
  '/images/',
  '/img/',
  '/static/',
  '/uploads/',
  '/fonts/',
  '/icons/',
  '/public/',
  '/node_modules/',
  '/functions/v1/',
  '/auth/v1/',
  '/rest/v1/',
  '/storage/v1/',
  '/tmp/',
  '/var/',
  '/usr/',
  '/app/',
];

// Extensions => an asset path, not a route. (.xml/.txt cover /sitemap.xml,
// /robots.txt, /llms.txt — served files, not app routes.)
const ASSET_EXT =
  /\.(png|jpe?g|svg|gif|webp|ico|css|js|mjs|ts|tsx|json|xml|txt|woff2?|ttf|pdf|csv|xlsx?)$/i;

function isNoise(path) {
  if (path === '/') return true; // "/" is always a registered route
  if (path.startsWith('//')) return true; // protocol-relative / comment residue
  if (/\s/.test(path)) return true; // sentences, class strings, regex fragments
  if (ASSET_EXT.test(path)) return true;
  if (IGNORE_PREFIXES.some((p) => path.startsWith(p))) return true;
  // A path whose FIRST segment is dynamic (`${base}/x`) carries no static prefix
  // to check against the route table — unverifiable by construction, not a finding.
  if (/^\/\$\{/.test(path)) return true;
  // Regex/format fragments that happen to lead with a slash.
  if (/[(){}[\]<>|^$\\*+?]/.test(path.replace(/\$\{[^}]*\}/g, ''))) return true;
  return false;
}

// ── 1. Registered routes ────────────────────────────────────────────────────
function stripComments(src) {
  // Line comments FIRST. Doing block comments first lets a "/*" inside a line
  // comment (e.g. the literal text "/api/*" in a doc comment) open a phantom block
  // and swallow real code — the AUDIT-003 lesson: a regex that disagrees with the
  // real lexer.
  //
  // Both replacements PRESERVE LINE COUNT (a block comment collapses to just its
  // newlines) so reported lines still point at the real source. Three bugs lived
  // here, all of which silently misreported locations:
  //   - deleting block-comment lines outright shifted every later finding earlier;
  //   - `\s` MATCHES NEWLINES, so `^\s*//` ran past blank lines into the next
  //     comment and ate them, shrinking the file. Use [ \t];
  //   - these sources are CRLF, and `.` excludes \r, so `.*$` never matched before
  //     a \r\n and line comments went unstripped. Consume [^\n]* instead.
  return src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

function registeredRoutes() {
  const src = stripComments(readFileSync(appTsx, 'utf8'));
  const routes = new Set();
  const re = /<Route\s[^>]*path=(?:"([^"]+)"|\{`([^`]+)`\}|'([^']+)')/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    routes.add(m[1] ?? m[2] ?? m[3]);
  }
  return [...routes];
}

// Compile a wouter route path to a matcher.
function routeToRegex(route) {
  const escaped = route
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\/:([A-Za-z0-9_]+)\?/g, '(?:/[^/]+)?') // /:param? optional
    .replace(/:([A-Za-z0-9_]+)/g, '[^/]+') // /:param
    .replace(/\*/g, '.*'); // wildcard
  return new RegExp(`^${escaped}/?$`);
}

// ── 2. Candidate navigation targets ─────────────────────────────────────────
const PLACEHOLDER = '__DYN__';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function candidates(file) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const found = [];
  // Single-quoted, double-quoted, and template literals starting with "/".
  const re = /(['"`])(\/[^'"`\n]*)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const raw = m[2];
    const line = src.slice(0, m.index).split('\n').length;
    found.push({ raw, line });
  }
  return found;
}

// ── 2b. Reachability (LIVE vs DEAD) ─────────────────────────────────────────
// A broken target only 404s a real user if the file holding it is actually
// reachable from App.tsx. The repo has orphaned pages (GdprComplianceDashboard,
// pages/onboarding.tsx, a dead duplicate workflow-automation.tsx) whose broken
// links can never render — they belong to the dead-code story, not this one.
// Without this split the report is dominated by targets nobody can hit.
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(clientSrc, spec.slice(2));
  else if (spec.startsWith('.')) base = join(fromFile, '..', spec);
  else return null; // package import
  const tries = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ];
  return tries.find((t) => existsSync(t) && statSync(t).isFile()) ?? null;
}

function reachableFrom(entry) {
  const seen = new Set();
  const queue = [entry];
  const re = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    let src;
    try {
      src = stripComments(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    let m;
    while ((m = re.exec(src)) !== null) {
      const target = resolveImport(m[1], file);
      if (target && !seen.has(target)) queue.push(target);
    }
    re.lastIndex = 0;
  }
  return seen;
}

// ── 3. Check ────────────────────────────────────────────────────────────────
const routes = registeredRoutes();
const live = reachableFrom(appTsx);
const matchers = routes.map((r) => ({ route: r, re: routeToRegex(r) }));
// Static prefixes that some route lives under, for the template-literal rule.
const routePrefixes = routes.map((r) => r.split('/:')[0].replace(/\*$/, ''));

function resolves(path) {
  const normalized = path.replace(/\$\{[^}]*\}/g, PLACEHOLDER);
  if (matchers.some(({ re }) => re.test(normalized))) return true;
  // Template-literal softening (see header): accept only if some route lives
  // STRICTLY UNDER the static prefix.
  //
  // The `p === staticPrefix` case must NOT be accepted, and this is the whole
  // distinction the check turns on:
  //   /blog/${slug}            → routes /blog/<three literal post paths> exist
  //                              UNDER /blog/ → the dynamic value resolves → fine.
  //   /deals/${deal.id}        → only the exact route /deals exists; nothing lives
  //                              under /deals/ → every drill-through 404s → BROKEN.
  // Accepting the equality case silently passed both, which hid the entire dead
  // TodayDashboard drill-through from the first version of this script.
  if (normalized.includes(PLACEHOLDER)) {
    const staticPrefix = normalized.split(PLACEHOLDER)[0].replace(/\/$/, '');
    if (staticPrefix && routePrefixes.some((p) => p.startsWith(staticPrefix + '/'))) {
      return true;
    }
  }
  return false;
}

const all = [];
for (const file of walk(clientSrc)) {
  for (const { raw, line } of candidates(file)) {
    if (isNoise(raw)) continue;
    if (resolves(raw)) continue;
    all.push({
      target: raw.replace(/\$\{[^}]*\}/g, PLACEHOLDER),
      file: relative(repo, file).replace(/\\/g, '/'),
      line,
      live: live.has(file),
    });
  }
}
all.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

// Only LIVE targets are ratcheted. Dead ones are reported by --list for the
// dead-code story but must not gate CI: deleting an orphan is not this check's job.
const broken = all.filter((b) => b.live);
const dead = all.filter((b) => !b.live);

const key = (b) => `${b.file}:${b.target}`;

if (list) {
  console.log(`LIVE — reachable from App.tsx, a user can hit these (${broken.length}):`);
  for (const b of broken) console.log(`  ${b.file}:${b.line}  ${b.target}`);
  console.log(`\nDEAD — file not reachable from App.tsx, link never renders (${dead.length}):`);
  for (const b of dead) console.log(`  ${b.file}:${b.line}  ${b.target}`);
  console.log(`\n${all.length} unresolved target(s) across ${routes.length} routes.`);
  process.exit(0);
}

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'AUDIT-014 nav-target ratchet. scripts/check-nav-targets.mjs fails CI when a navigation ' +
          'target that does not resolve to a route in App.tsx is ADDED. Entries here are known-broken ' +
          'targets awaiting a product decision (a page that does not exist yet). Shrink this list, ' +
          'never grow it: node scripts/check-nav-targets.mjs --update-baseline.',
        allowed: broken.map(key).sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${broken.length} known-broken target(s) recorded.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(
    `✗ Missing ${baselinePath}. Run: node scripts/check-nav-targets.mjs --update-baseline`,
  );
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).allowed);
const novel = broken.filter((b) => !allowed.has(key(b)));

if (novel.length > 0) {
  console.error(
    `✗ ${novel.length} NEW navigation target(s) do not resolve to a route in App.tsx:\n`,
  );
  for (const b of novel) console.error(`  ${b.file}:${b.line}  →  ${b.target}`);
  console.error(
    '\nThese render the NotFound page. Point them at a registered route, remove the control,\n' +
      'or — if the destination is a page that genuinely does not exist yet — record it with\n' +
      '  node scripts/check-nav-targets.mjs --update-baseline',
  );
  process.exit(1);
}

const fixed = [...allowed].filter((a) => !broken.some((b) => key(b) === a));
if (fixed.length > 0) {
  console.log(`✓ No new broken nav targets. ${fixed.length} baselined target(s) now resolve:`);
  for (const f of fixed) console.log(`    ${f}`);
  console.log('  Tighten with: node scripts/check-nav-targets.mjs --update-baseline');
} else {
  console.log(`✓ No new broken nav targets (${broken.length} known, ${routes.length} routes).`);
}
