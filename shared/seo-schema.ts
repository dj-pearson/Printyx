/**
 * SEO Management Database Schema
 * Tables for comprehensive SEO analysis, monitoring, and optimization
 * Includes 28+ tables for audit history, keywords, competitors, crawling, and more
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  decimal,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';

// ============= ENUMS =============

export const seoAuditStatusEnum = pgEnum('seo_audit_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);
export const seoFixStatusEnum = pgEnum('seo_fix_status', [
  'pending',
  'applied',
  'failed',
  'reverted',
]);
export const seoSeverityEnum = pgEnum('seo_severity', ['low', 'medium', 'high', 'critical']);
export const seoAlertStatusEnum = pgEnum('seo_alert_status', [
  'active',
  'acknowledged',
  'resolved',
  'ignored',
]);
export const seoNotificationTypeEnum = pgEnum('seo_notification_type', [
  'email',
  'slack',
  'webhook',
  'dashboard',
]);
export const seoContentStatusEnum = pgEnum('seo_content_status', [
  'draft',
  'optimized',
  'published',
  'archived',
]);
export const seoMonitoringFrequencyEnum = pgEnum('seo_monitoring_frequency', [
  'hourly',
  'daily',
  'weekly',
  'monthly',
]);

// ============= CORE SEO SETTINGS =============

export const seoSettings = pgTable(
  'seo_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Site Information
    siteUrl: varchar('site_url', { length: 500 }).notNull(),
    siteName: varchar('site_name', { length: 255 }),

    // Meta Tags
    defaultTitle: varchar('default_title', { length: 255 }),
    defaultDescription: text('default_description'),
    defaultKeywords: text('default_keywords'),
    defaultOgImage: varchar('default_og_image', { length: 500 }),

    // Technical SEO
    robotsTxt: text('robots_txt'),
    llmsTxt: text('llms_txt'), // AI crawler exclusion
    sitemapUrl: varchar('sitemap_url', { length: 500 }),

    // Social Media
    twitterHandle: varchar('twitter_handle', { length: 50 }),
    facebookAppId: varchar('facebook_app_id', { length: 50 }),

    // Monitoring
    monitoringEnabled: boolean('monitoring_enabled').default(false),
    monitoringFrequency: seoMonitoringFrequencyEnum('monitoring_frequency').default('daily'),

    // Analytics
    googleAnalyticsId: varchar('google_analytics_id', { length: 50 }),
    googleSearchConsoleVerification: varchar('gsc_verification', { length: 100 }),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_settings_tenant_idx').on(table.tenantId),
  }),
);

// ============= AUDIT HISTORY =============

export const seoAuditHistory = pgTable(
  'seo_audit_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Audit Details
    url: varchar('url', { length: 500 }).notNull(),
    status: seoAuditStatusEnum('status').notNull().default('pending'),

    // Scores (0-100)
    overallScore: integer('overall_score'),
    technicalScore: integer('technical_score'),
    contentScore: integer('content_score'),
    performanceScore: integer('performance_score'),

    // Issue Counts
    criticalIssues: integer('critical_issues').default(0),
    highIssues: integer('high_issues').default(0),
    mediumIssues: integer('medium_issues').default(0),
    lowIssues: integer('low_issues').default(0),

    // Detailed Results
    issues: jsonb('issues').$type<
      Array<{
        category: string;
        severity: string;
        message: string;
        fix?: string;
      }>
    >(),

    recommendations: jsonb('recommendations').$type<string[]>(),
    technicalDetails: jsonb('technical_details'),

    // Performance Metrics
    duration: integer('duration_ms'), // Audit duration in milliseconds

    // Audit Metadata
    triggeredBy: uuid('triggered_by'), // User who triggered the audit
    auditType: varchar('audit_type', { length: 50 }).default('manual'), // 'manual', 'scheduled', 'automatic'

    // Timestamps
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_audit_history_tenant_idx').on(table.tenantId),
    urlIdx: index('seo_audit_history_url_idx').on(table.url),
    statusIdx: index('seo_audit_history_status_idx').on(table.status),
  }),
);

// ============= FIXES APPLIED =============

export const seoFixesApplied = pgTable(
  'seo_fixes_applied',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    auditId: uuid('audit_id').notNull(),

    // Fix Details
    category: varchar('category', { length: 100 }).notNull(),
    issue: text('issue').notNull(),
    fix: text('fix').notNull(),
    severity: seoSeverityEnum('severity').notNull(),

    // Fix Status
    status: seoFixStatusEnum('status').notNull().default('pending'),

    // Before/After Values
    oldValue: text('old_value'),
    newValue: text('new_value'),

    // Application Details
    appliedBy: uuid('applied_by'), // User who applied the fix
    revertedBy: uuid('reverted_by'),

    // Metadata
    metadata: jsonb('metadata'),
    errorMessage: text('error_message'),

    // Timestamps
    appliedAt: timestamp('applied_at'),
    revertedAt: timestamp('reverted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_fixes_tenant_idx').on(table.tenantId),
    auditIdx: index('seo_fixes_audit_idx').on(table.auditId),
    statusIdx: index('seo_fixes_status_idx').on(table.status),
  }),
);

// ============= KEYWORDS TRACKING =============

export const seoKeywords = pgTable(
  'seo_keywords',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Keyword Details
    keyword: varchar('keyword', { length: 255 }).notNull(),
    targetUrl: varchar('target_url', { length: 500 }),

    // Position Tracking
    currentPosition: integer('current_position'),
    targetPosition: integer('target_position'),
    bestPosition: integer('best_position'),

    // Metrics
    searchVolume: integer('search_volume'),
    difficulty: integer('difficulty'), // 0-100
    cpc: decimal('cpc', { precision: 10, scale: 2 }), // Cost per click

    // Performance
    impressions: integer('impressions'),
    clicks: integer('clicks'),
    ctr: decimal('ctr', { precision: 5, scale: 2 }), // Click-through rate

    // Competition Analysis
    competitorUrls: jsonb('competitor_urls').$type<string[]>(),

    // Settings
    isActive: boolean('is_active').default(true),
    priority: integer('priority').default(5), // 1-10

    // Tracking
    lastChecked: timestamp('last_checked'),
    checkFrequency: seoMonitoringFrequencyEnum('check_frequency').default('weekly'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_keywords_tenant_idx').on(table.tenantId),
    keywordIdx: index('seo_keywords_keyword_idx').on(table.keyword),
    activeIdx: index('seo_keywords_active_idx').on(table.isActive),
  }),
);

// ============= KEYWORD HISTORY =============

export const seoKeywordHistory = pgTable(
  'seo_keyword_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keywordId: uuid('keyword_id').notNull(),

    // Position Data
    position: integer('position'),
    impressions: integer('impressions'),
    clicks: integer('clicks'),
    ctr: decimal('ctr', { precision: 5, scale: 2 }),

    // Timestamp
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  },
  (table) => ({
    keywordIdx: index('seo_keyword_history_keyword_idx').on(table.keywordId),
    recordedIdx: index('seo_keyword_history_recorded_idx').on(table.recordedAt),
  }),
);

// ============= COMPETITOR ANALYSIS =============

export const seoCompetitorAnalysis = pgTable(
  'seo_competitor_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Competitor Details
    competitorUrl: varchar('competitor_url', { length: 500 }).notNull(),
    competitorName: varchar('competitor_name', { length: 255 }),

    // Metrics
    estimatedTraffic: integer('estimated_traffic'),
    domainAuthority: integer('domain_authority'), // 0-100
    pageAuthority: integer('page_authority'), // 0-100

    // Keyword Rankings
    rankingKeywords: integer('ranking_keywords'),
    topRankingKeywords: jsonb('top_ranking_keywords').$type<
      Array<{
        keyword: string;
        position: number;
        searchVolume: number;
      }>
    >(),

    // Backlinks
    totalBacklinks: integer('total_backlinks'),
    referringDomains: integer('referring_domains'),

    // Content Analysis
    contentStrategies: jsonb('content_strategies'),
    topPages: jsonb('top_pages').$type<
      Array<{
        url: string;
        traffic: number;
        keywords: number;
      }>
    >(),

    // Analysis Date
    analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_competitor_tenant_idx').on(table.tenantId),
    urlIdx: index('seo_competitor_url_idx').on(table.competitorUrl),
  }),
);

// ============= PAGE SCORES =============

export const seoPageScores = pgTable(
  'seo_page_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Page Details
    url: varchar('url', { length: 500 }).notNull(),
    title: varchar('title', { length: 255 }),

    // SEO Scores (0-100)
    seoScore: integer('seo_score'),
    contentQuality: integer('content_quality'),
    technicalSeo: integer('technical_seo'),
    userExperience: integer('user_experience'),

    // Content Metrics
    wordCount: integer('word_count'),
    readingLevel: decimal('reading_level', { precision: 4, scale: 2 }),
    uniqueContentPercentage: integer('unique_content_percentage'),

    // Technical Metrics
    loadTime: integer('load_time_ms'),
    mobileScore: integer('mobile_score'),
    accessibilityScore: integer('accessibility_score'),

    // Issues
    issues: jsonb('issues').$type<
      Array<{
        type: string;
        severity: string;
        message: string;
      }>
    >(),

    // Last Analysis
    lastAnalyzed: timestamp('last_analyzed').defaultNow().notNull(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_page_scores_tenant_idx').on(table.tenantId),
    urlIdx: index('seo_page_scores_url_idx').on(table.url),
  }),
);

// ============= MONITORING LOG =============

export const seoMonitoringLog = pgTable(
  'seo_monitoring_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Monitoring Details
    checkType: varchar('check_type', { length: 100 }).notNull(), // 'uptime', 'rank', 'performance', etc.
    targetUrl: varchar('target_url', { length: 500 }),

    // Results
    status: varchar('status', { length: 50 }).notNull(), // 'success', 'warning', 'error'
    result: jsonb('result'),

    // Metrics
    responseTime: integer('response_time_ms'),
    statusCode: integer('status_code'),

    // Change Detection
    changeDetected: boolean('change_detected').default(false),
    changeDetails: jsonb('change_details'),

    // Timestamp
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_monitoring_tenant_idx').on(table.tenantId),
    typeIdx: index('seo_monitoring_type_idx').on(table.checkType),
    checkedIdx: index('seo_monitoring_checked_idx').on(table.checkedAt),
  }),
);

// ============= GOOGLE SEARCH CONSOLE =============

export const gscOauthCredentials = pgTable(
  'gsc_oauth_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // OAuth Tokens
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    tokenType: varchar('token_type', { length: 50 }).default('Bearer'),

    // Token Expiry
    expiresAt: timestamp('expires_at').notNull(),

    // Scope
    scope: text('scope'),

    // User Info
    email: varchar('email', { length: 255 }),

    // Status
    isActive: boolean('is_active').default(true),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('gsc_oauth_tenant_idx').on(table.tenantId),
  }),
);

export const gscProperties = pgTable(
  'gsc_properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    credentialId: uuid('credential_id').notNull(),

    // Property Details
    propertyUrl: varchar('property_url', { length: 500 }).notNull(),
    propertyName: varchar('property_name', { length: 255 }),
    permissionLevel: varchar('permission_level', { length: 50 }), // 'owner', 'full', 'restricted'

    // Sync Settings
    isActive: boolean('is_active').default(true),
    autoSync: boolean('auto_sync').default(true),
    syncFrequency: seoMonitoringFrequencyEnum('sync_frequency').default('daily'),
    lastSyncedAt: timestamp('last_synced_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('gsc_properties_tenant_idx').on(table.tenantId),
    credentialIdx: index('gsc_properties_credential_idx').on(table.credentialId),
  }),
);

export const gscKeywordPerformance = pgTable(
  'gsc_keyword_performance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),

    // Keyword Data
    query: varchar('query', { length: 255 }).notNull(),
    page: varchar('page', { length: 500 }),

    // Metrics
    impressions: integer('impressions').notNull(),
    clicks: integer('clicks').notNull(),
    ctr: decimal('ctr', { precision: 5, scale: 2 }).notNull(),
    position: decimal('position', { precision: 5, scale: 2 }).notNull(),

    // Filters
    country: varchar('country', { length: 2 }), // ISO country code
    device: varchar('device', { length: 20 }), // 'desktop', 'mobile', 'tablet'

    // Date
    date: timestamp('date').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    propertyIdx: index('gsc_keyword_property_idx').on(table.propertyId),
    queryIdx: index('gsc_keyword_query_idx').on(table.query),
    dateIdx: index('gsc_keyword_date_idx').on(table.date),
  }),
);

export const gscPagePerformance = pgTable(
  'gsc_page_performance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),

    // Page Data
    page: varchar('page', { length: 500 }).notNull(),

    // Metrics
    impressions: integer('impressions').notNull(),
    clicks: integer('clicks').notNull(),
    ctr: decimal('ctr', { precision: 5, scale: 2 }).notNull(),
    position: decimal('position', { precision: 5, scale: 2 }).notNull(),

    // Date
    date: timestamp('date').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    propertyIdx: index('gsc_page_property_idx').on(table.propertyId),
    pageIdx: index('gsc_page_page_idx').on(table.page),
    dateIdx: index('gsc_page_date_idx').on(table.date),
  }),
);

// ============= ALERTS & NOTIFICATIONS =============

export const seoNotificationPreferences = pgTable(
  'seo_notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),

    // Notification Channels
    email: boolean('email').default(true),
    emailAddress: varchar('email_address', { length: 255 }),

    slack: boolean('slack').default(false),
    slackWebhook: varchar('slack_webhook', { length: 500 }),

    webhook: boolean('webhook').default(false),
    webhookUrl: varchar('webhook_url', { length: 500 }),

    // Notification Types
    rankingChanges: boolean('ranking_changes').default(true),
    technicalIssues: boolean('technical_issues').default(true),
    performanceAlerts: boolean('performance_alerts').default(true),
    auditCompleted: boolean('audit_completed').default(true),

    // Thresholds
    minRankingChange: integer('min_ranking_change').default(5), // Alert if position changes by X
    minPerformanceChange: integer('min_performance_change').default(10), // Alert if performance changes by X%

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_notif_prefs_tenant_idx').on(table.tenantId),
    userIdx: index('seo_notif_prefs_user_idx').on(table.userId),
  }),
);

export const seoAlertRules = pgTable(
  'seo_alert_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Rule Details
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Conditions
    metric: varchar('metric', { length: 100 }).notNull(), // 'position', 'traffic', 'score', etc.
    operator: varchar('operator', { length: 20 }).notNull(), // 'gt', 'lt', 'eq', 'change'
    threshold: decimal('threshold', { precision: 10, scale: 2 }).notNull(),

    // Targets
    targetUrl: varchar('target_url', { length: 500 }),
    targetKeyword: varchar('target_keyword', { length: 255 }),

    // Settings
    isActive: boolean('is_active').default(true),
    severity: seoSeverityEnum('severity').notNull().default('medium'),

    // Notifications
    notifyEmail: boolean('notify_email').default(true),
    notifySlack: boolean('notify_slack').default(false),
    notifyWebhook: boolean('notify_webhook').default(false),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_alert_rules_tenant_idx').on(table.tenantId),
    activeIdx: index('seo_alert_rules_active_idx').on(table.isActive),
  }),
);

export const seoAlerts = pgTable(
  'seo_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    ruleId: uuid('rule_id'),

    // Alert Details
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    severity: seoSeverityEnum('severity').notNull(),

    // Status
    status: seoAlertStatusEnum('status').notNull().default('active'),

    // Data
    metric: varchar('metric', { length: 100 }),
    oldValue: decimal('old_value', { precision: 10, scale: 2 }),
    newValue: decimal('new_value', { precision: 10, scale: 2 }),
    url: varchar('url', { length: 500 }),

    // Resolution
    acknowledgedBy: uuid('acknowledged_by'),
    acknowledgedAt: timestamp('acknowledged_at'),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at'),
    resolutionNotes: text('resolution_notes'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_alerts_tenant_idx').on(table.tenantId),
    statusIdx: index('seo_alerts_status_idx').on(table.status),
    severityIdx: index('seo_alerts_severity_idx').on(table.severity),
  }),
);

export const seoMonitoringSchedules = pgTable(
  'seo_monitoring_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Schedule Details
    name: varchar('name', { length: 255 }).notNull(),
    taskType: varchar('task_type', { length: 100 }).notNull(), // 'audit', 'crawl', 'rank_check', etc.

    // Target
    targetUrl: varchar('target_url', { length: 500 }),

    // Schedule
    frequency: seoMonitoringFrequencyEnum('frequency').notNull(),
    scheduleTime: varchar('schedule_time', { length: 10 }), // HH:MM format
    timezone: varchar('timezone', { length: 50 }).default('UTC'),

    // Settings
    isActive: boolean('is_active').default(true),
    lastRunAt: timestamp('last_run_at'),
    nextRunAt: timestamp('next_run_at'),

    // Configuration
    config: jsonb('config'), // Task-specific configuration

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_schedules_tenant_idx').on(table.tenantId),
    activeIdx: index('seo_schedules_active_idx').on(table.isActive),
    nextRunIdx: index('seo_schedules_next_run_idx').on(table.nextRunAt),
  }),
);

// ============= CORE WEB VITALS =============

export const seoCoreWebVitals = pgTable(
  'seo_core_web_vitals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Page Details
    url: varchar('url', { length: 500 }).notNull(),

    // Core Web Vitals Metrics
    lcp: integer('lcp'), // Largest Contentful Paint (ms)
    fid: integer('fid'), // First Input Delay (ms)
    cls: decimal('cls', { precision: 5, scale: 3 }), // Cumulative Layout Shift

    // Additional Performance Metrics
    fcp: integer('fcp'), // First Contentful Paint (ms)
    ttfb: integer('ttfb'), // Time to First Byte (ms)
    tti: integer('tti'), // Time to Interactive (ms)
    tbt: integer('tbt'), // Total Blocking Time (ms)
    si: decimal('si', { precision: 6, scale: 2 }), // Speed Index

    // Overall Scores (0-100)
    performanceScore: integer('performance_score'),
    accessibilityScore: integer('accessibility_score'),
    bestPracticesScore: integer('best_practices_score'),
    seoScore: integer('seo_score'),

    // Device Type
    device: varchar('device', { length: 20 }).default('mobile'), // 'mobile' or 'desktop'

    // Diagnostics
    diagnostics: jsonb('diagnostics'),
    opportunities: jsonb('opportunities'),

    // Timestamp
    measuredAt: timestamp('measured_at').defaultNow().notNull(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_cwv_tenant_idx').on(table.tenantId),
    urlIdx: index('seo_cwv_url_idx').on(table.url),
    measuredIdx: index('seo_cwv_measured_idx').on(table.measuredAt),
  }),
);

// ============= SITE CRAWLER =============

export const seoCrawlResults = pgTable(
  'seo_crawl_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Crawl Session
    crawlId: uuid('crawl_id').notNull(), // Group related crawl results

    // Page Details
    url: varchar('url', { length: 500 }).notNull(),
    title: varchar('title', { length: 255 }),
    metaDescription: text('meta_description'),
    h1: varchar('h1', { length: 255 }),

    // Status
    statusCode: integer('status_code'),
    redirectUrl: varchar('redirect_url', { length: 500 }),

    // Content
    wordCount: integer('word_count'),
    contentType: varchar('content_type', { length: 100 }),

    // Links
    internalLinks: integer('internal_links'),
    externalLinks: integer('external_links'),
    brokenLinks: integer('broken_links'),

    // Images
    totalImages: integer('total_images'),
    imagesWithoutAlt: integer('images_without_alt'),

    // SEO Elements
    hasCanonical: boolean('has_canonical').default(false),
    canonicalUrl: varchar('canonical_url', { length: 500 }),
    hasSchema: boolean('has_schema').default(false),
    schemaTypes: jsonb('schema_types').$type<string[]>(),

    // Performance
    loadTime: integer('load_time_ms'),
    pageSize: integer('page_size_bytes'),

    // Depth
    crawlDepth: integer('crawl_depth').default(0),

    // Issues
    issues: jsonb('issues').$type<
      Array<{
        type: string;
        severity: string;
        message: string;
      }>
    >(),

    // Timestamp
    crawledAt: timestamp('crawled_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_crawl_tenant_idx').on(table.tenantId),
    crawlIdIdx: index('seo_crawl_crawlid_idx').on(table.crawlId),
    urlIdx: index('seo_crawl_url_idx').on(table.url),
  }),
);

// ============= IMAGE ANALYSIS =============

export const seoImageAnalysis = pgTable(
  'seo_image_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Page Details
    pageUrl: varchar('page_url', { length: 500 }).notNull(),
    imageUrl: varchar('image_url', { length: 500 }).notNull(),

    // Image Properties
    altText: varchar('alt_text', { length: 500 }),
    title: varchar('title', { length: 255 }),
    fileSize: integer('file_size_bytes'),
    width: integer('width'),
    height: integer('height'),
    format: varchar('format', { length: 20 }), // 'jpg', 'png', 'webp', etc.

    // Optimization
    isOptimized: boolean('is_optimized').default(false),
    hasAltText: boolean('has_alt_text').default(false),
    isLazy: boolean('is_lazy').default(false),
    hasResponsive: boolean('has_responsive').default(false),

    // Issues
    issues: jsonb('issues').$type<string[]>(),

    // Recommendations
    recommendedFormat: varchar('recommended_format', { length: 20 }),
    potentialSavings: integer('potential_savings_bytes'),

    // Timestamp
    analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_image_tenant_idx').on(table.tenantId),
    pageIdx: index('seo_image_page_idx').on(table.pageUrl),
  }),
);

// ============= REDIRECT ANALYSIS =============

export const seoRedirectAnalysis = pgTable(
  'seo_redirect_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Redirect Chain
    sourceUrl: varchar('source_url', { length: 500 }).notNull(),
    destinationUrl: varchar('destination_url', { length: 500 }).notNull(),

    // Chain Details
    redirectChain: jsonb('redirect_chain').$type<
      Array<{
        url: string;
        statusCode: number;
      }>
    >(),
    chainLength: integer('chain_length'),

    // Status
    statusCode: integer('status_code'),
    redirectType: varchar('redirect_type', { length: 50 }), // '301', '302', '307', etc.

    // Issues
    hasRedirectLoop: boolean('has_redirect_loop').default(false),
    hasMultipleRedirects: boolean('has_multiple_redirects').default(false),
    issues: jsonb('issues').$type<string[]>(),

    // Performance
    totalTime: integer('total_time_ms'),

    // Timestamp
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_redirect_tenant_idx').on(table.tenantId),
    sourceIdx: index('seo_redirect_source_idx').on(table.sourceUrl),
  }),
);

// ============= DUPLICATE CONTENT =============

export const seoDuplicateContent = pgTable(
  'seo_duplicate_content',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Content Details
    url1: varchar('url1', { length: 500 }).notNull(),
    url2: varchar('url2', { length: 500 }).notNull(),

    // Similarity
    similarityScore: decimal('similarity_score', { precision: 5, scale: 2 }), // 0-100
    duplicatePercentage: integer('duplicate_percentage'),

    // Content Analysis
    sharedPhrases: jsonb('shared_phrases').$type<string[]>(),
    uniqueContent1: integer('unique_content_1_chars'),
    uniqueContent2: integer('unique_content_2_chars'),

    // SEO Impact
    canonicalSet: boolean('canonical_set').default(false),
    canonicalUrl: varchar('canonical_url', { length: 500 }),

    // Recommendations
    recommendation: text('recommendation'),

    // Timestamp
    detectedAt: timestamp('detected_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_duplicate_tenant_idx').on(table.tenantId),
    url1Idx: index('seo_duplicate_url1_idx').on(table.url1),
    url2Idx: index('seo_duplicate_url2_idx').on(table.url2),
  }),
);

// ============= SECURITY ANALYSIS =============

export const seoSecurityAnalysis = pgTable(
  'seo_security_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Page Details
    url: varchar('url', { length: 500 }).notNull(),

    // HTTPS
    hasHttps: boolean('has_https').default(false),
    httpsRedirect: boolean('https_redirect').default(false),
    certificateValid: boolean('certificate_valid').default(false),
    certificateExpiry: timestamp('certificate_expiry'),

    // Security Headers
    hasHsts: boolean('has_hsts').default(false),
    hasXFrameOptions: boolean('has_x_frame_options').default(false),
    hasXContentTypeOptions: boolean('has_x_content_type_options').default(false),
    hasContentSecurityPolicy: boolean('has_csp').default(false),

    // Headers Details
    headers: jsonb('headers'),

    // Security Score
    securityScore: integer('security_score'), // 0-100

    // Issues
    issues: jsonb('issues').$type<
      Array<{
        type: string;
        severity: string;
        message: string;
      }>
    >(),

    // Timestamp
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_security_tenant_idx').on(table.tenantId),
    urlIdx: index('seo_security_url_idx').on(table.url),
  }),
);

// ============= LINK ANALYSIS =============

export const seoLinkAnalysis = pgTable(
  'seo_link_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Page Details
    sourceUrl: varchar('source_url', { length: 500 }).notNull(),
    targetUrl: varchar('target_url', { length: 500 }).notNull(),

    // Link Details
    anchorText: text('anchor_text'),
    linkType: varchar('link_type', { length: 50 }), // 'internal', 'external', 'mailto', 'tel'
    isNoFollow: boolean('is_no_follow').default(false),
    isNoOpener: boolean('is_no_opener').default(false),

    // Status
    isBroken: boolean('is_broken').default(false),
    statusCode: integer('status_code'),
    errorMessage: text('error_message'),

    // SEO Value
    linkValue: integer('link_value'), // Estimated SEO value 0-100

    // Timestamp
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_link_tenant_idx').on(table.tenantId),
    sourceIdx: index('seo_link_source_idx').on(table.sourceUrl),
    brokenIdx: index('seo_link_broken_idx').on(table.isBroken),
  }),
);

// ============= STRUCTURED DATA =============

export const seoStructuredData = pgTable(
  'seo_structured_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Page Details
    url: varchar('url', { length: 500 }).notNull(),

    // Schema Details
    schemaType: varchar('schema_type', { length: 100 }).notNull(), // 'Organization', 'Product', 'Article', etc.
    schemaFormat: varchar('schema_format', { length: 20 }).default('json-ld'), // 'json-ld', 'microdata', 'rdfa'

    // Schema Data
    schemaData: jsonb('schema_data').notNull(),

    // Validation
    isValid: boolean('is_valid').default(false),
    validationErrors: jsonb('validation_errors').$type<
      Array<{
        property: string;
        message: string;
      }>
    >(),
    validationWarnings: jsonb('validation_warnings').$type<string[]>(),

    // Rich Results
    richResultsEligible: boolean('rich_results_eligible').default(false),
    richResultTypes: jsonb('rich_result_types').$type<string[]>(),

    // Timestamp
    detectedAt: timestamp('detected_at').defaultNow().notNull(),
    validatedAt: timestamp('validated_at'),
  },
  (table) => ({
    tenantIdx: index('seo_schema_tenant_idx').on(table.tenantId),
    urlIdx: index('seo_schema_url_idx').on(table.url),
    typeIdx: index('seo_schema_type_idx').on(table.schemaType),
  }),
);

// ============= MOBILE ANALYSIS =============

export const seoMobileAnalysis = pgTable(
  'seo_mobile_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Page Details
    url: varchar('url', { length: 500 }).notNull(),

    // Mobile Friendliness
    isMobileFriendly: boolean('is_mobile_friendly').default(false),
    mobileScore: integer('mobile_score'), // 0-100

    // Viewport
    hasViewportMeta: boolean('has_viewport_meta').default(false),
    viewportContent: varchar('viewport_content', { length: 255 }),

    // Touch Elements
    hasTouchFriendlyElements: boolean('has_touch_friendly_elements').default(false),
    touchElementsIssues: jsonb('touch_elements_issues').$type<string[]>(),

    // Text Readability
    hasReadableText: boolean('has_readable_text').default(false),
    textIssues: jsonb('text_issues').$type<string[]>(),

    // Content Width
    contentFitsViewport: boolean('content_fits_viewport').default(false),

    // Performance
    mobileLoadTime: integer('mobile_load_time_ms'),
    mobileFcp: integer('mobile_fcp'), // First Contentful Paint
    mobileLcp: integer('mobile_lcp'), // Largest Contentful Paint

    // Issues
    issues: jsonb('issues').$type<
      Array<{
        type: string;
        severity: string;
        message: string;
      }>
    >(),

    // Timestamp
    analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_mobile_tenant_idx').on(table.tenantId),
    urlIdx: index('seo_mobile_url_idx').on(table.url),
  }),
);

// ============= PERFORMANCE BUDGET =============

export const seoPerformanceBudget = pgTable(
  'seo_performance_budget',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Budget Details
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    targetUrl: varchar('target_url', { length: 500 }),

    // Budget Limits
    maxLoadTime: integer('max_load_time_ms'),
    maxPageSize: integer('max_page_size_kb'),
    maxRequests: integer('max_requests'),
    maxImages: integer('max_images'),
    maxScripts: integer('max_scripts'),
    maxStylesheets: integer('max_stylesheets'),

    // Core Web Vitals Budgets
    maxLcp: integer('max_lcp'), // ms
    maxFid: integer('max_fid'), // ms
    maxCls: decimal('max_cls', { precision: 5, scale: 3 }),

    // Monitoring
    isActive: boolean('is_active').default(true),
    checkFrequency: seoMonitoringFrequencyEnum('check_frequency').default('daily'),

    // Alert Settings
    alertOnExceed: boolean('alert_on_exceed').default(true),
    alertThreshold: integer('alert_threshold_percent').default(90), // Alert at 90% of budget

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_perf_budget_tenant_idx').on(table.tenantId),
    activeIdx: index('seo_perf_budget_active_idx').on(table.isActive),
  }),
);

// ============= CONTENT OPTIMIZATION =============

export const seoContentOptimization = pgTable(
  'seo_content_optimization',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Content Details
    url: varchar('url', { length: 500 }),
    title: varchar('title', { length: 255 }).notNull(),
    originalContent: text('original_content'),
    optimizedContent: text('optimized_content'),

    // Target
    targetKeyword: varchar('target_keyword', { length: 255 }),
    secondaryKeywords: jsonb('secondary_keywords').$type<string[]>(),

    // SEO Metrics
    keywordDensity: decimal('keyword_density', { precision: 5, scale: 2 }),
    readabilityScore: integer('readability_score'), // 0-100
    seoScore: integer('seo_score'), // 0-100

    // Content Analysis
    wordCount: integer('word_count'),
    headingStructure: jsonb('heading_structure'),
    keywordPlacements: jsonb('keyword_placements'),

    // AI Suggestions
    aiSuggestions: jsonb('ai_suggestions').$type<
      Array<{
        type: string;
        suggestion: string;
        priority: string;
      }>
    >(),

    // Status
    status: seoContentStatusEnum('status').notNull().default('draft'),

    // Metadata
    metaTitle: varchar('meta_title', { length: 255 }),
    metaDescription: text('meta_description'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    publishedAt: timestamp('published_at'),
  },
  (table) => ({
    tenantIdx: index('seo_content_opt_tenant_idx').on(table.tenantId),
    statusIdx: index('seo_content_opt_status_idx').on(table.status),
    keywordIdx: index('seo_content_opt_keyword_idx').on(table.targetKeyword),
  }),
);

// ============= SEMANTIC ANALYSIS =============

export const seoSemanticAnalysis = pgTable(
  'seo_semantic_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Target
    keyword: varchar('keyword', { length: 255 }).notNull(),

    // Related Keywords
    relatedKeywords: jsonb('related_keywords').$type<
      Array<{
        keyword: string;
        relevance: number;
        searchVolume: number;
      }>
    >(),

    // Semantic Clusters
    semanticClusters: jsonb('semantic_clusters').$type<
      Array<{
        cluster: string;
        keywords: string[];
      }>
    >(),

    // Search Intent
    searchIntent: varchar('search_intent', { length: 50 }), // 'informational', 'navigational', 'transactional', 'commercial'
    intentConfidence: decimal('intent_confidence', { precision: 5, scale: 2 }), // 0-100

    // Competitor Analysis
    topRankingContent: jsonb('top_ranking_content').$type<
      Array<{
        url: string;
        title: string;
        commonKeywords: string[];
      }>
    >(),

    // Content Recommendations
    recommendedTopics: jsonb('recommended_topics').$type<string[]>(),
    recommendedQuestions: jsonb('recommended_questions').$type<string[]>(),

    // Timestamp
    analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('seo_semantic_tenant_idx').on(table.tenantId),
    keywordIdx: index('seo_semantic_keyword_idx').on(table.keyword),
  }),
);

// ============= INSERT SCHEMAS =============

export const insertSeoSettingsSchema = createInsertSchema(seoSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoAuditHistorySchema = createInsertSchema(seoAuditHistory).omit({
  id: true,
  createdAt: true,
});

export const insertSeoFixesAppliedSchema = createInsertSchema(seoFixesApplied).omit({
  id: true,
  createdAt: true,
});

export const insertSeoKeywordsSchema = createInsertSchema(seoKeywords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoKeywordHistorySchema = createInsertSchema(seoKeywordHistory).omit({
  id: true,
  recordedAt: true,
});

export const insertSeoCompetitorAnalysisSchema = createInsertSchema(seoCompetitorAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoPageScoresSchema = createInsertSchema(seoPageScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoMonitoringLogSchema = createInsertSchema(seoMonitoringLog).omit({
  id: true,
  checkedAt: true,
});

export const insertGscOauthCredentialsSchema = createInsertSchema(gscOauthCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGscPropertiesSchema = createInsertSchema(gscProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGscKeywordPerformanceSchema = createInsertSchema(gscKeywordPerformance).omit({
  id: true,
  createdAt: true,
});

export const insertGscPagePerformanceSchema = createInsertSchema(gscPagePerformance).omit({
  id: true,
  createdAt: true,
});

export const insertSeoNotificationPreferencesSchema = createInsertSchema(
  seoNotificationPreferences,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoAlertRulesSchema = createInsertSchema(seoAlertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoAlertsSchema = createInsertSchema(seoAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertSeoMonitoringSchedulesSchema = createInsertSchema(seoMonitoringSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoCoreWebVitalsSchema = createInsertSchema(seoCoreWebVitals).omit({
  id: true,
  createdAt: true,
});

export const insertSeoCrawlResultsSchema = createInsertSchema(seoCrawlResults).omit({
  id: true,
});

export const insertSeoImageAnalysisSchema = createInsertSchema(seoImageAnalysis).omit({
  id: true,
});

export const insertSeoRedirectAnalysisSchema = createInsertSchema(seoRedirectAnalysis).omit({
  id: true,
});

export const insertSeoDuplicateContentSchema = createInsertSchema(seoDuplicateContent).omit({
  id: true,
});

export const insertSeoSecurityAnalysisSchema = createInsertSchema(seoSecurityAnalysis).omit({
  id: true,
});

export const insertSeoLinkAnalysisSchema = createInsertSchema(seoLinkAnalysis).omit({
  id: true,
});

export const insertSeoStructuredDataSchema = createInsertSchema(seoStructuredData).omit({
  id: true,
});

export const insertSeoMobileAnalysisSchema = createInsertSchema(seoMobileAnalysis).omit({
  id: true,
});

export const insertSeoPerformanceBudgetSchema = createInsertSchema(seoPerformanceBudget).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoContentOptimizationSchema = createInsertSchema(seoContentOptimization).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeoSemanticAnalysisSchema = createInsertSchema(seoSemanticAnalysis).omit({
  id: true,
});

// ============= TYPE EXPORTS =============

export type SeoSettings = typeof seoSettings.$inferSelect;
export type InsertSeoSettings = typeof seoSettings.$inferInsert;

export type SeoAuditHistory = typeof seoAuditHistory.$inferSelect;
export type InsertSeoAuditHistory = typeof seoAuditHistory.$inferInsert;

export type SeoFixesApplied = typeof seoFixesApplied.$inferSelect;
export type InsertSeoFixesApplied = typeof seoFixesApplied.$inferInsert;

export type SeoKeywords = typeof seoKeywords.$inferSelect;
export type InsertSeoKeywords = typeof seoKeywords.$inferInsert;

export type SeoKeywordHistory = typeof seoKeywordHistory.$inferSelect;
export type InsertSeoKeywordHistory = typeof seoKeywordHistory.$inferInsert;

export type SeoCompetitorAnalysis = typeof seoCompetitorAnalysis.$inferSelect;
export type InsertSeoCompetitorAnalysis = typeof seoCompetitorAnalysis.$inferInsert;

export type SeoPageScores = typeof seoPageScores.$inferSelect;
export type InsertSeoPageScores = typeof seoPageScores.$inferInsert;

export type SeoMonitoringLog = typeof seoMonitoringLog.$inferSelect;
export type InsertSeoMonitoringLog = typeof seoMonitoringLog.$inferInsert;

export type GscOauthCredentials = typeof gscOauthCredentials.$inferSelect;
export type InsertGscOauthCredentials = typeof gscOauthCredentials.$inferInsert;

export type GscProperties = typeof gscProperties.$inferSelect;
export type InsertGscProperties = typeof gscProperties.$inferInsert;

export type GscKeywordPerformance = typeof gscKeywordPerformance.$inferSelect;
export type InsertGscKeywordPerformance = typeof gscKeywordPerformance.$inferInsert;

export type GscPagePerformance = typeof gscPagePerformance.$inferSelect;
export type InsertGscPagePerformance = typeof gscPagePerformance.$inferInsert;

export type SeoNotificationPreferences = typeof seoNotificationPreferences.$inferSelect;
export type InsertSeoNotificationPreferences = typeof seoNotificationPreferences.$inferInsert;

export type SeoAlertRules = typeof seoAlertRules.$inferSelect;
export type InsertSeoAlertRules = typeof seoAlertRules.$inferInsert;

export type SeoAlerts = typeof seoAlerts.$inferSelect;
export type InsertSeoAlerts = typeof seoAlerts.$inferInsert;

export type SeoMonitoringSchedules = typeof seoMonitoringSchedules.$inferSelect;
export type InsertSeoMonitoringSchedules = typeof seoMonitoringSchedules.$inferInsert;

export type SeoCoreWebVitals = typeof seoCoreWebVitals.$inferSelect;
export type InsertSeoCoreWebVitals = typeof seoCoreWebVitals.$inferInsert;

export type SeoCrawlResults = typeof seoCrawlResults.$inferSelect;
export type InsertSeoCrawlResults = typeof seoCrawlResults.$inferInsert;

export type SeoImageAnalysis = typeof seoImageAnalysis.$inferSelect;
export type InsertSeoImageAnalysis = typeof seoImageAnalysis.$inferInsert;

export type SeoRedirectAnalysis = typeof seoRedirectAnalysis.$inferSelect;
export type InsertSeoRedirectAnalysis = typeof seoRedirectAnalysis.$inferInsert;

export type SeoDuplicateContent = typeof seoDuplicateContent.$inferSelect;
export type InsertSeoDuplicateContent = typeof seoDuplicateContent.$inferInsert;

export type SeoSecurityAnalysis = typeof seoSecurityAnalysis.$inferSelect;
export type InsertSeoSecurityAnalysis = typeof seoSecurityAnalysis.$inferInsert;

export type SeoLinkAnalysis = typeof seoLinkAnalysis.$inferSelect;
export type InsertSeoLinkAnalysis = typeof seoLinkAnalysis.$inferInsert;

export type SeoStructuredData = typeof seoStructuredData.$inferSelect;
export type InsertSeoStructuredData = typeof seoStructuredData.$inferInsert;

export type SeoMobileAnalysis = typeof seoMobileAnalysis.$inferSelect;
export type InsertSeoMobileAnalysis = typeof seoMobileAnalysis.$inferInsert;

export type SeoPerformanceBudget = typeof seoPerformanceBudget.$inferSelect;
export type InsertSeoPerformanceBudget = typeof seoPerformanceBudget.$inferInsert;

export type SeoContentOptimization = typeof seoContentOptimization.$inferSelect;
export type InsertSeoContentOptimization = typeof seoContentOptimization.$inferInsert;

export type SeoSemanticAnalysis = typeof seoSemanticAnalysis.$inferSelect;
export type InsertSeoSemanticAnalysis = typeof seoSemanticAnalysis.$inferInsert;
