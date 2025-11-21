import { pgTable, text, varchar, timestamp, jsonb, boolean, integer, uuid, index, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ============= ENUMS =============

export const contentTypeEnum = pgEnum('content_type', [
  'blog_post',
  'guide',
  'case_study',
  'landing_page',
  'calculator',
  'comparison',
  'whitepaper'
]);

export const contentStatusEnum = pgEnum('content_status', [
  'draft',
  'review',
  'scheduled',
  'published',
  'archived'
]);

export const contentCategoryEnum = pgEnum('content_category', [
  'operational_efficiency',
  'meter_billing',
  'service_operations',
  'business_growth',
  'integration',
  'mobile',
  'analytics',
  'automation',
  'security',
  'industry_news'
]);

export const keywordTierEnum = pgEnum('keyword_tier', [
  'tier1_pain_points',
  'tier2_solution_specific',
  'tier3_conversational'
]);

// ============= BLOG POSTS =============

export const blogPosts = pgTable('blog_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'), // null for platform-level content

  // Content
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),

  // SEO
  metaTitle: varchar('meta_title', { length: 60 }),
  metaDescription: varchar('meta_description', { length: 160 }),
  focusKeyword: varchar('focus_keyword', { length: 255 }),
  secondaryKeywords: jsonb('secondary_keywords').$type<string[]>(),
  keywordTier: keywordTierEnum('keyword_tier'),

  // Schema.org structured data
  structuredData: jsonb('structured_data').$type<{
    '@context': string;
    '@type': string;
    headline?: string;
    image?: string[];
    datePublished?: string;
    dateModified?: string;
    author?: { '@type': string; name: string };
    publisher?: { '@type': string; name: string; logo?: any };
    description?: string;
    mainEntityOfPage?: { '@type': string; '@id': string };
  }>(),

  // Featured image
  featuredImage: varchar('featured_image', { length: 500 }),
  featuredImageAlt: varchar('featured_image_alt', { length: 255 }),

  // Organization
  category: contentCategoryEnum('category').notNull(),
  tags: jsonb('tags').$type<string[]>(),

  // Status and publishing
  status: contentStatusEnum('status').default('draft').notNull(),
  publishedAt: timestamp('published_at'),
  scheduledFor: timestamp('scheduled_for'),

  // Author
  authorId: uuid('author_id'),
  authorName: varchar('author_name', { length: 255 }),

  // Analytics
  viewCount: integer('view_count').default(0),
  readTime: integer('read_time'), // in minutes
  wordCount: integer('word_count'),

  // GEO optimization flags
  hasCitations: boolean('has_citations').default(false),
  hasStatistics: boolean('has_statistics').default(false),
  hasQuotations: boolean('has_quotations').default(false),
  hasFaqSection: boolean('has_faq_section').default(false),
  hasStepsSection: boolean('has_steps_section').default(false),
  hasComparisonTable: boolean('has_comparison_table').default(false),

  // SEO scores
  seoScore: integer('seo_score'),
  readabilityScore: integer('readability_score'),
  geoScore: integer('geo_score'),

  // Internal linking
  relatedPosts: jsonb('related_posts').$type<string[]>(), // Array of post IDs
  pillarPageId: uuid('pillar_page_id'), // If this is a spoke article

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('blog_posts_slug_idx').on(table.slug),
  statusIdx: index('blog_posts_status_idx').on(table.status),
  categoryIdx: index('blog_posts_category_idx').on(table.category),
  publishedAtIdx: index('blog_posts_published_at_idx').on(table.publishedAt),
  tenantIdx: index('blog_posts_tenant_idx').on(table.tenantId),
}));

// ============= GUIDES & LONG-FORM CONTENT =============

export const guides = pgTable('guides', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),

  // Content
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  subtitle: varchar('subtitle', { length: 500 }),
  description: text('description'),
  content: text('content').notNull(),

  // Table of contents
  tableOfContents: jsonb('table_of_contents').$type<Array<{
    id: string;
    title: string;
    level: number;
    children?: Array<any>;
  }>>(),

  // SEO
  metaTitle: varchar('meta_title', { length: 60 }),
  metaDescription: varchar('meta_description', { length: 160 }),
  focusKeyword: varchar('focus_keyword', { length: 255 }),
  secondaryKeywords: jsonb('secondary_keywords').$type<string[]>(),

  // Schema.org structured data
  structuredData: jsonb('structured_data'),

  // Media
  coverImage: varchar('cover_image', { length: 500 }),
  coverImageAlt: varchar('cover_image_alt', { length: 255 }),

  // Organization
  category: contentCategoryEnum('category').notNull(),
  isPillar: boolean('is_pillar').default(false), // Is this a pillar page?
  tags: jsonb('tags').$type<string[]>(),

  // Status
  status: contentStatusEnum('status').default('draft').notNull(),
  publishedAt: timestamp('published_at'),

  // Author
  authorId: uuid('author_id'),
  authorName: varchar('author_name', { length: 255 }),

  // Analytics
  viewCount: integer('view_count').default(0),
  downloadCount: integer('download_count').default(0),
  readTime: integer('read_time'),
  wordCount: integer('word_count'),

  // GEO optimization
  hasCitations: boolean('has_citations').default(false),
  hasStatistics: boolean('has_statistics').default(false),
  hasInteractiveTool: boolean('has_interactive_tool').default(false),

  // SEO scores
  seoScore: integer('seo_score'),
  geoScore: integer('geo_score'),

  // Related content
  relatedGuides: jsonb('related_guides').$type<string[]>(),
  relatedBlogPosts: jsonb('related_blog_posts').$type<string[]>(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('guides_slug_idx').on(table.slug),
  statusIdx: index('guides_status_idx').on(table.status),
  pillarIdx: index('guides_pillar_idx').on(table.isPillar),
}));

// ============= CASE STUDIES =============

export const caseStudies = pgTable('case_studies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),

  // Content
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  subtitle: varchar('subtitle', { length: 500 }),

  // Client info (can be anonymized)
  clientName: varchar('client_name', { length: 255 }),
  clientIndustry: varchar('client_industry', { length: 100 }),
  clientSize: varchar('client_size', { length: 50 }), // "5-50 employees", etc.
  isAnonymized: boolean('is_anonymized').default(false),

  // Story structure
  challenge: text('challenge').notNull(),
  solution: text('solution').notNull(),
  results: text('results').notNull(),
  testimonial: text('testimonial'),
  testimonialAuthor: varchar('testimonial_author', { length: 255 }),
  testimonialRole: varchar('testimonial_role', { length: 255 }),

  // Metrics (before/after)
  metrics: jsonb('metrics').$type<Array<{
    name: string;
    before: string | number;
    after: string | number;
    improvement: string;
    unit?: string;
  }>>(),

  // ROI data
  roiPercentage: integer('roi_percentage'),
  timeSaved: varchar('time_saved', { length: 100 }),
  costSavings: varchar('cost_savings', { length: 100 }),

  // SEO
  metaTitle: varchar('meta_title', { length: 60 }),
  metaDescription: varchar('meta_description', { length: 160 }),
  focusKeyword: varchar('focus_keyword', { length: 255 }),

  // Schema.org structured data
  structuredData: jsonb('structured_data'),

  // Media
  featuredImage: varchar('featured_image', { length: 500 }),
  featuredImageAlt: varchar('featured_image_alt', { length: 255 }),
  additionalImages: jsonb('additional_images').$type<Array<{
    url: string;
    alt: string;
    caption?: string;
  }>>(),

  // Organization
  category: contentCategoryEnum('category'),
  tags: jsonb('tags').$type<string[]>(),
  featuredSolutions: jsonb('featured_solutions').$type<string[]>(), // Which Printyx solutions were used

  // Status
  status: contentStatusEnum('status').default('draft').notNull(),
  publishedAt: timestamp('published_at'),

  // Analytics
  viewCount: integer('view_count').default(0),
  downloadCount: integer('download_count').default(0),

  // SEO scores
  seoScore: integer('seo_score'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('case_studies_slug_idx').on(table.slug),
  statusIdx: index('case_studies_status_idx').on(table.status),
}));

// ============= LANDING PAGES =============

export const landingPages = pgTable('landing_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),

  // Content
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),

  // Page type
  pageType: varchar('page_type', { length: 50 }).notNull(), // 'solution', 'industry', 'comparison', 'calculator'

  // SEO
  metaTitle: varchar('meta_title', { length: 60 }),
  metaDescription: varchar('meta_description', { length: 160 }),
  focusKeyword: varchar('focus_keyword', { length: 255 }),
  secondaryKeywords: jsonb('secondary_keywords').$type<string[]>(),

  // Hero section
  heroHeadline: varchar('hero_headline', { length: 255 }),
  heroSubheadline: text('hero_subheadline'),
  heroImage: varchar('hero_image', { length: 500 }),
  heroCta: varchar('hero_cta', { length: 100 }),
  heroCtaUrl: varchar('hero_cta_url', { length: 500 }),

  // Sections (flexible JSON structure)
  sections: jsonb('sections').$type<Array<{
    type: 'text' | 'features' | 'benefits' | 'pricing' | 'testimonial' | 'cta' | 'faq' | 'comparison';
    title?: string;
    content?: any;
    order: number;
  }>>(),

  // Schema.org structured data
  structuredData: jsonb('structured_data'),

  // Status
  status: contentStatusEnum('status').default('draft').notNull(),
  publishedAt: timestamp('published_at'),

  // Analytics
  viewCount: integer('view_count').default(0),
  conversionCount: integer('conversion_count').default(0),
  conversionRate: integer('conversion_rate'), // percentage

  // A/B Testing
  isVariant: boolean('is_variant').default(false),
  parentPageId: uuid('parent_page_id'), // If this is a variant
  variantName: varchar('variant_name', { length: 100 }),

  // SEO scores
  seoScore: integer('seo_score'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('landing_pages_slug_idx').on(table.slug),
  statusIdx: index('landing_pages_status_idx').on(table.status),
  pageTypeIdx: index('landing_pages_page_type_idx').on(table.pageType),
}));

// ============= CONTENT ANALYTICS =============

export const contentAnalytics = pgTable('content_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Reference
  contentType: contentTypeEnum('content_type').notNull(),
  contentId: uuid('content_id').notNull(),

  // Traffic source
  source: varchar('source', { length: 100 }), // 'organic', 'social', 'direct', 'referral', 'ai'
  medium: varchar('medium', { length: 100 }),
  campaign: varchar('campaign', { length: 255 }),

  // User behavior
  sessionDuration: integer('session_duration'), // seconds
  scrollDepth: integer('scroll_depth'), // percentage
  ctaClicked: boolean('cta_clicked').default(false),
  downloaded: boolean('downloaded').default(false),

  // Device
  device: varchar('device', { length: 50 }), // 'mobile', 'desktop', 'tablet'
  browser: varchar('browser', { length: 50 }),

  // Location
  country: varchar('country', { length: 2 }),
  region: varchar('region', { length: 100 }),

  // AI search tracking
  isAiReferral: boolean('is_ai_referral').default(false),
  aiPlatform: varchar('ai_platform', { length: 50 }), // 'chatgpt', 'perplexity', 'google_ai', 'claude'

  // Timestamp
  viewedAt: timestamp('viewed_at').defaultNow().notNull(),
}, (table) => ({
  contentIdx: index('content_analytics_content_idx').on(table.contentType, table.contentId),
  sourceIdx: index('content_analytics_source_idx').on(table.source),
  viewedAtIdx: index('content_analytics_viewed_at_idx').on(table.viewedAt),
}));

// ============= CONTENT FAQ SECTIONS =============

export const contentFaqs = pgTable('content_faqs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Reference
  contentType: contentTypeEnum('content_type').notNull(),
  contentId: uuid('content_id').notNull(),

  // FAQ item
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  order: integer('order').default(0),

  // SEO
  isMainEntity: boolean('is_main_entity').default(false), // For FAQ schema markup

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  contentIdx: index('content_faqs_content_idx').on(table.contentType, table.contentId),
}));

// ============= CONTENT CITATIONS =============

export const contentCitations = pgTable('content_citations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Reference
  contentType: contentTypeEnum('content_type').notNull(),
  contentId: uuid('content_id').notNull(),

  // Citation details
  sourceTitle: varchar('source_title', { length: 500 }).notNull(),
  sourceUrl: varchar('source_url', { length: 1000 }),
  sourceAuthor: varchar('source_author', { length: 255 }),
  sourceOrganization: varchar('source_organization', { length: 255 }),
  publicationDate: timestamp('publication_date'),

  // Context
  citedText: text('cited_text'), // The actual quoted or referenced text
  contextInContent: text('context_in_content'), // Where/how it's used in the content

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  contentIdx: index('content_citations_content_idx').on(table.contentType, table.contentId),
}));

// ============= INSERT SCHEMAS =============

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
});

export const insertGuideSchema = createInsertSchema(guides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  downloadCount: true,
});

export const insertCaseStudySchema = createInsertSchema(caseStudies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  downloadCount: true,
});

export const insertLandingPageSchema = createInsertSchema(landingPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  conversionCount: true,
});

export const insertContentFaqSchema = createInsertSchema(contentFaqs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentCitationSchema = createInsertSchema(contentCitations).omit({
  id: true,
  createdAt: true,
});

// ============= TYPES =============

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export type Guide = typeof guides.$inferSelect;
export type InsertGuide = z.infer<typeof insertGuideSchema>;

export type CaseStudy = typeof caseStudies.$inferSelect;
export type InsertCaseStudy = z.infer<typeof insertCaseStudySchema>;

export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = z.infer<typeof insertLandingPageSchema>;

export type ContentAnalytics = typeof contentAnalytics.$inferSelect;

export type ContentFaq = typeof contentFaqs.$inferSelect;
export type InsertContentFaq = z.infer<typeof insertContentFaqSchema>;

export type ContentCitation = typeof contentCitations.$inferSelect;
export type InsertContentCitation = z.infer<typeof insertContentCitationSchema>;
