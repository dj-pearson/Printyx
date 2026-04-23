// Lead assignment queue.
//
// URL paths handled:
//   GET   /lead-assignment-queue[?status=pending]
//   POST  /lead-assignment-queue
//   POST  /lead-assignment-queue/:id/process

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleQueue(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const queueId = pathParts[0];
  const action = pathParts[1];

  if (method === 'GET' && !queueId) {
    const status = url.searchParams.get('status');
    let q = db
      .from('lead_assignment_queue')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('priority', { ascending: false })
      .order('schedule_for', { ascending: true });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) {
      return errorResponse(500, 'Failed to fetch queue', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'POST' && !queueId) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body?.leadId && !body?.lead_id) {
      return errorResponse(400, 'leadId is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const row: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      lead_id: body.leadId ?? body.lead_id,
      status: body.status ?? 'pending',
      priority: body.priority ?? 0,
      target_user_id: body.targetUserId ?? body.target_user_id ?? null,
      rule_id: body.ruleId ?? body.rule_id ?? null,
      schedule_for: body.scheduleFor ?? body.schedule_for ?? new Date().toISOString(),
      max_attempts: body.maxAttempts ?? body.max_attempts ?? 3,
    };
    const { data, error } = await db
      .from('lead_assignment_queue')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to enqueue assignment', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data, 201, req, requestId);
  }

  // POST /lead-assignment-queue/:id/process — transition to processing.
  // Express's behavior was to mark status='processing' + processed_at=now, and
  // "here you would trigger the actual assignment logic" (TODO). Mirror that.
  if (method === 'POST' && queueId && action === 'process') {
    const { data, error } = await db
      .from('lead_assignment_queue')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString(),
      })
      .eq('id', queueId)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to process queue item', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data) {
      return errorResponse(404, 'Queue item not found', req, { code: 'NOT_FOUND', requestId });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}
