/**
 * Navigation Permission Map
 *
 * Maps every sidebar navigation item to granular RBAC permissions.
 * Uses the enhanced permission format: <module>.<resource>.<action>_<scope>
 *
 * Each navigation item specifies:
 * - requiredPermissions: At least ONE of these must be granted (OR logic)
 * - requiredAllPermissions: ALL of these must be granted (AND logic) - optional
 * - minLevel: Minimum role hierarchy level (1-8) - optional
 * - platformOnly: Only visible to platform admins - optional
 */

export interface NavigationPermissionRule {
  /** At least one of these permissions grants access (OR logic) */
  requiredPermissions?: string[];
  /** All of these must be present (AND logic) */
  requiredAllPermissions?: string[];
  /** Minimum role level (1=Individual, 8=Platform Admin) */
  minLevel?: number;
  /** Only visible to platform admin users */
  platformOnly?: boolean;
  /** Visible to all authenticated users */
  alwaysVisible?: boolean;
}

/**
 * Permission map for sidebar sections (top-level collapsible groups).
 * Key = section ID from the sidebar.
 */
export const SECTION_PERMISSIONS: Record<string, NavigationPermissionRule> = {
  // Always visible to all users
  dashboard: { alwaysVisible: true },
  productivity: { alwaysVisible: true },
  'knowledge-base': { alwaysVisible: true },
  settings: { alwaysVisible: true },

  // Backwards compat: old section IDs still resolve correctly
  tasks: { alwaysVisible: true },
  'ai-hub': { alwaysVisible: true },

  // Platform Management (merged platform admin sections)
  'platform-management': { platformOnly: true },

  // Blog Module (Platform Admin Blog System — US-BLOG-001 foundation; gated to platform admin)
  blog: { platformOnly: true },
  // Backwards compat for old section IDs
  'platform-admin-hub': { platformOnly: true },
  'tenant-org-management': { platformOnly: true },
  'user-access-management': { platformOnly: true },
  'system-operations': { platformOnly: true },
  'platform-features': { platformOnly: true },

  // Sales Hub - always visible (core CRM functionality)
  crm: { alwaysVisible: true },
  service: {
    requiredPermissions: [
      'service.ticket.view_own',
      'service.ticket.view_team',
      'service.ticket.view_location',
      'service.equipment.view',
      'service.schedule.view_own',
    ],
  },
  // Products & Equipment (merged)
  'products-equipment': {
    requiredPermissions: [
      'sales.customer.view_own',
      'operations.inventory.view',
      'operations.inventory.manage',
      'operations.warehouse.receive',
      'operations.po.view',
    ],
    minLevel: 2,
  },
  // Backwards compat for old section IDs
  products: {
    requiredPermissions: ['sales.customer.view_own', 'operations.inventory.view'],
    minLevel: 2,
  },
  equipment: {
    requiredPermissions: [
      'operations.inventory.view',
      'operations.inventory.manage',
      'operations.warehouse.receive',
      'operations.po.view',
    ],
  },
  billing: {
    requiredPermissions: [
      'finance.ar.view',
      'finance.ap.view',
      'finance.invoice.create',
      'finance.gl.view',
      'finance.reports.view',
    ],
  },
  reports: {
    requiredPermissions: [
      'reporting.report.view',
      'reporting.sales.view',
      'reporting.service.view',
      'reporting.finance.view',
      'reporting.executive.view',
    ],
  },

  // Administration (merged: Integrations + System Admin)
  administration: {
    requiredPermissions: [
      'admin.settings.integrations',
      'admin.settings.view',
      'admin.settings.update',
    ],
    minLevel: 3,
  },
  // Backwards compat for old section IDs
  'integrations-hub': {
    requiredPermissions: ['admin.settings.integrations'],
    minLevel: 3,
  },
  'system-admin': {
    requiredPermissions: ['admin.settings.view', 'admin.settings.update'],
    minLevel: 4,
  },
};

/**
 * Permission map for individual navigation items (children within sections).
 * Key = route path.
 */
export const ITEM_PERMISSIONS: Record<string, NavigationPermissionRule> = {
  // =====================================================================
  // SALES HUB ITEMS
  // =====================================================================
  '/leads-management': {
    requiredPermissions: [
      'sales.lead.view_own',
      'sales.lead.view_team',
      'sales.lead.view_location',
    ],
  },
  '/data-enrichment': {
    requiredPermissions: ['sales.lead.view_own', 'sales.lead.create'],
    minLevel: 2,
  },
  '/contacts': {
    requiredPermissions: ['sales.customer.view_own', 'sales.customer.view_location'],
  },
  '/opportunities': {
    requiredPermissions: [
      'sales.opportunity.view_own',
      'sales.opportunity.view_team',
      'sales.opportunity.view_location',
    ],
  },
  '/sales-pipeline': {
    requiredPermissions: [
      'sales.opportunity.view_own',
      'sales.opportunity.view_team',
      'sales.opportunity.view_location',
    ],
  },
  '/sales-pipeline-forecasting': {
    requiredPermissions: [
      'sales.opportunity.view_team',
      'sales.opportunity.view_location',
      'sales.opportunity.view_regional',
    ],
    minLevel: 3,
  },
  '/crm-goals-dashboard': {
    requiredPermissions: ['reporting.sales.view'],
    minLevel: 3,
  },
  '/demo-scheduling': {
    requiredPermissions: ['sales.opportunity.create', 'sales.lead.view_own'],
  },
  '/quote-proposal-generation': {
    requiredPermissions: ['sales.quote.create', 'sales.quote.edit_own'],
  },
  '/proposal-builder': {
    requiredPermissions: ['sales.quote.create'],
  },
  '/deal-desk': {
    requiredPermissions: [
      'sales.quote.approve_standard',
      'sales.quote.approve_high_value',
      'sales.quote.approve_enterprise',
    ],
    minLevel: 3,
  },
  '/pipeline-config': {
    requiredPermissions: ['sales.territory.manage_assignments'],
    minLevel: 4,
  },
  '/contracts': {
    requiredPermissions: ['sales.quote.create', 'sales.customer.view_own'],
  },
  '/document-builder': {
    requiredPermissions: ['sales.quote.create'],
  },
  '/customer-success-management': {
    requiredPermissions: ['sales.customer.view_location'],
    minLevel: 3,
  },
  '/sales-command-center': {
    requiredPermissions: [
      'sales.lead.view_location',
      'sales.opportunity.view_location',
      'reporting.sales.view',
    ],
    minLevel: 4,
  },
  '/sales-performance-analytics': {
    requiredPermissions: ['reporting.sales.view'],
    minLevel: 3,
  },
  '/commission-management': {
    requiredPermissions: ['sales.commission.view_own', 'sales.commission.view_team'],
  },
  '/sales-rep-assignments': {
    requiredPermissions: ['sales.territory.manage_assignments', 'sales.lead.assign'],
    minLevel: 3,
  },

  // =====================================================================
  // SERVICE HUB ITEMS
  // =====================================================================
  '/service-hub': {
    requiredPermissions: [
      'service.ticket.view_own',
      'service.ticket.view_team',
      'service.ticket.view_location',
    ],
  },
  '/onboarding': {
    requiredPermissions: ['service.ticket.create'],
    minLevel: 2,
  },
  '/service-dispatch': {
    requiredPermissions: ['service.ticket.assign', 'service.schedule.manage'],
    minLevel: 3,
  },
  '/technician-management': {
    requiredPermissions: ['service.schedule.manage', 'service.ticket.assign'],
    minLevel: 3,
  },
  '/vehicle-management': {
    requiredPermissions: ['service.equipment.view'],
    minLevel: 3,
  },
  '/asset-management': {
    requiredPermissions: ['service.equipment.view'],
  },
  '/remote-monitoring': {
    requiredPermissions: ['service.equipment.view', 'service.equipment.configure'],
    minLevel: 2,
  },
  '/fleet-monitoring': {
    requiredPermissions: ['service.equipment.view'],
    minLevel: 3,
  },
  '/meter-readings': {
    requiredPermissions: ['service.equipment.view', 'service.ticket.view_own'],
  },
  '/preventive-maintenance': {
    requiredPermissions: ['service.equipment.view', 'service.workorder.view_own'],
  },
  '/preventive-maintenance-automation': {
    requiredPermissions: ['service.workorder.create', 'service.schedule.manage'],
    minLevel: 3,
  },
  '/mobile-field-service': {
    requiredPermissions: ['service.ticket.view_own', 'service.schedule.view_own'],
  },
  '/mobile-field-operations': {
    requiredPermissions: ['service.ticket.view_own'],
  },
  '/mobile-service-app': {
    requiredPermissions: ['service.ticket.view_own'],
  },
  '/service-analytics': {
    requiredPermissions: ['reporting.service.view'],
    minLevel: 3,
  },
  '/service-forecasting-analytics': {
    requiredPermissions: ['reporting.service.view'],
    minLevel: 4,
  },
  '/incident-response-system': {
    requiredPermissions: ['service.ticket.view_location', 'service.ticket.assign'],
    minLevel: 3,
  },
  '/manufacturer-integration': {
    requiredPermissions: ['service.equipment.view', 'admin.settings.integrations'],
    minLevel: 4,
  },

  // =====================================================================
  // PRODUCT HUB ITEMS
  // =====================================================================
  '/product-hub': {
    requiredPermissions: ['operations.inventory.view', 'sales.customer.view_own'],
  },
  '/product-catalog': {
    requiredPermissions: ['operations.inventory.view', 'sales.customer.view_own'],
  },
  '/product-models': {
    requiredPermissions: ['operations.inventory.view'],
    minLevel: 2,
  },
  '/product-accessories': {
    requiredPermissions: ['operations.inventory.view'],
  },
  '/supplies': {
    requiredPermissions: ['operations.inventory.view', 'service.parts.view'],
  },
  '/software-products': {
    requiredPermissions: ['operations.inventory.view'],
    minLevel: 2,
  },
  '/professional-services': {
    requiredPermissions: ['sales.customer.view_own'],
    minLevel: 2,
  },
  '/managed-services': {
    requiredPermissions: ['sales.customer.view_own'],
    minLevel: 3,
  },
  '/service-products': {
    requiredPermissions: ['service.equipment.view', 'operations.inventory.view'],
  },

  // =====================================================================
  // EQUIPMENT LIFECYCLE ITEMS
  // =====================================================================
  '/equipment-lifecycle': {
    requiredPermissions: ['operations.inventory.view', 'service.equipment.view'],
  },
  '/purchase-orders': {
    requiredPermissions: ['operations.po.view', 'operations.po.create'],
  },
  '/warehouse-operations': {
    requiredPermissions: ['operations.warehouse.receive', 'operations.warehouse.manage'],
  },
  '/inventory': {
    requiredPermissions: ['operations.inventory.view', 'operations.inventory.manage'],
  },
  '/equipment-lifecycle-management': {
    requiredPermissions: ['service.equipment.view', 'operations.inventory.manage'],
    minLevel: 3,
  },

  // =====================================================================
  // BILLING HUB ITEMS
  // =====================================================================
  '/billing': {
    requiredPermissions: ['finance.ar.view', 'finance.invoice.create'],
  },
  '/leases': {
    requiredPermissions: ['finance.ar.view'],
    minLevel: 2,
  },
  '/chart-of-accounts': {
    requiredPermissions: ['finance.gl.view'],
    minLevel: 4,
  },
  '/advanced-billing': {
    requiredPermissions: ['finance.invoice.create', 'finance.ar.view'],
    minLevel: 3,
  },
  '/meter-billing': {
    requiredPermissions: ['finance.invoice.create'],
    minLevel: 2,
  },
  '/invoices': {
    requiredPermissions: ['finance.ar.view', 'finance.invoice.create'],
  },
  '/accounts-receivable': {
    requiredPermissions: ['finance.ar.view'],
    minLevel: 2,
  },
  '/accounts-payable': {
    requiredPermissions: ['finance.ap.view'],
    minLevel: 2,
  },
  '/vendors': {
    requiredPermissions: ['finance.ap.view', 'operations.po.view'],
    minLevel: 2,
  },
  '/journal-entries': {
    requiredPermissions: ['finance.gl.view', 'finance.gl.post'],
    minLevel: 4,
  },
  '/financial-forecasting': {
    requiredPermissions: ['finance.reports.view', 'finance.reports.view_sensitive'],
    minLevel: 5,
  },

  // =====================================================================
  // REPORTS HUB ITEMS
  // =====================================================================
  '/reports': {
    requiredPermissions: [
      'reporting.report.view',
      'reporting.sales.view',
      'reporting.service.view',
    ],
  },
  '/performance-monitoring': {
    requiredPermissions: ['reporting.sales.view', 'reporting.service.view'],
    minLevel: 3,
  },
  '/advanced-reporting': {
    requiredPermissions: ['reporting.report.create'],
    minLevel: 4,
  },
  '/advanced-analytics': {
    requiredPermissions: ['reporting.report.create'],
    minLevel: 4,
  },
  '/financial-intelligence-dashboard': {
    requiredPermissions: ['reporting.finance.view', 'finance.reports.view_sensitive'],
    minLevel: 5,
  },
  '/predictive-analytics': {
    requiredPermissions: ['reporting.executive.view'],
    minLevel: 5,
  },
  '/ai-analytics-dashboard': {
    requiredPermissions: ['reporting.executive.view'],
    minLevel: 5,
  },
  '/executive-dashboard': {
    requiredPermissions: ['reporting.executive.view'],
    minLevel: 6,
  },

  // =====================================================================
  // INTEGRATIONS HUB ITEMS
  // =====================================================================
  '/integration-hub': {
    requiredPermissions: ['admin.settings.integrations'],
    minLevel: 3,
  },
  '/quickbooks-integration': {
    requiredPermissions: ['admin.settings.integrations', 'finance.ar.view'],
    minLevel: 4,
  },
  '/erp-integration': {
    requiredPermissions: ['admin.settings.integrations'],
    minLevel: 5,
  },
  '/esignature-integration': {
    requiredPermissions: ['admin.settings.integrations'],
    minLevel: 3,
  },
  '/system-integrations': {
    requiredPermissions: ['admin.settings.integrations'],
    minLevel: 4,
  },

  // =====================================================================
  // SYSTEM ADMIN ITEMS
  // =====================================================================
  '/seo': {
    requiredPermissions: ['admin.settings.update'],
    minLevel: 4,
  },
  '/workflow-automation': {
    requiredPermissions: ['admin.settings.update'],
    minLevel: 4,
  },
  '/business-process-optimization': {
    requiredPermissions: ['admin.settings.update'],
    minLevel: 5,
  },
  '/document-management': {
    requiredPermissions: ['admin.settings.view'],
    minLevel: 3,
  },
  '/security-compliance-management': {
    requiredPermissions: ['audit.logs.view_location', 'compliance.reports.view'],
    minLevel: 5,
  },
  '/deployment-readiness': {
    requiredPermissions: ['admin.settings.update'],
    minLevel: 6,
  },
  '/customer-number-settings': {
    requiredPermissions: ['admin.settings.update'],
    minLevel: 4,
  },

  // =====================================================================
  // CUSTOMER & CRM ITEMS (always visible section, but children can be filtered)
  // =====================================================================
  '/customers': { alwaysVisible: true },
  '/prospects': { alwaysVisible: true },
  '/customers?tab=leads': {
    requiredPermissions: ['sales.lead.view_own', 'sales.lead.view_team'],
  },
  '/customers?tab=prospects': {
    requiredPermissions: ['sales.lead.view_own', 'sales.customer.view_own'],
  },
  '/customers?tab=active': {
    requiredPermissions: ['sales.customer.view_own'],
  },

  // =====================================================================
  // AI HUB ITEMS (generally available, but some need higher access)
  // =====================================================================
  '/ai-employees': { alwaysVisible: true },
  '/calendar': { alwaysVisible: true },
  '/meeting-transcription': { alwaysVisible: true },
  '/ai-search': { alwaysVisible: true },
  '/ai-task-scheduling': { alwaysVisible: true },
  '/conversational-ai-dashboard': { alwaysVisible: true },

  // =====================================================================
  // TASK MANAGEMENT (always available)
  // =====================================================================
  '/task-management': { alwaysVisible: true },
  '/basic-tasks': { alwaysVisible: true },
  '/my-tasks': { alwaysVisible: true },
  '/tasks': { alwaysVisible: true },
  '/task-hub': { alwaysVisible: true },

  // =====================================================================
  // DASHBOARD ITEMS (always visible or role-gated)
  // =====================================================================
  '/today': { alwaysVisible: true },
  '/dashboard/today': { alwaysVisible: true },
  '/custom-dashboard': { alwaysVisible: true },

  // =====================================================================
  // CRM DETAIL & ALIAS ROUTES
  // =====================================================================
  '/crm/deals': {
    requiredPermissions: [
      'sales.opportunity.view_own',
      'sales.opportunity.view_team',
      'sales.opportunity.view_location',
    ],
  },
  '/crm/leads': {
    requiredPermissions: ['sales.lead.view_own', 'sales.lead.view_team'],
  },
  '/crm/contacts': {
    requiredPermissions: ['sales.customer.view_own', 'sales.customer.view_location'],
  },
  '/crm/companies': {
    requiredPermissions: ['sales.customer.view_own', 'sales.customer.view_location'],
  },
  '/deals': {
    requiredPermissions: [
      'sales.opportunity.view_own',
      'sales.opportunity.view_team',
      'sales.opportunity.view_location',
    ],
  },
  '/deals-management': {
    requiredPermissions: [
      'sales.opportunity.view_own',
      'sales.opportunity.view_team',
      'sales.opportunity.view_location',
    ],
  },
  '/crm': { alwaysVisible: true },
  '/business-records': { alwaysVisible: true },
  '/leads/:slug': {
    requiredPermissions: ['sales.lead.view_own', 'sales.lead.view_team'],
  },
  '/customers/:slug': {
    requiredPermissions: ['sales.customer.view_own'],
  },
  '/companies/:companyId/contacts': {
    requiredPermissions: ['sales.customer.view_own', 'sales.customer.view_location'],
  },
  '/company-contacts': {
    requiredPermissions: ['sales.customer.view_own', 'sales.customer.view_location'],
  },
  '/crm-goals': {
    requiredPermissions: ['reporting.sales.view'],
    minLevel: 3,
  },

  // =====================================================================
  // QUOTES & PROPOSALS
  // =====================================================================
  '/quotes': {
    requiredPermissions: ['sales.quote.create', 'sales.quote.edit_own'],
  },
  '/quotes/new': {
    requiredPermissions: ['sales.quote.create'],
  },
  '/quotes/:quoteId': {
    requiredPermissions: ['sales.quote.create', 'sales.quote.edit_own'],
  },
  '/quotes/:quoteId/view': {
    requiredPermissions: ['sales.quote.create', 'sales.quote.edit_own'],
  },
  '/deal-desk/requests/:id': {
    requiredPermissions: [
      'sales.quote.approve_standard',
      'sales.quote.approve_high_value',
      'sales.quote.approve_enterprise',
    ],
    minLevel: 3,
  },
  '/deal-desk/rules': {
    requiredPermissions: ['sales.quote.approve_high_value'],
    minLevel: 5,
  },

  // =====================================================================
  // COMPETITIVE DIFFERENTIATION / AUTOPILOT ROUTES
  // =====================================================================
  '/autopilot': {
    requiredPermissions: ['sales.lead.view_own', 'sales.opportunity.view_own'],
  },
  '/auto-lead-routing': {
    requiredPermissions: ['sales.lead.assign', 'sales.territory.manage_assignments'],
    minLevel: 3,
  },
  '/lead-map': {
    requiredPermissions: ['sales.lead.view_own', 'sales.lead.view_team'],
  },
  '/predictive-service-dispatch': {
    requiredPermissions: ['service.ticket.assign', 'service.schedule.manage'],
    minLevel: 3,
  },
  '/connect': {
    requiredPermissions: ['admin.settings.integrations'],
    minLevel: 3,
  },
  '/white-label': {
    requiredPermissions: ['admin.settings.update'],
    minLevel: 6,
  },
  '/auto-supply-replenishment': {
    requiredPermissions: ['operations.inventory.view', 'service.parts.view'],
  },
  '/contract-renewal-autopilot': {
    requiredPermissions: ['sales.customer.view_own', 'sales.quote.create'],
  },
  '/compare-eautomate': { alwaysVisible: true },
  '/integration-marketplace': {
    requiredPermissions: ['admin.settings.integrations'],
    minLevel: 3,
  },
  '/scheduled-reports': {
    requiredPermissions: ['reporting.report.schedule'],
    minLevel: 3,
  },
  '/meeting-to-proposal': {
    requiredPermissions: ['sales.quote.create'],
  },

  // =====================================================================
  // REPORTS ALIASES
  // =====================================================================
  '/sales-reports': {
    requiredPermissions: ['reporting.sales.view'],
  },
  '/service-reports': {
    requiredPermissions: ['reporting.service.view'],
  },
  '/revenue-reports': {
    requiredPermissions: ['reporting.finance.view'],
    minLevel: 4,
  },
  '/contract-renewals': {
    requiredPermissions: ['sales.customer.view_own', 'sales.quote.create'],
  },
  '/reports/custom/new': {
    requiredPermissions: ['reporting.report.create'],
    minLevel: 4,
  },

  // =====================================================================
  // SERVICE ADDITIONAL ROUTES
  // =====================================================================
  '/proactive-service': {
    requiredPermissions: ['service.ticket.view_team', 'service.equipment.view'],
    minLevel: 3,
  },
  '/predictive-maintenance-hub': {
    requiredPermissions: ['service.equipment.view', 'service.workorder.view_own'],
    minLevel: 3,
  },
  '/incident-response': {
    requiredPermissions: ['service.ticket.view_location', 'service.ticket.assign'],
    minLevel: 3,
  },

  // =====================================================================
  // BILLING ADDITIONAL ROUTES
  // =====================================================================
  '/advanced-billing-engine': {
    requiredPermissions: ['finance.invoice.create', 'finance.ar.view'],
    minLevel: 3,
  },
  '/billing-rules': {
    requiredPermissions: ['finance.invoice.create'],
    minLevel: 3,
  },
  '/billing-analytics': {
    requiredPermissions: ['finance.reports.view'],
    minLevel: 4,
  },
  '/vendor-management': {
    requiredPermissions: ['finance.ap.view', 'operations.po.view'],
    minLevel: 2,
  },

  // =====================================================================
  // PRODUCT ADDITIONAL ROUTES
  // =====================================================================
  '/product-management-hub': {
    requiredPermissions: ['operations.inventory.view', 'sales.customer.view_own'],
  },
  '/product-models-v2': {
    requiredPermissions: ['operations.inventory.view'],
    minLevel: 2,
  },

  // =====================================================================
  // PRICING ROUTES
  // =====================================================================
  '/pricing-management': {
    requiredPermissions: ['operations.inventory.manage'],
    minLevel: 3,
  },
  '/pricing/settings': {
    requiredPermissions: ['operations.inventory.manage'],
    minLevel: 4,
  },
  '/pricing/margin-report': {
    requiredPermissions: ['finance.reports.view'],
    minLevel: 4,
  },
  '/pricing/approvals': {
    requiredPermissions: ['sales.quote.approve_standard'],
    minLevel: 3,
  },
  '/pricing': { alwaysVisible: true },

  // =====================================================================
  // IMPORT ROUTES
  // =====================================================================
  '/import': {
    requiredPermissions: ['sales.lead.import', 'operations.inventory.manage'],
    minLevel: 3,
  },
  '/import/products': {
    requiredPermissions: ['operations.inventory.manage'],
    minLevel: 3,
  },

  // =====================================================================
  // SETTINGS & UTILITY ROUTES
  // =====================================================================
  '/settings': { alwaysVisible: true },
  '/settings/api-keys': {
    requiredPermissions: ['admin.settings.update'],
    minLevel: 4,
  },
  '/settings/subscription': { alwaysVisible: true },
  '/settings/billing': {
    requiredPermissions: ['finance.ar.view'],
  },
  '/tenant-setup': {
    requiredPermissions: ['admin.settings.update'],
    minLevel: 4,
  },
  '/customer-portal': { alwaysVisible: true },
  '/customer-self-service-portal': { alwaysVisible: true },

  // =====================================================================
  // MONITORING ROUTES
  // =====================================================================
  '/monitoring-clients': {
    requiredPermissions: ['service.equipment.view', 'service.equipment.configure'],
    minLevel: 3,
  },
  '/device-monitoring': {
    requiredPermissions: ['service.equipment.view', 'service.equipment.configure'],
    minLevel: 3,
  },
  '/supply-runway': {
    requiredPermissions: ['service.equipment.view'],
    minLevel: 3,
  },
  '/supply-orders': {
    requiredPermissions: ['service.equipment.view'],
    minLevel: 3,
  },
  '/oid-management': {
    requiredPermissions: ['service.equipment.configure'],
    minLevel: 4,
  },
  '/system-monitoring': {
    requiredPermissions: ['admin.settings.view'],
    minLevel: 5,
  },
  '/mobile-optimization': { alwaysVisible: true },

  // =====================================================================
  // AI & ANALYTICS ADDITIONAL ROUTES
  // =====================================================================
  '/ai-hub': { alwaysVisible: true },
  '/gpt5-dashboard': { alwaysVisible: true },
  '/social-media-generator': { alwaysVisible: true },
  '/predictive-contract-profitability': {
    requiredPermissions: ['finance.reports.view', 'reporting.finance.view'],
    minLevel: 4,
  },
  '/ai-service-intelligence': {
    requiredPermissions: ['service.ticket.view_team', 'reporting.service.view'],
    minLevel: 3,
  },
  '/advanced-analytics-dashboard': {
    requiredPermissions: ['reporting.report.create'],
    minLevel: 4,
  },

  // =====================================================================
  // ADMIN ROUTE ALIASES (non-/admin prefix)
  // =====================================================================
  '/access-control': {
    requiredPermissions: ['admin.role.view', 'admin.role.create'],
    minLevel: 4,
  },
  '/security-compliance': {
    requiredPermissions: ['audit.logs.view_location', 'compliance.reports.view'],
    minLevel: 5,
  },
  '/security-management': {
    requiredPermissions: ['audit.logs.view_location', 'compliance.reports.view'],
    minLevel: 5,
  },
  '/customer-access-management': {
    requiredPermissions: ['admin.user.view'],
    minLevel: 4,
  },

  // =====================================================================
  // INTEGRATION ADDITIONAL ROUTES
  // =====================================================================
  '/integrations': {
    requiredPermissions: ['admin.settings.integrations'],
    minLevel: 3,
  },
  '/manufacturer-integration/devices': {
    requiredPermissions: ['service.equipment.view', 'admin.settings.integrations'],
    minLevel: 4,
  },
  '/manufacturer-integration/audit': {
    requiredPermissions: ['admin.settings.integrations', 'audit.logs.view_location'],
    minLevel: 4,
  },
  '/apollo-leads': {
    requiredPermissions: ['sales.lead.view_own', 'sales.lead.create'],
    minLevel: 2,
  },

  // =====================================================================
  // LEASE ADDITIONAL ROUTES
  // =====================================================================
  '/leases/new': {
    requiredPermissions: ['finance.ar.view'],
    minLevel: 2,
  },
  '/leases/:id/edit': {
    requiredPermissions: ['finance.ar.view'],
    minLevel: 2,
  },
  '/leases/:id': {
    requiredPermissions: ['finance.ar.view'],
    minLevel: 2,
  },

  // =====================================================================
  // KNOWLEDGE BASE ROUTES
  // =====================================================================
  '/knowledge-base': { alwaysVisible: true },
  '/knowledge-base/article/:slug': { alwaysVisible: true },
  '/knowledge-base/category/:slug': { alwaysVisible: true },

  // =====================================================================
  // ONBOARDING ROUTES
  // =====================================================================
  '/onboarding/new': {
    requiredPermissions: ['service.ticket.create'],
    minLevel: 2,
  },
  '/onboarding/enhanced': {
    requiredPermissions: ['service.ticket.create'],
    minLevel: 2,
  },
  '/onboarding/original': {
    requiredPermissions: ['service.ticket.create'],
    minLevel: 2,
  },
  '/onboarding/:id': {
    requiredPermissions: ['service.ticket.create', 'service.ticket.view_own'],
  },
  '/setup-wizard': { alwaysVisible: true },

  // =====================================================================
  // SALES ADDITIONAL ROUTES
  // =====================================================================
  '/sales/command-center': {
    requiredPermissions: [
      'sales.lead.view_location',
      'sales.opportunity.view_location',
      'reporting.sales.view',
    ],
    minLevel: 4,
  },
  '/customer-success': {
    requiredPermissions: ['sales.customer.view_location'],
    minLevel: 3,
  },

  // =====================================================================
  // PLATFORM ADMIN ROUTES (all require platformOnly or high minLevel)
  // =====================================================================
  '/admin-hub': { platformOnly: true },
  '/admin-command-center': { minLevel: 7 },
  '/root-admin-dashboard': { platformOnly: true },
  '/root-admin-signups-crm': { minLevel: 7 },
  '/root-admin/seo': { minLevel: 7 },
  '/platform-crm': { minLevel: 7 },
  '/platform-crm/dashboard': { minLevel: 7 },
  '/platform-crm/business-records': { minLevel: 7 },
  '/platform-crm/business-records/:id': { minLevel: 7 },
  '/platform-crm/deals/:id': { minLevel: 7 },
  '/platform-crm/pipeline': { minLevel: 7 },
  '/platform-crm/territories': { minLevel: 7 },
  '/platform-crm/lead-scoring': { minLevel: 7 },
  '/platform-crm/assignment-rules': { minLevel: 7 },
  '/platform-crm/customer-success': { minLevel: 7 },
  '/platform-crm/analytics': { minLevel: 7 },
  '/platform-crm/cohort-analysis': { minLevel: 7 },
  '/admin/root-admin-security': { platformOnly: true },
  '/admin/system-security': { minLevel: 7 },
  '/admin/database-updater': { minLevel: 7 },
  '/admin/tenant-management': { platformOnly: true },
  '/admin/user-management': {
    requiredPermissions: ['admin.user.view'],
    minLevel: 4,
  },
  '/admin/system-settings': { minLevel: 7 },
  '/admin/platform-analytics': { minLevel: 7 },
  '/admin/knowledge-base': { minLevel: 7 },
  '/admin/knowledge-base/new': { minLevel: 7 },
  '/admin/knowledge-base/edit/:id': { minLevel: 7 },
  '/platform-configuration': { platformOnly: true },
  '/database-management': { platformOnly: true },
  '/admin/mobile-logs': { platformOnly: true },
  '/admin/audit-logs': { platformOnly: true },

  // =====================================================================
  // DEV/TEST ROUTES
  // =====================================================================
  '/company-ids-test': {
    requiredPermissions: ['admin.settings.view'],
    minLevel: 4,
  },
};

/**
 * Check if a user has access to a navigation item based on their permissions.
 *
 * @param rule - The permission rule for the navigation item
 * @param userPermissions - Set of permission codes the user has been granted
 * @param userLevel - The user's role hierarchy level (1-8)
 * @param isPlatformUser - Whether the user is a platform admin
 * @returns true if the user should see this navigation item
 */
export function checkNavigationAccess(
  rule: NavigationPermissionRule | undefined,
  userPermissions: Set<string>,
  userLevel: number,
  isPlatformUser: boolean,
): boolean {
  // Platform admins see everything
  if (isPlatformUser) return true;

  // No rule means visible by default
  if (!rule) return true;

  // Always visible items
  if (rule.alwaysVisible) return true;

  // Platform-only items
  if (rule.platformOnly) return false;

  // Check minimum level
  if (rule.minLevel && userLevel < rule.minLevel) return false;

  // Check required ALL permissions (AND logic)
  if (rule.requiredAllPermissions && rule.requiredAllPermissions.length > 0) {
    const hasAll = rule.requiredAllPermissions.every((p) => userPermissions.has(p));
    if (!hasAll) return false;
  }

  // Check required permissions (OR logic) - at least one must match
  if (rule.requiredPermissions && rule.requiredPermissions.length > 0) {
    const hasAny = rule.requiredPermissions.some((p) => userPermissions.has(p));
    if (!hasAny) return false;
  }

  return true;
}

/**
 * Maps legacy module boolean permissions to granular permissions based on role level.
 * This ensures backward compatibility while transitioning to the enhanced RBAC system.
 *
 * Exported from this pure-utility file (no React/Supabase deps) so it can be
 * imported in non-React contexts such as unit tests. Re-exported by usePermissions.ts.
 */
export function expandLegacyPermissions(
  modulePermissions: Record<string, boolean>,
  level: number,
): Set<string> {
  const perms = new Set<string>();

  // Sales module
  if (modulePermissions.sales) {
    perms.add('sales.lead.view_own');
    perms.add('sales.lead.create');
    perms.add('sales.lead.edit_own');
    perms.add('sales.opportunity.view_own');
    perms.add('sales.opportunity.create');
    perms.add('sales.opportunity.edit_own');
    perms.add('sales.customer.view_own');
    perms.add('sales.customer.edit_own');
    perms.add('sales.quote.create');
    perms.add('sales.quote.edit_own');
    perms.add('sales.commission.view_own');
    perms.add('sales.territory.view_own');

    if (level >= 2) {
      perms.add('sales.lead.view_team');
      perms.add('sales.opportunity.view_team');
      perms.add('sales.commission.view_team');
    }
    if (level >= 3) {
      perms.add('sales.lead.edit_team');
      perms.add('sales.lead.assign');
      perms.add('sales.lead.delete');
      perms.add('sales.quote.approve_standard');
    }
    if (level >= 4) {
      perms.add('sales.lead.view_location');
      perms.add('sales.lead.edit_location');
      perms.add('sales.lead.import');
      perms.add('sales.opportunity.view_location');
      perms.add('sales.customer.view_location');
      perms.add('sales.customer.create');
      perms.add('sales.quote.approve_high_value');
      perms.add('sales.territory.manage_assignments');
      perms.add('sales.territory.view_performance');
    }
    if (level >= 5) {
      perms.add('sales.lead.view_regional');
      perms.add('sales.opportunity.view_regional');
    }
    if (level >= 6) {
      perms.add('sales.lead.view_company');
      perms.add('sales.opportunity.view_company');
      perms.add('sales.quote.approve_enterprise');
      perms.add('sales.quote.custom_pricing');
      perms.add('sales.commission.approve');
    }
  }

  // Service module
  if (modulePermissions.service) {
    perms.add('service.ticket.view_own');
    perms.add('service.ticket.edit_own');
    perms.add('service.ticket.close');
    perms.add('service.equipment.view');
    perms.add('service.equipment.install');
    perms.add('service.equipment.configure');
    perms.add('service.parts.view');
    perms.add('service.parts.request');
    perms.add('service.workorder.view_own');
    perms.add('service.schedule.view_own');

    if (level >= 2) {
      perms.add('service.ticket.view_team');
      perms.add('service.schedule.view_team');
      perms.add('service.ticket.create');
    }
    if (level >= 3) {
      perms.add('service.ticket.assign');
      perms.add('service.ticket.void');
      perms.add('service.parts.approve');
      perms.add('service.schedule.manage');
    }
    if (level >= 4) {
      perms.add('service.ticket.view_location');
      perms.add('service.equipment.decommission');
      perms.add('service.parts.order');
      perms.add('service.workorder.create');
      perms.add('service.workorder.approve');
    }
  }

  // Operations / Inventory module
  if (modulePermissions.inventory || modulePermissions.purchasing) {
    perms.add('operations.inventory.view');
    perms.add('operations.po.view');

    if (level >= 1) {
      perms.add('operations.warehouse.receive');
      perms.add('operations.warehouse.pick');
      perms.add('operations.warehouse.ship');
    }
    if (level >= 3) {
      perms.add('operations.inventory.adjust');
    }
    if (level >= 4) {
      perms.add('operations.inventory.manage');
      perms.add('operations.inventory.transfer');
      perms.add('operations.warehouse.manage');
      perms.add('operations.po.create');
      perms.add('operations.po.approve');
    }
  }

  // Finance / Billing module
  if (modulePermissions.billing || modulePermissions.finance) {
    if (level >= 1) {
      perms.add('finance.ar.view');
      perms.add('finance.invoice.create');
      perms.add('finance.bill.enter');
      perms.add('finance.payment.apply');
    }
    if (level >= 2) {
      perms.add('finance.ap.view');
    }
    if (level >= 4) {
      perms.add('finance.gl.view');
      perms.add('finance.gl.post');
      perms.add('finance.invoice.void');
      perms.add('finance.bill.approve');
      perms.add('finance.reports.view');
    }
    if (level >= 6) {
      perms.add('finance.payment.process');
      perms.add('finance.reports.view_sensitive');
      perms.add('finance.gl.close_period');
    }
  }

  // Reports module
  if (modulePermissions.reports) {
    perms.add('reporting.report.view');
    perms.add('reporting.dashboard.customize');

    if (level >= 2) {
      perms.add('reporting.sales.view');
      perms.add('reporting.service.view');
      perms.add('reporting.report.export');
    }
    if (level >= 3) {
      perms.add('reporting.report.schedule');
    }
    if (level >= 4) {
      perms.add('reporting.finance.view');
      perms.add('reporting.report.create');
    }
    if (level >= 6) {
      perms.add('reporting.executive.view');
      perms.add('reporting.kpi.manage');
    }
  }

  // System / Admin module
  if (modulePermissions.system) {
    if (level >= 3) {
      perms.add('admin.settings.view');
      perms.add('admin.settings.integrations');
    }
    if (level >= 4) {
      perms.add('admin.settings.update');
      perms.add('admin.user.view');
      perms.add('admin.role.view');
      perms.add('admin.user.create_location');
    }
    if (level >= 5) {
      perms.add('admin.user.create_regional');
      perms.add('admin.role.assign');
      perms.add('audit.logs.view_location');
    }
    if (level >= 6) {
      perms.add('admin.user.create_company');
      perms.add('admin.role.create');
      perms.add('audit.logs.view_regional');
      perms.add('audit.logs.view_company');
      perms.add('compliance.reports.view');
    }
    if (level >= 7) {
      perms.add('admin.user.edit_profile');
      perms.add('admin.user.deactivate');
      perms.add('admin.role.manage_permissions');
      perms.add('compliance.manage');
    }
  }

  return perms;
}

/**
 * Maps a route path to the permissions needed to access that page.
 * Used for page-level route guards (ProtectedRoute component).
 * Handles dynamic path segments like :slug, :id, :quoteId by trying
 * pattern matches against ITEM_PERMISSIONS entries.
 */
export function getRoutePermissions(path: string): NavigationPermissionRule | undefined {
  // Direct match
  if (ITEM_PERMISSIONS[path]) return ITEM_PERMISSIONS[path];

  // Try without query params
  const basePath = path.split('?')[0];
  if (ITEM_PERMISSIONS[basePath]) return ITEM_PERMISSIONS[basePath];

  // Try matching dynamic path patterns (e.g. /customers/foo → /customers/:slug)
  const segments = basePath.split('/');
  for (const [pattern, rule] of Object.entries(ITEM_PERMISSIONS)) {
    const patternSegments = pattern.split('/');
    if (patternSegments.length !== segments.length) continue;

    let matches = true;
    for (let i = 0; i < patternSegments.length; i++) {
      if (patternSegments[i].startsWith(':')) continue; // wildcard segment
      if (patternSegments[i] !== segments[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return rule;
  }

  return undefined;
}
