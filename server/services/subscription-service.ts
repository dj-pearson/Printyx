import { db } from '../db';
import {
  tenants,
  subscriptionPlans,
  subscriptionFeatures,
  tenantSubscriptions,
  usageMetrics,
  dailyUsageSnapshots,
  subscriptionEvents,
  subscriptionNotifications,
  onboardingProgress,
  TenantSubscription,
  SubscriptionPlan,
  NewTenantSubscription,
  NewSubscriptionEvent,
  NewSubscriptionNotification,
} from '@shared/schema';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';

/**
 * SUBSCRIPTION SERVICE
 *
 * Comprehensive service for managing subscriptions, trials, and billing.
 * Handles all subscription lifecycle events and business logic.
 */

export interface CreateSubscriptionParams {
  tenantId: string;
  planSlug: string;
  billingCycle: 'monthly' | 'annual';
  startTrial?: boolean;
  discountCode?: string;
  paymentMethodId?: string;
  stripeCustomerId?: string;
}

export interface UpgradeSubscriptionParams {
  tenantId: string;
  newPlanSlug: string;
  billingCycle?: 'monthly' | 'annual';
  immediate?: boolean; // If false, upgrade at next billing cycle
}

export interface SubscriptionStatus {
  subscription: TenantSubscription;
  plan: SubscriptionPlan;
  usage: {
    users: number;
    storage: number;
    apiCalls: number;
    locations: number;
    businessRecords: number;
  };
  limits: {
    users: number;
    storage: number;
    apiCalls: number;
    locations: number;
    businessRecords: number;
  };
  isOverLimit: boolean;
  overageDetails: {
    users?: number;
    storage?: number;
    apiCalls?: number;
    locations?: number;
    businessRecords?: number;
  };
  daysUntilRenewal: number;
  isTrialing: boolean;
  trialDaysRemaining?: number;
  features: string[];
}

export class SubscriptionService {
  /**
   * Create a new subscription for a tenant
   */
  static async createSubscription(params: CreateSubscriptionParams): Promise<TenantSubscription> {
    const {
      tenantId,
      planSlug,
      billingCycle,
      startTrial = true,
      discountCode,
      paymentMethodId,
      stripeCustomerId,
    } = params;

    // Get plan details
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.slug, planSlug),
    });

    if (!plan) {
      throw new Error(`Plan not found: ${planSlug}`);
    }

    if (!plan.isActive || !plan.isVisible) {
      throw new Error(`Plan is not available: ${planSlug}`);
    }

    // Calculate subscription dates
    const now = new Date();
    const startDate = now;

    let isTrialing = false;
    let trialEndDate = null;
    let currentPeriodEnd = new Date();

    if (startTrial && plan.trialEnabled && plan.trialDays > 0) {
      isTrialing = true;
      trialEndDate = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
      currentPeriodEnd = trialEndDate;
    } else {
      // No trial, set period end based on billing cycle
      if (billingCycle === 'annual') {
        currentPeriodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      } else {
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }
    }

    // Calculate amount
    const baseAmount =
      billingCycle === 'annual' ? parseFloat(plan.annualPrice) : parseFloat(plan.monthlyPrice);
    let amount = baseAmount;

    // Apply discount if provided
    let discountId = null;
    let discountAmount = 0;
    let discountPercent = 0;

    if (discountCode) {
      // TODO: Implement discount code validation and application
      // const discount = await this.validateAndApplyDiscount(discountCode, plan.id, baseAmount);
      // if (discount) {
      //   discountId = discount.id;
      //   discountAmount = discount.amountOff;
      //   discountPercent = discount.percentOff;
      //   amount = baseAmount - discountAmount - (baseAmount * discountPercent / 100);
      // }
    }

    // Create subscription
    const subscriptionData: NewTenantSubscription = {
      tenantId,
      planId: plan.id,
      status: isTrialing ? 'trialing' : 'active',
      billingCycle,
      billingInterval: 1,
      startDate,
      currentPeriodStart: startDate,
      currentPeriodEnd,
      isTrialing,
      trialStartDate: isTrialing ? startDate : null,
      trialEndDate: isTrialing ? trialEndDate : null,
      amount: amount.toFixed(2),
      currency: 'USD',
      discountId,
      discountAmount: discountAmount.toFixed(2),
      discountPercent,
      isFree: false,
      customPricing: false,
      stripeCustomerId,
      usageBasedBilling: false,
    };

    const [subscription] = await db
      .insert(tenantSubscriptions)
      .values(subscriptionData)
      .returning();

    // Update tenant cache fields
    await db
      .update(tenants)
      .set({
        plan: planSlug,
        subscription: subscription.status,
        billingStatus: isTrialing ? 'trialing' : 'pending',
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // Create subscription event
    await this.createEvent({
      tenantId,
      subscriptionId: subscription.id,
      eventType: isTrialing ? 'trial_started' : 'created',
      data: {
        plan: planSlug,
        billingCycle,
        amount,
        trialDays: plan.trialDays,
      },
    });

    // Send welcome notification
    await this.createNotification({
      tenantId,
      type: isTrialing ? 'trial_started' : 'subscription_created',
      priority: 'normal',
      title: isTrialing ? 'Trial Started!' : 'Subscription Activated',
      message: isTrialing
        ? `Your ${plan.trialDays}-day trial of the ${plan.name} plan has started. Explore all features!`
        : `Your ${plan.name} subscription is now active. Welcome aboard!`,
      actionUrl: '/settings/subscription',
      actionText: 'View Subscription',
      channels: ['in_app', 'email'],
    });

    return subscription;
  }

  /**
   * Get subscription status with usage and limits
   */
  static async getSubscriptionStatus(tenantId: string): Promise<SubscriptionStatus | null> {
    // Get active subscription
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing', 'past_due')`,
      ),
      with: {
        plan: true,
      },
      orderBy: [desc(tenantSubscriptions.createdAt)],
    });

    if (!subscription) {
      return null;
    }

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, subscription.planId),
    });

    if (!plan) {
      throw new Error('Plan not found for subscription');
    }

    // Get current period usage
    const now = new Date();
    const usage = await db.query.usageMetrics.findFirst({
      where: and(
        eq(usageMetrics.tenantId, tenantId),
        lte(usageMetrics.periodStart, now),
        gte(usageMetrics.periodEnd, now),
      ),
    });

    const currentUsage = {
      users: usage?.totalUsers || 0,
      storage: usage?.storageUsedMb || 0,
      apiCalls: usage?.apiCalls || 0,
      locations: usage?.activeLocations || 0,
      businessRecords: usage?.businessRecords || 0,
    };

    // Apply custom limits if set
    const customLimits = (subscription.customLimits as any) || {};
    const limits = {
      users: customLimits.maxUsers || plan.maxUsers,
      storage: customLimits.maxStorage || plan.maxStorage,
      apiCalls: customLimits.maxApiCalls || plan.maxApiCalls,
      locations: customLimits.maxLocations || plan.maxLocations,
      businessRecords: customLimits.maxBusinessRecords || plan.maxBusinessRecords,
    };

    // Check for overages
    const overageDetails: any = {};
    let isOverLimit = false;

    if (limits.users !== -1 && currentUsage.users > limits.users) {
      overageDetails.users = currentUsage.users - limits.users;
      isOverLimit = true;
    }
    if (limits.storage !== -1 && currentUsage.storage > limits.storage * 1024) {
      // Convert GB to MB
      overageDetails.storage = currentUsage.storage - limits.storage * 1024;
      isOverLimit = true;
    }
    if (limits.apiCalls !== -1 && currentUsage.apiCalls > limits.apiCalls) {
      overageDetails.apiCalls = currentUsage.apiCalls - limits.apiCalls;
      isOverLimit = true;
    }
    if (limits.locations !== -1 && currentUsage.locations > limits.locations) {
      overageDetails.locations = currentUsage.locations - limits.locations;
      isOverLimit = true;
    }
    if (limits.businessRecords !== -1 && currentUsage.businessRecords > limits.businessRecords) {
      overageDetails.businessRecords = currentUsage.businessRecords - limits.businessRecords;
      isOverLimit = true;
    }

    // Calculate days until renewal
    const daysUntilRenewal = Math.ceil(
      (subscription.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Calculate trial days remaining
    let trialDaysRemaining = undefined;
    if (subscription.isTrialing && subscription.trialEndDate) {
      trialDaysRemaining = Math.max(
        0,
        Math.ceil((subscription.trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      );
    }

    return {
      subscription,
      plan,
      usage: currentUsage,
      limits,
      isOverLimit,
      overageDetails,
      daysUntilRenewal,
      isTrialing: subscription.isTrialing,
      trialDaysRemaining,
      features: plan.features as string[],
    };
  }

  /**
   * Check if tenant has access to a specific feature
   */
  static async hasFeature(tenantId: string, featureSlug: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(tenantId);
    if (!status) {
      return false;
    }

    // Free subscriptions have all features
    if (status.subscription.isFree) {
      return true;
    }

    return status.features.includes(featureSlug);
  }

  /**
   * Upgrade or downgrade subscription
   */
  static async changeSubscription(params: UpgradeSubscriptionParams): Promise<TenantSubscription> {
    const { tenantId, newPlanSlug, billingCycle, immediate = true } = params;

    // Get current subscription
    const currentSubscription = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing', 'past_due')`,
      ),
      orderBy: [desc(tenantSubscriptions.createdAt)],
    });

    if (!currentSubscription) {
      throw new Error('No active subscription found');
    }

    const currentPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, currentSubscription.planId),
    });

    // Get new plan
    const newPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.slug, newPlanSlug),
    });

    if (!newPlan) {
      throw new Error(`Plan not found: ${newPlanSlug}`);
    }

    const newBillingCycle = billingCycle || currentSubscription.billingCycle;
    const newAmount =
      newBillingCycle === 'annual'
        ? parseFloat(newPlan.annualPrice)
        : parseFloat(newPlan.monthlyPrice);

    if (immediate) {
      // Immediate change - update current subscription
      await db
        .update(tenantSubscriptions)
        .set({
          planId: newPlan.id,
          billingCycle: newBillingCycle,
          amount: newAmount.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(tenantSubscriptions.id, currentSubscription.id));

      // Update tenant cache
      await db
        .update(tenants)
        .set({
          plan: newPlanSlug,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      // Create event
      const isUpgrade = newAmount > parseFloat(currentSubscription.amount);
      await this.createEvent({
        tenantId,
        subscriptionId: currentSubscription.id,
        eventType: isUpgrade ? 'upgraded' : 'downgraded',
        fromPlan: currentPlan?.slug,
        toPlan: newPlanSlug,
        data: {
          fromAmount: currentSubscription.amount,
          toAmount: newAmount,
          billingCycle: newBillingCycle,
        },
      });

      // Send notification
      await this.createNotification({
        tenantId,
        type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
        priority: 'normal',
        title: isUpgrade ? 'Plan Upgraded!' : 'Plan Changed',
        message: `Your subscription has been ${isUpgrade ? 'upgraded' : 'changed'} to the ${newPlan.name} plan.`,
        actionUrl: '/settings/subscription',
        actionText: 'View Details',
        channels: ['in_app', 'email'],
      });

      const [updatedSubscription] = await db
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.id, currentSubscription.id));

      return updatedSubscription;
    } else {
      // Schedule change for next billing cycle
      // TODO: Implement scheduled plan changes
      throw new Error('Scheduled plan changes not yet implemented');
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(tenantId: string, immediate: boolean = false): Promise<void> {
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing', 'past_due')`,
      ),
      orderBy: [desc(tenantSubscriptions.createdAt)],
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const now = new Date();

    if (immediate) {
      // Cancel immediately
      await db
        .update(tenantSubscriptions)
        .set({
          status: 'canceled',
          canceledAt: now,
          endedAt: now,
          updatedAt: now,
        })
        .where(eq(tenantSubscriptions.id, subscription.id));

      // Update tenant
      await db
        .update(tenants)
        .set({
          subscription: 'canceled',
          billingStatus: 'canceled',
          isActive: false,
          updatedAt: now,
        })
        .where(eq(tenants.id, tenantId));
    } else {
      // Cancel at end of current period
      await db
        .update(tenantSubscriptions)
        .set({
          cancelAt: subscription.currentPeriodEnd,
          canceledAt: now,
          updatedAt: now,
        })
        .where(eq(tenantSubscriptions.id, subscription.id));
    }

    // Create event
    await this.createEvent({
      tenantId,
      subscriptionId: subscription.id,
      eventType: 'canceled',
      data: {
        immediate,
        cancelDate: immediate ? now : subscription.currentPeriodEnd,
      },
    });

    // Send notification
    await this.createNotification({
      tenantId,
      type: 'subscription_canceled',
      priority: 'high',
      title: 'Subscription Canceled',
      message: immediate
        ? 'Your subscription has been canceled immediately.'
        : `Your subscription will end on ${subscription.currentPeriodEnd.toLocaleDateString()}.`,
      actionUrl: '/settings/subscription',
      actionText: 'Reactivate',
      channels: ['in_app', 'email'],
    });
  }

  /**
   * Convert trial to paid subscription
   */
  static async convertTrialToPaid(
    tenantId: string,
    paymentMethodId?: string,
  ): Promise<TenantSubscription> {
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        eq(tenantSubscriptions.status, 'trialing'),
      ),
      orderBy: [desc(tenantSubscriptions.createdAt)],
    });

    if (!subscription) {
      throw new Error('No trial subscription found');
    }

    const now = new Date();
    const newPeriodEnd =
      subscription.billingCycle === 'annual'
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Update subscription
    const [updatedSubscription] = await db
      .update(tenantSubscriptions)
      .set({
        status: 'active',
        isTrialing: false,
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        updatedAt: now,
      })
      .where(eq(tenantSubscriptions.id, subscription.id))
      .returning();

    // Update tenant
    await db
      .update(tenants)
      .set({
        subscription: 'active',
        billingStatus: 'current',
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId));

    // Create event
    await this.createEvent({
      tenantId,
      subscriptionId: subscription.id,
      eventType: 'trial_converted',
      data: {
        trialEndDate: subscription.trialEndDate,
        conversionDate: now,
      },
    });

    // Send notification
    await this.createNotification({
      tenantId,
      type: 'trial_converted',
      priority: 'normal',
      title: 'Trial Converted!',
      message: 'Your trial has been successfully converted to a paid subscription.',
      actionUrl: '/settings/subscription',
      actionText: 'View Subscription',
      channels: ['in_app', 'email'],
    });

    return updatedSubscription;
  }

  /**
   * Handle trial expiration
   */
  static async handleTrialExpiration(tenantId: string): Promise<void> {
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        eq(tenantSubscriptions.status, 'trialing'),
      ),
      orderBy: [desc(tenantSubscriptions.createdAt)],
    });

    if (!subscription || !subscription.trialEndDate) {
      return;
    }

    const now = new Date();
    if (subscription.trialEndDate > now) {
      return; // Trial not expired yet
    }

    // Check if payment method is on file
    const hasPaymentMethod =
      !!subscription.stripeCustomerId || !!subscription.stripePaymentIntentId;

    if (hasPaymentMethod) {
      // Auto-convert to paid if payment method exists
      await this.convertTrialToPaid(tenantId);
    } else {
      // Cancel subscription if no payment method
      await db
        .update(tenantSubscriptions)
        .set({
          status: 'incomplete_expired',
          endedAt: now,
          updatedAt: now,
        })
        .where(eq(tenantSubscriptions.id, subscription.id));

      // Update tenant
      await db
        .update(tenants)
        .set({
          subscription: 'expired',
          billingStatus: 'unpaid',
          isActive: false,
          updatedAt: now,
        })
        .where(eq(tenants.id, tenantId));

      // Create event
      await this.createEvent({
        tenantId,
        subscriptionId: subscription.id,
        eventType: 'trial_expired',
        data: {
          trialEndDate: subscription.trialEndDate,
        },
      });

      // Send notification
      await this.createNotification({
        tenantId,
        type: 'trial_expired',
        priority: 'urgent',
        title: 'Trial Expired',
        message: 'Your trial has expired. Add a payment method to continue using our service.',
        actionUrl: '/settings/billing',
        actionText: 'Add Payment',
        channels: ['in_app', 'email'],
      });
    }
  }

  /**
   * Grant free subscription (admin action)
   */
  static async grantFreeSubscription(
    tenantId: string,
    planSlug: string,
    reason?: string,
  ): Promise<TenantSubscription> {
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.slug, planSlug),
    });

    if (!plan) {
      throw new Error(`Plan not found: ${planSlug}`);
    }

    const now = new Date();
    const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    // Create free subscription
    const [subscription] = await db
      .insert(tenantSubscriptions)
      .values({
        tenantId,
        planId: plan.id,
        status: 'active',
        billingCycle: 'annual',
        billingInterval: 1,
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: oneYearLater,
        amount: '0.00',
        currency: 'USD',
        isFree: true,
        customPricing: false,
        notes: reason || 'Free subscription granted by admin',
      })
      .returning();

    // Update tenant
    await db
      .update(tenants)
      .set({
        plan: planSlug,
        subscription: 'active',
        billingStatus: 'current',
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId));

    // Create event
    await this.createEvent({
      tenantId,
      subscriptionId: subscription.id,
      eventType: 'free_subscription_granted',
      data: {
        plan: planSlug,
        reason,
      },
    });

    return subscription;
  }

  /**
   * Create subscription event
   */
  private static async createEvent(event: NewSubscriptionEvent): Promise<void> {
    await db.insert(subscriptionEvents).values({
      ...event,
      notificationSent: false,
    });
  }

  /**
   * Create subscription notification
   */
  private static async createNotification(
    notification: Omit<NewSubscriptionNotification, 'status'>,
  ): Promise<void> {
    await db.insert(subscriptionNotifications).values({
      ...notification,
      status: 'pending',
    });
  }

  /**
   * Check for upcoming trial expirations and send warnings
   */
  static async checkTrialExpirations(): Promise<void> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get trials expiring soon
    const expiringTrials = await db
      .select()
      .from(tenantSubscriptions)
      .where(
        and(
          eq(tenantSubscriptions.status, 'trialing'),
          gte(tenantSubscriptions.trialEndDate, now),
          lte(tenantSubscriptions.trialEndDate, sevenDaysFromNow),
        ),
      );

    for (const subscription of expiringTrials) {
      const daysRemaining = Math.ceil(
        (subscription.trialEndDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      // Send warnings at 7, 3, and 1 day marks
      if ([7, 3, 1].includes(daysRemaining)) {
        await this.createNotification({
          tenantId: subscription.tenantId,
          type: 'trial_expiring',
          priority: daysRemaining === 1 ? 'urgent' : 'high',
          title: `Trial Ending in ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''}`,
          message: `Your trial will end in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}. Add a payment method to continue.`,
          actionUrl: '/settings/billing',
          actionText: 'Add Payment',
          channels: ['in_app', 'email'],
        });
      }
    }
  }

  /**
   * Check for usage limit violations
   */
  static async checkUsageLimits(): Promise<void> {
    // Get all active subscriptions
    const activeSubscriptions = await db
      .select()
      .from(tenantSubscriptions)
      .where(sql`${tenantSubscriptions.status} IN ('active', 'trialing')`);

    for (const subscription of activeSubscriptions) {
      // Skip free subscriptions
      if (subscription.isFree) {
        continue;
      }

      const status = await this.getSubscriptionStatus(subscription.tenantId);
      if (!status) {
        continue;
      }

      // Check if over limit
      if (status.isOverLimit) {
        // Create warning notification
        const overageMessages = [];
        if (status.overageDetails.users) {
          overageMessages.push(`${status.overageDetails.users} users over limit`);
        }
        if (status.overageDetails.storage) {
          overageMessages.push(
            `${Math.round(status.overageDetails.storage / 1024)}GB over storage limit`,
          );
        }
        if (status.overageDetails.apiCalls) {
          overageMessages.push(`${status.overageDetails.apiCalls} API calls over limit`);
        }

        await this.createNotification({
          tenantId: subscription.tenantId,
          type: 'usage_limit_exceeded',
          priority: 'high',
          title: 'Usage Limits Exceeded',
          message: `You've exceeded your plan limits: ${overageMessages.join(', ')}. Consider upgrading your plan.`,
          actionUrl: '/settings/subscription',
          actionText: 'Upgrade Plan',
          channels: ['in_app'],
        });
      } else {
        // Check for approaching limits (80%)
        const warningThreshold = 0.8;
        const warnings = [];

        if (
          status.limits.users !== -1 &&
          status.usage.users >= status.limits.users * warningThreshold
        ) {
          warnings.push(`users (${status.usage.users}/${status.limits.users})`);
        }
        if (
          status.limits.storage !== -1 &&
          status.usage.storage >= status.limits.storage * 1024 * warningThreshold
        ) {
          warnings.push(
            `storage (${Math.round(status.usage.storage / 1024)}/${status.limits.storage}GB)`,
          );
        }

        if (warnings.length > 0) {
          await this.createNotification({
            tenantId: subscription.tenantId,
            type: 'usage_limit_warning',
            priority: 'normal',
            title: 'Approaching Plan Limits',
            message: `You're approaching your plan limits: ${warnings.join(', ')}`,
            actionUrl: '/settings/subscription',
            actionText: 'View Usage',
            channels: ['in_app'],
          });
        }
      }
    }
  }
}
