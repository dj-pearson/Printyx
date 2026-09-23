import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideRoleGrant } from '../../../shared/role-grant';
import { summariseUserStats } from '../../../shared/user-stats';

/**
 * Round 187. /admin/user-management and the admin function behind it.
 *
 * - Anyone past the admin gate could grant any role (invite or edit), including
 *   platform tiers and roles with can_access_all_tenants, and could edit or
 *   deactivate users above them.
 * - /api/admin/user-stats was Express-only, so in production the page's shared
 *   QueryStates showed "Could not load users"; the Express copy counted every
 *   user on the platform beside a one-tenant list.
 * - The Roles tab showed six roles with typed-in counts and three dead buttons,
 *   and Create User offered three invented tenants and did nothing.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const FN = strip(read('supabase/functions/admin/index.ts'));
const PAGE = strip(read('client/src/pages/admin/UserManagement.tsx'));

/** A branch body, bounded by the next top-level method branch. */
function branch(marker: string): string {
  const at = FN.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  const next = FN.indexOf('\n    if (', at + marker.length);
  return FN.slice(at, next === -1 ? undefined : next);
}

describe('decideRoleGrant', () => {
  const admin6 = { level: 6, canAccessAllTenants: false };
  it('allows a role at or below the granter', () => {
    expect(decideRoleGrant(admin6, { level: 6 })).toEqual({ ok: true });
    expect(decideRoleGrant(admin6, { level: 2 })).toEqual({ ok: true });
  });
  it('refuses a role above the granter', () => {
    expect(decideRoleGrant(admin6, { level: 8 })).toMatchObject({
      ok: false,
      code: 'ROLE_ABOVE_GRANTER',
    });
  });
  it('refuses a cross-tenant role to a granter without that reach, whatever the levels', () => {
    expect(decideRoleGrant(admin6, { level: 5, canAccessAllTenants: true })).toMatchObject({
      ok: false,
      code: 'CROSS_TENANT_ROLE',
    });
    expect(
      decideRoleGrant(
        { level: 8, canAccessAllTenants: true },
        { level: 8, canAccessAllTenants: true },
      ),
    ).toEqual({ ok: true });
  });
  it('refuses an unknown role and a role with no level', () => {
    expect(decideRoleGrant(admin6, null)).toMatchObject({ ok: false, code: 'UNKNOWN_ROLE' });
    expect(decideRoleGrant(admin6, { level: null })).toMatchObject({ ok: false });
  });
  it('treats a granter with no role as level 0', () => {
    expect(decideRoleGrant(null, { level: 1 })).toMatchObject({ ok: false });
  });
});

describe('the admin function applies it', () => {
  it('checks the invite role before inviteUserByEmail sends anything', () => {
    const post = branch("if (req.method === 'POST' && resource === 'users')");
    const guard = post.indexOf('refuseRoleGrant(body.roleId)');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(post.indexOf('inviteUserByEmail'));
  });

  it('checks both the new role and the target user before an edit writes', () => {
    const put = branch("resource === 'users' && resourceId) {\n      const body");
    const write = put.indexOf(".from('users')\n        .update(");
    for (const g of ['refuseActingOn(existingUser.role_id)', 'refuseRoleGrant(body.roleId)']) {
      const at = put.indexOf(g);
      expect(at, g).toBeGreaterThan(-1);
      expect(at, g).toBeLessThan(write === -1 ? put.length : write);
    }
  });

  it('checks the target user before a deactivation writes', () => {
    const del = branch("if (req.method === 'DELETE' && resource === 'users' && resourceId)");
    expect(del.indexOf('refuseActingOn(existingUser.role_id)')).toBeGreaterThan(-1);
    expect(del.indexOf('refuseActingOn(existingUser.role_id)')).toBeLessThan(
      del.indexOf('is_active: false'),
    );
  });

  it('serves user-stats scoped to the tenant', () => {
    const stats = branch("if (req.method === 'GET' && resource === 'user-stats')");
    expect(stats).toMatch(/\.eq\('tenant_id', tenantId\)/);
    expect(stats).toContain('summariseUserStats(');
  });
});

describe('summariseUserStats', () => {
  it('keeps a real zero and reports a failed count as null', () => {
    const s = summariseUserStats({
      total: 10,
      active: 10,
      suspended: 0,
      admins: null,
      newThisMonth: 2,
    });
    expect(s.suspendedUsers).toBe(0);
    expect(s.suspendedRate).toBe('0.0% of total');
    expect(s.adminUsers).toBeNull();
    expect(s.adminPercentage).toBeNull();
    expect(s.degraded).toEqual(['admins']);
    expect(s.userGrowth).toBe('+2 this month');
  });
  it('gives no rate over an empty tenant', () => {
    expect(
      summariseUserStats({ total: 0, active: 0, suspended: 0, admins: 0, newThisMonth: 0 })
        .activeRate,
    ).toBeNull();
  });
});

describe('the wiring', () => {
  const proxy = read('server/middleware/edge-function-proxy.ts');
  it('proxies user-stats and roles to the admin function', () => {
    expect(proxy).toContain("'/api/admin/user-stats': { fn: 'admin', pathPrefix: '/user-stats' }");
    expect(proxy).toContain("'/api/admin/roles': { fn: 'admin', pathPrefix: '/roles' }");
    expect(strip(read('server/routes-admin-stats.ts'))).not.toContain("'/api/admin/user-stats'");
  });
});

describe('the page', () => {
  it('has no typed-in role counts, invented tenants or loading-forever stats', () => {
    for (const s of ['423 users', '789 users', 'Acme Corporation', "|| 'Loading...'"]) {
      expect(PAGE).not.toContain(s);
    }
    expect(PAGE).not.toContain('Create Custom Role');
    expect(PAGE).not.toContain('Import Role Template');
  });
  it('reads the fields the users endpoint sends', () => {
    for (const f of ['user.isActive', 'user.roleName', 'user.teamName', 'user.lastLoginAt']) {
      expect(PAGE).toContain(f);
    }
    for (const f of ['user.status', 'user.tenant}', 'user.role}', 'user.lastLogin}']) {
      expect(PAGE).not.toContain(f);
    }
  });
  it('invites through the admin function and exports the real roles', () => {
    expect(PAGE).toMatch(/apiRequest\('\/api\/admin\/users', 'POST'/);
    expect(PAGE).toMatch(/onClick=\{\(\) =>\s*exportToCSV\(roles, ROLE_EXPORT_COLUMNS/);
  });
});
