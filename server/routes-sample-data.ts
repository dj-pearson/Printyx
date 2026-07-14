/**
 * Sample Data & Dashboard Routes
 * Extracted from routes.ts monolith.
 */
import type { Express } from 'express';
import { db } from './db';
import { eq, sql, asc, and } from 'drizzle-orm';
import { businessRecords, locations, regions, tenants } from '@shared/schema';
import { storage } from './storage';
import { getUserId } from './utils/auth-helpers';
import { requireAuth } from './replitAuth';
import { DashboardService } from './integrations/dashboard-service';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-sample-data');

export function registerSampleDataRoutes(app: Express) {
  // ──────────────────────────────────────────────
  // Tenant Management Routes
  // ──────────────────────────────────────────────

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

  // ──────────────────────────────────────────────
  // Demo Scheduling Routes
  // ──────────────────────────────────────────────

  app.get('/api/demos', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // For now, return sample demo data structure until schema is updated
      const sampleDemos = [
        {
          id: 'demo-1',
          businessRecordId: 'customer-1',
          customerName: 'ABC Corporation',
          contactPerson: 'John Smith',
          scheduledDate: new Date('2025-01-10'),
          scheduledTime: '10:00 AM',
          duration: 60,
          demoType: 'equipment',
          equipmentModels: ['Canon imageRUNNER ADVANCE C3330i'],
          demoLocation: 'customer_site',
          assignedSalesRep: 'Sales Rep Name',
          status: 'scheduled',
          confirmationStatus: 'pending',
          preparationCompleted: false,
          demoObjectives: 'Demonstrate color printing capabilities and scan-to-email features',
          proposalAmount: 15000,
          createdAt: new Date('2025-01-05'),
        },
      ];

      res.json(sampleDemos);
    } catch (error) {
      log.error('Error fetching demos:', error);
      res.status(500).json({ message: 'Failed to fetch demos' });
    }
  });

  app.get('/api/demos/customers', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get real customers from business records
      const customers = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          primaryContactName: businessRecords.primaryContactName,
          phone: businessRecords.phone,
          email: businessRecords.primaryContactEmail,
          addressLine1: businessRecords.addressLine1,
          city: businessRecords.city,
          state: businessRecords.state,
          postalCode: businessRecords.postalCode,
        })
        .from(businessRecords)
        .where(
          and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
        )
        .orderBy(asc(businessRecords.companyName));

      res.json(customers);
    } catch (error) {
      log.error('Error fetching customers for demo:', error);
      res.status(500).json({ message: 'Failed to fetch customers' });
    }
  });

  // ──────────────────────────────────────────────
  // Sales Trends (Sample Data)
  // ──────────────────────────────────────────────

  app.get('/api/sales-trends', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const monthsNum = Number((req.query as any)?.months ?? 6);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Sample trend data
      const sampleTrends = Array.from(
        { length: Number.isFinite(monthsNum) ? monthsNum : 6 },
        (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);

          return {
            month: date.toISOString().substring(0, 7),
            monthName: date.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            }),
            revenue: Math.floor(Math.random() * 50000) + 80000,
            deals: Math.floor(Math.random() * 3) + 3,
            units: Math.floor(Math.random() * 4) + 4,
            pipelineValue: Math.floor(Math.random() * 100000) + 300000,
            conversionRate: Math.floor(Math.random() * 20) + 25,
            averageDealSize: Math.floor(Math.random() * 10000) + 25000,
          };
        },
      ).reverse();

      res.json(sampleTrends);
    } catch (error) {
      log.error('Error fetching sales trends:', error);
      res.status(500).json({ message: 'Failed to fetch sales trends' });
    }
  });

  // ──────────────────────────────────────────────
  // E-signature Integration Routes (Sample Data)
  // ──────────────────────────────────────────────

  app.get('/api/signature-requests', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Sample signature requests until schema is updated
      const sampleRequests = [
        {
          id: 'sig-req-1',
          documentName: 'Service Agreement - ABC Corporation',
          documentType: 'service_agreement',
          businessRecordId: 'customer-1',
          customerName: 'ABC Corporation',
          customerEmail: 'john.smith@abccorp.com',
          status: 'pending',
          requestedBy: 'Sales Rep',
          requestedDate: new Date('2025-01-20'),
          expirationDate: new Date('2025-02-20'),
          signedDate: null,
          documentUrl: '/documents/service-agreement-abc-corp.pdf',
          signatureUrl: null,
          remindersSent: 1,
          lastReminderDate: new Date('2025-01-25'),
          contractValue: 85000,
          contractDuration: 36,
          signers: [
            {
              name: 'John Smith',
              email: 'john.smith@abccorp.com',
              role: 'Customer',
              status: 'pending',
              signedDate: null,
            },
          ],
          createdAt: new Date('2025-01-20'),
        },
      ];

      res.json(sampleRequests);
    } catch (error) {
      log.error('Error fetching signature requests:', error);
      res.status(500).json({ message: 'Failed to fetch signature requests' });
    }
  });

  app.get('/api/signature-templates', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Sample signature templates
      const sampleTemplates = [
        {
          id: 'template-1',
          templateName: 'Standard Service Agreement',
          documentType: 'service_agreement',
          description: 'Standard copier service and maintenance agreement template',
          templateUrl: '/templates/standard-service-agreement.pdf',
          signatureFields: [
            {
              fieldName: 'customer_signature',
              x: 100,
              y: 750,
              page: 1,
              required: true,
            },
            {
              fieldName: 'customer_date',
              x: 300,
              y: 750,
              page: 1,
              required: true,
            },
          ],
          isActive: true,
          usageCount: 25,
          lastUsed: new Date('2025-01-20'),
          createdAt: new Date('2024-10-15'),
        },
      ];

      res.json(sampleTemplates);
    } catch (error) {
      log.error('Error fetching signature templates:', error);
      res.status(500).json({ message: 'Failed to fetch signature templates' });
    }
  });

  app.get('/api/signature-analytics', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Sample analytics data
      const analytics = {
        totalRequests: 45,
        completedRequests: 32,
        pendingRequests: 8,
        expiredRequests: 5,
        completionRate: 71.1,
        averageSigningTime: 2.3,
        totalContractValue: 1850000,
        byDocumentType: [
          {
            type: 'service_agreement',
            count: 18,
            completed: 14,
            value: 950000,
          },
          { type: 'equipment_lease', count: 20, completed: 15, value: 750000 },
          {
            type: 'maintenance_contract',
            count: 7,
            completed: 3,
            value: 150000,
          },
        ],
        signingSpeedAnalysis: {
          within24Hours: 12,
          within48Hours: 8,
          within1Week: 7,
          moreThan1Week: 5,
        },
      };

      res.json(analytics);
    } catch (error) {
      log.error('Error fetching signature analytics:', error);
      res.status(500).json({ message: 'Failed to fetch signature analytics' });
    }
  });

  // ──────────────────────────────────────────────
  // Preventive Maintenance Automation Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/maintenance/schedules', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Sample maintenance schedules until schema is updated
      const maintenanceSchedules = [
        {
          id: 'schedule-1',
          equipmentId: 'eq-001',
          equipmentModel: 'Canon imageRUNNER ADVANCE DX C5750i',
          customerName: 'ABC Corporation',
          customerLocation: '123 Business Way, Downtown',
          maintenanceType: 'quarterly_service',
          serviceName: 'Quarterly Preventive Maintenance',
          frequency: 'quarterly',
          frequencyValue: 3,
          nextDueDate: new Date('2025-02-15'),
          lastServiceDate: new Date('2024-11-15'),
          meterBasedScheduling: true,
          currentMeterReading: 45230,
          meterAtLastService: 42500,
          nextServiceMeter: 47500,
          meterThreshold: 2500,
          estimatedDuration: 120,
          requiredSkills: ['preventive_maintenance', 'copier_service'],
          requiredParts: ['toner_cartridge', 'transfer_belt', 'fuser_kit'],
          status: 'scheduled',
          priority: 'medium',
          urgencyScore: 75,
          assignedTechnicianId: 'tech-2',
          assignedTechnicianName: 'Sarah Wilson',
          scheduledDate: new Date('2025-02-15'),
          scheduledTimeSlot: '10:00 AM - 12:00 PM',
          autoScheduleEnabled: true,
          reminderDaysBefore: 7,
          escalationDays: 3,
          serviceHistory: [
            {
              date: new Date('2024-11-15'),
              technician: 'Mike Johnson',
              duration: 105,
              partsUsed: ['toner_cartridge'],
              issues: ['paper jam sensor cleaned'],
              meterReading: 42500,
            },
          ],
          predictiveInsights: {
            riskLevel: 'low',
            failurePrediction: 12,
            recommendedActions: [
              'Monitor toner levels - replacement due soon',
              'Check paper feed mechanism during next service',
            ],
            costSavings: 450,
          },
          createdAt: new Date('2024-08-01'),
          updatedAt: new Date('2025-01-20'),
        },
      ];

      res.json(maintenanceSchedules);
    } catch (error) {
      log.error('Error fetching maintenance schedules:', error);
      res.status(500).json({ message: 'Failed to fetch maintenance schedules' });
    }
  });

  app.get('/api/maintenance/analytics', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Sample maintenance analytics
      const analytics = {
        summary: {
          totalEquipment: 156,
          scheduledMaintenance: 89,
          overdueMaintenance: 12,
          completedThisMonth: 45,
          preventiveVsReactive: 78.5,
          averageServiceTime: 105,
          customerSatisfaction: 4.7,
          costSavings: 12450,
        },
        efficiency: {
          maintenanceCompliance: 92.3,
          firstTimeFixRate: 87.6,
          averageResponseTime: 2.4,
          technicianUtilization: 74.2,
          partsAvailability: 94.8,
          schedulingAccuracy: 89.1,
        },
        equipment_health: [
          {
            category: 'Copiers/MFPs',
            totalUnits: 78,
            healthyUnits: 65,
            warningUnits: 10,
            criticalUnits: 3,
            averageAge: 3.2,
            predictedFailures: 2,
          },
        ],
        cost_analysis: {
          monthlyMaintenanceCost: 8750,
          preventiveCost: 6850,
          reactiveCost: 1900,
          averageCostPerUnit: 56.09,
          costTrends: [
            {
              month: 'Dec 2024',
              preventive: 6650,
              reactive: 2200,
              total: 8850,
            },
            {
              month: 'Jan 2025',
              preventive: 6850,
              reactive: 1900,
              total: 8750,
            },
          ],
        },
        performance_trends: [
          { month: 'Dec', compliance: 93.1, satisfaction: 4.8, savings: 12300 },
          { month: 'Jan', compliance: 92.3, satisfaction: 4.7, savings: 12450 },
        ],
      };

      res.json(analytics);
    } catch (error) {
      log.error('Error fetching maintenance analytics:', error);
      res.status(500).json({ message: 'Failed to fetch maintenance analytics' });
    }
  });

  app.get('/api/maintenance/templates', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Sample maintenance templates
      const templates = [
        {
          id: 'template-1',
          templateName: 'Standard Copier Quarterly Service',
          description: 'Comprehensive quarterly maintenance for copiers and MFPs',
          equipmentTypes: ['copier', 'mfp'],
          estimatedDuration: 120,
          frequency: 'quarterly',
          checklist: [
            {
              item: 'Clean paper path and feed rollers',
              required: true,
              estimatedTime: 15,
            },
            {
              item: 'Replace toner cartridges if below 20%',
              required: true,
              estimatedTime: 10,
            },
          ],
          requiredParts: [{ partName: 'Toner Cartridge Set', quantity: 1, optional: true }],
          requiredSkills: ['copier_maintenance', 'preventive_service'],
          safetyRequirements: ['power_off_before_service', 'use_cleaning_gloves'],
          isActive: true,
          usageCount: 34,
          lastUsed: new Date('2025-01-20'),
          createdAt: new Date('2024-06-15'),
        },
      ];

      res.json(templates);
    } catch (error) {
      log.error('Error fetching maintenance templates:', error);
      res.status(500).json({ message: 'Failed to fetch maintenance templates' });
    }
  });

  app.get('/api/maintenance/predictions', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Sample predictive maintenance data
      const predictions = [
        {
          equipmentId: 'eq-005',
          model: 'Canon imageRUNNER ADVANCE DX C7765i',
          customer: 'Gamma Solutions',
          location: 'Building A, Floor 3',
          prediction: {
            riskLevel: 'high',
            failureProbability: 78,
            predictedComponent: 'Fuser Unit',
            timeToFailure: 14,
            confidence: 87,
          },
          recommendation: {
            action: 'immediate_service',
            priority: 'urgent',
            estimatedCost: 485,
            preventiveCost: 320,
            reactiveCost: 750,
            potentialSavings: 430,
          },
          dataPoints: {
            currentMeterReading: 87540,
            averageMonthlyVolume: 12500,
            lastServiceDate: new Date('2024-10-15'),
            errorFrequency: 'increasing',
            performanceMetrics: {
              printQuality: 'declining',
              speedReduction: '15%',
              jamFrequency: 'high',
            },
          },
        },
      ];

      res.json(predictions);
    } catch (error) {
      log.error('Error fetching predictive maintenance:', error);
      res.status(500).json({ message: 'Failed to fetch predictive maintenance' });
    }
  });

  // ──────────────────────────────────────────────
  // Customer Success & Retention Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/customer-success/health-scores', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const healthScores = [
        {
          customerId: 'cust-001',
          customerName: 'Metro Office Solutions',
          accountManager: 'John Smith',
          overallHealthScore: 85,
          healthStatus: 'healthy',
          riskLevel: 'low',
          churnProbability: 12,
          scoreBreakdown: {
            usageHealth: 92,
            paymentHealth: 95,
            serviceHealth: 78,
            contractHealth: 88,
            engagementHealth: 82,
          },
          metrics: {
            contractValue: 15600,
            monthsRemaining: 18,
            lastPaymentDate: new Date('2025-01-28'),
            daysSinceLastService: 45,
            averageResponseTime: 2.3,
            satisfactionScore: 4.2,
            usageUtilization: 87,
            renewalProbability: 89,
          },
          trends: {
            usageTrend: 'stable',
            paymentTrend: 'improving',
            serviceTrend: 'declining',
            engagementTrend: 'stable',
          },
          riskFactors: [
            {
              factor: 'Service Response Time',
              severity: 'medium',
              description: 'Average response time has increased by 20% over past 3 months',
              impact: 15,
              recommendation: 'Schedule proactive service check and review technician assignments',
            },
          ],
          opportunities: [
            {
              type: 'contract_renewal',
              description: 'Contract renewal due in 18 months - early engagement opportunity',
              value: 15600,
              probability: 89,
              action: 'Schedule renewal discussion meeting',
            },
          ],
          alerts: [
            {
              type: 'service_alert',
              priority: 'medium',
              message: 'Service response time degrading - schedule proactive maintenance',
              dueDate: new Date('2025-02-15'),
            },
          ],
          lastUpdated: new Date('2025-02-03'),
          nextReviewDate: new Date('2025-02-17'),
        },
      ];

      res.json(healthScores);
    } catch (error) {
      log.error('Error fetching customer health scores:', error);
      res.status(500).json({ message: 'Failed to fetch customer health scores' });
    }
  });

  app.get('/api/customer-success/usage-analytics', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const usageAnalytics = {
        summary: {
          totalCustomers: 45,
          averageUtilization: 76.5,
          totalMonthlyVolume: 2847500,
          utilizationTrend: 2.3,
          topPerformingAccounts: 12,
          underutilizedAccounts: 8,
        },
        customerBreakdown: [
          {
            customerId: 'cust-001',
            customerName: 'Metro Office Solutions',
            equipment: [
              {
                serialNumber: 'MX-2020-001',
                model: 'Canon ImageRunner 2525i',
                monthlyVolume: 12500,
                capacity: 15000,
                utilization: 83.3,
                averageDailyUsage: 417,
                peakUsageDay: 'Tuesday',
                maintenanceScore: 92,
              },
            ],
            usageTrends: {
              currentMonth: 21250,
              lastMonth: 20800,
              growth: 2.2,
              yearOverYear: 15.7,
              seasonalPattern: 'stable',
            },
            recommendations: [
              {
                type: 'optimization',
                priority: 'medium',
                description: 'Equipment nearing capacity - consider upgrade',
                potentialSavings: 2400,
                implementationCost: 850,
              },
            ],
            alerts: [
              {
                type: 'capacity_warning',
                equipment: 'MX-2020-001',
                message: 'Operating at 83% capacity',
                severity: 'medium',
              },
            ],
          },
        ],
        optimizationOpportunities: [
          {
            type: 'equipment_consolidation',
            description: 'Multiple underutilized devices can be consolidated',
            potentialSavings: 12600,
            implementationCost: 4200,
            roi: 300,
          },
        ],
      };

      res.json(usageAnalytics);
    } catch (error) {
      log.error('Error fetching usage analytics:', error);
      res.status(500).json({ message: 'Failed to fetch usage analytics' });
    }
  });

  app.get('/api/customer-success/satisfaction', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const satisfactionData = {
        summary: {
          overallSatisfaction: 4.2,
          responseRate: 68.5,
          totalSurveys: 156,
          completedSurveys: 107,
          npsScore: 42,
          promoters: 65,
          detractors: 23,
          trend: 'improving',
        },
        recentSurveys: [
          {
            surveyId: 'surv-001',
            customerId: 'cust-001',
            customerName: 'Metro Office Solutions',
            submittedDate: new Date('2025-01-30'),
            scores: {
              overall: 4.5,
              serviceQuality: 4.7,
              responseTime: 4.2,
              technicalExpertise: 4.8,
              communication: 4.3,
              valueForMoney: 4.1,
            },
            npsScore: 9,
            category: 'promoter',
            feedback: 'Excellent service team - always responsive and knowledgeable.',
            actionItems: [],
          },
        ],
        categoryTrends: {
          serviceQuality: {
            current: 4.3,
            previous: 4.1,
            trend: 'improving',
            target: 4.5,
          },
          responseTime: {
            current: 3.8,
            previous: 3.6,
            trend: 'improving',
            target: 4.2,
          },
          technicalExpertise: {
            current: 4.5,
            previous: 4.4,
            trend: 'stable',
            target: 4.6,
          },
        },
      };

      res.json(satisfactionData);
    } catch (error) {
      log.error('Error fetching satisfaction data:', error);
      res.status(500).json({ message: 'Failed to fetch satisfaction data' });
    }
  });

  // ──────────────────────────────────────────────
  // Remote Monitoring & IoT Integration Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/remote-monitoring/equipment-status', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const equipmentStatus = [
        {
          equipmentId: 'eq-001',
          serialNumber: 'MX-2025-001',
          model: 'Canon ImageRunner 2535i',
          location: {
            customerName: 'Metro Office Solutions',
            address: '123 Business Center Dr, Suite 200',
            floor: '2nd Floor - Copy Center',
            coordinates: { lat: 40.7128, lng: -74.006 },
          },
          status: 'operational',
          connectionStatus: 'connected',
          lastPing: new Date('2025-02-03T23:45:32Z'),
          uptime: 98.7,
          currentMetrics: {
            pagesPerMinute: 35,
            tonerLevels: { black: 78, cyan: 82, magenta: 75, yellow: 91 },
            paperLevels: { tray1: 85, tray2: 92, tray3: 67 },
            temperature: 42.3,
            humidity: 45,
            errorCount: 0,
            jamCount: 2,
            lastJobCompleted: new Date('2025-02-03T23:44:15Z'),
          },
          performance: {
            dailyPageCount: 1247,
            weeklyPageCount: 8650,
            monthlyPageCount: 32450,
            utilizationRate: 87,
            efficiency: 94.2,
            averageJobSize: 12.5,
            peakUsageHour: 14,
          },
          maintenance: {
            nextScheduled: new Date('2025-02-15T09:00:00Z'),
            lastCompleted: new Date('2025-01-20T14:30:00Z'),
            maintenanceScore: 92,
            predictiveAlerts: [
              {
                component: 'Fuser Unit',
                condition: 'good',
                estimatedLife: 85,
                nextReplacement: new Date('2025-04-15T00:00:00Z'),
              },
            ],
          },
          alerts: [
            {
              id: 'alert-001',
              type: 'supply_low',
              severity: 'medium',
              message: 'Magenta toner at 75% - consider ordering replacement',
              timestamp: new Date('2025-02-03T22:30:00Z'),
              acknowledged: false,
            },
          ],
          environmental: {
            powerConsumption: 450,
            energyEfficiency: 'A+',
            carbonFootprint: 2.3,
            sleepModeActive: false,
            autoSleepEnabled: true,
          },
        },
      ];

      res.json(equipmentStatus);
    } catch (error) {
      log.error('Error fetching equipment status:', error);
      res.status(500).json({ message: 'Failed to fetch equipment status' });
    }
  });

  app.get('/api/remote-monitoring/fleet-overview', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const fleetOverview = {
        summary: {
          totalEquipment: 47,
          onlineEquipment: 44,
          offlineEquipment: 3,
          equipmentWithAlerts: 8,
          criticalAlerts: 2,
          averageUptime: 96.8,
          fleetUtilization: 78.5,
          energyEfficiency: 'A-',
        },
        statusDistribution: {
          operational: 38,
          warning: 6,
          critical: 2,
          offline: 3,
          maintenance: 1,
        },
        performanceTrends: {
          weeklyUptime: [96.2, 97.1, 96.8, 97.5, 96.9, 97.2, 96.8],
          weeklyUtilization: [75.2, 78.1, 76.8, 79.5, 77.9, 80.2, 78.5],
          weeklyEfficiency: [89.2, 91.1, 90.8, 92.5, 91.9, 93.2, 91.5],
        },
        topPerformers: [
          {
            equipmentId: 'eq-003',
            customerName: 'Regional Medical Center',
            model: 'Ricoh MP C3004',
            uptime: 99.2,
            efficiency: 98.7,
            utilizationRate: 95,
          },
        ],
        attentionRequired: [
          {
            equipmentId: 'eq-002',
            customerName: 'TechStart Innovations',
            model: 'Xerox WorkCentre 5855',
            issues: ['Critical toner low', 'Frequent jams'],
            priority: 'high',
            estimatedRevenueLoss: 1200,
          },
        ],
      };

      res.json(fleetOverview);
    } catch (error) {
      log.error('Error fetching fleet overview:', error);
      res.status(500).json({ message: 'Failed to fetch fleet overview' });
    }
  });

  // ──────────────────────────────────────────────
  // Document Management & Workflow Automation Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/document-management/library', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const documentLibrary = {
        summary: {
          totalDocuments: 2847,
          categoriesCount: 12,
          pendingApproval: 23,
          expiringSoon: 8,
          storageUsed: '4.2 GB',
          storageLimit: '50 GB',
          lastBackup: new Date('2025-02-03T02:00:00Z'),
          complianceScore: 96.5,
        },
        categories: [
          {
            id: 'contracts',
            name: 'Contracts & Agreements',
            documentCount: 456,
            subcategories: [
              { name: 'Service Contracts', count: 234, icon: 'FileText' },
              { name: 'Lease Agreements', count: 156, icon: 'FileSignature' },
              {
                name: 'Master Service Agreements',
                count: 45,
                icon: 'FileContract',
              },
            ],
            recentActivity: 12,
            complianceStatus: 'compliant',
            retentionPolicy: '7 years',
            accessLevel: 'restricted',
          },
          {
            id: 'service-docs',
            name: 'Service Documentation',
            documentCount: 1342,
            subcategories: [
              { name: 'Service Reports', count: 789, icon: 'FileText' },
              { name: 'Installation Docs', count: 234, icon: 'Settings' },
              { name: 'Maintenance Records', count: 198, icon: 'Wrench' },
            ],
            recentActivity: 45,
            complianceStatus: 'compliant',
            retentionPolicy: '5 years',
            accessLevel: 'department',
          },
        ],
        recentDocuments: [
          {
            id: 'doc-001',
            title: 'Metro Office Solutions - Service Contract Renewal',
            category: 'contracts',
            subcategory: 'Service Contracts',
            fileType: 'pdf',
            fileSize: '2.4 MB',
            lastModified: new Date('2025-02-03T16:30:00Z'),
            modifiedBy: 'Sarah Chen',
            status: 'active',
            version: '2.1',
            tags: ['renewal', 'service', 'metro-office'],
            workflow: {
              currentStage: 'customer_review',
              nextAction: 'awaiting_signature',
              dueDate: new Date('2025-02-10T17:00:00Z'),
              assignedTo: 'John Smith',
            },
          },
        ],
        pendingActions: [
          {
            id: 'action-001',
            documentId: 'doc-001',
            documentTitle: 'Metro Office Solutions - Service Contract Renewal',
            actionType: 'approval_required',
            priority: 'high',
            assignedTo: 'John Smith',
            dueDate: new Date('2025-02-05T17:00:00Z'),
            description: 'Contract renewal requires final management approval',
            estimatedTime: 15,
          },
        ],
      };

      res.json(documentLibrary);
    } catch (error) {
      log.error('Error fetching document library:', error);
      res.status(500).json({ message: 'Failed to fetch document library' });
    }
  });

  app.get('/api/document-management/workflows', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const workflowData = {
        templates: [
          {
            id: 'contract-approval',
            name: 'Contract Approval Workflow',
            description: 'Multi-stage approval process for service contracts',
            isActive: true,
            usage: 156,
            stages: [
              {
                id: 'stage-1',
                name: 'Initial Review',
                assignedRole: 'sales',
                slaHours: 24,
              },
              {
                id: 'stage-2',
                name: 'Legal Review',
                assignedRole: 'legal',
                slaHours: 48,
              },
              {
                id: 'stage-3',
                name: 'Management Approval',
                assignedRole: 'management',
                slaHours: 12,
              },
            ],
            metrics: {
              averageCompletionTime: 4.2,
              approvalRate: 89.5,
              slaComplianceRate: 92.1,
            },
          },
        ],
        activeWorkflows: [
          {
            id: 'wf-001',
            templateId: 'contract-approval',
            documentTitle: 'Metro Office Solutions - Service Contract Renewal',
            currentStage: 'management_approval',
            progress: 75,
            startedAt: new Date('2025-01-30T09:00:00Z'),
            dueAt: new Date('2025-02-05T17:00:00Z'),
            assignedTo: 'John Smith',
            priority: 'high',
            slaStatus: 'on_track',
          },
        ],
        automationStats: {
          totalRulesActive: 24,
          rulesTriggeredToday: 12,
          automationSuccessRate: 96.8,
          timesSaved: 145,
          documentsProcessed: 2847,
        },
      };

      res.json(workflowData);
    } catch (error) {
      log.error('Error fetching workflow data:', error);
      res.status(500).json({ message: 'Failed to fetch workflow data' });
    }
  });

  // ──────────────────────────────────────────────
  // Business Process Optimization Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/business-process/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const processOptimizationData = {
        processOverview: {
          totalProcesses: 47,
          automatedProcesses: 32,
          manualProcesses: 15,
          automationRate: 68.1,
          avgProcessTime: 4.7,
          processEfficiency: 84.3,
          costSavings: 127890.5,
          timeReduction: 32.4,
        },
        keyMetrics: [
          {
            metric: 'Lead to Customer Conversion',
            currentTime: 5.2,
            optimizedTime: 3.1,
            improvement: 40.4,
            status: 'optimized',
            automationLevel: 85,
          },
          {
            metric: 'Service Ticket Resolution',
            currentTime: 6.8,
            optimizedTime: 4.2,
            improvement: 38.2,
            status: 'optimized',
            automationLevel: 72,
          },
        ],
        workflowTemplates: [
          {
            id: 'wf-001',
            name: 'New Customer Onboarding',
            description:
              'Standardized process for onboarding new customers from lead to active account',
            steps: 12,
            avgDuration: 3.5,
            automationLevel: 85,
            successRate: 96.8,
            category: 'Customer Management',
            status: 'active',
            usageCount: 156,
            lastUpdated: new Date('2025-01-15T00:00:00Z'),
          },
        ],
        processAnalytics: {
          bottlenecks: [
            {
              process: 'Equipment Installation',
              step: 'Site Survey Scheduling',
              avgDelay: 3.2,
              impact: 'high',
              frequency: 78,
              recommendation: 'Implement automated scheduling with customer self-service portal',
            },
          ],
          efficiency: [
            {
              department: 'Sales',
              currentEfficiency: 78.5,
              targetEfficiency: 90.0,
              gap: 11.5,
              improvementAreas: ['Lead qualification', 'Proposal generation'],
              estimatedROI: 156780.25,
            },
          ],
          trends: [
            {
              month: '2025-01',
              efficiency: 84.3,
              automation: 68.1,
              processes: 47,
            },
          ],
        },
        automationOpportunities: [
          {
            id: 'auto-001',
            process: 'Customer Onboarding Documentation',
            description: 'Automate generation of welcome packets and setup documentation',
            currentEffort: 2.5,
            estimatedReduction: 80,
            potentialSavings: 45600.0,
            complexity: 'low',
            priority: 'high',
            implementationTime: 2,
            roi: 456.7,
            status: 'ready_to_implement',
          },
        ],
      };

      res.json(processOptimizationData);
    } catch (error) {
      log.error('Error fetching business process optimization data:', error);
      res.status(500).json({
        message: 'Failed to fetch business process optimization data',
      });
    }
  });

  // ──────────────────────────────────────────────
  // Security & Compliance Management Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/security/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const securityData = {
        securityOverview: {
          securityScore: 94.7,
          vulnerabilities: {
            critical: 0,
            high: 2,
            medium: 8,
            low: 15,
            total: 25,
          },
          complianceScore: 96.2,
          lastSecurityAudit: new Date('2024-12-15T00:00:00Z'),
          nextAuditDue: new Date('2025-06-15T00:00:00Z'),
          activeThreats: 3,
          resolvedIncidents: 47,
          systemUptime: 99.97,
        },
        complianceStatus: [
          {
            framework: 'SOC 2 Type II',
            status: 'compliant',
            score: 96.8,
            lastAudit: new Date('2024-09-30T00:00:00Z'),
            nextAudit: new Date('2025-09-30T00:00:00Z'),
            findings: 1,
            remediated: 3,
            inProgress: 0,
            requirements: {
              total: 64,
              implemented: 62,
              pending: 2,
              notApplicable: 0,
            },
          },
        ],
        securityIncidents: [
          {
            id: 'INC-2025-001',
            title: 'Suspicious Login Attempts',
            severity: 'medium',
            status: 'investigating',
            category: 'authentication',
            reportedAt: new Date('2025-01-30T14:30:00Z'),
            reportedBy: 'Security Monitoring System',
            affectedSystems: ['User Authentication', 'CRM Access'],
            description:
              'Multiple failed login attempts detected from unusual geographic locations',
            assignedTo: 'Security Team',
            estimatedResolution: new Date('2025-02-01T18:00:00Z'),
            actions: [
              'IP addresses blocked temporarily',
              'User accounts secured',
              'Additional monitoring enabled',
            ],
          },
        ],
        vulnerabilities: [
          {
            id: 'VULN-2025-001',
            title: 'Outdated SSL Certificate',
            severity: 'high',
            cvss: 7.2,
            category: 'network_security',
            affectedAssets: ['mail.company.com'],
            discoveredDate: new Date('2025-01-20T00:00:00Z'),
            status: 'remediation_in_progress',
            dueDate: new Date('2025-02-05T00:00:00Z'),
            assignedTo: 'Network Security Team',
            description: 'SSL certificate for mail server expires within 30 days',
            remediation: 'Renew SSL certificate and update configuration',
            businessImpact: 'Medium - Email service continuity risk',
          },
        ],
        accessControl: {
          userAccounts: {
            total: 247,
            active: 231,
            inactive: 16,
            privileged: 23,
            serviceAccounts: 12,
            pendingActivation: 3,
            pendingDeactivation: 5,
          },
          permissions: {
            totalRoles: 15,
            customRoles: 8,
            defaultRoles: 7,
            roleAssignments: 231,
            excessivePrivileges: 4,
            unusedPermissions: 12,
          },
          authentication: {
            mfaEnabled: 218,
            mfaDisabled: 13,
            ssoUsers: 195,
            localAuthUsers: 36,
            passwordExpiring: 27,
            accountsLocked: 2,
          },
        },
        dataProtection: {
          dataClassification: {
            public: 15678,
            internal: 89432,
            confidential: 34567,
            restricted: 8934,
            total: 148611,
          },
          dataRetention: {
            policiesTotal: 12,
            policiesActive: 11,
            retentionCompliant: 96.8,
            recordsScheduledDeletion: 2847,
            recordsDeleted: 15678,
            retentionViolations: 23,
          },
          privacyRequests: [
            {
              id: 'PR-2025-001',
              type: 'data_access',
              requestDate: new Date('2025-01-28T00:00:00Z'),
              status: 'completed',
              responseTime: 18,
              dataSubject: 'customer@example.com',
              completedDate: new Date('2025-01-29T18:00:00Z'),
            },
          ],
        },
        securityTraining: {
          trainingPrograms: [
            {
              program: 'Security Awareness Fundamentals',
              participants: 231,
              completed: 218,
              inProgress: 13,
              completionRate: 94.4,
              averageScore: 87.3,
              lastUpdated: new Date('2024-12-01T00:00:00Z'),
            },
          ],
          phishingSimulations: {
            totalCampaigns: 12,
            totalEmails: 2772,
            clicked: 167,
            reported: 89,
            clickRate: 6.0,
            reportRate: 3.2,
            improvementTrend: 'positive',
          },
        },
      };

      res.json(securityData);
    } catch (error) {
      log.error('Error fetching security dashboard data:', error);
      res.status(500).json({ message: 'Failed to fetch security dashboard data' });
    }
  });

  // ──────────────────────────────────────────────
  // Security Incident Response System Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/incident-response/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const incidentResponseData = {
        responseOverview: {
          activeIncidents: 7,
          criticalIncidents: 1,
          highIncidents: 2,
          mediumIncidents: 3,
          lowIncidents: 1,
          avgResponseTime: 12.5,
          avgResolutionTime: 4.2,
          mttr: 3.8,
          slaCompliance: 94.7,
          escalatedIncidents: 2,
          falsePositives: 8,
        },
        activeIncidents: [
          {
            id: 'INC-2025-007',
            title: 'Potential Data Exfiltration',
            severity: 'critical',
            priority: 'p1',
            status: 'investigating',
            category: 'data_breach',
            subcategory: 'data_exfiltration',
            detectedAt: new Date('2025-02-01T08:15:00Z'),
            reportedBy: 'DLP System',
            assignedTo: 'Incident Response Team Alpha',
            responder: 'Sarah Chen',
            affectedSystems: ['Customer Database', 'File Server', 'Email System'],
            affectedUsers: 15,
            estimatedImpact: 'high',
            businessImpact: 'Potential customer data exposure - regulatory compliance risk',
            detectionMethod: 'automated',
            confidenceLevel: 87.5,
            ttl: 2.3,
            slaDeadline: new Date('2025-02-01T12:15:00Z'),
            currentPhase: 'containment',
            progress: 35,
            tags: ['gdpr', 'customer_data', 'regulatory'],
            threatActors: ['Unknown Internal User'],
            indicators: [
              'Unusual bulk data access pattern',
              'Large file transfers to external email',
              'After-hours system access',
            ],
          },
        ],
        incidentStats: {
          monthlyTrends: [{ month: '2025-01', incidents: 24, resolved: 22, avgTime: 4.2 }],
          categoriesBreakdown: [
            {
              category: 'malware',
              count: 35,
              percentage: 28.5,
              avgSeverity: 'medium',
            },
            {
              category: 'social_engineering',
              count: 28,
              percentage: 22.8,
              avgSeverity: 'high',
            },
          ],
          severityDistribution: {
            critical: { count: 8, percentage: 6.5, avgResolutionTime: 2.1 },
            high: { count: 31, percentage: 25.2, avgResolutionTime: 6.8 },
          },
          detectionSources: [
            { source: 'SIEM/SOAR', incidents: 45, percentage: 36.6 },
            { source: 'EDR/XDR', incidents: 32, percentage: 26.0 },
          ],
        },
        teamPerformance: {
          teams: [
            {
              name: 'Incident Response Team Alpha',
              lead: 'Sarah Chen',
              members: 4,
              specialization: 'Critical Incidents & Data Breaches',
              activeIncidents: 3,
              avgResponseTime: 8.2,
              avgResolutionTime: 2.8,
              slaCompliance: 97.3,
              workload: 'high',
              status: 'available',
              onCallSchedule: 'Week 1-2 February',
            },
          ],
          individuals: [
            {
              name: 'Sarah Chen',
              role: 'Senior Incident Response Analyst',
              team: 'Alpha',
              activeIncidents: 1,
              totalIncidents: 47,
              avgResponseTime: 6.2,
              avgResolutionTime: 2.1,
              specialties: ['Data Breaches', 'Forensics', 'Compliance'],
              certifications: ['GCIH', 'GCFA', 'CISSP'],
              availability: 'on_call',
              performance: 'excellent',
            },
          ],
        },
        threatIntelligence: {
          activeThreatFeeds: 12,
          iocMatches: 156,
          newThreats: 23,
          currentThreats: [
            {
              threatId: 'TI-2025-001',
              name: 'Lazarus Group Campaign',
              threatActor: 'Lazarus Group (APT38)',
              firstSeen: new Date('2025-01-28T00:00:00Z'),
              lastUpdated: new Date('2025-02-01T06:30:00Z'),
              severity: 'high',
              confidence: 89.2,
              targeting: ['Financial Services', 'Technology'],
              ttps: ['T1566.001', 'T1055', 'T1071.001'],
              iocs: [
                {
                  type: 'domain',
                  value: 'malicious-domain.com',
                  confidence: 95,
                },
              ],
              mitigation: 'Block domains, monitor for lateral movement techniques',
              relevanceScore: 78.5,
            },
          ],
        },
        automatedResponse: {
          playbooks: [
            {
              id: 'playbook-001',
              name: 'Malware Incident Response',
              triggers: ['malware_detected', 'suspicious_process'],
              automationLevel: 78.5,
              steps: 12,
              avgExecutionTime: 15.7,
              successRate: 94.2,
              lastUpdated: new Date('2025-01-15T00:00:00Z'),
              status: 'active',
            },
          ],
          automationMetrics: {
            totalAutomatedActions: 1247,
            automationSuccessRate: 92.8,
            timesSaved: 847.3,
            falsePositiveReduction: 67.4,
            humanInterventionRequired: 12.5,
          },
        },
      };

      res.json(incidentResponseData);
    } catch (error) {
      log.error('Error fetching incident response dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch incident response dashboard' });
    }
  });

  // ──────────────────────────────────────────────
  // AI-Powered Analytics & Intelligence Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/ai-analytics/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // CRMX-001: Real, tenant-scoped AI/ML signals. Only churn scoring and
      // predictive maintenance have backing data today; every other section is
      // returned as an honest "preview" (available:false) rather than the
      // fabricated numbers this endpoint used to emit.

      // --- Churn (real): latest customer_churn_scores row per customer ---
      const churnLatest = await db.execute(sql`
        SELECT DISTINCT ON (s.customer_id)
          s.customer_id, s.score, s.band, s.signals, s.contract_value,
          b.company_name
        FROM customer_churn_scores s
        LEFT JOIN business_records b
          ON b.id = s.customer_id AND b.tenant_id = ${tenantId}
        WHERE s.tenant_id = ${tenantId}
        ORDER BY s.customer_id, s.calculated_at DESC
      `);
      const churnRows = ((churnLatest as any).rows ?? (churnLatest as any) ?? []) as any[];
      const bandCount = (b: string) => churnRows.filter((r) => r.band === b).length;
      const churnCustomers = churnRows
        .map((r) => {
          const score = Number(r.score) || 0;
          const contractValue = Number(r.contract_value) || 0;
          const signals = r.signals ?? null;
          return {
            customerId: r.customer_id,
            companyName: r.company_name ?? 'Unknown account',
            score,
            band: r.band,
            churnProbability: Math.min(1, Math.max(0, score / 100)),
            contractValue,
            reasons: Array.isArray(signals?.reasons) ? signals.reasons : [],
            priorityScore: score * contractValue,
          };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore);
      const churnAvailable = churnRows.length > 0;

      // --- Predictive maintenance (real): equipment_failure_predictions ---
      const predRes = await db.execute(sql`
        SELECT machine_id, confidence, predicted_window_start, contract_value,
               signals, status, outcome
        FROM equipment_failure_predictions
        WHERE tenant_id = ${tenantId}
        ORDER BY confidence DESC
      `);
      const predRows = ((predRes as any).rows ?? (predRes as any) ?? []) as any[];
      const openPreds = predRows.filter(
        (r) => r.status === 'pending' || r.status === 'approved' || r.status === 'snoozed',
      );
      const monitoredMachines = new Set(predRows.map((r) => r.machine_id)).size;
      const scoredOutcomes = predRows.filter(
        (r) => r.outcome === 'true_positive' || r.outcome === 'false_positive',
      );
      const truePositives = predRows.filter((r) => r.outcome === 'true_positive').length;
      const maintenanceAccuracy =
        scoredOutcomes.length >= 5
          ? Math.round((truePositives / scoredOutcomes.length) * 1000) / 10
          : null;
      const alerts = openPreds.slice(0, 25).map((r) => {
        const signals = r.signals ?? null;
        return {
          machineId: r.machine_id,
          confidence: Math.min(1, Math.max(0, Number(r.confidence) || 0)),
          predictedFailureDate: r.predicted_window_start,
          contractValue: Number(r.contract_value) || 0,
          status: r.status,
          suggestedParts: Array.isArray(signals?.suggested_parts) ? signals.suggested_parts : [],
        };
      });
      const maintenanceAvailable = predRows.length > 0;

      // --- Real record counts ---
      const [customerCountRow] = await db
        .select({ n: sql<number>`count(*)` })
        .from(businessRecords)
        .where(
          and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
        );
      const [leadCountRow] = await db
        .select({ n: sql<number>`count(*)` })
        .from(businessRecords)
        .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'lead')));
      const customersCount = Number(customerCountRow?.n) || 0;
      const leadsCount = Number(leadCountRow?.n) || 0;

      res.json({
        generatedAt: new Date().toISOString(),
        // Which capabilities are backed by real data vs. preview-only. The UI
        // renders an honest "Preview" state for anything false — never fake data.
        availability: {
          churn: churnAvailable,
          predictiveMaintenance: maintenanceAvailable,
          salesForecasting: false,
          sentiment: false,
          recommendations: false,
          modelRegistry: false,
          lifetimeValue: false,
          upsell: false,
        },
        overview: {
          customersCount,
          leadsCount,
          atRiskCustomers: bandCount('at_risk'),
          equipmentMonitored: monitoredMachines,
        },
        churn: {
          available: churnAvailable,
          totalAnalyzed: churnRows.length,
          highRisk: bandCount('at_risk'),
          mediumRisk: bandCount('watch'),
          lowRisk: bandCount('healthy'),
          customers: churnCustomers.slice(0, 25),
        },
        predictiveMaintenance: {
          available: maintenanceAvailable,
          equipmentMonitored: monitoredMachines,
          predictedFailures: openPreds.length,
          accuracyRate: maintenanceAccuracy,
          alerts,
        },
      });
    } catch (error) {
      log.error('Error fetching AI analytics dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch AI analytics dashboard' });
    }
  });

  // ──────────────────────────────────────────────
  // Advanced Workflow Automation Routes (Mock)
  // ──────────────────────────────────────────────

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

  // ──────────────────────────────────────────────
  // Security & Compliance Dashboard Routes
  // ──────────────────────────────────────────────

  app.get('/api/security-compliance/dashboard', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const securityComplianceData = {
        securityOverview: {
          overallSecurityScore: 94.7,
          complianceStatus: 'compliant',
          activeThreats: 3,
          resolvedThreats: 127,
          securityIncidents: 2,
          lastSecurityAudit: new Date('2025-01-28T00:00:00Z'),
          nextAuditDue: new Date('2025-04-28T00:00:00Z'),
          certificationsActive: 6,
          vulnerabilitiesDetected: 8,
          vulnerabilitiesPatched: 45,
          securityTrainingCompliance: 96.8,
          dataBackupStatus: 'healthy',
          encryptionCoverage: 100.0,
        },
        threatDetection: {
          realTimeMonitoring: {
            activeScans: 12,
            threatsDetected: 3,
            falsePositives: 7,
            threatScore: 2.4,
            lastScanCompleted: new Date('2025-02-01T07:30:00Z'),
            nextScheduledScan: new Date('2025-02-01T19:30:00Z'),
            monitoringUptime: 99.94,
          },
          detectedThreats: [
            {
              id: 'threat-001',
              type: 'suspicious_login_attempt',
              severity: 'medium',
              status: 'investigating',
              detectedAt: new Date('2025-02-01T06:45:00Z'),
              source: '192.168.1.247',
              targetUser: 'john.smith@printyx.com',
              description: 'Multiple failed login attempts from unusual location',
              riskScore: 6.2,
              affectedSystems: ['user_portal', 'admin_dashboard'],
              mitigationActions: ['account_lockout', 'security_notification', 'ip_monitoring'],
              investigator: 'security_team',
              estimatedResolutionTime: 45,
            },
            {
              id: 'threat-002',
              type: 'data_access_anomaly',
              severity: 'high',
              status: 'contained',
              detectedAt: new Date('2025-02-01T04:20:00Z'),
              source: 'internal_user',
              targetUser: 'admin@dealership.com',
              description: 'Unusual bulk data access outside normal business hours',
              riskScore: 7.8,
              affectedSystems: ['customer_database', 'financial_records'],
              mitigationActions: [
                'access_restriction',
                'audit_trail_review',
                'manager_notification',
              ],
              investigator: 'compliance_officer',
              estimatedResolutionTime: 120,
            },
          ],
          threatTrends: [
            {
              category: 'phishing_attempts',
              count: 23,
              change: '+12%',
              severity: 'medium',
            },
            {
              category: 'suspicious_logins',
              count: 15,
              change: '-8%',
              severity: 'medium',
            },
          ],
        },
        complianceManagement: {
          regulations: [
            {
              id: 'gdpr',
              name: 'General Data Protection Regulation (GDPR)',
              status: 'compliant',
              complianceScore: 96.8,
              lastAudit: new Date('2025-01-15T00:00:00Z'),
              nextAudit: new Date('2025-07-15T00:00:00Z'),
              requirements: 47,
              compliantRequirements: 45,
              nonCompliantRequirements: 2,
              actionItemsOpen: 3,
              actionItemsCompleted: 28,
              certificationStatus: 'active',
              expiryDate: new Date('2025-12-31T00:00:00Z'),
              auditor: 'EU Compliance Solutions',
              riskLevel: 'low',
            },
          ],
          actionItems: [
            {
              id: 'action-001',
              regulation: 'GDPR',
              priority: 'high',
              title: 'Update Data Processing Records',
              description: 'Complete documentation of new data processing activities for Q1 2025',
              assignee: 'data_protection_officer',
              dueDate: new Date('2025-02-15T00:00:00Z'),
              status: 'in_progress',
              progress: 67,
              estimatedHours: 8,
              completedHours: 5.5,
              riskIfDelayed: 'regulatory_fine',
            },
          ],
          complianceMetrics: {
            overallComplianceScore: 95.2,
            regulationsMonitored: 4,
            activeCompliance: 4,
            nonCompliantRegulations: 0,
            overdueActionItems: 1,
            upcomingAudits: 3,
            certificationRenewals: 2,
            complianceTrainingCompletion: 94.8,
          },
        },
        accessControl: {
          userAccessMatrix: {
            totalUsers: 247,
            activeUsers: 234,
            inactiveUsers: 13,
            privilegedUsers: 23,
            serviceAccounts: 8,
            pendingAccessRequests: 5,
            expiredAccounts: 2,
            multiFactorEnabled: 231,
            singleSignOnEnabled: 198,
          },
          roleBasedAccess: {
            totalRoles: 15,
            customRoles: 8,
            defaultRoles: 7,
            roleAssignments: 247,
            roleConflicts: 0,
            segregationOfDutiesViolations: 0,
            leastPrivilegeCompliance: 94.3,
          },
        },
      };

      res.json(securityComplianceData);
    } catch (error) {
      log.error('Error fetching security compliance dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch security compliance dashboard' });
    }
  });

  // ──────────────────────────────────────────────
  // ERP Integration Hub Routes (Mock)
  // ──────────────────────────────────────────────

  app.get('/api/erp-integration/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const erpIntegrationData = {
        integrationOverview: {
          totalIntegrations: 18,
          activeIntegrations: 16,
          failedIntegrations: 2,
          syncSuccessRate: 98.7,
          dataPointsSynced: 2.4,
          syncFrequency: 'real-time',
          lastSyncCompleted: new Date('2025-02-01T08:15:00Z'),
          nextScheduledSync: new Date('2025-02-01T08:30:00Z'),
          averageLatency: 234,
          systemUptime: 99.94,
          errorRate: 0.13,
        },
        erpSystems: [
          {
            id: 'sap-001',
            name: 'SAP Business One',
            type: 'erp',
            category: 'financial_management',
            status: 'active',
            version: '10.0',
            lastSync: new Date('2025-02-01T08:15:00Z'),
            syncFrequency: 'real-time',
            successRate: 99.2,
            recordsProcessed: 45672,
            apiCalls: 234567,
            dataVolume: 1.2,
            latency: 187,
            capabilities: [
              'accounting',
              'financial_reporting',
              'inventory',
              'procurement',
              'sales_orders',
            ],
            endpoints: [
              {
                name: 'Chart of Accounts',
                url: '/api/ChartOfAccounts',
                status: 'active',
                lastCall: new Date('2025-02-01T08:14:00Z'),
              },
              {
                name: 'Business Partners',
                url: '/api/BusinessPartners',
                status: 'active',
                lastCall: new Date('2025-02-01T08:13:00Z'),
              },
            ],
            authentication: {
              type: 'oauth2',
              status: 'authenticated',
              tokenExpiry: new Date('2025-02-15T00:00:00Z'),
              lastRefresh: new Date('2025-02-01T06:00:00Z'),
            },
            recentSync: {
              recordsCreated: 124,
              recordsUpdated: 3456,
              recordsDeleted: 23,
              errors: 5,
              warnings: 12,
              duration: 2.4,
            },
          },
          {
            id: 'oracle-001',
            name: 'Oracle NetSuite',
            type: 'erp',
            category: 'cloud_erp',
            status: 'active',
            version: '2024.2',
            lastSync: new Date('2025-02-01T08:14:00Z'),
            syncFrequency: 'hourly',
            successRate: 97.8,
            recordsProcessed: 78934,
            apiCalls: 456789,
            dataVolume: 2.1,
            latency: 298,
            capabilities: ['financial_management', 'crm', 'inventory', 'e_commerce', 'analytics'],
            endpoints: [
              {
                name: 'Customers',
                url: '/services/rest/record/v1/customer',
                status: 'active',
                lastCall: new Date('2025-02-01T08:13:00Z'),
              },
            ],
            authentication: {
              type: 'token_based',
              status: 'authenticated',
              tokenExpiry: new Date('2025-03-01T00:00:00Z'),
              lastRefresh: new Date('2025-02-01T00:00:00Z'),
            },
            recentSync: {
              recordsCreated: 89,
              recordsUpdated: 2134,
              recordsDeleted: 12,
              errors: 3,
              warnings: 8,
              duration: 3.7,
            },
          },
        ],
        dataSynchronization: {
          syncSchedules: [
            {
              id: 'schedule-001',
              name: 'Customer Data Sync',
              description: 'Synchronize customer records across all ERP systems',
              systems: ['SAP Business One', 'Oracle NetSuite', 'Microsoft Dynamics 365'],
              frequency: 'real-time',
              lastRun: new Date('2025-02-01T08:15:00Z'),
              nextRun: new Date('2025-02-01T08:30:00Z'),
              status: 'active',
              successRate: 99.1,
              recordsProcessed: 12456,
              averageDuration: 2.3,
              conflicts: 3,
              resolvedConflicts: 3,
            },
          ],
          conflictResolution: {
            totalConflicts: 34,
            resolvedConflicts: 31,
            pendingResolution: 3,
            autoResolutionRate: 91.2,
            resolutionRules: [{ rule: 'Last Modified Wins', usage: 67, success: 94.1 }],
          },
          dataQuality: {
            overallScore: 96.8,
            completeness: 98.2,
            accuracy: 95.7,
            consistency: 97.1,
            timeliness: 96.3,
            duplicates: 23,
            missingFields: 156,
            validationErrors: 45,
          },
        },
        businessProcessAutomation: {
          automatedProcesses: [
            {
              id: 'process-001',
              name: 'Order-to-Cash Automation',
              description: 'Automated end-to-end order processing from creation to payment',
              systems: ['Oracle NetSuite', 'SAP Business One', 'Printyx CRM'],
              status: 'active',
              executionsToday: 234,
              successRate: 97.8,
              averageProcessingTime: 45,
              steps: [
                {
                  step: 'Order Creation',
                  system: 'Printyx CRM',
                  avgTime: 5,
                  successRate: 99.2,
                },
              ],
              kpis: {
                cycleTimeReduction: 67.3,
                errorReduction: 84.2,
                costSavings: 45600,
                customerSatisfaction: 94.7,
              },
            },
          ],
          workflowOrchestration: {
            totalWorkflows: 67,
            activeWorkflows: 64,
            pausedWorkflows: 2,
            erroredWorkflows: 1,
            executionsToday: 2134,
            successRate: 96.7,
            averageExecutionTime: 23.4,
            parallelExecutions: 12,
            queuedExecutions: 5,
          },
        },
        monitoring: {
          systemHealth: [
            {
              system: 'SAP Business One',
              status: 'healthy',
              uptime: 99.8,
              lastCheck: new Date('2025-02-01T08:14:00Z'),
              responseTime: 187,
            },
            {
              system: 'Oracle NetSuite',
              status: 'healthy',
              uptime: 99.2,
              lastCheck: new Date('2025-02-01T08:13:00Z'),
              responseTime: 298,
            },
          ],
          alerts: [
            {
              id: 'alert-001',
              type: 'performance_degradation',
              severity: 'medium',
              system: 'Oracle NetSuite',
              message: 'Response time increased by 25% in last hour',
              triggeredAt: new Date('2025-02-01T07:45:00Z'),
              status: 'investigating',
              assignee: 'integration_team',
            },
          ],
          performanceMetrics: {
            dataLatency: 234,
            syncThroughput: 12456,
            errorRate: 0.13,
            availabilityScore: 99.7,
            integrationComplexity: 8.7,
            maintenanceOverhead: 4.2,
          },
        },
      };

      res.json(erpIntegrationData);
    } catch (error) {
      log.error('Error fetching ERP integration dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch ERP integration dashboard' });
    }
  });

  // ──────────────────────────────────────────────
  // Advanced Integration Hub Routes - Real Implementation
  // ──────────────────────────────────────────────

  app.get('/api/integration-hub/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Use real dashboard service instead of mock data
      const integrationHubData = await DashboardService.getDashboardData(tenantId);
      res.json(integrationHubData);
    } catch (error) {
      log.error('Error fetching integration hub dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch integration hub dashboard' });
    }
  });
}
