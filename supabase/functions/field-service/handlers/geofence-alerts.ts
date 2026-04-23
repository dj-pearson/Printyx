// Geofence alert rules, alerts (with acknowledge/resolve/escalate actions),
// subscriptions, and aggregated statistics.
//
// Paths (dispatcher passes full parts starting from prefix match):
//   /rules[/...]                  — rule CRUD
//   /alerts[/...]                 — alert list/read + actions
//   /dwell-sessions[/...]         — stub (no geofence_dwell_sessions table)
//   /subscriptions[/...]          — subscription CRUD
//   /statistics                   — aggregate counts

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { dbErr } from '../_crud.ts';

export async function handleGeofenceAlerts(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const first = pathParts[0];

  if (first === 'rules') return await handleRules(req, { ...ctx, pathParts: pathParts.slice(1) });
  if (first === 'alerts') return await handleAlerts(req, { ...ctx, pathParts: pathParts.slice(1) });
  if (first === 'subscriptions')
    return await handleSubscriptions(req, { ...ctx, pathParts: pathParts.slice(1) });

  if (first === 'dwell-sessions') {
    // No backing table — return stub responses.
    if (method === 'GET' || method === 'POST') {
      return jsonResponse(
        {
          stub: true,
          message: 'Dwell sessions require a geofence_dwell_sessions table — deferred.',
          sessions: [],
        },
        200,
        req,
        requestId,
      );
    }
  }

  if (first === 'statistics' && method === 'GET') {
    const [rulesCount, alertsCount, unacked, resolved] = await Promise.all([
      db
        .from('geofence_alert_rules')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId)
        .eq('is_active', true),
      db
        .from('geofence_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId),
      db
        .from('geofence_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId)
        .eq('acknowledged', false),
      db
        .from('geofence_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId)
        .eq('resolved', true),
    ]);
    return jsonResponse(
      {
        activeRules: rulesCount.count ?? 0,
        totalAlerts: alertsCount.count ?? 0,
        unacknowledgedAlerts: unacked.count ?? 0,
        resolvedAlerts: resolved.count ?? 0,
      },
      200,
      req,
      requestId,
    );
  }

  return null;
}

// ─── Rules ───────────────────────────────────────────────────────────────────

async function handleRules(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('geofence_alert_rules')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('priority', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch rules', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from('geofence_alert_rules')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch rule', error);
    if (!data) return errorResponse(404, 'Rule not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRule(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.rule_name || !row.geofence_id || !row.trigger_type) {
      return errorResponse(400, 'rule_name, geofence_id, trigger_type required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('geofence_alert_rules')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create rule', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PUT' || method === 'PATCH') && id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRule(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('geofence_alert_rules')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update rule', error);
    if (!data) return errorResponse(404, 'Rule not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id) {
    const { error } = await db
      .from('geofence_alert_rules')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete rule', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapRule(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('rule_name', 'ruleName', 'rule_name');
  set('rule_description', 'ruleDescription', 'rule_description');
  set('geofence_id', 'geofenceId', 'geofence_id');
  set('trigger_type', 'triggerType', 'trigger_type');
  set('dwell_time_minutes', 'dwellTimeMinutes', 'dwell_time_minutes');
  set('max_dwell_time_minutes', 'maxDwellTimeMinutes', 'max_dwell_time_minutes');
  if (body.severity !== undefined) r.severity = body.severity;
  set('notify_by_email', 'notifyByEmail', 'notify_by_email');
  set('notify_by_push', 'notifyByPush', 'notify_by_push');
  set('notify_by_sms', 'notifyBySms', 'notify_by_sms');
  set('notify_in_app', 'notifyInApp', 'notify_in_app');
  set('notify_users', 'notifyUsers', 'notify_users');
  set('notify_roles', 'notifyRoles', 'notify_roles');
  set('alert_title', 'alertTitle', 'alert_title');
  set('alert_message', 'alertMessage', 'alert_message');
  set('cooldown_minutes', 'cooldownMinutes', 'cooldown_minutes');
  set('is_active', 'isActive', 'is_active');
  if (body.priority !== undefined) r.priority = body.priority;
  return r;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

async function handleAlerts(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];
  const action = pathParts[1];

  if (method === 'GET' && id === 'unacknowledged') {
    const { data, error } = await db
      .from('geofence_alerts')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('acknowledged', false)
      .order('triggered_at', { ascending: false })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch unacknowledged', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('geofence_alerts')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('triggered_at', { ascending: false })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch alerts', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id && !action) {
    const { data, error } = await db
      .from('geofence_alerts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch alert', error);
    if (!data) return errorResponse(404, 'Alert not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && id && action) {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };
    if (action === 'acknowledge') {
      update.acknowledged = true;
      update.acknowledged_at = now;
      update.acknowledged_by = auth.userId;
    } else if (action === 'resolve') {
      const body = (await req.json().catch(() => ({}))) as { resolutionNotes?: string };
      update.resolved = true;
      update.resolved_at = now;
      update.resolved_by = auth.userId;
      if (body.resolutionNotes) update.resolution_notes = body.resolutionNotes;
    } else if (action === 'escalate') {
      const body = (await req.json().catch(() => ({}))) as { escalatedTo?: string };
      update.escalated = true;
      update.escalated_at = now;
      if (body.escalatedTo) update.escalated_to = body.escalatedTo;
    } else {
      return errorResponse(400, `Unknown action: ${action}`, req, {
        code: 'UNKNOWN_ACTION',
        requestId,
      });
    }

    const { data, error } = await db
      .from('geofence_alerts')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, `Failed to ${action} alert`, error);
    if (!data) return errorResponse(404, 'Alert not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

async function handleSubscriptions(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('geofence_alert_subscriptions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('is_active', true);
    if (error) return dbErr(req, requestId, 'Failed to fetch subscriptions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      user_id: body.userId ?? body.user_id ?? auth.userId,
      subscription_type: body.subscriptionType ?? body.subscription_type,
      geofence_id: body.geofenceId ?? body.geofence_id ?? null,
      technician_id: body.technicianId ?? body.technician_id ?? null,
      customer_id: body.customerId ?? body.customer_id ?? null,
      alert_rule_id: body.alertRuleId ?? body.alert_rule_id ?? null,
      min_severity: body.minSeverity ?? body.min_severity ?? 'info',
      email_enabled: body.emailEnabled ?? body.email_enabled ?? true,
      push_enabled: body.pushEnabled ?? body.push_enabled ?? true,
      sms_enabled: body.smsEnabled ?? body.sms_enabled ?? false,
      in_app_enabled: body.inAppEnabled ?? body.in_app_enabled ?? true,
    };
    if (!row.subscription_type) {
      return errorResponse(400, 'subscription_type required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('geofence_alert_subscriptions')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create subscription', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if (method === 'DELETE' && id) {
    const { error } = await db
      .from('geofence_alert_subscriptions')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete subscription', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}
