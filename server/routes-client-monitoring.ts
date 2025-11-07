import type { Express } from 'express';
import { db } from './db';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import {
  monitoringClients,
  clientActivityLogs,
  clientDiscoveredDevices,
  deviceRegistrations,
  deviceMetrics,
  manufacturerIntegrations,
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
}
