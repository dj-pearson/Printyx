# PRD: Phase 1 — Foundation (Deno Shared Utilities)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 1 · **Weeks:** 1–2 (Apr 22 – May 5) · **Owner:** Dan Pearson

---

## 1. Scope

Everything downstream depends on this phase. No domain migration starts until these utilities land and are proven against one real workload (`_db_probe`).

**Deliverables:**
- `supabase/functions/_shared/db.ts` — Drizzle + postgres-js client factory
- `supabase/functions/_shared/auth.ts` — JWT verification + tenant resolution
- `supabase/functions/_shared/http.ts` — response helpers + Zod validation
- `supabase/functions/_shared/logger.ts` — structured JSON logger
- `supabase/functions/import_map.json` — pinned Deno imports
- `drizzle/rls/_template.sql` + `drizzle/rls/README.md` — RLS policy template + application script
- `supabase/functions/_db_probe/index.ts` — proof-of-life endpoint using all of the above
- `scripts/check-schema-deno-portable.ts` — validator that shared schemas import cleanly in Deno

**Explicitly NOT in this phase:**
- Any domain migration (Phase 2+)
- CRON migration (US-026 in master, runs in Phase 6)
- Realtime migration (US-027, Phase 6)
- Anthropic / SendGrid / etc. service wrappers (added in the phases that need them)

---

## 2. Environment + infrastructure prerequisites

### Coolify Edge Function container env vars
Must be set before deploying:

| Var | Value | Why |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres?sslmode=require` | Drizzle connection |
| `SUPABASE_URL` | `https://api.printyx.net` | For JWT verification |
| `SUPABASE_ANON_KEY` | (existing) | JWT verification |
| `SUPABASE_SERVICE_ROLE_KEY` | (existing) | Admin queries that bypass RLS (avoid unless necessary) |
| `PGSSL_REJECT_UNAUTHORIZED` | `false` | Self-signed cert on internal VPS |

### Deno runtime
`Dockerfile.edge-functions` pins Deno 1.38.5. Confirm it's current; consider bumping to 1.45+ for better Drizzle compatibility (validate in spike during US-001).

---

## 3. User Stories

### US-001: Drizzle runs in Deno against Supabase Postgres

**Description:** As a developer, I want a proven Drizzle client that works inside a Supabase Edge Function against our self-hosted Postgres, so every future edge function can import a single `getDb()` helper.

**Acceptance Criteria:**
- [ ] `supabase/functions/import_map.json` created with pinned entries:
  - `drizzle-orm` → `https://esm.sh/drizzle-orm@0.29.4`
  - `drizzle-orm/pg-core` → `https://esm.sh/drizzle-orm@0.29.4/pg-core`
  - `drizzle-orm/postgres-js` → `https://esm.sh/drizzle-orm@0.29.4/postgres-js`
  - `drizzle-zod` → `https://esm.sh/drizzle-zod@0.5.1`
  - `zod` → `https://esm.sh/zod@3.22.4`
  - `postgres` → `https://esm.sh/postgres@3.4.3`
  - `@shared/` → `../../shared/` (relative resolution for schema imports)
- [ ] `supabase/functions/_shared/db.ts` exports `getDb(): PostgresJsDatabase` with pooling (`max: 2`)
- [ ] Uses `DATABASE_URL` env var; throws if unset
- [ ] SSL config: `ssl: { rejectUnauthorized: false }` when `PGSSL_REJECT_UNAUTHORIZED=false`
- [ ] New file `supabase/functions/_db_probe/index.ts` imports `getDb()` and runs a raw `sql` query (`SELECT COUNT(*) FROM tenants`)
- [ ] Deployed via Coolify; `GET https://functions.printyx.net/_db_probe` returns `{ status: 'ok', tenantCount: N }` (gated — only anon or service role key works)
- [ ] `deno check supabase/functions/_db_probe/index.ts` passes
- [ ] Dockerfile.edge-functions rebuilds with `--import-map` flag applied

**Implementation notes:**
- `postgres-js` driver is Drizzle's recommended Deno path. Confirmed compatible via esm.sh.
- Keep connection pool small (`max: 2`). Deno instances are short-lived.
- Use `{ prepare: false }` on the postgres client to avoid statement caching issues with Supabase pooler in transaction mode.

### US-002: Auth helper for edge functions

**Description:** As a developer, I want a `requireAuth(req)` helper that verifies the Supabase JWT, resolves the tenantId, and returns typed data or throws a 401/403 response.

**Acceptance Criteria:**
- [ ] `supabase/functions/_shared/auth.ts` exports `requireAuth(req: Request): Promise<AuthContext>`
- [ ] `AuthContext` type: `{ userId: string; tenantId: string; email?: string; jwt: string; supabaseUser: User }`
- [ ] Extracts JWT from `Authorization: Bearer <jwt>` header
- [ ] Verifies via `createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(jwt)`
- [ ] Throws typed `AuthError(401, 'missing_token')`, `AuthError(401, 'invalid_token')`, `AuthError(403, 'no_tenant')` — caller catches and returns appropriate Response
- [ ] Tenant resolution order:
  1. `supabaseUser.app_metadata?.tenantId`
  2. `req.headers.get('x-tenant-id')` (dev override, log a warning)
  3. Throw `no_tenant`
- [ ] Also exports `optionalAuth(req)` variant that returns `AuthContext | null` for public endpoints
- [ ] `_db_probe` updated to require auth; unauth requests get 401 with structured error body
- [ ] `deno check` passes

**Implementation notes:**
- Do NOT decode JWT locally — always call `auth.getUser()` so revocation works.
- Cache the Supabase client at module scope (reuse across requests in the same instance).

### US-003: RLS policy template + application script

**Description:** As a developer, I want a canonical RLS SQL template and an application script so I can enable tenant isolation on any table with a single function call.

**Acceptance Criteria:**
- [ ] `drizzle/rls/_template.sql` contains the canonical 4-policy template (SELECT/INSERT/UPDATE/DELETE) using `auth.jwt() -> 'app_metadata' ->> 'tenantId'`
- [ ] `drizzle/rls/apply-rls.sql` defines a Postgres function `apply_tenant_rls(table_name text)` that applies all 4 policies + `GRANT` + `ENABLE ROW LEVEL SECURITY` idempotently
- [ ] `drizzle/rls/outreach.sql` — applies RLS to all 6 outreach tables (`business_contexts`, `rep_specializations`, `outreach_sequences`, `outreach_sequence_steps`, `outreach_prospects`, `outreach_drafts`)
- [ ] `drizzle/rls/README.md` documents the pattern, the JWT shape assumption, and how to add RLS for a new table
- [ ] Applied to dev database; verified by:
  - [ ] Creating two test JWTs with different `tenantId` in `app_metadata`
  - [ ] Running `SELECT * FROM outreach_sequences` as each — results are mutually exclusive
  - [ ] Inserting with a wrong `tenant_id` is rejected
- [ ] Integration: `npm run db:migrate` followed by `psql < drizzle/rls/outreach.sql` is documented as the canonical sequence for schema changes
- [ ] Considered: using `SET LOCAL app.tenant_id = '...'` pattern for service-role queries that need to "act as" a tenant? Decision documented in README.

**Implementation notes:**
- `auth.jwt()` is a Supabase-provided function (exists in self-hosted Supabase by default).
- Policies MUST use `TO authenticated` — omitting the role grants them to every role including anon.
- GRANT statement is required in addition to the policy per your CLAUDE.md memory note on Supabase RLS gotcha.
- `apply_tenant_rls` should drop existing policies with matching names first so it's idempotent.

### US-004: Shared HTTP helpers

**Description:** As a developer, I want `jsonResponse()`, `errorResponse()`, and `validateBody()` so every edge function has a consistent response shape and validation pattern.

**Acceptance Criteria:**
- [ ] `supabase/functions/_shared/http.ts` exports:
  - `jsonResponse(data: unknown, status?: number, requestId?: string, extraHeaders?: Record<string, string>): Response`
  - `errorResponse(status: number, message: string, code?: string, details?: unknown, requestId?: string): Response`
  - `validateBody<T>(schema: ZodSchema<T>, req: Request): Promise<T>` — throws `ValidationError` on failure
  - `generateRequestId(): string` (returns `crypto.randomUUID()`)
- [ ] Response shape for errors matches Express convention: `{ message, code?, details?, requestId }`
- [ ] `X-Request-ID` header on all responses (success + error)
- [ ] CORS headers included via `../_shared/cors.ts` helpers
- [ ] `_db_probe` uses `jsonResponse` and `errorResponse`
- [ ] `deno check` passes

### US-005: Structured logger

**Description:** As a developer, I want `createLogger('module-name')` that emits structured JSON to stdout so Coolify's log viewer can parse it.

**Acceptance Criteria:**
- [ ] `supabase/functions/_shared/logger.ts` exports `createLogger(module: string)` returning `{ trace, debug, info, warn, error, fatal }`
- [ ] Each method signature: `log.info(context: object, msg: string)` OR `log.info(msg: string)` — flexible
- [ ] Output format per line: `{"ts":"2026-04-22T...","level":"info","module":"...","msg":"...","requestId?":"...","userId?":"...","tenantId?":"...",...context}`
- [ ] Level-based filtering via `LOG_LEVEL` env var (default `info`)
- [ ] No external dependencies
- [ ] `_db_probe` uses the logger at start (request received) and end (request complete, duration)
- [ ] `deno check` passes

### US-006: Schema Deno-portability validator

**Description:** As a developer, I want a script that scans every file in `shared/**/*-schema.ts` and `shared/schema.ts` for Node-only imports, so I catch portability issues before they break an edge function at deploy time.

**Acceptance Criteria:**
- [ ] `scripts/check-schema-deno-portable.ts` script exists
- [ ] Scans all `shared/*.ts` files for `import ... from '<pkg>'` and flags if `<pkg>` is in a Node-only blocklist (`fs`, `path`, `pg`, `node-postgres`, `pino`, etc.)
- [ ] Run produces a report: `OK: N schemas clean. FLAGGED: [{file, imports}]`
- [ ] Currently: 0 flagged (or all flagged items remediated)
- [ ] Added to `package.json` as `npm run check:deno-schemas`
- [ ] CI-ready (exits non-zero on flagged imports)

**Implementation notes:**
- Can be a plain Node/tsx script since it's a dev-time check; doesn't need Deno itself.
- Use `@typescript-eslint/parser` or simple regex — even regex is fine for this.

---

## 4. Acceptance test for the whole phase

Phase 1 is **DONE** when:

1. `https://functions.printyx.net/_db_probe` returns 200 with:
   - Request without auth → 401 with `{ message: 'Unauthorized', code: 'missing_token', requestId: <uuid> }`
   - Request with valid JWT → 200 with `{ status: 'ok', tenantCount: N, requestId: <uuid>, durationMs: <int> }`
2. `coolify logs` shows structured JSON log lines per request with the same requestId
3. RLS applied to 6 outreach tables; a test of cross-tenant read fails
4. `npm run check:deno-schemas` exits 0
5. A fresh developer could clone the repo, set env vars, and deploy `_db_probe` following only the README — no Slack messages

---

## 5. Rollback

Every US in this phase is independent. Rollback = revert the PR that added the file. No data migrations, no destructive operations.

RLS is additive. If RLS causes unexpected lockouts during testing, use `ALTER TABLE <name> DISABLE ROW LEVEL SECURITY` as an emergency break glass.

---

## 6. Testing strategy

- **Unit (Deno):** `deno test supabase/functions/_shared/*.test.ts` — test pure logic (no DB/network).
- **Integration (manual):** Invoke `_db_probe` locally with `supabase functions serve` against a Supabase CLI local stack.
- **Integration (prod):** curl the deployed probe with a real JWT.
- **RLS (psql):** manual SQL session impersonating `authenticated` role with different JWTs.

---

## 7. Open questions

1. **Deno version** — 1.38.5 vs bump to 1.45+? Postgres-js compat known-good on 1.45; less tested on 1.38. Confirm before rolling forward or upgrade.
2. **Should `_shared/supabase.ts` (existing) be unified with the new `_shared/auth.ts`?** The existing file creates service-role clients; the new auth helper creates anon-key clients for JWT verification. Keep separate or merge? Lean: keep separate, they serve different purposes.
3. **Connection pooler mode** — Supabase pooler supports `transaction` (PgBouncer) and `session` modes. `transaction` mode is more efficient for edge functions but breaks prepared statements. Test both and document the choice.

---

## 8. Next actions on completion

Once Phase 1 is green:
- Kick off Phase 2 child PRDs: start with `prd-migration-outreach.md` (it's the pattern proof).
- Draft Phase 2 reconciliation PRDs for apollo / billing / knowledge-base / performance overlaps.
