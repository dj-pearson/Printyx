// Blog Internal-Link Auto-Injection on Publish Edge Function (US-BLOG-055)
//
// When a pillar post publishes, finds existing posts that should link TO it but
// don't yet, proposes a sentence-level edit inserting the link naturally, and
// lets the editor review the changes PR-style. Accepted edits create a new
// revision on each source post (re-publish via the CMS adapter is the publish
// flow's job). Inbound backlink count surfaces on the pillar's stats card.
//
// Reuses blog_internal_link_suggestions (source_post_id = the post getting the
// link, target_post_id = the pillar) with a proposed_edit { before, after }.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST /blog-link-injection/propose    body: { pillar_post_id, max_sources? }
//   GET  /blog-link-injection/diff?pillar_post_id=
//   POST /blog-link-injection/apply      body: { suggestion_ids[] }
//   GET  /blog-link-injection/backlinks?post_id=

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const proposeSchema = z.object({
  pillar_post_id: z.string().uuid(),
  max_sources: z.number().int().min(1).max(20).optional(),
});
const applySchema = z.object({ suggestion_ids: z.array(z.string().uuid()).min(1).max(100) });

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string | null;
  cluster_id: string | null;
}

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
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-link-injection');
    const action = parts[0];

    if (action === 'propose' && req.method === 'POST') {
      return await propose(admin, tenantId, user.id, req);
    }
    if (action === 'diff' && req.method === 'GET') {
      return await diff(admin, tenantId, url, req);
    }
    if (action === 'apply' && req.method === 'POST') {
      return await apply(admin, tenantId, user.id, req);
    }
    if (action === 'backlinks' && req.method === 'GET') {
      return await backlinks(admin, tenantId, url, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-link-injection handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function propose(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = proposeSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const maxSources = parsed.data.max_sources ?? 5;

  const { data: pillar } = await admin
    .from('blog_posts')
    .select('id, title, slug, excerpt, body_markdown, cluster_id')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.pillar_post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!pillar) return createCorsResponse({ error: 'Pillar post not found' }, 404, req);

  // Candidate sources: other published posts that don't already link to the pillar.
  const { data: others } = await admin
    .from('blog_posts')
    .select('id, title, slug, excerpt, body_markdown, cluster_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .neq('id', pillar.id)
    .limit(200);
  const pillarSlug = String(pillar.slug ?? '');
  const candidates = ((others ?? []) as PostRow[]).filter((p) => {
    const bodyLc = (p.body_markdown ?? '').toLowerCase();
    // Skip if it already links to the pillar (by slug).
    return pillarSlug ? !bodyLc.includes(`/${pillarSlug.toLowerCase()}`) : true;
  });
  if (candidates.length === 0) {
    return createCorsResponse({ proposed: 0, suggestions: [] }, 200, req);
  }

  // Prefer same-cluster candidates, then take up to 3x maxSources for the LLM pass.
  candidates.sort((a, b) => {
    const aSame = a.cluster_id && a.cluster_id === pillar.cluster_id ? 1 : 0;
    const bSame = b.cluster_id && b.cluster_id === pillar.cluster_id ? 1 : 0;
    return bSame - aSame;
  });
  const shortlist = candidates.slice(0, maxSources * 3);

  // Clear prior un-actioned injection suggestions targeting this pillar.
  await admin
    .from('blog_internal_link_suggestions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('target_post_id', pillar.id)
    .eq('status', 'suggested');

  const suggestions: Array<{ id: string; source_post_id: string }> = [];
  for (const src of shortlist) {
    if (suggestions.length >= maxSources) break;
    const srcBody = (src.body_markdown ?? src.excerpt ?? '').slice(0, 6000);
    if (!srcBody.trim()) continue;

    let parsedEdit: { relevant?: boolean; anchor?: string; before?: string; after?: string; rationale?: string };
    try {
      const raw = await generateCompletion({
        max_tokens: 700,
        temperature: 0.3,
        system:
          'You insert a single natural internal link from a SOURCE article to a ' +
          'PILLAR article. Pick one existing sentence in the source where a link to ' +
          'the pillar fits naturally, and rewrite ONLY that sentence to include a ' +
          'markdown link to {{pillar_url}} with descriptive anchor text (not "click ' +
          'here"). If no sentence is a good fit, set relevant=false. Respond ONLY with ' +
          'JSON { "relevant": true|false, "anchor": "<anchor text>", "before": ' +
          '"<original sentence>", "after": "<rewritten sentence with the link>", ' +
          '"rationale": "<one line>" }.',
        messages: [
          {
            role: 'user',
            content:
              `PILLAR: "${pillar.title}" (link target: /${pillarSlug})\n` +
              `PILLAR SUMMARY: ${(pillar.excerpt ?? '').slice(0, 300)}\n\n` +
              `SOURCE: "${src.title}"\n${srcBody}`,
          },
        ],
      });
      parsedEdit = extractJsonObject(raw) as typeof parsedEdit;
    } catch {
      continue;
    }
    if (!parsedEdit.relevant || !parsedEdit.anchor || !parsedEdit.before || !parsedEdit.after) {
      continue;
    }

    const { data: created, error } = await admin
      .from('blog_internal_link_suggestions')
      .insert({
        tenant_id: tenantId,
        source_post_id: src.id,
        target_post_id: pillar.id,
        anchor_text: String(parsedEdit.anchor).slice(0, 300),
        context_snippet: String(parsedEdit.before).slice(0, 1000),
        rationale: parsedEdit.rationale ? String(parsedEdit.rationale).slice(0, 1000) : null,
        proposed_edit: { before: parsedEdit.before, after: parsedEdit.after },
        status: 'suggested',
        created_by_user_id: userId,
      })
      .select('id, source_post_id')
      .single();
    if (!error && created) suggestions.push(created);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_link_injection.propose',
      targetType: 'blog_post',
      targetId: pillar.id,
      afterState: { proposed: suggestions.length },
      summary: `Proposed ${suggestions.length} inbound links to pillar "${pillar.title}"`,
    }),
  );

  return createCorsResponse({ proposed: suggestions.length, suggestions }, 201, req);
}

async function diff(admin: Admin, tenantId: string, url: URL, req: Request) {
  const pillarId = url.searchParams.get('pillar_post_id');
  if (!pillarId) return createCorsResponse({ error: 'pillar_post_id is required' }, 400, req);
  const { data, error } = await admin
    .from('blog_internal_link_suggestions')
    .select('id, source_post_id, target_post_id, anchor_text, proposed_edit, rationale, status')
    .eq('tenant_id', tenantId)
    .eq('target_post_id', pillarId)
    .order('created_at', { ascending: true });
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  // Enrich with source post titles for the diff header.
  const srcIds = Array.from(new Set((data ?? []).map((d) => d.source_post_id)));
  const titleById = new Map<string, string>();
  if (srcIds.length > 0) {
    const { data: posts } = await admin
      .from('blog_posts')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .in('id', srcIds);
    for (const p of posts ?? []) titleById.set(p.id, p.title);
  }
  const diffs = (data ?? []).map((d) => ({
    ...d,
    source_title: titleById.get(d.source_post_id) ?? null,
  }));
  return createCorsResponse({ diffs }, 200, req);
}

async function apply(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: sugs } = await admin
    .from('blog_internal_link_suggestions')
    .select('id, source_post_id, target_post_id, anchor_text, proposed_edit, status')
    .eq('tenant_id', tenantId)
    .in('id', parsed.data.suggestion_ids);
  if (!sugs || sugs.length === 0) {
    return createCorsResponse({ error: 'No matching suggestions' }, 404, req);
  }

  let applied = 0;
  const skipped: string[] = [];
  for (const s of sugs) {
    if (s.status === 'applied') {
      skipped.push(s.id);
      continue;
    }
    const edit = (s.proposed_edit ?? {}) as { before?: string; after?: string };
    if (!edit.before || !edit.after) {
      skipped.push(s.id);
      continue;
    }
    const { data: src } = await admin
      .from('blog_posts')
      .select('id, body_markdown')
      .eq('tenant_id', tenantId)
      .eq('id', s.source_post_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!src || !src.body_markdown || !src.body_markdown.includes(edit.before)) {
      skipped.push(s.id);
      continue;
    }
    const newBody = src.body_markdown.replace(edit.before, edit.after);

    // Next revision number for the source post.
    const { data: lastRev } = await admin
      .from('blog_post_revisions')
      .select('revision_number')
      .eq('tenant_id', tenantId)
      .eq('post_id', src.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const revNumber = (lastRev?.revision_number ?? 0) + 1;

    await admin.from('blog_post_revisions').insert({
      tenant_id: tenantId,
      post_id: src.id,
      revision_number: revNumber,
      body_markdown: newBody,
      revision_source: 'link_injection',
      diff_summary: `Inserted internal link "${s.anchor_text}" → pillar ${s.target_post_id}`,
      changed_by_user_id: userId,
    });
    // Update the live post body (re-publish via CMS adapter is the publish flow's job).
    await admin
      .from('blog_posts')
      .update({ body_markdown: newBody, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', src.id);
    await admin
      .from('blog_internal_link_suggestions')
      .update({ status: 'applied', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', s.id);
    applied++;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_link_injection.apply',
      targetType: 'blog_internal_link_suggestion',
      afterState: { applied, skipped: skipped.length },
      summary: `Applied ${applied} internal-link injections (${skipped.length} skipped)`,
    }),
  );

  return createCorsResponse({ applied, skipped }, 200, req);
}

async function backlinks(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id is required' }, 400, req);
  const { count } = await admin
    .from('blog_internal_link_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('target_post_id', postId)
    .eq('status', 'applied');
  return createCorsResponse({ post_id: postId, backlinks: count ?? 0 }, 200, req);
}
