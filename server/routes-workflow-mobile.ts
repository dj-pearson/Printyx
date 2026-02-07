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
  insertDealActivitySchema,
  insertContractTieredRateSchema,
  businessRecords,
  locations,
  regions,
  tenants,
  meterReadings,
} from '@shared/schema';
import { equipmentLifecycle } from '../shared/equipment-schema';
import { and, eq, sql, desc } from 'drizzle-orm';

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
        return res.status(403).json({ error: 'Insufficient permissions' });
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
      res.status(500).json({ error: 'Failed to fetch locations' });
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
          return res.status(403).json({ error: 'Insufficient permissions' });
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
        res.status(500).json({ error: 'Failed to fetch regions' });
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
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Get tenant basic info
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
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
        res.status(500).json({ error: 'Failed to fetch tenant summary' });
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

  // ============= ADVANCED WORKFLOW AUTOMATION DASHBOARD =============

  // Advanced Workflow Automation Routes
  app.get('/api/workflow-automation/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const workflowAutomationData = {
        automationOverview: {
          totalWorkflows: 89,
          activeWorkflows: 76,
          pausedWorkflows: 8,
          failedWorkflows: 5,
          successRate: 94.7,
          executionsToday: 15672,
          timeSaved: 847.3,
          errorRate: 2.1,
          averageExecutionTime: 234,
          automationCoverage: 78.4,
          lastExecution: new Date('2025-02-01T08:45:00Z'),
        },
        activeWorkflows: [
          {
            id: 'wf-001',
            name: 'Customer Onboarding Automation',
            category: 'Customer Management',
            status: 'active',
            trigger: 'customer_created',
            priority: 'high',
            version: '2.1.0',
            createdAt: new Date('2024-12-15T00:00:00Z'),
            lastModified: new Date('2025-01-28T00:00:00Z'),
            lastExecution: new Date('2025-02-01T08:30:00Z'),
            executionCount: 2456,
            successRate: 96.8,
            averageExecutionTime: 1245,
            estimatedTimeSaved: 45.7,
            steps: [
              {
                id: 'step-001',
                name: 'Send Welcome Email',
                type: 'email',
                status: 'active',
                config: {},
                successRate: 98.9,
                avgExecutionTime: 234,
              },
              {
                id: 'step-002',
                name: 'Create Initial Service Ticket',
                type: 'service_ticket',
                status: 'active',
                config: {},
                successRate: 97.2,
                avgExecutionTime: 456,
              },
            ],
            triggers: [
              {
                type: 'event',
                event: 'customer_created',
                conditions: [
                  {
                    field: 'customer_type',
                    operator: 'equals',
                    value: 'business',
                  },
                ],
              },
            ],
            metrics: {
              totalExecutions: 2456,
              successfulExecutions: 2378,
              failedExecutions: 78,
              costSavings: 12400,
            },
          },
        ],
        workflowTemplates: [
          {
            id: 'template-001',
            name: 'Customer Communication Sequence',
            category: 'Customer Management',
            description: 'Automated communication workflow for customer lifecycle management',
            popularity: 87.5,
            installations: 234,
            rating: 4.8,
            complexity: 'beginner',
            estimatedSetupTime: 30,
            features: ['Multi-channel communication', 'Personalization engine'],
            steps: ['Initial contact', 'Follow-up sequence'],
            integrations: ['email', 'sms', 'crm'],
          },
        ],
        rulesEngine: {
          totalRules: 234,
          activeRules: 198,
          ruleCategories: [{ category: 'Customer Management', count: 67, performance: 96.2 }],
          rules: [
            {
              id: 'rule-001',
              name: 'High-Value Customer Priority',
              category: 'Customer Management',
              status: 'active',
              priority: 'high',
              description: 'Automatically prioritize service tickets for high-value customers',
              trigger: 'service_ticket_created',
              conditions: [
                {
                  field: 'customer_value',
                  operator: 'greater_than',
                  value: 50000,
                },
              ],
              actions: [{ type: 'set_priority', value: 'urgent' }],
              executionCount: 1245,
              successRate: 97.8,
              lastExecuted: new Date('2025-02-01T07:45:00Z'),
            },
          ],
        },
        performanceAnalytics: {
          executionTrends: [{ date: '2025-02-01', executions: 15672, successRate: 94.7 }],
          topPerformingWorkflows: [
            {
              name: 'Invoice Processing Automation',
              successRate: 99.1,
              executions: 4567,
              timeSaved: 156.8,
            },
          ],
          errorAnalysis: [
            {
              errorType: 'Integration Timeout',
              count: 234,
              percentage: 34.5,
              trend: 'decreasing',
            },
          ],
          businessImpact: {
            totalTimeSaved: 847.3,
            totalCostSavings: 234500,
            errorReduction: 67.8,
            customerSatisfactionIncrease: 23.4,
            processEfficiencyGain: 45.7,
          },
        },
      };

      res.json(workflowAutomationData);
    } catch (error) {
      log.error('Error fetching workflow automation dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch workflow automation dashboard' });
    }
  });

  // ============= CONTRACT TIERED RATES =============

  // Contract Tiered Rates Management
  app.get('/api/contract-tiered-rates', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const rates = await storage.getContractTieredRates(tenantId);
      res.json(rates);
    } catch (error) {
      log.error('Error fetching contract tiered rates:', error);
      res.status(500).json({ message: 'Failed to fetch contract tiered rates' });
    }
  });

  app.post('/api/contract-tiered-rates', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const validatedData = insertContractTieredRateSchema.parse({
        ...req.body,
        tenantId,
      });
      const rate = await storage.createContractTieredRate(validatedData);
      res.json(rate);
    } catch (error) {
      log.error('Error creating contract tiered rate:', error);
      res.status(500).json({ message: 'Failed to create contract tiered rate' });
    }
  });

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
  app.get('/api/users', async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const result = await storage.getUsers(user.tenantId);
      res.json(result);
    } catch (error) {
      log.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // ============= DEAL MANAGEMENT ROUTES =============

  // Get all deals with optional filtering
  app.get('/api/deals', async (req: any, res) => {
    // Authentication check using unified auth helpers
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user?.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    try {
      const tenantId = user.tenantId;
      const stageId = String((req.query as any)?.stageId || '');
      const search = String((req.query as any)?.search || '');
      const leadId = String((req.query as any)?.leadId || '');

      const deals = await storage.getDeals(tenantId, stageId, search, leadId);
      res.json(deals);
    } catch (error) {
      log.error('Error fetching deals:', error);
      res.status(500).json({ message: 'Failed to fetch deals' });
    }
  });

  /**
   * NOTE: The following routes have been migrated to routes-deals.ts:
   * - GET /api/deals/:id
   * - POST /api/deals
   * - PUT /api/deals/:id
   *
   * See server/routes-deals.ts (Migrated 2/225 routes)
   */

  // Update deal stage (for drag and drop)
  app.put('/api/deals/:id/stage', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;
      const { stageId } = req.body;

      const deal = await storage.updateDealStage(dealId, stageId, tenantId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      res.json(deal);
    } catch (error) {
      log.error('Error updating deal stage:', error);
      res.status(500).json({ message: 'Failed to update deal stage' });
    }
  });

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
  app.get(
    '/api/deals/:id/activities',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const dealId = req.params.id;

        const activities = await storage.getDealActivities(dealId, tenantId);
        res.json(activities);
      } catch (error) {
        log.error('Error fetching deal activities:', error);
        res.status(500).json({ message: 'Failed to fetch deal activities' });
      }
    },
  );

  // Create deal activity
  app.post(
    '/api/deals/:id/activities',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const dealId = req.params.id;
        const userId = req.user.id;

        const activityData = insertDealActivitySchema.parse({
          ...req.body,
          tenantId,
          dealId,
          userId,
        });

        const activity = await storage.createDealActivity(activityData);
        res.status(201).json(activity);
      } catch (error) {
        log.error('Error creating deal activity:', error);
        res.status(500).json({ message: 'Failed to create deal activity' });
      }
    },
  );

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

  // ============= CONTRACT ROUTES =============

  // Contract routes
  app.get('/api/contracts', requireTenant, async (req: TenantRequest, res) => {
    try {
      const contracts = await storage.getContracts(req.tenantId!);
      res.json(contracts);
    } catch (error) {
      log.error('Error fetching contracts:', error);
      res.status(500).json({ message: 'Failed to fetch contracts' });
    }
  });

  app.post('/api/contracts', requireTenant, async (req: TenantRequest, res) => {
    try {
      const session = req.session as any;
      const userId = session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Generate contract number if not provided
      const contractNumber = req.body.contractNumber || `CNT-${Date.now()}`;

      // Ensure we have a customerId
      if (!req.body.customerId) {
        return res.status(400).json({ message: 'Customer ID is required' });
      }

      // Prepare contract data with only existing database columns
      const contractData = {
        customerId: req.body.customerId,
        tenantId: req.tenantId!,
        contractNumber,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        blackRate: req.body.blackRate ? String(req.body.blackRate) : null,
        colorRate: req.body.colorRate ? String(req.body.colorRate) : null,
        monthlyBase: req.body.monthlyBase ? String(req.body.monthlyBase) : null,
        status: req.body.status || 'active',
      };

      log.info('Creating contract with data:', JSON.stringify(contractData, null, 2));

      // Convert date strings to Date objects if they exist
      if (contractData.startDate && typeof contractData.startDate === 'string') {
        contractData.startDate = new Date(contractData.startDate);
      }
      if (contractData.endDate && typeof contractData.endDate === 'string') {
        contractData.endDate = new Date(contractData.endDate);
      }

      const newContract = await storage.createContract(contractData);
      res.status(201).json(newContract);
    } catch (error) {
      log.error('Error creating contract:', error);
      res.status(500).json({ message: 'Failed to create contract' });
    }
  });

  // ============= MOBILE SERVICE APP ROUTES =============

  // Get mobile app metrics
  app.get('/api/mobile/metrics', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const queries = [
        `SELECT COUNT(*) as active_work_orders FROM mobile_work_orders WHERE tenant_id = $1 AND status IN ('assigned', 'en_route', 'on_site', 'in_progress')`,
        `SELECT COUNT(DISTINCT technician_id) as technicians_in_field FROM technician_locations WHERE tenant_id = $1 AND recorded_at > NOW() - INTERVAL '1 hour'`,
        `SELECT COUNT(*) as pending_parts_orders FROM mobile_field_orders WHERE tenant_id = $1 AND status IN ('submitted', 'approved', 'processing')`,
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (arrival_time - created_at))/60), 0) as avg_response_time FROM mobile_work_orders WHERE tenant_id = $1 AND arrival_time IS NOT NULL`,
        `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as completion_rate FROM mobile_work_orders WHERE tenant_id = $1`,
        `SELECT COALESCE(AVG(customer_satisfaction_rating), 0) as customer_satisfaction FROM mobile_work_orders WHERE tenant_id = $1 AND customer_satisfaction_rating IS NOT NULL`,
      ];

      const results = await Promise.all(
        queries.map((query) => db.$client.query(query, [tenantId])),
      );

      res.json({
        activeWorkOrders: parseInt(results[0].rows[0].active_work_orders),
        techniciansInField: parseInt(results[1].rows[0].technicians_in_field),
        pendingPartsOrders: parseInt(results[2].rows[0].pending_parts_orders),
        averageResponseTime: parseFloat(results[3].rows[0].avg_response_time),
        completionRate: parseFloat(results[4].rows[0].completion_rate),
        customerSatisfaction: parseFloat(results[5].rows[0].customer_satisfaction),
      });
    } catch (error) {
      log.error('Error fetching mobile metrics:', error);
      res.status(500).json({ error: 'Failed to fetch mobile metrics' });
    }
  });

  // Get mobile work orders
  app.get(
    '/api/mobile/work-orders',

    async (req: any, res) => {
      try {
        const status = String((req.query as any)?.status || '');
        const priority = String((req.query as any)?.priority || '');
        const technician = String((req.query as any)?.technician || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['mwo.tenantId = $1'];
        const queryParams = [tenantId];

        if (status && status !== 'all') {
          whereConditions.push(`mwo.status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        if (priority && priority !== 'all') {
          whereConditions.push(`mwo.priority = $${queryParams.length + 1}`);
          queryParams.push(priority);
        }

        if (technician && technician !== 'all') {
          whereConditions.push(`mwo.assigned_technician_id = $${queryParams.length + 1}`);
          queryParams.push(technician);
        }

        const query = `
        SELECT
          mwo.*,
          br.companyName as customer_name,
          u.name as assigned_technician_name
        FROM mobile_work_orders mwo
        LEFT JOIN business_records br ON mwo.business_record_id = br.id
        LEFT JOIN users u ON mwo.assigned_technician_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY mwo.createdAt DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching mobile work orders:', error);
        res.status(500).json({ error: 'Failed to fetch mobile work orders' });
      }
    },
  );

  // Create mobile work order
  app.post(
    '/api/mobile/work-orders',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          work_order_type,
          priority,
          customer_id,
          service_address,
          assigned_technician_id,
          problem_description,
          scheduled_date,
          scheduled_time_start,
          estimated_duration_hours,
          site_contact_name,
          site_contact_phone,
          access_instructions,
        } = req.body;

        const workOrderNumber = `WO-${Date.now()}`;

        const query = `
        INSERT INTO mobile_work_orders (
          tenant_id, work_order_number, work_order_type, priority, customer_id,
          business_record_id, service_address, assigned_technician_id, problem_description,
          scheduled_date, scheduled_time_start, estimated_duration_hours,
          site_contact_name, site_contact_phone, access_instructions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          workOrderNumber,
          work_order_type,
          priority,
          customer_id,
          customer_id,
          service_address,
          assigned_technician_id,
          problem_description,
          scheduled_date,
          scheduled_time_start,
          estimated_duration_hours,
          site_contact_name,
          site_contact_phone,
          access_instructions,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating mobile work order:', error);
        res.status(500).json({ error: 'Failed to create mobile work order' });
      }
    },
  );

  // Get mobile parts inventory
  app.get(
    '/api/mobile/parts-inventory',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT *
        FROM mobile_parts_inventory
        WHERE tenant_id = $1 AND is_active = true
        ORDER BY commonly_used DESC, part_name ASC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching mobile parts inventory:', error);
        res.status(500).json({ error: 'Failed to fetch mobile parts inventory' });
      }
    },
  );

  // Get mobile field orders
  app.get(
    '/api/mobile/field-orders',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          mfo.*,
          u.name as technician_name,
          (SELECT COUNT(*) FROM mobile_order_line_items WHERE field_order_id = mfo.id) as line_items_count
        FROM mobile_field_orders mfo
        LEFT JOIN users u ON mfo.technician_id = u.id
        WHERE mfo.tenantId = $1
        ORDER BY mfo.createdAt DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching mobile field orders:', error);
        res.status(500).json({ error: 'Failed to fetch mobile field orders' });
      }
    },
  );

  // Create mobile field order
  app.post(
    '/api/mobile/field-orders',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          order_type,
          technician_id,
          work_order_id,
          delivery_method,
          urgency,
          delivery_address,
          requested_delivery_date,
          parts,
        } = req.body;

        const orderNumber = `FO-${Date.now()}`;
        const orderDate = new Date().toISOString().split('T')[0];

        // Calculate total
        let subtotal = 0;
        // For demo purposes, use sample pricing
        subtotal = parts.length * 50; // Sample pricing
        const taxAmount = subtotal * 0.085;
        const totalAmount = subtotal + taxAmount;

        const query = `
        INSERT INTO mobile_field_orders (
          tenant_id, order_number, order_type, technician_id, work_order_id,
          delivery_method, urgency, delivery_address, requested_delivery_date,
          order_date, subtotal, tax_amount, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          orderNumber,
          order_type,
          technician_id,
          work_order_id,
          delivery_method,
          urgency,
          delivery_address,
          requested_delivery_date,
          orderDate,
          subtotal,
          taxAmount,
          totalAmount,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating mobile field order:', error);
        res.status(500).json({ error: 'Failed to create mobile field order' });
      }
    },
  );

  // Get technician locations
  app.get(
    '/api/mobile/technician-locations',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          tl.*,
          u.name as technician_name,
          mwo.work_order_number,
          br.companyName as customer_name
        FROM technician_locations tl
        LEFT JOIN users u ON tl.technician_id = u.id
        LEFT JOIN mobile_work_orders mwo ON tl.work_order_id = mwo.id
        LEFT JOIN business_records br ON tl.customerId = br.id
        WHERE tl.tenantId = $1
        ORDER BY tl.recorded_at DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching technician locations:', error);
        res.status(500).json({ error: 'Failed to fetch technician locations' });
      }
    },
  );

  // Get mobile app sessions
  app.get(
    '/api/mobile/app-sessions',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          mas.*,
          u.name as technician_name
        FROM mobile_app_sessions mas
        LEFT JOIN users u ON mas.technician_id = u.id
        WHERE mas.tenantId = $1
        ORDER BY mas.session_start DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching mobile app sessions:', error);
        res.status(500).json({ error: 'Failed to fetch mobile app sessions' });
      }
    },
  );

  // Sync mobile data
  app.post('/api/mobile/sync', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Get active technicians
      const techniciansQuery = `SELECT id, name FROM users WHERE tenant_id = $1 AND role LIKE '%technician%'`;
      const techniciansResult = await db.$client.query(techniciansQuery, [tenantId]);
      const technicians = techniciansResult.rows;

      let syncedRecords = 0;

      // Create sample technician locations
      for (const tech of technicians) {
        const locationQuery = `
          INSERT INTO technician_locations (
            tenant_id, technician_id, recorded_at, latitude, longitude,
            location_type, device_battery_level
          ) VALUES ($1, $2, NOW(), $3, $4, $5, $6)
        `;

        await db.$client.query(locationQuery, [
          tenantId,
          tech.id,
          40.7128 + (Math.random() - 0.5) * 0.1, // NYC area
          -74.006 + (Math.random() - 0.5) * 0.1,
          'customer_site',
          80 + Math.floor(Math.random() * 20), // 80-100% battery
        ]);

        syncedRecords++;
      }

      res.status(200).json({
        message: 'Mobile data sync completed',
        synced_records: syncedRecords,
      });
    } catch (error) {
      log.error('Error syncing mobile data:', error);
      res.status(500).json({ error: 'Failed to sync mobile data' });
    }
  });

  // ============= WORKFLOW AUTOMATION ROUTES =============

  // Get automation metrics
  app.get(
    '/api/automation/metrics',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as active_workflows FROM workflow_executions WHERE tenant_id = $1 AND status IN ('running', 'pending')`,
          `SELECT COUNT(*) as pending_tasks FROM automated_tasks WHERE tenant_id = $1 AND status = 'pending'`,
          `SELECT COUNT(*) as automation_rules FROM automation_rules WHERE tenant_id = $1 AND is_active = true`,
          `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as success_rate FROM workflow_executions WHERE tenant_id = $1`,
          `SELECT COALESCE(SUM(actual_duration_minutes), 0) as time_saved FROM automated_tasks WHERE tenant_id = $1 AND status = 'completed'`,
          `SELECT COUNT(*) as tasks_automated FROM automated_tasks WHERE tenant_id = $1 AND automation_trigger IS NOT NULL`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId])),
        );

        res.json({
          activeWorkflows: parseInt(results[0].rows[0].active_workflows),
          pendingTasks: parseInt(results[1].rows[0].pending_tasks),
          automationRules: parseInt(results[2].rows[0].automation_rules),
          successRate: parseFloat(results[3].rows[0].success_rate),
          timeSaved: parseFloat(results[4].rows[0].time_saved),
          tasksAutomated: parseInt(results[5].rows[0].tasks_automated),
        });
      } catch (error) {
        log.error('Error fetching automation metrics:', error);
        res.status(500).json({ error: 'Failed to fetch automation metrics' });
      }
    },
  );

  // Get workflow templates
  app.get(
    '/api/automation/workflow-templates',

    async (req: any, res) => {
      try {
        const category = String((req.query as any)?.category || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['tenant_id = $1'];
        const queryParams = [tenantId];

        if (category && category !== 'all') {
          whereConditions.push(`template_category = $${queryParams.length + 1}`);
          queryParams.push(category);
        }

        const query = `
        SELECT *
        FROM workflow_templates
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY is_active DESC, created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching workflow templates:', error);
        res.status(500).json({ error: 'Failed to fetch workflow templates' });
      }
    },
  );

  // Create workflow template
  app.post(
    '/api/automation/workflow-templates',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          template_name,
          template_description,
          template_category,
          priority,
          auto_start,
          requires_approval,
          execution_delay_minutes,
          max_execution_time_hours,
          retry_attempts,
        } = req.body;

        // Create basic workflow configuration
        const workflowSteps = [
          {
            step: 1,
            name: 'Initialize',
            type: 'action',
            config: { action: 'start_workflow' },
          },
          {
            step: 2,
            name: 'Process',
            type: 'action',
            config: { action: 'execute_main_logic' },
          },
          {
            step: 3,
            name: 'Complete',
            type: 'action',
            config: { action: 'finalize_workflow' },
          },
        ];

        const triggerConditions = {
          events: ['manual_trigger'],
          conditions: [],
        };

        const query = `
        INSERT INTO workflow_templates (
          tenant_id, template_name, template_description, template_category,
          priority, auto_start, requires_approval, execution_delay_minutes,
          max_execution_time_hours, retry_attempts, workflow_steps,
          trigger_conditions, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          template_name,
          template_description,
          template_category,
          priority,
          auto_start,
          requires_approval,
          execution_delay_minutes,
          max_execution_time_hours,
          retry_attempts,
          JSON.stringify(workflowSteps),
          JSON.stringify(triggerConditions),
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating workflow template:', error);
        res.status(500).json({ error: 'Failed to create workflow template' });
      }
    },
  );

  // Execute workflow template
  app.post(
    '/api/automation/workflow-templates/:id/execute',

    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Get template
        const templateQuery = `SELECT * FROM workflow_templates WHERE id = $1 AND tenant_id = $2`;
        const templateResult = await db.$client.query(templateQuery, [id, tenantId]);

        if (templateResult.rows.length === 0) {
          return res.status(404).json({ error: 'Workflow template not found' });
        }

        const template = templateResult.rows[0];
        const executionId = `WF-${Date.now()}`;

        const query = `
        INSERT INTO workflow_executions (
          tenant_id, execution_id, workflow_template_id, execution_name,
          triggered_by_user_id, triggered_by_event, total_steps, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

        const steps = template.workflow_steps || [];

        const result = await db.$client.query(query, [
          tenantId,
          executionId,
          id,
          `${template.templateName} Execution`,
          userId,
          'manual',
          steps.length,
          'pending',
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error executing workflow template:', error);
        res.status(500).json({ error: 'Failed to execute workflow template' });
      }
    },
  );

  // Get workflow executions
  app.get(
    '/api/automation/workflow-executions',

    async (req: any, res) => {
      try {
        const status = String((req.query as any)?.status || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['we.tenantId = $1'];
        const queryParams = [tenantId];

        if (status && status !== 'all') {
          whereConditions.push(`we.status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        const query = `
        SELECT
          we.*,
          wt.templateName as workflow_template_name
        FROM workflow_executions we
        LEFT JOIN workflow_templates wt ON we.workflow_template_id = wt.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY we.createdAt DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching workflow executions:', error);
        res.status(500).json({ error: 'Failed to fetch workflow executions' });
      }
    },
  );

  // Control workflow execution
  app.post(
    '/api/automation/workflow-executions/:id/:action',

    async (req: any, res) => {
      try {
        const { id, action } = req.params;
        const tenantId = req.user.tenantId;

        let newStatus;
        let updateFields = [];
        let values = [];

        switch (action) {
          case 'pause':
            newStatus = 'paused';
            updateFields.push('paused_at = NOW()');
            break;
          case 'resume':
            newStatus = 'running';
            updateFields.push('paused_at = NULL');
            break;
          case 'stop':
            newStatus = 'cancelled';
            updateFields.push('completed_at = NOW()');
            break;
          default:
            return res.status(400).json({ error: 'Invalid action' });
        }

        updateFields.push(`status = $${values.length + 2}`);
        values.push(newStatus);

        const query = `
        UPDATE workflow_executions
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE execution_id = $1 AND tenant_id = $${values.length + 2}
        RETURNING *
      `;

        const result = await db.$client.query(query, [id, ...values, tenantId]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Workflow execution not found' });
        }

        res.json(result.rows[0]);
      } catch (error) {
        log.error('Error controlling workflow execution:', error);
        res.status(500).json({ error: 'Failed to control workflow execution' });
      }
    },
  );

  // ============= MOBILE FIELD OPERATIONS ROUTES =============

  // Get mobile field metrics
  app.get(
    '/api/mobile-field/metrics',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as active_technicians FROM field_technicians WHERE tenant_id = $1 AND employment_status = 'active' AND availability_status IN ('available', 'busy')`,
          `SELECT COUNT(*) as work_orders_today FROM field_work_orders WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
          `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as completion_rate FROM field_work_orders WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
          `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (actual_start_time - created_at))/60), 0) as avg_response_time FROM field_work_orders WHERE tenant_id = $1 AND actual_start_time IS NOT NULL`,
          `SELECT COALESCE(AVG(customer_satisfaction_rating), 0) as customer_satisfaction FROM field_technicians WHERE tenant_id = $1`,
          `SELECT 95.5 as gps_accuracy`, // Mock GPS accuracy metric
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId])),
        );

        res.json({
          activeTechnicians: parseInt(results[0].rows[0].active_technicians),
          workOrdersToday: parseInt(results[1].rows[0].work_orders_today),
          completionRate: parseFloat(results[2].rows[0].completion_rate),
          averageResponseTime: parseFloat(results[3].rows[0].avg_response_time),
          customerSatisfaction: parseFloat(results[4].rows[0].customer_satisfaction),
          gpsAccuracy: parseFloat(results[5].rows[0].gps_accuracy),
        });
      } catch (error) {
        log.error('Error fetching mobile field metrics:', error);
        res.status(500).json({ error: 'Failed to fetch mobile field metrics' });
      }
    },
  );

  // Get field technicians
  app.get(
    '/api/mobile-field/technicians',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT *
        FROM field_technicians
        WHERE tenant_id = $1
        ORDER BY employment_status DESC, technician_name ASC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching field technicians:', error);
        res.status(500).json({ error: 'Failed to fetch field technicians' });
      }
    },
  );

  // Create field technician
  app.post(
    '/api/mobile-field/technicians',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          employee_id,
          technician_name,
          technician_email,
          technician_phone,
          device_type,
          skill_categories,
          work_schedule,
          gps_tracking_enabled,
          voice_notes_enabled,
          photo_upload_enabled,
        } = req.body;

        // Parse skill categories if provided
        const skillCategoriesArray = skill_categories
          ? skill_categories.split(',').map((s: string) => s.trim())
          : [];

        const query = `
        INSERT INTO field_technicians (
          tenant_id, employee_id, technician_name, technician_email,
          technician_phone, device_type, skill_categories, work_schedule,
          gps_tracking_enabled, voice_notes_enabled, photo_upload_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          employee_id,
          technician_name,
          technician_email,
          technician_phone,
          device_type,
          JSON.stringify(skillCategoriesArray),
          work_schedule || null,
          gps_tracking_enabled,
          voice_notes_enabled,
          photo_upload_enabled,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating field technician:', error);
        res.status(500).json({ error: 'Failed to create field technician' });
      }
    },
  );

  // Get field work orders
  app.get(
    '/api/mobile-field/work-orders',

    async (req: any, res) => {
      try {
        const status = String((req.query as any)?.status || '');
        const technician = String((req.query as any)?.technician || '');
        const priority = String((req.query as any)?.priority || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['tenant_id = $1'];
        const queryParams = [tenantId];

        if (status && status !== 'all') {
          whereConditions.push(`status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        if (technician && technician !== 'all') {
          whereConditions.push(`assigned_technician_id = $${queryParams.length + 1}`);
          queryParams.push(technician);
        }

        if (priority && priority !== 'all') {
          whereConditions.push(`priority = $${queryParams.length + 1}`);
          queryParams.push(priority);
        }

        const query = `
        SELECT *
        FROM field_work_orders
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY
          CASE priority
            WHEN 'emergency' THEN 1
            WHEN 'urgent' THEN 2
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 4
            ELSE 5
          END,
          created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching field work orders:', error);
        res.status(500).json({ error: 'Failed to fetch field work orders' });
      }
    },
  );

  // Create field work order
  app.post(
    '/api/mobile-field/work-orders',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          work_order_type,
          priority,
          customer_name,
          service_address,
          work_description,
          estimated_duration_minutes,
          scheduled_date,
          scheduled_time_start,
          assigned_technician_id,
          special_instructions,
        } = req.body;

        // Generate work order number
        const workOrderNumber = `WO-${Date.now()}`;

        // Create service location object
        const serviceLocation = {
          address: service_address,
          coordinates: null, // Would be geocoded in real implementation
        };

        const query = `
        INSERT INTO field_work_orders (
          tenant_id, work_order_number, work_order_type, priority,
          customer_id, customer_name, service_location, work_description,
          estimated_duration_minutes, scheduled_date, scheduled_time_start,
          assigned_technician_id, special_instructions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          workOrderNumber,
          work_order_type,
          priority,
          'customer-' + Date.now(),
          customer_name,
          JSON.stringify(serviceLocation),
          work_description,
          estimated_duration_minutes,
          scheduled_date,
          scheduled_time_start,
          assigned_technician_id,
          special_instructions,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating field work order:', error);
        res.status(500).json({ error: 'Failed to create field work order' });
      }
    },
  );

  // Get voice notes
  app.get(
    '/api/mobile-field/voice-notes',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT *
        FROM voice_notes
        WHERE tenant_id = $1
        ORDER BY recorded_timestamp DESC
        LIMIT 50
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching voice notes:', error);
        res.status(500).json({ error: 'Failed to fetch voice notes' });
      }
    },
  );

  // Create voice note
  app.post(
    '/api/mobile-field/voice-notes',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          work_order_id,
          note_category,
          note_title,
          transcription_text,
          urgency_level,
          tags,
        } = req.body;

        // Parse tags if provided
        const tagsArray = tags ? tags.split(',').map((t: string) => t.trim()) : [];

        // Mock audio file URL (in real implementation, this would be uploaded)
        const audioFileUrl = `/audio/voice-note-${Date.now()}.mp3`;

        const query = `
        INSERT INTO voice_notes (
          tenant_id, technician_id, work_order_id, note_category,
          audio_file_url, note_title, transcription_text, urgency_level,
          tags, recorded_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          userId,
          work_order_id,
          note_category,
          audioFileUrl,
          note_title,
          transcription_text,
          urgency_level,
          JSON.stringify(tagsArray),
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating voice note:', error);
        res.status(500).json({ error: 'Failed to create voice note' });
      }
    },
  );

  // ============= EQUIPMENT TRIGGER SERVICE =============

  // Equipment Lifecycle Integration with Service Workflows
  app.post('/api/equipment/:equipmentId/trigger-service', async (req: any, res) => {
    try {
      const { tenantId, id: userId } = req.user;
      const { equipmentId } = req.params;
      const { serviceType, priority = 'medium', description } = req.body;

      // Get equipment details
      const equipmentList = await storage.getEquipment(tenantId);
      const equipmentItem = equipmentList.find((e: any) => e.id === equipmentId);
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

        for (const reading of unprocessedReadings) {
          // Get tiered rates for billing calculation
          const tieredRates = await storage.getContractTieredRatesByContract(contractId);

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
            invoiceNumber: `INV-${String(contract.contractNumber || 'CON')}-$
            {Date.now()}`,
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

          // Update customer current balance
          const customer = await storage.getBusinessRecord(contract.customerId, tenantId);
          const newBalance = parseFloat(String(customer?.currentBalance || '0')) + totalAmount;
          await storage.updateBusinessRecord(contract.customerId, tenantId, {
            currentBalance: newBalance.toString(),
            lastMeterReadingDate: reading.readingDate,
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
