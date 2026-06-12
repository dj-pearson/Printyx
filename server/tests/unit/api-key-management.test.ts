/**
 * API Key Management Tests (US-020)
 *
 * Exercises the real ApiKeyService and requireApiKey middleware against a
 * mocked database: hashed (never plaintext) storage, masked key display,
 * scope enforcement, expired/revoked key rejection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import type { Request, Response } from 'express';

const mockDb = vi.hoisted(() => ({
  selectRows: [] as any[],
  insertValues: [] as any[],
  updateSets: [] as any[],
  updateReturning: [] as any[],
}));

vi.mock('../../db', () => {
  const thenable = (rows: () => any[]) => {
    const p: any = {
      then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject),
      limit: async () => rows(),
      returning: async () => rows(),
      offset: async () => rows(),
      orderBy: () => p,
    };
    return p;
  };

  return {
    db: {
      insert: () => ({
        values: (vals: any) => {
          mockDb.insertValues.push(vals);
          return {
            returning: async () => [{ id: 'generated-id', createdAt: new Date(), ...vals }],
            onConflictDoUpdate: () => ({
              returning: async () => [
                { id: 'bucket-id', requestCount: 0, bucketEnd: new Date(), ...vals },
              ],
            }),
          };
        },
      }),
      select: () => ({
        from: () => ({
          where: () => thenable(() => mockDb.selectRows),
        }),
      }),
      update: () => ({
        set: (vals: any) => {
          mockDb.updateSets.push(vals);
          return {
            where: () => thenable(() => mockDb.updateReturning),
          };
        },
      }),
      delete: () => ({
        where: () => thenable(() => mockDb.updateReturning),
      }),
    },
  };
});

import { apiKeyService, maskApiKey } from '../../services/api-key-service';
import { requireApiKey } from '../../middleware/api-key-auth';

function hmac(key: string, salt: string): string {
  return createHmac('sha256', salt).update(key).digest('hex');
}

function buildStoredKey(fullKey: string, overrides: Record<string, any> = {}) {
  const salt = 'test-salt';
  return {
    id: 'key-1',
    tenantId: 'tenant-a',
    name: 'Stored Key',
    keyType: 'service',
    keyPrefix: fullKey.substring(0, 'pk_live_'.length + 8),
    keyLast4: fullKey.slice(-4),
    keyHash: hmac(fullKey, salt),
    keySalt: salt,
    status: 'active',
    isActive: true,
    expiresAt: null,
    neverExpires: true,
    scopes: ['customers:read'],
    permissions: [],
    allowedIps: [],
    allowAllIps: true,
    usageCount: '0',
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

function mockReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers,
    query: {},
    ip: '10.0.0.1',
  } as unknown as Request;

  const res: any = {
    statusCode: 200,
    body: undefined,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };

  return { req, res: res as Response & { statusCode: number; body: any } };
}

beforeEach(() => {
  mockDb.selectRows = [];
  mockDb.insertValues = [];
  mockDb.updateSets = [];
  mockDb.updateReturning = [];
});

describe('maskApiKey', () => {
  it('reveals only the last 4 characters', () => {
    expect(maskApiKey('abcd')).toBe('••••••••abcd');
    expect(maskApiKey('abcd')).not.toContain('pk_');
  });

  it('handles legacy keys without stored last4', () => {
    expect(maskApiKey(null)).toBe('••••••••????');
    expect(maskApiKey(undefined)).toBe('••••••••????');
  });
});

describe('ApiKeyService.createApiKey', () => {
  it('returns the full key once and stores only a hash', async () => {
    const generated = await apiKeyService.createApiKey('tenant-a', 'user-1', {
      name: 'Integration Key',
      keyType: 'service',
      scopes: ['customers:read'],
      permissions: [],
      neverExpires: false,
      allowedIps: [],
      allowAllIps: true,
      rateLimitPerMinute: 100,
      rateLimitPerHour: 1000,
      rateLimitPerDay: 10000,
      environment: 'production',
      metadata: {},
      tags: [],
    });

    expect(generated.key).toMatch(/^pk_live_/);
    expect(generated.key.length).toBeGreaterThan(40);

    const stored = mockDb.insertValues[0];
    // The full key must never reach the database
    expect(JSON.stringify(stored)).not.toContain(generated.key);
    expect(stored.keyHash).toBeTruthy();
    expect(stored.keyHash).not.toBe(generated.key);
    expect(stored.keyHash).toBe(hmac(generated.key, stored.keySalt));
    expect(stored.tenantId).toBe('tenant-a');
    expect(stored.createdBy).toBe('user-1');
  });

  it('stores keyLast4 and returns a masked key for display', async () => {
    const generated = await apiKeyService.createApiKey('tenant-a', 'user-1', {
      name: 'Masked Key',
      keyType: 'readonly',
      scopes: [],
      permissions: [],
      neverExpires: true,
      allowedIps: [],
      allowAllIps: true,
      rateLimitPerMinute: 100,
      rateLimitPerHour: 1000,
      rateLimitPerDay: 10000,
      environment: 'production',
      metadata: {},
      tags: [],
    });

    const last4 = generated.key.slice(-4);
    expect(mockDb.insertValues[0].keyLast4).toBe(last4);
    expect(generated.maskedKey).toBe(`••••••••${last4}`);
  });

  it('uses test prefix for non-production keys', async () => {
    const generated = await apiKeyService.createApiKey('tenant-a', 'user-1', {
      name: 'Dev Key',
      keyType: 'service',
      scopes: [],
      permissions: [],
      neverExpires: true,
      allowedIps: [],
      allowAllIps: true,
      rateLimitPerMinute: 100,
      rateLimitPerHour: 1000,
      rateLimitPerDay: 10000,
      environment: 'development',
      metadata: {},
      tags: [],
    });

    expect(generated.key).toMatch(/^pk_test_/);
  });
});

describe('ApiKeyService.validateApiKey', () => {
  const fullKey = 'pk_live_abcdefgh12345678ijklmnop90qrstuv';

  it('accepts a valid active key', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey)];
    const result = await apiKeyService.validateApiKey(fullKey, '10.0.0.1');
    expect(result.valid).toBe(true);
    expect(result.apiKey?.tenantId).toBe('tenant-a');
  });

  it('rejects an unknown key', async () => {
    mockDb.selectRows = [];
    const result = await apiKeyService.validateApiKey(fullKey, '10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_KEY');
  });

  it('rejects a key whose hash does not match (tampered key)', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey, { keyHash: hmac('pk_live_other', 'test-salt') })];
    const result = await apiKeyService.validateApiKey(fullKey, '10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_KEY');
  });

  it('rejects an expired key', async () => {
    mockDb.selectRows = [
      buildStoredKey(fullKey, {
        neverExpires: false,
        expiresAt: new Date(Date.now() - 60_000),
      }),
    ];
    const result = await apiKeyService.validateApiKey(fullKey, '10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('EXPIRED');
  });

  it('rejects a revoked key', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey, { status: 'revoked' })];
    const result = await apiKeyService.validateApiKey(fullKey, '10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('REVOKED');
  });

  it('rejects an inactive key', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey, { isActive: false })];
    const result = await apiKeyService.validateApiKey(fullKey, '10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INACTIVE');
  });

  it('rejects requests from non-allowed IPs', async () => {
    mockDb.selectRows = [
      buildStoredKey(fullKey, { allowAllIps: false, allowedIps: ['192.168.1.1'] }),
    ];
    const result = await apiKeyService.validateApiKey(fullKey, '10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('IP_RESTRICTED');
  });

  it('rejects malformed keys without touching the database', async () => {
    const result = await apiKeyService.validateApiKey('not-a-key', '10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_KEY');
  });
});

describe('ApiKeyService.revokeApiKey', () => {
  it('marks the key revoked with audit fields', async () => {
    mockDb.updateReturning = [{ id: 'key-1' }];
    const ok = await apiKeyService.revokeApiKey('key-1', 'tenant-a', 'user-1', 'compromised');
    expect(ok).toBe(true);

    const set = mockDb.updateSets[0];
    expect(set.status).toBe('revoked');
    expect(set.isActive).toBe(false);
    expect(set.revokedBy).toBe('user-1');
    expect(set.revokedReason).toBe('compromised');
    expect(set.revokedAt).toBeInstanceOf(Date);
  });

  it('returns false when key does not belong to tenant', async () => {
    mockDb.updateReturning = [];
    const ok = await apiKeyService.revokeApiKey('key-1', 'tenant-b', 'user-1');
    expect(ok).toBe(false);
  });
});

describe('requireApiKey middleware', () => {
  const fullKey = 'pk_live_abcdefgh12345678ijklmnop90qrstuv';

  it('returns 401 when no key is provided', async () => {
    const { req, res } = mockReqRes();
    const next = vi.fn();

    await requireApiKey()(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired key', async () => {
    mockDb.selectRows = [
      buildStoredKey(fullKey, {
        neverExpires: false,
        expiresAt: new Date(Date.now() - 60_000),
      }),
    ];
    const { req, res } = mockReqRes({ 'x-api-key': fullKey });
    const next = vi.fn();

    await requireApiKey()(req, res, next);

    expect(res.statusCode).toBe(401);
    expect((res as any).body.code).toBe('EXPIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a revoked key', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey, { status: 'revoked' })];
    const { req, res } = mockReqRes({ 'x-api-key': fullKey });
    const next = vi.fn();

    await requireApiKey()(req, res, next);

    expect(res.statusCode).toBe(401);
    expect((res as any).body.code).toBe('REVOKED');
  });

  it('returns 403 when the key lacks a required scope', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey, { scopes: ['customers:read'] })];
    const { req, res } = mockReqRes({ 'x-api-key': fullKey });
    const next = vi.fn();

    await requireApiKey({ requiredScopes: ['orders:write'] })(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a key with the required scope and attaches tenant context', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey, { scopes: ['customers:read'] })];
    const { req, res } = mockReqRes({ 'x-api-key': fullKey });
    const next = vi.fn();

    await requireApiKey({ requiredScopes: ['customers:read'] })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.apiKey?.id).toBe('key-1');
    expect(req.apiKey?.scopes).toEqual(['customers:read']);
    expect((req as any).tenantId).toBe('tenant-a');
  });

  it('allows a wildcard-scoped key for any required scope', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey, { scopes: ['*'] })];
    const { req, res } = mockReqRes({ 'x-api-key': fullKey });
    const next = vi.fn();

    await requireApiKey({ requiredScopes: ['orders:write', 'admin:users'] })(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('accepts the key via Authorization bearer header', async () => {
    mockDb.selectRows = [buildStoredKey(fullKey)];
    const { req, res } = mockReqRes({ authorization: `Bearer ${fullKey}` });
    const next = vi.fn();

    await requireApiKey()(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
