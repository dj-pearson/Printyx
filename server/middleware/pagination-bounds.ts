/**
 * Pagination Bounds Enforcement Middleware
 *
 * Clamps pagination query parameters (limit, pageSize, offset) to safe bounds
 * to prevent denial-of-service via unbounded queries.
 *
 * Applied globally so all list endpoints benefit without individual changes.
 */

import type { Request, Response, NextFunction } from 'express';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const MIN_PAGE = 1;

/**
 * Middleware that enforces pagination bounds on query parameters.
 * - limit/pageSize: clamped to 1-200, defaults to 50
 * - page: minimum 1
 * - offset: minimum 0
 */
export function enforcePaginationBounds(req: Request, _res: Response, next: NextFunction): void {
  if (req.method !== 'GET') {
    return next();
  }

  const query = req.query as Record<string, any>;

  // Clamp limit
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1) {
      query.limit = String(DEFAULT_LIMIT);
    } else if (limit > MAX_LIMIT) {
      query.limit = String(MAX_LIMIT);
    }
  }

  // Clamp pageSize (legacy alias for limit)
  if (query.pageSize !== undefined) {
    const pageSize = parseInt(query.pageSize, 10);
    if (isNaN(pageSize) || pageSize < 1) {
      query.pageSize = String(DEFAULT_LIMIT);
    } else if (pageSize > MAX_LIMIT) {
      query.pageSize = String(MAX_LIMIT);
    }
  }

  // Clamp page
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < MIN_PAGE) {
      query.page = String(MIN_PAGE);
    }
  }

  // Clamp offset
  if (query.offset !== undefined) {
    const offset = parseInt(query.offset, 10);
    if (isNaN(offset) || offset < 0) {
      query.offset = '0';
    }
  }

  next();
}
