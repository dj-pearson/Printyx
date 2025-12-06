// =====================================================================
// RBAC ROUTE INTEGRATION HELPER
// Easy-to-use utilities for integrating RBAC into route files
// =====================================================================

import { Router, Request, Response, NextFunction } from 'express';
import {
  enhanceUserContext,
  requirePermission,
  requireAllPermissions,
  requireLevel,
  requireScope,
  requireMFA,
  requireApproval,
  requirePermissionWithMFA,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  type AuthenticatedRequest,
  type EnhancedUserContext,
} from './enhanced-rbac-middleware';
import { HierarchicalQueryBuilder } from './hierarchical-query-builder';

// Re-export all middleware for convenience
export {
  enhanceUserContext,
  requirePermission,
  requireAllPermissions,
  requireLevel,
  requireScope,
  requireMFA,
  requireApproval,
  requirePermissionWithMFA,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  HierarchicalQueryBuilder,
  type AuthenticatedRequest,
  type EnhancedUserContext,
};

// =====================================================================
// QUICK SETUP FUNCTIONS
// =====================================================================

/**
 * Create a router with RBAC context automatically applied to all routes
 *
 * Usage:
 * ```typescript
 * const router = createRBACRouter();
 *
 * router.get('/items', requirePermission('inventory.item.view'), handler);
 * router.post('/items', requirePermission('inventory.item.create'), handler);
 * ```
 */
export function createRBACRouter(): Router {
  const router = Router();
  router.use(enhanceUserContext);
  return router;
}

/**
 * Apply RBAC middleware to an existing router
 *
 * Usage:
 * ```typescript
 * const router = Router();
 * applyRBAC(router);
 * ```
 */
export function applyRBAC(router: Router): Router {
  router.use(enhanceUserContext);
  return router;
}

// =====================================================================
// PERMISSION CONSTANTS BY MODULE
// =====================================================================

/**
 * Pre-defined permission constants for easy reference
 * Use these instead of hardcoding permission strings
 */
export const PERMISSIONS = {
  // Sales Module
  SALES: {
    LEAD: {
      VIEW_OWN: 'sales.lead.view_own',
      VIEW_TEAM: 'sales.lead.view_team',
      VIEW_LOCATION: 'sales.lead.view_location',
      VIEW_REGIONAL: 'sales.lead.view_regional',
      VIEW_COMPANY: 'sales.lead.view_company',
      CREATE: 'sales.lead.create',
      UPDATE_OWN: 'sales.lead.update_own',
      UPDATE_ANY: 'sales.lead.update_any',
      DELETE: 'sales.lead.delete',
      IMPORT: 'sales.lead.import',
      EXPORT: 'sales.lead.export',
      ASSIGN: 'sales.lead.assign',
      CONVERT: 'sales.lead.convert',
    },
    CUSTOMER: {
      VIEW_OWN: 'sales.customer.view_own',
      VIEW_TEAM: 'sales.customer.view_team',
      VIEW_LOCATION: 'sales.customer.view_location',
      VIEW_COMPANY: 'sales.customer.view_company',
      CREATE: 'sales.customer.create',
      UPDATE: 'sales.customer.update',
      DELETE: 'sales.customer.delete',
    },
    OPPORTUNITY: {
      VIEW_OWN: 'sales.opportunity.view_own',
      VIEW_TEAM: 'sales.opportunity.view_team',
      VIEW_LOCATION: 'sales.opportunity.view_location',
      CREATE: 'sales.opportunity.create',
      UPDATE_OWN: 'sales.opportunity.update_own',
      UPDATE_ANY: 'sales.opportunity.update_any',
      DELETE: 'sales.opportunity.delete',
    },
    QUOTE: {
      VIEW_OWN: 'sales.quote.view_own',
      VIEW_TEAM: 'sales.quote.view_team',
      CREATE: 'sales.quote.create',
      UPDATE: 'sales.quote.update',
      DELETE: 'sales.quote.delete',
      APPROVE_STANDARD: 'sales.quote.approve_standard',
      APPROVE_ENTERPRISE: 'sales.quote.approve_enterprise',
      SEND: 'sales.quote.send',
    },
    DEAL: {
      VIEW_OWN: 'sales.deal.view_own',
      VIEW_TEAM: 'sales.deal.view_team',
      VIEW_LOCATION: 'sales.deal.view_location',
      CREATE: 'sales.deal.create',
      UPDATE: 'sales.deal.update',
      CLOSE_WON: 'sales.deal.close_won',
      CLOSE_LOST: 'sales.deal.close_lost',
    },
    PIPELINE: {
      VIEW: 'sales.pipeline.view',
      CONFIGURE: 'sales.pipeline.configure',
    },
    REPORT: {
      VIEW_OWN: 'sales.report.view_own',
      VIEW_TEAM: 'sales.report.view_team',
      VIEW_LOCATION: 'sales.report.view_location',
      VIEW_COMPANY: 'sales.report.view_company',
      EXPORT: 'sales.report.export',
    },
  },

  // Service Module
  SERVICE: {
    TICKET: {
      VIEW_OWN: 'service.ticket.view_own',
      VIEW_TEAM: 'service.ticket.view_team',
      VIEW_LOCATION: 'service.ticket.view_location',
      CREATE: 'service.ticket.create',
      UPDATE: 'service.ticket.update',
      CLOSE: 'service.ticket.close',
      ASSIGN: 'service.ticket.assign',
      ESCALATE: 'service.ticket.escalate',
    },
    DISPATCH: {
      VIEW: 'service.dispatch.view',
      SCHEDULE: 'service.dispatch.schedule',
      REASSIGN: 'service.dispatch.reassign',
      OPTIMIZE: 'service.dispatch.optimize',
    },
    TECHNICIAN: {
      VIEW: 'service.technician.view',
      MANAGE: 'service.technician.manage',
      ASSIGN_TERRITORY: 'service.technician.assign_territory',
    },
    EQUIPMENT: {
      VIEW: 'service.equipment.view',
      CREATE: 'service.equipment.create',
      UPDATE: 'service.equipment.update',
      DELETE: 'service.equipment.delete',
      SERVICE_HISTORY: 'service.equipment.service_history',
    },
    MAINTENANCE: {
      VIEW: 'service.maintenance.view',
      SCHEDULE: 'service.maintenance.schedule',
      COMPLETE: 'service.maintenance.complete',
    },
    REPORT: {
      VIEW_OWN: 'service.report.view_own',
      VIEW_TEAM: 'service.report.view_team',
      VIEW_LOCATION: 'service.report.view_location',
      VIEW_COMPANY: 'service.report.view_company',
    },
  },

  // Inventory Module
  INVENTORY: {
    ITEM: {
      VIEW: 'inventory.item.view',
      CREATE: 'inventory.item.create',
      UPDATE: 'inventory.item.update',
      DELETE: 'inventory.item.delete',
      ADJUST: 'inventory.item.adjust',
    },
    WAREHOUSE: {
      VIEW: 'inventory.warehouse.view',
      MANAGE: 'inventory.warehouse.manage',
      TRANSFER: 'inventory.warehouse.transfer',
    },
    PURCHASE_ORDER: {
      VIEW: 'inventory.po.view',
      CREATE: 'inventory.po.create',
      APPROVE: 'inventory.po.approve',
      RECEIVE: 'inventory.po.receive',
    },
  },

  // Finance Module
  FINANCE: {
    INVOICE: {
      VIEW_OWN: 'finance.invoice.view_own',
      VIEW_LOCATION: 'finance.invoice.view_location',
      VIEW_COMPANY: 'finance.invoice.view_company',
      CREATE: 'finance.invoice.create',
      UPDATE: 'finance.invoice.update',
      VOID: 'finance.invoice.void',
      SEND: 'finance.invoice.send',
    },
    PAYMENT: {
      VIEW: 'finance.payment.view',
      RECORD: 'finance.payment.record',
      PROCESS: 'finance.payment.process',
      REFUND: 'finance.payment.refund',
    },
    BILLING: {
      VIEW: 'finance.billing.view',
      CONFIGURE: 'finance.billing.configure',
      METER_BILLING: 'finance.billing.meter_billing',
    },
    REPORT: {
      VIEW: 'finance.report.view',
      SENSITIVE: 'finance.report.sensitive',
      EXPORT: 'finance.report.export',
    },
  },

  // Admin Module
  ADMIN: {
    USER: {
      VIEW: 'admin.user.view',
      CREATE_LOCATION: 'admin.user.create_location',
      CREATE_COMPANY: 'admin.user.create_company',
      UPDATE: 'admin.user.update',
      DELETE: 'admin.user.delete',
      IMPERSONATE: 'admin.user.impersonate',
      RESET_PASSWORD: 'admin.user.reset_password',
    },
    ROLE: {
      VIEW: 'admin.role.view',
      CREATE: 'admin.role.create',
      UPDATE: 'admin.role.update',
      DELETE: 'admin.role.delete',
      ASSIGN: 'admin.role.assign',
      MANAGE_PERMISSIONS: 'role.manage_permissions',
    },
    SETTINGS: {
      VIEW: 'admin.settings.view',
      UPDATE: 'admin.settings.update',
      INTEGRATIONS: 'admin.settings.integrations',
    },
    AUDIT: {
      VIEW: 'admin.audit.view',
      EXPORT: 'admin.audit.export',
    },
  },

  // Platform Module (Printyx Staff Only)
  PLATFORM: {
    TENANT: {
      VIEW: 'platform.tenant.view',
      CREATE: 'platform.tenant.create',
      UPDATE: 'platform.tenant.update',
      SUSPEND: 'platform.tenant.suspend',
    },
    ACCESS_ALL_TENANTS: 'platform.access_all_tenants',
    SYSTEM: {
      VIEW: 'platform.system.view',
      CONFIGURE: 'platform.system.configure',
    },
  },

  // Reporting Module
  REPORTING: {
    VIEW_REPORTS: 'canViewReports',
    VIEW_SALES_REPORTS: 'canViewSalesReports',
    VIEW_SERVICE_REPORTS: 'canViewServiceReports',
    VIEW_FINANCE_REPORTS: 'canViewFinanceReports',
    VIEW_OPERATIONS_REPORTS: 'canViewOperationsReports',
    VIEW_EXECUTIVE_REPORTS: 'canViewExecutiveReports',
    VIEW_OWN_DATA: 'canViewOwnData',
    VIEW_TEAM_DATA: 'canViewTeamData',
    VIEW_LOCATION_DATA: 'canViewLocationData',
    VIEW_REGIONAL_DATA: 'canViewRegionalData',
    VIEW_COMPANY_DATA: 'canViewCompanyData',
    EXPORT_REPORTS: 'canExportReports',
    SCHEDULE_REPORTS: 'canScheduleReports',
    CUSTOMIZE_DASHBOARDS: 'canCustomizeDashboards',
    MANAGE_KPIS: 'canManageKPIs',
    MANAGE_REPORT_DEFINITIONS: 'canManageReportDefinitions',
  },
} as const;

// =====================================================================
// ROLE LEVEL CONSTANTS
// =====================================================================

/**
 * Role hierarchy levels for easy reference
 */
export const ROLE_LEVELS = {
  INDIVIDUAL_CONTRIBUTOR: 1,
  TEAM_LEAD: 2,
  SUPERVISOR: 3,
  MANAGER: 4,
  REGIONAL_DIRECTOR: 5,
  COMPANY_DIRECTOR: 6,
  EXECUTIVE: 7,
  PLATFORM_ADMIN: 8,
} as const;

// =====================================================================
// SCOPE CONSTANTS
// =====================================================================

/**
 * Organizational scope levels for easy reference
 */
export const SCOPES = {
  OWN: 'own',
  TEAM: 'team',
  LOCATION: 'location',
  REGIONAL: 'regional',
  COMPANY: 'company',
  PLATFORM: 'platform',
} as const;

// =====================================================================
// COMPOSITE MIDDLEWARE HELPERS
// =====================================================================

/**
 * Create middleware that requires permission AND minimum level
 */
export function requirePermissionAndLevel(
  permission: string | string[],
  minLevel: number
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const permCheck = requirePermission(permission, { minLevel });
    permCheck(req, res, next);
  };
}

/**
 * Create middleware for manager-level access with specific permission
 */
export function requireManagerAccess(
  permission: string | string[]
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return requirePermissionAndLevel(permission, ROLE_LEVELS.MANAGER);
}

/**
 * Create middleware for director-level access with specific permission
 */
export function requireDirectorAccess(
  permission: string | string[]
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return requirePermissionAndLevel(permission, ROLE_LEVELS.REGIONAL_DIRECTOR);
}

/**
 * Create middleware for executive-level access with specific permission
 */
export function requireExecutiveAccess(
  permission: string | string[]
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return requirePermissionAndLevel(permission, ROLE_LEVELS.EXECUTIVE);
}

/**
 * Create middleware that requires MFA for sensitive operations
 */
export function requireSensitiveAccess(
  permission: string | string[]
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return requirePermissionWithMFA(permission);
}

// =====================================================================
// QUERY HELPER
// =====================================================================

/**
 * Get a hierarchical query builder for the current user
 * Use this to automatically scope database queries based on user's role
 */
export function getQueryBuilder(req: AuthenticatedRequest): HierarchicalQueryBuilder | null {
  if (!req.user) return null;

  return new HierarchicalQueryBuilder({
    id: req.user.id,
    tenantId: req.user.tenantId,
    scope: req.user.territoryScope,
    locationId: req.user.locationId,
    regionId: req.user.regionId,
    teamId: req.user.teamId,
    managerId: req.user.managerId,
  });
}

// =====================================================================
// ROUTE PROTECTION PATTERNS
// =====================================================================

/**
 * Example usage patterns for common route protection scenarios
 *
 * @example
 * // Basic permission check
 * router.get('/leads', requirePermission(PERMISSIONS.SALES.LEAD.VIEW_OWN), handler);
 *
 * @example
 * // Multiple permissions (user needs ANY)
 * router.get('/data', requirePermission([PERMISSIONS.SALES.LEAD.VIEW_OWN, PERMISSIONS.SALES.LEAD.VIEW_TEAM]), handler);
 *
 * @example
 * // All permissions required
 * router.post('/approve', requireAllPermissions([PERMISSIONS.SALES.QUOTE.VIEW, PERMISSIONS.SALES.QUOTE.APPROVE_STANDARD]), handler);
 *
 * @example
 * // Level-based access
 * router.get('/executive-dashboard', requireLevel(ROLE_LEVELS.EXECUTIVE), handler);
 *
 * @example
 * // Scope-based access
 * router.get('/company-data', requireScope(SCOPES.COMPANY), handler);
 *
 * @example
 * // MFA required for sensitive operations
 * router.delete('/user/:id', requireSensitiveAccess(PERMISSIONS.ADMIN.USER.DELETE), handler);
 *
 * @example
 * // Using query builder for data scoping
 * router.get('/leads', requirePermission(PERMISSIONS.SALES.LEAD.VIEW_OWN), async (req, res) => {
 *   const queryBuilder = getQueryBuilder(req);
 *   const filter = queryBuilder?.applyHierarchicalFilter();
 *
 *   const leads = await db.select().from(leads).where(filter);
 *   res.json(leads);
 * });
 */

// =====================================================================
// MIDDLEWARE CHAIN HELPERS
// =====================================================================

/**
 * Chain multiple middleware functions together
 */
export function chainMiddleware(
  ...middlewares: Array<(req: AuthenticatedRequest, res: Response, next: NextFunction) => void>
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let index = 0;

    const runNext = (err?: any) => {
      if (err) return next(err);
      if (res.headersSent) return;

      const middleware = middlewares[index++];
      if (middleware) {
        try {
          middleware(req, res, runNext);
        } catch (error) {
          next(error);
        }
      } else {
        next();
      }
    };

    runNext();
  };
}
