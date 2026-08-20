import type { Express } from 'express';
import { db, pool } from './db';
import { tasks, projects } from '../shared/task-schema.js';
import { users } from '../shared/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from './replitAuth.js';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-enhanced-tasks');

// Ensure task-related tables exist (handles schema drift for self-hosted Supabase)
async function ensureTaskTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id varchar NOT NULL,
        task_id varchar NOT NULL,
        user_id varchar NOT NULL,
        comment text NOT NULL,
        created_at timestamp DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS time_entries (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id varchar NOT NULL,
        task_id varchar NOT NULL,
        user_id varchar NOT NULL,
        description text,
        hours integer NOT NULL,
        entry_date timestamp NOT NULL,
        started_at timestamp,
        is_running boolean DEFAULT false,
        created_at timestamp DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS project_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id varchar NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        category varchar,
        task_template jsonb DEFAULT '[]',
        is_public boolean DEFAULT false,
        created_by varchar NOT NULL,
        created_at timestamp DEFAULT now()
      );
      -- Add columns that may be missing from existing time_entries table
      ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS started_at timestamp;
      ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_running boolean DEFAULT false;
    `);
    log.info('Task tables verified/created successfully');
  } catch (error) {
    log.error('Error ensuring task tables:', error);
  }
}

// Enhanced task routes for advanced task management functionality
export function registerEnhancedTaskRoutes(app: Express) {
  // Initialize tables on startup
  ensureTaskTables();
  // Get enhanced tasks with all related data
  // ── /api/tasks: RETIRED (PROD-008b) ───────────────────────────────────────
  //
  // Eleven handlers lived here: GET/POST /api/tasks/enhanced, PATCH and DELETE
  // /api/tasks/:id, POST /:id/comments, POST /:id/time, POST /:id/timer/start,
  // POST /:id/timer/stop, GET /:id/time-entries, DELETE
  // /:id/time-entries/:entryId and PATCH /api/tasks/bulk.
  //
  // /api/tasks is in crmProxies and registerEdgeFunctionProxy runs before this
  // file, so none of them ran in dev; production never reaches Express at all.
  // That mattered: TaskTimeTracker.tsx calls five of these paths and the tasks
  // edge function served only two, so the timer, the manual entry and the
  // delete were 404s on both hosts while these working copies sat unreachable.
  // The four missing endpoints are now in
  // supabase/functions/tasks/handlers/time-entries.ts.
  //
  // /api/projects/enhanced and /api/users/team below still run here -
  // /api/projects is not proxied. (/api/users IS, so /api/users/team is
  // shadowed too; it is in the check:shadowed-express baseline rather than
  // being retired blind, because no edge counterpart was checked for it.)

  app.get('/api/projects/enhanced', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;

      const projectsData = await db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          status: projects.status,
          projectManager: projects.projectManager,
          customerId: projects.customerId,
          startDate: projects.startDate,
          endDate: projects.endDate,
          estimatedBudget: projects.estimatedBudget,
          actualBudget: projects.actualBudget,
          completionPercentage: projects.completionPercentage,
          color: projects.color,
          template: projects.template,
          workflow: projects.workflow,
          tags: projects.tags,
          createdAt: projects.createdAt,

          // Manager details
          projectManagerName: sql<string>`pm.firstName || ' ' || pm.lastName`,

          // Task counts
          taskCount: sql<number>`COUNT(task_tasks.id)`,
          completedTaskCount: sql<number>`COUNT(CASE WHEN task_tasks.status = 'completed' THEN 1 END)`,
        })
        .from(projects)
        .leftJoin(sql`${users} as pm`, eq(projects.projectManager, sql`pm.id`))
        .leftJoin(sql`${tasks} as task_tasks`, eq(projects.id, sql`task_tasks.project_id`))
        .where(eq(projects.tenantId, tenantId))
        .groupBy(
          projects.id,
          projects.name,
          projects.description,
          projects.status,
          projects.projectManager,
          projects.customerId,
          projects.startDate,
          projects.endDate,
          projects.estimatedBudget,
          projects.actualBudget,
          projects.completionPercentage,
          projects.color,
          projects.template,
          projects.workflow,
          projects.tags,
          projects.createdAt,
          sql`pm.firstName`,
          sql`pm.lastName`,
        )
        .orderBy(desc(projects.updatedAt));

      res.json(projectsData);
    } catch (error) {
      log.error('Error fetching enhanced projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Get team members for task assignment
  app.get('/api/users/team', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;

      const teamMembers = await db
        .select({
          id: users.id,
          name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          email: users.email,
          avatar: users.profileImageUrl,
          role: users.role,
        })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
        .orderBy(users.firstName, users.lastName);

      res.json(teamMembers);
    } catch (error) {
      log.error('Error fetching team members:', error);
      res.status(500).json({ error: 'Failed to fetch team members' });
    }
  });

  // Create task with enhanced data
}

// updateParentTaskProgress lived here to roll a subtask's completion up to its
// parent. Its only callers were the PATCH/DELETE /api/tasks/:id handlers this
// story retired, so it is gone with them. If the tasks edge function ever needs
// that rollup, it is in git history at this path.
