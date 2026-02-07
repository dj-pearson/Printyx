/**
 * Unit Tests: Supabase Auth Middleware
 * Tests for requireSupabaseAuth, requireTenantContext, and requirePlatformAdmin
 * from server/middleware/supabase-auth.ts
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMockReq,
  createMockRes,
  createMockNext,
  TEST_USER_ID,
  TEST_TENANT_ID,
} from '../helpers/test-utils';

// We import the actual middleware functions.
// authenticateSupabaseJWT needs mocked dependencies (jose, db), but the guard
// middlewares (requireSupabaseAuth, requireTenantContext, requirePlatformAdmin)
// are pure synchronous functions that inspect req and send responses.
import {
  requireSupabaseAuth,
  requireTenantContext,
  requirePlatformAdmin,
} from '../../middleware/supabase-auth';

describe('Supabase Auth Middleware', () => {
  // ─── requireSupabaseAuth ────────────────────────────────────────────
  describe('requireSupabaseAuth', () => {
    it('should call next() when supabaseUser is present and not expired', () => {
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour in the future
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      requireSupabaseAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when supabaseUser is missing', () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      requireSupabaseAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    });

    it('should return 401 when token is expired', () => {
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          exp: Math.floor(Date.now() / 1000) - 100, // 100 seconds ago
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      requireSupabaseAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    });

    it('should call next() when exp is undefined (no expiration check)', () => {
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          // No exp field
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      requireSupabaseAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle edge case where exp is exactly now', () => {
      const now = Math.floor(Date.now() / 1000);
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          exp: now, // Exactly at the boundary
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      requireSupabaseAuth(req, res, next);

      // Date.now() >= exp * 1000 should be true when exp = now (in seconds)
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ─── requireTenantContext ───────────────────────────────────────────
  describe('requireTenantContext', () => {
    it('should call next() when tenantId is on supabaseUser', () => {
      const req = createMockReq({
        supabaseUser: { id: TEST_USER_ID, tenantId: TEST_TENANT_ID },
      });
      const res = createMockRes();
      const next = createMockNext();

      requireTenantContext(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).tenantId).toBe(TEST_TENANT_ID);
    });

    it('should call next() when tenantId is on req.tenantId (already resolved)', () => {
      const req = createMockReq({
        tenantId: TEST_TENANT_ID,
      });
      const res = createMockRes();
      const next = createMockNext();

      requireTenantContext(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).tenantId).toBe(TEST_TENANT_ID);
    });

    it('should return 403 when no tenant context available', () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      requireTenantContext(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json).toEqual({
        message: 'Tenant context required',
        code: 'NO_TENANT',
      });
    });

    it('should prefer supabaseUser.tenantId over req.tenantId', () => {
      const req = createMockReq({
        supabaseUser: { id: TEST_USER_ID, tenantId: 'supabase-tenant' },
        tenantId: 'request-tenant',
      });
      const res = createMockRes();
      const next = createMockNext();

      requireTenantContext(req, res, next);

      expect(next).toHaveBeenCalled();
      // The middleware uses: req.supabaseUser?.tenantId || req.tenantId
      // so supabaseUser.tenantId takes priority
      expect((req as any).tenantId).toBe('supabase-tenant');
    });
  });

  // ─── requirePlatformAdmin ──────────────────────────────────────────
  describe('requirePlatformAdmin', () => {
    it('should call next() when user is platform admin', () => {
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          isPlatformUser: true,
          tenantId: TEST_TENANT_ID,
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      requirePlatformAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not platform admin', () => {
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          isPlatformUser: false,
          tenantId: TEST_TENANT_ID,
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      requirePlatformAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json).toEqual({
        message: 'Platform admin access required',
        code: 'FORBIDDEN',
      });
    });

    it('should return 403 when supabaseUser is missing', () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      requirePlatformAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 when isPlatformUser is undefined', () => {
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          // isPlatformUser not set (undefined)
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      requirePlatformAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
