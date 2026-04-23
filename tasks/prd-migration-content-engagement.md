# PRD: Migrate Content Engagement (Bookmarks, Ratings, Reading History)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 6 · **Week:** 15 (July 29 – Aug 4) · **Story:** US-025

**Why:** Three small Express files handle article engagement on top of the knowledge base. Per the Phase 2 KB reconcile PRD, these were flagged to "likely merge into existing `knowledge-base/` edge function." This PRD confirms that decision and executes it — 19 endpoints consolidated into the already-canonical KB function.

---

## 1. Scope

**Source Express files:**
- `server/routes/article-bookmarks-routes.ts` (331 lines, **6 endpoints**)
- `server/routes/article-ratings-routes.ts` (446 lines, **7 endpoints**) — includes votes (2 endpoints)
- `server/routes/reading-history-routes.ts` (398 lines, **6 endpoints**)

**Target:** extend `supabase/functions/knowledge-base/` (canonical after Phase 2 US-010) with 3 new handler modules. No new edge function.

```
supabase/functions/knowledge-base/
├── handlers/
│   ├── articles.ts                    # existing — public reads
│   ├── admin.ts                       # existing — author/editor flows
│   ├── bookmarks.ts                   # NEW — 6 endpoints
│   ├── ratings.ts                     # NEW — 7 endpoints (ratings + votes)
│   └── reading-history.ts             # NEW — 6 endpoints
└── ...
```

**Explicitly out of scope:**
- Changing the data model for article engagement
- Adding recommendation engines, personalization, or ML-based ranking (stay read-only analytics)

---

## 2. Endpoint parity matrix

### `article-bookmarks-routes.ts` — 6 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/article-bookmarks/` | 32 | list user's bookmarks |
| POST   | `/article-bookmarks/` | 111 | create |
| PUT    | `/article-bookmarks/:id` | 171 | update (e.g., rename collection) |
| DELETE | `/article-bookmarks/:id` | 222 | |
| GET    | `/article-bookmarks/collections` | 262 | group bookmarks by collection |
| GET    | `/article-bookmarks/check/:articleId` | 305 | is-bookmarked check |

### `article-ratings-routes.ts` — 7 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/article-ratings/:articleId` | 38 | aggregate rating for article |
| POST   | `/article-ratings/` | 125 | submit rating |
| GET    | `/article-ratings/user/:articleId` | 227 | my rating for article |
| POST   | `/article-ratings/votes` | 264 | upvote/downvote (helpfulness) |
| GET    | `/article-ratings/votes/user/:articleId` | 342 | my vote |
| DELETE | `/article-ratings/:ratingId` | 372 | |
| DELETE | `/article-ratings/votes/:voteId` | 411 | |

### `reading-history-routes.ts` — 6 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/reading-history/` | 32 | list history (paginated) |
| POST   | `/reading-history/` | 99 | record view |
| GET    | `/reading-history/recent` | 190 | recent N articles |
| GET    | `/reading-history/stats` | 245 | time spent, articles read |
| GET    | `/reading-history/:articleId` | 345 | history for specific article |
| DELETE | `/reading-history/:articleId` | 375 | clear user's history for article |

**Total: 19 endpoints.**

---

## 3. Tables + RLS plan

- `article_bookmarks` — `(tenant_id, user_id, article_id, collection_name)`
- `article_bookmark_collections` — may or may not be a separate table
- `article_ratings` — `(tenant_id, user_id, article_id, rating, review_text)`
- `article_votes` — `(tenant_id, user_id, article_id, vote)` — upvote/downvote
- `reading_history` — `(tenant_id, user_id, article_id, read_at, duration_seconds)`

RLS file: `drizzle/rls/knowledge-base-engagement.sql` applies standard template on all 4-5 tables.

**Per-user scoping:** endpoints like "my bookmarks" are scoped by `(tenant_id, user_id)`. RLS filters by tenant; handler filters by user.

**Aggregates:** `GET /article-ratings/:articleId` returns an average across ALL users in the tenant (not per-user). RLS still applies — cross-tenant aggregation impossible.

---

## 4. Considerations

### Reading history write volume
`POST /reading-history/` is likely called on every article page view. If a user reads 20 articles/day, that's modest. But if ambitious aggregation happens client-side (e.g., view heartbeats every 30s), volume balloons.

**Inspection step:** read the frontend to see write frequency. If excessive, consider:
- Debouncing client-side (write once per article, not per heartbeat)
- Updating `duration_seconds` via UPDATE not INSERT on subsequent heartbeats

### Upsert semantics for bookmarks + ratings
A user can only bookmark / rate / vote an article once. Enforce via:
- `UNIQUE (tenant_id, user_id, article_id)` constraint
- Handler uses `ON CONFLICT DO UPDATE` (upsert)

Verify schema has the unique constraints; add migration if missing.

### Article stats feedback loop
`GET /reading-history/stats` returns user-level stats (articles read, total time). Could feed into gamification. Keep output contract identical to Express; don't add new fields.

---

## 5. Acceptance criteria

### Functional parity
- [ ] All 19 endpoints return the same shape as Express
- [ ] Bookmark upsert prevents duplicates (unique constraint)
- [ ] Rating submission with existing rating replaces (not duplicates)
- [ ] Vote submission with existing vote replaces (not duplicates)
- [ ] Reading history records unique per (user, article, timestamp) — not collapsed
- [ ] Aggregates: article rating avg + vote count match Express for fixture data
- [ ] Stats: articles-read + time-spent counts match

### Security / RLS
- [ ] RLS on all 4-5 engagement tables
- [ ] Two-user test: user A's bookmarks invisible to user B (within same tenant — handler-level scoping)
- [ ] Two-tenant test: rating on article X in tenant A doesn't appear in tenant B's aggregate
- [ ] Can't rate / bookmark / record view for an article outside your tenant

### Frontend compatibility
- [ ] Knowledge base article page: bookmark button toggles, rating UI works, history records
- [ ] Bookmark management page loads with collections
- [ ] Reading history page loads with pagination
- [ ] Playwright MCP pass on KB article + engagement flow

### Deletion
- [ ] 3 Express files deleted
- [ ] Route registry entries removed
- [ ] `grep -r "article-bookmarks-routes\|article-ratings-routes\|reading-history-routes" server/` returns zero matches

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 6. Test plan

### Unit (Deno)
- Upsert behavior for bookmarks, ratings, votes
- Aggregate calculation on fixture data

### Integration
- Read an article 10 times; verify reading_history records (or aggregates, depending on design)
- Rate an article; change rating; verify single row with latest value
- Bookmark → unbookmark → re-bookmark; verify no orphan rows

### Production smoke
- Open KB article, bookmark it, rate 5 stars, verify all three persist
- Open recently-read list, verify article appears

---

## 7. Rollback

Trivial. Engagement data is non-critical; revert PR, 404 returns until rollback — users see slightly degraded UX (no bookmarks) but can still read articles.

No schema changes (unless unique constraints need backfill — document if so).

---

## 8. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Missing unique constraints lead to duplicate bookmarks on retry | Medium | Low | Verify constraints in schema; add migration if missing |
| Reading history write volume unexpectedly high → table growth | Medium | Medium | Index on `(tenant_id, user_id, read_at)` + retention policy (delete history > 90 days via pg_cron) |
| Aggregate queries slow on large article sets | Low | Low | Index on `(tenant_id, article_id)` in ratings + votes |
| Cross-user visibility of personal engagement data (leak) | Low | Medium | Test every GET endpoint with another user's JWT; verify 403/404 |
| Frontend doesn't update cached counts after mutation | Low | Low | Not a migration issue; flag for frontend follow-up |

---

## 9. Open questions

1. **Are there article recommendation / related-article features depending on reading history?** If yes, those continue to read the same table — no migration impact.
2. **Bookmark collections** — how are they stored? Separate table, JSON array column, or comma-separated? Affects `GET /collections` port.
3. **Rating vs vote distinction** — "rating" is 1-5 stars; "vote" is helpful/not-helpful? Confirm before port.
4. **Retention for reading history** — keep forever, or trim? If trim, pg_cron job in US-026.
5. **Anonymous reading** — can unauthenticated users browse KB and get history recorded? Current code uses `req.session?.user` — likely authenticated-only. Confirm.
6. **Analytics integration** — do bookmarks / ratings feed into AI search or content-gap analysis? If yes, cross-check with US-010 and US-015 already-migrated domains.

---

## 10. Definition of done

- [ ] All 19 endpoints live under `knowledge-base/` edge function (merged)
- [ ] 3 Express files deleted
- [ ] RLS on all 4-5 engagement tables
- [ ] Article engagement flows work in prod
- [ ] Type checks + build pass
- [ ] 72 hours stable before Phase 6 moves to US-026 / US-027
