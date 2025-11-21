/**
 * Custom hook for paginated data fetching with caching optimization
 */

import { useQuery } from '@tanstack/react-query';
import { createPaginatedQuery, PaginationParams, PaginatedResponse, CACHE_TIMES } from '../lib/queryOptimizations';

interface UsePaginatedQueryOptions<T> extends PaginationParams {
  endpoint: string;
  queryKey: any[];
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
  keepPreviousData?: boolean;
}

export function usePaginatedQuery<T>(options: UsePaginatedQueryOptions<T>) {
  const {
    endpoint,
    queryKey,
    enabled = true,
    cacheTime = CACHE_TIMES.CUSTOMER_DATA,
    staleTime = CACHE_TIMES.CUSTOMER_DATA / 2,
    keepPreviousData: keepPrevious = true,
    ...paginationParams
  } = options;

  const { queryKey: paginatedQueryKey, queryFn } = createPaginatedQuery<T>(
    queryKey,
    endpoint,
    paginationParams
  );

  const result = useQuery<PaginatedResponse<T>>({
    queryKey: paginatedQueryKey,
    queryFn,
    enabled,
    staleTime,
    cacheTime,
    placeholderData: keepPrevious ? (previousData: any) => previousData : undefined,
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });

  return {
    ...result,
    // Helper methods for pagination
    currentPage: paginationParams.page || 1,
    pageSize: paginationParams.limit || 25,
    totalItems: result.data?.pagination.totalItems || 0,
    totalPages: result.data?.pagination.totalPages || 0,
    hasNextPage: result.data?.pagination.hasNextPage || false,
    hasPreviousPage: result.data?.pagination.hasPreviousPage || false,
    items: result.data?.data || [],
  };
}

// Specialized hooks for common use cases
export function useCustomersPaginated(params: PaginationParams & { enabled?: boolean } = {}) {
  return usePaginatedQuery({
    endpoint: '/api/business-records',
    queryKey: ['/api/business-records', 'paginated'],
    cacheTime: CACHE_TIMES.CUSTOMER_DATA,
    staleTime: CACHE_TIMES.CUSTOMER_DATA / 2,
    ...params,
  });
}

export function useServiceTicketsPaginated(params: PaginationParams & { enabled?: boolean } = {}) {
  return usePaginatedQuery({
    endpoint: '/api/service-tickets',
    queryKey: ['/api/service-tickets', 'paginated'],
    cacheTime: CACHE_TIMES.SERVICE_TICKETS,
    staleTime: CACHE_TIMES.SERVICE_TICKETS / 2,
    ...params,
  });
}

export function useInventoryPaginated(params: PaginationParams & { enabled?: boolean } = {}) {
  return usePaginatedQuery({
    endpoint: '/api/inventory',
    queryKey: ['/api/inventory', 'paginated'],
    cacheTime: CACHE_TIMES.INVENTORY,
    staleTime: CACHE_TIMES.INVENTORY / 2,
    ...params,
  });
}

export function useInvoicesPaginated(params: PaginationParams & { enabled?: boolean } = {}) {
  return usePaginatedQuery({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices', 'paginated'],
    cacheTime: CACHE_TIMES.FINANCIAL_DATA,
    staleTime: CACHE_TIMES.FINANCIAL_DATA / 2,
    ...params,
  });
}