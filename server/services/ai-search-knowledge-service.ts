/**
 * AI Search & Knowledge Service
 * Vector database search, AI query processing, and intelligent answer generation
 */

import { db } from '../db';
import ClaudeAIService from './claude-ai-service';
import { eq, and, sql, desc, asc, like, ilike } from 'drizzle-orm';

interface VectorEmbedding {
  id: string;
  tenantId: string;
  contentId: string;
  contentType:
    | 'document'
    | 'meeting_transcription'
    | 'knowledge_article'
    | 'email'
    | 'chat_message';
  contentSection?: string;
  embeddingVector: number[]; // 1536-dimensional vector
  embeddingModel: string;
  contentText: string;
  contentTitle?: string;
  contentSummary?: string;
  contentKeywords: string[];
  contentCategory?: string;
  contentSubcategory?: string;
  contentTags: string[];
  contentLanguage: string;
  contentAuthorId?: string;
  contentCreatedAt?: Date;
  accessLevel: 'tenant' | 'public' | 'restricted' | 'private';
  accessPermissions: string[];
  contentQualityScore: number;
  engagementScore: number;
  freshnessScore: number;
  embeddingConfidence: number;
  lastUpdatedEmbedding: Date;
  embeddingSource: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SearchQuery {
  id: string;
  tenantId: string;
  userId: string;
  queryText: string;
  queryIntent?: 'factual' | 'how_to' | 'troubleshooting' | 'definition' | 'comparison';
  queryLanguage: string;
  searchFilters: Record<string, any>;
  searchScope: string[];
  maxResults: number;
  queryEmbedding?: number[];
  queryExpansion: string[];
  semanticIntent: Record<string, any>;
  resultsCount: number;
  topResultScores: number[];
  responseTimeMs: number;
  userSatisfactionRating?: number;
  clickedResults: string[];
  followUpQueryId?: string;
  resultQualityFeedback: Record<string, any>;
  querySuccessIndicators: Record<string, any>;
  createdAt: Date;
}

interface AIGeneratedAnswer {
  id: string;
  tenantId: string;
  queryId: string;
  answerText: string;
  answerConfidence: number;
  answerType: 'direct' | 'synthesized' | 'step_by_step' | 'comparison' | 'summary';
  sourceDocuments: Array<{
    id: string;
    type: string;
    title: string;
    excerpt: string;
    relevanceScore: number;
  }>;
  sourceConfidence: number[];
  citationStyle: 'inline' | 'footnotes' | 'bibliography';
  answerSections: Array<{
    title: string;
    content: string;
    sources: string[];
  }>;
  keyPoints: string[];
  relatedTopics: string[];
  factualAccuracyScore?: number;
  completenessScore?: number;
  clarityScore?: number;
  usefulnessScore?: number;
  userHelpfulVotes: number;
  userUnhelpfulVotes: number;
  userCorrections: Array<any>;
  expertValidationStatus?: 'pending' | 'validated' | 'flagged' | 'corrected';
  aiModelUsed: string;
  generationPrompt?: string;
  generationParameters: Record<string, any>;
  processingTimeMs: number;
  tokensUsed: number;
  version: number;
  supersededBy?: string;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface KnowledgeEntity {
  id: string;
  tenantId: string;
  entityName: string;
  entityType: 'person' | 'organization' | 'concept' | 'product' | 'location' | 'event';
  entityAliases: string[];
  entityDescription?: string;
  entitySummary?: string;
  entityCategory?: string;
  entitySubcategory?: string;
  relatedEntities: string[];
  parentEntityId?: string;
  childEntities: string[];
  mentionedInDocuments: string[];
  mentionedInMeetings: string[];
  knowledgeArticles: string[];
  mentionFrequency: number;
  importanceScore: number;
  trendingScore: number;
  entityAttributes: Record<string, any>;
  entityFacts: string[];
  aiConfidenceScore: number;
  lastMentionedAt?: Date;
  entityStatus: 'active' | 'deprecated' | 'merged' | 'deleted';
  qualityScore: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SearchSession {
  id: string;
  tenantId: string;
  userId: string;
  sessionTitle?: string;
  sessionContext?: string;
  sessionType: 'research' | 'troubleshooting' | 'learning' | 'exploration';
  querySequence: string[];
  conversationFlow: Array<any>;
  sessionSummary?: string;
  discoveredTopics: string[];
  knowledgeGaps: string[];
  recommendedActions: string[];
  sessionSuccessRating?: number;
  goalsAchieved: string[];
  timeSavedEstimate?: number;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt?: Date;
  totalDurationMinutes?: number;
  queryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

class AISearchKnowledgeService {
  /**
   * Generate vector embedding for text content
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Mock embedding generation - in production, this would call OpenAI's embedding API
    // Returns a 1536-dimensional vector (OpenAI ada-002 standard)
    return Array.from({ length: 1536 }, () => Math.random() - 0.5);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Create vector embedding for content
   */
  async createContentEmbedding(
    tenantId: string,
    contentId: string,
    contentType: string,
    contentData: {
      text: string;
      title?: string;
      summary?: string;
      keywords?: string[];
      category?: string;
      subcategory?: string;
      tags?: string[];
      authorId?: string;
      createdAt?: Date;
      accessLevel?: string;
      accessPermissions?: string[];
    },
  ): Promise<VectorEmbedding> {
    console.log('🔍 Creating vector embedding for content:', contentId);

    try {
      // Generate embedding vector
      const embeddingVector = await this.generateEmbedding(contentData.text);

      // Extract keywords if not provided
      let keywords = contentData.keywords || [];
      if (keywords.length === 0) {
        keywords = await this.extractKeywords(contentData.text, contentData.title);
      }

      // Calculate quality and freshness scores
      const qualityScore = this.calculateContentQuality(contentData.text, contentData.title);
      const freshnessScore = this.calculateFreshnessScore(contentData.createdAt);

      const embedding: VectorEmbedding = {
        id: `embed-${Date.now()}`,
        tenantId,
        contentId,
        contentType: contentType as any,
        embeddingVector,
        embeddingModel: 'text-embedding-ada-002',
        contentText: contentData.text,
        contentTitle: contentData.title,
        contentSummary: contentData.summary,
        contentKeywords: keywords,
        contentCategory: contentData.category,
        contentSubcategory: contentData.subcategory,
        contentTags: contentData.tags || [],
        contentLanguage: 'en',
        contentAuthorId: contentData.authorId,
        contentCreatedAt: contentData.createdAt,
        accessLevel: (contentData.accessLevel as any) || 'tenant',
        accessPermissions: contentData.accessPermissions || [],
        contentQualityScore: qualityScore,
        engagementScore: 0,
        freshnessScore,
        embeddingConfidence: 0.95,
        lastUpdatedEmbedding: new Date(),
        embeddingSource: 'api',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('✅ Vector embedding created successfully');
      return embedding;
    } catch (error) {
      console.error('Failed to create vector embedding:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search using vector similarity
   */
  async semanticSearch(
    tenantId: string,
    userId: string,
    queryText: string,
    options: {
      contentTypes?: string[];
      categories?: string[];
      tags?: string[];
      maxResults?: number;
      minSimilarity?: number;
      accessLevel?: string[];
      dateRange?: { start: Date; end: Date };
      includeAnswer?: boolean;
    } = {},
  ): Promise<{
    queryId: string;
    results: Array<{
      contentId: string;
      contentType: string;
      title: string;
      excerpt: string;
      similarity: number;
      relevanceScore: number;
      source: {
        author?: string;
        createdAt?: Date;
        category?: string;
        tags: string[];
      };
      highlights: string[];
    }>;
    answer?: AIGeneratedAnswer;
    relatedTopics: string[];
    suggestedQueries: string[];
    searchMetrics: {
      totalResults: number;
      searchTime: number;
      embeddingTime: number;
      answerTime?: number;
    };
  }> {
    console.log('🔍 Performing semantic search:', queryText);

    const startTime = Date.now();

    try {
      // Generate query embedding
      const embeddingStartTime = Date.now();
      const queryEmbedding = await this.generateEmbedding(queryText);
      const embeddingTime = Date.now() - embeddingStartTime;

      // Analyze query intent
      const queryIntent = await this.analyzeQueryIntent(queryText);

      // Create search query record
      const searchQuery: SearchQuery = {
        id: `query-${Date.now()}`,
        tenantId,
        userId,
        queryText,
        queryIntent: queryIntent.intent,
        queryLanguage: 'en',
        searchFilters: options,
        searchScope: options.contentTypes || [],
        maxResults: options.maxResults || 10,
        queryEmbedding,
        queryExpansion: queryIntent.expandedTerms,
        semanticIntent: queryIntent.semanticAnalysis,
        resultsCount: 0,
        topResultScores: [],
        responseTimeMs: 0,
        clickedResults: [],
        resultQualityFeedback: {},
        querySuccessIndicators: {},
        createdAt: new Date(),
      };

      // Mock semantic search results - in production, this would use vector database
      const mockEmbeddings = await this.getMockEmbeddings(tenantId, options);

      // Calculate similarities and rank results
      const searchResults = mockEmbeddings
        .map((embedding) => ({
          ...embedding,
          similarity: this.cosineSimilarity(queryEmbedding, embedding.embeddingVector),
          relevanceScore: this.calculateRelevanceScore(
            queryText,
            embedding.contentText,
            embedding.contentKeywords,
            this.cosineSimilarity(queryEmbedding, embedding.embeddingVector),
          ),
        }))
        .filter((result) => result.similarity >= (options.minSimilarity || 0.3))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, options.maxResults || 10);

      // Format results
      const formattedResults = searchResults.map((result) => ({
        contentId: result.contentId,
        contentType: result.contentType,
        title: result.contentTitle || 'Untitled',
        excerpt: this.generateExcerpt(result.contentText, queryText),
        similarity: result.similarity,
        relevanceScore: result.relevanceScore,
        source: {
          author: result.contentAuthorId,
          createdAt: result.contentCreatedAt,
          category: result.contentCategory,
          tags: result.contentTags,
        },
        highlights: this.extractHighlights(result.contentText, queryText),
      }));

      // Generate AI answer if requested
      let aiAnswer: AIGeneratedAnswer | undefined;
      let answerTime = 0;

      if (options.includeAnswer && formattedResults.length > 0) {
        const answerStartTime = Date.now();
        aiAnswer = await this.generateAIAnswer(searchQuery, formattedResults);
        answerTime = Date.now() - answerStartTime;
      }

      // Extract related topics and suggestions
      const relatedTopics = this.extractRelatedTopics(formattedResults);
      const suggestedQueries = await this.generateSuggestedQueries(queryText, formattedResults);

      const totalTime = Date.now() - startTime;

      // Update search query with results
      searchQuery.resultsCount = formattedResults.length;
      searchQuery.topResultScores = formattedResults.slice(0, 5).map((r) => r.relevanceScore);
      searchQuery.responseTimeMs = totalTime;

      console.log(
        `✅ Semantic search completed: ${formattedResults.length} results in ${totalTime}ms`,
      );

      return {
        queryId: searchQuery.id,
        results: formattedResults,
        answer: aiAnswer,
        relatedTopics,
        suggestedQueries,
        searchMetrics: {
          totalResults: formattedResults.length,
          searchTime: totalTime,
          embeddingTime,
          answerTime: answerTime > 0 ? answerTime : undefined,
        },
      };
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Generate AI-powered answer from search results
   */
  private async generateAIAnswer(
    query: SearchQuery,
    searchResults: Array<any>,
  ): Promise<AIGeneratedAnswer> {
    console.log('🧠 Generating AI answer for query:', query.queryText);

    try {
      // Prepare context from search results
      const context = searchResults
        .slice(0, 5)
        .map(
          (result, index) =>
            `Source ${index + 1} (${result.contentType}): ${result.title}\n${result.excerpt}`,
        )
        .join('\n\n');

      const answerPrompt = `Based on the following search results, provide a comprehensive and accurate answer to the user's question.

USER QUESTION: ${query.queryText}

SEARCH RESULTS:
${context}

Generate a detailed answer that:
1. Directly addresses the user's question
2. Synthesizes information from multiple sources when relevant
3. Provides step-by-step guidance for "how-to" questions
4. Includes specific examples or details when available
5. Acknowledges limitations if information is incomplete

Return JSON format:
{
  "answerText": "Comprehensive answer to the question",
  "answerType": "direct|synthesized|step_by_step|comparison|summary",
  "answerSections": [
    {
      "title": "Section title",
      "content": "Section content",
      "sources": ["source1", "source2"]
    }
  ],
  "keyPoints": ["Key point 1", "Key point 2"],
  "relatedTopics": ["Related topic 1", "Related topic 2"],
  "confidenceScore": 0.85,
  "factualAccuracy": 0.90,
  "completeness": 0.80,
  "clarity": 0.95,
  "usefulness": 0.88
}`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: answerPrompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const answerData = JSON.parse(aiResponse);

      const aiAnswer: AIGeneratedAnswer = {
        id: `answer-${Date.now()}`,
        tenantId: query.tenantId,
        queryId: query.id,
        answerText: answerData.answerText,
        answerConfidence: answerData.confidenceScore || 0.85,
        answerType: answerData.answerType || 'synthesized',
        sourceDocuments: searchResults.slice(0, 5).map((result) => ({
          id: result.contentId,
          type: result.contentType,
          title: result.title,
          excerpt: result.excerpt,
          relevanceScore: result.relevanceScore,
        })),
        sourceConfidence: searchResults.slice(0, 5).map((r) => r.relevanceScore),
        citationStyle: 'inline',
        answerSections: answerData.answerSections || [],
        keyPoints: answerData.keyPoints || [],
        relatedTopics: answerData.relatedTopics || [],
        factualAccuracyScore: answerData.factualAccuracy,
        completenessScore: answerData.completeness,
        clarityScore: answerData.clarity,
        usefulnessScore: answerData.usefulness,
        userHelpfulVotes: 0,
        userUnhelpfulVotes: 0,
        userCorrections: [],
        aiModelUsed: 'claude-3-5-sonnet-20241022',
        generationPrompt: answerPrompt,
        generationParameters: { temperature: 0.3, max_tokens: 2000 },
        processingTimeMs: 0,
        tokensUsed: 0,
        version: 1,
        isCurrent: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('✅ AI answer generated successfully');
      return aiAnswer;
    } catch (error) {
      console.error('AI answer generation failed:', error);
      throw error;
    }
  }

  /**
   * Create or update knowledge entity
   */
  async createKnowledgeEntity(
    tenantId: string,
    entityData: {
      name: string;
      type: string;
      description?: string;
      category?: string;
      attributes?: Record<string, any>;
      facts?: string[];
      relatedEntities?: string[];
    },
  ): Promise<KnowledgeEntity> {
    console.log('📚 Creating knowledge entity:', entityData.name);

    try {
      const entity: KnowledgeEntity = {
        id: `entity-${Date.now()}`,
        tenantId,
        entityName: entityData.name,
        entityType: entityData.type as any,
        entityAliases: [],
        entityDescription: entityData.description,
        entitySummary: entityData.description?.substring(0, 200),
        entityCategory: entityData.category,
        entitySubcategory: undefined,
        relatedEntities: entityData.relatedEntities || [],
        parentEntityId: undefined,
        childEntities: [],
        mentionedInDocuments: [],
        mentionedInMeetings: [],
        knowledgeArticles: [],
        mentionFrequency: 0,
        importanceScore: 0.5,
        trendingScore: 0,
        entityAttributes: entityData.attributes || {},
        entityFacts: entityData.facts || [],
        aiConfidenceScore: 0.8,
        entityStatus: 'active',
        qualityScore: 0.75,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('✅ Knowledge entity created successfully');
      return entity;
    } catch (error) {
      console.error('Failed to create knowledge entity:', error);
      throw error;
    }
  }

  /**
   * Get search analytics and insights
   */
  async getSearchAnalytics(
    tenantId: string,
    timeRange: { start: Date; end: Date },
  ): Promise<{
    totalQueries: number;
    uniqueUsers: number;
    averageQueriesPerUser: number;
    mostCommonQueryTypes: Array<{ type: string; count: number; percentage: number }>;
    popularSearchTerms: Array<{ term: string; count: number; trend: string }>;
    trendingTopics: Array<{ topic: string; growth: number; volume: number }>;
    averageResponseTime: number;
    averageResultCount: number;
    zeroResultQueryRate: number;
    answersGenerated: number;
    averageAnswerConfidence: number;
    answerHelpfulnessRate: number;
    averageUserSatisfaction: number;
    sessionCompletionRate: number;
    followUpQueryRate: number;
    mostRetrievedContent: Array<{ contentId: string; title: string; retrievalCount: number }>;
    contentGapIndicators: string[];
    aiInsights: string[];
    optimizationRecommendations: string[];
    contentSuggestions: string[];
  }> {
    console.log('📊 Generating search analytics...');

    // Mock analytics data - in production, this would aggregate from actual data
    return {
      totalQueries: 1247,
      uniqueUsers: 89,
      averageQueriesPerUser: 14.0,
      mostCommonQueryTypes: [
        { type: 'how_to', count: 387, percentage: 31.0 },
        { type: 'factual', count: 298, percentage: 23.9 },
        { type: 'troubleshooting', count: 234, percentage: 18.8 },
        { type: 'definition', count: 198, percentage: 15.9 },
        { type: 'comparison', count: 130, percentage: 10.4 },
      ],
      popularSearchTerms: [
        { term: 'meeting transcription', count: 156, trend: 'increasing' },
        { term: 'AI documentation', count: 134, trend: 'stable' },
        { term: 'team collaboration', count: 98, trend: 'increasing' },
        { term: 'calendar integration', count: 87, trend: 'decreasing' },
        { term: 'task scheduling', count: 76, trend: 'stable' },
      ],
      trendingTopics: [
        { topic: 'AI Writing Assistant', growth: 45.2, volume: 234 },
        { topic: 'Vector Search', growth: 38.7, volume: 187 },
        { topic: 'Knowledge Management', growth: 29.3, volume: 298 },
        { topic: 'Semantic Search', growth: 22.1, volume: 156 },
      ],
      averageResponseTime: 342, // milliseconds
      averageResultCount: 7.3,
      zeroResultQueryRate: 0.08,
      answersGenerated: 892,
      averageAnswerConfidence: 0.84,
      answerHelpfulnessRate: 0.79,
      averageUserSatisfaction: 4.2,
      sessionCompletionRate: 0.73,
      followUpQueryRate: 0.34,
      mostRetrievedContent: [
        { contentId: 'doc-1', title: 'Meeting Transcription Setup Guide', retrievalCount: 234 },
        { contentId: 'article-1', title: 'AI Documentation Best Practices', retrievalCount: 198 },
        { contentId: 'doc-3', title: 'Team Collaboration Workflows', retrievalCount: 167 },
      ],
      contentGapIndicators: [
        'Frequent searches for "advanced scheduling algorithms" with low satisfaction',
        'High demand for "integration troubleshooting" content',
        'Users asking about "mobile app features" not covered in current content',
      ],
      aiInsights: [
        'Search query complexity has increased by 23% over the past month, indicating users are becoming more sophisticated',
        'How-to queries have the highest satisfaction rates (4.6/5) but also the longest response times',
        'Users who receive AI-generated answers are 67% more likely to complete their search sessions successfully',
        'Trending topics show strong interest in advanced AI features and automation capabilities',
      ],
      optimizationRecommendations: [
        'Expand content coverage for advanced scheduling and automation topics',
        'Improve response times for complex how-to queries by pre-generating common answers',
        'Create more visual content and step-by-step guides for troubleshooting topics',
        'Implement query suggestion features to help users formulate better search queries',
      ],
      contentSuggestions: [
        'Create comprehensive guide on advanced scheduling algorithms and customization',
        'Develop troubleshooting knowledge base for common integration issues',
        'Add mobile app documentation and feature guides',
        'Create video tutorials for complex setup and configuration processes',
      ],
    };
  }

  // Helper methods
  private async analyzeQueryIntent(queryText: string): Promise<{
    intent: 'factual' | 'how_to' | 'troubleshooting' | 'definition' | 'comparison';
    expandedTerms: string[];
    semanticAnalysis: Record<string, any>;
  }> {
    // Simple intent analysis - in production, this would use more sophisticated NLP
    let intent: any = 'factual';

    if (queryText.toLowerCase().includes('how to') || queryText.toLowerCase().includes('how do')) {
      intent = 'how_to';
    } else if (
      queryText.toLowerCase().includes('what is') ||
      queryText.toLowerCase().includes('define')
    ) {
      intent = 'definition';
    } else if (
      queryText.toLowerCase().includes('vs') ||
      queryText.toLowerCase().includes('compare')
    ) {
      intent = 'comparison';
    } else if (
      queryText.toLowerCase().includes('error') ||
      queryText.toLowerCase().includes('problem')
    ) {
      intent = 'troubleshooting';
    }

    return {
      intent,
      expandedTerms: queryText
        .toLowerCase()
        .split(' ')
        .filter((word) => word.length > 3),
      semanticAnalysis: {
        complexity: queryText.split(' ').length > 10 ? 'high' : 'medium',
        specificity:
          queryText.includes('specific') || queryText.includes('exactly') ? 'high' : 'medium',
      },
    };
  }

  private async extractKeywords(text: string, title?: string): Promise<string[]> {
    // Simple keyword extraction - in production, this would use NLP libraries
    const combinedText = `${title || ''} ${text}`.toLowerCase();
    const words = combinedText
      .split(/\W+/)
      .filter(
        (word) =>
          word.length > 3 &&
          ![
            'this',
            'that',
            'with',
            'have',
            'will',
            'from',
            'they',
            'been',
            'were',
            'said',
            'each',
          ].includes(word),
      );

    const wordCounts = words.reduce(
      (acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private calculateContentQuality(text: string, title?: string): number {
    // Simple quality assessment based on length, structure, and completeness
    let score = 0.5; // Base score

    // Length factor
    if (text.length > 1000) score += 0.2;
    else if (text.length > 500) score += 0.1;

    // Structure factor
    if (title && title.length > 10) score += 0.1;
    if (text.includes('\n\n')) score += 0.1; // Paragraphs
    if (text.match(/\d+\./)) score += 0.1; // Numbered lists

    return Math.min(score, 1.0);
  }

  private calculateFreshnessScore(createdAt?: Date): number {
    if (!createdAt) return 0.5;

    const now = new Date();
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays < 7) return 1.0;
    if (ageInDays < 30) return 0.9;
    if (ageInDays < 90) return 0.7;
    if (ageInDays < 365) return 0.5;
    return 0.3;
  }

  private calculateRelevanceScore(
    query: string,
    content: string,
    keywords: string[],
    vectorSimilarity: number,
  ): number {
    // Combine vector similarity with keyword matching and other factors
    let score = vectorSimilarity * 0.7; // 70% weight on vector similarity

    // Keyword matching (30% weight)
    const queryWords = query.toLowerCase().split(' ');
    const keywordMatches = keywords.filter((keyword) =>
      queryWords.some((word) => keyword.includes(word) || word.includes(keyword)),
    ).length;
    const keywordScore = Math.min(keywordMatches / Math.max(keywords.length, 1), 1.0);
    score += keywordScore * 0.3;

    return Math.min(score, 1.0);
  }

  private generateExcerpt(content: string, query: string, maxLength: number = 200): string {
    const queryWords = query.toLowerCase().split(' ');
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Find sentence with most query word matches
    let bestSentence = sentences[0] || '';
    let maxMatches = 0;

    for (const sentence of sentences) {
      const matches = queryWords.filter((word) => sentence.toLowerCase().includes(word)).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = sentence;
      }
    }

    if (bestSentence.length <= maxLength) {
      return bestSentence.trim();
    }

    return bestSentence.substring(0, maxLength - 3).trim() + '...';
  }

  private extractHighlights(content: string, query: string): string[] {
    const queryWords = query
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 3);
    const highlights: string[] = [];

    for (const word of queryWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        highlights.push(...matches.slice(0, 3)); // Max 3 highlights per word
      }
    }

    return [...new Set(highlights)]; // Remove duplicates
  }

  private extractRelatedTopics(searchResults: Array<any>): string[] {
    const allTags = searchResults.flatMap((result) => result.source.tags || []);
    const tagCounts = allTags.reduce(
      (acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([tag]) => tag);
  }

  private async generateSuggestedQueries(
    originalQuery: string,
    searchResults: Array<any>,
  ): Promise<string[]> {
    // Generate related query suggestions based on results
    const topics = this.extractRelatedTopics(searchResults);
    const suggestions = [
      `How to implement ${originalQuery}`,
      `${originalQuery} best practices`,
      `${originalQuery} troubleshooting`,
      `Advanced ${originalQuery} techniques`,
    ];

    // Add topic-based suggestions
    topics.slice(0, 3).forEach((topic) => {
      suggestions.push(`${originalQuery} ${topic}`);
    });

    return suggestions.slice(0, 6);
  }

  private async getMockEmbeddings(tenantId: string, options: any): Promise<VectorEmbedding[]> {
    // Mock embeddings data - in production, this would query the vector database
    return [
      {
        id: 'embed-1',
        tenantId,
        contentId: 'doc-1',
        contentType: 'document',
        embeddingVector: Array.from({ length: 1536 }, () => Math.random() - 0.5),
        embeddingModel: 'text-embedding-ada-002',
        contentText:
          'Meeting transcription setup involves configuring your recording platform, setting up AI processing, and customizing output formats. The system supports multiple platforms including Zoom, Teams, and Google Meet.',
        contentTitle: 'Meeting Transcription Setup Guide',
        contentSummary: 'Complete guide for setting up AI-powered meeting transcription',
        contentKeywords: ['meeting', 'transcription', 'setup', 'AI', 'recording'],
        contentCategory: 'tutorial',
        contentSubcategory: 'setup',
        contentTags: ['meetings', 'AI', 'transcription', 'setup'],
        contentLanguage: 'en',
        contentAuthorId: 'user-1',
        contentCreatedAt: new Date('2025-09-20'),
        accessLevel: 'tenant',
        accessPermissions: [],
        contentQualityScore: 0.92,
        engagementScore: 0.85,
        freshnessScore: 0.95,
        embeddingConfidence: 0.95,
        lastUpdatedEmbedding: new Date(),
        embeddingSource: 'api',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'embed-2',
        tenantId,
        contentId: 'article-1',
        contentType: 'knowledge_article',
        embeddingVector: Array.from({ length: 1536 }, () => Math.random() - 0.5),
        embeddingModel: 'text-embedding-ada-002',
        contentText:
          'AI-powered documentation leverages natural language processing to automatically generate, improve, and organize business documents. Key features include content suggestions, grammar checking, and intelligent formatting.',
        contentTitle: 'AI Documentation Best Practices',
        contentSummary: 'Best practices for using AI in document creation and management',
        contentKeywords: ['AI', 'documentation', 'writing', 'automation', 'best practices'],
        contentCategory: 'best_practices',
        contentSubcategory: 'documentation',
        contentTags: ['AI', 'documentation', 'writing', 'best-practices'],
        contentLanguage: 'en',
        contentAuthorId: 'user-2',
        contentCreatedAt: new Date('2025-09-18'),
        accessLevel: 'public',
        accessPermissions: [],
        contentQualityScore: 0.88,
        engagementScore: 0.79,
        freshnessScore: 0.9,
        embeddingConfidence: 0.93,
        lastUpdatedEmbedding: new Date(),
        embeddingSource: 'batch_process',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
}

export default new AISearchKnowledgeService();
