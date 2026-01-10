/**
 * Standardized Pagination Utilities
 *
 * Provides consistent pagination across all API endpoints.
 * Standardizes parameter names and response format.
 *
 * Usage:
 *   import { parsePagination, paginatedResponse, withPagination } from './lib/pagination';
 *
 *   // Parse pagination params from request
 *   const pagination = parsePagination(req.query);
 *
 *   // Create paginated response
 *   res.json(paginatedResponse(data, totalCount, pagination));
 *
 *   // Or use the middleware helper
 *   const { data, meta } = await withPagination(
 *     db.select().from(table).where(...),
 *     db.select({ count: count() }).from(table).where(...),
 *     pagination
 *   );
 */

import { SQL, desc, asc } from 'drizzle-orm';

// Standard pagination configuration
export const PAGINATION_DEFAULTS = {
  /** Default page size */
  DEFAULT_LIMIT: 25,
  /** Maximum allowed page size */
  MAX_LIMIT: 100,
  /** Minimum page number */
  MIN_PAGE: 1,
  /** Default sort field */
  DEFAULT_SORT_FIELD: 'createdAt',
  /** Default sort direction */
  DEFAULT_SORT_DIRECTION: 'desc' as const,
} as const;

/**
 * Parsed pagination parameters
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Offset for database query */
  offset: number;
  /** Field to sort by */
  sortBy: string;
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
  /** Search term */
  search?: string;
  /** Additional filters */
  filters: Record<string, any>;
}

/**
 * Pagination metadata for response
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Parse pagination parameters from query string
 *
 * Supports both standard parameter names (limit, page) and
 * legacy alternatives (pageSize, offset) for backward compatibility.
 *
 * @param query - Query parameters from request
 * @returns Parsed pagination parameters
 */
export function parsePagination(query: Record<string, any>): PaginationParams {
  // Parse page (1-indexed)
  let page = parseInt(query.page || '1', 10);
  if (isNaN(page) || page < PAGINATION_DEFAULTS.MIN_PAGE) {
    page = PAGINATION_DEFAULTS.MIN_PAGE;
  }

  // Parse limit (support legacy 'pageSize' param)
  let limit = parseInt(
    query.limit || query.pageSize || String(PAGINATION_DEFAULTS.DEFAULT_LIMIT),
    10
  );
  if (isNaN(limit) || limit < 1) {
    limit = PAGINATION_DEFAULTS.DEFAULT_LIMIT;
  }
  if (limit > PAGINATION_DEFAULTS.MAX_LIMIT) {
    limit = PAGINATION_DEFAULTS.MAX_LIMIT;
  }

  // Calculate offset (support legacy direct 'offset' param)
  let offset: number;
  if (query.offset !== undefined && !isNaN(parseInt(query.offset, 10))) {
    // Legacy: direct offset parameter (overrides page)
    offset = Math.max(0, parseInt(query.offset, 10));
    // Calculate equivalent page for metadata
    page = Math.floor(offset / limit) + 1;
  } else {
    offset = (page - 1) * limit;
  }

  // Parse sort parameters
  const sortBy = query.sortBy || query.sort_by || PAGINATION_DEFAULTS.DEFAULT_SORT_FIELD;
  let sortDirection: 'asc' | 'desc' = PAGINATION_DEFAULTS.DEFAULT_SORT_DIRECTION;
  const dirParam = query.sortDirection || query.sort_direction || query.order;
  if (dirParam && ['asc', 'desc'].includes(dirParam.toLowerCase())) {
    sortDirection = dirParam.toLowerCase() as 'asc' | 'desc';
  }

  // Parse search
  const search = query.search || query.q || undefined;

  // Extract filters (exclude pagination params)
  const paginationParams = [
    'page', 'limit', 'pageSize', 'offset',
    'sortBy', 'sort_by', 'sortDirection', 'sort_direction', 'order',
    'search', 'q',
  ];
  const filters: Record<string, any> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!paginationParams.includes(key) && value !== undefined && value !== '') {
      filters[key] = value;
    }
  }

  return {
    page,
    limit,
    offset,
    sortBy,
    sortDirection,
    search,
    filters,
  };
}

/**
 * Create pagination metadata
 *
 * @param totalItems - Total number of items
 * @param params - Pagination parameters
 * @returns Pagination metadata
 */
export function createPaginationMeta(
  totalItems: number,
  params: Pick<PaginationParams, 'page' | 'limit'>
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / params.limit);

  return {
    page: params.page,
    limit: params.limit,
    totalItems,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  };
}

/**
 * Create a paginated response
 *
 * @param data - Array of data items
 * @param totalCount - Total number of items (for metadata)
 * @param params - Pagination parameters
 * @returns Paginated response object
 */
export function paginatedResponse<T>(
  data: T[],
  totalCount: number,
  params: Pick<PaginationParams, 'page' | 'limit'>
): PaginatedResponse<T> {
  return {
    data,
    pagination: createPaginationMeta(totalCount, params),
  };
}

/**
 * Get Drizzle ORM sort order
 *
 * @param column - Column to sort by
 * @param direction - Sort direction
 * @returns Drizzle ORM order expression
 */
export function getSortOrder<T>(column: T, direction: 'asc' | 'desc'): SQL {
  return direction === 'asc' ? asc(column as any) : desc(column as any);
}

/**
 * Helper to execute a paginated query with count
 *
 * @param dataQuery - Query builder for data (should NOT include limit/offset)
 * @param countQuery - Query builder for count
 * @param params - Pagination parameters
 * @returns Object with data and metadata
 */
export async function executePaginatedQuery<T>(
  dataQuery: { limit: (n: number) => { offset: (n: number) => Promise<T[]> } },
  countQuery: Promise<{ count: number }[]>,
  params: PaginationParams
): Promise<{ data: T[]; meta: PaginationMeta }> {
  // Execute both queries in parallel
  const [data, countResult] = await Promise.all([
    dataQuery.limit(params.limit).offset(params.offset),
    countQuery,
  ]);

  const totalItems = countResult[0]?.count || 0;

  return {
    data,
    meta: createPaginationMeta(totalItems, params),
  };
}

/**
 * Validate and sanitize pagination parameters
 * Useful for logging or external APIs
 *
 * @param params - Raw pagination parameters
 * @returns Sanitized parameters safe for logging/external use
 */
export function sanitizePaginationParams(
  params: Partial<PaginationParams>
): Record<string, any> {
  return {
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? PAGINATION_DEFAULTS.DEFAULT_LIMIT, PAGINATION_DEFAULTS.MAX_LIMIT),
    sortBy: params.sortBy ?? PAGINATION_DEFAULTS.DEFAULT_SORT_FIELD,
    sortDirection: params.sortDirection ?? PAGINATION_DEFAULTS.DEFAULT_SORT_DIRECTION,
    hasSearch: !!params.search,
    filterCount: Object.keys(params.filters ?? {}).length,
  };
}

/**
 * Parse cursor-based pagination parameters
 * For endpoints that use cursor instead of offset pagination
 *
 * @param query - Query parameters
 * @returns Cursor pagination parameters
 */
export function parseCursorPagination(query: Record<string, any>): {
  cursor?: string;
  limit: number;
  direction: 'forward' | 'backward';
} {
  const cursor = query.cursor || query.after || query.before;
  let limit = parseInt(query.limit || query.first || query.last || '25', 10);
  if (isNaN(limit) || limit < 1) limit = 25;
  if (limit > 100) limit = 100;

  const direction = query.before || query.last ? 'backward' : 'forward';

  return { cursor, limit, direction };
}

/**
 * Create cursor-based pagination response
 *
 * @param data - Array of data items
 * @param getCursor - Function to get cursor from item
 * @param hasMore - Whether there are more items
 * @returns Cursor paginated response
 */
export function cursorPaginatedResponse<T>(
  data: T[],
  getCursor: (item: T) => string,
  hasMore: boolean
): {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
} {
  return {
    data,
    pageInfo: {
      hasNextPage: hasMore,
      hasPreviousPage: false, // Would need additional query to determine
      startCursor: data.length > 0 ? getCursor(data[0]) : undefined,
      endCursor: data.length > 0 ? getCursor(data[data.length - 1]) : undefined,
    },
  };
}

// Export defaults for external configuration
export { PAGINATION_DEFAULTS as defaults };
