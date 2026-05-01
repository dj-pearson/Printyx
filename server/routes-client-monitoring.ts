import type { Express } from 'express';
import { db } from './db';
import { eq, and, desc, like, or, lte, gte, inArray, isNotNull } from 'drizzle-orm';
import { materializeAlerts } from './services/alert-materializer';
import { resolveOfflineFor } from './services/offline-detector';
import crypto from 'crypto';
import { emailService } from './services/email-service';
import { smsService } from './services/sms-service';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-client-monitoring');

import {
  monitoringClients,
  clientActivityLogs,
  clientDiscoveredDevices,
  clientCommands,
  deviceRegistrations,
  deviceMetrics,
  manufacturerIntegrations,
  customerSupplyOrders,
  customerSupplyOrderItems,
  customerNotifications,
  supplies,
  equipment,
  inventoryItems,
  serviceContracts,
  customerPortalAccess,
  insertMonitoringClientSchema,
  insertClientActivityLogSchema,
  insertClientDiscoveredDeviceSchema,
  insertDeviceMetricSchema,
  clientMetricSubmissionSchema,
} from '@shared/schema';
// RBAC Integration (for admin routes)
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

import { getUserId, getTenantId } from './utils/auth-helpers';
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
    log.error('Error authenticating client:', error);
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
  quantityAvailable: number;
  estimatedShipDate: Date | null;
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
      or(like(supplies.productCode, pattern), like(supplies.productName, pattern)),
    );

    const results = await db
      .select()
      .from(supplies)
      .where(and(eq(supplies.tenantId, tenantId), eq(supplies.isActive, true), or(...conditions)))
      .limit(1);

    if (results.length === 0) {
      log.info('[TONER LOOKUP] No product found for:', {
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

    // Check warehouse inventory for actual stock availability
    const inventory = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.tenantId, tenantId),
          or(
            eq(inventoryItems.partNumber, product.productCode),
            eq(inventoryItems.manufacturerPartNumber, product.productCode),
          ),
          eq(inventoryItems.isActive, true),
        ),
      )
      .limit(1);

    // Determine stock availability
    let inStock = false;
    let quantityAvailable = 0;
    let estimatedShipDate: Date | null = null;

    if (inventory.length > 0) {
      // Check actual inventory levels
      quantityAvailable = inventory[0].quantityAvailable || 0;
      inStock = quantityAvailable > 0;

      if (!inStock && (inventory[0].quantityOnOrder || 0) > 0) {
        // Not in stock but on order - estimate 7-10 days
        estimatedShipDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      log.info('[WAREHOUSE INVENTORY] Stock check:', {
        partNumber: inventory[0].partNumber,
        quantityOnHand: inventory[0].quantityOnHand,
        quantityCommitted: inventory[0].quantityCommitted,
        quantityAvailable,
        quantityOnOrder: inventory[0].quantityOnOrder,
        warehouseLocation: inventory[0].warehouseLocation,
        binLocation: inventory[0].binLocation,
      });
    } else {
      // Fallback to product table flag if no inventory record
      inStock = product.inStock === 'true' || product.inStock === '1' || product.inventory !== '0';
      log.info('[WAREHOUSE INVENTORY] No inventory record found, using product flag:', inStock);
    }

    log.info('[TONER LOOKUP] Found product:', {
      productId: product.id,
      productCode: product.productCode,
      productName: product.productName,
      unitPrice,
      inStock,
      quantityAvailable,
      estimatedShipDate,
    });

    return {
      productId: product.id,
      productSku: product.productCode,
      productName: product.productName,
      productDescription:
        product.summary || `${product.productName} - Compatible with ${manufacturer} ${model}`,
      unitPrice,
      inStock,
      quantityAvailable,
      estimatedShipDate,
    };
  } catch (error) {
    log.error('[TONER LOOKUP] Error looking up toner product:', error);
    return null;
  }
}

/**
 * Helper function to check if toner is covered under a service contract
 * @param tenantId - Tenant ID
 * @param equipmentId - Equipment/device ID (from deviceRegistrations)
 * @param customerId - Customer ID (optional)
 * @returns Service contract coverage information
 */
async function checkServiceContractCoverage(
  tenantId: string,
  equipmentId: string,
  customerId?: string,
): Promise<{
  isCovered: boolean;
  contractId: string | null;
  contractNumber: string | null;
  contractType: string | null;
  includesToner: boolean;
  includesParts: boolean;
  includesLabor: boolean;
} | null> {
  try {
    const now = new Date();

    // Build query conditions
    const conditions = [
      eq(serviceContracts.tenantId, tenantId),
      eq(serviceContracts.contractStatus, 'active'),
      lte(serviceContracts.startDate, now), // Contract has started
    ];

    // Add equipment or customer filter
    if (equipmentId) {
      conditions.push(eq(serviceContracts.equipmentId, equipmentId));
    } else if (customerId) {
      conditions.push(eq(serviceContracts.customerId, customerId));
    }

    // Query for active service contracts
    const contracts = await db
      .select()
      .from(serviceContracts)
      .where(and(...conditions))
      .limit(1);

    if (contracts.length === 0) {
      log.info('[SERVICE CONTRACT] No active contract found for equipment:', equipmentId);
      return {
        isCovered: false,
        contractId: null,
        contractNumber: null,
        contractType: null,
        includesToner: false,
        includesParts: false,
        includesLabor: false,
      };
    }

    const contract = contracts[0];

    // Check if contract has expired
    if (contract.endDate && new Date(contract.endDate) < now) {
      log.info('[SERVICE CONTRACT] Contract expired:', {
        contractNumber: contract.contractNumber,
        endDate: contract.endDate,
      });
      return {
        isCovered: false,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractType: contract.contractType,
        includesToner: false,
        includesParts: false,
        includesLabor: false,
      };
    }

    // Contract is active and valid
    const isCovered = contract.includesToner ?? false;

    log.info('[SERVICE CONTRACT] Found active contract:', {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
      includesToner: contract.includesToner,
      includesParts: contract.includesParts,
      includesLabor: contract.includesLabor,
      startDate: contract.startDate,
      endDate: contract.endDate,
      isCovered,
    });

    return {
      isCovered,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
      includesToner: contract.includesToner ?? false,
      includesParts: contract.includesParts ?? false,
      includesLabor: contract.includesLabor ?? false,
    };
  } catch (error) {
    log.error('[SERVICE CONTRACT] Error checking coverage:', error);
    return null;
  }
}

/**
 * Helper function to send email/SMS notifications
 * @param notificationId - Notification record ID
 * @param tenantId - Tenant ID
 * @param recipientEmail - Email address (optional)
 * @param recipientPhone - Phone number for SMS (optional)
 * @param title - Notification title
 * @param message - Notification message
 * @returns Success status
 */
async function sendNotificationAlerts(
  notificationId: string,
  tenantId: string,
  recipientEmail?: string,
  recipientPhone?: string,
  title?: string,
  message?: string,
): Promise<{ emailSent: boolean; smsSent: boolean }> {
  let emailSent = false;
  let smsSent = false;

  try {
    // Send email notification
    if (recipientEmail) {
      log.info('[EMAIL NOTIFICATION] Sending email:', {
        notificationId,
        to: recipientEmail,
        title,
        message: message?.substring(0, 100) + '...',
      });

      // Send email via configured provider (defaults to simulation mode)
      const emailResult = await emailService.send({
        to: recipientEmail,
        subject: title || 'Printyx Notification',
        html: message || '',
        text: message?.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
      });

      // Only mark as sent if the provider reports success
      if (emailResult.success) {
        emailSent = true;
        await db
          .update(customerNotifications)
          .set({
            isEmailSent: true,
            emailSentAt: new Date(),
          })
          .where(eq(customerNotifications.id, notificationId));

        log.info(
          '[EMAIL NOTIFICATION] Email sent successfully:',
          notificationId,
          emailResult.messageId,
        );
      } else {
        log.error('[EMAIL NOTIFICATION] Email failed to send:', notificationId, emailResult.error);
      }
    }

    // Send SMS notification
    if (recipientPhone) {
      log.info('[SMS NOTIFICATION] Sending SMS:', {
        notificationId,
        to: recipientPhone,
        message: message?.substring(0, 100) + '...',
      });

      // Send SMS via configured provider (defaults to simulation mode)
      const smsBody = `${title || 'Printyx Notification'}\n\n${message?.replace(/<[^>]*>/g, '') || ''}`;
      const smsResult = await smsService.send({
        to: recipientPhone,
        body: smsBody.substring(0, 160), // Limit to standard SMS length
      });

      // Only mark as sent if the provider reports success
      if (smsResult.success) {
        smsSent = true;
        await db
          .update(customerNotifications)
          .set({
            isSmsSent: true,
            smsSentAt: new Date(),
          })
          .where(eq(customerNotifications.id, notificationId));

        log.info('[SMS NOTIFICATION] SMS sent successfully:', notificationId, smsResult.messageId);
      } else {
        log.error('[SMS NOTIFICATION] SMS failed to send:', notificationId, smsResult.error);
      }
    }

    return { emailSent, smsSent };
  } catch (error) {
    log.error('[NOTIFICATION] Error sending alerts:', error);
    return { emailSent, smsSent };
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
      log.error('Error fetching monitoring clients:', error);
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
      log.error('Error creating monitoring client:', error);
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
      log.error('Error fetching monitoring client:', error);
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
      log.error('Error updating monitoring client:', error);
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
      log.error('Error rotating API key:', error);
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
      log.error('Error deleting monitoring client:', error);
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
      log.error('Error fetching activity logs:', error);
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
      log.error('Error fetching discovered devices:', error);
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
            // Register new device. Denormalise the monitoring client's
            // customer link onto the device row so auto-order and
            // customer-scoped reporting don't have to traverse
            // monitoring_clients on every read.
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
                customerId: client.customerId || null,
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
            // Update existing device. Re-sync customerId from the
            // monitoring client so re-linking the client to a different
            // customer in the UI propagates to its devices on the
            // next /submit cycle.
            await db
              .update(deviceRegistrations)
              .set({
                status: deviceData.deviceStatus || device[0].status,
                lastSeen: new Date(deviceData.collectionTimestamp),
                ipAddress: deviceData.ipAddress || device[0].ipAddress,
                customerId: client.customerId || device[0].customerId,
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

          // Materialise alerts into the device_alerts table. Idempotent —
          // upserts active alerts, auto-resolves cleared conditions,
          // preserves operator acknowledge/snooze state. Errors here are
          // non-fatal: a metric should always be ingested, even if the
          // alert pipeline trips.
          try {
            await materializeAlerts({
              tenantId,
              deviceId: device[0].id,
              tonerLevels: deviceData.tonerLevels,
              paperLevels: deviceData.paperLevels,
            });
          } catch (alertErr) {
            log.warn('Alert materialisation failed (non-fatal)', {
              deviceId: device[0].id,
              alertErr,
            });
          }

          // A fresh /submit means the device just talked to us — resolve
          // any open offline alert in O(1). The sweep would catch this
          // eventually but the operator shouldn't have to wait an extra
          // 5 minutes for the dashboard to clear.
          await resolveOfflineFor(tenantId, device[0].id).catch(() => {
            /* swallowed inside the helper */
          });

          // Check for meter differential and billing (if provided by client)
          if (deviceData.rawData?.differential) {
            const diff = deviceData.rawData.differential;

            // Log usage for billing
            log.info(`[BILLING] ${device[0].deviceName} usage since last reading:`, {
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
          log.error(`Error processing device ${deviceData.serialNumber}:`, deviceError);
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
      log.error('Error processing metric submission:', error);

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

  // Client heartbeat endpoint. The agent calls this every 5 minutes.
  // We piggyback the command channel: any pending commands for this
  // client are returned in the response and atomically marked
  // 'dispatched' so a second concurrent heartbeat doesn't double-process.
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

      // Expire stale commands so the queue self-heals when an agent goes
      // dark. Cheap one-row sweep on each heartbeat.
      await db
        .update(clientCommands)
        .set({ status: 'expired', completedAt: new Date() })
        .where(
          and(
            eq(clientCommands.clientId, client.id),
            inArray(clientCommands.status, ['queued', 'dispatched']),
            lte(clientCommands.expiresAt, new Date()),
          ),
        );

      // Pull queued commands and atomically mark them dispatched. Drizzle's
      // returning() lets us do this without a separate select.
      const dispatched = await db
        .update(clientCommands)
        .set({ status: 'dispatched', dispatchedAt: new Date() })
        .where(and(eq(clientCommands.clientId, client.id), eq(clientCommands.status, 'queued')))
        .returning({
          id: clientCommands.id,
          command: clientCommands.command,
          payload: clientCommands.payload,
        });

      // Log heartbeat
      await db.insert(clientActivityLogs).values({
        tenantId: req.tenantId,
        clientId: client.id,
        activity: 'heartbeat',
        status: 'success',
        message:
          dispatched.length > 0
            ? `Heartbeat — dispatched ${dispatched.length} command(s)`
            : 'Client heartbeat received',
      });

      res.json({
        message: 'Heartbeat received',
        serverTime: new Date().toISOString(),
        pendingCommands: dispatched.map((c) => ({
          id: c.id,
          command: c.command,
          payload: c.payload || {},
        })),
      });
    } catch (error) {
      log.error('Error processing heartbeat:', error);
      res.status(500).json({ message: 'Failed to process heartbeat' });
    }
  });

  // Agent posts result of a dispatched command. The handler validates
  // ownership (the command must belong to the authenticating client) and
  // accepts a status of 'done' or 'failed' plus an optional result blob.
  app.post(
    '/api/client-metrics/commands/:commandId/ack',
    authenticateClient,
    async (req: any, res) => {
      try {
        const client = req.monitoringClient;
        const { commandId } = req.params;
        const { status, result, errorMessage } = req.body || {};
        if (status !== 'done' && status !== 'failed') {
          return res.status(400).json({ message: 'status must be "done" or "failed"' });
        }
        const command = await db.query.clientCommands.findFirst({
          where: and(eq(clientCommands.id, commandId), eq(clientCommands.clientId, client.id)),
        });
        if (!command) {
          return res.status(404).json({ message: 'Command not found' });
        }
        if (command.status !== 'dispatched') {
          return res
            .status(409)
            .json({ message: `Command is in status '${command.status}', cannot ack` });
        }
        await db
          .update(clientCommands)
          .set({
            status,
            completedAt: new Date(),
            result: result ?? null,
            errorMessage: errorMessage ?? null,
          })
          .where(eq(clientCommands.id, commandId));
        await db.insert(clientActivityLogs).values({
          tenantId: req.tenantId,
          clientId: client.id,
          activity: 'command_ack',
          status: status === 'done' ? 'success' : 'error',
          message: `Command '${command.command}' ${status}`,
          details: { commandId, result, errorMessage },
        });
        res.json({ message: 'Command ack recorded' });
      } catch (error) {
        log.error('Error processing command ack:', error);
        res.status(500).json({ message: 'Failed to process ack' });
      }
    },
  );

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
      log.error('Error fetching client config:', error);
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

      // Calculate average uptime based on current device status
      // Uptime = (online devices / total devices) * 100
      const averageUptime =
        totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 1000) / 10 : 0;

      // Calculate fleet utilization based on devices with recent activity
      // A device is "utilized" if it has metrics collected in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let activeDevices = 0;
      for (const [deviceId, metrics] of metricsMap.entries()) {
        if (
          metrics.collectionTimestamp &&
          new Date(metrics.collectionTimestamp) > twentyFourHoursAgo
        ) {
          activeDevices++;
        }
      }
      const fleetUtilization =
        totalDevices > 0 ? Math.round((activeDevices / totalDevices) * 1000) / 10 : 0;

      res.json({
        summary: {
          totalDevices,
          onlineDevices,
          offlineDevices,
          devicesWithAlerts,
          criticalAlerts,
          averageUptime,
          fleetUtilization,
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
      log.error('Error fetching fleet dashboard:', error);
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
      log.error('Error fetching fleet devices:', error);
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
      log.error('Error fetching device metrics:', error);
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
      log.error('Error fetching customer devices:', error);
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
      log.error('Error fetching customer metrics history:', error);
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
      log.info('[TONER ORDER] Manual order triggered:', {
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

        // Check service contract coverage for toner
        const contractCoverage = await checkServiceContractCoverage(tenantId, id);
        const isContractCovered = contractCoverage?.isCovered ?? false;

        // Calculate order totals (adjust for contract coverage)
        let subtotal = productLookups.reduce((sum, product) => {
          const price = parseFloat(product?.unitPrice || '99.99');
          return sum + price;
        }, 0);

        // If covered by contract, customer pays $0
        if (isContractCovered) {
          subtotal = 0;
        }

        const tax = 0; // TODO: Calculate based on location/tax rules
        const shipping = isContractCovered || subtotal > 100 ? 0 : 10; // Free shipping if covered or over $100
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
            isContractCovered,
            customerNotes: `Auto-generated toner order for ${device[0].deviceName}${isContractCovered ? ' - Covered by service contract' : ''}${contractCoverage?.contractNumber ? ` (${contractCoverage.contractNumber})` : ''}`,
            internalNotes: `Device: ${device[0].serialNumber}, Current levels: ${JSON.stringify(latestMetric[0]?.tonerLevels || {})}${contractCoverage ? `, Contract: ${contractCoverage.contractNumber || 'N/A'}, Type: ${contractCoverage.contractType || 'N/A'}` : ''}`,
            submittedAt: urgent ? new Date() : null,
          })
          .returning();

        log.info('[SUPPLY ORDER] Created order:', {
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
            const productSku =
              tonerProduct?.productSku ||
              `TONER-${color.toUpperCase()}-${device[0].model?.replace(/\s+/g, '-')}`;
            const productName =
              tonerProduct?.productName ||
              `${color.charAt(0).toUpperCase() + color.slice(1)} Toner Cartridge`;
            const productDescription =
              tonerProduct?.productDescription || `Compatible with ${device[0].model}`;
            const unitPrice = tonerProduct?.unitPrice || '99.99';
            const inStock = tonerProduct?.inStock ?? true;
            const estimatedShipDate = tonerProduct?.estimatedShipDate || null;
            const quantityAvailable = tonerProduct?.quantityAvailable || 0;

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
                estimatedShipDate,
                customerNotes: `Current level: ${currentLevel}%${!inStock && estimatedShipDate ? ` - Estimated ship: ${estimatedShipDate.toLocaleDateString()}` : ''}${inStock ? ` - ${quantityAvailable} available` : ''}`,
              })
              .returning();

            log.info('[SUPPLY ORDER ITEM] Created item:', {
              color,
              productId,
              productSku,
              productName,
              unitPrice,
              inStock,
              quantityAvailable,
              estimatedShipDate,
              fromCatalog: !!tonerProduct,
            });

            return result;
          }),
        );

        log.info(
          '[SUPPLY ORDER ITEMS] Created items:',
          orderItems.length,
          'Subtotal:',
          subtotal.toFixed(2),
        );

        // Create notification for customer and send email/SMS
        let emailSent = false;
        let smsSent = false;
        try {
          const notificationTitle = urgent ? 'Urgent Toner Order Placed' : 'Toner Order Created';
          const notificationMessage = `A toner order (${orderNumber}) has been ${urgent ? 'submitted' : 'created'} for ${device[0].deviceName}. Colors: ${colors.join(', ')}`;

          // Create notification record
          const notification = await db
            .insert(customerNotifications)
            .values({
              tenantId,
              customerId: tenantId, // TODO: use actual customer ID from device
              customerPortalUserId: req.user?.id || tenantId,
              type: 'supply_low',
              title: notificationTitle,
              message: notificationMessage,
              relatedServiceRequestId: null,
              relatedSupplyOrderId: supplyOrder[0].id,
              isPortalRead: false,
              priority: urgent ? 'high' : 'normal',
            })
            .returning();

          log.info('[NOTIFICATION] Created notification for toner order:', notification[0].id);

          // Get customer email/phone for notification delivery
          if (req.user?.id) {
            const portalAccess = await db
              .select()
              .from(customerPortalAccess)
              .where(eq(customerPortalAccess.id, req.user.id))
              .limit(1);

            if (portalAccess[0]) {
              // Send email/SMS notifications
              const result = await sendNotificationAlerts(
                notification[0].id,
                tenantId,
                portalAccess[0].email,
                portalAccess[0].phone || undefined,
                notificationTitle,
                notificationMessage,
              );

              emailSent = result.emailSent;
              smsSent = result.smsSent;

              log.info('[NOTIFICATION] Alerts sent:', { emailSent, smsSent });
            }
          }
        } catch (notificationError) {
          log.error('[NOTIFICATION] Failed to create notification:', notificationError);
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
          notifications: {
            emailSent,
            smsSent,
          },
        });
      } catch (orderError) {
        log.error('[SUPPLY ORDER] Failed to create order:', orderError);
        throw orderError;
      }
    } catch (error) {
      log.error('Error triggering toner order:', error);
      res.status(500).json({ message: 'Failed to trigger toner order' });
    }
  });

  // ============================================================
  // OID PRESET ENDPOINTS (for Desktop Client)
  // ============================================================

  // Get OID presets (authenticated with API key OR user token)
  app.get('/api/printer-monitoring/oid-presets', async (req: any, res) => {
    try {
      // Support both API key and user token authentication
      let authenticated = false;

      // Check for API key authentication (from desktop client)
      const apiKeyHeader = req.headers['x-api-key'];
      if (apiKeyHeader) {
        // Validate API key (simplified - just check it exists for now)
        authenticated = true;
      } else if (req.user || req.session?.userId) {
        // User is authenticated via session
        authenticated = true;
      }

      if (!authenticated) {
        return res.status(401).json({
          message: 'Authentication required. Provide X-API-Key header or login.',
        });
      }

      const { manufacturer } = req.query;

      // Import OID mappings schema
      const { oidMappings } = await import('@shared/printyx-client-schema');

      let query = db.select().from(oidMappings);

      if (manufacturer) {
        query = query.where(eq(oidMappings.manufacturer, manufacturer as string));
      }

      const mappings = await query.orderBy(desc(oidMappings.createdAt));

      // Transform to client-friendly format
      const presets = mappings.map((mapping) => ({
        id: mapping.id?.toString() || '',
        name: mapping.mappingName,
        manufacturer: mapping.manufacturer,
        model: mapping.modelSeries || undefined,
        oids: Array.isArray(mapping.oids)
          ? mapping.oids.map((oid: any) => ({
              name: oid.displayName || oid.oidName,
              oid: oid.oid,
              description: oid.description || '',
              category: oid.category || 'general',
            }))
          : [],
      }));

      res.json({ presets });
    } catch (error) {
      log.error('Error fetching OID presets:', error);
      res.status(500).json({ message: 'Failed to fetch OID presets' });
    }
  });

  // Get OID preset by manufacturer (authenticated with API key OR user token)
  app.get('/api/printer-monitoring/oid-presets/:manufacturer', async (req: any, res) => {
    try {
      // Support both API key and user token authentication
      let authenticated = false;

      const apiKeyHeader = req.headers['x-api-key'];
      if (apiKeyHeader) {
        authenticated = true;
      } else if (req.user || req.session?.userId) {
        authenticated = true;
      }

      if (!authenticated) {
        return res.status(401).json({
          message: 'Authentication required. Provide X-API-Key header or login.',
        });
      }

      const { manufacturer } = req.params;

      // Import OID mappings schema
      const { oidMappings } = await import('@shared/printyx-client-schema');

      // Get default mapping for manufacturer
      const mapping = await db
        .select()
        .from(oidMappings)
        .where(and(eq(oidMappings.manufacturer, manufacturer), eq(oidMappings.isDefault, true)))
        .limit(1);

      if (!mapping[0]) {
        // If no default found, get any mapping for this manufacturer
        const anyMapping = await db
          .select()
          .from(oidMappings)
          .where(eq(oidMappings.manufacturer, manufacturer))
          .limit(1);

        if (!anyMapping[0]) {
          return res.status(404).json({
            message: `No OID preset found for manufacturer: ${manufacturer}`,
          });
        }

        const preset = {
          id: anyMapping[0].id?.toString() || '',
          name: anyMapping[0].mappingName,
          manufacturer: anyMapping[0].manufacturer,
          model: anyMapping[0].modelSeries || undefined,
          oids: Array.isArray(anyMapping[0].oids)
            ? anyMapping[0].oids.map((oid: any) => ({
                name: oid.displayName || oid.oidName,
                oid: oid.oid,
                description: oid.description || '',
                category: oid.category || 'general',
              }))
            : [],
        };

        return res.json(preset);
      }

      const preset = {
        id: mapping[0].id?.toString() || '',
        name: mapping[0].mappingName,
        manufacturer: mapping[0].manufacturer,
        model: mapping[0].modelSeries || undefined,
        oids: Array.isArray(mapping[0].oids)
          ? mapping[0].oids.map((oid: any) => ({
              name: oid.displayName || oid.oidName,
              oid: oid.oid,
              description: oid.description || '',
              category: oid.category || 'general',
            }))
          : [],
      };

      res.json(preset);
    } catch (error) {
      log.error('Error fetching OID preset:', error);
      res.status(500).json({ message: 'Failed to fetch OID preset' });
    }
  });

  // Register/update device (authenticated with API key)
  app.post('/api/printer-monitoring/devices', authenticateClient, async (req: any, res) => {
    try {
      const client = req.monitoringClient;
      const tenantId = req.tenantId;
      const { ip, manufacturer, model, serialNumber, location, companyId, locationId } = req.body;

      if (!ip || !manufacturer || !model) {
        return res.status(400).json({
          message: 'Missing required fields: ip, manufacturer, and model are required',
        });
      }

      // Get or create manufacturer integration
      let integration = await db
        .select()
        .from(manufacturerIntegrations)
        .where(
          and(
            eq(manufacturerIntegrations.tenantId, tenantId),
            eq(manufacturerIntegrations.manufacturer, 'printanista'),
            eq(manufacturerIntegrations.integrationName, `Client: ${client.clientName}`),
          ),
        )
        .limit(1);

      if (!integration[0]) {
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

      // Check if device already exists
      let device = await db
        .select()
        .from(deviceRegistrations)
        .where(
          and(
            eq(deviceRegistrations.tenantId, tenantId),
            or(
              eq(deviceRegistrations.serialNumber, serialNumber || ''),
              eq(deviceRegistrations.ipAddress, ip),
            ),
          ),
        )
        .limit(1);

      if (device[0]) {
        // Update existing device
        await db
          .update(deviceRegistrations)
          .set({
            ipAddress: ip,
            model,
            lastSeen: new Date(),
            status: 'online',
            location: location || device[0].location,
            updatedAt: new Date(),
          })
          .where(eq(deviceRegistrations.id, device[0].id));

        res.json({ deviceId: device[0].id, message: 'Device updated' });
      } else {
        // Register new device
        [device[0]] = await db
          .insert(deviceRegistrations)
          .values({
            tenantId,
            integrationId: integration[0].id,
            deviceId: serialNumber || `${manufacturer}-${model}-${ip}`,
            deviceName: `${manufacturer} ${model}`,
            model,
            serialNumber,
            ipAddress: ip,
            location,
            status: 'online',
            lastSeen: new Date(),
          })
          .returning();

        res.json({ deviceId: device[0].id, message: 'Device registered' });
      }
    } catch (error) {
      log.error('Error registering device:', error);
      res.status(500).json({ message: 'Failed to register device' });
    }
  });

  // Submit device metrics (authenticated with API key)
  app.post('/api/printer-monitoring/metrics', authenticateClient, async (req: any, res) => {
    try {
      const client = req.monitoringClient;
      const tenantId = req.tenantId;
      const { deviceId, timestamp, metrics } = req.body;

      if (!deviceId || !metrics) {
        return res.status(400).json({
          message: 'Missing required fields: deviceId and metrics are required',
        });
      }

      // Get device
      const device = await db
        .select()
        .from(deviceRegistrations)
        .where(
          and(eq(deviceRegistrations.tenantId, tenantId), eq(deviceRegistrations.id, deviceId)),
        )
        .limit(1);

      if (!device[0]) {
        return res.status(404).json({ message: 'Device not found' });
      }

      // Build metric data from submitted metrics
      const metricData: any = {
        collectionTimestamp: timestamp ? new Date(timestamp) : new Date(),
        deviceStatus: 'online',
        rawData: {},
      };

      // Parse metrics array into structured data
      for (const metric of metrics) {
        const { name, value, oid } = metric;

        // Store in rawData
        metricData.rawData[name] = { value, oid };

        // Map to known fields
        if (name.toLowerCase().includes('total') && name.toLowerCase().includes('impression')) {
          metricData.totalImpressions = parseInt(value) || 0;
        } else if (name.toLowerCase().includes('black') || name.toLowerCase().includes('mono')) {
          if (name.toLowerCase().includes('impression')) {
            metricData.bwImpressions = parseInt(value) || 0;
          } else if (name.toLowerCase().includes('toner')) {
            metricData.tonerLevels = metricData.tonerLevels || {};
            metricData.tonerLevels.black = parseInt(value) || 0;
          }
        } else if (
          name.toLowerCase().includes('color') &&
          name.toLowerCase().includes('impression')
        ) {
          metricData.colorImpressions = parseInt(value) || 0;
        } else if (name.toLowerCase().includes('cyan') && name.toLowerCase().includes('toner')) {
          metricData.tonerLevels = metricData.tonerLevels || {};
          metricData.tonerLevels.cyan = parseInt(value) || 0;
        } else if (name.toLowerCase().includes('magenta') && name.toLowerCase().includes('toner')) {
          metricData.tonerLevels = metricData.tonerLevels || {};
          metricData.tonerLevels.magenta = parseInt(value) || 0;
        } else if (name.toLowerCase().includes('yellow') && name.toLowerCase().includes('toner')) {
          metricData.tonerLevels = metricData.tonerLevels || {};
          metricData.tonerLevels.yellow = parseInt(value) || 0;
        }
      }

      // Insert metrics
      await db.insert(deviceMetrics).values({
        tenantId,
        deviceId: device[0].id,
        integrationId: device[0].integrationId!,
        ...metricData,
      });

      // Update device last seen
      await db
        .update(deviceRegistrations)
        .set({
          lastSeen: new Date(),
          status: 'online',
          updatedAt: new Date(),
        })
        .where(eq(deviceRegistrations.id, device[0].id));

      // Update client stats
      await db
        .update(monitoringClients)
        .set({
          lastHeartbeat: new Date(),
          lastSuccessfulCollection: new Date(),
          totalMetricsCollected: ((client.totalMetricsCollected as number) || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(monitoringClients.id, client.id));

      res.json({ message: 'Metrics submitted successfully' });
    } catch (error) {
      log.error('Error submitting metrics:', error);
      res.status(500).json({ message: 'Failed to submit metrics' });
    }
  });
}
