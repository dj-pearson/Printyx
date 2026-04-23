# PRD: Migrate AI Subsystem (Documentation + Employee + Search-Knowledge) to Edge Function(s)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 5 · **Week:** 13 (July 15 – July 21) · **Story:** US-020

**Why:** The AI subsystem is spread across 3 Express route files (2,032 lines) and 4 service files (2,878 lines) totaling nearly 5,000 lines of Claude-heavy code. All of it currently 404s in prod. Phase 2 already proved the fetch-based Claude API pattern via `_shared/anthropic.ts` (Outreach); this PRD exercises the same pattern at scale and adds a second dependency — **pgvector for semantic search embeddings**, which is new territory for this migration.

---

## 1. Scope

**Source Express files:**
- `server/routes/ai-documentation-routes.ts` (824 lines, **11 endpoints**) — AI-generated docs, sections, improvements, meeting→doc
- `server/routes/ai-employee-routes.ts` (463 lines, **10 endpoints**) — AI "employees" (virtual agents), tasks, workflows, analytics
- `server/routes/ai-search-knowledge-routes.ts` (745 lines, **9 endpoints**) — semantic search, entity extraction, embeddings, knowledge graph
- `server/routes/ai-routes-simple.ts` (50 lines, audit for count) — likely utility/test endpoints

**Services:**
- `server/services/ai-documentation-service.ts` (859 lines)
- `server/services/ai-employee-service.ts` (918 lines) — imports `ClaudeAIService`
- `server/services/ai-search-knowledge-service.ts` (960 lines) — pgvector + Claude
- `server/services/claude-ai-service.ts` (141 lines) — Anthropic SDK wrapper

**Edge side:** No existing AI edge functions.

**Target: 3 edge functions** (not one — separate access patterns and different rate-limit profiles):
```
supabase/functions/
├── ai-documentation/
│   ├── index.ts
│   ├── handlers/
│   │   ├── documents.ts           # 6 endpoints (CRUD + from-meeting + types)
│   │   ├── sections.ts            # POST /documents/:id/sections/generate
│   │   ├── improve.ts             # POST /documents/:id/improve
│   │   ├── knowledge.ts           # knowledge/articles endpoints
│   │   └── analytics.ts           # /analytics/writing
│   └── _service.ts                # ported from ai-documentation-service.ts
│
├── ai-employee/
│   ├── index.ts
│   ├── handlers/
│   │   ├── employees.ts           # 3 CRUD
│   │   ├── tasks.ts               # 2 endpoints
│   │   ├── performance.ts
│   │   ├── workflows.ts           # execute + list
│   │   ├── analytics.ts
│   │   └── templates.ts
│   └── _service.ts                # ported from ai-employee-service.ts
│
└── ai-search/
    ├── index.ts
    ├── handlers/
    │   ├── search.ts              # semantic + suggestions + feedback
    │   ├── entities.ts            # knowledge/entities CRUD + graph
    │   ├── embeddings.ts          # POST /search/embeddings
    │   └── analytics.ts
    └── _service.ts                # ported from ai-search-knowledge-service.ts
```

**Why split into 3?** (a) Cold-start budget: one monolith with all 3 services bundled is ~5K lines of JS + pgvector bindings — likely > 1s cold start. (b) Rate-limiting: search queries are high-volume (autocomplete), document generation is low-volume. (c) Deploy blast radius: documentation feature breakage shouldn't take down search.

**Explicitly out of scope:**
- Swapping Claude for another LLM — stay on `claude-3-5-sonnet-20241022` (or whichever model is current as of Phase 5 start)
- Adding new AI features during migration
- Fine-tuning or retraining embedding models

---

## 2. Endpoint parity matrix

### `ai-documentation-routes.ts` — 11 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/ai-documentation/documents` | 18 | generate doc |
| GET  | `/ai-documentation/documents` | 48 | list |
| GET  | `/ai-documentation/documents/:documentId` | 198 | detail |
| POST | `/ai-documentation/documents/from-meeting` | 418 | meeting → doc |
| POST | `/ai-documentation/documents/:documentId/sections/generate` | 445 | Claude |
| POST | `/ai-documentation/documents/:documentId/improve` | 472 | Claude |
| POST | `/ai-documentation/knowledge/articles` | 499 | |
| GET  | `/ai-documentation/knowledge/articles` | 524 | |
| POST | `/ai-documentation/documents/search` | 674 | keyword search |
| GET  | `/ai-documentation/analytics/writing` | 700 | |
| GET  | `/ai-documentation/document-types` | 723 | enum list |

### `ai-employee-routes.ts` — 10 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/ai-employee/ai-employees` | 23 | create virtual agent |
| GET  | `/ai-employee/ai-employees` | 55 | list |
| GET  | `/ai-employee/ai-employees/:employeeId` | 88 | detail |
| POST | `/ai-employee/ai-employees/tasks` | 121 | create task |
| GET  | `/ai-employee/ai-employees/:employeeId/tasks` | 147 | task list |
| GET  | `/ai-employee/ai-employees/:employeeId/performance` | 175 | metrics |
| POST | `/ai-employee/ai-employees/workflows/execute` | 213 | **Claude** |
| GET  | `/ai-employee/ai-employees/workflows` | 239 | |
| GET  | `/ai-employee/ai-employees/analytics/overview` | 266 | |
| GET  | `/ai-employee/ai-employees/templates` | 342 | |

### `ai-search-knowledge-routes.ts` — 9 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/ai-search/search/semantic` | 18 | **pgvector + Claude** |
| GET  | `/ai-search/search/suggestions` | 68 | autocomplete |
| POST | `/ai-search/search/feedback` | 112 | thumbs up/down |
| POST | `/ai-search/knowledge/entities` | 152 | |
| GET  | `/ai-search/knowledge/entities` | 181 | |
| GET  | `/ai-search/knowledge/entities/:entityId` | 407 | |
| POST | `/ai-search/search/embeddings` | 560 | **pgvector write** |
| GET  | `/ai-search/search/analytics` | 612 | |
| GET  | `/ai-search/knowledge/graph` | 635 | |

**Total: 30 endpoints + any from `ai-routes-simple.ts`.**

---

## 3. Tables + RLS plan

From grep of schemas (audit each for actual column names):
- `ai_documents`, `ai_document_sections`, `ai_document_knowledge_articles`
- `ai_employees`, `ai_employee_tasks`, `ai_employee_workflows`, `ai_employee_templates`
- `ai_knowledge_entities`, `ai_content_embeddings` (pgvector column), `ai_search_analytics`, `ai_search_feedback`

RLS files:
- `drizzle/rls/ai-documentation.sql`
- `drizzle/rls/ai-employee.sql`
- `drizzle/rls/ai-search.sql`

Standard 4-policy template on each.

**pgvector extension check:** `SELECT * FROM pg_extension WHERE extname = 'vector';` — confirm enabled. If not, `CREATE EXTENSION vector;` required as first migration step.

---

## 4. External dependencies to port

### Anthropic Claude
| Dependency | Express location | Deno port |
|---|---|---|
| `ClaudeAIService` wrapper | `server/services/claude-ai-service.ts` (141 lines) | Already ported in Phase 2 as `_shared/anthropic.ts` — extend if needed |
| Prompt templates | inlined in the 3 services | Copy verbatim to `_service.ts` files |

### pgvector (new for this migration)

Embeddings are stored as `vector(1536)` columns. Operations:
- `INSERT ... VALUES (...::vector)` — straightforward via Drizzle raw SQL
- `SELECT ... ORDER BY embedding <=> $1 LIMIT 10` — cosine distance search

**Deno-side considerations:**
- Drizzle doesn't have a native `vector` type yet. Use raw SQL for the insert/query paths.
- Embedding generation requires **OpenAI's `text-embedding-3-small` or similar** (Claude doesn't produce embeddings). Verify current call:

```typescript
// Likely in ai-search-knowledge-service.ts
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text,
});
```

**New dep:** `_shared/openai.ts` — fetch-based wrapper for the embeddings endpoint:

```typescript
export async function createEmbedding(text: string, model = 'text-embedding-3-small'): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text, model }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}
```

**Env var required:** `OPENAI_API_KEY` — add to Coolify. Document in env-var list.

### Other deps
| Dependency | Express location | Deno port |
|---|---|---|
| `storage` / Drizzle DB access | server/storage.ts | Direct Drizzle calls, including raw SQL for vector ops |
| Logger | server lib | `_shared/logger.ts` |

---

## 5. Service ports (big task)

Three service files totaling 2,737 lines. **Port each as `_service.ts` inside its edge function folder.** All are pure TS (Claude API + DB calls); verify no hidden Node-only imports.

**Verification step before porting each service:**
```bash
grep -E "^import.*from '(fs|path|child_process|os|crypto|url|stream)'" server/services/ai-*-service.ts
```
Any hits → resolve before port.

`crypto` is available in Deno via `crypto.subtle` or `https://deno.land/std/crypto` — not a blocker.

---

## 6. Acceptance criteria

### Functional parity
- [ ] All 30+ endpoints return the same shape as Express
- [ ] `POST /documents/:id/sections/generate` produces Claude output saved to DB; sample quality matches Express
- [ ] `POST /documents/:id/improve` produces improved version
- [ ] `POST /documents/from-meeting` converts meeting transcript → doc (note: depends on US-022 transcription; may stub until that's wired)
- [ ] `POST /search/semantic` returns relevance-ranked results using pgvector cosine distance
- [ ] `POST /search/embeddings` creates embedding via OpenAI and writes vector row
- [ ] `POST /workflows/execute` runs a Claude-orchestrated multi-step workflow
- [ ] Knowledge graph endpoint returns nodes + edges with correct tenant scoping

### pgvector readiness
- [ ] `vector` extension enabled in Supabase Postgres
- [ ] Existing `ai_content_embeddings` table preserved (no data loss)
- [ ] Index: `CREATE INDEX ON ai_content_embeddings USING ivfflat (embedding vector_cosine_ops);` exists or added
- [ ] Semantic search p95 latency < 800ms on 10K-row corpus

### External API readiness
- [ ] `OPENAI_API_KEY` set in Coolify; documented in env-var list
- [ ] `CLAUDE_API_KEY` confirmed set (existing from Phase 2)
- [ ] Rate-limit handling: 429 from OpenAI surfaces as 503 to frontend (retryable)
- [ ] Timeout: 45s on Claude calls, 15s on OpenAI embeddings

### Security / RLS
- [ ] RLS on all AI tables
- [ ] Two-tenant test: document in tenant A invisible to tenant B
- [ ] Embeddings for tenant A not returned in tenant B's semantic search (RLS applies to the SELECT before cosine distance computation)

### Frontend compatibility
- [ ] `AIAnalyticsDashboard.tsx` loads + populates
- [ ] AI Hub pages (if they exist — audit) load without console errors
- [ ] Semantic search UI returns results
- [ ] Playwright MCP pass on AI dashboard + search flow

### Deletion
- [ ] 3 Express route files deleted
- [ ] `ai-routes-simple.ts` deleted (or endpoints merged into appropriate target function)
- [ ] 4 service files deleted (ported to `_service.ts` in each edge function)
- [ ] `@anthropic-ai/sdk` removed from package.json (if Outreach + AI features were sole consumers)
- [ ] `openai` package removed from package.json (if not used elsewhere)
- [ ] Route registry entries removed

### Quality gates
- [ ] `deno check` passes on all 3 edge functions
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 7. Test plan

### Unit (Deno)
- `_shared/openai.test.ts` — mock fetch, verify embedding request shape
- Per-service tests for prompt builders (pure functions)
- pgvector raw SQL: insert + query path with fixture data

### Integration
- Local: generate a document end-to-end (create → generate sections → improve), verify Claude calls succeed
- Semantic search: seed 100 embeddings, query with known-match input, verify top-1 is expected
- AI employee workflow: execute a 3-step workflow, verify all 3 Claude calls happen and output persisted

### Performance
- **Cold start** — each of 3 functions < 1s target
- **Semantic search p95** — < 800ms on production-size index
- **Claude call p95** — 5-10s typical; enforce 45s timeout

### Production smoke
- Generate a real document in prod, verify output quality matches a recent Express-era doc
- Run semantic search on real content, verify results meaningful
- Create an AI employee, execute its workflow

---

## 8. Rollback

Standard: revert PR. Express files are 404'ing in prod today → rollback is to baseline.

**Data caution:** embeddings table is preserved across rollback (no schema changes). If pgvector extension was freshly enabled, `DROP EXTENSION vector;` is not needed (extensions don't affect rollback of code).

**Cost caution:** each Claude + OpenAI call costs money. Cap spend via tenant-scoped rate limits in `_shared/rate-limit.ts` (new file) — e.g., 100 document generations / tenant / day.

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| pgvector not enabled in Supabase; data access broken | Low | High | Check at Phase 5 kickoff; if not enabled, file pre-work ticket |
| Drizzle doesn't handle `vector` column gracefully; raw SQL required everywhere | High | Medium | Accept; use raw SQL with parameterized `${embedding}::vector` — documented pattern |
| OpenAI API key leak from env | Low | High | Service-role access only; never returned in responses; log-scan in CI |
| Claude / OpenAI cost runaway from abuse or bug | Medium | High | Per-tenant rate limits in `_shared/rate-limit.ts`; soft cap + alert |
| Port of 3 large services introduces regressions in AI output quality | High | Medium | Fixture-based regression tests with snapshot comparison (tolerant of wording drift) |
| Cold start worse than target due to large `_service.ts` files | Medium | Low | Measure; if bad, split further (e.g., separate `ai-employee-workflows/` function) |
| Meeting → doc endpoint blocked by US-022 transcription stub | Medium | Low | Leave endpoint functional for direct text input; full meeting flow deferred |

---

## 10. Open questions

1. **Is `openai` npm package in use today or does the search-knowledge-service use `fetch` already?** Read service to confirm the exact embedding call path.
2. **What embedding model is currently in use?** `text-embedding-3-small` (1536 dims) vs `text-embedding-ada-002` (1536 dims) vs newer. Affects vector column dimension and any reprocessing of existing data.
3. **Are AI employee "workflows" Claude-orchestrated multi-step agents or just saved task templates?** Affects complexity of the workflow execution endpoint.
4. **Where do document templates live?** DB-backed or in code?
5. **Knowledge graph representation** — normalized edges table or JSONB on entities? Affects graph endpoint query complexity.
6. **Rate limiting pattern** — build `_shared/rate-limit.ts` as part of this PRD or defer to a separate PR? Lean: build it here (lowest-cost, highest-value addition during the AI port).
7. **Embedding regeneration** — if `text-embedding-3-small` is current but old rows use `ada-002`, is there a reprocessing job? That'd be a cron candidate for Phase 6.

---

## 11. Definition of done

- [ ] 3 edge functions live at `functions.printyx.net/ai-documentation/*`, `ai-employee/*`, `ai-search/*`
- [ ] pgvector confirmed operational with existing data intact
- [ ] Claude + OpenAI wrappers in `_shared/`
- [ ] Per-tenant rate limits on expensive endpoints
- [ ] 3 Express files + 4 services deleted
- [ ] `@anthropic-ai/sdk` + `openai` removed from package.json (if exclusive consumers)
- [ ] All AI UI pages functional in prod
- [ ] Type checks + build pass
- [ ] 72 hours stable before Phase 5 moves to US-021
