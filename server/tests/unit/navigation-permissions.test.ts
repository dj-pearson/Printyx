/**
 * Unit Tests: Navigation Permissions & Legacy Permission Expansion
 *
 * Tests for checkNavigationAccess() from navigation-permissions.ts
 * and expandLegacyPermissions() from usePermissions.ts.
 *
 * These are pure functions with no React/DOM dependencies, so they
 * run fine in the Node.js vitest environment.
 */

import { describe, it, expect } from 'vitest';
import {
  checkNavigationAccess,
  expandLegacyPermissions,
  SECTION_PERMISSIONS,
  ITEM_PERMISSIONS,
  type NavigationPermissionRule,
} from '@/lib/navigation-permissions';

// =====================================================================
// checkNavigationAccess
// =====================================================================

describe('checkNavigationAccess', () => {
  describe('Platform admin bypass', () => {
    it('should grant access to platform admins regardless of rule', () => {
      const rule: NavigationPermissionRule = {
        platformOnly: true,
        minLevel: 8,
        requiredPermissions: ['admin.settings.update'],
      };
      expect(checkNavigationAccess(rule, new Set(), 1, true)).toBe(true);
    });

    it('should grant platform admin access even with empty permissions', () => {
      expect(checkNavigationAccess({ requiredPermissions: ['x.y.z'] }, new Set(), 1, true)).toBe(
        true,
      );
    });
  });

  describe('No rule (undefined)', () => {
    it('should grant access when no rule is defined', () => {
      expect(checkNavigationAccess(undefined, new Set(), 1, false)).toBe(true);
    });
  });

  describe('alwaysVisible', () => {
    it('should grant access to alwaysVisible items', () => {
      const rule: NavigationPermissionRule = { alwaysVisible: true };
      expect(checkNavigationAccess(rule, new Set(), 1, false)).toBe(true);
    });

    it('should grant access to alwaysVisible even with other restrictions present', () => {
      const rule: NavigationPermissionRule = {
        alwaysVisible: true,
        minLevel: 8,
        platformOnly: true,
      };
      // alwaysVisible is checked before platformOnly, so it should grant access
      expect(checkNavigationAccess(rule, new Set(), 1, false)).toBe(true);
    });
  });

  describe('platformOnly', () => {
    it('should deny access to non-platform users', () => {
      const rule: NavigationPermissionRule = { platformOnly: true };
      expect(checkNavigationAccess(rule, new Set(), 7, false)).toBe(false);
    });

    it('should deny even high-level users if not platform admin', () => {
      const rule: NavigationPermissionRule = { platformOnly: true };
      expect(checkNavigationAccess(rule, new Set(['admin.settings.update']), 7, false)).toBe(false);
    });
  });

  describe('minLevel', () => {
    it('should grant access when user meets minimum level', () => {
      const rule: NavigationPermissionRule = { minLevel: 4 };
      expect(checkNavigationAccess(rule, new Set(), 4, false)).toBe(true);
    });

    it('should grant access when user exceeds minimum level', () => {
      const rule: NavigationPermissionRule = { minLevel: 3 };
      expect(checkNavigationAccess(rule, new Set(), 6, false)).toBe(true);
    });

    it('should deny access when user is below minimum level', () => {
      const rule: NavigationPermissionRule = { minLevel: 5 };
      expect(checkNavigationAccess(rule, new Set(), 4, false)).toBe(false);
    });

    it('should deny level 1 user from level 2+ items', () => {
      const rule: NavigationPermissionRule = { minLevel: 2 };
      expect(checkNavigationAccess(rule, new Set(), 1, false)).toBe(false);
    });
  });

  describe('requiredPermissions (OR logic)', () => {
    it('should grant access when user has one of the required permissions', () => {
      const rule: NavigationPermissionRule = {
        requiredPermissions: ['sales.lead.view_own', 'sales.lead.view_team'],
      };
      const perms = new Set(['sales.lead.view_own']);
      expect(checkNavigationAccess(rule, perms, 1, false)).toBe(true);
    });

    it('should grant access when user has multiple of the required permissions', () => {
      const rule: NavigationPermissionRule = {
        requiredPermissions: ['sales.lead.view_own', 'sales.lead.view_team'],
      };
      const perms = new Set(['sales.lead.view_own', 'sales.lead.view_team']);
      expect(checkNavigationAccess(rule, perms, 1, false)).toBe(true);
    });

    it('should deny access when user has none of the required permissions', () => {
      const rule: NavigationPermissionRule = {
        requiredPermissions: ['sales.lead.view_own', 'sales.lead.view_team'],
      };
      const perms = new Set(['service.ticket.view_own']);
      expect(checkNavigationAccess(rule, perms, 1, false)).toBe(false);
    });

    it('should grant access when requiredPermissions array is empty', () => {
      const rule: NavigationPermissionRule = { requiredPermissions: [] };
      expect(checkNavigationAccess(rule, new Set(), 1, false)).toBe(true);
    });
  });

  describe('requiredAllPermissions (AND logic)', () => {
    it('should grant access when user has all required permissions', () => {
      const rule: NavigationPermissionRule = {
        requiredAllPermissions: ['finance.gl.view', 'finance.gl.post'],
      };
      const perms = new Set(['finance.gl.view', 'finance.gl.post']);
      expect(checkNavigationAccess(rule, perms, 1, false)).toBe(true);
    });

    it('should deny access when user is missing one required permission', () => {
      const rule: NavigationPermissionRule = {
        requiredAllPermissions: ['finance.gl.view', 'finance.gl.post'],
      };
      const perms = new Set(['finance.gl.view']);
      expect(checkNavigationAccess(rule, perms, 1, false)).toBe(false);
    });

    it('should grant access when requiredAllPermissions is empty', () => {
      const rule: NavigationPermissionRule = { requiredAllPermissions: [] };
      expect(checkNavigationAccess(rule, new Set(), 1, false)).toBe(true);
    });
  });

  describe('Combined rules (minLevel + permissions)', () => {
    it('should require both level AND permissions to be satisfied', () => {
      const rule: NavigationPermissionRule = {
        minLevel: 4,
        requiredPermissions: ['finance.gl.view'],
      };
      // Has permission but too low level
      expect(checkNavigationAccess(rule, new Set(['finance.gl.view']), 3, false)).toBe(false);
      // Has level but no permission
      expect(checkNavigationAccess(rule, new Set(), 4, false)).toBe(false);
      // Has both
      expect(checkNavigationAccess(rule, new Set(['finance.gl.view']), 4, false)).toBe(true);
    });

    it('should check requiredAllPermissions AND requiredPermissions together', () => {
      const rule: NavigationPermissionRule = {
        requiredAllPermissions: ['finance.gl.view', 'finance.gl.post'],
        requiredPermissions: ['reporting.finance.view'],
      };
      // Has all required AND any required
      const fullPerms = new Set(['finance.gl.view', 'finance.gl.post', 'reporting.finance.view']);
      expect(checkNavigationAccess(rule, fullPerms, 1, false)).toBe(true);

      // Has allPermissions but not anyPermission
      const partialPerms = new Set(['finance.gl.view', 'finance.gl.post']);
      expect(checkNavigationAccess(rule, partialPerms, 1, false)).toBe(false);
    });
  });

  describe('Real section permission rules', () => {
    it('should make dashboard visible to all users', () => {
      const rule = SECTION_PERMISSIONS['dashboard'];
      expect(checkNavigationAccess(rule, new Set(), 1, false)).toBe(true);
    });

    it('should hide platform-admin-hub from regular users', () => {
      const rule = SECTION_PERMISSIONS['platform-admin-hub'];
      expect(checkNavigationAccess(rule, new Set(), 7, false)).toBe(false);
    });

    it('should show platform-admin-hub to platform admins', () => {
      const rule = SECTION_PERMISSIONS['platform-admin-hub'];
      expect(checkNavigationAccess(rule, new Set(), 8, true)).toBe(true);
    });

    it('should show CRM section to users with sales.lead.view_own', () => {
      const rule = SECTION_PERMISSIONS['crm'];
      expect(checkNavigationAccess(rule, new Set(['sales.lead.view_own']), 1, false)).toBe(true);
    });

    it('should hide CRM section from users without any sales permission', () => {
      const rule = SECTION_PERMISSIONS['crm'];
      expect(checkNavigationAccess(rule, new Set(['service.ticket.view_own']), 1, false)).toBe(
        false,
      );
    });

    it('should require level 3+ for integrations hub', () => {
      const rule = SECTION_PERMISSIONS['integrations-hub'];
      // Level 2 with right permissions -> denied (level too low)
      expect(checkNavigationAccess(rule, new Set(['admin.settings.integrations']), 2, false)).toBe(
        false,
      );
      // Level 3 with right permissions -> granted
      expect(checkNavigationAccess(rule, new Set(['admin.settings.integrations']), 3, false)).toBe(
        true,
      );
    });
  });

  describe('Real item permission rules', () => {
    it('should show deal-desk only to level 3+ with approval permissions', () => {
      const rule = ITEM_PERMISSIONS['/deal-desk'];
      // Level 2 with permission -> denied (level)
      expect(checkNavigationAccess(rule, new Set(['sales.quote.approve_standard']), 2, false)).toBe(
        false,
      );
      // Level 3 without permission -> denied (permission)
      expect(checkNavigationAccess(rule, new Set(), 3, false)).toBe(false);
      // Level 3 with permission -> granted
      expect(checkNavigationAccess(rule, new Set(['sales.quote.approve_standard']), 3, false)).toBe(
        true,
      );
    });

    it('should show executive dashboard only to level 6+ with executive permission', () => {
      const rule = ITEM_PERMISSIONS['/executive-dashboard'];
      expect(checkNavigationAccess(rule, new Set(['reporting.executive.view']), 5, false)).toBe(
        false,
      );
      expect(checkNavigationAccess(rule, new Set(['reporting.executive.view']), 6, false)).toBe(
        true,
      );
    });

    it('should show chart-of-accounts only to level 4+ with finance.gl.view', () => {
      const rule = ITEM_PERMISSIONS['/chart-of-accounts'];
      expect(checkNavigationAccess(rule, new Set(['finance.gl.view']), 3, false)).toBe(false);
      expect(checkNavigationAccess(rule, new Set(['finance.gl.view']), 4, false)).toBe(true);
    });

    it('should show /customers to all users (alwaysVisible)', () => {
      const rule = ITEM_PERMISSIONS['/customers'];
      expect(checkNavigationAccess(rule, new Set(), 1, false)).toBe(true);
    });

    it('should show task items to all users', () => {
      expect(checkNavigationAccess(ITEM_PERMISSIONS['/task-management'], new Set(), 1, false)).toBe(
        true,
      );
      expect(checkNavigationAccess(ITEM_PERMISSIONS['/basic-tasks'], new Set(), 1, false)).toBe(
        true,
      );
    });
  });
});

// =====================================================================
// expandLegacyPermissions
// =====================================================================

describe('expandLegacyPermissions', () => {
  describe('Sales module', () => {
    it('should grant base sales permissions at level 1', () => {
      const perms = expandLegacyPermissions({ sales: true }, 1);
      expect(perms.has('sales.lead.view_own')).toBe(true);
      expect(perms.has('sales.lead.create')).toBe(true);
      expect(perms.has('sales.lead.edit_own')).toBe(true);
      expect(perms.has('sales.opportunity.view_own')).toBe(true);
      expect(perms.has('sales.quote.create')).toBe(true);
      expect(perms.has('sales.commission.view_own')).toBe(true);
    });

    it('should NOT grant team permissions at level 1', () => {
      const perms = expandLegacyPermissions({ sales: true }, 1);
      expect(perms.has('sales.lead.view_team')).toBe(false);
      expect(perms.has('sales.opportunity.view_team')).toBe(false);
    });

    it('should grant team permissions at level 2', () => {
      const perms = expandLegacyPermissions({ sales: true }, 2);
      expect(perms.has('sales.lead.view_team')).toBe(true);
      expect(perms.has('sales.opportunity.view_team')).toBe(true);
      expect(perms.has('sales.commission.view_team')).toBe(true);
    });

    it('should grant supervisor permissions at level 3', () => {
      const perms = expandLegacyPermissions({ sales: true }, 3);
      expect(perms.has('sales.lead.edit_team')).toBe(true);
      expect(perms.has('sales.lead.assign')).toBe(true);
      expect(perms.has('sales.lead.delete')).toBe(true);
      expect(perms.has('sales.quote.approve_standard')).toBe(true);
      // Also includes level 2 permissions
      expect(perms.has('sales.lead.view_team')).toBe(true);
    });

    it('should grant manager/location permissions at level 4', () => {
      const perms = expandLegacyPermissions({ sales: true }, 4);
      expect(perms.has('sales.lead.view_location')).toBe(true);
      expect(perms.has('sales.lead.edit_location')).toBe(true);
      expect(perms.has('sales.lead.import')).toBe(true);
      expect(perms.has('sales.customer.view_location')).toBe(true);
      expect(perms.has('sales.customer.create')).toBe(true);
      expect(perms.has('sales.quote.approve_high_value')).toBe(true);
      expect(perms.has('sales.territory.manage_assignments')).toBe(true);
    });

    it('should grant regional permissions at level 5', () => {
      const perms = expandLegacyPermissions({ sales: true }, 5);
      expect(perms.has('sales.lead.view_regional')).toBe(true);
      expect(perms.has('sales.opportunity.view_regional')).toBe(true);
      // Also has level 4 permissions
      expect(perms.has('sales.lead.view_location')).toBe(true);
    });

    it('should grant director/company permissions at level 6', () => {
      const perms = expandLegacyPermissions({ sales: true }, 6);
      expect(perms.has('sales.lead.view_company')).toBe(true);
      expect(perms.has('sales.opportunity.view_company')).toBe(true);
      expect(perms.has('sales.quote.approve_enterprise')).toBe(true);
      expect(perms.has('sales.quote.custom_pricing')).toBe(true);
      expect(perms.has('sales.commission.approve')).toBe(true);
    });

    it('should be cumulative - level 6 includes all lower levels', () => {
      const perms = expandLegacyPermissions({ sales: true }, 6);
      // Level 1
      expect(perms.has('sales.lead.view_own')).toBe(true);
      // Level 2
      expect(perms.has('sales.lead.view_team')).toBe(true);
      // Level 3
      expect(perms.has('sales.lead.assign')).toBe(true);
      // Level 4
      expect(perms.has('sales.lead.view_location')).toBe(true);
      // Level 5
      expect(perms.has('sales.lead.view_regional')).toBe(true);
      // Level 6
      expect(perms.has('sales.lead.view_company')).toBe(true);
    });
  });

  describe('Service module', () => {
    it('should grant base service permissions at level 1', () => {
      const perms = expandLegacyPermissions({ service: true }, 1);
      expect(perms.has('service.ticket.view_own')).toBe(true);
      expect(perms.has('service.ticket.edit_own')).toBe(true);
      expect(perms.has('service.ticket.close')).toBe(true);
      expect(perms.has('service.equipment.view')).toBe(true);
      expect(perms.has('service.parts.view')).toBe(true);
      expect(perms.has('service.schedule.view_own')).toBe(true);
    });

    it('should NOT grant team/assign permissions at level 1', () => {
      const perms = expandLegacyPermissions({ service: true }, 1);
      expect(perms.has('service.ticket.view_team')).toBe(false);
      expect(perms.has('service.ticket.create')).toBe(false);
      expect(perms.has('service.ticket.assign')).toBe(false);
    });

    it('should grant team visibility at level 2', () => {
      const perms = expandLegacyPermissions({ service: true }, 2);
      expect(perms.has('service.ticket.view_team')).toBe(true);
      expect(perms.has('service.schedule.view_team')).toBe(true);
      expect(perms.has('service.ticket.create')).toBe(true);
    });

    it('should grant dispatch/management at level 3', () => {
      const perms = expandLegacyPermissions({ service: true }, 3);
      expect(perms.has('service.ticket.assign')).toBe(true);
      expect(perms.has('service.ticket.void')).toBe(true);
      expect(perms.has('service.parts.approve')).toBe(true);
      expect(perms.has('service.schedule.manage')).toBe(true);
    });

    it('should grant location + work order management at level 4', () => {
      const perms = expandLegacyPermissions({ service: true }, 4);
      expect(perms.has('service.ticket.view_location')).toBe(true);
      expect(perms.has('service.equipment.decommission')).toBe(true);
      expect(perms.has('service.parts.order')).toBe(true);
      expect(perms.has('service.workorder.create')).toBe(true);
      expect(perms.has('service.workorder.approve')).toBe(true);
    });
  });

  describe('Operations / Inventory module', () => {
    it('should grant base ops permissions for inventory:true', () => {
      const perms = expandLegacyPermissions({ inventory: true }, 1);
      expect(perms.has('operations.inventory.view')).toBe(true);
      expect(perms.has('operations.po.view')).toBe(true);
      expect(perms.has('operations.warehouse.receive')).toBe(true);
      expect(perms.has('operations.warehouse.pick')).toBe(true);
      expect(perms.has('operations.warehouse.ship')).toBe(true);
    });

    it('should grant base ops permissions for purchasing:true', () => {
      const perms = expandLegacyPermissions({ purchasing: true }, 1);
      expect(perms.has('operations.inventory.view')).toBe(true);
      expect(perms.has('operations.po.view')).toBe(true);
    });

    it('should grant adjustment at level 3', () => {
      const perms = expandLegacyPermissions({ inventory: true }, 3);
      expect(perms.has('operations.inventory.adjust')).toBe(true);
    });

    it('should grant full management at level 4', () => {
      const perms = expandLegacyPermissions({ inventory: true }, 4);
      expect(perms.has('operations.inventory.manage')).toBe(true);
      expect(perms.has('operations.inventory.transfer')).toBe(true);
      expect(perms.has('operations.warehouse.manage')).toBe(true);
      expect(perms.has('operations.po.create')).toBe(true);
      expect(perms.has('operations.po.approve')).toBe(true);
    });
  });

  describe('Finance / Billing module', () => {
    it('should grant base finance permissions for billing:true', () => {
      const perms = expandLegacyPermissions({ billing: true }, 1);
      expect(perms.has('finance.ar.view')).toBe(true);
      expect(perms.has('finance.invoice.create')).toBe(true);
      expect(perms.has('finance.bill.enter')).toBe(true);
      expect(perms.has('finance.payment.apply')).toBe(true);
    });

    it('should grant AP view at level 2', () => {
      const perms = expandLegacyPermissions({ finance: true }, 2);
      expect(perms.has('finance.ap.view')).toBe(true);
    });

    it('should grant GL and reports at level 4', () => {
      const perms = expandLegacyPermissions({ billing: true }, 4);
      expect(perms.has('finance.gl.view')).toBe(true);
      expect(perms.has('finance.gl.post')).toBe(true);
      expect(perms.has('finance.invoice.void')).toBe(true);
      expect(perms.has('finance.bill.approve')).toBe(true);
      expect(perms.has('finance.reports.view')).toBe(true);
    });

    it('should grant sensitive finance at level 6', () => {
      const perms = expandLegacyPermissions({ finance: true }, 6);
      expect(perms.has('finance.payment.process')).toBe(true);
      expect(perms.has('finance.reports.view_sensitive')).toBe(true);
      expect(perms.has('finance.gl.close_period')).toBe(true);
    });
  });

  describe('Reports module', () => {
    it('should grant base reporting at level 1', () => {
      const perms = expandLegacyPermissions({ reports: true }, 1);
      expect(perms.has('reporting.report.view')).toBe(true);
      expect(perms.has('reporting.dashboard.customize')).toBe(true);
    });

    it('should NOT grant sales/service reports at level 1', () => {
      const perms = expandLegacyPermissions({ reports: true }, 1);
      expect(perms.has('reporting.sales.view')).toBe(false);
      expect(perms.has('reporting.service.view')).toBe(false);
    });

    it('should grant department reports + export at level 2', () => {
      const perms = expandLegacyPermissions({ reports: true }, 2);
      expect(perms.has('reporting.sales.view')).toBe(true);
      expect(perms.has('reporting.service.view')).toBe(true);
      expect(perms.has('reporting.report.export')).toBe(true);
    });

    it('should grant scheduling at level 3', () => {
      const perms = expandLegacyPermissions({ reports: true }, 3);
      expect(perms.has('reporting.report.schedule')).toBe(true);
    });

    it('should grant finance reports + creation at level 4', () => {
      const perms = expandLegacyPermissions({ reports: true }, 4);
      expect(perms.has('reporting.finance.view')).toBe(true);
      expect(perms.has('reporting.report.create')).toBe(true);
    });

    it('should grant executive reports at level 6', () => {
      const perms = expandLegacyPermissions({ reports: true }, 6);
      expect(perms.has('reporting.executive.view')).toBe(true);
      expect(perms.has('reporting.kpi.manage')).toBe(true);
    });

    it('should NOT grant executive reports at level 5', () => {
      const perms = expandLegacyPermissions({ reports: true }, 5);
      expect(perms.has('reporting.executive.view')).toBe(false);
    });
  });

  describe('System / Admin module', () => {
    it('should grant nothing at levels 1-2', () => {
      const perms1 = expandLegacyPermissions({ system: true }, 1);
      const perms2 = expandLegacyPermissions({ system: true }, 2);
      expect(perms1.size).toBe(0);
      expect(perms2.size).toBe(0);
    });

    it('should grant basic admin at level 3', () => {
      const perms = expandLegacyPermissions({ system: true }, 3);
      expect(perms.has('admin.settings.view')).toBe(true);
      expect(perms.has('admin.settings.integrations')).toBe(true);
    });

    it('should grant user/role management at level 4', () => {
      const perms = expandLegacyPermissions({ system: true }, 4);
      expect(perms.has('admin.settings.update')).toBe(true);
      expect(perms.has('admin.user.view')).toBe(true);
      expect(perms.has('admin.role.view')).toBe(true);
      expect(perms.has('admin.user.create_location')).toBe(true);
    });

    it('should grant regional admin + audit at level 5', () => {
      const perms = expandLegacyPermissions({ system: true }, 5);
      expect(perms.has('admin.user.create_regional')).toBe(true);
      expect(perms.has('admin.role.assign')).toBe(true);
      expect(perms.has('audit.logs.view_location')).toBe(true);
    });

    it('should grant company admin + compliance at level 6', () => {
      const perms = expandLegacyPermissions({ system: true }, 6);
      expect(perms.has('admin.user.create_company')).toBe(true);
      expect(perms.has('admin.role.create')).toBe(true);
      expect(perms.has('audit.logs.view_regional')).toBe(true);
      expect(perms.has('audit.logs.view_company')).toBe(true);
      expect(perms.has('compliance.reports.view')).toBe(true);
    });

    it('should grant full admin at level 7', () => {
      const perms = expandLegacyPermissions({ system: true }, 7);
      expect(perms.has('admin.user.edit_profile')).toBe(true);
      expect(perms.has('admin.user.deactivate')).toBe(true);
      expect(perms.has('admin.role.manage_permissions')).toBe(true);
      expect(perms.has('compliance.manage')).toBe(true);
    });
  });

  describe('Multiple modules', () => {
    it('should combine permissions from multiple enabled modules', () => {
      const perms = expandLegacyPermissions({ sales: true, service: true, reports: true }, 2);
      // Sales
      expect(perms.has('sales.lead.view_own')).toBe(true);
      expect(perms.has('sales.lead.view_team')).toBe(true);
      // Service
      expect(perms.has('service.ticket.view_own')).toBe(true);
      expect(perms.has('service.ticket.view_team')).toBe(true);
      // Reports
      expect(perms.has('reporting.sales.view')).toBe(true);
    });

    it('should not grant permissions for disabled modules', () => {
      const perms = expandLegacyPermissions({ sales: true, service: false }, 4);
      expect(perms.has('sales.lead.view_location')).toBe(true);
      expect(perms.has('service.ticket.view_own')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should return empty set for all-false permissions', () => {
      const perms = expandLegacyPermissions({ sales: false, service: false, reports: false }, 8);
      expect(perms.size).toBe(0);
    });

    it('should return empty set for empty permissions object', () => {
      const perms = expandLegacyPermissions({}, 8);
      expect(perms.size).toBe(0);
    });

    it('should handle level 0 gracefully', () => {
      const perms = expandLegacyPermissions({ sales: true }, 0);
      // Level 0 should still get base sales permissions (no level >= check for base)
      expect(perms.has('sales.lead.view_own')).toBe(true);
      expect(perms.has('sales.lead.view_team')).toBe(false);
    });
  });
});

// =====================================================================
// Integration: expandLegacyPermissions + checkNavigationAccess
// =====================================================================

describe('Legacy expansion → navigation access (integration)', () => {
  it('should grant level 1 sales rep access to leads but not deal desk', () => {
    const perms = expandLegacyPermissions({ sales: true, reports: true }, 1);

    // Can see leads management
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/leads-management'], perms, 1, false)).toBe(
      true,
    );
    // Cannot see deal desk (level 3+)
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/deal-desk'], perms, 1, false)).toBe(false);
    // Cannot see executive dashboard (level 6+)
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/executive-dashboard'], perms, 1, false)).toBe(
      false,
    );
  });

  it('should grant level 4 manager access to pipeline config and chart of accounts', () => {
    const perms = expandLegacyPermissions(
      { sales: true, billing: true, reports: true, system: true },
      4,
    );

    // Pipeline config requires sales.territory.manage_assignments + level 4
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/pipeline-config'], perms, 4, false)).toBe(true);
    // Chart of accounts requires finance.gl.view + level 4
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/chart-of-accounts'], perms, 4, false)).toBe(
      true,
    );
    // Still can't see executive dashboard (level 6+)
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/executive-dashboard'], perms, 4, false)).toBe(
      false,
    );
  });

  it('should grant level 6 director access to executive dashboard', () => {
    const perms = expandLegacyPermissions(
      { sales: true, billing: true, reports: true, system: true },
      6,
    );

    // Executive dashboard requires reporting.executive.view + level 6
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/executive-dashboard'], perms, 6, false)).toBe(
      true,
    );
    // Financial intelligence requires reporting.finance.view + level 5
    expect(
      checkNavigationAccess(ITEM_PERMISSIONS['/financial-intelligence-dashboard'], perms, 6, false),
    ).toBe(true);
  });

  it('should correctly restrict a service-only level 2 technician', () => {
    const perms = expandLegacyPermissions({ service: true }, 2);

    // Can see service hub
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/service-hub'], perms, 2, false)).toBe(true);
    // Can see meter readings
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/meter-readings'], perms, 2, false)).toBe(true);
    // Cannot see sales items
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/leads-management'], perms, 2, false)).toBe(
      false,
    );
    // Cannot see service dispatch (level 3+)
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/service-dispatch'], perms, 2, false)).toBe(
      false,
    );
    // Cannot see financial items
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/chart-of-accounts'], perms, 2, false)).toBe(
      false,
    );
  });

  it('should correctly model a finance-only level 2 billing clerk', () => {
    const perms = expandLegacyPermissions({ billing: true }, 2);

    // Can see billing
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/billing'], perms, 2, false)).toBe(true);
    // Can see invoices
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/invoices'], perms, 2, false)).toBe(true);
    // Can see AP (level 2+)
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/accounts-payable'], perms, 2, false)).toBe(
      true,
    );
    // Cannot see GL (level 4+)
    expect(checkNavigationAccess(ITEM_PERMISSIONS['/chart-of-accounts'], perms, 2, false)).toBe(
      false,
    );
  });
});
