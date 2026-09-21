/**
 * One pending-supply-orders view over three tables (WF-V-06).
 *
 * A dealer orders toner three ways and this product keeps them in three tables
 * with three screens and no cross-reference, while /supply-orders was named for
 * all of them and listed one. The union is read-only and maps three status
 * vocabularies onto one lifecycle - "pending" is not the same word in any two
 * of them - so the coercion is the thing to pin.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OUTSTANDING,
  SUPPLY_LIFECYCLE,
  unifySupplyOrders,
} from '../../../shared/supply-order-union';

const repo = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(repo, rel), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('three vocabularies map onto one lifecycle, and the coercion is counted', () => {
  it('each source\'s own word for "waiting on the dealer" lands in one place', () => {
    // supply_orders defaults to pending_approval, device_supply_orders to
    // pending, customer_supply_orders to an enum whose sent state is submitted.
    const { orders } = unifySupplyOrders({
      toner: [{ id: 't', status: 'pending_approval' }],
      device: [{ id: 'd', status: 'pending' }],
      portal: [{ id: 'p', status: 'submitted' }],
    });
    expect(orders.map((o) => o.status)).toEqual([
      'pending_approval',
      'pending_approval',
      'pending_approval',
    ]);
  });

  it('keeps draft separate, because only the portal can produce one', () => {
    // A draft is the customer's unsent basket, not something a dealer is
    // waiting to approve - flattening it would put items nobody ordered into
    // an operations queue.
    const { orders, outstandingCount } = unifySupplyOrders({
      portal: [{ id: 'p', status: 'draft' }],
    });
    expect(orders[0].status).toBe('draft');
    expect(OUTSTANDING.has('draft')).toBe(false);
    expect(outstandingCount).toBe(0);
  });

  it('a status no map knows becomes unknown and is NAMED', () => {
    const { orders, coercions } = unifySupplyOrders({
      device: [
        { id: 'a', status: 'awaiting_vendor' },
        { id: 'b', status: 'pending' },
      ],
    });
    expect(orders.find((o) => o.id === 'a')?.status).toBe('unknown');
    expect(coercions).toEqual([{ source: 'device', count: 1, values: ['awaiting_vendor'] }]);
  });

  it('keeps the raw status so a coerced value can still be checked', () => {
    const { orders } = unifySupplyOrders({ portal: [{ id: 'p', status: 'confirmed' }] });
    expect(orders[0]).toMatchObject({ status: 'approved', rawStatus: 'confirmed' });
  });

  it('a missing status is unknown, not the default of whichever table it came from', () => {
    const { orders, coercions } = unifySupplyOrders({ toner: [{ id: 't' }] });
    expect(orders[0].status).toBe('unknown');
    expect(coercions[0].values).toEqual(['(null)']);
  });

  it('matches case-insensitively without inventing a state', () => {
    expect(unifySupplyOrders({ device: [{ id: 'd', status: ' Shipped ' }] }).orders[0].status).toBe(
      'shipped',
    );
  });

  it('every mapped value is in the declared vocabulary', () => {
    const { orders } = unifySupplyOrders({
      toner: [{ id: '1', status: 'shipped' }],
      device: [{ id: '2', status: 'ordered' }],
      portal: [{ id: '3', status: 'delivered' }],
    });
    for (const o of orders) expect(SUPPLY_LIFECYCLE).toContain(o.status);
  });
});

describe('what each table can and cannot answer', () => {
  it("takes each source's own money column", () => {
    const { orders } = unifySupplyOrders({
      toner: [{ id: 't', status: 'shipped', total_cost: '12.50' }],
      device: [{ id: 'd', status: 'ordered', total_price: 8 }],
      portal: [{ id: 'p', status: 'processing', total: '100' }],
    });
    // A numeric comparator: the default sort is lexicographic, so [100, 12.5, 8].
    expect(orders.map((o) => o.total).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([8, 12.5, 100]);
  });

  it('answers null rather than inventing a handle the table does not have', () => {
    // A machine-and-colour order has no order number; the portal has no line
    // description without reading its items table.
    const { orders } = unifySupplyOrders({
      toner: [{ id: 't', status: 'shipped' }],
      portal: [{ id: 'p', status: 'shipped' }],
      device: [{ id: 'd', status: 'shipped' }],
    });
    const byId = Object.fromEntries(orders.map((o) => [o.id, o]));
    expect(byId.t.reference).toBeNull();
    expect(byId.p.description).toBeNull();
    // device_supply_orders carries no tracking columns at all.
    expect(byId.d.trackingNumber).toBeNull();
  });

  it('a total over uncosted rows is a FLOOR and says so', () => {
    const { outstandingValue } = unifySupplyOrders({
      device: [
        { id: 'a', status: 'pending', total_price: 40 },
        { id: 'b', status: 'pending' },
      ],
    });
    expect(outstandingValue).toEqual({ total: 40, isFloor: true, uncosted: 1 });
  });

  it('a fully costed queue is not a floor', () => {
    const { outstandingValue } = unifySupplyOrders({
      device: [{ id: 'a', status: 'pending', total_price: 40 }],
    });
    expect(outstandingValue).toEqual({ total: 40, isFloor: false, uncosted: 0 });
  });

  it('a junk money value is null rather than NaN', () => {
    const { orders } = unifySupplyOrders({
      device: [{ id: 'd', status: 'pending', total_price: 'soon' }],
    });
    expect(orders[0].total).toBeNull();
  });
});

describe('ordering is total and undated rows sort last', () => {
  it('newest first', () => {
    const { orders } = unifySupplyOrders({
      device: [
        { id: 'old', status: 'pending', created_at: '2026-01-01T00:00:00Z' },
        { id: 'new', status: 'pending', created_at: '2026-03-01T00:00:00Z' },
      ],
    });
    expect(orders.map((o) => o.id)).toEqual(['new', 'old']);
  });

  it('an undated row is not the newest thing in the queue', () => {
    const { orders } = unifySupplyOrders({
      device: [
        { id: 'undated', status: 'pending' },
        { id: 'dated', status: 'pending', created_at: '2026-01-01' },
      ],
    });
    expect(orders.map((o) => o.id)).toEqual(['dated', 'undated']);
  });

  it('two rows with the same timestamp do not swap between calls', () => {
    const rows = [
      { id: 'b', status: 'pending', created_at: '2026-01-01' },
      { id: 'a', status: 'pending', created_at: '2026-01-01' },
    ];
    expect(unifySupplyOrders({ device: rows }).orders.map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('the endpoint reads all three and degrades per source', () => {
  const EDGE = stripComments(read('supabase/functions/device-monitoring/index.ts'));

  it.each(['supply_orders', 'device_supply_orders', 'customer_supply_orders'])(
    'reads %s, tenant-filtered',
    (table) => {
      const at = EDGE.indexOf(`from('${table}')`);
      expect(at, `${table} not read`).toBeGreaterThan(-1);
      const next = EDGE.indexOf('.from(', at + 6);
      expect(EDGE.slice(at, next === -1 ? undefined : next)).toContain(
        ".eq('tenant_id', tenantId)",
      );
    },
  );

  it('a source that could not be read is named, not counted as empty', () => {
    // One missing relation must not blank an operations queue.
    expect(EDGE).toContain("degraded.push('supply_orders')");
    expect(EDGE).toContain("degraded.push('customer_supply_orders')");
    expect(EDGE).toContain('toner: toner.error ? null : (toner.data ?? [])');
  });

  it('the union is OPT-IN, so the existing shape is untouched', () => {
    expect(EDGE).toContain("url.searchParams.get('sources') === 'all'");
  });

  it('a comma-separated status list is an .in(), not an .eq()', () => {
    // The page sends `pending,approved,ordered,shipped`; `.eq()` on that whole
    // string matched nothing, so two of its four filters returned an empty
    // queue that read as "nothing outstanding".
    expect(EDGE).toContain("if (statuses.length === 1) query = query.eq('status', statuses[0]);");
    expect(EDGE).toContain("else if (statuses.length > 1) query = query.in('status', statuses);");
  });

  it('is a query parameter rather than a path segment, which an order id would shadow', () => {
    expect(EDGE).not.toContain("resourceId === 'all'");
    expect(EDGE).not.toContain("parts[1] === 'all'");
  });
});

describe('WF-V-06 AC3: the auto-supply-replenishment decision, and a test that expires it', () => {
  const unwritten = JSON.parse(read('docs/unwritten-tables-baseline.json'));
  const INPUTS = ['supply_monitoring', 'supply_replenishment_analytics', 'supply_usage_history'];

  it('its three inputs still have no writer anywhere', () => {
    // FAILS the day one gains one, which is the point: the note recording this
    // decision cannot go stale the way six others did in a single session.
    for (const table of INPUTS) {
      expect(unwritten.tables ?? unwritten.unwritten ?? [], table).toContain(table);
    }
  });

  it('the decision and its evidence are on the function somebody would open', () => {
    const fn = read('supabase/functions/auto-supply-replenishment/index.ts');
    expect(fn).toContain('WF-V-06 AC3');
    expect(fn).toMatch(/retire it: the page, this function and the three tables go TOGETHER/i);
  });

  it('the toner-replenish header says which table each order type belongs to', () => {
    const fn = read('supabase/functions/toner-replenish/index.ts');
    for (const table of ['supply_orders', 'device_supply_orders', 'customer_supply_orders']) {
      expect(fn, table).toContain(table);
    }
    expect(fn).toMatch(/"pending" is a different word in all three/);
  });
});
