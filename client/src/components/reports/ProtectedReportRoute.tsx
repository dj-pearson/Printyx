import React from 'react';
import { useRBAC, rbacUtils } from '@/lib/rbac';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Lock, 
  AlertTriangle, 
  ArrowLeft,
  Mail 
} from 'lucide-react';

interface ProtectedReportRouteProps {
  children: React.ReactNode;
  requiredPermission: 'sales' | 'service' | 'finance' | 'executive';
  fallbackMessage?: string;
  showContactAdmin?: boolean;
}

export default function ProtectedReportRoute({
  children,
  requiredPermission,
  fallbackMessage,
  showContactAdmin = true
}: ProtectedReportRouteProps) {
  const rbac = useRBAC();
  
  // Check if user has the required permission
  const hasAccess = (() => {
    switch (requiredPermission) {
      case 'sales':
        return rbacUtils.canAccessSalesReports(rbac);
      case 'service':
        return rbacUtils.canAccessServiceReports(rbac);
      case 'finance':
        return rbacUtils.canAccessFinancialReports(rbac);
      case 'executive':
        return rbacUtils.canAccessExecutiveReports(rbac);
      default:
        return false;
    }
  })();

  if (hasAccess) {
    return <>{children}</>;
  }

  // Access denied component
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">Access Restricted</CardTitle>
            <CardDescription>
              {fallbackMessage || `You don't have permission to access ${requiredPermission} reports`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                This report requires <strong>{requiredPermission}</strong> permissions. 
                Your current role does not include access to this data.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                If you believe you should have access to this report, please:
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Check with your manager about your role permissions
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Verify you're logged in with the correct account
                </li>
                {showContactAdmin && (
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Contact your system administrator
                  </li>
                )}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => window.history.back()}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              {showContactAdmin && (
                <Button 
                  variant="outline"
                  onClick={() => window.open('mailto:admin@printyx.com?subject=Report Access Request', '_blank')}
                  className="flex-1"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Admin
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-900 mb-1">
                  Need Different Reports?
                </h3>
                <p className="text-xs text-blue-800">
                  Try accessing reports that match your role permissions, or request 
                  additional access from your manager.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Higher-order component for easy route protection
export function withReportProtection<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission: 'sales' | 'service' | 'finance' | 'executive',
  options?: {
    fallbackMessage?: string;
    showContactAdmin?: boolean;
  }
) {
  const ProtectedComponent = (props: P) => {
    return (
      <ProtectedReportRoute 
        requiredPermission={requiredPermission}
        fallbackMessage={options?.fallbackMessage}
        showContactAdmin={options?.showContactAdmin}
      >
        <Component {...props} />
      </ProtectedReportRoute>
    );
  };

  ProtectedComponent.displayName = `withReportProtection(${Component.displayName || Component.name})`;
  
  return ProtectedComponent;
}

// Hook for checking multiple permissions at once
export function useReportPermissions() {
  const rbac = useRBAC();
  
  return {
    sales: rbacUtils.canAccessSalesReports(rbac),
    service: rbacUtils.canAccessServiceReports(rbac),
    finance: rbacUtils.canAccessFinancialReports(rbac),
    executive: rbacUtils.canAccessExecutiveReports(rbac),
    canExport: rbac.hasPermission('reports:*', 'export'),
    canManage: rbac.hasPermission('reports:*', 'create'),
    territories: rbac.getAllowedTerritories(),
    teamMembers: rbac.getAllowedTeamMembers()
  };
}

// Component for showing permission-based UI elements
interface ConditionalRenderProps {
  children: React.ReactNode;
  requiredPermission: string;
  action?: string;
  fallback?: React.ReactNode;
}

export function ConditionalRender({ 
  children, 
  requiredPermission, 
  action = 'read',
  fallback = null 
}: ConditionalRenderProps) {
  const rbac = useRBAC();
  
  if (rbac.hasPermission(requiredPermission, action)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}