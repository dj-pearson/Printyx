# PRD: Migrate Lead Scoring + Lead Intelligence to Edge Function

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 3 · **Week:** 5 (May 20 – May 26) · **Story:** US-012

**Why:** Two adjacent lead-quality subsystems currently live in Express only — `lead-scoring` (rules, calculations, BANT, engagement, analytics) and `lead-intelligence` (Claude-assisted enrichment + batch processing). Neither has an edge-function counterpart, so both are 404'ing in prod today. Consolidating into one `supabase/functions/lead-scoring/` keeps related domain logic together and re-uses `_shared/anthropic.ts` already in place from Outreach.

---

## 1. Scope

**Source Express files:**
- `server/routes/lead-scoring-routes.ts` (798 lines, 19 endpoints) — mounted at `/api/lead-scoring`
- `server/routes/lead-intelligence-routes.ts` (210 lines, 7 endpoints) — mounted at `/api/lead-intelligence`
- `server/services/lead-intelligence-service.ts` (843 lines) — Claude-backed scoring + enrichment + batch processor
- Helpers inlined in routes: `isAdminOrManager`, `canManageScoringRules` (role check)

**Target edge function:**
```
supabase/functions/lead-scoring/
├── index.ts                    # dispatcher — URL-path routed
├── handlers/
│   ├── rules.ts                # CRUD on lead_scoring_rules
│   ├── calculate.ts            # score calculation + history + leaderboard + grade
│   ├── bant.ts                 # BANT qualification endpoints
│   ├── engagement.ts           # engagement tracking
│   ├── analytics.ts            # aggregations (score distribution, BANT)
│   ├── intelligence.ts         # enrichment + batch (Claude-backed)
│   └── attention.ts            # attention-required list
└── _service.ts                 # ported from lead-intelligence-service.ts (pure logic)
```

**Handler count:** 26 endpoints total (19 + 7).

**Tables touched:** `lead_scoring_rules`, `lead_score_calculations`, `lead_score_history`, `bant_qualification_criteria`, `lead_engagement_tracking`, `lead_qualification_history`, `business_records` (read-only for lead context).

**Explicitly out of scope:**
- Frontend UI changes — `LeadIntelligenceDashboard.tsx` and `BANTAssessment.tsx` already hit `/api/lead-*/...`; the frontend router rewrites `/api` → `functions.printyx.net`, so no frontend changes expected.
- The broader auto-lead-routing flow (tracked under US-013).

---

## 2. Endpoint parity matrix

### `lead-scoring` (19 endpoints)

| Method | Path | Express line | Target edge path | Notes |
|---|---|---|---|---|
| POST   | `/lead-scoring/rules` | L33  | `/lead-scoring/rules` | RBAC: admin/manager only |
| GET    | `/lead-scoring/rules` | L65  | same | `?category` filter |
| GET    | `/lead-scoring/rules/active` | L82  | same | |
| GET    | `/lead-scoring/rules/:id` | L98  | same | |
| PUT    | `/lead-scoring/rules/:id` | L118 | same | RBAC |
| DELETE | `/lead-scoring/rules/:id` | L151 | same | RBAC |
| POST   | `/lead-scoring/calculate/:leadId` | L181 | same | Computes score from rules |
| GET    | `/lead-scoring/score/:leadId` | L380 | same | |
| GET    | `/lead-scoring/score/:leadId/history` | L412 | same | |
| GET    | `/lead-scoring/leaderboard` | L436 | same | `?limit&minScore` |
| GET    | `/lead-scoring/grade/:grade` | L472 | same | Lead list by grade |
| POST   | `/lead-scoring/bant/:leadId` | L510 | same | Creates BANT record |
| GET    | `/lead-scoring/bant/:leadId` | L606 | same | |
| GET    | `/lead-scoring/qualified` | L633 | same | Qualified lead list |
| POST   | `/lead-scoring/engagement/:leadId` | L671 | same | |
| GET    | `/lead-scoring/engagement/:leadId` | L704 | same | |
| GET    | `/lead-scoring/analytics` | L730 | same | Score distribution |
| GET    | `/lead-scoring/bant-analytics` | L753 | same | BANT aggregates |
| GET    | `/lead-scoring/qualification-history/:leadId` | L776 | same | |

### `lead-intelligence` (7 endpoints)

| Method | Path | Express line | Target edge path | Notes |
|---|---|---|---|---|
| GET  | `/lead-intelligence/:leadId` | L31 | `/lead-intelligence/:leadId` | Full intel bundle |
| POST | `/lead-intelligence/:leadId/score` | L55 | same | Re-run scoring |
| POST | `/lead-intelligence/:leadId/enrich` | L83 | same | **Claude call** |
| POST | `/lead-intelligence/:leadId/process` | L111 | same | score + enrich composite |
| POST | `/lead-intelligence/batch/score` | L139 | same | Bulk — see risk 3 |
| GET  | `/lead-intelligence/analytics/overview` | L171 | same | |
| GET  | `/lead-intelligence/attention/required` | L191 | same | |

**Dispatch decision:** single edge function `lead-scoring/`, with path prefixes `/lead-scoring/*` and `/lead-intelligence/*` both handled. Coolify already fronts the function; frontend paths remain unchanged.

---

## 3. RLS plan

New file `drizzle/rls/lead-scoring.sql` applies the standard 4-policy template (SELECT/INSERT/UPDATE/DELETE gated by `auth.jwt() -> 'app_metadata' ->> 'tenantId'`) to:

- `lead_scoring_rules`
- `lead_score_calculations`
- `lead_score_history`
- `bant_qualification_criteria`
- `lead_engagement_tracking`
- `lead_qualification_history`

`business_records` already has RLS applied (separate migration, from the business-records edge function).

---

## 4. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| Claude API for lead enrichment | `server/services/claude-ai-service.ts` (imported by `lead-intelligence-service.ts:20`) | Reuse `supabase/functions/_shared/anthropic.ts` from Outreach — no new code |
| `storage` interface (Drizzle-backed) | `server/storage.ts` | Replace with direct `getDb()` calls; re-implement the ~15 methods used (`createLeadScoringRule`, `getLeadScoringRules`, `getActiveLeadScoringRules`, `getLeadScoringRule`, `updateLeadScoringRule`, `deleteLeadScoringRule`, `createLeadScore`, `getLeadScore`, `getLeadScoreHistory`, `getLeadScoreboard`, `getLeadsByGrade`, `createBantQualification`, `getBantQualification`, `getQualifiedLeads`, `recordLeadEngagement`, `getLeadEngagement`, `getLeadScoringAnalytics`, `getBantAnalytics`, `getLeadQualificationHistory`) inline in `handlers/*.ts` |

No SendGrid, no websockets. No cron in the service (batch is API-triggered).

---

## 5. RBAC pattern

Express uses a local `isAdminOrManager(user)` helper (checks `role.toLowerCase()` for `admin|manager|executive`). Port to `_shared/rbac.ts` if not already created by the KB reconcile PRD — otherwise reuse. The helper should read `ctx.supabaseUser.role` or `app_metadata.roleLevel` (whichever is authoritative after Phase 1 audit).

Rule creation/update/delete is gated. Read endpoints are open to any authenticated tenant user.

---

## 6. Acceptance criteria

### Functional parity
- [ ] All 26 endpoints return the same shape as Express for equivalent inputs
- [ ] `POST /lead-intelligence/:leadId/enrich` returns Claude-enriched data matching the current contract (same fields: `enrichedBuyerSignals`, `intentScore`, `recommendedNextActions`)
- [ ] `POST /lead-intelligence/batch/score` handles up to 100 leads per request without timing out
- [ ] Scoring rule CRUD enforces admin/manager RBAC — unauthorized user gets 403
- [ ] Leaderboard and analytics endpoints return identical numbers vs. Express for the same tenant on the same date

### Security / RLS
- [ ] RLS applied to all 6 lead-scoring tables (`drizzle/rls/lead-scoring.sql`)
- [ ] Two-tenant test: creating a scoring rule as tenant A → tenant B cannot GET or list it (404, not 403)
- [ ] Forged `tenant_id` in POST body is overwritten by the `requireAuth()` context, not trusted from payload

### Frontend compatibility
- [ ] `LeadIntelligenceDashboard.tsx` loads without console errors
- [ ] `BANTAssessment.tsx` can create and read a BANT record end-to-end
- [ ] Lead leaderboard widget on dashboard still populates
- [ ] Verify in browser using Playwright MCP

### Deletion (Express cleanup)
- [ ] `server/routes/lead-scoring-routes.ts` deleted
- [ ] `server/routes/lead-intelligence-routes.ts` deleted
- [ ] `server/services/lead-intelligence-service.ts` deleted (ported to `supabase/functions/lead-scoring/_service.ts`)
- [ ] Route registration removed from `server/routes-registry.ts`
- [ ] `grep -r "lead-scoring-routes\|lead-intelligence-routes\|lead-intelligence-service" server/ client/` returns zero matches

### Quality gates
- [ ] `deno check supabase/functions/lead-scoring/**/*.ts` passes
- [ ] `npm run check` passes after Express files are removed
- [ ] `npm run build` succeeds

---

## 7. Test plan

### Unit (Deno)
- `supabase/functions/lead-scoring/handlers/calculate.test.ts` — fixture-driven test of the rule evaluation math (pure function)
- `supabase/functions/lead-scoring/_service.test.ts` — mock Claude response, verify parsed enrichment shape

### Integration (local Supabase stack)
- `supabase functions serve lead-scoring`
- Curl each of the 26 endpoints with a test JWT; diff response against Express output captured from a dev-server run

### Production smoke
- Load `LeadIntelligenceDashboard`, enrich one lead, verify intel panel populates
- Run leaderboard, compare top-5 list to dev-server output for same tenant

---

## 8. Rollback

Revert the edge function PR. Both Express files are already non-functional in prod (they're on disk but the Express server isn't deployed), so rollback returns to the current baseline — no user-visible regression vs. today.

RLS stays enabled (non-breaking). No schema changes in this PRD.

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Claude timeout on enrichment (edge function 60s budget) | Low | Medium | Enrichment prompts are ~3-5s typical; set explicit 45s fetch timeout and surface a clear 504 |
| `batch/score` with 1000+ leads exceeds Deno memory | Medium | Medium | Hard cap at 100 leads per request; clients chunk. Document in OpenAPI comment |
| `storage` interface methods hide complex Drizzle joins that don't port cleanly | Medium | High | Read each method in `server/storage.ts` during port; spike any that do 3+ table joins in Deno before porting the handler |
| RBAC helper shape diverges from KB reconcile PRD's `_shared/rbac.ts` | Low | Low | Align with whichever lands first; update the later PRD to match |
| Analytics SQL returns different numbers due to timezone / null handling differences | Medium | Medium | Regression test: run same date range through Express dev-server and edge function, diff JSON |

---

## 10. Open questions

1. **Does `lead-intelligence-service.batchProcessLeads` have an implicit rate limit on Claude calls?** Check before porting — we may want concurrency control in Deno (e.g., `p-limit` equivalent via `for (const chunk of chunks)` sequential).
2. **Are `lead_score_history` rows keyed by lead + timestamp?** Confirm the schema; some "history" tables in this repo use append-only append patterns, others are versioned rows.
3. **Is the BANT qualification schema per-lead-singleton or multi-version?** Affects whether `POST /bant/:leadId` should upsert or always-insert.

---

## 11. Definition of done

- [ ] All 26 endpoints live at `functions.printyx.net/lead-scoring/*` and `.../lead-intelligence/*`
- [ ] `LeadIntelligenceDashboard` + `BANTAssessment` work end-to-end in prod
- [ ] RLS verified on all 6 tables
- [ ] Express files deleted; route registrations removed
- [ ] Type checks + build pass
- [ ] Claude enrichment verified with a real lead (screenshot or recording)
- [ ] 72 hours stable before Phase 3 continues to US-013
