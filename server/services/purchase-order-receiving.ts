/**
 * Receiving a purchase order: the Node copy (WF-P-02).
 *
 * KEEP IN SYNC with supabase/functions/purchase-orders/_receiving.ts.
 * server/tests/unit/purchase-order-receiving-parity.test.ts compares the two as
 * text from `export interface ReceivableLine` onwards and fails if they drift.
 *
 * Duplicated rather than imported because nothing under server/ imports from
 * supabase/functions at runtime - the two trees ship to different hosts and have
 * different module resolution - and this repo's established answer to that is a
 * verbatim copy plus a parity test (quote-math, gpt5-prompts, ssrf, crm-list-query
 * are all the same shape).
 *
 * The rules, and why each is a decision rather than an accident, are documented on
 * the Deno copy. Read that file, not this one, and change both.
 *
 * NOTE ON ROW SHAPE: these functions take PostgREST's snake_case row keys. Drizzle
 * hands back camelCase, so the Express caller maps its rows before calling in.
 * Making the module read both casings was the alternative and it is worse: the
 * bilingual version cannot be compared as text against the Deno copy, which is the
 * only thing keeping them honest.
 */

export interface ReceivableLine {
  id: string;
  quantity: number | string | null;
  received_quantity: number | string | null;
  inventory_item_id?: string | null;
  item_description?: string | null;
}

export interface ReceiptInput {
  [key: string]: unknown;
}

export interface LineReceipt {
  lineItemId: string;
  /** Units in this receipt. Always > 0. */
  quantity: number;
  /** received_quantity to store. */
  newReceivedQuantity: number;
  ordered: number;
  inventoryItemId: string | null;
}

export interface OverReceipt {
  lineItemId: string;
  ordered: number;
  received: number;
  description: string | null;
}

export interface SerialCapture {
  lineItemId: string;
  inventoryItemId: string;
  quantity: number;
  description: string | null;
}

export interface ReceiptPlan {
  /** Lines to update, in request order, skipping anything unmatched or <= 0. */
  receipts: LineReceipt[];
  /** Lines whose stored total now exceeds what was ordered. */
  overReceipts: OverReceipt[];
  /** Ids in the request that match no line on this purchase order. */
  unknownLineItemIds: string[];
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/** The line item a receipt entry refers to, by any of the names callers send. */
export function receiptLineId(entry: ReceiptInput): string | null {
  const raw = entry.lineItemId ?? entry.line_item_id ?? entry.id;
  return raw === undefined || raw === null || raw === '' ? null : String(raw);
}

/** The quantity a receipt entry carries, by any of the names callers send. */
export function receiptQuantity(entry: ReceiptInput): number {
  return num(entry.quantityReceived ?? entry.quantity_received ?? entry.quantity, 0);
}

/**
 * Work out what a receipt does to a set of lines.
 *
 * Deliberately tolerant of a request naming a line twice: the entries accumulate
 * onto one another, because two boxes of the same part on one delivery is a
 * receipt of the sum, not of whichever entry was written last.
 */
export function planReceipt(lines: ReceivableLine[], entries: ReceiptInput[]): ReceiptPlan {
  const byId = new Map(lines.map((l) => [String(l.id), l]));
  const running = new Map<string, number>();
  const receipts: LineReceipt[] = [];
  const unknownLineItemIds: string[] = [];

  for (const entry of entries) {
    const id = receiptLineId(entry);
    const quantity = receiptQuantity(entry);
    if (!id) continue;
    if (!byId.has(id)) {
      if (!unknownLineItemIds.includes(id)) unknownLineItemIds.push(id);
      continue;
    }
    if (quantity <= 0) continue;

    const line = byId.get(id)!;
    const alreadyPlanned = running.get(id) ?? 0;
    const stored = num(line.received_quantity);
    const newReceivedQuantity = stored + alreadyPlanned + quantity;
    running.set(id, alreadyPlanned + quantity);

    const existing = receipts.find((r) => r.lineItemId === id);
    if (existing) {
      existing.quantity += quantity;
      existing.newReceivedQuantity = newReceivedQuantity;
    } else {
      receipts.push({
        lineItemId: id,
        quantity,
        newReceivedQuantity,
        ordered: num(line.quantity),
        inventoryItemId: line.inventory_item_id ?? null,
      });
    }
  }

  const overReceipts: OverReceipt[] = receipts
    .filter((r) => r.ordered > 0 && r.newReceivedQuantity > r.ordered)
    .map((r) => ({
      lineItemId: r.lineItemId,
      ordered: r.ordered,
      received: r.newReceivedQuantity,
      description: byId.get(r.lineItemId)?.item_description ?? null,
    }));

  return { receipts, overReceipts, unknownLineItemIds };
}

/**
 * The order's status once the plan is applied.
 *
 * Returns null when nothing has been received at all, which leaves the caller's
 * current status alone rather than moving an approved order backwards.
 */
export function statusAfterReceipt(
  lines: ReceivableLine[],
  receipts: LineReceipt[],
): 'received' | 'partially_received' | null {
  if (lines.length === 0) return null;

  const applied = new Map(receipts.map((r) => [r.lineItemId, r.newReceivedQuantity]));
  const totals = lines.map((line) => ({
    ordered: num(line.quantity),
    received: applied.get(String(line.id)) ?? num(line.received_quantity),
  }));

  if (totals.every((t) => t.received >= t.ordered)) return 'received';
  if (totals.some((t) => t.received > 0)) return 'partially_received';
  return null;
}

/**
 * Lines in this receipt whose stock is tracked one unit at a time.
 *
 * `serializedInventoryItemIds` is what the caller found by reading
 * inventory_items.is_serialized; a line with no inventory item cannot be
 * serialized, because there is nothing to say that it is.
 */
export function serialCaptureRequired(
  lines: ReceivableLine[],
  receipts: LineReceipt[],
  serializedInventoryItemIds: Set<string>,
): SerialCapture[] {
  const byId = new Map(lines.map((l) => [String(l.id), l]));
  return receipts
    .filter((r) => r.inventoryItemId && serializedInventoryItemIds.has(r.inventoryItemId))
    .map((r) => ({
      lineItemId: r.lineItemId,
      inventoryItemId: r.inventoryItemId!,
      quantity: r.quantity,
      description: byId.get(r.lineItemId)?.item_description ?? null,
    }));
}

/**
 * The bulk-inventory movements a receipt causes, keyed by inventory item.
 *
 * Serialized items are excluded: their units become equipment rows, and counting
 * them here as well would double them. Two lines pointing at the same inventory
 * item are summed.
 */
export function inventoryMovements(
  receipts: LineReceipt[],
  serializedInventoryItemIds: Set<string>,
): Array<{ inventoryItemId: string; quantity: number }> {
  const totals = new Map<string, number>();
  for (const r of receipts) {
    if (!r.inventoryItemId) continue;
    if (serializedInventoryItemIds.has(r.inventoryItemId)) continue;
    totals.set(r.inventoryItemId, (totals.get(r.inventoryItemId) ?? 0) + r.quantity);
  }
  return [...totals].map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }));
}

export interface PayableSource {
  id: string;
  tenant_id: string;
  vendor_id: string;
  po_number: string;
  subtotal?: unknown;
  tax_amount?: unknown;
  total_amount?: unknown;
}

/**
 * The accounts_payable row a completed receipt creates.
 *
 * WHAT THIS IS AND IS NOT: it is an EXPECTED bill, raised when the goods arrive so
 * the liability is visible before the vendor's invoice does. It is not the
 * invoice. bill_number is derived from the PO number and marked so, because
 * accounts_payable.bill_number is NOT NULL and inventing a vendor's own numbering
 * would be worse than a derived one that says where it came from; whoever enters
 * the real invoice overwrites it.
 *
 * Net 30 from the receipt date is a DEFAULT, not the vendor's terms - vendors
 * carries payment_terms as free text and nothing parses it. The caller passes
 * `dueDays` when it knows better.
 */
export function buildPayableFromReceipt(
  po: PayableSource,
  opts: { receiptDate: string; createdBy: string; dueDays?: number },
): Record<string, unknown> {
  const total = num(po.total_amount);
  const billDate = new Date(opts.receiptDate);
  const due = new Date(billDate.getTime());
  due.setDate(due.getDate() + (opts.dueDays ?? 30));

  return {
    tenant_id: po.tenant_id,
    vendor_id: po.vendor_id,
    bill_number: `${po.po_number}-RECEIPT`,
    purchase_order_id: po.id,
    purchase_order_number: po.po_number,
    bill_date: billDate.toISOString(),
    due_date: due.toISOString(),
    description: `Goods received against purchase order ${po.po_number}`,
    subtotal: num(po.subtotal),
    tax_amount: num(po.tax_amount),
    total_amount: total,
    paid_amount: 0,
    balance_amount: total,
    status: 'pending',
    created_by: opts.createdBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
