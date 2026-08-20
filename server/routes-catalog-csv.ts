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
import { storage } from './storage';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-catalog-csv');

import { insertCpcRateSchema, masterProductModels } from '@shared/schema';
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
  // Supplies Import
  // Managed Services Import
  // Product Accessories import endpoint
  // CPC Rates
  // PROD-014: the seven /api/<type>/import handlers that lived here were
  // DEAD — registerProductsCrudRoutes runs before registerCatalogCsvRoutes, so
  // its registrations won and these never ran. They have been removed rather
  // than left as a second, differently-broken copy of the same feature. The
  // live import is one loop over @shared/catalog-import in
  // server/routes-products-crud.ts.

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
        log.info('CSV file size', { bytes: file.size });
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
