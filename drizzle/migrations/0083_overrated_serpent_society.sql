-- WF-S-03: deals.source_business_record_id — the lead or account a deal came from.
--
-- LeadDeals.tsx has posted `leadId` and `companyId` since it was written and
-- `deals` had neither column, so PostgREST dropped both and nothing recorded
-- which lead a deal belonged to. The tab then asked for ?leadId=, which the
-- deals function does not read, so it received the whole tenant's deals.
--
-- Named for business_records rather than for leads on purpose: a lead and an
-- account are one row here and conversion is a status change, so a deal created
-- against a lead has to keep pointing at the same row afterwards.
--
-- Nullable and not back-filled. A deal created from the board has no lead, and
-- guessing one would invent provenance the pipeline reports would then measure.
--
-- IF NOT EXISTS on both statements so a database that has already been pushed
-- with db:push re-runs this cleanly.
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "source_business_record_id" varchar;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_tenant_source_record_idx" ON "deals" USING btree ("tenant_id","source_business_record_id");
