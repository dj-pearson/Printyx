import { Router } from 'express';
import { SubscriptionService } from './services/subscription-service';
import { UsageTrackingService } from './services/usage-tracking-service';
import { db } from './db';
import {
  subscriptionPlans,
  subscriptionFeatures,
  tenantSubscriptions,
  discounts,
  discountRedemptions,
  users,
  NewDiscount,
} from '@shared/schema';
import { eq, and, desc, sql, like, gte, lte } from 'drizzle-orm';
import { requireRootAdmin } from './routes-root-admin';
// RBAC Integration
import {
  enhanceUserContext,
  requireLevel,
  requirePermission,
  PERMISSIONS,
  ROLE_LEVELS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

/**
 * ADMIN SUBSCRIPTION ROUTES
 *
 * Root admin endpoints for managing subscriptions, discounts, and billing.
 * SECURITY: All routes in this file require root admin authorization (Level 7+).
 * RBAC: Routes also check for specific platform-level permissions.
 */

const router = Router();

// ============================================================================
// SECURITY MIDDLEWARE - PROTECT ALL ROUTES
// ============================================================================

// Apply RBAC context enhancement first
router.use(enhanceUserContext);

// Require executive level (Level 7+) for all admin subscription routes
router.use(requireLevel(ROLE_LEVELS.EXECUTIVE));

// Also keep the existing root admin check for backward compatibility
router.use(requireRootAdmin);

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/subscriptions
 * Get all subscriptions with filtering and pagination
 */
router.get('/subscriptions', async (req, res) => {
  try {
    const { status, plan, search, page = 1, limit = 50 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = db
      .select()
      .from(tenantSubscriptions)
      .orderBy(desc(tenantSubscriptions.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Apply filters
    if (status) {
      query = query.where(eq(tenantSubscriptions.status, status as string));
    }

    const subscriptions = await query;

    // Get total count
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tenantSubscriptions);

    res.json({
      subscriptions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/**
 * GET /api/admin/subscriptions/:id
 * Get detailed subscription information
 */
router.get('/subscriptions/:id', async (req, res) => {
  try {
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: eq(tenantSubscriptions.id, req.params.id),
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Get full subscription status
    const status = await SubscriptionService.getSubscriptionStatus(subscription.tenantId);

    res.json({
      subscription,
      status,
    });
  } catch (error) {
    console.error('Failed to fetch subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription details' });
  }
});

/**
 * POST /api/admin/subscriptions/grant-free
 * Grant free subscription to a tenant (admin only)
 */
router.post('/subscriptions/grant-free', async (req, res) => {
  try {
    const { tenantId, planSlug, reason } = req.body;

    if (!tenantId || !planSlug) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, planSlug',
      });
    }

    const subscription = await SubscriptionService.grantFreeSubscription(
      tenantId,
      planSlug,
      reason,
    );

    res.status(201).json({
      subscription,
      message: 'Free subscription granted successfully',
    });
  } catch (error) {
    console.error('Failed to grant free subscription:', error);
    res.status(500).json({
      error: 'Failed to grant free subscription',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/admin/subscriptions/:id
 * Update subscription settings (admin override)
 */
router.patch('/subscriptions/:id', async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const { status, customLimits, notes, isFree, amount } = req.body;

    const updates: any = {
      updatedAt: new Date(),
    };

    if (status) updates.status = status;
    if (customLimits) updates.customLimits = customLimits;
    if (notes !== undefined) updates.notes = notes;
    if (isFree !== undefined) updates.isFree = isFree;
    if (amount !== undefined) updates.amount = amount;

    const [subscription] = await db
      .update(tenantSubscriptions)
      .set(updates)
      .where(eq(tenantSubscriptions.id, subscriptionId))
      .returning();

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      subscription,
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    console.error('Failed to update subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * POST /api/admin/subscriptions/:id/extend-trial
 * Extend trial period for a subscription
 */
router.post('/subscriptions/:id/extend-trial', async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const { days } = req.body;

    if (!days || days < 1) {
      return res.status(400).json({
        error: 'Invalid days parameter. Must be a positive number.',
      });
    }

    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: eq(tenantSubscriptions.id, subscriptionId),
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (!subscription.isTrialing || !subscription.trialEndDate) {
      return res.status(400).json({
        error: 'Subscription is not in trial period',
      });
    }

    const newTrialEndDate = new Date(subscription.trialEndDate);
    newTrialEndDate.setDate(newTrialEndDate.getDate() + days);

    const [updatedSubscription] = await db
      .update(tenantSubscriptions)
      .set({
        trialEndDate: newTrialEndDate,
        currentPeriodEnd: newTrialEndDate,
        updatedAt: new Date(),
      })
      .where(eq(tenantSubscriptions.id, subscriptionId))
      .returning();

    res.json({
      subscription: updatedSubscription,
      message: `Trial extended by ${days} days`,
      newTrialEndDate,
    });
  } catch (error) {
    console.error('Failed to extend trial:', error);
    res.status(500).json({ error: 'Failed to extend trial' });
  }
});

// ============================================================================
// DISCOUNT CODE MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/discounts
 * Get all discount codes
 */
router.get('/discounts', async (req, res) => {
  try {
    const { active, search, page = 1, limit = 50 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = db
      .select()
      .from(discounts)
      .orderBy(desc(discounts.createdAt))
      .limit(Number(limit))
      .offset(offset);

    if (active !== undefined) {
      query = query.where(eq(discounts.isActive, active === 'true'));
    }

    if (search) {
      query = query.where(like(discounts.code, `%${search}%`));
    }

    const discountsList = await query;

    // Get total count
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(discounts);

    res.json({
      discounts: discountsList,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Failed to fetch discounts:', error);
    res.status(500).json({ error: 'Failed to fetch discounts' });
  }
});

/**
 * GET /api/admin/discounts/:id
 * Get discount details with redemption history
 */
router.get('/discounts/:id', async (req, res) => {
  try {
    const discount = await db.query.discounts.findFirst({
      where: eq(discounts.id, req.params.id),
    });

    if (!discount) {
      return res.status(404).json({ error: 'Discount not found' });
    }

    // Get redemption history
    const redemptions = await db
      .select()
      .from(discountRedemptions)
      .where(eq(discountRedemptions.discountId, discount.id))
      .orderBy(desc(discountRedemptions.createdAt))
      .limit(100);

    res.json({
      discount,
      redemptions,
    });
  } catch (error) {
    console.error('Failed to fetch discount:', error);
    res.status(500).json({ error: 'Failed to fetch discount details' });
  }
});

/**
 * POST /api/admin/discounts
 * Create a new discount code
 */
router.post('/discounts', async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      type,
      percentOff,
      amountOff,
      trialExtensionDays,
      appliesToPlans,
      billingCycles,
      duration,
      durationMonths,
      validFrom,
      validUntil,
      maxRedemptions,
      firstTimeOnly,
      minAmount,
    } = req.body;

    if (!code || !name || !type) {
      return res.status(400).json({
        error: 'Missing required fields: code, name, type',
      });
    }

    if (!['percent', 'fixed', 'free_trial_extension'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid discount type. Must be: percent, fixed, or free_trial_extension',
      });
    }

    if (type === 'percent' && (!percentOff || percentOff < 1 || percentOff > 100)) {
      return res.status(400).json({
        error: 'Percent off must be between 1 and 100',
      });
    }

    if (type === 'fixed' && (!amountOff || amountOff <= 0)) {
      return res.status(400).json({
        error: 'Amount off must be greater than 0',
      });
    }

    if (type === 'free_trial_extension' && (!trialExtensionDays || trialExtensionDays < 1)) {
      return res.status(400).json({
        error: 'Trial extension days must be greater than 0',
      });
    }

    // Check if code already exists
    const existing = await db.query.discounts.findFirst({
      where: eq(discounts.code, code.toUpperCase()),
    });

    if (existing) {
      return res.status(400).json({
        error: 'Discount code already exists',
      });
    }

    const discountData: NewDiscount = {
      code: code.toUpperCase(),
      name,
      description,
      type,
      percentOff: type === 'percent' ? percentOff : null,
      amountOff: type === 'fixed' ? amountOff : null,
      trialExtensionDays: type === 'free_trial_extension' ? trialExtensionDays : null,
      appliesToPlans: appliesToPlans || [],
      billingCycles: billingCycles || ['monthly', 'annual'],
      duration: duration || 'once',
      durationMonths: durationMonths || null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      maxRedemptions: maxRedemptions || null,
      firstTimeOnly: firstTimeOnly || false,
      minAmount: minAmount || null,
      isActive: true,
      createdBy: req.user?.id || null,
    };

    const [discount] = await db.insert(discounts).values(discountData).returning();

    res.status(201).json({
      discount,
      message: 'Discount code created successfully',
    });
  } catch (error) {
    console.error('Failed to create discount:', error);
    res.status(500).json({
      error: 'Failed to create discount',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/admin/discounts/:id
 * Update discount code
 */
router.patch('/discounts/:id', async (req, res) => {
  try {
    const discountId = req.params.id;
    const updates = req.body;

    // Prevent changing code after creation
    if (updates.code) {
      delete updates.code;
    }

    const [discount] = await db
      .update(discounts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(discounts.id, discountId))
      .returning();

    if (!discount) {
      return res.status(404).json({ error: 'Discount not found' });
    }

    res.json({
      discount,
      message: 'Discount updated successfully',
    });
  } catch (error) {
    console.error('Failed to update discount:', error);
    res.status(500).json({ error: 'Failed to update discount' });
  }
});

/**
 * DELETE /api/admin/discounts/:id
 * Deactivate discount code
 */
router.delete('/discounts/:id', async (req, res) => {
  try {
    const [discount] = await db
      .update(discounts)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(discounts.id, req.params.id))
      .returning();

    if (!discount) {
      return res.status(404).json({ error: 'Discount not found' });
    }

    res.json({
      message: 'Discount deactivated successfully',
    });
  } catch (error) {
    console.error('Failed to deactivate discount:', error);
    res.status(500).json({ error: 'Failed to deactivate discount' });
  }
});

// ============================================================================
// PLANS & FEATURES MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/plans
 * Get all subscription plans (including hidden)
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.displayOrder);

    res.json({ plans });
  } catch (error) {
    console.error('Failed to fetch plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

/**
 * PATCH /api/admin/plans/:id
 * Update subscription plan
 */
router.patch('/plans/:id', async (req, res) => {
  try {
    const planId = req.params.id;
    const updates = req.body;

    const [plan] = await db
      .update(subscriptionPlans)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      plan,
      message: 'Plan updated successfully',
    });
  } catch (error) {
    console.error('Failed to update plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

/**
 * GET /api/admin/analytics/subscriptions
 * Get subscription analytics
 */
router.get('/analytics/subscriptions', async (req, res) => {
  try {
    // Total subscriptions by status
    const byStatus = await db
      .select({
        status: tenantSubscriptions.status,
        count: sql<number>`count(*)`,
      })
      .from(tenantSubscriptions)
      .groupBy(tenantSubscriptions.status);

    // Total subscriptions by plan
    const byPlan = await db
      .select({
        planId: tenantSubscriptions.planId,
        count: sql<number>`count(*)`,
      })
      .from(tenantSubscriptions)
      .where(sql`${tenantSubscriptions.status} IN ('active', 'trialing')`)
      .groupBy(tenantSubscriptions.planId);

    // Monthly recurring revenue
    const [mrr] = await db
      .select({
        total: sql<number>`SUM(CASE WHEN billing_cycle = 'monthly' THEN CAST(amount AS NUMERIC) WHEN billing_cycle = 'annual' THEN CAST(amount AS NUMERIC) / 12 ELSE 0 END)`,
      })
      .from(tenantSubscriptions)
      .where(
        and(
          sql`${tenantSubscriptions.status} IN ('active', 'trialing')`,
          eq(tenantSubscriptions.isFree, false),
        ),
      );

    // Trial conversion rate
    const [trialStats] = await db
      .select({
        totalTrials: sql<number>`COUNT(CASE WHEN is_trialing = true THEN 1 END)`,
        converted: sql<number>`COUNT(CASE WHEN is_trialing = false AND trial_start_date IS NOT NULL THEN 1 END)`,
      })
      .from(tenantSubscriptions);

    const conversionRate =
      trialStats.totalTrials > 0
        ? (trialStats.converted / (trialStats.totalTrials + trialStats.converted)) * 100
        : 0;

    res.json({
      byStatus,
      byPlan,
      mrr: mrr.total || 0,
      trialConversionRate: Math.round(conversionRate * 100) / 100,
      totalTrials: trialStats.totalTrials,
      totalConverted: trialStats.converted,
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Get revenue analytics
 */
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Revenue by billing cycle
    const [revenue] = await db
      .select({
        monthly: sql<number>`SUM(CASE WHEN billing_cycle = 'monthly' THEN CAST(amount AS NUMERIC) ELSE 0 END)`,
        annual: sql<number>`SUM(CASE WHEN billing_cycle = 'annual' THEN CAST(amount AS NUMERIC) ELSE 0 END)`,
        total: sql<number>`SUM(CAST(amount AS NUMERIC))`,
      })
      .from(tenantSubscriptions)
      .where(
        and(
          sql`${tenantSubscriptions.status} IN ('active', 'trialing')`,
          eq(tenantSubscriptions.isFree, false),
        ),
      );

    res.json({
      revenue,
    });
  } catch (error) {
    console.error('Failed to fetch revenue:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * POST /api/admin/usage/recalculate-all
 * Recalculate usage for all tenants
 */
router.post('/usage/recalculate-all', async (req, res) => {
  try {
    // Run asynchronously
    UsageTrackingService.recalculateAllUsage().catch((error) => {
      console.error('Failed to recalculate all usage:', error);
    });

    res.json({
      message: 'Usage recalculation started in background',
    });
  } catch (error) {
    console.error('Failed to start usage recalculation:', error);
    res.status(500).json({ error: 'Failed to start usage recalculation' });
  }
});

/**
 * POST /api/admin/trials/check-expirations
 * Check and process trial expirations
 */
router.post('/trials/check-expirations', async (req, res) => {
  try {
    // Run trial expiration checks
    await SubscriptionService.checkTrialExpirations();

    res.json({
      message: 'Trial expiration check completed',
    });
  } catch (error) {
    console.error('Failed to check trial expirations:', error);
    res.status(500).json({ error: 'Failed to check trial expirations' });
  }
});

export default router;
