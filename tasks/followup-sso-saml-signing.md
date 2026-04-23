# Follow-up: SAML XML Signature Verification in Deno

**Status:** deferred from Phase 5 US-021 port. Edge function covers the framework (provider CRUD + OIDC + metadata); SAML assertion crypto is stubbed with 501.

---

## Why this is deferred

SAML XML signature verification requires:
1. Canonical XML (C14N) transformation — pick-a-subtree semantics
2. Reference digest validation (SHA-256 typical)
3. Signature validation using the IdP's X.509 public key
4. Algorithm whitelist (RSA-SHA256, sometimes ECDSA-SHA256)
5. Protection against XML-ext-entity (XXE) and signature-wrapping attacks

Node has `xml-crypto` + `xmldom`, both Node-only today. In Deno:
- `https://esm.sh/xml-crypto@3.2.0` — imports but has runtime quirks around Buffer usage
- `https://esm.sh/@xmldom/xmldom` — mostly works but needs careful parser config
- Pure `crypto.subtle` implementation is possible but ~500 lines of security-critical code

**This is a security boundary.** Getting it wrong means signature-wrapping → impersonation. It deserves a focused session, not a rushed port in the middle of a bulk migration.

---

## What's in place today

Edge function: `supabase/functions/sso/index.ts`
- **Works**: provider CRUD, OIDC callback (full token exchange), metadata XML, test probe, initiate URL, session store
- **Stubbed (501)**: `POST /callback/saml/:providerId`, `POST /logout/saml/:providerId`, `POST /providers/import`

Database: `sso_provider_configs` (rich schema with SAML + OIDC columns), `sso_sessions`.

Credential redaction: `sso/_credentials.ts` masks `oidc_client_secret`, `saml_certificate`, `saml_certificate_fingerprint` on every SELECT response.

---

## Options to unblock

### Option A — port `xml-crypto` via esm.sh, harden, review
- Spike `xml-crypto@3.2.0` + `@xmldom/xmldom` in a Deno edge function
- Validate against known-good + known-bad (signature-wrapping) SAML fixtures
- Effort: ~1-2 days focused. Security review mandatory before merge.

### Option B — self-hosted Supabase Enterprise SSO
- Verify whether this tier supports SSO on the self-hosted Supabase install
- If yes: migrate providers table → Supabase's SSO API, delete the custom code entirely
- Effort: low if supported; possibly blocked by self-hosted licensing

### Option C — keep Express running just for SAML
- Special-case: Express container stays alive for `/sso/callback/saml/*` only
- Everything else goes through the edge function
- Effort: near-zero, but leaves an Express footprint indefinitely

### Recommendation

**Start with Option B** — confirm whether self-hosted Supabase supports SSO. If yes, it's the lowest-risk path (managed, compliance-ready, no custom crypto). If no, move to Option A with a security review gate.

Option C is acceptable as a transition phase but shouldn't be the end state.

---

## Pre-requisites before picking this up

1. SAML fixture files — grab a real SAML response from Azure AD / Okta dev tenant
2. Signing + non-signing test certificates
3. Signature-wrapping attack fixtures (OWASP SAML Attack Test Cases)
4. Clear rollout plan: one pilot tenant first, then wider

---

## Related

- Credentials encryption at rest: `tasks/followup-credentials-encryption.md` — `sso_provider_configs.oidc_client_secret` + `saml_certificate` are part of that cross-domain encryption follow-up
- Phase 5 US-021 PRD `tasks/prd-migration-auth-security.md` §3 + §10 — originates this risk

---

## Definition of done for the follow-up

- [ ] SAML assertion signature verification passes with known-good fixtures
- [ ] Known-bad fixtures (signature wrapping, XXE, expired) rejected
- [ ] `POST /callback/saml/:providerId` no longer returns 501
- [ ] Security review sign-off
- [ ] Playwright E2E with one real SAML IdP (Auth0 dev tier works)
- [ ] Express SAML path removed (if Option A or B took its place)
