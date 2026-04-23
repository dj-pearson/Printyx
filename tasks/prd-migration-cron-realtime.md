# PRD: Migrate Scheduled Jobs (→ pg_cron) + WebSockets (→ Supabase Realtime)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 6 · **Week:** 15 (July 29 – Aug 4) · **Stories:** US-026 + US-027

**Why bundled:** both are Node-Express infrastructure primitives that must be replaced before the Express server can be sunset (US-028). Cron and WebSocket are ~100% technical cleanup — no user-facing features, just plumbing swaps.

**Critical finding from code audit:** `node-cron` is **already disabled in this codebase**:
- `server/services/cron-service.ts:5` — "Cron functionality is temporarily disabled until node-cron package is installed"
- `server/database-updater/core/CronScheduler.ts:6` — "node-cron temporarily disabled due to import issues"
- `server/services/customer-notification-service.ts:356` — "In production, this would integrate with a job scheduler..."

**Implication:** there is no active cron work to migrate in the sense of "running jobs today." The work is to **inventory every TODO / disabled scheduler / commented-out cron block** and materialize them as `pg_cron` jobs — a greenfield implementation that happens to touch existing code.

---

## 1. Scope

### Part A — US-026: Scheduled jobs (`node-cron` → `pg_cron`)

**Sources of "jobs that should be scheduled":**
- `server/services/cron-service.ts` — contains the disabled cron interface
- `server/database-updater/core/CronScheduler.ts` — test-data generator scheduling
- `server/services/customer-notification-service.ts` — notification dispatch (currently manual)
- `server/services/subscription-jobs.ts` — subscription state transitions
- Per-domain services where cron would be natural (billing runs, contract renewals, health score recalc, mileage auto-generate, email campaign sends, report scheduling, retention cleanup)

**Target:** every recurring job becomes:
1. A `pg_cron` SQL schedule in `drizzle/cron/*.sql`
2. The job body is either (a) pure SQL, or (b) a `pg_net.http_post` call to a dedicated edge-function endpoint

**Canonical layout:**
```
drizzle/cron/
├── README.md                          # inventory table + how to add a job
├── _bootstrap.sql                     # enables pg_cron + pg_net extensions
├── billing.sql                        # monthly billing run, daily meter aggregation
├── contract-renewals.sql              # daily renewal notifications
├── customer-success.sql               # nightly health-score recalc, at-risk alerts
├── email-marketing.sql                # scheduled campaign sends
├── reports.sql                        # scheduled report delivery
├── retention.sql                      # data retention (audit logs, reading history, recordings)
├── database-updater.sql               # test-data generators (if retained)
└── subscriptions.sql                  # trial expiry, renewal charges
```

### Part B — US-027: WebSockets (`/ws/*` → Supabase Realtime)

**Current WebSocket surface (server-side files):**
- `server/websocket-service.ts` — the WS server
- `server/index.ts` — WS attachment
- `server/routes.ts` — WS route registration
- `server/routes-notifications.ts` — notification channel
- `server/services/subscription-jobs.ts` — subscription events
- `server/routes/health-routes.ts` — WS health check
- `server/config/default.ts`, `server/config/test.ts` — WS config

**Frontend consumers (5 files):**
- `client/src/hooks/useWebSocket.ts` — the hook (replace)
- `client/src/hooks/useRealTimeData.ts` — real-time data wrapper
- `client/src/components/layout/enhanced-notification-bell.tsx` — notifications
- `client/src/pages/marketing/*` — marketing pages using WS for demos (de-prioritize)

**Target:** `useWebSocket` → Supabase Realtime subscription hook. Two flavors:

1. **`postgres_changes`** — when a DB row changes and the UI should reflect it (technician locations already covered in Phase 4; notifications here; subscription state changes)
2. **`broadcast`** — when the app wants to push an event without a DB write (e.g., "admin forced all users to refresh permissions")

### Explicitly out of scope
- Replacing the real-time technician location WebSocket (already migrated in Phase 4 US-016)
- Long-polling / SSE as alternatives — Supabase Realtime is the target
- New real-time features during this migration

---

## 2. Part A: pg_cron — required extensions + pattern

### Prerequisites
```sql
-- drizzle/cron/_bootstrap.sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
GRANT USAGE ON SCHEMA cron TO postgres;
```

**Verify first:** `SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');` — both should be available in Supabase. If not, file blocker.

### Pattern — pure SQL job
```sql
-- drizzle/cron/retention.sql
-- Daily at 02:00 UTC: trim audit logs older than 2 years
SELECT cron.schedule(
  'audit-log-retention',
  '0 2 * * *',
  $$ DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '2 years' $$
);
```

### Pattern — edge function call
```sql
-- drizzle/cron/customer-success.sql
-- Nightly at 01:00 UTC: recalculate at-risk health scores
SELECT cron.schedule(
  'health-score-recalc-nightly',
  '0 1 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/customer-success/health-scores/recalc',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.internal_cron_token')),
      body := '{}'::jsonb
    );
  $$
);
```

**Internal auth token:** edge functions need to recognize cron calls. Use a dedicated env var `INTERNAL_CRON_TOKEN` — edge function checks this before auth-verification.

### Inventory of needed jobs (per-domain guess — refine at audit)

| Domain | Frequency | Job | Currently |
|---|---|---|---|
| Billing | Monthly 1st @ 03:00 | Invoice generation run | TODO |
| Billing | Daily @ 04:00 | Meter aggregation | TODO |
| Contract renewals | Daily @ 06:00 | Renewal notifications | TODO |
| Customer success | Nightly @ 01:00 | Health score recalc | TODO |
| Customer success | Hourly | At-risk alerts | TODO |
| Email marketing | Every 5 min | Scheduled campaign sends | TODO |
| Reports | Per-schedule | Scheduled report delivery | TODO |
| Retention | Daily @ 02:00 | Audit logs, reading history, recordings trim | TODO |
| Subscriptions | Hourly | Trial expiry, renewal charges | TODO |
| Test data | Configurable | Database-updater generators | Disabled |
| Mileage | Daily @ 05:00 | Auto-generate mileage from GPS | TODO |
| Leases | Daily @ 07:00 | Payment due notifications | TODO |

**~12+ jobs.** Full list confirmed in parity audit.

---

## 3. Part B: Supabase Realtime — pattern

### Enable Realtime on tables

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_events;
-- technician_locations already added in Phase 4
```

### Frontend hook pattern
```typescript
// client/src/hooks/useRealtimeTable.ts — REPLACES useWebSocket
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeRows<T>(
  table: string,
  filter?: string,
) {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        (payload) => {
          if (payload.eventType === 'INSERT') setRows(r => [payload.new as T, ...r]);
          if (payload.eventType === 'UPDATE') setRows(r => r.map(x => (x as any).id === (payload.new as any).id ? payload.new as T : x));
          if (payload.eventType === 'DELETE') setRows(r => r.filter(x => (x as any).id !== (payload.old as any).id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, filter]);
  return rows;
}
```

### Broadcast pattern (application events)
```typescript
// Sender (from an edge function, for example)
await supabase.channel('admin-events').send({
  type: 'broadcast',
  event: 'force-permission-refresh',
  payload: { tenantId },
});

// Receiver (frontend)
supabase.channel('admin-events')
  .on('broadcast', { event: 'force-permission-refresh' }, ({ payload }) => {
    if (payload.tenantId === currentTenantId) queryClient.invalidateQueries();
  })
  .subscribe();
```

### Authentication
- Realtime respects RLS — cross-tenant payloads are filtered automatically
- JWT is attached via `supabase.realtime.setAuth(jwt)` on login; refresh on JWT rotation

---

## 4. Tables + migration plan

### Part A: cron tables
- `cron.job` (built-in via pg_cron) — holds schedule definitions
- `cron.job_run_details` (built-in) — run history

**Monitoring:** query `cron.job_run_details` for failure rate; surface via an admin dashboard endpoint in Phase 6.

### Part B: Realtime
- Tables added to `supabase_realtime` publication — no new tables
- `notifications` table (from `routes-notifications.ts` inventory) — RLS must be tight since Realtime filters at payload time

---

## 5. Acceptance criteria

### Part A — pg_cron (US-026)
- [ ] `pg_cron` + `pg_net` extensions enabled in Supabase
- [ ] `drizzle/cron/README.md` inventorying all jobs published
- [ ] Each `drizzle/cron/*.sql` file applies cleanly (idempotent: `SELECT cron.unschedule('job_name');` before `cron.schedule(...)`)
- [ ] All ~12 inventoried jobs scheduled and visible in `cron.job`
- [ ] Every job's first 3 runs succeed (`cron.job_run_details.status = 'succeeded'`)
- [ ] Internal auth token gates edge function cron endpoints
- [ ] Edge function endpoints for cron targets return 200 + emit request log with `cron=true` tag
- [ ] `node-cron` removed from `package.json`
- [ ] `server/services/cron-service.ts` deleted (greenfield move to pg_cron)
- [ ] `server/database-updater/core/CronScheduler.ts` replaced with pg_cron SQL or deleted if obsolete

### Part B — Supabase Realtime (US-027)
- [ ] Tables listed in §3 added to `supabase_realtime` publication
- [ ] `useWebSocket.ts` replaced with `useRealtimeTable.ts` + `useRealtimeBroadcast.ts`
- [ ] `useRealTimeData.ts` rewritten to use Realtime
- [ ] Notification bell subscribes via Realtime; new notifications arrive in < 2s
- [ ] Real-time reporting widget uses `postgres_changes` (if applicable per current UX)
- [ ] `server/websocket-service.ts` deleted
- [ ] `/ws/*` routes removed from `server/routes.ts` + `server/index.ts`
- [ ] WS configs removed from `server/config/default.ts` + `test.ts`
- [ ] `ws` npm package removed from `package.json` (if exclusively for this)

### Shared
- [ ] Type checks + build pass
- [ ] No references to `node-cron`, `ws`, `/ws/`, or `websocket-service` in server/ or client/
- [ ] Playwright MCP pass on notification + any real-time dashboard

---

## 6. Test plan

### Part A — cron
- Schedule one test job with `* * * * *` (every minute), verify it fires 3 times
- Simulate failed edge function call; verify `cron.job_run_details.status = 'failed'`
- Unschedule + reschedule idempotency test

### Part B — Realtime
- Open notification bell, insert a notification row from another session, verify it appears < 2s
- Two browser tabs different tenants: confirm only matching tenant sees payload
- Broadcast event round-trip test
- Disconnect + reconnect (close laptop lid, reopen): verify channel re-subscribes

### Production smoke
- After deploy, wait 24 hours and inspect `cron.job_run_details` — every job should have 1+ successful run (or be on a less-frequent schedule)
- Trigger a test notification in prod, verify delivery to test account

---

## 7. Rollback

### Part A
If a cron job misbehaves (e.g., infinite loop, DoS on edge function):
```sql
SELECT cron.unschedule('job_name');
```
Individual job kill; no full rollback needed.

### Part B
If Realtime flakes:
- Revert frontend hook PR → frontend falls back to polling (or nothing, if we fully swap)
- Cannot easily re-enable Express WebSocket mid-Phase-6; design assumes Realtime works

**Risk:** Phase 6 is the sunset phase — Express WS is about to be deleted. This means the Realtime swap must be proven stable before Express delete in US-028. Sequence matters: US-027 complete + 48h stable → US-028 deletion.

---

## 8. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `pg_cron` not available in Supabase | Low | High | Verify at start of phase; if unavailable, use external scheduler (Cloudflare Cron Triggers) as backup |
| Cron job stuck / locks held | Medium | High | `pg_cron` default concurrent execution; for mutex-required jobs use `pg_advisory_lock` |
| Internal cron token leaked | Low | Medium | Rotate monthly; never log; service-role access only |
| Realtime latency > WebSocket baseline | Medium | Medium | Measure; if > 3s p95, investigate (usually indexed publication) |
| Realtime delivers cross-tenant payloads under complex RLS | Low | **Critical** | Explicit two-tenant test per subscribed table; require passing test as merge gate |
| Frontend hook rewrite breaks notification bell UX | Medium | Low | Staged rollout: keep both hooks live for 48h, feature flag |
| Marketing pages using WS (low priority) — break during migration | Low | Low | Document; fix or delete; not a blocker for sunset |
| Cron failures silently ignored | Medium | Medium | Dashboard on `cron.job_run_details`; alert if consecutive failures > 3 |

---

## 9. Open questions

1. **Is `pg_cron` enabled in the self-hosted Supabase?** `SELECT * FROM pg_extension` — confirm before committing to this design.
2. **What frequency does each scheduled job need?** Per-domain product decision; may not all be on a cron — some may be user-triggered "run now" endpoints.
3. **Admin dashboard for cron monitoring** — build in this PRD or defer? Lean: simple endpoint + optional UI in follow-up.
4. **Realtime and mobile** — how do iOS / Android clients subscribe to Realtime? Confirm `@supabase/supabase-js` works in mobile build.
5. **WebSocket marketing-page usage** — is it decorative (delete) or functional (migrate)?
6. **`subscription-jobs.ts`** — what subscription events does it currently emit via WebSocket? Each needs Realtime replacement OR server-side webhook.
7. **Internal cron token rotation** — how? Envvar redeploy, or DB-stored?
8. **Cron calls hitting cold edge functions** — every minute invocation may cause cold start; consider jitter or less-frequent schedules for cost.

---

## 10. Definition of done

### US-026
- [ ] `drizzle/cron/` directory complete with all scheduled jobs
- [ ] All jobs verified running successfully for 24h+ in prod
- [ ] `node-cron` removed from package.json
- [ ] `server/services/cron-service.ts` + related files deleted
- [ ] Documentation in `drizzle/cron/README.md`

### US-027
- [ ] All frontend WS usage swapped to Supabase Realtime
- [ ] `server/websocket-service.ts` deleted
- [ ] `ws` npm package removed from package.json
- [ ] Notification delivery + any real-time dashboards work in prod
- [ ] Cross-tenant isolation on Realtime verified
- [ ] 48 hours stable before Phase 6 proceeds to US-028 (sunset)
