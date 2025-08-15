import type { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { insertTaskSchema, insertProjectSchema } from "@shared/schema";

// Task management routes using real database data
export function registerTaskRoutes(app: Express) {
  // Use the same authentication pattern as other working routes in main routes.ts
  const requireAuth = async (req: any, res: any, next: any) => {
    // Check for session-based auth (legacy) or user object (current)
    const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;

    if (!isAuthenticated) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Get user ID from various sources
    const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;

    if (userId && (!req.user || !req.user.tenantId)) {
      // Fetch full user details from database if missing
      try {
        const fullUser = await storage.getUser(userId);
        if (fullUser) {
          req.user = {
            ...req.user,
            id: fullUser.id,
            tenantId: fullUser.tenantId,
            isPlatformUser: fullUser.isPlatformUser,
            is_platform_user: fullUser.isPlatformUser,
            email: fullUser.email,
            firstName: fullUser.firstName,
            lastName: fullUser.lastName,
          };
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      }
    }

    // Add user context for backwards compatibility
    if (!req.user) {
      req.user = {
        id: req.session.userId,
        tenantId: req.session.tenantId || req.user?.tenantId,
      };
    } else if (!req.user.tenantId && !req.user.id) {
      // If we have user claims but no structured user object, build it
      req.user = {
        id: req.user.claims?.sub || req.user.id,
        tenantId: req.user.tenantId || req.session?.tenantId,
      };
    }

    next();
  };
  // Get tasks - filter by assigned user if requested
  app.get("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { assignedTo, my } = req.query;
      
      let userId: string | undefined;
      if (my === 'true') {
        userId = req.user?.id || req.user?.claims?.sub;
      } else if (assignedTo) {
        userId = assignedTo as string;
      }
      
      const tasks = await storage.getTasks(tenantId, userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get task statistics
  app.get("/api/tasks/stats", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { my } = req.query;
      
      let userId: string | undefined;
      if (my === 'true') {
        userId = req.user?.claims?.sub;
      }
      
      const stats = await storage.getTaskStats(tenantId, userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching task stats:", error);
      res.status(500).json({ error: "Failed to fetch task statistics" });
    }
  });

  // Create new task
  app.post("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;
      
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
        createdBy: userId
      });
      
      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Update task (PUT method)
  app.put("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;
      
      const task = await storage.updateTask(taskId, req.body, tenantId);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Update task (PATCH method)
  app.patch("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const taskId = req.params.id;
      
      const task = await storage.updateTask(taskId, req.body, tenantId);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Get projects
  app.get("/api/projects", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { assignedTo, my } = req.query;
      
      let userId: string | undefined;
      if (my === 'true') {
        userId = req.user?.id || req.user?.claims?.sub;
      } else if (assignedTo) {
        userId = assignedTo as string;
      }
      
      const projects = await storage.getProjects(tenantId, userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Create new project
  app.post("/api/projects", requireAuth, async (req: any, res) => {
    try {
      console.log("Creating project - request body:", req.body);
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;
      console.log("Creating project - tenant:", tenantId, "user:", userId);
      
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
      
      console.log("Creating project - processed data:", projectData);
      
      const validatedData = insertProjectSchema.parse({
        ...projectData,
        tenantId,
        createdBy: userId
      });
      
      console.log("Creating project - validated data:", validatedData);
      
      const project = await storage.createProject(validatedData);
      console.log("Creating project - created:", project);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid project data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create project" });
    }
  });
}