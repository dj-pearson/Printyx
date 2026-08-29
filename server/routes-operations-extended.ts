/**
 * Operations Extended Routes
 * Equipment lifecycle, commission, monitoring, maintenance, security compliance, phone-in tickets
 * Extracted from routes.ts monolith.
 */
import type { Express } from 'express';
import { db } from './db';
import { and, eq, sql, or } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-operations-extended');

import { businessRecords } from '@shared/schema';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { requireAuth } from './replitAuth';
import { badRequest, notFound, serverError } from './lib/error-response';

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

  // SECURITY & COMPLIANCE ROUTES: removed. Every one of these six endpoints
  // returned hardcoded fiction — a 94.7 security score, a "compliant" GDPR
  // status with a named auditor and certification expiry, invented threat
  // records, and audit logs synthesised with Math.random(). Five had no caller
  // at all; the sixth fed SecurityComplianceManagement.tsx, which is deleted.
  //
  // Real equivalents already exist and are used instead: /api/audit-logs
  // (services/audit-log-service.ts over the audit_logs table, unit-tested) with
  // the AuditLogViewer page, plus the gdpr_requests and security_sessions
  // tables in shared/security-schema.ts. A genuine compliance dashboard should
  // be built on those; it must not restate a certification the company does not
  // hold (see LEGAL-010).

  // AUDIT-021: the two /api/performance handlers that stood here are ported to
  // supabase/functions/performance/ and the prefix is proxied, so dev and prod
  // now answer the same thing. They mattered more than a duplicate usually
  // does: the four alert families derived here - low stock, dispatch delay,
  // billing anomaly, contract expiration - were served in DEV ONLY, while
  // production read system_alerts, a real table that NOTHING WRITES TO. The
  // only insert in the tree is storage.createSystemAlert and no caller names
  // it, so the alert bell has been permanently silent in production while dev
  // showed real problems. The derivations now live in that function, alongside
  // the system_alerts read rather than instead of it.

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
        serverError(res, 'Failed to fetch commission metrics');
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
        serverError(res, 'Failed to fetch commission structures');
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
        serverError(res, 'Failed to create commission structure');
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
        serverError(res, 'Failed to fetch commission calculations');
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
          return badRequest(res, 'No active commission structure found');
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
        serverError(res, 'Failed to run commission calculations');
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
        serverError(res, 'Failed to fetch sales quotas');
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
        serverError(res, 'Failed to create sales quota');
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
        serverError(res, 'Failed to fetch commission payments');
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
        serverError(res, 'Failed to fetch commission disputes');
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
        serverError(res, 'Failed to create commission dispute');
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
        serverError(res, 'Failed to fetch monitoring metrics');
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
        serverError(res, 'Failed to fetch IoT devices');
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
        serverError(res, 'Failed to register IoT device');
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
        serverError(res, 'Failed to fetch equipment status');
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
        serverError(res, 'Failed to fetch predictive alerts');
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
        serverError(res, 'Failed to fetch performance trends');
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
      serverError(res, 'Failed to sync devices');
    }
  });

  // ============= COMMISSION MANAGEMENT ROUTES (Block 2 - Transaction-based) =============

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
        serverError(res, 'Failed to fetch sales representatives');
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
        serverError(res, 'Failed to create sales representative');
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
        serverError(res, 'Failed to fetch commission transactions');
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
          return notFound(res, 'Sales representative not found');
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
        serverError(res, 'Failed to create commission transaction');
      }
    },
  );

  // ============= SECURITY & COMPLIANCE EXTENDED ROUTES =============

  // Security dashboard (simplified)
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
      serverError(res, 'Failed to search companies');
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
      serverError(res, 'Failed to search contacts');
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
      serverError(res, 'Failed to fetch equipment');
    }
  });

  // Phone-in tickets POST endpoint - Now properly saves to database
  // GET, POST /api/phone-in-tickets and POST /:id/convert were removed here
  // (PROD-008b). /api/phone-in-tickets is proxied to
  // supabase/functions/phone-in-tickets/, which serves all three plus the
  // search-companies / search-contacts / equipment lookups PhoneInTicketCreator.tsx
  // calls. Its POST returns { phoneTicket, serviceTicket }, which is exactly what
  // the component reads. The GET had no reader — the component only invalidates
  // that query key.

  // Phone-in tickets GET endpoint

  // Phone-in ticket conversion endpoint
}
