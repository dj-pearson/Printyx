# PRD: Migrate Admin Routes to Edge Function

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 6 · **Week:** 15 (July 29 – Aug 4) · **Story:** US-024

**Why:** Admin endpoints power the platform-admin, RBAC, chrome extension, and seed/demo flows. The largest file (`admin-seed-routes.ts`, 1,552 lines) is 6× larger than the master PRD anticipated — because it ALSO contains the RBAC role assignment endpoints (not just seeding). This PRD migrates admin routes that didn't fit any other phase; many overlap with features already migrated in Phases 2-5 and need deduplication.

---

## 1. Scope

**Source Express files (in `server/routes/`):**
- `admin-seed-routes.ts` (1,552 lines) — seed/demo data + **RBAC role endpoints** (`/roles`, `/my-role`, `/assign-role`)
- `chrome-extension-routes.ts` (532 lines, 4 endpoints) — lead import, auth key gen, health, duplicate check

**Additional admin routes in `server/` root (not covered by other phase PRDs):**
- `routes-admin-stats.ts`
- `routes-admin-subscriptions.ts`
- `routes-admin-workflows.ts`
- `routes-root-admin.ts`
- `routes-enhanced-rbac.ts`
- `routes-session-management.ts`
- `routes-settings.ts`
- `routes-feature-flags.ts`
- `routes-tenant-onboarding.ts`
- `routes-onboarding.ts`
- `routes-white-label.ts`
- `routes-audit-logs.ts`

**Total files: ~14**, likely 100-200 endpoints across all. Per-file enumeration deferred to parity audit.

**Existing edge functions:**
- `supabase/functions/admin/` — may already cover some
- `supabase/functions/enhanced-rbac/` — partial (audit)

**Target: multiple edge functions** (no monolith — admin scope is too broad):

```
supabase/functions/
├── admin/                             # EXPANDED
│   ├── index.ts
│   ├── handlers/
│   │   ├── seed.ts                    # seed/demo creation
│   │   ├── stats.ts                   # platform stats
│   │   └── settings.ts                # tenant settings CRUD
│
├── rbac/                              # NEW — unified RBAC layer
│   ├── index.ts
│   ├── handlers/
│   │   ├── roles.ts                   # role CRUD + my-role + assign-role
│   │   ├── permissions.ts             # permission CRUD
│   │   └── audit.ts                   # RBAC change audit
│
├── tenant-onboarding/                 # NEW
│   ├── index.ts
│   └── handlers/
│       ├── signup.ts
│       ├── trial.ts
│       └── white-label.ts
│
├── chrome-extension/                  # NEW — 4 endpoints, purpose-built
│   └── index.ts
│
└── audit-logs/                        # NEW — tenant-facing
    └── index.ts
```

**Explicitly out of scope:**
- Platform-admin superuser tools beyond basic CRUD (no refactor of how superusers work)
- New feature flags — keep existing flag format
- Seeding strategy redesign — port whatever exists

---

## 2. Parity audit (pre-code step)

Given 14 files and ≥100 endpoints, the audit is substantial. **Required first step:** `docs/admin-parity.md` with:

1. Full endpoint inventory per file (`router.*` greps)
2. Classify each as: keep / merge-with-existing-edge-function / delete (superseded)
3. Map each to target edge function location
4. Flag any orphaned / dead endpoints (frontend grep → zero callers)

Expect ≥ 20% of endpoints to be orphaned (legacy features never fully wired). Candidates for deletion during migration — do NOT port dead code to Deno.

---

## 3. Chrome extension (special case)

`chrome-extension-routes.ts` is a lightweight API for the browser extension:
- `POST /chrome-extension/leads/quick-import` — browser-captured prospects
- `GET /chrome-extension/leads/check-duplicate`
- `POST /chrome-extension/auth/generate-key` — extension auth
- `GET /chrome-extension/health`

**Auth model:** distinct from session JWT — uses an API key generated specifically for the extension. This reuses the `api_keys` table from US-021 (auth-security PRD) — verify compatibility.

**Target:** single-purpose `supabase/functions/chrome-extension/` edge function with its own CORS config (Chrome extensions have specific CORS constraints).

**CORS consideration:** Chrome extensions often send requests from `chrome-extension://` origins. Audit current CORS config in Express; replicate in edge function (`_shared/cors.ts` may need an allowlist extension).

---

## 4. RBAC consolidation

`admin-seed-routes.ts` contains `/roles`, `/my-role`, `/assign-role` at lines 1356/1388/1441 — these are **not seed logic**, they're RBAC management. The master PRD didn't anticipate this overlap.

**Strategy:**
1. Extract RBAC endpoints from `admin-seed-routes.ts` into their own target (`rbac/` edge function)
2. Combine with `routes-enhanced-rbac.ts` endpoints — one canonical RBAC surface
3. Admin `seed.ts` handler keeps only seed/demo creation logic
4. This simplifies both domains

---

## 5. Tables + RLS plan

Admin domains touch many tables — most already have RLS from prior phases. New RLS needed:
- `tenant_onboarding_state`
- `white_label_config`
- `feature_flags`
- `session_state`
- `platform_settings` (cross-tenant)
- `audit_logs` (tenant-scoped)

RLS files: `drizzle/rls/admin.sql`, `drizzle/rls/rbac.sql`, `drizzle/rls/tenant-onboarding.sql`.

**Platform-admin overrides:** some endpoints (e.g., seed data creation, compliance report) are **platform-admin only**. These use service-role DB access and bypass RLS — documented in handler comments. Port this pattern carefully.

**Audit log write path:** every admin action should emit an audit log. Port the existing `recordAuditEvent(action, userId, tenantId, details)` helper to `_shared/audit.ts`.

---

## 6. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| Seed data generators | `admin-seed-routes.ts` | Port as-is (mostly pure TS) |
| Feature flag engine | `routes-feature-flags.ts` | Port; check for external flag service (LaunchDarkly?) integration |
| White-label customization logic | `routes-white-label.ts` | Port |
| Session management (Redis or DB?) | `routes-session-management.ts` | Audit — if Redis, decide: swap for DB-backed sessions OR use Supabase's own session table |

---

## 7. Acceptance criteria

### Audit
- [ ] `docs/admin-parity.md` published — full endpoint list with classification
- [ ] Dead / orphaned endpoints listed; each confirmed unused via frontend grep
- [ ] Orphaned endpoints deleted (not ported)

### Functional
- [ ] All active admin endpoints ported
- [ ] Seed data creation works end-to-end for demo tenant
- [ ] RBAC role CRUD + assign + my-role work
- [ ] Chrome extension flow (auth key → lead import) works
- [ ] Tenant onboarding + trial flows work
- [ ] Audit log records all admin state changes

### Security / RLS
- [ ] RLS applied to all new tables listed in §5
- [ ] Platform-admin-only endpoints enforce role check via `_shared/rbac.ts` (requires `roleLevel === 8` or equivalent)
- [ ] Service-role DB access logged and documented per-handler
- [ ] Audit log entries for every admin action verified

### Frontend compatibility
- [ ] Platform admin UI pages load (audit for specific pages — likely `PlatformAdmin.tsx`, `AdminHub.tsx`, `RBACSettings.tsx`, etc.)
- [ ] Feature flags UI works
- [ ] Tenant onboarding wizard works
- [ ] Chrome extension (if installed for testing) connects successfully
- [ ] Playwright MCP pass on each admin page

### Deletion
- [ ] ~14 Express files deleted
- [ ] Services for admin / RBAC / onboarding ported + originals deleted
- [ ] Route registry entries removed
- [ ] `grep -r "admin-seed-routes\|chrome-extension-routes\|enhanced-rbac" server/` returns zero matches

### Quality gates
- [ ] `deno check` passes on all new edge functions
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 8. Test plan

### Unit (Deno)
- Seed generator tests (fixture output matches Express for same seed input)
- RBAC role assignment validation
- Feature flag evaluation logic

### Integration
- Tenant onboarding: create trial → wizard → first login → settings
- RBAC: create role → assign permissions → assign user → verify permission enforcement on gated edge function
- Audit log: run 10 admin actions, verify 10 audit rows
- Chrome extension: generate key → simulate extension request → verify lead inserted

### Production smoke
- Platform admin hub: verify stats, user count, subscription state
- Seed a demo tenant in prod; verify it can be logged into

---

## 9. Rollback

Low-medium risk — admin endpoints are not customer-critical during business hours (internal users). Standard revert.

**Exception:** tenant-onboarding flow is externally-visible to new signups. If this breaks, new customer signups are blocked. Deploy with synthetic smoke test verifying signup end-to-end.

No schema changes unless admin-specific tables lack RLS today (add RLS migrations if so).

---

## 10. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 14 files is a large review surface; some routes silently break | High | Medium | Split into 4-5 sub-PRs under a feature branch |
| RBAC changes during migration introduce permission regressions | Medium | High | Snapshot-test the RBAC permission table pre/post migration |
| Session-management uses Redis that isn't ported | Medium | High | Audit first; if Redis, switch to Supabase Auth session OR Postgres-backed with 15 min TTL |
| Chrome extension breaks because CORS policy differs | Medium | Medium | Test with actual extension; replicate exact CORS policy in edge function |
| Seed scripts create data that violates new RLS policies | Low | Medium | Run seed as service-role; document intentional bypass |
| Feature flag lookup becomes slow due to cold-start cost | Low | Medium | Cache flag evaluation per tenant per 5min in memory |

---

## 11. Open questions

1. **What's in `admin-seed-routes.ts` lines 170-1356?** 1186 lines between `POST /demo` and `GET /roles` — likely more seed + demo endpoints. Audit critical.
2. **Is there a Platform Admin UI beyond what was grepped?** Search `client/src/pages/admin/*`, `client/src/pages/Platform*`.
3. **How does the Chrome extension authenticate today?** Uses a per-user API key (from `api_keys` table) or a separate mechanism?
4. **Feature flags — DB-backed, config-file-backed, or external service?** Affects port approach.
5. **Tenant onboarding emails** — does signup trigger SendGrid? If so, share email helper.
6. **Session state — DB, Redis, or in-memory?** Determines session migration effort.
7. **Any admin endpoints called by scheduled jobs?** Those become pg_cron → edge function calls in US-026.
8. **Platform admin vs. tenant admin role distinction** — verify the JWT claims reflect both levels (`roleLevel` + `isPlatformAdmin` flag?).

---

## 12. Definition of done

- [ ] All active admin endpoints live across `admin/`, `rbac/`, `tenant-onboarding/`, `chrome-extension/`, `audit-logs/`
- [ ] Dead code deleted (not ported)
- [ ] Platform admin + tenant admin flows verified in prod
- [ ] Chrome extension authenticated + functional
- [ ] RLS on all admin tables
- [ ] Audit log records verified
- [ ] ~14 Express files + related services deleted
- [ ] Type checks + build pass
- [ ] 72 hours stable before Phase 6 moves to US-025
