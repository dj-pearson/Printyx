/**
 * Product Management & Vendor CRUD Routes
 * Extracted from routes.ts monolith.
 */
import type { Express } from 'express';
import { storage } from './storage';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-products-crud');
import { enhanceUserContext, requirePermission, PERMISSIONS } from './middleware/rbac-route-helper';
import type { RequestHandler } from 'express';
// requirePermission/enhanceUserContext are typed against AuthenticatedRequest,
// which does not unify with the app.<method> overloads; cast to RequestHandler (CR-003).
const ctx = enhanceUserContext as unknown as RequestHandler;
const can = (perms: string[]): RequestHandler =>
  requirePermission(perms) as unknown as RequestHandler;

import {
  insertProductModelSchema,
  insertProductAccessorySchema,
  insertAccessoryModelCompatibilitySchema,
  insertProfessionalServiceSchema,
  insertSoftwareProductSchema,
  insertSupplySchema,
  insertManagedServiceSchema,
  insertInventoryItemSchema,
  insertMeterReadingSchema,
  insertCpcRateSchema,
  companyContacts,
  equipment,
  vendors,
  productAccessories,
  masterProductModels,
  meterReadings,
  contractTieredRates,
  inventoryItems,
} from '@shared/schema';
import multer from 'multer';
import { db } from './db';
import { and, eq, sql, desc, asc, inArray } from 'drizzle-orm';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { CATALOG_IMPORT_TYPES } from '@shared/catalog-import';
import { importCatalogCsv } from './lib/catalog-import-runner';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

export function registerProductsCrudRoutes(app: Express) {
  // ============= PRODUCT MODELS CRUD =============

  app.get(
    '/api/product-models',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        // Use master product models for product browsing (includes Production category)
        const models = await storage.browseMasterProducts({});
        res.json(models);
      } catch (error) {
        log.error('Error fetching product models:', error);
        res.status(500).json({ message: 'Failed to fetch product models' });
      }
    },
  );

  app.get(
    '/api/product-models/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const model = await storage.getProductModel(id, tenantId);
        if (!model) {
          return res.status(404).json({ message: 'Product model not found' });
        }
        res.json(model);
      } catch (error) {
        log.error('Error fetching product model:', error);
        res.status(500).json({ message: 'Failed to fetch product model' });
      }
    },
  );

  app.post(
    '/api/product-models',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.CREATE]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const validatedData = insertProductModelSchema.parse({
          ...req.body,
          tenantId,
        });
        const model = await storage.createProductModel(validatedData);
        res.json(model);
      } catch (error) {
        log.error('Error creating product model:', error);
        res.status(500).json({ message: 'Failed to create product model' });
      }
    },
  );

  app.patch(
    '/api/product-models/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.UPDATE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        // Clean up numeric fields - convert empty strings to null
        const cleanedData = { ...req.body };
        const numericFields = [
          'msrp',
          'newRepPrice',
          'upgradeRepPrice',
          'lexmarkRepPrice',
          'cost',
          'weight',
          'warrantyMonths',
          'standardCost',
          'standardRepPrice',
          'newCost',
          'upgradeCost',
          'minVolume',
          'maxVolume',
          'baseRate',
          'cpc',
          'cpcOverage',
        ];

        numericFields.forEach((field) => {
          if (cleanedData[field] === '' || cleanedData[field] === undefined) {
            cleanedData[field] = null;
          } else if (cleanedData[field] && typeof cleanedData[field] === 'string') {
            const parsed = parseFloat(cleanedData[field]);
            cleanedData[field] = isNaN(parsed) ? null : parsed;
          }
        });

        // First check if this is a master product model (displayed in ProductModels page)
        const existingMasterModel = await storage.getMasterProductModel(id);
        let model;

        if (existingMasterModel) {
          // Update master product model
          model = await storage.updateMasterProductModel(id, cleanedData);
        } else {
          // Update regular product model
          model = await storage.updateProductModel(id, cleanedData, tenantId);
        }

        if (!model) {
          return res.status(404).json({ message: 'Product model not found' });
        }
        res.json(model);
      } catch (error) {
        log.error('Error updating product model:', error);
        res.status(500).json({ message: 'Failed to update product model' });
      }
    },
  );

  // Bulk delete product models (must be before single delete route)
  app.delete(
    '/api/product-models/bulk-delete',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.DELETE]),
    async (req: any, res) => {
      try {
        const { ids } = req.body;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ error: 'Invalid or empty ids array' });
        }

        log.info('Bulk deleting master models:', ids);
        const results = [];

        for (const id of ids) {
          try {
            // Check if this is a master product model (since that's what the frontend displays)
            const existingMasterModel = await storage.getMasterProductModel(id);
            if (existingMasterModel) {
              // Delete from master product models table
              const result = await storage.deleteMasterProductModel(id);
              results.push({ id, success: result });
              log.info(`Delete result for master model ${id}:`, result);
            } else {
              // Fallback: check tenant product models table
              const existingModel = await storage.getProductModel(id, tenantId);
              if (existingModel) {
                const result = await storage.deleteProductModel(id, tenantId);
                results.push({ id, success: result });
                log.info(`Delete result for tenant model ${id}:`, result);
              } else {
                results.push({ id, success: false, error: 'Product model not found' });
              }
            }
          } catch (error) {
            log.error(`Error deleting model ${id}:`, error);
            results.push({
              id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        log.info(`Bulk delete complete: ${successful} successful, ${failed} failed`);
        res.json({
          message: `Successfully deleted ${successful} of ${ids.length} product models`,
          successful,
          failed,
          results,
        });
      } catch (error) {
        log.error('Error in bulk delete:', error);
        res.status(500).json({ error: 'Failed to perform bulk delete' });
      }
    },
  );

  app.delete(
    '/api/product-models/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.DELETE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        // Check if this is a master product model (since that's what the frontend displays)
        const existingMasterModel = await storage.getMasterProductModel(id);
        if (existingMasterModel) {
          // Delete from master product models table
          const deleted = await storage.deleteMasterProductModel(id);
          log.info(`Delete result for master model ${id}:`, deleted);

          if (!deleted) {
            log.info(`Delete failed: No rows affected for master model ${id}`);
            return res
              .status(404)
              .json({ message: 'Product model not found or could not be deleted' });
          }
          res.json({ message: 'Product model deleted successfully' });
          return;
        }

        // Fallback: check tenant product models table
        const existingModel = await storage.getProductModel(id, tenantId);
        if (!existingModel) {
          log.info(`Delete failed: Product model ${id} not found in either table`);
          return res.status(404).json({ message: 'Product model not found' });
        }

        const deleted = await storage.deleteProductModel(id, tenantId);
        log.info(`Delete result for model ${id}:`, deleted);

        if (!deleted) {
          log.info(`Delete failed: No rows affected for model ${id} in tenant ${tenantId}`);
          return res
            .status(404)
            .json({ message: 'Product model not found or could not be deleted' });
        }
        res.json({ message: 'Product model deleted successfully' });
      } catch (error) {
        log.error('Error deleting product model:', error);
        res.status(500).json({ message: 'Failed to delete product model' });
      }
    },
  );

  // ============= PRODUCT ACCESSORIES =============

  app.get('/api/product-accessories', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Check if codes parameter is provided for filtering
      const codesParam = req.query.codes as string;
      if (codesParam) {
        const codes = codesParam.split(',').map((code: string) => code.trim());
        const accessories = await storage.getProductAccessoriesByCodes(codes, tenantId);
        return res.json(accessories);
      }

      const accessories = await storage.getAllProductAccessories(tenantId);
      res.json(accessories);
    } catch (error) {
      log.error('Error fetching product accessories:', error);
      res.status(500).json({ message: 'Failed to fetch product accessories' });
    }
  });

  app.get(
    '/api/product-models/:modelId/accessories',

    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const accessories = await storage.getProductAccessories(modelId);
        res.json(accessories);
      } catch (error) {
        log.error('Error fetching product accessories:', error);
        res.status(500).json({ message: 'Failed to fetch product accessories' });
      }
    },
  );

  app.post(
    '/api/product-accessories',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.CREATE]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const validatedData = insertProductAccessorySchema.parse({
          ...req.body,
          tenantId,
        });
        const accessory = await storage.createProductAccessory(validatedData);
        res.json(accessory);
      } catch (error) {
        log.error('Error creating product accessory:', error);
        res.status(500).json({ message: 'Failed to create product accessory' });
      }
    },
  );

  app.delete(
    '/api/product-accessories/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.DELETE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const success = await storage.deleteProductAccessory(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: 'Product accessory not found' });
        }
        res.json({ message: 'Product accessory deleted successfully' });
      } catch (error) {
        log.error('Error deleting product accessory:', error);
        res.status(500).json({ message: 'Failed to delete product accessory' });
      }
    },
  );

  app.post(
    '/api/product-models/:modelId/accessories',

    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        // Create the accessory first (without modelId since it's no longer in the schema)
        const accessoryData = insertProductAccessorySchema.parse({
          ...req.body,
          tenantId,
        });
        const accessory = await storage.createProductAccessory(accessoryData);

        // Then create the compatibility relationship
        const compatibilityData = insertAccessoryModelCompatibilitySchema.parse({
          accessoryId: accessory.id,
          modelId,
          tenantId,
          isRequired: req.body.isRequired || false,
          isOptional: true,
        });
        await storage.createAccessoryModelCompatibility(compatibilityData);

        res.json(accessory);
      } catch (error) {
        log.error('Error creating product accessory:', error);
        res.status(500).json({ message: 'Failed to create product accessory' });
      }
    },
  );

  app.patch(
    '/api/product-accessories/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.UPDATE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const accessory = await storage.updateProductAccessory(id, req.body, tenantId);
        if (!accessory) {
          return res.status(404).json({ message: 'Product accessory not found' });
        }
        res.json(accessory);
      } catch (error) {
        log.error('Error updating product accessory:', error);
        res.status(500).json({ message: 'Failed to update product accessory' });
      }
    },
  );

  // ============= ACCESSORY-MODEL COMPATIBILITY =============

  // Accessory/model compatibility (GET, POST, DELETE) removed here (PROD-008b).
  // /api/accessories is proxied to supabase/functions/accessories/, which was
  // built as the production counterpart to exactly these three — the
  // compatibility dialog in EnhancedProductAccessories.tsx 404'd in prod before
  // it existed.

  app.get('/api/models/:modelId/compatibility', async (req: any, res) => {
    try {
      const { modelId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const compatibilities = await storage.getModelCompatibilities(modelId, tenantId);
      res.json(compatibilities);
    } catch (error) {
      log.error('Error fetching model compatibilities:', error);
      res.status(500).json({ message: 'Failed to fetch compatibilities' });
    }
  });

  app.post(
    '/api/accessory-model-compatibility',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.UPDATE]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const validatedData = insertAccessoryModelCompatibilitySchema.parse({
          ...req.body,
          tenantId,
        });
        const compatibility = await storage.createAccessoryModelCompatibility(validatedData);
        res.status(201).json(compatibility);
      } catch (error) {
        log.error('Error creating accessory compatibility:', error);
        res.status(500).json({ message: 'Failed to create compatibility' });
      }
    },
  );

  app.delete(
    '/api/accessory-model-compatibility/:accessoryId/:modelId',

    async (req: any, res) => {
      try {
        const { accessoryId, modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        await storage.deleteAccessoryModelCompatibility(accessoryId, modelId, tenantId);
        res.status(204).send();
      } catch (error) {
        log.error('Error deleting accessory compatibility:', error);
        res.status(500).json({ message: 'Failed to delete compatibility' });
      }
    },
  );

  // ============= PROFESSIONAL SERVICES =============

  app.get('/api/professional-services', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const services = await storage.getAllProfessionalServices(tenantId);
      res.json(services);
    } catch (error) {
      log.error('Error fetching professional services:', error);
      res.status(500).json({ message: 'Failed to fetch professional services' });
    }
  });

  app.post(
    '/api/professional-services',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.CREATE]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const validatedData = insertProfessionalServiceSchema.parse({
          ...req.body,
          tenantId,
        });
        const service = await storage.createProfessionalService(validatedData);
        res.json(service);
      } catch (error) {
        log.error('Error creating professional service:', error);
        res.status(500).json({ message: 'Failed to create professional service' });
      }
    },
  );

  app.patch(
    '/api/professional-services/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.UPDATE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const updated = await storage.updateProfessionalService(id, req.body, tenantId);
        if (!updated) {
          return res.status(404).json({ message: 'Professional service not found' });
        }
        res.json(updated);
      } catch (error) {
        log.error('Error updating professional service:', error);
        res.status(500).json({ message: 'Failed to update professional service' });
      }
    },
  );

  app.delete(
    '/api/professional-services/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.DELETE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const success = await storage.deleteProfessionalService(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: 'Professional service not found' });
        }
        res.json({ message: 'Professional service deleted successfully' });
      } catch (error) {
        log.error('Error deleting professional service:', error);
        res.status(500).json({ message: 'Failed to delete professional service' });
      }
    },
  );

  // ============= SERVICE PRODUCTS =============

  // GET and POST /api/service-products removed here (PROD-008b).
  // supabase/functions/service-products/ serves both. Its rows now go out
  // camelCase: ServiceProducts.tsx filters on service.productName.toLowerCase()
  // with no guard, so the raw snake_case rows it used to return threw a
  // TypeError on render rather than showing an empty list.

  // ============= SUPPLIES =============

  app.get('/api/supplies', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const supplies = await storage.getAllSupplies(tenantId);
      res.json(supplies);
    } catch (error) {
      log.error('Error fetching supplies:', error);
      res.status(500).json({ message: 'Failed to fetch supplies' });
    }
  });

  app.post(
    '/api/supplies',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.CREATE]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const validatedData = insertSupplySchema.parse({
          ...req.body,
          tenantId,
        });
        const supply = await storage.createSupply(validatedData);
        res.json(supply);
      } catch (error) {
        log.error('Error creating supply:', error);
        res.status(500).json({ message: 'Failed to create supply' });
      }
    },
  );

  app.patch(
    '/api/supplies/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.UPDATE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const updated = await storage.updateSupply(id, req.body, tenantId);
        if (!updated) {
          return res.status(404).json({ message: 'Supply not found' });
        }
        res.json(updated);
      } catch (error) {
        log.error('Error updating supply:', error);
        res.status(500).json({ message: 'Failed to update supply' });
      }
    },
  );

  app.delete(
    '/api/supplies/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.DELETE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const success = await storage.deleteSupply(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: 'Supply not found' });
        }
        res.json({ message: 'Supply deleted successfully' });
      } catch (error) {
        log.error('Error deleting supply:', error);
        res.status(500).json({ message: 'Failed to delete supply' });
      }
    },
  );

  // ============= MANAGED SERVICES =============

  app.get('/api/managed-services', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const services = await storage.getAllManagedServices(tenantId);
      res.json(services);
    } catch (error) {
      log.error('Error fetching managed services:', error);
      res.status(500).json({ message: 'Failed to fetch managed services' });
    }
  });

  // ============= INVENTORY =============

  app.get('/api/inventory', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const items = await storage.getInventoryItems(tenantId);
      // Shape data to match current UI expectations in Inventory.tsx
      const shaped = items.map((it: any) => ({
        id: it.id,
        name: it.itemDescription ?? it.manufacturerPartNumber ?? it.partNumber,
        sku: it.partNumber,
        currentStock: it.quantityOnHand ?? 0,
        reorderPoint: it.reorderPoint ?? 0,
        unitCost: it.unitCost ?? 0,
      }));
      res.json(shaped);
    } catch (error) {
      log.error('Error fetching inventory:', error);
      res.status(500).json({ message: 'Failed to fetch inventory' });
    }
  });

  app.post(
    '/api/inventory',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.CREATE]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        // Prefer strict validation against insert schema if client sends schema-compatible payload
        let payload: any;
        try {
          payload = insertInventoryItemSchema.parse({ ...req.body, tenantId });
        } catch {
          // Fallback: map simplified UI shape to schema
          const { name, sku, reorderPoint, unitCost, currentStock } = req.body ?? {};
          payload = insertInventoryItemSchema.parse({
            tenantId,
            partNumber: sku,
            itemDescription: name,
            reorderPoint: reorderPoint ?? 0,
            unitCost: unitCost ?? 0,
            quantityOnHand: currentStock ?? 0,
          });
        }
        const created = await storage.createInventoryItem(payload);
        res.json(created);
      } catch (error) {
        log.error('Error creating inventory item:', error);
        res.status(500).json({ message: 'Failed to create inventory item' });
      }
    },
  );

  app.patch(
    '/api/inventory/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.UPDATE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        // Allow partial updates either in schema fields or UI fields
        const body = req.body ?? {};
        const updates: any = {
          ...body,
        };
        if (body.name) updates.itemDescription = body.name;
        if (body.sku) updates.partNumber = body.sku;
        if (typeof body.currentStock === 'number') updates.quantityOnHand = body.currentStock;
        if (typeof body.reorderPoint === 'number') updates.reorderPoint = body.reorderPoint;
        if (typeof body.unitCost === 'number') updates.unitCost = body.unitCost;

        const updated = await storage.updateInventoryItem(id, updates, tenantId);
        if (!updated) {
          return res.status(404).json({ message: 'Inventory item not found' });
        }
        res.json(updated);
      } catch (error) {
        log.error('Error updating inventory item:', error);
        res.status(500).json({ message: 'Failed to update inventory item' });
      }
    },
  );

  app.post(
    '/api/managed-services',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.CREATE]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const validatedData = insertManagedServiceSchema.parse({
          ...req.body,
          tenantId,
        });
        const service = await storage.createManagedService(validatedData);
        res.json(service);
      } catch (error) {
        log.error('Error creating managed service:', error);
        res.status(500).json({ message: 'Failed to create managed service' });
      }
    },
  );

  app.patch(
    '/api/managed-services/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.UPDATE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const updated = await storage.updateManagedService(id, req.body, tenantId);
        if (!updated) {
          return res.status(404).json({ message: 'Managed service not found' });
        }
        res.json(updated);
      } catch (error) {
        log.error('Error updating managed service:', error);
        res.status(500).json({ message: 'Failed to update managed service' });
      }
    },
  );

  app.delete(
    '/api/managed-services/:id',
    ctx,
    can([PERMISSIONS.INVENTORY.ITEM.DELETE]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const success = await storage.deleteManagedService(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: 'Managed service not found' });
        }
        res.json({ message: 'Managed service deleted successfully' });
      } catch (error) {
        log.error('Error deleting managed service:', error);
        res.status(500).json({ message: 'Failed to delete managed service' });
      }
    },
  );

  // ============= ACCOUNTING API ROUTES =============

  // Vendors Management
  // ── /api/vendors: RETIRED (PROD-008b) ─────────────────────────────────────
  //
  // GET list, GET /:id, POST, PATCH /:id and DELETE /:id lived here, and
  // routes-purchase-orders.ts registered its own copy of all five. /api/vendors
  // is proxied to the vendors edge function, which covers every one, so neither
  // set ran on either host - and which of the two would have won was decided
  // only by the order of register*(app) calls in routes-registry.ts.

  // Accounts Payable Management

  // GET and POST /api/accounts-payable removed here (PROD-008b).
  // supabase/functions/account-payable/ serves both — EDGE-005a built it against
  // the canonical accounts_payable table and returns camelCase rows, which is
  // what AccountsPayable.tsx spreads directly.

  // Accounts Receivable Management

  // GET and POST /api/accounts-receivable removed here (PROD-008b).
  // supabase/functions/account-receivable/ serves both (EDGE-005a).

  /**
   * NOTE: Migrated to routes-financial.ts (Phase 2):
   * - GET /api/chart-of-accounts - Get chart of accounts
   * - POST /api/chart-of-accounts - Create chart of account entry
   * - ALL /api/journal-entries - Journal entries (501 Not Implemented stub)
   */

  // ── /api/purchase-orders: RETIRED (WF-P-05) ───────────────────────────────
  //
  // GET list, POST create, GET /suggestions/low-stock and POST
  // /generate-from-suggestions lived here, and routes-purchase-orders.ts
  // registered its own overlapping set - two Express routers on one prefix, with
  // mount order deciding the winner (CR-017 found the same shape on
  // /api/commission). Neither ran in production, which has always gone to the
  // edge function. /api/purchase-orders is proxied now and that function covers
  // all four, so both sets are gone.

  // ============= COMPANY CONTACTS =============

  // POST /api/companies/:companyId/contacts removed here (PROD-008b).
  // The companies edge function has the branch (POST + companyId + 'contacts').

  // ============= METER BILLING API ROUTES =============

  // Meter Readings - list with optional filters
  app.get('/api/meter-readings', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const filter = String((req.query as any)?.filter || '');
      const nParam = String((req.query as any)?.n || '1');
      const n = Number.parseInt(nParam, 10);
      const days = Number.isNaN(n) || n <= 0 ? 30 : 30 * n; // monthly cycles approximation

      if (filter === 'missed_cycles') {
        // Return the last reading per equipment where it's older than N cycles
        // Note: Equipments with no readings won't appear in this list; add an equipment LEFT JOIN if needed later
        const query = `
          WITH latest AS (
            SELECT DISTINCT ON (equipment_id) *
            FROM meter_readings
            WHERE tenant_id = $1
            ORDER BY equipment_id, reading_date DESC
          )
          SELECT *
          FROM latest
          WHERE reading_date < NOW() - ($2 || ' days')::interval
          ORDER BY reading_date NULLS FIRST
          LIMIT 200
        `;
        const result = await db.$client.query(query, [tenantId, String(days)]);
        return res.json(result.rows);
      }

      // Default: recent readings
      const result = await db.$client.query(
        `SELECT * FROM meter_readings WHERE tenant_id = $1 ORDER BY reading_date DESC LIMIT 200`,
        [tenantId],
      );
      res.json(result.rows);
    } catch (error) {
      log.error('Error fetching meter readings:', error);
      res.status(500).json({ message: 'Failed to fetch meter readings' });
    }
  });

  // Create meter reading (accepts UI shape and schema shape)
  app.post(
    '/api/meter-readings',
    ctx,
    can([PERMISSIONS.FINANCE.BILLING.METER_BILLING]),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        let payload: any;
        try {
          // Prefer strict schema if request already matches it.
          // created_by is NOT NULL and not omitted from the insert schema, so it
          // must be injected or the parse (and the insert) fails — PA-035.
          payload = insertMeterReadingSchema.parse({
            ...req.body,
            tenantId,
            createdBy: getUserId(req),
          });
        } catch {
          // Map simplified UI fields to schema
          const {
            equipmentId,
            contractId,
            readingDate,
            blackMeter,
            colorMeter,
            collectionMethod,
            notes,
          } = req.body ?? {};

          payload = insertMeterReadingSchema.parse({
            tenantId,
            createdBy: getUserId(req),
            equipmentId,
            contractId: contractId ?? null,
            readingDate: readingDate ? new Date(readingDate) : new Date(),
            bwMeterReading: Number.parseInt(String(blackMeter ?? 0), 10),
            colorMeterReading: Number.parseInt(String(colorMeter ?? 0), 10),
            collectionMethod: collectionMethod ?? 'manual',
            readingNotes: notes ?? null,
          } as any);
        }

        // Use storage if available to keep persistence consistent
        const created = await storage.createMeterReading(payload);
        res.json(created);
      } catch (error) {
        log.error('Error creating meter reading:', error);
        res.status(500).json({ message: 'Failed to create meter reading' });
      }
    },
  );

  // ============= CONTRACT TIERED RATES =============

  // GET and POST /api/contract-tiered-rates removed here (PROD-008b).
  // supabase/functions/contract-tiered-rates/ serves both and returns camelRow,
  // which is what MeterBilling.tsx types.
  //
  // NOT carried over: the Express POST gated on
  // PERMISSIONS.FINANCE.BILLING.CONFIGURE and the edge function has no RBAC.
  // That gap is the whole of SEC-EDGE-002 and is not this story's to invent.

  // NOTE: Invoice generation and contract profitability now live in the billing
  // edge function (supabase/functions/billing/); routes-billing-core.ts was
  // retired under PROD-008b as a shadowed Express module.

  // NOTE: Company contacts routes now live in the company-contacts and contacts
  // edge functions; routes-contacts.ts was retired under PROD-008b as a fully
  // shadowed Express module.

  // ============= CSV IMPORT ENDPOINTS =============

  // ============= CSV IMPORT ENDPOINTS =============
  //
  // PROD-014: these were seven near-identical handlers, each with its own CSV
  // parse, its own header spellings and its own column mapping. Three wrote
  // columns that do not exist (supplies.description, and the accessories
  // handler read row.accessoryCode for the code but row.accessory_name for the
  // name while its template offered Title Case), and two — professional
  // services and service products — were stubs returning `imported: 0` with
  // "not yet implemented", which the UI reported as a successful import of
  // nothing.
  //
  // One loop over @shared/catalog-import now serves all seven, and the template
  // the app offers for download is generated from the same spec.
  for (const productType of CATALOG_IMPORT_TYPES) {
    app.post(`/api/${productType}/import`, upload.single('file'), async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        const outcome = await importCatalogCsv(
          productType,
          tenantId,
          req.file.buffer.toString('utf-8'),
        );
        res.json(outcome);
      } catch (error) {
        log.error(`Error importing ${productType}:`, error);
        res.status(500).json({ message: `Failed to import ${productType}` });
      }
    });
  }

  // ============= CPC RATES =============

  app.get(
    '/api/product-models/:modelId/cpc-rates',

    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const rates = await storage.getCpcRates(modelId, tenantId);
        res.json(rates);
      } catch (error) {
        log.error('Error fetching CPC rates:', error);
        res.status(500).json({ message: 'Failed to fetch CPC rates' });
      }
    },
  );

  app.post(
    '/api/product-models/:modelId/cpc-rates',

    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const validatedData = insertCpcRateSchema.parse({
          ...req.body,
          modelId,
          tenantId,
        });
        const rate = await storage.createCpcRate(validatedData);
        res.json(rate);
      } catch (error) {
        log.error('Error creating CPC rate:', error);
        res.status(500).json({ message: 'Failed to create CPC rate' });
      }
    },
  );
}
