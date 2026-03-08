import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('workflow-event-service');

import {
  workflowTriggers,
  workflowConditions,
  workflows,
  workflowVersions,
  workflowExecutions,
  workflowExecutionEvents,
  type WorkflowEventRegistry,
} from '@shared/schema';

/**
 * Workflow Event Service
 *
 * This service handles emitting business events that can trigger workflows.
 * When a business event occurs (contract signed, quote submitted, etc.),
 * this service finds matching workflow triggers and initiates execution.
 */

interface EventPayload {
  [key: string]: any;
}

interface EventContext {
  tenantId: string;
  userId?: string;
  eventName: string;
  payload: EventPayload;
  timestamp: Date;
}

/**
 * Emit a business event to trigger workflows
 *
 * @param eventName - Name of the event (e.g., 'contract.signed', 'quote.submitted')
 * @param tenantId - Tenant ID for multi-tenancy
 * @param payload - Event data (order info, customer data, etc.)
 * @param userId - Optional user who triggered the event
 * @returns Array of triggered workflow execution IDs
 */
export async function emitWorkflowEvent(
  eventName: string,
  tenantId: string,
  payload: EventPayload,
  userId?: string,
): Promise<string[]> {
  log.info(`[Workflow Event] Emitting event: ${eventName} for tenant: ${tenantId}`);

  try {
    // Find all active workflows with triggers for this event
    const triggers = await db.query.workflowTriggers.findMany({
      where: and(
        eq(workflowTriggers.eventName, eventName),
        eq(workflowTriggers.enabled, true),
        eq(workflowTriggers.type, 'event'),
      ),
      with: {
        workflow: true,
      },
    });

    if (triggers.length === 0) {
      log.info(`[Workflow Event] No triggers found for event: ${eventName}`);
      return [];
    }

    log.info(`[Workflow Event] Found ${triggers.length} triggers for event: ${eventName}`);

    const executionIds: string[] = [];

    // Process each trigger
    for (const trigger of triggers) {
      // @ts-ignore - with relation not typed properly
      const workflow = trigger.workflow;

      // Skip if workflow is not active or doesn't belong to this tenant
      if (!workflow || workflow.status !== 'active' || workflow.tenantId !== tenantId) {
        log.info(`[Workflow Event] Skipping inactive or mismatched workflow: ${workflow?.id}`);
        continue;
      }

      // Check if trigger conditions are met
      const conditionsMet = await evaluateTriggerConditions(trigger.id, payload);
      if (!conditionsMet) {
        log.info(`[Workflow Event] Conditions not met for trigger: ${trigger.id}`);
        continue;
      }

      // Get the current version of the workflow
      const version = await db.query.workflowVersions.findFirst({
        where: eq(workflowVersions.id, workflow.currentVersionId!),
      });

      if (!version) {
        log.info(`[Workflow Event] No version found for workflow: ${workflow.id}`);
        continue;
      }

      // Map event payload to workflow context using payloadMapping
      const context = mapPayloadToContext(payload, trigger.payloadMapping as any);

      // Create workflow execution
      const [execution] = await db
        .insert(workflowExecutions)
        .values({
          workflowId: workflow.id,
          workflowVersionId: version.id,
          triggerId: trigger.id,
          tenantId,
          status: 'queued',
          initiatedBy: userId || 'system',
          context,
          result: null,
          error: null,
          startedAt: null,
          completedAt: null,
        })
        .returning();

      // Log execution event
      await db.insert(workflowExecutionEvents).values({
        executionId: execution.id,
        stepExecutionId: null,
        eventType: 'execution_queued',
        message: `Workflow triggered by event: ${eventName}`,
        eventData: { eventName, payload: context },
      });

      executionIds.push(execution.id);
      log.info(
        `[Workflow Event] Created execution: ${execution.id} for workflow: ${workflow.name}`,
      );
    }

    // Trigger asynchronous execution (in production, this would use a job queue)
    if (executionIds.length > 0) {
      setImmediate(() => {
        processQueuedExecutions(tenantId).catch((err) => log.error(err, 'Failed to process queued executions'));
      });
    }

    return executionIds;
  } catch (error) {
    log.error(`[Workflow Event] Error emitting event ${eventName}:`, error);
    throw error;
  }
}

/**
 * Evaluate trigger conditions against payload data
 */
async function evaluateTriggerConditions(
  triggerId: string,
  payload: EventPayload,
): Promise<boolean> {
  const conditions = await db.query.workflowConditions.findMany({
    where: eq(workflowConditions.triggerId, triggerId),
  });

  if (conditions.length === 0) {
    return true; // No conditions means always trigger
  }

  // Group conditions by conditionGroup
  const groups = conditions.reduce(
    (acc, condition) => {
      const group = condition.conditionGroup || 'default';
      if (!acc[group]) acc[group] = [];
      acc[group].push(condition);
      return acc;
    },
    {} as Record<string, typeof conditions>,
  );

  // Evaluate each group (groups are OR'd together)
  for (const groupConditions of Object.values(groups)) {
    const groupResult = evaluateConditionGroup(groupConditions, payload);
    if (groupResult) {
      return true; // At least one group passed
    }
  }

  return false;
}

/**
 * Evaluate a group of conditions (within group, conditions are AND'd/OR'd based on operator)
 */
function evaluateConditionGroup(conditions: any[], payload: EventPayload): boolean {
  // Sort by order index
  conditions.sort((a, b) => a.orderIndex - b.orderIndex);

  let result = true;

  for (const condition of conditions) {
    const leftValue = getNestedValue(payload, condition.leftOperand);
    const rightValue = condition.rightOperand;
    const conditionResult = evaluateCondition(
      leftValue,
      condition.operator,
      rightValue,
      condition.dataType,
    );

    // Apply logical operator
    if (condition.logicalOperator === 'AND') {
      result = result && conditionResult;
    } else if (condition.logicalOperator === 'OR') {
      result = result || conditionResult;
    } else if (condition.logicalOperator === 'NOT') {
      result = result && !conditionResult;
    }

    // Short-circuit if result is false with AND
    if (!result && condition.logicalOperator === 'AND') {
      return false;
    }
  }

  return result;
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  leftValue: any,
  operator: string,
  rightValue: any,
  dataType: string,
): boolean {
  // Handle null checks first
  if (operator === 'is_null') {
    return leftValue === null || leftValue === undefined;
  }
  if (operator === 'is_not_null') {
    return leftValue !== null && leftValue !== undefined;
  }

  // Type conversion based on dataType
  const left = convertValue(leftValue, dataType);
  const right = convertValue(rightValue, dataType);

  switch (operator) {
    case 'equals':
      return left === right;
    case 'not_equals':
      return left !== right;
    case 'greater_than':
      return left > right;
    case 'less_than':
      return left < right;
    case 'greater_than_or_equal':
      return left >= right;
    case 'less_than_or_equal':
      return left <= right;
    case 'contains':
      return String(left).includes(String(right));
    case 'not_contains':
      return !String(left).includes(String(right));
    case 'starts_with':
      return String(left).startsWith(String(right));
    case 'ends_with':
      return String(left).endsWith(String(right));
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'not_in':
      return Array.isArray(right) && !right.includes(left);
    case 'matches_regex':
      return new RegExp(String(right)).test(String(left));
    default:
      log.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Convert value to proper type
 */
function convertValue(value: any, dataType: string): any {
  if (value === null || value === undefined) return value;

  switch (dataType) {
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'date':
      return new Date(value);
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Map event payload to workflow context using mapping configuration
 */
function mapPayloadToContext(
  payload: EventPayload,
  mapping: Record<string, string> | null,
): EventPayload {
  if (!mapping) {
    return payload; // No mapping, use payload as-is
  }

  const context: EventPayload = {};

  for (const [targetKey, sourceKey] of Object.entries(mapping)) {
    context[targetKey] = getNestedValue(payload, sourceKey);
  }

  return context;
}

/**
 * Process queued workflow executions
 * In production, this would be handled by a job queue (Bull, BullMQ, etc.)
 */
async function processQueuedExecutions(tenantId: string): Promise<void> {
  log.info(`[Workflow Execution] Processing queued executions for tenant: ${tenantId}`);

  const queuedExecutions = await db.query.workflowExecutions.findMany({
    where: and(eq(workflowExecutions.tenantId, tenantId), eq(workflowExecutions.status, 'queued')),
    limit: 10, // Process in batches
  });

  for (const execution of queuedExecutions) {
    try {
      await executeWorkflow(execution.id);
    } catch (error) {
      log.error(`[Workflow Execution] Error executing workflow ${execution.id}:`, error);
    }
  }
}

/**
 * Execute a workflow
 * This is a placeholder - the full implementation would go in a separate service
 */
async function executeWorkflow(executionId: string): Promise<void> {
  log.info(`[Workflow Execution] Executing workflow: ${executionId}`);
  // This will be implemented in the workflow-execution-service.ts
  // For now, we'll import and call it when that service is created
}

/**
 * Helper function to emit common business events
 */
export const WorkflowEvents = {
  // Contract events
  CONTRACT_SIGNED: 'contract.signed',
  CONTRACT_RENEWED: 'contract.renewed',
  CONTRACT_EXPIRING: 'contract.expiring',

  // Quote events
  QUOTE_SUBMITTED: 'quote.submitted',
  QUOTE_APPROVED: 'quote.approved',
  QUOTE_REJECTED: 'quote.rejected',
  QUOTE_LOW_MARGIN: 'quote.low_margin', // Yellow/red margin

  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  LEAD_CONVERTED: 'lead.converted',

  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',

  // Service events
  SERVICE_CALL_CREATED: 'service_call.created',
  SERVICE_CALL_COMPLETED: 'service_call.completed',
  EQUIPMENT_INSTALLED: 'equipment.installed',

  // Invoice events
  INVOICE_GENERATED: 'invoice.generated',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',
};
