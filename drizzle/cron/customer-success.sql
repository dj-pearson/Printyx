-- ============================================================================
-- customer-success.sql — health-score recalc + at-risk alerting.
--
-- Both jobs call edge-function endpoints via pg_net.http_post with an
-- internal auth token. The edge function's _shared/cron-auth.ts helper
-- validates the token before running the handler.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- Helper: internal call — always uses the cron token + JSON empty body.
-- Inlined here rather than in _bootstrap so each per-domain file is readable
-- on its own.

-- ─── Nightly health-score recalc @ 01:00 UTC ──────────────────────────────
SELECT cron.unschedule('health-score-recalc-nightly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'health-score-recalc-nightly'
);
SELECT cron.schedule(
  'health-score-recalc-nightly',
  '0 1 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/customer-success/health-scores/recalc',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'health-score-recalc-nightly'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 600000
    );
  $$
);

-- ─── Hourly at-risk alerts ────────────────────────────────────────────────
SELECT cron.unschedule('customer-at-risk-alerts-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'customer-at-risk-alerts-hourly'
);
SELECT cron.schedule(
  'customer-at-risk-alerts-hourly',
  '15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/customer-success/at-risk/check',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'customer-at-risk-alerts-hourly'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000
    );
  $$
);
