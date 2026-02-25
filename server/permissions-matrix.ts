/**
 * Permission Matrix
 *
 * Documents the complete mapping of API endpoints to required RBAC permissions.
 * Used as a reference for security audits and for programmatic enforcement.
 *
 * Format: { method, path, permissions, minLevel?, scope? }
 *
 * Permission format: <module>.<resource>.<action>_<scope>
 */

export interface PermissionEntry {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  permissions: string[];
  minLevel?: number;
  scope?: 'own' | 'team' | 'location' | 'regional' | 'company' | 'platform';
  description?: string;
}

/** CRM & Sales Endpoints */
export const CRM_PERMISSIONS: PermissionEntry[] = [
  // Leads
  {
    method: 'GET',
    path: '/api/leads',
    permissions: ['sales.lead.view_own', 'sales.lead.view_team'],
  },
  { method: 'POST', path: '/api/leads', permissions: ['sales.lead.create'] },
  { method: 'PUT', path: '/api/leads/:id', permissions: ['sales.lead.update_own'] },
  { method: 'DELETE', path: '/api/leads/:id', permissions: ['sales.lead.delete'], minLevel: 3 },
  { method: 'POST', path: '/api/leads/import', permissions: ['sales.lead.import'], minLevel: 4 },
  {
    method: 'POST',
    path: '/api/leads/bulk-update',
    permissions: ['sales.lead.update_any'],
    minLevel: 3,
    scope: 'team',
  },
  {
    method: 'POST',
    path: '/api/leads/bulk-delete',
    permissions: ['sales.lead.delete'],
    minLevel: 4,
    scope: 'location',
  },

  // Customers
  { method: 'GET', path: '/api/customers', permissions: ['sales.customer.view_own'] },
  { method: 'POST', path: '/api/customers', permissions: ['sales.customer.create'] },
  { method: 'PUT', path: '/api/customers/:id', permissions: ['sales.customer.update'] },
  {
    method: 'DELETE',
    path: '/api/customers/:id',
    permissions: ['sales.customer.delete'],
    minLevel: 4,
  },

  // Contacts
  { method: 'GET', path: '/api/contacts', permissions: ['sales.customer.view_own'] },
  { method: 'POST', path: '/api/contacts', permissions: ['sales.customer.create'] },
  { method: 'PUT', path: '/api/contacts/:id', permissions: ['sales.customer.update'] },
  {
    method: 'DELETE',
    path: '/api/contacts/:id',
    permissions: ['sales.customer.delete'],
    minLevel: 3,
  },

  // Company Contacts
  { method: 'GET', path: '/api/company-contacts', permissions: ['sales.customer.view_own'] },
  { method: 'POST', path: '/api/company-contacts', permissions: ['sales.customer.create'] },
  { method: 'PUT', path: '/api/company-contacts/:id', permissions: ['sales.customer.update'] },
  {
    method: 'DELETE',
    path: '/api/company-contacts/:id',
    permissions: ['sales.customer.delete'],
    minLevel: 3,
  },

  // Business Records
  { method: 'GET', path: '/api/business-records', permissions: ['sales.customer.view_own'] },
  { method: 'POST', path: '/api/business-records', permissions: ['sales.customer.create'] },
  { method: 'PATCH', path: '/api/business-records/:id', permissions: ['sales.customer.update'] },
  {
    method: 'DELETE',
    path: '/api/business-records/:id',
    permissions: ['sales.customer.delete'],
    minLevel: 3,
  },

  // Deals / Opportunities
  {
    method: 'GET',
    path: '/api/deals',
    permissions: ['sales.deal.view_own', 'sales.deal.view_team'],
  },
  { method: 'POST', path: '/api/deals', permissions: ['sales.deal.create'] },
  { method: 'PUT', path: '/api/deals/:id', permissions: ['sales.deal.update'] },
  {
    method: 'DELETE',
    path: '/api/deals/:id',
    permissions: ['sales.opportunity.delete'],
    minLevel: 3,
  },

  // Quotes
  {
    method: 'GET',
    path: '/api/quotes',
    permissions: ['sales.quote.view_own', 'sales.quote.view_team'],
  },
  { method: 'POST', path: '/api/quotes', permissions: ['sales.quote.create'] },
  { method: 'PUT', path: '/api/quotes/:id', permissions: ['sales.quote.update'] },
  { method: 'DELETE', path: '/api/quotes/:id', permissions: ['sales.quote.delete'], minLevel: 3 },
  {
    method: 'POST',
    path: '/api/quotes/:id/approve',
    permissions: ['sales.quote.approve_standard'],
    minLevel: 3,
  },
  { method: 'POST', path: '/api/quotes/:id/send', permissions: ['sales.quote.send'] },
];

/** Service & Dispatch Endpoints */
export const SERVICE_PERMISSIONS: PermissionEntry[] = [
  { method: 'GET', path: '/api/service-tickets', permissions: ['service.ticket.view_own'] },
  { method: 'POST', path: '/api/service-tickets', permissions: ['service.ticket.create'] },
  { method: 'PUT', path: '/api/service-tickets/:id', permissions: ['service.ticket.update'] },
  {
    method: 'POST',
    path: '/api/service-tickets/:id/assign',
    permissions: ['service.ticket.assign'],
    minLevel: 3,
  },
  { method: 'POST', path: '/api/service-tickets/:id/close', permissions: ['service.ticket.close'] },
  {
    method: 'DELETE',
    path: '/api/service-tickets/:id',
    permissions: ['service.ticket.close'],
    minLevel: 4,
  },

  { method: 'GET', path: '/api/equipment', permissions: ['service.equipment.view'] },
  { method: 'POST', path: '/api/equipment', permissions: ['service.equipment.create'] },
  { method: 'PUT', path: '/api/equipment/:id', permissions: ['service.equipment.update'] },
  {
    method: 'DELETE',
    path: '/api/equipment/:id',
    permissions: ['service.equipment.delete'],
    minLevel: 4,
  },

  { method: 'GET', path: '/api/dispatch', permissions: ['service.dispatch.view'] },
  {
    method: 'POST',
    path: '/api/dispatch/schedule',
    permissions: ['service.dispatch.schedule'],
    minLevel: 3,
  },
  {
    method: 'POST',
    path: '/api/dispatch/optimize',
    permissions: ['service.dispatch.optimize'],
    minLevel: 4,
  },
];

/** Finance & Billing Endpoints */
export const FINANCE_PERMISSIONS: PermissionEntry[] = [
  { method: 'GET', path: '/api/invoices', permissions: ['finance.invoice.view_own'] },
  { method: 'POST', path: '/api/invoices', permissions: ['finance.invoice.create'] },
  { method: 'PUT', path: '/api/invoices/:id', permissions: ['finance.invoice.update'] },
  {
    method: 'POST',
    path: '/api/invoices/:id/void',
    permissions: ['finance.invoice.void'],
    minLevel: 4,
  },
  { method: 'POST', path: '/api/invoices/:id/send', permissions: ['finance.invoice.send'] },
  {
    method: 'DELETE',
    path: '/api/invoices/:id',
    permissions: ['finance.invoice.void'],
    minLevel: 5,
  },

  { method: 'POST', path: '/api/payments', permissions: ['finance.payment.record'] },
  {
    method: 'POST',
    path: '/api/payments/:id/refund',
    permissions: ['finance.payment.refund'],
    minLevel: 5,
  },

  { method: 'GET', path: '/api/billing', permissions: ['finance.billing.view'] },
  {
    method: 'PUT',
    path: '/api/billing/config',
    permissions: ['finance.billing.configure'],
    minLevel: 4,
  },
];

/** Inventory & Warehouse Endpoints */
export const INVENTORY_PERMISSIONS: PermissionEntry[] = [
  { method: 'GET', path: '/api/inventory', permissions: ['inventory.item.view'] },
  { method: 'POST', path: '/api/inventory', permissions: ['inventory.item.create'] },
  { method: 'PUT', path: '/api/inventory/:id', permissions: ['inventory.item.update'] },
  {
    method: 'DELETE',
    path: '/api/inventory/:id',
    permissions: ['inventory.item.delete'],
    minLevel: 4,
  },
  {
    method: 'POST',
    path: '/api/inventory/adjust',
    permissions: ['inventory.item.adjust'],
    minLevel: 3,
  },

  { method: 'GET', path: '/api/purchase-orders', permissions: ['inventory.po.view'] },
  { method: 'POST', path: '/api/purchase-orders', permissions: ['inventory.po.create'] },
  {
    method: 'POST',
    path: '/api/purchase-orders/:id/approve',
    permissions: ['inventory.po.approve'],
    minLevel: 4,
  },
];

/** Admin & Settings Endpoints */
export const ADMIN_PERMISSIONS: PermissionEntry[] = [
  { method: 'GET', path: '/api/users', permissions: ['admin.user.view'], minLevel: 4 },
  { method: 'POST', path: '/api/users', permissions: ['admin.user.create_location'], minLevel: 4 },
  { method: 'PUT', path: '/api/users/:id', permissions: ['admin.user.update'], minLevel: 4 },
  { method: 'DELETE', path: '/api/users/:id', permissions: ['admin.user.delete'], minLevel: 6 },

  { method: 'GET', path: '/api/roles', permissions: ['admin.role.view'], minLevel: 4 },
  { method: 'POST', path: '/api/roles', permissions: ['admin.role.create'], minLevel: 6 },
  { method: 'PUT', path: '/api/roles/:id', permissions: ['admin.role.update'], minLevel: 6 },
  { method: 'DELETE', path: '/api/roles/:id', permissions: ['admin.role.delete'], minLevel: 7 },

  { method: 'GET', path: '/api/settings', permissions: ['admin.settings.view'], minLevel: 3 },
  { method: 'PUT', path: '/api/settings', permissions: ['admin.settings.update'], minLevel: 4 },

  { method: 'GET', path: '/api/audit-logs', permissions: ['admin.audit.view'], minLevel: 5 },
  {
    method: 'POST',
    path: '/api/audit-logs/export',
    permissions: ['admin.audit.export'],
    minLevel: 6,
  },
];

/** Reporting Endpoints */
export const REPORTING_PERMISSIONS: PermissionEntry[] = [
  { method: 'GET', path: '/api/reports', permissions: ['reporting.report.view'] },
  { method: 'POST', path: '/api/reports', permissions: ['reporting.report.create'], minLevel: 4 },
  {
    method: 'POST',
    path: '/api/reports/:id/export',
    permissions: ['reporting.report.export'],
    minLevel: 2,
  },
  {
    method: 'GET',
    path: '/api/reports/executive',
    permissions: ['reporting.executive.view'],
    minLevel: 6,
  },
  {
    method: 'GET',
    path: '/api/reports/financial',
    permissions: ['reporting.finance.view'],
    minLevel: 4,
  },
];

/** Complete permission matrix */
export const PERMISSION_MATRIX: PermissionEntry[] = [
  ...CRM_PERMISSIONS,
  ...SERVICE_PERMISSIONS,
  ...FINANCE_PERMISSIONS,
  ...INVENTORY_PERMISSIONS,
  ...ADMIN_PERMISSIONS,
  ...REPORTING_PERMISSIONS,
];

/**
 * Lookup permissions for a given endpoint
 */
export function getEndpointPermissions(method: string, path: string): PermissionEntry | undefined {
  const normalizedPath = path.replace(/\/[a-f0-9-]{36}/g, '/:id').replace(/\/\d+/g, '/:id');
  return PERMISSION_MATRIX.find(
    (entry) =>
      entry.method === method.toUpperCase() &&
      (entry.path === normalizedPath || entry.path === path),
  );
}
