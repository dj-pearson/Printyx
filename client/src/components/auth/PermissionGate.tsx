/**
 * PermissionGate Component
 *
 * Conditionally renders children based on the current user's RBAC permissions.
 * Use this to hide/show UI elements like buttons, menu items, and form fields
 * based on what the user's role allows.
 *
 * Usage:
 *   <PermissionGate permission="sales.quote.approve_standard">
 *     <Button>Approve Quote</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate permissions={['sales.lead.delete']} minLevel={3}>
 *     <Button variant="destructive">Delete Lead</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate permission="sales.lead.edit_own" fallback={<DisabledButton />}>
 *     <Button>Edit Lead</Button>
 *   </PermissionGate>
 */

import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
  /** Single permission to check (OR with permissions array) */
  permission?: string;
  /** Multiple permissions - user needs at least one (OR logic) */
  permissions?: string[];
  /** All permissions required (AND logic) */
  allPermissions?: string[];
  /** Minimum role level required */
  minLevel?: number;
  /** Only allow platform admins */
  platformOnly?: boolean;
  /** Content to show when permission is denied (default: nothing) */
  fallback?: React.ReactNode;
  /** If true, shows children but in a disabled state instead of hiding */
  disableInstead?: boolean;
  /** Children to render when permitted */
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  allPermissions,
  minLevel,
  platformOnly,
  fallback = null,
  disableInstead = false,
  children,
}: PermissionGateProps) {
  const { hasAnyPermission, hasAllPermissions, level, isPlatformUser } = usePermissions();

  const isAllowed = React.useMemo(() => {
    // Platform admins bypass all checks
    if (isPlatformUser) return true;

    // Platform-only check
    if (platformOnly) return false;

    // Level check
    if (minLevel && level < minLevel) return false;

    // All permissions check (AND)
    if (allPermissions && allPermissions.length > 0) {
      if (!hasAllPermissions(allPermissions)) return false;
    }

    // Collect OR permissions
    const orPermissions = [...(permissions || []), ...(permission ? [permission] : [])];

    // Any permission check (OR)
    if (orPermissions.length > 0) {
      if (!hasAnyPermission(orPermissions)) return false;
    }

    return true;
  }, [
    permission,
    permissions,
    allPermissions,
    minLevel,
    platformOnly,
    isPlatformUser,
    level,
    hasAnyPermission,
    hasAllPermissions,
  ]);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (disableInstead) {
    return (
      <div className="opacity-50 pointer-events-none cursor-not-allowed" aria-disabled="true">
        {children}
      </div>
    );
  }

  return <>{fallback}</>;
}

/**
 * Hook to check a single permission.
 * Returns true if the user has the specified permission.
 */
export function usePermission(permission: string): boolean {
  const { hasAnyPermission, isPlatformUser } = usePermissions();
  return isPlatformUser || hasAnyPermission([permission]);
}

/**
 * Hook to check if user meets a minimum role level.
 */
export function useMinLevel(minLevel: number): boolean {
  const { level, isPlatformUser } = usePermissions();
  return isPlatformUser || level >= minLevel;
}
