import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * SEC-008: Behavioral anomaly detection and automated threat scoring tests
 */

// Mock logger before importing service
vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    audit: vi.fn(),
    metric: vi.fn(),
  }),
}));

import {
  recordRequest,
  getThreatScore,
  getActiveThreats,
  resetThreatData,
  _setWindowMs,
  _clearAll,
} from '../../services/threat-detection-service';

describe('SEC-008: Threat Detection Service', () => {
  beforeEach(() => {
    _clearAll();
    // Use a 5-minute window like production default
    _setWindowMs(5 * 60 * 1000);
  });

  // -----------------------------------------------------------------------
  // Normal traffic
  // -----------------------------------------------------------------------
  describe('Normal traffic', () => {
    it('should have score 0 with no requests', () => {
      const result = getThreatScore('1.2.3.4');
      expect(result.score).toBe(0);
      expect(result.signals.requestVelocity).toBe(0);
    });

    it('should have score 0 for low-velocity normal requests', () => {
      // A handful of successful requests to a few endpoints
      for (let i = 0; i < 5; i++) {
        recordRequest('10.0.0.1', '/api/dashboard', 200);
        recordRequest('10.0.0.1', '/api/profile', 200);
      }

      const result = getThreatScore('10.0.0.1');
      expect(result.score).toBe(0);
      // 10 requests over a 300s window = 0.033 req/s (well below 10)
      expect(result.signals.requestVelocity).toBeLessThan(1);
      expect(result.signals.endpointBreadth).toBeLessThanOrEqual(2);
      expect(result.signals.errorRate).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Rapid scanning detection
  // -----------------------------------------------------------------------
  describe('Rapid scanning', () => {
    it('should increase score when velocity exceeds threshold', () => {
      // Use a 1-second window so a burst of requests yields high velocity
      _setWindowMs(1000);

      // 20 requests in a 1s window → 20 req/s → velocity > 10 → +30
      // Also 20 unique endpoints → endpointBreadth = 20, not > 20 so no +20
      for (let i = 0; i < 20; i++) {
        recordRequest('scanner', `/api/endpoint-${i}`, 200);
      }

      const result = getThreatScore('scanner');
      expect(result.signals.requestVelocity).toBeGreaterThan(10);
      expect(result.score).toBeGreaterThanOrEqual(30); // velocity component
    });

    it('should increase score for high endpoint breadth', () => {
      _setWindowMs(1000);

      // 25 unique endpoints → breadth > 20 → +20; also velocity > 10 → +30
      for (let i = 0; i < 25; i++) {
        recordRequest('scanner2', `/api/resource-${i}`, 200);
      }

      const result = getThreatScore('scanner2');
      expect(result.signals.endpointBreadth).toBeGreaterThan(20);
      expect(result.score).toBeGreaterThanOrEqual(50); // 30 velocity + 20 breadth
    });
  });

  // -----------------------------------------------------------------------
  // High error rate detection
  // -----------------------------------------------------------------------
  describe('High error rate', () => {
    it('should increase score when error rate exceeds 0.5', () => {
      // 1 success, 3 errors → error rate = 0.75
      recordRequest('errory', '/api/foo', 200);
      recordRequest('errory', '/api/foo', 404);
      recordRequest('errory', '/api/foo', 500);
      recordRequest('errory', '/api/foo', 403);

      const result = getThreatScore('errory');
      expect(result.signals.errorRate).toBe(0.75);
      expect(result.score).toBeGreaterThanOrEqual(25); // errorRate component
    });

    it('should detect high auth failure rate', () => {
      // 2 success, 4 auth failures → authFailureRate = 4/6 ≈ 0.67 > 0.3 → +20
      recordRequest('brute', '/api/login', 200);
      recordRequest('brute', '/api/login', 200);
      recordRequest('brute', '/api/login', 401);
      recordRequest('brute', '/api/login', 401);
      recordRequest('brute', '/api/login', 403);
      recordRequest('brute', '/api/login', 401);

      const result = getThreatScore('brute');
      expect(result.signals.authFailureRate).toBeGreaterThan(0.3);
      // errorRate is also > 0.5 (4/6 ≈ 0.67) → +25, authFailure → +20
      expect(result.score).toBeGreaterThanOrEqual(40);
    });
  });

  // -----------------------------------------------------------------------
  // Sequential ID access detection
  // -----------------------------------------------------------------------
  describe('Sequential ID access', () => {
    it('should detect sequential numeric ID patterns', () => {
      // Access /api/users/1, /api/users/2, /api/users/3 → sequential
      recordRequest('enum', '/api/users/1', 200);
      recordRequest('enum', '/api/users/2', 200);
      recordRequest('enum', '/api/users/3', 200);

      const result = getThreatScore('enum');
      expect(result.signals.sequentialIdAccess).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(25);
    });

    it('should not flag non-sequential IDs', () => {
      recordRequest('random', '/api/users/42', 200);
      recordRequest('random', '/api/users/999', 200);
      recordRequest('random', '/api/users/7', 200);

      const result = getThreatScore('random');
      expect(result.signals.sequentialIdAccess).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Sliding window decay
  // -----------------------------------------------------------------------
  describe('Score decays over time (sliding window)', () => {
    it('should drop score to 0 after window expires', () => {
      // Use a tiny window for testing
      _setWindowMs(100); // 100ms

      // Generate traffic that would produce a score
      for (let i = 0; i < 5; i++) {
        recordRequest('decay', `/api/resource-${i}`, 500);
      }

      // Immediately should have some score (error rate > 0.5 → +25)
      const before = getThreatScore('decay');
      expect(before.score).toBeGreaterThan(0);

      // Advance time past the window by manipulating Date.now
      const realNow = Date.now;
      Date.now = () => realNow() + 200; // 200ms later, beyond the 100ms window

      const after = getThreatScore('decay');
      expect(after.score).toBe(0);

      // Restore
      Date.now = realNow;
    });
  });

  // -----------------------------------------------------------------------
  // Score 90+ blocks request (middleware integration)
  // -----------------------------------------------------------------------
  describe('Score 90+ blocks request', () => {
    it('should generate a score of 90+ with combined signals', () => {
      _setWindowMs(1000);

      // Generate traffic triggering multiple signals:
      // - 25+ unique endpoints (breadth > 20 → +20, velocity will be > 10 → +30)
      // - All errors (errorRate = 1.0 > 0.5 → +25)
      // - Sequential IDs in some (sequentialIdAccess → +25)
      // Total: 30 + 20 + 25 + 25 = 100
      for (let i = 0; i < 25; i++) {
        recordRequest('attacker', `/api/resource-${i}`, 500);
      }
      // Add sequential IDs
      recordRequest('attacker', '/api/users/1', 500);
      recordRequest('attacker', '/api/users/2', 500);
      recordRequest('attacker', '/api/users/3', 500);

      const result = getThreatScore('attacker');
      expect(result.score).toBeGreaterThanOrEqual(90);
    });
  });

  // -----------------------------------------------------------------------
  // getActiveThreats / resetThreatData
  // -----------------------------------------------------------------------
  describe('Utility functions', () => {
    it('getActiveThreats returns all IPs with score > 0', () => {
      // One IP with errors → score > 0
      recordRequest('bad1', '/api/a', 500);
      recordRequest('bad1', '/api/a', 500);
      recordRequest('bad1', '/api/a', 500);

      // Another IP with clean traffic → score 0
      recordRequest('good', '/api/b', 200);

      const threats = getActiveThreats();
      const ips = threats.map((t) => t.ip);
      expect(ips).toContain('bad1');
      expect(ips).not.toContain('good');
    });

    it('resetThreatData clears data for a specific IP', () => {
      recordRequest('reset-me', '/api/a', 500);
      recordRequest('reset-me', '/api/a', 500);
      recordRequest('reset-me', '/api/a', 500);
      expect(getThreatScore('reset-me').score).toBeGreaterThan(0);

      resetThreatData('reset-me');
      expect(getThreatScore('reset-me').score).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Middleware behavior (unit-level)
  // -----------------------------------------------------------------------
  describe('Threat detection middleware', () => {
    it('should block with 429 when score >= 90', async () => {
      // We test the middleware logic by importing it and passing mock req/res
      const { threatDetectionMiddleware } = await import(
        '../../middleware/threat-detection'
      );

      _setWindowMs(1000);

      // Build up a high threat score first
      for (let i = 0; i < 25; i++) {
        recordRequest('block-me', `/api/resource-${i}`, 500);
      }
      recordRequest('block-me', '/api/users/1', 500);
      recordRequest('block-me', '/api/users/2', 500);
      recordRequest('block-me', '/api/users/3', 500);

      // Verify score is high enough
      expect(getThreatScore('block-me').score).toBeGreaterThanOrEqual(90);

      // Mock Express req/res/next
      const req = {
        headers: {},
        ip: 'block-me',
        path: '/api/test',
        query: {},
        body: {},
        socket: { remoteAddress: 'block-me' },
      } as unknown as import('express').Request;

      let statusCode = 0;
      let jsonBody: Record<string, unknown> = {};
      const headers: Record<string, string> = {};

      const res = {
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (body: Record<string, unknown>) => {
          jsonBody = body;
          return res;
        },
        on: vi.fn(),
      } as unknown as import('express').Response;

      const next = vi.fn();

      threatDetectionMiddleware(req, res, next);

      expect(statusCode).toBe(429);
      expect(jsonBody.code).toBe('THREAT_BLOCKED');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
