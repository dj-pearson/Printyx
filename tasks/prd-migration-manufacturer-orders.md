# PRD: Migrate Manufacturer Orders to Edge Function

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 4 · **Week:** 10 (June 24 – June 30) · **Story:** US-017 part B

**Why:** Manufacturer orders is the largest single-file Express domain remaining — **43 endpoints across 1,184 lines**, covering the full procurement lifecycle (manufacturer connections → orders → line items → confirmations → shipments → exceptions). An edge function named `manufacturer-integrations/` exists but appears to cover a different scope (integrations/auth). This PRD ports the full order-management Express route file to a dedicated `supabase/functions/manufacturer-orders/`.

**Risk note:** this route handles **sensitive credentials** (API keys, OAuth tokens, EDI passwords, portal passwords) stored in `manufacturer_connections`. The port must preserve the existing redaction pattern (`redactConnectionCredentials` helper at route file line 29) so credentials never leak to the frontend.

---

## 1. Scope

**Express source:**
- `server/routes/manufacturer-order-routes.ts` (1,184 lines, **43 endpoints**)

**Services:**
- `server/services/manufacturer-integration-service.ts` — verify content; likely auth + API client wrapper

**Edge side:**
- `supabase/functions/manufacturer-integrations/` — exists, scope TBD; audit in step 1

**Target:**
```
supabase/functions/manufacturer-orders/       # NEW
├── index.ts                                  # dispatcher
├── handlers/
│   ├── connections.ts                        # 7 endpoints (CRUD + test + health)
│   ├── orders.ts                             # 8 endpoints (CRUD + submit + acknowledge + fulfillment)
│   ├── line-items.ts                         # 7 endpoints (CRUD + bulk + shipment)
│   ├── confirmations.ts                      # 5 endpoints (CRUD + process)
│   ├── shipments.ts                          # 8 endpoints (CRUD + tracking + deliver)
│   ├── exceptions.ts                         # 7 endpoints (CRUD + resolve + retry)
│   └── analytics.ts                          # 1 endpoint (dashboard)
└── _credentials.ts                           # redaction helper (ported verbatim)
└── _integrations.ts                          # API client dispatch (if service ported)
```

**Audit decision on `manufacturer-integrations/`:** during parity step, confirm whether to merge into `manufacturer-orders/` or keep separate. Leaning toward keeping separate if it handles only OAuth flows; merge if it handles order submission.

**Explicitly out of scope:**
- Actual manufacturer API clients (Canon, Xerox, HP, etc.) — assumed already abstracted in `manufacturer-integration-service.ts`; port as-is
- Webhook receivers for real-time order status from manufacturers — if present, port; if TODO, document as follow-up

---

## 2. Endpoint parity matrix (condensed)

### Connections (7)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/manufacturer-orders/connections` | 50 | returns redacted |
| GET    | `/manufacturer-orders/connections/:id` | 77 | redacted |
| POST   | `/manufacturer-orders/connections` | 103 | **sensitive input** |
| PUT    | `/manufacturer-orders/connections/:id` | 134 | **sensitive input** |
| DELETE | `/manufacturer-orders/connections/:id` | 167 | |
| POST   | `/manufacturer-orders/connections/:id/test` | 195 | probes live API |
| PATCH  | `/manufacturer-orders/connections/:id/health` | 216 | |

### Orders (8)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/manufacturer-orders/` | 251 | list |
| GET    | `/manufacturer-orders/:id` | 275 | |
| POST   | `/manufacturer-orders/` | 296 | create draft |
| PUT    | `/manufacturer-orders/:id` | 320 | |
| DELETE | `/manufacturer-orders/:id` | 346 | |
| POST   | `/manufacturer-orders/:id/submit` | 367 | **calls manufacturer API** |
| POST   | `/manufacturer-orders/:id/acknowledge` | 388 | |
| PATCH  | `/manufacturer-orders/:id/fulfillment` | 422 | |

### Line Items (7)
| Method | Path | Line |
|---|---|---|
| GET    | `/manufacturer-orders/:orderId/line-items` | 456 |
| GET    | `/manufacturer-orders/line-items/:id` | 478 |
| POST   | `/manufacturer-orders/:orderId/line-items` | 499 |
| POST   | `/manufacturer-orders/:orderId/line-items/bulk` | 530 |
| PUT    | `/manufacturer-orders/line-items/:id` | 567 |
| DELETE | `/manufacturer-orders/line-items/:id` | 593 |
| PATCH  | `/manufacturer-orders/line-items/:id/shipment` | 614 |

### Confirmations (5)
| Method | Path | Line |
|---|---|---|
| GET    | `/manufacturer-orders/:orderId/confirmations` | 648 |
| GET    | `/manufacturer-orders/confirmations/:id` | 670 |
| POST   | `/manufacturer-orders/:orderId/confirmations` | 691 |
| PUT    | `/manufacturer-orders/confirmations/:id` | 722 |
| POST   | `/manufacturer-orders/confirmations/:id/process` | 748 |

### Shipments (8)
| Method | Path | Line |
|---|---|---|
| GET    | `/manufacturer-orders/:orderId/shipments` | 771 |
| GET    | `/manufacturer-orders/shipments/:id` | 793 |
| GET    | `/manufacturer-orders/shipments/tracking/:trackingNumber` | 814 |
| POST   | `/manufacturer-orders/:orderId/shipments` | 838 |
| PUT    | `/manufacturer-orders/shipments/:id` | 869 |
| DELETE | `/manufacturer-orders/shipments/:id` | 895 |
| PATCH  | `/manufacturer-orders/shipments/:id/tracking` | 916 |
| POST   | `/manufacturer-orders/shipments/:id/deliver` | 948 |

### Exceptions (7)
| Method | Path | Line |
|---|---|---|
| GET    | `/manufacturer-orders/:orderId/exceptions` | 982 |
| GET    | `/manufacturer-orders/exceptions/unresolved` | 1004 |
| GET    | `/manufacturer-orders/exceptions/:id` | 1026 |
| POST   | `/manufacturer-orders/exceptions` | 1047 |
| PUT    | `/manufacturer-orders/exceptions/:id` | 1071 |
| POST   | `/manufacturer-orders/exceptions/:id/resolve` | 1097 |
| POST   | `/manufacturer-orders/exceptions/:id/retry` | 1132 |

### Analytics (1)
| Method | Path | Line |
|---|---|---|
| GET | `/manufacturer-orders/analytics/dashboard` | 1155 |

**Total: 43 endpoints.**

---

## 3. Tables + RLS plan

From `shared/manufacturer-order-schema.ts` + `shared/manufacturer-integration-schema.ts`:
- `manufacturer_connections` — **includes credential columns**
- `manufacturer_orders`
- `manufacturer_order_line_items`
- `manufacturer_order_confirmations`
- `manufacturer_order_shipments`
- `manufacturer_order_exceptions`

RLS file: `drizzle/rls/manufacturer-orders.sql` applies standard 4-policy template.

**Extra policy for `manufacturer_connections`:** consider column-level protection OR handler-level redaction. RLS doesn't protect columns, so the `redactConnectionCredentials()` helper must run on every SELECT path. **The easier safety net: store credentials in a separate table (`manufacturer_connection_credentials`) with SELECT denied to `authenticated` role — only service-role can read.** This is a follow-up; for now, rely on handler-level redaction.

---

## 4. Credential handling (security-critical)

### Current redaction list (from route L33-42):
`apiKey`, `apiSecret`, `clientId`, `clientSecret`, `accessToken`, `refreshToken`, `webhookSecret`, `ediPassword`, `portalUsername`, `portalPassword`

**Rule:** every SELECT response that includes connection data MUST pass through `redactConnectionCredentials()` before serialization. Port to `_credentials.ts`:

```typescript
export function redactConnectionCredentials<T extends Record<string, unknown>>(conn: T): T {
  const redacted = { ...conn };
  const SENSITIVE = ['apiKey', 'apiSecret', 'clientId', 'clientSecret', 'accessToken', 'refreshToken', 'webhookSecret', 'ediPassword', 'portalUsername', 'portalPassword'];
  for (const key of SENSITIVE) {
    if (redacted[key]) redacted[key] = '••••••••';
  }
  return redacted;
}
```

**POST/PUT paths:** credentials flow INTO the handler from the frontend form. They should never come back OUT. Test this end-to-end:
1. POST with full creds → persisted to DB raw
2. GET afterwards → all sensitive fields redacted

### Encryption at rest
Credentials are stored plaintext in the DB today (verified by grepping for encrypt calls — none found). **This is a pre-existing security issue** but not introduced by this migration. Flag as a follow-up in §10. Don't block migration on fixing it.

### Test endpoint
`POST /connections/:id/test` uses the real credentials to probe the manufacturer API. In Deno:
- Read credentials via service-role (bypass RLS)
- Call out via fetch
- Return success/failure, never echo credentials in response

---

## 5. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| `manufacturer-integration-service.ts` | `server/services/` | Port to `_integrations.ts` — read the service before porting; handle any Node-only HTTP libs (likely just `axios` → `fetch`) |
| Zod schemas | `@shared/manufacturer-order-schema` | Direct import (shared/ is Deno-portable per Phase 1) |
| `IStorage` methods | `server/storage.ts` | Reimplement as Drizzle calls |
| Tracking number lookup (carrier APIs?) | TBD | Port any fetch-based calls; document any SDK-based calls as risk |

No cron, no websockets, no PDF generation.

---

## 6. Acceptance criteria

### Functional parity
- [ ] All 43 endpoints return the same shape as Express for equivalent inputs
- [ ] `POST /connections` stores credentials correctly; `GET /connections/:id` returns redacted values
- [ ] `POST /connections/:id/test` successfully probes a manufacturer API (fixture or live)
- [ ] `POST /orders/:id/submit` dispatches to the manufacturer API and persists response
- [ ] `POST /line-items/bulk` atomically inserts up to 100 items per request
- [ ] `POST /exceptions/:id/retry` re-runs the failed operation and updates state
- [ ] Analytics dashboard returns order volume, exception rate, fulfillment SLA

### Security / RLS + credentials
- [ ] RLS on all 6 manufacturer tables
- [ ] Credential redaction test: POST connection with real creds; GET response shows redacted; confirm no sensitive field leaks through any endpoint
- [ ] Two-tenant test: connection in tenant A invisible to tenant B
- [ ] Logs: no credential value appears in any log line during creation, update, or test flows

### Frontend compatibility
- [ ] `ManufacturerIntegration.tsx` loads, connection list renders with redacted creds
- [ ] Create/edit connection flow submits and persists
- [ ] Test connection button returns success/failure
- [ ] Order creation → submit → fulfillment dashboard shows state transitions
- [ ] `ManufacturerIntegrationAudit.tsx` audit log displays correctly
- [ ] Playwright MCP pass on connection CRUD + order submission

### Deletion
- [ ] `server/routes/manufacturer-order-routes.ts` deleted
- [ ] `server/services/manufacturer-integration-service.ts` deleted (logic in `_integrations.ts`)
- [ ] Route registry entry removed
- [ ] `grep -r "manufacturer-order-routes\|manufacturer-integration-service" server/ client/` returns zero matches

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 7. Test plan

### Unit (Deno)
- `_credentials.test.ts` — redaction: assert every sensitive field masked, non-sensitive fields preserved
- Handler-level tests for submit, retry, resolve (state transitions)

### Integration
- Local: seed a dev manufacturer connection (use a stub endpoint like `https://httpbin.org`) → test probe → create order → submit → verify API call happens + response stored
- Bulk line items: POST 100 items, verify atomic (rollback if one fails)
- Exception retry: force an exception, retry, verify resolved state

### Security regression
- Attempt to GET a connection with a valid auth token → verify redaction
- Attempt to SELECT directly via service-role from a non-credentialed context → should fail tenant isolation
- Log scan: run full integration suite; grep logs for known credential substrings → must return zero

### Production smoke
- Create a test manufacturer connection in prod
- Submit a test order through the full flow
- Verify no prod credentials appear in logs

---

## 8. Rollback

Standard: revert PR. Express file is already non-functional in prod. No schema changes.

**Data caution:** if credentials were migrated or transformed during this PRD (they should NOT be), rollback could leave orphan encrypted rows. Verify no schema touches credentials.

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Credential leak via missed redaction path | Medium | **Critical** | Unit test + integration test every SELECT endpoint; add automated log scan in CI |
| Manufacturer API client uses Node-only `axios` config (interceptors, agents) | High | Medium | Read service end-to-end before porting; `fetch` is sufficient for standard HTTPS |
| `axios` retry logic (e.g., exponential backoff) not trivially ported | Medium | Medium | Port using `for (let i = 0; i < retries; i++)` with explicit backoff; test |
| Bulk insert (100 line items) exceeds Deno memory on large item payloads | Low | Medium | Cap bulk at 100; chunk client-side if more needed |
| Order submit latency blown out by manufacturer API slowness → edge timeout | Medium | High | Explicit 30s fetch timeout on outbound calls; surface clear 504 to frontend |
| Audit log data volume (frontend page `ManufacturerIntegrationAudit`) requires pagination we don't have today | Low | Low | Add pagination during port if current endpoint returns unbounded results |

---

## 10. Open questions

1. **Is `manufacturer-integration-service.ts` a thin wrapper around the manufacturer APIs, or does it contain stateful session handling / long-lived OAuth tokens?** Affects whether it's port-as-is or needs rework.
2. **OAuth token refresh** — who triggers refresh when `accessToken` expires? Cron? On-demand? If cron, move to `pg_cron` Phase 6.
3. **Webhooks from manufacturers** — does this domain currently receive webhooks for order status changes? Grep for `/webhooks/manufacturer`. If yes, they're public endpoints that need careful signature verification.
4. **Credential encryption at rest** — pre-existing gap. Document as `follow-up/manufacturer-creds-encryption.md` but not block migration. Options: column-level encryption via `pgcrypto`, or KMS-backed envelope encryption.
5. **`manufacturer-integrations/` existing edge function** — what does it do? Merge into `manufacturer-orders/` or keep separate?
6. **Tracking number carrier detection** — does `/shipments/tracking/:trackingNumber` call an external carrier API (UPS, FedEx, USPS)? If yes, port those fetch calls.
7. **EDI integrations** — `ediPassword` in the credential list suggests EDI (X12) flows. Are those live today, or vestigial? If live, what library handles parsing?

---

## 11. Definition of done

- [ ] All 43 manufacturer-order endpoints live at `functions.printyx.net/manufacturer-orders/*`
- [ ] Credential redaction verified via automated test + manual log review
- [ ] Order lifecycle (create → submit → acknowledge → fulfill → ship → exception → retry) works end-to-end in prod
- [ ] `ManufacturerIntegration.tsx` + `ManufacturerIntegrationAudit.tsx` fully functional
- [ ] RLS on all tables
- [ ] Express files + service deleted
- [ ] Type checks + build pass
- [ ] Credential-encryption-at-rest follow-up filed as separate issue
- [ ] 72 hours stable before Phase 4 moves to US-018
