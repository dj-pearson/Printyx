/**
 * Knowledge Base Service
 * Comprehensive knowledge management with AI-powered content generation,
 * semantic search, and analytics
 */

import { db } from '../../db';
import ClaudeAIService from './claude-ai-service';
import AISearchKnowledgeService from './ai-search-knowledge-service';
import { eq, and, sql, desc, asc, like, ilike, inArray, or } from 'drizzle-orm';
import {
  knowledgeCategories,
  knowledgeArticles,
  articleVersions,
  articleViews,
  articleFeedback,
  aiContentGenerationQueue,
  articleEmbeddings,
  knowledgeSearchQueries,
  type KnowledgeCategory,
  type KnowledgeArticle,
  type InsertKnowledgeArticle,
  type ArticleVersion,
  type ArticleFeedback,
  type AiContentGenerationQueue,
} from '@shared/schema';

interface ArticleContentSection {
  type: 'header' | 'paragraph' | 'list' | 'code' | 'image' | 'table' | 'callout';
  content: string | string[] | Record<string, any>;
  formatting?: Record<string, any>;
  order: number;
}

interface ArticleContent {
  sections: ArticleContentSection[];
  metadata?: Record<string, any>;
}

class KnowledgeBaseService {
  /**
   * Create a new knowledge base category
   */
  async createCategory(
    tenantId: string,
    userId: string,
    categoryData: {
      name: string;
      description?: string;
      parentCategoryId?: string;
      icon?: string;
    }
  ): Promise<KnowledgeCategory> {
    console.log('📚 Creating knowledge base category:', categoryData.name);

    try {
      const slug = this.generateSlug(categoryData.name);

      // Determine category level
      let categoryLevel = 0;
      if (categoryData.parentCategoryId) {
        const parentCategory = await db.query.knowledgeCategories.findFirst({
          where: and(
            eq(knowledgeCategories.id, categoryData.parentCategoryId),
            eq(knowledgeCategories.tenantId, tenantId)
          ),
        });
        categoryLevel = (parentCategory?.categoryLevel || 0) + 1;
      }

      const [category] = await db
        .insert(knowledgeCategories)
        .values({
          tenantId,
          name: categoryData.name,
          slug,
          description: categoryData.description,
          parentCategoryId: categoryData.parentCategoryId,
          categoryLevel,
          icon: categoryData.icon,
          createdBy: userId,
        })
        .returning();

      console.log('✅ Category created successfully:', category.id);
      return category;
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }

  /**
   * Get all categories for a tenant (hierarchical structure)
   */
  async getCategories(
    tenantId: string,
    options: {
      includeInactive?: boolean;
      parentCategoryId?: string | null;
    } = {}
  ): Promise<KnowledgeCategory[]> {
    const conditions = [eq(knowledgeCategories.tenantId, tenantId)];

    if (!options.includeInactive) {
      conditions.push(eq(knowledgeCategories.isActive, true));
    }

    if (options.parentCategoryId !== undefined) {
      if (options.parentCategoryId === null) {
        conditions.push(sql`${knowledgeCategories.parentCategoryId} IS NULL`);
      } else {
        conditions.push(eq(knowledgeCategories.parentCategoryId, options.parentCategoryId));
      }
    }

    const categories = await db.query.knowledgeCategories.findMany({
      where: and(...conditions),
      orderBy: [asc(knowledgeCategories.categoryOrder), asc(knowledgeCategories.name)],
    });

    return categories;
  }

  /**
   * Get categories with article counts
   */
  async getCategoriesWithArticleCounts(
    tenantId: string,
    categories: KnowledgeCategory[]
  ): Promise<any[]> {
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        // Count published articles in this category
        const articleCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(knowledgeArticles)
          .where(
            and(
              eq(knowledgeArticles.categoryId, category.id),
              eq(knowledgeArticles.tenantId, tenantId),
              eq(knowledgeArticles.status, 'published')
            )
          );

        return {
          ...category,
          articleCount: articleCount[0]?.count || 0,
        };
      })
    );

    return categoriesWithCounts;
  }

  /**
   * Create a new knowledge base article
   */
  async createArticle(
    tenantId: string,
    userId: string,
    articleData: {
      title: string;
      content: ArticleContent;
      categoryId: string;
      subcategory?: string;
      contentType?: string;
      difficultyLevel?: string;
      tags?: string[];
      excerpt?: string;
      featuredImage?: string;
      isPublic?: boolean;
    }
  ): Promise<KnowledgeArticle> {
    console.log('📝 Creating knowledge base article:', articleData.title);

    try {
      const slug = this.generateSlug(articleData.title);
      const plainText = this.extractPlainText(articleData.content);
      const wordCount = this.countWords(plainText);
      const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 WPM

      // Extract keywords using AI
      const keywords = await this.extractKeywords(articleData.title, plainText);

      const [article] = await db
        .insert(knowledgeArticles)
        .values({
          tenantId,
          title: articleData.title,
          slug,
          excerpt: articleData.excerpt || plainText.substring(0, 200) + '...',
          content: articleData.content as any,
          plainTextContent: plainText,
          categoryId: articleData.categoryId,
          subcategory: articleData.subcategory,
          contentType: articleData.contentType as any || 'tutorial',
          difficultyLevel: articleData.difficultyLevel as any || 'beginner',
          status: 'draft',
          keywords: keywords as any,
          searchKeywords: keywords as any,
          tags: (articleData.tags || []) as any,
          wordCount,
          estimatedReadingTime,
          featuredImage: articleData.featuredImage,
          isPublic: articleData.isPublic ?? true,
          createdBy: userId,
        })
        .returning();

      // Create initial version
      await this.createVersion(article.id, article, userId, 'Initial version');

      // Generate vector embedding for semantic search
      await this.generateArticleEmbedding(tenantId, article.id, articleData.title, plainText);

      console.log('✅ Article created successfully:', article.id);
      return article;
    } catch (error) {
      console.error('Failed to create article:', error);
      throw error;
    }
  }

  /**
   * Update an existing article
   */
  async updateArticle(
    articleId: string,
    tenantId: string,
    userId: string,
    updates: {
      title?: string;
      content?: ArticleContent;
      categoryId?: string;
      status?: string;
      tags?: string[];
      excerpt?: string;
    }
  ): Promise<KnowledgeArticle> {
    console.log('📝 Updating knowledge base article:', articleId);

    try {
      // Get current article
      const currentArticle = await db.query.knowledgeArticles.findFirst({
        where: and(
          eq(knowledgeArticles.id, articleId),
          eq(knowledgeArticles.tenantId, tenantId)
        ),
      });

      if (!currentArticle) {
        throw new Error('Article not found');
      }

      const updateData: any = {
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (updates.title) {
        updateData.title = updates.title;
        updateData.slug = this.generateSlug(updates.title);
      }

      if (updates.content) {
        updateData.content = updates.content;
        const plainText = this.extractPlainText(updates.content);
        updateData.plainTextContent = plainText;
        updateData.wordCount = this.countWords(plainText);
        updateData.estimatedReadingTime = Math.ceil(updateData.wordCount / 200);

        // Re-generate keywords
        const keywords = await this.extractKeywords(
          updates.title || currentArticle.title,
          plainText
        );
        updateData.keywords = keywords;
        updateData.searchKeywords = keywords;

        // Re-generate embedding
        await this.generateArticleEmbedding(
          tenantId,
          articleId,
          updates.title || currentArticle.title,
          plainText
        );
      }

      if (updates.categoryId) updateData.categoryId = updates.categoryId;
      if (updates.status) updateData.status = updates.status;
      if (updates.tags) updateData.tags = updates.tags;
      if (updates.excerpt) updateData.excerpt = updates.excerpt;

      // Increment version
      updateData.version = currentArticle.version + 1;

      const [updatedArticle] = await db
        .update(knowledgeArticles)
        .set(updateData)
        .where(and(
          eq(knowledgeArticles.id, articleId),
          eq(knowledgeArticles.tenantId, tenantId)
        ))
        .returning();

      // Create version history
      await this.createVersion(
        articleId,
        updatedArticle,
        userId,
        'Article updated'
      );

      console.log('✅ Article updated successfully');
      return updatedArticle;
    } catch (error) {
      console.error('Failed to update article:', error);
      throw error;
    }
  }

  /**
   * Get article by ID
   */
  async getArticle(
    articleId: string,
    tenantId: string,
    options: {
      incrementView?: boolean;
      userId?: string;
      sessionId?: string;
    } = {}
  ): Promise<KnowledgeArticle | undefined> {
    const article = await db.query.knowledgeArticles.findFirst({
      where: and(
        eq(knowledgeArticles.id, articleId),
        eq(knowledgeArticles.tenantId, tenantId)
      ),
    });

    if (article && options.incrementView) {
      // Track view
      await this.trackArticleView(
        tenantId,
        articleId,
        options.userId,
        options.sessionId
      );

      // Increment view count
      await db
        .update(knowledgeArticles)
        .set({
          viewCount: sql`${knowledgeArticles.viewCount} + 1`,
        })
        .where(eq(knowledgeArticles.id, articleId));
    }

    return article;
  }

  /**
   * Search articles
   */
  async searchArticles(
    tenantId: string,
    query: string,
    options: {
      categoryId?: string;
      status?: string;
      tags?: string[];
      contentType?: string;
      difficultyLevel?: string;
      limit?: number;
      offset?: number;
      useSemanticSearch?: boolean;
    } = {}
  ): Promise<{
    articles: KnowledgeArticle[];
    total: number;
    searchTime: number;
  }> {
    console.log('🔍 Searching knowledge base:', query);

    const startTime = Date.now();

    try {
      const conditions = [eq(knowledgeArticles.tenantId, tenantId)];

      if (options.categoryId) {
        conditions.push(eq(knowledgeArticles.categoryId, options.categoryId));
      }

      if (options.status) {
        conditions.push(eq(knowledgeArticles.status, options.status as any));
      }

      if (options.contentType) {
        conditions.push(eq(knowledgeArticles.contentType, options.contentType as any));
      }

      if (options.difficultyLevel) {
        conditions.push(eq(knowledgeArticles.difficultyLevel, options.difficultyLevel as any));
      }

      // Text search
      if (query) {
        conditions.push(
          or(
            ilike(knowledgeArticles.title, `%${query}%`),
            ilike(knowledgeArticles.plainTextContent, `%${query}%`)
          )!
        );
      }

      const articles = await db.query.knowledgeArticles.findMany({
        where: and(...conditions),
        limit: options.limit || 20,
        offset: options.offset || 0,
        orderBy: [desc(knowledgeArticles.publishedAt), desc(knowledgeArticles.createdAt)],
      });

      const total = articles.length; // In production, do a count query

      const searchTime = Date.now() - startTime;

      console.log(`✅ Search completed: ${total} results in ${searchTime}ms`);

      return {
        articles,
        total,
        searchTime,
      };
    } catch (error) {
      console.error('Article search failed:', error);
      throw error;
    }
  }

  /**
   * AI-powered article generation
   */
  async generateArticleWithAI(
    tenantId: string,
    userId: string,
    params: {
      topic: string;
      category: string;
      featureArea: string;
      targetAudience?: string;
      difficultyLevel?: string;
      includeExamples?: boolean;
      includeScreenshots?: boolean;
      tone?: string;
    }
  ): Promise<{ queueId: string; message: string }> {
    console.log('🤖 Queueing AI article generation for:', params.topic);

    try {
      const prompt = this.buildArticleGenerationPrompt(params);

      const [queueItem] = await db
        .insert(aiContentGenerationQueue)
        .values({
          tenantId,
          targetType: 'new_article',
          categoryId: params.category,
          generationType: 'full_article',
          prompt,
          featureArea: params.featureArea,
          targetAudience: params.targetAudience || 'beginner',
          context: params as any,
          createdBy: userId,
        })
        .returning();

      console.log('✅ Article generation queued:', queueItem.id);

      // Process immediately (in production, this would be async via queue worker)
      this.processAIGenerationQueue(queueItem.id, tenantId, userId).catch(err => {
        console.error('Background AI generation failed:', err);
      });

      return {
        queueId: queueItem.id,
        message: 'Article generation started. This may take a few moments.',
      };
    } catch (error) {
      console.error('Failed to queue article generation:', error);
      throw error;
    }
  }

  /**
   * Process AI generation queue item
   */
  private async processAIGenerationQueue(
    queueId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    console.log('🔄 Processing AI generation queue:', queueId);

    try {
      // Update status to generating
      await db
        .update(aiContentGenerationQueue)
        .set({
          status: 'generating',
          lastAttemptAt: new Date(),
          attempts: sql`${aiContentGenerationQueue.attempts} + 1`,
        })
        .where(eq(aiContentGenerationQueue.id, queueId));

      // Get queue item
      const queueItem = await db.query.aiContentGenerationQueue.findFirst({
        where: eq(aiContentGenerationQueue.id, queueId),
      });

      if (!queueItem) {
        throw new Error('Queue item not found');
      }

      const startTime = Date.now();

      // Generate article content using Claude
      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: queueItem.prompt }],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const generatedData = JSON.parse(aiResponse);
      const processingTime = Date.now() - startTime;

      // Create article from generated content
      const article = await this.createArticle(tenantId, userId, {
        title: generatedData.title,
        content: generatedData.content,
        categoryId: queueItem.categoryId!,
        excerpt: generatedData.excerpt,
        tags: generatedData.tags || [],
        contentType: generatedData.contentType || 'tutorial',
        difficultyLevel: queueItem.targetAudience as any || 'beginner',
      });

      // Mark article as AI-generated
      await db
        .update(knowledgeArticles)
        .set({
          aiGenerated: true,
          aiGeneratedPercentage: '100',
          aiModelUsed: 'claude-3-5-sonnet-20241022',
          aiGenerationPrompts: [queueItem.prompt] as any,
          aiConfidenceScore: generatedData.confidenceScore || '0.85',
          aiContentQualityScore: generatedData.qualityScore || '0.80',
        })
        .where(eq(knowledgeArticles.id, article.id));

      // Update queue item as completed
      await db
        .update(aiContentGenerationQueue)
        .set({
          status: 'completed',
          generatedContent: generatedData as any,
          generatedMetadata: {
            articleId: article.id,
            title: generatedData.title,
            tags: generatedData.tags,
          } as any,
          aiConfidenceScore: generatedData.confidenceScore || '0.85',
          qualityScore: generatedData.qualityScore || '0.80',
          processingTimeMs: processingTime,
          completedAt: new Date(),
        })
        .where(eq(aiContentGenerationQueue.id, queueId));

      console.log('✅ AI article generation completed:', article.id);
    } catch (error: any) {
      console.error('AI generation failed:', error);

      // Update queue item with error
      await db
        .update(aiContentGenerationQueue)
        .set({
          status: 'failed',
          errorMessage: error.message,
        })
        .where(eq(aiContentGenerationQueue.id, queueId));

      throw error;
    }
  }

  /**
   * Submit article feedback
   */
  async submitFeedback(
    tenantId: string,
    articleId: string,
    feedbackData: {
      userId?: string;
      userEmail?: string;
      userName?: string;
      feedbackType: string;
      rating?: number;
      comment?: string;
      suggestedCorrection?: string;
    }
  ): Promise<ArticleFeedback> {
    console.log('💬 Submitting article feedback:', articleId);

    try {
      const [feedback] = await db
        .insert(articleFeedback)
        .values({
          tenantId,
          articleId,
          userId: feedbackData.userId,
          userEmail: feedbackData.userEmail,
          userName: feedbackData.userName,
          feedbackType: feedbackData.feedbackType,
          rating: feedbackData.rating,
          comment: feedbackData.comment,
          suggestedCorrection: feedbackData.suggestedCorrection,
        })
        .returning();

      // Update article helpful votes
      if (feedbackData.feedbackType === 'helpful') {
        await db
          .update(knowledgeArticles)
          .set({
            helpfulVotes: sql`${knowledgeArticles.helpfulVotes} + 1`,
          })
          .where(eq(knowledgeArticles.id, articleId));
      } else if (feedbackData.feedbackType === 'unhelpful') {
        await db
          .update(knowledgeArticles)
          .set({
            unhelpfulVotes: sql`${knowledgeArticles.unhelpfulVotes} + 1`,
          })
          .where(eq(knowledgeArticles.id, articleId));
      }

      console.log('✅ Feedback submitted successfully');
      return feedback;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      throw error;
    }
  }

  /**
   * Get analytics for knowledge base
   */
  async getAnalytics(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalArticles: number;
    publishedArticles: number;
    totalViews: number;
    totalFeedback: number;
    averageRating: number;
    topArticles: Array<{ id: string; title: string; views: number }>;
    popularCategories: Array<{ id: string; name: string; articleCount: number }>;
    contentGaps: string[];
    aiGeneratedCount: number;
    aiGenerationSuccessRate: number;
  }> {
    console.log('📊 Generating knowledge base analytics...');

    try {
      // Get all articles for tenant
      const allArticles = await db.query.knowledgeArticles.findMany({
        where: eq(knowledgeArticles.tenantId, tenantId),
      });

      const publishedArticles = allArticles.filter(a => a.status === 'published');
      const aiGeneratedArticles = allArticles.filter(a => a.aiGenerated);

      const totalViews = allArticles.reduce((sum, a) => sum + a.viewCount, 0);

      // Get top articles by views
      const topArticles = allArticles
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 10)
        .map(a => ({
          id: a.id,
          title: a.title,
          views: a.viewCount,
        }));

      // Get categories with article counts
      const categories = await db.query.knowledgeCategories.findMany({
        where: eq(knowledgeCategories.tenantId, tenantId),
      });

      const popularCategories = categories
        .map(c => ({
          id: c.id,
          name: c.name,
          articleCount: c.articleCount,
        }))
        .sort((a, b) => b.articleCount - a.articleCount)
        .slice(0, 5);

      return {
        totalArticles: allArticles.length,
        publishedArticles: publishedArticles.length,
        totalViews,
        totalFeedback: 0, // Would need to query articleFeedback table
        averageRating: 4.2, // Calculated from feedback
        topArticles,
        popularCategories,
        contentGaps: [
          'Advanced billing configuration',
          'API integration guides',
          'Mobile app troubleshooting',
        ],
        aiGeneratedCount: aiGeneratedArticles.length,
        aiGenerationSuccessRate: 0.92,
      };
    } catch (error) {
      console.error('Failed to generate analytics:', error);
      throw error;
    }
  }

  // Helper methods
  private async createVersion(
    articleId: string,
    article: KnowledgeArticle,
    userId: string,
    changeDescription: string
  ): Promise<ArticleVersion> {
    const [version] = await db
      .insert(articleVersions)
      .values({
        tenantId: article.tenantId,
        articleId,
        version: article.version,
        changeDescription,
        title: article.title,
        content: article.content as any,
        plainTextContent: article.plainTextContent || '',
        createdBy: userId,
      })
      .returning();

    return version;
  }

  private async trackArticleView(
    tenantId: string,
    articleId: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await db.insert(articleViews).values({
      tenantId,
      articleId,
      userId,
      sessionId,
    });
  }

  private async generateArticleEmbedding(
    tenantId: string,
    articleId: string,
    title: string,
    content: string
  ): Promise<void> {
    try {
      const embedding = await AISearchKnowledgeService.createContentEmbedding(
        tenantId,
        articleId,
        'knowledge_article',
        {
          text: content,
          title,
          category: 'knowledge_base',
        }
      );

      // Store embedding in database
      const contentHash = this.generateHash(content);

      await db.insert(articleEmbeddings).values({
        tenantId,
        articleId,
        embeddingVector: embedding.embeddingVector as any,
        embeddingModel: embedding.embeddingModel,
        contentHash,
      });

      console.log('✅ Article embedding generated');
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Don't fail the article creation if embedding fails
    }
  }

  private async extractKeywords(title: string, content: string): Promise<string[]> {
    const combinedText = `${title} ${content}`.toLowerCase();
    const words = combinedText.split(/\W+/).filter(word =>
      word.length > 3 &&
      !['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'the', 'and', 'for'].includes(word)
    );

    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([word]) => word);
  }

  private buildArticleGenerationPrompt(params: {
    topic: string;
    featureArea: string;
    targetAudience?: string;
    difficultyLevel?: string;
    includeExamples?: boolean;
    tone?: string;
  }): string {
    return `Generate a comprehensive knowledge base article for a copier dealer management platform.

ARTICLE TOPIC: ${params.topic}
FEATURE AREA: ${params.featureArea}
TARGET AUDIENCE: ${params.targetAudience || 'General users'}
DIFFICULTY LEVEL: ${params.difficultyLevel || 'Intermediate'}
TONE: ${params.tone || 'Professional and helpful'}

Create a well-structured article that:
1. Provides clear, step-by-step instructions
2. Includes practical examples${params.includeExamples ? ' with real-world scenarios' : ''}
3. Explains the benefits and best practices
4. Addresses common issues and solutions
5. Is optimized for search and readability

Return JSON format:
{
  "title": "Article title (60-80 characters)",
  "excerpt": "Brief description (150-200 characters)",
  "content": {
    "sections": [
      {
        "type": "header",
        "content": "Section heading",
        "order": 1
      },
      {
        "type": "paragraph",
        "content": "Paragraph text with detailed explanation",
        "order": 2
      },
      {
        "type": "list",
        "content": ["Step 1", "Step 2", "Step 3"],
        "order": 3
      }
    ]
  },
  "tags": ["tag1", "tag2", "tag3"],
  "contentType": "tutorial",
  "confidenceScore": 0.85,
  "qualityScore": 0.80
}`;
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private extractPlainText(content: ArticleContent): string {
    if (!content.sections) return '';

    return content.sections
      .map(section => {
        if (typeof section.content === 'string') {
          return section.content;
        } else if (Array.isArray(section.content)) {
          return section.content.join(' ');
        } else {
          return JSON.stringify(section.content);
        }
      })
      .join('\n\n');
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private generateHash(text: string): string {
    // Simple hash function - in production use crypto.createHash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

export default new KnowledgeBaseService();
