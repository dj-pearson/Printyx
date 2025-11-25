// =====================================================================
// SALES SUPERVISOR REPORTS API
// RESTful endpoints for sales supervisor reports (Level 3 - Reports 8-11)
// =====================================================================

import { Router, Response } from 'express';
import {
  enhanceUserContext,
  requirePermission,
  type AuthenticatedRequest,
} from '../middleware/enhanced-rbac-middleware';
import { SalesSupervisorReportingService } from '../services/sales-supervisor-reporting-service';

const router = Router();

// Apply RBAC to all routes
router.use(enhanceUserContext);

// =====================================================================
// REPORT 8: LOCATION PIPELINE OVERVIEW
// =====================================================================

/**
 * GET /api/sales-supervisor-reports/location/pipeline-overview
 * Get location pipeline overview (aggregated by location and stage)
 *
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 */
router.get(
  '/location/pipeline-overview',
  requirePermission(['sales.pipeline.view_location', 'sales.pipeline.view_regional']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { dateFrom, dateTo } = req.query;

      const dateRange = dateFrom && dateTo ? {
        dateFrom: new Date(dateFrom as string),
        dateTo: new Date(dateTo as string),
      } : undefined;

      const result = await SalesSupervisorReportingService.getLocationPipelineOverview(
        req.user,
        dateRange
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching location pipeline overview:', error);
      res.status(500).json({ error: 'Failed to fetch location pipeline overview', details: error.message });
    }
  }
);

// =====================================================================
// REPORT 9: LOCATION PERFORMANCE METRICS
// =====================================================================

/**
 * GET /api/sales-supervisor-reports/location/performance
 * Get location performance metrics (revenue, deals, win rate, etc.)
 *
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 */
router.get(
  '/location/performance',
  requirePermission(['sales.performance.view_location', 'sales.performance.view_regional']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { dateFrom, dateTo } = req.query;

      const dateRange = dateFrom && dateTo ? {
        dateFrom: new Date(dateFrom as string),
        dateTo: new Date(dateTo as string),
      } : undefined;

      const result = await SalesSupervisorReportingService.getLocationPerformanceMetrics(
        req.user,
        dateRange
      );

      // Calculate performance insights
      const insights = {
        performanceSpread: result.locations.length > 1
          ? ((result.summary.topLocation?.totalRevenue || 0) - (result.summary.bottomLocation?.totalRevenue || 0))
          : 0,
        averageTeamSize: result.locations.length > 0
          ? result.locations.reduce((sum, l) => sum + l.teamSize, 0) / result.locations.length
          : 0,
        topPerformers: result.locations.slice(0, 3),
        needsAttention: result.locations.filter(l => l.quotaAttainment < 75),
      };

      res.json({
        ...result,
        insights,
      });
    } catch (error: any) {
      console.error('Error fetching location performance:', error);
      res.status(500).json({ error: 'Failed to fetch location performance', details: error.message });
    }
  }
);

// =====================================================================
// REPORT 10: LOCATION QUOTA TRACKING
// =====================================================================

/**
 * GET /api/sales-supervisor-reports/location/quota
 * Get location quota tracking (quota attainment by location)
 *
 * Query params:
 * - period: current | previous | ytd
 */
router.get(
  '/location/quota',
  requirePermission(['sales.quota.view_location', 'sales.quota.view_regional']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { period = 'current' } = req.query;

      const result = await SalesSupervisorReportingService.getLocationQuotaTracking(
        req.user,
        period as 'current' | 'previous' | 'ytd'
      );

      // Calculate quota insights
      const insights = {
        attainmentDistribution: {
          exceeding: result.quotas.filter(q => q.attainmentPercent >= 100).length,
          onTrack: result.quotas.filter(q => q.attainmentPercent >= 90 && q.attainmentPercent < 100).length,
          atRisk: result.quotas.filter(q => q.attainmentPercent >= 75 && q.attainmentPercent < 90).length,
          critical: result.quotas.filter(q => q.attainmentPercent < 75).length,
        },
        totalGap: result.quotas.reduce((sum, q) => sum + Math.max(0, q.gap), 0),
        projectedShortfall: result.quotas.filter(q => q.projectedAttainment < 100).length,
      };

      res.json({
        ...result,
        insights,
      });
    } catch (error: any) {
      console.error('Error fetching location quota:', error);
      res.status(500).json({ error: 'Failed to fetch location quota', details: error.message });
    }
  }
);

// =====================================================================
// REPORT 11: LOCATION ACTIVITY SUMMARY
// =====================================================================

/**
 * GET /api/sales-supervisor-reports/location/activity
 * Get location activity summary (activities by type and location)
 *
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 */
router.get(
  '/location/activity',
  requirePermission(['sales.activity.view_location', 'sales.activity.view_regional']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { dateFrom, dateTo } = req.query;

      const dateRange = dateFrom && dateTo ? {
        dateFrom: new Date(dateFrom as string),
        dateTo: new Date(dateTo as string),
      } : undefined;

      const result = await SalesSupervisorReportingService.getLocationActivitySummary(
        req.user,
        dateRange
      );

      // Calculate activity insights
      const insights = {
        activityBreakdown: {
          calls: result.activities.reduce((sum, a) => sum + a.calls, 0),
          emails: result.activities.reduce((sum, a) => sum + a.emails, 0),
          meetings: result.activities.reduce((sum, a) => sum + a.meetings, 0),
          demos: result.activities.reduce((sum, a) => sum + a.demos, 0),
          proposals: result.activities.reduce((sum, a) => sum + a.proposals, 0),
        },
        performanceGap: result.summary.mostActiveLocation
          ? result.summary.averagePerLocation - (result.activities[result.activities.length - 1]?.totalActivities || 0)
          : 0,
        topPerformers: result.activities.slice(0, 3),
      };

      res.json({
        ...result,
        insights,
      });
    } catch (error: any) {
      console.error('Error fetching location activity:', error);
      res.status(500).json({ error: 'Failed to fetch location activity', details: error.message });
    }
  }
);

// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

/**
 * POST /api/sales-supervisor-reports/cache/invalidate
 * Invalidate report cache (for supervisors)
 */
router.post(
  '/cache/invalidate',
  requirePermission(['sales.reports.manage_location', 'sales.reports.manage_regional']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { pattern } = req.body;

      SalesSupervisorReportingService.clearCache(pattern);

      res.json({
        message: 'Cache invalidated successfully',
        pattern: pattern || 'all',
      });
    } catch (error: any) {
      console.error('Error invalidating cache:', error);
      res.status(500).json({ error: 'Failed to invalidate cache', details: error.message });
    }
  }
);

// =====================================================================
// EXPORT
// =====================================================================

export default router;
