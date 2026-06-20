// Blog Multi-Agent Draft Pipeline Edge Function (US-BLOG-073)
//
// Chains six specialist stages — researcher → outliner → drafter →
// fact_checker → critic → polisher — into a near-final draft. Each stage's
// input + output is stored as an artifact (blog_pipeline_stages) so the chain
// is never an opaque black box. Cost + latency are logged per stage and
// mirrored to blog_ai_costs (US-BLOG-078). Any stage failure halts the run
// with an explanation; /resume picks up from the first incomplete stage.
//
// Agent entry point: honors the global kill switch (assertAgentsActive) and
// the per-workspace AI quota (getQuotaStatus) before spending tokens.
//
// Routes (tenant-scoped, gated to platform admin OR blog.post.edit):
//   POST /blog-pipeline/run     body: { topic, target_keyword?, brief_id?, brand_voice_id?,
//                                       stages?: {researcher,outliner,drafter,fact_checker,critic,polisher},
//                                       post_id? }
//                               Runs the enabled stages synchronously. Returns run + stage artifacts.
//   POST /blog-pipeline/resume  body: { run_id }   Re-runs from the first incomplete stage.
//   GET  /blog-pipeline/:id     Fetch a run with its ordered stage artifacts.
//   GET  /blog-pipeline         List recent runs (?status=&limit=).
//   GET  /blog-pipeline/config  Per-workspace default stage toggles.
//   PUT  /blog-pipeline/config  body: { stages: {...} }   (platform admin OR blog.agent.toggle)

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { assertAgentsActive } from '../_shared/blog/safety/kill-switch.ts';
import { generateCompletionDetailed } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';
import { logAiCost, getQuotaStatus, usdToCents } from '../_shared/blog/ai-cost.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const STAGE_ORDER = [
  'researcher',
  'outliner',
  'drafter',
  'fact_checker',
  'critic',
  'polisher',
] as const;
type Stage = (typeof STAGE_ORDER)[number];

// drafter is mandatory — a pipeline that doesn't write a draft is pointless.
const MANDATORY: Stage[] = ['drafter'];

const stagesToggleSchema = z
  .object({
    researcher: z.boolean(),
    outliner: z.boolean(),
    drafter: z.boolean(),
    fact_checker: z.boolean(),
    critic: z.boolean(),
    polisher: z.boolean(),
  })
  .partial();

const runSchema = z.object({
  topic: z.string().min(3).max(500),
  target_keyword: z.string().max(500).optional(),
  brief_id: z.string().uuid().optional(),
  brand_voice_id: z.string().uuid().optional(),
  post_id: z.string().uuid().optional(),
  stages: stagesToggleSchema.optional(),
});

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function canToggle(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.agent.toggle')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin';
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
    const { parts } = normalizePath(url.pathname, 'blog-pipeline');
    const action = parts[0];

    if (action === 'run' && req.method === 'POST') {
      return await startRun(admin, tenantId, user, req);
    }
    if (action === 'resume' && req.method === 'POST') {
      return await resumeRun(admin, tenantId, user, req);
    }
    if (action === 'config' && req.method === 'GET') {
      return await getConfig(admin, tenantId, req);
    }
    if (action === 'config' && req.method === 'PUT') {
      if (!canToggle(user)) {
        return createCorsResponse({ error: 'Forbidden: blog.agent.toggle required' }, 403, req);
      }
      return await putConfig(admin, tenantId, user.id, req);
    }
    if (!action && req.method === 'GET') {
      return await listRuns(admin, tenantId, url, req);
    }
    if (action && req.method === 'GET') {
      return await getRun(admin, tenantId, action, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-pipeline handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── config ───────────────────────────────────────────────────────────────
function defaultStages(): Record<Stage, boolean> {
  return {
    researcher: true,
    outliner: true,
    drafter: true,
    fact_checker: true,
    critic: true,
    polisher: true,
  };
}

function resolveStages(
  requested: Partial<Record<Stage, boolean>> | undefined,
  workspaceDefault: Partial<Record<Stage, boolean>> | null,
): Record<Stage, boolean> {
  const merged = { ...defaultStages(), ...(workspaceDefault ?? {}), ...(requested ?? {}) };
  for (const s of MANDATORY) merged[s] = true;
  return merged;
}

async function getWorkspaceStageConfig(
  admin: Admin,
  tenantId: string,
): Promise<Partial<Record<Stage, boolean>> | null> {
  const { data } = await admin
    .from('blog_agent_settings')
    .select('pipeline_stages_config')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return (data?.pipeline_stages_config as Partial<Record<Stage, boolean>>) ?? null;
}

async function getConfig(admin: Admin, tenantId: string, req: Request) {
  const cfg = await getWorkspaceStageConfig(admin, tenantId);
  return createCorsResponse({ stages: resolveStages(undefined, cfg), raw: cfg }, 200, req);
}

async function putConfig(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = z.object({ stages: stagesToggleSchema }).safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  // Ensure a settings row exists, then patch the config column.
  await admin.from('blog_agent_settings').upsert({ tenant_id: tenantId }, { onConflict: 'tenant_id' });
  const { error } = await admin
    .from('blog_agent_settings')
    .update({ pipeline_stages_config: parsed.data.stages, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_pipeline.config.update',
      targetType: 'blog_agent_settings',
      targetId: null,
      afterState: parsed.data.stages,
      summary: 'Updated multi-agent pipeline stage toggles',
    }),
  );
  const cfg = await getWorkspaceStageConfig(admin, tenantId);
  return createCorsResponse({ stages: resolveStages(undefined, cfg), raw: cfg }, 200, req);
}

// ─── run ────────────────────────────────────────────────────────────────────
async function startRun(
  admin: Admin,
  tenantId: string,
  user: { id: string; app_metadata?: Record<string, unknown> },
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const input = parsed.data;

  // Kill switch.
  const settings = await assertAgentsActive(admin, tenantId, 'draft_pipeline');
  if (!settings) {
    return createCorsResponse({ error: 'agents_paused' }, 423, req);
  }

  const wsCfg = await getWorkspaceStageConfig(admin, tenantId);
  const stages = resolveStages(input.stages, wsCfg);

  const agentRunId = crypto.randomUUID();
  const { data: run, error } = await admin
    .from('blog_pipeline_runs')
    .insert({
      tenant_id: tenantId,
      brief_id: input.brief_id ?? null,
      post_id: input.post_id ?? null,
      topic: input.topic,
      target_keyword: input.target_keyword ?? null,
      brand_voice_id: input.brand_voice_id ?? null,
      stages_config: stages,
      status: 'running',
      agent_run_id: agentRunId,
      started_at: new Date().toISOString(),
      created_by_user_id: user.id,
    })
    .select('*')
    .single();
  if (error || !run) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create run' }, 500, req);
  }

  // Pre-create stage rows (pending/skipped) so the artifact list is complete up front.
  const stageRows = STAGE_ORDER.map((s, i) => ({
    run_id: run.id,
    tenant_id: tenantId,
    stage: s,
    seq: i,
    status: stages[s] ? 'pending' : 'skipped',
  }));
  await admin.from('blog_pipeline_stages').insert(stageRows);

  return await executePipeline(admin, tenantId, user.id, run.id, req);
}

async function resumeRun(
  admin: Admin,
  tenantId: string,
  user: { id: string },
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = z.object({ run_id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return createCorsResponse({ error: 'run_id (uuid) required' }, 400, req);
  }

  const settings = await assertAgentsActive(admin, tenantId, 'draft_pipeline');
  if (!settings) return createCorsResponse({ error: 'agents_paused' }, 423, req);

  const { data: run } = await admin
    .from('blog_pipeline_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.run_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!run) return createCorsResponse({ error: 'Run not found' }, 404, req);
  if (run.status === 'completed') {
    return createCorsResponse({ error: 'Run already completed', run }, 409, req);
  }

  await admin
    .from('blog_pipeline_runs')
    .update({ status: 'running', error: null, updated_at: new Date().toISOString() })
    .eq('id', run.id);
  // Reset any failed stage back to pending so it re-runs.
  await admin
    .from('blog_pipeline_stages')
    .update({ status: 'pending', error: null })
    .eq('run_id', run.id)
    .eq('status', 'failed');

  return await executePipeline(admin, tenantId, user.id, run.id, req);
}

// ─── pipeline executor ────────────────────────────────────────────────────────
interface StageRow {
  id: string;
  stage: Stage;
  seq: number;
  status: string;
  output: Record<string, unknown> | null;
}

async function executePipeline(
  admin: Admin,
  tenantId: string,
  userId: string,
  runId: string,
  req: Request,
) {
  const { data: run } = await admin
    .from('blog_pipeline_runs')
    .select('*')
    .eq('id', runId)
    .single();
  if (!run) return createCorsResponse({ error: 'Run vanished' }, 500, req);

  const brandVoice = run.brand_voice_id
    ? await fetchBrandVoiceBlock(admin, tenantId, run.brand_voice_id)
    : '';

  // Load completed stage outputs (for resume) into the context bag.
  const { data: stageRowsData } = await admin
    .from('blog_pipeline_stages')
    .select('id, stage, seq, status, output')
    .eq('run_id', runId)
    .order('seq', { ascending: true });
  const stageRows = (stageRowsData ?? []) as StageRow[];

  const ctx: Record<string, unknown> = { topic: run.topic, target_keyword: run.target_keyword };
  for (const sr of stageRows) {
    if (sr.status === 'completed' && sr.output) ctx[sr.stage] = sr.output;
  }

  let totalCost = run.total_cost_cents ?? 0;
  let totalLatency = run.total_latency_ms ?? 0;

  for (const sr of stageRows) {
    if (sr.status === 'completed' || sr.status === 'skipped') continue;

    // Quota gate before spending tokens on this stage.
    const quota = await getQuotaStatus(admin, tenantId);
    if (quota.blocked) {
      await haltRun(admin, runId, sr.stage, 'AI monthly quota exceeded (hard stop engaged)');
      return await respondRun(admin, runId, req, 200);
    }

    await admin
      .from('blog_pipeline_stages')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', sr.id);
    await admin
      .from('blog_pipeline_runs')
      .update({ current_stage: sr.stage, updated_at: new Date().toISOString() })
      .eq('id', runId);

    const t0 = Date.now();
    let result: { output: Record<string, unknown>; costCents: number; promptTokens: number; completionTokens: number; model: string };
    try {
      result = await runStage(sr.stage, ctx, brandVoice);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stage error';
      await admin
        .from('blog_pipeline_stages')
        .update({ status: 'failed', error: message, latency_ms: Date.now() - t0 })
        .eq('id', sr.id);
      await haltRun(admin, runId, sr.stage, message, 'failed');
      await writeAuditLog(
        admin,
        withRequestContext(req, {
          tenantId,
          actorUserId: null,
          actorType: 'agent',
          agentKind: 'draft_pipeline',
          action: 'blog_pipeline.stage.failed',
          targetType: 'blog_pipeline_run',
          targetId: runId,
          afterState: { stage: sr.stage, error: message },
          summary: `Pipeline halted at ${sr.stage}: ${message}`,
        }),
      );
      return await respondRun(admin, runId, req, 200);
    }

    const latency = Date.now() - t0;
    totalCost += result.costCents;
    totalLatency += latency;
    ctx[sr.stage] = result.output;

    await admin
      .from('blog_pipeline_stages')
      .update({
        status: 'completed',
        output: result.output,
        model: result.model,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        cost_cents: result.costCents,
        latency_ms: latency,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sr.id);

    await logAiCost(admin, {
      tenantId,
      provider: 'anthropic',
      model: result.model,
      feature: `pipeline.${sr.stage}`,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costCents: result.costCents,
      pipelineRunId: runId,
      postId: run.post_id ?? null,
      userId,
    });

    await admin
      .from('blog_pipeline_runs')
      .update({
        total_cost_cents: totalCost,
        total_latency_ms: totalLatency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }

  // All enabled stages done → materialize the draft into a post.
  const finalBody = pickFinalBody(ctx);
  const finalTitle = pickTitle(ctx, run.topic);
  let postId = run.post_id as string | null;
  if (finalBody) {
    postId = await upsertDraftPost(admin, tenantId, userId, {
      postId,
      title: finalTitle,
      bodyMarkdown: finalBody,
      briefId: run.brief_id,
      brandVoiceId: run.brand_voice_id,
    });
  }

  await admin
    .from('blog_pipeline_runs')
    .update({
      status: 'completed',
      current_stage: null,
      post_id: postId,
      total_cost_cents: totalCost,
      total_latency_ms: totalLatency,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: null,
      actorType: 'agent',
      agentKind: 'draft_pipeline',
      action: 'blog_pipeline.completed',
      targetType: 'blog_pipeline_run',
      targetId: runId,
      afterState: { post_id: postId, total_cost_cents: totalCost, total_latency_ms: totalLatency },
      summary: `Pipeline completed for "${run.topic}" (${totalCost}¢, ${totalLatency}ms)`,
    }),
  );

  return await respondRun(admin, runId, req, 200);
}

async function haltRun(
  admin: Admin,
  runId: string,
  stage: string,
  message: string,
  status: 'halted' | 'failed' = 'halted',
) {
  await admin
    .from('blog_pipeline_runs')
    .update({
      status,
      current_stage: stage,
      error: { stage, message },
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

async function respondRun(admin: Admin, runId: string, req: Request, code: number) {
  const { data: run } = await admin.from('blog_pipeline_runs').select('*').eq('id', runId).single();
  const { data: stages } = await admin
    .from('blog_pipeline_stages')
    .select('*')
    .eq('run_id', runId)
    .order('seq', { ascending: true });
  return createCorsResponse({ run, stages: stages ?? [] }, code, req);
}

// ─── stage runners ────────────────────────────────────────────────────────────
async function runStage(
  stage: Stage,
  ctx: Record<string, unknown>,
  brandVoice: string,
): Promise<{
  output: Record<string, unknown>;
  costCents: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
}> {
  const { system, prompt, maxTokens, temperature } = buildStagePrompt(stage, ctx, brandVoice);
  const res = await generateCompletionDetailed({
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  const output = parseStageOutput(stage, res.text);
  return {
    output,
    costCents: usdToCents(res.usage.costUsd),
    promptTokens: res.usage.inputTokens,
    completionTokens: res.usage.outputTokens,
    model: 'anthropic',
  };
}

function buildStagePrompt(
  stage: Stage,
  ctx: Record<string, unknown>,
  brandVoice: string,
): { system: string; prompt: string; maxTokens: number; temperature: number } {
  const topic = String(ctx.topic ?? '');
  const keyword = ctx.target_keyword ? String(ctx.target_keyword) : topic;
  const research = JSON.stringify(ctx.researcher ?? {}, null, 0).slice(0, 6000);
  const outline = JSON.stringify(ctx.outliner ?? {}, null, 0).slice(0, 4000);
  const draft = pickFinalBody(ctx) ?? '';

  switch (stage) {
    case 'researcher':
      return {
        system:
          'You are a meticulous research analyst. Gather what a writer needs to write an authoritative, accurate article. Output strict JSON.',
        prompt: `Topic: "${topic}"\nTarget keyword: "${keyword}"\n\nReturn JSON: {"summary": string, "key_points": string[], "entities": string[], "questions_to_answer": string[], "suggested_sources": [{"claim": string, "needs_verification": boolean}], "angles": string[]}. Be specific and avoid fabricating statistics.`,
        maxTokens: 2000,
        temperature: 0.4,
      };
    case 'outliner':
      return {
        system:
          'You are an SEO content strategist. Turn research into a logical, search-intent-aligned outline. Output strict JSON.',
        prompt: `Topic: "${topic}"\nTarget keyword: "${keyword}"\nResearch: ${research}\n\nReturn JSON: {"title": string, "search_intent": "informational"|"commercial"|"transactional"|"navigational", "target_word_count": number, "outline": [{"h2": string, "h3": string[], "intent": string}], "internal_link_ideas": string[]}.`,
        maxTokens: 2000,
        temperature: 0.5,
      };
    case 'drafter':
      return {
        system: `You are an expert long-form writer. Write a complete, publish-quality article in Markdown that follows the outline exactly. Use only facts present in the research; never invent statistics or quotes.${brandVoice ? `\n\nBRAND VOICE:\n${brandVoice}` : ''}`,
        prompt: `Topic: "${topic}"\nResearch: ${research}\nOutline: ${outline}\n\nReturn JSON: {"title": string, "body_markdown": string, "word_count": number}. body_markdown must be the full article.`,
        maxTokens: 8000,
        temperature: 0.6,
      };
    case 'fact_checker':
      return {
        system:
          'You are a rigorous fact-checker. Identify factual claims in the draft and assess each. Output strict JSON. Do not rewrite the draft.',
        prompt: `Draft:\n${draft.slice(0, 12000)}\n\nReturn JSON: {"claims": [{"text": string, "verdict": "supported"|"unsupported"|"uncertain", "note": string}], "flagged_count": number, "overall_risk": "low"|"medium"|"high"}.`,
        maxTokens: 2500,
        temperature: 0,
      };
    case 'critic':
      return {
        system:
          'You are a demanding editor. Critique the draft against a rubric. Output strict JSON. Do not rewrite the draft.',
        prompt: `Draft:\n${draft.slice(0, 12000)}\n\nReturn JSON: {"scores": {"clarity": number, "depth": number, "originality": number, "seo": number, "voice": number}, "overall": number, "issues": [{"severity": "low"|"medium"|"high", "note": string}], "must_fix": string[]}. Scores are 0-10.`,
        maxTokens: 2000,
        temperature: 0.3,
      };
    case 'polisher': {
      const factOut = JSON.stringify(ctx.fact_checker ?? {}, null, 0).slice(0, 3000);
      const critOut = JSON.stringify(ctx.critic ?? {}, null, 0).slice(0, 3000);
      return {
        system: `You are a final-pass editor. Apply the fact-check flags and critic feedback to produce a clean, publish-ready Markdown article. Remove or hedge unsupported claims. Preserve correct facts and structure.${brandVoice ? `\n\nBRAND VOICE:\n${brandVoice}` : ''}`,
        prompt: `Current draft:\n${draft.slice(0, 12000)}\n\nFact-check: ${factOut}\nCritique: ${critOut}\n\nReturn JSON: {"title": string, "body_markdown": string, "changes_summary": string}.`,
        maxTokens: 8000,
        temperature: 0.4,
      };
    }
  }
}

function parseStageOutput(stage: Stage, text: string): Record<string, unknown> {
  try {
    return extractJsonObject(text);
  } catch (err) {
    // Drafter/polisher: if JSON parsing fails, salvage the raw text as the body
    // so a malformed-JSON response doesn't waste the whole run.
    if (stage === 'drafter' || stage === 'polisher') {
      return { body_markdown: text, _parse_fallback: true };
    }
    throw new Error(
      `${stage} produced unparseable output: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }
}

function pickFinalBody(ctx: Record<string, unknown>): string | null {
  for (const stage of ['polisher', 'drafter'] as const) {
    const out = ctx[stage] as Record<string, unknown> | undefined;
    const body = out?.body_markdown;
    if (typeof body === 'string' && body.trim()) return body;
  }
  return null;
}

function pickTitle(ctx: Record<string, unknown>, fallback: string): string {
  for (const stage of ['polisher', 'drafter', 'outliner'] as const) {
    const out = ctx[stage] as Record<string, unknown> | undefined;
    const title = out?.title;
    if (typeof title === 'string' && title.trim()) return title.slice(0, 480);
  }
  return fallback.slice(0, 480);
}

// ─── helpers ─────────────────────────────────────────────────────────────────
async function fetchBrandVoiceBlock(
  admin: Admin,
  tenantId: string,
  brandVoiceId: string,
): Promise<string> {
  const { data } = await admin
    .from('blog_brand_voices')
    .select('name, tone, persona_description, preferred_phrases, banned_phrases, pov')
    .eq('tenant_id', tenantId)
    .eq('id', brandVoiceId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return '';
  const parts: string[] = [];
  if (data.name) parts.push(`Name: ${data.name}`);
  if (data.tone) parts.push(`Tone: ${data.tone}`);
  if (data.persona_description) parts.push(`Persona: ${data.persona_description}`);
  if (data.pov) parts.push(`Point of view: ${data.pov}`);
  if (Array.isArray(data.preferred_phrases) && data.preferred_phrases.length) {
    parts.push(`Prefer: ${data.preferred_phrases.slice(0, 20).join(', ')}`);
  }
  if (Array.isArray(data.banned_phrases) && data.banned_phrases.length) {
    parts.push(`Avoid: ${data.banned_phrases.slice(0, 20).join(', ')}`);
  }
  return parts.join('\n');
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function upsertDraftPost(
  admin: Admin,
  tenantId: string,
  userId: string,
  d: {
    postId: string | null;
    title: string;
    bodyMarkdown: string;
    briefId: string | null;
    brandVoiceId: string | null;
  },
): Promise<string> {
  if (d.postId) {
    await admin
      .from('blog_posts')
      .update({
        title: d.title,
        body_markdown: d.bodyMarkdown,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', d.postId);
    return d.postId;
  }
  const { data: created } = await admin
    .from('blog_posts')
    .insert({
      tenant_id: tenantId,
      title: d.title,
      slug: `${slugify(d.title) || 'draft'}-${Date.now().toString(36)}`,
      body_markdown: d.bodyMarkdown,
      status: 'draft',
      brief_id: d.briefId,
      brand_voice_id: d.brandVoiceId,
      author_user_id: userId,
      created_by_user_id: userId,
    })
    .select('id')
    .single();
  return created?.id ?? d.postId ?? '';
}

// ─── read endpoints ────────────────────────────────────────────────────────────
async function getRun(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data: run } = await admin
    .from('blog_pipeline_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!run) return createCorsResponse({ error: 'Run not found' }, 404, req);
  const { data: stages } = await admin
    .from('blog_pipeline_stages')
    .select('*')
    .eq('run_id', id)
    .order('seq', { ascending: true });
  return createCorsResponse({ run, stages: stages ?? [] }, 200, req);
}

async function listRuns(admin: Admin, tenantId: string, url: URL, req: Request) {
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  let q = admin
    .from('blog_pipeline_runs')
    .select('id, topic, target_keyword, status, current_stage, total_cost_cents, total_latency_ms, post_id, created_at, completed_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ runs: data ?? [] }, 200, req);
}
