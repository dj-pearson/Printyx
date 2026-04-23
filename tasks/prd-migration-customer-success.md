# PRD: Migrate Customer Success to Edge Function

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 3 · **Week:** 7 (June 3 – June 9) · **Story:** US-014

**Why:** Customer Success is the post-sale retention engine — health scores, churn predictions, interventions, customer journey tracking, renewal pipeline. The master PRD estimated ~90 handlers; actual count is **44 endpoints** in one route file (still sizable). No edge-function counterpart exists today, so the `/customer-success` page is 404-blocked in production. This is the last big Express-only domain in Phase 3.

---

## 1. Scope

**Source Express files:**
- `server/routes/customer-success-routes.ts` (1,006 lines, **44 endpoints**) — mounted at `/api/customer-success`

**Services:**
- None dedicated. Uses the `IStorage` interface (injected via `setCustomerSuccessStorage`). The relevant storage methods are ~30 methods on `server/storage.ts` — must be re-implemented as direct Drizzle queries in Deno.

**Adjacent edge functions (audit for overlap, likely none):**
- `customer-metrics/` — different domain (aggregate metrics, not success workflow)
- `customer-segments/` — segmentation, orthogonal
- `customer-portal/` — customer-facing, not CS team

**Target edge function:**
```
supabase/functions/customer-success/
├── index.ts                        # dispatcher
├── handlers/
│   ├── health-scores.ts            # 7 endpoints
│   ├── churn-predictions.ts        # 8 endpoints
│   ├── interventions.ts            # 10 endpoints
│   ├── journeys.ts                 # 9 endpoints
│   └── renewals.ts                 # 10 endpoints
└── _score.ts                       # health score calc helpers (pure)
```

**Explicitly out of scope:**
- Automated health score recalculation (currently none; if added later, goes to `pg_cron` per Phase 6)
- ML-based churn models (current implementation uses rule-based scoring — Claude integration is NOT in place today)
- The `CustomerSuccessManagement.tsx` UI is preserved as-is

---

## 2. Endpoint parity matrix

### Health Scores (7 endpoints)

| Method | Path | Express line | Notes |
|---|---|---|---|
| GET    | `/customer-success/health-scores` | 22 | `?healthStatus&trend&minScore&maxScore` |
| GET    | `/customer-success/health-scores/:id` | 46 | |
| POST   | `/customer-success/health-scores` | 67 | |
| PATCH  | `/customer-success/health-scores/:id` | 89 | |
| GET    | `/customer-success/health-scores/customer/:customerId` | 110 | |
| GET    | `/customer-success/health-scores/customer/:customerId/history` | 131 | |
| GET    | `/customer-success/health-scores/due-calculation` | 152 | recalc queue |
| GET    | `/customer-success/health-scores/at-risk` | 172 | below threshold |

### Churn Predictions (8 endpoints)

| Method | Path | Express line | Notes |
|---|---|---|---|
| GET    | `/customer-success/churn-predictions` | 190 | |
| GET    | `/customer-success/churn-predictions/:id` | 212 | |
| POST   | `/customer-success/churn-predictions` | 233 | |
| PATCH  | `/customer-success/churn-predictions/:id` | 260 | |
| GET    | `/customer-success/churn-predictions/customer/:customerId` | 285 | |
| GET    | `/customer-success/churn-predictions/high-risk` | 309 | |
| GET    | `/customer-success/churn-predictions/expired` | 325 | |
| GET    | `/customer-success/churn-predictions/intervention-required` | 345 | |

### Interventions (10 endpoints)

| Method | Path | Express line | Notes |
|---|---|---|---|
| GET    | `/customer-success/interventions` | 363 | |
| GET    | `/customer-success/interventions/:id` | 387 | |
| POST   | `/customer-success/interventions` | 408 | |
| PATCH  | `/customer-success/interventions/:id` | 430 | |
| GET    | `/customer-success/interventions/customer/:customerId` | 451 | |
| POST   | `/customer-success/interventions/:id/assign` | 470 | |
| POST   | `/customer-success/interventions/:id/complete` | 502 | |
| POST   | `/customer-success/interventions/:id/cancel` | 533 | |
| GET    | `/customer-success/interventions/overdue` | 565 | |
| GET    | `/customer-success/interventions/my` | 581 | logged-in CSM |

### Journeys (9 endpoints)

| Method | Path | Express line | Notes |
|---|---|---|---|
| GET    | `/customer-success/journeys` | 599 | |
| GET    | `/customer-success/journeys/:id` | 622 | |
| POST   | `/customer-success/journeys` | 643 | |
| PATCH  | `/customer-success/journeys/:id` | 664 | |
| GET    | `/customer-success/journeys/customer/:customerId` | 685 | |
| POST   | `/customer-success/journeys/:id/advance-stage` | 706 | |
| POST   | `/customer-success/journeys/:id/record-touchpoint` | 732 | |
| GET    | `/customer-success/journeys/needing-attention` | 762 | |

### Renewals (10 endpoints)

| Method | Path | Express line | Notes |
|---|---|---|---|
| GET    | `/customer-success/renewals` | 780 | |
| GET    | `/customer-success/renewals/:id` | 803 | |
| POST   | `/customer-success/renewals` | 824 | |
| PATCH  | `/customer-success/renewals/:id` | 846 | |
| GET    | `/customer-success/renewals/customer/:customerId` | 867 | |
| GET    | `/customer-success/renewals/contract/:contractId` | 883 | |
| POST   | `/customer-success/renewals/:id/assign-csm` | 904 | |
| POST   | `/customer-success/renewals/:id/close` | 936 | |
| GET    | `/customer-success/renewals/upcoming/:days` | 965 | |
| GET    | `/customer-success/renewals/high-value/:minMrr` | 986 | |

**Total: 44 endpoints.**

---

## 3. Tables touched + RLS plan

From `shared/customer-success-schema.ts`:
- `customer_health_scores`
- `customer_health_score_history`
- `churn_predictions`
- `customer_interventions`
- `customer_journeys`
- `customer_journey_touchpoints`
- `renewal_opportunities`
- `csm_assignments` (if present)

All tenant-scoped. RLS file: `drizzle/rls/customer-success.sql` applies the standard 4-policy template.

**Verification step:** before writing code, `\d+` each table in the Supabase DB to confirm the column names in `shared/customer-success-schema.ts` match production exactly. This domain has had several schema iterations.

---

## 4. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| `IStorage.getHealthScores`, `.createHealthScore`, etc. | `server/storage.ts` | Re-implement as direct Drizzle `.select()` / `.insert()` in handlers — ~30 methods |
| Logger | `server/lib/logger.ts` (`createModuleLogger`) | Replace with `_shared/logger.ts` |
| RBAC: `isAdminOrManager` (roleLevel ≥ 4) | inline in route file | Port to `_shared/rbac.ts` (or reuse from KB PRD) |

No Claude, no SendGrid, no websockets, no cron. Cleanest CRUD-heavy migration in Phase 3.

---

## 5. RBAC pattern

Route-file helper: `isAdminOrManager(user)` checks `user.roleLevel ≥ 4` (Manager level). Applied sparingly — most endpoints are "my tenant, any authenticated user." Assign/cancel/close endpoints gate by roleLevel.

Port to `_shared/rbac.ts` as `isManagerOrAbove(ctx)` — reuse across domains.

---

## 6. Acceptance criteria

### Functional parity
- [ ] All 44 endpoints return the same shape as Express for equivalent inputs
- [ ] Health score `PATCH` updates `history` row (audit-trail semantics preserved)
- [ ] Intervention `assign` writes assignee + assignedAt; `complete` writes outcome + completedAt
- [ ] Journey `advance-stage` updates stage, creates a touchpoint record automatically
- [ ] Renewal `close` with outcome="won" marks opportunity as closed and updates MRR rollup
- [ ] Filter endpoints (`/health-scores?healthStatus=at_risk&minScore=0&maxScore=50`) return correct rows
- [ ] Numeric aggregates (`upcoming/:days`, `high-value/:minMrr`) match Express output

### Security / RLS
- [ ] RLS applied to all 7-8 customer-success tables
- [ ] Two-tenant test: intervention created in tenant A, tenant B `GET /interventions/:id` → 404
- [ ] Cross-tenant `customerId` in path → 404 (RLS filters at SELECT layer)
- [ ] RBAC: non-manager cannot `POST /interventions/:id/assign` → 403

### Frontend compatibility
- [ ] `CustomerSuccessManagement.tsx` loads, all 5 tabs populate (health, churn, interventions, journeys, renewals)
- [ ] Can create a health score, assign an intervention, advance a journey stage, close a renewal from the UI
- [ ] Playwright MCP smoke: one pass through each tab

### Deletion
- [ ] `server/routes/customer-success-routes.ts` deleted
- [ ] Storage methods for customer-success removed from `server/storage.ts` (or left if still used by other routes — check with grep first)
- [ ] Route registry entry removed
- [ ] `grep -r "customer-success-routes\|setCustomerSuccessStorage" server/ client/` returns zero matches

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 7. Test plan

### Unit (Deno)
- `_score.test.ts` — health score math + bucketing (`at_risk | healthy | champion`)
- Handler-level unit tests for endpoints with non-trivial logic: `advance-stage`, `close`, `assign`, `complete`

### Integration (local Supabase)
- Seed 3 customers × 2 tenants
- Run each of the 44 endpoints; diff against Express dev server output
- Verify RLS: switch JWT tenant, confirm other-tenant rows invisible

### Production smoke
- Full Playwright flow through the CS dashboard (all 5 tabs)
- Verify dashboard counts match a direct SQL query

---

## 8. Rollback

Standard: revert the edge function PR. Since the domain is currently 404'ing in prod (Express not deployed), rollback is to the current baseline — no user-visible regression.

RLS stays on (non-breaking). No schema changes in this PRD.

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Storage method re-implementation misses an edge case (e.g., null handling in aggregates) | High | Medium | Line-by-line port; unit tests on each aggregation method |
| Schema drift between `customer-success-schema.ts` and production DB | Medium | High | `\d+` each table before porting; create migrations for any drift found |
| Frontend uses undocumented query params that Express accepts but edge function doesn't | Medium | Low | Open DevTools Network tab during Playwright run; log all inbound query params for a day |
| 44 endpoints is a lot to land in one PR — review fatigue | High | Low | Split into 5 sub-PRs (one per resource group) under a shared feature branch; merge to main when all 5 are reviewed |
| Renewal "close" writes MRR rollup that affects billing reports | Low | High | Verify against billing schema; include cross-domain regression test |

---

## 10. Open questions

1. **`customer_journey_touchpoints` — is it a separate table or a JSON column on `customer_journeys`?** Affects the `record-touchpoint` handler shape.
2. **CSM assignment — do we have a `users.role = 'csm'` convention, or a separate `csm_assignments` table?** Check schema before writing `/renewals/:id/assign-csm`.
3. **`/health-scores/due-calculation` — how is "due" determined?** Likely a `next_calculation_at` column. If not, this endpoint needs a definition.
4. **MRR rollup on renewal close — stored where?** If it's a materialized view, refreshing may be out of scope; if it's a column update, port cleanly.
5. **Bulk operations — any endpoints that should support batch?** Current API is all single-record. If dashboard perf needs batch reads, add `?ids=a,b,c` support during the port.

---

## 11. Definition of done

- [ ] All 44 endpoints live at `functions.printyx.net/customer-success/*`
- [ ] `CustomerSuccessManagement.tsx` fully functional across all 5 tabs
- [ ] RLS verified on all customer-success tables
- [ ] Express route file + related storage methods removed
- [ ] Type checks + build pass
- [ ] 72 hours stable before Phase 3 moves to US-015
