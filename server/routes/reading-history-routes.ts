/**
 * Reading History API Routes
 *
 * Endpoints for tracking article reading progress, completion, and statistics
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { readingHistory, knowledgeArticles } from '../../shared/knowledge-base-schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

const router = Router();

// Middleware to require authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session || !req.session.user_id) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Helper to get tenant ID
const getTenantId = (req: Request): string => {
  return (
    (req as any).tenant_id ||
    (req.session as any).tenant_id ||
    '00000000-0000-0000-0000-000000000000'
  );
};

// Helper to get user ID
const getUserId = (req: Request): string => {
  return req.session?.user_id || (req.session as any).user?.id || '';
};

/**
 * GET /api/knowledge-base/reading-history
 * Get reading history for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { completed, limit = 50, offset = 0 } = req.query;

    let whereConditions = and(
      eq(readingHistory.tenant_id, tenantId),
      eq(readingHistory.user_id, userId),
    );

    // Filter by completion status if specified
    if (completed !== undefined) {
      const isCompleted = completed === 'true' || completed === '1';
      whereConditions = and(whereConditions, eq(readingHistory.completed, isCompleted));
    }

    const history = await db
      .select({
        history: readingHistory,
        article: {
          id: knowledgeArticles.id,
          title: knowledgeArticles.title,
          slug: knowledgeArticles.slug,
          excerpt: knowledgeArticles.excerpt,
          categoryId: knowledgeArticles.categoryId,
          estimatedReadingTime: knowledgeArticles.estimatedReadingTime,
          featuredImage: knowledgeArticles.featuredImage,
        },
      })
      .from(readingHistory)
      .innerJoin(knowledgeArticles, eq(readingHistory.articleId, knowledgeArticles.id))
      .where(whereConditions)
      .orderBy(desc(readingHistory.lastViewedAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(readingHistory)
      .where(whereConditions);

    res.json({
      success: true,
      history: history.map((h) => ({
        ...h.history,
        article: h.article,
      })),
      total: count,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error('Error fetching reading history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reading history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/knowledge-base/reading-history
 * Update or create reading progress for an article
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const {
      articleId,
      scrollPosition,
      readingProgress,
      currentSectionId,
      completed,
      lastReadDuration,
    } = req.body;

    if (!articleId) {
      return res.status(400).json({
        success: false,
        message: 'Article ID is required',
      });
    }

    // Check if history record exists
    const existing = await db
      .select()
      .from(readingHistory)
      .where(and(eq(readingHistory.user_id, userId), eq(readingHistory.articleId, articleId)))
      .limit(1);

    let result;

    if (existing.length > 0) {
      // Update existing record
      const record = existing[0];

      const [updated] = await db
        .update(readingHistory)
        .set({
          scrollPosition: scrollPosition !== undefined ? scrollPosition : record.scrollPosition,
          readingProgress: readingProgress !== undefined ? readingProgress : record.readingProgress,
          currentSectionId:
            currentSectionId !== undefined ? currentSectionId : record.currentSectionId,
          completed: completed !== undefined ? completed : record.completed,
          totalTimeSeconds: record.totalTimeSeconds + (lastReadDuration || 0),
          lastReadDuration:
            lastReadDuration !== undefined ? lastReadDuration : record.lastReadDuration,
          lastViewedAt: new Date(),
          completedAt: completed && !record.completed ? new Date() : record.completedAt,
        })
        .where(eq(readingHistory.id, record.id))
        .returning();

      result = updated;
    } else {
      // Create new record
      const [created] = await db
        .insert(readingHistory)
        .values({
          tenantId,
          userId,
          articleId,
          scrollPosition: scrollPosition || 0,
          readingProgress: readingProgress || 0,
          currentSectionId: currentSectionId || null,
          completed: completed || false,
          totalTimeSeconds: lastReadDuration || 0,
          lastReadDuration: lastReadDuration || 0,
          completedAt: completed ? new Date() : null,
        })
        .returning();

      result = created;
    }

    res.json({
      success: true,
      message: 'Reading progress updated successfully',
      history: result,
    });
  } catch (error) {
    console.error('Error updating reading history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reading history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge-base/reading-history/recent
 * Get recently read articles (last 7 days)
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { limit = 10 } = req.query;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recent = await db
      .select({
        history: readingHistory,
        article: {
          id: knowledgeArticles.id,
          title: knowledgeArticles.title,
          slug: knowledgeArticles.slug,
          excerpt: knowledgeArticles.excerpt,
          categoryId: knowledgeArticles.categoryId,
          estimatedReadingTime: knowledgeArticles.estimatedReadingTime,
          featuredImage: knowledgeArticles.featuredImage,
        },
      })
      .from(readingHistory)
      .innerJoin(knowledgeArticles, eq(readingHistory.articleId, knowledgeArticles.id))
      .where(
        and(
          eq(readingHistory.tenant_id, tenantId),
          eq(readingHistory.user_id, userId),
          gte(readingHistory.lastViewedAt, sevenDaysAgo),
        ),
      )
      .orderBy(desc(readingHistory.lastViewedAt))
      .limit(Number(limit));

    res.json({
      success: true,
      articles: recent.map((r) => ({
        ...r.history,
        article: r.article,
      })),
    });
  } catch (error) {
    console.error('Error fetching recent articles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent articles',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge-base/reading-history/stats
 * Get reading statistics for the current user
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    // Get overall stats
    const [stats] = await db
      .select({
        totalArticlesRead: sql<number>`count(*)`,
        completedArticles: sql<number>`count(*) filter (where ${readingHistory.completed} = true)`,
        inProgressArticles: sql<number>`count(*) filter (where ${readingHistory.completed} = false)`,
        totalReadingTimeSeconds: sql<number>`sum(${readingHistory.totalTimeSeconds})`,
        averageProgress: sql<number>`avg(${readingHistory.readingProgress})`,
      })
      .from(readingHistory)
      .where(and(eq(readingHistory.tenant_id, tenantId), eq(readingHistory.user_id, userId)));

    // Get reading streak (consecutive days with reading activity)
    const recentActivity = await db
      .select({
        date: sql<string>`DATE(${readingHistory.lastViewedAt})`,
      })
      .from(readingHistory)
      .where(and(eq(readingHistory.tenant_id, tenantId), eq(readingHistory.user_id, userId)))
      .groupBy(sql`DATE(${readingHistory.lastViewedAt})`)
      .orderBy(desc(sql`DATE(${readingHistory.lastViewedAt})`))
      .limit(30);

    // Calculate streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < recentActivity.length; i++) {
      const activityDate = new Date(recentActivity[i].date);
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      expectedDate.setHours(0, 0, 0, 0);

      if (activityDate.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Get this week's stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [weekStats] = await db
      .select({
        articlesThisWeek: sql<number>`count(*)`,
        completedThisWeek: sql<number>`count(*) filter (where ${readingHistory.completed} = true)`,
        readingTimeThisWeek: sql<number>`sum(${readingHistory.totalTimeSeconds})`,
      })
      .from(readingHistory)
      .where(
        and(
          eq(readingHistory.tenant_id, tenantId),
          eq(readingHistory.user_id, userId),
          gte(readingHistory.lastViewedAt, weekAgo),
        ),
      );

    res.json({
      success: true,
      stats: {
        overall: {
          totalArticlesRead: stats.totalArticlesRead || 0,
          completedArticles: stats.completedArticles || 0,
          inProgressArticles: stats.inProgressArticles || 0,
          totalReadingTimeMinutes: Math.round((stats.totalReadingTimeSeconds || 0) / 60),
          averageProgress: Math.round(stats.averageProgress || 0),
        },
        thisWeek: {
          articlesRead: weekStats.articlesThisWeek || 0,
          completed: weekStats.completedThisWeek || 0,
          readingTimeMinutes: Math.round((weekStats.readingTimeThisWeek || 0) / 60),
        },
        streak: {
          currentStreak,
          unit: 'days',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching reading stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reading statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge-base/reading-history/:articleId
 * Get reading progress for a specific article
 */
router.get('/:articleId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { articleId } = req.params;

    const history = await db
      .select()
      .from(readingHistory)
      .where(and(eq(readingHistory.user_id, userId), eq(readingHistory.articleId, articleId)))
      .limit(1);

    res.json({
      success: true,
      history: history[0] || null,
      exists: history.length > 0,
    });
  } catch (error) {
    console.error('Error fetching article reading history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reading history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/knowledge-base/reading-history/:articleId
 * Clear reading history for a specific article
 */
router.delete('/:articleId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { articleId } = req.params;

    await db
      .delete(readingHistory)
      .where(and(eq(readingHistory.user_id, userId), eq(readingHistory.articleId, articleId)));

    res.json({
      success: true,
      message: 'Reading history cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing reading history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear reading history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
