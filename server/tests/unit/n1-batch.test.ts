import { describe, it, expect } from 'vitest';
import { collectIds, indexBy, countMap } from '../../lib/n1-batch';

describe('n1-batch helpers (CR-027)', () => {
  it('collectIds returns distinct non-null keys', () => {
    const rows = [
      { roleId: 'r1' },
      { roleId: 'r2' },
      { roleId: 'r1' },
      { roleId: null },
      { roleId: undefined },
    ];
    expect(collectIds(rows, (r) => r.roleId).sort()).toEqual(['r1', 'r2']);
  });

  it('indexBy builds an O(1) lookup keyed by id (last wins)', () => {
    const rows = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
      { id: 'a', name: 'Alpha2' },
    ];
    const map = indexBy(rows, (r) => r.id);
    expect(map.get('a')?.name).toBe('Alpha2');
    expect(map.get('b')?.name).toBe('Beta');
    expect(map.get('missing')).toBeUndefined();
  });

  it('countMap coerces string counts and defaults missing keys', () => {
    const rows = [
      { technicianId: 't1', count: 3 },
      { technicianId: 't2', count: '5' }, // driver may return strings
      { technicianId: null, count: 9 },
    ];
    const map = countMap(
      rows,
      (r) => r.technicianId,
      (r) => r.count,
    );
    expect(map.get('t1')).toBe(3);
    expect(map.get('t2')).toBe(5);
    expect(map.get('t3') ?? 0).toBe(0);
    expect(map.has(null as any)).toBe(false);
  });

  it('enrichment join produces the same shape as a per-row lookup', () => {
    const users = [
      { id: 'u1', roleId: 'r1', tenantId: 't1' },
      { id: 'u2', roleId: null, tenantId: 't1' },
    ];
    const roleById = indexBy([{ id: 'r1', name: 'Admin', level: 8 }], (r) => r.id);
    const tenantById = indexBy([{ id: 't1', name: 'Acme' }], (t) => t.id);

    const enriched = users.map((u) => {
      const role = u.roleId ? roleById.get(u.roleId) : undefined;
      const tenant = u.tenantId ? tenantById.get(u.tenantId) : undefined;
      return {
        id: u.id,
        role: role?.name || 'No Role',
        roleLevel: role?.level || 1,
        tenant: tenant?.name || 'No Tenant',
      };
    });

    expect(enriched).toEqual([
      { id: 'u1', role: 'Admin', roleLevel: 8, tenant: 'Acme' },
      { id: 'u2', role: 'No Role', roleLevel: 1, tenant: 'Acme' },
    ]);
  });
});
