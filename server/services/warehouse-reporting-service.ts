// =====================================================================
// WAREHOUSE REPORTING SERVICE
// Business logic for warehouse team reports (Level 2+ - FPY metrics)
// =====================================================================

import { db } from '../db';
import { sql, and, eq, gte, lte, desc } from 'drizzle-orm';
import type { EnhancedUserContext } from '../middleware/enhanced-rbac-middleware';
import { HierarchicalQueryBuilder } from '../middleware/hierarchical-query-builder';
import { warehouseKittingOperations, fpyMetrics } from '@shared/warehouse-fpy-schema';

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================

interface DateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

// Warehouse Team Quick Stats (for embedded widgets)
export interface WarehouseTeamQuickStats {
  performance: {
    firstPassYield: number; // Percentage (0-100)
    accuracyRate: number; // Percentage (0-100)
    productivity: number; // Kits per hour
    qualityScore: number; // 1-5 scale
  };
  activity: {
    totalKits: number;
    completedKits: number;
    inProgressKits: number;
    reworkRequired: number;
  };
  team: {
    totalTechnicians: number;
    activeTechnicians: number;
    topTechnician: string;
    techsNeedingSupport: number;
  };
  trends: {
    fpyTrend: 'up' | 'down' | 'stable';
    accuracyTrend: 'up' | 'down' | 'stable';
    productivityTrend: 'up' | 'down' | 'stable';
  };
}

// =====================================================================
// CACHE SERVICE
// =====================================================================

interface CachedData<T> {
  data: T;
  expiresAt: Date;
}

class ReportCache {
  private static cache = new Map<string, CachedData<any>>();
  private static DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  static set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const expiresAt = new Date(Date.now() + ttl);
    this.cache.set(key, { data, expiresAt });
  }

  static clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

// =====================================================================
// WAREHOUSE REPORTING SERVICE
// =====================================================================

export class WarehouseReportingService {
  /**
   * Get quick stats for warehouse team (for embedded widgets)
   * Optimized lightweight endpoint for in-module display
   *
   * Permission: operations.warehouse.view_team or higher
   */
  static async getTeamQuickStats(
    userContext: EnhancedUserContext,
    dateRange?: DateRange
  ): Promise<WarehouseTeamQuickStats> {
    // Generate cache key
    const cacheKey = `warehouse-team-quick-stats:${userContext.userId}:${JSON.stringify(dateRange || {})}`;

    // Check cache
    const cached = ReportCache.get<WarehouseTeamQuickStats>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build hierarchical query for team member access
    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    // Default date range: last 30 days
    const dateFrom = dateRange?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = dateRange?.dateTo || new Date();

    // Fetch warehouse kitting operations for the team
    const operations = await db
      .select()
      .from(warehouseKittingOperations)
      .where(
        and(
          eq(warehouseKittingOperations.tenantId, userContext.tenantId),
          sql`${warehouseKittingOperations.assignedTechnician} IN (${sql.raw(
            accessibleUserIds.map((id) => `'${id}'`).join(',') || "''"
          )})`,
          gte(warehouseKittingOperations.createdAt, dateFrom),
          lte(warehouseKittingOperations.createdAt, dateTo)
        )
      )
      .orderBy(desc(warehouseKittingOperations.createdAt));

    // Calculate performance metrics
    const totalKits = operations.length;
    const completedKits = operations.filter((op) => op.operationStatus === 'completed').length;
    const inProgressKits = operations.filter((op) => op.operationStatus === 'in_progress').length;
    const reworkRequired = operations.filter((op) => op.reworkRequired).length;
    const firstPassKits = operations.filter((op) => op.firstPassYield).length;
    const passedKits = operations.filter((op) => op.qualityStatus === 'pass').length;

    // Calculate FPY (First Pass Yield) percentage
    const firstPassYield = completedKits > 0 ? (firstPassKits / completedKits) * 100 : 0;

    // Calculate accuracy rate (kits that passed quality inspection)
    const accuracyRate = totalKits > 0 ? (passedKits / totalKits) * 100 : 0;

    // Calculate productivity (kits per hour)
    const totalMinutes = operations
      .filter((op) => op.totalDurationMinutes)
      .reduce((sum, op) => sum + (op.totalDurationMinutes || 0), 0);
    const productivity = totalMinutes > 0 ? (completedKits / (totalMinutes / 60)) : 0;

    // Calculate quality score (1-5 scale based on FPY and accuracy)
    const qualityScore = ((firstPassYield + accuracyRate) / 2) / 20; // Convert to 1-5 scale

    // Get team member stats
    const uniqueTechnicians = new Set(operations.map((op) => op.assignedTechnician));
    const activeTechnicians = new Set(
      operations
        .filter((op) => op.operationStatus === 'in_progress' || op.operationStatus === 'completed')
        .map((op) => op.assignedTechnician)
    );

    // Find top technician (highest FPY rate)
    const technicianStats = await Promise.all(
      Array.from(uniqueTechnicians).map(async (techId) => {
        const techOps = operations.filter((op) => op.assignedTechnician === techId);
        const techCompleted = techOps.filter((op) => op.operationStatus === 'completed').length;
        const techFPY = techOps.filter((op) => op.firstPassYield).length;
        const techFPYRate = techCompleted > 0 ? (techFPY / techCompleted) * 100 : 0;

        // Fetch user name from database
        const userQuery = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.id, techId),
        });

        return {
          technicianId: techId,
          technicianName: userQuery?.name || 'Unknown',
          fpyRate: techFPYRate,
          completedKits: techCompleted,
        };
      })
    );

    // Sort by FPY rate and get top technician
    technicianStats.sort((a, b) => b.fpyRate - a.fpyRate);
    const topTechnician = technicianStats[0]?.technicianName || 'N/A';

    // Identify technicians needing support (FPY < 70%)
    const techsNeedingSupport = technicianStats.filter((tech) => tech.fpyRate < 70).length;

    // Calculate trends (compare with previous period)
    const previousDateFrom = new Date(dateFrom.getTime() - (dateTo.getTime() - dateFrom.getTime()));
    const previousOperations = await db
      .select()
      .from(warehouseKittingOperations)
      .where(
        and(
          eq(warehouseKittingOperations.tenantId, userContext.tenantId),
          sql`${warehouseKittingOperations.assignedTechnician} IN (${sql.raw(
            accessibleUserIds.map((id) => `'${id}'`).join(',') || "''"
          )})`,
          gte(warehouseKittingOperations.createdAt, previousDateFrom),
          lte(warehouseKittingOperations.createdAt, dateFrom)
        )
      );

    const previousCompleted = previousOperations.filter((op) => op.operationStatus === 'completed').length;
    const previousFPY = previousOperations.filter((op) => op.firstPassYield).length;
    const previousFPYRate = previousCompleted > 0 ? (previousFPY / previousCompleted) * 100 : 0;
    const previousPassed = previousOperations.filter((op) => op.qualityStatus === 'pass').length;
    const previousAccuracyRate = previousOperations.length > 0 ? (previousPassed / previousOperations.length) * 100 : 0;
    const previousTotalMinutes = previousOperations
      .filter((op) => op.totalDurationMinutes)
      .reduce((sum, op) => sum + (op.totalDurationMinutes || 0), 0);
    const previousProductivity = previousTotalMinutes > 0 ? (previousCompleted / (previousTotalMinutes / 60)) : 0;

    const fpyTrend = firstPassYield > previousFPYRate + 5 ? 'up' : firstPassYield < previousFPYRate - 5 ? 'down' : 'stable';
    const accuracyTrend = accuracyRate > previousAccuracyRate + 5 ? 'up' : accuracyRate < previousAccuracyRate - 5 ? 'down' : 'stable';
    const productivityTrend = productivity > previousProductivity + 0.5 ? 'up' : productivity < previousProductivity - 0.5 ? 'down' : 'stable';

    // Build result
    const result: WarehouseTeamQuickStats = {
      performance: {
        firstPassYield: Math.round(firstPassYield * 10) / 10,
        accuracyRate: Math.round(accuracyRate * 10) / 10,
        productivity: Math.round(productivity * 10) / 10,
        qualityScore: Math.round(qualityScore * 100) / 100,
      },
      activity: {
        totalKits,
        completedKits,
        inProgressKits,
        reworkRequired,
      },
      team: {
        totalTechnicians: uniqueTechnicians.size,
        activeTechnicians: activeTechnicians.size,
        topTechnician,
        techsNeedingSupport,
      },
      trends: {
        fpyTrend,
        accuracyTrend,
        productivityTrend,
      },
    };

    // Cache result
    ReportCache.set(cacheKey, result);

    return result;
  }

  /**
   * Clear report cache
   */
  static clearCache(pattern?: string): void {
    ReportCache.clear(pattern);
  }
}
