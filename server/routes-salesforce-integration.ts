// Salesforce Integration API Routes
// Handles dual-platform data import: E-Automate compatibility + Salesforce integration

import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "./replitAuth";
import { db } from "./db";
import { businessRecords, enhancedContacts, opportunities, enhancedProducts } from "@shared/schema";
import { SalesforceDataTransformer, SALESFORCE_FIELD_MAPPINGS } from "./salesforce-mapping";
import { eq, and } from "drizzle-orm";

// Request validation schemas
const salesforceImportSchema = z.object({
  objectType: z.enum(['Account', 'Contact', 'Lead', 'Opportunity', 'Product2']),
  records: z.array(z.record(z.any())),
  batchSize: z.number().default(100),
  skipDuplicates: z.boolean().default(true)
});

const salesforceSyncStatusSchema = z.object({
  objectType: z.string(),
  lastSyncDate: z.string().optional()
});

export function registerSalesforceRoutes(app: Express) {
  
  // Import Salesforce data batch
  app.post("/api/salesforce/import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { objectType, records, batchSize, skipDuplicates } = salesforceImportSchema.parse(req.body);
      
      // Get field mapping for this Salesforce object
      const mapping = SalesforceDataTransformer.getMappingForObject(objectType);
      if (!mapping) {
        return res.status(400).json({ error: `No mapping configuration found for ${objectType}` });
      }

      const results = {
        totalRecords: records.length,
        successCount: 0,
        errorCount: 0,
        duplicateCount: 0,
        errors: [] as any[]
      };

      // Process records in batches
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            // Validate required fields
            const validationErrors = SalesforceDataTransformer.validateRequiredFields(record, mapping);
            if (validationErrors.length > 0) {
              results.errors.push({
                record: record[mapping.primaryKey],
                errors: validationErrors
              });
              results.errorCount++;
              continue;
            }

            // Transform Salesforce record to Printyx format
            const transformedRecord = SalesforceDataTransformer.transformRecord(
              record, 
              mapping, 
              'default-tenant' // TODO: Get from user context
            );

            // Check for duplicates if enabled
            if (skipDuplicates) {
              const existingRecord = await checkForDuplicate(mapping, record, transformedRecord);
              if (existingRecord) {
                results.duplicateCount++;
                continue;
              }
            }

            // Insert record into appropriate table
            await insertRecord(mapping.printixTable, transformedRecord);
            results.successCount++;

          } catch (error) {
            console.error(`Error processing record ${record[mapping.primaryKey]}:`, error);
            results.errors.push({
              record: record[mapping.primaryKey],
              error: error.message
            });
            results.errorCount++;
          }
        }
      }

      res.json({
        message: `Salesforce ${objectType} import completed`,
        results
      });

    } catch (error) {
      console.error("Salesforce import error:", error);
      res.status(500).json({ error: "Internal server error during import" });
    }
  });

  // Get Salesforce sync status
  app.get("/api/salesforce/sync-status", isAuthenticated, async (req, res) => {
    try {
      const syncStatus = await db.execute(`
        SELECT 
          'business_records' as table_name,
          COUNT(*) as total_records,
          COUNT(CASE WHEN external_salesforce_id IS NOT NULL THEN 1 END) as salesforce_records,
          MAX(last_sync_date) as last_sync_date
        FROM business_records
        WHERE external_system_id = 'salesforce'
        
        UNION ALL
        
        SELECT 
          'enhanced_contacts' as table_name,
          COUNT(*) as total_records,
          COUNT(CASE WHEN external_contact_id IS NOT NULL THEN 1 END) as salesforce_records,
          MAX(last_sync_date) as last_sync_date
        FROM enhanced_contacts
        
        UNION ALL
        
        SELECT 
          'opportunities' as table_name,
          COUNT(*) as total_records,
          COUNT(CASE WHEN external_opportunity_id IS NOT NULL THEN 1 END) as salesforce_records,
          MAX(last_sync_date) as last_sync_date
        FROM opportunities
        
        UNION ALL
        
        SELECT 
          'enhanced_products' as table_name,
          COUNT(*) as total_records,
          COUNT(CASE WHEN external_product_id IS NOT NULL THEN 1 END) as salesforce_records,
          MAX(last_sync_date) as last_sync_date
        FROM enhanced_products
      `);

      res.json({ syncStatus });

    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ error: "Failed to fetch sync status" });
    }
  });

  // Get field mappings for a Salesforce object
  app.get("/api/salesforce/field-mappings/:objectType", isAuthenticated, async (req, res) => {
    try {
      const { objectType } = req.params;
      
      const mapping = SalesforceDataTransformer.getMappingForObject(objectType);
      if (!mapping) {
        return res.status(404).json({ error: `No mapping found for ${objectType}` });
      }

      res.json({
        objectType,
        printixTable: mapping.printixTable,
        fieldMappings: mapping.fields
      });

    } catch (error) {
      console.error("Error fetching field mappings:", error);
      res.status(500).json({ error: "Failed to fetch field mappings" });
    }
  });

  // Get all available Salesforce object mappings
  app.get("/api/salesforce/mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = SALESFORCE_FIELD_MAPPINGS.map(mapping => ({
        salesforceObject: mapping.salesforceObject,
        printixTable: mapping.printixTable,
        fieldCount: mapping.fields.length
      }));

      res.json({ mappings });

    } catch (error) {
      console.error("Error fetching mappings:", error);
      res.status(500).json({ error: "Failed to fetch mappings" });
    }
  });

  // Preview Salesforce data transformation
  app.post("/api/salesforce/preview-transform", isAuthenticated, async (req, res) => {
    try {
      const { objectType, sampleRecord } = req.body;
      
      const mapping = SalesforceDataTransformer.getMappingForObject(objectType);
      if (!mapping) {
        return res.status(400).json({ error: `No mapping configuration found for ${objectType}` });
      }

      const transformedRecord = SalesforceDataTransformer.transformRecord(
        sampleRecord, 
        mapping, 
        'preview-tenant'
      );

      res.json({
        originalRecord: sampleRecord,
        transformedRecord,
        targetTable: mapping.printixTable
      });

    } catch (error) {
      console.error("Error previewing transformation:", error);
      res.status(500).json({ error: "Failed to preview transformation" });
    }
  });

  // Delete Salesforce imported data (for testing/cleanup)
  app.delete("/api/salesforce/cleanup/:objectType", isAuthenticated, async (req, res) => {
    try {
      const { objectType } = req.params;
      
      const mapping = SalesforceDataTransformer.getMappingForObject(objectType);
      if (!mapping) {
        return res.status(404).json({ error: `No mapping found for ${objectType}` });
      }

      let deletedCount = 0;

      // Delete from appropriate table based on mapping
      switch (mapping.printixTable) {
        case 'business_records':
          const businessResult = await db.delete(businessRecords)
            .where(eq(businessRecords.externalSystemId, 'salesforce'));
          deletedCount = businessResult.rowCount || 0;
          break;

        case 'enhanced_contacts':
          const contactsResult = await db.delete(enhancedContacts)
            .where(eq(enhancedContacts.migrationStatus, 'completed'));
          deletedCount = contactsResult.rowCount || 0;
          break;

        case 'opportunities':
          const opportunitiesResult = await db.delete(opportunities)
            .where(eq(opportunities.migrationStatus, 'completed'));
          deletedCount = opportunitiesResult.rowCount || 0;
          break;

        case 'enhanced_products':
          const productsResult = await db.delete(enhancedProducts)
            .where(eq(enhancedProducts.migrationStatus, 'completed'));
          deletedCount = productsResult.rowCount || 0;
          break;
      }

      res.json({
        message: `Deleted ${deletedCount} ${objectType} records from ${mapping.printixTable}`,
        deletedCount
      });

    } catch (error) {
      console.error("Error during cleanup:", error);
      res.status(500).json({ error: "Failed to cleanup data" });
    }
  });
}

// Helper function to check for duplicate records
async function checkForDuplicate(mapping: any, salesforceRecord: any, transformedRecord: any): Promise<boolean> {
  try {
    switch (mapping.printixTable) {
      case 'business_records':
        const existingBusiness = await db.select()
          .from(businessRecords)
          .where(
            and(
              eq(businessRecords.externalSalesforceId, salesforceRecord.Id),
              eq(businessRecords.tenantId, transformedRecord.tenantId)
            )
          )
          .limit(1);
        return existingBusiness.length > 0;

      case 'enhanced_contacts':
        const existingContact = await db.select()
          .from(enhancedContacts)
          .where(
            and(
              eq(enhancedContacts.externalContactId, salesforceRecord.Id),
              eq(enhancedContacts.tenantId, transformedRecord.tenantId)
            )
          )
          .limit(1);
        return existingContact.length > 0;

      case 'opportunities':
        const existingOpportunity = await db.select()
          .from(opportunities)
          .where(
            and(
              eq(opportunities.externalOpportunityId, salesforceRecord.Id),
              eq(opportunities.tenantId, transformedRecord.tenantId)
            )
          )
          .limit(1);
        return existingOpportunity.length > 0;

      case 'enhanced_products':
        const existingProduct = await db.select()
          .from(enhancedProducts)
          .where(
            and(
              eq(enhancedProducts.externalProductId, salesforceRecord.Id),
              eq(enhancedProducts.tenantId, transformedRecord.tenantId)
            )
          )
          .limit(1);
        return existingProduct.length > 0;

      default:
        return false;
    }
  } catch (error) {
    console.error("Error checking for duplicate:", error);
    return false;
  }
}

// Helper function to insert records into appropriate table
async function insertRecord(tableName: string, record: any): Promise<void> {
  switch (tableName) {
    case 'business_records':
      await db.insert(businessRecords).values(record);
      break;

    case 'enhanced_contacts':
      await db.insert(enhancedContacts).values(record);
      break;

    case 'opportunities':
      await db.insert(opportunities).values(record);
      break;

    case 'enhanced_products':
      await db.insert(enhancedProducts).values(record);
      break;

    default:
      throw new Error(`Unknown table: ${tableName}`);
  }
}

export default { registerSalesforceRoutes };