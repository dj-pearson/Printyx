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
  // 1. The shared helper: JWT level check, or a permission code off the claim.
  //
  // WF-P-05 added _shared/permission-claim.ts, which answers the claim-only
  // question rather than falling through to the DB lookup _shared/rbac.ts wants a
  // hook for. It is a gate; a function using it was being reported as ungated.
  {
    kind: 'shared-rbac',
    test: (s) =>
      /_shared\/(rbac|permission-claim)(\.ts)?['"]|requireRoleLevel|requirePermission|hasPermissionClaim/.test(
        s,
      ),
  },
  // 2. Platform-admin only, excluding the cross-tenant override above.
  { kind: 'platform-admin', test: hasRoleOnlyPlatformAdminCheck },
  // 3. The blog functions' hybrid: a permission string off app_metadata.
  //
  // It must be TESTED, not merely mentioned. A bare `app_metadata?.permissions`
  // used to count, so mobile-auth - which WRITES the claim as part of WF-R-03 and
  // gates on nothing - was reported as restricted. Reading a claim is not
  // enforcing it, and this check exists to find the ones that enforce.
  {
    kind: 'permission-string',
    test: (s) =>
      /permissions\s*\)?\s*\.includes\(\s*['"][a-z_]+\.[a-z_]+/.test(s) ||
      /app_metadata\??\.\s*permissions[\s\S]{0,200}?\.(includes|some|indexOf)\(/.test(s),
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

// WF-R-04 added a third answer to "what restricts this function". A list
// endpoint every role must be able to REACH - a rep has to open /deals - cannot be
// closed with a level gate without exporting the lockout SEC-EDGE-002 warns about.
// What it can do is narrow the ROWS: _shared/scope.ts resolves the caller's tier
// from the WF-R-03 level claim and filters the query to the users they own or
// manage. That is a real restriction and reporting it as "open to every role"
// understates it, so it is classified separately rather than folded into `gated`
// (it gates no ENDPOINT) or left in `openToAllRoles` (it is not unrestricted).
const ROW_SCOPED = /_shared\/scope(\.ts)?['"]|applyUserScope|applyCustomerScope/;

const skip = new Set(['_shared', 'tests', '__tests__']);
const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !skip.has(e.name))
  .map((e) => e.name)
  .sort();

/**
 * COMMENTS ARE STRIPPED FIRST, and that is load-bearing. Signal 4 matches a
 * rejection MESSAGE, and prose describing a gate reads exactly like one: a note
 * saying a row is "required for downstream tenant/role resolution" classified
 * supabase/functions/signup - a sign-in path with no gate and no possible gate -
 * as restricted. Signal 3 has the same problem in the other direction: a function
 * that WRITES app_metadata.permissions is not one that TESTS it. This is the same
 * lesson check:edge-coverage carries in its header, applied a layer down.
 */
function stripComments(src) {
  // LINE-ORIENTED on purpose, twice over. A `/* ... */` scan over the whole file
  // matches the first `/*` inside a STRING or a regex literal and then blanks
  // everything up to the next `*/` - in monitoring-clients that swallowed the real
  // platform-admin gate and reported a correctly gated function as open. And the
  // stripping has to preserve line COUNT, because hasRoleOnlyPlatformAdminCheck
  // decides from a +/-3 line window. So: only comment lines are removed, and each
  // becomes an empty line.
  return src
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return '';
      return line;
    })
    .join('\n');
}

function readAll(dir) {
  const out = [];
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx|js)$/.test(entry.name))
        out.push(stripComments(fs.readFileSync(p, 'utf8')));
    }
  })(path.join(ROOT, dir));
  return out.join('\n');
}

const gated = [];
const rowScoped = [];
const ungated = [];
for (const dir of dirs) {
  const source = readAll(dir);
  const kinds = SIGNALS.filter((s) => s.test(source)).map((s) => s.kind);
  if (kinds.length > 0) gated.push({ fn: dir, kinds });
  else if (ROW_SCOPED.test(source)) rowScoped.push(dir);
  else ungated.push(dir);
}

const args = process.argv.slice(2);

if (args.includes('--list')) {
  console.log(
    `${dirs.length} edge function(s): ${gated.length} gated, ${rowScoped.length} row-scoped, ` +
      `${ungated.length} neither.\n`,
  );
  console.log('GATED');
  for (const g of gated) console.log(`    ${g.fn}  (${g.kinds.join(', ')})`);
  console.log('\nROW-SCOPED (reachable by every role, rows narrowed to the caller)');
  for (const r of rowScoped) console.log(`    ${r}`);
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
          'ratchet is that shipping one ungated is a decision, not an oversight. ' +
          'rowScoped is the third class WF-R-04 added: reachable by every role, but the ' +
          'ROWS are narrowed to the caller tier by _shared/scope.ts. Moving an entry ' +
          'from openToAllRoles to rowScoped is progress; moving one back is not.',
        openToAllRoles: ungated,
        rowScoped,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `✓ Baseline updated: ${ungated.length} ungated, ${rowScoped.length} row-scoped edge function(s).`,
  );
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
