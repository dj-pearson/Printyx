import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * SEC-013: Session Security Hardening Tests
 * Tests device fingerprinting, session fingerprint validation,
 * role-change session invalidation, and refresh token rotation with replay detection.
 */

// Mock dependencies
vi.mock('../../db', () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 3 }),
  },
}));

vi.mock('../../../shared/security-schema', () => ({
  securitySessions: {
    userId: 'userId',
    isActive: 'isActive',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  deviceFingerprint,
  sessionFingerprintMiddleware,
  invalidateSessionsOnRoleChange,
  rotateRefreshToken,
  createRefreshToken,
  isRefreshTokenValid,
  getSessionMetadata,
  trackUserSession,
  _stores,
  type SessionHardeningRequest,
} from '../../middleware/session-hardening';
import type { Response, NextFunction } from 'express';

function createMockRequest(overrides: Record<string, unknown> = {}): SessionHardeningRequest {
  return {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'accept-language': 'en-US,en;q=0.9',
      ...(overrides.headers as Record<string, string> || {}),
    },
    ...overrides,
  } as unknown as SessionHardeningRequest;
}

function createMockResponse(): Response {
  return {} as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('SEC-013: Session Security Hardening', () => {
  beforeEach(() => {
    // Clear all in-memory stores before each test
    _stores.sessionFingerprints.clear();
    _stores.refreshTokenStore.clear();
    _stores.revokedFamilies.clear();
    _stores.userSessions.clear();
  });

  // ============= DEVICE FINGERPRINTING =============

  describe('deviceFingerprint', () => {
    it('should produce consistent fingerprint for same headers', () => {
      const req1 = createMockRequest();
      const req2 = createMockRequest();

      const fp1 = deviceFingerprint(req1);
      const fp2 = deviceFingerprint(req2);

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(64); // SHA-256 hex digest
    });

    it('should produce different fingerprints for different User-Agent', () => {
      const req1 = createMockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/120',
          'accept-language': 'en-US',
        },
      });
      const req2 = createMockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0 Firefox/120',
          'accept-language': 'en-US',
        },
      });

      expect(deviceFingerprint(req1)).not.toBe(deviceFingerprint(req2));
    });

    it('should produce different fingerprints for different Accept-Language', () => {
      const req1 = createMockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/120',
          'accept-language': 'en-US,en;q=0.9',
        },
      });
      const req2 = createMockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/120',
          'accept-language': 'fr-FR,fr;q=0.9',
        },
      });

      expect(deviceFingerprint(req1)).not.toBe(deviceFingerprint(req2));
    });

    it('should handle missing headers gracefully', () => {
      const req = createMockRequest({ headers: {} });
      const fp = deviceFingerprint(req);

      expect(fp).toHaveLength(64);
      expect(typeof fp).toBe('string');
    });
  });

  // ============= SESSION FINGERPRINT MIDDLEWARE =============

  describe('sessionFingerprintMiddleware', () => {
    it('should store fingerprint on first request for a session', () => {
      const req = createMockRequest({
        headers: {
          'user-agent': 'TestAgent/1.0',
          'accept-language': 'en-US',
          'x-session-id': 'session-abc-123',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      sessionFingerprintMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.sessionFingerprintMismatch).toBe(false);
      expect(req.deviceFingerprint).toBeDefined();
      expect(_stores.sessionFingerprints.has('session-abc-123')).toBe(true);
    });

    it('should not flag matching fingerprint on subsequent request', () => {
      const headers = {
        'user-agent': 'TestAgent/1.0',
        'accept-language': 'en-US',
        'x-session-id': 'session-same-device',
      };

      const req1 = createMockRequest({ headers });
      const req2 = createMockRequest({ headers });
      const res = createMockResponse();
      const next = createMockNext();

      sessionFingerprintMiddleware(req1, res, next);
      sessionFingerprintMiddleware(req2, res, next);

      expect(req2.sessionFingerprintMismatch).toBe(false);
    });

    it('should flag fingerprint mismatch when device changes mid-session', () => {
      const sessionId = 'session-hijack-test';

      // First request with original device
      const req1 = createMockRequest({
        headers: {
          'user-agent': 'OriginalBrowser/1.0',
          'accept-language': 'en-US',
          'x-session-id': sessionId,
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      sessionFingerprintMiddleware(req1, res, next);
      expect(req1.sessionFingerprintMismatch).toBe(false);

      // Second request with different device (potential session hijacking)
      const req2 = createMockRequest({
        headers: {
          'user-agent': 'AttackerBrowser/2.0',
          'accept-language': 'zh-CN',
          'x-session-id': sessionId,
        },
      });

      sessionFingerprintMiddleware(req2, res, next);
      expect(req2.sessionFingerprintMismatch).toBe(true);
    });

    it('should call next even without session ID', () => {
      const req = createMockRequest({ headers: { 'user-agent': 'Test' } });
      const res = createMockResponse();
      const next = createMockNext();

      sessionFingerprintMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.sessionFingerprintMismatch).toBe(false);
    });
  });

  // ============= SESSION INVALIDATION ON ROLE CHANGE =============

  describe('invalidateSessionsOnRoleChange', () => {
    it('should invalidate all active sessions for a user', async () => {
      const userId = 'user-123-role-change';

      // Track some sessions for the user
      trackUserSession(userId, 'session-a');
      trackUserSession(userId, 'session-b');
      _stores.sessionFingerprints.set('session-a', {
        fingerprint: 'fp-a',
        userAgent: 'Agent/1',
        acceptLanguage: 'en',
        createdAt: Date.now(),
      });
      _stores.sessionFingerprints.set('session-b', {
        fingerprint: 'fp-b',
        userAgent: 'Agent/2',
        acceptLanguage: 'en',
        createdAt: Date.now(),
      });

      const count = await invalidateSessionsOnRoleChange(userId);

      expect(count).toBe(3); // Mocked rowCount
      // In-memory fingerprints should be cleaned up
      expect(_stores.sessionFingerprints.has('session-a')).toBe(false);
      expect(_stores.sessionFingerprints.has('session-b')).toBe(false);
      expect(_stores.userSessions.has(userId)).toBe(false);
    });

    it('should handle user with no tracked sessions', async () => {
      const count = await invalidateSessionsOnRoleChange('user-no-sessions');
      // Should still call db update (database may have sessions not tracked in memory)
      expect(count).toBe(3); // Mocked rowCount
    });
  });

  // ============= REFRESH TOKEN ROTATION =============

  describe('rotateRefreshToken', () => {
    it('should generate a new token and invalidate the old one', () => {
      const userId = 'user-token-rotate';
      const oldToken = createRefreshToken(userId);

      expect(isRefreshTokenValid(oldToken)).toBe(true);

      const newToken = rotateRefreshToken(oldToken);

      expect(newToken).not.toBeNull();
      expect(newToken).not.toBe(oldToken);
      expect(typeof newToken).toBe('string');
      expect(newToken!.length).toBeGreaterThan(0);

      // Old token should now be marked as used (invalid)
      expect(isRefreshTokenValid(oldToken)).toBe(false);
      // New token should be valid
      expect(isRefreshTokenValid(newToken!)).toBe(true);
    });

    it('should return null for unknown token', () => {
      const result = rotateRefreshToken('completely-unknown-token');
      expect(result).toBeNull();
    });

    it('should revoke entire token family on replay of used token', () => {
      const userId = 'user-replay-test';
      const originalToken = createRefreshToken(userId);

      // First rotation: legitimate
      const secondToken = rotateRefreshToken(originalToken);
      expect(secondToken).not.toBeNull();

      // Replay attack: attacker tries to use the original token again
      const replayResult = rotateRefreshToken(originalToken);
      expect(replayResult).toBeNull();

      // The second token (legitimate) should also be revoked (family revocation)
      expect(isRefreshTokenValid(secondToken!)).toBe(false);
    });

    it('should allow chained rotations when done legitimately', () => {
      const userId = 'user-chain-rotate';
      const token1 = createRefreshToken(userId);

      const token2 = rotateRefreshToken(token1);
      expect(token2).not.toBeNull();

      const token3 = rotateRefreshToken(token2!);
      expect(token3).not.toBeNull();

      const token4 = rotateRefreshToken(token3!);
      expect(token4).not.toBeNull();

      // Only the latest token should be valid
      expect(isRefreshTokenValid(token1)).toBe(false);
      expect(isRefreshTokenValid(token2!)).toBe(false);
      expect(isRefreshTokenValid(token3!)).toBe(false);
      expect(isRefreshTokenValid(token4!)).toBe(true);
    });
  });

  // ============= SESSION METADATA =============

  describe('getSessionMetadata', () => {
    it('should return session metadata including device info', () => {
      const sessionId = 'session-metadata-test';
      const userAgent = 'Mozilla/5.0 TestBrowser';
      const acceptLanguage = 'en-US,en;q=0.9';

      const req = createMockRequest({
        headers: {
          'user-agent': userAgent,
          'accept-language': acceptLanguage,
          'x-session-id': sessionId,
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      sessionFingerprintMiddleware(req, res, next);

      const metadata = getSessionMetadata(sessionId);

      expect(metadata).toBeDefined();
      expect(metadata!.userAgent).toBe(userAgent);
      expect(metadata!.acceptLanguage).toBe(acceptLanguage);
      expect(metadata!.fingerprint).toHaveLength(64);
      expect(metadata!.createdAt).toBeGreaterThan(0);
    });

    it('should return undefined for unknown session', () => {
      const metadata = getSessionMetadata('nonexistent-session');
      expect(metadata).toBeUndefined();
    });
  });
});
