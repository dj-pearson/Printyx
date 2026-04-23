# Session Status — 2026-04-23 (part B, supersedes part A)

Continuation of the same day. The earlier `SESSION-STATUS-2026-04-23.md` captured Phase 2 (Outreach) finish + 8 production fixes. **This part covers Phases 3, 4, and most of 5.** Everything in the earlier doc is still valid — nothing was re-opened.

Primary working dir: `C:\Users\dpearson\Documents\Printyx`
Branch: `main`
Baseline TypeScript errors: unchanged (~6,550, all pre-existing)

---

## Run these SQL commands before resuming

All idempotent. Apply in order from psql / Supabase SQL editor against `DATABASE_URL` (the 209.145.59.219:5433 pooler). **The last three are uncommitted but the files exist on disk** — see "Uncommitted state" at the bottom.

```sql
-- Phase 3 — lead-scoring / lead-assignment / customer-success / email-marketing
\i drizzle/rls/lead-scoring-tables.sql
\i drizzle/rls/lead-scoring.sql
\i drizzle/rls/lead-assignment-tables.sql
\i drizzle/rls/lead-assignment.sql
\i drizzle/rls/customer-success-tables.sql
\i drizzle/rls/customer-success.sql
\i drizzle/rls/email-marketing-tables.sql
\i drizzle/rls/email-marketing.sql

-- Phase 4 — leases / signatures / tasks-collab / manufacturer-orders / field-service
\i drizzle/rls/leases-tables.sql
\i drizzle/rls/leases.sql
\i drizzle/rls/signatures-tables.sql
\i drizzle/rls/signatures.sql
\i drizzle/rls/tasks-collab-tables.sql
\i drizzle/rls/tasks-collab.sql
\i drizzle/rls/manufacturer-orders-tables.sql
\i drizzle/rls/manufacturer-orders.sql
\i drizzle/rls/field-service-tables.sql
\i drizzle/rls/field-service.sql

-- Phase 5 US-021 — auth-security (mfa, sso, api-keys). MUST run apply-rls.sql
-- first because auth-security.sql depends on the updated apply_tenant_rls()
-- helper that introspects tenant_id column type.
\i drizzle/rls/apply-rls.sql
\i drizzle/rls/auth-security-tables.sql
\i drizzle/rls/auth-security.sql
```

**If any prior file already ran successfully, re-running is safe** — every file uses `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and drops-then-creates policies through `apply_tenant_rls()`.

---

## What shipped in this session

Counting handlers on disk, not PRD line counts:

### Phase 3 — 4 domains + 1 admin tool (~190 endpoints)

| Domain | Edge function | Handlers | Notes |
|---|---|---:|---|
| Lead scoring | `supabase/functions/lead-scoring/` | 6 (rules, calculate, bant, engagement, analytics, intelligence) | Claude-assisted BANT extraction; scoring cache |
| Lead assignment | `supabase/functions/lead-assignment/` | 7 (assign, capacity, history, queue, routing, rules, territories) | Consolidates 9 aux edge fns + 3 Express files; `_engine.ts` owns the scoring math |
| Customer success | `supabase/functions/customer-success/` | 5 (health-scores, churn-predictions, interventions, journeys, renewals) | Health score = weighted sum; churn uses rule-based tiers, not ML |
| Email marketing | `supabase/functions/email-marketing/` | 8 (campaigns, events, lists, list-members, sends, templates, unsubscribes, webhooks-sendgrid) | `_sendgrid.ts` is a REST wrapper (no Node SDK); webhook handler handles SendGrid event batch |
| Content gap analysis | `supabase/functions/content-gap-analysis/` | 5 admin-only endpoints | `_engine.ts` consumes lead/deal/activity data; platform-admin gated |

### Phase 4 — 5 domains (~240 endpoints)

| Domain | Edge function | Handlers | Notes |
|---|---|---:|---|
| Leases | `supabase/functions/leases/` | 4 (leases, payments, renewals, dispositions) | `_pdf.ts` uses `pdf-lib` via esm.sh for signature blocks — first real PDF port |
| Signatures | `supabase/functions/signatures/` | 6 (requests, signers, documents, credentials, audit, webhooks) | Credential redaction via `_shared/credentials.ts`; real CRUD, webhook stubs return 501 |
| Tasks + teams | `supabase/functions/tasks/` + `supabase/functions/teams/` | tasks: 6, teams: 4 | Consolidates 22 Express files + 6 aux edge fns. Projects/team templates/analytics live under `teams/` |
| Manufacturer orders | `supabase/functions/manufacturer-orders/` | 7 (orders, line-items, confirmations, shipments, exceptions, connections, analytics) | `_credentials.ts` redacts `api_secret`, `client_secret`, `webhook_secret` on every SELECT |
| Field service | `supabase/functions/field-service/` | 9 (routes, locations, geofences, geofence-alerts, mileage, installations, checklists, signatures, stubs) | PRD called for 3 functions; pragmatic scope reduction to one. `pointInGeofence` uses haversine + ray-casting, no PostGIS |

### Phase 5 — 1 of 3 domains done (US-021 auth-security)

| Domain | Edge function | Endpoints | Notes |
|---|---|---:|---|
| API keys | `supabase/functions/api-keys/` | 9 | Plaintext returned **once** on create; storage is `key_hash` + `salt`; compare is constant-time. RLS denies `authenticated` role entirely — only service-role (edge functions) can touch the table |
| MFA | `supabase/functions/mfa/` | 17 | TOTP via `otpauth@9.2.2` (esm.sh); email OTP + SMS OTP + backup codes; admin reset. `_twilio.ts` REST wrapper has a simulation mode when `TWILIO_*` env unset |
| SSO | `supabase/functions/sso/` | 14 | OIDC fully ported (token exchange works). SAML callback returns 501 — signature verification deferred, see `tasks/followup-sso-saml-signing.md`. Credentials redacted via `_credentials.ts` |

**Phase 5 remaining:** `ai-features`, `scheduling`.

### Phase 6 — not started

`reports`, `admin`, `content-engagement`, `cron-realtime` (includes the WebSocket → Realtime swap for `technician_locations`), `sunset`.

---

## Key architectural decisions added in this session

1. **One canonical `apply_tenant_rls()` helper that auto-detects `tenant_id` column type.** Earlier version assumed varchar. Then `sso_provider_configs` (uuid tenant_id) triggered `operator does not exist: uuid = text`. Helper now introspects `information_schema.columns` and emits the correct cast — varchar tables are unchanged, uuid tables get `::uuid` on the JWT value.
2. **Defensive RLS-file pattern.** Every `drizzle/rls/<domain>.sql` checks `information_schema.tables` before calling `apply_tenant_rls()`. Missing tables log `SKIP: relation public.X does not exist` instead of failing the transaction — critical when the `drizzle/rls/*-tables.sql` file hasn't been applied yet.
3. **Schema drift mitigation via `ALTER TABLE ADD COLUMN IF NOT EXISTS`.** The `tasks-collab-tables.sql` hit this with the `projects` table — two conflicting Drizzle definitions in the repo (`shared/schema.ts` simpler, `shared/task-schema.ts` + migration 0000 richer). The migration brings DB to the richer shape regardless of which variant was applied first.
4. **REST wrappers replace Node-only SDKs in Deno.** Twilio + SendGrid both ported to `fetch` against their public REST endpoints. No `@twilio/client` or `@sendgrid/mail` imports in edge functions.
5. **Scope reductions are explicit.** When a PRD calls for 3 edge functions and a single canonical function is cheaper (field-service), the edge function comments note the deviation. When tables don't exist but endpoints are specced (tasks-collab categories / suggestions / dependencies), handlers return `{ stub: true, message: "..." }` instead of 501 — clients can still render a sensible UI.
6. **Credential redaction is cross-cutting.** `_shared/credentials.ts` from part A is consumed by manufacturer-orders, signatures, sso. Every SELECT path for a table with secret columns goes through it.

---

## SQL errors we hit (and the fixes that stuck)

Filed so you don't re-solve these the hard way:

| Error | Domain | Root cause | Fix |
|---|---|---|---|
| `%ROWTYPE` compile-time failure | pipeline-config | PL/pgSQL compiles ROWTYPE at CREATE time; referenced table didn't exist yet | Explicit column SELECT INTO variables instead of ROWTYPE |
| `relation 'pipeline_templates' does not exist` | pipeline-config | Missing `public.` qualification | Schema-qualify all table refs |
| `relation 'sales_territories' does not exist` | lead-assignment | Missing `*-tables.sql` file | Split every domain into `<domain>-tables.sql` (creates missing tables) + `<domain>.sql` (applies RLS), with `DO $ … IF EXISTS` guards |
| `column 'project_manager' does not exist` | tasks-collab | Simpler `projects` variant was applied | `ALTER TABLE ADD COLUMN IF NOT EXISTS` for all richer columns |
| `operator does not exist: uuid = text` | auth-security | `sso_provider_configs.tenant_id` is uuid; JWT value is text | Upgraded `apply_tenant_rls()` to introspect column type and cast |

---

## Open follow-ups (non-blocking, documented in code)

Carrying forward from part A, plus new entries from this session:

**From part A (still applicable):**
1. Approval rule evaluation engine (`/deal-desk/check-approval`)
2. SLA escalation → pg_cron (`/deal-desk/check-sla`)
3. Pipeline-config transaction wrapping (multi-step writes)
4. Pipeline automation actions (email/task dispatch on transition)
5. Proposal → deal/contract sync (`PATCH /proposals/:id/status`)
6. Proposal PDF export (`/proposals/:id/export/pdf`) — now unblocked by the leases `_pdf.ts` pattern; easy port
7. Credentials encryption at rest — see `tasks/followup-credentials-encryption.md` (scoped, deferred; pgcrypto baseline + KMS for MFA secrets)

**New this session:**
8. **SAML signature verification** — `tasks/followup-sso-saml-signing.md`. Options A (xml-crypto via esm.sh), B (self-hosted Supabase Enterprise SSO), C (keep Express for `/sso/callback/saml/*`). Recommendation: start with B.
9. **PR 2 cleanups (Express deletion)** — every Phase 3/4 domain still has its Express counterpart. Soak period + verification pass then delete. Rough inventory:
   - `server/routes-lead-scoring.ts`, `server/services/lead-scoring-service.ts`
   - `server/routes-lead-assignment*.ts` (3 files) + 9 aux edge fns (`lead-assignment-history/`, `lead-assignment-queue/`, `lead-assignment-rules/`, `assign-lead/`, `auto-lead-routing/`, `rep-capacity/`, `sales-territories/`, `territories/`, `geocode-leads/`)
   - `server/routes-customer-success*.ts`, `server/services/customer-success-service.ts`
   - `server/routes-email-marketing*.ts`, `server/services/email-marketing/*`
   - `server/routes-leases*.ts`, `server/services/lease-*.ts`
   - `server/routes-signatures*.ts`, `server/services/signature-service.ts`
   - `server/routes-tasks*.ts` (4 files) + 6 aux edge fns (`task-comments/`, `tasks-bulk/`, `tasks-enhanced/`, `tasks-stats/`, `projects/`, `projects-enhanced/`)
   - `server/routes-manufacturer-*.ts`, `server/services/manufacturer-*.ts`
   - `server/routes-field-service*.ts` (~5 files), `server/services/field-service/*`
   - `server/routes-api-keys.ts`, `server/routes-mfa.ts`, `server/routes-sso.ts`, `server/services/sso-service.ts`, `server/services/mfa-service.ts`

---

## Uncommitted state (what you'll see on `git status`)

As of the end of this session, these are on disk but not committed:

```
 M drizzle/rls/apply-rls.sql                       # auto-detect uuid vs varchar
 M supabase/functions/api-keys/index.ts            # plaintext-once + constant-time compare
?? drizzle/rls/auth-security-tables.sql
?? drizzle/rls/auth-security.sql
?? supabase/functions/mfa/                         # _totp.ts, _twilio.ts, handlers/, index.ts
?? supabase/functions/sso/                         # _credentials.ts, handlers/, index.ts
?? tasks/followup-sso-saml-signing.md
```

Commit message suggestion for next session:
```
feat(auth): port api-keys, mfa, sso to edge functions (Phase 5 US-021)

- api-keys: plaintext returned once; hash+salt storage; constant-time compare
- mfa: TOTP (otpauth esm.sh), backup codes, email OTP, SMS OTP (Twilio REST)
- sso: OIDC full port; SAML signature verification deferred
- apply_tenant_rls: introspect tenant_id column type for uuid vs varchar
- auth-security.sql: varchar tables via canonical helper; sso_provider_configs
  gets uuid-casted policies inline; api_keys denies authenticated role
```

---

## How to resume in a new session

1. **Read this file first** (`tasks/SESSION-STATUS-2026-04-23b.md`). Part A (`SESSION-STATUS-2026-04-23.md`) is still accurate for Phase 2 context.
2. **Apply the SQL commands at the top of this file** if you haven't already. The `apply-rls.sql` update is the load-bearing piece — every subsequent `<domain>.sql` depends on the auto-detection.
3. **Commit the uncommitted auth work** using the suggested message, or roll it into the next Phase 5 feature commit.
4. **Continue Phase 5:**
   - Next up: `prd-migration-ai-features.md` — Claude-backed forecasting + recommendations. The `_shared/anthropic.ts` helper from part A is the reuse pattern; Twilio/SendGrid-style REST wrapping is the template.
   - After: `prd-migration-scheduling.md` — calendar providers (Google/Microsoft OAuth). Will need `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` env vars.
5. **Then Phase 6:**
   - `reports`, `admin`, `content-engagement`
   - `cron-realtime` — includes WebSocket → Realtime swap for `technician_locations` and pg_cron wiring for SLA escalation (part A follow-up #2)
   - `sunset` — last pass: delete all surviving Express files + aux edge fns listed above
6. **Before any deploy**, verify the Coolify edge-functions container picks up new functions (`ls supabase/functions/` inside the container, or hit `functions.printyx.net/<name>` — a 401 without auth proves the function is routed).
7. **Running `npm run check`** still shows ~6,550 pre-existing errors. None should be in files touched by this session's work.

---

## Env vars required (unchanged from part A, plus)

Inherited:
```
PORT=8000
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
DATABASE_URL=postgresql://postgres:<pwd>@209.145.59.219:5433/postgres
DB_SSL_REJECT_UNAUTHORIZED=false
DB_POOL_MAX=2
LOG_LEVEL=info
CLAUDE_API_KEY=sk-ant-...
```

Added by this session's ports (all optional — handlers fall back to simulation mode / stubs if unset):
```
SENDGRID_API_KEY=SG....                 # email-marketing sends + webhook verification
SENDGRID_WEBHOOK_PUBLIC_KEY=...         # email-marketing webhook signature check
TWILIO_ACCOUNT_SID=AC...                # mfa SMS OTP
TWILIO_AUTH_TOKEN=...                   # mfa SMS OTP
TWILIO_FROM_NUMBER=+1...                # mfa SMS OTP
```

Will be added by upcoming work:
- `OPENAI_API_KEY` — Phase 5 ai-features (if embeddings land)
- `INTERNAL_CRON_TOKEN` — Phase 6 cron-realtime
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` — Phase 5 scheduling
- `ENCRYPTION_KEY_PRINTYX` — whenever credentials-at-rest encryption lands (see `tasks/followup-credentials-encryption.md`)

---

## TL;DR for the next-you

- Phases 3 + 4 are **fully ported** (10 domains, ~430 endpoints). RLS files on disk; apply in the order at the top.
- Phase 5 is **1 of 3** done (auth-security). `ai-features` is the next target.
- Phase 6 **unstarted**.
- **`apply_tenant_rls()` was upgraded** — re-run it before any subsequent domain SQL. It's backward compatible.
- **Don't re-derive** the uuid-vs-text JWT cast, the xml-crypto SAML path, the credentials-encryption strategy, or the WebSocket-to-Realtime swap — they're all filed in `tasks/followup-*.md` or in the `prd-migration-*.md` set.
- Express deletion (PR 2 cleanups) is the **final chapter**, not interim work — leave it until Phase 6 sunset.
- Don't upgrade Deno. Don't try Drizzle-in-Deno. The two hard constraints from prior sessions still hold.
