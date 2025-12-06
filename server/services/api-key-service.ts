/**
 * API Key Management Service
 *
 * Handles API key generation, validation, and lifecycle management
 * for service-to-service authentication.
 */

import { db } from '../db';
import { eq, and, gte, lte, desc, or, sql } from 'drizzle-orm';
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  apiKeys,
  apiKeyUsageLogs,
  apiKeyRateLimits,
  apiKeyRotations,
  ApiKey,
  NewApiKey,
  API_KEY_LIVE_PREFIX,
  API_KEY_TEST_PREFIX,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
} from '@shared/api-key-schema';

// Types
export interface GeneratedApiKey {
  id: string;
  key: string; // Full key (only shown once)
  prefix: string;
  name: string;
  keyType: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
  errorCode?: 'INVALID_KEY' | 'EXPIRED' | 'REVOKED' | 'INACTIVE' | 'IP_RESTRICTED' | 'RATE_LIMITED';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: {
    minute: number;
    hour: number;
    day: number;
  };
  resetAt: {
    minute: Date;
    hour: Date;
    day: Date;
  };
}

/**
 * API Key Service Class
 */
export class ApiKeyService {
  private readonly keyLength = 32; // 256 bits
  private readonly saltLength = 16; // 128 bits

  /**
   * Generate a new API key
   */
  async createApiKey(
    tenantId: string,
    userId: string,
    request: CreateApiKeyRequest
  ): Promise<GeneratedApiKey> {
    // Generate secure random key
    const keyBytes = randomBytes(this.keyLength);
    const salt = randomBytes(this.saltLength);

    // Create key string with prefix
    const isProduction = request.environment === 'production';
    const prefix = isProduction ? API_KEY_LIVE_PREFIX : API_KEY_TEST_PREFIX;
    const keyString = keyBytes.toString('base64url');
    const fullKey = `${prefix}${keyString}`;

    // Create key prefix (first 8 chars after prefix for identification)
    const keyPrefix = fullKey.substring(0, prefix.length + 8);

    // Hash the key for storage
    const keyHash = this.hashKey(fullKey, salt.toString('hex'));

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (request.expiresAt && !request.neverExpires) {
      expiresAt = new Date(request.expiresAt);
    }

    // Create the API key record
    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        tenantId,
        name: request.name,
        description: request.description,
        keyType: request.keyType,
        keyPrefix,
        keyHash,
        keySalt: salt.toString('hex'),
        scopes: request.scopes,
        permissions: request.permissions,
        expiresAt,
        neverExpires: request.neverExpires,
        allowedIps: request.allowedIps,
        allowAllIps: request.allowAllIps,
        rateLimitPerMinute: request.rateLimitPerMinute,
        rateLimitPerHour: request.rateLimitPerHour,
        rateLimitPerDay: request.rateLimitPerDay,
        environment: request.environment,
        metadata: request.metadata,
        tags: request.tags,
        createdBy: userId,
      })
      .returning();

    return {
      id: apiKey.id,
      key: fullKey,
      prefix: keyPrefix,
      name: apiKey.name,
      keyType: apiKey.keyType,
      scopes: (apiKey.scopes as string[]) || [],
      expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Validate an API key
   */
  async validateApiKey(
    key: string,
    clientIp?: string
  ): Promise<ApiKeyValidationResult> {
    if (!key || key.length < 20) {
      return { valid: false, error: 'Invalid API key format', errorCode: 'INVALID_KEY' };
    }

    // Extract prefix for lookup
    const isLive = key.startsWith(API_KEY_LIVE_PREFIX);
    const isTest = key.startsWith(API_KEY_TEST_PREFIX);

    if (!isLive && !isTest) {
      return { valid: false, error: 'Invalid API key format', errorCode: 'INVALID_KEY' };
    }

    const prefixLength = isLive ? API_KEY_LIVE_PREFIX.length : API_KEY_TEST_PREFIX.length;
    const keyPrefix = key.substring(0, prefixLength + 8);

    // Find API key by prefix
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, keyPrefix))
      .limit(1);

    if (!apiKey) {
      return { valid: false, error: 'API key not found', errorCode: 'INVALID_KEY' };
    }

    // Verify the full key hash
    const computedHash = this.hashKey(key, apiKey.keySalt);
    const storedHash = Buffer.from(apiKey.keyHash, 'hex');
    const computedHashBuffer = Buffer.from(computedHash, 'hex');

    if (storedHash.length !== computedHashBuffer.length ||
        !timingSafeEqual(storedHash, computedHashBuffer)) {
      return { valid: false, error: 'Invalid API key', errorCode: 'INVALID_KEY' };
    }

    // Check if key is active
    if (!apiKey.isActive || apiKey.status === 'inactive') {
      return { valid: false, error: 'API key is inactive', errorCode: 'INACTIVE' };
    }

    // Check if key is revoked
    if (apiKey.status === 'revoked') {
      return { valid: false, error: 'API key has been revoked', errorCode: 'REVOKED' };
    }

    // Check if key is expired
    if (apiKey.expiresAt && !apiKey.neverExpires) {
      if (new Date() > apiKey.expiresAt) {
        // Update status to expired
        await db
          .update(apiKeys)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(apiKeys.id, apiKey.id));

        return { valid: false, error: 'API key has expired', errorCode: 'EXPIRED' };
      }
    }

    // Check IP restrictions
    if (!apiKey.allowAllIps && apiKey.allowedIps && clientIp) {
      const allowedIps = apiKey.allowedIps as string[];
      if (!this.isIpAllowed(clientIp, allowedIps)) {
        return { valid: false, error: 'IP address not allowed', errorCode: 'IP_RESTRICTED' };
      }
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        lastUsedIp: clientIp,
        usageCount: ((parseInt(apiKey.usageCount || '0', 10) + 1).toString()),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, apiKey.id));

    return { valid: true, apiKey };
  }

  /**
   * Check if an IP is allowed
   */
  private isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
    for (const allowed of allowedIps) {
      if (allowed.includes('/')) {
        // CIDR notation
        if (this.isIpInCidr(clientIp, allowed)) {
          return true;
        }
      } else if (allowed === clientIp) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if IP is in CIDR range (simplified)
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    // Simplified CIDR check - in production, use a proper library
    const [range, bits] = cidr.split('/');
    if (!bits) return ip === range;

    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);
    const mask = parseInt(bits, 10);

    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const rangeNum = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
    const maskNum = -1 << (32 - mask);

    return (ipNum & maskNum) === (rangeNum & maskNum);
  }

  /**
   * Hash an API key with salt
   */
  private hashKey(key: string, salt: string): string {
    return createHmac('sha256', salt)
      .update(key)
      .digest('hex');
  }

  /**
   * Check rate limits for an API key
   */
  async checkRateLimit(apiKeyId: string): Promise<RateLimitResult> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId));

    if (!apiKey) {
      return {
        allowed: false,
        remaining: { minute: 0, hour: 0, day: 0 },
        resetAt: { minute: new Date(), hour: new Date(), day: new Date() },
      };
    }

    const now = new Date();
    const buckets = await this.getOrCreateRateLimitBuckets(apiKeyId, now);

    const minuteLimit = apiKey.rateLimitPerMinute || 1000;
    const hourLimit = apiKey.rateLimitPerHour || 10000;
    const dayLimit = apiKey.rateLimitPerDay || 100000;

    const minuteRemaining = Math.max(0, minuteLimit - buckets.minute.count);
    const hourRemaining = Math.max(0, hourLimit - buckets.hour.count);
    const dayRemaining = Math.max(0, dayLimit - buckets.day.count);

    const allowed = minuteRemaining > 0 && hourRemaining > 0 && dayRemaining > 0;

    if (allowed) {
      // Increment counters
      await this.incrementRateLimitCounters(apiKeyId, buckets);
    }

    return {
      allowed,
      remaining: {
        minute: minuteRemaining - (allowed ? 1 : 0),
        hour: hourRemaining - (allowed ? 1 : 0),
        day: dayRemaining - (allowed ? 1 : 0),
      },
      resetAt: {
        minute: buckets.minute.end,
        hour: buckets.hour.end,
        day: buckets.day.end,
      },
    };
  }

  /**
   * Get or create rate limit buckets
   */
  private async getOrCreateRateLimitBuckets(
    apiKeyId: string,
    now: Date
  ): Promise<{
    minute: { id: string; count: number; end: Date };
    hour: { id: string; count: number; end: Date };
    day: { id: string; count: number; end: Date };
  }> {
    const minuteKey = this.getBucketKey(now, 'minute');
    const hourKey = this.getBucketKey(now, 'hour');
    const dayKey = this.getBucketKey(now, 'day');

    // Get existing buckets
    const existingBuckets = await db
      .select()
      .from(apiKeyRateLimits)
      .where(
        and(
          eq(apiKeyRateLimits.apiKeyId, apiKeyId),
          or(
            and(eq(apiKeyRateLimits.bucketType, 'minute'), eq(apiKeyRateLimits.bucketKey, minuteKey)),
            and(eq(apiKeyRateLimits.bucketType, 'hour'), eq(apiKeyRateLimits.bucketKey, hourKey)),
            and(eq(apiKeyRateLimits.bucketType, 'day'), eq(apiKeyRateLimits.bucketKey, dayKey))
          )
        )
      );

    const bucketMap = new Map(
      existingBuckets.map(b => [`${b.bucketType}:${b.bucketKey}`, b])
    );

    // Create missing buckets
    const minuteBucket = bucketMap.get(`minute:${minuteKey}`) ||
      await this.createBucket(apiKeyId, 'minute', minuteKey, now);
    const hourBucket = bucketMap.get(`hour:${hourKey}`) ||
      await this.createBucket(apiKeyId, 'hour', hourKey, now);
    const dayBucket = bucketMap.get(`day:${dayKey}`) ||
      await this.createBucket(apiKeyId, 'day', dayKey, now);

    return {
      minute: {
        id: minuteBucket.id,
        count: minuteBucket.requestCount,
        end: minuteBucket.bucketEnd,
      },
      hour: {
        id: hourBucket.id,
        count: hourBucket.requestCount,
        end: hourBucket.bucketEnd,
      },
      day: {
        id: dayBucket.id,
        count: dayBucket.requestCount,
        end: dayBucket.bucketEnd,
      },
    };
  }

  /**
   * Create a rate limit bucket
   */
  private async createBucket(
    apiKeyId: string,
    type: string,
    key: string,
    now: Date
  ): Promise<{ id: string; requestCount: number; bucketEnd: Date }> {
    const { start, end } = this.getBucketBounds(now, type);

    try {
      const [bucket] = await db
        .insert(apiKeyRateLimits)
        .values({
          apiKeyId,
          bucketType: type,
          bucketKey: key,
          requestCount: 0,
          bucketStart: start,
          bucketEnd: end,
        })
        .onConflictDoUpdate({
          target: [apiKeyRateLimits.apiKeyId, apiKeyRateLimits.bucketType, apiKeyRateLimits.bucketKey],
          set: { updatedAt: new Date() },
        })
        .returning();

      return bucket;
    } catch {
      // Race condition - fetch existing
      const [existing] = await db
        .select()
        .from(apiKeyRateLimits)
        .where(
          and(
            eq(apiKeyRateLimits.apiKeyId, apiKeyId),
            eq(apiKeyRateLimits.bucketType, type),
            eq(apiKeyRateLimits.bucketKey, key)
          )
        );

      return existing || { id: '', requestCount: 0, bucketEnd: end };
    }
  }

  /**
   * Increment rate limit counters
   */
  private async incrementRateLimitCounters(
    apiKeyId: string,
    buckets: { minute: { id: string }; hour: { id: string }; day: { id: string } }
  ): Promise<void> {
    await Promise.all([
      db
        .update(apiKeyRateLimits)
        .set({
          requestCount: sql`${apiKeyRateLimits.requestCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(apiKeyRateLimits.id, buckets.minute.id)),
      db
        .update(apiKeyRateLimits)
        .set({
          requestCount: sql`${apiKeyRateLimits.requestCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(apiKeyRateLimits.id, buckets.hour.id)),
      db
        .update(apiKeyRateLimits)
        .set({
          requestCount: sql`${apiKeyRateLimits.requestCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(apiKeyRateLimits.id, buckets.day.id)),
    ]);
  }

  /**
   * Get bucket key for a given time and type
   */
  private getBucketKey(date: Date, type: string): string {
    const d = new Date(date);

    switch (type) {
      case 'minute':
        d.setSeconds(0, 0);
        return d.toISOString().slice(0, 16);
      case 'hour':
        d.setMinutes(0, 0, 0);
        return d.toISOString().slice(0, 13);
      case 'day':
        d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
      default:
        return d.toISOString();
    }
  }

  /**
   * Get bucket start and end times
   */
  private getBucketBounds(date: Date, type: string): { start: Date; end: Date } {
    const start = new Date(date);
    const end = new Date(date);

    switch (type) {
      case 'minute':
        start.setSeconds(0, 0);
        end.setSeconds(0, 0);
        end.setMinutes(end.getMinutes() + 1);
        break;
      case 'hour':
        start.setMinutes(0, 0, 0);
        end.setMinutes(0, 0, 0);
        end.setHours(end.getHours() + 1);
        break;
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + 1);
        break;
    }

    return { start, end };
  }

  /**
   * Log API key usage
   */
  async logUsage(
    apiKeyId: string,
    tenantId: string,
    request: {
      requestId: string;
      method: string;
      path: string;
      queryParams?: Record<string, any>;
      clientIp?: string;
      userAgent?: string;
      origin?: string;
    },
    response: {
      statusCode: number;
      responseTimeMs: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    await db.insert(apiKeyUsageLogs).values({
      apiKeyId,
      tenantId,
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      queryParams: request.queryParams || {},
      clientIp: request.clientIp,
      userAgent: request.userAgent,
      origin: request.origin,
      statusCode: response.statusCode,
      responseTimeMs: response.responseTimeMs,
      errorMessage: response.errorMessage,
    });
  }

  /**
   * Get API key by ID
   */
  async getApiKey(id: string, tenantId: string): Promise<ApiKey | null> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.tenantId, tenantId)
        )
      );

    return apiKey || null;
  }

  /**
   * List API keys for a tenant
   */
  async listApiKeys(
    tenantId: string,
    options: {
      status?: string;
      keyType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ keys: ApiKey[]; total: number }> {
    const conditions = [eq(apiKeys.tenantId, tenantId)];

    if (options.status) {
      conditions.push(eq(apiKeys.status, options.status as any));
    }
    if (options.keyType) {
      conditions.push(eq(apiKeys.keyType, options.keyType as any));
    }

    const keys = await db
      .select()
      .from(apiKeys)
      .where(and(...conditions))
      .orderBy(desc(apiKeys.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiKeys)
      .where(and(...conditions));

    return { keys, total: Number(count) };
  }

  /**
   * Update API key
   */
  async updateApiKey(
    id: string,
    tenantId: string,
    userId: string,
    updates: UpdateApiKeyRequest
  ): Promise<ApiKey | null> {
    const [apiKey] = await db
      .update(apiKeys)
      .set({
        ...updates,
        expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.tenantId, tenantId)
        )
      )
      .returning();

    return apiKey || null;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(
    id: string,
    tenantId: string,
    userId: string,
    reason?: string
  ): Promise<boolean> {
    const result = await db
      .update(apiKeys)
      .set({
        status: 'revoked',
        isActive: false,
        revokedAt: new Date(),
        revokedBy: userId,
        revokedReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.tenantId, tenantId)
        )
      )
      .returning({ id: apiKeys.id });

    return result.length > 0;
  }

  /**
   * Rotate an API key (create new, keep old with grace period)
   */
  async rotateApiKey(
    id: string,
    tenantId: string,
    userId: string,
    options: {
      gracePeriodHours?: number;
      reason?: string;
    } = {}
  ): Promise<GeneratedApiKey | null> {
    const oldKey = await this.getApiKey(id, tenantId);
    if (!oldKey) {
      return null;
    }

    // Create new key with same settings
    const newKey = await this.createApiKey(tenantId, userId, {
      name: oldKey.name,
      description: oldKey.description || undefined,
      keyType: oldKey.keyType as any,
      scopes: (oldKey.scopes as string[]) || [],
      permissions: (oldKey.permissions as string[]) || [],
      neverExpires: oldKey.neverExpires,
      allowedIps: (oldKey.allowedIps as string[]) || [],
      allowAllIps: oldKey.allowAllIps,
      rateLimitPerMinute: oldKey.rateLimitPerMinute || 1000,
      rateLimitPerHour: oldKey.rateLimitPerHour || 10000,
      rateLimitPerDay: oldKey.rateLimitPerDay || 100000,
      environment: oldKey.environment || 'production',
      metadata: (oldKey.metadata as Record<string, any>) || {},
      tags: (oldKey.tags as string[]) || [],
    });

    // Calculate grace period
    const gracePeriodHours = options.gracePeriodHours ?? 24;
    const gracePeriodEndsAt = new Date(
      Date.now() + gracePeriodHours * 60 * 60 * 1000
    );

    // Log the rotation
    await db.insert(apiKeyRotations).values({
      apiKeyId: oldKey.id,
      tenantId,
      oldKeyPrefix: oldKey.keyPrefix,
      oldKeyHash: oldKey.keyHash,
      newKeyPrefix: newKey.prefix,
      rotatedBy: userId,
      reason: options.reason,
      gracePeriodEndsAt,
    });

    // Mark old key to be disabled after grace period
    await db
      .update(apiKeys)
      .set({
        metadata: {
          ...((oldKey.metadata as Record<string, any>) || {}),
          rotatedTo: newKey.id,
          gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id));

    return newKey;
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.tenantId, tenantId)
        )
      )
      .returning({ id: apiKeys.id });

    return result.length > 0;
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(
    apiKeyId: string,
    tenantId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    topPaths: { path: string; count: number }[];
    requestsByHour: { hour: string; count: number }[];
  }> {
    const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || new Date();

    const logs = await db
      .select()
      .from(apiKeyUsageLogs)
      .where(
        and(
          eq(apiKeyUsageLogs.apiKeyId, apiKeyId),
          eq(apiKeyUsageLogs.tenantId, tenantId),
          gte(apiKeyUsageLogs.timestamp, startDate),
          lte(apiKeyUsageLogs.timestamp, endDate)
        )
      );

    const totalRequests = logs.length;
    const successfulRequests = logs.filter(l => l.statusCode && l.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const avgResponseTime = logs.reduce((sum, l) => sum + (l.responseTimeMs || 0), 0) /
      (totalRequests || 1);

    // Group by path
    const pathCounts = new Map<string, number>();
    logs.forEach(l => {
      pathCounts.set(l.path, (pathCounts.get(l.path) || 0) + 1);
    });
    const topPaths = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    // Group by hour
    const hourCounts = new Map<string, number>();
    logs.forEach(l => {
      const hour = l.timestamp.toISOString().slice(0, 13);
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
    const requestsByHour = Array.from(hourCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, count }));

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(avgResponseTime),
      topPaths,
      requestsByHour,
    };
  }

  /**
   * Clean up expired rate limit buckets
   */
  async cleanupExpiredBuckets(): Promise<number> {
    const result = await db
      .delete(apiKeyRateLimits)
      .where(lte(apiKeyRateLimits.bucketEnd, new Date()))
      .returning({ id: apiKeyRateLimits.id });

    return result.length;
  }

  /**
   * Disable expired API keys
   */
  async disableExpiredKeys(): Promise<number> {
    const result = await db
      .update(apiKeys)
      .set({
        status: 'expired',
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(apiKeys.status, 'active'),
          eq(apiKeys.neverExpires, false),
          lte(apiKeys.expiresAt, new Date())
        )
      )
      .returning({ id: apiKeys.id });

    return result.length;
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
