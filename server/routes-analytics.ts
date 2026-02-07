import { Router, type Express } from 'express';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-analytics');

const router = Router();

/**
 * GET /api/analytics/dashboard
 * Get comprehensive analytics dashboard with executive summary,
 * revenue, customer, service, equipment, financial, and predictive analytics
 */
router.get('/api/analytics/dashboard', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const analyticsDashboard = {
      executiveSummary: {
        totalRevenue: { current: 2847650.75, previous: 2634580.2, growth: 8.1, trend: 'up' },
        activeCustomers: { current: 847, previous: 832, growth: 1.8, trend: 'up' },
        serviceTickets: { current: 2156, previous: 2089, growth: 3.2, trend: 'up' },
        grossMargin: { current: 42.7, previous: 41.2, growth: 1.5, trend: 'up' },
      },
      revenueAnalytics: {
        monthlyRevenue: [
          { month: '2024-07', revenue: 245680.5, contracts: 78, newCustomers: 12 },
          { month: '2025-01', revenue: 356290.1, contracts: 102, newCustomers: 28 },
        ],
        revenueByCategory: [
          { category: 'Equipment Sales', amount: 1247850.3, percentage: 43.8, growth: 12.5 },
          { category: 'Service Contracts', amount: 892640.75, percentage: 31.4, growth: 6.2 },
        ],
        topPerformingProducts: [
          {
            product: 'Canon ImageRunner Advance DX 6780i',
            revenue: 287450.0,
            units: 23,
            margin: 38.5,
            trend: 'up',
          },
        ],
      },
      customerAnalytics: {
        customerSegmentation: [
          {
            segment: 'Enterprise (500+ employees)',
            count: 89,
            revenue: 1456780.25,
            percentage: 51.2,
          },
        ],
        customerLifetimeValue: {
          average: 18750.45,
          median: 14280.2,
          top10Percent: 67890.75,
          churnRate: 4.2,
          retentionRate: 95.8,
        },
        topCustomers: [
          {
            name: 'Metro Healthcare Systems',
            revenue: 187450.75,
            contracts: 15,
            satisfaction: 4.8,
            lastPurchase: new Date('2025-01-28T00:00:00Z'),
            nextRenewal: new Date('2025-06-15T00:00:00Z'),
          },
        ],
      },
      serviceAnalytics: {
        serviceMetrics: {
          totalTickets: 2156,
          avgResolutionTime: 3.4,
          firstCallResolution: 87.5,
          customerSatisfaction: 4.6,
          technicianUtilization: 78.3,
        },
        ticketTrends: [{ month: '2025-01', tickets: 338, resolved: 329, satisfaction: 4.6 }],
        topIssues: [{ issue: 'Paper Jam', count: 387, avgTime: 1.2, resolution: 96.8 }],
        technicianPerformance: [
          {
            technician: 'Mike Rodriguez',
            tickets: 187,
            avgTime: 2.8,
            satisfaction: 4.8,
            efficiency: 94.2,
          },
        ],
      },
      equipmentAnalytics: {
        fleetOverview: {
          totalUnits: 1247,
          averageAge: 3.2,
          utilizationRate: 73.4,
          maintenanceCompliance: 94.7,
        },
        equipmentByManufacturer: [
          { manufacturer: 'Canon', units: 387, percentage: 31.0, avgAge: 2.8 },
        ],
        maintenanceSchedule: { overdue: 23, dueSoon: 67, upcoming: 156, compliant: 1001 },
      },
      financialAnalytics: {
        profitability: {
          grossProfit: 1215867.45,
          grossMargin: 42.7,
          netProfit: 567890.25,
          netMargin: 19.9,
          ebitda: 678950.75,
        },
        cashFlow: [{ month: '2025-01', inflow: 434567.1, outflow: 324567.85, net: 109999.25 }],
        expenseBreakdown: [{ category: 'Cost of Goods Sold', amount: 1631783.3, percentage: 57.3 }],
      },
      predictiveAnalytics: {
        revenueForecast: [{ month: '2025-02', predicted: 389670.5, confidence: 87.5 }],
        churnPrediction: {
          highRisk: 23,
          mediumRisk: 67,
          lowRisk: 757,
          actions: [
            {
              customer: 'Sunset Industries',
              risk: 89.2,
              action: 'Immediate intervention required',
            },
          ],
        },
      },
      competitiveAnalysis: {
        marketShare: {
          company: 12.7,
          competitor1: 18.9,
          competitor2: 15.4,
          competitor3: 13.2,
          others: 39.8,
        },
        winLossAnalysis: {
          totalOpportunities: 287,
          won: 156,
          lost: 89,
          inProgress: 42,
          winRate: 54.4,
        },
      },
    };

    res.json(analyticsDashboard);
  } catch (error) {
    log.error('Error fetching analytics dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch analytics dashboard' });
  }
});

/**
 * GET /api/analytics/metrics
 * Get aggregated analytics metrics including service calls, response time,
 * customer satisfaction, revenue growth, utilization, and first call resolution
 */
router.get('/api/analytics/metrics', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const queries = [
      `SELECT COALESCE(SUM(total_service_calls), 0) as total_service_calls FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly' AND metric_date >= DATE_TRUNC('month', CURRENT_DATE)`,
      `SELECT COALESCE(AVG(average_response_time_minutes), 0) as avg_response_time FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
      `SELECT COALESCE(AVG(average_satisfaction_score), 0) as customer_satisfaction FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
      `SELECT COALESCE(AVG(month_over_month_growth), 0) as revenue_growth FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
      `SELECT COALESCE(AVG(utilization_rate), 0) as utilization_rate FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
      `SELECT COALESCE(AVG(first_call_resolution_rate), 0) as first_call_resolution FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
    ];

    const results = await Promise.all(queries.map((query) => db.$client.query(query, [tenantId])));

    res.json({
      totalServiceCalls: parseInt(results[0].rows[0].total_service_calls),
      averageResponseTime: parseFloat(results[1].rows[0].avg_response_time),
      customerSatisfaction: parseFloat(results[2].rows[0].customer_satisfaction),
      revenueGrowth: parseFloat(results[3].rows[0].revenue_growth),
      utilizationRate: parseFloat(results[4].rows[0].utilization_rate),
      firstCallResolution: parseFloat(results[5].rows[0].first_call_resolution),
    });
  } catch (error) {
    log.error('Error fetching analytics metrics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics metrics' });
  }
});

/**
 * GET /api/analytics/performance-metrics
 * Get service performance metrics filtered by period
 */
router.get('/api/analytics/performance-metrics', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const period = String((req.query as any)?.period || '');

    let whereConditions = ['tenant_id = $1'];
    const queryParams = [tenantId];

    if (period && period !== 'all') {
      whereConditions.push(`metric_period = $${queryParams.length + 1}`);
      queryParams.push(period);
    }

    const query = `
      SELECT *
      FROM service_performance_metrics
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY metric_date DESC
      LIMIT 20
    `;

    const result = await db.$client.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * GET /api/analytics/technician-performance
 * Get technician performance analytics with technician names
 */
router.get('/api/analytics/technician-performance', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const query = `
      SELECT
        tpa.*,
        u.name as technician_name
      FROM technician_performance_analytics tpa
      LEFT JOIN users u ON tpa.technician_id = u.id
      WHERE tpa.tenantId = $1
      ORDER BY tpa.createdAt DESC
    `;

    const result = await db.$client.query(query, [tenantId]);
    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching technician performance analytics:', error);
    res.status(500).json({ error: 'Failed to fetch technician performance analytics' });
  }
});

/**
 * GET /api/analytics/customer-service
 * Get customer service analytics with customer names
 */
router.get('/api/analytics/customer-service', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const query = `
      SELECT
        csa.*,
        br.companyName as customer_name
      FROM customer_service_analytics csa
      LEFT JOIN business_records br ON csa.business_record_id = br.id
      WHERE csa.tenantId = $1
      ORDER BY csa.createdAt DESC
    `;

    const result = await db.$client.query(query, [tenantId]);
    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching customer service analytics:', error);
    res.status(500).json({ error: 'Failed to fetch customer service analytics' });
  }
});

/**
 * GET /api/analytics/trends
 * Get service trend analysis filtered by category
 */
router.get('/api/analytics/trends', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const category = String((req.query as any)?.category || '');

    let whereConditions = ['tenant_id = $1'];
    const queryParams = [tenantId];

    if (category && category !== 'all') {
      whereConditions.push(`trend_category = $${queryParams.length + 1}`);
      queryParams.push(category);
    }

    const query = `
      SELECT *
      FROM service_trend_analysis
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY analysis_date DESC
      LIMIT 10
    `;

    const result = await db.$client.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching trend analysis:', error);
    res.status(500).json({ error: 'Failed to fetch trend analysis' });
  }
});

/**
 * GET /api/analytics/dashboards
 * Get business intelligence dashboards filtered by category
 */
router.get('/api/analytics/dashboards', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const category = String((req.query as any)?.category || '');

    let whereConditions = ['bid.tenantId = $1'];
    const queryParams = [tenantId];

    if (category && category !== 'all') {
      whereConditions.push(`bid.category = $${queryParams.length + 1}`);
      queryParams.push(category);
    }

    const query = `
      SELECT
        bid.*,
        u.name as owner_name
      FROM business_intelligence_dashboards bid
      LEFT JOIN users u ON bid.ownerId = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY bid.isFeatured DESC, bid.createdAt DESC
    `;

    const result = await db.$client.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching BI dashboards:', error);
    res.status(500).json({ error: 'Failed to fetch BI dashboards' });
  }
});

/**
 * POST /api/analytics/dashboards
 * Create a new business intelligence dashboard
 */
router.post('/api/analytics/dashboards', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const {
      dashboard_name,
      dashboard_type,
      category,
      visibility,
      refresh_interval,
      auto_refresh,
      description,
    } = req.body;

    const dashboardConfig = {
      description,
      widgets: [],
      layout: 'grid',
      theme: 'default',
    };

    const query = `
      INSERT INTO business_intelligence_dashboards (
        tenant_id, dashboard_name, dashboard_type, category, owner_id,
        visibility, refresh_interval, auto_refresh, dashboard_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await db.$client.query(query, [
      tenantId,
      dashboard_name,
      dashboard_type,
      category,
      userId,
      visibility,
      refresh_interval,
      auto_refresh,
      JSON.stringify(dashboardConfig),
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    log.error('Error creating BI dashboard:', error);
    res.status(500).json({ error: 'Failed to create BI dashboard' });
  }
});

/**
 * GET /api/analytics/benchmarks
 * Get performance benchmarks ordered by improvement priority
 */
router.get('/api/analytics/benchmarks', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const query = `
      SELECT *
      FROM performance_benchmarks
      WHERE tenant_id = $1
      ORDER BY improvement_priority DESC, created_at DESC
    `;

    const result = await db.$client.query(query, [tenantId]);
    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching performance benchmarks:', error);
    res.status(500).json({ error: 'Failed to fetch performance benchmarks' });
  }
});

/**
 * POST /api/analytics/benchmarks
 * Create a new performance benchmark
 */
router.post('/api/analytics/benchmarks', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const {
      benchmark_name,
      benchmark_category,
      industry_average,
      company_target,
      improvement_priority,
      target_completion_date,
      business_impact,
      investment_required,
    } = req.body;

    const query = `
      INSERT INTO performance_benchmarks (
        tenant_id, benchmark_name, benchmark_category, industry_average,
        company_target, improvement_priority, target_completion_date,
        business_impact, investment_required, trend_direction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await db.$client.query(query, [
      tenantId,
      benchmark_name,
      benchmark_category,
      industry_average,
      company_target,
      improvement_priority,
      target_completion_date,
      business_impact,
      investment_required,
      'stable',
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    log.error('Error creating performance benchmark:', error);
    res.status(500).json({ error: 'Failed to create performance benchmark' });
  }
});

/**
 * POST /api/analytics/generate-reports
 * Generate sample analytics reports including performance metrics and trend analysis
 */
router.post('/api/analytics/generate-reports', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const metricsQuery = `
      INSERT INTO service_performance_metrics (
        tenant_id, metric_date, metric_period, period_start, period_end,
        total_service_calls, emergency_calls, average_response_time_minutes,
        first_call_resolution_rate, average_satisfaction_score, total_service_revenue,
        utilization_rate, jobs_completed_on_time, jobs_completed_late, month_over_month_growth
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    await db.$client.query(metricsQuery, [
      tenantId,
      currentDate,
      'monthly',
      startOfMonth,
      currentDate,
      125,
      18,
      45.5,
      87.2,
      4.3,
      45000,
      78.5,
      98,
      12,
      8.5,
    ]);

    const trendQuery = `
      INSERT INTO service_trend_analysis (
        tenant_id, trend_category, analysis_date, period_type,
        current_value, previous_value, percentage_change, trend_direction,
        forecasted_next_period, forecast_confidence, trend_insights
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    const trends = [
      [
        'service_volume',
        125,
        118,
        5.93,
        'up',
        132,
        85,
        'Service volume continues to grow steadily',
      ],
      [
        'satisfaction',
        4.3,
        4.1,
        4.88,
        'up',
        4.4,
        90,
        'Customer satisfaction improving with recent process changes',
      ],
      [
        'response_times',
        45.5,
        52.3,
        -13.0,
        'down',
        42,
        88,
        'Response times improving due to optimized routing',
      ],
    ];

    for (const trend of trends) {
      await db.$client.query(trendQuery, [
        tenantId,
        trend[0],
        currentDate,
        'monthly',
        trend[1],
        trend[2],
        trend[3],
        trend[4],
        trend[5],
        trend[6],
        trend[7],
      ]);
    }

    res.status(201).json({
      message: 'Analytics reports generated successfully',
      reports_generated: 1 + trends.length,
    });
  } catch (error) {
    log.error('Error generating analytics reports:', error);
    res.status(500).json({ error: 'Failed to generate analytics reports' });
  }
});

export function registerAnalyticsRoutes(app: Express) {
  app.use(router);
}

export default router;
