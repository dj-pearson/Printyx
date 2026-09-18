// What a rep is owed, worked out from the plan they are on (WF-C-07).
//
// POST /commission/calculate answered 501 and said so honestly: no handler
// existed on Express either, so the Calculate button on CommissionManagement.tsx
// had never worked on any host. The schema for it was already complete -
// commission_plans, commission_plan_tiers, commission_product_rates,
// employee_commission_assignments - and this is the arithmetic over it.
//
// PURE, AND THAT IS THE POINT. Every figure here is somebody's pay. A function
// that takes rows and returns numbers can be tested against a worked example at
// every tier boundary; a handler that queries and computes in one pass can only
// be tested against a database, which is how CR-017's "simplified - 5% base
// rate" survived in the read path for as long as it did.
//
// THE TIER IS A BRACKET, NOT A LADDER, and this is the decision most likely to
// be wrong if it is not written down. commission_plan_tiers has minimum_sales
// and maximum_sales, so a tier is the band the period's total falls INTO, and
// the whole total is paid at that band's rate. It is not marginal - the second
// band's rate is not applied only to the excess over the first. Both models
// exist in the trade; this one matches the columns, since a marginal model
// needs no maximum_sales on the top band and this schema has one. A plan whose
// bands leave a gap is a plan misconfiguration, and the result says so rather
// than silently picking the nearest.

export interface PlanTier {
  id?: string;
  tier_level?: number | null;
  tier_name?: string | null;
  minimum_sales?: number | string | null;
  maximum_sales?: number | string | null;
  commission_rate?: number | string | null;
  bonus_threshold?: number | string | null;
  bonus_amount?: number | string | null;
  is_active?: boolean | null;
}

export interface ProductRate {
  category?: string | null;
  category_name?: string | null;
  commission_rate?: number | string | null;
  is_active?: boolean | null;
}

/** One won deal, or any other commissionable transaction. */
export interface CommissionableSale {
  id: string;
  amount?: number | string | null;
  category?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  closedAt?: string | null;
  number?: string | null;
}

export interface Assignment {
  plan_id?: string | null;
  quota_target?: number | string | null;
}

export interface CommissionInput {
  sales: CommissionableSale[];
  tiers: PlanTier[];
  productRates?: ProductRate[];
  assignment?: Assignment | null;
  /** Plan-level floor: a payout under this is not paid out. */
  minimumPayment?: number | string | null;
}

export interface CommissionLine {
  category: string;
  categoryName: string;
  salesAmount: number;
  commissionRate: number;
  commissionAmount: number;
  description: string;
}

export interface CommissionBonus {
  bonusType: string;
  description: string;
  amount: number;
  eligibilityMet: boolean;
  eligibilityCriteria: string;
}

export interface CommissionResult {
  totalSales: number;
  quotaTarget: number | null;
  /** Percent, one decimal. Null when no quota is set - not zero. */
  quotaAchievement: number | null;
  tier: { level: number | null; name: string | null; rate: number } | null;
  lines: CommissionLine[];
  bonuses: CommissionBonus[];
  grossCommission: number;
  totalBonuses: number;
  netCommission: number;
  /** True when the plan floor suppressed the payout. */
  belowMinimum: boolean;
  unbacked: string[];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Money, to the cent. Rates are held as percentages in this schema. */
const money = (v: number): number => Math.round(v * 100) / 100;

/**
 * The tier whose band contains `total`.
 *
 * maximum_sales null means "no ceiling", which is how the top band is written.
 * A total that falls in no band returns null and the caller reports it rather
 * than paying at a rate nobody configured.
 */
export function selectTier(tiers: PlanTier[], total: number): PlanTier | null {
  const active = tiers
    .filter((t) => t.is_active !== false)
    .sort((a, b) => num(a.minimum_sales) - num(b.minimum_sales));

  for (const tier of active) {
    const min = num(tier.minimum_sales);
    const max =
      tier.maximum_sales === null || tier.maximum_sales === undefined
        ? Number.POSITIVE_INFINITY
        : num(tier.maximum_sales);
    if (total >= min && total <= max) return tier;
  }
  return null;
}

export function calculateCommission(input: CommissionInput): CommissionResult {
  const unbacked: string[] = [];
  const sales = input.sales ?? [];
  const totalSales = money(sales.reduce((acc, s) => acc + num(s.amount), 0));

  const quotaTargetRaw = input.assignment?.quota_target;
  const quotaTarget =
    quotaTargetRaw === null || quotaTargetRaw === undefined ? null : num(quotaTargetRaw);
  // NULL, NOT ZERO: a rep with no quota has no attainment, and 0% reads as
  // total failure on a screen where the number is about a person.
  const quotaAchievement =
    quotaTarget && quotaTarget > 0 ? Math.round((totalSales / quotaTarget) * 1000) / 10 : null;

  const tier = selectTier(input.tiers ?? [], totalSales);
  if (!tier) {
    unbacked.push(
      `No plan tier covers ${totalSales}. The plan's bands leave a gap, so no rate applies.`,
    );
  }
  const tierRate = num(tier?.commission_rate);

  // Per-category overrides beat the tier rate. A sale with no category, or a
  // category the plan does not name, falls back to the tier.
  const rateByCategory = new Map<string, number>();
  const nameByCategory = new Map<string, string>();
  for (const r of input.productRates ?? []) {
    if (r.is_active === false || !r.category) continue;
    rateByCategory.set(r.category, num(r.commission_rate));
    nameByCategory.set(r.category, r.category_name ?? r.category);
  }

  const buckets = new Map<string, { amount: number; rate: number; name: string }>();
  for (const sale of sales) {
    const category = sale.category ?? 'uncategorised';
    const override = rateByCategory.get(category);
    const rate = override ?? tierRate;
    const existing = buckets.get(category);
    const name = nameByCategory.get(category) ?? (sale.category ? category : 'Uncategorised');
    if (existing) existing.amount = money(existing.amount + num(sale.amount));
    else buckets.set(category, { amount: money(num(sale.amount)), rate, name });
  }

  const lines: CommissionLine[] = [...buckets.entries()].map(([category, b]) => ({
    category,
    categoryName: b.name,
    salesAmount: b.amount,
    commissionRate: b.rate,
    commissionAmount: money((b.amount * b.rate) / 100),
    description: rateByCategory.has(category)
      ? `${b.name} at the plan's product rate`
      : `${b.name} at the ${tier?.tier_name ?? 'tier'} rate`,
  }));

  const grossCommission = money(lines.reduce((acc, l) => acc + l.commissionAmount, 0));

  const bonuses: CommissionBonus[] = [];
  const threshold = tier?.bonus_threshold;
  if (threshold !== null && threshold !== undefined && num(threshold) > 0) {
    const met = totalSales >= num(threshold);
    bonuses.push({
      bonusType: 'tier_threshold',
      description: `${tier?.tier_name ?? 'Tier'} bonus`,
      amount: met ? money(num(tier?.bonus_amount)) : 0,
      eligibilityMet: met,
      eligibilityCriteria: `Sales of at least ${num(threshold)}`,
    });
  }
  const totalBonuses = money(
    bonuses.filter((b) => b.eligibilityMet).reduce((acc, b) => acc + b.amount, 0),
  );

  const beforeFloor = money(grossCommission + totalBonuses);
  const floor =
    input.minimumPayment === null || input.minimumPayment === undefined
      ? 0
      : num(input.minimumPayment);
  const belowMinimum = floor > 0 && beforeFloor < floor;
  if (belowMinimum) {
    unbacked.push(
      `Payout of ${beforeFloor} is under the plan's minimum of ${floor} and is not payable.`,
    );
  }

  return {
    totalSales,
    quotaTarget,
    quotaAchievement,
    tier: tier
      ? {
          level: tier.tier_level ?? null,
          name: tier.tier_name ?? null,
          rate: tierRate,
        }
      : null,
    lines,
    bonuses,
    grossCommission,
    totalBonuses,
    // Adjustments are applied by the caller from commission_adjustments, which
    // are per calculation and outside this function's inputs.
    netCommission: belowMinimum ? 0 : beforeFloor,
    belowMinimum,
    unbacked,
  };
}
