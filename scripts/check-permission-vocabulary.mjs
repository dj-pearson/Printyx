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

const HELPER = 'server/middleware/rbac-route-helper.ts';
const SEEDER = 'server/database-updater/seeders/rbac-seeder.ts';

/** Permission codes the seeder actually creates in the `permissions` table. */
function seededCodes() {
  const src = readFileSync(join(repo, SEEDER), 'utf8');
  return new Set([...src.matchAll(/code: ['"]([a-z_]+\.[a-z_.]+)['"]/g)].map((m) => m[1]));
}

/** CONSTANT_NAME -> 'dotted.code' from the PERMISSIONS object the gates use. */
function helperValues() {
  const src = readFileSync(join(repo, HELPER), 'utf8');
  const out = new Map();
  for (const m of src.matchAll(/([A-Z_]+):\s*['"]([a-z_]+\.[a-z_.]+)['"]/g)) out.set(m[1], m[2]);
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

    const viaConstant = [...gate[1].matchAll(/PERMISSIONS(?:\.[A-Z_]+)*\.([A-Z_]+)/g)]
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
findings.sort((a, b) => a.route.localeCompare(b.route) || a.file.localeCompare(b.file));

const key = (f) => `${f.route} (${f.file})`;

/**
 * --triage: for each unsatisfiable gate, is the route reachable and does the
 * frontend call it? The answer decides how urgent the fix is, and it is not
 * what you would guess. See the block printed at the end.
 */
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
          'SEC-EDGE-001: routes gated on a permission code the RBAC seeder never creates. Each ' +
          'denies every non-platform-admin. Fix by reconciling the two vocabularies - do not ' +
          'copy these gates to the edge functions, which would export the lockout.',
        allowed: [...new Set(findings.map(key))].sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${new Set(findings.map(key)).size} unsatisfiable gate(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${relative(repo, baselinePath)}. Run with --update-baseline first.`);
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).allowed);
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
