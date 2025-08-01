import type { Express } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { insertTaskSchema, insertProjectSchema } from "@shared/schema";

// Task management routes using real database data
export function registerTaskRoutes(app: Express) {
  // Get tasks - filter by assigned user if requested
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { assignedTo, my } = req.query;
      
      let userId: string | undefined;
      if (my === 'true') {
        userId = req.user?.claims?.sub;
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
  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const projects = await storage.getProjects(tenantId);
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