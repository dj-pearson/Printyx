#!/usr/bin/env node
/**
 * SEC-EDGE-001 ratchet: an edge function must make an explicit decision about
 * role restriction — enforce one, or be recorded as open to every role in the
 * tenant.
 *
 * The gap this guards: 284 of 285 edge function directories authenticate the
 * user and resolve the tenant, then serve any authenticated member of that
 * tenant whatever their role. Tenant isolation holds — every function filters
 * by tenant_id — so this is intra-tenant privilege separation, not cross-tenant
 * exposure. The deliberate permission gates that exist were written on the
 * Express side, in handlers the edge-function proxy shadows, so they never run.
 *
 * This does NOT fix that. Fixing it is blocked on the role-system decision in
 * SEC-EDGE-002: copying the Express gates across today would export a lockout,
 * because the codes they name are not the codes any seeder creates. What this
 * does is stop the backlog growing while that decision is pending, and give the
 * inventory SEC-EDGE-001's AC4 asks for.
 *
 *   npm run check:edge-rbac            fail on a NEW ungated function
 *   npm run check:edge-rbac --list     print the classification
 *   npm run check:edge-rbac --update-baseline
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'supabase/functions';
const BASELINE = 'docs/edge-rbac-baseline.json';

// Three idioms are in use. All three count as a decision; which one is right
// for a given endpoint is the story's problem, not the ratchet's.
//
// The platform-admin one needs care, and getting it wrong is how this check
// would have quietly over-reported. `isPlatformAdmin` appears in ~30 functions
// purely to let a platform admin override the x-tenant-id header:
//
//     if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin)
//
// That is a TENANT-ISOLATION check. The function still serves every
// authenticated member of the tenant whatever their role, so counting it as a
// role restriction would report those functions as gated when nothing about
// them is. A platform-admin mention only counts when at least one of its
// occurrences is NOT part of a tenant comparison.
const PLATFORM_ADMIN =
  /isPlatformAdmin|can_access_all_tenants|requireRootAdmin|roleLevel\s*>=\s*[78]|role_level\s*>=\s*[78]/;
const TENANT_COMPARISON = /(tenant_?Id|tenant_id)\s*(!==|!=|===|==)|headerTenant|tenantFromHeader/i;

function hasRoleOnlyPlatformAdminCheck(source) {
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!PLATFORM_ADMIN.test(lines[i])) continue;
    // Reading the flag is not testing it. supabase/functions/me returns
    // `can_access_all_tenants` in its payload and gates nothing.
    if (!/if\s*\(|[!=]==|>=|&&|\|\||^\s*!/.test(lines[i])) continue;
    // The assignment that defines it is not itself a gate; look at how it is
    // USED. A window is enough — these conditions are at most a few lines.
    const window = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
    if (!TENANT_COMPARISON.test(window)) return true;
  }
  return false;
}

const SIGNALS = [
  // 1. The shared helper: JWT level check, or a DB permission lookup.
  {
    kind: 'shared-rbac',
    test: (s) => /_shared\/rbac(\.ts)?['"]|requireRoleLevel|requirePermission/.test(s),
  },
  // 2. Platform-admin only, excluding the cross-tenant override above.
  { kind: 'platform-admin', test: hasRoleOnlyPlatformAdminCheck },
  // 3. The blog functions' hybrid: a permission string off app_metadata.
  {
    kind: 'permission-string',
    test: (s) =>
      /app_metadata\??\.\s*permissions|permissions\s*\)?\s*\.includes\(\s*['"][a-z_]+\.[a-z_]+/.test(
        s,
      ),
  },
  // 4. A rejection message that names a role or a permission. Several functions
  // gate through a local helper (supabase/functions/admin has its own
  // checkAdminPermission) that none of the patterns above can see; what they do
  // have in common is what they tell the caller. 'Tenant access denied' is
  // excluded — that is the isolation check, not a role gate.
  {
    kind: 'role-rejection',
    test: (s) =>
      /insufficient permissions?|admin access required|(role|manager-level|admin-level) access required|[a-z-]+ role required|permission denied|requires? (the )?[a-z_.]+ (role|permission)/i.test(
        s,
      ),
  },
];

const skip = new Set(['_shared', 'tests', '__tests__']);
const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !skip.has(e.name))
  .map((e) => e.name)
  .sort();

function readAll(dir) {
  const out = [];
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx|js)$/.test(entry.name)) out.push(fs.readFileSync(p, 'utf8'));
    }
  })(path.join(ROOT, dir));
  return out.join('\n');
}

const gated = [];
const ungated = [];
for (const dir of dirs) {
  const source = readAll(dir);
  const kinds = SIGNALS.filter((s) => s.test(source)).map((s) => s.kind);
  if (kinds.length > 0) gated.push({ fn: dir, kinds });
  else ungated.push(dir);
}

const args = process.argv.slice(2);

if (args.includes('--list')) {
  console.log(`${dirs.length} edge function(s): ${gated.length} gated, ${ungated.length} not.\n`);
  console.log('GATED');
  for (const g of gated) console.log(`    ${g.fn}  (${g.kinds.join(', ')})`);
  console.log('\nOPEN TO EVERY ROLE IN THE TENANT');
  for (const u of ungated) console.log(`    ${u}`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE)
  ? JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  : { note: '', openToAllRoles: [] };
const allowed = new Set(baseline.openToAllRoles || []);

if (args.includes('--update-baseline')) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'SEC-EDGE-001. Edge functions that enforce NO role restriction: any authenticated ' +
          'member of the tenant may call every endpoint they serve. Tenant isolation is ' +
          'separate and holds. This list only shrinks — gate one and tighten it. A NEW edge ' +
          'function may not be added here without saying why in its review; the point of the ' +
          'ratchet is that shipping one ungated is a decision, not an oversight.',
        openToAllRoles: ungated,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${ungated.length} ungated edge function(s) recorded.`);
  process.exit(0);
}

const added = ungated.filter((u) => !allowed.has(u));
const resolved = [...allowed].filter((a) => !ungated.includes(a));

if (added.length > 0) {
  console.error(`✗ ${added.length} edge function(s) enforce no role restriction:\n`);
  for (const a of added) console.error(`    supabase/functions/${a}/`);
  console.error(
    '\n  Every authenticated member of the tenant can call these, whatever their role.\n' +
      '  Either enforce a restriction — supabase/functions/_shared/rbac.ts has\n' +
      '  requireRoleLevel for a JWT level check and requirePermission for a catalogue\n' +
      '  lookup — or record the function as deliberately open:\n' +
      '      node scripts/check-edge-rbac.mjs --update-baseline\n' +
      '  Read docs/rbac-landscape.md before choosing a permission code: the codes the\n' +
      '  Express gates name are not the codes any seeder creates (SEC-EDGE-002), so a\n' +
      '  copied gate denies everyone below platform admin.\n',
  );
  process.exit(1);
}

console.log(
  `✓ No newly ungated edge function — ${gated.length}/${dirs.length} enforce a role restriction, ` +
    `${ungated.length} recorded as open to all roles.`,
);

if (resolved.length > 0) {
  console.log(
    `\n  ${resolved.length} baselined function(s) now enforce one. Tighten the ratchet:\n` +
      '      node scripts/check-edge-rbac.mjs --update-baseline\n',
  );
  for (const r of resolved.slice(0, 20)) console.log(`    ${r}`);
}
