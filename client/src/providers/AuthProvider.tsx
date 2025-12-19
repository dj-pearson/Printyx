/**
 * Supabase Auth Provider
 *
 * Provides authentication context using Supabase GoTrue.
 * Handles: login, logout, signup (via Edge Function), password reset.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseAuth, type AuthUser } from '@/hooks/useSupabaseAuth';
import { config } from '@/lib/config';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
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
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  timezone?: string;
  planSlug?: string;
  billingCycle?: 'monthly' | 'annual';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const supabaseAuth = useSupabaseAuth();

  // Signup via Edge Function (creates tenant + admin user)
  const signup = useCallback(async (data: SignupData) => {
    const functionsUrl = config.supabase.functionsUrl;

    if (!functionsUrl) {
      throw new Error('Edge Functions URL not configured. Set VITE_FUNCTIONS_URL.');
    }

    const response = await fetch(`${functionsUrl}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        metadata: {
          companyName: data.companyName,
          industry: data.industry,
          companySize: data.companySize,
          website: '',
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          country: data.country || 'US',
          timezone: data.timezone || 'America/New_York',
          planSlug: data.planSlug || 'starter',
          billingCycle: data.billingCycle || 'monthly',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Signup failed');
    }

    // Signup successful - user needs to verify email
    return;
  }, []);

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
      user: supabaseAuth.user,
      isLoading: supabaseAuth.isLoading,
      isAuthenticated: supabaseAuth.isAuthenticated,
      error: supabaseAuth.error as Error | null,
      login: supabaseAuth.login,
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
export type { AuthUser, SignupData };
