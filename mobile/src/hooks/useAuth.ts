/**
 * Auth Hook - Same interface as web useAuth
 */

import { useAuthContext } from '@/providers/AuthProvider';

export function useAuth() {
  const auth = useAuthContext();

  return {
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    error: auth.error,
    login: auth.login,
    signup: auth.signup,
    logout: auth.logout,
    resetPassword: auth.resetPassword,
    updatePassword: auth.updatePassword,
  };
}
