/**
 * WF-L-02: the Equipment Lifecycle Hub's five reads and three writes.
 *
 * EquipmentLifecycleHub.tsx has called /metrics, /purchase-orders, /deliveries,
 * /installations and /assets since it was written and NEITHER host served any of
 * them - not the edge function and not
 * server/routes-equipment-lifecycle-state-machine.ts. Every list on the page was
 * empty behind a 404 and the three create dialogs posted into nothing.
 *
 * What is under test is mostly what the handlers REFUSE to invent: a null average
 * where nothing has completed, a null meter count where nothing has been read, and
 * a named error where a NOT NULL column has nothing to satisfy it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDeliveryRow,
  buildInstallationRow,
  hubAssets,
  hubMetrics,
  hubPurchaseOrders,
} from '../../../supabase/functions/equipment-lifecycle/_hub.ts';

interface Row {
  [key: string]: unknown;
}
const state: { tables: Record<string, Row[]> } = { tables: {} };

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  const ins: Array<[string, unknown[]]> = [];
  let head = false;

  const api: Record<string, unknown> = {
    select(_cols?: string, opts?: { head?: boolean }) {
      if (opts?.head) head = true;
      return api;
    },
    order: () => api,
    limit: () => api,
    eq(col: string, val: unknown) {
      eqs.push([col, val]);
      return api;
    },
    in(col: string, vals: unknown[]) {
      ins.push([col, vals]);
      return api;
    },
    then: (resolve: (v: unknown) => void) => Promise.resolve(run()).then(resolve),
  };

  function run() {
    const rows = state.tables[name] ?? [];
    const hits = rows.filter(
      (r) =>
        eqs.every(([c, v]) => String(r[c]) === String(v)) &&
        ins.every(([c, vals]) => vals.map(String).includes(String(r[c]))),
    );
    return head
      ? { data: null, count: hits.length, error: null }
      : { data: hits.map((r) => ({ ...r })), count: hits.length, error: null };
  }

  return api;
}

const db = { from: (t: string) => tableApi(t) };

describe('WF-L-02: hub metrics refuse to average nothing', () => {
  beforeEach(() => {
    state.tables = {
      equipment_lifecycle: [
        { id: 'l1', tenant_id: 't1', current_stage: 'ordered' },
        { id: 'l2', tenant_id: 't1', current_stage: 'active' },
      ],
      delivery_schedules: [{ id: 'd1', tenant_id: 't1', status: 'scheduled' }],
      installation_schedules: [],
    };
  });

  it('returns null, not zero, when no installation has completed', async () => {
    const m = await hubMetrics(db, 't1');
    expect(m.averageInstallationTime).toBeNull();
    expect(m.customerSatisfactionRating).toBeNull();
    // And says why, so a blank card is read as "not measured" rather than "zero".
    expect(m.unbacked).toHaveLength(2);
  });

  it('averages only completed installations that recorded a start and an end', async () => {
    state.tables.installation_schedules = [
      {
        id: 'i1',
        tenant_id: 't1',
        status: 'completed',
        actual_start_time: '2026-09-01T09:00:00.000Z',
        actual_end_time: '2026-09-01T12:00:00.000Z',
        customer_satisfaction_rating: 4,
      },
      // Completed but never timed, and never rated: contributes to neither average.
      { id: 'i2', tenant_id: 't1', status: 'completed' },
    ];
    const m = await hubMetrics(db, 't1');
    expect(m.averageInstallationTime).toBe(3);
    expect(m.customerSatisfactionRating).toBe(4);
    expect(m.unbacked).toEqual([]);
  });

  it('counts machines in process without counting finished ones', async () => {
    const m = await hubMetrics(db, 't1');
    expect(m.totalEquipmentInProcess).toBe(1); // 'ordered'
    expect(m.activeAssets).toBe(1); // 'active'
    expect(m.pendingDeliveries).toBe(1);
  });
});

describe('WF-L-02: derived fields the tables do not carry', () => {
  it('tallies line items per order, because PostgREST has no COUNT per group', async () => {
    state.tables = {
      purchase_orders: [{ id: 'po1', tenant_id: 't1', po_number: 'PO-1', vendor_id: 'v1' }],
      vendors: [{ id: 'v1', tenant_id: 't1', vendor_name: 'Acme Supply' }],
      purchase_order_items: [
        { id: 'a', tenant_id: 't1', purchase_order_id: 'po1' },
        { id: 'b', tenant_id: 't1', purchase_order_id: 'po1' },
      ],
    };
    const [po] = await hubPurchaseOrders(db, 't1');
    expect(po.lineItemsCount).toBe(2);
    expect(po.vendorName).toBe('Acme Supply');
  });

  it('reports the latest meter reading, and null when a machine has never been read', async () => {
    state.tables = {
      equipment: [
        { id: 'e1', tenant_id: 't1', serial_number: 'S1' },
        { id: 'e2', tenant_id: 't1', serial_number: 'S2' },
      ],
      business_records: [],
      meter_readings: [
        {
          equipment_id: 'e1',
          tenant_id: 't1',
          reading_date: '2026-09-01',
          bw_meter_reading: 5000,
          color_meter_reading: 100,
        },
        {
          equipment_id: 'e1',
          tenant_id: 't1',
          reading_date: '2026-08-01',
          bw_meter_reading: 4000,
          color_meter_reading: 50,
        },
      ],
    };
    const assets = await hubAssets(db, 't1');
    const read = assets.find((a) => a.id === 'e1');
    const unread = assets.find((a) => a.id === 'e2');

    // Newest first, so the first hit per machine is the latest.
    expect(read?.bwMeterReading).toBe(5000);
    // Null, not 0: a machine nobody has read has not printed nothing.
    expect(unread?.bwMeterReading).toBeNull();
    expect(unread?.latestReadingDate).toBeNull();
  });
});

describe('WF-L-02: writes name what a NOT NULL column needs', () => {
  it('refuses an installation with no technician rather than emitting a 23502', () => {
    const row = buildInstallationRow(
      { equipment_id: 'e1', customer_id: 'c1', scheduled_date: '2026-09-10' },
      't1',
    );
    expect(row).toEqual({ error: 'lead_technician_id is required' });
  });

  it('stores the dialog site notes in site_requirements, which is what jsonb is for', () => {
    const row = buildInstallationRow(
      {
        equipment_id: 'e1',
        customer_id: 'c1',
        lead_technician_id: 'tech1',
        scheduled_date: '2026-09-10',
        installation_location: 'Floor 2',
        power_requirements: '220v',
      },
      't1',
    ) as Record<string, unknown>;
    expect(row.technician_id).toBe('tech1');
    expect(row.site_requirements).toMatchObject({ location: 'Floor 2', power: '220v' });
  });

  it('wraps a free-text delivery address, because the column is jsonb NOT NULL', () => {
    const row = buildDeliveryRow(
      {
        equipment_id: 'e1',
        customer_id: 'c1',
        scheduled_date: '2026-09-10',
        delivery_address: '1 Main St',
      },
      't1',
    ) as Record<string, unknown>;
    expect(row.delivery_address).toEqual({ line1: '1 Main St' });
    expect(row.status).toBe('scheduled');
  });

  it('joins the dialog start and end into the one window column the table has', () => {
    const row = buildDeliveryRow(
      {
        equipment_id: 'e1',
        customer_id: 'c1',
        scheduled_date: '2026-09-10',
        delivery_address: '1 Main St',
        time_window_start: '09:00',
        time_window_end: '12:00',
      },
      't1',
    ) as Record<string, unknown>;
    expect(row.time_window).toBe('09:00-12:00');
  });
});
