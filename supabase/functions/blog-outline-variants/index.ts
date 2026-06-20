// Blog Outline A/B Variants Edge Function (US-BLOG-030)
//
// The brief generator produces multiple outline angles (how-to vs comparison vs
// deep-dive) for one keyword. Each variant is scored for SERP-fit (how well it
// matches what's ranking) and differentiation (how distinct it is from the top
// SERP) — and after a topic saturates, differentiation matters more than fit.
// The editor selects one to proceed; rejected variants are archived with the
// brief for future reference. A/B test mode pairs two variants on the same
// keyword targeting different intents.
//
// Routes (tenant-scoped, gated to blog.post.edit):
//   POST /blog-outline-variants/generate  body: { keyword, brief_id?, intent?, count?,
//                                                 angles?: string[] }
//   POST /blog-outline-variants/select    body: { variant_id, write_to_brief? }
//   POST /blog-outline-variants/ab-test    body: { variant_ids: [id, id] }
//   GET  /blog-outline-variants?brief_id=&keyword=&status=
//   GET  /blog-outline-variants/:id

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletionDetailed } from '../_shared/anthropic.ts';
import { extractJsonArray } from '../_shared/blog/llm-json.ts';
import { logAiCost, getQuotaStatus, usdToCents } from '../_shared/blog/ai-cost.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const DEFAULT_ANGLES = ['how_to', 'comparison', 'deep_dive'];

const generateSchema = z.object({
  keyword: z.string().min(2).max(500),
  brief_id: z.string().uuid().optional(),
  intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']).optional(),
  count: z.number().int().min(2).max(5).optional(),
  angles: z.array(z.string().max(32)).max(5).optional(),
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
    const { parts } = normalizePath(url.pathname, 'blog-outline-variants');
    const action = parts[0];

    if (action === 'generate' && req.method === 'POST') {
      return await generate(admin, tenantId, user.id, req);
    }
    if (action === 'select' && req.method === 'POST') {
      return await select(admin, tenantId, user.id, req);
    }
    if (action === 'ab-test' && req.method === 'POST') {
      return await abTest(admin, tenantId, user.id, req);
    }
    if (!action && req.method === 'GET') {
      return await list(admin, tenantId, url, req);
    }
    if (action && req.method === 'GET') {
      return await getOne(admin, tenantId, action, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-outline-variants handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── generate ─────────────────────────────────────────────────────────────────
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
  const d = parsed.data;
  const count = d.count ?? 3;
  const angles = (d.angles && d.angles.length ? d.angles : DEFAULT_ANGLES).slice(0, count);

  const quota = await getQuotaStatus(admin, tenantId);
  if (quota.blocked) {
    return createCorsResponse({ error: 'ai_quota_exceeded' }, 429, req);
  }

  // Pull the latest SERP snapshot for this keyword (optional context for scoring).
  const { data: snap } = await admin
    .from('blog_serp_snapshots')
    .select('id, organic_results, aggregate')
    .eq('tenant_id', tenantId)
    .eq('keyword', d.keyword)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const serpContext = snap
    ? summarizeSerp(snap.organic_results, snap.aggregate)
    : 'No SERP snapshot available — score fit/differentiation from general knowledge of this query.';

  let text: string;
  let usage: { inputTokens: number; outputTokens: number; costUsd: number };
  try {
    const res = await generateCompletionDetailed({
      max_tokens: 3500,
      temperature: 0.7,
      system:
        'You are an SEO content strategist. Produce distinct outline variants for one keyword, each a different angle, and score each against the SERP. Output STRICT JSON only.',
      messages: [
        {
          role: 'user',
          content: `Keyword: "${d.keyword}"\nTarget intent: ${d.intent ?? 'infer the dominant intent'}\nAngles to cover (one variant each): ${angles.join(', ')}\n\nTop SERP context:\n${serpContext}\n\nReturn a JSON array of ${angles.length} objects: [{"angle": string, "target_intent": "informational"|"commercial"|"transactional"|"navigational", "title": string, "hook": string, "target_word_count": number, "sections": [{"h2": string, "h3": string[]}], "serp_fit_score": number, "differentiation_score": number, "rationale": string}]. Scores are 0-100. serp_fit_score = how well this matches what ranks; differentiation_score = how distinct from the existing top results. Be honest: a generic rehash should score low on differentiation.`,
        },
      ],
    });
    text = res.text;
    usage = res.usage;
  } catch (err) {
    return createCorsResponse(
      { error: `Generation failed: ${err instanceof Error ? err.message : 'unknown'}` },
      502,
      req,
    );
  }

  await logAiCost(admin, {
    tenantId,
    provider: 'anthropic',
    model: 'anthropic',
    feature: 'outline_variants.generate',
    promptTokens: usage.inputTokens,
    completionTokens: usage.outputTokens,
    costCents: usdToCents(usage.costUsd),
    userId,
  });

  let raw: unknown[];
  try {
    raw = extractJsonArray(text);
  } catch {
    return createCorsResponse({ error: 'Model returned unparseable variants' }, 502, req);
  }

  const rows = raw.slice(0, count).map((v) => {
    const o = v as Record<string, unknown>;
    return {
      tenant_id: tenantId,
      brief_id: d.brief_id ?? null,
      keyword: d.keyword,
      angle: clampStr(o.angle, 32),
      target_intent: clampStr(o.target_intent ?? d.intent, 20),
      outline: {
        title: o.title ?? null,
        hook: o.hook ?? null,
        target_word_count: numOrNull(o.target_word_count),
        sections: Array.isArray(o.sections) ? o.sections : [],
      },
      serp_fit_score: clampScore(o.serp_fit_score),
      differentiation_score: clampScore(o.differentiation_score),
      scoring_rationale: typeof o.rationale === 'string' ? o.rationale : null,
      status: 'candidate',
      serp_snapshot_id: snap?.id ?? null,
      created_by_user_id: userId,
    };
  });

  const { data: created, error } = await admin
    .from('blog_outline_variants')
    .insert(rows)
    .select('*');
  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Insert failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outline_variants.generate',
      targetType: 'blog_brief',
      targetId: d.brief_id ?? null,
      afterState: { keyword: d.keyword, count: created.length, has_serp: Boolean(snap) },
      summary: `Generated ${created.length} outline variant(s) for "${d.keyword}"`,
    }),
  );

  return createCorsResponse({ variants: created, serp_used: Boolean(snap) }, 201, req);
}

// ─── select ───────────────────────────────────────────────────────────────────
async function select(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = z
    .object({ variant_id: z.string().uuid(), write_to_brief: z.boolean().optional() })
    .safeParse(body);
  if (!parsed.success) return createCorsResponse({ error: 'variant_id (uuid) required' }, 400, req);
  const { variant_id, write_to_brief } = parsed.data;

  const { data: variant } = await admin
    .from('blog_outline_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', variant_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!variant) return createCorsResponse({ error: 'Variant not found' }, 404, req);

  // Mark this one selected.
  await admin
    .from('blog_outline_variants')
    .update({ status: 'selected', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', variant_id);

  // Archive siblings (same brief if present, else same keyword) that are still candidates.
  let sib = admin
    .from('blog_outline_variants')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('status', 'candidate')
    .neq('id', variant_id);
  sib = variant.brief_id ? sib.eq('brief_id', variant.brief_id) : sib.eq('keyword', variant.keyword);
  await sib;

  // Optionally write the selected outline into the brief.
  if (write_to_brief && variant.brief_id) {
    await admin
      .from('blog_briefs')
      .update({ outline: variant.outline, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', variant.brief_id);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outline_variants.select',
      targetType: 'blog_outline_variant',
      targetId: variant_id,
      afterState: { keyword: variant.keyword, angle: variant.angle, wrote_brief: Boolean(write_to_brief && variant.brief_id) },
      summary: `Selected "${variant.angle}" outline for "${variant.keyword}"; siblings archived`,
    }),
  );

  const { data: refreshed } = await admin
    .from('blog_outline_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', variant_id)
    .single();
  return createCorsResponse({ variant: refreshed }, 200, req);
}

// ─── A/B test mode ────────────────────────────────────────────────────────────
async function abTest(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = z.object({ variant_ids: z.array(z.string().uuid()).length(2) }).safeParse(body);
  if (!parsed.success) {
    return createCorsResponse({ error: 'variant_ids must be exactly 2 uuids' }, 400, req);
  }
  const { variant_ids } = parsed.data;

  const { data: variants } = await admin
    .from('blog_outline_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', variant_ids)
    .is('deleted_at', null);
  if (!variants || variants.length !== 2) {
    return createCorsResponse({ error: 'Both variants must exist in this tenant' }, 404, req);
  }
  if (variants[0].keyword !== variants[1].keyword) {
    return createCorsResponse(
      { error: 'A/B variants must target the same keyword cluster' },
      400,
      req,
    );
  }
  if (variants[0].target_intent && variants[0].target_intent === variants[1].target_intent) {
    return createCorsResponse(
      { error: 'A/B variants should target different intents' },
      400,
      req,
    );
  }

  const group = crypto.randomUUID();
  const createdPosts: Array<{ post_id: string; variant_id: string }> = [];
  for (const v of variants) {
    const title = (v.outline as { title?: string })?.title ?? `${v.keyword} (${v.angle})`;
    const { data: post } = await admin
      .from('blog_posts')
      .insert({
        tenant_id: tenantId,
        brief_id: v.brief_id,
        title: String(title).slice(0, 480),
        slug: `${slugify(String(title))}-${Date.now().toString(36)}-${v.angle}`,
        status: 'draft',
        created_by_user_id: userId,
        author_user_id: userId,
      })
      .select('id')
      .single();
    if (post) {
      createdPosts.push({ post_id: post.id, variant_id: v.id });
      await admin
        .from('blog_outline_variants')
        .update({ ab_test_group: group, post_id: post.id, status: 'selected', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', v.id);
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outline_variants.ab_test',
      targetType: 'blog_outline_variant',
      targetId: variant_ids[0],
      afterState: { ab_test_group: group, posts: createdPosts },
      summary: `Started A/B test on "${variants[0].keyword}" across 2 intents`,
    }),
  );

  return createCorsResponse({ ab_test_group: group, posts: createdPosts }, 201, req);
}

// ─── list / get ────────────────────────────────────────────────────────────────
async function list(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_outline_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(url.searchParams.get('limit') ?? 100), 300));
  const briefId = url.searchParams.get('brief_id');
  const keyword = url.searchParams.get('keyword');
  const status = url.searchParams.get('status');
  if (briefId) q = q.eq('brief_id', briefId);
  if (keyword) q = q.eq('keyword', keyword);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ variants: data ?? [] }, 200, req);
}

async function getOne(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data } = await admin
    .from('blog_outline_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return createCorsResponse({ error: 'Variant not found' }, 404, req);
  return createCorsResponse({ variant: data }, 200, req);
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function summarizeSerp(organic: unknown, aggregate: unknown): string {
  const results = Array.isArray(organic) ? organic.slice(0, 10) : [];
  const lines = results.map((r, i) => {
    const o = r as Record<string, unknown>;
    const h2s = (o.headings as { h2?: string[] } | undefined)?.h2 ?? [];
    return `${i + 1}. ${o.title ?? '(no title)'} — ${o.word_count ?? '?'} words; H2s: ${Array.isArray(h2s) ? h2s.slice(0, 6).join('; ') : ''}`;
  });
  const agg = aggregate as { median_word_count?: number; common_h2s?: Array<{ text: string }> } | null;
  const aggLine = agg
    ? `Median word count: ${agg.median_word_count ?? '?'}. Common H2s: ${(agg.common_h2s ?? []).map((c) => c.text).slice(0, 8).join('; ')}`
    : '';
  return [aggLine, ...lines].filter(Boolean).join('\n').slice(0, 4000);
}

function clampScore(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}
function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim().slice(0, max);
}
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
