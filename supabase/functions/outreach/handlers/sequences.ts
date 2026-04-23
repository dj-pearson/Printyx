/**
 * Outreach sequences endpoints.
 *
 * Routes:
 *   GET    /sequences                 — list user's sequences
 *   GET    /sequences/:id             — detail + steps
 *   POST   /sequences/generate        — AI-generate + save
 *   PATCH  /sequences/:id             — manual edit
 *   DELETE /sequences/:id             — cascade-delete steps then sequence
 *   PATCH  /sequence-steps/:id        — edit a step, re-run spam linter
 */

import { z } from 'https://esm.sh/zod@3.22.4';
import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { toCamel, toSnakeShallow } from '../../_shared/case.ts';
import { generateSequence, lintForSpam, type BusinessContextRow } from '../_ai.ts';
import type { HandlerContext } from '../_types.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface SpecializationRow {
  specialty: string;
  weight: number;
  personal_notes: string | null;
}

async function loadSpecsAndContext(
  hc: HandlerContext,
): Promise<{ specs: SpecializationRow[]; businessContext: BusinessContextRow | null }> {
  const { ctx, db } = hc;

  const [specsResult, userCtxResult] = await Promise.all([
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

  if (specsResult.error) throw specsResult.error;

  let businessContext = userCtxResult.data
    ? (toCamel(userCtxResult.data) as BusinessContextRow)
    : null;

  if (!businessContext) {
    // Fall back to tenant default (user_id IS NULL)
    const tenantCtx = await db
      .from('business_contexts')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .is('user_id', null)
      .limit(1)
      .maybeSingle();
    if (!tenantCtx.error && tenantCtx.data) {
      businessContext = toCamel(tenantCtx.data) as BusinessContextRow;
    }
  }

  return { specs: (specsResult.data as SpecializationRow[]) ?? [], businessContext };
}

// ─── GET /sequences ──────────────────────────────────────────────────────────

export async function list(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;

  const { data, error } = await db
    .from('outreach_sequences')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('user_id', ctx.userId)
    .order('updated_at', { ascending: false });

  if (error) {
    return errorResponse(500, 'Failed to list sequences', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  return jsonResponse({ sequences: toCamel(data ?? []) }, 200, req, requestId);
}

// ─── GET /sequences/:id ──────────────────────────────────────────────────────

export async function get(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  const seqResult = await db
    .from('outreach_sequences')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .limit(1)
    .maybeSingle();

  if (seqResult.error) {
    return errorResponse(500, 'Failed to load sequence', req, {
      code: 'DB_ERROR',
      details: seqResult.error,
      requestId,
    });
  }
  if (!seqResult.data) {
    return errorResponse(404, 'Sequence not found', req, { code: 'NOT_FOUND', requestId });
  }

  const stepsResult = await db
    .from('outreach_sequence_steps')
    .select('*')
    .eq('sequence_id', id)
    .order('step_order', { ascending: true });

  if (stepsResult.error) {
    return errorResponse(500, 'Failed to load sequence steps', req, {
      code: 'DB_ERROR',
      details: stepsResult.error,
      requestId,
    });
  }

  return jsonResponse(
    {
      sequence: toCamel(seqResult.data),
      steps: toCamel(stepsResult.data ?? []),
    },
    200,
    req,
    requestId,
  );
}

// ─── POST /sequences/generate ────────────────────────────────────────────────

const generateSchema = z.object({
  angle: z.string().min(3),
  name: z.string().optional(),
  includeEmail: z.boolean().default(true),
  includeLinkedin: z.boolean().default(false),
  isDreamAccountOnly: z.boolean().default(false),
  targetSpecialty: z.string().optional(),
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

  const { specs, businessContext } = await loadSpecsAndContext(hc);

  const specialties = input.targetSpecialty
    ? [{ specialty: input.targetSpecialty, weight: 100 }]
    : specs.map((s) => ({ specialty: s.specialty, weight: s.weight }));

  const repNotes = specs
    .map((s) => s.personal_notes)
    .filter((n): n is string => !!n)
    .join('\n');

  let generated;
  try {
    generated = await generateSequence({
      businessContext,
      specialties,
      repNotes,
      angle: input.angle,
      includeEmail: input.includeEmail,
      includeLinkedin: input.includeLinkedin,
      sequenceName: input.name,
    });
  } catch (err) {
    log.error({ err: String(err) }, 'generateSequence failed');
    return errorResponse(502, (err as Error).message || 'AI generation failed', req, {
      code: 'AI_ERROR',
      requestId,
    });
  }

  const insertSeq = await db
    .from('outreach_sequences')
    .insert(
      toSnakeShallow({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        name: input.name || generated.name,
        description: generated.description,
        angle: input.angle,
        targetSpecialty: input.targetSpecialty || generated.targetSpecialty,
        includesEmail: input.includeEmail,
        includesLinkedin: input.includeLinkedin,
        isDreamAccountOnly: input.isDreamAccountOnly,
        generationContext: {
          specialtyBlend: specialties,
          generatedAt: new Date().toISOString(),
        },
      }),
    )
    .select()
    .single();

  if (insertSeq.error || !insertSeq.data) {
    return errorResponse(500, 'Failed to save sequence', req, {
      code: 'DB_ERROR',
      details: insertSeq.error,
      requestId,
    });
  }

  const savedSeq = insertSeq.data as { id: string };
  let savedSteps: unknown[] = [];

  if (generated.steps.length > 0) {
    const stepRows = generated.steps.map((s) =>
      toSnakeShallow({
        tenantId: ctx.tenantId,
        sequenceId: savedSeq.id,
        stepOrder: s.stepOrder,
        channel: s.channel,
        dayOffset: s.dayOffset,
        subjectTemplate: s.subjectTemplate,
        bodyTemplate: s.bodyTemplate,
        variants: s.variants,
        spamFlags: s.spamFlags,
        notes: s.rationale,
      }),
    );
    const insertSteps = await db.from('outreach_sequence_steps').insert(stepRows).select();
    if (insertSteps.error) {
      log.warn(
        { err: insertSteps.error },
        'Failed to save sequence steps — sequence saved without steps',
      );
    } else {
      savedSteps = insertSteps.data ?? [];
    }
  }

  return jsonResponse(
    {
      sequence: toCamel(insertSeq.data),
      steps: toCamel(savedSteps),
    },
    200,
    req,
    requestId,
  );
}

// ─── PATCH /sequences/:id ────────────────────────────────────────────────────

const patchSequenceSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  angle: z.string().optional(),
  targetSpecialty: z.string().optional(),
  includesEmail: z.boolean().optional(),
  includesLinkedin: z.boolean().optional(),
  isDreamAccountOnly: z.boolean().optional(),
});

export async function patch(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  let input: z.infer<typeof patchSequenceSchema>;
  try {
    input = await validateBody(patchSequenceSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid input', req, {
      code: 'VALIDATION_ERROR',
      details: (err as Error).message,
      requestId,
    });
  }

  const update = { ...toSnakeShallow(input), updated_at: new Date().toISOString() };

  const { data, error } = await db
    .from('outreach_sequences')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to update sequence', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  if (!data) {
    return errorResponse(404, 'Sequence not found', req, { code: 'NOT_FOUND', requestId });
  }

  return jsonResponse({ sequence: toCamel(data) }, 200, req, requestId);
}

// ─── DELETE /sequences/:id ───────────────────────────────────────────────────

export async function remove(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  // Verify ownership + tenant
  const seqResult = await db
    .from('outreach_sequences')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .limit(1)
    .maybeSingle();

  if (seqResult.error) {
    return errorResponse(500, 'Failed to load sequence', req, {
      code: 'DB_ERROR',
      details: seqResult.error,
      requestId,
    });
  }
  if (!seqResult.data) {
    return errorResponse(404, 'Sequence not found', req, { code: 'NOT_FOUND', requestId });
  }

  // Cascade-delete steps manually (no FK constraint in schema)
  const delSteps = await db.from('outreach_sequence_steps').delete().eq('sequence_id', id);
  if (delSteps.error) {
    return errorResponse(500, 'Failed to delete sequence steps', req, {
      code: 'DB_ERROR',
      details: delSteps.error,
      requestId,
    });
  }

  const delSeq = await db
    .from('outreach_sequences')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);
  if (delSeq.error) {
    return errorResponse(500, 'Failed to delete sequence', req, {
      code: 'DB_ERROR',
      details: delSeq.error,
      requestId,
    });
  }

  return jsonResponse({ ok: true }, 200, req, requestId);
}

// ─── PATCH /sequence-steps/:id ───────────────────────────────────────────────

const patchStepSchema = z.object({
  stepOrder: z.number().int().optional(),
  channel: z.enum(['email', 'linkedin_connect', 'linkedin_message', 'linkedin_inmail']).optional(),
  dayOffset: z.number().int().optional(),
  subjectTemplate: z.string().optional(),
  bodyTemplate: z.string().optional(),
  variants: z.array(z.any()).optional(),
  notes: z.string().optional(),
});

export async function patchStep(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  let input: z.infer<typeof patchStepSchema>;
  try {
    input = await validateBody(patchStepSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid input', req, {
      code: 'VALIDATION_ERROR',
      details: (err as Error).message,
      requestId,
    });
  }

  const update = { ...toSnakeShallow(input), updated_at: new Date().toISOString() };

  const { data, error } = await db
    .from('outreach_sequence_steps')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to update sequence step', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  if (!data) {
    return errorResponse(404, 'Sequence step not found', req, { code: 'NOT_FOUND', requestId });
  }

  // Re-lint on content edit
  if (input.subjectTemplate !== undefined || input.bodyTemplate !== undefined) {
    const row = data as { subject_template?: string | null; body_template?: string };
    const flags = lintForSpam(`${row.subject_template || ''} ${row.body_template || ''}`);
    const relint = await db
      .from('outreach_sequence_steps')
      .update({ spam_flags: flags })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (!relint.error && relint.data) {
      return jsonResponse({ step: toCamel(relint.data) }, 200, req, requestId);
    }
  }

  return jsonResponse({ step: toCamel(data) }, 200, req, requestId);
}
