/**
 * Purchase-order line items: one place for the table name and the column
 * vocabulary (WF-P-01).
 *
 * The function wrote nineteen references to `purchase_order_line_items`, a
 * relation declared by no schema and no migration, with a column vocabulary
 * (quantity_ordered / unit_cost / total_cost / quantity_received) that belongs to
 * no table in this repository either. The real relation is `purchase_order_items`
 * — created by migration 0000 and reshaped by 0001, which is what
 * shared/schema.ts declares — and its columns are `quantity`, `unit_price`,
 * `total_price` and `received_quantity`.
 *
 * And the page did not speak the function's vocabulary either.
 * client/src/pages/PurchaseOrders.tsx posts `items: [{ itemDescription, itemCode,
 * quantity, unitPrice, totalPrice }]`; the create handler read `body.lineItems`
 * and priced each line off `item.unitCost`. So every line was dropped at 201 AND
 * the subtotal it computed from them was 0.
 *
 * Three copies of the row builder had drifted apart before this (the line-items
 * POST, the PO create, the PO update — the third already handled
 * quantity_received where the other two hardcoded 0). A rule that exists three
 * times is a rule that disagrees with itself, so it lives here once and
 * server/tests/unit/purchase-order-line-items.test.ts pins it.
 *
 * ACCEPTED INPUT is deliberately wide — the page's names, the function's
 * historical names, and the snake_case forms — because this module is what
 * finally makes the two vocabularies agree, and narrowing it would break a
 * caller that works today.
 */

export const LINE_ITEM_TABLE = 'purchase_order_items';

/**
 * Placeholder used while rows are built before their purchase order exists.
 *
 * POST /purchase-orders needs the rows to compute the subtotal it writes ON the
 * purchase order, so they are built first and their purchase_order_id is
 * overwritten with the real id at insert time. A visible sentinel beats an empty
 * string: if one ever reaches the database, the row says what went wrong.
 */
export const PENDING_PO_ID = 'pending-purchase-order';

/** Columns the receive path reads, by their real names. */
export const RECEIPT_COLUMNS = 'quantity, received_quantity, inventory_item_id';

export interface LineItemInput {
  [key: string]: unknown;
}

export interface LineItemRow {
  tenant_id: string;
  purchase_order_id: string;
  line_number: number;
  inventory_item_id: string | null;
  item_description: string;
  item_code: string | null;
  part_number: string | null;
  manufacturer_part_number: string | null;
  quantity: number;
  received_quantity: number;
  unit_of_measure: string;
  unit_price: number;
  total_price: number;
  notes: string | null;
  created_at: string;
}

/** First defined, non-empty value among the given keys. */
function pick(input: LineItemInput, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = input[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * `quantity` is `integer NOT NULL`, so a fractional value is a 22P02 from
 * PostgREST rather than a silent truncation. Rounding here keeps the failure out
 * of the database; the page already constrains the field to a whole number >= 1.
 */
function qty(value: unknown, fallback: number): number {
  return Math.round(num(value, fallback));
}

function str(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : String(value);
}

export function lineItemDescription(input: LineItemInput): string | null {
  return str(pick(input, 'itemDescription', 'item_description', 'description'));
}

/**
 * Build one `purchase_order_items` row.
 *
 * `total_price` is taken from the caller when it sends one and derived from
 * quantity x unit price otherwise. Deriving unconditionally would silently
 * discard a negotiated line total; trusting it unconditionally would let a page
 * bug write a total that does not match its own quantity and price. The caller
 * wins because the column is what the vendor is being asked to invoice.
 */
export function buildLineItemRow(
  input: LineItemInput,
  ctx: { tenantId: string; purchaseOrderId: string; lineNumber: number; now?: string },
): LineItemRow {
  const quantity = qty(pick(input, 'quantity', 'quantityOrdered', 'quantity_ordered'), 1);
  const unitPrice = num(pick(input, 'unitPrice', 'unit_price', 'unitCost', 'unit_cost'), 0);
  const explicitTotal = pick(input, 'totalPrice', 'total_price', 'totalCost', 'total_cost');

  return {
    tenant_id: ctx.tenantId,
    purchase_order_id: ctx.purchaseOrderId,
    line_number: qty(pick(input, 'lineNumber', 'line_number'), ctx.lineNumber),
    inventory_item_id: str(pick(input, 'inventoryItemId', 'inventory_item_id')),
    item_description: lineItemDescription(input) ?? '',
    item_code: str(pick(input, 'itemCode', 'item_code')),
    part_number: str(pick(input, 'partNumber', 'part_number')),
    manufacturer_part_number: str(
      pick(input, 'manufacturerPartNumber', 'manufacturer_part_number'),
    ),
    quantity,
    received_quantity: qty(
      pick(input, 'quantityReceived', 'quantity_received', 'receivedQuantity', 'received_quantity'),
      0,
    ),
    unit_of_measure: String(pick(input, 'unitOfMeasure', 'unit_of_measure') ?? 'EA'),
    unit_price: unitPrice,
    total_price:
      explicitTotal === undefined ? quantity * unitPrice : num(explicitTotal, quantity * unitPrice),
    notes: str(pick(input, 'notes')),
    // `updated_at` is NOT written: migration 0001 dropped it from this table.
    created_at: ctx.now ?? new Date().toISOString(),
  };
}

/**
 * Partial update for PATCH /purchase-orders/:id/line-items/:itemId.
 *
 * Only keys the caller actually sent are included, so a PATCH cannot blank a
 * column it said nothing about. `total_price` is recomputed by the caller when
 * quantity or unit price moved and it did not send an explicit total.
 */
export function buildLineItemPatch(body: LineItemInput): Partial<LineItemRow> {
  const patch: Partial<LineItemRow> = {};
  const has = (...keys: string[]) => keys.some((k) => body[k] !== undefined);

  if (has('lineNumber', 'line_number')) {
    patch.line_number = qty(pick(body, 'lineNumber', 'line_number'), 1);
  }
  if (has('inventoryItemId', 'inventory_item_id')) {
    patch.inventory_item_id = str(pick(body, 'inventoryItemId', 'inventory_item_id'));
  }
  if (has('itemDescription', 'item_description', 'description')) {
    patch.item_description = lineItemDescription(body) ?? '';
  }
  if (has('itemCode', 'item_code')) patch.item_code = str(pick(body, 'itemCode', 'item_code'));
  if (has('partNumber', 'part_number'))
    patch.part_number = str(pick(body, 'partNumber', 'part_number'));
  if (has('manufacturerPartNumber', 'manufacturer_part_number')) {
    patch.manufacturer_part_number = str(
      pick(body, 'manufacturerPartNumber', 'manufacturer_part_number'),
    );
  }
  if (has('quantity', 'quantityOrdered', 'quantity_ordered')) {
    patch.quantity = qty(pick(body, 'quantity', 'quantityOrdered', 'quantity_ordered'), 1);
  }
  if (has('unitOfMeasure', 'unit_of_measure')) {
    patch.unit_of_measure = String(pick(body, 'unitOfMeasure', 'unit_of_measure') ?? 'EA');
  }
  if (has('unitPrice', 'unit_price', 'unitCost', 'unit_cost')) {
    patch.unit_price = num(pick(body, 'unitPrice', 'unit_price', 'unitCost', 'unit_cost'), 0);
  }
  if (has('totalPrice', 'total_price', 'totalCost', 'total_cost')) {
    patch.total_price = num(pick(body, 'totalPrice', 'total_price', 'totalCost', 'total_cost'), 0);
  }
  if (body.notes !== undefined) patch.notes = str(body.notes);
  return patch;
}

/**
 * The lines a create or update request carries.
 *
 * `items` is what the page sends and was read by nothing; `lineItems` is what the
 * handler read and no caller sent. Both are accepted.
 */
export function lineItemsFromBody(body: Record<string, unknown>): LineItemInput[] {
  const raw = body.items ?? body.lineItems ?? body.line_items;
  return Array.isArray(raw) ? (raw as LineItemInput[]) : [];
}

/** Subtotal of a set of rows, over the real `total_price` column. */
export function lineItemsSubtotal(rows: Array<{ total_price?: unknown }>): number {
  return rows.reduce((sum, row) => sum + num(row.total_price, 0), 0);
}
