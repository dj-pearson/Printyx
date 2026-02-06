/**
 * Knowledge Base API Routes
 * Comprehensive knowledge management endpoints with AI-powered features
 */

import { Router, Request, Response } from 'express';
import KnowledgeBaseService from '../services/knowledge-base-service';
import { insertKnowledgeArticleSchema, insertKnowledgeCategorySchema } from '@shared/schema';
import { z } from 'zod';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('knowledge-base-routes');

const router = Router();

/**
 * GET /api/knowledge-base/categories
 * Get all knowledge base categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required',
      });
    }

    const { includeInactive, parentCategoryId } = req.query;

    const categories = await KnowledgeBaseService.getCategories(tenantId, {
      includeInactive: includeInactive === 'true',
      parentCategoryId:
        parentCategoryId === 'null' ? null : (parentCategoryId as string | undefined),
    });

    // Get article counts for each category
    const categoriesWithCounts = await KnowledgeBaseService.getCategoriesWithArticleCounts(
      tenantId,
      categories,
    );

    res.json(categoriesWithCounts);
  } catch (error: any) {
    log.error('Failed to get categories:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge-base/categories
 * Create a new category
 */
router.post('/categories', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId || 'demo-user';

    const validatedData = insertKnowledgeCategorySchema.parse(req.body);

    const category = await KnowledgeBaseService.createCategory(tenantId, userId, validatedData);

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    log.error('Failed to create category:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/knowledge-base/articles
 * Search and list articles
 */
router.get('/articles', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required',
      });
    }

    const {
      query,
      categoryId,
      status,
      tags,
      contentType,
      difficultyLevel,
      limit,
      offset,
      useSemanticSearch,
    } = req.query;

    const result = await KnowledgeBaseService.searchArticles(tenantId, (query as string) || '', {
      categoryId: categoryId as string,
      status: (status as string) || 'published',
      tags: tags ? (tags as string).split(',') : undefined,
      contentType: contentType as string,
      difficultyLevel: difficultyLevel as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      useSemanticSearch: useSemanticSearch === 'true',
    });

    res.json({
      success: true,
      data: result.articles,
      meta: {
        total: result.total,
        searchTime: result.searchTime,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      },
    });
  } catch (error: any) {
    log.error('Failed to search articles:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/knowledge-base/articles/:id
 * Get a specific article
 */
router.get('/articles/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId;
    const { id } = req.params;
    const { incrementView } = req.query;

    const article = await KnowledgeBaseService.getArticle(id, tenantId, {
      incrementView: incrementView === 'true',
      userId,
      sessionId: req.sessionID,
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    res.json({
      success: true,
      data: article,
    });
  } catch (error: any) {
    log.error('Failed to get article:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge-base/articles
 * Create a new article
 */
router.post('/articles', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId || 'demo-user';

    const article = await KnowledgeBaseService.createArticle(tenantId, userId, req.body);

    res.status(201).json({
      success: true,
      data: article,
    });
  } catch (error: any) {
    log.error('Failed to create article:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/knowledge-base/articles/:id
 * Update an existing article
 */
router.put('/articles/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId || 'demo-user';
    const { id } = req.params;

    const article = await KnowledgeBaseService.updateArticle(id, tenantId, userId, req.body);

    res.json({
      success: true,
      data: article,
    });
  } catch (error: any) {
    log.error('Failed to update article:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge-base/articles/:id/feedback
 * Submit feedback for an article
 */
router.post('/articles/:id/feedback', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId;
    const { id } = req.params;

    const feedback = await KnowledgeBaseService.submitFeedback(tenantId, id, {
      ...req.body,
      userId,
    });

    res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (error: any) {
    log.error('Failed to submit feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge-base/ai/generate
 * Generate an article using AI
 */
router.post('/ai/generate', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const userId = (req as any).userId || 'demo-user';

    const schema = z.object({
      topic: z.string().min(3),
      category: z.string(),
      featureArea: z.string(),
      targetAudience: z.string().optional(),
      difficultyLevel: z.string().optional(),
      includeExamples: z.boolean().optional(),
      includeScreenshots: z.boolean().optional(),
      tone: z.string().optional(),
    });

    const validatedData = schema.parse(req.body);

    const result = await KnowledgeBaseService.generateArticleWithAI(
      tenantId,
      userId,
      validatedData,
    );

    res.status(202).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    log.error('Failed to generate article with AI:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/knowledge-base/analytics
 * Get knowledge base analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate as string) : new Date();

    const analytics = await KnowledgeBaseService.getAnalytics(tenantId, {
      start,
      end,
    });

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    log.error('Failed to get analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/knowledge-base/featured
 * Get featured articles
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { limit } = req.query;

    const result = await KnowledgeBaseService.searchArticles(tenantId, '', {
      status: 'published',
      limit: limit ? parseInt(limit as string) : 5,
    });

    // Filter for featured articles
    const featured = result.articles.filter((a) => a.featured);

    res.json({
      success: true,
      data: featured,
    });
  } catch (error: any) {
    log.error('Failed to get featured articles:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/knowledge-base/popular
 * Get popular articles by views
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || 'demo-tenant';
    const { limit } = req.query;

    const result = await KnowledgeBaseService.searchArticles(tenantId, '', {
      status: 'published',
      limit: 100,
    });

    // Sort by view count
    const popular = result.articles
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit ? parseInt(limit as string) : 10);

    res.json({
      success: true,
      data: popular,
    });
  } catch (error: any) {
    log.error('Failed to get popular articles:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
