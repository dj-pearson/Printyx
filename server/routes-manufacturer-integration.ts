import type { Express } from 'express';
import { db } from './db';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-manufacturer-integration');

import {
  manufacturerIntegrations,
  deviceRegistrations,
  deviceMetrics,
  integrationAuditLogs,
  thirdPartyIntegrations,
  insertManufacturerIntegrationSchema,
  insertDeviceRegistrationSchema,
  insertDeviceMetricSchema,
} from '@shared/schema';
import { manufacturerIntegrationService } from './manufacturer-integration-service';

import { getUserId, getTenantId } from './utils/auth-helpers';
export function registerManufacturerIntegrationRoutes(app: Express) {
  // Get all integrations for a tenant
  app.get('/api/manufacturer-integrations', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const integrations = await db
        .select()
        .from(manufacturerIntegrations)
        .where(eq(manufacturerIntegrations.tenantId, tenantId))
        .orderBy(desc(manufacturerIntegrations.createdAt));

      res.json(integrations);
    } catch (error) {
      log.error('Error fetching manufacturer integrations:', error);
      res.status(500).json({ message: 'Failed to fetch integrations' });
    }
  });

  // Create a new integration
  app.post('/api/manufacturer-integrations', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // PA-035: tenantId is NOT NULL, so inject it before parse (the client never
      // sends it — parsing req.body alone would 500 every create). Injecting
      // (rather than .omit) keeps validatedData's type aligned with the
      // createIntegration() parameter.
      const validatedData = insertManufacturerIntegrationSchema.parse({ ...req.body, tenantId });

      const integration = await manufacturerIntegrationService.createIntegration(
        tenantId,
        validatedData,
      );

      res.json(integration);
    } catch (error) {
      log.error('Error creating manufacturer integration:', error);
      res.status(500).json({ message: 'Failed to create integration' });
    }
  });

  // Get integration by ID
  // ROUTE ORDER IS LOAD-BEARING. /audit-logs and /stats were registered AFTER
  // /api/manufacturer-integrations/:id, and express matches in registration
  // order, so both were served by the :id handler with id set to the literal
  // word - ManufacturerIntegrationAudit.tsx and ManufacturerIntegration.tsx were
  // calling endpoints that could only 404. Gated by npm run check:route-shadowing.
  // Get audit logs
  app.get('/api/manufacturer-integrations/audit-logs', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { integrationId, deviceId, action, status, days = 7 } = req.query;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      let whereConditions = [
        eq(integrationAuditLogs.tenantId, tenantId),
        gte(integrationAuditLogs.timestamp, startDate),
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

      const logs = await db
        .select({
          log: integrationAuditLogs,
          integration: manufacturerIntegrations,
          device: deviceRegistrations,
        })
        .from(integrationAuditLogs)
        .leftJoin(
          manufacturerIntegrations,
          eq(integrationAuditLogs.integrationId, manufacturerIntegrations.id),
        )
        .leftJoin(deviceRegistrations, eq(integrationAuditLogs.deviceId, deviceRegistrations.id))
        .where(and(...whereConditions))
        .orderBy(desc(integrationAuditLogs.timestamp))
        .limit(100);

      res.json(logs);
    } catch (error) {
      log.error('Error fetching audit logs:', error);
      res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
  });

  // Get integration statistics
  app.get('/api/manufacturer-integrations/stats', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const [totalIntegrations, activeIntegrations, totalDevices, onlineDevices, todayMetrics] =
        await Promise.all([
          db
            .select({ count: sql`count(*)` })
            .from(manufacturerIntegrations)
            .where(eq(manufacturerIntegrations.tenantId, tenantId)),

          db
            .select({ count: sql`count(*)` })
            .from(manufacturerIntegrations)
            .where(
              and(
                eq(manufacturerIntegrations.tenantId, tenantId),
                eq(manufacturerIntegrations.status, 'active'),
              ),
            ),

          db
            .select({ count: sql`count(*)` })
            .from(deviceRegistrations)
            .where(eq(deviceRegistrations.tenantId, tenantId)),

          db
            .select({ count: sql`count(*)` })
            .from(deviceRegistrations)
            .where(
              and(
                eq(deviceRegistrations.tenantId, tenantId),
                eq(deviceRegistrations.status, 'online'),
              ),
            ),

          db
            .select({ count: sql`count(*)` })
            .from(deviceMetrics)
            .where(
              and(
                eq(deviceMetrics.tenantId, tenantId),
                gte(deviceMetrics.collectionTimestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)),
              ),
            ),
        ]);

      res.json({
        totalIntegrations: Number(totalIntegrations[0]?.count || 0),
        activeIntegrations: Number(activeIntegrations[0]?.count || 0),
        totalDevices: Number(totalDevices[0]?.count || 0),
        onlineDevices: Number(onlineDevices[0]?.count || 0),
        todayMetrics: Number(todayMetrics[0]?.count || 0),
      });
    } catch (error) {
      log.error('Error fetching integration stats:', error);
      res.status(500).json({ message: 'Failed to fetch integration statistics' });
    }
  });

  app.get('/api/manufacturer-integrations/:id', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const integration = await db
        .select()
        .from(manufacturerIntegrations)
        .where(
          and(eq(manufacturerIntegrations.tenantId, tenantId), eq(manufacturerIntegrations.id, id)),
        )
        .limit(1);

      if (!integration[0]) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      res.json(integration[0]);
    } catch (error) {
      log.error('Error fetching integration:', error);
      res.status(500).json({ message: 'Failed to fetch integration' });
    }
  });

  // Update integration
  app.put('/api/manufacturer-integrations/:id', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const [updatedIntegration] = await db
        .update(manufacturerIntegrations)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(
          and(eq(manufacturerIntegrations.tenantId, tenantId), eq(manufacturerIntegrations.id, id)),
        )
        .returning();

      if (!updatedIntegration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      res.json(updatedIntegration);
    } catch (error) {
      log.error('Error updating integration:', error);
      res.status(500).json({ message: 'Failed to update integration' });
    }
  });

  // Delete integration
  app.delete('/api/manufacturer-integrations/:id', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      await db
        .delete(manufacturerIntegrations)
        .where(
          and(eq(manufacturerIntegrations.tenantId, tenantId), eq(manufacturerIntegrations.id, id)),
        );

      res.json({ message: 'Integration deleted successfully' });
    } catch (error) {
      log.error('Error deleting integration:', error);
      res.status(500).json({ message: 'Failed to delete integration' });
    }
  });

  // Test integration connection
  app.post('/api/manufacturer-integrations/:id/test', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // PA-052: this returned `Math.random() > 0.3` and reported it as a
      // connection result, so the same integration passed and failed at random
      // and the page believed both. check:no-random-metrics did not see it
      // because the value is a const assigned before the object literal, not a
      // property assigned from Math.random() on one line.
      //
      // What can be checked without a vendor round-trip is what is stored, and
      // that is what this reports; connectivityVerified stays false. The edge
      // function's branch answers the same shape.
      const [integration] = await db
        .select()
        .from(manufacturerIntegrations)
        .where(
          and(eq(manufacturerIntegrations.tenantId, tenantId), eq(manufacturerIntegrations.id, id)),
        )
        .limit(1);

      if (!integration) {
        return res.status(404).json({ success: false, message: 'Integration not found' });
      }

      if (!integration.isActive) {
        return res.json({
          success: false,
          connectivityVerified: false,
          message: 'Integration is inactive',
        });
      }

      const credentials = (integration.credentials ?? {}) as Record<string, unknown>;
      const hasCredentials = Object.values(credentials).some(
        (v) => v !== null && v !== undefined && String(v).trim() !== '',
      );
      const problems: string[] = [];
      if (!hasCredentials) problems.push('no credentials are stored');
      if (!integration.apiEndpoint) problems.push('no API endpoint is configured');

      res.json({
        success: problems.length === 0,
        connectivityVerified: false,
        lastSync: integration.lastSync ?? null,
        message:
          problems.length === 0
            ? `${integration.manufacturer} is configured (credentials and endpoint present). The connection itself was not tested.`
            : `Configuration incomplete: ${problems.join(', ')}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error testing connection:', error);
      res.status(500).json({ message: 'Failed to test connection' });
    }
  });

  // Discover and register devices
  app.post('/api/manufacturer-integrations/:id/discover', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const devices = await manufacturerIntegrationService.discoverAndRegisterDevices(tenantId, id);

      res.json({
        message: `Discovered and registered ${devices.length} devices`,
        devices,
      });
    } catch (error) {
      log.error('Error discovering devices:', error);
      res.status(500).json({ message: 'Failed to discover devices' });
    }
  });

  // Get devices for an integration
  app.get('/api/manufacturer-integrations/:id/devices', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const devices = await db
        .select()
        .from(deviceRegistrations)
        .where(
          and(
            eq(deviceRegistrations.tenantId, tenantId),
            eq(deviceRegistrations.integrationId, id),
          ),
        )
        .orderBy(desc(deviceRegistrations.registeredAt));

      res.json(devices);
    } catch (error) {
      log.error('Error fetching devices:', error);
      res.status(500).json({ message: 'Failed to fetch devices' });
    }
  });

  // Get all devices across integrations
  app.get('/api/devices', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const devices = await db
        .select({
          device: deviceRegistrations,
          integration: manufacturerIntegrations,
        })
        .from(deviceRegistrations)
        .innerJoin(
          manufacturerIntegrations,
          eq(deviceRegistrations.integrationId, manufacturerIntegrations.id),
        )
        .where(eq(deviceRegistrations.tenantId, tenantId))
        .orderBy(desc(deviceRegistrations.lastSeen));

      res.json(devices);
    } catch (error) {
      log.error('Error fetching devices:', error);
      res.status(500).json({ message: 'Failed to fetch devices' });
    }
  });

  // Collect metrics from a device
  app.post('/api/devices/:deviceId/collect', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { deviceId } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const metrics = await manufacturerIntegrationService.collectDeviceMetrics(tenantId, deviceId);

      res.json(metrics);
    } catch (error) {
      log.error('Error collecting device metrics:', error);
      res.status(500).json({ message: 'Failed to collect device metrics' });
    }
  });

  // Get device metrics
  app.get('/api/devices/:deviceId/metrics', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { deviceId } = req.params;
      const { days = 7 } = req.query;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      const metrics = await db
        .select()
        .from(deviceMetrics)
        .where(
          and(
            eq(deviceMetrics.tenantId, tenantId),
            eq(deviceMetrics.deviceId, deviceId),
            gte(deviceMetrics.collectionTimestamp, startDate),
          ),
        )
        .orderBy(desc(deviceMetrics.collectionTimestamp));

      res.json(metrics);
    } catch (error) {
      log.error('Error fetching device metrics:', error);
      res.status(500).json({ message: 'Failed to fetch device metrics' });
    }
  });
}
