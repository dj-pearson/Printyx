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

// ─── Per-line discounts (QUOTE-016) ─────────────────────────────────────────
//
// proposal_line_items.discount stores a DOLLAR amount off the whole line
// (qty × unitPrice − discount = the line's net total). The UI may let the rep
// type a percent, but it is converted to dollars before save so the stored
// value is unambiguous when quantity or unit price change later.

export interface DiscountedLine {
  quantity: number;
  unitPrice: number;
  /** Dollar amount off the whole line. Optional/0 = no line discount. */
  discount?: number;
  unitCost?: number;
}

/** Line total before any discount: qty × unitPrice. */
export function lineGrossTotal(line: DiscountedLine): number {
  return toNumber(line.quantity) * toNumber(line.unitPrice);
}

/** Line total net of the per-line discount. Floored at 0 — a discount can never make a line negative. */
export function lineNetTotal(line: DiscountedLine): number {
  return Math.max(0, lineGrossTotal(line) - toNumber(line.discount));
}

/**
 * Per-line gross margin %, on the line's NET revenue (after the per-line
 * discount). With no discount this equals lineMarginPct(unitPrice, unitCost).
 */
export function lineNetMarginPct(line: DiscountedLine): number {
  const revenue = lineNetTotal(line);
  if (revenue <= 0) return 0;
  const cost = toNumber(line.unitCost) * toNumber(line.quantity);
  return ((revenue - cost) / revenue) * 100;
}

/** Sum of gross (pre-discount) line totals. */
export function sumLineGross(lines: DiscountedLine[]): number {
  return lines.reduce((s, l) => s + lineGrossTotal(l), 0);
}

/** Sum of per-line discount dollars. */
export function sumLineDiscounts(lines: DiscountedLine[]): number {
  return lines.reduce((s, l) => s + toNumber(l.discount), 0);
}

/** Sum of discounted line totals — the quote subtotal under QUOTE-016. */
export function sumLineNet(lines: DiscountedLine[]): number {
  return lines.reduce((s, l) => s + lineNetTotal(l), 0);
}

/**
 * EFFECTIVE quote discount % — per-line discounts plus the quote-level
 * discount, relative to the gross (pre-discount) subtotal. This is what the
 * max-discount guardrail evaluates (QUOTE-016): a rep cannot dodge the policy
 * by spreading the discount across lines instead of the quote-level field.
 */
export function effectiveDiscountPct(lines: DiscountedLine[], quoteDiscount: number): number {
  const gross = sumLineGross(lines);
  if (gross <= 0) return 0;
  return ((sumLineDiscounts(lines) + toNumber(quoteDiscount)) / gross) * 100;
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
