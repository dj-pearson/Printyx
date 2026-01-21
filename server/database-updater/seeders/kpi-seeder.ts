// =====================================================================
// KPI DEFINITIONS SEEDER
// Seeds all KPI definitions for the comprehensive RBAC reporting system
// =====================================================================

import { db } from '../../db';
import { kpiDefinitions } from '../../../shared/reporting-schema';
import { sql } from 'drizzle-orm';

// =====================================================================
// TYPES AND INTERFACES
// =====================================================================

interface KPIDefinition {
  name: string;
  code: string;
  description: string;
  category:
    | 'sales'
    | 'service'
    | 'finance'
    | 'operations'
    | 'hr'
    | 'it'
    | 'compliance'
    | 'executive';
  organizationalScope: 'platform' | 'company' | 'regional' | 'location' | 'team' | 'individual';
  requiredPermissions: string[];
  calculationSql: string;
  targetValue?: number;
  targetType?: 'absolute' | 'percentage' | 'ratio';
  displayFormat: 'number' | 'currency' | 'percentage' | 'decimal';
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  colorScheme?: Record<string, any>;
  alertEnabled?: boolean;
  alertThresholds?: Record<string, any>;
  alertRecipients?: string[];
  refreshFrequency?: number; // seconds
  cacheDuration?: number; // seconds
  isHighPriority?: boolean;
  tags?: string[];
}

// =====================================================================
// SALES KPIS
// =====================================================================

const SALES_KPIS: KPIDefinition[] = [
  // Individual Level KPIs
  {
    name: 'Personal Quota Attainment',
    code: 'SALES_PERSONAL_QUOTA_ATTAINMENT',
    description: 'Percentage of quota achieved for the current period',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.quota.view_own'],
    calculationSql: `
      SELECT
        (SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= DATE_TRUNC('month', CURRENT_DATE)) /
         NULLIF(q.quota_amount, 0) * 100) as kpi_value
      FROM opportunities o
      JOIN quotas q ON q.user_id = :userId AND q.quota_period = 'monthly'
      WHERE o.owner_id = :userId
        AND o.tenant_id = :tenantId
    `,
    targetValue: 100,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    colorScheme: {
      ranges: [
        { min: 0, max: 70, color: '#ff4d4f', label: 'Below Target' },
        { min: 70, max: 100, color: '#faad14', label: 'Near Target' },
        { min: 100, max: 150, color: '#52c41a', label: 'On Target' },
        { min: 150, max: 999, color: '#1890ff', label: 'Exceeds Target' },
      ],
    },
    alertEnabled: true,
    alertThresholds: {
      critical: 70,
      warning: 85,
      message: 'Quota attainment below target',
    },
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['sales', 'quota', 'personal', 'level-1'],
  },
  {
    name: 'Personal Win Rate',
    code: 'SALES_PERSONAL_WIN_RATE',
    description: 'Percentage of closed opportunities that were won',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.opportunity.view_own'],
    calculationSql: `
      SELECT
        (COUNT(o.id) FILTER (WHERE o.stage = 'Closed Won') /
         NULLIF(COUNT(o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')), 0) * 100) as kpi_value
      FROM opportunities o
      WHERE o.owner_id = :userId
        AND o.tenant_id = :tenantId
        AND o.close_date >= :dateFrom
    `,
    targetValue: 30,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    colorScheme: {
      ranges: [
        { min: 0, max: 20, color: '#ff4d4f', label: 'Poor' },
        { min: 20, max: 30, color: '#faad14', label: 'Fair' },
        { min: 30, max: 45, color: '#52c41a', label: 'Good' },
        { min: 45, max: 100, color: '#1890ff', label: 'Excellent' },
      ],
    },
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['sales', 'win-rate', 'personal', 'level-1'],
  },
  {
    name: 'Personal Pipeline Value',
    code: 'SALES_PERSONAL_PIPELINE_VALUE',
    description: 'Total value of open opportunities',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.opportunity.view_own'],
    calculationSql: `
      SELECT
        SUM(o.amount) as kpi_value
      FROM opportunities o
      WHERE o.owner_id = :userId
        AND o.tenant_id = :tenantId
        AND o.stage NOT IN ('Closed Won', 'Closed Lost')
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'currency',
    prefix: '$',
    decimalPlaces: 0,
    refreshFrequency: 1800,
    cacheDuration: 900,
    tags: ['sales', 'pipeline', 'personal', 'level-1'],
  },
  {
    name: 'Personal Pipeline Coverage',
    code: 'SALES_PERSONAL_PIPELINE_COVERAGE',
    description: 'Ratio of pipeline value to quota (healthy is 3x)',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.opportunity.view_own', 'sales.quota.view_own'],
    calculationSql: `
      SELECT
        (SUM(o.amount) / NULLIF(q.quota_amount, 0)) as kpi_value
      FROM opportunities o
      JOIN quotas q ON q.user_id = :userId AND q.quota_period = 'monthly'
      WHERE o.owner_id = :userId
        AND o.tenant_id = :tenantId
        AND o.stage NOT IN ('Closed Won', 'Closed Lost')
    `,
    targetValue: 3.0,
    targetType: 'ratio',
    displayFormat: 'decimal',
    suffix: 'x',
    decimalPlaces: 1,
    colorScheme: {
      ranges: [
        { min: 0, max: 2, color: '#ff4d4f', label: 'Low Coverage' },
        { min: 2, max: 3, color: '#faad14', label: 'Fair Coverage' },
        { min: 3, max: 5, color: '#52c41a', label: 'Good Coverage' },
        { min: 5, max: 999, color: '#1890ff', label: 'Excellent Coverage' },
      ],
    },
    alertEnabled: true,
    alertThresholds: {
      critical: 2.0,
      warning: 2.5,
      message: 'Pipeline coverage below healthy levels',
    },
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['sales', 'pipeline', 'coverage', 'personal', 'level-1'],
  },
  {
    name: 'Average Deal Size',
    code: 'SALES_AVG_DEAL_SIZE',
    description: 'Average value of won deals',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.opportunity.view_own'],
    calculationSql: `
      SELECT
        AVG(o.amount) as kpi_value
      FROM opportunities o
      WHERE o.owner_id = :userId
        AND o.tenant_id = :tenantId
        AND o.stage = 'Closed Won'
        AND o.close_date >= :dateFrom
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'currency',
    prefix: '$',
    decimalPlaces: 0,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['sales', 'deal-size', 'personal', 'level-1'],
  },
  {
    name: 'Sales Cycle (Days)',
    code: 'SALES_CYCLE_DAYS',
    description: 'Average number of days to close a deal',
    category: 'sales',
    organizationalScope: 'individual',
    requiredPermissions: ['sales.opportunity.view_own'],
    calculationSql: `
      SELECT
        AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))) as kpi_value
      FROM opportunities o
      WHERE o.owner_id = :userId
        AND o.tenant_id = :tenantId
        AND o.stage = 'Closed Won'
        AND o.close_date >= :dateFrom
    `,
    targetValue: 45,
    targetType: 'absolute',
    displayFormat: 'number',
    suffix: ' days',
    decimalPlaces: 0,
    colorScheme: {
      ranges: [
        { min: 0, max: 30, color: '#1890ff', label: 'Excellent' },
        { min: 30, max: 45, color: '#52c41a', label: 'Good' },
        { min: 45, max: 60, color: '#faad14', label: 'Fair' },
        { min: 60, max: 999, color: '#ff4d4f', label: 'Slow' },
      ],
      inverted: true, // Lower is better
    },
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['sales', 'sales-cycle', 'velocity', 'personal', 'level-1'],
  },

  // Team/Location Level KPIs
  {
    name: 'Team Quota Attainment',
    code: 'SALES_TEAM_QUOTA_ATTAINMENT',
    description: 'Average quota attainment across the team',
    category: 'sales',
    organizationalScope: 'team',
    requiredPermissions: ['sales.performance.view_team'],
    calculationSql: `
      SELECT
        AVG((SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') / NULLIF(q.quota_amount, 0) * 100)) as kpi_value
      FROM opportunities o
      JOIN users u ON o.owner_id = u.id
      JOIN quotas q ON q.user_id = u.id AND q.quota_period = 'monthly'
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
        AND o.close_date >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY u.id, q.quota_amount
    `,
    targetValue: 100,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['sales', 'quota', 'team', 'level-2', 'level-3'],
  },
  {
    name: 'Location Revenue (MTD)',
    code: 'SALES_LOCATION_REVENUE_MTD',
    description: 'Month-to-date revenue for the location',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.performance.view_location'],
    calculationSql: `
      SELECT
        SUM(o.amount) as kpi_value
      FROM opportunities o
      WHERE o.location_id = :locationId
        AND o.tenant_id = :tenantId
        AND o.stage = 'Closed Won'
        AND o.close_date >= DATE_TRUNC('month', CURRENT_DATE)
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'currency',
    prefix: '$',
    decimalPlaces: 0,
    refreshFrequency: 1800,
    cacheDuration: 900,
    isHighPriority: true,
    tags: ['sales', 'revenue', 'location', 'level-4'],
  },
  {
    name: 'Location Win Rate',
    code: 'SALES_LOCATION_WIN_RATE',
    description: 'Percentage of deals won at the location',
    category: 'sales',
    organizationalScope: 'location',
    requiredPermissions: ['sales.performance.view_location'],
    calculationSql: `
      SELECT
        (COUNT(o.id) FILTER (WHERE o.stage = 'Closed Won') /
         NULLIF(COUNT(o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')), 0) * 100) as kpi_value
      FROM opportunities o
      WHERE o.location_id = :locationId
        AND o.tenant_id = :tenantId
        AND o.close_date >= :dateFrom
    `,
    targetValue: 30,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['sales', 'win-rate', 'location', 'level-4'],
  },

  // Company/Executive Level KPIs
  {
    name: 'Company Revenue Growth Rate',
    code: 'SALES_COMPANY_REVENUE_GROWTH',
    description: 'Year-over-year revenue growth percentage',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['sales.performance.view_company', 'executive.kpis.view'],
    calculationSql: `
      SELECT
        ((SUM(o.amount) FILTER (WHERE o.close_date >= DATE_TRUNC('year', CURRENT_DATE)) -
          SUM(o.amount) FILTER (WHERE o.close_date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
            AND o.close_date < DATE_TRUNC('year', CURRENT_DATE))) /
         NULLIF(SUM(o.amount) FILTER (WHERE o.close_date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
           AND o.close_date < DATE_TRUNC('year', CURRENT_DATE)), 0) * 100) as kpi_value
      FROM opportunities o
      WHERE o.tenant_id = :tenantId
        AND o.stage = 'Closed Won'
    `,
    targetValue: 20,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['sales', 'revenue', 'growth', 'company', 'level-6', 'level-7'],
  },
  {
    name: 'Revenue Per Sales Rep',
    code: 'SALES_REVENUE_PER_REP',
    description: 'Average revenue generated per sales representative',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['sales.performance.view_company'],
    calculationSql: `
      SELECT
        (SUM(o.amount) / NULLIF(COUNT(DISTINCT u.id), 0)) as kpi_value
      FROM opportunities o
      JOIN users u ON o.owner_id = u.id
      WHERE o.tenant_id = :tenantId
        AND u.role_code LIKE 'SALES_%'
        AND o.stage = 'Closed Won'
        AND o.close_date >= :dateFrom
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'currency',
    prefix: '$',
    decimalPlaces: 0,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['sales', 'productivity', 'company', 'level-6'],
  },
];

// =====================================================================
// SERVICE KPIS
// =====================================================================

const SERVICE_KPIS: KPIDefinition[] = [
  // Individual Level KPIs
  {
    name: 'Personal First-Time Fix Rate',
    code: 'SERVICE_PERSONAL_FTF_RATE',
    description: 'Percentage of tickets resolved on first visit',
    category: 'service',
    organizationalScope: 'individual',
    requiredPermissions: ['service.ticket.view_own'],
    calculationSql: `
      SELECT
        (COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100) as kpi_value
      FROM service_tickets t
      WHERE t.assigned_to = :userId
        AND t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
    `,
    targetValue: 85,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    colorScheme: {
      ranges: [
        { min: 0, max: 70, color: '#ff4d4f', label: 'Needs Improvement' },
        { min: 70, max: 85, color: '#faad14', label: 'Fair' },
        { min: 85, max: 95, color: '#52c41a', label: 'Good' },
        { min: 95, max: 100, color: '#1890ff', label: 'Excellent' },
      ],
    },
    alertEnabled: true,
    alertThresholds: {
      critical: 70,
      warning: 80,
      message: 'FTF rate below target',
    },
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['service', 'ftf', 'quality', 'personal', 'level-1'],
  },
  {
    name: 'Personal Customer Satisfaction (CSAT)',
    code: 'SERVICE_PERSONAL_CSAT',
    description: 'Average customer satisfaction rating (1-5 scale)',
    category: 'service',
    organizationalScope: 'individual',
    requiredPermissions: ['service.ticket.view_own'],
    calculationSql: `
      SELECT
        AVG(sr.rating) as kpi_value
      FROM service_tickets t
      JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      WHERE t.assigned_to = :userId
        AND t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
    `,
    targetValue: 4.5,
    targetType: 'absolute',
    displayFormat: 'decimal',
    suffix: ' / 5',
    decimalPlaces: 2,
    colorScheme: {
      ranges: [
        { min: 0, max: 3.5, color: '#ff4d4f', label: 'Poor' },
        { min: 3.5, max: 4.0, color: '#faad14', label: 'Fair' },
        { min: 4.0, max: 4.5, color: '#52c41a', label: 'Good' },
        { min: 4.5, max: 5.0, color: '#1890ff', label: 'Excellent' },
      ],
    },
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['service', 'csat', 'satisfaction', 'personal', 'level-1'],
  },
  {
    name: 'Personal Utilization Rate',
    code: 'SERVICE_PERSONAL_UTILIZATION',
    description: 'Percentage of time spent on billable work',
    category: 'service',
    organizationalScope: 'individual',
    requiredPermissions: ['service.ticket.view_own'],
    calculationSql: `
      SELECT
        (SUM(t.billable_hours) / NULLIF(SUM(t.total_hours), 0) * 100) as kpi_value
      FROM service_tickets t
      WHERE t.assigned_to = :userId
        AND t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
    `,
    targetValue: 75,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    colorScheme: {
      ranges: [
        { min: 0, max: 60, color: '#ff4d4f', label: 'Low' },
        { min: 60, max: 75, color: '#faad14', label: 'Fair' },
        { min: 75, max: 90, color: '#52c41a', label: 'Good' },
        { min: 90, max: 100, color: '#faad14', label: 'Too High' },
      ],
    },
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['service', 'utilization', 'productivity', 'personal', 'level-1'],
  },

  // Team/Location Level KPIs
  {
    name: 'Team SLA Compliance',
    code: 'SERVICE_TEAM_SLA_COMPLIANCE',
    description: 'Percentage of tickets meeting SLA requirements',
    category: 'service',
    organizationalScope: 'team',
    requiredPermissions: ['service.performance.view_team'],
    calculationSql: `
      SELECT
        (COUNT(t.id) FILTER (WHERE t.sla_status = 'Within SLA') / NULLIF(COUNT(t.id), 0) * 100) as kpi_value
      FROM service_tickets t
      JOIN users u ON t.assigned_to = u.id
      WHERE u.manager_id = :userId
        AND u.tenant_id = :tenantId
        AND t.created_at >= :dateFrom
    `,
    targetValue: 95,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    alertEnabled: true,
    alertThresholds: {
      critical: 90,
      warning: 93,
      message: 'SLA compliance below target',
    },
    refreshFrequency: 1800,
    cacheDuration: 900,
    isHighPriority: true,
    tags: ['service', 'sla', 'compliance', 'team', 'level-3'],
  },
  {
    name: 'Location Service Revenue',
    code: 'SERVICE_LOCATION_REVENUE',
    description: 'Total billable service revenue for the location',
    category: 'service',
    organizationalScope: 'location',
    requiredPermissions: ['service.performance.view_location'],
    calculationSql: `
      SELECT
        SUM(t.billable_amount) as kpi_value
      FROM service_tickets t
      WHERE t.location_id = :locationId
        AND t.tenant_id = :tenantId
        AND t.ticket_type = 'Billable'
        AND t.completed_date >= :dateFrom
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'currency',
    prefix: '$',
    decimalPlaces: 0,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['service', 'revenue', 'location', 'level-4'],
  },
  {
    name: 'Location Service Margin',
    code: 'SERVICE_LOCATION_MARGIN',
    description: 'Service profit margin percentage',
    category: 'service',
    organizationalScope: 'location',
    requiredPermissions: ['service.financials.view_location'],
    calculationSql: `
      SELECT
        ((SUM(t.billable_amount) - SUM(t.labor_cost + t.parts_cost)) /
         NULLIF(SUM(t.billable_amount), 0) * 100) as kpi_value
      FROM service_tickets t
      WHERE t.location_id = :locationId
        AND t.tenant_id = :tenantId
        AND t.ticket_type = 'Billable'
        AND t.completed_date >= :dateFrom
    `,
    targetValue: 40,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['service', 'margin', 'profitability', 'location', 'level-4'],
  },

  // Company/Executive Level KPIs
  {
    name: 'Company First-Time Fix Rate',
    code: 'SERVICE_COMPANY_FTF_RATE',
    description: 'Company-wide first-time fix rate',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['service.performance.view_company', 'executive.dashboard.view'],
    calculationSql: `
      SELECT
        (COUNT(t.id) FILTER (WHERE t.first_time_fix = true) / NULLIF(COUNT(t.id), 0) * 100) as kpi_value
      FROM service_tickets t
      WHERE t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
    `,
    targetValue: 85,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['service', 'ftf', 'quality', 'company', 'level-6'],
  },
  {
    name: 'Company Average CSAT',
    code: 'SERVICE_COMPANY_CSAT',
    description: 'Company-wide average customer satisfaction score',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['service.performance.view_company', 'executive.dashboard.view'],
    calculationSql: `
      SELECT
        AVG(sr.rating) as kpi_value
      FROM service_tickets t
      JOIN satisfaction_ratings sr ON sr.ticket_id = t.id
      WHERE t.tenant_id = :tenantId
        AND t.completed_date >= :dateFrom
    `,
    targetValue: 4.5,
    targetType: 'absolute',
    displayFormat: 'decimal',
    suffix: ' / 5',
    decimalPlaces: 2,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['service', 'csat', 'satisfaction', 'company', 'level-6'],
  },
];

// =====================================================================
// OPERATIONS KPIS
// =====================================================================

const OPERATIONS_KPIS: KPIDefinition[] = [
  {
    name: 'Inventory Accuracy',
    code: 'OPS_INVENTORY_ACCURACY',
    description: 'Percentage of cycle counts that match system inventory',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.inventory.view_location'],
    calculationSql: `
      SELECT
        (COUNT(cc.id) FILTER (WHERE cc.is_accurate = true) / NULLIF(COUNT(cc.id), 0) * 100) as kpi_value
      FROM cycle_counts cc
      WHERE cc.location_id = :locationId
        AND cc.tenant_id = :tenantId
        AND cc.count_date >= :dateFrom
    `,
    targetValue: 98,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    colorScheme: {
      ranges: [
        { min: 0, max: 95, color: '#ff4d4f', label: 'Poor' },
        { min: 95, max: 98, color: '#faad14', label: 'Fair' },
        { min: 98, max: 99.5, color: '#52c41a', label: 'Good' },
        { min: 99.5, max: 100, color: '#1890ff', label: 'Excellent' },
      ],
    },
    alertEnabled: true,
    alertThresholds: {
      critical: 95,
      warning: 97,
      message: 'Inventory accuracy below target',
    },
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['operations', 'inventory', 'accuracy', 'location', 'level-3', 'level-4'],
  },
  {
    name: 'Inventory Turns',
    code: 'OPS_INVENTORY_TURNS',
    description: 'Number of times inventory is sold and replaced per year',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.inventory.view_location'],
    calculationSql: `
      SELECT
        (SUM(cogs.cost_of_goods_sold) / NULLIF(AVG(inv.total_inventory_value), 0)) as kpi_value
      FROM inventory_metrics inv
      CROSS JOIN (
        SELECT SUM(order_cost) as cost_of_goods_sold
        FROM orders
        WHERE location_id = :locationId
          AND tenant_id = :tenantId
          AND order_date >= DATE_TRUNC('year', CURRENT_DATE)
      ) cogs
      WHERE inv.location_id = :locationId
        AND inv.tenant_id = :tenantId
        AND inv.metric_date >= DATE_TRUNC('year', CURRENT_DATE)
    `,
    targetValue: 6,
    targetType: 'ratio',
    displayFormat: 'decimal',
    suffix: 'x',
    decimalPlaces: 1,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['operations', 'inventory', 'turns', 'location', 'level-4'],
  },
  {
    name: 'Order Fill Rate',
    code: 'OPS_ORDER_FILL_RATE',
    description: 'Percentage of orders filled completely from stock',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.performance.view_location'],
    calculationSql: `
      SELECT
        (COUNT(o.id) FILTER (WHERE o.filled_completely = true) / NULLIF(COUNT(o.id), 0) * 100) as kpi_value
      FROM orders o
      WHERE o.location_id = :locationId
        AND o.tenant_id = :tenantId
        AND o.order_date >= :dateFrom
    `,
    targetValue: 95,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['operations', 'fill-rate', 'location', 'level-4'],
  },
  {
    name: 'First Pass Yield (FPY)',
    code: 'OPS_FPY_RATE',
    description: 'Percentage of work orders completed correctly first time',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.fpy.view_location'],
    calculationSql: `
      SELECT
        (COUNT(wo.id) FILTER (WHERE wo.first_pass_yield = true) / NULLIF(COUNT(wo.id), 0) * 100) as kpi_value
      FROM work_orders wo
      WHERE wo.location_id = :locationId
        AND wo.tenant_id = :tenantId
        AND wo.completed_date >= :dateFrom
    `,
    targetValue: 95,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    isHighPriority: true,
    tags: ['operations', 'fpy', 'quality', 'location', 'level-3', 'level-4'],
  },
  {
    name: 'On-Time Delivery Rate',
    code: 'OPS_ON_TIME_DELIVERY_RATE',
    description: 'Percentage of deliveries completed on time',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.logistics.view_location'],
    calculationSql: `
      SELECT
        (COUNT(d.id) FILTER (WHERE d.delivered_on_time = true) / NULLIF(COUNT(d.id), 0) * 100) as kpi_value
      FROM deliveries d
      WHERE d.location_id = :locationId
        AND d.tenant_id = :tenantId
        AND d.delivery_date >= :dateFrom
    `,
    targetValue: 95,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['operations', 'delivery', 'on-time', 'location', 'level-4'],
  },
  {
    name: 'Warehouse Productivity',
    code: 'OPS_WAREHOUSE_PRODUCTIVITY',
    description: 'Units processed per labor hour',
    category: 'operations',
    organizationalScope: 'location',
    requiredPermissions: ['operations.performance.view_location'],
    calculationSql: `
      SELECT
        (SUM(wm.units_processed) / NULLIF(SUM(wm.labor_hours), 0)) as kpi_value
      FROM warehouse_daily_metrics wm
      WHERE wm.location_id = :locationId
        AND wm.tenant_id = :tenantId
        AND wm.metric_date >= :dateFrom
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'decimal',
    suffix: ' units/hr',
    decimalPlaces: 1,
    refreshFrequency: 3600,
    cacheDuration: 1800,
    tags: ['operations', 'productivity', 'warehouse', 'location', 'level-4'],
  },
];

// =====================================================================
// FINANCE KPIS
// =====================================================================

const FINANCE_KPIS: KPIDefinition[] = [
  {
    name: 'Revenue Growth Rate (YoY)',
    code: 'FINANCE_REVENUE_GROWTH_YOY',
    description: 'Year-over-year revenue growth percentage',
    category: 'finance',
    organizationalScope: 'company',
    requiredPermissions: ['finance.performance.view_company', 'executive.kpis.view'],
    calculationSql: `
      SELECT
        ((current_year.revenue - prior_year.revenue) / NULLIF(prior_year.revenue, 0) * 100) as kpi_value
      FROM (
        SELECT SUM(total_revenue) as revenue
        FROM financial_metrics
        WHERE tenant_id = :tenantId
          AND period_date >= DATE_TRUNC('year', CURRENT_DATE)
      ) current_year
      CROSS JOIN (
        SELECT SUM(total_revenue) as revenue
        FROM financial_metrics
        WHERE tenant_id = :tenantId
          AND period_date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
          AND period_date < DATE_TRUNC('year', CURRENT_DATE)
      ) prior_year
    `,
    targetValue: 15,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['finance', 'revenue', 'growth', 'company', 'level-6', 'level-7'],
  },
  {
    name: 'Gross Margin Percentage',
    code: 'FINANCE_GROSS_MARGIN_PCT',
    description: 'Gross profit as a percentage of revenue',
    category: 'finance',
    organizationalScope: 'company',
    requiredPermissions: ['finance.performance.view_company'],
    calculationSql: `
      SELECT
        (SUM(gross_profit) / NULLIF(SUM(total_revenue), 0) * 100) as kpi_value
      FROM financial_metrics
      WHERE tenant_id = :tenantId
        AND period_date >= :dateFrom
    `,
    targetValue: 40,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['finance', 'margin', 'profitability', 'company', 'level-6'],
  },
  {
    name: 'Operating Margin Percentage',
    code: 'FINANCE_OPERATING_MARGIN_PCT',
    description: 'Operating income as a percentage of revenue',
    category: 'finance',
    organizationalScope: 'company',
    requiredPermissions: ['finance.performance.view_company'],
    calculationSql: `
      SELECT
        (SUM(operating_income) / NULLIF(SUM(total_revenue), 0) * 100) as kpi_value
      FROM financial_metrics
      WHERE tenant_id = :tenantId
        AND period_date >= :dateFrom
    `,
    targetValue: 15,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['finance', 'margin', 'operating', 'company', 'level-6'],
  },
  {
    name: 'EBITDA Margin Percentage',
    code: 'FINANCE_EBITDA_MARGIN_PCT',
    description: 'EBITDA as a percentage of revenue',
    category: 'finance',
    organizationalScope: 'company',
    requiredPermissions: ['finance.performance.view_company', 'executive.kpis.view'],
    calculationSql: `
      SELECT
        (SUM(ebitda) / NULLIF(SUM(total_revenue), 0) * 100) as kpi_value
      FROM financial_metrics
      WHERE tenant_id = :tenantId
        AND period_date >= :dateFrom
    `,
    targetValue: 20,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['finance', 'ebitda', 'margin', 'company', 'level-6', 'level-7'],
  },
  {
    name: 'Days Sales Outstanding (DSO)',
    code: 'FINANCE_DSO',
    description: 'Average number of days to collect payment',
    category: 'finance',
    organizationalScope: 'company',
    requiredPermissions: ['finance.ar.view_company'],
    calculationSql: `
      SELECT
        (SUM(inv.balance_due) / (SUM(fm.total_revenue) / 365)) as kpi_value
      FROM invoices inv
      CROSS JOIN (
        SELECT SUM(total_revenue) as total_revenue
        FROM financial_metrics
        WHERE tenant_id = :tenantId
          AND period_date >= DATE_TRUNC('year', CURRENT_DATE)
      ) fm
      WHERE inv.tenant_id = :tenantId
        AND inv.payment_status != 'Paid'
    `,
    targetValue: 45,
    targetType: 'absolute',
    displayFormat: 'number',
    suffix: ' days',
    decimalPlaces: 0,
    colorScheme: {
      ranges: [
        { min: 0, max: 30, color: '#1890ff', label: 'Excellent' },
        { min: 30, max: 45, color: '#52c41a', label: 'Good' },
        { min: 45, max: 60, color: '#faad14', label: 'Fair' },
        { min: 60, max: 999, color: '#ff4d4f', label: 'Poor' },
      ],
      inverted: true,
    },
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['finance', 'dso', 'ar', 'company', 'level-6'],
  },
  {
    name: 'Current Ratio',
    code: 'FINANCE_CURRENT_RATIO',
    description: 'Current assets divided by current liabilities',
    category: 'finance',
    organizationalScope: 'company',
    requiredPermissions: ['finance.statements.view_company'],
    calculationSql: `
      SELECT
        (current_assets.amount / NULLIF(current_liabilities.amount, 0)) as kpi_value
      FROM (
        SELECT SUM(actual_amount) as amount
        FROM financial_statements
        WHERE tenant_id = :tenantId
          AND statement_type = 'Balance Sheet'
          AND account_category = 'Current Assets'
          AND period_end_date = :periodEndDate
      ) current_assets
      CROSS JOIN (
        SELECT SUM(actual_amount) as amount
        FROM financial_statements
        WHERE tenant_id = :tenantId
          AND statement_type = 'Balance Sheet'
          AND account_category = 'Current Liabilities'
          AND period_end_date = :periodEndDate
      ) current_liabilities
    `,
    targetValue: 2.0,
    targetType: 'ratio',
    displayFormat: 'decimal',
    suffix: ':1',
    decimalPlaces: 2,
    refreshFrequency: 86400,
    cacheDuration: 86400,
    tags: ['finance', 'liquidity', 'current-ratio', 'company', 'level-6'],
  },
  {
    name: 'Quick Ratio',
    code: 'FINANCE_QUICK_RATIO',
    description: 'Liquid assets divided by current liabilities',
    category: 'finance',
    organizationalScope: 'company',
    requiredPermissions: ['finance.statements.view_company'],
    calculationSql: `
      SELECT
        ((current_assets.amount - inventory.amount) / NULLIF(current_liabilities.amount, 0)) as kpi_value
      FROM (
        SELECT SUM(actual_amount) as amount FROM financial_statements
        WHERE tenant_id = :tenantId AND statement_type = 'Balance Sheet'
          AND account_category = 'Current Assets' AND period_end_date = :periodEndDate
      ) current_assets
      CROSS JOIN (
        SELECT SUM(actual_amount) as amount FROM financial_statements
        WHERE tenant_id = :tenantId AND statement_type = 'Balance Sheet'
          AND line_item = 'Inventory' AND period_end_date = :periodEndDate
      ) inventory
      CROSS JOIN (
        SELECT SUM(actual_amount) as amount FROM financial_statements
        WHERE tenant_id = :tenantId AND statement_type = 'Balance Sheet'
          AND account_category = 'Current Liabilities' AND period_end_date = :periodEndDate
      ) current_liabilities
    `,
    targetValue: 1.0,
    targetType: 'ratio',
    displayFormat: 'decimal',
    suffix: ':1',
    decimalPlaces: 2,
    refreshFrequency: 86400,
    cacheDuration: 86400,
    tags: ['finance', 'liquidity', 'quick-ratio', 'company', 'level-6'],
  },
];

// =====================================================================
// EXECUTIVE/STRATEGIC KPIS
// =====================================================================

const EXECUTIVE_KPIS: KPIDefinition[] = [
  {
    name: 'Customer Acquisition Cost (CAC)',
    code: 'EXECUTIVE_CAC',
    description: 'Average cost to acquire a new customer',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.kpis.view'],
    calculationSql: `
      SELECT
        (SUM(sm.sales_expense + sm.marketing_expense) /
         NULLIF(COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= :dateFrom), 0)) as kpi_value
      FROM sales_marketing_expenses sm
      CROSS JOIN business_records c
      WHERE sm.tenant_id = :tenantId
        AND c.tenant_id = :tenantId
        AND sm.expense_date >= :dateFrom
        AND c.record_type = 'customer'
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'currency',
    prefix: '$',
    decimalPlaces: 0,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['executive', 'cac', 'strategic', 'company', 'level-7'],
  },
  {
    name: 'Customer Lifetime Value (CLV)',
    code: 'EXECUTIVE_CLV',
    description: 'Average revenue per customer over their lifetime',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.kpis.view'],
    calculationSql: `
      SELECT
        AVG(c.customer_lifetime_value) as kpi_value
      FROM business_records c
      WHERE c.tenant_id = :tenantId
        AND c.record_type = 'customer'
        AND c.status = 'Active'
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'currency',
    prefix: '$',
    decimalPlaces: 0,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['executive', 'clv', 'ltv', 'strategic', 'company', 'level-7'],
  },
  {
    name: 'CLV to CAC Ratio',
    code: 'EXECUTIVE_CLV_CAC_RATIO',
    description: 'Ratio of customer lifetime value to acquisition cost',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.kpis.view'],
    calculationSql: `
      SELECT
        (clv.value / NULLIF(cac.value, 0)) as kpi_value
      FROM (
        SELECT AVG(customer_lifetime_value) as value
        FROM business_records
        WHERE tenant_id = :tenantId AND record_type = 'customer' AND status = 'Active'
      ) clv
      CROSS JOIN (
        SELECT (SUM(sales_expense + marketing_expense) /
          NULLIF(COUNT(DISTINCT c.id), 0)) as value
        FROM sales_marketing_expenses sm
        CROSS JOIN business_records c
        WHERE sm.tenant_id = :tenantId AND c.tenant_id = :tenantId
          AND sm.expense_date >= DATE_TRUNC('year', CURRENT_DATE)
          AND c.created_at >= DATE_TRUNC('year', CURRENT_DATE)
      ) cac
    `,
    targetValue: 3.0,
    targetType: 'ratio',
    displayFormat: 'decimal',
    suffix: ':1',
    decimalPlaces: 1,
    colorScheme: {
      ranges: [
        { min: 0, max: 1, color: '#ff4d4f', label: 'Unsustainable' },
        { min: 1, max: 3, color: '#faad14', label: 'Marginal' },
        { min: 3, max: 5, color: '#52c41a', label: 'Good' },
        { min: 5, max: 999, color: '#1890ff', label: 'Excellent' },
      ],
    },
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['executive', 'clv-cac-ratio', 'strategic', 'company', 'level-7'],
  },
  {
    name: 'Net Promoter Score (NPS)',
    code: 'EXECUTIVE_NPS',
    description: 'Customer loyalty and satisfaction metric (-100 to +100)',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.kpis.view'],
    calculationSql: `
      SELECT
        ((COUNT(*) FILTER (WHERE rating >= 9) / NULLIF(COUNT(*), 0) * 100) -
         (COUNT(*) FILTER (WHERE rating <= 6) / NULLIF(COUNT(*), 0) * 100)) as kpi_value
      FROM nps_surveys
      WHERE tenant_id = :tenantId
        AND survey_date >= :dateFrom
    `,
    targetValue: 50,
    targetType: 'absolute',
    displayFormat: 'number',
    decimalPlaces: 0,
    colorScheme: {
      ranges: [
        { min: -100, max: 0, color: '#ff4d4f', label: 'Poor' },
        { min: 0, max: 30, color: '#faad14', label: 'Fair' },
        { min: 30, max: 50, color: '#52c41a', label: 'Good' },
        { min: 50, max: 100, color: '#1890ff', label: 'Excellent' },
      ],
    },
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['executive', 'nps', 'satisfaction', 'strategic', 'company', 'level-7'],
  },
  {
    name: 'Employee Engagement Score',
    code: 'EXECUTIVE_EMPLOYEE_ENGAGEMENT',
    description: 'Average employee engagement survey score (1-5 scale)',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.kpis.view', 'hr.analytics.view'],
    calculationSql: `
      SELECT
        AVG(engagement_score) as kpi_value
      FROM employee_engagement_surveys
      WHERE tenant_id = :tenantId
        AND survey_date >= :dateFrom
    `,
    targetValue: 4.0,
    targetType: 'absolute',
    displayFormat: 'decimal',
    suffix: ' / 5',
    decimalPlaces: 2,
    refreshFrequency: 86400,
    cacheDuration: 86400,
    tags: ['executive', 'hr', 'engagement', 'strategic', 'company', 'level-7'],
  },
  {
    name: 'Customer Retention Rate',
    code: 'EXECUTIVE_CUSTOMER_RETENTION_RATE',
    description: 'Percentage of customers retained year-over-year',
    category: 'executive',
    organizationalScope: 'company',
    requiredPermissions: ['executive.kpis.view'],
    calculationSql: `
      SELECT
        (COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'Active' AND c.created_at < DATE_TRUNC('year', CURRENT_DATE)) /
         NULLIF(COUNT(DISTINCT c.id) FILTER (WHERE c.created_at < DATE_TRUNC('year', CURRENT_DATE)), 0) * 100) as kpi_value
      FROM business_records c
      WHERE c.tenant_id = :tenantId
        AND c.record_type = 'customer'
    `,
    targetValue: 90,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['executive', 'retention', 'churn', 'strategic', 'company', 'level-7'],
  },
];

// =====================================================================
// PLATFORM ADMIN KPIS
// =====================================================================

const PLATFORM_KPIS: KPIDefinition[] = [
  {
    name: 'Platform Uptime Percentage',
    code: 'PLATFORM_UPTIME_PCT',
    description: 'System availability percentage',
    category: 'it',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.metrics.view'],
    calculationSql: `
      SELECT
        AVG(system_uptime_pct) as kpi_value
      FROM platform_metrics
      WHERE metric_timestamp >= :dateFrom
    `,
    targetValue: 99.9,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 2,
    alertEnabled: true,
    alertThresholds: {
      critical: 99.0,
      warning: 99.5,
      message: 'Platform uptime below SLA',
    },
    refreshFrequency: 300,
    cacheDuration: 60,
    isHighPriority: true,
    tags: ['platform', 'uptime', 'sla', 'level-8'],
  },
  {
    name: 'Average API Response Time',
    code: 'PLATFORM_API_RESPONSE_TIME',
    description: 'Average API response time in milliseconds',
    category: 'it',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.metrics.view'],
    calculationSql: `
      SELECT
        AVG(api_response_time_ms) as kpi_value
      FROM platform_metrics
      WHERE metric_timestamp >= :dateFrom
    `,
    targetValue: 200,
    targetType: 'absolute',
    displayFormat: 'number',
    suffix: ' ms',
    decimalPlaces: 0,
    colorScheme: {
      ranges: [
        { min: 0, max: 100, color: '#1890ff', label: 'Excellent' },
        { min: 100, max: 200, color: '#52c41a', label: 'Good' },
        { min: 200, max: 500, color: '#faad14', label: 'Fair' },
        { min: 500, max: 99999, color: '#ff4d4f', label: 'Slow' },
      ],
      inverted: true,
    },
    refreshFrequency: 300,
    cacheDuration: 60,
    isHighPriority: true,
    tags: ['platform', 'performance', 'api', 'level-8'],
  },
  {
    name: 'Platform Error Rate',
    code: 'PLATFORM_ERROR_RATE',
    description: 'Percentage of API requests resulting in errors',
    category: 'it',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.metrics.view'],
    calculationSql: `
      SELECT
        (SUM(error_count) / NULLIF(SUM(request_count), 0) * 100) as kpi_value
      FROM platform_metrics
      WHERE metric_timestamp >= :dateFrom
    `,
    targetValue: 0.1,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 2,
    alertEnabled: true,
    alertThresholds: {
      critical: 1.0,
      warning: 0.5,
      message: 'Platform error rate elevated',
    },
    refreshFrequency: 300,
    cacheDuration: 60,
    isHighPriority: true,
    tags: ['platform', 'errors', 'reliability', 'level-8'],
  },
  {
    name: 'Monthly Recurring Revenue (MRR)',
    code: 'PLATFORM_MRR',
    description: 'Total monthly recurring revenue from all tenants',
    category: 'finance',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.billing.view'],
    calculationSql: `
      SELECT
        SUM(subscription_revenue) as kpi_value
      FROM platform_billing
      WHERE billing_date = DATE_TRUNC('month', CURRENT_DATE)
    `,
    targetValue: null,
    targetType: 'absolute',
    displayFormat: 'currency',
    prefix: '$',
    decimalPlaces: 0,
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['platform', 'mrr', 'revenue', 'level-8'],
  },
  {
    name: 'Tenant Churn Rate',
    code: 'PLATFORM_TENANT_CHURN_RATE',
    description: 'Percentage of tenants who cancelled in the period',
    category: 'finance',
    organizationalScope: 'platform',
    requiredPermissions: ['platform.billing.view'],
    calculationSql: `
      SELECT
        (COUNT(DISTINCT tenant_id) FILTER (WHERE is_churned = true) /
         NULLIF(COUNT(DISTINCT tenant_id), 0) * 100) as kpi_value
      FROM platform_billing
      WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND billing_date < DATE_TRUNC('month', CURRENT_DATE)
    `,
    targetValue: 5,
    targetType: 'percentage',
    displayFormat: 'percentage',
    suffix: '%',
    decimalPlaces: 1,
    colorScheme: {
      ranges: [
        { min: 0, max: 2, color: '#1890ff', label: 'Excellent' },
        { min: 2, max: 5, color: '#52c41a', label: 'Good' },
        { min: 5, max: 10, color: '#faad14', label: 'Fair' },
        { min: 10, max: 100, color: '#ff4d4f', label: 'High' },
      ],
      inverted: true,
    },
    refreshFrequency: 86400,
    cacheDuration: 43200,
    isHighPriority: true,
    tags: ['platform', 'churn', 'retention', 'level-8'],
  },
];

// =====================================================================
// SEEDER EXECUTION FUNCTION
// =====================================================================

export async function seedKPIs() {
  console.log('🌱 Starting KPI Definitions Seeder...\n');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // Get or create a system tenant for seeding
    const systemTenantId = 'SYSTEM'; // This would be replaced with actual tenant ID
    const systemUserId = 'SYSTEM'; // This would be replaced with actual user ID

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ kpi: string; error: string }> = [];

    // Combine all KPI arrays
    const ALL_KPIS = [
      ...SALES_KPIS,
      ...SERVICE_KPIS,
      ...OPERATIONS_KPIS,
      ...FINANCE_KPIS,
      ...EXECUTIVE_KPIS,
      ...PLATFORM_KPIS,
    ];

    console.log(`📊 Seeding ${ALL_KPIS.length} KPI definitions...\n`);

    // Seed each KPI
    for (const kpi of ALL_KPIS) {
      try {
        await db
          .insert(kpiDefinitions)
          .values({
            tenantId: systemTenantId,
            name: kpi.name,
            code: kpi.code,
            description: kpi.description || '',
            category: kpi.category,
            calculationSql: kpi.calculationSql,
            targetValue: kpi.targetValue?.toString() || null,
            targetType: kpi.targetType || 'absolute',
            displayFormat: kpi.displayFormat,
            prefix: kpi.prefix || null,
            suffix: kpi.suffix || null,
            decimalPlaces: kpi.decimalPlaces || 0,
            colorScheme: kpi.colorScheme || {},
            alertEnabled: kpi.alertEnabled || false,
            alertThresholds: kpi.alertThresholds || {},
            alertRecipients: kpi.alertRecipients || [],
            requiredPermissions: kpi.requiredPermissions,
            organizationalScope: kpi.organizationalScope,
            refreshFrequency: kpi.refreshFrequency || 3600,
            cacheDuration: kpi.cacheDuration || 1800,
            isActive: true,
            isHighPriority: kpi.isHighPriority || false,
            tags: kpi.tags || [],
            createdBy: systemUserId,
          })
          .onConflictDoUpdate({
            target: [kpiDefinitions.code, kpiDefinitions.tenantId],
            set: {
              name: kpi.name,
              description: kpi.description || '',
              calculationSql: kpi.calculationSql,
              updatedAt: new Date(),
            },
          });

        successCount++;
        console.log(`  ✅ ${kpi.code.padEnd(45)} - ${kpi.name}`);
      } catch (error: any) {
        errorCount++;
        errors.push({ kpi: kpi.code, error: error.message });
        console.error(`  ❌ ${kpi.code.padEnd(45)} - ERROR: ${error.message}`);
      }
    }

    console.log('\n════════════════════════════════════════════════════════════════\n');
    console.log('📈 SEEDING SUMMARY\n');
    console.log(`  Total KPIs Processed: ${ALL_KPIS.length}`);
    console.log(`  ✅ Successfully Seeded:  ${successCount}`);
    console.log(`  ❌ Errors:               ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n❌ ERRORS DETAILS:\n');
      errors.forEach(({ kpi, error }) => {
        console.log(`  ${kpi}: ${error}`);
      });
    }

    console.log('\n════════════════════════════════════════════════════════════════\n');
    console.log('✅ KPI Definitions Seeder Completed!\n');

    return { successCount, errorCount, errors };
  } catch (error: any) {
    console.error('\n❌ CRITICAL ERROR during KPI seeding:');
    console.error(error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  seedKPIs()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}
