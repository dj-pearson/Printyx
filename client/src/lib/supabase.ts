/**
 * Supabase Client Configuration
 * Uses custom domains for production deployment
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Create Supabase client with custom domain configuration
export const supabase = createClient(
  config.supabase.url, // https://api.printyx.net in production
  config.supabase.anonKey,
  {
    auth: {
      // Use custom domain for auth endpoints
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    // Optional: Configure realtime if needed
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

// Export types for convenience
export type { User, Session } from '@supabase/supabase-js';
