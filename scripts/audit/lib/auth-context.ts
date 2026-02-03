/**
 * Auth Context
 * Mock authentication contexts for testing with different user roles
 */

import type { TestUserContext } from './types';

// ============================================================================
// Mock User Contexts
// ============================================================================

export const TEST_CONTEXTS: TestUserContext[] = [
  {
    name: 'salesRep',
    userId: 'user-sales-rep-1',
    tenantId: 'tenant-test-1',
    roleLevel: 1,
    roleName: 'Sales Representative',
    organizationalScope: 'own',
    locationId: 'location-1',
    companyId: 'company-1',
    permissions: ['sales.lead.view_own', 'sales.lead.create', 'sales.opportunity.view_own'],
  },
  {
    name: 'salesManager',
    userId: 'user-sales-manager-1',
    tenantId: 'tenant-test-1',
    roleLevel: 4,
    roleName: 'Sales Manager',
    organizationalScope: 'location',
    locationId: 'location-1',
    companyId: 'company-1',
    permissions: [
      'sales.lead.view_location',
      'sales.lead.edit_location',
      'sales.opportunity.view_location',
      'sales.report.view',
    ],
  },
  {
    name: 'regionalDirector',
    userId: 'user-regional-director-1',
    tenantId: 'tenant-test-1',
    roleLevel: 5,
    roleName: 'Regional Sales Director',
    organizationalScope: 'regional',
    locationId: 'location-1',
    regionalId: 'regional-1',
    companyId: 'company-1',
    permissions: [
      'sales.lead.view_regional',
      'sales.lead.edit_regional',
      'sales.opportunity.view_regional',
      'sales.report.view',
      'sales.report.export',
    ],
  },
  {
    name: 'vp',
    userId: 'user-vp-1',
    tenantId: 'tenant-test-1',
    roleLevel: 6,
    roleName: 'VP Sales',
    organizationalScope: 'company',
    locationId: 'location-1',
    regionalId: 'regional-1',
    companyId: 'company-1',
    permissions: [
      'sales.lead.view_company',
      'sales.lead.edit_company',
      'sales.opportunity.view_company',
      'sales.report.view',
      'sales.report.export',
      'sales.report.schedule',
    ],
  },
  {
    name: 'ceo',
    userId: 'user-ceo-1',
    tenantId: 'tenant-test-1',
    roleLevel: 7,
    roleName: 'CEO',
    organizationalScope: 'company',
    locationId: 'location-1',
    regionalId: 'regional-1',
    companyId: 'company-1',
    permissions: [
      'executive.dashboard.view',
      'executive.report.view',
      'sales.lead.view_company',
      'finance.report.view',
      'operations.report.view',
    ],
  },
  {
    name: 'platformAdmin',
    userId: 'user-platform-admin-1',
    tenantId: 'tenant-test-1',
    roleLevel: 8,
    roleName: 'Platform Administrator',
    organizationalScope: 'platform',
    permissions: ['platform.admin.full_access', 'platform.tenant.manage', 'platform.report.view'],
  },
];

// Cross-tenant context for isolation testing
export const CROSS_TENANT_CONTEXT: TestUserContext = {
  name: 'crossTenantUser',
  userId: 'user-cross-tenant-1',
  tenantId: 'tenant-test-2', // Different tenant!
  roleLevel: 8,
  roleName: 'Platform Administrator',
  organizationalScope: 'platform',
  companyId: 'company-2',
  permissions: ['platform.admin.full_access', 'platform.tenant.manage'],
};

// Unauthenticated context
export const UNAUTHENTICATED_CONTEXT = {
  name: 'unauthenticated',
  userId: null,
  tenantId: null,
  roleLevel: 0,
  roleName: null,
  permissions: [],
};

// ============================================================================
// JWT Generation (Mock)
// ============================================================================

interface MockJwtPayload {
  sub: string;
  email: string;
  role: string;
  app_metadata: {
    tenantId: string;
    roleLevel: number;
    permissions: string[];
    organizationalScope: string;
    locationId?: string;
    regionalId?: string;
    companyId?: string;
  };
  exp: number;
  iat: number;
}

export function generateMockJwt(context: TestUserContext): string {
  const payload: MockJwtPayload = {
    sub: context.userId,
    email: `${context.name}@test.printyx.net`,
    role: 'authenticated',
    app_metadata: {
      tenantId: context.tenantId,
      roleLevel: context.roleLevel,
      permissions: context.permissions,
      organizationalScope: context.organizationalScope,
      locationId: context.locationId,
      regionalId: context.regionalId,
      companyId: context.companyId,
    },
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iat: Math.floor(Date.now() / 1000),
  };

  // Create a mock JWT (base64 encoded for testing)
  // In real tests, you'd use a proper JWT library
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock-signature';

  return `${header}.${payloadStr}.${signature}`;
}

export function generateMockSession(context: TestUserContext): Record<string, unknown> {
  return {
    userId: context.userId,
    tenantId: context.tenantId,
    roleLevel: context.roleLevel,
    roleName: context.roleName,
    permissions: context.permissions,
    organizationalScope: context.organizationalScope,
    locationId: context.locationId,
    regionalId: context.regionalId,
    companyId: context.companyId,
    authenticated: true,
    sessionId: `session-${Date.now()}`,
  };
}

// ============================================================================
// Request Headers Generation
// ============================================================================

export function getAuthHeaders(context: TestUserContext | null): Record<string, string> {
  if (!context) {
    return {};
  }

  const token = generateMockJwt(context);

  return {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': context.tenantId,
    'Content-Type': 'application/json',
  };
}

export function getSessionHeaders(context: TestUserContext): Record<string, string> {
  return {
    'x-tenant-id': context.tenantId,
    'x-user-id': context.userId,
    'x-role-level': String(context.roleLevel),
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// Context Utilities
// ============================================================================

export function getContextByName(name: string): TestUserContext | undefined {
  return TEST_CONTEXTS.find((c) => c.name === name);
}

export function getContextsByRoleLevel(minLevel: number): TestUserContext[] {
  return TEST_CONTEXTS.filter((c) => c.roleLevel >= minLevel);
}

export function getContextsByPermission(permission: string): TestUserContext[] {
  return TEST_CONTEXTS.filter((c) =>
    c.permissions.some((p) => p === permission || p.includes(permission.split('.')[0])),
  );
}

export function shouldHaveAccess(
  context: TestUserContext,
  requiredRoleLevel: number,
  requiredPermissions?: string[],
): boolean {
  // Platform admin has full access
  if (context.roleLevel >= 8) return true;

  // Check role level
  if (context.roleLevel < requiredRoleLevel) return false;

  // Check permissions if specified
  if (requiredPermissions && requiredPermissions.length > 0) {
    return requiredPermissions.some(
      (perm) =>
        context.permissions.includes(perm) ||
        context.permissions.includes('platform.admin.full_access'),
    );
  }

  return true;
}

// ============================================================================
// Export
// ============================================================================

export default {
  TEST_CONTEXTS,
  CROSS_TENANT_CONTEXT,
  UNAUTHENTICATED_CONTEXT,
  generateMockJwt,
  generateMockSession,
  getAuthHeaders,
  getSessionHeaders,
  getContextByName,
  getContextsByRoleLevel,
  getContextsByPermission,
  shouldHaveAccess,
};
