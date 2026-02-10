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
  customers: { alwaysVisible: true },
  tasks: { alwaysVisible: true },
  'ai-hub': { alwaysVisible: true },
  'knowledge-base': { alwaysVisible: true },
  settings: { alwaysVisible: true },

  // Platform Admin Only
  'platform-admin-hub': { platformOnly: true },
  'tenant-org-management': { platformOnly: true },
  'user-access-management': { platformOnly: true },
  'system-operations': { platformOnly: true },
  'platform-features': { platformOnly: true },

  // Module sections - require at least one permission in the module
  crm: {
    requiredPermissions: [
      'sales.lead.view_own',
      'sales.lead.view_team',
      'sales.lead.view_location',
      'sales.lead.view_regional',
      'sales.lead.view_company',
      'sales.opportunity.view_own',
      'sales.customer.view_own',
      'sales.quote.create',
    ],
  },
  service: {
    requiredPermissions: [
      'service.ticket.view_own',
      'service.ticket.view_team',
      'service.ticket.view_location',
      'service.equipment.view',
      'service.schedule.view_own',
    ],
  },
  products: {
    requiredPermissions: [
      'sales.customer.view_own', // Product catalog is tied to customer access
      'operations.inventory.view',
    ],
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

  // System sections - require higher level or admin permissions
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
 * Maps a route path to the permissions needed to access that page.
 * Used for page-level route guards (ProtectedRoute component).
 * Falls back to ITEM_PERMISSIONS, then SECTION_PERMISSIONS.
 */
export function getRoutePermissions(path: string): NavigationPermissionRule | undefined {
  // Direct match
  if (ITEM_PERMISSIONS[path]) return ITEM_PERMISSIONS[path];

  // Try without query params
  const basePath = path.split('?')[0];
  if (ITEM_PERMISSIONS[basePath]) return ITEM_PERMISSIONS[basePath];

  // Try matching against section paths
  for (const [, rule] of Object.entries(SECTION_PERMISSIONS)) {
    // Section-level rules are less specific, return them as fallback
  }

  return undefined;
}
