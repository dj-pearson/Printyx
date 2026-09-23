/**
 * Plan usage-limit enforcement for edge writes (round 171).
 *
 * Express mounts enforceUsageLimits (server/middleware/subscription.ts) on
 * POST /api/leads, and it decided nothing in production: getApiUrl sends that
 * path to supabase/functions/leads/, which created records with no plan check
 * at all. This is the same rule, over the same arithmetic the subscription
 * banner already uses on this host (_shared/subscription-status.ts):
 *
 *   - no active subscription            -> allowed
 *   - an admin-granted free subscription -> allowed
 *   - usage over any plan limit          -> 403 USAGE_LIMIT_EXCEEDED
 *
 * It FAILS OPEN, deliberately and exactly like the Express copy: a database
 * hiccup must not stop a rep saving a lead. The refusal is only issued when the
 * status was read and says over-limit.
 */
import { buildSubscriptionStatus } from './subscription-status.ts';

// deno-lint-ignore no-explicit-any
type Client = any;

/** The 403 body, identical to the Express middleware's. */
export function usageLimitBody(status: Record<string, any>): Record<string, unknown> {
  return {
    error: 'Usage limit exceeded',
    code: 'USAGE_LIMIT_EXCEEDED',
    message: 'You have exceeded your plan limits. Please upgrade your subscription to continue.',
    overageDetails: status.overageDetails,
    currentPlan: status.plan?.slug,
    redirectTo: '/settings/subscription',
    upgradeRequired: true,
  };
}

/** Pure decision: null to allow, a 403 body to refuse. */
export function usageLimitDecision(
  subscription: Record<string, any> | null | undefined,
  plan: Record<string, any> | null | undefined,
  usageRow: Record<string, any> | null | undefined,
  now: Date,
): Record<string, unknown> | null {
  if (!subscription || !plan) return null;
  if (subscription.is_free ?? subscription.isFree) return null;
  const status = buildSubscriptionStatus(subscription, plan, usageRow, now);
  return status.isOverLimit ? usageLimitBody(status as Record<string, any>) : null;
}

/** Reads what the decision needs; any read error allows the write. */
export async function usageLimitRefusal(
  admin: Client,
  tenantId: string,
  now: Date = new Date(),
): Promise<Record<string, unknown> | null> {
  try {
    const { data: subscription, error } = await admin
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !subscription) return null;

    const { data: plan, error: planError } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('id', subscription.plan_id)
      .maybeSingle();
    if (planError || !plan) return null;

    const nowIso = now.toISOString();
    const { data: usage, error: usageError } = await admin
      .from('usage_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .lte('period_start', nowIso)
      .gte('period_end', nowIso)
      .limit(1)
      .maybeSingle();
    if (usageError) return null;

    return usageLimitDecision(subscription, plan, usage, now);
  } catch (err) {
    console.error('usage limit check failed; allowing the write:', err);
    return null;
  }
}
