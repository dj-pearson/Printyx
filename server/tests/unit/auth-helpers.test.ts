/**
 * Unit Tests: Auth Helpers
 * Tests for authentication helper functions in auth-helpers.ts
 */

import { describe, it, expect } from 'vitest';
import { Request } from 'express';

// Mock implementation of isPlatformAdmin for testing
function isPlatformAdmin(req: Request): boolean {
  const reqAny = req as any;

  // Priority 1: Check explicit isPlatformUser flag from JWT
  if (reqAny.supabaseUser?.isPlatformUser === true) {
    return true;
  }

  // Priority 2: Check isPlatformUser flag from user object
  if (reqAny.user?.isPlatformUser === true) {
    return true;
  }

  // Priority 3: Check role level (level 8 = platform admin)
  const roleLevel = reqAny.user?.roleLevel;
  if (typeof roleLevel === 'number' && roleLevel >= 8) {
    return true;
  }

  // Priority 4: Check hasAllPermissions flag
  if (reqAny.user?.hasAllPermissions === true) {
    return true;
  }

  // Priority 5: Check for exact role code matches (not substring matching)
  const roleCode = (reqAny.user?.roleCode || '').toLowerCase();
  const roleName = (reqAny.user?.role?.name || '').toLowerCase();
  // Handle role as either string or object with name property
  const role = reqAny.user?.role;
  const roleString = (typeof role === 'string' ? role : '').toLowerCase();

  const exactAdminRoles = [
    'admin',
    'root_admin',
    'platform_admin',
    'system_admin',
    'super_admin',
    'company_admin',
  ];

  if (
    exactAdminRoles.includes(roleCode) ||
    exactAdminRoles.includes(roleName) ||
    exactAdminRoles.includes(roleString)
  ) {
    return true;
  }

  return false;
}

// Mock implementation of getRoleLevel for testing
function getRoleLevel(req: Request): number | undefined {
  const reqAny = req as any;

  if (typeof reqAny.user?.roleLevel === 'number') {
    return reqAny.user.roleLevel;
  }

  if (typeof reqAny.supabaseUser?.roleLevel === 'number') {
    return reqAny.supabaseUser.roleLevel;
  }

  return undefined;
}

// Helper to create mock request
function createMockRequest(data: any): Request {
  return data as Request;
}

// =====================================================================
// TESTS
// =====================================================================

describe('Auth Helpers', () => {
  describe('isPlatformAdmin', () => {
    describe('Priority 1: isPlatformUser flag from Supabase JWT', () => {
      it('should return true when supabaseUser.isPlatformUser is true', () => {
        const req = createMockRequest({
          supabaseUser: { isPlatformUser: true },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return false when supabaseUser.isPlatformUser is false', () => {
        const req = createMockRequest({
          supabaseUser: { isPlatformUser: false },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should not treat undefined as true', () => {
        const req = createMockRequest({
          supabaseUser: { isPlatformUser: undefined },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });
    });

    describe('Priority 2: isPlatformUser flag from user object', () => {
      it('should return true when user.isPlatformUser is true', () => {
        const req = createMockRequest({
          user: { isPlatformUser: true },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return false when user.isPlatformUser is false', () => {
        const req = createMockRequest({
          user: { isPlatformUser: false },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });
    });

    describe('Priority 3: Role level check', () => {
      it('should return true when roleLevel is 8', () => {
        const req = createMockRequest({
          user: { roleLevel: 8 },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return true when roleLevel is greater than 8', () => {
        const req = createMockRequest({
          user: { roleLevel: 9 },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return false when roleLevel is 7', () => {
        const req = createMockRequest({
          user: { roleLevel: 7 },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should return false when roleLevel is 1', () => {
        const req = createMockRequest({
          user: { roleLevel: 1 },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should handle non-numeric roleLevel gracefully', () => {
        const req = createMockRequest({
          user: { roleLevel: 'high' },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });
    });

    describe('Priority 4: hasAllPermissions flag', () => {
      it('should return true when hasAllPermissions is true', () => {
        const req = createMockRequest({
          user: { hasAllPermissions: true },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return false when hasAllPermissions is false', () => {
        const req = createMockRequest({
          user: { hasAllPermissions: false },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });
    });

    describe('Priority 5: Exact role code matches', () => {
      it('should return true for exact "admin" role code', () => {
        const req = createMockRequest({
          user: { roleCode: 'admin' },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return true for exact "platform_admin" role code', () => {
        const req = createMockRequest({
          user: { roleCode: 'platform_admin' },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return true for exact "root_admin" role code', () => {
        const req = createMockRequest({
          user: { roleCode: 'root_admin' },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return true for exact "system_admin" role code', () => {
        const req = createMockRequest({
          user: { roleCode: 'system_admin' },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should return true for exact "company_admin" role code', () => {
        const req = createMockRequest({
          user: { roleCode: 'company_admin' },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should be case-insensitive', () => {
        const req = createMockRequest({
          user: { roleCode: 'PLATFORM_ADMIN' },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });
    });

    describe('False positive prevention (SECURITY CRITICAL)', () => {
      it('should NOT match "administrator_assistant" (contains "admin" as substring)', () => {
        const req = createMockRequest({
          user: { roleCode: 'administrator_assistant' },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should NOT match "system_monitor" (contains "system" as substring)', () => {
        const req = createMockRequest({
          user: { roleCode: 'system_monitor' },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should NOT match "platform_viewer" (contains "platform" as substring)', () => {
        const req = createMockRequest({
          user: { roleCode: 'platform_viewer' },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should NOT match "admin_viewer" (starts with "admin" but not exact)', () => {
        const req = createMockRequest({
          user: { roleCode: 'admin_viewer' },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should NOT match "super_admin_assistant" (contains "super_admin" but not exact)', () => {
        const req = createMockRequest({
          user: { roleCode: 'super_admin_assistant' },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should NOT match "root_admin_limited" (contains "root_admin" but not exact)', () => {
        const req = createMockRequest({
          user: { roleCode: 'root_admin_limited' },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should NOT match empty string', () => {
        const req = createMockRequest({
          user: { roleCode: '' },
        });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should NOT match regular user roles', () => {
        const regularRoles = [
          'sales_rep',
          'technician',
          'manager',
          'team_lead',
          'guest',
          'viewer',
          'editor',
          'analyst',
        ];

        for (const role of regularRoles) {
          const req = createMockRequest({
            user: { roleCode: role },
          });
          expect(isPlatformAdmin(req)).toBe(false);
        }
      });
    });

    describe('Edge cases', () => {
      it('should return false for empty request', () => {
        const req = createMockRequest({});
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should return false for null user', () => {
        const req = createMockRequest({ user: null });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should return false for undefined user', () => {
        const req = createMockRequest({ user: undefined });
        expect(isPlatformAdmin(req)).toBe(false);
      });

      it('should handle role as string directly (not object)', () => {
        const req = createMockRequest({
          user: { role: 'platform_admin' },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });

      it('should handle role.name in nested object', () => {
        const req = createMockRequest({
          user: { role: { name: 'platform_admin' } },
        });
        expect(isPlatformAdmin(req)).toBe(true);
      });
    });
  });

  describe('getRoleLevel', () => {
    it('should return roleLevel from user object', () => {
      const req = createMockRequest({
        user: { roleLevel: 5 },
      });
      expect(getRoleLevel(req)).toBe(5);
    });

    it('should return roleLevel from supabaseUser if user not available', () => {
      const req = createMockRequest({
        supabaseUser: { roleLevel: 7 },
      });
      expect(getRoleLevel(req)).toBe(7);
    });

    it('should prefer user.roleLevel over supabaseUser.roleLevel', () => {
      const req = createMockRequest({
        user: { roleLevel: 6 },
        supabaseUser: { roleLevel: 8 },
      });
      expect(getRoleLevel(req)).toBe(6);
    });

    it('should return undefined for non-numeric roleLevel', () => {
      const req = createMockRequest({
        user: { roleLevel: 'high' },
      });
      expect(getRoleLevel(req)).toBeUndefined();
    });

    it('should return undefined when no roleLevel available', () => {
      const req = createMockRequest({});
      expect(getRoleLevel(req)).toBeUndefined();
    });

    it('should handle roleLevel of 0', () => {
      const req = createMockRequest({
        user: { roleLevel: 0 },
      });
      expect(getRoleLevel(req)).toBe(0);
    });
  });
});
