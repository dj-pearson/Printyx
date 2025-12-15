/**
 * Auth Hook - Re-exports useAuthContext for backward compatibility
 *
 * This hook previously used legacy Express session-based auth.
 * Now it wraps useAuthContext which uses Supabase GoTrue authentication.
 */

import { useAuthContext } from '@/providers/AuthProvider';

export function useAuth() {
  const auth = useAuthContext();

  return {
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    error: auth.error,
  };
}
