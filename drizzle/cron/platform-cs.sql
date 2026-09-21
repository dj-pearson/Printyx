-- ============================================================================
-- platform-cs.sql — the nightly tenant health sweep.
--
-- `platform_health_scores` had NO WRITER anywhere in the repo. The scorer
-- existed and worked (POST /platform-cs/health-scores/calculate), and no client
-- tree called it and no schedule fired it - so the table had never held a row,
-- /platform-customer-success showed an empty table, and every headline card on
-- it derived zeroes from an empty array. COP-B04's question applied to a
-- platform surface: ask what FIRES a recalculation, and if the answer is
-- nothing, the feature does not exist yet.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Nightly @ 03:50 UTC: rescore every tenant account ───────────────────
-- Accounts run SEQUENTIALLY inside the function: each is a read, an upsert and
-- a churn-risk propagation, and nothing is waiting on this before morning.
-- An account that throws is recorded and stepped over, and the response names
-- every failure, so a partial sweep is not read as a healthy platform.
--
-- Idempotent: the write is an upsert on platform_health_scores.business_record_id
-- (UNIQUE since migration 0000), so a second run of the same night overwrites
-- rather than duplicating, and a missed night costs nothing - the next run
-- reads the same account state.
--
-- An account with too little measured is SKIPPED and counted, never stored with
-- an invented score: overall_score and health_status are both NOT NULL, and
-- filling them to satisfy the constraint is the fabrication this sweep exists
-- to stop publishing. See shared/platform-health-score.ts.
--
-- 03:50 rather than on the hour: 03:00 and 04:00 already carry billing,
-- renewals and the opportunity radar, and 03:40 is booking-attempts-prune.
SELECT cron.unschedule('platform-cs-health-scores') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'platform-cs-health-scores'
);
SELECT cron.schedule(
  'platform-cs-health-scores',
  '50 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/platform-cs/health-scores/calculate-all',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'platform-cs-health-scores'
      ),
      body := '{}'::jsonb,
      -- Every tenant account on the platform in one call.
      timeout_milliseconds := 600000
    );
  $$
);
