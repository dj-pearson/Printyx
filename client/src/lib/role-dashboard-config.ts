/**
 * Role-Specific Dashboard Configuration
 *
 * RBAC-009: Maps role levels to the widgets, KPIs, and quick actions
 * that should appear on their dashboard.
 */

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'kpi' | 'chart' | 'list' | 'activity';
  dataSource: string;
  colspan?: 1 | 2 | 3;
}

export interface DashboardConfig {
  greeting: string;
  kpis: string[];
  widgets: DashboardWidget[];
  quickActions: { label: string; path: string; icon: string }[];
}

/** Sales Rep (Level 1-2) */
const salesRepConfig: DashboardConfig = {
  greeting: 'Your Sales Pipeline',
  kpis: ['my_leads_count', 'my_pipeline_value', 'my_quotes_pending', 'my_win_rate'],
  widgets: [
    { id: 'my-leads', title: 'My Active Leads', type: 'list', dataSource: '/api/leads?scope=own' },
    {
      id: 'my-pipeline',
      title: 'My Pipeline',
      type: 'chart',
      dataSource: '/api/pipeline?scope=own',
    },
    {
      id: 'my-activity',
      title: 'Recent Activity',
      type: 'activity',
      dataSource: '/api/activities?scope=own',
    },
    {
      id: 'my-tasks',
      title: 'My Tasks Today',
      type: 'list',
      dataSource: '/api/tasks?scope=own&due=today',
    },
  ],
  quickActions: [
    { label: 'New Lead', path: '/leads?action=new', icon: 'UserPlus' },
    { label: 'New Quote', path: '/quotes/new', icon: 'FileText' },
    { label: 'My Tasks', path: '/task-hub', icon: 'CheckSquare' },
    { label: 'Calendar', path: '/calendar', icon: 'Calendar' },
  ],
};

/** Manager (Level 3-4) */
const managerConfig: DashboardConfig = {
  greeting: 'Team Performance',
  kpis: ['team_leads_count', 'team_pipeline_value', 'team_win_rate', 'team_revenue_mtd'],
  widgets: [
    {
      id: 'team-pipeline',
      title: 'Team Pipeline',
      type: 'chart',
      dataSource: '/api/pipeline?scope=team',
      colspan: 2,
    },
    {
      id: 'team-leaderboard',
      title: 'Rep Leaderboard',
      type: 'list',
      dataSource: '/api/sales-performance?scope=team',
    },
    {
      id: 'pending-approvals',
      title: 'Pending Approvals',
      type: 'list',
      dataSource: '/api/deal-desk/pending',
    },
    {
      id: 'team-activity',
      title: 'Team Activity',
      type: 'activity',
      dataSource: '/api/activities?scope=team',
    },
  ],
  quickActions: [
    { label: 'Approve Quotes', path: '/deal-desk', icon: 'CheckCircle' },
    { label: 'Team Report', path: '/reports', icon: 'BarChart3' },
    { label: 'Pipeline View', path: '/sales-pipeline', icon: 'TrendingUp' },
    { label: 'Assign Leads', path: '/auto-lead-routing', icon: 'Users' },
  ],
};

/** Director (Level 5-6) */
const directorConfig: DashboardConfig = {
  greeting: 'Regional Overview',
  kpis: ['regional_revenue', 'regional_pipeline', 'regional_churn_risk', 'contract_renewals_due'],
  widgets: [
    {
      id: 'revenue-trend',
      title: 'Revenue Trend',
      type: 'chart',
      dataSource: '/api/reports/revenue?scope=regional',
      colspan: 2,
    },
    {
      id: 'top-accounts',
      title: 'Top Accounts',
      type: 'list',
      dataSource: '/api/customers?sort=revenue&scope=regional',
    },
    {
      id: 'service-sla',
      title: 'SLA Performance',
      type: 'chart',
      dataSource: '/api/service-analytics?scope=regional',
    },
    { id: 'forecast', title: 'Forecast', type: 'chart', dataSource: '/api/financial-forecasting' },
  ],
  quickActions: [
    { label: 'Executive Dashboard', path: '/executive-dashboard', icon: 'BarChart3' },
    { label: 'Financial Intel', path: '/financial-intelligence-dashboard', icon: 'DollarSign' },
    { label: 'Contract Renewals', path: '/contract-renewals', icon: 'FileText' },
    { label: 'Customer Health', path: '/customer-success', icon: 'Heart' },
  ],
};

/** Executive (Level 7) */
const executiveConfig: DashboardConfig = {
  greeting: 'Company Dashboard',
  kpis: ['total_revenue_mtd', 'total_pipeline', 'customer_count', 'service_sla_rate'],
  widgets: [
    {
      id: 'company-revenue',
      title: 'Revenue Overview',
      type: 'chart',
      dataSource: '/api/reports/revenue',
      colspan: 2,
    },
    { id: 'pipeline-health', title: 'Pipeline Health', type: 'chart', dataSource: '/api/pipeline' },
    {
      id: 'churn-risk',
      title: 'At-Risk Accounts',
      type: 'list',
      dataSource: '/api/customers?filter=churn_risk',
    },
    {
      id: 'kpi-summary',
      title: 'KPI Summary',
      type: 'chart',
      dataSource: '/api/kpis/summary',
      colspan: 2,
    },
  ],
  quickActions: [
    { label: 'Sales Command', path: '/sales-command-center', icon: 'Target' },
    { label: 'Financial Forecast', path: '/financial-forecasting', icon: 'TrendingUp' },
    { label: 'Advanced Analytics', path: '/advanced-analytics', icon: 'BarChart3' },
    { label: 'Reports Hub', path: '/reports', icon: 'FileText' },
  ],
};

/** Platform Admin (Level 8) */
const platformAdminConfig: DashboardConfig = {
  greeting: 'Platform Operations',
  kpis: ['total_tenants', 'active_users', 'system_health', 'support_tickets'],
  widgets: [
    {
      id: 'tenant-overview',
      title: 'Tenant Overview',
      type: 'list',
      dataSource: '/api/platform/tenants',
      colspan: 2,
    },
    {
      id: 'system-health',
      title: 'System Health',
      type: 'chart',
      dataSource: '/api/system-monitoring',
    },
    {
      id: 'recent-signups',
      title: 'Recent Signups',
      type: 'list',
      dataSource: '/api/platform/signups',
    },
    {
      id: 'platform-revenue',
      title: 'Platform Revenue',
      type: 'chart',
      dataSource: '/api/platform/analytics',
      colspan: 2,
    },
  ],
  quickActions: [
    { label: 'Admin Hub', path: '/admin-hub', icon: 'Shield' },
    { label: 'Tenant Management', path: '/admin/tenant-management', icon: 'Building2' },
    { label: 'User Management', path: '/admin/user-management', icon: 'Users' },
    { label: 'System Monitor', path: '/system-monitoring', icon: 'Monitor' },
  ],
};

/**
 * Get dashboard configuration for the given role level.
 */
export function getDashboardConfig(roleLevel: number): DashboardConfig {
  if (roleLevel >= 8) return platformAdminConfig;
  if (roleLevel >= 7) return executiveConfig;
  if (roleLevel >= 5) return directorConfig;
  if (roleLevel >= 3) return managerConfig;
  return salesRepConfig;
}
