/**
 * Business context endpoints.
 *
 * Routes:
 *   GET  /business-context           — effective (user override or tenant default)
 *   GET  /business-context/all       — both tenant + user rows for this tenant
 *   PUT  /business-context           — upsert with scope='tenant'|'user'
 */

import { z } from 'https://esm.sh/zod@3.22.4';
import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { toCamel, toSnakeShallow } from '../../_shared/case.ts';
import type { HandlerContext } from '../_types.ts';

export async function getEffective(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;

  // Try user override first
  const userRow = await db
    .from('business_contexts')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('user_id', ctx.userId)
    .limit(1)
    .maybeSingle();

  if (userRow.error) {
    return errorResponse(500, 'Failed to load user business context', req, {
      code: 'DB_ERROR',
      details: userRow.error,
      requestId,
    });
  }

  if (userRow.data) {
    return jsonResponse({ context: toCamel(userRow.data) }, 200, req, requestId);
  }

  // Fall back to tenant default (user_id IS NULL)
  const tenantRow = await db
    .from('business_contexts')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .is('user_id', null)
    .limit(1)
    .maybeSingle();

  if (tenantRow.error) {
    return errorResponse(500, 'Failed to load tenant business context', req, {
      code: 'DB_ERROR',
      details: tenantRow.error,
      requestId,
    });
  }

  return jsonResponse(
    { context: tenantRow.data ? toCamel(tenantRow.data) : null },
    200,
    req,
    requestId,
  );
}

export async function getAll(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;

  const { data, error } = await db
    .from('business_contexts')
    .select('*')
    .eq('tenant_id', ctx.tenantId);

  if (error) {
    return errorResponse(500, 'Failed to list business contexts', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  return jsonResponse({ contexts: toCamel(data ?? []) }, 200, req, requestId);
}

// Body schema — accept camelCase from frontend; we convert to snake_case before insert.
const upsertSchema = z.object({
  scope: z.enum(['tenant', 'user']).default('tenant'),
  data: z
    .object({
      icpSummary: z.string().nullable().optional(),
      icpCompanySize: z.string().nullable().optional(),
      icpIndustries: z.array(z.string()).nullable().optional(),
      icpGeographies: z.array(z.string()).nullable().optional(),
      icpBuyerTitles: z.array(z.string()).nullable().optional(),
      icpPainPoints: z.array(z.string()).nullable().optional(),
      icpTriggerSignals: z.array(z.string()).nullable().optional(),
      offerSummary: z.string().nullable().optional(),
      offerOutcomes: z.array(z.string()).nullable().optional(),
      offerDifferentiators: z.array(z.string()).nullable().optional(),
      offerProof: z.array(z.string()).nullable().optional(),
      positioningStatement: z.string().nullable().optional(),
      positioningObjections: z
        .array(z.object({ objection: z.string(), response: z.string() }))
        .nullable()
        .optional(),
      notForCustomers: z.array(z.string()).nullable().optional(),
      pastWins: z
        .array(
          z.object({
            company: z.string(),
            industry: z.string().optional(),
            size: z.string().optional(),
            howFound: z.string().optional(),
            triggerToBuy: z.string().optional(),
            outcome: z.string().optional(),
          }),
        )
        .nullable()
        .optional(),
      toolsNotes: z.string().nullable().optional(),
      additionalNotes: z.string().nullable().optional(),
    })
    .partial(),
});

export async function upsert(req: Request, hc: HandlerContext): Promise<Response> {
  const { ctx, db, requestId } = hc;

  let parsed: z.infer<typeof upsertSchema>;
  try {
    parsed = await validateBody(upsertSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid input', req, {
      code: 'VALIDATION_ERROR',
      details: (err as Error).message,
      requestId,
    });
  }

  const effectiveUserId = parsed.scope === 'user' ? ctx.userId : null;

  // Check if a row exists for this scope
  let existingQuery = db
    .from('business_contexts')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .limit(1);
  existingQuery = effectiveUserId
    ? existingQuery.eq('user_id', effectiveUserId)
    : existingQuery.is('user_id', null);

  const existingRes = await existingQuery.maybeSingle();

  if (existingRes.error) {
    return errorResponse(500, 'Failed to check existing context', req, {
      code: 'DB_ERROR',
      details: existingRes.error,
      requestId,
    });
  }

  // Convert keys to snake_case (shallow — jsonb contents keep their camelCase)
  const dataForDb = toSnakeShallow(parsed.data as Record<string, unknown>);

  if (existingRes.data) {
    const update = await db
      .from('business_contexts')
      .update({ ...dataForDb, updated_at: new Date().toISOString() })
      .eq('id', (existingRes.data as { id: string }).id)
      .select()
      .single();

    if (update.error) {
      return errorResponse(500, 'Failed to update business context', req, {
        code: 'DB_ERROR',
        details: update.error,
        requestId,
      });
    }
    return jsonResponse({ context: toCamel(update.data) }, 200, req, requestId);
  }

  const insert = await db
    .from('business_contexts')
    .insert({
      ...dataForDb,
      tenant_id: ctx.tenantId,
      user_id: effectiveUserId,
    })
    .select()
    .single();

  if (insert.error) {
    return errorResponse(500, 'Failed to create business context', req, {
      code: 'DB_ERROR',
      details: insert.error,
      requestId,
    });
  }

  return jsonResponse({ context: toCamel(insert.data) }, 200, req, requestId);
}
