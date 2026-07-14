import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('workflow-execution-service');

import {
  workflowExecutions,
  workflowExecutionSteps,
  workflowExecutionEvents,
  workflowStepsAutomation,
  workflowApprovals,
  tasks,
  assignmentGroups,
  businessRecords,
  type WorkflowStepAutomation,
} from '@shared/schema';
import { safeFetch } from '../lib/safe-http-client';
import { sendEmail } from './email-service';

/**
 * Workflow Execution Service (CRMX-008)
 *
 * The real execution engine behind automation_rules/workflows. Replaces the
 * former in-process, non-durable executor. Guarantees:
 *
 *  - Durable: an execution's progress lives entirely in the DB
 *    (workflow_executions + workflow_execution_steps). `wait_delay` and approval
 *    steps PAUSE the execution (status='paused' + a resume cursor in
 *    context._runtime) instead of blocking the event loop — so a restart never
 *    loses in-flight work. The runtime sweeper (workflow-runtime.ts) resumes them.
 *  - Idempotent / no double-fire: executions are claimed with an atomic
 *    status transition (queued|paused → running). Only one worker wins the row,
 *    so a sweeper tick that overlaps an inline run can never execute twice.
 *  - Observable: every step writes a workflow_execution_steps row and every
 *    lifecycle transition writes a workflow_execution_events row (surfaced by the
 *    GET /executions/:id endpoint the UI reads).
 */

interface StepContext {
  executionId: string;
  tenantId: string;
  workflowContext: Record<string, any>;
  userId?: string;
}

export interface ExecuteOptions {
  /** Resume from this step index (durable resume after a pause). Defaults to 0. */
  startIndex?: number;
}

// Fields the update_crm action is permitted to write on business_records.
// Anything else is rejected so a misconfigured workflow can't scribble over
// identity/tenant columns.
const CRM_WRITABLE_FIELDS = new Set([
  'status',
  'priority',
  'ownerId',
  'leadStatus',
  'estimatedAmount',
  'probability',
  'notes',
  'nextFollowUpDate',
]);

/**
 * Execute (or resume) a workflow execution. Claims the row atomically, then runs
 * steps from `startIndex`. Pausing steps (wait_delay / approval) persist a resume
 * cursor and return; the sweeper or an approval response calls back in.
 */
export async function executeWorkflow(
  executionId: string,
  opts: ExecuteOptions = {},
): Promise<void> {
  const startIndex = opts.startIndex ?? 0;
  const resuming = startIndex > 0 || opts.startIndex != null;
  const claimFrom = resuming ? 'paused' : 'queued';

  // Atomic claim — only the worker that flips the row from its expected state
  // proceeds. A losing worker (overlapping sweeper tick) returns without acting.
  const claimed = await db
    .update(workflowExecutions)
    .set({
      status: 'running',
      resumeAt: null,
      startedAt: resuming ? undefined : new Date(),
    })
    .where(and(eq(workflowExecutions.id, executionId), eq(workflowExecutions.status, claimFrom)))
    .returning();

  if (claimed.length === 0) {
    log.info(
      `[Workflow Execution] Skip ${executionId}: not in '${claimFrom}' state (already claimed/terminal)`,
    );
    return;
  }

  const execution = claimed[0];

  try {
    if (!resuming) {
      await db.insert(workflowExecutionEvents).values({
        executionId: execution.id,
        stepExecutionId: null,
        eventType: 'execution_started',
        message: 'Workflow execution started',
        eventData: { executionId },
      });
    }

    const steps = await db.query.workflowStepsAutomation.findMany({
      where: eq(workflowStepsAutomation.workflowId, execution.workflowId),
      orderBy: (s, { asc }) => [asc(s.orderIndex)],
    });

    const ctx = (execution.context as Record<string, any>) || {};
    log.info(
      `[Workflow Execution] ${executionId}: running ${steps.length} steps from index ${startIndex}`,
    );

    let allStepsSucceeded = true;
    for (let i = startIndex; i < steps.length; i++) {
      const step = steps[i];
      const stepCtx: StepContext = {
        executionId: execution.id,
        tenantId: execution.tenantId,
        workflowContext: ctx,
        userId: execution.initiatedBy || undefined,
      };

      // ── Durable pause points ────────────────────────────────────────────
      if (step.actionType === 'wait_delay') {
        await pauseForDelay(execution.id, execution.tenantId, ctx, step, i);
        return; // resumed by the sweeper when resume_at elapses
      }
      if (step.actionType === 'require_approval' || step.actionType === 'wait_for_approval') {
        await pauseForApproval(execution.id, execution.tenantId, ctx, step, i, stepCtx);
        return; // resumed by processApprovalResponse
      }

      // ── Immediate steps ─────────────────────────────────────────────────
      const stepSuccess = await executeStep(step, stepCtx);
      if (!stepSuccess) {
        allStepsSucceeded = false;
        if (!step.continueOnError) {
          log.info(`[Workflow Execution] Step failed, stopping: ${step.id}`);
          break;
        }
      }
    }

    await finalizeExecution(execution.id, allStepsSucceeded);
  } catch (error) {
    await failExecution(execution.id, error);
    throw error;
  }
}

async function finalizeExecution(executionId: string, succeeded: boolean): Promise<void> {
  const finalStatus = succeeded ? 'completed' : 'failed';
  await db
    .update(workflowExecutions)
    .set({ status: finalStatus, completedAt: new Date(), resumeAt: null })
    .where(eq(workflowExecutions.id, executionId));

  await db.insert(workflowExecutionEvents).values({
    executionId,
    stepExecutionId: null,
    eventType: finalStatus === 'completed' ? 'execution_completed' : 'execution_failed',
    message: `Workflow execution ${finalStatus}`,
    eventData: { executionId, status: finalStatus },
  });
  log.info(`[Workflow Execution] ${finalStatus}: ${executionId}`);
}

async function failExecution(executionId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  await db
    .update(workflowExecutions)
    .set({ status: 'failed', error: message, completedAt: new Date(), resumeAt: null })
    .where(eq(workflowExecutions.id, executionId));

  await db.insert(workflowExecutionEvents).values({
    executionId,
    stepExecutionId: null,
    eventType: 'execution_error',
    message: `Workflow execution error: ${message}`,
    eventData: { error: String(error) },
  });
  log.error(`[Workflow Execution] Error executing ${executionId}:`, error);
}

/**
 * Pause an execution for a timed `wait_delay` step. The wait is scheduled here;
 * the sweeper resumes at nextStepIndex once resume_at elapses. Durable across
 * restarts — no setTimeout.
 */
async function pauseForDelay(
  executionId: string,
  tenantId: string,
  ctx: Record<string, any>,
  step: WorkflowStepAutomation,
  index: number,
): Promise<void> {
  const config = (step.config as Record<string, any>) || {};
  const delaySeconds = Number(config.delaySeconds ?? config.delay ?? 60);
  const resumeAt = new Date(Date.now() + delaySeconds * 1000);

  // The wait step itself is logged complete — the pause is an execution state.
  await db.insert(workflowExecutionSteps).values({
    executionId,
    stepId: step.id,
    stepName: step.name,
    status: 'completed',
    input: ctx,
    output: { delayedSeconds: delaySeconds, resumeAt },
    startedAt: new Date(),
    completedAt: new Date(),
  });

  await db
    .update(workflowExecutions)
    .set({
      status: 'paused',
      resumeAt,
      context: { ...ctx, _runtime: { nextStepIndex: index + 1 } },
    })
    .where(eq(workflowExecutions.id, executionId));

  await db.insert(workflowExecutionEvents).values({
    executionId,
    stepExecutionId: null,
    eventType: 'execution_paused',
    message: `Paused ${delaySeconds}s for wait_delay`,
    eventData: { resumeAt, nextStepIndex: index + 1 },
  });
  log.info(`[Workflow Execution] ${executionId} paused until ${resumeAt.toISOString()}`);
}

/**
 * Pause an execution on a `require_approval`/`wait_for_approval` step: create the
 * approval request and park the execution until processApprovalResponse resumes
 * it. resume_at stays NULL (there is no timer — an approver drives it).
 */
async function pauseForApproval(
  executionId: string,
  tenantId: string,
  ctx: Record<string, any>,
  step: WorkflowStepAutomation,
  index: number,
  stepCtx: StepContext,
): Promise<void> {
  const config = (step.config as Record<string, any>) || {};

  const [stepExecution] = await db
    .insert(workflowExecutionSteps)
    .values({
      executionId,
      stepId: step.id,
      stepName: step.name,
      status: 'running',
      input: ctx,
      startedAt: new Date(),
    })
    .returning();

  const dueInHours = Number(config.dueInHours ?? 48);
  const dueDate = new Date(Date.now() + dueInHours * 3600 * 1000);

  const [approval] = await db
    .insert(workflowApprovals)
    .values({
      tenantId,
      executionId,
      stepExecutionId: stepExecution.id,
      assignedToUserId: config.assignToUserId || null,
      assignedToGroupId: config.assignToGroupId || null,
      status: 'pending',
      dueDate,
      contextData: {
        ...ctx,
        approvalMessage: interpolateString(config.message || '', ctx),
      },
    })
    .returning();

  await db
    .update(workflowExecutions)
    .set({
      status: 'paused',
      resumeAt: null,
      context: {
        ...ctx,
        _runtime: { nextStepIndex: index + 1, approvalStepExecutionId: stepExecution.id },
      },
    })
    .where(eq(workflowExecutions.id, executionId));

  await db.insert(workflowExecutionEvents).values({
    executionId,
    stepExecutionId: stepExecution.id,
    eventType: 'execution_awaiting_approval',
    message: 'Paused awaiting approval',
    eventData: { approvalId: approval.id, nextStepIndex: index + 1 },
  });
  log.info(`[Workflow Execution] ${executionId} awaiting approval ${approval.id}`);
}

/**
 * Execute a single immediate workflow step, with retry per the step's policy.
 */
async function executeStep(step: WorkflowStepAutomation, context: StepContext): Promise<boolean> {
  log.info(`[Workflow Step] Executing: ${step.name} (${step.actionType})`);

  let retryCount = 0;
  while (retryCount <= (step.maxRetries || 0)) {
    const [stepExecution] = await db
      .insert(workflowExecutionSteps)
      .values({
        executionId: context.executionId,
        stepId: step.id,
        stepName: step.name,
        status: 'running',
        input: context.workflowContext,
        retryCount,
        startedAt: new Date(),
      })
      .returning();

    try {
      const result = await executeStepAction(step, context);
      await db
        .update(workflowExecutionSteps)
        .set({ status: 'completed', output: result, completedAt: new Date() })
        .where(eq(workflowExecutionSteps.id, stepExecution.id));
      log.info(`[Workflow Step] Completed: ${step.name}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(workflowExecutionSteps)
        .set({ status: 'failed', error: message, completedAt: new Date() })
        .where(eq(workflowExecutionSteps.id, stepExecution.id));
      log.error(`[Workflow Step] Failed (attempt ${retryCount + 1}): ${step.name}`, error);

      if (retryCount < (step.maxRetries || 0) && step.retryEnabled) {
        retryCount++;
        continue;
      }
      return false;
    }
  }
  return false;
}

/**
 * Dispatch a step to its concrete action implementation.
 */
async function executeStepAction(step: WorkflowStepAutomation, context: StepContext): Promise<any> {
  const config = (step.config as Record<string, any>) || {};

  switch (step.actionType) {
    case 'create_task':
      return await createTaskAction(config, context);
    case 'send_notification':
      return await sendNotificationAction(config, context);
    case 'email':
      return await sendEmailAction(config, context);
    case 'send_webhook':
    case 'http_request':
      return await sendWebhookAction(config, context);
    case 'update_crm':
    case 'database_update':
      return await updateCrmAction(config, context);
    default:
      // No backing transport in this codebase (e.g. sms). Recorded, not faked.
      log.warn(`[Workflow Step] Action type not implemented: ${step.actionType}`);
      return { implemented: false, actionType: step.actionType };
  }
}

/**
 * Create Task Action — creates a task and assigns it to a user or group.
 */
async function createTaskAction(config: Record<string, any>, context: StepContext): Promise<any> {
  const title = interpolateString(config.title, context.workflowContext);
  const description = interpolateString(config.description, context.workflowContext);
  const priority = config.priority || 'medium';
  const dueInHours = config.dueInHours || 24;
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + dueInHours);

  let assignedTo: string | null = null;
  if (config.assignToUserId) {
    assignedTo = config.assignToUserId;
  } else if (config.assignToGroupId) {
    const group = await db.query.assignmentGroups.findFirst({
      where: eq(assignmentGroups.id, config.assignToGroupId),
    });
    if (group && Array.isArray(group.members) && group.members.length > 0) {
      assignedTo = group.members[0];
    }
  } else if (config.assignToField) {
    assignedTo = context.workflowContext[config.assignToField];
  }

  const [task] = await db
    .insert(tasks)
    .values({
      tenantId: context.tenantId,
      title,
      description,
      status: 'todo',
      priority: priority as 'low' | 'medium' | 'high' | 'urgent',
      assignedTo,
      createdBy: context.userId || 'system',
      dueDate,
      customFields: {
        workflowExecutionId: context.executionId,
        workflowContext: context.workflowContext,
        ...config.customFields,
      },
    })
    .returning();

  log.info(`[Task Action] Created task ${task.id}`);
  return { taskId: task.id, assignedTo: task.assignedTo, dueDate: task.dueDate };
}

/**
 * Send Notification Action. No in-app notification transport exists in this
 * codebase yet, so the intent is recorded on the step output (and visible in the
 * execution timeline) rather than silently claimed as delivered.
 */
async function sendNotificationAction(
  config: Record<string, any>,
  context: StepContext,
): Promise<any> {
  const message = interpolateString(config.message, context.workflowContext);
  const recipients = config.recipients || [];
  log.info(`[Notification Action] ${recipients.join(', ')} — ${message}`);
  return { recipients, message, delivered: false, reason: 'no notification transport configured' };
}

/**
 * Send Email Action — real send via the tenant email service.
 */
async function sendEmailAction(config: Record<string, any>, context: StepContext): Promise<any> {
  const toList: string[] = Array.isArray(config.to) ? config.to : config.to ? [config.to] : [];
  const subject = interpolateString(config.subject, context.workflowContext);
  const html = interpolateString(config.body ?? config.html ?? '', context.workflowContext);
  const text = config.text ? interpolateString(config.text, context.workflowContext) : undefined;

  if (toList.length === 0) throw new Error('email action requires at least one recipient');

  const results = [];
  for (const to of toList) {
    const r = await sendEmail({ to, subject, html, text, from: config.from });
    results.push({ to, success: (r as any)?.success !== false, messageId: (r as any)?.messageId });
  }
  log.info(`[Email Action] sent ${results.length} message(s)`);
  return { to: toList, subject, results };
}

/**
 * Send Webhook Action — real outbound HTTP through the SSRF-guarded client (CR-005).
 */
async function sendWebhookAction(config: Record<string, any>, context: StepContext): Promise<any> {
  const url = config.url as string;
  if (!url) throw new Error('webhook action requires a url');
  const method = (config.method || 'POST').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
  const payload = config.payload ?? context.workflowContext;

  const response = await safeFetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(payload),
    timeoutMs: 10000,
  });

  if (!response.ok) {
    throw new Error(`webhook returned ${response.status}`);
  }
  return { url, method, status: response.status, ok: true };
}

/**
 * Update CRM Action — patch an allowlisted field on a business_records row.
 * Tenant-scoped; unknown fields are rejected.
 */
async function updateCrmAction(config: Record<string, any>, context: StepContext): Promise<any> {
  const recordId =
    config.recordId ||
    (config.recordIdField
      ? getNestedValue(context.workflowContext, config.recordIdField)
      : undefined) ||
    context.workflowContext.recordId ||
    context.workflowContext.businessRecordId;
  const field = config.field as string;

  if (!recordId) throw new Error('update_crm action requires a recordId');
  if (!field || !CRM_WRITABLE_FIELDS.has(field)) {
    throw new Error(`update_crm field "${field}" is not writable`);
  }

  const value =
    typeof config.value === 'string'
      ? interpolateString(config.value, context.workflowContext)
      : config.value;

  const [updated] = await db
    .update(businessRecords)
    .set({ [field]: value, updatedAt: new Date() } as any)
    .where(and(eq(businessRecords.id, recordId), eq(businessRecords.tenantId, context.tenantId)))
    .returning({ id: businessRecords.id });

  if (!updated) throw new Error(`business record ${recordId} not found for tenant`);
  return { recordId, field, updated: true };
}

/**
 * Interpolate {{field}} / {{a.b}} tokens from context into a template string.
 */
function interpolateString(template: string, context: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(context, path);
    return value !== undefined ? String(value) : match;
  });
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Process an approval response. Approve → mark the parked step complete and
 * durably resume the execution at the next step. Reject → fail the execution.
 */
export async function processApprovalResponse(
  approvalId: string,
  userId: string,
  approved: boolean,
  comment?: string,
): Promise<void> {
  log.info(`[Approval] Processing ${approvalId} (approved=${approved})`);

  await db
    .update(workflowApprovals)
    .set({
      status: approved ? 'approved' : 'rejected',
      approvedBy: userId,
      approvalComment: comment || null,
      respondedAt: new Date(),
    })
    .where(eq(workflowApprovals.id, approvalId));

  const approval = await db.query.workflowApprovals.findFirst({
    where: eq(workflowApprovals.id, approvalId),
  });
  if (!approval) throw new Error(`Approval not found: ${approvalId}`);

  await db.insert(workflowExecutionEvents).values({
    executionId: approval.executionId,
    stepExecutionId: approval.stepExecutionId,
    eventType: approved ? 'approval_approved' : 'approval_rejected',
    message: `Approval ${approved ? 'approved' : 'rejected'} by ${userId}`,
    eventData: { approvalId, userId, approved, comment },
  });

  // Mark the parked approval step execution's terminal status.
  await db
    .update(workflowExecutionSteps)
    .set({ status: approved ? 'completed' : 'failed', completedAt: new Date() })
    .where(eq(workflowExecutionSteps.id, approval.stepExecutionId));

  const execution = await db.query.workflowExecutions.findFirst({
    where: eq(workflowExecutions.id, approval.executionId),
  });
  const runtime = ((execution?.context as Record<string, any>) || {})._runtime || {};

  if (approved) {
    await executeWorkflow(approval.executionId, { startIndex: runtime.nextStepIndex ?? 0 });
  } else {
    // Reject terminates the run. Guard on the paused state so we don't clobber a
    // concurrently-resumed execution.
    await db
      .update(workflowExecutions)
      .set({
        status: 'failed',
        error: 'Approval rejected',
        completedAt: new Date(),
        resumeAt: null,
      })
      .where(
        and(
          eq(workflowExecutions.id, approval.executionId),
          eq(workflowExecutions.status, 'paused'),
        ),
      );
  }
}
