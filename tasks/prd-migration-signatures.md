# PRD: Migrate E-Signature Integration to Edge Function

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 4 · **Week:** 12 (July 8 – July 14) · **Story:** US-019

**Why:** The e-signature domain has 31 Express endpoints across 702 lines — but **the actual e-signature provider integrations are not implemented**. Inspection of `signature-routes.ts` reveals:
- Line 357 comment: `// TODO: Integrate with actual e-signature provider (DocuSign, Adobe Sign, etc.)`
- Webhook handlers at lines 661, 675, 689 are **all stubs** that log payloads without processing them
- The endpoints manage signature *request records* in our database, but the actual document signing workflow has never been wired up

**This reshapes the PRD scope significantly.** We're not migrating a working e-signature integration — we're migrating a CRUD layer for tracking signature requests, plus deciding whether to land a real integration as part of this phase.

---

## 1. Scope

**Source Express file:**
- `server/routes/signature-routes.ts` (702 lines, **31 endpoints**)
- `server/seed-signature-data.ts` — seed data for dev

**Services:** None. Route handlers call `storage` directly.

**Edge side:** No existing signature edge function.

**Target:** `supabase/functions/signatures/` covering all 31 endpoints + **a single decision** on whether to wire a real provider now or defer.

```
supabase/functions/signatures/
├── index.ts                          # dispatcher
├── handlers/
│   ├── credentials.ts                # 6 endpoints — integration-credentials CRUD
│   ├── requests.ts                   # 9 endpoints — signature-requests CRUD + send + void
│   ├── signers.ts                    # 5 endpoints — signers CRUD
│   ├── documents.ts                  # 5 endpoints — documents CRUD
│   ├── audit.ts                      # 2 endpoints — audit logs
│   └── webhooks/
│       ├── docusign.ts               # POST /webhooks/docusign
│       ├── adobe-sign.ts             # POST /webhooks/adobe-sign
│       └── hellosign.ts              # POST /webhooks/hellosign
└── _providers/
    ├── docusign.ts                   # fetch-based REST client (if wired up)
    ├── adobe-sign.ts                 # (if wired up)
    └── hellosign.ts                  # (if wired up)
```

**Decision gate at kickoff:** do we wire a real provider as part of this PRD, or port the stubs as-is?

**Recommendation:** **port stubs as-is + land DocuSign only as a single-provider implementation in a follow-up PRD.** Rationale:
- Landing 3 providers now triples surface area with no proven product demand
- Stubs work today (CRUD on signature-request records is real even without actual signing)
- DocuSign is the clear industry leader; pick one, land well, add others later

---

## 2. Endpoint parity matrix

### Integration Credentials (6) — credentials for future provider wiring
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/signatures/integration-credentials` | 22 | redacted |
| GET    | `/signatures/integration-credentials/:id` | 50 | redacted |
| POST   | `/signatures/integration-credentials` | 80 | **sensitive** |
| PATCH  | `/signatures/integration-credentials/:id` | 116 | **sensitive** |
| DELETE | `/signatures/integration-credentials/:id` | 160 | |
| POST   | `/signatures/integration-credentials/:id/test` | 176 | stub today; real probe if wired |

### Signature Requests (9)
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/signatures/signature-requests` | 196 | |
| GET    | `/signatures/signature-requests/:id` | 213 | |
| GET    | `/signatures/customers/:customerId/signature-requests` | 233 | |
| GET    | `/signatures/signature-requests/expiring/soon` | 249 | |
| POST   | `/signatures/signature-requests` | 266 | |
| PATCH  | `/signatures/signature-requests/:id` | 304 | |
| DELETE | `/signatures/signature-requests/:id` | 329 | |
| POST   | `/signatures/signature-requests/:id/send` | 345 | **STUB** — line 357 TODO |
| POST   | `/signatures/signature-requests/:id/void` | 384 | |

### Signers (5)
GET list by request, GET/POST/PATCH/DELETE :id

### Documents (5)
GET list by request, GET/POST/PATCH/DELETE :id

### Audit Logs (2)
GET /signature-requests/:requestId/audit-logs, GET /signature-signers/:signerId/audit-logs

### Webhooks (3) — ALL STUBS
| Method | Path | Line | Current status |
|---|---|---|---|
| POST | `/signatures/webhooks/docusign` | 661 | logs payload, TODO to process |
| POST | `/signatures/webhooks/adobe-sign` | 675 | same |
| POST | `/signatures/webhooks/hellosign` | 689 | same |

**Total: 31 endpoints.**

---

## 3. Tables + RLS plan

Expected tables:
- `signature_integration_credentials` — per-tenant provider creds
- `signature_requests`
- `signature_signers`
- `signature_documents`
- `signature_audit_logs`

RLS file: `drizzle/rls/signatures.sql` applies standard 4-policy template.

**Credential handling:** same pattern as manufacturer-orders PRD. Redact sensitive fields (`apiKey`, `accountId`, `integrationKey`, `privateKey`) on every SELECT response. Implement in `_credentials.ts` (shared helper or per-domain).

---

## 4. Webhook handlers

All 3 webhook endpoints are stubs. **Port path:**

1. Keep all 3 stubs in place (future-proof)
2. Each verifies sender signature (DocuSign HMAC, Adobe Sign, HelloSign event callback) — if configured
3. Routes the event to a provider-specific handler that:
   - Looks up the signature_request by provider-specific envelope ID
   - Updates request + signer status
   - Appends to audit log

**Authentication:** webhooks are public (no JWT). Each provider has a different verification method:

| Provider | Verification |
|---|---|
| DocuSign | HMAC-SHA256 on `X-DocuSign-Signature-1` header using account's Connect secret |
| Adobe Sign | OAuth token in body + webhook secret |
| HelloSign (Dropbox Sign) | SHA256 HMAC of request body using API key |

Implementation in `_providers/{provider}.ts` handlers if real. Stubs for now.

---

## 5. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| Provider SDKs (DocuSign Node, Adobe Sign, HelloSign) | Not in use today (stubs) | If wired: use provider REST APIs via fetch |
| `IStorage` methods | `server/storage.ts` | Reimplement as Drizzle calls |
| Document upload | likely tied to Supabase Storage | Use `@supabase/storage-js` via esm.sh |

**No active external calls in this port** unless we change the decision in §1.

---

## 6. Acceptance criteria

### Functional parity
- [ ] All 31 endpoints return the same shape as Express for equivalent inputs
- [ ] Signature request CRUD works end-to-end
- [ ] Signer / document CRUD works
- [ ] Webhook endpoints return 200 on valid payloads, log event, update status (still stubs — verify stub behavior preserved)
- [ ] Audit log appends on every state-changing operation
- [ ] `signature-requests/expiring/soon` returns requests with `expires_at < now() + 7 days`

### Security / RLS + credentials
- [ ] RLS on all 5 signature tables
- [ ] Credential redaction: POST credentials → GET shows redacted
- [ ] Two-tenant test: request in tenant A invisible to tenant B
- [ ] Webhook endpoints: no authentication required, but **every request logged with IP + body hash** for forensic purposes
- [ ] Webhook signature verification present (even if stub) — port the code path, document what's needed to light up

### Frontend compatibility
- [ ] `ESignatureIntegration.tsx` loads, integration credentials list renders with redacted values
- [ ] Create/edit credential flow works
- [ ] Test credential button returns placeholder or real result based on wiring
- [ ] Signature request list + detail views work
- [ ] Send request (even as stub) updates status and fires the TODO log line
- [ ] Playwright MCP pass on ESignatureIntegration page

### Deletion
- [ ] `server/routes/signature-routes.ts` deleted
- [ ] `server/seed-signature-data.ts` deleted (move seed data to `scripts/seed-signatures.ts` if still needed for dev)
- [ ] Route registry entry removed
- [ ] `grep -r "signature-routes\|seed-signature-data" server/ client/` returns zero matches

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 7. Test plan

### Unit (Deno)
- `_providers/docusign.test.ts` — HMAC verification with known-good fixture (even if provider not wired, the verification helper should exist for future use)
- Redaction unit test for credentials

### Integration
- Full signature request lifecycle: create → add signers → add documents → send (stub) → void → verify audit log has all events
- Webhook smoke: POST a fake DocuSign event payload; verify log line matches Express
- Expiring-soon query: seed 3 requests with varying expiry, verify filter correctness

### Production smoke
- ESignatureIntegration page: create a test integration credential, verify redacted read-back
- Signature request creation, send (stub), void — verify state machine

### Future: real provider smoke
- Flag as follow-up: after real DocuSign wiring, test full envelope send + callback → request completion

---

## 8. Rollback

Standard: revert PR. Express file is already non-functional in prod. No schema changes (unless we add provider tables — none in this PRD).

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Port masks latent bugs in stub endpoints (since they've never been exercised in prod) | High | Low | Integration tests pass = parity; bug fixes are post-migration work |
| Webhook endpoints DDoS'd (public, no auth) | Low | Medium | Cloudflare WAF; add rate limit per IP in the handler |
| Credentials fields differ from manufacturer-orders redaction list | Medium | Low | Extract `redactCredentials(fields, row)` as generic helper in `_shared/rbac.ts` or `_credentials.ts` |
| Downstream code (lease signing, contract signing) assumes this works and will break on production use | High | High | **Flag clearly:** this migration does NOT fix the stubbed signing — it only preserves the CRUD layer. Follow-up PRD needed for actual provider wiring |
| User creates an integration credential expecting it to work | High | Medium | Frontend should display "Integration pending activation" banner; backlog item |

---

## 10. Open questions

1. **Which single provider to wire up in the follow-up?** DocuSign is the recommendation. Confirm with Dan — may be product-driven (which customers ask for which).
2. **Is there live customer usage of the stubbed send flow?** If customers have tried to send signature requests and seen them stay "pending" forever, that's a bug surface we should flag loudly.
3. **Signature request document storage** — is the file stored in Supabase Storage, inline in DB, or not at all today? Affects send-envelope payload when provider wiring lands.
4. **Webhook public keys** — where are they stored once configured? Per-tenant in `signature_integration_credentials.webhookSecret`, or env? Affects multi-tenant verification.
5. **Audit log retention** — compliance (eIDAS, ESIGN Act) may require multi-year retention. Document current schema; flag if retention policy needed.
6. **Adobe Sign auth flow** — uses OAuth, which means refresh token lifecycle. Handled where? If the follow-up wires Adobe Sign, this is a project gate.
7. **Does the frontend today show signature request status as "live"?** If users assume the stubs are working, there's a UX honesty issue worth flagging separately.

---

## 11. Follow-up issues (post-migration)

File these as separate GitHub issues before closing this PRD:

1. **Wire DocuSign** — full envelope creation, webhook processing, state sync
2. **Document upload to Supabase Storage** — for signature-request documents not yet stored
3. **Frontend honesty banner** — display "Integration pending" if send flow isn't functional
4. **Audit log retention policy** — define + implement
5. **Provider credential encryption at rest** — shared issue with manufacturer-orders (both use plaintext)

---

## 12. Definition of done

- [ ] All 31 endpoints live at `functions.printyx.net/signatures/*`
- [ ] CRUD on signature requests / signers / documents works end-to-end
- [ ] Webhook stubs preserved (log payload + return 200)
- [ ] Credential redaction verified
- [ ] `ESignatureIntegration.tsx` functional
- [ ] RLS on all 5 tables
- [ ] Express file + seed deleted
- [ ] Follow-up issues filed for real provider wiring
- [ ] Type checks + build pass
- [ ] Phase 4 complete → proceed to Phase 5 (Integrations & AI)
