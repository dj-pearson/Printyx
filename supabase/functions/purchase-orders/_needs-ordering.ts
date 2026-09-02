/**
 * "What did we sell that nobody has ordered?" (WF-P-04).
 *
 * No page answered it. A buyer hunted through Contracts, and the Book Order
 * button there navigated to /purchase-orders?contractId= where WF-P-03 made the
 * id stick - but nothing told anyone which contracts still needed one. A deal
 * could close, a contract could go active, and the equipment could sit unordered
 * until a customer asked where it was.
 *
 * Pure, like _receiving.ts and _serialization.ts. The caller does the IO.
 *
 * THREE RULES, each a decision:
 *
 * A CONTRACT LEAVES THE QUEUE ON ANY PURCHASE ORDER, INCLUDING A CANCELLED ONE.
 * The queue asks "has anyone acted on this", and a cancelled order is somebody
 * having acted and changed their mind - putting the contract back would send a
 * second buyer to re-order what a first deliberately stopped. The cancelled
 * order is NAMED on the row instead, so nothing disappears silently.
 *
 * ONLY SELLABLE LINES ARE ORDERED. A proposal carries labour, services and
 * recurring charges alongside the machines; raising a purchase order for a
 * monthly service fee would send a vendor an order for something no vendor
 * supplies. Equipment, accessories and supplies come through, and everything
 * else is reported in `notOrderable` rather than dropped.
 *
 * A VENDOR IS SUGGESTED, NEVER GUESSED. inventory_items.primary_vendor is FREE
 * TEXT, not a foreign key, so it resolves to a vendors row only when the names
 * match. When it does not, the line comes through with no vendor and says so; a
 * purchase order raised against the wrong vendor is worse than one the buyer has
 * to pick a vendor for.
 */

export interface ContractRow {
  id: string;
  contract_number?: string | null;
  customer_id: string;
  status?: string | null;
  start_date?: string | null;
  proposal_id?: string | null;
  deal_id?: string | null;
  acquisition_type?: string | null;
}

export interface PurchaseOrderRef {
  id: string;
  po_number?: string | null;
  status?: string | null;
  source_contract_id?: string | null;
}

export interface ProposalLine {
  id: string;
  proposal_id: string;
  line_number?: number | null;
  item_type?: string | null;
  product_id?: string | null;
  product_code?: string | null;
  product_name: string;
  description?: string | null;
  quantity?: number | null;
  unit_cost?: string | number | null;
  unit_price?: string | number | null;
  is_recurring?: boolean | null;
}

export interface InventoryRef {
  id: string;
  part_number?: string | null;
  manufacturer_part_number?: string | null;
  primary_vendor?: string | null;
  unit_of_measure?: string | null;
}

export interface VendorRef {
  id: string;
  vendor_name?: string | null;
}

/** Contract statuses that mean the customer has committed. */
export const ORDERABLE_CONTRACT_STATUSES = ['active', 'signed', 'pending_installation'];

/** Line types a vendor can actually supply. */
export const ORDERABLE_ITEM_TYPES = ['equipment', 'accessory', 'supply', 'part'];

const num = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) ? n : fallback;
};

const norm = (value: unknown): string =>
  typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
    : '';

export interface OrderableLine {
  proposalLineId: string;
  lineNumber: number;
  itemDescription: string;
  itemCode: string | null;
  inventoryItemId: string | null;
  partNumber: string | null;
  manufacturerPartNumber: string | null;
  unitOfMeasure: string;
  quantity: number;
  /** Dealer cost where the proposal recorded one - what a PO is raised at. */
  unitPrice: number;
  totalPrice: number;
  vendorId: string | null;
  vendorName: string | null;
}

export interface NotOrderableLine {
  proposalLineId: string;
  productName: string;
  reason: string;
}

export interface NeedsOrderingRow {
  contractId: string;
  contractNumber: string | null;
  customerId: string;
  customerName: string | null;
  status: string | null;
  startDate: string | null;
  proposalId: string | null;
  dealId: string | null;
  acquisitionType: string | null;
  lines: OrderableLine[];
  notOrderable: NotOrderableLine[];
  /** Sum of the orderable lines at dealer cost. */
  estimatedCost: number;
  /** The single vendor when every orderable line resolves to the same one. */
  suggestedVendorId: string | null;
}

/**
 * Which sold contracts have no purchase order.
 *
 * `orderedContractIds` is derived from the caller's purchase_orders read, which
 * is why a cancelled order still counts - see the header.
 */
export function contractsNeedingOrders(
  contracts: ContractRow[],
  purchaseOrders: PurchaseOrderRef[],
): { needing: ContractRow[]; alreadyOrdered: Map<string, PurchaseOrderRef[]> } {
  const byContract = new Map<string, PurchaseOrderRef[]>();
  for (const po of purchaseOrders) {
    const key = po.source_contract_id ? String(po.source_contract_id) : null;
    if (!key) continue;
    byContract.set(key, [...(byContract.get(key) ?? []), po]);
  }
  return {
    needing: contracts.filter(
      (c) =>
        ORDERABLE_CONTRACT_STATUSES.includes(String(c.status ?? '').toLowerCase()) &&
        !byContract.has(String(c.id)),
    ),
    alreadyOrdered: byContract,
  };
}

/** Proposal lines turned into purchase-order lines, with a vendor where one resolves. */
export function orderableLines(
  lines: ProposalLine[],
  inventory: InventoryRef[],
  vendors: VendorRef[],
): { lines: OrderableLine[]; notOrderable: NotOrderableLine[] } {
  const inventoryByCode = new Map<string, InventoryRef>();
  for (const item of inventory) {
    for (const code of [item.part_number, item.manufacturer_part_number, item.id]) {
      if (code) inventoryByCode.set(norm(code), item);
    }
  }
  const vendorByName = new Map<string, VendorRef>();
  for (const vendor of vendors) {
    if (vendor.vendor_name) vendorByName.set(norm(vendor.vendor_name), vendor);
  }

  const out: OrderableLine[] = [];
  const notOrderable: NotOrderableLine[] = [];

  for (const line of [...lines].sort((a, b) => num(a.line_number) - num(b.line_number))) {
    const itemType = String(line.item_type ?? '').toLowerCase();
    if (line.is_recurring) {
      notOrderable.push({
        proposalLineId: line.id,
        productName: line.product_name,
        reason: 'a recurring charge, not something a vendor ships',
      });
      continue;
    }
    if (!ORDERABLE_ITEM_TYPES.includes(itemType)) {
      notOrderable.push({
        proposalLineId: line.id,
        productName: line.product_name,
        reason: `${itemType || 'untyped'} lines are not ordered from a vendor`,
      });
      continue;
    }

    const item =
      inventoryByCode.get(norm(line.product_code)) ?? inventoryByCode.get(norm(line.product_id));
    // See the header: a name match or no vendor at all.
    const vendor = item?.primary_vendor
      ? (vendorByName.get(norm(item.primary_vendor)) ?? null)
      : null;
    const quantity = Math.max(1, Math.round(num(line.quantity, 1)));
    // Dealer cost is what a purchase order is raised at. The sell price is what
    // the customer pays and would inflate the payable by the whole margin.
    const unitPrice = num(line.unit_cost, 0);

    out.push({
      proposalLineId: line.id,
      lineNumber: out.length + 1,
      itemDescription: line.product_name,
      itemCode: line.product_code ?? null,
      inventoryItemId: item?.id ?? null,
      partNumber: item?.part_number ?? null,
      manufacturerPartNumber: item?.manufacturer_part_number ?? null,
      unitOfMeasure: item?.unit_of_measure ?? 'EA',
      quantity,
      unitPrice,
      totalPrice: Number((unitPrice * quantity).toFixed(2)),
      vendorId: vendor?.id ?? null,
      vendorName: vendor?.vendor_name ?? item?.primary_vendor ?? null,
    });
  }

  return { lines: out, notOrderable };
}

export function buildNeedsOrderingRow(
  contract: ContractRow,
  customerName: string | null,
  lines: OrderableLine[],
  notOrderable: NotOrderableLine[],
): NeedsOrderingRow {
  const vendorIds = [...new Set(lines.map((l) => l.vendorId).filter(Boolean))];
  return {
    contractId: contract.id,
    contractNumber: contract.contract_number ?? null,
    customerId: contract.customer_id,
    customerName,
    status: contract.status ?? null,
    startDate: contract.start_date ?? null,
    proposalId: contract.proposal_id ?? null,
    dealId: contract.deal_id ?? null,
    acquisitionType: contract.acquisition_type ?? null,
    lines,
    notOrderable,
    estimatedCost: Number(lines.reduce((sum, l) => sum + l.totalPrice, 0).toFixed(2)),
    // Only when every line agrees. Two vendors on one contract means two orders,
    // and picking one of them would put the wrong products on it.
    suggestedVendorId: vendorIds.length === 1 ? (vendorIds[0] as string) : null,
  };
}
