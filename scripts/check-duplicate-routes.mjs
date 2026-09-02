#!/usr/bin/env node
// Duplicate route-registration ratchet.
//
// Express matches the FIRST handler registered for a path, so when two files
// register the same METHOD + path, one of them silently wins and the other is
// dead code. Which one wins depends only on the order of the register*(app)
// calls in server/routes-registry.ts — invisible at both call sites.
//
// This has bitten twice, in two different ways:
//   - /api/contract-tiered-rates was registered in routes-products-crud.ts
//     (gated on PERMISSIONS.FINANCE.BILLING.CONFIGURE) and again in
//     routes-workflow-mobile.ts with NO permission check. Products-crud
//     happened to register first, so the gate held — reordering would have
//     dropped it silently.
//   - /api/security-compliance/dashboard was defined identically in
//     routes-operations-extended.ts and routes-sample-data.ts. Sample-data
//     registers first, so deleting the "obvious" copy would have left the
//     fabricated handler live.
//
// A THIRD WAY, and the reason this script now resolves mount prefixes: a router
// mounted under a prefix declares its paths WITHOUT it. server/routes/
// team-collaboration-routes.ts is mounted at the /api root and writes
// router.get('/projects'), so the old /api/-anchored pattern could not see it -
// and it registered GET /api/projects a second time, behind the real handler in
// routes-tasks.ts, with a hardcoded "Q4 Enterprise Sales Campaign". Nine
// routers mount that way and every route in all of them was invisible.
//
// Shrink the baseline, never grow it:
//   node scripts/check-duplicate-routes.mjs --update-baseline

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const serverDir = join(repo, 'server');
const registryPath = join(serverDir, 'routes-registry.ts');
const baselinePath = join(repo, 'docs', 'duplicate-routes-baseline.json');

const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

// Preserves line count so reported line numbers stay accurate. Line comments
// first: a "/*" inside a line comment would otherwise open a phantom block.
function stripComments(src) {
  return src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'tests') continue;
      walk(full, out);
    } else if (/\.ts$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Best-effort registration order: the sequence of register*(app) calls in
// routes-registry.ts, mapped back to the file each one is exported from.
function registrationOrder() {
  const order = new Map();
  if (!existsSync(registryPath)) return order;
  const registry = stripComments(readFileSync(registryPath, 'utf8'));
  const calls = [...registry.matchAll(/^\s*(register[A-Za-z0-9_]*)\s*\(\s*app/gm)].map((m) => m[1]);
  const exporters = new Map();
  for (const file of walk(serverDir)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(register[A-Za-z0-9_]*)/g)) {
      exporters.set(m[1], file);
    }
  }
  calls.forEach((name, i) => {
    const file = exporters.get(name);
    if (file && !order.has(file)) order.set(file, i);
  });
  return order;
}

// Where each router file is mounted.
//
// `app.use('/api', teamCollaborationRoutes)` means the router's own
// router.get('/projects') answers /api/projects, and nothing in the router file
// says so. Three registry forms carry that information:
//   - the asyncApiMounts table of [mountPath, modulePath] pairs
//   - the asyncRootApiMounts list, every entry mounted at '/api'
//   - a direct app.use('<prefix>', <identifier>), resolved through the file's
//     static and dynamic imports
function mountPrefixes() {
  const prefixes = new Map();
  if (!existsSync(registryPath)) return prefixes;
  const registry = stripComments(readFileSync(registryPath, 'utf8'));

  const resolve = (spec) => {
    if (!spec.startsWith('.')) return null;
    const rel = spec.replace(/^\.\//, '');
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const full = join(serverDir, rel + ext);
      if (existsSync(full)) return full;
    }
    return null;
  };

  // [mountPath, modulePath] pairs, in any *Mounts table.
  for (const m of registry.matchAll(
    /\[\s*['"`](\/api[^'"`]*)['"`]\s*,\s*['"`](\.[^'"`]+)['"`]\s*\]/g,
  )) {
    const file = resolve(m[2]);
    if (file) prefixes.set(file, m[1]);
  }

  // The root-mount list: a bare specifier inside asyncRootApiMounts.
  const rootBlock = registry.match(/asyncRootApiMounts[^=]*=\s*\[([\s\S]*?)\]/);
  if (rootBlock) {
    for (const m of rootBlock[1].matchAll(/['"`](\.[^'"`]+)['"`]/g)) {
      const file = resolve(m[1]);
      if (file) prefixes.set(file, '/api');
    }
  }

  // app.use('<prefix>', <ident>) — map the identifier back through imports.
  const identToSpec = new Map();
  for (const m of registry.matchAll(/import\s+(\w+)\s+from\s+['"`](\.[^'"`]+)['"`]/g)) {
    identToSpec.set(m[1], m[2]);
  }
  for (const m of registry.matchAll(
    /(?:const|let)\s+(\w+)\s*=\s*await\s+import\(\s*['"`](\.[^'"`]+)['"`]\s*\)/g,
  )) {
    identToSpec.set(m[1], m[2]);
  }
  for (const m of registry.matchAll(
    /app\.use\(\s*['"`](\/api[^'"`]*)['"`]\s*,\s*(\w+)(?:\.default)?\s*\)/g,
  )) {
    const spec = identToSpec.get(m[2]);
    const file = spec && resolve(spec);
    if (file && !prefixes.has(file)) prefixes.set(file, m[1]);
  }

  return prefixes;
}

// Two patterns, because a mounted router's literal has no /api prefix to anchor
// on. The unanchored one only applies to a file we know the mount point of -
// otherwise every router.get('/x') in the tree would collide with every other.
const ROUTE_RE = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`](\/api\/[^'"`]*)['"`]/g;
const MOUNTED_ROUTE_RE = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`](\/[^'"`]*)['"`]/g;

const order = registrationOrder();
const prefixes = mountPrefixes();
const byKey = new Map();

for (const file of walk(serverDir)) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const prefix = prefixes.get(file);
  const re = prefix ? MOUNTED_ROUTE_RE : ROUTE_RE;
  let m;
  while ((m = re.exec(src)) !== null) {
    // A mounted router may still write the full path (some do), so only add the
    // prefix when the literal does not already carry it.
    let path = m[2];
    if (prefix && !path.startsWith('/api/') && path !== '/api') {
      path = (prefix + path).replace(/\/+$/, '') || prefix;
    }
    if (!path.startsWith('/api')) continue;
    const key = `${m[1].toUpperCase()} ${path}`;
    const rel = file.slice(repo.length + 1).replace(/\\/g, '/');
    const line = src.slice(0, m.index).split('\n').length;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ file, rel, line });
  }
  re.lastIndex = 0;
}

// SAME-FILE duplicates count too.
//
// This used to skip them, on the reasoning that "two in one file are a
// deliberate ordering the author can see". server/routes-operations-extended.ts
// disproved that: 1,727 lines carrying SIX duplicate pairs 700 lines apart -
// GET/POST /api/commission/{metrics,structures,payments,disputes} - and the two
// copies were not variants of one handler but competing implementations over
// different tables (net_payment_amount on commission_payments in the first,
// final_payment_amount plus commission_transactions and sales_representatives in
// the second). Express matched the first and the second set never ran. Nobody
// "sees" that by reading.
const dupes = [];
for (const [key, sites] of byKey) {
  const files = [...new Set(sites.map((s) => s.rel))];
  if (sites.length < 2) continue;
  const ranked = files
    .map((rel) => {
      const site = sites.find((s) => s.rel === rel);
      return { rel, line: site.line, pos: order.has(site.file) ? order.get(site.file) : Infinity };
    })
    .sort((a, b) => a.pos - b.pos);
  // The baseline key includes the FILE SET, not just method+path. Keying on
  // method+path alone hid a whole class of regression: a third file registering
  // an already-duplicated path matched the existing entry and passed. Caught by
  // mutation-testing this script against exactly that case.
  // A same-file duplicate has one entry in `files`, so the id carries the count
  // as well - otherwise two duplicates in one file and three would share a key.
  const id =
    files.length > 1
      ? `${key} :: ${files.slice().sort().join('|')}`
      : `${key} :: ${files[0]} x${sites.length}`;
  dupes.push({ key, id, ranked });
}
dupes.sort((a, b) => a.id.localeCompare(b.id));

if (list) {
  console.log(`${dupes.length} path(s) registered in more than one file:\n`);
  for (const d of dupes) {
    console.log(`  ${d.key}`);
    d.ranked.forEach((r, i) => {
      const label = r.pos === Infinity ? 'order unknown' : i === 0 ? 'WINS' : 'shadowed';
      console.log(`      ${r.rel}:${r.line}  (${label})`);
    });
  }
  process.exit(0);
}

if (update) {
  const allowed = dupes.map((d) => d.id).sort();
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        note: 'Duplicate route-registration ratchet. scripts/check-duplicate-routes.mjs fails CI when a METHOD + /api path is newly registered in two different server files. Express matches whichever registers first (the order of register*(app) calls in routes-registry.ts), so the other copy is dead — and if the two differ in auth, validation or data source, the difference is silent. Run with --list to see which file wins each one. Shrink this list, never grow it: node scripts/check-duplicate-routes.mjs --update-baseline',
        allowed,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline updated: ${allowed.length} duplicated route(s) recorded.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`✗ Missing baseline ${baselinePath}. Create it with --update-baseline.`);
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).allowed);
const added = dupes.filter((d) => !allowed.has(d.id));
const current = new Set(dupes.map((d) => d.id));
const resolved = [...allowed].filter((k) => !current.has(k));

if (added.length > 0) {
  console.error(`✗ ${added.length} NEW duplicate route registration(s):`);
  for (const d of added) {
    console.error(`    ${d.key}`);
    d.ranked.forEach((r, i) =>
      console.error(`      ${r.rel}:${r.line}  (${i === 0 ? 'wins' : 'shadowed'})`),
    );
  }
  console.error('  Express matches only the first one registered. Remove the duplicate.');
  process.exit(1);
}

if (resolved.length > 0) {
  console.log(`✓ No new duplicate routes. ${resolved.length} baselined entr(y/ies) now resolve:`);
  for (const k of resolved) console.log(`    ${k}`);
  console.log('  Tighten with: node scripts/check-duplicate-routes.mjs --update-baseline');
} else {
  console.log(`✓ No new duplicate route registrations (${allowed.size} baselined).`);
}
