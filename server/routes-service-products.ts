import type { Express } from "express";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  requireProductManager,
  requireProductAdmin
} from "./middleware/product-permissions";
import {
  filterPricingByRole,
  filterPricingArrayByRole,
  getCompanyPricingSettings
} from "./services/pricing-service";
import {
  serviceProducts,
  insertServiceProductSchema,
  type ServiceProduct
} from "@shared/schema";

export function registerServiceProductsRoutes(app: Express) {
  /**
   * Get all service products
   * Accessible to: All authenticated users
   * Pricing filtered by role
   */
  app.get("/api/service-products", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';
      const { search, category, serviceType, pricingLevel, status } = req.query;

      let query = db
        .select()
        .from(serviceProducts)
        .where(eq(serviceProducts.tenantId, tenantId));

      // Apply filters
      if (search) {
        query = query.where(
          sql`${serviceProducts.productName} ILIKE ${`%${search}%`} OR ${serviceProducts.productCode} ILIKE ${`%${search}%`}`
        );
      }

      if (category) {
        query = query.where(eq(serviceProducts.category, category as string));
      }

      if (serviceType) {
        query = query.where(eq(serviceProducts.serviceType, serviceType as string));
      }

      if (pricingLevel) {
        query = query.where(eq(serviceProducts.pricingLevel, pricingLevel as string));
      }

      if (status === 'active') {
        query = query.where(eq(serviceProducts.isActive, true));
      } else if (status === 'inactive') {
        query = query.where(eq(serviceProducts.isActive, false));
      }

      const products = await query.orderBy(serviceProducts.productName);

      // Apply pricing visibility filtering
      const settings = await getCompanyPricingSettings(tenantId);
      const filteredProducts = filterPricingArrayByRole(products, userRole, settings || undefined);

      res.json(filteredProducts);
    } catch (error) {
      console.error("Error fetching service products:", error);
      res.status(500).json({ error: "Failed to fetch service products" });
    }
  });

  /**
   * Get single service product by ID
   * Accessible to: All authenticated users
   * Pricing filtered by role
   */
  app.get("/api/service-products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';
      const productId = req.params.id;

      const [product] = await db
        .select()
        .from(serviceProducts)
        .where(and(eq(serviceProducts.id, productId), eq(serviceProducts.tenantId, tenantId)));

      if (!product) {
        return res.status(404).json({ error: "Service product not found" });
      }

      // Apply pricing visibility filtering
      const settings = await getCompanyPricingSettings(tenantId);
      const filteredProduct = filterPricingByRole(product, userRole, settings || undefined);

      res.json(filteredProduct);
    } catch (error) {
      console.error("Error fetching service product:", error);
      res.status(500).json({ error: "Failed to fetch service product" });
    }
  });

  /**
   * Create new service product
   * Accessible to: Managers and above
   */
  app.post("/api/service-products", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const productData = insertServiceProductSchema.parse({
        ...req.body,
        tenantId,
        category: req.body.category || 'Service'
      });

      const [newProduct] = await db
        .insert(serviceProducts)
        .values(productData)
        .returning();

      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error creating service product:", error);
      res.status(500).json({ error: "Failed to create service product" });
    }
  });

  /**
   * Update service product
   * Accessible to: Managers and above
   */
  app.put("/api/service-products/:id", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const productId = req.params.id;

      const [updatedProduct] = await db
        .update(serviceProducts)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(serviceProducts.id, productId), eq(serviceProducts.tenantId, tenantId)))
        .returning();

      if (!updatedProduct) {
        return res.status(404).json({ error: "Service product not found" });
      }

      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating service product:", error);
      res.status(500).json({ error: "Failed to update service product" });
    }
  });

  /**
   * Patch service product (partial update)
   * Accessible to: Managers and above
   */
  app.patch("/api/service-products/:id", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const productId = req.params.id;

      const [updatedProduct] = await db
        .update(serviceProducts)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(serviceProducts.id, productId), eq(serviceProducts.tenantId, tenantId)))
        .returning();

      if (!updatedProduct) {
        return res.status(404).json({ error: "Service product not found" });
      }

      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating service product:", error);
      res.status(500).json({ error: "Failed to update service product" });
    }
  });

  /**
   * Delete service product
   * Accessible to: Admins and above
   */
  app.delete("/api/service-products/:id", isAuthenticated, requireProductAdmin, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const productId = req.params.id;

      const [deletedProduct] = await db
        .delete(serviceProducts)
        .where(and(eq(serviceProducts.id, productId), eq(serviceProducts.tenantId, tenantId)))
        .returning();

      if (!deletedProduct) {
        return res.status(404).json({ error: "Service product not found" });
      }

      res.json({ message: "Service product deleted successfully" });
    } catch (error) {
      console.error("Error deleting service product:", error);
      res.status(500).json({ error: "Failed to delete service product" });
    }
  });

  /**
   * Get service product categories
   * Accessible to: All authenticated users
   */
  app.get("/api/service-products-meta/categories", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const categories = await db
        .selectDistinct({ category: serviceProducts.category })
        .from(serviceProducts)
        .where(and(eq(serviceProducts.tenantId, tenantId), sql`${serviceProducts.category} IS NOT NULL`));

      res.json(categories.map(c => c.category));
    } catch (error) {
      console.error("Error fetching service product categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  /**
   * Get service types
   * Accessible to: All authenticated users
   */
  app.get("/api/service-products-meta/types", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const types = await db
        .selectDistinct({ type: serviceProducts.serviceType })
        .from(serviceProducts)
        .where(and(eq(serviceProducts.tenantId, tenantId), sql`${serviceProducts.serviceType} IS NOT NULL`));

      res.json(types.map(t => t.type));
    } catch (error) {
      console.error("Error fetching service types:", error);
      res.status(500).json({ error: "Failed to fetch service types" });
    }
  });

  /**
   * Get pricing levels
   * Accessible to: All authenticated users
   */
  app.get("/api/service-products-meta/pricing-levels", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const levels = await db
        .selectDistinct({ level: serviceProducts.pricingLevel })
        .from(serviceProducts)
        .where(and(eq(serviceProducts.tenantId, tenantId), sql`${serviceProducts.pricingLevel} IS NOT NULL`));

      res.json(levels.map(l => l.level));
    } catch (error) {
      console.error("Error fetching pricing levels:", error);
      res.status(500).json({ error: "Failed to fetch pricing levels" });
    }
  });

  /**
   * Get service products dashboard stats
   * Accessible to: All authenticated users
   */
  app.get("/api/service-products/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const totalProductsResult = await db
        .select({ count: count() })
        .from(serviceProducts)
        .where(eq(serviceProducts.tenantId, tenantId));

      const activeProductsResult = await db
        .select({ count: count() })
        .from(serviceProducts)
        .where(and(eq(serviceProducts.tenantId, tenantId), eq(serviceProducts.isActive, true)));

      const availableForAllResult = await db
        .select({ count: count() })
        .from(serviceProducts)
        .where(and(eq(serviceProducts.tenantId, tenantId), eq(serviceProducts.availableForAll, true)));

      const totalProducts = totalProductsResult[0]?.count || 0;
      const activeProducts = activeProductsResult[0]?.count || 0;
      const availableForAll = availableForAllResult[0]?.count || 0;

      res.json({
        totalProducts,
        activeProducts,
        inactiveProducts: totalProducts - activeProducts,
        availableForAll
      });
    } catch (error) {
      console.error("Error fetching service products dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  /**
   * Get products by pricing tier
   * Accessible to: Managers and above (due to pricing visibility)
   * Returns count of products active in each pricing tier
   */
  app.get("/api/service-products-meta/by-tier", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const allProducts = await db
        .select()
        .from(serviceProducts)
        .where(eq(serviceProducts.tenantId, tenantId));

      const tierCounts = {
        new: allProducts.filter(p => p.newActive).length,
        upgrade: allProducts.filter(p => p.upgradeActive).length,
        lexmark: allProducts.filter(p => p.lexmarkActive).length,
        graphic: allProducts.filter(p => p.graphicActive).length
      };

      res.json(tierCounts);
    } catch (error) {
      console.error("Error fetching products by tier:", error);
      res.status(500).json({ error: "Failed to fetch products by tier" });
    }
  });
}
