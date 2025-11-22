/**
 * AI Documentation Service
 * Intelligent document creation, AI writing assistance, and knowledge organization
 */

import { db } from '../db';
import ClaudeAIService from './claude-ai-service';
import { eq, and, sql, desc, asc, like, ilike } from 'drizzle-orm';

interface DocumentType {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: 'meeting' | 'proposal' | 'report' | 'contract' | 'template' | 'knowledge_base';
  templateStructure: Record<string, any>;
  aiWritingPrompts: string[];
  defaultFormatting: Record<string, any>;
  requiredSections: string[];
  optionalSections: string[];
  aiTone: 'professional' | 'casual' | 'technical' | 'friendly' | 'formal';
  aiComplexityLevel: 'simple' | 'medium' | 'advanced' | 'expert';
  aiLengthPreference: 'brief' | 'medium' | 'detailed' | 'comprehensive';
  usageCount: number;
  successRate: number;
  isSystemTemplate: boolean;
  isActive: boolean;
  createdBy: string;
}

interface AIDocument {
  id: string;
  tenantId: string;
  documentTypeId?: string;
  title: string;
  description?: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  version: number;
  parentDocumentId?: string;
  content: Record<string, any>;
  plainTextContent?: string;
  wordCount: number;
  estimatedReadingTime: number;
  aiGeneratedPercentage: number;
  aiModelUsed?: string;
  aiGenerationPrompts: string[];
  aiConfidenceScore: number;
  sourceType?: 'meeting_transcription' | 'template' | 'manual' | 'ai_generated';
  sourceId?: string;
  sourceMetadata: Record<string, any>;
  assignedTo?: string;
  reviewers: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  isPublic: boolean;
  publicUrl?: string;
  accessPermissions: string[];
  sharingSettings: Record<string, any>;
  tags: string[];
  keywords: string[];
  summary?: string;
  viewCount: number;
  editCount: number;
  lastViewedAt?: Date;
  lastEditedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  archivedAt?: Date;
}

interface DocumentSection {
  id: string;
  documentId: string;
  tenantId: string;
  sectionType: 'header' | 'paragraph' | 'list' | 'table' | 'image' | 'chart';
  sectionName?: string;
  sectionOrder: number;
  parentSectionId?: string;
  content: Record<string, any>;
  plainTextContent?: string;
  formatting: Record<string, any>;
  aiGenerated: boolean;
  aiPromptUsed?: string;
  aiModelUsed?: string;
  aiConfidenceScore: number;
  aiGenerationTime?: Date;
  lastEditedBy?: string;
  editHistory: Array<any>;
  comments: Array<any>;
  status: 'draft' | 'review' | 'approved';
  requiresReview: boolean;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ContentSuggestion {
  id: string;
  documentId: string;
  sectionId?: string;
  tenantId: string;
  suggestionType: 'grammar' | 'style' | 'content' | 'structure' | 'tone' | 'clarity';
  suggestionTitle: string;
  suggestionDescription: string;
  originalContent: string;
  suggestedContent: string;
  changeType: 'replacement' | 'addition' | 'deletion' | 'restructure';
  confidenceScore: number;
  importanceLevel: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  userResponse?: string;
  appliedAt?: Date;
  rejectedAt?: Date;
  tags: string[];
  affectsSections: string[];
  aiModelUsed: string;
  generatedAt: Date;
}

interface WritingSession {
  id: string;
  documentId: string;
  tenantId: string;
  userId: string;
  sessionType: 'content_generation' | 'editing_assistance' | 'formatting' | 'review';
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  promptsUsed: string[];
  aiResponses: Array<any>;
  userActions: Array<any>;
  contentBefore?: Record<string, any>;
  contentAfter?: Record<string, any>;
  changesMade: Array<any>;
  wordsGenerated: number;
  wordsEdited: number;
  aiSuggestionsAccepted: number;
  aiSuggestionsRejected: number;
  userSatisfactionRating?: number;
  aiResponseTimeMs: number;
  aiModelUsed: string;
  aiTokensUsed: number;
}

class AIDocumentationService {
  /**
   * Create a new AI-powered document
   */
  async createDocument(
    tenantId: string,
    userId: string,
    documentData: {
      title: string;
      description?: string;
      documentTypeId?: string;
      sourceType?: string;
      sourceId?: string;
      initialContent?: Record<string, any>;
      tags?: string[];
    },
  ): Promise<AIDocument> {
    console.log('📄 Creating new AI document:', documentData.title);

    try {
      const documentType = documentData.documentTypeId
        ? await this.getDocumentType(tenantId, documentData.documentTypeId)
        : null;

      // Generate initial content structure if not provided
      let content = documentData.initialContent || {};
      let aiGeneratedPercentage = 0;
      let aiConfidenceScore = 0;
      let generationPrompts: string[] = [];

      if (!documentData.initialContent && documentType) {
        const aiContent = await this.generateInitialContent(documentType, documentData);
        content = aiContent.content;
        aiGeneratedPercentage = aiContent.aiGeneratedPercentage;
        aiConfidenceScore = aiContent.aiConfidenceScore;
        generationPrompts = aiContent.prompts;
      }

      const plainTextContent = this.extractPlainText(content);
      const wordCount = this.countWords(plainTextContent);
      const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 WPM average

      const document: AIDocument = {
        id: `doc-${Date.now()}`,
        tenantId,
        documentTypeId: documentData.documentTypeId,
        title: documentData.title,
        description: documentData.description,
        status: 'draft',
        version: 1,
        content,
        plainTextContent,
        wordCount,
        estimatedReadingTime,
        aiGeneratedPercentage,
        aiModelUsed: 'claude-3-5-sonnet-20241022',
        aiGenerationPrompts: generationPrompts,
        aiConfidenceScore,
        sourceType: documentData.sourceType as any,
        sourceId: documentData.sourceId,
        sourceMetadata: {},
        reviewers: [],
        approvalStatus: 'pending',
        isPublic: false,
        accessPermissions: [userId],
        sharingSettings: {},
        tags: documentData.tags || [],
        keywords: [],
        viewCount: 0,
        editCount: 0,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('✅ AI document created successfully:', document.id);
      return document;
    } catch (error) {
      console.error('Failed to create AI document:', error);
      throw error;
    }
  }

  /**
   * Generate document content from meeting transcription
   */
  async generateDocumentFromMeeting(
    tenantId: string,
    userId: string,
    meetingId: string,
    transcriptionData: any,
    documentType: 'meeting_minutes' | 'summary' | 'action_items' = 'meeting_minutes',
  ): Promise<AIDocument> {
    console.log('🎙️ Generating document from meeting transcription:', meetingId);

    try {
      const prompt = this.buildMeetingDocumentPrompt(transcriptionData, documentType);

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const generatedContent = JSON.parse(aiResponse);

      const document = await this.createDocument(tenantId, userId, {
        title: generatedContent.title,
        description: `AI-generated ${documentType.replace('_', ' ')} from meeting`,
        documentTypeId: await this.getDocumentTypeIdByCategory(tenantId, 'meeting'),
        sourceType: 'meeting_transcription',
        sourceId: meetingId,
        initialContent: generatedContent.content,
        tags: ['meeting', documentType, 'ai-generated'],
      });

      console.log('✅ Document generated from meeting successfully');
      return document;
    } catch (error) {
      console.error('Failed to generate document from meeting:', error);
      throw error;
    }
  }

  /**
   * AI-powered content generation for document sections
   */
  async generateSectionContent(
    documentId: string,
    sectionType: string,
    prompt: string,
    context: {
      documentTitle?: string;
      existingContent?: Record<string, any>;
      tone?: string;
      length?: 'brief' | 'medium' | 'detailed';
    } = {},
  ): Promise<{
    content: Record<string, any>;
    plainText: string;
    confidenceScore: number;
    suggestions: ContentSuggestion[];
  }> {
    console.log('✨ Generating AI content for section:', sectionType);

    try {
      const enhancedPrompt = this.buildSectionPrompt(prompt, sectionType, context);

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: enhancedPrompt }],
        temperature: 0.4,
        max_tokens: 2000,
      });

      const generatedData = JSON.parse(aiResponse);

      // Generate content suggestions
      const suggestions = await this.generateContentSuggestions(
        documentId,
        generatedData.content,
        sectionType,
      );

      return {
        content: generatedData.content,
        plainText: generatedData.plainText,
        confidenceScore: generatedData.confidenceScore || 0.85,
        suggestions,
      };
    } catch (error) {
      console.error('AI content generation failed:', error);
      return {
        content: { text: 'Failed to generate content. Please try again.' },
        plainText: 'Failed to generate content. Please try again.',
        confidenceScore: 0,
        suggestions: [],
      };
    }
  }

  /**
   * AI writing assistance and content improvement
   */
  async improveContent(
    documentId: string,
    content: string,
    improvementType: 'grammar' | 'style' | 'clarity' | 'tone' | 'structure' = 'grammar',
    context: {
      targetAudience?: string;
      purpose?: string;
      tone?: string;
    } = {},
  ): Promise<{
    improvedContent: string;
    suggestions: ContentSuggestion[];
    confidenceScore: number;
    changes: Array<{
      type: string;
      original: string;
      improved: string;
      reasoning: string;
    }>;
  }> {
    console.log('🔧 Improving content with AI assistance:', improvementType);

    try {
      const prompt = `Improve the following content for ${improvementType}:

ORIGINAL CONTENT:
${content}

CONTEXT:
- Target Audience: ${context.targetAudience || 'General business audience'}
- Purpose: ${context.purpose || 'Professional communication'}
- Desired Tone: ${context.tone || 'Professional'}

Provide improvements and explain each change. Return JSON format:
{
  "improvedContent": "The improved version of the content",
  "changes": [
    {
      "type": "${improvementType}",
      "original": "original text",
      "improved": "improved text",
      "reasoning": "explanation of why this change improves the content"
    }
  ],
  "overallAssessment": "Overall assessment of content quality",
  "confidenceScore": 0.85
}`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 3000,
      });

      const improvementData = JSON.parse(aiResponse);

      // Convert changes to content suggestions
      const suggestions: ContentSuggestion[] = improvementData.changes.map(
        (change: any, index: number) => ({
          id: `suggestion-${Date.now()}-${index}`,
          documentId,
          tenantId: 'mock-tenant',
          suggestionType: improvementType,
          suggestionTitle: `${improvementType.charAt(0).toUpperCase() + improvementType.slice(1)} Improvement`,
          suggestionDescription: change.reasoning,
          originalContent: change.original,
          suggestedContent: change.improved,
          changeType: 'replacement',
          confidenceScore: improvementData.confidenceScore,
          importanceLevel: 'medium',
          reasoning: change.reasoning,
          status: 'pending',
          tags: [improvementType],
          affectsSections: [],
          aiModelUsed: 'claude-3-5-sonnet-20241022',
          generatedAt: new Date(),
        }),
      );

      return {
        improvedContent: improvementData.improvedContent,
        suggestions,
        confidenceScore: improvementData.confidenceScore,
        changes: improvementData.changes,
      };
    } catch (error) {
      console.error('Content improvement failed:', error);
      return {
        improvedContent: content,
        suggestions: [],
        confidenceScore: 0,
        changes: [],
      };
    }
  }

  /**
   * Create knowledge base article with AI enhancement
   */
  async createKnowledgeArticle(
    tenantId: string,
    userId: string,
    articleData: {
      title: string;
      category: string;
      subcategory?: string;
      content: Record<string, any>;
      tags?: string[];
      targetAudience?: string;
    },
  ): Promise<{
    id: string;
    aiEnhancements: {
      summary: string;
      keywords: string[];
      relatedTopics: string[];
      difficultyLevel: string;
      qualityScore: number;
    };
  }> {
    console.log('📚 Creating knowledge base article:', articleData.title);

    try {
      const plainTextContent = this.extractPlainText(articleData.content);
      const wordCount = this.countWords(plainTextContent);
      const estimatedReadingTime = Math.ceil(wordCount / 200);

      // Generate AI enhancements
      const enhancements = await this.generateKnowledgeEnhancements(
        articleData.title,
        plainTextContent,
        articleData.category,
        articleData.targetAudience,
      );

      const article = {
        id: `article-${Date.now()}`,
        tenantId,
        title: articleData.title,
        slug: this.generateSlug(articleData.title),
        category: articleData.category,
        subcategory: articleData.subcategory,
        content: articleData.content,
        plainTextContent,
        excerpt: enhancements.summary.substring(0, 200) + '...',
        wordCount,
        estimatedReadingTime,
        aiGeneratedSummary: enhancements.summary,
        aiExtractedKeywords: enhancements.keywords,
        aiRelatedTopics: enhancements.relatedTopics,
        aiDifficultyLevel: enhancements.difficultyLevel,
        aiContentQualityScore: enhancements.qualityScore,
        tags: articleData.tags || [],
        searchKeywords: enhancements.keywords,
        status: 'draft',
        viewCount: 0,
        helpfulVotes: 0,
        unhelpfulVotes: 0,
        averageRating: 0,
        featured: false,
        isPublic: true,
        relatedArticles: [],
        prerequisites: [],
        contentFreshnessScore: 1.0,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('✅ Knowledge article created with AI enhancements');
      return {
        id: article.id,
        aiEnhancements: enhancements,
      };
    } catch (error) {
      console.error('Failed to create knowledge article:', error);
      throw error;
    }
  }

  /**
   * Search documents with AI-powered relevance ranking
   */
  async searchDocuments(
    tenantId: string,
    query: string,
    filters: {
      documentType?: string;
      status?: string;
      tags?: string[];
      dateRange?: { start: Date; end: Date };
      createdBy?: string;
    } = {},
    options: {
      limit?: number;
      offset?: number;
      includeContent?: boolean;
    } = {},
  ): Promise<{
    results: Array<{
      document: AIDocument;
      relevanceScore: number;
      matchedContent: string[];
      highlights: string[];
    }>;
    totalResults: number;
    searchTime: number;
    suggestions: string[];
  }> {
    console.log('🔍 Searching documents with AI ranking:', query);

    const startTime = Date.now();

    try {
      // Mock search results with AI relevance ranking
      const mockResults = [
        {
          document: {
            id: 'doc-1',
            tenantId,
            title: 'Q4 Planning Meeting Minutes',
            description: 'Strategic planning session for Q4 objectives',
            status: 'published' as const,
            content: { summary: 'Q4 strategic planning discussion with key decisions' },
            tags: ['meeting', 'planning', 'Q4'],
            createdBy: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            wordCount: 1200,
            estimatedReadingTime: 6,
            aiConfidenceScore: 0.92,
            viewCount: 45,
            editCount: 3,
          } as AIDocument,
          relevanceScore: 0.95,
          matchedContent: ['Q4 planning objectives', 'strategic decisions made'],
          highlights: ['Q4', 'planning', 'strategic'],
        },
        {
          document: {
            id: 'doc-2',
            tenantId,
            title: 'Client Proposal Template',
            description: 'Standardized template for client proposals',
            status: 'approved' as const,
            content: { template: 'Professional proposal structure' },
            tags: ['template', 'proposal', 'client'],
            createdBy: 'user-2',
            createdAt: new Date(),
            updatedAt: new Date(),
            wordCount: 800,
            estimatedReadingTime: 4,
            aiConfidenceScore: 0.88,
            viewCount: 23,
            editCount: 1,
          } as AIDocument,
          relevanceScore: 0.78,
          matchedContent: ['client proposal structure', 'professional template'],
          highlights: ['client', 'proposal', 'template'],
        },
      ];

      const searchTime = Date.now() - startTime;

      return {
        results: mockResults,
        totalResults: mockResults.length,
        searchTime,
        suggestions: ['meeting minutes', 'project reports', 'client proposals'],
      };
    } catch (error) {
      console.error('Document search failed:', error);
      throw error;
    }
  }

  /**
   * Get AI writing analytics and insights
   */
  async getWritingAnalytics(
    tenantId: string,
    timeRange: { start: Date; end: Date },
  ): Promise<{
    documentsCreated: number;
    aiSessionsConducted: number;
    totalWordsGenerated: number;
    averageAiConfidence: number;
    suggestionsAccepted: number;
    suggestionsRejected: number;
    averageUserSatisfaction: number;
    popularDocumentTypes: Array<{ type: string; count: number }>;
    contentQualityTrends: Array<{ date: string; score: number }>;
    aiInsights: string[];
    recommendations: string[];
  }> {
    console.log('📊 Generating AI writing analytics...');

    // Mock analytics data
    return {
      documentsCreated: 127,
      aiSessionsConducted: 89,
      totalWordsGenerated: 45600,
      averageAiConfidence: 0.87,
      suggestionsAccepted: 234,
      suggestionsRejected: 67,
      averageUserSatisfaction: 4.3,
      popularDocumentTypes: [
        { type: 'Meeting Minutes', count: 45 },
        { type: 'Business Proposal', count: 32 },
        { type: 'Project Report', count: 28 },
        { type: 'Knowledge Article', count: 22 },
      ],
      contentQualityTrends: [
        { date: '2025-09-20', score: 0.82 },
        { date: '2025-09-21', score: 0.85 },
        { date: '2025-09-22', score: 0.87 },
        { date: '2025-09-23', score: 0.89 },
        { date: '2025-09-24', score: 0.87 },
      ],
      aiInsights: [
        'AI-generated content quality has improved by 12% over the past month',
        'Meeting minutes are the most frequently created document type',
        'Users accept 78% of AI content suggestions, indicating high relevance',
        'Average document completion time has decreased by 35% with AI assistance',
      ],
      recommendations: [
        'Consider creating more templates for frequently used document types',
        'Implement advanced formatting suggestions to improve document presentation',
        'Add industry-specific writing prompts for better content relevance',
        'Introduce collaborative editing features for team document creation',
      ],
    };
  }

  // Helper methods
  private async getDocumentType(
    tenantId: string,
    documentTypeId: string,
  ): Promise<DocumentType | null> {
    // Mock document type retrieval
    return {
      id: documentTypeId,
      tenantId,
      name: 'Meeting Minutes',
      description: 'Structured meeting minutes',
      category: 'meeting',
      templateStructure: { sections: ['header', 'attendees', 'discussion', 'action_items'] },
      aiWritingPrompts: ['Generate professional meeting minutes'],
      defaultFormatting: { font: 'Arial', size: 12 },
      requiredSections: ['header', 'discussion'],
      optionalSections: ['appendix'],
      aiTone: 'professional',
      aiComplexityLevel: 'medium',
      aiLengthPreference: 'medium',
      usageCount: 0,
      successRate: 0.85,
      isSystemTemplate: true,
      isActive: true,
      createdBy: 'system',
    };
  }

  private async generateInitialContent(
    documentType: DocumentType,
    documentData: any,
  ): Promise<{
    content: Record<string, any>;
    aiGeneratedPercentage: number;
    aiConfidenceScore: number;
    prompts: string[];
  }> {
    const prompts = documentType.aiWritingPrompts;
    const content = {
      sections:
        documentType.templateStructure.sections?.map((section: string) => ({
          type: section,
          content: `[AI will generate ${section} content based on your input]`,
          aiGenerated: true,
        })) || [],
    };

    return {
      content,
      aiGeneratedPercentage: 0.8,
      aiConfidenceScore: 0.75,
      prompts,
    };
  }

  private buildMeetingDocumentPrompt(transcriptionData: any, documentType: string): string {
    return `Generate a professional ${documentType.replace('_', ' ')} from this meeting transcription:

MEETING TRANSCRIPTION:
${transcriptionData.fullTranscript || 'Mock meeting transcript content'}

SPEAKERS:
${transcriptionData.speakers?.map((s: any) => s.name).join(', ') || 'John Smith, Sarah Johnson'}

Generate structured content in JSON format:
{
  "title": "Meeting title",
  "content": {
    "summary": "Brief meeting summary",
    "attendees": ["List of attendees"],
    "keyPoints": ["Key discussion points"],
    "decisions": ["Decisions made"],
    "actionItems": [
      {
        "task": "Action item description",
        "assignee": "Person responsible",
        "dueDate": "Due date if mentioned"
      }
    ],
    "nextSteps": ["Next steps and follow-ups"]
  }
}`;
  }

  private buildSectionPrompt(prompt: string, sectionType: string, context: any): string {
    return `Generate ${sectionType} content for a business document:

USER REQUEST: ${prompt}

CONTEXT:
- Document Title: ${context.documentTitle || 'Business Document'}
- Desired Tone: ${context.tone || 'Professional'}
- Length: ${context.length || 'Medium'}

Generate content in JSON format:
{
  "content": {
    "text": "The generated content text",
    "formatting": {
      "style": "paragraph",
      "emphasis": []
    }
  },
  "plainText": "Plain text version for search",
  "confidenceScore": 0.85
}`;
  }

  private async generateContentSuggestions(
    documentId: string,
    content: Record<string, any>,
    sectionType: string,
  ): Promise<ContentSuggestion[]> {
    // Mock content suggestions
    return [
      {
        id: `suggestion-${Date.now()}`,
        documentId,
        tenantId: 'mock-tenant',
        suggestionType: 'clarity',
        suggestionTitle: 'Improve Clarity',
        suggestionDescription:
          'Consider breaking this long sentence into shorter ones for better readability.',
        originalContent: 'Original text content',
        suggestedContent: 'Improved text content',
        changeType: 'replacement',
        confidenceScore: 0.82,
        importanceLevel: 'medium',
        reasoning: 'Shorter sentences improve readability and comprehension',
        status: 'pending',
        tags: ['clarity', 'readability'],
        affectsSections: [],
        aiModelUsed: 'claude-3-5-sonnet-20241022',
        generatedAt: new Date(),
      },
    ];
  }

  private async generateKnowledgeEnhancements(
    title: string,
    content: string,
    category: string,
    targetAudience?: string,
  ): Promise<{
    summary: string;
    keywords: string[];
    relatedTopics: string[];
    difficultyLevel: string;
    qualityScore: number;
  }> {
    // Mock AI enhancements
    return {
      summary: `This article covers ${title.toLowerCase()} with practical examples and step-by-step guidance for ${targetAudience || 'users'}.`,
      keywords: ['tutorial', 'guide', 'how-to', category.toLowerCase()],
      relatedTopics: [
        `Advanced ${category}`,
        `${category} Best Practices`,
        `Common ${category} Issues`,
      ],
      difficultyLevel: 'intermediate',
      qualityScore: 0.88,
    };
  }

  private async getDocumentTypeIdByCategory(tenantId: string, category: string): Promise<string> {
    // Mock document type ID lookup
    return 'doc-type-meeting-1';
  }

  private extractPlainText(content: Record<string, any>): string {
    // Extract plain text from structured content
    if (typeof content === 'string') return content;
    if (content.text) return content.text;
    if (content.sections) {
      return content.sections.map((s: any) => s.content || '').join(' ');
    }
    return JSON.stringify(content);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}

export default new AIDocumentationService();
