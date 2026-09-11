import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PROD-013 / RBAC. RoleManagement's five calls were bare relative fetches, so
 * in production they resolved against the static origin and the page showed
 * nothing. Correcting the URLs was the small half; underneath were three
 * defects that a URL fix alone would have turned into wrong numbers rather than
 * no numbers.
 *
 *   1. WRONG TABLE. The list read `roles`, the global catalogue, while the
 *      /status branch beside it counts `enhanced_roles` - the tenant's own role
 *      tree, and what the Express handler reads. The page would have shown a
 *      "Total roles" tile counting one table and a list drawn from another.
 *   2. WRONG SHAPE. Both list branches answered bare arrays; the page reads
 *      `rolesData.roles`, `permissionsData.totalCount` and
 *      `permissionsData.groupedPermissions`.
 *   3. UNREACHABLE BRANCH. /roles/:id sat below a list branch that tests
 *      `endpoint === 'roles'` with no !resourceId guard, so a request for one
 *      role returned all of them, at 200.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const fn = read('supabase/functions/rbac/index.ts');
const page = read('client/src/pages/RoleManagement.tsx');

describe('the role list', () => {
  it('reads the same table the status tile counts', () => {
    const list = fn.slice(fn.indexOf("endpoint === 'roles'"));
    const listBranch = list.slice(
      list.indexOf("if (req.method === 'GET' && endpoint === 'roles') {"),
    );
    expect(listBranch.slice(0, 900)).toContain("from('enhanced_roles')");
    const status = fn.slice(fn.indexOf("endpoint === 'status'"));
    expect(status.slice(0, 600)).toContain("from('enhanced_roles')");
  });

  it('is tenant-filtered, unlike the global catalogue it used to read', () => {
    const listBranch = fn.slice(fn.indexOf("if (req.method === 'GET' && endpoint === 'roles') {"));
    expect(listBranch.slice(0, 900)).toContain("eq('tenant_id', tenantId)");
  });

  it('sends the envelope the page reads', () => {
    expect(fn).toContain('roles: roles || [],');
    expect(fn).toContain('pagination: {');
    expect(page).toContain('rolesData?.roles');
  });

  it('honours the three filters the page sends', () => {
    // They were sent on every request and read by nothing, so the controls
    // looked live and changed no rows.
    for (const param of ['search', 'department', 'organizationalTier']) {
      expect(page).toContain(`params.set('${param}'`);
      expect(fn).toContain(`url.searchParams.get('${param}')`);
    }
  });
});

describe('the single-role branch', () => {
  it('is declared before the list, so it can be reached at all', () => {
    const single = fn.indexOf("endpoint === 'roles' && resourceId");
    const list = fn.indexOf("if (req.method === 'GET' && endpoint === 'roles') {");
    expect(single).toBeGreaterThan(-1);
    expect(single).toBeLessThan(list);
  });
});

describe('the permission list', () => {
  it('sends totalCount and groupedPermissions, which the page reads', () => {
    expect(fn).toContain('{ permissions: rows, groupedPermissions, totalCount: rows.length }');
    expect(page).toContain('permissionsData?.totalCount');
    expect(page).toContain('permissionsData?.groupedPermissions');
  });
});

describe('the page', () => {
  it('makes no bare fetch call', () => {
    const code = page
      .split('\n')
      .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });
});
