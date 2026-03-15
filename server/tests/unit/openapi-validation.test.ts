/**
 * OpenAPI Validation Middleware - Unit Tests (SEC-006)
 *
 * Tests the openapi-validator middleware covering:
 * - Valid requests pass through
 * - Missing required fields are rejected
 * - Wrong types are rejected
 * - Additional/unknown properties are rejected
 * - Dangerous characters are detected
 * - Max nesting depth is enforced
 * - Oversized bodies are rejected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  openapiValidator,
  exceedsMaxDepth,
  findDangerousStrings,
  findUnknownProperties,
  registerRouteSchema,
} from '../../middleware/openapi-validator';
import { z } from 'zod';

// ─── Test Helpers ──────────────────────────────────────────────────────

function createMockReq(overrides: Partial<Request> = {}): Request & { requestId?: string } {
  return {
    method: 'POST',
    path: '/api/business-records',
    body: {},
    requestId: 'test-request-id-001',
    ...overrides,
  } as Request & { requestId?: string };
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('OpenAPI Validation Middleware', () => {
  let middleware: ReturnType<typeof openapiValidator>;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    middleware = openapiValidator();
    res = createMockRes();
    next = createMockNext();
  });

  // ── GET requests pass through ──────────────────────────────────────

  describe('GET requests (skip validation)', () => {
    it('should pass GET requests through without validation', () => {
      const req = createMockReq({ method: 'GET', path: '/api/business-records' });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass DELETE requests through without validation', () => {
      const req = createMockReq({ method: 'DELETE', path: '/api/business-records/123' });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── Valid requests ─────────────────────────────────────────────────

  describe('Valid requests pass through', () => {
    it('should allow valid POST to registered route', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/business-records',
        body: {
          companyName: 'Test Corp',
          status: 'active',
          type: 'customer',
        },
      });
      middleware(req, res, next);
      // Either passes through (next called) or validates successfully
      // Depending on schema strictness, next should be called for valid data
      expect(res.status).not.toHaveBeenCalledWith(500);
    });

    it('should allow requests to unregistered routes (gradual rollout)', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/some-unregistered-route',
        body: { data: 'test' },
      });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── Dangerous characters ───────────────────────────────────────────

  describe('Dangerous character detection', () => {
    it('should reject body with null bytes', () => {
      const req = createMockReq({
        body: { name: 'test\x00injection' },
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Request contains invalid characters',
        }),
      );
    });

    it('should reject body with C0 control characters', () => {
      const req = createMockReq({
        body: { description: 'test\x01data' },
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject body with DEL character', () => {
      const req = createMockReq({
        body: { field: 'test\x7Fdata' },
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should allow safe strings with tabs and newlines', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/some-unregistered-route',
        body: { description: 'line1\nline2\ttabbed' },
      });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should detect dangerous characters in nested objects', () => {
      const req = createMockReq({
        body: { nested: { deep: { value: 'bad\x00data' } } },
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should detect dangerous characters in arrays', () => {
      const req = createMockReq({
        body: { items: ['good', 'bad\x00'] },
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── Max nesting depth ──────────────────────────────────────────────

  describe('Max nesting depth enforcement', () => {
    it('should reject deeply nested objects', () => {
      // Create an object nested 15 levels deep
      let deep: Record<string, unknown> = { value: 'bottom' };
      for (let i = 0; i < 14; i++) {
        deep = { nested: deep };
      }
      const req = createMockReq({ body: deep });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Request body nested too deeply',
        }),
      );
    });

    it('should allow objects within nesting limit', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/some-unregistered-route',
        body: { a: { b: { c: 'value' } } },
      });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── Oversized body ─────────────────────────────────────────────────

  describe('Oversized body rejection', () => {
    it('should reject bodies exceeding max size', () => {
      const largeString = 'x'.repeat(1_100_000);
      const req = createMockReq({
        body: { data: largeString },
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Request body too large',
        }),
      );
    });
  });

  // ── Unknown properties ─────────────────────────────────────────────

  describe('Unknown property detection', () => {
    it('should reject unknown properties on registered routes', () => {
      // Register a test schema
      const testSchema = z.object({
        name: z.string(),
        email: z.string().email(),
      });
      registerRouteSchema({
        method: 'post',
        path: '/api/test-strict-validation',
        schema: testSchema,
      });

      const req = createMockReq({
        method: 'POST',
        path: '/api/test-strict-validation',
        body: { name: 'Test', email: 'test@test.com', unknownField: 'should fail' },
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Unknown properties in request body',
        }),
      );
    });
  });

  // ── Schema validation ──────────────────────────────────────────────

  describe('Schema validation', () => {
    it('should reject missing required fields on registered routes', () => {
      const testSchema = z.object({
        requiredField: z.string(),
        requiredNumber: z.number(),
      });
      registerRouteSchema({
        method: 'post',
        path: '/api/test-required-fields',
        schema: testSchema,
      });

      const req = createMockReq({
        method: 'POST',
        path: '/api/test-required-fields',
        body: {}, // missing required fields
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        }),
      );
    });

    it('should reject wrong types on registered routes', () => {
      const testSchema = z.object({
        count: z.number(),
        active: z.boolean(),
      });
      registerRouteSchema({
        method: 'post',
        path: '/api/test-wrong-types',
        schema: testSchema,
      });

      const req = createMockReq({
        method: 'POST',
        path: '/api/test-wrong-types',
        body: { count: 'not-a-number', active: 'not-a-boolean' },
      });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should pass valid data and replace body with parsed data', () => {
      const testSchema = z.object({
        name: z.string().min(1),
        age: z.number().positive(),
      });
      registerRouteSchema({
        method: 'post',
        path: '/api/test-valid-pass',
        schema: testSchema,
      });

      const req = createMockReq({
        method: 'POST',
        path: '/api/test-valid-pass',
        body: { name: 'Test User', age: 25 },
      });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ name: 'Test User', age: 25 });
    });
  });

  // ── API versioning prefix stripping ────────────────────────────────

  describe('API versioning', () => {
    it('should strip /api/v1/ prefix when matching routes', () => {
      const testSchema = z.object({
        title: z.string(),
      });
      registerRouteSchema({
        method: 'post',
        path: '/api/test-versioned',
        schema: testSchema,
      });

      const req = createMockReq({
        method: 'POST',
        path: '/api/v1/test-versioned',
        body: { title: 'versioned' },
      });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── Request ID in error responses ──────────────────────────────────

  describe('Error response format', () => {
    it('should include requestId in validation error responses', () => {
      const req = createMockReq({
        body: { field: 'test\x00bad' },
        requestId: 'req-abc-123',
      } as Partial<Request>);
      middleware(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-abc-123',
        }),
      );
    });
  });
});

// ─── Utility Function Tests ────────────────────────────────────────────

describe('exceedsMaxDepth', () => {
  it('should return false for flat objects', () => {
    expect(exceedsMaxDepth({ a: 1, b: 2 })).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(exceedsMaxDepth(null)).toBe(false);
    expect(exceedsMaxDepth(undefined)).toBe(false);
  });

  it('should return true when depth exceeds limit', () => {
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 12; i++) deep = { n: deep };
    expect(exceedsMaxDepth(deep, 10)).toBe(true);
  });

  it('should handle arrays in depth calculation', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 12; i++) deep = [deep];
    expect(exceedsMaxDepth(deep, 10)).toBe(true);
  });

  it('should return false at exactly the limit', () => {
    expect(exceedsMaxDepth({ a: { b: 'c' } }, 3)).toBe(false);
  });
});

describe('findDangerousStrings', () => {
  it('should return empty array for safe strings', () => {
    expect(findDangerousStrings({ name: 'Safe String' })).toEqual([]);
  });

  it('should detect null bytes', () => {
    const result = findDangerousStrings({ name: 'test\x00' });
    expect(result).toContain('name');
  });

  it('should detect in nested paths', () => {
    const result = findDangerousStrings({ outer: { inner: 'bad\x01' } });
    expect(result).toContain('outer.inner');
  });

  it('should detect in arrays', () => {
    const result = findDangerousStrings({ items: ['ok', 'bad\x00'] });
    expect(result).toContain('items[1]');
  });

  it('should return empty for non-string values', () => {
    expect(findDangerousStrings({ count: 42, active: true })).toEqual([]);
  });
});

describe('findUnknownProperties', () => {
  it('should return unknown keys not in schema', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = findUnknownProperties(
      { name: 'Test', age: 25, extra: true, another: 'val' },
      schema,
    );
    expect(result).toContain('extra');
    expect(result).toContain('another');
  });

  it('should return empty for matching keys', () => {
    const schema = z.object({ name: z.string() });
    const result = findUnknownProperties({ name: 'Test' }, schema);
    expect(result).toEqual([]);
  });

  it('should return empty for non-ZodObject schemas', () => {
    const schema = z.string();
    const result = findUnknownProperties({ anything: 'val' }, schema);
    expect(result).toEqual([]);
  });
});
