# Blog System — Compliance Overview (US-BLOG-084)

GDPR / CCPA / SOC2-friendly compliance reference for the Printyx Universal Blog
System. Covers the PII inventory, data-subject rights (DSAR access + erasure),
audit-log immutability, encryption at rest, the white-label host-app integration
contract (US-BLOG-083), webhook security (US-BLOG-079), and a DPA pointer.

> Scope: the `blog_*` tables and the `blog-platform-api` edge function. Printyx
> platform-wide compliance (auth, billing, CRM) is governed separately.

---

## 1. PII Inventory & Retention

The blog module is content-marketing tooling, so it holds **minimal personal
data** — mostly internal-user identifiers (authors, editors, actors), not
end-customer PII. End-reader analytics are stored in aggregate only.

| Table                      | PII fields                                  | Category                                  | Retention                     | Notes                                                   |
| -------------------------- | ------------------------------------------- | ----------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `blog_posts`               | `created_by_user_id`                        | Internal user id                          | Life of post + audit          | Anonymized to `anonymized` on erasure.                  |
| `blog_briefs`              | `created_by_user_id`, `assigned_to_user_id` | Internal user id                          | Life of brief                 | Anonymized on erasure.                                  |
| `blog_brand_voices`        | `created_by_user_id`, `sample_corpus`       | Internal user id; free text may embed PII | Life of config                | Author corpus is operator-supplied; treat as sensitive. |
| `blog_assets`              | `created_by_user_id`                        | Internal user id                          | Life of asset                 | File refs only; binary lives in object storage.         |
| `blog_authors`             | author display name / bio                   | Public author profile                     | Life of profile               | Intentionally public byline data.                       |
| `blog_audit_log`           | `actor_user_id`, `request_ip`, `user_agent` | Internal user id; network identifiers     | **Append-only** (US-BLOG-011) | Actor id anonymized on erasure; rows never deleted.     |
| `blog_api_keys`            | `created_by_user_id`, `key_hash`            | Internal user id; secret **hash**         | Life of key                   | Plaintext key never stored (SHA-256 hash only).         |
| `blog_webhooks`            | `created_by_user_id`, `encrypted_secret`    | Internal user id; secret (encrypted)      | Life of webhook               | HMAC secret AES-256-GCM encrypted.                      |
| `blog_webhook_deliveries`  | `payload` (may embed post/author data)      | Derived content                           | Bounded by retention sweep    | Carries no new PII beyond the source object.            |
| `blog_widget_config`       | `encrypted_sso_secret`                      | Shared secret (encrypted)                 | Life of config                | AES-256-GCM encrypted.                                  |
| `blog_backup_config`       | `encrypted_storage_creds`                   | Storage creds (encrypted)                 | Life of config                | AES-256-GCM encrypted.                                  |
| `blog_dsar_requests`       | `subject_user_id`                           | Internal user id                          | DSAR audit horizon            | Records the request itself, for accountability.         |
| `blog_performance_metrics` | none (aggregate counts)                     | Aggregate                                 | Per analytics policy          | No reader-level PII retained.                           |

**Aggregate-only principle:** reader-level analytics are never persisted at the
individual level. `blog_performance_metrics` holds counts (pageviews, clicks,
conversions) per post/date, which survive erasure unchanged.

---

## 2. Data Subject Access Requests (DSAR — Access)

Endpoint: `POST /blog-platform-api/compliance/dsar` with
`{ "subject_user_id": "...", "request_type": "access" }`.

- Logs the request in `blog_dsar_requests` (status `processing` → `completed`).
- Collects every row across the user-scoped tables (see `USER_SCOPED_TABLES`)
  filtered by `tenant_id` + the user's id, plus the subject's own audit-log
  rows (read-only).
- Returns the assembled data plus a per-table count summary.
- The export is itself audited (`blog_dsar.access`).

---

## 3. Right to Erasure (DSAR — Erasure)

Endpoint: `POST /blog-platform-api/compliance/dsar` with
`{ "subject_user_id": "...", "request_type": "erasure" }`.

- **Anonymizes, does not delete.** Every `created_by_user_id` /
  `assigned_to_user_id` reference to the subject is overwritten with the
  sentinel `anonymized`. Content (posts, briefs) is preserved so workspace
  continuity and aggregate metrics are unaffected.
- **Aggregate metrics preserved:** `blog_performance_metrics` is untouched — it
  holds no per-subject identifiers.
- **Audit log preserved with anonymized actor:** per US-BLOG-011 the audit log
  is append-only; erasure replaces the `actor_user_id` _pointer_ with
  `anonymized` rather than deleting events, so the integrity/accountability
  trail survives while the personal identifier is removed.
- The erasure run is itself audited (`blog_dsar.erasure`) with anonymization
  counts.

> The "workspace purge" path (full right-to-delete of a workspace) reuses the
> same anonymization-of-actor approach for the audit log so the immutable trail
> is never broken.

---

## 4. Audit-Log Immutability (US-BLOG-011)

`blog_audit_log` is append-only at the database layer: `drizzle/rls/blog.sql`
drops the UPDATE/DELETE policies on the table, so even the service role cannot
mutate historical events through RLS-governed paths. Every mutating endpoint in
`blog-platform-api` writes an entry via `writeAuditLog(admin,
withRequestContext(req, entry))` — webhooks CRUD/dispatch, API-key
create/revoke, backup export/import/config, widget config, and both DSAR
operations. The erasure flow's actor-anonymization is the **one** sanctioned
write to the actor pointer and is performed by the service client expressly for
GDPR/CCPA compliance; it does not remove or alter event rows.

---

## 5. Encryption at Rest

| Secret                      | Where                                        | Mechanism                                                        |
| --------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| Webhook HMAC signing secret | `blog_webhooks.encrypted_secret`             | AES-256-GCM (`encryptCredential`, `_shared/credential-vault.ts`) |
| SSO shared secret           | `blog_widget_config.encrypted_sso_secret`    | AES-256-GCM                                                      |
| Backup storage credentials  | `blog_backup_config.encrypted_storage_creds` | AES-256-GCM                                                      |
| Public API key              | `blog_api_keys.key_hash`                     | SHA-256 hash (one-way; key shown once at creation)               |

The vault key comes from `PRINTYX_CREDENTIAL_VAULT_KEY` (32-byte base64;
legacy alias `ADDRESS_BOOK_MASTER_KEY`). Plaintext secrets are never logged and
never returned by the API — endpoints return `*_set: boolean` markers instead.
Database storage (self-hosted Supabase Postgres) is additionally encrypted at
the volume level per the platform infrastructure policy.

---

## 6. White-Label Host-App Integration (US-BLOG-083)

The embeddable widget is configured per workspace via
`PUT /blog-platform-api/widget/config`:

- `hide_branding` removes the "Powered by Blog System" mark for white-label
  hosts; `logo_url`, `theme`, and `css_variables` supply the host's look.
- `GET /blog-platform-api/widget/theme` returns the resolved theme, branding
  flag, logo, and a ready-to-inject `:root { … }` CSS-variables block.

**SSO contract:** the parent app issues a signed token and the blog system
trusts it for a bounded session:

1. Operator stores a per-workspace shared secret (`sso_secret`, encrypted).
2. Parent app builds `token = base64url(JSON.stringify({ sub, exp })) + "." +
HMAC-SHA256(secret, base64url(payload))`.
3. Host calls `POST /blog-platform-api/widget/sso/verify` with `{ token }`.
4. The blog system verifies the HMAC (constant-time) and `exp`, then returns a
   short-lived `session_token` + `expires_at` (TTL = `sso_session_ttl_seconds`,
   default 1h). The session marker scopes the embedded widget for that user.

---

## 7. Webhook Security (US-BLOG-079) — Consumer Verification

Every delivery is POSTed with:

- `X-Blog-Event` — the event type (e.g. `post.published`).
- `X-Blog-Delivery` — the delivery id; **idempotency key**. Deliveries are
  at-least-once (retried with exponential backoff, dead-lettered after
  `max_attempts`), so consumers MUST dedupe on this id.
- `X-Blog-Signature` — `sha256=<hex>`, `<hex>` = HMAC-SHA256(secret, rawBody).

Verify by recomputing the HMAC over the **raw** request body with the stored
secret and comparing in constant time. Reject on mismatch. The signing secret
is stored encrypted and is auto-generated if not supplied at webhook creation.

---

## 8. SOC2-Friendly Logging Notes

- Every privileged mutation is captured in the append-only audit log with actor,
  action, target, before/after state, request IP, and user agent.
- API-key usage is metered per minute (`blog_api_usage`) for both rate limiting
  and access analytics.
- Tenant isolation is enforced on every query (`tenant_id` filter); the public
  API resolves tenant from the key hash, never from a client-supplied param.

---

## 9. DPA Template Pointer

A Data Processing Agreement (DPA) is required for customers acting as data
controllers where Printyx is the processor. Use the canonical Printyx DPA
template:

- **Template location:** `legal/templates/DPA.md` (request from Legal/Compliance
  if not present in this checkout). Standard Contractual Clauses (SCCs) for
  cross-border transfers are attached as Annex II.
- **Sub-processors:** the blog module's third-party processors are the
  configured CMS (WordPress/Ghost), keyword provider (DataForSEO), social
  platforms (X, LinkedIn), and the S3-compatible backup target. Each must be
  listed in the DPA sub-processor annex before enabling the corresponding
  adapter for a customer.
- **Contact:** privacy@printyx.net for DSAR intake and DPA execution.
