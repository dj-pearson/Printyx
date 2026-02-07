/**
 * Unit Tests: Enhanced RBAC Middleware (Extended)
 * Tests for the actual middleware functions: requirePermission, requireAllPermissions,
 * requireLevel, requireScope, hasPermission, hasAllPermissions, hasAnyPermission
 * from server/middleware/enhanced-rbac-middleware.ts
 *
 * Note: The existing rbac-middleware.test.ts tests the PermissionChecker class.
 * These tests cover the Express middleware functions directly.
 */

import { describe, it, expect, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import {
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireLevel,
  requireScope,
  hasPermission,
  hasAllPermissions as hasAllPermsFn,
  hasAnyPermission,
} from '../../middleware/enhanced-rbac-middleware';

// ─── Helpers ─────────────────────────────────────────────────────────

/** Create a mock RBAC-enhanced request */
function createRbacReq(
  overrides: {
    permissions?: string[];
    roleLevel?: number;
    territoryScope?: string;
    hasAllPermissions?: boolean;
  } = {},
): any {
  const perms = overrides.permissions || [];
  return {
    user: {
      id: 'user-1',
      tenantId: 'tenant-1',
      permissions: new Set(perms),
      roleLevel: overrides.roleLevel ?? 1,
      territoryScope: overrides.territoryScope ?? 'own',
      hasAllPermissions: overrides.hasAllPermissions ?? false,
    },
    path: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    get: vi.fn(() => undefined),
    session: {},
  };
}

function createMockRes(): any {
  const res: any = {
    _status: 200,
    _json: undefined,
    status: vi.fn(function (this: any, code: number) {
      this._status = code;
      return this;
    }),
    json: vi.fn(function (this: any, data: unknown) {
      this._json = data;
      return this;
    }),
  };
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('Enhanced RBAC Middleware', () => {
  // ─── requirePermission ─────────────────────────────────────────────
  describe('requirePermission', () => {
    it('should call next() when user has required permission', () => {
      const req = createRbacReq({ permissions: ['sales.lead.view_own'] });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requirePermission('sales.lead.view_own');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() when user has ANY of the required permissions', () => {
      const req = createRbacReq({ permissions: ['sales.lead.edit_own'] });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requirePermission(['sales.lead.view_own', 'sales.lead.edit_own']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user lacks required permission', () => {
      const req = createRbacReq({ permissions: ['sales.lead.view_own'] });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requirePermission('sales.lead.delete');
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error).toBe('Insufficient permissions');
      expect(res._json.required).toEqual(['sales.lead.delete']);
    });

    it('should return 401 when user is not authenticated', () => {
      const req = { path: '/api/test' } as any; // No user
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requirePermission('sales.lead.view_own');
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should bypass permission check for platform admin', () => {
      const req = createRbacReq({
        permissions: [], // No permissions
        hasAllPermissions: true,
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requirePermission('sales.lead.delete');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should enforce minLevel option even with valid permission', () => {
      const req = createRbacReq({
        permissions: ['sales.report.view'],
        roleLevel: 3,
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requirePermission('sales.report.view', { minLevel: 5 });
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error).toBe('Insufficient role level');
      expect(res._json.requiredLevel).toBe(5);
      expect(res._json.userLevel).toBe(3);
    });

    it('should enforce minScope option even with valid permission', () => {
      const req = createRbacReq({
        permissions: ['sales.report.view'],
        territoryScope: 'own',
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requirePermission('sales.report.view', { minScope: 'company' });
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error).toBe('Insufficient organizational scope');
    });

    it('should pass when minLevel is met', () => {
      const req = createRbacReq({
        permissions: ['sales.report.view'],
        roleLevel: 6,
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requirePermission('sales.report.view', { minLevel: 5 });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ─── requireAllPermissions ─────────────────────────────────────────
  describe('requireAllPermissions', () => {
    it('should call next() when user has ALL required permissions', () => {
      const req = createRbacReq({
        permissions: ['sales.lead.view_own', 'sales.lead.edit_own', 'sales.lead.delete'],
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAllPermissions(['sales.lead.view_own', 'sales.lead.edit_own']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user is missing some permissions', () => {
      const req = createRbacReq({
        permissions: ['sales.lead.view_own'],
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAllPermissions(['sales.lead.view_own', 'sales.lead.edit_own']);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.missing).toEqual(['sales.lead.edit_own']);
    });

    it('should bypass for platform admin', () => {
      const req = createRbacReq({
        permissions: [],
        hasAllPermissions: true,
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAllPermissions(['sales.lead.view_own', 'sales.lead.edit_own']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', () => {
      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAllPermissions(['sales.lead.view_own']);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ─── requireAnyPermission ──────────────────────────────────────────
  describe('requireAnyPermission', () => {
    it('should call next() when user has at least one permission', () => {
      const req = createRbacReq({
        permissions: ['sales.lead.edit_own'],
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAnyPermission(['sales.lead.view_own', 'sales.lead.edit_own']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user has none of the required permissions', () => {
      const req = createRbacReq({
        permissions: ['service.ticket.view_own'],
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAnyPermission(['sales.lead.view_own', 'sales.lead.edit_own']);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ─── requireLevel ─────────────────────────────────────────────────
  describe('requireLevel', () => {
    it('should call next() when user level meets minimum', () => {
      const req = createRbacReq({ roleLevel: 5 });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireLevel(5);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next() when user level exceeds minimum', () => {
      const req = createRbacReq({ roleLevel: 8 });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireLevel(5);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user level is below minimum', () => {
      const req = createRbacReq({ roleLevel: 3 });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireLevel(5);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.requiredLevel).toBe(5);
      expect(res._json.userLevel).toBe(3);
    });

    it('should return 401 when no user present', () => {
      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireLevel(1);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ─── requireScope ─────────────────────────────────────────────────
  describe('requireScope', () => {
    it('should call next() when user scope meets minimum', () => {
      const req = createRbacReq({ territoryScope: 'company' });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireScope('company');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next() when user scope exceeds minimum', () => {
      const req = createRbacReq({ territoryScope: 'platform' });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireScope('company');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user scope is below minimum', () => {
      const req = createRbacReq({ territoryScope: 'own' });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireScope('company');
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.requiredScope).toBe('company');
      expect(res._json.userScope).toBe('own');
    });

    it('should return 401 when no user present', () => {
      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireScope('own');
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should follow scope hierarchy: own < team < location < regional < company < platform', () => {
      const scopes = ['own', 'team', 'location', 'regional', 'company', 'platform'] as const;

      // User with 'location' scope should pass for 'team' but fail for 'regional'
      const req = createRbacReq({ territoryScope: 'location' });

      for (const scope of scopes) {
        const res = createMockRes();
        const next = createMockNext();
        const middleware = requireScope(scope);
        middleware(req, res, next);

        const scopeIdx = scopes.indexOf(scope);
        const userIdx = scopes.indexOf('location');

        if (scopeIdx <= userIdx) {
          expect(next).toHaveBeenCalled();
        } else {
          expect(res.status).toHaveBeenCalledWith(403);
        }
      }
    });
  });

  // ─── hasPermission (non-middleware) ────────────────────────────────
  describe('hasPermission', () => {
    it('should return true when user has the permission', () => {
      const req = createRbacReq({ permissions: ['sales.lead.view_own'] });
      expect(hasPermission(req, 'sales.lead.view_own')).toBe(true);
    });

    it('should return false when user lacks the permission', () => {
      const req = createRbacReq({ permissions: ['sales.lead.view_own'] });
      expect(hasPermission(req, 'sales.lead.delete')).toBe(false);
    });

    it('should return true for platform admin regardless of permissions', () => {
      const req = createRbacReq({
        permissions: [],
        hasAllPermissions: true,
      });
      expect(hasPermission(req, 'any.permission.here')).toBe(true);
    });

    it('should return false when no user present', () => {
      const req = {} as any;
      expect(hasPermission(req, 'sales.lead.view_own')).toBe(false);
    });
  });

  // ─── hasAllPermissions (non-middleware) ────────────────────────────
  describe('hasAllPermissions', () => {
    it('should return true when user has all permissions', () => {
      const req = createRbacReq({
        permissions: ['sales.lead.view_own', 'sales.lead.edit_own'],
      });
      expect(hasAllPermsFn(req, ['sales.lead.view_own', 'sales.lead.edit_own'])).toBe(true);
    });

    it('should return false when user is missing some permissions', () => {
      const req = createRbacReq({
        permissions: ['sales.lead.view_own'],
      });
      expect(hasAllPermsFn(req, ['sales.lead.view_own', 'sales.lead.edit_own'])).toBe(false);
    });

    it('should return true for platform admin', () => {
      const req = createRbacReq({
        permissions: [],
        hasAllPermissions: true,
      });
      expect(hasAllPermsFn(req, ['sales.lead.view_own', 'sales.lead.edit_own'])).toBe(true);
    });

    it('should return false when no user present', () => {
      const req = {} as any;
      expect(hasAllPermsFn(req, ['sales.lead.view_own'])).toBe(false);
    });
  });

  // ─── hasAnyPermission (non-middleware) ─────────────────────────────
  describe('hasAnyPermission', () => {
    it('should return true when user has at least one permission', () => {
      const req = createRbacReq({
        permissions: ['sales.lead.edit_own'],
      });
      expect(hasAnyPermission(req, ['sales.lead.view_own', 'sales.lead.edit_own'])).toBe(true);
    });

    it('should return false when user has none of the permissions', () => {
      const req = createRbacReq({
        permissions: ['service.ticket.view_own'],
      });
      expect(hasAnyPermission(req, ['sales.lead.view_own', 'sales.lead.edit_own'])).toBe(false);
    });

    it('should return true for platform admin', () => {
      const req = createRbacReq({
        permissions: [],
        hasAllPermissions: true,
      });
      expect(hasAnyPermission(req, ['any.permission'])).toBe(true);
    });

    it('should return false when no user present', () => {
      const req = {} as any;
      expect(hasAnyPermission(req, ['sales.lead.view_own'])).toBe(false);
    });
  });
});
