import type { Express } from 'express';
import { z } from 'zod';
import { eq, and, desc, sql, count, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-technician-management');

import {
  technicians,
  serviceTickets,
  users,
  insertTechnicianSchema,
  type Technician,
} from '@shared/schema';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  requireLevel,
  PERMISSIONS,
  ROLE_LEVELS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

import { getUserId, getTenantId } from './utils/auth-helpers';
// Validation schema for update operations.
// Accepts both the real column names and the friendlier aliases the client
// sends (name -> first/last, specialties -> skills, location ->
// currentLocation, status -> isActive, availability -> isAvailable); the
// handler translates them to the real `technicians` columns. Unknown keys are
// stripped rather than rejected so older clients don't 400.
const updateTechnicianSchema = z.object({
  name: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  specialties: z.array(z.string()).nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  certifications: z.array(z.string()).nullable().optional(),
  status: z.enum(['active', 'inactive', 'on_leave']).optional(),
  isActive: z.boolean().optional(),
  location: z.string().nullable().optional(),
  currentLocation: z.string().nullable().optional(),
  availability: z.enum(['available', 'busy', 'off_duty']).optional(),
  isAvailable: z.boolean().optional(),
  workingHours: z.string().nullable().optional(),
  hourlyRate: z.string().or(z.number()).nullable().optional(),
  employeeId: z.string().nullable().optional(),
});

const performanceQuerySchema = z.object({
  period: z.string().regex(/^\d+$/, 'Period must be a numeric string').optional().default('30'),
});

// Computed presentation columns bridging the real lean `technicians` table
// (firstName/lastName/isActive/isAvailable) to the shape the client expects
// (name/status/availability).
const technicianNameSql = sql<string>`trim(coalesce(${technicians.firstName}, '') || ' ' || coalesce(${technicians.lastName}, ''))`;
const technicianStatusSql = sql<string>`case when ${technicians.isActive} then 'active' else 'inactive' end`;
const technicianAvailabilitySql = sql<string>`case when ${technicians.isAvailable} then 'available' else 'busy' end`;

export function registerTechnicianManagementRoutes(app: Express) {
  // Apply authentication and RBAC context to all technician management routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/technician-management', isAuthenticated, enhanceUserContext);

  // Get all technicians - requires service technician view permission
  app.get(
    '/api/technician-management/technicians',
    isAuthenticated,
    requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.VIEW, PERMISSIONS.SERVICE.TECHNICIAN.MANAGE]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

        const techniciansData = await db
          .select({
            id: technicians.id,
            name: technicianNameSql,
            firstName: technicians.firstName,
            lastName: technicians.lastName,
            email: technicians.email,
            phone: technicians.phone,
            specialties: technicians.skills,
            certifications: technicians.certifications,
            status: technicianStatusSql,
            location: technicians.currentLocation,
            availability: technicianAvailabilitySql,
            hourlyRate: technicians.hourlyRate,
            employeeId: technicians.employeeId,
            workingHours: technicians.workingHours,
            createdAt: technicians.createdAt,
            updatedAt: technicians.updatedAt,
          })
          .from(technicians)
          .where(eq(technicians.tenantId, tenantId))
          .orderBy(technicians.firstName, technicians.lastName);

        // Get active ticket counts for each technician
        const technicianStats = await Promise.all(
          techniciansData.map(async (tech) => {
            const activeTickets = await db
              .select({ count: count() })
              .from(serviceTickets)
              .where(
                and(
                  eq(serviceTickets.assignedTechnicianId, tech.id),
                  eq(serviceTickets.tenantId, tenantId),
                  sql`${serviceTickets.status} NOT IN ('completed', 'cancelled')`,
                ),
              );

            const completedThisMonth = await db
              .select({ count: count() })
              .from(serviceTickets)
              .where(
                and(
                  eq(serviceTickets.assignedTechnicianId, tech.id),
                  eq(serviceTickets.tenantId, tenantId),
                  eq(serviceTickets.status, 'completed'),
                  gte(
                    serviceTickets.updatedAt,
                    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                  ),
                ),
              );

            return {
              ...tech,
              activeTickets: activeTickets[0]?.count || 0,
              completedThisMonth: completedThisMonth[0]?.count || 0,
            };
          }),
        );

        res.json(technicianStats);
      } catch (error) {
        log.error('Error fetching technicians:', error);
        res.status(500).json({ error: 'Failed to fetch technicians' });
      }
    },
  );

  // Get technician by ID - requires service technician view permission
  app.get(
    '/api/technician-management/technicians/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;
        const technicianId = req.params.id;

        const [technician] = await db
          .select()
          .from(technicians)
          .where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)));

        if (!technician) {
          return res.status(404).json({ error: 'Technician not found' });
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
            completedDate: serviceTickets.resolvedAt,
            createdAt: serviceTickets.createdAt,
          })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.assignedTechnicianId, technicianId),
              eq(serviceTickets.tenantId, tenantId),
            ),
          )
          .orderBy(desc(serviceTickets.createdAt))
          .limit(20);

        res.json({
          ...technician,
          name: `${technician.firstName ?? ''} ${technician.lastName ?? ''}`.trim(),
          specialties: technician.skills,
          location: technician.currentLocation,
          status: technician.isActive ? 'active' : 'inactive',
          availability: technician.isAvailable ? 'available' : 'busy',
          recentTickets: tickets,
        });
      } catch (error) {
        log.error('Error fetching technician:', error);
        res.status(500).json({ error: 'Failed to fetch technician' });
      }
    },
  );

  // Create new technician - requires service technician manage permission
  app.post(
    '/api/technician-management/technicians',
    isAuthenticated,
    requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.MANAGE]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

        // Translate the client's friendly aliases to the real columns before
        // validating. (userId is a NOT NULL FK to users — the caller must
        // supply it to link the technician to a user account.)
        const body: Record<string, unknown> = { ...req.body };
        if (typeof body.name === 'string' && (!body.firstName || !body.lastName)) {
          const parts = body.name.trim().split(/\s+/);
          body.firstName = body.firstName || parts[0] || '';
          body.lastName = body.lastName || parts.slice(1).join(' ') || parts[0] || '';
        }
        if (Array.isArray(body.specialties) && body.skills === undefined) {
          body.skills = body.specialties;
        }
        if (body.location != null && body.currentLocation === undefined) {
          body.currentLocation = body.location;
        }
        if (typeof body.status === 'string' && body.isActive === undefined) {
          body.isActive = body.status === 'active';
        }
        if (typeof body.availability === 'string' && body.isAvailable === undefined) {
          body.isAvailable = body.availability === 'available';
        }

        const technicianData = insertTechnicianSchema.parse({
          ...body,
          tenantId,
          employeeId: (body.employeeId as string) || `TECH-${Date.now()}`,
        });

        const [newTechnician] = await db.insert(technicians).values(technicianData).returning();

        res.status(201).json(newTechnician);
      } catch (error: any) {
        log.error('Error creating technician:', error);
        if (error.name === 'ZodError') {
          res.status(400).json({ error: 'Invalid data', details: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to create technician' });
        }
      }
    },
  );

  // Update technician - requires service technician manage permission
  app.put(
    '/api/technician-management/technicians/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.MANAGE]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;
        const technicianId = req.params.id;

        const validatedData = updateTechnicianSchema.parse(req.body);

        // Translate the accepted aliases into the real `technicians` columns.
        const updates: Partial<typeof technicians.$inferInsert> = { updatedAt: new Date() };
        if (validatedData.firstName !== undefined) updates.firstName = validatedData.firstName;
        if (validatedData.lastName !== undefined) updates.lastName = validatedData.lastName;
        if (validatedData.name !== undefined) {
          const parts = validatedData.name.trim().split(/\s+/);
          updates.firstName = parts[0] || '';
          updates.lastName = parts.slice(1).join(' ') || parts[0] || '';
        }
        if (validatedData.email !== undefined) updates.email = validatedData.email;
        if (validatedData.phone !== undefined) updates.phone = validatedData.phone;
        if (validatedData.skills !== undefined) updates.skills = validatedData.skills ?? undefined;
        if (validatedData.specialties !== undefined)
          updates.skills = validatedData.specialties ?? undefined;
        if (validatedData.certifications !== undefined)
          updates.certifications = validatedData.certifications ?? undefined;
        if (validatedData.currentLocation !== undefined)
          updates.currentLocation = validatedData.currentLocation;
        if (validatedData.location !== undefined) updates.currentLocation = validatedData.location;
        if (validatedData.isActive !== undefined) updates.isActive = validatedData.isActive;
        if (validatedData.status !== undefined)
          updates.isActive = validatedData.status === 'active';
        if (validatedData.isAvailable !== undefined)
          updates.isAvailable = validatedData.isAvailable;
        if (validatedData.availability !== undefined)
          updates.isAvailable = validatedData.availability === 'available';
        if (validatedData.workingHours !== undefined)
          updates.workingHours = validatedData.workingHours;
        if (validatedData.employeeId !== undefined) updates.employeeId = validatedData.employeeId;
        if (validatedData.hourlyRate !== undefined) {
          updates.hourlyRate =
            validatedData.hourlyRate == null ? null : String(validatedData.hourlyRate);
        }

        const [updatedTechnician] = await db
          .update(technicians)
          .set(updates)
          .where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)))
          .returning();

        if (!updatedTechnician) {
          return res.status(404).json({ error: 'Technician not found' });
        }

        res.json(updatedTechnician);
      } catch (error: any) {
        log.error('Error updating technician:', error);
        if (error.name === 'ZodError') {
          res.status(400).json({ error: 'Invalid data', details: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to update technician' });
        }
      }
    },
  );

  // Delete technician - requires service technician manage permission
  app.delete(
    '/api/technician-management/technicians/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.MANAGE]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;
        const technicianId = req.params.id;

        // Check if technician has active service tickets
        const activeTickets = await db
          .select({ count: count() })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.assignedTechnicianId, technicianId),
              eq(serviceTickets.tenantId, tenantId),
              sql`${serviceTickets.status} NOT IN ('completed', 'cancelled')`,
            ),
          );

        if ((activeTickets[0]?.count ?? 0) > 0) {
          return res.status(400).json({
            error:
              'Cannot delete technician with active service tickets. Please reassign or complete all tickets first.',
          });
        }

        const [deletedTechnician] = await db
          .delete(technicians)
          .where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)))
          .returning();

        if (!deletedTechnician) {
          return res.status(404).json({ error: 'Technician not found' });
        }

        res.json({ message: 'Technician deleted successfully' });
      } catch (error) {
        log.error('Error deleting technician:', error);
        res.status(500).json({ error: 'Failed to delete technician' });
      }
    },
  );

  // Get technician availability - requires service technician view permission
  app.get(
    '/api/technician-management/availability',
    isAuthenticated,
    requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;
        const { date } = req.query;

        const availableTechnicians = await db
          .select({
            id: technicians.id,
            name: technicianNameSql,
            specialties: technicians.skills,
            location: technicians.currentLocation,
            status: technicianStatusSql,
            availability: technicianAvailabilitySql,
          })
          .from(technicians)
          .where(and(eq(technicians.tenantId, tenantId), eq(technicians.isActive, true)));

        // If date is provided, check for conflicting appointments
        if (date) {
          const dateObj = new Date(date as string);
          const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0));
          const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999));

          const busyTechnicians = await db
            .select({ technicianId: serviceTickets.assignedTechnicianId })
            .from(serviceTickets)
            .where(
              and(
                eq(serviceTickets.tenantId, tenantId),
                sql`${serviceTickets.scheduledDate} BETWEEN ${startOfDay} AND ${endOfDay}`,
                sql`${serviceTickets.status} NOT IN ('completed', 'cancelled')`,
              ),
            );

          const busyTechIds = busyTechnicians.map((t) => t.technicianId);

          const availableForDate = availableTechnicians.filter(
            (tech) => !busyTechIds.includes(tech.id),
          );

          res.json(availableForDate);
        } else {
          res.json(availableTechnicians);
        }
      } catch (error) {
        log.error('Error fetching technician availability:', error);
        res.status(500).json({ error: 'Failed to fetch technician availability' });
      }
    },
  );

  // Get technician performance metrics - requires service technician view permission
  app.get(
    '/api/technician-management/performance',
    isAuthenticated,
    requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

        const queryParams = performanceQuerySchema.parse(req.query);
        const periodDays = parseInt(queryParams.period, 10);

        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - periodDays);

        const performanceData = await db
          .select({
            technicianId: serviceTickets.assignedTechnicianId,
            technicianName: technicianNameSql,
            totalTickets: count(),
            completedTickets: sql<number>`SUM(CASE WHEN ${serviceTickets.status} = 'completed' THEN 1 ELSE 0 END)`,
            avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${serviceTickets.resolvedAt} - ${serviceTickets.createdAt})) / 3600)`,
          })
          .from(serviceTickets)
          .leftJoin(technicians, eq(serviceTickets.assignedTechnicianId, technicians.id))
          .where(and(eq(serviceTickets.tenantId, tenantId), gte(serviceTickets.createdAt, daysAgo)))
          .groupBy(
            serviceTickets.assignedTechnicianId,
            technicians.firstName,
            technicians.lastName,
          );

        const performanceMetrics = performanceData.map((data) => ({
          ...data,
          completionRate:
            data.totalTickets > 0 ? (Number(data.completedTickets) / data.totalTickets) * 100 : 0,
          avgResolutionTime: Number(data.avgResolutionTime) || 0,
        }));

        res.json(performanceMetrics);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          log.warn('Invalid performance query parameters:', error.errors);
          return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
        }
        log.error('Error fetching technician performance:', error);
        res.status(500).json({ error: 'Failed to fetch technician performance' });
      }
    },
  );

  // Get technician dashboard statistics - requires service technician view permission
  app.get(
    '/api/technician-management/dashboard',
    isAuthenticated,
    requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

        const totalTechniciansResult = await db
          .select({ count: count() })
          .from(technicians)
          .where(eq(technicians.tenantId, tenantId));

        const activeTechniciansResult = await db
          .select({ count: count() })
          .from(technicians)
          .where(and(eq(technicians.tenantId, tenantId), eq(technicians.isActive, true)));

        const availableTechniciansResult = await db
          .select({ count: count() })
          .from(technicians)
          .where(
            and(
              eq(technicians.tenantId, tenantId),
              eq(technicians.isActive, true),
              eq(technicians.isAvailable, true),
            ),
          );

        const busyTechniciansResult = await db
          .select({ count: count() })
          .from(technicians)
          .where(
            and(
              eq(technicians.tenantId, tenantId),
              eq(technicians.isActive, true),
              eq(technicians.isAvailable, false),
            ),
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
          utilizationRate: activeTechnicians > 0 ? (busyTechnicians / activeTechnicians) * 100 : 0,
        });
      } catch (error) {
        log.error('Error fetching technician dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch technician dashboard' });
      }
    },
  );
}
