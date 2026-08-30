-- INTEG-WEBHOOK-001: somewhere to put an inbound provider delivery.
--
-- Idempotent + hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_inbound_webhook_events.sql
-- SUPERSEDED 2026-08-29 (AUDIT-032): this table is now in the migration chain,
-- as part of drizzle/migrations/0062_round_sway.sql - drizzle-kit reported it as
-- missing the moment anything else was generated, because the snapshot never
-- knew about it. That migration creates it with IF NOT EXISTS, so a database
-- that ran this file by hand takes 0062 cleanly. Keep this file only for a
-- database that is not on the migration chain at all.
--
-- Underscore prefix keeps drizzle-kit from picking it up, matching
-- _backfill_blog_assets_bucket.sql and _recording_consent.sql. It is NOT
-- journalled: a journal entry with no snapshot widens the known snapshot gap
-- (COP-M00), and generating a real snapshot needs db:generate against a live
-- database.
--
-- WHY THIS EXISTS
--
-- WebhookService verified the provider HMAC and then handed the payload to a
-- per-provider sync method. All eleven of those methods are stubs: they return
-- "synchronized successfully" and touch no table. The receiver answered 200,
-- which tells Stripe and Intuit the event was accepted and stops the retry, so
-- every verified delivery was acknowledged and thrown away. This table is what
-- makes that acknowledgement true.
--
-- tenant_id is NULLABLE deliberately. An inbound webhook carries no tenant
-- context; attribution runs through the provider's own account id back to
-- platform_integrations, and a delivery that cannot be attributed is still
-- worth keeping. A dropped event cannot be re-requested.

CREATE TABLE IF NOT EXISTS inbound_webhook_events (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           varchar,
  provider            varchar(64) NOT NULL,
  event_type          varchar(128) NOT NULL DEFAULT '',
  external_event_id   varchar(128),
  external_account_id varchar(128),
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              varchar(16) NOT NULL DEFAULT 'received',
  processing_error    text,
  processed_at        timestamp,
  received_at         timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbound_webhook_events_provider_idx
  ON inbound_webhook_events (provider, received_at);

CREATE INDEX IF NOT EXISTS inbound_webhook_events_status_idx
  ON inbound_webhook_events (status, received_at);

CREATE INDEX IF NOT EXISTS inbound_webhook_events_tenant_idx
  ON inbound_webhook_events (tenant_id, received_at);

-- A provider retrying the same event must land on the existing row, not a
-- duplicate. Postgres treats NULLs as distinct in a unique index, so deliveries
-- that carry no id of their own (Google Calendar push notifications) are
-- unaffected by this and each one is kept.
CREATE UNIQUE INDEX IF NOT EXISTS inbound_webhook_events_dedupe_idx
  ON inbound_webhook_events (provider, external_event_id);
