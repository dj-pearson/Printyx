/**
 * Test Setup and Configuration
 * Global setup for Vitest unit and integration tests
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { config } from 'dotenv';

// Load environment variables
config();

// Set test environment
process.env.NODE_ENV = 'test';

// Prefer TEST_DATABASE_URL, but NEVER assign undefined into process.env — Node
// coerces that to the literal string "undefined", which is truthy and defeats every
// `if (!process.env.DATABASE_URL)` guard downstream (including the one below, and
// db.ts's own `?.startsWith('postgres')` check, which then falls through to the
// component branch and throws).
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else if (!process.env.DATABASE_URL) {
  delete process.env.DATABASE_URL;
}

// PROD-003: let PURE UNIT tests import modules that transitively reach server/db.ts.
//
// server/db.ts calls buildDatabaseUrl() at module scope, which THROWS when neither
// DATABASE_URL nor DB_HOST/DB_USER/DB_PASSWORD is set. The repo ships no .env (only
// .env.development and .env.example), so seven test files failed at COLLECTION and
// never ran a single assertion:
//
//   tenant-isolation, tenant-resolution-cr001, products-crud-rbac,
//   rbac-middleware-extended, sso-relaystate, pricing-input-validation,
//   voice-audio-host-allowlist
//
// Every one of those is a pure unit test — middleware with mocked req/res, a Zod
// schema, a path predicate, a host allowlist. None needs a database; they only need
// the import to succeed. CLAUDE.md calls the tenantId filter SECURITY CRITICAL, and
// the test proving that boundary holds was silently not running.
//
// A pg.Pool does not connect on construction (node-postgres connects lazily on first
// query), so a placeholder URL makes the import succeed while issuing ZERO
// connections. The host is deliberately unroutable rather than a plausible localhost
// Postgres: a test that genuinely queries must fail FAST and loudly instead of
// hanging, or silently reaching a developer's real database. Tests that truly need a
// live database should set TEST_DATABASE_URL, which always wins over this fallback.
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  process.env.DATABASE_URL =
    'postgresql://unit-test:unit-test@127.0.0.1:1/printyx_unit_test_no_db_expected';
}

// Global test setup
beforeAll(async () => {
  console.log('🧪 Test suite initializing...');
});

// Cleanup after each test
afterEach(() => {
  // Reset mocks
  vi.clearAllMocks();
});

// Global test teardown
afterAll(async () => {
  console.log('✅ Test suite complete');
});

// Increase timeout for database operations
export const DB_TIMEOUT = 10000;

// Mock user contexts for RBAC testing
export const mockUsers = {
  salesRep: {
    id: 'user-sales-rep-1',
    tenantId: 'tenant-test-1',
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
    tenantId: 'tenant-test-1',
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
  regionalDirector: {
    id: 'user-regional-director-1',
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
  vp: {
    id: 'user-vp-1',
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
  ceo: {
    id: 'user-ceo-1',
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
  platformAdmin: {
    id: 'user-platform-admin-1',
    tenantId: 'tenant-test-1',
    roleLevel: 8,
    roleName: 'Platform Administrator',
    organizationalScope: 'platform',
    locationId: null,
    regionalId: null,
    companyId: null,
    permissions: ['platform.admin.full_access', 'platform.tenant.manage', 'platform.report.view'],
  },
};

// Mock organizational units for hierarchical testing
export const mockOrganizationalUnits = {
  company: {
    id: 'company-1',
    tenantId: 'tenant-test-1',
    name: 'Test Company',
    type: 'company',
    lft: 1,
    rght: 20,
    depth: 0,
  },
  regional: {
    id: 'regional-1',
    tenantId: 'tenant-test-1',
    name: 'Northeast Region',
    type: 'regional',
    parentId: 'company-1',
    lft: 2,
    rght: 11,
    depth: 1,
  },
  location1: {
    id: 'location-1',
    tenantId: 'tenant-test-1',
    name: 'Boston Office',
    type: 'location',
    parentId: 'regional-1',
    lft: 3,
    rght: 6,
    depth: 2,
  },
  location2: {
    id: 'location-2',
    tenantId: 'tenant-test-1',
    name: 'New York Office',
    type: 'location',
    parentId: 'regional-1',
    lft: 7,
    rght: 10,
    depth: 2,
  },
  regional2: {
    id: 'regional-2',
    tenantId: 'tenant-test-1',
    name: 'Southeast Region',
    type: 'regional',
    parentId: 'company-1',
    lft: 12,
    rght: 19,
    depth: 1,
  },
  location3: {
    id: 'location-3',
    tenantId: 'tenant-test-1',
    name: 'Atlanta Office',
    type: 'location',
    parentId: 'regional-2',
    lft: 13,
    rght: 16,
    depth: 2,
  },
};

// Mock report execution data
export const mockReportData = {
  salesPipeline: [
    { stage: 'Discovery', count: 15, value: 125000 },
    { stage: 'Proposal', count: 8, value: 180000 },
    { stage: 'Negotiation', count: 5, value: 95000 },
    { stage: 'Closed Won', count: 3, value: 65000 },
  ],
  serviceMetrics: {
    totalCalls: 145,
    completedCalls: 132,
    pendingCalls: 13,
    averageResponseTime: 2.5,
    firstTimeFixRate: 0.87,
    customerSatisfaction: 4.6,
  },
};

// Helper function to create mock Express request
export const createMockRequest = (user: any, params = {}, query = {}, body = {}) => ({
  user,
  params,
  query,
  body,
  tenantId: user.tenantId,
  session: { userId: user.id },
  headers: {},
});

// Helper function to create mock Express response
export const createMockResponse = () => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};
