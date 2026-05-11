// Blog Post Revisions Edge Function (US-BLOG-009)
//
// Append-only revision history for blog_posts. Powers:
//   - Editor autosave (every 10s of inactivity, source='manual')
//   - AI rewrite snapshots (source='ai_rewrite')
//   - Auto-refresh agent runs (source='auto_refresh_agent')
//   - Side-by-side diff viewer + one-click restore
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   GET  /blog-post-revisions?post_id=:uuid&limit=&offset=    list (newest first)
//   GET  /blog-post-revisions/:id                              fetch one (full body)
//   POST /blog-post-revisions                                  create revision
//                                                              body: { post_id, revision_source, title?, body_markdown?, body_html?, meta_title?, meta_description?, diff_summary?, agent_run_id? }
//                                                              dedupes against the most recent revision when content+title+meta unchanged
//   POST /blog-post-revisions/:id/restore                      copy revision content back onto the post; creates a new revision tagged 'manual' with diff_summary 'Restored from #N'
//   POST /blog-post-revisions/cleanup                          purge revisions older than blog_agent_settings.revision_retention_days (default 90); preserves the most recent revision per post
//
// Audit log: every mutating action writes via writeAuditLog().
// Tenant scoping: blog_post_revisions.tenant_id is denormalized from the parent post; every query filters by tenantId.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const REVISION_SOURCES = ['manual', 'ai_draft', 'ai_rewrite', 'auto_refresh_agent'] as const;

const revisionCreateSchema = z.object({
  post_id: z.string().uuid(),
  revision_source: z.enum(REVISION_SOURCES),
  title: z.string().max(500).nullable().optional(),
  body_markdown: z.string().max(500_000).nullable().optional(),
  body_html: z.string().max(2_000_000).nullable().optional(),
  meta_title: z.string().max(200).nullable().optional(),
  meta_description: z.string().max(500).nullable().optional(),
  diff_summary: z.string().max(2000).nullable().optional(),
  agent_run_id: z.string().max(100).nullable().optional(),
});

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

interface RevisionRow {
  id: string;
  post_id: string;
  tenant_id: string;
  revision_number: number;
  title: string | null;
  body_markdown: string | null;
  body_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  revision_source: string;
  diff_summary: string | null;
  changed_by_user_id: string | null;
  agent_run_id: string | null;
  created_at: string;
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

    if (!hasBlogPostEdit(user)) {
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
    const { parts } = normalizePath(url.pathname, 'blog-post-revisions');
    const id = parts[0];
    const action = parts[1];

    if (!id) {
      if (req.method === 'GET') return await listRevisions(admin, tenantId, url, req);
      if (req.method === 'POST') return await createRevision(admin, tenantId, user.id, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // /:action endpoints (no resource ID): cleanup
    if (id === 'cleanup' && req.method === 'POST') {
      return await runRetentionCleanup(admin, tenantId, user.id, req);
    }

    if (action === 'restore' && req.method === 'POST') {
      return await restoreRevision(admin, tenantId, user.id, id, req);
    }

    if (req.method === 'GET') return await getRevision(admin, tenantId, id, req);

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('blog-post-revisions handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listRevisions(admin: Admin, tenantId: string, url: URL, req: Request) {
  const params = url.searchParams;
  const postId = params.get('post_id');
  if (!postId) {
    return createCorsResponse({ error: 'post_id is required' }, 400, req);
  }
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10) || 50, 200);
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0);

  // Confirm the post belongs to this tenant before exposing revisions
  const { data: post, error: postErr } = await admin
    .from('blog_posts')
    .select('id, tenant_id')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .maybeSingle();
  if (postErr) return createCorsResponse({ error: postErr.message }, 500, req);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const { data, error, count } = await admin
    .from('blog_post_revisions')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('revision_number', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return createCorsResponse({ error: error.message }, 500, req);

  return createCorsResponse(
    {
      revisions: data ?? [],
      pagination: { total: count ?? 0, limit, offset, has_more: (count ?? 0) > offset + limit },
    },
    200,
    req,
  );
}

async function getRevision(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_post_revisions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Revision not found' }, 404, req);
  return createCorsResponse({ revision: data }, 200, req);
}

async function createRevision(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = revisionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const input = parsed.data;

  // Validate the parent post belongs to this tenant
  const { data: post, error: postErr } = await admin
    .from('blog_posts')
    .select('id, tenant_id, title')
    .eq('tenant_id', tenantId)
    .eq('id', input.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (postErr) return createCorsResponse({ error: postErr.message }, 500, req);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Look up the most recent revision for two reasons:
  //  1. Compute revision_number = max(existing) + 1
  //  2. Dedupe: if content + title + meta are byte-identical to the latest
  //     revision, skip the insert and return that revision unchanged. This
  //     keeps autosave callers from spamming the table with no-op revisions.
  const { data: latest, error: latestErr } = await admin
    .from('blog_post_revisions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', input.post_id)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) return createCorsResponse({ error: latestErr.message }, 500, req);

  const nextRevisionNumber = ((latest as RevisionRow | null)?.revision_number ?? 0) + 1;

  const incomingTitle = input.title ?? null;
  const incomingMarkdown = input.body_markdown ?? null;
  const incomingHtml = input.body_html ?? null;
  const incomingMetaTitle = input.meta_title ?? null;
  const incomingMetaDesc = input.meta_description ?? null;

  if (
    latest &&
    latest.title === incomingTitle &&
    latest.body_markdown === incomingMarkdown &&
    latest.body_html === incomingHtml &&
    latest.meta_title === incomingMetaTitle &&
    latest.meta_description === incomingMetaDesc
  ) {
    return createCorsResponse({ revision: latest, deduped: true }, 200, req);
  }

  const { data: created, error } = await admin
    .from('blog_post_revisions')
    .insert({
      post_id: input.post_id,
      tenant_id: tenantId,
      revision_number: nextRevisionNumber,
      title: incomingTitle,
      body_markdown: incomingMarkdown,
      body_html: incomingHtml,
      meta_title: incomingMetaTitle,
      meta_description: incomingMetaDesc,
      revision_source: input.revision_source,
      diff_summary: input.diff_summary ?? null,
      changed_by_user_id: input.revision_source === 'auto_refresh_agent' ? null : userId,
      agent_run_id: input.agent_run_id ?? null,
    })
    .select('*')
    .single();

  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create revision' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: input.revision_source === 'auto_refresh_agent' ? null : userId,
      actorType: input.revision_source === 'auto_refresh_agent' ? 'agent' : 'user',
      agentKind: input.revision_source === 'auto_refresh_agent' ? 'auto_refresh_agent' : null,
      action: 'blog_post_revision.create',
      targetType: 'blog_post_revision',
      targetId: created.id,
      beforeState: null,
      afterState: created,
      summary: `Revision #${nextRevisionNumber} on "${post.title}" (${input.revision_source})`,
    }),
  );

  return createCorsResponse({ revision: created, deduped: false }, 201, req);
}

async function restoreRevision(
  admin: Admin,
  tenantId: string,
  userId: string,
  revisionId: string,
  req: Request,
) {
  const { data: revision, error: revErr } = await admin
    .from('blog_post_revisions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', revisionId)
    .maybeSingle();
  if (revErr) return createCorsResponse({ error: revErr.message }, 500, req);
  if (!revision) return createCorsResponse({ error: 'Revision not found' }, 404, req);

  const { data: post, error: postErr } = await admin
    .from('blog_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', revision.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (postErr) return createCorsResponse({ error: postErr.message }, 500, req);
  if (!post) return createCorsResponse({ error: 'Parent post not found' }, 404, req);

  // Snapshot the post first so the restore is reversible: any subsequent diff
  // can show "what was on the post when restore happened" → "what got pulled in".
  // Skip dedup on this snapshot path so the restore boundary is always visible
  // in history (autosave dedup would hide it if the post was already identical
  // to its previous revision).
  const { data: latestForCounter, error: counterErr } = await admin
    .from('blog_post_revisions')
    .select('revision_number')
    .eq('tenant_id', tenantId)
    .eq('post_id', revision.post_id)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (counterErr) return createCorsResponse({ error: counterErr.message }, 500, req);
  const preRestoreNumber =
    ((latestForCounter as { revision_number: number } | null)?.revision_number ?? 0) + 1;

  const { error: snapErr } = await admin.from('blog_post_revisions').insert({
    post_id: revision.post_id,
    tenant_id: tenantId,
    revision_number: preRestoreNumber,
    title: post.title,
    body_markdown: post.body_markdown,
    body_html: post.body_html,
    meta_title: post.meta_title,
    meta_description: post.meta_description,
    revision_source: 'manual',
    diff_summary: `Pre-restore snapshot before reverting to #${revision.revision_number}`,
    changed_by_user_id: userId,
    agent_run_id: null,
  });
  if (snapErr) return createCorsResponse({ error: snapErr.message }, 500, req);

  // Apply the chosen revision's content onto the post itself.
  const { data: updatedPost, error: updateErr } = await admin
    .from('blog_posts')
    .update({
      title: revision.title ?? post.title,
      body_markdown: revision.body_markdown,
      body_html: revision.body_html,
      meta_title: revision.meta_title,
      meta_description: revision.meta_description,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', revision.post_id)
    .select('*')
    .single();
  if (updateErr || !updatedPost) {
    return createCorsResponse(
      { error: updateErr?.message ?? 'Failed to apply revision' },
      500,
      req,
    );
  }

  // Stamp a NEW revision on top of the updated post so the audit trail shows
  // who restored what, when. revision_number = preRestoreNumber + 1.
  const restoreNumber = preRestoreNumber + 1;
  const { data: stampedRevision, error: stampErr } = await admin
    .from('blog_post_revisions')
    .insert({
      post_id: revision.post_id,
      tenant_id: tenantId,
      revision_number: restoreNumber,
      title: updatedPost.title,
      body_markdown: updatedPost.body_markdown,
      body_html: updatedPost.body_html,
      meta_title: updatedPost.meta_title,
      meta_description: updatedPost.meta_description,
      revision_source: 'manual',
      diff_summary: `Restored from revision #${revision.revision_number}`,
      changed_by_user_id: userId,
      agent_run_id: null,
    })
    .select('*')
    .single();
  if (stampErr || !stampedRevision) {
    return createCorsResponse(
      { error: stampErr?.message ?? 'Restored content but failed to stamp revision' },
      500,
      req,
    );
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_post.restore',
      targetType: 'blog_post',
      targetId: revision.post_id,
      beforeState: post,
      afterState: updatedPost,
      summary: `Restored "${updatedPost.title}" from revision #${revision.revision_number}`,
    }),
  );

  return createCorsResponse(
    {
      post: updatedPost,
      restored_from_revision_number: revision.revision_number,
      new_revision_number: restoreNumber,
      revision: stampedRevision,
    },
    200,
    req,
  );
}

// US-BLOG-009: enforce per-tenant revision retention. Reads
// blog_agent_settings.revision_retention_days (default 90), then deletes
// revisions older than that cutoff for this tenant. Cron-friendly: safe to
// invoke daily; deletes are atomic per-row by virtue of being a single
// statement. Always preserves the most recent revision per post so we never
// fully orphan a post's history.
async function runRetentionCleanup(admin: Admin, tenantId: string, userId: string, req: Request) {
  // Resolve retention setting; default to 90 if no row exists yet.
  const { data: settings } = await admin
    .from('blog_agent_settings')
    .select('revision_retention_days')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const retentionDays = (settings?.revision_retention_days as number | undefined) ?? 90;
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  // Fetch the most recent revision id per post so we never delete the last
  // one — even if it predates the retention window. There's no per-tenant
  // post count expected to be huge enough for this list to matter.
  const { data: latestRows, error: latestErr } = await admin
    .from('blog_post_revisions')
    .select('post_id, id, revision_number')
    .eq('tenant_id', tenantId)
    .order('revision_number', { ascending: false });
  if (latestErr) return createCorsResponse({ error: latestErr.message }, 500, req);

  const protectedIds = new Set<string>();
  const seenPosts = new Set<string>();
  for (const row of latestRows ?? []) {
    if (seenPosts.has(row.post_id)) continue;
    seenPosts.add(row.post_id);
    protectedIds.add(row.id);
  }

  const protectedArr = Array.from(protectedIds);
  let query = admin
    .from('blog_post_revisions')
    .delete({ count: 'exact' })
    .eq('tenant_id', tenantId)
    .lt('created_at', cutoffIso);
  if (protectedArr.length > 0) {
    // PostgREST `not.in` expects a parenthesised, comma-separated list.
    query = query.not('id', 'in', `(${protectedArr.join(',')})`);
  }
  const { error: deleteErr, count } = await query;
  if (deleteErr) return createCorsResponse({ error: deleteErr.message }, 500, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'system',
      agentKind: 'blog_revisions_retention',
      action: 'blog_post_revision.cleanup',
      targetType: 'blog_post_revisions',
      targetId: null,
      summary: `Retention cleanup: removed ${count ?? 0} revisions older than ${retentionDays} days`,
      afterState: { retention_days: retentionDays, cutoff: cutoffIso, deleted: count ?? 0 },
    }),
  );

  return createCorsResponse(
    {
      retention_days: retentionDays,
      cutoff: cutoffIso,
      deleted_count: count ?? 0,
      protected_count: protectedArr.length,
    },
    200,
    req,
  );
}
