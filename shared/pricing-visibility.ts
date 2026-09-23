/**
 * What pricing a given caller may see and change (round 156).
 *
 * usePricingVisibility() feeds the quote builder, the quote list and view, the
 * product pricing form and display, the required-accessories dialog and the
 * margin report, and it expects a per-caller answer: showDealerCost,
 * showMargin, canEditDealerCost and the rest. In production it was served by
 * pricing-settings' GET /visibility, which returned the stored
 * `pricing_visibility` ROW (show_msrp, show_dealer_cost, ...) - snake_case,
 * and not about the caller at all. Every field the client reads was
 * undefined, so no manager ever saw margin in the quote builder and nobody
 * could edit dealer cost from the product form.
 *
 * The levels are the ones round 155 gave the production `pricing` function,
 * which mirror the page gates in navigation-permissions.ts: dealer cost is
 * seen and edited from pricing management (minLevel 3); margins and the
 * pricing policy belong to managers (minLevel 4). Keeping them in one place is
 * what stops the product form showing an edit control the pricing function
 * then refuses.
 *
 * Dependency-free, so both runtimes import it.
 */

export const PRICING_COST_LEVEL = 3;
export const PRICING_MARGIN_LEVEL = 4;

export interface PricingVisibility {
  showDealerCost: boolean;
  showRepCost: boolean;
  showMargin: boolean;
  canEditDealerCost: boolean;
  canEditRepCost: boolean;
  canEditCustomerPrice: boolean;
  requiresApprovalForPriceChange: boolean;
  maxDiscountPercentage: number;
  minMarginPercentage: number;
}

/** The company_pricing_settings columns this reads, in either casing. */
type SettingsRow = Record<string, unknown> | null | undefined;

function pick(row: SettingsRow, snake: string, camel: string): unknown {
  if (!row) return undefined;
  return row[snake] ?? row[camel];
}

function num(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

export function pricingVisibilityFor(level: number, settings: SettingsRow): PricingVisibility {
  const costLevel = level >= PRICING_COST_LEVEL;
  const marginLevel = level >= PRICING_MARGIN_LEVEL;
  return {
    showDealerCost: costLevel,
    // Rep cost is what a rep quotes from; every member sees it.
    showRepCost: true,
    showMargin: marginLevel || pick(settings, 'show_margin_to_reps', 'showMarginToReps') === true,
    canEditDealerCost: costLevel,
    // Rep cost is always calculated from dealer cost and markup.
    canEditRepCost: false,
    canEditCustomerPrice:
      marginLevel || pick(settings, 'allow_rep_price_edit', 'allowRepPriceEdit') === true,
    requiresApprovalForPriceChange:
      pick(settings, 'require_approval_for_price_edit', 'requireApprovalForPriceEdit') === true,
    // The column defaults (migration 0000), used when no policy row exists yet.
    maxDiscountPercentage: num(
      pick(settings, 'max_discount_percentage', 'maxDiscountPercentage'),
      20,
    ),
    minMarginPercentage: num(pick(settings, 'min_margin_percentage', 'minMarginPercentage'), 5),
  };
}
