/**
 * Redis Client Service
 *
 * Provides a Redis connection with automatic fallback to in-memory cache.
 * Supports connection pooling, health checks, and pub/sub for cache invalidation.
 *
 * Configuration via environment variables:
 * - REDIS_URL: Redis connection URL (e.g., redis://localhost:6379)
 * - REDIS_HOST: Redis host (default: localhost)
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database number (default: 0)
 * - REDIS_TLS: Enable TLS (true/false)
 * - REDIS_ENABLED: Enable Redis caching (true/false, default: true if URL/HOST provided)
 */

import crypto from 'crypto';

// Cache entry type
interface CacheEntry {
  value: any;
  expiry: number;
}

// Cache interface that both memory and Redis implementations follow
export interface CacheClient {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  flushAll(): Promise<void>;
  isConnected(): boolean;
  quit(): Promise<void>;
}

// In-memory cache implementation (fallback)
class MemoryCache implements CacheClient {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
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
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const now = Date.now();
    const matchingKeys: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expiry && regex.test(key)) {
        matchingKeys.push(key);
      }
    }
    return matchingKeys;
  }

  async flushAll(): Promise<void> {
    this.cache.clear();
  }

  isConnected(): boolean {
    return true; // Memory cache is always "connected"
  }

  async quit(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Redis cache implementation using ioredis
class RedisCache implements CacheClient {
  private client: any;
  private connected: boolean = false;
  private fallback: MemoryCache;

  constructor(redisClient: any) {
    this.client = redisClient;
    this.fallback = new MemoryCache();

    // Handle connection events
    if (this.client) {
      this.client.on('connect', () => {
        console.log('[Redis] Connected');
        this.connected = true;
      });

      this.client.on('error', (err: any) => {
        console.error('[Redis] Connection error:', err.message);
        this.connected = false;
      });

      this.client.on('close', () => {
        console.log('[Redis] Connection closed');
        this.connected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
      });
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.connected) {
      return this.fallback.get(key);
    }
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value);
    } catch (error) {
      console.error('[Redis] Get error:', error);
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.connected) {
      return this.fallback.set(key, value, ttlSeconds);
    }
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('[Redis] Set error:', error);
      await this.fallback.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) {
      return this.fallback.del(key);
    }
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('[Redis] Del error:', error);
    }
    // Also delete from fallback
    await this.fallback.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) {
      return this.fallback.exists(key);
    }
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[Redis] Exists error:', error);
      return this.fallback.exists(key);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.connected) {
      return this.fallback.keys(pattern);
    }
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('[Redis] Keys error:', error);
      return this.fallback.keys(pattern);
    }
  }

  async flushAll(): Promise<void> {
    if (this.connected) {
      try {
        await this.client.flushdb();
      } catch (error) {
        console.error('[Redis] FlushDB error:', error);
      }
    }
    await this.fallback.flushAll();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async quit(): Promise<void> {
    await this.fallback.quit();
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        console.error('[Redis] Quit error:', error);
      }
    }
  }
}

// Singleton cache instance
let cacheInstance: CacheClient | null = null;

/**
 * Initialize the cache client
 * Attempts to connect to Redis if configured, falls back to memory cache
 */
export async function initCache(): Promise<CacheClient> {
  if (cacheInstance) {
    return cacheInstance;
  }

  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;
  const redisEnabled = process.env.REDIS_ENABLED !== 'false';

  // Check if Redis should be used
  if (!redisEnabled || (!redisUrl && !redisHost)) {
    console.log('[Cache] Using in-memory cache (Redis not configured)');
    cacheInstance = new MemoryCache();
    return cacheInstance;
  }

  try {
    // Dynamically import ioredis (allows graceful fallback if not installed)
    const Redis = (await import('ioredis')).default;

    const redisOptions: any = {
      retryDelayOnFailover: 1000,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    };

    // Add TLS if configured
    if (process.env.REDIS_TLS === 'true') {
      redisOptions.tls = {};
    }

    let redisClient: any;

    if (redisUrl) {
      redisClient = new Redis(redisUrl, redisOptions);
    } else {
      redisOptions.host = redisHost || 'localhost';
      redisOptions.port = parseInt(process.env.REDIS_PORT || '6379', 10);
      redisOptions.password = process.env.REDIS_PASSWORD || undefined;
      redisOptions.db = parseInt(process.env.REDIS_DB || '0', 10);
      redisClient = new Redis(redisOptions);
    }

    // Test connection
    await redisClient.connect();
    await redisClient.ping();
    console.log('[Cache] Redis connected successfully');

    cacheInstance = new RedisCache(redisClient);
    return cacheInstance;
  } catch (error: any) {
    console.warn('[Cache] Redis not available, using in-memory cache:', error.message);
    cacheInstance = new MemoryCache();
    return cacheInstance;
  }
}

/**
 * Get the cache instance (initializes if needed)
 */
export async function getCache(): Promise<CacheClient> {
  if (!cacheInstance) {
    return initCache();
  }
  return cacheInstance;
}

/**
 * Synchronous cache getter for middleware (uses memory cache if Redis not initialized)
 */
export function getCacheSync(): CacheClient {
  if (!cacheInstance) {
    cacheInstance = new MemoryCache();
  }
  return cacheInstance;
}

/**
 * Shutdown the cache client
 */
export async function shutdownCache(): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.quit();
    cacheInstance = null;
  }
}

/**
 * Generate a cache key from parts
 */
export function generateCacheKey(...parts: string[]): string {
  const combined = parts.join(':');
  return crypto.createHash('md5').update(combined).digest('hex');
}

/**
 * Cache key prefixes for different domains
 */
export const CACHE_PREFIXES = {
  PERMISSION: 'perm',
  RBAC: 'rbac',
  REPORT: 'report',
  KPI: 'kpi',
  SESSION: 'session',
  RATE_LIMIT: 'rl',
  TENANT: 'tenant',
  USER: 'user',
  SEARCH: 'search',
  API: 'api',
} as const;

/**
 * Cache TTL defaults (in seconds)
 */
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
  PERMISSION: 900, // 15 minutes for permissions
  REPORT: 300, // 5 minutes for reports
  KPI: 300, // 5 minutes for KPIs
  SESSION: 86400, // 24 hours for sessions
  SEARCH: 60, // 1 minute for search results
} as const;

/**
 * Helper to wrap a function with caching
 */
export function withCache<T>(
  keyGenerator: (...args: any[]) => string,
  ttlSeconds: number = CACHE_TTL.MEDIUM
) {
  return async (
    fn: (...args: any[]) => Promise<T>,
    ...args: any[]
  ): Promise<T> => {
    const cache = await getCache();
    const key = keyGenerator(...args);

    // Check cache
    const cached = await cache.get(key);
    if (cached !== null) {
      return cached as T;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await cache.set(key, result, ttlSeconds);

    return result;
  };
}

// Export types
export type { CacheEntry };
