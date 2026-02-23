import { createModuleLogger } from './logger';
import { getCacheSync, generateCacheKey, CACHE_PREFIXES, CACHE_TTL } from './redis-client';

const log = createModuleLogger('query-cache');

export interface QueryCacheOptions {
  ttlSeconds?: number;
  prefix?: string;
}

/**
 * Get a cached query result
 */
export async function getCachedQuery<T>(key: string): Promise<T | null> {
  try {
    const cache = getCacheSync();
    const result = await cache.get(key);
    if (result) {
      log.debug(`[QueryCache] HIT: ${key}`);
      return result as T;
    }
    log.debug(`[QueryCache] MISS: ${key}`);
    return null;
  } catch (error) {
    log.warn('[QueryCache] Get error:', error);
    return null;
  }
}

/**
 * Set a cached query result
 */
export async function setCachedQuery<T>(
  key: string,
  data: T,
  ttlSeconds: number = CACHE_TTL.MEDIUM,
): Promise<void> {
  try {
    const cache = getCacheSync();
    await cache.set(key, data, ttlSeconds);
    log.debug(`[QueryCache] SET: ${key} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    log.warn('[QueryCache] Set error:', error);
  }
}

/**
 * Invalidate cached queries matching a pattern
 */
export async function invalidateQueryCache(pattern: string): Promise<void> {
  try {
    const cache = getCacheSync();
    const keys = await cache.keys(pattern);
    for (const key of keys) {
      await cache.del(key);
    }
    log.debug(`[QueryCache] Invalidated ${keys.length} keys matching: ${pattern}`);
  } catch (error) {
    log.warn('[QueryCache] Invalidate error:', error);
  }
}

/**
 * Build a cache key for reports that includes tenantId for isolation
 */
export function buildReportCacheKey(
  tenantId: string,
  reportType: string,
  params?: Record<string, any>,
): string {
  const parts = [CACHE_PREFIXES.REPORT, tenantId, reportType];
  if (params) {
    parts.push(JSON.stringify(params));
  }
  return generateCacheKey(...parts);
}

// TTL presets by report type
export const REPORT_CACHE_TTL = {
  REALTIME_DASHBOARD: 30,
  DAILY_REPORT: 300, // 5 minutes
  HISTORICAL_REPORT: 3600, // 1 hour
  KPI: 300, // 5 minutes
} as const;
