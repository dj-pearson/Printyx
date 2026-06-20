// Blog Reading-Level & Persona Targeter Edge Function (US-BLOG-026)
//
// Computes Flesch-Kincaid grade level live, scores how well a draft matches its
// brief/brand-voice persona (LLM, 0-100), highlights sentences above the target
// grade, and offers a one-sentence "Simplify" rewrite. The pre-publish gate
// warns when persona match <70 or grade level diverges >2 from target.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST /blog-readability/analyze    body: { post_id? | text, target_grade?, persona?, brand_voice_id? }
//   POST /blog-readability/simplify   body: { sentence, target_grade? }
//
// FK math is pure (../_shared/blog/readability.ts) so the editor gauge is
// deterministic; only the persona-match score and simplify call hit the LLM.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';
import {
  fleschKincaid,
  sentenceReadability,
  parseTargetGrade,
} from '../_shared/blog/readability.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const analyzeSchema = z
  .object({
    post_id: z.string().uuid().optional(),
    text: z.string().max(200_000).optional(),
    target_grade: z.number().min(1).max(20).optional(),
    persona: z.string().max(4000).optional(),
    brand_voice_id: z.string().uuid().optional(),
  })
  .refine((v) => v.post_id || v.text, { message: 'Provide post_id or text' });

const simplifySchema = z.object({
  sentence: z.string().min(1).max(2000),
  target_grade: z.number().min(1).max(20).optional(),
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
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-readability');
    const action = parts[0];

    if (action === 'analyze' && req.method === 'POST') {
      return await analyze(admin, tenantId, req);
    }
    if (action === 'simplify' && req.method === 'POST') {
      return await simplify(req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-readability handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function analyze(admin: Admin, tenantId: string, req: Request) {
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
  const input = parsed.data;

  // Resolve the text + persona + target grade.
  let text = input.text ?? '';
  let persona = input.persona ?? '';
  let targetGrade = input.target_grade ?? null;

  if (input.post_id) {
    const { data: post } = await admin
      .from('blog_posts')
      .select('body_markdown, brand_voice_id, brief_id')
      .eq('tenant_id', tenantId)
      .eq('id', input.post_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
    if (!text) text = post.body_markdown ?? '';
    if (!input.brand_voice_id && post.brand_voice_id) input.brand_voice_id = post.brand_voice_id;
    // Pull persona from the brief if present.
    if (!persona && post.brief_id) {
      const { data: brief } = await admin
        .from('blog_briefs')
        .select('target_audience')
        .eq('tenant_id', tenantId)
        .eq('id', post.brief_id)
        .maybeSingle();
      if (brief?.target_audience) persona = String(brief.target_audience);
    }
  }

  // Pull target grade + persona fallback from the brand voice.
  if (input.brand_voice_id) {
    const { data: bv } = await admin
      .from('blog_brand_voices')
      .select('reading_level_target, persona_description')
      .eq('tenant_id', tenantId)
      .eq('id', input.brand_voice_id)
      .maybeSingle();
    if (bv) {
      if (targetGrade == null) targetGrade = parseTargetGrade(bv.reading_level_target);
      if (!persona && bv.persona_description) persona = String(bv.persona_description);
    }
  }
  const effectiveTarget = targetGrade ?? 8;

  if (!text.trim()) {
    return createCorsResponse({ error: 'No text to analyze' }, 400, req);
  }

  // Pure readability.
  const overall = fleschKincaid(text);
  const sentences = sentenceReadability(text, effectiveTarget);
  const hardCount = sentences.filter((s) => s.level !== 'ok').length;

  // LLM persona match (best-effort — never fails the whole request).
  let personaMatch: number | null = null;
  let personaNotes: string | null = null;
  if (persona.trim()) {
    try {
      const raw = await generateCompletion({
        max_tokens: 400,
        temperature: 0.1,
        system:
          'You rate how well a draft matches a target reader persona on tone, ' +
          'vocabulary, and framing. Respond ONLY with JSON ' +
          '{ "match": 0..100, "notes": "<one sentence>" }.',
        messages: [
          {
            role: 'user',
            content: `PERSONA:\n${persona}\n\nDRAFT (first 4000 chars):\n${text.slice(0, 4000)}`,
          },
        ],
      });
      const obj = extractJsonObject(raw);
      const m = Number(obj.match);
      if (!Number.isNaN(m)) personaMatch = Math.min(Math.max(Math.round(m), 0), 100);
      if (obj.notes) personaNotes = String(obj.notes).slice(0, 500);
    } catch {
      personaNotes = 'Persona scoring unavailable';
    }
  }

  // Pre-publish gate.
  const gradeDivergence = Math.abs(overall.gradeLevel - effectiveTarget);
  const warnings: string[] = [];
  if (personaMatch != null && personaMatch < 70) {
    warnings.push(`Persona match ${personaMatch} < 70`);
  }
  if (gradeDivergence > 2) {
    warnings.push(
      `Grade level ${overall.gradeLevel} diverges ${gradeDivergence.toFixed(1)} from target ${effectiveTarget}`,
    );
  }

  return createCorsResponse(
    {
      target_grade: effectiveTarget,
      overall,
      persona_match: personaMatch,
      persona_notes: personaNotes,
      hard_sentence_count: hardCount,
      sentences,
      gate: { pass: warnings.length === 0, warnings },
    },
    200,
    req,
  );
}

async function simplify(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = simplifySchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const targetGrade = parsed.data.target_grade ?? 8;

  const rewritten = await generateCompletion({
    max_tokens: 400,
    temperature: 0.4,
    system:
      `Rewrite the sentence to a US grade-${targetGrade} reading level. Keep the ` +
      'meaning and any facts/numbers. Return ONLY the rewritten sentence, no quotes.',
    messages: [{ role: 'user', content: parsed.data.sentence }],
  });

  const before = fleschKincaid(parsed.data.sentence);
  const after = fleschKincaid(rewritten.trim());
  return createCorsResponse(
    {
      original: parsed.data.sentence,
      simplified: rewritten.trim(),
      before_grade: before.gradeLevel,
      after_grade: after.gradeLevel,
    },
    200,
    req,
  );
}
