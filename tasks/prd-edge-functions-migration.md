# PRD: Express → Supabase Edge Functions Migration (Master)

**Status:** Draft · **Owner:** Dan Pearson · **Created:** 2026-04-22 · **Target completion:** 2026-08-11 (15 weeks)

---

## 1. Introduction / Overview

Printyx currently runs a hybrid backend: a Node.js Express server (~852 handlers across 52 files) and Supabase Edge Functions (184 already deployed). Only the Edge Functions are actually reachable in production — the Express server was never deployed, leaving ~600 handlers 404ing behind the Cloudflare Pages frontend. Users notice the breakage as empty dashboard widgets, 404s from deal-desk / pipeline / proposals / outreach, and silent query failures on feature pages.

This PRD is the master plan to eliminate the hybrid: migrate every Express route to a Supabase Edge Function, reconcile the four domains that exist in both places, and sunset `server/`. Target architecture is **pure Supabase + Edge Functions + RLS** running in Deno on Coolify.

**Why now:** the half-migrated state is accelerating tech debt. Every new feature has to pick a side; the current answer is "probably Express" because the schemas and helpers live there, which deepens the divergence. Cutting over now is ~15 weeks; waiting 6 months is ~30.

---

## 2. Goals

- **Zero 404s on `/api/*` in production** for any route the frontend ships.
- **Single backend runtime** — Deno edge functions, no Node server.
- **Feature parity** — every existing user-facing feature works at least as well as today.
- **RLS everywhere** — tenant isolation enforced in the database, not in application code.
- **Drizzle preserved as schema source of truth** — the 57 schema files in `shared/` remain the single spec. Ports to Deno-compatible Drizzle; no rewrite to raw SQL.
- **`server/` directory deleted** by 2026-08-11.
- **Coolify-native deployment** — no new infra (no Railway, no new VPS, no k8s).

---

## 3. User Stories

Organized by phase. Each story is one PR or one focused session.

### Phase 1 — Foundation (Weeks 1–2: Apr 22 – May 5)

#### US-001: Drizzle runs in Deno against Supabase Postgres
**Description:** As a developer, I want a proven Drizzle client that works in a Supabase Edge Function against our Postgres at `209.145.59.219:5433`, so every future migration can reuse the pattern.

**Acceptance Criteria:**
- [ ] New file `supabase/functions/_shared/db.ts` exports a `getDb()` factory using `drizzle-orm/postgres-js` with `postgres` via `https://esm.sh/postgres@3`
- [ ] Connection uses `DATABASE_URL` env var set in Coolify
- [ ] Works against a single schema import (start with `shared/outreach-schema.ts`)
- [ ] Proof-of-life function `supabase/functions/_db_probe/index.ts` runs `select count(*) from tenants` and returns JSON
- [ ] Deployed to Coolify, returns 200 from `functions.printyx.net/_db_probe`
- [ ] Typecheck passes (deno check)

#### US-002: Auth helper for edge functions
**Description:** As a developer, I want a single `auth()` helper I call at the top of every edge function that returns `{ userId, tenantId, user }` or throws a 401/403 response.

**Acceptance Criteria:**
- [ ] New file `supabase/functions/_shared/auth.ts` exports `requireAuth(req)` returning `{ userId, tenantId, supabaseUser, jwt }`
- [ ] Verifies Supabase JWT via `supabase.auth.getUser(jwt)` using env-provided anon key
- [ ] Resolves `tenantId` from JWT `app_metadata.tenantId` first, then `x-tenant-id` header fallback
- [ ] Returns typed 401 Response if no JWT, 403 if no tenant
- [ ] Used successfully by `_db_probe` (US-001 updated) to guard access
- [ ] Typecheck passes

#### US-003: RLS helper + SQL migration template
**Description:** As a developer, I want a reusable SQL template I apply to every tenant table to enable tenant-scoped RLS, so I can't forget it on a new table.

**Acceptance Criteria:**
- [ ] New file `drizzle/rls/_template.sql` with the canonical policy (reads `auth.jwt() ->> 'app_metadata' ->> 'tenantId'` and compares to `tenant_id`)
- [ ] Policies cover SELECT, INSERT, UPDATE, DELETE with role `authenticated`
- [ ] New file `drizzle/rls/apply-rls.sql` that loops through a list of tables and applies the template (idempotent)
- [ ] Applied to `business_contexts`, `rep_specializations`, `outreach_sequences`, `outreach_sequence_steps`, `outreach_prospects`, `outreach_drafts` as proof
- [ ] Verified by running a query as an `authenticated` role JWT from tenant A and confirming it cannot see tenant B's rows
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated` applied in same migration (per your CLAUDE.md memory note)
- [ ] Documented in `drizzle/rls/README.md`

#### US-004: Shared Zod validation + error response helpers
**Description:** As a developer, I want `validateBody(schema, req)` and `errorResponse(status, message, code?, details?)` helpers so edge functions have a consistent shape.

**Acceptance Criteria:**
- [ ] New file `supabase/functions/_shared/http.ts` exports `validateBody`, `errorResponse`, `jsonResponse`
- [ ] Response format matches existing Express error shape: `{ message, code?, details?, requestId }`
- [ ] Auto-generates `requestId` via `crypto.randomUUID()`, returned in `X-Request-ID` header
- [ ] Typecheck passes

#### US-005: Logger (console + structured JSON)
**Description:** As a developer, I want a simple `log.info/warn/error/debug` helper that writes structured JSON to stdout so Coolify can surface it.

**Acceptance Criteria:**
- [ ] New file `supabase/functions/_shared/logger.ts` with `createLogger(moduleName)` matching the Node logger API signature
- [ ] Output is `{ ts, level, module, msg, requestId?, userId?, tenantId?, ...context }` JSON per line
- [ ] No external deps (no pino in Deno)
- [ ] Used in `_db_probe` for request start/end logging
- [ ] Typecheck passes

#### US-006: Drizzle schemas verified Deno-portable
**Description:** As a developer, I want confirmation that every file in `shared/**/*-schema.ts` imports only from packages that resolve in Deno (no Node-only imports like `fs`, `pg`, etc.).

**Acceptance Criteria:**
- [ ] Script `scripts/check-schema-deno-portable.ts` that scans imports and flags Node-only packages
- [ ] Report run, zero violations (or violations fixed)
- [ ] Deno import map at `supabase/functions/import_map.json` pinned: `drizzle-orm`, `drizzle-orm/pg-core`, `drizzle-orm/postgres-js`, `drizzle-zod`, `zod`, `postgres`
- [ ] A canary edge function imports `@shared/outreach-schema.ts` and compiles

### Phase 2 — Reconcile + Outreach (Weeks 3–4: May 6 – May 19)

#### US-007: Migrate `outreach/` to an edge function
**Description:** As the user, I want the Outreach module (Business Context, Specialty, Sequences, Drafts) to work in production via an edge function, so I can actually use the tool I built last week.

**Acceptance Criteria:**
- [ ] New `supabase/functions/outreach/index.ts` implements all 22 endpoints currently in `server/routes/outreach-routes.ts`
- [ ] Uses `_shared/db.ts`, `_shared/auth.ts`, `_shared/http.ts`, `_shared/logger.ts`
- [ ] RLS applied to all 6 outreach tables (US-003 ran)
- [ ] Claude API calls (generateSequence, generateDraft) work — verified by generating a real sequence and draft
- [ ] Feature flag `OUTREACH_ENABLED_TENANTS` honored
- [ ] Frontend pages (OutreachHub, BusinessContext, MySpecialty, SequenceStudio, DraftGenerator) load and function without code changes
- [ ] `server/routes/outreach-routes.ts` deleted
- [ ] `server/services/outreach/` deleted (ported to `supabase/functions/_shared/outreach/` or inlined)
- [ ] Verify in browser using dev-browser skill

#### US-008: Reconcile `apollo/` overlap
**Description:** As a developer, I want a single canonical Apollo integration so data enrichment is predictable.

**Acceptance Criteria:**
- [ ] Audit `server/routes/apollo-routes.ts` vs `supabase/functions/apollo/index.ts` — document endpoint-by-endpoint parity matrix
- [ ] Edge function becomes canonical; missing Express-only endpoints ported in
- [ ] `server/routes/apollo-routes.ts` + `server/apollo-client.ts` + `server/apollo-storage.ts` deleted
- [ ] Frontend `ApolloLeadEnrichment` and `/api/apollo/*` calls still work
- [ ] Verify in browser using dev-browser skill

#### US-009: Reconcile `billing/` overlap
**Description:** As a developer, I want one billing backend to eliminate the split between `supabase/functions/billing/`, `server/routes/advanced-billing-routes.ts`, and `server/routes/automated-billing-routes.ts`.

**Acceptance Criteria:**
- [ ] Endpoint parity matrix drafted (likely 94 total Express handlers vs X edge)
- [ ] Edge function grown to cover all 94; complex logic (meter aggregation, invoice generation) ported from `server/services/*billing*`
- [ ] RLS applied to billing tables (`invoices`, `billing_rules`, `meter_anomalies`, etc.)
- [ ] Both Express billing route files deleted
- [ ] Verify billing dashboard loads real data using dev-browser skill

#### US-010: Reconcile `knowledge-base/` overlap
**Description:** As a developer, I want one KB backend.

**Acceptance Criteria:**
- [ ] Parity matrix for `server/routes/knowledge-base-routes.ts` + `server/routes/knowledge-base-admin-routes.ts` vs `supabase/functions/knowledge-base/`
- [ ] Edge function grown to full coverage; Express files deleted
- [ ] RLS applied to KB tables
- [ ] Article list, detail, editor, bookmarks, ratings, reading history all work
- [ ] Verify in browser using dev-browser skill

#### US-011: Reconcile `performance/` overlap
**Description:** As a developer, I want one performance metrics backend.

**Acceptance Criteria:**
- [ ] Parity matrix, edge function wins, Express deleted
- [ ] Performance dashboards load
- [ ] Verify in browser using dev-browser skill

### Phase 3 — Core CRM (Weeks 5–8: May 20 – June 16)

Each story below produces one child PRD under `tasks/prd-migration-<domain>.md`. See §10 for the child-PRD schema.

#### US-012: Migrate `lead-scoring/` + `lead-intelligence/`
**Description:** Consolidate the two lead-quality subsystems into `supabase/functions/lead-scoring/`.

**Acceptance Criteria:**
- [ ] Child PRD drafted and approved: `tasks/prd-migration-lead-scoring.md`
- [ ] All endpoints in `server/routes/lead-scoring-routes.ts` + `server/routes/lead-intelligence-routes.ts` (~48 handlers) ported
- [ ] RLS on `lead_scoring_rules`, `lead_score_calculations`, `bant_qualification_criteria`, `lead_engagement_tracking`, `lead_qualification_history`
- [ ] Express route files deleted
- [ ] Lead scoring dashboard works end-to-end
- [ ] Verify in browser using dev-browser skill

#### US-013: Migrate `lead-assignment/` (merge with existing edge function)
**Description:** The lead assignment logic has 5 Express files and 4 edge functions — merge into 1 canonical.

**Acceptance Criteria:**
- [ ] Child PRD `tasks/prd-migration-lead-assignment.md`
- [ ] One `supabase/functions/lead-assignment/` that handles territories, rules, capacity, queue, history, auto-routing
- [ ] Other 4 `lead-assignment-*` edge functions either merged or documented as intentional sub-functions
- [ ] Express `lead-assignment-routes.ts`, `auto-lead-routing-service.ts`, etc. deleted
- [ ] Territory management UI, assignment queue, auto-routing all work
- [ ] Verify in browser using dev-browser skill

#### US-014: Migrate `customer-success/`
**Description:** Port customer-success-routes.ts (~90 handlers) to edge function.

**Acceptance Criteria:**
- [ ] Child PRD `tasks/prd-migration-customer-success.md`
- [ ] All customer success endpoints ported (health scores, interventions, renewals, churn predictions)
- [ ] RLS applied to relevant tables
- [ ] Customer Success dashboard works
- [ ] Verify in browser using dev-browser skill

#### US-015: Migrate `email-marketing/` + `content-gap-analysis/`
**Description:** Campaign and content routes to edge functions.

**Acceptance Criteria:**
- [ ] Child PRD `tasks/prd-migration-email-marketing.md`
- [ ] Endpoints ported; sendgrid calls swapped to fetch-based REST
- [ ] Campaigns, templates, gap analysis work
- [ ] Verify in browser using dev-browser skill

### Phase 4 — Operations (Weeks 9–12: June 17 – July 14)

#### US-016: Migrate `field-service/`
**Description:** field-service-routes.ts (~115 handlers shared with geofence, GPS, mileage, route optimization) to edge function.

**Acceptance Criteria:**
- [ ] Child PRD `tasks/prd-migration-field-service.md`
- [ ] All 5 route files (field-service, geofence-alerts, gps-tracking, mileage, route-optimization) merged into one edge function or clearly split
- [ ] Real-time technician location uses Supabase Realtime (postgres_changes on `technician_locations`) — no WebSocket server
- [ ] Mobile field app continues to work
- [ ] Verify in browser using dev-browser skill
- [ ] Verify on mobile device

#### US-017: Migrate `leases/` + `manufacturer-orders/`
**Description:** Lease management and manufacturer order routes.

**Acceptance Criteria:**
- [ ] Child PRDs `tasks/prd-migration-leases.md`, `tasks/prd-migration-manufacturer-orders.md`
- [ ] Endpoints ported, PDF generation (leases) moved to external Browserless.io API OR `https://esm.sh/pdf-lib` for simple PDFs
- [ ] Lease viewer, lease form, PDF export all work
- [ ] Manufacturer order dashboard works
- [ ] Verify in browser using dev-browser skill

#### US-018: Migrate `task-routes.ts` + `team-collaboration-routes.ts`
**Description:** Task and collaboration endpoints. Already partially covered by edge `tasks/`, `tasks-enhanced/`, `tasks-bulk/`, etc. — consolidate.

**Acceptance Criteria:**
- [ ] Child PRD `tasks/prd-migration-tasks-collab.md`
- [ ] Parity matrix across Express + 5 existing task-related edge functions
- [ ] Consolidated architecture documented (1 function or clean sub-functions)
- [ ] Task Hub, team alerts, etc. work
- [ ] Verify in browser using dev-browser skill

#### US-019: Migrate `signature-routes.ts`
**Description:** E-signature integration port.

**Acceptance Criteria:**
- [ ] Child PRD
- [ ] Endpoints ported; DocuSign/HelloSign REST calls via fetch
- [ ] ESignatureIntegration page works
- [ ] Verify in browser using dev-browser skill

### Phase 5 — Integrations & AI (Weeks 13–14: July 15 – July 28)

#### US-020: Migrate `ai-documentation` + `ai-employee` + `ai-search-knowledge`
**Description:** AI subsystem port.

**Acceptance Criteria:**
- [ ] Child PRD `tasks/prd-migration-ai-features.md`
- [ ] Endpoints ported; Anthropic Claude calls work in Deno (plain fetch)
- [ ] OpenAI calls (if any) swapped to fetch
- [ ] AI Hub pages all functional
- [ ] Verify in browser using dev-browser skill

#### US-021: Migrate auth/security routes
**Description:** `sso-routes.ts`, `mfa-routes.ts`, `api-key-routes.ts`.

**Acceptance Criteria:**
- [ ] Child PRDs for each
- [ ] SSO (SAML, OIDC) providers continue to work — Supabase SSO may replace custom SAML code
- [ ] MFA TOTP generation via fetch to external TOTP library (`https://esm.sh/otpauth`)
- [ ] API key management page works
- [ ] Verify in browser using dev-browser skill

#### US-022: Migrate `calendar` + `meeting-scheduling` + `advanced-scheduling` + `meeting-transcription`
**Description:** Scheduling family.

**Acceptance Criteria:**
- [ ] Child PRD `tasks/prd-migration-scheduling.md`
- [ ] Calendar integrations (Google, Microsoft) via REST
- [ ] Meeting transcription migrated (check blocker: Whisper, etc.)
- [ ] Calendar page, meeting scheduler work
- [ ] Verify in browser using dev-browser skill

### Phase 6 — Admin, Reports, Sunset (Weeks 15: July 29 – Aug 11)

#### US-023: Migrate custom reporting (8 domain APIs)
**Description:** `director-reports-api`, `executive-reports-api`, `sales-reports-api` (5), etc.

**Acceptance Criteria:**
- [ ] Child PRD `tasks/prd-migration-reports.md`
- [ ] All 8 report domain endpoints ported — complex queries may need raw SQL in Drizzle
- [ ] Report definitions, KPIs, scheduled reports all work
- [ ] Verify in browser using dev-browser skill

#### US-024: Migrate admin routes
**Description:** `admin-seed-routes.ts`, `chrome-extension-routes.ts`, etc.

**Acceptance Criteria:**
- [ ] Endpoints ported
- [ ] Admin hub, RBAC, platform admin pages work
- [ ] Verify in browser using dev-browser skill

#### US-025: Migrate content/engagement routes
**Description:** `article-bookmarks`, `article-ratings`, `reading-history`.

**Acceptance Criteria:**
- [ ] Endpoints ported (likely merge into existing `knowledge-base/` edge function)
- [ ] Article page bookmarks, ratings, history work
- [ ] Verify in browser using dev-browser skill

#### US-026: Convert Node cron jobs to Supabase pg_cron
**Description:** ~30+ Express routes reference `node-cron`. Move every recurring job to `pg_cron`.

**Acceptance Criteria:**
- [ ] Inventory of current cron schedules (grep `cron.schedule`)
- [ ] Each schedule represented as a `pg_cron` job in `drizzle/cron/*.sql`
- [ ] Jobs call edge functions via `pg_net.http_post` OR execute pure SQL where possible
- [ ] Schedule table documented in `drizzle/cron/README.md`
- [ ] `node-cron` removed from package.json

#### US-027: Migrate WebSocket features to Supabase Realtime
**Description:** `server/websocket-service.ts` + `/ws/reporting` dies.

**Acceptance Criteria:**
- [ ] Frontend `useWebSocket` hook replaced with Supabase Realtime subscription hook
- [ ] Real-time reporting widget uses `postgres_changes` subscription on relevant tables
- [ ] Custom notifications use Realtime `broadcast` channels
- [ ] Verify reporting updates live using dev-browser skill

#### US-028: Delete `server/` directory
**Description:** The big sunset.

**Acceptance Criteria:**
- [ ] `grep -r "from '../../server'"` returns nothing in `client/` and `supabase/functions/`
- [ ] `server/` directory deleted
- [ ] `Dockerfile` deleted (only `Dockerfile.edge-functions` remains)
- [ ] `k8s/` directory deleted
- [ ] Node-only packages removed from `package.json` (express, pg, drizzle-orm/node-postgres dep path, pino, etc.)
- [ ] Dev server still runs for frontend-only work (`npm run dev:frontend`)
- [ ] Build still passes
- [ ] Final commit: `chore: remove Express server — pure Edge Functions now`

#### US-029: Update frontend routing rules
**Description:** Simplify `client/src/lib/config.ts` — no more hybrid routing since there's only one backend.

**Acceptance Criteria:**
- [ ] `/api/*` always maps to `functions.printyx.net/*` in production
- [ ] Any temporary Edge-Function-allowlist logic removed
- [ ] Dev proxy in `vite.config.ts` still works for local edge function testing via Supabase CLI

---

## 4. Functional Requirements

### Architecture
- **FR-1:** All backend API endpoints run as Supabase Edge Functions in Deno runtime (1.38.5+).
- **FR-2:** All tenant-scoped tables enforce isolation via RLS policies (not application-level filtering).
- **FR-3:** Every edge function uses the shared utilities: `_shared/db.ts`, `_shared/auth.ts`, `_shared/http.ts`, `_shared/logger.ts`.
- **FR-4:** Drizzle schema files in `shared/**/*-schema.ts` are the single source of truth for DB structure and types; they must remain Deno-importable.
- **FR-5:** All schema changes go through Drizzle migrations (`npm run db:generate` + `db:migrate`), followed by an RLS policy SQL file under `drizzle/rls/`.

### Auth
- **FR-6:** Every non-health endpoint calls `requireAuth(req)` before any business logic.
- **FR-7:** `tenantId` resolution order: JWT `app_metadata.tenantId` → `x-tenant-id` header → error.
- **FR-8:** Service-role key is ONLY used inside edge functions, never exposed to the frontend.

### Data access
- **FR-9:** Edge functions connect to Postgres via `drizzle-orm/postgres-js` using a pooled `postgres` client.
- **FR-10:** No raw service-role Supabase JS queries for tenant tables unless intentionally bypassing RLS (admin functions only, documented).
- **FR-11:** Every `INSERT`/`UPDATE`/`DELETE` must either rely on RLS or explicitly set `tenant_id` from `requireAuth`.

### Cron
- **FR-12:** All recurring jobs scheduled via `pg_cron` in Supabase. Jobs live in `drizzle/cron/*.sql`.
- **FR-13:** If a cron job needs to call an edge function, it uses `pg_net.http_post` with an internal bearer token.

### Realtime
- **FR-14:** Live data updates (reporting dashboards, notifications) use Supabase Realtime `postgres_changes` where a table-update trigger suffices.
- **FR-15:** Application-originated events (e.g., a user clicked a button and five dashboards should refresh) use Realtime `broadcast` channels.

### Error handling
- **FR-16:** Error response shape: `{ message: string, code?: string, details?: object, requestId: string }` with appropriate HTTP status.
- **FR-17:** Every request generates a `requestId` and includes it in the `X-Request-ID` response header and in every log line emitted during the request.

### Deployment
- **FR-18:** Only `Dockerfile.edge-functions` is used for production builds. The standalone `Dockerfile` is deleted at sunset.
- **FR-19:** Coolify auto-deploys `main` branch on push; no manual promotion step.

---

## 5. Non-Goals (Out of Scope)

- **NOT re-architecting the frontend.** React + Wouter + TanStack Query stays as-is.
- **NOT rewriting Drizzle schemas** in a different ORM. They are the keep-list.
- **NOT running Express in parallel** during migration (per 1B decision). Broken endpoints stay 404 until their edge function ships.
- **NOT migrating to a hosted Supabase.** Self-hosted Supabase on Coolify stays.
- **NOT introducing a BFF or GraphQL layer.** Frontend hits edge functions directly.
- **NOT changing auth provider.** Supabase GoTrue JWTs remain.
- **NOT adding new features** during migration weeks. If a feature request lands, either (a) land it on the Express side knowing it'll migrate with its domain, or (b) land it directly as an edge function following the target pattern. No mid-migration scope creep.
- **NOT optimizing for multi-region deployment yet.** Single Coolify instance.
- **NOT introducing a queue/worker system** beyond `pg_cron`. If a job needs more, we document it as a post-migration follow-up.
- **NOT changing pricing / billing model** — this is purely an infra migration, invisible to end users.

---

## 6. Design Considerations

### Target `_shared/` layout

```
supabase/functions/
├── _shared/
│   ├── db.ts           # getDb() factory (Drizzle + postgres-js)
│   ├── auth.ts         # requireAuth(req), optional auth variants
│   ├── http.ts         # jsonResponse, errorResponse, validateBody
│   ├── logger.ts       # createLogger(module)
│   ├── cors.ts         # (already exists)
│   ├── supabase.ts     # (already exists; for service-role client)
│   ├── realtime.ts     # broadcast channel helpers
│   ├── anthropic.ts    # Claude API wrapper (replaces server/services/claude-ai-service.ts)
│   ├── sendgrid.ts     # Email wrapper (replaces server/services/email-service.ts)
│   └── ...             # other external-service wrappers as needed
├── outreach/
│   └── index.ts        # single function, URL-path routing inside
├── lead-scoring/
│   └── index.ts
└── ...
```

### Canonical edge function skeleton

```typescript
// supabase/functions/<domain>/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { eq, and } from 'drizzle-orm';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, jsonResponse, validateBody } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { outreachSequences, insertOutreachSequenceSchema } from '../../../shared/outreach-schema.ts';

const log = createLogger('outreach');

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = crypto.randomUUID();

  try {
    const { userId, tenantId } = await requireAuth(req);
    log.info({ requestId, userId, tenantId }, req.method + ' ' + new URL(req.url).pathname);

    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    // /outreach/sequences or /outreach/sequences/:id
    const resource = parts[1];
    const id = parts[2];

    const db = getDb();

    if (resource === 'sequences' && req.method === 'GET' && !id) {
      const rows = await db
        .select()
        .from(outreachSequences)
        .where(and(
          eq(outreachSequences.tenantId, tenantId),
          eq(outreachSequences.userId, userId),
        ));
      return jsonResponse({ sequences: rows }, 200, requestId);
    }

    // ...other routes

    return errorResponse(404, 'Not found', 'NOT_FOUND', undefined, requestId);
  } catch (err) {
    log.error({ requestId, err: String(err) }, 'Request failed');
    return errorResponse(500, 'Internal error', 'INTERNAL', undefined, requestId);
  }
});
```

### RLS policy template

```sql
-- drizzle/rls/_template.sql — applied to every tenant_id-bearing table
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON <table_name> TO authenticated;

CREATE POLICY "<table_name>_tenant_select"
  ON <table_name> FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenantId'));

CREATE POLICY "<table_name>_tenant_insert"
  ON <table_name> FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenantId'));

CREATE POLICY "<table_name>_tenant_update"
  ON <table_name> FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenantId'))
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenantId'));

CREATE POLICY "<table_name>_tenant_delete"
  ON <table_name> FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenantId'));
```

### Blocker resolutions

| Blocker | Resolution |
|---|---|
| WebSockets (`server/websocket-service.ts`, `/ws/reporting`) | **Supabase Realtime**. For "this row changed" → `postgres_changes`. For application-custom events → `broadcast` channels. |
| Cron jobs (30+ `node-cron` call sites) | **pg_cron**. One SQL schedule file per domain in `drizzle/cron/`. Complex jobs use `pg_net.http_post` to fire an edge function. |
| Puppeteer (PDF generation, scraping) | **External API**. Browserless.io (cloud) for browser-based PDF; `@supabase/storage-js` via esm.sh for S3-compatible storage. Simple PDFs use `pdf-lib` via esm.sh (pure JS, works in Deno). |
| Node-only packages | pino → custom JSON logger; imap → Gmail REST API; jsforce → Salesforce REST; nodemailer → SendGrid REST; node-postgres → postgres-js. |

### Frontend routing implication

Per decision 1B, we **do not keep Express running** during migration. The frontend's `getApiUrl()` in `client/src/lib/config.ts` already routes `/api/*` to `functions.printyx.net` with the `/api/` prefix stripped — that's correct for the end state. **No frontend changes are required as part of this migration**, except US-029 cleanup at sunset.

---

## 7. Technical Considerations

### Dependencies & compatibility
- Deno 1.38.5 (pinned by `Dockerfile.edge-functions`); monitor for Deno 2.x upgrade post-migration.
- Drizzle + `postgres-js` tested compatible with Deno via esm.sh.
- Postgres 15+ required for `pg_cron`, `pg_net`, `auth.jwt()` helpers (Supabase provides).

### Environment variables (Coolify secrets)
Required in every edge function deployment:
- `DATABASE_URL` — Supabase pooler connection string
- `SUPABASE_URL` — `https://api.printyx.net`
- `SUPABASE_ANON_KEY` — public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key
- `CLAUDE_API_KEY` — Anthropic
- `SENDGRID_API_KEY` — email
- `BROWSERLESS_TOKEN` — if Browserless.io is chosen for PDF
- `OUTREACH_ENABLED_TENANTS` — feature flag (transitional)
- Add-on keys per domain (QuickBooks, Salesforce, etc.)

### Performance
- Cold start budget: < 500ms per edge function (Deno + Drizzle import).
- DB pool: `max: 2` per edge function instance (Deno instance is short-lived; small pool).
- Preserve request ID propagation through all log lines for debuggability.

### Security
- Service-role key NEVER returned to client.
- RLS is the primary tenant isolation mechanism. Application filters are defense-in-depth, not primary.
- JWT verification mandatory on every non-public endpoint.
- CSRF: Supabase's built-in CSRF via double-submit cookie (existing `/supabase/functions/csrf-token/`).

### Testing strategy
- **Local dev**: Supabase CLI `supabase functions serve` + local Postgres with RLS applied.
- **Unit tests**: Deno's built-in test runner (`deno test`) for pure logic modules.
- **Integration tests**: HTTP tests that hit the local function with JWT, verify response + DB state.
- **End-to-end**: Existing Playwright tests must continue to pass against production after each phase.

### Rollback
Every phase ships behind its own migrated edge function. Rollback per phase:
1. Revert the PR that added the edge function (Coolify redeploys automatically)
2. The previous state (Express 404'ing in prod) returns — same as before migration
3. RLS policies stay on (they don't break reads, just filter)
4. Drizzle migrations are additive; no schema rollback needed

This means **no phase has a downgrade-hurts-data failure mode**. The only risk is the domain returning to its pre-migration broken state, which is the baseline.

---

## 8. Success Metrics

- **Primary:** Zero 404s on `/api/*` endpoints referenced by the frontend in production, measured by a canary script that hits every route the app calls during a typical user session.
- **Primary:** `server/` directory has 0 files by 2026-08-11.
- **Secondary:** Every tenant table has RLS enabled (verified by `SELECT * FROM pg_tables WHERE rowsecurity = false AND tablename LIKE '%tenant%'` returning 0).
- **Secondary:** P95 edge function latency < 500ms for read endpoints, < 1500ms for write endpoints.
- **Secondary:** No new Express route added after Phase 1 (tracked in PR reviews).
- **Tracking:** Per-phase checklist tracked as GitHub Issues (1 issue per US-00x).

---

## 9. Open Questions

1. **Which PDF generation approach for leases?** Browserless.io ($50/mo, full Chromium) vs `pdf-lib` (free, limited styling). TBD in US-017.
2. **SSO provider migration strategy.** Is Supabase SSO (enterprise tier) an option, or do we keep custom SAML/OIDC code and port it to Deno? TBD in US-021.
3. **Meeting transcription — what service?** Whisper API (OpenAI) via fetch, or Deepgram? Depends on current `server/services/meeting-transcription-service.ts` implementation. TBD in US-022.
4. **Report builder complex queries.** Some custom reports use Drizzle query builder for joins across 5+ tables. Does Drizzle-in-Deno handle this performantly, or do we fall back to raw SQL per report? Spike in US-023.
5. **Mobile field app real-time.** Current WebSocket usage patterns in the mobile flow need audit to confirm Realtime `postgres_changes` is sufficient. Spike in US-016.
6. **Ralph automation.** Do we convert these per-domain PRDs to `prd.json` for autonomous execution, or review each child PRD manually before coding? Decision point after US-007 (first migrated domain) proves the pattern.

---

## 10. Child PRD Schema

Each domain migration gets a child PRD at `tasks/prd-migration-<domain>.md` using this template:

```markdown
# PRD: Migrate <domain> to Edge Function

**Parent:** prd-edge-functions-migration.md · **Phase:** N · **Week:** W

## 1. Scope
- Source Express files: <list>
- Target edge function: `supabase/functions/<name>/`
- Handler count: <N>

## 2. Endpoint parity matrix
| Method | Path | Express location | Target edge path | Notes |
|---|---|---|---|---|

## 3. Tables touched + RLS plan
- Tables: <list>
- RLS policies file: `drizzle/rls/<domain>.sql`

## 4. External dependencies to port
- <e.g. Anthropic SDK → fetch wrapper in _shared/anthropic.ts>

## 5. Acceptance criteria
- [ ] All N endpoints return 200/expected status on happy path
- [ ] RLS verified: tenant A cannot see tenant B's rows
- [ ] Frontend pages <list> load and function
- [ ] Typecheck passes (deno check)
- [ ] Express file(s) deleted
- [ ] Verify in browser using dev-browser skill

## 6. Test plan
- Manual tests: <list>
- E2E tests affected: <list from tests/>

## 7. Rollback
Revert the edge function PR; domain returns to pre-migration 404 state.

## 8. Open questions
- <domain-specific>
```

---

## 11. Timeline Summary

| Phase | Weeks | Dates | Deliverable |
|---|---|---|---|
| 1 Foundation | 1–2 | Apr 22 – May 5 | `_shared/` utilities, RLS template, Drizzle-in-Deno proven |
| 2 Reconcile + Outreach | 3–4 | May 6 – May 19 | 4 overlapping domains merged + Outreach migrated |
| 3 Core CRM | 5–8 | May 20 – Jun 16 | Lead scoring, assignment, customer success, email marketing |
| 4 Operations | 9–12 | Jun 17 – Jul 14 | Field service, leases, manufacturer, tasks, signatures |
| 5 Integrations & AI | 13–14 | Jul 15 – Jul 28 | AI features, SSO/MFA/API keys, scheduling, meetings |
| 6 Admin, Reports, Sunset | 15 | Jul 29 – Aug 11 | Reports, admin, content, cron, WebSockets → Realtime, `server/` deleted |

---

## 12. Next Actions

1. Review this master PRD; adjust anything out of line before code starts.
2. Green-light Phase 1 (US-001 through US-006).
3. Convert this master PRD to `prd.json` (Ralph format) if we want autonomous per-phase execution, or work through user stories manually.
4. Generate child PRDs in order as each phase begins (don't write them all upfront — keeps the spec flexible as we learn from early phases).
