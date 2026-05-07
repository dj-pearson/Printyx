// Blog Audit Log Edge Function (US-BLOG-011)
//
// Read-only listing of blog_audit_log entries with filters. Writes happen via
// _shared/blog/audit-log.ts called from every mutating blog endpoint — there is
// no POST endpoint here. Append-only enforcement at the database level is in
// drizzle/rls/blog.sql.
//
// Routes (gated to platform admin):
//   GET /blog-audit-log
//     Query params:
//       actor_user_id  — filter by actor
//       actor_type     — user | agent | system
//       action         — exact match (e.g. blog_brand_voice.create)
//       action_prefix  — prefix match (e.g. blog_agent_settings)
//       target_type    — exact match (blog_post | blog_brand_voice | …)
//       target_id      — exact match
//       since          — ISO timestamp; only entries created after
//       until          — ISO timestamp; only entries created before
//       limit          — default 50, max 200
//       offset         — pagination
//
//   GET /blog-audit-log/actions  — distinct action codes (for filter dropdown)

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function isPlatformAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.audit_log.view')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'GET') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
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

    if (!isPlatformAdmin(user)) {
      return createCorsResponse(
        { error: 'Forbidden: blog audit log access requires platform/company admin' },
        403,
        req,
      );
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-audit-log');
    const sub = parts[0];

    if (sub === 'actions') {
      return await listDistinctActions(admin, tenantId, req);
    }

    if (!sub) {
      return await listEntries(admin, tenantId, url, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-audit-log handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listEntries(admin: Admin, tenantId: string, url: URL, req: Request) {
  const params = url.searchParams;

  const actorUserId = params.get('actor_user_id');
  const actorType = params.get('actor_type');
  const action = params.get('action');
  const actionPrefix = params.get('action_prefix');
  const targetType = params.get('target_type');
  const targetId = params.get('target_id');
  const since = params.get('since');
  const until = params.get('until');

  const requestedLimit = parseInt(params.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const requestedOffset = parseInt(params.get('offset') ?? '0', 10);
  const offset = Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0);

  let query = admin
    .from('blog_audit_log')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorUserId) query = query.eq('actor_user_id', actorUserId);
  if (actorType) query = query.eq('actor_type', actorType);
  if (action) query = query.eq('action', action);
  if (actionPrefix) query = query.like('action', `${actionPrefix}%`);
  if (targetType) query = query.eq('target_type', targetType);
  if (targetId) query = query.eq('target_id', targetId);
  if (since) query = query.gte('created_at', since);
  if (until) query = query.lte('created_at', until);

  const { data, error, count } = await query;

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }

  return createCorsResponse(
    {
      entries: data ?? [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        has_more: (count ?? 0) > offset + limit,
      },
    },
    200,
    req,
  );
}

async function listDistinctActions(admin: Admin, tenantId: string, req: Request) {
  // Pull a window of recent rows and uniq client-side. Postgres distinct on a
  // varchar column is cheap on small audit-log tables but costly on large
  // ones; cap at the most recent 5,000 entries which covers the typical
  // filter-dropdown use case.
  const { data, error } = await admin
    .from('blog_audit_log')
    .select('action')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }

  const seen = new Set<string>();
  const actions: string[] = [];
  for (const row of data ?? []) {
    if (row.action && !seen.has(row.action)) {
      seen.add(row.action);
      actions.push(row.action);
    }
  }
  actions.sort();

  return createCorsResponse({ actions }, 200, req);
}
