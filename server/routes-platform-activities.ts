/**
 * PLATFORM ACTIVITIES API ROUTES
 *
 * Manages activity tracking for platform CRM (calls, emails, meetings, demos, tasks).
 * Provides complete interaction history and timeline for prospects and tenants.
 *
 * Features:
 * - Full CRUD operations for activities
 * - Activity logging for calls, emails, meetings, demos, tasks
 * - Timeline views
 * - Activity metrics and analytics
 * - Bulk activity logging
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import {
  platformActivities,
  platformBusinessRecords,
  platformDeals,
  type PlatformActivity,
  type NewPlatformActivity,
} from '@shared/schema';
import { eq, and, or, inArray, gte, lte, desc, asc, sql, SQL } from 'drizzle-orm';
import { requireRootAdmin } from './routes-root-admin';

const router = Router();

// All routes require root admin access
router.use(requireRootAdmin);

// ============================================================================
// LIST & FILTER
// ============================================================================

/**
 * GET /api/platform-activities
 * List activities with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      businessRecordId,
      dealId,
      contactId,
      activityType,
      createdBy,
      startDate,
      endDate,
      sortBy = 'activityDate',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions: SQL[] = [];

    if (businessRecordId) {
      conditions.push(eq(platformActivities.businessRecordId, businessRecordId as string));
    }

    if (dealId) {
      conditions.push(eq(platformActivities.dealId, dealId as string));
    }

    if (contactId) {
      conditions.push(eq(platformActivities.contactId, contactId as string));
    }

    if (activityType) {
      const types = Array.isArray(activityType) ? activityType : [activityType];
      conditions.push(inArray(platformActivities.activityType, types as any));
    }

    if (createdBy) {
      conditions.push(eq(platformActivities.createdBy, createdBy as string));
    }

    if (startDate) {
      conditions.push(gte(platformActivities.activityDate, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(platformActivities.activityDate, new Date(endDate as string)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build ORDER BY
    const orderByColumn = platformActivities[sortBy as keyof typeof platformActivities] || platformActivities.activityDate;
    const orderByClause = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

    // Fetch activities
    const activities = await db.query.platformActivities.findMany({
      where: whereClause,
      orderBy: [orderByClause],
      limit: limitNum,
      offset: offset,
    });

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformActivities)
      .where(whereClause || sql`true`);

    const totalCount = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      activities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords: totalCount,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      error: 'Failed to fetch activities',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/platform-activities/stats
 * Get activity statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { businessRecordId, createdBy, startDate, endDate } = req.query;

    // Build WHERE clause
    const conditions: SQL[] = [];

    if (businessRecordId) {
      conditions.push(eq(platformActivities.businessRecordId, businessRecordId as string));
    }

    if (createdBy) {
      conditions.push(eq(platformActivities.createdBy, createdBy as string));
    }

    if (startDate) {
      conditions.push(gte(platformActivities.activityDate, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(platformActivities.activityDate, new Date(endDate as string)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Activity counts by type
    const activityCounts = await db
      .select({
        activityType: platformActivities.activityType,
        count: sql<number>`count(*)`,
      })
      .from(platformActivities)
      .where(whereClause || sql`true`)
      .groupBy(platformActivities.activityType);

    // Call metrics
    const callMetrics = await db
      .select({
        totalCalls: sql<number>`count(*)`,
        avgDuration: sql<number>`avg(${platformActivities.callDuration})`,
        answeredCalls: sql<number>`count(*) filter (where ${platformActivities.callOutcome} = 'answered')`,
      })
      .from(platformActivities)
      .where(
        and(
          whereClause || sql`true`,
          eq(platformActivities.activityType, 'call')
        )!
      );

    // Email metrics
    const emailMetrics = await db
      .select({
        totalEmails: sql<number>`count(*)`,
        openedEmails: sql<number>`count(*) filter (where ${platformActivities.emailOpened} = true)`,
        clickedEmails: sql<number>`count(*) filter (where ${platformActivities.emailClicked} = true)`,
        repliedEmails: sql<number>`count(*) filter (where ${platformActivities.emailReplied} = true)`,
      })
      .from(platformActivities)
      .where(
        and(
          whereClause || sql`true`,
          eq(platformActivities.activityType, 'email')
        )!
      );

    // Meeting metrics
    const meetingMetrics = await db
      .select({
        totalMeetings: sql<number>`count(*)`,
        avgDuration: sql<number>`avg(${platformActivities.meetingDuration})`,
      })
      .from(platformActivities)
      .where(
        and(
          whereClause || sql`true`,
          eq(platformActivities.activityType, 'meeting')
        )!
      );

    res.json({
      activityCounts,
      callMetrics: callMetrics[0] || {},
      emailMetrics: emailMetrics[0] || {},
      meetingMetrics: meetingMetrics[0] || {},
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      error: 'Failed to fetch activity statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// DETAIL
// ============================================================================

/**
 * GET /api/platform-activities/:id
 * Get single activity
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activity = await db.query.platformActivities.findFirst({
      where: eq(platformActivities.id, id),
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Get related business record
    const businessRecord = activity.businessRecordId
      ? await db.query.platformBusinessRecords.findFirst({
          where: eq(platformBusinessRecords.id, activity.businessRecordId),
        })
      : null;

    // Get related deal
    const deal = activity.dealId
      ? await db.query.platformDeals.findFirst({
          where: eq(platformDeals.id, activity.dealId),
        })
      : null;

    res.json({
      activity,
      businessRecord,
      deal,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      error: 'Failed to fetch activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// CREATE
// ============================================================================

/**
 * POST /api/platform-activities
 * Create new activity
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: NewPlatformActivity = req.body;

    // Validate required fields
    if (!data.businessRecordId) {
      return res.status(400).json({ error: 'businessRecordId is required' });
    }

    if (!data.activityType) {
      return res.status(400).json({ error: 'activityType is required' });
    }

    // Set created by if not provided
    if (!data.createdBy) {
      data.createdBy = req.user?.id || 'system';
    }

    // Set activity date if not provided
    if (!data.activityDate) {
      data.activityDate = new Date();
    }

    // Create activity
    const [newActivity] = await db
      .insert(platformActivities)
      .values(data)
      .returning();

    // Update business record's last contact date and activity counts
    await db
      .update(platformBusinessRecords)
      .set({
        lastContactDate: newActivity.activityDate,
        totalActivities: sql`${platformBusinessRecords.totalActivities} + 1`,
        totalCalls: data.activityType === 'call'
          ? sql`${platformBusinessRecords.totalCalls} + 1`
          : platformBusinessRecords.totalCalls,
        totalEmails: data.activityType === 'email'
          ? sql`${platformBusinessRecords.totalEmails} + 1`
          : platformBusinessRecords.totalEmails,
        totalMeetings: data.activityType === 'meeting'
          ? sql`${platformBusinessRecords.totalMeetings} + 1`
          : platformBusinessRecords.totalMeetings,
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, data.businessRecordId));

    res.status(201).json(newActivity);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      error: 'Failed to create activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/platform-activities/log-call
 * Quick log a call activity
 */
router.post('/log-call', async (req: Request, res: Response) => {
  try {
    const {
      businessRecordId,
      dealId,
      contactId,
      callOutcome,
      callDuration,
      subject,
      description,
      callDisposition,
      nextSteps,
    } = req.body;

    if (!businessRecordId) {
      return res.status(400).json({ error: 'businessRecordId is required' });
    }

    const [activity] = await db
      .insert(platformActivities)
      .values({
        businessRecordId,
        dealId,
        contactId,
        activityType: 'call',
        subject: subject || 'Phone call',
        description,
        activityDate: new Date(),
        callOutcome,
        callDuration,
        callDisposition,
        nextSteps,
        createdBy: req.user?.id || 'system',
      })
      .returning();

    // Update business record
    await db
      .update(platformBusinessRecords)
      .set({
        lastContactDate: new Date(),
        totalActivities: sql`${platformBusinessRecords.totalActivities} + 1`,
        totalCalls: sql`${platformBusinessRecords.totalCalls} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, businessRecordId));

    res.status(201).json(activity);
  } catch (error) {
    console.error('Error logging call:', error);
    res.status(500).json({
      error: 'Failed to log call',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/platform-activities/log-email
 * Quick log an email activity
 */
router.post('/log-email', async (req: Request, res: Response) => {
  try {
    const {
      businessRecordId,
      dealId,
      contactId,
      emailFrom,
      emailTo,
      emailSubject,
      emailBody,
      emailOpened,
      emailClicked,
      emailReplied,
    } = req.body;

    if (!businessRecordId) {
      return res.status(400).json({ error: 'businessRecordId is required' });
    }

    const [activity] = await db
      .insert(platformActivities)
      .values({
        businessRecordId,
        dealId,
        contactId,
        activityType: 'email',
        subject: emailSubject || 'Email sent',
        activityDate: new Date(),
        emailFrom,
        emailTo,
        emailSubject,
        emailBody,
        emailOpened,
        emailClicked,
        emailReplied,
        createdBy: req.user?.id || 'system',
      })
      .returning();

    // Update business record
    await db
      .update(platformBusinessRecords)
      .set({
        lastContactDate: new Date(),
        totalActivities: sql`${platformBusinessRecords.totalActivities} + 1`,
        totalEmails: sql`${platformBusinessRecords.totalEmails} + 1`,
        emailsOpened: emailOpened
          ? sql`${platformBusinessRecords.emailsOpened} + 1`
          : platformBusinessRecords.emailsOpened,
        emailsClicked: emailClicked
          ? sql`${platformBusinessRecords.emailsClicked} + 1`
          : platformBusinessRecords.emailsClicked,
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, businessRecordId));

    res.status(201).json(activity);
  } catch (error) {
    console.error('Error logging email:', error);
    res.status(500).json({
      error: 'Failed to log email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/platform-activities/log-meeting
 * Quick log a meeting activity
 */
router.post('/log-meeting', async (req: Request, res: Response) => {
  try {
    const {
      businessRecordId,
      dealId,
      contactId,
      subject,
      meetingDate,
      meetingDuration,
      meetingType,
      meetingAttendees,
      meetingNotes,
      meetingOutcome,
      nextSteps,
    } = req.body;

    if (!businessRecordId) {
      return res.status(400).json({ error: 'businessRecordId is required' });
    }

    const [activity] = await db
      .insert(platformActivities)
      .values({
        businessRecordId,
        dealId,
        contactId,
        activityType: 'meeting',
        subject: subject || 'Meeting',
        activityDate: new Date(),
        meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
        meetingDuration,
        meetingType,
        meetingAttendees,
        meetingNotes,
        meetingOutcome,
        nextSteps,
        createdBy: req.user?.id || 'system',
      })
      .returning();

    // Update business record
    await db
      .update(platformBusinessRecords)
      .set({
        lastContactDate: new Date(),
        totalActivities: sql`${platformBusinessRecords.totalActivities} + 1`,
        totalMeetings: sql`${platformBusinessRecords.totalMeetings} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, businessRecordId));

    res.status(201).json(activity);
  } catch (error) {
    console.error('Error logging meeting:', error);
    res.status(500).json({
      error: 'Failed to log meeting',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/platform-activities/log-demo
 * Quick log a demo activity
 */
router.post('/log-demo', async (req: Request, res: Response) => {
  try {
    const {
      businessRecordId,
      dealId,
      contactId,
      subject,
      demoType,
      featuresShown,
      demoFeedback,
      nextSteps,
    } = req.body;

    if (!businessRecordId) {
      return res.status(400).json({ error: 'businessRecordId is required' });
    }

    const [activity] = await db
      .insert(platformActivities)
      .values({
        businessRecordId,
        dealId,
        contactId,
        activityType: 'demo',
        subject: subject || 'Product demo',
        activityDate: new Date(),
        demoType,
        featuresShown,
        demoFeedback,
        nextSteps,
        createdBy: req.user?.id || 'system',
      })
      .returning();

    // Update business record - increment demos completed
    await db
      .update(platformBusinessRecords)
      .set({
        lastContactDate: new Date(),
        totalActivities: sql`${platformBusinessRecords.totalActivities} + 1`,
        demosCompleted: sql`${platformBusinessRecords.demosCompleted} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, businessRecordId));

    res.status(201).json(activity);
  } catch (error) {
    console.error('Error logging demo:', error);
    res.status(500).json({
      error: 'Failed to log demo',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// UPDATE
// ============================================================================

/**
 * PATCH /api/platform-activities/:id
 * Update activity
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [updatedActivity] = await db
      .update(platformActivities)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(platformActivities.id, id))
      .returning();

    if (!updatedActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(updatedActivity);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({
      error: 'Failed to update activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/platform-activities/:id/complete-task
 * Mark task as completed
 */
router.patch('/:id/complete-task', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [completedTask] = await db
      .update(platformActivities)
      .set({
        taskCompleted: true,
        taskCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(platformActivities.id, id),
          eq(platformActivities.activityType, 'task')
        )!
      )
      .returning();

    if (!completedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(completedTask);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({
      error: 'Failed to complete task',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// DELETE
// ============================================================================

/**
 * DELETE /api/platform-activities/:id
 * Delete activity
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deletedActivity] = await db
      .delete(platformActivities)
      .where(eq(platformActivities.id, id))
      .returning();

    if (!deletedActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ message: 'Activity deleted successfully', activity: deletedActivity });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      error: 'Failed to delete activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
