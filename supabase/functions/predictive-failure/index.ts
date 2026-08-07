/**
 * Predictive equipment-failure edge function (PROD-010) — port of
 * server/routes-predictive-failure-dispatch.ts.
 *
 * WHY: the domain had an Express handler and NO edge function, so
 * pages/ServicePredictions.tsx worked in dev and hard-404'd in production, where
 * getApiUrl() rewrites /api/predictive-failure -> functions.printyx.net/predictive-failure
 * with no Express fallback.
 *
 * ROUTES — all eight Express endpoints, which covers everything the page calls:
 *   POST /score                          run scoring; honors the agent kill switch
 *   GET  /predictions?status=            list, confidence x contract value desc
 *   POST /predictions/:id/approve        dispatch the linked draft ticket
 *   POST /predictions/:id/snooze         { until }
 *   POST /predictions/:id/dismiss
 *   GET  /settings                       kill switch + confidence threshold
 *   PUT  /settings
 *   GET  /accuracy                       per-model precision vs closed tickets
 *
 * KILL SWITCH: POST /score returns { skipped: true, reason: 'agent_disabled' }
 * when predictive_dispatch_settings.agent_enabled is false, WITHOUT scoring or
 * creating tickets. This endpoint dispatches technicians, so the pause has to be
 * honored on the edge path exactly as it is in Express — a port that silently
 * ignored it would make the pause button a no-op in production.
 *
 * SHAPE: rows are mapped explicitly to the camelCase the page reads, NOT run
 * through a key converter — `signals` is a jsonb column whose inner keys are
 * snake_case by design (meter_accel, error_freq, days_since_service, model_age,
 * toner_anomaly, suggested_parts) and the page reads them at those names.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  PREDICTION_WINDOW_DAYS,
  computeAccuracy,
  scoreMachine,
  type ScoredMachine,
} from './scoring.ts';

const DAY_MS = 86_400_000;
const CLOSED_TICKET_STATUSES = ['completed', 'resolved', 'closed'];
/** Above this confidence an auto-created draft ticket is raised to high priority. */
const HIGH_PRIORITY_CONFIDENCE = 0.85;

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const asDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

const suggestedPartsOf = (signals: unknown): string[] => {
  const s = signals as { suggested_parts?: unknown } | null;
  return Array.isArray(s?.suggested_parts) ? (s!.suggested_parts as string[]) : [];
};

const toSettings = (row: Record<string, unknown> | null) =>
  row
    ? {
        tenantId: row.tenant_id,
        agentEnabled: row.agent_enabled,
        confidenceThreshold: row.confidence_threshold,
        pausedAt: row.paused_at ?? null,
        pausedReason: row.paused_reason ?? null,
        updatedAt: row.updated_at,
      }
    : null;

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
    const { parts } = normalizePath(url.pathname, 'predictive-failure');
    const [first, second, third] = parts;
    const method = req.method.toUpperCase();

    // --- POST /score -------------------------------------------------------
    if (method === 'POST' && first === 'score') {
      return await handleScore(req, admin, tenantId, user.id);
    }

    // --- POST /predictions/:id/{approve,snooze,dismiss} --------------------
    // Matched before the bare list so an action is never read as a filter.
    if (method === 'POST' && first === 'predictions' && second && third) {
      return await handlePredictionAction(req, admin, tenantId, user.id, second, third);
    }

    // --- GET /predictions --------------------------------------------------
    if (method === 'GET' && first === 'predictions' && !second) {
      const status = url.searchParams.get('status') ?? undefined;

      let query = admin
        .from('equipment_failure_predictions')
        .select(
          'id, machine_id, confidence, contract_value, signals, service_ticket_id, status, outcome, predicted_window_start, predicted_window_end, snoozed_until, reviewed_by_user_id, reviewed_at, generated_at',
        )
        .eq('tenant_id', tenantId);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;

      const rows = data ?? [];
      const machines = await equipmentById(
        admin,
        tenantId,
        rows.map((r: Record<string, unknown>) => String(r.machine_id)),
      );

      const result = rows
        .map((r: Record<string, unknown>) => {
          const confidence = num(r.confidence);
          const contractValue = num(r.contract_value);
          const eq = machines.get(String(r.machine_id));
          return {
            id: r.id,
            machineId: r.machine_id,
            confidence,
            contractValue,
            signals: r.signals ?? null,
            serviceTicketId: r.service_ticket_id ?? null,
            status: r.status,
            outcome: r.outcome ?? null,
            predictedWindowStart: r.predicted_window_start ?? null,
            predictedWindowEnd: r.predicted_window_end ?? null,
            snoozedUntil: r.snoozed_until ?? null,
            reviewedByUserId: r.reviewed_by_user_id ?? null,
            reviewedAt: r.reviewed_at ?? null,
            generatedAt: r.generated_at ?? null,
            serialNumber: eq?.serial_number ?? null,
            model: eq?.model_number ?? null,
            manufacturer: eq?.manufacturer ?? null,
            location: eq?.location_description ?? null,
            priorityScore: confidence * contractValue,
            suggestedParts: suggestedPartsOf(r.signals),
          };
        })
        // Express sorted by confidence x contract_value in SQL; PostgREST cannot
        // order by an expression, so the same ordering is applied here.
        .sort((a, b) => b.priorityScore - a.priorityScore);

      return createCorsResponse({ data: result, total: result.length }, 200, req);
    }

    // --- GET /settings -----------------------------------------------------
    if (method === 'GET' && first === 'settings') {
      const settings = await getOrCreateSettings(admin, tenantId);
      return createCorsResponse(toSettings(settings), 200, req);
    }

    // --- PUT /settings -----------------------------------------------------
    if (method === 'PUT' && first === 'settings') {
      const body = await safeJson(req);

      const errors: Record<string, string> = {};
      if (body.agentEnabled !== undefined && typeof body.agentEnabled !== 'boolean') {
        errors.agentEnabled = 'must be a boolean';
      }
      if (
        body.confidenceThreshold !== undefined &&
        (typeof body.confidenceThreshold !== 'number' ||
          body.confidenceThreshold < 0 ||
          body.confidenceThreshold > 1)
      ) {
        errors.confidenceThreshold = 'must be a number 0..1';
      }
      if (Object.keys(errors).length) {
        return createCorsResponse({ message: 'Invalid input', errors }, 400, req);
      }

      await getOrCreateSettings(admin, tenantId);

      const updates: Record<string, unknown> = {
        updated_by_user_id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (body.agentEnabled !== undefined) {
        updates.agent_enabled = body.agentEnabled;
        // Record WHEN and WHY the agent was paused; clear both on resume so a
        // stale reason never reads as current.
        updates.paused_at = body.agentEnabled ? null : new Date().toISOString();
        updates.paused_reason = body.agentEnabled
          ? null
          : typeof body.pausedReason === 'string'
            ? body.pausedReason.slice(0, 500)
            : null;
      }
      if (body.confidenceThreshold !== undefined) {
        updates.confidence_threshold = body.confidenceThreshold;
      }

      const { data, error } = await admin
        .from('predictive_dispatch_settings')
        .update(updates)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();
      if (error) throw error;

      return createCorsResponse(toSettings(data ?? null), 200, req);
    }

    // --- GET /accuracy -----------------------------------------------------
    if (method === 'GET' && first === 'accuracy') {
      const { data: preds, error } = await admin
        .from('equipment_failure_predictions')
        .select('id, machine_id, generated_at, status')
        .eq('tenant_id', tenantId);
      if (error) throw error;

      const rows = preds ?? [];
      const machineIds = Array.from(
        new Set(rows.map((p: Record<string, unknown>) => String(p.machine_id))),
      );
      const machines = await equipmentById(admin, tenantId, machineIds);

      let closedTickets: Array<Record<string, unknown>> = [];
      if (machineIds.length > 0) {
        const { data: tickets } = await admin
          .from('service_tickets')
          .select('equipment_id, resolved_at, created_at, status')
          .eq('tenant_id', tenantId)
          .in('equipment_id', machineIds)
          .in('status', CLOSED_TICKET_STATUSES);
        closedTickets = tickets ?? [];
      }

      const perModel = computeAccuracy(
        rows.map((p: Record<string, unknown>) => ({
          machineId: String(p.machine_id),
          generatedAt: asDate(p.generated_at),
          model: (machines.get(String(p.machine_id))?.model_number as string) ?? null,
        })),
        closedTickets.map((t) => ({
          equipmentId: t.equipment_id ? String(t.equipment_id) : null,
          resolvedAt: asDate(t.resolved_at),
          createdAt: asDate(t.created_at),
        })),
      );

      const totals = perModel.reduce(
        (acc, m) => {
          acc.predictions += m.predictions;
          acc.truePositives += m.truePositives;
          acc.falsePositives += m.falsePositives;
          return acc;
        },
        { predictions: 0, truePositives: 0, falsePositives: 0 },
      );

      return createCorsResponse(
        {
          perModel,
          totals: {
            ...totals,
            precision: totals.predictions > 0 ? totals.truePositives / totals.predictions : 0,
          },
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('predictive-failure function error:', message);
    return createCorsResponse(
      { message: 'Predictive-failure request failed', error: message },
      500,
      req,
    );
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

async function handleScore(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  userId: string,
): Promise<Response> {
  const settings = await getOrCreateSettings(admin, tenantId);
  if (!settings) {
    return createCorsResponse({ message: 'Failed to load dispatch settings' }, 500, req);
  }

  // Kill switch — must short-circuit BEFORE any scoring or ticket creation.
  if (settings.agent_enabled === false) {
    return createCorsResponse(
      { skipped: true, reason: 'agent_disabled', created: 0, predictions: [] },
      200,
      req,
    );
  }

  const threshold = num(settings.confidence_threshold) || DEFAULT_CONFIDENCE_THRESHOLD;
  const nowMs = Date.now();
  const ninetyDaysAgo = new Date(nowMs - 90 * DAY_MS).toISOString();

  const { data: machines } = await admin
    .from('equipment')
    .select('id, customer_id, install_date, last_service_date, monthly_payment')
    .eq('tenant_id', tenantId)
    .eq('equipment_status', 'active');

  const scored: ScoredMachine[] = [];

  for (const m of machines ?? []) {
    const machineId = String(m.id);

    // Newest-first, then the scorer re-sorts ascending — this keeps the LAST 12
    // readings rather than the first 12, which is what the deltas need.
    const { data: meterRows } = await admin
      .from('meter_readings')
      .select('reading_date, bw_meter_reading, color_meter_reading')
      .eq('tenant_id', tenantId)
      .eq('equipment_id', machineId)
      .order('reading_date', { ascending: false })
      .limit(12);

    const { data: recentTickets } = await admin
      .from('service_tickets')
      .select('status, created_at, description')
      .eq('tenant_id', tenantId)
      .eq('equipment_id', machineId)
      .gte('created_at', ninetyDaysAgo);

    scored.push(
      scoreMachine({
        machineId,
        installDate: asDate(m.install_date),
        lastServiceDate: asDate(m.last_service_date),
        // Cumulative E-Automate meter columns, NOT black_copies/color_copies —
        // both pairs exist on meter_readings and mean different things.
        meterRows: (meterRows ?? [])
          .map((r: Record<string, unknown>) => ({
            readingDate: asDate(r.reading_date),
            total: num(r.bw_meter_reading) + num(r.color_meter_reading),
          }))
          .filter((r): r is { readingDate: Date; total: number } => r.readingDate !== null),
        recentTickets: (recentTickets ?? []).map((t: Record<string, unknown>) => ({
          status: (t.status as string) ?? null,
          createdAt: asDate(t.created_at),
          description: (t.description as string) ?? null,
        })),
        contractValue: num(m.monthly_payment) * 12,
        nowMs,
      }),
    );
  }

  const windowStart = new Date(nowMs).toISOString();
  const windowEnd = new Date(nowMs + PREDICTION_WINDOW_DAYS * DAY_MS).toISOString();

  let created = 0;
  const persisted: Array<{
    id: string;
    machineId: string;
    confidence: number;
    serviceTicketId: string | null;
  }> = [];

  for (const s of scored) {
    let serviceTicketId: string | null = null;

    // Auto-create a DRAFT ticket for high-confidence predictions. A machine with
    // no customer cannot get one — service_tickets.customer_id is required.
    if (s.confidence >= threshold) {
      const machine = (machines ?? []).find(
        (m: Record<string, unknown>) => String(m.id) === s.machineId,
      );
      if (machine?.customer_id) {
        const ticketNumber = `PF-${nowMs.toString(36)}-${Math.floor(Math.random() * 1e4)
          .toString()
          .padStart(4, '0')}`;
        const { data: ticket } = await admin
          .from('service_tickets')
          .insert({
            tenant_id: tenantId,
            customer_id: machine.customer_id,
            equipment_id: s.machineId,
            ticket_number: ticketNumber,
            title: 'Predicted failure — review & dispatch',
            description: `Auto-generated by predictive-failure agent (confidence ${(s.confidence * 100).toFixed(0)}%). Suggested parts: ${
              s.signals.suggested_parts.join(', ') || 'none'
            }.`,
            priority: s.confidence >= HIGH_PRIORITY_CONFIDENCE ? 'high' : 'medium',
            // pending_review, never dispatched: a human approves before a tech rolls.
            status: 'pending_review',
            scheduled_date: windowEnd,
            required_parts: s.signals.suggested_parts,
            created_by: userId ?? 'predictive-failure-agent',
          })
          .select('id')
          .maybeSingle();
        serviceTicketId = ticket?.id ? String(ticket.id) : null;
        if (serviceTicketId) created++;
      }
    }

    const { data: row, error } = await admin
      .from('equipment_failure_predictions')
      .insert({
        tenant_id: tenantId,
        machine_id: s.machineId,
        predicted_window_start: windowStart,
        predicted_window_end: windowEnd,
        confidence: s.confidence,
        signals: s.signals,
        contract_value: s.contractValue,
        service_ticket_id: serviceTicketId,
        status: 'pending',
        generated_at: new Date(nowMs).toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (error) throw error;

    persisted.push({
      id: row?.id ? String(row.id) : '',
      machineId: s.machineId,
      confidence: s.confidence,
      serviceTicketId,
    });
  }

  return createCorsResponse(
    { skipped: false, scored: scored.length, created, threshold, predictions: persisted },
    200,
    req,
  );
}

// ---------------------------------------------------------------------------
// Prediction actions
// ---------------------------------------------------------------------------

async function handlePredictionAction(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  userId: string,
  predictionId: string,
  action: string,
): Promise<Response> {
  const { data: prediction } = await admin
    .from('equipment_failure_predictions')
    .select('id, service_ticket_id')
    .eq('id', predictionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!prediction) return createCorsResponse({ message: 'Prediction not found' }, 404, req);

  const nowIso = new Date().toISOString();
  const base: Record<string, unknown> = {
    reviewed_by_user_id: userId,
    reviewed_at: nowIso,
    updated_at: nowIso,
  };

  if (action === 'approve') {
    // Dispatch the linked draft ticket by moving it to assigned.
    if (prediction.service_ticket_id) {
      await admin
        .from('service_tickets')
        .update({ status: 'assigned', updated_at: nowIso })
        .eq('id', prediction.service_ticket_id)
        .eq('tenant_id', tenantId);
    }
    const updated = await updatePrediction(admin, tenantId, predictionId, {
      ...base,
      status: 'approved',
    });
    return createCorsResponse({ success: true, prediction: updated }, 200, req);
  }

  if (action === 'snooze') {
    const body = await safeJson(req);
    const until = asDate(body.until);
    if (!until) {
      return createCorsResponse(
        { message: 'Invalid input', errors: { until: 'must be an ISO date' } },
        400,
        req,
      );
    }
    const updated = await updatePrediction(admin, tenantId, predictionId, {
      ...base,
      status: 'snoozed',
      snoozed_until: until.toISOString(),
    });
    return createCorsResponse({ success: true, prediction: updated }, 200, req);
  }

  if (action === 'dismiss') {
    // Cancel the linked draft ticket, but ONLY while it is still pending_review.
    // The status guard matters: if the ticket was already approved and dispatched,
    // a later dismissal must not cancel work a technician may already be doing.
    // Note this does NOT set `outcome` — a reviewer dismissing a prediction is not
    // the same evidence as a confirmed false positive, and the accuracy report
    // derives outcomes from closed tickets instead.
    if (prediction.service_ticket_id) {
      await admin
        .from('service_tickets')
        .update({ status: 'cancelled', updated_at: nowIso })
        .eq('id', prediction.service_ticket_id)
        .eq('tenant_id', tenantId)
        .eq('status', 'pending_review');
    }
    const updated = await updatePrediction(admin, tenantId, predictionId, {
      ...base,
      status: 'dismissed',
    });
    return createCorsResponse({ success: true, prediction: updated }, 200, req);
  }

  return createCorsResponse({ error: 'Not found' }, 404, req);
}

async function updatePrediction(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  id: string,
  updates: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from('equipment_failure_predictions')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function equipmentById(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  ids: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await admin
    .from('equipment')
    .select('id, serial_number, model_number, manufacturer, location_description')
    .eq('tenant_id', tenantId)
    .in('id', unique);
  return new Map((data ?? []).map((e: Record<string, unknown>) => [String(e.id), e]));
}

async function getOrCreateSettings(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  const { data: existing } = await admin
    .from('predictive_dispatch_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created } = await admin
    .from('predictive_dispatch_settings')
    .insert({ tenant_id: tenantId })
    .select()
    .maybeSingle();
  if (created) return created;

  // Lost a race with a concurrent creator — re-read rather than 500.
  const { data: reread } = await admin
    .from('predictive_dispatch_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return reread ?? null;
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
