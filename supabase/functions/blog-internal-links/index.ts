// Blog Internal Link Opportunity Finder Edge Function (US-BLOG-020)
//
// For a given source post, finds the best internal links to OTHER published
// posts in the same workspace and proposes varied anchor text + the context
// where each link should slot in. Anchor-text variety is enforced: the finder
// never proposes the same anchor phrase twice for one source post.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST   /blog-internal-links/analyze        body: { post_id, max_links? }
//                                              analyze ONE post against the published corpus.
//   POST   /blog-internal-links/analyze-all    body: { max_links?, limit? }
//                                              analyze up to `limit` published posts.
//   GET    /blog-internal-links/suggestions?post_id=&status=
//   PATCH  /blog-internal-links/suggestions/:id  body: { status: accepted|dismissed|applied }
//
// The candidate corpus is intentionally capped (most-recent 200 published posts)
// so the LLM prompt stays bounded; relevance is the model's job, not a vector DB.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonArray } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const analyzeSchema = z.object({
  post_id: z.string().uuid(),
  max_links: z.number().int().min(1).max(20).optional(),
});
const analyzeAllSchema = z.object({
  max_links: z.number().int().min(1).max(20).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
const patchSchema = z.object({
  status: z.enum(['suggested', 'accepted', 'dismissed', 'applied']),
});

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string | null;
}

interface LinkProposal {
  target_post_id: string;
  anchor_text: string;
  context_snippet?: string;
  relevance?: number;
  rationale?: string;
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
    const { parts } = normalizePath(url.pathname, 'blog-internal-links');
    const action = parts[0];

    if (action === 'analyze' && req.method === 'POST') {
      return await analyzeOne(admin, tenantId, user.id, req);
    }
    if (action === 'analyze-all' && req.method === 'POST') {
      return await analyzeAll(admin, tenantId, user.id, req);
    }
    if (action === 'suggestions' && req.method === 'GET') {
      return await listSuggestions(admin, tenantId, url, req);
    }
    if (action === 'suggestions' && req.method === 'PATCH' && parts[1]) {
      return await patchSuggestion(admin, tenantId, user.id, parts[1], req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-internal-links handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function fetchCorpus(admin: Admin, tenantId: string, excludeId?: string): Promise<PostRow[]> {
  const { data } = await admin
    .from('blog_posts')
    .select('id, title, slug, excerpt, body_markdown')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(200);
  const rows = (data ?? []) as PostRow[];
  return excludeId ? rows.filter((r) => r.id !== excludeId) : rows;
}

/**
 * Run the LLM finder for one source post against the candidate corpus. Returns
 * the inserted suggestion count. Enforces anchor-text variety by deduping
 * anchors (case-insensitive) within the source post.
 */
async function findForPost(
  admin: Admin,
  tenantId: string,
  userId: string,
  source: PostRow,
  corpus: PostRow[],
  maxLinks: number,
  req: Request,
): Promise<number> {
  if (corpus.length === 0) return 0;

  const candidateList = corpus
    .map((p) => `- id=${p.id} | ${p.title} | ${(p.excerpt ?? '').slice(0, 160)}`)
    .join('\n');
  const sourceBody = (source.body_markdown ?? source.excerpt ?? '').slice(0, 6000);

  const raw = await generateCompletion({
    max_tokens: 1800,
    temperature: 0.3,
    system:
      'You are an SEO editor finding INTERNAL link opportunities. Given a source ' +
      'article and a list of candidate target articles, propose where the source ' +
      'should link to a target. Rules: (1) only use target ids from the list; ' +
      '(2) anchor text must be natural phrasing that ALREADY appears (or nearly) ' +
      'in the source body; (3) VARY anchor text — never repeat the same phrase; ' +
      '(4) at most one link per target. Respond ONLY with a JSON array of ' +
      '{ "target_post_id": "<id>", "anchor_text": "<=80 chars", "context_snippet": ' +
      '"<short surrounding sentence>", "relevance": 0..1, "rationale": "<one line>" }.',
    messages: [
      {
        role: 'user',
        content:
          `SOURCE ARTICLE: "${source.title}"\n\n${sourceBody}\n\n` +
          `CANDIDATE TARGETS:\n${candidateList}\n\n` +
          `Propose up to ${maxLinks} internal links.`,
      },
    ],
  });

  let proposals: LinkProposal[] = [];
  try {
    proposals = extractJsonArray(raw) as LinkProposal[];
  } catch {
    return 0;
  }

  const validTargets = new Set(corpus.map((c) => c.id));
  const seenAnchors = new Set<string>();
  const seenTargets = new Set<string>();
  let inserted = 0;

  // Replace prior un-actioned suggestions for this source so re-runs don't pile up.
  await admin
    .from('blog_internal_link_suggestions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('source_post_id', source.id)
    .eq('status', 'suggested');

  for (const p of proposals) {
    if (inserted >= maxLinks) break;
    if (!p.target_post_id || !validTargets.has(p.target_post_id)) continue;
    if (p.target_post_id === source.id) continue;
    const anchor = String(p.anchor_text ?? '').trim();
    if (!anchor) continue;
    const anchorKey = anchor.toLowerCase();
    if (seenAnchors.has(anchorKey)) continue; // anchor-text variety
    if (seenTargets.has(p.target_post_id)) continue; // one link per target
    seenAnchors.add(anchorKey);
    seenTargets.add(p.target_post_id);

    const relevance =
      typeof p.relevance === 'number' ? Math.min(Math.max(p.relevance, 0), 1) : null;
    const { error } = await admin.from('blog_internal_link_suggestions').insert({
      tenant_id: tenantId,
      source_post_id: source.id,
      target_post_id: p.target_post_id,
      anchor_text: anchor.slice(0, 300),
      context_snippet: p.context_snippet ? String(p.context_snippet).slice(0, 1000) : null,
      relevance_score: relevance,
      rationale: p.rationale ? String(p.rationale).slice(0, 1000) : null,
      status: 'suggested',
      created_by_user_id: userId,
    });
    if (!error) inserted++;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_internal_links.analyze',
      targetType: 'blog_post',
      targetId: source.id,
      afterState: { suggestions: inserted },
      summary: `Found ${inserted} internal-link opportunities for "${source.title}"`,
    }),
  );

  return inserted;
}

async function analyzeOne(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const maxLinks = parsed.data.max_links ?? 5;

  const { data: source } = await admin
    .from('blog_posts')
    .select('id, title, slug, excerpt, body_markdown')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const corpus = await fetchCorpus(admin, tenantId, source.id);
  const inserted = await findForPost(
    admin,
    tenantId,
    userId,
    source as PostRow,
    corpus,
    maxLinks,
    req,
  );
  return createCorsResponse({ post_id: source.id, suggestions: inserted }, 201, req);
}

async function analyzeAll(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
    }
  }
  const parsed = analyzeAllSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const maxLinks = parsed.data.max_links ?? 5;
  const limit = parsed.data.limit ?? 20;

  const corpus = await fetchCorpus(admin, tenantId);
  if (corpus.length < 2) {
    return createCorsResponse({ error: 'Need at least 2 published posts to cross-link.' }, 400, req);
  }

  const targets = corpus.slice(0, limit);
  let totalInserted = 0;
  let analyzed = 0;
  for (const source of targets) {
    const others = corpus.filter((c) => c.id !== source.id);
    try {
      totalInserted += await findForPost(admin, tenantId, userId, source, others, maxLinks, req);
      analyzed++;
    } catch (err) {
      console.error('analyze-all post failed', source.id, err);
    }
  }
  return createCorsResponse({ analyzed, suggestions: totalInserted }, 201, req);
}

async function listSuggestions(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  const status = url.searchParams.get('status');

  let query = admin
    .from('blog_internal_link_suggestions')
    .select(
      'id, source_post_id, target_post_id, anchor_text, context_snippet, relevance_score, rationale, status, created_at',
    )
    .eq('tenant_id', tenantId)
    .order('relevance_score', { ascending: false, nullsFirst: false })
    .limit(500);
  if (postId) query = query.eq('source_post_id', postId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ suggestions: data ?? [] }, 200, req);
}

async function patchSuggestion(
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: updated, error } = await admin
    .from('blog_internal_link_suggestions')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id, status')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!updated) return createCorsResponse({ error: 'Suggestion not found' }, 404, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_internal_links.update',
      targetType: 'blog_internal_link_suggestion',
      targetId: id,
      afterState: { status: parsed.data.status },
      summary: `Internal-link suggestion ${parsed.data.status}`,
    }),
  );

  return createCorsResponse({ suggestion: updated }, 200, req);
}
