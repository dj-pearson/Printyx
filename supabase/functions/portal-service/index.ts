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
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    /**
     * THIS IS A CUSTOMER SURFACE AND EVERY BRANCH TRUSTED A CALLER-SUPPLIED ID
     * (SEC-EDGE-001). The page is routed at /portal and its own header opens
     * "the customer describes what's wrong"; all four endpoints take a
     * `requestId` and looked it up filtered on `tenant_id` ALONE - and a portal
     * customer is in the tenant. So one customer could pass another's request
     * id and read its timeline, read the free text they typed, submit a star
     * rating on their behalf, and - worst - run /classify against it, which
     * OPENS A SERVICE TICKET on that customer's account, moves their request to
     * 'assigned' and writes status history signed "AI Dispatch".
     *
     * The same defect and the same fix as customer-portal one function over:
     * `app_metadata` ONLY, because the session holder writes `user_metadata`
     * through supabase.auth.updateUser and every query below runs on the
     * SERVICE ROLE client, which bypasses RLS.
     *
     * A caller carrying a claim is a portal customer and every lookup is
     * narrowed to them. A caller with NO claim is internal staff and keeps the
     * tenant-wide view, which is what the dealer's own service console needs.
     *
     * STATED PLAINLY BECAUSE IT CHANGES THE IMPACT: nothing in this repo sets
     * `customer_id` on any user, so there are no portal customers yet and the
     * staff branch is what runs today. This closes the door before the feature
     * that opens it ships.
     */
    const claimedCustomerId = (user.app_metadata?.customer_id as string) || null;

    const url = new URL(req.url);
    // Idempotent — the dispatcher strips segment 0 before the handler runs.
    const { parts } = normalizePath(url.pathname, 'portal-service');
    const [first, second] = parts;
    const method = req.method.toUpperCase();

    if (method === 'POST' && first === 'classify') {
      return await handleClassify(req, admin, tenantId, user.id, claimedCustomerId);
    }

    if (method === 'POST' && first === 'rate') {
      return await handleRate(req, admin, tenantId, claimedCustomerId);
    }

    if (method === 'GET' && first === 'classifications' && second) {
      /**
       * `portal_service_classifications` carries no customer column, so the
       * REQUEST decides. Checked before the classification is read: a check
       * afterwards has already answered whether one exists for that id, and the
       * row holds the free text the other customer typed.
       */
      if (!(await ownsRequest(admin, tenantId, second, claimedCustomerId))) {
        return createCorsResponse({ message: 'Service request not found' }, 404, req);
      }

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
      return await handleTimeline(admin, tenantId, second, req, claimedCustomerId);
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

/**
 * The column a `customer_service_requests` row is owned through.
 *
 * Named here rather than written inline at five call sites, and asserted
 * against drizzle's own table config by
 * server/tests/unit/portal-service-customer-scope.test.ts - which is the check
 * that matters, because `check:phantom-cols` cannot resolve a column literal
 * applied inside a helper. Its first version of this scoped with a literal
 * `.eq('customer_id', ...)` in the helper body, and the guard attributed that
 * to whatever `.from()` it had last seen, reporting
 * `portal_service_classifications.customer_id` as phantom. The guard was wrong
 * and the code was right, and a false positive in a hard gate is worth
 * restructuring around rather than baselining.
 */
const CUSTOMER_OWNER_COLUMN = 'customer_id';

/**
 * Narrow a `customer_service_requests` query to the caller.
 *
 * A claim means a portal customer and the row must be theirs. No claim means
 * internal staff and the tenant filter already on the query is the boundary.
 * One definition so a fifth endpoint cannot resolve it differently - which is
 * how customer-portal ended up with five copies of the same broken chain.
 */
function scopeToCustomer<Q>(query: Q, claimedCustomerId: string | null): Q {
  return claimedCustomerId ? (query as any).eq(CUSTOMER_OWNER_COLUMN, claimedCustomerId) : query;
}

/**
 * Does this caller own the request behind an id?
 *
 * Answers 404 rather than 403 at the call sites: distinguishing "not yours"
 * from "does not exist" tells a customer which request ids are real on someone
 * else's account.
 */
async function ownsRequest(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  requestId: string,
  claimedCustomerId: string | null,
): Promise<boolean> {
  const { data, error } = await scopeToCustomer(
    admin
      .from('customer_service_requests')
      .select('id')
      .eq('id', requestId)
      .eq('tenant_id', tenantId)
      .limit(1),
    claimedCustomerId,
  );
  // Fail CLOSED: an ownership check that says yes when the database is
  // unreachable is not a check.
  if (error) return false;
  return ((data ?? []) as unknown[]).length > 0;
}

// ---------------------------------------------------------------------------
// Classify (+ best-effort dispatch)
// ---------------------------------------------------------------------------

async function handleClassify(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  userId: string,
  claimedCustomerId: string | null,
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

  // Scoped BEFORE anything is created. This branch opens a service ticket,
  // moves the request to 'assigned' and writes status history, so an unscoped
  // lookup here is not a read leak - it is a write against another customer's
  // account.
  const { data: request } = await scopeToCustomer(
    admin
      .from('customer_service_requests')
      .select('id, customer_id, title, equipment_id, status')
      .eq('id', requestId)
      .eq('tenant_id', tenantId),
    claimedCustomerId,
  ).maybeSingle();
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

    // Transitively scoped already - the read above proved ownership - but
    // filtered again anyway: proving a preceding check is more expensive than
    // repeating the filter, and the next edit that moves the read would not
    // notice it had taken the boundary with it.
    const { error: updErr } = await scopeToCustomer(
      admin
        .from('customer_service_requests')
        .update({
          priority: toRequestPriority(classification.suggestedPriority),
          ...(suggestedTechId ? { assigned_technician_id: suggestedTechId } : {}),
          ...(serviceTicketId ? { service_ticket_id: serviceTicketId } : {}),
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('tenant_id', tenantId),
      claimedCustomerId,
    );
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
  claimedCustomerId: string | null,
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

  // Scoped on the WRITE, not by a preceding read: a rating is one statement
  // and the filter is the authorization (SEC-TENANT-005).
  const { data: updated, error } = await scopeToCustomer(
    admin
      .from('customer_service_requests')
      .update({
        customer_rating: rating,
        ...(feedback ? { customer_feedback: feedback } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('tenant_id', tenantId),
    claimedCustomerId,
  )
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
  claimedCustomerId: string | null,
): Promise<Response> {
  const { data: request } = await scopeToCustomer(
    admin
      .from('customer_service_requests')
      .select('id, status')
      .eq('id', requestId)
      .eq('tenant_id', tenantId),
    claimedCustomerId,
  ).maybeSingle();
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
