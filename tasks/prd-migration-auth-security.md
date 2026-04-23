# PRD: Migrate Auth + Security Routes (SSO, MFA, API Keys) to Edge Function(s)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 5 · **Week:** 14 (July 22 – July 28) · **Story:** US-021

**Why:** Three adjacent Express domains handle platform auth beyond Supabase's built-in flow: SSO (SAML + OIDC), MFA (TOTP, email OTP, SMS OTP, backup codes), and API keys. They share authentication middleware patterns but have distinct trust boundaries. This migration is mandatory before server-sunset because these routes power security controls — a post-sunset 404 here would block customer logins for enterprise tenants.

**Critical decisions in this PRD:**
1. **SSO strategy** — keep custom code or migrate to Supabase SSO (Enterprise tier)?
2. **MFA provider abstraction** — port Twilio + AWS SNS via fetch, or consolidate to one SMS provider?

---

## 1. Scope

**Source Express files:**
- `server/routes/sso-routes.ts` (628 lines, **14 endpoints**)
- `server/routes/mfa-routes.ts` (861 lines, **17 endpoints**)
- `server/routes/api-key-routes.ts` (323 lines, **9 endpoints**)

**Services:**
- `server/services/sso-service.ts` (1,153 lines) — custom SAML + OIDC handling (uses Node `crypto` module)
- `server/services/mfa-otp-service.ts` (523 lines) — TOTP + email/SMS OTP; uses `twilio` and `@aws-sdk/client-sns` via dynamic imports

**Existing edge functions:**
- `supabase/functions/api-keys/` (272 lines) — audit overlap; likely partial coverage

**Target layout:**
```
supabase/functions/
├── sso/
│   ├── index.ts
│   ├── handlers/
│   │   ├── providers.ts            # 7 endpoints (CRUD + test + import)
│   │   ├── saml.ts                 # SAML auth/callback/logout + metadata (5 endpoints)
│   │   ├── oidc.ts                 # OIDC callback (1 endpoint)
│   │   └── session.ts              # /session/validate, /logout
│   └── _saml.ts                    # SAML XML signing/validation (ported from sso-service.ts)
│   └── _oidc.ts                    # OIDC token exchange
│
├── mfa/
│   ├── index.ts
│   ├── handlers/
│   │   ├── enroll.ts               # enroll init/verify
│   │   ├── verify.ts               # /verify + /challenge
│   │   ├── status.ts               # /status + /methods + /disable
│   │   ├── backup-codes.ts         # regenerate + count
│   │   ├── otp.ts                  # email/sms send + verify
│   │   ├── admin.ts                # admin/reset + compliance-report + users-without-mfa
│   │   └── audit.ts                # audit-logs (user + admin)
│   └── _totp.ts                    # TOTP generator + verifier (from mfa-otp-service.ts)
│
└── api-keys/                        # EXISTING — expand to cover all 9 Express endpoints
    ├── index.ts
    └── handlers/
        ├── keys.ts                  # CRUD + revoke + rotate
        ├── stats.ts                 # GET /:id/stats
        └── validate.ts              # POST /validate (used by other edge functions)
```

**Explicitly out of scope:**
- Replacing Supabase GoTrue JWT as the primary auth system
- Adding new SSO protocols (e.g., CAS, WS-Fed) — only SAML + OIDC stay
- WebAuthn / passkeys — post-migration roadmap

---

## 2. Endpoint parity matrix

### `sso-routes.ts` — 14 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/sso/providers` | 67 | list; `oidcClientSecret` stripped |
| GET    | `/sso/providers/:id` | 104 | redacted |
| POST   | `/sso/providers` | 136 | **sensitive creds** |
| PATCH  | `/sso/providers/:id` | 174 | **sensitive creds** |
| DELETE | `/sso/providers/:id` | 213 | |
| POST   | `/sso/auth/initiate` | 239 | start login |
| POST   | `/sso/callback/saml/:providerId` | 273 | SAML assertion handler |
| GET    | `/sso/callback/oidc/:providerId` | 325 | OIDC callback |
| GET    | `/sso/metadata/:providerId` | 394 | SAML SP metadata XML |
| POST   | `/sso/logout` | 411 | session-local logout |
| GET    | `/sso/session/validate` | 437 | |
| POST   | `/sso/logout/saml/:providerId` | 457 | SAML SLO |
| POST   | `/sso/providers/:id/test` | 492 | config probe |
| POST   | `/sso/providers/import` | 576 | SAML metadata XML upload |

### `mfa-routes.ts` — 17 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/mfa/enroll/init` | 114 | creates secret + otpauth URL |
| POST | `/mfa/enroll/verify` | 153 | |
| POST | `/mfa/verify` | 266 | any-method verify |
| GET  | `/mfa/status` | 333 | |
| POST | `/mfa/disable` | 353 | |
| POST | `/mfa/backup-codes/regenerate` | 404 | |
| GET  | `/mfa/backup-codes/count` | 443 | |
| POST | `/mfa/admin/reset/:userId` | 462 | **root-admin only** |
| GET  | `/mfa/admin/compliance-report` | 492 | |
| GET  | `/mfa/admin/users-without-mfa` | 512 | |
| GET  | `/mfa/audit-logs` | 532 | user's own |
| GET  | `/mfa/admin/audit-logs` | 558 | all tenant |
| POST | `/mfa/otp/email/send` | 604 | email one-time code |
| POST | `/mfa/otp/sms/send` | 649 | **Twilio** |
| POST | `/mfa/otp/verify` | 692 | |
| GET  | `/mfa/methods` | 749 | |
| POST | `/mfa/challenge` | 800 | |

### `api-key-routes.ts` — 9 endpoints
| Method | Path | Line |
|---|---|---|
| POST   | `/api-keys/` | 19 |
| GET    | `/api-keys/` | 56 |
| GET    | `/api-keys/:id` | 113 |
| PATCH  | `/api-keys/:id` | 142 |
| POST   | `/api-keys/:id/revoke` | 178 |
| POST   | `/api-keys/:id/rotate` | 206 |
| DELETE | `/api-keys/:id` | 241 |
| GET    | `/api-keys/:id/stats` | 267 |
| POST   | `/api-keys/validate` | 293 |

**Total: 40 endpoints.**

---

## 3. SSO strategy decision (kickoff gate)

### Option A: Keep custom SAML/OIDC code
- **Pros:** no vendor lock-in, full control, ~1,153 lines already written
- **Cons:** must port XML signing to Deno — no battle-tested library equivalent
- **Effort:** high — Node's `crypto` has `xml-crypto` ecosystem; Deno has less mature options

### Option B: Migrate to Supabase SSO (Enterprise tier)
- **Pros:** managed, compliance-ready, no custom code to maintain
- **Cons:** requires Supabase Enterprise billing; self-hosted Supabase may not support it (**verify with self-hosted**)
- **Effort:** low if self-hosted supports; otherwise blocked

### Recommendation: **Option A — port custom code**
Rationale: self-hosted Supabase unlikely to have Enterprise SSO features. Porting ~1,153 lines is non-trivial but bounded. For XML signing in Deno:
- `https://esm.sh/xml-crypto@3.2.0` — works with polyfills
- Fallback: self-implement SAML signature verification using `crypto.subtle` + `https://esm.sh/xmldom`

**Port checklist for `_saml.ts`:**
1. Parse SAML XML response (xmldom)
2. Verify XML signature (xml-crypto)
3. Extract assertion claims (NameID, Attributes)
4. Map to Supabase user (JIT provisioning — create user if not exists, update app_metadata.tenantId)
5. Mint a Supabase GoTrue session via admin API
6. Return session tokens to frontend

**Final decision must be confirmed at kickoff:** test `xml-crypto` in Deno first; if it doesn't work, go harder on fallback.

---

## 4. MFA: Twilio + AWS SNS port

Current Express code uses dynamic imports (`await import('twilio')`, `await import('@aws-sdk/client-sns')`) to avoid loading unless needed. Both are Node-only SDKs.

### Deno port: direct REST calls

**Twilio (SMS):**
```typescript
// _shared/twilio.ts
const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
const token = Deno.env.get('TWILIO_AUTH_TOKEN');
const from = Deno.env.get('TWILIO_FROM_NUMBER');

export async function sendSms(to: string, body: string): Promise<void> {
  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from!, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}
```

**AWS SNS (SMS fallback — document whether it's still needed):**
If Twilio is the primary and SNS is legacy fallback, **consider dropping SNS** in the port. Simplifies env vars.

**Decision: drop SNS from port unless Dan confirms it's in production use.** File as open question.

### TOTP library port
Current code likely uses `crypto` for HMAC-SHA1 base32 secret. Ports cleanly to Deno using `crypto.subtle.importKey` + `crypto.subtle.sign` or a library:
- `https://esm.sh/otpauth@9.2.2` — popular, pure JS, works in Deno

**Recommend:** use `otpauth` for TOTP generation/verification. QR code URL generation stays as string concatenation (no library needed).

---

## 5. Tables + RLS plan

- `sso_providers` — **tenant-scoped**, includes `oidcClientSecret`, `samlCertificate` (sensitive)
- `sso_sessions` — session state (tenant-scoped)
- `mfa_enrollments` — per-user TOTP secrets (must encrypt at rest or protect via column-level policies)
- `mfa_backup_codes` — hashed backup codes
- `mfa_audit_logs`
- `api_keys` — per-tenant API keys; **hashed**, never plaintext
- `api_key_stats` — usage counters

RLS files:
- `drizzle/rls/sso.sql`
- `drizzle/rls/mfa.sql`
- `drizzle/rls/api-keys.sql`

**Special case — `api_keys` table:** rows are read by a service-role client (from other edge functions calling `POST /validate`). RLS denies direct SELECT from `authenticated` — only service-role can read. Port this pattern; do NOT use standard template.

---

## 6. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| `crypto` (randomBytes, createHash) | sso-service, mfa-otp-service | Deno: `crypto.getRandomValues()`, `crypto.subtle.digest()` — built-in |
| `xml-crypto` (SAML signing) | implied in sso-service | `https://esm.sh/xml-crypto@3.2.0` OR self-impl via `crypto.subtle` |
| `xmldom` (XML parsing) | implied | `https://esm.sh/@xmldom/xmldom` |
| `twilio` SDK | mfa-otp-service | **REST port** (see §4) |
| `@aws-sdk/client-sns` | mfa-otp-service | Drop (see §4) or REST port |
| `speakeasy` / TOTP lib | mfa-otp-service | `https://esm.sh/otpauth@9.2.2` |
| Email sending for OTP | via `email-service` | Reuse `_shared/sendgrid.ts` from Phase 3 email-marketing PRD |
| Supabase Auth admin calls | Supabase JS client | Already in `_shared/` |

---

## 7. Acceptance criteria

### Functional parity

**SSO:**
- [ ] Create SAML provider via POST → test → initiate login → receive SAML assertion → verify signature → mint Supabase session
- [ ] OIDC equivalent works end-to-end
- [ ] Metadata endpoint returns valid SAML SP XML (test against Okta/Azure AD)
- [ ] Session validate returns current session state
- [ ] SLO (single logout) propagates to Supabase session invalidation

**MFA:**
- [ ] TOTP enroll → QR code displays in app → verify with authenticator → enrollment completes
- [ ] Backup codes generated + verifiable
- [ ] Email OTP send + verify works
- [ ] SMS OTP send + verify works (Twilio)
- [ ] Admin reset requires root-admin role
- [ ] Compliance report lists users without MFA for admin's tenant only

**API keys:**
- [ ] Create API key returns plaintext once (then never again)
- [ ] Stored as hash in DB; lookup matches hash
- [ ] `POST /validate` (called from other edge functions) returns tenant + scope for valid key
- [ ] Revoke marks key as revoked; validate returns 401
- [ ] Rotate creates new key, marks old as revoked after grace period
- [ ] Usage stats increment per call

### Security / RLS
- [ ] RLS on all 8+ tables
- [ ] `mfa_enrollments.secret` encrypted at rest (column-level `pgcrypto` OR envelope encryption)
- [ ] `api_keys` read only via service-role (authenticated role denied direct SELECT)
- [ ] Credential fields redacted on GET responses (SSO provider, API keys)
- [ ] Two-tenant test: SSO provider in tenant A invisible to tenant B

### SSO XML handling
- [ ] SAML response signature verification passes with test IdP fixtures
- [ ] XML external entity (XXE) attacks rejected by parser config
- [ ] Expired assertions rejected

### Frontend compatibility
- [ ] `ApiKeyManagement.tsx` loads; full CRUD works
- [ ] MFA enrollment UI works (audit for exact page file)
- [ ] SSO provider admin UI works
- [ ] Playwright MCP pass on each flow

### Deletion
- [ ] 3 Express route files deleted
- [ ] 2 services deleted (ported to edge function `_*.ts` helpers)
- [ ] `twilio` npm package removed
- [ ] `@aws-sdk/client-sns` removed (if SNS dropped per §4)
- [ ] Route registry entries removed

### Quality gates
- [ ] `deno check` passes on all 3 edge functions
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 8. Test plan

### Unit (Deno)
- `_saml.test.ts` — signature verification with known-good + known-bad SAML response XMLs
- `_totp.test.ts` — verify TOTP codes match reference implementation
- `_shared/twilio.test.ts` — mock fetch, verify auth header + body encoding
- API key hash roundtrip

### Integration
- Full SSO flow against a test SAML IdP (Auth0 free tier works)
- Full OIDC flow against Google/Microsoft (use service-role app credentials)
- MFA: enroll with authenticator app, login requires TOTP, verify audit log
- API key: create → use from another edge function → verify count increments

### Security tests
- SAML signature bypass attempt (swap assertion after signature) → rejected
- Expired SAML assertion → rejected
- TOTP replay (use same code twice in same window) → second rejected
- API key timing attack mitigation via `crypto.subtle` constant-time compare

### Production smoke
- One enterprise customer's real SAML flow (staged)
- MFA enrollment by internal user
- API key used for external integration (one caller)

---

## 9. Rollback

**High stakes.** If auth breaks in prod, customers cannot log in.

**Rollback plan:**
1. **Feature flag** — `AUTH_EDGE_FUNCTIONS_ENABLED` — frontend routes to Express or edge function based on flag
2. **Deploy edge functions behind flag off** — validate in staging before flipping
3. **Gradual rollout** — flip flag for 10% of tenants for 24h, then 100%
4. **Revert** — flip flag off, redeploy Express container (temp resurrect just for auth)

**Exception to master PRD:** auth may warrant keeping Express auth container alive during rollout. Similar treatment to billing in its reconcile PRD.

---

## 10. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SAML XML signing broken in Deno | Medium | **Critical** | Spike `xml-crypto` in Deno at Phase 5 kickoff; if broken, fall back to self-impl or keep Express container alive |
| Twilio SMS rate limit / blackhole during migration | Low | High | Pre-migration, verify Twilio account healthy; add retry w/ backoff |
| Self-hosted Supabase GoTrue doesn't support custom session minting | Low | Critical | Verify admin API supports this today (grep current code) |
| MFA audit log loses continuity across migration | Medium | Medium | Audit log table is the same DB; preserve `event_id` sequence |
| API key validate endpoint becomes internal bottleneck (every other edge function calls it) | High | Medium | Cache validation results in edge-function memory (~30s TTL per tenant); invalidate on revoke |
| Encryption-at-rest for MFA secrets not yet implemented | Medium | High | File as blocker; cannot delete Express until column-level encryption lands |
| Root-admin role check differs between Express and edge function | Medium | High | Port the check carefully; include a fixture-based test for each of the 3 admin endpoints |

---

## 11. Open questions

1. **Is Supabase SSO Enterprise available on self-hosted?** If yes, reconsider Option B. Confirm at kickoff.
2. **Is AWS SNS still in production use for SMS?** If no, drop it in port (simpler).
3. **Encryption at rest for MFA secrets** — current state: plaintext in DB? If yes, file a blocker issue that must be resolved before deleting Express. Migration plan: `pgcrypto` with a KMS-held key.
4. **Root admin role check** — what's the current authoritative check? `user.role === 'root_admin'` or `user.roleLevel === 8`? Affects port of admin/reset endpoint.
5. **API key validation hot path** — how many requests per minute today? Need cache strategy if > 1000 rpm.
6. **SSO session lifetime** — does custom code expire sessions independently of Supabase JWT expiry? If yes, port carefully.
7. **Magic link email OTP** — same service as SendGrid? Share the helper from Phase 3 email-marketing PRD.
8. **Existing `api-keys/` edge function (272 lines)** — does it cover all 9 Express endpoints, or subset? Audit first; decide merge vs. extend.

---

## 12. Definition of done

- [ ] 3 edge functions live at `functions.printyx.net/sso/*`, `mfa/*`, `api-keys/*`
- [ ] SAML + OIDC flows verified with real IdPs in prod
- [ ] MFA enrollment + verify works with all 3 methods (TOTP, email, SMS)
- [ ] API key CRUD + validate flow verified by dependent edge function
- [ ] RLS on all 8+ tables
- [ ] MFA secret encryption at rest implemented
- [ ] 3 Express files + 2 services deleted
- [ ] `twilio` + (optionally) `@aws-sdk/client-sns` removed from package.json
- [ ] Auth uptime monitored via synthetic login probe for 72 hours post-cutover
- [ ] Phase 5 moves to US-022 only after auth stable for 72 hours
