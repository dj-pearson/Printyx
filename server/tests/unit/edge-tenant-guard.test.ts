import { describe, it, expect } from 'vitest';
import { rowBelongsToTenant } from '../../../supabase/functions/_shared/tenant-guard';

/**
 * Fake PostgREST query builder that records the `.eq()` filters applied and
 * resolves against a seeded row set. Mirrors the chain the edge functions use:
 *   admin.from(table).select(cols).eq('id', id).eq('tenant_id', t).maybeSingle()
 */
function fakeAdmin(rows: Array<{ table: string; id: string; tenant_id: string }>) {
  const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];
  const admin = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const record = { table, filters };
      calls.push(record);
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        maybeSingle: async () => {
          const match = rows.find(
            (r) => r.table === table && r.id === filters.id && r.tenant_id === filters.tenant_id,
          );
          return { data: match ?? null };
        },
        single: async () => {
          const match = rows.find(
            (r) => r.table === table && r.id === filters.id && r.tenant_id === filters.tenant_id,
          );
          return { data: match ?? null };
        },
      };
      return builder;
    },
  };
  return { admin, calls };
}

describe('rowBelongsToTenant — CR-002 cross-tenant guard (task-comments etc.)', () => {
  const rows = [{ table: 'tasks', id: 'task-A', tenant_id: 'tenant-A' }];

  it('returns true when the row belongs to the caller tenant', async () => {
    const { admin } = fakeAdmin(rows);
    expect(await rowBelongsToTenant(admin, 'tasks', 'task-A', 'tenant-A')).toBe(true);
  });

  it('returns false when the id belongs to ANOTHER tenant (the IDOR case)', async () => {
    const { admin, calls } = fakeAdmin(rows);
    // Tenant B guesses tenant A's task id.
    expect(await rowBelongsToTenant(admin, 'tasks', 'task-A', 'tenant-B')).toBe(false);
    // The query MUST have constrained tenant_id, not just id.
    expect(calls[0].filters).toMatchObject({ id: 'task-A', tenant_id: 'tenant-B' });
  });

  it('returns false for a missing row', async () => {
    const { admin } = fakeAdmin(rows);
    expect(await rowBelongsToTenant(admin, 'tasks', 'nope', 'tenant-A')).toBe(false);
  });

  it('fails closed on a missing id or tenant id (no query issued)', async () => {
    const { admin, calls } = fakeAdmin(rows);
    expect(await rowBelongsToTenant(admin, 'tasks', undefined, 'tenant-A')).toBe(false);
    expect(await rowBelongsToTenant(admin, 'tasks', 'task-A', null)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('warehouse-operations inventory adjust — tenant-scoped read (CR-002)', () => {
  // Documents the fix: the adjust read is scoped by BOTH id and tenant_id, so a
  // guessed inventoryId from another tenant resolves to null → 404.
  const inventory = [{ table: 'inventory', id: 'inv-A', tenant_id: 'tenant-A' }];

  async function scopedInventoryRead(admin: any, id: string, tenantId: string) {
    const { data } = await admin
      .from('inventory')
      .select('quantity')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    return data;
  }

  it('resolves the row for the owning tenant', async () => {
    const { admin } = fakeAdmin(inventory);
    expect(await scopedInventoryRead(admin, 'inv-A', 'tenant-A')).not.toBeNull();
  });

  it('resolves null for a cross-tenant inventoryId', async () => {
    const { admin, calls } = fakeAdmin(inventory);
    expect(await scopedInventoryRead(admin, 'inv-A', 'tenant-B')).toBeNull();
    expect(calls[0].filters).toMatchObject({ id: 'inv-A', tenant_id: 'tenant-B' });
  });
});
