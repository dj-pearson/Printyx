import type { Express } from 'express';
import { storage } from './storage';
import { z } from 'zod';
import { insertProjectSchema } from '@shared/schema';
// Auth helpers for Supabase JWT + session fallback
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-tasks');

// Task management routes using real database data
export function registerTaskRoutes(app: Express) {
  // ── /api/tasks: RETIRED (PROD-008b) ───────────────────────────────────────
  //
  // GET /api/tasks, GET /api/tasks/stats, POST /api/tasks and PUT
  // /api/tasks/:id used to live here. /api/tasks is in crmProxies, and
  // registerEdgeFunctionProxy runs before this file, so none of them ran in
  // dev; production never reaches Express at all. The tasks edge function owns
  // the surface.
  //
  // /api/projects below is NOT proxied and still runs here.

  // Get projects
  app.get('/api/projects', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });
      const { assignedTo, my } = req.query;

      let userId: string | undefined;
      if (my === 'true') {
        userId = getUserId(req);
      } else if (assignedTo) {
        userId = assignedTo as string;
      }

      const projects = await storage.getProjects(tenantId);
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
      if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });
      const userId = getUserId(req);
      log.info('Creating project', { tenantId, userId });

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
