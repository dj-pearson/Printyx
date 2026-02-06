/**
 * Product Management & Vendor CRUD Routes
 * Extracted from routes.ts monolith.
 */
import type { Express } from 'express';
import { storage } from './storage';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-products-crud');

import {
  insertProductModelSchema,
  insertProductAccessorySchema,
  insertAccessoryModelCompatibilitySchema,
  insertProfessionalServiceSchema,
  insertServiceProductSchema,
  insertSoftwareProductSchema,
  insertSupplySchema,
  insertManagedServiceSchema,
  insertInventoryItemSchema,
  insertContractTieredRateSchema,
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
import csv from 'csv-parser';
import { Readable } from 'stream';
import { db } from './db';
import { and, eq, sql, desc, asc, inArray } from 'drizzle-orm';
import { getUserId, getTenantId } from './utils/auth-helpers';

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

// Helper function to parse CSV from buffer
function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(buffer.toString());

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Helper function to validate and transform product model data
function validateProductModelData(row: any): any {
  const errors: string[] = [];

  if (!row['Product Code']) errors.push('Product Code is required');
  if (!row['Product Name']) errors.push('Product Name is required');

  // Parse required accessories and validate format
  let requiredAccessories = null;
  if (row['Required Accessories']) {
    const accessoryString = row['Required Accessories'].trim();
    if (accessoryString) {
      // Support both comma and semicolon separated values
      const accessories = accessoryString
        .split(/[,;]/)
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      if (accessories.length > 0) {
        requiredAccessories = accessories.join(',');
      }
    }
  }

  // Parse boolean values
  const parseBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === 'yes' || lower === '1';
    }
    return false;
  };

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row['Product Code']?.trim(),
      productName: row['Product Name']?.trim(),
      category: row['Category']?.trim() || 'MFP',
      manufacturer: row['Manufacturer']?.trim() || null,
      description: row['Description']?.trim() || null,
      msrp: row['MSRP'] ? parseFloat(row['MSRP'].toString().replace(/[,$]/g, '')) : null,
      colorMode: row['Color Mode']?.trim() || null,
      colorSpeed: row['Color Speed']?.trim() || null,
      bwSpeed: row['BW Speed']?.trim() || null,
      productFamily: row['Product Family']?.trim() || null,
      requiredAccessories,
      newActive: parseBoolean(row['New Active']),
      newRepPrice: row['New Rep Price']
        ? parseFloat(row['New Rep Price'].toString().replace(/[,$]/g, ''))
        : null,
      upgradeActive: parseBoolean(row['Upgrade Active']),
      upgradeRepPrice: row['Upgrade Rep Price']
        ? parseFloat(row['Upgrade Rep Price'].toString().replace(/[,$]/g, ''))
        : null,
      lexmarkActive: parseBoolean(row['Lexmark Active']),
      lexmarkRepPrice: row['Lexmark Rep Price']
        ? parseFloat(row['Lexmark Rep Price'].toString().replace(/[,$]/g, ''))
        : null,
      isActive: row['Is Active'] !== undefined ? parseBoolean(row['Is Active']) : true,
    },
  };
}

// Helper function to validate and transform supply data
function validateSupplyData(row: any): any {
  const errors: string[] = [];

  if (!row['Product Code']) errors.push('Product Code is required');
  if (!row['Product Name']) errors.push('Product Name is required');

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row['Product Code']?.trim(),
      productName: row['Product Name']?.trim(),
      productType: row['Product Type']?.trim() || 'Supplies',
      dealerComp: row['Dealer Comp']?.trim() || null,
      inventory: row['Inventory']?.trim() || null,
      inStock: row['In Stock']?.trim() || null,
      description: row['Description']?.trim() || null,
      newRepPrice: row['New Rep Price'] ? parseFloat(row['New Rep Price']) : null,
      upgradeRepPrice: row['Upgrade Rep Price'] ? parseFloat(row['Upgrade Rep Price']) : null,
      lexmarkRepPrice: row['Lexmark Rep Price'] ? parseFloat(row['Lexmark Rep Price']) : null,
      graphicRepPrice: row['Graphic Rep Price'] ? parseFloat(row['Graphic Rep Price']) : null,
      newActive: !!row['New Rep Price'],
      upgradeActive: !!row['Upgrade Rep Price'],
      lexmarkActive: !!row['Lexmark Rep Price'],
      graphicActive: !!row['Graphic Rep Price'],
      isActive: true,
      salesRepCredit: true,
      funding: true,
    },
  };
}

// Helper function to validate and transform managed service data
function validateManagedServiceData(row: any): any {
  const errors: string[] = [];

  if (!row['Product Code']) errors.push('Product Code is required');
  if (!row['Product Name']) errors.push('Product Name is required');

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row['Product Code']?.trim(),
      productName: row['Product Name']?.trim(),
      category: 'IT Services',
      serviceType: row['Service Type']?.trim() || null,
      serviceLevel: row['Service Level']?.trim() || null,
      supportHours: row['Support Hours']?.trim() || null,
      responseTime: row['Response Time']?.trim() || null,
      remoteMgmt: row['Remote Management']?.toLowerCase() === 'yes',
      onsiteSupport: row['Onsite Support']?.toLowerCase() === 'yes',
      includesHardware: false,
      description: row['Description']?.trim() || null,
      newRepPrice: row['New Rep Price'] ? parseFloat(row['New Rep Price']) : null,
      upgradeRepPrice: row['Upgrade Rep Price'] ? parseFloat(row['Upgrade Rep Price']) : null,
      lexmarkRepPrice: row['Lexmark Rep Price'] ? parseFloat(row['Lexmark Rep Price']) : null,
      graphicRepPrice: row['Graphic Rep Price'] ? parseFloat(row['Graphic Rep Price']) : null,
      newActive: !!row['New Rep Price'],
      upgradeActive: !!row['Upgrade Rep Price'],
      lexmarkActive: !!row['Lexmark Rep Price'],
      graphicActive: !!row['Graphic Rep Price'],
      isActive: true,
      salesRepCredit: true,
      funding: true,
    },
  };
}

function validateSoftwareProductData(row: any): any {
  const errors: string[] = [];

  // Handle multiple header formats: snake_case, camelCase, and Title Case
  const getFieldValue = (field: string) => {
    // Try multiple variations of the field name
    return (
      row[field] ||
      row[field.toLowerCase()] ||
      row[field.replace(/_/g, '')] || // snake_case -> camelCase
      row[
        field
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      ] || // snake_case -> Title Case
      row[
        field
          .split('_')
          .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
          .join('')
      ]
    ); // snake_case -> camelCase
  };

  const productCode = getFieldValue('product_code');
  const productName = getFieldValue('product_name');

  if (!productCode) errors.push('Product Code is required');
  if (!productName) errors.push('Product Name is required');

  // Helper function to parse boolean values
  const parseBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return false;
  };

  // Helper function to parse decimal values
  const parseDecimal = (value: any): number | null => {
    if (!value || value === '' || value === null || value === undefined) return null;
    // Clean the value: remove $, commas, and extra spaces
    const cleanValue = value
      .toString()
      .replace(/[$,\s]/g, '')
      .trim();
    if (cleanValue === '') return null;
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parsed;
  };

  // Parse pricing values
  const standardCost = parseDecimal(getFieldValue('standard_cost'));
  const standardRepPriceRaw = getFieldValue('standard_rep_price');
  log.info(
    `Debug: standardRepPriceRaw for ${productCode}:`,
    standardRepPriceRaw,
    typeof standardRepPriceRaw,
  );
  const standardRepPrice = parseDecimal(standardRepPriceRaw);
  log.info(`Debug: standardRepPrice after parseDecimal for ${productCode}:`, standardRepPrice);
  const newCost = parseDecimal(getFieldValue('new_cost'));
  const newRepPrice = parseDecimal(getFieldValue('new_rep_price'));
  const upgradeCost = parseDecimal(getFieldValue('upgrade_cost'));
  const upgradeRepPrice = parseDecimal(getFieldValue('upgrade_rep_price'));

  // Auto-set active flags if pricing data is present and active flag is not explicitly set
  const standardActiveFromCSV = getFieldValue('standard_active');
  const newActiveFromCSV = getFieldValue('new_active');
  const upgradeActiveFromCSV = getFieldValue('upgrade_active');

  const standardActive =
    standardActiveFromCSV !== undefined
      ? parseBoolean(standardActiveFromCSV)
      : standardRepPrice !== null || standardCost !== null; // Auto-enable if pricing exists

  const newActive =
    newActiveFromCSV !== undefined
      ? parseBoolean(newActiveFromCSV)
      : newRepPrice !== null || newCost !== null; // Auto-enable if pricing exists

  const upgradeActive =
    upgradeActiveFromCSV !== undefined
      ? parseBoolean(upgradeActiveFromCSV)
      : upgradeRepPrice !== null || upgradeCost !== null; // Auto-enable if pricing exists

  const data = {
    productCode: productCode?.trim(),
    productName: productName?.trim(),
    vendor: getFieldValue('vendor')?.trim() || null,
    productType: getFieldValue('product_type')?.trim() || null,
    category: getFieldValue('category')?.trim() || null,
    accessoryType: getFieldValue('accessory_type')?.trim() || null,
    paymentType: getFieldValue('payment_type')?.trim() || null,
    description: getFieldValue('description')?.trim() || null,
    summary: getFieldValue('summary')?.trim() || null,
    note: getFieldValue('note')?.trim() || null,
    eaNotes: getFieldValue('ea_notes')?.trim() || null,
    configNote: getFieldValue('config_note')?.trim() || null,
    relatedProducts: getFieldValue('related_products')?.trim() || null,

    // Flags
    isActive: parseBoolean(getFieldValue('is_active')),
    availableForAll: parseBoolean(getFieldValue('available_for_all')),
    repostEdit: parseBoolean(getFieldValue('repost_edit')),
    salesRepCredit: parseBoolean(getFieldValue('sales_rep_credit')),
    funding: parseBoolean(getFieldValue('funding')),
    lease: parseBoolean(getFieldValue('lease')),

    // Pricing with smart active flag detection
    standardActive,
    standardCost,
    standardRepPrice,

    newActive,
    newCost,
    newRepPrice,

    upgradeActive,
    upgradeCost,
    upgradeRepPrice,

    // System Information
    priceBookId: getFieldValue('price_book_id')?.trim() || null,
    tempKey: getFieldValue('temp_key')?.trim() || null,
  };

  // Debug logging for first few rows
  if (productCode && (standardRepPrice || standardCost)) {
    log.info(
      `Validation debug for ${productCode}: standardRepPrice=${standardRepPrice}, standardCost=${standardCost}, standardActive=${standardActive}`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    data,
  };
}

export function registerProductsCrudRoutes(app: Express) {
  // ============= PRODUCT MODELS CRUD =============

  app.get('/api/product-models', async (req: any, res) => {
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
  });

  app.get('/api/product-models/:id', async (req: any, res) => {
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
  });

  app.post('/api/product-models', async (req: any, res) => {
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
  });

  app.patch('/api/product-models/:id', async (req: any, res) => {
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
  });

  // Bulk delete product models (must be before single delete route)
  app.delete('/api/product-models/bulk-delete', async (req: any, res) => {
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
          results.push({ id, success: false, error: error.message });
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
  });

  app.delete('/api/product-models/:id', async (req: any, res) => {
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
        return res.status(404).json({ message: 'Product model not found or could not be deleted' });
      }
      res.json({ message: 'Product model deleted successfully' });
    } catch (error) {
      log.error('Error deleting product model:', error);
      res.status(500).json({ message: 'Failed to delete product model' });
    }
  });

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
        const codes = codesParam.split(',').map((code) => code.trim());
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

  app.post('/api/product-accessories', async (req: any, res) => {
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
  });

  app.delete('/api/product-accessories/:id', async (req: any, res) => {
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
  });

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

  app.patch('/api/product-accessories/:id', async (req: any, res) => {
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
  });

  // ============= ACCESSORY-MODEL COMPATIBILITY =============

  app.get('/api/accessories/:accessoryId/compatibility', async (req: any, res) => {
    try {
      const { accessoryId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const compatibilities = await storage.getAccessoryCompatibilities(accessoryId, tenantId);
      res.json(compatibilities);
    } catch (error) {
      log.error('Error fetching accessory compatibilities:', error);
      res.status(500).json({ message: 'Failed to fetch compatibilities' });
    }
  });

  app.post('/api/accessories/:accessoryId/compatibility', async (req: any, res) => {
    try {
      const { accessoryId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const validatedData = insertAccessoryModelCompatibilitySchema.parse({
        ...req.body,
        accessoryId,
        tenantId,
      });
      const compatibility = await storage.createAccessoryModelCompatibility(validatedData);
      res.status(201).json(compatibility);
    } catch (error) {
      log.error('Error creating accessory compatibility:', error);
      res.status(500).json({ message: 'Failed to create compatibility' });
    }
  });

  app.delete(
    '/api/accessories/:accessoryId/compatibility/:modelId',

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

  app.post('/api/accessory-model-compatibility', async (req: any, res) => {
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
  });

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

  app.post('/api/professional-services', async (req: any, res) => {
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
  });

  app.patch('/api/professional-services/:id', async (req: any, res) => {
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
  });

  app.delete('/api/professional-services/:id', async (req: any, res) => {
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
  });

  // ============= SERVICE PRODUCTS =============

  app.get('/api/service-products', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const services = await storage.getAllServiceProducts(tenantId);
      res.json(services);
    } catch (error) {
      log.error('Error fetching service products:', error);
      res.status(500).json({ message: 'Failed to fetch service products' });
    }
  });

  app.post('/api/service-products', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const validatedData = insertServiceProductSchema.parse({
        ...req.body,
        tenantId,
      });
      const service = await storage.createServiceProduct(validatedData);
      res.json(service);
    } catch (error) {
      log.error('Error creating service product:', error);
      res.status(500).json({ message: 'Failed to create service product' });
    }
  });

  // ============= SOFTWARE PRODUCTS =============

  app.get('/api/software-products', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const products = await storage.getAllSoftwareProducts(tenantId);
      res.json(products);
    } catch (error) {
      log.error('Error fetching software products:', error);
      res.status(500).json({ message: 'Failed to fetch software products' });
    }
  });

  app.post('/api/software-products', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const validatedData = insertSoftwareProductSchema.parse({
        ...req.body,
        tenantId,
      });
      const product = await storage.createSoftwareProduct(validatedData);
      res.json(product);
    } catch (error) {
      log.error('Error creating software product:', error);
      res.status(500).json({ message: 'Failed to create software product' });
    }
  });

  app.put('/api/software-products/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const validatedData = insertSoftwareProductSchema.parse({
        ...req.body,
        tenantId,
      });
      const product = await storage.updateSoftwareProduct(id, validatedData, tenantId);
      res.json(product);
    } catch (error) {
      log.error('Error updating software product:', error);
      res.status(500).json({ message: 'Failed to update software product' });
    }
  });

  // Bulk delete software products (must be before single delete route)
  app.delete('/api/software-products/bulk-delete', async (req: any, res) => {
    try {
      const { ids } = req.body;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'IDs array is required' });
      }
      const deletedCount = await storage.bulkDeleteSoftwareProducts(ids, tenantId);
      res.json({
        message: `Successfully deleted ${deletedCount} software products`,
        deletedCount,
      });
    } catch (error) {
      log.error('Error bulk deleting software products:', error);
      res.status(500).json({ message: 'Failed to bulk delete software products' });
    }
  });

  // Delete software product
  app.delete('/api/software-products/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const success = await storage.deleteSoftwareProduct(id, tenantId);
      if (!success) {
        return res.status(404).json({ message: 'Software product not found' });
      }
      res.json({ message: 'Software product deleted successfully' });
    } catch (error) {
      log.error('Error deleting software product:', error);
      res.status(500).json({ message: 'Failed to delete software product' });
    }
  });

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

  app.post('/api/supplies', async (req: any, res) => {
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
  });

  app.patch('/api/supplies/:id', async (req: any, res) => {
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
  });

  app.delete('/api/supplies/:id', async (req: any, res) => {
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
  });

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

  app.post('/api/inventory', async (req: any, res) => {
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
  });

  app.patch('/api/inventory/:id', async (req: any, res) => {
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
  });

  app.post('/api/managed-services', async (req: any, res) => {
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
  });

  app.patch('/api/managed-services/:id', async (req: any, res) => {
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
  });

  app.delete('/api/managed-services/:id', async (req: any, res) => {
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
  });

  // ============= ACCOUNTING API ROUTES =============

  // Vendors Management
  app.get('/api/vendors', async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const vendors = await storage.getVendors(tenantId);
      res.json(vendors);
    } catch (error) {
      log.error('Error fetching vendors:', error);
      res.status(500).json({ message: 'Failed to fetch vendors' });
    }
  });

  app.get('/api/vendors/:id', async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const { id } = req.params;
      const vendor = await storage.getVendor(id, tenantId);
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      res.json(vendor);
    } catch (error) {
      log.error('Error fetching vendor:', error);
      res.status(500).json({ message: 'Failed to fetch vendor' });
    }
  });

  app.post('/api/vendors', async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const vendorData = { ...req.body, tenantId };
      const newVendor = await storage.createVendor(vendorData);
      res.status(201).json(newVendor);
    } catch (error) {
      log.error('Error creating vendor:', error);
      res.status(500).json({ message: 'Failed to create vendor' });
    }
  });

  app.patch('/api/vendors/:id', async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const { id } = req.params;
      const updatedVendor = await storage.updateVendor(id, req.body, tenantId);
      if (!updatedVendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      res.json(updatedVendor);
    } catch (error) {
      log.error('Error updating vendor:', error);
      res.status(500).json({ message: 'Failed to update vendor' });
    }
  });

  app.delete('/api/vendors/:id', async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const { id } = req.params;
      const success = await storage.deleteVendor(id, tenantId);
      if (success) {
        res.json({ message: 'Vendor deleted successfully' });
      } else {
        res.status(404).json({ message: 'Vendor not found' });
      }
    } catch (error) {
      log.error('Error deleting vendor:', error);
      res.status(500).json({ message: 'Failed to delete vendor' });
    }
  });

  // Accounts Payable Management
  app.get('/api/accounts-payable', async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const accountsPayable = await storage.getAccountsPayable(tenantId);
      res.json(accountsPayable);
    } catch (error) {
      log.error('Error fetching accounts payable:', error);
      res.status(500).json({ message: 'Failed to fetch accounts payable' });
    }
  });

  app.post('/api/accounts-payable', async (req, res) => {
    try {
      const { tenantId, id: userId } = (req as any).user || {};
      const apData = { ...req.body, tenantId, createdBy: userId };
      const newAP = await storage.createAccountsPayable(apData);
      res.status(201).json(newAP);
    } catch (error) {
      log.error('Error creating account payable:', error);
      res.status(500).json({ message: 'Failed to create account payable' });
    }
  });

  // Accounts Receivable Management
  app.get('/api/accounts-receivable', async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const accountsReceivable = await storage.getAccountsReceivable(tenantId);
      res.json(accountsReceivable);
    } catch (error) {
      log.error('Error fetching accounts receivable:', error);
      res.status(500).json({ message: 'Failed to fetch accounts receivable' });
    }
  });

  app.post('/api/accounts-receivable', async (req, res) => {
    try {
      const { tenantId, id: userId } = (req as any).user || {};
      const arData = { ...req.body, tenantId, createdBy: userId };
      const newAR = await storage.createAccountsReceivable(arData);
      res.status(201).json(newAR);
    } catch (error) {
      log.error('Error creating account receivable:', error);
      res.status(500).json({ message: 'Failed to create account receivable' });
    }
  });

  /**
   * NOTE: Migrated to routes-financial.ts (Phase 2):
   * - GET /api/chart-of-accounts - Get chart of accounts
   * - POST /api/chart-of-accounts - Create chart of account entry
   * - ALL /api/journal-entries - Journal entries (501 Not Implemented stub)
   */

  // ============= PURCHASE ORDERS =============

  app.get('/api/purchase-orders', async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const filter = String((req.query as any)?.filter || '');
      // Fall back to storage if no filter, else run filtered DB query
      if (!filter) {
        const purchaseOrders = await storage.getPurchaseOrders(tenantId);
        return res.json(purchaseOrders);
      }
      if (filter === 'variance_gt_2x') {
        const result = await db.$client.query(
          `SELECT * FROM purchase_orders
           WHERE tenant_id = $1
             AND approved_date IS NOT NULL
             AND expected_date IS NOT NULL
             AND order_date IS NOT NULL
             AND (DATE_PART('day', expected_date - approved_date)) > 2 * GREATEST(1, DATE_PART('day', expected_date - order_date))
           ORDER BY created_at DESC
           LIMIT 200`,
          [tenantId],
        );
        return res.json(result.rows);
      }
      // Unknown filter -> default list
      const purchaseOrders = await storage.getPurchaseOrders(tenantId);
      res.json(purchaseOrders);
    } catch (error) {
      log.error('Error fetching purchase orders:', error);
      res.status(500).json({ message: 'Failed to fetch purchase orders' });
    }
  });

  app.post('/api/purchase-orders', async (req, res) => {
    try {
      const { tenantId, id: userId } = (req as any).user || {};
      const poData = { ...req.body, tenantId, createdBy: userId };
      const newPO = await storage.createPurchaseOrder(poData);
      res.status(201).json(newPO);
    } catch (error) {
      log.error('Error creating purchase order:', error);
      res.status(500).json({ message: 'Failed to create purchase order' });
    }
  });

  // Low stock suggestions for auto-generating POs
  app.get('/api/purchase-orders/suggestions/low-stock', async (req: any, res) => {
    try {
      const { tenantId } = req.user || {};

      const items = await db
        .select({
          id: inventoryItems.id,
          itemDescription: inventoryItems.name,
          partNumber: inventoryItems.partNumber,
          quantityOnHand: inventoryItems.currentStock,
          quantityOnOrder: inventoryItems.currentStock,
          reorderPoint: inventoryItems.reorderPoint,
          reorderQuantity: inventoryItems.reorderPoint,
          unitCost: inventoryItems.unitCost,
          primaryVendor: inventoryItems.supplier,
        })
        .from(inventoryItems)
        .where(
          and(
            tenantId ? eq(inventoryItems.tenantId, tenantId) : sql`TRUE`,
            sql`reorder_point IS NOT NULL AND current_stock <= reorder_point AND COALESCE(reorder_point, 0) > 0 AND supplier IS NOT NULL`,
          ),
        )
        .orderBy(asc(inventoryItems.supplier), asc(inventoryItems.name))
        .limit(500);

      if (!items.length) return res.json({ groups: [] });

      const vendorRows = await db
        .select({ id: vendors.id, name: vendors.vendorName })
        .from(vendors)
        .where(tenantId ? eq(vendors.tenantId, tenantId) : sql`TRUE`);
      const vendorNameToId = new Map(vendorRows.map((v) => [v.name?.toLowerCase(), v.id] as const));

      const groupsMap = new Map<string, any>();
      for (const it of items) {
        const key = (it.primaryVendor || '').toLowerCase();
        if (!key) continue;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            vendorName: it.primaryVendor,
            vendorId: vendorNameToId.get(key) || null,
            items: [] as any[],
          });
        }
        const recommendedQty = Number(it.reorderQuantity) || 0;
        groupsMap.get(key).items.push({
          inventoryItemId: it.id,
          partNumber: it.partNumber,
          itemDescription: it.itemDescription,
          recommendedQty,
          unitCost: it.unitCost || 0,
        });
      }

      const groups = Array.from(groupsMap.values());
      res.json({ groups });
    } catch (error) {
      log.error('Error building low-stock suggestions:', error);
      res.status(500).json({ message: 'Failed to build suggestions' });
    }
  });

  // Generate purchase orders from low-stock suggestions
  app.post('/api/purchase-orders/generate-from-suggestions', async (req: any, res) => {
    try {
      const { tenantId, id: userId } = req.user || {};
      const { groups, orderDate, expectedDate, description } = req.body || {};
      if (!Array.isArray(groups) || groups.length === 0) {
        return res.status(400).json({ message: 'No groups provided' });
      }

      const createdPoIds: string[] = [];
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        if (!group.vendorId || !Array.isArray(group.items) || group.items.length === 0) continue;

        let subtotal = 0;
        const lineItems = group.items.map((it: any, idx: number) => {
          const qty = Number(it.quantity || it.recommendedQty || 0);
          const price = Number(it.unitCost || 0);
          const total = qty * price;
          subtotal += total;
          return {
            tenantId,
            purchaseOrderId: '',
            lineNumber: idx + 1,
            itemDescription: it.itemDescription || it.partNumber || 'Item',
            itemCode: it.partNumber || null,
            quantity: qty,
            unitPrice: price,
            totalPrice: total,
          };
        });

        const poNumber = `PO-${Date.now()}-${i + 1}`;
        const poData = {
          tenantId,
          poNumber,
          vendorId: group.vendorId,
          requestedBy: userId,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          description:
            description ||
            `Auto-generated from low stock for ${group.vendorName || group.vendorId}`,
          subtotal,
          taxAmount: 0,
          shippingAmount: 0,
          totalAmount: subtotal,
          status: 'draft',
          deliveryAddress: null,
          specialInstructions: null,
          approvedBy: null,
          approvedDate: null,
          createdBy: userId,
        } as any;

        const createdPO = await storage.createPurchaseOrder(poData);
        createdPoIds.push(createdPO.id);

        for (const li of lineItems) {
          await storage.createPurchaseOrderItem({ ...li, purchaseOrderId: createdPO.id });
        }
      }

      res.json({ createdPoIds });
    } catch (error) {
      log.error('Error generating purchase orders:', error);
      res.status(500).json({ message: 'Failed to generate purchase orders' });
    }
  });

  // ============= COMPANY CONTACTS =============

  app.post(
    '/api/companies/:companyId/contacts',

    async (req: any, res) => {
      try {
        const { companyId } = req.params;
        const { contacts } = req.body;

        // Authentication check using unified auth helpers
        const userId = getUserId(req);
        if (!userId) {
          return res.status(401).json({ message: 'Not authenticated' });
        }

        const user = await storage.getUser(userId);
        if (!user?.tenantId) {
          return res.status(403).json({ message: 'Access denied' });
        }

        if (!Array.isArray(contacts) || contacts.length === 0) {
          return res.status(400).json({ message: 'Contacts array is required' });
        }

        // Create contacts for the company
        const createdContacts = [];
        for (const contactData of contacts) {
          const contact = await storage.createContact({
            ...contactData,
            companyId: companyId, // Use companyId field for company_contacts table
            tenantId: user.tenantId,
            ownerId: user.id, // Set the current user as owner
            leadStatus: 'new', // Set default lead status
          });
          createdContacts.push(contact);
        }

        res.json({
          message: `${createdContacts.length} contact(s) created successfully`,
          contacts: createdContacts,
        });
      } catch (error) {
        log.error('Error creating company contacts:', error);
        res.status(500).json({ message: 'Failed to create contacts' });
      }
    },
  );

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
  app.post('/api/meter-readings', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      let payload: any;
      try {
        // Prefer strict schema if request already matches it
        payload = insertMeterReadingSchema.parse({ ...req.body, tenantId });
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
  });

  // ============= CONTRACT TIERED RATES =============

  app.get('/api/contract-tiered-rates', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const rates = await storage.getContractTieredRates(tenantId);
      res.json(rates);
    } catch (error) {
      log.error('Error fetching contract tiered rates:', error);
      res.status(500).json({ message: 'Failed to fetch contract tiered rates' });
    }
  });

  app.post('/api/contract-tiered-rates', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const validatedData = insertContractTieredRateSchema.parse({
        ...req.body,
        tenantId,
      });
      const rate = await storage.createContractTieredRate(validatedData);
      res.json(rate);
    } catch (error) {
      log.error('Error creating contract tiered rate:', error);
      res.status(500).json({ message: 'Failed to create contract tiered rate' });
    }
  });

  // NOTE: Invoice generation and contract profitability migrated to routes-billing-core.ts

  // NOTE: Company contacts routes migrated to routes-contacts.ts (Phase 3 Refactor)

  // ============= CSV IMPORT ENDPOINTS =============

  // Product Models Import
  app.post(
    '/api/product-models/import',
    upload.single('file'),

    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const csvData = await parseCSV(req.file.buffer);

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          const validation = validateProductModelData(row);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
            skipped++;
            continue;
          }

          try {
            const productData = { ...validation.data, tenantId };

            // Enhanced deduplication: Check both product code AND product name
            // Only skip if BOTH match (handles speed license scenario)
            const existingModel = await storage.getProductModelByCodeAndName(
              productData.productCode,
              productData.productName,
              tenantId,
            );

            if (existingModel) {
              // Skip this entry - both code and name match an existing model
              skipped++;
              continue;
            }

            // Validate required accessories exist before importing
            if (productData.requiredAccessories) {
              const requiredCodes = productData.requiredAccessories
                .split(',')
                .map((code) => code.trim())
                .filter((code) => code.length > 0);

              if (requiredCodes.length > 0) {
                const existingAccessories = await storage.getProductAccessoriesByCodes(
                  requiredCodes,
                  tenantId,
                );
                const existingCodes = existingAccessories.map((acc) => acc.accessoryCode);
                const missingCodes = requiredCodes.filter((code) => !existingCodes.includes(code));

                if (missingCodes.length > 0) {
                  // Remove missing accessory codes from required accessories to prevent future errors
                  const validCodes = requiredCodes.filter((code) => existingCodes.includes(code));
                  productData.requiredAccessories =
                    validCodes.length > 0 ? validCodes.join(',') : null;

                  // Log warning but continue with valid accessories only
                  log.warn(
                    `Row ${i + 2}: Missing required accessories [${missingCodes.join(', ')}] for model ${productData.productCode}. Proceeding with valid accessories only.`,
                  );
                }
              }
            }

            // Create the new model (either new code or same code with different name)
            await storage.createProductModel(productData);
            imported++;
          } catch (error) {
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
            skipped++;
          }
        }

        res.json({
          success: errors.length === 0,
          imported,
          skipped,
          errors,
        });
      } catch (error) {
        log.error('Error importing product models:', error);
        res.status(500).json({ message: 'Failed to import product models' });
      }
    },
  );

  // Supplies Import
  app.post(
    '/api/supplies/import',
    upload.single('file'),

    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const csvData = await parseCSV(req.file.buffer);

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          const validation = validateSupplyData(row);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
            skipped++;
            continue;
          }

          try {
            const supplyData = { ...validation.data, tenantId };
            await storage.createSupply(supplyData);
            imported++;
          } catch (error) {
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
            skipped++;
          }
        }

        res.json({
          success: errors.length === 0,
          imported,
          skipped,
          errors,
        });
      } catch (error) {
        log.error('Error importing supplies:', error);
        res.status(500).json({ message: 'Failed to import supplies' });
      }
    },
  );

  // Managed Services Import
  app.post(
    '/api/managed-services/import',
    upload.single('file'),

    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }
        const csvData = await parseCSV(req.file.buffer);

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          const validation = validateManagedServiceData(row);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
            skipped++;
            continue;
          }

          try {
            const serviceData = { ...validation.data, tenantId };
            await storage.createManagedService(serviceData);
            imported++;
          } catch (error) {
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
            skipped++;
          }
        }

        res.json({
          success: errors.length === 0,
          imported,
          skipped,
          errors,
        });
      } catch (error) {
        log.error('Error importing managed services:', error);
        res.status(500).json({ message: 'Failed to import managed services' });
      }
    },
  );

  // Product Accessories import endpoint
  app.post(
    '/api/product-accessories/import',
    upload.single('file'),

    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const csvText = req.file.buffer.toString('utf-8');
        const results = await new Promise((resolve, reject) => {
          const records: any[] = [];
          const stream = Readable.from([csvText])
            .pipe(csv())
            .on('data', (data) => records.push(data))
            .on('end', () => resolve(records))
            .on('error', reject);
        });

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < results.length; i++) {
          const row = results[i];

          try {
            // Map CSV fields to database schema
            const accessoryData = {
              tenantId,
              accessoryCode: row.accessoryCode?.trim(),
              accessoryName: row.accessory_name?.trim(),
              accessoryType: row.accessory_type?.trim() || null,
              category: row.category?.trim() || null,
              manufacturer: row.manufacturer?.trim() || null,
              description: row.description?.trim() || null,

              // Pricing fields
              standardCost: row.standard_cost ? parseFloat(row.standard_cost) : null,
              standardRepPrice: row.standard_rep_price ? parseFloat(row.standard_rep_price) : null,
              newCost: row.new_cost ? parseFloat(row.new_cost) : null,
              newRepPrice: row.new_rep_price ? parseFloat(row.new_rep_price) : null,
              upgradeCost: row.upgrade_cost ? parseFloat(row.upgrade_cost) : null,
              upgradeRepPrice: row.upgrade_rep_price ? parseFloat(row.upgrade_rep_price) : null,

              // Boolean fields with proper conversion
              isActive: row.isActive === 'TRUE' || row.isActive === 'true' || row.isActive === true,
              availableForAll:
                row.available_for_all === 'TRUE' ||
                row.available_for_all === 'true' ||
                row.available_for_all === true,
              salesRepCredit:
                row.sales_rep_credit === 'TRUE' ||
                row.sales_rep_credit === 'true' ||
                row.sales_rep_credit === true,
              funding: row.funding === 'TRUE' || row.funding === 'true' || row.funding === true,
              lease: row.lease === 'TRUE' || row.lease === 'true' || row.lease === true,
            };

            // Validation
            if (!accessoryData.accessoryCode || !accessoryData.accessoryName) {
              errors.push(`Row ${i + 2}: Missing required fields (accessory_code, accessory_name)`);
              skipped++;
              continue;
            }

            // Check if accessory already exists
            const existing = await db
              .select()
              .from(productAccessories)
              .where(
                and(
                  eq(productAccessories.tenantId, tenantId),
                  eq(productAccessories.accessoryCode, accessoryData.accessoryCode),
                ),
              )
              .limit(1);

            if (existing.length > 0) {
              // Update existing accessory
              await db
                .update(productAccessories)
                .set({
                  ...accessoryData,
                  updatedAt: new Date(),
                })
                .where(eq(productAccessories.id, existing[0].id));
              imported++;
            } else {
              // Create new accessory
              await db.insert(productAccessories).values(accessoryData);
              imported++;
            }
          } catch (error) {
            log.error(`Error processing row ${i + 2}:`, error);
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
            skipped++;
          }
        }

        res.json({
          success: errors.length === 0,
          imported,
          skipped,
          errors,
        });
      } catch (error) {
        log.error('Error importing product accessories:', error);
        res.status(500).json({ message: 'Failed to import product accessories' });
      }
    },
  );

  app.post(
    '/api/professional-services/import',
    upload.single('file'),

    async (req: any, res) => {
      res.json({
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['Import for Professional Services not yet implemented'],
      });
    },
  );

  app.post(
    '/api/service-products/import',
    upload.single('file'),

    async (req: any, res) => {
      res.json({
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['Import for Service Products not yet implemented'],
      });
    },
  );

  app.post(
    '/api/software-products/import',
    upload.single('file'),

    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        const csvData = await parseCSV(req.file.buffer);

        // Debug: Log first row structure to understand CSV parsing
        if (csvData.length > 0) {
          log.info('First CSV row keys:', Object.keys(csvData[0]));
          log.info('First CSV row standard_rep_price value:', csvData[0]['standard_rep_price']);
          log.info('First CSV row standardRepPrice value:', csvData[0]['standardRepPrice']);
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          const validation = validateSoftwareProductData(row);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
            skipped++;
            continue;
          }

          try {
            const productData = { ...validation.data, tenantId };
            // Debug logging for standardRepPrice issue
            if (
              productData.productCode &&
              (productData.standardRepPrice || productData.standardCost)
            ) {
              log.info(
                `Importing ${productData.productCode}: standardActive=${productData.standardActive}, standardCost=${productData.standardCost}, standardRepPrice=${productData.standardRepPrice}`,
              );
            }
            await storage.createSoftwareProduct(productData);
            imported++;
          } catch (error) {
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
            skipped++;
          }
        }

        res.json({
          success: errors.length === 0,
          imported,
          skipped,
          errors,
        });
      } catch (error) {
        log.error('Error importing software products:', error);
        res.status(500).json({ message: 'Failed to import software products' });
      }
    },
  );

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
