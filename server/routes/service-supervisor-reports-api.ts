// =====================================================================
// SERVICE SUPERVISOR REPORTS API
// RESTful endpoints for service supervisor reports (Level 3 - Reports 29-32)
// =====================================================================

import { Router, type Request, type Response } from 'express';
import { ServiceSupervisorReportingService } from '../services/service-supervisor-reporting-service';
import {
  enhanceUserContext,
  requirePermission,
} from '../middleware/enhanced-rbac-middleware';

const router = Router();

// Apply RBAC middleware to all routes
router.use(enhanceUserContext);

// =====================================================================
// REPORT 29: LOCATION SERVICE CALL OVERVIEW
// =====================================================================

/**
 * @route   GET /api/service-supervisor-reports/location-service-calls
 * @desc    Get service call overview aggregated by location
 * @access  Requires: service.ticket.view_location OR service.ticket.view_regional
 */
router.get(
  '/location-service-calls',
  requirePermission(['service.ticket.view_location', 'service.ticket.view_regional']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await ServiceSupervisorReportingService.getLocationServiceCallOverview(
        req.user!,
        dateRange
      );

      // Enrich response with insights
      const priorityBreakdown = data.aggregated.reduce((acc, agg) => {
        acc[agg.priority.toLowerCase()] = {
          totalCalls: agg.totalCalls,
          avgCallsPerLocation: agg.avgCallsPerLocation,
          avgDuration: agg.avgDuration,
        };
        return acc;
      }, {} as Record<string, any>);

      res.json({
        ...data,
        insights: {
          priorityBreakdown,
          healthStatus: data.summary.avgFirstTimeFixRate >= 85 ? 'healthy' :
                       data.summary.avgFirstTimeFixRate >= 70 ? 'fair' : 'needs_attention',
        },
      });
    } catch (error) {
      console.error('Error fetching location service calls:', error);
      res.status(500).json({
        message: 'Failed to fetch location service call overview',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// =====================================================================
// REPORT 30: LOCATION SERVICE PERFORMANCE METRICS
// =====================================================================

/**
 * @route   GET /api/service-supervisor-reports/location-performance
 * @desc    Get service performance metrics by location
 * @access  Requires: service.performance.view_location OR service.performance.view_regional
 */
router.get(
  '/location-performance',
  requirePermission(['service.performance.view_location', 'service.performance.view_regional']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await ServiceSupervisorReportingService.getLocationServicePerformanceMetrics(
        req.user!,
        dateRange
      );

      // Calculate performance spread
      const ftfRates = data.locations.map(loc => loc.firstTimeFixRate);
      const slaRates = data.locations.map(loc => loc.slaCompliance);

      const performanceSpread = {
        ftfRate: {
          min: Math.min(...ftfRates, 0),
          max: Math.max(...ftfRates, 0),
          range: Math.max(...ftfRates, 0) - Math.min(...ftfRates, 0),
        },
        slaCompliance: {
          min: Math.min(...slaRates, 0),
          max: Math.max(...slaRates, 0),
          range: Math.max(...slaRates, 0) - Math.min(...slaRates, 0),
        },
      };

      res.json({
        ...data,
        insights: {
          performanceSpread,
          topPerformers: data.locations.slice(0, 3),
          needsAttention: data.locations.filter(loc => loc.firstTimeFixRate < 75 || loc.slaCompliance < 85),
        },
      });
    } catch (error) {
      console.error('Error fetching location service performance:', error);
      res.status(500).json({
        message: 'Failed to fetch location service performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// =====================================================================
// REPORT 31: LOCATION SLA TRACKING
// =====================================================================

/**
 * @route   GET /api/service-supervisor-reports/location-sla
 * @desc    Get SLA compliance tracking by location
 * @access  Requires: service.sla.view_location OR service.sla.view_regional
 */
router.get(
  '/location-sla',
  requirePermission(['service.ticket.view_location', 'service.ticket.view_regional']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await ServiceSupervisorReportingService.getLocationSLATracking(
        req.user!,
        dateRange
      );

      // SLA distribution breakdown
      const slaDistribution = {
        onTrack: data.slas.filter(sla => sla.slaCompliancePercent >= 90).length,
        nearTarget: data.slas.filter(sla => sla.slaCompliancePercent >= 75 && sla.slaCompliancePercent < 90).length,
        atRisk: data.slas.filter(sla => sla.slaCompliancePercent < 75).length,
      };

      // Identify critical locations
      const criticalLocations = data.slas
        .filter(sla => sla.overdueCalls > 5 || sla.slaCompliancePercent < 70)
        .map(sla => ({
          locationId: sla.locationId,
          locationName: sla.locationName,
          compliance: sla.slaCompliancePercent,
          overdueCalls: sla.overdueCalls,
        }));

      res.json({
        ...data,
        insights: {
          slaDistribution,
          criticalLocations,
          avgResponseTime: data.summary.avgResponseTime,
        },
      });
    } catch (error) {
      console.error('Error fetching location SLA tracking:', error);
      res.status(500).json({
        message: 'Failed to fetch location SLA tracking',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// =====================================================================
// REPORT 32: LOCATION TECHNICIAN ACTIVITY SUMMARY
// =====================================================================

/**
 * @route   GET /api/service-supervisor-reports/location-activity
 * @desc    Get technician activity summary by location
 * @access  Requires: service.time.view_location OR service.time.view_regional
 */
router.get(
  '/location-activity',
  requirePermission(['service.time.view_location', 'service.time.view_regional']),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await ServiceSupervisorReportingService.getLocationTechnicianActivitySummary(
        req.user!,
        dateRange
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
        high: data.activities.filter(act => act.utilizationRate >= 80).length,
        medium: data.activities.filter(act => act.utilizationRate >= 60 && act.utilizationRate < 80).length,
        low: data.activities.filter(act => act.utilizationRate < 60).length,
      };

      res.json({
        ...data,
        insights: {
          activityBreakdown,
          utilizationDistribution,
          productiveHours: activityBreakdown.diagnostic + activityBreakdown.repair,
          nonproductiveHours: activityBreakdown.travel + activityBreakdown.documentation,
        },
      });
    } catch (error) {
      console.error('Error fetching location technician activity:', error);
      res.status(500).json({
        message: 'Failed to fetch location technician activity summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

/**
 * @route   POST /api/service-supervisor-reports/clear-cache
 * @desc    Clear report cache (managers only)
 * @access  Requires: service.reports.manage
 */
router.post(
  '/clear-cache',
  requirePermission(['service.reports.manage']),
  async (req: Request, res: Response) => {
    try {
      ServiceSupervisorReportingService.clearCache();
      res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        message: 'Failed to clear cache',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
