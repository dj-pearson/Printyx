/**
 * Knowledge Base Admin API Routes
 * Advanced admin operations for knowledge base management
 *
 * RBAC Requirements:
 * - Root Admin (Level 7+): Full access including bulk delete, import/export
 * - System Admin (Level 5+): Dashboard, feedback, AI queue, analytics
 * - Manager (Level 3+): View-only analytics
 */

import { Router, Request, Response } from 'express';
import KnowledgeBaseService from '../services/knowledge-base-service';
import { db } from '../db';
import { eq, and, sql, desc, gte, lte, inArray } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('knowledge-base-admin-routes');

import {
  knowledgeArticles,
  knowledgeCategories,
  articleFeedback,
  aiContentGenerationQueue,
  articleVersions,
  articleViews,
  articleRatings,
  articleVotes,
} from '@shared/schema';
import { z } from 'zod';
import { requireRootAdmin } from '../routes-root-admin';
import { requireRole } from '../rbac-middleware';
// Auth helpers for Supabase JWT + session fallback
import { getUserId, isAuthenticated as checkAuthenticated } from '../utils/auth-helpers';

const router = Router();

// Middleware: Require System Admin (Level 5+) for most admin operations
const requireSystemAdmin = requireRole(5);

// Middleware: Require Manager (Level 3+) for read-only operations
const requireManager = requireRole(3);

// Authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!checkAuthenticated(req)) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

/**
 * GET /api/admin/knowledge-base/dashboard
 * Get admin dashboard statistics
 * RBAC: System Admin (Level 5+)
 */
router.get('/dashboard', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { days = 30 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Number(days));

    // Get article statistics
    const articleStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where status = 'published')::int`,
        draft: sql<number>`count(*) filter (where status = 'draft')::int`,
        review: sql<number>`count(*) filter (where status = 'review')::int`,
        aiGenerated: sql<number>`count(*) filter (where ai_generated = true)::int`,
      })
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.tenantId, tenantId));

    // Get view statistics
    const viewStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where viewed_at >= ${cutoffDate})::int`,
        avgTimeSpent: sql<number>`avg(time_spent_seconds)::int`,
        completionRate: sql<number>`avg(case when completed_reading then 1.0 else 0.0 end)::numeric`,
      })
      .from(articleViews)
      .where(eq(articleViews.tenantId, tenantId));

    // Get feedback statistics
    const feedbackStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where resolved = false)::int`,
        avgSentiment: sql<number>`avg(ai_sentiment_score)::numeric`,
      })
      .from(articleFeedback)
      .where(eq(articleFeedback.tenantId, tenantId));

    // Get AI generation queue stats
    const aiQueueStats = await db
      .select({
        pending: sql<number>`count(*) filter (where status = 'pending')::int`,
        generating: sql<number>`count(*) filter (where status = 'generating')::int`,
        completed: sql<number>`count(*) filter (where status = 'completed')::int`,
        failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      })
      .from(aiContentGenerationQueue)
      .where(eq(aiContentGenerationQueue.tenantId, tenantId));

    // Get top performing articles
    const topArticles = await db.query.knowledgeArticles.findMany({
      where: and(
        eq(knowledgeArticles.tenantId, tenantId),
        eq(knowledgeArticles.status, 'published'),
      ),
      orderBy: [desc(knowledgeArticles.viewCount)],
      limit: 10,
    });

    // Get articles needing review
    const needsReview = await db.query.knowledgeArticles.findMany({
      where: and(eq(knowledgeArticles.tenantId, tenantId), eq(knowledgeArticles.status, 'review')),
      limit: 10,
    });

    res.json({
      success: true,
      data: {
        articles: articleStats[0],
        views: viewStats[0],
        feedback: feedbackStats[0],
        aiQueue: aiQueueStats[0],
        topArticles,
        needsReview,
      },
    });
  } catch (error: any) {
    log.error('Failed to get admin dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/knowledge-base/articles/bulk-update
 * Bulk update article status, categories, tags, etc.
 * RBAC: System Admin (Level 5+)
 */
router.post('/articles/bulk-update', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId || 'demo-user';

    const schema = z.object({
      articleIds: z.array(z.string().uuid()),
      updates: z.object({
        status: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        tags: z.array(z.string()).optional(),
        featured: z.boolean().optional(),
        isPublic: z.boolean().optional(),
      }),
    });

    const { articleIds, updates } = schema.parse(req.body);

    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
      ...updates,
    };

    if (updates.tags) {
      updateData.tags = updates.tags;
    }

    // Perform bulk update
    const result = await db
      .update(knowledgeArticles)
      .set(updateData)
      .where(
        and(eq(knowledgeArticles.tenantId, tenantId), inArray(knowledgeArticles.id, articleIds)),
      )
      .returning();

    res.json({
      success: true,
      data: {
        updated: result.length,
        articles: result,
      },
    });
  } catch (error: any) {
    log.error('Bulk update failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/admin/knowledge-base/articles/bulk-delete
 * Bulk delete articles
 * RBAC: Root Admin (Level 7+) - Destructive operation
 */
router.delete('/articles/bulk-delete', requireRootAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';

    const schema = z.object({
      articleIds: z.array(z.string().uuid()),
    });

    const { articleIds } = schema.parse(req.body);

    // Delete related records first
    await db
      .delete(articleViews)
      .where(and(eq(articleViews.tenantId, tenantId), inArray(articleViews.articleId, articleIds)));

    await db
      .delete(articleFeedback)
      .where(
        and(eq(articleFeedback.tenantId, tenantId), inArray(articleFeedback.articleId, articleIds)),
      );

    await db
      .delete(articleVersions)
      .where(
        and(eq(articleVersions.tenantId, tenantId), inArray(articleVersions.articleId, articleIds)),
      );

    // Delete articles
    const deleted = await db
      .delete(knowledgeArticles)
      .where(
        and(eq(knowledgeArticles.tenantId, tenantId), inArray(knowledgeArticles.id, articleIds)),
      )
      .returning();

    res.json({
      success: true,
      data: {
        deleted: deleted.length,
      },
    });
  } catch (error: any) {
    log.error('Bulk delete failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/knowledge-base/feedback/pending
 * Get pending feedback that needs review
 * RBAC: System Admin (Level 5+)
 */
router.get('/feedback/pending', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { limit = 50, offset = 0 } = req.query;

    const feedback = await db.query.articleFeedback.findMany({
      where: and(eq(articleFeedback.tenantId, tenantId), eq(articleFeedback.resolved, false)),
      limit: Number(limit),
      offset: Number(offset),
      orderBy: [desc(articleFeedback.createdAt)],
    });

    // Get associated articles
    const articlesMap = new Map();
    for (const fb of feedback) {
      if (!articlesMap.has(fb.articleId)) {
        const article = await db.query.knowledgeArticles.findFirst({
          where: eq(knowledgeArticles.id, fb.articleId),
        });
        if (article) {
          articlesMap.set(fb.articleId, article);
        }
      }
    }

    const feedbackWithArticles = feedback.map((fb) => ({
      ...fb,
      article: articlesMap.get(fb.articleId),
    }));

    res.json({
      success: true,
      data: feedbackWithArticles,
    });
  } catch (error: any) {
    log.error('Failed to get pending feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/admin/knowledge-base/feedback/:id/resolve
 * Resolve article feedback
 * RBAC: System Admin (Level 5+)
 */
router.put('/feedback/:id/resolve', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId || 'demo-user';
    const { id } = req.params;

    const schema = z.object({
      resolutionNotes: z.string().optional(),
    });

    const { resolutionNotes } = schema.parse(req.body);

    const [updated] = await db
      .update(articleFeedback)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNotes,
      })
      .where(and(eq(articleFeedback.id, id), eq(articleFeedback.tenantId, tenantId)))
      .returning();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    log.error('Failed to resolve feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/knowledge-base/ai-queue
 * Get AI content generation queue
 * RBAC: System Admin (Level 5+)
 */
router.get('/ai-queue', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { status, limit = 50 } = req.query;

    const conditions = [eq(aiContentGenerationQueue.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(aiContentGenerationQueue.status, status as any));
    }

    const queue = await db.query.aiContentGenerationQueue.findMany({
      where: and(...conditions),
      limit: Number(limit),
      orderBy: [desc(aiContentGenerationQueue.createdAt)],
    });

    res.json({
      success: true,
      data: queue,
    });
  } catch (error: any) {
    log.error('Failed to get AI queue:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/knowledge-base/ai-queue/:id/retry
 * Retry failed AI generation
 * RBAC: System Admin (Level 5+)
 */
router.post('/ai-queue/:id/retry', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { id } = req.params;

    const [updated] = await db
      .update(aiContentGenerationQueue)
      .set({
        status: 'pending',
        errorMessage: null,
      })
      .where(
        and(eq(aiContentGenerationQueue.id, id), eq(aiContentGenerationQueue.tenantId, tenantId)),
      )
      .returning();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    log.error('Failed to retry AI generation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/knowledge-base/articles/:id/versions
 * Get version history for an article
 * RBAC: System Admin (Level 5+)
 */
router.get('/articles/:id/versions', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { id } = req.params;

    const versions = await db.query.articleVersions.findMany({
      where: and(eq(articleVersions.articleId, id), eq(articleVersions.tenantId, tenantId)),
      orderBy: [desc(articleVersions.version)],
    });

    res.json({
      success: true,
      data: versions,
    });
  } catch (error: any) {
    log.error('Failed to get article versions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/knowledge-base/articles/:id/restore-version
 * Restore a previous version of an article
 * RBAC: System Admin (Level 5+)
 */
router.post(
  '/articles/:id/restore-version',
  requireSystemAdmin,
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || 'demo-tenant';
      const userId = (req as any).userId || 'demo-user';
      const { id } = req.params;

      const schema = z.object({
        version: z.number().int().positive(),
      });

      const { version } = schema.parse(req.body);

      // Get the version to restore
      const versionToRestore = await db.query.articleVersions.findFirst({
        where: and(
          eq(articleVersions.articleId, id),
          eq(articleVersions.tenantId, tenantId),
          eq(articleVersions.version, version),
        ),
      });

      if (!versionToRestore) {
        return res.status(404).json({
          success: false,
          error: 'Version not found',
        });
      }

      // Update article with restored content
      const article = await KnowledgeBaseService.updateArticle(id, tenantId, userId, {
        title: versionToRestore.title,
        content: versionToRestore.content as any,
      });

      res.json({
        success: true,
        data: article,
        message: `Restored to version ${version}`,
      });
    } catch (error: any) {
      log.error('Failed to restore version:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/admin/knowledge-base/import
 * Import articles from JSON/CSV
 * RBAC: Root Admin (Level 7+) - Can modify multiple articles
 */
router.post('/import', requireRootAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId || 'demo-user';

    const schema = z.object({
      format: z.enum(['json', 'csv', 'markdown']),
      data: z.any(),
      categoryId: z.string().uuid(),
      overwriteExisting: z.boolean().optional(),
    });

    const { format, data, categoryId, overwriteExisting } = schema.parse(req.body);

    const imported = [];
    const errors = [];

    // Parse based on format
    let articles = [];

    if (format === 'json') {
      articles = Array.isArray(data) ? data : [data];
    } else if (format === 'csv') {
      // CSV parsing would go here
      // articles = parseCSV(data);
    } else if (format === 'markdown') {
      // Markdown parsing would go here
      // articles = parseMarkdown(data);
    }

    // Import each article
    for (const articleData of articles) {
      try {
        const article = await KnowledgeBaseService.createArticle(tenantId, userId, {
          ...articleData,
          categoryId,
        });
        imported.push(article);
      } catch (error: any) {
        errors.push({
          article: articleData.title || 'Unknown',
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      data: {
        imported: imported.length,
        failed: errors.length,
        articles: imported,
        errors,
      },
    });
  } catch (error: any) {
    log.error('Import failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/knowledge-base/export
 * Export articles to JSON/CSV
 * RBAC: Root Admin (Level 7+) - Contains sensitive data
 */
router.get('/export', requireRootAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { format = 'json', categoryId, status } = req.query;

    const conditions = [eq(knowledgeArticles.tenantId, tenantId)];

    if (categoryId) {
      conditions.push(eq(knowledgeArticles.categoryId, categoryId as string));
    }

    if (status) {
      conditions.push(eq(knowledgeArticles.status, status as any));
    }

    const articles = await db.query.knowledgeArticles.findMany({
      where: and(...conditions),
    });

    if (format === 'json') {
      res.json({
        success: true,
        data: articles,
      });
    } else if (format === 'csv') {
      // CSV export would go here
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=articles.csv');

      // Simple CSV generation
      const headers = ['ID', 'Title', 'Status', 'Category', 'Created', 'Views'];
      const rows = articles.map((a) => [
        a.id,
        a.title,
        a.status,
        a.categoryId,
        a.createdAt,
        a.viewCount,
      ]);

      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      res.send(csv);
    }
  } catch (error: any) {
    log.error('Export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/knowledge-base/analytics/detailed
 * Get detailed analytics
 * RBAC: Manager (Level 3+) - Read-only analytics access
 */
router.get('/analytics/detailed', requireManager, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get view trends
    const viewTrends = await db
      .select({
        date: sql<string>`date_trunc(${groupBy}, ${articleViews.viewedAt})`,
        views: sql<number>`count(*)::int`,
        uniqueUsers: sql<number>`count(distinct ${articleViews.userId})::int`,
        avgTimeSpent: sql<number>`avg(${articleViews.timeSpentSeconds})::int`,
      })
      .from(articleViews)
      .where(
        and(
          eq(articleViews.tenantId, tenantId),
          gte(articleViews.viewedAt, start),
          lte(articleViews.viewedAt, end),
        ),
      )
      .groupBy(sql`date_trunc(${groupBy}, ${articleViews.viewedAt})`)
      .orderBy(sql`date_trunc(${groupBy}, ${articleViews.viewedAt})`);

    // Get category performance
    const categoryPerformance = await db
      .select({
        categoryId: knowledgeArticles.categoryId,
        articles: sql<number>`count(*)::int`,
        totalViews: sql<number>`sum(${knowledgeArticles.viewCount})::int`,
        avgRating: sql<number>`avg(${knowledgeArticles.averageRating})::numeric`,
      })
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.tenantId, tenantId))
      .groupBy(knowledgeArticles.categoryId);

    // Get search query trends
    const searchTrends = await db.query.knowledgeSearchQueries.findMany({
      where: and(
        eq(knowledgeArticles.tenantId, tenantId),
        gte(articleViews.createdAt, start),
        lte(articleViews.createdAt, end),
      ),
      orderBy: [desc(articleViews.createdAt)],
      limit: 100,
    });

    res.json({
      success: true,
      data: {
        viewTrends,
        categoryPerformance,
        searchTrends,
      },
    });
  } catch (error: any) {
    log.error('Failed to get detailed analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/knowledge-base/categories/reorder
 * Reorder categories
 * RBAC: System Admin (Level 5+)
 */
router.post('/categories/reorder', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';

    const schema = z.object({
      categoryOrders: z.array(
        z.object({
          id: z.string().uuid(),
          order: z.number().int(),
        }),
      ),
    });

    const { categoryOrders } = schema.parse(req.body);

    // Update each category order
    for (const { id, order } of categoryOrders) {
      await db
        .update(knowledgeCategories)
        .set({ categoryOrder: order })
        .where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenantId, tenantId)));
    }

    res.json({
      success: true,
      message: 'Categories reordered successfully',
    });
  } catch (error: any) {
    log.error('Failed to reorder categories:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
