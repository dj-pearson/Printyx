/**
 * Unit Tests: Auth Helpers (Extended)
 * Tests for getUserId, getTenantId, isAuthenticated, getRoleId,
 * getAccessScope, and getUserContext from auth-helpers.ts
 *
 * Note: isPlatformAdmin and getRoleLevel are already tested in auth-helpers.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getUserId,
  getTenantId,
  isAuthenticated,
  getRoleId,
  getAccessScope,
  getUserContext,
} from '../../utils/auth-helpers';
import { createMockReq, TEST_USER_ID, TEST_TENANT_ID } from '../helpers/test-utils';

describe('Auth Helpers - Extended', () => {
  // ─── getUserId ──────────────────────────────────────────────────────
  describe('getUserId', () => {
    it('should return id from supabaseUser (priority 1)', () => {
      const req = createMockReq({
        supabaseUser: { id: 'supabase-user-1' },
        user: {
          id: 'user-obj-1',
          tenantId: TEST_TENANT_ID,
          roleLevel: 1,
          roleName: 'test',
          organizationalScope: 'own',
        },
        session: { userId: 'session-user-1' },
      });
      expect(getUserId(req)).toBe('supabase-user-1');
    });

    it('should return id from user object (priority 2) when no supabaseUser', () => {
      const req = createMockReq({
        user: {
          id: 'user-obj-1',
          tenantId: TEST_TENANT_ID,
          roleLevel: 1,
          roleName: 'test',
          organizationalScope: 'own',
        },
        session: { userId: 'session-user-1' },
      });
      expect(getUserId(req)).toBe('user-obj-1');
    });

    it('should return claims.sub (priority 3) when no direct id', () => {
      const req = createMockReq({}) as any;
      req.user = { claims: { sub: 'claims-sub-1' } };
      expect(getUserId(req)).toBe('claims-sub-1');
    });

    it('should return session userId (priority 4) as last resort', () => {
      const req = createMockReq({
        session: { userId: 'session-user-1' },
      });
      expect(getUserId(req)).toBe('session-user-1');
    });

    it('should return undefined when no auth source available', () => {
      const req = createMockReq({});
      expect(getUserId(req)).toBeUndefined();
    });

    it('should return undefined when all auth objects are empty', () => {
      const req = createMockReq({}) as any;
      req.user = {};
      req.supabaseUser = {};
      req.session = {};
      expect(getUserId(req)).toBeUndefined();
    });
  });

  // ─── getTenantId ────────────────────────────────────────────────────
  describe('getTenantId', () => {
    it('should return tenantId from req.tenantId (priority 1)', () => {
      const req = createMockReq({
        tenantId: 'resolved-tenant',
        supabaseUser: { id: TEST_USER_ID, tenantId: 'supabase-tenant' },
        user: {
          id: TEST_USER_ID,
          tenantId: 'user-tenant',
          roleLevel: 1,
          roleName: 'test',
          organizationalScope: 'own',
        },
      });
      expect(getTenantId(req)).toBe('resolved-tenant');
    });

    it('should return tenantId from supabaseUser (priority 2) when no req.tenantId', () => {
      const req = createMockReq({
        supabaseUser: { id: TEST_USER_ID, tenantId: 'supabase-tenant' },
      });
      expect(getTenantId(req)).toBe('supabase-tenant');
    });

    it('should return tenantId from user object (priority 3)', () => {
      const req = createMockReq({
        user: {
          id: TEST_USER_ID,
          tenantId: 'user-tenant',
          roleLevel: 1,
          roleName: 'test',
          organizationalScope: 'own',
        },
      });
      expect(getTenantId(req)).toBe('user-tenant');
    });

    it('should return tenantId from session (priority 4)', () => {
      const req = createMockReq({
        session: { tenantId: 'session-tenant' },
      });
      expect(getTenantId(req)).toBe('session-tenant');
    });

    it('should return undefined when no tenant source available', () => {
      const req = createMockReq({});
      expect(getTenantId(req)).toBeUndefined();
    });
  });

  // ─── isAuthenticated ───────────────────────────────────────────────
  describe('isAuthenticated', () => {
    it('should return true when user is authenticated via JWT', () => {
      const req = createMockReq({
        supabaseUser: { id: TEST_USER_ID },
      });
      expect(isAuthenticated(req)).toBe(true);
    });

    it('should return true when user is authenticated via session', () => {
      const req = createMockReq({
        session: { userId: 'session-user-1' },
      });
      expect(isAuthenticated(req)).toBe(true);
    });

    it('should return false when no auth present', () => {
      const req = createMockReq({});
      expect(isAuthenticated(req)).toBe(false);
    });
  });

  // ─── getRoleId ─────────────────────────────────────────────────────
  describe('getRoleId', () => {
    it('should return roleId from supabaseUser (priority 1)', () => {
      const req = createMockReq({
        supabaseUser: { id: TEST_USER_ID, roleId: 'supabase-role' },
        user: {
          id: TEST_USER_ID,
          tenantId: TEST_TENANT_ID,
          roleLevel: 1,
          roleName: 'test',
          organizationalScope: 'own',
        } as any,
      });
      // user doesn't have roleId so supabaseUser wins by default
      expect(getRoleId(req)).toBe('supabase-role');
    });

    it('should return roleId from user object when no supabaseUser roleId', () => {
      const req = createMockReq({}) as any;
      req.user = { roleId: 'user-role' };
      expect(getRoleId(req)).toBe('user-role');
    });

    it('should return undefined when no roleId available', () => {
      const req = createMockReq({});
      expect(getRoleId(req)).toBeUndefined();
    });
  });

  // ─── getAccessScope ────────────────────────────────────────────────
  describe('getAccessScope', () => {
    it('should return accessScope from supabaseUser (priority 1)', () => {
      const req = createMockReq({
        supabaseUser: { id: TEST_USER_ID, accessScope: 'company' },
      });
      expect(getAccessScope(req)).toBe('company');
    });

    it('should return accessScope from user object when no supabaseUser scope', () => {
      const req = createMockReq({}) as any;
      req.user = { accessScope: 'team' };
      expect(getAccessScope(req)).toBe('team');
    });

    it('should return "own" as default when no scope available', () => {
      const req = createMockReq({});
      expect(getAccessScope(req)).toBe('own');
    });
  });

  // ─── getUserContext ────────────────────────────────────────────────
  describe('getUserContext', () => {
    it('should return full user context when authenticated', () => {
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          email: 'test@example.com',
          tenantId: TEST_TENANT_ID,
          roleId: 'role-1',
          accessScope: 'company',
          isPlatformUser: false,
        },
        tenantId: TEST_TENANT_ID,
      });
      const ctx = getUserContext(req);
      expect(ctx).not.toBeNull();
      expect(ctx!.id).toBe(TEST_USER_ID);
      expect(ctx!.email).toBe('test@example.com');
      expect(ctx!.tenantId).toBe(TEST_TENANT_ID);
      expect(ctx!.roleId).toBe('role-1');
      expect(ctx!.accessScope).toBe('company');
      expect(ctx!.isPlatformUser).toBe(false);
    });

    it('should return null when not authenticated', () => {
      const req = createMockReq({});
      expect(getUserContext(req)).toBeNull();
    });

    it('should mark isPlatformUser true for admin users', () => {
      const req = createMockReq({
        supabaseUser: {
          id: TEST_USER_ID,
          isPlatformUser: true,
          tenantId: TEST_TENANT_ID,
        },
      });
      const ctx = getUserContext(req);
      expect(ctx).not.toBeNull();
      expect(ctx!.isPlatformUser).toBe(true);
    });

    it('should use default accessScope when none set', () => {
      const req = createMockReq({
        supabaseUser: { id: TEST_USER_ID },
      });
      const ctx = getUserContext(req);
      expect(ctx).not.toBeNull();
      expect(ctx!.accessScope).toBe('own');
    });
  });
});
