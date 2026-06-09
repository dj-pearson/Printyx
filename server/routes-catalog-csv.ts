/**
 * Catalog CSV Import Routes
 * Extracted from routes.ts monolith.
 *
 * Includes:
 * - POST /api/product-models/import
 * - POST /api/supplies/import
 * - POST /api/managed-services/import
 * - POST /api/product-accessories/import
 * - POST /api/professional-services/import
 * - POST /api/service-products/import
 * - POST /api/software-products/import
 * - GET  /api/product-models/:modelId/cpc-rates
 * - POST /api/product-models/:modelId/cpc-rates
 * - POST /api/catalog/models/import (master catalog CSV)
 * - POST /api/catalog/import-enhanced (enhanced CSV import)
 */
import type { Express } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { storage } from './storage';
import { db } from './db';
import { and, eq } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-catalog-csv');

import { insertCpcRateSchema, productAccessories, masterProductModels } from '@shared/schema';
import {
  SOFTWARE_IMPORT_FIELDS,
  SOFTWARE_FIELD_TO_COLUMN,
  normalizeHeader,
  isMeaningfulCode,
} from '@shared/software-import-fields';
import { isAuthenticated } from './replitAuth';
import { isPlatformAdmin } from './utils/auth-helpers';

import { getUserId, getTenantId } from './utils/auth-helpers';
// Configure multer for CSV file uploads
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

// Apply an explicit column mapping ({ targetField: csvHeader }) plus alias
// auto-detection to a raw CSV row, producing canonical snake_case keys that
// validateSoftwareProductData understands. Originals are preserved.
function resolveSoftwareRow(rawRow: any, mapping: Record<string, string>): any {
  const headers = Object.keys(rawRow || {});
  const normToHeader: Record<string, string> = {};
  for (const h of headers) normToHeader[normalizeHeader(h)] = h;

  const resolved: Record<string, any> = { ...rawRow };
  for (const f of SOFTWARE_IMPORT_FIELDS) {
    let srcHeader: string | undefined;
    const explicit = mapping[f.field];
    if (explicit && normToHeader[normalizeHeader(explicit)]) {
      srcHeader = normToHeader[normalizeHeader(explicit)];
    } else {
      for (const cand of [f.field, ...f.aliases]) {
        const oh = normToHeader[normalizeHeader(cand)];
        if (oh) {
          srcHeader = oh;
          break;
        }
      }
    }
    if (srcHeader !== undefined) {
      resolved[SOFTWARE_FIELD_TO_COLUMN[f.field]] = rawRow[srcHeader];
    }
  }
  return resolved;
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

  // Require at least one of code/name (matches the edge function); names alone are
  // a valid identity when a CSV has no real SKU (e.g. "-" placeholder codes).
  if (!productCode && !productName) errors.push('Product Code or Product Name is required');

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

// Helper functions for enhanced CSV import
const createFieldMappings = (headers: string[]) => {
  const mappings: Record<string, string> = {};
  const suggestions: Record<string, string> = {};

  // Define field mapping patterns
  const patterns = {
    modelCode: [
      'item no',
      'item no.',
      'model',
      'model code',
      'model_code',
      'product code',
      'sku',
      'part number',
      'part no',
    ],
    displayName: [
      'description',
      'name',
      'product name',
      'model name',
      'model_name',
      'display name',
      'display_name',
      'title',
    ],
    msrp: ['msrp', 'msrp_usd', 'retail price', 'list price', 'suggested retail price'],
    dealerCost: ['dealer price', 'dealer cost', 'cost', 'wholesale price', 'buy price'],
    manufacturer: ['manufacturer', 'brand', 'make'],
    category: ['category', 'type', 'product type', 'class'],
    status: ['status', 'state', 'active'],
  };

  let requiredFieldsFound = 0;
  const requiredFields = ['modelCode', 'displayName'];

  // Map headers to fields
  for (const [field, searchTerms] of Object.entries(patterns)) {
    for (const header of headers) {
      const headerLower = header.toLowerCase().trim();
      if (searchTerms.includes(headerLower)) {
        mappings[field] = header;
        if (requiredFields.includes(field)) requiredFieldsFound++;
        break;
      }
    }

    if (!mappings[field]) {
      // Find closest match for suggestions
      const closest = headers.find((h) =>
        searchTerms.some((term) => h.toLowerCase().includes(term.toLowerCase())),
      );
      if (closest) suggestions[field] = closest;
    }
  }

  return {
    isValid: requiredFieldsFound >= 1, // Relax validation - need at least one required field
    mappings,
    suggestions,
    headersFound: headers,
    requiredFieldsFound,
    debug: { patterns, requiredFields },
  };
};

// Category normalization mapping
const normalizeCategoryName = (category: string): string => {
  if (!category) return category;

  const categoryLower = category.toLowerCase().trim();

  // Consolidate similar categories
  if (categoryLower.includes('mfp') || categoryLower.includes('multifunction')) {
    return 'Multifunction';
  }

  if (
    categoryLower.includes('accessory') ||
    categoryLower.includes('hardware accessory') ||
    categoryLower.includes('paper feeding') ||
    categoryLower.includes('document feeding')
  ) {
    return 'Accessory';
  }

  // Capitalize first letter for consistency
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};

const parseCSVLine = (line: string): string[] => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

const mapRowToProduct = (rowData: any, fieldMappings: any) => {
  const mappings = fieldMappings.mappings;

  const normalizeMoney = (value: string) => {
    if (!value) return undefined;
    const cleaned = value.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  };

  // Get raw category value and normalize it
  const rawCategory = rowData[mappings.category] || 'General';
  const normalizedCategory = normalizeCategoryName(rawCategory);

  return {
    manufacturer: rowData[mappings.manufacturer] || 'Unknown',
    modelCode: rowData[mappings.modelCode] || '',
    displayName: rowData[mappings.displayName] || '',
    msrp: normalizeMoney(rowData[mappings.msrp]),
    dealerCost: normalizeMoney(rowData[mappings.dealerCost]),
    category: normalizedCategory,
    productType: normalizedCategory === 'Accessory' ? 'accessory' : 'model',
    status: rowData[mappings.status] || 'active',
  };
};

const mergeProductData = (existing: any, newData: any) => {
  const merged = { ...existing };

  // Only update fields that are missing or empty in existing
  Object.keys(newData).forEach((key) => {
    if (!merged[key] && newData[key]) {
      merged[key] = newData[key];
    }
  });

  return merged;
};

export function registerCatalogCsvRoutes(app: Express) {
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
    isAuthenticated,
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

        // Optional explicit column mapping from the UI: { targetField: csvHeader }.
        let mapping: Record<string, string> = {};
        if (req.body?.mapping) {
          try {
            mapping = JSON.parse(req.body.mapping) || {};
          } catch {
            mapping = {};
          }
        }

        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        // Pre-fetch existing products for dedup — by meaningful code and by name.
        const existing = await storage.getAllSoftwareProducts(tenantId);
        const byCode = new Map<string, string>();
        const byName = new Map<string, string>();
        for (const p of existing) {
          if (isMeaningfulCode(p.productCode))
            byCode.set(p.productCode!.toLowerCase().trim(), p.id);
          if (p.productName) byName.set(p.productName.toLowerCase().trim(), p.id);
        }

        for (let i = 0; i < csvData.length; i++) {
          const resolved = resolveSoftwareRow(csvData[i], mapping);
          const validation = validateSoftwareProductData(resolved);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
            skipped++;
            continue;
          }

          try {
            const data = validation.data;
            const codeMeaningful = isMeaningfulCode(data.productCode);
            // Don't persist placeholder codes like "-".
            if (!codeMeaningful) data.productCode = null;

            const nameKey = (data.productName || '').toLowerCase().trim();
            const existingId = codeMeaningful
              ? byCode.get((data.productCode || '').toLowerCase().trim())
              : nameKey
                ? byName.get(nameKey)
                : undefined;

            if (existingId && existingId !== 'new') {
              await storage.updateSoftwareProduct(existingId, data, tenantId);
              updated++;
            } else if (existingId === 'new') {
              skipped++; // duplicate within this same file
            } else {
              const created = await storage.createSoftwareProduct({ ...data, tenantId });
              imported++;
              if (codeMeaningful)
                byCode.set((data.productCode as string).toLowerCase().trim(), 'new');
              else if (nameKey) byName.set(nameKey, 'new');
              void created;
            }
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
          updated,
          skipped,
          errors,
        });
      } catch (error) {
        log.error('Error importing software products:', error);
        res.status(500).json({ message: 'Failed to import software products' });
      }
    },
  );

  // CPC Rates
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

  // Admin-only: Import master catalog models (CSV)
  app.post(
    '/api/catalog/models/import',

    upload.single('file'),
    async (req: any, res) => {
      try {
        const isPlatformUser = isPlatformAdmin(req);

        if (!isPlatformUser) {
          return res.status(403).json({
            message: 'Platform admin required',
            userRole: req.user?.role,
            userId: req.user?.id,
            isPlatformUser: req.user?.isPlatformUser,
            debug: {
              checkResult: isPlatformUser,
              conditions: {
                isPlatformUser: req.user?.isPlatformUser,
                is_platform_user: req.user?.is_platform_user,
                roleLevel: req.user?.roleLevel,
              },
            },
          });
        }
        const file = req.file;
        if (!file) return res.status(400).json({ message: 'CSV file required' });

        const csvText = file.buffer.toString('utf-8');
        const lines = csvText.split(/\r?\n/);

        let created = 0;
        let updated = 0;
        let currentCategory: string | undefined = undefined;
        let columns: string[] = [];

        const isHeader = (arr: string[]) => {
          const lc = arr.map((s) => s.trim().toLowerCase());
          return (
            lc.includes('item no.') &&
            lc.includes('description') &&
            lc.some((c) => c.includes('dealer price')) &&
            lc.includes('msrp')
          );
        };

        const normalizeMoney = (s?: string) => {
          if (!s) return undefined;
          const n = Number(String(s).replace(/[$,\s]/g, ''));
          return Number.isFinite(n) ? n : undefined;
        };

        let currentModel: string | undefined = undefined;
        let skipped = 0;
        const duplicatesSkipped = new Set<string>();
        const relationshipsCreated = [];

        for (const raw of lines) {
          const line = raw.trimEnd();
          if (!line) continue;
          const parts = line.split(',');

          // Detect main model headers (e.g., "imageRUNNER ADVANCE DX C359iF / C259iF")
          if (/^\s*imageRUNNER|imagePRESS|imageFORCE/i.test(parts[0])) {
            currentCategory = 'Equipment';
            // Extract model from title - use the first model code mentioned
            const modelMatch = parts[0].match(/([A-Z]\d{3,4}[a-zA-Z]*)/);
            currentModel = modelMatch ? modelMatch[1] : undefined;
            columns = [];
            continue;
          }

          // Detect section titles to set category
          if (/^\s*Showroom\s+Models\s*$/i.test(parts[0])) {
            currentCategory = 'Showroom';
            columns = [];
            continue;
          }
          if (/^\s*Hardware\s+Accessories\s*$/i.test(parts[0])) {
            currentCategory = 'Hardware Accessories';
            columns = [];
            continue;
          }
          if (/^\s*[A-Za-z].*Accessories\s*$/i.test(parts[0])) {
            currentCategory = 'Accessories';
            columns = [];
            continue;
          }
          if (/^\s*Supplies.*$/i.test(parts[0])) {
            currentCategory = 'Supplies';
            columns = [];
            continue;
          }

          // Detect header rows
          if (isHeader(parts)) {
            columns = parts.map((h: string) => h.trim().toLowerCase());
            continue;
          }

          if (!columns.length) continue; // skip until header found

          // Build row object using current header
          const row: any = {};
          columns.forEach((c, i) => (row[c] = (parts[i] || '').trim()));

          const modelCode = row['item no.'] || row['item no'] || row['item'];
          const description = row['description'];
          const msrp = normalizeMoney(row['msrp']);
          const dealerPrice = normalizeMoney(row['dealer price']);

          if (!modelCode || !description) continue;

          // Create unique key for duplicate detection
          const duplicateKey = `Canon-${modelCode}`;
          if (duplicatesSkipped.has(duplicateKey)) {
            skipped++;
            continue;
          }

          // Enhanced categorization logic
          const isAccessory =
            currentCategory === 'Accessories' ||
            currentCategory === 'Hardware Accessories' ||
            currentCategory === 'Showroom' ||
            /accessory|module|tray|feeder|finisher|cabinet|stand|kit/i.test(description);

          if (isAccessory) {
            const payload: any = {
              manufacturer: 'Canon',
              accessoryCode: modelCode,
              displayName: description,
              category:
                currentCategory === 'Showroom'
                  ? 'Showroom Model'
                  : currentCategory || 'Accessories',
              msrp,
              specsJson: {
                dealerPrice,
                baseModel: currentModel,
                section: currentCategory,
              },
            };

            try {
              const saved = await storage.upsertMasterAccessory(payload);
              if (saved) {
                created++;
                duplicatesSkipped.add(duplicateKey);

                // Create relationship to current model if available
                if (currentModel) {
                  try {
                    const baseProduct = await storage.findMasterProduct('Canon', currentModel);
                    if (baseProduct) {
                      await storage.createProductAccessoryRelationship({
                        baseProductId: baseProduct.id,
                        accessoryId: saved.id,
                        relationshipType:
                          currentCategory === 'Showroom' ? 'recommended' : 'compatible',
                        category: currentCategory,
                      });
                      relationshipsCreated.push({
                        baseModel: currentModel,
                        accessory: modelCode,
                        category: currentCategory,
                      });
                    }
                  } catch (error) {
                    log.warn(
                      `Failed to create relationship for ${currentModel} -> ${modelCode}:`,
                      error,
                    );
                  }
                }
              }
            } catch (error) {
              log.warn(`Failed to create accessory ${modelCode}:`, error);
              skipped++;
            }
            continue;
          }

          // Handle main equipment models
          const payload: any = {
            manufacturer: 'Canon',
            modelCode,
            displayName: description,
            msrp,
            category: currentCategory || 'Equipment',
            productType: currentCategory === 'Equipment' ? 'multifunction' : 'accessory',
            specsJson: {
              dealerPrice,
              section: currentCategory,
              isMainModel: currentCategory === 'Equipment',
            },
          };

          try {
            const saved = await storage.upsertMasterProduct(payload);
            if (saved) {
              created++;
              duplicatesSkipped.add(duplicateKey);
              // Update current model reference for relationship mapping
              if (currentCategory === 'Equipment') {
                currentModel = modelCode;
              }
            }
          } catch (error) {
            log.warn(`Failed to create product ${modelCode}:`, error);
            skipped++;
          }
        }

        res.json({
          created,
          updated: 0, // We count upserts as created
          skipped,
          duplicatesFound: duplicatesSkipped.size,
          relationshipsCreated: relationshipsCreated.length,
          relationships: relationshipsCreated.slice(0, 10), // Sample of relationships
          summary: {
            totalProcessed: created + skipped,
            uniqueItemsImported: duplicatesSkipped.size,
            duplicatesSkipped: skipped,
          },
        });
      } catch (error: any) {
        log.error('Error importing master catalog:', error);
        res.status(500).json({
          message: 'Failed to import master catalog',
          detail: error?.message,
        });
      }
    },
  );

  // Enhanced CSV import with intelligent field mapping and duplicate handling
  app.post(
    '/api/catalog/import-enhanced',

    upload.single('file'),
    async (req: any, res) => {
      try {
        const isPlatformUser = isPlatformAdmin(req);

        if (!isPlatformUser) {
          return res.status(403).json({
            message: 'Platform admin required to import master products',
          });
        }

        const file = req.file;
        if (!file) {
          return res.status(400).json({ message: 'CSV file required' });
        }

        // Enhanced CSV parsing with field mapping
        const csvText = file.buffer.toString('utf-8');
        log.info('CSV file size:', file.size, 'bytes');
        log.info('First 200 characters:', csvText.substring(0, 200));

        const lines: string[] = csvText.split(/\r?\n/).filter((line: string) => line.trim());

        if (lines.length === 0) {
          return res.status(400).json({ message: 'CSV file is empty' });
        }

        if (lines.length < 2) {
          return res.status(400).json({
            message: 'CSV file must have at least a header row and one data row',
            linesFound: lines.length,
          });
        }

        // Parse header and create field mappings
        const headers = parseCSVLine(lines[0]).map((h: string) => h.trim().toLowerCase());
        const fieldMappings = createFieldMappings(headers);

        // Log debug information
        log.info('CSV Headers detected:', headers);
        log.info('Field mappings:', fieldMappings);

        if (!fieldMappings.isValid) {
          return res.status(400).json({
            message: 'Invalid CSV format',
            detail: `Required fields missing. Found headers: ${headers.join(
              ', ',
            )}. Need at least: model/item code and name/description fields.`,
            suggestedMappings: fieldMappings.suggestions,
            detectedHeaders: headers,
            fieldMappings: fieldMappings.mappings,
          });
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let errors: string[] = [];
        const processedItems: any[] = [];
        const duplicateMap = new Map<string, any>(); // Track duplicates for merging

        // Process data rows
        for (let i = 1; i < lines.length; i++) {
          const line: string = lines[i];
          if (!line.trim()) continue;

          try {
            const values: string[] = parseCSVLine(line as any);
            if (values.length < headers.length) {
              // Pad with empty strings for missing columns
              while (values.length < headers.length) {
                values.push('');
              }
            }

            const rowData = {};
            headers.forEach((header: string, index: number) => {
              (rowData as any)[header] = values[index] ? values[index].trim() : '';
            });

            const productData = mapRowToProduct(rowData, fieldMappings);

            if (!productData.modelCode || !productData.displayName) {
              errors.push(`Row ${i + 1}: Missing required fields (model code or name)`);
              skipped++;
              continue;
            }

            // Check for duplicates and handle gracefully
            const duplicateKey = `${productData.manufacturer}-${productData.modelCode}`;

            if (duplicateMap.has(duplicateKey)) {
              // Merge data with existing entry, filling in missing fields
              const existing = duplicateMap.get(duplicateKey);
              const merged = mergeProductData(existing, productData);
              duplicateMap.set(duplicateKey, merged);
              continue;
            }

            duplicateMap.set(duplicateKey, productData);
          } catch (error: any) {
            errors.push(`Row ${i + 1}: ${error?.message}`);
            skipped++;
          }
        }

        // Now process all unique items, checking database for existing records
        for (const [duplicateKey, productData] of Array.from(duplicateMap.entries())) {
          try {
            // Check if product already exists in database
            const existing = await storage.findMasterProduct(
              productData.manufacturer,
              productData.modelCode,
            );

            if (existing) {
              // Update existing product with new data (fill in missing fields only)
              const updateData: any = {};
              if (!existing.displayName && productData.displayName)
                updateData.displayName = productData.displayName;
              if (!existing.msrp && productData.msrp) updateData.msrp = productData.msrp;
              if (!existing.dealerCost && productData.dealerCost)
                updateData.dealerCost = productData.dealerCost;
              if (!existing.marginPercentage && productData.marginPercentage)
                updateData.marginPercentage = productData.marginPercentage;
              if (!existing.category && productData.category)
                updateData.category = productData.category;
              if (!existing.productType && productData.productType)
                updateData.productType = productData.productType;
              if (!existing.status && productData.status) updateData.status = productData.status;

              if (Object.keys(updateData).length > 0) {
                updateData.updatedAt = new Date();
                await db
                  .update(masterProductModels)
                  .set(updateData)
                  .where(eq(masterProductModels.id, existing.id));
                updated++;
                processedItems.push({
                  action: 'updated',
                  ...productData,
                  fieldsUpdated: Object.keys(updateData),
                });
              } else {
                skipped++;
                processedItems.push({
                  action: 'skipped',
                  ...productData,
                  reason: 'No new data to update',
                });
              }
            } else {
              // Create new product
              const saved = await storage.upsertMasterProduct(productData);
              if (saved) {
                created++;
                processedItems.push({ action: 'created', ...productData });
              }
            }
          } catch (error: any) {
            errors.push(`${productData.modelCode}: ${error?.message}`);
            skipped++;
          }
        }

        res.json({
          success: true,
          summary: {
            totalRows: lines.length - 1,
            created,
            updated,
            skipped,
            errors: errors.length,
          },
          fieldMappings: fieldMappings.mappings,
          processedItems: processedItems.slice(0, 10), // First 10 for preview
          errors: errors.slice(0, 10), // First 10 errors
        });
      } catch (error: any) {
        log.error('Enhanced CSV import error:', error);
        res.status(500).json({
          message: 'Failed to import CSV',
          detail: error?.message,
        });
      }
    },
  );
}
