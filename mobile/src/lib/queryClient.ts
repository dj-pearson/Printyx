/**
 * TanStack Query Client for Mobile
 *
 * Configured with the same patterns as the web app but adapted
 * for mobile-specific needs (offline support, background refetch).
 */

import { QueryClient } from '@tanstack/react-query';
import { createQueryFn, ApiError } from './api';

export const queryClient = new QueryClient({
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
