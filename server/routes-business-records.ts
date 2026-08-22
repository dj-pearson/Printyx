/**
 * Business Records API Routes
 *
 * Unified Lead → Prospect → Customer management with HubSpot-like simplicity
 * Zero-data-loss pattern: All records stay in business_records table
 * Status transitions are instant and preserve full history
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { businessRecords, businessRecordActivities } from '../shared/schema';
import { eq, and, or, like, desc, asc, sql, inArray } from 'drizzle-orm';
import { getUserId, getTenantId, isAuthenticated } from './utils/auth-helpers';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { z } from 'zod';
import { validate } from './middleware/enhanced-validation';
import {
  businessRecordQuerySchema,
  idParamSchema,
  identifierParamSchema,
} from './lib/crm-validation';
import { createModuleLogger } from './lib/logger';
import { validateCustomFieldValues } from './lib/custom-field-validation';
const log = createModuleLogger('routes-business-records');

const router = Router();

// Validation schemas
const businessRecordSchema = z.object({
  // Record type and status
  recordType: z.enum(['lead', 'prospect', 'customer', 'former_customer']).default('lead'),
  status: z.string().default('new'),

  // Company information
  companyName: z.string().min(1, 'Company name is required'),
  accountType: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  employeeCount: z.number().optional(),
  annualRevenue: z.number().optional(),

  // Primary contact
  primaryContactName: z.string().min(1, 'Primary contact name is required'),
  primaryContactEmail: z.string().email('Invalid email').optional(),
  primaryContactPhone: z.string().optional(),
  primaryContactTitle: z.string().optional(),

  // Address
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),

  // Lead/Sales information
  leadSource: z.string().default('website'),
  estimatedAmount: z.number().optional(),
  probability: z.number().min(0).max(100).default(50),
  salesStage: z.string().optional(),
  interestLevel: z.string().optional(),

  // Assignment
  ownerId: z.string().optional(),
  assignedSalesRep: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),

  // Customer-specific
  customerTier: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.number().optional(),

  // Notes and tags
  notes: z.string().optional(),
  tags: z.string().optional(),

  // External integration
  externalSystemId: z.string().optional(),
  externalCustomerId: z.string().optional(),
  externalData: z.record(z.any()).optional(),
});

const statusUpdateSchema = z.object({
  status: z.string().min(1, 'Status is required'),
  recordType: z.enum(['lead', 'prospect', 'customer', 'former_customer']).optional(),
  notes: z.string().optional(),
});

/**
 * Get all business records with flexible filtering
 * Supports Lead, Prospect, Customer, and Former Customer views
 */
// ── /api/business-records: PARTLY RETIRED (PROD-008b) ───────────────────────
//
// Six handlers lived here and are gone - GET list, GET /:identifier, POST,
// PATCH /:id, PATCH /:id/status and DELETE /:id. /api/business-records is in
// crmProxies and the proxy registers before this file, so none of them ran in
// dev; production never reaches Express at all. The business-records edge
// function covers all six.
//
// The PATCH and POST also held the record.updated and record.created workflow
// dispatches, which is why this file outlived the rest of its cluster: deleting
// them earlier would have removed the trigger seam rather than a duplicate.
// CRMX-008a ported both into the edge function first.
//
// STILL HERE, and deliberately: POST /api/business-records/bulk/status has NO
// edge counterpart, and it is real tenant-scoped logic — a bulk status update
// plus a businessRecordActivities row per record. No frontend caller today, so it
// is RETAINED in docs/shadowed-express-baseline.json with a reason rather than
// deleted. GET /stats/overview, which this note also used to claim had no
// counterpart, in fact does; it has been removed. /api/customers below is not
// proxied and still runs.

/**
 * Get single business record by ID or slug
 */

/**
 * Create new business record (Lead, Prospect, or Customer)
 */

/**
 * Update business record
 */

/**
 * Quick status update with automatic record type transition
 * This is the HubSpot-like instant status change feature
 */

/**
 * Bulk status update
 */
router.post(
  '/api/business-records/bulk/status',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);

      if (!tenantId || !userId) {
        return res.status(400).json({ message: 'Tenant ID and User ID are required' });
      }

      const { ids, status, recordType, notes } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'IDs array is required' });
      }

      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }

      // Update all records
      const updated = await db
        .update(businessRecords)
        .set({
          status,
          ...(recordType && { recordType }),
          updatedAt: new Date(),
        })
        .where(and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, ids)))
        .returning();

      // Log activities
      await Promise.all(
        updated.map((record) =>
          db.insert(businessRecordActivities).values({
            businessRecordId: record.id,
            tenantId,
            activityType: 'status_changed',
            subject: 'Bulk status update',
            description: `Bulk status update to "${status}"${notes ? `: ${notes}` : ''}`,
            createdBy: userId,
          }),
        ),
      );

      res.json({
        message: `Updated ${updated.length} records`,
        records: updated,
      });
    } catch (error) {
      log.error('Error bulk updating status:', error);
      res.status(500).json({ message: 'Failed to bulk update status' });
    }
  },
);

/**
 * Delete business record (soft delete by marking as inactive)
 */

/**
 * Get statistics for dashboard
 */
// GET /api/business-records/stats/overview was removed here (PROD-008b). The
// note above used to say it had no edge counterpart; that was wrong. The
// business-records edge function handles it at index.ts:129, and its own comment
// names both paths: "GET /business-records/stats or /business-records/stats/overview".
//
// One difference worth knowing rather than fixing here: the edge version counts
// rows in `companies`, this one counted `business_records`. Which of those is
// canonical is the whole of COP-B00 and is not this story's to settle.

// Backward compatibility routes - GET all customers with pagination
router.get(
  '/api/customers',
  requireAuth,
  validate({ query: businessRecordQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const {
        search,
        status,
        priority,
        industry,
        leadSource,
        customerTier,
        limit = '100', // Default to 100 to prevent loading all 15k records
        offset = '0',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build WHERE conditions - filter for customers only
      const conditions: any[] = [
        eq(businessRecords.tenantId, tenantId),
        eq(businessRecords.recordType, 'customer'),
      ];

      if (status) {
        conditions.push(eq(businessRecords.status, status as string));
      }

      if (priority) {
        conditions.push(eq(businessRecords.priority, priority as string));
      }

      if (industry) {
        conditions.push(eq(businessRecords.industry, industry as string));
      }

      if (leadSource) {
        conditions.push(eq(businessRecords.leadSource, leadSource as string));
      }

      if (customerTier) {
        conditions.push(eq(businessRecords.customerTier, customerTier as string));
      }

      // Search across multiple fields
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(
          or(
            like(businessRecords.companyName, searchTerm),
            like(businessRecords.primaryContactName, searchTerm),
            like(businessRecords.primaryContactEmail, searchTerm),
            like(businessRecords.phone, searchTerm),
            like(businessRecords.city, searchTerm),
            like(businessRecords.industry, searchTerm),
          ),
        );
      }

      // Execute query with pagination
      const sortColumn =
        businessRecords[sortBy as keyof typeof businessRecords] || businessRecords.createdAt;
      const orderFn = sortOrder === 'asc' ? asc : desc;

      // CR-029: the page query and the total-count query hit the same filtered
      // scan; run them CONCURRENTLY instead of back-to-back so the request waits
      // on one round-trip, not two.
      const [records, [{ count }]] = await Promise.all([
        db
          .select()
          .from(businessRecords)
          .where(and(...conditions))
          .orderBy(orderFn(sortColumn))
          .limit(parseInt(limit as string))
          .offset(parseInt(offset as string)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(businessRecords)
          .where(and(...conditions)),
      ]);

      res.json({
        records,
        pagination: {
          total: count,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + records.length < count,
        },
      });
    } catch (error) {
      log.error('Error fetching customers:', error);
      res.status(500).json({ message: 'Failed to fetch customers' });
    }
  },
);

// GET single customer by ID or slug
router.get(
  '/api/customers/:identifier',
  requireAuth,
  validate({ params: identifierParamSchema }),
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const { identifier } = req.params;

      // Try to find by ID, URL slug, or display ID
      const [record] = await db
        .select()
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.recordType, 'customer'), // Only return customer records
            or(
              eq(businessRecords.id, identifier),
              eq(businessRecords.urlSlug, identifier),
              eq(businessRecords.companyDisplayId, identifier),
            ),
          ),
        )
        .limit(1);

      if (!record) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Get recent activities
      const activities = await db
        .select()
        .from(businessRecordActivities)
        .where(eq(businessRecordActivities.businessRecordId, record.id))
        .orderBy(desc(businessRecordActivities.createdAt))
        .limit(20);

      res.json({
        ...record,
        activities,
      });
    } catch (error) {
      log.error('Error fetching customer:', error);
      res.status(500).json({ message: 'Failed to fetch customer' });
    }
  },
);

router.post('/api/customers', requireAuth, async (req: Request, res: Response) => {
  req.body.recordType = 'customer';
  req.body.status = req.body.status || 'active';
  return router.handle(req, res, () => {});
});

// Registration function for use in main routes file
export function registerBusinessRecordRoutes(app: any) {
  app.use(router);
}

export default router;
