import { Router } from 'express';
import { SubscriptionService } from './services/subscription-service';
import { UsageTrackingService } from './services/usage-tracking-service';
import { db } from './db';
import {
  subscriptionPlans,
  subscriptionFeatures,
  tenantSubscriptions,
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
      .where(and(
        eq(subscriptionPlans.isVisible, true),
        eq(subscriptionPlans.isActive, true)
      ))
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
        eq(subscriptionPlans.isActive, true)
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
    const tenantId = req.tenantId;
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
    const tenantId = req.tenantId;
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
        eq(tenantSubscriptions.tenantId, tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing')`
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
    const tenantId = req.tenantId!;
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
    const tenantId = req.tenantId!;
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
    const tenantId = req.tenantId;
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
    const tenantId = req.tenantId!;

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
    const tenantId = req.tenantId!;
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
    const tenantId = req.tenantId!;

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
    const tenantId = req.tenantId!;

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
    const categorized = features.reduce((acc, feature) => {
      const category = feature.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(feature);
      return acc;
    }, {} as Record<string, typeof features>);

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
    const tenantId = req.tenantId;
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
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    const userId = req.user?.id;

    const notifications = await db
      .select()
      .from(subscriptionNotifications)
      .where(
        and(
          eq(subscriptionNotifications.tenantId, tenantId),
          userId ? eq(subscriptionNotifications.userId, userId) : sql`true`,
          sql`${subscriptionNotifications.status} != 'dismissed'`
        )
      )
      .orderBy(desc(subscriptionNotifications.createdAt))
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
    const tenantId = req.tenantId;
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
          eq(subscriptionNotifications.tenantId, tenantId)
        )
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
    const tenantId = req.tenantId;
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
          eq(subscriptionNotifications.tenantId, tenantId)
        )
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
    const tenantId = req.tenantId!;

    const events = await db
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.tenantId, tenantId))
      .orderBy(desc(subscriptionEvents.createdAt))
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
      where: and(
        eq(discounts.code, code.toUpperCase()),
        eq(discounts.isActive, true)
      ),
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

export default router;
