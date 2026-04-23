// Lead scoring rules — CRUD.
//
// Paths (dispatcher has already stripped `/lead-scoring/rules`):
//   POST   /          (admin|manager)  — create
//   GET    /          — list (?category filter)
//   GET    /active    — active only
//   GET    /:id
//   PUT    /:id       (admin|manager)
//   DELETE /:id       (admin|manager)
//
// Column names follow drizzle/migrations/0000_fuzzy_blizzard.sql:
//   rule_name, rule_description, category, field, operator, value,
//   score_points, max_score, priority, is_active, created_by

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { isAdminOrManager } from '../_rbac.ts';

export async function handleRules(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0]; // 'active' | ruleId | undefined

  // GET /rules/active
  if (method === 'GET' && first === 'active') {
    const { data, error } = await db
      .from('lead_scoring_rules')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('is_active', true)
      .order('priority', { ascending: false });
    if (error) {
      return errorResponse(500, 'Failed to fetch active rules', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /rules[?category=...]
  if (method === 'GET' && !first) {
    let q = db
      .from('lead_scoring_rules')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('priority', { ascending: false });
    const category = url.searchParams.get('category');
    if (category) q = q.eq('category', category);
    const { data, error } = await q;
    if (error) {
      return errorResponse(500, 'Failed to fetch rules', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /rules/:id
  if (method === 'GET' && first) {
    const { data, error } = await db
      .from('lead_scoring_rules')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to fetch rule', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data) return errorResponse(404, 'Rule not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /rules (admin|manager)
  if (method === 'POST' && !first) {
    if (!isAdminOrManager(auth)) {
      return errorResponse(403, 'Admin or manager role required', req, {
        code: 'FORBIDDEN',
        requestId,
      });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row = mapRuleFields(body);
    if (!row.rule_name || !row.category || !row.field || !row.operator) {
      return errorResponse(400, 'rule_name, category, field, operator are required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    const { data, error } = await db.from('lead_scoring_rules').insert(row).select().maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to create rule', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data, 201, req, requestId);
  }

  // PUT /rules/:id (admin|manager)
  if ((method === 'PUT' || method === 'PATCH') && first) {
    if (!isAdminOrManager(auth)) {
      return errorResponse(403, 'Admin or manager role required', req, {
        code: 'FORBIDDEN',
        requestId,
      });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row = mapRuleFields(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('lead_scoring_rules')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to update rule', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data) return errorResponse(404, 'Rule not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // DELETE /rules/:id (admin|manager)
  if (method === 'DELETE' && first) {
    if (!isAdminOrManager(auth)) {
      return errorResponse(403, 'Admin or manager role required', req, {
        code: 'FORBIDDEN',
        requestId,
      });
    }
    const { error } = await db
      .from('lead_scoring_rules')
      .delete()
      .eq('id', first)
      .eq('tenant_id', auth.tenantId);
    if (error) {
      return errorResponse(500, 'Failed to delete rule', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapRuleFields(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (camel: string, snake: string) => body[camel] ?? body[snake];

  if (src('ruleName', 'rule_name') !== undefined) r.rule_name = src('ruleName', 'rule_name');
  if (src('ruleDescription', 'rule_description') !== undefined)
    r.rule_description = src('ruleDescription', 'rule_description');
  if (body.category !== undefined) r.category = body.category;
  if (body.field !== undefined) r.field = body.field;
  if (body.operator !== undefined) r.operator = body.operator;
  if (body.value !== undefined) r.value = body.value;
  if (src('scorePoints', 'score_points') !== undefined)
    r.score_points = src('scorePoints', 'score_points');
  if (src('maxScore', 'max_score') !== undefined) r.max_score = src('maxScore', 'max_score');
  if (body.priority !== undefined) r.priority = body.priority;
  if (src('isActive', 'is_active') !== undefined) r.is_active = src('isActive', 'is_active');
  return r;
}
