import { Router } from 'express';
import { z } from 'zod';
import { ManufacturerIntegrationService } from './services/manufacturer-integration-service';
import { unifiedMeterCollectionService } from './services/unified-meter-collection-service';
import {
  insertManufacturerIntegrationSchema,
  insertDeviceRegistrationSchema,
  manufacturerEnum,
  integrationMethodEnum,
  collectionFrequencyEnum
} from '../shared/manufacturer-integration-schema';

const router = Router();
const integrationService = new ManufacturerIntegrationService();

// Validation schemas
const createIntegrationSchema = z.object({
  manufacturer: z.enum(manufacturerEnum.enumValues),
  manufacturerName: z.string().min(1).max(100),
  platformName: z.string().max(100).optional(),
  integrationMethod: z.enum(integrationMethodEnum.enumValues),
  apiEndpoint: z.string().url().optional(),
  apiVersion: z.string().max(20).optional(),
  authType: z.enum(['oauth2', 'api_key', 'basic_auth', 'certificate']).optional(),
  authCredentials: z.record(z.any()).default({}),
  collectionFrequency: z.enum(collectionFrequencyEnum.enumValues).default('daily'),
  settings: z.record(z.any()).default({}),
  fieldMappings: z.record(z.any()).default({})
});

const registerDeviceSchema = z.object({
  integrationId: z.string().uuid(),
  deviceId: z.string().min(1),
  serialNumber: z.string().max(100).optional(),
  modelNumber: z.string().max(100).optional(),
  deviceName: z.string().max(150).optional(),
  ipAddress: z.string().max(45).optional(),
  macAddress: z.string().max(17).optional(),
  networkPath: z.string().max(255).optional(),
  locationId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  capabilities: z.record(z.any()).default({}),
  supportedMetrics: z.array(z.string()).default([]),
  deviceAuthCredentials: z.record(z.any()).default({})
});

// GET /api/manufacturer-integrations - Get all integrations for tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const integrations = await integrationService.getIntegrations(tenantId);
    res.json({ integrations });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// POST /api/manufacturer-integrations - Create new integration
router.post('/', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = createIntegrationSchema.parse(req.body);
    
    const integration = await integrationService.createIntegration(tenantId, {
      ...validatedData,
      createdBy: req.session?.user?.id
    });

    res.status(201).json({ integration });
  } catch (error) {
    console.error('Error creating integration:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

// GET /api/manufacturer-integrations/:id - Get specific integration
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const integration = await integrationService.getIntegrationById(tenantId, req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ integration });
  } catch (error) {
    console.error('Error fetching integration:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

// PUT /api/manufacturer-integrations/:id/status - Update integration status
router.put('/:id/status', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, error } = req.body;
    if (!['active', 'inactive', 'error', 'pending_auth', 'rate_limited', 'maintenance'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await integrationService.updateIntegrationStatus(tenantId, req.params.id, status, error);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating integration status:', error);
    res.status(500).json({ error: 'Failed to update integration status' });
  }
});

// POST /api/manufacturer-integrations/:id/test-connection - Test integration connection
router.post('/:id/test-connection', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const success = await unifiedMeterCollectionService.testIntegrationConnection(tenantId, req.params.id);
    res.json({ success, message: success ? 'Connection successful' : 'Connection failed' });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// POST /api/manufacturer-integrations/:id/discover-devices - Discover devices
router.post('/:id/discover-devices', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const devices = await unifiedMeterCollectionService.discoverDevicesForIntegration(tenantId, req.params.id);
    res.json({ devices });
  } catch (error) {
    console.error('Error discovering devices:', error);
    res.status(500).json({ error: 'Failed to discover devices' });
  }
});

// GET /api/manufacturer-integrations/:id/devices - Get devices for integration
router.get('/:id/devices', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const devices = await integrationService.getDevices(tenantId, req.params.id);
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// POST /api/manufacturer-integrations/:id/devices - Register new device
router.post('/:id/devices', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = registerDeviceSchema.parse(req.body);
    
    // Ensure the integrationId matches the URL parameter
    if (validatedData.integrationId !== req.params.id) {
      return res.status(400).json({ error: 'Integration ID mismatch' });
    }

    const device = await integrationService.registerDevice(tenantId, validatedData);
    res.status(201).json({ device });
  } catch (error) {
    console.error('Error registering device:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// GET /api/manufacturer-integrations/devices/:deviceId - Get specific device
router.get('/devices/:deviceId', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const device = await integrationService.getDeviceById(tenantId, req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ device });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// GET /api/manufacturer-integrations/devices/:deviceId/metrics - Get device metrics
router.get('/devices/:deviceId/metrics', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { metricTypes, fromDate, toDate } = req.query;
    
    const metrics = await integrationService.getDeviceMetrics(
      tenantId,
      req.params.deviceId,
      metricTypes ? (metricTypes as string).split(',') : undefined,
      fromDate ? new Date(fromDate as string) : undefined,
      toDate ? new Date(toDate as string) : undefined
    );

    res.json({ metrics });
  } catch (error) {
    console.error('Error fetching device metrics:', error);
    res.status(500).json({ error: 'Failed to fetch device metrics' });
  }
});

// POST /api/manufacturer-integrations/devices/:deviceId/collect - Manually collect metrics
router.post('/devices/:deviceId/collect', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {  
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await unifiedMeterCollectionService.collectFromDevice(tenantId, req.params.deviceId);
    res.json({ result });
  } catch (error) {
    console.error('Error collecting device metrics:', error);
    res.status(500).json({ error: 'Failed to collect device metrics' });
  }
});

// GET /api/manufacturer-integrations/:id/audit-logs - Get audit logs for integration
router.get('/:id/audit-logs', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { eventCategory, fromDate, limit } = req.query;
    
    const logs = await integrationService.getAuditLogs(
      tenantId,
      req.params.id,
      eventCategory as string,
      fromDate ? new Date(fromDate as string) : undefined,
      limit ? parseInt(limit as string) : 100
    );

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// POST /api/manufacturer-integrations/run-collection - Manually trigger collection for all integrations
router.post('/run-collection', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only allow admin users to trigger collection
    if (!req.session?.user?.isSystemRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Run collection asynchronously
    unifiedMeterCollectionService.runScheduledCollection().catch(error => {
      console.error('Collection run failed:', error);
    });

    res.json({ message: 'Collection started', timestamp: new Date() });
  } catch (error) {
    console.error('Error starting collection:', error);
    res.status(500).json({ error: 'Failed to start collection' });
  }
});

// GET /api/manufacturer-integrations/statistics - Get collection statistics
router.get('/statistics', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const statistics = await unifiedMeterCollectionService.getCollectionStatistics();
    res.json({ statistics });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// DELETE /api/manufacturer-integrations/:id - Delete integration
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.session?.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only allow admin users to delete integrations
    if (!req.session?.user?.canManageIntegrations) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await integrationService.updateIntegrationStatus(tenantId, req.params.id, 'inactive');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// GET /api/manufacturer-integrations/supported-manufacturers - Get list of supported manufacturers
router.get('/supported-manufacturers', async (req, res) => {
  try {
    const manufacturers = [
      {
        id: 'canon',
        name: 'Canon',
        platforms: ['Canon Data Collection Agent', 'eMaintenance'],
        authMethods: ['api_key', 'certificate'],
        description: 'Integration with Canon imageRUNNER ADVANCE devices through DCA and eMaintenance platform'
      },
      {
        id: 'xerox',
        name: 'Xerox',
        platforms: ['ConnectKey', 'Workplace Cloud'],
        authMethods: ['oauth2', 'api_key'],
        description: 'Integration with Xerox devices through ConnectKey API and Managed Print Services'
      },
      {
        id: 'hp',
        name: 'HP',
        platforms: ['PrintOS', 'Smart Device Services'],
        authMethods: ['api_key'],
        description: 'Integration with HP devices through PrintOS Device API and Smart Device Services'
      },
      {
        id: 'konica_minolta',
        name: 'Konica Minolta',
        platforms: ['bEST', 'Dispatcher Phoenix'],
        authMethods: ['api_key', 'oauth2'],
        description: 'Integration with Konica Minolta devices through bEST Technology Suite'
      },
      {
        id: 'lexmark',
        name: 'Lexmark',
        platforms: ['Fleet Management', 'Cloud Services'],
        authMethods: ['api_key', 'basic_auth'],
        description: 'Integration with Lexmark devices through Fleet Management API'
      },
      {
        id: 'fmaudit',
        name: 'FMAudit/Printanista',
        platforms: ['FMAudit', 'Printanista'],
        authMethods: ['api_key', 'basic_auth'],
        description: 'Integration with FMAudit/Printanista for automated meter reading across multiple manufacturers'
      }
    ];

    res.json({ manufacturers });
  } catch (error) {
    console.error('Error fetching supported manufacturers:', error);
    res.status(500).json({ error: 'Failed to fetch supported manufacturers' });
  }
});

export default router;