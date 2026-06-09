// Canonical quote math (QUOTE-010).
//
// Single definition of the quote/line margin formulas so the client
// (PricingCalculator) and the server (proposals edge fn recompute + _pdf.ts manager
// export) agree. The edge functions run under Deno and cannot import this Node
// module directly, so they replicate these exact formulas inline — keep them in
// sync, and lock them with shared/__tests__ via server/tests/unit/quote-math.test.ts.

export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Number(n.toFixed(2));
}

/** Per-line gross margin %, relative to selling price. */
export function lineMarginPct(unitPrice: number, unitCost: number): number {
  return unitPrice > 0 ? ((unitPrice - unitCost) / unitPrice) * 100 : 0;
}

export interface QuoteMarginInput {
  /** Sum of line totals (pre-discount, pre-tax). */
  subtotal: number;
  /** Discount amount applied before tax. */
  discount: number;
  /** Sum of (unit cost × qty) across lines. */
  totalCost: number;
}

/**
 * Quote-level gross margin %, on pre-tax revenue (subtotal − discount).
 * Tax is excluded — it is not revenue.
 */
export function quoteMarginPct({ subtotal, discount, totalCost }: QuoteMarginInput): number {
  const revenue = subtotal - discount;
  return revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;
}

/** Gross profit dollars on pre-tax revenue. */
export function quoteGrossProfit({ subtotal, discount, totalCost }: QuoteMarginInput): number {
  return subtotal - discount - totalCost;
}
