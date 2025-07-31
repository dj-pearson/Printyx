import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertCustomerSchema,
  insertEquipmentSchema,
  insertContractSchema,
  insertServiceTicketSchema,
  insertInventoryItemSchema,
  insertTechnicianSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware - skip for now due to session issues
  console.log("Skipping auth setup temporarily");
  /*
  try {
    await setupAuth(app);
    console.log("Auth setup completed successfully");
  } catch (error) {
    console.error("Auth setup failed:", error);
    // Continue without auth for now to get the app running
  }
  */

  // Auth routes - check for demo authentication
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check for demo authentication header or session
      const isDemoAuth = req.headers['x-demo-auth'] === 'true' || 
                        req.query.demo === 'true' ||
                        req.session?.demoAuth === true;
      
      if (!isDemoAuth) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Return mock authenticated user for demo
      const mockUser = {
        id: "demo-user-123",
        email: "demo@printyx.com",
        firstName: "Demo",
        lastName: "User",
        profileImageUrl: null,  
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      res.json(mockUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes - using demo tenant
  app.get('/api/dashboard/metrics', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const metrics = await storage.getDashboardMetrics(tenantId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get('/api/dashboard/recent-tickets', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const tickets = await storage.getRecentServiceTickets(tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching recent tickets:", error);
      res.status(500).json({ message: "Failed to fetch recent tickets" });
    }
  });

  app.get('/api/dashboard/top-customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const customers = await storage.getTopCustomers(tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching top customers:", error);
      res.status(500).json({ message: "Failed to fetch top customers" });
    }
  });

  app.get('/api/dashboard/alerts', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const lowStockItems = await storage.getLowStockAlerts(tenantId);
      res.json({ lowStock: lowStockItems });
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Customer routes
  app.get('/api/customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const customers = await storage.getCustomers(tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post('/api/customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      
      const validatedData = insertCustomerSchema.parse({
        ...req.body,
        tenantId: tenantId,
      });
      
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Service ticket routes
  app.get('/api/service-tickets', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const tickets = await storage.getServiceTickets(tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching service tickets:", error);
      res.status(500).json({ message: "Failed to fetch service tickets" });
    }
  });

  app.post('/api/service-tickets', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const demoUserId = "demo-user-123"; // Demo user
      
      const validatedData = insertServiceTicketSchema.parse({
        ...req.body,
        tenantId: tenantId,
        createdBy: demoUserId,
        ticketNumber: `ST-${Date.now()}`, // Simple ticket number generation
      });
      
      const ticket = await storage.createServiceTicket(validatedData);
      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating service ticket:", error);
      res.status(500).json({ message: "Failed to create service ticket" });
    }
  });

  // Contract routes
  app.get('/api/contracts', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const contracts = await storage.getContracts(tenantId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  // Equipment routes
  app.get('/api/equipment', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const equipment = await storage.getEquipment(tenantId);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Inventory routes
  app.get('/api/inventory', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const inventory = await storage.getInventoryItems(tenantId);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // Technician routes
  app.get('/api/technicians', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const technicians = await storage.getTechnicians(tenantId);
      res.json(technicians);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ message: "Failed to fetch technicians" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
