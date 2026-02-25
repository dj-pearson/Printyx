/**
 * PLATFORM DEALS API ROUTES
 *
 * Manages the sales pipeline for platform-level tenant acquisition.
 * Tracks deals through a 9-stage pipeline from prospecting to closed won/lost.
 *
 * Features:
 * - Full CRUD operations for deals
 * - Pipeline stage management
 * - Deal movement tracking
 * - Win/loss analysis
 * - Forecasting
 * - Performance metrics
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-platform-deals');

import {
  platformDeals,
  platformBusinessRecords,
  platformActivities,
  type PlatformDeal,
  type NewPlatformDeal,
} from '@shared/schema';
import { eq, and, or, inArray, gte, lte, desc, asc, sql, SQL } from 'drizzle-orm';
import { requireRootAdmin } from './routes-root-admin';

import { getUserId, getTenantId } from './utils/auth-helpers';
const router = Router();

// All routes require root admin access
router.use(requireRootAdmin);

// ============================================================================
// PIPELINE STAGES CONFIGURATION
// ============================================================================

const PIPELINE_STAGES = [
  { stage: 'prospecting', order: 1, probability: 10, category: 'pipeline' },
  { stage: 'qualification', order: 2, probability: 20, category: 'pipeline' },
  { stage: 'demo_scheduled', order: 3, probability: 30, category: 'best_case' },
  { stage: 'demo_completed', order: 4, probability: 40, category: 'best_case' },
  { stage: 'trial_started', order: 5, probability: 60, category: 'committed' },
  { stage: 'proposal', order: 6, probability: 75, category: 'committed' },
  { stage: 'negotiation', order: 7, probability: 90, category: 'committed' },
  { stage: 'closed_won', order: 8, probability: 100, category: 'closed' },
  { stage: 'closed_lost', order: 9, probability: 0, category: 'closed' },
];

/**
 * GET /api/platform-deals/pipeline-stages
 * Get pipeline stage configuration
 */
router.get('/pipeline-stages', async (req: Request, res: Response) => {
  res.json({ stages: PIPELINE_STAGES });
});

// ============================================================================
// LIST & FILTER
// ============================================================================

/**
 * GET /api/platform-deals
 * List deals with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      stage,
      status,
      ownerId,
      businessRecordId,
      forecastCategory,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions: SQL[] = [];

    if (stage) {
      const stages = Array.isArray(stage) ? stage : [stage];
      conditions.push(inArray(platformDeals.stage, stages as any));
    }

    if (status) {
      conditions.push(eq(platformDeals.status, status as any));
    }

    if (ownerId) {
      conditions.push(eq(platformDeals.ownerId, ownerId as string));
    }

    if (businessRecordId) {
      conditions.push(eq(platformDeals.businessRecordId, businessRecordId as string));
    }

    if (forecastCategory) {
      conditions.push(eq(platformDeals.forecastCategory, forecastCategory as string));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build ORDER BY
    const orderByColumn =
      platformDeals[sortBy as keyof typeof platformDeals] || platformDeals.createdAt;
    const orderByClause = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

    // Fetch deals with business record info
    const deals = await db.query.platformDeals.findMany({
      where: whereClause,
      orderBy: [orderByClause],
      limit: limitNum,
      offset: offset,
      with: {
        // We'll need to add this relation in the schema if not present
      },
    });

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformDeals)
      .where(whereClause || sql`true`);

    const totalCount = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      deals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords: totalCount,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    });
  } catch (error) {
    log.error('Error fetching deals:', error);
    res.status(500).json({
      error: 'Failed to fetch deals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/platform-deals/pipeline
 * Get pipeline view with deals grouped by stage
 */
router.get('/pipeline', async (req: Request, res: Response) => {
  try {
    const { ownerId, status = 'open' } = req.query;

    // Build WHERE clause
    const conditions: SQL[] = [eq(platformDeals.status, status as any)];
    if (ownerId) {
      conditions.push(eq(platformDeals.ownerId, ownerId as string));
    }

    const whereClause = and(...conditions);

    // Get deals by stage
    const dealsByStage = await db
      .select({
        stage: platformDeals.stage,
        count: sql<number>`count(*)`,
        totalValue: sql<number>`sum(${platformDeals.dealValue})`,
        weightedValue: sql<number>`sum(${platformDeals.weightedValue})`,
      })
      .from(platformDeals)
      .where(whereClause!)
      .groupBy(platformDeals.stage);

    // Get all deals for detailed view
    const allDeals = await db.query.platformDeals.findMany({
      where: whereClause,
      orderBy: [desc(platformDeals.expectedCloseDate)],
    });

    // Group deals by stage
    const pipeline = PIPELINE_STAGES.map((stageConfig) => {
      const stageStats = dealsByStage.find((d) => d.stage === stageConfig.stage);
      const stageDeals = allDeals.filter((d) => d.stage === stageConfig.stage);

      return {
        ...stageConfig,
        count: Number(stageStats?.count || 0),
        totalValue: Number(stageStats?.totalValue || 0),
        weightedValue: Number(stageStats?.weightedValue || 0),
        deals: stageDeals,
      };
    });

    // Calculate overall pipeline metrics
    const totalPipelineValue = dealsByStage.reduce(
      (sum, stage) => sum + Number(stage.totalValue),
      0,
    );
    const totalWeightedValue = dealsByStage.reduce(
      (sum, stage) => sum + Number(stage.weightedValue),
      0,
    );
    const totalDeals = dealsByStage.reduce((sum, stage) => sum + Number(stage.count), 0);

    res.json({
      pipeline,
      summary: {
        totalPipelineValue,
        totalWeightedValue,
        totalDeals,
      },
    });
  } catch (error) {
    log.error('Error fetching pipeline:', error);
    res.status(500).json({
      error: 'Failed to fetch pipeline',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/platform-deals/stats
 * Get deal statistics and metrics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { ownerId, period = 'month' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const conditions: SQL[] = [gte(platformDeals.createdAt, startDate)];
    if (ownerId) {
      conditions.push(eq(platformDeals.ownerId, ownerId as string));
    }

    // Win/Loss stats
    const winLossStats = await db
      .select({
        status: platformDeals.status,
        count: sql<number>`count(*)`,
        totalValue: sql<number>`sum(${platformDeals.dealValue})`,
        avgDealSize: sql<number>`avg(${platformDeals.dealValue})`,
      })
      .from(platformDeals)
      .where(and(...conditions)!)
      .groupBy(platformDeals.status);

    // Calculate win rate
    const wonDeals = winLossStats.find((s) => s.status === 'won');
    const lostDeals = winLossStats.find((s) => s.status === 'lost');
    const totalClosed = Number(wonDeals?.count || 0) + Number(lostDeals?.count || 0);
    const winRate = totalClosed > 0 ? (Number(wonDeals?.count || 0) / totalClosed) * 100 : 0;

    // Average sales cycle
    const closedDeals = await db.query.platformDeals.findMany({
      where: and(...conditions, inArray(platformDeals.status, ['won', 'lost']))!,
    });

    const salesCycleDays = closedDeals
      .filter((d) => d.actualCloseDate && d.createdAt)
      .map((d) => {
        const days = Math.floor(
          (d.actualCloseDate!.getTime() - d.createdAt!.getTime()) / (1000 * 60 * 60 * 24),
        );
        return days;
      });

    const avgSalesCycle =
      salesCycleDays.length > 0
        ? salesCycleDays.reduce((sum, days) => sum + days, 0) / salesCycleDays.length
        : 0;

    res.json({
      period,
      winLossStats,
      metrics: {
        winRate: Math.round(winRate * 10) / 10,
        totalARRBooked: Number(wonDeals?.totalValue || 0),
        avgDealSize: Number(wonDeals?.avgDealSize || 0),
        avgSalesCycle: Math.round(avgSalesCycle),
        dealsWon: Number(wonDeals?.count || 0),
        dealsLost: Number(lostDeals?.count || 0),
      },
    });
  } catch (error) {
    log.error('Error fetching deal stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// DETAIL
// ============================================================================

/**
 * GET /api/platform-deals/:id
 * Get single deal with related data
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deal = await db.query.platformDeals.findFirst({
      where: eq(platformDeals.id, id),
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get associated business record
    const businessRecord = deal.businessRecordId
      ? await db.query.platformBusinessRecords.findFirst({
          where: eq(platformBusinessRecords.id, deal.businessRecordId),
        })
      : null;

    // Get recent activities
    const activities = await db.query.platformActivities.findMany({
      where: eq(platformActivities.dealId, id),
      orderBy: [desc(platformActivities.activityDate)],
      limit: 20,
    });

    res.json({
      deal,
      businessRecord,
      activities,
    });
  } catch (error) {
    log.error('Error fetching deal:', error);
    res.status(500).json({
      error: 'Failed to fetch deal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// CREATE
// ============================================================================

/**
 * POST /api/platform-deals
 * Create new deal
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: NewPlatformDeal = req.body;

    // Set defaults
    if (!data.stage) {
      data.stage = 'prospecting';
    }

    if (!data.status) {
      data.status = 'open';
    }

    // Calculate weighted value
    if (data.dealValue && data.probability !== undefined) {
      data.weightedValue = (Number(data.dealValue) * data.probability) / 100;
    }

    // Set forecast category based on stage
    if (!data.forecastCategory) {
      const stageConfig = PIPELINE_STAGES.find((s) => s.stage === data.stage);
      data.forecastCategory = stageConfig?.category as any;
    }

    // Create deal
    const [newDeal] = await db.insert(platformDeals).values(data).returning();

    // Log creation activity
    if (newDeal.businessRecordId) {
      await db.insert(platformActivities).values({
        businessRecordId: newDeal.businessRecordId,
        dealId: newDeal.id,
        activityType: 'note',
        subject: 'Deal created',
        description: `New deal "${newDeal.dealName}" created (${newDeal.dealValue} ARR)`,
        activityDate: new Date(),
        createdBy: req.user?.id || 'system',
      });
    }

    res.status(201).json(newDeal);
  } catch (error) {
    log.error('Error creating deal:', error);
    res.status(500).json({
      error: 'Failed to create deal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// UPDATE
// ============================================================================

/**
 * PATCH /api/platform-deals/:id
 * Update deal
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get current deal
    const currentDeal = await db.query.platformDeals.findFirst({
      where: eq(platformDeals.id, id),
    });

    if (!currentDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Recalculate weighted value if deal value or probability changed
    if (updates.dealValue || updates.probability !== undefined) {
      const dealValue = updates.dealValue || currentDeal.dealValue;
      const probability =
        updates.probability !== undefined ? updates.probability : currentDeal.probability;
      updates.weightedValue = (Number(dealValue) * probability) / 100;
    }

    // Update forecast category if stage changed
    if (updates.stage && updates.stage !== currentDeal.stage) {
      const stageConfig = PIPELINE_STAGES.find((s) => s.stage === updates.stage);
      updates.forecastCategory = stageConfig?.category;
      updates.previousStage = currentDeal.stage;
    }

    // Update deal
    const [updatedDeal] = await db
      .update(platformDeals)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(platformDeals.id, id))
      .returning();

    // Log stage change
    if (updates.stage && updates.stage !== currentDeal.stage && currentDeal.businessRecordId) {
      await db.insert(platformActivities).values({
        businessRecordId: currentDeal.businessRecordId,
        dealId: id,
        activityType: 'note',
        subject: 'Deal stage changed',
        description: `Deal moved from ${currentDeal.stage} to ${updates.stage}`,
        activityDate: new Date(),
        createdBy: req.user?.id || 'system',
      });
    }

    res.json(updatedDeal);
  } catch (error) {
    log.error('Error updating deal:', error);
    res.status(500).json({
      error: 'Failed to update deal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/platform-deals/:id/move-stage
 * Move deal to a new stage
 */
router.post('/:id/move-stage', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stage, notes } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }

    // Get current deal
    const currentDeal = await db.query.platformDeals.findFirst({
      where: eq(platformDeals.id, id),
    });

    if (!currentDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get stage configuration
    const stageConfig = PIPELINE_STAGES.find((s) => s.stage === stage);
    if (!stageConfig) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    // Update deal
    const [updatedDeal] = await db
      .update(platformDeals)
      .set({
        stage: stage as any,
        previousStage: currentDeal.stage,
        probability: stageConfig.probability,
        forecastCategory: stageConfig.category as any,
        weightedValue: (Number(currentDeal.dealValue) * stageConfig.probability) / 100,
        updatedAt: new Date(),
      })
      .where(eq(platformDeals.id, id))
      .returning();

    // Log stage change
    if (currentDeal.businessRecordId) {
      await db.insert(platformActivities).values({
        businessRecordId: currentDeal.businessRecordId,
        dealId: id,
        activityType: 'note',
        subject: 'Deal stage changed',
        description: notes || `Deal moved from ${currentDeal.stage} to ${stage}`,
        activityDate: new Date(),
        createdBy: req.user?.id || 'system',
      });
    }

    res.json(updatedDeal);
  } catch (error) {
    log.error('Error moving deal stage:', error);
    res.status(500).json({
      error: 'Failed to move deal stage',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/platform-deals/:id/close-won
 * Mark deal as won
 */
router.post('/:id/close-won', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { winReason, actualCloseDate } = req.body;

    const [closedDeal] = await db
      .update(platformDeals)
      .set({
        stage: 'closed_won',
        status: 'won',
        winReason,
        actualCloseDate: actualCloseDate ? new Date(actualCloseDate) : new Date(),
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformDeals.id, id))
      .returning();

    if (!closedDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Log win
    if (closedDeal.businessRecordId) {
      await db.insert(platformActivities).values({
        businessRecordId: closedDeal.businessRecordId,
        dealId: id,
        activityType: 'note',
        subject: 'Deal won!',
        description: winReason || `Deal closed won at ${closedDeal.dealValue} ARR`,
        activityDate: new Date(),
        createdBy: req.user?.id || 'system',
        outcome: 'successful',
      });
    }

    res.json(closedDeal);
  } catch (error) {
    log.error('Error closing deal as won:', error);
    res.status(500).json({
      error: 'Failed to close deal as won',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/platform-deals/:id/close-lost
 * Mark deal as lost
 */
router.post('/:id/close-lost', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { lostReason, lostToCompetitor } = req.body;

    const [closedDeal] = await db
      .update(platformDeals)
      .set({
        stage: 'closed_lost',
        status: 'lost',
        lostReason,
        lostToCompetitor,
        actualCloseDate: new Date(),
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformDeals.id, id))
      .returning();

    if (!closedDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Log loss
    if (closedDeal.businessRecordId) {
      await db.insert(platformActivities).values({
        businessRecordId: closedDeal.businessRecordId,
        dealId: id,
        activityType: 'note',
        subject: 'Deal lost',
        description: lostReason || `Deal closed lost. Competitor: ${lostToCompetitor || 'Unknown'}`,
        activityDate: new Date(),
        createdBy: req.user?.id || 'system',
        outcome: 'unsuccessful',
      });
    }

    res.json(closedDeal);
  } catch (error) {
    log.error('Error closing deal as lost:', error);
    res.status(500).json({
      error: 'Failed to close deal as lost',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// DELETE
// ============================================================================

/**
 * DELETE /api/platform-deals/:id
 * Delete deal
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deletedDeal] = await db
      .delete(platformDeals)
      .where(eq(platformDeals.id, id))
      .returning();

    if (!deletedDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.json({ message: 'Deal deleted successfully', deal: deletedDeal });
  } catch (error) {
    log.error('Error deleting deal:', error);
    res.status(500).json({
      error: 'Failed to delete deal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
