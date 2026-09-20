-- ============================================================================
-- deal-desk-sla.sql - the scheduled approval SLA check.
--
-- `POST /deal-desk/check-sla` shipped with a comment saying a pg_cron entry
-- was "Phase 6 US-026". It was never built, no client tree calls the endpoint,
-- and `drizzle/cron/` had no deal-desk file - so an approval whose deadline had
-- passed was marked breached only when somebody ran a manual curl. A quote sat
-- in a manager's queue past its SLA and `sla_breached` stayed false, which is
-- the column the deal-desk analytics compliance figures are computed from.
--
-- An approval SLA that nobody checks is not an SLA; it is a column.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- --- Hourly at :35 past: sweep every tenant ---------------------------------
-- HOURLY, not nightly, and that is the difference between this job and the
-- others in this directory. An SLA deadline is a promise about response time
-- measured in hours, so a nightly sweep would report a breach up to 24 hours
-- after it happened and the escalated_at timestamp would be wrong by that much.
-- The work is cheap: one indexed query per tenant that usually returns nothing.
--
-- Idempotent by the handler's own filter (`sla_breached = false`), so a double
-- fire or an overlapping manual call claims nothing the first run already took,
-- and a missed hour is picked up by the next one rather than lost.
--
-- :35 to stay clear of the top of the hour, where anything else scheduled
-- hourly lands by default.
SELECT cron.unschedule('deal-desk-sla-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'deal-desk-sla-check'
);
SELECT cron.schedule(
  'deal-desk-sla-check',
  '35 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/deal-desk/check-sla/all',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'deal-desk-sla-check'
      ),
      body := '{}'::jsonb,
      -- Shorter than the nightly sweeps: this is one narrow indexed query per
      -- tenant, and an hourly job that can run for fifteen minutes would still
      -- be running when the next one fires.
      timeout_milliseconds := 120000
    );
  $$
);
