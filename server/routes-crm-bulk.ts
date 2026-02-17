/**
 * CRM Bulk Operations API Routes
 * Endpoints for bulk updating, assigning, and managing CRM records.
 * Part of CRM-007: Bulk selection and bulk operations.
 */
import type { Express, Request, Response } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { deals, businessRecords } from '@shared/schema';

const log = createModuleLogger('routes-crm-bulk');

export function registerCrmBulkRoutes(app: Express) {
  // POST /api/deals-management/deals/bulk-update
  app.post('/api/deals-management/deals/bulk-update', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const schema = z.object({
        dealIds: z.array(z.string()).min(1).max(500),
        updates: z.record(z.string(), z.any()),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const { dealIds, updates } = parsed.data;

      // Validate all deal IDs belong to the tenant
      const existingDeals = await db
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantId), inArray(deals.id, dealIds)));

      const validIds = new Set(existingDeals.map((d) => d.id));
      const invalidIds = dealIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: `${invalidIds.length} deal(s) not found or not accessible`,
          invalidIds,
        });
      }

      // Build safe update object
      const safeUpdates: Record<string, any> = {};
      const allowedFields = ['stage', 'status', 'priority', 'assignedToId', 'probability', 'value', 'expectedCloseDate'];
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          safeUpdates[key] = value;
        }
      }

      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ message: 'No valid update fields provided' });
      }

      safeUpdates.updatedAt = new Date();

      // Bulk update
      const result = await db
        .update(deals)
        .set(safeUpdates)
        .where(and(eq(deals.tenantId, tenantId), inArray(deals.id, dealIds)));

      log.info(`Bulk updated ${dealIds.length} deals by user ${userId}`);
      res.json({
        message: `Successfully updated ${dealIds.length} deals`,
        updatedCount: dealIds.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk update deals:', error);
      res.status(500).json({ message: 'Failed to bulk update deals' });
    }
  });

  // POST /api/business-records/bulk-update
  app.post('/api/business-records/bulk-update', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const schema = z.object({
        recordIds: z.array(z.string()).min(1).max(500),
        updates: z.record(z.string(), z.any()),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const { recordIds, updates } = parsed.data;

      // Validate all records belong to the tenant
      const existing = await db
        .select({ id: businessRecords.id })
        .from(businessRecords)
        .where(and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, recordIds)));

      const validIds = new Set(existing.map((r) => r.id));
      const invalidIds = recordIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: `${invalidIds.length} record(s) not found or not accessible`,
          invalidIds,
        });
      }

      const safeUpdates: Record<string, any> = {};
      const allowedFields = ['status', 'priority', 'ownerId', 'assignedSalesRep', 'leadSource', 'industry', 'customerTier'];
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          safeUpdates[key] = value;
        }
      }

      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ message: 'No valid update fields provided' });
      }

      safeUpdates.updatedAt = new Date();

      await db
        .update(businessRecords)
        .set(safeUpdates)
        .where(and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, recordIds)));

      log.info(`Bulk updated ${recordIds.length} business records by user ${userId}`);
      res.json({
        message: `Successfully updated ${recordIds.length} records`,
        updatedCount: recordIds.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk update records:', error);
      res.status(500).json({ message: 'Failed to bulk update records' });
    }
  });

  // POST /api/deals-management/deals/bulk-delete
  app.post('/api/deals-management/deals/bulk-delete', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const schema = z.object({
        dealIds: z.array(z.string()).min(1).max(100),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed' });
      }

      await db
        .delete(deals)
        .where(and(eq(deals.tenantId, tenantId), inArray(deals.id, parsed.data.dealIds)));

      log.info(`Bulk deleted ${parsed.data.dealIds.length} deals by user ${userId}`);
      res.json({
        message: `Successfully deleted ${parsed.data.dealIds.length} deals`,
        deletedCount: parsed.data.dealIds.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk delete deals:', error);
      res.status(500).json({ message: 'Failed to bulk delete deals' });
    }
  });

  log.info('✅ CRM Bulk Operations routes registered');
}
