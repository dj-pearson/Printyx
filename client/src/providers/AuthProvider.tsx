/**
 * Supabase Auth Provider
 *
 * Provides authentication context using Supabase GoTrue.
 * Handles: login, logout, signup (via Edge Function), password reset.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseAuth, type AuthUser } from '@/hooks/useSupabaseAuth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  // Auth methods
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<unknown>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const supabaseAuth = useSupabaseAuth();

  // Round 231. This used to be a SECOND signup implementation taking one
  // object - (data) => fetch(`${functionsUrl}/signup`) - while Signup.tsx, its
  // only caller, calls signup(email, password, metadata). So `data` was the
  // email string, data.email and data.password were undefined, and every
  // self-service registration posted an empty email and password. LAUNCH-008
  // fixed useSupabaseAuth.signup; the page never reached it. There is one
  // implementation now, and the context passes it through.
  const signup = supabaseAuth.signup;

  // Logout handler
  const logout = useCallback(async () => {
    try {
      // Sign out from Supabase
      await supabaseAuth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear ALL local storage items related to auth
    localStorage.removeItem('printyx_auth_user');
    localStorage.removeItem('printyx_last_route');
    localStorage.removeItem('printyx-auth'); // Supabase session storage key

    // Also clear any other Supabase storage keys (they use this pattern)
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') || key.includes('supabase') || key.includes('printyx')) {
        localStorage.removeItem(key);
      }
    });

    // Clear query cache
    queryClient.clear();

    // Force redirect to login page (use replace to prevent back button)
    window.location.replace('/login');
  }, [supabaseAuth, queryClient]);

  // Build context value
  const value = useMemo((): AuthContextValue => {
    return {
      user: supabaseAuth.user ?? null,
      isLoading: supabaseAuth.isLoading,
      isAuthenticated: supabaseAuth.isAuthenticated,
      error: supabaseAuth.error as Error | null,
      // Context contract is Promise<void>; discard the Supabase session payload.
      login: async (email: string, password: string) => {
        await supabaseAuth.login(email, password);
      },
      logout,
      signup,
      resetPassword: supabaseAuth.resetPassword,
      updatePassword: supabaseAuth.updatePassword,
      getAccessToken: supabaseAuth.getAccessToken,
    };
  }, [supabaseAuth, logout, signup]);

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
export type { AuthUser };
