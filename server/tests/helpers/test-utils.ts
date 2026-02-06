/**
 * Test Utilities
 * Mock Express request/response factories, JWT helpers, and tenant context utilities.
 */

import { Request, Response, NextFunction } from 'express';
import { vi } from 'vitest';

// ─── Types ───────────────────────────────────────────────────────────

export interface MockSupabaseUser {
  id: string;
  email?: string;
  tenantId?: string;
  isPlatformUser?: boolean;
  roleId?: string;
  accessScope?: string;
  roleLevel?: number;
  exp?: number;
}

export interface MockUser {
  id: string;
  email?: string;
  tenantId?: string;
  roleLevel?: number;
  roleName?: string;
  organizationalScope?: string;
  locationId?: string | null;
  regionalId?: string | null;
  companyId?: string | null;
  permissions?: string[];
  isPlatformUser?: boolean;
  hasAllPermissions?: boolean;
  roleCode?: string;
}

export interface MockRequestOptions {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  path?: string;
  method?: string;
  ip?: string;
  user?: MockUser;
  supabaseUser?: MockSupabaseUser;
  tenantId?: string;
  session?: Record<string, unknown>;
}

// ─── Default Test Data ───────────────────────────────────────────────

export const TEST_TENANT_ID = 'tenant-test-1';
export const TEST_USER_ID = 'user-test-1';
export const TEST_PLATFORM_ADMIN_ID = 'user-platform-admin-1';

export const defaultUsers = {
  salesRep: {
    id: 'user-sales-rep-1',
    email: 'salesrep@test.com',
    tenantId: TEST_TENANT_ID,
    roleLevel: 1,
    roleName: 'Sales Representative',
    organizationalScope: 'own',
    locationId: 'location-1',
    regionalId: null,
    companyId: 'company-1',
    permissions: ['sales.lead.view_own', 'sales.lead.create', 'sales.opportunity.view_own'],
  },
  salesManager: {
    id: 'user-sales-manager-1',
    email: 'manager@test.com',
    tenantId: TEST_TENANT_ID,
    roleLevel: 4,
    roleName: 'Sales Manager',
    organizationalScope: 'location',
    locationId: 'location-1',
    regionalId: null,
    companyId: 'company-1',
    permissions: [
      'sales.lead.view_location',
      'sales.lead.edit_location',
      'sales.opportunity.view_location',
      'sales.report.view',
    ],
  },
  platformAdmin: {
    id: TEST_PLATFORM_ADMIN_ID,
    email: 'admin@test.com',
    tenantId: TEST_TENANT_ID,
    roleLevel: 8,
    roleName: 'Platform Administrator',
    organizationalScope: 'platform',
    locationId: null,
    regionalId: null,
    companyId: null,
    permissions: ['platform.admin.full_access', 'platform.tenant.manage'],
    isPlatformUser: true,
    hasAllPermissions: true,
  },
} as const;

// ─── Mock Express Request Factory ────────────────────────────────────

/**
 * Create a mock Express request with optional overrides.
 * Sets up user, supabaseUser, tenantId, and common request properties.
 */
export function createMockReq(options: MockRequestOptions = {}): Request {
  const req: any = {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {},
    path: options.path || '/api/test',
    method: options.method || 'GET',
    ip: options.ip || '127.0.0.1',
    get: vi.fn((header: string) => {
      const h = (options.headers || {}) as Record<string, string>;
      return h[header.toLowerCase()] || h[header] || undefined;
    }),
  };

  if (options.user) {
    req.user = { ...options.user };
  }

  if (options.supabaseUser) {
    req.supabaseUser = { ...options.supabaseUser };
  }

  if (options.tenantId) {
    req.tenantId = options.tenantId;
  }

  if (options.session) {
    req.session = { ...options.session };
  }

  return req as Request;
}

/**
 * Create a mock request pre-configured with a Supabase JWT user.
 * This simulates what the authenticateSupabaseJWT + requireSupabaseAuth middleware produces.
 */
export function createAuthenticatedReq(
  userOverrides: Partial<MockSupabaseUser> = {},
  requestOverrides: Omit<MockRequestOptions, 'supabaseUser'> = {},
): Request {
  const supabaseUser: MockSupabaseUser = {
    id: TEST_USER_ID,
    email: 'user@test.com',
    tenantId: TEST_TENANT_ID,
    isPlatformUser: false,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    ...userOverrides,
  };

  return createMockReq({
    ...requestOverrides,
    supabaseUser,
    tenantId: supabaseUser.tenantId,
  });
}

/**
 * Create a mock request as a platform admin.
 */
export function createAdminReq(
  requestOverrides: Omit<MockRequestOptions, 'supabaseUser'> = {},
): Request {
  return createAuthenticatedReq(
    {
      id: TEST_PLATFORM_ADMIN_ID,
      email: 'admin@test.com',
      isPlatformUser: true,
    },
    requestOverrides,
  );
}

// ─── Mock Express Response Factory ───────────────────────────────────

export interface MockResponse extends Response {
  _status: number;
  _json: unknown;
  _headers: Record<string, string>;
}

/**
 * Create a mock Express response that tracks status, json, and headers.
 */
export function createMockRes(): MockResponse {
  const res: any = {
    _status: 200,
    _json: undefined,
    _headers: {},
    status: vi.fn(function (this: any, code: number) {
      this._status = code;
      return this;
    }),
    json: vi.fn(function (this: any, data: unknown) {
      this._json = data;
      return this;
    }),
    send: vi.fn(function (this: any, data: unknown) {
      this._json = data;
      return this;
    }),
    setHeader: vi.fn(function (this: any, key: string, value: string) {
      this._headers[key] = value;
      return this;
    }),
    set: vi.fn(function (this: any, key: string, value: string) {
      this._headers[key] = value;
      return this;
    }),
    end: vi.fn(),
    headersSent: false,
  };

  return res as MockResponse;
}

// ─── Mock Next Function ──────────────────────────────────────────────

/**
 * Create a mock Express next function.
 */
export function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ─── Tenant Context Helpers ──────────────────────────────────────────

/**
 * Create a request with tenant context set via the x-tenant-id header.
 */
export function createTenantReq(
  tenantId: string,
  userOverrides: Partial<MockSupabaseUser> = {},
): Request {
  return createAuthenticatedReq(
    { tenantId, ...userOverrides },
    {
      tenantId,
      headers: { 'x-tenant-id': tenantId },
    },
  );
}

/**
 * Create a request for cross-tenant access testing.
 * Sets user to one tenant but header to another.
 */
export function createCrossTenantReq(userTenantId: string, headerTenantId: string): Request {
  return createAuthenticatedReq(
    { tenantId: userTenantId },
    {
      headers: { 'x-tenant-id': headerTenantId },
    },
  );
}
