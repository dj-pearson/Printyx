// =====================================================================
// CACHING SERVICE FOR REPORTING SYSTEM
// Phase 1 Implementation - In-Memory Cache with Redis-Ready Architecture
// =====================================================================

import crypto from 'crypto';

// Interface for cache service to support multiple backends
interface CacheService {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  generateKey(...parts: string[]): string;
}

// In-memory cache implementation (for Phase 1)
class MemoryCacheService implements CacheService {
  private cache = new Map<string, { value: any; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  generateKey(...parts: string[]): string {
    const combined = parts.join(':');
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Redis cache implementation (for future Phase 2)
class RedisCacheService implements CacheService {
  private redis: any; // Would be Redis client
  
  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<any | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  generateKey(...parts: string[]): string {
    const combined = parts.join(':');
    return crypto.createHash('md5').update(combined).digest('hex');
  }
}

// =====================================================================
// REPORTING-SPECIFIC CACHE MANAGER
// =====================================================================

export class ReportingCacheManager {
  private cache: CacheService;
  
  constructor(cacheService?: CacheService) {
    this.cache = cacheService || new MemoryCacheService();
  }

  // Cache report data with hierarchical key structure
  async cacheReportData(
    tenantId: string,
    reportId: string,
    parameters: Record<string, any>,
    data: any[],
    ttlSeconds?: number
  ): Promise<void> {
    const cacheKey = this.generateReportCacheKey(tenantId, reportId, parameters);
    const cacheValue = {
      data,
      cached_at: Date.now(),
      parameters,
      row_count: data.length
    };

    // Use report-specific TTL or default based on data sensitivity
    const defaultTTL = this.getDefaultTTL(reportId);
    await this.cache.set(cacheKey, cacheValue, ttlSeconds || defaultTTL);
  }

  // Retrieve cached report data
  async getCachedReportData(
    tenantId: string,
    reportId: string,
    parameters: Record<string, any>
  ): Promise<{ data: any[]; cached_at: number; cache_hit: boolean } | null> {
    const cacheKey = this.generateReportCacheKey(tenantId, reportId, parameters);
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return {
        data: cached.data,
        cached_at: cached.cached_at,
        cache_hit: true
      };
    }
    
    return null;
  }

  // Cache KPI values with scope-aware keys
  async cacheKPIValue(
    tenantId: string,
    kpiId: string,
    scope: string,
    scopeId: string,
    value: any,
    ttlSeconds?: number
  ): Promise<void> {
    const cacheKey = this.generateKPICacheKey(tenantId, kpiId, scope, scopeId);
    await this.cache.set(cacheKey, value, ttlSeconds || 300); // 5 minute default for KPIs
  }

  // Retrieve cached KPI value
  async getCachedKPIValue(
    tenantId: string,
    kpiId: string,
    scope: string,
    scopeId: string
  ): Promise<any | null> {
    const cacheKey = this.generateKPICacheKey(tenantId, kpiId, scope, scopeId);
    return await this.cache.get(cacheKey);
  }

  // Invalidate cache for tenant (useful for data updates)
  async invalidateTenantCache(tenantId: string): Promise<void> {
    // For memory cache, we'd need to iterate and delete matching keys
    // For Redis, we could use SCAN pattern matching
    console.log(`Invalidating cache for tenant: ${tenantId}`);
    // Implementation depends on cache backend
  }

  // Invalidate specific report cache
  async invalidateReportCache(tenantId: string, reportId: string): Promise<void> {
    // Implementation would delete all cache entries for this report
    console.log(`Invalidating report cache: ${tenantId}:${reportId}`);
  }

  // Generate cache keys
  private generateReportCacheKey(
    tenantId: string,
    reportId: string,
    parameters: Record<string, any>
  ): string {
    // Sort parameters for consistent cache keys
    const sortedParams = Object.keys(parameters)
      .sort()
      .reduce((result, key) => {
        result[key] = parameters[key];
        return result;
      }, {} as Record<string, any>);
    
    const paramString = JSON.stringify(sortedParams);
    return this.cache.generateKey('report', tenantId, reportId, paramString);
  }

  private generateKPICacheKey(
    tenantId: string,
    kpiId: string,
    scope: string,
    scopeId: string
  ): string {
    return this.cache.generateKey('kpi', tenantId, kpiId, scope, scopeId);
  }

  // Get appropriate TTL based on report type and sensitivity
  private getDefaultTTL(reportId: string): number {
    // Real-time reports: 1 minute
    if (reportId.includes('sla') || reportId.includes('real_time')) {
      return 60;
    }
    
    // Financial reports: 5 minutes (more frequent updates needed)
    if (reportId.includes('finance') || reportId.includes('ar_aging')) {
      return 300;
    }
    
    // Performance reports: 15 minutes
    if (reportId.includes('performance') || reportId.includes('productivity')) {
      return 900;
    }
    
    // Default: 5 minutes
    return 300;
  }

  // Get cache statistics
  async getCacheStats(): Promise<any> {
    if (this.cache instanceof MemoryCacheService) {
      return this.cache.getStats();
    }
    return { message: 'Stats not available for this cache type' };
  }

  // Clear all cache (useful for development/testing)
  async clearAllCache(): Promise<void> {
    await this.cache.clear();
  }

  // Destroy cache service (cleanup)
  destroy(): void {
    if (this.cache instanceof MemoryCacheService) {
      this.cache.destroy();
    }
  }
}

// =====================================================================
// SINGLETON INSTANCE FOR GLOBAL USE
// =====================================================================

export const reportingCache = new ReportingCacheManager();

// =====================================================================
// CACHE MIDDLEWARE FOR EXPRESS ROUTES
// =====================================================================

export function reportCacheMiddleware(ttlSeconds?: number) {
  return async (req: any, res: any, next: any) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const tenantId = req.user?.tenantId;
    const reportId = req.params.id;
    
    if (!tenantId || !reportId) {
      return next();
    }

    try {
      // Try to get cached data
      const cached = await reportingCache.getCachedReportData(
        tenantId,
        reportId,
        req.query
      );

      if (cached) {
        // Return cached data with cache indicators
        return res.json({
          data: cached.data,
          metadata: {
            total_rows: cached.data.length,
            execution_time_ms: 0,
            cache_hit: true,
            cached_at: new Date(cached.cached_at).toISOString(),
            data_freshness: new Date(cached.cached_at).toISOString()
          }
        });
      }

      // If no cache hit, continue to route handler
      // Store original json method to intercept response
      const originalJson = res.json;
      res.json = function(data: any) {
        // Cache the response data if it contains report data
        if (data && data.data && Array.isArray(data.data)) {
          reportingCache.cacheReportData(
            tenantId,
            reportId,
            req.query,
            data.data,
            ttlSeconds
          ).catch(err => console.error('Cache save error:', err));
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Continue without caching on error
    }
  };
}

// Export cache types for use in other modules
export type { CacheService };
export { MemoryCacheService, RedisCacheService };
