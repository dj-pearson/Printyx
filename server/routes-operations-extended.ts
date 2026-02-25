/**
 * Operations Extended Routes
 * Equipment lifecycle, commission, monitoring, maintenance, security compliance, phone-in tickets
 * Extracted from routes.ts monolith.
 */
import type { Express } from 'express';
import { db } from './db';
import { storage } from './storage';
import { and, eq, sql, desc, or, asc, inArray, lte, gte } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-operations-extended');

import { businessRecords, inventoryItems, serviceTickets, invoices } from '@shared/schema';
import { serviceContracts } from '@shared/schema';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { requireAuth } from './replitAuth';

export function registerOperationsExtendedRoutes(app: Express) {
  // ============= REMOTE MONITORING & IoT INTEGRATION ROUTES =============

  // Get remote monitoring equipment status
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

  // Get remote monitoring fleet overview
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

  // ============= SECURITY & COMPLIANCE MANAGEMENT ROUTES =============

  // Security & Compliance Dashboard (comprehensive)
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

  // ============= PERFORMANCE MONITORING ROUTES =============

  // Get performance metrics
  app.get(
    '/api/performance/metrics',

    async (req: any, res) => {
      try {
        const tenantId = req.session?.tenantId;
        const metrics = await storage.getPerformanceMetrics(tenantId);
        res.json(metrics);
      } catch (error) {
        log.error('Error fetching performance metrics:', error);
        res.status(500).json({ error: 'Failed to fetch performance metrics' });
      }
    },
  );

  // Get performance alerts
  app.get('/api/performance/alerts', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const alerts: any[] = [];

      try {
        // 1) Low stock alerts
        const lowStockItems = await db
          .select({
            id: inventoryItems.id,
            name: inventoryItems.name,
            category: inventoryItems.category,
            currentStock: inventoryItems.quantityOnHand,
            minThreshold: inventoryItems.reorderPoint,
            reorderQuantity: inventoryItems.reorderQuantity,
            primaryVendor: inventoryItems.primaryVendor,
          })
          .from(inventoryItems)
          .where(and(eq(inventoryItems.tenantId, tenantId), sql`quantity_on_hand <= reorder_point`))
          .orderBy(asc(inventoryItems.quantityOnHand))
          .limit(20);

        alerts.push(
          ...lowStockItems.map((item) => ({
            id: `low_stock_${item.id}`,
            type: 'low_stock',
            severity: 'medium',
            title: `Low Stock: ${item.name}`,
            message: `${item.name} is running low (${item.currentStock} remaining, reorder at ${item.minThreshold})`,
            category: 'business',
            timestamp: new Date().toISOString(),
          })),
        );
      } catch (error) {
        log.warn('Failed to fetch low stock alerts:', error);
      }

      try {
        // 2) Dispatch delay alerts
        const delayedTickets = await db
          .select({
            id: serviceTickets.id,
            ticketNumber: serviceTickets.ticketNumber,
            title: serviceTickets.title,
            scheduledDate: serviceTickets.scheduledDate,
            status: serviceTickets.status,
          })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.tenantId, tenantId),
              sql`scheduled_date < NOW()`,
              sql`status NOT IN ('completed', 'cancelled')`,
            ),
          )
          .orderBy(asc(serviceTickets.scheduledDate))
          .limit(10);

        alerts.push(
          ...delayedTickets.map((ticket) => ({
            id: `dispatch_delay_${ticket.id}`,
            type: 'dispatch_delay',
            severity: 'high',
            title: `Dispatch Delay: Ticket ${ticket.ticketNumber}`,
            message: `Service ticket ${ticket.ticketNumber} (${ticket.title}) was scheduled for ${new Date(ticket.scheduledDate!).toLocaleString()} but is still ${ticket.status}.`,
            category: 'performance',
            timestamp: new Date().toISOString(),
          })),
        );
      } catch (error) {
        log.warn('Failed to fetch dispatch delay alerts:', error);
      }

      try {
        // 3) Billing anomaly alerts
        const billingAnomalies = await db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            createdAt: invoices.createdAt,
            dueDate: invoices.dueDate,
            status: invoices.status,
            totalAmount: invoices.totalAmount,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              sql`(status = 'overdue') OR (due_date < NOW() AND status = 'pending')`,
            ),
          )
          .orderBy(desc(invoices.createdAt))
          .limit(10);

        alerts.push(
          ...billingAnomalies.map((invoice) => ({
            id: `billing_anomaly_${invoice.id}`,
            type: 'billing_anomaly',
            severity: invoice.status === 'overdue' ? 'critical' : 'medium',
            title: `Billing Issue: Invoice ${invoice.invoiceNumber}`,
            message:
              invoice.status === 'overdue'
                ? `Invoice ${invoice.invoiceNumber} is overdue since ${new Date(invoice.dueDate!).toLocaleDateString()}.`
                : `Invoice ${invoice.invoiceNumber} is past due (Due: ${new Date(invoice.dueDate!).toLocaleDateString()}).`,
            category: 'business',
            timestamp: new Date().toISOString(),
          })),
        );
      } catch (error) {
        log.warn('Failed to fetch billing anomaly alerts:', error);
      }

      try {
        // 4) Contract expiration alerts
        const expiringContracts = await db
          .select({
            id: serviceContracts.id,
            contractNumber: serviceContracts.contractNumber,
            customerId: serviceContracts.customerId,
            customerName: businessRecords.companyName,
            endDate: serviceContracts.endDate,
            daysUntilExpiration:
              sql`DATE_PART('day', ${serviceContracts.endDate}::timestamp - NOW())`.as('days'),
            monthlyValue: serviceContracts.monthlyBaseRate,
            annualValue: sql`COALESCE(${serviceContracts.monthlyBaseRate}, 0) * 12`.as(
              'annualValue',
            ),
          })
          .from(serviceContracts)
          .leftJoin(businessRecords, eq(serviceContracts.customerId, businessRecords.id))
          .where(
            and(
              eq(serviceContracts.tenantId, tenantId),
              eq(serviceContracts.contractStatus, 'active'),
              lte(serviceContracts.endDate, sql`NOW() + INTERVAL '90 days'`), // Next 90 days
              gte(serviceContracts.endDate, sql`NOW()`),
            ),
          )
          .orderBy(asc(serviceContracts.endDate))
          .limit(15);

        alerts.push(
          ...expiringContracts.map((contract) => {
            const days = parseInt(String(contract.daysUntilExpiration)) || 0;
            let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
            let type = 'contract_renewal';

            if (days <= 30) {
              severity = 'critical';
              type = 'contract_urgent';
            } else if (days <= 60) {
              severity = 'high';
            }

            const annualValue = parseFloat(String(contract.annualValue)) || 0;
            const valueMsg =
              annualValue > 0 ? ` ($${annualValue.toLocaleString()}/year at risk)` : '';

            return {
              id: `contract_expiration_${contract.id}`,
              type,
              severity,
              title: `Contract Expiring: ${contract.customerName}`,
              message: `Contract ${contract.contractNumber} expires in ${days} days (${new Date(contract.endDate).toLocaleDateString()})${valueMsg}`,
              category: 'business',
              timestamp: new Date().toISOString(),
              metadata: {
                contractId: contract.id,
                customerId: contract.customerId,
                daysRemaining: days,
                annualValue: annualValue,
              },
            };
          }),
        );
      } catch (error) {
        log.warn('Failed to fetch contract expiration alerts:', error);
      }

      res.json(alerts);
    } catch (error) {
      log.error('Error fetching alerts:', error);
      res.status(500).json({ message: 'Failed to fetch alerts' });
    }
  });

  // ============= COMMISSION MANAGEMENT ROUTES (Block 1) =============

  // Get commission metrics
  app.get(
    '/api/commission/metrics',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COALESCE(SUM(net_payment_amount), 0) as total_paid FROM commission_payments WHERE tenant_id = $1 AND payment_status = 'completed' AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)`,
          `SELECT COALESCE(SUM(net_commission_amount), 0) as pending_commissions FROM commission_calculations WHERE tenant_id = $1 AND payment_status = 'pending'`,
          `SELECT COALESCE(AVG(base_commission_rate), 0) as avg_rate FROM commission_calculations WHERE tenant_id = $1`,
          `SELECT COALESCE(MAX(net_commission_amount), 0) as top_commission FROM commission_calculations WHERE tenant_id = $1`,
          `SELECT COUNT(*) as active_disputes FROM commission_disputes WHERE tenant_id = $1 AND status IN ('open', 'under_review')`,
          `SELECT COALESCE(AVG(achievement_percentage), 0) as quota_attainment FROM sales_quotas WHERE tenant_id = $1 AND status = 'active'`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId])),
        );

        res.json({
          totalCommissionsPaid: parseFloat(results[0].rows[0].total_paid),
          pendingCommissions: parseFloat(results[1].rows[0].pending_commissions),
          averageCommissionRate: parseFloat(results[2].rows[0].avg_rate),
          topPerformerCommission: parseFloat(results[3].rows[0].top_commission),
          activeDisputes: parseInt(results[4].rows[0].active_disputes),
          quotaAttainment: parseFloat(results[5].rows[0].quota_attainment),
        });
      } catch (error) {
        log.error('Error fetching commission metrics:', error);
        res.status(500).json({ error: 'Failed to fetch commission metrics' });
      }
    },
  );

  // Get commission structures
  app.get(
    '/api/commission/structures',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT *
        FROM commission_structures
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching commission structures:', error);
        res.status(500).json({ error: 'Failed to fetch commission structures' });
      }
    },
  );

  // Create commission structure
  app.post(
    '/api/commission/structures',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          structure_name,
          structure_type,
          applies_to,
          base_rate,
          calculation_basis,
          calculation_period,
          minimum_threshold,
          maximum_cap,
          effective_date,
          expiration_date,
        } = req.body;

        const query = `
        INSERT INTO commission_structures (
          tenant_id, structure_name, structure_type, applies_to, base_rate,
          calculation_basis, calculation_period, minimum_threshold, maximum_cap,
          effective_date, expiration_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          structure_name,
          structure_type,
          applies_to,
          base_rate,
          calculation_basis,
          calculation_period,
          minimum_threshold,
          maximum_cap,
          effective_date,
          expiration_date,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating commission structure:', error);
        res.status(500).json({ error: 'Failed to create commission structure' });
      }
    },
  );

  // Get commission calculations
  app.get(
    '/api/commission/calculations',

    async (req: any, res) => {
      try {
        const period = String((req.query as any)?.period || '');
        const status = String((req.query as any)?.status || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['cc.tenantId = $1'];
        const queryParams = [tenantId];

        if (period && period !== 'all') {
          switch (period) {
            case 'current_month':
              whereConditions.push(
                `EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)`,
              );
              break;
            case 'last_month':
              whereConditions.push(
                `EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')`,
              );
              break;
            case 'current_quarter':
              whereConditions.push(
                `EXTRACT(QUARTER FROM cc.calculation_period_start) = EXTRACT(QUARTER FROM CURRENT_DATE) AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)`,
              );
              break;
          }
        }

        if (status && status !== 'all') {
          whereConditions.push(`cc.payment_status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        const query = `
        SELECT
          cc.*,
          u.name as employee_name,
          cs.structure_name
        FROM commission_calculations cc
        LEFT JOIN users u ON cc.employee_id = u.id
        LEFT JOIN commission_structures cs ON cc.commission_structure_id = cs.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY cc.createdAt DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching commission calculations:', error);
        res.status(500).json({ error: 'Failed to fetch commission calculations' });
      }
    },
  );

  // Run commission calculations
  app.post(
    '/api/commission/calculations/run',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Sample commission calculations for demo
        const sampleCalculations = [
          {
            employee_name: 'John Smith',
            total_sales: 125000,
            commission_rate: 0.05,
            commission_amount: 6250,
          },
          {
            employee_name: 'Sarah Johnson',
            total_sales: 98000,
            commission_rate: 0.045,
            commission_amount: 4410,
          },
        ];

        // Get active users
        const usersQuery = `SELECT id, name FROM users WHERE tenant_id = $1 AND role LIKE '%sales%' LIMIT 2`;
        const usersResult = await db.$client.query(usersQuery, [tenantId]);
        const users = usersResult.rows;

        // Get active commission structure
        const structureQuery = `SELECT id FROM commission_structures WHERE tenant_id = $1 AND is_active = true LIMIT 1`;
        const structureResult = await db.$client.query(structureQuery, [tenantId]);
        const structureId = structureResult.rows[0]?.id;

        if (!structureId) {
          return res.status(400).json({ error: 'No active commission structure found' });
        }

        const startDate = new Date();
        startDate.setDate(1); // First day of current month
        const endDate = new Date();

        for (let i = 0; i < Math.min(sampleCalculations.length, users.length); i++) {
          const calc = sampleCalculations[i];
          const user = users[i];

          const query = `
          INSERT INTO commission_calculations (
            tenant_id, calculation_period_start, calculation_period_end,
            employee_id, commission_structure_id, total_sales_amount,
            commission_base_amount, base_commission_rate, base_commission_amount,
            gross_commission_amount, net_commission_amount, calculated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

          await db.$client.query(query, [
            tenantId,
            startDate,
            endDate,
            user.id,
            structureId,
            calc.total_sales,
            calc.total_sales,
            calc.commission_rate,
            calc.commission_amount,
            calc.commission_amount,
            calc.commission_amount,
            userId,
          ]);
        }

        res.status(201).json({
          message: 'Commission calculations completed',
          calculations_created: Math.min(sampleCalculations.length, users.length),
        });
      } catch (error) {
        log.error('Error running commission calculations:', error);
        res.status(500).json({ error: 'Failed to run commission calculations' });
      }
    },
  );

  // Get sales quotas
  app.get(
    '/api/commission/quotas',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          sq.*,
          u.name as employee_name
        FROM sales_quotas sq
        LEFT JOIN users u ON sq.employee_id = u.id
        WHERE sq.tenantId = $1
        ORDER BY sq.createdAt DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching sales quotas:', error);
        res.status(500).json({ error: 'Failed to fetch sales quotas' });
      }
    },
  );

  // Create sales quota
  app.post(
    '/api/commission/quotas',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          employee_id,
          quota_period_start,
          quota_period_end,
          quota_type,
          quota_amount,
          stretch_goal_amount,
          minimum_threshold,
        } = req.body;

        const query = `
        INSERT INTO sales_quotas (
          tenant_id, employee_id, quota_period_start, quota_period_end,
          quota_type, quota_amount, stretch_goal_amount, minimum_threshold,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          employee_id,
          quota_period_start,
          quota_period_end,
          quota_type,
          quota_amount,
          stretch_goal_amount,
          minimum_threshold,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating sales quota:', error);
        res.status(500).json({ error: 'Failed to create sales quota' });
      }
    },
  );

  // Get commission payments
  app.get(
    '/api/commission/payments',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          cp.*,
          u.name as employee_name
        FROM commission_payments cp
        LEFT JOIN users u ON cp.employee_id = u.id
        WHERE cp.tenantId = $1
        ORDER BY cp.payment_date DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching commission payments:', error);
        res.status(500).json({ error: 'Failed to fetch commission payments' });
      }
    },
  );

  // Get commission disputes
  app.get(
    '/api/commission/disputes',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          cd.*,
          u.name as employee_name
        FROM commission_disputes cd
        LEFT JOIN users u ON cd.employee_id = u.id
        WHERE cd.tenantId = $1
        ORDER BY cd.createdAt DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching commission disputes:', error);
        res.status(500).json({ error: 'Failed to fetch commission disputes' });
      }
    },
  );

  // Create commission dispute
  app.post(
    '/api/commission/disputes',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          dispute_type,
          employee_id,
          commission_calculation_id,
          dispute_amount,
          claimed_amount,
          description,
          priority,
        } = req.body;

        const disputeNumber = `DISP-${Date.now()}`;
        const disputeDate = new Date().toISOString().split('T')[0];

        const query = `
        INSERT INTO commission_disputes (
          tenant_id, dispute_number, dispute_type, employee_id,
          commission_calculation_id, dispute_amount, claimed_amount,
          description, priority, dispute_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          disputeNumber,
          dispute_type,
          employee_id,
          commission_calculation_id,
          dispute_amount,
          claimed_amount,
          description,
          priority,
          disputeDate,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating commission dispute:', error);
        res.status(500).json({ error: 'Failed to create commission dispute' });
      }
    },
  );

  // ============= REMOTE MONITORING ROUTES =============

  // Get monitoring metrics
  app.get(
    '/api/monitoring/metrics',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as total_devices FROM iot_devices WHERE tenant_id = $1`,
          `SELECT COUNT(*) as online_devices FROM iot_devices WHERE tenant_id = $1 AND device_status = 'active'`,
          `SELECT COUNT(*) as active_alerts FROM predictive_alerts WHERE tenant_id = $1 AND alert_status IN ('open', 'acknowledged')`,
          `SELECT COUNT(*) as critical_alerts FROM predictive_alerts WHERE tenant_id = $1 AND severity = 'critical' AND alert_status IN ('open', 'acknowledged')`,
          `SELECT COALESCE(AVG(uptime_percentage), 0) as avg_uptime FROM equipment_status_monitoring WHERE tenant_id = $1`,
          `SELECT COUNT(*) as devices_attention FROM iot_devices WHERE tenant_id = $1 AND device_status IN ('error', 'maintenance')`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId])),
        );

        res.json({
          totalDevices: parseInt(results[0].rows[0].total_devices),
          onlineDevices: parseInt(results[1].rows[0].online_devices),
          activeAlerts: parseInt(results[2].rows[0].active_alerts),
          criticalAlerts: parseInt(results[3].rows[0].critical_alerts),
          averageUptime: parseFloat(results[4].rows[0].avg_uptime),
          devicesRequiringAttention: parseInt(results[5].rows[0].devices_attention),
        });
      } catch (error) {
        log.error('Error fetching monitoring metrics:', error);
        res.status(500).json({ error: 'Failed to fetch monitoring metrics' });
      }
    },
  );

  // Get IoT devices
  app.get(
    '/api/monitoring/devices',

    async (req: any, res) => {
      try {
        const type = String((req.query as any)?.type || '');
        const status = String((req.query as any)?.status || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['iot.tenantId = $1'];
        const queryParams = [tenantId];

        if (type && type !== 'all') {
          whereConditions.push(`iot.device_type = $${queryParams.length + 1}`);
          queryParams.push(type);
        }

        if (status && status !== 'all') {
          whereConditions.push(`iot.device_status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        const query = `
        SELECT
          iot.*,
          br.companyName as customer_name
        FROM iot_devices iot
        LEFT JOIN business_records br ON iot.business_record_id = br.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY iot.createdAt DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching IoT devices:', error);
        res.status(500).json({ error: 'Failed to fetch IoT devices' });
      }
    },
  );

  // Register IoT device
  app.post(
    '/api/monitoring/devices',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          device_name,
          device_type,
          manufacturer,
          model,
          device_serial_number,
          connection_type,
          customer_id,
          installation_location,
          ip_address,
          monitoring_enabled,
          data_collection_interval,
        } = req.body;

        const deviceId = `DEV-${Date.now()}`;

        const query = `
        INSERT INTO iot_devices (
          tenant_id, device_id, device_name, device_type, manufacturer,
          model, device_serial_number, connection_type, customer_id,
          business_record_id, installation_location, ip_address,
          monitoring_enabled, data_collection_interval
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          deviceId,
          device_name,
          device_type,
          manufacturer,
          model,
          device_serial_number,
          connection_type,
          customer_id,
          customer_id,
          installation_location,
          ip_address,
          monitoring_enabled,
          data_collection_interval,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error registering IoT device:', error);
        res.status(500).json({ error: 'Failed to register IoT device' });
      }
    },
  );

  // Get equipment status
  app.get(
    '/api/monitoring/equipment-status',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          esm.*,
          iot.device_name
        FROM equipment_status_monitoring esm
        LEFT JOIN iot_devices iot ON esm.device_id = iot.device_id
        WHERE esm.tenantId = $1
        ORDER BY esm.status_timestamp DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching equipment status:', error);
        res.status(500).json({ error: 'Failed to fetch equipment status' });
      }
    },
  );

  // Get predictive alerts
  app.get(
    '/api/monitoring/alerts',

    async (req: any, res) => {
      try {
        const severity = String((req.query as any)?.severity || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['pa.tenantId = $1'];
        const queryParams = [tenantId];

        if (severity && severity !== 'all') {
          whereConditions.push(`pa.severity = $${queryParams.length + 1}`);
          queryParams.push(severity);
        }

        const query = `
        SELECT
          pa.*,
          iot.device_name,
          br.companyName as customer_name
        FROM predictive_alerts pa
        LEFT JOIN iot_devices iot ON pa.device_id = iot.device_id
        LEFT JOIN business_records br ON pa.business_record_id = br.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY pa.createdAt DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching predictive alerts:', error);
        res.status(500).json({ error: 'Failed to fetch predictive alerts' });
      }
    },
  );

  // Get performance trends
  app.get(
    '/api/monitoring/trends',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          dpt.*,
          iot.device_name
        FROM device_performance_trends dpt
        LEFT JOIN iot_devices iot ON dpt.device_id = iot.device_id
        WHERE dpt.tenantId = $1
        ORDER BY dpt.createdAt DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching performance trends:', error);
        res.status(500).json({ error: 'Failed to fetch performance trends' });
      }
    },
  );

  // Sync devices (simulate data collection)
  app.post('/api/monitoring/sync', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Get active devices
      const devicesQuery = `SELECT * FROM iot_devices WHERE tenant_id = $1 AND monitoring_enabled = true`;
      const devicesResult = await db.$client.query(devicesQuery, [tenantId]);
      const devices = devicesResult.rows;

      let syncedDevices = 0;

      for (const device of devices) {
        // Update device ping time
        await db.$client.query(
          `UPDATE iot_devices SET last_ping_time = NOW(), last_data_received = NOW() WHERE id = $1`,
          [device.id],
        );

        // Create sample equipment status
        const statusQuery = `
          INSERT INTO equipment_status_monitoring (
            tenant_id, equipment_id, device_id, status_timestamp,
            operational_status, power_status, connectivity_status,
            current_job_count, total_page_count, error_count,
            temperature, humidity, uptime_percentage
          ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        await db.$client.query(statusQuery, [
          tenantId,
          device.equipmentId || device.device_id,
          device.device_id,
          'running',
          'on',
          'connected',
          Math.floor(Math.random() * 5), // current_job_count
          Math.floor(Math.random() * 100000) + 50000, // total_page_count
          Math.floor(Math.random() * 3), // error_count
          20 + Math.random() * 10, // temperature
          40 + Math.random() * 20, // humidity
          95 + Math.random() * 5, // uptime_percentage
        ]);

        syncedDevices++;
      }

      res.status(200).json({
        message: 'Device sync completed',
        synced_devices: syncedDevices,
      });
    } catch (error) {
      log.error('Error syncing devices:', error);
      res.status(500).json({ error: 'Failed to sync devices' });
    }
  });

  // ============= COMMISSION MANAGEMENT ROUTES (Block 2 - Transaction-based) =============

  // Get commission metrics (transaction-based variant)
  app.get(
    '/api/commission/metrics',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COALESCE(SUM(final_payment_amount), 0) as total_paid FROM commission_payments WHERE tenant_id = $1 AND payment_status = 'processed'`,
          `SELECT COALESCE(SUM(commission_amount), 0) as total_pending FROM commission_transactions WHERE tenant_id = $1 AND payment_status = 'unpaid'`,
          `SELECT COALESCE(AVG(commission_rate), 0) as avg_rate FROM commission_transactions WHERE tenant_id = $1`,
          `SELECT COUNT(*) as total_reps FROM sales_representatives WHERE tenant_id = $1 AND employment_status = 'active'`,
          `SELECT COUNT(*) as transactions_this_month FROM commission_transactions WHERE tenant_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
          `SELECT COUNT(*) as active_disputes FROM commission_disputes WHERE tenant_id = $1 AND dispute_status IN ('submitted', 'under_review')`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId])),
        );

        res.json({
          totalCommissionPaid: parseFloat(results[0].rows[0].total_paid),
          totalCommissionPending: parseFloat(results[1].rows[0].total_pending),
          averageCommissionRate: parseFloat(results[2].rows[0].avg_rate),
          totalSalesRepresentatives: parseInt(results[3].rows[0].total_reps),
          totalTransactionsThisMonth: parseInt(results[4].rows[0].transactions_this_month),
          totalDisputesActive: parseInt(results[5].rows[0].active_disputes),
        });
      } catch (error) {
        log.error('Error fetching commission metrics:', error);
        res.status(500).json({ error: 'Failed to fetch commission metrics' });
      }
    },
  );

  // Get commission structures (transaction-based variant)
  app.get(
    '/api/commission/structures',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT *
        FROM commission_structures
        WHERE tenant_id = $1
        ORDER BY is_active DESC, structure_name ASC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching commission structures:', error);
        res.status(500).json({ error: 'Failed to fetch commission structures' });
      }
    },
  );

  // Create commission structure (transaction-based variant)
  app.post(
    '/api/commission/structures',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          structure_name,
          structure_type,
          product_category,
          base_rate,
          calculation_period,
          payment_schedule,
          effective_start_date,
          effective_end_date,
          is_active,
        } = req.body;

        const query = `
        INSERT INTO commission_structures (
          tenant_id, structure_name, structure_type, applies_to,
          base_rate, calculation_period, payment_schedule,
          effective_date, expiration_date, is_active,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          structure_name,
          structure_type,
          product_category || 'all',
          base_rate,
          calculation_period,
          payment_schedule,
          effective_start_date,
          effective_end_date,
          is_active,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating commission structure:', error);
        res.status(500).json({ error: 'Failed to create commission structure' });
      }
    },
  );

  // Get sales representatives
  app.get(
    '/api/commission/sales-reps',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT *
        FROM sales_representatives
        WHERE tenant_id = $1
        ORDER BY employment_status DESC, rep_name ASC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching sales representatives:', error);
        res.status(500).json({ error: 'Failed to fetch sales representatives' });
      }
    },
  );

  // Create sales representative
  app.post(
    '/api/commission/sales-reps',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          employee_id,
          rep_name,
          rep_email,
          rep_phone,
          manager_id,
          primary_commission_structure_id,
          employment_status,
        } = req.body;

        const query = `
        INSERT INTO sales_representatives (
          tenant_id, employee_id, rep_name, rep_email, rep_phone,
          manager_id, primary_commission_structure_id, employment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          employee_id,
          rep_name,
          rep_email,
          rep_phone,
          manager_id,
          primary_commission_structure_id,
          employment_status,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating sales representative:', error);
        res.status(500).json({ error: 'Failed to create sales representative' });
      }
    },
  );

  // Get commission transactions
  app.get(
    '/api/commission/transactions',

    async (req: any, res) => {
      try {
        const period = String((req.query as any)?.period || '');
        const status = String((req.query as any)?.status || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['tenant_id = $1'];
        const queryParams = [tenantId];

        // Add period filter
        if (period && period !== 'all') {
          switch (period) {
            case 'current_month':
              whereConditions.push(
                `DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE)`,
              );
              break;
            case 'last_month':
              whereConditions.push(
                `DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
              );
              break;
            case 'current_quarter':
              whereConditions.push(
                `DATE_TRUNC('quarter', sale_date) = DATE_TRUNC('quarter', CURRENT_DATE)`,
              );
              break;
            case 'last_quarter':
              whereConditions.push(
                `DATE_TRUNC('quarter', sale_date) = DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')`,
              );
              break;
            case 'current_year':
              whereConditions.push(
                `DATE_TRUNC('year', sale_date) = DATE_TRUNC('year', CURRENT_DATE)`,
              );
              break;
          }
        }

        if (status && status !== 'all') {
          whereConditions.push(`commission_status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        const query = `
        SELECT *
        FROM commission_transactions
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY sale_date DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching commission transactions:', error);
        res.status(500).json({ error: 'Failed to fetch commission transactions' });
      }
    },
  );

  // Create commission transaction
  app.post(
    '/api/commission/transactions',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          transaction_type,
          sales_rep_id,
          customer_name,
          sale_amount,
          commission_rate,
          sale_date,
          product_category,
        } = req.body;

        // Get sales rep name
        const repQuery = `SELECT rep_name FROM sales_representatives WHERE id = $1 AND tenant_id = $2`;
        const repResult = await db.$client.query(repQuery, [sales_rep_id, tenantId]);

        if (repResult.rows.length === 0) {
          return res.status(404).json({ error: 'Sales representative not found' });
        }

        const sales_rep_name = repResult.rows[0].rep_name;
        const commission_amount = sale_amount * commission_rate;
        const commission_period = new Date(sale_date).toISOString().slice(0, 7); // YYYY-MM format

        const query = `
        INSERT INTO commission_transactions (
          tenant_id, transaction_type, sales_rep_id, sales_rep_name,
          customer_name, sale_amount, commission_rate, commission_amount,
          sale_date, commission_period, product_category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          transaction_type,
          sales_rep_id,
          sales_rep_name,
          customer_name,
          sale_amount,
          commission_rate,
          commission_amount,
          sale_date,
          commission_period,
          product_category,
        ]);

        // Update sales rep performance metrics
        const updateRepQuery = `
        UPDATE sales_representatives
        SET
          current_month_sales = current_month_sales + $1,
          current_quarter_sales = current_quarter_sales + $1,
          current_year_sales = current_year_sales + $1
        WHERE id = $2 AND tenant_id = $3
      `;

        await db.$client.query(updateRepQuery, [sale_amount, sales_rep_id, tenantId]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating commission transaction:', error);
        res.status(500).json({ error: 'Failed to create commission transaction' });
      }
    },
  );

  // Get commission payments (transaction-based variant)
  app.get(
    '/api/commission/payments',

    async (req: any, res) => {
      try {
        const period = String((req.query as any)?.period || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['tenant_id = $1'];
        const queryParams = [tenantId];

        // Add period filter
        if (period && period !== 'all') {
          switch (period) {
            case 'current_month':
              whereConditions.push(
                `DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)`,
              );
              break;
            case 'last_month':
              whereConditions.push(
                `DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
              );
              break;
            case 'current_quarter':
              whereConditions.push(
                `DATE_TRUNC('quarter', payment_date) = DATE_TRUNC('quarter', CURRENT_DATE)`,
              );
              break;
            case 'current_year':
              whereConditions.push(
                `DATE_TRUNC('year', payment_date) = DATE_TRUNC('year', CURRENT_DATE)`,
              );
              break;
          }
        }

        const query = `
        SELECT *
        FROM commission_payments
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY payment_date DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching commission payments:', error);
        res.status(500).json({ error: 'Failed to fetch commission payments' });
      }
    },
  );

  // Get commission disputes (transaction-based variant)
  app.get(
    '/api/commission/disputes',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT *
        FROM commission_disputes
        WHERE tenant_id = $1
        ORDER BY
          CASE dispute_status
            WHEN 'submitted' THEN 1
            WHEN 'under_review' THEN 2
            ELSE 3
          END,
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          submitted_date DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching commission disputes:', error);
        res.status(500).json({ error: 'Failed to fetch commission disputes' });
      }
    },
  );

  // Create commission dispute (transaction-based variant)
  app.post(
    '/api/commission/disputes',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          dispute_type,
          sales_rep_id,
          commission_transaction_id,
          dispute_amount,
          dispute_description,
          priority,
        } = req.body;

        // Get sales rep name
        const repQuery = `SELECT rep_name FROM sales_representatives WHERE id = $1 AND tenant_id = $2`;
        const repResult = await db.$client.query(repQuery, [sales_rep_id, tenantId]);

        if (repResult.rows.length === 0) {
          return res.status(404).json({ error: 'Sales representative not found' });
        }

        const sales_rep_name = repResult.rows[0].rep_name;
        const dispute_number = `DISP-${Date.now()}`;
        const submitted_date = new Date().toISOString().split('T')[0];

        const query = `
        INSERT INTO commission_disputes (
          tenant_id, dispute_number, dispute_type, sales_rep_id,
          sales_rep_name, commission_transaction_id, dispute_amount,
          dispute_description, priority, submitted_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          dispute_number,
          dispute_type,
          sales_rep_id,
          sales_rep_name,
          commission_transaction_id,
          dispute_amount,
          dispute_description,
          priority,
          submitted_date,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating commission dispute:', error);
        res.status(500).json({ error: 'Failed to create commission dispute' });
      }
    },
  );

  // ============= SECURITY & COMPLIANCE EXTENDED ROUTES =============

  // Security dashboard (simplified)
  app.get('/api/security-compliance/security-dashboard', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user;
      res.json({
        activeSessions: 12,
        gdprRequests: 3,
        securityAlerts: 2,
        dataAccessEvents: 147,
        auditLogCount: 1250,
        lastAuditEntry: new Date().toISOString(),
        complianceScore: 94,
        riskLevel: 'low',
      });
    } catch (error) {
      log.error('Error fetching security dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch security dashboard' });
    }
  });

  // Audit logs
  app.get('/api/security-compliance/audit-logs', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user;
      const page = Number((req.query as any)?.page ?? 1);
      const limit = Number((req.query as any)?.limit ?? 50);

      const logs = Array.from(
        { length: Number.isFinite(limit) ? (limit as number) : 50 },
        (_, i) => ({
          id: `audit-${i + 1}`,
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
          userId: (req as any).user?.id,
          action: ['LOGIN', 'CREATE_CUSTOMER', 'UPDATE_CONTRACT', 'DELETE_INVOICE'][i % 4],
          resource: ['auth', 'customers', 'contracts', 'invoices'][i % 4],
          severity: ['low', 'medium', 'high'][i % 3],
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          success: Math.random() > 0.1,
        }),
      );

      res.json({
        logs,
        total: 1250,
        page: Number.isFinite(page) ? (page as number) : 1,
        limit: Number.isFinite(limit) ? (limit as number) : 50,
      });
    } catch (error) {
      log.error('Error fetching audit logs:', error);
      res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
  });

  // GDPR requests
  app.get('/api/security-compliance/gdpr-requests', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user;

      const requests = [
        {
          id: 'gdpr-1',
          requestType: 'access',
          dataSubject: 'john.doe@example.com',
          status: 'pending',
          submittedAt: new Date(Date.now() - 86400000).toISOString(),
          dueDate: new Date(Date.now() + 29 * 86400000).toISOString(),
          description: 'Request for all personal data under GDPR Article 15',
        },
        {
          id: 'gdpr-2',
          requestType: 'deletion',
          dataSubject: 'jane.smith@example.com',
          status: 'in_progress',
          submittedAt: new Date(Date.now() - 172800000).toISOString(),
          dueDate: new Date(Date.now() + 28 * 86400000).toISOString(),
          description: 'Request for data deletion under GDPR Article 17',
        },
      ];

      res.json(requests);
    } catch (error) {
      log.error('Error fetching GDPR requests:', error);
      res.status(500).json({ message: 'Failed to fetch GDPR requests' });
    }
  });

  // Security sessions
  app.get('/api/security-compliance/security-sessions', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user;

      const sessions = [
        {
          id: 'session-1',
          userId: req.user.id,
          userEmail: req.user.email,
          ipAddress: '192.168.1.100',
          location: 'New York, NY',
          device: 'Chrome on Windows',
          loginTime: new Date(Date.now() - 3600000).toISOString(),
          lastActivity: new Date(Date.now() - 300000).toISOString(),
          status: 'active',
          riskScore: 'low',
        },
      ];

      res.json(sessions);
    } catch (error) {
      log.error('Error fetching security sessions:', error);
      res.status(500).json({ message: 'Failed to fetch security sessions' });
    }
  });

  // Compliance settings
  app.get('/api/security-compliance/compliance-settings', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user;

      const settings = {
        gdprResponseDays: 30,
        sessionTimeoutMinutes: 60,
        dataRetentionDays: 2555, // 7 years
        encryptionRequired: true,
        auditScope: 'full',
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: true,
        },
      };

      res.json(settings);
    } catch (error) {
      log.error('Error fetching compliance settings:', error);
      res.status(500).json({ message: 'Failed to fetch compliance settings' });
    }
  });

  // ============= PHONE-IN TICKET ROUTES =============

  // Company search endpoint for phone tickets
  app.get('/api/phone-tickets/search-companies', async (req, res) => {
    try {
      const searchTerm = String((req.query as any)?.q || '');
      const tenantId = req.headers['x-tenant-id'] as string;

      log.info('Search request:', { searchTerm, tenantId });

      if (!searchTerm || (searchTerm as string).length < 2) {
        return res.json([]);
      }

      // Debug: let's see what the exact query returns
      log.info('Executing search query for companies...');

      const searchPattern = `%${searchTerm.toString().toLowerCase()}%`;

      const searchResults = await db
        .select()
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            // Only search customers for phone-in tickets, not leads
            eq(businessRecords.recordType, 'customer'),
            or(
              sql`LOWER(company_name) LIKE ${searchPattern}`,
              sql`LOWER(primary_contact_name) LIKE ${searchPattern}`,
              sql`status ILIKE ${searchPattern}`,
            ),
          ),
        )
        .limit(10);

      log.info(
        `Found ${searchResults.length} results:`,
        searchResults.map((r) => ({
          name: r.companyName,
          type: r.recordType,
          status: r.status,
        })),
      );

      // Transform the result to match expected format
      const transformedResults = searchResults.map((record) => ({
        id: record.id,
        name: record.companyName,
        phone: record.primaryContactPhone,
        email: record.primaryContactEmail,
        address: [
          record.addressLine1,
          record.addressLine2,
          record.city,
          record.state,
          record.postalCode,
        ]
          .filter(Boolean)
          .join(', '),
      }));

      res.json(transformedResults);
    } catch (error) {
      log.error('Error searching companies:', error);
      res.status(500).json({ error: 'Failed to search companies' });
    }
  });

  // Contact search endpoint for phone tickets
  app.get('/api/phone-tickets/search-contacts/:companyId', async (req, res) => {
    try {
      const { companyId } = req.params;
      const searchTerm = String((req.query as any)?.q || '');
      const tenantId = req.headers['x-tenant-id'] as string;

      let whereConditions = [
        eq(businessRecords.tenantId, tenantId),
        eq(businessRecords.id, companyId),
      ];

      // Add search filtering only if searchTerm is provided and not empty
      if (searchTerm && (searchTerm as string).trim().length >= 1) {
        const searchPattern = `%${searchTerm.toString().toLowerCase()}%`;
        whereConditions.push(sql`LOWER(primary_contact_name) LIKE ${searchPattern}`);
      }

      // Return the primary contact from the business record itself
      const searchResults = await db
        .select({
          id: businessRecords.id,
          name: businessRecords.primaryContactName,
          phone: businessRecords.primaryContactPhone,
          email: businessRecords.primaryContactEmail,
          role: sql`'Primary Contact'`,
        })
        .from(businessRecords)
        .where(and(...whereConditions))
        .limit(10);

      // Filter out contacts with null/empty names
      const validResults = searchResults.filter(
        (contact) => contact.name && contact.name.trim().length > 0,
      );

      res.json(validResults);
    } catch (error) {
      log.error('Error searching contacts:', error);
      res.status(500).json({ error: 'Failed to search contacts' });
    }
  });

  // Equipment search endpoint for phone tickets
  app.get('/api/phone-tickets/equipment/:companyId', async (req, res) => {
    try {
      const { companyId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      // For now, return empty array as equipment table may not be properly set up
      const equipmentResults: any[] = [];
      log.info(`Equipment query for company ${companyId}: returning empty array for now`);

      res.json(equipmentResults);
    } catch (error: any) {
      log.error('Error fetching equipment:', error);
      res.status(500).json({ error: 'Failed to fetch equipment' });
    }
  });

  // Phone-in tickets POST endpoint - Now properly saves to database
  app.post('/api/phone-in-tickets', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      log.info('Phone-in ticket request body:', req.body);

      // Map request fields to database schema
      const phoneTicketData = {
        tenant_id: tenantId,
        caller_name: req.body.callerName || 'Unknown',
        caller_phone: req.body.callerPhone || '',
        caller_email: req.body.callerEmail || '',
        caller_role: req.body.callerRole || '',
        customer_id: req.body.customerId || req.body.companyId || '',
        customer_name: req.body.companyName || 'Unknown Company',
        location_address: req.body.locationAddress || '',
        location_building: req.body.locationBuilding || '',
        location_floor: req.body.locationFloor || '',
        location_room: req.body.locationRoom || '',
        equipment_id: req.body.equipmentId || '',
        equipment_brand: req.body.equipmentBrand || '',
        equipment_model: req.body.equipmentModel || '',
        equipment_serial: req.body.equipmentSerial || '',
        issue_category: req.body.issueCategory || 'other',
        issue_description: req.body.issueDescription || 'No description provided',
        priority: req.body.priority || 'medium',
        contact_method: 'phone',
        preferred_service_date: req.body.preferredServiceDate || null,
        notes: req.body.notes || '',
      };

      log.info('Creating phone-in ticket:', phoneTicketData);

      // Use direct SQL execution instead of ORM
      const result = await db.execute(sql`
        INSERT INTO phone_in_tickets (
          tenant_id, caller_name, caller_phone, caller_email, caller_role,
          customer_id, customer_name, location_address, location_building,
          location_floor, location_room, equipment_id, equipment_brand,
          equipment_model, equipment_serial, issue_category, issue_description,
          priority, contact_method, preferred_service_date, notes
        ) VALUES (
          ${phoneTicketData.tenant_id}, ${phoneTicketData.caller_name}, ${phoneTicketData.caller_phone},
          ${phoneTicketData.caller_email}, ${phoneTicketData.caller_role}, ${phoneTicketData.customer_id},
          ${phoneTicketData.customer_name}, ${phoneTicketData.location_address}, ${phoneTicketData.location_building},
          ${phoneTicketData.location_floor}, ${phoneTicketData.location_room}, ${phoneTicketData.equipment_id},
          ${phoneTicketData.equipment_brand}, ${phoneTicketData.equipment_model}, ${phoneTicketData.equipment_serial},
          ${phoneTicketData.issue_category}, ${phoneTicketData.issue_description}, ${phoneTicketData.priority},
          ${phoneTicketData.contact_method}, ${phoneTicketData.preferred_service_date}, ${phoneTicketData.notes}
        ) RETURNING *
      `);

      const createdTicket = result.rows[0];
      log.info('Phone-in ticket created successfully:', createdTicket);
      res.json({ success: true, ticket: createdTicket });
    } catch (error: any) {
      log.error('Error creating phone-in ticket:', error);
      res.status(500).json({
        error: 'Failed to create phone-in ticket',
        details: error?.message,
      });
    }
  });

  // Phone-in tickets GET endpoint
  app.get('/api/phone-in-tickets', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      const result = await db.execute(sql`
        SELECT * FROM phone_in_tickets
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT 50
      `);

      res.json(result.rows);
    } catch (error: any) {
      log.error('Error fetching phone-in tickets:', error);
      res.status(500).json({
        error: 'Failed to fetch phone-in tickets',
        details: error?.message,
      });
    }
  });

  // Phone-in ticket conversion endpoint
  app.post('/api/phone-in-tickets/:id/convert', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      // Get the phone-in ticket
      const phoneTicketResult = await db.execute(sql`
        SELECT * FROM phone_in_tickets
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `);

      if (phoneTicketResult.rows.length === 0) {
        return res.status(404).json({ error: 'Phone-in ticket not found' });
      }

      const phoneTicket = phoneTicketResult.rows[0];

      // Check if already converted
      if (phoneTicket.converted_to_ticket_id) {
        return res.status(400).json({ error: 'Ticket already converted' });
      }

      // Create service ticket from phone-in ticket
      const serviceTicketResult = await db.execute(sql`
        INSERT INTO service_tickets (
          tenant_id, customer_id, title, description, priority, status,
          equipment_id, customer_address, customer_phone
        ) VALUES (
          ${phoneTicket.tenantId}, ${phoneTicket.customerId},
          ${'Service Call: ' + (phoneTicket.customer_name || 'Unknown Customer')},
          ${phoneTicket.issue_description || 'No description provided'},
          ${phoneTicket.priority || 'medium'}, 'new',
          ${phoneTicket.equipmentId}, ${phoneTicket.location_address},
          ${phoneTicket.caller_phone}
        ) RETURNING *
      `);

      const serviceTicket = serviceTicketResult.rows[0];

      // Mark phone-in ticket as converted
      await db.execute(sql`
        UPDATE phone_in_tickets
        SET converted_to_ticket_id = ${serviceTicket.id},
            converted_at = NOW()
        WHERE id = ${id}
      `);

      res.json({
        success: true,
        serviceTicket: serviceTicket,
        message: 'Phone-in ticket converted to service ticket successfully',
      });
    } catch (error: any) {
      log.error('Error converting phone-in ticket:', error);
      res.status(500).json({
        error: 'Failed to convert phone-in ticket',
        details: error?.message,
      });
    }
  });
}
