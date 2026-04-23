/**
 * Outreach prospects (staging) endpoints.
 *
 * Routes:
 *   GET    /prospects        — list (200 most recent per user)
 *   POST   /prospects        — create
 *   PATCH  /prospects/:id    — update
 *   DELETE /prospects/:id    — delete
 */

import { z } from 'https://esm.sh/zod@3.22.4';
import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { toCamel, toSnakeShallow } from '../../_shared/case.ts';
import type { HandlerContext } from '../_types.ts';

// ─── Schema ──────────────────────────────────────────────────────────────────

const prospectFields = {
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  companyName: z.string().optional(),
  companyWebsite: z.string().url().optional().nullable(),
  industry: z.string().optional(),
  employeeCount: z.number().int().min(0).optional().nullable(),
  city: z.string().optional(),
  state: z.string().optional(),
  triggerSignal: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  dreamAccount: z.boolean().optional(),
};

const createSchema = z.object(prospectFields);
const patchSchema = z.object(prospectFields).partial();

// ─── GET /prospects ──────────────────────────────────────────────────────────

export async function list(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;

  const { data, error } = await db
    .from('outreach_prospects')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('user_id', ctx.userId)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    return errorResponse(500, 'Failed to list prospects', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  return jsonResponse({ prospects: toCamel(data ?? []) }, 200, req, requestId);
}

// ─── POST /prospects ─────────────────────────────────────────────────────────

export async function create(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;

  let input: z.infer<typeof createSchema>;
  try {
    input = await validateBody(createSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid input', req, {
      code: 'VALIDATION_ERROR',
      details: (err as Error).message,
      requestId,
    });
  }

  const row = {
    ...toSnakeShallow(input),
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
  };

  const { data, error } = await db.from('outreach_prospects').insert(row).select().single();

  if (error || !data) {
    return errorResponse(500, 'Failed to save prospect', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  return jsonResponse({ prospect: toCamel(data) }, 200, req, requestId);
}

// ─── PATCH /prospects/:id ────────────────────────────────────────────────────

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
    .from('outreach_prospects')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to update prospect', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  if (!data) {
    return errorResponse(404, 'Prospect not found', req, { code: 'NOT_FOUND', requestId });
  }

  return jsonResponse({ prospect: toCamel(data) }, 200, req, requestId);
}

// ─── DELETE /prospects/:id ───────────────────────────────────────────────────

export async function remove(req: Request, hc: HandlerContext, id: string): Promise<Response> {
  const { ctx, db, requestId } = hc;

  const { error } = await db
    .from('outreach_prospects')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  if (error) {
    return errorResponse(500, 'Failed to delete prospect', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  return jsonResponse({ ok: true }, 200, req, requestId);
}
