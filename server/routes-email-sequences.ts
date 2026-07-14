/**
 * Email sequences (drip) API — CRMX-009.
 * Enroll/unenroll recipients and read per-recipient sequence state. The
 * scheduler (server/services/email-sequence-scheduler.ts) advances enrollments.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { emailSequenceEnrollments } from '@shared/schema';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { enrollRecipient, unenrollRecipient } from './services/email-sequence-scheduler';
import { createModuleLogger } from './lib/logger';
import { parseListLimit } from './lib/pagination';

const log = createModuleLogger('routes-email-sequences');
const router = Router();

const enrollSchema = z.object({
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        businessRecordId: z.string().optional(),
        contactId: z.string().optional(),
      }),
    )
    .min(1),
});

// POST /api/email-sequences/:campaignId/enroll
router.post(
  '/api/email-sequences/:campaignId/enroll',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = enrollSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors });
      }

      const results = [];
      for (const recipient of parsed.data.recipients) {
        const id = await enrollRecipient(tenantId, req.params.campaignId, recipient, userId);
        results.push({ email: recipient.email, enrollmentId: id, enrolled: !!id });
      }
      res.status(201).json({ results });
    } catch (error) {
      log.error('Error enrolling recipients:', error);
      res.status(500).json({ message: 'Failed to enroll recipients' });
    }
  },
);

// POST /api/email-sequences/enrollments/:id/unenroll
router.post(
  '/api/email-sequences/enrollments/:id/unenroll',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'manual';
      const ok = await unenrollRecipient(req.params.id, tenantId, reason);
      if (!ok) return res.status(404).json({ message: 'Active enrollment not found' });
      res.json({ success: true });
    } catch (error) {
      log.error('Error unenrolling recipient:', error);
      res.status(500).json({ message: 'Failed to unenroll recipient' });
    }
  },
);

// GET /api/email-sequences/:campaignId/enrollments
router.get(
  '/api/email-sequences/:campaignId/enrollments',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const limit = parseListLimit(req.query.limit, { def: 100 });
      if (limit === null) return res.status(400).json({ message: 'Invalid limit parameter' });

      const rows = await db
        .select()
        .from(emailSequenceEnrollments)
        .where(
          and(
            eq(emailSequenceEnrollments.campaignId, req.params.campaignId),
            eq(emailSequenceEnrollments.tenantId, tenantId),
          ),
        )
        .orderBy(desc(emailSequenceEnrollments.createdAt))
        .limit(limit);
      res.json(rows);
    } catch (error) {
      log.error('Error listing enrollments:', error);
      res.status(500).json({ message: 'Failed to list enrollments' });
    }
  },
);

// GET /api/email-sequences/enrollments/:id
router.get(
  '/api/email-sequences/enrollments/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const [row] = await db
        .select()
        .from(emailSequenceEnrollments)
        .where(
          and(
            eq(emailSequenceEnrollments.id, req.params.id),
            eq(emailSequenceEnrollments.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!row) return res.status(404).json({ message: 'Enrollment not found' });
      res.json(row);
    } catch (error) {
      log.error('Error fetching enrollment:', error);
      res.status(500).json({ message: 'Failed to fetch enrollment' });
    }
  },
);

export default router;
