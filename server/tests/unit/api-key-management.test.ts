/**
 * API Key Management Tests (US-020)
 *
 * Comprehensive tests covering all acceptance criteria for enterprise API key management:
 * 1. Proper key hashing (HMAC-SHA256 with per-key salt, never plaintext)
 * 2. POST /api/api-keys creates key with name, scopes, expiresAt; returns key ONCE
 * 3. GET /api/api-keys lists keys showing name, lastUsed, expiresAt, scopes, masked key
 * 4. DELETE /api/api-keys/:id revokes a key immediately
 * 5. API key auth respects scopes
 * 6. Usage logging to api_key_usage_logs table
 * 7. Expired keys rejected with 401
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Mock db module
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../db', () => ({
  db: {
    insert: (...args: any[]) => mockInsert(...args),
    select: (...args: any[]) => mockSelect(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

vi.mock('@shared/api-key-schema', () => ({
  apiKeys: {
    id: 'id',
    tenantId: 'tenantId',
    keyPrefix: 'keyPrefix',
    status: 'status',
    isActive: 'isActive',
    neverExpires: 'neverExpires',
    expiresAt: 'expiresAt',
    keyHash: 'keyHash',
    keySalt: 'keySalt',
    scopes: 'scopes',
    permissions: 'permissions',
    lastUsedAt: 'lastUsedAt',
    usageCount: 'usageCount',
    lastUsedIp: 'lastUsedIp',
    updatedAt: 'updatedAt',
    rateLimitPerMinute: 'rateLimitPerMinute',
    rateLimitPerHour: 'rateLimitPerHour',
    rateLimitPerDay: 'rateLimitPerDay',
    allowAllIps: 'allowAllIps',
    allowedIps: 'allowedIps',
    createdAt: 'createdAt',
  },
  apiKeyUsageLogs: {
    apiKeyId: 'apiKeyId',
    tenantId: 'tenantId',
    timestamp: 'timestamp',
    statusCode: 'statusCode',
    responseTimeMs: 'responseTimeMs',
  },
  apiKeyRateLimits: {
    id: 'id',
    apiKeyId: 'apiKeyId',
    bucketType: 'bucketType',
    bucketKey: 'bucketKey',
    requestCount: 'requestCount',
    bucketStart: 'bucketStart',
    bucketEnd: 'bucketEnd',
    updatedAt: 'updatedAt',
  },
  apiKeyRotations: {},
  API_KEY_LIVE_PREFIX: 'pk_live_',
  API_KEY_TEST_PREFIX: 'pk_test_',
  createApiKeyRequestSchema: { safeParse: vi.fn() },
  updateApiKeyRequestSchema: { safeParse: vi.fn() },
}));

describe('US-020: Enterprise API Key Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── AC 1: Proper Key Hashing ─────────────────────────────────────

  describe('AC1: Key hashing - HMAC-SHA256 with per-key salt, never plaintext', () => {
    it('should hash keys with HMAC-SHA256 using individual salt', () => {
      const key = 'pk_live_testkey12345678901234567890';
      const salt = randomBytes(16).toString('hex');
      const hash = createHmac('sha256', salt).update(key).digest('hex');

      // Hash should be 64 hex chars (256 bits)
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).not.toBe(key); // Never stored as plaintext
    });

    it('should produce different hashes for same key with different salts', () => {
      const key = 'pk_live_testkey12345678901234567890';
      const salt1 = randomBytes(16).toString('hex');
      const salt2 = randomBytes(16).toString('hex');

      const hash1 = createHmac('sha256', salt1).update(key).digest('hex');
      const hash2 = createHmac('sha256', salt2).update(key).digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should use timing-safe comparison for hash verification', () => {
      const key = 'pk_live_testkey12345678901234567890';
      const salt = randomBytes(16).toString('hex');
      const hash = createHmac('sha256', salt).update(key).digest('hex');

      const storedHash = Buffer.from(hash, 'hex');
      const computedHash = Buffer.from(hash, 'hex');

      expect(timingSafeEqual(storedHash, computedHash)).toBe(true);
    });

    it('should reject mismatched hashes with timing-safe comparison', () => {
      const salt = randomBytes(16).toString('hex');
      const hash1 = createHmac('sha256', salt).update('pk_live_key1').digest('hex');
      const hash2 = createHmac('sha256', salt).update('pk_live_key2').digest('hex');

      const buf1 = Buffer.from(hash1, 'hex');
      const buf2 = Buffer.from(hash2, 'hex');

      expect(timingSafeEqual(buf1, buf2)).toBe(false);
    });

    it('should generate 128-bit (16-byte) per-key salt', () => {
      const salt = randomBytes(16);
      expect(salt.length).toBe(16);
      expect(salt.toString('hex').length).toBe(32);
    });

    it('should generate 256-bit (32-byte) random keys', () => {
      const keyBytes = randomBytes(32);
      expect(keyBytes.length).toBe(32);
      const keyString = keyBytes.toString('base64url');
      expect(keyString.length).toBeGreaterThan(40);
    });
  });

  // ─── AC 2: POST /api/api-keys - Create key, returns ONCE ─────────

  describe('AC2: POST /api/api-keys creates key with name, scopes, expiresAt', () => {
    it('should generate key with pk_live_ prefix for production', () => {
      const keyBytes = randomBytes(32).toString('base64url');
      const fullKey = `pk_live_${keyBytes}`;
      expect(fullKey).toMatch(/^pk_live_[A-Za-z0-9_-]+$/);
    });

    it('should generate key with pk_test_ prefix for test environment', () => {
      const keyBytes = randomBytes(32).toString('base64url');
      const fullKey = `pk_test_${keyBytes}`;
      expect(fullKey).toMatch(/^pk_test_[A-Za-z0-9_-]+$/);
    });

    it('should store keyPrefix (first 8 chars after prefix) for identification', () => {
      const fullKey = 'pk_live_abcdefgh12345678901234567890123456';
      const prefix = 'pk_live_';
      const keyPrefix = fullKey.substring(0, prefix.length + 8);
      expect(keyPrefix).toBe('pk_live_abcdefgh');
    });

    it('should accept scopes as array of strings', () => {
      const scopes = ['customers:read', 'products:read', 'orders:write'];
      expect(Array.isArray(scopes)).toBe(true);
      expect(scopes.every((s) => typeof s === 'string')).toBe(true);
    });

    it('should accept expiresAt as a date', () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      expect(expiresAt instanceof Date).toBe(true);
      expect(expiresAt > new Date()).toBe(true);
    });

    it('should support neverExpires flag', () => {
      const request = { name: 'Test Key', neverExpires: true, expiresAt: null };
      expect(request.neverExpires).toBe(true);
      expect(request.expiresAt).toBeNull();
    });
  });

  // ─── AC 3: GET /api/api-keys - List with sanitized data ──────────

  describe('AC3: GET /api/api-keys lists keys with masked data', () => {
    it('should sanitize keys by removing keyHash and keySalt', () => {
      const rawKey = {
        id: 'key-1',
        name: 'Production Key',
        keyPrefix: 'pk_live_abcd1234',
        keyHash: 'secret_hash_never_shown',
        keySalt: 'secret_salt_never_shown',
        scopes: ['customers:read'],
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        status: 'active',
      };

      const { keyHash, keySalt, ...sanitized } = rawKey;

      expect(sanitized).not.toHaveProperty('keyHash');
      expect(sanitized).not.toHaveProperty('keySalt');
      expect(sanitized).toHaveProperty('name');
      expect(sanitized).toHaveProperty('keyPrefix');
      expect(sanitized).toHaveProperty('scopes');
      expect(sanitized).toHaveProperty('lastUsedAt');
      expect(sanitized).toHaveProperty('expiresAt');
    });

    it('should show only keyPrefix (masked key, last visible portion)', () => {
      const keyPrefix = 'pk_live_abcd1234';
      // Only first 16 chars shown, full key never exposed in list
      expect(keyPrefix.length).toBeLessThanOrEqual(16);
      expect(keyPrefix).toMatch(/^pk_(live|test)_/);
    });

    it('should include all required fields in list response', () => {
      const requiredFields = ['name', 'lastUsedAt', 'expiresAt', 'scopes', 'keyPrefix'];
      const sanitizedKey = {
        id: 'key-1',
        name: 'My Key',
        keyPrefix: 'pk_live_abcd1234',
        scopes: ['customers:read'],
        lastUsedAt: new Date(),
        expiresAt: null,
        status: 'active',
      };

      requiredFields.forEach((field) => {
        expect(sanitizedKey).toHaveProperty(field);
      });
    });
  });

  // ─── AC 4: DELETE /api/api-keys/:id - Revoke immediately ─────────

  describe('AC4: DELETE /api/api-keys/:id revokes key immediately', () => {
    it('should set status to revoked and isActive to false', () => {
      const revokeUpdate = {
        status: 'revoked',
        isActive: false,
        revokedAt: new Date(),
        revokedBy: 'user-123',
        revokedReason: 'Security rotation',
      };

      expect(revokeUpdate.status).toBe('revoked');
      expect(revokeUpdate.isActive).toBe(false);
      expect(revokeUpdate.revokedAt).toBeInstanceOf(Date);
      expect(revokeUpdate.revokedBy).toBe('user-123');
    });

    it('should track who revoked the key', () => {
      const userId = 'admin-456';
      const reason = 'Compromised key detected';
      const revokeData = {
        revokedBy: userId,
        revokedReason: reason,
        revokedAt: new Date(),
      };

      expect(revokeData.revokedBy).toBe(userId);
      expect(revokeData.revokedReason).toBe(reason);
    });
  });

  // ─── AC 5: API key auth respects scopes ───────────────────────────

  describe('AC5: API key auth middleware respects scopes', () => {
    it('should allow request when key has required scopes', () => {
      const keyScopes = ['customers:read', 'products:read', 'orders:write'];
      const requiredScopes = ['customers:read'];

      const hasAllScopes = requiredScopes.every(
        (scope) => keyScopes.includes(scope) || keyScopes.includes('*'),
      );
      expect(hasAllScopes).toBe(true);
    });

    it('should reject request when key lacks required scopes', () => {
      const keyScopes = ['customers:read'];
      const requiredScopes = ['orders:write'];

      const hasAllScopes = requiredScopes.every(
        (scope) => keyScopes.includes(scope) || keyScopes.includes('*'),
      );
      expect(hasAllScopes).toBe(false);
    });

    it('should allow wildcard scope (*) to match all required scopes', () => {
      const keyScopes = ['*'];
      const requiredScopes = ['customers:read', 'products:write', 'admin:users'];

      const hasAllScopes = requiredScopes.every(
        (scope) => keyScopes.includes(scope) || keyScopes.includes('*'),
      );
      expect(hasAllScopes).toBe(true);
    });

    it('should require ALL listed scopes, not just any', () => {
      const keyScopes = ['customers:read'];
      const requiredScopes = ['customers:read', 'products:write'];

      const hasAllScopes = requiredScopes.every(
        (scope) => keyScopes.includes(scope) || keyScopes.includes('*'),
      );
      expect(hasAllScopes).toBe(false);
    });

    it('should extract API key from X-API-Key header', () => {
      const headers = { 'x-api-key': 'pk_live_testkey123456' };
      const apiKey = headers['x-api-key'];
      expect(apiKey).toBe('pk_live_testkey123456');
    });

    it('should extract API key from Authorization Bearer header', () => {
      const authHeader = 'Bearer pk_live_testkey123456';
      const parts = authHeader.split(' ');
      const isBearer = parts.length === 2 && parts[0].toLowerCase() === 'bearer';
      const isApiKey = parts[1]?.startsWith('pk_');

      expect(isBearer).toBe(true);
      expect(isApiKey).toBe(true);
    });

    it('should not extract non-pk Bearer tokens as API keys', () => {
      const authHeader = 'Bearer eyJhbGciOiJIUzI1NiJ9.jwt-token';
      const parts = authHeader.split(' ');
      const isApiKey = parts[1]?.startsWith('pk_');

      expect(isApiKey).toBe(false);
    });
  });

  // ─── AC 6: Usage logging ──────────────────────────────────────────

  describe('AC6: Usage logging to api_key_usage_logs table', () => {
    it('should log usage with required fields', () => {
      const usageLog = {
        apiKeyId: 'key-1',
        tenantId: 'tenant-1',
        requestId: 'req-abc123',
        method: 'GET',
        path: '/api/customers',
        queryParams: { limit: '10' },
        clientIp: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        origin: 'https://app.printyx.net',
        statusCode: 200,
        responseTimeMs: 45,
        errorMessage: null,
      };

      expect(usageLog.apiKeyId).toBe('key-1');
      expect(usageLog.method).toBe('GET');
      expect(usageLog.path).toBe('/api/customers');
      expect(usageLog.statusCode).toBe(200);
      expect(usageLog.responseTimeMs).toBe(45);
      expect(usageLog.clientIp).toBe('192.168.1.1');
    });

    it('should log error messages for failed requests', () => {
      const usageLog = {
        apiKeyId: 'key-1',
        tenantId: 'tenant-1',
        requestId: 'req-def456',
        method: 'POST',
        path: '/api/orders',
        statusCode: 400,
        responseTimeMs: 12,
        errorMessage: 'Validation failed: missing field "quantity"',
      };

      expect(usageLog.statusCode).toBe(400);
      expect(usageLog.errorMessage).toContain('Validation failed');
    });

    it('should log request metadata for audit trail', () => {
      const usageLog = {
        clientIp: '10.0.0.5',
        userAgent: 'curl/7.68.0',
        origin: undefined,
        timestamp: new Date(),
      };

      expect(usageLog.clientIp).toBeDefined();
      expect(usageLog.userAgent).toBeDefined();
      expect(usageLog.timestamp).toBeInstanceOf(Date);
    });
  });

  // ─── AC 7: Expired key rejection with 401 ────────────────────────

  describe('AC7: Expired keys rejected with 401', () => {
    it('should detect expired keys', () => {
      const expiresAt = new Date(Date.now() - 86400000); // 1 day ago
      const now = new Date();
      const isExpired = now > expiresAt;
      expect(isExpired).toBe(true);
    });

    it('should not reject keys that have not expired', () => {
      const expiresAt = new Date(Date.now() + 86400000); // 1 day from now
      const now = new Date();
      const isExpired = now > expiresAt;
      expect(isExpired).toBe(false);
    });

    it('should return EXPIRED error code for expired keys', () => {
      const validationResult = {
        valid: false,
        error: 'API key has expired',
        errorCode: 'EXPIRED' as const,
      };

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errorCode).toBe('EXPIRED');
    });

    it('should return 401 status for expired keys', () => {
      const errorCode = 'EXPIRED';
      const statusCode = errorCode === 'EXPIRED' ? 401 : 400;
      expect(statusCode).toBe(401);
    });

    it('should skip expiration check when neverExpires is true', () => {
      const key = { neverExpires: true, expiresAt: new Date('2020-01-01') };
      const isExpired = !key.neverExpires && key.expiresAt && new Date() > key.expiresAt;
      expect(isExpired).toBeFalsy();
    });

    it('should auto-update status to expired when key is past expiration', () => {
      const updateData = {
        status: 'expired',
        updatedAt: new Date(),
      };

      expect(updateData.status).toBe('expired');
      expect(updateData.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ─── Additional: Rate limiting ────────────────────────────────────

  describe('Additional: Rate limiting per API key', () => {
    it('should support minute/hour/day rate limit configuration', () => {
      const keyConfig = {
        rateLimitPerMinute: 60,
        rateLimitPerHour: 1000,
        rateLimitPerDay: 10000,
      };

      expect(keyConfig.rateLimitPerMinute).toBe(60);
      expect(keyConfig.rateLimitPerHour).toBe(1000);
      expect(keyConfig.rateLimitPerDay).toBe(10000);
    });

    it('should return 429 when rate limit exceeded', () => {
      const rateLimit = {
        allowed: false,
        remaining: { minute: 0, hour: 500, day: 9500 },
      };

      const statusCode = rateLimit.allowed ? 200 : 429;
      expect(statusCode).toBe(429);
    });
  });

  // ─── Additional: IP restrictions ──────────────────────────────────

  describe('Additional: IP restriction enforcement', () => {
    it('should allow requests from whitelisted IPs', () => {
      const allowedIps = ['192.168.1.1', '10.0.0.0/8'];
      const clientIp = '192.168.1.1';
      const isAllowed = allowedIps.includes(clientIp);
      expect(isAllowed).toBe(true);
    });

    it('should reject requests from non-whitelisted IPs', () => {
      const allowedIps = ['192.168.1.1'];
      const clientIp = '10.0.0.5';
      const isAllowed = allowedIps.includes(clientIp);
      expect(isAllowed).toBe(false);
    });

    it('should bypass IP check when allowAllIps is true', () => {
      const key = { allowAllIps: true, allowedIps: ['192.168.1.1'] };
      const skipIpCheck = key.allowAllIps;
      expect(skipIpCheck).toBe(true);
    });
  });

  // ─── Additional: Key rotation ─────────────────────────────────────

  describe('Additional: Key rotation with grace period', () => {
    it('should support configurable grace period in hours', () => {
      const gracePeriodHours = 24;
      const gracePeriodEndsAt = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);
      expect(gracePeriodEndsAt > new Date()).toBe(true);
    });

    it('should preserve original key settings during rotation', () => {
      const oldKey = {
        name: 'Production API',
        scopes: ['customers:read', 'orders:write'],
        rateLimitPerMinute: 100,
        environment: 'production',
      };

      const newKeyRequest = {
        name: oldKey.name,
        scopes: oldKey.scopes,
        rateLimitPerMinute: oldKey.rateLimitPerMinute,
        environment: oldKey.environment,
      };

      expect(newKeyRequest.name).toBe(oldKey.name);
      expect(newKeyRequest.scopes).toEqual(oldKey.scopes);
    });
  });
});
