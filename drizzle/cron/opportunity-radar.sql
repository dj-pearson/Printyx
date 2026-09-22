-- ============================================================================
-- opportunity-radar.sql — the scheduled installed-base scan (COP-B04 AC1/AC5).
--
-- Until this existed the radar only ran when somebody pressed the button on
-- /opportunity-radar. The whole point of the feature is that it notices a lease
-- ending in 90 days BEFORE a rep thinks to look, so a scan nobody fires is a
-- report, not a radar.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Nightly @ 04:20 UTC: sweep every tenant ─────────────────────────────
-- Every tenant, sequentially, inside the function: each tenant's scan pages
-- through its whole installed base, so fifty in parallel would multiply the
-- peak load on the database by fifty to finish a nightly job a few minutes
-- sooner. A tenant that throws is recorded and stepped over; the response names
-- every failure so a partial sweep is not read as a quiet night.
--
-- Idempotent by construction (AC7): the scan upserts against
-- radar_plays_dedupe_uq with ignoreDuplicates, so a second run of the same day
-- collides instead of doubling every play. That is also why a missed night
-- costs nothing - the next run detects the same triggers.
--
-- The per-tenant kill switch (radar_settings.scan_enabled) is honoured inside
-- runScan, so a tenant that turned the radar off is skipped and counted rather
-- than silently producing nothing.
--
-- 04:20 rather than 04:00: the hour is already busy with billing and renewals,
-- and this sweep reads equipment, contracts, meter_readings and service_tickets
-- for every tenant.
SELECT cron.unschedule('opportunity-radar-scan') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'opportunity-radar-scan'
);
SELECT cron.schedule(
  'opportunity-radar-scan',
  '20 4 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/opportunity-radar/scan/all',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'opportunity-radar-scan'
      ),
      body := '{}'::jsonb,
      -- Long, because this is every tenant's installed base in one call. The
      -- sweep is resumable in the sense that matters: a timeout loses the
      -- remaining tenants for one night, and tomorrow's run detects the same
      -- triggers.
      timeout_milliseconds := 900000
    );
  $$
);
