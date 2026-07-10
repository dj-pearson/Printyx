-- Add free-form jsonb `metadata` columns to tenants and users.
--
-- These columns were already read/written by application code (auth-routes
-- signup stores industry/companySize/website/etc.; stripe-service persists
-- and reads back `stripeCustomerId` from tenant metadata) but did not exist in
-- the schema, so those writes failed and the Stripe customer lookup always
-- missed — creating a duplicate Stripe customer on every call.
--
-- Idempotent + drift-tolerant: ADD COLUMN IF NOT EXISTS, guarded by a table
-- existence check (matches the 0014-0019 migration style).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) THEN
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb;
  END IF;
END $$;
