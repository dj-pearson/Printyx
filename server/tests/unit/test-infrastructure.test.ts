/**
 * Smoke Tests for Test Infrastructure
 * Verifies that test helpers, auth mocks, and db factories work correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockReq,
  createAuthenticatedReq,
  createAdminReq,
  createMockRes,
  createMockNext,
  createTenantReq,
  createCrossTenantReq,
  TEST_TENANT_ID,
  TEST_USER_ID,
  TEST_PLATFORM_ADMIN_ID,
  defaultUsers,
} from '../helpers/test-utils';
import {
  mockRequireAuth,
  mockRequireSupabaseAuth,
  mockProtectedRoute,
  mockPlatformAdminRoute,
  getSupabaseAuthMocks,
  getAuthHelperMocks,
} from '../helpers/auth-mocks';
import {
  buildTenant,
  buildUser,
  buildLead,
  buildCustomer,
  buildQuote,
  buildOrder,
  buildInvoice,
  buildMany,
  resetFactories,
} from '../helpers/db-helpers';

// ─── Smoke Test 1: Request/Response Factories ────────────────────────

describe('Test Utils - Request/Response Factories', () => {
  it('should create a basic mock request with defaults', () => {
    const req = createMockReq();
    expect(req.params).toEqual({});
    expect(req.query).toEqual({});
    expect(req.body).toEqual({});
    expect(req.method).toBe('GET');
    expect(req.path).toBe('/api/test');
  });

  it('should create an authenticated request with supabaseUser', () => {
    const req = createAuthenticatedReq();
    const reqAny = req as any;

    expect(reqAny.supabaseUser).toBeDefined();
    expect(reqAny.supabaseUser.id).toBe(TEST_USER_ID);
    expect(reqAny.supabaseUser.tenantId).toBe(TEST_TENANT_ID);
    expect(reqAny.supabaseUser.isPlatformUser).toBe(false);
    expect(reqAny.supabaseUser.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(reqAny.tenantId).toBe(TEST_TENANT_ID);
  });

  it('should create an authenticated request with user overrides', () => {
    const req = createAuthenticatedReq({
      id: 'custom-user',
      email: 'custom@test.com',
      tenantId: 'custom-tenant',
    });
    const reqAny = req as any;

    expect(reqAny.supabaseUser.id).toBe('custom-user');
    expect(reqAny.supabaseUser.email).toBe('custom@test.com');
    expect(reqAny.supabaseUser.tenantId).toBe('custom-tenant');
    expect(reqAny.tenantId).toBe('custom-tenant');
  });

  it('should create an admin request with platform privileges', () => {
    const req = createAdminReq();
    const reqAny = req as any;

    expect(reqAny.supabaseUser.id).toBe(TEST_PLATFORM_ADMIN_ID);
    expect(reqAny.supabaseUser.isPlatformUser).toBe(true);
  });

  it('should create a tenant-scoped request', () => {
    const req = createTenantReq('tenant-abc');
    const reqAny = req as any;

    expect(reqAny.supabaseUser.tenantId).toBe('tenant-abc');
    expect(reqAny.tenantId).toBe('tenant-abc');
  });

  it('should create a cross-tenant request for security testing', () => {
    const req = createCrossTenantReq('tenant-a', 'tenant-b');
    const reqAny = req as any;

    expect(reqAny.supabaseUser.tenantId).toBe('tenant-a');
    // Header contains different tenant
    expect(req.headers['x-tenant-id']).toBe('tenant-b');
  });

  it('should create a mock response that tracks calls', () => {
    const res = createMockRes();

    res.status(404);
    expect(res._status).toBe(404);
    expect(res.status).toHaveBeenCalledWith(404);

    res.json({ message: 'Not found' });
    expect(res._json).toEqual({ message: 'Not found' });
    expect(res.json).toHaveBeenCalledWith({ message: 'Not found' });
  });

  it('should create a mock next function', () => {
    const next = createMockNext();
    next();
    expect(next).toHaveBeenCalled();
  });

  it('should provide default user presets', () => {
    expect(defaultUsers.salesRep.roleLevel).toBe(1);
    expect(defaultUsers.salesManager.roleLevel).toBe(4);
    expect(defaultUsers.platformAdmin.roleLevel).toBe(8);
    expect(defaultUsers.platformAdmin.isPlatformUser).toBe(true);
  });
});

// ─── Smoke Test 2: Auth Mocks ────────────────────────────────────────

describe('Auth Mocks - Middleware Factories', () => {
  it('should create a requireAuth mock that sets req.user', () => {
    const middleware = mockRequireAuth({ roleLevel: 4 });
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect((req as any).user.id).toBe(TEST_USER_ID);
    expect((req as any).user.tenantId).toBe(TEST_TENANT_ID);
    expect((req as any).user.roleLevel).toBe(4);
    expect(next).toHaveBeenCalled();
  });

  it('should create a requireSupabaseAuth mock that sets req.supabaseUser', () => {
    const middleware = mockRequireSupabaseAuth({ email: 'test@example.com' });
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect((req as any).supabaseUser.id).toBe(TEST_USER_ID);
    expect((req as any).supabaseUser.email).toBe('test@example.com');
    expect((req as any).supabaseUser.tenantId).toBe(TEST_TENANT_ID);
    expect(next).toHaveBeenCalled();
  });

  it('should create a protectedRoute mock that sets supabaseUser + tenantId', () => {
    const middleware = mockProtectedRoute();
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect((req as any).supabaseUser).toBeDefined();
    expect((req as any).tenantId).toBe(TEST_TENANT_ID);
    expect(next).toHaveBeenCalled();
  });

  it('should create a platformAdminRoute mock with admin privileges', () => {
    const middleware = mockPlatformAdminRoute();
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect((req as any).supabaseUser.isPlatformUser).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it('should provide vi.mock-ready supabase auth module mocks', () => {
    const mocks = getSupabaseAuthMocks();

    expect(mocks.authenticateSupabaseJWT).toBeDefined();
    expect(mocks.requireSupabaseAuth).toBeDefined();
    expect(mocks.requireTenantContext).toBeDefined();
    expect(mocks.protectedRoute).toHaveLength(1);
    expect(mocks.platformAdminRoute).toHaveLength(1);
    expect(mocks.getUserId).toBeDefined();
    expect(mocks.getTenantId).toBeDefined();
  });

  it('should provide vi.mock-ready auth helper mocks', () => {
    const mocks = getAuthHelperMocks({ userId: 'custom-user', tenantId: 'custom-tenant' });

    expect(mocks.getUserId()).toBe('custom-user');
    expect(mocks.getTenantId()).toBe('custom-tenant');
    expect(mocks.isAuthenticated()).toBe(true);
    expect(mocks.isPlatformAdmin()).toBe(false);
    expect(mocks.getUserContext()).toEqual(
      expect.objectContaining({ id: 'custom-user', tenantId: 'custom-tenant' }),
    );
  });
});

// ─── Smoke Test 3: DB Factories ──────────────────────────────────────

describe('DB Helpers - Entity Factories', () => {
  beforeEach(() => {
    resetFactories();
  });

  it('should build a tenant with defaults', () => {
    const tenant = buildTenant();
    expect(tenant.id).toMatch(/^tenant-/);
    expect(tenant.name).toContain('Test Tenant');
    expect(tenant.isActive).toBe(true);
    expect(tenant.createdAt).toBeInstanceOf(Date);
  });

  it('should build a tenant with overrides', () => {
    const tenant = buildTenant({ id: 'my-tenant', name: 'Acme Corp', isActive: false });
    expect(tenant.id).toBe('my-tenant');
    expect(tenant.name).toBe('Acme Corp');
    expect(tenant.isActive).toBe(false);
  });

  it('should build a user with defaults', () => {
    const user = buildUser();
    expect(user.id).toMatch(/^user-/);
    expect(user.tenantId).toBe(TEST_TENANT_ID);
    expect(user.email).toContain('@test.com');
    expect(user.isActive).toBe(true);
  });

  it('should build a lead (business record with status=lead)', () => {
    const lead = buildLead();
    expect(lead.status).toBe('lead');
    expect(lead.tenantId).toBe(TEST_TENANT_ID);
    expect(lead.ownerId).toBe(TEST_USER_ID);
    expect(lead.companyName).toContain('Lead Company');
  });

  it('should build a customer (business record with status=customer)', () => {
    const customer = buildCustomer();
    expect(customer.status).toBe('customer');
    expect(customer.companyName).toContain('Customer Company');
  });

  it('should build quotes, orders, and invoices', () => {
    const quote = buildQuote();
    expect(quote.status).toBe('draft');
    expect(quote.totalAmount).toBe(5000);

    const order = buildOrder();
    expect(order.status).toBe('pending');
    expect(order.orderNumber).toMatch(/^ORD-/);

    const invoice = buildInvoice();
    expect(invoice.status).toBe('draft');
    expect(invoice.invoiceNumber).toMatch(/^INV-/);
    expect(invoice.dueDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('should build multiple entities with buildMany', () => {
    const leads = buildMany(buildLead, 5, { tenantId: 'bulk-tenant' });
    expect(leads).toHaveLength(5);
    leads.forEach((lead) => {
      expect(lead.tenantId).toBe('bulk-tenant');
      expect(lead.status).toBe('lead');
    });
  });

  it('should generate unique IDs with resetFactories', () => {
    const lead1 = buildLead();
    const lead2 = buildLead();
    expect(lead1.id).not.toBe(lead2.id);

    // After reset, IDs start over
    resetFactories();
    const lead3 = buildLead();
    expect(lead3.id).toBe(lead1.id); // Same first ID after reset
  });
});
