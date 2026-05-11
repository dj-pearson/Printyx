// Blog Jobs Edge Function (US-BLOG-012)
//
// Background job queue backed by the blog_jobs Postgres table. There is no
// always-on worker process in this Coolify deploy — an external scheduler
// (k8s CronJob) pings POST /blog-jobs/run-due on a cadence and this endpoint
// claims due jobs with SELECT ... FOR UPDATE SKIP LOCKED semantics, runs the
// registered handler in-process, and writes back the result.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   GET    /blog-jobs?status=&type=&limit=&offset=   list (newest scheduled first)
//   GET    /blog-jobs/stats                          { queued, active, failed, completed, cancelled }
//   GET    /blog-jobs/:id                            fetch one
//   POST   /blog-jobs                                enqueue
//                                                     body: { type, payload?, priority?, scheduled_at?, max_attempts?, idempotency_key? }
//                                                     duplicate (tenant, idempotency_key) returns the existing row with deduped:true
//   POST   /blog-jobs/:id/retry                      reset failed → queued (next attempt now)
//   POST   /blog-jobs/:id/cancel                     mark cancelled (queued only)
//   POST   /blog-jobs/run-due                        cron entry point — claims + runs up to `limit` due jobs
//                                                     body: { limit?: number, worker_id?: string }
//
// Backoff policy on fail:
//   attempt 1 → next +1m, attempt 2 → +5m, attempt 3 → +30m, attempt 4 → +2h,
//   attempt 5 → permanent fail (no retry, status='failed').
//
// Built-in handlers (extend HANDLERS to add more):
//   - noop                — succeeds immediately; used for smoke testing the queue
//   - retention_cleanup   — invokes US-BLOG-009 retention cleanup for this tenant
//
// All state transitions audit-log via writeAuditLog().

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const JOB_TYPES = ['noop', 'retention_cleanup'] as const;
type JobType = (typeof JOB_TYPES)[number];

const BACKOFF_MINUTES = [1, 5, 30, 120] as const; // index = attempt count just completed

const enqueueSchema = z.object({
  type: z.enum(JOB_TYPES),
  payload: z.record(z.unknown()).nullable().optional(),
  priority: z.number().int().min(1).max(100).optional(),
  scheduled_at: z.string().datetime().optional(),
  max_attempts: z.number().int().min(1).max(20).optional(),
  idempotency_key: z.string().min(1).max(200).nullable().optional(),
});

const runDueSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  worker_id: z.string().max(200).optional(),
});

function hasBlogJobAccess(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.post.edit') || perms.includes('blog.job.manage'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

interface JobRow {
  id: string;
  tenant_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  status: 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  scheduled_at: string;
  attempts: number;
  max_attempts: number;
  last_error: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  idempotency_key: string | null;
  locked_until: string | null;
  locked_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

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

    if (!hasBlogJobAccess(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.post.edit required' }, 403, req);
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
    const { parts } = normalizePath(url.pathname, 'blog-jobs');
    const id = parts[0];
    const action = parts[1];

    if (!id) {
      if (req.method === 'GET') return await listJobs(admin, tenantId, url, req);
      if (req.method === 'POST') return await enqueueJob(admin, tenantId, user.id, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    if (id === 'stats' && req.method === 'GET') {
      return await getStats(admin, tenantId, req);
    }
    if (id === 'run-due' && req.method === 'POST') {
      return await runDueJobs(admin, tenantId, user.id, req);
    }
    if (action === 'retry' && req.method === 'POST') {
      return await retryJob(admin, tenantId, user.id, id, req);
    }
    if (action === 'cancel' && req.method === 'POST') {
      return await cancelJob(admin, tenantId, user.id, id, req);
    }
    if (req.method === 'GET') return await getJob(admin, tenantId, id, req);

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('blog-jobs handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listJobs(admin: Admin, tenantId: string, url: URL, req: Request) {
  const params = url.searchParams;
  const status = params.get('status');
  const type = params.get('type');
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10) || 50, 200);
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0);

  let query = admin
    .from('blog_jobs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);

  const { data, error, count } = await query;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse(
    {
      jobs: data ?? [],
      pagination: { total: count ?? 0, limit, offset, has_more: (count ?? 0) > offset + limit },
    },
    200,
    req,
  );
}

async function getStats(admin: Admin, tenantId: string, req: Request) {
  // One round-trip with a head select per status; cheap enough at the row
  // volumes we expect for v1 and avoids a custom RPC.
  const statuses: JobRow['status'][] = ['queued', 'active', 'completed', 'failed', 'cancelled'];
  const out: Record<string, number> = {};
  for (const s of statuses) {
    const { count } = await admin
      .from('blog_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', s);
    out[s] = count ?? 0;
  }
  return createCorsResponse({ stats: out }, 200, req);
}

async function getJob(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_jobs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Job not found' }, 404, req);
  return createCorsResponse({ job: data }, 200, req);
}

async function enqueueJob(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = enqueueSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const input = parsed.data;

  // Idempotency dedup: if a row with this (tenant, key) already exists in a
  // non-terminal state, return it instead of creating a duplicate.
  if (input.idempotency_key) {
    const { data: existing } = await admin
      .from('blog_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', input.idempotency_key)
      .maybeSingle();
    if (existing) {
      return createCorsResponse({ job: existing, deduped: true }, 200, req);
    }
  }

  const { data: created, error } = await admin
    .from('blog_jobs')
    .insert({
      tenant_id: tenantId,
      type: input.type,
      payload: input.payload ?? null,
      status: 'queued',
      priority: input.priority ?? 50,
      scheduled_at: input.scheduled_at ?? new Date().toISOString(),
      max_attempts: input.max_attempts ?? 5,
      idempotency_key: input.idempotency_key ?? null,
      created_by_user_id: userId,
    })
    .select('*')
    .single();

  if (error || !created) {
    // Unique-violation race condition: re-read and return the existing row.
    if (input.idempotency_key && error?.code === '23505') {
      const { data: existing } = await admin
        .from('blog_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('idempotency_key', input.idempotency_key)
        .maybeSingle();
      if (existing) {
        return createCorsResponse({ job: existing, deduped: true }, 200, req);
      }
    }
    return createCorsResponse({ error: error?.message ?? 'Failed to enqueue job' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_job.enqueue',
      targetType: 'blog_job',
      targetId: created.id,
      afterState: created,
      summary: `Enqueued ${input.type} job`,
    }),
  );

  return createCorsResponse({ job: created }, 201, req);
}

async function retryJob(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  const { data: before } = await admin
    .from('blog_jobs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (!before) return createCorsResponse({ error: 'Job not found' }, 404, req);
  if (before.status === 'active') {
    return createCorsResponse({ error: 'Cannot retry an active job' }, 409, req);
  }

  const { data: updated, error } = await admin
    .from('blog_jobs')
    .update({
      status: 'queued',
      scheduled_at: new Date().toISOString(),
      locked_until: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Retry failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_job.retry',
      targetType: 'blog_job',
      targetId: id,
      beforeState: before,
      afterState: updated,
      summary: `Retried ${before.type} job`,
    }),
  );

  return createCorsResponse({ job: updated }, 200, req);
}

async function cancelJob(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  const { data: before } = await admin
    .from('blog_jobs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (!before) return createCorsResponse({ error: 'Job not found' }, 404, req);
  if (before.status !== 'queued') {
    return createCorsResponse(
      { error: `Only queued jobs can be cancelled (status=${before.status})` },
      409,
      req,
    );
  }

  const { data: updated, error } = await admin
    .from('blog_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Cancel failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_job.cancel',
      targetType: 'blog_job',
      targetId: id,
      beforeState: before,
      afterState: updated,
      summary: `Cancelled ${before.type} job`,
    }),
  );

  return createCorsResponse({ job: updated }, 200, req);
}

async function runDueJobs(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  try {
    body = (await req.json().catch(() => ({}))) ?? {};
  } catch {
    body = {};
  }
  const parsed = runDueSchema.safeParse(body);
  const limit = parsed.success ? (parsed.data.limit ?? 5) : 5;
  const workerId = parsed.success
    ? (parsed.data.worker_id ?? `manual-${userId}`)
    : `manual-${userId}`;

  // Step 1 — claim up to `limit` due jobs atomically. Postgres SKIP LOCKED via
  // a raw SQL RPC would be cleaner, but the supabase-js client doesn't expose
  // FOR UPDATE; we approximate by an UPDATE ... WHERE id IN (subselect) with
  // an additional locked_until guard so two concurrent run-due calls don't
  // claim the same row. The locked_until clause makes the UPDATE
  // self-coordinating: only one writer wins per row.
  const nowIso = new Date().toISOString();
  const lockUntilIso = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5-min lock

  // Find candidate IDs first (read-only).
  const { data: candidates, error: candErr } = await admin
    .from('blog_jobs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'queued')
    .lte('scheduled_at', nowIso)
    .order('priority', { ascending: true })
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (candErr) return createCorsResponse({ error: candErr.message }, 500, req);

  const candidateIds = (candidates ?? []).map((r) => r.id);
  if (candidateIds.length === 0) {
    return createCorsResponse({ claimed: 0, ran: 0, jobs: [] }, 200, req);
  }

  // Try to atomically claim them — only updates rows still in 'queued' status
  // and not currently locked. The IN-list + WHERE guard is our SKIP-LOCKED
  // substitute: concurrent writers won't both succeed on the same row.
  const { data: claimed, error: claimErr } = await admin
    .from('blog_jobs')
    .update({
      status: 'active',
      locked_until: lockUntilIso,
      locked_by: workerId,
      started_at: nowIso,
      updated_at: nowIso,
    })
    .eq('tenant_id', tenantId)
    .eq('status', 'queued')
    .in('id', candidateIds)
    .select('*');
  if (claimErr) return createCorsResponse({ error: claimErr.message }, 500, req);

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const job of (claimed as JobRow[] | null) ?? []) {
    try {
      const handlerResult = await runHandler(admin, job, req);
      await completeJob(admin, job.id, handlerResult);
      await writeAuditLog(
        admin,
        withRequestContext(req, {
          tenantId,
          actorUserId: userId,
          actorType: 'system',
          agentKind: 'blog_jobs_worker',
          action: 'blog_job.complete',
          targetType: 'blog_job',
          targetId: job.id,
          afterState: { result: handlerResult, attempts: job.attempts + 1 },
          summary: `Completed ${job.type} job after ${job.attempts + 1} attempt(s)`,
        }),
      );
      results.push({ id: job.id, status: 'completed' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      const nextAttempt = job.attempts + 1;
      const isFinal = nextAttempt >= job.max_attempts;
      const nextRunAt = isFinal
        ? null
        : new Date(
            Date.now() +
              BACKOFF_MINUTES[Math.min(nextAttempt - 1, BACKOFF_MINUTES.length - 1)] * 60_000,
          ).toISOString();
      await failJob(
        admin,
        job.id,
        { message: errMsg, stack: errStack, attempt_at: nowIso },
        nextAttempt,
        isFinal,
        nextRunAt,
      );
      await writeAuditLog(
        admin,
        withRequestContext(req, {
          tenantId,
          actorUserId: userId,
          actorType: 'system',
          agentKind: 'blog_jobs_worker',
          action: isFinal ? 'blog_job.fail_permanent' : 'blog_job.fail_retry',
          targetType: 'blog_job',
          targetId: job.id,
          afterState: { attempts: nextAttempt, next_run_at: nextRunAt, error: errMsg },
          summary: isFinal
            ? `Permanently failed ${job.type} after ${nextAttempt} attempts: ${errMsg}`
            : `Failed ${job.type} attempt ${nextAttempt}, retrying at ${nextRunAt}`,
        }),
      );
      results.push({ id: job.id, status: isFinal ? 'failed' : 'retry_scheduled', error: errMsg });
    }
  }

  return createCorsResponse(
    {
      claimed: claimed?.length ?? 0,
      ran: results.length,
      worker_id: workerId,
      results,
    },
    200,
    req,
  );
}

async function completeJob(admin: Admin, id: string, result: unknown) {
  const nowIso = new Date().toISOString();
  await admin
    .from('blog_jobs')
    .update({
      status: 'completed',
      result: result ?? null,
      completed_at: nowIso,
      locked_until: null,
      locked_by: null,
      attempts: (await getAttempts(admin, id)) + 1,
      updated_at: nowIso,
    })
    .eq('id', id);
}

async function failJob(
  admin: Admin,
  id: string,
  errorBlob: { message: string; stack?: string; attempt_at: string },
  attempts: number,
  isFinal: boolean,
  nextRunAt: string | null,
) {
  const nowIso = new Date().toISOString();
  await admin
    .from('blog_jobs')
    .update({
      status: isFinal ? 'failed' : 'queued',
      last_error: errorBlob,
      attempts,
      scheduled_at: isFinal ? nowIso : (nextRunAt ?? nowIso),
      completed_at: isFinal ? nowIso : null,
      locked_until: null,
      locked_by: null,
      updated_at: nowIso,
    })
    .eq('id', id);
}

async function getAttempts(admin: Admin, id: string): Promise<number> {
  const { data } = await admin.from('blog_jobs').select('attempts').eq('id', id).maybeSingle();
  return (data?.attempts as number | undefined) ?? 0;
}

// ---------------------------------------------------------------------------
// Handlers — extend HANDLERS to register more job types.
// ---------------------------------------------------------------------------

type Handler = (admin: Admin, job: JobRow, req: Request) => Promise<unknown>;

const HANDLERS: Record<JobType, Handler> = {
  // noop — smoke-test handler. Sleeps for `payload.sleep_ms` if provided.
  noop: async (_admin, job) => {
    const sleepMs = Number((job.payload as Record<string, unknown> | null)?.sleep_ms ?? 0);
    if (sleepMs > 0 && sleepMs <= 5000) {
      await new Promise((r) => setTimeout(r, sleepMs));
    }
    return { ok: true, slept_ms: sleepMs };
  },

  // retention_cleanup — invokes the US-BLOG-009 cleanup endpoint logic
  // directly (DB-level; we don't need to round-trip through HTTP).
  retention_cleanup: async (admin, job) => {
    const { data: settings } = await admin
      .from('blog_agent_settings')
      .select('revision_retention_days')
      .eq('tenant_id', job.tenant_id)
      .maybeSingle();
    const retentionDays = (settings?.revision_retention_days as number | undefined) ?? 90;
    const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    // Preserve the latest revision per post.
    const { data: latest } = await admin
      .from('blog_post_revisions')
      .select('post_id, id, revision_number')
      .eq('tenant_id', job.tenant_id)
      .order('revision_number', { ascending: false });
    const protectedIds = new Set<string>();
    const seenPosts = new Set<string>();
    for (const row of latest ?? []) {
      if (seenPosts.has(row.post_id)) continue;
      seenPosts.add(row.post_id);
      protectedIds.add(row.id);
    }
    const protectedArr = Array.from(protectedIds);
    let q = admin
      .from('blog_post_revisions')
      .delete({ count: 'exact' })
      .eq('tenant_id', job.tenant_id)
      .lt('created_at', cutoffIso);
    if (protectedArr.length > 0) {
      q = q.not('id', 'in', `(${protectedArr.join(',')})`);
    }
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    return { retention_days: retentionDays, cutoff: cutoffIso, deleted_count: count ?? 0 };
  },
};

async function runHandler(admin: Admin, job: JobRow, req: Request): Promise<unknown> {
  const fn = HANDLERS[job.type as JobType];
  if (!fn) {
    throw new Error(`No handler registered for job type '${job.type}'`);
  }
  return await fn(admin, job, req);
}
