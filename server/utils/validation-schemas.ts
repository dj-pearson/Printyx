/**
 * Common Validation Schemas
 *
 * Reusable Zod schemas for query parameters and common patterns
 * SECURITY: Validates and sanitizes all user input
 */

import { z } from 'zod';

/**
 * Common query parameter schemas
 */

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
});

// Search schema
export const searchSchema = z.object({
  search: z.string().max(200).optional(),
  q: z.string().max(200).optional(), // Alternative search param
});

// Sort schema
export const sortSchema = z.object({
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  orderBy: z.string().max(50).optional(), // Alternative
});

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  endDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  fromDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  toDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
});

// Filter schema
export const filterSchema = z.object({
  status: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  tags: z.string().max(500).optional(), // Comma-separated
});

// ID schema
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// Combined common query schema
export const commonQuerySchema = paginationSchema
  .merge(searchSchema)
  .merge(sortSchema)
  .merge(dateRangeSchema)
  .merge(filterSchema);

/**
 * Business-specific schemas
 */

// Business record query schema
export const businessRecordQuerySchema = z.object({
  recordType: z.enum(['lead', 'customer', 'all']).default('all'),
  status: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).optional(),
  assignedTo: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

// Deal query schema
export const dealQuerySchema = z.object({
  status: z.enum(['open', 'won', 'lost', 'all']).default('all'),
  stage: z.string().max(50).optional(),
  assignedTo: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  ...paginationSchema.shape,
});

// User query schema
export const userQuerySchema = z.object({
  role: z.string().max(50).optional(),
  team: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  search: z.string().max(100).optional(),
  ...paginationSchema.shape,
});

/**
 * Sanitization helpers
 */

// Sanitize string for SQL LIKE queries
export function sanitizeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

// Sanitize array of strings
export function sanitizeStringArray(input: string, separator: string = ','): string[] {
  return input
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 100); // Max 100 items
}

// Convert string to safe integer
export function toSafeInt(input: any, defaultValue: number = 0): number {
  const parsed = parseInt(input, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Convert string to safe boolean
export function toSafeBoolean(input: any): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    return input.toLowerCase() === 'true' || input === '1';
  }
  return false;
}

/**
 * Customer Portal Schemas
 */

// Customer portal ticket schema
export const customerTicketSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(10000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.string().max(50).optional(),
  equipmentId: z.string().uuid().optional(),
  attachments: z.array(z.string().url()).max(10).optional(),
});

// Customer portal profile update schema
export const customerProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  notificationPreferences: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
});

// Service request schema
export const serviceRequestSchema = z.object({
  equipmentId: z.string().uuid('Invalid equipment ID'),
  issueType: z.enum(['repair', 'maintenance', 'supply', 'installation', 'other']),
  description: z.string().min(10).max(5000),
  urgency: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  preferredDate: z.string().datetime().optional(),
  preferredTimeSlot: z.enum(['morning', 'afternoon', 'evening', 'any']).optional(),
  contactPhone: z.string().max(20).optional(),
  contactEmail: z.string().email().optional(),
});

/**
 * Integration Schemas
 */

// Webhook payload schema
export const webhookPayloadSchema = z.object({
  event: z.string().min(1).max(100),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
  signature: z.string().optional(),
});

// API key creation schema
export const apiKeySchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  permissions: z.array(z.string()).min(1, 'At least one permission required'),
  expiresAt: z.string().datetime().optional(),
  rateLimit: z.number().int().min(1).max(100000).optional(),
  allowedIps: z.array(z.string().ip()).max(20).optional(),
});

/**
 * Reporting Schemas
 */

// Report generation schema
export const reportSchema = z.object({
  reportType: z.string().min(1).max(50),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  filters: z.record(z.unknown()).optional(),
  format: z.enum(['pdf', 'csv', 'xlsx', 'json']).default('pdf'),
  includeCharts: z.boolean().default(true),
});

/**
 * Security Schemas
 */

// Password change schema
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// MFA setup schema
export const mfaSetupSchema = z.object({
  method: z.enum(['totp', 'sms', 'email']),
  phoneNumber: z.string().max(20).optional(),
  backupEmail: z.string().email().optional(),
});

// MFA verification schema
export const mfaVerifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
  rememberDevice: z.boolean().default(false),
});

/**
 * Validation middleware factory
 * Usage:
 *   app.get('/api/users', validate({ query: userQuerySchema }), handler)
 */
export function validate(schemas: {
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  body?: z.ZodSchema;
}) {
  return (req: any, res: any, next: any) => {
    try {
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}
