// =====================================================================
// SERVICE MANAGER REPORTS API
// RESTful endpoints for service manager reports (Level 4 - Reports 33-36)
// =====================================================================

import { Router, type Request, type Response } from 'express';
import { ServiceManagerReportingService } from '../services/service-manager-reporting-service';
import { enhanceUserContext, requirePermission } from '../middleware/enhanced-rbac-middleware';
import { createModuleLogger } from '../lib/logger';
import { getUserId, getTenantId } from '../utils/auth-helpers';
const log = createModuleLogger('service-manager-reports-api');

const router = Router();

// Apply RBAC middleware to all routes
router.use(enhanceUserContext);

// =====================================================================
// REPORT 33: REGIONAL SERVICE CALL OVERVIEW
// =====================================================================

/**
 * @route   GET /api/service-manager-reports/regional-service-calls
 * @desc    Get service call overview aggregated by region
 * @access  Requires: service.ticket.view_regional OR service.ticket.view_company
 */
router.get(
  '/regional-service-calls',
  requirePermission(['service.ticket.view_regional', 'service.ticket.view_company']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await ServiceManagerReportingService.getRegionalServiceCallOverview(
        req.user!,
        dateRange,
      );

      // Enrich response with insights
      const priorityBreakdown = data.aggregated.reduce(
        (acc, agg) => {
          acc[agg.priority.toLowerCase()] = {
            totalCalls: agg.totalCalls,
            avgCallsPerRegion: agg.avgCallsPerRegion,
            avgDuration: agg.avgDuration,
          };
          return acc;
        },
        {} as Record<string, any>,
      );

      res.json({
        ...data,
        insights: {
          priorityBreakdown,
          healthStatus:
            data.summary.avgFirstTimeFixRate >= 85
              ? 'healthy'
              : data.summary.avgFirstTimeFixRate >= 70
                ? 'fair'
                : 'needs_attention',
        },
      });
    } catch (error) {
      log.error('Error fetching regional service calls:', error);
      res.status(500).json({
        message: 'Failed to fetch regional service call overview',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 34: REGIONAL SERVICE PERFORMANCE METRICS
// =====================================================================

/**
 * @route   GET /api/service-manager-reports/regional-performance
 * @desc    Get service performance metrics by region
 * @access  Requires: service.performance.view_regional OR service.performance.view_company
 */
router.get(
  '/regional-performance',
  requirePermission(['service.performance.view_regional', 'service.performance.view_company']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await ServiceManagerReportingService.getRegionalServicePerformanceMetrics(
        req.user!,
        dateRange,
      );

      // Calculate performance distribution
      const ftfDistribution = {
        excellent: data.regions.filter((r) => r.firstTimeFixRate >= 85).length,
        good: data.regions.filter((r) => r.firstTimeFixRate >= 70 && r.firstTimeFixRate < 85)
          .length,
        fair: data.regions.filter((r) => r.firstTimeFixRate >= 60 && r.firstTimeFixRate < 70)
          .length,
        poor: data.regions.filter((r) => r.firstTimeFixRate < 60).length,
      };

      const slaDistribution = {
        excellent: data.regions.filter((r) => r.slaCompliance >= 95).length,
        good: data.regions.filter((r) => r.slaCompliance >= 85 && r.slaCompliance < 95).length,
        fair: data.regions.filter((r) => r.slaCompliance >= 75 && r.slaCompliance < 85).length,
        poor: data.regions.filter((r) => r.slaCompliance < 75).length,
      };

      res.json({
        ...data,
        insights: {
          ftfDistribution,
          slaDistribution,
          topPerformers: data.regions.slice(0, 3),
          needsAttention: data.regions.filter(
            (r) => r.firstTimeFixRate < 70 || r.slaCompliance < 85,
          ),
        },
      });
    } catch (error) {
      log.error('Error fetching regional service performance:', error);
      res.status(500).json({
        message: 'Failed to fetch regional service performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 35: REGIONAL SLA TRACKING
// =====================================================================

/**
 * @route   GET /api/service-manager-reports/regional-sla
 * @desc    Get SLA compliance tracking by region
 * @access  Requires: service.sla.view_regional OR service.sla.view_company
 */
router.get(
  '/regional-sla',
  requirePermission(['service.ticket.view_regional', 'service.ticket.view_company']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await ServiceManagerReportingService.getRegionalSLATracking(
        req.user!,
        dateRange,
      );

      // SLA distribution breakdown
      const slaDistribution = {
        onTrack: data.slas.filter((sla) => sla.slaCompliancePercent >= 90).length,
        nearTarget: data.slas.filter(
          (sla) => sla.slaCompliancePercent >= 75 && sla.slaCompliancePercent < 90,
        ).length,
        atRisk: data.slas.filter((sla) => sla.slaCompliancePercent < 75).length,
      };

      // Identify critical regions
      const criticalRegions = data.slas
        .filter((sla) => sla.overdueCalls > 10 || sla.slaCompliancePercent < 70)
        .map((sla) => ({
          regionId: sla.regionId,
          regionName: sla.regionName,
          compliance: sla.slaCompliancePercent,
          overdueCalls: sla.overdueCalls,
          locationCount: sla.locationCount,
        }));

      res.json({
        ...data,
        insights: {
          slaDistribution,
          criticalRegions,
          avgResponseTime: data.summary.avgResponseTime,
        },
      });
    } catch (error) {
      log.error('Error fetching regional SLA tracking:', error);
      res.status(500).json({
        message: 'Failed to fetch regional SLA tracking',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 36: REGIONAL TECHNICIAN ACTIVITY SUMMARY
// =====================================================================

/**
 * @route   GET /api/service-manager-reports/regional-activity
 * @desc    Get technician activity summary by region
 * @access  Requires: service.time.view_regional OR service.time.view_company
 */
router.get(
  '/regional-activity',
  requirePermission(['service.time.view_regional', 'service.time.view_company']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await ServiceManagerReportingService.getRegionalTechnicianActivitySummary(
        req.user!,
        dateRange,
      );

      // Activity breakdown aggregation
      const activityBreakdown = {
        travel: data.activities.reduce((sum, act) => sum + act.travelHours, 0),
        diagnostic: data.activities.reduce((sum, act) => sum + act.diagnosticHours, 0),
        repair: data.activities.reduce((sum, act) => sum + act.repairHours, 0),
        documentation: data.activities.reduce((sum, act) => sum + act.documentationHours, 0),
      };

      // Utilization distribution
      const utilizationDistribution = {
        high: data.activities.filter((act) => act.utilizationRate >= 80).length,
        medium: data.activities.filter(
          (act) => act.utilizationRate >= 60 && act.utilizationRate < 80,
        ).length,
        low: data.activities.filter((act) => act.utilizationRate < 60).length,
      };

      res.json({
        ...data,
        insights: {
          activityBreakdown,
          utilizationDistribution,
          productiveHours: activityBreakdown.diagnostic + activityBreakdown.repair,
          nonproductiveHours: activityBreakdown.travel + activityBreakdown.documentation,
          avgUtilizationRate: data.summary.averageUtilization,
        },
      });
    } catch (error) {
      log.error('Error fetching regional technician activity:', error);
      res.status(500).json({
        message: 'Failed to fetch regional technician activity summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

/**
 * @route   POST /api/service-manager-reports/clear-cache
 * @desc    Clear report cache (executives only)
 * @access  Requires: service.reports.manage
 */
router.post(
  '/clear-cache',
  requirePermission(['service.reports.manage']),
  async (req: Request, res: Response) => {
    try {
      ServiceManagerReportingService.clearCache();
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
