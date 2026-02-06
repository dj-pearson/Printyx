// =====================================================================
// SERVICE REPORTS API
// RESTful endpoints for technician and service reports (Reports 25-28)
// =====================================================================

import { Router, Response } from 'express';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('service-reports-api');

import {
  enhanceUserContext,
  requirePermission,
  type AuthenticatedRequest,
} from '../middleware/enhanced-rbac-middleware';
import { ServiceReportingService } from '../services/service-reporting-service';
import { ServiceSupervisorReportingService } from '../services/service-supervisor-reporting-service';

const router = Router();

// Apply RBAC to all routes
router.use(enhanceUserContext);

// =====================================================================
// REPORT 25: PERSONAL SERVICE CALLS
// =====================================================================

/**
 * GET /api/service-reports/personal/calls
 * Get personal service calls for a technician
 *
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 * - status: filter by status (open, scheduled, in_progress, completed, cancelled)
 */
router.get(
  '/service-reports/personal/calls',
  requirePermission('service.ticket.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dateFrom, dateTo, status } = req.query;

      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const result = await ServiceReportingService.getPersonalServiceCalls(
        req.user!,
        dateRange,
        status as string | undefined,
      );

      // Enrich response with performance indicators
      const performance = {
        productivity: result.summary.completed / (result.summary.totalCalls || 1),
        quality: result.summary.firstTimeFixRate,
        satisfaction: result.summary.averageSatisfaction,
        efficiency: result.summary.averageDuration,
      };

      res.json({
        ...result,
        performance,
      });
    } catch (error) {
      log.error('Error fetching personal service calls:', error);
      res.status(500).json({ message: 'Failed to fetch service calls' });
    }
  },
);

// =====================================================================
// REPORT 26: PERSONAL PARTS USAGE
// =====================================================================

/**
 * GET /api/service-reports/personal/parts
 * Get personal parts usage for a technician
 *
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 */
router.get(
  '/service-reports/personal/parts',
  requirePermission('service.parts.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;

      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const result = await ServiceReportingService.getPersonalPartsUsage(req.user!, dateRange);

      // Calculate additional metrics
      const metrics = {
        costPerCall:
          result.summary.totalParts > 0 ? result.summary.totalCost / result.parts.length : 0,
        billablePercentage:
          result.summary.totalCost > 0
            ? (result.summary.billableCost / result.summary.totalCost) * 100
            : 0,
        averagePartCost:
          result.summary.totalParts > 0 ? result.summary.totalCost / result.summary.totalParts : 0,
      };

      res.json({
        ...result,
        metrics,
      });
    } catch (error) {
      log.error('Error fetching personal parts usage:', error);
      res.status(500).json({ message: 'Failed to fetch parts usage' });
    }
  },
);

// =====================================================================
// REPORT 27: PERSONAL TIME TRACKING
// =====================================================================

/**
 * GET /api/service-reports/personal/time
 * Get personal time tracking for a technician
 *
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 */
router.get(
  '/service-reports/personal/time',
  requirePermission('service.time.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;

      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const result = await ServiceReportingService.getPersonalTimeTracking(req.user!, dateRange);

      // Calculate additional metrics
      const metrics = {
        productivityRate:
          result.summary.totalHours > 0
            ? (result.summary.productiveHours / result.summary.totalHours) * 100
            : 0,
        travelPercentage:
          result.summary.totalHours > 0
            ? (result.summary.travelHours / result.summary.totalHours) * 100
            : 0,
        averageHoursPerDay:
          result.summary.hoursByDay.length > 0
            ? result.summary.totalHours / result.summary.hoursByDay.length
            : 0,
        billableRate: result.summary.utilizationRate,
      };

      res.json({
        ...result,
        metrics,
      });
    } catch (error) {
      log.error('Error fetching personal time tracking:', error);
      res.status(500).json({ message: 'Failed to fetch time tracking' });
    }
  },
);

// =====================================================================
// REPORT 28: TEAM DISPATCH QUEUE (TEAM LEADS)
// =====================================================================

/**
 * GET /api/service-reports/team/dispatch-queue
 * Get team dispatch queue (for Team Leads and Supervisors)
 *
 * Query params:
 * - priority: filter by priority (critical, high, medium, low)
 * - status: filter by status (open, scheduled, in_progress)
 * - assignedTo: filter by assigned technician ID
 */
router.get(
  '/service-reports/team/dispatch-queue',
  requirePermission(['service.ticket.view_team', 'service.ticket.view_location']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { priority, status, assignedTo } = req.query;

      const filterBy = {
        priority: priority as string | undefined,
        status: status as string | undefined,
        assignedTo: assignedTo as string | undefined,
      };

      const result = await ServiceReportingService.getTeamDispatchQueue(req.user!, filterBy);

      // Calculate workload distribution
      const workloadMetrics = {
        averageTicketsPerTech:
          Object.keys(result.summary.byTechnician).length > 0
            ? result.summary.totalTickets / Object.keys(result.summary.byTechnician).length
            : 0,
        unassignedPercentage:
          result.summary.totalTickets > 0
            ? (result.summary.unassigned / result.summary.totalTickets) * 100
            : 0,
        overduePercentage:
          result.summary.totalTickets > 0
            ? (result.summary.overdue / result.summary.totalTickets) * 100
            : 0,
        atRiskPercentage:
          result.summary.totalTickets > 0
            ? (result.summary.atRisk / result.summary.totalTickets) * 100
            : 0,
        scheduledPercentage:
          result.summary.totalTickets > 0
            ? (result.summary.scheduled / result.summary.totalTickets) * 100
            : 0,
      };

      res.json({
        ...result,
        workloadMetrics,
      });
    } catch (error) {
      log.error('Error fetching team dispatch queue:', error);
      res.status(500).json({ message: 'Failed to fetch dispatch queue' });
    }
  },
);

// =====================================================================
// REPORT: SERVICE CALL DETAILS
// =====================================================================

/**
 * GET /api/service-reports/personal/calls/:ticketId
 * Get detailed information for a specific service call
 */
router.get(
  '/service-reports/personal/calls/:ticketId',
  requirePermission('service.ticket.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId } = req.params;

      // This would fetch detailed ticket information including:
      // - Complete ticket history
      // - Parts used
      // - Time entries
      // - Notes and documentation
      // - Customer feedback

      // For now, return placeholder
      res.json({
        message: 'Detailed service call view - to be implemented',
        ticketId,
      });
    } catch (error) {
      log.error('Error fetching service call details:', error);
      res.status(500).json({ message: 'Failed to fetch service call details' });
    }
  },
);

// =====================================================================
// CACHE MANAGEMENT (TEAM LEADS AND SUPERVISORS)
// =====================================================================

/**
 * POST /api/service-reports/cache/invalidate
 * Invalidate report cache (for managers)
 */
router.post(
  '/service-reports/cache/invalidate',
  requirePermission(['service.reports.manage_team', 'service.reports.manage_location']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { pattern } = req.body;

      ServiceReportingService.clearCache(pattern);

      res.json({
        message: 'Cache invalidated successfully',
        pattern: pattern || 'all',
      });
    } catch (error) {
      log.error('Error invalidating cache:', error);
      res.status(500).json({ message: 'Failed to invalidate cache' });
    }
  },
);

// =====================================================================
// TEAM QUICK STATS (FOR EMBEDDED WIDGETS)
// =====================================================================

/**
 * GET /api/service-reports/team/quick-stats
 * Get quick stats for service team (for embedded widgets)
 * Lightweight endpoint optimized for in-module display
 *
 * Permission: service.performance.view_team or higher
 */
router.get(
  '/service-reports/team/quick-stats',
  requirePermission([
    'service.performance.view_team',
    'service.performance.view_location',
    'service.performance.view_regional',
    'service.performance.view_company',
    'service.performance.view_platform',
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await ServiceSupervisorReportingService.getTeamQuickStats(req.user!);

      res.json(stats);
    } catch (error) {
      log.error('Error fetching service team quick stats:', error);
      res.status(500).json({
        message: 'Failed to fetch service team stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// EXPORT
// =====================================================================

export default router;
