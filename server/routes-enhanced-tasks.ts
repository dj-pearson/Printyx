import type { Express } from 'express';
import { db, pool } from './db';
import { tasks, projects, taskComments, timeEntries } from '../shared/task-schema.js';
import { users } from '../shared/schema.js';
import { eq, and, desc, sql, isNull, or, inArray } from 'drizzle-orm';
import { isAuthenticated } from './replitAuth.js';
import { z } from 'zod';
import { createModuleLogger } from './lib/logger';
import { getUserId, getTenantId } from './utils/auth-helpers';
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
  app.get('/api/tasks/enhanced', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        log.info('Enhanced tasks: Missing tenantId for user:', req.user);
        return res.status(401).json({ message: 'Missing tenant context' });
      }

      const { projectId, assignedTo, status, priority } = req.query;

      let query = db
        .select({
          // Task fields
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          priority: tasks.priority,
          assignedTo: tasks.assignedTo,
          projectId: tasks.projectId,
          parentTaskId: tasks.parentTaskId,
          dueDate: tasks.dueDate,
          startDate: tasks.startDate,
          estimatedHours: tasks.estimatedHours,
          actualHours: tasks.actualHours,
          completionPercentage: tasks.completionPercentage,
          dependencies: tasks.dependencies,
          watchers: tasks.watchers,
          timeTracked: tasks.timeTracked,
          commentCount: tasks.commentCount,
          attachmentCount: tasks.attachmentCount,
          tags: tasks.tags,
          customFields: tasks.customFields,
          createdBy: tasks.createdBy,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          completedAt: tasks.completedAt,

          // Assignee details
          assignedToName: users.firstName,
          assignedToAvatar: users.profileImageUrl,

          // Project details
          projectName: projects.name,

          // Creator details
          createdByName: sql<string>`creator.firstName || ' ' || creator.lastName`,
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedTo, users.id))
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(sql`${users} as creator`, eq(tasks.createdBy, sql`creator.id`))
        .where(eq(tasks.tenantId, tenantId));

      // Apply filters
      if (projectId) {
        query = query.where(eq(tasks.projectId, projectId as string));
      }
      if (assignedTo) {
        query = query.where(eq(tasks.assignedTo, assignedTo as string));
      }
      if (status) {
        query = query.where(eq(tasks.status, status as any));
      }
      if (priority) {
        query = query.where(eq(tasks.priority, priority as any));
      }

      const allTasks = await query.orderBy(desc(tasks.updatedAt));

      // Build task hierarchy (parent tasks with their subtasks)
      const taskMap = new Map();
      const rootTasks: any[] = [];

      // First pass: create task map
      allTasks.forEach((task) => {
        taskMap.set(task.id, { ...task, subtasks: [] });
      });

      // Second pass: build hierarchy
      allTasks.forEach((task) => {
        if (task.parentTaskId) {
          const parent = taskMap.get(task.parentTaskId);
          if (parent) {
            parent.subtasks.push(taskMap.get(task.id));
          }
        } else {
          rootTasks.push(taskMap.get(task.id));
        }
      });

      res.json(rootTasks);
    } catch (error) {
      log.error('Error fetching enhanced tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get enhanced projects with workflow data
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
  app.post('/api/tasks/enhanced', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;

      const taskData = {
        ...req.body,
        tenantId,
        createdBy: userId,
        timeTracked: 0,
        commentCount: 0,
        attachmentCount: 0,
        dependencies: req.body.dependencies || [],
        watchers: req.body.watchers || [],
        tags: req.body.tags || [],
        customFields: req.body.customFields || {},
      };

      const [newTask] = await db.insert(tasks).values(taskData).returning();

      // If this is a subtask, update parent task
      if (taskData.parentTaskId) {
        await updateParentTaskProgress(taskData.parentTaskId);
      }

      res.status(201).json(newTask);
    } catch (error) {
      log.error('Error creating enhanced task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update task with enhanced functionality
  app.patch('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      // If marking as completed, set completedAt
      if (req.body.status === 'completed' && req.body.status !== undefined) {
        updateData.completedAt = new Date();
        updateData.completionPercentage = 100;
      }

      const [updatedTask] = await db
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
        .returning();

      if (!updatedTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Update parent task progress if this is a subtask
      if (updatedTask.parentTaskId) {
        await updateParentTaskProgress(updatedTask.parentTaskId);
      }

      res.json(updatedTask);
    } catch (error) {
      log.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Add comment to task
  app.post('/api/tasks/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;
      const userId = req.user?.claims?.sub;

      const [comment] = await db
        .insert(taskComments)
        .values({
          tenantId,
          taskId,
          userId,
          comment: req.body.comment,
        })
        .returning();

      // Update comment count
      await db
        .update(tasks)
        .set({
          commentCount: sql`${tasks.commentCount} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

      res.status(201).json(comment);
    } catch (error) {
      log.error('Error adding comment:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  });

  // Add time entry
  app.post('/api/tasks/:id/time', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;
      const userId = req.user?.claims?.sub;

      const [timeEntry] = await db
        .insert(timeEntries)
        .values({
          tenantId,
          taskId,
          userId,
          description: req.body.description,
          hours: req.body.minutes, // Store as minutes
          entryDate: new Date(req.body.date),
        })
        .returning();

      // Update time tracked
      await db
        .update(tasks)
        .set({
          timeTracked: sql`${tasks.timeTracked} + ${req.body.minutes}`,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

      res.status(201).json(timeEntry);
    } catch (error) {
      log.error('Error adding time entry:', error);
      res.status(500).json({ error: 'Failed to add time entry' });
    }
  });

  // Start timer on a task
  app.post('/api/tasks/:id/timer/start', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;
      const userId = getUserId(req);

      if (!tenantId || !userId) {
        return res.status(401).json({ message: 'Missing auth context' });
      }

      // Auto-stop any running timer for this user on this task
      const runningEntries = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.taskId, taskId),
            eq(timeEntries.userId, userId),
            eq(timeEntries.tenantId, tenantId),
            eq(timeEntries.isRunning, true),
          ),
        );

      for (const entry of runningEntries) {
        const elapsed = Math.round((Date.now() - new Date(entry.startedAt!).getTime()) / 60000);
        await db
          .update(timeEntries)
          .set({ isRunning: false, hours: Math.max(elapsed, 1) })
          .where(eq(timeEntries.id, entry.id));
        await db
          .update(tasks)
          .set({
            timeTracked: sql`${tasks.timeTracked} + ${Math.max(elapsed, 1)}`,
            updatedAt: new Date(),
          })
          .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
      }

      // Create a new running time entry
      const [newEntry] = await db
        .insert(timeEntries)
        .values({
          tenantId,
          taskId,
          userId,
          description: req.body.description || null,
          hours: 0,
          entryDate: new Date(),
          startedAt: new Date(),
          isRunning: true,
        })
        .returning();

      res.status(201).json(newEntry);
    } catch (error) {
      log.error('Error starting timer:', error);
      res.status(500).json({ error: 'Failed to start timer' });
    }
  });

  // Stop timer on a task
  app.post('/api/tasks/:id/timer/stop', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;
      const userId = getUserId(req);

      if (!tenantId || !userId) {
        return res.status(401).json({ message: 'Missing auth context' });
      }

      // Find the running entry
      const [runningEntry] = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.taskId, taskId),
            eq(timeEntries.userId, userId),
            eq(timeEntries.tenantId, tenantId),
            eq(timeEntries.isRunning, true),
          ),
        );

      if (!runningEntry) {
        return res.status(404).json({ error: 'No running timer found' });
      }

      // Calculate elapsed minutes
      const elapsedMinutes = Math.round(
        (Date.now() - new Date(runningEntry.startedAt!).getTime()) / 60000,
      );
      const finalMinutes = Math.max(elapsedMinutes, 1); // At least 1 minute

      // Update the entry
      const [stoppedEntry] = await db
        .update(timeEntries)
        .set({
          isRunning: false,
          hours: finalMinutes,
        })
        .where(eq(timeEntries.id, runningEntry.id))
        .returning();

      // Update task's total time tracked
      await db
        .update(tasks)
        .set({
          timeTracked: sql`${tasks.timeTracked} + ${finalMinutes}`,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

      res.json(stoppedEntry);
    } catch (error) {
      log.error('Error stopping timer:', error);
      res.status(500).json({ error: 'Failed to stop timer' });
    }
  });

  // List time entries for a task
  app.get('/api/tasks/:id/time-entries', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;

      if (!tenantId) {
        return res.status(401).json({ message: 'Missing tenant context' });
      }

      const entries = await db
        .select({
          id: timeEntries.id,
          taskId: timeEntries.taskId,
          userId: timeEntries.userId,
          description: timeEntries.description,
          hours: timeEntries.hours,
          entryDate: timeEntries.entryDate,
          startedAt: timeEntries.startedAt,
          isRunning: timeEntries.isRunning,
          createdAt: timeEntries.createdAt,
          userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        })
        .from(timeEntries)
        .leftJoin(users, eq(timeEntries.userId, users.id))
        .where(and(eq(timeEntries.taskId, taskId), eq(timeEntries.tenantId, tenantId)))
        .orderBy(desc(timeEntries.createdAt));

      res.json(entries);
    } catch (error) {
      log.error('Error fetching time entries:', error);
      res.status(500).json({ error: 'Failed to fetch time entries' });
    }
  });

  // Delete a time entry
  app.delete('/api/tasks/:id/time-entries/:entryId', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;
      const entryId = req.params.entryId;

      if (!tenantId) {
        return res.status(401).json({ message: 'Missing tenant context' });
      }

      // Get the entry to know how many minutes to subtract
      const [entry] = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.id, entryId),
            eq(timeEntries.taskId, taskId),
            eq(timeEntries.tenantId, tenantId),
          ),
        );

      if (!entry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }

      // Don't allow deleting a running timer - stop it first
      if (entry.isRunning) {
        return res.status(400).json({ error: 'Stop the timer before deleting' });
      }

      // Delete the entry
      await db.delete(timeEntries).where(eq(timeEntries.id, entryId));

      // Subtract from task's total time tracked
      if (entry.hours > 0) {
        await db
          .update(tasks)
          .set({
            timeTracked: sql`GREATEST(${tasks.timeTracked} - ${entry.hours}, 0)`,
            updatedAt: new Date(),
          })
          .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
      }

      res.json({ success: true });
    } catch (error) {
      log.error('Error deleting time entry:', error);
      res.status(500).json({ error: 'Failed to delete time entry' });
    }
  });

  // Bulk update tasks
  app.patch('/api/tasks/bulk', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { taskIds, updates } = req.body;

      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: 'Task IDs are required' });
      }

      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      const updatedTasks = await db
        .update(tasks)
        .set(updateData)
        .where(and(inArray(tasks.id, taskIds), eq(tasks.tenantId, tenantId)))
        .returning();

      res.json(updatedTasks);
    } catch (error) {
      log.error('Error bulk updating tasks:', error);
      res.status(500).json({ error: 'Failed to bulk update tasks' });
    }
  });

  // Delete task
  app.delete('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;

      // First, get the task to check if it has a parent
      const [task] = await db
        .select({ parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Delete all subtasks first
      await db
        .delete(tasks)
        .where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenantId, tenantId)));

      // Delete the task
      await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

      // Update parent task progress if this was a subtask
      if (task.parentTaskId) {
        await updateParentTaskProgress(task.parentTaskId);
      }

      res.json({ success: true });
    } catch (error) {
      log.error('Error deleting task:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });
}

// Helper function to update parent task progress
async function updateParentTaskProgress(parentTaskId: string) {
  try {
    const subtasks = await db
      .select({
        completionPercentage: tasks.completionPercentage,
        status: tasks.status,
      })
      .from(tasks)
      .where(eq(tasks.parentTaskId, parentTaskId));

    if (subtasks.length === 0) return;

    // Calculate average completion percentage
    const avgCompletion = Math.round(
      subtasks.reduce((sum, task) => sum + task.completionPercentage, 0) / subtasks.length,
    );

    // Determine status based on subtasks
    let status = 'todo';
    const completedCount = subtasks.filter((task) => task.status === 'completed').length;
    const inProgressCount = subtasks.filter((task) => task.status === 'in_progress').length;

    if (completedCount === subtasks.length) {
      status = 'completed';
    } else if (inProgressCount > 0 || completedCount > 0) {
      status = 'in_progress';
    }

    await db
      .update(tasks)
      .set({
        completionPercentage: avgCompletion,
        status: status as any,
        updatedAt: new Date(),
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
      })
      .where(eq(tasks.id, parentTaskId));
  } catch (error) {
    log.error('Error updating parent task progress:', error);
  }
}
