/**
 * Sample Data & Dashboard Routes
 * Extracted from routes.ts monolith.
 */
import type { Express } from 'express';
import { db } from './db';
import { eq, sql } from 'drizzle-orm';
import { locations, regions, tenants } from '@shared/schema';
import { storage } from './storage';
import { getUserId } from './utils/auth-helpers';
import { requireAuth } from './replitAuth';
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

  // PA-052: the two /api/demos handlers that sat here are gone. The first
  // returned one invented demo for "ABC Corporation" and the second duplicated
  // a customer lookup; /api/demos is proxied to the demos edge function now,
  // which serves the list, the customer picker, create and the status update
  // off demo_schedules.

  // The three /api/signature-* fixtures REMOVED (AUDIT-021 follow-up).
  //
  // /signature-requests, /signature-templates and /signature-analytics all
  // returned invented rows - a "Service Agreement - ABC Corporation" pending
  // since January, completion rates, a turnaround histogram. The first of them
  // WON over two other registrations of the same path, one of which
  // (server/routes/signature-routes.ts) reads the real signature_requests
  // table through storage. A fixture beating a real handler is the exact case
  // check:dup-routes' header describes, and it could not see this one: the real
  // router mounts at the /api root and declares its paths without the prefix.
  //
  // Nothing calls /api/signature-* from any client tree either - EDGE-005e
  // moved the frontend to the consolidated /api/signatures/{requests,templates,
  // analytics} shape, served by supabase/functions/signatures/.

  // ──────────────────────────────────────────────
  // Preventive Maintenance (WF-V-04): the four fixture handlers that lived here
  // are gone.
  //
  // /api/maintenance/{schedules,analytics,templates,predictions} all answered
  // from hard-coded samples - named machines at named customers, a compliance
  // rate, an annual saving, a failure prediction with a confidence score. THERE
  // WERE TWO COPIES: this one, which was registered and is what dev actually hit,
  // and server/routes-preventive-maintenance.ts, which was never registered and
  // is deleted too. The story only knew about the dead one.
  //
  // /api/maintenance is proxied now and supabase/functions/maintenance/ serves it
  // from maintenance_schedules and maintenance_records, which migration 0071
  // finally declares. /analytics is derived from those rows and names what it
  // cannot derive; /templates and /predictions have no table and no engine behind
  // them here, so the tabs that read them are gone from
  // PreventiveMaintenanceAutomation.tsx - the real predictive surface is
  // /service/predictions over supabase/functions/predictive-failure/.
  // ──────────────────────────────────────────────

  // GET /api/business-process/dashboard was removed here (PROD-010), along with
  // BusinessProcessOptimization.tsx and the unregistered 746-line
  // routes-business-process-optimization.ts. It returned the same invented
  // figures for every tenant - 47 processes, a 68.1% automation rate,
  // $127,890.50 saved, a "Lead to Customer Conversion" metric improved 40.4% -
  // with zero database calls, and no table in any schema defines what a
  // "business process" is here. Porting it to an edge function would have
  // published those numbers to production, which is why PROD-010 refused the
  // port twice. The page never rendered them anyway: its query key was
  // ['/api/business-process/dashboard', category, department], and a query key
  // IS a url, so it actually requested /dashboard/all/all and 404'd in dev too.

  // GET /api/security/dashboard was removed here (PROD-008b). It returned mock
  // data and had NO caller — SecurityDashboard.tsx calls /overview,
  // /failed-logins and /events, which the security edge function serves. Note
  // the edge function has no /dashboard branch at all, so this path 404s; that
  // is correct, nothing asks for it.

  // GET /api/incident-response/dashboard was removed here (PROD-010), along with
  // IncidentResponseSystem.tsx. Same shape as the business-process mock above
  // and the same query-key defect: 7 active incidents, an SLA compliance
  // figure, threat feeds, IOC matches and automated-response playbooks, none of
  // it from a table - there is no incident, threat or playbook relation in any
  // schema. A security page asserting posture with nothing behind it is
  // AUDIT-019's SystemSecurity case, and the rule from LEGAL-010 applies: a
  // claim with no backing data is deleted, not relabelled.

  // GET /api/ai-analytics/dashboard was removed here (PROD-008b). Unlike its
  // neighbours this one was NOT mock — CRMX-001 rebuilt it on real churn scores
  // with an honest availability map. supabase/functions/ai-analytics/ is a
  // documented port of that version, availability flags and all.

  // GET /api/workflow-automation/dashboard was removed here (PROD-008b).
  // supabase/functions/workflow-automation/ serves it (PROD-014).

  // Security & Compliance Dashboard: removed. This returned hardcoded fiction —
  // a 94.7 security score, a "compliant" GDPR status with a named auditor and a
  // certification expiry date — to any authenticated user. Because this file is
  // registered BEFORE routes-operations-extended (routes-registry.ts), this copy,
  // not the identical one there, was the handler Express actually matched.
  //
  // Its only consumer, SecurityComplianceManagement.tsx, is deleted. Real audit
  // data is served by /api/audit-logs over the audit_logs table; see
  // services/audit-log-service.ts and the AuditLogViewer page.

  // ──────────────────────────────────────────────

  // PROD-014: a 670-line GET /api/erp-integration/dashboard used to sit here,
  // returning "SAP Business One", 18 integrations, a 98.7% sync success rate, a
  // 99.94% uptime and data-quality scores for accuracy, completeness,
  // consistency and timeliness. Every value was a literal. An identical
  // unregistered copy lived in routes-erp-integration.ts and has been deleted
  // too.
  //
  // Porting it to an edge function would have shipped invented integration
  // health to production, which is the fix PROD-011 already ruled out for a
  // mock handler. supabase/functions/erp-integration/ serves the domain from
  // system_integrations and integration_metrics instead, and
  // ERPIntegration.tsx drops the sections no table backs.

  // GET /api/integration-hub/dashboard was removed here (PROD-008b). The
  // integrations edge function serves it from its /dashboard branch (EDGE-005f).
}
