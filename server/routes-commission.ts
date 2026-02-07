import { Router, type Express } from 'express';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-commission');

const router = Router();

/**
 * GET /api/commission/plans
 * Get commission plans for a tenant
 * Returns structured commission plan data with tiers, rules, and product rates
 */
router.get('/api/commission/plans', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    // Sample commission plans
    const commissionPlans = [
      {
        id: 'plan-1',
        planName: 'Sales Rep Standard',
        planType: 'sales_rep',
        description: 'Standard commission plan for sales representatives',
        isActive: true,
        effectiveDate: new Date('2024-01-01'),
        tiers: [
          {
            tierLevel: 1,
            tierName: 'Starter',
            minimumSales: 0,
            maximumSales: 50000,
            commissionRate: 5.0,
            bonusThreshold: null,
            bonusAmount: null,
          },
          {
            tierLevel: 2,
            tierName: 'Achiever',
            minimumSales: 50001,
            maximumSales: 100000,
            commissionRate: 6.5,
            bonusThreshold: 75000,
            bonusAmount: 2500,
          },
        ],
        rules: {
          paymentFrequency: 'monthly',
          paymentDelay: 30,
          splitCommissionAllowed: true,
          chargebackEnabled: true,
          chargebackPeriod: 90,
          minimumCommissionPayment: 100,
        },
        productRates: [
          {
            category: 'new_equipment',
            rate: 8.0,
            description: 'New copier/printer sales',
          },
          {
            category: 'service_contracts',
            rate: 4.0,
            description: 'Service and maintenance contracts',
          },
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2025-01-15'),
      },
    ];

    res.json(commissionPlans);
  } catch (error) {
    log.error('Error fetching commission plans:', error);
    res.status(500).json({ message: 'Failed to fetch commission plans' });
  }
});

/**
 * GET /api/commission/calculations
 * Get commission calculations for employees
 * Returns detailed calculation breakdowns with sales metrics and bonuses
 */
router.get('/api/commission/calculations', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    // Sample commission calculations
    const calculations = [
      {
        id: 'calc-1',
        employeeId: 'emp-001',
        employeeName: 'John Smith',
        employeeRole: 'Sales Representative',
        planId: 'plan-1',
        planName: 'Sales Rep Standard',
        calculationPeriod: {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31'),
          periodName: 'January 2025',
        },
        salesMetrics: {
          totalSales: 87500,
          quotaTarget: 75000,
          quotaAchievement: 116.7,
        },
        commissionDetails: [
          {
            category: 'new_equipment',
            salesAmount: 65000,
            commissionRate: 6.5,
            commissionAmount: 4225,
            description: 'Tier 2 rate (6.5%) applied for sales over $50k',
          },
        ],
        bonuses: [
          {
            type: 'tier_bonus',
            description: 'Achiever tier bonus for exceeding $75k',
            amount: 2500,
            eligibilityMet: true,
          },
        ],
        adjustments: [],
        summary: {
          grossCommission: 5350,
          totalBonuses: 3500,
          totalAdjustments: 0,
          netCommission: 8850,
          payoutDate: new Date('2025-03-01'),
          status: 'calculated',
        },
        calculatedAt: new Date('2025-02-01'),
        calculatedBy: 'system',
      },
    ];

    res.json(calculations);
  } catch (error) {
    log.error('Error fetching commission calculations:', error);
    res.status(500).json({ message: 'Failed to fetch commission calculations' });
  }
});

/**
 * GET /api/commission/analytics
 * Get commission analytics and performance metrics
 * Returns summary stats, trends, top performers, and plan performance
 */
router.get('/api/commission/analytics', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const analytics = {
      summary: {
        totalCommissionPaid: 245780,
        averageCommissionRate: 6.8,
        totalBonusesPaid: 45200,
        totalAdjustments: -8950,
        participatingEmployees: 28,
        topPerformerPayout: 18750,
        averagePayout: 8777.86,
      },
      performance_metrics: {
        quotaAchievementRate: 87.5,
        tierDistribution: {
          starter: 12,
          achiever: 11,
          elite: 5,
        },
      },
      monthly_trends: [
        {
          month: 'Dec 2024',
          totalCommissions: 85210,
          avgPayout: 9356,
          quotaAchievement: 89.2,
        },
        {
          month: 'Jan 2025',
          totalCommissions: 87500,
          avgPayout: 9611,
          quotaAchievement: 91.5,
        },
      ],
      top_performers: [
        {
          employeeId: 'emp-001',
          name: 'John Smith',
          role: 'Sales Representative',
          totalCommission: 18750,
          quotaAchievement: 191.7,
          rank: 1,
        },
      ],
      plan_performance: [
        {
          planId: 'plan-1',
          planName: 'Sales Rep Standard',
          participants: 18,
          avgPayout: 9235,
          totalPayout: 166230,
          avgQuotaAchievement: 89.2,
        },
      ],
      dispute_analysis: {
        totalDisputes: 3,
        resolvedDisputes: 2,
        pendingDisputes: 1,
        averageResolutionTime: 5.5,
      },
    };

    res.json(analytics);
  } catch (error) {
    log.error('Error fetching commission analytics:', error);
    res.status(500).json({ message: 'Failed to fetch commission analytics' });
  }
});

/**
 * GET /api/commission/disputes
 * Get commission disputes and their resolution status
 * Returns dispute details with assigned reviewers and resolution timeline
 */
router.get('/api/commission/disputes', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const disputes = [
      {
        id: 'dispute-1',
        disputeNumber: 'DISP-2025-001',
        employeeId: 'emp-001',
        employeeName: 'John Smith',
        calculationPeriod: 'January 2025',
        disputeDetails: {
          type: 'calculation_error',
          description: 'Incorrect commission rate applied for large deal',
          disputedAmount: 2850,
          expectedAmount: 5200,
          difference: 2350,
        },
        status: 'under_review',
        priority: 'high',
        resolution: {
          assignedToName: 'Mary Johnson',
          estimatedResolution: new Date('2025-02-10'),
          notes: 'Reviewing contract terms and commission plan details',
        },
      },
    ];

    res.json(disputes);
  } catch (error) {
    log.error('Error fetching commission disputes:', error);
    res.status(500).json({ message: 'Failed to fetch commission disputes' });
  }
});

export function registerCommissionRoutes(app: Express) {
  app.use(router);
}

export default router;
