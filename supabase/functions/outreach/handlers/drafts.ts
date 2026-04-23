/**
 * Outreach drafts endpoints.
 *
 * Routes:
 *   POST   /drafts/generate             — AI-generate + save a draft
 *   GET    /drafts?status=...           — list with prospect hydration
 *   PATCH  /drafts/:id                  — edit
 *   POST   /drafts/:id/mark-sent        — status → 'sent'
 *   POST   /drafts/:id/mark-replied     — status → 'replied' with sentiment
 *   DELETE /drafts/:id                  — delete
 */

import { z } from 'https://esm.sh/zod@3.22.4';
import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { toCamel, toSnakeShallow } from '../../_shared/case.ts';
import {
  generateDraft,
  type BusinessContextRow,
  type OutreachProspectRow,
  type OutreachSequenceRow,
  type OutreachSequenceStepRow,
} from '../_ai.ts';
import type { HandlerContext } from '../_types.ts';

const CHANNELS = ['email', 'linkedin_connect', 'linkedin_message', 'linkedin_inmail'] as const;

// ─── POST /drafts/generate ───────────────────────────────────────────────────

const generateSchema = z.object({
  prospectId: z.string(),
  sequenceId: z.string().optional(),
  stepId: z.string().optional(),
  channel: z.enum(CHANNELS),
  variantCount: z.number().int().min(1).max(6).optional(),
  angleOverride: z.string().optional(),
});

export async function generate(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, log, requestId } = hc;

  let input: z.infer<typeof generateSchema>;
  try {
    input = await validateBody(generateSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid input', req, {
      code: 'VALIDATION_ERROR',
      details: (err as Error).message,
      requestId,
    });
  }

  // Parallel-load prospect, specs, business context
  const [prospectResult, specsResult, userCtxResult] = await Promise.all([
    db
      .from('outreach_prospects')
      .select('*')
      .eq('id', input.prospectId)
      .eq('tenant_id', ctx.tenantId)
      .limit(1)
      .maybeSingle(),
    db
      .from('rep_specializations')
      .select('specialty, weight, personal_notes')
      .eq('tenant_id', ctx.tenantId)
      .eq('user_id', ctx.userId),
    db
      .from('business_contexts')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .eq('user_id', ctx.userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (prospectResult.error) {
    return errorResponse(500, 'Failed to load prospect', req, {
      code: 'DB_ERROR',
      details: prospectResult.error,
      requestId,
    });
  }
  if (!prospectResult.data) {
    return errorResponse(404, 'Prospect not found', req, { code: 'NOT_FOUND', requestId });
  }

  const prospect = toCamel<OutreachProspectRow>(prospectResult.data);
  const specs = (specsResult.data ?? []) as Array<{
    specialty: string;
    weight: number;
    personal_notes: string | null;
  }>;

  let businessContext: BusinessContextRow | null = userCtxResult.data
    ? toCamel<BusinessContextRow>(userCtxResult.data)
    : null;

  if (!businessContext) {
    const tenantCtx = await db
      .from('business_contexts')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .is('user_id', null)
      .limit(1)
      .maybeSingle();
    if (!tenantCtx.error && tenantCtx.data) {
      businessContext = toCamel<BusinessContextRow>(tenantCtx.data);
    }
  }

  // Optional sequence + step
  let sequence: OutreachSequenceRow | undefined;
  let step: OutreachSequenceStepRow | undefined;

  if (input.sequenceId) {
    const seqResult = await db
      .from('outreach_sequences')
      .select('id, name, angle')
      .eq('id', input.sequenceId)
      .eq('tenant_id', ctx.tenantId)
      .limit(1)
      .maybeSingle();
    if (!seqResult.error && seqResult.data) {
      sequence = toCamel<OutreachSequenceRow>(seqResult.data);
    }
  }

  if (input.stepId) {
    const stepResult = await db
      .from('outreach_sequence_steps')
      .select('id, subject_template, body_template')
      .eq('id', input.stepId)
      .eq('tenant_id', ctx.tenantId)
      .limit(1)
      .maybeSingle();
    if (!stepResult.error && stepResult.data) {
      step = toCamel<OutreachSequenceStepRow>(stepResult.data);
    }
  }

  const specialties = specs.map((s) => ({ specialty: s.specialty, weight: s.weight }));
  const repNotes = specs
    .map((s) => s.personal_notes)
    .filter((n): n is string => !!n)
    .join('\n');

  let generated;
  try {
    generated = await generateDraft({
      businessContext,
      specialties,
      repNotes,
      sequence,
      step,
      prospect,
      channel: input.channel,
      variantCount: input.variantCount ?? 3,
    });
  } catch (err) {
    log.error({ err: String(err) }, 'generateDraft failed');
    return errorResponse(502, (err as Error).message || 'AI generation failed', req, {
      code: 'AI_ERROR',
      requestId,
    });
  }

  const insertRow = toSnakeShallow({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    sequenceId: input.sequenceId ?? null,
    stepId: input.stepId ?? null,
    prospectId: prospect.id,
    channel: input.channel,
    subject: generated.subject,
    body: generated.body,
    variants: generated.variants,
    selectedVariantIndex: generated.recommendedVariantIndex ?? 0,
    status: 'draft',
    generationContext: {
      specialtyBlend: specialties,
      angle: sequence?.angle ?? input.angleOverride,
      spamFlags: generated.spamFlags,
      generatedAt: new Date().toISOString(),
    },
  });

  const { data, error } = await db.from('outreach_drafts').insert(insertRow).select().single();

  if (error || !data) {
    return errorResponse(500, 'Failed to save draft', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  return jsonResponse({ draft: toCamel(data) }, 200, req, requestId);
}

// ─── GET /drafts ─────────────────────────────────────────────────────────────

export async function list(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;
  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let query = db
    .from('outreach_drafts')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('user_id', ctx.userId)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (status) query = query.eq('status', status);

  const draftsResult = await query;
  if (draftsResult.error) {
    return errorResponse(500, 'Failed to list drafts', req, {
      code: 'DB_ERROR',
      details: draftsResult.error,
      requestId,
    });
  }

  const drafts = draftsResult.data ?? [];

  // Hydrate prospects
  const prospectIds = Array.from(
    new Set(
      drafts
        .map((d) => (d as { prospect_id: string | null }).prospect_id)
        .filter((id): id is string => !!id),
    ),
  );

  let prospectsById = new Map<string, unknown>();
  if (prospectIds.length > 0) {
    const prospectsResult = await db
      .from('outreach_prospects')
      .select('*')
      .in('id', prospectIds)
      .eq('tenant_id', ctx.tenantId);
    if (!prospectsResult.error && prospectsResult.data) {
      prospectsById = new Map(
        prospectsResult.data.map((p) => [(p as { id: string }).id, toCamel(p)]),
      );
    }
  }

  const hydrated = drafts.map((d) => {
    const camelDraft = toCamel(d) as Record<string, unknown> & { prospectId: string | null };
    return {
      ...camelDraft,
      prospect: camelDraft.prospectId ? (prospectsById.get(camelDraft.prospectId) ?? null) : null,
    };
  });

  return jsonResponse({ drafts: hydrated }, 200, req, requestId);
}

// ─── PATCH /drafts/:id ───────────────────────────────────────────────────────

const patchSchema = z.object({
  subject: z.string().optional(),
  body: z.string().optional(),
  channel: z.enum(CHANNELS).optional(),
  selectedVariantIndex: z.number().int().min(0).optional(),
  variants: z.array(z.any()).optional(),
  status: z.enum(['draft', 'queued', 'sent', 'replied', 'archived']).optional(),
  notes: z.string().optional(),
});

export async function patch(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  let input: z.infer<typeof patchSchema>;
  try {
    input = await validateBody(patchSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid input', req, {
      code: 'VALIDATION_ERROR',
      details: (err as Error).message,
      requestId,
    });
  }

  const update = { ...toSnakeShallow(input), updated_at: new Date().toISOString() };

  const { data, error } = await db
    .from('outreach_drafts')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to update draft', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  if (!data) {
    return errorResponse(404, 'Draft not found', req, { code: 'NOT_FOUND', requestId });
  }

  return jsonResponse({ draft: toCamel(data) }, 200, req, requestId);
}

// ─── POST /drafts/:id/mark-sent ──────────────────────────────────────────────

export async function markSent(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('outreach_drafts')
    .update({ status: 'sent', marked_sent_at: now, updated_at: now })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to mark sent', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  if (!data) {
    return errorResponse(404, 'Draft not found', req, { code: 'NOT_FOUND', requestId });
  }

  return jsonResponse({ draft: toCamel(data) }, 200, req, requestId);
}

// ─── POST /drafts/:id/mark-replied ───────────────────────────────────────────

const markRepliedSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'ooo']).optional(),
  meetingBooked: z.boolean().optional(),
});

export async function markReplied(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  let input: z.infer<typeof markRepliedSchema>;
  try {
    input = await validateBody(markRepliedSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid input', req, {
      code: 'VALIDATION_ERROR',
      details: (err as Error).message,
      requestId,
    });
  }

  const now = new Date().toISOString();
  const update = {
    status: 'replied',
    marked_replied_at: now,
    replied_sentiment: input.sentiment ?? null,
    meeting_booked: input.meetingBooked ?? false,
    updated_at: now,
  };

  const { data, error } = await db
    .from('outreach_drafts')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to mark replied', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  if (!data) {
    return errorResponse(404, 'Draft not found', req, { code: 'NOT_FOUND', requestId });
  }

  return jsonResponse({ draft: toCamel(data) }, 200, req, requestId);
}

// ─── DELETE /drafts/:id ──────────────────────────────────────────────────────

export async function remove(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  const { error } = await db
    .from('outreach_drafts')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  if (error) {
    return errorResponse(500, 'Failed to delete draft', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  return jsonResponse({ ok: true }, 200, req, requestId);
}
