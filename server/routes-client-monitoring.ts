import type { Express } from 'express';
import { db } from './db';
import { eq, and, desc, like, or } from 'drizzle-orm';
import crypto from 'crypto';
import {
  monitoringClients,
  clientActivityLogs,
  clientDiscoveredDevices,
  deviceRegistrations,
  deviceMetrics,
  manufacturerIntegrations,
  customerSupplyOrders,
  customerSupplyOrderItems,
  customerNotifications,
  supplies,
  equipment,
  insertMonitoringClientSchema,
  insertClientActivityLogSchema,
  insertClientDiscoveredDeviceSchema,
  insertDeviceMetricSchema,
  clientMetricSubmissionSchema,
} from '@shared/schema';

// Middleware to authenticate monitoring clients via API key
async function authenticateClient(req: any, res: any, next: any) {
  try {
    const apiKey = req.headers['authorization']?.replace('Bearer ', '');
    const tenantId = req.headers['x-tenant-id'];

    if (!apiKey || !tenantId) {
      return res.status(401).json({
        message:
          'Missing authentication credentials. Required: Authorization header with Bearer token and X-Tenant-ID header',
      });
    }

    // Hash the API key for comparison
    const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const client = await db
      .select()
      .from(monitoringClients)
      .where(
        and(
          eq(monitoringClients.apiKey, hashedApiKey),
          eq(monitoringClients.tenantId, tenantId),
          eq(monitoringClients.isActive, true),
        ),
      )
      .limit(1);

    if (!client[0]) {
      return res.status(401).json({ message: 'Invalid API key or client not found' });
    }

    if (client[0].status === 'inactive') {
      return res.status(403).json({ message: 'Client is inactive' });
    }

    // Attach client to request
    req.monitoringClient = client[0];
    req.tenantId = tenantId;

    next();
  } catch (error) {
    console.error('Error authenticating client:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
}

/**
 * Helper function to lookup toner products from the supplies catalog
 * @param tenantId - Tenant ID
 * @param manufacturer - Equipment manufacturer (e.g., "HP", "Canon")
 * @param model - Equipment model (e.g., "LaserJet P4015")
 * @param color - Toner color (e.g., "black", "cyan", "magenta", "yellow")
 * @returns Toner product information or null if not found
 */
async function lookupTonerProduct(
  tenantId: string,
  manufacturer: string | null,
  model: string | null,
  color: string,
): Promise<{
  productId: string;
  productSku: string;
  productName: string;
  productDescription: string;
  unitPrice: string;
  inStock: boolean;
} | null> {
  try {
    // Normalize color name
    const normalizedColor = color.toLowerCase();

    // Build search patterns for productCode and productName
    // Examples: "TONER-BLACK-HP-LASERJET", "TONER-CYAN-CANON-IR"
    const searchPatterns = [];

    if (manufacturer && model) {
      // Most specific: manufacturer + model + color
      const cleanModel = model.replace(/\s+/g, '-').toUpperCase();
      const cleanManufacturer = manufacturer.replace(/\s+/g, '-').toUpperCase();
      searchPatterns.push(
        `%TONER%${normalizedColor.toUpperCase()}%${cleanManufacturer}%${cleanModel}%`,
        `%${cleanManufacturer}%${cleanModel}%${normalizedColor.toUpperCase()}%TONER%`,
        `%${normalizedColor.toUpperCase()}%${cleanManufacturer}%${cleanModel}%`,
      );
    } else if (manufacturer) {
      // Manufacturer + color
      const cleanManufacturer = manufacturer.replace(/\s+/g, '-').toUpperCase();
      searchPatterns.push(
        `%TONER%${normalizedColor.toUpperCase()}%${cleanManufacturer}%`,
        `%${cleanManufacturer}%${normalizedColor.toUpperCase()}%`,
      );
    } else {
      // Just color (least specific)
      searchPatterns.push(
        `%TONER%${normalizedColor.toUpperCase()}%`,
        `%${normalizedColor.toUpperCase()}%TONER%`,
      );
    }

    // Search for matching toner products
    const conditions = searchPatterns.map((pattern) =>
      or(
        like(supplies.productCode, pattern),
        like(supplies.productName, pattern),
      )
    );

    const results = await db
      .select()
      .from(supplies)
      .where(
        and(
          eq(supplies.tenantId, tenantId),
          eq(supplies.isActive, true),
          or(...conditions),
        ),
      )
      .limit(1);

    if (results.length === 0) {
      console.log('[TONER LOOKUP] No product found for:', {
        manufacturer,
        model,
        color: normalizedColor,
        patterns: searchPatterns,
      });
      return null;
    }

    const product = results[0];

    // Determine price - use the first available pricing tier
    let unitPrice = '99.99'; // Default fallback price
    if (product.newRepPrice) {
      unitPrice = product.newRepPrice;
    } else if (product.upgradeRepPrice) {
      unitPrice = product.upgradeRepPrice;
    } else if (product.lexmarkRepPrice) {
      unitPrice = product.lexmarkRepPrice;
    } else if (product.graphicRepPrice) {
      unitPrice = product.graphicRepPrice;
    }

    // Check inventory status
    const inStock = product.inStock === 'true' || product.inStock === '1' || product.inventory !== '0';

    console.log('[TONER LOOKUP] Found product:', {
      productId: product.id,
      productCode: product.productCode,
      productName: product.productName,
      unitPrice,
      inStock,
    });

    return {
      productId: product.id,
      productSku: product.productCode,
      productName: product.productName,
      productDescription: product.summary || `${product.productName} - Compatible with ${manufacturer} ${model}`,
      unitPrice,
      inStock,
    };
  } catch (error) {
    console.error('[TONER LOOKUP] Error looking up toner product:', error);
    return null;
  }
}

export function registerClientMonitoringRoutes(app: Express) {
  // ============================================================
  // CLIENT MANAGEMENT ENDPOINTS (Authenticated with user token)
  // ============================================================

  // Get all monitoring clients for a tenant
  app.get('/api/monitoring-clients', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const clients = await db
        .select()
        .from(monitoringClients)
        .where(eq(monitoringClients.tenantId, tenantId))
        .orderBy(desc(monitoringClients.createdAt));

      res.json(clients);
    } catch (error) {
      console.error('Error fetching monitoring clients:', error);
      res.status(500).json({ message: 'Failed to fetch monitoring clients' });
    }
  });

  // Create a new monitoring client
  app.post('/api/monitoring-clients', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Generate API key
      const apiKey = crypto.randomBytes(32).toString('hex');
      const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      const clientData = {
        ...req.body,
        tenantId,
        apiKey: hashedApiKey,
        apiKeyLastRotated: new Date(),
        status: 'pending_setup',
      };

      const validatedData = insertMonitoringClientSchema.parse(clientData);

      const [client] = await db.insert(monitoringClients).values(validatedData).returning();

      // Return the plain API key only once (it won't be stored in plain text)
      res.json({
        ...client,
        plainApiKey: apiKey, // Only returned once during creation
      });
    } catch (error) {
      console.error('Error creating monitoring client:', error);
      res.status(500).json({ message: 'Failed to create monitoring client' });
    }
  });

  // Get monitoring client by ID
  app.get('/api/monitoring-clients/:id', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const client = await db
        .select()
        .from(monitoringClients)
        .where(and(eq(monitoringClients.tenantId, tenantId), eq(monitoringClients.id, id)))
        .limit(1);

      if (!client[0]) {
        return res.status(404).json({ message: 'Monitoring client not found' });
      }

      res.json(client[0]);
    } catch (error) {
      console.error('Error fetching monitoring client:', error);
      res.status(500).json({ message: 'Failed to fetch monitoring client' });
    }
  });

  // Update monitoring client
  app.put('/api/monitoring-clients/:id', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const [updatedClient] = await db
        .update(monitoringClients)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(and(eq(monitoringClients.tenantId, tenantId), eq(monitoringClients.id, id)))
        .returning();

      if (!updatedClient) {
        return res.status(404).json({ message: 'Monitoring client not found' });
      }

      res.json(updatedClient);
    } catch (error) {
      console.error('Error updating monitoring client:', error);
      res.status(500).json({ message: 'Failed to update monitoring client' });
    }
  });

  // Rotate API key for a monitoring client
  app.post('/api/monitoring-clients/:id/rotate-key', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Generate new API key
      const newApiKey = crypto.randomBytes(32).toString('hex');
      const hashedApiKey = crypto.createHash('sha256').update(newApiKey).digest('hex');

      const [updatedClient] = await db
        .update(monitoringClients)
        .set({
          apiKey: hashedApiKey,
          apiKeyLastRotated: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(monitoringClients.tenantId, tenantId), eq(monitoringClients.id, id)))
        .returning();

      if (!updatedClient) {
        return res.status(404).json({ message: 'Monitoring client not found' });
      }

      res.json({
        ...updatedClient,
        plainApiKey: newApiKey, // Only returned once
      });
    } catch (error) {
      console.error('Error rotating API key:', error);
      res.status(500).json({ message: 'Failed to rotate API key' });
    }
  });

  // Delete monitoring client
  app.delete('/api/monitoring-clients/:id', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      await db
        .delete(monitoringClients)
        .where(and(eq(monitoringClients.tenantId, tenantId), eq(monitoringClients.id, id)));

      res.json({ message: 'Monitoring client deleted successfully' });
    } catch (error) {
      console.error('Error deleting monitoring client:', error);
      res.status(500).json({ message: 'Failed to delete monitoring client' });
    }
  });

  // Get client activity logs
  app.get('/api/monitoring-clients/:id/activity', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const logs = await db
        .select()
        .from(clientActivityLogs)
        .where(and(eq(clientActivityLogs.tenantId, tenantId), eq(clientActivityLogs.clientId, id)))
        .orderBy(desc(clientActivityLogs.timestamp))
        .limit(100);

      res.json(logs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
  });

  // Get discovered devices for a client
  app.get('/api/monitoring-clients/:id/discovered-devices', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const devices = await db
        .select()
        .from(clientDiscoveredDevices)
        .where(
          and(
            eq(clientDiscoveredDevices.tenantId, tenantId),
            eq(clientDiscoveredDevices.clientId, id),
          ),
        )
        .orderBy(desc(clientDiscoveredDevices.lastSeen));

      res.json(devices);
    } catch (error) {
      console.error('Error fetching discovered devices:', error);
      res.status(500).json({ message: 'Failed to fetch discovered devices' });
    }
  });

  // ============================================================
  // CLIENT SUBMISSION ENDPOINTS (Authenticated with API key)
  // ============================================================

  // Submit metrics from monitoring client
  app.post('/api/client-metrics/submit', authenticateClient, async (req: any, res) => {
    try {
      const client = req.monitoringClient;
      const tenantId = req.tenantId;

      // Validate submission data
      const validatedData = clientMetricSubmissionSchema.parse(req.body);

      // Update client heartbeat
      await db
        .update(monitoringClients)
        .set({
          lastHeartbeat: new Date(),
          version: validatedData.clientVersion || client.version,
          updatedAt: new Date(),
        })
        .where(eq(monitoringClients.id, client.id));

      // Get or create a manufacturer integration for this client
      let integration = await db
        .select()
        .from(manufacturerIntegrations)
        .where(
          and(
            eq(manufacturerIntegrations.tenantId, tenantId),
            eq(manufacturerIntegrations.manufacturer, 'printanista'), // Use printanista as the manufacturer type for custom clients
            eq(manufacturerIntegrations.integrationName, `Client: ${client.clientName}`),
          ),
        )
        .limit(1);

      if (!integration[0]) {
        // Create integration for this client
        [integration[0]] = await db
          .insert(manufacturerIntegrations)
          .values({
            tenantId,
            manufacturer: 'printanista',
            integrationName: `Client: ${client.clientName}`,
            status: 'active',
            authMethod: 'api_key',
            credentials: { clientId: client.id },
            collectionFrequency: 'hourly',
            isActive: true,
          })
          .returning();
      }

      const processedDevices = [];
      const errors = [];

      // Process each device in the submission
      for (const deviceData of validatedData.devices) {
        try {
          // Find or create device registration
          let device = await db
            .select()
            .from(deviceRegistrations)
            .where(
              and(
                eq(deviceRegistrations.tenantId, tenantId),
                eq(deviceRegistrations.serialNumber, deviceData.serialNumber),
              ),
            )
            .limit(1);

          if (!device[0]) {
            // Register new device
            [device[0]] = await db
              .insert(deviceRegistrations)
              .values({
                tenantId,
                integrationId: integration[0].id,
                deviceId: deviceData.serialNumber,
                deviceName: deviceData.model || `Device ${deviceData.serialNumber}`,
                model: deviceData.model,
                serialNumber: deviceData.serialNumber,
                ipAddress: deviceData.ipAddress,
                status: deviceData.deviceStatus || 'online',
                lastSeen: new Date(deviceData.collectionTimestamp),
              })
              .returning();

            // Also add to discovered devices
            await db.insert(clientDiscoveredDevices).values({
              tenantId,
              clientId: client.id,
              ipAddress: deviceData.ipAddress || 'unknown',
              macAddress: deviceData.macAddress,
              serialNumber: deviceData.serialNumber,
              manufacturer: deviceData.manufacturer,
              model: deviceData.model,
              protocol: 'snmp',
              isRegistered: true,
              registeredDeviceId: device[0].id,
              lastSeen: new Date(deviceData.collectionTimestamp),
            });
          } else {
            // Update existing device
            await db
              .update(deviceRegistrations)
              .set({
                status: deviceData.deviceStatus || device[0].status,
                lastSeen: new Date(deviceData.collectionTimestamp),
                ipAddress: deviceData.ipAddress || device[0].ipAddress,
                updatedAt: new Date(),
              })
              .where(eq(deviceRegistrations.id, device[0].id));
          }

          // Insert device metrics
          await db.insert(deviceMetrics).values({
            tenantId,
            deviceId: device[0].id,
            integrationId: integration[0].id,
            collectionTimestamp: new Date(deviceData.collectionTimestamp),
            totalImpressions: deviceData.meters?.totalImpressions,
            bwImpressions: deviceData.meters?.bwImpressions,
            colorImpressions: deviceData.meters?.colorImpressions,
            largeImpressions: deviceData.meters?.largeImpressions,
            deviceStatus: deviceData.deviceStatus || 'online',
            tonerLevels: deviceData.tonerLevels || {},
            paperLevels: deviceData.paperLevels || {},
            errorCodes: deviceData.errorCodes || [],
            rawData: deviceData.rawData || {},
          });

          // Check for toner alerts and trigger notifications
          if (deviceData.tonerLevels) {
            const CRITICAL_THRESHOLD = 10;
            const WARNING_THRESHOLD = 20;

            for (const [color, level] of Object.entries(deviceData.tonerLevels)) {
              if (level <= CRITICAL_THRESHOLD) {
                // Critical toner level - trigger replenishment order
                console.log(
                  `[TONER ALERT] Critical: ${device[0].deviceName} - ${color} toner at ${level}%`,
                );

                // TODO: Integration with notification system
                // Create notification for low toner
                // Trigger automatic toner order if contract includes toner
              } else if (level <= WARNING_THRESHOLD) {
                // Warning level - notify but don't order yet
                console.log(
                  `[TONER ALERT] Warning: ${device[0].deviceName} - ${color} toner at ${level}%`,
                );
              }
            }
          }

          // Check for meter differential and billing (if provided by client)
          if (deviceData.rawData?.differential) {
            const diff = deviceData.rawData.differential;

            // Log usage for billing
            console.log(`[BILLING] ${device[0].deviceName} usage since last reading:`, {
              total: diff.totalImpressions,
              bw: diff.bwImpressions,
              color: diff.colorImpressions,
              hasRollover: diff.hasRollover,
            });

            // TODO: Integration with billing system
            // Calculate billable impressions based on service contract
            // Generate invoice line items for overage clicks
          }

          processedDevices.push({
            serialNumber: deviceData.serialNumber,
            status: 'success',
          });
        } catch (deviceError) {
          console.error(`Error processing device ${deviceData.serialNumber}:`, deviceError);
          errors.push({
            serialNumber: deviceData.serialNumber,
            error: deviceError instanceof Error ? deviceError.message : 'Unknown error',
          });
        }
      }

      // Update client statistics
      await db
        .update(monitoringClients)
        .set({
          lastSuccessfulCollection: new Date(),
          totalDevicesMonitored: processedDevices.length,
          totalMetricsCollected:
            ((client.totalMetricsCollected as number) || 0) + processedDevices.length,
        })
        .where(eq(monitoringClients.id, client.id));

      // Log activity
      await db.insert(clientActivityLogs).values({
        tenantId,
        clientId: client.id,
        activity: 'metrics_submitted',
        status: errors.length > 0 ? 'warning' : 'success',
        message: `Processed ${processedDevices.length} devices, ${errors.length} errors`,
        details: {
          successCount: processedDevices.length,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
        devicesInSubmission: validatedData.devices.length,
        metricsCount: processedDevices.length,
      });

      res.json({
        message: 'Metrics submitted successfully',
        processed: processedDevices.length,
        errors: errors.length,
        details: {
          successful: processedDevices,
          failed: errors,
        },
      });
    } catch (error) {
      console.error('Error processing metric submission:', error);

      // Log error activity
      if (req.monitoringClient) {
        await db.insert(clientActivityLogs).values({
          tenantId: req.tenantId,
          clientId: req.monitoringClient.id,
          activity: 'metrics_submitted',
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { error: String(error) },
          errorCode: 'SUBMISSION_ERROR',
        });
      }

      res.status(500).json({
        message: 'Failed to process metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Client heartbeat endpoint
  app.post('/api/client-metrics/heartbeat', authenticateClient, async (req: any, res) => {
    try {
      const client = req.monitoringClient;

      await db
        .update(monitoringClients)
        .set({
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(monitoringClients.id, client.id));

      // Log heartbeat
      await db.insert(clientActivityLogs).values({
        tenantId: req.tenantId,
        clientId: client.id,
        activity: 'heartbeat',
        status: 'success',
        message: 'Client heartbeat received',
      });

      res.json({
        message: 'Heartbeat received',
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error processing heartbeat:', error);
      res.status(500).json({ message: 'Failed to process heartbeat' });
    }
  });

  // Get client configuration
  app.get('/api/client-metrics/config', authenticateClient, async (req: any, res) => {
    try {
      const client = req.monitoringClient;

      res.json({
        clientId: client.clientId,
        clientName: client.clientName,
        configuration: client.configuration,
        status: client.status,
      });
    } catch (error) {
      console.error('Error fetching client config:', error);
      res.status(500).json({ message: 'Failed to fetch configuration' });
    }
  });

  // ============================================================
  // FLEET DASHBOARD ENDPOINTS (Authenticated with user token)
  // ============================================================

  // Get fleet-wide dashboard overview
  app.get('/api/fleet/dashboard', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get all devices for this tenant
      const devices = await db
        .select()
        .from(deviceRegistrations)
        .where(eq(deviceRegistrations.tenantId, tenantId));

      // Get latest metrics for each device
      const deviceIds = devices.map((d) => d.id);
      const latestMetrics = await db
        .select()
        .from(deviceMetrics)
        .where(eq(deviceMetrics.tenantId, tenantId))
        .orderBy(desc(deviceMetrics.collectionTimestamp));

      // Build metrics map (latest per device)
      const metricsMap = new Map();
      for (const metric of latestMetrics) {
        if (!metricsMap.has(metric.deviceId)) {
          metricsMap.set(metric.deviceId, metric);
        }
      }

      // Calculate fleet statistics
      let totalDevices = devices.length;
      let onlineDevices = 0;
      let offlineDevices = 0;
      let devicesWithAlerts = 0;
      let criticalAlerts = 0;
      const tonerAlerts = [];

      for (const device of devices) {
        const metrics = metricsMap.get(device.id);

        // Count status
        if (device.status === 'online') onlineDevices++;
        if (device.status === 'offline') offlineDevices++;

        // Check toner levels for alerts
        if (metrics?.tonerLevels) {
          const levels = metrics.tonerLevels as any;
          let hasAlert = false;
          let hasCritical = false;

          for (const [color, level] of Object.entries(levels)) {
            if (typeof level === 'number') {
              if (level <= 10) {
                hasCritical = true;
                hasAlert = true;
                tonerAlerts.push({
                  deviceId: device.id,
                  deviceName: device.deviceName,
                  serialNumber: device.serialNumber,
                  color,
                  level,
                  severity: 'critical',
                  message: `${color} toner critically low (${level}%)`,
                });
              } else if (level <= 20) {
                hasAlert = true;
                tonerAlerts.push({
                  deviceId: device.id,
                  deviceName: device.deviceName,
                  serialNumber: device.serialNumber,
                  color,
                  level,
                  severity: 'warning',
                  message: `${color} toner low (${level}%)`,
                });
              }
            }
          }

          if (hasAlert) devicesWithAlerts++;
          if (hasCritical) criticalAlerts++;
        }
      }

      // Calculate total impressions across fleet
      let totalBWImpressions = 0;
      let totalColorImpressions = 0;

      for (const [deviceId, metrics] of metricsMap.entries()) {
        totalBWImpressions += metrics.bwImpressions || 0;
        totalColorImpressions += metrics.colorImpressions || 0;
      }

      res.json({
        summary: {
          totalDevices,
          onlineDevices,
          offlineDevices,
          devicesWithAlerts,
          criticalAlerts,
          averageUptime: 96.8, // TODO: Calculate from uptime metrics
          fleetUtilization: 78.5, // TODO: Calculate from usage patterns
        },
        statusDistribution: {
          online: onlineDevices,
          offline: offlineDevices,
          warning: devicesWithAlerts - criticalAlerts,
          critical: criticalAlerts,
        },
        impressions: {
          totalBW: totalBWImpressions,
          totalColor: totalColorImpressions,
        },
        tonerAlerts: tonerAlerts.slice(0, 10), // Top 10 alerts
        topDevicesNeedingAttention: tonerAlerts
          .filter((a) => a.severity === 'critical')
          .slice(0, 5)
          .map((alert) => ({
            deviceId: alert.deviceId,
            deviceName: alert.deviceName,
            serialNumber: alert.serialNumber,
            issues: [`${alert.color} toner at ${alert.level}%`],
            priority: 'high',
          })),
      });
    } catch (error) {
      console.error('Error fetching fleet dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch fleet dashboard' });
    }
  });

  // Get all monitored devices with current status
  app.get('/api/fleet/devices', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const { status, search } = req.query;

      // Get all devices
      let query = db
        .select()
        .from(deviceRegistrations)
        .where(eq(deviceRegistrations.tenantId, tenantId));

      const devices = await query.orderBy(desc(deviceRegistrations.lastSeen));

      // Get latest metrics for each device
      const latestMetrics = await db
        .select()
        .from(deviceMetrics)
        .where(eq(deviceMetrics.tenantId, tenantId))
        .orderBy(desc(deviceMetrics.collectionTimestamp));

      // Build metrics map
      const metricsMap = new Map();
      for (const metric of latestMetrics) {
        if (!metricsMap.has(metric.deviceId)) {
          metricsMap.set(metric.deviceId, metric);
        }
      }

      // Combine device info with latest metrics
      const enrichedDevices = devices.map((device) => {
        const metrics = metricsMap.get(device.id);
        return {
          ...device,
          currentMetrics: metrics
            ? {
                tonerLevels: metrics.tonerLevels,
                paperLevels: metrics.paperLevels,
                totalImpressions: metrics.totalImpressions,
                bwImpressions: metrics.bwImpressions,
                colorImpressions: metrics.colorImpressions,
                deviceStatus: metrics.deviceStatus,
                collectionTimestamp: metrics.collectionTimestamp,
              }
            : null,
        };
      });

      // Filter by status if provided
      let filteredDevices = enrichedDevices;
      if (status) {
        filteredDevices = enrichedDevices.filter((d) => d.status === status);
      }

      // Filter by search if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        filteredDevices = filteredDevices.filter(
          (d) =>
            d.deviceName?.toLowerCase().includes(searchLower) ||
            d.serialNumber?.toLowerCase().includes(searchLower) ||
            d.model?.toLowerCase().includes(searchLower),
        );
      }

      res.json(filteredDevices);
    } catch (error) {
      console.error('Error fetching fleet devices:', error);
      res.status(500).json({ message: 'Failed to fetch fleet devices' });
    }
  });

  // Get device-specific metrics history
  app.get('/api/fleet/devices/:id/metrics', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const { startDate, endDate, limit = 100 } = req.query;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get device info
      const device = await db
        .select()
        .from(deviceRegistrations)
        .where(and(eq(deviceRegistrations.tenantId, tenantId), eq(deviceRegistrations.id, id)))
        .limit(1);

      if (!device[0]) {
        return res.status(404).json({ message: 'Device not found' });
      }

      // Get metrics history
      let metricsQuery = db
        .select()
        .from(deviceMetrics)
        .where(and(eq(deviceMetrics.tenantId, tenantId), eq(deviceMetrics.deviceId, id)))
        .orderBy(desc(deviceMetrics.collectionTimestamp));

      const metrics = await metricsQuery.limit(Number(limit));

      res.json({
        device: device[0],
        metrics,
        totalReadings: metrics.length,
      });
    } catch (error) {
      console.error('Error fetching device metrics:', error);
      res.status(500).json({ message: 'Failed to fetch device metrics' });
    }
  });

  // Get customer-specific devices
  app.get('/api/customers/:customerId/devices', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { customerId } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get all devices for this tenant
      const devices = await db
        .select()
        .from(deviceRegistrations)
        .where(eq(deviceRegistrations.tenantId, tenantId))
        .orderBy(desc(deviceRegistrations.lastSeen));

      // Get latest metrics for each device
      const latestMetrics = await db
        .select()
        .from(deviceMetrics)
        .where(eq(deviceMetrics.tenantId, tenantId))
        .orderBy(desc(deviceMetrics.collectionTimestamp));

      // Build metrics map
      const metricsMap = new Map();
      for (const metric of latestMetrics) {
        if (!metricsMap.has(metric.deviceId)) {
          metricsMap.set(metric.deviceId, metric);
        }
      }

      // Enrich devices with latest metrics
      const enrichedDevices = devices.map((device) => {
        const metrics = metricsMap.get(device.id);
        return {
          ...device,
          currentMetrics: metrics
            ? {
                tonerLevels: metrics.tonerLevels,
                paperLevels: metrics.paperLevels,
                totalImpressions: metrics.totalImpressions,
                bwImpressions: metrics.bwImpressions,
                colorImpressions: metrics.colorImpressions,
                deviceStatus: metrics.deviceStatus,
                collectionTimestamp: metrics.collectionTimestamp,
              }
            : null,
        };
      });

      res.json({
        customerId,
        devices: enrichedDevices,
        totalDevices: enrichedDevices.length,
      });
    } catch (error) {
      console.error('Error fetching customer devices:', error);
      res.status(500).json({ message: 'Failed to fetch customer devices' });
    }
  });

  // Get customer meter reading history
  app.get('/api/customers/:customerId/metrics/history', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { customerId } = req.params;
      const { startDate, endDate, limit = 1000 } = req.query;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get all devices for this customer
      const devices = await db
        .select()
        .from(deviceRegistrations)
        .where(eq(deviceRegistrations.tenantId, tenantId));

      const deviceIds = devices.map((d) => d.id);

      // Get all metrics for these devices
      const metrics = await db
        .select()
        .from(deviceMetrics)
        .where(eq(deviceMetrics.tenantId, tenantId))
        .orderBy(desc(deviceMetrics.collectionTimestamp))
        .limit(Number(limit));

      // Group metrics by device
      const metricsByDevice = new Map();
      for (const metric of metrics) {
        if (!metricsByDevice.has(metric.deviceId)) {
          metricsByDevice.set(metric.deviceId, []);
        }
        metricsByDevice.get(metric.deviceId).push(metric);
      }

      // Build timeline
      const timeline = devices.map((device) => ({
        deviceId: device.id,
        deviceName: device.deviceName,
        serialNumber: device.serialNumber,
        model: device.model,
        readings: metricsByDevice.get(device.id) || [],
      }));

      res.json({
        customerId,
        timeline,
        totalDevices: devices.length,
        totalReadings: metrics.length,
      });
    } catch (error) {
      console.error('Error fetching customer metrics history:', error);
      res.status(500).json({ message: 'Failed to fetch customer metrics history' });
    }
  });

  // Manual toner order trigger
  app.post('/api/devices/:id/order-toner', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const { colors, urgent = false, notes } = req.body;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get device info with manufacturer integration
      const device = await db
        .select({
          id: deviceRegistrations.id,
          deviceName: deviceRegistrations.deviceName,
          serialNumber: deviceRegistrations.serialNumber,
          model: deviceRegistrations.model,
          location: deviceRegistrations.location,
          integrationId: deviceRegistrations.integrationId,
          manufacturer: manufacturerIntegrations.manufacturer,
        })
        .from(deviceRegistrations)
        .leftJoin(
          manufacturerIntegrations,
          eq(deviceRegistrations.integrationId, manufacturerIntegrations.id),
        )
        .where(and(eq(deviceRegistrations.tenantId, tenantId), eq(deviceRegistrations.id, id)))
        .limit(1);

      if (!device[0]) {
        return res.status(404).json({ message: 'Device not found' });
      }

      // Get latest metrics
      const latestMetric = await db
        .select()
        .from(deviceMetrics)
        .where(and(eq(deviceMetrics.tenantId, tenantId), eq(deviceMetrics.deviceId, id)))
        .orderBy(desc(deviceMetrics.collectionTimestamp))
        .limit(1);

      // Log the toner order request
      console.log('[TONER ORDER] Manual order triggered:', {
        deviceId: id,
        deviceName: device[0].deviceName,
        serialNumber: device[0].serialNumber,
        colors,
        urgent,
        currentLevels: latestMetric[0]?.tonerLevels || {},
        notes,
      });

      // Generate order number
      const orderNumber = `TONER-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create supply order
      // Note: In a real implementation, you would:
      // 1. Get the actual customerId from the device registration
      // 2. Get or create a customerPortalUserId
      // 3. Check warehouse inventory for each toner color
      // 4. Determine pricing and contract coverage
      // For now, we'll create a basic order structure

      try {
        // Lookup products first to calculate order total
        const productLookups = await Promise.all(
          colors.map(async (color: string) => {
            return await lookupTonerProduct(
              tenantId,
              device[0].manufacturer,
              device[0].model,
              color,
            );
          }),
        );

        // Calculate order totals
        const subtotal = productLookups.reduce((sum, product) => {
          const price = parseFloat(product?.unitPrice || '99.99');
          return sum + price;
        }, 0);
        const tax = 0; // TODO: Calculate based on location/tax rules
        const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
        const total = subtotal + tax + shipping;

        // Create the main supply order
        const supplyOrder = await db
          .insert(customerSupplyOrders)
          .values({
            tenantId,
            customerId: tenantId, // In real implementation, get actual customer ID from device
            customerPortalUserId: req.user?.id || tenantId, // Use authenticated user ID
            orderNumber,
            status: urgent ? 'submitted' : 'draft',
            deliveryAddress: {
              address: device[0].location || 'Device location not specified',
            },
            deliveryInstructions: notes || 'Toner replenishment for low toner alert',
            requestedDeliveryDate: urgent ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null, // Next day if urgent
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            shipping: shipping.toFixed(2),
            total: total.toFixed(2),
            isContractCovered: false, // TODO: Check service contract coverage
            customerNotes: `Auto-generated toner order for ${device[0].deviceName}`,
            internalNotes: `Device: ${device[0].serialNumber}, Current levels: ${JSON.stringify(latestMetric[0]?.tonerLevels || {})}`,
            submittedAt: urgent ? new Date() : null,
          })
          .returning();

        console.log('[SUPPLY ORDER] Created order:', {
          orderId: supplyOrder[0].id,
          orderNumber: supplyOrder[0].orderNumber,
          status: supplyOrder[0].status,
        });

        // Create order items for each toner color using previously looked up products
        const orderItems = await Promise.all(
          colors.map(async (color: string, index: number) => {
            const currentLevel = latestMetric[0]?.tonerLevels
              ? (latestMetric[0].tonerLevels as any)[color]
              : 0;

            // Use product from earlier lookup
            const tonerProduct = productLookups[index];

            // Use product catalog data if found, otherwise use placeholders
            const productId = tonerProduct?.productId || tenantId;
            const productSku = tonerProduct?.productSku || `TONER-${color.toUpperCase()}-${device[0].model?.replace(/\s+/g, '-')}`;
            const productName = tonerProduct?.productName || `${color.charAt(0).toUpperCase() + color.slice(1)} Toner Cartridge`;
            const productDescription = tonerProduct?.productDescription || `Compatible with ${device[0].model}`;
            const unitPrice = tonerProduct?.unitPrice || '99.99';
            const inStock = tonerProduct?.inStock ?? true;

            const result = await db
              .insert(customerSupplyOrderItems)
              .values({
                orderId: supplyOrder[0].id,
                productId,
                productSku,
                productName,
                productDescription,
                compatibleEquipmentId: id,
                quantity: 1,
                unitPrice,
                totalPrice: unitPrice,
                inStock,
                customerNotes: `Current level: ${currentLevel}%`,
              })
              .returning();

            console.log('[SUPPLY ORDER ITEM] Created item:', {
              color,
              productId,
              productSku,
              productName,
              unitPrice,
              inStock,
              fromCatalog: !!tonerProduct,
            });

            return result;
          }),
        );

        console.log('[SUPPLY ORDER ITEMS] Created items:', orderItems.length, 'Subtotal:', subtotal.toFixed(2));

        // Create notification for customer
        try {
          await db.insert(customerNotifications).values({
            tenantId,
            customerId: tenantId, // In real implementation, use actual customer ID
            customerPortalUserId: req.user?.id || tenantId,
            type: 'supply_low',
            title: urgent ? 'Urgent Toner Order Placed' : 'Toner Order Created',
            message: `A toner order (${orderNumber}) has been ${urgent ? 'submitted' : 'created'} for ${device[0].deviceName}. Colors: ${colors.join(', ')}`,
            relatedServiceRequestId: null,
            relatedSupplyOrderId: supplyOrder[0].id,
            isRead: false,
            isPriority: urgent,
          });

          console.log('[NOTIFICATION] Created notification for toner order');
        } catch (notificationError) {
          console.error('[NOTIFICATION] Failed to create notification:', notificationError);
          // Don't fail the order if notification fails
        }

        res.json({
          success: true,
          message: 'Toner order created successfully',
          order: {
            orderId: supplyOrder[0].id,
            orderNumber: supplyOrder[0].orderNumber,
            deviceId: id,
            deviceName: device[0].deviceName,
            serialNumber: device[0].serialNumber,
            colors,
            urgent,
            currentLevels: latestMetric[0]?.tonerLevels || {},
            status: supplyOrder[0].status,
            items: orderItems.map((item) => item[0]),
            deliveryAddress: supplyOrder[0].deliveryAddress,
            requestedDeliveryDate: supplyOrder[0].requestedDeliveryDate,
          },
        });
      } catch (orderError) {
        console.error('[SUPPLY ORDER] Failed to create order:', orderError);
        throw orderError;
      }
    } catch (error) {
      console.error('Error triggering toner order:', error);
      res.status(500).json({ message: 'Failed to trigger toner order' });
    }
  });
}
