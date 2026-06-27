/**
 * Deal Desk Copilot — pure margin + similar-deal matching helpers (US-SUPER-008).
 *
 * Extracted from server/routes-deal-desk-copilot.ts so the substantive modeling
 * (service-cost + financing into GP; machine-class + headcount-band + region
 * matching) is unit-testable without a DB or HTTP. The route does the I/O and
 * delegates every calculation here.
 *
 * No imports — keep this a pure, dependency-free module so it stays portable
 * (server + tests + any future edge port).
 */

// ---------------------------------------------------------------------------
// Cost / margin modeling
// ---------------------------------------------------------------------------

export interface CostLine {
  /** proposal_line_items.item_type: equipment | accessory | service | software | supply */
  itemType: string | null | undefined;
  /** Internal cost (proposal_line_items.unit_cost). 0/absent for many service lines. */
  unitCost: number;
  /** Sell price (proposal_line_items.unit_price), used to estimate service delivery cost. */
  unitPrice: number;
  quantity: number;
}

/**
 * Default copier-dealer modeling assumptions. Documented estimates, overridable
 * per call so unit tests pin exact arithmetic rather than these constants.
 */
// Service lines frequently carry a sell price but no catalog cost. When a
// service line has no unit_cost, model the dealer's delivery (labor+parts) cost
// as this fraction of the service line's revenue. 0.6 ≈ a 40% service GM, a
// standard managed-print service assumption.
export const DEFAULT_SERVICE_COST_RATIO = 0.6;
// Financed/lease deals carry a buy-rate / discount-spread cost to the dealer.
// Applied to financed revenue only. Conservative 2% default estimate.
export const DEFAULT_FINANCING_COST_RATIO = 0.02;

const SERVICE_ITEM_TYPES = new Set(['service', 'maintenance']);

export interface CostBreakdown {
  /** Hardware/parts/supply/software internal cost. */
  partsCost: number;
  /** Projected service/labor delivery cost (catalog cost or estimated from revenue). */
  serviceCost: number;
  /** Financing/lease carrying cost on financed revenue. */
  financingCost: number;
  totalCost: number;
}

export interface CostOptions {
  /** Quote total revenue, used for the financing carry. */
  revenue: number;
  /** Whether this deal is financed/leased (drives financingCost). */
  financed?: boolean;
  serviceCostRatio?: number;
  financingCostRatio?: number;
}

/**
 * Break a quote's cost into parts + projected service + financing. Replaces the
 * old "cost = sum(unitCost) only" model that understated GP on service-heavy and
 * leased deals.
 */
export function computeQuoteCost(lines: CostLine[], opts: CostOptions): CostBreakdown {
  const serviceRatio = opts.serviceCostRatio ?? DEFAULT_SERVICE_COST_RATIO;
  const finRatio = opts.financingCostRatio ?? DEFAULT_FINANCING_COST_RATIO;

  let partsCost = 0;
  let serviceCost = 0;
  for (const l of lines) {
    const qty = l.quantity || 1;
    const lineCost = (l.unitCost || 0) * qty;
    const isService = SERVICE_ITEM_TYPES.has(String(l.itemType ?? '').toLowerCase());
    if (isService) {
      // Catalog cost if present, otherwise estimate from the service line's revenue.
      serviceCost += lineCost > 0 ? lineCost : serviceRatio * (l.unitPrice || 0) * qty;
    } else {
      partsCost += lineCost;
    }
  }

  const financingCost = opts.financed ? finRatio * (opts.revenue || 0) : 0;
  const totalCost = partsCost + serviceCost + financingCost;
  return { partsCost, serviceCost, financingCost, totalCost };
}

export interface MarginResult extends CostBreakdown {
  revenue: number;
  grossProfit: number;
  /** GP% rounded to one decimal. */
  gpPercent: number;
  gpFloorPct: number;
  belowFloor: boolean;
}

export function computeMargin(input: {
  revenue: number;
  cost: CostBreakdown;
  gpFloorPct: number;
}): MarginResult {
  const { revenue, cost, gpFloorPct } = input;
  const grossProfit = revenue - cost.totalCost;
  const gpPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
  const belowFloor = revenue > 0 && gpPercent < gpFloorPct;
  return { ...cost, revenue, grossProfit, gpPercent, gpFloorPct, belowFloor };
}

// ---------------------------------------------------------------------------
// Similar-deal matching: machine class + headcount band (+ region in the route)
// ---------------------------------------------------------------------------

/** Customer-headcount band from Account.NumberOfEmployees. */
export function headcountBand(employeeCount: number | null | undefined): string {
  if (employeeCount == null || employeeCount <= 0) return 'unknown';
  if (employeeCount < 20) return 'micro';
  if (employeeCount < 100) return 'small';
  if (employeeCount < 500) return 'mid';
  return 'enterprise';
}

interface ClassifiableLine {
  itemType: string | null | undefined;
  productName: string | null | undefined;
}

// Ordered most-specific-first: the first equipment line whose name matches wins.
const MACHINE_CLASS_RULES: Array<[RegExp, string]> = [
  [/production|press|igen|versant|prod\b/i, 'production'],
  [/wide.?format|large.?format|plotter/i, 'wide-format'],
  [/color|colour/i, 'color-mfp'],
  [/mono|black|b\s?\/?\s?w\b/i, 'mono-mfp'],
];

/**
 * Derive a machine class for a quote from its equipment line names. Falls back
 * to a generic office MFP class when equipment is present but unclassified, and
 * to the proposalType when the quote has no equipment line at all.
 */
export function machineClassOf(
  lines: ClassifiableLine[],
  proposalType: string | null | undefined,
): string {
  const equipment = lines.filter((l) => String(l.itemType ?? '').toLowerCase() === 'equipment');
  for (const l of equipment) {
    const name = l.productName ?? '';
    for (const [re, cls] of MACHINE_CLASS_RULES) if (re.test(name)) return cls;
  }
  if (equipment.length > 0) return 'color-mfp';
  return String(proposalType ?? 'other').toLowerCase();
}

export interface DealProfile {
  machineClass: string;
  headcountBand: string;
  territory: string | null;
}

/**
 * A candidate is a comp when it matches the quote on every dimension the caller
 * requires. Each dimension is skipped when the quote's own value is unknown so a
 * sparse account doesn't collapse the cohort to zero.
 */
export function dealMatches(quote: DealProfile, candidate: DealProfile): boolean {
  if (quote.territory && candidate.territory !== quote.territory) return false;
  if (quote.machineClass !== 'other' && candidate.machineClass !== quote.machineClass) return false;
  if (quote.headcountBand !== 'unknown' && candidate.headcountBand !== quote.headcountBand)
    return false;
  return true;
}
