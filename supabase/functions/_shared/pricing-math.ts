/**
 * Pricing arithmetic and role gates (PROD-014).
 *
 * /api/pricing/{calculate-rep-cost,margin-report,approvals/pending,approval/:id}
 * were Express-only, so in production the pricing dashboard widgets, the
 * approvals badge and the rep-cost calculator on the product form all 404'd.
 * Porting them puts the arithmetic and the role gate on both backends, so they
 * live here.
 *
 * A CORRECTION IS RECORDED HERE RATHER THAN QUIETLY MADE. Two functions named
 * "margin" computed (price - cost) / COST, which is markup, not margin.
 * shared/quote-math.ts — the canonical definition used by the quote builder,
 * the proposals edge function and both PDFs — computes (price - cost) / PRICE.
 * On a $110 price against a $100 cost that is 10% against 9.09%, so a minimum
 * margin floor built on the old function would pass prices that break the
 * policy it states.
 *
 * Nothing enforced it: pricing-service.validateMinimumMargin and
 * product-pricing-service.validatePriceChange are both imported-but-never-
 * called, verified by grepping every call site. So this is a latent trap, not
 * a live defect, and it is fixed now rather than left for whoever wires up
 * min-margin enforcement to inherit. Both quantities are available under names
 * that say which is which.
 *
 * Deno copy — kept textually identical to
 * shared/pricing-math.ts.
 */

/**
 * Lower is more senior. Unknown roles get 999, i.e. no elevated access.
 *
 * Copied verbatim from server/services/pricing-service.ts, hyphens and all —
 * these strings are compared against role names already stored, so "correcting"
 * them to underscores would silently drop every manager to level 999 and hide
 * dealer cost from the people the feature exists for.
 */
export const PRICING_ROLE_LEVELS: Record<string, number> = {
  'platform-admin': 1,
  'super-admin': 2,
  admin: 3,
  manager: 4,
  standard: 5,
  support: 6,
  'read-only': 7,
  guest: 8,
};

export function roleLevel(userRole: string | null | undefined): number {
  return PRICING_ROLE_LEVELS[(userRole ?? '').toLowerCase()] || 999;
}

/** Managers (level 4) and above. Gates dealer cost, margin reports, approvals. */
export function canSeeDealerCost(userRole: string | null | undefined): boolean {
  return roleLevel(userRole) <= 4;
}

/** Standard users (sales reps, level 5) and above. */
export function canSeeRepCost(userRole: string | null | undefined): boolean {
  return roleLevel(userRole) <= 5;
}

/** Admins (level 3) and above. */
export function canEditDealerCost(userRole: string | null | undefined): boolean {
  return roleLevel(userRole) <= 3;
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

/** The markup used when nothing more specific applies. */
export const DEFAULT_MARKUP_PERCENTAGE = 13;

/**
 * Only the fields the markup maths reads.
 *
 * Deliberately loose: Drizzle types categoryMarkupOverrides as `unknown` (it is
 * jsonb) and PostgREST hands back snake_case, so pinning it tighter would make
 * one backend or the other unable to pass its own settings row.
 */
export interface MarkupSettings {
  defaultMarkupPercentage?: unknown;
  default_markup_percentage?: unknown;
  categoryMarkupOverrides?: unknown;
  category_markup_overrides?: unknown;
}

/**
 * Rep cost from dealer cost.
 *
 * Precedence is deliberate and worth stating: a markup passed for the product
 * itself wins, then a category override, then the company default. Reordering
 * those silently reprices a catalog.
 */
export function calculateRepCost(
  dealerCost: number,
  productMarkupPercentage: number | null | undefined,
  settings: MarkupSettings | null | undefined,
  productCategory?: string | null,
): number {
  let markupPercentage: number;

  if (productMarkupPercentage !== null && productMarkupPercentage !== undefined) {
    markupPercentage = toNumber(productMarkupPercentage);
  } else {
    const raw = settings?.categoryMarkupOverrides ?? settings?.category_markup_overrides ?? null;
    const overrides =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;
    const fallback = toNumber(
      settings?.defaultMarkupPercentage ?? settings?.default_markup_percentage,
      DEFAULT_MARKUP_PERCENTAGE,
    );
    const override = overrides && productCategory ? toNumber(overrides[productCategory], 0) : 0;
    // A 0 override means "not set" here, matching the `||` the original used.
    markupPercentage = override || fallback;
  }

  return dealerCost * (1 + markupPercentage / 100);
}

/**
 * Gross margin %, relative to the SELLING PRICE.
 *
 * The same definition as lineMarginPct in shared/quote-math.ts. Use this
 * anywhere the word "margin" appears in a setting, a report or the UI.
 */
export function grossMarginPct(customerPrice: number, cost: number): number {
  return customerPrice > 0 ? ((customerPrice - cost) / customerPrice) * 100 : 0;
}

/**
 * Markup %, relative to the COST.
 *
 * This is what the two functions named "margin" actually computed. Kept under
 * its real name because rep cost is derived from a markup, so the quantity is
 * genuinely needed — just not under the other one's name.
 */
export function markupPct(customerPrice: number, cost: number): number {
  return cost > 0 ? ((customerPrice - cost) / cost) * 100 : 0;
}

/** Discount % off an original price. */
export function discountPct(originalPrice: number, discountedPrice: number): number {
  return originalPrice > 0 ? ((originalPrice - discountedPrice) / originalPrice) * 100 : 0;
}

export interface MinMarginSettings {
  minMarginPercentage?: unknown;
  min_margin_percentage?: unknown;
}

export interface MarginCheck {
  valid: boolean;
  message?: string;
  actualMargin: number;
  requiredMargin: number;
}

/** Default floor when a tenant has recorded none. */
export const DEFAULT_MIN_MARGIN_PERCENTAGE = 5;

/** A price against the tenant's minimum GROSS MARGIN, not its markup. */
export function validateMinimumMargin(
  customerPrice: number,
  dealerCost: number,
  settings: MinMarginSettings | null | undefined,
): MarginCheck {
  const requiredMargin = toNumber(
    settings?.minMarginPercentage ?? settings?.min_margin_percentage,
    DEFAULT_MIN_MARGIN_PERCENTAGE,
  );
  const actualMargin = grossMarginPct(customerPrice, dealerCost);

  if (actualMargin < requiredMargin) {
    return {
      valid: false,
      message: `Price below minimum margin. Required: ${requiredMargin}%, Actual: ${actualMargin.toFixed(2)}%`,
      actualMargin,
      requiredMargin,
    };
  }

  return { valid: true, actualMargin, requiredMargin };
}
