import type { Express } from "express";
import { db } from "./db.js";
import {
  tasks,
  projects,
  taskComments,
  timeEntries,
} from "../shared/task-schema.js";
import { users } from "../shared/schema.js";
import { eq, and, desc, sql, isNull, or, inArray } from "drizzle-orm";
import { isAuthenticated } from "./replitAuth.js";
import { z } from "zod";

// Enhanced task routes for advanced task management functionality
export function registerEnhancedTaskRoutes(app: Express) {
  // Get enhanced tasks with all related data
  app.get("/api/tasks/enhanced", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
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
          createdByName: sql<string>`creator.first_name || ' ' || creator.last_name`,
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedTo, users.id))
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(
          sql`${users} as creator`,
          eq(tasks.createdBy, sql`creator.id`)
        )
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
      console.error("Error fetching enhanced tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get enhanced projects with workflow data
  app.get("/api/projects/enhanced", isAuthenticated, async (req: any, res) => {
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
          projectManagerName: sql<string>`pm.first_name || ' ' || pm.last_name`,

          // Task counts
          taskCount: sql<number>`COUNT(task_tasks.id)`,
          completedTaskCount: sql<number>`COUNT(CASE WHEN task_tasks.status = 'completed' THEN 1 END)`,
        })
        .from(projects)
        .leftJoin(sql`${users} as pm`, eq(projects.projectManager, sql`pm.id`))
        .leftJoin(
          sql`${tasks} as task_tasks`,
          eq(projects.id, sql`task_tasks.project_id`)
        )
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
          sql`pm.first_name`,
          sql`pm.last_name`
        )
        .orderBy(desc(projects.updatedAt));

      res.json(projectsData);
    } catch (error) {
      console.error("Error fetching enhanced projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get team members for task assignment
  app.get("/api/users/team", isAuthenticated, async (req: any, res) => {
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
      console.error("Error fetching team members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Create task with enhanced data
  app.post("/api/tasks/enhanced", isAuthenticated, async (req: any, res) => {
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
      console.error("Error creating enhanced task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Update task with enhanced functionality
  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      // If marking as completed, set completedAt
      if (req.body.status === "completed" && req.body.status !== undefined) {
        updateData.completedAt = new Date();
        updateData.completionPercentage = 100;
      }

      const [updatedTask] = await db
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
        .returning();

      if (!updatedTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Update parent task progress if this is a subtask
      if (updatedTask.parentTaskId) {
        await updateParentTaskProgress(updatedTask.parentTaskId);
      }

      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Add comment to task
  app.post(
    "/api/tasks/:id/comments",
    isAuthenticated,
    async (req: any, res) => {
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
        console.error("Error adding comment:", error);
        res.status(500).json({ error: "Failed to add comment" });
      }
    }
  );

  // Add time entry
  app.post("/api/tasks/:id/time", isAuthenticated, async (req: any, res) => {
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
      console.error("Error adding time entry:", error);
      res.status(500).json({ error: "Failed to add time entry" });
    }
  });

  // Bulk update tasks
  app.patch("/api/tasks/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { taskIds, updates } = req.body;

      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: "Task IDs are required" });
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
      console.error("Error bulk updating tasks:", error);
      res.status(500).json({ error: "Failed to bulk update tasks" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;

      // First, get the task to check if it has a parent
      const [task] = await db
        .select({ parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Delete all subtasks first
      await db
        .delete(tasks)
        .where(
          and(eq(tasks.parentTaskId, taskId), eq(tasks.tenantId, tenantId))
        );

      // Delete the task
      await db
        .delete(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

      // Update parent task progress if this was a subtask
      if (task.parentTaskId) {
        await updateParentTaskProgress(task.parentTaskId);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
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
      subtasks.reduce((sum, task) => sum + task.completionPercentage, 0) /
        subtasks.length
    );

    // Determine status based on subtasks
    let status = "todo";
    const completedCount = subtasks.filter(
      (task) => task.status === "completed"
    ).length;
    const inProgressCount = subtasks.filter(
      (task) => task.status === "in_progress"
    ).length;

    if (completedCount === subtasks.length) {
      status = "completed";
    } else if (inProgressCount > 0 || completedCount > 0) {
      status = "in_progress";
    }

    await db
      .update(tasks)
      .set({
        completionPercentage: avgCompletion,
        status: status as any,
        updatedAt: new Date(),
        ...(status === "completed" ? { completedAt: new Date() } : {}),
      })
      .where(eq(tasks.id, parentTaskId));
  } catch (error) {
    console.error("Error updating parent task progress:", error);
  }
}
