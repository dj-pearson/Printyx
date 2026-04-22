/**
 * Rep specializations endpoints.
 *
 * Routes:
 *   GET  /specialties         — static reference (knowledge packs metadata)
 *   GET  /specializations     — current user's saved specialties
 *   PUT  /specializations     — bulk replace current user's specialties
 */

import { z } from 'https://esm.sh/zod@3.22.4';
import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { toCamel } from '../../_shared/case.ts';
import {
  listSpecialties,
  OUTREACH_SPECIALTIES,
  SPECIALTY_PACKS,
} from '../specialty-knowledge-packs.ts';
import type { HandlerContext } from '../_types.ts';

/** Public reference — no DB, no auth needed (but we still require auth upstream for consistency). */
export function getSpecialtiesRef(req: Request, hc: HandlerContext): Promise<Response> {
  return Promise.resolve(
    jsonResponse(
      {
        specialties: listSpecialties(),
        packs: SPECIALTY_PACKS,
      },
      200,
      req,
      hc.requestId,
    ),
  );
}

export async function getMine(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;

  const { data, error } = await db
    .from('rep_specializations')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('user_id', ctx.userId)
    .order('weight', { ascending: false });

  if (error) {
    return errorResponse(500, 'Failed to load specializations', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  return jsonResponse({ specializations: toCamel(data ?? []) }, 200, req, requestId);
}

const replaceSchema = z.object({
  specializations: z
    .array(
      z.object({
        specialty: z.enum(OUTREACH_SPECIALTIES as [string, ...string[]]),
        weight: z.number().min(0).max(100),
        experienceYears: z.number().int().min(0).max(60).optional(),
        personalNotes: z.string().optional(),
      }),
    )
    .max(10),
});

export async function replaceMine(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;

  let parsed: z.infer<typeof replaceSchema>;
  try {
    parsed = await validateBody(replaceSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid input', req, {
      code: 'VALIDATION_ERROR',
      details: (err as Error).message,
      requestId,
    });
  }

  // Delete existing specializations for this user
  const del = await db
    .from('rep_specializations')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('user_id', ctx.userId);

  if (del.error) {
    return errorResponse(500, 'Failed to clear existing specializations', req, {
      code: 'DB_ERROR',
      details: del.error,
      requestId,
    });
  }

  if (parsed.specializations.length === 0) {
    return jsonResponse({ specializations: [] }, 200, req, requestId);
  }

  // Insert the replacement set
  const rows = parsed.specializations.map((s) => ({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    specialty: s.specialty,
    weight: s.weight,
    experience_years: s.experienceYears ?? null,
    personal_notes: s.personalNotes ?? null,
  }));

  const ins = await db.from('rep_specializations').insert(rows).select();

  if (ins.error) {
    return errorResponse(500, 'Failed to save specializations', req, {
      code: 'DB_ERROR',
      details: ins.error,
      requestId,
    });
  }

  return jsonResponse({ specializations: toCamel(ins.data ?? []) }, 200, req, requestId);
}
