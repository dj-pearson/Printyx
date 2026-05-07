# Blog Module — Shared Helpers (Edge Functions)

Foundation directory created by **US-BLOG-001**. Subsequent BLOG-### stories
populate this with parsers, generators, and adapter interfaces shared across
edge functions in `supabase/functions/blog/*`.

## Planned Subdirectories

- `cms/` — CMS adapter interface + WordPress and Ghost adapters (US-BLOG-006)
- `keyword/` — keyword research adapter interface + DataForSEO adapter (US-BLOG-013)
- `serp/` — SERP analyzer + People-Also-Ask + autocomplete miners (US-BLOG-015..016)
- `social/` — per-platform syndication generators (US-BLOG-043..052)
- `analytics/` — GA4 + Search Console fetchers (US-BLOG-059)
- `agents/` — multi-agent draft pipeline + auto-refresh agent (US-BLOG-072, US-BLOG-066)
- `safety/` — kill-switch check + change-magnitude guardrails (US-BLOG-086)

## Conventions

- All exports are pure async functions or class instances (no top-level state).
- Auth and tenant resolution stay in the entry-point edge functions
  (`supabase/functions/blog/*/index.ts`); helpers in this directory accept
  `tenantId` and Supabase clients as arguments.
- Credential storage reuses the address-book credential vault
  (`server/services/address-book/credential-vault.ts` from ABK-002).
  Recommend generalizing during US-BLOG-006 — see progress.txt note on
  renaming the env var to `PRINTYX_CREDENTIAL_VAULT_KEY`.
