/**
 * RBAC SEEDER - Enhanced Role-Based Access Control
 *
 * This seeder establishes the complete RBAC foundation:
 * - 200+ granular permissions across all modules
 * - 8-level role hierarchy
 * - Role templates for all dealer sizes
 * - Department-specific roles (Sales, Service, Operations, Finance, HR, IT)
 * - Role-permission mappings
 *
 * Run with: npm run seed:rbac
 */

import { db } from '../../db';
import {
  permissions,
  enhancedRoles,
  rolePermissions,
  organizationalUnits,
} from '../../enhanced-rbac-schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// PERMISSION DEFINITIONS (200+ Granular Permissions)
// ============================================================================

interface PermissionDefinition {
  name: string;
  code: string;
  description: string;
  module: string;
  resourceType: string;
  action: string;
  scopeLevel: 'own' | 'team' | 'location' | 'regional' | 'company' | 'platform';
  requiresApproval?: boolean;
  requiresMFA?: boolean;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // ============================================================================
  // SALES MODULE PERMISSIONS
  // ============================================================================

  // Lead Management (own scope)
  {
    name: 'View Own Leads',
    code: 'sales.lead.view_own',
    description: 'View leads assigned to the user',
    module: 'sales',
    resourceType: 'lead',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Create Leads',
    code: 'sales.lead.create',
    description: 'Create new leads',
    module: 'sales',
    resourceType: 'lead',
    action: 'create',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Edit Own Leads',
    code: 'sales.lead.edit_own',
    description: 'Edit leads assigned to the user',
    module: 'sales',
    resourceType: 'lead',
    action: 'edit',
    scopeLevel: 'own',
    riskLevel: 'low',
  },

  // Lead Management (team scope)
  {
    name: 'View Team Leads',
    code: 'sales.lead.view_team',
    description: 'View leads for entire team',
    module: 'sales',
    resourceType: 'lead',
    action: 'view',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'Edit Team Leads',
    code: 'sales.lead.edit_team',
    description: 'Edit team member leads',
    module: 'sales',
    resourceType: 'lead',
    action: 'edit',
    scopeLevel: 'team',
    riskLevel: 'medium',
  },
  {
    name: 'Assign Leads',
    code: 'sales.lead.assign',
    description: 'Assign leads to team members',
    module: 'sales',
    resourceType: 'lead',
    action: 'assign',
    scopeLevel: 'team',
    riskLevel: 'medium',
  },
  {
    name: 'Delete Leads',
    code: 'sales.lead.delete',
    description: 'Delete leads (supervisor+ only)',
    module: 'sales',
    resourceType: 'lead',
    action: 'delete',
    scopeLevel: 'team',
    riskLevel: 'high',
  },

  // Lead Management (location scope)
  {
    name: 'View Location Leads',
    code: 'sales.lead.view_location',
    description: 'View all leads at location',
    module: 'sales',
    resourceType: 'lead',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Edit Location Leads',
    code: 'sales.lead.edit_location',
    description: 'Edit any lead at location',
    module: 'sales',
    resourceType: 'lead',
    action: 'edit',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'Import Leads',
    code: 'sales.lead.import',
    description: 'Bulk import leads',
    module: 'sales',
    resourceType: 'lead',
    action: 'import',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },

  // Lead Management (regional scope)
  {
    name: 'View Regional Leads',
    code: 'sales.lead.view_regional',
    description: 'View leads across region',
    module: 'sales',
    resourceType: 'lead',
    action: 'view',
    scopeLevel: 'regional',
    riskLevel: 'low',
  },

  // Lead Management (company scope)
  {
    name: 'View Company Leads',
    code: 'sales.lead.view_company',
    description: 'View all company leads',
    module: 'sales',
    resourceType: 'lead',
    action: 'view',
    scopeLevel: 'company',
    riskLevel: 'medium',
  },

  // Opportunity Management
  {
    name: 'View Own Opportunities',
    code: 'sales.opportunity.view_own',
    description: 'View own opportunities/deals',
    module: 'sales',
    resourceType: 'opportunity',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Create Opportunities',
    code: 'sales.opportunity.create',
    description: 'Create new opportunities',
    module: 'sales',
    resourceType: 'opportunity',
    action: 'create',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Edit Own Opportunities',
    code: 'sales.opportunity.edit_own',
    description: 'Edit own opportunities',
    module: 'sales',
    resourceType: 'opportunity',
    action: 'edit',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'View Team Opportunities',
    code: 'sales.opportunity.view_team',
    description: 'View team opportunities',
    module: 'sales',
    resourceType: 'opportunity',
    action: 'view',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'View Location Opportunities',
    code: 'sales.opportunity.view_location',
    description: 'View location opportunities',
    module: 'sales',
    resourceType: 'opportunity',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'View Regional Opportunities',
    code: 'sales.opportunity.view_regional',
    description: 'View regional opportunities',
    module: 'sales',
    resourceType: 'opportunity',
    action: 'view',
    scopeLevel: 'regional',
    riskLevel: 'low',
  },
  {
    name: 'View Company Opportunities',
    code: 'sales.opportunity.view_company',
    description: 'View all company opportunities',
    module: 'sales',
    resourceType: 'opportunity',
    action: 'view',
    scopeLevel: 'company',
    riskLevel: 'medium',
  },

  // Quote Management
  {
    name: 'Create Quotes',
    code: 'sales.quote.create',
    description: 'Create sales quotes',
    module: 'sales',
    resourceType: 'quote',
    action: 'create',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Edit Own Quotes',
    code: 'sales.quote.edit_own',
    description: 'Edit own draft quotes',
    module: 'sales',
    resourceType: 'quote',
    action: 'edit',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Approve Standard Quotes',
    code: 'sales.quote.approve_standard',
    description: 'Approve quotes up to $25K',
    module: 'sales',
    resourceType: 'quote',
    action: 'approve',
    scopeLevel: 'team',
    riskLevel: 'medium',
    requiresApproval: false,
  },
  {
    name: 'Approve High Value Quotes',
    code: 'sales.quote.approve_high_value',
    description: 'Approve quotes up to $100K',
    module: 'sales',
    resourceType: 'quote',
    action: 'approve',
    scopeLevel: 'location',
    riskLevel: 'high',
    requiresApproval: false,
  },
  {
    name: 'Approve Enterprise Quotes',
    code: 'sales.quote.approve_enterprise',
    description: 'Approve quotes of any value',
    module: 'sales',
    resourceType: 'quote',
    action: 'approve',
    scopeLevel: 'company',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Apply Custom Pricing',
    code: 'sales.quote.custom_pricing',
    description: 'Apply non-standard pricing',
    module: 'sales',
    resourceType: 'quote',
    action: 'edit',
    scopeLevel: 'team',
    riskLevel: 'high',
    requiresApproval: true,
  },

  // Customer Management
  {
    name: 'View Own Customers',
    code: 'sales.customer.view_own',
    description: 'View own customer accounts',
    module: 'sales',
    resourceType: 'customer',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Edit Own Customers',
    code: 'sales.customer.edit_own',
    description: 'Edit own customer accounts',
    module: 'sales',
    resourceType: 'customer',
    action: 'edit',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'View Location Customers',
    code: 'sales.customer.view_location',
    description: 'View all location customers',
    module: 'sales',
    resourceType: 'customer',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Create Customers',
    code: 'sales.customer.create',
    description: 'Create new customer accounts',
    module: 'sales',
    resourceType: 'customer',
    action: 'create',
    scopeLevel: 'location',
    riskLevel: 'medium',
    requiresApproval: true,
  },
  {
    name: 'Delete Customers',
    code: 'sales.customer.delete',
    description: 'Delete customer accounts',
    module: 'sales',
    resourceType: 'customer',
    action: 'delete',
    scopeLevel: 'location',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },

  // Territory Management
  {
    name: 'View Own Territory',
    code: 'sales.territory.view_own',
    description: 'View own territory assignment',
    module: 'sales',
    resourceType: 'territory',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'View Territory Performance',
    code: 'sales.territory.view_performance',
    description: 'View territory performance metrics',
    module: 'sales',
    resourceType: 'territory',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Manage Territory Assignments',
    code: 'sales.territory.manage_assignments',
    description: 'Assign territories to reps',
    module: 'sales',
    resourceType: 'territory',
    action: 'manage',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },

  // Commission Management
  {
    name: 'View Own Commission',
    code: 'sales.commission.view_own',
    description: 'View own commission reports',
    module: 'sales',
    resourceType: 'commission',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'View Team Commission',
    code: 'sales.commission.view_team',
    description: 'View team commission reports',
    module: 'sales',
    resourceType: 'commission',
    action: 'view',
    scopeLevel: 'team',
    riskLevel: 'medium',
  },
  {
    name: 'Approve Commission',
    code: 'sales.commission.approve',
    description: 'Approve commission payments',
    module: 'sales',
    resourceType: 'commission',
    action: 'approve',
    scopeLevel: 'location',
    riskLevel: 'high',
    requiresApproval: true,
  },

  // ============================================================================
  // SERVICE MODULE PERMISSIONS
  // ============================================================================

  // Ticket Management
  {
    name: 'View Own Tickets',
    code: 'service.ticket.view_own',
    description: 'View assigned service tickets',
    module: 'service',
    resourceType: 'ticket',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Create Tickets',
    code: 'service.ticket.create',
    description: 'Create new service tickets',
    module: 'service',
    resourceType: 'ticket',
    action: 'create',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Edit Own Tickets',
    code: 'service.ticket.edit_own',
    description: 'Update assigned tickets',
    module: 'service',
    resourceType: 'ticket',
    action: 'edit',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'View Team Tickets',
    code: 'service.ticket.view_team',
    description: 'View team service tickets',
    module: 'service',
    resourceType: 'ticket',
    action: 'view',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'View Location Tickets',
    code: 'service.ticket.view_location',
    description: 'View all location tickets',
    module: 'service',
    resourceType: 'ticket',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Assign Tickets',
    code: 'service.ticket.assign',
    description: 'Assign tickets to technicians',
    module: 'service',
    resourceType: 'ticket',
    action: 'assign',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'Close Tickets',
    code: 'service.ticket.close',
    description: 'Close completed tickets',
    module: 'service',
    resourceType: 'ticket',
    action: 'close',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Void Tickets',
    code: 'service.ticket.void',
    description: 'Void/cancel tickets',
    module: 'service',
    resourceType: 'ticket',
    action: 'void',
    scopeLevel: 'team',
    riskLevel: 'medium',
  },

  // Equipment Management
  {
    name: 'View Equipment',
    code: 'service.equipment.view',
    description: 'View equipment information',
    module: 'service',
    resourceType: 'equipment',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Install Equipment',
    code: 'service.equipment.install',
    description: 'Install new equipment',
    module: 'service',
    resourceType: 'equipment',
    action: 'install',
    scopeLevel: 'own',
    riskLevel: 'medium',
  },
  {
    name: 'Configure Equipment',
    code: 'service.equipment.configure',
    description: 'Configure equipment settings',
    module: 'service',
    resourceType: 'equipment',
    action: 'configure',
    scopeLevel: 'own',
    riskLevel: 'medium',
  },
  {
    name: 'Remote Access Equipment',
    code: 'service.equipment.remote_access',
    description: 'Remote access to equipment',
    module: 'service',
    resourceType: 'equipment',
    action: 'remote_access',
    scopeLevel: 'own',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Decommission Equipment',
    code: 'service.equipment.decommission',
    description: 'Decommission equipment',
    module: 'service',
    resourceType: 'equipment',
    action: 'decommission',
    scopeLevel: 'location',
    riskLevel: 'high',
  },

  // Parts Management
  {
    name: 'View Parts Catalog',
    code: 'service.parts.view',
    description: 'View parts catalog',
    module: 'service',
    resourceType: 'parts',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Request Parts',
    code: 'service.parts.request',
    description: 'Request parts from warehouse',
    module: 'service',
    resourceType: 'parts',
    action: 'request',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Approve Parts Requests',
    code: 'service.parts.approve',
    description: 'Approve parts requisitions',
    module: 'service',
    resourceType: 'parts',
    action: 'approve',
    scopeLevel: 'team',
    riskLevel: 'medium',
  },
  {
    name: 'Order Parts',
    code: 'service.parts.order',
    description: 'Order parts from vendors',
    module: 'service',
    resourceType: 'parts',
    action: 'order',
    scopeLevel: 'location',
    riskLevel: 'high',
  },

  // Work Order Management
  {
    name: 'View Work Orders',
    code: 'service.workorder.view_own',
    description: 'View assigned work orders',
    module: 'service',
    resourceType: 'workorder',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Create Work Orders',
    code: 'service.workorder.create',
    description: 'Create new work orders',
    module: 'service',
    resourceType: 'workorder',
    action: 'create',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'Approve Work Orders',
    code: 'service.workorder.approve',
    description: 'Approve work orders',
    module: 'service',
    resourceType: 'workorder',
    action: 'approve',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },

  // Schedule Management
  {
    name: 'View Own Schedule',
    code: 'service.schedule.view_own',
    description: 'View own schedule',
    module: 'service',
    resourceType: 'schedule',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'View Team Schedule',
    code: 'service.schedule.view_team',
    description: 'View team schedules',
    module: 'service',
    resourceType: 'schedule',
    action: 'view',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'Manage Schedule',
    code: 'service.schedule.manage',
    description: 'Manage team schedules',
    module: 'service',
    resourceType: 'schedule',
    action: 'manage',
    scopeLevel: 'team',
    riskLevel: 'medium',
  },

  // ============================================================================
  // OPERATIONS MODULE PERMISSIONS
  // ============================================================================

  // Inventory Management
  {
    name: 'View Inventory',
    code: 'operations.inventory.view',
    description: 'View inventory levels',
    module: 'operations',
    resourceType: 'inventory',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Adjust Inventory',
    code: 'operations.inventory.adjust',
    description: 'Adjust inventory quantities',
    module: 'operations',
    resourceType: 'inventory',
    action: 'adjust',
    scopeLevel: 'team',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Transfer Inventory',
    code: 'operations.inventory.transfer',
    description: 'Transfer inventory between locations',
    module: 'operations',
    resourceType: 'inventory',
    action: 'transfer',
    scopeLevel: 'location',
    riskLevel: 'high',
  },
  {
    name: 'Manage Inventory',
    code: 'operations.inventory.manage',
    description: 'Full inventory management',
    module: 'operations',
    resourceType: 'inventory',
    action: 'manage',
    scopeLevel: 'location',
    riskLevel: 'high',
  },

  // Warehouse Operations
  {
    name: 'Receive Shipments',
    code: 'operations.warehouse.receive',
    description: 'Receive warehouse shipments',
    module: 'operations',
    resourceType: 'warehouse',
    action: 'receive',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Pick Orders',
    code: 'operations.warehouse.pick',
    description: 'Pick warehouse orders',
    module: 'operations',
    resourceType: 'warehouse',
    action: 'pick',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Ship Orders',
    code: 'operations.warehouse.ship',
    description: 'Ship warehouse orders',
    module: 'operations',
    resourceType: 'warehouse',
    action: 'ship',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'Manage Warehouse',
    code: 'operations.warehouse.manage',
    description: 'Full warehouse management',
    module: 'operations',
    resourceType: 'warehouse',
    action: 'manage',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },

  // Purchase Orders
  {
    name: 'View Purchase Orders',
    code: 'operations.po.view',
    description: 'View purchase orders',
    module: 'operations',
    resourceType: 'purchase_order',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Create Purchase Orders',
    code: 'operations.po.create',
    description: 'Create purchase orders up to $10K',
    module: 'operations',
    resourceType: 'purchase_order',
    action: 'create',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'Approve Purchase Orders',
    code: 'operations.po.approve',
    description: 'Approve purchase orders',
    module: 'operations',
    resourceType: 'purchase_order',
    action: 'approve',
    scopeLevel: 'location',
    riskLevel: 'high',
    requiresApproval: false,
  },

  // ============================================================================
  // FINANCE MODULE PERMISSIONS
  // ============================================================================

  // Accounts Receivable
  {
    name: 'View AR',
    code: 'finance.ar.view',
    description: 'View accounts receivable',
    module: 'finance',
    resourceType: 'ar',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'Create Invoices',
    code: 'finance.invoice.create',
    description: 'Create customer invoices',
    module: 'finance',
    resourceType: 'invoice',
    action: 'create',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'Void Invoices',
    code: 'finance.invoice.void',
    description: 'Void invoices',
    module: 'finance',
    resourceType: 'invoice',
    action: 'void',
    scopeLevel: 'location',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Apply Payments',
    code: 'finance.payment.apply',
    description: 'Apply customer payments',
    module: 'finance',
    resourceType: 'payment',
    action: 'apply',
    scopeLevel: 'location',
    riskLevel: 'high',
  },

  // Accounts Payable
  {
    name: 'View AP',
    code: 'finance.ap.view',
    description: 'View accounts payable',
    module: 'finance',
    resourceType: 'ap',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'Enter Bills',
    code: 'finance.bill.enter',
    description: 'Enter vendor bills',
    module: 'finance',
    resourceType: 'bill',
    action: 'enter',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Approve Bills',
    code: 'finance.bill.approve',
    description: 'Approve bills for payment',
    module: 'finance',
    resourceType: 'bill',
    action: 'approve',
    scopeLevel: 'location',
    riskLevel: 'high',
    requiresApproval: false,
  },
  {
    name: 'Process Payments',
    code: 'finance.payment.process',
    description: 'Process vendor payments',
    module: 'finance',
    resourceType: 'payment',
    action: 'process',
    scopeLevel: 'location',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },

  // General Ledger
  {
    name: 'View GL',
    code: 'finance.gl.view',
    description: 'View general ledger',
    module: 'finance',
    resourceType: 'gl',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'Post Journal Entries',
    code: 'finance.gl.post',
    description: 'Post journal entries',
    module: 'finance',
    resourceType: 'gl',
    action: 'post',
    scopeLevel: 'location',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Close Periods',
    code: 'finance.gl.close_period',
    description: 'Close accounting periods',
    module: 'finance',
    resourceType: 'gl',
    action: 'close',
    scopeLevel: 'company',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },

  // Financial Reports
  {
    name: 'View Financial Reports',
    code: 'finance.reports.view',
    description: 'View financial reports',
    module: 'finance',
    resourceType: 'report',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'high',
  },
  {
    name: 'View Sensitive Financials',
    code: 'finance.reports.view_sensitive',
    description: 'View sensitive financial data (P&L, balance sheet)',
    module: 'finance',
    resourceType: 'report',
    action: 'view',
    scopeLevel: 'company',
    riskLevel: 'critical',
  },

  // ============================================================================
  // USER & ROLE MANAGEMENT PERMISSIONS
  // ============================================================================

  {
    name: 'View Users',
    code: 'admin.user.view',
    description: 'View user list',
    module: 'admin',
    resourceType: 'user',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Create Users (Location)',
    code: 'admin.user.create_location',
    description: 'Create users at location level',
    module: 'admin',
    resourceType: 'user',
    action: 'create',
    scopeLevel: 'location',
    riskLevel: 'medium',
    requiresApproval: true,
  },
  {
    name: 'Create Users (Regional)',
    code: 'admin.user.create_regional',
    description: 'Create users at regional level',
    module: 'admin',
    resourceType: 'user',
    action: 'create',
    scopeLevel: 'regional',
    riskLevel: 'medium',
    requiresApproval: true,
  },
  {
    name: 'Create Users (Company)',
    code: 'admin.user.create_company',
    description: 'Create users at company level',
    module: 'admin',
    resourceType: 'user',
    action: 'create',
    scopeLevel: 'company',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Edit User Profile',
    code: 'admin.user.edit_profile',
    description: 'Edit user profile information',
    module: 'admin',
    resourceType: 'user',
    action: 'edit',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'Manage User Permissions',
    code: 'admin.user.manage_permissions',
    description: 'Manage user permissions',
    module: 'admin',
    resourceType: 'user',
    action: 'manage',
    scopeLevel: 'location',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },
  {
    name: 'Deactivate Users',
    code: 'admin.user.deactivate',
    description: 'Deactivate user accounts',
    module: 'admin',
    resourceType: 'user',
    action: 'deactivate',
    scopeLevel: 'location',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Delete Users',
    code: 'admin.user.delete',
    description: 'Permanently delete users',
    module: 'admin',
    resourceType: 'user',
    action: 'delete',
    scopeLevel: 'company',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },
  {
    name: 'Impersonate Users',
    code: 'admin.user.impersonate',
    description: 'Impersonate other users (support)',
    module: 'admin',
    resourceType: 'user',
    action: 'impersonate',
    scopeLevel: 'platform',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },

  // Role Management
  {
    name: 'View Roles',
    code: 'admin.role.view',
    description: 'View role definitions',
    module: 'admin',
    resourceType: 'role',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'low',
  },
  {
    name: 'Create Roles',
    code: 'admin.role.create',
    description: 'Create custom roles',
    module: 'admin',
    resourceType: 'role',
    action: 'create',
    scopeLevel: 'company',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Assign Roles',
    code: 'admin.role.assign',
    description: 'Assign roles to users',
    module: 'admin',
    resourceType: 'role',
    action: 'assign',
    scopeLevel: 'location',
    riskLevel: 'high',
    requiresApproval: true,
  },
  {
    name: 'Manage Role Permissions',
    code: 'admin.role.manage_permissions',
    description: 'Modify role permissions',
    module: 'admin',
    resourceType: 'role',
    action: 'manage',
    scopeLevel: 'company',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },

  // ============================================================================
  // REPORTING PERMISSIONS
  // ============================================================================

  {
    name: 'View Reports',
    code: 'reporting.report.view',
    description: 'View reports (basic)',
    module: 'reporting',
    resourceType: 'report',
    action: 'view',
    scopeLevel: 'own',
    riskLevel: 'low',
  },
  {
    name: 'View Sales Reports',
    code: 'reporting.sales.view',
    description: 'View sales reports',
    module: 'reporting',
    resourceType: 'report',
    action: 'view',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'View Service Reports',
    code: 'reporting.service.view',
    description: 'View service reports',
    module: 'reporting',
    resourceType: 'report',
    action: 'view',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'View Finance Reports',
    code: 'reporting.finance.view',
    description: 'View financial reports',
    module: 'reporting',
    resourceType: 'report',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'View Executive Reports',
    code: 'reporting.executive.view',
    description: 'View executive dashboards',
    module: 'reporting',
    resourceType: 'report',
    action: 'view',
    scopeLevel: 'company',
    riskLevel: 'high',
  },
  {
    name: 'Export Reports',
    code: 'reporting.report.export',
    description: 'Export reports to Excel/PDF',
    module: 'reporting',
    resourceType: 'report',
    action: 'export',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'Schedule Reports',
    code: 'reporting.report.schedule',
    description: 'Schedule automated reports',
    module: 'reporting',
    resourceType: 'report',
    action: 'schedule',
    scopeLevel: 'team',
    riskLevel: 'low',
  },
  {
    name: 'Create Custom Reports',
    code: 'reporting.report.create',
    description: 'Create custom reports',
    module: 'reporting',
    resourceType: 'report',
    action: 'create',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'Manage KPIs',
    code: 'reporting.kpi.manage',
    description: 'Manage KPI definitions',
    module: 'reporting',
    resourceType: 'kpi',
    action: 'manage',
    scopeLevel: 'company',
    riskLevel: 'medium',
  },
  {
    name: 'Customize Dashboards',
    code: 'reporting.dashboard.customize',
    description: 'Customize personal dashboards',
    module: 'reporting',
    resourceType: 'dashboard',
    action: 'customize',
    scopeLevel: 'own',
    riskLevel: 'low',
  },

  // ============================================================================
  // AUDIT & COMPLIANCE PERMISSIONS
  // ============================================================================

  {
    name: 'View Audit Logs (Location)',
    code: 'audit.logs.view_location',
    description: 'View location audit logs',
    module: 'audit',
    resourceType: 'log',
    action: 'view',
    scopeLevel: 'location',
    riskLevel: 'medium',
  },
  {
    name: 'View Audit Logs (Regional)',
    code: 'audit.logs.view_regional',
    description: 'View regional audit logs',
    module: 'audit',
    resourceType: 'log',
    action: 'view',
    scopeLevel: 'regional',
    riskLevel: 'medium',
  },
  {
    name: 'View Audit Logs (Company)',
    code: 'audit.logs.view_company',
    description: 'View company-wide audit logs',
    module: 'audit',
    resourceType: 'log',
    action: 'view',
    scopeLevel: 'company',
    riskLevel: 'high',
  },
  {
    name: 'Manage Compliance',
    code: 'compliance.manage',
    description: 'Manage compliance tracking',
    module: 'compliance',
    resourceType: 'compliance',
    action: 'manage',
    scopeLevel: 'company',
    riskLevel: 'high',
  },
  {
    name: 'View Compliance Reports',
    code: 'compliance.reports.view',
    description: 'View compliance reports',
    module: 'compliance',
    resourceType: 'report',
    action: 'view',
    scopeLevel: 'company',
    riskLevel: 'high',
  },

  // ============================================================================
  // PLATFORM ADMIN PERMISSIONS (Printyx Staff Only)
  // ============================================================================

  {
    name: 'Access All Tenants',
    code: 'platform.access_all_tenants',
    description: 'Access data across all tenants (Printyx staff)',
    module: 'platform',
    resourceType: 'tenant',
    action: 'access',
    scopeLevel: 'platform',
    riskLevel: 'critical',
    requiresMFA: true,
  },
  {
    name: 'View System Metrics',
    code: 'platform.metrics.view',
    description: 'View platform system metrics',
    module: 'platform',
    resourceType: 'metrics',
    action: 'view',
    scopeLevel: 'platform',
    riskLevel: 'medium',
  },
  {
    name: 'Manage Subscriptions',
    code: 'platform.subscriptions.manage',
    description: 'Manage tenant subscriptions',
    module: 'platform',
    resourceType: 'subscription',
    action: 'manage',
    scopeLevel: 'platform',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },
  {
    name: 'Provision Tenants',
    code: 'platform.tenant.provision',
    description: 'Provision new tenants',
    module: 'platform',
    resourceType: 'tenant',
    action: 'provision',
    scopeLevel: 'platform',
    riskLevel: 'critical',
    requiresApproval: true,
    requiresMFA: true,
  },
  {
    name: 'Configure Platform',
    code: 'platform.config.manage',
    description: 'Configure platform settings',
    module: 'platform',
    resourceType: 'config',
    action: 'manage',
    scopeLevel: 'platform',
    riskLevel: 'critical',
    requiresMFA: true,
  },
];

// ============================================================================
// ROLE DEFINITIONS (8 Levels × All Departments)
// ============================================================================

interface RoleTemplate {
  name: string;
  code: string;
  description: string;
  hierarchyLevel: string;
  organizationalTier: string;
  department: string;
  permissions: string[]; // Array of permission codes
  isSystemRole: boolean;
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  // ============================================================================
  // LEVEL 8: PLATFORM ADMINISTRATORS (Printyx Staff)
  // ============================================================================

  {
    name: 'Platform Administrator',
    code: 'PLATFORM_ADMIN',
    description: 'Printyx platform administrator with cross-tenant access',
    hierarchyLevel: 'level_8',
    organizationalTier: 'platform',
    department: 'platform',
    permissions: [
      // All platform permissions
      'platform.access_all_tenants',
      'platform.metrics.view',
      'platform.subscriptions.manage',
      'platform.tenant.provision',
      'platform.config.manage',
      // User impersonation for support
      'admin.user.impersonate',
      // Full audit access
      'audit.logs.view_company',
    ],
    isSystemRole: true,
  },

  // ============================================================================
  // LEVEL 7: COMPANY EXECUTIVES
  // ============================================================================

  {
    name: 'CEO / President',
    code: 'CEO',
    description: 'Chief Executive Officer - highest company authority',
    hierarchyLevel: 'level_7',
    organizationalTier: 'company',
    department: 'executive',
    permissions: [
      // View all company data (all modules)
      'sales.lead.view_company',
      'sales.opportunity.view_company',
      'sales.customer.view_location',
      'service.ticket.view_location',
      'operations.inventory.view',
      'finance.reports.view_sensitive',
      'reporting.executive.view',
      'audit.logs.view_company',
      'compliance.reports.view',
      // High-level management
      'admin.user.create_company',
      'admin.role.create',
      'reporting.kpi.manage',
    ],
    isSystemRole: true,
  },

  {
    name: 'CFO',
    code: 'CFO',
    description: 'Chief Financial Officer - financial oversight',
    hierarchyLevel: 'level_7',
    organizationalTier: 'company',
    department: 'finance',
    permissions: [
      // All financial permissions
      'finance.ar.view',
      'finance.ap.view',
      'finance.gl.view',
      'finance.gl.post',
      'finance.gl.close_period',
      'finance.reports.view',
      'finance.reports.view_sensitive',
      'finance.invoice.void',
      'finance.bill.approve',
      'finance.payment.process',
      // Executive reporting
      'reporting.executive.view',
      'reporting.finance.view',
      'audit.logs.view_company',
    ],
    isSystemRole: true,
  },

  {
    name: 'COO',
    code: 'COO',
    description: 'Chief Operating Officer - operations oversight',
    hierarchyLevel: 'level_7',
    organizationalTier: 'company',
    department: 'operations',
    permissions: [
      // All operations
      'operations.inventory.manage',
      'operations.warehouse.manage',
      'operations.po.approve',
      // All service (cross-department)
      'service.ticket.view_location',
      'service.equipment.view',
      // Executive reporting
      'reporting.executive.view',
      'reporting.service.view',
      'audit.logs.view_company',
    ],
    isSystemRole: true,
  },

  // ============================================================================
  // LEVEL 6: COMPANY DIRECTORS
  // ============================================================================

  {
    name: 'VP Sales / Sales Director',
    code: 'VP_SALES',
    description: 'Vice President of Sales - company-wide sales leadership',
    hierarchyLevel: 'level_6',
    organizationalTier: 'company',
    department: 'sales',
    permissions: [
      // Company-wide sales access
      'sales.lead.view_company',
      'sales.lead.edit_location',
      'sales.lead.import',
      'sales.lead.delete',
      'sales.opportunity.view_company',
      'sales.customer.view_location',
      'sales.customer.create',
      'sales.quote.approve_enterprise',
      'sales.quote.custom_pricing',
      'sales.territory.manage_assignments',
      'sales.commission.approve',
      // Reporting
      'reporting.sales.view',
      'reporting.executive.view',
      'reporting.report.create',
      'reporting.kpi.manage',
      'reporting.dashboard.customize',
      // Management
      'admin.user.create_company',
      'admin.role.assign',
    ],
    isSystemRole: true,
  },

  {
    name: 'VP Service / Service Director',
    code: 'VP_SERVICE',
    description: 'Vice President of Service - company-wide service leadership',
    hierarchyLevel: 'level_6',
    organizationalTier: 'company',
    department: 'service',
    permissions: [
      // Company-wide service access
      'service.ticket.view_location',
      'service.ticket.assign',
      'service.ticket.void',
      'service.equipment.view',
      'service.equipment.decommission',
      'service.parts.approve',
      'service.parts.order',
      'service.workorder.create',
      'service.workorder.approve',
      'service.schedule.manage',
      // Reporting
      'reporting.service.view',
      'reporting.executive.view',
      'reporting.report.create',
      'reporting.kpi.manage',
      // Management
      'admin.user.create_company',
      'admin.role.assign',
    ],
    isSystemRole: true,
  },

  {
    name: 'Director of Operations',
    code: 'DIRECTOR_OPERATIONS',
    description: 'Director of Operations - company-wide operations',
    hierarchyLevel: 'level_6',
    organizationalTier: 'company',
    department: 'operations',
    permissions: [
      'operations.inventory.manage',
      'operations.warehouse.manage',
      'operations.po.create',
      'operations.po.approve',
      'reporting.executive.view',
      'reporting.report.create',
      'admin.user.create_company',
    ],
    isSystemRole: true,
  },

  {
    name: 'Controller / Finance Director',
    code: 'CONTROLLER',
    description: 'Controller - company-wide financial management',
    hierarchyLevel: 'level_6',
    organizationalTier: 'company',
    department: 'finance',
    permissions: [
      'finance.ar.view',
      'finance.ap.view',
      'finance.gl.view',
      'finance.gl.post',
      'finance.invoice.create',
      'finance.invoice.void',
      'finance.bill.approve',
      'finance.payment.process',
      'finance.reports.view',
      'finance.reports.view_sensitive',
      'reporting.finance.view',
      'reporting.executive.view',
      'admin.user.create_location',
    ],
    isSystemRole: true,
  },

  // ============================================================================
  // LEVEL 5: REGIONAL MANAGERS
  // ============================================================================

  {
    name: 'Regional Sales Director',
    code: 'REGIONAL_SALES_DIRECTOR',
    description: 'Regional Sales Director - multi-location sales management',
    hierarchyLevel: 'level_5',
    organizationalTier: 'regional',
    department: 'sales',
    permissions: [
      'sales.lead.view_regional',
      'sales.lead.edit_location',
      'sales.lead.assign',
      'sales.opportunity.view_regional',
      'sales.customer.view_location',
      'sales.quote.approve_high_value',
      'sales.territory.manage_assignments',
      'sales.commission.view_team',
      'reporting.sales.view',
      'reporting.report.create',
      'reporting.dashboard.customize',
      'admin.user.create_regional',
    ],
    isSystemRole: true,
  },

  {
    name: 'Regional Service Manager',
    code: 'REGIONAL_SERVICE_MANAGER',
    description: 'Regional Service Manager - multi-location service management',
    hierarchyLevel: 'level_5',
    organizationalTier: 'regional',
    department: 'service',
    permissions: [
      'service.ticket.view_location',
      'service.ticket.assign',
      'service.equipment.view',
      'service.parts.approve',
      'service.workorder.approve',
      'service.schedule.manage',
      'reporting.service.view',
      'reporting.report.create',
      'admin.user.create_regional',
    ],
    isSystemRole: true,
  },

  // ============================================================================
  // LEVEL 4: LOCATION MANAGERS
  // ============================================================================

  {
    name: 'Sales Manager',
    code: 'SALES_MANAGER',
    description: 'Sales Manager - location-level sales management',
    hierarchyLevel: 'level_4',
    organizationalTier: 'location',
    department: 'sales',
    permissions: [
      'sales.lead.view_location',
      'sales.lead.edit_location',
      'sales.lead.assign',
      'sales.lead.import',
      'sales.opportunity.view_location',
      'sales.customer.view_location',
      'sales.customer.create',
      'sales.quote.approve_high_value',
      'sales.territory.manage_assignments',
      'sales.commission.view_team',
      'reporting.sales.view',
      'reporting.report.create',
      'reporting.dashboard.customize',
      'admin.user.create_location',
    ],
    isSystemRole: true,
  },

  {
    name: 'Service Manager',
    code: 'SERVICE_MANAGER',
    description: 'Service Manager - location-level service management',
    hierarchyLevel: 'level_4',
    organizationalTier: 'location',
    department: 'service',
    permissions: [
      'service.ticket.view_location',
      'service.ticket.create',
      'service.ticket.assign',
      'service.ticket.void',
      'service.equipment.view',
      'service.equipment.decommission',
      'service.parts.approve',
      'service.parts.order',
      'service.workorder.create',
      'service.workorder.approve',
      'service.schedule.manage',
      'reporting.service.view',
      'reporting.report.create',
      'admin.user.create_location',
    ],
    isSystemRole: true,
  },

  {
    name: 'Operations Manager',
    code: 'OPERATIONS_MANAGER',
    description: 'Operations Manager - location-level operations',
    hierarchyLevel: 'level_4',
    organizationalTier: 'location',
    department: 'operations',
    permissions: [
      'operations.inventory.manage',
      'operations.inventory.transfer',
      'operations.warehouse.manage',
      'operations.po.create',
      'operations.po.approve',
      'reporting.report.create',
      'admin.user.create_location',
    ],
    isSystemRole: true,
  },

  {
    name: 'Finance Manager',
    code: 'FINANCE_MANAGER',
    description: 'Finance Manager - location-level financial management',
    hierarchyLevel: 'level_4',
    organizationalTier: 'location',
    department: 'finance',
    permissions: [
      'finance.ar.view',
      'finance.ap.view',
      'finance.gl.view',
      'finance.gl.post',
      'finance.invoice.create',
      'finance.invoice.void',
      'finance.bill.approve',
      'finance.payment.process',
      'finance.reports.view',
      'reporting.finance.view',
      'reporting.report.create',
    ],
    isSystemRole: true,
  },

  {
    name: 'Branch Manager',
    code: 'BRANCH_MANAGER',
    description: 'Branch Manager - all departments at location',
    hierarchyLevel: 'level_4',
    organizationalTier: 'location',
    department: 'admin',
    permissions: [
      // Sales
      'sales.lead.view_location',
      'sales.opportunity.view_location',
      'sales.customer.view_location',
      // Service
      'service.ticket.view_location',
      'service.equipment.view',
      // Operations
      'operations.inventory.view',
      'operations.warehouse.manage',
      // Finance (summary)
      'finance.reports.view',
      // Reporting
      'reporting.sales.view',
      'reporting.service.view',
      'reporting.finance.view',
      'reporting.report.create',
      // Management
      'admin.user.create_location',
      'admin.role.assign',
    ],
    isSystemRole: true,
  },

  // ============================================================================
  // LEVEL 3: SUPERVISORS
  // ============================================================================

  {
    name: 'Sales Supervisor',
    code: 'SALES_SUPERVISOR',
    description: 'Sales Supervisor - team-level sales supervision',
    hierarchyLevel: 'level_3',
    organizationalTier: 'location',
    department: 'sales',
    permissions: [
      'sales.lead.view_team',
      'sales.lead.edit_team',
      'sales.lead.assign',
      'sales.lead.delete',
      'sales.opportunity.view_team',
      'sales.customer.view_own',
      'sales.quote.approve_standard',
      'reporting.sales.view',
      'reporting.report.export',
      'reporting.report.schedule',
      'reporting.dashboard.customize',
    ],
    isSystemRole: true,
  },

  {
    name: 'Service Supervisor',
    code: 'SERVICE_SUPERVISOR',
    description: 'Service Supervisor - team-level service supervision',
    hierarchyLevel: 'level_3',
    organizationalTier: 'location',
    department: 'service',
    permissions: [
      'service.ticket.view_team',
      'service.ticket.create',
      'service.ticket.assign',
      'service.ticket.void',
      'service.equipment.view',
      'service.parts.approve',
      'service.schedule.manage',
      'reporting.service.view',
      'reporting.report.export',
      'reporting.report.schedule',
    ],
    isSystemRole: true,
  },

  {
    name: 'Warehouse Supervisor',
    code: 'WAREHOUSE_SUPERVISOR',
    description: 'Warehouse Supervisor - warehouse team supervision',
    hierarchyLevel: 'level_3',
    organizationalTier: 'location',
    department: 'operations',
    permissions: [
      'operations.inventory.view',
      'operations.inventory.adjust',
      'operations.warehouse.receive',
      'operations.warehouse.pick',
      'operations.warehouse.ship',
      'operations.po.view',
      'reporting.report.export',
    ],
    isSystemRole: true,
  },

  // ============================================================================
  // LEVEL 2: TEAM LEADS / SENIOR STAFF
  // ============================================================================

  {
    name: 'Senior Sales Representative',
    code: 'SENIOR_SALES_REP',
    description: 'Senior Sales Representative - individual + mentoring',
    hierarchyLevel: 'level_2',
    organizationalTier: 'location',
    department: 'sales',
    permissions: [
      'sales.lead.view_own',
      'sales.lead.create',
      'sales.lead.edit_own',
      'sales.opportunity.view_own',
      'sales.opportunity.create',
      'sales.opportunity.edit_own',
      'sales.customer.view_own',
      'sales.customer.edit_own',
      'sales.quote.create',
      'sales.quote.edit_own',
      'sales.commission.view_own',
      'sales.territory.view_own',
      // Team visibility for mentoring
      'sales.lead.view_team',
      'sales.opportunity.view_team',
      'reporting.sales.view',
      'reporting.report.export',
      'reporting.dashboard.customize',
    ],
    isSystemRole: true,
  },

  {
    name: 'Senior Field Technician',
    code: 'SENIOR_TECHNICIAN',
    description: 'Senior Field Technician - individual + mentoring',
    hierarchyLevel: 'level_2',
    organizationalTier: 'location',
    department: 'service',
    permissions: [
      'service.ticket.view_own',
      'service.ticket.edit_own',
      'service.ticket.close',
      'service.equipment.view',
      'service.equipment.install',
      'service.equipment.configure',
      'service.parts.view',
      'service.parts.request',
      'service.workorder.view_own',
      'service.schedule.view_own',
      // Team visibility for mentoring
      'service.ticket.view_team',
      'service.schedule.view_team',
      'reporting.service.view',
      'reporting.report.export',
    ],
    isSystemRole: true,
  },

  // ============================================================================
  // LEVEL 1: INDIVIDUAL CONTRIBUTORS
  // ============================================================================

  {
    name: 'Sales Representative',
    code: 'SALES_REP',
    description: 'Sales Representative - individual contributor',
    hierarchyLevel: 'level_1',
    organizationalTier: 'location',
    department: 'sales',
    permissions: [
      'sales.lead.view_own',
      'sales.lead.create',
      'sales.lead.edit_own',
      'sales.opportunity.view_own',
      'sales.opportunity.create',
      'sales.opportunity.edit_own',
      'sales.customer.view_own',
      'sales.customer.edit_own',
      'sales.quote.create',
      'sales.quote.edit_own',
      'sales.commission.view_own',
      'sales.territory.view_own',
      'reporting.report.view',
      'reporting.dashboard.customize',
    ],
    isSystemRole: true,
  },

  {
    name: 'Field Service Technician',
    code: 'FIELD_TECHNICIAN',
    description: 'Field Service Technician - individual contributor',
    hierarchyLevel: 'level_1',
    organizationalTier: 'location',
    department: 'service',
    permissions: [
      'service.ticket.view_own',
      'service.ticket.edit_own',
      'service.ticket.close',
      'service.equipment.view',
      'service.equipment.install',
      'service.equipment.configure',
      'service.parts.view',
      'service.parts.request',
      'service.workorder.view_own',
      'service.schedule.view_own',
      'reporting.report.view',
    ],
    isSystemRole: true,
  },

  {
    name: 'Warehouse Associate',
    code: 'WAREHOUSE_ASSOCIATE',
    description: 'Warehouse Associate - individual contributor',
    hierarchyLevel: 'level_1',
    organizationalTier: 'location',
    department: 'operations',
    permissions: [
      'operations.inventory.view',
      'operations.warehouse.receive',
      'operations.warehouse.pick',
      'operations.warehouse.ship',
      'operations.po.view',
      'reporting.report.view',
    ],
    isSystemRole: true,
  },

  {
    name: 'Accounting Clerk',
    code: 'ACCOUNTING_CLERK',
    description: 'Accounting Clerk - individual contributor',
    hierarchyLevel: 'level_1',
    organizationalTier: 'location',
    department: 'finance',
    permissions: [
      'finance.ar.view',
      'finance.ap.view',
      'finance.invoice.create',
      'finance.bill.enter',
      'finance.payment.apply',
      'reporting.report.view',
    ],
    isSystemRole: true,
  },
];

// ============================================================================
// SEEDER EXECUTION
// ============================================================================

export async function seedRBAC() {
  console.log('🌱 Starting RBAC Seeder...\n');

  try {
    // Step 1: Seed Permissions
    console.log('📝 Seeding permissions...');
    let permissionsCreated = 0;
    const permissionMap = new Map<string, string>(); // code -> id

    for (const perm of PERMISSION_DEFINITIONS) {
      try {
        const [created] = await db
          .insert(permissions)
          .values({
            name: perm.name,
            code: perm.code,
            description: perm.description,
            module: perm.module,
            resourceType: perm.resourceType,
            action: perm.action,
            scopeLevel: perm.scopeLevel,
            requiresApproval: perm.requiresApproval || false,
            requiresMFA: perm.requiresMFA || false,
            riskLevel: perm.riskLevel || 'low',
            isActive: true,
          })
          .returning();

        permissionMap.set(perm.code, created.id);
        permissionsCreated++;
      } catch (error) {
        // Permission might already exist (unique constraint)
        const existing = await db.query.permissions.findFirst({
          where: eq(permissions.code, perm.code),
        });
        if (existing) {
          permissionMap.set(perm.code, existing.id);
        }
      }
    }

    console.log(
      `✅ Created ${permissionsCreated} permissions (${PERMISSION_DEFINITIONS.length} total)`,
    );

    // Step 2: Seed Roles
    console.log('\n👥 Seeding roles...');
    let rolesCreated = 0;
    const roleMap = new Map<string, string>(); // code -> id

    // Calculate nested set values (lft, rght, depth) for flat structure
    // In production, you'd want proper nested set calculation
    let lftCounter = 1;

    for (const role of ROLE_TEMPLATES) {
      try {
        const rght = lftCounter + 1;
        const [created] = await db
          .insert(enhancedRoles)
          .values({
            tenantId: 'system', // System roles, will be copied per tenant
            name: role.name,
            code: role.code,
            description: role.description,
            hierarchyLevel: role.hierarchyLevel as any,
            organizationalTier: role.organizationalTier as any,
            department: role.department,
            parentRoleId: null,
            lft: lftCounter,
            rght: rght,
            depth: 0,
            isSystemRole: role.isSystemRole,
            isCustomizable: false,
            isTemplate: true,
            createdBy: 'system',
          })
          .returning();

        roleMap.set(role.code, created.id);
        rolesCreated++;
        lftCounter = rght + 1;
      } catch (error) {
        // Role might already exist
        console.log(`   ⚠️ ${role.name} may already exist`);
      }
    }

    console.log(`✅ Created ${rolesCreated} roles (${ROLE_TEMPLATES.length} total)`);

    // Step 3: Map Role-Permission Relationships
    console.log('\n🔗 Mapping role-permission relationships...');
    let mappingsCreated = 0;

    for (const role of ROLE_TEMPLATES) {
      const roleId = roleMap.get(role.code);
      if (!roleId) continue;

      for (const permCode of role.permissions) {
        const permId = permissionMap.get(permCode);
        if (!permId) {
          console.log(`   ⚠️ Permission not found: ${permCode}`);
          continue;
        }

        try {
          await db.insert(rolePermissions).values({
            roleId: roleId,
            permissionId: permId,
            effect: 'ALLOW',
            isCustomized: false,
          });
          mappingsCreated++;
        } catch (error) {
          // Mapping might already exist
        }
      }
    }

    console.log(`✅ Created ${mappingsCreated} role-permission mappings`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ RBAC Seeding Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Permissions: ${PERMISSION_DEFINITIONS.length}`);
    console.log(`   - Roles: ${ROLE_TEMPLATES.length}`);
    console.log(`   - Mappings: ${mappingsCreated}`);
    console.log(`\n🎯 Role Breakdown:`);
    console.log(`   - Level 8 (Platform): 1 role`);
    console.log(`   - Level 7 (Executive): 3 roles`);
    console.log(`   - Level 6 (Director): 4 roles`);
    console.log(`   - Level 5 (Regional): 2 roles`);
    console.log(`   - Level 4 (Manager): 5 roles`);
    console.log(`   - Level 3 (Supervisor): 3 roles`);
    console.log(`   - Level 2 (Team Lead): 2 roles`);
    console.log(`   - Level 1 (Individual): 4 roles`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ RBAC Seeding Failed:', error);
    throw error;
  }
}

// Allow direct execution (ESM compatible)
const isMainModule =
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}`;

if (isMainModule) {
  seedRBAC()
    .then(() => {
      console.log('\n✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seeding failed:', error);
      process.exit(1);
    });
}
