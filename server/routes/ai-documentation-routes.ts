/**
 * AI Documentation Routes
 * API endpoints for intelligent document creation, AI writing assistance, and knowledge management
 */

import express from 'express';
import AIDocumentationService from '../services/ai-documentation-service';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('ai-documentation-routes');

const router = express.Router();

// ==================== /documents/* — REMOVED (PROD-008b) ====================
//
// The seven /documents handlers that lived here are gone. /api/documents is
// proxied to supabase/functions/documents/, which serves the REAL documents
// table; these were a third, unrelated feature sharing the prefix (the other two
// being routes-documents.ts, retired, and routes-document-automation.ts,
// retained). None of them ran and none had a caller.
//
// Nothing was ported: services/ai-documentation-service.ts returns hardcoded
// search results, invented writing analytics, and rows stamped
// tenantId: 'mock-tenant'. Publishing that to production would be worse than the
// 404 it currently gives.
//
// The /knowledge/*, /analytics/writing and /document-types handlers below are on
// UNPROXIED prefixes and still register. They are mock too, with no callers;
// removing them is a separate story.

/**
 * GET /api/documents
 * Get documents with filtering and pagination
 */

/**
 * GET /api/documents/:documentId
 * Get a specific document with full content
 */

/**
 * POST /api/documents/from-meeting
 * Generate document from meeting transcription
 */

/**
 * POST /api/documents/:documentId/sections/generate
 * Generate AI content for a document section
 */

/**
 * POST /api/documents/:documentId/improve
 * AI-powered content improvement
 */

/**
 * POST /api/knowledge/articles
 * Create knowledge base article with AI enhancement
 */
router.post('/knowledge/articles', async (req, res) => {
  try {
    const { title, category, subcategory, content, tags, targetAudience } = req.body;

    if (!title || !category || !content) {
      return res.status(400).json({ error: 'Title, category, and content are required' });
    }

    const result = await AIDocumentationService.createKnowledgeArticle(
      req.user!.tenantId!,
      req.user!.id,
      { title, category, subcategory, content, tags, targetAudience },
    );

    res.status(201).json(result);
  } catch (error) {
    log.error('Error creating knowledge article:', error);
    res.status(500).json({ error: 'Failed to create knowledge article' });
  }
});

/**
 * GET /api/knowledge/articles
 * Get knowledge base articles with filtering
 */
router.get('/knowledge/articles', async (req, res) => {
  try {
    const { category, subcategory, difficulty, featured, search, page = 1, limit = 20 } = req.query;

    // Mock knowledge articles
    const articles = [
      {
        id: 'article-1',
        tenantId: req.user!.tenantId!,
        title: 'How to Set Up AI-Powered Meeting Transcription',
        slug: 'how-to-set-up-ai-powered-meeting-transcription',
        category: 'tutorials',
        subcategory: 'meeting_management',
        excerpt:
          'Learn how to configure and use AI-powered meeting transcription for automatic note generation and action item tracking.',
        content: {
          introduction:
            'AI-powered meeting transcription transforms how teams capture and process meeting information...',
          steps: [
            'Configure your meeting platform integration',
            'Set up automatic recording and transcription',
            'Customize AI note generation settings',
            'Review and edit AI-generated content',
          ],
        },
        wordCount: 1456,
        estimatedReadingTime: 7,
        aiGeneratedSummary:
          'Comprehensive guide for setting up AI meeting transcription with step-by-step instructions and best practices.',
        aiExtractedKeywords: [
          'meeting transcription',
          'AI automation',
          'note generation',
          'setup guide',
        ],
        aiRelatedTopics: ['Meeting Management', 'AI Automation', 'Productivity Tools'],
        aiDifficultyLevel: 'intermediate',
        aiContentQualityScore: 0.91,
        tags: ['tutorial', 'meetings', 'AI', 'transcription', 'setup'],
        searchKeywords: ['meeting transcription', 'AI setup', 'automatic notes'],
        status: 'published',
        featured: true,
        isPublic: true,
        viewCount: 234,
        helpfulVotes: 45,
        unhelpfulVotes: 3,
        averageRating: 4.7,
        relatedArticles: ['article-2', 'article-3'],
        contentFreshnessScore: 0.95,
        createdBy: req.user!.id,
        createdAt: new Date('2025-09-20T10:00:00Z'),
        updatedAt: new Date('2025-09-25T14:30:00Z'),
        publishedAt: new Date('2025-09-20T15:00:00Z'),
      },
      {
        id: 'article-2',
        tenantId: req.user!.tenantId!,
        title: 'Best Practices for AI Document Generation',
        slug: 'best-practices-for-ai-document-generation',
        category: 'best_practices',
        subcategory: 'documentation',
        excerpt:
          'Essential best practices for creating high-quality documents using AI assistance and maintaining consistency across your organization.',
        content: {
          introduction:
            'AI document generation can significantly improve productivity when used effectively...',
          practices: [
            'Define clear document templates and structures',
            'Provide context and specific instructions to AI',
            'Review and refine AI-generated content',
            'Maintain consistent tone and style',
          ],
        },
        wordCount: 892,
        estimatedReadingTime: 4,
        aiGeneratedSummary:
          'Essential best practices for effective AI document generation with tips for quality and consistency.',
        aiExtractedKeywords: [
          'AI documentation',
          'best practices',
          'content quality',
          'document templates',
        ],
        aiRelatedTopics: ['Document Management', 'AI Writing', 'Content Strategy'],
        aiDifficultyLevel: 'beginner',
        aiContentQualityScore: 0.88,
        tags: ['best-practices', 'AI', 'documentation', 'quality'],
        searchKeywords: ['AI writing', 'document best practices', 'content generation'],
        status: 'published',
        featured: false,
        isPublic: true,
        viewCount: 156,
        helpfulVotes: 32,
        unhelpfulVotes: 1,
        averageRating: 4.5,
        relatedArticles: ['article-1', 'article-3'],
        contentFreshnessScore: 0.88,
        createdBy: req.user!.id,
        createdAt: new Date('2025-09-18T09:00:00Z'),
        updatedAt: new Date('2025-09-23T11:15:00Z'),
        publishedAt: new Date('2025-09-18T12:00:00Z'),
      },
    ];

    // Apply filtering
    let filteredArticles = articles;

    if (category) {
      filteredArticles = filteredArticles.filter((article) => article.category === category);
    }

    if (featured === 'true') {
      filteredArticles = filteredArticles.filter((article) => article.featured);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredArticles = filteredArticles.filter(
        (article) =>
          article.title.toLowerCase().includes(searchLower) ||
          article.excerpt.toLowerCase().includes(searchLower) ||
          article.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      );
    }

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

    res.json({
      articles: paginatedArticles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredArticles.length,
        pages: Math.ceil(filteredArticles.length / Number(limit)),
      },
      filters: { category, subcategory, difficulty, featured, search },
    });
  } catch (error) {
    log.error('Error fetching knowledge articles:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge articles' });
  }
});

/**
 * POST /api/documents/search
 * Search documents with AI-powered relevance ranking
 */

/**
 * GET /api/documents/analytics/writing
 * Get AI writing analytics and insights
 */
router.get('/analytics/writing', async (req, res) => {
  try {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date = new Date().toISOString(),
    } = req.query;

    const analytics = await AIDocumentationService.getWritingAnalytics(req.user!.tenantId!, {
      start: new Date(start_date as string),
      end: new Date(end_date as string),
    });

    res.json(analytics);
  } catch (error) {
    log.error('Error fetching writing analytics:', error);
    res.status(500).json({ error: 'Failed to fetch writing analytics' });
  }
});

/**
 * GET /api/documents/types
 * Get available document types and templates
 */
router.get('/document-types', async (req, res) => {
  try {
    const { category, active_only = 'true' } = req.query;

    // Mock document types
    const documentTypes = [
      {
        id: 'type-1',
        name: 'Meeting Minutes',
        description: 'Structured meeting minutes with action items and decisions',
        category: 'meeting',
        templateStructure: {
          sections: ['header', 'attendees', 'agenda', 'discussion', 'decisions', 'action_items'],
        },
        aiWritingPrompts: [
          'Generate professional meeting minutes from transcription',
          'Extract key decisions and action items',
          'Identify next steps and follow-up items',
        ],
        requiredSections: ['header', 'attendees', 'discussion', 'action_items'],
        optionalSections: ['agenda', 'appendix'],
        aiTone: 'professional',
        aiComplexityLevel: 'medium',
        aiLengthPreference: 'medium',
        usageCount: 156,
        successRate: 0.91,
        isSystemTemplate: true,
        isActive: true,
      },
      {
        id: 'type-2',
        name: 'Business Proposal',
        description: 'Comprehensive business proposal template',
        category: 'proposal',
        templateStructure: {
          sections: [
            'executive_summary',
            'problem_statement',
            'solution',
            'benefits',
            'timeline',
            'pricing',
          ],
        },
        aiWritingPrompts: [
          'Create compelling executive summary',
          'Define clear problem statement and solution',
          'Highlight key benefits and value proposition',
        ],
        requiredSections: ['executive_summary', 'solution', 'benefits', 'pricing'],
        optionalSections: ['appendix', 'references'],
        aiTone: 'professional',
        aiComplexityLevel: 'advanced',
        aiLengthPreference: 'detailed',
        usageCount: 89,
        successRate: 0.87,
        isSystemTemplate: true,
        isActive: true,
      },
      {
        id: 'type-3',
        name: 'Knowledge Base Article',
        description: 'Structured knowledge base article with step-by-step instructions',
        category: 'knowledge_base',
        templateStructure: {
          sections: ['introduction', 'prerequisites', 'steps', 'examples', 'troubleshooting'],
        },
        aiWritingPrompts: [
          'Write clear introduction and overview',
          'Create step-by-step instructions',
          'Provide practical examples and troubleshooting',
        ],
        requiredSections: ['introduction', 'steps'],
        optionalSections: ['prerequisites', 'examples', 'troubleshooting', 'related_articles'],
        aiTone: 'friendly',
        aiComplexityLevel: 'medium',
        aiLengthPreference: 'detailed',
        usageCount: 67,
        successRate: 0.93,
        isSystemTemplate: true,
        isActive: true,
      },
    ];

    let filteredTypes = documentTypes;

    if (category) {
      filteredTypes = filteredTypes.filter((type) => type.category === category);
    }

    if (active_only === 'true') {
      filteredTypes = filteredTypes.filter((type) => type.isActive);
    }

    res.json(filteredTypes);
  } catch (error) {
    log.error('Error fetching document types:', error);
    res.status(500).json({ error: 'Failed to fetch document types' });
  }
});

export default router;
