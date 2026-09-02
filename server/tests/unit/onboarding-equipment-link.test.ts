/**
 * WF-L-09: an onboarded device must BE the equipment row.
 *
 * `onboarding_equipment.equipment_id` was nullable, unconstrained, and set only
 * when a caller already passed an id - and no caller did. A device could carry a
 * real serial, IP, hostname, MAC and install location through an entire
 * onboarding checklist and never appear in `equipment`, which is the table meter
 * reads, service tickets, contracts and toner replenishment all query. The
 * install completed and the machine was invisible to every downstream system.
 *
 * The endpoint tests below are shape assertions, deliberately: the two read paths
 * live in Deno edge functions that import supabase-js from esm.sh, so vitest
 * cannot execute them. What is asserted is the thing that actually decides
 * whether the device shows up - that the row this code writes satisfies each
 * endpoint's own filter, over the real Drizzle columns rather than a copy of
 * them. The foreign key was proven separately against PostgreSQL 16: the
 * migration applies twice, clears orphaned ids, rejects a non-row, and leaves the
 * install record standing when the machine is deleted.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import { equipment, onboardingEquipment } from '../../../shared/schema';
import {
  equipmentRowFromOnboardingDevice,
  linkOnboardingEquipment,
  onboardingLocationDescription,
  UNMAPPED_ONBOARDING_FIELDS,
  type EquipmentLinkDeps,
  type EquipmentRowLike,
} from '../../lib/onboarding-equipment-link';

const DEVICE = {
  manufacturer: 'Canon',
  model: 'imageRUNNER ADVANCE DX C5850i',
  serialNumber: 'XYZ-4471',
  assetTag: 'AT-9',
  targetIpAddress: '10.4.2.19',
  buildingLocation: 'North Tower',
  roomLocation: 'Room 214',
  specificLocation: 'beside the mailroom counter',
};

const CTX = { tenantId: 'tenant-1', customerId: 'cust-1', now: '2026-09-02T10:00:00.000Z' };

function fakeDeps(seed: EquipmentRowLike[] = []) {
  const rows = [...seed];
  const calls = { inserted: [] as Record<string, unknown>[] };
  const deps: EquipmentLinkDeps = {
    findById: async (id) => rows.find((r) => r.id === id && r.tenant_id === CTX.tenantId) ?? null,
    findBySerial: async (serial) => rows.find((r) => r.serial_number === serial) ?? null,
    insertEquipment: async (row) => {
      calls.inserted.push(row);
      const created = {
        id: `eq-${rows.length + 1}`,
        tenant_id: String(row.tenant_id),
        serial_number: (row.serial_number as string | null) ?? null,
      };
      rows.push(created);
      return created;
    },
  };
  return { deps, rows, calls };
}

describe('linking an onboarded device to equipment', () => {
  it('creates the equipment row when nothing matches', async () => {
    const { deps, calls } = fakeDeps();
    const result = await linkOnboardingEquipment(DEVICE, CTX, deps);

    expect(result).toEqual({ equipmentId: 'eq-1', action: 'created' });
    expect(calls.inserted).toHaveLength(1);
    expect(calls.inserted[0]).toMatchObject({
      tenant_id: 'tenant-1',
      customer_id: 'cust-1',
      serial_number: 'XYZ-4471',
      manufacturer: 'Canon',
      model_number: 'imageRUNNER ADVANCE DX C5850i',
      ip_address: '10.4.2.19',
      equipment_status: 'active',
    });
  });

  it('matches an existing row by serial instead of creating a duplicate', async () => {
    const { deps, calls } = fakeDeps([
      { id: 'eq-existing', tenant_id: 'tenant-1', serial_number: 'XYZ-4471' },
    ]);
    const result = await linkOnboardingEquipment(DEVICE, CTX, deps);

    expect(result).toEqual({ equipmentId: 'eq-existing', action: 'matched' });
    expect(calls.inserted).toHaveLength(0);
  });

  it('takes an explicit equipmentId, but verifies it first', async () => {
    const { deps } = fakeDeps([{ id: 'eq-7', tenant_id: 'tenant-1', serial_number: null }]);
    expect(await linkOnboardingEquipment({ ...DEVICE, equipmentId: 'eq-7' }, CTX, deps)).toEqual({
      equipmentId: 'eq-7',
      action: 'explicit',
    });

    // Unverified, this is a foreign-key violation reported to the installer as a
    // failure to add the device at all.
    const bad = await linkOnboardingEquipment({ ...DEVICE, equipmentId: 'nope' }, CTX, deps);
    expect(bad.equipmentId).toBeNull();
    expect(bad.action).toBe('skipped');
    expect(bad.reason).toContain('nope');
  });

  it('will not link or duplicate a serial registered to another tenant', async () => {
    // equipment.serial_number is UNIQUE across the whole table, not per tenant,
    // so this row can neither be linked nor re-inserted - a 23505 the installer
    // would read as a server fault.
    const { deps, calls } = fakeDeps([
      { id: 'eq-other', tenant_id: 'tenant-2', serial_number: 'XYZ-4471' },
    ]);
    const result = await linkOnboardingEquipment(DEVICE, CTX, deps);

    expect(result.equipmentId).toBeNull();
    expect(result.action).toBe('skipped');
    expect(result.reason).toContain('another tenant');
    expect(calls.inserted).toHaveLength(0);
  });

  it('refuses to invent an owner when the checklist has no customer', async () => {
    const { deps, calls } = fakeDeps();
    const result = await linkOnboardingEquipment(DEVICE, { ...CTX, customerId: '' }, deps);

    expect(result.equipmentId).toBeNull();
    expect(result.reason).toContain('no customer');
    expect(calls.inserted).toHaveLength(0);
  });

  it('creates a row for a device with no serial rather than dropping it', async () => {
    const { deps } = fakeDeps();
    const result = await linkOnboardingEquipment({ ...DEVICE, serialNumber: null }, CTX, deps);
    expect(result.action).toBe('created');
  });

  it('joins the three onboarding location fields into the one equipment records', () => {
    expect(onboardingLocationDescription(DEVICE)).toBe(
      'North Tower - Room 214 - beside the mailroom counter',
    );
    expect(onboardingLocationDescription({ roomLocation: 'Room 3' })).toBe('Room 3');
    expect(onboardingLocationDescription({})).toBeNull();
  });
});

describe('the row it writes is a real equipment row', () => {
  const columns = new Set(Object.values(getTableColumns(equipment)).map((c) => c.name));
  const row = equipmentRowFromOnboardingDevice(DEVICE, CTX);

  it('names only columns that exist', () => {
    const phantom = Object.keys(row).filter((k) => !columns.has(k));
    expect(phantom).toEqual([]);
  });

  it('fills every NOT NULL column the table has no default for', () => {
    for (const column of Object.values(getTableColumns(equipment))) {
      if (!column.notNull || column.hasDefault || column.primary) continue;
      expect(row[column.name] ?? null).not.toBeNull();
    }
  });

  it('names the onboarding fields equipment cannot hold instead of smuggling them', () => {
    expect(UNMAPPED_ONBOARDING_FIELDS).toEqual(['hostname', 'macAddress', 'networkAssignment']);
    for (const field of UNMAPPED_ONBOARDING_FIELDS) {
      expect(columns.has(field)).toBe(false);
    }
    expect(String(row.notes ?? '')).not.toContain('hostname');
  });

  it('satisfies GET /api/equipment - filtered on tenant_id, scoped by customer', () => {
    expect(row.tenant_id).toBe('tenant-1');
    expect(row.customer_id).toBe('cust-1');
    const equipmentFn = readFileSync('supabase/functions/equipment/index.ts', 'utf8');
    expect(equipmentFn).toContain("from('equipment')");
    expect(equipmentFn).toContain(".eq('tenant_id', tenantId)");
    expect(equipmentFn).toContain("applyCustomerScope(query, 'customer_id'");
  });

  it('satisfies GET /api/customers/:id/equipment - tenant_id AND customer_id', () => {
    const customersFn = readFileSync('supabase/functions/customers/index.ts', 'utf8');
    expect(customersFn).toContain("equipment: 'equipment'");
    expect(customersFn).toContain(".eq('customer_id', customerId)");
    // Which is the filter the created row must satisfy for the tab to show it.
    expect(row.customer_id).toBe(CTX.customerId);
    expect(row.tenant_id).toBe(CTX.tenantId);
  });
});

describe('both hosts link, and the column is constrained', () => {
  const strip = (src: string) =>
    src
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
      })
      .join('\n');

  it('the Node and Deno twins have identical logic', () => {
    const node = readFileSync('server/lib/onboarding-equipment-link.ts', 'utf8');
    const deno = readFileSync('supabase/functions/_shared/onboarding-equipment-link.ts', 'utf8');
    expect(strip(node)).toBe(strip(deno));
  });

  it('the edge handler calls it', () => {
    const src = strip(readFileSync('supabase/functions/onboarding/index.ts', 'utf8'));
    expect(src).toContain('linkOnboardingEquipment(');
    expect(src).toContain('equipmentData.equipment_id = link.equipmentId;');
  });

  it('the Express handler calls it - the two hosts disagreed on nothing else here', () => {
    const src = strip(readFileSync('server/routes-onboarding.ts', 'utf8'));
    expect(src).toContain('linkOnboardingEquipment(');
    expect(src).toContain('equipmentId: link.equipmentId,');
  });

  it('equipment_id gains a foreign key that survives deleting the machine', () => {
    const sql = readFileSync('drizzle/migrations/0075_onboarding_equipment_fk.sql', 'utf8');
    expect(sql).toContain('REFERENCES equipment(id) ON DELETE SET NULL');
    expect(sql).toContain('onboarding_equipment_equipment_id_fkey');
    // Orphans are cleared first, or the constraint cannot be added at all on the
    // databases that most need it.
    expect(sql).toContain('SET equipment_id = NULL');
    const journal = readFileSync('drizzle/migrations/meta/_journal.json', 'utf8');
    expect(journal).toContain('0075_onboarding_equipment_fk');
  });

  it('onboarding_equipment still declares the column the key constrains', () => {
    const columns = new Set(Object.values(getTableColumns(onboardingEquipment)).map((c) => c.name));
    expect(columns.has('equipment_id')).toBe(true);
  });
});

describe('the equipment detail can start a checklist', () => {
  const page = readFileSync('client/src/components/customer/CustomerEquipment.tsx', 'utf8');

  it('creates the checklist and adds the device already linked', () => {
    expect(page).toContain("apiRequest('/api/onboarding/checklists', 'POST'");
    expect(page).toContain('/api/onboarding/checklists/${checklistId}/equipment');
    expect(page).toContain('equipmentId: item.id');
  });

  it('opens the checklist it just made, rather than leaving the user on the dialog', () => {
    expect(page).toContain('setLocation(`/onboarding/${checklistId}`)');
  });
});
