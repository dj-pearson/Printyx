-- AUDIT-037: split the two declarations that owned the name `blog_posts`.
--
-- ONE NAME, TWO DECLARATIONS, AND ONLY ONE OF THEM EVER HAD A TABLE.
-- shared/schema.ts re-exported content-marketing-schema's `blogPosts` by name
-- and then did `export * from './blog-schema'`; a named export beats a later
-- `export *`, so drizzle-kit only ever saw the content-marketing shape and
-- migration 0000 built it. The US-BLOG subsystem - 22 edge functions - is
-- written against the OTHER declaration, so every read returned nothing and no
-- insert could work: the physical table has "content" NOT NULL and
-- "category" NOT NULL and the blog code sets neither. 95 of the entries in
-- docs/phantom-columns-baseline.json were this one table.
--
-- WHICH SIDE MOVES. The content-marketing side, because it is the side with one
-- consumer: a single image-sitemap query in server/routes-seo.ts. Against it
-- stand 22 edge functions and the blog_* tables whose foreign keys point here.
--
-- WHY THIS IS NOT A DATA MIGRATION. The US-BLOG table has never physically
-- existed on any database. _backfill_blog_tables.sql creates it with CREATE
-- TABLE IF NOT EXISTS, which is a silent no-op wherever 0000 ran, and 0008 only
-- ever added foreign keys TO it - it never created it, because drizzle-kit was
-- diffing against a snapshot that already had a blog_posts. So there are no
-- rows on that side to lose, and the rows on the content-marketing side follow
-- the RENAME.
--
-- The five foreign keys 0008 aimed at the content-marketing table follow the
-- rename too, so they are dropped and re-added against the new one.
--
-- Idempotent and guarded throughout, in the 0057/0062/0065 idiom: the guard is
-- "does blog_posts still carry a content column", which is true only before
-- this migration has run.

DO $$
DECLARE
  child text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blog_posts' AND column_name = 'content'
  ) THEN
    -- The blog_* children point at the content-marketing table right now. Detach
    -- them BEFORE the rename, or they follow it and reference the wrong parent.
    -- Each child is checked for existence first: on a database that never ran
    -- the unjournaled blog backfill these tables are absent, and DROP CONSTRAINT
    -- IF EXISTS still raises undefined_table when the TABLE is the missing part.
    FOREACH child IN ARRAY ARRAY[
      'blog_citations',
      'blog_distributions',
      'blog_performance_metrics',
      'blog_post_revisions',
      'blog_refresh_queue'
    ] LOOP
      IF to_regclass('public.' || quote_ident(child)) IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
          child,
          child || '_post_id_blog_posts_id_fk'
        );
      END IF;
    END LOOP;

    ALTER TABLE "blog_posts" RENAME TO "content_marketing_posts";

    ALTER TABLE "content_marketing_posts"
      RENAME CONSTRAINT "blog_posts_slug_unique" TO "content_marketing_posts_slug_unique";

    ALTER INDEX IF EXISTS "blog_posts_slug_idx" RENAME TO "content_marketing_posts_slug_idx";
    ALTER INDEX IF EXISTS "blog_posts_status_idx" RENAME TO "content_marketing_posts_status_idx";
    ALTER INDEX IF EXISTS "blog_posts_category_idx" RENAME TO "content_marketing_posts_category_idx";
    ALTER INDEX IF EXISTS "blog_posts_published_at_idx" RENAME TO "content_marketing_posts_published_at_idx";
    ALTER INDEX IF EXISTS "blog_posts_tenant_idx" RENAME TO "content_marketing_posts_tenant_idx";
  END IF;
END
$$;
--> statement-breakpoint

-- A database that never ran 0000 (or that already ran the unjournaled blog
-- backfill) reaches here with no content_marketing_posts at all.
CREATE TABLE IF NOT EXISTS "content_marketing_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"meta_title" varchar(60),
	"meta_description" varchar(160),
	"focus_keyword" varchar(255),
	"secondary_keywords" jsonb,
	"keyword_tier" keyword_tier,
	"structured_data" jsonb,
	"featured_image" varchar(500),
	"featured_image_alt" varchar(255),
	"category" content_category NOT NULL,
	"tags" jsonb,
	"status" content_status DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"scheduled_for" timestamp,
	"author_id" uuid,
	"author_name" varchar(255),
	"view_count" integer DEFAULT 0,
	"read_time" integer,
	"word_count" integer,
	"has_citations" boolean DEFAULT false,
	"has_statistics" boolean DEFAULT false,
	"has_quotations" boolean DEFAULT false,
	"has_faq_section" boolean DEFAULT false,
	"has_steps_section" boolean DEFAULT false,
	"has_comparison_table" boolean DEFAULT false,
	"seo_score" integer,
	"readability_score" integer,
	"geo_score" integer,
	"related_posts" jsonb,
	"pillar_page_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_marketing_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"brief_id" uuid,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"excerpt" text,
	"body_markdown" text,
	"body_html" text,
	"meta_title" varchar(200),
	"meta_description" text,
	"canonical_url" text,
	"featured_image_asset_id" uuid,
	"author_user_id" varchar,
	"reviewer_user_id" varchar,
	"cluster_id" uuid,
	"schema_type" varchar(20),
	"author_id" uuid,
	"reviewed_by_author_id" uuid,
	"original_research_signal" varchar(20),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"scheduled_for" timestamp,
	"cms_target_key" varchar(64),
	"cms_post_id" varchar(200),
	"cms_post_url" text,
	"brand_voice_id" uuid,
	"style_guide_id" uuid,
	"seo_score" numeric(5, 2),
	"last_seo_check_at" timestamp,
	"ai_assistance_meta" jsonb,
	"decay_score" numeric(5, 2),
	"last_decay_check_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "content_marketing_posts_slug_idx" ON "content_marketing_posts" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "content_marketing_posts_status_idx" ON "content_marketing_posts" USING btree ("status");
CREATE INDEX IF NOT EXISTS "content_marketing_posts_category_idx" ON "content_marketing_posts" USING btree ("category");
CREATE INDEX IF NOT EXISTS "content_marketing_posts_published_at_idx" ON "content_marketing_posts" USING btree ("published_at");
CREATE INDEX IF NOT EXISTS "content_marketing_posts_tenant_idx" ON "content_marketing_posts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_idx" ON "blog_posts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_status_published_idx" ON "blog_posts" USING btree ("tenant_id","status","published_at");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_slug_idx" ON "blog_posts" USING btree ("tenant_id","slug");
CREATE INDEX IF NOT EXISTS "blog_posts_brief_idx" ON "blog_posts" USING btree ("brief_id");

-- blog_posts own foreign keys.
DO $$ BEGIN
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_brief_id_blog_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."blog_briefs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_image_asset_id_blog_assets_id_fk" FOREIGN KEY ("featured_image_asset_id") REFERENCES "public"."blog_assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_brand_voice_id_blog_brand_voices_id_fk" FOREIGN KEY ("brand_voice_id") REFERENCES "public"."blog_brand_voices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_style_guide_id_blog_style_guides_id_fk" FOREIGN KEY ("style_guide_id") REFERENCES "public"."blog_style_guides"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Re-point the five children 0008 aimed at the old table.
DO $$ BEGIN
  ALTER TABLE "blog_citations" ADD CONSTRAINT "blog_citations_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "blog_distributions" ADD CONSTRAINT "blog_distributions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "blog_performance_metrics" ADD CONSTRAINT "blog_performance_metrics_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "blog_post_revisions" ADD CONSTRAINT "blog_post_revisions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "blog_refresh_queue" ADD CONSTRAINT "blog_refresh_queue_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
