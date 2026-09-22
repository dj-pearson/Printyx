/**
 * One pending-supply-orders view over three tables (WF-V-06).
 *
 * A dealer orders toner three ways and this product keeps them in three places:
 *
 *   supply_orders           toner-replenish's automatic pipeline, per MACHINE
 *                           and per colour. Raised by a prediction, not a person.
 *   device_supply_orders    a coordinator ordering against a monitored DEVICE
 *                           from the fleet screens.
 *   customer_supply_orders  the CUSTOMER's own basket in the portal, with a
 *                           delivery address and an order number.
 *
 * They are genuinely different objects, which is why this unions them for
 * READING and does not merge them: each keeps its own writer, its own screen
 * and its own lifecycle. What operations lacked was a single answer to "what is
 * outstanding", and /supply-orders answered it for one of the three while being
 * named for all of them.
 *
 * THREE STATUS VOCABULARIES, AND "pending" IS NOT THE SAME WORD IN ANY TWO.
 * supply_orders defaults to `pending_approval`, device_supply_orders to
 * `pending`, and customer_supply_orders is a PostgreSQL enum defaulting to
 * `draft`. Mapping them onto one lifecycle is a coercion, so it is done by an
 * explicit per-source table, the coercions are COUNTED, and a value no map
 * knows becomes `unknown` and is NAMED rather than folded into the nearest
 * plausible state (COP-B00's rule: a free-text column mapped into a vocabulary
 * coerces by record type and reports what it coerced).
 *
 * `draft` IS IN THE SHARED VOCABULARY ON PURPOSE. Only the portal can produce
 * one, and it is the customer's unsent basket - not something a dealer is
 * waiting to approve. Flattening it into `pending_approval` would put items
 * nobody has ordered into an operations queue.
 */

export type SupplySource = 'toner' | 'device' | 'portal';

export const SUPPLY_LIFECYCLE = [
  'draft',
  'pending_approval',
  'approved',
  'ordered',
  'shipped',
  'delivered',
  'cancelled',
  'unknown',
] as const;
export type SupplyLifecycle = (typeof SUPPLY_LIFECYCLE)[number];

/** Everything before shipped-or-done: what an operations queue is asking for. */
export const OUTSTANDING: ReadonlySet<SupplyLifecycle> = new Set<SupplyLifecycle>([
  'pending_approval',
  'approved',
  'ordered',
]);

const STATUS_MAPS: Record<SupplySource, Record<string, SupplyLifecycle>> = {
  toner: {
    pending_approval: 'pending_approval',
    approved: 'approved',
    ordered: 'ordered',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
  },
  device: {
    pending: 'pending_approval',
    approved: 'approved',
    ordered: 'ordered',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
  },
  portal: {
    // The enum's own members, mapped one for one where they line up. `submitted`
    // is the customer having sent it and nobody having accepted it yet, which is
    // the dealer's pending_approval; `confirmed` is that acceptance.
    draft: 'draft',
    submitted: 'pending_approval',
    confirmed: 'approved',
    processing: 'ordered',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
  },
};

export interface UnifiedSupplyOrder {
  id: string;
  source: SupplySource;
  status: SupplyLifecycle;
  /** What the row actually stores, so a coerced value can still be checked. */
  rawStatus: string | null;
  /** The most specific human handle each table has; never invented. */
  reference: string | null;
  description: string | null;
  quantity: number | null;
  total: number | null;
  customerId: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

type Row = Record<string, unknown>;

function mapStatus(source: SupplySource, raw: string | null) {
  if (raw === null) return { status: 'unknown' as SupplyLifecycle, coerced: true };
  const mapped = STATUS_MAPS[source][raw.trim().toLowerCase()];
  return mapped
    ? { status: mapped, coerced: false }
    : { status: 'unknown' as SupplyLifecycle, coerced: true };
}

export interface UnionResult {
  orders: UnifiedSupplyOrder[];
  /** Per source: how many rows, and which raw statuses no map knew. */
  coercions: Array<{ source: SupplySource; count: number; values: string[] }>;
  outstandingCount: number;
  /**
   * A total over rows where some carry no money column is a FLOOR, not the
   * value (COP-B05), and the caller is told which it is rather than being left
   * to assume.
   */
  outstandingValue: { total: number; isFloor: boolean; uncosted: number };
}

export function unifySupplyOrders(input: {
  toner?: Row[] | null;
  device?: Row[] | null;
  portal?: Row[] | null;
}): UnionResult {
  const orders: UnifiedSupplyOrder[] = [];
  const unknownValues: Record<SupplySource, Set<string>> = {
    toner: new Set(),
    device: new Set(),
    portal: new Set(),
  };
  const coercedCount: Record<SupplySource, number> = { toner: 0, device: 0, portal: 0 };

  const push = (
    source: SupplySource,
    row: Row,
    shaped: Omit<UnifiedSupplyOrder, 'source' | 'status' | 'rawStatus' | 'id'>,
  ) => {
    const rawStatus = str(row.status);
    const { status, coerced } = mapStatus(source, rawStatus);
    if (coerced) {
      coercedCount[source] += 1;
      unknownValues[source].add(rawStatus ?? '(null)');
    }
    orders.push({ id: String(row.id ?? ''), source, status, rawStatus, ...shaped });
  };

  for (const row of input.toner ?? []) {
    push('toner', row, {
      // A machine-and-colour order has no order number; the part number is the
      // closest real handle, and null beats a manufactured one.
      reference: str(row.part_number),
      description: [str(row.supply_name), str(row.color)].filter(Boolean).join(' ') || null,
      quantity: num(row.quantity),
      total: num(row.total_cost),
      customerId: null,
      trackingNumber: str(row.tracking_number),
      carrier: str(row.carrier),
      createdAt: str(row.created_at),
    });
  }

  for (const row of input.device ?? []) {
    push('device', row, {
      reference: str(row.product_sku),
      description: str(row.product_name) ?? str(row.supply_type),
      quantity: num(row.quantity),
      total: num(row.total_price),
      customerId: str(row.customer_id),
      // device_supply_orders carries no tracking columns at all - null says so.
      trackingNumber: null,
      carrier: null,
      createdAt: str(row.created_at),
    });
  }

  for (const row of input.portal ?? []) {
    push('portal', row, {
      reference: str(row.order_number),
      // The portal's line items live in customer_supply_order_items, which this
      // does not read, so there is no description to give.
      description: null,
      quantity: null,
      total: num(row.total),
      customerId: str(row.customer_id),
      trackingNumber: str(row.tracking_number),
      carrier: str(row.carrier),
      createdAt: str(row.created_at),
    });
  }

  // Newest first, with id as a total tiebreak so two rows created in the same
  // millisecond do not swap between requests. Undated rows sort LAST: a row with
  // no timestamp is not the newest thing in the queue.
  orders.sort((a, b) => {
    if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    if (a.createdAt === null) return 1;
    if (b.createdAt === null) return -1;
    return a.createdAt > b.createdAt ? -1 : 1;
  });

  const outstanding = orders.filter((o) => OUTSTANDING.has(o.status));
  const uncosted = outstanding.filter((o) => o.total === null).length;

  return {
    orders,
    coercions: (['toner', 'device', 'portal'] as SupplySource[])
      .filter((s) => coercedCount[s] > 0)
      .map((s) => ({ source: s, count: coercedCount[s], values: [...unknownValues[s]].sort() })),
    outstandingCount: outstanding.length,
    outstandingValue: {
      total: outstanding.reduce((sum, o) => sum + (o.total ?? 0), 0),
      isFloor: uncosted > 0,
      uncosted,
    },
  };
}
