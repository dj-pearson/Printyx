/**
 * Subscription status arithmetic (PROD-014).
 *
 * GET /api/subscriptions/current is what SubscriptionBanner reads, and that
 * banner is mounted in App.tsx — it runs on every page. The endpoint existed
 * only on Express, so in production the whole plan/usage/trial surface answered
 * nothing.
 *
 * Porting it means running the same limit merge, overage test and day counts on
 * both sides. Those are pure, so they live here and server/lib/subscription-status.ts
 * mirrors them; server/tests/unit/subscription-status-parity.test.ts fails on
 * drift.
 *
 * Deno copy.
 */

/** -1 means unlimited, in both the plan columns and any custom override. */
export const UNLIMITED = -1;

export interface PlanLimits {
  users: number;
  storage: number;
  apiCalls: number;
  locations: number;
  businessRecords: number;
}

export interface CurrentUsage {
  users: number;
  storage: number;
  apiCalls: number;
  locations: number;
  businessRecords: number;
}

function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Usage row (or nothing) -> the five counters, defaulting to zero. */
export function readUsage(usage: Record<string, any> | null | undefined): CurrentUsage {
  return {
    users: toInt(usage?.total_users ?? usage?.totalUsers),
    storage: toInt(usage?.storage_used_mb ?? usage?.storageUsedMb),
    apiCalls: toInt(usage?.api_calls ?? usage?.apiCalls),
    locations: toInt(usage?.active_locations ?? usage?.activeLocations),
    businessRecords: toInt(usage?.business_records ?? usage?.businessRecords),
  };
}

/**
 * Plan limits with any per-subscription override applied.
 *
 * The override wins only when it is set: `||` is deliberate rather than `??`,
 * because a 0 in custom_limits means "no override recorded", not "zero allowed".
 * Matching that exactly is the point of the parity test.
 */
export function mergeLimits(
  plan: Record<string, any> | null | undefined,
  customLimits: Record<string, any> | null | undefined,
): PlanLimits {
  const custom = customLimits ?? {};
  return {
    users: custom.maxUsers || toInt(plan?.max_users ?? plan?.maxUsers),
    storage: custom.maxStorage || toInt(plan?.max_storage ?? plan?.maxStorage),
    apiCalls: custom.maxApiCalls || toInt(plan?.max_api_calls ?? plan?.maxApiCalls),
    locations: custom.maxLocations || toInt(plan?.max_locations ?? plan?.maxLocations),
    businessRecords:
      custom.maxBusinessRecords || toInt(plan?.max_business_records ?? plan?.maxBusinessRecords),
  };
}

/**
 * Which limits the tenant is past, and by how much.
 *
 * Storage is the one asymmetry: the plan states a limit in GB while usage is
 * recorded in MB, so the comparison multiplies by 1024. Getting that wrong in
 * one copy and not the other would put every tenant over their storage limit,
 * or none of them.
 */
export function computeOverages(
  usage: CurrentUsage,
  limits: PlanLimits,
): { isOverLimit: boolean; overageDetails: Record<string, number> } {
  const overageDetails: Record<string, number> = {};

  if (limits.users !== UNLIMITED && usage.users > limits.users) {
    overageDetails.users = usage.users - limits.users;
  }
  if (limits.storage !== UNLIMITED && usage.storage > limits.storage * 1024) {
    overageDetails.storage = usage.storage - limits.storage * 1024;
  }
  if (limits.apiCalls !== UNLIMITED && usage.apiCalls > limits.apiCalls) {
    overageDetails.apiCalls = usage.apiCalls - limits.apiCalls;
  }
  if (limits.locations !== UNLIMITED && usage.locations > limits.locations) {
    overageDetails.locations = usage.locations - limits.locations;
  }
  if (limits.businessRecords !== UNLIMITED && usage.businessRecords > limits.businessRecords) {
    overageDetails.businessRecords = usage.businessRecords - limits.businessRecords;
  }

  return { isOverLimit: Object.keys(overageDetails).length > 0, overageDetails };
}

/** Whole days from now until a date, rounded up. Negative once it has passed. */
export function daysUntil(date: string | Date | null | undefined, now: Date): number {
  if (!date) return 0;
  const target = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** Trial days left, never negative; undefined when not trialing. */
export function trialDaysRemaining(
  subscription: Record<string, any> | null | undefined,
  now: Date,
): number | undefined {
  const trialing = subscription?.is_trialing ?? subscription?.isTrialing;
  const end = subscription?.trial_end_date ?? subscription?.trialEndDate;
  if (!trialing || !end) return undefined;
  return Math.max(0, daysUntil(end, now));
}

/** The body GET /subscriptions/current returns when a subscription exists. */
export function buildSubscriptionStatus(
  subscription: Record<string, any>,
  plan: Record<string, any>,
  usageRow: Record<string, any> | null | undefined,
  now: Date,
): Record<string, unknown> {
  const usage = readUsage(usageRow);
  const limits = mergeLimits(plan, subscription.custom_limits ?? subscription.customLimits);
  const { isOverLimit, overageDetails } = computeOverages(usage, limits);

  return {
    hasSubscription: true,
    subscription,
    plan,
    usage,
    limits,
    isOverLimit,
    overageDetails,
    daysUntilRenewal: daysUntil(
      subscription.current_period_end ?? subscription.currentPeriodEnd,
      now,
    ),
    isTrialing: Boolean(subscription.is_trialing ?? subscription.isTrialing),
    trialDaysRemaining: trialDaysRemaining(subscription, now),
    features: (plan.features as string[]) ?? [],
  };
}

/**
 * The period end a trial conversion writes (PROD-014).
 *
 * Calendar arithmetic, not 30/365 days: an annual cycle lands on the same day
 * next year, a monthly one on the same day next month. Date rolls a
 * nonexistent day forward (Jan 31 + 1 month is Mar 3), which is the behaviour
 * production has had all along — pinned here so the two copies can't drift
 * into different renewal dates for the same customer.
 */
export function nextPeriodEnd(now: Date, billingCycle: string | null | undefined): Date {
  return billingCycle === 'annual'
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * What a plan costs for a billing cycle (PROD-014).
 *
 * PostgREST returns `numeric` as a STRING while Drizzle returns it as one too,
 * so both sides have to parse rather than compare. Doing it here means a price
 * can't end up string-concatenated on one backend and added on the other.
 */
export function planAmount(
  plan: Record<string, any> | null | undefined,
  billingCycle: string | null | undefined,
): number {
  const raw =
    billingCycle === 'annual'
      ? (plan?.annual_price ?? plan?.annualPrice)
      : (plan?.monthly_price ?? plan?.monthlyPrice);
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Whether a plan change is an upgrade, by price.
 *
 * The current amount arrives as a string from both backends. `>` would coerce
 * it, so the ordinary case is not the hazard — a MISSING amount is. `10 >
 * undefined` is NaN-false, so a subscription with no recorded amount would be
 * called a downgrade, and the customer moving onto a paid plan would be told
 * their plan changed rather than upgraded. Absent reads as zero here, and both
 * backends decide it the same way.
 */
export function isUpgradeAmount(
  newAmount: number,
  currentAmount: string | number | null | undefined,
): boolean {
  const current =
    typeof currentAmount === 'number'
      ? currentAmount
      : Number.parseFloat(String(currentAmount ?? ''));
  return newAmount > (Number.isFinite(current) ? current : 0);
}

/**
 * The trial decision a new subscription starts from (PROD-014).
 *
 * A trial needs all three: the caller asked for one, the plan enables them, and
 * the plan states a positive number of days. Loosening any of those gives away
 * free time on a plan that does not offer it; tightening them bills someone on
 * day one of what the pricing page called a trial.
 */
export function resolveTrialPeriod(
  plan: Record<string, any> | null | undefined,
  startTrial: boolean,
  billingCycle: string | null | undefined,
  now: Date,
): { isTrialing: boolean; trialEndDate: Date | null; currentPeriodEnd: Date } {
  const trialEnabled = plan?.trial_enabled ?? plan?.trialEnabled;
  const rawDays = plan?.trial_days ?? plan?.trialDays;
  const parsedDays =
    typeof rawDays === 'number' ? rawDays : Number.parseInt(String(rawDays ?? ''), 10);
  const trialDays = Number.isFinite(parsedDays) ? parsedDays : 0;

  if (startTrial && trialEnabled && trialDays > 0) {
    const trialEndDate = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    return { isTrialing: true, trialEndDate, currentPeriodEnd: trialEndDate };
  }

  return {
    isTrialing: false,
    trialEndDate: null,
    currentPeriodEnd: nextPeriodEnd(now, billingCycle),
  };
}
