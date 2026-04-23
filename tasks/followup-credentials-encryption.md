# Follow-up: Credentials encryption at rest — scoping

**Status:** scoping complete, implementation deferred to Phase 5 auth-security PRD.
**Source:** `SESSION-STATUS-2026-04-23.md` follow-up #7.
**Scope:** the tables listed in §1. **Non-goal:** rotating existing secrets during rollout.

---

## 1. Affected columns (confirmed by grep in `shared/*-schema.ts`)

| Table | Column(s) | Type | Sensitivity |
|---|---|---|---|
| `platform_integrations` | `credentials` | `jsonb` (whole object sensitive) | **high** — OAuth refresh tokens, API keys for external vendors |
| `integration_webhooks` | `secret` | `text` (HMAC signing key) | **high** |
| `webhooks` | `secret` | `text` | **high** |
| `manufacturer_connections` | `api_secret`, `client_secret`, `webhook_secret` | `text` | **high** — manufacturer API access |
| `manufacturer_integration_accounts` | `credentials` | `jsonb` | **high** — same, legacy schema |
| `sso_providers` | `oidc_client_secret` | `text` (comment says "Encrypted" but column is plain text) | **high** — SSO client secret |
| `mfa_enrollments` | `secret` | `text` (TOTP seed) | **critical** — one-time password generator seed |
| `printyx_clients` | `snmp_auth_password`, `snmp_priv_password`, `http_password` | `text` | **medium** — device credentials, often shared across fleet |
| `gsc_oauth_credentials` | OAuth payload columns | — | **medium** — Google Search Console tokens |
| `customer_portal_users` | `password_hash` | `varchar(255)` | **N/A** — already hashed (bcrypt/argon2), not a target |
| `password_resets` | `token` | `varchar` | **N/A** — short-lived + single-use, not a target |
| `api_keys` | `key_hash` | — | **N/A** — already hashed |

**The columns labeled "Encrypted" in code comments are NOT actually encrypted.** The comment reflects the design intent; implementation never landed. This is the gap.

## 2. Options

### Option A — `pgcrypto` column-level symmetric encryption
- Postgres extension, already available on Supabase.
- `pgp_sym_encrypt(plaintext, key)` / `pgp_sym_decrypt(ciphertext::bytea, key)`.
- Key comes from `current_setting('app.encryption_key')` or env-injected `SET LOCAL`.
- **Pro:** no external dependency; queries that don't need the secret stay untouched; simple migration path (`UPDATE tbl SET col = pgp_sym_encrypt(col, key)` + type change).
- **Pro:** no change to edge-function code — just wrap reads in a view or server-side function that decrypts.
- **Con:** key rotation is heavy — every row must be re-encrypted. Key lives in DB env; compromising the DB compromises the key.
- **Con:** encrypted `text` / `bytea` is larger than plaintext; indexes on these columns don't work (no hash lookup on ciphertext).

### Option B — KMS envelope encryption (GCP KMS / AWS KMS / HashiCorp Vault)
- Per-tenant or per-column DEK (data encryption key), wrapped by a KEK held in KMS.
- Read path: decrypt DEK via KMS → decrypt column.
- **Pro:** key rotation is cheap (rotate KEK; re-wrap DEKs only, don't re-encrypt data).
- **Pro:** breach-resistance — DB compromise alone doesn't reveal plaintext.
- **Con:** adds a hard dependency on KMS availability at read time (latency + failure mode).
- **Con:** significant code change — every edge function that reads a secret column needs a KMS round-trip.
- **Con:** extra AWS/GCP cost (low but non-zero).

### Option C — Application-layer encryption with a single symmetric key in Coolify env
- Node-style: `node-forge` / `crypto.subtle` on the edge, key from env var.
- **Pro:** minimal infra, no DB extension.
- **Con:** every read/write needs the same code path; easy to miss one. Duplicates `pgcrypto` without the in-SQL convenience.

## 3. Recommendation

**Adopt Option A (`pgcrypto`) as the baseline, with a migration path to Option B for the MFA secrets specifically.**

Rationale:
- 5 of 7 domains (integrations, webhooks, manufacturer, SSO client secret, printer SNMP/HTTP creds) are credentials that:
  - Are **read rarely** (once per integration sync, not per user request).
  - Don't need KMS-grade breach resistance because the downstream service can revoke the credential if leaked.
- For those, `pgcrypto` with a single env-held key is the pragmatic minimum that closes the "plaintext in DB" finding, with minimal code churn.
- MFA secrets are the exception: they're the thing that **actually gates** auth, and their loss is catastrophic (TOTP replay from DB snapshot → account takeover). For `mfa_enrollments.secret`, plan Option B envelope encryption — but that's sequenced with the Phase 5 auth-security PRD anyway, so it's consistent.

## 4. Migration order (for the Phase 5 implementer)

1. Create `drizzle/functions/encryption.sql`:
   - `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
   - Helper functions `encrypt_secret(text)` / `decrypt_secret(bytea)` that read the key from `current_setting('app.printyx_encryption_key', true)`.
   - Coolify env var `ENCRYPTION_KEY_PRINTYX` → session `SET` on connect via pooler config, OR passed to each `.rpc()` invocation.
2. For each affected column:
   - `ALTER TABLE … ADD COLUMN <name>_encrypted bytea;`
   - Backfill: `UPDATE … SET <name>_encrypted = encrypt_secret(<name>) WHERE <name> IS NOT NULL;`
   - Update edge-function reads to use the `_encrypted` column via a `decrypt_secret()` wrapper (or a view).
   - Once read path is cut over, drop the plaintext column.
3. Audit step: run `_shared/credentials.ts::hasUnredactedCredentials()` against every edge-function response over 24h. No hits = safe to delete Express fallbacks that still touch plaintext columns (if any survive).
4. Key rotation playbook: documented in `tasks/prd-migration-auth-security.md` §10 (already on the Phase 5 roadmap).

## 5. Non-goals for this scoping pass

- Implementing the above — deferred to Phase 5 execution.
- Re-hashing `password_resets.token` or `api_keys.key_hash` — those are already one-way hashed.
- Rotating existing secrets as part of the migration — separate ops task; user-visible; needs per-vendor coordination.

## 6. Where this lives in the PRD set

- Phase 5 `prd-migration-auth-security.md` §4 "SSO XML handling" + §8 "Open Questions" (Q3 explicitly asks this question).
- Phase 5 `prd-migration-manufacturer-orders.md` §Encryption at rest (already flagged).
- Phase 5 `prd-migration-signatures.md` §11 follow-up #5.
- Phase 6 `prd-migration-sunset.md` §Follow-ups #3 (cross-domain rollup).

This doc supersedes the "not a regression from tonight's work" entry in `SESSION-STATUS-2026-04-23.md`. Treat as the definitive pre-Phase-5 scoping artifact.
