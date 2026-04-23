// Customer Success interventions (table: success_interventions).
//
// Paths (dispatcher stripped /customer-success/interventions):
//   GET    /                   (?status&priority&interventionType filters)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   GET    /customer/:customerId
//   POST   /:id/assign         (body: assignedTo) — manager+ only
//   POST   /:id/complete       (body: outcome, notes) — marks completed
//   POST   /:id/cancel         (body: reason) — marks cancelled
//   GET    /overdue            (due_date < now, status in active statuses)
//   GET    /my                 (assigned_to = current user)

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { isManagerOrAbove } from '../_rbac.ts';

const ACTIVE_STATUSES = ['pending', 'in_progress', 'scheduled', 'assigned'];

export async function handleInterventions(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // GET /customer/:customerId
  if (method === 'GET' && first === 'customer' && second) {
    const { data, error } = await db
      .from('success_interventions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('customer_id', second)
      .order('created_at', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch interventions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /my
  if (method === 'GET' && first === 'my') {
    const { data, error } = await db
      .from('success_interventions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('assigned_to', auth.userId)
      .in('status', ACTIVE_STATUSES)
      .order('due_date', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch my interventions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /overdue
  if (method === 'GET' && first === 'overdue') {
    const { data, error } = await db
      .from('success_interventions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .lt('due_date', new Date().toISOString())
      .in('status', ACTIVE_STATUSES)
      .order('due_date', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch overdue interventions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // Actions: POST /:id/{assign,complete,cancel}
  if (method === 'POST' && first && second === 'assign') {
    if (!isManagerOrAbove(auth)) {
      return errorResponse(403, 'Manager role required', req, { code: 'FORBIDDEN', requestId });
    }
    const body = (await req.json().catch(() => ({}))) as {
      assignedTo?: string;
      assigned_to?: string;
    };
    const assignedTo = body.assignedTo ?? body.assigned_to;
    if (!assignedTo) {
      return errorResponse(400, 'assignedTo is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('success_interventions')
      .update({
        assigned_to: assignedTo,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to assign intervention', error);
    if (!data)
      return errorResponse(404, 'Intervention not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && first && second === 'complete') {
    const body = (await req.json().catch(() => ({}))) as {
      outcome?: string;
      notes?: string;
      customerResponse?: string;
      customer_response?: string;
      healthScoreAfter?: number;
      health_score_after?: number;
    };
    const { data, error } = await db
      .from('success_interventions')
      .update({
        status: 'completed',
        outcome: body.outcome ?? null,
        notes: body.notes ?? null,
        customer_response: body.customerResponse ?? body.customer_response ?? null,
        health_score_after: body.healthScoreAfter ?? body.health_score_after ?? null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to complete intervention', error);
    if (!data)
      return errorResponse(404, 'Intervention not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && first && second === 'cancel') {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const { data, error } = await db
      .from('success_interventions')
      .update({
        status: 'cancelled',
        notes: body.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to cancel intervention', error);
    if (!data)
      return errorResponse(404, 'Intervention not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // GET /
  if (method === 'GET' && !first) {
    let q = db.from('success_interventions').select('*').eq('tenant_id', auth.tenantId);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const type = url.searchParams.get('interventionType') ?? url.searchParams.get('type');
    if (status) q = q.eq('status', status);
    if (priority) q = q.eq('priority', priority);
    if (type) q = q.eq('intervention_type', type);
    q = q.order('created_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch interventions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('success_interventions')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch intervention', error);
    if (!data)
      return errorResponse(404, 'Intervention not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapIntervention(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (
      !row.customer_id ||
      !row.intervention_type ||
      !row.trigger ||
      !row.priority ||
      !row.status ||
      !row.title
    ) {
      return errorResponse(
        400,
        'customer_id, intervention_type, trigger, priority, status, title are required',
        req,
        { code: 'VALIDATION_ERROR', requestId },
      );
    }
    const { data, error } = await db
      .from('success_interventions')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create intervention', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapIntervention(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('success_interventions')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update intervention', error);
    if (!data)
      return errorResponse(404, 'Intervention not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

function mapIntervention(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('customer_id', 'customerId', 'customer_id');
  set('intervention_type', 'interventionType', 'intervention_type');
  if (body.trigger !== undefined) r.trigger = body.trigger;
  if (body.priority !== undefined) r.priority = body.priority;
  if (body.status !== undefined) r.status = body.status;
  if (body.outcome !== undefined) r.outcome = body.outcome;
  set('assigned_to', 'assignedTo', 'assigned_to');
  set('assigned_at', 'assignedAt', 'assigned_at');
  set('due_date', 'dueDate', 'due_date');
  set('scheduled_date', 'scheduledDate', 'scheduled_date');
  set('executed_at', 'executedAt', 'executed_at');
  set('completed_at', 'completedAt', 'completed_at');
  if (body.title !== undefined) r.title = body.title;
  if (body.description !== undefined) r.description = body.description;
  set('action_items', 'actionItems', 'action_items');
  if (body.notes !== undefined) r.notes = body.notes;
  set('customer_response', 'customerResponse', 'customer_response');
  set('follow_up_required', 'followUpRequired', 'follow_up_required');
  set('follow_up_date', 'followUpDate', 'follow_up_date');
  set('health_score_before', 'healthScoreBefore', 'health_score_before');
  set('health_score_after', 'healthScoreAfter', 'health_score_after');
  set('churn_risk_before', 'churnRiskBefore', 'churn_risk_before');
  set('churn_risk_after', 'churnRiskAfter', 'churn_risk_after');
  set('related_health_score_id', 'relatedHealthScoreId', 'related_health_score_id');
  set('related_churn_prediction_id', 'relatedChurnPredictionId', 'related_churn_prediction_id');
  set('related_ticket_ids', 'relatedTicketIds', 'related_ticket_ids');
  set('automated_action', 'automatedAction', 'automated_action');
  set('workflow_id', 'workflowId', 'workflow_id');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
