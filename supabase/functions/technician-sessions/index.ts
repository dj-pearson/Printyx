/**
 * Technician-session edge function (PROD-011).
 *
 * WHAT THE STORY SAID vs WHAT IS ACTUALLY THERE — the backlog lists this domain
 * as "NO Express · NO edge fn · gate/remove". That diagnosis is wrong on the
 * first half. server/routes-enhanced-service.ts (mounted at /api by
 * routes-registry.ts:587) really does serve
 *   GET  /api/technician-sessions/:sessionId/workflow-steps
 *   POST /api/technician-sessions/:sessionId/update-step
 * against two real tables, `technician_ticket_sessions` and `workflow_steps`
 * (shared/enhanced-service-schema.ts). So this is a port, not a removal.
 *
 * WHY THE WORKFLOW IS BROKEN EVERYWHERE ANYWAY. The page calls three URLs and
 * only one of them has ever existed:
 *   GET  /api/technician-sessions/:ticketId            <- no such Express route
 *                                                        (Express spells it
 *                                                        /api/service-tickets/:ticketId/session)
 *   GET  /api/technician-sessions/:sessionId/workflow-steps  <- matches
 *   POST /api/technician-sessions/:sessionId/complete-step   <- Express says update-step
 * Two of the three 404 in dev as well as prod. This function serves the shape
 * the page actually calls — the EDGE-005a rule: the frontend's URLs are the
 * contract, and a handler that answers a URL nobody calls is not parity.
 *
 * CHECK-IN MOVES HERE from /api/service-tickets/:ticketId/check-in. It is the
 * first action of this workflow, and /api/service-tickets is not proxied, so
 * leaving it there would split one feature across two functions with different
 * deploy paths. Nothing regresses: that URL was already broken in BOTH
 * environments (see the checkIn() comment).
 *
 * `complete-step` HAS NO SHIPPED BEHAVIOUR TO PRESERVE. Express's `update-step`
 * has zero callers anywhere in the repo, and its own logic never completes a
 * step it did not already have a row for: it inserts the new row with
 * step_completed NULL, so the page's progress list stays empty forever. Since no
 * user has ever hit this path there is nothing to be faithful to, so this
 * implementation does what the endpoint's name says — a step with no row is
 * inserted already completed. Called out because it is a deliberate divergence
 * from the Express handler, not an oversight.
 *
 * TENANT SCOPING IS TIGHTER THAN EXPRESS. The Express session lookup and the
 * step/session updates filter on serviceTicketId/technicianId/sessionId but NOT
 * on tenantId. Every query here is tenant-scoped, per the repo's "every query
 * MUST filter by tenantId" rule. That can only narrow what a caller can reach.
 *
 * All three endpoints ship together: a proxy entry forwards the whole prefix and
 * falls through only on a network error, never a 404, so a partial port would
 * take workflow-steps from working-in-dev to 404-in-dev.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  isKnownStepName,
  parseArrivalTime,
  parseGpsLocation,
  ticketStatusForStep,
  toCamelSession,
  toCamelWorkflowStep,
} from './sessions.ts';

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
    const { parts } = normalizePath(url.pathname, 'technician-sessions');
    const [id, action] = parts;
    const method = req.method.toUpperCase();

    if (method === 'GET' && id && !action) {
      return await getSessionForTicket(admin, tenantId, user.id, id, req);
    }

    if (method === 'GET' && id && action === 'workflow-steps') {
      return await getWorkflowSteps(admin, tenantId, id, req);
    }

    if (method === 'POST' && id && action === 'check-in') {
      return await checkIn(req, admin, tenantId, user.id, id);
    }

    if (method === 'POST' && id && action === 'complete-step') {
      return await completeStep(req, admin, tenantId, id);
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    console.error('technician-sessions error:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

/**
 * The OPEN session for this ticket and this technician — check_out_timestamp
 * IS NULL is what makes it "current". A checked-out session must not be handed
 * back or the page would resume a finished visit.
 */
async function getSessionForTicket(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  technicianId: string,
  ticketId: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('technician_ticket_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('service_ticket_id', ticketId)
    .eq('technician_id', technicianId)
    .is('check_out_timestamp', null)
    .order('check_in_timestamp', { ascending: false })
    .limit(1);
  if (error) throw error;

  if (!data || data.length === 0) {
    return createCorsResponse({ message: 'No active session found' }, 404, req);
  }
  return createCorsResponse(toCamelSession(data[0]), 200, req);
}

async function getWorkflowSteps(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  sessionId: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('workflow_steps')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
    .order('step_started', { ascending: true });
  if (error) throw error;

  return createCorsResponse((data ?? []).map(toCamelWorkflowStep), 200, req);
}

/**
 * Start (or resume) a visit. Moved here from /api/service-tickets/:id/check-in
 * on purpose: check-in is the first action of this workflow, and leaving it on a
 * prefix that is not proxied would split one feature across two functions with
 * different deploy paths. Its old home was broken in both environments anyway —
 * 404 in prod (the service-tickets edge fn has no check-in branch) and 500 in
 * dev, because Express read the technician from an `x-user-id` header the client
 * never sends, so the NOT NULL technician_id insert failed.
 *
 * The form fields are mapped onto real columns. Express passed the whole body
 * through insertTechnicianTicketSessionSchema.parse, and a Zod object strips
 * unknown keys — arrivalTime, gpsLocation and notes were all silently dropped,
 * so every check-in recorded nothing the technician had typed.
 */
async function checkIn(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  technicianId: string,
  ticketId: string,
) {
  const body = await safeJson(req);

  // An open session is RESUMED, not duplicated: a technician who reloads
  // mid-visit has to land back in the same session or their progress is orphaned.
  const { data: open, error: openError } = await admin
    .from('technician_ticket_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('service_ticket_id', ticketId)
    .eq('technician_id', technicianId)
    .is('check_out_timestamp', null)
    .order('check_in_timestamp', { ascending: false })
    .limit(1);
  if (openError) throw openError;

  if (open && open.length > 0) {
    return createCorsResponse(toCamelSession(open[0]), 200, req);
  }

  const gps = parseGpsLocation(body.gpsLocation);
  const arrival = parseArrivalTime(body.arrivalTime);

  const insert: Record<string, unknown> = {
    tenant_id: tenantId,
    service_ticket_id: ticketId,
    technician_id: technicianId,
    workflow_step: 'initial_assessment',
    check_in_notes: typeof body.notes === 'string' && body.notes ? body.notes : null,
    actual_latitude: gps.latitude,
    actual_longitude: gps.longitude,
    check_in_address: gps.address,
  };
  // Omitted rather than nulled when unparseable, so the column default (now())
  // still applies.
  if (arrival) insert.check_in_timestamp = arrival;

  const { data: created, error: createError } = await admin
    .from('technician_ticket_sessions')
    .insert(insert)
    .select()
    .single();
  if (createError) throw createError;

  await admin
    .from('service_tickets')
    .update({ status: 'on_site', updated_at: new Date().toISOString() })
    .eq('id', ticketId)
    .eq('tenant_id', tenantId);

  // The first guided step is opened so the page has a row to complete.
  await admin.from('workflow_steps').insert({
    tenant_id: tenantId,
    session_id: created.id,
    step_name: 'initial_assessment',
    step_data: {},
  });

  return createCorsResponse(toCamelSession(created), 201, req);
}

async function completeStep(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  sessionId: string,
) {
  const body = await safeJson(req);
  const stepName = body.stepName;
  const stepData = body.stepData ?? null;
  const notes = typeof body.notes === 'string' ? body.notes : null;

  if (!isKnownStepName(stepName)) {
    return createCorsResponse(
      { message: 'stepName must be one of the guided workflow steps' },
      400,
      req,
    );
  }

  // Resolve the session first: it is both the 404 and the tenant check, and it
  // yields the ticket id without trusting anything in the body.
  const { data: session, error: sessionError } = await admin
    .from('technician_ticket_sessions')
    .select('id, service_ticket_id')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) {
    return createCorsResponse({ message: 'Session not found' }, 404, req);
  }

  const completedAt = new Date().toISOString();

  const { error: sessionUpdateError } = await admin
    .from('technician_ticket_sessions')
    .update({ workflow_step: stepName, updated_at: completedAt })
    .eq('id', sessionId)
    .eq('tenant_id', tenantId);
  if (sessionUpdateError) throw sessionUpdateError;

  // Existence is checked BEFORE the completion write. Express checked after,
  // which made the two branches indistinguishable and left it unable to tell a
  // step it had just completed from one that was never started.
  const { data: existing, error: existingError } = await admin
    .from('workflow_steps')
    .select('id, step_completed')
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
    .eq('step_name', stepName);
  if (existingError) throw existingError;

  if (!existing || existing.length === 0) {
    const { error: insertError } = await admin.from('workflow_steps').insert({
      tenant_id: tenantId,
      session_id: sessionId,
      step_name: stepName,
      step_started: completedAt,
      step_completed: completedAt,
      step_data: stepData,
      notes,
    });
    if (insertError) throw insertError;
  } else {
    const { error: updateError } = await admin
      .from('workflow_steps')
      .update({ step_completed: completedAt, step_data: stepData, notes })
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .eq('step_name', stepName)
      .is('step_completed', null);
    if (updateError) throw updateError;
  }

  const newStatus = ticketStatusForStep(stepName);
  const { error: ticketError } = await admin
    .from('service_tickets')
    .update({ status: newStatus, updated_at: completedAt })
    .eq('id', session.service_ticket_id)
    .eq('tenant_id', tenantId);
  if (ticketError) throw ticketError;

  return createCorsResponse({ success: true, stepName, ticketStatus: newStatus }, 200, req);
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
