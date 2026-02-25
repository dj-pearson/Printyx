/**
 * Project Template Routes
 * Part of Improvement #2 - Task Automation
 * Handles CRUD operations for project templates and template instantiation
 */

import type { Express } from 'express';
import { db } from './db';
import { projectTemplates, projects, tasks } from '../shared/task-schema.js';
import { eq, and } from 'drizzle-orm';
import { isAuthenticated } from './replitAuth.js';
import { z } from 'zod';
import { createModuleLogger } from './lib/logger';
import { getUserId, getTenantId } from './utils/auth-helpers';
const log = createModuleLogger('routes-templates');

export function registerTemplateRoutes(app: Express) {
  // Get all templates
  app.get('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;

      const templates = await db
        .select()
        .from(projectTemplates)
        .where(eq(projectTemplates.tenantId, tenantId))
        .orderBy(projectTemplates.createdAt);

      res.json(templates);
    } catch (error) {
      log.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Get single template
  app.get('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const templateId = req.params.id;

      const [template] = await db
        .select()
        .from(projectTemplates)
        .where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenantId, tenantId)));

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json(template);
    } catch (error) {
      log.error('Error fetching template:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  // Create template
  app.post('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub || req.user?.id;

      const templateData = {
        ...req.body,
        tenantId,
        createdBy: userId,
      };

      const [newTemplate] = await db.insert(projectTemplates).values(templateData).returning();

      res.status(201).json(newTemplate);
    } catch (error) {
      log.error('Error creating template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // Update template
  app.patch('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const templateId = req.params.id;

      const [updatedTemplate] = await db
        .update(projectTemplates)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenantId, tenantId)))
        .returning();

      if (!updatedTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json(updatedTemplate);
    } catch (error) {
      log.error('Error updating template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // Delete template
  app.delete('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const templateId = req.params.id;

      await db
        .delete(projectTemplates)
        .where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenantId, tenantId)));

      res.json({ success: true });
    } catch (error) {
      log.error('Error deleting template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // Instantiate template - create project from template
  app.post('/api/templates/:id/instantiate', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub || req.user?.id;
      const templateId = req.params.id;

      // Get template
      const [template] = await db
        .select()
        .from(projectTemplates)
        .where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenantId, tenantId)));

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Create project from template
      const projectData = {
        name: req.body.name || template.name,
        description: req.body.description || template.description,
        status: 'planning' as const,
        tenantId,
        createdBy: userId,
        template: templateId,
        projectManager: req.body.projectManager || userId,
        customerId: req.body.customerId,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };

      const [newProject] = await db.insert(projects).values(projectData).returning();

      // Create tasks from template
      if (template.taskTemplate && Array.isArray(template.taskTemplate)) {
        const taskPromises = template.taskTemplate.map((taskTemplate: any, index: number) => {
          const taskData = {
            title: taskTemplate.title,
            description: taskTemplate.description,
            priority: taskTemplate.priority,
            estimatedHours: taskTemplate.estimatedHours,
            projectId: newProject.id,
            tenantId,
            createdBy: userId,
            status: 'todo' as const,
            // If dependencies are specified, we'll need to resolve them after all tasks are created
            dependencies: taskTemplate.dependencies || [],
          };

          return db.insert(tasks).values(taskData).returning();
        });

        await Promise.all(taskPromises);
      }

      res.status(201).json({
        project: newProject,
        message: 'Project created from template successfully',
      });
    } catch (error) {
      log.error('Error instantiating template:', error);
      res.status(500).json({ error: 'Failed to create project from template' });
    }
  });

  // Create template from existing project
  app.post('/api/projects/:id/create-template', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub || req.user?.id;
      const projectId = req.params.id;

      // Get project
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get project tasks
      const projectTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.tenantId, tenantId)));

      // Build task template
      const taskTemplate = projectTasks.map((task) => ({
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimatedHours: task.estimatedHours,
        dependencies: task.dependencies || [],
      }));

      // Create template
      const templateData = {
        name: req.body.name || `${project.name} Template`,
        description: req.body.description || `Template created from ${project.name}`,
        category: req.body.category || 'custom',
        taskTemplate,
        isPublic: false,
        tenantId,
        createdBy: userId,
      };

      const [newTemplate] = await db.insert(projectTemplates).values(templateData).returning();

      res.status(201).json(newTemplate);
    } catch (error) {
      log.error('Error creating template from project:', error);
      res.status(500).json({ error: 'Failed to create template from project' });
    }
  });
}
