// Workflow event dispatch for edge functions (CRMX-008a).
//
// Ports server/services/workflow-runtime.ts's dispatchWorkflowEvent +
// enrollExecution onto PostgREST. It exists because every trigger seam the
// CRMX-008 work wired up lives in an Express handler that the edge-function
// proxy shadows - deal.stage_changed in routes-deals.ts, record.created and
// record.updated in routes-business-records.ts - so no event-triggered workflow
// has ever enrolled. The executor, the sweeper, the kill switch and the
// idempotency index were all built and had nothing to start them.
//
// Two guarantees are carried over verbatim, because losing either is worse than
// not dispatching at all:
//
//   KILL SWITCH   - workflows.status must be 'active'. A paused or archived
//                   workflow never enrols, whatever the event.
//   IDEMPOTENCY   - workflow_executions.dedupe_key is unique per
//                   (tenant, workflow) via a partial index (NULLs exempt). A
//                   repeated PUT must not enrol the same automation twice. The
//                   insert race is handled by re-reading after a failure rather
//                   than trusting the pre-check.
//
// The caller is responsible for the try/catch: automation must never fail the
// write that triggered it.

import { evaluateConditions, conditionFromRow } from './workflow-conditions.ts';

/** Minimal PostgREST surface, so this can be unit tested with a fake. */
export interface DispatchClient {
  from(table: string): any;
}

export interface DispatchOptions {
  dedupeKey?: string;
  initiatedBy?: string;
}

/**
 * The dedupe key stored on the execution. Scoped by TRIGGER, not just by the
 * caller's token: two triggers on the same workflow listening to the same event
 * are separate enrolments, and sharing a key would silently drop one.
 */
export function executionDedupeKey(
  triggerId: string,
  callerKey: string | undefined,
): string | undefined {
  return callerKey ? `${triggerId}:${callerKey}` : undefined;
}

async function enroll(
  db: DispatchClient,
  input: {
    tenantId: string;
    workflowId: string;
    workflowStatus: string;
    triggerId: string | null;
    context: Record<string, unknown>;
    initiatedBy: string;
    dedupeKey?: string;
  },
): Promise<string | null> {
  // Kill switch. The workflow row is already in hand from the dispatch query,
  // so this is a re-check of what was read, not a second round trip.
  if (input.workflowStatus !== 'active') return null;

  if (input.dedupeKey) {
    const { data: existing } = await db
      .from('workflow_executions')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('workflow_id', input.workflowId)
      .eq('dedupe_key', input.dedupeKey)
      .maybeSingle();
    if (existing?.id) return existing.id as string;
  }

  // An execution pins the version it started on, so a later edit to the
  // workflow cannot change the steps of a run already in flight.
  const { data: version } = await db
    .from('workflow_versions')
    .select('id, version')
    .eq('workflow_id', input.workflowId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version?.id) return null;

  const { data: created, error } = await db
    .from('workflow_executions')
    .insert({
      workflow_id: input.workflowId,
      workflow_version_id: version.id,
      tenant_id: input.tenantId,
      trigger_id: input.triggerId,
      initiated_by: input.initiatedBy,
      status: 'queued',
      context: input.context,
      dedupe_key: input.dedupeKey ?? null,
    })
    .select('id')
    .maybeSingle();

  if (!error && created?.id) return created.id as string;

  // Unique-index race: a concurrent dispatch enrolled first. Re-read rather
  // than reporting a failure - the desired state (exactly one execution)
  // holds either way.
  if (input.dedupeKey) {
    const { data: raced } = await db
      .from('workflow_executions')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('workflow_id', input.workflowId)
      .eq('dedupe_key', input.dedupeKey)
      .maybeSingle();
    if (raced?.id) return raced.id as string;
  }
  return null;
}

/**
 * Enrol every active workflow whose enabled event trigger matches `eventName`
 * and whose conditions the payload satisfies. Returns the execution ids.
 *
 * Executions are queued, not run: an edge invocation ends with its response, so
 * the durable sweeper is what advances them.
 */
export async function dispatchWorkflowEvent(
  db: DispatchClient,
  tenantId: string,
  eventName: string,
  payload: Record<string, unknown>,
  opts: DispatchOptions = {},
): Promise<string[]> {
  const { data: workflows } = await db
    .from('workflows')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  if (!workflows || workflows.length === 0) return [];

  const workflowIds = workflows.map((w: any) => w.id);
  const { data: triggers } = await db
    .from('workflow_triggers')
    .select('id, workflow_id, type, event_name, enabled')
    .in('workflow_id', workflowIds)
    .eq('type', 'event')
    .eq('enabled', true)
    .eq('event_name', eventName);
  if (!triggers || triggers.length === 0) return [];

  // Conditions for all matching triggers in one round trip. The Express
  // version queried per trigger; the shape of the result is the same.
  const { data: conditionRows } = await db
    .from('workflow_conditions')
    .select(
      'trigger_id, condition_group, logical_operator, left_operand, operator, right_operand, data_type, order_index',
    )
    .in(
      'trigger_id',
      triggers.map((t: any) => t.id),
    );

  const byTrigger = new Map<string, Record<string, unknown>[]>();
  for (const row of conditionRows ?? []) {
    const key = String((row as any).trigger_id);
    if (!byTrigger.has(key)) byTrigger.set(key, []);
    byTrigger.get(key)!.push(row as Record<string, unknown>);
  }

  const statusById = new Map(workflows.map((w: any) => [w.id, w.status as string]));
  const enrolled: string[] = [];

  for (const trigger of triggers) {
    const conditions = (byTrigger.get(String(trigger.id)) ?? []).map(conditionFromRow);
    if (!evaluateConditions(conditions, payload)) continue;

    const id = await enroll(db, {
      tenantId,
      workflowId: trigger.workflow_id,
      workflowStatus: statusById.get(trigger.workflow_id) ?? 'draft',
      triggerId: trigger.id,
      context: { event: eventName, ...payload },
      initiatedBy: opts.initiatedBy ?? 'system',
      dedupeKey: executionDedupeKey(trigger.id, opts.dedupeKey),
    });
    if (id) enrolled.push(id);
  }

  return enrolled;
}

/**
 * Dispatch without ever throwing. Automation must not be able to fail the write
 * that triggered it - the Express seams all wrapped their call in try/catch and
 * this makes that the default rather than each caller's responsibility.
 */
export async function dispatchWorkflowEventSafe(
  db: DispatchClient,
  tenantId: string,
  eventName: string,
  payload: Record<string, unknown>,
  opts: DispatchOptions = {},
): Promise<string[]> {
  try {
    return await dispatchWorkflowEvent(db, tenantId, eventName, payload, opts);
  } catch (err) {
    console.error(`workflow dispatch failed for '${eventName}' (non-fatal):`, err);
    return [];
  }
}
