// Blog Platform API Edge Function (US-BLOG-079..085)
//
// The platform/infra layer for the Universal Blog System. One edge function
// fronts six capabilities; routes are namespaced under the function name:
//
//   US-BLOG-079 webhooks      /webhooks/*          — event-bus CRUD + dispatch + delivery + logs
//   US-BLOG-080 public API    /api-keys/*, /public/* — scoped API keys + API-KEY-authed read API
//   US-BLOG-081 backup/export /backup/*            — export bundle, import, scheduled backups
//   US-BLOG-083 white-label   /widget/*            — theming config + SSO token verify
//   US-BLOG-084 compliance    /compliance/*        — DSAR access/erasure + workspace purge
//
// Two auth paths:
//   1. JWT (default) — platform-admin / blog.post.edit gate via hasBlogAdmin().
//   2. API KEY (the /public/* read API, US-BLOG-080) — resolves tenant from a
//      hashed key, enforces scopes + per-key rate limit, never touches the JWT.
//
// DB via createSupabaseServiceClient(); every query filters tenant_id and reads
// filter .is('deleted_at', null) on soft-delete tables. Secrets (webhook signing
// secret, SSO shared secret, storage creds) are AES-256-GCM encrypted; API keys
// are SHA-256 hashed. Every mutation writes an audit log entry (append-only,
// US-BLOG-011). ZIP streaming and live S3 upload are stubbed (documented TODOs).

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { encryptCredential } from '../_shared/credential-vault.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const FUNCTION_NAME = 'blog-platform-api';

// ── Domain constants (mirrors shared/blog-platform-api-schema.ts) ────────────
const WEBHOOK_EVENTS = [
  'post.created',
  'post.updated',
  'post.published',
  'post.refreshed',
  'distribution.sent',
  'distribution.failed',
  'brief.approved',
  'refresh_queue.added',
] as const;
type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const API_KEY_SCOPES = [
  'keywords:read',
  'briefs:read',
  'posts:read',
  'distributions:read',
  'performance:read',
] as const;

// Public read endpoints → (scope, table, columns). Resolved by API key.
const PUBLIC_RESOURCES: Record<
  string,
  { scope: (typeof API_KEY_SCOPES)[number]; table: string; columns: string; softDelete: boolean }
> = {
  keywords: { scope: 'keywords:read', table: 'blog_keywords', columns: '*', softDelete: false },
  briefs: { scope: 'briefs:read', table: 'blog_briefs', columns: '*', softDelete: true },
  posts: {
    scope: 'posts:read',
    table: 'blog_posts',
    columns:
      'id,title,slug,excerpt,meta_description,status,canonical_url,cms_post_url,published_at,created_at,updated_at',
    softDelete: true,
  },
  distributions: {
    scope: 'distributions:read',
    table: 'blog_distributions',
    columns: '*',
    softDelete: false,
  },
  performance: {
    scope: 'performance:read',
    table: 'blog_performance_metrics',
    columns: '*',
    softDelete: false,
  },
};

const DEFAULT_RETRY_POLICY = { maxAttempts: 5, backoffBaseSeconds: 30, backoffFactor: 2 };

// ── Crypto helpers ───────────────────────────────────────────────────────────

/** SHA-256 hex of a UTF-8 string (used to hash API keys; never store plaintext). */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256 hex of `message` using `secret` (webhook signing + SSO verify). */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare to avoid timing oracles on signature checks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function hasBlogAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function resolveTenant(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string | null {
  return (
    (user.app_metadata?.tenantId as string) ||
    (user.app_metadata?.tenant_id as string) ||
    (user.user_metadata?.tenantId as string) ||
    (user.user_metadata?.tenant_id as string) ||
    null
  );
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

const webhookCreateSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  secret: z.string().min(8).max(500).optional(),
  event_filter: z.array(z.enum(WEBHOOK_EVENTS)).optional(),
  retry_policy: z
    .object({
      maxAttempts: z.number().int().min(1).max(20).optional(),
      backoffBaseSeconds: z.number().int().min(1).max(3600).optional(),
      backoffFactor: z.number().min(1).max(10).optional(),
    })
    .optional(),
  is_active: z.boolean().optional(),
});

const webhookPatchSchema = webhookCreateSchema.partial();

const dispatchSchema = z.object({
  event: z.enum(WEBHOOK_EVENTS),
  data: z.record(z.unknown()),
});

const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
  rate_limit_per_minute: z.number().int().min(1).max(100000).optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

const importSchema = z.object({
  collision: z.enum(['skip', 'overwrite', 'suffix']).default('suffix'),
  bundle: z.object({
    posts: z.array(z.record(z.unknown())).optional(),
    briefs: z.array(z.record(z.unknown())).optional(),
    settings: z.record(z.unknown()).optional(),
  }),
});

const backupConfigSchema = z.object({
  scheduled_enabled: z.boolean().optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
  storage_config: z.record(z.unknown()).optional(),
  storage_creds: z.string().max(4000).optional(),
});

const widgetConfigSchema = z.object({
  hide_branding: z.boolean().optional(),
  logo_url: z.string().url().max(2000).nullable().optional(),
  theme: z.string().max(40).optional(),
  css_variables: z.record(z.string()).optional(),
  sso_secret: z.string().min(16).max(500).optional(),
  sso_session_ttl_seconds: z.number().int().min(60).max(86400).optional(),
});

const ssoVerifySchema = z.object({
  // token form: base64url(payloadJson).hmacHex — parent app issues it.
  token: z.string().min(1).max(8000),
});

const dsarSchema = z.object({
  subject_user_id: z.string().min(1).max(200),
  request_type: z.enum(['access', 'erasure']),
});

// =============================================================================
// US-BLOG-079 — WEBHOOK EVENT BUS
// =============================================================================

async function listWebhooks(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return createCorsResponse({ error: 'Failed to list webhooks' }, 500, req);
  // Strip secrets; expose only a boolean marker.
  const safe = (data ?? []).map((w) => sanitizeWebhook(w));
  return createCorsResponse({ webhooks: safe }, 200, req);
}

function sanitizeWebhook(w: Record<string, unknown>): Record<string, unknown> {
  const { encrypted_secret, ...rest } = w;
  return { ...rest, secret_set: encrypted_secret != null };
}

async function createWebhook(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await safeJson(req);
  const parsed = webhookCreateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);

  const encryptedSecret = parsed.data.secret
    ? await encryptCredential(parsed.data.secret)
    : await encryptCredential(randomToken(24)); // auto-generate if not supplied

  const { data, error } = await admin
    .from('blog_webhooks')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      url: parsed.data.url,
      encrypted_secret: encryptedSecret,
      event_filter: parsed.data.event_filter ?? null,
      retry_policy: { ...DEFAULT_RETRY_POLICY, ...(parsed.data.retry_policy ?? {}) },
      is_active: parsed.data.is_active ?? true,
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error) return createCorsResponse({ error: 'Failed to create webhook' }, 500, req);

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_webhook.create',
    targetType: 'blog_webhook',
    targetId: data.id,
    summary: `Created webhook "${parsed.data.name}"`,
    afterState: { url: parsed.data.url, events: parsed.data.event_filter ?? 'all' },
  });
  return createCorsResponse({ webhook: sanitizeWebhook(data) }, 201, req);
}

async function patchWebhook(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const body = await safeJson(req);
  const parsed = webhookPatchSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.url !== undefined) patch.url = parsed.data.url;
  if (parsed.data.event_filter !== undefined) patch.event_filter = parsed.data.event_filter;
  if (parsed.data.retry_policy !== undefined)
    patch.retry_policy = { ...DEFAULT_RETRY_POLICY, ...parsed.data.retry_policy };
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;
  if (parsed.data.secret !== undefined)
    patch.encrypted_secret = await encryptCredential(parsed.data.secret);

  const { data, error } = await admin
    .from('blog_webhooks')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to update webhook' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Webhook not found' }, 404, req);

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_webhook.update',
    targetType: 'blog_webhook',
    targetId: id,
  });
  return createCorsResponse({ webhook: sanitizeWebhook(data) }, 200, req);
}

async function deleteWebhook(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_webhooks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to delete webhook' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Webhook not found' }, 404, req);
  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_webhook.delete',
    targetType: 'blog_webhook',
    targetId: id,
    summary: 'Deleted webhook',
  });
  return createCorsResponse({ success: true }, 200, req);
}

/**
 * Dispatch an event: enqueue a pending delivery for every active webhook whose
 * filter matches, then attempt immediate delivery. At-least-once: undelivered
 * rows stay 'pending'/'failed' for the cron sweep to retry.
 */
async function dispatchEvent(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await safeJson(req);
  const parsed = dispatchSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);
  const { event, data } = parsed.data;

  const { data: hooks, error } = await admin
    .from('blog_webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);
  if (error) return createCorsResponse({ error: 'Failed to load webhooks' }, 500, req);

  const matched = (hooks ?? []).filter((h) => {
    const filter = (h.event_filter as string[] | null) ?? [];
    return filter.length === 0 || filter.includes(event);
  });

  const enqueued: string[] = [];
  for (const hook of matched) {
    const maxAttempts = Number((hook.retry_policy as { maxAttempts?: number })?.maxAttempts ?? 5);
    const payload = {
      event,
      tenant_id: tenantId,
      webhook_id: hook.id,
      delivered_at: new Date().toISOString(),
      data,
    };
    const { data: row, error: insErr } = await admin
      .from('blog_webhook_deliveries')
      .insert({
        tenant_id: tenantId,
        webhook_id: hook.id,
        event_type: event,
        payload,
        status: 'pending',
        attempt_count: 0,
        max_attempts: maxAttempts,
        next_attempt_at: new Date().toISOString(),
        attempts: [],
      })
      .select()
      .single();
    if (!insErr && row) enqueued.push(row.id);
  }

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_webhook.dispatch',
    targetType: 'blog_event',
    targetId: null,
    summary: `Dispatched ${event} to ${enqueued.length} webhook(s)`,
    afterState: { event, delivery_ids: enqueued },
  });

  // Best-effort immediate delivery; failures stay queued for the cron sweep.
  const delivered = await deliverPendingInternal(admin, tenantId, enqueued.length || 25);
  return createCorsResponse(
    { event, enqueued: enqueued.length, delivery_ids: enqueued, attempted: delivered },
    202,
    req,
  );
}

/**
 * Deliver pending/failed deliveries that are due. Signs each payload with the
 * webhook's HMAC-SHA256 secret, records the attempt, applies exponential
 * backoff, and dead-letters after max attempts. Cron-callable via the route.
 */
async function deliverPendingInternal(
  admin: Admin,
  tenantId: string,
  limit: number,
): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: due } = await admin
    .from('blog_webhook_deliveries')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(limit);

  let attempted = 0;
  for (const d of due ?? []) {
    attempted++;
    // Load the webhook to get URL + decryptable secret.
    const { data: hook } = await admin
      .from('blog_webhooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', d.webhook_id)
      .maybeSingle();
    if (!hook || hook.deleted_at || !hook.is_active) {
      await admin
        .from('blog_webhook_deliveries')
        .update({ status: 'dead', updated_at: new Date().toISOString() })
        .eq('id', d.id)
        .eq('tenant_id', tenantId);
      continue;
    }

    await attemptDelivery(admin, tenantId, d, hook);
  }
  return attempted;
}

/** Single delivery attempt + state transition. Extracted for testability. */
async function attemptDelivery(
  admin: Admin,
  tenantId: string,
  delivery: Record<string, unknown>,
  hook: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify(delivery.payload);
  let secret = '';
  try {
    const { decryptCredential } = await import('../_shared/credential-vault.ts');
    if (hook.encrypted_secret)
      secret = await decryptCredential(hook.encrypted_secret as { blob: string; v: 1 });
  } catch (err) {
    console.error('webhook secret decrypt failed', err);
  }
  const signature = secret ? await hmacSha256Hex(secret, body) : '';

  const attemptNo = Number(delivery.attempt_count ?? 0) + 1;
  const maxAttempts = Number(delivery.max_attempts ?? 5);
  const startedAt = Date.now();

  let httpStatus: number | null = null;
  let respText = '';
  let ok = false;
  try {
    const res = await fetch(String(hook.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blog-Event': String(delivery.event_type),
        'X-Blog-Signature': `sha256=${signature}`,
        'X-Blog-Delivery': String(delivery.id),
      },
      body,
    });
    httpStatus = res.status;
    respText = (await res.text().catch(() => '')).slice(0, 2000);
    ok = res.status >= 200 && res.status < 300;
  } catch (err) {
    respText = (err instanceof Error ? err.message : 'network error').slice(0, 2000);
  }

  const attempts = Array.isArray(delivery.attempts) ? (delivery.attempts as unknown[]) : [];
  attempts.push({
    attempt: attemptNo,
    at: new Date().toISOString(),
    status: httpStatus,
    ms: Date.now() - startedAt,
    ...(ok ? {} : { error: respText }),
  });

  if (ok) {
    await admin
      .from('blog_webhook_deliveries')
      .update({
        status: 'delivered',
        attempt_count: attemptNo,
        last_response_status: httpStatus,
        last_response_body: respText,
        delivered_at: new Date().toISOString(),
        attempts,
        next_attempt_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.id)
      .eq('tenant_id', tenantId);
    return;
  }

  // Failure → backoff or dead-letter.
  const policy = (hook.retry_policy as Record<string, number>) ?? DEFAULT_RETRY_POLICY;
  const base = Number(policy.backoffBaseSeconds ?? 30);
  const factor = Number(policy.backoffFactor ?? 2);
  const dead = attemptNo >= maxAttempts;
  const nextAttemptAt = dead
    ? null
    : new Date(Date.now() + base * Math.pow(factor, attemptNo - 1) * 1000).toISOString();

  await admin
    .from('blog_webhook_deliveries')
    .update({
      status: dead ? 'dead' : 'failed',
      attempt_count: attemptNo,
      last_response_status: httpStatus,
      last_response_body: respText,
      next_attempt_at: nextAttemptAt,
      attempts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id)
    .eq('tenant_id', tenantId);
}

async function listDeliveries(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_webhook_deliveries')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  const webhookId = url.searchParams.get('webhook_id');
  const status = url.searchParams.get('status');
  if (webhookId) q = q.eq('webhook_id', webhookId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list deliveries' }, 500, req);
  return createCorsResponse({ deliveries: data ?? [] }, 200, req);
}

// =============================================================================
// US-BLOG-080 — PUBLIC API: keys + key-authed read endpoints
// =============================================================================

function sanitizeApiKey(k: Record<string, unknown>): Record<string, unknown> {
  const { key_hash, ...rest } = k;
  return rest;
}

async function listApiKeys(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_api_keys')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return createCorsResponse({ error: 'Failed to list API keys' }, 500, req);
  return createCorsResponse({ api_keys: (data ?? []).map(sanitizeApiKey) }, 200, req);
}

async function createApiKey(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await safeJson(req);
  const parsed = apiKeyCreateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);

  // Full key returned ONCE; only the hash + prefix persist.
  const secret = randomToken(24);
  const fullKey = `blogk_live_${secret}`;
  const keyHash = await sha256Hex(fullKey);
  const keyPrefix = fullKey.slice(0, 16);

  const { data, error } = await admin
    .from('blog_api_keys')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: parsed.data.scopes,
      rate_limit_per_minute: parsed.data.rate_limit_per_minute ?? 120,
      expires_at: parsed.data.expires_at ?? null,
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error) return createCorsResponse({ error: 'Failed to create API key' }, 500, req);

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_api_key.create',
    targetType: 'blog_api_key',
    targetId: data.id,
    summary: `Created API key "${parsed.data.name}"`,
    afterState: { scopes: parsed.data.scopes },
  });

  // The plaintext key is surfaced exactly once.
  return createCorsResponse({ api_key: sanitizeApiKey(data), key: fullKey }, 201, req);
}

async function revokeApiKey(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_api_keys')
    .update({ revoked_at: new Date().toISOString(), deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to revoke API key' }, 500, req);
  if (!data) return createCorsResponse({ error: 'API key not found' }, 404, req);
  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_api_key.revoke',
    targetType: 'blog_api_key',
    targetId: id,
    summary: 'Revoked API key',
  });
  return createCorsResponse({ success: true }, 200, req);
}

interface ResolvedKey {
  id: string;
  tenantId: string;
  scopes: string[];
  rateLimit: number;
}

/** Resolve an API key from the X-Api-Key header → { tenant, scopes }. */
async function resolveApiKey(admin: Admin, rawKey: string): Promise<ResolvedKey | null> {
  const keyHash = await sha256Hex(rawKey);
  const { data } = await admin
    .from('blog_api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && Date.parse(data.expires_at as string) < Date.now()) return null;
  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    scopes: (data.scopes as string[] | null) ?? [],
    rateLimit: Number(data.rate_limit_per_minute ?? 120),
  };
}

/**
 * Enforce + record per-key rate limit using a minute-bucket counter. Returns
 * the current count, or null if over the limit.
 */
async function recordUsage(
  admin: Admin,
  key: ResolvedKey,
  endpoint: string,
): Promise<{ count: number; limited: boolean }> {
  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const { data: existing } = await admin
    .from('blog_api_usage')
    .select('*')
    .eq('api_key_id', key.id)
    .eq('window_start', windowStart)
    .maybeSingle();

  const nextCount = (existing ? Number(existing.request_count) : 0) + 1;
  if (existing) {
    await admin
      .from('blog_api_usage')
      .update({
        request_count: nextCount,
        last_endpoint: endpoint,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await admin.from('blog_api_usage').insert({
      tenant_id: key.tenantId,
      api_key_id: key.id,
      window_start: windowStart,
      request_count: 1,
      last_endpoint: endpoint,
    });
  }
  await admin
    .from('blog_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id);
  return { count: nextCount, limited: nextCount > key.rateLimit };
}

/** API-KEY-authenticated public read endpoint (US-BLOG-080). */
async function handlePublicRead(admin: Admin, resource: string, url: URL, req: Request) {
  const rawKey = req.headers.get('x-api-key') || '';
  if (!rawKey) {
    return createCorsResponse({ error: 'Missing X-Api-Key header' }, 401, req);
  }
  const key = await resolveApiKey(admin, rawKey);
  if (!key) return createCorsResponse({ error: 'Invalid or expired API key' }, 401, req);

  const def = PUBLIC_RESOURCES[resource];
  if (!def) return createCorsResponse({ error: 'Unknown public resource' }, 404, req);
  if (!key.scopes.includes(def.scope)) {
    return createCorsResponse({ error: `API key missing scope ${def.scope}` }, 403, req);
  }

  const usage = await recordUsage(admin, key, `/public/${resource}`);
  const rateHeaders: Record<string, string> = {};
  if (usage.limited) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(key.rateLimit),
        'X-RateLimit-Remaining': '0',
        'Retry-After': '60',
      },
    });
  }

  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  let q = admin
    .from(def.table)
    .select(def.columns)
    .eq('tenant_id', key.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (def.softDelete) q = q.is('deleted_at', null);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Query failed' }, 500, req);

  // Public read responses always carry rate-limit headers.
  return new Response(JSON.stringify({ data: data ?? [], resource }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(key.rateLimit),
      'X-RateLimit-Remaining': String(Math.max(0, key.rateLimit - usage.count)),
      ...rateHeaders,
    },
  });
}

// =============================================================================
// US-BLOG-081 — BACKUP / EXPORT / IMPORT
// =============================================================================

/** Front-matter Markdown serialization for a post export. */
function postToMarkdown(post: Record<string, unknown>): string {
  const fm = [
    '---',
    `title: ${JSON.stringify(post.title ?? '')}`,
    `slug: ${JSON.stringify(post.slug ?? '')}`,
    `status: ${JSON.stringify(post.status ?? '')}`,
    `meta_description: ${JSON.stringify(post.meta_description ?? '')}`,
    `canonical_url: ${JSON.stringify(post.canonical_url ?? '')}`,
    '---',
    '',
  ].join('\n');
  return fm + (post.body_markdown ?? post.excerpt ?? '');
}

/**
 * Assemble a full-workspace export bundle: posts as Markdown+frontmatter,
 * briefs as Markdown, assets as file refs, settings as JSON. Returns a manifest
 * + the assembled bundle structure (JSON describing the ZIP contents).
 * NOTE: ZIP streaming + S3 upload are TODO — the manifest is the contract.
 */
async function exportWorkspace(admin: Admin, tenantId: string, userId: string, req: Request) {
  const [posts, briefs, assets, settings] = await Promise.all([
    admin
      .from('blog_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(5000),
    admin
      .from('blog_briefs')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(5000),
    admin
      .from('blog_assets')
      .select('id,filename,storage_path,mime_type,alt_text')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(5000),
    admin.from('blog_brand_voices').select('*').eq('tenant_id', tenantId).is('deleted_at', null),
  ]);

  const postFiles = (posts.data ?? []).map((p) => ({
    path: `posts/${p.slug ?? p.id}.md`,
    content: postToMarkdown(p),
  }));
  const briefFiles = (briefs.data ?? []).map((b) => ({
    path: `briefs/${b.id}.md`,
    content: `# ${b.title ?? 'Brief'}\n\n${b.outline ?? b.summary ?? ''}`,
  }));
  const assetRefs = (assets.data ?? []).map((a) => ({
    path: `assets/${a.filename ?? a.id}`,
    ref: a.storage_path,
    mime: a.mime_type,
  }));

  const manifest = {
    version: 1,
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    counts: {
      posts: postFiles.length,
      briefs: briefFiles.length,
      assets: assetRefs.length,
      settings: (settings.data ?? []).length,
    },
    files: [
      ...postFiles.map((f) => f.path),
      ...briefFiles.map((f) => f.path),
      ...assetRefs.map((f) => f.path),
      'settings.json',
    ],
    note: 'ZIP streaming + S3 upload are a TODO; this manifest is the canonical bundle contract.',
  };

  const { data: rec } = await admin
    .from('blog_backups')
    .insert({
      tenant_id: tenantId,
      kind: 'manual',
      status: 'completed',
      manifest,
      completed_at: new Date().toISOString(),
      created_by_user_id: userId,
    })
    .select()
    .single();

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_backup.export',
    targetType: 'blog_backup',
    targetId: rec?.id ?? null,
    summary: `Exported workspace (${manifest.counts.posts} posts)`,
    afterState: manifest.counts,
  });

  return createCorsResponse(
    {
      backup_id: rec?.id,
      manifest,
      bundle: {
        'settings.json': JSON.stringify({ brand_voices: settings.data ?? [] }, null, 2),
        posts: postFiles,
        briefs: briefFiles,
        assets: assetRefs,
      },
    },
    200,
    req,
  );
}

/** Import a bundle with collision resolution (skip | overwrite | suffix). */
async function importWorkspace(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await safeJson(req);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);
  const { collision, bundle } = parsed.data;

  const result = { posts_imported: 0, posts_skipped: 0, posts_renamed: 0 };

  for (const post of bundle.posts ?? []) {
    const slug = String(post.slug ?? '').trim();
    if (!slug) continue;
    const { data: existing } = await admin
      .from('blog_posts')
      .select('id,slug')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();

    let targetSlug = slug;
    if (existing) {
      if (collision === 'skip') {
        result.posts_skipped++;
        continue;
      }
      if (collision === 'overwrite') {
        await admin
          .from('blog_posts')
          .update({
            title: post.title ?? existing.slug,
            body_markdown: post.body_markdown ?? post.body ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId);
        result.posts_imported++;
        continue;
      }
      // suffix
      targetSlug = `${slug}-${randomToken(3)}`;
      result.posts_renamed++;
    }

    await admin.from('blog_posts').insert({
      tenant_id: tenantId,
      title: post.title ?? targetSlug,
      slug: targetSlug,
      body_markdown: post.body_markdown ?? post.body ?? null,
      status: 'draft',
      created_by_user_id: userId,
    });
    result.posts_imported++;
  }

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_backup.import',
    targetType: 'blog_workspace',
    targetId: null,
    summary: `Imported workspace bundle (collision=${collision})`,
    afterState: result,
  });
  return createCorsResponse({ result, collision }, 200, req);
}

async function getBackupConfig(admin: Admin, tenantId: string, req: Request) {
  const { data } = await admin
    .from('blog_backup_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const safe = data ? sanitizeBackupConfig(data) : null;
  return createCorsResponse({ config: safe }, 200, req);
}

function sanitizeBackupConfig(c: Record<string, unknown>): Record<string, unknown> {
  const { encrypted_storage_creds, ...rest } = c;
  return { ...rest, storage_creds_set: encrypted_storage_creds != null };
}

async function upsertBackupConfig(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await safeJson(req);
  const parsed = backupConfigSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.scheduled_enabled !== undefined)
    patch.scheduled_enabled = parsed.data.scheduled_enabled;
  if (parsed.data.retention_days !== undefined) patch.retention_days = parsed.data.retention_days;
  if (parsed.data.storage_config !== undefined) patch.storage_config = parsed.data.storage_config;
  if (parsed.data.storage_creds !== undefined)
    patch.encrypted_storage_creds = await encryptCredential(parsed.data.storage_creds);

  const { data: existing } = await admin
    .from('blog_backup_config')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  let row;
  if (existing) {
    const { data } = await admin
      .from('blog_backup_config')
      .update(patch)
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    row = data;
  } else {
    const { data } = await admin
      .from('blog_backup_config')
      .insert({ tenant_id: tenantId, created_by_user_id: userId, ...patch })
      .select()
      .single();
    row = data;
  }

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_backup.config_update',
    targetType: 'blog_backup_config',
    targetId: row?.id ?? null,
    summary: 'Updated backup config',
  });
  return createCorsResponse({ config: row ? sanitizeBackupConfig(row) : null }, 200, req);
}

/**
 * Scheduled-backup runner (cron-callable). For every workspace with
 * scheduled_enabled, records a backup row and prunes rows past retention.
 * S3 upload is a stub. Tenant-scoped here (one workspace per call).
 */
async function runScheduledBackup(admin: Admin, tenantId: string, userId: string, req: Request) {
  const { data: cfg } = await admin
    .from('blog_backup_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!cfg?.scheduled_enabled) {
    return createCorsResponse({ error: 'Scheduled backups not enabled for workspace' }, 409, req);
  }
  const retentionDays = Number(cfg.retention_days ?? 30);
  const expiresAt = new Date(Date.now() + retentionDays * 86400000).toISOString();

  const { data: rec } = await admin
    .from('blog_backups')
    .insert({
      tenant_id: tenantId,
      kind: 'scheduled',
      status: 'completed', // S3 upload stubbed; record marks the run
      manifest: { note: 'Scheduled bundle; S3 upload is a stubbed adapter (TODO).' },
      storage_key: `s3://${(cfg.storage_config as { bucket?: string })?.bucket ?? 'blog-backups'}/${tenantId}/${Date.now()}.zip`,
      expires_at: expiresAt,
      completed_at: new Date().toISOString(),
      created_by_user_id: userId,
    })
    .select()
    .single();

  // Prune expired backup records (retention sweep).
  await admin
    .from('blog_backups')
    .update({ status: 'expired' })
    .eq('tenant_id', tenantId)
    .lt('expires_at', new Date().toISOString())
    .neq('status', 'expired');

  await admin
    .from('blog_backup_config')
    .update({ last_backup_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'system',
    action: 'blog_backup.scheduled_run',
    targetType: 'blog_backup',
    targetId: rec?.id ?? null,
    summary: 'Ran scheduled backup',
  });
  return createCorsResponse({ backup_id: rec?.id, expires_at: expiresAt }, 200, req);
}

// =============================================================================
// US-BLOG-083 — WHITE-LABEL WIDGET + SSO
// =============================================================================

function sanitizeWidget(w: Record<string, unknown>): Record<string, unknown> {
  const { encrypted_sso_secret, ...rest } = w;
  return { ...rest, sso_secret_set: encrypted_sso_secret != null };
}

async function getWidgetConfig(admin: Admin, tenantId: string, req: Request) {
  const { data } = await admin
    .from('blog_widget_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();
  return createCorsResponse({ config: data ? sanitizeWidget(data) : null }, 200, req);
}

async function upsertWidgetConfig(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await safeJson(req);
  const parsed = widgetConfigSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.hide_branding !== undefined) patch.hide_branding = parsed.data.hide_branding;
  if (parsed.data.logo_url !== undefined) patch.logo_url = parsed.data.logo_url;
  if (parsed.data.theme !== undefined) patch.theme = parsed.data.theme;
  if (parsed.data.css_variables !== undefined) patch.css_variables = parsed.data.css_variables;
  if (parsed.data.sso_session_ttl_seconds !== undefined)
    patch.sso_session_ttl_seconds = parsed.data.sso_session_ttl_seconds;
  if (parsed.data.sso_secret !== undefined)
    patch.encrypted_sso_secret = await encryptCredential(parsed.data.sso_secret);

  const { data: existing } = await admin
    .from('blog_widget_config')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  let row;
  if (existing) {
    const { data } = await admin
      .from('blog_widget_config')
      .update(patch)
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    row = data;
  } else {
    const { data } = await admin
      .from('blog_widget_config')
      .insert({ tenant_id: tenantId, created_by_user_id: userId, ...patch })
      .select()
      .single();
    row = data;
  }

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_widget.config_update',
    targetType: 'blog_widget_config',
    targetId: row?.id ?? null,
    summary: 'Updated white-label widget config',
  });
  return createCorsResponse({ config: row ? sanitizeWidget(row) : null }, 200, req);
}

/** Return the theming CSS variables for the host app (US-BLOG-083). */
async function getWidgetTheme(admin: Admin, tenantId: string, req: Request) {
  const { data } = await admin
    .from('blog_widget_config')
    .select('theme,css_variables,hide_branding,logo_url')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();
  const vars = (data?.css_variables as Record<string, string> | null) ?? {};
  const css = `:root {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`;
  return createCorsResponse(
    {
      theme: data?.theme ?? 'light',
      hide_branding: data?.hide_branding ?? false,
      logo_url: data?.logo_url ?? null,
      css_variables: vars,
      css,
    },
    200,
    req,
  );
}

/**
 * Verify an SSO token the parent app issued (US-BLOG-083). Token form:
 *   base64url(JSON.stringify(payload)) + '.' + HMAC-SHA256(secret, encodedPayload)
 * Returns a short-lived session marker when the signature + expiry check pass.
 */
async function verifySsoToken(admin: Admin, tenantId: string, req: Request) {
  const body = await safeJson(req);
  const parsed = ssoVerifySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);

  const { data: cfg } = await admin
    .from('blog_widget_config')
    .select('encrypted_sso_secret,sso_session_ttl_seconds')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!cfg?.encrypted_sso_secret) {
    return createCorsResponse({ error: 'SSO not configured for workspace' }, 409, req);
  }

  let secret = '';
  try {
    const { decryptCredential } = await import('../_shared/credential-vault.ts');
    secret = await decryptCredential(cfg.encrypted_sso_secret as { blob: string; v: 1 });
  } catch {
    return createCorsResponse({ error: 'SSO secret unavailable' }, 500, req);
  }

  const [encodedPayload, providedSig] = parsed.data.token.split('.');
  if (!encodedPayload || !providedSig) {
    return createCorsResponse({ valid: false, error: 'Malformed token' }, 400, req);
  }
  const expectedSig = await hmacSha256Hex(secret, encodedPayload);
  if (!timingSafeEqual(expectedSig, providedSig)) {
    return createCorsResponse({ valid: false, error: 'Bad signature' }, 401, req);
  }

  let payload: { sub?: string; exp?: number };
  try {
    payload = JSON.parse(b64urlDecode(encodedPayload));
  } catch {
    return createCorsResponse({ valid: false, error: 'Unparseable payload' }, 400, req);
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return createCorsResponse({ valid: false, error: 'Token expired' }, 401, req);
  }

  const ttl = Number(cfg.sso_session_ttl_seconds ?? 3600);
  const session = {
    valid: true,
    subject: payload.sub ?? null,
    tenant_id: tenantId,
    session_token: randomToken(16),
    expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
  };
  return createCorsResponse(session, 200, req);
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

// =============================================================================
// US-BLOG-084 — COMPLIANCE: DSAR access / erasure / purge
// =============================================================================

/** Tables that reference a user via created_by_user_id / assigned_to_user_id. */
const USER_SCOPED_TABLES: { table: string; column: string }[] = [
  { table: 'blog_posts', column: 'created_by_user_id' },
  { table: 'blog_briefs', column: 'created_by_user_id' },
  { table: 'blog_briefs', column: 'assigned_to_user_id' },
  { table: 'blog_brand_voices', column: 'created_by_user_id' },
  { table: 'blog_assets', column: 'created_by_user_id' },
];

const ANONYMIZED_ACTOR = 'anonymized';

/** DSAR access: export all of a subject's data across their workspaces. */
async function dsarAccess(
  admin: Admin,
  tenantId: string,
  userId: string,
  subjectUserId: string,
  req: Request,
) {
  const { data: rec } = await admin
    .from('blog_dsar_requests')
    .insert({
      tenant_id: tenantId,
      subject_user_id: subjectUserId,
      request_type: 'access',
      status: 'processing',
      created_by_user_id: userId,
    })
    .select()
    .single();

  const collected: Record<string, unknown[]> = {};
  for (const { table, column } of USER_SCOPED_TABLES) {
    const { data } = await admin
      .from(table)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq(column, subjectUserId)
      .limit(5000);
    const k = `${table}.${column}`;
    collected[k] = data ?? [];
  }
  // Audit trail authored by the subject (immutable; included read-only).
  const { data: auditRows } = await admin
    .from('blog_audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('actor_user_id', subjectUserId)
    .limit(5000);
  collected['blog_audit_log.actor_user_id'] = auditRows ?? [];

  const counts = Object.fromEntries(Object.entries(collected).map(([k, v]) => [k, v.length]));
  await admin
    .from('blog_dsar_requests')
    .update({
      status: 'completed',
      result: { counts },
      completed_at: new Date().toISOString(),
    })
    .eq('id', rec!.id);

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_dsar.access',
    targetType: 'blog_dsar_request',
    targetId: rec?.id ?? null,
    summary: `DSAR access export for subject ${subjectUserId}`,
    afterState: { counts },
  });
  return createCorsResponse(
    { request_id: rec?.id, subject_user_id: subjectUserId, data: collected },
    200,
    req,
  );
}

/**
 * DSAR erasure: anonymize the subject's PII-bearing references while preserving
 * aggregate metrics. The append-only audit log keeps its rows but the actor id
 * is anonymized (US-BLOG-011 immutability is at the row-event level; we replace
 * the actor pointer, not delete events).
 */
async function dsarErasure(
  admin: Admin,
  tenantId: string,
  userId: string,
  subjectUserId: string,
  req: Request,
) {
  const { data: rec } = await admin
    .from('blog_dsar_requests')
    .insert({
      tenant_id: tenantId,
      subject_user_id: subjectUserId,
      request_type: 'erasure',
      status: 'processing',
      created_by_user_id: userId,
    })
    .select()
    .single();

  const anonymized: Record<string, number> = {};
  for (const { table, column } of USER_SCOPED_TABLES) {
    const { data } = await admin
      .from(table)
      .update({ [column]: ANONYMIZED_ACTOR, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq(column, subjectUserId)
      .select('id');
    anonymized[`${table}.${column}`] = (data ?? []).length;
  }
  // Audit log: anonymize the actor pointer, never delete the event rows.
  const { data: auditUpdated } = await admin
    .from('blog_audit_log')
    .update({ actor_user_id: ANONYMIZED_ACTOR })
    .eq('tenant_id', tenantId)
    .eq('actor_user_id', subjectUserId)
    .select('id');
  anonymized['blog_audit_log.actor_user_id'] = (auditUpdated ?? []).length;

  await admin
    .from('blog_dsar_requests')
    .update({
      status: 'completed',
      result: { anonymized },
      completed_at: new Date().toISOString(),
    })
    .eq('id', rec!.id);

  await audit(admin, req, {
    tenantId,
    actorUserId: userId,
    actorType: 'user',
    action: 'blog_dsar.erasure',
    targetType: 'blog_dsar_request',
    targetId: rec?.id ?? null,
    summary: `DSAR erasure (anonymize) for subject ${subjectUserId}`,
    afterState: { anonymized },
  });
  return createCorsResponse({ request_id: rec?.id, anonymized }, 200, req);
}

async function createDsar(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await safeJson(req);
  const parsed = dsarSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, req);
  if (parsed.data.request_type === 'access') {
    return await dsarAccess(admin, tenantId, userId, parsed.data.subject_user_id, req);
  }
  return await dsarErasure(admin, tenantId, userId, parsed.data.subject_user_id, req);
}

async function listDsar(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_dsar_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('requested_at', { ascending: false })
    .limit(200);
  if (error) return createCorsResponse({ error: 'Failed to list DSAR requests' }, 500, req);
  return createCorsResponse({ requests: data ?? [] }, 200, req);
}

// ── Shared utilities ─────────────────────────────────────────────────────────

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function validationError(error: z.ZodError, req: Request): Response {
  return createCorsResponse({ error: 'Validation failed', details: error.flatten() }, 400, req);
}

async function audit(
  admin: Admin,
  req: Request,
  entry: Parameters<typeof withRequestContext>[1],
): Promise<void> {
  await writeAuditLog(admin, withRequestContext(req, entry));
}

// =============================================================================
// HANDLER / ROUTER
// =============================================================================

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, FUNCTION_NAME);
    const admin = createSupabaseServiceClient();

    // ── PUBLIC API-KEY PATH (US-BLOG-080) — no JWT ──────────────────────────
    // GET /public/:resource  authenticated by X-Api-Key, not the JWT gate.
    if (parts[0] === 'public') {
      if (req.method !== 'GET') {
        return createCorsResponse({ error: 'Public API is read-only' }, 405, req);
      }
      if (!parts[1]) return createCorsResponse({ error: 'Resource required' }, 400, req);
      return await handlePublicRead(admin, parts[1], url, req);
    }

    // ── JWT PATH (everything else) ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }
    if (!hasBlogAdmin(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.post.edit required' }, 403, req);
    }
    const tenantId = resolveTenant(user) || req.headers.get('x-tenant-id');
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    const userId = user.id;

    // ── US-BLOG-079: webhooks ───────────────────────────────────────────────
    if (parts[0] === 'webhooks') {
      // /webhooks/dispatch
      if (parts[1] === 'dispatch' && req.method === 'POST')
        return await dispatchEvent(admin, tenantId, userId, req);
      // /webhooks/deliver  (cron-callable)
      if (parts[1] === 'deliver' && req.method === 'POST') {
        const attempted = await deliverPendingInternal(admin, tenantId, 100);
        return createCorsResponse({ attempted }, 200, req);
      }
      // /webhooks/deliveries
      if (parts[1] === 'deliveries' && req.method === 'GET')
        return await listDeliveries(admin, tenantId, url, req);
      // /webhooks/:id
      if (parts[1] && !parts[2]) {
        if (req.method === 'PATCH' || req.method === 'PUT')
          return await patchWebhook(admin, tenantId, userId, parts[1], req);
        if (req.method === 'DELETE')
          return await deleteWebhook(admin, tenantId, userId, parts[1], req);
      }
      // /webhooks
      if (!parts[1]) {
        if (req.method === 'GET') return await listWebhooks(admin, tenantId, req);
        if (req.method === 'POST') return await createWebhook(admin, tenantId, userId, req);
      }
    }

    // ── US-BLOG-080: API keys ───────────────────────────────────────────────
    if (parts[0] === 'api-keys') {
      if (parts[1] && !parts[2] && req.method === 'DELETE')
        return await revokeApiKey(admin, tenantId, userId, parts[1], req);
      if (!parts[1]) {
        if (req.method === 'GET') return await listApiKeys(admin, tenantId, req);
        if (req.method === 'POST') return await createApiKey(admin, tenantId, userId, req);
      }
    }

    // ── US-BLOG-081: backup / export / import ───────────────────────────────
    if (parts[0] === 'backup') {
      if (parts[1] === 'export' && req.method === 'POST')
        return await exportWorkspace(admin, tenantId, userId, req);
      if (parts[1] === 'import' && req.method === 'POST')
        return await importWorkspace(admin, tenantId, userId, req);
      if (parts[1] === 'run' && req.method === 'POST')
        return await runScheduledBackup(admin, tenantId, userId, req);
      if (parts[1] === 'config') {
        if (req.method === 'GET') return await getBackupConfig(admin, tenantId, req);
        if (req.method === 'PUT' || req.method === 'PATCH')
          return await upsertBackupConfig(admin, tenantId, userId, req);
      }
    }

    // ── US-BLOG-083: white-label widget + SSO ───────────────────────────────
    if (parts[0] === 'widget') {
      if (parts[1] === 'theme' && req.method === 'GET')
        return await getWidgetTheme(admin, tenantId, req);
      if (parts[1] === 'sso' && parts[2] === 'verify' && req.method === 'POST')
        return await verifySsoToken(admin, tenantId, req);
      if (parts[1] === 'config' || !parts[1]) {
        if (req.method === 'GET') return await getWidgetConfig(admin, tenantId, req);
        if (req.method === 'PUT' || req.method === 'PATCH')
          return await upsertWidgetConfig(admin, tenantId, userId, req);
      }
    }

    // ── US-BLOG-084: compliance / DSAR ──────────────────────────────────────
    if (parts[0] === 'compliance') {
      if (parts[1] === 'dsar') {
        if (req.method === 'GET') return await listDsar(admin, tenantId, req);
        if (req.method === 'POST') return await createDsar(admin, tenantId, userId, req);
      }
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-platform-api handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
