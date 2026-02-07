// =====================================================================
// TEAM REPORTS API
// RESTful endpoints for team-level reports (Level 2-3: Team Lead, Supervisor)
// Implements Reports 6-10 from RBAC_REPORTING_REQUIREMENTS.md
// =====================================================================

import { Router, type Request, type Response } from 'express';
import { TeamReportingService } from '../services/team-reporting-service';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('team-reports-api');

import {
  enhanceUserContext,
  requirePermission,
  requireAnyPermission,
  requireLevel,
  type AuthenticatedRequest,
} from '../middleware/enhanced-rbac-middleware';

const router = Router();

// Apply RBAC middleware to all routes
router.use(enhanceUserContext);

// =====================================================================
// REPORT 6: TEAM PIPELINE COMPARISON
// =====================================================================

/**
 * @route   GET /api/team-reports/pipeline-comparison
 * @desc    Get pipeline comparison for team members
 * @access  Level 2+ (Team Lead, Senior Sales Rep)
 *          Requires: sales.pipeline.view_team
 */
router.get(
  '/pipeline-comparison',
  requireAnyPermission([
    'sales.pipeline.view_team',
    'sales.pipeline.view_location',
    'sales.pipeline.view_regional',
    'sales.pipeline.view_company',
  ]),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await TeamReportingService.getTeamPipelineComparison(req.user!, dateRange);

      // Add insights
      const pipelineCoverageStatus =
        data.summary.teamPipelineCoverage >= 300
          ? 'excellent'
          : data.summary.teamPipelineCoverage >= 200
            ? 'good'
            : data.summary.teamPipelineCoverage >= 100
              ? 'fair'
              : 'needs_attention';

      res.json({
        ...data,
        insights: {
          pipelineCoverageStatus,
          topPerformers: data.teamMembers.slice(0, 3),
          lowCoverage: data.teamMembers.filter((m) => m.pipelineCoverage < 100),
          averageCoverage: data.summary.teamPipelineCoverage,
        },
      });
    } catch (error) {
      log.error('Error fetching team pipeline comparison:', error);
      res.status(500).json({
        message: 'Failed to fetch team pipeline comparison',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 7: TEAM ACTIVITY LEADERBOARD
// =====================================================================

/**
 * @route   GET /api/team-reports/activity-leaderboard
 * @desc    Get activity leaderboard for team members
 * @access  Level 2+ (Team Lead, Senior Sales Rep)
 *          Requires: sales.activity.view_team
 */
router.get(
  '/activity-leaderboard',
  requireAnyPermission([
    'sales.activity.view_team',
    'sales.activity.view_location',
    'sales.activity.view_regional',
    'sales.activity.view_company',
  ]),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await TeamReportingService.getTeamActivityLeaderboard(req.user!, dateRange);

      // Calculate activity type breakdown
      const activityTypeBreakdown = {
        calls: data.activities.reduce((sum, a) => sum + a.calls, 0),
        emails: data.activities.reduce((sum, a) => sum + a.emails, 0),
        meetings: data.activities.reduce((sum, a) => sum + a.meetings, 0),
        demos: data.activities.reduce((sum, a) => sum + a.demos, 0),
        proposals: data.activities.reduce((sum, a) => sum + a.proposals, 0),
      };

      const completionRateAvg =
        data.activities.length > 0
          ? data.activities.reduce((sum, a) => sum + a.completionRate, 0) / data.activities.length
          : 0;

      res.json({
        ...data,
        insights: {
          activityTypeBreakdown,
          averageCompletionRate: completionRateAvg,
          coachingNeeded: data.summary.lowPerformers.length,
          topPerformer: data.summary.topPerformer,
        },
      });
    } catch (error) {
      log.error('Error fetching team activity leaderboard:', error);
      res.status(500).json({
        message: 'Failed to fetch team activity leaderboard',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 8: TEAM PERFORMANCE DASHBOARD
// =====================================================================

/**
 * @route   GET /api/team-reports/performance-dashboard
 * @desc    Get comprehensive team performance metrics
 * @access  Level 3+ (Sales Supervisor)
 *          Requires: sales.performance.view_team OR sales.performance.view_location
 */
router.get(
  '/performance-dashboard',
  requireAnyPermission([
    'sales.performance.view_team',
    'sales.performance.view_location',
    'sales.performance.view_regional',
    'sales.performance.view_company',
  ]),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await TeamReportingService.getTeamPerformanceDashboard(req.user!, dateRange);

      // Calculate performance indicators
      const quotaAttainmentStatus =
        data.teamQuota.attainment >= 100
          ? 'exceeding'
          : data.teamQuota.attainment >= 90
            ? 'on_track'
            : data.teamQuota.attainment >= 75
              ? 'fair'
              : 'at_risk';

      const winRateStatus =
        data.metrics.teamWinRate >= 40
          ? 'excellent'
          : data.metrics.teamWinRate >= 25
            ? 'good'
            : 'needs_improvement';

      const repsOnTrack = data.individualQuotas.filter((q) => q.onTrack).length;
      const repsAtRisk = data.individualQuotas.filter((q) => !q.onTrack).length;

      res.json({
        ...data,
        insights: {
          quotaAttainmentStatus,
          winRateStatus,
          repsOnTrack,
          repsAtRisk,
          topPerformers: data.individualQuotas
            .sort((a, b) => b.attainment - a.attainment)
            .slice(0, 3),
          needsAttention: data.individualQuotas
            .filter((q) => q.attainment < 75)
            .sort((a, b) => a.attainment - b.attainment),
        },
      });
    } catch (error) {
      log.error('Error fetching team performance dashboard:', error);
      res.status(500).json({
        message: 'Failed to fetch team performance dashboard',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 9: LEAD MANAGEMENT REPORT
// =====================================================================

/**
 * @route   GET /api/team-reports/lead-management
 * @desc    Get lead management metrics and funnel
 * @access  Level 3+ (Sales Supervisor)
 *          Requires: sales.lead.view_team OR sales.lead.view_location
 */
router.get(
  '/lead-management',
  requireAnyPermission([
    'sales.lead.view_team',
    'sales.lead.view_location',
    'sales.lead.view_regional',
    'sales.lead.view_company',
  ]),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await TeamReportingService.getLeadManagementReport(req.user!, dateRange);

      // Calculate lead health indicators
      const conversionHealth =
        data.conversionMetrics.overallConversionRate >= 20
          ? 'healthy'
          : data.conversionMetrics.overallConversionRate >= 10
            ? 'fair'
            : 'poor';

      const responseTimeHealth =
        data.conversionMetrics.averageLeadResponseTime <= 2
          ? 'excellent'
          : data.conversionMetrics.averageLeadResponseTime <= 24
            ? 'good'
            : 'needs_improvement';

      const urgentActions = {
        unassignedLeads: data.conversionMetrics.leadsUnassigned,
        overdueFollowups: data.conversionMetrics.leadsOverdueForFollowup,
        total:
          data.conversionMetrics.leadsUnassigned + data.conversionMetrics.leadsOverdueForFollowup,
      };

      res.json({
        ...data,
        insights: {
          conversionHealth,
          responseTimeHealth,
          urgentActions,
          topSources: data.leadsBySource.slice(0, 5),
          worstConvertingSources: data.leadsBySource
            .filter((s) => s.count >= 5)
            .sort((a, b) => a.conversionRate - b.conversionRate)
            .slice(0, 3),
        },
      });
    } catch (error) {
      log.error('Error fetching lead management report:', error);
      res.status(500).json({
        message: 'Failed to fetch lead management report',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// REPORT 10: COACHING REPORT
// =====================================================================

/**
 * @route   GET /api/team-reports/coaching
 * @desc    Get coaching opportunities and performance issues
 * @access  Level 3+ (Sales Supervisor)
 *          Requires: sales.coaching.view_team OR sales.performance.view_team
 */
router.get(
  '/coaching',
  requireAnyPermission([
    'sales.coaching.view_team',
    'sales.performance.view_team',
    'sales.performance.view_location',
    'sales.performance.view_regional',
    'sales.performance.view_company',
  ]),
  async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      };

      const data = await TeamReportingService.getCoachingReport(req.user!, dateRange);

      // Prioritize coaching opportunities
      const prioritizedOpportunities = data.opportunities
        .map((opp) => {
          const flagCount = [
            opp.flags.lowActivity,
            opp.flags.lowConversion,
            opp.flags.dealsStuck,
          ].filter(Boolean).length;

          return {
            ...opp,
            priority: flagCount >= 2 ? 'critical' : flagCount === 1 ? 'high' : 'medium',
          };
        })
        .sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, medium: 2 };
          return (
            priorityOrder[a.priority as keyof typeof priorityOrder] -
            priorityOrder[b.priority as keyof typeof priorityOrder]
          );
        });

      const criticalReps = prioritizedOpportunities.filter((o) => o.priority === 'critical');
      const highPriorityReps = prioritizedOpportunities.filter((o) => o.priority === 'high');

      res.json({
        ...data,
        opportunities: prioritizedOpportunities,
        insights: {
          criticalReps: criticalReps.length,
          highPriorityReps: highPriorityReps.length,
          mostCommonIssue:
            data.summary.improvementAreas.length > 0
              ? data.summary.improvementAreas.sort((a, b) => b.affectedReps - a.affectedReps)[0]
              : null,
          coachingPriority: criticalReps.slice(0, 5),
        },
      });
    } catch (error) {
      log.error('Error fetching coaching report:', error);
      res.status(500).json({
        message: 'Failed to fetch coaching report',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// QUICK STATS (FOR IN-MODULE WIDGETS)
// =====================================================================

/**
 * @route   GET /api/team-reports/quick-stats
 * @desc    Get quick team stats for in-module widgets
 * @access  Level 2+ (Team Lead)
 *          Requires: sales.performance.view_team
 */
router.get(
  '/quick-stats',
  requireAnyPermission([
    'sales.performance.view_team',
    'sales.performance.view_location',
    'sales.performance.view_regional',
    'sales.performance.view_company',
  ]),
  async (req: Request, res: Response) => {
    try {
      // Fetch all quick stats in parallel
      const [pipelineData, performanceData, activityData] = await Promise.all([
        TeamReportingService.getTeamPipelineComparison(req.user!),
        TeamReportingService.getTeamPerformanceDashboard(req.user!),
        TeamReportingService.getTeamActivityLeaderboard(req.user!),
      ]);

      res.json({
        pipeline: {
          totalValue: pipelineData.summary.totalPipeline,
          totalDeals: pipelineData.summary.totalDeals,
          coverage: pipelineData.summary.teamPipelineCoverage,
          topRep: pipelineData.summary.topPerformer?.userName || 'N/A',
        },
        performance: {
          quotaAttainment: performanceData.teamQuota.attainment,
          revenue: performanceData.teamRevenue.mtd,
          winRate: performanceData.metrics.teamWinRate,
          repsOnTrack: performanceData.individualQuotas.filter((q) => q.onTrack).length,
          totalReps: performanceData.individualQuotas.length,
        },
        activity: {
          totalActivities: activityData.summary.totalActivities,
          averagePerRep: activityData.summary.averagePerRep,
          topRep: activityData.summary.topPerformer?.userName || 'N/A',
          lowPerformers: activityData.summary.lowPerformers.length,
        },
        teamSize: pipelineData.teamInfo.teamSize,
      });
    } catch (error) {
      log.error('Error fetching quick stats:', error);
      res.status(500).json({
        message: 'Failed to fetch quick stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

/**
 * @route   POST /api/team-reports/clear-cache
 * @desc    Clear report cache (managers and above)
 * @access  Level 4+ (Manager)
 *          Requires: sales.reports.manage
 */
router.post(
  '/clear-cache',
  requireLevel(4),
  requirePermission(['sales.reports.manage']),
  async (req: Request, res: Response) => {
    try {
      const { pattern } = req.body;
      TeamReportingService.clearCache(pattern);

      res.json({
        message: pattern
          ? `Cache cleared for pattern: ${pattern}`
          : 'All team report caches cleared',
      });
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
