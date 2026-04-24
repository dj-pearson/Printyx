-- ============================================================================
-- knowledge-base-engagement-tables.sql — schema safety net for Phase 6 US-025
-- (article bookmarks, ratings, votes, reading history).
--
-- Source of truth: shared/knowledge-base-schema.ts (tables defined via
-- Drizzle). This file replays the four engagement tables idempotently so a
-- fresh clone gets them even if migrations were never run. All four tables
-- have UNIQUE constraints that the edge function depends on for upsert /
-- 409-on-duplicate semantics.
-- ============================================================================

BEGIN;

-- ─── article_bookmarks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS article_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  article_id uuid NOT NULL,
  notes text,
  tags jsonb NOT NULL DEFAULT '[]',
  collection_name varchar(255),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE article_bookmarks
    ADD CONSTRAINT bookmark_user_article_unique UNIQUE (user_id, article_id);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS bookmark_user_idx ON article_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS bookmark_tenant_user_idx ON article_bookmarks(tenant_id, user_id);

-- ─── reading_history ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  article_id uuid NOT NULL,
  scroll_position integer NOT NULL DEFAULT 0,
  reading_progress integer NOT NULL DEFAULT 0,
  current_section_id varchar(255),
  completed boolean NOT NULL DEFAULT false,
  total_time_seconds integer NOT NULL DEFAULT 0,
  last_read_duration integer NOT NULL DEFAULT 0,
  first_viewed_at timestamp NOT NULL DEFAULT now(),
  last_viewed_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);
DO $$ BEGIN
  ALTER TABLE reading_history
    ADD CONSTRAINT reading_history_user_article_unique UNIQUE (user_id, article_id);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS reading_history_user_idx ON reading_history(user_id);
CREATE INDEX IF NOT EXISTS reading_history_last_viewed_idx
  ON reading_history(user_id, last_viewed_at);
CREATE INDEX IF NOT EXISTS reading_history_completed_idx
  ON reading_history(user_id, completed);

-- ─── article_ratings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS article_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  article_id uuid NOT NULL,
  rating integer NOT NULL,
  rating_type varchar(50) NOT NULL DEFAULT 'overall',
  comment text,
  helpful_count integer NOT NULL DEFAULT 0,
  verified_reader boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE article_ratings
    ADD CONSTRAINT rating_user_article_type_unique
      UNIQUE (user_id, article_id, rating_type);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS rating_article_idx ON article_ratings(article_id, rating);
CREATE INDEX IF NOT EXISTS rating_tenant_article_idx
  ON article_ratings(tenant_id, article_id);
CREATE INDEX IF NOT EXISTS rating_created_idx ON article_ratings(created_at);

-- ─── article_votes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS article_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  article_id uuid NOT NULL,
  vote_type varchar(20) NOT NULL,
  comment text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE article_votes
    ADD CONSTRAINT vote_user_article_unique UNIQUE (user_id, article_id);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS vote_article_idx ON article_votes(article_id, vote_type);
CREATE INDEX IF NOT EXISTS vote_tenant_article_idx ON article_votes(tenant_id, article_id);

COMMIT;
