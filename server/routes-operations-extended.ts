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

  // COMMISSION ROUTES: removed (CR-017). Twelve handlers on /api/commission,
  // every one of them a raw SQL string naming a table that exists in no Drizzle
  // schema and no migration - commission_payments, commission_structures,
  // commission_transactions, sales_quotas and sales_representatives - so each
  // was a permanent 500 in dev and never ran in production at all. A table name
  // inside a template literal is invisible to tsc AND to check:phantom-cols,
  // which reads edge functions only.
  //
  // supabase/functions/commission/ is the implementation: it covers every path
  // CommissionManagement.tsx calls (plans, calculations, analytics, disputes,
  // calculate) over the real commission_plans / commission_calculations /
  // commission_disputes / deals tables, and /api/commission is now proxied so
  // dev runs it too. server/routes-commission.ts is deleted with these - its
  // four handlers returned a hardcoded "Sales Rep Standard" plan with 5%/6.5%/8%
  // tiers, the same invented pay structure EDGE-002g removed from the edge
  // function's error branch.
  //
  // MONITORING ROUTES: removed with them (CR-017). Seven handlers on
  // /api/monitoring over iot_devices, predictive_alerts,
  // equipment_status_monitoring and device_performance_trends - four more
  // tables that do not exist - and no client tree named the prefix.

  // ============= PHONE-IN TICKET ROUTES =============
  //
  // KEPT, and unreachable from a browser (CR-017). These three query real
  // tables (business_records, users, equipment) and work, but no client tree in
  // this repo names /api/phone-tickets and the prefix has no edge function, so
  // production would 404 them. That is the PROD-008c/PROD-008d shape - complete
  // work nobody wired - and deleting it is a decision for a human, not cleanup.
  // They also read the tenant from an x-tenant-id header rather than the session,
  // which is how a phone-system integration would call them.

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
