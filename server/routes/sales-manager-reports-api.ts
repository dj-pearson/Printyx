// =====================================================================
// SALES MANAGER REPORTS API
// RESTful endpoints for sales manager reports (Level 4 - Reports 12-15)
// =====================================================================

import { Router, type Request, type Response } from 'express';
import { SalesManagerReportingService } from '../services/sales-manager-reporting-service';
import { enhanceUserContext, requirePermission } from '../middleware/enhanced-rbac-middleware';
import { createModuleLogger } from '../lib/logger';
import { getUserId, getTenantId } from '../utils/auth-helpers';
const log = createModuleLogger('sales-manager-reports-api');

const router = Router();

// Apply RBAC middleware to all routes
router.use(enhanceUserContext);

// =====================================================================
// REPORT 12: REGIONAL PIPELINE OVERVIEW
// =====================================================================

/**
 * @route   GET /api/sales-manager-reports/regional-pipeline
 * @desc    Get pipeline overview aggregated by region
 * @access  Requires: sales.pipeline.view_regional OR sales.pipeline.view_company
 */
router.get(
  '/regional-pipeline',
  requirePermission(['sales.pipeline.view_regional', 'sales.pipeline.view_company']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await SalesManagerReportingService.getRegionalPipelineOverview(
        req.user!,
        dateRange,
      );

      // Enrich response with insights
      const stageBreakdown = data.aggregated.reduce(
        (acc, agg) => {
          acc[agg.stage.toLowerCase().replace(' ', '_')] = {
            totalDeals: agg.totalDeals,
            totalValue: agg.totalValue,
            avgValuePerRegion: agg.avgValuePerRegion,
          };
          return acc;
        },
        {} as Record<string, any>,
      );

      res.json({
        ...data,
        insights: {
          stageBreakdown,
          healthStatus:
            data.summary.healthScore >= 30
              ? 'healthy'
              : data.summary.healthScore >= 20
                ? 'fair'
                : 'needs_attention',
        },
      });
    } catch (error) {
      log.error('Error fetching regional pipeline:', error);
      res.status(500).json({
        message: 'Failed to fetch regional pipeline overview',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 13: REGIONAL PERFORMANCE METRICS
// =====================================================================

/**
 * @route   GET /api/sales-manager-reports/regional-performance
 * @desc    Get performance metrics by region
 * @access  Requires: sales.performance.view_regional OR sales.performance.view_company
 */
router.get(
  '/regional-performance',
  requirePermission(['sales.performance.view_regional', 'sales.performance.view_company']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await SalesManagerReportingService.getRegionalPerformanceMetrics(
        req.user!,
        dateRange,
      );

      // Calculate performance distribution
      const attainmentRanges = {
        exceeding: data.regions.filter((r) => r.quotaAttainment >= 100).length,
        onTrack: data.regions.filter((r) => r.quotaAttainment >= 90 && r.quotaAttainment < 100)
          .length,
        nearTarget: data.regions.filter((r) => r.quotaAttainment >= 75 && r.quotaAttainment < 90)
          .length,
        atRisk: data.regions.filter((r) => r.quotaAttainment < 75).length,
      };

      const winRateRanges = {
        high: data.regions.filter((r) => r.winRate >= 40).length,
        medium: data.regions.filter((r) => r.winRate >= 25 && r.winRate < 40).length,
        low: data.regions.filter((r) => r.winRate < 25).length,
      };

      res.json({
        ...data,
        insights: {
          attainmentRanges,
          winRateRanges,
          topPerformers: data.regions.slice(0, 3),
          needsAttention: data.regions.filter((r) => r.quotaAttainment < 75 || r.winRate < 25),
        },
      });
    } catch (error) {
      log.error('Error fetching regional performance:', error);
      res.status(500).json({
        message: 'Failed to fetch regional performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 14: REGIONAL QUOTA TRACKING
// =====================================================================

/**
 * @route   GET /api/sales-manager-reports/regional-quota
 * @desc    Get quota tracking by region
 * @access  Requires: sales.quota.view_regional OR sales.quota.view_company
 */
router.get(
  '/regional-quota',
  requirePermission(['sales.quota.view_regional', 'sales.quota.view_company']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await SalesManagerReportingService.getRegionalQuotaTracking(
        req.user!,
        dateRange,
      );

      // Attainment distribution breakdown
      const attainmentDistribution = {
        exceeding: data.quotas.filter((q) => q.attainmentPercent >= 100).length,
        onTrack: data.quotas.filter((q) => q.attainmentPercent >= 90 && q.attainmentPercent < 100)
          .length,
        nearTarget: data.quotas.filter((q) => q.attainmentPercent >= 75 && q.attainmentPercent < 90)
          .length,
        atRisk: data.quotas.filter((q) => q.attainmentPercent < 75).length,
      };

      // Calculate gap analysis
      const totalGap = data.quotas.reduce((sum, q) => sum + Math.max(0, q.gap), 0);
      const avgGap = data.quotas.length > 0 ? totalGap / data.quotas.length : 0;

      res.json({
        ...data,
        insights: {
          attainmentDistribution,
          gapAnalysis: {
            totalGap,
            avgGapPerRegion: Math.round(avgGap * 100) / 100,
          },
          criticalRegions: data.quotas.filter((q) => q.attainmentPercent < 70),
        },
      });
    } catch (error) {
      log.error('Error fetching regional quota tracking:', error);
      res.status(500).json({
        message: 'Failed to fetch regional quota tracking',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 15: REGIONAL ACTIVITY SUMMARY
// =====================================================================

/**
 * @route   GET /api/sales-manager-reports/regional-activity
 * @desc    Get activity summary by region
 * @access  Requires: sales.activity.view_regional OR sales.activity.view_company
 */
router.get(
  '/regional-activity',
  requirePermission(['sales.activity.view_regional', 'sales.activity.view_company']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await SalesManagerReportingService.getRegionalActivitySummary(
        req.user!,
        dateRange,
      );

      // Activity type breakdown
      const activityBreakdown = {
        calls: data.activities.reduce((sum, a) => sum + a.calls, 0),
        emails: data.activities.reduce((sum, a) => sum + a.emails, 0),
        meetings: data.activities.reduce((sum, a) => sum + a.meetings, 0),
        demos: data.activities.reduce((sum, a) => sum + a.demos, 0),
        proposals: data.activities.reduce((sum, a) => sum + a.proposals, 0),
      };

      // Calculate activity distribution
      const activityDistribution = {
        high: data.activities.filter((a) => a.activitiesPerRep >= 50).length,
        medium: data.activities.filter((a) => a.activitiesPerRep >= 30 && a.activitiesPerRep < 50)
          .length,
        low: data.activities.filter((a) => a.activitiesPerRep < 30).length,
      };

      res.json({
        ...data,
        insights: {
          activityBreakdown,
          activityDistribution,
          avgActivitiesPerRep:
            data.activities.length > 0
              ? Math.round(
                  (data.activities.reduce((sum, a) => sum + a.activitiesPerRep, 0) /
                    data.activities.length) *
                    100,
                ) / 100
              : 0,
        },
      });
    } catch (error) {
      log.error('Error fetching regional activity:', error);
      res.status(500).json({
        message: 'Failed to fetch regional activity summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

/**
 * @route   POST /api/sales-manager-reports/clear-cache
 * @desc    Clear report cache (executives only)
 * @access  Requires: sales.reports.manage
 */
router.post(
  '/clear-cache',
  requirePermission(['sales.reports.manage']),
  async (req: Request, res: Response) => {
    try {
      SalesManagerReportingService.clearCache();
      res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
      log.error('Error clearing cache:', error);
      res.status(500).json({
        message: 'Failed to clear cache',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

export default router;
