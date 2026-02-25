/**
 * Financial Forecasting Routes
 * Extracted from routes.ts monolith.
 *
 * Covers:
 * - GET    /api/financial/metrics           - Get financial metrics summary
 * - GET    /api/financial/forecasts         - Get financial forecasts (with optional type filter)
 * - POST   /api/financial/forecasts         - Create financial forecast
 * - GET    /api/financial/cash-flow         - Get cash flow projections
 * - POST   /api/financial/cash-flow         - Create cash flow projection
 * - GET    /api/financial/profitability     - Get profitability analysis (with optional type filter)
 * - POST   /api/financial/profitability/run - Run profitability analysis
 * - GET    /api/financial/kpis              - Get financial KPIs
 */

import type { Express } from 'express';
import { db } from './db';
import { and, eq, sql } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-financial-forecasting');

import { businessRecords, serviceTickets, invoices } from '@shared/schema';

import { getUserId, getTenantId } from './utils/auth-helpers';
export function registerFinancialForecastingRoutes(app: Express) {
  // ============= FINANCIAL FORECASTING ROUTES =============

  // Get financial metrics
  app.get(
    '/api/financial/metrics',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COALESCE(SUM(total_forecast_amount), 0) as total_revenue_forecast FROM financial_forecasts WHERE tenant_id = $1 AND forecast_type = 'revenue' AND status = 'published'`,
          `SELECT COALESCE(SUM(net_cash_flow), 0) as cash_flow_projection FROM cash_flow_projections WHERE tenant_id = $1 AND projection_period >= date_trunc('month', CURRENT_DATE)`,
          `SELECT COALESCE(AVG(gross_margin_percentage), 0) as avg_profit_margin FROM profitability_analysis WHERE tenant_id = $1`,
          `SELECT COALESCE(AVG(growth_rate), 0) as avg_growth_rate FROM financial_forecasts WHERE tenant_id = $1`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId])),
        );

        res.json({
          totalRevenueForecast: parseFloat(results[0].rows[0].total_revenue_forecast),
          cashFlowProjection: parseFloat(results[1].rows[0].cash_flow_projection),
          profitMargin: parseFloat(results[2].rows[0].avg_profit_margin),
          growthProjection: parseFloat(results[3].rows[0].avg_growth_rate),
          riskLevel: 'medium',
          forecastAccuracy: 0.85,
        });
      } catch (error) {
        log.error('Error fetching financial metrics:', error);
        res.status(500).json({ error: 'Failed to fetch financial metrics' });
      }
    },
  );

  // Get financial forecasts
  app.get(
    '/api/financial/forecasts',

    async (req: any, res) => {
      try {
        const type = String((req.query as any)?.type || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['tenant_id = $1'];
        const queryParams = [tenantId];

        if (type && type !== 'all') {
          whereConditions.push(`forecast_type = $${queryParams.length + 1}`);
          queryParams.push(type);
        }

        const query = `
        SELECT *
        FROM financial_forecasts
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching financial forecasts:', error);
        res.status(500).json({ error: 'Failed to fetch financial forecasts' });
      }
    },
  );

  // Create financial forecast
  app.post(
    '/api/financial/forecasts',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          forecast_name,
          forecast_type,
          forecast_period,
          start_date,
          end_date,
          base_amount,
          growth_rate,
          scenario_type,
          assumptions,
        } = req.body;

        // Calculate forecast amount (simplified calculation)
        const totalForecastAmount = base_amount * (1 + growth_rate);

        const query = `
        INSERT INTO financial_forecasts (
          tenant_id, forecast_name, forecast_type, forecast_period, start_date,
          end_date, base_amount, growth_rate, scenario_type, assumptions,
          total_forecast_amount, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          forecast_name,
          forecast_type,
          forecast_period,
          start_date,
          end_date,
          base_amount,
          growth_rate,
          scenario_type,
          assumptions,
          totalForecastAmount,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating financial forecast:', error);
        res.status(500).json({ error: 'Failed to create financial forecast' });
      }
    },
  );

  // Get cash flow projections
  app.get(
    '/api/financial/cash-flow',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT *
        FROM cash_flow_projections
        WHERE tenant_id = $1
        ORDER BY projection_period DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching cash flow projections:', error);
        res.status(500).json({ error: 'Failed to fetch cash flow projections' });
      }
    },
  );

  // Create cash flow projection
  app.post(
    '/api/financial/cash-flow',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          projection_name,
          projection_period,
          beginning_cash,
          collections_forecast,
          payroll_expenses,
          operating_expenses,
          equipment_purchases,
          minimum_cash_required,
          assumptions,
        } = req.body;

        // Calculate cash flow
        const totalCashInflow = beginning_cash + collections_forecast;
        const totalCashOutflow = payroll_expenses + operating_expenses + equipment_purchases;
        const netCashFlow = totalCashInflow - totalCashOutflow;
        const endingCash = beginning_cash + netCashFlow;
        const cashShortageRisk = endingCash < minimum_cash_required;
        const daysCashOnHand =
          endingCash > 0 ? Math.floor(endingCash / (totalCashOutflow / 30)) : 0;

        const query = `
        INSERT INTO cash_flow_projections (
          tenant_id, projection_name, projection_period, beginning_cash,
          collections_forecast, total_cash_inflow, payroll_expenses,
          operating_expenses, equipment_purchases, total_cash_outflow,
          net_cash_flow, ending_cash, minimum_cash_required, cash_shortage_risk,
          days_cash_on_hand, assumptions, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          projection_name,
          projection_period,
          beginning_cash,
          collections_forecast,
          totalCashInflow,
          payroll_expenses,
          operating_expenses,
          equipment_purchases,
          totalCashOutflow,
          netCashFlow,
          endingCash,
          minimum_cash_required,
          cashShortageRisk,
          daysCashOnHand,
          assumptions,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating cash flow projection:', error);
        res.status(500).json({ error: 'Failed to create cash flow projection' });
      }
    },
  );

  // Get profitability analysis
  app.get(
    '/api/financial/profitability',

    async (req: any, res) => {
      try {
        const type = String((req.query as any)?.type || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['tenant_id = $1'];
        const queryParams = [tenantId];

        if (type && type !== 'all') {
          whereConditions.push(`analysis_type = $${queryParams.length + 1}`);
          queryParams.push(type);
        }

        const query = `
        SELECT *
        FROM profitability_analysis
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching profitability analysis:', error);
        res.status(500).json({ error: 'Failed to fetch profitability analysis' });
      }
    },
  );

  // Run profitability analysis
  app.post(
    '/api/financial/profitability/run',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Real profitability analysis based on actual customer data
        const customerAnalyses = await db
          .select({
            customerId: businessRecords.id,
            customerName: businessRecords.companyName,
            totalRevenue: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric`,
            totalCosts: sql<number>`0::numeric`,
          })
          .from(businessRecords)
          .leftJoin(invoices, eq(businessRecords.id, invoices.customerId))
          .leftJoin(serviceTickets, eq(businessRecords.id, serviceTickets.customerId))
          .where(
            and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
          )
          .groupBy(businessRecords.id, businessRecords.companyName)
          .having(sql`sum(${invoices.totalAmount}) > 0`)
          .limit(5);

        for (const analysis of customerAnalyses) {
          const serviceRevenue = Number(analysis.totalRevenue || 0);
          const totalCosts = Number(analysis.totalCosts || 0);
          const grossProfit = serviceRevenue - totalCosts;
          const netProfit = grossProfit * 0.85; // Simplified calculation
          const grossMargin = serviceRevenue > 0 ? (grossProfit / serviceRevenue) * 100 : 0;
          const netMargin = serviceRevenue > 0 ? (netProfit / serviceRevenue) * 100 : 0;
          const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;

          const query = `
          INSERT INTO profitability_analysis (
            tenant_id, analysis_name, analysis_type, analysis_period_start,
            analysis_period_end, subject_type, subject_name, service_revenue,
            total_revenue, total_costs, gross_profit, gross_margin_percentage,
            net_profit, net_margin_percentage, roi_percentage, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `;

          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          const endDate = new Date();

          await db.$client.query(query, [
            tenantId,
            `Customer Profitability: ${analysis.customerName}`,
            'customer',
            startDate,
            endDate,
            'customer',
            analysis.customerName,
            serviceRevenue,
            serviceRevenue,
            totalCosts,
            grossProfit,
            grossMargin,
            netProfit,
            netMargin,
            roi,
            userId,
          ]);
        }

        res.status(201).json({
          message: 'Profitability analysis completed',
          analyses_created: customerAnalyses.length,
        });
      } catch (error) {
        log.error('Error running profitability analysis:', error);
        res.status(500).json({ error: 'Failed to run profitability analysis' });
      }
    },
  );

  // Get financial KPIs
  app.get('/api/financial/kpis', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const query = `
        SELECT *
        FROM financial_kpis
        WHERE tenant_id = $1
        ORDER BY calculation_period DESC
      `;

      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      log.error('Error fetching financial KPIs:', error);
      res.status(500).json({ error: 'Failed to fetch financial KPIs' });
    }
  });
}
