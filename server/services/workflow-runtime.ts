import { db } from '../db';
import { and, eq, lte, desc, isNotNull, inArray } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
import {
  workflows,
  workflowTriggers,
  workflowConditions,
  workflowVersions,
  workflowExecutions,
  workflowExecutionEvents,
  type WorkflowCondition,
} from '@shared/schema';
import { executeWorkflow } from './workflow-execution-service';

const log = createModuleLogger('workflow-runtime');

/**
 * Workflow Runtime (CRMX-008)
 *
 * The dispatch + enrollment + durable sweeper layer on top of the execution
 * engine (workflow-execution-service.ts):
 *
 *  - dispatchWorkflowEvent(): trigger source → find matching active workflows →
 *    evaluate trigger conditions → enroll. This is the single seam every trigger
 *    source (record.created/updated, deal.stage_changed, form.submitted, …) calls.
 *  - enrollExecution(): idempotent, kill-switch-aware creation of a queued
 *    execution, then a best-effort inline kick (the sweeper is the backstop).
 *  - tickWorkflowRuntime(): the durable sweeper — claims stranded queued
 *    executions and resumes paused ones whose delay has elapsed. Safe to run
 *    concurrently with inline kicks because executeWorkflow claims atomically.
 *  - startWorkflowRuntime(): registers the sweeper on an interval at boot.
 */

// ─── Condition evaluation ───────────────────────────────────────────────────

function coerce(value: any, dataType?: string | null): any {
  if (value == null) return value;
  switch (dataType) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === true || value === 'true' || value === 1 || value === '1';
    case 'date':
      return new Date(value).getTime();
    default:
      return value;
  }
}

function getNestedValue(obj: any, path: string): any {
  if (!path) return undefined;
  return path.split('.').reduce((cur, key) => cur?.[key], obj);
}

function evaluateOne(cond: WorkflowCondition, payload: Record<string, any>): boolean {
  // leftOperand is a field path into the event payload, falling back to a literal.
  const rawLeft = getNestedValue(payload, cond.leftOperand);
  const left = coerce(rawLeft !== undefined ? rawLeft : cond.leftOperand, cond.dataType);
  const right = coerce(cond.rightOperand, cond.dataType);

  switch (cond.operator) {
    case 'equals':
      return left == right;
    case 'not_equals':
      return left != right;
    case 'greater_than':
      return Number(left) > Number(right);
    case 'less_than':
      return Number(left) < Number(right);
    case 'greater_than_or_equal':
      return Number(left) >= Number(right);
    case 'less_than_or_equal':
      return Number(left) <= Number(right);
    case 'contains':
      return String(left ?? '').includes(String(right ?? ''));
    case 'not_contains':
      return !String(left ?? '').includes(String(right ?? ''));
    case 'starts_with':
      return String(left ?? '').startsWith(String(right ?? ''));
    case 'ends_with':
      return String(left ?? '').endsWith(String(right ?? ''));
    case 'in':
      return String(right ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(String(left));
    case 'not_in':
      return !String(right ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(String(left));
    case 'is_null':
      return rawLeft == null;
    case 'is_not_null':
      return rawLeft != null;
    case 'matches_regex':
      try {
        return new RegExp(String(right)).test(String(left ?? ''));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Evaluate a set of workflow conditions against an event payload. Conditions are
 * grouped by `conditionGroup`; within a group they chain by each condition's
 * logicalOperator (AND/OR, NOT negates), and groups are OR'd together. No
 * conditions ⇒ always true.
 */
export function evaluateConditions(
  conditions: WorkflowCondition[],
  payload: Record<string, any>,
): boolean {
  if (!conditions || conditions.length === 0) return true;

  const groups = new Map<string, WorkflowCondition[]>();
  for (const c of conditions) {
    const key = c.conditionGroup || 'default';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const groupResults: boolean[] = [];
  for (const groupConds of groups.values()) {
    const ordered = [...groupConds].sort((a, b) => a.orderIndex - b.orderIndex);
    let acc: boolean | null = null;
    for (const cond of ordered) {
      let outcome = evaluateOne(cond, payload);
      if (cond.logicalOperator === 'NOT') outcome = !outcome;
      if (acc === null) acc = outcome;
      else if (cond.logicalOperator === 'OR') acc = acc || outcome;
      else acc = acc && outcome; // AND (and NOT, already negated)
    }
    groupResults.push(acc ?? true);
  }
  return groupResults.some(Boolean);
}

// ─── Enrollment ─────────────────────────────────────────────────────────────

export interface EnrollInput {
  tenantId: string;
  workflowId: string;
  triggerId?: string | null;
  context?: Record<string, any>;
  initiatedBy?: string;
  /** Idempotency token, unique per (tenant, workflow). Omit for always-enroll. */
  dedupeKey?: string;
}

/**
 * Idempotently enroll a workflow into a new execution. Honors the per-workflow
 * kill switch (status must be 'active'). Returns the execution id, or null if the
 * workflow is not runnable. Kicks the execution inline (best effort); the sweeper
 * is the durable backstop.
 */
export async function enrollExecution(input: EnrollInput): Promise<string | null> {
  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, input.workflowId), eq(workflows.tenantId, input.tenantId)),
  });
  if (!workflow) return null;
  if (workflow.status !== 'active') {
    log.info(
      `[Runtime] Skip enroll: workflow ${workflow.id} is '${workflow.status}' (kill switch)`,
    );
    return null;
  }

  // Idempotency — a prior enrollment with the same dedupe key wins.
  if (input.dedupeKey) {
    const existing = await db.query.workflowExecutions.findFirst({
      where: and(
        eq(workflowExecutions.tenantId, input.tenantId),
        eq(workflowExecutions.workflowId, input.workflowId),
        eq(workflowExecutions.dedupeKey, input.dedupeKey),
      ),
    });
    if (existing) return existing.id;
  }

  const version = await db.query.workflowVersions.findFirst({
    where: eq(workflowVersions.workflowId, input.workflowId),
    orderBy: [desc(workflowVersions.version)],
  });
  if (!version) {
    log.info(`[Runtime] Skip enroll: workflow ${input.workflowId} has no version`);
    return null;
  }

  let executionId: string;
  try {
    const [execution] = await db
      .insert(workflowExecutions)
      .values({
        workflowId: input.workflowId,
        workflowVersionId: version.id,
        tenantId: input.tenantId,
        triggerId: input.triggerId ?? null,
        initiatedBy: input.initiatedBy ?? 'system',
        status: 'queued',
        context: input.context ?? {},
        dedupeKey: input.dedupeKey ?? null,
      })
      .returning();
    executionId = execution.id;
  } catch (err) {
    // Unique-index race on dedupe_key — another dispatch enrolled first.
    if (input.dedupeKey) {
      const existing = await db.query.workflowExecutions.findFirst({
        where: and(
          eq(workflowExecutions.tenantId, input.tenantId),
          eq(workflowExecutions.workflowId, input.workflowId),
          eq(workflowExecutions.dedupeKey, input.dedupeKey),
        ),
      });
      if (existing) return existing.id;
    }
    throw err;
  }

  await db.insert(workflowExecutionEvents).values({
    executionId,
    stepExecutionId: null,
    eventType: 'execution_enrolled',
    message: input.triggerId ? 'Enrolled by trigger' : 'Enrolled',
    eventData: { triggerId: input.triggerId ?? null, dedupeKey: input.dedupeKey ?? null },
  });

  // Best-effort inline kick; the sweeper reclaims it if the process dies first.
  void executeWorkflow(executionId).catch((e) =>
    log.error(`[Runtime] inline execution kick failed for ${executionId}:`, e),
  );

  return executionId;
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

export interface DispatchOptions {
  /** Base idempotency token; combined per-workflow so one event enrolls each once. */
  dedupeKey?: string;
  initiatedBy?: string;
}

/**
 * Fire a business event into the workflow runtime. Every trigger source calls
 * this. Finds active workflows for the tenant with an enabled event trigger
 * matching `eventName`, evaluates that trigger's conditions against `payload`,
 * and enrolls the ones that pass. Returns the enrolled execution ids.
 *
 * Callers should wrap this in try/catch so automation never breaks the primary
 * operation that produced the event.
 */
export async function dispatchWorkflowEvent(
  tenantId: string,
  eventName: string,
  payload: Record<string, any>,
  opts: DispatchOptions = {},
): Promise<string[]> {
  const activeWorkflows = await db.query.workflows.findMany({
    where: and(eq(workflows.tenantId, tenantId), eq(workflows.status, 'active')),
  });
  if (activeWorkflows.length === 0) return [];

  const enrolled: string[] = [];
  for (const workflow of activeWorkflows) {
    const triggers = await db.query.workflowTriggers.findMany({
      where: and(
        eq(workflowTriggers.workflowId, workflow.id),
        eq(workflowTriggers.type, 'event'),
        eq(workflowTriggers.enabled, true),
        eq(workflowTriggers.eventName, eventName),
      ),
    });

    for (const trigger of triggers) {
      const conditions = await db.query.workflowConditions.findMany({
        where: eq(workflowConditions.triggerId, trigger.id),
      });
      if (!evaluateConditions(conditions, payload)) continue;

      const dedupeKey = opts.dedupeKey ? `${trigger.id}:${opts.dedupeKey}` : undefined;
      const id = await enrollExecution({
        tenantId,
        workflowId: workflow.id,
        triggerId: trigger.id,
        context: { event: eventName, ...payload },
        initiatedBy: opts.initiatedBy ?? 'system',
        dedupeKey,
      });
      if (id) enrolled.push(id);
    }
  }

  if (enrolled.length > 0) {
    log.info(`[Runtime] event '${eventName}' enrolled ${enrolled.length} execution(s)`);
  }
  return enrolled;
}

// ─── Kill switch (per execution) ────────────────────────────────────────────

/**
 * Cancel a single in-flight execution. Atomic + tenant-scoped: only transitions
 * a non-terminal execution to 'cancelled', so it can't clobber one that just
 * completed. Returns whether a row was cancelled.
 */
export async function cancelExecution(
  executionId: string,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const cancelled = await db
    .update(workflowExecutions)
    .set({ status: 'cancelled', completedAt: new Date(), resumeAt: null })
    .where(
      and(
        eq(workflowExecutions.id, executionId),
        eq(workflowExecutions.tenantId, tenantId),
        inArray(workflowExecutions.status, ['queued', 'running', 'paused']),
      ),
    )
    .returning({ id: workflowExecutions.id });

  if (cancelled.length === 0) return false;

  await db.insert(workflowExecutionEvents).values({
    executionId,
    stepExecutionId: null,
    eventType: 'execution_cancelled',
    message: `Execution cancelled by ${userId}`,
    eventData: { userId },
  });
  return true;
}

// ─── Durable sweeper ────────────────────────────────────────────────────────

export interface TickResult {
  started: number;
  resumed: number;
}

/**
 * One sweeper pass: run stranded queued executions and resume due paused ones.
 * Idempotent — executeWorkflow claims each row atomically, so overlapping ticks
 * (or an inline kick) never double-execute.
 */
export async function tickWorkflowRuntime(limit = 25): Promise<TickResult> {
  const result: TickResult = { started: 0, resumed: 0 };

  const queued = await db.query.workflowExecutions.findMany({
    where: eq(workflowExecutions.status, 'queued'),
    orderBy: [workflowExecutions.createdAt],
    limit,
  });
  for (const exec of queued) {
    try {
      await executeWorkflow(exec.id);
      result.started++;
    } catch (e) {
      log.error(`[Runtime] sweeper start failed for ${exec.id}:`, e);
    }
  }

  const now = new Date();
  const duePaused = await db.query.workflowExecutions.findMany({
    where: and(
      eq(workflowExecutions.status, 'paused'),
      isNotNull(workflowExecutions.resumeAt),
      lte(workflowExecutions.resumeAt, now),
    ),
    orderBy: [workflowExecutions.resumeAt],
    limit,
  });
  for (const exec of duePaused) {
    const runtime = ((exec.context as Record<string, any>) || {})._runtime || {};
    try {
      await executeWorkflow(exec.id, { startIndex: runtime.nextStepIndex ?? 0 });
      result.resumed++;
    } catch (e) {
      log.error(`[Runtime] sweeper resume failed for ${exec.id}:`, e);
    }
  }

  return result;
}

let sweeperTimer: NodeJS.Timeout | null = null;

/**
 * Start the durable sweeper on an interval. Idempotent — a second call is a
 * no-op. Returns a stop handle.
 */
export function startWorkflowRuntime(intervalMs = 30_000): () => void {
  if (sweeperTimer) return stopWorkflowRuntime;
  log.info(`[Runtime] starting workflow sweeper (every ${intervalMs}ms)`);
  sweeperTimer = setInterval(() => {
    tickWorkflowRuntime().catch((e) => log.error('[Runtime] sweeper tick error:', e));
  }, intervalMs);
  // Don't keep the event loop alive solely for the sweeper.
  if (typeof sweeperTimer.unref === 'function') sweeperTimer.unref();
  return stopWorkflowRuntime;
}

export function stopWorkflowRuntime(): void {
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
}
