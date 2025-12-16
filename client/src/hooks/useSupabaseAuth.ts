/**
 * Supabase Auth Hook
 * Manages authentication state using Supabase GoTrue
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

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

      // Fetch user profile and role data separately (avoids PostgREST join issues)
      try {
        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.warn('No user profile found, using auth metadata');
        }

        // Get role data if we have a role_id
        const roleId = profile?.role_id || authUser.roleId;
        let roleData = null;

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

        // If no role found in DB, provide a default role for navigation
        if (!roleData) {
          console.warn('No role found, using default user role');
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

        // Merge profile data with auth user
        return {
          ...authUser,
          firstName: profile?.first_name || authUser.firstName,
          lastName: profile?.last_name || authUser.lastName,
          tenantId: profile?.tenant_id || authUser.tenantId,
          roleId: profile?.role_id || authUser.roleId,
          teamId: profile?.team_id || authUser.teamId,
          accessScope: profile?.access_scope || authUser.accessScope,
          isPlatformUser: profile?.is_platform_user || authUser.isPlatformUser,
          role: roleData,
          team: teamData,
        };
      } catch (err) {
        // Fallback to auth user with default role if fetch fails
        console.warn('Profile fetch error, using auth metadata:', err);
        return {
          ...authUser,
          role: {
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
          },
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
