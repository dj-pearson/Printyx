/**
 * Enhanced Validation Middleware
 *
 * Comprehensive Zod-based validation for all API endpoints.
 * Provides reusable schemas, sanitization, and security-focused validation.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, ZodIssue } from 'zod';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('enhanced-validation');

// ============================================================================
// Common Schema Building Blocks
// ============================================================================

/**
 * UUID validation with custom error message
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Email validation with normalization
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email too long')
  .transform((val) => val.toLowerCase().trim());

/**
 * Phone number validation (E.164 format)
 */
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional();

/**
 * URL validation
 */
export const urlSchema = z.string().url('Invalid URL format').max(2048, 'URL too long').optional();

/**
 * Safe string - prevents XSS and injection
 */
export const safeStringSchema = (maxLength: number = 1000) =>
  z
    .string()
    .max(maxLength, `String must be less than ${maxLength} characters`)
    .transform((val) => sanitizeString(val));

/**
 * Positive integer
 */
export const positiveIntSchema = z.coerce
  .number()
  .int('Must be an integer')
  .positive('Must be a positive number');

/**
 * Non-negative integer
 */
export const nonNegativeIntSchema = z.coerce
  .number()
  .int('Must be an integer')
  .min(0, 'Cannot be negative');

/**
 * Money amount (cents)
 */
export const moneySchema = z.coerce
  .number()
  .int('Money must be in cents')
  .min(0, 'Amount cannot be negative')
  .max(999999999999, 'Amount too large'); // Max ~$10B

/**
 * Date string (ISO 8601 or YYYY-MM-DD)
 */
export const dateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format')
  .transform((val) => new Date(val).toISOString());

/**
 * Date range validation
 */
// Plain object form - required for .merge()/.shape composition (a .refine()d
// schema is a ZodEffects, which cannot be merged and crashes at module load)
export const dateRangeFieldsSchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

export const dateRangeSchema = dateRangeFieldsSchema.refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before end date' },
);

// ============================================================================
// Pagination & Query Schemas
// ============================================================================

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
});

/**
 * Search parameters
 */
export const searchSchema = z.object({
  search: safeStringSchema(200).optional(),
  q: safeStringSchema(200).optional(),
});

/**
 * Sort parameters
 */
export const sortSchema = z.object({
  sortBy: z
    .string()
    .max(50)
    .regex(/^[a-zA-Z_]+$/, 'Invalid sort field')
    .optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  orderBy: z.string().max(50).optional(),
});

/**
 * Combined list query schema
 */
export const listQuerySchema = paginationSchema
  .merge(searchSchema)
  .merge(sortSchema)
  .merge(dateRangeFieldsSchema);

// ============================================================================
// Entity-Specific Schemas
// ============================================================================

/**
 * Business record (customer/lead) schemas
 */
export const businessRecordSchemas = {
  query: z.object({
    recordType: z.enum(['lead', 'customer', 'all']).default('all'),
    status: z.string().max(50).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    assignedTo: uuidSchema.optional(),
    ...listQuerySchema.shape,
  }),

  create: z.object({
    companyName: safeStringSchema(255),
    firstName: safeStringSchema(100).optional(),
    lastName: safeStringSchema(100).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema,
    website: urlSchema,
    address: safeStringSchema(500).optional(),
    city: safeStringSchema(100).optional(),
    state: safeStringSchema(50).optional(),
    zip: safeStringSchema(20).optional(),
    country: safeStringSchema(100).default('US'),
    recordType: z.enum(['lead', 'customer']).default('lead'),
    status: z.string().max(50).default('new'),
    source: z.string().max(100).optional(),
    notes: safeStringSchema(10000).optional(),
    assignedTo: uuidSchema.optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    customFields: z.record(z.unknown()).optional(),
  }),

  update: z.object({
    companyName: safeStringSchema(255).optional(),
    firstName: safeStringSchema(100).optional(),
    lastName: safeStringSchema(100).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema,
    website: urlSchema,
    address: safeStringSchema(500).optional(),
    city: safeStringSchema(100).optional(),
    state: safeStringSchema(50).optional(),
    zip: safeStringSchema(20).optional(),
    country: safeStringSchema(100).optional(),
    status: z.string().max(50).optional(),
    notes: safeStringSchema(10000).optional(),
    assignedTo: uuidSchema.nullable().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    customFields: z.record(z.unknown()).optional(),
  }),
};

/**
 * Deal/opportunity schemas
 */
export const dealSchemas = {
  query: z.object({
    status: z.enum(['open', 'won', 'lost', 'all']).default('all'),
    stage: z.string().max(50).optional(),
    assignedTo: uuidSchema.optional(),
    customerId: uuidSchema.optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    ...listQuerySchema.shape,
  }),

  create: z.object({
    name: safeStringSchema(255),
    customerId: uuidSchema,
    amount: moneySchema.optional(),
    stage: z.string().max(50).default('discovery'),
    probability: z.coerce.number().min(0).max(100).default(0),
    expectedCloseDate: dateStringSchema.optional(),
    assignedTo: uuidSchema.optional(),
    description: safeStringSchema(5000).optional(),
    products: z
      .array(
        z.object({
          productId: uuidSchema,
          quantity: positiveIntSchema,
          price: moneySchema,
        }),
      )
      .optional(),
  }),

  update: z.object({
    name: safeStringSchema(255).optional(),
    amount: moneySchema.optional(),
    stage: z.string().max(50).optional(),
    probability: z.coerce.number().min(0).max(100).optional(),
    expectedCloseDate: dateStringSchema.optional(),
    assignedTo: uuidSchema.nullable().optional(),
    description: safeStringSchema(5000).optional(),
    status: z.enum(['open', 'won', 'lost']).optional(),
    closedReason: safeStringSchema(500).optional(),
  }),
};

/**
 * User management schemas
 */
export const userSchemas = {
  query: z.object({
    role: z.string().max(50).optional(),
    team: uuidSchema.optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
    ...listQuerySchema.shape,
  }),

  create: z.object({
    email: emailSchema,
    firstName: safeStringSchema(100),
    lastName: safeStringSchema(100),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .max(128, 'Password too long')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/[a-z]/, 'Password must contain lowercase letter')
      .regex(/[0-9]/, 'Password must contain number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
    role: z.string().max(50).optional(),
    phone: phoneSchema,
    profileImageUrl: urlSchema,
  }),

  update: z.object({
    firstName: safeStringSchema(100).optional(),
    lastName: safeStringSchema(100).optional(),
    phone: phoneSchema,
    profileImageUrl: urlSchema,
    role: z.string().max(50).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  }),
};

/**
 * Service ticket schemas
 */
export const serviceTicketSchemas = {
  query: z.object({
    status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed', 'all']).default('all'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assignedTo: uuidSchema.optional(),
    customerId: uuidSchema.optional(),
    equipmentId: uuidSchema.optional(),
    ...listQuerySchema.shape,
  }),

  create: z.object({
    customerId: uuidSchema,
    equipmentId: uuidSchema.optional(),
    subject: safeStringSchema(255),
    description: safeStringSchema(10000),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    category: z.string().max(50).optional(),
    assignedTo: uuidSchema.optional(),
    scheduledDate: dateStringSchema.optional(),
  }),

  update: z.object({
    subject: safeStringSchema(255).optional(),
    description: safeStringSchema(10000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']).optional(),
    assignedTo: uuidSchema.nullable().optional(),
    resolution: safeStringSchema(5000).optional(),
    scheduledDate: dateStringSchema.optional(),
  }),
};

// ============================================================================
// Security-Related Schemas
// ============================================================================

/**
 * MFA verification schema
 */
export const mfaVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
  method: z.enum(['totp', 'sms', 'email', 'backup_code']).optional(),
});

/**
 * IP whitelist entry schema
 */
export const ipWhitelistEntrySchema = z.string().refine((val) => {
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(val)) return true;
  // CIDR
  if (/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(val)) return true;
  // IP Range
  if (/^(\d{1,3}\.){3}\d{1,3}-(\d{1,3}\.){3}\d{1,3}$/.test(val)) return true;
  // localhost
  if (val === 'localhost') return true;
  return false;
}, 'Invalid IP address, CIDR, or range');

/**
 * API key creation schema
 */
export const apiKeyCreateSchema = z.object({
  name: safeStringSchema(100),
  scopes: z.array(z.string().max(50)).max(50).optional(),
  permissions: z.array(z.string().max(100)).max(100).optional(),
  expiresAt: dateStringSchema.optional(),
  allowedIps: z.array(ipWhitelistEntrySchema).max(100).optional(),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(10000).optional(),
  rateLimitPerHour: z.coerce.number().int().min(1).max(100000).optional(),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sanitize string to prevent XSS
 */
function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Format Zod errors for API response
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string; code: string }> {
  return error.errors.map((issue: ZodIssue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
    code: issue.code,
  }));
}

// ============================================================================
// Validation Middleware Factory
// ============================================================================

export interface ValidationOptions {
  stripUnknown?: boolean;
  coerceTypes?: boolean;
  customErrorHandler?: (error: ZodError, req: Request, res: Response) => void;
}

/**
 * Create validation middleware
 *
 * Usage:
 *   app.post('/api/users', validate({
 *     body: userSchemas.create,
 *     query: paginationSchema,
 *     params: z.object({ id: uuidSchema }),
 *   }), handler);
 */
export function validate(
  schemas: {
    query?: ZodSchema;
    params?: ZodSchema;
    body?: ZodSchema;
  },
  options: ValidationOptions = {},
) {
  const { stripUnknown = true, customErrorHandler } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate query parameters
      if (schemas.query) {
        const result = await schemas.query.safeParseAsync(req.query);
        if (!result.success) {
          return handleValidationError(result.error, 'query', res, customErrorHandler);
        }
        req.query = result.data;
      }

      // Validate URL parameters
      if (schemas.params) {
        const result = await schemas.params.safeParseAsync(req.params);
        if (!result.success) {
          return handleValidationError(result.error, 'params', res, customErrorHandler);
        }
        req.params = result.data;
      }

      // Validate request body
      if (schemas.body) {
        const result = await schemas.body.safeParseAsync(req.body);
        if (!result.success) {
          return handleValidationError(result.error, 'body', res, customErrorHandler);
        }
        req.body = result.data;
      }

      next();
    } catch (error) {
      log.error('Validation middleware error:', error);
      next(error);
    }
  };
}

/**
 * Handle validation error
 */
function handleValidationError(
  error: ZodError,
  location: string,
  res: Response,
  customHandler?: (error: ZodError, req: Request, res: Response) => void,
) {
  const formattedErrors = formatZodErrors(error);

  return res.status(400).json({
    message: 'Validation error',
    code: 'VALIDATION_ERROR',
    location,
    details: error.flatten(),
  });
}

/**
 * Validate and transform request data
 */
export async function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown,
): Promise<
  { success: true; data: T } | { success: false; errors: ReturnType<typeof formatZodErrors> }
> {
  const result = await schema.safeParseAsync(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Schema registry for dynamic validation
 */
export const schemaRegistry = {
  businessRecords: businessRecordSchemas,
  deals: dealSchemas,
  users: userSchemas,
  serviceTickets: serviceTicketSchemas,
  common: {
    pagination: paginationSchema,
    search: searchSchema,
    sort: sortSchema,
    listQuery: listQuerySchema,
    dateRange: dateRangeSchema,
    uuid: uuidSchema,
    email: emailSchema,
  },
  security: {
    mfaVerify: mfaVerifySchema,
    ipWhitelist: ipWhitelistEntrySchema,
    apiKeyCreate: apiKeyCreateSchema,
  },
};

export default {
  validate,
  validateData,
  formatZodErrors,
  schemaRegistry,
  // Export individual schemas for direct use
  uuidSchema,
  emailSchema,
  phoneSchema,
  urlSchema,
  safeStringSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  moneySchema,
  dateStringSchema,
  dateRangeSchema,
  paginationSchema,
  searchSchema,
  sortSchema,
  listQuerySchema,
  businessRecordSchemas,
  dealSchemas,
  userSchemas,
  serviceTicketSchemas,
  mfaVerifySchema,
  ipWhitelistEntrySchema,
  apiKeyCreateSchema,
};
