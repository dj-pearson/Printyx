/**
 * Generic Bulk Operations API Routes
 * Extends CRM bulk routes with invoice, equipment, and activity bulk operations.
 * Part of US-060: Bulk operations framework with progress tracking.
 */
import type { Express, Request, Response } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { invoices, equipment, activities } from '@shared/schema';

const log = createModuleLogger('routes-bulk-operations');

const bulkIdsSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
});

const bulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  updates: z.record(z.string(), z.any()),
});

export function registerBulkOperationsRoutes(app: Express) {
  // ==================== INVOICE BULK OPERATIONS ====================

  // POST /api/invoices/bulk-update - Bulk update invoices
  app.post('/api/invoices/bulk-update', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const { ids, updates } = parsed.data;

      // Validate all IDs belong to tenant
      const existing = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, ids)));

      const validIds = new Set(existing.map((r) => r.id));
      const invalidIds = ids.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: `${invalidIds.length} invoice(s) not found or not accessible`,
          invalidIds,
        });
      }

      // Whitelist allowed fields
      const safeUpdates: Record<string, any> = {};
      const allowedFields = ['status', 'invoiceStatus', 'salesRep', 'paymentTerms', 'invoiceNotes'];
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
        .update(invoices)
        .set(safeUpdates)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, ids)));

      log.info(`Bulk updated ${ids.length} invoices by user ${userId}`);
      res.json({
        message: `Successfully updated ${ids.length} invoices`,
        updatedCount: ids.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk update invoices:', error);
      res.status(500).json({ message: 'Failed to bulk update invoices' });
    }
  });

  // POST /api/invoices/bulk-delete - Bulk delete invoices
  app.post('/api/invoices/bulk-delete', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = bulkIdsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed' });
      }

      await db
        .delete(invoices)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, parsed.data.ids)));

      log.info(`Bulk deleted ${parsed.data.ids.length} invoices by user ${userId}`);
      res.json({
        message: `Successfully deleted ${parsed.data.ids.length} invoices`,
        deletedCount: parsed.data.ids.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk delete invoices:', error);
      res.status(500).json({ message: 'Failed to bulk delete invoices' });
    }
  });

  // ==================== EQUIPMENT BULK OPERATIONS ====================

  // POST /api/equipment/bulk-update - Bulk update equipment
  app.post('/api/equipment/bulk-update', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const { ids, updates } = parsed.data;

      const existing = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(and(eq(equipment.tenantId, tenantId), inArray(equipment.id, ids)));

      const validIds = new Set(existing.map((r) => r.id));
      const invalidIds = ids.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: `${invalidIds.length} equipment item(s) not found or not accessible`,
          invalidIds,
        });
      }

      const safeUpdates: Record<string, any> = {};
      const allowedFields = ['status', 'assignedToId', 'locationId', 'condition', 'notes'];
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
        .update(equipment)
        .set(safeUpdates)
        .where(and(eq(equipment.tenantId, tenantId), inArray(equipment.id, ids)));

      log.info(`Bulk updated ${ids.length} equipment items by user ${userId}`);
      res.json({
        message: `Successfully updated ${ids.length} equipment items`,
        updatedCount: ids.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk update equipment:', error);
      res.status(500).json({ message: 'Failed to bulk update equipment' });
    }
  });

  // POST /api/equipment/bulk-delete - Bulk delete equipment
  app.post('/api/equipment/bulk-delete', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = bulkIdsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed' });
      }

      await db
        .delete(equipment)
        .where(and(eq(equipment.tenantId, tenantId), inArray(equipment.id, parsed.data.ids)));

      log.info(`Bulk deleted ${parsed.data.ids.length} equipment items by user ${userId}`);
      res.json({
        message: `Successfully deleted ${parsed.data.ids.length} equipment items`,
        deletedCount: parsed.data.ids.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk delete equipment:', error);
      res.status(500).json({ message: 'Failed to bulk delete equipment' });
    }
  });

  // ==================== ACTIVITY BULK OPERATIONS ====================

  // POST /api/activities/bulk-update - Bulk update activities
  app.post('/api/activities/bulk-update', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const { ids, updates } = parsed.data;

      const existing = await db
        .select({ id: activities.id })
        .from(activities)
        .where(and(eq(activities.tenantId, tenantId), inArray(activities.id, ids)));

      const validIds = new Set(existing.map((r) => r.id));
      const invalidIds = ids.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: `${invalidIds.length} activity(ies) not found or not accessible`,
          invalidIds,
        });
      }

      const safeUpdates: Record<string, any> = {};
      const allowedFields = ['status', 'assignedToId', 'priority', 'dueDate'];
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
        .update(activities)
        .set(safeUpdates)
        .where(and(eq(activities.tenantId, tenantId), inArray(activities.id, ids)));

      log.info(`Bulk updated ${ids.length} activities by user ${userId}`);
      res.json({
        message: `Successfully updated ${ids.length} activities`,
        updatedCount: ids.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk update activities:', error);
      res.status(500).json({ message: 'Failed to bulk update activities' });
    }
  });

  // POST /api/activities/bulk-delete - Bulk delete activities
  app.post('/api/activities/bulk-delete', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = bulkIdsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed' });
      }

      await db
        .delete(activities)
        .where(and(eq(activities.tenantId, tenantId), inArray(activities.id, parsed.data.ids)));

      log.info(`Bulk deleted ${parsed.data.ids.length} activities by user ${userId}`);
      res.json({
        message: `Successfully deleted ${parsed.data.ids.length} activities`,
        deletedCount: parsed.data.ids.length,
      });
    } catch (error: any) {
      log.error('Failed to bulk delete activities:', error);
      res.status(500).json({ message: 'Failed to bulk delete activities' });
    }
  });

  log.info('✅ Bulk Operations routes registered');
}
