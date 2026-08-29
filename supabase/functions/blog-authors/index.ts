// Blog Authors (E-E-A-T) Edge Function (US-BLOG-028)
//
// Credentialed authors maximize E-E-A-T: every post can carry a real author
// with a bio, credentials, expertise tags, social links, and schema.org Person
// data, plus an optional reviewer and an original_research_signal that acts as
// a forcing function (a 'none' signal surfaces shallow content during planning).
//
// Routes (tenant-scoped, gated to blog.post.edit):
//   GET    /blog-authors                 list authors (?include_inactive=)
//   GET    /blog-authors/:id             one author + their published posts + JSON-LD Person
//   GET    /blog-authors/page/:slug      author "page" payload (author + posts + structured data)
//   POST   /blog-authors                 create
//   PATCH  /blog-authors/:id             update
//   DELETE /blog-authors/:id             soft delete
//   POST   /blog-authors/post-signal     body: { post_id, original_research_signal,
//                                               author_id?, reviewed_by_author_id? }
//                                         sets E-E-A-T fields on a post; warns when signal='none'.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const RESEARCH_SIGNALS = [
  'survey',
  'internal_data',
  'expert_interview',
  'case_study',
  'none',
] as const;

const authorSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  bio: z.string().max(8000).optional(),
  headshot_asset_id: z.string().uuid().nullable().optional(),
  headshot_url: z.string().url().max(2000).nullable().optional(),
  credentials: z.string().max(2000).optional(),
  job_title: z.string().max(200).optional(),
  expertise_tags: z.array(z.string().max(100)).max(50).optional(),
  social_links: z.record(z.string()).optional(),
  schema_person: z.record(z.unknown()).optional(),
  user_id: z.string().max(200).nullable().optional(),
  is_active: z.boolean().optional(),
});

const signalSchema = z.object({
  post_id: z.string().uuid(),
  original_research_signal: z.enum(RESEARCH_SIGNALS),
  author_id: z.string().uuid().nullable().optional(),
  reviewed_by_author_id: z.string().uuid().nullable().optional(),
});

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
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
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-authors');

    if (parts[0] === 'post-signal' && req.method === 'POST') {
      return await setPostSignal(admin, tenantId, user.id, req);
    }
    if (parts[0] === 'page' && parts[1] && req.method === 'GET') {
      return await authorPage(admin, tenantId, parts[1], req);
    }
    if (!parts[0]) {
      if (req.method === 'GET') return await listAuthors(admin, tenantId, url, req);
      if (req.method === 'POST') return await createAuthor(admin, tenantId, user.id, req);
    }
    if (parts[0]) {
      if (req.method === 'GET') return await getAuthor(admin, tenantId, parts[0], req);
      if (req.method === 'PATCH' || req.method === 'PUT') {
        return await updateAuthor(admin, tenantId, user.id, parts[0], req);
      }
      if (req.method === 'DELETE')
        return await deleteAuthor(admin, tenantId, user.id, parts[0], req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-authors handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
async function listAuthors(admin: Admin, tenantId: string, url: URL, req: Request) {
  const includeInactive = url.searchParams.get('include_inactive') === 'true';
  let q = admin
    .from('blog_authors')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ authors: data ?? [] }, 200, req);
}

async function getAuthor(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data: author } = await admin
    .from('blog_authors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!author) return createCorsResponse({ error: 'Author not found' }, 404, req);
  const posts = await authorPosts(admin, tenantId, id);
  return createCorsResponse({ author, posts, person_schema: personSchema(author) }, 200, req);
}

async function createAuthor(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = authorSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;
  const slug =
    (d.slug && slugify(d.slug)) || slugify(d.name) || `author-${Date.now().toString(36)}`;

  // Slug uniqueness within tenant.
  const { data: clash } = await admin
    .from('blog_authors')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (clash) return createCorsResponse({ error: `Slug "${slug}" already in use` }, 409, req);

  const { data: created, error } = await admin
    .from('blog_authors')
    .insert({
      tenant_id: tenantId,
      name: d.name,
      slug,
      bio: d.bio ?? null,
      headshot_asset_id: d.headshot_asset_id ?? null,
      headshot_url: d.headshot_url ?? null,
      credentials: d.credentials ?? null,
      job_title: d.job_title ?? null,
      expertise_tags: d.expertise_tags ?? null,
      social_links: d.social_links ?? null,
      schema_person: d.schema_person ?? null,
      user_id: d.user_id ?? null,
      is_active: d.is_active ?? true,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Create failed' }, 500, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_author.create',
      targetType: 'blog_author',
      targetId: created.id,
      afterState: { name: created.name, slug: created.slug },
      summary: `Created author "${created.name}"`,
    }),
  );
  return createCorsResponse({ author: created }, 201, req);
}

async function updateAuthor(
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
  const parsed = authorSchema.partial().safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    'name',
    'bio',
    'headshot_asset_id',
    'headshot_url',
    'credentials',
    'job_title',
    'expertise_tags',
    'social_links',
    'schema_person',
    'user_id',
    'is_active',
  ] as const) {
    if (d[key] !== undefined) patch[key] = d[key];
  }
  if (d.slug !== undefined) {
    const slug = slugify(d.slug);
    const { data: clash } = await admin
      .from('blog_authors')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .neq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (clash) return createCorsResponse({ error: `Slug "${slug}" already in use` }, 409, req);
    patch.slug = slug;
  }

  const { data: updated, error } = await admin
    .from('blog_authors')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Author not found' }, 404, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_author.update',
      targetType: 'blog_author',
      targetId: id,
      afterState: patch,
      summary: `Updated author "${updated.name}"`,
    }),
  );
  return createCorsResponse({ author: updated }, 200, req);
}

async function deleteAuthor(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: updated, error } = await admin
    .from('blog_authors')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, name')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Author not found' }, 404, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_author.delete',
      targetType: 'blog_author',
      targetId: id,
      summary: `Soft-deleted author "${updated.name}"`,
    }),
  );
  return createCorsResponse({ ok: true }, 200, req);
}

// ─── author page ────────────────────────────────────────────────────────────────
async function authorPage(admin: Admin, tenantId: string, slug: string, req: Request) {
  const { data: author } = await admin
    .from('blog_authors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (!author) return createCorsResponse({ error: 'Author not found' }, 404, req);
  const posts = await authorPosts(admin, tenantId, author.id);
  return createCorsResponse(
    {
      author,
      posts,
      person_schema: personSchema(author),
      breadcrumb: { name: author.name, url: `/authors/${author.slug}` },
    },
    200,
    req,
  );
}

async function authorPosts(admin: Admin, tenantId: string, authorId: string) {
  const { data } = await admin
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, published_at, cms_post_url, status, original_research_signal',
    )
    .eq('tenant_id', tenantId)
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(200);
  return data ?? [];
}

/** Build a schema.org Person object from the author row (US-BLOG-027 compatible). */
function personSchema(author: Record<string, unknown>) {
  const social = (author.social_links as Record<string, string> | null) ?? {};
  const sameAs = Object.values(social).filter(Boolean);
  const extra = (author.schema_person as Record<string, unknown> | null) ?? {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    description: author.bio ?? undefined,
    jobTitle: author.job_title ?? undefined,
    image: author.headshot_url ?? undefined,
    knowsAbout: (author.expertise_tags as string[] | null) ?? undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    ...extra,
  };
}

// ─── per-post E-E-A-T signal ──────────────────────────────────────────────────────
async function setPostSignal(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = signalSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  // Validate referenced authors belong to the tenant.
  for (const aid of [d.author_id, d.reviewed_by_author_id]) {
    if (aid) {
      const { data: a } = await admin
        .from('blog_authors')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('id', aid)
        .is('deleted_at', null)
        .maybeSingle();
      if (!a) return createCorsResponse({ error: `Author ${aid} not found` }, 404, req);
    }
  }

  const patch: Record<string, unknown> = {
    original_research_signal: d.original_research_signal,
    updated_at: new Date().toISOString(),
  };
  if (d.author_id !== undefined) patch.author_id = d.author_id;
  if (d.reviewed_by_author_id !== undefined) patch.reviewed_by_author_id = d.reviewed_by_author_id;

  const { data: updated, error } = await admin
    .from('blog_posts')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', d.post_id)
    .is('deleted_at', null)
    .select('id, title, author_id, reviewed_by_author_id, original_research_signal')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Post not found' }, 404, req);
  }

  const warning =
    d.original_research_signal === 'none'
      ? 'No original-research signal — this post may read as shallow. Consider adding a survey, internal data, an expert interview, or a case study.'
      : null;

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_post.eeat_signal',
      targetType: 'blog_post',
      targetId: d.post_id,
      afterState: patch,
      summary: `Set E-E-A-T signal "${d.original_research_signal}" on "${updated.title}"`,
    }),
  );

  return createCorsResponse({ post: updated, warning }, 200, req);
}
