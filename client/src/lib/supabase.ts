/**
 * Supabase Client Configuration
 * Uses custom domains for production deployment with PKCE auth flow
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Custom fetch that doesn't include credentials to avoid CORS issues with wildcard origins
const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  return fetch(url, {
    ...options,
    credentials: 'omit', // Don't send cookies - use Bearer token auth instead
  });
};

// Create Supabase client with custom domain configuration
export const supabase = createClient(
  config.supabase.url, // https://api.printyx.net in production
  config.supabase.anonKey,
  {
    auth: {
      // PKCE flow for secure authentication
      flowType: 'pkce',
      // Auto-refresh tokens before expiry
      autoRefreshToken: true,
      // Persist session in localStorage
      persistSession: true,
      // Detect OAuth callbacks in URL
      detectSessionInUrl: true,
      // Storage key for session
      storageKey: 'printyx-auth',
    },
    // Global configuration
    global: {
      headers: {
        'x-client-info': 'printyx-web',
      },
      // Use custom fetch to avoid CORS issues with credentials
      fetch: customFetch,
    },
    // Realtime configuration
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);

// Helper to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
}

// Helper to get current user
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Helper to get access token for API calls
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Helper to refresh session
export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.error('Failed to refresh session:', error);
    return null;
  }
  return data.session;
}

// Export types for convenience
export type { User, Session } from '@supabase/supabase-js';
