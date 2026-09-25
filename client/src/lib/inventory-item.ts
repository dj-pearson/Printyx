/**
 * The inventory page's view of an `inventory_items` row.
 *
 * The inventory edge function answers raw PostgREST rows (snake_case), and the
 * page read `partNumber`, `quantityOnHand`, `reorderPoint`, `unitCost` and
 * `binLocation` straight off them. Every one was undefined, so every item
 * rendered a quantity of 0, the stock check (`0 <= 0`) flagged every item
 * "Reorder needed", and searching by part number matched nothing.
 *
 * PostgREST returns numeric columns as strings, so costs are coerced; a
 * missing value stays null rather than becoming 0.
 */

export interface InventoryRow {
  id: string;
  name?: string | null;
  part_number?: string | null;
  item_category?: string | null;
  category?: string | null;
  manufacturer?: string | null;
  quantity_on_hand?: number | string | null;
  quantity_available?: number | string | null;
  reorder_point?: number | string | null;
  reorder_quantity?: number | string | null;
  unit_cost?: number | string | null;
  bin_location?: string | null;
  warehouse_location?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InventoryView {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  manufacturer: string | null;
  quantityOnHand: number | null;
  quantityAvailable: number | null;
  reorderPoint: number | null;
  unitCost: number | null;
  binLocation: string | null;
  createdAt: string;
  updatedAt: string;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function toInventoryView(row: InventoryRow): InventoryView {
  return {
    id: row.id,
    name: row.name ?? '',
    partNumber: row.part_number ?? null,
    category: row.item_category ?? row.category ?? null,
    manufacturer: row.manufacturer ?? null,
    quantityOnHand: num(row.quantity_on_hand),
    quantityAvailable: num(row.quantity_available),
    reorderPoint: num(row.reorder_point),
    unitCost: num(row.unit_cost),
    binLocation: row.bin_location ?? row.warehouse_location ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

/**
 * The stock adjustment to send for a counted quantity. The endpoint takes a
 * DELTA; a person doing a stock count knows the new total. Returns null when
 * there is nothing to send (no change, or a count that is not a whole,
 * non-negative number).
 */
export function adjustmentFor(currentOnHand: number | null, counted: string): number | null {
  const n = Number(counted);
  if (counted.trim() === '' || !Number.isInteger(n) || n < 0) return null;
  const delta = n - (currentOnHand ?? 0);
  return delta === 0 ? null : delta;
}
