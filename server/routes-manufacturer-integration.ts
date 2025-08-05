import type { Express } from "express";
import { db } from "./db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import {
  manufacturerIntegrations,
  deviceRegistrations,
  deviceMetrics,
  integrationAuditLogs,
  thirdPartyIntegrations,
  insertManufacturerIntegrationSchema,
  insertDeviceRegistrationSchema,
  insertDeviceMetricSchema,
} from "@shared/schema";
import { manufacturerIntegrationService } from "./manufacturer-integration-service";

export function registerManufacturerIntegrationRoutes(app: Express) {
  // Get all integrations for a tenant
  app.get("/api/manufacturer-integrations", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const integrations = await db.select()
        .from(manufacturerIntegrations)
        .where(eq(manufacturerIntegrations.tenantId, tenantId))
        .orderBy(desc(manufacturerIntegrations.createdAt));

      res.json(integrations);
    } catch (error) {
      console.error("Error fetching manufacturer integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  // Create a new integration
  app.post("/api/manufacturer-integrations", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const validatedData = insertManufacturerIntegrationSchema.parse(req.body);
      
      const integration = await manufacturerIntegrationService.createIntegration(
        tenantId,
        validatedData
      );

      res.json(integration);
    } catch (error) {
      console.error("Error creating manufacturer integration:", error);
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  // Get integration by ID
  app.get("/api/manufacturer-integrations/:id", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const integration = await db.select()
        .from(manufacturerIntegrations)
        .where(and(
          eq(manufacturerIntegrations.tenantId, tenantId),
          eq(manufacturerIntegrations.id, id)
        ))
        .limit(1);

      if (!integration[0]) {
        return res.status(404).json({ message: "Integration not found" });
      }

      res.json(integration[0]);
    } catch (error) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  // Update integration
  app.put("/api/manufacturer-integrations/:id", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const [updatedIntegration] = await db.update(manufacturerIntegrations)
        .set({ 
          ...req.body, 
          updatedAt: new Date() 
        })
        .where(and(
          eq(manufacturerIntegrations.tenantId, tenantId),
          eq(manufacturerIntegrations.id, id)
        ))
        .returning();

      if (!updatedIntegration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      res.json(updatedIntegration);
    } catch (error) {
      console.error("Error updating integration:", error);
      res.status(500).json({ message: "Failed to update integration" });
    }
  });

  // Delete integration
  app.delete("/api/manufacturer-integrations/:id", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      await db.delete(manufacturerIntegrations)
        .where(and(
          eq(manufacturerIntegrations.tenantId, tenantId),
          eq(manufacturerIntegrations.id, id)
        ));

      res.json({ message: "Integration deleted successfully" });
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Test integration connection
  app.post("/api/manufacturer-integrations/:id/test", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // This would test the connection using the integration service
      // For now, return a mock response
      const success = Math.random() > 0.3; // 70% success rate for demo

      res.json({ 
        success,
        message: success ? "Connection successful" : "Connection failed",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error testing connection:", error);
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  // Discover and register devices
  app.post("/api/manufacturer-integrations/:id/discover", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const devices = await manufacturerIntegrationService.discoverAndRegisterDevices(
        tenantId,
        id
      );

      res.json({ 
        message: `Discovered and registered ${devices.length} devices`,
        devices 
      });
    } catch (error) {
      console.error("Error discovering devices:", error);
      res.status(500).json({ message: "Failed to discover devices" });
    }
  });

  // Get devices for an integration
  app.get("/api/manufacturer-integrations/:id/devices", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const devices = await db.select()
        .from(deviceRegistrations)
        .where(and(
          eq(deviceRegistrations.tenantId, tenantId),
          eq(deviceRegistrations.integrationId, id)
        ))
        .orderBy(desc(deviceRegistrations.registeredAt));

      res.json(devices);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  // Get all devices across integrations
  app.get("/api/devices", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const devices = await db.select({
        device: deviceRegistrations,
        integration: manufacturerIntegrations
      })
        .from(deviceRegistrations)
        .innerJoin(manufacturerIntegrations, eq(deviceRegistrations.integrationId, manufacturerIntegrations.id))
        .where(eq(deviceRegistrations.tenantId, tenantId))
        .orderBy(desc(deviceRegistrations.lastSeen));

      res.json(devices);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  // Collect metrics from a device
  app.post("/api/devices/:deviceId/collect", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { deviceId } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const metrics = await manufacturerIntegrationService.collectDeviceMetrics(
        tenantId,
        deviceId
      );

      res.json(metrics);
    } catch (error) {
      console.error("Error collecting device metrics:", error);
      res.status(500).json({ message: "Failed to collect device metrics" });
    }
  });

  // Get device metrics
  app.get("/api/devices/:deviceId/metrics", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { deviceId } = req.params;
      const { days = 7 } = req.query;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      const metrics = await db.select()
        .from(deviceMetrics)
        .where(and(
          eq(deviceMetrics.tenantId, tenantId),
          eq(deviceMetrics.deviceId, deviceId),
          gte(deviceMetrics.collectionTimestamp, startDate)
        ))
        .orderBy(desc(deviceMetrics.collectionTimestamp));

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching device metrics:", error);
      res.status(500).json({ message: "Failed to fetch device metrics" });
    }
  });

  // Get audit logs
  app.get("/api/manufacturer-integrations/audit-logs", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { integrationId, deviceId, action, status, days = 7 } = req.query;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      let whereConditions = [
        eq(integrationAuditLogs.tenantId, tenantId),
        gte(integrationAuditLogs.timestamp, startDate)
      ];

      if (integrationId) {
        whereConditions.push(eq(integrationAuditLogs.integrationId, integrationId as string));
      }
      if (deviceId) {
        whereConditions.push(eq(integrationAuditLogs.deviceId, deviceId as string));
      }
      if (action) {
        whereConditions.push(eq(integrationAuditLogs.action, action as string));
      }
      if (status) {
        whereConditions.push(eq(integrationAuditLogs.status, status as string));
      }

      const logs = await db.select({
        log: integrationAuditLogs,
        integration: manufacturerIntegrations,
        device: deviceRegistrations
      })
        .from(integrationAuditLogs)
        .leftJoin(manufacturerIntegrations, eq(integrationAuditLogs.integrationId, manufacturerIntegrations.id))
        .leftJoin(deviceRegistrations, eq(integrationAuditLogs.deviceId, deviceRegistrations.id))
        .where(and(...whereConditions))
        .orderBy(desc(integrationAuditLogs.timestamp))
        .limit(100);

      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Get integration statistics
  app.get("/api/manufacturer-integrations/stats", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const [
        totalIntegrations,
        activeIntegrations,
        totalDevices,
        onlineDevices,
        todayMetrics
      ] = await Promise.all([
        db.select({ count: sql`count(*)` })
          .from(manufacturerIntegrations)
          .where(eq(manufacturerIntegrations.tenantId, tenantId)),

        db.select({ count: sql`count(*)` })
          .from(manufacturerIntegrations)
          .where(and(
            eq(manufacturerIntegrations.tenantId, tenantId),
            eq(manufacturerIntegrations.status, 'active')
          )),

        db.select({ count: sql`count(*)` })
          .from(deviceRegistrations)
          .where(eq(deviceRegistrations.tenantId, tenantId)),

        db.select({ count: sql`count(*)` })
          .from(deviceRegistrations)
          .where(and(
            eq(deviceRegistrations.tenantId, tenantId),
            eq(deviceRegistrations.status, 'online')
          )),

        db.select({ count: sql`count(*)` })
          .from(deviceMetrics)
          .where(and(
            eq(deviceMetrics.tenantId, tenantId),
            gte(deviceMetrics.collectionTimestamp, new Date(Date.now() - 24 * 60 * 60 * 1000))
          ))
      ]);

      res.json({
        totalIntegrations: Number(totalIntegrations[0]?.count || 0),
        activeIntegrations: Number(activeIntegrations[0]?.count || 0),
        totalDevices: Number(totalDevices[0]?.count || 0),
        onlineDevices: Number(onlineDevices[0]?.count || 0),
        todayMetrics: Number(todayMetrics[0]?.count || 0)
      });
    } catch (error) {
      console.error("Error fetching integration stats:", error);
      res.status(500).json({ message: "Failed to fetch integration statistics" });
    }
  });
}