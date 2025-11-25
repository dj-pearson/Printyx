import { Router, Request, Response } from 'express';
import { db } from './db';
import {
  knowledgeCategories,
  knowledgeArticles,
  articleVersions,
  articleViews,
  articleFeedback,
  knowledgeSearchQueries,
  aiContentGenerationQueue,
  insertKnowledgeCategorySchema,
  insertKnowledgeArticleSchema,
  insertArticleVersionSchema,
  insertArticleFeedbackSchema,
  insertAiContentGenerationQueueSchema,
} from '@shared/schema';
import { eq, and, or, desc, asc, sql, like, ilike, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { generateTableOfContents, addHeaderIdsToHTML } from './utils/article-table-of-contents';

const router = Router();

// Middleware to require authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Middleware to require admin role
const requireAdmin = (req: Request, res: Response, next: Function) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  // Check if user has admin role (platform_admin, super_admin, or admin)
  const userRole = (req.session as any).role || 'guest';
  const adminRoles = ['platform_admin', 'super_admin', 'admin'];
  if (!adminRoles.includes(userRole)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Helper to get tenant ID
const getTenantId = (req: Request): string => {
  return (
    (req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
  );
};

// ================================
// CATEGORIES
// ================================

// GET /api/knowledge-base/categories - List all categories (public)
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { parentId } = req.query;

    const whereConditions = [
      eq(knowledgeCategories.tenantId, tenantId),
      eq(knowledgeCategories.isActive, true),
    ];

    if (parentId === 'null' || parentId === 'root') {
      whereConditions.push(sql`${knowledgeCategories.parentCategoryId} IS NULL`);
    } else if (parentId) {
      whereConditions.push(eq(knowledgeCategories.parentCategoryId, parentId as string));
    }

    const categories = await db
      .select()
      .from(knowledgeCategories)
      .where(and(...whereConditions))
      .orderBy(asc(knowledgeCategories.categoryOrder));

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// GET /api/knowledge-base/categories/:id - Get single category
router.get('/categories/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const [category] = await db
      .select()
      .from(knowledgeCategories)
      .where(
        and(
          eq(knowledgeCategories.id, id),
          eq(knowledgeCategories.tenantId, tenantId),
          eq(knowledgeCategories.isActive, true),
        ),
      )
      .limit(1);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});

// POST /api/knowledge-base/categories - Create category (admin only)
router.post('/categories', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.session!.userId!;

    const data = insertKnowledgeCategorySchema.parse(req.body);

    const [category] = await db
      .insert(knowledgeCategories)
      .values({
        ...data,
        tenantId,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(400).json({ message: 'Failed to create category', error });
  }
});

// PUT /api/knowledge-base/categories/:id - Update category (admin only)
router.put('/categories/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const data = insertKnowledgeCategorySchema.partial().parse(req.body);

    const [updated] = await db
      .update(knowledgeCategories)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(400).json({ message: 'Failed to update category', error });
  }
});

// DELETE /api/knowledge-base/categories/:id - Soft delete category (admin only)
router.delete('/categories/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const [deleted] = await db
      .update(knowledgeCategories)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

// ================================
// ARTICLES
// ================================

// GET /api/knowledge-base/articles - List articles with pagination and filtering
router.get('/articles', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const {
      categoryId,
      status = 'published',
      contentType,
      difficulty,
      search,
      featured,
      page = '1',
      limit = '20',
    } = req.query;

    const whereConditions = [eq(knowledgeArticles.tenantId, tenantId)];

    // Only show published articles to non-admin users
    const userRole = (req.session as any)?.role || 'guest';
    const isAdmin = ['platform_admin', 'super_admin', 'admin'].includes(userRole);

    if (!isAdmin) {
      whereConditions.push(eq(knowledgeArticles.status, 'published'));
      whereConditions.push(eq(knowledgeArticles.isPublic, true));
    } else if (status) {
      whereConditions.push(eq(knowledgeArticles.status, status as any));
    }

    if (categoryId) {
      whereConditions.push(eq(knowledgeArticles.categoryId, categoryId as string));
    }

    if (contentType) {
      whereConditions.push(eq(knowledgeArticles.contentType, contentType as any));
    }

    if (difficulty) {
      whereConditions.push(eq(knowledgeArticles.difficultyLevel, difficulty as any));
    }

    if (featured === 'true') {
      whereConditions.push(eq(knowledgeArticles.featured, true));
    }

    if (search) {
      whereConditions.push(
        or(
          ilike(knowledgeArticles.title, `%${search}%`),
          ilike(knowledgeArticles.plainTextContent, `%${search}%`),
          sql`${knowledgeArticles.keywords}::text ILIKE ${`%${search}%`}`,
        )!,
      );
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const articles = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        slug: knowledgeArticles.slug,
        excerpt: knowledgeArticles.excerpt,
        categoryId: knowledgeArticles.categoryId,
        contentType: knowledgeArticles.contentType,
        difficultyLevel: knowledgeArticles.difficultyLevel,
        status: knowledgeArticles.status,
        featuredImage: knowledgeArticles.featuredImage,
        viewCount: knowledgeArticles.viewCount,
        helpfulVotes: knowledgeArticles.helpfulVotes,
        averageRating: knowledgeArticles.averageRating,
        estimatedReadingTime: knowledgeArticles.estimatedReadingTime,
        featured: knowledgeArticles.featured,
        publishedAt: knowledgeArticles.publishedAt,
        updatedAt: knowledgeArticles.updatedAt,
      })
      .from(knowledgeArticles)
      .where(and(...whereConditions))
      .orderBy(desc(knowledgeArticles.publishedAt))
      .limit(limitNum)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeArticles)
      .where(and(...whereConditions));

    res.json({
      articles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(count),
        pages: Math.ceil(Number(count) / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ message: 'Failed to fetch articles' });
  }
});

// GET /api/knowledge-base/articles/:slugOrId - Get single article by slug or ID
router.get('/articles/:slugOrId', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { slugOrId } = req.params;

    // Try to find by ID first, then by slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

    const whereConditions = [eq(knowledgeArticles.tenantId, tenantId)];

    if (isUUID) {
      whereConditions.push(eq(knowledgeArticles.id, slugOrId));
    } else {
      whereConditions.push(eq(knowledgeArticles.slug, slugOrId));
    }

    // Only show published articles to non-admin users
    const userRole = (req.session as any)?.role || 'guest';
    const isAdmin = ['platform_admin', 'super_admin', 'admin'].includes(userRole);

    if (!isAdmin) {
      whereConditions.push(eq(knowledgeArticles.status, 'published'));
      whereConditions.push(eq(knowledgeArticles.isPublic, true));
    }

    const [article] = await db
      .select()
      .from(knowledgeArticles)
      .where(and(...whereConditions))
      .limit(1);

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Track article view (async, don't wait)
    const sessionId = req.sessionID || `guest-${Date.now()}`;
    const userId = req.session?.userId || null;

    db.insert(articleViews)
      .values({
        tenantId,
        articleId: article.id,
        userId,
        sessionId,
        viewedAt: new Date(),
        createdAt: new Date(),
      })
      .then(() => {
        // Update article view count
        return db
          .update(knowledgeArticles)
          .set({
            viewCount: sql`${knowledgeArticles.viewCount} + 1`,
          })
          .where(eq(knowledgeArticles.id, article.id));
      })
      .catch((err) => console.error('Error tracking article view:', err));

    // Generate table of contents if content is structured
    let tableOfContents = null;
    try {
      if (article.content && typeof article.content === 'object') {
        tableOfContents = generateTableOfContents(article.content as any);

        // Add IDs to HTML headers if HTML content exists
        if (article.htmlContent && tableOfContents) {
          article.htmlContent = addHeaderIdsToHTML(article.htmlContent, tableOfContents);
        }
      }
    } catch (tocError) {
      console.error('Error generating table of contents:', tocError);
      // Continue without TOC if generation fails
    }

    res.json({
      ...article,
      tableOfContents,
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ message: 'Failed to fetch article' });
  }
});

// POST /api/knowledge-base/articles - Create article (admin only)
router.post('/articles', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.session!.userId!;

    const data = insertKnowledgeArticleSchema.parse(req.body);

    // Generate plain text content from content JSON
    const plainTextContent =
      typeof data.content === 'object' ? JSON.stringify(data.content) : String(data.content);

    // Calculate word count and reading time
    const wordCount = plainTextContent.split(/\s+/).length;
    const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute

    const [article] = await db
      .insert(knowledgeArticles)
      .values({
        ...data,
        tenantId,
        plainTextContent,
        wordCount,
        estimatedReadingTime,
        version: 1,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create initial version
    await db.insert(articleVersions).values({
      tenantId,
      articleId: article.id,
      version: 1,
      title: article.title,
      content: article.content,
      plainTextContent: article.plainTextContent,
      changeDescription: 'Initial version',
      changeType: 'major',
      createdBy: userId,
      createdAt: new Date(),
    });

    res.status(201).json(article);
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(400).json({ message: 'Failed to create article', error });
  }
});

// PUT /api/knowledge-base/articles/:id - Update article (admin only)
router.put('/articles/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.session!.userId!;
    const { id } = req.params;
    const { changeDescription, changeType, ...data } = req.body;

    // Get current article
    const [currentArticle] = await db
      .select()
      .from(knowledgeArticles)
      .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
      .limit(1);

    if (!currentArticle) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Increment version
    const newVersion = currentArticle.version + 1;

    // Generate plain text content if content was updated
    let plainTextContent = currentArticle.plainTextContent;
    let wordCount = currentArticle.wordCount;
    let estimatedReadingTime = currentArticle.estimatedReadingTime;

    if (data.content) {
      plainTextContent =
        typeof data.content === 'object' ? JSON.stringify(data.content) : String(data.content);
      wordCount = plainTextContent!.split(/\s+/).length;
      estimatedReadingTime = Math.ceil(wordCount / 200);
    }

    const [updated] = await db
      .update(knowledgeArticles)
      .set({
        ...data,
        plainTextContent,
        wordCount,
        estimatedReadingTime,
        version: newVersion,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
      .returning();

    // Create version history
    await db.insert(articleVersions).values({
      tenantId,
      articleId: updated.id,
      version: newVersion,
      title: updated.title,
      content: updated.content,
      plainTextContent: updated.plainTextContent,
      changeDescription: changeDescription || 'Article updated',
      changeType: changeType || 'minor',
      createdBy: userId,
      createdAt: new Date(),
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(400).json({ message: 'Failed to update article', error });
  }
});

// PATCH /api/knowledge-base/articles/:id/publish - Publish article (admin only)
router.patch(
  '/articles/:id/publish',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { id } = req.params;

      const [published] = await db
        .update(knowledgeArticles)
        .set({
          status: 'published',
          publishedAt: new Date(),
          publishedVersion: sql`${knowledgeArticles.version}`,
          updatedAt: new Date(),
        })
        .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
        .returning();

      if (!published) {
        return res.status(404).json({ message: 'Article not found' });
      }

      res.json(published);
    } catch (error) {
      console.error('Error publishing article:', error);
      res.status(500).json({ message: 'Failed to publish article' });
    }
  },
);

// PATCH /api/knowledge-base/articles/:id/archive - Archive article (admin only)
router.patch(
  '/articles/:id/archive',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { id } = req.params;

      const [archived] = await db
        .update(knowledgeArticles)
        .set({
          status: 'archived',
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
        .returning();

      if (!archived) {
        return res.status(404).json({ message: 'Article not found' });
      }

      res.json(archived);
    } catch (error) {
      console.error('Error archiving article:', error);
      res.status(500).json({ message: 'Failed to archive article' });
    }
  },
);

// DELETE /api/knowledge-base/articles/:id - Delete article (admin only)
router.delete('/articles/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    // Delete article versions first
    await db
      .delete(articleVersions)
      .where(and(eq(articleVersions.articleId, id), eq(articleVersions.tenantId, tenantId)));

    // Delete article
    const [deleted] = await db
      .delete(knowledgeArticles)
      .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ message: 'Failed to delete article' });
  }
});

// ================================
// SEARCH
// ================================

// GET /api/knowledge-base/search - Search articles
router.get('/search', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { q, page = '1', limit = '10' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query required' });
    }

    const searchTerm = q.toLowerCase();
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Basic text search (can be enhanced with full-text search or vector search later)
    const articles = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        slug: knowledgeArticles.slug,
        excerpt: knowledgeArticles.excerpt,
        categoryId: knowledgeArticles.categoryId,
        contentType: knowledgeArticles.contentType,
        difficultyLevel: knowledgeArticles.difficultyLevel,
        featuredImage: knowledgeArticles.featuredImage,
        viewCount: knowledgeArticles.viewCount,
        averageRating: knowledgeArticles.averageRating,
        estimatedReadingTime: knowledgeArticles.estimatedReadingTime,
        publishedAt: knowledgeArticles.publishedAt,
      })
      .from(knowledgeArticles)
      .where(
        and(
          eq(knowledgeArticles.tenantId, tenantId),
          eq(knowledgeArticles.status, 'published'),
          eq(knowledgeArticles.isPublic, true),
          or(
            ilike(knowledgeArticles.title, `%${searchTerm}%`),
            ilike(knowledgeArticles.plainTextContent, `%${searchTerm}%`),
            ilike(knowledgeArticles.excerpt, `%${searchTerm}%`),
            sql`${knowledgeArticles.keywords}::text ILIKE ${`%${searchTerm}%`}`,
            sql`${knowledgeArticles.tags}::text ILIKE ${`%${searchTerm}%`}`,
          )!,
        ),
      )
      .orderBy(desc(knowledgeArticles.viewCount))
      .limit(limitNum)
      .offset(offset);

    // Track search query
    const sessionId = req.sessionID || `guest-${Date.now()}`;
    const userId = req.session?.userId || null;

    db.insert(knowledgeSearchQueries)
      .values({
        tenantId,
        queryText: q,
        userId,
        sessionId,
        resultsCount: articles.length,
        topResultIds: articles.slice(0, 5).map((a) => a.id),
        createdAt: new Date(),
      })
      .catch((err) => console.error('Error tracking search query:', err));

    res.json({
      results: articles,
      query: q,
      count: articles.length,
    });
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).json({ message: 'Failed to search articles' });
  }
});

// ================================
// FEEDBACK
// ================================

// POST /api/knowledge-base/articles/:id/feedback - Submit article feedback
router.post('/articles/:id/feedback', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const userId = req.session?.userId || null;

    const data = insertArticleFeedbackSchema.parse(req.body);

    const [feedback] = await db
      .insert(articleFeedback)
      .values({
        ...data,
        tenantId,
        articleId: id,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Update article helpful/unhelpful votes
    if (data.feedbackType === 'helpful') {
      await db
        .update(knowledgeArticles)
        .set({
          helpfulVotes: sql`${knowledgeArticles.helpfulVotes} + 1`,
        })
        .where(eq(knowledgeArticles.id, id));
    } else if (data.feedbackType === 'unhelpful') {
      await db
        .update(knowledgeArticles)
        .set({
          unhelpfulVotes: sql`${knowledgeArticles.unhelpfulVotes} + 1`,
        })
        .where(eq(knowledgeArticles.id, id));
    }

    res.status(201).json(feedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(400).json({ message: 'Failed to submit feedback', error });
  }
});

// GET /api/knowledge-base/articles/:id/feedback - Get article feedback (admin only)
router.get(
  '/articles/:id/feedback',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { id } = req.params;

      const feedback = await db
        .select()
        .from(articleFeedback)
        .where(and(eq(articleFeedback.tenantId, tenantId), eq(articleFeedback.articleId, id)))
        .orderBy(desc(articleFeedback.createdAt));

      res.json(feedback);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      res.status(500).json({ message: 'Failed to fetch feedback' });
    }
  },
);

// ================================
// ANALYTICS
// ================================

// GET /api/knowledge-base/analytics - Get knowledge base analytics (admin only)
router.get('/analytics', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    // Get article stats
    const [articleStats] = await db
      .select({
        totalArticles: sql<number>`count(*)`,
        publishedArticles: sql<number>`count(*) FILTER (WHERE status = 'published')`,
        draftArticles: sql<number>`count(*) FILTER (WHERE status = 'draft')`,
        totalViews: sql<number>`sum(${knowledgeArticles.viewCount})`,
        averageRating: sql<number>`avg(${knowledgeArticles.averageRating})`,
      })
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.tenantId, tenantId));

    // Get category stats
    const [categoryStats] = await db
      .select({
        totalCategories: sql<number>`count(*)`,
        activeCategories: sql<number>`count(*) FILTER (WHERE is_active = true)`,
      })
      .from(knowledgeCategories)
      .where(eq(knowledgeCategories.tenantId, tenantId));

    // Get popular articles
    const popularArticles = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        viewCount: knowledgeArticles.viewCount,
        averageRating: knowledgeArticles.averageRating,
      })
      .from(knowledgeArticles)
      .where(
        and(eq(knowledgeArticles.tenantId, tenantId), eq(knowledgeArticles.status, 'published')),
      )
      .orderBy(desc(knowledgeArticles.viewCount))
      .limit(10);

    // Get recent searches
    const recentSearches = await db
      .select({
        queryText: knowledgeSearchQueries.queryText,
        resultsCount: knowledgeSearchQueries.resultsCount,
        createdAt: knowledgeSearchQueries.createdAt,
      })
      .from(knowledgeSearchQueries)
      .where(eq(knowledgeSearchQueries.tenantId, tenantId))
      .orderBy(desc(knowledgeSearchQueries.createdAt))
      .limit(20);

    res.json({
      articles: articleStats,
      categories: categoryStats,
      popularArticles,
      recentSearches,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

export default router;
