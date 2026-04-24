-- ============================================================================
-- billing.sql — monthly invoice generation + daily meter aggregation.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Monthly 1st @ 03:00 UTC: invoice generation ──────────────────────────
-- The edge function iterates all tenants' contracts, rolls up meter
-- readings, and generates invoices. Large job — 15 min timeout.
SELECT cron.unschedule('billing-invoice-monthly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'billing-invoice-monthly'
);
SELECT cron.schedule(
  'billing-invoice-monthly',
  '0 3 1 * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/billing/invoices/run-monthly',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'billing-invoice-monthly'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 900000
    );
  $$
);

-- ─── Daily @ 04:00 UTC: meter reading aggregation ─────────────────────────
SELECT cron.unschedule('billing-meter-aggregate-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'billing-meter-aggregate-daily'
);
SELECT cron.schedule(
  'billing-meter-aggregate-daily',
  '0 4 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/billing/meters/aggregate-daily',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'billing-meter-aggregate-daily'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 600000
    );
  $$
);
