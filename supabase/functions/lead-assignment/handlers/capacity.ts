// Rep capacity — CRUD + availability toggle + "who's available" lookup.
//
// URL paths handled:
//   GET   /rep-capacity                         (list all)
//   GET   /rep-capacity/:userId                 (single)
//   POST  /rep-capacity                         (upsert by user_id)
//   PATCH /rep-capacity/:userId/availability    (availability-only update)
//
// Also forwarded from /territories/capacity/*:
//   GET   /capacity/:userId
//   PUT   /capacity/:userId
//   GET   /capacity
//   POST  /capacity/available                   (returns next available rep)

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleCapacity(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // POST /rep-capacity/available — return the next rep with headroom
  if (first === 'available' && method === 'POST') {
    return await getAvailableRep(req, ctx);
  }

  if (method === 'GET' && !first) {
    const { data, error } = await db
      .from('rep_capacity')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('is_available', { ascending: false })
      .order('user_id', { ascending: true });
    if (error) {
      return errorResponse(500, 'Failed to fetch rep capacities', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && first) {
    const { data, error } = await db
      .from('rep_capacity')
      .select('*')
      .eq('user_id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to fetch rep capacity', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data)
      return errorResponse(404, 'Rep capacity not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body?.userId && !body?.user_id) {
      return errorResponse(400, 'userId is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const userId = String(body.userId ?? body.user_id);
    const row = mapCapacityFields(body);
    row.tenant_id = auth.tenantId;
    row.user_id = userId;

    const { data: existing } = await db
      .from('rep_capacity')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();

    if (existing?.id) {
      row.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('rep_capacity')
        .update(row)
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      if (error) {
        return errorResponse(500, 'Failed to update rep capacity', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data, 200, req, requestId);
    }

    const { data, error } = await db.from('rep_capacity').insert(row).select().maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to create rep capacity', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data, 201, req, requestId);
  }

  if (method === 'PATCH' && first && second === 'availability') {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.isAvailable !== undefined || body.is_available !== undefined)
      update.is_available = body.isAvailable ?? body.is_available;
    if (body.unavailableReason !== undefined || body.unavailable_reason !== undefined)
      update.unavailable_reason = body.unavailableReason ?? body.unavailable_reason;
    if (body.unavailableUntil !== undefined || body.unavailable_until !== undefined)
      update.unavailable_until = body.unavailableUntil ?? body.unavailable_until;

    const { data, error } = await db
      .from('rep_capacity')
      .update(update)
      .eq('user_id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to update availability', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data)
      return errorResponse(404, 'Rep capacity not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'PUT' && first) {
    // Invoked via /territories/capacity/:userId PUT
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row = mapCapacityFields(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('rep_capacity')
      .update(row)
      .eq('user_id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to update rep capacity', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data)
      return errorResponse(404, 'Rep capacity not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

async function getAvailableRep(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as {
    skills?: string[];
    excludeUserIds?: string[];
  };

  let q = db
    .from('rep_capacity')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('is_available', true);
  if (body.excludeUserIds && body.excludeUserIds.length > 0) {
    q = q.not('user_id', 'in', `(${body.excludeUserIds.join(',')})`);
  }
  const { data, error } = await q;
  if (error) {
    return errorResponse(500, 'Failed to query available reps', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  const reps = (data ?? []) as Array<{
    user_id: string;
    max_active_leads: number | null;
    current_active_leads: number | null;
    skills: string[] | null;
  }>;

  // Filter to ones with capacity + optional skill overlap; pick lowest load.
  const candidates = reps.filter((r) => {
    const cap = r.max_active_leads ?? 50;
    const load = r.current_active_leads ?? 0;
    if (load >= cap) return false;
    if (body.skills && body.skills.length > 0) {
      if (!r.skills || !body.skills.some((s) => r.skills!.includes(s))) return false;
    }
    return true;
  });
  candidates.sort(
    (a, b) =>
      (a.current_active_leads ?? 0) / (a.max_active_leads ?? 50) -
      (b.current_active_leads ?? 0) / (b.max_active_leads ?? 50),
  );
  return jsonResponse({ rep: candidates[0] ?? null }, 200, req, requestId);
}

function mapCapacityFields(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (camel: string, snake: string) => body[camel] ?? body[snake];

  if (src('maxActiveLeads', 'max_active_leads') !== undefined)
    r.max_active_leads = src('maxActiveLeads', 'max_active_leads');
  if (src('maxNewLeadsPerDay', 'max_new_leads_per_day') !== undefined)
    r.max_new_leads_per_day = src('maxNewLeadsPerDay', 'max_new_leads_per_day');
  if (src('maxNewLeadsPerWeek', 'max_new_leads_per_week') !== undefined)
    r.max_new_leads_per_week = src('maxNewLeadsPerWeek', 'max_new_leads_per_week');
  if (src('currentActiveLeads', 'current_active_leads') !== undefined)
    r.current_active_leads = src('currentActiveLeads', 'current_active_leads');
  if (src('isAvailable', 'is_available') !== undefined)
    r.is_available = src('isAvailable', 'is_available');
  if (src('unavailableReason', 'unavailable_reason') !== undefined)
    r.unavailable_reason = src('unavailableReason', 'unavailable_reason');
  if (src('unavailableUntil', 'unavailable_until') !== undefined)
    r.unavailable_until = src('unavailableUntil', 'unavailable_until');
  if (body.skills !== undefined) r.skills = body.skills;
  if (body.certifications !== undefined) r.certifications = body.certifications;
  if (body.languages !== undefined) r.languages = body.languages;
  if (src('averageResponseTimeMinutes', 'average_response_time_minutes') !== undefined)
    r.average_response_time_minutes = src(
      'averageResponseTimeMinutes',
      'average_response_time_minutes',
    );
  if (src('conversionRate', 'conversion_rate') !== undefined)
    r.conversion_rate = src('conversionRate', 'conversion_rate');
  if (src('averageDealSize', 'average_deal_size') !== undefined)
    r.average_deal_size = src('averageDealSize', 'average_deal_size');
  if (src('workingHours', 'working_hours') !== undefined)
    r.working_hours = src('workingHours', 'working_hours');
  return r;
}
