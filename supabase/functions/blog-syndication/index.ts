// Blog Per-Platform Syndication Generator Edge Function (US-BLOG-043..051)
//
// Turns a published/draft blog post into platform-native variants (email
// newsletter, X thread, LinkedIn, Facebook, Instagram carousel + Reel, TikTok /
// Shorts, Pinterest pins, Reddit, Hacker News, Medium, Substack, Slack/Discord).
// Each variant is stored as a draft blog_distributions row for review before any
// publish. Generation only — actual posting is the adapter/scheduler's job.
//
// Routes (gated to platform admin OR users holding blog.distribution.publish):
//   GET    /blog-syndication/platforms                 list available platform keys
//   POST   /blog-syndication/generate    body: { post_id, platforms[] }
//   GET    /blog-syndication?post_id=                  list generated variants
//   PATCH  /blog-syndication/:id          body: { content?, content_json?, status? }
//   DELETE /blog-syndication/:id
//
// Self-contained: one LLM call per requested platform; no platform credentials
// are needed to GENERATE (only to publish later).

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonArray, extractJsonObject } from '../_shared/blog/llm-json.ts';
import {
  SYNDICATION_PLATFORMS,
  getSyndicationSpec,
  type SyndicationSpec,
} from '../_shared/blog/syndication.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const generateSchema = z.object({
  post_id: z.string().uuid(),
  platforms: z.array(z.string()).min(1).max(SYNDICATION_PLATFORMS.length),
});
const patchSchema = z.object({
  content: z.string().max(50_000).optional(),
  content_json: z.unknown().optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
});

function hasDistributionPublish(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.distribution.publish') || perms.includes('blog.post.edit'))
  )
    return true;
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
    if (!hasDistributionPublish(user)) {
      return createCorsResponse(
        { error: 'Forbidden: blog.distribution.publish required' },
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
    const { parts } = normalizePath(url.pathname, 'blog-syndication');
    const action = parts[0];

    if (action === 'platforms' && req.method === 'GET') {
      return createCorsResponse(
        {
          platforms: SYNDICATION_PLATFORMS.map((key) => {
            const s = getSyndicationSpec(key)!;
            return { key, platform: s.platform, variant_type: s.variantType, label: s.label };
          }),
        },
        200,
        req,
      );
    }
    if (action === 'generate' && req.method === 'POST') {
      return await generate(admin, tenantId, user.id, req);
    }
    if (!action && req.method === 'GET') {
      return await list(admin, tenantId, url, req);
    }
    if (action && action !== 'generate' && action !== 'platforms') {
      if (req.method === 'PATCH') return await patch(admin, tenantId, user.id, action, req);
      if (req.method === 'DELETE') return await remove(admin, tenantId, user.id, action, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-syndication handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function generateOne(
  spec: SyndicationSpec,
  postContext: string,
): Promise<{ content: string | null; contentJson: unknown | null }> {
  const raw = await generateCompletion({
    max_tokens: 2000,
    temperature: 0.7,
    system: spec.system,
    messages: [{ role: 'user', content: postContext }],
  });

  if (!spec.structured) {
    return { content: raw.trim(), contentJson: null };
  }
  // Structured specs ask for a JSON object or array.
  try {
    const trimmed = raw.trim();
    const json = trimmed.startsWith('[') ? extractJsonArray(raw) : extractJsonObject(raw);
    return { content: null, contentJson: json };
  } catch {
    // Fall back to storing the raw text so nothing is lost.
    return { content: raw.trim(), contentJson: null };
  }
}

async function generate(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const unknown = parsed.data.platforms.filter((p) => !getSyndicationSpec(p));
  if (unknown.length > 0) {
    return createCorsResponse(
      { error: `Unknown platform(s): ${unknown.join(', ')}`, available: SYNDICATION_PLATFORMS },
      400,
      req,
    );
  }

  const { data: post } = await admin
    .from('blog_posts')
    .select('id, title, excerpt, body_markdown, meta_description')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const postContext =
    `TITLE: ${post.title}\n\n` +
    (post.meta_description ? `SUMMARY: ${post.meta_description}\n\n` : '') +
    `BODY:\n${(post.body_markdown ?? post.excerpt ?? '').slice(0, 8000)}`;

  const generated: Array<{ id: string; platform: string; variant_type: string }> = [];
  const errors: string[] = [];

  for (const key of parsed.data.platforms) {
    const spec = getSyndicationSpec(key)!;
    let result;
    try {
      result = await generateOne(spec, postContext);
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : 'generation failed'}`);
      continue;
    }

    // Replace any prior draft for this (post, platform, variant) so re-runs
    // don't accumulate stale drafts.
    await admin
      .from('blog_distributions')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('post_id', post.id)
      .eq('platform', spec.platform)
      .eq('variant_type', spec.variantType)
      .eq('status', 'draft');

    const { data: created, error } = await admin
      .from('blog_distributions')
      .insert({
        tenant_id: tenantId,
        post_id: post.id,
        platform: spec.platform,
        variant_type: spec.variantType,
        content: result.content,
        content_json: result.contentJson,
        status: 'draft',
        created_by_user_id: userId,
      })
      .select('id, platform, variant_type')
      .single();
    if (error || !created) {
      errors.push(`${key}: ${error?.message ?? 'insert failed'}`);
      continue;
    }
    generated.push(created);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_syndication.generate',
      targetType: 'blog_post',
      targetId: post.id,
      afterState: { platforms: parsed.data.platforms, generated: generated.length, errors },
      summary: `Generated ${generated.length} syndication variants for "${post.title}"`,
    }),
  );

  return createCorsResponse({ generated, errors }, 201, req);
}

async function list(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id is required' }, 400, req);
  const { data, error } = await admin
    .from('blog_distributions')
    .select(
      'id, platform, variant_type, content, content_json, status, scheduled_for, published_at, created_at',
    )
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('platform', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ distributions: data ?? [] }, 200, req);
}

async function patch(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.content !== undefined) update.content = parsed.data.content;
  if (parsed.data.content_json !== undefined) update.content_json = parsed.data.content_json;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { data: updated, error } = await admin
    .from('blog_distributions')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id, platform, variant_type, status')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!updated) return createCorsResponse({ error: 'Distribution not found' }, 404, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_syndication.update',
      targetType: 'blog_distribution',
      targetId: id,
      afterState: { status: updated.status },
      summary: `Edited ${updated.platform} ${updated.variant_type} variant`,
    }),
  );
  return createCorsResponse({ distribution: updated }, 200, req);
}

async function remove(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  const { error } = await admin
    .from('blog_distributions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id);
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_syndication.delete',
      targetType: 'blog_distribution',
      targetId: id,
      summary: 'Deleted syndication variant',
    }),
  );
  return createCorsResponse({ deleted: true }, 200, req);
}
