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
      // and return HTML. In that case, skip the server profile call and use JWT metadata.
      try {
        if (config.isProduction && !config.apiBaseUrl) {
          throw new Error('APP_API_NOT_CONFIGURED');
        }

        const me = await apiRequest('/api/me', 'GET');

        // Merge server profile with auth user (auth user as fallback)
        const merged = {
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

        // If server didn't provide role, provide a default role for navigation
        if (!merged.role) {
          console.warn('No role found, using default user role');
          merged.role = {
            id: 'default',
            name: 'User',
            level: 1,
          };
        }

        return merged;
      } catch (err) {
        // Fallback to auth user with default role if fetch fails.
        // Avoid noisy logs when the app API isn't configured in production.
        if (!(err instanceof Error && err.message === 'APP_API_NOT_CONFIGURED')) {
          console.warn('Profile fetch error, using auth metadata:', err);
        }
        return {
          ...authUser,
          role: {
            id: 'default',
            name: 'User',
            level: 1,
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
