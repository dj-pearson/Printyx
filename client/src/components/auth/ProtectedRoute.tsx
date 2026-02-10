/**
 * ProtectedRoute Component
 *
 * Wraps page components with permission-based access control.
 * Checks the user's granular RBAC permissions before rendering the page.
 * If access is denied, shows an access denied screen with context about
 * what permissions are required.
 *
 * Usage:
 *   <Route path="/leads-management">
 *     {() => (
 *       <ProtectedRoute
 *         permissions={['sales.lead.view_own', 'sales.lead.view_team']}
 *         component={LeadsManagement}
 *       />
 *     )}
 *   </Route>
 *
 * Or with minimum level:
 *   <ProtectedRoute
 *     permissions={['reporting.executive.view']}
 *     minLevel={6}
 *     component={ExecutiveDashboard}
 *   />
 */

import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

interface ProtectedRouteProps {
  /** The page component to render if access is granted */
  component: React.ComponentType<any>;
  /** At least one of these permissions is required (OR logic) */
  permissions?: string[];
  /** All of these permissions are required (AND logic) */
  allPermissions?: string[];
  /** Minimum role hierarchy level (1-8) */
  minLevel?: number;
  /** Only accessible by platform admins */
  platformOnly?: boolean;
  /** Pass-through props to the component */
  componentProps?: Record<string, any>;
  /** Custom access denied message */
  deniedMessage?: string;
}

function AccessDenied({
  message,
  requiredLevel,
  userLevel,
}: {
  message?: string;
  requiredLevel?: number;
  userLevel: number;
}) {
  const levelNames: Record<number, string> = {
    1: 'Individual Contributor',
    2: 'Team Lead',
    3: 'Supervisor',
    4: 'Manager',
    5: 'Regional Director',
    6: 'Company Director',
    7: 'Executive',
    8: 'Platform Admin',
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md p-8">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600 mb-4">
          {message || "You don't have the required permissions to view this page."}
        </p>
        {requiredLevel && requiredLevel > userLevel && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-500">
            <div className="flex items-center gap-2 justify-center">
              <Lock className="w-4 h-4" />
              <span>
                Requires: <strong>{levelNames[requiredLevel] || `Level ${requiredLevel}`}</strong>
              </span>
            </div>
            <div className="text-xs mt-1">
              Your level: {levelNames[userLevel] || `Level ${userLevel}`}
            </div>
          </div>
        )}
        <p className="text-sm text-gray-500 mb-6">
          Contact your administrator if you believe you should have access to this page.
        </p>
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  component: Component,
  permissions,
  allPermissions,
  minLevel,
  platformOnly,
  componentProps,
  deniedMessage,
}: ProtectedRouteProps) {
  const { hasAnyPermission, hasAllPermissions, level, isPlatformUser } = usePermissions();

  // Platform admins bypass all checks
  if (isPlatformUser) {
    return <Component {...componentProps} />;
  }

  // Platform-only check
  if (platformOnly) {
    return (
      <AccessDenied
        message="This page is only accessible to platform administrators."
        requiredLevel={8}
        userLevel={level}
      />
    );
  }

  // Level check
  if (minLevel && level < minLevel) {
    return <AccessDenied message={deniedMessage} requiredLevel={minLevel} userLevel={level} />;
  }

  // All permissions check (AND)
  if (allPermissions && allPermissions.length > 0) {
    if (!hasAllPermissions(allPermissions)) {
      return <AccessDenied message={deniedMessage} userLevel={level} />;
    }
  }

  // Any permission check (OR)
  if (permissions && permissions.length > 0) {
    if (!hasAnyPermission(permissions)) {
      return <AccessDenied message={deniedMessage} userLevel={level} />;
    }
  }

  return <Component {...componentProps} />;
}
