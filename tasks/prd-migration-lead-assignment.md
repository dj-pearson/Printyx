# PRD: Consolidate Lead Assignment into One Edge Function

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 3 · **Week:** 6 (May 27 – June 2) · **Story:** US-013

**Why:** Lead assignment is the most fragmented domain in the codebase — 3 Express files (1,534 lines combined) overlap with **9 separate edge functions** totaling ~1,969 lines. Four edge-function names have "lead-assignment" in them. Frontend pages call a mix of `/api/lead-assignment-rules/*`, `/api/sales-territories/*`, `/api/auto-lead-routing/*`, and `/api/assign-lead`. Consolidating into one canonical `supabase/functions/lead-assignment/` ends the routing maze and deletes the Express side.

---

## 1. Scope

**Express source files:**
- `server/routes-lead-assignment.ts` (683 lines, **21 endpoints**) — territories, assignment rules, rep-capacity, history, user-assignments, queue, direct assign
- `server/routes-auto-lead-routing.ts` (343 lines, **6 endpoints**) — routing engine + config
- `server/routes-territory-management.ts` (508 lines, **~19 endpoints**) — territory types, boundaries, assignment, rules
- `server/services/auto-lead-routing-service.ts` (585 lines) — routing algorithm (round-robin, weighted, capacity-aware)
- `server/services/territory-management-service.ts` (681 lines) — territory CRUD + geographic matching

**Existing edge functions (9):**
| Edge function | Lines | Purpose | Keep? |
|---|---|---|---|
| `lead-assignment/` | 390 | generic dispatcher | **becomes canonical** |
| `lead-assignment-rules/` | 153 | rules CRUD | merge in |
| `lead-assignment-queue/` | 150 | queue management | merge in |
| `lead-assignment-history/` | 121 | history list | merge in |
| `assign-lead/` | 95 | direct assignment action | merge in |
| `auto-lead-routing/` | 252 | routing engine | merge in |
| `sales-territories/` | 168 | territory CRUD | merge in |
| `territories/` | unknown | legacy? | audit + likely delete |
| `user-assignments/` | unknown | per-user lookup | merge in |

**Target canonical edge function:**
```
supabase/functions/lead-assignment/
├── index.ts                       # dispatcher — all URL prefixes routed here
├── handlers/
│   ├── territories.ts             # /sales-territories/* + /territories/*
│   ├── rules.ts                   # /lead-assignment-rules/*
│   ├── capacity.ts                # /rep-capacity/*
│   ├── history.ts                 # /lead-assignment-history/* + /user-assignments/*
│   ├── queue.ts                   # /lead-assignment-queue/*
│   ├── assign.ts                  # /assign-lead (direct)
│   └── routing.ts                 # /auto-lead-routing/* (route, route-batch, dashboard, config, preview)
└── _engine.ts                     # routing algorithm ported from auto-lead-routing-service.ts
└── _territory.ts                  # territory matching ported from territory-management-service.ts
```

**Explicitly out of scope:**
- Frontend changes — `TerritoryManagement.tsx` and `AutoLeadRoutingDashboard.tsx` already hit `/api/...`; paths preserved.
- Lead scoring inputs to routing decisions (tracked in US-012).

---

## 2. Parity audit (pre-code step)

Produce `docs/lead-assignment-parity.md` in the PR body before writing any handler code. Table:

| Method | Path | Express location | Edge location today | Canonical location | Status | Action |
|---|---|---|---|---|---|---|
| GET    | `/sales-territories` | routes-lead-assignment.ts:24 | sales-territories/index.ts | handlers/territories.ts | | verify-parity |
| ... | ... | ... | ... | ... | ... | ... |

**Status values:** `only-express`, `only-edge`, `both-match`, `both-diverged`, `duplicate-edge` (same endpoint in 2+ edge functions).

**Action values:** `port-to-canonical`, `merge-edge-into-canonical`, `delete-duplicate`, `delete-express-only`.

---

## 3. Endpoint parity matrix (provisional)

### From `routes-lead-assignment.ts`

| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/api/sales-territories` | 24 | |
| GET    | `/api/sales-territories/:id` | 44 | |
| POST   | `/api/sales-territories` | 65 | |
| PUT    | `/api/sales-territories/:id` | 87 | |
| DELETE | `/api/sales-territories/:id` | 110 | |
| GET    | `/api/lead-assignment-rules` | 134 | |
| GET    | `/api/lead-assignment-rules/:id` | 154 | |
| POST   | `/api/lead-assignment-rules` | 175 | |
| PUT    | `/api/lead-assignment-rules/:id` | 197 | |
| DELETE | `/api/lead-assignment-rules/:id` | 220 | |
| GET    | `/api/rep-capacity/:userId` | 244 | |
| GET    | `/api/rep-capacity` | 265 | list all |
| POST   | `/api/rep-capacity` | 285 | |
| PATCH  | `/api/rep-capacity/:userId/availability` | 322 | |
| GET    | `/api/lead-assignment-history/:leadId` | 353 | |
| GET    | `/api/user-assignments/:userId` | 374 | |
| POST   | `/api/lead-assignment-history` | 396 | |
| GET    | `/api/lead-assignment-queue` | 423 | |
| POST   | `/api/lead-assignment-queue` | 452 | |
| POST   | `/api/lead-assignment-queue/:id/process` | 474 | runs assignment |
| POST   | `/api/assign-lead` | 505 | direct assign |

### From `routes-auto-lead-routing.ts`

| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/api/auto-lead-routing/route/:leadId` | 31 | |
| POST | `/api/auto-lead-routing/route-batch` | 63 | |
| GET  | `/api/auto-lead-routing/dashboard` | 109 | |
| GET  | `/api/auto-lead-routing/config` | 243 | |
| PUT  | `/api/auto-lead-routing/config` | 277 | |
| GET  | `/api/auto-lead-routing/preview/:leadId` | 306 | dry-run |

### From `routes-territory-management.ts`

19 endpoints. Paths begin with `/api/territory-management/*` (verify in PR audit).

**Total pre-audit endpoint count: ~46.** Expect shrinkage after dedup with existing edge functions.

---

## 4. Tables touched + RLS plan

- `sales_territories` (or `territories` — audit) — tenant-scoped
- `lead_assignment_rules`
- `rep_capacity` / `user_capacity`
- `lead_assignment_history`
- `lead_assignment_queue`
- `territory_boundaries` (if territory-management uses geo)
- `routing_config` (single row per tenant — verify schema)

RLS file: `drizzle/rls/lead-assignment.sql` — standard 4-policy template on each.

---

## 5. Routing algorithm port

`server/services/auto-lead-routing-service.ts` implements:
- Round-robin across reps in a territory
- Weighted by rep capacity (open deals / max concurrent)
- Skill-based (lead industry → rep specialty match)
- Round-robin anchor tracked per-tenant in `routing_config.last_assigned_user_id`

Port to `supabase/functions/lead-assignment/_engine.ts` as pure TS (no side effects other than DB reads). Single entry: `async function route(leadId, tenantId, db): Promise<AssignmentDecision>`.

**Complexity gate:** the service uses `Promise.all` over rep candidates for capacity lookups — port as-is. If Deno edge timeout becomes an issue for `route-batch`, batch DB reads rather than N+1.

---

## 6. Acceptance criteria

### Audit
- [ ] `docs/lead-assignment-parity.md` published — every endpoint classified
- [ ] Duplicate endpoints between edge functions identified and resolved (one canonical each)

### Functional
- [ ] All ~46 Express endpoints ported or reconciled
- [ ] `POST /assign-lead` successfully assigns a lead and writes to `lead_assignment_history`
- [ ] `POST /auto-lead-routing/route/:leadId` respects rep capacity and skill match
- [ ] `POST /auto-lead-routing/route-batch` handles 50+ leads per request
- [ ] Routing config PUT updates the single config row; GET returns latest
- [ ] Territory CRUD happy path works including geographic boundaries (if used)

### Security / RLS
- [ ] RLS on all 7 assignment tables
- [ ] Two-tenant test: assignment rule created by tenant A not visible to tenant B
- [ ] Rep capacity values cannot be modified cross-tenant

### Frontend compatibility
- [ ] `TerritoryManagement.tsx` loads, list renders, create/edit/delete works
- [ ] `AutoLeadRoutingDashboard.tsx` renders charts, config save persists
- [ ] "Assign" action from lead list invokes `/api/assign-lead` successfully
- [ ] Playwright MCP smoke pass on all 3 pages

### Deletion
- [ ] `server/routes-lead-assignment.ts` deleted
- [ ] `server/routes-auto-lead-routing.ts` deleted
- [ ] `server/routes-territory-management.ts` deleted
- [ ] `server/services/auto-lead-routing-service.ts` deleted (logic in `_engine.ts`)
- [ ] `server/services/territory-management-service.ts` deleted (logic in `_territory.ts`)
- [ ] Duplicate / deprecated edge functions removed from Coolify config:
  - `lead-assignment-rules/`, `lead-assignment-queue/`, `lead-assignment-history/`, `assign-lead/`, `auto-lead-routing/`, `sales-territories/`, `territories/`, `user-assignments/`
  - Each becomes a handler module inside the canonical `lead-assignment/`
- [ ] Route registry entries removed
- [ ] Zero `grep -r` hits for the deleted filenames

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 7. Test plan

### Unit (Deno)
- `_engine.test.ts` — routing algorithm with fixture reps + leads. Cover: round-robin wrap-around, capacity exhaustion, skill match precedence.
- `_territory.test.ts` — zip/region matching logic.

### Integration
- Local: assign 10 fixture leads, verify deterministic distribution matches Express output.
- Route-batch: 100-lead batch, measure p95 latency (< 2s target).

### Production smoke
- `TerritoryManagement` — create a territory, attach reps, save, refresh, verify.
- `AutoLeadRoutingDashboard` — read metrics, flip config, confirm persisted.
- Lead list `/leads` → click "Auto-assign" on a lead → confirm user assigned in DB.

---

## 8. Rollback

Complex. Three levels:

1. **Canonical function regresses** — revert PR, canonical `lead-assignment/` returns to pre-consolidation state. Frontend pages break until next deploy.
2. **Duplicate edge functions already deleted** — revert also restores them via git history, but Coolify needs a redeploy. Order matters: delete duplicates in a second PR after canonical is proven stable for 48h.
3. **Schema / RLS changes** — none in this PRD; rollback is code-only.

**Deploy order:**
- PR 1: land canonical `lead-assignment/` covering all 46 endpoints. Traffic still flows to the old duplicate edge functions (they remain).
- PR 2 (after 48h stable): delete the duplicate edge functions + Express files.

---

## 9. Open questions

1. **`territories/` vs. `sales-territories/` edge functions — same data or different?** Audit step resolves; likely `territories/` is legacy and can be dropped.
2. **Is `routing_config` tenant-singleton or per-user?** Schema inspection during audit. Affects whether GET is tenant-scoped or user-scoped.
3. **Does round-robin anchor survive multiple edge function instances?** Deno is short-lived per-request; anchor must be DB-backed (it is — `last_assigned_user_id` in config). Confirm atomic update (SELECT FOR UPDATE or row-level increment) to prevent double-assignment under concurrency.
4. **Territory geographic matching — do we use PostGIS or simple zip-code lookup?** If PostGIS, confirm the Supabase Postgres has `postgis` extension enabled.
5. **`routes-territory-management.ts` endpoint paths** — the mount prefix isn't visible in the file itself; confirm from `server/routes-registry.ts` before audit.

---

## 10. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dedup misses a subtle divergence between edge + express versions | High | Medium | Require a line-by-line diff in audit doc; explicitly call out every `both-diverged` row |
| Round-robin concurrency race under load | Low | High | Use `UPDATE routing_config SET last_assigned_user_id = ... WHERE tenant_id = ... RETURNING ...` (atomic) |
| PostGIS not enabled in Supabase | Unknown | Medium | Check `SELECT * FROM pg_extension` during audit; if absent, either enable or fall back to zip-based matching |
| Frontend calls an edge function path that moves mid-migration | Medium | Medium | Keep deprecated edge functions alive during Phase 1 of the rollout; delete only after canonical is stable |
| Routing batch hits Deno memory ceiling on large tenants | Low | Medium | Hard cap at 200 leads per batch; document in handler |

---

## 11. Definition of done

- [ ] Single canonical `supabase/functions/lead-assignment/` covers all formerly-split lead-assignment traffic
- [ ] 8 duplicate / auxiliary edge functions deleted from deployment
- [ ] 3 Express route files + 2 services deleted
- [ ] RLS verified on all assignment tables
- [ ] Territory / auto-routing / queue / direct-assign flows all work end-to-end in prod
- [ ] Type checks + build pass
- [ ] 72 hours stable before Phase 3 moves to US-014
