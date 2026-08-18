-- LEGAL-006: pin every storage bucket's visibility so the state is reproducible
-- rather than whatever was clicked in a dashboard.
--
-- Idempotent + hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_pin_storage_bucket_visibility.sql
-- Underscore prefix keeps drizzle-kit from picking it up, matching
-- _backfill_blog_assets_bucket.sql.
--
-- WHY THIS EXISTS
--
-- `getPublicUrl()` returns a URL string whether or not a bucket is public, so
-- reading the application code tells you nothing about whether an object is
-- reachable without credentials. Two buckets are deliberately public and three
-- must not be, and until now nothing in the repository recorded which was which.
--
-- RUN scripts/audit-storage-buckets.ts FIRST. If a bucket that should be private
-- is currently public, flipping it here changes what the outside world can fetch,
-- and the objects that were exposed while it was public should be treated as
-- disclosed. That is a decision for a human, not a side effect of a migration.

-- Private: arbitrary customer uploads.
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Private: recorded conversations.
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-recordings', 'meeting-recordings', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Private: quarterly business reviews carry a customer's fleet, usage and spend.
-- Served through short-lived signed URLs since LEGAL-006.
INSERT INTO storage.buckets (id, name, public)
VALUES ('qbr-artifacts', 'qbr-artifacts', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Private: the legacy name the Express route defaulted to. Pinned too, because
-- if the live bucket turns out to be this one it must not be public either.
-- Whichever name is real, set QBR_STORAGE_BUCKET to match and record it in
-- docs/storage-bucket-inventory.md.
INSERT INTO storage.buckets (id, name, public)
VALUES ('qbr', 'qbr', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public by design: tenant logos rendered in quotes, proposals and portals.
-- Nothing but brand imagery belongs in this bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public by design: images referenced by URL from published blog posts.
-- Full bucket definition lives in _backfill_blog_assets_bucket.sql; repeated
-- here only so this file is a complete statement of intended visibility.
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-assets', 'blog-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
