-- LEGAL-009: consent capture before a meeting or service call is recorded.
--
-- Eleven US states require every party to consent to a recording. California's
-- CIPA (Penal Code 632) carries $5,000 statutory damages per violation, and the
-- claim belongs to the person who was recorded, not to the customer who bought
-- the software. The platform recorded and stored audio with no consent step
-- anywhere in the flow.
--
-- Consent is recorded in the existing consent_records ledger rather than a new
-- table, so withdrawal, export and erasure all keep working through the paths
-- that already exist. That needs one new value on the consent_type enum.
--
-- HAND-RUN, like _backfill_*.sql and _pin_storage_bucket_visibility.sql:
--   psql "$DATABASE_URL" -f drizzle/migrations/_recording_consent.sql
--
-- The underscore prefix keeps drizzle-kit from picking it up. It is not in the
-- journal because generating a journalled migration needs db:generate against a
-- live database, and adding a journal entry without its snapshot widens the
-- known snapshot gap (see COP-M00) rather than fixing anything.
--
-- Until this runs, the upload endpoint REFUSES to record. That is deliberate:
-- failing closed on a missing consent migration is the safe direction, because
-- the alternative is recording people without the consent row that proves they
-- agreed.

--> statement-breakpoint
ALTER TYPE "consent_type" ADD VALUE IF NOT EXISTS 'recording';

--> statement-breakpoint
-- Find the consent for a given recording quickly. proof_reference holds the
-- recording id, which is how a recording is tied to its consent without
-- altering meeting_recordings (a drift table that exists in no Drizzle schema).
CREATE INDEX IF NOT EXISTS "consent_records_proof_reference_idx"
  ON "consent_records" ("tenant_id", "proof_reference");
