import type { Express } from 'express';
import { db } from './db';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { oidMappings } from '@shared/printyx-client-schema';
import * as snmp from 'net-snmp';

/**
 * OID Management Routes
 * Provides CRUD operations for manufacturer-specific OID presets
 */

export function registerOidManagementRoutes(app: Express) {
  // ============================================================
  // OID MAPPING CRUD OPERATIONS
  // ============================================================

  /**
   * GET /api/oid-mappings
   * Get all OID mappings, optionally filtered by manufacturer
   */
  app.get('/api/oid-mappings', async (req: any, res) => {
    try {
      const { manufacturer, isDefault, isCustom } = req.query;

      let query = db.select().from(oidMappings);
      const conditions = [];

      if (manufacturer) {
        conditions.push(eq(oidMappings.manufacturer, manufacturer as string));
      }
      if (isDefault !== undefined) {
        conditions.push(eq(oidMappings.isDefault, isDefault === 'true'));
      }
      if (isCustom !== undefined) {
        conditions.push(eq(oidMappings.isCustom, isCustom === 'true'));
      }

      let mappings;
      if (conditions.length > 0) {
        mappings = await query.where(and(...conditions)).orderBy(desc(oidMappings.createdAt));
      } else {
        mappings = await query.orderBy(desc(oidMappings.createdAt));
      }

      res.json(mappings);
    } catch (error) {
      console.error('Error fetching OID mappings:', error);
      res.status(500).json({ message: 'Failed to fetch OID mappings' });
    }
  });

  /**
   * GET /api/oid-mappings/:id
   * Get a specific OID mapping by ID
   */
  app.get('/api/oid-mappings/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      const mapping = await db
        .select()
        .from(oidMappings)
        .where(eq(oidMappings.id, parseInt(id)))
        .limit(1);

      if (!mapping[0]) {
        return res.status(404).json({ message: 'OID mapping not found' });
      }

      res.json(mapping[0]);
    } catch (error) {
      console.error('Error fetching OID mapping:', error);
      res.status(500).json({ message: 'Failed to fetch OID mapping' });
    }
  });

  /**
   * POST /api/oid-mappings
   * Create a new OID mapping
   */
  app.post('/api/oid-mappings', async (req: any, res) => {
    try {
      const { manufacturer, modelSeries, mappingName, oids, description, isDefault } = req.body;
      const userId = req.user?.id;

      // Validation
      if (!manufacturer || !mappingName || !oids) {
        return res.status(400).json({
          message: 'Missing required fields: manufacturer, mappingName, and oids are required',
        });
      }

      // If setting as default, unset other defaults for this manufacturer
      if (isDefault) {
        await db
          .update(oidMappings)
          .set({ isDefault: false })
          .where(
            and(
              eq(oidMappings.manufacturer, manufacturer),
              eq(oidMappings.isDefault, true),
            ),
          );
      }

      const [mapping] = await db
        .insert(oidMappings)
        .values({
          manufacturer,
          modelSeries: modelSeries || null,
          mappingName,
          oids,
          description: description || null,
          isDefault: isDefault || false,
          isCustom: true,
          createdBy: userId || null,
        })
        .returning();

      res.status(201).json(mapping);
    } catch (error) {
      console.error('Error creating OID mapping:', error);
      res.status(500).json({ message: 'Failed to create OID mapping' });
    }
  });

  /**
   * PUT /api/oid-mappings/:id
   * Update an existing OID mapping
   */
  app.put('/api/oid-mappings/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { manufacturer, modelSeries, mappingName, oids, description, isDefault } = req.body;

      // Check if mapping exists
      const existing = await db
        .select()
        .from(oidMappings)
        .where(eq(oidMappings.id, parseInt(id)))
        .limit(1);

      if (!existing[0]) {
        return res.status(404).json({ message: 'OID mapping not found' });
      }

      // If setting as default, unset other defaults for this manufacturer
      if (isDefault && manufacturer) {
        await db
          .update(oidMappings)
          .set({ isDefault: false })
          .where(
            and(
              eq(oidMappings.manufacturer, manufacturer),
              eq(oidMappings.isDefault, true),
              sql`${oidMappings.id} != ${parseInt(id)}`,
            ),
          );
      }

      const [updated] = await db
        .update(oidMappings)
        .set({
          manufacturer: manufacturer || existing[0].manufacturer,
          modelSeries: modelSeries !== undefined ? modelSeries : existing[0].modelSeries,
          mappingName: mappingName || existing[0].mappingName,
          oids: oids || existing[0].oids,
          description: description !== undefined ? description : existing[0].description,
          isDefault: isDefault !== undefined ? isDefault : existing[0].isDefault,
          updatedAt: new Date(),
        })
        .where(eq(oidMappings.id, parseInt(id)))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error updating OID mapping:', error);
      res.status(500).json({ message: 'Failed to update OID mapping' });
    }
  });

  /**
   * DELETE /api/oid-mappings/:id
   * Delete an OID mapping
   */
  app.delete('/api/oid-mappings/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      // Check if mapping exists
      const existing = await db
        .select()
        .from(oidMappings)
        .where(eq(oidMappings.id, parseInt(id)))
        .limit(1);

      if (!existing[0]) {
        return res.status(404).json({ message: 'OID mapping not found' });
      }

      // Prevent deletion of system presets (non-custom)
      if (!existing[0].isCustom) {
        return res.status(403).json({
          message: 'System presets cannot be deleted. You can only delete custom mappings.',
        });
      }

      await db.delete(oidMappings).where(eq(oidMappings.id, parseInt(id)));

      res.json({ message: 'OID mapping deleted successfully' });
    } catch (error) {
      console.error('Error deleting OID mapping:', error);
      res.status(500).json({ message: 'Failed to delete OID mapping' });
    }
  });

  // ============================================================
  // OID TESTING ENDPOINT
  // ============================================================

  /**
   * POST /api/oid-mappings/test
   * Test OID mappings against a real device
   */
  app.post('/api/oid-mappings/test', async (req: any, res) => {
    try {
      const {
        ipAddress,
        oids,
        snmpCommunity = 'public',
        snmpVersion = '2c',
        snmpPort = 161,
        timeout = 10000,
      } = req.body;

      if (!ipAddress || !oids) {
        return res.status(400).json({
          message: 'Missing required fields: ipAddress and oids are required',
        });
      }

      // Convert snmpVersion string to enum
      let version = snmp.Version2c;
      if (snmpVersion === '1') version = snmp.Version1;
      else if (snmpVersion === '3') version = snmp.Version3;

      // Create SNMP session
      const session = snmp.createSession(ipAddress, snmpCommunity, {
        port: snmpPort,
        retries: 3,
        timeout: timeout,
        version: version,
      });

      // Test each OID
      const results: any = {};
      const oidArray = Object.entries(oids);

      try {
        for (const [key, oid] of oidArray) {
          try {
            await new Promise((resolve, reject) => {
              session.get([oid as string], (error, varbinds) => {
                if (error) {
                  results[key] = {
                    oid: oid,
                    status: 'error',
                    error: error.message,
                    value: null,
                  };
                  resolve(null);
                } else if (varbinds && varbinds.length > 0) {
                  const varbind = varbinds[0];
                  if (snmp.isVarbindError(varbind)) {
                    results[key] = {
                      oid: oid,
                      status: 'error',
                      error: snmp.varbindError(varbind),
                      value: null,
                    };
                  } else {
                    results[key] = {
                      oid: oid,
                      status: 'success',
                      value: varbind.value.toString(),
                      type: typeof varbind.value,
                    };
                  }
                  resolve(null);
                } else {
                  results[key] = {
                    oid: oid,
                    status: 'error',
                    error: 'No response',
                    value: null,
                  };
                  resolve(null);
                }
              });
            });
          } catch (oidError) {
            results[key] = {
              oid: oid,
              status: 'error',
              error: oidError instanceof Error ? oidError.message : 'Unknown error',
              value: null,
            };
          }
        }

        session.close();

        // Calculate success rate
        const successCount = Object.values(results).filter(
          (r: any) => r.status === 'success',
        ).length;
        const totalCount = Object.keys(results).length;
        const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

        res.json({
          message: 'OID test completed',
          device: {
            ipAddress,
            snmpVersion,
            snmpCommunity: snmpCommunity.replace(/./g, '*'), // Mask community string
          },
          results,
          summary: {
            total: totalCount,
            successful: successCount,
            failed: totalCount - successCount,
            successRate: Math.round(successRate),
          },
        });
      } catch (testError) {
        session.close();
        throw testError;
      }
    } catch (error) {
      console.error('Error testing OIDs:', error);
      res.status(500).json({
        message: 'Failed to test OIDs',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================================
  // IMPORT/EXPORT ENDPOINTS
  // ============================================================

  /**
   * POST /api/oid-mappings/export
   * Export OID mappings to JSON
   */
  app.post('/api/oid-mappings/export', async (req: any, res) => {
    try {
      const { ids, manufacturer } = req.body;

      let mappings;

      if (ids && Array.isArray(ids)) {
        // Export specific mappings by ID
        mappings = await db
          .select()
          .from(oidMappings)
          .where(sql`${oidMappings.id} = ANY(${ids})`);
      } else if (manufacturer) {
        // Export all mappings for a manufacturer
        mappings = await db
          .select()
          .from(oidMappings)
          .where(eq(oidMappings.manufacturer, manufacturer));
      } else {
        // Export all mappings
        mappings = await db.select().from(oidMappings);
      }

      // Remove internal fields
      const exportData = mappings.map((m) => ({
        manufacturer: m.manufacturer,
        modelSeries: m.modelSeries,
        mappingName: m.mappingName,
        oids: m.oids,
        description: m.description,
        isDefault: m.isDefault,
      }));

      res.json({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        count: exportData.length,
        mappings: exportData,
      });
    } catch (error) {
      console.error('Error exporting OID mappings:', error);
      res.status(500).json({ message: 'Failed to export OID mappings' });
    }
  });

  /**
   * POST /api/oid-mappings/import
   * Import OID mappings from JSON
   */
  app.post('/api/oid-mappings/import', async (req: any, res) => {
    try {
      const { mappings, overwriteExisting = false } = req.body;
      const userId = req.user?.id;

      if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({
          message: 'Invalid import data. Expected an array of mappings.',
        });
      }

      const imported = [];
      const skipped = [];
      const errors = [];

      for (const mapping of mappings) {
        try {
          // Validate required fields
          if (!mapping.manufacturer || !mapping.mappingName || !mapping.oids) {
            errors.push({
              mapping: mapping.mappingName || 'Unknown',
              error: 'Missing required fields (manufacturer, mappingName, oids)',
            });
            continue;
          }

          // Check if mapping already exists
          const existing = await db
            .select()
            .from(oidMappings)
            .where(
              and(
                eq(oidMappings.manufacturer, mapping.manufacturer),
                eq(oidMappings.mappingName, mapping.mappingName),
              ),
            )
            .limit(1);

          if (existing[0]) {
            if (overwriteExisting) {
              // Update existing mapping
              await db
                .update(oidMappings)
                .set({
                  modelSeries: mapping.modelSeries || null,
                  oids: mapping.oids,
                  description: mapping.description || null,
                  isDefault: mapping.isDefault || false,
                  updatedAt: new Date(),
                })
                .where(eq(oidMappings.id, existing[0].id));

              imported.push({
                manufacturer: mapping.manufacturer,
                mappingName: mapping.mappingName,
                action: 'updated',
              });
            } else {
              skipped.push({
                manufacturer: mapping.manufacturer,
                mappingName: mapping.mappingName,
                reason: 'Already exists',
              });
            }
          } else {
            // Create new mapping
            await db.insert(oidMappings).values({
              manufacturer: mapping.manufacturer,
              modelSeries: mapping.modelSeries || null,
              mappingName: mapping.mappingName,
              oids: mapping.oids,
              description: mapping.description || null,
              isDefault: mapping.isDefault || false,
              isCustom: true,
              createdBy: userId || null,
            });

            imported.push({
              manufacturer: mapping.manufacturer,
              mappingName: mapping.mappingName,
              action: 'created',
            });
          }
        } catch (mappingError) {
          errors.push({
            mapping: mapping.mappingName || 'Unknown',
            error: mappingError instanceof Error ? mappingError.message : 'Unknown error',
          });
        }
      }

      res.json({
        message: 'Import completed',
        summary: {
          total: mappings.length,
          imported: imported.length,
          skipped: skipped.length,
          errors: errors.length,
        },
        details: {
          imported,
          skipped,
          errors,
        },
      });
    } catch (error) {
      console.error('Error importing OID mappings:', error);
      res.status(500).json({ message: 'Failed to import OID mappings' });
    }
  });

  // ============================================================
  // UTILITY ENDPOINTS
  // ============================================================

  /**
   * GET /api/oid-mappings/manufacturers
   * Get list of unique manufacturers
   */
  app.get('/api/oid-mappings/manufacturers', async (req: any, res) => {
    try {
      const manufacturers = await db
        .selectDistinct({ manufacturer: oidMappings.manufacturer })
        .from(oidMappings)
        .orderBy(oidMappings.manufacturer);

      res.json(manufacturers.map((m) => m.manufacturer));
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      res.status(500).json({ message: 'Failed to fetch manufacturers' });
    }
  });

  /**
   * GET /api/oid-mappings/default/:manufacturer
   * Get default OID mapping for a manufacturer
   */
  app.get('/api/oid-mappings/default/:manufacturer', async (req: any, res) => {
    try {
      const { manufacturer } = req.params;

      const mapping = await db
        .select()
        .from(oidMappings)
        .where(
          and(
            eq(oidMappings.manufacturer, manufacturer),
            eq(oidMappings.isDefault, true),
          ),
        )
        .limit(1);

      if (!mapping[0]) {
        return res.status(404).json({
          message: `No default OID mapping found for manufacturer: ${manufacturer}`,
        });
      }

      res.json(mapping[0]);
    } catch (error) {
      console.error('Error fetching default mapping:', error);
      res.status(500).json({ message: 'Failed to fetch default mapping' });
    }
  });
}
