# Follow-up: Reports Migration (Phase 6 US-023)

**Status:** in progress — director persona ported as the template. 9 personas + the generic reporting engine remain.

**Parent PRD:** `tasks/prd-migration-reports.md`

## What's done

- `supabase/functions/persona-reports/` — edge function skeleton with URL-path dispatch by persona (`/persona-reports/{persona}/*`)
- `supabase/functions/persona-reports/_context.ts` — shared `getRoleLevel` / `hasMinLevel` / `parseDateRange` helpers
- `supabase/functions/persona-reports/handlers/director.ts` — 3 endpoints ported end-to-end (company sales perf, company service perf, clear-cache)
- `drizzle/reports/director.sql` — 2 `SECURITY DEFINER` PL/pgSQL functions (`report_company_sales_performance`, `report_company_service_performance`) ported verbatim from `director-reporting-service.ts`
- Pending personas return `501 not_implemented` with the source-file pointer so callers get a clear signal

## Pattern to follow for each pending persona

For every `server/routes/<persona>-reports-api.ts`:

1. **Port the SQL body** — open `server/services/<persona>-reporting-service.ts`, take each `db.execute(sql\`...\`)` block, and rewrite as a PL/pgSQL function in a new `drizzle/reports/<persona>.sql`. Convention:
   - Function name: `report_<short_name>` (e.g. `report_sales_rep_pipeline`)
   - First arg `p_tenant_id uuid`, then report-specific filters
   - Return `jsonb` — mirror the Express response shape
   - `SECURITY DEFINER` + explicit `REVOKE ALL ... FROM PUBLIC` at the bottom
2. **Port the handler** — create `supabase/functions/persona-reports/handlers/<persona>.ts` following `director.ts` as a template:
   - Start with `hasMinLevel(auth, <required>)` gate
   - Parse `parseDateRange(url)` for the date filter
   - Call `db.rpc('report_<name>', { p_tenant_id, p_date_from, p_date_to })`
   - Apply the Express "insights" wrapper (status classifications, top-N sorts)
3. **Wire it in** — import the new handler in `persona-reports/index.ts` and add a branch to the dispatch. Delete the persona's entry from `PENDING_PERSONAS`.
4. **Delete the Express files** — once the handler is verified in prod, remove:
   - `server/routes/<persona>-reports-api.ts`
   - `server/services/<persona>-reporting-service.ts`
   - Registry entry in `server/routes-registry.ts`

## Inventory of pending endpoints (67 total)

### Executive — `executive-reports-api.ts` (131 lines, 4 endpoints)
Level gate: 7 (Executive). Service: `executive-reporting-service.ts` (321 lines).

- [ ] `GET /executive/financial-overview` — company P&L summary
- [ ] `GET /executive/growth-metrics` — YoY growth, LTV, CAC
- [ ] `GET /executive/strategic-initiatives` — initiative tracking
- [ ] `POST /executive/clear-cache`

### Sales — `sales-reports-api.ts` (414 lines, 10 endpoints)
Level gate: 2+. Service: `sales-reporting-service.ts` (763 lines) — the largest service.

- [ ] `GET /sales/my-pipeline` — rep's own pipeline view
- [ ] `GET /sales/my-activity` — activity summary
- [ ] `GET /sales/my-quota-attainment`
- [ ] `GET /sales/my-deals/by-stage`
- [ ] `GET /sales/my-deals/closing-this-month`
- [ ] `GET /sales/my-win-rate`
- [ ] `GET /sales/my-average-deal-size`
- [ ] `GET /sales/my-forecast`
- [ ] `GET /sales/my-ranking` — leaderboard position
- [ ] `GET /sales/my-lead-conversion`

### Sales Manager — `sales-manager-reports-api.ts` (291 lines, 6 endpoints)
Level gate: 4. Service: implied in `sales-reporting-service.ts` or a sibling.

- [ ] `GET /sales-manager/team-performance`
- [ ] `GET /sales-manager/team-pipeline`
- [ ] `GET /sales-manager/team-forecast`
- [ ] `GET /sales-manager/team-activity-summary`
- [ ] `GET /sales-manager/team-win-rate`
- [ ] `POST /sales-manager/clear-cache`

### Sales Supervisor — `sales-supervisor-reports-api.ts` (285 lines, 6 endpoints)
Level gate: 3.

- [ ] `GET /sales-supervisor/squad-performance`
- [ ] `GET /sales-supervisor/squad-pipeline`
- [ ] `GET /sales-supervisor/squad-activities`
- [ ] `GET /sales-supervisor/squad-win-rates`
- [ ] `GET /sales-supervisor/squad-leaderboard`
- [ ] `POST /sales-supervisor/clear-cache`

### Service — `service-reports-api.ts` (341 lines, 8 endpoints)
Level gate: 2+. Service: `service-reporting-service.ts` (665 lines).

- [ ] `GET /service/my-tickets`
- [ ] `GET /service/my-completion-rate`
- [ ] `GET /service/my-first-time-fix`
- [ ] `GET /service/my-average-resolution-time`
- [ ] `GET /service/my-customer-satisfaction`
- [ ] `GET /service/my-sla-compliance`
- [ ] `GET /service/my-ticket-volume`
- [ ] `GET /service/my-upcoming-maintenance`

### Service Manager — `service-manager-reports-api.ts` (292 lines, 6 endpoints)
Level gate: 4.

- [ ] `GET /service-manager/team-performance`
- [ ] `GET /service-manager/team-sla`
- [ ] `GET /service-manager/technician-utilization`
- [ ] `GET /service-manager/ticket-backlog`
- [ ] `GET /service-manager/customer-satisfaction`
- [ ] `POST /service-manager/clear-cache`

### Service Supervisor — `service-supervisor-reports-api.ts` (289 lines, 6 endpoints)
Level gate: 3.

- [ ] `GET /service-supervisor/squad-performance`
- [ ] `GET /service-supervisor/squad-sla`
- [ ] `GET /service-supervisor/squad-utilization`
- [ ] `GET /service-supervisor/squad-completion`
- [ ] `GET /service-supervisor/squad-satisfaction`
- [ ] `POST /service-supervisor/clear-cache`

### Team — `team-reports-api.ts` (460 lines, 8 endpoints)
Service: `team-reporting-service.ts` (934 lines) — the largest service.

- [ ] `GET /team/members` — team roster with roles
- [ ] `GET /team/performance` — cross-function team metrics
- [ ] `GET /team/activity-heatmap`
- [ ] `GET /team/collaboration-score`
- [ ] `GET /team/project-load`
- [ ] `GET /team/availability`
- [ ] `GET /team/individual/:userId` — deep-dive on a member
- [ ] `POST /team/clear-cache`

### Warehouse — `warehouse-reports-api.ts` (100 lines, 2 endpoints) ✅ DONE
Handler: `supabase/functions/persona-reports/handlers/warehouse.ts`
SQL: `drizzle/reports/warehouse.sql` (`report_warehouse_team_quick_stats`)

- [x] `GET /warehouse/team/quick-stats` — FPY + activity + trends from `warehouse_kitting_operations`
- [x] `POST /warehouse/cache/invalidate` — stateless no-op (edge isolates don't cache)

The PRD's original 3-endpoint guess (inventory-summary, low-stock-alerts,
shipment-status) wasn't what the Express file actually implemented — it only
exposes the team quick-stats FPY report and a cache bust. Those other
endpoints may be a feature gap worth filing separately.

**Hierarchical access:** the Express service used
`HierarchicalQueryBuilder.getAccessibleUserIds()` to scope by team. The port
uses a simpler heuristic — level 2 sees only themselves; level 3+ sees all
users in the tenant. Refine when the full RBAC hierarchy builder gets its
own port.

### Generic reporting engine — `reporting-api.ts` (968 lines, 9 endpoints)

This is a separate subsystem: custom report definitions, scheduled runs, delivery. It's the most complex piece of the report migration.

- [ ] `GET /definitions` — list available report templates
- [ ] `GET /definitions/:id`
- [ ] `POST /definitions` — create custom report
- [ ] `PUT /definitions/:id`
- [ ] `DELETE /definitions/:id`
- [ ] `POST /run/:id` — execute a report ad-hoc, return results
- [ ] `GET /schedule` — list scheduled reports
- [ ] `POST /schedule` — create a schedule
- [ ] `POST /schedule/dispatch-due` — called by pg_cron (see `drizzle/cron/reports.sql`); runs all reports whose `next_run_at` has arrived

The scheduled dispatcher is already wired in pg_cron (`scheduled-reports-dispatch`, every 15 min). Until `/schedule/dispatch-due` lands, the cron job will log failures in `cron.job_run_details` — not harmful, just noisy.

## Recommended order

1. ~~**Warehouse**~~ — done.
2. **Executive** — 4 endpoints, similar shape to director (level-gated company-wide).
3. **Sales + Service** (the rep-level ones) — 10 + 8 endpoints, largest services. Port together since the query patterns are symmetrical.
4. **Manager / Supervisor personas** — filter-based variants of the rep queries; can often share PL/pgSQL with a `p_scope` argument.
5. **Team** — 8 endpoints, 934-line service. Do last; most complex aggregation.
6. **Generic reporting engine** — separate follow-up session. Unblocks scheduled report delivery.

## Frontend routing note

The Express version mounts each persona at its own path:
- `/api/director-reports/sales/company-performance`
- `/api/executive-reports/financial-overview`
- etc.

The edge function mounts all under `/api/persona-reports/<persona>/*`:
- `/api/persona-reports/director/sales/company-performance`
- `/api/persona-reports/executive/financial-overview`

Before sunset, either:
- **(a)** update the frontend to use the new paths (grep for `director-reports`, `executive-reports`, etc.), or
- **(b)** add a rewrite rule so `/<persona>-reports/*` → `/persona-reports/<persona>/*`

Option (a) is cleaner; option (b) preserves frontend code for a soak period. Track which approach is chosen and when the frontend update lands.

## Tables touched

Report queries read from (no writes):
- `opportunities`, `sales_quotas` (sales reports)
- `service_calls`, `time_entries` (service reports)
- `users`, `regions`, `locations` (joined throughout)
- `inventory_items`, `shipments` (warehouse reports — verify table names)
- `business_records` (sales-rep lead views)

No new tables. RLS remains tight on every underlying table — the `SECURITY DEFINER` functions bypass RLS safely because they always filter by the caller-supplied `p_tenant_id` that the edge function sets from the caller's JWT.

## Why PL/pgSQL + RPC instead of Drizzle-in-Deno

Per `CLAUDE.md` and session notes, Drizzle doesn't run reliably in Deno edge functions on this self-hosted Supabase stack. The report queries are also the most complex in the app — 5-CTE aggregates with nested JSON building. Keeping them as SQL functions:

- Visible to `psql` for debugging + `EXPLAIN ANALYZE`
- Easy to unit-test independently of the edge function
- Edge function stays thin (parse query → rpc → wrap response)
- No Drizzle Deno binding required
