/**
 * Database Test Helpers
 * Seed data factories for key entities.
 * These produce plain objects matching Drizzle schema shapes for use in unit tests
 * with mocked database calls. They do NOT connect to a real database.
 */

import { TEST_TENANT_ID, TEST_USER_ID } from './test-utils';

// ─── ID Generator ────────────────────────────────────────────────────

let idCounter = 0;

/**
 * Generate a unique test ID. Resets between test suites via resetFactories().
 */
export function testId(prefix = 'test'): string {
  idCounter++;
  return `${prefix}-${idCounter.toString().padStart(4, '0')}`;
}

/**
 * Reset the ID counter. Call in beforeEach/afterEach to ensure deterministic IDs.
 */
export function resetFactories(): void {
  idCounter = 0;
}

// ─── Entity Factories ────────────────────────────────────────────────

export interface FactoryTenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function buildTenant(overrides: Partial<FactoryTenant> = {}): FactoryTenant {
  const id = overrides.id || testId('tenant');
  return {
    id,
    name: `Test Tenant ${id}`,
    slug: `test-tenant-${id}`,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface FactoryUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function buildUser(overrides: Partial<FactoryUser> = {}): FactoryUser {
  const id = overrides.id || testId('user');
  return {
    id,
    tenantId: TEST_TENANT_ID,
    email: `${id}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'sales_rep',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface FactoryBusinessRecord {
  id: string;
  tenantId: string;
  companyName: string;
  status: string;
  type: string;
  ownerId: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Build a lead (business record with status='lead').
 */
export function buildLead(overrides: Partial<FactoryBusinessRecord> = {}): FactoryBusinessRecord {
  const id = overrides.id || testId('lead');
  return {
    id,
    tenantId: TEST_TENANT_ID,
    companyName: `Lead Company ${id}`,
    status: 'lead',
    type: 'prospect',
    ownerId: TEST_USER_ID,
    email: `lead-${id}@example.com`,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Build a customer (business record with status='customer').
 */
export function buildCustomer(
  overrides: Partial<FactoryBusinessRecord> = {},
): FactoryBusinessRecord {
  const id = overrides.id || testId('customer');
  return {
    id,
    tenantId: TEST_TENANT_ID,
    companyName: `Customer Company ${id}`,
    status: 'customer',
    type: 'active',
    ownerId: TEST_USER_ID,
    email: `customer-${id}@example.com`,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface FactoryQuote {
  id: string;
  tenantId: string;
  businessRecordId: string;
  title: string;
  status: string;
  totalAmount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function buildQuote(overrides: Partial<FactoryQuote> = {}): FactoryQuote {
  const id = overrides.id || testId('quote');
  return {
    id,
    tenantId: TEST_TENANT_ID,
    businessRecordId: overrides.businessRecordId || testId('biz'),
    title: `Quote ${id}`,
    status: 'draft',
    totalAmount: 5000,
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface FactoryOrder {
  id: string;
  tenantId: string;
  businessRecordId: string;
  quoteId: string | null;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function buildOrder(overrides: Partial<FactoryOrder> = {}): FactoryOrder {
  const id = overrides.id || testId('order');
  return {
    id,
    tenantId: TEST_TENANT_ID,
    businessRecordId: overrides.businessRecordId || testId('biz'),
    quoteId: null,
    orderNumber: `ORD-${id}`,
    status: 'pending',
    totalAmount: 5000,
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface FactoryInvoice {
  id: string;
  tenantId: string;
  businessRecordId: string;
  orderId: string | null;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  dueDate: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function buildInvoice(overrides: Partial<FactoryInvoice> = {}): FactoryInvoice {
  const id = overrides.id || testId('invoice');
  return {
    id,
    tenantId: TEST_TENANT_ID,
    businessRecordId: overrides.businessRecordId || testId('biz'),
    orderId: null,
    invoiceNumber: `INV-${id}`,
    status: 'draft',
    totalAmount: 5000,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Batch Builders ──────────────────────────────────────────────────

/**
 * Build an array of entities using a factory function.
 */
export function buildMany<T>(
  factory: (overrides?: Partial<T>) => T,
  count: number,
  overrides?: Partial<T>,
): T[] {
  return Array.from({ length: count }, () => factory(overrides));
}
