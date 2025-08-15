import type { Express } from "express";
import { eq, and, desc, sql, count, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  technicians,
  serviceTickets,
  users,
  insertTechnicianSchema,
  type Technician
} from "@shared/schema";

export function registerTechnicianManagementRoutes(app: Express) {
  // Get all technicians
  app.get("/api/technician-management/technicians", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const techniciansData = await db
        .select({
          id: technicians.id,
          name: technicians.name,
          email: technicians.email,
          phone: technicians.phone,
          specialties: technicians.specialties,
          certifications: technicians.certifications,
          status: technicians.status,
          location: technicians.location,
          availability: technicians.availability,
          skillLevel: technicians.skillLevel,
          hourlyRate: technicians.hourlyRate,
          emergencyContact: technicians.emergencyContact,
          employeeId: technicians.employeeId,
          hireDate: technicians.hireDate,
          lastTrainingDate: technicians.lastTrainingDate,
          performanceRating: technicians.performanceRating,
          createdAt: technicians.createdAt,
          updatedAt: technicians.updatedAt
        })
        .from(technicians)
        .where(eq(technicians.tenantId, tenantId))
        .orderBy(technicians.name);

      // Get active ticket counts for each technician
      const technicianStats = await Promise.all(
        techniciansData.map(async (tech) => {
          const activeTickets = await db
            .select({ count: count() })
            .from(serviceTickets)
            .where(
              and(
                eq(serviceTickets.technicianId, tech.id),
                eq(serviceTickets.tenantId, tenantId),
                sql`${serviceTickets.status} NOT IN ('completed', 'cancelled')`
              )
            );

          const completedThisMonth = await db
            .select({ count: count() })
            .from(serviceTickets)
            .where(
              and(
                eq(serviceTickets.technicianId, tech.id),
                eq(serviceTickets.tenantId, tenantId),
                eq(serviceTickets.status, 'completed'),
                gte(serviceTickets.updatedAt, new Date(new Date().getFullYear(), new Date().getMonth(), 1))
              )
            );

          return {
            ...tech,
            activeTickets: activeTickets[0]?.count || 0,
            completedThisMonth: completedThisMonth[0]?.count || 0
          };
        })
      );

      res.json(technicianStats);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ error: "Failed to fetch technicians" });
    }
  });

  // Get technician by ID
  app.get("/api/technician-management/technicians/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const technicianId = req.params.id;

      const [technician] = await db
        .select()
        .from(technicians)
        .where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)));

      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }

      // Get technician's service tickets
      const tickets = await db
        .select({
          id: serviceTickets.id,
          title: serviceTickets.title,
          description: serviceTickets.description,
          priority: serviceTickets.priority,
          status: serviceTickets.status,
          customerId: serviceTickets.customerId,
          scheduledDate: serviceTickets.scheduledDate,
          completedDate: serviceTickets.completedDate,
          createdAt: serviceTickets.createdAt
        })
        .from(serviceTickets)
        .where(and(eq(serviceTickets.technicianId, technicianId), eq(serviceTickets.tenantId, tenantId)))
        .orderBy(desc(serviceTickets.createdAt))
        .limit(20);

      res.json({
        ...technician,
        recentTickets: tickets
      });
    } catch (error) {
      console.error("Error fetching technician:", error);
      res.status(500).json({ error: "Failed to fetch technician" });
    }
  });

  // Create new technician
  app.post("/api/technician-management/technicians", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const technicianData = insertTechnicianSchema.parse({
        ...req.body,
        tenantId,
        employeeId: req.body.employeeId || `TECH-${Date.now()}`,
        hireDate: req.body.hireDate || new Date(),
        status: req.body.status || 'active'
      });

      const [newTechnician] = await db
        .insert(technicians)
        .values(technicianData)
        .returning();

      res.status(201).json(newTechnician);
    } catch (error) {
      console.error("Error creating technician:", error);
      res.status(500).json({ error: "Failed to create technician" });
    }
  });

  // Update technician
  app.put("/api/technician-management/technicians/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const technicianId = req.params.id;

      const [updatedTechnician] = await db
        .update(technicians)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)))
        .returning();

      if (!updatedTechnician) {
        return res.status(404).json({ error: "Technician not found" });
      }

      res.json(updatedTechnician);
    } catch (error) {
      console.error("Error updating technician:", error);
      res.status(500).json({ error: "Failed to update technician" });
    }
  });

  // Delete technician
  app.delete("/api/technician-management/technicians/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const technicianId = req.params.id;

      // Check if technician has active service tickets
      const activeTickets = await db
        .select({ count: count() })
        .from(serviceTickets)
        .where(
          and(
            eq(serviceTickets.technicianId, technicianId),
            eq(serviceTickets.tenantId, tenantId),
            sql`${serviceTickets.status} NOT IN ('completed', 'cancelled')`
          )
        );

      if (activeTickets[0]?.count > 0) {
        return res.status(400).json({ 
          error: "Cannot delete technician with active service tickets. Please reassign or complete all tickets first." 
        });
      }

      const [deletedTechnician] = await db
        .delete(technicians)
        .where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)))
        .returning();

      if (!deletedTechnician) {
        return res.status(404).json({ error: "Technician not found" });
      }

      res.json({ message: "Technician deleted successfully" });
    } catch (error) {
      console.error("Error deleting technician:", error);
      res.status(500).json({ error: "Failed to delete technician" });
    }
  });

  // Get technician availability
  app.get("/api/technician-management/availability", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { date } = req.query;

      const availableTechnicians = await db
        .select({
          id: technicians.id,
          name: technicians.name,
          specialties: technicians.specialties,
          location: technicians.location,
          status: technicians.status,
          availability: technicians.availability
        })
        .from(technicians)
        .where(
          and(
            eq(technicians.tenantId, tenantId),
            eq(technicians.status, 'active')
          )
        );

      // If date is provided, check for conflicting appointments
      if (date) {
        const dateObj = new Date(date as string);
        const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0));
        const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999));

        const busyTechnicians = await db
          .select({ technicianId: serviceTickets.technicianId })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.tenantId, tenantId),
              sql`${serviceTickets.scheduledDate} BETWEEN ${startOfDay} AND ${endOfDay}`,
              sql`${serviceTickets.status} NOT IN ('completed', 'cancelled')`
            )
          );

        const busyTechIds = busyTechnicians.map(t => t.technicianId);

        const availableForDate = availableTechnicians.filter(tech => 
          !busyTechIds.includes(tech.id)
        );

        res.json(availableForDate);
      } else {
        res.json(availableTechnicians);
      }
    } catch (error) {
      console.error("Error fetching technician availability:", error);
      res.status(500).json({ error: "Failed to fetch technician availability" });
    }
  });

  // Get technician performance metrics
  app.get("/api/technician-management/performance", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { period = '30' } = req.query;
      
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period as string));

      const performanceData = await db
        .select({
          technicianId: serviceTickets.technicianId,
          technicianName: technicians.name,
          totalTickets: count(),
          completedTickets: sql<number>`SUM(CASE WHEN ${serviceTickets.status} = 'completed' THEN 1 ELSE 0 END)`,
          avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${serviceTickets.completedDate} - ${serviceTickets.createdAt})) / 3600)`
        })
        .from(serviceTickets)
        .leftJoin(technicians, eq(serviceTickets.technicianId, technicians.id))
        .where(
          and(
            eq(serviceTickets.tenantId, tenantId),
            gte(serviceTickets.createdAt, daysAgo)
          )
        )
        .groupBy(serviceTickets.technicianId, technicians.name);

      const performanceMetrics = performanceData.map(data => ({
        ...data,
        completionRate: data.totalTickets > 0 ? (Number(data.completedTickets) / data.totalTickets) * 100 : 0,
        avgResolutionTime: Number(data.avgResolutionTime) || 0
      }));

      res.json(performanceMetrics);
    } catch (error) {
      console.error("Error fetching technician performance:", error);
      res.status(500).json({ error: "Failed to fetch technician performance" });
    }
  });

  // Get technician dashboard statistics
  app.get("/api/technician-management/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const totalTechniciansResult = await db
        .select({ count: count() })
        .from(technicians)
        .where(eq(technicians.tenantId, tenantId));

      const activeTechniciansResult = await db
        .select({ count: count() })
        .from(technicians)
        .where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'active')));

      const availableTechniciansResult = await db
        .select({ count: count() })
        .from(technicians)
        .where(
          and(
            eq(technicians.tenantId, tenantId),
            eq(technicians.status, 'active'),
            eq(technicians.availability, 'available')
          )
        );

      const busyTechniciansResult = await db
        .select({ count: count() })
        .from(technicians)
        .where(
          and(
            eq(technicians.tenantId, tenantId),
            eq(technicians.status, 'active'),
            eq(technicians.availability, 'busy')
          )
        );

      const totalTechnicians = totalTechniciansResult[0]?.count || 0;
      const activeTechnicians = activeTechniciansResult[0]?.count || 0;
      const availableTechnicians = availableTechniciansResult[0]?.count || 0;
      const busyTechnicians = busyTechniciansResult[0]?.count || 0;

      res.json({
        totalTechnicians,
        activeTechnicians,
        availableTechnicians,
        busyTechnicians,
        utilizationRate: activeTechnicians > 0 ? (busyTechnicians / activeTechnicians) * 100 : 0
      });
    } catch (error) {
      console.error("Error fetching technician dashboard:", error);
      res.status(500).json({ error: "Failed to fetch technician dashboard" });
    }
  });
}