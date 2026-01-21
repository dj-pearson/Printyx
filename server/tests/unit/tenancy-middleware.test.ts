/**
 * Unit Tests: Tenancy Middleware
 * Tests for tenant header validation and cross-tenant access prevention
 */

import { describe, it, expect, vi } from 'vitest';
import { mockUsers, createMockResponse } from '../setup';

// =====================================================================
// MOCK IMPLEMENTATION OF TENANT VALIDATION LOGIC
// (Mirrors the actual implementation in tenancy.ts)
// =====================================================================

interface MockRequest {
  supabaseUser?: {
    id?: string;
    tenantId?: string;
    isPlatformUser?: boolean;
  };
  user?: {
    id?: string;
    tenantId?: string;
    roleLevel?: number;
    hasAllPermissions?: boolean;
    roleCode?: string;
  };
  path: string;
  method: string;
  ip?: string;
}

function mockIsPlatformAdmin(req: MockRequest): boolean {
  // Check explicit isPlatformUser flag
  if (req.supabaseUser?.isPlatformUser) {
    return true;
  }

  if ((req.user as any)?.isPlatformUser) {
    return true;
  }

  // Check role level (level 8 = platform admin)
  if (req.user?.roleLevel && req.user.roleLevel >= 8) {
    return true;
  }

  // Check hasAllPermissions flag
  if (req.user?.hasAllPermissions) {
    return true;
  }

  return false;
}

function mockGetUserId(req: MockRequest): string | undefined {
  return req.supabaseUser?.id || req.user?.id;
}

function validateTenantHeader(
  req: MockRequest,
  headerTenantId: string,
): { valid: boolean; tenantId?: string; reason?: string } {
  const userTenantId = req.supabaseUser?.tenantId || req.user?.tenantId;
  const userId = mockGetUserId(req);
  const isAdmin = mockIsPlatformAdmin(req);

  // If user is not authenticated, allow the header (public endpoints)
  if (!userId) {
    return { valid: true, tenantId: headerTenantId };
  }

  // Platform admins can access any tenant
  if (isAdmin) {
    return { valid: true, tenantId: headerTenantId };
  }

  // If user has no tenant assigned, reject cross-tenant access
  if (!userTenantId) {
    return {
      valid: false,
      reason: 'User has no assigned tenant',
    };
  }

  // Validate header matches user's assigned tenant
  if (headerTenantId !== userTenantId) {
    return {
      valid: false,
      reason: 'Tenant ID mismatch - access denied',
    };
  }

  return { valid: true, tenantId: headerTenantId };
}

// =====================================================================
// TESTS
// =====================================================================

describe('Tenancy Middleware', () => {
  describe('Tenant Header Validation', () => {
    it('should allow request when x-tenant-id matches user tenant', () => {
      const req: MockRequest = {
        supabaseUser: {
          id: mockUsers.salesRep.id,
          tenantId: 'tenant-test-1',
        },
        path: '/api/customers',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'tenant-test-1');
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('tenant-test-1');
    });

    it('should deny request when x-tenant-id does not match user tenant', () => {
      const req: MockRequest = {
        supabaseUser: {
          id: mockUsers.salesRep.id,
          tenantId: 'tenant-test-1',
        },
        path: '/api/customers',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'different-tenant');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Tenant ID mismatch - access denied');
    });

    it('should allow platform admin to access any tenant', () => {
      const req: MockRequest = {
        supabaseUser: {
          id: mockUsers.platformAdmin.id,
          tenantId: 'tenant-test-1',
          isPlatformUser: true,
        },
        path: '/api/customers',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'different-tenant');
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('different-tenant');
    });

    it('should allow admin by role level >= 8 to access any tenant', () => {
      const req: MockRequest = {
        user: {
          id: mockUsers.platformAdmin.id,
          tenantId: 'tenant-test-1',
          roleLevel: 8,
        },
        path: '/api/customers',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'different-tenant');
      expect(result.valid).toBe(true);
    });

    it('should allow admin with hasAllPermissions flag', () => {
      const req: MockRequest = {
        user: {
          id: 'admin-user',
          tenantId: 'tenant-test-1',
          hasAllPermissions: true,
        },
        path: '/api/customers',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'different-tenant');
      expect(result.valid).toBe(true);
    });

    it('should allow unauthenticated requests with any tenant header', () => {
      const req: MockRequest = {
        // No user or supabaseUser
        path: '/api/public/status',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'any-tenant');
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('any-tenant');
    });

    it('should deny user with no assigned tenant from cross-tenant access', () => {
      const req: MockRequest = {
        supabaseUser: {
          id: 'user-without-tenant',
          // tenantId is undefined
        },
        path: '/api/customers',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'some-tenant');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('User has no assigned tenant');
    });
  });

  describe('Security Scenarios', () => {
    it('should prevent sales rep from accessing different tenant data', () => {
      // Simulate a malicious user trying to access another tenant
      const req: MockRequest = {
        supabaseUser: {
          id: mockUsers.salesRep.id,
          tenantId: 'tenant-test-1', // User belongs to tenant-test-1
        },
        path: '/api/customers',
        method: 'GET',
      };

      // Attacker sends header for different tenant
      const result = validateTenantHeader(req, 'attacker-tenant');
      expect(result.valid).toBe(false);
    });

    it('should prevent manager from accessing different company tenant', () => {
      const req: MockRequest = {
        user: {
          id: mockUsers.salesManager.id,
          tenantId: mockUsers.salesManager.tenantId,
          roleLevel: mockUsers.salesManager.roleLevel,
        },
        path: '/api/reports',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'competitor-tenant');
      expect(result.valid).toBe(false);
    });

    it('should allow same-tenant access for all user roles', () => {
      const roles = ['salesRep', 'salesManager', 'regionalDirector', 'vp', 'ceo'] as const;

      for (const role of roles) {
        const user = mockUsers[role];
        const req: MockRequest = {
          user: {
            id: user.id,
            tenantId: user.tenantId,
            roleLevel: user.roleLevel,
          },
          path: '/api/data',
          method: 'GET',
        };

        const result = validateTenantHeader(req, user.tenantId);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tenant ID in header', () => {
      const req: MockRequest = {
        supabaseUser: {
          id: mockUsers.salesRep.id,
          tenantId: 'tenant-test-1',
        },
        path: '/api/customers',
        method: 'GET',
      };

      // Empty string should not match user's tenant
      const result = validateTenantHeader(req, '');
      expect(result.valid).toBe(false);
    });

    it('should handle tenant ID with special characters', () => {
      const req: MockRequest = {
        supabaseUser: {
          id: mockUsers.salesRep.id,
          tenantId: 'tenant-with-special_chars-123',
        },
        path: '/api/customers',
        method: 'GET',
      };

      const result = validateTenantHeader(req, 'tenant-with-special_chars-123');
      expect(result.valid).toBe(true);
    });

    it('should handle UUID format tenant IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const req: MockRequest = {
        supabaseUser: {
          id: mockUsers.salesRep.id,
          tenantId: uuid,
        },
        path: '/api/customers',
        method: 'GET',
      };

      const result = validateTenantHeader(req, uuid);
      expect(result.valid).toBe(true);

      // Different UUID should fail
      const result2 = validateTenantHeader(req, '550e8400-e29b-41d4-a716-446655440001');
      expect(result2.valid).toBe(false);
    });
  });
});
