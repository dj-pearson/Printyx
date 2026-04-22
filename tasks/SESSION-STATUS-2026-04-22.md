# Session Status — 2026-04-22

Long session today. Built the Outreach feature end-to-end, hit production breakage from the Express/Edge-Functions hybrid, wrote a 15-week migration plan, and started executing Phase 1 + Phase 2. Phase 1 is **proven in production**. Phase 2 (Outreach → Edge Function) is ~40% done.

---

## What's shipped and working in production

### ✅ Outreach module (Express-backed — interim)

Full-stack implementation of the AI-assisted outbound email/LinkedIn drafting tool you asked for. Runs today against the Express routes (which exist on disk but aren't deployed). Will be unreachable in prod until Phase 2 migration finishes.

- **Backend**: `server/routes/outreach-routes.ts` (22 endpoints), `server/services/outreach/outreach-ai-service.ts`, `server/services/outreach/specialty-knowledge-packs.ts`
- **Schema**: `shared/outreach-schema.ts` → 6 tables, migration `drizzle/migrations/0006_certain_jean_grey.sql` applied
- **Frontend**: 5 pages under `client/src/pages/outreach/` — Hub, BusinessContext, MySpecialty, SequenceStudio, DraftGenerator. All lazy-loaded from `App.tsx`, sidebar entry in `RoleAwareCollapsibleSidebar.tsx`
- **RLS**: Applied to all 6 outreach tables via `drizzle/rls/outreach.sql`

### ✅ Phase 1 foundation (Edge Functions migration)

Proven end-to-end. `https://functions.printyx.net/db-probe` returns 200 with tenant + all 6 outreach tables reachable.

- **`supabase/functions/_shared/db.ts`** — `getDb()` returns Supabase JS client (service-role). `getUserDb(jwt)` returns user-scoped client with RLS. Drizzle-in-Deno path was abandoned after discovering Supavisor's non-standard SSL handshake crashes `postgres-js` on Deno 1.38.5. Decision doc in `_shared/README.md`.
- **`supabase/functions/_shared/auth.ts`** — `requireAuth(req)` returns `{userId, tenantId, email, jwt, supabaseUser}`. Verifies JWT via Supabase, resolves tenant from `app_metadata.tenantId` with DB fallbacks.
- **`supabase/functions/_shared/http.ts`** — `jsonResponse`, `errorResponse`, `validateBody`, `validateQuery`, `generateRequestId`.
- **`supabase/functions/_shared/logger.ts`** — Structured JSON logs to stdout.
- **`supabase/functions/_shared/case.ts`** — `toCamel` / `toSnake` key converters for DB ↔ frontend.
- **`supabase/functions/_shared/anthropic.ts`** — Deno fetch wrapper for Claude API.
- **`supabase/functions/db-probe/index.ts`** — Proof-of-life endpoint, confirms auth + DB + all outreach tables.
- **`drizzle/rls/`** — Template + apply-rls.sql helper + outreach.sql + README.
- **`scripts/check-schema-deno-portable.ts`** — Validator, 61 schema files clean.

### ✅ Infrastructure fixes

- Dockerfile port 3001 → 8000 to match Coolify's healthcheck
- Fixed the Deno `server.ts` default port
- Fixed chart+Radix chunk-split TDZ bugs in `vite.config.ts` (two separate fixes)
- Fixed Radix `<Select.Item value="">` crash in DraftGenerator

### ✅ Planning docs in `tasks/`

- `prd-edge-functions-migration.md` — master PRD (29 user stories, 15-week timeline, architectural patterns, rollback per phase)
- `prd-migration-phase-1-foundation.md` — Phase 1 detail (US-001 through US-006, all done)
- `prd-migration-outreach.md` — Outreach migration (pattern-setter, currently executing)
- `prd-migration-apollo-reconcile.md` — Phase 2 overlap reconciliation
- `prd-migration-billing-reconcile.md` — same
- `prd-migration-knowledge-base-reconcile.md` — same
- `prd-migration-performance-reconcile.md` — same

---

## Phase 2: Outreach migration — in progress

Per `tasks/prd-migration-outreach.md`. Ports the 22 Express endpoints to `supabase/functions/outreach/`.

### Done

| File | Status |
|---|---|
| `supabase/functions/_shared/anthropic.ts` | ✅ Written |
| `supabase/functions/outreach/specialty-knowledge-packs.ts` | ✅ Ported (with `OutreachSpecialty` type inlined — no shared/ import in Deno) |
| `supabase/functions/outreach/_ai.ts` | ✅ Ported — `generateSequence`, `generateDraft`, `lintForSpam`, prompt builders |
| `supabase/functions/outreach/_types.ts` | ✅ `HandlerContext` type |
| `supabase/functions/outreach/handlers/business-context.ts` | ✅ Written — GET effective, GET /all, PUT (with Zod validation + case conversion) |
| `supabase/functions/outreach/handlers/specializations.ts` | ✅ Written — GET /specialties, GET, PUT bulk replace |

### Remaining

In the task list (task IDs 29–32):

| Task | Scope |
|---|---|
| **Sequences handlers** | GET list, GET /:id (with steps), POST /generate (AI), PATCH /:id, DELETE /:id, PATCH /sequence-steps/:id |
| **Prospects handlers** | GET list, POST, PATCH /:id, DELETE /:id |
| **Drafts handlers** | POST /generate (AI), GET list with prospect hydration, PATCH /:id, POST /:id/mark-sent, POST /:id/mark-replied, DELETE /:id |
| **Dispatcher** | `outreach/index.ts` — URL routing, feature flag gate, error handling |
| **Delete Express outreach** | Remove `server/routes/outreach-routes.ts`, `server/services/outreach/*`, route registration |

Once those ship, `functions.printyx.net/outreach/*` will replace the currently-unreachable `/api/outreach/*` Express paths — no frontend changes required because the path shape is preserved.

---

## Key decisions made today

1. **Deno edge functions use Supabase JS client, not Drizzle** — `postgres-js` crashes on Supavisor's non-standard SSL handshake; `deno-postgres` also rejects. Revisit direct Postgres access when Deno is safe to upgrade from 1.38.5.
2. **Drizzle schemas stay as source of truth** — they generate migrations and provide TypeScript types. Edge functions import types only (actually, today they inline mirror because shared/ isn't copied into the container).
3. **RLS is the primary tenant isolation mechanism** — applied via `drizzle/rls/` files. Service-role client in `getDb()` bypasses it; application code still filters by tenant_id as defense-in-depth.
4. **Bite-the-bullet during migration** — broken Express routes stay broken in prod until their edge function lands. No parallel infra.
5. **`pg_cron` for scheduled jobs, Supabase Realtime for WebSockets, external API for PDF** — blocker resolutions in master PRD.
6. **15-week committed calendar** — phases with real dates, Apr 22 → Aug 11.

---

## Open items / tech debt

### Pre-existing bugs surfaced today (not blockers)

- `server/services/ai-employee-service.ts:686` TS error (pre-existing, unrelated)
- Dashboard widgets (`/api/dashboard/widgets/*`) return 404 — Express routes never migrated
- Deal-desk, proposals, pipeline-config, sales-pipeline — same story
- WebSocket at `wss://printyx.net/ws/reporting` fails — Express WS never deployed
- `PGRST205: Could not find the table 'public.platform_integrations'` / `'public.webhooks'` — PostgREST schema cache complaints from edge functions querying non-existent tables
- Cloudflare Pages `_redirects` has a self-referential `/* /index.html 200` that Cloudflare ignores

These are all tracked as migration targets in the master PRD (Phases 3–6).

### Coolify observations

- 5 unused `supabase/edge-runtime` containers running on the VPS (likely from prior Supabase projects)
- `supabase-edge-functions-qc8gw0k4...` deploys use hash-based names, search by project hash not "edge"
- Healthcheck is pinned at `localhost:8000` — matching PORT env var required

### Deferred decisions

- Deno version upgrade (1.38.5 → 1.46+) — blocked by "don't break the other 184 edge functions" risk; revisit after Phase 6
- Per-domain Coolify env var management — we keep setting env vars ad-hoc; formalize later
- RLS policy consistency check — automate in CI eventually

---

## How to resume

1. **Pick up where we left off**: start a fresh session with "resume outreach migration from tasks/SESSION-STATUS-2026-04-22.md — write the sequences, prospects, drafts handlers and the dispatcher"
2. **Child PRD `tasks/prd-migration-outreach.md`** has the full parity matrix and acceptance criteria for each endpoint
3. **Pattern to copy**: `supabase/functions/outreach/handlers/business-context.ts` is the canonical handler template. Same structure for the remaining handlers.
4. **Deploy test after each push**: `https://functions.printyx.net/db-probe` should still return 200. If it doesn't, the new code broke the container and we roll back.

---

## Env vars to preserve in Coolify

Edge functions service currently has these set — don't lose them:

```
PORT=8000
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
DATABASE_URL=postgresql://postgres:<pwd>@209.145.59.219:5433/postgres
DB_SSL_REJECT_UNAUTHORIZED=false
DB_POOL_MAX=2
LOG_LEVEL=info
CLAUDE_API_KEY=sk-ant-...   ← REQUIRED for Outreach AI generation
```

`DATABASE_URL` and `DB_*` vars are legacy from the aborted Drizzle-in-Deno path. They're not read by the current code but harmless to leave.

`CLAUDE_API_KEY` must be set before the Outreach generate-sequence/generate-draft endpoints will work. Confirm this is present.

---

## Summary for the next-you

- Outreach **works** end-to-end in code. Express backend is on disk (not deployed). Frontend is deployed.
- The Edge Functions migration is the path to make Outreach actually reachable in prod.
- Phase 1 is done; `db-probe` proves the pattern.
- Phase 2 (Outreach migration) is ~40% done — 2 of 5 handler modules written, dispatcher + 3 more handlers remain. ~2-3 hours of focused work to finish.
- Every later migration domain copies the same pattern.
- **Don't upgrade Deno**. Don't try Drizzle-in-Deno again. Path C (Supabase JS client) is the right call.
