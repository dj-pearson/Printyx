-- PROP-003: persist the full BrandManager profile.
--
-- The flat columns (primary_color, heading_font, logo_url, address, ...) stay the
-- queryable source of truth that the proposal merge engine reads. This jsonb column
-- holds the rich extras the UI edits that have no dedicated column: extended colors
-- (background, muted), full typography (sizes, scale, spacing), page layout
-- (margins, header/footer heights), gradients/patterns, logo variants, and template
-- layout presets. Idempotent + drift-tolerant, matching prior migrations.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_branding_profiles'
  ) THEN
    ALTER TABLE "company_branding_profiles"
      ADD COLUMN IF NOT EXISTS "settings" jsonb;
  END IF;
END $$;
