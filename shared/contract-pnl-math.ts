/**
 * Contract P&L math (US-SUPER-003 / EDGE-023).
 *
 * CANONICAL formulas for per-contract margin: CPC revenue minus parts, labor,
 * supplies and financing. Extracted from server/routes-contract-pnl.ts so the
 * Express router and the `contract-pnl` edge function compute identical numbers
 * instead of each carrying its own copy.
 *
 * SAME ARRANGEMENT AS shared/quote-math.ts: Deno cannot import from `shared/`,
 * so supabase/functions/contract-pnl/ REPLICATES these functions inline. KEEP
 * THE TWO IN SYNC — server/tests/unit/contract-pnl-math.test.ts locks the
 * formulas so a drift on the Node side fails CI. (A Deno-side drift is not
 * mechanically caught; that is the accepted cost of the runtime split, and the
 * reason the numbers are pinned by test here.)
 *
 * WHY THE RATES ARE APPLIED AT READ TIME: the two materialized views
 * (contract_pnl_v, contract_pnl_monthly_v) hold RAW trailing-12-month
 * aggregates — hours, part counts, dollars. The per-tenant dollar rates live in
 * contract_pnl_settings and are multiplied in here, so changing a rate updates
 * every number immediately without refreshing a view.
 */

/** Per-tenant rate defaults, used when a tenant has no explicit setting. */
export const CONTRACT_PNL_DEFAULTS = {
  techBurdenedRate: 75,
  avgPartCost: 45,
  financingRate: 0,
  gpAlertThreshold: 20,
} as const;

export interface ResolvedRates {
  burdenedRate: number;
  avgPartCost: number;
  financingRate: number;
  gpAlertThreshold: number;
}

export interface PnlComputed {
  revenue12: number;
  cost12: number;
  laborCost: number;
  partsCost: number;
  suppliesCost: number;
  financingCost: number;
  copiesRevenue: number;
  baseRevenue: number;
  grossProfit: number;
  gpPercent: number | null;
  monthlyRevenue: number;
  monthlyCost: number;
}

export interface MonthlyComputed {
  revenue: number;
  cost: number;
  laborCost: number;
  partsCost: number;
  suppliesCost: number;
  financingCost: number;
  grossProfit: number;
  gpPercent: number | null;
}

/**
 * Coerce a DB value to a number. Postgres numerics arrive as STRINGS through
 * both drivers, so this is load-bearing rather than defensive: without it every
 * multiplication below would produce NaN or string concatenation.
 */
export function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Resolve a tenant's settings row (possibly partial/absent) to concrete rates. */
export function ratesFrom(settings: {
  techBurdenedRate?: string | number | null;
  avgPartCost?: string | number | null;
  financingRate?: number | null;
  gpAlertThreshold?: number | null;
}): ResolvedRates {
  return {
    burdenedRate:
      settings.techBurdenedRate != null
        ? num(settings.techBurdenedRate)
        : CONTRACT_PNL_DEFAULTS.techBurdenedRate,
    avgPartCost:
      settings.avgPartCost != null ? num(settings.avgPartCost) : CONTRACT_PNL_DEFAULTS.avgPartCost,
    financingRate:
      settings.financingRate != null
        ? num(settings.financingRate)
        : CONTRACT_PNL_DEFAULTS.financingRate,
    gpAlertThreshold:
      settings.gpAlertThreshold != null
        ? settings.gpAlertThreshold
        : CONTRACT_PNL_DEFAULTS.gpAlertThreshold,
  };
}

/** Apply the per-tenant rates to one aggregate view row's raw 12-month totals. */
export function computePnl(
  row: {
    copies_revenue_12mo?: unknown;
    base_revenue_12mo?: unknown;
    labor_hours_12mo?: unknown;
    parts_count_12mo?: unknown;
    supplies_cost_12mo?: unknown;
  },
  r: ResolvedRates,
): PnlComputed {
  const copiesRevenue = num(row.copies_revenue_12mo);
  const baseRevenue = num(row.base_revenue_12mo);
  const revenue12 = copiesRevenue + baseRevenue;
  const laborCost = num(row.labor_hours_12mo) * r.burdenedRate;
  const partsCost = num(row.parts_count_12mo) * r.avgPartCost;
  const suppliesCost = num(row.supplies_cost_12mo);
  // Financing is charged on the BASE (equipment) revenue only, never on clicks.
  const financingCost = baseRevenue * r.financingRate;
  const cost12 = laborCost + partsCost + suppliesCost + financingCost;
  const grossProfit = revenue12 - cost12;
  // null, not 0, when there is no revenue: a contract with no revenue has an
  // UNDEFINED margin, and reporting 0% would sort it in with genuinely
  // break-even contracts and trip the below-threshold alert.
  const gpPercent = revenue12 > 0 ? (grossProfit / revenue12) * 100 : null;
  return {
    revenue12,
    cost12,
    laborCost,
    partsCost,
    suppliesCost,
    financingCost,
    copiesRevenue,
    baseRevenue,
    grossProfit,
    gpPercent,
    monthlyRevenue: revenue12 / 12,
    monthlyCost: cost12 / 12,
  };
}

/** Monthly GP% for one (contract, month) raw row — drives the sparkline + detail. */
export function computeMonthly(
  row: {
    copies_revenue?: unknown;
    base_revenue?: unknown;
    labor_hours?: unknown;
    parts_count?: unknown;
    supplies_cost?: unknown;
  },
  r: ResolvedRates,
): MonthlyComputed {
  const copiesRevenue = num(row.copies_revenue);
  const baseRevenue = num(row.base_revenue);
  const revenue = copiesRevenue + baseRevenue;
  const laborCost = num(row.labor_hours) * r.burdenedRate;
  const partsCost = num(row.parts_count) * r.avgPartCost;
  const suppliesCost = num(row.supplies_cost);
  const financingCost = baseRevenue * r.financingRate;
  const cost = laborCost + partsCost + suppliesCost + financingCost;
  const grossProfit = revenue - cost;
  const gpPercent = revenue > 0 ? (grossProfit / revenue) * 100 : null;
  return {
    revenue,
    cost,
    laborCost,
    partsCost,
    suppliesCost,
    financingCost,
    grossProfit,
    gpPercent,
  };
}
