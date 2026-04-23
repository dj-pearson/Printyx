// Assignment history + user-assignments.
//
// URL paths handled:
//   GET  /lead-assignment-history/:leadId           — history for one lead
//   POST /lead-assignment-history                   — manual history entry
//   GET  /user-assignments/:userId                  — recent assignments for a rep
//
// Also via /territories/history/*:
//   GET  /history/lead/:leadId
//   GET  /history/rep/:userId

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleHistory(
  req: Request,
  ctx: HandlerCtx,
  matchedPrefix: string,
): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const isUserAssignments = matchedPrefix === '/user-assignments';

  // ─── /user-assignments/:userId — per-rep list ────────────────────────────
  if (isUserAssignments && method === 'GET' && pathParts[0]) {
    const userId = pathParts[0];
    const limit = Number(ctx.url.searchParams.get('limit') ?? '50');
    const { data, error } = await db
      .from('lead_assignment_history')
      .select('*')
      .eq('assigned_to', userId)
      .eq('tenant_id', auth.tenantId)
      .order('assigned_at', { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) {
      return errorResponse(500, 'Failed to fetch user assignments', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // ─── /territories/history/{lead,rep}/:id forwarded version ──────────────
  if (pathParts[0] === 'lead' && pathParts[1] && method === 'GET') {
    const leadId = pathParts[1];
    const { data, error } = await db
      .from('lead_assignment_history')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .order('assigned_at', { ascending: false });
    if (error) {
      return errorResponse(500, 'Failed to fetch lead history', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }
  if (pathParts[0] === 'rep' && pathParts[1] && method === 'GET') {
    const userId = pathParts[1];
    const { data, error } = await db
      .from('lead_assignment_history')
      .select('*')
      .eq('assigned_to', userId)
      .eq('tenant_id', auth.tenantId)
      .order('assigned_at', { ascending: false })
      .limit(100);
    if (error) {
      return errorResponse(500, 'Failed to fetch rep history', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // ─── /lead-assignment-history/:leadId ────────────────────────────────────
  if (method === 'GET' && pathParts[0]) {
    const leadId = pathParts[0];
    const { data, error } = await db
      .from('lead_assignment_history')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .order('assigned_at', { ascending: false });
    if (error) {
      return errorResponse(500, 'Failed to fetch assignment history', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // ─── POST /lead-assignment-history — manual entry ────────────────────────
  if (method === 'POST' && !pathParts[0]) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      lead_id: body.leadId ?? body.lead_id,
      assigned_from: body.assignedFrom ?? body.assigned_from ?? null,
      assigned_to: body.assignedTo ?? body.assigned_to,
      assignment_reason: body.assignmentReason ?? body.assignment_reason ?? 'manual_override',
      rule_id: body.ruleId ?? body.rule_id ?? null,
      assigned_by: body.assignedBy ?? body.assigned_by ?? auth.userId,
      assignment_notes: body.assignmentNotes ?? body.assignment_notes ?? null,
    };
    if (!row.lead_id || !row.assigned_to) {
      return errorResponse(400, 'leadId and assignedTo are required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('lead_assignment_history')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to record assignment history', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}
