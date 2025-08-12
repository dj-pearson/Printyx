// RBAC (Role-Based Access Control) system for reports
// This module handles permissions, data filtering, and access control

export interface UserRole {
  id: string;
  name: string;
  description: string;
  level: 'executive' | 'manager' | 'rep' | 'admin';
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface UserContext {
  userId: string;
  roleId: string;
  role: UserRole;
  territoryIds: string[];
  teamMemberIds: string[];
  managerId?: string;
  isManager: boolean;
  isExecutive: boolean;
  departments: string[];
}

// Predefined roles for the reporting system
export const REPORTING_ROLES: Record<string, UserRole> = {
  EXECUTIVE: {
    id: 'executive',
    name: 'Executive',
    description: 'C-level executives with full access to all reports',
    level: 'executive',
    permissions: [
      { resource: 'reports:sales', actions: ['read', 'export'] },
      { resource: 'reports:service', actions: ['read', 'export'] },
      { resource: 'reports:finance', actions: ['read', 'export'] },
      { resource: 'reports:executive', actions: ['read', 'export'] },
      { resource: 'data:all', actions: ['read'] },
      { resource: 'analytics:advanced', actions: ['read'] }
    ]
  },
  SALES_MANAGER: {
    id: 'sales_manager',
    name: 'Sales Manager',
    description: 'Sales team managers with access to team performance data',
    level: 'manager',
    permissions: [
      { resource: 'reports:sales', actions: ['read', 'export'] },
      { resource: 'reports:executive', actions: ['read'], conditions: { scope: 'sales' } },
      { resource: 'data:sales', actions: ['read'], conditions: { scope: 'team' } },
      { resource: 'analytics:coaching', actions: ['read'] }
    ]
  },
  SERVICE_MANAGER: {
    id: 'service_manager',
    name: 'Service Manager',
    description: 'Service team managers with access to operational metrics',
    level: 'manager',
    permissions: [
      { resource: 'reports:service', actions: ['read', 'export'] },
      { resource: 'reports:executive', actions: ['read'], conditions: { scope: 'service' } },
      { resource: 'data:service', actions: ['read'], conditions: { scope: 'team' } },
      { resource: 'analytics:forecasting', actions: ['read'] }
    ]
  },
  FINANCE_MANAGER: {
    id: 'finance_manager',
    name: 'Finance Manager',
    description: 'Finance team with access to financial and payment data',
    level: 'manager',
    permissions: [
      { resource: 'reports:finance', actions: ['read', 'export'] },
      { resource: 'reports:executive', actions: ['read'], conditions: { scope: 'finance' } },
      { resource: 'data:financial', actions: ['read'] },
      { resource: 'data:customers', actions: ['read'], conditions: { fields: ['financial'] } }
    ]
  },
  SALES_REP: {
    id: 'sales_rep',
    name: 'Sales Representative',
    description: 'Individual sales reps with access to personal metrics',
    level: 'rep',
    permissions: [
      { resource: 'reports:sales', actions: ['read'], conditions: { scope: 'self' } },
      { resource: 'data:sales', actions: ['read'], conditions: { scope: 'self' } },
      { resource: 'data:customers', actions: ['read'], conditions: { scope: 'assigned' } }
    ]
  },
  TECHNICIAN: {
    id: 'technician',
    name: 'Technician',
    description: 'Service technicians with access to personal metrics',
    level: 'rep',
    permissions: [
      { resource: 'reports:service', actions: ['read'], conditions: { scope: 'self' } },
      { resource: 'data:service', actions: ['read'], conditions: { scope: 'assigned' } },
      { resource: 'data:customers', actions: ['read'], conditions: { scope: 'assigned' } }
    ]
  },
  ADMIN: {
    id: 'admin',
    name: 'System Administrator',
    description: 'Full system access for configuration and maintenance',
    level: 'admin',
    permissions: [
      { resource: 'reports:*', actions: ['read', 'export', 'create', 'update', 'delete'] },
      { resource: 'data:*', actions: ['read', 'write'] },
      { resource: 'analytics:*', actions: ['read'] },
      { resource: 'system:*', actions: ['read', 'write', 'configure'] }
    ]
  }
};

// RBAC utility class
export class RBACService {
  private userContext: UserContext;

  constructor(userContext: UserContext) {
    this.userContext = userContext;
  }

  // Check if user has permission for a specific resource and action
  hasPermission(resource: string, action: string): boolean {
    const permissions = this.userContext.role.permissions;
    
    return permissions.some(permission => {
      // Check for wildcard permissions
      if (permission.resource === 'reports:*' || permission.resource === 'data:*') {
        return permission.actions.includes(action) || permission.actions.includes('*');
      }
      
      // Check exact resource match
      if (permission.resource === resource) {
        return permission.actions.includes(action) || permission.actions.includes('*');
      }
      
      return false;
    });
  }

  // Get data filter conditions based on user context
  getDataFilters(dataType: string): Record<string, any> {
    const filters: Record<string, any> = {};
    const role = this.userContext.role;

    switch (role.level) {
      case 'executive':
        // Executives can see all data
        return {};

      case 'manager':
        switch (dataType) {
          case 'sales':
            if (role.id === 'sales_manager') {
              filters.territory = { $in: this.userContext.territoryIds };
              filters.managerId = this.userContext.userId;
            }
            break;
          case 'service':
            if (role.id === 'service_manager') {
              filters.territory = { $in: this.userContext.territoryIds };
              filters.assignedManagerId = this.userContext.userId;
            }
            break;
          case 'finance':
            if (role.id === 'finance_manager') {
              // Finance managers can see all financial data
            }
            break;
        }
        break;

      case 'rep':
        switch (dataType) {
          case 'sales':
            filters.userId = this.userContext.userId;
            break;
          case 'service':
            filters.technicianId = this.userContext.userId;
            break;
        }
        break;
    }

    return filters;
  }

  // Get allowed territories for the user
  getAllowedTerritories(): string[] {
    if (this.userContext.role.level === 'executive') {
      return []; // Empty array means all territories
    }
    return this.userContext.territoryIds;
  }

  // Get allowed team members for the user
  getAllowedTeamMembers(): string[] {
    if (this.userContext.role.level === 'executive') {
      return []; // Empty array means all team members
    }
    if (this.userContext.isManager) {
      return this.userContext.teamMemberIds;
    }
    return [this.userContext.userId]; // Only themselves
  }

  // Check if user can view specific customer data
  canViewCustomer(customerId: string): boolean {
    if (this.userContext.role.level === 'executive') {
      return true;
    }
    
    // This would typically check against a customer-territory mapping
    // For now, assuming all customers are visible to managers and assigned customers to reps
    if (this.userContext.isManager) {
      return true; // Managers can see customers in their territory
    }
    
    return false; // Would need to check customer assignment
  }

  // Filter sensitive data fields based on permissions
  filterSensitiveData<T extends Record<string, any>>(data: T, dataType: string): Partial<T> {
    const filteredData: Partial<T> = { ...data };
    
    // Remove sensitive fields based on role and permissions
    switch (this.userContext.role.level) {
      case 'rep':
        // Remove manager-only fields
        if (dataType === 'customer') {
          delete filteredData.profitMargin;
          delete filteredData.internalNotes;
          delete filteredData.creditScore;
        }
        if (dataType === 'sales') {
          delete filteredData.teamComparison;
          delete filteredData.managerNotes;
        }
        break;
        
      case 'manager':
        if (dataType === 'finance' && this.userContext.role.id !== 'finance_manager') {
          delete filteredData.detailedFinancials;
          delete filteredData.creditLimits;
        }
        break;
    }

    return filteredData;
  }
}

// React hook for RBAC context
import { createContext, useContext, useEffect, useState } from 'react';

const RBACContext = createContext<RBACService | null>(null);

export function RBACProvider({ 
  children, 
  userContext 
}: { 
  children: React.ReactNode; 
  userContext: UserContext;
}) {
  const [rbacService] = useState(() => new RBACService(userContext));

  return (
    <RBACContext.Provider value={rbacService}>
      {children}
    </RBACContext.Provider>
  );
}

export function useRBAC(): RBACService {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
}

// Utility functions for common RBAC checks
export const rbacUtils = {
  // Check if user can access sales reports
  canAccessSalesReports: (rbac: RBACService): boolean => {
    return rbac.hasPermission('reports:sales', 'read');
  },

  // Check if user can access service reports  
  canAccessServiceReports: (rbac: RBACService): boolean => {
    return rbac.hasPermission('reports:service', 'read');
  },

  // Check if user can access financial reports
  canAccessFinancialReports: (rbac: RBACService): boolean => {
    return rbac.hasPermission('reports:finance', 'read');
  },

  // Check if user can access executive reports
  canAccessExecutiveReports: (rbac: RBACService): boolean => {
    return rbac.hasPermission('reports:executive', 'read');
  },

  // Get user's reporting capabilities
  getReportingCapabilities: (rbac: RBACService) => ({
    canViewSalesReports: rbacUtils.canAccessSalesReports(rbac),
    canViewServiceReports: rbacUtils.canAccessServiceReports(rbac),
    canViewFinancialReports: rbacUtils.canAccessFinancialReports(rbac),
    canViewExecutiveReports: rbacUtils.canAccessExecutiveReports(rbac),
    canExportReports: rbac.hasPermission('reports:*', 'export'),
    canManageReports: rbac.hasPermission('reports:*', 'create'),
    allowedTerritories: rbac.getAllowedTerritories(),
    allowedTeamMembers: rbac.getAllowedTeamMembers()
  })
};

// API middleware for applying RBAC filters
export function applyRBACFilters(
  endpoint: string, 
  params: Record<string, any>, 
  rbac: RBACService
): Record<string, any> {
  const filteredParams = { ...params };
  
  // Apply data filters based on endpoint
  if (endpoint.includes('/sales-reps')) {
    const filters = rbac.getDataFilters('sales');
    Object.assign(filteredParams, filters);
  } else if (endpoint.includes('/service-')) {
    const filters = rbac.getDataFilters('service');
    Object.assign(filteredParams, filters);
  } else if (endpoint.includes('/financial') || endpoint.includes('/payment')) {
    const filters = rbac.getDataFilters('finance');
    Object.assign(filteredParams, filters);
  }

  // Apply territory restrictions
  const allowedTerritories = rbac.getAllowedTerritories();
  if (allowedTerritories.length > 0) {
    filteredParams.territories = allowedTerritories;
  }

  return filteredParams;
}