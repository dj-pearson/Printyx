/**
 * Blog Module Schema Barrel — US-BLOG-001 (foundation)
 *
 * Drizzle table definitions for the Platform Admin Blog System are added
 * by US-BLOG-002 (canonical schema). This file currently exports nothing
 * but exists so US-BLOG-002 has a stable home to drop tables into and
 * downstream stories can import from `@shared/blog-schema` without
 * waiting on the schema story.
 *
 * Tables to be added by US-BLOG-002:
 *   blog_brand_voices, blog_style_guides, blog_keyword_clusters,
 *   blog_keywords, blog_briefs, blog_posts, blog_post_revisions,
 *   blog_assets, blog_citations, blog_distributions,
 *   blog_distribution_targets, blog_performance_metrics,
 *   blog_refresh_queue, blog_audit_log, blog_cms_targets,
 *   blog_agent_settings (US-BLOG-086)
 *
 * Each is tenant-scoped (tenant_id NOT NULL with index) per scope decision 1A
 * (single Printyx workspace per tenant in v1).
 *
 * RLS policies on every blog_* table enforce tenant_id matches the JWT
 * `app_metadata.tenantId` claim, matching the existing Printyx RLS pattern.
 *
 * Re-exported from `shared/schema.ts` so frontend and edge functions can
 * import via `@shared/schema` or directly from `@shared/blog-schema`.
 */

export {};
