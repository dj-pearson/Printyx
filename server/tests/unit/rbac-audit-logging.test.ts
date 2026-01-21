/**
 * Unit Tests: RBAC Admin Bypass Audit Logging
 * Tests for the audit logging of platform admin permission bypasses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock types for testing admin bypass logging
interface MockAuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    roleCode: string;
    roleLevel: number;
    hasAllPermissions: boolean;
    permissions: Set<string>;
  };
  session?: {
    id?: string;
  };
}

// Track logged events for testing
const loggedEvents: Array<{
  eventType: string;
  bypassType: string;
  requiredPermissions: string[] | null;
  userId?: string;
  route: string;
  method: string;
}> = [];

// Mock the logging function
function mockLogAdminBypass(
  req: MockAuthenticatedRequest,
  bypassType: string,
  requiredPermissions: string[] | null,
) {
  loggedEvents.push({
    eventType: 'ADMIN_BYPASS',
    bypassType,
    requiredPermissions,
    userId: req.user?.id,
    route: req.path,
    method: req.method,
  });
}

// Simplified permission check middleware for testing
function createRequirePermissionMiddleware(
  permission: string | string[],
): (req: MockAuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const requiredPermissions = Array.isArray(permission) ? permission : [permission];

    // Platform admins bypass - LOG THIS
    if (req.user.hasAllPermissions) {
      mockLogAdminBypass(req, 'PERMISSION', requiredPermissions);
      return next();
    }

    const hasPermission = requiredPermissions.some((perm) => req.user!.permissions.has(perm));
    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

function createRequireAllPermissionsMiddleware(
  requiredPermissions: string[],
): (req: MockAuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Platform admins bypass - LOG THIS
    if (req.user.hasAllPermissions) {
      mockLogAdminBypass(req, 'ALL_PERMISSIONS', requiredPermissions);
      return next();
    }

    const missingPermissions = requiredPermissions.filter(
      (perm) => !req.user!.permissions.has(perm),
    );
    if (missingPermissions.length > 0) {
      res.status(403).json({ error: 'Insufficient permissions', missing: missingPermissions });
      return;
    }

    next();
  };
}

function createRequireApprovalMiddleware(
  permissionCode: string,
): (req: MockAuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Platform admins bypass - LOG THIS
    if (req.user.hasAllPermissions) {
      mockLogAdminBypass(req, 'APPROVAL', [permissionCode]);
      return next();
    }

    // Normally would check approval status
    res.status(403).json({ error: 'Approval required' });
  };
}

// Helper to create mock request
function createMockRequest(data: Partial<MockAuthenticatedRequest>): MockAuthenticatedRequest {
  return {
    path: '/api/test',
    method: 'GET',
    get: vi.fn().mockReturnValue('test-user-agent'),
    ip: '127.0.0.1',
    params: {},
    query: {},
    body: {},
    ...data,
  } as unknown as MockAuthenticatedRequest;
}

// Helper to create mock response
function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    headersSent: false,
  };
  return res as Response;
}

// =====================================================================
// TESTS
// =====================================================================

describe('RBAC Admin Bypass Audit Logging', () => {
  beforeEach(() => {
    // Clear logged events before each test
    loggedEvents.length = 0;
  });

  describe('requirePermission middleware', () => {
    it('should log admin bypass when platform admin accesses protected route', () => {
      const middleware = createRequirePermissionMiddleware('sales.lead.view_all');
      const req = createMockRequest({
        path: '/api/leads',
        method: 'GET',
        user: {
          id: 'admin-user-123',
          tenantId: 'tenant-456',
          roleCode: 'PLATFORM_ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(loggedEvents).toHaveLength(1);
      expect(loggedEvents[0]).toEqual({
        eventType: 'ADMIN_BYPASS',
        bypassType: 'PERMISSION',
        requiredPermissions: ['sales.lead.view_all'],
        userId: 'admin-user-123',
        route: '/api/leads',
        method: 'GET',
      });
    });

    it('should NOT log when regular user accesses with permission', () => {
      const middleware = createRequirePermissionMiddleware('sales.lead.view_own');
      const req = createMockRequest({
        user: {
          id: 'regular-user-123',
          tenantId: 'tenant-456',
          roleCode: 'SALES_REP',
          roleLevel: 2,
          hasAllPermissions: false,
          permissions: new Set(['sales.lead.view_own']),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(loggedEvents).toHaveLength(0);
    });

    it('should NOT log when regular user is denied', () => {
      const middleware = createRequirePermissionMiddleware('admin.system.manage');
      const req = createMockRequest({
        user: {
          id: 'regular-user-123',
          tenantId: 'tenant-456',
          roleCode: 'SALES_REP',
          roleLevel: 2,
          hasAllPermissions: false,
          permissions: new Set(['sales.lead.view_own']),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(loggedEvents).toHaveLength(0);
    });

    it('should log multiple permissions when array is provided', () => {
      const middleware = createRequirePermissionMiddleware([
        'sales.lead.view_all',
        'sales.lead.edit_all',
      ]);
      const req = createMockRequest({
        path: '/api/leads/bulk-edit',
        method: 'POST',
        user: {
          id: 'admin-user-123',
          tenantId: 'tenant-456',
          roleCode: 'PLATFORM_ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(loggedEvents[0].requiredPermissions).toEqual([
        'sales.lead.view_all',
        'sales.lead.edit_all',
      ]);
    });
  });

  describe('requireAllPermissions middleware', () => {
    it('should log admin bypass with ALL_PERMISSIONS type', () => {
      const middleware = createRequireAllPermissionsMiddleware([
        'admin.user.create',
        'admin.user.delete',
      ]);
      const req = createMockRequest({
        path: '/api/admin/users',
        method: 'DELETE',
        user: {
          id: 'admin-user-123',
          tenantId: 'tenant-456',
          roleCode: 'PLATFORM_ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(loggedEvents).toHaveLength(1);
      expect(loggedEvents[0].bypassType).toBe('ALL_PERMISSIONS');
      expect(loggedEvents[0].requiredPermissions).toEqual([
        'admin.user.create',
        'admin.user.delete',
      ]);
    });
  });

  describe('requireApproval middleware', () => {
    it('should log admin bypass with APPROVAL type', () => {
      const middleware = createRequireApprovalMiddleware('finance.invoice.approve');
      const req = createMockRequest({
        path: '/api/invoices/approve',
        method: 'POST',
        user: {
          id: 'admin-user-123',
          tenantId: 'tenant-456',
          roleCode: 'PLATFORM_ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(loggedEvents).toHaveLength(1);
      expect(loggedEvents[0].bypassType).toBe('APPROVAL');
      expect(loggedEvents[0].requiredPermissions).toEqual(['finance.invoice.approve']);
    });
  });

  describe('Audit log entry structure', () => {
    it('should include all required fields in audit log', () => {
      const middleware = createRequirePermissionMiddleware('test.permission');
      const req = createMockRequest({
        path: '/api/sensitive/resource',
        method: 'DELETE',
        user: {
          id: 'admin-id-789',
          tenantId: 'tenant-xyz',
          roleCode: 'ROOT_ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      const log = loggedEvents[0];
      expect(log).toHaveProperty('eventType', 'ADMIN_BYPASS');
      expect(log).toHaveProperty('bypassType');
      expect(log).toHaveProperty('requiredPermissions');
      expect(log).toHaveProperty('userId');
      expect(log).toHaveProperty('route');
      expect(log).toHaveProperty('method');
    });

    it('should capture the correct HTTP method', () => {
      const middleware = createRequirePermissionMiddleware('test.permission');

      // Test various HTTP methods
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        loggedEvents.length = 0;

        const req = createMockRequest({
          method,
          user: {
            id: 'admin-user',
            tenantId: 'tenant',
            roleCode: 'ADMIN',
            roleLevel: 8,
            hasAllPermissions: true,
            permissions: new Set(),
          },
        });
        const res = createMockResponse();
        const next = vi.fn();

        middleware(req, res, next);

        expect(loggedEvents[0].method).toBe(method);
      }
    });
  });

  describe('Security scenarios', () => {
    it('should log when admin accesses user data endpoints', () => {
      const middleware = createRequirePermissionMiddleware('users.view_all');
      const req = createMockRequest({
        path: '/api/users/user-abc-123',
        method: 'GET',
        user: {
          id: 'admin-user',
          tenantId: 'tenant-456',
          roleCode: 'PLATFORM_ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(loggedEvents[0].route).toBe('/api/users/user-abc-123');
    });

    it('should log when admin modifies critical resources', () => {
      const middleware = createRequirePermissionMiddleware('system.config.modify');
      const req = createMockRequest({
        path: '/api/system/config',
        method: 'PUT',
        user: {
          id: 'admin-user',
          tenantId: 'tenant-456',
          roleCode: 'PLATFORM_ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(loggedEvents).toHaveLength(1);
      expect(loggedEvents[0].method).toBe('PUT');
    });

    it('should log when admin deletes resources', () => {
      const middleware = createRequirePermissionMiddleware('data.delete');
      const req = createMockRequest({
        path: '/api/customers/cust-123',
        method: 'DELETE',
        user: {
          id: 'admin-user',
          tenantId: 'tenant-456',
          roleCode: 'PLATFORM_ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(loggedEvents).toHaveLength(1);
      expect(loggedEvents[0].method).toBe('DELETE');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined user gracefully', () => {
      const middleware = createRequirePermissionMiddleware('test.permission');
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(loggedEvents).toHaveLength(0);
    });

    it('should handle empty permissions array', () => {
      const middleware = createRequirePermissionMiddleware([]);
      const req = createMockRequest({
        user: {
          id: 'admin-user',
          tenantId: 'tenant',
          roleCode: 'ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(loggedEvents[0].requiredPermissions).toEqual([]);
    });

    it('should log bypass even for low-risk routes', () => {
      const middleware = createRequirePermissionMiddleware('public.view');
      const req = createMockRequest({
        path: '/api/public/info',
        method: 'GET',
        user: {
          id: 'admin-user',
          tenantId: 'tenant',
          roleCode: 'ADMIN',
          roleLevel: 8,
          hasAllPermissions: true,
          permissions: new Set(),
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      // Even low-risk routes should be logged for compliance
      expect(loggedEvents).toHaveLength(1);
    });
  });
});
