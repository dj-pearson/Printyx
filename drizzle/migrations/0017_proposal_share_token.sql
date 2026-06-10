-- PROP-008: public share links for proposals.
--
-- A random url-safe token lets a customer view a proposal at /p/<token> without
-- auth. Expiry defaults to the proposal's valid_until (set in the edge function).
-- Idempotent + drift-tolerant, matching prior migrations.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proposals'
  ) THEN
    ALTER TABLE "proposals"
      ADD COLUMN IF NOT EXISTS "share_token" varchar,
      ADD COLUMN IF NOT EXISTS "share_expires_at" timestamp;

    -- Token lookups must be fast and unique.
    CREATE UNIQUE INDEX IF NOT EXISTS "proposals_share_token_key"
      ON "proposals" ("share_token")
      WHERE "share_token" IS NOT NULL;
  END IF;
END $$;
