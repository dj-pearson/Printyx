/**
 * Dashboard Widget Registry
 *
 * Central registry of all available dashboard widgets with their metadata,
 * role mappings, permission requirements, and default configurations.
 *
 * Each widget entry defines:
 * - key: Unique identifier used in layouts
 * - name/description: Display info
 * - category: Grouping (sales, service, finance, operations, team, tasks, analytics)
 * - type: Visual type (stat, chart, list, table, pipeline, feed, calendar)
 * - defaultSize: Grid width (1-12) and height
 * - minLevel: Minimum role level (1-8) required
 * - applicableRoles: Role codes that see this widget by default
 * - requiredPermission: RBAC permission code (null = no restriction beyond level)
 */

export type WidgetCategory =
  | 'sales'
  | 'service'
  | 'finance'
  | 'operations'
  | 'team'
  | 'tasks'
  | 'analytics';

export type WidgetType =
  | 'stat'
  | 'chart'
  | 'list'
  | 'table'
  | 'pipeline'
  | 'feed'
  | 'calendar'
  | 'gauge'
  | 'leaderboard'
  | 'actions';

export interface WidgetSize {
  w: number; // grid columns (1-12)
  h: number; // height in grid rows
}

export interface WidgetDefinition {
  key: string;
  name: string;
  description: string;
  category: WidgetCategory;
  type: WidgetType;
  icon: string;
  defaultSize: WidgetSize;
  minSize?: WidgetSize;
  maxSize?: WidgetSize;
  minLevel: number;
  applicableRoles: string[];
  requiredPermission: string | null;
  supportsRefresh: boolean;
  supportsDrillDown: boolean;
  dataEndpoint: string;
}

export interface LayoutWidgetConfig {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

// ============================================================================
// WIDGET DEFINITIONS
// ============================================================================

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  // ── SALES WIDGETS ──────────────────────────────────────────────────
  {
    key: 'my-revenue',
    name: 'My Revenue',
    description: 'Your personal revenue for the current period',
    category: 'sales',
    type: 'stat',
    icon: 'DollarSign',
    defaultSize: { w: 3, h: 1 },
    minLevel: 1,
    applicableRoles: ['SALES_REP', 'SENIOR_SALES_REP', 'SALES_SUPERVISOR', 'SALES_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/my-revenue',
  },
  {
    key: 'my-deals',
    name: 'My Active Deals',
    description: 'Number of your active deals in the pipeline',
    category: 'sales',
    type: 'stat',
    icon: 'Target',
    defaultSize: { w: 3, h: 1 },
    minLevel: 1,
    applicableRoles: ['SALES_REP', 'SENIOR_SALES_REP', 'SALES_SUPERVISOR', 'SALES_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/my-deals',
  },
  {
    key: 'my-leads',
    name: 'My Leads',
    description: 'Your assigned leads and prospects',
    category: 'sales',
    type: 'stat',
    icon: 'UserPlus',
    defaultSize: { w: 3, h: 1 },
    minLevel: 1,
    applicableRoles: ['SALES_REP', 'SENIOR_SALES_REP', 'SALES_SUPERVISOR', 'SALES_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/my-leads',
  },
  {
    key: 'my-quotes',
    name: 'Pending Quotes',
    description: 'Quotes awaiting customer response',
    category: 'sales',
    type: 'stat',
    icon: 'FileText',
    defaultSize: { w: 3, h: 1 },
    minLevel: 1,
    applicableRoles: ['SALES_REP', 'SENIOR_SALES_REP', 'SALES_SUPERVISOR', 'SALES_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/my-quotes',
  },
  {
    key: 'deal-pipeline',
    name: 'Deal Pipeline',
    description: 'Visual pipeline with deals by stage and value',
    category: 'sales',
    type: 'pipeline',
    icon: 'BarChart3',
    defaultSize: { w: 6, h: 2 },
    minLevel: 1,
    applicableRoles: ['SALES_REP', 'SENIOR_SALES_REP', 'SALES_SUPERVISOR', 'SALES_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/deal-pipeline',
  },
  {
    key: 'win-rate',
    name: 'Win Rate',
    description: 'Your deal close rate over time',
    category: 'sales',
    type: 'gauge',
    icon: 'TrendingUp',
    defaultSize: { w: 3, h: 1 },
    minLevel: 1,
    applicableRoles: ['SALES_REP', 'SENIOR_SALES_REP', 'SALES_SUPERVISOR', 'SALES_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/win-rate',
  },
  {
    key: 'sales-leaderboard',
    name: 'Sales Leaderboard',
    description: 'Top performers by revenue this period',
    category: 'sales',
    type: 'leaderboard',
    icon: 'Trophy',
    defaultSize: { w: 4, h: 2 },
    minLevel: 2,
    applicableRoles: ['SALES_SUPERVISOR', 'SALES_MANAGER', 'COMPANY_ADMIN', 'EXECUTIVE'],
    requiredPermission: 'sales.lead.view_team',
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/sales-leaderboard',
  },
  {
    key: 'follow-ups-today',
    name: 'Follow-ups Today',
    description: 'Scheduled follow-up calls and tasks for today',
    category: 'sales',
    type: 'list',
    icon: 'Phone',
    defaultSize: { w: 4, h: 2 },
    minLevel: 1,
    applicableRoles: ['SALES_REP', 'SENIOR_SALES_REP', 'SALES_SUPERVISOR', 'SALES_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/follow-ups-today',
  },

  // ── SERVICE WIDGETS ────────────────────────────────────────────────
  {
    key: 'my-tickets',
    name: 'My Service Tickets',
    description: 'Your assigned service tickets',
    category: 'service',
    type: 'stat',
    icon: 'Wrench',
    defaultSize: { w: 3, h: 1 },
    minLevel: 1,
    applicableRoles: ['TECHNICIAN', 'SERVICE_SUPERVISOR', 'SERVICE_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/my-tickets',
  },
  {
    key: 'emergency-tickets',
    name: 'Emergency Tickets',
    description: 'Critical priority tickets requiring immediate attention',
    category: 'service',
    type: 'stat',
    icon: 'AlertCircle',
    defaultSize: { w: 3, h: 1 },
    minLevel: 2,
    applicableRoles: ['SERVICE_SUPERVISOR', 'SERVICE_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/emergency-tickets',
  },
  {
    key: 'todays-schedule',
    name: "Today's Schedule",
    description: 'Your job schedule for today',
    category: 'service',
    type: 'list',
    icon: 'Calendar',
    defaultSize: { w: 6, h: 2 },
    minLevel: 1,
    applicableRoles: ['TECHNICIAN', 'SERVICE_SUPERVISOR'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/todays-schedule',
  },
  {
    key: 'team-technician-status',
    name: 'Technician Status',
    description: 'Real-time status of your field technicians',
    category: 'service',
    type: 'table',
    icon: 'Users',
    defaultSize: { w: 4, h: 2 },
    minLevel: 3,
    applicableRoles: ['SERVICE_SUPERVISOR', 'SERVICE_MANAGER'],
    requiredPermission: 'service.ticket.view_team',
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/technician-status',
  },
  {
    key: 'avg-response-time',
    name: 'Avg Response Time',
    description: 'Average time from ticket creation to first response',
    category: 'service',
    type: 'stat',
    icon: 'Clock',
    defaultSize: { w: 3, h: 1 },
    minLevel: 2,
    applicableRoles: ['SERVICE_SUPERVISOR', 'SERVICE_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/avg-response-time',
  },
  {
    key: 'sla-compliance',
    name: 'SLA Compliance',
    description: 'Service level agreement compliance rate',
    category: 'service',
    type: 'gauge',
    icon: 'CheckCircle',
    defaultSize: { w: 3, h: 1 },
    minLevel: 3,
    applicableRoles: ['SERVICE_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/sla-compliance',
  },
  {
    key: 'completion-rate',
    name: 'Completion Rate',
    description: 'Service ticket completion rate this period',
    category: 'service',
    type: 'stat',
    icon: 'CheckCircle',
    defaultSize: { w: 3, h: 1 },
    minLevel: 1,
    applicableRoles: ['TECHNICIAN', 'SERVICE_SUPERVISOR', 'SERVICE_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/completion-rate',
  },

  // ── FINANCE WIDGETS ────────────────────────────────────────────────
  {
    key: 'monthly-revenue',
    name: 'Monthly Revenue',
    description: 'Total revenue for the current month',
    category: 'finance',
    type: 'stat',
    icon: 'DollarSign',
    defaultSize: { w: 3, h: 1 },
    minLevel: 4,
    applicableRoles: [
      'FINANCE_MANAGER',
      'LOCATION_MANAGER',
      'REGIONAL_MANAGER',
      'EXECUTIVE',
      'COMPANY_ADMIN',
    ],
    requiredPermission: 'finance.invoice.view',
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/monthly-revenue',
  },
  {
    key: 'outstanding-invoices',
    name: 'Outstanding Invoices',
    description: 'Total amount of unpaid invoices',
    category: 'finance',
    type: 'stat',
    icon: 'FileText',
    defaultSize: { w: 3, h: 1 },
    minLevel: 4,
    applicableRoles: ['FINANCE_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: 'finance.invoice.view',
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/outstanding-invoices',
  },
  {
    key: 'overdue-invoices',
    name: 'Overdue Invoices',
    description: 'Invoices past their due date',
    category: 'finance',
    type: 'stat',
    icon: 'AlertTriangle',
    defaultSize: { w: 3, h: 1 },
    minLevel: 4,
    applicableRoles: ['FINANCE_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: 'finance.invoice.view',
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/overdue-invoices',
  },
  {
    key: 'revenue-trend',
    name: 'Revenue Trend',
    description: 'Revenue over the last 6 months with trend line',
    category: 'finance',
    type: 'chart',
    icon: 'TrendingUp',
    defaultSize: { w: 6, h: 2 },
    minLevel: 4,
    applicableRoles: ['FINANCE_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: 'finance.invoice.view',
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/revenue-trend',
  },
  {
    key: 'collections-rate',
    name: 'Collections Rate',
    description: 'Percentage of invoices collected on time',
    category: 'finance',
    type: 'gauge',
    icon: 'DollarSign',
    defaultSize: { w: 3, h: 1 },
    minLevel: 5,
    applicableRoles: ['FINANCE_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: 'finance.invoice.view',
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/collections-rate',
  },

  // ── OPERATIONS WIDGETS ─────────────────────────────────────────────
  {
    key: 'active-contracts',
    name: 'Active Contracts',
    description: 'Number of currently active service contracts',
    category: 'operations',
    type: 'stat',
    icon: 'FileText',
    defaultSize: { w: 3, h: 1 },
    minLevel: 3,
    applicableRoles: [
      'SERVICE_MANAGER',
      'LOCATION_MANAGER',
      'REGIONAL_MANAGER',
      'EXECUTIVE',
      'COMPANY_ADMIN',
    ],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/active-contracts',
  },
  {
    key: 'expiring-contracts',
    name: 'Expiring Contracts',
    description: 'Contracts expiring in the next 30 days',
    category: 'operations',
    type: 'list',
    icon: 'AlertTriangle',
    defaultSize: { w: 4, h: 2 },
    minLevel: 3,
    applicableRoles: ['SERVICE_MANAGER', 'SALES_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/expiring-contracts',
  },
  {
    key: 'equipment-status',
    name: 'Equipment Overview',
    description: 'Status breakdown of all managed equipment',
    category: 'operations',
    type: 'chart',
    icon: 'Package',
    defaultSize: { w: 4, h: 2 },
    minLevel: 3,
    applicableRoles: ['SERVICE_MANAGER', 'LOCATION_MANAGER', 'REGIONAL_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/equipment-status',
  },
  {
    key: 'low-stock-alerts',
    name: 'Low Stock Alerts',
    description: 'Inventory items below reorder threshold',
    category: 'operations',
    type: 'stat',
    icon: 'AlertCircle',
    defaultSize: { w: 3, h: 1 },
    minLevel: 2,
    applicableRoles: ['TECHNICIAN', 'SERVICE_SUPERVISOR', 'SERVICE_MANAGER', 'LOCATION_MANAGER'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/low-stock-alerts',
  },

  // ── TEAM WIDGETS ───────────────────────────────────────────────────
  {
    key: 'team-performance',
    name: 'Team Performance',
    description: 'Performance metrics for your team members',
    category: 'team',
    type: 'leaderboard',
    icon: 'Users',
    defaultSize: { w: 6, h: 2 },
    minLevel: 3,
    applicableRoles: [
      'SALES_SUPERVISOR',
      'SALES_MANAGER',
      'SERVICE_SUPERVISOR',
      'SERVICE_MANAGER',
      'LOCATION_MANAGER',
      'REGIONAL_MANAGER',
    ],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/team-performance',
  },
  {
    key: 'team-activity-feed',
    name: 'Team Activity',
    description: 'Recent actions by your team members',
    category: 'team',
    type: 'feed',
    icon: 'Activity',
    defaultSize: { w: 4, h: 2 },
    minLevel: 2,
    applicableRoles: [
      'SALES_SUPERVISOR',
      'SALES_MANAGER',
      'SERVICE_SUPERVISOR',
      'SERVICE_MANAGER',
      'LOCATION_MANAGER',
    ],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/team-activity',
  },
  {
    key: 'total-customers',
    name: 'Total Customers',
    description: 'Company-wide customer count',
    category: 'team',
    type: 'stat',
    icon: 'Users',
    defaultSize: { w: 3, h: 1 },
    minLevel: 3,
    applicableRoles: [
      'SALES_MANAGER',
      'SERVICE_MANAGER',
      'LOCATION_MANAGER',
      'REGIONAL_MANAGER',
      'EXECUTIVE',
      'COMPANY_ADMIN',
    ],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/total-customers',
  },

  // ── TASK WIDGETS ───────────────────────────────────────────────────
  {
    key: 'my-tasks',
    name: 'My Tasks',
    description: 'Your pending and in-progress tasks',
    category: 'tasks',
    type: 'list',
    icon: 'CheckSquare',
    defaultSize: { w: 4, h: 2 },
    minLevel: 1,
    applicableRoles: [], // Available to all roles
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/my-tasks',
  },
  {
    key: 'upcoming-events',
    name: 'Upcoming Events',
    description: 'Meetings, calls, and deadlines for this week',
    category: 'tasks',
    type: 'list',
    icon: 'Calendar',
    defaultSize: { w: 4, h: 2 },
    minLevel: 1,
    applicableRoles: [], // Available to all roles
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/upcoming-events',
  },

  // ── ANALYTICS WIDGETS ──────────────────────────────────────────────
  {
    key: 'business-overview',
    name: 'Business Overview',
    description: 'High-level snapshot of customers, contracts, revenue, tickets',
    category: 'analytics',
    type: 'stat',
    icon: 'BarChart3',
    defaultSize: { w: 12, h: 1 },
    minLevel: 4,
    applicableRoles: ['LOCATION_MANAGER', 'REGIONAL_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/business-overview',
  },
  {
    key: 'customer-growth',
    name: 'Customer Growth',
    description: 'New customers acquired over time',
    category: 'analytics',
    type: 'chart',
    icon: 'TrendingUp',
    defaultSize: { w: 6, h: 2 },
    minLevel: 5,
    applicableRoles: ['REGIONAL_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/customer-growth',
  },
  {
    key: 'mrr-tracker',
    name: 'MRR Tracker',
    description: 'Monthly recurring revenue with growth trend',
    category: 'analytics',
    type: 'stat',
    icon: 'DollarSign',
    defaultSize: { w: 3, h: 1 },
    minLevel: 6,
    applicableRoles: ['EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: 'reporting.executive.view',
    supportsRefresh: true,
    supportsDrillDown: true,
    dataEndpoint: '/api/dashboard/widgets/mrr-tracker',
  },
  {
    key: 'csat-score',
    name: 'Customer Satisfaction',
    description: 'Average customer satisfaction score',
    category: 'analytics',
    type: 'gauge',
    icon: 'Heart',
    defaultSize: { w: 3, h: 1 },
    minLevel: 4,
    applicableRoles: ['SERVICE_MANAGER', 'EXECUTIVE', 'COMPANY_ADMIN'],
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/csat-score',
  },

  // ── QUICK ACTIONS ──────────────────────────────────────────────────
  {
    key: 'quick-actions',
    name: 'Quick Actions',
    description: 'Common shortcuts based on your role',
    category: 'tasks',
    type: 'actions',
    icon: 'Zap',
    defaultSize: { w: 4, h: 1 },
    minLevel: 1,
    applicableRoles: [], // Available to all roles
    requiredPermission: null,
    supportsRefresh: false,
    supportsDrillDown: false,
    dataEndpoint: '',
  },

  // ── ACTIVITY / RECENT ──────────────────────────────────────────────
  {
    key: 'recent-activity',
    name: 'Recent Activity',
    description: 'Your recent interactions and updates',
    category: 'tasks',
    type: 'feed',
    icon: 'Activity',
    defaultSize: { w: 4, h: 2 },
    minLevel: 1,
    applicableRoles: [], // Available to all roles
    requiredPermission: null,
    supportsRefresh: true,
    supportsDrillDown: false,
    dataEndpoint: '/api/dashboard/widgets/recent-activity',
  },
];

// ============================================================================
// ROLE-BASED DEFAULT LAYOUTS
// ============================================================================

/**
 * Defines the default widget layout for each role.
 * When a user first logs in, they get this layout.
 * They can then customize it via drag-and-drop.
 */
export const DEFAULT_ROLE_LAYOUTS: Record<string, LayoutWidgetConfig[]> = {
  // Sales Rep: Personal metrics focused
  SALES_REP: [
    { key: 'my-revenue', x: 0, y: 0, w: 3, h: 1, visible: true },
    { key: 'my-deals', x: 3, y: 0, w: 3, h: 1, visible: true },
    { key: 'my-leads', x: 6, y: 0, w: 3, h: 1, visible: true },
    { key: 'win-rate', x: 9, y: 0, w: 3, h: 1, visible: true },
    { key: 'deal-pipeline', x: 0, y: 1, w: 8, h: 2, visible: true },
    { key: 'quick-actions', x: 8, y: 1, w: 4, h: 1, visible: true },
    { key: 'follow-ups-today', x: 8, y: 2, w: 4, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 3, w: 4, h: 2, visible: true },
    { key: 'recent-activity', x: 4, y: 3, w: 4, h: 2, visible: true },
  ],

  SENIOR_SALES_REP: [
    { key: 'my-revenue', x: 0, y: 0, w: 3, h: 1, visible: true },
    { key: 'my-deals', x: 3, y: 0, w: 3, h: 1, visible: true },
    { key: 'my-leads', x: 6, y: 0, w: 3, h: 1, visible: true },
    { key: 'win-rate', x: 9, y: 0, w: 3, h: 1, visible: true },
    { key: 'deal-pipeline', x: 0, y: 1, w: 8, h: 2, visible: true },
    { key: 'follow-ups-today', x: 8, y: 1, w: 4, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 3, w: 4, h: 2, visible: true },
    { key: 'recent-activity', x: 4, y: 3, w: 4, h: 2, visible: true },
    { key: 'quick-actions', x: 8, y: 3, w: 4, h: 1, visible: true },
  ],

  // Sales Manager: Team view + personal
  SALES_MANAGER: [
    { key: 'my-revenue', x: 0, y: 0, w: 3, h: 1, visible: true },
    { key: 'my-deals', x: 3, y: 0, w: 3, h: 1, visible: true },
    { key: 'total-customers', x: 6, y: 0, w: 3, h: 1, visible: true },
    { key: 'win-rate', x: 9, y: 0, w: 3, h: 1, visible: true },
    { key: 'deal-pipeline', x: 0, y: 1, w: 6, h: 2, visible: true },
    { key: 'sales-leaderboard', x: 6, y: 1, w: 6, h: 2, visible: true },
    { key: 'team-performance', x: 0, y: 3, w: 6, h: 2, visible: true },
    { key: 'team-activity-feed', x: 6, y: 3, w: 6, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 5, w: 4, h: 2, visible: true },
    { key: 'quick-actions', x: 4, y: 5, w: 4, h: 1, visible: true },
  ],

  SALES_SUPERVISOR: [
    { key: 'my-revenue', x: 0, y: 0, w: 3, h: 1, visible: true },
    { key: 'my-deals', x: 3, y: 0, w: 3, h: 1, visible: true },
    { key: 'total-customers', x: 6, y: 0, w: 3, h: 1, visible: true },
    { key: 'win-rate', x: 9, y: 0, w: 3, h: 1, visible: true },
    { key: 'deal-pipeline', x: 0, y: 1, w: 6, h: 2, visible: true },
    { key: 'sales-leaderboard', x: 6, y: 1, w: 6, h: 2, visible: true },
    { key: 'team-performance', x: 0, y: 3, w: 6, h: 2, visible: true },
    { key: 'my-tasks', x: 6, y: 3, w: 6, h: 2, visible: true },
  ],

  // Technician: Job-focused
  TECHNICIAN: [
    { key: 'my-tickets', x: 0, y: 0, w: 3, h: 1, visible: true },
    { key: 'completion-rate', x: 3, y: 0, w: 3, h: 1, visible: true },
    { key: 'low-stock-alerts', x: 6, y: 0, w: 3, h: 1, visible: true },
    { key: 'quick-actions', x: 9, y: 0, w: 3, h: 1, visible: true },
    { key: 'todays-schedule', x: 0, y: 1, w: 8, h: 2, visible: true },
    { key: 'my-tasks', x: 8, y: 1, w: 4, h: 2, visible: true },
    { key: 'recent-activity', x: 0, y: 3, w: 6, h: 2, visible: true },
  ],

  // Service Manager: Team + operations
  SERVICE_MANAGER: [
    { key: 'emergency-tickets', x: 0, y: 0, w: 3, h: 1, visible: true },
    { key: 'my-tickets', x: 3, y: 0, w: 3, h: 1, visible: true },
    { key: 'avg-response-time', x: 6, y: 0, w: 3, h: 1, visible: true },
    { key: 'sla-compliance', x: 9, y: 0, w: 3, h: 1, visible: true },
    { key: 'team-technician-status', x: 0, y: 1, w: 6, h: 2, visible: true },
    { key: 'team-performance', x: 6, y: 1, w: 6, h: 2, visible: true },
    { key: 'expiring-contracts', x: 0, y: 3, w: 4, h: 2, visible: true },
    { key: 'team-activity-feed', x: 4, y: 3, w: 4, h: 2, visible: true },
    { key: 'my-tasks', x: 8, y: 3, w: 4, h: 2, visible: true },
  ],

  SERVICE_SUPERVISOR: [
    { key: 'emergency-tickets', x: 0, y: 0, w: 3, h: 1, visible: true },
    { key: 'my-tickets', x: 3, y: 0, w: 3, h: 1, visible: true },
    { key: 'avg-response-time', x: 6, y: 0, w: 3, h: 1, visible: true },
    { key: 'completion-rate', x: 9, y: 0, w: 3, h: 1, visible: true },
    { key: 'team-technician-status', x: 0, y: 1, w: 6, h: 2, visible: true },
    { key: 'todays-schedule', x: 6, y: 1, w: 6, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 3, w: 4, h: 2, visible: true },
    { key: 'recent-activity', x: 4, y: 3, w: 4, h: 2, visible: true },
    { key: 'quick-actions', x: 8, y: 3, w: 4, h: 1, visible: true },
  ],

  // Location Manager: Broad view
  LOCATION_MANAGER: [
    { key: 'business-overview', x: 0, y: 0, w: 12, h: 1, visible: true },
    { key: 'monthly-revenue', x: 0, y: 1, w: 3, h: 1, visible: true },
    { key: 'total-customers', x: 3, y: 1, w: 3, h: 1, visible: true },
    { key: 'active-contracts', x: 6, y: 1, w: 3, h: 1, visible: true },
    { key: 'sla-compliance', x: 9, y: 1, w: 3, h: 1, visible: true },
    { key: 'team-performance', x: 0, y: 2, w: 6, h: 2, visible: true },
    { key: 'revenue-trend', x: 6, y: 2, w: 6, h: 2, visible: true },
    { key: 'expiring-contracts', x: 0, y: 4, w: 4, h: 2, visible: true },
    { key: 'team-activity-feed', x: 4, y: 4, w: 4, h: 2, visible: true },
    { key: 'quick-actions', x: 8, y: 4, w: 4, h: 1, visible: true },
  ],

  // Regional Manager: Multi-location overview
  REGIONAL_MANAGER: [
    { key: 'business-overview', x: 0, y: 0, w: 12, h: 1, visible: true },
    { key: 'monthly-revenue', x: 0, y: 1, w: 3, h: 1, visible: true },
    { key: 'total-customers', x: 3, y: 1, w: 3, h: 1, visible: true },
    { key: 'active-contracts', x: 6, y: 1, w: 3, h: 1, visible: true },
    { key: 'sla-compliance', x: 9, y: 1, w: 3, h: 1, visible: true },
    { key: 'revenue-trend', x: 0, y: 2, w: 6, h: 2, visible: true },
    { key: 'customer-growth', x: 6, y: 2, w: 6, h: 2, visible: true },
    { key: 'team-performance', x: 0, y: 4, w: 6, h: 2, visible: true },
    { key: 'expiring-contracts', x: 6, y: 4, w: 6, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 6, w: 4, h: 2, visible: true },
  ],

  // Executive: High-level KPIs
  EXECUTIVE: [
    { key: 'business-overview', x: 0, y: 0, w: 12, h: 1, visible: true },
    { key: 'mrr-tracker', x: 0, y: 1, w: 3, h: 1, visible: true },
    { key: 'monthly-revenue', x: 3, y: 1, w: 3, h: 1, visible: true },
    { key: 'csat-score', x: 6, y: 1, w: 3, h: 1, visible: true },
    { key: 'collections-rate', x: 9, y: 1, w: 3, h: 1, visible: true },
    { key: 'revenue-trend', x: 0, y: 2, w: 6, h: 2, visible: true },
    { key: 'customer-growth', x: 6, y: 2, w: 6, h: 2, visible: true },
    { key: 'sales-leaderboard', x: 0, y: 4, w: 6, h: 2, visible: true },
    { key: 'expiring-contracts', x: 6, y: 4, w: 6, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 6, w: 4, h: 2, visible: true },
    { key: 'quick-actions', x: 4, y: 6, w: 4, h: 1, visible: true },
  ],

  // Company Admin: Full platform overview
  COMPANY_ADMIN: [
    { key: 'business-overview', x: 0, y: 0, w: 12, h: 1, visible: true },
    { key: 'mrr-tracker', x: 0, y: 1, w: 3, h: 1, visible: true },
    { key: 'monthly-revenue', x: 3, y: 1, w: 3, h: 1, visible: true },
    { key: 'total-customers', x: 6, y: 1, w: 3, h: 1, visible: true },
    { key: 'active-contracts', x: 9, y: 1, w: 3, h: 1, visible: true },
    { key: 'revenue-trend', x: 0, y: 2, w: 6, h: 2, visible: true },
    { key: 'customer-growth', x: 6, y: 2, w: 6, h: 2, visible: true },
    { key: 'sales-leaderboard', x: 0, y: 4, w: 4, h: 2, visible: true },
    { key: 'team-performance', x: 4, y: 4, w: 4, h: 2, visible: true },
    { key: 'expiring-contracts', x: 8, y: 4, w: 4, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 6, w: 4, h: 2, visible: true },
    { key: 'quick-actions', x: 4, y: 6, w: 4, h: 1, visible: true },
  ],

  // Finance Manager
  FINANCE_MANAGER: [
    { key: 'monthly-revenue', x: 0, y: 0, w: 3, h: 1, visible: true },
    { key: 'outstanding-invoices', x: 3, y: 0, w: 3, h: 1, visible: true },
    { key: 'overdue-invoices', x: 6, y: 0, w: 3, h: 1, visible: true },
    { key: 'collections-rate', x: 9, y: 0, w: 3, h: 1, visible: true },
    { key: 'revenue-trend', x: 0, y: 1, w: 6, h: 2, visible: true },
    { key: 'expiring-contracts', x: 6, y: 1, w: 6, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 3, w: 4, h: 2, visible: true },
    { key: 'recent-activity', x: 4, y: 3, w: 4, h: 2, visible: true },
    { key: 'quick-actions', x: 8, y: 3, w: 4, h: 1, visible: true },
  ],

  // Platform Admin: Everything
  PLATFORM_ADMIN: [
    { key: 'business-overview', x: 0, y: 0, w: 12, h: 1, visible: true },
    { key: 'mrr-tracker', x: 0, y: 1, w: 3, h: 1, visible: true },
    { key: 'monthly-revenue', x: 3, y: 1, w: 3, h: 1, visible: true },
    { key: 'total-customers', x: 6, y: 1, w: 3, h: 1, visible: true },
    { key: 'active-contracts', x: 9, y: 1, w: 3, h: 1, visible: true },
    { key: 'revenue-trend', x: 0, y: 2, w: 6, h: 2, visible: true },
    { key: 'customer-growth', x: 6, y: 2, w: 6, h: 2, visible: true },
    { key: 'sales-leaderboard', x: 0, y: 4, w: 4, h: 2, visible: true },
    { key: 'team-performance', x: 4, y: 4, w: 4, h: 2, visible: true },
    { key: 'expiring-contracts', x: 8, y: 4, w: 4, h: 2, visible: true },
    { key: 'my-tasks', x: 0, y: 6, w: 4, h: 2, visible: true },
    { key: 'quick-actions', x: 4, y: 6, w: 4, h: 1, visible: true },
  ],
};

// Fallback default for unrecognized roles
DEFAULT_ROLE_LAYOUTS['DEFAULT'] = [
  { key: 'my-tasks', x: 0, y: 0, w: 6, h: 2, visible: true },
  { key: 'recent-activity', x: 6, y: 0, w: 6, h: 2, visible: true },
  { key: 'quick-actions', x: 0, y: 2, w: 4, h: 1, visible: true },
  { key: 'upcoming-events', x: 4, y: 2, w: 4, h: 2, visible: true },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get widgets available for a given role level and permission set
 */
export function getAvailableWidgets(
  level: number,
  roleCode: string,
  permissions: Set<string>,
  isPlatformUser: boolean,
): WidgetDefinition[] {
  return WIDGET_DEFINITIONS.filter((widget) => {
    if (isPlatformUser) return true;
    if (level < widget.minLevel) return false;
    if (widget.requiredPermission && !permissions.has(widget.requiredPermission)) {
      return false;
    }
    return true;
  });
}

/**
 * Get the default layout for a role
 */
export function getDefaultLayout(roleCode: string): LayoutWidgetConfig[] {
  return DEFAULT_ROLE_LAYOUTS[roleCode] || DEFAULT_ROLE_LAYOUTS['DEFAULT'];
}

/**
 * Get widget definition by key
 */
export function getWidgetDefinition(key: string): WidgetDefinition | undefined {
  return WIDGET_DEFINITIONS.find((w) => w.key === key);
}

/**
 * Get the role label for display
 */
export function getRoleLabel(roleCode: string): string {
  const labels: Record<string, string> = {
    SALES_REP: 'Sales Representative',
    SENIOR_SALES_REP: 'Senior Sales Representative',
    SALES_SUPERVISOR: 'Sales Supervisor',
    SALES_MANAGER: 'Sales Manager',
    TECHNICIAN: 'Field Technician',
    SERVICE_SUPERVISOR: 'Service Supervisor',
    SERVICE_MANAGER: 'Service Manager',
    FINANCE_MANAGER: 'Finance Manager',
    LOCATION_MANAGER: 'Location Manager',
    REGIONAL_MANAGER: 'Regional Manager',
    EXECUTIVE: 'Executive',
    COMPANY_ADMIN: 'Company Administrator',
    PLATFORM_ADMIN: 'Platform Administrator',
  };
  return labels[roleCode] || roleCode.replace(/_/g, ' ');
}
