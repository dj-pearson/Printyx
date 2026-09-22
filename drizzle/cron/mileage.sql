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
-- ROUND 145: this posted to /field-service/mileage/auto-generate and the
-- dispatcher switches on SEGMENT 0, where the cases are records/summary/reports/
-- rates/irs-log/vehicles/auto-generate - so `mileage` fell to `default: null`
-- and every nightly tick was a 404. The handler it now reaches declares itself
-- a stub (`stub: true, generated: 0`, "needs location_history aggregation by
-- day + tenant"), so this fixes the ROUTING and not the feature: the job will
-- report 0 generated until that aggregation lands. Pointing it at the real
-- endpoint means only one thing has to change then, instead of two.
SELECT cron.schedule(
  'mileage-auto-generate-nightly',
  '0 5 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/field-service/auto-generate',
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
