/**
 * Auth Mocks
 * Mock implementations of auth middleware for unit testing route handlers
 * without requiring a real JWT or Supabase connection.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { vi } from 'vitest';
import { TEST_TENANT_ID, TEST_USER_ID, type MockSupabaseUser } from './test-utils';

// ─── Mock Middleware Factories ───────────────────────────────────────

/**
 * Create a mock requireAuth middleware that sets req.user and calls next().
 * Simulates server/replitAuth.ts requireAuth behavior.
 */
export function mockRequireAuth(userOverrides: Record<string, unknown> = {}): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    (req as any).user = {
      id: TEST_USER_ID,
      tenantId: TEST_TENANT_ID,
      ...userOverrides,
    };
    next();
  };
}

/**
 * Create a mock requireSupabaseAuth middleware that sets req.supabaseUser and calls next().
 * Simulates server/middleware/supabase-auth.ts requireSupabaseAuth behavior.
 */
export function mockRequireSupabaseAuth(
  userOverrides: Partial<MockSupabaseUser> = {},
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    (req as any).supabaseUser = {
      id: TEST_USER_ID,
      email: 'user@test.com',
      tenantId: TEST_TENANT_ID,
      isPlatformUser: false,
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...userOverrides,
    };
    next();
  };
}

/**
 * Create a mock protectedRoute middleware chain that sets req.supabaseUser,
 * requires auth, and sets req.tenantId.
 * Simulates the combined [authenticateSupabaseJWT, requireSupabaseAuth, requireTenantContext] chain.
 */
export function mockProtectedRoute(userOverrides: Partial<MockSupabaseUser> = {}): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const tenantId = userOverrides.tenantId || TEST_TENANT_ID;
    (req as any).supabaseUser = {
      id: TEST_USER_ID,
      email: 'user@test.com',
      tenantId,
      isPlatformUser: false,
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...userOverrides,
    };
    (req as any).tenantId = tenantId;
    next();
  };
}

/**
 * Create a mock platformAdminRoute middleware that sets req.supabaseUser with admin privileges.
 */
export function mockPlatformAdminRoute(): RequestHandler {
  return mockProtectedRoute({
    id: 'user-platform-admin-1',
    email: 'admin@test.com',
    isPlatformUser: true,
    tenantId: TEST_TENANT_ID,
  });
}

// ─── Module Mock Helpers ─────────────────────────────────────────────

/**
 * Get mock implementations for vi.mock of server/middleware/supabase-auth.
 * Usage:
 *   vi.mock('../middleware/supabase-auth', () => getSupabaseAuthMocks());
 */
export function getSupabaseAuthMocks(userOverrides: Partial<MockSupabaseUser> = {}) {
  return {
    authenticateSupabaseJWT: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    requireSupabaseAuth: mockRequireSupabaseAuth(userOverrides),
    requireTenantContext: vi.fn((req: Request, _res: Response, next: NextFunction) => {
      (req as any).tenantId = (req as any).supabaseUser?.tenantId || TEST_TENANT_ID;
      next();
    }),
    protectedRoute: [mockProtectedRoute(userOverrides)],
    platformAdminRoute: [mockPlatformAdminRoute()],
    requirePlatformAdmin: vi.fn((req: Request, res: Response, next: NextFunction) => {
      if ((req as any).supabaseUser?.isPlatformUser) {
        next();
      } else {
        res.status(403).json({ message: 'Platform admin access required', code: 'FORBIDDEN' });
      }
    }),
    getUserId: vi.fn((req: Request) => (req as any).supabaseUser?.id || (req as any).user?.id),
    getTenantId: vi.fn(
      (req: Request) =>
        (req as any).supabaseUser?.tenantId || (req as any).tenantId || (req as any).user?.tenantId,
    ),
    isSupabaseAuthenticated: vi.fn(() => true),
  };
}

/**
 * Get mock implementations for vi.mock of server/replitAuth.
 * Usage:
 *   vi.mock('../replitAuth', () => getReplitAuthMocks());
 */
export function getReplitAuthMocks(userOverrides: Record<string, unknown> = {}) {
  return {
    requireAuth: mockRequireAuth(userOverrides),
    isAuthenticated: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    setupAuth: vi.fn(),
  };
}

/**
 * Get mock implementations for vi.mock of server/utils/auth-helpers.
 * Usage:
 *   vi.mock('../utils/auth-helpers', () => getAuthHelperMocks());
 */
export function getAuthHelperMocks(overrides: { userId?: string; tenantId?: string } = {}) {
  const userId = overrides.userId || TEST_USER_ID;
  const tenantId = overrides.tenantId || TEST_TENANT_ID;

  return {
    getUserId: vi.fn(() => userId),
    getTenantId: vi.fn(() => tenantId),
    isAuthenticated: vi.fn(() => true),
    isPlatformAdmin: vi.fn(() => false),
    getRoleId: vi.fn(() => 'role-1'),
    getAccessScope: vi.fn(() => 'own'),
    getRoleLevel: vi.fn(() => 1),
    getUserContext: vi.fn(() => ({
      id: userId,
      email: 'user@test.com',
      tenantId,
      roleId: 'role-1',
      accessScope: 'own',
      isPlatformUser: false,
    })),
  };
}
