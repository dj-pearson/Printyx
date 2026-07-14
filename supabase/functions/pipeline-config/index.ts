/**
 * Pipeline Configuration edge function.
 *
 * Replaces server/routes-pipeline-configuration.ts. 15 endpoints:
 *
 *   Templates (6):
 *     GET    /pipeline-config/templates                  — list
 *     GET    /pipeline-config/templates/:id              — detail + stages
 *     POST   /pipeline-config/templates                  — create (+ stages)
 *     PUT    /pipeline-config/templates/:id              — update
 *     DELETE /pipeline-config/templates/:id              — soft-delete (isActive=false)
 *     POST   /pipeline-config/templates/:id/clone        — deep copy
 *
 *   Stages (5):
 *     GET    /pipeline-config/stages/:templateId         — list for template
 *     POST   /pipeline-config/stages                     — create
 *     PUT    /pipeline-config/stages/reorder             — bulk reorder (routed before :id)
 *     PUT    /pipeline-config/stages/:id                 — update
 *     DELETE /pipeline-config/stages/:id                 — delete (guards against in-use)
 *
 *   Deal transitions (2):
 *     POST   /pipeline-config/deals/:dealId/transition   — move stage + log + automation
 *     GET    /pipeline-config/deals/:dealId/history      — transition log
 *
 *   Analytics (2):
 *     GET    /pipeline-config/analytics/conversion       — rpc
 *     GET    /pipeline-config/analytics/velocity         — rpc
 *
 * Transaction note: multi-step writes (clone, transition, reorder) go
 * through PL/pgSQL functions in `drizzle/functions/pipeline-config.sql`.
 * One `.rpc()` call = one transaction. See `pipeline_template_clone`,
 * `pipeline_deal_transition`, `pipeline_stages_reorder`.
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('pipeline-config');

function stripPrefix(path: string): string {
  return path.replace(/^\/+/, '/').replace(/^\/pipeline-config/, '') || '/';
}

// CRMX-005: idempotently mirror a tenant's legacy deal_stages into the canonical
// pipeline_templates + pipeline_stages model, carrying legacy_stage_id so existing
// deals (deal.stage_id = deal_stages.id) resolve to a canonical stage without a
// deal-row migration. Returns the default template + its stages. If the tenant has
// no deal_stages, returns an empty stage list and the board keeps its prior behavior.
// deno-lint-ignore no-explicit-any
async function ensureCanonicalPipeline(db: any, tenantId: string, userId: string) {
  const { data: legacyStages } = await db
    .from('deal_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Default template (create one if none exists).
  let { data: template } = await db
    .from('pipeline_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();
  if (!template) {
    const { data: anyTemplate } = await db
      .from('pipeline_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    template = anyTemplate;
  }
  if (!template) {
    const { data: created } = await db
      .from('pipeline_templates')
      .insert({
        tenant_id: tenantId,
        name: 'Default Sales Pipeline',
        is_active: true,
        is_default: true,
        created_by: userId,
      })
      .select()
      .single();
    template = created;
  }
  if (!template) return { template: null, stages: [] };

  const { data: existing } = await db
    .from('pipeline_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('pipeline_template_id', template.id);
  const byLegacy = new Set((existing ?? []).map((s: any) => s.legacy_stage_id));

  const toInsert = (legacyStages ?? [])
    .filter((ds: any) => !byLegacy.has(ds.id))
    .map((ds: any) => ({
      tenant_id: tenantId,
      pipeline_template_id: template.id,
      name: ds.name,
      display_name: ds.name,
      color: ds.color ?? '#3B82F6',
      order: ds.sort_order ?? 0,
      is_final_stage: !!ds.is_closing_stage,
      is_closed_won: !!ds.is_won_stage,
      is_closed_lost: !!ds.is_closing_stage && !ds.is_won_stage,
      default_probability: ds.is_won_stage ? 100 : ds.is_closing_stage ? 0 : 50,
      include_in_forecast: true,
      legacy_stage_id: ds.id,
    }));
  if (toInsert.length) {
    await db.from('pipeline_stages').insert(toInsert);
  }

  const { data: stages } = await db
    .from('pipeline_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('pipeline_template_id', template.id)
    .order('order', { ascending: true });

  return { template, stages: stages ?? [] };
}

export default async function handler(req: Request) {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = generateRequestId();
  const startedAt = Date.now();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = stripPrefix(url.pathname);

  log.info({ requestId, method, path }, 'request_received');

  try {
    const ctx = await requireAuth(req);
    const db = getDb();

    // ─── GET /templates ─────────────────────────────────────────────────────
    if (path === '/templates' && method === 'GET') {
      const { data, error } = await db
        .from('pipeline_templates')
        .select('*')
        .eq('tenant_id', ctx.tenantId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        return errorResponse(500, 'Failed to fetch pipeline templates', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // ─── POST /templates ────────────────────────────────────────────────────
    if (path === '/templates' && method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
      }

      const { name, description, pipelineType, isDefault, stages } = body;
      if (!name || !pipelineType) {
        return errorResponse(400, 'Name and pipeline type are required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }
      if (!Array.isArray(stages) || stages.length === 0) {
        return errorResponse(400, 'At least one stage is required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }

      // If setting as default, unset other defaults of the same type first
      if (isDefault) {
        await db
          .from('pipeline_templates')
          .update({ is_default: false })
          .eq('tenant_id', ctx.tenantId)
          .eq('pipeline_type', pipelineType);
      }

      const tplInsert = await db
        .from('pipeline_templates')
        .insert({
          tenant_id: ctx.tenantId,
          name,
          description: description ?? null,
          pipeline_type: pipelineType,
          is_default: !!isDefault,
          is_active: true,
        })
        .select()
        .single();

      if (tplInsert.error || !tplInsert.data) {
        return errorResponse(500, 'Failed to create pipeline template', req, {
          code: 'DB_ERROR',
          details: tplInsert.error,
          requestId,
        });
      }

      const tpl = tplInsert.data as { id: string };
      const stageRows = stages.map((s: Record<string, unknown>, index: number) => ({
        tenant_id: ctx.tenantId,
        pipeline_template_id: tpl.id,
        name: s.name,
        display_name: s.displayName ?? s.name,
        description: s.description ?? null,
        order: (s.order as number | undefined) ?? index,
        color: s.color ?? '#64748b',
        icon: s.icon ?? null,
        stage_type: s.stageType ?? 'open',
        is_final_stage: !!s.isFinalStage,
        automation_triggers: s.automationTriggers ?? [],
        required_fields: s.requiredFields ?? [],
        sla_enabled: !!s.slaEnabled,
        sla_days: s.slaDays ?? null,
        default_probability: (s.defaultProbability as number | undefined) ?? 50,
        allowed_transitions: s.allowedTransitions ?? [],
      }));

      const stageInsert = await db.from('pipeline_stages').insert(stageRows).select();
      if (stageInsert.error) {
        log.error({ requestId, err: stageInsert.error }, 'stages insert failed; template orphan');
        return errorResponse(500, 'Template saved but stage insert failed', req, {
          code: 'PARTIAL_DB_ERROR',
          details: stageInsert.error,
          requestId,
        });
      }

      return jsonResponse(
        { ...tplInsert.data, stages: stageInsert.data ?? [] },
        201,
        req,
        requestId,
      );
    }

    // ─── GET /templates/:id ─────────────────────────────────────────────────
    const tplGet = path.match(/^\/templates\/([^/]+)$/);
    if (tplGet && method === 'GET') {
      const id = tplGet[1];
      const tpl = await db
        .from('pipeline_templates')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .limit(1)
        .maybeSingle();

      if (tpl.error) {
        return errorResponse(500, 'Failed to fetch pipeline template', req, {
          code: 'DB_ERROR',
          details: tpl.error,
          requestId,
        });
      }
      if (!tpl.data) {
        return errorResponse(404, 'Pipeline template not found', req, {
          code: 'NOT_FOUND',
          requestId,
        });
      }

      const stages = await db
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_template_id', id)
        .order('order', { ascending: true });

      return jsonResponse({ ...tpl.data, stages: stages.data ?? [] }, 200, req, requestId);
    }

    // ─── PUT /templates/:id ─────────────────────────────────────────────────
    if (tplGet && method === 'PUT') {
      const id = tplGet[1];
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
      }

      // Verify ownership + read pipeline_type for the default-unset branch
      const existing = await db
        .from('pipeline_templates')
        .select('id, is_default, pipeline_type')
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .limit(1)
        .maybeSingle();

      if (existing.error) {
        return errorResponse(500, 'Failed to load template', req, {
          code: 'DB_ERROR',
          details: existing.error,
          requestId,
        });
      }
      if (!existing.data) {
        return errorResponse(404, 'Pipeline template not found', req, {
          code: 'NOT_FOUND',
          requestId,
        });
      }

      // If setting as default AND not already default, unset peers first
      if (body.isDefault && !existing.data.is_default) {
        await db
          .from('pipeline_templates')
          .update({ is_default: false })
          .eq('tenant_id', ctx.tenantId)
          .eq('pipeline_type', existing.data.pipeline_type);
      }

      const updated = await db
        .from('pipeline_templates')
        .update({
          name: body.name,
          description: body.description,
          is_default: body.isDefault,
          is_active: body.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .select()
        .single();

      if (updated.error || !updated.data) {
        return errorResponse(500, 'Failed to update pipeline template', req, {
          code: 'DB_ERROR',
          details: updated.error,
          requestId,
        });
      }
      return jsonResponse(updated.data, 200, req, requestId);
    }

    // ─── DELETE /templates/:id (soft delete) ────────────────────────────────
    if (tplGet && method === 'DELETE') {
      const id = tplGet[1];

      // Guard: refuse if any active deals use it
      const { count, error: countErr } = await db
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)
        .eq('pipeline_template_id', id);

      if (countErr) {
        return errorResponse(500, 'Failed to check deal usage', req, {
          code: 'DB_ERROR',
          details: countErr,
          requestId,
        });
      }
      if ((count ?? 0) > 0) {
        return errorResponse(
          400,
          `Cannot delete template with ${count} active deals. Deactivate instead.`,
          req,
          { code: 'TEMPLATE_IN_USE', requestId },
        );
      }

      const { error: updErr } = await db
        .from('pipeline_templates')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId);

      if (updErr) {
        return errorResponse(500, 'Failed to deactivate template', req, {
          code: 'DB_ERROR',
          details: updErr,
          requestId,
        });
      }
      return jsonResponse(
        { message: 'Pipeline template deactivated successfully' },
        200,
        req,
        requestId,
      );
    }

    // ─── POST /templates/:id/clone ──────────────────────────────────────────
    const tplClone = path.match(/^\/templates\/([^/]+)\/clone$/);
    if (tplClone && method === 'POST') {
      const id = tplClone[1];
      const body = await req.json().catch(() => null);
      const newName = body?.name as string | undefined;

      if (!newName) {
        return errorResponse(400, 'New template name is required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }

      const { data, error } = await db.rpc('pipeline_template_clone', {
        p_tenant_id: ctx.tenantId,
        p_source_id: id,
        p_new_name: newName,
      });

      if (error) {
        if (error.code === 'P0002' || String(error.message ?? '').includes('not found')) {
          return errorResponse(404, 'Pipeline template not found', req, {
            code: 'NOT_FOUND',
            requestId,
          });
        }
        return errorResponse(500, 'Failed to clone template', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }

      // Postgres function returns { template, stages } — flatten to match the
      // old shape ({ ...template, stages }).
      const result = (data ?? {}) as { template?: Record<string, unknown>; stages?: unknown[] };
      return jsonResponse(
        { ...(result.template ?? {}), stages: result.stages ?? [] },
        201,
        req,
        requestId,
      );
    }

    // ─── GET /stages/:templateId ────────────────────────────────────────────
    // Reorder path must be checked BEFORE the :id pattern — /stages/reorder
    // would otherwise match the generic GET.
    if (path === '/stages/reorder' && method === 'PUT') {
      const body = await req.json().catch(() => null);
      if (!body || !Array.isArray(body.stages)) {
        return errorResponse(400, 'Stages array is required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }

      const { data: updated, error } = await db.rpc('pipeline_stages_reorder', {
        p_tenant_id: ctx.tenantId,
        p_stages: body.stages,
      });
      if (error) {
        return errorResponse(500, 'Failed to reorder stages', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(
        { message: 'Stages reordered successfully', updated: updated ?? 0 },
        200,
        req,
        requestId,
      );
    }

    const stagesList = path.match(/^\/stages\/([^/]+)$/);
    if (stagesList && method === 'GET') {
      const templateId = stagesList[1];
      const { data, error } = await db
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_template_id', templateId)
        .eq('tenant_id', ctx.tenantId)
        .order('order', { ascending: true });

      if (error) {
        return errorResponse(500, 'Failed to fetch pipeline stages', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // ─── POST /stages ───────────────────────────────────────────────────────
    if (path === '/stages' && method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      // Express just spread req.body — replicate, but force tenant_id so
      // clients can't forge it.
      const { data, error } = await db
        .from('pipeline_stages')
        .insert({
          ...body,
          tenant_id: ctx.tenantId,
        })
        .select()
        .single();

      if (error || !data) {
        return errorResponse(500, 'Failed to create pipeline stage', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data, 201, req, requestId);
    }

    // ─── PUT /stages/:id ────────────────────────────────────────────────────
    if (stagesList && method === 'PUT') {
      const id = stagesList[1];
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const { data, error } = await db
        .from('pipeline_stages')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .select()
        .maybeSingle();

      if (error) {
        return errorResponse(500, 'Failed to update pipeline stage', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      if (!data) {
        return errorResponse(404, 'Stage not found', req, { code: 'NOT_FOUND', requestId });
      }
      return jsonResponse(data, 200, req, requestId);
    }

    // ─── DELETE /stages/:id ─────────────────────────────────────────────────
    if (stagesList && method === 'DELETE') {
      const id = stagesList[1];

      const { count, error: countErr } = await db
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)
        .eq('current_stage_id', id);

      if (countErr) {
        return errorResponse(500, 'Failed to check stage usage', req, {
          code: 'DB_ERROR',
          details: countErr,
          requestId,
        });
      }
      if ((count ?? 0) > 0) {
        return errorResponse(400, `Cannot delete stage with ${count} deals in it`, req, {
          code: 'STAGE_IN_USE',
          requestId,
        });
      }

      const { error } = await db
        .from('pipeline_stages')
        .delete()
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId);

      if (error) {
        return errorResponse(500, 'Failed to delete pipeline stage', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse({ message: 'Stage deleted successfully' }, 200, req, requestId);
    }

    // ─── GET /board — CRMX-005 unified deal board ───────────────────────────
    // Canonical pipeline_stages (auto-seeded from deal_stages) mapped to the board
    // shape. `id` is the legacy deal_stages.id so existing deals group correctly and
    // moves persist to deal.stage_id. Empty stages ⇒ frontend keeps its fallback.
    if (path === '/board' && method === 'GET') {
      const { template, stages } = await ensureCanonicalPipeline(db, ctx.tenantId, ctx.userId);
      // deno-lint-ignore no-explicit-any
      const boardStages = (stages as any[]).map((s) => ({
        id: s.legacy_stage_id ?? s.id,
        pipelineStageId: s.id,
        name: s.name,
        displayName: s.display_name ?? s.name,
        color: s.color,
        order: s.order,
        isClosedWon: s.is_closed_won,
        isClosedLost: s.is_closed_lost,
        defaultProbability: s.default_probability,
        includeInForecast: s.include_in_forecast,
        slaDays: s.sla_days,
        slaHours: s.sla_hours,
      }));
      return jsonResponse({ template, stages: boardStages }, 200, req, requestId);
    }

    // ─── POST /deals/:dealId/move — CRMX-005 persistent stage move ───────────
    // toStageId is the legacy deal_stages.id (the board's stage id). Persists to the
    // REAL deal.stage_id column, writes deal_stage_history, and logs on_enter
    // automation triggers to pipeline_automation_logs (executed once CRMX-008 lands).
    const dealMove = path.match(/^\/deals\/([^/]+)\/move$/);
    if (dealMove && method === 'POST') {
      const dealId = dealMove[1];
      const body = await req.json().catch(() => null);
      const toStageId = body?.toStageId as string | undefined; // legacy deal_stages.id
      if (!toStageId) {
        return errorResponse(400, 'toStageId is required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }

      const { stages } = await ensureCanonicalPipeline(db, ctx.tenantId, ctx.userId);
      // deno-lint-ignore no-explicit-any
      const resolve = (legacyId: string | null | undefined) =>
        (stages as any[]).find((s) => (s.legacy_stage_id ?? s.id) === legacyId);
      const toStage = resolve(toStageId);

      const { data: deal } = await db
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle();
      if (!deal) {
        return errorResponse(404, 'Deal not found', req, { code: 'NOT_FOUND', requestId });
      }
      const fromStage = resolve(deal.stage_id);

      // deno-lint-ignore no-explicit-any
      const patch: Record<string, any> = {
        stage_id: toStageId,
        updated_at: new Date().toISOString(),
      };
      if (toStage?.is_closed_won) {
        patch.status = 'won';
        patch.probability = 100;
        patch.actual_close_date = new Date().toISOString();
      } else if (toStage?.is_closed_lost) {
        patch.status = 'lost';
        patch.probability = 0;
        patch.actual_close_date = new Date().toISOString();
      } else {
        patch.status = 'open';
        if (toStage?.default_probability != null) patch.probability = toStage.default_probability;
      }

      const { data: updated, error: updateError } = await db
        .from('deals')
        .update(patch)
        .eq('id', dealId)
        .eq('tenant_id', ctx.tenantId)
        .select()
        .single();
      if (updateError) {
        return errorResponse(500, 'Failed to move deal', req, {
          code: 'DB_ERROR',
          details: updateError,
          requestId,
        });
      }

      // Stage history (references canonical pipeline_stages ids).
      await db.from('deal_stage_history').insert({
        tenant_id: ctx.tenantId,
        deal_id: dealId,
        from_stage_id: fromStage?.id ?? null,
        to_stage_id: toStage?.id ?? toStageId,
        from_stage_name: fromStage?.name ?? null,
        to_stage_name: toStage?.name ?? 'Unknown',
        changed_by: ctx.userId,
        was_automatic: false,
      });

      // Log on_enter automation triggers (interface for the CRMX-008 runtime).
      // deno-lint-ignore no-explicit-any
      const triggers: any[] = Array.isArray(toStage?.automation_triggers)
        ? toStage.automation_triggers
        : [];
      for (const t of triggers.filter((t) => t?.triggerType === 'on_enter')) {
        await db.from('pipeline_automation_logs').insert({
          tenant_id: ctx.tenantId,
          deal_id: dealId,
          stage_id: toStage?.id ?? null,
          trigger_type: 'on_enter',
          action_type: t?.actionType ?? 'unknown',
          action_config: t,
          status: 'skipped',
          result_data: { note: 'Queued for workflow runtime (CRMX-008); not yet executed' },
        });
      }

      return jsonResponse(updated, 200, req, requestId);
    }

    // ─── POST /deals/:dealId/transition ─────────────────────────────────────
    const dealTransition = path.match(/^\/deals\/([^/]+)\/transition$/);
    if (dealTransition && method === 'POST') {
      const dealId = dealTransition[1];
      const body = await req.json().catch(() => null);
      const toStageId = body?.toStageId as string | undefined;
      const notes = (body?.notes as string | undefined) ?? null;

      if (!toStageId) {
        return errorResponse(400, 'toStageId is required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }

      const { data, error } = await db.rpc('pipeline_deal_transition', {
        p_tenant_id: ctx.tenantId,
        p_deal_id: dealId,
        p_to_stage_id: toStageId,
        p_changed_by: ctx.userId,
        p_change_reason: notes,
      });

      if (error) {
        if (error.code === 'P0002' || String(error.message ?? '').includes('not found')) {
          return errorResponse(404, 'Deal or target stage not found', req, {
            code: 'NOT_FOUND',
            details: error,
            requestId,
          });
        }
        return errorResponse(500, 'Failed to transition deal', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }

      // Dispatch any automation actions the rpc enqueued. Done *after* the
      // transaction commits so external side effects (email, tasks) aren't
      // rolled back if a later step fails. Per-action failures update the
      // log row's status but never fail the transition response.
      const automationResult = await executePendingAutomations(db, {
        tenantId: ctx.tenantId,
        dealId,
        stageId: toStageId,
        actorUserId: ctx.userId,
        log,
        requestId,
      });

      return jsonResponse(
        {
          message: 'Deal transitioned successfully',
          ...(data ?? {}),
          automations: automationResult,
        },
        200,
        req,
        requestId,
      );
    }

    // ─── GET /deals/:dealId/history ─────────────────────────────────────────
    const dealHistory = path.match(/^\/deals\/([^/]+)\/history$/);
    if (dealHistory && method === 'GET') {
      const dealId = dealHistory[1];
      const { data, error } = await db
        .from('deal_stage_history')
        .select('*')
        .eq('deal_id', dealId)
        .eq('tenant_id', ctx.tenantId)
        .order('entered_at', { ascending: false });

      if (error) {
        return errorResponse(500, 'Failed to fetch deal history', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // ─── Analytics ──────────────────────────────────────────────────────────
    if (path === '/analytics/conversion' && method === 'GET') {
      const templateId = url.searchParams.get('templateId');
      const { data, error } = await db.rpc('pipeline_conversion_analytics', {
        p_tenant_id: ctx.tenantId,
        p_template_id: templateId ?? null,
      });
      if (error) {
        return errorResponse(500, 'Failed to fetch conversion analytics', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    if (path === '/analytics/velocity' && method === 'GET') {
      const templateId = url.searchParams.get('templateId');
      const { data, error } = await db.rpc('pipeline_velocity_analytics', {
        p_tenant_id: ctx.tenantId,
        p_template_id: templateId ?? null,
      });
      if (error) {
        return errorResponse(500, 'Failed to fetch velocity analytics', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path, method },
      requestId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info({ requestId, path, method, durationMs: Date.now() - startedAt }, 'request_complete');
  }
}

// ─── Automation executor ──────────────────────────────────────────────────────
//
// `pipeline_deal_transition` enqueues rows in `pipeline_automation_logs` with
// status='pending'. This helper walks those rows and dispatches the action.
// Supported action types:
//   - create_task         — insert a row in `tasks`
//   - update_deal_field   — patch a single allowed field on `deals`
//
// Everything else (send_email, send_notification, webhook, etc.) is marked
// status='not_implemented' with an error_message pointing to the Phase 3/4
// PRDs where the corresponding transport lives. Never silently dropped.
//
// Failures update the log row, they never fail the transition response.

// deno-lint-ignore no-explicit-any
type DB = any;

interface ExecuteAutomationsInput {
  tenantId: string;
  dealId: string;
  stageId: string;
  actorUserId: string;
  // deno-lint-ignore no-explicit-any
  log: any;
  requestId: string;
}

interface AutomationResult {
  considered: number;
  executed: number;
  failed: number;
  notImplemented: number;
}

const ALLOWED_DEAL_FIELDS = new Set(['priority', 'status', 'probability', 'owner_id']);

async function executePendingAutomations(
  db: DB,
  input: ExecuteAutomationsInput,
): Promise<AutomationResult> {
  const result: AutomationResult = { considered: 0, executed: 0, failed: 0, notImplemented: 0 };

  const { data: pending, error: fetchErr } = await db
    .from('pipeline_automation_logs')
    .select('id, action_type, action_config')
    .eq('tenant_id', input.tenantId)
    .eq('deal_id', input.dealId)
    .eq('stage_id', input.stageId)
    .eq('status', 'pending')
    .order('executed_at', { ascending: false })
    .limit(50);

  if (fetchErr) {
    input.log.warn({ requestId: input.requestId, err: fetchErr }, 'automation_fetch_failed');
    return result;
  }

  for (const row of pending ?? []) {
    result.considered++;
    const actionType = String(row.action_type ?? '').toLowerCase();
    const cfg = (row.action_config ?? {}) as Record<string, unknown>;

    try {
      if (actionType === 'create_task') {
        const title = String(cfg.title ?? `Follow-up: stage changed`);
        const insertErr = (
          await db.from('tasks').insert({
            tenant_id: input.tenantId,
            title,
            description: typeof cfg.description === 'string' ? cfg.description : null,
            status: 'todo',
            priority: typeof cfg.priority === 'string' ? cfg.priority : 'medium',
            assigned_to: typeof cfg.assignedTo === 'string' ? cfg.assignedTo : input.actorUserId,
            due_date:
              typeof cfg.dueInDays === 'number'
                ? new Date(Date.now() + cfg.dueInDays * 86400000).toISOString()
                : null,
            created_by: input.actorUserId,
          })
        ).error;
        if (insertErr) throw insertErr;
        await markAutomation(db, row.id, 'executed');
        result.executed++;
      } else if (actionType === 'update_deal_field') {
        const field = String(cfg.field ?? '');
        if (!ALLOWED_DEAL_FIELDS.has(field)) {
          await markAutomation(db, row.id, 'failed', `Field "${field}" not in ALLOWED_DEAL_FIELDS`);
          result.failed++;
          continue;
        }
        const updateErr = (
          await db
            .from('deals')
            .update({ [field]: cfg.value, updated_at: new Date().toISOString() })
            .eq('id', input.dealId)
            .eq('tenant_id', input.tenantId)
        ).error;
        if (updateErr) throw updateErr;
        await markAutomation(db, row.id, 'executed');
        result.executed++;
      } else {
        // Transport-heavy action types (email, sms, webhook, notification)
        // belong with the Phase 3 email-marketing / Phase 4 tasks-collab
        // infra. Mark so they're visible, not silently dropped.
        await markAutomation(
          db,
          row.id,
          'not_implemented',
          `Action type "${actionType}" requires external transport — deferred to Phase 3+`,
        );
        result.notImplemented++;
      }
    } catch (err) {
      input.log.warn(
        { requestId: input.requestId, logId: row.id, actionType, err: String(err) },
        'automation_execute_failed',
      );
      await markAutomation(db, row.id, 'failed', err instanceof Error ? err.message : String(err));
      result.failed++;
    }
  }

  return result;
}

async function markAutomation(
  db: DB,
  id: string,
  status: 'executed' | 'failed' | 'not_implemented',
  errorMessage?: string,
): Promise<void> {
  await db
    .from('pipeline_automation_logs')
    .update({
      status,
      executed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    })
    .eq('id', id);
}
