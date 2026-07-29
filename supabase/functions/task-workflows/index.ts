// Task Workflows Edge Function (TWF-### / EDGE-024).
//
// Prod parity for server/routes-task-workflows.ts: human-centric, stage-by-stage
// workflows for the Tasks module.
//
// WHY THIS EXISTS: four LIVE pages (WorkflowsListPage, WorkflowBuilderPage,
// WorkflowDetailPage, WorkflowStepPage) read and mutate /api/task-workflows/*,
// which only Express served — no edge function, so every one of them 404'd in
// PRODUCTION. It was the single worst entry on the live prod-404 list by caller
// count. Found by npm run check:routes.
//
// URL layout (all under /task-workflows):
//   GET    /                          — list (?type=instances|templates|all, ?mine=true)
//   POST   /                          — create (optionally with steps, optionally start now)
//   GET    /:id                       — workflow + steps + last 200 events
//   PATCH  /:id                       — update name/description/PM/settings/status
//   DELETE /:id                       — soft delete
//   POST   /:id/start                 — draft -> active, activate stage 0, notify
//   POST   /:id/steps                 — append steps
//   PUT    /:id/steps                 — replace all steps
//   PATCH  /:id/steps/:stepId         — edit one step
//   DELETE /:id/steps/:stepId         — remove one step
//   POST   /:id/steps/:stepId/complete
//   POST   /:id/steps/:stepId/reopen
//   POST   /:id/advance               — PM: skip the rest of the current stage
//   POST   /:id/regress               — PM: send back to an earlier stage
//   POST   /:id/save-as-template
//   POST   /from-template/:templateId
//
// NOT PORTED: POST /parse (upload an image/CSV/XLSX and have it parsed into a
// draft). It needs multipart handling plus exceljs for XLSX and the Anthropic
// SDK for images — exceljs has no drop-in Deno equivalent here, so forcing it
// would mean rewriting the parser against a different library and risking a
// silently different parse. It stays Express-only, which is why there is NO
// crmProxies entry for this prefix (a proxy forwards the whole prefix and falls
// through only on a network error, so an entry would take /parse from
// working-in-dev to 404-in-dev). /parse therefore still 404s in prod — see the
// EDGE-024 notes.
//
// THE STATE MACHINE IS A REPLICA — KEEP IT IN SYNC. shared/task-workflow-state.ts
// is canonical and is imported by server/services/task-workflow/engine.ts; Deno
// cannot import from shared/, so the stage math is duplicated below. The
// transitions are pinned by server/tests/unit/task-workflow-state.test.ts.
//
// NOTIFICATIONS: email + an in-app user_notifications row, matching
// services/task-workflow/notifier.ts. The Node notifier ALSO calls
// webSocketService.broadcastNotification, which is deliberately NOT replicated:
// PA-030 established that the WebSocket server is not deployed in prod and
// removed the notification bell's subscription, leaving a 30s poll as "the
// single freshness source until EDGE-010 swaps to Supabase Realtime". So the
// push has no prod consumer and dropping it loses nothing observable.
//
// Dir name == URL segment, so prod routing needs no server.ts override.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamelShallow } from '../_shared/case.ts';
import { sendEmail } from '../email-marketing/_sendgrid.ts';

// ── Replica of shared/task-workflow-state.ts — keep in sync (see header) ────
const TERMINAL_STEP_STATUSES = new Set(['completed', 'skipped']);
interface StateStep {
  id: string;
  stageIndex: number;
  status: string;
}
const isTerminal = (status: string) => TERMINAL_STEP_STATUSES.has(status);

function stepsInStage<T extends StateStep>(steps: T[], stageIndex: number): T[] {
  return steps.filter((s) => s.stageIndex === stageIndex);
}

function computeCurrentStageIndex<T extends StateStep>(steps: T[]): number {
  const incomplete = steps.filter((s) => !isTerminal(s.status));
  if (incomplete.length === 0) return -1;
  return Math.min(...incomplete.map((s) => s.stageIndex));
}

function isStageComplete<T extends StateStep>(steps: T[], stageIndex: number): boolean {
  return stepsInStage(steps, stageIndex).every((s) => isTerminal(s.status));
}

function applyStepCompletion<T extends StateStep>(steps: T[], stepId: string): T[] {
  return steps.map((s) => (s.id === stepId ? { ...s, status: 'completed' } : s));
}

function applyStageSkip<T extends StateStep>(steps: T[], stageIndex: number): T[] {
  return steps.map((s) =>
    s.stageIndex === stageIndex && !isTerminal(s.status) ? { ...s, status: 'skipped' } : s,
  );
}

function applyRegress<T extends StateStep>(steps: T[], toStageIndex: number): T[] {
  return steps.map((s) => (s.stageIndex >= toStageIndex ? { ...s, status: 'pending' } : s));
}

function stepsToActivate<T extends StateStep>(steps: T[], stageIndex: number): T[] {
  return stepsInStage(steps, stageIndex).filter((s) => !isTerminal(s.status));
}
// ── end replica ─────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Row = any;
const camel = (r: Row) => (r ? toCamelShallow(r) : r);
const nowIso = () => new Date().toISOString();

// Step rows as the state machine sees them: DB columns are snake_case, the
// replica above expects stageIndex, so adapt at the boundary rather than
// letting two naming schemes leak into the transition logic.
const asStateStep = (r: Row): StateStep & { row: Row } => ({
  id: r.id,
  stageIndex: r.stage_index,
  status: r.status,
  row: r,
});

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
      return createCorsResponse({ message: 'Authentication required' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Authentication required' }, 401, req);
    }

    const userId = user.id;
    const platformAdmin =
      user.app_metadata?.isPlatformAdmin === true || Number(user.app_metadata?.roleLevel) === 8;

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'task-workflows');
    const method = req.method;
    const body = ['POST', 'PUT', 'PATCH'].includes(method)
      ? await req.json().catch(() => ({}))
      : {};

    const ctx = { admin, tenantId, userId, platformAdmin, req };

    // ─── /parse — Express-only (see header) ─────────────────────────
    if (parts[0] === 'parse') {
      return createCorsResponse(
        {
          message:
            'File parsing is not available on this backend. Build the workflow steps manually.',
          notImplemented: true,
        },
        501,
        req,
      );
    }

    // ─── POST /from-template/:templateId (literal — before /:id) ────
    if (parts[0] === 'from-template' && method === 'POST') {
      return fromTemplate(ctx, parts[1], body);
    }

    // ─── GET / (list) ──────────────────────────────────────────────
    if (!parts[0] && method === 'GET') return listWorkflows(ctx, url.searchParams);

    // ─── POST / (create) ───────────────────────────────────────────
    if (!parts[0] && method === 'POST') return createWorkflow(ctx, body);

    const id = parts[0];
    if (!id) return createCorsResponse({ message: 'Not found' }, 404, req);

    // ─── /:id/steps... ─────────────────────────────────────────────
    if (parts[1] === 'steps') {
      const stepId = parts[2];
      const action = parts[3];
      if (!stepId && method === 'POST') return appendSteps(ctx, id, body);
      if (!stepId && method === 'PUT') return replaceSteps(ctx, id, body);
      if (stepId && action === 'complete' && method === 'POST')
        return completeStep(ctx, id, stepId, body);
      if (stepId && action === 'reopen' && method === 'POST') return reopenStep(ctx, id, stepId);
      if (stepId && !action && method === 'PATCH') return updateStep(ctx, id, stepId, body);
      if (stepId && !action && method === 'DELETE') return deleteStep(ctx, id, stepId);
      return createCorsResponse({ message: 'Not found' }, 404, req);
    }

    // ─── /:id/<action> ─────────────────────────────────────────────
    if (parts[1] === 'start' && method === 'POST') return startWorkflow(ctx, id);
    if (parts[1] === 'advance' && method === 'POST') return advanceWorkflow(ctx, id, body);
    if (parts[1] === 'regress' && method === 'POST') return regressWorkflow(ctx, id, body);
    if (parts[1] === 'save-as-template' && method === 'POST') return saveAsTemplate(ctx, id, body);

    // ─── /:id ──────────────────────────────────────────────────────
    if (!parts[1] && method === 'GET') return getWorkflow(ctx, id);
    if (!parts[1] && method === 'PATCH') return updateWorkflow(ctx, id, body);
    if (!parts[1] && method === 'DELETE') return deleteWorkflow(ctx, id);

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ---------------------------------------------------------------------------
// Context + shared helpers
// ---------------------------------------------------------------------------

interface Ctx {
  // deno-lint-ignore no-explicit-any
  admin: any;
  tenantId: string;
  userId: string;
  platformAdmin: boolean;
  req: Request;
}

async function loadWorkflow(ctx: Ctx, id: string): Promise<Row | null> {
  const { data } = await ctx.admin
    .from('task_workflows')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle();
  return data ?? null;
}

async function loadSteps(ctx: Ctx, workflowId: string): Promise<Row[]> {
  const { data } = await ctx.admin
    .from('task_workflow_steps')
    .select('*')
    .eq('workflow_id', workflowId)
    .eq('tenant_id', ctx.tenantId)
    .order('stage_index', { ascending: true })
    .order('order_index', { ascending: true });
  return data ?? [];
}

/** Owner, assigned PM, or platform admin — mirrors canManage() in the router. */
function canManage(ctx: Ctx, wf: Row): boolean {
  return wf.owner_id === ctx.userId || wf.project_manager_id === ctx.userId || ctx.platformAdmin;
}

async function recordEvent(
  ctx: Ctx,
  entry: {
    workflowId: string;
    stepId?: string | null;
    eventType: string;
    fromStageIndex?: number | null;
    toStageIndex?: number | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.admin.from('task_workflow_events').insert({
    tenant_id: ctx.tenantId,
    workflow_id: entry.workflowId,
    step_id: entry.stepId ?? null,
    event_type: entry.eventType,
    actor_user_id: ctx.userId,
    from_stage_index: entry.fromStageIndex ?? null,
    to_stage_index: entry.toStageIndex ?? null,
    note: entry.note ?? null,
    metadata: entry.metadata ?? {},
  });
}

/** Workflow + steps + recent events, in the shape the pages read. */
async function respondWithWorkflow(ctx: Ctx, id: string, status = 200): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  const steps = await loadSteps(ctx, id);
  return createCorsResponse({ workflow: camel(wf), steps: steps.map(camel) }, status, ctx.req);
}

// ---------------------------------------------------------------------------
// Notifications (email + in-app row; NO WebSocket — see the header)
// ---------------------------------------------------------------------------

async function notifyStepsAssigned(ctx: Ctx, wf: Row, steps: Row[]): Promise<void> {
  for (const step of steps) {
    try {
      const stepUrl = `/workflows/${wf.id}/steps/${step.id}`;

      if (step.assignee_email) {
        const due = step.due_at ? new Date(step.due_at).toLocaleDateString() : null;
        const lines = [
          `You have been assigned a task in "${wf.name}".`,
          '',
          `Task: ${step.title}`,
          step.details ? `Details: ${step.details}` : '',
          due ? `Due: ${due}` : '',
          '',
          `Open it: ${stepUrl}`,
        ].filter(Boolean);
        // Best-effort: a failed send must not roll back the transition.
        // `from` is required by SendArgs; same env fallback chain the proposals
        // fn uses. With no SENDGRID key configured, _sendgrid returns a
        // simulated result rather than throwing.
        await sendEmail({
          to: step.assignee_email,
          from:
            Deno.env.get('TASK_WORKFLOW_FROM_EMAIL') ||
            Deno.env.get('DEFAULT_FROM_EMAIL') ||
            'tasks@printyx.net',
          subject: `New task assigned — ${step.title}`,
          text: lines.join('\n'),
          html: `<p>${lines.join('<br>')}</p>`,
        }).catch(() => undefined);
      }

      if (step.assignee_user_id) {
        await ctx.admin.from('user_notifications').insert({
          tenant_id: wf.tenant_id,
          user_id: step.assignee_user_id,
          type: 'task_workflow_step_assigned',
          priority: 'medium',
          category: 'system',
          title: 'New task assigned',
          message: `${step.title} — in "${wf.name}"`,
          action_url: stepUrl,
          action_label: 'Open Task',
          metadata: { workflowId: wf.id, stepId: step.id },
        });
      }

      // Stamp notifiedAt, matching the Node notifier.
      await ctx.admin
        .from('task_workflow_steps')
        .update({ notified_at: nowIso(), updated_at: nowIso() })
        .eq('id', step.id)
        .eq('tenant_id', ctx.tenantId);
    } catch {
      // Matches the Node notifier: notification failures are logged-and-ignored,
      // never allowed to fail the state transition that triggered them.
    }
  }
}

/** Set a stage's non-terminal steps to 'active', notify, and log step_assigned. */
async function activateStage(ctx: Ctx, wf: Row, steps: Row[], stageIndex: number): Promise<void> {
  const toActivate = stepsToActivate(steps.map(asStateStep), stageIndex).map((s) => s.row);
  if (toActivate.length === 0) return;

  await ctx.admin
    .from('task_workflow_steps')
    .update({ status: 'active', updated_at: nowIso() })
    .in(
      'id',
      toActivate.map((s) => s.id),
    )
    .eq('tenant_id', ctx.tenantId);

  await notifyStepsAssigned(ctx, wf, toActivate);

  for (const step of toActivate) {
    await recordEvent(ctx, {
      workflowId: wf.id,
      stepId: step.id,
      eventType: 'step_assigned',
      toStageIndex: stageIndex,
      metadata: { assigneeUserId: step.assignee_user_id, assigneeName: step.assignee_name },
    });
  }
}

async function setCurrentStage(ctx: Ctx, workflowId: string, stageIndex: number): Promise<void> {
  await ctx.admin
    .from('task_workflows')
    .update({ current_stage_index: stageIndex, updated_at: nowIso() })
    .eq('id', workflowId)
    .eq('tenant_id', ctx.tenantId);
}

async function completeWorkflowRecord(ctx: Ctx, workflowId: string): Promise<void> {
  const now = nowIso();
  await ctx.admin
    .from('task_workflows')
    .update({ status: 'completed', current_stage_index: -1, completed_at: now, updated_at: now })
    .eq('id', workflowId)
    .eq('tenant_id', ctx.tenantId);
  await recordEvent(ctx, {
    workflowId,
    eventType: 'published',
    note: 'Workflow completed',
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function listWorkflows(ctx: Ctx, sp: URLSearchParams): Promise<Response> {
  const type = sp.get('type') || 'instances';
  const mine = sp.get('mine') === 'true';

  let q = ctx.admin
    .from('task_workflows')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null);
  if (type === 'templates') q = q.eq('is_template', true);
  else if (type === 'instances') q = q.eq('is_template', false);
  if (mine) q = q.eq('owner_id', ctx.userId);

  const { data: rows, error } = await q.order('updated_at', { ascending: false });
  if (error) return createCorsResponse({ message: error.message }, 500, ctx.req);

  const ids = (rows ?? []).map((r: Row) => r.id);
  // The Express handler does this with a GROUP BY; PostgREST has no grouping,
  // so the counts are tallied in JS over the same rows.
  const counts = new Map<string, { total: number; completed: number }>();
  if (ids.length > 0) {
    const { data: stepRows } = await ctx.admin
      .from('task_workflow_steps')
      .select('workflow_id, status')
      .eq('tenant_id', ctx.tenantId)
      .in('workflow_id', ids);
    for (const s of stepRows ?? []) {
      const c = counts.get(s.workflow_id) ?? { total: 0, completed: 0 };
      c.total += 1;
      if (s.status === 'completed') c.completed += 1;
      counts.set(s.workflow_id, c);
    }
  }

  return createCorsResponse(
    (rows ?? []).map((r: Row) => ({
      ...camel(r),
      stepCount: counts.get(r.id)?.total ?? 0,
      completedStepCount: counts.get(r.id)?.completed ?? 0,
    })),
    200,
    ctx.req,
  );
}

async function getWorkflow(ctx: Ctx, id: string): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  const steps = await loadSteps(ctx, id);
  const { data: events } = await ctx.admin
    .from('task_workflow_events')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('workflow_id', id)
    .order('created_at', { ascending: false })
    .limit(200);

  return createCorsResponse(
    { workflow: camel(wf), steps: steps.map(camel), events: (events ?? []).map(camel) },
    200,
    ctx.req,
  );
}

function stepRowsFrom(tenantId: string, workflowId: string, steps: Row[], offset = 0): Row[] {
  return steps.map((s: Row, i: number) => ({
    tenant_id: tenantId,
    workflow_id: workflowId,
    title: s.title,
    details: s.details ?? null,
    stage_index: s.stageIndex ?? offset + i,
    order_index: s.orderIndex ?? 0,
    assignee_user_id: s.assigneeUserId ?? null,
    assignee_name: s.assigneeName ?? null,
    assignee_email: s.assigneeEmail ?? null,
    due_at: s.dueAt ?? null,
    status: 'pending',
  }));
}

async function createWorkflow(ctx: Ctx, body: Row): Promise<Response> {
  if (!body?.name || typeof body.name !== 'string') {
    return createCorsResponse({ message: 'name is required' }, 400, ctx.req);
  }

  const { data: wf, error } = await ctx.admin
    .from('task_workflows')
    .insert({
      tenant_id: ctx.tenantId,
      name: body.name,
      description: body.description ?? null,
      is_template: body.isTemplate ?? false,
      template_id: body.templateId ?? null,
      owner_id: ctx.userId,
      project_manager_id: body.projectManagerId ?? null,
      source_type: body.sourceType ?? 'manual',
      source_file_name: body.sourceFileName ?? null,
      settings: body.settings ?? {},
      status: 'draft',
      current_stage_index: 0,
      created_by: ctx.userId,
      last_modified_by: ctx.userId,
    })
    .select()
    .single();

  if (error) return createCorsResponse({ message: error.message }, 500, ctx.req);

  const steps = Array.isArray(body.steps) ? body.steps : [];
  if (steps.length > 0) {
    await ctx.admin.from('task_workflow_steps').insert(stepRowsFrom(ctx.tenantId, wf.id, steps));
  }
  await recordEvent(ctx, { workflowId: wf.id, eventType: 'created' });

  if (body.startNow && !wf.is_template) return doStart(ctx, wf.id, 201);
  return respondWithWorkflow(ctx, wf.id, 201);
}

async function updateWorkflow(ctx: Ctx, id: string, body: Row): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);

  const patch: Record<string, unknown> = {
    updated_at: nowIso(),
    last_modified_by: ctx.userId,
  };
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.projectManagerId !== undefined) patch.project_manager_id = body.projectManagerId;
  if (body.settings !== undefined) patch.settings = body.settings;
  if (body.status !== undefined) patch.status = body.status;

  const { error } = await ctx.admin
    .from('task_workflows')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);
  if (error) return createCorsResponse({ message: error.message }, 500, ctx.req);

  return respondWithWorkflow(ctx, id);
}

async function deleteWorkflow(ctx: Ctx, id: string): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);

  // Soft delete, matching the router — loadWorkflow filters deleted_at IS NULL.
  await ctx.admin
    .from('task_workflows')
    .update({ deleted_at: nowIso(), updated_at: nowIso() })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);
  await recordEvent(ctx, { workflowId: id, eventType: 'archived' });
  return createCorsResponse({ success: true }, 200, ctx.req);
}

async function doStart(ctx: Ctx, id: string, okStatus = 200): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);

  const steps = await loadSteps(ctx, id);
  const first = computeCurrentStageIndex(steps.map(asStateStep));

  const now = nowIso();
  await ctx.admin
    .from('task_workflows')
    .update({
      status: 'active',
      started_at: wf.started_at ?? now,
      current_stage_index: first < 0 ? -1 : first,
      updated_at: now,
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  await recordEvent(ctx, { workflowId: id, eventType: 'started', toStageIndex: first });

  if (first >= 0) await activateStage(ctx, wf, steps, first);
  else await completeWorkflowRecord(ctx, id);

  return respondWithWorkflow(ctx, id, okStatus);
}

async function startWorkflow(ctx: Ctx, id: string): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);
  return doStart(ctx, id);
}

async function appendSteps(ctx: Ctx, id: string, body: Row): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);

  const steps = Array.isArray(body?.steps) ? body.steps : [];
  if (steps.length === 0) return respondWithWorkflow(ctx, id);

  const existing = await loadSteps(ctx, id);
  const offset = existing.length > 0 ? Math.max(...existing.map((s) => s.stage_index)) + 1 : 0;
  await ctx.admin.from('task_workflow_steps').insert(stepRowsFrom(ctx.tenantId, id, steps, offset));
  return respondWithWorkflow(ctx, id);
}

async function replaceSteps(ctx: Ctx, id: string, body: Row): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);

  const steps = Array.isArray(body?.steps) ? body.steps : [];
  await ctx.admin
    .from('task_workflow_steps')
    .delete()
    .eq('workflow_id', id)
    .eq('tenant_id', ctx.tenantId);
  if (steps.length > 0) {
    await ctx.admin.from('task_workflow_steps').insert(stepRowsFrom(ctx.tenantId, id, steps));
  }
  return respondWithWorkflow(ctx, id);
}

async function updateStep(ctx: Ctx, id: string, stepId: string, body: Row): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);

  const patch: Record<string, unknown> = { updated_at: nowIso() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.details !== undefined) patch.details = body.details;
  if (body.stageIndex !== undefined) patch.stage_index = body.stageIndex;
  if (body.orderIndex !== undefined) patch.order_index = body.orderIndex;
  if (body.assigneeUserId !== undefined) patch.assignee_user_id = body.assigneeUserId;
  if (body.assigneeName !== undefined) patch.assignee_name = body.assigneeName;
  if (body.assigneeEmail !== undefined) patch.assignee_email = body.assigneeEmail;
  if (body.dueAt !== undefined) patch.due_at = body.dueAt;

  const { error } = await ctx.admin
    .from('task_workflow_steps')
    .update(patch)
    .eq('id', stepId)
    .eq('workflow_id', id)
    .eq('tenant_id', ctx.tenantId);
  if (error) return createCorsResponse({ message: error.message }, 500, ctx.req);
  return respondWithWorkflow(ctx, id);
}

async function deleteStep(ctx: Ctx, id: string, stepId: string): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);

  await ctx.admin
    .from('task_workflow_steps')
    .delete()
    .eq('id', stepId)
    .eq('workflow_id', id)
    .eq('tenant_id', ctx.tenantId);
  return respondWithWorkflow(ctx, id);
}

async function completeStep(ctx: Ctx, id: string, stepId: string, body: Row): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);

  const steps = await loadSteps(ctx, id);
  const step = steps.find((s) => s.id === stepId);
  if (!step) return createCorsResponse({ message: 'Step not found' }, 404, ctx.req);
  // Idempotent: completing an already-complete step is a no-op, not an error.
  if (step.status === 'completed') return respondWithWorkflow(ctx, id);

  const now = nowIso();
  await ctx.admin
    .from('task_workflow_steps')
    .update({ status: 'completed', completed_at: now, completed_by: ctx.userId, updated_at: now })
    .eq('id', stepId)
    .eq('tenant_id', ctx.tenantId);

  await recordEvent(ctx, {
    workflowId: id,
    stepId,
    eventType: 'step_completed',
    fromStageIndex: step.stage_index,
    note: body?.note ?? null,
  });

  const updated = applyStepCompletion(steps.map(asStateStep), stepId);
  if (isStageComplete(updated, step.stage_index)) {
    const nextStage = computeCurrentStageIndex(updated);
    if (nextStage >= 0) {
      await setCurrentStage(ctx, id, nextStage);
      await recordEvent(ctx, {
        workflowId: id,
        eventType: 'advanced',
        fromStageIndex: step.stage_index,
        toStageIndex: nextStage,
      });
      await activateStage(
        ctx,
        wf,
        updated.map((s) => ({ ...s.row, status: s.status })),
        nextStage,
      );
    } else {
      await completeWorkflowRecord(ctx, id);
    }
  }

  return respondWithWorkflow(ctx, id);
}

async function reopenStep(ctx: Ctx, id: string, stepId: string): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);

  const steps = await loadSteps(ctx, id);
  const step = steps.find((s) => s.id === stepId);
  if (!step) return createCorsResponse({ message: 'Step not found' }, 404, ctx.req);

  const now = nowIso();
  await ctx.admin
    .from('task_workflow_steps')
    .update({ status: 'active', completed_at: null, completed_by: null, updated_at: now })
    .eq('id', stepId)
    .eq('tenant_id', ctx.tenantId);

  // Reopening can pull the workflow back out of 'completed'.
  await ctx.admin
    .from('task_workflows')
    .update({
      status: 'active',
      completed_at: null,
      current_stage_index: step.stage_index,
      updated_at: now,
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  await recordEvent(ctx, {
    workflowId: id,
    stepId,
    eventType: 'step_reopened',
    toStageIndex: step.stage_index,
  });
  await notifyStepsAssigned(ctx, wf, [{ ...step, status: 'active' }]);

  return respondWithWorkflow(ctx, id);
}

async function advanceWorkflow(ctx: Ctx, id: string, body: Row): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);

  const steps = await loadSteps(ctx, id);
  const state = steps.map(asStateStep);
  const current = computeCurrentStageIndex(state);
  if (current < 0) return respondWithWorkflow(ctx, id); // already complete

  const skipIds = stepsToActivate(state, current).map((s) => s.id);
  if (skipIds.length > 0) {
    await ctx.admin
      .from('task_workflow_steps')
      .update({ status: 'skipped', updated_at: nowIso() })
      .in('id', skipIds)
      .eq('tenant_id', ctx.tenantId);
  }

  const updated = applyStageSkip(state, current);
  const nextStage = computeCurrentStageIndex(updated);

  await recordEvent(ctx, {
    workflowId: id,
    eventType: 'advanced',
    fromStageIndex: current,
    toStageIndex: nextStage,
    note: body?.note || 'Stage advanced by project manager',
  });

  if (nextStage >= 0) {
    await setCurrentStage(ctx, id, nextStage);
    await activateStage(
      ctx,
      wf,
      updated.map((s) => ({ ...s.row, status: s.status })),
      nextStage,
    );
  } else {
    await completeWorkflowRecord(ctx, id);
  }

  return respondWithWorkflow(ctx, id);
}

async function regressWorkflow(ctx: Ctx, id: string, body: Row): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);

  const toStageIndex = Number(body?.toStageIndex);
  if (!Number.isInteger(toStageIndex) || toStageIndex < 0) {
    return createCorsResponse({ message: 'Invalid target stage' }, 400, ctx.req);
  }

  const steps = await loadSteps(ctx, id);
  const state = steps.map(asStateStep);
  const resetIds = state.filter((s) => s.stageIndex >= toStageIndex).map((s) => s.id);

  const now = nowIso();
  if (resetIds.length > 0) {
    await ctx.admin
      .from('task_workflow_steps')
      .update({ status: 'pending', completed_at: null, completed_by: null, updated_at: now })
      .in('id', resetIds)
      .eq('tenant_id', ctx.tenantId);
  }

  await ctx.admin
    .from('task_workflows')
    .update({
      current_stage_index: toStageIndex,
      status: 'active',
      completed_at: null,
      updated_at: now,
      last_modified_by: ctx.userId,
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  await recordEvent(ctx, {
    workflowId: id,
    eventType: 'regressed',
    fromStageIndex: wf.current_stage_index,
    toStageIndex,
    note: body?.note || 'Sent back for revisions by project manager',
  });

  const reset = applyRegress(state, toStageIndex);
  await activateStage(
    ctx,
    { ...wf, status: 'active' },
    reset.map((s) => ({ ...s.row, status: s.status })),
    toStageIndex,
  );

  return respondWithWorkflow(ctx, id);
}

async function saveAsTemplate(ctx: Ctx, id: string, body: Row): Promise<Response> {
  const wf = await loadWorkflow(ctx, id);
  if (!wf) return createCorsResponse({ message: 'Workflow not found' }, 404, ctx.req);
  if (!canManage(ctx, wf)) return createCorsResponse({ message: 'Forbidden' }, 403, ctx.req);

  const steps = await loadSteps(ctx, id);
  const { data: tpl, error } = await ctx.admin
    .from('task_workflows')
    .insert({
      tenant_id: ctx.tenantId,
      name: body?.name || `${wf.name} (Template)`,
      description: wf.description,
      is_template: true,
      owner_id: ctx.userId,
      project_manager_id: wf.project_manager_id,
      source_type: 'template',
      settings: wf.settings ?? {},
      status: 'draft',
      current_stage_index: 0,
      created_by: ctx.userId,
      last_modified_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return createCorsResponse({ message: error.message }, 500, ctx.req);

  if (steps.length > 0) {
    // Template steps carry structure + assignees but NOT run state — status
    // resets to pending and completion stamps are dropped.
    await ctx.admin.from('task_workflow_steps').insert(
      steps.map((s) => ({
        tenant_id: ctx.tenantId,
        workflow_id: tpl.id,
        title: s.title,
        details: s.details,
        stage_index: s.stage_index,
        order_index: s.order_index,
        assignee_user_id: s.assignee_user_id,
        assignee_name: s.assignee_name,
        assignee_email: s.assignee_email,
        due_at: null,
        status: 'pending',
      })),
    );
  }

  await recordEvent(ctx, { workflowId: tpl.id, eventType: 'created', note: 'Saved as template' });
  return createCorsResponse({ workflow: camel(tpl) }, 201, ctx.req);
}

async function fromTemplate(ctx: Ctx, templateId: string, body: Row): Promise<Response> {
  if (!templateId) return createCorsResponse({ message: 'Template id required' }, 400, ctx.req);

  const { data: tpl } = await ctx.admin
    .from('task_workflows')
    .select('*')
    .eq('id', templateId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_template', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (!tpl) return createCorsResponse({ message: 'Template not found' }, 404, ctx.req);

  const tplSteps = await loadSteps(ctx, templateId);

  const { data: wf, error } = await ctx.admin
    .from('task_workflows')
    .insert({
      tenant_id: ctx.tenantId,
      name: body?.name || tpl.name.replace(/\s*\(Template\)\s*$/i, ''),
      description: tpl.description,
      is_template: false,
      template_id: tpl.id,
      owner_id: ctx.userId,
      project_manager_id: body?.projectManagerId ?? tpl.project_manager_id,
      source_type: 'template',
      settings: tpl.settings ?? {},
      status: 'draft',
      current_stage_index: 0,
      created_by: ctx.userId,
      last_modified_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return createCorsResponse({ message: error.message }, 500, ctx.req);

  if (tplSteps.length > 0) {
    await ctx.admin.from('task_workflow_steps').insert(
      tplSteps.map((s) => ({
        tenant_id: ctx.tenantId,
        workflow_id: wf.id,
        title: s.title,
        details: s.details,
        stage_index: s.stage_index,
        order_index: s.order_index,
        assignee_user_id: s.assignee_user_id,
        assignee_name: s.assignee_name,
        assignee_email: s.assignee_email,
        due_at: null,
        status: 'pending',
      })),
    );
  }

  await recordEvent(ctx, {
    workflowId: wf.id,
    eventType: 'created',
    note: `Created from template ${tpl.id}`,
  });

  if (body?.startNow) return doStart(ctx, wf.id, 201);
  return respondWithWorkflow(ctx, wf.id, 201);
}
