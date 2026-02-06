/**
 * CRM Validation Schemas
 *
 * Shared Zod schemas for CRM route validation (contacts, companies, business records).
 * Used with the validate() middleware from enhanced-validation.ts.
 */

import { z } from 'zod';

// ─── Reusable Primitives ─────────────────────────────────────────────

const uuidParam = z.string().uuid().or(z.string().min(1).max(255));
const optionalString = z.string().optional().default('');
const sortOrder = z.enum(['asc', 'desc']).optional().default('desc');

// ─── Pagination Query Schema ─────────────────────────────────────────

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(500).optional().default(25),
    sortBy: z.string().max(100).optional().default('createdAt'),
    sortOrder,
  })
  .passthrough(); // Allow extra query params

// ─── Contact Schemas ─────────────────────────────────────────────────

export const contactQuerySchema = z
  .object({
    search: z.string().max(500).optional().default(''),
    ownerId: z.string().max(255).optional().default(''),
    contactOwner: z.string().max(255).optional().default(''),
    createDate: z
      .enum(['', 'today', 'yesterday', 'last7days', 'last30days'])
      .optional()
      .default(''),
    lastActivityDate: z
      .enum(['', 'today', 'yesterday', 'last7days', 'last30days', 'never'])
      .optional()
      .default(''),
    leadStatus: z.string().max(100).optional().default(''),
    status: z.string().max(100).optional().default(''),
    view: z.enum(['all', 'my', 'unassigned']).optional().default('all'),
    sortBy: z.string().max(100).optional().default('lastActivityDate'),
    sortOrder,
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(500).optional().default(25),
  })
  .passthrough();

export const contactCreateSchema = z
  .object({
    firstName: z.string().min(1).max(255),
    lastName: z.string().min(1).max(255),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(50).optional(),
    title: z.string().max(255).optional(),
    companyId: z.string().max(255).optional(),
    companyName: z.string().max(255).optional(),
    department: z.string().max(255).optional(),
    notes: z.string().max(10000).optional(),
    leadStatus: z.string().max(100).optional(),
    source: z.string().max(100).optional(),
    ownerId: z.string().max(255).optional(),
    isPrimary: z.boolean().optional(),
  })
  .passthrough();

export const contactUpdateSchema = contactCreateSchema.partial().passthrough();

// ─── Company Schemas ─────────────────────────────────────────────────

export const companyQuerySchema = z
  .object({
    search: z.string().max(500).optional().default(''),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(500).optional().default(25),
  })
  .passthrough();

export const companyCreateSchema = z
  .object({
    companyName: z.string().min(1).max(500),
    industry: z.string().max(255).optional(),
    website: z.string().max(500).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().max(500).optional(),
    city: z.string().max(255).optional(),
    state: z.string().max(100).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    employeeCount: z.coerce.number().int().nonnegative().optional(),
    annualRevenue: z.string().max(50).optional(),
    notes: z.string().max(10000).optional(),
  })
  .passthrough();

export const companyUpdateSchema = companyCreateSchema.partial().passthrough();

export const companyMergeSchema = z.object({
  survivorId: z.string().min(1),
  duplicateIds: z.array(z.string().min(1)).min(1),
});

export const companyDuplicateCheckSchema = z
  .object({
    businessName: z.string().min(1).max(500),
    billingCity: z.string().max(255).optional(),
    billingState: z.string().max(100).optional(),
  })
  .passthrough();

// ─── Business Record Schemas ─────────────────────────────────────────

export const businessRecordQuerySchema = z
  .object({
    search: z.string().max(500).optional().default(''),
    status: z.string().max(100).optional().default(''),
    type: z.string().max(100).optional().default(''),
    ownerId: z.string().max(255).optional().default(''),
    view: z.string().max(50).optional().default('all'),
    sortBy: z.string().max(100).optional().default('updatedAt'),
    sortOrder,
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(500).optional().default(25),
  })
  .passthrough();

// ─── ID Parameter Schema ─────────────────────────────────────────────

export const idParamSchema = z.object({
  id: z.string().min(1).max(255),
});

export const companyIdParamSchema = z.object({
  companyId: z.string().min(1).max(255),
});

export const contactIdParamSchema = z.object({
  contactId: z.string().min(1).max(255),
});

export const identifierParamSchema = z.object({
  identifier: z.string().min(1).max(255),
});
