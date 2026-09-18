/**
 * Placing an approved purchase order with the manufacturer (WF-P-06).
 *
 * THE DECISION IS BUILD, NOT RETIRE. supabase/functions/manufacturer-orders is
 * 1,584 lines over six tables that migration 0000 creates, and no client tree
 * called it - the AUDIT-024 shape, and CLAUDE.md's rule for that shape is to
 * check whether you have found debt or unconnected work. This is unconnected
 * work: ordering from Canon, Ricoh or Xerox and tracking the confirmation and
 * the shipment is what a dealer's purchasing desk does all day, the schema
 * models it correctly, and manufacturer_orders.purchase_order_id was clearly
 * put there for this join. Retiring it would mean dropping six tables to avoid
 * writing a dialog.
 *
 * WHAT IS BUILT AND WHAT IS NOT, stated so the button does not over-promise.
 * The handoff is built: an approved PO becomes a manufacturer order with its
 * lines, the PO moves to `ordered`, and a confirmation or a shipment carries
 * the manufacturer's date back onto the PO. The PROVIDER DISPATCH is not - the
 * function's own /submit branch says so and persists the intent instead. For a
 * dealer ordering by portal or phone today that is the whole job: record what
 * was ordered, what came back, and when it ships. Nothing here claims an
 * EDI transmission happened.
 *
 * Pure, so the mapping is tested without a database. Every column name below is
 * from shared/manufacturer-order-schema.ts and shared/schema.ts; a name that is
 * merely plausible is a runtime 42703 on this side of the tree.
 */

export interface PurchaseOrderRow {
  id: string;
  po_number?: string | null;
  subtotal?: string | number | null;
  tax_amount?: string | number | null;
  shipping_amount?: string | number | null;
  total_amount?: string | number | null;
  expected_date?: string | null;
  delivery_address?: string | null;
  special_instructions?: string | null;
  status?: string | null;
}

export interface PurchaseOrderItemRow {
  id: string;
  line_number?: number | null;
  item_description?: string | null;
  item_code?: string | null;
  part_number?: string | null;
  manufacturer_part_number?: string | null;
  unit_of_measure?: string | null;
  inventory_item_id?: string | null;
  quantity?: number | null;
  unit_price?: string | number | null;
  total_price?: string | number | null;
  notes?: string | null;
}

/**
 * order_method is a pgEnum in shared/manufacturer-order-schema.ts, so a value
 * outside this list is a 22P02 on insert rather than a row with a odd string
 * in it. Kept here beside the mapper so the two cannot drift.
 */
export const ORDER_METHODS = ['api', 'edi', 'email', 'portal', 'manual'] as const;
export type OrderMethod = (typeof ORDER_METHODS)[number];

/** The PO statuses a manufacturer order may be placed from. */
export const PLACEABLE_PO_STATUSES = ['approved'] as const;

export function canPlace(po: PurchaseOrderRow): boolean {
  return PLACEABLE_PO_STATUSES.includes(
    String(po.status ?? '') as (typeof PLACEABLE_PO_STATUSES)[number],
  );
}

function money(value: string | number | null | undefined, fallback = '0'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : fallback;
}

/**
 * The manufacturer order row for a PO.
 *
 * order_number carries the PO number: the dealer and the manufacturer refer to
 * the same order by it, and minting a second number here would mean a phone
 * call where nobody can agree which one is being discussed.
 */
export function buildManufacturerOrder(
  po: PurchaseOrderRow,
  opts: {
    tenantId: string;
    userId: string;
    connectionId: string;
    orderMethod: string;
    requestedDeliveryDate?: string | null;
    now?: Date;
  },
): Record<string, unknown> {
  const when = (opts.now ?? new Date()).toISOString();
  return {
    tenant_id: opts.tenantId,
    connection_id: opts.connectionId,
    purchase_order_id: po.id,
    order_number: po.po_number || `PO-${po.id.slice(0, 8)}`,
    order_status: 'draft',
    order_method: opts.orderMethod,
    order_date: when,
    subtotal: money(po.subtotal),
    tax_amount: money(po.tax_amount),
    shipping_cost: money(po.shipping_amount),
    total_amount: money(po.total_amount),
    // purchase_orders.delivery_address is a single text field, so it goes to
    // ship_to_address whole rather than being split into city/state/zip by
    // guesswork - a wrong state on a shipping label is worse than a blank one.
    ship_to_address: po.delivery_address ?? null,
    requested_delivery_date: opts.requestedDeliveryDate ?? po.expected_date ?? null,
    // `special_instructions`, not `notes` - manufacturer_orders has no notes
    // column, it has special_instructions and internal_notes. The PO's
    // instructions are for the manufacturer, so they go to the former.
    special_instructions: po.special_instructions ?? null,
    created_by: opts.userId,
    created_at: when,
    updated_at: when,
  };
}

/**
 * Line items, in the PO's own order.
 *
 * product_code is NOT NULL and the PO has three candidates for it. The
 * manufacturer's own part number wins, because that is the code the
 * manufacturer will recognise; the dealer's internal item_code is the last
 * resort, and a line with none of the three is REFUSED rather than sent with a
 * placeholder - an order line nobody can fulfil is worse than a rejected order.
 */
export function buildManufacturerLineItems(
  items: PurchaseOrderItemRow[],
  opts: { tenantId: string; orderId: string; now?: Date },
): { rows: Array<Record<string, unknown>>; unfulfillable: string[] } {
  const when = (opts.now ?? new Date()).toISOString();
  const rows: Array<Record<string, unknown>> = [];
  const unfulfillable: string[] = [];

  items.forEach((item, index) => {
    const productCode = item.manufacturer_part_number || item.part_number || item.item_code || '';
    const description = item.item_description || '';
    if (!productCode || !description) {
      unfulfillable.push(item.id);
      return;
    }
    rows.push({
      tenant_id: opts.tenantId,
      order_id: opts.orderId,
      line_number: item.line_number ?? index + 1,
      product_code: productCode,
      description,
      // The manufacturer's own part number is kept in its own column as well
      // as being the preferred product_code, so a line ordered under the
      // dealer's internal code still records what the manufacturer calls it.
      manufacturer_part_number: item.manufacturer_part_number ?? null,
      quantity_ordered: Number(item.quantity ?? 0),
      // `uom`, not `unit_of_measure` - the two tables spell it differently and
      // the wrong one is a PGRST204 the first time an order is placed.
      uom: item.unit_of_measure ?? null,
      inventory_item_id: item.inventory_item_id ?? null,
      unit_price: money(item.unit_price),
      line_total: money(item.total_price),
      notes: item.notes ?? null,
      created_at: when,
      updated_at: when,
    });
  });

  return { rows, unfulfillable };
}

/**
 * What placing the order does to the PO.
 *
 * `ordered` is already in the page's own status vocabulary (it gates the
 * Receive action alongside approved and partially_received), and ordered_at /
 * ordered_by are columns nothing was writing. Receipt still moves it on to
 * partially_received or received - WF-P-02 owns that and this must not.
 */
export function purchaseOrderPlacementUpdate(userId: string, now?: Date): Record<string, unknown> {
  const when = (now ?? new Date()).toISOString();
  return {
    status: 'ordered',
    ordered_at: when,
    ordered_by: userId,
    updated_at: when,
  };
}

/**
 * The delivery date a confirmation or a shipment tells us, or null.
 *
 * NULL IS NOT "UNCHANGED AND FINE" - the caller must not write it. A
 * confirmation with no date says nothing about delivery, and overwriting the
 * PO's expected_date with null would erase the buyer's own estimate in the name
 * of an update that carried no information.
 */
export function expectedDateFrom(
  row: {
    confirmed_delivery_date?: string | null;
    estimated_delivery_date?: string | null;
    actual_delivery_date?: string | null;
  } | null,
): string | null {
  if (!row) return null;
  return (
    row.actual_delivery_date || row.confirmed_delivery_date || row.estimated_delivery_date || null
  );
}
