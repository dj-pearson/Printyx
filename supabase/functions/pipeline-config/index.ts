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
 * Transaction note: supabase-js has no client-side transactions, so multi-step
 * writes (create-template-with-stages, clone, transition, reorder) run as
 * sequential operations. If a step fails mid-sequence the preceding writes
 * stay committed. For true atomicity, wrap the operation in a Postgres
 * function. Flagged as a follow-up — the Express implementation had the same
 * pattern before this port.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('pipeline-config');

function stripPrefix(path: string): string {
  return path.replace(/^\/+/, '/').replace(/^\/pipeline-config/, '') || '/';
}

serve(async (req) => {
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

      const original = await db
        .from('pipeline_templates')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .limit(1)
        .maybeSingle();

      if (original.error) {
        return errorResponse(500, 'Failed to load original template', req, {
          code: 'DB_ERROR',
          details: original.error,
          requestId,
        });
      }
      if (!original.data) {
        return errorResponse(404, 'Pipeline template not found', req, {
          code: 'NOT_FOUND',
          requestId,
        });
      }

      const originalTpl = original.data as { name: string; pipeline_type: string };

      const clonedTpl = await db
        .from('pipeline_templates')
        .insert({
          tenant_id: ctx.tenantId,
          name: newName,
          description: `Cloned from ${originalTpl.name}`,
          pipeline_type: originalTpl.pipeline_type,
          is_default: false,
          is_active: true,
        })
        .select()
        .single();

      if (clonedTpl.error || !clonedTpl.data) {
        return errorResponse(500, 'Failed to clone template', req, {
          code: 'DB_ERROR',
          details: clonedTpl.error,
          requestId,
        });
      }

      const cloned = clonedTpl.data as { id: string };
      const stages = await db
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_template_id', id)
        .order('order', { ascending: true });

      if (stages.error) {
        return errorResponse(500, 'Cloned template, but failed to load source stages', req, {
          code: 'PARTIAL_DB_ERROR',
          details: stages.error,
          requestId,
        });
      }

      const clonedStages = (stages.data ?? []).map((s: Record<string, unknown>) => ({
        tenant_id: ctx.tenantId,
        pipeline_template_id: cloned.id,
        name: s.name,
        display_name: s.display_name,
        description: s.description,
        order: s.order,
        color: s.color,
        icon: s.icon,
        stage_type: s.stage_type,
        is_final_stage: s.is_final_stage,
        automation_triggers: s.automation_triggers,
        required_fields: s.required_fields,
        sla_enabled: s.sla_enabled,
        sla_days: s.sla_days,
        default_probability: s.default_probability,
        allowed_transitions: s.allowed_transitions,
      }));

      let clonedStageRows: unknown[] = [];
      if (clonedStages.length > 0) {
        const stageInsert = await db.from('pipeline_stages').insert(clonedStages).select();
        if (stageInsert.error) {
          return errorResponse(500, 'Cloned template, but failed to clone stages', req, {
            code: 'PARTIAL_DB_ERROR',
            details: stageInsert.error,
            requestId,
          });
        }
        clonedStageRows = stageInsert.data ?? [];
      }

      return jsonResponse({ ...clonedTpl.data, stages: clonedStageRows }, 201, req, requestId);
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

      // No transaction support — run sequentially; any failure leaves a
      // partial reorder. Client should re-run on failure.
      for (const s of body.stages as Array<{ id: string; order: number }>) {
        const { error } = await db
          .from('pipeline_stages')
          .update({ order: s.order, updated_at: new Date().toISOString() })
          .eq('id', s.id)
          .eq('tenant_id', ctx.tenantId);
        if (error) {
          return errorResponse(500, 'Reorder failed partway through', req, {
            code: 'PARTIAL_DB_ERROR',
            details: { failedStageId: s.id, error },
            requestId,
          });
        }
      }
      return jsonResponse({ message: 'Stages reordered successfully' }, 200, req, requestId);
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

      const deal = await db
        .from('deals')
        .select('id, current_stage_id, created_at, updated_at')
        .eq('id', dealId)
        .eq('tenant_id', ctx.tenantId)
        .limit(1)
        .maybeSingle();

      if (deal.error) {
        return errorResponse(500, 'Failed to load deal', req, {
          code: 'DB_ERROR',
          details: deal.error,
          requestId,
        });
      }
      if (!deal.data) {
        return errorResponse(404, 'Deal not found', req, { code: 'NOT_FOUND', requestId });
      }

      const fromStageId = (deal.data as { current_stage_id: string | null }).current_stage_id;

      const fromStage = fromStageId
        ? await db
            .from('pipeline_stages')
            .select('id, display_name')
            .eq('id', fromStageId)
            .limit(1)
            .maybeSingle()
        : { data: null, error: null };

      const toStage = await db
        .from('pipeline_stages')
        .select(
          'id, name, display_name, default_probability, automation_triggers, sla_enabled, sla_days',
        )
        .eq('id', toStageId)
        .limit(1)
        .maybeSingle();

      if (toStage.error || !toStage.data) {
        return errorResponse(404, 'Target stage not found', req, {
          code: 'NOT_FOUND',
          requestId,
        });
      }
      const to = toStage.data as {
        name: string;
        display_name: string;
        default_probability: number;
        automation_triggers: unknown;
        sla_enabled: boolean | null;
        sla_days: number | null;
      };

      // Duration since the deal last moved (rough — matches Express)
      const baseTimeISO =
        (deal.data as { updated_at?: string; created_at?: string }).updated_at ??
        (deal.data as { created_at?: string }).created_at ??
        new Date().toISOString();
      const durationDays = fromStageId
        ? Math.floor((Date.now() - new Date(baseTimeISO).getTime()) / 86400000)
        : 0;

      // 1. Write history
      const histRow = await db.from('deal_stage_history').insert({
        tenant_id: ctx.tenantId,
        deal_id: dealId,
        from_stage_id: fromStageId,
        from_stage_name: (fromStage.data as { display_name?: string } | null)?.display_name ?? null,
        to_stage_id: toStageId,
        to_stage_name: to.display_name,
        transitioned_by_id: ctx.userId,
        transitioned_by_name: ctx.email ?? null,
        notes,
        duration_days: durationDays,
      });
      if (histRow.error) {
        log.warn({ requestId, err: histRow.error }, 'stage history insert failed');
      }

      // 2. Update deal
      const dealUpdate: Record<string, unknown> = {
        current_stage_id: toStageId,
        stage: to.name,
        probability: to.default_probability,
        updated_at: new Date().toISOString(),
      };
      if (to.sla_enabled && to.sla_days) {
        const slaDeadline = new Date(Date.now() + to.sla_days * 86400000).toISOString();
        dealUpdate.sla_deadline = slaDeadline;
      }
      const dealUpd = await db
        .from('deals')
        .update(dealUpdate)
        .eq('id', dealId)
        .eq('tenant_id', ctx.tenantId);

      if (dealUpd.error) {
        return errorResponse(500, 'Failed to update deal stage', req, {
          code: 'DB_ERROR',
          details: dealUpd.error,
          requestId,
        });
      }

      // 3. Log automation triggers (on_enter). Actual execution is left as
      // a follow-up — matches Express TODO.
      if (Array.isArray(to.automation_triggers)) {
        for (const trigger of to.automation_triggers as Array<{
          triggerType?: string;
          actionType?: string;
          actionConfig?: unknown;
          isActive?: boolean;
        }>) {
          if (trigger.triggerType === 'on_enter' && trigger.isActive) {
            const autoLog = await db.from('pipeline_automation_logs').insert({
              tenant_id: ctx.tenantId,
              deal_id: dealId,
              stage_id: toStageId,
              trigger_type: trigger.triggerType,
              action_type: trigger.actionType,
              action_config: trigger.actionConfig,
              status: 'pending',
              triggered_by_id: ctx.userId,
            });
            if (autoLog.error) {
              log.warn({ requestId, err: autoLog.error }, 'automation log insert failed');
            }
          }
        }
      }

      return jsonResponse({ message: 'Deal transitioned successfully' }, 200, req, requestId);
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
        .order('transitioned_at', { ascending: false });

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
});
