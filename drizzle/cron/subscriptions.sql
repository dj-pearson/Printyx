-- ============================================================================
-- subscriptions.sql — trial expiry + renewal charge jobs.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Hourly: check trial expirations ──────────────────────────────────────
-- Edge function transitions tenants whose `trial_ends_at` has passed to
-- either 'paid' (if payment succeeded) or 'expired' (if not), and emails
-- the appropriate notice.
SELECT cron.unschedule('subscription-trial-expiry-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'subscription-trial-expiry-check'
);
SELECT cron.schedule(
  'subscription-trial-expiry-check',
  '30 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/billing/subscriptions/check-trials',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'subscription-trial-expiry-check'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $$
);

-- ─── Daily @ 03:00 UTC: process renewal charges ───────────────────────────
SELECT cron.unschedule('subscription-renewal-charges') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'subscription-renewal-charges'
);
SELECT cron.schedule(
  'subscription-renewal-charges',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/billing/subscriptions/process-renewals',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'subscription-renewal-charges'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 900000
    );
  $$
);
