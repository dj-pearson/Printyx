/**
 * Article Bookmarks API Routes
 *
 * Endpoints for managing user bookmarks, collections, and saved articles
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { articleBookmarks, knowledgeArticles } from '../../shared/knowledge-base-schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = Router();

// Middleware to require authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Helper to get tenant ID
const getTenantId = (req: Request): string => {
  return (
    (req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
  );
};

// Helper to get user ID
const getUserId = (req: Request): string => {
  return req.session?.userId || (req.session as any).user?.id || '';
};

/**
 * GET /api/knowledge-base/bookmarks
 * Get all bookmarks for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { collection, limit = 50, offset = 0 } = req.query;

    let query = db
      .select({
        bookmark: articleBookmarks,
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
      .from(articleBookmarks)
      .innerJoin(knowledgeArticles, eq(articleBookmarks.articleId, knowledgeArticles.id))
      .where(
        and(
          eq(articleBookmarks.tenantId, tenantId),
          eq(articleBookmarks.userId, userId)
        )
      )
      .orderBy(desc(articleBookmarks.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Filter by collection if specified
    if (collection && typeof collection === 'string') {
      query = query.where(
        and(
          eq(articleBookmarks.tenantId, tenantId),
          eq(articleBookmarks.userId, userId),
          eq(articleBookmarks.collectionName, collection)
        )
      );
    }

    const bookmarks = await query;

    // Get total count
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(articleBookmarks)
      .where(
        and(
          eq(articleBookmarks.tenantId, tenantId),
          eq(articleBookmarks.userId, userId),
          collection && typeof collection === 'string'
            ? eq(articleBookmarks.collectionName, collection)
            : sql`true`
        )
      );

    const [{ count }] = await countQuery;

    res.json({
      success: true,
      bookmarks: bookmarks.map(b => ({
        ...b.bookmark,
        article: b.article,
      })),
      total: count,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookmarks',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/knowledge-base/bookmarks
 * Create a new bookmark
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { articleId, notes, tags, collectionName } = req.body;

    if (!articleId) {
      return res.status(400).json({
        success: false,
        message: 'Article ID is required',
      });
    }

    // Check if bookmark already exists
    const existing = await db
      .select()
      .from(articleBookmarks)
      .where(
        and(
          eq(articleBookmarks.userId, userId),
          eq(articleBookmarks.articleId, articleId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Bookmark already exists',
        bookmark: existing[0],
      });
    }

    // Create bookmark
    const [bookmark] = await db
      .insert(articleBookmarks)
      .values({
        tenantId,
        userId,
        articleId,
        notes: notes || null,
        tags: tags || [],
        collectionName: collectionName || null,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: 'Bookmark created successfully',
      bookmark,
    });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bookmark',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/knowledge-base/bookmarks/:id
 * Update bookmark notes, tags, or collection
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { notes, tags, collectionName } = req.body;

    // Verify ownership
    const existing = await db
      .select()
      .from(articleBookmarks)
      .where(
        and(
          eq(articleBookmarks.id, id),
          eq(articleBookmarks.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found',
      });
    }

    // Update bookmark
    const [updated] = await db
      .update(articleBookmarks)
      .set({
        notes: notes !== undefined ? notes : existing[0].notes,
        tags: tags !== undefined ? tags : existing[0].tags,
        collectionName: collectionName !== undefined ? collectionName : existing[0].collectionName,
        updatedAt: new Date(),
      })
      .where(eq(articleBookmarks.id, id))
      .returning();

    res.json({
      success: true,
      message: 'Bookmark updated successfully',
      bookmark: updated,
    });
  } catch (error) {
    console.error('Error updating bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bookmark',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/knowledge-base/bookmarks/:id
 * Remove a bookmark
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify ownership
    const existing = await db
      .select()
      .from(articleBookmarks)
      .where(
        and(
          eq(articleBookmarks.id, id),
          eq(articleBookmarks.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found',
      });
    }

    // Delete bookmark
    await db
      .delete(articleBookmarks)
      .where(eq(articleBookmarks.id, id));

    res.json({
      success: true,
      message: 'Bookmark removed successfully',
    });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bookmark',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge-base/bookmarks/collections
 * Get all bookmark collections for the current user
 */
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    // Get unique collections with counts
    const collections = await db
      .select({
        name: articleBookmarks.collectionName,
        count: sql<number>`count(*)`,
      })
      .from(articleBookmarks)
      .where(
        and(
          eq(articleBookmarks.tenantId, tenantId),
          eq(articleBookmarks.userId, userId),
          sql`${articleBookmarks.collectionName} IS NOT NULL`
        )
      )
      .groupBy(articleBookmarks.collectionName)
      .orderBy(articleBookmarks.collectionName);

    res.json({
      success: true,
      collections: collections.map(c => ({
        name: c.name,
        count: c.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge-base/bookmarks/check/:articleId
 * Check if an article is bookmarked
 */
router.get('/check/:articleId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { articleId } = req.params;

    const bookmark = await db
      .select()
      .from(articleBookmarks)
      .where(
        and(
          eq(articleBookmarks.userId, userId),
          eq(articleBookmarks.articleId, articleId)
        )
      )
      .limit(1);

    res.json({
      success: true,
      bookmarked: bookmark.length > 0,
      bookmark: bookmark[0] || null,
    });
  } catch (error) {
    console.error('Error checking bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check bookmark status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
