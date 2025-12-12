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

      // Optionally fetch extended profile from users table
      // This gets role and team details
      try {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select(
            `
            *,
            role:roles(id, name, level),
            team:teams(id, name)
          `,
          )
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          // If no profile exists yet, use auth user data
          console.warn('No extended profile found, using auth metadata');
          return authUser;
        }

        // Merge profile data with auth user
        return {
          ...authUser,
          firstName: profile.first_name || authUser.firstName,
          lastName: profile.last_name || authUser.lastName,
          tenantId: profile.tenant_id || authUser.tenantId,
          roleId: profile.role_id || authUser.roleId,
          teamId: profile.team_id || authUser.teamId,
          accessScope: profile.access_scope || authUser.accessScope,
          isPlatformUser: profile.is_platform_user || authUser.isPlatformUser,
          role: profile.role,
          team: profile.team,
        };
      } catch (err) {
        // Fallback to auth user if profile fetch fails
        console.warn('Profile fetch error, using auth metadata:', err);
        return authUser;
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
