import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import {
  insertWorkflowSchema,
  insertWorkflowVersionSchema,
  insertWorkflowTriggerSchema,
  insertTriggerScheduleSchema,
  insertWorkflowStepAutomationSchema,
  insertWorkflowConditionSchema,
  insertWorkflowExecutionSchema,
  insertWorkflowTemplateSchema,
  insertTemplateVariableSchema,
  insertWorkflowEventRegistrySchema,
} from '@shared/schema';

const router = express.Router();

// ==================== Workflow CRUD Operations ====================

// POST /api/workflows - Create a new workflow
router.post('/workflows', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertWorkflowSchema.parse(req.body);
    const workflow = await storage.createWorkflow({
      ...data,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    res.json(workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Create workflow error:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// GET /api/workflows - Get all workflows for tenant
router.get('/workflows', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { status } = req.query;
    const workflows = await storage.getWorkflows(user.tenantId, status as string);
    res.json(workflows);
  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// GET /api/workflows/:id - Get a specific workflow
router.get('/workflows/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.id);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Fetch additional details
    const [triggers, steps, versions] = await Promise.all([
      storage.getWorkflowTriggers(workflow.id),
      storage.getWorkflowSteps(workflow.id),
      storage.getWorkflowVersions(workflow.id),
    ]);

    res.json({
      ...workflow,
      triggers,
      steps,
      versions,
    });
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// PUT /api/workflows/:id - Update a workflow
router.put('/workflows/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getWorkflow(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const data = insertWorkflowSchema.partial().parse(req.body);
    const workflow = await storage.updateWorkflow(req.params.id, {
      ...data,
      lastModifiedBy: user.id,
    });

    res.json(workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Update workflow error:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// DELETE /api/workflows/:id - Delete a workflow
router.delete('/workflows/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.id);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await storage.deleteWorkflow(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// ==================== Workflow Trigger Management ====================

// POST /api/workflows/:workflowId/triggers - Create a trigger
router.post('/workflows/:workflowId/triggers', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.workflowId);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const data = insertWorkflowTriggerSchema.parse(req.body);
    const trigger = await storage.createWorkflowTrigger({
      ...data,
      workflowId: req.params.workflowId,
    });

    // Create schedule if type is 'schedule'
    if (trigger.type === 'schedule' && req.body.cronExpression) {
      await storage.createTriggerSchedule({
        triggerId: trigger.id,
        cronExpression: req.body.cronExpression,
        timezone: req.body.timezone || 'UTC',
        nextRunAt: null,
        lastRunAt: null,
      });
    }

    res.json(trigger);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Create trigger error:', error);
    res.status(500).json({ error: 'Failed to create trigger' });
  }
});

// GET /api/workflows/:workflowId/triggers - Get triggers for a workflow
router.get('/workflows/:workflowId/triggers', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.workflowId);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const triggers = await storage.getWorkflowTriggers(req.params.workflowId);
    
    // Fetch schedules for schedule-type triggers
    const triggersWithSchedules = await Promise.all(
      triggers.map(async (trigger) => {
        if (trigger.type === 'schedule') {
          const schedule = await storage.getTriggerSchedule(trigger.id);
          return { ...trigger, schedule };
        }
        return trigger;
      })
    );

    res.json(triggersWithSchedules);
  } catch (error) {
    console.error('Get triggers error:', error);
    res.status(500).json({ error: 'Failed to fetch triggers' });
  }
});

// PUT /api/triggers/:id - Update a trigger
router.put('/triggers/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const trigger = await storage.getWorkflowTrigger(req.params.id);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    const workflow = await storage.getWorkflow(trigger.workflowId);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const data = insertWorkflowTriggerSchema.partial().parse(req.body);
    const updated = await storage.updateWorkflowTrigger(req.params.id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Update trigger error:', error);
    res.status(500).json({ error: 'Failed to update trigger' });
  }
});

// DELETE /api/triggers/:id - Delete a trigger
router.delete('/triggers/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const trigger = await storage.getWorkflowTrigger(req.params.id);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    const workflow = await storage.getWorkflow(trigger.workflowId);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await storage.deleteWorkflowTrigger(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete trigger error:', error);
    res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

// ==================== Workflow Steps Management ====================

// POST /api/workflows/:workflowId/steps - Create a step
router.post('/workflows/:workflowId/steps', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.workflowId);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const data = insertWorkflowStepAutomationSchema.parse(req.body);
    const step = await storage.createWorkflowStep({
      ...data,
      workflowId: req.params.workflowId,
    });

    res.json(step);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Create step error:', error);
    res.status(500).json({ error: 'Failed to create step' });
  }
});

// GET /api/workflows/:workflowId/steps - Get steps for a workflow
router.get('/workflows/:workflowId/steps', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.workflowId);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const steps = await storage.getWorkflowSteps(req.params.workflowId);
    res.json(steps);
  } catch (error) {
    console.error('Get steps error:', error);
    res.status(500).json({ error: 'Failed to fetch steps' });
  }
});

// PUT /api/steps/:id - Update a step
router.put('/steps/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertWorkflowStepAutomationSchema.partial().parse(req.body);
    const step = await storage.updateWorkflowStep(req.params.id, data);
    res.json(step);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Update step error:', error);
    res.status(500).json({ error: 'Failed to update step' });
  }
});

// DELETE /api/steps/:id - Delete a step
router.delete('/steps/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    await storage.deleteWorkflowStep(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete step error:', error);
    res.status(500).json({ error: 'Failed to delete step' });
  }
});

// ==================== Workflow Execution ====================

// POST /api/workflows/:id/execute - Manually trigger workflow execution
router.post('/workflows/:id/execute', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.id);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.status !== 'active') {
      return res.status(400).json({ error: 'Workflow is not active' });
    }

    // Get latest version
    const version = await storage.getLatestWorkflowVersion(workflow.id);
    if (!version) {
      return res.status(400).json({ error: 'No workflow version available' });
    }

    // Create execution
    const execution = await storage.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
      tenantId: user.tenantId,
      initiatedBy: user.id,
      context: req.body.context || {},
      status: 'queued',
      triggerId: null,
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
    });

    // Log execution start event
    await storage.createExecutionEvent({
      executionId: execution.id,
      stepExecutionId: null,
      eventType: 'execution_queued',
      message: `Workflow execution queued by user ${user.email}`,
      eventData: { userId: user.id, userEmail: user.email },
    });

    res.json(execution);
  } catch (error) {
    console.error('Execute workflow error:', error);
    res.status(500).json({ error: 'Failed to execute workflow' });
  }
});

// GET /api/workflows/:id/executions - Get executions for a workflow
router.get('/workflows/:id/executions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.id);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const executions = await storage.getWorkflowExecutions(req.params.id, limit);
    res.json(executions);
  } catch (error) {
    console.error('Get executions error:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// GET /api/executions/:id - Get execution details
router.get('/executions/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const execution = await storage.getWorkflowExecution(req.params.id);
    if (!execution || execution.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const [steps, events] = await Promise.all([
      storage.getExecutionSteps(execution.id),
      storage.getExecutionEvents(execution.id),
    ]);

    res.json({
      ...execution,
      steps,
      events,
    });
  } catch (error) {
    console.error('Get execution error:', error);
    res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

// GET /api/executions - Get recent executions for tenant
router.get('/executions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const executions = await storage.getWorkflowExecutionsByTenant(user.tenantId, limit);
    res.json(executions);
  } catch (error) {
    console.error('Get tenant executions error:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// ==================== Workflow Templates ====================

// GET /api/workflow-templates - Get all templates
router.get('/workflow-templates', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { category } = req.query;
    const templates = await storage.getWorkflowTemplates(category as string);
    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/workflow-templates/:id - Get a specific template
router.get('/workflow-templates/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const template = await storage.getWorkflowTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const variables = await storage.getTemplateVariables(template.id);

    res.json({
      ...template,
      variables,
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/workflow-templates/:id/clone - Clone a template as a new workflow
router.post('/workflow-templates/:id/clone', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const template = await storage.getWorkflowTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { name, variableValues } = req.body;

    // Create workflow from template
    const workflow = await storage.createWorkflow({
      tenantId: user.tenantId,
      name: name || template.name,
      description: template.description || null,
      category: template.category,
      status: 'draft',
      currentVersionId: null,
      isTemplate: false,
      createdBy: user.id,
      lastModifiedBy: null,
    });

    // Create initial version with template definition
    const version = await storage.createWorkflowVersion({
      workflowId: workflow.id,
      version: 1,
      schemaHash: null,
      definition: template.definition,
      changelog: `Cloned from template: ${template.name}`,
      createdBy: user.id,
    });

    // Update workflow with current version
    await storage.updateWorkflow(workflow.id, {
      currentVersionId: version.id,
    });

    // Increment template usage count
    await storage.incrementTemplateUsage(template.id);

    res.json({
      ...workflow,
      version,
    });
  } catch (error) {
    console.error('Clone template error:', error);
    res.status(500).json({ error: 'Failed to clone template' });
  }
});

// ==================== Event Registry ====================

// GET /api/workflow-events - Get all available workflow events
router.get('/workflow-events', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { category } = req.query;
    const events = await storage.getEventRegistryEntries(category as string);
    res.json(events);
  } catch (error) {
    console.error('Get workflow events error:', error);
    res.status(500).json({ error: 'Failed to fetch workflow events' });
  }
});

// ==================== Analytics & Monitoring ====================

// GET /api/workflows/:id/stats - Get workflow execution statistics
router.get('/workflows/:id/stats', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workflow = await storage.getWorkflow(req.params.id);
    if (!workflow || workflow.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const stats = await storage.getWorkflowExecutionStats(req.params.id);
    res.json(stats);
  } catch (error) {
    console.error('Get workflow stats error:', error);
    res.status(500).json({ error: 'Failed to fetch workflow statistics' });
  }
});

// GET /api/workflows/dashboard - Get dashboard overview
router.get('/dashboard', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [workflows, executions] = await Promise.all([
      storage.getWorkflows(user.tenantId),
      storage.getWorkflowExecutionsByTenant(user.tenantId, 100),
    ]);

    const activeWorkflows = workflows.filter(w => w.status === 'active').length;
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    const runningExecutions = executions.filter(e => e.status === 'running').length;

    res.json({
      totalWorkflows: workflows.length,
      activeWorkflows,
      pausedWorkflows: workflows.filter(w => w.status === 'paused').length,
      draftWorkflows: workflows.filter(w => w.status === 'draft').length,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      runningExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      recentExecutions: executions.slice(0, 10),
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ==================== Assignment Groups ====================

// GET /api/assignment-groups - Get all assignment groups for tenant
router.get('/assignment-groups', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const groups = await storage.getAssignmentGroups(user.tenantId);
    res.json(groups);
  } catch (error) {
    console.error('Get assignment groups error:', error);
    res.status(500).json({ error: 'Failed to fetch assignment groups' });
  }
});

// GET /api/assignment-groups/:id - Get a specific assignment group
router.get('/assignment-groups/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const group = await storage.getAssignmentGroup(req.params.id);
    if (!group || group.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Assignment group not found' });
    }

    res.json(group);
  } catch (error) {
    console.error('Get assignment group error:', error);
    res.status(500).json({ error: 'Failed to fetch assignment group' });
  }
});

// POST /api/assignment-groups - Create an assignment group
router.post('/assignment-groups', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { name, description, type, members } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const group = await storage.createAssignmentGroup({
      tenantId: user.tenantId,
      name,
      description: description || null,
      type,
      members: members || [],
      isActive: true,
      createdBy: user.id,
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Create assignment group error:', error);
    res.status(500).json({ error: 'Failed to create assignment group' });
  }
});

// PUT /api/assignment-groups/:id - Update an assignment group
router.put('/assignment-groups/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getAssignmentGroup(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Assignment group not found' });
    }

    const { name, description, type, members, isActive } = req.body;

    const updated = await storage.updateAssignmentGroup(req.params.id, {
      name,
      description,
      type,
      members,
      isActive,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update assignment group error:', error);
    res.status(500).json({ error: 'Failed to update assignment group' });
  }
});

// DELETE /api/assignment-groups/:id - Delete an assignment group
router.delete('/assignment-groups/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const group = await storage.getAssignmentGroup(req.params.id);
    if (!group || group.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Assignment group not found' });
    }

    await storage.deleteAssignmentGroup(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete assignment group error:', error);
    res.status(500).json({ error: 'Failed to delete assignment group' });
  }
});

// ==================== Workflow Approvals ====================

// GET /api/approvals - Get approvals for current user
router.get('/approvals', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { status } = req.query;
    const approvals = await storage.getUserApprovals(user.id, user.tenantId, status as string);
    res.json(approvals);
  } catch (error) {
    console.error('Get approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

// GET /api/approvals/:id - Get a specific approval
router.get('/approvals/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const approval = await storage.getWorkflowApproval(req.params.id);
    if (!approval || approval.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(approval);
  } catch (error) {
    console.error('Get approval error:', error);
    res.status(500).json({ error: 'Failed to fetch approval' });
  }
});

// POST /api/approvals/:id/respond - Approve or reject an approval request
router.post('/approvals/:id/respond', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { approved, comment } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Approved field is required and must be boolean' });
    }

    const approval = await storage.getWorkflowApproval(req.params.id);
    if (!approval || approval.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // Check if user is authorized to approve
    const canApprove =
      approval.assignedToUserId === user.id ||
      await storage.isUserInGroup(user.id, approval.assignedToGroupId);

    if (!canApprove) {
      return res.status(403).json({ error: 'You are not authorized to respond to this approval' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval has already been responded to' });
    }

    // Process the approval response
    const { processApprovalResponse } = await import('../services/workflow-execution-service');
    await processApprovalResponse(req.params.id, user.id, approved, comment);

    const updated = await storage.getWorkflowApproval(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Respond to approval error:', error);
    res.status(500).json({ error: 'Failed to respond to approval' });
  }
});

// GET /api/approvals/execution/:executionId - Get approvals for a workflow execution
router.get('/approvals/execution/:executionId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const approvals = await storage.getExecutionApprovals(req.params.executionId, user.tenantId);
    res.json(approvals);
  } catch (error) {
    console.error('Get execution approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch execution approvals' });
  }
});

export default router;
