import type { Express } from 'express';
import { storage } from './storage';
import { z } from 'zod';
import { insertTaskSchema, insertProjectSchema } from '@shared/schema';
// Auth helpers for Supabase JWT + session fallback
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-tasks');

// Task management routes using real database data
export function registerTaskRoutes(app: Express) {
  // Get tasks - filter by assigned user if requested
  app.get('/api/tasks', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const { assignedTo, my } = req.query;

      let userId: string | undefined;
      if (my === 'true') {
        userId = getUserId(req);
      } else if (assignedTo) {
        userId = assignedTo as string;
      }

      const tasks = await storage.getTasks(tenantId, userId);
      res.json(tasks);
    } catch (error) {
      log.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get task statistics
  app.get('/api/tasks/stats', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const { my } = req.query;

      let userId: string | undefined;
      if (my === 'true') {
        userId = getUserId(req);
      }

      const stats = await storage.getTaskStats(tenantId, userId);
      res.json(stats);
    } catch (error) {
      log.error('Error fetching task stats:', error);
      res.status(500).json({ error: 'Failed to fetch task statistics' });
    }
  });

  // Create new task
  app.post('/api/tasks', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);

      // Convert string dates to Date objects and clean up data
      const taskData = { ...req.body };
      if (taskData.dueDate && typeof taskData.dueDate === 'string') {
        taskData.dueDate = new Date(taskData.dueDate);
      }

      // Clean up invalid UUID fields
      if (taskData.customerId === 'none' || taskData.customerId === '') {
        taskData.customerId = null;
      }
      if (taskData.projectId === 'none' || taskData.projectId === '') {
        taskData.projectId = null;
      }
      if (taskData.assignedTo === 'none' || taskData.assignedTo === '') {
        taskData.assignedTo = null;
      }

      const validatedData = insertTaskSchema.parse({
        ...taskData,
        tenantId,
        createdBy: userId,
      });

      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      log.error('Error creating task:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid task data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update task (PUT method)
  app.put('/api/tasks/:id', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const taskId = req.params.id;

      const task = await storage.updateTask(taskId, req.body, tenantId);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      log.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Update task (PATCH method)
  app.patch('/api/tasks/:id', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const taskId = req.params.id;

      const task = await storage.updateTask(taskId, req.body, tenantId);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      log.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Get projects
  app.get('/api/projects', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const { assignedTo, my } = req.query;

      let userId: string | undefined;
      if (my === 'true') {
        userId = getUserId(req);
      } else if (assignedTo) {
        userId = assignedTo as string;
      }

      const projects = await storage.getProjects(tenantId, userId);
      res.json(projects);
    } catch (error) {
      log.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Create new project
  app.post('/api/projects', async (req: any, res) => {
    try {
      log.info('Creating project - request body:', req.body);
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      log.info('Creating project - tenant:', tenantId, 'user:', userId);

      // Convert string dates to Date objects and clean up data
      const projectData = { ...req.body };
      if (projectData.startDate && typeof projectData.startDate === 'string') {
        projectData.startDate = new Date(projectData.startDate);
      }
      if (projectData.endDate && typeof projectData.endDate === 'string') {
        projectData.endDate = new Date(projectData.endDate);
      }

      // Clean up invalid UUID fields
      if (projectData.customerId === 'none' || projectData.customerId === '') {
        projectData.customerId = null;
      }

      log.info('Creating project - processed data:', projectData);

      const validatedData = insertProjectSchema.parse({
        ...projectData,
        tenantId,
        createdBy: userId,
      });

      log.info('Creating project - validated data:', validatedData);

      const project = await storage.createProject(validatedData);
      log.info('Creating project - created:', project);
      res.status(201).json(project);
    } catch (error) {
      log.error('Error creating project:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid project data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create project' });
    }
  });
}
