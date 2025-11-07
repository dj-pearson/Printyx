import { db } from '../db';
import {
  usageMetrics,
  dailyUsageSnapshots,
  tenants,
  tenantSubscriptions,
  subscriptionPlans,
  users,
  locations,
  businessRecords,
  NewUsageMetric,
  NewDailyUsageSnapshot,
} from '@shared/schema';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';

/**
 * USAGE TRACKING SERVICE
 *
 * Tracks tenant usage metrics against subscription limits.
 * Handles daily snapshots, period aggregation, and cache updates.
 */

export interface UsageUpdate {
  tenantId: string;
  apiCalls?: number; // Increment API call count
  storageUsedMb?: number; // Set storage used (absolute value)
}

export class UsageTrackingService {
  /**
   * Initialize or get current usage period for tenant
   */
  static async getCurrentUsagePeriod(tenantId: string): Promise<typeof usageMetrics.$inferSelect | null> {
    const now = new Date();

    // Get subscription to determine period boundaries
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing', 'past_due')`
      ),
      orderBy: [desc(tenantSubscriptions.createdAt)],
    });

    if (!subscription) {
      return null;
    }

    // Check for existing period
    let usage = await db.query.usageMetrics.findFirst({
      where: and(
        eq(usageMetrics.tenantId, tenantId),
        lte(usageMetrics.periodStart, now),
        gte(usageMetrics.periodEnd, now)
      ),
    });

    // Create new period if doesn't exist
    if (!usage) {
      const periodStart = subscription.currentPeriodStart;
      const periodEnd = subscription.currentPeriodEnd;

      const [newUsage] = await db
        .insert(usageMetrics)
        .values({
          tenantId,
          periodStart,
          periodEnd,
          activeUsers: 0,
          totalUsers: 0,
          storageUsedMb: 0,
          apiCalls: 0,
          activeLocations: 0,
          businessRecords: 0,
          featureUsage: {},
          isOverLimit: false,
          overageDetails: {},
        })
        .returning();

      usage = newUsage;
    }

    return usage;
  }

  /**
   * Track API call
   */
  static async trackApiCall(tenantId: string, endpoint?: string): Promise<void> {
    const usage = await this.getCurrentUsagePeriod(tenantId);
    if (!usage) {
      return;
    }

    // Increment API call count
    await db
      .update(usageMetrics)
      .set({
        apiCalls: sql`${usageMetrics.apiCalls} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(usageMetrics.id, usage.id));

    // Update tenant cache
    await db
      .update(tenants)
      .set({
        apiCalls: sql`${tenants.apiCalls} + 1`,
        lastActivity: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // Track feature usage if endpoint provided
    if (endpoint) {
      const featureUsage = usage.featureUsage as Record<string, number> || {};
      featureUsage[endpoint] = (featureUsage[endpoint] || 0) + 1;

      await db
        .update(usageMetrics)
        .set({
          featureUsage: featureUsage,
        })
        .where(eq(usageMetrics.id, usage.id));
    }
  }

  /**
   * Update storage usage
   */
  static async updateStorageUsage(tenantId: string, storageUsedMb: number): Promise<void> {
    const usage = await this.getCurrentUsagePeriod(tenantId);
    if (!usage) {
      return;
    }

    await db
      .update(usageMetrics)
      .set({
        storageUsedMb,
        updatedAt: new Date(),
      })
      .where(eq(usageMetrics.id, usage.id));

    // Update tenant cache
    await db
      .update(tenants)
      .set({
        storageUsed: storageUsedMb,
        lastActivity: new Date(),
      })
      .where(eq(tenants.id, tenantId));
  }

  /**
   * Recalculate all usage metrics for a tenant
   */
  static async recalculateUsage(tenantId: string): Promise<void> {
    const usage = await this.getCurrentUsagePeriod(tenantId);
    if (!usage) {
      return;
    }

    // Count active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeUsersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.isActive, true),
          gte(users.lastLoginAt, thirtyDaysAgo)
        )
      );

    // Count total users
    const [totalUsersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.isActive, true)
        )
      );

    // Count active locations
    const [locationsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, tenantId),
          eq(locations.isActive, true)
        )
      );

    // Count business records
    const [recordsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.isDeleted, false)
        )
      );

    // Get storage usage
    // TODO: Implement actual storage calculation from documents, attachments, etc.
    // For now, keep existing value or default to 0
    const storageUsedMb = usage.storageUsedMb || 0;

    // Update usage metrics
    await db
      .update(usageMetrics)
      .set({
        activeUsers: activeUsersCount.count,
        totalUsers: totalUsersCount.count,
        activeLocations: locationsCount.count,
        businessRecords: recordsCount.count,
        storageUsedMb,
        updatedAt: new Date(),
      })
      .where(eq(usageMetrics.id, usage.id));

    // Check if over limit
    await this.checkLimits(tenantId);
  }

  /**
   * Check if tenant is over subscription limits
   */
  static async checkLimits(tenantId: string): Promise<boolean> {
    const usage = await this.getCurrentUsagePeriod(tenantId);
    if (!usage) {
      return false;
    }

    // Get subscription and plan
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing', 'past_due')`
      ),
      orderBy: [desc(tenantSubscriptions.createdAt)],
    });

    if (!subscription) {
      return false;
    }

    // Skip limit checks for free subscriptions
    if (subscription.isFree) {
      return false;
    }

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, subscription.planId),
    });

    if (!plan) {
      return false;
    }

    // Apply custom limits if set
    const customLimits = subscription.customLimits as any || {};
    const limits = {
      maxUsers: customLimits.maxUsers || plan.maxUsers,
      maxStorage: customLimits.maxStorage || plan.maxStorage,
      maxApiCalls: customLimits.maxApiCalls || plan.maxApiCalls,
      maxLocations: customLimits.maxLocations || plan.maxLocations,
      maxBusinessRecords: customLimits.maxBusinessRecords || plan.maxBusinessRecords,
    };

    // Check each limit (-1 means unlimited)
    const overages: Record<string, number> = {};
    let isOverLimit = false;

    if (limits.maxUsers !== -1 && usage.totalUsers > limits.maxUsers) {
      overages.users = usage.totalUsers - limits.maxUsers;
      isOverLimit = true;
    }

    if (limits.maxStorage !== -1 && usage.storageUsedMb > limits.maxStorage * 1024) {
      overages.storage = usage.storageUsedMb - (limits.maxStorage * 1024);
      isOverLimit = true;
    }

    if (limits.maxApiCalls !== -1 && usage.apiCalls > limits.maxApiCalls) {
      overages.apiCalls = usage.apiCalls - limits.maxApiCalls;
      isOverLimit = true;
    }

    if (limits.maxLocations !== -1 && usage.activeLocations > limits.maxLocations) {
      overages.locations = usage.activeLocations - limits.maxLocations;
      isOverLimit = true;
    }

    if (limits.maxBusinessRecords !== -1 && usage.businessRecords > limits.maxBusinessRecords) {
      overages.businessRecords = usage.businessRecords - limits.maxBusinessRecords;
      isOverLimit = true;
    }

    // Update usage metrics with overage info
    await db
      .update(usageMetrics)
      .set({
        isOverLimit,
        overageDetails: overages,
        updatedAt: new Date(),
      })
      .where(eq(usageMetrics.id, usage.id));

    return isOverLimit;
  }

  /**
   * Create daily usage snapshot
   */
  static async createDailySnapshot(tenantId: string): Promise<void> {
    const usage = await this.getCurrentUsagePeriod(tenantId);
    if (!usage) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if snapshot already exists for today
    const existing = await db.query.dailyUsageSnapshots.findFirst({
      where: and(
        eq(dailyUsageSnapshots.tenantId, tenantId),
        eq(dailyUsageSnapshots.date, today)
      ),
    });

    if (existing) {
      // Update existing snapshot
      await db
        .update(dailyUsageSnapshots)
        .set({
          activeUsers: usage.activeUsers,
          apiCalls: usage.apiCalls,
          storageUsedMb: usage.storageUsedMb,
        })
        .where(eq(dailyUsageSnapshots.id, existing.id));
    } else {
      // Create new snapshot
      await db.insert(dailyUsageSnapshots).values({
        tenantId,
        date: today,
        activeUsers: usage.activeUsers,
        apiCalls: usage.apiCalls,
        storageUsedMb: usage.storageUsedMb,
      });
    }
  }

  /**
   * Get usage history for a tenant
   */
  static async getUsageHistory(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<typeof dailyUsageSnapshots.$inferSelect>> {
    return db
      .select()
      .from(dailyUsageSnapshots)
      .where(
        and(
          eq(dailyUsageSnapshots.tenantId, tenantId),
          gte(dailyUsageSnapshots.date, startDate),
          lte(dailyUsageSnapshots.date, endDate)
        )
      )
      .orderBy(dailyUsageSnapshots.date);
  }

  /**
   * Reset usage metrics for new billing period
   */
  static async resetForNewPeriod(tenantId: string, periodStart: Date, periodEnd: Date): Promise<void> {
    // Create new usage period
    await db.insert(usageMetrics).values({
      tenantId,
      periodStart,
      periodEnd,
      activeUsers: 0,
      totalUsers: 0,
      storageUsedMb: 0,
      apiCalls: 0,
      activeLocations: 0,
      businessRecords: 0,
      featureUsage: {},
      isOverLimit: false,
      overageDetails: {},
    });

    // Reset tenant cache
    await db
      .update(tenants)
      .set({
        apiCalls: 0,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // Recalculate current counts
    await this.recalculateUsage(tenantId);
  }

  /**
   * Batch recalculate usage for all active tenants
   */
  static async recalculateAllUsage(): Promise<void> {
    const activeTenants = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.isActive, true));

    console.log(`♻️ Recalculating usage for ${activeTenants.length} tenants...`);

    for (const tenant of activeTenants) {
      try {
        await this.recalculateUsage(tenant.id);
      } catch (error) {
        console.error(`Failed to recalculate usage for tenant ${tenant.id}:`, error);
      }
    }

    console.log('✅ Usage recalculation complete');
  }

  /**
   * Create daily snapshots for all active tenants
   */
  static async createAllDailySnapshots(): Promise<void> {
    const activeTenants = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.isActive, true));

    console.log(`📸 Creating daily snapshots for ${activeTenants.length} tenants...`);

    for (const tenant of activeTenants) {
      try {
        await this.createDailySnapshot(tenant.id);
      } catch (error) {
        console.error(`Failed to create snapshot for tenant ${tenant.id}:`, error);
      }
    }

    console.log('✅ Daily snapshots complete');
  }

  /**
   * Get usage summary for display
   */
  static async getUsageSummary(tenantId: string): Promise<{
    current: typeof usageMetrics.$inferSelect;
    limits: {
      users: number;
      storage: number;
      apiCalls: number;
      locations: number;
      businessRecords: number;
    };
    percentages: {
      users: number;
      storage: number;
      apiCalls: number;
      locations: number;
      businessRecords: number;
    };
    isOverLimit: boolean;
  } | null> {
    const usage = await this.getCurrentUsagePeriod(tenantId);
    if (!usage) {
      return null;
    }

    // Get subscription and plan
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing', 'past_due')`
      ),
      orderBy: [desc(tenantSubscriptions.createdAt)],
    });

    if (!subscription) {
      return null;
    }

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, subscription.planId),
    });

    if (!plan) {
      return null;
    }

    // Apply custom limits if set
    const customLimits = subscription.customLimits as any || {};
    const limits = {
      users: customLimits.maxUsers || plan.maxUsers,
      storage: customLimits.maxStorage || plan.maxStorage,
      apiCalls: customLimits.maxApiCalls || plan.maxApiCalls,
      locations: customLimits.maxLocations || plan.maxLocations,
      businessRecords: customLimits.maxBusinessRecords || plan.maxBusinessRecords,
    };

    // Calculate percentages (-1 means unlimited, show as 0%)
    const percentages = {
      users: limits.users === -1 ? 0 : Math.min(100, (usage.totalUsers / limits.users) * 100),
      storage: limits.storage === -1 ? 0 : Math.min(100, (usage.storageUsedMb / (limits.storage * 1024)) * 100),
      apiCalls: limits.apiCalls === -1 ? 0 : Math.min(100, (usage.apiCalls / limits.apiCalls) * 100),
      locations: limits.locations === -1 ? 0 : Math.min(100, (usage.activeLocations / limits.locations) * 100),
      businessRecords: limits.businessRecords === -1 ? 0 : Math.min(100, (usage.businessRecords / limits.businessRecords) * 100),
    };

    return {
      current: usage,
      limits,
      percentages,
      isOverLimit: usage.isOverLimit,
    };
  }
}
