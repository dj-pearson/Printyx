# PRD: Migrate Reports (10 Domain APIs + Reporting Engine) to Edge Function(s)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 6 · **Week:** 15 (July 29 – Aug 4) · **Story:** US-023

**Why:** The master PRD estimated 8 report domain APIs; actual count is **10 report-specific files (~2,735 lines)** plus `reporting-api.ts` (968 lines, the generic reporting engine). These power executive dashboards, sales KPI views, service manager metrics, and the scheduled-reports subsystem. This is the last substantial domain migration before the sunset PRD, and the one where the master PRD flagged "complex queries may need raw SQL in Drizzle" as a spike.

---

## 1. Scope

**Source Express files (10 report APIs + 1 generic):**

| File | Lines | Endpoints | Persona |
|---|---|---|---|
| `director-reports-api.ts` | 132 | 4 | Director (strategic) |
| `executive-reports-api.ts` | 131 | 4 | Executive (board-level) |
| `sales-reports-api.ts` | 414 | 10 | Sales rep |
| `sales-manager-reports-api.ts` | 291 | 6 | Sales manager |
| `sales-supervisor-reports-api.ts` | 285 | 6 | Sales supervisor |
| `service-reports-api.ts` | 341 | 8 | Service tech |
| `service-manager-reports-api.ts` | 292 | 6 | Service manager |
| `service-supervisor-reports-api.ts` | 289 | 6 | Service supervisor |
| `team-reports-api.ts` | 460 | 8 | Team lead |
| `warehouse-reports-api.ts` | 100 | 3 | Warehouse |
| `reporting-api.ts` | 968 | 9 | Generic (definitions, execution, scheduling) |

**Total: 70 endpoints across ~3,700 lines.**

**Also in scope (discovered during audit, NOT in master PRD):**
- `server/routes-reporting.ts` — likely routing wrapper
- `server/routes-reporting-architecture.ts` — meta/architecture endpoints
- `server/routes-reporting-definitions.ts` — report definition CRUD
- `server/routes-reports.ts` — alias/shim
- `server/routes-custom-reports.ts` — custom report builder
- `server/routes-scheduled-reports.ts` — scheduled exec (cron-adjacent)

**Services:**
- `server/services/director-reporting-service.ts`
- `server/services/service-reporting-service.ts`
- `server/services/service-manager-reporting-service.ts`
- `server/services/service-supervisor-reporting-service.ts`
- Report definition storage (likely in `storage.ts`)

**Edge side:** No existing report edge function.

**Target:** **1 canonical `supabase/functions/reports/` edge function** — reports share a lot of code (aggregations, date ranges, tenant scoping) and splitting would cause code duplication. Cold-start not critical since dashboards are background-loaded.

```
supabase/functions/reports/
├── index.ts                           # dispatcher — routes to persona handlers
├── handlers/
│   ├── definitions.ts                 # generic report def CRUD (from reporting-api.ts)
│   ├── execute.ts                     # run a report by definition ID
│   ├── scheduled.ts                   # scheduled report exec + history
│   ├── director.ts                    # 4 endpoints
│   ├── executive.ts                   # 4 endpoints
│   ├── sales.ts                       # 10 + 6 + 6 = 22 endpoints (persona-nested paths)
│   ├── service.ts                     # 8 + 6 + 6 = 20 endpoints
│   ├── team.ts                        # 8 endpoints
│   └── warehouse.ts                   # 3 endpoints
├── _queries/                          # raw SQL per report (readability + performance)
│   ├── director.sql.ts                # template-literal SQL exports
│   ├── executive.sql.ts
│   ├── sales.sql.ts
│   └── ...
└── _cache.ts                          # in-memory TTL cache (hot paths)
```

**Explicitly out of scope:**
- Building a report builder UI — the backend preserves existing endpoints
- Introducing OLAP cubes, materialized views, or data warehouse infrastructure
- PDF/Excel export of reports — tracked as a separate follow-up if needed (lease PDF PRD sets the pattern)

---

## 2. Architecture decision — Drizzle query builder vs. raw SQL

**Master PRD spike:** "Does Drizzle-in-Deno handle complex joins across 5+ tables performantly, or do we fall back to raw SQL per report?"

**Answer from code inspection:** Current reports use Drizzle query builder (no `sql\`\`` or `db.execute` in `director-reports-api.ts`). But the director file is 132 lines with only 4 endpoints — the queries are likely straightforward.

**Strategy:**
1. **Start with Drizzle for simple reports** (< 3-table joins, basic aggregations)
2. **Fall back to tagged-template raw SQL for complex reports** — stored in `_queries/*.sql.ts` files:
   ```typescript
   // _queries/sales.sql.ts
   export const topRepsByRevenue = (tenantId: string, days: number) => sql`
     SELECT u.id, u.name, SUM(d.amount) AS revenue,
            SUM(d.amount) - LAG(SUM(d.amount)) OVER (ORDER BY DATE_TRUNC('month', d.closed_at)) AS mom_delta
     FROM deals d
     JOIN users u ON d.owner_id = u.id
     WHERE d.tenant_id = ${tenantId}
       AND d.closed_at >= NOW() - INTERVAL ${sql.raw(String(days))} || ' days'
     GROUP BY u.id, u.name
     ORDER BY revenue DESC
     LIMIT 10
   `;
   ```
3. **Parametrize safely** — always use Drizzle's `sql` tag with `${}` bindings, never string concatenation
4. **Hybrid acceptable** — mix in one handler: Drizzle for simple parts, raw SQL for the expensive join

**Performance baseline:** before porting, run the most expensive existing report against the DB, capture p95. Target: edge function must match or beat.

---

## 3. Endpoint parity matrix (by file)

Full per-file matrices are out-of-scope for this PRD (70 endpoints). **Required deliverable in the PR:** `docs/reports-parity.md` with per-endpoint classification and SQL approach (Drizzle vs raw).

### Summary table

| File | Endpoints | Expected complexity |
|---|---|---|
| `director-reports-api.ts` | 4 | High (cross-domain) |
| `executive-reports-api.ts` | 4 | High (board KPIs) |
| `sales-reports-api.ts` | 10 | Medium |
| `sales-manager-reports-api.ts` | 6 | Medium |
| `sales-supervisor-reports-api.ts` | 6 | Medium |
| `service-reports-api.ts` | 8 | Medium |
| `service-manager-reports-api.ts` | 6 | Medium |
| `service-supervisor-reports-api.ts` | 6 | Medium |
| `team-reports-api.ts` | 8 | Medium |
| `warehouse-reports-api.ts` | 3 | Low |
| `reporting-api.ts` | 9 | High (definition engine) |

---

## 4. Tables + RLS plan

Reports are **read-only from business domain tables** (already RLS-scoped) + CRUD on report-specific tables:
- `report_definitions`
- `report_executions` (history)
- `scheduled_reports`
- `report_subscriptions` (who gets emailed)

RLS file: `drizzle/rls/reports.sql` on definition + execution tables.

**Source tables are already protected by prior RLS PRDs** (lead-scoring, customer-success, billing, etc.). Report queries inherit those policies automatically — **no additional work**.

**Critical:** every report query must include `WHERE tenant_id = ${ctx.tenantId}` as defense-in-depth alongside RLS. Double-gate prevents a bug in raw SQL from accidentally leaking cross-tenant data.

---

## 5. Caching strategy

Dashboards re-fetch the same reports frequently (page navigate, tab switch). Naive no-cache = hammering.

**`_cache.ts` — in-memory TTL cache:**

```typescript
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data as T);
  return loader().then(data => {
    cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
    return data;
  });
}
```

**Cache key format:** `${tenantId}:${reportName}:${hashOfParams}`.

**TTL guidance:**
- Executive/director dashboards: 5 min
- Sales/service rep daily: 1 min
- Real-time views: don't cache; use Supabase Realtime instead

**Limitations:** Deno edge instances are short-lived; cache doesn't survive restart. That's fine — effectively a per-instance memoization. Don't reach for Redis just yet.

---

## 6. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| Reporting services | `server/services/*-reporting-service.ts` | Port to `_queries/*.sql.ts` + handler logic |
| `storage` methods | `server/storage.ts` | Drizzle direct (for report defs) |
| Scheduled exec (cron-adjacent) | unclear today | **Moved to `pg_cron` via US-026 PRD** |
| Email report delivery (sendgrid) | likely in service | Reuse `_shared/sendgrid.ts` from Phase 3 |

No new external deps. All reporting is DB-driven.

---

## 7. Scheduled reports

`routes-scheduled-reports.ts` + the `reporting-api.ts` scheduling endpoints run reports on a schedule and deliver results (email/export).

**Port strategy:**
1. Edge function exposes `POST /reports/scheduled/run/:scheduleId` — runs once
2. **`pg_cron` job** (from US-026 PRD) calls this endpoint via `pg_net.http_post` on the schedule
3. Scheduled report row includes `cron_expression`, `last_run_at`, `next_run_at`
4. Result: report generation runs in edge function context; scheduling lives in Postgres

This decouples "when to run" from "how to run" — the edge function doesn't need its own scheduler.

---

## 8. Acceptance criteria

### Audit
- [ ] `docs/reports-parity.md` published — every one of the 70 endpoints classified with target path, SQL approach (Drizzle/raw), cache policy
- [ ] Performance baseline captured for top 10 most-expensive reports (p95 latency on production data)

### Functional parity
- [ ] Every endpoint returns the same output shape as Express
- [ ] **Numeric values match exactly** for identical inputs (run same date range through dev-server Express + edge function, diff JSON)
- [ ] Generic report definition CRUD works
- [ ] Scheduled report exec endpoint triggered by pg_cron produces correct output
- [ ] Email delivery (if currently a feature) works via SendGrid REST

### Performance
- [ ] Each of the 10 most-expensive reports p95 latency ≤ Express baseline + 10% (cache warm)
- [ ] Cold p95 ≤ Express baseline × 1.5 (acceptable one-time cost per edge instance spin-up)
- [ ] Cache hit rate > 70% on dashboard reload scenarios

### Security / RLS
- [ ] RLS applied to `report_definitions`, `report_executions`, `scheduled_reports`, `report_subscriptions`
- [ ] Every raw SQL query includes explicit `tenant_id = ${ctx.tenantId}` filter
- [ ] Two-tenant test: report def in tenant A invisible to tenant B, even if raw SQL is malformed
- [ ] Report exec cannot return data from tables where RLS doesn't cover the current JWT

### Frontend compatibility
- [ ] All report-viewing pages load with non-zero data:
  - Director / Executive dashboards
  - Sales Performance, Sales Manager Dashboard
  - Service Performance, Service Manager Dashboard
  - Team Lead Dashboard
  - Warehouse Dashboard
  - `ScheduledReportsDashboard.tsx`
- [ ] Playwright MCP pass on each
- [ ] Report builder (if exposed in UI) works

### Deletion
- [ ] 11 Express report files deleted (the 10 persona + `reporting-api.ts`)
- [ ] Related `routes-reporting*.ts` + `routes-reports.ts` + `routes-scheduled-reports.ts` + `routes-custom-reports.ts` deleted
- [ ] 4 reporting service files deleted (logic in `_queries/`)
- [ ] Route registry entries removed
- [ ] `grep -r "reports-api\|reporting-service\|scheduled-reports" server/` returns zero matches

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 9. Test plan

### Unit (Deno)
- Each `_queries/*.sql.ts` function — parameter injection safety (no string concat), tenant filter present
- `_cache.test.ts` — TTL expiry, key collision

### Integration
- **Parity regression**: seed a deterministic fixture dataset (100 deals, 50 service tickets, 20 customers); run every report against Express dev-server + edge function; diff JSON. Must match exactly.
- Scheduled run triggered by fake pg_cron call
- Cache invalidation on report definition update

### Performance
- Each of top 10 most-expensive reports: 20-iteration timing run, capture p50/p95/p99
- Cache warmed vs. cold comparison
- Large tenant: seed 10K rows in each source table, verify reports complete within 5s

### Production smoke
- Open every dashboard listed in §8 frontend compatibility; verify data matches prior expectations
- Send a test scheduled report; verify email arrives with correct content

---

## 10. Rollback

**Low risk.** Reports are read-only; no data-changing operations. Standard: revert PR → reports 404 in prod → dashboards show "report unavailable" banners until rollback complete.

Scheduled report jobs (pg_cron): disable the cron job before revert to prevent unnecessary 404 calls.

No schema changes.

---

## 11. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Raw SQL regression changes report numbers in subtle ways | High | **Critical** | Exact-diff regression test against Express output on fixture data |
| Complex report joins exceed Deno edge timeout on large tenants | Medium | High | Per-report timeout budget; if >30s, move to scheduled async with result storage |
| Drizzle-in-Deno SQL tag syntax surprises (e.g., parameter binding with `sql.raw`) | Medium | Medium | Unit test every query; reject PR if any raw interpolation exists |
| Cache memory leak under long-running Deno instance | Low | Low | Cap cache size to 100 entries; LRU eviction |
| Materialized views reference tables being migrated | Medium | Medium | `\d+ <view>` to enumerate; verify views don't break; refresh after any schema change |
| Timezone drift: Express uses server TZ, Deno defaults to UTC | High | Medium | Port every `NOW()`, `CURRENT_TIMESTAMP`, `DATE_TRUNC` with explicit `AT TIME ZONE '<tenant TZ>'` |
| Existing reports were buggy in prod — migration inherits bugs | Medium | Low | Not a blocker for migration; file follow-ups |

---

## 12. Open questions

1. **Are there materialized views today?** `SELECT * FROM pg_matviews` — enumerate. If any exist, document refresh schedule + ensure they survive migration.
2. **Report output format(s)** — JSON only, or CSV / PDF / Excel? Affects whether we need export helpers.
3. **Email delivery for scheduled reports** — HTML body assembled where? If templated, reuse Phase 3 email infra.
4. **Per-tenant timezone** — is there a `tenants.timezone` column? If yes, use it in date calculations; if no, UTC everywhere (document behavior change to users).
5. **Performance budget per report** — what p95 do users currently tolerate? Collect from current dashboards / user feedback.
6. **Custom report builder** — is it exercised by users, or vestigial? Affects depth of testing needed.
7. **`reporting-api.ts` (968 lines, 9 endpoints)** — what does it actually do? Audit is critical; 108 avg lines/endpoint is high.
8. **Are there legacy "raw SQL string" paths already?** Search `db.execute` or `db.query.raw` in reports — if present, they're already unsafe; fix during port.

---

## 13. Definition of done

- [ ] All 70 endpoints live at `functions.printyx.net/reports/*`
- [ ] Every report produces same output as Express for same input (regression suite passes)
- [ ] Scheduled reports triggered by pg_cron work end-to-end
- [ ] Cache reduces dashboard-reload latency ≥ 50%
- [ ] All dashboards listed populate correctly in prod
- [ ] 11 Express files + related routes-*.ts + 4 services deleted
- [ ] Type checks + build pass
- [ ] 72 hours stable before Phase 6 proceeds to US-024
