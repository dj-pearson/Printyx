// =====================================================================
// SALES REPORTS API
// API endpoints for sales reporting (Levels 1-4)
// =====================================================================

import { Router, Response } from 'express';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('sales-reports-api');

import {
  enhanceUserContext,
  requirePermission,
  type AuthenticatedRequest,
} from '../middleware/enhanced-rbac-middleware';
import { SalesReportingService } from '../services/sales-reporting-service';

import { getUserId, getTenantId } from '../utils/auth-helpers';
const router = Router();

// Apply user context to all routes
router.use(enhanceUserContext);

// =====================================================================
// LEVEL 1: INDIVIDUAL CONTRIBUTOR REPORTS
// =====================================================================

/**
 * GET /api/sales-reports/personal/pipeline
 * Personal Pipeline Report - Shows rep's deals by stage
 */
router.get(
  '/personal/pipeline',
  requirePermission('sales.opportunity.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { dateFrom, dateTo } = req.query;

      const pipeline = await SalesReportingService.getPersonalPipeline(req.user, {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      });

      res.json({
        pipeline,
        totalDeals: pipeline.reduce((sum, stage) => sum + stage.count, 0),
        totalValue: pipeline.reduce((sum, stage) => sum + stage.totalValue, 0),
        weightedValue: pipeline.reduce((sum, stage) => sum + stage.weightedValue, 0),
      });
    } catch (error: any) {
      log.error('Error fetching personal pipeline:', error);
      res.status(500).json({ error: 'Failed to fetch pipeline data', });
    }
  },
);

/**
 * GET /api/sales-reports/personal/activity
 * Personal Activity Report - Shows daily/weekly activities
 */
router.get(
  '/personal/activity',
  requirePermission('sales.activity.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { dateFrom, dateTo, granularity = 'day' } = req.query;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'dateFrom and dateTo are required' });
      }

      const activities = await SalesReportingService.getPersonalActivity(
        req.user,
        {
          dateFrom: new Date(dateFrom as string),
          dateTo: new Date(dateTo as string),
        },
        granularity as 'day' | 'week',
      );

      const totals = activities.reduce(
        (acc, day) => ({
          calls: acc.calls + day.calls,
          emails: acc.emails + day.emails,
          meetings: acc.meetings + day.meetings,
          demos: acc.demos + day.demos,
          proposals: acc.proposals + day.proposals,
        }),
        { calls: 0, emails: 0, meetings: 0, demos: 0, proposals: 0 },
      );

      res.json({
        activities,
        totals,
        averagePerDay: {
          calls: totals.calls / activities.length,
          emails: totals.emails / activities.length,
          meetings: totals.meetings / activities.length,
          demos: totals.demos / activities.length,
          proposals: totals.proposals / activities.length,
        },
      });
    } catch (error: any) {
      log.error('Error fetching personal activity:', error);
      res.status(500).json({ error: 'Failed to fetch activity data', });
    }
  },
);

/**
 * GET /api/sales-reports/personal/quota
 * Personal Quota Attainment - Shows quota vs actual
 */
router.get(
  '/personal/quota',
  requirePermission('sales.quota.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { period = 'current' } = req.query;

      const quota = await SalesReportingService.getPersonalQuotaAttainment(
        req.user,
        period as 'current' | 'previous' | 'ytd',
      );

      res.json({
        quota,
        performance: {
          onTrack: quota.attainmentPercent >= 100,
          gap: quota.quotaAmount - quota.actualRevenue,
          gapPercent: 100 - quota.attainmentPercent,
          dealsNeeded: Math.ceil(
            (quota.quotaAmount - quota.actualRevenue) / (quota.averageDealSize || 1),
          ),
        },
      });
    } catch (error: any) {
      log.error('Error fetching quota attainment:', error);
      res.status(500).json({ error: 'Failed to fetch quota data', });
    }
  },
);

/**
 * GET /api/sales-reports/personal/commissions
 * Personal Commission Report - Shows commission earnings
 */
router.get(
  '/personal/commissions',
  requirePermission('sales.commission.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { dateFrom, dateTo, status } = req.query;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'dateFrom and dateTo are required' });
      }

      const commissions = await SalesReportingService.getPersonalCommissions(
        req.user,
        {
          dateFrom: new Date(dateFrom as string),
          dateTo: new Date(dateTo as string),
        },
        status as 'pending' | 'approved' | 'paid' | undefined,
      );

      const summary = {
        totalCommission: commissions.reduce((sum, c) => sum + c.commissionAmount, 0),
        pending: commissions
          .filter((c) => c.status === 'pending')
          .reduce((sum, c) => sum + c.commissionAmount, 0),
        approved: commissions
          .filter((c) => c.status === 'approved')
          .reduce((sum, c) => sum + c.commissionAmount, 0),
        paid: commissions
          .filter((c) => c.status === 'paid')
          .reduce((sum, c) => sum + c.commissionAmount, 0),
        count: commissions.length,
      };

      res.json({
        commissions,
        summary,
      });
    } catch (error: any) {
      log.error('Error fetching commissions:', error);
      res.status(500).json({ error: 'Failed to fetch commission data', });
    }
  },
);

/**
 * GET /api/sales-reports/personal/leaderboard
 * Personal Leaderboard Position - Shows rank vs peers
 */
router.get(
  '/personal/leaderboard',
  requirePermission('sales.performance.view_own'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { metric = 'revenue', scope = 'location' } = req.query;

      const leaderboard = await SalesReportingService.getLeaderboard(
        req.user,
        metric as 'revenue' | 'deals' | 'pipeline' | 'activities',
        scope as 'team' | 'location' | 'company',
      );

      const myPosition = leaderboard.find((entry) => entry.userId === req.user!.id);

      res.json({
        leaderboard,
        myPosition,
        totalParticipants: leaderboard.length,
        percentile: myPosition
          ? Math.round(((leaderboard.length - myPosition.rank + 1) / leaderboard.length) * 100)
          : 0,
      });
    } catch (error: any) {
      log.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard data', });
    }
  },
);

// =====================================================================
// LEVEL 2-3: TEAM LEAD & SUPERVISOR REPORTS
// =====================================================================

/**
 * GET /api/sales-reports/team/comparison
 * Team Comparison Report - Shows team member performance
 */
router.get(
  '/team/comparison',
  requirePermission(['sales.performance.view_team', 'sales.performance.view_location']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const comparison = await SalesReportingService.getTeamComparison(req.user);

      const summary = {
        teamSize: comparison.length,
        totalPipeline: comparison.reduce((sum, m) => sum + m.pipelineValue, 0),
        averageWinRate: comparison.reduce((sum, m) => sum + m.winRate, 0) / comparison.length,
        averageQuotaAttainment:
          comparison.reduce((sum, m) => sum + m.quotaAttainment, 0) / comparison.length,
        topPerformer: comparison.length > 0 ? comparison[0] : null,
      };

      res.json({
        comparison,
        summary,
      });
    } catch (error: any) {
      log.error('Error fetching team comparison:', error);
      res.status(500).json({ error: 'Failed to fetch team data', });
    }
  },
);

/**
 * GET /api/sales-reports/team/pipeline
 * Team Pipeline Comparison - Shows pipeline by team member
 */
router.get(
  '/team/pipeline',
  requirePermission(['sales.opportunity.view_team', 'sales.opportunity.view_location']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const comparison = await SalesReportingService.getTeamComparison(req.user);

      const pipelineData = comparison.map((member) => ({
        userName: member.userName,
        userId: member.userId,
        pipelineValue: member.pipelineValue,
        dealsInProgress: member.dealsInProgress,
        averageDealSize: member.averageDealSize,
      }));

      res.json({
        pipelineData,
        totalPipeline: comparison.reduce((sum, m) => sum + m.pipelineValue, 0),
        totalDeals: comparison.reduce((sum, m) => sum + m.dealsInProgress, 0),
      });
    } catch (error: any) {
      log.error('Error fetching team pipeline:', error);
      res.status(500).json({ error: 'Failed to fetch team pipeline data', });
    }
  },
);

/**
 * GET /api/sales-reports/team/pipeline-summary
 * Get team pipeline summary (Report 7 - for Team Leads)
 *
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 */
router.get(
  '/team/pipeline-summary',
  requirePermission(['sales.pipeline.view_team', 'sales.pipeline.view_location']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { dateFrom, dateTo } = req.query;

      const dateRange =
        dateFrom && dateTo
          ? {
              dateFrom: new Date(dateFrom as string),
              dateTo: new Date(dateTo as string),
            }
          : undefined;

      const result = await SalesReportingService.getTeamPipelineSummary(req.user, dateRange);

      // Enrich with additional metrics
      const metrics = {
        teamSize: result.individualPipelines.length,
        averageValuePerRep:
          result.individualPipelines.length > 0
            ? result.summary.totalTeamValue / result.individualPipelines.length
            : 0,
        averageDealsPerRep:
          result.individualPipelines.length > 0
            ? result.summary.totalTeamDeals / result.individualPipelines.length
            : 0,
        pipelineHealth:
          result.summary.teamConversionRate >= 20
            ? 'healthy'
            : result.summary.teamConversionRate >= 10
              ? 'fair'
              : 'needs_attention',
      };

      res.json({
        ...result,
        metrics,
      });
    } catch (error: any) {
      log.error('Error fetching team pipeline summary:', error);
      res
        .status(500)
        .json({ error: 'Failed to fetch team pipeline summary', });
    }
  },
);

/**
 * POST /api/sales-reports/cache/invalidate
 * Invalidate report caches (for managers)
 */
router.post(
  '/cache/invalidate',
  requirePermission('sales.reports.manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { userId } = req.body;

      if (userId) {
        SalesReportingService.invalidateUserCache(userId);
      } else {
        SalesReportingService.clearAllCaches();
      }

      res.json({ message: 'Cache invalidated successfully' });
    } catch (error: any) {
      log.error('Error invalidating cache:', error);
      res.status(500).json({ error: 'Failed to invalidate cache', });
    }
  },
);

// =====================================================================
// EXPORT
// =====================================================================

export default router;
