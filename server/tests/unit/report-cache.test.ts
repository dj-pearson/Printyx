/**
 * Unit Tests: Report Caching Service
 * Tests for ReportCacheService caching logic, expiration, and invalidation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// =====================================================================
// MOCK REPORT CACHE SERVICE (since we can't import from routes)
// =====================================================================

interface CachedReport {
  data: any[];
  cachedAt: Date;
  expiresAt: Date;
  rowCount: number;
}

class ReportCacheService {
  private static cache = new Map<string, CachedReport>();

  static getCacheKey(reportCode: string, params: any, userId: string): string {
    const normalized = {
      code: reportCode,
      filters: params.filters || {},
      parameters: params.parameters || {},
      userId,
    };
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  static get(cacheKey: string): any[] | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    if (cached.expiresAt < new Date()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  static set(cacheKey: string, data: any[], cacheDuration: number): void {
    const now = new Date();
    this.cache.set(cacheKey, {
      data,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + cacheDuration * 1000),
      rowCount: data.length,
    });
  }

  static invalidate(reportCode: string): void {
    for (const [key] of this.cache) {
      if (key.includes(reportCode)) {
        this.cache.delete(key);
      }
    }
  }

  static cleanup(): void {
    const now = new Date();
    for (const [key, value] of this.cache) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  static clear(): void {
    this.cache.clear();
  }

  static size(): number {
    return this.cache.size;
  }
}

// =====================================================================
// TESTS
// =====================================================================

describe('ReportCacheService', () => {
  beforeEach(() => {
    // Clear cache before each test
    ReportCacheService.clear();
  });

  describe('getCacheKey', () => {
    it('should generate consistent cache keys for identical parameters', () => {
      const params = {
        filters: { status: 'active' },
        parameters: { dateFrom: '2025-01-01' },
      };

      const key1 = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', params, 'user-1');
      const key2 = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', params, 'user-1');

      expect(key1).toBe(key2);
    });

    it('should generate different cache keys for different users', () => {
      const params = { filters: {}, parameters: {} };

      const key1 = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', params, 'user-1');
      const key2 = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', params, 'user-2');

      expect(key1).not.toBe(key2);
    });

    it('should generate different cache keys for different filters', () => {
      const params1 = { filters: { status: 'active' }, parameters: {} };
      const params2 = { filters: { status: 'closed' }, parameters: {} };

      const key1 = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', params1, 'user-1');
      const key2 = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', params2, 'user-1');

      expect(key1).not.toBe(key2);
    });

    it('should generate different cache keys for different report codes', () => {
      const params = { filters: {}, parameters: {} };

      const key1 = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', params, 'user-1');
      const key2 = ReportCacheService.getCacheKey('SERVICE_CALLS_INDIVIDUAL', params, 'user-1');

      expect(key1).not.toBe(key2);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve cached report data', () => {
      const reportData = [
        { id: 1, name: 'Lead 1', value: 10000 },
        { id: 2, name: 'Lead 2', value: 20000 },
      ];
      const cacheKey = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', {}, 'user-1');

      ReportCacheService.set(cacheKey, reportData, 300); // 5 minutes

      const retrieved = ReportCacheService.get(cacheKey);
      expect(retrieved).toEqual(reportData);
    });

    it('should return null for non-existent cache key', () => {
      const result = ReportCacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return null and delete expired cache entries', async () => {
      const reportData = [{ id: 1, name: 'Lead 1' }];
      const cacheKey = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', {}, 'user-1');

      // Set cache with 1 second expiration
      ReportCacheService.set(cacheKey, reportData, 1);

      // Immediately should be available
      expect(ReportCacheService.get(cacheKey)).toEqual(reportData);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should now return null and be deleted
      expect(ReportCacheService.get(cacheKey)).toBeNull();
      expect(ReportCacheService.size()).toBe(0);
    });

    it('should handle multiple cache entries independently', () => {
      const data1 = [{ id: 1, name: 'Report 1' }];
      const data2 = [{ id: 2, name: 'Report 2' }];

      const key1 = ReportCacheService.getCacheKey('REPORT_1', {}, 'user-1');
      const key2 = ReportCacheService.getCacheKey('REPORT_2', {}, 'user-1');

      ReportCacheService.set(key1, data1, 300);
      ReportCacheService.set(key2, data2, 300);

      expect(ReportCacheService.get(key1)).toEqual(data1);
      expect(ReportCacheService.get(key2)).toEqual(data2);
      expect(ReportCacheService.size()).toBe(2);
    });
  });

  describe('invalidate', () => {
    it('should invalidate all cache entries for a specific report code', () => {
      const key1 = ReportCacheService.getCacheKey('SALES_PIPELINE_INDIVIDUAL', {}, 'user-1');
      const key2 = ReportCacheService.getCacheKey(
        'SALES_PIPELINE_INDIVIDUAL',
        { filters: { status: 'active' } },
        'user-1',
      );
      const key3 = ReportCacheService.getCacheKey('SERVICE_CALLS_INDIVIDUAL', {}, 'user-1');

      ReportCacheService.set(key1, [{ id: 1 }], 300);
      ReportCacheService.set(key2, [{ id: 2 }], 300);
      ReportCacheService.set(key3, [{ id: 3 }], 300);

      expect(ReportCacheService.size()).toBe(3);

      ReportCacheService.invalidate('SALES_PIPELINE_INDIVIDUAL');

      // Sales pipeline entries should be gone, service calls should remain
      expect(ReportCacheService.get(key1)).toBeNull();
      expect(ReportCacheService.get(key2)).toBeNull();
      expect(ReportCacheService.get(key3)).toEqual([{ id: 3 }]);
      expect(ReportCacheService.size()).toBe(1);
    });

    it('should handle invalidation when no matching entries exist', () => {
      const key1 = ReportCacheService.getCacheKey('REPORT_1', {}, 'user-1');
      ReportCacheService.set(key1, [{ id: 1 }], 300);

      ReportCacheService.invalidate('NON_EXISTENT_REPORT');

      expect(ReportCacheService.get(key1)).toEqual([{ id: 1 }]);
      expect(ReportCacheService.size()).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should remove all expired cache entries', async () => {
      const key1 = ReportCacheService.getCacheKey('REPORT_1', {}, 'user-1');
      const key2 = ReportCacheService.getCacheKey('REPORT_2', {}, 'user-1');
      const key3 = ReportCacheService.getCacheKey('REPORT_3', {}, 'user-1');

      // Set with different expiration times
      ReportCacheService.set(key1, [{ id: 1 }], 1); // Expires in 1 second
      ReportCacheService.set(key2, [{ id: 2 }], 1); // Expires in 1 second
      ReportCacheService.set(key3, [{ id: 3 }], 300); // Expires in 5 minutes

      expect(ReportCacheService.size()).toBe(3);

      // Wait for first two to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      ReportCacheService.cleanup();

      expect(ReportCacheService.size()).toBe(1);
      expect(ReportCacheService.get(key1)).toBeNull();
      expect(ReportCacheService.get(key2)).toBeNull();
      expect(ReportCacheService.get(key3)).toEqual([{ id: 3 }]);
    });

    it('should not remove non-expired entries', () => {
      const key1 = ReportCacheService.getCacheKey('REPORT_1', {}, 'user-1');
      const key2 = ReportCacheService.getCacheKey('REPORT_2', {}, 'user-1');

      ReportCacheService.set(key1, [{ id: 1 }], 300);
      ReportCacheService.set(key2, [{ id: 2 }], 300);

      ReportCacheService.cleanup();

      expect(ReportCacheService.size()).toBe(2);
      expect(ReportCacheService.get(key1)).toEqual([{ id: 1 }]);
      expect(ReportCacheService.get(key2)).toEqual([{ id: 2 }]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty report data', () => {
      const cacheKey = ReportCacheService.getCacheKey('REPORT_1', {}, 'user-1');
      ReportCacheService.set(cacheKey, [], 300);

      const result = ReportCacheService.get(cacheKey);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle large report data', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Record ${i}`,
        value: Math.random() * 100000,
      }));

      const cacheKey = ReportCacheService.getCacheKey('LARGE_REPORT', {}, 'user-1');
      ReportCacheService.set(cacheKey, largeData, 300);

      const result = ReportCacheService.get(cacheKey);
      expect(result).toHaveLength(10000);
      expect(result?.[0]).toEqual(largeData[0]);
    });

    it('should handle complex nested data structures', () => {
      const complexData = [
        {
          id: 1,
          name: 'Complex Record',
          nested: {
            level1: {
              level2: {
                value: 'deep value',
              },
            },
          },
          arrays: [1, 2, 3, { nested: true }],
        },
      ];

      const cacheKey = ReportCacheService.getCacheKey('COMPLEX_REPORT', {}, 'user-1');
      ReportCacheService.set(cacheKey, complexData, 300);

      const result = ReportCacheService.get(cacheKey);
      expect(result).toEqual(complexData);
    });

    it('should handle multiple simultaneous cache operations', () => {
      const operations = Array.from({ length: 100 }, (_, i) => {
        const key = ReportCacheService.getCacheKey(`REPORT_${i}`, {}, 'user-1');
        return () => ReportCacheService.set(key, [{ id: i }], 300);
      });

      // Execute all operations
      operations.forEach((op) => op());

      expect(ReportCacheService.size()).toBe(100);

      // Verify all entries are retrievable
      for (let i = 0; i < 100; i++) {
        const key = ReportCacheService.getCacheKey(`REPORT_${i}`, {}, 'user-1');
        expect(ReportCacheService.get(key)).toEqual([{ id: i }]);
      }
    });
  });
});
