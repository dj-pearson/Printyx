// Deno copy of the canonical quote math (QUOTE-010 / QUOTE-016).
//
// KEEP IN SYNC with shared/quote-math.ts. The edge runtime cannot import that
// Node module, and the header there says the functions are "replicated inline"
// in the proposals function — which is how they drifted: the inline copy used
// `(toNum(quantity) || 1) * toNum(unit_price)` for gross, so a line with
// quantity 0 or null counted as ONE unit. That inflates gross, which shrinks the
// effective discount percentage, which made the max-discount guardrail MORE
// PERMISSIVE than the figure the rep was shown in the quote builder.
//
// Locked by server/tests/unit/quote-math-parity.test.ts, which runs every case
// through both copies.

export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Number(n.toFixed(2));
}

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
 * max-discount guardrail evaluates: a rep cannot dodge the policy by spreading
 * the discount across lines instead of the quote-level field.
 */
export function effectiveDiscountPct(lines: DiscountedLine[], quoteDiscount: number): number {
  const gross = sumLineGross(lines);
  if (gross <= 0) return 0;
  return ((sumLineDiscounts(lines) + toNumber(quoteDiscount)) / gross) * 100;
}

/** Map a raw proposal_line_items row to the shape these helpers expect. */
export function toDiscountedLine(row: Record<string, unknown>): DiscountedLine {
  return {
    quantity: toNumber(row.quantity),
    unitPrice: toNumber(row.unit_price ?? row.unitPrice),
    discount: toNumber(row.discount),
    unitCost: toNumber(row.unit_cost ?? row.unitCost),
  };
}
