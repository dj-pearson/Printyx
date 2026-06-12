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

// ─── Recurring/contract lines (QUOTE-017) ───────────────────────────────────
//
// proposal_line_items carries is_recurring / recurring_frequency
// (monthly | quarterly | annually) / recurring_duration (number of billing
// periods; null/0 = ongoing). Every money field on a recurring line is a PER
// PERIOD amount — qty, unit price, and the per-line discount all describe one
// billing period, so the line math above applies unchanged within a line.
//
// Bucket rules:
//   • The quote-level discount applies to the ONE-TIME bucket only. Recurring
//     (per-period) totals are never reduced by the one-time quote-level
//     discount; per-line discounts still apply inside recurring lines.
//   • The QUOTE-006 guardrail margin stays computed across BOTH buckets
//     combined — one-time net revenue plus one period of every recurring
//     line — so a rep cannot hide low margin in recurring lines. That is the
//     proposals-table subtotal / total_dealer_cost recompute, which the
//     send-time gate reads.

export const RECURRING_FREQUENCIES = ['monthly', 'quarterly', 'annually'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export interface BucketedLine extends DiscountedLine {
  isRecurring?: boolean;
  /** monthly | quarterly | annually. Missing/unknown on a recurring line reads as monthly. */
  recurringFrequency?: string | null;
  /** Number of billing periods; null/undefined/0 = ongoing. */
  recurringDuration?: number | null;
}

export function isRecurringLine(line: BucketedLine): boolean {
  return line.isRecurring === true;
}

export function normalizeFrequency(freq: unknown): RecurringFrequency {
  const f = String(freq ?? '').toLowerCase();
  return (RECURRING_FREQUENCIES as readonly string[]).includes(f)
    ? (f as RecurringFrequency)
    : 'monthly';
}

export function oneTimeLines<T extends BucketedLine>(lines: T[]): T[] {
  return lines.filter((l) => !isRecurringLine(l));
}

export function recurringLines<T extends BucketedLine>(lines: T[]): T[] {
  return lines.filter(isRecurringLine);
}

export interface BucketTotals {
  /** Net revenue: discounted line totals, minus `extraDiscount` when given. */
  revenue: number;
  /** Σ qty × unitCost across the bucket. */
  cost: number;
  /** Gross margin % on the bucket's net revenue (0 when revenue ≤ 0). */
  marginPct: number;
}

/**
 * Totals for an arbitrary set of lines. `extraDiscount` exists for the
 * one-time bucket, which absorbs the whole quote-level discount (see rules
 * above) — recurring buckets must never pass one.
 */
export function bucketTotals(lines: BucketedLine[], extraDiscount = 0): BucketTotals {
  const revenue = sumLineNet(lines) - toNumber(extraDiscount);
  const cost = lines.reduce((s, l) => s + toNumber(l.unitCost) * toNumber(l.quantity), 0);
  return { revenue, cost, marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0 };
}

/** One-time bucket totals, net of the quote-level discount. */
export function oneTimeBucketTotals(lines: BucketedLine[], quoteDiscount = 0): BucketTotals {
  return bucketTotals(oneTimeLines(lines), quoteDiscount);
}

/**
 * Per-period recurring totals grouped by billing frequency, in canonical
 * frequency order, empty frequencies omitted. The quote-level discount is NOT
 * applied here by design.
 */
export function recurringTotalsByFrequency(
  lines: BucketedLine[],
): Array<{ frequency: RecurringFrequency } & BucketTotals> {
  const rec = recurringLines(lines);
  return RECURRING_FREQUENCIES.map((frequency) => ({
    frequency,
    ...bucketTotals(rec.filter((l) => normalizeFrequency(l.recurringFrequency) === frequency)),
  })).filter((b) => b.revenue > 0 || b.cost > 0);
}

/** Display labels: "per month" phrasing + adjective ("Monthly"). */
export const FREQUENCY_LABELS: Record<RecurringFrequency, { per: string; adjective: string }> = {
  monthly: { per: 'month', adjective: 'Monthly' },
  quarterly: { per: 'quarter', adjective: 'Quarterly' },
  annually: { per: 'year', adjective: 'Annual' },
};

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
