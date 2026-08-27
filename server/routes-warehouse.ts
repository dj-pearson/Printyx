import type { Express } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { isAuthenticated } from './replitAuth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-warehouse');

// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  hasPermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

import { getUserId, getTenantId, authed } from './utils/auth-helpers';
import { badRequest, notFound, serverError } from './lib/error-response';
// Warehouse operation schemas for validation
const warehouseOperationSchema = z.object({
  equipmentId: z.string(),
  operationType: z.enum(['receiving', 'quality_control', 'staging', 'shipping', 'build']),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending'),
  assignedTo: z.string().optional(),
  scheduledDate: z.string().optional(),
  completedDate: z.string().optional(),
  notes: z.string().optional(),
  qualityControlChecks: z.record(z.boolean()).optional(),
  photos: z.array(z.string()).optional(),
});

const serialNumberSchema = z.object({
  serialNumber: z.string(),
  equipmentId: z.string(),
  status: z
    .enum(['received', 'staged', 'built', 'tested', 'shipped', 'delivered'])
    .default('received'),
  location: z.string().optional(),
  accessories: z
    .array(
      z.object({
        accessoryId: z.string(),
        serialNumber: z.string().optional(),
        status: z.enum(['pending', 'matched', 'installed']).default('pending'),
      }),
    )
    .optional(),
});

const buildProcessSchema = z.object({
  equipmentId: z.string(),
  modelId: z.string(),
  assignedTechnician: z.string(),
  scheduledDate: z.string(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'failed']).default('scheduled'),
  accessories: z.array(
    z.object({
      accessoryId: z.string(),
      quantity: z.number(),
      isRequired: z.boolean().default(false),
      status: z.enum(['pending', 'matched', 'installed']).default('pending'),
    }),
  ),
  buildSteps: z.array(
    z.object({
      stepName: z.string(),
      description: z.string(),
      estimatedTime: z.number(),
      isCompleted: z.boolean().default(false),
      completedBy: z.string().optional(),
      completedAt: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
});

const deliveryScheduleSchema = z.object({
  customerId: z.string(),
  equipmentId: z.string(),
  deliveryDate: z.string(),
  deliveryWindow: z.enum(['morning', 'afternoon', 'all_day']).default('all_day'),
  deliveryAddress: z.string(),
  specialInstructions: z.string().optional(),
  requiredAccessories: z.array(z.string()).optional(),
  deliveryTeam: z.array(z.string()).optional(),
  installationRequired: z.boolean().default(false),
  installationDate: z.string().optional(),
  status: z.enum(['scheduled', 'in_transit', 'delivered', 'failed']).default('scheduled'),
});

export function registerWarehouseRoutes(app: Express) {
  // Apply authentication and RBAC context to all warehouse routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/warehouse-operations', isAuthenticated, enhanceUserContext);
  app.use('/api/serial-numbers', isAuthenticated, enhanceUserContext);
  app.use('/api/build-processes', isAuthenticated, enhanceUserContext);
  app.use('/api/delivery-schedules', isAuthenticated, enhanceUserContext);

  // Warehouse Operations CRUD - requires inventory view permission
  app.get(
    '/api/warehouse-operations',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.WAREHOUSE.VIEW, PERMISSIONS.INVENTORY.ITEM.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user?.tenantId || (req as any).user?.claims?.tenantId;
        const operations = await storage.getWarehouseOperations(tenantId);
        res.json(operations);
      } catch (error) {
        log.error('Error fetching warehouse operations:', error);
        serverError(res, 'Failed to fetch warehouse operations');
      }
    }),
  );

  // ROUTE ORDER IS LOAD-BEARING. /stats was registered AFTER
  // /api/warehouse-operations/:id, so express served it from the :id handler
  // with id = 'stats' and WarehouseOperations.tsx could only ever get a 404.
  // Gated by npm run check:route-shadowing.
  // Warehouse statistics
  app.get('/api/warehouse-operations/stats', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const operations = await storage.getWarehouseOperations(tenantId);

      const stats = {
        totalOperations: operations.length,
        pendingOperations: operations.filter((op) => op.status === 'pending').length,
        inProgressOperations: operations.filter((op) => op.status === 'in_progress').length,
        completedOperations: operations.filter((op) => op.status === 'completed').length,
        failedOperations: operations.filter((op) => op.status === 'failed').length,
        operationsByType: {
          receiving: operations.filter((op) => op.operationType === 'receiving').length,
          quality_control: operations.filter((op) => op.operationType === 'quality_control').length,
          staging: operations.filter((op) => op.operationType === 'staging').length,
          shipping: operations.filter((op) => op.operationType === 'shipping').length,
          build: operations.filter((op) => op.operationType === 'build').length,
        },
      };

      res.json(stats);
    } catch (error) {
      log.error('Error fetching warehouse statistics:', error);
      serverError(res, 'Failed to fetch warehouse statistics');
    }
  });

  // Serial Number Management

  app.get('/api/warehouse-operations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const { id } = req.params;

      const operation = await storage.getWarehouseOperation(id, tenantId);
      if (!operation) {
        return notFound(res, 'Warehouse operation not found');
      }

      res.json(operation);
    } catch (error) {
      log.error('Error fetching warehouse operation:', error);
      serverError(res, 'Failed to fetch warehouse operation');
    }
  });

  app.post('/api/warehouse-operations', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;

      const validatedData = warehouseOperationSchema.parse(req.body);

      const operation = await storage.createWarehouseOperation({
        ...validatedData,
        tenantId,
        assignedTo: validatedData.assignedTo || userId,
        scheduledDate: validatedData.scheduledDate
          ? new Date(validatedData.scheduledDate)
          : undefined,
      });

      res.json(operation);
    } catch (error: any) {
      log.error('Error creating warehouse operation:', error);
      if (error.name === 'ZodError') {
        badRequest(res, 'Invalid data', { details: error.errors });
      } else {
        serverError(res, 'Failed to create warehouse operation');
      }
    }
  });

  app.put('/api/warehouse-operations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const { id } = req.params;

      const operation = await storage.updateWarehouseOperation(id, req.body, tenantId);
      if (!operation) {
        return notFound(res, 'Warehouse operation not found');
      }

      res.json(operation);
    } catch (error) {
      log.error('Error updating warehouse operation:', error);
      serverError(res, 'Failed to update warehouse operation');
    }
  });

  app.patch('/api/warehouse-operations/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.id || req.user?.claims?.sub;

      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'completed') {
        updateData.completedDate = new Date();
        updateData.completedBy = userId;
      }

      const operation = await storage.updateWarehouseOperation(id, updateData, tenantId);
      if (!operation) {
        return notFound(res, 'Warehouse operation not found');
      }

      res.json(operation);
    } catch (error) {
      log.error('Error updating warehouse operation status:', error);
      serverError(res, 'Failed to update warehouse operation status');
    }
  });

  app.delete('/api/warehouse-operations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const { id } = req.params;

      const success = await storage.deleteWarehouseOperation(id, tenantId);
      if (!success) {
        return notFound(res, 'Warehouse operation not found');
      }

      res.json({ success: true });
    } catch (error) {
      log.error('Error deleting warehouse operation:', error);
      serverError(res, 'Failed to delete warehouse operation');
    }
  });

  app.get('/api/serial-numbers', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const serialNumbers = await storage.getSerialNumbers(tenantId);
      res.json(serialNumbers);
    } catch (error) {
      log.error('Error fetching serial numbers:', error);
      serverError(res, 'Failed to fetch serial numbers');
    }
  });

  app.post('/api/serial-numbers', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;

      const validatedData = serialNumberSchema.parse(req.body);

      const serialNumber = await storage.createSerialNumber({
        ...validatedData,
        tenantId,
      });

      res.json(serialNumber);
    } catch (error: any) {
      log.error('Error creating serial number:', error);
      if (error.name === 'ZodError') {
        badRequest(res, 'Invalid data', { details: error.errors });
      } else {
        serverError(res, 'Failed to create serial number');
      }
    }
  });

  app.put('/api/serial-numbers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const { id } = req.params;

      const serialNumber = await storage.updateSerialNumber(id, req.body, tenantId);
      if (!serialNumber) {
        return notFound(res, 'Serial number not found');
      }

      res.json(serialNumber);
    } catch (error) {
      log.error('Error updating serial number:', error);
      serverError(res, 'Failed to update serial number');
    }
  });

  // Build Process Management
  app.get('/api/build-processes', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const buildProcesses = await storage.getBuildProcesses(tenantId);
      res.json(buildProcesses);
    } catch (error) {
      log.error('Error fetching build processes:', error);
      serverError(res, 'Failed to fetch build processes');
    }
  });

  app.post('/api/build-processes', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;

      const validatedData = buildProcessSchema.parse({
        ...req.body,
        scheduledDate: req.body.scheduledDate
          ? new Date(req.body.scheduledDate).toISOString()
          : undefined,
      });

      const buildProcess = await storage.createBuildProcess({
        ...validatedData,
        tenantId,
      });

      res.json(buildProcess);
    } catch (error: any) {
      log.error('Error creating build process:', error);
      if (error.name === 'ZodError') {
        badRequest(res, 'Invalid data', { details: error.errors });
      } else {
        serverError(res, 'Failed to create build process');
      }
    }
  });

  // Delivery Scheduling
  app.get('/api/delivery-schedules', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const deliverySchedules = await storage.getDeliverySchedules(tenantId);
      res.json(deliverySchedules);
    } catch (error) {
      log.error('Error fetching delivery schedules:', error);
      serverError(res, 'Failed to fetch delivery schedules');
    }
  });

  app.post('/api/delivery-schedules', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;

      const validatedData = deliveryScheduleSchema.parse({
        ...req.body,
        deliveryDate: req.body.deliveryDate
          ? new Date(req.body.deliveryDate).toISOString()
          : undefined,
        installationDate: req.body.installationDate
          ? new Date(req.body.installationDate).toISOString()
          : undefined,
      });

      const deliverySchedule = await storage.createDeliverySchedule({
        ...validatedData,
        tenantId,
      });

      res.json(deliverySchedule);
    } catch (error: any) {
      log.error('Error creating delivery schedule:', error);
      if (error.name === 'ZodError') {
        badRequest(res, 'Invalid data', { details: error.errors });
      } else {
        serverError(res, 'Failed to create delivery schedule');
      }
    }
  });

  app.put('/api/delivery-schedules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const { id } = req.params;

      const deliverySchedule = await storage.updateDeliverySchedule(id, req.body, tenantId);
      if (!deliverySchedule) {
        return notFound(res, 'Delivery schedule not found');
      }

      res.json(deliverySchedule);
    } catch (error) {
      log.error('Error updating delivery schedule:', error);
      serverError(res, 'Failed to update delivery schedule');
    }
  });

  // Equipment tracking by serial number
  app.get('/api/equipment/:id/lifecycle', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
      const { id } = req.params;

      // Get all operations for this equipment
      const operations = await storage.getWarehouseOperationsByEquipment(id, tenantId);
      const serialNumbers = await storage.getSerialNumbersByEquipment(id, tenantId);
      const buildProcesses = await storage.getBuildProcessesByEquipment(id, tenantId);
      const deliverySchedules = await storage.getDeliverySchedulesByEquipment(id, tenantId);

      const lifecycle = {
        equipmentId: id,
        operations,
        serialNumbers,
        buildProcesses,
        deliverySchedules,
        currentStatus: operations.length > 0 ? operations[operations.length - 1].status : 'unknown',
      };

      res.json(lifecycle);
    } catch (error) {
      log.error('Error fetching equipment lifecycle:', error);
      serverError(res, 'Failed to fetch equipment lifecycle');
    }
  });
}
