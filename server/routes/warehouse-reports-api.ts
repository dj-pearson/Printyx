// =====================================================================
// WAREHOUSE REPORTS API
// RESTful endpoints for warehouse team reports (FPY metrics)
// =====================================================================

import { Router, Response } from 'express';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('warehouse-reports-api');

import {
  enhanceUserContext,
  requirePermission,
  type AuthenticatedRequest,
} from '../middleware/enhanced-rbac-middleware';
import { WarehouseReportingService } from '../services/warehouse-reporting-service';

import { getUserId, getTenantId } from '../utils/auth-helpers';
const router = Router();

// Apply RBAC to all routes
router.use(enhanceUserContext);

// =====================================================================
// TEAM QUICK STATS (FOR EMBEDDED WIDGETS)
// =====================================================================

/**
 * GET /api/warehouse-reports/team/quick-stats
 * Get quick stats for warehouse team (for embedded widgets)
 * Lightweight endpoint optimized for in-module display
 *
 * Permission: operations.warehouse.view_team or higher
 */
router.get(
  '/warehouse-reports/team/quick-stats',
  requirePermission([
    'operations.warehouse.view_team',
    'operations.warehouse.view_location',
    'operations.warehouse.view_regional',
    'operations.warehouse.view_company',
    'operations.warehouse.view_platform',
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;

      const dateRange =
        dateFrom && dateTo
          ? {
              dateFrom: new Date(dateFrom as string),
              dateTo: new Date(dateTo as string),
            }
          : undefined;

      const stats = await WarehouseReportingService.getTeamQuickStats(req.user!, dateRange);

      res.json(stats);
    } catch (error) {
      log.error('Error fetching warehouse team quick stats:', error);
      res.status(500).json({
        message: 'Failed to fetch warehouse team stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// =====================================================================
// CACHE MANAGEMENT (TEAM LEADS AND SUPERVISORS)
// =====================================================================

/**
 * POST /api/warehouse-reports/cache/invalidate
 * Invalidate report cache (for managers)
 */
router.post(
  '/warehouse-reports/cache/invalidate',
  requirePermission(['operations.reports.manage_team', 'operations.reports.manage_location']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { pattern } = req.body;

      WarehouseReportingService.clearCache(pattern);

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
// EXPORT
// =====================================================================

export default router;
