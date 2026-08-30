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
import { eq, and, inArray } from 'drizzle-orm';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-business-records');

const router = Router();

// PA-021: businessRecordSchema and statusUpdateSchema used to sit here. Their
// last readers were the three /api/customers compatibility routes removed with
// this change; the one handler left in this file validates inline.
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

// PA-021 removed the three /api/customers compatibility routes that lived here
// (GET list, GET /:identifier, POST). All three were shadowed once
// /api/customers became a crmProxies prefix, and production - which never
// reaches Express - had always used supabase/functions/customers/. The POST was
// also self-recursive: it set recordType and re-entered `router.handle`, relying
// on the business-records POST further down to pick the request back up.

// Registration function for use in main routes file
export function registerBusinessRecordRoutes(app: any) {
  app.use(router);
}

export default router;
