# PRD: Migrate Outreach to Edge Function (Pattern Proof)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 2 · **Week:** 3 (May 6 – May 12) · **Owner:** Dan Pearson

**Why this is first:** Outreach is small enough (22 endpoints, 6 tables, ~600 lines of handler code) to be migrated in a week, but exercises every shared utility from Phase 1. It's the proof-of-pattern every later domain follows.

**Depends on:** Phase 1 complete (all `_shared/*` utilities landed and `_db_probe` proven).

---

## 1. Scope

**Source Express files:**
- `server/routes/outreach-routes.ts` (22 endpoints, ~760 lines)
- `server/services/outreach/outreach-ai-service.ts` (~400 lines — Claude API integration)
- `server/services/outreach/specialty-knowledge-packs.ts` (~550 lines — pure data + helpers, no side effects)

**Target edge function:** `supabase/functions/outreach/index.ts` + `supabase/functions/_shared/anthropic.ts` + `supabase/functions/outreach/specialty-knowledge-packs.ts`

**Handler count:** 22 endpoints across specialties, business-context, specializations, sequences, prospects, drafts

**Tables touched:** 6 (`business_contexts`, `rep_specializations`, `outreach_sequences`, `outreach_sequence_steps`, `outreach_prospects`, `outreach_drafts`)

**Explicitly out of scope:**
- UI changes to Outreach pages (OutreachHub, BusinessContext, MySpecialty, SequenceStudio, DraftGenerator) — they already call `/api/outreach/*` which the frontend routes to `functions.printyx.net/outreach/*`, so no frontend work needed if parity holds.
- Background jobs (Outreach has none yet).

---

## 2. Endpoint parity matrix

| Method | Path | Express location (line) | Target edge path | Notes |
|---|---|---|---|---|
| GET | `/outreach/specialties` | outreach-routes.ts L76 | `/outreach/specialties` | Returns `SPECIALTY_PACKS`, no DB |
| GET | `/outreach/business-context` | L102 | `/outreach/business-context` | Effective context (user override or tenant default) |
| GET | `/outreach/business-context/all` | L115 | `/outreach/business-context/all` | Both tenant + user contexts |
| PUT | `/outreach/business-context` | L136 | `/outreach/business-context` | Upsert with scope='tenant' or 'user' |
| GET | `/outreach/specializations` | L185 | `/outreach/specializations` | Current user's specs |
| PUT | `/outreach/specializations` | L216 | `/outreach/specializations` | Bulk replace (txn) |
| GET | `/outreach/sequences` | L255 | `/outreach/sequences` | List user's sequences |
| GET | `/outreach/sequences/:id` | L269 | `/outreach/sequences/:id` | Detail + steps |
| POST | `/outreach/sequences/generate` | L301 | `/outreach/sequences/generate` | Claude call + insert |
| PATCH | `/outreach/sequences/:id` | L403 | `/outreach/sequences/:id` | Update |
| DELETE | `/outreach/sequences/:id` | L478 | `/outreach/sequences/:id` | Cascade delete steps |
| PATCH | `/outreach/sequence-steps/:id` | L427 | `/outreach/sequence-steps/:id` | Update step + re-lint |
| GET | `/outreach/prospects` | L501 | `/outreach/prospects` | List |
| POST | `/outreach/prospects` | L518 | `/outreach/prospects` | Create |
| PATCH | `/outreach/prospects/:id` | L527 | `/outreach/prospects/:id` | Update |
| DELETE | `/outreach/prospects/:id` | L549 | `/outreach/prospects/:id` | Delete |
| POST | `/outreach/drafts/generate` | L572 | `/outreach/drafts/generate` | Claude call + insert |
| GET | `/outreach/drafts` | L674 | `/outreach/drafts` | List with status filter + prospect hydration |
| PATCH | `/outreach/drafts/:id` | L725 | `/outreach/drafts/:id` | Update |
| POST | `/outreach/drafts/:id/mark-sent` | L747 | `/outreach/drafts/:id/mark-sent` | Status transition |
| POST | `/outreach/drafts/:id/mark-replied` | L761 | `/outreach/drafts/:id/mark-replied` | Sentiment capture |
| DELETE | `/outreach/drafts/:id` | L786 | `/outreach/drafts/:id` | Delete |

**22 endpoints total.** Public path shape matches exactly — frontend requires no changes.

---

## 3. Tables + RLS plan

All 6 tables already have migrations applied (0006_certain_jean_grey.sql). RLS policies land in `drizzle/rls/outreach.sql` as part of Phase 1 US-003.

| Table | tenant_id? | Notes |
|---|---|---|
| `business_contexts` | ✓ | `userId` NULL = tenant default; non-null = user override. Unique constraint `(tenant_id, user_id)` — Postgres treats NULL as distinct, which is OK here since app logic handles singleton tenant-default lookup. |
| `rep_specializations` | ✓ | Per-user. Unique `(user_id, specialty)`. |
| `outreach_sequences` | ✓ | Per-user (userId NOT NULL). |
| `outreach_sequence_steps` | ✓ | Child of sequences. `sequenceId` is FK (application-enforced, no DB-level constraint currently). |
| `outreach_prospects` | ✓ | Per-user staging. |
| `outreach_drafts` | ✓ | Per-user. Links to sequence+step+prospect. |

**RLS decision:** apply the standard 4-policy template from `_template.sql` — tenant isolation via JWT claim. No per-user row-level restriction at the DB layer; `userId` filtering stays in handler code (a user can be scoped to "my records" vs. "my tenant's records" depending on the endpoint).

---

## 4. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| Anthropic Claude API | `server/services/claude-ai-service.ts` | New `supabase/functions/_shared/anthropic.ts` — plain `fetch` to `api.anthropic.com/v1/messages`. Export `generateCompletion(options)` with the same signature. |
| Specialty knowledge packs | `server/services/outreach/specialty-knowledge-packs.ts` | Copy to `supabase/functions/outreach/specialty-knowledge-packs.ts` as-is (pure TS, no deps). Alternatively move to `shared/outreach-knowledge-packs.ts` for reuse if needed later. |
| Outreach AI service | `server/services/outreach/outreach-ai-service.ts` | Copy to `supabase/functions/outreach/_ai.ts` — imports `_shared/anthropic.ts` + local knowledge packs + `@shared/outreach-schema.ts`. All logic (prompt building, spam linter, JSON parsing) is pure and ports cleanly. |

No SendGrid, no Puppeteer, no WebSockets, no cron. Cleanest possible migration.

---

## 5. File layout

```
supabase/functions/
├── _shared/
│   ├── anthropic.ts              # NEW — Claude API fetch wrapper
│   ├── db.ts                     # from Phase 1
│   ├── auth.ts                   # from Phase 1
│   ├── http.ts                   # from Phase 1
│   ├── logger.ts                 # from Phase 1
│   ├── cors.ts                   # existing
│   └── supabase.ts               # existing
├── outreach/
│   ├── index.ts                  # URL-path dispatcher (main entry)
│   ├── handlers/
│   │   ├── business-context.ts   # GET/PUT business-context, GET /all
│   │   ├── specializations.ts    # GET, PUT, GET /specialties
│   │   ├── sequences.ts          # CRUD + generate
│   │   ├── prospects.ts          # CRUD
│   │   └── drafts.ts             # CRUD + generate + mark-sent/replied
│   ├── _ai.ts                    # generateSequence/generateDraft (ported from server/services/outreach/outreach-ai-service.ts)
│   └── specialty-knowledge-packs.ts
```

**Routing style:** single `serve()` in `index.ts`, parse `url.pathname`, dispatch to handler modules. Each handler exports a function that takes `(req, ctx, db, log) → Response`.

### Skeleton example (`outreach/index.ts`)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import * as businessContext from './handlers/business-context.ts';
import * as specializations from './handlers/specializations.ts';
import * as sequences from './handlers/sequences.ts';
import * as prospects from './handlers/prospects.ts';
import * as drafts from './handlers/drafts.ts';

const log = createLogger('outreach');

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/outreach/, '') || '/';
  const method = req.method;

  const t0 = Date.now();
  log.info({ requestId, method, path }, 'request_received');

  try {
    // Feature flag
    const tenantList = (Deno.env.get('OUTREACH_ENABLED_TENANTS') ?? '').split(',').filter(Boolean);

    const ctx = await requireAuth(req);

    if (tenantList.length > 0 && !tenantList.includes(ctx.tenantId)) {
      return errorResponse(403, 'Outreach is not enabled for your tenant', 'OUTREACH_NOT_ENABLED', undefined, requestId);
    }

    const db = getDb();
    const handlerCtx = { ctx, db, log: log.child?.({ requestId, userId: ctx.userId, tenantId: ctx.tenantId }) ?? log, requestId };

    // Dispatch
    if (path === '/specialties' && method === 'GET') {
      return specializations.listSpecialties(req, handlerCtx);
    }
    if (path === '/business-context' && method === 'GET') {
      return businessContext.getEffective(req, handlerCtx);
    }
    if (path === '/business-context/all' && method === 'GET') {
      return businessContext.getAll(req, handlerCtx);
    }
    if (path === '/business-context' && method === 'PUT') {
      return businessContext.upsert(req, handlerCtx);
    }
    // ... 18 more dispatches

    return errorResponse(404, 'Not found', 'NOT_FOUND', { path, method }, requestId);
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, err.code, undefined, requestId);
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', 'INTERNAL', undefined, requestId);
  } finally {
    log.info({ requestId, durationMs: Date.now() - t0 }, 'request_complete');
  }
});
```

---

## 6. Acceptance criteria

### Per-endpoint functional parity
- [ ] Every one of the 22 endpoints returns the same response shape as the Express version for equivalent inputs
- [ ] `POST /outreach/sequences/generate` with valid input returns a saved sequence + steps (Claude call succeeds)
- [ ] `POST /outreach/drafts/generate` with valid input returns a saved draft with variants (Claude call succeeds)
- [ ] `PATCH /outreach/sequence-steps/:id` re-runs the spam linter after edit
- [ ] `GET /outreach/drafts` hydrates each draft with its prospect data
- [ ] `GET /outreach/business-context` correctly prefers user override over tenant default

### Security / RLS
- [ ] RLS applied to all 6 tables (via `drizzle/rls/outreach.sql`)
- [ ] Two-tenant test: create a sequence as tenant A, attempt to `GET /outreach/sequences/:id` as tenant B → 404 (not 403 leaking existence — 404 because RLS filters it out of the SELECT)
- [ ] Attempt to insert with a forged `tenant_id` from frontend → rejected by RLS (logged as policy violation)

### Feature flag
- [ ] `OUTREACH_ENABLED_TENANTS` env var still gates access
- [ ] Unset = all tenants allowed (dev mode default)

### Frontend compatibility
- [ ] Each of the 5 Outreach pages loads without console errors:
  - `/outreach` (Hub)
  - `/outreach/business-context`
  - `/outreach/my-specialty`
  - `/outreach/sequence-studio`
  - `/outreach/draft-generator`
- [ ] Can complete the full happy path in production:
  1. Fill business context → save
  2. Pick a specialty → save
  3. Generate a sequence → save
  4. Add a prospect → save
  5. Generate a draft → copy → mark sent
- [ ] Verify in browser using Playwright MCP (`browser_navigate` to prod URL, run the flow, assert no console errors, take screenshots)

### Deletion (Express cleanup)
- [ ] `server/routes/outreach-routes.ts` deleted
- [ ] `server/services/outreach/outreach-ai-service.ts` deleted
- [ ] `server/services/outreach/specialty-knowledge-packs.ts` deleted (or moved to `shared/` if needed elsewhere)
- [ ] Registration removed from `server/routes-registry.ts` (`['/api/outreach', './routes/outreach-routes']` line)
- [ ] `grep -r "outreach-routes\|outreach-ai-service" server/ client/` returns zero matches

### Quality gates
- [ ] `deno check supabase/functions/outreach/**/*.ts` passes
- [ ] `npm run check` passes (TypeScript, once outreach-routes.ts is removed)
- [ ] `npm run build` succeeds
- [ ] No new `any` types introduced in the edge function handlers

---

## 7. Test plan

### Unit (Deno)
- `supabase/functions/outreach/_ai.test.ts` — test `lintForSpam`, `buildSystemPrompt` construction (pure functions).
- `supabase/functions/_shared/anthropic.test.ts` — mock fetch, verify request shape.

### Integration (local)
Run `supabase functions serve outreach` against local Supabase stack. Curl each endpoint with a test JWT:

```bash
# 1. Seed a business context
curl -X PUT http://localhost:54321/functions/v1/outreach/business-context \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"scope":"tenant","data":{"icpSummary":"test"}}'

# 2. Verify read-back
curl http://localhost:54321/functions/v1/outreach/business-context \
  -H "Authorization: Bearer $JWT"

# ... continue through all 22 endpoints
```

A script `tasks/outreach-integration-test.sh` is included in the PR that exercises all 22 endpoints end-to-end.

### Integration (production smoke)
After Coolify deploy:
1. Load `/outreach/business-context` in browser, edit a field, save, refresh — persists.
2. Load `/outreach/sequence-studio`, click "New sequence", fill angle, submit — sequence generated and saved.
3. Load `/outreach/draft-generator`, pick prospect, generate draft, copy, mark sent — status updates.

Use the Playwright MCP tools (`browser_navigate`, `browser_click`, `browser_type`, `browser_console_messages`, `browser_take_screenshot`) to script this.

### E2E (if applicable)
No existing Playwright tests touch Outreach (it's brand new). Consider adding one in this phase; otherwise the manual smoke test above suffices.

---

## 8. Rollback

If anything breaks:
1. Revert the Outreach edge function PR → Coolify auto-redeploys without it → endpoints return 404
2. The Outreach frontend pages stop working (as before the migration started)
3. No data is lost; tables + data remain intact
4. RLS policies stay on — they don't break anything, just enforce isolation
5. Re-deploy with fixes

No schema migrations are part of this PRD — rollback is code-only.

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Drizzle+postgres-js doesn't handle our `jsonb` array-of-object types correctly | Medium | High (`variants`, `pastWins`, `positioningObjections` columns use this) | Test early in US-007 with a fixture; if broken, fall back to raw SQL for those columns |
| Claude API calls exceed Deno edge function timeout (typically 60s) | Low | Medium | Claude usually responds in 5-15s for our prompts. Set explicit timeout to 45s; fail with clear error if exceeded. |
| RLS policy blocks a legitimate write due to JWT claim shape mismatch | Medium | High | Smoke test in dev with real JWT before prod deploy; verify `app_metadata.tenantId` is actually set on all tokens |
| `postgres` client connection to pooler fails on SSL or network | Low | High | Validated in Phase 1 `_db_probe` — if probe works, outreach will too |
| Feature flag check behaves differently (env var parsing) | Low | Low | Explicit test of `OUTREACH_ENABLED_TENANTS='a,b,c'` + `OUTREACH_ENABLED_TENANTS=''` + unset |

---

## 10. Open questions

1. **Should `specialty-knowledge-packs.ts` move to `shared/` for reuse?** Today it's outreach-only. If future features (e.g., AI-powered call scripts, response classification) need the same industry intel, `shared/outreach-knowledge-packs.ts` is the right home. Deferred decision — leave in `supabase/functions/outreach/` for now.
2. **Should we add Zod runtime validation to all PATCH endpoints, or trust the DB constraints + RLS?** Lean: add Zod. Defense in depth, and error messages are clearer.
3. **`generationContext` jsonb — any PII concerns?** It stores `specialtyBlend` and `angle` as metadata. No PII today. Confirm when multi-tenant productized.
4. **Index map vs. deep imports?** Decision in Phase 1 US-001. Assume import map by default.

---

## 11. Definition of done

- [ ] All 22 endpoints live at `functions.printyx.net/outreach/*`
- [ ] All 5 Outreach frontend pages work in production
- [ ] RLS verified on all 6 tables
- [ ] Express outreach files deleted
- [ ] Type checks + build pass
- [ ] Playwright MCP smoke test recording stored (or equivalent Loom) showing end-to-end happy path
- [ ] Deployed and stable for 72 hours without regression before moving on

---

## 12. Next up after Outreach ships

Phase 2 remainder (in parallel if capacity allows):
- `prd-migration-apollo-reconcile.md`
- `prd-migration-billing-reconcile.md`
- `prd-migration-knowledge-base-reconcile.md`
- `prd-migration-performance-reconcile.md`

Then Phase 3 (Core CRM) begins: lead-scoring, lead-assignment, customer-success, email-marketing.
