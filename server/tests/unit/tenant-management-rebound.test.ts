import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Round 196. /admin/tenant-management read /api/admin/tenants (no handler on
 * either host) and /api/admin/tenant-stats (Express only) inside one
 * QueryStates, so it could only ever render "Could not load tenants". Its
 * Create Tenant dialog and Settings tab were unbound fields over dead buttons.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const PAGE = strip(readFileSync(join(root, 'client/src/pages/admin/TenantManagement.tsx'), 'utf8'));
const FN = strip(readFileSync(join(root, 'supabase/functions/root-admin/index.ts'), 'utf8'));
const PROXY = readFileSync(join(root, 'server/middleware/edge-function-proxy.ts'), 'utf8');

describe('TenantManagement', () => {
  it('reads endpoints that exist on both hosts', () => {
    expect(PAGE).toContain("queryKey: ['/api/root-admin/tenants']");
    expect(PAGE).toContain("queryKey: ['/api/root-admin/overview']");
    expect(PAGE).not.toContain("'/api/admin/tenants'");
    expect(PAGE).not.toContain('tenant-stats');
    expect(PROXY).toContain(
      "'/api/root-admin/tenants': { fn: 'root-admin', pathPrefix: '/tenants' }",
    );
    expect(PROXY).toContain(
      "'/api/root-admin/overview': { fn: 'root-admin', pathPrefix: '/overview' }",
    );
  });

  it('reads fields the tenants endpoint sends', () => {
    for (const f of [
      'tenant.userCount',
      'tenant.subscription',
      'tenant.lastActivity',
      'tenant.status',
    ]) {
      expect(PAGE, f).toContain(f);
    }
    for (const f of ['tenant.domain', 'tenant.plan', 'tenant.revenue', 'tenant.users}']) {
      expect(PAGE, f).not.toContain(f);
    }
  });

  it('has no dead create or settings controls', () => {
    for (const s of ['Create Tenant', 'Save Settings', 'Reset to Defaults', "|| 'Loading...'"]) {
      expect(PAGE, s).not.toContain(s);
    }
  });

  it('suspends with a confirmation and reactivates through the root-admin function', () => {
    expect(PAGE).toMatch(
      /apiRequest\(`\/api\/root-admin\/tenants\/\$\{id\}\/\$\{action\}`, 'POST'/,
    );
    const at = PAGE.indexOf("action: 'suspend' })");
    expect(PAGE.slice(Math.max(0, at - 500), at)).toContain('await confirm(');
  });
});

describe('the root-admin status branches', () => {
  it('answer 404 rather than success when no tenant matched', () => {
    for (const verb of ['suspend', 'activate']) {
      const at = FN.indexOf(`parts[2] === '${verb}'`);
      const branch = FN.slice(at, FN.indexOf('\n    }\n', at));
      expect(branch, verb).toContain(".select('id')");
      expect(branch, verb).toMatch(/data\.length === 0/);
      expect(branch, verb).toContain("'Tenant not found' }, 404");
    }
  });
});
