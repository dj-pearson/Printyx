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
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const metrics = await storage.getDashboardMetrics(user.tenantId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get('/api/dashboard/recent-tickets', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const tickets = await storage.getRecentServiceTickets(user.tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching recent tickets:", error);
      res.status(500).json({ message: "Failed to fetch recent tickets" });
    }
  });

  app.get('/api/dashboard/top-customers', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const customers = await storage.getTopCustomers(user.tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching top customers:", error);
      res.status(500).json({ message: "Failed to fetch top customers" });
    }
  });

  app.get('/api/dashboard/alerts', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const lowStockItems = await storage.getLowStockAlerts(user.tenantId);
      res.json({ lowStock: lowStockItems });
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Customer routes
  app.get('/api/customers', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const customers = await storage.getCustomers(user.tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post('/api/customers', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const validatedData = insertCustomerSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });
      
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Service ticket routes
  app.get('/api/service-tickets', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const tickets = await storage.getServiceTickets(user.tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching service tickets:", error);
      res.status(500).json({ message: "Failed to fetch service tickets" });
    }
  });

  app.post('/api/service-tickets', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const validatedData = insertServiceTicketSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        createdBy: user.id,
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
  app.get('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const contracts = await storage.getContracts(user.tenantId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  // Equipment routes
  app.get('/api/equipment', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const equipment = await storage.getEquipment(user.tenantId);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Inventory routes
  app.get('/api/inventory', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const inventory = await storage.getInventoryItems(user.tenantId);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // Technician routes
  app.get('/api/technicians', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const technicians = await storage.getTechnicians(user.tenantId);
      res.json(technicians);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ message: "Failed to fetch technicians" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
