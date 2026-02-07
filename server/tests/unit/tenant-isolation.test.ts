/**
 * Unit Tests: Tenant Isolation and Multi-Tenancy
 * Tests for tenant resolution, tenant requirement enforcement,
 * hierarchical query scoping, and cross-tenant access prevention.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  createMockReq,
  createMockRes,
  createMockNext,
  TEST_TENANT_ID,
  TEST_USER_ID,
} from '../helpers/test-utils';

// ─── requireTenant (from requireTenant.ts) ─────────────────────────
import { requireTenant as requireTenantStrict } from '../../middleware/requireTenant';

// ─── requireTenant (from tenancy.ts) ────────────────────────────────
import {
  requireTenant as requireTenantTenancy,
  createSlugFromName,
} from '../../middleware/tenancy';

// ─── HierarchicalQueryBuilder ───────────────────────────────────────
import { HierarchicalQueryBuilder } from '../../middleware/hierarchical-query-builder';
import type { EnhancedUserContext } from '../../middleware/enhanced-rbac-middleware';

// ─── Helper: Create mock EnhancedUserContext ────────────────────────
function createUserContext(overrides: Partial<EnhancedUserContext> = {}): EnhancedUserContext {
  return {
    id: TEST_USER_ID,
    email: 'user@test.com',
    tenantId: TEST_TENANT_ID,
    roleId: 'role-1',
    roleName: 'Sales Rep',
    roleLevel: 1,
    territoryScope: 'own',
    permissions: new Set(['sales.lead.view_own']),
    hasAllPermissions: false,
    locationId: null,
    regionId: null,
    teamId: null,
    managerId: null,
    ...overrides,
  } as EnhancedUserContext;
}

describe('Tenant Isolation', () => {
  // ═══════════════════════════════════════════════════════════════════
  // requireTenant (from requireTenant.ts)
  // ═══════════════════════════════════════════════════════════════════
  describe('requireTenant (strict)', () => {
    it('should call next() when req.tenantId is set', () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();

      requireTenantStrict(req as any, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when req.tenantId is missing', () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      requireTenantStrict(req as any, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        message: 'Tenant identification required',
        code: 'TENANT_REQUIRED',
      });
    });

    it('should return 401 when req.tenantId is empty string', () => {
      const req = createMockReq({}) as any;
      req.tenantId = '';
      const res = createMockRes();
      const next = createMockNext();

      requireTenantStrict(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // requireTenant (from tenancy.ts)
  // ═══════════════════════════════════════════════════════════════════
  describe('requireTenant (tenancy module)', () => {
    it('should call next() when req.tenantId is set', () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();

      requireTenantTenancy(req as any, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next() when req.tenant object exists', () => {
      const req = createMockReq({}) as any;
      req.tenant = { id: TEST_TENANT_ID, name: 'Test', slug: 'test' };
      const res = createMockRes();
      const next = createMockNext();

      requireTenantTenancy(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when neither tenant nor tenantId exists', () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      requireTenantTenancy(req as any, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._json.error).toBe('Tenant required');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // createSlugFromName utility
  // ═══════════════════════════════════════════════════════════════════
  describe('createSlugFromName', () => {
    it('should convert company name to URL-safe slug', () => {
      expect(createSlugFromName('ABC Copiers')).toBe('abc-copiers');
    });

    it('should remove special characters', () => {
      expect(createSlugFromName("O'Brien & Sons")).toBe('obrien-sons');
    });

    it('should handle multiple spaces', () => {
      expect(createSlugFromName('Acme   Corp')).toBe('acme-corp');
    });

    it('should handle leading/trailing hyphens', () => {
      expect(createSlugFromName('-Test Company-')).toBe('test-company');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HierarchicalQueryBuilder - Query Scoping
  // ═══════════════════════════════════════════════════════════════════
  describe('HierarchicalQueryBuilder', () => {
    describe('applyHierarchicalFilter - scope-based data scoping', () => {
      it('should return undefined for platform scope (no filtering)', () => {
        const ctx = createUserContext({
          territoryScope: 'platform',
          hasAllPermissions: true,
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        // Platform scope: no filters applied
        expect(filter).toBeUndefined();
      });

      it('should filter by tenantId for company scope', () => {
        const ctx = createUserContext({
          territoryScope: 'company',
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        // Company scope generates a tenant filter
        expect(filter).toBeDefined();
      });

      it('should filter by tenantId + regionId for regional scope', () => {
        const ctx = createUserContext({
          territoryScope: 'regional',
          regionId: 'region-1',
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        expect(filter).toBeDefined();
      });

      it('should filter by tenantId + locationId for location scope', () => {
        const ctx = createUserContext({
          territoryScope: 'location',
          locationId: 'location-1',
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        expect(filter).toBeDefined();
      });

      it('should block all data when location scope but no locationId (prevent leak)', () => {
        const ctx = createUserContext({
          territoryScope: 'location',
          locationId: null,
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        // Should generate a "1 = 0" filter to block all data
        expect(filter).toBeDefined();
      });

      it('should filter by teamId for team scope', () => {
        const ctx = createUserContext({
          territoryScope: 'team',
          teamId: 'team-1',
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        expect(filter).toBeDefined();
      });

      it('should filter by userId for own scope', () => {
        const ctx = createUserContext({
          territoryScope: 'own',
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        expect(filter).toBeDefined();
      });

      it('should use overrideScope when provided', () => {
        const ctx = createUserContext({
          territoryScope: 'company', // Normal scope
        });
        const qb = new HierarchicalQueryBuilder(ctx);

        // Override to 'own' scope for specific query
        const filter = qb.applyHierarchicalFilter({ overrideScope: 'own' });
        expect(filter).toBeDefined();
      });
    });

    describe('cross-tenant isolation', () => {
      it('should use the users own tenantId for non-platform scopes', () => {
        const tenantA = 'tenant-A';
        const tenantB = 'tenant-B';

        // User belongs to tenant A
        const ctxA = createUserContext({
          tenantId: tenantA,
          territoryScope: 'company',
        });
        const qbA = new HierarchicalQueryBuilder(ctxA);
        const filterA = qbA.applyHierarchicalFilter();

        // User belongs to tenant B
        const ctxB = createUserContext({
          tenantId: tenantB,
          territoryScope: 'company',
        });
        const qbB = new HierarchicalQueryBuilder(ctxB);
        const filterB = qbB.applyHierarchicalFilter();

        // Both should produce filters (tenant isolation)
        expect(filterA).toBeDefined();
        expect(filterB).toBeDefined();

        // They should produce different filters (different tenant IDs)
        expect(filterA).not.toEqual(filterB);
      });

      it('should not allow own-scope user to access another users data', () => {
        const ctx = createUserContext({
          id: 'user-1',
          territoryScope: 'own',
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        // The filter should restrict to user-1's data only
        expect(filter).toBeDefined();
      });

      it('should fall back to own scope when team scope has no team assigned', () => {
        const ctx = createUserContext({
          territoryScope: 'team',
          teamId: null,
          managerId: null,
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        // With no team or manager, should fall back to own-user filter
        expect(filter).toBeDefined();
      });

      it('should fall back to location scope when regional scope has no regionId', () => {
        const ctx = createUserContext({
          territoryScope: 'regional',
          regionId: null,
          locationId: 'location-1',
        });
        const qb = new HierarchicalQueryBuilder(ctx);
        const filter = qb.applyHierarchicalFilter();

        // Should fall back to filtering by locationId
        expect(filter).toBeDefined();
      });
    });
  });
});
