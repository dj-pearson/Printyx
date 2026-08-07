/**
 * Customer-portal service edge function (PROD-011) — port of
 * server/routes-portal-service.ts.
 *
 * WHY: the domain had an Express handler and NO edge function, so
 * pages/CustomerPortalService.tsx worked in dev and hard-404'd in production,
 * where getApiUrl() rewrites /api/portal-service -> functions.printyx.net/portal-service
 * with no Express fallback.
 *
 * ROUTES — all four Express endpoints, covering everything the page calls:
 *   POST /classify                    { requestId?, text, equipmentId? }
 *   GET  /classifications/:requestId  latest classification for a request
 *   POST /rate                        { requestId, rating, feedback? }
 *   GET  /timeline/:requestId         5-step status timeline + history
 *
 * All four shipped together — proxying forwards the whole prefix and falls
 * through only on a network error, never a 404, so a partial port would take the
 * rest from working-in-dev to 404-in-dev.
 *
 * TWO DEGRADATION PATHS ARE LOAD-BEARING and are preserved exactly:
 *
 * 1. CLASSIFICATION ALWAYS RETURNS. The AI call is best-effort; on any failure
 *    the rule-based classifier supplies the answer. A customer describing a
 *    grinding noise must never get an empty playbook because a model was down.
 *
 * 2. DISPATCH IS BEST-EFFORT AND SEPARATE. Creating the internal ticket, moving
 *    the request to 'assigned' and appending status history are wrapped so that
 *    a MISSING TABLE/COLUMN/ENUM (a partially-migrated tenant) degrades to
 *    dispatch:'skipped' while the customer still receives their classification.
 *    Any OTHER error still propagates — silently swallowing a real write failure
 *    would lose the ticket without telling anyone.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import {
  buildClassifyPrompt,
  buildTimeline,
  fallbackClassify,
  isMissingTableOrTypeError,
  parseAiClassification,
  reachedAtFromHistory,
  toRequestPriority,
  type Classification,
} from './classify.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Idempotent — the dispatcher strips segment 0 before the handler runs.
    const { parts } = normalizePath(url.pathname, 'portal-service');
    const [first, second] = parts;
    const method = req.method.toUpperCase();

    if (method === 'POST' && first === 'classify') {
      return await handleClassify(req, admin, tenantId, user.id);
    }

    if (method === 'POST' && first === 'rate') {
      return await handleRate(req, admin, tenantId);
    }

    if (method === 'GET' && first === 'classifications' && second) {
      const { data, error } = await admin
        .from('portal_service_classifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('request_id', second)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) {
        return createCorsResponse({ message: 'No classification found' }, 404, req);
      }
      return createCorsResponse(data[0], 200, req);
    }

    if (method === 'GET' && first === 'timeline' && second) {
      return await handleTimeline(admin, tenantId, second, req);
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('portal-service function error:', message);
    return createCorsResponse(
      { message: 'Portal-service request failed', error: message },
      500,
      req,
    );
  }
}

// ---------------------------------------------------------------------------
// Classify (+ best-effort dispatch)
// ---------------------------------------------------------------------------

async function handleClassify(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  userId: string,
): Promise<Response> {
  const body = await safeJson(req);

  const text = typeof body.text === 'string' ? body.text : '';
  if (!text) {
    return createCorsResponse(
      { message: 'Invalid input', errors: { text: 'text is required' } },
      400,
      req,
    );
  }
  const requestId = typeof body.requestId === 'string' && body.requestId ? body.requestId : null;
  const equipmentId =
    typeof body.equipmentId === 'string' && body.equipmentId ? body.equipmentId : null;

  const classification = await classify(text);

  // No requestId -> classify only. Nothing is dispatched and no ticket is made,
  // but the classification is still recorded against the 'unlinked' sentinel so
  // the analysis isn't lost.
  if (!requestId) {
    await persistClassification(admin, tenantId, 'unlinked', null, text, classification, null);
    return createCorsResponse({ classification, serviceTicketId: null }, 200, req);
  }

  const { data: request } = await admin
    .from('customer_service_requests')
    .select('id, customer_id, title, equipment_id, status')
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!request) {
    return createCorsResponse({ message: 'Service request not found' }, 404, req);
  }

  let serviceTicketId: string | null = null;
  let dispatch: 'created' | 'skipped' = 'skipped';
  // No skill/availability matcher is wired yet, so this stays null — same as Express.
  const suggestedTechId: string | null = null;

  try {
    const { data: ticket, error: ticketErr } = await admin
      .from('service_tickets')
      .insert({
        tenant_id: tenantId,
        customer_id: String(request.customer_id),
        ticket_number: `PORTAL-${Date.now()}`,
        title: request.title || classification.category,
        description: text,
        priority: classification.suggestedPriority,
        status: 'open',
        equipment_id: (request.equipment_id as string | null) ?? equipmentId,
        created_by: userId ?? 'portal',
      })
      .select('id')
      .maybeSingle();
    if (ticketErr) throw ticketErr;
    serviceTicketId = ticket?.id ? String(ticket.id) : null;

    const previousStatus = request.status;

    const { error: updErr } = await admin
      .from('customer_service_requests')
      .update({
        priority: toRequestPriority(classification.suggestedPriority),
        ...(suggestedTechId ? { assigned_technician_id: suggestedTechId } : {}),
        ...(serviceTicketId ? { service_ticket_id: serviceTicketId } : {}),
        status: 'assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('tenant_id', tenantId);
    if (updErr) throw updErr;

    const { error: histErr } = await admin.from('customer_service_request_status_history').insert({
      tenant_id: tenantId,
      service_request_id: requestId,
      previous_status: previousStatus,
      new_status: 'assigned',
      changed_by_type: 'system',
      changed_by_name: 'AI Dispatch',
      customer_visible_notes: `Classified as ${classification.category}; tech dispatch recommended.`,
    });
    if (histErr) throw histErr;

    dispatch = 'created';
  } catch (err) {
    // Only a missing relation/column/enum degrades to skipped. Anything else is
    // a real failure and must not be hidden behind a successful-looking response.
    if (!isMissingTableOrTypeError(err)) throw err;
    console.warn('portal-service: dispatch tables unavailable; dispatch skipped');
  }

  await persistClassification(
    admin,
    tenantId,
    requestId,
    serviceTicketId,
    text,
    classification,
    suggestedTechId,
  );

  return createCorsResponse({ classification, serviceTicketId, dispatch }, 200, req);
}

/** Claude when reachable, rule-based otherwise — never throws. */
async function classify(text: string): Promise<Classification> {
  const fallback = fallbackClassify(text);
  try {
    const out = await generateCompletion({
      max_tokens: 1000,
      messages: [{ role: 'user', content: buildClassifyPrompt(text) }],
    });
    return parseAiClassification(out, fallback) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Best-effort record of the classification; a missing table must not fail the request. */
async function persistClassification(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  requestId: string,
  serviceTicketId: string | null,
  text: string,
  classification: Classification,
  suggestedTechId: string | null,
): Promise<void> {
  try {
    const { error } = await admin.from('portal_service_classifications').insert({
      tenant_id: tenantId,
      request_id: requestId,
      service_ticket_id: serviceTicketId,
      // raw_text is varchar(2000) — truncate rather than let the insert fail.
      raw_text: text.slice(0, 2000),
      category: classification.category,
      suggested_priority: classification.suggestedPriority,
      recommended_parts: classification.recommendedParts,
      suggested_tech_id: suggestedTechId,
      playbook: classification.playbook,
      confidence: classification.confidence,
      source: classification.source,
    });
    if (error && !isMissingTableOrTypeError(error)) throw error;
  } catch (err) {
    if (!isMissingTableOrTypeError(err)) throw err;
    console.warn('portal-service: classification table unavailable; not persisted');
  }
}

// ---------------------------------------------------------------------------
// Rate
// ---------------------------------------------------------------------------

async function handleRate(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
): Promise<Response> {
  const body = await safeJson(req);

  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const rating = body.rating;
  const feedback = typeof body.feedback === 'string' ? body.feedback.slice(0, 2000) : undefined;

  const errors: Record<string, string> = {};
  if (!requestId) errors.requestId = 'required';
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = 'must be an integer 1-5';
  }
  if (Object.keys(errors).length) {
    return createCorsResponse({ message: 'Invalid input', errors }, 400, req);
  }

  const { data: updated, error } = await admin
    .from('customer_service_requests')
    .update({
      customer_rating: rating,
      ...(feedback ? { customer_feedback: feedback } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!updated) return createCorsResponse({ message: 'Service request not found' }, 404, req);

  return createCorsResponse({ ok: true }, 200, req);
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

async function handleTimeline(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  requestId: string,
  req: Request,
): Promise<Response> {
  const { data: request } = await admin
    .from('customer_service_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!request) return createCorsResponse({ message: 'Service request not found' }, 404, req);

  const { data: history, error } = await admin
    .from('customer_service_request_status_history')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('service_request_id', requestId)
    // ASCENDING: reachedAtFromHistory keeps the FIRST timestamp per step, which
    // is only the earliest if the rows arrive oldest-first.
    .order('created_at', { ascending: true });
  if (error) throw error;

  const currentStatus = (request.status as string | null) ?? null;
  const rows = (history ?? []).map((h: Record<string, unknown>) => ({
    newStatus: (h.new_status as string) ?? null,
    createdAt: (h.created_at as string) ?? null,
  }));

  const steps = buildTimeline(currentStatus, reachedAtFromHistory(rows));

  return createCorsResponse(
    { steps, history: history ?? [], currentStatus, cancelled: currentStatus === 'cancelled' },
    200,
    req,
  );
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
