/**
 * Supabase Auth Hook
 * Manages authentication state using Supabase GoTrue
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { apiRequest } from '@/lib/queryClient';
import { config, getApiUrl } from '@/lib/config';
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
  const [sessionChecked, setSessionChecked] = useState(false);

  // Initialize and listen for auth changes
  useEffect(() => {
    let mounted = true;

    // Get initial session first, then set up listener
    // This prevents race condition where listener fires before initial session is set
    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setSessionChecked(true);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to get initial session:', error);
        if (mounted) {
          setSession(null);
          setSessionChecked(true);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        // Invalidate user query on auth change
        queryClient.invalidateQueries({ queryKey: ['supabase-auth-user'] });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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

      // Fetch user profile and role data
      try {
        let profile: any = null;
        let profileError: any = null;

        // Try direct Supabase query first
        const supabaseResult = await supabase
          .from('users')
          .select(
            'id, email, first_name, last_name, tenant_id, role_id, team_id, profile_image_url',
          )
          .eq('id', session.user.id)
          .single();

        profile = supabaseResult.data;
        profileError = supabaseResult.error;

        // If Supabase query fails (likely due to RLS), fallback to backend API
        if (profileError) {
          console.warn(
            'Direct Supabase query failed (likely RLS policy), trying backend API:',
            profileError.message,
          );

          try {
            // Get access token for API call
            const {
              data: { session: currentSession },
            } = await supabase.auth.getSession();

            if (currentSession?.access_token) {
              // Call backend API to fetch user profile
              const apiUrl = getApiUrl('me');
              const response = await fetch(apiUrl, {
                headers: {
                  Authorization: `Bearer ${currentSession.access_token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                profile = await response.json();
                profileError = null;
                console.log('✅ User profile fetched from backend API successfully');
              } else {
                console.warn('Backend API also failed:', response.status, response.statusText);
              }
            }
          } catch (apiError) {
            console.warn('Backend API error:', apiError);
          }
        }

        if (!profile && profileError) {
          console.warn('No user profile found from any source, using auth metadata');
        }

        // Determine role - use role_id (FK) column
        const roleId = profile?.role_id || authUser.roleId;
        let roleData = null;
        const roleString = null; // Legacy role string no longer used

        // First try to fetch from roles table if we have role_id
        if (roleId) {
          const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('id, name, level, permissions, can_access_all_tenants')
            .eq('id', roleId)
            .single();

          if (!roleError && role) {
            roleData = {
              id: role.id,
              name: role.name,
              level: role.level || 1,
              permissions: role.permissions || {},
              canAccessAllTenants: role.can_access_all_tenants || false,
            };
          } else {
            console.warn('Could not fetch role data:', roleError?.message);
          }
        }

        // If no role from roles table, use role string to determine permissions
        if (!roleData && roleString) {
          // Map string role to permissions
          const roleLowerCase = roleString.toLowerCase();

          // Determine if this is an admin role
          const isAdmin =
            roleLowerCase === 'admin' ||
            roleLowerCase === 'root_admin' ||
            roleLowerCase === 'platform_admin' ||
            roleLowerCase === 'company_admin' ||
            roleLowerCase === 'system_admin';

          // Determine role level based on role string
          let level = 1;
          if (
            roleLowerCase === 'admin' ||
            roleLowerCase === 'root_admin' ||
            roleLowerCase === 'platform_admin'
          ) {
            level = 8; // Platform admin level
          } else if (roleLowerCase === 'company_admin' || roleLowerCase === 'director') {
            level = 7; // Company admin level
          } else if (
            roleLowerCase === 'manager' ||
            roleLowerCase === 'sales_manager' ||
            roleLowerCase === 'service_manager'
          ) {
            level = 5; // Manager level
          } else if (roleLowerCase === 'team_lead') {
            level = 3;
          } else if (roleLowerCase === 'technician' || roleLowerCase === 'sales_rep') {
            level = 2;
          }

          roleData = {
            id: roleString,
            name: roleString,
            level: level,
            permissions: {
              sales: true,
              service: true,
              products: true,
              inventory: true,
              billing: isAdmin,
              reports: true,
              admin: isAdmin,
              users: isAdmin,
              settings: isAdmin,
            },
            canAccessAllTenants: isAdmin,
          };

          console.log(`Using role string '${roleString}' - level ${level}, isAdmin: ${isAdmin}`);
        }

        // Get team data if we have a team_id
        const teamId = profile?.team_id || authUser.teamId;
        let teamData = null;

        if (teamId) {
          const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('id', teamId)
            .single();

          if (!teamError && team) {
            teamData = {
              id: team.id,
              name: team.name,
            };
          }
        }

        // If still no role found, provide a default role for navigation
        if (!roleData) {
          console.warn('No role found (neither role string nor role_id), using default user role');
          roleData = {
            id: 'default',
            name: 'User',
            level: 1,
            permissions: {
              sales: true,
              service: true,
              products: true,
              inventory: true,
              billing: true,
              reports: true,
            },
            canAccessAllTenants: false,
          };
        }

        // Detect isPlatformUser based on role or explicit flag from auth metadata
        const isPlatformUser =
          authUser.isPlatformUser ||
          roleData.level >= 8 ||
          roleString?.toLowerCase().includes('admin') ||
          roleString?.toLowerCase().includes('root') ||
          roleString?.toLowerCase().includes('platform');

        // Merge profile data with auth user
        return {
          ...authUser,
          firstName: profile?.first_name || authUser.firstName,
          lastName: profile?.last_name || authUser.lastName,
          tenantId: profile?.tenant_id || authUser.tenantId,
          roleId: profile?.role_id || authUser.roleId,
          teamId: profile?.team_id || authUser.teamId,
          accessScope: authUser.accessScope || 'own', // Use auth metadata or default
          isPlatformUser: isPlatformUser,
          role: roleData,
          team: teamData,
        };
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
    try {
      // Sign out from Supabase (this should clear the session from storage)
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
        throw new Error(error.message);
      }

      // Clear any cached data
      queryClient.clear();

      console.log('✅ Successfully signed out from Supabase');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
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

  // Determine authentication status
  // User is authenticated if we have a valid session (profile is optional enhancement)
  // This prevents false-negative when profile fetch fails due to RLS or network issues
  const hasValidSession = !!session && sessionChecked;
  const isFullyLoaded = hasValidSession && !!userProfile;

  return {
    user: userProfile,
    session,
    // Loading while initializing or while we have a session but profile is still loading
    isLoading: !isInitialized || (hasValidSession && isProfileLoading),
    // Authenticated if we have a valid session (profile enhances but isn't required)
    isAuthenticated: hasValidSession,
    // Fully authenticated with profile data loaded
    isFullyAuthenticated: isFullyLoaded,
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
