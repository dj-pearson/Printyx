/**
 * AI Search & Knowledge Routes
 * API endpoints for vector search, AI query processing, and knowledge management
 */

import express from 'express';
import AISearchKnowledgeService from '../services/ai-search-knowledge-service';
import { createModuleLogger } from '../lib/logger';
import { getUserId, getTenantId } from '../utils/auth-helpers';
const log = createModuleLogger('ai-search-knowledge-routes');

const router = express.Router();

/**
 * POST /api/search/semantic
 * Perform semantic search using vector similarity
 */
router.post('/search/semantic', async (req, res) => {
  try {
    const {
      query,
      contentTypes,
      categories,
      tags,
      maxResults = 10,
      minSimilarity = 0.3,
      accessLevel,
      dateRange,
      includeAnswer = true,
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchResults = await AISearchKnowledgeService.semanticSearch(
      req.user.tenantId,
      req.user.id,
      query.trim(),
      {
        contentTypes,
        categories,
        tags,
        maxResults,
        minSimilarity,
        accessLevel,
        dateRange: dateRange
          ? {
              start: new Date(dateRange.start),
              end: new Date(dateRange.end),
            }
          : undefined,
        includeAnswer,
      },
    );

    res.json(searchResults);
  } catch (error) {
    log.error('Error performing semantic search:', error);
    res.status(500).json({ error: 'Failed to perform semantic search' });
  }
});

/**
 * GET /api/search/suggestions
 * Get search query suggestions based on popular searches and user history
 */
router.get('/search/suggestions', async (req, res) => {
  try {
    const { query, limit = 8 } = req.query;

    // Mock search suggestions - in production, this would analyze user patterns and popular queries
    const suggestions = [
      'How to set up meeting transcription',
      'AI documentation best practices',
      'Team collaboration workflows',
      'Calendar integration troubleshooting',
      'Advanced scheduling algorithms',
      'Vector search implementation',
      'Knowledge management strategies',
      'Automated content generation',
    ];

    let filteredSuggestions = suggestions;

    if (query && typeof query === 'string') {
      const queryLower = query.toLowerCase();
      filteredSuggestions = suggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(queryLower),
      );
    }

    res.json({
      suggestions: filteredSuggestions.slice(0, Number(limit)),
      popularQueries: [
        { query: 'meeting transcription setup', frequency: 234 },
        { query: 'AI writing assistant', frequency: 187 },
        { query: 'team collaboration tools', frequency: 156 },
        { query: 'calendar integration', frequency: 134 },
      ],
    });
  } catch (error) {
    log.error('Error fetching search suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch search suggestions' });
  }
});

/**
 * POST /api/search/feedback
 * Submit feedback on search results and AI answers
 */
router.post('/search/feedback', async (req, res) => {
  try {
    const { queryId, answerId, rating, feedback, clickedResults, wasHelpful, corrections } =
      req.body;

    if (!queryId) {
      return res.status(400).json({ error: 'Query ID is required' });
    }

    // In production, this would update the database with user feedback
    const feedbackData = {
      queryId,
      answerId,
      userId: req.user.id,
      tenantId: req.user.tenantId,
      rating: rating ? Number(rating) : undefined,
      feedback: feedback || null,
      clickedResults: clickedResults || [],
      wasHelpful: wasHelpful !== undefined ? Boolean(wasHelpful) : undefined,
      corrections: corrections || [],
      submittedAt: new Date(),
    };

    log.info('Search feedback received:', feedbackData);

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId: `feedback-${Date.now()}`,
    });
  } catch (error) {
    log.error('Error submitting search feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

/**
 * POST /api/knowledge/entities
 * Create or update knowledge entities
 */
router.post('/knowledge/entities', async (req, res) => {
  try {
    const { name, type, description, category, attributes, facts, relatedEntities } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Entity name and type are required' });
    }

    const entity = await AISearchKnowledgeService.createKnowledgeEntity(req.user.tenantId, {
      name,
      type,
      description,
      category,
      attributes,
      facts,
      relatedEntities,
    });

    res.status(201).json(entity);
  } catch (error) {
    log.error('Error creating knowledge entity:', error);
    res.status(500).json({ error: 'Failed to create knowledge entity' });
  }
});

/**
 * GET /api/knowledge/entities
 * Get knowledge entities with filtering and search
 */
router.get('/knowledge/entities', async (req, res) => {
  try {
    const {
      type,
      category,
      search,
      sortBy = 'importance',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = req.query;

    // Mock knowledge entities - in production, this would query the database
    const allEntities = [
      {
        id: 'entity-1',
        tenantId: req.user.tenantId,
        entityName: 'Motion AI',
        entityType: 'product',
        entityDescription: 'Advanced AI-powered productivity and automation platform',
        entityCategory: 'software',
        entitySummary: 'SaaS platform for enterprise productivity with AI capabilities',
        relatedEntities: ['entity-2', 'entity-4'],
        mentionedInDocuments: ['doc-1', 'doc-2', 'doc-3'],
        mentionedInMeetings: ['meeting-1', 'meeting-2'],
        knowledgeArticles: ['article-1', 'article-3'],
        mentionFrequency: 156,
        importanceScore: 0.95,
        trendingScore: 0.23,
        entityAttributes: {
          type: 'SaaS platform',
          industry: 'productivity',
          targetMarket: 'enterprise',
        },
        entityFacts: [
          'Integrates with popular meeting platforms',
          'Provides AI-powered transcription',
          'Offers intelligent scheduling',
        ],
        aiConfidenceScore: 0.92,
        entityStatus: 'active',
        qualityScore: 0.88,
        createdAt: new Date('2025-09-15T10:00:00Z'),
        updatedAt: new Date('2025-09-25T14:30:00Z'),
        lastMentionedAt: new Date('2025-09-26T09:15:00Z'),
      },
      {
        id: 'entity-2',
        tenantId: req.user.tenantId,
        entityName: 'Claude AI',
        entityType: 'technology',
        entityDescription: 'Large language model for AI-powered content generation and analysis',
        entityCategory: 'artificial_intelligence',
        entitySummary: 'Advanced language model with reasoning capabilities',
        relatedEntities: ['entity-1', 'entity-3'],
        mentionedInDocuments: ['doc-1', 'doc-4'],
        mentionedInMeetings: ['meeting-1'],
        knowledgeArticles: ['article-2'],
        mentionFrequency: 89,
        importanceScore: 0.88,
        trendingScore: 0.31,
        entityAttributes: {
          provider: 'Anthropic',
          modelType: 'language_model',
          capabilities: ['text_generation', 'analysis', 'reasoning'],
        },
        entityFacts: [
          'Developed by Anthropic',
          'Constitutional AI approach',
          'Strong reasoning capabilities',
        ],
        aiConfidenceScore: 0.94,
        entityStatus: 'active',
        qualityScore: 0.91,
        createdAt: new Date('2025-09-10T08:00:00Z'),
        updatedAt: new Date('2025-09-24T16:45:00Z'),
        lastMentionedAt: new Date('2025-09-25T11:30:00Z'),
      },
      {
        id: 'entity-3',
        tenantId: req.user.tenantId,
        entityName: 'Team Collaboration',
        entityType: 'concept',
        entityDescription: 'Methods and tools for effective team collaboration and communication',
        entityCategory: 'business_process',
        entitySummary: 'Framework for effective team communication and productivity',
        relatedEntities: ['entity-1', 'entity-4'],
        mentionedInDocuments: ['doc-2', 'doc-3', 'doc-5'],
        mentionedInMeetings: ['meeting-2', 'meeting-3'],
        knowledgeArticles: ['article-3', 'article-4'],
        mentionFrequency: 67,
        importanceScore: 0.75,
        trendingScore: 0.18,
        entityAttributes: {
          domain: 'management',
          scope: 'team_productivity',
          tools: ['meetings', 'documents', 'chat'],
        },
        entityFacts: [
          'Essential for remote teams',
          'Improves productivity',
          'Requires proper tools and processes',
        ],
        aiConfidenceScore: 0.86,
        entityStatus: 'active',
        qualityScore: 0.79,
        createdAt: new Date('2025-09-12T12:00:00Z'),
        updatedAt: new Date('2025-09-23T10:20:00Z'),
        lastMentionedAt: new Date('2025-09-24T15:45:00Z'),
      },
      {
        id: 'entity-4',
        tenantId: req.user.tenantId,
        entityName: 'Vector Database',
        entityType: 'technology',
        entityDescription: 'Database optimized for storing and searching high-dimensional vectors',
        entityCategory: 'data_storage',
        entitySummary: 'Specialized database for AI embeddings and similarity search',
        relatedEntities: ['entity-1', 'entity-2'],
        mentionedInDocuments: ['doc-6'],
        mentionedInMeetings: ['meeting-4'],
        knowledgeArticles: ['article-5'],
        mentionFrequency: 34,
        importanceScore: 0.79,
        trendingScore: 0.42,
        entityAttributes: {
          useCases: ['semantic_search', 'AI_embeddings', 'similarity_matching'],
          performance: 'sub_millisecond',
        },
        entityFacts: [
          'Enables semantic search',
          'Powers AI recommendations',
          'Scales to billions of vectors',
        ],
        aiConfidenceScore: 0.89,
        entityStatus: 'active',
        qualityScore: 0.82,
        createdAt: new Date('2025-09-18T14:00:00Z'),
        updatedAt: new Date('2025-09-26T08:30:00Z'),
        lastMentionedAt: new Date('2025-09-26T08:30:00Z'),
      },
    ];

    // Apply filtering
    let filteredEntities = allEntities;

    if (type) {
      filteredEntities = filteredEntities.filter((entity) => entity.entityType === type);
    }

    if (category) {
      filteredEntities = filteredEntities.filter((entity) => entity.entityCategory === category);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredEntities = filteredEntities.filter(
        (entity) =>
          entity.entityName.toLowerCase().includes(searchLower) ||
          entity.entityDescription?.toLowerCase().includes(searchLower) ||
          entity.entityFacts.some((fact) => fact.toLowerCase().includes(searchLower)),
      );
    }

    // Apply sorting
    filteredEntities.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.entityName.toLowerCase();
          bValue = b.entityName.toLowerCase();
          break;
        case 'importance':
          aValue = a.importanceScore;
          bValue = b.importanceScore;
          break;
        case 'trending':
          aValue = a.trendingScore;
          bValue = b.trendingScore;
          break;
        case 'mentions':
          aValue = a.mentionFrequency;
          bValue = b.mentionFrequency;
          break;
        case 'updated':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        default:
          aValue = a.importanceScore;
          bValue = b.importanceScore;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedEntities = filteredEntities.slice(startIndex, endIndex);

    res.json({
      entities: paginatedEntities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredEntities.length,
        pages: Math.ceil(filteredEntities.length / Number(limit)),
      },
      filters: { type, category, search, sortBy, sortOrder },
    });
  } catch (error) {
    log.error('Error fetching knowledge entities:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge entities' });
  }
});

/**
 * GET /api/knowledge/entities/:entityId
 * Get detailed information about a specific knowledge entity
 */
router.get('/knowledge/entities/:entityId', async (req, res) => {
  try {
    const { entityId } = req.params;
    const { includeRelated = true, includeContent = true } = req.query;

    // Mock entity retrieval - in production, this would query the database
    const entity = {
      id: entityId,
      tenantId: req.user.tenantId,
      entityName: 'Motion AI',
      entityType: 'product',
      entityAliases: ['Motion', 'Motion AI Platform', 'AI Assistant'],
      entityDescription:
        'Advanced AI-powered productivity and automation platform designed for enterprise teams to streamline workflows, enhance collaboration, and leverage artificial intelligence for improved business outcomes.',
      entitySummary:
        'SaaS platform for enterprise productivity with AI capabilities including meeting transcription, document generation, and intelligent scheduling.',
      entityCategory: 'software',
      entitySubcategory: 'productivity_platform',

      // Relationships
      relatedEntities: includeRelated
        ? [
            {
              id: 'entity-2',
              name: 'Claude AI',
              relationship: 'uses_technology',
              strength: 'strong',
            },
            {
              id: 'entity-3',
              name: 'Team Collaboration',
              relationship: 'enables',
              strength: 'strong',
            },
            {
              id: 'entity-4',
              name: 'Vector Database',
              relationship: 'implements',
              strength: 'medium',
            },
          ]
        : [],
      parentEntity: null,
      childEntities: [
        { id: 'entity-sub-1', name: 'Meeting Transcription', type: 'feature' },
        { id: 'entity-sub-2', name: 'AI Documentation', type: 'feature' },
        { id: 'entity-sub-3', name: 'Smart Scheduling', type: 'feature' },
      ],

      // Content associations
      mentionedInDocuments: includeContent
        ? [
            {
              id: 'doc-1',
              title: 'Motion AI Implementation Guide',
              type: 'document',
              relevance: 0.95,
              lastMentioned: new Date('2025-09-26T10:00:00Z'),
            },
            {
              id: 'doc-2',
              title: 'AI Platform Comparison Study',
              type: 'document',
              relevance: 0.87,
              lastMentioned: new Date('2025-09-25T14:30:00Z'),
            },
          ]
        : [],
      mentionedInMeetings: includeContent
        ? [
            {
              id: 'meeting-1',
              title: 'Q4 Product Strategy Session',
              type: 'meeting_transcription',
              relevance: 0.92,
              lastMentioned: new Date('2025-09-24T16:00:00Z'),
            },
          ]
        : [],
      knowledgeArticles: includeContent
        ? [
            {
              id: 'article-1',
              title: 'Getting Started with Motion AI',
              type: 'knowledge_article',
              relevance: 0.98,
              lastMentioned: new Date('2025-09-26T08:00:00Z'),
            },
          ]
        : [],

      // Metrics and analytics
      mentionFrequency: 156,
      importanceScore: 0.95,
      trendingScore: 0.23,
      qualityScore: 0.88,

      // Attributes and facts
      entityAttributes: {
        type: 'SaaS platform',
        industry: 'productivity',
        targetMarket: 'enterprise',
        deployment: 'cloud',
        integrations: ['Zoom', 'Microsoft Teams', 'Google Workspace', 'Slack'],
        aiCapabilities: ['transcription', 'document_generation', 'scheduling', 'search'],
        pricing: 'subscription',
        supportedLanguages: 95,
        securityCompliance: ['SOC2', 'GDPR', 'HIPAA'],
      },
      entityFacts: [
        'Launched in 2024 with focus on AI-powered productivity',
        'Integrates with 50+ popular business tools and platforms',
        'Provides 91% accuracy in meeting transcription across 95+ languages',
        'Processes over 10,000 meetings per day with sub-second response times',
        'Used by Fortune 500 companies for enterprise collaboration',
        'Features advanced vector search with semantic understanding',
        'Offers real-time AI writing assistance and content generation',
        'Includes intelligent scheduling with constraint optimization',
      ],

      // AI assessment
      aiConfidenceScore: 0.92,
      aiGeneratedInsights: [
        'Motion AI is positioned as a comprehensive productivity platform rather than a point solution',
        'Strong focus on AI-powered features differentiates from traditional collaboration tools',
        'Enterprise-grade security and compliance features indicate targeting of large organizations',
        'Integration capabilities suggest strategy of fitting into existing tool ecosystems',
      ],

      // Timeline and activity
      entityStatus: 'active',
      createdAt: new Date('2025-09-15T10:00:00Z'),
      updatedAt: new Date('2025-09-26T12:00:00Z'),
      lastMentionedAt: new Date('2025-09-26T09:15:00Z'),

      // Usage statistics
      searchAppearances: 89,
      clickThroughRate: 0.73,
      averageRelevanceScore: 0.91,
      userEngagementScore: 0.85,
    };

    res.json(entity);
  } catch (error) {
    log.error('Error fetching knowledge entity:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge entity' });
  }
});

/**
 * POST /api/search/embeddings
 * Create vector embeddings for content
 */
router.post('/search/embeddings', async (req, res) => {
  try {
    const {
      contentId,
      contentType,
      text,
      title,
      summary,
      keywords,
      category,
      subcategory,
      tags,
      authorId,
      createdAt,
      accessLevel,
      accessPermissions,
    } = req.body;

    if (!contentId || !contentType || !text) {
      return res.status(400).json({ error: 'Content ID, type, and text are required' });
    }

    const embedding = await AISearchKnowledgeService.createContentEmbedding(
      req.user.tenantId,
      contentId,
      contentType,
      {
        text,
        title,
        summary,
        keywords,
        category,
        subcategory,
        tags,
        authorId,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        accessLevel,
        accessPermissions,
      },
    );

    res.status(201).json(embedding);
  } catch (error) {
    log.error('Error creating content embedding:', error);
    res.status(500).json({ error: 'Failed to create content embedding' });
  }
});

/**
 * GET /api/search/analytics
 * Get search analytics and performance insights
 */
router.get('/search/analytics', async (req, res) => {
  try {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date = new Date().toISOString(),
    } = req.query;

    const analytics = await AISearchKnowledgeService.getSearchAnalytics(req.user.tenantId, {
      start: new Date(start_date as string),
      end: new Date(end_date as string),
    });

    res.json(analytics);
  } catch (error) {
    log.error('Error fetching search analytics:', error);
    res.status(500).json({ error: 'Failed to fetch search analytics' });
  }
});

/**
 * GET /api/knowledge/graph
 * Get knowledge graph visualization data
 */
router.get('/knowledge/graph', async (req, res) => {
  try {
    const {
      centerEntity,
      maxDepth = 2,
      minImportance = 0.5,
      includeRelationships = true,
    } = req.query;

    // Mock knowledge graph data
    const graphData = {
      nodes: [
        {
          id: 'entity-1',
          name: 'Motion AI',
          type: 'product',
          category: 'software',
          importance: 0.95,
          size: 95, // Visual size based on importance
          color: '#3B82F6', // Blue for products
          description: 'AI-powered productivity platform',
        },
        {
          id: 'entity-2',
          name: 'Claude AI',
          type: 'technology',
          category: 'artificial_intelligence',
          importance: 0.88,
          size: 88,
          color: '#8B5CF6', // Purple for technology
          description: 'Large language model',
        },
        {
          id: 'entity-3',
          name: 'Team Collaboration',
          type: 'concept',
          category: 'business_process',
          importance: 0.75,
          size: 75,
          color: '#10B981', // Green for concepts
          description: 'Methods for effective teamwork',
        },
        {
          id: 'entity-4',
          name: 'Vector Database',
          type: 'technology',
          category: 'data_storage',
          importance: 0.79,
          size: 79,
          color: '#8B5CF6',
          description: 'High-dimensional vector storage',
        },
      ],
      edges: includeRelationships
        ? [
            {
              id: 'edge-1',
              source: 'entity-1',
              target: 'entity-2',
              relationship: 'uses_technology',
              strength: 0.9,
              width: 4, // Visual width based on strength
              description: 'Motion AI uses Claude AI for content generation',
            },
            {
              id: 'edge-2',
              source: 'entity-1',
              target: 'entity-3',
              relationship: 'enables',
              strength: 0.85,
              width: 3,
              description: 'Motion AI enables team collaboration',
            },
            {
              id: 'edge-3',
              source: 'entity-1',
              target: 'entity-4',
              relationship: 'implements',
              strength: 0.7,
              width: 2,
              description: 'Motion AI implements vector database for search',
            },
            {
              id: 'edge-4',
              source: 'entity-2',
              target: 'entity-4',
              relationship: 'generates_data_for',
              strength: 0.6,
              width: 2,
              description: 'Claude AI generates embeddings for vector database',
            },
          ]
        : [],
      metadata: {
        totalNodes: 4,
        totalEdges: 4,
        centerNode: centerEntity || 'entity-1',
        maxDepth: Number(maxDepth),
        generatedAt: new Date(),
        layout: 'force-directed',
      },
    };

    res.json(graphData);
  } catch (error) {
    log.error('Error fetching knowledge graph:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge graph' });
  }
});

export default router;
