/**
 * Workflow Trigger Framework
 * Part of Improvement #2 - Cross-Module Task Automation
 *
 * Automatically creates tasks based on events in other modules:
 * - Service calls completed → Follow-up tasks
 * - Deal stage changes → Proposal/contract tasks
 * - Invoices overdue → Collection tasks
 * - Customer onboarding → Setup task sequences
 */

import { db } from '../db';
import { tasks } from '../../shared/task-schema.js';

export interface TriggerEvent {
  type: string;
  entityId: string;
  entityType: string;
  tenantId: string;
  userId: string;
  metadata?: Record<string, any>;
}

export interface TaskTemplate {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueInDays?: number;
  estimatedHours?: number;
  tags?: string[];
}

/**
 * Workflow Trigger Registry
 * Maps events to task templates
 */
export const WorkflowTriggers = {
  /**
   * SERVICE CALL WORKFLOWS
   */
  'service_call.completed': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Schedule follow-up call',
        description: `Follow up on service call ${event.entityId} - check customer satisfaction`,
        priority: 'medium',
        dueInDays: 3,
        estimatedHours: 1,
        tags: ['service', 'follow-up'],
      },
      {
        title: 'Update service documentation',
        description: `Document service call findings for ${event.metadata?.equipmentId}`,
        priority: 'low',
        dueInDays: 7,
        estimatedHours: 2,
        tags: ['service', 'documentation'],
      },
    ];
  },

  'service_call.parts_ordered': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Track parts delivery',
        description: `Monitor delivery of parts ordered for service call ${event.entityId}`,
        priority: 'high',
        dueInDays: 1,
        estimatedHours: 1,
        tags: ['service', 'parts'],
      },
      {
        title: 'Schedule installation appointment',
        description: 'Contact customer to schedule parts installation',
        priority: 'medium',
        dueInDays: 2,
        estimatedHours: 1,
        tags: ['service', 'scheduling'],
      },
    ];
  },

  /**
   * SALES WORKFLOW TRIGGERS
   */
  'deal.moved_to_proposal': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Create proposal document',
        description: `Generate proposal for deal ${event.metadata?.dealName}`,
        priority: 'high',
        assignedTo: event.metadata?.accountExecutiveId,
        dueInDays: 2,
        estimatedHours: 4,
        tags: ['sales', 'proposal'],
      },
      {
        title: 'Schedule proposal presentation',
        description: 'Book meeting to present proposal to customer',
        priority: 'high',
        assignedTo: event.metadata?.accountExecutiveId,
        dueInDays: 5,
        estimatedHours: 2,
        tags: ['sales', 'meeting'],
      },
    ];
  },

  'deal.moved_to_contract': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Prepare contract documents',
        description: `Draft contract for ${event.metadata?.dealName}`,
        priority: 'urgent',
        assignedTo: event.metadata?.accountExecutiveId,
        dueInDays: 1,
        estimatedHours: 3,
        tags: ['sales', 'legal'],
      },
      {
        title: 'Legal review',
        description: 'Submit contract for legal review',
        priority: 'high',
        dueInDays: 3,
        estimatedHours: 2,
        tags: ['sales', 'legal'],
      },
    ];
  },

  'deal.won': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Initiate customer onboarding',
        description: `Start onboarding process for new customer ${event.metadata?.companyName}`,
        priority: 'urgent',
        dueInDays: 1,
        estimatedHours: 2,
        tags: ['onboarding', 'customer-success'],
      },
      {
        title: 'Setup welcome call',
        description: 'Schedule welcome and kickoff call with customer',
        priority: 'high',
        dueInDays: 2,
        estimatedHours: 1,
        tags: ['onboarding', 'customer-success'],
      },
      {
        title: 'Configure customer account',
        description: 'Set up customer account in all systems',
        priority: 'high',
        dueInDays: 3,
        estimatedHours: 3,
        tags: ['onboarding', 'operations'],
      },
    ];
  },

  /**
   * BILLING WORKFLOW TRIGGERS
   */
  'invoice.overdue_30_days': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Collections call - 30 days overdue',
        description: `Contact customer about overdue invoice ${event.metadata?.invoiceNumber}`,
        priority: 'high',
        assignedTo: event.metadata?.accountManagerId,
        dueInDays: 1,
        estimatedHours: 1,
        tags: ['billing', 'collections'],
      },
    ];
  },

  'invoice.overdue_60_days': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Escalated collections - 60 days overdue',
        description: `Escalate overdue invoice ${event.metadata?.invoiceNumber} - consider payment plan`,
        priority: 'urgent',
        assignedTo: event.metadata?.accountManagerId,
        dueInDays: 1,
        estimatedHours: 2,
        tags: ['billing', 'collections', 'escalation'],
      },
    ];
  },

  'invoice.overdue_90_days': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Critical collections - 90 days overdue',
        description: `URGENT: Invoice ${event.metadata?.invoiceNumber} is 90 days overdue - legal action may be required`,
        priority: 'urgent',
        assignedTo: event.metadata?.accountManagerId,
        dueInDays: 1,
        estimatedHours: 3,
        tags: ['billing', 'collections', 'legal'],
      },
    ];
  },

  /**
   * EQUIPMENT WORKFLOW TRIGGERS
   */
  'equipment.delivered': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Schedule equipment installation',
        description: `Schedule installation for equipment ${event.metadata?.serialNumber}`,
        priority: 'high',
        dueInDays: 2,
        estimatedHours: 4,
        tags: ['equipment', 'installation'],
      },
      {
        title: 'Prepare installation documentation',
        description: 'Gather all necessary installation guides and checklists',
        priority: 'medium',
        dueInDays: 3,
        estimatedHours: 1,
        tags: ['equipment', 'documentation'],
      },
    ];
  },

  'equipment.installation_complete': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Customer training session',
        description: `Train customer on equipment ${event.metadata?.modelName}`,
        priority: 'high',
        dueInDays: 1,
        estimatedHours: 2,
        tags: ['equipment', 'training'],
      },
      {
        title: 'Post-installation follow-up',
        description: 'Check in with customer after installation',
        priority: 'medium',
        dueInDays: 7,
        estimatedHours: 1,
        tags: ['equipment', 'customer-success'],
      },
    ];
  },

  /**
   * CUSTOMER SUCCESS WORKFLOW TRIGGERS
   */
  'customer.onboarding_started': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Complete customer profile',
        description: `Set up complete profile for ${event.metadata?.companyName}`,
        priority: 'high',
        dueInDays: 1,
        estimatedHours: 2,
        tags: ['onboarding', 'data-entry'],
      },
      {
        title: 'Assign account manager',
        description: 'Assign dedicated account manager to customer',
        priority: 'high',
        dueInDays: 1,
        estimatedHours: 1,
        tags: ['onboarding', 'assignment'],
      },
      {
        title: 'Schedule kickoff meeting',
        description: 'Book onboarding kickoff meeting',
        priority: 'high',
        dueInDays: 3,
        estimatedHours: 2,
        tags: ['onboarding', 'meeting'],
      },
    ];
  },

  'customer.health_score_low': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Customer health check',
        description: `LOW HEALTH SCORE: Contact ${event.metadata?.companyName} to address concerns`,
        priority: 'urgent',
        assignedTo: event.metadata?.accountManagerId,
        dueInDays: 1,
        estimatedHours: 2,
        tags: ['customer-success', 'at-risk'],
      },
    ];
  },

  'contract.renewal_due_90_days': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
    return [
      {
        title: 'Initiate contract renewal discussion',
        description: `Contract renews in 90 days - start renewal conversation with ${event.metadata?.companyName}`,
        priority: 'high',
        assignedTo: event.metadata?.accountManagerId,
        dueInDays: 7,
        estimatedHours: 3,
        tags: ['renewal', 'customer-success'],
      },
    ];
  },
};

/**
 * Trigger a workflow and create associated tasks
 */
export async function triggerWorkflow(event: TriggerEvent): Promise<void> {
  try {
    console.log(`🔔 Workflow trigger: ${event.type} for ${event.entityType}:${event.entityId}`);

    const triggerHandler = WorkflowTriggers[event.type as keyof typeof WorkflowTriggers];

    if (!triggerHandler) {
      console.log(`⚠️  No trigger handler found for ${event.type}`);
      return;
    }

    const taskTemplates = await triggerHandler(event);

    if (!taskTemplates || taskTemplates.length === 0) {
      console.log(`ℹ️  No tasks generated for ${event.type}`);
      return;
    }

    // Create tasks
    for (const template of taskTemplates) {
      const dueDate = template.dueInDays
        ? new Date(Date.now() + template.dueInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const taskData = {
        title: template.title,
        description: template.description,
        priority: template.priority,
        assignedTo: template.assignedTo,
        dueDate,
        estimatedHours: template.estimatedHours,
        status: 'todo' as const,
        tenantId: event.tenantId,
        createdBy: event.userId,
        tags: template.tags || [],
        customFields: {
          triggeredBy: event.type,
          sourceEntity: event.entityType,
          sourceEntityId: event.entityId,
          automated: true,
        },
      };

      await db.insert(tasks).values(taskData);
      console.log(`✅ Created task: ${template.title}`);
    }

    console.log(`✨ Workflow completed: ${taskTemplates.length} tasks created`);
  } catch (error) {
    console.error('Error triggering workflow:', error);
    throw error;
  }
}

/**
 * Helper function to trigger workflow from other modules
 * Usage: import { triggerWorkflow } from './services/workflow-triggers';
 *
 * Example:
 * await triggerWorkflow({
 *   type: 'service_call.completed',
 *   entityId: serviceCall.id,
 *   entityType: 'service_call',
 *   tenantId: req.user.tenantId,
 *   userId: req.user.id,
 *   metadata: { equipmentId: serviceCall.equipmentId }
 * });
 */
