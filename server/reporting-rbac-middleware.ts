// =====================================================================
// REPORTING RBAC MIDDLEWARE INTEGRATION
// Phase 1 Implementation - Permission Integration with Existing Auth
// =====================================================================

import { Request, Response, NextFunction } from 'express';
import { db } from './storage';
import { users, roles, locations, regions } from '../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

// =====================================================================
// ENHANCED USER CONTEXT FOR REPORTING
// =====================================================================

export interface ReportingUserContext {
  id: string;
  tenantId: string;
  roleId: string;
  accessScope: 'platform' | 'company' | 'regional' | 'location' | 'team' | 'individual';
  permissions: Record<string, boolean>;
  locationIds: string[];
  regionIds: string[];
  departmentIds: string[];
  isPlatformUser: boolean;
  
  // User details
  firstName: string;
  lastName: string;
  email: string;
  
  // Hierarchical access
  managerId?: string;
  teamId?: string;
  primaryLocationId?: string;
  regionId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: ReportingUserContext;
}

// =====================================================================
// PERMISSION MAPPINGS
// =====================================================================

// Map role-based permissions to reporting permissions
const ROLE_PERMISSION_MAPPING: Record<string, string[]> = {
  // Sales Department
  'SALES_REP': [
    'canViewReports',
    'canViewSalesReports',
    'canViewOwnData',
    'canExportReports'
  ],
  'SENIOR_SALES_REP': [
    'canViewReports',
    'canViewSalesReports',
    'canViewOwnData',
    'canViewTeamData',
    'canExportReports'
  ],
  'SALES_SUPERVISOR': [
    'canViewReports',
    'canViewSalesReports',
    'canViewTeamData',
    'canViewLocationData',
    'canExportReports',
    'canScheduleReports'
  ],
  'SALES_MANAGER': [
    'canViewReports',
    'canViewSalesReports',
    'canViewLocationData',
    'canExportReports',
    'canScheduleReports',
    'canCustomizeDashboards'
  ],
  'REGIONAL_SALES_DIRECTOR': [
    'canViewReports',
    'canViewSalesReports',
    'canViewRegionalData',
    'canExportReports',
    'canScheduleReports',
    'canCustomizeDashboards'
  ],
  'VP_SALES': [
    'canViewReports',
    'canViewSalesReports',
    'canViewExecutiveReports',
    'canViewCompanyData',
    'canExportReports',
    'canScheduleReports',
    'canCustomizeDashboards',
    'canManageKPIs'
  ],

  // Service Department
  'FIELD_TECHNICIAN': [
    'canViewReports',
    'canViewServiceReports',
    'canViewOwnData'
  ],
  'SENIOR_TECHNICIAN': [
    'canViewReports',
    'canViewServiceReports',
    'canViewOwnData',
    'canViewTeamData'
  ],
  'SERVICE_SUPERVISOR': [
    'canViewReports',
    'canViewServiceReports',
    'canViewTeamData',
    'canExportReports'
  ],
  'SERVICE_MANAGER': [
    'canViewReports',
    'canViewServiceReports',
    'canViewLocationData',
    'canExportReports',
    'canScheduleReports'
  ],
  'REGIONAL_SERVICE_MANAGER': [
    'canViewReports',
    'canViewServiceReports',
    'canViewRegionalData',
    'canExportReports',
    'canScheduleReports'
  ],
  'VP_SERVICE': [
    'canViewReports',
    'canViewServiceReports',
    'canViewExecutiveReports',
    'canViewCompanyData',
    'canExportReports',
    'canScheduleReports',
    'canCustomizeDashboards',
    'canManageKPIs'
  ],

  // Finance Department
  'ACCOUNTING_CLERK': [
    'canViewReports',
    'canViewFinanceReports',
    'canViewLocationData'
  ],
  'FINANCE_MANAGER': [
    'canViewReports',
    'canViewFinanceReports',
    'canViewLocationData',
    'canViewSensitiveFinancials',
    'canExportReports',
    'canScheduleReports'
  ],
  'CFO': [
    'canViewReports',
    'canViewFinanceReports',
    'canViewExecutiveReports',
    'canViewCompanyData',
    'canViewSensitiveFinancials',
    'canExportReports',
    'canScheduleReports',
    'canCustomizeDashboards',
    'canManageKPIs'
  ],

  // Executive Level
  'CEO': [
    'canViewReports',
    'canViewExecutiveReports',
    'canViewSalesReports',
    'canViewServiceReports',
    'canViewFinanceReports',
    'canViewOperationsReports',
    'canViewCompanyData',
    'canViewSensitiveFinancials',
    'canExportReports',
    'canScheduleReports',
    'canCustomizeDashboards',
    'canManageKPIs',
    'canManageReportDefinitions'
  ],
  'BRANCH_MANAGER': [
    'canViewReports',
    'canViewExecutiveReports',
    'canViewSalesReports',
    'canViewServiceReports',
    'canViewFinanceReports',
    'canViewOperationsReports',
    'canViewLocationData',
    'canExportReports',
    'canScheduleReports',
    'canCustomizeDashboards'
  ],

  // Platform Level
  'PLATFORM_ADMIN': [
    'canViewReports',
    'canViewExecutiveReports',
    'canViewSalesReports',
    'canViewServiceReports',
    'canViewFinanceReports',
    'canViewOperationsReports',
    'canViewHRReports',
    'canViewITReports',
    'canViewComplianceReports',
    'canViewAllTenantData',
    'canViewSensitiveFinancials',
    'canExportReports',
    'canScheduleReports',
    'canCustomizeDashboards',
    'canManageKPIs',
    'canManageReportDefinitions',
    'canViewAuditLogs',
    'canManageUserAccess'
  ]
};

// Department permission mapping
const DEPARTMENT_PERMISSIONS: Record<string, string[]> = {
  'sales': ['canViewSalesReports'],
  'service': ['canViewServiceReports'],
  'finance': ['canViewFinanceReports'],
  'operations': ['canViewOperationsReports'],
  'hr': ['canViewHRReports'],
  'it': ['canViewITReports'],
  'compliance': ['canViewComplianceReports'],
  'admin': ['canViewExecutiveReports']
};

// =====================================================================
// MIDDLEWARE FUNCTIONS
// =====================================================================

// Enhanced authentication middleware that builds full user context
export const enhanceUserContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Skip if user context already enhanced
    if (req.user && req.user.permissions) {
      return next();
    }

    // Get user ID from existing auth (session or JWT)
    const userId = req.user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Fetch full user details with role information
    const userWithRole = await db
      .select({
        user: users,
        role: roles,
        location: locations,
        region: regions
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(locations, eq(users.primaryLocationId, locations.id))
      .leftJoin(regions, eq(locations.regionId, regions.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (userWithRole.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { user, role, location, region } = userWithRole[0];

    // Build hierarchical access arrays
    const locationIds = await getAccessibleLocationIds(user, role);
    const regionIds = await getAccessibleRegionIds(user, role);
    const departmentIds = role ? [role.department] : [];

    // Determine access scope based on role level and permissions
    const accessScope = determineAccessScope(role, user);

    // Build permissions from role and department
    const permissions = buildUserPermissions(role);

    // Create enhanced user context
    const enhancedUser: ReportingUserContext = {
      id: user.id,
      tenantId: user.tenantId!,
      roleId: user.roleId!,
      accessScope,
      permissions,
      locationIds,
      regionIds,
      departmentIds,
      isPlatformUser: user.isPlatformUser || false,
      
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      
      managerId: user.managerId || undefined,
      teamId: user.teamId || undefined,
      primaryLocationId: user.primaryLocationId || undefined,
      regionId: region?.id || undefined
    };

    // Attach enhanced context to request
    req.user = enhancedUser;
    next();

  } catch (error) {
    console.error('Error enhancing user context:', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
};

// Permission validation middleware factory
export const requireReportPermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.permissions[permission]) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userPermissions: Object.keys(req.user.permissions).filter(p => req.user!.permissions[p])
      });
    }

    next();
  };
};

// Multiple permission validation (user needs ALL permissions)
export const requireAllPermissions = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const missingPermissions = permissions.filter(perm => !req.user!.permissions[perm]);
    
    if (missingPermissions.length > 0) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissions,
        missing: missingPermissions,
        userPermissions: Object.keys(req.user.permissions).filter(p => req.user!.permissions[p])
      });
    }

    next();
  };
};

// Any permission validation (user needs ANY of the permissions)
export const requireAnyPermission = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAnyPermission = permissions.some(perm => req.user!.permissions[perm]);
    
    if (!hasAnyPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        requiredAny: permissions,
        userPermissions: Object.keys(req.user.permissions).filter(p => req.user!.permissions[p])
      });
    }

    next();
  };
};

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

// Get accessible location IDs based on user's role and scope
async function getAccessibleLocationIds(user: any, role: any): Promise<string[]> {
  if (!user.tenantId) return [];

  // Platform users can access all locations across tenants
  if (user.isPlatformUser && role?.canAccessAllTenants) {
    const allLocations = await db.select({ id: locations.id }).from(locations);
    return allLocations.map(l => l.id);
  }

  // Company-wide access (C-level)
  if (role?.canAccessAllLocations) {
    const companyLocations = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.tenantId, user.tenantId));
    return companyLocations.map(l => l.id);
  }

  // Regional access
  if (role?.canViewRegionalReports && user.regionId) {
    const regionalLocations = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, user.tenantId),
          eq(locations.regionId, user.regionId)
        )
      );
    return regionalLocations.map(l => l.id);
  }

  // Location access (default)
  if (user.primaryLocationId) {
    return [user.primaryLocationId];
  }

  return [];
}

// Get accessible region IDs based on user's role and scope
async function getAccessibleRegionIds(user: any, role: any): Promise<string[]> {
  if (!user.tenantId) return [];

  // Platform users can access all regions
  if (user.isPlatformUser && role?.canAccessAllTenants) {
    const allRegions = await db.select({ id: regions.id }).from(regions);
    return allRegions.map(r => r.id);
  }

  // Company-wide access
  if (role?.canAccessAllLocations) {
    const companyRegions = await db
      .select({ id: regions.id })
      .from(regions)
      .where(eq(regions.tenantId, user.tenantId));
    return companyRegions.map(r => r.id);
  }

  // Regional access
  if (user.regionId) {
    return [user.regionId];
  }

  return [];
}

// Determine user's access scope based on role and permissions
function determineAccessScope(role: any, user: any): ReportingUserContext['accessScope'] {
  if (!role) return 'individual';

  // Platform level
  if (user.isPlatformUser && role.canAccessAllTenants) {
    return 'platform';
  }

  // Company level
  if (role.canAccessAllLocations || role.level >= 7) {
    return 'company';
  }

  // Regional level
  if (role.canViewRegionalReports || role.level >= 5) {
    return 'regional';
  }

  // Location level
  if (role.canViewLocationReports || role.level >= 3) {
    return 'location';
  }

  // Team level
  if (role.level >= 2) {
    return 'team';
  }

  // Individual level
  return 'individual';
}

// Build user permissions from role and department
function buildUserPermissions(role: any): Record<string, boolean> {
  const permissions: Record<string, boolean> = {};

  if (!role) return permissions;

  // Add role-specific permissions
  const roleCode = role.code;
  const rolePermissions = ROLE_PERMISSION_MAPPING[roleCode] || [];
  rolePermissions.forEach(perm => {
    permissions[perm] = true;
  });

  // Add department permissions
  const deptPermissions = DEPARTMENT_PERMISSIONS[role.department] || [];
  deptPermissions.forEach(perm => {
    permissions[perm] = true;
  });

  // Add base permissions based on role level
  if (role.level >= 1) {
    permissions.canViewReports = true;
    permissions.canViewOwnData = true;
  }

  if (role.level >= 2) {
    permissions.canViewTeamData = true;
  }

  if (role.level >= 3) {
    permissions.canExportReports = true;
  }

  if (role.level >= 4) {
    permissions.canViewLocationData = true;
    permissions.canScheduleReports = true;
  }

  if (role.level >= 5) {
    permissions.canViewRegionalData = true;
    permissions.canCustomizeDashboards = true;
  }

  if (role.level >= 6) {
    permissions.canViewCompanyData = true;
    permissions.canManageKPIs = true;
  }

  if (role.level >= 7) {
    permissions.canViewExecutiveReports = true;
    permissions.canViewSensitiveFinancials = true;
  }

  if (role.level >= 8) {
    permissions.canViewAllTenantData = true;
    permissions.canManageReportDefinitions = true;
    permissions.canViewAuditLogs = true;
    permissions.canManageUserAccess = true;
  }

  return permissions;
}

// =====================================================================
// HIERARCHICAL QUERY BUILDER
// =====================================================================

export class HierarchicalQueryBuilder {
  constructor(private userContext: ReportingUserContext) {}

  applyHierarchicalFilter(baseQuery: any, tableName?: string): any {
    const prefix = tableName ? `${tableName}.` : '';
    
    switch (this.userContext.accessScope) {
      case 'platform':
        // Platform users can access all data
        return baseQuery;
        
      case 'company':
        // Company-wide access
        return baseQuery.where(eq(`${prefix}tenant_id`, this.userContext.tenantId));
        
      case 'regional':
        // Regional access
        return baseQuery.where(
          and(
            eq(`${prefix}tenant_id`, this.userContext.tenantId),
            this.userContext.regionIds.length > 0 
              ? inArray(`${prefix}region_id`, this.userContext.regionIds)
              : eq(`${prefix}region_id`, 'none') // Fallback to prevent data access
          )
        );
        
      case 'location':
        // Location access
        return baseQuery.where(
          and(
            eq(`${prefix}tenant_id`, this.userContext.tenantId),
            this.userContext.locationIds.length > 0
              ? inArray(`${prefix}location_id`, this.userContext.locationIds)
              : eq(`${prefix}location_id`, 'none') // Fallback to prevent data access
          )
        );
        
      case 'team':
        // Team access (location + team filter)
        return baseQuery.where(
          and(
            eq(`${prefix}tenant_id`, this.userContext.tenantId),
            this.userContext.locationIds.length > 0
              ? inArray(`${prefix}location_id`, this.userContext.locationIds)
              : eq(`${prefix}location_id`, 'none'),
            this.userContext.teamId 
              ? eq(`${prefix}team_id`, this.userContext.teamId)
              : eq(`${prefix}team_id`, 'none')
          )
        );
        
      case 'individual':
        // Individual access (user's own data)
        return baseQuery.where(
          and(
            eq(`${prefix}tenant_id`, this.userContext.tenantId),
            eq(`${prefix}user_id`, this.userContext.id)
          )
        );
        
      default:
        // No access by default
        return baseQuery.where(eq('1', '0'));
    }
  }
}

// Export the enhanced request type for use in route files
export type { AuthenticatedRequest };
