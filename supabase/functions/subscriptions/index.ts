// Subscriptions Edge Function
// Handles subscription management for tenants
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { addMonths } from '../_shared/date-months.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import {
  buildSubscriptionStatus,
  isUpgradeAmount,
  nextPeriodEnd,
  planAmount,
  resolveTrialPeriod,
} from '../_shared/subscription-status.ts';
import { buildCancellationEmail } from '../_shared/cancellation-email.ts';
import { sendEmail } from '../email-marketing/_sendgrid.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  StripeError,
  clientBaseUrl,
  getOrCreateStripeCustomer,
  getStripePublishableKey,
  isStripeConfigured,
  stripeRequest,
  type StripeCheckoutSession,
  type StripeInvoicePreview,
} from '../_shared/stripe.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { denyWithoutPermission } from '../_shared/rbac.ts';

const READ_PERMISSION = 'finance.ar.view';
const WRITE_PERMISSION = 'admin.settings.update';

/**
 * Append Stripe's checkout-session placeholder to a return URL, respecting a
 * query string the URL already has.
 */
function withSessionId(target: string): string {
  return `${target}${target.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
}

/**
 * Turn a Stripe failure into a response the caller can act on (PROD-STRIPE-001).
 *
 * A card decline, an unknown price id and a missing coupon are all 4xx from
 * Stripe and all of them are the user's to fix - flattening them to 500 with a
 * generic message is what makes a payment screen unusable. Anything that is not
 * a StripeError is ours, and stays a 500.
 */
function stripeFailure(err: unknown, fallback: string, req: Request): Response {
  if (err instanceof StripeError) {
    console.error(
      `${fallback} (Stripe ${err.status}${err.stripeCode ? ` ${err.stripeCode}` : ''}):`,
      err.message,
    );
    const status = err.status >= 400 && err.status < 500 ? err.status : 502;
    return createCorsResponse({ error: fallback, message: err.message }, status, req);
  }
  console.error(`${fallback}:`, err);
  return createCorsResponse(
    { error: fallback, message: err instanceof Error ? err.message : 'Unknown error' },
    500,
    req,
  );
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID from user metadata
    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // SEC-EDGE-001: This tenant's own plan with Stripe. Reading it is the billing view /settings/subscription gates on; CHANGING it is a configuration act with an external side effect, which is admin.settings.update - there is no seeded code for "change our plan" and inventing one for a single endpoint would be worse than naming the one that means it.
    const denied = await denyWithoutPermission(
      admin,
      user,
      req.method === 'GET' || req.method === 'HEAD' ? READ_PERMISSION : WRITE_PERMISSION,
    );
    if (denied) return createCorsResponse(denied, 403, req);

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'subscriptions');

    // Route parsing (after function-name strip):
    // /subscriptions -> parts = []
    // /subscriptions/:id -> parts = [':id']
    // /subscriptions/:id/cancel -> parts = [':id', 'cancel']
    // /subscriptions/plans -> parts = ['plans']
    // /subscriptions/usage -> parts = ['usage']
    // /subscriptions/invoices -> parts = ['invoices']
    // /subscriptions/change-plan -> parts = ['change-plan']
    // /subscriptions/features -> parts = ['features']

    const secondSegment = parts[0];
    const thirdSegment = parts[1];

    // ========================================================================
    // GET /subscriptions/plans - List available subscription plans
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'plans') {
      const { data: plans, error } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('is_visible', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching subscription plans:', error);
        return createCorsResponse({ error: 'Failed to fetch subscription plans' }, 500, req);
      }

      // PROD-013. The shape is { plans, features }, matching the Express
      // handler this replaces and the one consumer, useSubscriptionPlans, which
      // reads both keys. It used to answer `{ data: plans }`, so the pricing
      // page would have rendered no plans and no feature comparison in
      // production even once its raw fetch was corrected - the URL and the
      // shape were two separate breakages on the same call.
      //
      // `features` here is the CATALOGUE, every row of subscription_features
      // in display order. It is not the /features branch below, which answers
      // what the CURRENT subscription entitles a tenant to.
      const { data: features, error: featuresError } = await admin
        .from('subscription_features')
        .select('*')
        .order('display_order', { ascending: true });

      if (featuresError) {
        console.error('Error fetching subscription features:', featuresError);
        return createCorsResponse({ error: 'Failed to fetch subscription features' }, 500, req);
      }

      return createCorsResponse({ plans: plans || [], features: features || [] }, 200, req);
    }

    // ========================================================================
    // STRIPE CHECKOUT, PORTAL, SETUP INTENT AND UPGRADE PREVIEW
    // (PROD-STRIPE-001)
    //
    // These seven paths existed only in server/routes-subscriptions.ts. That
    // router serves dev, where /api/subscriptions is unproxied and Express
    // answers it; in production getApiUrl sends the prefix to the functions
    // host and every one of them 404'd, so nobody could subscribe, open the
    // billing portal, add a card, or even read the publishable key the
    // Stripe.js widget needs to render. See _shared/stripe.ts for which host
    // owns what and why the webhook stays on Express.
    //
    // Response shapes are matched key for key against the hooks in
    // client/src/hooks/useSubscription.ts - a correct URL answering the wrong
    // keys is a second breakage on the same call, which is how the plans
    // branch above got its { plans, features } comment.
    // ========================================================================

    // GET /subscriptions/stripe/config -> { publishableKey }
    if (req.method === 'GET' && secondSegment === 'stripe' && thirdSegment === 'config') {
      const publishableKey = getStripePublishableKey();
      if (!isStripeConfigured() || !publishableKey) {
        return createCorsResponse(
          {
            error: 'Stripe is not configured',
            message: 'Payment processing is currently unavailable',
          },
          503,
          req,
        );
      }
      return createCorsResponse({ publishableKey }, 200, req);
    }

    // POST /subscriptions/checkout -> { sessionId, sessionUrl }
    if (req.method === 'POST' && secondSegment === 'checkout' && !thirdSegment) {
      if (!isStripeConfigured()) {
        return createCorsResponse(
          {
            error: 'Stripe is not configured',
            message: 'Payment processing is currently unavailable',
          },
          503,
          req,
        );
      }

      const body = await req.json().catch(() => ({}));
      const { planSlug, billingCycle, discountCode } = body as {
        planSlug?: string;
        billingCycle?: string;
        discountCode?: string;
      };

      if (!planSlug || !billingCycle) {
        return createCorsResponse(
          { error: 'Missing required fields: planSlug, billingCycle' },
          400,
          req,
        );
      }
      if (!['monthly', 'annual'].includes(billingCycle)) {
        return createCorsResponse(
          { error: 'Invalid billing cycle. Must be "monthly" or "annual"' },
          400,
          req,
        );
      }

      const { data: plan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (!plan) {
        return createCorsResponse({ error: 'Plan not found' }, 404, req);
      }

      const priceId =
        billingCycle === 'annual' ? plan.stripe_price_id_annual : plan.stripe_price_id_monthly;
      if (!priceId) {
        return createCorsResponse(
          {
            error: 'Stripe price ID not configured for this plan',
            message: 'Please contact support to set up payment for this plan',
          },
          400,
          req,
        );
      }

      const baseUrl = clientBaseUrl();
      const successUrl =
        Deno.env.get('STRIPE_CHECKOUT_SUCCESS_URL') ||
        `${baseUrl}/settings/subscription?success=true`;
      const cancelUrl =
        Deno.env.get('STRIPE_CHECKOUT_CANCEL_URL') || `${baseUrl}/pricing?canceled=true`;

      try {
        const customerId = await getOrCreateStripeCustomer(admin, tenantId, user.email);
        const trialDays = plan.trial_enabled ? plan.trial_days || 14 : 0;

        // Stripe rejects allow_promotion_codes together with discounts, so the
        // two are mutually exclusive here exactly as they are in the Express
        // handler this replaces.
        const payload: Record<string, unknown> = {
          mode: 'subscription',
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          // withSessionId, not a bare `?` append: the configured success URL
          // already carries ?success=true by default, and the Express handler
          // this replaces produced `...?success=true?session_id=...` - a second
          // question mark makes session_id part of the value of `success`, so
          // the page could never verify the checkout it had just completed.
          success_url: withSessionId(successUrl),
          cancel_url: cancelUrl,
          billing_address_collection: 'required',
          automatic_tax: { enabled: false },
          metadata: { tenantId, billingCycle, planSlug, planName: plan.name },
          subscription_data: { metadata: { tenantId, billingCycle } },
        };
        if (trialDays > 0) {
          (payload.subscription_data as Record<string, unknown>).trial_period_days = trialDays;
        }
        if (discountCode) {
          payload.discounts = [{ coupon: discountCode }];
        } else {
          payload.allow_promotion_codes = true;
        }

        const session = await stripeRequest<StripeCheckoutSession>('/checkout/sessions', {
          method: 'POST',
          body: payload,
        });

        return createCorsResponse({ sessionId: session.id, sessionUrl: session.url }, 200, req);
      } catch (err) {
        return stripeFailure(err, 'Failed to create checkout session', req);
      }
    }

    // POST /subscriptions/checkout/addon -> { sessionId, sessionUrl }
    if (req.method === 'POST' && secondSegment === 'checkout' && thirdSegment === 'addon') {
      if (!isStripeConfigured()) {
        return createCorsResponse(
          {
            error: 'Stripe is not configured',
            message: 'Payment processing is currently unavailable',
          },
          503,
          req,
        );
      }

      const body = await req.json().catch(() => ({}));
      const { addonSlug, quantity = 1 } = body as { addonSlug?: string; quantity?: number };
      if (!addonSlug) {
        return createCorsResponse({ error: 'Missing required field: addonSlug' }, 400, req);
      }

      const { data: addon } = await admin
        .from('subscription_addons')
        .select('*')
        .eq('slug', addonSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (!addon) {
        return createCorsResponse({ error: 'Add-on not found' }, 404, req);
      }
      if (!addon.stripe_price_id) {
        return createCorsResponse(
          {
            error: 'Stripe price ID not configured for this add-on',
            message: 'Please contact support to set up payment for this add-on',
          },
          400,
          req,
        );
      }

      const baseUrl = clientBaseUrl();
      try {
        const customerId = await getOrCreateStripeCustomer(admin, tenantId, user.email);
        const session = await stripeRequest<StripeCheckoutSession>('/checkout/sessions', {
          method: 'POST',
          body: {
            mode: 'payment',
            customer: customerId,
            line_items: [{ price: addon.stripe_price_id, quantity }],
            success_url: `${baseUrl}/settings/subscription?addon_success=true&addon=${encodeURIComponent(addonSlug)}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/settings/subscription?addon_canceled=true`,
            billing_address_collection: 'required',
            allow_promotion_codes: true,
            metadata: {
              tenantId,
              type: 'one_time_purchase',
              addonSlug,
              addonName: addon.name,
              category: addon.category,
            },
            payment_intent_data: { metadata: { tenantId, type: 'one_time_purchase' } },
          },
        });

        return createCorsResponse({ sessionId: session.id, sessionUrl: session.url }, 200, req);
      } catch (err) {
        return stripeFailure(err, 'Failed to create checkout session', req);
      }
    }

    // GET /subscriptions/checkout/session/:sessionId
    //   -> { id, status, paymentStatus, customerEmail, subscriptionId? }
    if (
      req.method === 'GET' &&
      secondSegment === 'checkout' &&
      thirdSegment === 'session' &&
      parts[2]
    ) {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }
      try {
        const session = await stripeRequest<StripeCheckoutSession>(
          `/checkout/sessions/${encodeURIComponent(parts[2])}`,
          { query: { 'expand[]': 'subscription' } },
        );

        // A session is readable by the tenant that created it and nobody else.
        // The id travels in a redirect URL, so possession of one is not
        // authorisation to read it.
        if (session.metadata?.tenantId !== tenantId) {
          return createCorsResponse({ error: 'Access denied to this session' }, 403, req);
        }

        return createCorsResponse(
          {
            id: session.id,
            status: session.status,
            paymentStatus: session.payment_status,
            customerEmail: session.customer_email,
            subscriptionId:
              typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id,
          },
          200,
          req,
        );
      } catch (err) {
        return stripeFailure(err, 'Failed to retrieve checkout session', req);
      }
    }

    // POST /subscriptions/portal -> { url }
    if (req.method === 'POST' && secondSegment === 'portal' && !thirdSegment) {
      if (!isStripeConfigured()) {
        return createCorsResponse(
          {
            error: 'Stripe is not configured',
            message: 'Billing management is currently unavailable',
          },
          503,
          req,
        );
      }

      const { data: tenant } = await admin
        .from('tenants')
        .select('metadata')
        .eq('id', tenantId)
        .maybeSingle();

      let customerId = (tenant?.metadata as Record<string, unknown> | null)?.stripeCustomerId as
        | string
        | undefined;

      if (!customerId) {
        const { data: sub } = await admin
          .from('tenant_subscriptions')
          .select('stripe_customer_id')
          .eq('tenant_id', tenantId)
          .not('stripe_customer_id', 'is', null)
          .limit(1)
          .maybeSingle();
        customerId = sub?.stripe_customer_id || undefined;
      }

      // The portal is not a place to create a customer: an account with no
      // Stripe history has nothing to manage, and silently minting one would
      // show an empty portal instead of saying why it is empty.
      if (!customerId) {
        return createCorsResponse(
          {
            error: 'No billing account found',
            message: 'Please complete a purchase first to access billing management',
          },
          400,
          req,
        );
      }

      const returnUrl =
        Deno.env.get('STRIPE_PORTAL_RETURN_URL') || `${clientBaseUrl()}/settings/billing`;

      try {
        const session = await stripeRequest<{ url: string }>('/billing_portal/sessions', {
          method: 'POST',
          body: { customer: customerId, return_url: returnUrl },
        });
        return createCorsResponse({ url: session.url }, 200, req);
      } catch (err) {
        return stripeFailure(err, 'Failed to create billing portal session', req);
      }
    }

    // POST /subscriptions/setup-intent -> { clientSecret }
    if (req.method === 'POST' && secondSegment === 'setup-intent' && !thirdSegment) {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }
      try {
        const customerId = await getOrCreateStripeCustomer(admin, tenantId, user.email);
        const setupIntent = await stripeRequest<{ client_secret: string }>('/setup_intents', {
          method: 'POST',
          body: {
            customer: customerId,
            payment_method_types: ['card'],
            metadata: { tenantId },
          },
        });
        return createCorsResponse({ clientSecret: setupIntent.client_secret }, 200, req);
      } catch (err) {
        return stripeFailure(err, 'Failed to create setup intent', req);
      }
    }

    // GET /subscriptions/preview-upgrade?newPlanSlug=&billingCycle=
    //   -> { currentPlan, newPlan, subtotal, total, amountDue, prorationAmount,
    //        currency, billingCycle }
    // Money comes back from Stripe in the smallest currency unit; every figure
    // here is divided by 100 before it is sent, matching the Express handler
    // and what the hook's consumer renders.
    if (req.method === 'GET' && secondSegment === 'preview-upgrade' && !thirdSegment) {
      if (!isStripeConfigured()) {
        return createCorsResponse({ error: 'Stripe is not configured' }, 503, req);
      }

      const newPlanSlug = url.searchParams.get('newPlanSlug');
      if (!newPlanSlug) {
        return createCorsResponse({ error: 'Missing required field: newPlanSlug' }, 400, req);
      }

      const { data: subscription } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription?.stripe_subscription_id) {
        return createCorsResponse(
          {
            error: 'No active Stripe subscription found',
            message: 'Cannot preview upgrade without an active Stripe subscription',
          },
          400,
          req,
        );
      }

      const { data: newPlan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', newPlanSlug)
        .maybeSingle();

      if (!newPlan) {
        return createCorsResponse({ error: 'Plan not found' }, 404, req);
      }

      const cycle = url.searchParams.get('billingCycle') || subscription.billing_cycle;
      const newPriceId =
        cycle === 'annual' ? newPlan.stripe_price_id_annual : newPlan.stripe_price_id_monthly;
      if (!newPriceId) {
        return createCorsResponse(
          { error: 'Stripe price ID not configured for this plan' },
          400,
          req,
        );
      }

      // The customer id is read off the subscription itself here rather than
      // resolved-or-created: previewing a change to an existing Stripe
      // subscription cannot be the moment a customer first comes into being.
      // The Express handler looked it up with a WHERE clause comparing a
      // tenant_subscriptions column against the tenants table, which is a
      // different row set - it read the wrong tenant's metadata or none.
      let customerId = subscription.stripe_customer_id as string | undefined;
      if (!customerId) {
        const { data: tenant } = await admin
          .from('tenants')
          .select('metadata')
          .eq('id', tenantId)
          .maybeSingle();
        customerId = (tenant?.metadata as Record<string, unknown> | null)?.stripeCustomerId as
          | string
          | undefined;
      }
      if (!customerId) {
        return createCorsResponse({ error: 'No Stripe customer found' }, 400, req);
      }

      try {
        const current = await stripeRequest<{ items?: { data?: Array<{ id: string }> } }>(
          `/subscriptions/${encodeURIComponent(subscription.stripe_subscription_id)}`,
        );
        const itemId = current.items?.data?.[0]?.id;
        if (!itemId) {
          return createCorsResponse(
            { error: 'Stripe subscription has no billable item to reprice' },
            400,
            req,
          );
        }

        const invoice = await stripeRequest<StripeInvoicePreview>('/invoices/upcoming', {
          query: {
            customer: customerId,
            subscription: subscription.stripe_subscription_id,
            subscription_items: [{ id: itemId, price: newPriceId }],
          },
        });

        return createCorsResponse(
          {
            currentPlan: subscription.plan_id,
            newPlan: newPlan.slug,
            subtotal: (invoice.subtotal || 0) / 100,
            total: (invoice.total || 0) / 100,
            amountDue: (invoice.amount_due || 0) / 100,
            prorationAmount: ((invoice.total || 0) - (invoice.subtotal || 0)) / 100,
            currency: invoice.currency?.toUpperCase() || 'USD',
            billingCycle: cycle,
          },
          200,
          req,
        );
      } catch (err) {
        return stripeFailure(err, 'Failed to preview upgrade', req);
      }
    }

    // ========================================================================
    // GET /subscriptions/usage - Get usage metrics against limits
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'usage') {
      // Get the current subscription for the tenant
      const { data: subscription, error: subError } = await admin
        .from('tenant_subscriptions')
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription for usage:', subError);
        return createCorsResponse({ error: 'Failed to fetch subscription' }, 500, req);
      }

      if (!subscription) {
        return createCorsResponse({ error: 'No active subscription found' }, 404, req);
      }

      // Get current usage metrics
      const now = new Date();
      const periodStart = subscription.current_period_start || now.toISOString();
      const periodEnd = subscription.current_period_end || now.toISOString();

      const { data: usageMetrics, error: usageError } = await admin
        .from('usage_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Calculate usage against limits
      const plan = subscription.plan;
      const customLimits = subscription.custom_limits || {};

      const limits = {
        maxUsers: customLimits.maxUsers ?? plan?.max_users ?? -1,
        maxStorage: customLimits.maxStorage ?? plan?.max_storage ?? -1,
        maxApiCalls: customLimits.maxApiCalls ?? plan?.max_api_calls ?? -1,
        maxLocations: customLimits.maxLocations ?? plan?.max_locations ?? -1,
        maxBusinessRecords: customLimits.maxBusinessRecords ?? plan?.max_business_records ?? -1,
      };

      const currentUsage = {
        activeUsers: usageMetrics?.active_users ?? 0,
        totalUsers: usageMetrics?.total_users ?? 0,
        storageUsedMb: usageMetrics?.storage_used_mb ?? 0,
        apiCalls: usageMetrics?.api_calls ?? 0,
        activeLocations: usageMetrics?.active_locations ?? 0,
        businessRecords: usageMetrics?.business_records ?? 0,
      };

      // Calculate percentage used for each metric
      const calculatePercentage = (used: number, limit: number): number => {
        if (limit === -1) return 0; // Unlimited
        if (limit === 0) return 100; // No allowance
        return Math.min(100, Math.round((used / limit) * 100));
      };

      const usageSummary = {
        users: {
          used: currentUsage.totalUsers,
          limit: limits.maxUsers,
          percentage: calculatePercentage(currentUsage.totalUsers, limits.maxUsers),
          isUnlimited: limits.maxUsers === -1,
        },
        storage: {
          usedMb: currentUsage.storageUsedMb,
          usedGb: Math.round((currentUsage.storageUsedMb / 1024) * 100) / 100,
          limitGb: limits.maxStorage,
          percentage: calculatePercentage(currentUsage.storageUsedMb / 1024, limits.maxStorage),
          isUnlimited: limits.maxStorage === -1,
        },
        apiCalls: {
          used: currentUsage.apiCalls,
          limit: limits.maxApiCalls,
          percentage: calculatePercentage(currentUsage.apiCalls, limits.maxApiCalls),
          isUnlimited: limits.maxApiCalls === -1,
        },
        locations: {
          used: currentUsage.activeLocations,
          limit: limits.maxLocations,
          percentage: calculatePercentage(currentUsage.activeLocations, limits.maxLocations),
          isUnlimited: limits.maxLocations === -1,
        },
        businessRecords: {
          used: currentUsage.businessRecords,
          limit: limits.maxBusinessRecords,
          percentage: calculatePercentage(currentUsage.businessRecords, limits.maxBusinessRecords),
          isUnlimited: limits.maxBusinessRecords === -1,
        },
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
          usage: usageSummary,
          raw: usageMetrics,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /subscriptions/invoices - Get subscription invoices
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'invoices') {
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

      if (status) {
        query = query.eq('status', status);
      }

      const { data: invoices, error, count } = await query;

      if (error) {
        console.error('Error fetching subscription invoices:', error);
        return createCorsResponse({ error: 'Failed to fetch invoices' }, 500, req);
      }

      return createCorsResponse(
        {
          data: invoices || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /subscriptions/features - Get features for current plan
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'features') {
      // Get the current subscription
      const { data: subscription, error: subError } = await admin
        .from('tenant_subscriptions')
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription for features:', subError);
        return createCorsResponse({ error: 'Failed to fetch subscription' }, 500, req);
      }

      if (!subscription) {
        return createCorsResponse({ error: 'No active subscription found' }, 404, req);
      }

      // Get all features
      const { data: allFeatures, error: featuresError } = await admin
        .from('subscription_features')
        .select('*')
        .order('display_order', { ascending: true });

      if (featuresError) {
        console.error('Error fetching features:', featuresError);
        return createCorsResponse({ error: 'Failed to fetch features' }, 500, req);
      }

      // Get the feature slugs included in the plan
      const planFeatures = subscription.plan?.features || [];

      // Mark which features are enabled for this plan
      const featuresWithStatus = (allFeatures || []).map((feature) => ({
        ...feature,
        isEnabled: planFeatures.includes(feature.slug) || feature.is_core,
      }));

      return createCorsResponse(
        {
          planName: subscription.plan?.name,
          planSlug: subscription.plan?.slug,
          features: featuresWithStatus,
          enabledFeatureSlugs: planFeatures,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // POST /subscriptions/change-plan - Change to a different plan
    // ========================================================================
    if (req.method === 'POST' && secondSegment === 'change-plan') {
      const body = await req.json();
      const newPlanId = body.planId || body.plan_id;
      const billingCycle = body.billingCycle || body.billing_cycle;

      if (!newPlanId) {
        return createCorsResponse({ error: 'Plan ID is required' }, 400, req);
      }

      // Get the current subscription
      const { data: currentSubscription, error: currentSubError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (currentSubError && currentSubError.code !== 'PGRST116') {
        console.error('Error fetching current subscription:', currentSubError);
        return createCorsResponse({ error: 'Failed to fetch current subscription' }, 500, req);
      }

      // Get the new plan
      const { data: newPlan, error: planError } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('id', newPlanId)
        .eq('is_active', true)
        .single();

      if (planError || !newPlan) {
        return createCorsResponse({ error: 'Invalid plan ID' }, 400, req);
      }

      const selectedBillingCycle = billingCycle || currentSubscription?.billing_cycle || 'monthly';
      const newAmount =
        selectedBillingCycle === 'annual' ? newPlan.annual_price : newPlan.monthly_price;

      // Calculate new period end
      const now = new Date();
      const periodEnd = new Date(now);
      if (selectedBillingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        // addMonths clamps: a subscription started on 31 January bills again on
        // 28 February, not on 3 March. setMonth overflows, which silently gave
        // some customers a 31-day first period and skipped a month boundary.
        periodEnd.setTime(addMonths(periodEnd, 1).getTime());
      }

      if (currentSubscription) {
        // Update existing subscription
        const fromPlanId = currentSubscription.plan_id;

        const { data: updatedSubscription, error: updateError } = await admin
          .from('tenant_subscriptions')
          .update({
            plan_id: newPlanId,
            billing_cycle: selectedBillingCycle,
            amount: newAmount,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', currentSubscription.id)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          return createCorsResponse({ error: 'Failed to change plan' }, 500, req);
        }

        // Log the plan change event
        await admin.from('subscription_events').insert({
          tenant_id: tenantId,
          subscription_id: currentSubscription.id,
          event_type: 'plan_changed',
          user_id: user.id,
          from_plan: fromPlanId,
          to_plan: newPlanId,
          data: {
            fromBillingCycle: currentSubscription.billing_cycle,
            toBillingCycle: selectedBillingCycle,
            fromAmount: currentSubscription.amount,
            toAmount: newAmount,
          },
          created_at: now.toISOString(),
        });

        return createCorsResponse(
          {
            message: 'Plan changed successfully',
            subscription: updatedSubscription,
          },
          200,
          req,
        );
      } else {
        // Create new subscription
        const { data: newSubscription, error: createError } = await admin
          .from('tenant_subscriptions')
          .insert({
            tenant_id: tenantId,
            plan_id: newPlanId,
            status: 'active',
            billing_cycle: selectedBillingCycle,
            start_date: now.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            amount: newAmount,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating subscription:', createError);
          return createCorsResponse({ error: 'Failed to create subscription' }, 500, req);
        }

        // Log the subscription creation event
        await admin.from('subscription_events').insert({
          tenant_id: tenantId,
          subscription_id: newSubscription.id,
          event_type: 'created',
          user_id: user.id,
          to_plan: newPlanId,
          data: {
            billingCycle: selectedBillingCycle,
            amount: newAmount,
          },
          created_at: now.toISOString(),
        });

        return createCorsResponse(
          {
            message: 'Subscription created successfully',
            subscription: newSubscription,
          },
          201,
          req,
        );
      }
    }

    // ========================================================================
    // GET  /subscriptions/notifications            - the banner's alert list
    // POST /subscriptions/notifications/:id/dismiss
    //
    // PROD-014: both were Express-only, so the banner had no notifications in
    // production and dismissing one did nothing. Ported straight across — the
    // filter (this tenant, this user, not already dismissed) and the 50-row cap
    // match server/routes-subscriptions.ts, and the body is { notifications }
    // exactly as the hook expects.
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'notifications' && !thirdSegment) {
      let query = admin
        .from('subscription_notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(50);

      // Express narrows to the caller when it knows them; so do we.
      if (user?.id) query = query.eq('user_id', user.id);

      const { data: notifications, error } = await query;

      if (error) {
        console.error('Error fetching subscription notifications:', error);
        return createCorsResponse(
          { error: 'Failed to fetch notifications', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse({ notifications: notifications ?? [] }, 200, req);
    }

    if (
      req.method === 'POST' &&
      secondSegment === 'notifications' &&
      thirdSegment &&
      parts[2] === 'dismiss'
    ) {
      const nowIso = new Date().toISOString();
      const { error } = await admin
        .from('subscription_notifications')
        .update({ status: 'dismissed', dismissed_at: nowIso, updated_at: nowIso })
        .eq('id', thirdSegment)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error dismissing subscription notification:', error);
        return createCorsResponse(
          { error: 'Failed to dismiss notification', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    // ========================================================================
    // GET /subscriptions/current - the shape SubscriptionBanner reads
    //
    // PROD-014: this endpoint existed only on Express, and SubscriptionBanner is
    // mounted in App.tsx — so on every page in production the banner asked for a
    // plan/usage/trial state that nothing answered. The arithmetic (limit merge,
    // overage test, day counts) comes from _shared/subscription-status.ts, which
    // server/lib/subscription-status.ts mirrors, so both backends agree.
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'current') {
      const { data: subscription, error } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching current subscription:', error);
        return createCorsResponse(
          { error: 'Failed to fetch subscription status', details: error.message },
          500,
          req,
        );
      }

      if (!subscription) {
        // Same body Express returns, so the hook's `hasSubscription` check works
        // identically against either backend.
        return createCorsResponse(
          { hasSubscription: false, message: 'No active subscription' },
          200,
          req,
        );
      }

      const { data: plan, error: planError } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('id', subscription.plan_id)
        .maybeSingle();

      if (planError || !plan) {
        console.error('Plan not found for subscription:', planError);
        return createCorsResponse(
          { error: 'Plan not found for subscription', code: 'PLAN_NOT_FOUND' },
          500,
          req,
        );
      }

      const nowIso = new Date().toISOString();
      const { data: usage } = await admin
        .from('usage_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .lte('period_start', nowIso)
        .gte('period_end', nowIso)
        .limit(1)
        .maybeSingle();

      return createCorsResponse(
        buildSubscriptionStatus(subscription, plan, usage, new Date()),
        200,
        req,
      );
    }

    // ========================================================================
    // GET /subscriptions - Get current subscription for tenant
    // ========================================================================
    if (req.method === 'GET' && !secondSegment) {
      const { data: subscription, error } = await admin
        .from('tenant_subscriptions')
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return createCorsResponse({ error: 'Failed to fetch subscription' }, 500, req);
      }

      if (!subscription) {
        return createCorsResponse(
          {
            message: 'No active subscription found',
            subscription: null,
          },
          200,
          req,
        );
      }

      return createCorsResponse({ subscription }, 200, req);
    }

    // ========================================================================
    // POST /subscriptions - Create/start a new subscription
    // ========================================================================
    if (req.method === 'POST' && !secondSegment) {
      const body = await req.json();
      const planId = body.planId || body.plan_id;
      const billingCycle = body.billingCycle || body.billing_cycle || 'monthly';
      const startTrial = body.startTrial || body.start_trial || false;

      if (!planId) {
        return createCorsResponse({ error: 'Plan ID is required' }, 400, req);
      }

      // Check if tenant already has an active subscription
      const { data: existingSubscription } = await admin
        .from('tenant_subscriptions')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .single();

      if (existingSubscription) {
        return createCorsResponse(
          {
            error:
              'Tenant already has an active subscription. Use change-plan endpoint to switch plans.',
            existingSubscriptionId: existingSubscription.id,
          },
          409,
          req,
        );
      }

      // Get the plan
      const { data: plan, error: planError } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .eq('is_active', true)
        .single();

      if (planError || !plan) {
        return createCorsResponse({ error: 'Invalid plan ID' }, 400, req);
      }

      const now = new Date();
      const periodEnd = new Date(now);

      // Calculate trial end or period end
      let isTrialing = false;
      let trialStartDate: string | null = null;
      let trialEndDate: string | null = null;

      if (startTrial && plan.trial_enabled) {
        isTrialing = true;
        trialStartDate = now.toISOString();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + (plan.trial_days || 14));
        trialEndDate = trialEnd.toISOString();
        periodEnd.setDate(periodEnd.getDate() + (plan.trial_days || 14));
      } else if (billingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        // addMonths clamps: a subscription started on 31 January bills again on
        // 28 February, not on 3 March. setMonth overflows, which silently gave
        // some customers a 31-day first period and skipped a month boundary.
        periodEnd.setTime(addMonths(periodEnd, 1).getTime());
      }

      const amount = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;

      const subscriptionData = {
        tenant_id: tenantId,
        plan_id: planId,
        status: isTrialing ? 'trialing' : 'active',
        billing_cycle: billingCycle,
        start_date: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        is_trialing: isTrialing,
        trial_start_date: trialStartDate,
        trial_end_date: trialEndDate,
        amount: amount,
        currency: 'USD',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const { data: subscription, error: createError } = await admin
        .from('tenant_subscriptions')
        .insert(subscriptionData)
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .single();

      if (createError) {
        console.error('Error creating subscription:', createError);
        return createCorsResponse(
          { error: 'Failed to create subscription', details: createError },
          500,
          req,
        );
      }

      // Log subscription event
      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscription.id,
        event_type: isTrialing ? 'trial_started' : 'created',
        user_id: user.id,
        to_plan: planId,
        data: {
          billingCycle,
          amount,
          isTrialing,
          trialDays: isTrialing ? plan.trial_days : null,
        },
        created_at: now.toISOString(),
      });

      return createCorsResponse({ subscription }, 201, req);
    }

    // ========================================================================
    // PUT /subscriptions/:id - Update subscription
    // ========================================================================
    if ((req.method === 'PUT' || req.method === 'PATCH') && secondSegment && !thirdSegment) {
      const subscriptionId = secondSegment;
      const body = await req.json();

      // Verify the subscription belongs to this tenant
      const { data: existingSubscription, error: fetchError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingSubscription) {
        return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Allow updating specific fields
      if (body.billingCycle !== undefined || body.billing_cycle !== undefined) {
        updateData.billing_cycle = body.billingCycle || body.billing_cycle;
      }
      if (body.notes !== undefined) {
        updateData.notes = body.notes;
      }
      if (body.metadata !== undefined) {
        updateData.metadata = body.metadata;
      }

      const { data: updatedSubscription, error: updateError } = await admin
        .from('tenant_subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .single();

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return createCorsResponse({ error: 'Failed to update subscription' }, 500, req);
      }

      return createCorsResponse({ subscription: updatedSubscription }, 200, req);
    }

    // ========================================================================
    // POST /subscriptions/create - Start a subscription for the tenant
    //
    // PROD-014: Express-only, so in production nothing could start a
    // subscription. Note the frontend sends a plan SLUG, not the plan id the
    // change-plan branch above takes — resolving by id here would reject every
    // real request.
    // ========================================================================
    if (req.method === 'POST' && secondSegment === 'create' && !thirdSegment) {
      const body = await req.json().catch(() => ({}));
      const planSlug = body.planSlug || body.plan_slug;
      const billingCycle = body.billingCycle || body.billing_cycle;
      const startTrial = body.startTrial !== false && body.start_trial !== false;

      if (!planSlug || !billingCycle) {
        return createCorsResponse(
          { error: 'Missing required fields: planSlug, billingCycle' },
          400,
          req,
        );
      }
      if (!['monthly', 'annual'].includes(billingCycle)) {
        return createCorsResponse(
          { error: 'Invalid billing cycle. Must be "monthly" or "annual"' },
          400,
          req,
        );
      }

      // Refusing a second subscription is what keeps a tenant from being billed
      // twice; Express checks the same two statuses.
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
            message: 'Use the upgrade endpoint to change plans',
          },
          400,
          req,
        );
      }

      const { data: plan, error: planError } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .maybeSingle();

      if (planError) {
        console.error('Error loading plan:', planError);
        return createCorsResponse(
          { error: 'Failed to create subscription', message: planError.message },
          500,
          req,
        );
      }
      if (!plan) {
        return createCorsResponse(
          { error: 'Failed to create subscription', message: `Plan not found: ${planSlug}` },
          404,
          req,
        );
      }
      if (!plan.is_active || !plan.is_visible) {
        return createCorsResponse(
          { error: 'Failed to create subscription', message: `Plan is not available: ${planSlug}` },
          400,
          req,
        );
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const { isTrialing, trialEndDate, currentPeriodEnd } = resolveTrialPeriod(
        plan,
        startTrial,
        billingCycle,
        now,
      );
      const amount = planAmount(plan, billingCycle);

      const { data: subscription, error: insertError } = await admin
        .from('tenant_subscriptions')
        .insert({
          tenant_id: tenantId,
          plan_id: plan.id,
          status: isTrialing ? 'trialing' : 'active',
          billing_cycle: billingCycle,
          billing_interval: 1,
          start_date: nowIso,
          current_period_start: nowIso,
          current_period_end: currentPeriodEnd.toISOString(),
          is_trialing: isTrialing,
          trial_start_date: isTrialing ? nowIso : null,
          trial_end_date: isTrialing && trialEndDate ? trialEndDate.toISOString() : null,
          amount: amount.toFixed(2),
          currency: 'USD',
          discount_amount: '0.00',
          discount_percent: 0,
          is_free: false,
          custom_pricing: false,
          usage_based_billing: false,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Error creating subscription:', insertError);
        return createCorsResponse(
          { error: 'Failed to create subscription', message: insertError.message },
          500,
          req,
        );
      }

      const { error: tenantError } = await admin
        .from('tenants')
        .update({
          plan: planSlug,
          subscription: subscription.status,
          billing_status: isTrialing ? 'trialing' : 'pending',
          updated_at: nowIso,
        })
        .eq('id', tenantId);
      if (tenantError) console.error('Error updating tenant after create:', tenantError);

      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscription.id,
        event_type: isTrialing ? 'trial_started' : 'created',
        user_id: user.id,
        to_plan: planSlug,
        data: {
          plan: planSlug,
          billingCycle,
          amount,
          trialDays: plan.trial_days,
        },
        created_at: nowIso,
      });

      await admin.from('subscription_notifications').insert({
        tenant_id: tenantId,
        user_id: user.id,
        type: isTrialing ? 'trial_started' : 'subscription_created',
        priority: 'normal',
        title: isTrialing ? 'Trial Started!' : 'Subscription Activated',
        message: isTrialing
          ? `Your ${plan.trial_days}-day trial of the ${plan.name} plan has started. Explore all features!`
          : `Your ${plan.name} subscription is now active. Welcome aboard!`,
        action_url: '/settings/subscription',
        action_text: 'View Subscription',
        channels: ['in_app', 'email'],
        created_at: nowIso,
        updated_at: nowIso,
      });

      return createCorsResponse(
        { subscription, message: 'Subscription created successfully' },
        201,
        req,
      );
    }

    // ========================================================================
    // POST /subscriptions/upgrade - Move the tenant to a different plan
    //
    // PROD-014: Express-only. Distinct from change-plan above, which takes a
    // plan id and creates a subscription when there is none; this takes the
    // SLUG the frontend sends and requires an existing subscription, matching
    // SubscriptionService.changeSubscription.
    // ========================================================================
    if (req.method === 'POST' && secondSegment === 'upgrade' && !thirdSegment) {
      const body = await req.json().catch(() => ({}));
      const newPlanSlug = body.newPlanSlug || body.new_plan_slug;
      const requestedCycle = body.billingCycle || body.billing_cycle;
      const immediate = body.immediate !== false;

      if (!newPlanSlug) {
        return createCorsResponse({ error: 'Missing required field: newPlanSlug' }, 400, req);
      }

      // Express refuses a scheduled change rather than pretending to book one.
      if (!immediate) {
        return createCorsResponse(
          {
            error: 'Failed to upgrade subscription',
            message: 'Scheduled plan changes not yet implemented',
          },
          501,
          req,
        );
      }

      const { data: currentSubscription, error: currentError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentError) {
        console.error('Error loading subscription to upgrade:', currentError);
        return createCorsResponse(
          { error: 'Failed to upgrade subscription', message: currentError.message },
          500,
          req,
        );
      }
      if (!currentSubscription) {
        return createCorsResponse(
          { error: 'Failed to upgrade subscription', message: 'No active subscription found' },
          404,
          req,
        );
      }

      const { data: newPlan } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('slug', newPlanSlug)
        .maybeSingle();

      if (!newPlan) {
        return createCorsResponse(
          {
            error: 'Failed to upgrade subscription',
            message: `Plan not found: ${newPlanSlug}`,
          },
          404,
          req,
        );
      }

      const { data: currentPlan } = await admin
        .from('subscription_plans')
        .select('slug')
        .eq('id', currentSubscription.plan_id)
        .maybeSingle();

      const newBillingCycle = requestedCycle || currentSubscription.billing_cycle;
      const newAmount = planAmount(newPlan, newBillingCycle);
      const now = new Date();
      const nowIso = now.toISOString();

      const { data: subscription, error: updateError } = await admin
        .from('tenant_subscriptions')
        .update({
          plan_id: newPlan.id,
          billing_cycle: newBillingCycle,
          amount: newAmount.toFixed(2),
          updated_at: nowIso,
        })
        .eq('id', currentSubscription.id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error upgrading subscription:', updateError);
        return createCorsResponse(
          { error: 'Failed to upgrade subscription', message: updateError.message },
          500,
          req,
        );
      }

      const { error: tenantError } = await admin
        .from('tenants')
        .update({ plan: newPlanSlug, updated_at: nowIso })
        .eq('id', tenantId);
      if (tenantError) console.error('Error updating tenant after upgrade:', tenantError);

      // A subscription with no recorded amount would otherwise compare NaN and
      // read as a downgrade; the shared helper treats absent as zero.
      const isUpgrade = isUpgradeAmount(newAmount, currentSubscription.amount);

      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: currentSubscription.id,
        event_type: isUpgrade ? 'upgraded' : 'downgraded',
        user_id: user.id,
        from_plan: currentPlan?.slug ?? null,
        to_plan: newPlanSlug,
        data: {
          fromAmount: currentSubscription.amount,
          toAmount: newAmount,
          billingCycle: newBillingCycle,
        },
        created_at: nowIso,
      });

      await admin.from('subscription_notifications').insert({
        tenant_id: tenantId,
        user_id: user.id,
        type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
        priority: 'normal',
        title: isUpgrade ? 'Plan Upgraded!' : 'Plan Changed',
        message: `Your subscription has been ${isUpgrade ? 'upgraded' : 'changed'} to the ${newPlan.name} plan.`,
        action_url: '/settings/subscription',
        action_text: 'View Details',
        channels: ['in_app', 'email'],
        created_at: nowIso,
        updated_at: nowIso,
      });

      return createCorsResponse(
        { subscription, message: 'Subscription updated successfully' },
        200,
        req,
      );
    }

    // ========================================================================
    // POST /subscriptions/cancel - Cancel the tenant's subscription
    //
    // PROD-014: SubscriptionSettings.tsx posts here, not to :id/cancel, and no
    // edge function answered the path — so in production the Cancel button 404'd
    // and the subscription stayed active. The tenant row update, the
    // cancellation event and the acknowledgement email all come from
    // SubscriptionService.cancelSubscription; the email body is shared with the
    // Node copy via _shared/cancellation-email.ts (LEGAL-011 wants both
    // backends to say the same thing).
    // ========================================================================
    if (req.method === 'POST' && secondSegment === 'cancel' && !thirdSegment) {
      const body = await req.json().catch(() => ({}));
      const immediate = body.immediate === true;

      const { data: subscription, error: fetchError } = await admin
        .from('tenant_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading subscription to cancel:', fetchError);
        return createCorsResponse(
          { error: 'Failed to cancel subscription', message: fetchError.message },
          500,
          req,
        );
      }
      if (!subscription) {
        return createCorsResponse(
          { error: 'Failed to cancel subscription', message: 'No active subscription found' },
          404,
          req,
        );
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const subscriptionUpdate: Record<string, unknown> = {
        canceled_at: nowIso,
        updated_at: nowIso,
      };
      if (immediate) {
        subscriptionUpdate.status = 'canceled';
        subscriptionUpdate.ended_at = nowIso;
      } else {
        subscriptionUpdate.cancel_at = subscription.current_period_end;
      }

      const { error: updateError } = await admin
        .from('tenant_subscriptions')
        .update(subscriptionUpdate)
        .eq('id', subscription.id)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Error canceling subscription:', updateError);
        return createCorsResponse(
          { error: 'Failed to cancel subscription', message: updateError.message },
          500,
          req,
        );
      }

      // Express only touches the tenant row on an immediate cancellation; an
      // end-of-period cancellation leaves the tenant active until it lapses.
      if (immediate) {
        const { error: tenantError } = await admin
          .from('tenants')
          .update({
            subscription: 'canceled',
            billing_status: 'canceled',
            is_active: false,
            updated_at: nowIso,
          })
          .eq('id', tenantId);
        if (tenantError) console.error('Error deactivating tenant on cancel:', tenantError);
      }

      const effectiveDate = immediate
        ? now
        : subscription.current_period_end
          ? new Date(subscription.current_period_end)
          : now;

      // Resolve the recipient before writing the event, so the event records
      // what actually happened rather than what was intended.
      let confirmationSent = false;
      let confirmationError: string | undefined;
      let recipientEmail: string | undefined;
      let tenantName = 'your organization';

      const { data: tenantRow } = await admin
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle();
      if (tenantRow?.name) tenantName = tenantRow.name;

      const { data: adminUser } = await admin
        .from('users')
        .select('email')
        .eq('tenant_id', tenantId)
        .not('email', 'is', null)
        .limit(1)
        .maybeSingle();
      if (adminUser?.email) recipientEmail = adminUser.email;

      if (recipientEmail) {
        try {
          const { subject, html, text } = buildCancellationEmail({
            recipientEmail,
            tenantName,
            planName: subscription.plan?.name,
            immediate,
            effectiveDate,
          });
          await sendEmail({
            to: recipientEmail,
            from: Deno.env.get('DEFAULT_FROM_EMAIL') || 'noreply@printyx.net',
            subject,
            html,
            text,
          });
          confirmationSent = true;
        } catch (err) {
          // A cancellation that succeeded must not report failure because the
          // mail server was down — but the miss is recorded, not swallowed.
          confirmationError = err instanceof Error ? err.message : String(err);
          console.error('Cancellation confirmation email failed:', confirmationError);
        }
      } else {
        confirmationError = 'no recipient email found for tenant';
        console.error(`Cancellation for tenant ${tenantId}: ${confirmationError}`);
      }

      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscription.id,
        event_type: 'canceled',
        user_id: user.id,
        data: {
          immediate,
          cancelDate: effectiveDate.toISOString(),
          effectiveDate: effectiveDate.toISOString(),
          mode: immediate ? 'immediate' : 'end_of_period',
          canceledAt: nowIso,
          planId: subscription.plan_id,
          confirmationSent,
          confirmationRecipient: recipientEmail ?? null,
          confirmationError: confirmationError ?? null,
        },
        created_at: nowIso,
      });

      // In-app copy of the same confirmation, so it does not depend on email
      // delivery succeeding.
      await admin.from('subscription_notifications').insert({
        tenant_id: tenantId,
        user_id: user.id,
        type: 'subscription_canceled',
        priority: 'high',
        title: 'Subscription Canceled',
        message: immediate
          ? `Your subscription was canceled immediately and access ended on ${effectiveDate.toLocaleDateString()}. You will not be charged again.`
          : `Your subscription is canceled and will not renew. You keep access until ${effectiveDate.toLocaleDateString()}. You will not be charged again.`,
        action_url: '/settings/subscription',
        action_text: 'Reactivate',
        channels: ['in_app', 'email'],
        created_at: nowIso,
        updated_at: nowIso,
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

    // ========================================================================
    // POST /subscriptions/convert-trial - Turn a trial into a paid subscription
    //
    // PROD-014: Express-only, so in production a trialing tenant could not
    // convert. The renewal date comes from nextPeriodEnd() in
    // _shared/subscription-status.ts, which the Node service also calls — a
    // customer whose renewal lands on a different day depending on which
    // backend answered is a billing dispute.
    // ========================================================================
    if (req.method === 'POST' && secondSegment === 'convert-trial' && !thirdSegment) {
      const { data: subscription, error: fetchError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'trialing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading trial subscription:', fetchError);
        return createCorsResponse(
          { error: 'Failed to convert trial', message: fetchError.message },
          500,
          req,
        );
      }
      if (!subscription) {
        return createCorsResponse(
          { error: 'Failed to convert trial', message: 'No trial subscription found' },
          404,
          req,
        );
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const newPeriodEnd = nextPeriodEnd(now, subscription.billing_cycle);

      const { data: updatedSubscription, error: updateError } = await admin
        .from('tenant_subscriptions')
        .update({
          status: 'active',
          is_trialing: false,
          current_period_start: nowIso,
          current_period_end: newPeriodEnd.toISOString(),
          updated_at: nowIso,
        })
        .eq('id', subscription.id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error converting trial:', updateError);
        return createCorsResponse(
          { error: 'Failed to convert trial', message: updateError.message },
          500,
          req,
        );
      }

      const { error: tenantError } = await admin
        .from('tenants')
        .update({ subscription: 'active', billing_status: 'current', updated_at: nowIso })
        .eq('id', tenantId);
      if (tenantError) console.error('Error updating tenant after trial conversion:', tenantError);

      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscription.id,
        event_type: 'trial_converted',
        user_id: user.id,
        data: {
          trialEndDate: subscription.trial_end_date,
          conversionDate: nowIso,
        },
        created_at: nowIso,
      });

      await admin.from('subscription_notifications').insert({
        tenant_id: tenantId,
        user_id: user.id,
        type: 'trial_converted',
        priority: 'normal',
        title: 'Trial Converted!',
        message: 'Your trial has been successfully converted to a paid subscription.',
        action_url: '/settings/subscription',
        action_text: 'View Subscription',
        channels: ['in_app', 'email'],
        created_at: nowIso,
        updated_at: nowIso,
      });

      return createCorsResponse(
        {
          subscription: updatedSubscription,
          message: 'Trial converted to paid subscription successfully',
        },
        200,
        req,
      );
    }

    // ========================================================================
    // POST /subscriptions/:id/cancel - Cancel subscription
    // ========================================================================
    if (req.method === 'POST' && thirdSegment === 'cancel') {
      const subscriptionId = secondSegment;
      const body = await req.json().catch(() => ({}));
      const cancelImmediately = body.cancelImmediately || body.cancel_immediately || false;
      const reason = body.reason || null;

      // Verify the subscription belongs to this tenant
      const { data: subscription, error: fetchError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !subscription) {
        return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      }

      if (subscription.status === 'canceled') {
        return createCorsResponse({ error: 'Subscription is already canceled' }, 400, req);
      }

      const now = new Date();
      const updateData: Record<string, unknown> = {
        canceled_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      if (cancelImmediately) {
        updateData.status = 'canceled';
        updateData.ended_at = now.toISOString();
      } else {
        // Cancel at end of current period
        updateData.cancel_at = subscription.current_period_end;
      }

      const { data: updatedSubscription, error: updateError } = await admin
        .from('tenant_subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .single();

      if (updateError) {
        console.error('Error canceling subscription:', updateError);
        return createCorsResponse({ error: 'Failed to cancel subscription' }, 500, req);
      }

      // Log cancellation event
      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        event_type: 'canceled',
        user_id: user.id,
        data: {
          cancelImmediately,
          reason,
          cancelAt: cancelImmediately ? now.toISOString() : subscription.current_period_end,
        },
        created_at: now.toISOString(),
      });

      return createCorsResponse(
        {
          message: cancelImmediately
            ? 'Subscription canceled immediately'
            : 'Subscription will be canceled at the end of the current billing period',
          subscription: updatedSubscription,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // POST /subscriptions/:id/resume - Resume a canceled subscription
    // ========================================================================
    if (req.method === 'POST' && thirdSegment === 'resume') {
      const subscriptionId = secondSegment;

      // Verify the subscription belongs to this tenant
      const { data: subscription, error: fetchError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !subscription) {
        return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      }

      // Can only resume if scheduled for cancellation (has cancel_at but not ended)
      if (!subscription.cancel_at && subscription.status !== 'canceled') {
        return createCorsResponse(
          { error: 'Subscription is not scheduled for cancellation' },
          400,
          req,
        );
      }

      // If already fully canceled, check if within grace period (30 days)
      if (subscription.status === 'canceled' && subscription.ended_at) {
        const endedAt = new Date(subscription.ended_at);
        const gracePeriodEnd = new Date(endedAt);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

        if (new Date() > gracePeriodEnd) {
          return createCorsResponse(
            {
              error: 'Subscription grace period has expired. Please create a new subscription.',
            },
            400,
            req,
          );
        }
      }

      const now = new Date();

      // Calculate new period if subscription was fully canceled
      let newPeriodEnd = subscription.current_period_end;
      if (subscription.status === 'canceled') {
        newPeriodEnd = new Date(now);
        if (subscription.billing_cycle === 'annual') {
          newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
        } else {
          newPeriodEnd.setTime(addMonths(newPeriodEnd, 1).getTime());
        }
        newPeriodEnd = newPeriodEnd.toISOString();
      }

      const updateData: Record<string, unknown> = {
        status: subscription.is_trialing ? 'trialing' : 'active',
        cancel_at: null,
        canceled_at: null,
        ended_at: null,
        current_period_end: newPeriodEnd,
        updated_at: now.toISOString(),
      };

      const { data: updatedSubscription, error: updateError } = await admin
        .from('tenant_subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .single();

      if (updateError) {
        console.error('Error resuming subscription:', updateError);
        return createCorsResponse({ error: 'Failed to resume subscription' }, 500, req);
      }

      // Log resume event
      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        event_type: 'reactivated',
        user_id: user.id,
        data: {
          previousStatus: subscription.status,
          newStatus: updatedSubscription.status,
        },
        created_at: now.toISOString(),
      });

      return createCorsResponse(
        {
          message: 'Subscription resumed successfully',
          subscription: updatedSubscription,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /subscriptions/:id - Get a specific subscription
    // ========================================================================
    if (req.method === 'GET' && secondSegment && !thirdSegment) {
      const subscriptionId = secondSegment;

      const { data: subscription, error } = await admin
        .from('tenant_subscriptions')
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !subscription) {
        return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      }

      return createCorsResponse({ subscription }, 200, req);
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
