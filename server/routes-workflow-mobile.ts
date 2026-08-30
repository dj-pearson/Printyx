/**
 * Workflow, Mobile & Remaining Routes
 * Extracted from routes.ts monolith.
 *
 * Includes:
 * - Workflow Automation Dashboard & Rules
 * - Automation Metrics, Templates, Executions
 * - Mobile Service App Routes (metrics, work-orders, parts, field-orders, locations, sessions, sync)
 * - Mobile Field Operations (metrics, technicians, work-orders, voice-notes)
 * - Mobile Service Dashboard & Route Optimization
 * - User Listing
 * - Deal Management (listing, stage update, stages, activities)
 * - Customer Detail Sub-routes (equipment, meter-readings, invoices, service-tickets, contracts)
 * - Contract Routes (listing, creation, tiered rates, meter billing)
 * - Tenant Routes (listing, locations, regions, summary)
 * - Equipment Trigger Service
 */
import type { Express } from 'express';
import { db } from './db';
import { storage } from './storage';
import { format } from 'date-fns';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { requireTenant, TenantRequest } from './middleware/tenancy';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-workflow-mobile');

import {
  insertDealStageSchema,
  businessRecords,
  locations,
  regions,
  tenants,
  meterReadings,
} from '@shared/schema';
import { equipmentLifecycle } from '../shared/equipment-schema';
import { and, eq, sql, desc } from 'drizzle-orm';
import { forbidden, notFound, serverError } from './lib/error-response';

// Helper function to calculate tiered billing amounts
function calculateTieredAmount(totalCopies: number, tieredRates: any[], baseRate: number): number {
  if (!tieredRates || tieredRates.length === 0) {
    return totalCopies * baseRate;
  }

  let remainingCopies = totalCopies;
  let totalAmount = 0;

  for (let i = 0; i < tieredRates.length; i++) {
    const currentTier = tieredRates[i];
    const nextTier = tieredRates[i + 1];

    const tierMin = currentTier.minimumVolume;
    const tierMax = nextTier ? nextTier.minimumVolume : Infinity;
    const tierRate = parseFloat(currentTier.rate.toString());

    if (totalCopies > tierMin) {
      const copiesInTier = Math.min(remainingCopies, tierMax - tierMin);
      totalAmount += copiesInTier * tierRate;
      remainingCopies -= copiesInTier;

      if (remainingCopies <= 0) break;
    }
  }

  // If there are remaining copies not covered by tiers, use base rate
  if (remainingCopies > 0) {
    totalAmount += remainingCopies * baseRate;
  }

  return totalAmount;
}

export function registerWorkflowMobileRoutes(app: Express) {
  // ============= TENANT ROUTES =============

  // Tenants route for platform users (Root Admin / platform-only)
  app.get('/api/tenants', async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const user = await storage.getUserWithRole(userId);
      if (!user?.role?.canAccessAllTenants && (user?.role?.level ?? 0) < 7) {
        return res.status(403).json({ message: 'Root admin access required' });
      }

      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      log.error('Error fetching tenants:', error);
      res.status(500).json({ message: 'Failed to fetch tenants' });
    }
  });

  // Multi-location support routes for enhanced tenant selector (Root Admin or same-tenant)
  app.get('/api/tenants/:tenantId/locations', async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const user = await storage.getUserWithRole(userId);

      // Only allow platform admins (root) or users from the same tenant
      const isRoot = user?.role?.canAccessAllTenants || (user?.role?.level ?? 0) >= 7;
      if (!isRoot && user?.tenantId !== tenantId) {
        return forbidden(res, 'Insufficient permissions');
      }

      const locationResults = await db
        .select({
          id: locations.id,
          name: locations.name,
          address: locations.address,
          city: locations.city,
          state: locations.state,
          zipCode: locations.zipCode,
          regionId: locations.regionId,
          regionName: regions.name,
          managerId: locations.locationManagerId,
          isActive: locations.isActive,
        })
        .from(locations)
        .leftJoin(regions, eq(locations.regionId, regions.id))
        .where(eq(locations.tenantId, tenantId))
        .orderBy(locations.name);

      res.json(locationResults);
    } catch (error) {
      log.error('Error fetching locations:', error);
      serverError(res, 'Failed to fetch locations');
    }
  });

  app.get(
    '/api/tenants/:tenantId/regions',

    async (req: any, res) => {
      try {
        const { tenantId } = req.params;
        const userId = getUserId(req);
        if (!userId) {
          return res.status(401).json({ message: 'Not authenticated' });
        }
        const user = await storage.getUserWithRole(userId);

        // Only allow platform admins or users from the same tenant
        if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
          return forbidden(res, 'Insufficient permissions');
        }

        const tenantRegions = await db
          .select({
            id: regions.id,
            name: regions.name,
            description: regions.description,
            locationCount: sql<number>`count(${locations.id})::int`,
          })
          .from(regions)
          .leftJoin(locations, eq(regions.id, locations.regionId))
          .where(eq(regions.tenantId, tenantId))
          .groupBy(regions.id, regions.name, regions.description)
          .orderBy(regions.name);

        res.json(tenantRegions);
      } catch (error) {
        log.error('Error fetching regions:', error);
        serverError(res, 'Failed to fetch regions');
      }
    },
  );

  app.get(
    '/api/tenants/:tenantId/summary',

    async (req: any, res) => {
      try {
        const { tenantId } = req.params;
        const userId = getUserId(req);
        if (!userId) {
          return res.status(401).json({ message: 'Not authenticated' });
        }
        const user = await storage.getUserWithRole(userId);

        // Only allow platform admins or users from the same tenant
        if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
          return forbidden(res, 'Insufficient permissions');
        }

        // Get tenant basic info
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

        if (!tenant) {
          return notFound(res, 'Tenant not found');
        }

        // Get location and employee counts
        const [summary] = await db
          .select({
            locationCount: sql<number>`count(distinct ${locations.id})::int`,
            regionCount: sql<number>`count(distinct ${regions.id})::int`,
            totalEmployees: sql<number>`1::int`, // placeholder for employee count
          })
          .from(locations)
          .leftJoin(regions, eq(locations.regionId, regions.id))
          .where(eq(locations.tenantId, tenantId));

        res.json({
          ...tenant,
          locationCount: summary?.locationCount || 0,
          regionCount: summary?.regionCount || 0,
          totalEmployees: summary?.totalEmployees || 0,
        });
      } catch (error) {
        log.error('Error fetching tenant summary:', error);
        serverError(res, 'Failed to fetch tenant summary');
      }
    },
  );

  // ============= MOBILE SERVICE DASHBOARD ROUTES =============

  // Mobile Service App Routes
  app.get('/api/mobile/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const mobileDashboard = {
        technician: {
          id: req.user.id,
          name: req.user.name,
          employeeId: 'TECH-001',
          certification: 'Senior Technician',
          rating: 4.8,
          completedJobs: 1247,
        },
        todaysSummary: {
          assignedJobs: 6,
          completedJobs: 3,
          inProgress: 1,
          pendingParts: 2,
          totalRevenue: 2340.5,
        },
        jobsQueue: [
          {
            id: 'job-001',
            priority: 'high',
            status: 'assigned',
            customerName: 'Metro Office Solutions',
            contactPerson: 'Sarah Johnson',
            contactPhone: '+1-555-0123',
            address: '123 Business Center Dr, Suite 200',
            coordinates: { lat: 40.7128, lng: -74.006 },
            equipment: {
              model: 'Canon ImageRunner 2535i',
              serialNumber: 'MX-2025-001',
              location: '2nd Floor - Copy Center',
            },
            serviceType: 'maintenance',
            issueDescription: 'Routine preventive maintenance and toner replacement',
            estimatedDuration: 90,
            scheduledTime: new Date('2025-02-04T09:00:00Z'),
            requiredParts: [
              {
                partNumber: 'TNR-2535-BK',
                description: 'Black Toner Cartridge',
                quantity: 1,
                available: true,
              },
            ],
            customerNotes: 'Equipment heavily used, check paper feed mechanism',
            internalNotes: 'Customer prefers morning service calls',
            routeOptimization: {
              driveTime: 15,
              distanceFromPrevious: 3.2,
              trafficConditions: 'light',
              parkingNotes: 'Visitor parking available on 1st floor',
            },
          },
        ],
        performanceMetrics: {
          thisWeek: {
            jobsCompleted: 28,
            averageJobTime: 95,
            customerSatisfaction: 4.7,
            firstTimeFixRate: 89,
            onTimeArrival: 94,
          },
          thisMonth: {
            jobsCompleted: 124,
            revenue: 18450,
            partsUsed: 67,
            milesdriven: 1847,
          },
        },
        partsInventory: {
          vanStock: {
            tonerCartridges: 12,
            maintenanceKits: 6,
            paperFeedRollers: 8,
            fuserUnits: 3,
          },
          pendingOrders: 2,
          criticalLowItems: ['PF-5855-ROLL'],
          lastRestocked: new Date('2025-02-01T00:00:00Z'),
        },
      };

      res.json(mobileDashboard);
    } catch (error) {
      log.error('Error fetching mobile dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch mobile dashboard' });
    }
  });

  app.get('/api/mobile/route-optimization', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const routeData = {
        optimizedRoute: {
          totalDistance: 28.4,
          totalDriveTime: 72,
          totalServiceTime: 390,
          fuelCost: 12.5,
          stops: [
            {
              sequence: 1,
              jobId: 'job-001',
              customerName: 'Metro Office Solutions',
              address: '123 Business Center Dr, Suite 200',
              estimatedArrival: new Date('2025-02-04T09:00:00Z'),
              serviceWindow: { start: '09:00', end: '10:30' },
              drivingTime: 15,
              serviceTime: 90,
              parkingInfo: 'Visitor parking available',
            },
          ],
        },
      };

      res.json(routeData);
    } catch (error) {
      log.error('Error fetching route data:', error);
      res.status(500).json({ message: 'Failed to fetch route data' });
    }
  });

  // GET /api/workflow-automation/dashboard was removed here (PROD-008b). It was
  // the winner of a THREE-way Express registration — this copy, the mock in
  // routes-sample-data.ts, and the unregistered dead router
  // routes-workflow-automation.ts — and all three were shadowed by the
  // /api/workflow-automation proxy, so none of them ever ran.
  // supabase/functions/workflow-automation/ serves the path (PROD-014).

  // CONTRACT TIERED RATES: removed. This file registered a second, identical
  // pair of /api/contract-tiered-rates handlers. registerProductsCrudRoutes runs
  // first (routes-registry.ts), so Express always matched that copy and these
  // were dead — but the products-crud POST gates on
  // PERMISSIONS.FINANCE.BILLING.CONFIGURE and this copy had no permission check
  // at all, so any reordering of registration would have silently dropped the
  // RBAC gate. See server/routes-products-crud.ts and the contract-tiered-rates
  // edge function.

  // ============= WORKFLOW RULES =============

  // Workflow Automation Routes
  app.get('/api/workflow-rules', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Mock workflow rules data for now - would come from database
      const workflowRules = [
        {
          id: '1',
          name: 'Auto-Assign High Priority Tickets',
          description:
            'Automatically assign high priority service tickets to available senior technicians',
          trigger: {
            type: 'service_ticket_created',
            conditions: { priority: 'high' },
          },
          actions: [
            {
              type: 'assign_technician',
              parameters: { skillLevel: 'senior', available: true },
            },
          ],
          isActive: true,
          createdAt: new Date().toISOString(),
          lastTriggered: new Date(Date.now() - 86400000).toISOString(),
          triggerCount: 15,
        },
        {
          id: '2',
          name: 'Contract Expiration Alerts',
          description: 'Send email notifications 30 days before contract expiration',
          trigger: {
            type: 'contract_expiring',
            conditions: { daysUntilExpiration: 30 },
          },
          actions: [
            {
              type: 'send_email',
              parameters: { recipients: ['account_manager', 'customer'] },
            },
          ],
          isActive: true,
          createdAt: new Date().toISOString(),
          lastTriggered: new Date(Date.now() - 432000000).toISOString(),
          triggerCount: 8,
        },
        {
          id: '3',
          name: 'Overdue Payment Reminders',
          description: 'Automatically send payment reminders for overdue invoices',
          trigger: {
            type: 'customer_payment_overdue',
            conditions: { overdueDays: 15 },
          },
          actions: [
            {
              type: 'send_email',
              parameters: { template: 'payment_reminder' },
            },
            {
              type: 'create_task',
              parameters: { assignee: 'account_manager', priority: 'high' },
            },
          ],
          isActive: false,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
        },
      ];

      res.json(workflowRules);
    } catch (error) {
      log.error('Error fetching workflow rules:', error);
      res.status(500).json({ message: 'Failed to fetch workflow rules' });
    }
  });

  app.post('/api/workflow-rules', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const ruleData = {
        id: Date.now().toString(),
        ...req.body,
        tenantId,
        createdAt: new Date().toISOString(),
        triggerCount: 0,
      };

      // Would save to database in real implementation
      res.status(201).json(ruleData);
    } catch (error) {
      log.error('Error creating workflow rule:', error);
      res.status(500).json({ message: 'Failed to create workflow rule' });
    }
  });

  app.patch('/api/workflow-rules/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Would update in database in real implementation
      res.json({ id, ...updates });
    } catch (error) {
      log.error('Error updating workflow rule:', error);
      res.status(500).json({ message: 'Failed to update workflow rule' });
    }
  });

  app.delete('/api/workflow-rules/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      // Would delete from database in real implementation
      res.status(204).send();
    } catch (error) {
      log.error('Error deleting workflow rule:', error);
      res.status(500).json({ message: 'Failed to delete workflow rule' });
    }
  });

  // ============= USERS API =============

  // Users API for owner lookup
  // GET /api/users was removed here (PROD-008b). supabase/functions/users/ serves
  // it, returning the active tenant users with camelCase keys and a derived
  // `name`.

  // ============= DEAL MANAGEMENT ROUTES =============

  // Get all deals with optional filtering
  // ── /api/deals: RETIRED (PROD-008b) ───────────────────────────────────────
  //
  // GET /api/deals, PUT /api/deals/:id/stage and the two /:id/activities
  // handlers lived here, alongside GET/POST /:id and POST from routes-deals.ts.
  // /api/deals is proxied to supabase/functions/deals, which covers all of
  // them, so none ran on either host.
  //
  // The stage handler was the last thing keeping this cluster: it held the only
  // deal.stage_changed dispatch, and deleting it would have removed the seam
  // rather than the duplicate. CRMX-008a ported that into the edge function's
  // PATCH/PUT branch first.
  //
  // /api/deal-stages below is NOT proxied and still runs here.

  /**
   * NOTE: The following routes have been migrated to routes-deals.ts:
   * - GET /api/deals/:id
   * - POST /api/deals
   * - PUT /api/deals/:id
   *
   * See server/routes-deals.ts (Migrated 2/225 routes)
   */

  // Update deal stage (for drag and drop)

  // Deal Stages Routes

  // Get all deal stages for tenant
  app.get('/api/deal-stages', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const stages = await storage.getDealStages(tenantId);
      res.json(stages);
    } catch (error) {
      log.error('Error fetching deal stages:', error);
      res.status(500).json({ message: 'Failed to fetch deal stages' });
    }
  });

  // Create deal stage
  app.post('/api/deal-stages', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const stageData = insertDealStageSchema.parse({
        ...req.body,
        tenantId,
      });

      const stage = await storage.createDealStage(stageData);
      res.status(201).json(stage);
    } catch (error) {
      log.error('Error creating deal stage:', error);
      res.status(500).json({ message: 'Failed to create deal stage' });
    }
  });

  // Initialize default deal stages for a tenant (called on first access)
  app.post(
    '/api/deal-stages/initialize',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        // Check if stages already exist
        const existingStages = await storage.getDealStages(tenantId);
        if (existingStages.length > 0) {
          return res.json({
            message: 'Deal stages already initialized',
            stages: existingStages,
          });
        }

        // Create default stages
        const defaultStages = [
          {
            name: 'Appointment Scheduled',
            color: '#3B82F6',
            sortOrder: 1,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: 'Qualified to Buy',
            color: '#8B5CF6',
            sortOrder: 2,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: 'Presentation Scheduled',
            color: '#06B6D4',
            sortOrder: 3,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: 'Decision Maker Bought-In',
            color: '#F59E0B',
            sortOrder: 4,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: 'Contract Sent',
            color: '#EF4444',
            sortOrder: 5,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: 'Closed Won',
            color: '#10B981',
            sortOrder: 6,
            isClosingStage: true,
            isWonStage: true,
          },
          {
            name: 'Closed Lost',
            color: '#6B7280',
            sortOrder: 7,
            isClosingStage: true,
            isWonStage: false,
          },
        ];

        const createdStages = [];
        for (const stage of defaultStages) {
          const stageData = insertDealStageSchema.parse({
            ...stage,
            tenantId,
            isActive: true,
          });
          const newStage = await storage.createDealStage(stageData);
          createdStages.push(newStage);
        }

        res.status(201).json({ message: 'Deal stages initialized', stages: createdStages });
      } catch (error) {
        log.error('Error initializing deal stages:', error);
        res.status(500).json({ message: 'Failed to initialize deal stages' });
      }
    },
  );

  // Deal Activities Routes

  // Get activities for a deal

  // Create deal activity

  // ============= CUSTOMER DETAIL ROUTES =============

  // Customer detail routes - for comprehensive customer information
  app.get(
    '/api/customers/:id/equipment',

    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const equipment = await storage.getCustomerEquipment(
          req.params.id as string,
          req.tenantId as string,
        );
        res.json(equipment);
      } catch (error) {
        log.error('Error fetching customer equipment:', error);
        res.status(500).json({ message: 'Failed to fetch customer equipment' });
      }
    },
  );

  app.get(
    '/api/customers/:id/meter-readings',

    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const meterReadingsResult = await storage.getCustomerMeterReadings(
          req.params.id as string,
          req.tenantId as string,
        );
        res.json(meterReadingsResult);
      } catch (error) {
        log.error('Error fetching customer meter readings:', error);
        res.status(500).json({ message: 'Failed to fetch customer meter readings' });
      }
    },
  );

  app.get(
    '/api/customers/:id/invoices',

    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const invoices = await storage.getCustomerInvoices(
          req.params.id as string,
          req.tenantId as string,
        );
        res.json(invoices);
      } catch (error) {
        log.error('Error fetching customer invoices:', error);
        res.status(500).json({ message: 'Failed to fetch customer invoices' });
      }
    },
  );

  app.get(
    '/api/customers/:id/service-tickets',

    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const serviceTickets = await storage.getCustomerServiceTickets(
          req.params.id as string,
          req.tenantId as string,
        );
        res.json(serviceTickets);
      } catch (error) {
        log.error('Error fetching customer service tickets:', error);
        res.status(500).json({ message: 'Failed to fetch customer service tickets' });
      }
    },
  );

  app.get(
    '/api/customers/:id/contracts',

    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const contracts = await storage.getCustomerContracts(
          req.params.id as string,
          req.tenantId as string,
        );
        res.json(contracts);
      } catch (error) {
        log.error('Error fetching customer contracts:', error);
        res.status(500).json({ message: 'Failed to fetch customer contracts' });
      }
    },
  );

  // ============= CONTRACT ROUTES - RETIRED (PROD-008) =============
  //
  // GET and POST /api/contracts used to live here. registerEdgeFunctionProxy
  // runs before this file's registration, and now forwards the whole
  // /api/contracts prefix to supabase/functions/contracts - which is what
  // production has always hit directly.
  //
  // The two implementations disagreed in the way that breaks pages rather than
  // the way that shows up in review: storage.getContracts returned a bare array
  // of camelCase Drizzle rows, while the edge function returns
  // { data, total, page, limit } of snake_case PostgREST rows. contracts.tsx and
  // MeterReadings.tsx both did `(response || []).map(...)`, which is a TypeError
  // against that envelope, and every page that read contractNumber/customerId/
  // startDate/endDate off the camelCase key rendered them blank in production.
  //
  // The edge function is a superset - it also serves /:id, /:id/tiered-rates,
  // PATCH and DELETE - and its POST accepts exactly the payload contracts.tsx
  // sends.

  // ============= MOBILE SERVICE APP ROUTES =============
  //
  // The nine /api/mobile handlers that stood here are DELETED (CR-017). Every
  // one queried mobile_work_orders, mobile_field_orders, mobile_parts_inventory,
  // mobile_order_line_items or mobile_app_sessions - five tables that exist in
  // no Drizzle schema and no migration - so each was a permanent 500 in dev and
  // production never ran them at all (getApiUrl sends /api/mobile straight to
  // supabase/functions/mobile/, which serves photos, sessions and sync). The
  // table names were inside raw SQL template literals, which is why tsc and
  // check:phantom-cols both saw nothing.
  //
  // Eight had no caller in any of the seven client trees. The ninth,
  // GET /api/mobile/metrics, backs MobileOptimization.tsx and is recorded on
  // AUDIT-033 with /api/mobile/devices, which exists on no host either.
  //
  // POST /api/mobile/sync deserves naming separately: it was not a sync. It
  // looped over users whose role matched '%technician%' and INSERTed a
  // fabricated GPS position for each - 40.7128 + Math.random() * 0.1, a point in
  // New York, with a random 80-100% battery level - into technician_locations,
  // which is a REAL table, then answered "Mobile data sync completed" with a
  // count. A seeder wearing an endpoint's name, writing invented telemetry into
  // production data. It also selected users.name, a column that table does not
  // have, so it would have thrown before writing anything.

  // ============= WORKFLOW AUTOMATION ROUTES =============

  // The six /api/automation handlers that stood here are DELETED (CR-017).
  //
  // The prefix is dead on every host: server/routes-automation.ts was deleted
  // last round (its automation_rules and automated_tasks tables exist nowhere),
  // supabase/functions/automation/ reads the same two phantom tables and is
  // baselined in docs/phantom-tables-baseline.json, and nothing in client/src
  // references /api/automation at all.
  //
  // These six were the least-broken part of it - metrics, workflow-templates
  // (list, create, execute) and workflow-executions (list, action) do read REAL
  // tables (workflow_templates, workflow_executions, both migration-only). They
  // are removed anyway because they are unreachable: the live workflow surface
  // is /api/workflow-automation/*, which is proxied to
  // supabase/functions/workflow-automation/, and the durable runtime lives in
  // server/routes/workflow-automation-routes.ts. Two more implementations of
  // "run a workflow" on a prefix nobody calls is how the CRMX-008 trigger seams
  // ended up in code that could not run.

  // ============= MOBILE FIELD OPERATIONS ROUTES =============
  //
  // The seven /api/mobile-field handlers that stood here are DELETED (CR-017).
  // They read field_technicians, field_work_orders and voice_notes - three more
  // tables that exist nowhere - so MobileFieldOperations.tsx, which is routed at
  // /mobile-field-operations and calls all four of these paths, has never
  // loaded: 500 in dev, 404 in production. Its metrics handler also ended with
  // `SELECT 95.5 as gps_accuracy`, commented "Mock GPS accuracy metric".
  //
  // supabase/functions/mobile-field/ serves a DIFFERENT surface on the same
  // prefix - my-tickets, today, check-in, check-out, log-time, parts-inventory,
  // request-parts, add-note, update-status, over service_tickets,
  // time_tracking_entries, mobile_service_sessions and ticket_notes. That is a
  // technician's own view; this page is a dispatcher's. Whether the page is
  // rebuilt on those tables, folded into /technician-management (which works,
  // over the real technicians table), or retired is AUDIT-033 - a decision, not
  // a port, which is why nothing here was rewritten to keep it rendering.

  // ============= EQUIPMENT TRIGGER SERVICE =============

  // Equipment Lifecycle Integration with Service Workflows
  app.post('/api/equipment/:equipmentId/trigger-service', async (req: any, res) => {
    try {
      const { tenantId, id: userId } = req.user;
      const { equipmentId } = req.params;
      const { serviceType, priority = 'medium', description } = req.body;

      // AUDIT-007: was `getEquipment(tenantId).find(e => e.id === equipmentId)` —
      // the tenant's ENTIRE equipment table pulled across the wire to pick one row,
      // on a primary-key lookup. Now a single tenant-scoped SELECT ... LIMIT 1.
      const equipmentItem = await storage.getEquipmentById(equipmentId, tenantId);
      if (!equipmentItem) {
        return res.status(404).json({ message: 'Equipment not found' });
      }

      // Auto-create service ticket
      const serviceTicket = await storage.createServiceTicket({
        tenantId,
        customerId: (equipmentItem as any).customerId,
        equipmentId,
        ticketNumber: `TKT-${Date.now()}`,
        title: `${serviceType} Service Required`,
        description:
          description ||
          `Automated ${serviceType} service request for ${String(
            (equipmentItem as any).model || 'equipment',
          )}`,
        priority,
        status: 'open',
        createdBy: userId,
      } as any);

      // Update equipment status if needed
      if (serviceType === 'maintenance') {
        // Note: storage.updateEquipment doesn't exist; skip for now
      }

      // Create or update equipment lifecycle event
      try {
        await db
          .insert(equipmentLifecycle)
          .values({
            tenantId,
            equipmentId,
            serialNumber: equipmentItem.serialNumber || `SN-${equipmentId}`,
            currentStage: 'active',
            currentLocation: (equipmentItem as any).location || 'customer_site',
            customerId: equipmentItem.customerId,
            lastServiceDate: new Date(),
          })
          .onConflictDoUpdate({
            target: equipmentLifecycle.equipmentId,
            set: {
              lastServiceDate: new Date(),
              updatedAt: new Date(),
            },
          });
      } catch (lifecycleError) {
        // If equipment lifecycle doesn't exist, try to create it
        log.warn('Equipment lifecycle insert failed, continuing with service ticket creation');
      }

      res.json({
        serviceTicket,
        message: 'Service request created and equipment lifecycle updated',
      });
    } catch (error) {
      log.error('Error triggering equipment service:', error);
      res.status(500).json({ message: 'Failed to trigger equipment service' });
    }
  });

  // ============= CONTRACT BILLING AUTOMATION =============
  //
  // UNREACHABLE, AND ALREADY WAS (PROD-008). This sits under /api/contracts,
  // which is now proxied to the contracts edge function, so the proxy claims it
  // in dev. That is not a regression: production has never reached Express at
  // all (the frontend rewrites /api/x to functions.printyx.net/x), so this
  // endpoint has been a 404 in production since it was written.
  //
  // It is kept rather than deleted because it is real, previously-repaired
  // billing logic (AUDIT-008 fixed an invoice-number template that made it
  // impossible to bill more than one reading, and collapsed an N-cycle
  // read-modify-write on the customer balance) and nothing else implements it.
  // Nothing calls it either - a repo-wide search for the path finds only this
  // definition, the AUDIT-008 notes and a doc.
  //
  // Porting it is its own story: it spans four tables and needs the invoice
  // insert and the meter-reading update to be atomic, which PostgREST cannot
  // express - that requires a database function.

  // Contract Billing Automation Connected to Meter Readings
  app.post(
    '/api/contracts/:contractId/process-meter-billing',

    async (req: any, res) => {
      try {
        const { tenantId } = req.user;
        const { contractId } = req.params;

        // Get contract details
        const contract = await storage.getContract(contractId, tenantId);
        if (!contract) {
          return res.status(404).json({ message: 'Contract not found' });
        }

        // Get unprocessed meter readings for this contract
        const unprocessedReadings = await db
          .select()
          .from(meterReadings)
          .where(
            and(
              eq(meterReadings.contractId, contractId),
              eq(meterReadings.tenantId, tenantId),
              eq(meterReadings.billingStatus, 'pending'),
            ),
          )
          .orderBy(desc(meterReadings.readingDate));

        const processedInvoices = [];

        // AUDIT-008: hoisted out of the loop — contractId is fixed for this whole
        // endpoint, so re-fetching the tiered rates per reading was N identical
        // queries returning identical rows.
        const tieredRates = await storage.getContractTieredRatesByContract(contractId);

        // AUDIT-008: the customer is loop-invariant too. The old code re-read
        // currentBalance and wrote it back on EVERY reading — N sequential
        // read-modify-write cycles on the same row. Beyond being slow that is a race
        // hazard: any concurrent balance write between a read and its write is lost.
        // Read once, sum locally, apply ONE update after the loop.
        const customer = await storage.getBusinessRecord(contract.customerId, tenantId);
        const startingBalance = parseFloat(String(customer?.currentBalance || '0'));
        let billedTotal = 0;

        for (const reading of unprocessedReadings) {
          let totalAmount = parseFloat(contract.monthlyBase?.toString() || '0');

          // Calculate black & white copies billing
          if (reading.blackCopies && reading.blackCopies > 0) {
            const blackRates = tieredRates
              .filter((rate) => rate.colorType === 'black')
              .sort((a, b) => a.minimumVolume - b.minimumVolume);
            totalAmount += calculateTieredAmount(
              reading.blackCopies,
              blackRates,
              parseFloat(contract.blackRate?.toString() || '0'),
            );
          }

          // Calculate color copies billing
          if (reading.colorCopies && reading.colorCopies > 0) {
            const colorRates = tieredRates
              .filter((rate) => rate.colorType === 'color')
              .sort((a, b) => a.minimumVolume - b.minimumVolume);
            totalAmount += calculateTieredAmount(
              Number(reading.colorCopies || 0),
              colorRates,
              parseFloat(contract.colorRate?.toString() || '0'),
            );
          }

          // Create invoice
          const invoice = await storage.createInvoice({
            tenantId: String(tenantId),
            customerId: String(contract.customerId),
            contractId: contract?.id ? String(contract.id) : null,
            // AUDIT-008: this template literal was BROKEN — a line break sat between
            // the dollar sign and the opening brace, so the Date.now() placeholder
            // never interpolated and every invoice got the SAME literal string
            // (ending in a dollar sign, a newline, then the un-interpolated
            // placeholder text). invoice_number is UNIQUE, so the SECOND reading for
            // a contract always violated the constraint and 500'd this endpoint —
            // this path could never bill more than one reading. The trailing index
            // also guarantees uniqueness within a run (Date.now() can repeat).
            invoiceNumber: `INV-${String(contract.contractNumber || 'CON')}-${Date.now()}-${processedInvoices.length}`,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            totalAmount: String(totalAmount),
            amountPaid: '0',
            balanceDue: String(totalAmount),
            invoiceStatus: 'open',
            paymentTerms: 'Net 30',
            invoiceNotes: `Automated meter billing for ${format(
              new Date(reading.readingDate),
              'MMMM yyyy',
            )}`,
            createdBy: String((req as any).user?.id || 'system'),
          } as any);

          // Update meter reading as processed
          await storage.updateMeterReading(
            reading.id,
            {
              billingStatus: 'processed',
              billingAmount: totalAmount.toString(),
              invoiceId: invoice.id,
            },
            tenantId,
          );

          processedInvoices.push(invoice);
          billedTotal += totalAmount;
        }

        // AUDIT-008: one balance update for the whole run instead of N. The final
        // state is identical to the old loop (starting balance + the sum of every
        // invoice), and lastMeterReadingDate still lands on the last reading
        // processed — readings are ordered by readingDate DESC, so that is the
        // OLDEST, exactly as before.
        if (processedInvoices.length > 0) {
          await storage.updateBusinessRecord(contract.customerId, tenantId, {
            currentBalance: (startingBalance + billedTotal).toString(),
            lastMeterReadingDate: unprocessedReadings[unprocessedReadings.length - 1].readingDate,
          });
        }

        res.json({
          message: `Processed ${processedInvoices.length} meter readings for billing`,
          invoices: processedInvoices,
          totalAmount: processedInvoices.reduce(
            (sum, inv) => sum + parseFloat(String(inv.totalAmount || '0')),
            0,
          ),
        });
      } catch (error) {
        log.error('Error processing meter billing:', error);
        res.status(500).json({ message: 'Failed to process meter billing' });
      }
    },
  );
}
