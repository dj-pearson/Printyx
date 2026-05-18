// Blog Content Briefs Edge Function (US-BLOG-023)
//
// CRUD over blog_briefs plus an LLM /generate action that turns a keyword +
// the latest cached SERP snapshot into a thorough, editable content brief, and
// a /start-writing action that spawns a prefilled post draft.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   GET    /blog-briefs?status=&search=&limit=&offset=   list (newest first)
//   GET    /blog-briefs/:id                               fetch one
//   POST   /blog-briefs/generate                          body: { keyword, keyword_id?, location_code?, language_code? }
//   PATCH  /blog-briefs/:id                               body: { markdown?, status?, assigned_to_user_id?, title? }
//   POST   /blog-briefs/:id/start-writing                 → creates a post draft, links it, brief → in_progress
//   DELETE /blog-briefs/:id                               soft delete
//
// Status vocabulary uses the blog_briefs schema enum
// (draft | ready | in_progress | complete | archived). The PRD's
// draft|approved|in-writing|done maps 1:1 onto draft|ready|in_progress|complete.
//
// The canonical, editable artifact is markdown, stored at outline.markdown
// alongside the structured sections at outline.sections (jsonb — no migration).

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonObject, asStringArray } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const STATUSES = ['draft', 'ready', 'in_progress', 'complete', 'archived'] as const;

const generateSchema = z.object({
  keyword: z.string().min(1).max(500),
  keyword_id: z.string().uuid().optional(),
  location_code: z.number().int().optional(),
  language_code: z.string().min(2).max(16).optional(),
});

const patchSchema = z.object({
  markdown: z.string().max(100_000).optional(),
  status: z.enum(STATUSES).optional(),
  assigned_to_user_id: z.string().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
});

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

interface BriefSections {
  target_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  target_audience: string;
  target_word_count: number;
  target_reading_level: string;
  outline: Array<{ h2: string; h3: string[] }>;
  entities: string[];
  faqs: Array<{ q: string; a: string }>;
  schema_plan: string;
  internal_link_ideas: string[];
  sources: string[];
  originality_angle: string;
  cta_plan: string;
}

const SYSTEM_PROMPT = `You are a senior content strategist writing an actionable brief a writer can execute without further research.

Return ONLY a JSON object (no markdown, no prose) with EXACTLY these keys:
{
 "secondary_keywords": string[],            // 5-10 semantically related terms
 "search_intent": "informational|commercial|transactional|navigational",
 "target_audience": string,                 // 1-2 sentence persona
 "target_reading_level": string,            // e.g. "Grade 8-10 / industry professional"
 "outline": [{"h2": string, "h3": string[]}],   // synthesized from the SERP context, 5-9 H2s
 "entities": string[],                      // NLP/entities to mention for topical coverage
 "faqs": [{"q": string, "a": string}],      // 3-6, seeded from SERP/PAA context
 "schema_plan": string,                     // which schema.org type(s) and why
 "internal_link_ideas": string[],           // anchor/topic ideas for internal links
 "sources": string[],                       // authoritative source URLs/types to cite
 "originality_angle": string,               // REQUIRED: a contrarian or novel angle nobody in the SERP takes
 "cta_plan": string                         // where/what CTA, mapped to funnel stage
}

The originality_angle must be specific and non-obvious — it is the most important field.`;

function renderMarkdown(s: BriefSections): string {
  const lines: string[] = [];
  lines.push(`# Content Brief: ${s.target_keyword}`, '');
  lines.push(`**Search intent:** ${s.search_intent}`);
  lines.push(`**Target audience:** ${s.target_audience}`);
  lines.push(`**Target word count:** ${s.target_word_count}`);
  lines.push(`**Target reading level:** ${s.target_reading_level}`, '');
  lines.push(`## Originality angle`, s.originality_angle, '');
  lines.push(`## Secondary keywords`, s.secondary_keywords.map((k) => `- ${k}`).join('\n'), '');
  lines.push(`## Suggested outline`);
  for (const o of s.outline) {
    lines.push(`### ${o.h2}`);
    for (const h3 of o.h3) lines.push(`- ${h3}`);
  }
  lines.push('');
  lines.push(`## Entities / NLP terms to include`, s.entities.map((e) => `- ${e}`).join('\n'), '');
  lines.push(`## FAQs`);
  for (const f of s.faqs) lines.push(`### ${f.q}`, f.a, '');
  lines.push(`## Schema markup plan`, s.schema_plan, '');
  lines.push(
    `## Internal link opportunities`,
    s.internal_link_ideas.map((i) => `- ${i}`).join('\n'),
    '',
  );
  lines.push(`## Sources to cite`, s.sources.map((i) => `- ${i}`).join('\n'), '');
  lines.push(`## CTA placement plan`, s.cta_plan, '');
  return lines.join('\n');
}

function outlineToPostMarkdown(s: BriefSections): string {
  const lines: string[] = [];
  for (const o of s.outline) {
    lines.push(`## ${o.h2}`, '');
    for (const h3 of o.h3) lines.push(`### ${h3}`, '', '_Write this section._', '');
  }
  return lines.join('\n');
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
    const { parts } = normalizePath(url.pathname, 'blog-briefs');
    const first = parts[0];
    const second = parts[1];

    if (!first) {
      if (req.method === 'GET') return await listBriefs(admin, tenantId, url, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }
    if (first === 'generate' && req.method === 'POST') {
      return await generateBrief(admin, tenantId, user.id, req);
    }
    if (first && second === 'start-writing' && req.method === 'POST') {
      return await startWriting(admin, tenantId, user.id, first, req);
    }
    if (first && !second) {
      if (req.method === 'GET') return await getBrief(admin, tenantId, first, req);
      if (req.method === 'PATCH') return await patchBrief(admin, tenantId, user.id, first, req);
      if (req.method === 'DELETE') return await deleteBrief(admin, tenantId, user.id, first, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-briefs handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listBriefs(admin: Admin, tenantId: string, url: URL, req: Request) {
  const p = url.searchParams;
  const status = p.get('status');
  const search = p.get('search');
  const limit = Math.min(Math.max(Number(p.get('limit')) || 50, 1), 200);
  const offset = Math.max(Number(p.get('offset')) || 0, 0);

  let q = admin
    .from('blog_briefs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status);
  if (search) q = q.ilike('title', `%${search}%`);

  const { data, error, count } = await q
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ briefs: data ?? [], total: count ?? 0 }, 200, req);
}

async function getBrief(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_briefs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Brief not found' }, 404, req);
  return createCorsResponse({ brief: data }, 200, req);
}

async function generateBrief(admin: Admin, tenantId: string, userId: string, req: Request) {
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
  const keyword = parsed.data.keyword.trim();

  // Pull the latest SERP snapshot for SERP-grounded outline + word count.
  const { data: snap } = await admin
    .from('blog_serp_snapshots')
    .select('organic_results, aggregate, serp_features, fetched_at')
    .eq('tenant_id', tenantId)
    .eq('keyword', keyword)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const organic = (snap?.organic_results ?? []) as Array<{
    rank?: number;
    title?: string;
    description?: string | null;
  }>;
  const aggregate = (snap?.aggregate ?? {}) as {
    median_word_count?: number | null;
    common_h2s?: Array<{ text: string; count: number }>;
  };
  const medianWc = aggregate.median_word_count ?? null;
  const targetWordCount = medianWc ? Math.round(medianWc * 1.2) : 1500;

  const serpContext =
    organic.length > 0
      ? organic
          .slice(0, 10)
          .map(
            (o, i) =>
              `${o.rank ?? i + 1}. ${String(o.title ?? '').slice(0, 160)} — ${String(
                o.description ?? '',
              )
                .replace(/\s+/g, ' ')
                .slice(0, 200)}`,
          )
          .join('\n')
      : '(no cached SERP snapshot — base the brief on the keyword alone and flag that a SERP fetch would sharpen it)';
  const commonH2s = (aggregate.common_h2s ?? [])
    .slice(0, 12)
    .map((h) => h.text)
    .join('; ');

  const userPrompt = [
    `Target keyword: "${keyword}"`,
    `Median competitor word count: ${medianWc ?? 'unknown'} (set target_word_count to ${targetWordCount}).`,
    commonH2s ? `Common competitor H2s: ${commonH2s}` : null,
    '',
    'Top SERP results:',
    serpContext,
  ]
    .filter((l) => l !== null)
    .join('\n');

  const raw = await generateCompletion({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 3000,
    temperature: 0.5,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  let obj: Record<string, unknown>;
  try {
    obj = extractJsonObject(raw);
  } catch (err) {
    console.error('blog-briefs generate parse error', err, raw.slice(0, 300));
    return createCorsResponse(
      { error: 'The model returned an unparseable brief. Try again.' },
      502,
      req,
    );
  }

  const sections: BriefSections = {
    target_keyword: keyword,
    secondary_keywords: asStringArray(obj.secondary_keywords),
    search_intent: String(obj.search_intent ?? 'informational'),
    target_audience: String(obj.target_audience ?? ''),
    target_word_count: targetWordCount,
    target_reading_level: String(obj.target_reading_level ?? ''),
    outline: Array.isArray(obj.outline)
      ? (obj.outline as Array<Record<string, unknown>>).slice(0, 12).map((o) => ({
          h2: String(o.h2 ?? ''),
          h3: asStringArray(o.h3),
        }))
      : [],
    entities: asStringArray(obj.entities),
    faqs: Array.isArray(obj.faqs)
      ? (obj.faqs as Array<Record<string, unknown>>).slice(0, 10).map((f) => ({
          q: String(f.q ?? ''),
          a: String(f.a ?? ''),
        }))
      : [],
    schema_plan: String(obj.schema_plan ?? ''),
    internal_link_ideas: asStringArray(obj.internal_link_ideas),
    sources: asStringArray(obj.sources),
    originality_angle: String(obj.originality_angle ?? ''),
    cta_plan: String(obj.cta_plan ?? ''),
  };

  const markdown = renderMarkdown(sections);

  const { data: created, error } = await admin
    .from('blog_briefs')
    .insert({
      tenant_id: tenantId,
      title: `Brief: ${keyword}`,
      target_keyword_id: parsed.data.keyword_id ?? null,
      target_audience: sections.target_audience,
      search_intent: sections.search_intent.slice(0, 20),
      recommended_word_count: targetWordCount,
      outline: { markdown, sections },
      key_takeaways: sections.secondary_keywords.slice(0, 10),
      serp_snapshot: snap ?? null,
      status: 'draft',
      created_by_user_id: userId,
    })
    .select('*')
    .single();

  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Failed to save brief' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_brief.generate',
      targetType: 'blog_briefs',
      targetId: created.id,
      summary: `Generated brief for "${keyword}"${snap ? ' (SERP-grounded)' : ' (no SERP snapshot)'}`,
    }),
  );

  return createCorsResponse({ brief: created }, 201, req);
}

async function patchBrief(
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

  const { data: existing, error: readErr } = await admin
    .from('blog_briefs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (readErr) return createCorsResponse({ error: readErr.message }, 500, req);
  if (!existing) return createCorsResponse({ error: 'Brief not found' }, 404, req);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.assigned_to_user_id !== undefined) {
    updates.assigned_to_user_id = parsed.data.assigned_to_user_id;
  }
  if (parsed.data.markdown !== undefined) {
    const outline = (existing.outline ?? {}) as Record<string, unknown>;
    updates.outline = { ...outline, markdown: parsed.data.markdown };
  }

  const { data: updated, error } = await admin
    .from('blog_briefs')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Failed to update brief' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_brief.update',
      targetType: 'blog_briefs',
      targetId: id,
      beforeState: { status: existing.status },
      afterState: { status: updated.status },
      summary: `Updated brief "${updated.title}"${
        parsed.data.status ? ` → ${parsed.data.status}` : ''
      }`,
    }),
  );

  return createCorsResponse({ brief: updated }, 200, req);
}

async function startWriting(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: brief, error: readErr } = await admin
    .from('blog_briefs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (readErr) return createCorsResponse({ error: readErr.message }, 500, req);
  if (!brief) return createCorsResponse({ error: 'Brief not found' }, 404, req);

  const sections = ((brief.outline ?? {}) as { sections?: BriefSections }).sections;
  const bodyMd = sections ? outlineToPostMarkdown(sections) : '';
  const baseTitle = String(brief.title ?? 'Untitled').replace(/^Brief:\s*/i, '');
  const slug =
    baseTitle
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 180) || `draft-${Date.now()}`;

  const { data: post, error: postErr } = await admin
    .from('blog_posts')
    .insert({
      tenant_id: tenantId,
      brief_id: brief.id,
      title: baseTitle,
      slug,
      body_markdown: bodyMd,
      status: 'draft',
      author_user_id: userId,
      created_by_user_id: userId,
    })
    .select('id, slug')
    .single();

  if (postErr || !post) {
    return createCorsResponse(
      { error: postErr?.message ?? 'Failed to create post draft' },
      500,
      req,
    );
  }

  await admin
    .from('blog_briefs')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_brief.start_writing',
      targetType: 'blog_briefs',
      targetId: id,
      summary: `Started writing from brief "${brief.title}" → post ${post.id}`,
    }),
  );

  return createCorsResponse({ post_id: post.id }, 201, req);
}

async function deleteBrief(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const nowIso = new Date().toISOString();
  const { data: deleted, error } = await admin
    .from('blog_briefs')
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, title')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!deleted) return createCorsResponse({ error: 'Brief not found' }, 404, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_brief.delete',
      targetType: 'blog_briefs',
      targetId: id,
      summary: `Deleted brief "${deleted.title}"`,
    }),
  );

  return createCorsResponse({ ok: true }, 200, req);
}
