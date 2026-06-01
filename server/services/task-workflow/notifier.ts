/**
 * Task Workflow — Assignment Notifier
 *
 * Sends the "you've been assigned a task" handoff when a step becomes active:
 *  1. Email (via the provider-agnostic email-service) using the
 *     taskWorkflowStepAssigned template.
 *  2. In-app notification row (userNotifications) + real-time WebSocket push,
 *     mirroring routes-notifications.ts so the notification bell + deep link work.
 *
 * Resolves the recipient from the step's assigneeUserId (internal user) or
 * assigneeEmail (external assignee). Failures are logged but never throw — a
 * notification problem must not block workflow progression.
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  userNotifications,
  taskWorkflowSteps,
  type TaskWorkflow,
  type TaskWorkflowStep,
} from '@shared/schema';
import { sendEmail } from '../email-service';
import { EmailTemplates } from '../email-templates';
import { webSocketService } from '../../websocket-service';
import { createModuleLogger } from '../../lib/logger';

const log = createModuleLogger('task-workflow-notifier');

function baseUrl(): string {
  return process.env.PUBLIC_URL || 'http://localhost:5000';
}

export function buildStepUrl(workflowId: string, stepId: string): string {
  return `${baseUrl()}/workflows/${workflowId}/steps/${stepId}`;
}

interface Recipient {
  userId?: string;
  email?: string;
  name?: string;
}

async function resolveRecipient(step: TaskWorkflowStep): Promise<Recipient | null> {
  if (step.assigneeUserId) {
    const [u] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, step.assigneeUserId))
      .limit(1);
    if (u) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      return {
        userId: u.id,
        email: u.email || undefined,
        name: name || step.assigneeName || undefined,
      };
    }
  }
  if (step.assigneeEmail) {
    return { email: step.assigneeEmail, name: step.assigneeName || undefined };
  }
  return null;
}

/**
 * Notify the assignee of a single step. Respects workflow.settings flags
 * (notifyByEmail / notifyInApp, both default true). Stamps notifiedAt.
 */
export async function notifyStepAssigned(
  workflow: TaskWorkflow,
  step: TaskWorkflowStep,
  assignedByName?: string,
): Promise<void> {
  try {
    const settings = (workflow.settings || {}) as Record<string, any>;
    const notifyByEmail = settings.notifyByEmail !== false;
    const notifyInApp = settings.notifyInApp !== false;

    const recipient = await resolveRecipient(step);
    if (!recipient) {
      log.info(`No recipient resolved for step ${step.id}; skipping notification`);
      return;
    }

    const stepUrl = buildStepUrl(workflow.id, step.id);
    const dueDate = step.dueAt ? new Date(step.dueAt).toLocaleDateString() : undefined;

    // 1) Email
    if (notifyByEmail && recipient.email) {
      const tpl = EmailTemplates.taskWorkflowStepAssigned({
        assigneeName: recipient.name,
        workflowName: workflow.name,
        stepTitle: step.title,
        stepDetails: step.details || undefined,
        dueDate,
        assignedByName,
        stepUrl,
        userEmail: recipient.email,
      });
      const result = await sendEmail({
        to: recipient.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      if (!result.success) {
        log.warn(`Email to ${recipient.email} for step ${step.id} not sent: ${result.error}`);
      }
    }

    // 2) In-app notification + WebSocket push (internal users only)
    if (notifyInApp && recipient.userId) {
      try {
        const [notification] = await db
          .insert(userNotifications)
          .values({
            tenantId: workflow.tenantId,
            userId: recipient.userId,
            type: 'task_workflow_step_assigned',
            priority: 'medium',
            category: 'system',
            title: 'New task assigned',
            message: `${step.title} — in "${workflow.name}"`,
            actionUrl: `/workflows/${workflow.id}/steps/${step.id}`,
            actionLabel: 'Open Task',
            metadata: { workflowId: workflow.id, stepId: step.id },
          } as any)
          .returning();
        webSocketService.broadcastNotification(recipient.userId, workflow.tenantId, notification);
      } catch (err) {
        log.warn(`In-app notification for step ${step.id} failed`, err as any);
      }
    }

    // Stamp notifiedAt
    await db
      .update(taskWorkflowSteps)
      .set({ notifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(taskWorkflowSteps.id, step.id), eq(taskWorkflowSteps.tenantId, step.tenantId)));
  } catch (err) {
    log.error(`notifyStepAssigned failed for step ${step.id}`, err as any);
  }
}

/** Notify every assignee of the given steps (e.g. all parallel steps in a stage). */
export async function notifyStepsAssigned(
  workflow: TaskWorkflow,
  steps: TaskWorkflowStep[],
  assignedByName?: string,
): Promise<void> {
  for (const step of steps) {
    await notifyStepAssigned(workflow, step, assignedByName);
  }
}
