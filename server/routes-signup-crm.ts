/**
 * ROOT ADMIN: SIGNUP & TRIAL CRM ROUTES
 * Manage platform signups, trials, and conversion metrics
 */

import { Router } from 'express';
import { db } from './db';
import { eq, desc, and, gte, lte, count } from 'drizzle-orm';
import {
  platformSignups,
  trialActivityLog,
  trialCommunications,
  conversionFunnelEvents,
} from '@shared/schema-signups';
import { requireRootAdmin } from './routes-root-admin';
import { z } from 'zod';

const router = Router();

// Apply root admin middleware to all routes
router.use(requireRootAdmin);

/**
 * GET /api/root-admin/signups
 * Get all platform signups with filtering and pagination
 */
router.get('/signups', async (req, res) => {
  try {
    const { status, page = '1', limit = '20', sortBy = 'createdAt', order = 'desc' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, parseInt(limit as string) || 20);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(platformSignups);

    if (status) {
      query = query.where(eq(platformSignups.status, status as string));
    }

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(platformSignups)
      .where(status ? eq(platformSignups.status, status as string) : undefined);

    const total = countResult[0]?.count || 0;

    // Execute with ordering
    const signups = await query
      .orderBy(
        order === 'asc'
          ? undefined
          : desc(platformSignups[sortBy as keyof typeof platformSignups] as any),
      )
      .limit(limitNum)
      .offset(offset);

    res.json({
      data: signups,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching signups:', error);
    res.status(500).json({ error: 'Failed to fetch signups' });
  }
});

/**
 * GET /api/root-admin/signups/:id
 * Get signup details with activity history
 */
router.get('/signups/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const signup = await db
      .select()
      .from(platformSignups)
      .where(eq(platformSignups.id, id))
      .limit(1);

    if (!signup.length) {
      return res.status(404).json({ error: 'Signup not found' });
    }

    // Get activity history
    const activities = await db
      .select()
      .from(trialActivityLog)
      .where(eq(trialActivityLog.signupId, id))
      .orderBy(desc(trialActivityLog.created_at))
      .limit(50);

    // Get communications
    const communications = await db
      .select()
      .from(trialCommunications)
      .where(eq(trialCommunications.signupId, id))
      .orderBy(desc(trialCommunications.sentAt));

    // Get funnel events
    const funnelEvents = await db
      .select()
      .from(conversionFunnelEvents)
      .where(eq(conversionFunnelEvents.signupId, id))
      .orderBy(desc(conversionFunnelEvents.created_at));

    res.json({
      signup: signup[0],
      activities,
      communications,
      funnelEvents,
    });
  } catch (error) {
    console.error('Error fetching signup details:', error);
    res.status(500).json({ error: 'Failed to fetch signup details' });
  }
});

/**
 * PATCH /api/root-admin/signups/:id
 * Update signup status and notes
 */
router.patch('/signups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, tags, assignedTo, qualificationScore } = req.body;

    const updates: any = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (tags) updates.tags = tags;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (qualificationScore !== undefined) updates.qualificationScore = qualificationScore;
    updates.updated_at = new Date();

    const updated = await db
      .update(platformSignups)
      .set(updates)
      .where(eq(platformSignups.id, id))
      .returning();

    res.json({ data: updated[0] });
  } catch (error) {
    console.error('Error updating signup:', error);
    res.status(500).json({ error: 'Failed to update signup' });
  }
});

/**
 * GET /api/root-admin/signups-analytics
 * Get signup analytics and metrics
 */
router.get('/signups-analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Total signups
    const totalSignups = await db
      .select({ count: count() })
      .from(platformSignups)
      .where(and(gte(platformSignups.created_at, start), lte(platformSignups.created_at, end)));

    // Signups by status
    const byStatus = await db
      .select({
        status: platformSignups.status,
        count: count(),
      })
      .from(platformSignups)
      .where(and(gte(platformSignups.created_at, start), lte(platformSignups.created_at, end)))
      .groupBy(platformSignups.status);

    // Signups by source
    const bySource = await db
      .select({
        source: platformSignups.source,
        count: count(),
      })
      .from(platformSignups)
      .where(and(gte(platformSignups.created_at, start), lte(platformSignups.created_at, end)))
      .groupBy(platformSignups.source);

    // Average qualification score
    const avgQualification = await db
      .select({ avg: platformSignups.qualificationScore })
      .from(platformSignups)
      .where(and(gte(platformSignups.created_at, start), lte(platformSignups.created_at, end)));

    // Conversion rate (signups to activated)
    const activated = await db
      .select({ count: count() })
      .from(platformSignups)
      .where(
        and(
          eq(platformSignups.status, 'activated'),
          gte(platformSignups.created_at, start),
          lte(platformSignups.created_at, end),
        ),
      );

    res.json({
      totalSignups: totalSignups[0].count,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.count])),
      bySource: Object.fromEntries(bySource.map((s) => [s.source, s.count])),
      avgQualificationScore: avgQualification[0]?.avg || 0,
      conversionRate:
        totalSignups[0].count > 0
          ? (((activated[0]?.count || 0) / totalSignups[0].count) * 100).toFixed(2)
          : 0,
      dateRange: { start, end },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/root-admin/trial-funnel
 * Get conversion funnel metrics
 */
router.get('/trial-funnel', async (req, res) => {
  try {
    const stages = [
      'signup_created',
      'email_verified',
      'trial_started',
      'first_data_created',
      'feature_used',
      'demo_completed',
      'upgrade_attempted',
      'upgraded',
    ];

    const funnelData = await Promise.all(
      stages.map(async (stage) => {
        const count = await db
          .select({ count: count() })
          .from(conversionFunnelEvents)
          .where(eq(conversionFunnelEvents.stage, stage));

        return { stage, count: count[0]?.count || 0 };
      }),
    );

    // Calculate drop-off rates
    const funnelWithDropoff = funnelData.map((item, index) => ({
      ...item,
      dropoffPercent:
        index > 0
          ? (
              ((funnelData[index - 1].count - item.count) / funnelData[index - 1].count) *
              100
            ).toFixed(2)
          : 0,
    }));

    res.json({ funnel: funnelWithDropoff });
  } catch (error) {
    console.error('Error fetching funnel data:', error);
    res.status(500).json({ error: 'Failed to fetch funnel data' });
  }
});

/**
 * POST /api/root-admin/signups/:id/log-activity
 * Log trial activity for a signup
 */
router.post('/signups/:id/log-activity', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      activityType,
      description,
      featureModule,
      actionDetails,
      engagementValue = 1,
    } = req.body;

    const activity = await db
      .insert(trialActivityLog)
      .values({
        signupId: id,
        activityType,
        description,
        featureModule,
        actionDetails: actionDetails || {},
        engagementValue,
      })
      .returning();

    // Update last activity timestamp
    await db
      .update(platformSignups)
      .set({ lastActivityAt: new Date() })
      .where(eq(platformSignups.id, id));

    res.json({ data: activity[0] });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

/**
 * POST /api/root-admin/signups/:id/send-email
 * Log a sent email communication
 */
router.post('/signups/:id/send-email', async (req, res) => {
  try {
    const { id } = req.params;
    const { campaignName, emailTemplate, subject } = req.body;

    const communication = await db
      .insert(trialCommunications)
      .values({
        signupId: id,
        campaignName,
        emailTemplate,
        subject,
        sentAt: new Date(),
        status: 'sent',
      })
      .returning();

    res.json({ data: communication[0] });
  } catch (error) {
    console.error('Error logging email:', error);
    res.status(500).json({ error: 'Failed to log email' });
  }
});

/**
 * GET /api/root-admin/high-value-signups
 * Get signups with high qualification scores
 */
router.get('/high-value-signups', async (req, res) => {
  try {
    const { minScore = '70', limit = '20' } = req.query;

    const signups = await db
      .select()
      .from(platformSignups)
      .where(gte(platformSignups.qualificationScore, parseInt(minScore as string)))
      .orderBy(desc(platformSignups.qualificationScore))
      .limit(parseInt(limit as string));

    res.json({ data: signups });
  } catch (error) {
    console.error('Error fetching high-value signups:', error);
    res.status(500).json({ error: 'Failed to fetch high-value signups' });
  }
});

export default router;
