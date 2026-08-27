import type { Express } from 'express';
import { eq, and, sql, count } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-product-models');

import { productModels, insertProductModelSchema } from '@shared/schema';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

import { authed } from './utils/auth-helpers';
import { badRequest, notFound, serverError } from './lib/error-response';
// QUALITY-002 (batch: phantom-shape server file). This file was written against
// a product_models table that does not exist. The real one (shared/schema.ts) is
// an equipment CATALOGUE - productCode, productName, category, manufacturer,
// description, msrp, colorMode, colorSpeed, bwSpeed, productFamily,
// requiredAccessories, three pricing tiers (new / upgrade / lexmark) and
// isActive. It has no specifications, price, costPrice, status, stockQuantity,
// reorderLevel, weight, dimensions or warrantyPeriod.
//
// Stock is not a missing column here, it is a different table:
// inventory_items (shared/schema.ts:1987) carries quantityOnHand and
// reorderPoint for parts and consumables, keyed by partNumber, with no FK to
// product_models. So the low-stock endpoint, the stock half of the dashboard and
// the bulk-stock-update endpoint could not be repointed - there is nothing to
// point them at - and they are removed rather than faked. None had a caller in
// client/src.
//
// The update schema below is derived from the table instead of being hand-listed,
// so it cannot drift from it again. It was .strict() over the nine phantom names
// and NONE of the real ones, which meant a PUT carrying any real field was a 400.
const updateProductModelSchema = insertProductModelSchema
  .omit({ tenantId: true })
  .partial()
  .strict();

export function registerProductModelsRoutes(app: Express) {
  // Apply authentication and RBAC context to all product model routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/product-models', isAuthenticated, enhanceUserContext);

  // Get all product models - requires inventory item view permission
  app.get(
    '/api/product-models',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;
        const { search, category, manufacturer, status } = req.query;

        // Filters are collected and ANDed once. They used to be applied by
        // calling query.where() again per filter, and drizzle's where() ASSIGNS
        // rather than ANDs - `this.config.where = where` in
        // pg-core/query-builders/select.js - so each filter REPLACED the
        // predicate before it, starting with the tenant scope. Any request with
        // ?category= or ?manufacturer= would have read every tenant's catalogue.
        // It never got that far only because the projection above named nine
        // columns that do not exist, so the query threw first.
        const filters = [eq(productModels.tenantId, tenantId)];

        if (search) {
          filters.push(
            sql`(${productModels.productName} ILIKE ${`%${search}%`} OR ${productModels.productCode} ILIKE ${`%${search}%`})`,
          );
        }
        if (category) {
          filters.push(eq(productModels.category, category as string));
        }
        if (manufacturer) {
          filters.push(eq(productModels.manufacturer, manufacturer as string));
        }
        // ?status=active|inactive maps onto is_active; there is no status column.
        if (status === 'active' || status === 'inactive') {
          filters.push(eq(productModels.isActive, status === 'active'));
        }

        // Whole row: ProductModels.tsx reads msrp, colorMode, colorSpeed,
        // bwSpeed, requiredAccessories, isActive and all three rep prices, none
        // of which the old projection returned.
        const models = await db
          .select()
          .from(productModels)
          .where(and(...filters))
          .orderBy(productModels.productName);
        res.json(models);
      } catch (error) {
        log.error('Error fetching product models:', error);
        serverError(res, 'Failed to fetch product models');
      }
    }),
  );

  // ROUTE ORDER IS LOAD-BEARING. These three static sub-paths were registered
  // AFTER /api/product-models/:id, and express matches in registration order, so
  // /categories, /manufacturers and /dashboard were all being served by the :id
  // handler with id set to the literal word - a guaranteed 404 for each. Keep
  // them above :id.
  // Get product categories - requires inventory item view permission
  app.get(
    '/api/product-models/categories',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

        const categories = await db
          .selectDistinct({ category: productModels.category })
          .from(productModels)
          .where(
            and(eq(productModels.tenantId, tenantId), sql`${productModels.category} IS NOT NULL`),
          );

        res.json(categories.map((c) => c.category));
      } catch (error) {
        log.error('Error fetching product categories:', error);
        serverError(res, 'Failed to fetch product categories');
      }
    }),
  );

  // Get manufacturers - requires inventory item view permission
  app.get(
    '/api/product-models/manufacturers',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

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
        serverError(res, 'Failed to fetch manufacturers');
      }
    }),
  );

  // The /low-stock endpoint that stood here is REMOVED, not repointed. It read
  // productModels.stockQuantity <= productModels.reorderLevel; neither column
  // exists, and there is nothing on product_models to substitute. Stock lives on
  // inventory_items (quantityOnHand / reorderPoint), a parts table keyed by
  // partNumber with no relationship to the equipment catalogue, so this is not a
  // rename away from working. Nothing in client/src called it. A real low-stock
  // report belongs on the inventory routes.

  // Get product models dashboard stats - requires inventory item view permission
  app.get(
    '/api/product-models/dashboard',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

        const totalModelsResult = await db
          .select({ count: count() })
          .from(productModels)
          .where(eq(productModels.tenantId, tenantId));

        // is_active, not a status string.
        const activeModelsResult = await db
          .select({ count: count() })
          .from(productModels)
          .where(and(eq(productModels.tenantId, tenantId), eq(productModels.isActive, true)));

        // MSRP is the only price on the catalogue row, so this is the list value
        // of the catalogue, NOT inventory value. lowStockCount, totalValue and
        // averageValue as they stood multiplied price by stockQuantity - neither
        // column exists, and without a quantity there is no inventory value to
        // report. Reporting the catalogue figure under its own name beats
        // reporting an inventory figure that is really a catalogue one.
        const msrpResult = await db
          .select({
            totalMsrp: sql<string>`COALESCE(SUM(${productModels.msrp}), 0)`,
          })
          .from(productModels)
          .where(eq(productModels.tenantId, tenantId));

        const totalModels = totalModelsResult[0]?.count || 0;
        const activeModels = activeModelsResult[0]?.count || 0;
        // msrp is numeric; node-postgres returns numeric as a string.
        const totalMsrp = Number(msrpResult[0]?.totalMsrp ?? 0);

        res.json({
          totalModels,
          activeModels,
          totalMsrp,
          averageMsrp: totalModels > 0 ? totalMsrp / totalModels : 0,
        });
      } catch (error) {
        log.error('Error fetching product models dashboard:', error);
        serverError(res, 'Failed to fetch product models dashboard');
      }
    }),
  );

  // Get product model by ID - requires inventory item view permission
  app.get(
    '/api/product-models/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;
        const modelId = req.params.id;

        const [model] = await db
          .select()
          .from(productModels)
          .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)));

        if (!model) {
          return notFound(res, 'Product model not found');
        }

        res.json(model);
      } catch (error) {
        log.error('Error fetching product model:', error);
        serverError(res, 'Failed to fetch product model');
      }
    }),
  );

  // Create new product model - requires inventory item create permission
  app.post(
    '/api/product-models',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.CREATE]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

        // No `status` default: product_models has no status column, so the key
        // was stripped by the schema and defaulted nothing. isActive carries its
        // own database default.
        const modelData = insertProductModelSchema.parse({ ...req.body, tenantId });

        const [newModel] = await db.insert(productModels).values(modelData).returning();

        res.status(201).json(newModel);
      } catch (error: any) {
        log.error('Error creating product model:', error);
        if (error.name === 'ZodError') {
          badRequest(res, 'Invalid data', { details: error.errors });
        } else {
          serverError(res, 'Failed to create product model');
        }
      }
    }),
  );

  // Update product model - requires inventory item edit permission.
  //
  // Registered for BOTH verbs. ProductModels.tsx sends PATCH
  // (updateModelMutation), and only PUT was mounted, so every edit from the page
  // 404'd in dev. The body is a partial either way - the schema has always been
  // all-optional - so one handler serves both rather than PUT claiming to be a
  // full replacement it never validated as one.
  const updateProductModelHandler = authed(async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = req.user!.tenantId;
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
        return notFound(res, 'Product model not found');
      }

      res.json(updatedModel);
    } catch (error: any) {
      log.error('Error updating product model:', error);
      if (error.name === 'ZodError') {
        badRequest(res, 'Invalid data', { details: error.errors });
      } else {
        serverError(res, 'Failed to update product model');
      }
    }
  });

  for (const register of [app.put.bind(app), app.patch.bind(app)]) {
    register(
      '/api/product-models/:id',
      isAuthenticated,
      requirePermission([PERMISSIONS.INVENTORY.ITEM.UPDATE]),
      updateProductModelHandler,
    );
  }

  // Delete product model - requires inventory item delete permission
  app.delete(
    '/api/product-models/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.ITEM.DELETE]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;
        const modelId = req.params.id;

        const [deletedModel] = await db
          .delete(productModels)
          .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)))
          .returning();

        if (!deletedModel) {
          return notFound(res, 'Product model not found');
        }

        res.json({ message: 'Product model deleted successfully' });
      } catch (error) {
        log.error('Error deleting product model:', error);
        serverError(res, 'Failed to delete product model');
      }
    }),
  );

  // The /bulk-stock-update endpoint that stood here is REMOVED for the same
  // reason as /low-stock: it wrote productModels.stockQuantity, a column that
  // does not exist, so drizzle dropped the key and every "update" was a no-op
  // that answered 200 with a count of rows it had not changed. Nothing called
  // it. Bulk stock adjustment belongs on inventory_items.
}
