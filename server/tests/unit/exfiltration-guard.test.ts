import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exfiltrationGuard,
  getExfiltrationAlerts,
  _clearTrackingState,
  _getTrackingMap,
  SIZE_WARN_BYTES,
  SIZE_BLOCK_BYTES,
  RECORD_WARN_COUNT,
  RECORD_BLOCK_COUNT,
} from '../../middleware/exfiltration-guard';
import { findCrossTenantLeak } from '../../middleware/tenant-response-validator';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

vi.mock('../../utils/auth-helpers', () => ({
  getUserId: vi.fn((req: any) => req._testUserId || undefined),
  getTenantId: vi.fn((req: any) => req._testTenantId || undefined),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function createMockReq(overrides: Record<string, any> = {}): any {
  return {
    path: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    headers: {},
    _testUserId: 'user-1',
    _testTenantId: 'tenant-1',
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {
    _headers: {} as Record<string, string | number>,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    getHeader: vi.fn((name: string) => res._headers[name.toLowerCase()]),
    setHeader: vi.fn((name: string, value: string | number) => {
      res._headers[name.toLowerCase()] = value;
    }),
  };
  return res;
}

function nextFn(): void {
  // no-op
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Exfiltration Guard Middleware', () => {
  beforeEach(() => {
    _clearTrackingState();
  });

  // ── Normal usage ────────────────────────────────────────────────────────

  describe('Normal API usage', () => {
    it('should pass through small responses without warnings or blocks', () => {
      const req = createMockReq();
      const res = createMockRes();

      exfiltrationGuard(req, res, nextFn);

      // Simulate a small JSON response
      const body = { data: [{ id: 1, name: 'Test' }] };
      res.json(body);

      // No alerts should be generated
      expect(getExfiltrationAlerts()).toHaveLength(0);

      // Tracking entry should exist with small values
      const entry = _getTrackingMap().get('user-1');
      expect(entry).toBeDefined();
      expect(entry!.totalBytes).toBeGreaterThan(0);
      expect(entry!.totalRecords).toBe(1);
      expect(entry!.blocked).toBe(false);
    });

    it('should track cumulative bytes across multiple requests', () => {
      const body = { message: 'hello' };

      for (let i = 0; i < 3; i++) {
        const req = createMockReq();
        const res = createMockRes();
        exfiltrationGuard(req, res, nextFn);
        res.json(body);
      }

      const entry = _getTrackingMap().get('user-1');
      expect(entry).toBeDefined();
      // Each response is roughly the same size; cumulative should be ~3x one
      const singleSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
      expect(entry!.totalBytes).toBe(singleSize * 3);
    });
  });

  // ── Size thresholds ─────────────────────────────────────────────────────

  describe('Cumulative size thresholds', () => {
    it('should generate SIZE_WARNING when cumulative response data exceeds 10 MB', () => {
      const req = createMockReq();
      const res = createMockRes();

      exfiltrationGuard(req, res, nextFn);

      // Send a response that exceeds the warn threshold
      const largePayload = 'x'.repeat(SIZE_WARN_BYTES + 1);
      res.send(largePayload);

      const alerts = getExfiltrationAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts.some((a) => a.type === 'SIZE_WARNING')).toBe(true);
    });

    it('should generate SIZE_BLOCK and block further requests at 50 MB', () => {
      // Accumulate past the block threshold
      const chunkSize = SIZE_BLOCK_BYTES + 1;
      const req1 = createMockReq();
      const res1 = createMockRes();

      exfiltrationGuard(req1, res1, nextFn);
      res1.send('x'.repeat(chunkSize));

      const alerts = getExfiltrationAlerts();
      expect(alerts.some((a) => a.type === 'SIZE_BLOCK')).toBe(true);

      // Next request from same user should be blocked with 429
      const req2 = createMockReq();
      const res2 = createMockRes();

      exfiltrationGuard(req2, res2, nextFn);

      expect(res2.status).toHaveBeenCalledWith(429);
      expect(res2.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'EXFILTRATION_LIMIT_EXCEEDED' }),
      );
    });
  });

  // ── Record count thresholds ─────────────────────────────────────────────

  describe('Record count thresholds', () => {
    it('should generate RECORD_WARNING at 1,000 records', () => {
      const records = Array.from({ length: RECORD_WARN_COUNT + 1 }, (_, i) => ({ id: i }));
      const req = createMockReq();
      const res = createMockRes();

      exfiltrationGuard(req, res, nextFn);
      res.json({ data: records });

      const alerts = getExfiltrationAlerts();
      expect(alerts.some((a) => a.type === 'RECORD_WARNING')).toBe(true);
    });

    it('should generate RECORD_BLOCK and block at 5,000 records', () => {
      const records = Array.from({ length: RECORD_BLOCK_COUNT + 1 }, (_, i) => ({ id: i }));
      const req = createMockReq();
      const res = createMockRes();

      exfiltrationGuard(req, res, nextFn);
      res.json({ data: records });

      const alerts = getExfiltrationAlerts();
      expect(alerts.some((a) => a.type === 'RECORD_BLOCK')).toBe(true);

      // Subsequent request should be blocked
      const req2 = createMockReq();
      const res2 = createMockRes();
      exfiltrationGuard(req2, res2, nextFn);

      expect(res2.status).toHaveBeenCalledWith(429);
    });

    it('should accumulate record counts across multiple paginated requests', () => {
      // Simulate rapid pagination: many requests each returning a page of records
      const pageSize = 200;
      const pages = 6; // 1200 records total → should trigger warning

      for (let page = 0; page < pages; page++) {
        const req = createMockReq({ path: `/api/leads?page=${page}&limit=${pageSize}` });
        const res = createMockRes();

        exfiltrationGuard(req, res, nextFn);
        const records = Array.from({ length: pageSize }, (_, i) => ({
          id: page * pageSize + i,
        }));
        res.json({ data: records });
      }

      const entry = _getTrackingMap().get('user-1');
      expect(entry).toBeDefined();
      expect(entry!.totalRecords).toBe(pageSize * pages);

      const alerts = getExfiltrationAlerts();
      expect(alerts.some((a) => a.type === 'RECORD_WARNING')).toBe(true);
    });
  });

  // ── Response without data array ─────────────────────────────────────────

  describe('Record count detection', () => {
    it('should count zero records when response has no data array', () => {
      const req = createMockReq();
      const res = createMockRes();

      exfiltrationGuard(req, res, nextFn);
      res.json({ message: 'ok', count: 42 });

      const entry = _getTrackingMap().get('user-1');
      expect(entry!.totalRecords).toBe(0);
    });

    it('should count records when data is an array', () => {
      const req = createMockReq();
      const res = createMockRes();

      exfiltrationGuard(req, res, nextFn);
      res.json({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] });

      const entry = _getTrackingMap().get('user-1');
      expect(entry!.totalRecords).toBe(3);
    });

    it('should not count data if it is not an array', () => {
      const req = createMockReq();
      const res = createMockRes();

      exfiltrationGuard(req, res, nextFn);
      res.json({ data: { nested: true } });

      const entry = _getTrackingMap().get('user-1');
      expect(entry!.totalRecords).toBe(0);
    });
  });

  // ── Admin alerts API ──────────────────────────────────────────────────

  describe('getExfiltrationAlerts', () => {
    it('should return a copy of the alerts array', () => {
      const alerts1 = getExfiltrationAlerts();
      const alerts2 = getExfiltrationAlerts();
      expect(alerts1).not.toBe(alerts2);
      expect(alerts1).toEqual(alerts2);
    });
  });
});

// ── Cross-tenant response validator ───────────────────────────────────────

describe('Tenant Response Validator - findCrossTenantLeak', () => {
  it('should return null when all records match the expected tenant', () => {
    const body = {
      data: [
        { id: 1, tenantId: 'tenant-1' },
        { id: 2, tenantId: 'tenant-1' },
      ],
    };
    expect(findCrossTenantLeak(body, 'tenant-1')).toBeNull();
  });

  it('should detect cross-tenant data in a response body', () => {
    const body = {
      data: [
        { id: 1, tenantId: 'tenant-1' },
        { id: 2, tenantId: 'tenant-WRONG' },
      ],
    };
    expect(findCrossTenantLeak(body, 'tenant-1')).toBe('tenant-WRONG');
  });

  it('should handle null/undefined body gracefully', () => {
    expect(findCrossTenantLeak(null, 'tenant-1')).toBeNull();
    expect(findCrossTenantLeak(undefined, 'tenant-1')).toBeNull();
  });

  it('should handle body without tenantId fields', () => {
    const body = { data: [{ id: 1, name: 'Test' }] };
    expect(findCrossTenantLeak(body, 'tenant-1')).toBeNull();
  });

  it('should detect leak in top-level object tenantId', () => {
    const body = { tenantId: 'tenant-WRONG', name: 'Bad record' };
    expect(findCrossTenantLeak(body, 'tenant-1')).toBe('tenant-WRONG');
  });
});
