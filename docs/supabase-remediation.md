# Supabase Transition Remediation (SUPA-###)

Living tracker for the work stream that fixes breakage introduced when production
moved from **Neon Postgres + Express** to **self-hosted Supabase** (Edge Functions
+ Postgres pooler + GoTrue). Stories live in `prd.json` under the `SUPA-` id prefix.

## Root cause (the reframing)

Neon → Supabase was mostly a Postgres **host** swap (that part is healthy). The
breakage came from three things that rode along and were never finished:

1. **The API layer moved from Express to Supabase Edge Functions.** In production
   there is **no Express server** — the static frontend calls
   `functions.printyx.net/<fn>/*` directly (`client/src/lib/queryClient.ts` →
   `getApiUrl`; dispatcher `supabase/functions/server.ts`). `server/routes-*.ts`
   is **dev-only**. Any endpoint never ported to an edge function 404s in prod.
2. **Migration bookkeeping broke.** `drizzle/migrations/meta/_journal.json` lists
   only 12 migrations (0000–0011); files 0012–0028 + duplicate-numbered 0008–0011
   were hand-authored and never journaled, so `npm run db:migrate` applies nothing
   past 0011 → the live DB is missing schema.
3. **Pages built against mock shapes** return 200 but render blank/fake data.

Plus (4) env/auth/connection integrity (baked frontend anon key, pooler username
format, SSL).

## Breakage classes → epics

| Epic | Class | Stories |
|---|---|---|
| 1 | DB / migration reconciliation | SUPA-001..005 |
| 2 | Missing edge fns (prod 404) | SUPA-010..017 |
| 3 | Divergent Express/edge (dev≠prod) | SUPA-020..024 |
| 4 | Data-contract mismatches | SUPA-030..031 |
| 5 | Env / auth / connection | SUPA-040..041 |

## Story status

Legend: ✅ done · 🟡 in progress · ⛔ blocked-on-user · ⬜ not started

| Story | Title | Status | Notes |
|---|---|---|---|
| SUPA-000 | Tracking epic | ✅ | This doc. |
| SUPA-001 | Introspect live schema | ⛔ | Needs working direct-Postgres creds (see "Blocked" below). |
| SUPA-002 | Reconcile drizzle journal | 🟡 | File/journal reconciliation is offline-doable; final verify needs DB (SUPA-001). |
| SUPA-003 | Apply missing migrations | ⛔ | Needs backup + prod/staging DB access. HIGH RISK. |
| SUPA-004 | Remove PGRST204 fallbacks | ⬜ | Depends on SUPA-003. |
| SUPA-005 | CI guard: journal ↔ files | ✅ | `scripts/check-migration-journal.mjs` passes (40 files/40 entries) and is now wired into the CI quality gate (`npm run check:migrations`, ci.yml after check:routes). |
| SUPA-010 | Triage 45 missing-edge | 🟡 | Read-only classification, in progress via investigation. |
| SUPA-011 | Dispatcher aliases | ⬜ | Depends on SUPA-010. |
| SUPA-012 | Port: forecasting/AI | ⬜ | Depends on SUPA-010 (+ schema for some). |
| SUPA-013 | Port: service/field | ⬜ | Depends on SUPA-010. |
| SUPA-014 | Port: financial/contracts | ⬜ | Depends on SUPA-010 (+ SUPA-003). |
| SUPA-015 | Port: platform/security | ⬜ | Depends on SUPA-010. |
| SUPA-016 | Port: workflow/documents | ⬜ | Depends on SUPA-010. |
| SUPA-017 | Remove DEAD calls | ⬜ | Depends on SUPA-010. |
| SUPA-020 | Triage 59 divergent | 🟡 | Read-only classification, in progress via investigation. |
| SUPA-021 | Converge: financial | ⬜ | Depends on SUPA-020. |
| SUPA-022 | Converge: CRM/sales | ⬜ | Depends on SUPA-020. |
| SUPA-023 | Converge: service/inventory | ⬜ | Depends on SUPA-020. |
| SUPA-024 | Converge: platform/admin | ⬜ | Depends on SUPA-020. |
| SUPA-030 | Audit mock-shape pages | ⬜ | Read-only; next after triages. |
| SUPA-031 | Fix top contract mismatches | ⬜ | Depends on SUPA-030. |
| SUPA-040 | Verify prod frontend anon key | ⛔ | Needs Cloudflare/wrangler build env + prod login test. |
| SUPA-041 | Document/harden DB connection | ⛔ | Needs correct Supavisor creds to verify. |

## ⛔ Blocked-on-user — what I need from you

These cannot proceed without input; everything else is being worked autonomously.

1. **Direct-Postgres / Supavisor credentials** (unblocks SUPA-001, 041, then 002/003):
   - A `DATABASE_URL_MIGRATE` / `DIRECT_DATABASE_URL` pointing at **direct Postgres
     (usually 5432)**, not the 5433 pooler.
   - The correct Supavisor username format (`role.tenant`) for the 5433 pooler.
   - The correct `DB_SSL` / `DB_SSL_REJECT_UNAUTHORIZED` values per port.
   - Audit evidence: local probe failed with `Tenant or user not found` (5433, no
     SSL) and `server does not support SSL connections` (5433, SSL).
2. **Prod deploy / build access** (unblocks SUPA-040): which
   `VITE_SUPABASE_ANON_KEY` the deployed Cloudflare bundle was built with, and
   ability to rebuild/redeploy if stale.
3. **Explicit go-ahead + backup confirmation** before SUPA-003 applies any
   migration to a live DB (staging rehearsal first).

## Execution log

- **Iteration 1:** Created this tracker (SUPA-000 ✅). Flagged SUPA-001/003/040/041
  as blocked-on-user. Launched read-only triage of SUPA-010 (45 missing-edge) and
  SUPA-020 (59 divergent).
