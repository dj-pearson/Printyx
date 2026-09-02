/**
 * Turning a receipt into equipment rows (WF-L-04).
 *
 * WF-P-02 established that a serialized line records its received quantity and
 * does NOT move bulk inventory, because its units become equipment rows - and
 * then nothing created them. POST /equipment had no caller in any client tree,
 * the Add Equipment dialog on the customer page rendered "Equipment registration
 * form would go here", and `equipment` had no link back to the order. So a
 * purchase order could be fully received and no equipment row would exist for
 * meter billing, service or the lifecycle: the spine from order to installed unit
 * had no link at all.
 *
 * Pure, like _receiving.ts. The caller owns the I/O, which is what lets a test go
 * from an approved PO to N equipment rows without touching an API.
 *
 * The Node twin of supabase/functions/purchase-orders/_serialization.ts, which is
 * the Deno copy the edge handler runs; server/tests/unit/receipt-serialization.test.ts
 * locks the two together.
 *
 * TWO RULES, each a decision:
 *
 * A SERIAL IS REQUIRED AND IS NOT GENERATED. `equipment.serial_number` is
 * globally unique and is the key every downstream system joins on. A placeholder
 * would be indistinguishable from a real one the moment it was written, so a unit
 * with no serial entered is REFUSED and named, not stored as SN-PENDING-3.
 *
 * A RECEIVED UNIT HAS NO CUSTOMER UNLESS THE ORDER DOES. Migration 0077 makes
 * equipment.customer_id nullable for exactly this: a stock purchase order carries
 * no customer, and the unit gets one when it is delivered. Guessing at the
 * tenant's largest account would put a machine on the wrong customer's tab.
 */

export interface SerialUnitInput {
  lineItemId: string;
  serialNumber: string;
  assetTag?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  locationDescription?: string | null;
}

export interface ReceiptOrderContext {
  tenantId: string;
  purchaseOrderId: string;
  /** purchase_orders.customer_id - null for a stock order, which is the norm. */
  customerId?: string | null;
  receiptDate?: string | null;
}

export interface PendingSerialLine {
  lineItemId: string;
  quantity: number;
  description?: string | null;
}

export interface SerialUnitProblem {
  lineItemId: string;
  reason: string;
  serialNumber?: string;
}

export interface SerialCapturePlan {
  /** equipment rows to insert, in the order the units were entered. */
  equipment: Record<string, unknown>[];
  /** Units that cannot be written, each with the reason. */
  problems: SerialUnitProblem[];
  /** Lines still short of serials: how many units remain uncaptured. */
  outstanding: PendingSerialLine[];
}

const trim = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

/** How many units each serialized line still needs serials for. */
export function outstandingSerialUnits(
  pending: PendingSerialLine[],
  units: SerialUnitInput[],
): PendingSerialLine[] {
  const captured = new Map<string, number>();
  for (const unit of units) {
    if (!trim(unit.serialNumber)) continue;
    captured.set(unit.lineItemId, (captured.get(unit.lineItemId) ?? 0) + 1);
  }
  return pending
    .map((line) => ({
      ...line,
      quantity: Math.max(0, line.quantity - (captured.get(line.lineItemId) ?? 0)),
    }))
    .filter((line) => line.quantity > 0);
}

export function planSerialCapture(
  pending: PendingSerialLine[],
  units: SerialUnitInput[],
  ctx: ReceiptOrderContext,
): SerialCapturePlan {
  const pendingById = new Map(pending.map((p) => [p.lineItemId, p]));
  const equipment: Record<string, unknown>[] = [];
  const problems: SerialUnitProblem[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  for (const unit of units) {
    const lineItemId = trim(unit.lineItemId);
    const serialNumber = trim(unit.serialNumber);

    if (!pendingById.has(lineItemId)) {
      problems.push({
        lineItemId,
        serialNumber: serialNumber || undefined,
        reason: 'that line is not awaiting serial numbers on this receipt',
      });
      continue;
    }
    if (!serialNumber) {
      // Never invented. See the header.
      problems.push({ lineItemId, reason: 'no serial number was entered for this unit' });
      continue;
    }
    // Cheap check for the duplicate the caller can see. The database's unique
    // index is still the authority for one already stored.
    const key = serialNumber.toLowerCase();
    if (seen.has(key)) {
      problems.push({
        lineItemId,
        serialNumber,
        reason: 'that serial number was entered twice in this receipt',
      });
      continue;
    }
    seen.add(key);

    const line = pendingById.get(lineItemId)!;
    equipment.push({
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId ?? null,
      serial_number: serialNumber,
      model_number: trim(unit.modelNumber) || null,
      manufacturer: trim(unit.manufacturer) || null,
      description: line.description ?? null,
      asset_tag: trim(unit.assetTag) || null,
      location_description: trim(unit.locationDescription) || null,
      purchase_order_id: ctx.purchaseOrderId,
      purchase_order_item_id: lineItemId,
      // Received, not installed. install_date is set when it reaches a site.
      equipment_status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  return {
    equipment,
    problems,
    outstanding: outstandingSerialUnits(pending, units),
  };
}

/**
 * The equipment_lifecycle row for a unit that has just been received.
 *
 * Stage `received` is where the lifecycle vocabulary starts once goods are
 * physically in: `ordered` is the state the PO already represented, and staged /
 * delivered / installed all come later. serial_number is NOT NULL on that table,
 * which is the same reason planSerialCapture refuses a unit without one.
 */
export function lifecycleRowForReceivedUnit(
  equipmentRow: Record<string, unknown>,
  equipmentId: string,
): Record<string, unknown> {
  return {
    tenant_id: equipmentRow.tenant_id,
    equipment_id: equipmentId,
    serial_number: equipmentRow.serial_number,
    manufacturer: equipmentRow.manufacturer ?? null,
    model: equipmentRow.model_number ?? null,
    current_stage: 'received',
    current_location: equipmentRow.location_description ?? null,
    customer_id: equipmentRow.customer_id ?? null,
    purchase_order_id: equipmentRow.purchase_order_id ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
