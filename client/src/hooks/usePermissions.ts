/**
 * usePermissions Hook
 *
 * Provides granular RBAC permission checking for the frontend.
 * Bridges the enhanced backend permission system (sales.lead.view_own format)
 * with the frontend sidebar and page-level access control.
 *
 * This hook resolves permissions from two sources:
 * 1. Granular permissions from the enhanced RBAC system (user.role.enhancedPermissions)
 * 2. Legacy module-level permissions (user.role.permissions: { sales: true })
 *
 * When only legacy permissions are available, they are expanded to a reasonable
 * set of granular permissions based on the user's role level.
 */

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  checkNavigationAccess,
  SECTION_PERMISSIONS,
  ITEM_PERMISSIONS,
  type NavigationPermissionRule,
} from '@/lib/navigation-permissions';

/**
 * The shape of the enhanced permission context available to components.
 */
export interface PermissionContext {
  /** Set of granular permission codes the user has */
  permissions: Set<string>;
  /** User's role hierarchy level (1-8) */
  level: number;
  /** Whether the user is a platform admin */
  isPlatformUser: boolean;
  /** The user's role code (e.g., 'SALES_REP', 'SALES_MANAGER') */
  roleCode: string;
  /** The user's organizational tier */
  organizationalTier: string;
  /** The user's department */
  department: string;
}

/**
 * Maps legacy module boolean permissions to granular permissions based on role level.
 * This ensures backward compatibility while transitioning to the enhanced RBAC system.
 */
function expandLegacyPermissions(
  modulePermissions: Record<string, boolean>,
  level: number,
): Set<string> {
  const perms = new Set<string>();

  // Sales module
  if (modulePermissions.sales) {
    // All levels get own-scope
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
      // Team Lead / Senior: team visibility
      perms.add('sales.lead.view_team');
      perms.add('sales.opportunity.view_team');
      perms.add('sales.commission.view_team');
    }
    if (level >= 3) {
      // Supervisor: team management + approvals
      perms.add('sales.lead.edit_team');
      perms.add('sales.lead.assign');
      perms.add('sales.lead.delete');
      perms.add('sales.quote.approve_standard');
    }
    if (level >= 4) {
      // Manager: location scope
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
      // Regional: regional scope
      perms.add('sales.lead.view_regional');
      perms.add('sales.opportunity.view_regional');
    }
    if (level >= 6) {
      // Director: company scope + enterprise approvals
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
 * Hook to access the user's resolved permissions.
 * Returns a PermissionContext object with helper methods.
 */
export function usePermissions(): PermissionContext & {
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user has ANY of the given permissions */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** Check if user has ALL of the given permissions */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Check if user can access a navigation section */
  canAccessSection: (sectionId: string) => boolean;
  /** Check if user can access a navigation item by path */
  canAccessItem: (path: string) => boolean;
  /** Check access against a custom permission rule */
  checkAccess: (rule: NavigationPermissionRule) => boolean;
  /** Whether permissions are loaded */
  isLoaded: boolean;
} {
  const { user } = useAuth();

  return useMemo(() => {
    const role = user?.role;
    const level: number = role?.level || 1;
    const isPlatformUser: boolean = user?.isPlatformUser || false;
    const roleCode: string = role?.code || role?.name || 'USER';
    const organizationalTier: string = role?.organizationalTier || 'location';
    const department: string = role?.department || '';

    // Resolve permissions: prefer enhanced granular permissions, fall back to legacy expansion
    let permissions: Set<string>;

    if (role?.enhancedPermissions && Array.isArray(role.enhancedPermissions)) {
      // Enhanced RBAC system provides an array of permission codes
      permissions = new Set<string>(role.enhancedPermissions);
    } else if (role?.permissions && typeof role.permissions === 'object') {
      // Legacy module boolean permissions - expand based on level
      permissions = expandLegacyPermissions(role.permissions, level);
    } else {
      // No permissions at all - minimal access
      permissions = new Set<string>();
    }

    // Platform admins bypass all permission checks
    const hasPermission = (permission: string): boolean => {
      if (isPlatformUser) return true;
      return permissions.has(permission);
    };

    const hasAnyPermission = (perms: string[]): boolean => {
      if (isPlatformUser) return true;
      return perms.some((p) => permissions.has(p));
    };

    const hasAllPermissions = (perms: string[]): boolean => {
      if (isPlatformUser) return true;
      return perms.every((p) => permissions.has(p));
    };

    const checkAccess = (rule: NavigationPermissionRule): boolean => {
      return checkNavigationAccess(rule, permissions, level, isPlatformUser);
    };

    const canAccessSection = (sectionId: string): boolean => {
      const rule = SECTION_PERMISSIONS[sectionId];
      return checkNavigationAccess(rule, permissions, level, isPlatformUser);
    };

    const canAccessItem = (path: string): boolean => {
      const rule = ITEM_PERMISSIONS[path];
      return checkNavigationAccess(rule, permissions, level, isPlatformUser);
    };

    return {
      permissions,
      level,
      isPlatformUser,
      roleCode,
      organizationalTier,
      department,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessSection,
      canAccessItem,
      checkAccess,
      isLoaded: !!user?.role,
    };
  }, [user]);
}
