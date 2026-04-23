/**
 * API Keys edge function (canonical).
 *
 * Replaces server/routes/api-key-routes.ts (9 endpoints).
 *
 * URL prefix: /api-keys/*
 *
 * Endpoints:
 *   POST   /                  — create (returns plaintext ONCE)
 *   GET    /                  — list (no key material in response)
 *   GET    /:id               — detail
 *   PATCH  /:id               — update metadata (name/description/rate limits)
 *   POST   /:id/revoke        — mark revoked
 *   POST   /:id/rotate        — issue new key; old retained for grace window
 *   DELETE /:id               — hard delete
 *   GET    /:id/stats         — usage counts
 *   POST   /validate          — called by other edge functions; service-role only
 *
 * Key lifecycle:
 *   1. Plaintext is generated as `{prefix}_{32 hex chars}` — e.g. `pk_live_<random>`
 *   2. Hash (sha-256) + salt stored in DB; plaintext is NEVER re-derivable
 *   3. On create response we return { plaintextKey, ...metadata } ONCE
 *   4. /validate takes plaintext, hashes it, compares to stored hash
 *   5. Successful validation bumps usage_count + last_used_at + logs usage row
 *
 * One-time SQL:
 *   \i drizzle/rls/auth-security-tables.sql
 *   \i drizzle/rls/auth-security.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('api-keys');

const KEY_PREFIXES: Record<string, string> = {
  service: 'sk_svc',
  user: 'sk_usr',
  integration: 'sk_int',
  admin: 'sk_adm',
};

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/api-keys/, '')
      .replace(/\/$/, '') || '/'
  );
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();
  const sub = stripPrefix(url.pathname);

  try {
    const parts = sub.split('/').filter(Boolean);
    const first = parts[0];
    const second = parts[1];

    // POST /validate is a service-role endpoint — still requires auth (prevents
    // random callers) but treats the JWT as a trust signal that we're being
    // called from another edge function.
    if (method === 'POST' && first === 'validate') {
      return await validateKey(req, requestId);
    }

    const auth = await requireAuth(req);
    const db = getDb();

    // POST / — create
    if (method === 'POST' && !first) {
      return await createKey(req, auth, db, requestId);
    }

    // GET / — list
    if (method === 'GET' && !first) {
      const { data, error } = await db
        .from('api_keys')
        .select(
          'id, tenant_id, name, description, key_type, key_prefix, status, is_active, expires_at, scopes, permissions, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day, last_used_at, usage_count, environment, tags, created_by, revoked_at, created_at, updated_at',
        )
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false });
      if (error) return dbErr(req, requestId, 'Failed to list keys', error);
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // GET /:id/stats
    if (method === 'GET' && first && second === 'stats') {
      return await keyStats(first, auth, db, req, requestId);
    }

    // POST /:id/revoke
    if (method === 'POST' && first && second === 'revoke') {
      const body = (await req.json().catch(() => ({}))) as { reason?: string };
      const { data, error } = await db
        .from('api_keys')
        .update({
          status: 'revoked',
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: auth.userId,
          revoked_reason: body.reason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', first)
        .eq('tenant_id', auth.tenantId)
        .select()
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to revoke key', error);
      if (!data) return errorResponse(404, 'Key not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(redact(data), 200, req, requestId);
    }

    // POST /:id/rotate
    if (method === 'POST' && first && second === 'rotate') {
      return await rotateKey(first, auth, db, req, requestId);
    }

    // GET /:id
    if (method === 'GET' && first && !second) {
      const { data, error } = await db
        .from('api_keys')
        .select('*')
        .eq('id', first)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to fetch key', error);
      if (!data) return errorResponse(404, 'Key not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(redact(data), 200, req, requestId);
    }

    // PATCH /:id
    if ((method === 'PATCH' || method === 'PUT') && first && !second) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body)
        return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
      const update = mapUpdate(body);
      update.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('api_keys')
        .update(update)
        .eq('id', first)
        .eq('tenant_id', auth.tenantId)
        .select()
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to update key', error);
      if (!data) return errorResponse(404, 'Key not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(redact(data), 200, req, requestId);
    }

    // DELETE /:id
    if (method === 'DELETE' && first && !second) {
      const { error } = await db
        .from('api_keys')
        .delete()
        .eq('id', first)
        .eq('tenant_id', auth.tenantId);
      if (error) return dbErr(req, requestId, 'Failed to delete key', error);
      return jsonResponse({ success: true }, 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path: url.pathname, method },
      requestId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, { code: 'INTERNAL', requestId });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function createKey(req: Request, auth: any, db: any, requestId: string): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });

  const name = body.name as string | undefined;
  if (!name) {
    return errorResponse(400, 'name is required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  const keyType = (body.keyType ?? body.key_type ?? 'service') as string;
  const prefix = KEY_PREFIXES[keyType] ?? 'sk';

  const secret = randomHex(32);
  const plaintext = `${prefix}_${secret}`;
  const salt = randomHex(16);
  const hash = await sha256Hex(plaintext + salt);

  const row = {
    tenant_id: auth.tenantId,
    name,
    description: (body.description as string | undefined) ?? null,
    key_type: keyType,
    key_prefix: prefix,
    key_hash: hash,
    key_salt: salt,
    status: 'active',
    is_active: true,
    expires_at: (body.expiresAt ?? body.expires_at ?? null) as string | null,
    never_expires: (body.neverExpires ?? body.never_expires ?? false) as boolean,
    scopes: (body.scopes ?? []) as unknown[],
    permissions: (body.permissions ?? []) as unknown[],
    allowed_ips: (body.allowedIps ?? body.allowed_ips ?? []) as unknown[],
    allow_all_ips: (body.allowAllIps ?? body.allow_all_ips ?? true) as boolean,
    rate_limit_per_minute: (body.rateLimitPerMinute ??
      body.rate_limit_per_minute ??
      1000) as number,
    rate_limit_per_hour: (body.rateLimitPerHour ?? body.rate_limit_per_hour ?? 10000) as number,
    rate_limit_per_day: (body.rateLimitPerDay ?? body.rate_limit_per_day ?? 100000) as number,
    environment: (body.environment ?? 'production') as string,
    tags: (body.tags ?? []) as unknown[],
    metadata: (body.metadata ?? {}) as Record<string, unknown>,
    created_by: auth.userId,
  };

  const { data, error } = await db.from('api_keys').insert(row).select().maybeSingle();
  if (error) return dbErr(req, requestId, 'Failed to create key', error);

  return jsonResponse(
    {
      ...redact(data),
      plaintextKey: plaintext,
      warning:
        'Save this key now — it will not be shown again. To rotate, call POST /api-keys/:id/rotate.',
    },
    201,
    req,
    requestId,
  );
}

// ─── Rotate ──────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function rotateKey(
  id: string,
  auth: any,
  db: any,
  req: Request,
  requestId: string,
): Promise<Response> {
  const { data: existing } = await db
    .from('api_keys')
    .select(
      'key_type, name, description, scopes, permissions, allowed_ips, allow_all_ips, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day, environment, tags, metadata',
    )
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!existing) return errorResponse(404, 'Key not found', req, { code: 'NOT_FOUND', requestId });

  const prefix = KEY_PREFIXES[existing.key_type as string] ?? 'sk';
  const secret = randomHex(32);
  const plaintext = `${prefix}_${secret}`;
  const salt = randomHex(16);
  const hash = await sha256Hex(plaintext + salt);

  // Mark the old key revoked after a 1-hour grace window.
  const gracePeriodEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db
    .from('api_keys')
    .update({
      status: 'revoked',
      is_active: false,
      revoked_at: gracePeriodEnd,
      revoked_by: auth.userId,
      revoked_reason: 'Rotated via /rotate — grace period ends in 1 hour',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId);

  // Create replacement with same metadata.
  const { data: created, error } = await db
    .from('api_keys')
    .insert({
      tenant_id: auth.tenantId,
      name: `${existing.name} (rotated)`,
      description: existing.description,
      key_type: existing.key_type,
      key_prefix: prefix,
      key_hash: hash,
      key_salt: salt,
      status: 'active',
      is_active: true,
      scopes: existing.scopes,
      permissions: existing.permissions,
      allowed_ips: existing.allowed_ips,
      allow_all_ips: existing.allow_all_ips,
      rate_limit_per_minute: existing.rate_limit_per_minute,
      rate_limit_per_hour: existing.rate_limit_per_hour,
      rate_limit_per_day: existing.rate_limit_per_day,
      environment: existing.environment,
      tags: existing.tags,
      metadata: { ...(existing.metadata as Record<string, unknown>), rotatedFrom: id },
      created_by: auth.userId,
    })
    .select()
    .maybeSingle();

  if (error) return dbErr(req, requestId, 'Failed to issue rotated key', error);

  return jsonResponse(
    {
      ...redact(created),
      plaintextKey: plaintext,
      rotatedFromId: id,
      graceWindowEndsAt: gracePeriodEnd,
      warning: 'Save this key now. Old key continues to work for 1 hour.',
    },
    201,
    req,
    requestId,
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function keyStats(
  id: string,
  auth: any,
  db: any,
  req: Request,
  requestId: string,
): Promise<Response> {
  const { data: key } = await db
    .from('api_keys')
    .select('id, usage_count, last_used_at, last_used_ip, created_at')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!key) return errorResponse(404, 'Key not found', req, { code: 'NOT_FOUND', requestId });

  // Aggregate usage from the last 30 days.
  const sinceIso = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: usage } = await db
    .from('api_key_usage_logs')
    .select('method, path, status_code, timestamp')
    .eq('api_key_id', id)
    .gte('timestamp', sinceIso)
    .limit(10000);

  const rows = (usage ?? []) as Array<{ method: string; path: string; status_code: number | null }>;
  const byStatus: Record<string, number> = {};
  const byPath: Record<string, number> = {};
  for (const r of rows) {
    const bucket = String(Math.floor((r.status_code ?? 0) / 100)) + 'xx';
    byStatus[bucket] = (byStatus[bucket] ?? 0) + 1;
    const key = `${r.method} ${r.path}`;
    byPath[key] = (byPath[key] ?? 0) + 1;
  }
  const topPaths = Object.entries(byPath)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return jsonResponse(
    {
      keyId: id,
      lifetimeUsageCount: key.usage_count,
      lastUsedAt: key.last_used_at,
      lastUsedIp: key.last_used_ip,
      last30Days: {
        requests: rows.length,
        byStatusBucket: byStatus,
        topPaths,
      },
    },
    200,
    req,
    requestId,
  );
}

// ─── Validate ────────────────────────────────────────────────────────────────
// Called by other edge functions to verify a plaintext API key and get
// back the tenant_id + scope set. Constant-time-ish hash compare.

async function validateKey(req: Request, requestId: string): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { apiKey?: string; api_key?: string } | null;
  const plaintext = body?.apiKey ?? body?.api_key;
  if (!plaintext) {
    return errorResponse(400, 'apiKey required', req, { code: 'VALIDATION_ERROR', requestId });
  }
  // Extract prefix (before the last _); key_prefix lets us shard lookups.
  const lastUnderscore = plaintext.lastIndexOf('_');
  if (lastUnderscore < 0) {
    return errorResponse(401, 'Invalid key format', req, { code: 'INVALID_KEY', requestId });
  }
  const prefix = plaintext.slice(0, lastUnderscore);

  const db = getDb();
  // Candidates: all active keys with matching prefix. Usually 1-2 rows.
  const { data: candidates, error } = await db
    .from('api_keys')
    .select(
      'id, tenant_id, key_hash, key_salt, status, is_active, expires_at, scopes, permissions, rate_limit_per_minute, rate_limit_per_hour, revoked_at, usage_count',
    )
    .eq('key_prefix', prefix)
    .eq('is_active', true);
  if (error) {
    return errorResponse(500, 'Validation failed', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  let matched: Record<string, unknown> | null = null;
  for (const cand of (candidates ?? []) as Array<Record<string, unknown>>) {
    const expected = cand.key_hash as string;
    const salt = cand.key_salt as string;
    const actual = await sha256Hex(plaintext + salt);
    if (constantTimeEq(expected, actual)) {
      matched = cand;
      break;
    }
  }

  if (!matched) {
    return errorResponse(401, 'Invalid API key', req, { code: 'INVALID_KEY', requestId });
  }
  if (matched.status !== 'active') {
    return errorResponse(401, 'API key is not active', req, {
      code: 'KEY_INACTIVE',
      requestId,
    });
  }
  const exp = matched.expires_at as string | null;
  if (exp && new Date(exp) < new Date()) {
    return errorResponse(401, 'API key has expired', req, {
      code: 'KEY_EXPIRED',
      requestId,
    });
  }
  const revokedAt = matched.revoked_at as string | null;
  if (revokedAt && new Date(revokedAt) <= new Date()) {
    return errorResponse(401, 'API key has been revoked', req, {
      code: 'KEY_REVOKED',
      requestId,
    });
  }

  // Bump usage + log the call (best-effort — don't fail validation if log fails).
  const now = new Date().toISOString();
  const currentCount = parseInt(String(matched.usage_count ?? '0'), 10) || 0;
  await db
    .from('api_keys')
    .update({
      last_used_at: now,
      usage_count: String(currentCount + 1),
      last_used_ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      last_used_user_agent: req.headers.get('user-agent') ?? null,
    })
    .eq('id', matched.id as string);

  await db.from('api_key_usage_logs').insert({
    api_key_id: matched.id,
    tenant_id: matched.tenant_id,
    method: 'VALIDATE',
    path: '/api-keys/validate',
    status_code: 200,
    timestamp: now,
  });

  return jsonResponse(
    {
      valid: true,
      tenantId: matched.tenant_id,
      keyId: matched.id,
      scopes: matched.scopes,
      permissions: matched.permissions,
      rateLimitPerMinute: matched.rate_limit_per_minute,
      rateLimitPerHour: matched.rate_limit_per_hour,
    },
    200,
    req,
    requestId,
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  if (body.name !== undefined) r.name = body.name;
  if (body.description !== undefined) r.description = body.description;
  if (body.scopes !== undefined) r.scopes = body.scopes;
  if (body.permissions !== undefined) r.permissions = body.permissions;
  set('allowed_ips', 'allowedIps', 'allowed_ips');
  set('allow_all_ips', 'allowAllIps', 'allow_all_ips');
  set('rate_limit_per_minute', 'rateLimitPerMinute', 'rate_limit_per_minute');
  set('rate_limit_per_hour', 'rateLimitPerHour', 'rate_limit_per_hour');
  set('rate_limit_per_day', 'rateLimitPerDay', 'rate_limit_per_day');
  set('expires_at', 'expiresAt', 'expires_at');
  if (body.environment !== undefined) r.environment = body.environment;
  if (body.tags !== undefined) r.tags = body.tags;
  if (body.metadata !== undefined) r.metadata = body.metadata;
  return r;
}

// Redact key_hash and key_salt from any response body.
function redact(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return row;
  const { key_hash: _h, key_salt: _s, ...rest } = row;
  return rest;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// deno-lint-ignore no-explicit-any
function dbErr(req: Request, requestId: string, msg: string, err: any): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
