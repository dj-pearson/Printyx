import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
  uuid,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Knowledge Base Enums
export const articleStatusEnum = pgEnum('article_status', [
  'draft',
  'review',
  'approved',
  'published',
  'archived',
  'deprecated'
]);

export const articleCategoryEnum = pgEnum('article_category', [
  'crm_sales',
  'service_management',
  'meter_billing',
  'inventory_warehouse',
  'manufacturer_integration',
  'fleet_monitoring',
  'workflow_automation',
  'ai_features',
  'customer_portal',
  'reporting_analytics',
  'system_setup',
  'troubleshooting',
  'best_practices',
  'getting_started'
]);

export const difficultyLevelEnum = pgEnum('difficulty_level', [
  'beginner',
  'intermediate',
  'advanced',
  'expert'
]);

export const contentTypeEnum = pgEnum('content_type', [
  'tutorial',
  'how_to',
  'reference',
  'troubleshooting',
  'best_practice',
  'release_notes',
  'faq',
  'video',
  'api_documentation'
]);

export const aiGenerationStatusEnum = pgEnum('ai_generation_status', [
  'pending',
  'generating',
  'completed',
  'failed',
  'review_needed'
]);

// Knowledge Base Categories
export const knowledgeCategories = pgTable('knowledge_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Category info
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 100 }), // Icon identifier for UI

  // Hierarchy
  parentCategoryId: uuid('parent_category_id'),
  categoryOrder: integer('category_order').default(0).notNull(),
  categoryLevel: integer('category_level').default(0).notNull(), // 0 = root, 1 = subcategory, etc.

  // AI metadata
  aiSuggestedTopics: jsonb('ai_suggested_topics').default([]).notNull(),
  aiContentGaps: jsonb('ai_content_gaps').default([]).notNull(),

  // Statistics
  articleCount: integer('article_count').default(0).notNull(),
  viewCount: integer('view_count').default(0).notNull(),

  // Settings
  isPublic: boolean('is_public').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
  createdBy: uuid('created_by').notNull(),
}, (table) => ({
  tenantSlugIdx: unique('kb_category_tenant_slug_unique').on(table.tenantId, table.slug),
  parentCategoryIdx: index('kb_category_parent_idx').on(table.parentCategoryId),
  tenantCategoryIdx: index('kb_category_tenant_idx').on(table.tenantId),
}));

// Knowledge Base Articles
export const knowledgeArticles = pgTable('knowledge_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Article info
  title: varchar('title', { length: 500 }).notNull(),
  slug: varchar('slug', { length: 500 }).notNull(),
  excerpt: text('excerpt'),

  // Content
  content: jsonb('content').notNull(), // Structured content (sections, formatting, etc.)
  plainTextContent: text('plain_text_content'), // For search
  htmlContent: text('html_content'), // Rendered HTML

  // Classification
  categoryId: uuid('category_id').notNull(),
  subcategory: varchar('subcategory', { length: 255 }),
  contentType: contentTypeEnum('content_type').default('tutorial').notNull(),
  difficultyLevel: difficultyLevelEnum('difficulty_level').default('beginner').notNull(),

  // Status & Publishing
  status: articleStatusEnum('status').default('draft').notNull(),
  version: integer('version').default(1).notNull(),
  publishedVersion: integer('published_version'),

  // AI Generation
  aiGenerated: boolean('ai_generated').default(false).notNull(),
  aiGeneratedPercentage: decimal('ai_generated_percentage', { precision: 5, scale: 2 }), // 0-100
  aiModelUsed: varchar('ai_model_used', { length: 100 }),
  aiGenerationPrompts: jsonb('ai_generation_prompts').default([]).notNull(),
  aiConfidenceScore: decimal('ai_confidence_score', { precision: 5, scale: 2 }), // 0-1
  aiContentQualityScore: decimal('ai_content_quality_score', { precision: 5, scale: 2 }), // 0-1

  // SEO & Search
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  keywords: jsonb('keywords').default([]).notNull(), // Array of keywords
  searchKeywords: jsonb('search_keywords').default([]).notNull(), // AI-extracted keywords
  tags: jsonb('tags').default([]).notNull(),

  // Content metrics
  wordCount: integer('word_count').default(0).notNull(),
  estimatedReadingTime: integer('estimated_reading_time').default(0).notNull(), // minutes

  // Relations & Prerequisites
  relatedArticles: jsonb('related_articles').default([]).notNull(), // Array of article IDs
  prerequisites: jsonb('prerequisites').default([]).notNull(), // Required articles to read first

  // Media
  featuredImage: varchar('featured_image', { length: 500 }),
  mediaAttachments: jsonb('media_attachments').default([]).notNull(), // Videos, images, PDFs

  // Analytics
  viewCount: integer('view_count').default(0).notNull(),
  uniqueViewCount: integer('unique_view_count').default(0).notNull(),
  helpfulVotes: integer('helpful_votes').default(0).notNull(),
  unhelpfulVotes: integer('unhelpful_votes').default(0).notNull(),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }), // 0-5
  shareCount: integer('share_count').default(0).notNull(),

  // Settings
  featured: boolean('featured').default(false).notNull(),
  isPublic: boolean('is_public').default(true).notNull(),
  allowComments: boolean('allow_comments').default(true).notNull(),
  allowFeedback: boolean('allow_feedback').default(true).notNull(),

  // Freshness tracking
  lastReviewedAt: timestamp('last_reviewed_at'),
  lastReviewedBy: uuid('last_reviewed_by'),
  contentFreshnessScore: decimal('content_freshness_score', { precision: 5, scale: 2 }), // 0-1
  nextReviewDate: timestamp('next_review_date'),

  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
  publishedAt: timestamp('published_at'),
  archivedAt: timestamp('archived_at'),
  createdBy: uuid('created_by').notNull(),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  tenantSlugIdx: unique('kb_article_tenant_slug_unique').on(table.tenantId, table.slug),
  categoryIdx: index('kb_article_category_idx').on(table.categoryId),
  statusIdx: index('kb_article_status_idx').on(table.status),
  publishedIdx: index('kb_article_published_idx').on(table.publishedAt),
  tenantStatusIdx: index('kb_article_tenant_status_idx').on(table.tenantId, table.status),
  featuredIdx: index('kb_article_featured_idx').on(table.featured),
  contentTypeIdx: index('kb_article_content_type_idx').on(table.contentType),
}));

// Article Version History
export const articleVersions = pgTable('article_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  articleId: uuid('article_id').notNull(),

  // Version info
  version: integer('version').notNull(),
  changeDescription: text('change_description'),
  changeType: varchar('change_type', { length: 50 }), // 'major', 'minor', 'patch', 'ai_generated'

  // Snapshot of content at this version
  title: varchar('title', { length: 500 }).notNull(),
  content: jsonb('content').notNull(),
  plainTextContent: text('plain_text_content'),

  // AI tracking for this version
  aiGeneratedChanges: boolean('ai_generated_changes').default(false).notNull(),
  aiChangePrompt: text('ai_change_prompt'),
  aiConfidenceScore: decimal('ai_confidence_score', { precision: 5, scale: 2 }),

  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  createdBy: uuid('created_by').notNull(),
}, (table) => ({
  articleVersionIdx: index('article_version_idx').on(table.articleId, table.version),
  tenantArticleIdx: index('article_version_tenant_idx').on(table.tenantId, table.articleId),
}));

// Article Views & Analytics
export const articleViews = pgTable('article_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  articleId: uuid('article_id').notNull(),

  // User info
  userId: uuid('user_id'), // Null for anonymous
  sessionId: varchar('session_id', { length: 255 }),

  // View metadata
  viewedAt: timestamp('viewed_at').default(sql`now()`).notNull(),
  timeSpentSeconds: integer('time_spent_seconds'),
  scrollDepthPercentage: integer('scroll_depth_percentage'), // How far they scrolled
  completedReading: boolean('completed_reading').default(false).notNull(),

  // Context
  referrer: varchar('referrer', { length: 500 }),
  searchQuery: text('search_query'), // If they came from search
  deviceType: varchar('device_type', { length: 50 }), // mobile, tablet, desktop

  // Actions taken
  wasHelpful: boolean('was_helpful'),
  rating: integer('rating'), // 1-5
  sharedArticle: boolean('shared_article').default(false).notNull(),

  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
}, (table) => ({
  articleDateIdx: index('article_view_article_date_idx').on(table.articleId, table.viewedAt),
  userArticleIdx: index('article_view_user_article_idx').on(table.userId, table.articleId),
  sessionIdx: index('article_view_session_idx').on(table.sessionId),
  tenantIdx: index('article_view_tenant_idx').on(table.tenantId),
}));

// Article Feedback
export const articleFeedback = pgTable('article_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  articleId: uuid('article_id').notNull(),

  // User info
  userId: uuid('user_id'),
  userEmail: varchar('user_email', { length: 255 }),
  userName: varchar('user_name', { length: 255 }),

  // Feedback
  feedbackType: varchar('feedback_type', { length: 50 }).notNull(), // 'helpful', 'unhelpful', 'correction', 'suggestion'
  rating: integer('rating'), // 1-5
  comment: text('comment'),

  // Specific issues
  issueType: varchar('issue_type', { length: 100 }), // 'outdated', 'incorrect', 'unclear', 'missing_info', 'technical_error'
  suggestedCorrection: text('suggested_correction'),

  // AI analysis
  aiAnalyzed: boolean('ai_analyzed').default(false).notNull(),
  aiSentimentScore: decimal('ai_sentiment_score', { precision: 5, scale: 2 }), // -1 to 1
  aiExtractedIssues: jsonb('ai_extracted_issues').default([]).notNull(),
  aiSuggestedActions: jsonb('ai_suggested_actions').default([]).notNull(),

  // Resolution
  resolved: boolean('resolved').default(false).notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by'),
  resolutionNotes: text('resolution_notes'),

  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  articleTypeIdx: index('article_feedback_article_type_idx').on(table.articleId, table.feedbackType),
  unresolvedIdx: index('article_feedback_unresolved_idx').on(table.resolved),
  tenantIdx: index('article_feedback_tenant_idx').on(table.tenantId),
  createdIdx: index('article_feedback_created_idx').on(table.createdAt),
}));

// AI Content Generation Queue
export const aiContentGenerationQueue = pgTable('ai_content_generation_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Target
  targetType: varchar('target_type', { length: 50 }).notNull(), // 'new_article', 'article_update', 'category_expansion'
  targetId: uuid('target_id'), // Existing article ID if updating
  categoryId: uuid('category_id'),

  // Generation parameters
  generationType: varchar('generation_type', { length: 100 }).notNull(), // 'full_article', 'section', 'improvement', 'translation'
  prompt: text('prompt').notNull(),
  aiModel: varchar('ai_model', { length: 100 }).default('claude-3-5-sonnet-20241022').notNull(),
  temperature: decimal('temperature', { precision: 3, scale: 2 }).default('0.7'),
  maxTokens: integer('max_tokens').default(4000),

  // Context
  context: jsonb('context').default({}).notNull(), // Additional context for generation
  featureArea: varchar('feature_area', { length: 255 }), // Which platform feature to document
  targetAudience: varchar('target_audience', { length: 100 }), // 'beginner', 'advanced', 'admin'

  // Status
  status: aiGenerationStatusEnum('status').default('pending').notNull(),
  priority: integer('priority').default(5).notNull(), // 1-10, higher = more urgent

  // Results
  generatedContent: jsonb('generated_content'),
  generatedMetadata: jsonb('generated_metadata'), // Keywords, tags, etc.
  aiConfidenceScore: decimal('ai_confidence_score', { precision: 5, scale: 2 }),
  qualityScore: decimal('quality_score', { precision: 5, scale: 2 }),

  // Processing
  attempts: integer('attempts').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  errorMessage: text('error_message'),
  processingTimeMs: integer('processing_time_ms'),
  tokensUsed: integer('tokens_used'),

  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
  completedAt: timestamp('completed_at'),
  createdBy: uuid('created_by').notNull(),
}, (table) => ({
  statusPriorityIdx: index('ai_gen_queue_status_priority_idx').on(table.status, table.priority),
  tenantStatusIdx: index('ai_gen_queue_tenant_status_idx').on(table.tenantId, table.status),
  targetIdx: index('ai_gen_queue_target_idx').on(table.targetType, table.targetId),
  createdIdx: index('ai_gen_queue_created_idx').on(table.createdAt),
}));

// Vector Embeddings for Semantic Search
export const articleEmbeddings = pgTable('article_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  articleId: uuid('article_id').notNull(),

  // Embedding data
  embeddingVector: jsonb('embedding_vector').notNull(), // 1536-dimensional vector for OpenAI ada-002
  embeddingModel: varchar('embedding_model', { length: 100 }).default('text-embedding-ada-002').notNull(),

  // Content snapshot
  contentHash: varchar('content_hash', { length: 64 }).notNull(), // SHA-256 hash to detect changes
  embeddingScope: varchar('embedding_scope', { length: 50 }).default('full_article').notNull(), // 'full_article', 'excerpt', 'section'
  sectionId: varchar('section_id', { length: 100 }), // If embedding a specific section

  // Metadata
  embeddingConfidence: decimal('embedding_confidence', { precision: 5, scale: 2 }).default('0.95'),
  lastUpdated: timestamp('last_updated').default(sql`now()`).notNull(),

  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  articleIdx: unique('article_embedding_unique').on(table.articleId, table.embeddingScope, table.sectionId),
  tenantArticleIdx: index('article_embedding_tenant_idx').on(table.tenantId, table.articleId),
  hashIdx: index('article_embedding_hash_idx').on(table.contentHash),
}));

// Search Queries & Analytics
export const knowledgeSearchQueries = pgTable('knowledge_search_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Query info
  queryText: text('query_text').notNull(),
  queryIntent: varchar('query_intent', { length: 50 }), // 'factual', 'how_to', 'troubleshooting', etc.
  userId: uuid('user_id'),
  sessionId: varchar('session_id', { length: 255 }),

  // Results
  resultsCount: integer('results_count').default(0).notNull(),
  topResultIds: jsonb('top_result_ids').default([]).notNull(),
  clickedResultIds: jsonb('clicked_result_ids').default([]).notNull(),

  // AI answer
  aiAnswerGenerated: boolean('ai_answer_generated').default(false).notNull(),
  aiAnswerHelpful: boolean('ai_answer_helpful'),
  aiConfidenceScore: decimal('ai_confidence_score', { precision: 5, scale: 2 }),

  // Performance
  searchTimeMs: integer('search_time_ms'),
  aiResponseTimeMs: integer('ai_response_time_ms'),

  // User satisfaction
  userSatisfactionRating: integer('user_satisfaction_rating'), // 1-5
  foundAnswer: boolean('found_answer'),

  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantDateIdx: index('kb_search_tenant_date_idx').on(table.tenantId, table.createdAt),
  intentIdx: index('kb_search_intent_idx').on(table.queryIntent),
  userSessionIdx: index('kb_search_user_session_idx').on(table.userId, table.sessionId),
}));

// Zod Insert Schemas
export const insertKnowledgeCategorySchema = createInsertSchema(knowledgeCategories, {
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const insertKnowledgeArticleSchema = createInsertSchema(knowledgeArticles, {
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500),
  content: z.any(),
  categoryId: z.string().uuid(),
});

export const insertArticleVersionSchema = createInsertSchema(articleVersions, {
  articleId: z.string().uuid(),
  version: z.number().int().positive(),
  content: z.any(),
});

export const insertArticleFeedbackSchema = createInsertSchema(articleFeedback, {
  articleId: z.string().uuid(),
  feedbackType: z.string(),
});

export const insertAiContentGenerationQueueSchema = createInsertSchema(aiContentGenerationQueue, {
  targetType: z.string(),
  prompt: z.string().min(1),
});

// TypeScript Types
export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type InsertKnowledgeCategory = typeof knowledgeCategories.$inferInsert;

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type InsertKnowledgeArticle = typeof knowledgeArticles.$inferInsert;

export type ArticleVersion = typeof articleVersions.$inferSelect;
export type InsertArticleVersion = typeof articleVersions.$inferInsert;

export type ArticleView = typeof articleViews.$inferSelect;
export type InsertArticleView = typeof articleViews.$inferInsert;

export type ArticleFeedback = typeof articleFeedback.$inferSelect;
export type InsertArticleFeedback = typeof articleFeedback.$inferInsert;

export type AiContentGenerationQueue = typeof aiContentGenerationQueue.$inferSelect;
export type InsertAiContentGenerationQueue = typeof aiContentGenerationQueue.$inferInsert;

export type ArticleEmbedding = typeof articleEmbeddings.$inferSelect;
export type InsertArticleEmbedding = typeof articleEmbeddings.$inferInsert;

export type KnowledgeSearchQuery = typeof knowledgeSearchQueries.$inferSelect;
export type InsertKnowledgeSearchQuery = typeof knowledgeSearchQueries.$inferInsert;
