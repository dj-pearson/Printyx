/**
 * Task Workflow — Engine (state machine)
 *
 * Coordinates stage-by-stage progression of a human workflow.
 *
 * Model: steps carry a `stageIndex`. All steps sharing the lowest incomplete
 * stageIndex form the ACTIVE stage and run in parallel. The workflow advances
 * to the next stage only when every step in the current stage is completed or
 * skipped. On advance, the newly-active stage's assignees are notified.
 *
 * Project-management controls:
 *  - advanceWorkflow: force past the current stage (remaining steps -> skipped).
 *  - regressWorkflow: send the workflow back to an earlier stage for revisions
 *    (re-opens that stage and discards completion of later stages).
 *
 * Every lifecycle action appends a row to task_workflow_events (the activity log).
 */
import { and, eq, asc } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  taskWorkflows,
  taskWorkflowSteps,
  taskWorkflowEvents,
  type TaskWorkflow,
  type TaskWorkflowStep,
} from '@shared/schema';
import { notifyStepsAssigned } from './notifier';
import { createModuleLogger } from '../../lib/logger';

const log = createModuleLogger('task-workflow-engine');

const TERMINAL_STEP_STATUSES = new Set(['completed', 'skipped']);

export interface WorkflowWithSteps {
  workflow: TaskWorkflow;
  steps: TaskWorkflowStep[];
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export async function getWorkflowWithSteps(
  tenantId: string,
  workflowId: string,
): Promise<WorkflowWithSteps | null> {
  const [workflow] = await db
    .select()
    .from(taskWorkflows)
    .where(and(eq(taskWorkflows.id, workflowId), eq(taskWorkflows.tenantId, tenantId)))
    .limit(1);
  if (!workflow) return null;

  const steps = await db
    .select()
    .from(taskWorkflowSteps)
    .where(
      and(eq(taskWorkflowSteps.workflowId, workflowId), eq(taskWorkflowSteps.tenantId, tenantId)),
    )
    .orderBy(asc(taskWorkflowSteps.stageIndex), asc(taskWorkflowSteps.orderIndex));

  return { workflow, steps };
}

async function actorName(userId?: string | null): Promise<string | undefined> {
  if (!userId) return undefined;
  const [u] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return undefined;
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || undefined;
}

// ---------------------------------------------------------------------------
// Stage math
// ---------------------------------------------------------------------------

/** Lowest stageIndex that still has a non-terminal step; -1 if all are terminal. */
export function computeCurrentStageIndex(steps: TaskWorkflowStep[]): number {
  const incomplete = steps.filter((s) => !TERMINAL_STEP_STATUSES.has(s.status));
  if (incomplete.length === 0) return -1;
  return Math.min(...incomplete.map((s) => s.stageIndex));
}

function stepsInStage(steps: TaskWorkflowStep[], stageIndex: number): TaskWorkflowStep[] {
  return steps.filter((s) => s.stageIndex === stageIndex);
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

export async function recordEvent(entry: {
  tenantId: string;
  workflowId: string;
  stepId?: string | null;
  eventType:
    | 'created'
    | 'started'
    | 'step_completed'
    | 'step_reopened'
    | 'step_assigned'
    | 'advanced'
    | 'regressed'
    | 'reassigned'
    | 'commented'
    | 'published'
    | 'archived'
    | 'notified';
  actorUserId?: string | null;
  fromStageIndex?: number | null;
  toStageIndex?: number | null;
  note?: string | null;
  metadata?: Record<string, any>;
}): Promise<void> {
  await db.insert(taskWorkflowEvents).values({
    tenantId: entry.tenantId,
    workflowId: entry.workflowId,
    stepId: entry.stepId ?? null,
    eventType: entry.eventType,
    actorUserId: entry.actorUserId ?? null,
    fromStageIndex: entry.fromStageIndex ?? null,
    toStageIndex: entry.toStageIndex ?? null,
    note: entry.note ?? null,
    metadata: entry.metadata ?? {},
  } as any);
}

// ---------------------------------------------------------------------------
// Core transitions
// ---------------------------------------------------------------------------

/** Set every 'pending'/'blocked' step in a stage to 'active' and notify assignees. */
async function activateStage(
  workflow: TaskWorkflow,
  steps: TaskWorkflowStep[],
  stageIndex: number,
  actorUserId?: string | null,
): Promise<void> {
  const stage = stepsInStage(steps, stageIndex).filter(
    (s) => !TERMINAL_STEP_STATUSES.has(s.status),
  );
  if (stage.length === 0) return;

  const now = new Date();
  for (const step of stage) {
    await db
      .update(taskWorkflowSteps)
      .set({ status: 'active', updatedAt: now })
      .where(eq(taskWorkflowSteps.id, step.id));
  }

  const assignedBy = await actorName(actorUserId ?? workflow.projectManagerId ?? workflow.ownerId);
  const activated = stage.map((s) => ({ ...s, status: 'active' as const }));
  await notifyStepsAssigned(workflow, activated, assignedBy);

  for (const step of activated) {
    await recordEvent({
      tenantId: workflow.tenantId,
      workflowId: workflow.id,
      stepId: step.id,
      eventType: 'step_assigned',
      actorUserId: actorUserId ?? null,
      toStageIndex: stageIndex,
      metadata: { assigneeUserId: step.assigneeUserId, assigneeName: step.assigneeName },
    });
  }
}

async function setCurrentStage(workflow: TaskWorkflow, stageIndex: number): Promise<void> {
  await db
    .update(taskWorkflows)
    .set({ currentStageIndex: stageIndex, updatedAt: new Date() })
    .where(eq(taskWorkflows.id, workflow.id));
}

async function completeWorkflow(
  workflow: TaskWorkflow,
  actorUserId?: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .update(taskWorkflows)
    .set({ status: 'completed', currentStageIndex: -1, completedAt: now, updatedAt: now })
    .where(eq(taskWorkflows.id, workflow.id));
  await recordEvent({
    tenantId: workflow.tenantId,
    workflowId: workflow.id,
    eventType: 'published',
    actorUserId: actorUserId ?? null,
    note: 'Workflow completed',
  });
}

/**
 * Start a draft workflow: status -> active, activate the first stage, notify.
 */
export async function startWorkflow(
  tenantId: string,
  workflowId: string,
  actorUserId: string,
): Promise<WorkflowWithSteps> {
  const data = await getWorkflowWithSteps(tenantId, workflowId);
  if (!data) throw new Error('Workflow not found');
  const { workflow, steps } = data;

  if (workflow.isTemplate) throw new Error('Templates cannot be started; instantiate one first');
  if (steps.length === 0) throw new Error('Workflow has no steps');

  const firstStage = computeCurrentStageIndex(steps);
  const now = new Date();
  await db
    .update(taskWorkflows)
    .set({
      status: 'active',
      currentStageIndex: firstStage,
      startedAt: now,
      updatedAt: now,
      lastModifiedBy: actorUserId,
    })
    .where(eq(taskWorkflows.id, workflowId));

  await recordEvent({
    tenantId,
    workflowId,
    eventType: 'started',
    actorUserId,
    toStageIndex: firstStage,
  });

  if (firstStage >= 0) {
    await activateStage({ ...workflow, status: 'active' }, steps, firstStage, actorUserId);
  } else {
    await completeWorkflow(workflow, actorUserId);
  }

  return (await getWorkflowWithSteps(tenantId, workflowId))!;
}

/**
 * Mark a step completed. If that finishes its stage, advance to the next stage
 * (or complete the workflow). Returns the refreshed workflow + steps.
 */
export async function completeStep(
  tenantId: string,
  workflowId: string,
  stepId: string,
  actorUserId: string,
  note?: string,
): Promise<WorkflowWithSteps> {
  const data = await getWorkflowWithSteps(tenantId, workflowId);
  if (!data) throw new Error('Workflow not found');
  const { workflow, steps } = data;

  const step = steps.find((s) => s.id === stepId);
  if (!step) throw new Error('Step not found');
  if (step.status === 'completed') return data;

  const now = new Date();
  await db
    .update(taskWorkflowSteps)
    .set({ status: 'completed', completedAt: now, completedBy: actorUserId, updatedAt: now })
    .where(eq(taskWorkflowSteps.id, stepId));

  await recordEvent({
    tenantId,
    workflowId,
    stepId,
    eventType: 'step_completed',
    actorUserId,
    fromStageIndex: step.stageIndex,
    note,
  });

  // Recompute with this step completed
  const updatedSteps = steps.map((s) =>
    s.id === stepId ? { ...s, status: 'completed' as const } : s,
  );
  const prevStage = step.stageIndex;
  const stageSteps = stepsInStage(updatedSteps, prevStage);
  const stageDone = stageSteps.every((s) => TERMINAL_STEP_STATUSES.has(s.status));

  if (stageDone) {
    const nextStage = computeCurrentStageIndex(updatedSteps);
    if (nextStage >= 0) {
      await setCurrentStage(workflow, nextStage);
      await recordEvent({
        tenantId,
        workflowId,
        eventType: 'advanced',
        actorUserId,
        fromStageIndex: prevStage,
        toStageIndex: nextStage,
      });
      await activateStage(workflow, updatedSteps, nextStage, actorUserId);
    } else {
      await completeWorkflow(workflow, actorUserId);
    }
  }

  return (await getWorkflowWithSteps(tenantId, workflowId))!;
}

/** Reopen a completed/skipped step back to 'active' (and re-notify the assignee). */
export async function reopenStep(
  tenantId: string,
  workflowId: string,
  stepId: string,
  actorUserId: string,
  note?: string,
): Promise<WorkflowWithSteps> {
  const data = await getWorkflowWithSteps(tenantId, workflowId);
  if (!data) throw new Error('Workflow not found');
  const { workflow, steps } = data;
  const step = steps.find((s) => s.id === stepId);
  if (!step) throw new Error('Step not found');

  const now = new Date();
  await db
    .update(taskWorkflowSteps)
    .set({ status: 'active', completedAt: null, completedBy: null, updatedAt: now })
    .where(eq(taskWorkflowSteps.id, stepId));

  // If the workflow had moved past this step's stage, pull it back.
  const newStage = Math.min(
    workflow.currentStageIndex < 0 ? step.stageIndex : workflow.currentStageIndex,
    step.stageIndex,
  );
  await db
    .update(taskWorkflows)
    .set({
      currentStageIndex: newStage,
      status: workflow.status === 'completed' ? 'active' : workflow.status,
      completedAt: workflow.status === 'completed' ? null : workflow.completedAt,
      updatedAt: now,
    })
    .where(eq(taskWorkflows.id, workflowId));

  await recordEvent({
    tenantId,
    workflowId,
    stepId,
    eventType: 'step_reopened',
    actorUserId,
    toStageIndex: step.stageIndex,
    note,
  });

  await notifyStepsAssigned(
    { ...workflow, currentStageIndex: newStage },
    [{ ...step, status: 'active' }],
    await actorName(actorUserId),
  );

  return (await getWorkflowWithSteps(tenantId, workflowId))!;
}

/**
 * PM control — force past the current stage: remaining non-terminal steps in the
 * current stage become 'skipped', then advance to the next stage.
 */
export async function advanceWorkflow(
  tenantId: string,
  workflowId: string,
  actorUserId: string,
  note?: string,
): Promise<WorkflowWithSteps> {
  const data = await getWorkflowWithSteps(tenantId, workflowId);
  if (!data) throw new Error('Workflow not found');
  const { workflow, steps } = data;

  const current = computeCurrentStageIndex(steps);
  if (current < 0) return data; // already complete

  const now = new Date();
  for (const s of stepsInStage(steps, current)) {
    if (!TERMINAL_STEP_STATUSES.has(s.status)) {
      await db
        .update(taskWorkflowSteps)
        .set({ status: 'skipped', updatedAt: now })
        .where(eq(taskWorkflowSteps.id, s.id));
    }
  }

  const updatedSteps = steps.map((s) =>
    s.stageIndex === current && !TERMINAL_STEP_STATUSES.has(s.status)
      ? { ...s, status: 'skipped' as const }
      : s,
  );
  const nextStage = computeCurrentStageIndex(updatedSteps);

  await recordEvent({
    tenantId,
    workflowId,
    eventType: 'advanced',
    actorUserId,
    fromStageIndex: current,
    toStageIndex: nextStage,
    note: note || 'Stage advanced by project manager',
  });

  if (nextStage >= 0) {
    await setCurrentStage(workflow, nextStage);
    await activateStage(workflow, updatedSteps, nextStage, actorUserId);
  } else {
    await completeWorkflow(workflow, actorUserId);
  }

  return (await getWorkflowWithSteps(tenantId, workflowId))!;
}

/**
 * PM control — regress to an earlier stage for revisions. Steps at or after
 * `toStageIndex` are reset to 'pending', the target stage is re-activated, and
 * its assignees are re-notified.
 */
export async function regressWorkflow(
  tenantId: string,
  workflowId: string,
  toStageIndex: number,
  actorUserId: string,
  note?: string,
): Promise<WorkflowWithSteps> {
  const data = await getWorkflowWithSteps(tenantId, workflowId);
  if (!data) throw new Error('Workflow not found');
  const { workflow, steps } = data;

  const current = workflow.currentStageIndex;
  if (toStageIndex < 0) throw new Error('Invalid target stage');

  const now = new Date();
  // Reset every step in stages >= target back to pending.
  for (const s of steps) {
    if (s.stageIndex >= toStageIndex) {
      await db
        .update(taskWorkflowSteps)
        .set({ status: 'pending', completedAt: null, completedBy: null, updatedAt: now })
        .where(eq(taskWorkflowSteps.id, s.id));
    }
  }

  await db
    .update(taskWorkflows)
    .set({
      currentStageIndex: toStageIndex,
      status: 'active',
      completedAt: null,
      updatedAt: now,
      lastModifiedBy: actorUserId,
    })
    .where(eq(taskWorkflows.id, workflowId));

  await recordEvent({
    tenantId,
    workflowId,
    eventType: 'regressed',
    actorUserId,
    fromStageIndex: current,
    toStageIndex,
    note: note || 'Sent back for revisions by project manager',
  });

  const resetSteps = steps.map((s) =>
    s.stageIndex >= toStageIndex ? { ...s, status: 'pending' as const } : s,
  );
  await activateStage({ ...workflow, status: 'active' }, resetSteps, toStageIndex, actorUserId);

  return (await getWorkflowWithSteps(tenantId, workflowId))!;
}
