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
router.get('/api/business-records', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const {
      recordType,
      status,
      search,
      ownerId,
      priority,
      industry,
      leadSource,
      customerTier,
      limit = '100',
      offset = '0',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build WHERE conditions
    const conditions: any[] = [eq(businessRecords.tenantId, tenantId)];

    if (recordType) {
      conditions.push(eq(businessRecords.recordType, recordType as string));
    }

    if (status) {
      conditions.push(eq(businessRecords.status, status as string));
    }

    if (ownerId) {
      conditions.push(eq(businessRecords.ownerId, ownerId as string));
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

    const records = await db
      .select()
      .from(businessRecords)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessRecords)
      .where(and(...conditions));

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
    console.error('Error fetching business records:', error);
    res.status(500).json({ message: 'Failed to fetch business records' });
  }
});

/**
 * Get single business record by ID or slug
 */
router.get(
  '/api/business-records/:identifier',
  requireAuth,
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
            or(
              eq(businessRecords.id, identifier),
              eq(businessRecords.urlSlug, identifier),
              eq(businessRecords.companyDisplayId, identifier),
            ),
          ),
        )
        .limit(1);

      if (!record) {
        return res.status(404).json({ message: 'Record not found' });
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
      console.error('Error fetching business record:', error);
      res.status(500).json({ message: 'Failed to fetch business record' });
    }
  },
);

/**
 * Create new business record (Lead, Prospect, or Customer)
 */
router.post('/api/business-records', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    if (!tenantId || !userId) {
      return res.status(400).json({ message: 'Tenant ID and User ID are required' });
    }

    const validation = businessRecordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.error.errors,
      });
    }

    const data = validation.data;

    // Generate unique identifiers
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 100000000);
    const companyDisplayId = `${randomNum}`;
    const companyNameSlug = data.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const urlSlug = `${companyNameSlug}-${companyDisplayId}`;

    // Set customer number if creating a customer directly
    const customerNumber =
      data.recordType === 'customer' ? `CUST-${timestamp}-${randomNum}` : undefined;

    const customerSince = data.recordType === 'customer' ? new Date() : undefined;

    const [newRecord] = await db
      .insert(businessRecords)
      .values({
        ...data,
        tenantId,
        createdBy: userId,
        ownerId: data.ownerId || userId,
        companyDisplayId,
        urlSlug,
        customerNumber,
        customerSince,
      })
      .returning();

    // Log activity
    await db.insert(businessRecordActivities).values({
      businessRecordId: newRecord.id,
      tenantId,
      activityType: 'record_created',
      description: `${data.recordType} created: ${data.companyName}`,
      createdBy: userId,
    });

    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error creating business record:', error);
    res.status(500).json({ message: 'Failed to create business record' });
  }
});

/**
 * Update business record
 */
router.patch('/api/business-records/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    if (!tenantId || !userId) {
      return res.status(400).json({ message: 'Tenant ID and User ID are required' });
    }

    const { id } = req.params;

    // Verify record exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(businessRecords)
      .where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const validation = businessRecordSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.error.errors,
      });
    }

    const updateData = {
      ...validation.data,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(businessRecords)
      .set(updateData)
      .where(eq(businessRecords.id, id))
      .returning();

    // Log activity
    await db.insert(businessRecordActivities).values({
      businessRecordId: id,
      tenantId,
      activityType: 'record_updated',
      description: `Record updated`,
      createdBy: userId,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating business record:', error);
    res.status(500).json({ message: 'Failed to update business record' });
  }
});

/**
 * Quick status update with automatic record type transition
 * This is the HubSpot-like instant status change feature
 */
router.patch(
  '/api/business-records/:id/status',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);

      if (!tenantId || !userId) {
        return res.status(400).json({ message: 'Tenant ID and User ID are required' });
      }

      const { id } = req.params;
      const validation = statusUpdateSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: validation.error.errors,
        });
      }

      const { status, recordType, notes } = validation.data;

      // Verify record exists
      const [existing] = await db
        .select()
        .from(businessRecords)
        .where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: 'Record not found' });
      }

      // Determine record type based on status if not explicitly provided
      let finalRecordType = recordType || existing.recordType;
      let additionalFields: any = {};

      // Auto-transition logic
      if (status === 'qualified' || status === 'proposal_sent') {
        finalRecordType = 'prospect';
      } else if (status === 'active' || status === 'closed_won') {
        finalRecordType = 'customer';
        if (!existing.customerNumber) {
          const timestamp = Date.now();
          const randomNum = Math.floor(Math.random() * 100000000);
          additionalFields.customerNumber = `CUST-${timestamp}-${randomNum}`;
          additionalFields.customerSince = new Date();
          additionalFields.convertedBy = userId;
        }
      } else if (status === 'churned' || status === 'inactive') {
        if (existing.recordType === 'customer') {
          finalRecordType = 'former_customer';
          additionalFields.customerUntil = new Date();
          additionalFields.deactivatedBy = userId;
        }
      }

      const [updated] = await db
        .update(businessRecords)
        .set({
          status,
          recordType: finalRecordType,
          ...additionalFields,
          updatedAt: new Date(),
        })
        .where(eq(businessRecords.id, id))
        .returning();

      // Log activity with detailed information
      const statusChangeDescription = `Status changed from "${existing.status}" to "${status}"${
        finalRecordType !== existing.recordType
          ? ` (${existing.recordType} → ${finalRecordType})`
          : ''
      }${notes ? `: ${notes}` : ''}`;

      await db.insert(businessRecordActivities).values({
        businessRecordId: id,
        tenantId,
        activityType: 'status_changed',
        description: statusChangeDescription,
        metadata: JSON.stringify({
          previousStatus: existing.status,
          newStatus: status,
          previousRecordType: existing.recordType,
          newRecordType: finalRecordType,
          notes,
        }),
        createdBy: userId,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating status:', error);
      res.status(500).json({ message: 'Failed to update status' });
    }
  },
);

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
      console.error('Error bulk updating status:', error);
      res.status(500).json({ message: 'Failed to bulk update status' });
    }
  },
);

/**
 * Delete business record (soft delete by marking as inactive)
 */
router.delete('/api/business-records/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    if (!tenantId || !userId) {
      return res.status(400).json({ message: 'Tenant ID and User ID are required' });
    }

    const { id } = req.params;

    // Verify record exists
    const [existing] = await db
      .select()
      .from(businessRecords)
      .where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Soft delete: mark as former_customer with appropriate status
    const [deleted] = await db
      .update(businessRecords)
      .set({
        recordType: 'former_customer',
        status: 'deleted',
        isActive: false,
        deactivatedBy: userId,
        customerUntil: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(businessRecords.id, id))
      .returning();

    // Log activity
    await db.insert(businessRecordActivities).values({
      businessRecordId: id,
      tenantId,
      activityType: 'record_deleted',
      description: `Record deleted: ${existing.companyName}`,
      createdBy: userId,
    });

    res.json({ message: 'Record deleted successfully', record: deleted });
  } catch (error) {
    console.error('Error deleting business record:', error);
    res.status(500).json({ message: 'Failed to delete business record' });
  }
});

/**
 * Get statistics for dashboard
 */
router.get(
  '/api/business-records/stats/overview',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get counts by record type and status
      const stats = await db
        .select({
          recordType: businessRecords.recordType,
          status: businessRecords.status,
          count: sql<number>`count(*)`,
        })
        .from(businessRecords)
        .where(eq(businessRecords.tenantId, tenantId))
        .groupBy(businessRecords.recordType, businessRecords.status);

      // Calculate pipeline value
      const [pipelineValue] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${businessRecords.estimatedAmount}), 0)`,
        })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            inArray(businessRecords.recordType, ['lead', 'prospect']),
          ),
        );

      res.json({
        stats,
        pipelineValue: pipelineValue.total,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Failed to fetch statistics' });
    }
  },
);

// Backward compatibility routes - GET all customers with pagination
router.get('/api/customers', requireAuth, async (req: Request, res: Response) => {
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

    const records = await db
      .select()
      .from(businessRecords)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessRecords)
      .where(and(...conditions));

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
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

// GET single customer by ID or slug
router.get('/api/customers/:identifier', requireAuth, async (req: Request, res: Response) => {
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
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: 'Failed to fetch customer' });
  }
});

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
