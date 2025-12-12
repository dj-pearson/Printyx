/**
 * Unified Auth Provider
 * Supports hybrid authentication mode (legacy Express sessions + Supabase GoTrue)
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth as useLegacyAuth } from '@/hooks/useAuth';
import { useSupabaseAuth, type AuthUser } from '@/hooks/useSupabaseAuth';
import { config, type AuthMode } from '@/lib/config';
import { apiRequest } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authMode: AuthMode;
  error: Error | null;
  // Auth methods
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  industry?: string;
  companySize?: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const authMode = config.authMode;

  // Both auth systems for hybrid mode
  const legacyAuth = useLegacyAuth();
  const supabaseAuth = useSupabaseAuth();

  // Transform legacy user to AuthUser format
  const transformLegacyUser = useCallback((legacyUser: any): AuthUser | null => {
    if (!legacyUser) return null;
    return {
      id: legacyUser.id,
      email: legacyUser.email,
      firstName: legacyUser.firstName,
      lastName: legacyUser.lastName,
      tenantId: legacyUser.tenantId,
      roleId: legacyUser.roleId,
      teamId: legacyUser.teamId,
      accessScope: legacyUser.accessScope,
      isPlatformUser: legacyUser.isPlatformUser,
      role: legacyUser.role,
      team: legacyUser.team,
    };
  }, []);

  // Legacy auth methods
  const legacyLogin = useCallback(
    async (email: string, password: string) => {
      await apiRequest('/api/auth/login', 'POST', { email, password });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    [queryClient],
  );

  const legacyLogout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', 'POST');
    } catch (error) {
      // Ignore logout errors
    }
    localStorage.removeItem('printyx_auth_user');
    localStorage.removeItem('printyx_last_route');
    queryClient.clear();
    window.location.href = '/login';
  }, [queryClient]);

  const legacySignup = useCallback(async (data: SignupData) => {
    await apiRequest('/api/auth/signup', 'POST', data);
  }, []);

  const legacyResetPassword = useCallback(async (email: string) => {
    await apiRequest('/api/auth/forgot-password', 'POST', { email });
  }, []);

  // Build context value based on auth mode
  const value = useMemo((): AuthContextValue => {
    // Supabase-only mode
    if (authMode === 'supabase') {
      return {
        user: supabaseAuth.user,
        isLoading: supabaseAuth.isLoading,
        isAuthenticated: supabaseAuth.isAuthenticated,
        authMode,
        error: supabaseAuth.error as Error | null,
        login: supabaseAuth.login,
        logout: supabaseAuth.logout,
        signup: async (data: SignupData) => {
          // For full signup with tenant creation, use Edge Function
          const functionsUrl = config.supabase.functionsUrl;
          if (functionsUrl) {
            const response = await fetch(`${functionsUrl}/signup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'Signup failed');
            }
          } else {
            // Fallback to basic Supabase signup
            await supabaseAuth.signup(data.email, data.password, {
              firstName: data.firstName,
              lastName: data.lastName,
            });
          }
        },
        resetPassword: supabaseAuth.resetPassword,
        updatePassword: supabaseAuth.updatePassword,
        getAccessToken: supabaseAuth.getAccessToken,
      };
    }

    // Hybrid mode - try Supabase first, fall back to legacy
    if (authMode === 'hybrid') {
      const isSupabaseAuth = !!supabaseAuth.session;
      const isLegacyAuth = !!legacyAuth.user && !isSupabaseAuth;

      return {
        user: isSupabaseAuth ? supabaseAuth.user : transformLegacyUser(legacyAuth.user),
        isLoading: supabaseAuth.isLoading || legacyAuth.isLoading,
        isAuthenticated: isSupabaseAuth ? supabaseAuth.isAuthenticated : legacyAuth.isAuthenticated,
        authMode,
        error: (supabaseAuth.error || legacyAuth.error) as Error | null,
        login: async (email: string, password: string) => {
          // Try Supabase first
          try {
            await supabaseAuth.login(email, password);
            return;
          } catch (supabaseError) {
            console.log('Supabase auth failed, trying legacy:', supabaseError);
          }

          // Fall back to legacy
          await legacyLogin(email, password);
        },
        logout: async () => {
          // Logout from both systems
          const promises: Promise<void>[] = [];

          if (isSupabaseAuth) {
            promises.push(supabaseAuth.logout());
          }

          if (isLegacyAuth || !isSupabaseAuth) {
            promises.push(legacyLogout());
          }

          await Promise.allSettled(promises);

          // Force redirect to login
          window.location.href = '/login';
        },
        signup: async (data: SignupData) => {
          // Use Supabase for new signups in hybrid mode
          const functionsUrl = config.supabase.functionsUrl;
          if (functionsUrl) {
            const response = await fetch(`${functionsUrl}/signup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'Signup failed');
            }
          } else {
            // Fall back to legacy signup
            await legacySignup(data);
          }
        },
        resetPassword: async (email: string) => {
          // Try Supabase first
          try {
            await supabaseAuth.resetPassword(email);
            return;
          } catch {
            // Fall back to legacy
            await legacyResetPassword(email);
          }
        },
        updatePassword: supabaseAuth.updatePassword,
        getAccessToken: supabaseAuth.getAccessToken,
      };
    }

    // Legacy mode (default)
    return {
      user: transformLegacyUser(legacyAuth.user),
      isLoading: legacyAuth.isLoading,
      isAuthenticated: legacyAuth.isAuthenticated,
      authMode,
      error: legacyAuth.error as Error | null,
      login: legacyLogin,
      logout: legacyLogout,
      signup: legacySignup,
      resetPassword: legacyResetPassword,
      updatePassword: async () => {
        throw new Error('Password update requires Supabase auth mode');
      },
      getAccessToken: async () => null, // Legacy uses cookies, not tokens
    };
  }, [
    authMode,
    legacyAuth,
    supabaseAuth,
    transformLegacyUser,
    legacyLogin,
    legacyLogout,
    legacySignup,
    legacyResetPassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

// Re-export for convenience
export type { AuthUser, SignupData };
