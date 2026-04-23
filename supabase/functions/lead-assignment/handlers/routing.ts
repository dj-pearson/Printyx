// Auto lead routing — scoring-aware assignment + dashboard + config + preview.
//
// URL paths handled:
//   POST /auto-lead-routing/route/:leadId
//   POST /auto-lead-routing/route-batch
//   GET  /auto-lead-routing/dashboard
//   GET  /auto-lead-routing/config
//   PUT  /auto-lead-routing/config
//   GET  /auto-lead-routing/preview/:leadId
//
// Config is in-memory default-only for now (mirrors Express TODO). When a
// tenant_settings table lands, flip to DB-backed storage — single-row upsert
// keyed by tenant_id.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { route, preview } from '../_engine.ts';

const DEFAULT_CONFIG = {
  enabled: true,
  autoRouteNewLeads: true,
  minLeadScore: 50,
  respectRepCapacity: true,
  maxLeadsPerRepPerDay: 10,
  sendImmediateEmail: true,
  emailTemplate: 'default',
  slaMinutes: 5,
  businessHoursOnly: false,
  escalationEnabled: true,
  escalateAfterMinutes: 60,
};

// Hard cap per PRD §10 "Routing batch hits Deno memory ceiling".
const MAX_BATCH_SIZE = 200;

export async function handleRouting(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // POST /auto-lead-routing/route/:leadId
  if (method === 'POST' && first === 'route' && second) {
    try {
      const result = await route(db, second, auth.tenantId, { reason: 'auto_ai_routing' });
      return jsonResponse(
        { success: true, message: 'Lead successfully routed', data: result },
        200,
        req,
        requestId,
      );
    } catch (err) {
      return errorResponse(500, (err as Error).message ?? 'Routing failed', req, {
        code: 'ROUTING_FAILED',
        requestId,
      });
    }
  }

  // POST /auto-lead-routing/route-batch
  if (method === 'POST' && first === 'route-batch') {
    const body = (await req.json().catch(() => null)) as { leadIds?: string[] } | null;
    if (!Array.isArray(body?.leadIds) || body!.leadIds.length === 0) {
      return errorResponse(400, 'leadIds array required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    if (body!.leadIds.length > MAX_BATCH_SIZE) {
      return errorResponse(400, `Batch size exceeds limit of ${MAX_BATCH_SIZE}`, req, {
        code: 'BATCH_TOO_LARGE',
        requestId,
      });
    }

    const results: Array<Record<string, unknown>> = [];
    const errors: Array<{ leadId: string; error: string }> = [];
    for (const leadId of body!.leadIds) {
      try {
        const r = await route(db, leadId, auth.tenantId, { reason: 'auto_ai_routing' });
        results.push({ leadId, ...r });
      } catch (err) {
        errors.push({ leadId, error: (err as Error).message ?? 'unknown' });
      }
    }
    return jsonResponse(
      { success: true, routed: results.length, failed: errors.length, results, errors },
      200,
      req,
      requestId,
    );
  }

  // GET /auto-lead-routing/dashboard
  if (method === 'GET' && first === 'dashboard') {
    return await dashboard(req, ctx);
  }

  // GET /auto-lead-routing/config
  if (method === 'GET' && first === 'config') {
    return jsonResponse(DEFAULT_CONFIG, 200, req, requestId);
  }

  // PUT /auto-lead-routing/config
  if (method === 'PUT' && first === 'config') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Until a tenant-settings persistence layer lands, echo back. Matches the
    // Express TODO semantics exactly — the PRD tracks durable config as a
    // follow-up.
    return jsonResponse(
      {
        success: true,
        message: 'Configuration updated (in-memory)',
        config: { ...DEFAULT_CONFIG, ...body },
      },
      200,
      req,
      requestId,
    );
  }

  // GET /auto-lead-routing/preview/:leadId
  if (method === 'GET' && first === 'preview' && second) {
    try {
      const result = await preview(db, second, auth.tenantId);
      return jsonResponse({ preview: result }, 200, req, requestId);
    } catch (err) {
      return errorResponse(500, (err as Error).message ?? 'Preview failed', req, {
        code: 'PREVIEW_FAILED',
        requestId,
      });
    }
  }

  return null;
}

async function dashboard(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const thirtyDaysAgoISO = new Date(Date.now() - 30 * 86400000).toISOString();

  const [autoRouted, responses, reps, recent] = await Promise.all([
    db
      .from('lead_assignment_history')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('assignment_reason', 'auto_ai_routing')
      .gte('assigned_at', thirtyDaysAgoISO),
    db
      .from('lead_assignment_history')
      .select('first_response_time_minutes')
      .eq('tenant_id', auth.tenantId)
      .eq('assignment_reason', 'auto_ai_routing')
      .gte('assigned_at', thirtyDaysAgoISO),
    db
      .from('rep_capacity')
      .select(
        'user_id, current_active_leads, max_active_leads, leads_assigned_today, conversion_rate, average_response_time_minutes',
      )
      .eq('tenant_id', auth.tenantId)
      .eq('is_available', true),
    db
      .from('lead_assignment_history')
      .select(
        'id, lead_id, assigned_to, assigned_at, first_response_at, first_response_time_minutes',
      )
      .eq('tenant_id', auth.tenantId)
      .eq('assignment_reason', 'auto_ai_routing')
      .order('assigned_at', { ascending: false })
      .limit(10),
  ]);

  const totalAutoRouted = autoRouted.count ?? 0;

  const times = ((responses.data ?? []) as Array<{ first_response_time_minutes: number | null }>)
    .map((r) => r.first_response_time_minutes)
    .filter((t): t is number => typeof t === 'number');
  const avgResponse =
    times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const fastResponses = times.filter((t) => t <= 5).length;
  const fastResponseRate = totalAutoRouted > 0 ? (fastResponses / totalAutoRouted) * 100 : 0;

  const repWorkload = (
    (reps.data ?? []) as Array<{
      user_id: string;
      current_active_leads: number | null;
      max_active_leads: number | null;
      leads_assigned_today: number | null;
      conversion_rate: string | null;
      average_response_time_minutes: number | null;
    }>
  ).map((r) => {
    const max = r.max_active_leads ?? 50;
    const cur = r.current_active_leads ?? 0;
    return {
      userId: r.user_id,
      utilizationPercent: ((cur / max) * 100).toFixed(0),
      currentLoad: cur,
      maxLoad: max,
      leadsToday: r.leads_assigned_today ?? 0,
      conversionRate: parseFloat(r.conversion_rate ?? '0') * 100,
      avgResponseTime: r.average_response_time_minutes ?? 0,
    };
  });

  const timeSavedHours = (totalAutoRouted * 5) / 60; // 5 min per lead
  return jsonResponse(
    {
      overview: {
        totalAutoRouted,
        avgResponseTimeMinutes: avgResponse,
        fastResponseRate: fastResponseRate.toFixed(1),
        timeSavedHours: timeSavedHours.toFixed(1),
        timeSavedCost: (timeSavedHours * 35).toFixed(0),
        period: '30 days',
      },
      // Lead score distribution depends on US-012 tables — defer until then.
      scoreDistribution: [],
      repWorkload,
      recentLeads: recent.data ?? [],
    },
    200,
    req,
    requestId,
  );
}
