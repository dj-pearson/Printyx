# PRD: Reconcile Knowledge Base (Express + Edge Function overlap)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 2 · **Week:** 4

**Why:** KB has 2 Express files (public + admin) vs. 1 edge function. Reconciliation is straightforward — the data model is simple.

---

## 1. Scope

**Express side:**
- `server/routes/knowledge-base-routes.ts` (~12 endpoints — public reads, article interactions)
- `server/routes/knowledge-base-admin-routes.ts` (~12 endpoints — author/editor/publisher workflows)
- Related: `server/routes/article-bookmarks-routes.ts`, `server/routes/article-ratings-routes.ts`, `server/routes/reading-history-routes.ts`, `server/routes/content-gap-analysis-routes.ts`

**Edge side:**
- `supabase/functions/knowledge-base/index.ts`

**Target:** `supabase/functions/knowledge-base/` canonical. Admin endpoints merged into same function (path-routed) or split into `supabase/functions/knowledge-base-admin/` — decision in audit step.

---

## 2. Parity audit

Produce `docs/kb-parity.md`. Categorize endpoints:

| Category | Endpoints |
|---|---|
| Public read | list articles, get article, search, categories, tags |
| User interaction | bookmark, unbookmark, rate, mark-read, reading history |
| Author | create draft, save, request review |
| Editor | list pending, approve, request revisions |
| Publisher | publish, schedule, unpublish |
| Analytics | article views, most-read, gap analysis |

---

## 3. Tables touched

From schema: `articles`, `article_versions`, `article_bookmarks`, `article_ratings`, `reading_history`, `article_votes`, `article_categories`, `article_tags`, `content_queue`.

RLS file: `drizzle/rls/knowledge-base.sql`. All tables tenant-scoped except possibly shared content taxonomy (categories/tags may be global — verify).

---

## 4. Acceptance criteria

- [ ] `docs/kb-parity.md` published
- [ ] Edge function covers all 24+ endpoints from Express
- [ ] RLS applied (`drizzle/rls/knowledge-base.sql`)
- [ ] Admin access control: RBAC checks (author/editor/publisher roles) work correctly in edge function — port from `enhanced-rbac-middleware` pattern
- [ ] Frontend pages work:
  - `/knowledge-base` (KnowledgeBase.tsx)
  - `/knowledge-base/admin` (KnowledgeBaseAdmin.tsx)
  - `/knowledge-base/:slug` (KnowledgeArticle.tsx)
  - `/knowledge-base/editor/:id` (ArticleEditor.tsx)
- [ ] Delete:
  - `server/routes/knowledge-base-routes.ts`
  - `server/routes/knowledge-base-admin-routes.ts`
  - `server/routes/article-bookmarks-routes.ts`
  - `server/routes/article-ratings-routes.ts`
  - `server/routes/reading-history-routes.ts`
  - `server/routes/content-gap-analysis-routes.ts`
- [ ] Route registrations removed
- [ ] Verify in browser with Playwright MCP

---

## 5. RBAC in edge functions

KB admin routes use `requirePermission(['content.article.author'])` style in Express. Port this to a `requirePermission(ctx, permissions[])` helper in `_shared/rbac.ts`:

```typescript
// _shared/rbac.ts
export async function requirePermission(
  ctx: AuthContext,
  permissions: string[],
): Promise<void> {
  // Lookup user's permissions from DB (role_permissions join)
  // Throw AuthError(403) if none match
}
```

This helper is new — define it in the first domain that needs RBAC and reuse from there. Document the pattern in `_shared/README.md` after first use.

---

## 6. Rollback

Standard: revert PR. KB is low-criticality (content site). Worst case: articles can't be edited for a few hours while rolling forward.

---

## 7. Open questions

1. Are categories/tags global (not tenant-scoped) or per-tenant? Schema review needed.
2. `content-gap-analysis` — is this tightly coupled to KB or a standalone feature that could migrate separately?
3. Article versioning — are drafts visible across users in the same tenant (collab editing) or isolated per author?

---

## 8. Test plan

- Public: search for an article, read it, bookmark, rate.
- Author: create draft, save, submit for review.
- Editor: approve/reject pending article.
- Publisher: publish, then verify it shows in public list.
