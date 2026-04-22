# PRD: Reconcile Performance (Express + Edge Function overlap)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 2 · **Week:** 4

**Why:** Performance metrics endpoints exist in both backends. Smallest overlap — quickest PRD to execute.

---

## 1. Scope

**Express side:**
- `server/routes/performance-routes.ts` (~10 endpoints — sales performance, team metrics, KPI tracking)

**Edge side:**
- `supabase/functions/performance/index.ts`

**Target:** `supabase/functions/performance/` canonical.

---

## 2. Parity audit

Produce `docs/performance-parity.md`.

Focus areas:
- Per-rep sales metrics (revenue, deals closed, pipeline)
- Team rollups
- KPI dashboards
- Historical trending queries

Likely complex SQL (aggregations, time-series windows). Evaluate whether Drizzle query builder is sufficient or if some queries need raw SQL.

---

## 3. Tables touched

Mostly read-only from: `business_records`, `deals`, `opportunities`, `users`, `sales_territories`, `commissions`, any `*_metrics` or `*_analytics` tables.

RLS file: `drizzle/rls/performance.sql` — simpler since most endpoints are read-only reports.

---

## 4. Acceptance criteria

- [ ] `docs/performance-parity.md` published
- [ ] Edge function covers all Express endpoints
- [ ] Complex aggregate queries produce identical numbers to Express (regression test with same input data)
- [ ] RLS applied where needed
- [ ] Frontend pages work:
  - `/sales-performance` (SalesPerformanceAnalytics.tsx)
  - `/performance-monitoring` (PerformanceMonitoring.tsx)
  - KPI widgets on Dashboard
- [ ] `server/routes/performance-routes.ts` deleted + route registration removed
- [ ] Verify in browser with Playwright MCP

---

## 5. Considerations

### Caching
Reports may benefit from caching (dashboards hit the same query repeatedly). Options:
- No caching in edge function — relies on Postgres query planner + any materialized views.
- In-memory cache in module scope (per Deno instance, TTL N seconds).
- Supabase built-in HTTP caching via `Cache-Control` headers.

**Recommendation:** start with no cache, measure, add caching if latency is an issue. Dashboards re-fetch on navigate which isn't that frequent.

### Raw SQL escape hatch
For queries like "top 10 reps by revenue last 30 days with MoM delta", Drizzle query builder may get unwieldy. Use `getRawClient()` from `_shared/db.ts` for these:

```typescript
const client = getRawClient();
const rows = await client`
  SELECT user_id, SUM(amount) AS revenue, ...
  FROM deals
  WHERE tenant_id = ${ctx.tenantId}
    AND closed_at >= NOW() - INTERVAL '30 days'
  GROUP BY user_id
  ORDER BY revenue DESC
  LIMIT 10
`;
```

Parameterized SQL via tagged templates — injection-safe.

---

## 6. Rollback

Standard: revert PR. Reports are read-only — no data at risk.

---

## 7. Open questions

1. Are there materialized views today (in DB) that back these endpoints? If yes, document their refresh schedule and make sure the edge function reads from the same source.
2. Any scheduled rollup jobs (end-of-month snapshot)? If yes, move to `pg_cron` in Phase 6.
3. What's the p95 latency budget? Some dashboards show 5+ metrics — if each is a separate query, add per-endpoint batch support.

---

## 8. Test plan

- Per metric: compare edge-function output to Express output for same tenant, same date range. Numbers must match exactly.
- Dashboard load: time from page open to all widgets populated. Target < 2s.
- Playwright: navigate to Sales Performance page, verify all charts render with non-zero data.
