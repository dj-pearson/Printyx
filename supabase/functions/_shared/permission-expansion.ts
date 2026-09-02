/**
 * Module booleans + role level -> the granular permission codes (WF-P-05).
 *
 * THE MISSING LINK. WF-R-09's migration 0073 fills `roles.permissions` with the
 * nine MODULE booleans - {sales: true, service: false, ...} - because that is the
 * shape client/src/lib/navigation-permissions.ts has always derived the sidebar
 * from. WF-R-03 flattens that blob into `app_metadata.permissions`, and flattening
 * a module blob gives module NAMES: ['sales', 'products', 'reports']. So a gate on
 * a three-segment code like `operations.po.approve` matched nothing, for everyone -
 * SEC-EDGE-002's failure, arrived at from a new direction.
 *
 * This is the client's expandLegacyPermissions, ported. With it, the codes in the
 * token are the same codes the sidebar computes, so an endpoint and the menu item
 * that leads to it finally agree.
 *
 * KEEP IN SYNC with client/src/lib/navigation-permissions.ts. The two are locked by
 * server/tests/unit/permission-expansion-parity.test.ts, which drives both over
 * every module combination at every level rather than diffing the text - the shapes
 * differ (a Set here, a Set there, but different module systems) and a textual
 * comparison would pass on two files that disagree.
 */

export type ModulePermissions = Record<string, boolean>;

export function expandLegacyPermissions(
  modulePermissions: ModulePermissions,
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
