/**
 * Authentication Provider for Printyx Mobile
 *
 * Wraps the app with Supabase GoTrue auth state management.
 * Provides the same interface as the web AuthProvider.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setTenantId, clearTenantId } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (data: SignupData) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  getAccessToken: () => Promise<string | null>;
}

export interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  industry?: string;
  companySize?: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          // Extract and store tenant ID from JWT metadata
          const tenantId = currentSession?.user?.app_metadata?.tenantId;
          if (tenantId) {
            await setTenantId(tenantId);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize auth');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setError(null);

        if (newSession?.user?.app_metadata?.tenantId) {
          await setTenantId(newSession.user.app_metadata.tenantId);
        }

        if (event === 'SIGNED_OUT') {
          await clearTenantId();
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Auto-refresh token when app comes to foreground
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
        return { error: authError.message };
      }
      return {};
    } catch (err) {
      const message = err instanceof AuthError ? err.message : 'Login failed';
      setError(message);
      return { error: message };
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    try {
      setError(null);
      // Call the Edge Function for signup (same as web)
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://api.printyx.net'}/functions/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Signup failed' }));
        const message = body.message || 'Signup failed';
        setError(message);
        return { error: message };
      }

      // Auto-login after successful signup
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (loginError) {
        return { error: 'Account created. Please verify your email and log in.' };
      }

      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      return { error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    await clearTenantId();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'printyx://reset-password',
      });
      if (resetError) {
        return { error: resetError.message };
      }
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Password reset failed' };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        return { error: updateError.message };
      }
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Password update failed' };
    }
  }, []);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!session,
        error,
        login,
        signup,
        logout,
        resetPassword,
        updatePassword,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
