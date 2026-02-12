/**
 * RouteGuard Component
 *
 * Wraps route children with role-level access control.
 * Designed for protecting admin routes that require a minimum role level.
 *
 * Usage:
 *   <Route path="/admin/something">
 *     {() => (
 *       <RouteGuard minLevel={7}>
 *         <AdminPage />
 *       </RouteGuard>
 *     )}
 *   </Route>
 *
 * Or use the AdminRouteGuard shorthand (minLevel=7, platformOnly fallback):
 *   <Route path="/admin/something">
 *     {() => (
 *       <AdminRouteGuard component={AdminPage} />
 *     )}
 *   </Route>
 */

import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Individual Contributor',
  2: 'Team Lead',
  3: 'Supervisor',
  4: 'Manager',
  5: 'Regional Director',
  6: 'Company Director',
  7: 'Executive',
  8: 'Platform Admin',
};

function AccessDeniedPage({
  requiredLevel,
  userLevel,
}: {
  requiredLevel: number;
  userLevel: number;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md p-8">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">
          This page is restricted to administrators. You don't have the required role level to
          access it.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-500">
          <div className="flex items-center gap-2 justify-center">
            <Lock className="w-4 h-4" />
            <span>
              Requires: <strong>{LEVEL_NAMES[requiredLevel] || `Level ${requiredLevel}`}</strong> or
              higher
            </span>
          </div>
          <div className="text-xs mt-1">
            Your level: {LEVEL_NAMES[userLevel] || `Level ${userLevel}`}
          </div>
        </div>
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

interface RouteGuardProps {
  children: React.ReactNode;
  minLevel?: number;
}

/**
 * Generic route guard that checks role level before rendering children.
 * Platform admins always bypass the check.
 */
export function RouteGuard({ children, minLevel = 7 }: RouteGuardProps) {
  const { level, isPlatformUser } = usePermissions();

  if (isPlatformUser) {
    return <>{children}</>;
  }

  if (level < minLevel) {
    return <AccessDeniedPage requiredLevel={minLevel} userLevel={level} />;
  }

  return <>{children}</>;
}

interface AdminRouteGuardProps {
  component: React.ComponentType<any>;
  componentProps?: Record<string, any>;
}

/**
 * Shorthand guard for admin routes requiring level >= 7.
 * Takes a component prop for consistency with ProtectedRoute pattern.
 */
export function AdminRouteGuard({ component: Component, componentProps }: AdminRouteGuardProps) {
  const { level, isPlatformUser } = usePermissions();

  if (isPlatformUser) {
    return <Component {...componentProps} />;
  }

  if (level < 7) {
    return <AccessDeniedPage requiredLevel={7} userLevel={level} />;
  }

  return <Component {...componentProps} />;
}
