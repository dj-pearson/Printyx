/**
 * The subscription plans Printyx actually sells.
 *
 * This is the single source of truth for anything that PUBLISHES a price.
 * scripts/setup-stripe-products.ts creates the Stripe products from it, and
 * scripts/generate-llms-txt.mjs publishes it to AI crawlers, so the price a
 * search engine repeats and the price Stripe charges cannot drift apart.
 *
 * They had drifted. llms.txt advertised "Starter: $49/user/month" and
 * "Professional: $79/user/month" with Enterprise as "custom pricing", against
 * real Stripe products at $79, $99 and $149 - wrong on the amount, wrong on the
 * unit (these are flat monthly prices with a user cap, not per-seat), and wrong
 * that Enterprise has no list price. index.html's SoftwareApplication offer had
 * the right number with the wrong unit, "per user per month", which is the one
 * a rich result would have shown.
 */

export interface PricingPlan {
  name: string;
  slug: string;
  description: string;
  /** Cents. Flat per month for the whole tenant, not per seat. */
  monthlyPrice: number;
  /** Cents, billed yearly. */
  annualPrice: number;
  /** 'unlimited' where there is no cap. */
  maxUsers: string;
  maxLocations: string;
  trialDays: number;
  popular?: boolean;
}

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    name: 'Printyx Starter',
    slug: 'starter',
    description:
      'Perfect for small copier dealers (5-20 employees) with core contract management and meter billing',
    monthlyPrice: 7900,
    annualPrice: 75800,
    maxUsers: '20',
    maxLocations: '3',
    trialDays: 30,
  },
  {
    name: 'Printyx Professional',
    slug: 'professional',
    description:
      'For growing copier dealers (20-100 employees) with service dispatch, mobile app, and advanced inventory',
    monthlyPrice: 9900,
    annualPrice: 95000,
    maxUsers: '100',
    maxLocations: '10',
    trialDays: 30,
    popular: true,
  },
  {
    name: 'Printyx Enterprise',
    slug: 'enterprise',
    description:
      'For large copier dealers (100+ employees) with dedicated account manager, API access, and SLA guarantees',
    monthlyPrice: 14900,
    annualPrice: 143000,
    maxUsers: 'unlimited',
    maxLocations: 'unlimited',
    trialDays: 30,
  },
];

/** The cheapest monthly price, in whole dollars - what a "from" figure means. */
export const ENTRY_MONTHLY_PRICE_USD =
  Math.min(...PRICING_PLANS.map((plan) => plan.monthlyPrice)) / 100;

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}
