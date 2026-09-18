#!/usr/bin/env node
/**
 * check-permission-vocabulary.mjs — SEC-EDGE-001 ratchet.
 *
 * A route gated on a permission code that no role can hold denies everyone
 * except platform admins, silently and forever. That is the state of most of
 * this codebase's RBAC gates: there are TWO permission vocabularies.
 *
 *   server/middleware/rbac-route-helper.ts exports a PERMISSIONS constant that
 *   the route gates reference - inventory.item.view, sales.lead.update_own, and
 *   so on.
 *
 *   server/database-updater/seeders/rbac-seeder.ts seeds the `permissions`
 *   table, which is what PermissionComputationService reads to build
 *   req.user.permissions. It spells the same ideas differently -
 *   operations.inventory.view rather than inventory.item.view - and only about
 *   a third of the two sets overlap.
 *
 * So requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]) is unsatisfiable: no
 * seeded role carries that code. Platform admins pass on the hasAllPermissions
 * bypass; everyone else gets a 403. The feature is admin-only and nothing says
 * so.
 *
 * This matters most where the gate is about to be COPIED. SEC-EDGE-001 proposes
 * adding these gates to the edge functions, which serve production - doing that
 * with an unsatisfiable code would export the lockout rather than close a hole.
 *
 * Usage:
 *   node scripts/check-permission-vocabulary.mjs
 *   node scripts/check-permission-vocabulary.mjs --update-baseline
 *   node scripts/check-permission-vocabulary.mjs --list
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const baselinePath = join(repo, 'docs', 'permission-vocabulary-baseline.json');
const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');
const triage = process.argv.includes('--triage');
const vocab = process.argv.includes('--vocabularies');

const HELPER = 'server/middleware/rbac-route-helper.ts';
const SEEDER = 'server/database-updater/seeders/rbac-seeder.ts';
// The seeder rbac-initializer.ts runs for a NEW TENANT. It is not the one
// `npm run seed:rbac` invokes, and it uses a third vocabulary again.
const TENANT_SEEDER = 'server/enhanced-rbac-seeder.ts';

/** Permission codes the seeder actually creates in the `permissions` table. */
function seededCodes() {
  const src = readFileSync(join(repo, SEEDER), 'utf8');
  return new Set([...src.matchAll(/code: ['"]([a-z_]+\.[a-z_.]+)['"]/g)].map((m) => m[1]));
}

/**
 * 'INVENTORY.ITEM.CREATE' -> 'inventory.item.create', from the PERMISSIONS
 * object the gates use.
 *
 * KEYED ON THE FULL PATH, and that is the whole point. This function used to key
 * on the LEAF name alone - `CREATE`, `VIEW`, `UPDATE`, `DELETE` - so every
 * module's CREATE overwrote the previous one and the map held whichever came
 * last in the file. `PERMISSIONS.INVENTORY.ITEM.CREATE` therefore resolved to
 * `platform.tenant.create`, and the guard reported "creating a product model
 * requires permission to create a TENANT" for fifty routes whose gates were
 * nothing of the kind. A permission guard that names the wrong permission is
 * worse than no guard: the baseline it produced was a list of defects that were
 * not there, and the obvious fix - rewriting those gates - would have replaced
 * working ones.
 *
 * The parse is a small brace walk rather than a regex, because the nesting IS
 * the key. Depth is tracked from the PERMISSIONS declaration so keys outside it
 * cannot leak in.
 */
function helperValues() {
  const src = readFileSync(join(repo, HELPER), 'utf8');
  const start = src.indexOf('PERMISSIONS = {');
  const out = new Map();
  if (start === -1) return out;

  const path = [];
  let depth = 0;
  for (const rawLine of src.slice(start).split('\n')) {
    const line = rawLine.replace(/\/\/.*$/, '');
    const leaf = /^\s*([A-Z][A-Z0-9_]*):\s*['"]([a-z_]+\.[a-z_.]+)['"]/.exec(line);
    if (leaf) {
      out.set([...path, leaf[1]].join('.'), leaf[2]);
      continue;
    }
    const group = /^\s*([A-Z][A-Z0-9_]*):\s*\{/.exec(line);
    if (group) {
      path.push(group[1]);
      depth++;
      continue;
    }
    // A closing brace at the start of a line ends the innermost group. The
    // PERMISSIONS object itself closes when the path is empty, which is where
    // the walk stops - anything after it belongs to another declaration.
    if (/^\s*\}/.test(line)) {
      if (path.length === 0) break;
      path.pop();
      depth--;
    }
  }
  return out;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'tests') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const seeded = seededCodes();
const values = helperValues();
const findings = [];

for (const file of walk(join(repo, 'server'))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let route = null;
  let routeLine = 0;
  for (let i = 0; i < lines.length; i++) {
    // Route registrations are often multi-line: the verb on one line, the path
    // on the next. Track the most recent one and attach gates to it.
    const verb = /(?:app|router)\.(get|post|put|patch|delete)\(/.exec(lines[i]);
    if (verb) {
      const path = /'(\/api\/[^']+)'/.exec(lines[i]) || /'(\/api\/[^']+)'/.exec(lines[i + 1] ?? '');
      if (path) {
        route = `${verb[1].toUpperCase()} ${path[1]}`;
        routeLine = i + 1;
      }
    }
    const gate = /(?:requirePermission|can)\(\s*\[([^\]]*)\]/.exec(lines[i]);
    if (!gate || !route) continue;

    // The FULL path after PERMISSIONS., so INVENTORY.ITEM.CREATE and
    // PLATFORM.TENANT.CREATE are different keys rather than both being CREATE.
    const viaConstant = [...gate[1].matchAll(/PERMISSIONS\.((?:[A-Z0-9_]+\.)*[A-Z0-9_]+)/g)]
      .map((m) => values.get(m[1]))
      .filter(Boolean);
    const viaLiteral = [...gate[1].matchAll(/'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]);
    const required = [...new Set([...viaConstant, ...viaLiteral])];
    if (required.length === 0) continue;

    // ANY of the listed permissions satisfies the gate, so it is only
    // unsatisfiable when NONE of them is seeded.
    if (required.some((p) => seeded.has(p))) continue;

    findings.push({
      route,
      file: relative(repo, file).replace(/\\/g, '/'),
      line: routeLine,
      required,
    });
  }
}
/**
 * The NAVIGATION side (SEC-EDGE-001).
 *
 * client/src/lib/navigation-permissions.ts decides what a user can SEE, and it
 * speaks the same permission codes the route gates do - so it has the same
 * failure mode and nothing was checking it. Nine entries named
 * `admin.settings.view` / `admin.settings.update`, neither of which the seeder
 * created, so /settings itself was invisible to every role below platform
 * admin. A user who cannot see the page never reports that it is missing.
 *
 * An entry is a finding only when NONE of its codes is seeded, matching the
 * route rule: the gate passes on any one of them.
 */
const NAV = 'client/src/lib/navigation-permissions.ts';
if (existsSync(join(repo, NAV))) {
  const nav = readFileSync(join(repo, NAV), 'utf8');
  const lineOf = (index) => nav.slice(0, index).split('\n').length;
  for (const entry of nav.matchAll(/'(\/[^']*)': \{([\s\S]*?)\n  \}/g)) {
    const [, path, block] = entry;
    const required = [...new Set([...block.matchAll(/'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]))];
    if (required.length === 0) continue;
    if (required.some((p) => seeded.has(p))) continue;
    findings.push({ route: `NAV ${path}`, file: NAV, line: lineOf(entry.index), required });
  }
}

findings.sort((a, b) => a.route.localeCompare(b.route) || a.file.localeCompare(b.file));

const key = (f) => `${f.route} (${f.file})`;

/**
 * --triage: for each unsatisfiable gate, is the route reachable and does the
 * frontend call it? The answer decides how urgent the fix is, and it is not
 * what you would guess. See the block printed at the end.
 */
/**
 * --vocabularies: the three permission namespaces and how little they overlap.
 * This is the root cause of every unsatisfiable gate, and it is derivable from
 * the repo alone - no database needed.
 */
if (vocab) {
  const codes = (file, re) =>
    new Set([...readFileSync(join(repo, file), 'utf8').matchAll(re)].map((m) => m[1]));
  const gates = codes(HELPER, /[A-Z_]+:\s*['"]([a-z_]+\.[a-z_.]+)['"]/g);
  const seedCmd = codes(SEEDER, /code: ['"]([a-z_]+\.[a-z_.]+)['"]/g);
  const tenantInit = codes(TENANT_SEEDER, /code: ['"]([a-z_.]+)['"]/g);
  const shared = (a, b) => [...a].filter((x) => b.has(x)).length;

  console.log('Permission vocabularies:');
  console.log(`  route gates       ${String(gates.size).padStart(4)}  ${HELPER}`);
  console.log(`  npm run seed:rbac ${String(seedCmd.size).padStart(4)}  ${SEEDER}`);
  console.log(`  new-tenant init   ${String(tenantInit.size).padStart(4)}  ${TENANT_SEEDER}`);
  console.log('');
  console.log(`  gates that seed:rbac can satisfy:      ${shared(gates, seedCmd)}`);
  console.log(`  gates that new-tenant init satisfies:  ${shared(gates, tenantInit)}`);
  console.log(`  overlap between the two seeders:       ${shared(seedCmd, tenantInit)}`);
  console.log('');
  console.log('  rbac-initializer.ts is what runs for a new tenant, so that last');
  console.log('  column is the one a real customer gets.');
  process.exit(0);
}

if (triage) {
  const proxySrc = readFileSync(join(repo, 'server/middleware/edge-function-proxy.ts'), 'utf8');
  const block = proxySrc.slice(
    proxySrc.indexOf('const crmProxies'),
    proxySrc.indexOf('for (const [prefix, functionName]'),
  );
  const proxied = [...block.matchAll(/'(\/api\/[^']+)':/g)].map((m) => m[1]);

  function walkClient(dir, out = []) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walkClient(full, out);
      else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
    }
    return out;
  }
  let frontend = '';
  for (const f of walkClient(join(repo, 'client', 'src'))) frontend += readFileSync(f, 'utf8');

  const rows = findings.map((f) => {
    const path = f.route.split(' ')[1];
    const isProxied = proxied.some((p) => path === p || path.startsWith(p + '/'));
    // Strip :params and look for the static prefix in the client bundle.
    const probe =
      '/' +
      path
        .replace(/:[A-Za-z0-9_]+/g, '')
        .split('/')
        .filter(Boolean)
        .join('/');
    return { ...f, proxied: isProxied, called: frontend.includes(probe) };
  });

  const live = rows.filter((r) => !r.proxied);
  const liveCalled = live.filter((r) => r.called);
  const edgeDirs = new Set(readdirSync(join(repo, 'supabase', 'functions')));
  const withEdgeFn = liveCalled.filter((r) => edgeDirs.has(r.route.split(' ')[1].split('/')[2]));

  console.log(`unsatisfiable gates: ${rows.length}`);
  console.log(`  shadowed by the proxy (never run either way): ${rows.length - live.length}`);
  console.log(`  live on Express: ${live.length}`);
  console.log(`    ...and called by the frontend: ${liveCalled.length}`);
  console.log(`    ...of which the prefix ALSO has an edge function: ${withEdgeFn.length}`);
  console.log('');
  for (const r of liveCalled) console.log(`  ${r.route}  needs ${r.required.join(' OR ')}`);
  process.exit(0);
}

if (list) {
  for (const f of findings) {
    console.log(`  ${f.route}\n      needs ${f.required.join(' OR ')}\n      ${f.file}:${f.line}`);
  }
  console.log(`\n${findings.length} gate(s) on a permission no seeded role can hold.`);
  console.log(
    `Seeded codes: ${seeded.size}. Codes named by the PERMISSIONS constant: ${values.size}.`,
  );
  process.exit(0);
}

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'SEC-EDGE-002 drove this to 0 and the guard is a HARD GATE - it now refuses to run ' +
          'against a non-empty list. A route gated on a code the RBAC seeder never creates ' +
          'denies every role below platform admin. Fix one by naming a code the seeder ' +
          'creates, or by adding the code to rbac-seeder.ts AND granting it to a role. Do not ' +
          'copy such a gate to an edge function, which would export the lockout to production.',
        allowed: [...new Set(findings.map(key))].sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${new Set(findings.map(key)).size} unsatisfiable gate(s).`);
  process.exit(0);
}

/**
 * HARD GATE since SEC-EDGE-002 closed (AC9). The backlog is 0, so the baseline
 * is kept only to make a regression legible - a new finding names itself against
 * an empty list rather than against nothing. It must stay empty: an entry here
 * is a route that denies every role below platform admin, and the two ways to
 * fix one are to name a code the seeder creates or to add the code to the
 * seeder AND grant it to a role. Adding it to the baseline is not a third way.
 */
if (!existsSync(baselinePath)) {
  console.error(`Missing ${relative(repo, baselinePath)}. Run with --update-baseline first.`);
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).allowed);
if (allowed.size > 0) {
  console.error(
    `✗ ${relative(repo, baselinePath)} is not empty. This guard is a hard gate: fix the ` +
      `${allowed.size} entr(ies) rather than baselining them.`,
  );
  process.exit(1);
}
const novel = findings.filter((f) => !allowed.has(key(f)));

if (novel.length > 0) {
  console.error(`✗ ${novel.length} NEW gate(s) on an unsatisfiable permission:\n`);
  for (const f of novel) {
    console.error(`  ${f.route}  needs ${f.required.join(' OR ')}  ${f.file}:${f.line}`);
  }
  console.error(
    '\nNo seeded role holds this code, so the gate denies everyone except platform admins.\n' +
      'Use a code the seeder creates (see rbac-seeder.ts), or add it to the seeder.',
  );
  process.exit(1);
}

const fixed = [...allowed].filter((a) => !findings.some((f) => key(f) === a));
if (fixed.length > 0) {
  console.log(`✓ No new unsatisfiable gates. ${fixed.length} baselined entr(ies) now resolve:`);
  for (const f of fixed.slice(0, 10)) console.log(`    ${f}`);
  if (fixed.length > 10) console.log(`    …and ${fixed.length - 10} more`);
  console.log('  Tighten with: node scripts/check-permission-vocabulary.mjs --update-baseline');
} else {
  console.log(`✓ No new unsatisfiable permission gates (${allowed.size} known).`);
}
