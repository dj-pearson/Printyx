// =====================================================================
// EXECUTIVE & PLATFORM ADMIN REPORTS API
// RESTful endpoints for executive and platform admin reports (Level 7 & 8)
// =====================================================================

import { Router, type Request, type Response } from 'express';
import { ExecutiveReportingService } from '../services/executive-reporting-service';
import { enhanceUserContext, requireLevel } from '../middleware/enhanced-rbac-middleware';

const router = Router();

// Apply RBAC middleware to all routes
router.use(enhanceUserContext);

// =====================================================================
// EXECUTIVE DASHBOARD (LEVEL 7: CEO, CFO, COO)
// =====================================================================

/**
 * @route   GET /api/executive-reports/dashboard
 * @desc    Get executive dashboard with strategic KPIs
 * @access  Requires: Level 7+ (Executives)
 */
router.get('/dashboard', requireLevel(7), async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateRange = {
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    };

    const data = await ExecutiveReportingService.getExecutiveDashboard(req.user!, dateRange);

    res.json({
      ...data,
      insights: {
        overallHealth:
          data.kpis.filter((k) => k.status === 'green').length >= 3
            ? 'strong'
            : data.kpis.filter((k) => k.status === 'red').length >= 2
              ? 'concerning'
              : 'moderate',
        profitability: (data.financial.netProfit / data.financial.totalRevenue) * 100,
        growthTrajectory:
          data.financial.revenueGrowth >= 15
            ? 'accelerating'
            : data.financial.revenueGrowth >= 5
              ? 'steady'
              : 'slowing',
        customerHealth:
          data.operational.customerChurn < 3 && data.operational.nps > 40
            ? 'excellent'
            : data.operational.customerChurn < 5 && data.operational.nps > 30
              ? 'good'
              : 'needs_attention',
      },
    });
  } catch (error) {
    console.error('Error fetching executive dashboard:', error);
    res.status(500).json({
      message: 'Failed to fetch executive dashboard',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =====================================================================
// PLATFORM ADMIN DASHBOARD (LEVEL 8: PLATFORM ADMINISTRATORS)
// =====================================================================

/**
 * @route   GET /api/executive-reports/platform-admin
 * @desc    Get platform-wide metrics (Printyx staff only)
 * @access  Requires: Level 8 (Platform Administrators)
 */
router.get('/platform-admin', requireLevel(8), async (req: Request, res: Response) => {
  try {
    const data = await ExecutiveReportingService.getPlatformAdminDashboard();

    res.json({
      ...data,
      insights: {
        systemHealth:
          data.system.uptime >= 99.9 && data.system.errorRate < 0.1
            ? 'excellent'
            : data.system.uptime >= 99.5 && data.system.errorRate < 0.5
              ? 'good'
              : 'needs_attention',
        tenantGrowth:
          (((data.tenants.active - data.tenants.churned) / data.tenants.total) * 100).toFixed(1) +
          '%',
        revenueHealth:
          data.billing.expansionRevenue > data.billing.contractionRevenue ? 'positive' : 'negative',
        userEngagement: (data.usage.dailyActiveUsers / data.usage.monthlyActiveUsers) * 100,
      },
    });
  } catch (error) {
    console.error('Error fetching platform admin dashboard:', error);
    res.status(500).json({
      message: 'Failed to fetch platform admin dashboard',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

/**
 * @route   POST /api/executive-reports/clear-cache
 * @desc    Clear report cache (executives only)
 * @access  Requires: Level 7+
 */
router.post('/clear-cache', requireLevel(7), async (req: Request, res: Response) => {
  try {
    ExecutiveReportingService.clearCache();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      message: 'Failed to clear cache',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
