import express, { Response } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-client-metrics');

import {
  clientRegistrations,
  clientCollectedMetrics,
  clientActivityLogs,
  monitoredDevices,
  tonerAlerts,
  type ClientCollectedMetric,
  type NewClientCollectedMetric,
  type NewClientActivityLog,
  type NewTonerAlert,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { resolveTenant, requireTenant, type TenantRequest } from './middleware/tenancy';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';
import crypto from 'crypto';

import { getUserId, getTenantId } from './utils/auth-helpers';
const router = express.Router();

// Apply RBAC context to all client metrics routes
router.use(enhanceUserContext);

// Types for API requests/responses
interface DeviceMetricsPayload {
  serialNumber: string;
  ipAddress: string;
  manufacturer?: string;
  model?: string;
  deviceName?: string;
  tonerLevels?: {
    black?: number;
    cyan?: number;
    magenta?: number;
    yellow?: number;
  };
  paperLevels?: {
    tray1?: number;
    tray2?: number;
    tray3?: number;
    tray4?: number;
  };
  meters?: {
    totalImpressions?: number;
    bwImpressions?: number;
    colorImpressions?: number;
    largeImpressions?: number;
  };
  supplyInfo?: {
    fuserLife?: number;
    drumLife?: number;
    transferBeltLife?: number;
  };
  deviceStatus: 'online' | 'offline' | 'error' | 'maintenance' | 'warning';
  errorCodes?: string[];
  warningCodes?: string[];
  collectionTimestamp: string;
  rawData?: any;
}

interface SubmitMetricsRequest {
  clientId: string;
  clientVersion: string;
  timestamp: string;
  devices: DeviceMetricsPayload[];
}

interface SubmitMetricsResponse {
  message: string;
  processed: number;
  errors: number;
  details: {
    successful: string[];
    failed: Array<{ serialNumber: string; error: string }>;
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Process toner alerts - check if any devices have low toner and create alerts
 */
async function processTonerAlerts(
  tenantId: number,
  clientId: string,
  devices: DeviceMetricsPayload[],
): Promise<void> {
  const alertPromises: Promise<any>[] = [];
  const TONER_THRESHOLD = 15; // Can be configured per device later

  for (const device of devices) {
    if (!device.tonerLevels) continue;

    const colors = ['black', 'cyan', 'magenta', 'yellow'] as const;

    for (const color of colors) {
      const level = device.tonerLevels[color];

      if (level !== undefined && level <= TONER_THRESHOLD) {
        // Check if alert already exists for this device/color
        const existingAlert = await db.query.tonerAlerts.findFirst({
          where: and(
            eq(tonerAlerts.tenantId, tenantId),
            eq(tonerAlerts.serialNumber, device.serialNumber),
            eq(tonerAlerts.supplyType, color),
            eq(tonerAlerts.status, 'active'),
          ),
        });

        if (!existingAlert) {
          // Create new alert
          const newAlert: NewTonerAlert = {
            tenantId,
            clientId,
            serialNumber: device.serialNumber,
            alertType: level === 0 ? 'toner_empty' : 'toner_low',
            supplyType: color,
            currentLevel: level,
            threshold: TONER_THRESHOLD,
            status: 'active',
          };

          alertPromises.push(db.insert(tonerAlerts).values(newAlert));
        } else if (existingAlert.currentLevel !== level) {
          // Update existing alert with new level
          alertPromises.push(
            db
              .update(tonerAlerts)
              .set({
                currentLevel: level,
                alertType: level === 0 ? 'toner_empty' : 'toner_low',
                updatedAt: new Date(),
              })
              .where(eq(tonerAlerts.id, existingAlert.id)),
          );
        }
      } else if (level !== undefined && level > TONER_THRESHOLD + 5) {
        // Toner level recovered, resolve any active alerts
        alertPromises.push(
          db
            .update(tonerAlerts)
            .set({ status: 'resolved', resolvedAt: new Date() })
            .where(
              and(
                eq(tonerAlerts.tenantId, tenantId),
                eq(tonerAlerts.serialNumber, device.serialNumber),
                eq(tonerAlerts.supplyType, color),
                eq(tonerAlerts.status, 'active'),
              ),
            ),
        );
      }
    }
  }

  if (alertPromises.length > 0) {
    await Promise.allSettled(alertPromises);
  }
}

/**
 * Authenticate client via API key and tenant ID
 */
async function authenticateClient(apiKey: string | undefined, tenantIdHeader: string | undefined) {
  if (!apiKey || !tenantIdHeader) {
    return null;
  }

  try {
    const tenantId = parseInt(tenantIdHeader);
    if (isNaN(tenantId)) {
      return null;
    }

    const client = await db.query.clientRegistrations.findFirst({
      where: and(
        eq(clientRegistrations.apiKey, apiKey),
        eq(clientRegistrations.tenantId, tenantId),
        eq(clientRegistrations.status, 'active'),
      ),
    });

    return client;
  } catch (error) {
    log.error('Error authenticating client:', error);
    return null;
  }
}

// =====================================================
// 1. SUBMIT METRICS ENDPOINT
// =====================================================
router.post('/submit', async (req, res: Response<SubmitMetricsResponse>) => {
  try {
    // Authenticate via Bearer token (API key)
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.replace('Bearer ', '');
    const tenantIdHeader = req.headers['x-tenant-id'] as string;

    const client = await authenticateClient(apiKey, tenantIdHeader);

    if (!client) {
      return res.status(401).json({
        message: 'Invalid API key or tenant ID',
        processed: 0,
        errors: 0,
        details: { successful: [], failed: [] },
      });
    }

    const body: SubmitMetricsRequest = req.body;
    const { clientId, clientVersion, timestamp, devices } = body;

    if (!devices || !Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({
        message: 'No devices provided',
        processed: 0,
        errors: 0,
        details: { successful: [], failed: [] },
      });
    }

    // Insert metrics for each device
    const results = await Promise.allSettled(
      devices.map((device) => {
        const metricData: NewClientCollectedMetric = {
          tenantId: client.tenantId,
          clientId: client.clientId,
          serialNumber: device.serialNumber,
          ipAddress: device.ipAddress,
          manufacturer: device.manufacturer,
          model: device.model,
          deviceName: device.deviceName,
          tonerBlack: device.tonerLevels?.black,
          tonerCyan: device.tonerLevels?.cyan,
          tonerMagenta: device.tonerLevels?.magenta,
          tonerYellow: device.tonerLevels?.yellow,
          paperTray1: device.paperLevels?.tray1,
          paperTray2: device.paperLevels?.tray2,
          paperTray3: device.paperLevels?.tray3,
          paperTray4: device.paperLevels?.tray4,
          totalImpressions: device.meters?.totalImpressions,
          bwImpressions: device.meters?.bwImpressions,
          colorImpressions: device.meters?.colorImpressions,
          largeImpressions: device.meters?.largeImpressions,
          fuserLife: device.supplyInfo?.fuserLife,
          drumLife: device.supplyInfo?.drumLife,
          transferBeltLife: device.supplyInfo?.transferBeltLife,
          deviceStatus: device.deviceStatus,
          errorCodes: device.errorCodes,
          warningCodes: device.warningCodes,
          collectionTimestamp: new Date(device.collectionTimestamp),
          rawData: device.rawData,
        };

        return db.insert(clientCollectedMetrics).values(metricData);
      }),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    const successfulDevices = devices
      .filter((_, i) => results[i].status === 'fulfilled')
      .map((d) => d.serialNumber);

    const failedDevices = devices
      .map((d, i) => ({
        device: d,
        result: results[i],
      }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ device, result }) => ({
        serialNumber: device.serialNumber,
        error: result.status === 'rejected' ? result.reason.message : 'Unknown error',
      }));

    // Process toner alerts (fire and forget, don't block response)
    processTonerAlerts(client.tenantId, client.clientId, devices).catch((err) => {
      log.error('Error processing toner alerts:', err);
    });

    // Log activity
    const activityLog: NewClientActivityLog = {
      tenantId: client.tenantId,
      clientId: client.clientId,
      eventType: 'metrics',
      eventData: { deviceCount: devices.length, successful, failed, clientVersion },
      severity: failed > 0 ? 'warning' : 'info',
      message: `Submitted metrics for ${successful} devices (${failed} failed)`,
    };

    await db
      .insert(clientActivityLogs)
      .values(activityLog)
      .catch((err) => {
        log.error('Error logging activity:', err);
      });

    res.status(200).json({
      message: 'Metrics received',
      processed: successful,
      errors: failed,
      details: {
        successful: successfulDevices,
        failed: failedDevices,
      },
    });
  } catch (error) {
    log.error('Error submitting metrics:', error);
    res.status(500).json({
      message: 'Internal server error',
      processed: 0,
      errors: 0,
      details: { successful: [], failed: [] },
    });
  }
});

// =====================================================
// 2. HEARTBEAT ENDPOINT
// =====================================================
router.post('/heartbeat', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.replace('Bearer ', '');
    const tenantIdHeader = req.headers['x-tenant-id'] as string;

    const client = await authenticateClient(apiKey, tenantIdHeader);

    if (!client) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    const { clientVersion, bufferSize } = req.body;

    // Update last heartbeat
    await db
      .update(clientRegistrations)
      .set({
        lastHeartbeat: new Date(),
        clientVersion: clientVersion || client.clientVersion,
      })
      .where(eq(clientRegistrations.id, client.id));

    // Log heartbeat if buffer has pending items
    if (bufferSize && bufferSize > 0) {
      const activityLog: NewClientActivityLog = {
        tenantId: client.tenantId,
        clientId: client.clientId,
        eventType: 'heartbeat',
        eventData: { clientVersion, bufferSize },
        severity: bufferSize > 50 ? 'warning' : 'info',
        message: `Heartbeat received (buffer: ${bufferSize} pending)`,
      };

      await db
        .insert(clientActivityLogs)
        .values(activityLog)
        .catch((err) => {
          log.error('Error logging heartbeat:', err);
        });
    }

    res.status(200).json({
      message: 'Heartbeat acknowledged',
      serverTime: new Date().toISOString(),
      status: 'healthy',
    });
  } catch (error) {
    log.error('Error processing heartbeat:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// 3. GET REMOTE CONFIGURATION
// =====================================================
router.get('/config', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.replace('Bearer ', '');
    const tenantIdHeader = req.headers['x-tenant-id'] as string;

    const client = await authenticateClient(apiKey, tenantIdHeader);

    if (!client) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    // Get monitored devices for this client
    const devices = await db.query.monitoredDevices.findMany({
      where: and(
        eq(monitoredDevices.tenantId, client.tenantId),
        eq(monitoredDevices.clientId, client.clientId),
        eq(monitoredDevices.enabled, true),
      ),
    });

    res.status(200).json({
      clientId: client.clientId,
      clientName: client.clientName,
      status: client.status,
      configuration: {
        pollingInterval: 300, // 5 minutes (can be made configurable per-client)
        tonerThreshold: 15,
        paperThreshold: 20,
        discoveryEnabled: true,
        devices: devices.map((d) => ({
          ipAddress: d.ipAddress,
          protocol: d.protocol,
          snmpVersion: d.snmpVersion,
          snmpPort: d.snmpPort,
          pollingInterval: d.pollingInterval || 300,
        })),
      },
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Error fetching config:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// 4. CLIENT MANAGEMENT ENDPOINTS (Admin only)
// =====================================================

/**
 * Register a new monitoring client
 * POST /api/client-metrics/clients
 * Requires: Admin authentication
 */
router.post('/clients', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const { clientName, location } = req.body;
    const tenantId = req.tenantId!;

    if (!clientName) {
      return res.status(400).json({ message: 'Client name is required' });
    }

    // Generate unique client ID
    const clientId = `client-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Generate secure API key
    const apiKey = `pk_${crypto.randomBytes(32).toString('base64url')}`;

    // Create client registration
    const [newClient] = await db
      .insert(clientRegistrations)
      .values({
        tenantId,
        clientId,
        clientName,
        location,
        apiKey,
        status: 'active',
      })
      .returning();

    // Log activity
    const activityLog: NewClientActivityLog = {
      tenantId,
      clientId: newClient.clientId,
      eventType: 'config_update',
      eventData: { action: 'client_registered', by: req.user?.id },
      severity: 'info',
      message: `Client '${clientName}' registered`,
    };

    await db.insert(clientActivityLogs).values(activityLog);

    res.status(201).json({
      message: 'Client registered successfully',
      client: {
        id: newClient.id,
        clientId: newClient.clientId,
        clientName: newClient.clientName,
        apiKey: newClient.apiKey, // Only show on creation
        tenantId: newClient.tenantId,
        status: newClient.status,
        createdAt: newClient.createdAt,
      },
    });
  } catch (error) {
    log.error('Error registering client:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * List all clients for tenant
 * GET /api/client-metrics/clients
 */
router.get('/clients', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    const clients = await db.query.clientRegistrations.findMany({
      where: eq(clientRegistrations.tenantId, tenantId),
      orderBy: [desc(clientRegistrations.createdAt)],
    });

    // Don't return API keys in list view
    const clientsWithoutKeys = clients.map(({ apiKey, ...client }) => client);

    res.status(200).json({ clients: clientsWithoutKeys });
  } catch (error) {
    log.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Get client details with recent activity
 * GET /api/client-metrics/clients/:clientId
 */
router.get('/clients/:clientId', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const { clientId } = req.params;
    const tenantId = req.tenantId!;

    const client = await db.query.clientRegistrations.findFirst({
      where: and(
        eq(clientRegistrations.clientId, clientId),
        eq(clientRegistrations.tenantId, tenantId),
      ),
    });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Get recent activity logs (last 100)
    const activity = await db.query.clientActivityLogs.findMany({
      where: and(
        eq(clientActivityLogs.clientId, clientId),
        eq(clientActivityLogs.tenantId, tenantId),
      ),
      orderBy: [desc(clientActivityLogs.timestamp)],
      limit: 100,
    });

    // Get device count
    const deviceCount = await db.query.monitoredDevices.findMany({
      where: and(
        eq(monitoredDevices.clientId, clientId),
        eq(monitoredDevices.tenantId, tenantId),
        eq(monitoredDevices.enabled, true),
      ),
    });

    // Get active alerts
    const activeAlerts = await db.query.tonerAlerts.findMany({
      where: and(
        eq(tonerAlerts.clientId, clientId),
        eq(tonerAlerts.tenantId, tenantId),
        eq(tonerAlerts.status, 'active'),
      ),
      orderBy: [desc(tonerAlerts.createdAt)],
      limit: 50,
    });

    const { apiKey, ...clientWithoutKey } = client;

    res.status(200).json({
      client: {
        ...clientWithoutKey,
        deviceCount: deviceCount.length,
        activeAlertsCount: activeAlerts.length,
      },
      activity,
      activeAlerts,
    });
  } catch (error) {
    log.error('Error fetching client details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Regenerate API key for client
 * POST /api/client-metrics/clients/:clientId/regenerate-key
 */
router.post(
  '/clients/:clientId/regenerate-key',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const { clientId } = req.params;
      const tenantId = req.tenantId!;

      const client = await db.query.clientRegistrations.findFirst({
        where: and(
          eq(clientRegistrations.clientId, clientId),
          eq(clientRegistrations.tenantId, tenantId),
        ),
      });

      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      // Generate new API key
      const newApiKey = `pk_${crypto.randomBytes(32).toString('base64url')}`;

      await db
        .update(clientRegistrations)
        .set({ apiKey: newApiKey, updatedAt: new Date() })
        .where(eq(clientRegistrations.id, client.id));

      // Log activity
      const activityLog: NewClientActivityLog = {
        tenantId,
        clientId: client.clientId,
        eventType: 'config_update',
        eventData: { action: 'api_key_regenerated', by: req.user?.id },
        severity: 'warning',
        message: 'API key regenerated',
      };

      await db.insert(clientActivityLogs).values(activityLog);

      res.status(200).json({
        message: 'API key regenerated successfully',
        apiKey: newApiKey,
      });
    } catch (error) {
      log.error('Error regenerating API key:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

export default router;
