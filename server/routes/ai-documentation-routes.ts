/**
 * AI Documentation Routes
 * API endpoints for intelligent document creation, AI writing assistance, and knowledge management
 */

import express from 'express';
import AIDocumentationService from '../services/ai-documentation-service';
import { createModuleLogger } from '../lib/logger';
import { getUserId, getTenantId } from '../utils/auth-helpers';
const log = createModuleLogger('ai-documentation-routes');

const router = express.Router();

/**
 * POST /api/documents
 * Create a new AI-powered document
 */
router.post('/documents', async (req, res) => {
  try {
    const { title, description, documentTypeId, sourceType, sourceId, initialContent, tags } =
      req.body;

    if (!title) {
      return res.status(400).json({ error: 'Document title is required' });
    }

    const document = await AIDocumentationService.createDocument(req.user.tenantId, req.user.id, {
      title,
      description,
      documentTypeId,
      sourceType,
      sourceId,
      initialContent,
      tags,
    });

    res.status(201).json(document);
  } catch (error) {
    log.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

/**
 * GET /api/documents
 * Get documents with filtering and pagination
 */
router.get('/documents', async (req, res) => {
  try {
    const { status, documentType, tags, createdBy, page = 1, limit = 20, search } = req.query;

    // Mock documents data
    const documents = [
      {
        id: 'doc-1',
        tenantId: req.user.tenantId,
        title: 'Q4 Strategic Planning Meeting Minutes',
        description: 'Comprehensive minutes from Q4 strategic planning session',
        status: 'published',
        version: 2,
        content: {
          summary: 'Strategic planning session focused on Q4 objectives and resource allocation',
          sections: [
            { type: 'header', content: 'Q4 Strategic Planning Session' },
            {
              type: 'attendees',
              content: ['John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Wang'],
            },
            { type: 'discussion', content: 'Key discussion points around Q4 growth strategy...' },
          ],
        },
        wordCount: 1247,
        estimatedReadingTime: 6,
        aiGeneratedPercentage: 0.85,
        aiModelUsed: 'claude-3-5-sonnet-20241022',
        aiConfidenceScore: 0.92,
        sourceType: 'meeting_transcription',
        sourceId: 'meeting-1',
        tags: ['meeting', 'strategic', 'Q4', 'planning'],
        keywords: ['strategic planning', 'Q4 objectives', 'resource allocation'],
        summary:
          'Strategic planning session outlining Q4 growth objectives and resource requirements',
        viewCount: 45,
        editCount: 3,
        createdBy: req.user.id,
        createdAt: new Date('2025-09-27T10:00:00Z'),
        updatedAt: new Date('2025-09-27T14:30:00Z'),
        publishedAt: new Date('2025-09-27T15:00:00Z'),
      },
      {
        id: 'doc-2',
        tenantId: req.user.tenantId,
        title: 'Enterprise Client Proposal - TechCorp Solutions',
        description: 'Comprehensive proposal for TechCorp enterprise engagement',
        status: 'review',
        version: 1,
        content: {
          executiveSummary: 'Proposal for comprehensive enterprise software solution...',
          sections: [
            { type: 'executive_summary', content: 'Executive overview of proposed solution' },
            { type: 'problem_statement', content: 'Current challenges and pain points' },
            { type: 'solution', content: 'Proposed comprehensive solution approach' },
          ],
        },
        wordCount: 2156,
        estimatedReadingTime: 11,
        aiGeneratedPercentage: 0.65,
        aiModelUsed: 'claude-3-5-sonnet-20241022',
        aiConfidenceScore: 0.88,
        sourceType: 'template',
        sourceId: 'template-proposal-1',
        tags: ['proposal', 'enterprise', 'client', 'TechCorp'],
        keywords: ['enterprise solution', 'software implementation', 'business transformation'],
        summary: 'Enterprise proposal outlining comprehensive software solution for TechCorp',
        viewCount: 23,
        editCount: 7,
        assignedTo: 'user-reviewer-1',
        reviewers: ['user-reviewer-1', 'user-manager-1'],
        approvalStatus: 'pending',
        createdBy: req.user.id,
        createdAt: new Date('2025-09-26T09:00:00Z'),
        updatedAt: new Date('2025-09-27T11:15:00Z'),
      },
      {
        id: 'doc-3',
        tenantId: req.user.tenantId,
        title: 'Project Status Report - Q3 Implementation',
        description: 'Detailed progress report for Q3 implementation milestones',
        status: 'draft',
        version: 1,
        content: {
          overview: 'Q3 implementation progress and milestone achievements',
          sections: [
            { type: 'overview', content: 'Project overview and current status' },
            { type: 'progress', content: 'Milestone achievements and progress metrics' },
            { type: 'challenges', content: 'Current challenges and mitigation strategies' },
          ],
        },
        wordCount: 892,
        estimatedReadingTime: 4,
        aiGeneratedPercentage: 0.45,
        aiModelUsed: 'claude-3-5-sonnet-20241022',
        aiConfidenceScore: 0.79,
        sourceType: 'manual',
        tags: ['report', 'project', 'Q3', 'implementation'],
        keywords: ['project status', 'milestone tracking', 'implementation progress'],
        summary: 'Comprehensive status report covering Q3 implementation progress and milestones',
        viewCount: 12,
        editCount: 5,
        createdBy: req.user.id,
        createdAt: new Date('2025-09-25T14:00:00Z'),
        updatedAt: new Date('2025-09-27T09:45:00Z'),
      },
    ];

    // Apply basic filtering
    let filteredDocuments = documents;

    if (status) {
      filteredDocuments = filteredDocuments.filter((doc) => doc.status === status);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredDocuments = filteredDocuments.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchLower) ||
          doc.description?.toLowerCase().includes(searchLower) ||
          doc.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      );
    }

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

    res.json({
      documents: paginatedDocuments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredDocuments.length,
        pages: Math.ceil(filteredDocuments.length / Number(limit)),
      },
      filters: { status, documentType, tags, createdBy, search },
    });
  } catch (error) {
    log.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * GET /api/documents/:documentId
 * Get a specific document with full content
 */
router.get('/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { includeHistory = false, includeSuggestions = false } = req.query;

    // Mock document retrieval
    const document = {
      id: documentId,
      tenantId: req.user.tenantId,
      title: 'Q4 Strategic Planning Meeting Minutes',
      description: 'Comprehensive minutes from Q4 strategic planning session',
      status: 'published',
      version: 2,
      parentDocumentId: null,

      content: {
        header: {
          meetingTitle: 'Q4 Strategic Planning Session',
          date: '2025-09-27',
          time: '10:00 AM - 12:00 PM',
          location: 'Conference Room A / Zoom Hybrid',
        },
        attendees: [
          { name: 'John Smith', role: 'CEO', present: true },
          { name: 'Sarah Johnson', role: 'VP Sales', present: true },
          { name: 'Mike Chen', role: 'VP Marketing', present: true },
          { name: 'Lisa Wang', role: 'VP Operations', present: true },
        ],
        agenda: [
          'Q3 Performance Review',
          'Q4 Strategic Objectives',
          'Resource Allocation',
          'Market Expansion Plans',
          'Budget Approval',
        ],
        discussion: {
          q3Performance: {
            content:
              'Sarah presented exceptional Q3 results with 23% revenue increase over Q2. The new client acquisition strategy exceeded all projections.',
            keyPoints: [
              '23% revenue increase over Q2',
              'Client acquisition strategy success',
              'All Q3 targets exceeded',
            ],
            speaker: 'Sarah Johnson',
            timestamp: '10:15 AM',
          },
          q4Objectives: {
            content:
              'Team aligned on aggressive Q4 growth strategy focusing on market expansion and team scaling.',
            keyPoints: [
              'Aggressive growth strategy',
              'Market expansion focus',
              'Team scaling initiatives',
            ],
            speaker: 'John Smith',
            timestamp: '10:30 AM',
          },
        },
        decisions: [
          {
            decision: 'Approve 15% marketing budget increase for Q4',
            decisionMaker: 'John Smith',
            context: 'To support aggressive growth strategy and market expansion',
            impact: 'high',
            timestamp: '11:15 AM',
          },
          {
            decision: 'Hire 3 additional sales representatives',
            decisionMaker: 'Team Consensus',
            context: 'To handle increased demand from successful client acquisition',
            impact: 'high',
            timestamp: '11:30 AM',
          },
        ],
        actionItems: [
          {
            task: 'Prepare detailed Q4 marketing budget proposal',
            assignee: 'Mike Chen',
            dueDate: '2025-10-05',
            priority: 'high',
            status: 'open',
          },
          {
            task: 'Begin recruitment process for sales representatives',
            assignee: 'Sarah Johnson',
            dueDate: '2025-10-10',
            priority: 'high',
            status: 'open',
          },
          {
            task: 'Research customer support infrastructure options',
            assignee: 'Lisa Wang',
            dueDate: '2025-10-08',
            priority: 'medium',
            status: 'open',
          },
        ],
        nextSteps: [
          'Schedule Q4 budget review meeting for October 8th',
          'Finalize sales team expansion timeline',
          'Develop customer success metrics for account management program',
        ],
      },

      plainTextContent:
        'Q4 Strategic Planning Session meeting minutes with key decisions and action items...',
      wordCount: 1247,
      estimatedReadingTime: 6,

      // AI metadata
      aiGeneratedPercentage: 0.85,
      aiModelUsed: 'claude-3-5-sonnet-20241022',
      aiGenerationPrompts: [
        'Generate professional meeting minutes from transcription',
        'Extract key decisions and action items',
        'Structure content for business documentation',
      ],
      aiConfidenceScore: 0.92,

      // Source information
      sourceType: 'meeting_transcription',
      sourceId: 'meeting-1',
      sourceMetadata: {
        meetingDuration: '120 minutes',
        transcriptionConfidence: 0.94,
        speakerCount: 4,
        recordingQuality: 'excellent',
      },

      // Collaboration
      assignedTo: null,
      reviewers: [],
      approvalStatus: 'approved',

      // Access control
      isPublic: false,
      publicUrl: null,
      accessPermissions: [req.user.id, 'user-manager-1'],
      sharingSettings: {
        allowComments: true,
        allowDownload: true,
        expirationDate: null,
      },

      // Categorization
      tags: ['meeting', 'strategic', 'Q4', 'planning', 'ai-generated'],
      keywords: ['strategic planning', 'Q4 objectives', 'resource allocation', 'growth strategy'],
      summary:
        'Strategic planning session outlining Q4 growth objectives, budget approvals, and resource requirements with specific action items and timelines.',

      // Analytics
      viewCount: 45,
      editCount: 3,
      lastViewedAt: new Date('2025-09-27T16:30:00Z'),
      lastEditedAt: new Date('2025-09-27T14:30:00Z'),

      // Timestamps
      createdBy: req.user.id,
      createdAt: new Date('2025-09-27T10:00:00Z'),
      updatedAt: new Date('2025-09-27T14:30:00Z'),
      publishedAt: new Date('2025-09-27T15:00:00Z'),
      archivedAt: null,
    };

    // Include edit history if requested
    if (includeHistory === 'true') {
      (document as any).editHistory = [
        {
          version: 1,
          editedBy: req.user.id,
          editedAt: new Date('2025-09-27T12:00:00Z'),
          changes: ['Initial AI generation from meeting transcription'],
          changesSummary: 'Document created from meeting transcription',
        },
        {
          version: 2,
          editedBy: req.user.id,
          editedAt: new Date('2025-09-27T14:30:00Z'),
          changes: ['Added detailed action item assignments', 'Enhanced decision context'],
          changesSummary: 'Added action item details and decision context',
        },
      ];
    }

    // Include AI suggestions if requested
    if (includeSuggestions === 'true') {
      (document as any).aiSuggestions = [
        {
          id: 'suggestion-1',
          suggestionType: 'content',
          title: 'Add Timeline Visualization',
          description: 'Consider adding a visual timeline for the action items to improve clarity',
          importance: 'medium',
          confidenceScore: 0.78,
          status: 'pending',
        },
        {
          id: 'suggestion-2',
          suggestionType: 'structure',
          title: 'Group Related Action Items',
          description: 'Group action items by department or theme for better organization',
          importance: 'low',
          confidenceScore: 0.65,
          status: 'pending',
        },
      ];
    }

    res.json(document);
  } catch (error) {
    log.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

/**
 * POST /api/documents/from-meeting
 * Generate document from meeting transcription
 */
router.post('/documents/from-meeting', async (req, res) => {
  try {
    const { meetingId, transcriptionData, documentType = 'meeting_minutes' } = req.body;

    if (!meetingId || !transcriptionData) {
      return res.status(400).json({ error: 'Meeting ID and transcription data are required' });
    }

    const document = await AIDocumentationService.generateDocumentFromMeeting(
      req.user.tenantId,
      req.user.id,
      meetingId,
      transcriptionData,
      documentType,
    );

    res.status(201).json(document);
  } catch (error) {
    log.error('Error generating document from meeting:', error);
    res.status(500).json({ error: 'Failed to generate document from meeting' });
  }
});

/**
 * POST /api/documents/:documentId/sections/generate
 * Generate AI content for a document section
 */
router.post('/documents/:documentId/sections/generate', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { sectionType, prompt, context = {} } = req.body;

    if (!sectionType || !prompt) {
      return res.status(400).json({ error: 'Section type and prompt are required' });
    }

    const result = await AIDocumentationService.generateSectionContent(
      documentId,
      sectionType,
      prompt,
      context,
    );

    res.json(result);
  } catch (error) {
    log.error('Error generating section content:', error);
    res.status(500).json({ error: 'Failed to generate section content' });
  }
});

/**
 * POST /api/documents/:documentId/improve
 * AI-powered content improvement
 */
router.post('/documents/:documentId/improve', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { content, improvementType = 'grammar', context = {} } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content to improve is required' });
    }

    const result = await AIDocumentationService.improveContent(
      documentId,
      content,
      improvementType,
      context,
    );

    res.json(result);
  } catch (error) {
    log.error('Error improving content:', error);
    res.status(500).json({ error: 'Failed to improve content' });
  }
});

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
      req.user.tenantId,
      req.user.id,
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
        tenantId: req.user.tenantId,
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
        createdBy: req.user.id,
        createdAt: new Date('2025-09-20T10:00:00Z'),
        updatedAt: new Date('2025-09-25T14:30:00Z'),
        publishedAt: new Date('2025-09-20T15:00:00Z'),
      },
      {
        id: 'article-2',
        tenantId: req.user.tenantId,
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
        createdBy: req.user.id,
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
router.post('/documents/search', async (req, res) => {
  try {
    const { query, filters = {}, options = {} } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchResults = await AIDocumentationService.searchDocuments(
      req.user.tenantId,
      query,
      filters,
      options,
    );

    res.json(searchResults);
  } catch (error) {
    log.error('Error searching documents:', error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
});

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

    const analytics = await AIDocumentationService.getWritingAnalytics(req.user.tenantId, {
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
