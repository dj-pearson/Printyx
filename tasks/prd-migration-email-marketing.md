# PRD: Migrate Email Marketing + Content Gap Analysis to Edge Functions

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 3 · **Week:** 8 (June 10 – June 16) · **Story:** US-015

**Why:** Email marketing is the last big Phase-3 Express-only domain. It's also the first domain in this migration that carries a **Node-only package dependency** (`@sendgrid/mail`) — proving the fetch-based REST replacement pattern here unblocks later phases (field service, calendars, notifications). Content gap analysis is bundled because it's already admin-tooling for the same content pipeline and shares tables with the email template system.

---

## 1. Scope

**Source Express files:**
- `server/routes/email-marketing-routes.ts` (760 lines, **35 endpoints**) — mounted at `/api/email-marketing` (verify in registry)
- `server/routes/content-gap-analysis-routes.ts` (196 lines, **5 endpoints**) — mounted at `/api/content-gap-analysis`

**Services:**
- `server/services/email-service.ts` (257 lines) — the SendGrid wrapper. Supports fallback providers (`EMAIL_PROVIDER: 'sendgrid' | 'aws-ses' | 'resend' | 'simulation'`) via dynamic import at L59
- `server/services/content-gap-analysis-service.ts` (596 lines) — analysis engine (pure logic, no external deps)

**Existing edge functions (overlap):**
- `supabase/functions/email-campaigns/index.ts` (364 lines) — CRUD for campaigns — merge/reconcile
- `supabase/functions/email-templates/index.ts` (276 lines) — CRUD for templates — merge/reconcile

**Target edge functions:**
```
supabase/functions/email-marketing/          # NEW — consolidates everything email
├── index.ts                                 # dispatcher
├── handlers/
│   ├── templates.ts                         # 5 endpoints (merges email-templates/)
│   ├── campaigns.ts                         # 7 endpoints (merges email-campaigns/)
│   ├── sends.ts                             # 5 endpoints (individual + bulk)
│   ├── events.ts                            # 3 endpoints (opens, clicks, bounces)
│   ├── lists.ts                             # 6 endpoints (CRUD + refresh-counts)
│   ├── list-members.ts                      # 5 endpoints (incl. bulk add)
│   ├── unsubscribes.ts                      # 3 endpoints
│   └── webhooks-sendgrid.ts                 # 1 endpoint — POST /webhooks/sendgrid (event ingest)
└── _sendgrid.ts                             # fetch wrapper replacing @sendgrid/mail

supabase/functions/content-gap-analysis/     # NEW — small, standalone
├── index.ts                                 # dispatcher (5 endpoints)
└── _engine.ts                               # analysis logic ported from service
```

**Why two edge functions, not one:** email-marketing is CRUD-heavy + outbound-call-heavy; content-gap is admin-only analytics. Different access patterns, different RBAC (content-gap is admin-only via `requireAdmin`). Keeping them separate avoids one function's cold-start dragging the other down.

**Explicitly out of scope:**
- Email provider failover logic (AWS SES, Resend). Phase 3 ports only SendGrid; provider abstraction is re-examined in Phase 5 if needed.
- Scheduled campaign sends — the send queue today is API-triggered. If cron-based sends exist in prod, they move to `pg_cron` per Phase 6 US-026.
- Inbound email parsing (`email-parser-schema.ts`, `routes-email-parser.ts`) — separate domain, not in this PRD.

---

## 2. Endpoint parity matrix

### `email-marketing-routes.ts` (35 endpoints)

#### Templates (5)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/email-marketing/email-templates` | 19 | |
| GET    | `/email-marketing/email-templates/:id` | 41 | |
| POST   | `/email-marketing/email-templates` | 61 | |
| PATCH  | `/email-marketing/email-templates/:id` | 86 | |
| DELETE | `/email-marketing/email-templates/:id` | 111 | |

#### Campaigns (7)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/email-marketing/email-campaigns` | 127 | |
| GET    | `/email-marketing/email-campaigns/:id` | 148 | |
| POST   | `/email-marketing/email-campaigns` | 168 | |
| PATCH  | `/email-marketing/email-campaigns/:id` | 194 | |
| DELETE | `/email-marketing/email-campaigns/:id` | 215 | |
| POST   | `/email-marketing/email-campaigns/:id/refresh-metrics` | 231 | aggregates opens/clicks |
| GET    | `/email-marketing/email-campaigns/:campaignId/sends` | 252 | |

#### Sends (5)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/email-marketing/email-sends/:id` | 268 | |
| POST   | `/email-marketing/email-sends` | 288 | **SendGrid call** — single send |
| POST   | `/email-marketing/email-sends/bulk` | 311 | **SendGrid call** — batch send |
| PATCH  | `/email-marketing/email-sends/:id` | 336 | status update |
| GET    | `/email-marketing/email-sends/:sendId/events` | 357 | |

#### Events (3)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/email-marketing/email-campaigns/:campaignId/events` | 373 | |
| POST   | `/email-marketing/email-events` | 393 | manual event record |
| POST   | `/email-marketing/webhooks/sendgrid` | 725 | **unauthenticated** — SendGrid posts here |

#### Lists (6)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/email-marketing/email-lists` | 416 | |
| GET    | `/email-marketing/email-lists/:id` | 437 | |
| POST   | `/email-marketing/email-lists` | 457 | |
| PATCH  | `/email-marketing/email-lists/:id` | 483 | |
| DELETE | `/email-marketing/email-lists/:id` | 504 | |
| POST   | `/email-marketing/email-lists/:id/refresh-counts` | 520 | |

#### List Members (5)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/email-marketing/email-lists/:listId/members` | 541 | |
| GET    | `/email-marketing/email-list-members/:id` | 561 | |
| POST   | `/email-marketing/email-list-members` | 581 | |
| POST   | `/email-marketing/email-list-members/bulk` | 604 | |
| PATCH  | `/email-marketing/email-list-members/:id` | 629 | |
| DELETE | `/email-marketing/email-list-members/:id` | 650 | |

#### Unsubscribes (3)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/email-marketing/email-unsubscribes` | 666 | |
| POST   | `/email-marketing/email-unsubscribes` | 686 | |
| GET    | `/email-marketing/email-unsubscribes/check/:email` | 709 | |

**Total: 35.**

### `content-gap-analysis-routes.ts` (5 endpoints — admin-only)

| Method | Path | Line | Notes |
|---|---|---|---|
| GET  | `/content-gap-analysis/` | 38 | list analyses |
| GET  | `/content-gap-analysis/summary` | 64 | aggregated gap report |
| GET  | `/content-gap-analysis/:id` | 94 | detail |
| GET  | `/content-gap-analysis/priorities` | 137 | sorted by priority |
| POST | `/content-gap-analysis/refresh` | 173 | triggers re-analysis |

---

## 3. Tables touched + RLS plan

**Email marketing tables** (defined in `shared/schema.ts`):
- `email_templates`
- `email_campaigns`
- `email_sends`
- `email_events` (opens, clicks, bounces — high-volume)
- `email_lists`
- `email_list_members`
- `email_unsubscribes`

**Content gap tables** (from `shared/content-marketing-schema.ts`):
- `content_gap_analyses`
- `content_gap_opportunities` (or similar — verify)

RLS files:
- `drizzle/rls/email-marketing.sql` — standard 4-policy template on all 7 tables
- `drizzle/rls/content-gap-analysis.sql` — policies scoped to `tenant_id` + admin-only INSERT/UPDATE via role check

**Note:** `email_unsubscribes` has a special read case — public check by `email` for compliance. Add a policy that allows SELECT on this table for the `anon` role filtered by the email in the URL path, OR route the check-by-email endpoint through a service-role query (preferred — simpler).

**SendGrid webhook RLS** — `POST /webhooks/sendgrid` is public (no JWT). The handler uses the service-role client to write `email_events`; tenant resolution happens by looking up the `email_send_id` custom arg SendGrid echoes back.

---

## 4. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| `@sendgrid/mail` (dynamic import) | `server/services/email-service.ts:59` | Replace with `fetch` to `https://api.sendgrid.com/v3/mail/send` using bearer `SENDGRID_API_KEY`. Port the minimum API surface used by the codebase (single send + batch personalizations). |
| `IStorage` methods for email/list CRUD | `server/storage.ts` | Reimplement as Drizzle calls in handlers |
| `ContentGapAnalysisService` | `server/services/content-gap-analysis-service.ts` | Port the class to `_engine.ts` — pure TS, no deps. ~596 lines of analysis math. |
| SendGrid webhook signature verification | TBD — verify current implementation | Port if present. If missing today, **add** per SendGrid docs: HMAC-SHA256 on `X-Twilio-Email-Event-Webhook-Signature` using public key |

**Fallback providers (AWS SES, Resend, simulation):** NOT ported in this PRD. Document as follow-up; simulation mode (`EMAIL_PROVIDER=simulation` → log-only) can be replicated in Deno with a simple `if` branch.

---

## 5. SendGrid REST wrapper

`supabase/functions/email-marketing/_sendgrid.ts`:

```typescript
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

export async function sendEmail(msg: {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
  customArgs?: Record<string, string>;
}): Promise<{ messageId: string }> {
  if (!SENDGRID_API_KEY) {
    // Simulation mode
    return { messageId: `sim-${crypto.randomUUID()}` };
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: (Array.isArray(msg.to) ? msg.to : [msg.to]).map(e => ({ email: e })), custom_args: msg.customArgs }],
      from: { email: msg.from },
      subject: msg.subject,
      content: [
        ...(msg.text ? [{ type: 'text/plain', value: msg.text }] : []),
        { type: 'text/html', value: msg.html },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
  }
  return { messageId: res.headers.get('X-Message-Id') ?? 'unknown' };
}

export async function sendBulk(msgs: SendArgs[]): Promise<{ messageIds: string[] }> {
  // Batch via single request with multiple `personalizations`
  // SendGrid allows up to 1000 personalizations per request
}
```

**Reference:** https://docs.sendgrid.com/api-reference/mail-send/mail-send

---

## 6. Webhook handler

`POST /webhooks/sendgrid` is special — public, high-volume, idempotent.

**Handler flow:**
1. Verify signature (HMAC) — reject 401 if invalid
2. Parse event array (SendGrid posts arrays of events)
3. For each event: resolve `email_send_id` from `custom_args`, upsert into `email_events` with `(send_id, event_type, timestamp)` as a unique key
4. Return 200 immediately (SendGrid retries on non-2xx)

**Idempotency:** event timestamps are ms-precision; collisions are unlikely but possible. Use `ON CONFLICT DO NOTHING` on `(send_id, event_type, timestamp, email)` composite unique constraint — verify schema has this index.

---

## 7. Acceptance criteria

### Functional parity
- [ ] All 35 email-marketing endpoints + 5 content-gap endpoints ported
- [ ] `POST /email-sends` dispatches via SendGrid (or simulation) and persists `email_sends` row
- [ ] `POST /email-sends/bulk` handles up to 500 recipients per request
- [ ] `POST /webhooks/sendgrid` accepts real SendGrid payloads (test with their webhook debugger) and records events
- [ ] `POST /email-campaigns/:id/refresh-metrics` aggregates opens/clicks from events table
- [ ] Unsubscribe flow: POST adds to list, GET `/check/:email` returns true for unsubscribed addresses
- [ ] Content gap `refresh` runs the analysis engine and persists results

### Security / RLS
- [ ] RLS on all 7 email tables + 2 content-gap tables
- [ ] Two-tenant test: campaign created by tenant A invisible to tenant B
- [ ] SendGrid webhook: tampered payload → 401; valid payload with unknown `email_send_id` → log + drop
- [ ] Unsubscribe check-by-email does NOT leak cross-tenant existence (scope by email + tenant context if JWT present, or return boolean only with no tenant info)
- [ ] RBAC: content-gap endpoints gated by admin role

### Frontend compatibility
- [ ] `ContentGapDashboard.tsx` loads, gap list renders
- [ ] Email marketing pages (campaigns, templates, lists, analytics) load without errors — audit frontend for the exact page filenames
- [ ] Playwright MCP pass on content-gap dashboard + campaign create/edit/send flow

### SendGrid provider swap
- [ ] `_sendgrid.ts` fetch wrapper matches current behavior: simulation mode when `SENDGRID_API_KEY` absent, real send when present
- [ ] Bulk send respects 1000-personalization limit (chunk if exceeded)
- [ ] Error responses from SendGrid surface as 502 (upstream error) to the frontend

### Deletion
- [ ] `server/routes/email-marketing-routes.ts` deleted
- [ ] `server/routes/content-gap-analysis-routes.ts` deleted
- [ ] `server/services/email-service.ts` deleted (logic in `_sendgrid.ts`)
- [ ] `server/services/content-gap-analysis-service.ts` deleted (logic in `_engine.ts`)
- [ ] Duplicate `supabase/functions/email-campaigns/` and `email-templates/` folders deleted (merged into `email-marketing/`)
- [ ] Route registry entries removed
- [ ] `grep -r "email-marketing-routes\|content-gap-analysis-routes\|@sendgrid/mail" server/ client/` returns zero matches

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds
- [ ] `@sendgrid/mail` removed from `package.json`

---

## 8. Test plan

### Unit (Deno)
- `_sendgrid.test.ts` — mock fetch, verify request shape (bearer header, personalizations array)
- `_engine.test.ts` — content gap analysis with fixture articles; deterministic output

### Integration (local Supabase)
- Send a simulation-mode email (`SENDGRID_API_KEY` unset), verify `email_sends` row
- Bulk send 10 recipients, verify 10 `email_sends` rows + 1 SendGrid call
- POST a fake SendGrid webhook with `open` events; verify `email_events` rows appear and `refresh-metrics` picks them up
- Content gap refresh: seed articles, run analysis, verify gap rows

### Webhook smoke (prod)
After deploy:
1. Send one real email in production
2. Open it in a test inbox (triggers SendGrid open event)
3. Verify `email_events` row appears within 2 minutes
4. Verify campaign metrics increment

### E2E
- Playwright: create template → create campaign → attach list → schedule immediate send → verify sent count in UI

---

## 9. Rollback

Standard: revert edge function PR. Both Express files are currently non-functional in prod, so rollback is to baseline — no user-visible regression.

**Special:** if SendGrid webhook ingestion breaks, production stops recording opens/clicks. Watch `email_events` row count for 24h post-deploy; if rate drops >50% vs. pre-migration baseline, revert.

No schema changes in this PRD.

---

## 10. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SendGrid webhook signature verification regression — events silently rejected | Medium | High | Log every failed verification with reason; alert if rate > 5/min |
| Dynamic import of `@sendgrid/mail` in Express had undocumented config behavior (e.g., rate limiting, retries) | High | Medium | Read `email-service.ts` end-to-end before porting; document every config knob |
| Webhook endpoint DDoS'd by attackers | Low | Medium | Rely on Cloudflare WAF (already fronting edge functions); add per-IP rate limit if needed |
| Bulk send of 500 recipients exceeds Deno memory with large HTML templates | Low | Medium | Chunk at 100 recipients per SendGrid call; stream DB writes |
| `email_events` table becomes huge (opens/clicks accumulate) and query perf degrades | Medium | Medium | Verify indexes on `(tenant_id, send_id, timestamp)` and `(tenant_id, campaign_id, event_type)`; plan retention in follow-up |
| Content gap analysis is slow (596-line engine); edge timeout on full refresh | Medium | Medium | Time the port locally first; if >30s, split into chunked refresh with `POST /refresh/start` + `GET /refresh/:jobId/status` |

---

## 11. Open questions

1. **What mount path does `email-marketing-routes.ts` register at?** Verify `server/routes-registry.ts` — it's either `/api/email-marketing` or `/api` directly (paths include `/email-templates`, not nested).
2. **Is `/email-marketing` even the canonical prefix, or does the frontend call `/api/email-templates/*` directly?** Grep frontend; this affects the dispatcher path parsing.
3. **SendGrid webhook signing key** — stored in env (`SENDGRID_WEBHOOK_PUBLIC_KEY`)? Confirm during audit.
4. **Is there a dedicated `shared/email-marketing-schema.ts`?** Grep shows tables live in `shared/schema.ts`. Consider extracting into a dedicated schema file during port for parity with other domains.
5. **Should `/webhooks/sendgrid` be a separate edge function** (public, unauthenticated) to keep the auth'd email-marketing function clean? Low-cost; makes RLS posture clearer.
6. **Does `ContentGapAnalysisService` make any external API calls?** Grep says no (no Claude/OpenAI imports), but verify — the class may import something not obvious.

---

## 12. Definition of done

- [ ] All 35 + 5 endpoints live at `functions.printyx.net/email-marketing/*` and `.../content-gap-analysis/*`
- [ ] Legacy `email-campaigns/` and `email-templates/` edge functions deleted
- [ ] SendGrid send + webhook verified end-to-end in prod (one real email through the full loop)
- [ ] RLS on all 9 tables
- [ ] `@sendgrid/mail` removed from package.json
- [ ] Express files + services deleted
- [ ] Type checks + build pass
- [ ] Phase 3 complete → proceed to Phase 4 (Operations)
