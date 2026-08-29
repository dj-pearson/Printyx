#!/usr/bin/env node
/**
 * check-shadowed-express.mjs — PROD-008 ratchet.
 *
 * Express matches the FIRST handler registered for a path, and
 * registerEdgeFunctionProxy runs before every domain registration. So any
 * Express handler whose path sits under a crmProxies prefix is unreachable: the
 * proxy claims the request in dev, and production never reaches Express at all
 * (the frontend rewrites /api/x to functions.printyx.net/x with no fallback).
 *
 * That is a hazard, not tidy-up. EDGE-016 is the worked example: nine
 * monitoring-clients handlers sat behind a proxy entry and had silently drifted
 * from the live copy - the UI called /regenerate-key while Express implemented
 * /rotate-key - so a fix applied there would have looked shipped and changed
 * nothing.
 *
 * The baseline is the backlog. It only shrinks: retire the handler, or port what
 * it does into the edge function and then retire it.
 *
 * `retained` is the third answer, and it is deliberately separate from `allowed`.
 * Some handlers are unreachable but are NOT dead: PROD-008a's meter-billing needs
 * a transaction PostgREST cannot express, and the advanced-billing anomaly /
 * dispute / credit-memo sections are a real feature (seven tables, ~40 storage
 * methods) that simply has no UI and no edge counterpart yet. Deleting working
 * domain logic to move a counter is not a fix. Each retained entry carries a
 * reason, and the two counts are reported separately so "the backlog reached 0"
 * stays a claim about the backlog rather than a claim about the tree.
 *
 * PROD-008b: this used to match only literal '/api/...' registration paths, which
 * made every PREFIX-MOUNTED router invisible. A module mounted with
 * `app.use('/api/customer-success', router)` registers relative paths —
 * `router.get('/health-scores')` — so none of its handlers matched, and the gate
 * would have reported 0 with 131 shadowed handlers still live (48 in
 * routes/advanced-billing-routes.ts, 44 in routes/customer-success-routes.ts,
 * and 39 across seven more). The second pass below resolves each mount to its
 * module and composes mountPath + relative path before testing it against the
 * proxied prefixes.
 *
 * Usage:
 *   node scripts/check-shadowed-express.mjs                  # check (CI)
 *   node scripts/check-shadowed-express.mjs --update-baseline
 *   node scripts/check-shadowed-express.mjs --list
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const proxyPath = join(repo, 'server', 'middleware', 'edge-function-proxy.ts');
const baselinePath = join(repo, 'docs', 'shadowed-express-baseline.json');
const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

/** Every prefix in the crmProxies map. Both the string and object forms. */
function proxiedPrefixes() {
  const src = readFileSync(proxyPath, 'utf8');
  const start = src.indexOf('const crmProxies');
  const end = src.indexOf('for (const [prefix, functionName]');
  if (start < 0 || end < 0) {
    console.error('Could not locate the crmProxies map in edge-function-proxy.ts.');
    process.exit(1);
  }
  return [...src.slice(start, end).matchAll(/'(\/api\/[^']+)':/g)].map((m) => m[1]);
}

/**
 * Blank out comments before matching, preserving line numbers.
 *
 * PROD-008b: without this the scanner counted DOCUMENTATION as shadowed
 * handlers. Five baseline entries came from JSDoc usage examples —
 * `app.get('/api/users', versionedHandler({...}))` in middleware/api-versioning.ts,
 * and the same shape in utils/validation-schemas.ts,
 * middleware/enhanced-validation.ts and middleware/mfa-enforcement.ts. None of
 * those files registers a route at all. A gate that reports work which does not
 * exist is as bad as one that misses work that does.
 *
 * ORDER MATTERS: line comments first. A doc comment containing "/api/*" would
 * otherwise have its "/*" read as an opening block delimiter by a
 * block-comment pass run first, swallowing every real registration up to the
 * next "*​/". Same trap the AUDIT-015 guard documents.
 */
function stripComments(src) {
  return src
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    // tests/ describe routes in fixtures and assertions, not registrations.
    if (entry === 'node_modules' || entry === 'tests') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const prefixes = proxiedPrefixes();
// Longest first, so /api/public/calculator is reported against itself rather
// than against /api/public.
prefixes.sort((a, b) => b.length - a.length);

const findings = [];
for (const file of walk(join(repo, 'server'))) {
  const src = stripComments(readFileSync(file, 'utf8'));
  for (const m of src.matchAll(
    /(?:app|router)\.(get|post|put|patch|delete)\(\s*'(\/api\/[^']+)'/g,
  )) {
    const path = m[2];
    const prefix = prefixes.find((p) => path === p || path.startsWith(p + '/'));
    if (!prefix) continue;
    findings.push({
      file: relative(repo, file).replace(/\\/g, '/'),
      line: src.slice(0, m.index).split('\n').length,
      route: `${m[1].toUpperCase()} ${path}`,
      prefix,
    });
  }
}

// ── Second pass: prefix-mounted routers ────────────────────────────────────
// A router mounted with app.use('<prefix>', router) registers RELATIVE paths, so
// the literal-path scan above never sees it. Resolve every mount in
// routes-registry.ts to its module and compose the full path.
function prefixMountedFindings() {
  const registryPath = join(repo, 'server', 'routes-registry.ts');
  if (!existsSync(registryPath)) return [];
  // Strip line comments so commented-out mounts (e.g. the migrated
  // '/api/proposals' entry) are not read as live ones.
  const registry = stripComments(readFileSync(registryPath, 'utf8'));

  // Imported identifier -> module specifier, for the app.use('<prefix>', ident) form.
  const importedFrom = {};
  for (const m of registry.matchAll(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+'([^']+)'/g)) {
    const spec = m[3];
    if (m[2]) {
      importedFrom[m[2]] = spec;
      continue;
    }
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '');
      const aliased = name.match(/(\w+)\s+as\s+(\w+)/);
      if (aliased) importedFrom[aliased[2]] = spec;
      else if (name) importedFrom[name] = spec;
    }
  }

  // DYNAMIC imports mount routers too, and only static ones were collected
  // above: `const r = await import('./routes-x'); app.use('/api/x', r.foo)`.
  // routes-customer-numbers.ts was mounted exactly that way on a proxied prefix,
  // so its whole shadowed router was invisible to this gate.
  for (const m of registry.matchAll(
    /const\s+(?:\{([^}]+)\}|(\w+))\s*=\s*await\s+import\(\s*'([^']+)'\s*\)/g,
  )) {
    const spec = m[3];
    if (m[2]) importedFrom[m[2]] = spec;
    else
      for (const part of m[1].split(',')) {
        const aliased = part.trim().match(/(\w+)\s*:\s*(\w+)/);
        const name = aliased ? aliased[2] : part.trim();
        if (name) importedFrom[name] = spec;
      }
  }

  const mounts = [];
  // app.use('/api/x', router) and app.use('/api/x', middleware, router)
  for (const m of registry.matchAll(/app\.use\(\s*'(\/api[^']*)'\s*,\s*([^)]+)\)/g)) {
    const ident = m[2].split(',').pop().trim().split('.')[0];
    if (importedFrom[ident]) mounts.push({ prefix: m[1], spec: importedFrom[ident], ident });
  }
  // [ '/api/x', './module' ] tuples (asyncApiMounts and friends)
  for (const m of registry.matchAll(/\[\s*'(\/api\/[^']+)'\s*,\s*'(\.[^']+)'\s*\]/g)) {
    mounts.push({ prefix: m[1], spec: m[2] });
  }
  // Bare './routes/x' entries in the list mounted at '/api'
  for (const m of registry.matchAll(/^\s*'(\.\/routes\/[^']+)',$/gm)) {
    mounts.push({ prefix: '/api', spec: m[1] });
  }

  const resolveModule = (spec, fromDir = 'server') => {
    const base = join(repo, fromDir, spec.replace(/^\.\//, '').replace(/^\.\.\//, '../'));
    for (const candidate of [base + '.ts', join(base, 'index.ts')]) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  };

  /**
   * Follow a BARREL re-export one level.
   *
   * routes-registry.ts imports most routers from ./domains/<area>, which is a
   * file of `export { default as fooRoutes } from '../routes/foo'` lines. The
   * first version of this pass resolved the mount to domains/billing.ts, found
   * no router.get() calls in it (it is all re-exports) and reported nothing - so
   * every router mounted through a domains barrel was invisible to this gate.
   * That is the same class of miss as the prefix-mount gap fixed earlier, which
   * had hidden 131 handlers.
   *
   * Returns the real module path for `ident`, or null when the file is not a
   * barrel for that name.
   */
  const followBarrel = (barrelFile, ident) => {
    const src = stripComments(readFileSync(barrelFile, 'utf8'));
    const barrelDir = relative(repo, barrelFile)
      .replace(/\\/g, '/')
      .replace(/\/[^/]+$/, '');
    for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
      const names = m[1].split(',').map((n) => n.trim());
      const hit = names.some((n) => {
        const aliased = n.match(/(\w+)\s+as\s+(\w+)/);
        return aliased ? aliased[2] === ident : n === ident;
      });
      if (!hit) continue;
      const spec = m[2];
      const dir = spec.startsWith('../') ? barrelDir.replace(/\/[^/]+$/, '') : barrelDir;
      const resolved = resolveModule(spec.replace(/^\.\.\//, './'), dir);
      if (resolved) return resolved;
    }
    return null;
  };

  const out = [];
  const seen = new Set();
  for (const mount of mounts) {
    if (!mount.spec.startsWith('.')) continue;
    let file = resolveModule(mount.spec);
    if (!file) continue; // a mount whose module is gone is its own problem
    if (mount.ident) {
      const behindBarrel = followBarrel(file, mount.ident);
      if (behindBarrel) file = behindBarrel;
    }
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      const rel = m[2];
      // Absolute paths are already covered by the first pass.
      if (rel.startsWith('/api/')) continue;
      const full = (mount.prefix + (rel === '/' ? '' : rel)).replace(/\/{2,}/g, '/');
      const prefix = prefixes.find((p) => full === p || full.startsWith(p + '/'));
      if (!prefix) continue;
      const rec = {
        file: relative(repo, file).replace(/\\/g, '/'),
        line: src.slice(0, m.index).split('\n').length,
        route: `${m[1].toUpperCase()} ${full}`,
        prefix,
      };
      // The same module can be mounted twice; report each route once.
      const id = `${rec.route} (${rec.file})`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(rec);
    }
  }
  return out;
}

/**
 * Modules that mount THEMSELVES on a proxied prefix.
 *
 * prefixMountedFindings above only sees mounts written in routes-registry.ts as
 * `app.use('/api/x', ident)` where `ident` came from a STATIC import. Two shapes
 * escaped it, and both hid a whole router:
 *
 *   - `const r = await import('./routes-x'); app.use('/api/x', r.something)` -
 *     a dynamic import, so the spec lookup found nothing (routes-customer-numbers).
 *   - `export function registerXRoutes(app) { app.use('/api/x', ...) }`, called
 *     from the registry - the app.use is not in the registry at all
 *     (routes-security-dashboard, 218 lines whose four handlers all queried
 *     columns that do not exist on audit_logs, unnoticed because none ever ran).
 *
 * So: scan every server file for `app.use('<proxied prefix>'` and treat that
 * file's own relative router routes as shadowed, wherever the call sits.
 */
function selfMountedFindings() {
  const out = [];
  const seen = new Set();
  for (const file of walk(join(repo, 'server'))) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const mount of src.matchAll(/app\.use\(\s*'(\/api\/[^']+)'/g)) {
      const prefix = prefixes.find((p) => mount[1] === p || mount[1].startsWith(p + '/'));
      if (!prefix) continue;
      for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
        const rel = m[2];
        if (rel.startsWith('/api/')) continue; // first pass owns absolute paths
        const full = (mount[1] + (rel === '/' ? '' : rel)).replace(/\/{2,}/g, '/');
        const rec = {
          file: relative(repo, file).replace(/\\/g, '/'),
          line: src.slice(0, m.index).split('\n').length,
          route: `${m[1].toUpperCase()} ${full}`,
          prefix,
        };
        const id = `${rec.route} (${rec.file})`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(rec);
      }
    }
  }
  return out;
}

findings.push(...prefixMountedFindings());
findings.push(...selfMountedFindings());

findings.sort((a, b) => a.route.localeCompare(b.route) || a.file.localeCompare(b.file));

// Keyed on route + file, not line, so reformatting neither invents nor retires
// a finding.
const key = (f) => `${f.route} (${f.file})`;

if (list) {
  const byPrefix = new Map();
  for (const f of findings) {
    if (!byPrefix.has(f.prefix)) byPrefix.set(f.prefix, []);
    byPrefix.get(f.prefix).push(f);
  }
  for (const [prefix, rows] of [...byPrefix.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${prefix}  (${rows.length})`);
    for (const r of rows) console.log(`    ${r.route}  ${r.file}:${r.line}`);
  }
  console.log(
    `\n${findings.length} shadowed handler(s) across ${byPrefix.size} of ${prefixes.length} proxied prefixes.`,
  );
  process.exit(0);
}

if (update) {
  const prior = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
  const present = new Set(findings.map(key));
  // Drop retained entries whose handler is gone, so a retention cannot outlive
  // the code it was granted for.
  const retainedMap = Object.fromEntries(
    Object.entries(prior.retained || {}).filter(([k]) => present.has(k)),
  );
  const backlog = [...present].filter((k) => !(k in retainedMap)).sort();
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'PROD-008: Express handlers under a crmProxies prefix. The proxy is registered first, ' +
          'so these never run in dev; production never reaches Express at all. Each is either dead ' +
          'code to delete or behaviour to port into the edge function and then delete. This list ' +
          'only shrinks — the one exception was PROD-008b teaching the scanner to see ' +
          'prefix-mounted routers, which added 131 handlers it had never been able to match. ' +
          'That was a measurement correction, not a regression.',
        retainedNote:
          'Unreachable but NOT dead: working logic with no edge counterpart and no caller, or ' +
          'behaviour PostgREST cannot express. Each entry states why. Retained entries do not ' +
          'count toward the backlog; adding one is a decision, not a default.',
        retained: retainedMap,
        allowed: backlog,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `✓ Baseline updated: ${backlog.length} in the backlog, ${Object.keys(retainedMap).length} retained.`,
  );
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${relative(repo, baselinePath)}. Run with --update-baseline first.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const retained = baseline.retained || {};
const allowed = new Set([...baseline.allowed, ...Object.keys(retained)]);
const novel = findings.filter((f) => !allowed.has(key(f)));

if (novel.length > 0) {
  console.error(`✗ ${novel.length} NEW shadowed Express handler(s):\n`);
  for (const f of novel) console.error(`  ${f.route}  ${f.file}:${f.line}  (under ${f.prefix})`);
  console.error(
    '\nThe edge-function proxy claims this prefix before any domain route registers, and\n' +
      'production never reaches Express. A handler here is dead on arrival - implement it in\n' +
      'the matching supabase/functions/ directory instead.',
  );
  process.exit(1);
}

const staleRetained = Object.keys(retained).filter((k) => !findings.some((f) => key(f) === k));
if (staleRetained.length > 0) {
  console.log(`ℹ ${staleRetained.length} retained entr(ies) no longer exist and can be dropped:`);
  for (const k of staleRetained) console.log(`    ${k}`);
}

const fixed = [...allowed].filter((a) => !findings.some((f) => key(f) === a));
if (fixed.length > 0) {
  console.log(`✓ No new shadowed handlers. ${fixed.length} baselined entr(ies) are gone:`);
  for (const f of fixed.slice(0, 10)) console.log(`    ${f}`);
  if (fixed.length > 10) console.log(`    …and ${fixed.length - 10} more`);
  console.log('  Tighten with: node scripts/check-shadowed-express.mjs --update-baseline');
} else {
  console.log(
    `✓ No new shadowed Express handlers (${baseline.allowed.length} in the backlog, ` +
      `${Object.keys(retained).length} retained).`,
  );
}
