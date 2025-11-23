/**
 * PLATFORM BUSINESS RECORDS API ROUTES
 *
 * Handles unified prospect and tenant management for platform administrators.
 * Implements the zero-data-loss conversion pattern where prospects become tenants
 * without losing any historical data.
 *
 * Features:
 * - Full CRUD operations for business records
 * - Advanced search and filtering
 * - Pagination and sorting
 * - Prospect-to-tenant conversion
 * - Bulk operations
 * - Export functionality
 * - Activity timeline
 * - Related records (contacts, deals, activities)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  platformBusinessRecords,
  platformContacts,
  platformDeals,
  platformActivities,
  platformLeadScoreCalculations,
  platformHealthScores,
  platformChurnPredictions,
  type PlatformBusinessRecord,
  type NewPlatformBusinessRecord,
} from '@shared/schema';
import { eq, and, or, like, gte, lte, inArray, desc, asc, sql, SQL } from 'drizzle-orm';
import { requireRootAdmin } from './routes-root-admin';

const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// All routes require root admin access
router.use(requireRootAdmin);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build dynamic WHERE clause from filter parameters
 */
function buildWhereClause(filters: any): SQL | undefined {
  const conditions: SQL[] = [];

  // Record type filter (prospect/tenant)
  if (filters.recordType) {
    conditions.push(eq(platformBusinessRecords.recordType, filters.recordType));
  }

  // Status filter (can be array)
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    conditions.push(inArray(platformBusinessRecords.status, statuses));
  }

  // Lead tier filter (hot/warm/cold)
  if (filters.leadTier) {
    conditions.push(eq(platformBusinessRecords.leadTier, filters.leadTier));
  }

  // Lead score range
  if (filters.leadScoreMin !== undefined) {
    conditions.push(gte(platformBusinessRecords.leadScore, parseInt(filters.leadScoreMin)));
  }
  if (filters.leadScoreMax !== undefined) {
    conditions.push(lte(platformBusinessRecords.leadScore, parseInt(filters.leadScoreMax)));
  }

  // Assigned sales rep
  if (filters.assignedSalesRep) {
    conditions.push(eq(platformBusinessRecords.assignedSalesRep, filters.assignedSalesRep));
  }

  // Assigned CSM
  if (filters.assignedCSM) {
    conditions.push(eq(platformBusinessRecords.assignedCSM, filters.assignedCSM));
  }

  // Lead source
  if (filters.leadSource) {
    conditions.push(eq(platformBusinessRecords.leadSource, filters.leadSource));
  }

  // Industry
  if (filters.industry) {
    conditions.push(eq(platformBusinessRecords.industry, filters.industry));
  }

  // Company size
  if (filters.companySize) {
    conditions.push(eq(platformBusinessRecords.companySize, filters.companySize));
  }

  // Territory
  if (filters.territory) {
    conditions.push(eq(platformBusinessRecords.territory, filters.territory));
  }

  // Churn risk
  if (filters.churnRisk) {
    conditions.push(eq(platformBusinessRecords.churnRisk, filters.churnRisk));
  }

  // Trial status
  if (filters.trialStatus) {
    conditions.push(eq(platformBusinessRecords.trialStatus, filters.trialStatus));
  }

  // Search query (company name, email, contact name)
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(platformBusinessRecords.companyName, searchTerm),
        like(platformBusinessRecords.primaryContactEmail, searchTerm),
        like(platformBusinessRecords.primaryContactName, searchTerm)
      )!
    );
  }

  // Date range filters
  if (filters.createdAfter) {
    conditions.push(gte(platformBusinessRecords.createdAt, new Date(filters.createdAfter)));
  }
  if (filters.createdBefore) {
    conditions.push(lte(platformBusinessRecords.createdAt, new Date(filters.createdBefore)));
  }

  // Tags filter (JSONB contains)
  if (filters.tags && filters.tags.length > 0) {
    const tagArray = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
    conditions.push(sql`${platformBusinessRecords.tags} @> ${JSON.stringify(tagArray)}::jsonb`);
  }

  // Priority filter
  if (filters.priority) {
    conditions.push(eq(platformBusinessRecords.priority, filters.priority));
  }

  // Strategic accounts only
  if (filters.isStrategic === 'true' || filters.isStrategic === true) {
    conditions.push(eq(platformBusinessRecords.isStrategic, true));
  }

  // Next follow-up overdue
  if (filters.followUpOverdue === 'true') {
    conditions.push(
      and(
        lte(platformBusinessRecords.nextFollowUpDate, new Date()),
        eq(platformBusinessRecords.recordType, 'prospect')
      )!
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Generate unique company display ID
 */
async function generateCompanyDisplayId(recordType: 'prospect' | 'tenant'): Promise<string> {
  const prefix = recordType === 'prospect' ? 'P' : 'T';

  // Get the latest ID for this type
  const latestRecord = await db.query.platformBusinessRecords.findFirst({
    where: eq(platformBusinessRecords.recordType, recordType),
    orderBy: [desc(platformBusinessRecords.createdAt)],
  });

  let nextNumber = 1;
  if (latestRecord?.companyDisplayId) {
    const match = latestRecord.companyDisplayId.match(/\d+/);
    if (match) {
      nextNumber = parseInt(match[0]) + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
}

// ============================================================================
// LIST & SEARCH
// ============================================================================

/**
 * GET /api/platform-crm/business-records
 * List business records with filtering, pagination, and sorting
 */
router.get('/business-records', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      ...filters
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // Build ORDER BY clause
    const orderByColumn = platformBusinessRecords[sortBy as keyof typeof platformBusinessRecords] || platformBusinessRecords.createdAt;
    const orderByClause = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

    // Execute query with pagination
    const records = await db.query.platformBusinessRecords.findMany({
      where: whereClause,
      orderBy: [orderByClause],
      limit: limitNum,
      offset: offset,
    });

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformBusinessRecords)
      .where(whereClause || sql`true`);

    const totalCount = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords: totalCount,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching business records:', error);
    res.status(500).json({
      error: 'Failed to fetch business records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/platform-crm/business-records/stats
 * Get aggregate statistics for business records
 */
router.get('/business-records/stats', async (req: Request, res: Response) => {
  try {
    const { recordType } = req.query;

    // Base stats query
    const statsQuery = db
      .select({
        totalRecords: sql<number>`count(*)`,
        avgLeadScore: sql<number>`avg(${platformBusinessRecords.leadScore})`,
        totalEstimatedValue: sql<number>`sum(${platformBusinessRecords.estimatedValue})`,
        totalMRR: sql<number>`sum(${platformBusinessRecords.currentMRR})`,
        totalARR: sql<number>`sum(${platformBusinessRecords.currentARR})`,
      })
      .from(platformBusinessRecords);

    if (recordType) {
      statsQuery.where(eq(platformBusinessRecords.recordType, recordType as any));
    }

    const [stats] = await statsQuery;

    // Status breakdown
    const statusBreakdown = await db
      .select({
        status: platformBusinessRecords.status,
        count: sql<number>`count(*)`,
      })
      .from(platformBusinessRecords)
      .where(recordType ? eq(platformBusinessRecords.recordType, recordType as any) : undefined)
      .groupBy(platformBusinessRecords.status);

    // Lead tier breakdown (for prospects)
    const leadTierBreakdown = await db
      .select({
        leadTier: platformBusinessRecords.leadTier,
        count: sql<number>`count(*)`,
        avgScore: sql<number>`avg(${platformBusinessRecords.leadScore})`,
      })
      .from(platformBusinessRecords)
      .where(eq(platformBusinessRecords.recordType, 'prospect'))
      .groupBy(platformBusinessRecords.leadTier);

    // Churn risk breakdown (for tenants)
    const churnRiskBreakdown = await db
      .select({
        churnRisk: platformBusinessRecords.churnRisk,
        count: sql<number>`count(*)`,
        totalMRR: sql<number>`sum(${platformBusinessRecords.currentMRR})`,
      })
      .from(platformBusinessRecords)
      .where(
        and(
          eq(platformBusinessRecords.recordType, 'tenant'),
          sql`${platformBusinessRecords.churnRisk} IS NOT NULL`
        )!
      )
      .groupBy(platformBusinessRecords.churnRisk);

    res.json({
      overall: stats,
      byStatus: statusBreakdown,
      byLeadTier: leadTierBreakdown,
      byChurnRisk: churnRiskBreakdown,
    });
  } catch (error) {
    console.error('Error fetching business record stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// DETAIL & RELATED DATA
// ============================================================================

/**
 * GET /api/platform-crm/business-records/:id
 * Get single business record with related data
 */
router.get('/business-records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { include } = req.query;

    // Get business record
    const record = await db.query.platformBusinessRecords.findFirst({
      where: eq(platformBusinessRecords.id, id),
    });

    if (!record) {
      return res.status(404).json({ error: 'Business record not found' });
    }

    // Build response with optional related data
    const response: any = { record };

    const includeFields = include ? (include as string).split(',') : [];

    // Include contacts
    if (includeFields.includes('contacts')) {
      response.contacts = await db.query.platformContacts.findMany({
        where: eq(platformContacts.businessRecordId, id),
        orderBy: [desc(platformContacts.isPrimaryContact), asc(platformContacts.lastName)],
      });
    }

    // Include deals
    if (includeFields.includes('deals')) {
      response.deals = await db.query.platformDeals.findMany({
        where: eq(platformDeals.businessRecordId, id),
        orderBy: [desc(platformDeals.createdAt)],
      });
    }

    // Include recent activities
    if (includeFields.includes('activities')) {
      response.activities = await db.query.platformActivities.findMany({
        where: eq(platformActivities.businessRecordId, id),
        orderBy: [desc(platformActivities.activityDate)],
        limit: 20,
      });
    }

    // Include lead score
    if (includeFields.includes('leadScore')) {
      response.leadScore = await db.query.platformLeadScoreCalculations.findFirst({
        where: eq(platformLeadScoreCalculations.businessRecordId, id),
      });
    }

    // Include health score (for tenants)
    if (includeFields.includes('healthScore') && record.recordType === 'tenant') {
      response.healthScore = await db.query.platformHealthScores.findFirst({
        where: eq(platformHealthScores.businessRecordId, id),
      });
    }

    // Include churn prediction (for tenants)
    if (includeFields.includes('churnPrediction') && record.recordType === 'tenant') {
      response.churnPrediction = await db.query.platformChurnPredictions.findFirst({
        where: eq(platformChurnPredictions.businessRecordId, id),
        orderBy: [desc(platformChurnPredictions.predictedAt)],
      });
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching business record:', error);
    res.status(500).json({
      error: 'Failed to fetch business record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/platform-crm/business-records/:id/timeline
 * Get complete activity timeline for a business record
 */
router.get('/business-records/:id/timeline', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const activities = await db.query.platformActivities.findMany({
      where: eq(platformActivities.businessRecordId, id),
      orderBy: [desc(platformActivities.activityDate)],
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformActivities)
      .where(eq(platformActivities.businessRecordId, id));

    const totalCount = Number(countResult[0]?.count || 0);

    res.json({
      activities,
      totalCount,
      hasMore: parseInt(offset as string) + activities.length < totalCount,
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({
      error: 'Failed to fetch timeline',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// CREATE
// ============================================================================

/**
 * POST /api/platform-crm/business-records
 * Create new business record (prospect or tenant)
 */
router.post('/business-records', async (req: Request, res: Response) => {
  try {
    const data: NewPlatformBusinessRecord = req.body;

    // Generate company display ID if not provided
    if (!data.companyDisplayId) {
      data.companyDisplayId = await generateCompanyDisplayId(data.recordType || 'prospect');
    }

    // Set default status if not provided
    if (!data.status) {
      data.status = data.recordType === 'prospect' ? 'new' : 'active_customer';
    }

    // Create record
    const [newRecord] = await db
      .insert(platformBusinessRecords)
      .values(data)
      .returning();

    // Log creation activity
    await db.insert(platformActivities).values({
      businessRecordId: newRecord.id,
      activityType: 'note',
      subject: 'Business record created',
      description: `${newRecord.recordType === 'prospect' ? 'Prospect' : 'Tenant'} record created`,
      activityDate: new Date(),
      createdBy: req.user?.id || 'system',
    });

    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error creating business record:', error);
    res.status(500).json({
      error: 'Failed to create business record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// UPDATE
// ============================================================================

/**
 * PATCH /api/platform-crm/business-records/:id
 * Update business record
 */
router.patch('/business-records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get current record for comparison
    const currentRecord = await db.query.platformBusinessRecords.findFirst({
      where: eq(platformBusinessRecords.id, id),
    });

    if (!currentRecord) {
      return res.status(404).json({ error: 'Business record not found' });
    }

    // Update record
    const [updatedRecord] = await db
      .update(platformBusinessRecords)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, id))
      .returning();

    // Log significant changes
    const significantChanges: string[] = [];

    if (updates.status && updates.status !== currentRecord.status) {
      significantChanges.push(`Status changed from ${currentRecord.status} to ${updates.status}`);
    }
    if (updates.assignedSalesRep && updates.assignedSalesRep !== currentRecord.assignedSalesRep) {
      significantChanges.push(`Assigned sales rep changed`);
    }
    if (updates.leadScore && updates.leadScore !== currentRecord.leadScore) {
      significantChanges.push(`Lead score changed from ${currentRecord.leadScore} to ${updates.leadScore}`);
    }

    if (significantChanges.length > 0) {
      await db.insert(platformActivities).values({
        businessRecordId: id,
        activityType: 'note',
        subject: 'Record updated',
        description: significantChanges.join('. '),
        activityDate: new Date(),
        createdBy: req.user?.id || 'system',
      });
    }

    res.json(updatedRecord);
  } catch (error) {
    console.error('Error updating business record:', error);
    res.status(500).json({
      error: 'Failed to update business record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// CONVERSION
// ============================================================================

/**
 * POST /api/platform-crm/business-records/:id/convert-to-tenant
 * Convert prospect to tenant (zero-data-loss pattern)
 */
router.post('/business-records/:id/convert-to-tenant', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, planId, conversionSource } = req.body;

    // Get current record
    const record = await db.query.platformBusinessRecords.findFirst({
      where: eq(platformBusinessRecords.id, id),
    });

    if (!record) {
      return res.status(404).json({ error: 'Business record not found' });
    }

    if (record.recordType === 'tenant') {
      return res.status(400).json({ error: 'Record is already a tenant' });
    }

    // Convert to tenant
    const [convertedRecord] = await db
      .update(platformBusinessRecords)
      .set({
        recordType: 'tenant',
        status: 'active_customer',
        previousStatus: record.status,
        tenantId,
        customerSince: new Date(),
        convertedFromProspectAt: new Date(),
        convertedBy: req.user?.id,
        conversionSource: conversionSource || 'manual',
        companyDisplayId: await generateCompanyDisplayId('tenant'), // Generate new tenant ID
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, id))
      .returning();

    // Log conversion activity
    await db.insert(platformActivities).values({
      businessRecordId: id,
      activityType: 'note',
      subject: 'Converted to tenant',
      description: `Prospect converted to active customer. Tenant ID: ${tenantId}`,
      activityDate: new Date(),
      createdBy: req.user?.id || 'system',
      outcome: 'successful',
    });

    res.json(convertedRecord);
  } catch (error) {
    console.error('Error converting to tenant:', error);
    res.status(500).json({
      error: 'Failed to convert to tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * POST /api/platform-crm/business-records/bulk-update
 * Bulk update business records
 */
router.post('/business-records/bulk-update', async (req: Request, res: Response) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty IDs array' });
    }

    const updatedRecords = await db
      .update(platformBusinessRecords)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(inArray(platformBusinessRecords.id, ids))
      .returning();

    res.json({
      updated: updatedRecords.length,
      records: updatedRecords,
    });
  } catch (error) {
    console.error('Error bulk updating records:', error);
    res.status(500).json({
      error: 'Failed to bulk update records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/platform-crm/business-records/bulk-delete
 * Bulk soft delete business records
 */
router.delete('/business-records/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty IDs array' });
    }

    // Soft delete (set deletedAt)
    const deletedRecords = await db
      .update(platformBusinessRecords)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(platformBusinessRecords.id, ids))
      .returning();

    res.json({
      deleted: deletedRecords.length,
      records: deletedRecords,
    });
  } catch (error) {
    console.error('Error bulk deleting records:', error);
    res.status(500).json({
      error: 'Failed to bulk delete records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// EXPORT
// ============================================================================

/**
 * GET /api/platform-crm/business-records/export
 * Export business records to CSV
 */
router.get('/business-records/export', async (req: Request, res: Response) => {
  try {
    const { format = 'csv', ...filters } = req.query;

    // Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // Fetch all matching records
    const records = await db.query.platformBusinessRecords.findMany({
      where: whereClause,
      orderBy: [desc(platformBusinessRecords.createdAt)],
    });

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'ID', 'Company Name', 'Type', 'Status', 'Email', 'Contact Name',
        'Lead Score', 'Lead Tier', 'Industry', 'Company Size', 'Territory',
        'Assigned Sales Rep', 'Created At', 'Customer Since', 'MRR', 'ARR'
      ];

      const rows = records.map(r => [
        r.id,
        r.companyName,
        r.recordType,
        r.status,
        r.primaryContactEmail,
        r.primaryContactName,
        r.leadScore,
        r.leadTier,
        r.industry,
        r.companySize,
        r.territory,
        r.assignedSalesRep,
        r.createdAt?.toISOString(),
        r.customerSince?.toISOString(),
        r.currentMRR,
        r.currentARR,
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell || ''}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=business-records-${Date.now()}.csv`);
      res.send(csv);
    } else {
      // JSON export
      res.json({ records });
    }
  } catch (error) {
    console.error('Error exporting records:', error);
    res.status(500).json({
      error: 'Failed to export records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// DELETE
// ============================================================================

/**
 * DELETE /api/platform-crm/business-records/:id
 * Soft delete business record
 */
router.delete('/business-records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deletedRecord] = await db
      .update(platformBusinessRecords)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, id))
      .returning();

    if (!deletedRecord) {
      return res.status(404).json({ error: 'Business record not found' });
    }

    res.json({ message: 'Business record deleted successfully', record: deletedRecord });
  } catch (error) {
    console.error('Error deleting business record:', error);
    res.status(500).json({
      error: 'Failed to delete business record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
