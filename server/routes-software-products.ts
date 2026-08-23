import type { Express } from 'express';
import { eq, and, sql, count, inArray } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-software-products');

import { softwareProducts, insertSoftwareProductSchema } from '@shared/schema';

export function registerSoftwareProductsRoutes(app: Express) {
  // Get all software products
  app.get('/api/software-products', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { search, category, vendor, status } = req.query;

      // Filters are collected and ANDed once. They used to be applied by calling
      // query.where() again per filter, and drizzle's where() ASSIGNS rather
      // than ANDs, so each filter REPLACED the predicate before it - starting
      // with the tenant scope. A request with ?category= would have read every
      // tenant's software catalogue. It never got that far only because the
      // projection named seven columns that do not exist and the query threw
      // first. npm run check:chained-where now gates this shape.
      const filters = [eq(softwareProducts.tenantId, tenantId)];

      if (search) {
        filters.push(
          sql`(${softwareProducts.productName} ILIKE ${`%${search}%`} OR ${softwareProducts.productCode} ILIKE ${`%${search}%`})`,
        );
      }
      if (category) {
        filters.push(eq(softwareProducts.category, category as string));
      }
      if (vendor) {
        filters.push(eq(softwareProducts.vendor, vendor as string));
      }
      // ?status=active|inactive maps onto is_active; software_products has no
      // status column, nor version, price, costPrice, licenseType,
      // supportIncluded or systemRequirements. Its real shape is the same
      // catalogue shape as product_models: productType, accessoryType, summary,
      // isActive and three pricing tiers (standard / new / upgrade).
      if (status === 'active' || status === 'inactive') {
        filters.push(eq(softwareProducts.isActive, status === 'active'));
      }

      const products = await db
        .select()
        .from(softwareProducts)
        .where(and(...filters))
        .orderBy(softwareProducts.productName);
      res.json(products);
    } catch (error) {
      log.error('Error fetching software products:', error);
      res.status(500).json({ error: 'Failed to fetch software products' });
    }
  });

  // ROUTE ORDER IS LOAD-BEARING. /categories, /vendors and /dashboard were
  // registered AFTER /api/software-products/:id, and express matches in
  // registration order, so all three were served by the :id handler with id set
  // to the literal word - a guaranteed 404 each. (The DELETE /bulk-delete route
  // below was already ordered correctly, which is why only the GETs were dead.)
  // Keep these above :id.
  // Get software categories
  app.get('/api/software-products/categories', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const categories = await db
        .selectDistinct({ category: softwareProducts.category })
        .from(softwareProducts)
        .where(
          and(
            eq(softwareProducts.tenantId, tenantId),
            sql`${softwareProducts.category} IS NOT NULL`,
          ),
        );

      res.json(categories.map((c) => c.category));
    } catch (error) {
      log.error('Error fetching software categories:', error);
      res.status(500).json({ error: 'Failed to fetch software categories' });
    }
  });

  // Get vendors
  app.get('/api/software-products/vendors', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const vendors = await db
        .selectDistinct({ vendor: softwareProducts.vendor })
        .from(softwareProducts)
        .where(
          and(eq(softwareProducts.tenantId, tenantId), sql`${softwareProducts.vendor} IS NOT NULL`),
        );

      res.json(vendors.map((v) => v.vendor));
    } catch (error) {
      log.error('Error fetching vendors:', error);
      res.status(500).json({ error: 'Failed to fetch vendors' });
    }
  });

  // /license-types and /by-license-type are REMOVED. Both grouped on
  // softwareProducts.licenseType, a column the table does not have, so each was
  // a guaranteed runtime error; neither had a caller in client/src. The nearest
  // real column is paymentType, but mapping "license type" onto "payment type"
  // is a guess about what two vocabularies meant to each other, and inventing
  // that correspondence in a reporting endpoint is how fabricated categories
  // end up in a dashboard. If licence terms need reporting, the column to add
  // is licenseType - not a rename of paymentType.

  // Get software products dashboard stats
  app.get('/api/software-products/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const totalProductsResult = await db
        .select({ count: count() })
        .from(softwareProducts)
        .where(eq(softwareProducts.tenantId, tenantId));

      // is_active, not a status string.
      const activeProductsResult = await db
        .select({ count: count() })
        .from(softwareProducts)
        .where(and(eq(softwareProducts.tenantId, tenantId), eq(softwareProducts.isActive, true)));

      // licensedProducts, totalValue and averagePrice are GONE, not repointed.
      // They read softwareProducts.licenseType and softwareProducts.price, and
      // the table has neither. There is also no single price to substitute: the
      // catalogue carries three independent tiers (standardRepPrice,
      // newRepPrice, upgradeRepPrice), so "the total value of the software
      // catalogue" is not a defined quantity until someone says which tier they
      // mean. Reporting one tier under a name that implies all of them would be
      // worse than not reporting it.
      const totalProducts = totalProductsResult[0]?.count || 0;
      const activeProducts = activeProductsResult[0]?.count || 0;

      res.json({ totalProducts, activeProducts });
    } catch (error) {
      log.error('Error fetching software products dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch software products dashboard' });
    }
  });

  // Get software product by ID
  app.get('/api/software-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const productId = req.params.id;

      const [product] = await db
        .select()
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenantId, tenantId)));

      if (!product) {
        return res.status(404).json({ error: 'Software product not found' });
      }

      res.json(product);
    } catch (error) {
      log.error('Error fetching software product:', error);
      res.status(500).json({ error: 'Failed to fetch software product' });
    }
  });

  // Create new software product
  app.post('/api/software-products', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const productData = insertSoftwareProductSchema.parse({
        ...req.body,
        tenantId,
        status: req.body.status || 'active',
      });

      const [newProduct] = await db.insert(softwareProducts).values(productData).returning();

      res.status(201).json(newProduct);
    } catch (error) {
      log.error('Error creating software product:', error);
      res.status(500).json({ error: 'Failed to create software product' });
    }
  });

  // Update software product
  app.put('/api/software-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const productId = req.params.id;

      const [updatedProduct] = await db
        .update(softwareProducts)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenantId, tenantId)))
        .returning();

      if (!updatedProduct) {
        return res.status(404).json({ error: 'Software product not found' });
      }

      res.json(updatedProduct);
    } catch (error) {
      log.error('Error updating software product:', error);
      res.status(500).json({ error: 'Failed to update software product' });
    }
  });

  // Bulk delete software products (must be registered before the :id route so
  // "bulk-delete" is not captured as an :id). Ported from routes-products-crud
  // with authentication added (CR-018).
  app.delete('/api/software-products/bulk-delete', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'IDs array is required' });
      }
      const deleted = await db
        .delete(softwareProducts)
        .where(and(inArray(softwareProducts.id, ids), eq(softwareProducts.tenantId, tenantId)))
        .returning();
      res.json({
        message: `Successfully deleted ${deleted.length} software products`,
        deletedCount: deleted.length,
      });
    } catch (error) {
      log.error('Error bulk deleting software products:', error);
      res.status(500).json({ error: 'Failed to bulk delete software products' });
    }
  });

  // Delete software product
  app.delete('/api/software-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const productId = req.params.id;

      const [deletedProduct] = await db
        .delete(softwareProducts)
        .where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenantId, tenantId)))
        .returning();

      if (!deletedProduct) {
        return res.status(404).json({ error: 'Software product not found' });
      }

      res.json({ message: 'Software product deleted successfully' });
    } catch (error) {
      log.error('Error deleting software product:', error);
      res.status(500).json({ error: 'Failed to delete software product' });
    }
  });
}
