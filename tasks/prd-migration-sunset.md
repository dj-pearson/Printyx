# PRD: Sunset — Delete `server/` Directory + Frontend Routing Cleanup

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 6 · **Week:** 15 (Aug 5 – Aug 11) · **Stories:** US-028 + US-029

**Why bundled:** US-028 (delete `server/`) and US-029 (frontend routing cleanup) are the final acts of the 15-week migration. They only happen once every prior PRD lands. This document is the terminal checklist: verify nothing's left behind, delete infrastructure, remove dependencies, ship the last commit.

**This is the single point of no return for the migration.** Once `server/` is gone, rollback means restoring from git history + redeploying infrastructure. Treat as irreversible in practical terms.

---

## 1. Scope

### US-028 — Delete `server/` directory

All backend code must be gone:
- `server/routes/*.ts` (52 files)
- `server/routes-*.ts` (~160 files in `server/` root — **much larger than master PRD anticipated**)
- `server/services/*.ts`
- `server/middleware/*`
- `server/lib/*`
- `server/config/*`
- `server/db.ts`, `server/storage.ts`, `server/index.ts`, `server/routes.ts`
- `server/websocket-service.ts` (already deleted in US-027)
- `server/replitAuth.ts`, `server/auth-setup.ts`
- `server/tests/` (Express-era tests — replaced by Deno tests in each edge function)
- `server/database-updater/` (unless converted to pg_cron per US-026)
- `server/integrations/`, `server/apollo*.ts`, `server/data-enrichment-mapping.ts`
- Everything else under `server/`

### US-029 — Frontend routing cleanup

- `client/src/lib/config.ts` — simplify: `/api/*` always maps to `functions.printyx.net/*` in prod
- Remove any temporary edge-function-allowlist logic
- `vite.config.ts` dev proxy must still work for local Supabase CLI testing

### Infrastructure
- `Dockerfile` — delete (only `Dockerfile.edge-functions` remains)
- `k8s/` directory — delete if present
- `package.json` — remove Node-only dependencies (full list in §4)

### Explicitly out of scope
- Architectural refactors of edge functions
- New feature additions
- Supabase Enterprise migration

---

## 2. Pre-flight audit (mandatory before delete)

**No delete happens until the audit passes.** Required checks:

### 2.1. Zero-reference check
```bash
# Frontend must not import from server/
grep -r "from '\.\./\.\./server" client/ && echo "FAIL — frontend imports from server"

# Edge functions must not import from server/
grep -r "from '\.\./\.\./server" supabase/ && echo "FAIL — edge function imports from server"

# Only shared/ (if Deno-compatible) may be cross-referenced
grep -rE "from '@shared/" supabase/ | wc -l  # non-zero is OK
```

### 2.2. Route coverage check
Every URL the frontend calls must land on an edge function:
```bash
# Extract all /api/* fetches from frontend
grep -rE "'/api/[a-z0-9/_-]+" client/src/ -o | sort -u > /tmp/frontend-api-calls.txt

# Extract all edge function endpoints (handler file paths)
find supabase/functions -name 'index.ts' -exec basename {} \; > /tmp/edge-function-names.txt

# Cross-reference manually: every frontend URL prefix must have a corresponding edge function
```

Every frontend call without a matching edge function → **BLOCKER**. Either port the endpoint or delete the caller.

### 2.3. Remaining `server/routes-*.ts` inventory

Per my count of the server/ directory, there are **160+ `routes-*.ts` files** in server root plus 52 in `server/routes/`. The master PRD's per-phase user stories account for ~50 of these by name. **A substantial gap exists.**

**Before sunset, produce `docs/sunset-route-inventory.md`** listing EVERY remaining file in `server/routes/` and `server/routes-*.ts` with:
- File name
- Whether it's been migrated (yes → name of edge function)
- Whether it's orphaned (no frontend callers)
- Whether it's a blocker (still referenced, not migrated)

**Expected findings:**
- ~40 files explicitly migrated by Phase 2-6 PRDs
- ~50-80 orphaned files (features that were never wired to frontend or were stubs)
- ~20-40 blockers requiring "mini-migration" sprints before sunset

**If > 10 blockers remain at Phase 6 start:** the 15-week timeline slips. Plan for this.

### 2.4. pg_cron + Realtime stable
- Every `cron.job` has at least 3 consecutive successful runs
- Realtime subscriptions deliver in < 3s p95
- No WebSocket references in frontend code

### 2.5. Type-check pass
```bash
npm run check  # with server/ still in place — must pass
```

### 2.6. Build pass
```bash
npm run build
```

---

## 3. Deletion sequence

**Staged delete over 5 PRs** to keep git history clean and rollback surgical:

### PR 1 — Orphan cleanup
Delete every route / service confirmed orphaned (no callers). No functional change.

### PR 2 — Route handlers
Delete `server/routes/*.ts` and `server/routes-*.ts` that have edge-function equivalents. Update `server/routes-registry.ts` to be empty / deleted.

### PR 3 — Services + middleware
Delete `server/services/*`, `server/middleware/*`, `server/lib/*`.

### PR 4 — Bootstrap + infra
Delete `server/index.ts`, `server/db.ts`, `server/storage.ts`, `server/routes.ts`, `server/replitAuth.ts`, `server/auth-setup.ts`.
Delete `Dockerfile`, `k8s/` (if present).

### PR 5 — Frontend routing + package cleanup
- Simplify `client/src/lib/config.ts`
- Remove Node-only packages from `package.json`
- Clean up `vite.config.ts` dev proxy
- Delete `server/` directory (should be empty by now — `rm -rf server/`)
- Final commit: `chore: remove Express server — pure Edge Functions now`

Each PR independently deployable + revertable. Final PR becomes the "point of no return."

---

## 4. Node-only packages to remove from `package.json`

**Expected to be removable after all phases:**

| Package | Used by | Replaced by |
|---|---|---|
| `express` | entire server/ | N/A (edge functions use Deno's `serve`) |
| `pg` | server/db.ts | N/A (edge functions use postgres-js via esm.sh OR Supabase JS) |
| `node-cron` | cron-service (disabled) | `pg_cron` via US-026 |
| `ws` | websocket-service | Supabase Realtime via US-027 |
| `pino` | server logger | `_shared/logger.ts` custom JSON |
| `@sendgrid/mail` | email-service | fetch REST per Phase 3 |
| `pdfkit` | lease PDF | `pdf-lib` per Phase 4 lease PRD |
| `puppeteer` | document-generation-service | `pdf-lib` per Phase 4 lease PRD |
| `twilio` | mfa-otp-service | fetch REST per Phase 5 auth PRD |
| `@aws-sdk/client-sns` | mfa-otp-service | dropped per Phase 5 auth PRD |
| `googleapis` | calendar-service | fetch REST per Phase 5 scheduling PRD |
| `@microsoft/microsoft-graph-client` | calendar-service | fetch REST per Phase 5 scheduling PRD |
| `nodemailer` | (verify — may already be replaced) | fetch REST |
| `passport`, `passport-saml` (if present) | SSO | custom SAML via Phase 5 auth PRD |
| `speakeasy` (if present) | MFA | `otpauth` via esm.sh |
| `imap` (if present) | email-monitor | Gmail REST API |
| `jsforce` (if present) | salesforce integration | Salesforce REST |
| `handlebars` | document-generation | N/A (pdf-lib handles layout) |
| `axios` (if exclusively server-side) | various | `fetch` |
| `tsx` | dev server for Express | no longer needed if `npm run dev` becomes frontend-only |
| `drizzle-orm/node-postgres` path | Node side | `drizzle-orm/postgres-js` in edge functions |

**Keep:**
- `drizzle-orm` — schemas still source of truth, shared/ files are Deno-portable
- `drizzle-kit` — for migration generation
- `zod` — schemas use it; edge functions import via esm.sh
- All frontend deps (React, etc.)

**Uncertain (verify before removing):**
- `@anthropic-ai/sdk` — edge functions use fetch; if no other consumer, remove
- `openai` — same

### Expected package.json size reduction
Before: ~80-100 server-side dependencies
After: ~40-50 total (frontend-only + dev tools)

---

## 5. Frontend routing cleanup (US-029)

### Current state (approximate)
```typescript
// client/src/lib/config.ts
export function getApiUrl(path: string): string {
  if (import.meta.env.DEV) return path;  // vite proxy

  // Hybrid mode — some routes to edge, some to Express
  if (EDGE_FUNCTION_ROUTES.some(p => path.startsWith(p))) {
    return `https://functions.printyx.net${path.replace(/^\/api\//, '/')}`;
  }
  return `https://printyx.net${path}`;  // Express (now dead)
}
```

### Target state
```typescript
export function getApiUrl(path: string): string {
  if (import.meta.env.DEV) return path;  // vite proxy still routes to Supabase CLI locally
  return `https://functions.printyx.net${path.replace(/^\/api\//, '/')}`;
}
```

Simpler, single branch. `EDGE_FUNCTION_ROUTES` allowlist deleted.

### Vite dev proxy
Preserve for local Supabase CLI testing:
```typescript
// vite.config.ts — unchanged in principle
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:54321',
      rewrite: p => p.replace(/^\/api/, '/functions/v1'),
    },
  },
}
```

---

## 6. Acceptance criteria

### Pre-flight
- [ ] `docs/sunset-route-inventory.md` published
- [ ] Zero-reference check passes (frontend/edge imports from server/ → 0)
- [ ] Route coverage check passes (every `/api/*` URL → edge function)
- [ ] pg_cron + Realtime stable for 48h+
- [ ] Type check + build pass with server/ intact (baseline)

### US-028 — server/ deletion
- [ ] `server/` directory removed (empty → `rm -rf`)
- [ ] `Dockerfile` removed (only `Dockerfile.edge-functions` remains)
- [ ] `k8s/` removed (if present)
- [ ] `package.json` cleaned of Node-only deps per §4
- [ ] `package-lock.json` regenerated, diff reviewed
- [ ] Type check + build pass post-delete
- [ ] `npm run dev:frontend` still works (frontend-only dev server)
- [ ] `npm run dev` either removed or points to `dev:frontend` (no Express to start)

### US-029 — Frontend routing cleanup
- [ ] `client/src/lib/config.ts` simplified per §5
- [ ] `EDGE_FUNCTION_ROUTES` allowlist deleted
- [ ] Any `import.meta.env.DEV` branches updated
- [ ] Vite dev proxy works for local Supabase testing
- [ ] Playwright MCP pass across all major routes — no regression

### Monitoring
- [ ] Canary script hits all frontend `/api/*` URLs in a user-session pattern; returns 0 × 404
- [ ] Error monitoring (whatever tool is in use) shows no Express-era 404s in 24h post-deploy

### Final commit
- [ ] Commit message: `chore: remove Express server — pure Edge Functions now`
- [ ] Tag: `v-pure-edge-2026-08-11` (or similar)

---

## 7. Test plan

### Pre-delete smoke
- Run full Playwright E2E suite against staging with server/ intact — baseline pass
- Capture network tab: every `/api/*` call + its edge function destination

### Post-delete smoke
- Run same Playwright suite against staging with server/ deleted
- All tests pass = sunset safe
- Any failure = rollback PR immediately, investigate

### Production canary
- Deploy to prod in off-hours (Saturday early AM)
- Dan runs a full happy-path: login → dashboard → create lead → convert to customer → generate quote → schedule meeting → send email → run report → log out
- Monitor error rate for 24h

### Regression watch
- Error rate baseline from pre-sunset week
- Post-sunset error rate should match or improve (fewer 404s from Express non-routed paths)
- Alert on >5% increase over baseline

---

## 8. Rollback

**Practical rollback once `server/` is deleted = restore from git + redeploy.**

Preparation before delete:
1. Tag the last-commit-with-server: `git tag last-hybrid-2026-08-10`
2. Document a written runbook: how to restore + redeploy Express if needed
3. Keep Coolify config for Express container archived (not deleted) for 30 days post-sunset

**Under what scenarios might we rollback?**
- Critical customer-blocking bug found in an edge function that takes > 4h to fix
- Supabase self-hosted instance fails in ways edge functions can't compensate for
- Regulatory / legal requirement to have Node runtime (unlikely)

**Preferred response to issues:** fix-forward in an edge function. Rollback is a last resort.

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Orphaned route file was actually needed by a rare customer flow | Medium | High | Audit uses frontend grep; may miss dynamically-constructed URLs. Canary script + 24h error-rate watch catches these |
| Phase 6 timeline slips because 100+ orphaned routes-*.ts files weren't accounted for | **High** | Medium | Pre-flight audit (§2.3) surfaces this early; budget 1-2 weeks for orphan cleanup before sunset |
| `package.json` removal breaks frontend build via transitive dep | Medium | Medium | Remove packages in a dedicated PR; run full build after each removal |
| Canary script miss — "silent 404" because path is OAuth callback or webhook (no observable user) | Medium | Medium | Explicitly inventory webhook + callback paths; test each in isolation |
| Supabase Edge Functions platform upgrade breaks us during sunset week | Low | High | Freeze Supabase version in Dockerfile; don't chase upgrades during sunset |
| Developer can no longer run `npm run dev` for full-stack work | High | Low | Update README + onboarding docs; `npm run dev:frontend` + Supabase CLI is the new dev loop |
| Git history references to server/ linger and confuse future contributors | Low | Low | Keep git history; add a `MIGRATED.md` explaining the repo's history |

---

## 10. Open questions

1. **What's the actual scope of `server/routes-*.ts` files (160+)?** Audit reveals the true count vs. master PRD's estimate. If 20+ blockers, Phase 6 needs extension.
2. **`server/database-updater/` — keep or kill?** Test-data generation tool. If kept, convert to pg_cron; if killed, delete.
3. **Is `server/integrations/` (Salesforce, QuickBooks, etc.) covered by any Phase 2-5 PRD?** Verify — these may be orphaned.
4. **Does the team still use `npm run dev` for full-stack?** If yes, document replacement workflow (Supabase CLI + Vite).
5. **Webhook endpoints** — SendGrid, signature providers, Stripe, etc. — are all of these edge-function-fronted now? Any remaining Express webhook path = blocker.
6. **Mobile app (if any — reference in `routes-mobile.ts`)** — has its backend been migrated? Mobile often has longer release cycles.
7. **Public API consumers (if any)** — API keys (from US-021) expect endpoints at specific paths. Verify every public endpoint survives the migration.
8. **Supabase Storage** — any buckets that should be tightened now that service-role paths through edge functions are documented?
9. **Monitoring / alerting** — post-sunset, how do we watch for regressions? Coolify logs, Supabase Edge function logs, or bring in a dedicated tool (Sentry, Datadog)?
10. **Coolify Express container** — when is the last redeploy? Keep it archived; delete from Coolify UI only after 30 days post-sunset if no issues.

---

## 11. Post-sunset follow-ups (file as separate issues)

1. **Migration retrospective** — what went well, what didn't, lessons for future infra overhauls
2. **Deno version upgrade** — 1.38.5 is pinned; upgrade to 2.x is a separate initiative
3. **Credential encryption at rest** — multi-domain issue (manufacturer-orders, signatures, SSO) — implement `pgcrypto` + KMS
4. **RLS policy consistency check in CI** — automated scanner
5. **Rate-limit framework** — `_shared/rate-limit.ts` built for AI PRD; roll out to every edge function
6. **Audit log retention** — define policy, implement via pg_cron
7. **Per-domain PRDs from Phase 5/6 that deferred real integrations** (signature providers, transcription) — schedule follow-up PRDs
8. **Documentation refresh** — CLAUDE.md, README.md, onboarding docs updated for pure-edge reality
9. **Monitoring dashboard** — cron run history, edge function latency, RLS policy violations

---

## 12. Definition of done

- [ ] `server/` directory deleted
- [ ] `Dockerfile` (Express) deleted; only `Dockerfile.edge-functions` remains
- [ ] `k8s/` deleted if present
- [ ] Node-only packages removed from `package.json`
- [ ] Frontend `config.ts` simplified
- [ ] Full Playwright E2E suite passes against prod post-sunset
- [ ] Zero Express 404s in 24h error monitoring
- [ ] Final commit: `chore: remove Express server — pure Edge Functions now`
- [ ] Migration retrospective scheduled + held
- [ ] Post-sunset follow-up issues filed
- [ ] 🎉 **Migration complete** — target date 2026-08-11
