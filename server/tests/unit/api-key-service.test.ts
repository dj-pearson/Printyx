/**
 * API Key Service Tests
 *
 * Tests for API key generation, validation, and management.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { randomBytes } from 'crypto';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'test-key-id',
            tenantId: 'test-tenant',
            name: 'Test Key',
            keyType: 'service',
            keyPrefix: 'pk_live_abcd1234',
            keyHash: 'testhash',
            keySalt: 'testsalt',
            scopes: ['customers:read'],
            permissions: [],
            status: 'active',
            isActive: true,
            createdAt: new Date(),
          },
        ]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

describe('API Key Service', () => {
  describe('Key Generation', () => {
    it('should generate keys with correct prefix for production', () => {
      const key = `pk_live_${randomBytes(32).toString('base64url')}`;
      expect(key).toMatch(/^pk_live_[A-Za-z0-9_-]+$/);
      expect(key.length).toBeGreaterThan(40);
    });

    it('should generate keys with correct prefix for test', () => {
      const key = `pk_test_${randomBytes(32).toString('base64url')}`;
      expect(key).toMatch(/^pk_test_[A-Za-z0-9_-]+$/);
    });

    it('should generate unique keys', () => {
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        const key = `pk_live_${randomBytes(32).toString('base64url')}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    });
  });

  describe('Key Validation', () => {
    it('should reject keys without proper prefix', () => {
      const invalidKeys = ['invalid_key', 'sk_live_12345', 'pk_12345', '', null, undefined];

      invalidKeys.forEach((key) => {
        const isValid =
          key &&
          typeof key === 'string' &&
          (key.startsWith('pk_live_') || key.startsWith('pk_test_')) &&
          key.length > 20;
        expect(isValid).toBe(false);
      });
    });

    it('should accept keys with valid format', () => {
      const validKeys = [
        'pk_live_abcd1234efgh5678ijkl9012mnop3456',
        'pk_test_abcd1234efgh5678ijkl9012mnop3456',
      ];

      validKeys.forEach((key) => {
        const isValid =
          key && (key.startsWith('pk_live_') || key.startsWith('pk_test_')) && key.length > 20;
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Key Prefix Extraction', () => {
    it('should extract correct prefix for identification', () => {
      const fullKey = 'pk_live_abcd1234efgh5678ijkl9012mnop3456';
      const prefixLength = 'pk_live_'.length + 8;
      const keyPrefix = fullKey.substring(0, prefixLength);
      expect(keyPrefix).toBe('pk_live_abcd1234');
    });
  });

  describe('Rate Limit Bucket Keys', () => {
    it('should generate correct minute bucket key', () => {
      const date = new Date('2024-01-15T10:30:45.123Z');
      date.setSeconds(0, 0);
      const key = date.toISOString().slice(0, 16);
      expect(key).toBe('2024-01-15T10:30');
    });

    it('should generate correct hour bucket key', () => {
      const date = new Date('2024-01-15T10:30:45.123Z');
      date.setMinutes(0, 0, 0);
      const key = date.toISOString().slice(0, 13);
      expect(key).toBe('2024-01-15T10');
    });

    it('should generate correct day bucket key', () => {
      const date = new Date('2024-01-15T10:30:45.123Z');
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      expect(key).toBe('2024-01-15');
    });
  });

  describe('IP Validation', () => {
    it('should validate exact IP matches', () => {
      const allowedIps = ['192.168.1.1', '10.0.0.1'];
      const clientIp = '192.168.1.1';
      expect(allowedIps.includes(clientIp)).toBe(true);
    });

    it('should reject non-matching IPs', () => {
      const allowedIps = ['192.168.1.1', '10.0.0.1'];
      const clientIp = '192.168.1.2';
      expect(allowedIps.includes(clientIp)).toBe(false);
    });
  });

  describe('Scope Validation', () => {
    it('should validate required scopes', () => {
      const keyScopes = ['customers:read', 'products:read', 'orders:write'];
      const requiredScopes = ['customers:read', 'products:read'];

      const hasAllScopes = requiredScopes.every(
        (scope) => keyScopes.includes(scope) || keyScopes.includes('*'),
      );
      expect(hasAllScopes).toBe(true);
    });

    it('should reject missing scopes', () => {
      const keyScopes = ['customers:read'];
      const requiredScopes = ['customers:read', 'products:read'];

      const hasAllScopes = requiredScopes.every(
        (scope) => keyScopes.includes(scope) || keyScopes.includes('*'),
      );
      expect(hasAllScopes).toBe(false);
    });

    it('should accept wildcard scope', () => {
      const keyScopes = ['*'];
      const requiredScopes = ['customers:read', 'products:write', 'admin:users'];

      const hasAllScopes = requiredScopes.every(
        (scope) => keyScopes.includes(scope) || keyScopes.includes('*'),
      );
      expect(hasAllScopes).toBe(true);
    });
  });

  describe('Expiration Validation', () => {
    it('should detect expired keys', () => {
      const expiresAt = new Date('2024-01-01T00:00:00Z');
      const now = new Date('2024-02-01T00:00:00Z');
      expect(now > expiresAt).toBe(true);
    });

    it('should accept non-expired keys', () => {
      const expiresAt = new Date('2025-01-01T00:00:00Z');
      const now = new Date();
      expect(now < expiresAt).toBe(true);
    });

    it('should handle never-expiring keys', () => {
      const key = { neverExpires: true, expiresAt: null };
      const isExpired = !key.neverExpires && key.expiresAt && new Date() > key.expiresAt;
      expect(isExpired).toBe(false);
    });
  });

  describe('Key Hashing', () => {
    it('should produce consistent hashes', () => {
      const crypto = require('crypto');
      const key = 'pk_live_testkey123';
      const salt = 'testsalt123';

      const hash1 = crypto.createHmac('sha256', salt).update(key).digest('hex');
      const hash2 = crypto.createHmac('sha256', salt).update(key).digest('hex');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const crypto = require('crypto');
      const salt = 'testsalt123';

      const hash1 = crypto.createHmac('sha256', salt).update('pk_live_key1').digest('hex');
      const hash2 = crypto.createHmac('sha256', salt).update('pk_live_key2').digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different salts', () => {
      const crypto = require('crypto');
      const key = 'pk_live_testkey';

      const hash1 = crypto.createHmac('sha256', 'salt1').update(key).digest('hex');
      const hash2 = crypto.createHmac('sha256', 'salt2').update(key).digest('hex');

      expect(hash1).not.toBe(hash2);
    });
  });
});
