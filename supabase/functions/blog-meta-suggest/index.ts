// Blog Meta Title/Description Optimizer Edge Function (US-BLOG-036)
//
// Generates 5 title + meta-description variants from the post body via Claude,
// scores each on deterministic on-SERP signals + the LLM emotional rubric, and
// returns them ranked by a 0-100 CTR index. Stateless — "one-click pick + save"
// is the editor's existing blog-posts PATCH, so there is no persistence or
// migration here.
//
// Route (gated to platform admin OR users holding blog.post.edit):
//   POST /blog-meta-suggest   body: { title, body_markdown, target_keyword?,
//                                     current_meta_title?, current_meta_description? }
//                             returns: { variants: ScoredMetaVariant[] }
//
// The Search Console feedback loop ("pull actual CTR and feed back into the
// predictor over time") is intentionally NOT here — no GSC integration exists
// yet. The v1 predictor is the LLM-rubric + power-word heuristic per the AC;
// the feedback loop is a documented follow-up.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonArray } from '../_shared/blog/llm-json.ts';
import { scoreMetaVariant, type MetaVariantInput } from '../_shared/blog/meta-score.ts';

const reqSchema = z.object({
  title: z.string().max(500).optional(),
  body_markdown: z.string().max(500_000).optional(),
  target_keyword: z.string().max(200).optional(),
  current_meta_title: z.string().max(300).optional(),
  current_meta_description: z.string().max(600).optional(),
});

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

const SYSTEM_PROMPT = `You are an SEO copywriter optimizing the SERP title tag and meta description for click-through rate.

Generate EXACTLY 5 distinct variants. Vary the angle (benefit-led, curiosity, number/list, question, authority). For each:
- "title": 50-60 characters ideal. Include the target keyword naturally near the front when one is given.
- "description": 140-160 characters ideal. Action-oriented, include the keyword once, end with a soft CTA.
- "emotional_value": integer 0-10 — how emotionally compelling the title is (0 = flat/generic, 10 = highly compelling without clickbait).
- "rationale": one short sentence on why this variant earns the click.

Respond with ONLY a JSON array of 5 objects, no markdown, no prose:
[{"title":"...","description":"...","emotional_value":7,"rationale":"..."}]`;

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

    // Service client constructed for consistency with sibling functions; this
    // endpoint is stateless so it performs no DB work.
    createSupabaseServiceClient();

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-meta-suggest');
    if (parts.length > 0 || req.method !== 'POST') {
      return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
    }

    const parsed = reqSchema.safeParse(body);
    if (!parsed.success) {
      return createCorsResponse(
        { error: 'Validation failed', details: parsed.error.flatten() },
        400,
        req,
      );
    }

    const title = (parsed.data.title ?? '').trim();
    const bodyMd = (parsed.data.body_markdown ?? '').trim();
    const keyword = (parsed.data.target_keyword ?? '').trim();

    if (!title && !bodyMd) {
      return createCorsResponse(
        { error: 'Provide at least a title or body_markdown to generate from.' },
        400,
        req,
      );
    }

    const userPrompt = [
      title ? `Working title: ${title}` : null,
      keyword ? `Target keyword: ${keyword}` : null,
      parsed.data.current_meta_title
        ? `Current meta title: ${parsed.data.current_meta_title}`
        : null,
      parsed.data.current_meta_description
        ? `Current meta description: ${parsed.data.current_meta_description}`
        : null,
      '',
      'Post body (truncated):',
      bodyMd.slice(0, 4000) || '(no body yet — use the title and keyword)',
    ]
      .filter((l) => l !== null)
      .join('\n');

    const raw = await generateCompletion({
      max_tokens: 1200,
      temperature: 0.8,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let arr: unknown;
    try {
      arr = extractJsonArray(raw);
    } catch (err) {
      console.error('blog-meta-suggest parse error', err, raw.slice(0, 300));
      return createCorsResponse(
        { error: 'The model returned an unparseable response. Try again.' },
        502,
        req,
      );
    }

    if (!Array.isArray(arr) || arr.length === 0) {
      return createCorsResponse({ error: 'No variants returned.' }, 502, req);
    }

    const variants = (arr as Record<string, unknown>[]).slice(0, 5).map((v) => {
      const input: MetaVariantInput = {
        title: String(v.title ?? '').slice(0, 300),
        description: String(v.description ?? '').slice(0, 600),
        emotionalValue: Number(v.emotional_value) || 0,
        rationale: String(v.rationale ?? '').slice(0, 300),
      };
      return { ...input, breakdown: scoreMetaVariant(input, keyword) };
    });

    variants.sort((a, b) => b.breakdown.ctrIndex - a.breakdown.ctrIndex);

    return createCorsResponse({ variants }, 200, req);
  } catch (err) {
    console.error('blog-meta-suggest handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
