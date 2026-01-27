import { Router, raw } from 'express';
import { SubscriptionService } from './services/subscription-service';
import { UsageTrackingService } from './services/usage-tracking-service';
import { StripeService } from './services/stripe-service';
import { db } from './db';
import {
  subscriptionPlans,
  subscriptionFeatures,
  tenantSubscriptions,
  subscriptionAddons,
  discounts,
  subscriptionNotifications,
  subscriptionEvents,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  requireActiveSubscription,
  requireFeature,
  softCheckSubscription,
} from './middleware/subscription';

/**
 * SUBSCRIPTION ROUTES
 *
 * API endpoints for subscription management, billing, and usage tracking.
 */

const router = Router();

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.isVisible, true), eq(subscriptionPlans.isActive, true)))
      .orderBy(subscriptionPlans.displayOrder);

    const features = await db
      .select()
      .from(subscriptionFeatures)
      .orderBy(subscriptionFeatures.displayOrder);

    res.json({
      plans,
      features,
    });
  } catch (error) {
    console.error('Failed to fetch plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * GET /api/subscriptions/plans/:slug
 * Get specific plan details
 */
router.get('/plans/:slug', async (req, res) => {
  try {
    const plan = await db.query.subscriptionPlans.findFirst({
      where: and(
        eq(subscriptionPlans.slug, req.params.slug),
        eq(subscriptionPlans.isVisible, true),
        eq(subscriptionPlans.isActive, true),
      ),
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Get feature details
    const featureSlugs = plan.features as string[];
    const features = await db
      .select()
      .from(subscriptionFeatures)
      .where(sql`${subscriptionFeatures.slug} = ANY(${featureSlugs})`);

    res.json({
      ...plan,
      featureDetails: features,
    });
  } catch (error) {
    console.error('Failed to fetch plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan details' });
  }
});

// ============================================================================
// AUTHENTICATED ROUTES (require tenant context)
// ============================================================================

/**
 * GET /api/subscriptions/current
 * Get current subscription status for tenant
 */
router.get('/current', softCheckSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    const status = await SubscriptionService.getSubscriptionStatus(tenantId);

    if (!status) {
      return res.json({
        hasSubscription: false,
        message: 'No active subscription',
      });
    }

    res.json({
      hasSubscription: true,
      subscription: status.subscription,
      plan: status.plan,
      usage: status.usage,
      limits: status.limits,
      isOverLimit: status.isOverLimit,
      overageDetails: status.overageDetails,
      daysUntilRenewal: status.daysUntilRenewal,
      isTrialing: status.isTrialing,
      trialDaysRemaining: status.trialDaysRemaining,
      features: status.features,
    });
  } catch (error) {
    console.error('Failed to fetch subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

/**
 * POST /api/subscriptions/create
 * Create a new subscription
 */
router.post('/create', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    const { planSlug, billingCycle, startTrial, discountCode, paymentMethodId } = req.body;

    if (!planSlug || !billingCycle) {
      return res.status(400).json({
        error: 'Missing required fields: planSlug, billingCycle',
      });
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      return res.status(400).json({
        error: 'Invalid billing cycle. Must be "monthly" or "annual"',
      });
    }

    // Check if tenant already has an active subscription
    const existing = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenant_id, tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing')`,
      ),
    });

    if (existing) {
      return res.status(400).json({
        error: 'Tenant already has an active subscription',
        message: 'Use the upgrade endpoint to change plans',
      });
    }

    const subscription = await SubscriptionService.createSubscription({
      tenantId,
      planSlug,
      billingCycle,
      startTrial: startTrial !== false, // Default to true
      discountCode,
      paymentMethodId,
    });

    res.status(201).json({
      subscription,
      message: 'Subscription created successfully',
    });
  } catch (error) {
    console.error('Failed to create subscription:', error);
    res.status(500).json({
      error: 'Failed to create subscription',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/subscriptions/upgrade
 * Upgrade or downgrade subscription
 */
router.post('/upgrade', requireActiveSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id!;
    const { newPlanSlug, billingCycle, immediate } = req.body;

    if (!newPlanSlug) {
      return res.status(400).json({ error: 'Missing required field: newPlanSlug' });
    }

    const subscription = await SubscriptionService.changeSubscription({
      tenantId,
      newPlanSlug,
      billingCycle,
      immediate: immediate !== false, // Default to true
    });

    res.json({
      subscription,
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    console.error('Failed to upgrade subscription:', error);
    res.status(500).json({
      error: 'Failed to upgrade subscription',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription
 */
router.post('/cancel', requireActiveSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id!;
    const { immediate } = req.body;

    await SubscriptionService.cancelSubscription(tenantId, immediate === true);

    res.json({
      message: immediate
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at the end of the current period',
    });
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/subscriptions/convert-trial
 * Convert trial to paid subscription
 */
router.post('/convert-trial', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    const { paymentMethodId } = req.body;

    const subscription = await SubscriptionService.convertTrialToPaid(tenantId, paymentMethodId);

    res.json({
      subscription,
      message: 'Trial converted to paid subscription successfully',
    });
  } catch (error) {
    console.error('Failed to convert trial:', error);
    res.status(500).json({
      error: 'Failed to convert trial',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// USAGE & ANALYTICS
// ============================================================================

/**
 * GET /api/subscriptions/usage
 * Get current usage statistics
 */
router.get('/usage', requireActiveSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id!;

    const summary = await UsageTrackingService.getUsageSummary(tenantId);

    if (!summary) {
      return res.status(404).json({ error: 'Usage data not found' });
    }

    res.json(summary);
  } catch (error) {
    console.error('Failed to fetch usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

/**
 * GET /api/subscriptions/usage/history
 * Get usage history over time
 */
router.get('/usage/history', requireActiveSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id!;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required query parameters: startDate, endDate',
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const history = await UsageTrackingService.getUsageHistory(tenantId, start, end);

    res.json({ history });
  } catch (error) {
    console.error('Failed to fetch usage history:', error);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

/**
 * POST /api/subscriptions/usage/recalculate
 * Manually trigger usage recalculation
 */
router.post('/usage/recalculate', requireActiveSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id!;

    await UsageTrackingService.recalculateUsage(tenantId);

    res.json({ message: 'Usage recalculated successfully' });
  } catch (error) {
    console.error('Failed to recalculate usage:', error);
    res.status(500).json({ error: 'Failed to recalculate usage' });
  }
});

// ============================================================================
// FEATURES & ACCESS
// ============================================================================

/**
 * GET /api/subscriptions/features
 * Get available features for current subscription
 */
router.get('/features', requireActiveSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id!;

    const status = await SubscriptionService.getSubscriptionStatus(tenantId);
    if (!status) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Get full feature details
    const featureSlugs = status.features;
    const features = await db
      .select()
      .from(subscriptionFeatures)
      .where(sql`${subscriptionFeatures.slug} = ANY(${featureSlugs})`);

    // Group by category
    const categorized = features.reduce(
      (acc, feature) => {
        const category = feature.category || 'Other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(feature);
        return acc;
      },
      {} as Record<string, typeof features>,
    );

    res.json({
      features,
      categorized,
      planName: status.plan.name,
      planSlug: status.plan.slug,
    });
  } catch (error) {
    console.error('Failed to fetch features:', error);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

/**
 * GET /api/subscriptions/features/check/:slug
 * Check if tenant has access to specific feature
 */
router.get('/features/check/:slug', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    const featureSlug = req.params.slug;
    const hasFeature = await SubscriptionService.hasFeature(tenantId, featureSlug);

    res.json({
      feature: featureSlug,
      hasAccess: hasFeature,
    });
  } catch (error) {
    console.error('Failed to check feature:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * GET /api/subscriptions/notifications
 * Get subscription-related notifications
 */
router.get('/notifications', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    const userId = req.user?.id;

    const notifications = await db
      .select()
      .from(subscriptionNotifications)
      .where(
        and(
          eq(subscriptionNotifications.tenant_id, tenantId),
          userId ? eq(subscriptionNotifications.user_id, userId) : sql`true`,
          sql`${subscriptionNotifications.status} != 'dismissed'`,
        ),
      )
      .orderBy(desc(subscriptionNotifications.created_at))
      .limit(50);

    res.json({ notifications });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/subscriptions/notifications/:id/dismiss
 * Dismiss a notification
 */
router.post('/notifications/:id/dismiss', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    const notificationId = req.params.id;

    await db
      .update(subscriptionNotifications)
      .set({
        status: 'dismissed',
        dismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptionNotifications.id, notificationId),
          eq(subscriptionNotifications.tenant_id, tenantId),
        ),
      );

    res.json({ message: 'Notification dismissed' });
  } catch (error) {
    console.error('Failed to dismiss notification:', error);
    res.status(500).json({ error: 'Failed to dismiss notification' });
  }
});

/**
 * POST /api/subscriptions/notifications/:id/read
 * Mark notification as read
 */
router.post('/notifications/:id/read', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    const notificationId = req.params.id;

    await db
      .update(subscriptionNotifications)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptionNotifications.id, notificationId),
          eq(subscriptionNotifications.tenant_id, tenantId),
        ),
      );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// ============================================================================
// SUBSCRIPTION HISTORY & EVENTS
// ============================================================================

/**
 * GET /api/subscriptions/history
 * Get subscription history and events
 */
router.get('/history', requireActiveSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id!;

    const events = await db
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.tenant_id, tenantId))
      .orderBy(desc(subscriptionEvents.created_at))
      .limit(100);

    res.json({ events });
  } catch (error) {
    console.error('Failed to fetch subscription history:', error);
    res.status(500).json({ error: 'Failed to fetch subscription history' });
  }
});

// ============================================================================
// DISCOUNT CODES
// ============================================================================

/**
 * POST /api/subscriptions/validate-discount
 * Validate a discount code
 */
router.post('/validate-discount', async (req, res) => {
  try {
    const { code, planSlug } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing required field: code' });
    }

    const discount = await db.query.discounts.findFirst({
      where: and(eq(discounts.code, code.toUpperCase()), eq(discounts.isActive, true)),
    });

    if (!discount) {
      return res.status(404).json({
        valid: false,
        error: 'Invalid or expired discount code',
      });
    }

    // Check validity dates
    const now = new Date();
    if (discount.validFrom && discount.validFrom > now) {
      return res.status(400).json({
        valid: false,
        error: 'This discount code is not yet active',
      });
    }

    if (discount.validUntil && discount.validUntil < now) {
      return res.status(400).json({
        valid: false,
        error: 'This discount code has expired',
      });
    }

    // Check redemption limit
    if (discount.maxRedemptions && discount.redemptionCount >= discount.maxRedemptions) {
      return res.status(400).json({
        valid: false,
        error: 'This discount code has reached its redemption limit',
      });
    }

    // Check plan applicability
    const appliesToPlans = discount.appliesToPlans as string[];
    if (planSlug && appliesToPlans.length > 0 && !appliesToPlans.includes(planSlug)) {
      return res.status(400).json({
        valid: false,
        error: 'This discount code is not applicable to the selected plan',
      });
    }

    res.json({
      valid: true,
      discount: {
        code: discount.code,
        name: discount.name,
        description: discount.description,
        type: discount.type,
        percentOff: discount.percentOff,
        amountOff: discount.amountOff,
        duration: discount.duration,
        durationMonths: discount.durationMonths,
      },
    });
  } catch (error) {
    console.error('Failed to validate discount:', error);
    res.status(500).json({ error: 'Failed to validate discount code' });
  }
});

// ============================================================================
// STRIPE CHECKOUT & PORTAL
// ============================================================================

/**
 * GET /api/subscriptions/stripe/config
 * Get Stripe publishable key for frontend initialization
 */
router.get('/stripe/config', (req, res) => {
  try {
    if (!StripeService.isConfigured()) {
      return res.status(503).json({
        error: 'Stripe is not configured',
        message: 'Payment processing is currently unavailable',
      });
    }

    res.json({
      publishableKey: StripeService.getPublishableKey(),
    });
  } catch (error) {
    console.error('Failed to get Stripe config:', error);
    res.status(500).json({ error: 'Failed to get Stripe configuration' });
  }
});

/**
 * POST /api/subscriptions/checkout
 * Create a Stripe Checkout Session for new subscription purchase
 */
router.post('/checkout', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    if (!StripeService.isConfigured()) {
      return res.status(503).json({
        error: 'Stripe is not configured',
        message: 'Payment processing is currently unavailable',
      });
    }

    const { planSlug, billingCycle, discountCode } = req.body;

    if (!planSlug || !billingCycle) {
      return res.status(400).json({
        error: 'Missing required fields: planSlug, billingCycle',
      });
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      return res.status(400).json({
        error: 'Invalid billing cycle. Must be "monthly" or "annual"',
      });
    }

    // Get the plan and its Stripe price ID
    const plan = await db.query.subscriptionPlans.findFirst({
      where: and(eq(subscriptionPlans.slug, planSlug), eq(subscriptionPlans.isActive, true)),
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Get the appropriate price ID
    const priceId =
      billingCycle === 'annual' ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;

    if (!priceId) {
      return res.status(400).json({
        error: 'Stripe price ID not configured for this plan',
        message: 'Please contact support to set up payment for this plan',
      });
    }

    // Get user email for the checkout session
    const userEmail = req.user?.email;

    // Determine success and cancel URLs
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const successUrl =
      process.env.STRIPE_CHECKOUT_SUCCESS_URL || `${baseUrl}/settings/subscription?success=true`;
    const cancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL || `${baseUrl}/pricing?canceled=true`;

    // Create checkout session
    const session = await StripeService.createCheckoutSession({
      tenantId,
      priceId,
      billingCycle,
      successUrl,
      cancelUrl,
      customerEmail: userEmail,
      trialDays: plan.trialEnabled ? plan.trialDays || 14 : 0,
      discountCode,
      metadata: {
        planSlug,
        planName: plan.name,
      },
    });

    res.json({
      sessionId: session.id,
      sessionUrl: session.url,
    });
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/subscriptions/checkout/addon
 * Create a Stripe Checkout Session for one-time add-on purchase
 */
router.post('/checkout/addon', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    if (!StripeService.isConfigured()) {
      return res.status(503).json({
        error: 'Stripe is not configured',
        message: 'Payment processing is currently unavailable',
      });
    }

    const { addonSlug, quantity = 1 } = req.body;

    if (!addonSlug) {
      return res.status(400).json({
        error: 'Missing required field: addonSlug',
      });
    }

    // Get the addon and its Stripe price ID
    const addon = await db.query.subscriptionAddons.findFirst({
      where: and(eq(subscriptionAddons.slug, addonSlug), eq(subscriptionAddons.isActive, true)),
    });

    if (!addon) {
      return res.status(404).json({ error: 'Add-on not found' });
    }

    if (!addon.stripePriceId) {
      return res.status(400).json({
        error: 'Stripe price ID not configured for this add-on',
        message: 'Please contact support to set up payment for this add-on',
      });
    }

    // Get user email for the checkout session
    const userEmail = req.user?.email;

    // Determine success and cancel URLs
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const successUrl = `${baseUrl}/settings/subscription?addon_success=true&addon=${addonSlug}`;
    const cancelUrl = `${baseUrl}/settings/subscription?addon_canceled=true`;

    // Create one-time checkout session
    const session = await StripeService.createOneTimeCheckoutSession({
      tenantId,
      priceId: addon.stripePriceId,
      quantity,
      successUrl,
      cancelUrl,
      customerEmail: userEmail,
      metadata: {
        addonSlug,
        addonName: addon.name,
        category: addon.category,
      },
    });

    res.json({
      sessionId: session.id,
      sessionUrl: session.url,
    });
  } catch (error) {
    console.error('Failed to create addon checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/subscriptions/checkout/session/:sessionId
 * Get checkout session details (for verifying success)
 */
router.get('/checkout/session/:sessionId', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    if (!StripeService.isConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const session = await StripeService.retrieveCheckoutSession(req.params.sessionId);

    // Verify this session belongs to the requesting tenant
    if (session.metadata?.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied to this session' });
    }

    res.json({
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_email,
      subscriptionId:
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
    });
  } catch (error) {
    console.error('Failed to retrieve checkout session:', error);
    res.status(500).json({ error: 'Failed to retrieve checkout session' });
  }
});

/**
 * POST /api/subscriptions/portal
 * Create a Stripe Customer Portal session for self-service billing management
 */
router.post('/portal', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    if (!StripeService.isConfigured()) {
      return res.status(503).json({
        error: 'Stripe is not configured',
        message: 'Billing management is currently unavailable',
      });
    }

    // Determine return URL
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || `${baseUrl}/settings/billing`;

    const portalSession = await StripeService.createPortalSessionForTenant(tenantId, returnUrl);

    res.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Failed to create portal session:', error);

    // Check if the error is due to missing Stripe customer
    if (error instanceof Error && error.message.includes('No Stripe customer ID')) {
      return res.status(400).json({
        error: 'No billing account found',
        message: 'Please complete a purchase first to access billing management',
      });
    }

    res.status(500).json({
      error: 'Failed to create billing portal session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/subscriptions/setup-intent
 * Create a Setup Intent for adding a payment method
 */
router.post('/setup-intent', async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    if (!StripeService.isConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    // Get or create Stripe customer
    const userEmail = req.user?.email;
    const stripeCustomerId = await StripeService.getOrCreateCustomer(tenantId, userEmail);

    const setupIntent = await StripeService.createSetupIntent(stripeCustomerId, {
      tenantId,
    });

    res.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    console.error('Failed to create setup intent:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

/**
 * GET /api/subscriptions/preview-upgrade
 * Preview the cost of upgrading/downgrading
 */
router.get('/preview-upgrade', requireActiveSubscription, async (req, res) => {
  try {
    const tenantId = req.tenant_id!;
    const { newPlanSlug, billingCycle } = req.query;

    if (!newPlanSlug) {
      return res.status(400).json({ error: 'Missing required field: newPlanSlug' });
    }

    if (!StripeService.isConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    // Get current subscription
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: eq(tenantSubscriptions.tenant_id, tenantId),
    });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({
        error: 'No active Stripe subscription found',
        message: 'Cannot preview upgrade without an active Stripe subscription',
      });
    }

    // Get the new plan
    const newPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.slug, newPlanSlug as string),
    });

    if (!newPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Get the new price ID
    const cycle = (billingCycle as string) || subscription.billingCycle;
    const newPriceId =
      cycle === 'annual' ? newPlan.stripePriceIdAnnual : newPlan.stripePriceIdMonthly;

    if (!newPriceId) {
      return res.status(400).json({
        error: 'Stripe price ID not configured for this plan',
      });
    }

    // Get Stripe customer ID from tenant metadata
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenantSubscriptions.tenant_id, tenantId),
    });

    const stripeCustomerId = (tenant?.metadata as any)?.stripeCustomerId;
    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }

    // Preview the invoice
    const invoice = await StripeService.previewInvoice(
      stripeCustomerId,
      subscription.stripeSubscriptionId,
      newPriceId,
    );

    res.json({
      currentPlan: subscription.planId,
      newPlan: newPlan.slug,
      subtotal: (invoice.subtotal || 0) / 100,
      total: (invoice.total || 0) / 100,
      amountDue: (invoice.amount_due || 0) / 100,
      prorationAmount: ((invoice.total || 0) - (invoice.subtotal || 0)) / 100,
      currency: invoice.currency?.toUpperCase() || 'USD',
      billingCycle: cycle,
    });
  } catch (error) {
    console.error('Failed to preview upgrade:', error);
    res.status(500).json({
      error: 'Failed to preview upgrade',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// STRIPE WEBHOOKS
// ============================================================================

/**
 * POST /api/subscriptions/webhooks/stripe
 * Stripe webhook endpoint with proper signature verification
 * IMPORTANT: This must use raw body parser for signature verification
 */
router.post('/webhooks/stripe', raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!StripeService.isConfigured()) {
      console.error('Stripe webhook received but Stripe is not configured');
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      console.error('Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Verify webhook signature - CRITICAL for security
    let event;
    try {
      event = StripeService.verifyWebhookSignature(req.body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({
        error: 'Webhook signature verification failed',
        message: err instanceof Error ? err.message : 'Invalid signature',
      });
    }

    // Process the event
    const result = await StripeService.handleWebhookEventEnhanced(event);

    if (result.success) {
      res.json({ received: true, message: result.message });
    } else {
      // Still return 200 to acknowledge receipt, but log the error
      console.error('Webhook processing error:', result.message);
      res.json({ received: true, error: result.message });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Stripe from retrying on our errors
    // Only return 4xx/5xx for signature verification failures
    res.json({
      received: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
