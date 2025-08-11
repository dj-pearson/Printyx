import type { Express } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { insertTaskSchema, insertProjectSchema } from "@shared/schema";

// Task management routes using real database data
export function registerTaskRoutes(app: Express) {
  // Get tasks - filter by assigned user if requested
  app.get("/api/tasks", async (req: any, res) => {
    try {
      console.log("Tasks endpoint hit, checking auth...");
      console.log("req.isAuthenticated():", req.isAuthenticated ? req.isAuthenticated() : "no isAuthenticated method");
      console.log("req.user:", req.user ? Object.keys(req.user) : "no user");
      
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        console.log("Not authenticated, returning 401");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as any;
      console.log("User object structure:", JSON.stringify({
        hasUser: !!user,
        keys: user ? Object.keys(user) : [],
        hasClaims: !!user?.claims,
        claimsKeys: user?.claims ? Object.keys(user.claims) : [],
        tenantId: user?.tenantId,
        expires_at: user?.expires_at
      }, null, 2));

      // Auto-populate tenantId if missing
      if (!user.tenantId) {
        user.tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Default tenant for demo
        console.log("Set default tenantId for demo");
      }

      const tenantId = user.tenantId;
      const { assignedTo, my } = req.query;
      
      let userId: string | undefined;
      if (my === 'true') {
        userId = user?.claims?.sub;
      } else if (assignedTo) {
        userId = assignedTo as string;
      }
      
      console.log(`Fetching tasks for tenant: ${tenantId}, user: ${userId}`);
      const tasks = await storage.getTasks(tenantId, userId);
      console.log(`Found ${tasks.length} tasks`);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get task statistics
  app.get("/api/tasks/stats", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      
      const validatedData = insertTaskSchema.parse({
        ...req.body,
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

  // Update task
  app.put("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
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
  app.get("/api/projects", async (req: any, res) => {
    try {
      console.log("Projects endpoint hit, checking auth...");
      
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        console.log("Not authenticated for projects, returning 401");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as any;
      
      // Auto-populate tenantId if missing
      if (!user.tenantId) {
        user.tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Default tenant for demo
      }

      const tenantId = user.tenantId;
      const { assignedTo, my } = req.query;
      
      let userId: string | undefined;
      if (my === 'true') {
        userId = user?.claims?.sub;
      } else if (assignedTo) {
        userId = assignedTo as string;
      }
      
      console.log(`Fetching projects for tenant: ${tenantId}, user: ${userId}`);
      const projects = await storage.getProjects(tenantId, userId);
      console.log(`Found ${projects.length} projects`);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Create new project
  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      
      const validatedData = insertProjectSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId
      });
      
      const project = await storage.createProject(validatedData);
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