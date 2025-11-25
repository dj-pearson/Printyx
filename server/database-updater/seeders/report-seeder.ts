// =====================================================================
// REPORT DEFINITIONS SEEDER
// Seeds all 75+ report definitions for the comprehensive RBAC reporting system
// =====================================================================

import { db } from '../../db';
import { reportDefinitions, kpiDefinitions } from '../../../shared/reporting-schema';
import { sql } from 'drizzle-orm';

// =====================================================================
// TYPES AND INTERFACES
// =====================================================================

interface ReportDefinition {
  name: string;
  code: string;
  description: string;
  category: 'sales' | 'service' | 'finance' | 'operations' | 'hr' | 'it' | 'compliance' | 'executive';
  organizationalScope: 'platform' | 'company' | 'regional' | 'location' | 'team' | 'individual';
  requiredPermissions: string[];
  defaultVisualization: 'table' | 'chart' | 'dashboard' | 'kpi_widget' | 'chart_table_combo';
  isRealTime?: boolean;
  supportsDrillDown?: boolean;
  supportsExport?: boolean;
  containsSensitiveData?: boolean;
  cacheDuration?: number; // seconds
  queryTimeout?: number; // seconds
  maxRowLimit?: number;
  sqlQuery: string;
  defaultParameters?: Record<string, any>;
  availableFilters?: Record<string, any>;
  availableGroupings?: Record<string, any>;
  chartConfig?: Record<string, any>;
  tags?: string[];
}

// =====================================================================
// SALES REPORTS (24 reports)
// =====================================================================

const SALES_REPORTS: ReportDefinition[] = [
  // Level 1: Sales Representative Reports
  {
    name: 'Personal Pipeline Report',
    code: 'SALES_PERSONAL_PIPELINE',
    description: 'View your personal sales pipeline with opportunities by stage, weighted value, and conversion rates',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.opportunity.view_own'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: false,
    cacheDuration: 0,
    sqlQuery: `
      SELECT
        o.id,
        o.name,
        o.stage,
        o.amount,
        o.weighted_amount,
        o.probability,
        o.expected_close_date,
        o.days_in_stage,
        c.name as customer_name,
        p.name as product_category
      FROM opportunities o
      LEFT JOIN business_records c ON o.customer_id = c.id
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.owner_id = :userId
        AND o.tenant_id = :tenantId
        AND (:dateFrom IS NULL OR o.created_at >= :dateFrom)
        AND (:dateTo IS NULL OR o.created_at <= :dateTo)
      ORDER BY o.weighted_amount DESC, o.expected_close_date ASC
    `,
    defaultParameters: {
      dateFrom: null,
      dateTo: null,
    },
    availableFilters: {
      dateRange: { type: 'date_range', field: 'created_at' },
      expectedCloseDate: { type: 'date_range', field: 'expected_close_date' },
      stage: { type: 'multi_select', field: 'stage' },
      productCategory: { type: 'multi_select', field: 'product_id' },
      dealSize: { type: 'range', field: 'amount' },
    },
    availableGroupings: {
      stage: { field: 'stage', label: 'Pipeline Stage' },
      productCategory: { field: 'product_category', label: 'Product Category' },
      month: { field: 'DATE_TRUNC(\'month\', expected_close_date)', label: 'Expected Close Month' },
    },
    chartConfig: {
      funnelChart: {
        type: 'funnel',
        xField: 'stage',
        yField: 'count',
        colorField: 'stage',
      },
      barChart: {
        type: 'bar',
        xField: 'stage',
        yField: 'weighted_amount',
        colorField: 'stage',
      },
      lineChart: {
        type: 'line',
        xField: 'date',
        yField: 'total_pipeline_value',
        period: 'last_90_days',
      },
    },
    tags: ['sales', 'pipeline', 'personal', 'level-1'],
  },
  {
    name: 'Personal Activity Report',
    code: 'SALES_PERSONAL_ACTIVITY',
    description: 'Track your daily sales activities including calls, meetings, emails, and quotes',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.activity.view_own'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsExport: false,
    cacheDuration: 0,
    sqlQuery: `
      SELECT
        a.id,
        a.activity_type,
        a.activity_date,
        a.subject,
        a.outcome,
        a.duration_minutes,
        a.completed,
        c.name as customer_name
      FROM activities a
      LEFT JOIN business_records c ON a.related_to_id = c.id
      WHERE a.owner_id = :userId
        AND a.tenant_id = :tenantId
        AND a.activity_date >= :dateFrom
        AND a.activity_date <= :dateTo
      ORDER BY a.activity_date DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    availableFilters: {
      dateRange: { type: 'date_range', field: 'activity_date' },
      activityType: { type: 'multi_select', field: 'activity_type' },
      outcome: { type: 'multi_select', field: 'outcome' },
      completed: { type: 'boolean', field: 'completed' },
    },
    chartConfig: {
      pieChart: {
        type: 'pie',
        angleField: 'count',
        colorField: 'activity_type',
      },
      lineChart: {
        type: 'line',
        xField: 'activity_date',
        yField: 'count',
        seriesField: 'activity_type',
      },
    },
    tags: ['sales', 'activity', 'personal', 'level-1'],
  },
  {
    name: 'Personal Quota Attainment',
    code: 'SALES_PERSONAL_QUOTA',
    description: 'Monitor your quota performance and track progress toward monthly, quarterly, and annual targets',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.quota.view_own'],
    defaultVisualization: 'kpi_widget',
    isRealTime: false,
    supportsExport: false,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        q.quota_period,
        q.quota_amount,
        COALESCE(SUM(o.amount), 0) as actual_sales,
        (COALESCE(SUM(o.amount), 0) / NULLIF(q.quota_amount, 0) * 100) as quota_percentage,
        q.quota_amount - COALESCE(SUM(o.amount), 0) as remaining_quota
      FROM quotas q
      LEFT JOIN opportunities o ON o.owner_id = q.user_id
        AND o.stage = 'Closed Won'
        AND o.close_date >= q.period_start
        AND o.close_date <= q.period_end
      WHERE q.user_id = :userId
        AND q.tenant_id = :tenantId
        AND q.quota_period = :period
      GROUP BY q.id, q.quota_period, q.quota_amount
    `,
    defaultParameters: {
      period: 'monthly',
    },
    chartConfig: {
      gaugeChart: {
        type: 'gauge',
        valueField: 'quota_percentage',
        min: 0,
        max: 150,
        ranges: [
          { from: 0, to: 70, color: '#ff4d4f' },
          { from: 70, to: 100, color: '#faad14' },
          { from: 100, to: 150, color: '#52c41a' },
        ],
      },
    },
    tags: ['sales', 'quota', 'personal', 'level-1'],
  },
  {
    name: 'Personal Commission Report',
    code: 'SALES_PERSONAL_COMMISSION',
    description: 'View your commission earnings including pending and paid commissions by deal',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.commission.view_own'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        c.id,
        c.commission_period,
        c.deal_id,
        o.name as deal_name,
        c.commission_amount,
        c.commission_status,
        c.payment_date,
        c.product_category,
        c.commission_rate
      FROM commissions c
      LEFT JOIN opportunities o ON c.deal_id = o.id
      WHERE c.sales_rep_id = :userId
        AND c.tenant_id = :tenantId
        AND (:dateFrom IS NULL OR c.commission_period >= :dateFrom)
        AND (:dateTo IS NULL OR c.commission_period <= :dateTo)
      ORDER BY c.commission_period DESC, c.commission_amount DESC
    `,
    defaultParameters: {
      dateFrom: null,
      dateTo: null,
    },
    availableFilters: {
      dateRange: { type: 'date_range', field: 'commission_period' },
      status: { type: 'multi_select', field: 'commission_status' },
      productCategory: { type: 'multi_select', field: 'product_category' },
    },
    tags: ['sales', 'commission', 'personal', 'level-1', 'sensitive'],
  },
  {
    name: 'Personal Leaderboard Position',
    code: 'SALES_PERSONAL_LEADERBOARD',
    description: 'See your ranking compared to other sales reps by revenue, deals closed, and activities',
    category: 'sales',
    organizationalScope: 'team',
    requiredPermissions: ['sales.leaderboard.view'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsExport: false,
    cacheDuration: 3600,
    sqlQuery: `
      WITH rep_stats AS (
        SELECT
          u.id,
          u.first_name || ' ' || u.last_name as rep_name,
          COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') as deals_closed,
          COALESCE(SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won'), 0) as revenue,
          COUNT(DISTINCT a.id) as activities
        FROM users u
        LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = :tenantId
        LEFT JOIN activities a ON a.owner_id = u.id AND a.tenant_id = :tenantId
        WHERE u.tenant_id = :tenantId
          AND u.role_code LIKE 'SALES_%'
        GROUP BY u.id, rep_name
      ),
      ranked AS (
        SELECT
          *,
          RANK() OVER (ORDER BY revenue DESC) as revenue_rank,
          RANK() OVER (ORDER BY deals_closed DESC) as deals_rank,
          RANK() OVER (ORDER BY activities DESC) as activity_rank
        FROM rep_stats
      )
      SELECT * FROM ranked
      ORDER BY revenue_rank
      LIMIT 10
    `,
    tags: ['sales', 'leaderboard', 'personal', 'level-1'],
  },

  // Level 2: Senior Sales Rep / Team Lead Reports
  {
    name: 'Team Pipeline Comparison',
    code: 'SALES_TEAM_PIPELINE_COMPARISON',
    description: 'Compare pipeline metrics across your team members including coverage and stage distribution',
    category: 'sales',
    organizationalScope: 'team',
    requiredPermissions: ['sales.opportunity.view_team'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        u.id as rep_id,
        u.first_name || ' ' || u.last_name as rep_name,
        COUNT(DISTINCT o.id) as opportunity_count,
        SUM(o.amount) as pipeline_value,
        SUM(o.weighted_amount) as weighted_pipeline,
        AVG(o.amount) as avg_deal_size,
        SUM(o.amount) / NULLIF(q.quota_amount, 0) * 100 as pipeline_coverage
      FROM users u
      LEFT JOIN opportunities o ON o.owner_id = u.id
        AND o.tenant_id = :tenantId
        AND o.stage NOT IN ('Closed Won', 'Closed Lost')
      LEFT JOIN quotas q ON q.user_id = u.id AND q.quota_period = 'monthly'
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
      GROUP BY u.id, rep_name, q.quota_amount
      ORDER BY weighted_pipeline DESC
    `,
    chartConfig: {
      stackedBar: {
        type: 'stacked_bar',
        xField: 'rep_name',
        yField: 'pipeline_value',
        colorField: 'stage',
      },
    },
    tags: ['sales', 'pipeline', 'team', 'level-2'],
  },
  {
    name: 'Team Activity Leaderboard',
    code: 'SALES_TEAM_ACTIVITY_LEADERBOARD',
    description: 'Track and compare activity levels across team members to identify coaching opportunities',
    category: 'sales',
    organizationalScope: 'team',
    requiredPermissions: ['sales.activity.view_team'],
    defaultVisualization: 'table',
    isRealTime: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        u.id as rep_id,
        u.first_name || ' ' || u.last_name as rep_name,
        COUNT(a.id) as total_activities,
        COUNT(a.id) FILTER (WHERE a.activity_type = 'Call') as calls,
        COUNT(a.id) FILTER (WHERE a.activity_type = 'Meeting') as meetings,
        COUNT(a.id) FILTER (WHERE a.activity_type = 'Email') as emails,
        COUNT(a.id) FILTER (WHERE a.completed = true) / NULLIF(COUNT(a.id), 0) * 100 as completion_rate
      FROM users u
      LEFT JOIN activities a ON a.owner_id = u.id
        AND a.tenant_id = :tenantId
        AND a.activity_date >= :dateFrom
        AND a.activity_date <= :dateTo
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
      GROUP BY u.id, rep_name
      ORDER BY total_activities DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '7 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'activity', 'team', 'level-2'],
  },

  // Level 3: Sales Supervisor Reports
  {
    name: 'Team Performance Dashboard',
    code: 'SALES_TEAM_PERFORMANCE',
    description: 'Comprehensive team performance metrics including revenue, quota attainment, and win rates',
    category: 'sales',
    organizationalScope: 'team',
    requiredPermissions: ['sales.performance.view_team'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:groupBy, o.close_date) as period,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') as deals_won,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue,
        SUM(q.quota_amount) as team_quota,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(SUM(q.quota_amount), 0) * 100) as quota_attainment,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') /
          NULLIF(COUNT(DISTINCT o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')), 0) * 100 as win_rate,
        AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))) as avg_sales_cycle_days
      FROM opportunities o
      JOIN users u ON o.owner_id = u.id
      LEFT JOIN quotas q ON q.user_id = u.id
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
        AND o.close_date >= :dateFrom
        AND o.close_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      groupBy: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'performance', 'team', 'level-3'],
  },
  {
    name: 'Lead Management Report',
    code: 'SALES_LEAD_MANAGEMENT',
    description: 'Monitor lead flow, conversion rates, aging, and assignment for location-level oversight',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.lead.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        l.lead_source,
        l.status,
        COUNT(l.id) as lead_count,
        COUNT(l.id) FILTER (WHERE l.status = 'Converted') as converted_count,
        COUNT(l.id) FILTER (WHERE l.status = 'Converted') / NULLIF(COUNT(l.id), 0) * 100 as conversion_rate,
        AVG(EXTRACT(DAY FROM (CURRENT_DATE - l.created_at))) as avg_age_days,
        COUNT(l.id) FILTER (WHERE l.owner_id IS NULL) as unassigned_count,
        COUNT(l.id) FILTER (WHERE l.next_follow_up_date < CURRENT_DATE AND l.status NOT IN ('Converted', 'Lost')) as overdue_count
      FROM business_records l
      WHERE l.tenant_id = :tenantId
        AND l.location_id = :locationId
        AND l.record_type = 'lead'
        AND l.created_at >= :dateFrom
        AND l.created_at <= :dateTo
      GROUP BY l.lead_source, l.status
      ORDER BY lead_count DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    chartConfig: {
      funnel: {
        type: 'funnel',
        xField: 'status',
        yField: 'lead_count',
      },
      pieChart: {
        type: 'pie',
        angleField: 'lead_count',
        colorField: 'lead_source',
      },
    },
    tags: ['sales', 'leads', 'location', 'level-3'],
  },
  {
    name: 'Coaching Report',
    code: 'SALES_COACHING_REPORT',
    description: 'Identify coaching opportunities based on activity levels, conversion rates, and deal velocity',
    category: 'sales',
    organizationalScope: 'team',
    requiredPermissions: ['sales.coaching.view_team'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        u.id as rep_id,
        u.first_name || ' ' || u.last_name as rep_name,
        COUNT(DISTINCT a.id) as call_volume,
        SUM(a.duration_minutes) FILTER (WHERE a.activity_type = 'Call') as call_talk_time,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'Meeting' AND a.completed = true) as meetings_held,
        COUNT(DISTINCT q.id) as quotes_generated,
        COUNT(DISTINCT q.id) FILTER (WHERE q.status = 'Accepted') / NULLIF(COUNT(DISTINCT q.id), 0) * 100 as quote_win_rate,
        COUNT(DISTINCT o.id) FILTER (WHERE o.updated_at < CURRENT_DATE - INTERVAL '30 days' AND o.stage NOT IN ('Closed Won', 'Closed Lost')) as deals_stuck
      FROM users u
      LEFT JOIN activities a ON a.owner_id = u.id AND a.tenant_id = :tenantId
      LEFT JOIN quotes q ON q.owner_id = u.id AND q.tenant_id = :tenantId
      LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = :tenantId
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
      GROUP BY u.id, rep_name
      ORDER BY rep_name
    `,
    tags: ['sales', 'coaching', 'team', 'level-3'],
  },

  // Level 4: Sales Manager Reports
  {
    name: 'Location Sales Performance Report',
    code: 'SALES_LOCATION_PERFORMANCE',
    description: 'Complete location sales overview including revenue, quota, pipeline coverage, and team breakdown',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.performance.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, o.close_date) as period,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue,
        SUM(q.quota_amount) as location_quota,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(SUM(q.quota_amount), 0) * 100) as quota_attainment,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') /
          NULLIF(COUNT(DISTINCT o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')), 0) * 100 as win_rate,
        AVG(o.amount) FILTER (WHERE o.stage = 'Closed Won') as avg_deal_size,
        AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))) FILTER (WHERE o.stage = 'Closed Won') as avg_sales_cycle_days,
        SUM(op.amount) FILTER (WHERE op.stage NOT IN ('Closed Won', 'Closed Lost')) / NULLIF(SUM(q.quota_amount), 0) * 100 as pipeline_coverage
      FROM opportunities o
      LEFT JOIN opportunities op ON op.location_id = o.location_id
      LEFT JOIN quotas q ON q.location_id = o.location_id
      WHERE o.location_id = :locationId
        AND o.tenant_id = :tenantId
        AND o.close_date >= :dateFrom
        AND o.close_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'performance', 'location', 'level-4'],
  },
  {
    name: 'Sales Forecasting Report',
    code: 'SALES_FORECASTING',
    description: 'AI-powered sales forecast with commit, best case, and worst case scenarios by rep and product',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.forecast.view_location'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    queryTimeout: 60,
    sqlQuery: `
      SELECT
        DATE_TRUNC('month', o.expected_close_date) as forecast_month,
        u.first_name || ' ' || u.last_name as rep_name,
        p.category as product_category,
        SUM(o.weighted_amount) as weighted_forecast,
        SUM(o.amount) FILTER (WHERE o.probability >= 80) as commit_forecast,
        SUM(o.amount) as best_case_forecast,
        SUM(o.amount) FILTER (WHERE o.probability >= 50) as worst_case_forecast,
        q.quota_amount,
        (SUM(o.weighted_amount) / NULLIF(q.quota_amount, 0) * 100) as forecast_vs_quota
      FROM opportunities o
      LEFT JOIN users u ON o.owner_id = u.id
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN quotas q ON q.user_id = u.id AND q.quota_period = 'monthly'
      WHERE o.location_id = :locationId
        AND o.tenant_id = :tenantId
        AND o.stage NOT IN ('Closed Won', 'Closed Lost')
        AND o.expected_close_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months'
      GROUP BY forecast_month, rep_name, product_category, q.quota_amount
      ORDER BY forecast_month, weighted_forecast DESC
    `,
    chartConfig: {
      waterfall: {
        type: 'waterfall',
        xField: 'forecast_month',
        yField: 'weighted_forecast',
      },
    },
    tags: ['sales', 'forecasting', 'location', 'level-4'],
  },
  {
    name: 'Win/Loss Analysis Report',
    code: 'SALES_WIN_LOSS_ANALYSIS',
    description: 'Detailed analysis of won and lost deals including reasons, competitors, and trends',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.analytics.view_location'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        o.stage,
        COUNT(o.id) as deal_count,
        COUNT(o.id) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(COUNT(o.id), 0) * 100 as win_rate,
        o.loss_reason,
        o.competitor,
        AVG(o.amount) FILTER (WHERE o.stage = 'Closed Won') as avg_won_deal_size,
        AVG(o.amount) FILTER (WHERE o.stage = 'Closed Lost') as avg_lost_deal_size,
        AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))) FILTER (WHERE o.stage = 'Closed Won') as avg_won_sales_cycle,
        AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))) FILTER (WHERE o.stage = 'Closed Lost') as avg_lost_sales_cycle,
        AVG(o.discount_percentage) FILTER (WHERE o.stage = 'Closed Won') as avg_won_discount,
        AVG(o.discount_percentage) FILTER (WHERE o.stage = 'Closed Lost') as avg_lost_discount
      FROM opportunities o
      WHERE o.location_id = :locationId
        AND o.tenant_id = :tenantId
        AND o.stage IN ('Closed Won', 'Closed Lost')
        AND o.close_date >= :dateFrom
        AND o.close_date <= :dateTo
      GROUP BY o.stage, o.loss_reason, o.competitor
      ORDER BY deal_count DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'win-loss', 'analytics', 'location', 'level-4'],
  },
  {
    name: 'Territory Performance Report',
    code: 'SALES_TERRITORY_PERFORMANCE',
    description: 'Analyze sales performance by geographic territory including coverage and penetration',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.territory.view_location'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        t.id as territory_id,
        t.name as territory_name,
        u.first_name || ' ' || u.last_name as rep_assigned,
        COUNT(DISTINCT c.id) as customer_count,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue,
        SUM(op.amount) FILTER (WHERE op.stage NOT IN ('Closed Won', 'Closed Lost')) as pipeline_value,
        (SUM(op.amount) FILTER (WHERE op.stage NOT IN ('Closed Won', 'Closed Lost')) / NULLIF(q.quota_amount, 0) * 100) as pipeline_coverage,
        t.market_potential,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(t.market_potential, 0) * 100) as market_penetration
      FROM territories t
      LEFT JOIN users u ON t.assigned_rep_id = u.id
      LEFT JOIN business_records c ON c.territory_id = t.id
      LEFT JOIN opportunities o ON o.territory_id = t.id
      LEFT JOIN opportunities op ON op.territory_id = t.id
      LEFT JOIN quotas q ON q.user_id = u.id
      WHERE t.location_id = :locationId
        AND t.tenant_id = :tenantId
      GROUP BY t.id, t.name, rep_assigned, t.market_potential, q.quota_amount
      ORDER BY revenue DESC
    `,
    tags: ['sales', 'territory', 'location', 'level-4'],
  },
  {
    name: 'Product Mix Report',
    code: 'SALES_PRODUCT_MIX',
    description: 'Sales breakdown by product category including units sold, ASP, margin, and attach rates',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.analytics.view_location'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        p.category as product_category,
        p.name as product_name,
        COUNT(ol.id) as units_sold,
        SUM(ol.amount) as revenue,
        AVG(ol.unit_price) as avg_selling_price,
        AVG(ol.margin_percentage) as avg_margin,
        COUNT(DISTINCT ol.bundle_id) / NULLIF(COUNT(DISTINCT ol.order_id), 0) * 100 as attach_rate
      FROM order_lines ol
      JOIN products p ON ol.product_id = p.id
      JOIN orders ord ON ol.order_id = ord.id
      WHERE ord.location_id = :locationId
        AND ord.tenant_id = :tenantId
        AND ord.order_date >= :dateFrom
        AND ord.order_date <= :dateTo
      GROUP BY p.category, p.name
      ORDER BY revenue DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    chartConfig: {
      pieChart: {
        type: 'pie',
        angleField: 'revenue',
        colorField: 'product_category',
      },
    },
    tags: ['sales', 'product-mix', 'analytics', 'location', 'level-4'],
  },

  // Level 5: Regional Sales Director Reports
  {
    name: 'Regional Sales Performance Report',
    code: 'SALES_REGIONAL_PERFORMANCE',
    description: 'Regional sales overview with location-by-location breakdown and comparative analysis',
    category: 'sales',
    organizationalScope: 'regional',
    requiredPermissions: ['sales.performance.view_regional'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, o.close_date) as period,
        loc.name as location_name,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue,
        SUM(q.quota_amount) as quota,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(SUM(q.quota_amount), 0) * 100) as quota_attainment,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') /
          NULLIF(COUNT(DISTINCT o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')), 0) * 100 as win_rate,
        AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))) FILTER (WHERE o.stage = 'Closed Won') as avg_sales_cycle
      FROM opportunities o
      JOIN organizational_units loc ON o.location_id = loc.id
      LEFT JOIN quotas q ON q.location_id = loc.id
      WHERE loc.region_id = :regionId
        AND loc.tenant_id = :tenantId
        AND o.close_date >= :dateFrom
        AND o.close_date <= :dateTo
      GROUP BY period, location_name
      ORDER BY period DESC, revenue DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'performance', 'regional', 'level-5'],
  },
  {
    name: 'Location Comparison Report',
    code: 'SALES_LOCATION_COMPARISON',
    description: 'Side-by-side comparison of key sales metrics across all locations in the region',
    category: 'sales',
    organizationalScope: 'regional',
    requiredPermissions: ['sales.performance.view_regional'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        loc.name as location_name,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue,
        SUM(q.quota_amount) as quota,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(SUM(q.quota_amount), 0) * 100) as quota_attainment,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') /
          NULLIF(COUNT(DISTINCT o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')), 0) * 100 as win_rate,
        SUM(op.amount) FILTER (WHERE op.stage NOT IN ('Closed Won', 'Closed Lost')) / NULLIF(SUM(q.quota_amount), 0) * 100 as pipeline_coverage,
        AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))) FILTER (WHERE o.stage = 'Closed Won') as avg_sales_cycle,
        AVG(o.amount) FILTER (WHERE o.stage = 'Closed Won') as avg_deal_size,
        COUNT(DISTINCT u.id) as rep_count,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(COUNT(DISTINCT u.id), 0) as revenue_per_rep
      FROM organizational_units loc
      LEFT JOIN opportunities o ON o.location_id = loc.id
      LEFT JOIN opportunities op ON op.location_id = loc.id
      LEFT JOIN quotas q ON q.location_id = loc.id
      LEFT JOIN users u ON u.location_id = loc.id AND u.role_code LIKE 'SALES_%'
      WHERE loc.region_id = :regionId
        AND loc.tenant_id = :tenantId
      GROUP BY loc.id, loc.name
      ORDER BY revenue DESC
    `,
    tags: ['sales', 'comparison', 'regional', 'level-5'],
  },
  {
    name: 'Regional Forecasting Report',
    code: 'SALES_REGIONAL_FORECASTING',
    description: 'Consolidated regional forecast with location-level forecast accuracy tracking',
    category: 'sales',
    organizationalScope: 'regional',
    requiredPermissions: ['sales.forecast.view_regional'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    queryTimeout: 60,
    sqlQuery: `
      SELECT
        DATE_TRUNC('month', o.expected_close_date) as forecast_month,
        loc.name as location_name,
        SUM(o.weighted_amount) as location_forecast,
        SUM(q.quota_amount) as location_quota,
        (SUM(o.weighted_amount) / NULLIF(SUM(q.quota_amount), 0) * 100) as forecast_vs_quota,
        fa.forecast_amount as historical_forecast,
        fa.actual_amount as historical_actual,
        (ABS(fa.forecast_amount - fa.actual_amount) / NULLIF(fa.forecast_amount, 0) * 100) as forecast_accuracy
      FROM opportunities o
      JOIN organizational_units loc ON o.location_id = loc.id
      LEFT JOIN quotas q ON q.location_id = loc.id
      LEFT JOIN forecast_accuracy fa ON fa.location_id = loc.id
        AND DATE_TRUNC('month', fa.forecast_date) = DATE_TRUNC('month', o.expected_close_date)
      WHERE loc.region_id = :regionId
        AND loc.tenant_id = :tenantId
        AND o.stage NOT IN ('Closed Won', 'Closed Lost')
        AND o.expected_close_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months'
      GROUP BY forecast_month, location_name, fa.forecast_amount, fa.actual_amount
      ORDER BY forecast_month, location_forecast DESC
    `,
    tags: ['sales', 'forecasting', 'regional', 'level-5'],
  },
  {
    name: 'Market Share Analysis Report',
    code: 'SALES_MARKET_SHARE_ANALYSIS',
    description: 'Regional market share analysis with competitive intelligence and trend tracking',
    category: 'sales',
    organizationalScope: 'regional',
    requiredPermissions: ['sales.analytics.view_regional'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, ms.analysis_date) as period,
        loc.name as location_name,
        ms.estimated_market_size,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as company_revenue,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(ms.estimated_market_size, 0) * 100) as market_share,
        ms.competitor_name,
        ms.competitor_market_share
      FROM market_share_data ms
      JOIN organizational_units loc ON ms.location_id = loc.id
      LEFT JOIN opportunities o ON o.location_id = loc.id
      WHERE loc.region_id = :regionId
        AND loc.tenant_id = :tenantId
        AND ms.analysis_date >= :dateFrom
        AND ms.analysis_date <= :dateTo
      GROUP BY period, location_name, ms.estimated_market_size, ms.competitor_name, ms.competitor_market_share
      ORDER BY period DESC, market_share DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'market-share', 'analytics', 'regional', 'level-5'],
  },

  // Level 6: VP Sales / Sales Director Reports
  {
    name: 'Executive Sales Dashboard',
    code: 'SALES_EXECUTIVE_DASHBOARD',
    description: 'Company-wide sales overview with KPIs, trends, and regional breakdown for executive leadership',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['sales.performance.view_company', 'executive.dashboard.view'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, o.close_date) as period,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue,
        SUM(q.quota_amount) as company_quota,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(SUM(q.quota_amount), 0) * 100) as quota_attainment,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') /
          NULLIF(COUNT(DISTINCT o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')), 0) * 100 as company_win_rate,
        SUM(op.amount) FILTER (WHERE op.stage NOT IN ('Closed Won', 'Closed Lost')) / NULLIF(SUM(q.quota_amount), 0) * 100 as pipeline_coverage,
        COUNT(DISTINCT u.id) as sales_headcount,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(COUNT(DISTINCT u.id), 0) as revenue_per_rep
      FROM opportunities o
      LEFT JOIN opportunities op ON op.tenant_id = o.tenant_id
      LEFT JOIN quotas q ON q.tenant_id = o.tenant_id
      LEFT JOIN users u ON u.tenant_id = o.tenant_id AND u.role_code LIKE 'SALES_%'
      WHERE o.tenant_id = :tenantId
        AND o.close_date >= :dateFrom
        AND o.close_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'executive', 'dashboard', 'company', 'level-6'],
  },
  {
    name: 'Company-Wide Sales Analytics Report',
    code: 'SALES_COMPANY_ANALYTICS',
    description: 'Deep analytics across all dimensions: region, product, segment, with cohort and LTV analysis',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['sales.analytics.view_company', 'executive.analytics.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    queryTimeout: 90,
    sqlQuery: `
      SELECT
        reg.name as region_name,
        loc.name as location_name,
        p.category as product_category,
        c.segment as customer_segment,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') as deals_won,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue,
        AVG(o.amount) FILTER (WHERE o.stage = 'Closed Won') as avg_deal_size,
        AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))) FILTER (WHERE o.stage = 'Closed Won') as avg_sales_cycle_days,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') /
          NULLIF(COUNT(DISTINCT o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')), 0) * 100 as conversion_rate,
        SUM(o.amount * 12) FILTER (WHERE o.is_recurring = true) as arr_from_deals,
        AVG(c.customer_lifetime_value) as avg_ltv
      FROM opportunities o
      LEFT JOIN organizational_units loc ON o.location_id = loc.id
      LEFT JOIN organizational_units reg ON loc.region_id = reg.id
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN business_records c ON o.customer_id = c.id
      WHERE o.tenant_id = :tenantId
        AND o.close_date >= :dateFrom
        AND o.close_date <= :dateTo
      GROUP BY ROLLUP(reg.name, loc.name, p.category, c.segment)
      ORDER BY revenue DESC NULLS LAST
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'analytics', 'executive', 'company', 'level-6'],
  },
  {
    name: 'Sales Team Effectiveness Report',
    code: 'SALES_TEAM_EFFECTIVENESS',
    description: 'Analyze sales team productivity, quota distribution, ramp time, and attrition patterns',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['sales.performance.view_company', 'hr.analytics.view'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        u.role_code,
        COUNT(DISTINCT u.id) as rep_count,
        AVG(rev.total_revenue) as avg_revenue_per_rep,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rev.total_revenue) as median_revenue_per_rep,
        COUNT(DISTINCT u.id) FILTER (WHERE qa.quota_attainment >= 100) / NULLIF(COUNT(DISTINCT u.id), 0) * 100 as pct_hitting_quota,
        AVG(EXTRACT(DAY FROM (u.first_deal_date - u.hire_date))) as avg_ramp_time_days,
        COUNT(DISTINCT u.id) FILTER (WHERE u.termination_date IS NOT NULL) / NULLIF(COUNT(DISTINCT u.id), 0) * 100 as attrition_rate
      FROM users u
      LEFT JOIN LATERAL (
        SELECT SUM(o.amount) as total_revenue
        FROM opportunities o
        WHERE o.owner_id = u.id AND o.stage = 'Closed Won'
      ) rev ON true
      LEFT JOIN LATERAL (
        SELECT (SUM(o.amount) / NULLIF(q.quota_amount, 0) * 100) as quota_attainment
        FROM opportunities o
        JOIN quotas q ON q.user_id = u.id
        WHERE o.owner_id = u.id AND o.stage = 'Closed Won'
      ) qa ON true
      WHERE u.tenant_id = :tenantId
        AND u.role_code LIKE 'SALES_%'
      GROUP BY u.role_code
      ORDER BY u.role_code
    `,
    tags: ['sales', 'effectiveness', 'hr', 'executive', 'company', 'level-6'],
  },
  {
    name: 'Strategic Account Report',
    code: 'SALES_STRATEGIC_ACCOUNTS',
    description: 'Monitor strategic accounts with revenue trends, health scores, and expansion opportunities',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['sales.strategic_accounts.view_company'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        c.id as account_id,
        c.name as account_name,
        c.account_owner,
        c.is_strategic_account,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= CURRENT_DATE - INTERVAL '12 months') as revenue_12m,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= CURRENT_DATE - INTERVAL '24 months' AND o.close_date < CURRENT_DATE - INTERVAL '12 months') as revenue_prev_12m,
        ((SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= CURRENT_DATE - INTERVAL '12 months') -
          SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= CURRENT_DATE - INTERVAL '24 months' AND o.close_date < CURRENT_DATE - INTERVAL '12 months')) /
          NULLIF(SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= CURRENT_DATE - INTERVAL '24 months' AND o.close_date < CURRENT_DATE - INTERVAL '12 months'), 0) * 100) as revenue_growth_pct,
        COUNT(DISTINCT p.category) as product_categories_purchased,
        c.health_score,
        c.next_renewal_date,
        COUNT(DISTINCT op.id) FILTER (WHERE op.stage NOT IN ('Closed Won', 'Closed Lost') AND op.opportunity_type = 'Expansion') as expansion_opportunities,
        c.risk_level
      FROM business_records c
      LEFT JOIN opportunities o ON o.customer_id = c.id
      LEFT JOIN opportunities op ON op.customer_id = c.id
      LEFT JOIN products p ON o.product_id = p.id
      WHERE c.tenant_id = :tenantId
        AND c.is_strategic_account = true
      GROUP BY c.id, c.name, c.account_owner, c.is_strategic_account, c.health_score, c.next_renewal_date, c.risk_level
      ORDER BY revenue_12m DESC
    `,
    tags: ['sales', 'strategic-accounts', 'executive', 'company', 'level-6'],
  },
  {
    name: 'Board-Level Sales Report',
    code: 'SALES_BOARD_REPORT',
    description: 'Executive summary for board meetings with strategic metrics and key wins/losses',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.board_reports.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        DATE_TRUNC('month', o.close_date) as period,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue,
        SUM(q.quota_amount) as plan,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(SUM(q.quota_amount), 0) * 100) as revenue_vs_plan,
        COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as new_customers,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'Active') / NULLIF(COUNT(DISTINCT c.id), 0) * 100 as customer_retention_rate,
        AVG(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.contract_type = 'New') as avg_new_contract_value,
        SUM(sm.sales_expense + sm.marketing_expense) as sales_marketing_expense,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(SUM(sm.sales_expense + sm.marketing_expense), 0)) as sales_efficiency_ratio
      FROM opportunities o
      LEFT JOIN quotas q ON q.tenant_id = o.tenant_id
      LEFT JOIN business_records c ON o.customer_id = c.id
      LEFT JOIN sales_marketing_expenses sm ON sm.tenant_id = o.tenant_id AND DATE_TRUNC('month', sm.expense_date) = DATE_TRUNC('month', o.close_date)
      WHERE o.tenant_id = :tenantId
        AND o.close_date >= :dateFrom
        AND o.close_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['sales', 'board', 'executive', 'company', 'level-6', 'level-7', 'sensitive'],
  },
];

// =====================================================================
// SERVICE REPORTS (19 reports)
// =====================================================================

const SERVICE_REPORTS: ReportDefinition[] = [
  // Level 1: Field Technician Reports
  {
    name: 'Personal Productivity Report (Service)',
    code: 'SERVICE_PERSONAL_PRODUCTIVITY',
    description: 'Track your personal service metrics including tickets completed, FTF rate, and CSAT',
    category: 'service',
    organizationalScope: 'individual',
    requiredPermissions: ['service.ticket.view_own'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsExport: false,
    cacheDuration: 0,
    sqlQuery: `
      SELECT
        COUNT(t.id) FILTER (WHERE t.status = 'Completed' AND t.completed_date::date = CURRENT_DATE) as tickets_today,
        COUNT(t.id) FILTER (WHERE t.status = 'Completed' AND t.completed_date >= DATE_TRUNC('week', CURRENT_DATE)) as tickets_week,
        COUNT(t.id) FILTER (WHERE t.status = 'Completed' AND t.completed_date >= DATE_TRUNC('month', CURRENT_DATE)) as tickets_month,
        COUNT(wo.id) FILTER (WHERE wo.status = 'Completed' AND wo.completed_date >= DATE_TRUNC('month', CURRENT_DATE)) as work_orders_month,
        AVG(EXTRACT(EPOCH FROM (t.completed_date - t.started_date)) / 60) as avg_time_per_ticket_minutes,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as ftf_rate,
        AVG(sr.rating) as avg_csat_score,
        (SUM(t.billable_hours) / NULLIF(SUM(t.total_hours), 0) * 100) as utilization_rate
      FROM service_tickets t
      LEFT JOIN work_orders wo ON wo.technician_id = t.assigned_to
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      WHERE t.assigned_to = :userId
        AND t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
    },
    tags: ['service', 'productivity', 'personal', 'level-1'],
  },
  {
    name: 'Personal Schedule Report',
    code: 'SERVICE_PERSONAL_SCHEDULE',
    description: 'View your upcoming appointments, route, and daily schedule',
    category: 'service',
    organizationalScope: 'individual',
    requiredPermissions: ['service.schedule.view_own'],
    defaultVisualization: 'table',
    isRealTime: true,
    supportsExport: false,
    cacheDuration: 0,
    sqlQuery: `
      SELECT
        a.id,
        a.appointment_date,
        a.appointment_time_start,
        a.appointment_time_end,
        a.status,
        t.ticket_number,
        c.name as customer_name,
        c.address,
        a.estimated_duration_minutes,
        a.drive_time_minutes,
        a.appointment_type
      FROM service_appointments a
      JOIN service_tickets t ON a.ticket_id = t.id
      JOIN business_records c ON t.customer_id = c.id
      WHERE a.technician_id = :userId
        AND a.tenant_id = :tenantId
        AND a.appointment_date BETWEEN :dateFrom AND :dateTo
      ORDER BY a.appointment_date, a.appointment_time_start
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE`,
      dateTo: sql`CURRENT_DATE + INTERVAL '7 days'`,
    },
    tags: ['service', 'schedule', 'personal', 'level-1'],
  },
  {
    name: 'Personal Parts Usage Report',
    code: 'SERVICE_PERSONAL_PARTS_USAGE',
    description: 'Track parts used and associated costs for your service tickets',
    category: 'service',
    organizationalScope: 'individual',
    requiredPermissions: ['service.parts.view_own'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsExport: false,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, pu.usage_date) as period,
        COUNT(DISTINCT pu.id) as parts_used,
        SUM(pu.quantity * p.unit_cost) as total_parts_cost,
        AVG(pu.quantity * p.unit_cost) as avg_cost_per_ticket,
        COUNT(DISTINCT pr.id) / NULLIF(COUNT(DISTINCT pu.id), 0) * 100 as parts_return_rate
      FROM parts_usage pu
      JOIN parts p ON pu.part_id = p.id
      LEFT JOIN parts_returns pr ON pr.parts_usage_id = pu.id
      WHERE pu.technician_id = :userId
        AND pu.tenant_id = :tenantId
        AND pu.usage_date >= :dateFrom
        AND pu.usage_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'parts', 'personal', 'level-1'],
  },

  // Level 2: Senior Technician Reports
  {
    name: 'Team Workload Report (Service)',
    code: 'SERVICE_TEAM_WORKLOAD',
    description: 'View team workload distribution to help balance assignments',
    category: 'service',
    organizationalScope: 'team',
    requiredPermissions: ['service.ticket.view_team'],
    defaultVisualization: 'table',
    isRealTime: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        u.id as tech_id,
        u.first_name || ' ' || u.last_name as tech_name,
        COUNT(t.id) FILTER (WHERE t.status NOT IN ('Completed', 'Cancelled')) as open_tickets,
        COUNT(a.id) FILTER (WHERE a.appointment_date = CURRENT_DATE) as appointments_today,
        (SUM(t.billable_hours) / NULLIF(SUM(t.total_hours), 0) * 100) as utilization_rate,
        COUNT(t.id) FILTER (WHERE t.sla_status = 'Breached') as sla_breaches
      FROM users u
      LEFT JOIN service_tickets t ON t.assigned_to = u.id AND t.tenant_id = :tenantId
      LEFT JOIN service_appointments a ON a.technician_id = u.id AND a.tenant_id = :tenantId
      WHERE u.tenant_id = :tenantId
        AND u.role_code LIKE 'SERVICE_%'
        AND u.team_id = :teamId
      GROUP BY u.id, tech_name
      ORDER BY open_tickets DESC
    `,
    tags: ['service', 'workload', 'team', 'level-2'],
  },

  // Level 3: Service Supervisor Reports
  {
    name: 'Team Productivity Report (Service)',
    code: 'SERVICE_TEAM_PRODUCTIVITY',
    description: 'Monitor team service metrics including completion rates, FTF, CSAT, and response times',
    category: 'service',
    organizationalScope: 'team',
    requiredPermissions: ['service.performance.view_team'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        u.first_name || ' ' || u.last_name as tech_name,
        COUNT(t.id) FILTER (WHERE t.status = 'Completed') as tickets_completed,
        (COUNT(t.id) FILTER (WHERE t.status = 'Completed') / NULLIF(COUNT(DISTINCT u.id), 0)) as avg_tickets_per_tech,
        (SUM(t.billable_hours) / NULLIF(SUM(t.total_hours), 0) * 100) as team_utilization,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as ftf_rate,
        AVG(sr.rating) as avg_csat,
        AVG(EXTRACT(EPOCH FROM (t.first_response_date - t.created_at)) / 3600) as avg_response_hours,
        AVG(EXTRACT(EPOCH FROM (t.completed_date - t.created_at)) / 3600) as avg_resolution_hours
      FROM users u
      LEFT JOIN service_tickets t ON t.assigned_to = u.id
        AND t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
      GROUP BY u.id, tech_name
      ORDER BY tech_name
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'productivity', 'team', 'level-3'],
  },
  {
    name: 'SLA Compliance Report',
    code: 'SERVICE_SLA_COMPLIANCE',
    description: 'Track SLA compliance by priority, technician, and customer segment',
    category: 'service',
    organizationalScope: 'team',
    requiredPermissions: ['service.sla.view_team'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        t.priority,
        u.first_name || ' ' || u.last_name as tech_name,
        c.segment as customer_segment,
        COUNT(t.id) as total_tickets,
        COUNT(t.id) FILTER (WHERE t.sla_status = 'Within SLA') / NULLIF(COUNT(t.id), 0) * 100 as sla_compliance_pct,
        COUNT(t.id) FILTER (WHERE t.sla_status = 'Breached') as breached_tickets,
        AVG(EXTRACT(EPOCH FROM (t.first_response_date - t.created_at)) / 3600) as avg_response_hours,
        AVG(EXTRACT(EPOCH FROM (t.completed_date - t.created_at)) / 3600) as avg_resolution_hours,
        sla.response_time_hours as sla_response_target,
        sla.resolution_time_hours as sla_resolution_target
      FROM service_tickets t
      JOIN users u ON t.assigned_to = u.id
      JOIN business_records c ON t.customer_id = c.id
      JOIN sla_definitions sla ON sla.priority = t.priority AND sla.customer_segment = c.segment
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
        AND t.created_at >= :dateFrom
        AND t.created_at <= :dateTo
      GROUP BY t.priority, tech_name, customer_segment, sla.response_time_hours, sla.resolution_time_hours
      ORDER BY breached_tickets DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'sla', 'compliance', 'team', 'level-3'],
  },
  {
    name: 'Dispatch Efficiency Report',
    code: 'SERVICE_DISPATCH_EFFICIENCY',
    description: 'Analyze dispatch performance including assignment times, routing, and emergency response',
    category: 'service',
    organizationalScope: 'team',
    requiredPermissions: ['service.dispatch.view_team'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, t.created_at) as period,
        COUNT(t.id) as tickets_assigned,
        AVG(EXTRACT(EPOCH FROM (t.assigned_date - t.created_at)) / 60) as avg_assignment_minutes,
        STDDEV(EXTRACT(EPOCH FROM (t.assigned_date - t.created_at)) / 60) as assignment_time_variance,
        COUNT(DISTINCT t.assigned_to) as techs_utilized,
        AVG(dr.total_drive_time_minutes) as avg_drive_time,
        AVG(dr.total_service_time_minutes) as avg_service_time,
        (AVG(dr.total_service_time_minutes) / NULLIF(AVG(dr.total_drive_time_minutes), 0)) as service_to_drive_ratio,
        COUNT(t.id) FILTER (WHERE t.priority = 'Emergency') as emergency_tickets,
        AVG(EXTRACT(EPOCH FROM (t.first_response_date - t.created_at)) / 60) FILTER (WHERE t.priority = 'Emergency') as avg_emergency_response_minutes
      FROM service_tickets t
      LEFT JOIN dispatch_routes dr ON dr.ticket_id = t.id
      WHERE t.team_id = :teamId
        AND t.tenant_id = :tenantId
        AND t.created_at >= :dateFrom
        AND t.created_at <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'week',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 weeks'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'dispatch', 'efficiency', 'team', 'level-3'],
  },

  // Level 4: Service Manager Reports
  {
    name: 'Location Service Performance Report',
    code: 'SERVICE_LOCATION_PERFORMANCE',
    description: 'Complete location service overview including volume, revenue, costs, and quality metrics',
    category: 'service',
    organizationalScope: 'location',
    requiredPermissions: ['service.performance.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, t.completed_date) as period,
        COUNT(t.id) as total_tickets,
        COUNT(t.id) FILTER (WHERE t.ticket_type = 'Warranty') as warranty_tickets,
        COUNT(t.id) FILTER (WHERE t.ticket_type = 'Billable') as billable_tickets,
        COUNT(t.id) FILTER (WHERE t.ticket_type = 'PM') as pm_tickets,
        SUM(t.billable_amount) as service_revenue,
        SUM(t.labor_cost + t.parts_cost) as service_costs,
        (SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost)) as service_profit,
        ((SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost)) / NULLIF(SUM(t.billable_amount), 0) * 100) as service_margin_pct,
        COUNT(t.id) FILTER (WHERE t.sla_status = 'Within SLA') / NULLIF(COUNT(t.id), 0) * 100 as sla_compliance,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as ftf_rate,
        AVG(sr.rating) as avg_csat
      FROM service_tickets t
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      WHERE t.location_id = :locationId
        AND t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'performance', 'location', 'level-4'],
  },
  {
    name: 'Technician Performance Report',
    code: 'SERVICE_TECHNICIAN_PERFORMANCE',
    description: 'Detailed technician scorecard with FTF, CSAT, utilization, efficiency, and revenue metrics',
    category: 'service',
    organizationalScope: 'location',
    requiredPermissions: ['service.performance.view_location'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        u.id as tech_id,
        u.first_name || ' ' || u.last_name as tech_name,
        COUNT(t.id) FILTER (WHERE t.status = 'Completed') as tickets_completed,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as ftf_rate,
        AVG(sr.rating) as avg_csat,
        (SUM(t.billable_hours) / NULLIF(SUM(t.total_hours), 0) * 100) as utilization_rate,
        AVG(EXTRACT(EPOCH FROM (t.completed_date - t.started_date)) / 60) as avg_ticket_time_minutes,
        (SUM(pu.quantity * p.unit_cost) / NULLIF(COUNT(t.id), 0)) as avg_parts_cost_per_ticket,
        SUM(t.billable_amount) as billable_revenue_generated,
        STRING_AGG(DISTINCT cert.certification_name, ', ') as certifications
      FROM users u
      LEFT JOIN service_tickets t ON t.assigned_to = u.id
        AND t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      LEFT JOIN parts_usage pu ON pu.ticket_id = t.id
      LEFT JOIN parts p ON pu.part_id = p.id
      LEFT JOIN technician_certifications cert ON cert.user_id = u.id
      WHERE u.location_id = :locationId
        AND u.tenant_id = :tenantId
        AND u.role_code LIKE 'SERVICE_%'
      GROUP BY u.id, tech_name
      ORDER BY tickets_completed DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '3 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'technician', 'performance', 'location', 'level-4'],
  },
  {
    name: 'Service Profitability Report',
    code: 'SERVICE_PROFITABILITY',
    description: 'Analyze service profitability by customer, service type, and technician',
    category: 'service',
    organizationalScope: 'location',
    requiredPermissions: ['service.financials.view_location', 'finance.profitability.view'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        c.name as customer_name,
        t.ticket_type,
        u.first_name || ' ' || u.last_name as tech_name,
        COUNT(t.id) as ticket_count,
        SUM(t.billable_amount) as service_revenue,
        SUM(t.labor_cost) as labor_costs,
        SUM(t.parts_cost) as parts_costs,
        SUM(t.overhead_allocation) as overhead_costs,
        (SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost + t.overhead_allocation)) as gross_profit,
        ((SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost + t.overhead_allocation)) / NULLIF(SUM(t.billable_amount), 0) * 100) as gross_margin_pct
      FROM service_tickets t
      JOIN business_records c ON t.customer_id = c.id
      JOIN users u ON t.assigned_to = u.id
      WHERE t.location_id = :locationId
        AND t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      GROUP BY CUBE(c.name, t.ticket_type, tech_name)
      ORDER BY gross_profit DESC NULLS LAST
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'profitability', 'finance', 'location', 'level-4', 'sensitive'],
  },
  {
    name: 'Equipment Health Report',
    code: 'SERVICE_EQUIPMENT_HEALTH',
    description: 'Monitor equipment uptime, service frequency, preventive maintenance, and at-risk devices',
    category: 'service',
    organizationalScope: 'location',
    requiredPermissions: ['service.equipment.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        e.id as equipment_id,
        e.serial_number,
        e.model_name,
        c.name as customer_name,
        e.warranty_status,
        (SUM(EXTRACT(EPOCH FROM (t.completed_date - t.created_at)) / 3600) / NULLIF(24 * 365, 0) * 100) as uptime_pct,
        COUNT(t.id) FILTER (WHERE t.created_at >= CURRENT_DATE - INTERVAL '90 days') as recent_service_calls,
        MAX(pm.next_pm_date) as next_pm_due,
        CASE
          WHEN COUNT(t.id) FILTER (WHERE t.created_at >= CURRENT_DATE - INTERVAL '90 days') >= 5 THEN true
          ELSE false
        END as is_at_risk
      FROM equipment e
      LEFT JOIN service_tickets t ON t.equipment_id = e.id
      LEFT JOIN business_records c ON e.customer_id = c.id
      LEFT JOIN preventive_maintenance pm ON pm.equipment_id = e.id
      WHERE e.location_id = :locationId
        AND e.tenant_id = :tenantId
      GROUP BY e.id, e.serial_number, e.model_name, c.name, e.warranty_status
      ORDER BY recent_service_calls DESC
    `,
    tags: ['service', 'equipment', 'health', 'location', 'level-4'],
  },
  {
    name: 'Parts Usage & Cost Report',
    code: 'SERVICE_PARTS_USAGE_COST',
    description: 'Track parts consumption, costs, returns, and efficiency by technician and customer',
    category: 'service',
    organizationalScope: 'location',
    requiredPermissions: ['service.parts.view_location'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, pu.usage_date) as period,
        u.first_name || ' ' || u.last_name as tech_name,
        c.name as customer_name,
        p.part_number,
        p.description as part_description,
        p.category as part_category,
        SUM(pu.quantity) as total_quantity_used,
        SUM(pu.quantity * p.unit_cost) as total_parts_cost,
        COUNT(DISTINCT t.id) as tickets_using_part,
        (SUM(pu.quantity * p.unit_cost) / NULLIF(COUNT(DISTINCT t.id), 0)) as avg_cost_per_ticket,
        COUNT(DISTINCT pr.id) / NULLIF(COUNT(DISTINCT pu.id), 0) * 100 as parts_return_rate,
        COUNT(DISTINCT pu.id) FILTER (WHERE pu.is_warranty_part = true) / NULLIF(COUNT(DISTINCT pu.id), 0) * 100 as warranty_parts_pct
      FROM parts_usage pu
      JOIN parts p ON pu.part_id = p.id
      JOIN service_tickets t ON pu.ticket_id = t.id
      JOIN users u ON pu.technician_id = u.id
      JOIN business_records c ON t.customer_id = c.id
      LEFT JOIN parts_returns pr ON pr.parts_usage_id = pu.id
      WHERE pu.location_id = :locationId
        AND pu.tenant_id = :tenantId
        AND pu.usage_date >= :dateFrom
        AND pu.usage_date <= :dateTo
      GROUP BY CUBE(period, tech_name, customer_name, p.part_number, p.description, p.category)
      ORDER BY total_parts_cost DESC NULLS LAST
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'parts', 'cost', 'location', 'level-4'],
  },

  // Level 5: Regional Service Manager Reports
  {
    name: 'Regional Service Performance Report',
    code: 'SERVICE_REGIONAL_PERFORMANCE',
    description: 'Regional service overview with location-by-location breakdown and benchmarking',
    category: 'service',
    organizationalScope: 'regional',
    requiredPermissions: ['service.performance.view_regional'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, t.completed_date) as period,
        loc.name as location_name,
        COUNT(t.id) as total_tickets,
        SUM(t.billable_amount) as service_revenue,
        (SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost)) as service_profit,
        ((SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost)) / NULLIF(SUM(t.billable_amount), 0) * 100) as service_margin_pct,
        COUNT(t.id) FILTER (WHERE t.sla_status = 'Within SLA') / NULLIF(COUNT(t.id), 0) * 100 as sla_compliance,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as ftf_rate,
        AVG(sr.rating) as avg_csat
      FROM service_tickets t
      JOIN organizational_units loc ON t.location_id = loc.id
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      WHERE loc.region_id = :regionId
        AND loc.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      GROUP BY period, location_name
      ORDER BY period DESC, service_revenue DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'performance', 'regional', 'level-5'],
  },
  {
    name: 'Location Comparison Report (Service)',
    code: 'SERVICE_LOCATION_COMPARISON',
    description: 'Side-by-side comparison of service KPIs across all locations in the region',
    category: 'service',
    organizationalScope: 'regional',
    requiredPermissions: ['service.performance.view_regional'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        loc.name as location_name,
        COUNT(t.id) as ticket_volume,
        COUNT(t.id) FILTER (WHERE t.sla_status = 'Within SLA') / NULLIF(COUNT(t.id), 0) * 100 as sla_compliance,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as ftf_rate,
        AVG(sr.rating) as avg_csat,
        (SUM(t.billable_hours) / NULLIF(SUM(t.total_hours), 0) * 100) as utilization_rate,
        ((SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost)) / NULLIF(SUM(t.billable_amount), 0) * 100) as service_margin_pct,
        COUNT(DISTINCT u.id) as technician_count,
        (COUNT(t.id) / NULLIF(COUNT(DISTINCT u.id), 0)) as tickets_per_technician
      FROM organizational_units loc
      LEFT JOIN service_tickets t ON t.location_id = loc.id
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      LEFT JOIN users u ON u.location_id = loc.id AND u.role_code LIKE 'SERVICE_%'
      WHERE loc.region_id = :regionId
        AND loc.tenant_id = :tenantId
      GROUP BY loc.id, loc.name
      ORDER BY ticket_volume DESC
    `,
    tags: ['service', 'comparison', 'regional', 'level-5'],
  },
  {
    name: 'Regional Capacity Planning Report',
    code: 'SERVICE_REGIONAL_CAPACITY_PLANNING',
    description: 'Forecast service capacity needs based on utilization, backlog, and ticket trends',
    category: 'service',
    organizationalScope: 'regional',
    requiredPermissions: ['service.planning.view_regional', 'hr.planning.view'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        loc.name as location_name,
        COUNT(DISTINCT u.id) as current_technicians,
        AVG(util.utilization_rate) as avg_utilization_rate,
        COUNT(t.id) FILTER (WHERE t.status IN ('Open', 'Assigned')) as current_backlog,
        AVG(ticket_forecast.forecasted_volume) as forecasted_monthly_tickets,
        CEIL((AVG(ticket_forecast.forecasted_volume) - (COUNT(DISTINCT u.id) * 100)) / 100.0) as hiring_need,
        SUM(u.overtime_hours) as total_overtime_hours,
        (COUNT(t.id) FILTER (WHERE t.status IN ('Open', 'Assigned')) -
         (COUNT(DISTINCT u.id) * 20)) as backlog_vs_capacity
      FROM organizational_units loc
      LEFT JOIN users u ON u.location_id = loc.id AND u.role_code LIKE 'SERVICE_%'
      LEFT JOIN service_tickets t ON t.location_id = loc.id
      LEFT JOIN LATERAL (
        SELECT (SUM(billable_hours) / NULLIF(SUM(total_hours), 0) * 100) as utilization_rate
        FROM service_tickets st
        WHERE st.assigned_to = u.id
      ) util ON true
      LEFT JOIN LATERAL (
        SELECT AVG(monthly_count) as forecasted_volume
        FROM (
          SELECT COUNT(st.id) as monthly_count
          FROM service_tickets st
          WHERE st.location_id = loc.id
            AND st.created_at >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', st.created_at)
        ) historical
      ) ticket_forecast ON true
      WHERE loc.region_id = :regionId
        AND loc.tenant_id = :tenantId
      GROUP BY loc.id, loc.name
      ORDER BY hiring_need DESC NULLS LAST
    `,
    tags: ['service', 'capacity-planning', 'hr', 'regional', 'level-5'],
  },

  // Level 6: VP Service / Service Director Reports
  {
    name: 'Executive Service Dashboard',
    code: 'SERVICE_EXECUTIVE_DASHBOARD',
    description: 'Company-wide service overview with KPIs, trends, and profitability for executive leadership',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['service.performance.view_company', 'executive.dashboard.view'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, t.completed_date) as period,
        COUNT(t.id) as company_ticket_volume,
        SUM(t.billable_amount) as company_service_revenue,
        (SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost + t.overhead_allocation)) as company_service_profit,
        ((SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost + t.overhead_allocation)) / NULLIF(SUM(t.billable_amount), 0) * 100) as company_service_margin,
        COUNT(t.id) FILTER (WHERE t.sla_status = 'Within SLA') / NULLIF(COUNT(t.id), 0) * 100 as company_sla_compliance,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as company_ftf_rate,
        AVG(sr.rating) as company_avg_csat,
        COUNT(DISTINCT u.id) as total_technicians
      FROM service_tickets t
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      LEFT JOIN users u ON u.tenant_id = t.tenant_id AND u.role_code LIKE 'SERVICE_%'
      WHERE t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'executive', 'dashboard', 'company', 'level-6'],
  },
  {
    name: 'Company-Wide Service Analytics Report',
    code: 'SERVICE_COMPANY_ANALYTICS',
    description: 'Deep service analytics with segment analysis, demand forecasting, and churn correlation',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['service.analytics.view_company', 'executive.analytics.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    queryTimeout: 90,
    sqlQuery: `
      SELECT
        reg.name as region_name,
        loc.name as location_name,
        t.ticket_type,
        c.segment as customer_segment,
        e.equipment_category,
        COUNT(t.id) as ticket_count,
        AVG(EXTRACT(EPOCH FROM (t.completed_date - t.created_at)) / 3600) as avg_resolution_hours,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as ftf_rate,
        AVG((pu.quantity * p.unit_cost)) as avg_parts_cost,
        forecast.predicted_volume as forecasted_next_month_tickets,
        churn.churn_correlation as service_quality_churn_correlation
      FROM service_tickets t
      LEFT JOIN organizational_units loc ON t.location_id = loc.id
      LEFT JOIN organizational_units reg ON loc.region_id = reg.id
      LEFT JOIN business_records c ON t.customer_id = c.id
      LEFT JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN parts_usage pu ON pu.ticket_id = t.id
      LEFT JOIN parts p ON pu.part_id = p.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) * 1.1 as predicted_volume
        FROM service_tickets st
        WHERE st.location_id = loc.id
          AND st.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ) forecast ON true
      LEFT JOIN LATERAL (
        SELECT CORR(
          CASE WHEN c2.status = 'Churned' THEN 1 ELSE 0 END,
          COALESCE(sr.rating, 3)
        ) as churn_correlation
        FROM business_records c2
        LEFT JOIN service_tickets st ON st.customer_id = c2.id
        LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = st.id
        WHERE c2.location_id = loc.id
      ) churn ON true
      WHERE t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      GROUP BY ROLLUP(reg.name, loc.name, t.ticket_type, c.segment, e.equipment_category), forecast.predicted_volume, churn.churn_correlation
      ORDER BY ticket_count DESC NULLS LAST
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'analytics', 'executive', 'company', 'level-6'],
  },
  {
    name: 'Service Quality Report',
    code: 'SERVICE_QUALITY_REPORT',
    description: 'Comprehensive quality analysis including FTF, CSAT, repeat tickets, escalations, and root causes',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['service.quality.view_company', 'executive.quality.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, t.completed_date) as period,
        reg.name as region_name,
        loc.name as location_name,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100 as ftf_rate_location,
        AVG(sr.rating) as avg_csat,
        COUNT(DISTINCT rt.original_ticket_id) / NULLIF(COUNT(DISTINCT t.id), 0) * 100 as repeat_ticket_rate,
        COUNT(t.id) FILTER (WHERE t.escalated = true) / NULLIF(COUNT(t.id), 0) * 100 as escalation_rate,
        COUNT(comp.id) as complaint_volume,
        u.experience_level,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true AND u.experience_level = 'Junior') /
          NULLIF(COUNT(t.id) FILTER (WHERE u.experience_level = 'Junior'), 0) * 100 as ftf_rate_junior_techs,
        COUNT(t.id) FILTER (WHERE t.first_time_fix = true AND u.experience_level = 'Senior') /
          NULLIF(COUNT(t.id) FILTER (WHERE u.experience_level = 'Senior'), 0) * 100 as ftf_rate_senior_techs
      FROM service_tickets t
      LEFT JOIN organizational_units loc ON t.location_id = loc.id
      LEFT JOIN organizational_units reg ON loc.region_id = reg.id
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      LEFT JOIN repeat_tickets rt ON rt.repeat_ticket_id = t.id
      LEFT JOIN complaints comp ON comp.ticket_id = t.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      GROUP BY period, reg.name, loc.name, u.experience_level
      ORDER BY period DESC, complaint_volume DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'quality', 'executive', 'company', 'level-6'],
  },
  {
    name: 'Board-Level Service Report',
    code: 'SERVICE_BOARD_REPORT',
    description: 'Executive summary for board meetings with strategic service metrics and efficiency ratios',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.board_reports.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        DATE_TRUNC('month', t.completed_date) as period,
        SUM(t.billable_amount) as service_revenue,
        (SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost + t.overhead_allocation)) as service_profit,
        ((SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost + t.overhead_allocation)) / NULLIF(SUM(t.billable_amount), 0) * 100) as service_margin,
        COUNT(t.id) FILTER (WHERE t.sla_status = 'Within SLA') / NULLIF(COUNT(t.id), 0) * 100 as sla_compliance,
        AVG(sr.rating) as customer_satisfaction,
        (SUM(t.billable_amount) / NULLIF(SUM(t.labor_cost), 0)) as service_efficiency_ratio,
        COUNT(DISTINCT u.id) as technician_headcount,
        (COUNT(DISTINCT u.id) - LAG(COUNT(DISTINCT u.id)) OVER (ORDER BY DATE_TRUNC('month', t.completed_date))) as headcount_change,
        (SUM(t.total_hours) / NULLIF(COUNT(DISTINCT u.id), 0)) as service_capacity_hours_per_tech
      FROM service_tickets t
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      LEFT JOIN users u ON u.tenant_id = t.tenant_id AND u.role_code LIKE 'SERVICE_%'
      WHERE t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
        AND t.completed_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['service', 'board', 'executive', 'company', 'level-6', 'level-7', 'sensitive'],
  },
];

// =====================================================================
// OPERATIONS REPORTS (11 reports)
// =====================================================================

const OPERATIONS_REPORTS: ReportDefinition[] = [
  // Level 1: Warehouse Associate Reports
  {
    name: 'Personal Productivity Report (Warehouse)',
    code: 'OPS_PERSONAL_PRODUCTIVITY',
    description: 'Track your daily warehouse productivity including items received, picked, packed, and accuracy',
    category: 'operations',
    organizationalScope: 'individual',
    requiredPermissions: ['operations.inventory.view_own'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsExport: false,
    cacheDuration: 0,
    sqlQuery: `
      SELECT
        COUNT(ir.id) FILTER (WHERE ir.received_date::date = CURRENT_DATE) as items_received_today,
        COUNT(pick.id) FILTER (WHERE pick.picked_date >= DATE_TRUNC('day', CURRENT_DATE)) as items_picked_today,
        COUNT(pack.id) FILTER (WHERE pack.packed_date >= DATE_TRUNC('day', CURRENT_DATE)) as orders_packed_today,
        COUNT(cc.id) FILTER (WHERE cc.count_date >= DATE_TRUNC('month', CURRENT_DATE)) as cycle_counts_completed,
        (COUNT(cc.id) FILTER (WHERE cc.is_accurate = true) / NULLIF(COUNT(cc.id), 0) * 100) as accuracy_rate,
        (COUNT(pick.id) / NULLIF(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - DATE_TRUNC('day', CURRENT_DATE))) / 3600, 0)) as productivity_units_per_hour
      FROM users u
      LEFT JOIN inventory_receipts ir ON ir.received_by = u.id AND ir.tenant_id = :tenantId
      LEFT JOIN pick_tickets pick ON pick.picked_by = u.id AND pick.tenant_id = :tenantId
      LEFT JOIN pack_orders pack ON pack.packed_by = u.id AND pack.tenant_id = :tenantId
      LEFT JOIN cycle_counts cc ON cc.counted_by = u.id AND cc.tenant_id = :tenantId
      WHERE u.id = :userId
        AND u.tenant_id = :tenantId
    `,
    tags: ['operations', 'productivity', 'warehouse', 'personal', 'level-1'],
  },

  // Level 3: Warehouse Supervisor Reports
  {
    name: 'Team Productivity Report (Warehouse)',
    code: 'OPS_TEAM_PRODUCTIVITY',
    description: 'Monitor warehouse team productivity, accuracy, and task completion by associate',
    category: 'operations',
    organizationalScope: 'team',
    requiredPermissions: ['operations.team.view'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        u.first_name || ' ' || u.last_name as associate_name,
        (COUNT(pick.id) / NULLIF(SUM(EXTRACT(EPOCH FROM (u.shift_end - u.shift_start)) / 3600), 0)) as productivity_units_per_hour,
        (COUNT(cc.id) FILTER (WHERE cc.is_accurate = true) / NULLIF(COUNT(cc.id), 0) * 100) as accuracy_rate,
        COUNT(ir.id) + COUNT(pick.id) + COUNT(pack.id) as total_tasks_completed,
        (COUNT(cc.id) FILTER (WHERE cc.is_accurate = true) / NULLIF(COUNT(cc.id), 0) * 100) as cycle_count_accuracy
      FROM users u
      LEFT JOIN inventory_receipts ir ON ir.received_by = u.id AND ir.received_date >= :dateFrom
      LEFT JOIN pick_tickets pick ON pick.picked_by = u.id AND pick.picked_date >= :dateFrom
      LEFT JOIN pack_orders pack ON pack.packed_by = u.id AND pack.packed_date >= :dateFrom
      LEFT JOIN cycle_counts cc ON cc.counted_by = u.id AND cc.count_date >= :dateFrom
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
        AND u.role_code LIKE 'WAREHOUSE_%'
      GROUP BY u.id, associate_name
      ORDER BY productivity_units_per_hour DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '7 days'`,
    },
    tags: ['operations', 'productivity', 'warehouse', 'team', 'level-3'],
  },
  {
    name: 'Inventory Accuracy Report',
    code: 'OPS_INVENTORY_ACCURACY',
    description: 'Track inventory accuracy, discrepancies, adjustments, and shrinkage by category',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.inventory.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        p.category as product_category,
        COUNT(cc.id) as cycle_counts_performed,
        (COUNT(cc.id) FILTER (WHERE cc.is_accurate = true) / NULLIF(COUNT(cc.id), 0) * 100) as overall_accuracy_pct,
        SUM(ABS(cc.system_quantity - cc.actual_quantity)) as total_discrepancies,
        COUNT(ia.id) as adjustments_made,
        SUM(ia.adjustment_value) as total_adjustment_value,
        (SUM(CASE WHEN ia.adjustment_type = 'Shrinkage' THEN ia.adjustment_value ELSE 0 END) /
          NULLIF(SUM(inv.total_inventory_value), 0) * 100) as shrinkage_rate
      FROM cycle_counts cc
      JOIN inventory inv ON cc.product_id = inv.product_id
      JOIN products p ON inv.product_id = p.id
      LEFT JOIN inventory_adjustments ia ON ia.product_id = p.id AND ia.location_id = cc.location_id
      WHERE cc.location_id = :locationId
        AND cc.tenant_id = :tenantId
        AND cc.count_date >= :dateFrom
        AND cc.count_date <= :dateTo
      GROUP BY p.category
      ORDER BY overall_accuracy_pct ASC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['operations', 'inventory', 'accuracy', 'location', 'level-3'],
  },
  {
    name: 'FPY (First Pass Yield) Report',
    code: 'OPS_FPY_REPORT',
    description: 'Monitor first pass yield for warehouse assembly/kitting operations with failure analysis',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.fpy.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, wo.completed_date) as period,
        p.name as product_name,
        u.first_name || ' ' || u.last_name as associate_name,
        COUNT(wo.id) as total_orders,
        COUNT(wo.id) FILTER (WHERE wo.first_pass_yield = true) as fpy_success,
        (COUNT(wo.id) FILTER (WHERE wo.first_pass_yield = true) / NULLIF(COUNT(wo.id), 0) * 100) as fpy_rate,
        COUNT(wo.id) FILTER (WHERE wo.required_rework = true) as rework_count,
        fft.failure_type,
        SUM(wo.rework_time_minutes) as total_rework_time,
        SUM(wo.rework_cost) as total_rework_cost
      FROM work_orders wo
      JOIN products p ON wo.product_id = p.id
      JOIN users u ON wo.assembled_by = u.id
      LEFT JOIN fpy_failure_types fft ON fft.work_order_id = wo.id
      WHERE wo.location_id = :locationId
        AND wo.tenant_id = :tenantId
        AND wo.completed_date >= :dateFrom
        AND wo.completed_date <= :dateTo
      GROUP BY period, p.name, associate_name, fft.failure_type
      ORDER BY period DESC, rework_count DESC
    `,
    defaultParameters: {
      period: 'day',
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['operations', 'fpy', 'quality', 'warehouse', 'location', 'level-3'],
  },

  // Level 4: Warehouse Manager / Operations Manager Reports
  {
    name: 'Warehouse Performance Report',
    code: 'OPS_WAREHOUSE_PERFORMANCE',
    description: 'Comprehensive warehouse KPIs including receiving, shipping, turns, fill rate, and labor productivity',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.performance.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, metric_date) as period,
        SUM(receiving_volume) as total_receiving_volume,
        SUM(shipping_volume) as total_shipping_volume,
        AVG(inventory_turns) as avg_inventory_turns,
        (COUNT(orders_filled) / NULLIF(COUNT(orders_total), 0) * 100) as order_fill_rate,
        (COUNT(shipments_on_time) / NULLIF(COUNT(shipments_total), 0) * 100) as on_time_shipment_rate,
        SUM(warehouse_labor_cost) as total_labor_cost,
        (SUM(units_processed) / NULLIF(SUM(labor_hours), 0)) as labor_productivity_units_per_hour
      FROM warehouse_daily_metrics
      WHERE location_id = :locationId
        AND tenant_id = :tenantId
        AND metric_date >= :dateFrom
        AND metric_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'week',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 weeks'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['operations', 'warehouse', 'performance', 'location', 'level-4'],
  },
  {
    name: 'Inventory Valuation Report',
    code: 'OPS_INVENTORY_VALUATION',
    description: 'Inventory value analysis with aging, slow-moving items, obsolescence, and carrying costs',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.inventory.view_location', 'finance.inventory.view'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        p.category as product_category,
        SUM(inv.quantity_on_hand * p.unit_cost) as total_inventory_value,
        SUM(inv.quantity_on_hand * p.unit_cost) FILTER (WHERE inv.days_on_hand < 30) as value_0_30_days,
        SUM(inv.quantity_on_hand * p.unit_cost) FILTER (WHERE inv.days_on_hand BETWEEN 30 AND 90) as value_30_90_days,
        SUM(inv.quantity_on_hand * p.unit_cost) FILTER (WHERE inv.days_on_hand BETWEEN 90 AND 180) as value_90_180_days,
        SUM(inv.quantity_on_hand * p.unit_cost) FILTER (WHERE inv.days_on_hand > 180) as value_over_180_days,
        SUM(inv.quantity_on_hand * p.unit_cost) FILTER (WHERE inv.days_on_hand > 365) as obsolete_inventory_value,
        SUM(inv.quantity_on_hand * p.unit_cost * 0.25) as annual_carrying_cost
      FROM inventory inv
      JOIN products p ON inv.product_id = p.id
      WHERE inv.location_id = :locationId
        AND inv.tenant_id = :tenantId
      GROUP BY p.category
      ORDER BY total_inventory_value DESC
    `,
    tags: ['operations', 'inventory', 'valuation', 'finance', 'location', 'level-4', 'sensitive'],
  },
  {
    name: 'Purchase Order Report',
    code: 'OPS_PURCHASE_ORDER',
    description: 'PO tracking with open orders, aging, vendor performance, and receiving accuracy',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.purchasing.view_location'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        po.po_number,
        v.vendor_name,
        po.po_date,
        po.expected_delivery_date,
        EXTRACT(DAY FROM (CURRENT_DATE - po.po_date)) as po_age_days,
        po.po_status,
        po.total_po_value,
        (po.total_po_value - po.received_value) as outstanding_value,
        (po.quantity_ordered - po.quantity_received) as outstanding_quantity,
        (po.quantity_received / NULLIF(po.quantity_ordered, 0) * 100) as receipt_completion_pct,
        CASE
          WHEN po.actual_delivery_date <= po.expected_delivery_date THEN 'On Time'
          WHEN po.actual_delivery_date > po.expected_delivery_date THEN 'Late'
          WHEN po.expected_delivery_date < CURRENT_DATE AND po.actual_delivery_date IS NULL THEN 'Overdue'
          ELSE 'Pending'
        END as delivery_status
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      WHERE po.location_id = :locationId
        AND po.tenant_id = :tenantId
        AND po.po_status IN ('Open', 'Partially Received')
      ORDER BY po_age_days DESC
    `,
    tags: ['operations', 'purchasing', 'po', 'location', 'level-4'],
  },
  {
    name: 'Logistics & Delivery Report',
    code: 'OPS_LOGISTICS_DELIVERY',
    description: 'Track delivery performance including on-time rate, costs, route efficiency, and CSAT',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.logistics.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, d.delivery_date) as period,
        COUNT(d.id) as deliveries_completed,
        (COUNT(d.id) FILTER (WHERE d.delivered_on_time = true) / NULLIF(COUNT(d.id), 0) * 100) as on_time_delivery_rate,
        SUM(d.delivery_cost) as total_delivery_cost,
        AVG(d.delivery_cost) as avg_cost_per_delivery,
        AVG(r.total_miles) as avg_route_miles,
        AVG(r.total_stops) as avg_stops_per_route,
        (AVG(r.actual_miles) / NULLIF(AVG(r.planned_miles), 0) * 100) as route_efficiency_pct,
        AVG(dsat.rating) as avg_delivery_satisfaction
      FROM deliveries d
      LEFT JOIN delivery_routes r ON d.route_id = r.id
      LEFT JOIN delivery_satisfaction dsat ON dsat.delivery_id = d.id
      WHERE d.location_id = :locationId
        AND d.tenant_id = :tenantId
        AND d.delivery_date >= :dateFrom
        AND d.delivery_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'week',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 weeks'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['operations', 'logistics', 'delivery', 'location', 'level-4'],
  },

  // Level 5-6: Regional Operations Manager / COO Reports
  {
    name: 'Regional Operations Performance Report',
    code: 'OPS_REGIONAL_PERFORMANCE',
    description: 'Consolidated regional operations metrics with location-by-location comparison',
    category: 'operations',
    organizationalScope: 'regional',
    requiredPermissions: ['operations.performance.view_regional'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        loc.name as location_name,
        AVG(ia.accuracy_pct) as avg_inventory_accuracy,
        AVG(inv.inventory_turns) as avg_inventory_turns,
        AVG(fpy.fpy_rate) as avg_fpy_rate,
        AVG(wp.labor_productivity) as avg_warehouse_productivity,
        RANK() OVER (ORDER BY AVG(ia.accuracy_pct) DESC) as accuracy_rank,
        RANK() OVER (ORDER BY AVG(inv.inventory_turns) DESC) as turns_rank
      FROM organizational_units loc
      LEFT JOIN inventory_accuracy_metrics ia ON ia.location_id = loc.id
      LEFT JOIN inventory_metrics inv ON inv.location_id = loc.id
      LEFT JOIN fpy_metrics fpy ON fpy.location_id = loc.id
      LEFT JOIN warehouse_productivity_metrics wp ON wp.location_id = loc.id
      WHERE loc.region_id = :regionId
        AND loc.tenant_id = :tenantId
      GROUP BY loc.id, loc.name
      ORDER BY avg_warehouse_productivity DESC
    `,
    tags: ['operations', 'performance', 'regional', 'level-5'],
  },
  {
    name: 'Supply Chain Report',
    code: 'OPS_SUPPLY_CHAIN',
    description: 'Vendor performance, lead times, freight costs, stockouts, and backorder analysis',
    category: 'operations',
    organizationalScope: 'regional',
    requiredPermissions: ['operations.supply_chain.view_regional'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        v.vendor_name,
        COUNT(po.id) as total_pos,
        (COUNT(po.id) FILTER (WHERE po.delivered_on_time = true) / NULLIF(COUNT(po.id), 0) * 100) as on_time_delivery_pct,
        (SUM(po.quantity_received - po.quantity_with_defects) / NULLIF(SUM(po.quantity_received), 0) * 100) as quality_acceptance_rate,
        AVG(EXTRACT(DAY FROM (po.actual_delivery_date - po.po_date))) as avg_lead_time_days,
        SUM(po.freight_cost) as total_freight_cost,
        AVG(po.freight_cost) as avg_freight_cost_per_po,
        SUM(inv.stockout_occurrences) as total_stockouts,
        SUM(bo.backorder_quantity) as total_backorder_quantity
      FROM vendors v
      LEFT JOIN purchase_orders po ON po.vendor_id = v.id
      LEFT JOIN inventory inv ON inv.vendor_id = v.id
      LEFT JOIN backorders bo ON bo.vendor_id = v.id
      WHERE v.region_id = :regionId
        AND v.tenant_id = :tenantId
        AND po.po_date >= :dateFrom
        AND po.po_date <= :dateTo
      GROUP BY v.id, v.vendor_name
      ORDER BY total_pos DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['operations', 'supply-chain', 'vendors', 'regional', 'level-5'],
  },
  {
    name: 'Executive Operations Dashboard',
    code: 'OPS_EXECUTIVE_DASHBOARD',
    description: 'Company-wide operations overview for executive leadership with key efficiency metrics',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['operations.performance.view_company', 'executive.dashboard.view'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, metric_date) as period,
        SUM(inv.total_inventory_value) as company_inventory_value,
        AVG(inv.inventory_turns) as company_inventory_turns,
        (COUNT(orders.id) FILTER (WHERE orders.filled_completely = true) / NULLIF(COUNT(orders.id), 0) * 100) as company_fill_rate,
        (COUNT(shipments.id) FILTER (WHERE shipments.delivered_on_time = true) / NULLIF(COUNT(shipments.id), 0) * 100) as company_on_time_delivery,
        SUM(wh.total_labor_cost + wh.total_overhead_cost) as total_operations_costs,
        (SUM(wh.units_processed) / NULLIF(SUM(wh.labor_hours), 0)) as company_warehouse_productivity
      FROM warehouse_daily_metrics wh
      LEFT JOIN inventory_metrics inv ON inv.location_id = wh.location_id AND inv.metric_date = wh.metric_date
      LEFT JOIN orders ON orders.location_id = wh.location_id AND DATE_TRUNC('day', orders.order_date) = wh.metric_date
      LEFT JOIN shipments ON shipments.location_id = wh.location_id AND DATE_TRUNC('day', shipments.ship_date) = wh.metric_date
      WHERE wh.tenant_id = :tenantId
        AND wh.metric_date >= :dateFrom
        AND wh.metric_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['operations', 'executive', 'dashboard', 'company', 'level-6'],
  },
];

// =====================================================================
// FINANCE REPORTS (10 reports)
// =====================================================================

const FINANCE_REPORTS: ReportDefinition[] = [
  // Level 1: Accounting Clerk Reports
  {
    name: 'Personal Transaction Log',
    code: 'FINANCE_PERSONAL_TRANSACTIONS',
    description: 'View transactions you entered with error tracking',
    category: 'finance',
    organizationalScope: 'individual',
    requiredPermissions: ['finance.transactions.view_own'],
    defaultVisualization: 'table',
    isRealTime: true,
    supportsExport: false,
    cacheDuration: 0,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, t.transaction_date) as period,
        COUNT(t.id) as transactions_entered,
        t.transaction_type,
        COUNT(t.id) FILTER (WHERE t.has_error = true) / NULLIF(COUNT(t.id), 0) * 100 as error_rate
      FROM accounting_transactions t
      WHERE t.entered_by = :userId
        AND t.tenant_id = :tenantId
        AND t.transaction_date >= :dateFrom
      GROUP BY period, t.transaction_type
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'day',
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
    },
    tags: ['finance', 'transactions', 'personal', 'level-1'],
  },

  // Level 3-4: Accounting Supervisor / Finance Manager Reports
  {
    name: 'AR Aging Report',
    code: 'FINANCE_AR_AGING',
    description: 'Accounts receivable aging analysis with customer breakdown and collection priorities',
    category: 'finance',
    organizationalScope: 'location',
    requiredPermissions: ['finance.ar.view_location'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        c.name as customer_name,
        SUM(inv.balance_due) as total_ar_balance,
        SUM(inv.balance_due) FILTER (WHERE inv.days_outstanding BETWEEN 0 AND 30) as ar_0_30_days,
        SUM(inv.balance_due) FILTER (WHERE inv.days_outstanding BETWEEN 31 AND 60) as ar_31_60_days,
        SUM(inv.balance_due) FILTER (WHERE inv.days_outstanding BETWEEN 61 AND 90) as ar_61_90_days,
        SUM(inv.balance_due) FILTER (WHERE inv.days_outstanding > 90) as ar_over_90_days,
        AVG(inv.days_outstanding) as avg_days_outstanding,
        SUM(inv.balance_due) FILTER (WHERE inv.days_outstanding > 60) as collection_priority
      FROM invoices inv
      JOIN business_records c ON inv.customer_id = c.id
      WHERE inv.location_id = :locationId
        AND inv.tenant_id = :tenantId
        AND inv.payment_status != 'Paid'
      GROUP BY c.id, c.name
      ORDER BY total_ar_balance DESC
    `,
    tags: ['finance', 'ar', 'aging', 'location', 'level-3'],
  },
  {
    name: 'AP Aging Report',
    code: 'FINANCE_AP_AGING',
    description: 'Accounts payable aging with vendor breakdown and upcoming payment schedules',
    category: 'finance',
    organizationalScope: 'location',
    requiredPermissions: ['finance.ap.view_location'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        v.vendor_name,
        SUM(bill.balance_due) as total_ap_balance,
        SUM(bill.balance_due) FILTER (WHERE bill.days_outstanding BETWEEN 0 AND 30) as ap_0_30_days,
        SUM(bill.balance_due) FILTER (WHERE bill.days_outstanding BETWEEN 31 AND 60) as ap_31_60_days,
        SUM(bill.balance_due) FILTER (WHERE bill.days_outstanding BETWEEN 61 AND 90) as ap_61_90_days,
        SUM(bill.balance_due) FILTER (WHERE bill.days_outstanding > 90) as ap_over_90_days,
        SUM(bill.balance_due) FILTER (WHERE bill.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as due_next_7_days,
        SUM(bill.balance_due) FILTER (WHERE bill.due_date < CURRENT_DATE) as overdue_amount
      FROM bills bill
      JOIN vendors v ON bill.vendor_id = v.id
      WHERE bill.location_id = :locationId
        AND bill.tenant_id = :tenantId
        AND bill.payment_status != 'Paid'
      GROUP BY v.id, v.vendor_name
      ORDER BY total_ap_balance DESC
    `,
    tags: ['finance', 'ap', 'aging', 'location', 'level-3'],
  },
  {
    name: 'Cash Flow Report',
    code: 'FINANCE_CASH_FLOW',
    description: 'Cash flow analysis with receipts, disbursements, and 30/60/90 day forecasts',
    category: 'finance',
    organizationalScope: 'location',
    requiredPermissions: ['finance.cash_flow.view_location'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, cf.transaction_date) as period,
        cf.beginning_balance,
        SUM(cf.amount) FILTER (WHERE cf.transaction_type = 'Receipt') as cash_receipts,
        SUM(cf.amount) FILTER (WHERE cf.transaction_type = 'Disbursement') as cash_disbursements,
        cf.ending_balance,
        forecast_30.forecasted_balance as forecast_30_days,
        forecast_60.forecasted_balance as forecast_60_days,
        forecast_90.forecasted_balance as forecast_90_days
      FROM cash_flow_transactions cf
      LEFT JOIN LATERAL (
        SELECT SUM(projected_receipts - projected_disbursements) + cf.ending_balance as forecasted_balance
        FROM cash_flow_forecast
        WHERE forecast_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          AND location_id = cf.location_id
      ) forecast_30 ON true
      LEFT JOIN LATERAL (
        SELECT SUM(projected_receipts - projected_disbursements) + cf.ending_balance as forecasted_balance
        FROM cash_flow_forecast
        WHERE forecast_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
          AND location_id = cf.location_id
      ) forecast_60 ON true
      LEFT JOIN LATERAL (
        SELECT SUM(projected_receipts - projected_disbursements) + cf.ending_balance as forecasted_balance
        FROM cash_flow_forecast
        WHERE forecast_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
          AND location_id = cf.location_id
      ) forecast_90 ON true
      WHERE cf.location_id = :locationId
        AND cf.tenant_id = :tenantId
        AND cf.transaction_date >= :dateFrom
        AND cf.transaction_date <= :dateTo
      GROUP BY period, cf.beginning_balance, cf.ending_balance, forecast_30.forecasted_balance, forecast_60.forecasted_balance, forecast_90.forecasted_balance
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['finance', 'cash-flow', 'location', 'level-4', 'sensitive'],
  },
  {
    name: 'Financial Statements (P&L, Balance Sheet, Cash Flow)',
    code: 'FINANCE_FINANCIAL_STATEMENTS',
    description: 'Complete financial statements with actual vs budget comparisons',
    category: 'finance',
    organizationalScope: 'location',
    requiredPermissions: ['finance.statements.view_location'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        fs.statement_type,
        fs.line_item,
        fs.account_category,
        fs.actual_amount,
        fs.budget_amount,
        (fs.actual_amount - fs.budget_amount) as variance_amount,
        ((fs.actual_amount - fs.budget_amount) / NULLIF(fs.budget_amount, 0) * 100) as variance_pct,
        fs.prior_year_amount,
        ((fs.actual_amount - fs.prior_year_amount) / NULLIF(fs.prior_year_amount, 0) * 100) as yoy_change_pct
      FROM financial_statements fs
      WHERE fs.location_id = :locationId
        AND fs.tenant_id = :tenantId
        AND fs.period_end_date = :periodEndDate
      ORDER BY fs.statement_type, fs.display_order
    `,
    defaultParameters: {
      periodEndDate: sql`DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'`,
    },
    tags: ['finance', 'statements', 'pl', 'balance-sheet', 'location', 'level-4', 'sensitive'],
  },
  {
    name: 'Budget vs Actual Report',
    code: 'FINANCE_BUDGET_VS_ACTUAL',
    description: 'Detailed variance analysis comparing actual performance to budget by category',
    category: 'finance',
    organizationalScope: 'location',
    requiredPermissions: ['finance.budget.view_location'],
    defaultVisualization: 'chart_table_combo',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        DATE_TRUNC('month', bva.period_date) as period,
        bva.category,
        bva.subcategory,
        SUM(bva.actual_revenue) as actual_revenue,
        SUM(bva.budget_revenue) as budget_revenue,
        (SUM(bva.actual_revenue) - SUM(bva.budget_revenue)) as revenue_variance,
        ((SUM(bva.actual_revenue) - SUM(bva.budget_revenue)) / NULLIF(SUM(bva.budget_revenue), 0) * 100) as revenue_variance_pct,
        SUM(bva.actual_expenses) as actual_expenses,
        SUM(bva.budget_expenses) as budget_expenses,
        (SUM(bva.actual_expenses) - SUM(bva.budget_expenses)) as expense_variance,
        ((SUM(bva.actual_expenses) - SUM(bva.budget_expenses)) / NULLIF(SUM(bva.budget_expenses), 0) * 100) as expense_variance_pct,
        bva.variance_explanation
      FROM budget_vs_actual bva
      WHERE bva.location_id = :locationId
        AND bva.tenant_id = :tenantId
        AND bva.period_date >= :dateFrom
        AND bva.period_date <= :dateTo
      GROUP BY period, bva.category, bva.subcategory, bva.variance_explanation
      ORDER BY period DESC, ABS(revenue_variance + expense_variance) DESC
    `,
    defaultParameters: {
      dateFrom: sql`DATE_TRUNC('year', CURRENT_DATE)`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['finance', 'budget', 'variance', 'location', 'level-4', 'sensitive'],
  },

  // Level 6: CFO Reports
  {
    name: 'Executive Financial Dashboard',
    code: 'FINANCE_EXECUTIVE_DASHBOARD',
    description: 'Company-wide financial overview with key metrics for executive leadership',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['finance.performance.view_company', 'executive.dashboard.view'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, fm.period_date) as period,
        SUM(fm.total_revenue) as company_revenue,
        SUM(fm.gross_profit) as company_gross_profit,
        (SUM(fm.gross_profit) / NULLIF(SUM(fm.total_revenue), 0) * 100) as gross_margin_pct,
        SUM(fm.operating_expenses) as company_operating_expenses,
        SUM(fm.ebitda) as company_ebitda,
        SUM(fm.net_income) as company_net_income,
        AVG(fm.cash_balance) as avg_cash_balance,
        SUM(fm.accounts_receivable) as total_ar,
        SUM(fm.accounts_payable) as total_ap
      FROM financial_metrics fm
      WHERE fm.tenant_id = :tenantId
        AND fm.period_date >= :dateFrom
        AND fm.period_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['finance', 'executive', 'dashboard', 'company', 'level-6', 'sensitive'],
  },
  {
    name: 'Profitability Analysis Report',
    code: 'FINANCE_PROFITABILITY_ANALYSIS',
    description: 'Multi-dimensional profitability analysis by location, department, customer, and product',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['finance.profitability.view_company', 'executive.analytics.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        loc.name as location_name,
        dept.department_name,
        c.name as customer_name,
        p.category as product_category,
        SUM(rev.revenue) as total_revenue,
        SUM(rev.cogs) as total_cogs,
        (SUM(rev.revenue) - SUM(rev.cogs)) as gross_profit,
        ((SUM(rev.revenue) - SUM(rev.cogs)) / NULLIF(SUM(rev.revenue), 0) * 100) as gross_margin_pct
      FROM revenue_detail rev
      LEFT JOIN organizational_units loc ON rev.location_id = loc.id
      LEFT JOIN departments dept ON rev.department_id = dept.id
      LEFT JOIN business_records c ON rev.customer_id = c.id
      LEFT JOIN products p ON rev.product_id = p.id
      WHERE rev.tenant_id = :tenantId
        AND rev.transaction_date >= :dateFrom
        AND rev.transaction_date <= :dateTo
      GROUP BY ROLLUP(loc.name, dept.department_name, c.name, p.category)
      ORDER BY gross_profit DESC NULLS LAST
    `,
    defaultParameters: {
      dateFrom: sql`DATE_TRUNC('year', CURRENT_DATE)`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['finance', 'profitability', 'analytics', 'executive', 'company', 'level-6', 'sensitive'],
  },
  {
    name: 'KPI Scorecard (Financial)',
    code: 'FINANCE_KPI_SCORECARD',
    description: 'Financial KPI scorecard with targets and trends for executive monitoring',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['finance.kpis.view_company', 'executive.kpis.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        DATE_TRUNC('month', kpi.period_date) as period,
        kpi.kpi_name,
        kpi.actual_value,
        kpi.target_value,
        kpi.prior_year_value,
        ((kpi.actual_value - kpi.target_value) / NULLIF(kpi.target_value, 0) * 100) as variance_from_target_pct,
        ((kpi.actual_value - kpi.prior_year_value) / NULLIF(kpi.prior_year_value, 0) * 100) as yoy_change_pct,
        CASE
          WHEN kpi.actual_value >= kpi.target_value THEN 'On Target'
          WHEN kpi.actual_value >= kpi.target_value * 0.9 THEN 'Near Target'
          ELSE 'Below Target'
        END as performance_status
      FROM financial_kpis kpi
      WHERE kpi.tenant_id = :tenantId
        AND kpi.period_date >= :dateFrom
        AND kpi.period_date <= :dateTo
        AND kpi.kpi_name IN (
          'Revenue Growth Rate',
          'Gross Margin %',
          'Operating Margin %',
          'EBITDA Margin %',
          'Return on Assets',
          'Current Ratio',
          'Quick Ratio',
          'Days Sales Outstanding (DSO)',
          'Days Payable Outstanding (DPO)'
        )
      ORDER BY period DESC, kpi.kpi_name
    `,
    defaultParameters: {
      dateFrom: sql`DATE_TRUNC('year', CURRENT_DATE)`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['finance', 'kpi', 'scorecard', 'executive', 'company', 'level-6', 'sensitive'],
  },
  {
    name: 'Board-Level Financial Report',
    code: 'FINANCE_BOARD_REPORT',
    description: 'Executive financial summary for board meetings with strategic commentary',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.board_reports.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        DATE_TRUNC('month', fs.period_date) as period,
        SUM(fs.total_revenue) as revenue,
        SUM(fs.budget_revenue) as revenue_plan,
        ((SUM(fs.total_revenue) - SUM(fs.budget_revenue)) / NULLIF(SUM(fs.budget_revenue), 0) * 100) as revenue_vs_plan_pct,
        SUM(fs.prior_year_revenue) as prior_year_revenue,
        ((SUM(fs.total_revenue) - SUM(fs.prior_year_revenue)) / NULLIF(SUM(fs.prior_year_revenue), 0) * 100) as revenue_yoy_growth_pct,
        (SUM(fs.gross_profit) / NULLIF(SUM(fs.total_revenue), 0) * 100) as gross_margin_pct,
        (SUM(fs.operating_income) / NULLIF(SUM(fs.total_revenue), 0) * 100) as operating_margin_pct,
        (SUM(fs.ebitda) / NULLIF(SUM(fs.total_revenue), 0) * 100) as ebitda_margin_pct,
        SUM(fs.net_income) as net_income,
        AVG(fs.cash_balance) as cash_balance,
        fs.strategic_commentary
      FROM financial_summary fs
      WHERE fs.tenant_id = :tenantId
        AND fs.period_date >= :dateFrom
        AND fs.period_date <= :dateTo
      GROUP BY period, fs.strategic_commentary
      ORDER BY period DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['finance', 'board', 'executive', 'company', 'level-6', 'level-7', 'sensitive'],
  },
];

// =====================================================================
// EXECUTIVE & PLATFORM REPORTS (8 reports)
// =====================================================================

const EXECUTIVE_AND_PLATFORM_REPORTS: ReportDefinition[] = [
  // Level 7: CEO / President Executive Reports
  {
    name: 'Executive Summary Dashboard',
    code: 'EXECUTIVE_SUMMARY_DASHBOARD',
    description: 'Comprehensive executive overview across all departments for CEO/President',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.dashboard.view'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, ed.metric_date) as period,
        SUM(ed.total_revenue) as revenue,
        SUM(ed.sales_pipeline_value) as pipeline,
        (SUM(ed.sales_quota_attainment) / NULLIF(COUNT(DISTINCT ed.location_id), 0)) as avg_quota_attainment,
        COUNT(DISTINCT ed.service_tickets) as total_service_tickets,
        AVG(ed.service_sla_compliance) as avg_sla_compliance,
        AVG(ed.service_csat) as avg_csat,
        AVG(ed.inventory_turns) as avg_inventory_turns,
        AVG(ed.warehouse_fill_rate) as avg_fill_rate,
        AVG(ed.fpy_rate) as avg_fpy,
        (SUM(ed.gross_profit) / NULLIF(SUM(ed.total_revenue), 0) * 100) as gross_margin,
        SUM(ed.ebitda) as ebitda,
        AVG(ed.cash_balance) as avg_cash,
        COUNT(DISTINCT ed.total_employees) as total_headcount,
        AVG(ed.employee_attrition_rate) as avg_attrition_rate,
        COUNT(DISTINCT ed.total_customers) as total_customers,
        AVG(ed.customer_retention_rate) as avg_retention_rate,
        AVG(ed.nps_score) as avg_nps
      FROM executive_dashboard_metrics ed
      WHERE ed.tenant_id = :tenantId
        AND ed.metric_date >= :dateFrom
        AND ed.metric_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['executive', 'dashboard', 'ceo', 'company', 'level-7', 'sensitive'],
  },
  {
    name: 'Company Performance Report',
    code: 'EXECUTIVE_COMPANY_PERFORMANCE',
    description: 'Comprehensive monthly company performance across all functions with strategic initiatives tracking',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.performance.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        'Financial' as category,
        SUM(revenue) as current_value,
        SUM(budget_revenue) as target_value,
        ((SUM(revenue) - SUM(budget_revenue)) / NULLIF(SUM(budget_revenue), 0) * 100) as variance_pct
      FROM financial_metrics
      WHERE tenant_id = :tenantId AND period_date = :reportPeriod
      UNION ALL
      SELECT
        'Sales' as category,
        SUM(closed_deals_revenue),
        SUM(quota_amount),
        ((SUM(closed_deals_revenue) - SUM(quota_amount)) / NULLIF(SUM(quota_amount), 0) * 100)
      FROM sales_metrics
      WHERE tenant_id = :tenantId AND period_date = :reportPeriod
      UNION ALL
      SELECT
        'Service' as category,
        AVG(csat_score) * 20,
        100,
        ((AVG(csat_score) * 20 - 100) / 100 * 100)
      FROM service_metrics
      WHERE tenant_id = :tenantId AND period_date = :reportPeriod
      UNION ALL
      SELECT
        'Operations' as category,
        AVG(warehouse_productivity),
        target_productivity,
        ((AVG(warehouse_productivity) - target_productivity) / NULLIF(target_productivity, 0) * 100)
      FROM operations_metrics
      WHERE tenant_id = :tenantId AND period_date = :reportPeriod
    `,
    defaultParameters: {
      reportPeriod: sql`DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
    },
    tags: ['executive', 'performance', 'company', 'level-7', 'sensitive'],
  },
  {
    name: 'Strategic KPI Report',
    code: 'EXECUTIVE_STRATEGIC_KPIS',
    description: 'Strategic KPIs for executive leadership including growth, profitability, and efficiency metrics',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.kpis.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        kpi.kpi_name,
        kpi.current_value,
        kpi.target_value,
        kpi.prior_year_value,
        ((kpi.current_value - kpi.target_value) / NULLIF(kpi.target_value, 0) * 100) as target_variance_pct,
        ((kpi.current_value - kpi.prior_year_value) / NULLIF(kpi.prior_year_value, 0) * 100) as yoy_growth_pct
      FROM strategic_kpis kpi
      WHERE kpi.tenant_id = :tenantId
        AND kpi.period = :period
        AND kpi.kpi_name IN (
          'Company Revenue Growth Rate',
          'Market Share',
          'Customer Acquisition Cost (CAC)',
          'Customer Lifetime Value (CLV)',
          'CLV:CAC Ratio',
          'Net Promoter Score (NPS)',
          'Employee Engagement Score',
          'EBITDA Margin',
          'Return on Invested Capital (ROIC)',
          'Cash Conversion Cycle'
        )
      ORDER BY kpi.display_order
    `,
    defaultParameters: {
      period: sql`DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
    },
    tags: ['executive', 'kpi', 'strategic', 'company', 'level-7', 'sensitive'],
  },
  {
    name: 'Board Report',
    code: 'EXECUTIVE_BOARD_REPORT',
    description: 'Comprehensive board-level report with executive summary, strategic goals, and forward-looking statements',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.board_reports.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 86400,
    sqlQuery: `
      SELECT
        br.report_section,
        br.section_title,
        br.metric_name,
        br.current_period_value,
        br.prior_period_value,
        br.budget_value,
        br.commentary,
        br.risks_and_opportunities,
        br.strategic_initiatives_status
      FROM board_report_data br
      WHERE br.tenant_id = :tenantId
        AND br.report_period = :reportPeriod
      ORDER BY br.section_order, br.metric_order
    `,
    defaultParameters: {
      reportPeriod: sql`DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
    },
    tags: ['executive', 'board', 'company', 'level-7', 'sensitive'],
  },

  // Level 8: Platform Admin Reports
  {
    name: 'Platform System Metrics',
    code: 'PLATFORM_SYSTEM_METRICS',
    description: 'Platform-wide system health, performance, and usage metrics for Printyx administrators',
    category: 'it',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.metrics.view'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsExport: true,
    cacheDuration: 60,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, pm.metric_timestamp) as period,
        COUNT(DISTINCT pm.tenant_id) as active_tenants,
        COUNT(DISTINCT pm.user_id) as total_active_users,
        AVG(pm.system_uptime_pct) as avg_uptime_pct,
        AVG(pm.api_response_time_ms) as avg_api_response_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.api_response_time_ms) as p95_api_response_ms,
        (COUNT(pm.error_count) / NULLIF(COUNT(pm.request_count), 0) * 100) as error_rate_pct,
        AVG(pm.database_query_time_ms) as avg_db_query_ms,
        SUM(pm.storage_used_gb) as total_storage_used_gb
      FROM platform_metrics pm
      WHERE pm.metric_timestamp >= :dateFrom
        AND pm.metric_timestamp <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'hour',
      dateFrom: sql`CURRENT_DATE - INTERVAL '7 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['platform', 'system', 'metrics', 'admin', 'level-8'],
  },
  {
    name: 'Tenant Usage Report',
    code: 'PLATFORM_TENANT_USAGE',
    description: 'Per-tenant usage statistics including users, storage, API calls, and feature adoption',
    category: 'it',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.tenants.view'],
    defaultVisualization: 'table',
    isRealTime: false,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        t.tenant_id,
        t.tenant_name,
        t.subscription_tier,
        COUNT(DISTINCT u.id) as user_count,
        SUM(tu.storage_used_gb) as storage_used_gb,
        t.storage_limit_gb,
        (SUM(tu.storage_used_gb) / NULLIF(t.storage_limit_gb, 0) * 100) as storage_usage_pct,
        SUM(tu.api_calls_count) as total_api_calls,
        STRING_AGG(DISTINCT f.feature_name, ', ') as features_enabled,
        t.billing_status,
        t.subscription_renewal_date
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id AND u.status = 'Active'
      LEFT JOIN tenant_usage tu ON tu.tenant_id = t.id
        AND tu.usage_date >= :dateFrom
        AND tu.usage_date <= :dateTo
      LEFT JOIN tenant_features tf ON tf.tenant_id = t.id AND tf.is_enabled = true
      LEFT JOIN features f ON tf.feature_id = f.id
      GROUP BY t.id, t.tenant_id, t.tenant_name, t.subscription_tier, t.storage_limit_gb, t.billing_status, t.subscription_renewal_date
      ORDER BY total_api_calls DESC
    `,
    defaultParameters: {
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['platform', 'tenants', 'usage', 'admin', 'level-8'],
  },
  {
    name: 'Platform Billing Report',
    code: 'PLATFORM_BILLING_REPORT',
    description: 'Platform revenue metrics including MRR, ARR, churn, and expansion revenue',
    category: 'finance',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.billing.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, pb.billing_date) as period,
        SUM(pb.subscription_revenue) as mrr,
        SUM(pb.subscription_revenue) * 12 as arr,
        COUNT(DISTINCT pb.tenant_id) FILTER (WHERE pb.is_churned = true) /
          NULLIF(COUNT(DISTINCT pb.tenant_id), 0) * 100 as churn_rate_pct,
        SUM(pb.expansion_revenue) as expansion_revenue,
        pb.subscription_tier,
        SUM(pb.subscription_revenue) as revenue_by_tier,
        SUM(pb.outstanding_invoices_amount) as outstanding_ar
      FROM platform_billing pb
      WHERE pb.billing_date >= :dateFrom
        AND pb.billing_date <= :dateTo
      GROUP BY period, pb.subscription_tier
      ORDER BY period DESC, revenue_by_tier DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '24 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['platform', 'billing', 'revenue', 'admin', 'level-8', 'sensitive'],
  },
  {
    name: 'Security & Audit Report',
    code: 'PLATFORM_SECURITY_AUDIT',
    description: 'Platform security monitoring including login attempts, MFA adoption, and audit trail',
    category: 'compliance',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.security.view', 'audit.logs.view'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, sa.event_timestamp) as period,
        COUNT(sa.id) FILTER (WHERE sa.event_type = 'login_success') as successful_logins,
        COUNT(sa.id) FILTER (WHERE sa.event_type = 'login_failed') as failed_logins,
        (COUNT(sa.id) FILTER (WHERE sa.event_type = 'login_failed') /
          NULLIF(COUNT(sa.id) FILTER (WHERE sa.event_type IN ('login_success', 'login_failed')), 0) * 100) as failed_login_rate,
        COUNT(DISTINCT u.id) FILTER (WHERE u.mfa_enabled = true) /
          NULLIF(COUNT(DISTINCT u.id), 0) * 100 as mfa_adoption_rate,
        COUNT(sa.id) FILTER (WHERE sa.event_type = 'permission_change') as permission_changes,
        COUNT(sa.id) FILTER (WHERE sa.is_suspicious = true) as suspicious_activity_count,
        sa.source_ip,
        COUNT(sa.id) as events_per_ip
      FROM security_audit_log sa
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE sa.event_timestamp >= :dateFrom
        AND sa.event_timestamp <= :dateTo
      GROUP BY period, sa.source_ip
      ORDER BY period DESC, events_per_ip DESC
    `,
    defaultParameters: {
      period: 'day',
      dateFrom: sql`CURRENT_DATE - INTERVAL '30 days'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['platform', 'security', 'audit', 'compliance', 'admin', 'level-8', 'sensitive'],
  },
];

// =====================================================================
// CROSS-DEPARTMENT REPORTS (3 reports)
// =====================================================================

const CROSS_DEPARTMENT_REPORTS: ReportDefinition[] = [
  {
    name: 'Customer 360 Report',
    code: 'CROSS_CUSTOMER_360',
    description: 'Complete customer view aggregating sales, service, finance, and operations data',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.customer.view_location', 'service.customer.view_location', 'finance.customer.view_location'],
    defaultVisualization: 'dashboard',
    isRealTime: true,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 300,
    sqlQuery: `
      SELECT
        c.id as customer_id,
        c.name as customer_name,
        c.segment,
        c.account_status,
        -- Sales Data
        COUNT(DISTINCT o.id) as total_opportunities,
        COUNT(DISTINCT q.id) as total_quotes,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as lifetime_revenue,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= DATE_TRUNC('year', CURRENT_DATE)) as ytd_revenue,
        -- Service Data
        COUNT(DISTINCT e.id) as total_equipment,
        COUNT(DISTINCT t.id) as total_service_tickets,
        COUNT(DISTINCT t.id) FILTER (WHERE t.created_at >= CURRENT_DATE - INTERVAL '90 days') as recent_tickets,
        AVG(sr.rating) as avg_service_csat,
        MAX(t.created_at) as last_service_date,
        -- Finance Data
        SUM(inv.balance_due) as current_ar_balance,
        AVG(inv.days_outstanding) as avg_days_outstanding,
        c.payment_terms,
        c.credit_limit,
        -- Operations Data
        COUNT(DISTINCT d.id) as total_deliveries,
        AVG(dsat.rating) as avg_delivery_satisfaction
      FROM business_records c
      LEFT JOIN opportunities o ON o.customer_id = c.id
      LEFT JOIN quotes q ON q.customer_id = c.id
      LEFT JOIN equipment e ON e.customer_id = c.id
      LEFT JOIN service_tickets t ON t.customer_id = c.id
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      LEFT JOIN invoices inv ON inv.customer_id = c.id AND inv.payment_status != 'Paid'
      LEFT JOIN deliveries d ON d.customer_id = c.id
      LEFT JOIN delivery_satisfaction dsat ON dsat.delivery_id = d.id
      WHERE c.id = :customerId
        AND c.tenant_id = :tenantId
      GROUP BY c.id, c.name, c.segment, c.account_status, c.payment_terms, c.credit_limit
    `,
    tags: ['cross-department', 'customer-360', 'sales', 'service', 'finance', 'operations', 'level-4'],
  },
  {
    name: 'Employee Performance Report',
    code: 'CROSS_EMPLOYEE_PERFORMANCE',
    description: 'Employee performance metrics aggregated from department-specific KPIs',
    category: 'hr',
    organizationalScope: 'team',
    requiredPermissions: ['hr.employee.view_team'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsExport: true,
    containsSensitiveData: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        e.id as employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.role_code,
        e.department,
        e.hire_date,
        -- Sales Performance (if sales role)
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won') as deals_closed,
        SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') as revenue_generated,
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(q.quota_amount, 0) * 100) as quota_attainment,
        -- Service Performance (if service role)
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Completed') as tickets_completed,
        AVG(sr.rating) as avg_customer_satisfaction,
        (SUM(t.billable_hours) / NULLIF(SUM(t.total_hours), 0) * 100) as utilization_rate,
        -- Goals & Development
        (COUNT(g.id) FILTER (WHERE g.status = 'Completed') / NULLIF(COUNT(g.id), 0) * 100) as goals_completion_rate,
        COUNT(tr.id) as training_courses_completed,
        STRING_AGG(DISTINCT cert.certification_name, ', ') as certifications
      FROM users e
      LEFT JOIN opportunities o ON o.owner_id = e.id
      LEFT JOIN quotas q ON q.user_id = e.id
      LEFT JOIN service_tickets t ON t.assigned_to = e.id
      LEFT JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      LEFT JOIN employee_goals g ON g.employee_id = e.id
      LEFT JOIN training_records tr ON tr.employee_id = e.id
      LEFT JOIN employee_certifications cert ON cert.employee_id = e.id
      WHERE e.manager_id = :userId
        AND e.tenant_id = :tenantId
      GROUP BY e.id, employee_name, e.role_code, e.department, e.hire_date, q.quota_amount
      ORDER BY employee_name
    `,
    tags: ['cross-department', 'employee', 'performance', 'hr', 'level-3', 'sensitive'],
  },
  {
    name: 'Location Performance Report (Multi-Department)',
    code: 'CROSS_LOCATION_PERFORMANCE',
    description: 'Complete location performance across sales, service, operations, and finance',
    category: 'executive',
    organizationalScope: 'location',
    requiredPermissions: ['executive.location.view'],
    defaultVisualization: 'dashboard',
    isRealTime: false,
    supportsDrillDown: true,
    supportsExport: true,
    cacheDuration: 3600,
    sqlQuery: `
      SELECT
        DATE_TRUNC(:period, metric_date) as period,
        -- Sales Metrics
        SUM(sales_revenue) as sales_revenue,
        SUM(sales_pipeline_value) as pipeline_value,
        AVG(sales_quota_attainment) as avg_quota_attainment,
        -- Service Metrics
        COUNT(service_tickets) as total_tickets,
        AVG(service_sla_compliance) as avg_sla_compliance,
        AVG(service_profitability_pct) as service_margin_pct,
        -- Operations Metrics
        AVG(inventory_turns) as inventory_turns,
        AVG(warehouse_fpy_rate) as fpy_rate,
        AVG(on_time_delivery_rate) as delivery_on_time_rate,
        -- Finance Metrics
        SUM(total_revenue) as total_revenue,
        (SUM(gross_profit) / NULLIF(SUM(total_revenue), 0) * 100) as gross_margin_pct,
        SUM(ar_balance) as ar_balance,
        SUM(ap_balance) as ap_balance
      FROM location_daily_metrics
      WHERE location_id = :locationId
        AND tenant_id = :tenantId
        AND metric_date >= :dateFrom
        AND metric_date <= :dateTo
      GROUP BY period
      ORDER BY period DESC
    `,
    defaultParameters: {
      period: 'month',
      dateFrom: sql`CURRENT_DATE - INTERVAL '12 months'`,
      dateTo: sql`CURRENT_DATE`,
    },
    tags: ['cross-department', 'location', 'performance', 'executive', 'level-4'],
  },
];

// =====================================================================
// SEEDER EXECUTION FUNCTION
// =====================================================================

export async function seedReports() {
  console.log('🌱 Starting Report Definitions Seeder...\n');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // Get or create a system tenant for seeding
    const systemTenantId = 'SYSTEM'; // This would be replaced with actual tenant ID
    const systemUserId = 'SYSTEM'; // This would be replaced with actual user ID

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ report: string; error: string }> = [];

    // Combine all report arrays
    const ALL_REPORTS = [
      ...SALES_REPORTS,
      ...SERVICE_REPORTS,
      ...OPERATIONS_REPORTS,
      ...FINANCE_REPORTS,
      ...EXECUTIVE_AND_PLATFORM_REPORTS,
      ...CROSS_DEPARTMENT_REPORTS,
    ];

    console.log(`📊 Seeding ${ALL_REPORTS.length} report definitions...\n`);

    // Seed each report
    for (const report of ALL_REPORTS) {
      try {
        await db.insert(reportDefinitions).values({
          tenantId: systemTenantId,
          name: report.name,
          code: report.code,
          description: report.description || '',
          category: report.category,
          sqlQuery: report.sqlQuery,
          defaultParameters: report.defaultParameters || {},
          availableFilters: report.availableFilters || {},
          availableGroupings: report.availableGroupings || {},
          requiredPermissions: report.requiredPermissions,
          organizationalScope: report.organizationalScope,
          containsSensitiveData: report.containsSensitiveData || false,
          defaultVisualization: report.defaultVisualization,
          chartConfig: report.chartConfig || {},
          cacheDuration: report.cacheDuration || 300,
          queryTimeout: report.queryTimeout || 30,
          maxRowLimit: report.maxRowLimit || 10000,
          isRealTime: report.isRealTime || false,
          supportsDrillDown: report.supportsDrillDown || false,
          supportsExport: report.supportsExport !== false,
          isActive: true,
          version: '1.0',
          tags: report.tags || [],
          createdBy: systemUserId,
        }).onConflictDoUpdate({
          target: [reportDefinitions.code, reportDefinitions.tenantId],
          set: {
            name: report.name,
            description: report.description || '',
            sqlQuery: report.sqlQuery,
            updatedAt: new Date(),
          },
        });

        successCount++;
        console.log(`  ✅ ${report.code.padEnd(40)} - ${report.name}`);
      } catch (error: any) {
        errorCount++;
        errors.push({ report: report.code, error: error.message });
        console.error(`  ❌ ${report.code.padEnd(40)} - ERROR: ${error.message}`);
      }
    }

    console.log('\n════════════════════════════════════════════════════════════════\n');
    console.log('📈 SEEDING SUMMARY\n');
    console.log(`  Total Reports Processed: ${ALL_REPORTS.length}`);
    console.log(`  ✅ Successfully Seeded:  ${successCount}`);
    console.log(`  ❌ Errors:               ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n❌ ERRORS DETAILS:\n');
      errors.forEach(({ report, error }) => {
        console.log(`  ${report}: ${error}`);
      });
    }

    console.log('\n════════════════════════════════════════════════════════════════\n');
    console.log('✅ Report Definitions Seeder Completed!\n');

    return { successCount, errorCount, errors };
  } catch (error: any) {
    console.error('\n❌ CRITICAL ERROR during report seeding:');
    console.error(error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  seedReports()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}
