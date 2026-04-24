-- ============================================================================
-- mileage.sql — nightly GPS → mileage entry auto-generation.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Daily @ 05:00 UTC: generate mileage entries from GPS traces ──────────
-- Edge function consumes previous-day technician_locations rows, computes
-- distance per user per day, and inserts mileage rows.
SELECT cron.unschedule('mileage-auto-generate-nightly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'mileage-auto-generate-nightly'
);
SELECT cron.schedule(
  'mileage-auto-generate-nightly',
  '0 5 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/field-service/mileage/auto-generate',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'mileage-auto-generate-nightly'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 900000
    );
  $$
);
