# PRD: Reconcile Apollo (Express + Edge Function overlap)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 2 · **Week:** 4

**Why:** Apollo lead enrichment exists in both backends. Pick one, delete the other.

---

## 1. Scope

**Express side:**
- `server/routes/apollo-routes.ts` (~12 endpoints)
- `server/apollo-client.ts` (API wrapper — direct HTTPS calls, NOT Apollo GraphQL client, despite the name)
- `server/apollo-storage.ts` (search cache + tenant lead storage)
- `server/data-enrichment-mapping.ts` (imported by apollo flow)

**Edge side:**
- `supabase/functions/apollo/index.ts` (existing — endpoint count TBD in audit step)

**Target:** `supabase/functions/apollo/` is canonical. Everything in Express is either ported over or deleted.

---

## 2. Parity audit (first acceptance criterion)

Before writing any code, produce `docs/apollo-parity.md`:

| Method | Path | Express impl | Edge impl | Status | Action |
|---|---|---|---|---|---|
| POST | `/apollo/search` | ✓ | ? | | |
| POST | `/apollo/enrich` | ? | ? | | |
| GET  | `/apollo/contacts` | ? | ? | | |
| ... | ... | ... | ... | ... | ... |

**Status values:** `only-express`, `only-edge`, `both-match`, `both-diverged`.

**Action values:** `port-to-edge`, `keep-edge`, `verify-parity`, `delete-express`.

---

## 3. Tables touched

From audit: apollo_contacts_cache (centralized), apollo_tenant_leads, apollo_search_cache, and any others apollo-storage.ts writes to. RLS applied per `drizzle/rls/apollo.sql`.

---

## 4. Acceptance criteria

- [ ] `docs/apollo-parity.md` published (the audit)
- [ ] Every Express-only endpoint ported to the edge function
- [ ] Both-match endpoints: pick one, delete Express
- [ ] Both-diverged endpoints: reconcile (usually edge wins; document exceptions)
- [ ] `drizzle/rls/apollo.sql` applies RLS to all apollo_* tables
- [ ] Frontend pages using Apollo still work:
  - `/data-enrichment` (DataEnrichment.tsx)
  - `/apollo-lead-enrichment` (ApolloLeadEnrichment.tsx)
- [ ] Express files deleted:
  - `server/routes/apollo-routes.ts`
  - `server/apollo-client.ts`
  - `server/apollo-storage.ts`
- [ ] Route registration removed from `server/routes-registry.ts` (`['/api/apollo', './routes/apollo-routes']`)
- [ ] `grep -r "apollo-client\|apollo-storage\|apollo-routes" server/ client/` returns zero matches
- [ ] Verify in browser with Playwright MCP — run a real Apollo search end-to-end

---

## 5. External dependencies

Apollo uses `APOLLO_API_KEY` (or per-tenant keys). The edge function already has this pattern — verify key resolution is the same as Express.

---

## 6. Rollback

Revert the reconciliation PR. If Express is deleted mid-way, `git revert` restores it; the edge function stays deployed (non-breaking). If the edge function regresses, frontend Apollo features degrade to "not working" — acceptable short-term.

---

## 7. Open questions

1. Does `supabase/functions/apollo/` use the new `_shared/` utilities or the old supabase-js pattern? If old, refactor to the new pattern as part of this PRD.
2. Is `apollo_search_cache` being actively used (hit rate worth the complexity)? If stale, drop the cache table as part of cleanup.
3. Per-tenant Apollo API keys — confirm storage pattern (env var list vs. DB table).

---

## 8. Test plan

Smoke: perform a search on `/data-enrichment`, verify results, add a contact to the CRM, confirm it appears in business_records.
