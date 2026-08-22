#!/usr/bin/env node
/**
 * A static route registered AFTER a :param sibling that swallows it.
 *
 * Express matches in REGISTRATION order, so this:
 *
 *     app.get('/api/product-models/:id', ...)        // registered first
 *     app.get('/api/product-models/categories', ...) // never reached
 *
 * makes the second handler dead: every request to /categories is served by the
 * :id handler with id set to the literal word "categories", which then 404s
 * because no row has that id. The endpoint looks implemented, answers 404, and
 * nothing in the type system, the linter or any other ratchet can see it.
 *
 * Found by hand in routes-product-models.ts (3 dead GETs) and
 * routes-software-products.ts (3 more). In the second file DELETE /bulk-delete
 * was ordered correctly while the GETs were not, which is exactly why this needs
 * a scanner rather than a convention: the mistake is per-route, not per-file.
 *
 * Usage:
 *   node scripts/check-route-shadowing.mjs
 *   node scripts/check-route-shadowing.mjs --list
 *   node scripts/check-route-shadowing.mjs --update-baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE = join(ROOT, 'docs', 'route-shadowing-baseline.json');
const SCAN_DIRS = ['server'];
const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'all'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/** Blank comments so a commented-out registration is not counted. */
function blankComments(src) {
  return src
    .replace(/^[ \t]*\/\/.*$/gm, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** `/api/x/:id` -> a regex matching a concrete path with one segment there. */
function toMatcher(path) {
  const body = path
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) return '[^/]+';
      if (seg === '*') return '.*';
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${body}$`);
}

const isParam = (seg) => seg.startsWith(':') || seg === '*';
const hasParam = (path) => path.split('/').some(isParam);

function findingsFor(file) {
  const src = blankComments(readFileSync(file, 'utf8'));
  const rel = relative(ROOT, file);
  const routes = [];

  const re = new RegExp(
    String.raw`\b(?:app|router)\s*\.\s*(${VERBS.join('|')})\s*\(\s*(['"\`])([^'"\`]+)\2`,
    'g',
  );
  let m;
  while ((m = re.exec(src))) {
    routes.push({ verb: m[1], path: m[3], index: m.index });
  }

  const findings = [];
  for (let i = 0; i < routes.length; i++) {
    const later = routes[i];
    // Only a path with at least one STATIC segment can be swallowed in a way
    // that matters; a pure-param path shadowing another pure-param path is a
    // duplicate registration, which check:dup-routes already owns.
    if (hasParam(later.path) && !later.path.split('/').some((s) => s && !isParam(s))) continue;

    for (let j = 0; j < i; j++) {
      const earlier = routes[j];
      if (earlier.verb !== later.verb && earlier.verb !== 'all') continue;
      if (!hasParam(earlier.path)) continue; // a static path only shadows an identical one
      if (earlier.path === later.path) continue; // duplicate, not shadowing
      if (!toMatcher(earlier.path).test(later.path)) continue;
      findings.push(
        `${rel}:${lineOf(src, later.index)} ${later.verb.toUpperCase()} ${later.path} shadowed by ${earlier.path}`,
      );
      break;
    }
  }
  return findings;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const findings = files.flatMap(findingsFor).sort();

/** Keyed by file + route, not by line: line numbers move under unrelated edits. */
const keyOf = (f) => f.replace(/:\d+ /, ' ');
const keys = findings.map(keyOf).sort();

const args = process.argv.slice(2);
if (args.includes('--update-baseline')) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'Static routes registered after a :param sibling that swallows them. Express matches in registration order, so each entry is a handler that can never run - it answers from the :param handler instead, usually as a 404. Invisible to tsc, eslint and every other ratchet. Fix by moving the static registration above the :param one. Keyed by file + route so line numbers do not churn. Shrink, never grow: node scripts/check-route-shadowing.mjs --update-baseline.',
        allowed: keys,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${keys.length} shadowed route(s).`);
  process.exit(0);
}

let allowed = [];
try {
  allowed = JSON.parse(readFileSync(BASELINE, 'utf8')).allowed ?? [];
} catch {
  allowed = [];
}
const allowedSet = new Set(allowed);
const fresh = findings.filter((f) => !allowedSet.has(keyOf(f)));
const gone = allowed.filter((a) => !keys.includes(a));

if (args.includes('--list')) {
  for (const f of findings) console.log('  ' + f);
  console.log(`${findings.length} total, ${fresh.length} not baselined.`);
  process.exit(0);
}

if (fresh.length > 0) {
  console.error(
    `✗ ${fresh.length} route(s) registered after a :param sibling that swallows them:\n`,
  );
  for (const f of fresh) console.error('    ' + f);
  console.error(
    '\nExpress matches in registration order, so these handlers can never run.\n' +
      'Move the static registration above the :param one.',
  );
  process.exit(1);
}

console.log(
  `✓ No new shadowed routes (${findings.length} baselined` +
    (gone.length ? `; ${gone.length} now resolved - tighten with --update-baseline` : '') +
    ').',
);
