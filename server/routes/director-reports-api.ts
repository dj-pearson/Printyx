// =====================================================================
// DIRECTOR REPORTS API
// RESTful endpoints for director-level reports (Level 5 & 6)
// =====================================================================

import { Router, type Request, type Response } from 'express';
import { DirectorReportingService } from '../services/director-reporting-service';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('director-reports-api');

import {
  enhanceUserContext,
  requirePermission,
  requireLevel,
} from '../middleware/enhanced-rbac-middleware';

const router = Router();

// Apply RBAC middleware to all routes
router.use(enhanceUserContext);

// =====================================================================
// COMPANY-WIDE SALES PERFORMANCE (LEVEL 5 & 6)
// =====================================================================

/**
 * @route   GET /api/director-reports/sales/company-performance
 * @desc    Get company-wide sales performance
 * @access  Requires: Level 5+ (Regional Directors, VPs, Executives)
 */
router.get('/sales/company-performance', requireLevel(5), async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateRange = {
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    };

    const data = await DirectorReportingService.getCompanySalesPerformance(req.user!, dateRange);

    res.json({
      ...data,
      insights: {
        performanceStatus:
          data.quotaAttainment >= 100
            ? 'exceeding'
            : data.quotaAttainment >= 90
              ? 'on_track'
              : data.quotaAttainment >= 75
                ? 'near_target'
                : 'at_risk',
        topRegions: data.regions.slice(0, 3),
        pipelineCoverage: data.pipelineValue / (data.totalRevenue || 1),
      },
    });
  } catch (error) {
    log.error('Error fetching company sales performance:', error);
    res.status(500).json({
      message: 'Failed to fetch company sales performance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =====================================================================
// COMPANY-WIDE SERVICE PERFORMANCE (LEVEL 5 & 6)
// =====================================================================

/**
 * @route   GET /api/director-reports/service/company-performance
 * @desc    Get company-wide service performance
 * @access  Requires: Level 5+ (Regional Directors, VPs, Executives)
 */
router.get('/service/company-performance', requireLevel(5), async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateRange = {
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    };

    const data = await DirectorReportingService.getCompanyServicePerformance(req.user!, dateRange);

    res.json({
      ...data,
      insights: {
        serviceHealth:
          data.avgFirstTimeFixRate >= 85 && data.avgSlaCompliance >= 90
            ? 'excellent'
            : data.avgFirstTimeFixRate >= 75 && data.avgSlaCompliance >= 85
              ? 'good'
              : data.avgFirstTimeFixRate >= 65 && data.avgSlaCompliance >= 75
                ? 'fair'
                : 'needs_improvement',
        topRegions: data.regions.sort((a, b) => b.ftfRate - a.ftfRate).slice(0, 3),
        utilizationStatus:
          data.avgUtilization >= 80 ? 'optimal' : data.avgUtilization >= 60 ? 'adequate' : 'low',
      },
    });
  } catch (error) {
    log.error('Error fetching company service performance:', error);
    res.status(500).json({
      message: 'Failed to fetch company service performance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

/**
 * @route   POST /api/director-reports/clear-cache
 * @desc    Clear report cache (directors and above)
 * @access  Requires: Level 5+
 */
router.post('/clear-cache', requireLevel(5), async (req: Request, res: Response) => {
  try {
    DirectorReportingService.clearCache();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    log.error('Error clearing cache:', error);
    res.status(500).json({
      message: 'Failed to clear cache',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
