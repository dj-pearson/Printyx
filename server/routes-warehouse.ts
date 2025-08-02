import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";

// Warehouse operation schemas for validation
const warehouseOperationSchema = z.object({
  equipmentId: z.string(),
  operationType: z.enum(["receiving", "quality_control", "staging", "shipping", "build"]),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).default("pending"),
  assignedTo: z.string().optional(),
  scheduledDate: z.string().optional(),
  completedDate: z.string().optional(),
  notes: z.string().optional(),
  qualityControlChecks: z.record(z.boolean()).optional(),
  photos: z.array(z.string()).optional(),
});

const serialNumberSchema = z.object({
  serialNumber: z.string(),
  equipmentId: z.string(),
  status: z.enum(["received", "staged", "built", "tested", "shipped", "delivered"]).default("received"),
  location: z.string().optional(),
  accessories: z.array(z.object({
    accessoryId: z.string(),
    serialNumber: z.string().optional(),
    status: z.enum(["pending", "matched", "installed"]).default("pending"),
  })).optional(),
});

const buildProcessSchema = z.object({
  equipmentId: z.string(),
  modelId: z.string(),
  assignedTechnician: z.string(),
  scheduledDate: z.string(),
  status: z.enum(["scheduled", "in_progress", "completed", "failed"]).default("scheduled"),
  accessories: z.array(z.object({
    accessoryId: z.string(),
    quantity: z.number(),
    isRequired: z.boolean().default(false),
    status: z.enum(["pending", "matched", "installed"]).default("pending"),
  })),
  buildSteps: z.array(z.object({
    stepName: z.string(),
    description: z.string(),
    estimatedTime: z.number(),
    isCompleted: z.boolean().default(false),
    completedBy: z.string().optional(),
    completedAt: z.string().optional(),
    notes: z.string().optional(),
  })),
});

const deliveryScheduleSchema = z.object({
  customerId: z.string(),
  equipmentId: z.string(),
  deliveryDate: z.string(),
  deliveryWindow: z.enum(["morning", "afternoon", "all_day"]).default("all_day"),
  deliveryAddress: z.string(),
  specialInstructions: z.string().optional(),
  requiredAccessories: z.array(z.string()).optional(),
  deliveryTeam: z.array(z.string()).optional(),
  installationRequired: z.boolean().default(false),
  installationDate: z.string().optional(),
  status: z.enum(["scheduled", "in_transit", "delivered", "failed"]).default("scheduled"),
});

export function registerWarehouseRoutes(app: Express) {
  // Warehouse Operations CRUD
  app.get("/api/warehouse-operations", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const operations = await storage.getWarehouseOperations(tenantId);
      res.json(operations);
    } catch (error) {
      console.error("Error fetching warehouse operations:", error);
      res.status(500).json({ error: "Failed to fetch warehouse operations" });
    }
  });

  app.get("/api/warehouse-operations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const operation = await storage.getWarehouseOperation(id, tenantId);
      if (!operation) {
        return res.status(404).json({ error: "Warehouse operation not found" });
      }

      res.json(operation);
    } catch (error) {
      console.error("Error fetching warehouse operation:", error);
      res.status(500).json({ error: "Failed to fetch warehouse operation" });
    }
  });

  app.post("/api/warehouse-operations", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const userId = req.user.claims.sub;
      
      const validatedData = warehouseOperationSchema.parse(req.body);
      
      const operation = await storage.createWarehouseOperation({
        ...validatedData,
        tenantId,
        assignedTo: validatedData.assignedTo || userId,
        scheduledDate: validatedData.scheduledDate ? new Date(validatedData.scheduledDate) : undefined,
      });

      res.json(operation);
    } catch (error: any) {
      console.error("Error creating warehouse operation:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create warehouse operation" });
      }
    }
  });

  app.put("/api/warehouse-operations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const operation = await storage.updateWarehouseOperation(id, req.body, tenantId);
      if (!operation) {
        return res.status(404).json({ error: "Warehouse operation not found" });
      }

      res.json(operation);
    } catch (error) {
      console.error("Error updating warehouse operation:", error);
      res.status(500).json({ error: "Failed to update warehouse operation" });
    }
  });

  app.patch("/api/warehouse-operations/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.claims.sub;
      
      const updateData: any = { 
        status,
        updatedAt: new Date(),
      };
      
      if (status === 'completed') {
        updateData.completedDate = new Date();
        updateData.completedBy = userId;
      }

      const operation = await storage.updateWarehouseOperation(id, updateData, tenantId);
      if (!operation) {
        return res.status(404).json({ error: "Warehouse operation not found" });
      }

      res.json(operation);
    } catch (error) {
      console.error("Error updating warehouse operation status:", error);
      res.status(500).json({ error: "Failed to update warehouse operation status" });
    }
  });

  app.delete("/api/warehouse-operations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const success = await storage.deleteWarehouseOperation(id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Warehouse operation not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting warehouse operation:", error);
      res.status(500).json({ error: "Failed to delete warehouse operation" });
    }
  });

  // Warehouse statistics
  app.get("/api/warehouse-operations/stats", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const operations = await storage.getWarehouseOperations(tenantId);
      
      const stats = {
        totalOperations: operations.length,
        pendingOperations: operations.filter(op => op.status === "pending").length,
        inProgressOperations: operations.filter(op => op.status === "in_progress").length,
        completedOperations: operations.filter(op => op.status === "completed").length,
        failedOperations: operations.filter(op => op.status === "failed").length,
        operationsByType: {
          receiving: operations.filter(op => op.operationType === "receiving").length,
          quality_control: operations.filter(op => op.operationType === "quality_control").length,
          staging: operations.filter(op => op.operationType === "staging").length,
          shipping: operations.filter(op => op.operationType === "shipping").length,
          build: operations.filter(op => op.operationType === "build").length,
        },
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching warehouse statistics:", error);
      res.status(500).json({ error: "Failed to fetch warehouse statistics" });
    }
  });

  // Serial Number Management
  app.get("/api/serial-numbers", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const serialNumbers = await storage.getSerialNumbers(tenantId);
      res.json(serialNumbers);
    } catch (error) {
      console.error("Error fetching serial numbers:", error);
      res.status(500).json({ error: "Failed to fetch serial numbers" });
    }
  });

  app.post("/api/serial-numbers", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      
      const validatedData = serialNumberSchema.parse(req.body);
      
      const serialNumber = await storage.createSerialNumber({
        ...validatedData,
        tenantId,
      });

      res.json(serialNumber);
    } catch (error: any) {
      console.error("Error creating serial number:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create serial number" });
      }
    }
  });

  app.put("/api/serial-numbers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const serialNumber = await storage.updateSerialNumber(id, req.body, tenantId);
      if (!serialNumber) {
        return res.status(404).json({ error: "Serial number not found" });
      }

      res.json(serialNumber);
    } catch (error) {
      console.error("Error updating serial number:", error);
      res.status(500).json({ error: "Failed to update serial number" });
    }
  });

  // Build Process Management
  app.get("/api/build-processes", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const buildProcesses = await storage.getBuildProcesses(tenantId);
      res.json(buildProcesses);
    } catch (error) {
      console.error("Error fetching build processes:", error);
      res.status(500).json({ error: "Failed to fetch build processes" });
    }
  });

  app.post("/api/build-processes", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      
      const validatedData = buildProcessSchema.parse({
        ...req.body,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate).toISOString() : undefined,
      });
      
      const buildProcess = await storage.createBuildProcess({
        ...validatedData,
        tenantId,
      });

      res.json(buildProcess);
    } catch (error: any) {
      console.error("Error creating build process:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create build process" });
      }
    }
  });

  // Delivery Scheduling
  app.get("/api/delivery-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const deliverySchedules = await storage.getDeliverySchedules(tenantId);
      res.json(deliverySchedules);
    } catch (error) {
      console.error("Error fetching delivery schedules:", error);
      res.status(500).json({ error: "Failed to fetch delivery schedules" });
    }
  });

  app.post("/api/delivery-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      
      const validatedData = deliveryScheduleSchema.parse({
        ...req.body,
        deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate).toISOString() : undefined,
        installationDate: req.body.installationDate ? new Date(req.body.installationDate).toISOString() : undefined,
      });
      
      const deliverySchedule = await storage.createDeliverySchedule({
        ...validatedData,
        tenantId,
      });

      res.json(deliverySchedule);
    } catch (error: any) {
      console.error("Error creating delivery schedule:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create delivery schedule" });
      }
    }
  });

  app.put("/api/delivery-schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const deliverySchedule = await storage.updateDeliverySchedule(id, req.body, tenantId);
      if (!deliverySchedule) {
        return res.status(404).json({ error: "Delivery schedule not found" });
      }

      res.json(deliverySchedule);
    } catch (error) {
      console.error("Error updating delivery schedule:", error);
      res.status(500).json({ error: "Failed to update delivery schedule" });
    }
  });

  // Equipment tracking by serial number
  app.get("/api/equipment/:id/lifecycle", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      // Get all operations for this equipment
      const operations = await storage.getWarehouseOperationsByEquipment(id, tenantId);
      const serialNumbers = await storage.getSerialNumbersByEquipment(id, tenantId);
      const buildProcesses = await storage.getBuildProcessesByEquipment(id, tenantId);
      const deliverySchedules = await storage.getDeliverySchedulesByEquipment(id, tenantId);
      
      const lifecycle = {
        equipmentId: id,
        operations,
        serialNumbers,
        buildProcesses,
        deliverySchedules,
        currentStatus: operations.length > 0 ? operations[operations.length - 1].status : "unknown",
      };
      
      res.json(lifecycle);
    } catch (error) {
      console.error("Error fetching equipment lifecycle:", error);
      res.status(500).json({ error: "Failed to fetch equipment lifecycle" });
    }
  });
}