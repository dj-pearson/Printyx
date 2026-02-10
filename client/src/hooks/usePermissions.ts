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
  expandLegacyPermissions,
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
