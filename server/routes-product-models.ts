import type { Express } from 'express';
import { z } from 'zod';
import { eq, and, desc, sql, count, like } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-product-models');

import {
  productModels,
  masterProductModels,
  insertProductModelSchema,
  type ProductModel,
} from '@shared/schema';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

import { getUserId, getTenantId } from './utils/auth-helpers';
// Validation schemas for update operations
const updateProductModelSchema = z
  .object({
    productCode: z.string().min(1).optional(),
    productName: z.string().min(1).optional(),
    category: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    specifications: z.any().nullable().optional(),
    price: z.string().or(z.number()).nullable().optional(),
    costPrice: z.string().or(z.number()).nullable().optional(),
    status: z.string().optional(),
    stockQuantity: z.number().int().min(0).optional(),
    reorderLevel: z.number().int().min(0).optional(),
    weight: z.string().or(z.number()).nullable().optional(),
    dimensions: z.string().nullable().optional(),
    warrantyPeriod: z.string().nullable().optional(),
  })
  .strict();

const bulkStockUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        stockQuantity: z.number().int().min(0),
      }),
    )
    .min(1, 'At least one update is required'),
});

export function registerProductModelsRoutes(app: Express) {
  // Apply authentication and RBAC context to all product model routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/product-models', isAuthenticated, enhanceUserContext);

  // Get all product models - requires inventory item view permission
  app.get(
    '/api/product-models',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;
        const { search, category, manufacturer, status } = req.query;

        let query = db
          .select({
            id: productModels.id,
            productCode: productModels.productCode,
            productName: productModels.productName,
            category: productModels.category,
            manufacturer: productModels.manufacturer,
            description: productModels.description,
            specifications: productModels.specifications,
            price: productModels.price,
            costPrice: productModels.costPrice,
            status: productModels.status,
            stockQuantity: productModels.stockQuantity,
            reorderLevel: productModels.reorderLevel,
            weight: productModels.weight,
            dimensions: productModels.dimensions,
            warrantyPeriod: productModels.warrantyPeriod,
            createdAt: productModels.createdAt,
            updatedAt: productModels.updatedAt,
          })
          .from(productModels)
          .where(eq(productModels.tenantId, tenantId));

        // Apply filters
        if (search) {
          query = query.where(
            sql`${productModels.productName} ILIKE ${`%${search}%`} OR ${productModels.productCode} ILIKE ${`%${search}%`}`,
          );
        }

        if (category) {
          query = query.where(eq(productModels.category, category as string));
        }

        if (manufacturer) {
          query = query.where(eq(productModels.manufacturer, manufacturer as string));
        }

        if (status) {
          query = query.where(eq(productModels.status, status as string));
        }

        const models = await query.orderBy(productModels.productName);
        res.json(models);
      } catch (error) {
        log.error('Error fetching product models:', error);
        res.status(500).json({ error: 'Failed to fetch product models' });
      }
    },
  );

  // Get product model by ID - requires inventory item view permission
  app.get(
    '/api/product-models/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;
        const modelId = req.params.id;

        const [model] = await db
          .select()
          .from(productModels)
          .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)));

        if (!model) {
          return res.status(404).json({ error: 'Product model not found' });
        }

        res.json(model);
      } catch (error) {
        log.error('Error fetching product model:', error);
        res.status(500).json({ error: 'Failed to fetch product model' });
      }
    },
  );

  // Create new product model - requires inventory item create permission
  app.post(
    '/api/product-models',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.CREATE]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;

        const modelData = insertProductModelSchema.parse({
          ...req.body,
          tenantId,
          status: req.body.status || 'active',
        });

        const [newModel] = await db.insert(productModels).values(modelData).returning();

        res.status(201).json(newModel);
      } catch (error: any) {
        log.error('Error creating product model:', error);
        if (error.name === 'ZodError') {
          res.status(400).json({ error: 'Invalid data', details: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to create product model' });
        }
      }
    },
  );

  // Update product model - requires inventory item edit permission
  app.put(
    '/api/product-models/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.EDIT]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;
        const modelId = req.params.id;

        const validatedData = updateProductModelSchema.parse(req.body);

        const [updatedModel] = await db
          .update(productModels)
          .set({
            ...validatedData,
            updatedAt: new Date(),
          })
          .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)))
          .returning();

        if (!updatedModel) {
          return res.status(404).json({ error: 'Product model not found' });
        }

        res.json(updatedModel);
      } catch (error: any) {
        log.error('Error updating product model:', error);
        if (error.name === 'ZodError') {
          res.status(400).json({ error: 'Invalid data', details: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to update product model' });
        }
      }
    },
  );

  // Delete product model - requires inventory item delete permission
  app.delete(
    '/api/product-models/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.DELETE]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;
        const modelId = req.params.id;

        const [deletedModel] = await db
          .delete(productModels)
          .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)))
          .returning();

        if (!deletedModel) {
          return res.status(404).json({ error: 'Product model not found' });
        }

        res.json({ message: 'Product model deleted successfully' });
      } catch (error) {
        log.error('Error deleting product model:', error);
        res.status(500).json({ error: 'Failed to delete product model' });
      }
    },
  );

  // Get product categories - requires inventory item view permission
  app.get(
    '/api/product-models/categories',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;

        const categories = await db
          .selectDistinct({ category: productModels.category })
          .from(productModels)
          .where(
            and(eq(productModels.tenantId, tenantId), sql`${productModels.category} IS NOT NULL`),
          );

        res.json(categories.map((c) => c.category));
      } catch (error) {
        log.error('Error fetching product categories:', error);
        res.status(500).json({ error: 'Failed to fetch product categories' });
      }
    },
  );

  // Get manufacturers - requires inventory item view permission
  app.get(
    '/api/product-models/manufacturers',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;

        const manufacturers = await db
          .selectDistinct({ manufacturer: productModels.manufacturer })
          .from(productModels)
          .where(
            and(
              eq(productModels.tenantId, tenantId),
              sql`${productModels.manufacturer} IS NOT NULL`,
            ),
          );

        res.json(manufacturers.map((m) => m.manufacturer));
      } catch (error) {
        log.error('Error fetching manufacturers:', error);
        res.status(500).json({ error: 'Failed to fetch manufacturers' });
      }
    },
  );

  // Get low stock models - requires inventory item view permission
  app.get(
    '/api/product-models/low-stock',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;

        const lowStockModels = await db
          .select()
          .from(productModels)
          .where(
            and(
              eq(productModels.tenantId, tenantId),
              sql`${productModels.stockQuantity} <= ${productModels.reorderLevel}`,
            ),
          )
          .orderBy(productModels.stockQuantity);

        res.json(lowStockModels);
      } catch (error) {
        log.error('Error fetching low stock models:', error);
        res.status(500).json({ error: 'Failed to fetch low stock models' });
      }
    },
  );

  // Get product models dashboard stats - requires inventory item view permission
  app.get(
    '/api/product-models/dashboard',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;

        const totalModelsResult = await db
          .select({ count: count() })
          .from(productModels)
          .where(eq(productModels.tenantId, tenantId));

        const activeModelsResult = await db
          .select({ count: count() })
          .from(productModels)
          .where(and(eq(productModels.tenantId, tenantId), eq(productModels.status, 'active')));

        const lowStockResult = await db
          .select({ count: count() })
          .from(productModels)
          .where(
            and(
              eq(productModels.tenantId, tenantId),
              sql`${productModels.stockQuantity} <= ${productModels.reorderLevel}`,
            ),
          );

        const totalValueResult = await db
          .select({
            totalValue: sql<number>`COALESCE(SUM(${productModels.price} * ${productModels.stockQuantity}), 0)`,
          })
          .from(productModels)
          .where(eq(productModels.tenantId, tenantId));

        const totalModels = totalModelsResult[0]?.count || 0;
        const activeModels = activeModelsResult[0]?.count || 0;
        const lowStockCount = lowStockResult[0]?.count || 0;
        const totalValue = totalValueResult[0]?.totalValue || 0;

        res.json({
          totalModels,
          activeModels,
          lowStockCount,
          totalValue,
          averageValue: totalModels > 0 ? totalValue / totalModels : 0,
        });
      } catch (error) {
        log.error('Error fetching product models dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch product models dashboard' });
      }
    },
  );

  // Bulk update stock quantities - requires inventory item edit permission
  app.patch(
    '/api/product-models/bulk-stock-update',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.EDIT]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;

        const { updates } = bulkStockUpdateSchema.parse(req.body);

        const results = await Promise.all(
          updates.map(async (update) => {
            const [updatedModel] = await db
              .update(productModels)
              .set({
                stockQuantity: update.stockQuantity,
                updatedAt: new Date(),
              })
              .where(and(eq(productModels.id, update.id), eq(productModels.tenantId, tenantId)))
              .returning();

            return updatedModel;
          }),
        );

        res.json({
          message: `Updated ${results.filter((r) => r).length} product models`,
          updated: results.filter((r) => r),
        });
      } catch (error: any) {
        log.error('Error bulk updating stock:', error);
        if (error.name === 'ZodError') {
          res.status(400).json({ error: 'Invalid data', details: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to bulk update stock' });
        }
      }
    },
  );
}
