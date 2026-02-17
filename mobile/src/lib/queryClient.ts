/**
 * TanStack Query Client for Mobile
 *
 * Configured with the same patterns as the web app but adapted
 * for mobile-specific needs (offline support, background refetch).
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { createQueryFn, ApiError } from './api';
import { supabase } from './supabase';

let _signingOut = false;

/**
 * Global handler for 401 errors: sign the user out once
 * so they get redirected to login cleanly instead of looping.
 */
function handleAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && !_signingOut) {
    _signingOut = true;
    supabase.auth.signOut().finally(() => {
      _signingOut = false;
    });
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleAuthError,
  }),
  mutationCache: new MutationCache({
    onError: handleAuthError,
  }),
  defaultOptions: {
    queries: {
      queryFn: createQueryFn('throw'),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false, // Not applicable on mobile
      retry: (failureCount, error) => {
        // Don't retry on auth or client errors
        if (error instanceof ApiError) {
          if ([401, 403, 404, 422].includes(error.status)) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
    },
  },
});
