# Lead Assignment — Parity Audit

**Part of:** Phase 3 US-013 · `tasks/prd-migration-lead-assignment.md`
**Status:** audit complete; canonical `supabase/functions/lead-assignment/` in progress.

Maps every endpoint across the **3 Express files** + **10 existing edge functions** to the canonical location. Follows the action plan in the parent PRD: land canonical first, leave duplicates alive for 48h soak, delete in PR 2.

---

## Current footprint

| Source | File | Lines |
|---|---|---|
| Express | `server/routes-lead-assignment.ts` | 21 endpoints, 683 loc |
| Express | `server/routes-auto-lead-routing.ts` | 6 endpoints, 343 loc |
| Express | `server/routes-territory-management.ts` | 20 endpoints, 508 loc |
| Express | `server/services/auto-lead-routing-service.ts` | routing algorithm, 585 loc |
| Express | `server/services/territory-management-service.ts` | territory matching, 681 loc |
| Edge | `supabase/functions/lead-assignment/` | 390 loc — **becomes canonical** |
| Edge | `supabase/functions/lead-assignment-rules/` | 153 loc — merge in |
| Edge | `supabase/functions/lead-assignment-queue/` | 150 loc — merge in |
| Edge | `supabase/functions/lead-assignment-history/` | 121 loc — merge in |
| Edge | `supabase/functions/assign-lead/` | 95 loc — merge in |
| Edge | `supabase/functions/auto-lead-routing/` | 252 loc — merge in |
| Edge | `supabase/functions/sales-territories/` | 168 loc — merge in |
| Edge | `supabase/functions/territories/` | 304 loc — merge in (per-territory-management) |
| Edge | `supabase/functions/user-assignments/` | 106 loc — merge in |
| Edge | `supabase/functions/rep-capacity/` | 151 loc — merge in |

**47 Express endpoints (21 + 6 + 20) + overlap in 9 edge functions.** Canonical will be a single `lead-assignment/` edge function with subpath routing.

---

## Canonical URL layout

Frontend paths stay unchanged; Cloudflare/Supabase router fans out to the canonical edge function based on prefix:

```
/api/sales-territories/*          →  lead-assignment/handlers/territories.ts
/api/lead-assignment-rules/*      →  lead-assignment/handlers/rules.ts
/api/rep-capacity/*               →  lead-assignment/handlers/capacity.ts
/api/lead-assignment-history/*    →  lead-assignment/handlers/history.ts
/api/user-assignments/*           →  lead-assignment/handlers/history.ts
/api/lead-assignment-queue/*      →  lead-assignment/handlers/queue.ts
/api/assign-lead                  →  lead-assignment/handlers/assign.ts
/api/auto-lead-routing/*          →  lead-assignment/handlers/routing.ts
/api/territories/*                →  lead-assignment/handlers/territories.ts (territory-management subset)
```

---

## Endpoint matrix

Status values: `only-express`, `only-edge`, `both-match`, `both-diverged`, `duplicate-edge` (same endpoint in 2+ edge fns).
Action values: `port-to-canonical`, `merge-edge-into-canonical`, `delete-duplicate`, `delete-express-only`.

### From `server/routes-lead-assignment.ts` (21)

| Method | Path | Express line | Edge today | Canonical handler | Status | Action |
|---|---|---:|---|---|---|---|
| GET    | `/sales-territories` | 24 | `sales-territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| GET    | `/sales-territories/:id` | 44 | `sales-territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| POST   | `/sales-territories` | 65 | `sales-territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| PUT    | `/sales-territories/:id` | 87 | `sales-territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| DELETE | `/sales-territories/:id` | 110 | `sales-territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| GET    | `/lead-assignment-rules` | 134 | `lead-assignment-rules/` | `rules.ts` | both-match | merge-edge-into-canonical |
| GET    | `/lead-assignment-rules/:id` | 154 | `lead-assignment-rules/` | `rules.ts` | both-match | merge-edge-into-canonical |
| POST   | `/lead-assignment-rules` | 175 | `lead-assignment-rules/` | `rules.ts` | both-match | merge-edge-into-canonical |
| PUT    | `/lead-assignment-rules/:id` | 197 | `lead-assignment-rules/` | `rules.ts` | both-match | merge-edge-into-canonical |
| DELETE | `/lead-assignment-rules/:id` | 220 | `lead-assignment-rules/` | `rules.ts` | both-match | merge-edge-into-canonical |
| GET    | `/rep-capacity/:userId` | 244 | `rep-capacity/` | `capacity.ts` | both-match | merge-edge-into-canonical |
| GET    | `/rep-capacity` | 265 | `rep-capacity/` | `capacity.ts` | both-match | merge-edge-into-canonical |
| POST   | `/rep-capacity` | 285 | `rep-capacity/` | `capacity.ts` | both-match | merge-edge-into-canonical |
| PATCH  | `/rep-capacity/:userId/availability` | 322 | `rep-capacity/` | `capacity.ts` | both-match | merge-edge-into-canonical |
| GET    | `/lead-assignment-history/:leadId` | 353 | `lead-assignment-history/` | `history.ts` | both-match | merge-edge-into-canonical |
| GET    | `/user-assignments/:userId` | 374 | `user-assignments/` | `history.ts` | both-match | merge-edge-into-canonical |
| POST   | `/lead-assignment-history` | 396 | `lead-assignment-history/` | `history.ts` | both-match | merge-edge-into-canonical |
| GET    | `/lead-assignment-queue` | 423 | `lead-assignment-queue/` | `queue.ts` | both-match | merge-edge-into-canonical |
| POST   | `/lead-assignment-queue` | 452 | `lead-assignment-queue/` | `queue.ts` | both-match | merge-edge-into-canonical |
| POST   | `/lead-assignment-queue/:id/process` | 474 | `lead-assignment-queue/` | `queue.ts` | both-match | merge-edge-into-canonical |
| POST   | `/assign-lead` | 505 | `assign-lead/` | `assign.ts` | both-match | merge-edge-into-canonical |

### From `server/routes-auto-lead-routing.ts` (6)

| Method | Path | Express line | Edge today | Canonical handler | Status | Action |
|---|---|---:|---|---|---|---|
| POST | `/auto-lead-routing/route/:leadId` | 31 | `auto-lead-routing/` | `routing.ts` | both-match | merge-edge-into-canonical |
| POST | `/auto-lead-routing/route-batch` | 63 | `auto-lead-routing/` | `routing.ts` | both-match | merge-edge-into-canonical |
| GET  | `/auto-lead-routing/dashboard` | 109 | `auto-lead-routing/` | `routing.ts` | both-match | merge-edge-into-canonical |
| GET  | `/auto-lead-routing/config` | 243 | `auto-lead-routing/` | `routing.ts` | both-match | merge-edge-into-canonical |
| PUT  | `/auto-lead-routing/config` | 277 | `auto-lead-routing/` | `routing.ts` | both-match | merge-edge-into-canonical |
| GET  | `/auto-lead-routing/preview/:leadId` | 306 | `auto-lead-routing/` | `routing.ts` | both-match | merge-edge-into-canonical |

### From `server/routes-territory-management.ts` (20) — mounted at `/api/territories`

| Method | Path | Express line | Edge today | Canonical handler | Status | Action |
|---|---|---:|---|---|---|---|
| GET    | `/territories/types` | 35 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| POST   | `/territories` | 42 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| GET    | `/territories` | 64 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| GET    | `/territories/:id` | 90 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| PUT    | `/territories/:id` | 112 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| DELETE | `/territories/:id` | 139 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| POST   | `/territories/match` | 158 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| POST   | `/territories/:id/assign-lead` | 179 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |
| POST   | `/territories/rules` | 211 | `territories/` | `rules.ts` (shared) | both-diverged | port-to-canonical |
| GET    | `/territories/rules` | 242 | `territories/` | `rules.ts` (shared) | both-diverged | port-to-canonical |
| GET    | `/territories/rules/:id` | 265 | `territories/` | `rules.ts` (shared) | both-diverged | port-to-canonical |
| PUT    | `/territories/rules/:id` | 287 | `territories/` | `rules.ts` (shared) | both-diverged | port-to-canonical |
| DELETE | `/territories/rules/:id` | 318 | `territories/` | `rules.ts` (shared) | both-diverged | port-to-canonical |
| GET    | `/territories/capacity/:userId` | 346 | `territories/` | `capacity.ts` (shared) | both-diverged | port-to-canonical |
| PUT    | `/territories/capacity/:userId` | 367 | `territories/` | `capacity.ts` (shared) | both-diverged | port-to-canonical |
| GET    | `/territories/capacity` | 393 | `territories/` | `capacity.ts` (shared) | both-diverged | port-to-canonical |
| POST   | `/territories/capacity/available` | 416 | `territories/` | `capacity.ts` (shared) | both-diverged | port-to-canonical |
| GET    | `/territories/history/lead/:leadId` | 443 | `territories/` | `history.ts` (shared) | both-diverged | port-to-canonical |
| GET    | `/territories/history/rep/:userId` | 464 | `territories/` | `history.ts` (shared) | both-diverged | port-to-canonical |
| GET    | `/territories/stats` | 494 | `territories/` | `territories.ts` | both-match | merge-edge-into-canonical |

**`both-diverged` rows** on `/territories/rules/*`, `/territories/capacity/*`, `/territories/history/*`: the territory-management router introduced a second copy of rules/capacity/history mounted under `/territories/*`. During audit, we confirmed these touch the **same tables** as `/lead-assignment-rules/*` etc., just with different handler code. The canonical merges them into one handler per table — the territory-prefixed paths become thin re-exports.

---

## Deploy order (from PRD §8)

**PR 1 (this session):**
- Land canonical `lead-assignment/` covering all 47 endpoints.
- Leave all 10 existing edge functions untouched so traffic keeps flowing.
- Leave 3 Express files untouched.
- Add RLS via `drizzle/rls/lead-assignment.sql`.

**PR 2 (after 48h stable):**
- Delete the 9 auxiliary edge functions (keep only canonical `lead-assignment/`).
- Delete 3 Express route files + 2 services.
- Remove `'/api/territories'` entry from `server/routes-registry.ts`.
- Remove `registerLeadAssignmentRoutes` / `registerAutoLeadRoutingRoutes` imports from `server/domains/sales.ts`.

---

## Open questions resolved during audit

From PRD §9:

1. **`territories/` vs `sales-territories/` — same data?**
   **Resolved:** different — `sales-territories` uses the `sales_territories` table (simple tenant-scoped CRUD), `territories` uses `territories` + `territory_types` + `territory_boundaries` (richer schema with geographic boundaries). Both tables exist. Canonical keeps both handlers but routes them distinctly.

2. **Is `routing_config` tenant-singleton or per-user?**
   **Resolved:** tenant-singleton. One row per tenant; `last_assigned_user_id` is the round-robin anchor.

3. **Round-robin concurrency?**
   **Resolved:** use a Postgres function with an atomic UPDATE … RETURNING to advance the anchor under a single row lock. Added to `drizzle/functions/lead-assignment.sql` as `lead_assignment_next_rep()`.

4. **PostGIS enabled?**
   **Verified present in prod.** `territories.territory_boundaries` stores GeoJSON as `jsonb`, geographic matching uses simple polygon-point checks via `ST_Contains`. `_territory.ts` will use `.rpc()` to a SECURITY INVOKER function rather than re-implementing geometry math in TS.

5. **Territory-management mount prefix?**
   **Resolved:** `/api/territories` per `server/routes-registry.ts:645`. Reflected in the matrix above.
