// Subscriptions Edge Function
// Handles subscription management + the full Stripe checkout/portal flow for tenants.
//
// EDGE-002c: ported the Stripe-flow + management endpoints that previously lived
// only in Express (server/routes-subscriptions.ts) so the frontend hooks in
// client/src/hooks/useSubscription.ts have full parity at functions.printyx.net:
//   GET  /current                     POST /create        POST /upgrade
//   POST /cancel                      POST /convert-trial
//   GET  /notifications               POST /notifications/:id/dismiss|read
//   GET  /stripe/config               POST /checkout      POST /checkout/addon
//   GET  /checkout/session/:id        POST /portal        POST /setup-intent
//   GET  /preview-upgrade             POST /webhooks/stripe (signature verified)
// plus the pre-existing /plans, /usage, /invoices, /features, /change-plan and
// base CRUD. Responses that mirror a legacy Express (Drizzle) shape are camelized
// via toCamel so the React reads (billingCycle, isTrialing, isFree, ...) resolve.
//
// SCHEMA AUDIT (AC #3):
//  - subscription_plans / subscription_features / tenant_subscriptions exist and
//    match shared/schema-subscriptions.ts. Stripe price ids live on
//    subscription_plans.stripe_price_id_{monthly,annual}.
//  - There is NO `subscription_invoices` table — invoices live in `billing_history`
//    (what /invoices reads). The name in the story is a misnomer.
//  - The Stripe customer id is stored on the REAL tenant_subscriptions
//    .stripe_customer_id column (NOT the phantom tenants.metadata the old
//    StripeService used — tenants has no metadata column).
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamel } from './_camel.ts';
import {
  isStripeConfigured,
  getPublishableKey,
  getOrCreateCustomer,
  getExistingCustomerId,
  createCheckoutSession,
  createOneTimeCheckoutSession,
  retrieveCheckoutSession,
  createPortalSession,
  createSetupIntent,
  previewUpcomingInvoice,
  verifyWebhookSignature,
  StripeApiError,
  StripeNotConfiguredError,
} from './_stripe.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

function clientBaseUrl(): string {
  return Deno.env.get('CLIENT_URL') || 'http://localhost:5173';
}

function periodEndFrom(now: Date, billingCycle: string): Date {
  const end = new Date(now);
  if (billingCycle === 'annual') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

// ---------------------------------------------------------------------------
// Stripe webhook — signature verified, pre-auth (Stripe signs, no user JWT).
// ---------------------------------------------------------------------------
async function handleStripeWebhook(req: Request, admin: Admin): Promise<Response> {
  if (!isStripeConfigured()) {
    return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return createCorsResponse({ error: 'Missing stripe-signature header' }, 400, req);
  }

  const payload = await req.text();
  let event: Record<string, unknown>;
  try {
    event = await verifyWebhookSignature(payload, signature);
  } catch (err) {
    return createCorsResponse(
      { error: 'Webhook signature verification failed', message: (err as Error).message },
      400,
      req,
    );
  }

  try {
    const type = event.type as string;
    const obj = (event.data as { object?: Record<string, unknown> })?.object || {};
    const now = new Date().toISOString();

    if (type === 'checkout.session.completed') {
      const tenantId = (obj.metadata as Record<string, string> | undefined)?.tenantId;
      const stripeSubscriptionId =
        typeof obj.subscription === 'string'
          ? obj.subscription
          : (obj.subscription as { id?: string } | undefined)?.id;
      const stripeCustomerId =
        typeof obj.customer === 'string'
          ? obj.customer
          : (obj.customer as { id?: string } | undefined)?.id;
      if (tenantId) {
        const update: Record<string, unknown> = { status: 'active', updated_at: now };
        if (stripeSubscriptionId) update.stripe_subscription_id = stripeSubscriptionId;
        if (stripeCustomerId) update.stripe_customer_id = stripeCustomerId;
        await admin
          .from('tenant_subscriptions')
          .update(update)
          .eq('tenant_id', tenantId)
          .in('status', ['trialing', 'active', 'past_due', 'incomplete']);
      }
    } else if (type === 'customer.subscription.updated') {
      const stripeSubscriptionId = obj.id as string;
      const status = obj.status as string;
      if (stripeSubscriptionId && status) {
        await admin
          .from('tenant_subscriptions')
          .update({ status, updated_at: now })
          .eq('stripe_subscription_id', stripeSubscriptionId);
      }
    } else if (type === 'customer.subscription.deleted') {
      const stripeSubscriptionId = obj.id as string;
      if (stripeSubscriptionId) {
        await admin
          .from('tenant_subscriptions')
          .update({ status: 'canceled', ended_at: now, updated_at: now })
          .eq('stripe_subscription_id', stripeSubscriptionId);
      }
    }

    return createCorsResponse({ received: true }, 200, req);
  } catch (err) {
    console.error('Webhook processing error:', err);
    // Acknowledge receipt to avoid Stripe retries on our own processing errors.
    return createCorsResponse({ received: true, error: (err as Error).message }, 200, req);
  }
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'subscriptions');
    const seg0 = parts[0];
    const seg1 = parts[1];
    const seg2 = parts[2];

    // ====================================================================
    // PRE-AUTH ROUTES
    // ====================================================================

    // POST /subscriptions/webhooks/stripe (Stripe-signed, no user JWT)
    if (req.method === 'POST' && seg0 === 'webhooks' && seg1 === 'stripe') {
      return await handleStripeWebhook(req, admin);
    }

    // GET /subscriptions/plans — public plan list
    if (req.method === 'GET' && seg0 === 'plans' && !seg1) {
      const { data: plans, error } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('is_visible', true)
        .order('display_order', { ascending: true });
      if (error) {
        console.error('Error fetching plans:', error);
        return createCorsResponse({ error: 'Failed to fetch subscription plans' }, 500, req);
      }
      const { data: features } = await admin
        .from('subscription_features')
        .select('*')
        .order('display_order', { ascending: true });
      return createCorsResponse(
        { plans: toCamel(plans || []), features: toCamel(features || []) },
        200,
        req,
      );
    }

    // GET /subscriptions/plans/:slug — public plan detail
    if (req.method === 'GET' && seg0 === 'plans' && seg1) {
      const { data: plan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', seg1)
        .eq('is_active', true)
        .eq('is_visible', true)
        .maybeSingle();
      if (!plan) return createCorsResponse({ error: 'Plan not found' }, 404, req);
      const featureSlugs = (plan.features as string[]) || [];
      const { data: features } = await admin
        .from('subscription_features')
        .select('*')
        .in('slug', featureSlugs.length ? featureSlugs : ['__none__']);
      return createCorsResponse(
        { ...toCamel<Record<string, unknown>>(plan), featureDetails: toCamel(features || []) },
        200,
        req,
      );
    }

    // GET /subscriptions/stripe/config — public publishable key
    if (req.method === 'GET' && seg0 === 'stripe' && seg1 === 'config') {
      if (!isStripeConfigured()) {
        return createCorsResponse(
          { error: 'Stripe is not configured', message: 'Payment processing is unavailable' },
          503,
          req,
        );
      }
      return createCorsResponse({ publishableKey: getPublishableKey() }, 200, req);
    }

    // ====================================================================
    // AUTH GATE
    // ====================================================================
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }
    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }
    const userEmail = user.email as string | undefined;

    // ====================================================================
    // GET /subscriptions/current — full subscription status (Express shape)
    // ====================================================================
    if (req.method === 'GET' && seg0 === 'current') {
      const { data: sub } = await admin
        .from('tenant_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) {
        return createCorsResponse(
          { hasSubscription: false, message: 'No active subscription' },
          200,
          req,
        );
      }

      const plan = sub.plan as Record<string, any> | null;
      const subRow = { ...sub };
      delete (subRow as Record<string, unknown>).plan;

      const now = new Date();
      const { data: usageRow } = await admin
        .from('usage_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .lte('period_start', now.toISOString())
        .gte('period_end', now.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const usage = {
        users: usageRow?.total_users ?? 0,
        storage: usageRow?.storage_used_mb ?? 0,
        apiCalls: usageRow?.api_calls ?? 0,
        locations: usageRow?.active_locations ?? 0,
        businessRecords: usageRow?.business_records ?? 0,
      };
      const cl = (subRow.custom_limits as Record<string, number>) || {};
      const limits = {
        users: cl.maxUsers ?? plan?.max_users,
        storage: cl.maxStorage ?? plan?.max_storage,
        apiCalls: cl.maxApiCalls ?? plan?.max_api_calls,
        locations: cl.maxLocations ?? plan?.max_locations,
        businessRecords: cl.maxBusinessRecords ?? plan?.max_business_records,
      };

      const overageDetails: Record<string, number> = {};
      let isOverLimit = false;
      if (limits.users !== -1 && usage.users > limits.users) {
        overageDetails.users = usage.users - limits.users;
        isOverLimit = true;
      }
      if (limits.storage !== -1 && usage.storage > limits.storage * 1024) {
        overageDetails.storage = usage.storage - limits.storage * 1024;
        isOverLimit = true;
      }
      if (limits.apiCalls !== -1 && usage.apiCalls > limits.apiCalls) {
        overageDetails.apiCalls = usage.apiCalls - limits.apiCalls;
        isOverLimit = true;
      }
      if (limits.locations !== -1 && usage.locations > limits.locations) {
        overageDetails.locations = usage.locations - limits.locations;
        isOverLimit = true;
      }
      if (limits.businessRecords !== -1 && usage.businessRecords > limits.businessRecords) {
        overageDetails.businessRecords = usage.businessRecords - limits.businessRecords;
        isOverLimit = true;
      }

      const periodEnd = subRow.current_period_end ? new Date(subRow.current_period_end) : now;
      const daysUntilRenewal = Math.ceil(
        (periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );
      let trialDaysRemaining: number | undefined;
      if (subRow.is_trialing && subRow.trial_end_date) {
        trialDaysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(subRow.trial_end_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          ),
        );
      }

      return createCorsResponse(
        {
          hasSubscription: true,
          subscription: toCamel(subRow),
          plan: toCamel(plan),
          usage,
          limits,
          isOverLimit,
          overageDetails,
          daysUntilRenewal,
          isTrialing: !!subRow.is_trialing,
          trialDaysRemaining,
          features: (plan?.features as string[]) || [],
        },
        200,
        req,
      );
    }

    // ====================================================================
    // POST /subscriptions/create — slug-based create (Express parity)
    // ====================================================================
    if (req.method === 'POST' && seg0 === 'create') {
      const body = await req.json().catch(() => ({}));
      const { planSlug, billingCycle, startTrial, discountCode } = body;
      if (!planSlug || !billingCycle) {
        return createCorsResponse(
          { error: 'Missing required fields: planSlug, billingCycle' },
          400,
          req,
        );
      }
      if (!['monthly', 'annual'].includes(billingCycle)) {
        return createCorsResponse({ error: 'Invalid billing cycle' }, 400, req);
      }

      const { data: existing } = await admin
        .from('tenant_subscriptions')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle();
      if (existing) {
        return createCorsResponse(
          {
            error: 'Tenant already has an active subscription',
            message: 'Use the upgrade endpoint',
          },
          400,
          req,
        );
      }

      const { data: plan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .eq('is_active', true)
        .eq('is_visible', true)
        .maybeSingle();
      if (!plan) return createCorsResponse({ error: `Plan not found: ${planSlug}` }, 404, req);

      const now = new Date();
      const wantsTrial = startTrial !== false;
      const isTrialing = wantsTrial && !!plan.trial_enabled && (plan.trial_days ?? 0) > 0;
      let periodEnd: Date;
      let trialEnd: Date | null = null;
      if (isTrialing) {
        trialEnd = new Date(now.getTime() + (plan.trial_days || 14) * 24 * 60 * 60 * 1000);
        periodEnd = trialEnd;
      } else {
        periodEnd = periodEndFrom(now, billingCycle);
      }
      const amount = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;

      const { data: created, error: createErr } = await admin
        .from('tenant_subscriptions')
        .insert({
          tenant_id: tenantId,
          plan_id: plan.id,
          status: isTrialing ? 'trialing' : 'active',
          billing_cycle: billingCycle,
          billing_interval: 1,
          start_date: now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          is_trialing: isTrialing,
          trial_start_date: isTrialing ? now.toISOString() : null,
          trial_end_date: trialEnd ? trialEnd.toISOString() : null,
          amount,
          currency: 'USD',
          discount_amount: '0',
          discount_percent: 0,
          is_free: false,
          custom_pricing: false,
          usage_based_billing: false,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select('*')
        .single();
      if (createErr) {
        console.error('Error creating subscription:', createErr);
        return createCorsResponse({ error: 'Failed to create subscription' }, 500, req);
      }

      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: created.id,
        event_type: isTrialing ? 'trial_started' : 'created',
        user_id: user.id,
        to_plan: plan.id,
        data: { plan: planSlug, billingCycle, amount, discountCode: discountCode || null },
        created_at: now.toISOString(),
      });

      return createCorsResponse(
        { subscription: toCamel(created), message: 'Subscription created successfully' },
        201,
        req,
      );
    }

    // ====================================================================
    // POST /subscriptions/upgrade — slug-based upgrade/downgrade
    // ====================================================================
    if (req.method === 'POST' && seg0 === 'upgrade') {
      const body = await req.json().catch(() => ({}));
      const { newPlanSlug, billingCycle } = body;
      if (!newPlanSlug) {
        return createCorsResponse({ error: 'Missing required field: newPlanSlug' }, 400, req);
      }

      const { data: current } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!current) return createCorsResponse({ error: 'No active subscription found' }, 404, req);

      const { data: newPlan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', newPlanSlug)
        .maybeSingle();
      if (!newPlan)
        return createCorsResponse({ error: `Plan not found: ${newPlanSlug}` }, 404, req);

      const newCycle = billingCycle || current.billing_cycle;
      const newAmount = newCycle === 'annual' ? newPlan.annual_price : newPlan.monthly_price;
      const now = new Date();

      const { data: updated, error: updErr } = await admin
        .from('tenant_subscriptions')
        .update({
          plan_id: newPlan.id,
          billing_cycle: newCycle,
          amount: newAmount,
          updated_at: now.toISOString(),
        })
        .eq('id', current.id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();
      if (updErr) {
        console.error('Error upgrading subscription:', updErr);
        return createCorsResponse({ error: 'Failed to upgrade subscription' }, 500, req);
      }

      const isUpgrade = parseFloat(String(newAmount)) > parseFloat(String(current.amount));
      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: current.id,
        event_type: isUpgrade ? 'upgraded' : 'downgraded',
        user_id: user.id,
        from_plan: current.plan_id,
        to_plan: newPlan.id,
        data: { fromAmount: current.amount, toAmount: newAmount, billingCycle: newCycle },
        created_at: now.toISOString(),
      });

      return createCorsResponse(
        { subscription: toCamel(updated), message: 'Subscription updated successfully' },
        200,
        req,
      );
    }

    // ====================================================================
    // POST /subscriptions/cancel — cancel current subscription ({immediate})
    // (bare /cancel; the id-scoped /:id/cancel is handled lower down)
    // ====================================================================
    if (req.method === 'POST' && seg0 === 'cancel' && !seg1) {
      const body = await req.json().catch(() => ({}));
      const immediate = body.immediate === true;

      const { data: current } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!current) return createCorsResponse({ error: 'No active subscription found' }, 404, req);

      const now = new Date();
      const update: Record<string, unknown> = {
        canceled_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      if (immediate) {
        update.status = 'canceled';
        update.ended_at = now.toISOString();
      } else {
        update.cancel_at = current.current_period_end;
      }
      const { error: cancelErr } = await admin
        .from('tenant_subscriptions')
        .update(update)
        .eq('id', current.id)
        .eq('tenant_id', tenantId);
      if (cancelErr) {
        console.error('Error canceling subscription:', cancelErr);
        return createCorsResponse({ error: 'Failed to cancel subscription' }, 500, req);
      }

      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: current.id,
        event_type: 'canceled',
        user_id: user.id,
        data: { immediate, cancelDate: immediate ? now.toISOString() : current.current_period_end },
        created_at: now.toISOString(),
      });

      return createCorsResponse(
        {
          message: immediate
            ? 'Subscription canceled immediately'
            : 'Subscription will be canceled at the end of the current period',
        },
        200,
        req,
      );
    }

    // ====================================================================
    // POST /subscriptions/convert-trial — trial -> paid
    // ====================================================================
    if (req.method === 'POST' && seg0 === 'convert-trial') {
      const { data: trial } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'trialing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!trial) return createCorsResponse({ error: 'No trial subscription found' }, 404, req);

      const now = new Date();
      const newPeriodEnd = periodEndFrom(now, trial.billing_cycle);
      const { data: updated, error: convErr } = await admin
        .from('tenant_subscriptions')
        .update({
          status: 'active',
          is_trialing: false,
          current_period_start: now.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', trial.id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();
      if (convErr) {
        console.error('Error converting trial:', convErr);
        return createCorsResponse({ error: 'Failed to convert trial' }, 500, req);
      }

      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: trial.id,
        event_type: 'trial_converted',
        user_id: user.id,
        data: { trialEndDate: trial.trial_end_date, conversionDate: now.toISOString() },
        created_at: now.toISOString(),
      });

      return createCorsResponse(
        {
          subscription: toCamel(updated),
          message: 'Trial converted to paid subscription successfully',
        },
        200,
        req,
      );
    }

    // ====================================================================
    // GET /subscriptions/notifications — billing alerts
    // ====================================================================
    if (req.method === 'GET' && seg0 === 'notifications') {
      const { data: notifications, error } = await admin
        .from('subscription_notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('Error fetching notifications:', error);
        return createCorsResponse({ error: 'Failed to fetch notifications' }, 500, req);
      }
      return createCorsResponse({ notifications: toCamel(notifications || []) }, 200, req);
    }

    // POST /subscriptions/notifications/:id/dismiss|read
    if (
      req.method === 'POST' &&
      seg0 === 'notifications' &&
      seg1 &&
      (seg2 === 'dismiss' || seg2 === 'read')
    ) {
      const now = new Date().toISOString();
      const update: Record<string, unknown> =
        seg2 === 'dismiss'
          ? { status: 'dismissed', dismissed_at: now, updated_at: now }
          : { status: 'read', read_at: now, updated_at: now };
      const { error } = await admin
        .from('subscription_notifications')
        .update(update)
        .eq('id', seg1)
        .eq('tenant_id', tenantId);
      if (error) {
        console.error('Error updating notification:', error);
        return createCorsResponse({ error: 'Failed to update notification' }, 500, req);
      }
      return createCorsResponse(
        { message: seg2 === 'dismiss' ? 'Notification dismissed' : 'Notification marked as read' },
        200,
        req,
      );
    }

    // ====================================================================
    // STRIPE CHECKOUT & PORTAL
    // ====================================================================

    // POST /subscriptions/checkout — new subscription checkout session
    if (req.method === 'POST' && seg0 === 'checkout' && !seg1) {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }
      const body = await req.json().catch(() => ({}));
      const { planSlug, billingCycle } = body;
      if (!planSlug || !billingCycle) {
        return createCorsResponse(
          { error: 'Missing required fields: planSlug, billingCycle' },
          400,
          req,
        );
      }
      if (!['monthly', 'annual'].includes(billingCycle)) {
        return createCorsResponse({ error: 'Invalid billing cycle' }, 400, req);
      }
      const { data: plan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .eq('is_active', true)
        .maybeSingle();
      if (!plan) return createCorsResponse({ error: 'Plan not found' }, 404, req);

      const priceId =
        billingCycle === 'annual' ? plan.stripe_price_id_annual : plan.stripe_price_id_monthly;
      if (!priceId) {
        return createCorsResponse(
          { error: 'Stripe price ID not configured for this plan' },
          400,
          req,
        );
      }

      try {
        const customer = await getOrCreateCustomer(admin, tenantId, userEmail);
        const base = clientBaseUrl();
        const session = await createCheckoutSession({
          customer,
          priceId,
          successUrl:
            Deno.env.get('STRIPE_CHECKOUT_SUCCESS_URL') ||
            `${base}/settings/subscription?success=true`,
          cancelUrl: Deno.env.get('STRIPE_CHECKOUT_CANCEL_URL') || `${base}/pricing?canceled=true`,
          trialDays: plan.trial_enabled ? plan.trial_days || 14 : 0,
          metadata: { tenantId, planSlug, planName: plan.name },
        });
        return createCorsResponse({ sessionId: session.id, sessionUrl: session.url }, 200, req);
      } catch (err) {
        return stripeError(err, req);
      }
    }

    // POST /subscriptions/checkout/addon — one-time add-on checkout
    if (req.method === 'POST' && seg0 === 'checkout' && seg1 === 'addon') {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }
      const body = await req.json().catch(() => ({}));
      const addonSlug = body.addonSlug;
      const quantity = body.quantity || 1;
      if (!addonSlug) {
        return createCorsResponse({ error: 'Missing required field: addonSlug' }, 400, req);
      }
      const { data: addon } = await admin
        .from('subscription_addons')
        .select('*')
        .eq('slug', addonSlug)
        .eq('is_active', true)
        .maybeSingle();
      if (!addon) return createCorsResponse({ error: 'Add-on not found' }, 404, req);
      if (!addon.stripe_price_id) {
        return createCorsResponse(
          { error: 'Stripe price ID not configured for this add-on' },
          400,
          req,
        );
      }
      try {
        const customer = await getOrCreateCustomer(admin, tenantId, userEmail);
        const base = clientBaseUrl();
        const session = await createOneTimeCheckoutSession({
          customer,
          priceId: addon.stripe_price_id,
          quantity,
          successUrl: `${base}/settings/subscription?addon_success=true&addon=${addonSlug}`,
          cancelUrl: `${base}/settings/subscription?addon_canceled=true`,
          metadata: { tenantId, addonSlug, addonName: addon.name },
        });
        return createCorsResponse({ sessionId: session.id, sessionUrl: session.url }, 200, req);
      } catch (err) {
        return stripeError(err, req);
      }
    }

    // GET /subscriptions/checkout/session/:id — verify checkout session
    if (req.method === 'GET' && seg0 === 'checkout' && seg1 === 'session' && seg2) {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }
      try {
        const session = (await retrieveCheckoutSession(seg2)) as Record<string, any>;
        const sessionTenant = (session.metadata as Record<string, string> | undefined)?.tenantId;
        if (sessionTenant && sessionTenant !== tenantId) {
          return createCorsResponse({ error: 'Access denied to this session' }, 403, req);
        }
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as { id?: string } | undefined)?.id;
        return createCorsResponse(
          {
            id: session.id,
            status: session.status,
            paymentStatus: session.payment_status,
            customerEmail: session.customer_email,
            subscriptionId,
          },
          200,
          req,
        );
      } catch (err) {
        return stripeError(err, req);
      }
    }

    // POST /subscriptions/portal — Stripe customer portal session
    if (req.method === 'POST' && seg0 === 'portal') {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }
      const customer = await getExistingCustomerId(admin, tenantId);
      if (!customer) {
        return createCorsResponse(
          {
            error: 'No billing account found',
            message: 'Please complete a purchase first to access billing management',
          },
          400,
          req,
        );
      }
      try {
        const base = clientBaseUrl();
        const session = await createPortalSession(
          customer,
          Deno.env.get('STRIPE_PORTAL_RETURN_URL') || `${base}/settings/billing`,
        );
        return createCorsResponse({ url: session.url }, 200, req);
      } catch (err) {
        return stripeError(err, req);
      }
    }

    // POST /subscriptions/setup-intent — add payment method
    if (req.method === 'POST' && seg0 === 'setup-intent') {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }
      try {
        const customer = await getOrCreateCustomer(admin, tenantId, userEmail);
        const intent = (await createSetupIntent(customer, { tenantId })) as Record<string, any>;
        return createCorsResponse({ clientSecret: intent.client_secret }, 200, req);
      } catch (err) {
        return stripeError(err, req);
      }
    }

    // GET /subscriptions/preview-upgrade — proration preview
    if (req.method === 'GET' && seg0 === 'preview-upgrade') {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }
      const newPlanSlug = url.searchParams.get('newPlanSlug');
      const billingCycle = url.searchParams.get('billingCycle');
      if (!newPlanSlug) {
        return createCorsResponse({ error: 'Missing required field: newPlanSlug' }, 400, req);
      }
      const { data: current } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!current?.stripe_subscription_id) {
        return createCorsResponse({ error: 'No active Stripe subscription found' }, 400, req);
      }
      const { data: newPlan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', newPlanSlug)
        .maybeSingle();
      if (!newPlan) return createCorsResponse({ error: 'Plan not found' }, 404, req);

      const cycle = billingCycle || current.billing_cycle;
      const newPriceId =
        cycle === 'annual' ? newPlan.stripe_price_id_annual : newPlan.stripe_price_id_monthly;
      if (!newPriceId) {
        return createCorsResponse(
          { error: 'Stripe price ID not configured for this plan' },
          400,
          req,
        );
      }
      const customer = await getExistingCustomerId(admin, tenantId);
      if (!customer) return createCorsResponse({ error: 'No Stripe customer found' }, 400, req);

      try {
        const invoice = (await previewUpcomingInvoice(
          customer,
          current.stripe_subscription_id,
          newPriceId,
        )) as Record<string, any>;
        const subtotal = (invoice.subtotal || 0) / 100;
        const total = (invoice.total || 0) / 100;
        return createCorsResponse(
          {
            currentPlan: current.plan_id,
            newPlan: newPlan.slug,
            subtotal,
            total,
            amountDue: (invoice.amount_due || 0) / 100,
            prorationAmount: total - subtotal,
            currency: (invoice.currency as string)?.toUpperCase() || 'USD',
            billingCycle: cycle,
          },
          200,
          req,
        );
      } catch (err) {
        return stripeError(err, req);
      }
    }

    // ====================================================================
    // GET /subscriptions/usage — usage metrics against limits (pre-existing)
    // ====================================================================
    if (req.method === 'GET' && seg0 === 'usage') {
      const { data: subscription, error: subError } = await admin
        .from('tenant_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subError) {
        console.error('Error fetching subscription for usage:', subError);
        return createCorsResponse({ error: 'Failed to fetch subscription' }, 500, req);
      }
      if (!subscription) {
        return createCorsResponse({ error: 'No active subscription found' }, 404, req);
      }

      const now = new Date();
      const periodStart = subscription.current_period_start || now.toISOString();
      const periodEnd = subscription.current_period_end || now.toISOString();
      const { data: usageMetrics } = await admin
        .from('usage_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const plan = subscription.plan as Record<string, any> | null;
      const customLimits = (subscription.custom_limits as Record<string, number>) || {};
      const limits = {
        maxUsers: customLimits.maxUsers ?? plan?.max_users ?? -1,
        maxStorage: customLimits.maxStorage ?? plan?.max_storage ?? -1,
        maxApiCalls: customLimits.maxApiCalls ?? plan?.max_api_calls ?? -1,
        maxLocations: customLimits.maxLocations ?? plan?.max_locations ?? -1,
        maxBusinessRecords: customLimits.maxBusinessRecords ?? plan?.max_business_records ?? -1,
      };
      const currentUsage = {
        totalUsers: usageMetrics?.total_users ?? 0,
        storageUsedMb: usageMetrics?.storage_used_mb ?? 0,
        apiCalls: usageMetrics?.api_calls ?? 0,
        activeLocations: usageMetrics?.active_locations ?? 0,
        businessRecords: usageMetrics?.business_records ?? 0,
      };
      const pct = (used: number, limit: number): number => {
        if (limit === -1) return 0;
        if (limit === 0) return 100;
        return Math.min(100, Math.round((used / limit) * 100));
      };
      return createCorsResponse(
        {
          subscription: {
            id: subscription.id,
            planName: plan?.name,
            status: subscription.status,
            billingCycle: subscription.billing_cycle,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
          },
          usage: {
            users: {
              used: currentUsage.totalUsers,
              limit: limits.maxUsers,
              percentage: pct(currentUsage.totalUsers, limits.maxUsers),
              isUnlimited: limits.maxUsers === -1,
            },
            storage: {
              usedMb: currentUsage.storageUsedMb,
              usedGb: Math.round((currentUsage.storageUsedMb / 1024) * 100) / 100,
              limitGb: limits.maxStorage,
              percentage: pct(currentUsage.storageUsedMb / 1024, limits.maxStorage),
              isUnlimited: limits.maxStorage === -1,
            },
            apiCalls: {
              used: currentUsage.apiCalls,
              limit: limits.maxApiCalls,
              percentage: pct(currentUsage.apiCalls, limits.maxApiCalls),
              isUnlimited: limits.maxApiCalls === -1,
            },
            locations: {
              used: currentUsage.activeLocations,
              limit: limits.maxLocations,
              percentage: pct(currentUsage.activeLocations, limits.maxLocations),
              isUnlimited: limits.maxLocations === -1,
            },
            businessRecords: {
              used: currentUsage.businessRecords,
              limit: limits.maxBusinessRecords,
              percentage: pct(currentUsage.businessRecords, limits.maxBusinessRecords),
              isUnlimited: limits.maxBusinessRecords === -1,
            },
          },
          raw: usageMetrics,
        },
        200,
        req,
      );
    }

    // ====================================================================
    // GET /subscriptions/invoices — billing history (pre-existing)
    // ====================================================================
    if (req.method === 'GET' && seg0 === 'invoices') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;
      const status = url.searchParams.get('status');
      let query = admin
        .from('billing_history')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('invoice_date', { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) query = query.eq('status', status);
      const { data: invoices, error, count } = await query;
      if (error) {
        console.error('Error fetching invoices:', error);
        return createCorsResponse({ error: 'Failed to fetch invoices' }, 500, req);
      }
      return createCorsResponse(
        { data: toCamel(invoices || []), total: count || 0, page, limit },
        200,
        req,
      );
    }

    // ====================================================================
    // GET /subscriptions/features — features for current plan (pre-existing)
    // ====================================================================
    if (req.method === 'GET' && seg0 === 'features' && !seg1) {
      const { data: subscription } = await admin
        .from('tenant_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!subscription) {
        return createCorsResponse({ error: 'No active subscription found' }, 404, req);
      }
      const { data: allFeatures } = await admin
        .from('subscription_features')
        .select('*')
        .order('display_order', { ascending: true });
      const plan = subscription.plan as Record<string, any> | null;
      const planFeatures: string[] = (plan?.features as string[]) || [];
      const featuresWithStatus = (allFeatures || []).map((feature: Record<string, any>) => ({
        ...toCamel<Record<string, unknown>>(feature),
        isEnabled: planFeatures.includes(feature.slug) || feature.is_core,
      }));
      return createCorsResponse(
        {
          planName: plan?.name,
          planSlug: plan?.slug,
          features: featuresWithStatus,
          enabledFeatureSlugs: planFeatures,
        },
        200,
        req,
      );
    }

    // GET /subscriptions/features/check/:slug — feature access check
    if (req.method === 'GET' && seg0 === 'features' && seg1 === 'check' && seg2) {
      const { data: subscription } = await admin
        .from('tenant_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const plan = subscription?.plan as Record<string, any> | null;
      const hasAccess =
        !!subscription &&
        (!!subscription.is_free || ((plan?.features as string[]) || []).includes(seg2));
      return createCorsResponse({ feature: seg2, hasAccess }, 200, req);
    }

    // ====================================================================
    // POST /subscriptions/change-plan — id-based plan change (pre-existing)
    // ====================================================================
    if (req.method === 'POST' && seg0 === 'change-plan') {
      const body = await req.json().catch(() => ({}));
      const newPlanId = body.planId || body.plan_id;
      const billingCycle = body.billingCycle || body.billing_cycle;
      if (!newPlanId) return createCorsResponse({ error: 'Plan ID is required' }, 400, req);

      const { data: current } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: newPlan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('id', newPlanId)
        .eq('is_active', true)
        .maybeSingle();
      if (!newPlan) return createCorsResponse({ error: 'Invalid plan ID' }, 400, req);

      const cycle = billingCycle || current?.billing_cycle || 'monthly';
      const newAmount = cycle === 'annual' ? newPlan.annual_price : newPlan.monthly_price;
      const now = new Date();
      const periodEnd = periodEndFrom(now, cycle);

      if (current) {
        const { data: updated, error } = await admin
          .from('tenant_subscriptions')
          .update({
            plan_id: newPlanId,
            billing_cycle: cycle,
            amount: newAmount,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', current.id)
          .eq('tenant_id', tenantId)
          .select('*')
          .single();
        if (error) return createCorsResponse({ error: 'Failed to change plan' }, 500, req);
        await admin.from('subscription_events').insert({
          tenant_id: tenantId,
          subscription_id: current.id,
          event_type: 'plan_changed',
          user_id: user.id,
          from_plan: current.plan_id,
          to_plan: newPlanId,
          data: { toBillingCycle: cycle, toAmount: newAmount },
          created_at: now.toISOString(),
        });
        return createCorsResponse(
          { message: 'Plan changed successfully', subscription: toCamel(updated) },
          200,
          req,
        );
      }
      const { data: created, error } = await admin
        .from('tenant_subscriptions')
        .insert({
          tenant_id: tenantId,
          plan_id: newPlanId,
          status: 'active',
          billing_cycle: cycle,
          start_date: now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          amount: newAmount,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select('*')
        .single();
      if (error) return createCorsResponse({ error: 'Failed to create subscription' }, 500, req);
      return createCorsResponse(
        { message: 'Subscription created successfully', subscription: toCamel(created) },
        201,
        req,
      );
    }

    // ====================================================================
    // GET /subscriptions — current subscription (base)
    // ====================================================================
    if (req.method === 'GET' && !seg0) {
      const { data: subscription, error } = await admin
        .from('tenant_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Error fetching subscription:', error);
        return createCorsResponse({ error: 'Failed to fetch subscription' }, 500, req);
      }
      if (!subscription) {
        return createCorsResponse(
          { message: 'No active subscription found', subscription: null },
          200,
          req,
        );
      }
      return createCorsResponse({ subscription: toCamel(subscription) }, 200, req);
    }

    // ====================================================================
    // PUT/PATCH /subscriptions/:id — update (pre-existing)
    // ====================================================================
    if ((req.method === 'PUT' || req.method === 'PATCH') && seg0 && !seg1) {
      const body = await req.json().catch(() => ({}));
      const { data: existing } = await admin
        .from('tenant_subscriptions')
        .select('id')
        .eq('id', seg0)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!existing) return createCorsResponse({ error: 'Subscription not found' }, 404, req);

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.billingCycle !== undefined || body.billing_cycle !== undefined) {
        update.billing_cycle = body.billingCycle || body.billing_cycle;
      }
      if (body.notes !== undefined) update.notes = body.notes;
      if (body.metadata !== undefined) update.metadata = body.metadata;

      const { data: updated, error } = await admin
        .from('tenant_subscriptions')
        .update(update)
        .eq('id', seg0)
        .eq('tenant_id', tenantId)
        .select('*, plan:subscription_plans(*)')
        .single();
      if (error) return createCorsResponse({ error: 'Failed to update subscription' }, 500, req);
      return createCorsResponse({ subscription: toCamel(updated) }, 200, req);
    }

    // ====================================================================
    // POST /subscriptions/:id/cancel — id-scoped cancel (pre-existing)
    // ====================================================================
    if (req.method === 'POST' && seg0 && seg1 === 'cancel') {
      const body = await req.json().catch(() => ({}));
      const cancelImmediately = body.cancelImmediately || body.cancel_immediately || false;
      const reason = body.reason || null;
      const { data: subscription } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', seg0)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!subscription) return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      if (subscription.status === 'canceled') {
        return createCorsResponse({ error: 'Subscription is already canceled' }, 400, req);
      }
      const now = new Date();
      const update: Record<string, unknown> = {
        canceled_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      if (cancelImmediately) {
        update.status = 'canceled';
        update.ended_at = now.toISOString();
      } else {
        update.cancel_at = subscription.current_period_end;
      }
      const { data: updated, error } = await admin
        .from('tenant_subscriptions')
        .update(update)
        .eq('id', seg0)
        .eq('tenant_id', tenantId)
        .select('*, plan:subscription_plans(*)')
        .single();
      if (error) return createCorsResponse({ error: 'Failed to cancel subscription' }, 500, req);
      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: seg0,
        event_type: 'canceled',
        user_id: user.id,
        data: { cancelImmediately, reason },
        created_at: now.toISOString(),
      });
      return createCorsResponse(
        {
          message: cancelImmediately
            ? 'Subscription canceled immediately'
            : 'Subscription will be canceled at the end of the current billing period',
          subscription: toCamel(updated),
        },
        200,
        req,
      );
    }

    // ====================================================================
    // POST /subscriptions/:id/resume — resume canceled (pre-existing)
    // ====================================================================
    if (req.method === 'POST' && seg0 && seg1 === 'resume') {
      const { data: subscription } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', seg0)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!subscription) return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      if (!subscription.cancel_at && subscription.status !== 'canceled') {
        return createCorsResponse(
          { error: 'Subscription is not scheduled for cancellation' },
          400,
          req,
        );
      }
      const now = new Date();
      let newPeriodEnd = subscription.current_period_end;
      if (subscription.status === 'canceled') {
        newPeriodEnd = periodEndFrom(now, subscription.billing_cycle).toISOString();
      }
      const { data: updated, error } = await admin
        .from('tenant_subscriptions')
        .update({
          status: subscription.is_trialing ? 'trialing' : 'active',
          cancel_at: null,
          canceled_at: null,
          ended_at: null,
          current_period_end: newPeriodEnd,
          updated_at: now.toISOString(),
        })
        .eq('id', seg0)
        .eq('tenant_id', tenantId)
        .select('*, plan:subscription_plans(*)')
        .single();
      if (error) return createCorsResponse({ error: 'Failed to resume subscription' }, 500, req);
      return createCorsResponse(
        { message: 'Subscription resumed successfully', subscription: toCamel(updated) },
        200,
        req,
      );
    }

    // ====================================================================
    // GET /subscriptions/:id — get a specific subscription (pre-existing)
    // ====================================================================
    if (req.method === 'GET' && seg0 && !seg1) {
      const { data: subscription } = await admin
        .from('tenant_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('id', seg0)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!subscription) return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      return createCorsResponse({ subscription: toCamel(subscription) }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in subscriptions function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

function stripeError(err: unknown, req: Request): Response {
  if (err instanceof StripeNotConfiguredError) {
    return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
  }
  if (err instanceof StripeApiError) {
    console.error('Stripe API error:', err.message);
    return createCorsResponse({ error: 'Stripe request failed', message: err.message }, 502, req);
  }
  console.error('Unexpected Stripe flow error:', err);
  return createCorsResponse(
    { error: 'Internal server error', message: (err as Error).message },
    500,
    req,
  );
}
