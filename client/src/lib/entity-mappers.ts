/**
 * Centralized Entity Mappers
 *
 * Transforms API responses from snake_case to camelCase consistently
 * across all entity types. This eliminates scattered transformations
 * throughout the codebase and provides a single source of truth.
 *
 * UX-006: Unify snake_case to camelCase data transformation
 */

/** Generic snake_case to camelCase converter */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Recursively transform all keys from snake_case to camelCase */
export function transformKeys<T = Record<string, unknown>>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeys(item)) as T;
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = transformKeys(value);
    }
    return result as T;
  }

  return obj as T;
}

/** Lead entity mapper */
export interface MappedLead {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  source: string;
  leadScore: number;
  assignedTo: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export function mapLead(raw: Record<string, unknown>): MappedLead {
  return transformKeys<MappedLead>(raw);
}

/** Customer entity mapper */
export interface MappedCustomer {
  id: string;
  companyName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  status: string;
  healthScore: number;
  accountType: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export function mapCustomer(raw: Record<string, unknown>): MappedCustomer {
  return transformKeys<MappedCustomer>(raw);
}

/** Contact entity mapper */
export interface MappedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  companyId: string;
  companyName: string;
  isPrimary: boolean;
  tenantId: string;
  createdAt: string;
}

export function mapContact(raw: Record<string, unknown>): MappedContact {
  return transformKeys<MappedContact>(raw);
}

/** Quote entity mapper */
export interface MappedQuote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  status: string;
  totalAmount: number;
  expiresAt: string;
  version: number;
  createdBy: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export function mapQuote(raw: Record<string, unknown>): MappedQuote {
  return transformKeys<MappedQuote>(raw);
}

/** Invoice entity mapper */
export interface MappedInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  status: string;
  totalAmount: number;
  amountDue: number;
  dueDate: string;
  paidAt: string;
  tenantId: string;
  createdAt: string;
}

export function mapInvoice(raw: Record<string, unknown>): MappedInvoice {
  return transformKeys<MappedInvoice>(raw);
}

/** Order entity mapper */
export interface MappedOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: string;
  totalAmount: number;
  fulfillmentStatus: string;
  shippedAt: string;
  deliveredAt: string;
  tenantId: string;
  createdAt: string;
}

export function mapOrder(raw: Record<string, unknown>): MappedOrder {
  return transformKeys<MappedOrder>(raw);
}

/** Equipment entity mapper */
export interface MappedEquipment {
  id: string;
  equipmentName: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  status: string;
  customerId: string;
  installedAt: string;
  lastServiceDate: string;
  tenantId: string;
}

export function mapEquipment(raw: Record<string, unknown>): MappedEquipment {
  return transformKeys<MappedEquipment>(raw);
}

/** Map a list of entities */
export function mapList<T>(
  items: Record<string, unknown>[],
  mapper: (item: Record<string, unknown>) => T,
): T[] {
  return items.map(mapper);
}
