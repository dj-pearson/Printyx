/**
 * Supabase Auth Hook
 * Manages authentication state using Supabase GoTrue
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { apiRequest } from '@/lib/queryClient';
import { config } from '@/lib/config';
import type { Session, User } from '@supabase/supabase-js';

type RolePermissions = Record<string, boolean>;

function defaultRolePermissions(): RolePermissions {
  return {
    sales: true,
    service: true,
    products: true,
    inventory: true,
    purchasing: true,
    billing: true,
    finance: true,
    reports: true,
    system: true,
  };
}

function normalizePermissions(input: unknown): RolePermissions {
  if (!input) return {};
  if (Array.isArray(input)) {
    if (input.includes('*')) return defaultRolePermissions();
    const out: RolePermissions = {};
    for (const v of input) if (typeof v === 'string') out[v] = true;
    return out;
  }
  if (typeof input === 'object') {
    const out: RolePermissions = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) out[k] = Boolean(v);
    return out;
  }
  return {};
}

function getDefaultRole() {
  return {
    id: 'default',
    name: 'User',
    level: 1,
    permissions: defaultRolePermissions(),
    canAccessAllTenants: false,
  };
}

// User profile with app metadata
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tenantId?: string;
  roleId?: string;
  teamId?: string;
  accessScope?: string;
  isPlatformUser?: boolean;
  role?: {
    id: string;
    name: string;
    level: number;
  };
  team?: {
    id: string;
    name: string;
  };
}

// Transform Supabase user to AuthUser
function transformUser(user: User | null): AuthUser | null {
  if (!user) return null;

  const metadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};

  return {
    id: user.id,
    email: user.email || '',
    firstName: metadata.firstName || metadata.first_name,
    lastName: metadata.lastName || metadata.last_name,
    tenantId: appMetadata.tenantId,
    roleId: appMetadata.roleId,
    teamId: appMetadata.teamId,
    accessScope: appMetadata.accessScope || 'own',
    isPlatformUser: appMetadata.isPlatformUser || false,
  };
}

export function useSupabaseAuth() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize and listen for auth changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitialized(true);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Invalidate user query on auth change
      queryClient.invalidateQueries({ queryKey: ['supabase-auth-user'] });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Fetch extended user profile from users table (optional, for role/team data)
  const {
    data: userProfile,
    isLoading: isProfileLoading,
    error,
  } = useQuery({
    queryKey: ['supabase-auth-user', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;

      // First, get the basic user from Supabase Auth
      const authUser = transformUser(session.user);
      if (!authUser) return null;

      // Prefer fetching profile/role/team from the app server (avoids Supabase PostgREST RLS issues).
      // In production, if no app API base URL is configured, /api/* will be served by the static site
      // and return HTML. In that case, use a Supabase Edge Function (/me) to hydrate role/permissions.
      try {
        // If the app API is configured, use it.
        if (!(config.isProduction && !config.apiBaseUrl)) {
          const me = await apiRequest('/api/me', 'GET');

          const merged: any = {
            ...authUser,
            firstName: me?.firstName || authUser.firstName,
            lastName: me?.lastName || authUser.lastName,
            tenantId: me?.tenantId || authUser.tenantId,
            roleId: me?.roleId || authUser.roleId,
            teamId: me?.teamId || authUser.teamId,
            accessScope: me?.accessScope || authUser.accessScope,
            isPlatformUser: me?.isPlatformUser ?? authUser.isPlatformUser,
            role: me?.role || authUser.role,
            team: me?.team || authUser.team,
          };

          // Ensure role shape is compatible with navigation
          if (merged.role) {
            merged.role = {
              ...merged.role,
              permissions:
                normalizePermissions((merged.role as any).permissions) || defaultRolePermissions(),
              canAccessAllTenants: Boolean(
                (merged.role as any).canAccessAllTenants ??
                  (merged.role as any).can_access_all_tenants,
              ),
              level: (merged.role as any).level ?? 1,
              name: (merged.role as any).name ?? 'User',
              id: (merged.role as any).id ?? 'default',
            };
          } else {
            merged.role = getDefaultRole();
          }

          return merged;
        }

        // No app API in production: use Supabase Edge Function if configured
        const functionsUrl = config.supabase.functionsUrl;
        if (functionsUrl && session?.access_token) {
          const resp = await fetch(`${functionsUrl}/me`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: config.supabase.anonKey,
              'Content-Type': 'application/json',
            },
          });

          if (resp.ok) {
            const me = await resp.json();
            const role = me?.role
              ? {
                  ...me.role,
                  permissions:
                    normalizePermissions(me.role.permissions) || defaultRolePermissions(),
                  canAccessAllTenants: Boolean(
                    me.role.canAccessAllTenants ?? me.role.can_access_all_tenants,
                  ),
                }
              : getDefaultRole();

            return {
              ...authUser,
              firstName: me?.firstName || authUser.firstName,
              lastName: me?.lastName || authUser.lastName,
              tenantId: me?.tenantId || authUser.tenantId,
              roleId: me?.roleId || authUser.roleId,
              teamId: me?.teamId || authUser.teamId,
              accessScope: me?.accessScope || authUser.accessScope,
              isPlatformUser: me?.isPlatformUser ?? authUser.isPlatformUser,
              role,
              team: me?.team || null,
            };
          }
        }

        // If neither app API nor edge function worked, fall back.
        throw new Error('PROFILE_HYDRATION_UNAVAILABLE');
      } catch (err) {
        // Fallback to auth user with default role if fetch fails.
        if (!(err instanceof Error && err.message === 'PROFILE_HYDRATION_UNAVAILABLE')) {
          console.warn('Profile fetch error, using auth metadata:', err);
        }
        return {
          ...authUser,
          role: getDefaultRole(),
        };
      }
    },
    enabled: !!session?.user?.id && isInitialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }, []);

  // Signup function (basic - for full signup use Edge Function)
  const signup = useCallback(
    async (email: string, password: string, metadata?: Record<string, any>) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    [],
  );

  // Logout function
  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    // Clear any cached data
    queryClient.clear();
  }, [queryClient]);

  // Password reset request
  const resetPassword = useCallback(async (email: string) => {
    // Redirect to auth/callback which will handle the recovery flow
    // and then redirect to /reset-password
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      throw new Error(error.message);
    }
  }, []);

  // Update password (after reset)
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  }, []);

  // Get access token for API calls
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  return {
    user: userProfile,
    session,
    isLoading: !isInitialized || isProfileLoading,
    isAuthenticated: !!session && !!userProfile,
    error,
    // Auth methods
    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
    getAccessToken,
  };
}
