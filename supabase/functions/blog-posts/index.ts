// Blog Posts Edge Function (US-BLOG-008 foundation)
//
// CRUD over blog_posts. Foundation slice for US-BLOG-008 — covers list/get/
// create/update/soft-delete + status transitions. Defers:
//   - Autosave to blog_post_revisions every 10s (AC #6)
//   - Pre-publish QA pass (US-BLOG-040)
//   - CMS publish dispatch (US-BLOG-042)
//   - SEO scoring on save (US-BLOG-033)
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   GET    /blog-posts              list posts (?status, ?limit, ?offset)
//   POST   /blog-posts              create new post (status defaults to draft)
//   GET    /blog-posts/:id          fetch one
//   PATCH  /blog-posts/:id          update (any field; status transitions allowed)
//   DELETE /blog-posts/:id          soft delete
//
// Audit log: every mutating action writes via writeAuditLog().

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const STATUSES = ['draft', 'in_review', 'scheduled', 'published', 'archived'] as const;

const postCreateSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  excerpt: z.string().max(2000).nullable().optional(),
  body_markdown: z.string().max(500_000).nullable().optional(),
  body_html: z.string().max(2_000_000).nullable().optional(),
  meta_title: z.string().max(200).nullable().optional(),
  meta_description: z.string().max(500).nullable().optional(),
  canonical_url: z.string().url().max(2000).nullable().optional(),
  brief_id: z.string().uuid().nullable().optional(),
  brand_voice_id: z.string().uuid().nullable().optional(),
  style_guide_id: z.string().uuid().nullable().optional(),
  featured_image_asset_id: z.string().uuid().nullable().optional(),
  author_user_id: z.string().nullable().optional(),
  status: z.enum(STATUSES).optional(),
  scheduled_for: z.string().datetime().nullable().optional(),
});

const postPatchSchema = postCreateSchema.partial();

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
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
    const { parts } = normalizePath(url.pathname, 'blog-posts');
    const id = parts[0];

    if (!id) {
      if (req.method === 'GET') return await listPosts(admin, tenantId, url, req);
      if (req.method === 'POST') return await createPost(admin, tenantId, user.id, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    if (req.method === 'GET') return await getPost(admin, tenantId, id, req);
    if (req.method === 'PATCH') return await updatePost(admin, tenantId, user.id, id, req);
    if (req.method === 'DELETE') return await deletePost(admin, tenantId, user.id, id, req);

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('blog-posts handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listPosts(admin: Admin, tenantId: string, url: URL, req: Request) {
  const params = url.searchParams;
  const status = params.get('status');
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10) || 50, 200);
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0);

  let query = admin
    .from('blog_posts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }

  return createCorsResponse(
    {
      posts: data ?? [],
      pagination: { total: count ?? 0, limit, offset, has_more: (count ?? 0) > offset + limit },
    },
    200,
    req,
  );
}

async function getPost(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Post not found' }, 404, req);
  return createCorsResponse({ post: data }, 200, req);
}

async function createPost(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = postCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const slug = parsed.data.slug ?? slugify(parsed.data.title);
  if (!slug) {
    return createCorsResponse({ error: 'Title or slug must produce a URL-safe slug' }, 400, req);
  }

  const { data: created, error } = await admin
    .from('blog_posts')
    .insert({
      tenant_id: tenantId,
      title: parsed.data.title,
      slug,
      excerpt: parsed.data.excerpt ?? null,
      body_markdown: parsed.data.body_markdown ?? null,
      body_html: parsed.data.body_html ?? null,
      meta_title: parsed.data.meta_title ?? null,
      meta_description: parsed.data.meta_description ?? null,
      canonical_url: parsed.data.canonical_url ?? null,
      brief_id: parsed.data.brief_id ?? null,
      brand_voice_id: parsed.data.brand_voice_id ?? null,
      style_guide_id: parsed.data.style_guide_id ?? null,
      featured_image_asset_id: parsed.data.featured_image_asset_id ?? null,
      author_user_id: parsed.data.author_user_id ?? userId,
      status: parsed.data.status ?? 'draft',
      scheduled_for: parsed.data.scheduled_for ?? null,
      created_by_user_id: userId,
    })
    .select('*')
    .single();

  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create post' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_post.create',
      targetType: 'blog_post',
      targetId: created.id,
      beforeState: null,
      afterState: created,
      summary: `Created post "${created.title}" (status: ${created.status})`,
    }),
  );

  return createCorsResponse({ post: created }, 201, req);
}

async function updatePost(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = postPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: existing, error: readError } = await admin
    .from('blog_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (readError) return createCorsResponse({ error: readError.message }, 500, req);
  if (!existing) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const updates: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  // If status is transitioning to "published" and published_at isn't set, stamp it
  if (parsed.data.status === 'published' && !existing.published_at) {
    updates.published_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await admin
    .from('blog_posts')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return createCorsResponse({ error: updateError?.message ?? 'Failed to update post' }, 500, req);
  }

  const statusChanged = parsed.data.status && parsed.data.status !== existing.status;
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: statusChanged ? `blog_post.status_change` : 'blog_post.update',
      targetType: 'blog_post',
      targetId: updated.id,
      beforeState: existing,
      afterState: updated,
      summary: statusChanged
        ? `Post "${updated.title}": ${existing.status} → ${updated.status}`
        : `Updated post "${updated.title}"`,
    }),
  );

  return createCorsResponse({ post: updated }, 200, req);
}

async function deletePost(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: existing, error: readError } = await admin
    .from('blog_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (readError) return createCorsResponse({ error: readError.message }, 500, req);
  if (!existing) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const nowIso = new Date().toISOString();
  const { data: deleted, error } = await admin
    .from('blog_posts')
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !deleted) {
    return createCorsResponse({ error: error?.message ?? 'Failed to delete post' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_post.delete',
      targetType: 'blog_post',
      targetId: id,
      beforeState: existing,
      afterState: deleted,
      summary: `Deleted post "${existing.title}"`,
    }),
  );

  return createCorsResponse({ post: deleted }, 200, req);
}
