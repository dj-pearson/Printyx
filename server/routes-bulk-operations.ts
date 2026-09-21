/**
 * Generic Bulk Operations API Routes
 * Extends CRM bulk routes with invoice, equipment, and activity bulk operations.
 * Part of US-060: Bulk operations framework with progress tracking.
 */
import type { Express, Request, Response } from 'express';
import { summariseBulkWrite } from '@shared/bulk-result';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
// The schema renamed `activities` → `businessRecordActivities`; this
// file was written against the old name. Local rename keeps the rest
// unchanged.
import { invoices, equipment, businessRecordActivities as activities } from '@shared/schema';

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

      // The existence check above 400s on an id this tenant cannot reach, so
      // `ids.length` was nearly right - and "nearly" is a row somebody deleted
      // between the check and the update. Measure it; one shape for every bulk
      // write beats a special case a guard has to know about.
      const updated = await db
        .update(invoices)
        .set(safeUpdates)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, ids)))
        .returning({ id: invoices.id });

      const outcome = summariseBulkWrite(
        ids,
        updated.map((row) => row.id),
        'invoice',
        'updated',
      );
      log.info(`Bulk updated ${outcome.affectedCount} invoices by user ${userId}`);
      res.json({
        message: outcome.message,
        updatedCount: outcome.affectedCount,
        notFound: outcome.notFound,
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

      // `.returning` is what turns this from a claim into a measurement. The
      // delete is tenant-scoped and there is no existence check above it (the
      // bulk-UPDATE beside this one has one and 400s), so an id from another
      // tenant - or one a colleague removed thirty seconds ago - matched
      // nothing while the response said every selected invoice was gone.
      const deleted = await db
        .delete(invoices)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, parsed.data.ids)))
        .returning({ id: invoices.id });

      const outcome = summariseBulkWrite(
        parsed.data.ids,
        deleted.map((row) => row.id),
        'invoice',
        'deleted',
      );
      log.info(`Bulk deleted ${outcome.affectedCount} invoices by user ${userId}`);
      res.json({
        message: outcome.message,
        deletedCount: outcome.affectedCount,
        notFound: outcome.notFound,
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

      const updated = await db
        .update(equipment)
        .set(safeUpdates)
        .where(and(eq(equipment.tenantId, tenantId), inArray(equipment.id, ids)))
        .returning({ id: equipment.id });

      const outcome = summariseBulkWrite(
        ids,
        updated.map((row) => row.id),
        'equipment item',
        'updated',
      );
      log.info(`Bulk updated ${outcome.affectedCount} equipment items by user ${userId}`);
      res.json({
        message: outcome.message,
        updatedCount: outcome.affectedCount,
        notFound: outcome.notFound,
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

      const deleted = await db
        .delete(equipment)
        .where(and(eq(equipment.tenantId, tenantId), inArray(equipment.id, parsed.data.ids)))
        .returning({ id: equipment.id });

      const outcome = summariseBulkWrite(
        parsed.data.ids,
        deleted.map((row) => row.id),
        'equipment item',
        'deleted',
      );
      log.info(`Bulk deleted ${outcome.affectedCount} equipment items by user ${userId}`);
      res.json({
        message: outcome.message,
        deletedCount: outcome.affectedCount,
        notFound: outcome.notFound,
      });
    } catch (error: any) {
      log.error('Failed to bulk delete equipment:', error);
      res.status(500).json({ message: 'Failed to bulk delete equipment' });
    }
  });

  // ==================== ACTIVITY BULK OPERATIONS ====================

  // POST /api/activities/bulk-update - Bulk update activities
  // POST /api/activities/bulk-update and /bulk-delete were removed here
  // (PROD-008b). /api/activities is proxied to supabase/functions/activities/,
  // which has no bulk branch — and until this change its POST branch had no path
  // check either, so both requests fell through to "create activity" and inserted
  // a row built from a bulk payload. That guard is now explicit on the edge side;
  // an unmatched sub-path reaches the 405. Nothing in client/src calls either
  // endpoint. The invoices and equipment bulk handlers below are on UNPROXIED
  // prefixes and stay.

  // POST /api/activities/bulk-delete - Bulk delete activities

  log.info('✅ Bulk Operations routes registered');
}
