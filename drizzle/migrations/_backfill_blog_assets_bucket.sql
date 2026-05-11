-- US-BLOG-010: create the Supabase Storage bucket that holds blog asset files.
--
-- Idempotent + hand-runnable: `psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_assets_bucket.sql`.
-- Underscore prefix keeps drizzle-kit from picking it up.
--
-- Bucket policy summary:
--   - id        = 'blog-assets'
--   - public    = true  (image assets are referenced via public URLs in
--                       published posts; auth gating happens at the
--                       blog-assets edge function, not at the object layer)
--   - file size = 25 MB cap (matches the validation in the edge function)
--   - mime list = images, csv, plain text, json, pdf
--
-- Storage RLS is left at the default Supabase install. Object writes go
-- through signed URLs issued by the edge function, which already enforces
-- tenant isolation by encoding the tenant_id into the storage_path
-- (`<tenant_id>/<uuid>-<filename>`).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-assets',
  'blog-assets',
  true,
  26214400, -- 25 MiB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/avif',
    'text/csv',
    'text/plain',
    'application/json',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
