/**
 * RoleBasedDashboard - Main Dashboard Orchestrator
 *
 * This is the primary dashboard component that:
 * 1. Detects the user's role from auth context
 * 2. Loads their saved layout (or falls back to role defaults)
 * 3. Renders the DashboardBuilder with proper permissions
 * 4. Handles layout persistence (save/load from backend)
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { DashboardBuilder } from './DashboardBuilder';
import {
  getDefaultLayout,
  resolveRoleLayoutKey,
  type LayoutWidgetConfig,
} from '@/lib/dashboard-widget-registry';
import { apiRequest } from '@/lib/queryClient';
import { DashboardSkeleton } from '@/components/ui/skeletons';

export function RoleBasedDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { level, isPlatformUser, roleCode, permissions, isLoaded } = usePermissions();
  const queryClient = useQueryClient();

  // Resolve the effective role code (WF-R-10).
  //
  // The resolution moved into dashboard-widget-registry.ts so it can be tested
  // against every code migration 0072 seeds without mounting this component.
  // What lived here tested `if (roleCode)` first, and roleCode was always
  // truthy, so nothing below that line had ever run.
  const effectiveRoleCode = useMemo(
    () =>
      resolveRoleLayoutKey({
        code: roleCode || user?.role?.code,
        level,
        department: user?.role?.department,
        isPlatformUser,
      }),
    [user, level, isPlatformUser, roleCode],
  );

  // Load user's saved layout from backend
  const { data: savedLayout, isLoading: layoutLoading } = useQuery({
    queryKey: ['/api/dashboard/user-layout'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/dashboard/user-layout');
      } catch {
        // Endpoint may not exist in production (Edge Function not deployed)
        return null;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Save layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: async (layout: LayoutWidgetConfig[]) => {
      return apiRequest('/api/dashboard/user-layout', 'PUT', { layout });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/user-layout'] });
    },
  });

  // Determine initial layout: saved > role default
  const initialLayout = useMemo(() => {
    const saved = savedLayout as any;
    if (saved?.layout && Array.isArray(saved.layout) && saved.layout.length > 0) {
      return saved.layout as LayoutWidgetConfig[];
    }
    return getDefaultLayout(effectiveRoleCode);
  }, [savedLayout, effectiveRoleCode]);

  // Save handler
  const handleSaveLayout = useCallback(
    async (layout: LayoutWidgetConfig[]) => {
      await saveLayoutMutation.mutateAsync(layout);
    },
    [saveLayoutMutation],
  );

  // Loading state
  if (authLoading || layoutLoading || !isLoaded) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <DashboardBuilder
        roleCode={effectiveRoleCode}
        level={level}
        permissions={permissions}
        isPlatformUser={isPlatformUser}
        initialLayout={initialLayout}
        onSaveLayout={handleSaveLayout}
      />
    </div>
  );
}
