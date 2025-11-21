/**
 * React Query Performance & Caching Optimizations
 * Addresses: polling inconsistencies, pagination, optimistic updates, cache strategies
 */

import { QueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { queryClient } from './queryClient';

// ============= PERFORMANCE CONSTANTS =============

export const CACHE_TIMES = {
  // User session data - rarely changes
  USER_SESSION: 15 * 60 * 1000, // 15 minutes
  
  // Static/reference data - changes infrequently  
  STATIC_DATA: 60 * 60 * 1000, // 1 hour
  PRODUCT_CATALOG: 30 * 60 * 1000, // 30 minutes
  VENDOR_INFO: 45 * 60 * 1000, // 45 minutes
  
  // Business data - moderate update frequency
  CUSTOMER_DATA: 10 * 60 * 1000, // 10 minutes
  INVENTORY: 5 * 60 * 1000, // 5 minutes
  FINANCIAL_DATA: 15 * 60 * 1000, // 15 minutes
  
  // Real-time critical data - frequent updates
  SERVICE_TICKETS: 2 * 60 * 1000, // 2 minutes
  DASHBOARD_METRICS: 3 * 60 * 1000, // 3 minutes
  ALERTS: 1 * 60 * 1000, // 1 minute
  
  // Live operational data
  REAL_TIME: 30 * 1000, // 30 seconds
} as const;

export const POLLING_INTERVALS = {
  // Standardized polling intervals to prevent inconsistency
  CRITICAL: 30 * 1000,     // 30s - alerts, active incidents
  HIGH: 60 * 1000,         // 1min - dashboard metrics, service tickets
  MEDIUM: 5 * 60 * 1000,   // 5min - inventory, equipment status  
  LOW: 15 * 60 * 1000,     // 15min - reports, analytics
  BACKGROUND: 30 * 60 * 1000, // 30min - background sync
} as const;

// ============= PAGINATION CONFIGURATION =============

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 25,
  LARGE_PAGE_SIZE: 50,
  SMALL_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============= SMART CACHING STRATEGIES =============

export const getCacheConfig = (dataType: keyof typeof CACHE_TIMES) => ({
  staleTime: CACHE_TIMES[dataType],
  cacheTime: CACHE_TIMES[dataType] * 2, // Keep in cache 2x longer than stale time
  refetchOnWindowFocus: dataType === 'REAL_TIME' || dataType === 'ALERTS',
  refetchOnMount: true,
  refetchOnReconnect: true,
});

export const getPollingConfig = (priority: keyof typeof POLLING_INTERVALS, enabled = true) => ({
  refetchInterval: enabled ? POLLING_INTERVALS[priority] : false,
  refetchIntervalInBackground: priority === 'CRITICAL',
});

// ============= OPTIMIZED QUERY HOOKS =============

export const createOptimizedQuery = <T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options?: {
    cacheType?: keyof typeof CACHE_TIMES;
    pollingPriority?: keyof typeof POLLING_INTERVALS;
    enablePolling?: boolean;
    enabled?: boolean;
  }
): UseQueryOptions<T> => {
  const { 
    cacheType = 'CUSTOMER_DATA', 
    pollingPriority, 
    enablePolling = false, 
    enabled = true 
  } = options || {};

  return {
    queryKey,
    queryFn,
    enabled,
    ...getCacheConfig(cacheType),
    ...(pollingPriority && enablePolling ? getPollingConfig(pollingPriority, enabled) : {}),
  };
};

// ============= PAGINATION UTILITIES =============

export const createPaginatedQuery = <T>(
  baseQueryKey: any[],
  endpoint: string,
  params: PaginationParams = {}
) => {
  const { 
    page = 1, 
    limit = PAGINATION_DEFAULTS.PAGE_SIZE,
    sortBy = 'createdAt',
    sortDirection = 'desc',
    search,
    filters 
  } = params;

  const queryKey = [
    ...baseQueryKey,
    { page, limit, sortBy, sortDirection, search, filters }
  ];

  const queryFn = async (): Promise<PaginatedResponse<T>> => {
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: Math.min(limit, PAGINATION_DEFAULTS.MAX_PAGE_SIZE).toString(),
      sortBy,
      sortDirection,
      ...(search && { search }),
      ...(filters && Object.entries(filters).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = value.toString();
        }
        return acc;
      }, {} as Record<string, string>))
    });

    const response = await fetch(`${endpoint}?${searchParams}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }

    return await response.json();
  };

  return { queryKey, queryFn };
};

// ============= OPTIMISTIC UPDATE UTILITIES =============

export const createOptimisticMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    queryKeyToInvalidate: any[];
    optimisticUpdateFn?: (oldData: any, variables: TVariables) => any;
    successMessage?: string;
    errorMessage?: string;
  }
): UseMutationOptions<TData, Error, TVariables> => {
  const { queryKeyToInvalidate, optimisticUpdateFn, successMessage, errorMessage } = options;

  return {
    mutationFn,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeyToInvalidate });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKeyToInvalidate);

      // Optimistically update if function provided
      if (optimisticUpdateFn && previousData) {
        queryClient.setQueryData(queryKeyToInvalidate, optimisticUpdateFn(previousData, variables));
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeyToInvalidate, context.previousData);
      }
      console.error(errorMessage || 'Mutation failed:', err);
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
      if (successMessage) {
        console.log(successMessage);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
    },
  };
};

// ============= CACHE INVALIDATION STRATEGIES =============

export const invalidationGroups = {
  // Related data that should be invalidated together
  CUSTOMER_DATA: [
    ['/api/customers'],
    ['/api/business-records'],
    ['/api/dashboard/metrics'],
    ['/api/dashboard/top-customers'],
  ],
  
  SERVICE_DATA: [
    ['/api/service-tickets'],
    ['/api/dashboard/recent-tickets'],
    ['/api/dashboard/alerts'],
    ['/api/technicians'],
  ],
  
  INVENTORY_DATA: [
    ['/api/inventory'],
    ['/api/products'],
    ['/api/warehouse-operations'],
    ['/api/purchase-orders'],
  ],
  
  FINANCIAL_DATA: [
    ['/api/invoices'],
    ['/api/accounts-receivable'],
    ['/api/accounts-payable'],
    ['/api/dashboard/metrics'],
  ],
} as const;

export const invalidateRelatedQueries = async (group: keyof typeof invalidationGroups) => {
  const queries = invalidationGroups[group];
  await Promise.all(
    queries.map(queryKey => 
      queryClient.invalidateQueries({ queryKey })
    )
  );
};

// ============= PERFORMANCE MONITORING =============

export const queryPerformanceMetrics = {
  trackQueryTime: (queryKey: any[]) => {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      if (duration > 1000) { // Log slow queries
        console.warn(`Slow query detected: ${queryKey.join('/')} took ${duration.toFixed(2)}ms`);
      }
    };
  },
  
  logCacheStats: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    console.log('Query Cache Stats:', {
      totalQueries: queries.length,
      stalQueries: queries.filter(q => q.isStale()).length,
      fetchingQueries: queries.filter(q => q.isFetching()).length,
    });
  },
};

// Enhanced QueryClient with performance optimizations
export const optimizedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: CACHE_TIMES.CUSTOMER_DATA,
      cacheTime: CACHE_TIMES.CUSTOMER_DATA * 2,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: (failureCount, error: any) => {
        // Smart retry logic
        if (error?.status === 404 || error?.status === 403) return false;
        return failureCount < 3;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
      // Global error handling could be added here
    },
  },
});

// Export the original queryClient for compatibility
// The optimizedQueryClient can be used for future migrations