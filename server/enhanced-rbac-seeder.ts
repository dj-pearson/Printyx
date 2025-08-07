import { db } from './db';
import { eq } from 'drizzle-orm';
import {
  organizationalUnits,
  enhancedRoles,
  permissions,
  rolePermissions,
  type InsertOrganizationalUnit,
  type InsertEnhancedRole,
  type InsertPermission,
  type InsertRolePermission
} from './enhanced-rbac-schema';

interface RoleDefinition {
  name: string;
  code: string;
  description: string;
  hierarchyLevel: string;
  organizationalTier: string;
  department: string;
  isSystemRole: boolean;
  isCustomizable: boolean;
  permissions: string[];
}

interface PermissionDefinition {
  name: string;
  code: string;
  description: string;
  module: string;
  resourceType: string;
  action: string;
  scopeLevel: string;
  riskLevel?: string;
  requiresApproval?: boolean;
  requiresMFA?: boolean;
}

export class EnhancedRBACSeeder {
  /**
   * Seed the enhanced RBAC system with standard roles and permissions
   */
  async seedEnhancedRBAC(tenantId: string, createdBy: string): Promise<void> {
    console.log(`🔐 Seeding Enhanced RBAC for tenant: ${tenantId}`);

    // 1. Create default organizational unit (company level)
    const companyUnit = await this.createDefaultOrganizationalUnit(tenantId);

    // 2. Seed permissions
    await this.seedPermissions();

    // 3. Seed roles with hierarchy
    await this.seedRoles(tenantId, companyUnit.id, createdBy);

    console.log(`✅ Enhanced RBAC seeding completed for tenant: ${tenantId}`);
  }

  private async createDefaultOrganizationalUnit(tenantId: string): Promise<any> {
    const unitData: InsertOrganizationalUnit = {
      tenantId,
      name: 'Company Headquarters',
      code: 'HQ',
      unitType: 'company',
      lft: 1,
      rght: 2,
      depth: 0,
      isActive: true
    };

    const [unit] = await db.insert(organizationalUnits)
      .values(unitData)
      .onConflictDoNothing()
      .returning();

    return unit || await db.select().from(organizationalUnits)
      .where(eq(organizationalUnits.tenantId, tenantId))
      .limit(1)
      .then(rows => rows[0]);
  }

  private async seedPermissions(): Promise<void> {
    const permissionDefinitions: PermissionDefinition[] = [
      // Sales & CRM Permissions
      { name: 'View Own Leads', code: 'lead.view_own', description: 'View own assigned leads', module: 'sales', resourceType: 'lead', action: 'view', scopeLevel: 'own' },
      { name: 'View Team Leads', code: 'lead.view_team', description: 'View team leads', module: 'sales', resourceType: 'lead', action: 'view', scopeLevel: 'team' },
      { name: 'View Location Leads', code: 'lead.view_location', description: 'View all location leads', module: 'sales', resourceType: 'lead', action: 'view', scopeLevel: 'location' },
      { name: 'View Regional Leads', code: 'lead.view_regional', description: 'View regional leads', module: 'sales', resourceType: 'lead', action: 'view', scopeLevel: 'regional' },
      { name: 'View Company Leads', code: 'lead.view_company', description: 'View all company leads', module: 'sales', resourceType: 'lead', action: 'view', scopeLevel: 'company' },
      
      { name: 'Create Leads', code: 'lead.create', description: 'Create new leads', module: 'sales', resourceType: 'lead', action: 'create', scopeLevel: 'own' },
      { name: 'Edit Own Leads', code: 'lead.edit_own', description: 'Edit own assigned leads', module: 'sales', resourceType: 'lead', action: 'edit', scopeLevel: 'own' },
      { name: 'Edit Team Leads', code: 'lead.edit_team', description: 'Edit team leads', module: 'sales', resourceType: 'lead', action: 'edit', scopeLevel: 'team' },
      { name: 'Assign Leads', code: 'lead.assign', description: 'Assign leads to team members', module: 'sales', resourceType: 'lead', action: 'assign', scopeLevel: 'team', requiresApproval: true },
      
      // Quote & Proposal Permissions
      { name: 'Create Quotes', code: 'quote.create', description: 'Create new quotes', module: 'sales', resourceType: 'quote', action: 'create', scopeLevel: 'own' },
      { name: 'Approve Standard Quotes', code: 'quote.approve_standard', description: 'Approve standard quotes', module: 'sales', resourceType: 'quote', action: 'approve', scopeLevel: 'team', riskLevel: 'medium' },
      { name: 'Approve High Value Quotes', code: 'quote.approve_high_value', description: 'Approve high value quotes', module: 'sales', resourceType: 'quote', action: 'approve', scopeLevel: 'location', riskLevel: 'high', requiresApproval: true },
      { name: 'Approve Enterprise Quotes', code: 'quote.approve_enterprise', description: 'Approve enterprise quotes', module: 'sales', resourceType: 'quote', action: 'approve', scopeLevel: 'company', riskLevel: 'critical', requiresMFA: true },
      
      // Service Management Permissions
      { name: 'View Own Tickets', code: 'ticket.view_own', description: 'View own assigned service tickets', module: 'service', resourceType: 'ticket', action: 'view', scopeLevel: 'own' },
      { name: 'View Team Tickets', code: 'ticket.view_team', description: 'View team service tickets', module: 'service', resourceType: 'ticket', action: 'view', scopeLevel: 'team' },
      { name: 'View Location Tickets', code: 'ticket.view_location', description: 'View location service tickets', module: 'service', resourceType: 'ticket', action: 'view', scopeLevel: 'location' },
      { name: 'Create Service Tickets', code: 'ticket.create', description: 'Create service tickets', module: 'service', resourceType: 'ticket', action: 'create', scopeLevel: 'own' },
      { name: 'Assign Service Tickets', code: 'ticket.assign', description: 'Assign service tickets', module: 'service', resourceType: 'ticket', action: 'assign', scopeLevel: 'team' },
      
      // Equipment Management
      { name: 'Install Equipment', code: 'equipment.install', description: 'Install and configure equipment', module: 'service', resourceType: 'equipment', action: 'install', scopeLevel: 'own' },
      { name: 'Configure Equipment', code: 'equipment.configure', description: 'Configure equipment settings', module: 'service', resourceType: 'equipment', action: 'configure', scopeLevel: 'team' },
      { name: 'Remote Equipment Access', code: 'equipment.remote_access', description: 'Remote access to equipment', module: 'service', resourceType: 'equipment', action: 'remote_access', scopeLevel: 'location', riskLevel: 'high' },
      
      // Financial Permissions
      { name: 'View Own Commission', code: 'commission.view_own', description: 'View own commission data', module: 'finance', resourceType: 'commission', action: 'view', scopeLevel: 'own' },
      { name: 'View Team Commission', code: 'commission.view_team', description: 'View team commission data', module: 'finance', resourceType: 'commission', action: 'view', scopeLevel: 'team' },
      { name: 'View Location Financials', code: 'financial.view_location', description: 'View location financial reports', module: 'finance', resourceType: 'report', action: 'view', scopeLevel: 'location', riskLevel: 'medium' },
      { name: 'View Regional Financials', code: 'financial.view_regional', description: 'View regional financial reports', module: 'finance', resourceType: 'report', action: 'view', scopeLevel: 'regional', riskLevel: 'high' },
      { name: 'View Company Financials', code: 'financial.view_company', description: 'View company financial reports', module: 'finance', resourceType: 'report', action: 'view', scopeLevel: 'company', riskLevel: 'critical', requiresMFA: true },
      
      // User Management
      { name: 'Create Location Users', code: 'user.create_location', description: 'Create location-level users', module: 'admin', resourceType: 'user', action: 'create', scopeLevel: 'location', requiresApproval: true },
      { name: 'Create Regional Users', code: 'user.create_regional', description: 'Create regional-level users', module: 'admin', resourceType: 'user', action: 'create', scopeLevel: 'regional', requiresApproval: true },
      { name: 'Create Company Users', code: 'user.create_company', description: 'Create company-level users', module: 'admin', resourceType: 'user', action: 'create', scopeLevel: 'company', riskLevel: 'high', requiresMFA: true },
      { name: 'Manage Role Permissions', code: 'role.manage_permissions', description: 'Manage role permissions', module: 'admin', resourceType: 'role', action: 'manage', scopeLevel: 'company', riskLevel: 'critical', requiresMFA: true },
      
      // Territory Management
      { name: 'Manage Territory Assignments', code: 'territory.manage_assignments', description: 'Manage territory assignments', module: 'sales', resourceType: 'territory', action: 'manage', scopeLevel: 'regional', riskLevel: 'medium' },
      { name: 'View Territory Performance', code: 'territory.view_performance', description: 'View territory performance metrics', module: 'sales', resourceType: 'territory', action: 'view', scopeLevel: 'regional' },
      
      // Audit & Compliance
      { name: 'View Location Audit Logs', code: 'audit.view_location', description: 'View location audit logs', module: 'admin', resourceType: 'audit', action: 'view', scopeLevel: 'location', riskLevel: 'medium' },
      { name: 'View Regional Audit Logs', code: 'audit.view_regional', description: 'View regional audit logs', module: 'admin', resourceType: 'audit', action: 'view', scopeLevel: 'regional', riskLevel: 'high' },
      { name: 'View Company Audit Logs', code: 'audit.view_company', description: 'View company audit logs', module: 'admin', resourceType: 'audit', action: 'view', scopeLevel: 'company', riskLevel: 'critical' },
      { name: 'Manage Compliance', code: 'compliance.manage', description: 'Manage compliance settings', module: 'admin', resourceType: 'compliance', action: 'manage', scopeLevel: 'platform', riskLevel: 'critical', requiresMFA: true },
      
      // Platform Administration
      { name: 'Access All Tenants', code: 'platform.access_all_tenants', description: 'Access all tenant data', module: 'platform', resourceType: 'tenant', action: 'access', scopeLevel: 'platform', riskLevel: 'critical', requiresMFA: true },
      { name: 'View System Metrics', code: 'platform.view_system_metrics', description: 'View system performance metrics', module: 'platform', resourceType: 'metrics', action: 'view', scopeLevel: 'platform', riskLevel: 'medium' }
    ];

    for (const permDef of permissionDefinitions) {
      const permissionData: InsertPermission = {
        name: permDef.name,
        code: permDef.code,
        description: permDef.description,
        module: permDef.module,
        resourceType: permDef.resourceType,
        action: permDef.action,
        scopeLevel: permDef.scopeLevel,
        riskLevel: permDef.riskLevel || 'low',
        requiresApproval: permDef.requiresApproval || false,
        requiresMFA: permDef.requiresMFA || false,
        isActive: true
      };

      await db.insert(permissions)
        .values(permissionData)
        .onConflictDoNothing();
    }

    console.log(`✅ Seeded ${permissionDefinitions.length} permissions`);
  }

  private async seedRoles(tenantId: string, organizationalUnitId: string, createdBy: string): Promise<void> {
    const roleDefinitions: RoleDefinition[] = [
      // Level 8: Platform Administrators (Fixed Printyx Roles)
      {
        name: 'Platform Admin',
        code: 'PLATFORM_ADMIN',
        description: 'Full system access across all tenants',
        hierarchyLevel: 'level_8',
        organizationalTier: 'platform',
        department: 'platform',
        isSystemRole: true,
        isCustomizable: false,
        permissions: ['platform.access_all_tenants', 'platform.view_system_metrics', 'compliance.manage', 'audit.view_company']
      },
      {
        name: 'Support Engineer',
        code: 'SUPPORT_ENGINEER',
        description: 'Technical support with limited cross-tenant access',
        hierarchyLevel: 'level_8',
        organizationalTier: 'platform',
        department: 'platform',
        isSystemRole: true,
        isCustomizable: false,
        permissions: ['platform.view_system_metrics', 'audit.view_company']
      },
      
      // Level 7: Company Executives
      {
        name: 'Company Admin',
        code: 'COMPANY_ADMIN',
        description: 'Full company access, can customize all lower roles',
        hierarchyLevel: 'level_7',
        organizationalTier: 'company',
        department: 'admin',
        isSystemRole: false,
        isCustomizable: false,
        permissions: ['role.manage_permissions', 'user.create_company', 'financial.view_company', 'lead.view_company', 'audit.view_company', 'territory.manage_assignments']
      },
      {
        name: 'CEO',
        code: 'CEO',
        description: 'Chief Executive Officer with strategic oversight',
        hierarchyLevel: 'level_7',
        organizationalTier: 'company',
        department: 'executive',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['financial.view_company', 'lead.view_company', 'quote.approve_enterprise', 'territory.view_performance']
      },
      {
        name: 'CFO',
        code: 'CFO',
        description: 'Chief Financial Officer',
        hierarchyLevel: 'level_7',
        organizationalTier: 'company',
        department: 'finance',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['financial.view_company', 'commission.view_team', 'quote.approve_enterprise']
      },
      
      // Level 6: Company Directors
      {
        name: 'VP Sales',
        code: 'VP_SALES',
        description: 'Vice President of Sales',
        hierarchyLevel: 'level_6',
        organizationalTier: 'company',
        department: 'sales',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['lead.view_company', 'quote.approve_high_value', 'territory.manage_assignments', 'commission.view_team', 'user.create_regional']
      },
      {
        name: 'VP Service',
        code: 'VP_SERVICE',
        description: 'Vice President of Service Operations',
        hierarchyLevel: 'level_6',
        organizationalTier: 'company',
        department: 'service',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.view_location', 'equipment.remote_access', 'user.create_regional']
      },
      {
        name: 'Operations Director',
        code: 'OPERATIONS_DIRECTOR',
        description: 'Operations oversight across locations',
        hierarchyLevel: 'level_6',
        organizationalTier: 'company',
        department: 'operations',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['financial.view_regional', 'audit.view_regional', 'user.create_regional']
      },
      
      // Level 5: Regional Managers
      {
        name: 'Regional Sales Director',
        code: 'REGIONAL_SALES_DIRECTOR',
        description: 'Multi-location sales management',
        hierarchyLevel: 'level_5',
        organizationalTier: 'regional',
        department: 'sales',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['lead.view_regional', 'quote.approve_high_value', 'territory.manage_assignments', 'commission.view_team']
      },
      {
        name: 'Regional Service Manager',
        code: 'REGIONAL_SERVICE_MANAGER',
        description: 'Multi-location service coordination',
        hierarchyLevel: 'level_5',
        organizationalTier: 'regional',
        department: 'service',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.view_location', 'equipment.remote_access', 'ticket.assign']
      },
      
      // Level 4: Location Managers
      {
        name: 'Branch Manager',
        code: 'BRANCH_MANAGER',
        description: 'Complete location oversight',
        hierarchyLevel: 'level_4',
        organizationalTier: 'location',
        department: 'admin',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['financial.view_location', 'lead.view_location', 'ticket.view_location', 'user.create_location', 'audit.view_location']
      },
      {
        name: 'Sales Manager',
        code: 'SALES_MANAGER',
        description: 'Location sales team management',
        hierarchyLevel: 'level_4',
        organizationalTier: 'location',
        department: 'sales',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['lead.view_location', 'quote.approve_standard', 'lead.assign', 'commission.view_team']
      },
      {
        name: 'Service Manager',
        code: 'SERVICE_MANAGER',
        description: 'Location service team management',
        hierarchyLevel: 'level_4',
        organizationalTier: 'location',
        department: 'service',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.view_location', 'ticket.assign', 'equipment.configure']
      },
      
      // Level 3: Department Supervisors
      {
        name: 'Sales Supervisor',
        code: 'SALES_SUPERVISOR',
        description: 'Team lead for sales representatives',
        hierarchyLevel: 'level_3',
        organizationalTier: 'location',
        department: 'sales',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['lead.view_team', 'lead.edit_team', 'quote.approve_standard', 'commission.view_team']
      },
      {
        name: 'Service Supervisor',
        code: 'SERVICE_SUPERVISOR',
        description: 'Team lead for technicians',
        hierarchyLevel: 'level_3',
        organizationalTier: 'location',
        department: 'service',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.view_team', 'ticket.assign', 'equipment.configure']
      },
      
      // Level 2: Team Leads
      {
        name: 'Senior Sales Rep',
        code: 'SENIOR_SALES_REP',
        description: 'Lead sales representative',
        hierarchyLevel: 'level_2',
        organizationalTier: 'location',
        department: 'sales',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['lead.view_team', 'lead.create', 'quote.create', 'commission.view_own']
      },
      {
        name: 'Senior Technician',
        code: 'SENIOR_TECHNICIAN',
        description: 'Lead field technician',
        hierarchyLevel: 'level_2',
        organizationalTier: 'location',
        department: 'service',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.view_team', 'equipment.install', 'equipment.configure']
      },
      
      // Level 1: Individual Contributors
      {
        name: 'Sales Representative',
        code: 'SALES_REP',
        description: 'Individual sales activities',
        hierarchyLevel: 'level_1',
        organizationalTier: 'location',
        department: 'sales',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['lead.view_own', 'lead.create', 'lead.edit_own', 'quote.create', 'commission.view_own']
      },
      {
        name: 'Field Technician',
        code: 'FIELD_TECHNICIAN',
        description: 'Individual service activities',
        hierarchyLevel: 'level_1',
        organizationalTier: 'location',
        department: 'service',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.view_own', 'ticket.create', 'equipment.install']
      },
      {
        name: 'Administrative Assistant',
        code: 'ADMIN_ASSISTANT',
        description: 'Support functions',
        hierarchyLevel: 'level_1',
        organizationalTier: 'location',
        department: 'admin',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.create', 'lead.create']
      }
    ];

    let position = 1;

    for (const roleDef of roleDefinitions) {
      // Create role
      const roleData: InsertEnhancedRole = {
        tenantId,
        organizationalUnitId,
        name: roleDef.name,
        code: roleDef.code,
        description: roleDef.description,
        hierarchyLevel: roleDef.hierarchyLevel as any,
        organizationalTier: roleDef.organizationalTier as any,
        department: roleDef.department,
        lft: position,
        rght: position + 1,
        depth: 0,
        isSystemRole: roleDef.isSystemRole,
        isCustomizable: roleDef.isCustomizable,
        createdBy
      };

      const [role] = await db.insert(enhancedRoles)
        .values(roleData)
        .onConflictDoNothing()
        .returning();

      if (role) {
        // Assign permissions to role
        await this.assignPermissionsToRole(role.id, roleDef.permissions);
        console.log(`✅ Created role: ${roleDef.name} with ${roleDef.permissions.length} permissions`);
      }

      position += 2;
    }

    console.log(`✅ Seeded ${roleDefinitions.length} roles`);
  }

  private async assignPermissionsToRole(roleId: string, permissionCodes: string[]): Promise<void> {
    for (const permissionCode of permissionCodes) {
      const [permission] = await db.select()
        .from(permissions)
        .where(eq(permissions.code, permissionCode))
        .limit(1);

      if (permission) {
        const rolePermissionData: InsertRolePermission = {
          roleId,
          permissionId: permission.id,
          effect: 'ALLOW',
          isCustomized: false
        };

        await db.insert(rolePermissions)
          .values(rolePermissionData)
          .onConflictDoNothing();
      }
    }
  }

  /**
   * Create roles optimized for small dealers ($500K revenue)
   */
  async seedSmallDealerRoles(tenantId: string, organizationalUnitId: string, createdBy: string): Promise<void> {
    const smallDealerRoles: RoleDefinition[] = [
      {
        name: 'Owner/Manager',
        code: 'OWNER_MANAGER',
        description: 'Small dealer owner with full access',
        hierarchyLevel: 'level_7',
        organizationalTier: 'company',
        department: 'admin',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['role.manage_permissions', 'user.create_company', 'financial.view_company', 'lead.view_company', 'ticket.view_location', 'quote.approve_high_value']
      },
      {
        name: 'Sales Manager',
        code: 'SMALL_SALES_MANAGER',
        description: 'Combined sales and operations management',
        hierarchyLevel: 'level_4',
        organizationalTier: 'location',
        department: 'sales',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['lead.view_location', 'quote.approve_standard', 'lead.assign', 'commission.view_team', 'ticket.view_team']
      },
      {
        name: 'Service Manager',
        code: 'SMALL_SERVICE_MANAGER',
        description: 'Combined service and technical management',
        hierarchyLevel: 'level_4',
        organizationalTier: 'location',
        department: 'service',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.view_location', 'ticket.assign', 'equipment.configure', 'equipment.remote_access', 'lead.create']
      },
      {
        name: 'Sales Rep',
        code: 'SMALL_SALES_REP',
        description: 'Sales with basic service capabilities',
        hierarchyLevel: 'level_1',
        organizationalTier: 'location',
        department: 'sales',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['lead.view_own', 'lead.create', 'quote.create', 'ticket.create', 'commission.view_own']
      },
      {
        name: 'Technician',
        code: 'SMALL_TECHNICIAN',
        description: 'Service with basic sales support',
        hierarchyLevel: 'level_1',
        organizationalTier: 'location',
        department: 'service',
        isSystemRole: false,
        isCustomizable: true,
        permissions: ['ticket.view_own', 'equipment.install', 'equipment.configure', 'lead.create']
      }
    ];

    let position = 1;
    for (const roleDef of smallDealerRoles) {
      const roleData: InsertEnhancedRole = {
        tenantId,
        organizationalUnitId,
        name: roleDef.name,
        code: roleDef.code,
        description: roleDef.description,
        hierarchyLevel: roleDef.hierarchyLevel as any,
        organizationalTier: roleDef.organizationalTier as any,
        department: roleDef.department,
        lft: position,
        rght: position + 1,
        depth: 0,
        isSystemRole: roleDef.isSystemRole,
        isCustomizable: roleDef.isCustomizable,
        createdBy
      };

      const [role] = await db.insert(enhancedRoles)
        .values(roleData)
        .onConflictDoNothing()
        .returning();

      if (role) {
        await this.assignPermissionsToRole(role.id, roleDef.permissions);
        console.log(`✅ Created small dealer role: ${roleDef.name}`);
      }

      position += 2;
    }
  }
}

export const rbacSeeder = new EnhancedRBACSeeder();