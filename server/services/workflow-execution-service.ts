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
  type WorkflowExecution,
  type WorkflowStepAutomation,
} from '@shared/schema';

/**
 * Workflow Execution Service
 *
 * This service handles the execution of workflow steps, including:
 * - Creating tasks and assigning them to users/groups
 * - Handling approval workflows
 * - Sending notifications
 * - Executing various action types
 */

interface StepContext {
  executionId: string;
  tenantId: string;
  workflowContext: Record<string, any>;
  userId?: string;
}

/**
 * Execute a workflow from start to finish
 */
export async function executeWorkflow(executionId: string): Promise<void> {
  log.info(`[Workflow Execution] Starting execution: ${executionId}`);

  try {
    // Get execution details
    const execution = await db.query.workflowExecutions.findFirst({
      where: eq(workflowExecutions.id, executionId),
    });

    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Update status to running
    await db
      .update(workflowExecutions)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    // Log execution start
    await db.insert(workflowExecutionEvents).values({
      executionId: execution.id,
      stepExecutionId: null,
      eventType: 'execution_started',
      message: 'Workflow execution started',
      eventData: { executionId },
    });

    // Get workflow steps in order
    const steps = await db.query.workflowStepsAutomation.findMany({
      where: eq(workflowStepsAutomation.workflowId, execution.workflowId),
      orderBy: (steps, { asc }) => [asc(steps.orderIndex)],
    });

    log.info(`[Workflow Execution] Executing ${steps.length} steps`);

    // Execute each step in sequence
    let allStepsSucceeded = true;
    for (const step of steps) {
      const stepSuccess = await executeStep(step, {
        executionId: execution.id,
        tenantId: execution.tenantId,
        workflowContext: (execution.context as Record<string, any>) || {},
        userId: execution.initiatedBy || undefined,
      });

      if (!stepSuccess) {
        allStepsSucceeded = false;
        if (!step.continueOnError) {
          log.info(`[Workflow Execution] Step failed, stopping execution: ${step.id}`);
          break;
        }
      }
    }

    // Update final status
    const finalStatus = allStepsSucceeded ? 'completed' : 'failed';
    await db
      .update(workflowExecutions)
      .set({
        status: finalStatus,
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    // Log execution completion
    await db.insert(workflowExecutionEvents).values({
      executionId: execution.id,
      stepExecutionId: null,
      eventType: finalStatus === 'completed' ? 'execution_completed' : 'execution_failed',
      message: `Workflow execution ${finalStatus}`,
      eventData: { executionId, status: finalStatus },
    });

    log.info(`[Workflow Execution] Execution ${finalStatus}: ${executionId}`);
  } catch (error) {
    log.error(`[Workflow Execution] Error executing workflow ${executionId}:`, error);

    // Update status to failed
    await db
      .update(workflowExecutions)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    // Log error event
    await db.insert(workflowExecutionEvents).values({
      executionId,
      stepExecutionId: null,
      eventType: 'execution_error',
      message: `Workflow execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      eventData: { error: String(error) },
    });

    throw error;
  }
}

/**
 * Execute a single workflow step
 */
async function executeStep(step: WorkflowStepAutomation, context: StepContext): Promise<boolean> {
  log.info(`[Workflow Step] Executing step: ${step.name} (${step.actionType})`);

  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount <= (step.maxRetries || 0)) {
    try {
      // Create step execution record
      const [stepExecution] = await db
        .insert(workflowExecutionSteps)
        .values({
          executionId: context.executionId,
          stepId: step.id,
          stepName: step.name,
          status: 'running',
          input: context.workflowContext,
          output: null,
          error: null,
          retryCount,
          startedAt: new Date(),
          completedAt: null,
        })
        .returning();

      // Execute the step based on action type
      const result = await executeStepAction(step, context);

      // Update step execution with success
      await db
        .update(workflowExecutionSteps)
        .set({
          status: 'completed',
          output: result,
          completedAt: new Date(),
        })
        .where(eq(workflowExecutionSteps.id, stepExecution.id));

      log.info(`[Workflow Step] Step completed: ${step.name}`);
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log.error(`[Workflow Step] Step failed (attempt ${retryCount + 1}):`, error);

      if (retryCount < (step.maxRetries || 0) && step.retryEnabled) {
        retryCount++;
        const delayMs = (step.retryDelaySeconds || 60) * 1000;
        log.info(`[Workflow Step] Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }

  // All retries exhausted - mark as failed
  log.error(`[Workflow Step] Step failed after ${retryCount} retries: ${step.name}`);
  return false;
}

/**
 * Execute the actual step action based on type
 */
async function executeStepAction(step: WorkflowStepAutomation, context: StepContext): Promise<any> {
  const config = step.config as Record<string, any>;

  switch (step.actionType) {
    case 'create_task':
      return await createTaskAction(config, context);

    case 'require_approval':
    case 'wait_for_approval':
      return await createApprovalAction(config, context);

    case 'send_notification':
      return await sendNotificationAction(config, context);

    case 'email':
      return await sendEmailAction(config, context);

    case 'wait_delay':
      return await waitDelayAction(config, context);

    // Add more action types as needed
    default:
      log.warn(`[Workflow Step] Unknown action type: ${step.actionType}`);
      return { message: 'Action type not implemented', actionType: step.actionType };
  }
}

/**
 * Create Task Action
 * Creates a task and assigns it to a user or group
 */
async function createTaskAction(config: Record<string, any>, context: StepContext): Promise<any> {
  log.info('[Task Action] Creating task');

  // Interpolate values from context
  const title = interpolateString(config.title, context.workflowContext);
  const description = interpolateString(config.description, context.workflowContext);
  const priority = config.priority || 'medium';
  const dueInHours = config.dueInHours || 24;

  // Calculate due date
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + dueInHours);

  // Determine assignment
  let assignedTo: string | null = null;
  if (config.assignToUserId) {
    assignedTo = config.assignToUserId;
  } else if (config.assignToGroupId) {
    // Get first available member from group
    const group = await db.query.assignmentGroups.findFirst({
      where: eq(assignmentGroups.id, config.assignToGroupId),
    });

    if (group && group.members && Array.isArray(group.members) && group.members.length > 0) {
      // Round-robin or random assignment could be implemented here
      assignedTo = group.members[0];
    }
  } else if (config.assignToField) {
    // Assign to user ID from workflow context
    assignedTo = context.workflowContext[config.assignToField];
  }

  // Create the task
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

  log.info(`[Task Action] Created task: ${task.id} - "${task.title}"`);

  return {
    taskId: task.id,
    assignedTo: task.assignedTo,
    dueDate: task.dueDate,
  };
}

/**
 * Create Approval Action
 * Creates an approval request and waits for response
 */
async function createApprovalAction(
  config: Record<string, any>,
  context: StepContext,
): Promise<any> {
  log.info('[Approval Action] Creating approval request');

  const dueInHours = config.dueInHours || 48;
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + dueInHours);

  // Get step execution ID (should be passed from executeStep)
  // For now, we'll get the latest one
  const stepExecution = await db.query.workflowExecutionSteps.findFirst({
    where: eq(workflowExecutionSteps.executionId, context.executionId),
    orderBy: (steps, { desc }) => [desc(steps.createdAt)],
  });

  if (!stepExecution) {
    throw new Error('Step execution not found for approval');
  }

  // Create approval request
  const [approval] = await db
    .insert(workflowApprovals)
    .values({
      tenantId: context.tenantId,
      executionId: context.executionId,
      stepExecutionId: stepExecution.id,
      assignedToUserId: config.assignToUserId || null,
      assignedToGroupId: config.assignToGroupId || null,
      status: 'pending',
      dueDate,
      contextData: {
        ...context.workflowContext,
        approvalMessage: interpolateString(config.message || '', context.workflowContext),
      },
    })
    .returning();

  log.info(`[Approval Action] Created approval request: ${approval.id}`);

  // In a real implementation, this would pause the workflow and wait for approval
  // For now, we'll return the approval ID
  return {
    approvalId: approval.id,
    status: 'pending',
    dueDate: approval.dueDate,
  };
}

/**
 * Send Notification Action
 * Sends a notification to users
 */
async function sendNotificationAction(
  config: Record<string, any>,
  context: StepContext,
): Promise<any> {
  log.info('[Notification Action] Sending notification');

  const message = interpolateString(config.message, context.workflowContext);
  const recipients = config.recipients || [];

  // In production, this would integrate with a notification service
  // For now, we'll log it
  log.info(`[Notification] To: ${recipients.join(', ')} - ${message}`);

  return {
    recipients,
    message,
    sent: true,
  };
}

/**
 * Send Email Action
 * Sends an email
 */
async function sendEmailAction(config: Record<string, any>, context: StepContext): Promise<any> {
  log.info('[Email Action] Sending email');

  const to = config.to || [];
  const subject = interpolateString(config.subject, context.workflowContext);
  const body = interpolateString(config.body, context.workflowContext);

  // In production, this would use an email service
  log.info(`[Email] To: ${to.join(', ')} - Subject: ${subject}`);

  return {
    to,
    subject,
    sent: true,
  };
}

/**
 * Wait Delay Action
 * Delays execution for a specified time
 */
async function waitDelayAction(config: Record<string, any>, context: StepContext): Promise<any> {
  const delaySeconds = config.delaySeconds || 60;
  const delayMs = delaySeconds * 1000;

  log.info(`[Wait Action] Waiting for ${delaySeconds} seconds`);

  // In production, this would schedule a job to resume later
  // For now, we'll use setTimeout for demo purposes
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  return {
    delayed: delaySeconds,
    resumedAt: new Date(),
  };
}

/**
 * Interpolate string with context values
 * Replaces {{field}} with values from context
 */
function interpolateString(template: string, context: Record<string, any>): string {
  if (!template) return '';

  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(context, path);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Process approval response
 * Called when a user approves or rejects an approval request
 */
export async function processApprovalResponse(
  approvalId: string,
  userId: string,
  approved: boolean,
  comment?: string,
): Promise<void> {
  log.info(`[Approval] Processing response for approval: ${approvalId}`);

  // Update approval record
  await db
    .update(workflowApprovals)
    .set({
      status: approved ? 'approved' : 'rejected',
      approvedBy: userId,
      approvalComment: comment || null,
      respondedAt: new Date(),
    })
    .where(eq(workflowApprovals.id, approvalId));

  // Get the approval to find the execution
  const approval = await db.query.workflowApprovals.findFirst({
    where: eq(workflowApprovals.id, approvalId),
  });

  if (!approval) {
    throw new Error(`Approval not found: ${approvalId}`);
  }

  // Log the approval event
  await db.insert(workflowExecutionEvents).values({
    executionId: approval.executionId,
    stepExecutionId: approval.stepExecutionId,
    eventType: approved ? 'approval_approved' : 'approval_rejected',
    message: `Approval ${approved ? 'approved' : 'rejected'} by user ${userId}`,
    eventData: {
      approvalId,
      userId,
      approved,
      comment,
    },
  });

  // If approved, continue workflow execution
  if (approved) {
    // In production, this would resume the paused workflow
    // For now, we'll just log it
    log.info(`[Approval] Approval approved, resuming workflow execution: ${approval.executionId}`);
  } else {
    // Workflow should be cancelled or handle rejection
    log.info(
      `[Approval] Approval rejected, workflow may need to handle rejection: ${approval.executionId}`,
    );
  }
}
