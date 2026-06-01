// Blog AI Draft Generator Edge Function (US-BLOG-031)
//
// Turns an approved brief (+ brand voice + style guide + author persona) into a
// first draft whose factual claims carry inline citation refs — or an honest
// [needs-citation] tag when the model can't ground a claim. Output is
// structured (title, meta_title, meta_description, body markdown, image
// prompts, FAQ block, citations). Per-generation token cost is persisted to
// blog_posts.ai_assistance_meta (the schema's designated cost sink — there is
// no platform-wide ai_costs table; documented mapping).
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST /blog-draft/generate   body: { brief_id }
//        → loads brief + voice/style/persona, generates the full draft,
//          upserts the linked blog_posts row, logs cost, returns { post_id, draft }
//   POST /blog-draft/section    body: { brief_id, h2, existing_markdown? }
//        → regenerates ONE H2 section independently; returns { markdown }
//
// Sections are produced in a single structured call (coherent + cheap). True
// token-streaming to the editor is deferred — the edge proxy is request/
// response, not SSE; documented as a follow-up.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletionDetailed } from '../_shared/anthropic.ts';
import { extractJsonObject, asStringArray } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const generateSchema = z.object({ brief_id: z.string().uuid() });
const sectionSchema = z.object({
  brief_id: z.string().uuid(),
  h2: z.string().min(1).max(300),
  existing_markdown: z.string().max(50_000).optional(),
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
  target_keyword?: string;
  secondary_keywords?: string[];
  search_intent?: string;
  target_audience?: string;
  target_word_count?: number;
  target_reading_level?: string;
  outline?: Array<{ h2: string; h3: string[] }>;
  entities?: string[];
  faqs?: Array<{ q: string; a: string }>;
  sources?: string[];
  originality_angle?: string;
  cta_plan?: string;
}

interface VoiceContext {
  tone: string | null;
  persona: string | null;
  pov: string | null;
  readingLevel: string | null;
  banned: string[];
  preferred: string[];
  styleRules: string | null;
}

async function loadVoice(
  admin: Admin,
  tenantId: string,
  brandVoiceId: string | null,
): Promise<VoiceContext> {
  let voice: Record<string, unknown> | null = null;
  if (brandVoiceId) {
    const { data } = await admin
      .from('blog_brand_voices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', brandVoiceId)
      .is('deleted_at', null)
      .maybeSingle();
    voice = data ?? null;
  }
  if (!voice) {
    const { data } = await admin
      .from('blog_brand_voices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .is('deleted_at', null)
      .maybeSingle();
    voice = data ?? null;
  }
  const { data: style } = await admin
    .from('blog_style_guides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle();

  return {
    tone: (voice?.tone as string) ?? null,
    persona: (voice?.persona_description as string) ?? null,
    pov: (voice?.pov as string) ?? null,
    readingLevel: (voice?.reading_level_target as string) ?? null,
    banned: Array.isArray(voice?.banned_phrases) ? (voice!.banned_phrases as string[]) : [],
    preferred: Array.isArray(voice?.preferred_phrases)
      ? (voice!.preferred_phrases as string[])
      : [],
    styleRules: (style?.rules as string) ?? (style?.description as string) ?? null,
  };
}

function voiceBlock(v: VoiceContext): string {
  const lines: string[] = [];
  if (v.tone) lines.push(`Tone: ${v.tone}`);
  if (v.persona) lines.push(`Author persona: ${v.persona}`);
  if (v.pov) lines.push(`Point of view: ${v.pov}-person`);
  if (v.readingLevel) lines.push(`Reading level target: ${v.readingLevel}`);
  if (v.preferred.length) lines.push(`Prefer phrases: ${v.preferred.join(', ')}`);
  if (v.banned.length) lines.push(`NEVER use these phrases: ${v.banned.join(', ')}`);
  if (v.styleRules) lines.push(`Style guide: ${v.styleRules.slice(0, 1500)}`);
  return lines.length
    ? lines.join('\n')
    : 'No brand voice configured — use a clear, professional B2B tone.';
}

const DRAFT_SYSTEM = `You are an expert B2B content writer. Write a complete first draft from the brief.

HARD RULES:
- Every factual / statistical / quotable claim MUST carry an inline citation ref like [^1], [^2] mapped to the "citations" array.
- If you cannot ground a claim in a credible source, DO NOT invent one — write the claim and append the literal tag [needs-citation]. An honest gap beats a hallucinated source.
- Honor the brand voice, banned/preferred phrases, POV and reading level exactly.
- Lead with the brief's originality angle; don't write a generic me-too post.
- Body must use the brief's H2/H3 outline as ## / ### headings.

Return ONLY a JSON object (no prose, no fences):
{
 "title": string,
 "meta_title": string,            // <=60 chars
 "meta_description": string,      // 140-160 chars
 "body_markdown": string,         // full article with ## H2s, [^n] refs and/or [needs-citation]
 "citations": [{"ref": number, "title": string, "url": string}],
 "suggested_image_prompts": string[],
 "faq_block": [{"q": string, "a": string}]
}`;

function briefPrompt(s: BriefSections): string {
  const outline = (s.outline ?? [])
    .map((o) => `## ${o.h2}${o.h3?.length ? `\n${o.h3.map((h) => `   - ${h}`).join('\n')}` : ''}`)
    .join('\n');
  return [
    `Target keyword: ${s.target_keyword ?? ''}`,
    `Search intent: ${s.search_intent ?? ''}`,
    `Audience: ${s.target_audience ?? ''}`,
    `Target word count: ${s.target_word_count ?? 1500}`,
    `Reading level: ${s.target_reading_level ?? ''}`,
    s.secondary_keywords?.length ? `Secondary keywords: ${s.secondary_keywords.join(', ')}` : '',
    s.entities?.length ? `Entities to cover: ${s.entities.join(', ')}` : '',
    s.sources?.length ? `Suggested sources: ${s.sources.join(' | ')}` : '',
    `Originality angle (LEAD WITH THIS): ${s.originality_angle ?? ''}`,
    `CTA plan: ${s.cta_plan ?? ''}`,
    '',
    'Outline:',
    outline,
  ]
    .filter(Boolean)
    .join('\n');
}

const CRITIC_SYSTEM = `You are a ruthless content editor. Critique the draft against this rubric, scoring each 0-10:
clarity, originality, evidence, voice_match, seo_compliance, factual_grounding, structural_balance.

Return ONLY JSON:
{"scores":{"clarity":n,"originality":n,"evidence":n,"voice_match":n,"seo_compliance":n,"factual_grounding":n,"structural_balance":n},
 "issues":["specific, actionable problem", ...],
 "verdict":"ok" | "revise"}

Return verdict "ok" (and an empty issues array) only when there are NO significant issues. Be strict but do not invent problems.`;

const REVISER_SYSTEM = `You are revising an article to fix a critic's specific issues while preserving its structure, citations ([^n] / [needs-citation]) and brand voice. Output ONLY the full revised body markdown — no JSON, no commentary.`;

interface CritiqueIteration {
  iteration: number;
  scores: Record<string, number>;
  issues: string[];
  verdict: string;
  cost_usd: number;
}

async function nextRevisionNumber(admin: Admin, tenantId: string, postId: string): Promise<number> {
  const { data } = await admin
    .from('blog_post_revisions')
    .select('revision_number')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.revision_number as number | undefined) ?? 0) + 1;
}

async function recordRevision(
  admin: Admin,
  tenantId: string,
  postId: string,
  source: string,
  bodyMarkdown: string,
  title: string,
  diffSummary: string,
  agentRunId: string,
): Promise<void> {
  const revisionNumber = await nextRevisionNumber(admin, tenantId, postId);
  await admin.from('blog_post_revisions').insert({
    post_id: postId,
    tenant_id: tenantId,
    revision_number: revisionNumber,
    title,
    body_markdown: bodyMarkdown,
    revision_source: source,
    diff_summary: diffSummary.slice(0, 2000),
    agent_run_id: agentRunId,
  });
}

/**
 * generator → critic → reviser → critic … (max 3 iterations). Stops early
 * when the critic returns verdict "ok". Every iteration is persisted to
 * blog_post_revisions so the feedback log is visible in Post History.
 */
async function runCritiqueLoop(
  admin: Admin,
  tenantId: string,
  postId: string,
  title: string,
  initialBody: string,
  voiceText: string,
  agentRunId: string,
): Promise<{ body: string; log: CritiqueIteration[]; costUsd: number }> {
  let body = initialBody;
  const log: CritiqueIteration[] = [];
  let costUsd = 0;
  const MAX = 3;

  for (let i = 1; i <= MAX; i++) {
    const critic = await generateCompletionDetailed({
      max_tokens: 1500,
      temperature: 0,
      system: CRITIC_SYSTEM,
      messages: [{ role: 'user', content: body.slice(0, 30_000) }],
    });
    costUsd += critic.usage.costUsd;

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(critic.text);
    } catch {
      break; // unparseable critic — stop the loop rather than spin
    }
    const issues = asStringArray(parsed.issues, 20);
    const verdict = String(parsed.verdict ?? (issues.length ? 'revise' : 'ok'));
    const scores = (parsed.scores ?? {}) as Record<string, number>;
    const iter: CritiqueIteration = {
      iteration: i,
      scores,
      issues,
      verdict,
      cost_usd: Number(critic.usage.costUsd.toFixed(4)),
    };
    log.push(iter);

    if (verdict === 'ok' || issues.length === 0) {
      await recordRevision(
        admin,
        tenantId,
        postId,
        'ai_rewrite',
        body,
        title,
        `Critic iteration ${i}: no significant issues (verdict ok).`,
        agentRunId,
      );
      break;
    }

    const reviser = await generateCompletionDetailed({
      max_tokens: 8000,
      temperature: 0.5,
      system: `${REVISER_SYSTEM}\n\nBRAND VOICE:\n${voiceText}`,
      messages: [
        {
          role: 'user',
          content: `Fix these issues:\n- ${issues.join('\n- ')}\n\nCurrent draft:\n${body.slice(0, 30_000)}`,
        },
      ],
    });
    costUsd += reviser.usage.costUsd;
    body = reviser.text.trim() || body;

    await recordRevision(
      admin,
      tenantId,
      postId,
      'ai_rewrite',
      body,
      title,
      `Critic iteration ${i}: ${issues.length} issue(s) fixed — ${issues.slice(0, 3).join('; ')}`,
      agentRunId,
    );
  }

  return { body, log, costUsd };
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
    const { parts } = normalizePath(url.pathname, 'blog-draft');
    const action = parts[0];

    if (action === 'generate' && req.method === 'POST') {
      return await generateDraft(admin, tenantId, user.id, req);
    }
    if (action === 'section' && req.method === 'POST') {
      return await regenerateSection(admin, tenantId, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-draft handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function loadBriefSections(
  admin: Admin,
  tenantId: string,
  briefId: string,
): Promise<{ brief: Record<string, unknown>; sections: BriefSections } | null> {
  const { data: brief } = await admin
    .from('blog_briefs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', briefId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!brief) return null;
  const sections = ((brief.outline ?? {}) as { sections?: BriefSections }).sections ?? {};
  return { brief, sections };
}

async function generateDraft(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse({ error: 'Validation failed' }, 400, req);
  }

  const loaded = await loadBriefSections(admin, tenantId, parsed.data.brief_id);
  if (!loaded) return createCorsResponse({ error: 'Brief not found' }, 404, req);
  const { brief, sections } = loaded;

  const voice = await loadVoice(admin, tenantId, (brief.brand_voice_id as string) ?? null);

  const { text, usage } = await generateCompletionDetailed({
    max_tokens: 8000,
    temperature: 0.6,
    system: `${DRAFT_SYSTEM}\n\nBRAND VOICE:\n${voiceBlock(voice)}`,
    messages: [{ role: 'user', content: briefPrompt(sections) }],
  });

  let obj: Record<string, unknown>;
  try {
    obj = extractJsonObject(text);
  } catch (err) {
    console.error('blog-draft parse error', err, text.slice(0, 300));
    return createCorsResponse({ error: 'The model returned an unparseable draft.' }, 502, req);
  }

  const title = String(obj.title ?? brief.title ?? 'Untitled').slice(0, 480);
  const bodyMarkdown = String(obj.body_markdown ?? '');
  const needsCitationCount = (bodyMarkdown.match(/\[needs-citation\]/g) || []).length;
  const draft = {
    title,
    meta_title: String(obj.meta_title ?? '').slice(0, 200),
    meta_description: String(obj.meta_description ?? '').slice(0, 500),
    body_markdown: bodyMarkdown,
    citations: Array.isArray(obj.citations) ? obj.citations : [],
    suggested_image_prompts: asStringArray(obj.suggested_image_prompts, 10),
    faq_block: Array.isArray(obj.faq_block) ? obj.faq_block : [],
  };

  const aiMeta = {
    steps_used: ['draft_generator'],
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: Number(usage.costUsd.toFixed(4)),
    generated_at: new Date().toISOString(),
    needs_citation_count: needsCitationCount,
  };

  // Upsert the linked post: reuse the post already linked to this brief, else create one.
  const { data: existingPost } = await admin
    .from('blog_posts')
    .select('id, ai_assistance_meta')
    .eq('tenant_id', tenantId)
    .eq('brief_id', brief.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let postId: string;
  if (existingPost) {
    postId = existingPost.id;
    await admin
      .from('blog_posts')
      .update({
        title: draft.title,
        meta_title: draft.meta_title || null,
        meta_description: draft.meta_description || null,
        body_markdown: draft.body_markdown,
        ai_assistance_meta: aiMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', postId);
  } else {
    const slug =
      title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 180) || `draft-${Date.now()}`;
    const { data: created, error: createErr } = await admin
      .from('blog_posts')
      .insert({
        tenant_id: tenantId,
        brief_id: brief.id,
        title: draft.title,
        slug,
        meta_title: draft.meta_title || null,
        meta_description: draft.meta_description || null,
        body_markdown: draft.body_markdown,
        status: 'draft',
        author_user_id: userId,
        created_by_user_id: userId,
        ai_assistance_meta: aiMeta,
      })
      .select('id')
      .single();
    if (createErr || !created) {
      return createCorsResponse({ error: createErr?.message ?? 'Failed to create post' }, 500, req);
    }
    postId = created.id;
  }

  await admin
    .from('blog_briefs')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', brief.id);

  // US-BLOG-039: optional self-critique loop (per-tenant toggle, costs more).
  let critiqueLog: CritiqueIteration[] = [];
  const { data: settings } = await admin
    .from('blog_agent_settings')
    .select('critique_loop_enabled')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (settings?.critique_loop_enabled) {
    const agentRunId = crypto.randomUUID();
    await recordRevision(
      admin,
      tenantId,
      postId,
      'ai_draft',
      draft.body_markdown,
      draft.title,
      'Initial AI draft (pre-critique).',
      agentRunId,
    );
    const looped = await runCritiqueLoop(
      admin,
      tenantId,
      postId,
      draft.title,
      draft.body_markdown,
      voiceBlock(voice),
      agentRunId,
    );
    critiqueLog = looped.log;
    draft.body_markdown = looped.body;
    aiMeta.steps_used = ['draft_generator', 'critique_loop'];
    aiMeta.cost_usd = Number((aiMeta.cost_usd + looped.costUsd).toFixed(4));
    (aiMeta as Record<string, unknown>).critique_log = critiqueLog;
    (aiMeta as Record<string, unknown>).critique_iterations = critiqueLog.length;
    await admin
      .from('blog_posts')
      .update({
        body_markdown: looped.body,
        ai_assistance_meta: aiMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', postId);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_draft.generate',
      targetType: 'blog_posts',
      targetId: postId,
      summary: `AI draft from brief "${brief.title}" — $${aiMeta.cost_usd}, ${needsCitationCount} needs-citation gap(s)${
        critiqueLog.length ? `, ${critiqueLog.length} critique iteration(s)` : ''
      }`,
    }),
  );

  return createCorsResponse(
    { post_id: postId, draft, ai_meta: aiMeta, critique_log: critiqueLog },
    201,
    req,
  );
}

async function regenerateSection(admin: Admin, tenantId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = sectionSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse({ error: 'Validation failed' }, 400, req);
  }

  const loaded = await loadBriefSections(admin, tenantId, parsed.data.brief_id);
  if (!loaded) return createCorsResponse({ error: 'Brief not found' }, 404, req);
  const { brief, sections } = loaded;
  const voice = await loadVoice(admin, tenantId, (brief.brand_voice_id as string) ?? null);

  const text = (
    await generateCompletionDetailed({
      max_tokens: 2500,
      temperature: 0.6,
      system: `You rewrite a single article section. Same citation rules as a full draft: [^n] refs for claims, [needs-citation] when ungrounded. Output ONLY the markdown for this section starting with its "## " heading. No JSON, no prose around it.\n\nBRAND VOICE:\n${voiceBlock(voice)}`,
      messages: [
        {
          role: 'user',
          content: [
            `Article context — keyword: ${sections.target_keyword ?? ''}; angle: ${sections.originality_angle ?? ''}`,
            `Rewrite ONLY this section: "${parsed.data.h2}"`,
            parsed.data.existing_markdown
              ? `Current version to improve:\n${parsed.data.existing_markdown.slice(0, 8000)}`
              : 'No current version — write it fresh from the outline.',
          ].join('\n'),
        },
      ],
    })
  ).text;

  return createCorsResponse({ markdown: text.trim() }, 200, req);
}
