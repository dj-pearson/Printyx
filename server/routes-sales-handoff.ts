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
  // WF-C-06: the /api/sales-handoffs, /api/handoff-task-templates and
  // /api/handoff-tasks handlers that used to live here are GONE, and the three
  // prefixes are proxied to their edge functions instead.
  //
  // They were correct - real tables, real columns - and had no caller anywhere,
  // while supabase/functions/sales-handoffs, which production actually reaches,
  // queried `sales_handoffs`: a relation named by no schema and no migration, so
  // every one of its endpoints was a 42P01. Two implementations of one feature,
  // one unreachable and one broken, and nothing in between. The edge functions
  // now serve the real tables and both hosts answer from them.
  //
  // CR-024's finding survives the move: its transaction made the checklist and
  // its tasks one atomic write. PostgREST cannot do that across two inserts, so
  // _shared/handoff-create.ts deletes the checklist when the task insert fails -
  // an empty handoff in operations' queue looks worked-through, because every
  // one of its zero tasks is done.
  //
  // /api/implementation-projects stays here: no edge function serves it.

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
