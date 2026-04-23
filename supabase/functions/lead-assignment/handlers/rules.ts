// Lead assignment rules — CRUD.
//
// URL paths handled (all frontend paths, unchanged):
//   GET    /lead-assignment-rules
//   GET    /lead-assignment-rules/:id
//   POST   /lead-assignment-rules
//   PUT    /lead-assignment-rules/:id
//   DELETE /lead-assignment-rules/:id
//
// Column mapping follows `shared/lead-assignment-schema.ts` — the authoritative
// Drizzle schema for `lead_assignment_rules`. The standalone
// `lead-assignment-rules/` edge function this replaces wrote to columns that
// don't exist (name → should be rule_name, conditions → criteria, etc.);
// we use the correct names here.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleRules(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const ruleId = pathParts[0];

  if (method === 'GET' && !ruleId) {
    const { data, error } = await db
      .from('lead_assignment_rules')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('priority', { ascending: false });
    if (error) {
      return errorResponse(500, 'Failed to fetch assignment rules', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && ruleId) {
    const { data, error } = await db
      .from('lead_assignment_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to fetch assignment rule', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data) return errorResponse(404, 'Rule not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !ruleId) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row = mapRuleFields(body, auth.userId);
    row.tenant_id = auth.tenantId;
    const { data, error } = await db
      .from('lead_assignment_rules')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to create assignment rule', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PUT' || method === 'PATCH') && ruleId) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row = mapRuleFields(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('lead_assignment_rules')
      .update(row)
      .eq('id', ruleId)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to update assignment rule', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data) return errorResponse(404, 'Rule not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && ruleId) {
    const { error } = await db
      .from('lead_assignment_rules')
      .delete()
      .eq('id', ruleId)
      .eq('tenant_id', auth.tenantId);
    if (error) {
      return errorResponse(500, 'Failed to delete assignment rule', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// Map camelCase or snake_case body fields to actual DB columns. Unknown fields
// are dropped. This matches Express's drizzle-backed behavior where extra keys
// are silently ignored.
function mapRuleFields(body: Record<string, unknown>, createdBy?: string): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (camel: string, snake: string) => body[camel] ?? body[snake];

  if (src('ruleName', 'rule_name') !== undefined) r.rule_name = src('ruleName', 'rule_name');
  if (body.description !== undefined) r.description = body.description;
  if (src('assignmentType', 'assignment_type') !== undefined)
    r.assignment_type = src('assignmentType', 'assignment_type');
  if (body.criteria !== undefined) r.criteria = body.criteria;
  if (src('territoryId', 'territory_id') !== undefined)
    r.territory_id = src('territoryId', 'territory_id');
  if (src('assignToUserId', 'assign_to_user_id') !== undefined)
    r.assign_to_user_id = src('assignToUserId', 'assign_to_user_id');
  if (src('assignToTeam', 'assign_to_team') !== undefined)
    r.assign_to_team = src('assignToTeam', 'assign_to_team');
  if (src('roundRobinConfig', 'round_robin_config') !== undefined)
    r.round_robin_config = src('roundRobinConfig', 'round_robin_config');
  if (src('respectCapacityLimits', 'respect_capacity_limits') !== undefined)
    r.respect_capacity_limits = src('respectCapacityLimits', 'respect_capacity_limits');
  if (src('maxLeadsPerRep', 'max_leads_per_rep') !== undefined)
    r.max_leads_per_rep = src('maxLeadsPerRep', 'max_leads_per_rep');
  if (src('maxLeadsPerDay', 'max_leads_per_day') !== undefined)
    r.max_leads_per_day = src('maxLeadsPerDay', 'max_leads_per_day');
  if (src('assignImmediately', 'assign_immediately') !== undefined)
    r.assign_immediately = src('assignImmediately', 'assign_immediately');
  if (src('delayMinutes', 'delay_minutes') !== undefined)
    r.delay_minutes = src('delayMinutes', 'delay_minutes');
  if (src('businessHoursOnly', 'business_hours_only') !== undefined)
    r.business_hours_only = src('businessHoursOnly', 'business_hours_only');
  if (src('escalationEnabled', 'escalation_enabled') !== undefined)
    r.escalation_enabled = src('escalationEnabled', 'escalation_enabled');
  if (src('escalateAfterMinutes', 'escalate_after_minutes') !== undefined)
    r.escalate_after_minutes = src('escalateAfterMinutes', 'escalate_after_minutes');
  if (src('escalateToUserId', 'escalate_to_user_id') !== undefined)
    r.escalate_to_user_id = src('escalateToUserId', 'escalate_to_user_id');
  if (body.priority !== undefined) r.priority = body.priority;
  if (src('isActive', 'is_active') !== undefined) r.is_active = src('isActive', 'is_active');

  if (createdBy) r.created_by = createdBy;
  return r;
}
