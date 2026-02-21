/**
 * Per-User Rate Limiting Middleware
 *
 * Rate limits authenticated users based on their user ID, not just IP address.
 * Provides separate limits for different endpoint categories.
 *
 * Features:
 * - User-based rate limiting (falls back to IP if not authenticated)
 * - Configurable limits per endpoint category
 * - Sliding window algorithm with in-memory storage
 * - Standard rate limit headers (X-RateLimit-*)
 * - Graceful degradation when storage unavailable
 */

import { Request, Response, NextFunction } from 'express';
import { getUserId, isAuthenticated } from '../utils/auth-helpers';
import { createModuleLogger } from '../lib/logger';
import { config } from '../config';
const log = createModuleLogger('user-rate-limit');

// Rate limit configuration by category
interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Optional message when rate limited */
  message?: string;
}

// Default configurations for different endpoint types
// Values sourced from centralized config with message strings added here
export const RATE_LIMIT_CONFIGS = {
  /** Authentication endpoints (login, signup, password reset, MFA) */
  auth: {
    limit: config.rateLimits.auth.limit,
    windowMs: config.rateLimits.auth.windowMs,
    message: 'Too many authentication attempts, please try again later',
  },
  /** Billing and subscription endpoints */
  billing: {
    limit: config.rateLimits.billing.limit,
    windowMs: config.rateLimits.billing.windowMs,
    message: 'Too many billing requests, please try again later',
  },
  /** Mutation endpoints (POST/PUT/PATCH/DELETE) */
  mutation: {
    limit: config.rateLimits.mutation.limit,
    windowMs: config.rateLimits.mutation.windowMs,
    message: 'Too many write requests, please try again later',
  },
  /** Read endpoints (GET) */
  read: {
    limit: config.rateLimits.read.limit,
    windowMs: config.rateLimits.read.windowMs,
    message: 'Too many read requests, please try again later',
  },
  /** General API endpoints */
  general: {
    limit: config.rateLimits.general.limit,
    windowMs: config.rateLimits.general.windowMs,
    message: 'Too many requests, please try again later',
  },
  /** Search and autocomplete endpoints */
  search: {
    limit: config.rateLimits.search.limit,
    windowMs: config.rateLimits.search.windowMs,
    message: 'Too many search requests, please try again later',
  },
  /** Export/download operations */
  export: {
    limit: config.rateLimits.export.limit,
    windowMs: config.rateLimits.export.windowMs,
    message: 'Too many export requests, please try again later',
  },
  /** AI/expensive operations */
  ai: {
    limit: config.rateLimits.ai.limit,
    windowMs: config.rateLimits.ai.windowMs,
    message: 'AI request limit reached, please try again later',
  },
  /** Bulk operations */
  bulk: {
    limit: config.rateLimits.bulk.limit,
    windowMs: config.rateLimits.bulk.windowMs,
    message: 'Bulk operation limit reached, please try again later',
  },
  /** Reports/analytics */
  reports: {
    limit: config.rateLimits.reports.limit,
    windowMs: config.rateLimits.reports.windowMs,
    message: 'Report request limit reached, please try again later',
  },
} as const;

// Type for config keys
type RateLimitCategory = keyof typeof RATE_LIMIT_CONFIGS;

// In-memory storage for rate limit buckets
// Key format: `${category}:${userId|ip}:${bucketKey}`
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Cleanup old buckets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Get the identifier for rate limiting
 * Uses user ID for authenticated users, falls back to IP
 */
function getRateLimitKey(req: Request): string {
  // Try to get authenticated user ID
  const userId = getUserId(req as any);
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  return `ip:${ip}`;
}

/**
 * Get current bucket key based on window
 */
function getBucketKey(windowMs: number): string {
  const now = Date.now();
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  return bucketStart.toString();
}

/**
 * Check and update rate limit for a key
 */
function checkRateLimit(
  identifier: string,
  category: string,
  config: RateLimitConfig,
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const bucketKey = getBucketKey(config.windowMs);
  const storeKey = `${category}:${identifier}:${bucketKey}`;

  const now = Date.now();
  const resetAt = Math.ceil(now / config.windowMs) * config.windowMs;

  let bucket = rateLimitStore.get(storeKey);

  if (!bucket || bucket.resetAt < now) {
    // Create new bucket
    bucket = {
      count: 1,
      resetAt,
    };
    rateLimitStore.set(storeKey, bucket);

    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt,
      limit: config.limit,
    };
  }

  // Increment existing bucket
  bucket.count++;
  rateLimitStore.set(storeKey, bucket);

  const remaining = Math.max(0, config.limit - bucket.count);
  const allowed = bucket.count <= config.limit;

  return {
    allowed,
    remaining,
    resetAt: bucket.resetAt,
    limit: config.limit,
  };
}

/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(
  res: Response,
  limit: number,
  remaining: number,
  resetAt: number,
): void {
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(resetAt / 1000).toString());
  res.setHeader('X-RateLimit-Policy', `${limit};w=${Math.floor(resetAt / 1000)}`);
}

/**
 * Create a per-user rate limiter middleware
 *
 * @param category - The rate limit category (general, read, write, etc.)
 * @param customConfig - Optional custom configuration to override defaults
 */
export function userRateLimit(
  category: RateLimitCategory = 'general',
  customConfig?: Partial<RateLimitConfig>,
) {
  const config: RateLimitConfig = {
    ...RATE_LIMIT_CONFIGS[category],
    ...customConfig,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = getRateLimitKey(req);
      const result = checkRateLimit(identifier, category, config);

      // Always set rate limit headers
      setRateLimitHeaders(res, result.limit, result.remaining, result.resetAt);

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        return res.status(429).json({
          message: config.message || 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          details: { retryAfter },
          limit: result.limit,
          remaining: 0,
          resetAt: Math.floor(result.resetAt / 1000),
        });
      }

      next();
    } catch (error) {
      // Graceful degradation - allow request if rate limiting fails
      log.error('[UserRateLimit] Error checking rate limit:', error);
      next();
    }
  };
}

/**
 * Rate limit middleware that determines category based on request method
 */
export function autoRateLimit() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Determine category based on method and path
    let category: RateLimitCategory = 'general';

    const method = req.method.toUpperCase();
    const path = req.path.toLowerCase();

    // Check for specific patterns
    if (path.includes('/search') || path.includes('/autocomplete')) {
      category = 'search';
    } else if (path.includes('/export') || path.includes('/download')) {
      category = 'export';
    } else if (path.includes('/ai') || path.includes('/claude') || path.includes('/gpt')) {
      category = 'ai';
    } else if (path.includes('/bulk') || path.includes('/batch')) {
      category = 'bulk';
    } else if (path.includes('/reports') || path.includes('/analytics')) {
      category = 'reports';
    } else if (method === 'GET') {
      category = 'read';
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      category = 'write';
    }

    // Apply rate limiting with detected category
    return userRateLimit(category)(req, res, next);
  };
}

/**
 * Get current rate limit stats for a user (for debugging/admin)
 */
export function getRateLimitStats(req: Request): Record<
  string,
  {
    count: number;
    limit: number;
    remaining: number;
    resetAt: Date;
  }
> {
  const identifier = getRateLimitKey(req);
  const stats: Record<string, any> = {};

  for (const [category, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    const bucketKey = getBucketKey(config.windowMs);
    const storeKey = `${category}:${identifier}:${bucketKey}`;
    const bucket = rateLimitStore.get(storeKey);

    if (bucket) {
      stats[category] = {
        count: bucket.count,
        limit: config.limit,
        remaining: Math.max(0, config.limit - bucket.count),
        resetAt: new Date(bucket.resetAt),
      };
    } else {
      stats[category] = {
        count: 0,
        limit: config.limit,
        remaining: config.limit,
        resetAt: new Date(Math.ceil(Date.now() / config.windowMs) * config.windowMs),
      };
    }
  }

  return stats;
}

/**
 * Reset rate limit for a specific user (admin function)
 */
export function resetUserRateLimit(userId: string, category?: RateLimitCategory): void {
  const identifier = `user:${userId}`;

  if (category) {
    // Reset specific category
    const config = RATE_LIMIT_CONFIGS[category];
    const bucketKey = getBucketKey(config.windowMs);
    const storeKey = `${category}:${identifier}:${bucketKey}`;
    rateLimitStore.delete(storeKey);
  } else {
    // Reset all categories
    for (const key of rateLimitStore.keys()) {
      if (key.includes(identifier)) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Get memory usage stats for rate limit store
 */
export function getRateLimitStoreStats(): {
  totalBuckets: number;
  categories: Record<string, number>;
} {
  const stats: Record<string, number> = {};

  for (const key of rateLimitStore.keys()) {
    const category = key.split(':')[0];
    stats[category] = (stats[category] || 0) + 1;
  }

  return {
    totalBuckets: rateLimitStore.size,
    categories: stats,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PRE-BUILT TIERED RATE LIMITERS
// ═══════════════════════════════════════════════════════════════════════

/** Auth routes: 5 req/min (login, signup, password reset, MFA) */
export const authLimiter = userRateLimit('auth');

/** Billing routes: 20 req/min (/api/billing*, /api/stripe*, /api/subscriptions*) */
export const billingLimiter = userRateLimit('billing');

/** Mutation routes: 100 req/min (POST/PUT/PATCH/DELETE) */
export const mutationLimiter = userRateLimit('mutation');

/** Read routes: 200 req/min (GET) */
export const readLimiter = userRateLimit('read');

/**
 * Global tiered rate limiter middleware.
 * Routes through auth → billing → mutation/read based on path and method.
 */
export function globalTieredRateLimit(req: Request, res: Response, next: NextFunction) {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Auth routes get strictest limits
  if (
    path.includes('/auth/') ||
    path.includes('/login') ||
    path.includes('/signup') ||
    path.includes('/register') ||
    path.includes('/password') ||
    path.includes('/mfa') ||
    path.includes('/verify')
  ) {
    return authLimiter(req, res, next);
  }

  // Billing routes get dedicated limits
  if (
    path.startsWith('/api/billing') ||
    path.startsWith('/api/stripe') ||
    path.startsWith('/api/subscriptions') ||
    path.startsWith('/api/invoices') ||
    path.startsWith('/api/payments')
  ) {
    return billingLimiter(req, res, next);
  }

  // Mutations vs reads
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return mutationLimiter(req, res, next);
  }

  // Default: read limiter for GET and other methods
  return readLimiter(req, res, next);
}
