// Blog Audience Variants Edge Function (US-BLOG-072)
//
// One master article, multiple ICP variants (engineer / manager / executive).
// Each variant overrides the intro, examples, and CTA but shares the core body.
// Variants are resolved server-side (URL param > cookie segment > referrer >
// default) and DO NOT get their own URL — the post keeps a single canonical URL
// so we never create duplicate content. Per-variant performance is counted on
// the variant row.
//
// Routes (tenant-scoped, gated to blog.post.edit):
//   POST   /blog-audience-variants                body: { post_id, audience_key, audience_label?,
//                                                        intro?, examples?, cta?, match_rules?, is_default? }
//   GET    /blog-audience-variants?post_id=
//   GET    /blog-audience-variants/:id
//   PATCH  /blog-audience-variants/:id
//   DELETE /blog-audience-variants/:id
//   POST   /blog-audience-variants/resolve        body: { post_id, url_param?, cookie_segment?,
//                                                        referrer? }  → matched variant + canonical_url
//   GET    /blog-audience-variants/:id/render     assembled { canonical_url, intro, body(core), examples, cta }
//   POST   /blog-audience-variants/:id/track      body: { event: 'served'|'conversion' }

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const variantSchema = z.object({
  post_id: z.string().uuid(),
  audience_key: z.string().min(1).max(64),
  audience_label: z.string().max(200).optional(),
  intro: z.string().max(20000).optional(),
  examples: z.union([z.array(z.unknown()), z.record(z.unknown())]).optional(),
  cta: z.record(z.unknown()).optional(),
  match_rules: z
    .object({
      url_param: z.string().max(64).optional(),
      cookie_segment: z.string().max(64).optional(),
      referrer_patterns: z.array(z.string().max(200)).max(20).optional(),
    })
    .optional(),
  is_default: z.boolean().optional(),
});

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
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
    const { parts } = normalizePath(url.pathname, 'blog-audience-variants');
    const id = parts[0];
    const sub = parts[1];

    if (id === 'resolve' && req.method === 'POST') {
      return await resolve(admin, tenantId, req);
    }
    if (!id) {
      if (req.method === 'GET') return await list(admin, tenantId, url, req);
      if (req.method === 'POST') return await create(admin, tenantId, user.id, req);
    }
    if (id && !sub) {
      if (req.method === 'GET') return await getOne(admin, tenantId, id, req);
      if (req.method === 'PATCH' || req.method === 'PUT') {
        return await update(admin, tenantId, user.id, id, req);
      }
      if (req.method === 'DELETE') return await remove(admin, tenantId, user.id, id, req);
    }
    if (id && sub === 'render' && req.method === 'GET') {
      return await render(admin, tenantId, id, req);
    }
    if (id && sub === 'track' && req.method === 'POST') {
      return await track(admin, tenantId, id, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-audience-variants handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── create ───────────────────────────────────────────────────────────────────
async function create(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = variantSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  const { data: post } = await admin
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', d.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // One variant per (post, audience_key).
  const { data: clash } = await admin
    .from('blog_post_variants')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('post_id', d.post_id)
    .eq('audience_key', d.audience_key)
    .is('deleted_at', null)
    .maybeSingle();
  if (clash) {
    return createCorsResponse(
      { error: `Variant for audience "${d.audience_key}" already exists on this post` },
      409,
      req,
    );
  }

  if (d.is_default) await clearDefault(admin, tenantId, d.post_id, null);

  const { data: created, error } = await admin
    .from('blog_post_variants')
    .insert({
      tenant_id: tenantId,
      post_id: d.post_id,
      audience_key: d.audience_key,
      audience_label: d.audience_label ?? null,
      intro: d.intro ?? null,
      examples: d.examples ?? null,
      cta: d.cta ?? null,
      match_rules: d.match_rules ?? null,
      is_default: d.is_default ?? false,
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
      action: 'blog_post_variant.create',
      targetType: 'blog_post_variant',
      targetId: created.id,
      afterState: { post_id: d.post_id, audience_key: d.audience_key },
      summary: `Created "${d.audience_key}" audience variant`,
    }),
  );
  return createCorsResponse({ variant: created }, 201, req);
}

async function clearDefault(admin: Admin, tenantId: string, postId: string, exceptId: string | null) {
  let q = admin
    .from('blog_post_variants')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .eq('is_default', true);
  if (exceptId) q = q.neq('id', exceptId);
  await q;
}

// ─── update / delete ────────────────────────────────────────────────────────────
async function update(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = variantSchema.partial().safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  const { data: existing } = await admin
    .from('blog_post_variants')
    .select('post_id')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return createCorsResponse({ error: 'Variant not found' }, 404, req);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ['audience_label', 'intro', 'examples', 'cta', 'match_rules', 'status', 'audience_key'] as const) {
    if (d[k] !== undefined) patch[k] = d[k];
  }
  if (d.is_default === true) {
    await clearDefault(admin, tenantId, existing.post_id, id);
    patch.is_default = true;
  } else if (d.is_default === false) {
    patch.is_default = false;
  }

  const { data: updated, error } = await admin
    .from('blog_post_variants')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Update failed' }, 500, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_post_variant.update',
      targetType: 'blog_post_variant',
      targetId: id,
      afterState: patch,
      summary: `Updated audience variant ${id}`,
    }),
  );
  return createCorsResponse({ variant: updated }, 200, req);
}

async function remove(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  const { data: updated, error } = await admin
    .from('blog_post_variants')
    .update({ deleted_at: new Date().toISOString(), status: 'paused' })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, audience_key')
    .single();
  if (error || !updated) return createCorsResponse({ error: 'Variant not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_post_variant.delete',
      targetType: 'blog_post_variant',
      targetId: id,
      summary: `Deleted "${updated.audience_key}" audience variant`,
    }),
  );
  return createCorsResponse({ ok: true }, 200, req);
}

// ─── resolve (server-side personalization) ────────────────────────────────────────
async function resolve(admin: Admin, tenantId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = z
    .object({
      post_id: z.string().uuid(),
      url_param: z.string().max(64).optional(),
      cookie_segment: z.string().max(64).optional(),
      referrer: z.string().max(500).optional(),
    })
    .safeParse(body);
  if (!parsed.success) return createCorsResponse({ error: 'post_id (uuid) required' }, 400, req);
  const { post_id, url_param, cookie_segment, referrer } = parsed.data;

  const { data: post } = await admin
    .from('blog_posts')
    .select('id, canonical_url, slug')
    .eq('tenant_id', tenantId)
    .eq('id', post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const { data: variants } = await admin
    .from('blog_post_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', post_id)
    .eq('status', 'active')
    .is('deleted_at', null);
  const list = variants ?? [];

  const matched = pickVariant(list, { url_param, cookie_segment, referrer });

  return createCorsResponse(
    {
      // Single canonical URL regardless of which variant we serve (no dup content).
      canonical_url: post.canonical_url ?? null,
      audience_key: matched?.audience_key ?? 'default',
      variant: matched,
      matched_by: matched ? matched._matched_by : 'none',
    },
    200,
    req,
  );
}

interface VariantRow {
  id: string;
  audience_key: string;
  is_default: boolean;
  match_rules: { url_param?: string; cookie_segment?: string; referrer_patterns?: string[] } | null;
  intro: string | null;
  examples: unknown;
  cta: unknown;
  _matched_by?: string;
}

/** Precedence: explicit URL param > cookie segment > referrer pattern > is_default. */
function pickVariant(
  variants: VariantRow[],
  ctx: { url_param?: string; cookie_segment?: string; referrer?: string },
): (VariantRow & { _matched_by: string }) | null {
  // 1. URL param — match by audience_key directly or by match_rules.url_param.
  if (ctx.url_param) {
    const byKey = variants.find(
      (v) => v.audience_key === ctx.url_param || v.match_rules?.url_param === ctx.url_param,
    );
    if (byKey) return { ...byKey, _matched_by: 'url_param' };
  }
  // 2. Cookie segment.
  if (ctx.cookie_segment) {
    const byCookie = variants.find(
      (v) => v.audience_key === ctx.cookie_segment || v.match_rules?.cookie_segment === ctx.cookie_segment,
    );
    if (byCookie) return { ...byCookie, _matched_by: 'cookie_segment' };
  }
  // 3. Referrer pattern.
  if (ctx.referrer) {
    const ref = ctx.referrer.toLowerCase();
    const byRef = variants.find((v) =>
      (v.match_rules?.referrer_patterns ?? []).some((p) => p && ref.includes(p.toLowerCase())),
    );
    if (byRef) return { ...byRef, _matched_by: 'referrer' };
  }
  // 4. Default.
  const def = variants.find((v) => v.is_default);
  if (def) return { ...def, _matched_by: 'default' };
  return null;
}

// ─── render (assemble master body + variant overrides) ────────────────────────────
async function render(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data: variant } = await admin
    .from('blog_post_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!variant) return createCorsResponse({ error: 'Variant not found' }, 404, req);

  const { data: post } = await admin
    .from('blog_posts')
    .select('id, title, body_markdown, body_html, canonical_url')
    .eq('tenant_id', tenantId)
    .eq('id', variant.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  return createCorsResponse(
    {
      canonical_url: post.canonical_url ?? null, // one canonical for every variant
      audience_key: variant.audience_key,
      title: post.title,
      // Variant overrides the intro + examples + CTA; the core body is shared.
      intro: variant.intro ?? null,
      body_markdown: post.body_markdown ?? null,
      examples: variant.examples ?? null,
      cta: variant.cta ?? null,
      robots: 'index,follow', // the canonical post is indexable; variants share its URL
    },
    200,
    req,
  );
}

// ─── track (per-variant performance) ──────────────────────────────────────────────
async function track(admin: Admin, tenantId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = z.object({ event: z.enum(['served', 'conversion']) }).safeParse(body);
  if (!parsed.success) return createCorsResponse({ error: 'event must be served|conversion' }, 400, req);

  const { data: variant } = await admin
    .from('blog_post_variants')
    .select('id, served_count, conversion_count')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!variant) return createCorsResponse({ error: 'Variant not found' }, 404, req);

  const patch =
    parsed.data.event === 'served'
      ? { served_count: (variant.served_count ?? 0) + 1 }
      : { conversion_count: (variant.conversion_count ?? 0) + 1 };

  const { data: updated, error } = await admin
    .from('blog_post_variants')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id, served_count, conversion_count')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Track failed' }, 500, req);
  }
  return createCorsResponse({ variant: updated }, 200, req);
}

// ─── list / get ────────────────────────────────────────────────────────────────
async function list(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  let q = admin
    .from('blog_post_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(url.searchParams.get('limit') ?? 200), 500));
  if (postId) q = q.eq('post_id', postId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ variants: data ?? [] }, 200, req);
}

async function getOne(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data } = await admin
    .from('blog_post_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return createCorsResponse({ error: 'Variant not found' }, 404, req);
  const cr = (data.served_count ?? 0) > 0 ? (data.conversion_count ?? 0) / data.served_count : null;
  return createCorsResponse({ variant: data, conversion_rate: cr }, 200, req);
}
