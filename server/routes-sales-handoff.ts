import type { Express } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-sales-handoff');

import {
  salesHandoffChecklists,
  handoffTaskTemplates,
  handoffTasks,
  implementationProjects,
  type InsertSalesHandoffChecklist,
  type InsertHandoffTaskTemplate,
  type InsertHandoffTask,
  type InsertImplementationProject,
} from '@shared/schema';
import { eq, and, desc, asc, sql, or } from 'drizzle-orm';

export function registerSalesHandoffRoutes(app: Express) {
  // ==================== Sales Handoff Checklists ====================

  // Get all handoffs for tenant
  app.get('/api/sales-handoffs', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const { status, salesRepId, csmId } = req.query;

      let conditions = [eq(salesHandoffChecklists.tenantId, tenantId)];

      if (status) {
        conditions.push(eq(salesHandoffChecklists.status, status as string));
      }
      if (salesRepId) {
        conditions.push(eq(salesHandoffChecklists.salesRepId, salesRepId as string));
      }
      if (csmId) {
        conditions.push(eq(salesHandoffChecklists.csmId, csmId as string));
      }

      const handoffs = await db.query.salesHandoffChecklists.findMany({
        where: and(...conditions),
        orderBy: [desc(salesHandoffChecklists.initiatedAt)],
      });

      res.json(handoffs);
    } catch (error) {
      log.error('Error fetching handoffs:', error);
      res.status(500).json({ error: 'Failed to fetch handoffs' });
    }
  });

  // Get single handoff
  app.get('/api/sales-handoffs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const handoff = await db.query.salesHandoffChecklists.findFirst({
        where: and(
          eq(salesHandoffChecklists.id, id),
          eq(salesHandoffChecklists.tenantId, tenantId),
        ),
      });

      if (!handoff) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      // Get associated tasks
      const tasks = await db.query.handoffTasks.findMany({
        where: eq(handoffTasks.handoffId, id),
        orderBy: [asc(handoffTasks.dueDate)],
      });

      res.json({ ...handoff, tasks });
    } catch (error) {
      log.error('Error fetching handoff:', error);
      res.status(500).json({ error: 'Failed to fetch handoff' });
    }
  });

  // Create handoff checklist
  app.post('/api/sales-handoffs', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const handoffData: InsertSalesHandoffChecklist = {
        ...req.body,
        tenantId,
      };

      const [newHandoff] = await db.insert(salesHandoffChecklists).values(handoffData).returning();

      // Create tasks from template if specified
      if (req.body.templateId) {
        const template = await db.query.handoffTaskTemplates.findFirst({
          where: eq(handoffTaskTemplates.id, req.body.templateId),
        });

        if (template && template.tasks) {
          const tasksToCreate = (template.tasks as any[]).map((task) => ({
            tenantId,
            handoffId: newHandoff.id,
            taskName: task.taskName,
            description: task.description,
            category: task.category,
            assignedToRole: task.assignToRole,
            isRequired: task.isRequired,
            isBlocking: task.isRequired,
            dueDate: new Date(Date.now() + task.dueInDays * 24 * 60 * 60 * 1000),
          }));

          await db.insert(handoffTasks).values(tasksToCreate);
        }
      }

      res.status(201).json(newHandoff);
    } catch (error) {
      log.error('Error creating handoff:', error);
      res.status(500).json({ error: 'Failed to create handoff' });
    }
  });

  // Update handoff
  app.put('/api/sales-handoffs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      // Calculate completion percentage if not provided
      if (!req.body.completionPercentage && req.body.status !== 'completed') {
        const tasks = await db.query.handoffTasks.findMany({
          where: eq(handoffTasks.handoffId, id),
        });

        const completedTasks = tasks.filter((t) => t.status === 'completed').length;
        req.body.completionPercentage =
          tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
      }

      const [updated] = await db
        .update(salesHandoffChecklists)
        .set({ ...req.body, updatedAt: new Date() })
        .where(
          and(eq(salesHandoffChecklists.id, id), eq(salesHandoffChecklists.tenantId, tenantId)),
        )
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      res.json(updated);
    } catch (error) {
      log.error('Error updating handoff:', error);
      res.status(500).json({ error: 'Failed to update handoff' });
    }
  });

  // Complete handoff
  app.post('/api/sales-handoffs/:id/complete', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      // Check if all required tasks are completed
      const tasks = await db.query.handoffTasks.findMany({
        where: and(eq(handoffTasks.handoffId, id), eq(handoffTasks.tenantId, tenantId)),
      });

      const incompleteRequiredTasks = tasks.filter(
        (t) => t.isRequired && t.status !== 'completed' && t.status !== 'skipped',
      );

      if (incompleteRequiredTasks.length > 0) {
        return res.status(400).json({
          error: 'Cannot complete handoff with incomplete required tasks',
          incompleteTasks: incompleteRequiredTasks.map((t) => t.taskName),
        });
      }

      const [updated] = await db
        .update(salesHandoffChecklists)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completionPercentage: 100,
          readyForImplementation: true,
          updatedAt: new Date(),
        })
        .where(
          and(eq(salesHandoffChecklists.id, id), eq(salesHandoffChecklists.tenantId, tenantId)),
        )
        .returning();

      res.json(updated);
    } catch (error) {
      log.error('Error completing handoff:', error);
      res.status(500).json({ error: 'Failed to complete handoff' });
    }
  });

  // ==================== Handoff Task Templates ====================

  // Get task templates
  app.get('/api/handoff-task-templates', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const { handoffType } = req.query;

      let conditions = [eq(handoffTaskTemplates.tenantId, tenantId)];

      if (handoffType) {
        conditions.push(eq(handoffTaskTemplates.handoffType, handoffType as string));
      }

      const templates = await db.query.handoffTaskTemplates.findMany({
        where: and(...conditions),
        orderBy: [desc(handoffTaskTemplates.isDefault), asc(handoffTaskTemplates.templateName)],
      });

      res.json(templates);
    } catch (error) {
      log.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Create task template
  app.post('/api/handoff-task-templates', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const templateData: InsertHandoffTaskTemplate = {
        ...req.body,
        tenantId,
      };

      const [newTemplate] = await db.insert(handoffTaskTemplates).values(templateData).returning();

      res.status(201).json(newTemplate);
    } catch (error) {
      log.error('Error creating template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // Update task template
  app.put('/api/handoff-task-templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [updated] = await db
        .update(handoffTaskTemplates)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(handoffTaskTemplates.id, id), eq(handoffTaskTemplates.tenantId, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json(updated);
    } catch (error) {
      log.error('Error updating template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // ==================== Handoff Tasks ====================

  // Get tasks for handoff
  app.get('/api/handoff-tasks', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { handoffId, assignedTo, status, category } = req.query;

      let conditions = [eq(handoffTasks.tenantId, tenantId)];

      if (handoffId) {
        conditions.push(eq(handoffTasks.handoffId, handoffId as string));
      }
      if (assignedTo) {
        conditions.push(eq(handoffTasks.assignedTo, assignedTo as string));
      }
      if (status) {
        conditions.push(eq(handoffTasks.status, status as string));
      }
      if (category) {
        conditions.push(eq(handoffTasks.category, category as string));
      }

      const tasks = await db.query.handoffTasks.findMany({
        where: and(...conditions),
        orderBy: [asc(handoffTasks.dueDate)],
      });

      res.json(tasks);
    } catch (error) {
      log.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Create handoff task
  app.post('/api/handoff-tasks', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const taskData: InsertHandoffTask = {
        ...req.body,
        tenantId,
      };

      const [newTask] = await db.insert(handoffTasks).values(taskData).returning();

      res.status(201).json(newTask);
    } catch (error) {
      log.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update handoff task
  app.put('/api/handoff-tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [updated] = await db
        .update(handoffTasks)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(handoffTasks.id, id), eq(handoffTasks.tenantId, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Update handoff completion percentage
      if (updated.handoffId) {
        const allTasks = await db.query.handoffTasks.findMany({
          where: eq(handoffTasks.handoffId, updated.handoffId),
        });

        const completedTasks = allTasks.filter((t) => t.status === 'completed').length;
        const completionPercentage = Math.round((completedTasks / allTasks.length) * 100);

        await db
          .update(salesHandoffChecklists)
          .set({
            completionPercentage,
            updatedAt: new Date(),
          })
          .where(eq(salesHandoffChecklists.id, updated.handoffId));
      }

      res.json(updated);
    } catch (error) {
      log.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Complete handoff task
  app.post('/api/handoff-tasks/:id/complete', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const { completedBy, completionNotes } = req.body;

      const [updated] = await db
        .update(handoffTasks)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completedBy,
          completionNotes,
          updatedAt: new Date(),
        })
        .where(and(eq(handoffTasks.id, id), eq(handoffTasks.tenantId, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Update handoff completion percentage
      if (updated.handoffId) {
        const allTasks = await db.query.handoffTasks.findMany({
          where: eq(handoffTasks.handoffId, updated.handoffId),
        });

        const completedTasks = allTasks.filter((t) => t.status === 'completed').length;
        const completionPercentage = Math.round((completedTasks / allTasks.length) * 100);

        await db
          .update(salesHandoffChecklists)
          .set({
            completionPercentage,
            updatedAt: new Date(),
          })
          .where(eq(salesHandoffChecklists.id, updated.handoffId));
      }

      res.json(updated);
    } catch (error) {
      log.error('Error completing task:', error);
      res.status(500).json({ error: 'Failed to complete task' });
    }
  });

  // ==================== Implementation Projects ====================

  // Get implementation projects
  app.get('/api/implementation-projects', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const { status, customerId, projectManagerId } = req.query;

      let conditions = [eq(implementationProjects.tenantId, tenantId)];

      if (status) {
        conditions.push(eq(implementationProjects.status, status as string));
      }
      if (customerId) {
        conditions.push(eq(implementationProjects.customerId, customerId as string));
      }
      if (projectManagerId) {
        conditions.push(eq(implementationProjects.projectManagerId, projectManagerId as string));
      }

      const projects = await db.query.implementationProjects.findMany({
        where: and(...conditions),
        orderBy: [desc(implementationProjects.plannedStartDate)],
      });

      res.json(projects);
    } catch (error) {
      log.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Get single project
  app.get('/api/implementation-projects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const project = await db.query.implementationProjects.findFirst({
        where: and(
          eq(implementationProjects.id, id),
          eq(implementationProjects.tenantId, tenantId),
        ),
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      log.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  // Create implementation project
  app.post('/api/implementation-projects', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const projectData: InsertImplementationProject = {
        ...req.body,
        tenantId,
      };

      const [newProject] = await db.insert(implementationProjects).values(projectData).returning();

      res.status(201).json(newProject);
    } catch (error) {
      log.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  // Update implementation project
  app.put('/api/implementation-projects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [updated] = await db
        .update(implementationProjects)
        .set({ ...req.body, updatedAt: new Date() })
        .where(
          and(eq(implementationProjects.id, id), eq(implementationProjects.tenantId, tenantId)),
        )
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(updated);
    } catch (error) {
      log.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  // Update project milestone
  app.post(
    '/api/implementation-projects/:id/milestones/:milestoneIndex/complete',
    async (req, res) => {
      try {
        const { id, milestoneIndex } = req.params;
        const tenantId = req.headers['x-tenant-id'] as string;

        const project = await db.query.implementationProjects.findFirst({
          where: and(
            eq(implementationProjects.id, id),
            eq(implementationProjects.tenantId, tenantId),
          ),
        });

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        const milestones = (project.milestones as any[]) || [];
        const index = parseInt(milestoneIndex);

        if (index >= 0 && index < milestones.length) {
          milestones[index].status = 'completed';
          milestones[index].completedDate = new Date().toISOString();

          // Calculate completion percentage
          const completedMilestones = milestones.filter((m) => m.status === 'completed').length;
          const completionPercentage = Math.round((completedMilestones / milestones.length) * 100);

          const [updated] = await db
            .update(implementationProjects)
            .set({
              milestones,
              completionPercentage,
              updatedAt: new Date(),
            })
            .where(eq(implementationProjects.id, id))
            .returning();

          res.json(updated);
        } else {
          res.status(400).json({ error: 'Invalid milestone index' });
        }
      } catch (error) {
        log.error('Error completing milestone:', error);
        res.status(500).json({ error: 'Failed to complete milestone' });
      }
    },
  );
}
