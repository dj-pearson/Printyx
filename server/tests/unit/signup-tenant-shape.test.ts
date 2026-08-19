// COP-M01: the signup edge function inserted thirteen columns into `tenants`
// that the table does not have, so the insert failed and NOBODY COULD SIGN UP —
// every attempt came back "Failed to create organization". It then tried to
// INSERT a per-tenant row into `roles`, which is a global table with no
// tenant_id at all.
//
// This pins the table shapes the signup flow depends on, and reads the handler
// to confirm it writes only real columns. It is a schema assertion rather than a
// handler test because the handler needs a live Supabase to run, and what broke
// was its picture of the schema.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';

import { roles, tenants, users } from '@shared/schema';

const source = readFileSync(join(process.cwd(), 'supabase/functions/signup/index.ts'), 'utf-8');

const columnsOf = (table: any) =>
  new Set(Object.values(getTableColumns(table) as any).map((c: any) => c.name));

const tenantColumns = columnsOf(tenants);
const roleColumns = columnsOf(roles);
const userColumns = columnsOf(users);

/**
 * Top-level keys of the object passed to `.from('<table>').insert({…})`.
 *
 * Nested keys are excluded on purpose: the company profile now lives INSIDE
 * `metadata`, where a key is a jsonb field rather than a column.
 */
function insertKeys(table: string): string[] {
  const marker = `from('${table}').insert({`;
  const at = source.indexOf(marker);
  if (at === -1) return [];
  const start = at + marker.length - 1;
  let depth = 0;
  let end = start;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(start + 1, end);
  const keys: string[] = [];
  let nest = 0;
  for (const m of body.matchAll(/([{}]|(?:^|[,\n])\s*([a-z_][a-z0-9_]*)\s*:)/g)) {
    if (m[1] === '{') nest++;
    else if (m[1] === '}') nest--;
    else if (m[2] && nest === 0) keys.push(m[2]);
  }
  return keys;
}

describe('the tenants insert', () => {
  it('writes only real columns', () => {
    const keys = insertKeys('tenants');
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(tenantColumns.has(key)).toBe(true);
  });

  it.each(['id', 'name', 'slug', 'is_active', 'plan', 'billing_status', 'metadata'])(
    'still writes %s',
    (column) => {
      expect(tenantColumns.has(column)).toBe(true);
      expect(insertKeys('tenants')).toContain(column);
    },
  );

  it.each([
    'industry',
    'company_size',
    'website',
    'address',
    'city',
    'state',
    'zip',
    'country',
    'timezone',
    'plan_slug',
    'billing_cycle',
    'status',
    'trial_ends_at',
  ])('no longer writes %s, which is not a column', (column) => {
    expect(tenantColumns.has(column)).toBe(false);
    expect(insertKeys('tenants')).not.toContain(column);
  });
});

describe('roles is global', () => {
  it('has no tenant_id, is_system or updated_at', () => {
    expect(roleColumns.has('tenant_id')).toBe(false);
    expect(roleColumns.has('is_system')).toBe(false);
    expect(roleColumns.has('updated_at')).toBe(false);
  });

  it('has the columns the lookup relies on', () => {
    expect(roleColumns.has('code')).toBe(true);
    expect(roleColumns.has('is_system_role')).toBe(true);
    expect(roleColumns.has('level')).toBe(true);
  });

  it('signup resolves the seeded admin role instead of inserting one', () => {
    expect(source).toContain('COMPANY_ADMIN');
    expect(source).not.toMatch(/from\('roles'\)\s*\.insert/);
  });

  it('reports a missing admin role rather than half-provisioning a tenant', () => {
    expect(source).toContain('MISSING_ADMIN_ROLE');
  });
});

describe('the users insert', () => {
  // PA-001 already moved these into metadata; the same pattern now covers
  // tenants, so this guards either one regressing.
  it('writes only real columns', () => {
    const keys = insertKeys('users');
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(userColumns.has(key)).toBe(true);
  });

  it.each(['full_name', 'status', 'is_tenant_admin', 'phone'])(
    '%s is not a column and is not written',
    (column) => {
      expect(userColumns.has(column)).toBe(false);
      expect(insertKeys('users')).not.toContain(column);
    },
  );
});
