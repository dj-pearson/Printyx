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
  productAccessories,
  accessoryModelCompatibility,
  productModels,
  insertProductAccessorySchema,
  insertAccessoryModelCompatibilitySchema,
  type ProductAccessory
} from "@shared/schema";

export function registerProductAccessoriesRoutes(app: Express) {
  /**
   * Get all product accessories
   * Accessible to: All authenticated users
   * Pricing filtered by role
   */
  app.get("/api/product-accessories", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';
      const { search, category, type, status, codes } = req.query;

      // If specific accessory codes requested, fetch those
      if (codes) {
        const codeArray = typeof codes === 'string' ? codes.split(',') : codes;
        const accessories = await db
          .select()
          .from(productAccessories)
          .where(
            and(
              eq(productAccessories.tenantId, tenantId),
              sql`${productAccessories.accessoryCode} = ANY(${codeArray})`
            )
          );

        const settings = await getCompanyPricingSettings(tenantId);
        const filtered = filterPricingArrayByRole(accessories, userRole, settings || undefined);
        return res.json(filtered);
      }

      // Build query with filters
      let query = db
        .select()
        .from(productAccessories)
        .where(eq(productAccessories.tenantId, tenantId));

      if (search) {
        query = query.where(
          sql`${productAccessories.accessoryName} ILIKE ${`%${search}%`} OR ${productAccessories.accessoryCode} ILIKE ${`%${search}%`}`
        );
      }

      if (category) {
        query = query.where(eq(productAccessories.category, category as string));
      }

      if (type) {
        query = query.where(eq(productAccessories.accessoryType, type as string));
      }

      if (status) {
        query = query.where(eq(productAccessories.status, status as string));
      }

      const accessories = await query.orderBy(productAccessories.accessoryName);

      // Apply pricing visibility filtering
      const settings = await getCompanyPricingSettings(tenantId);
      const filteredAccessories = filterPricingArrayByRole(accessories, userRole, settings || undefined);

      res.json(filteredAccessories);
    } catch (error) {
      console.error("Error fetching product accessories:", error);
      res.status(500).json({ error: "Failed to fetch product accessories" });
    }
  });

  /**
   * Get single product accessory by ID
   * Accessible to: All authenticated users
   * Pricing filtered by role
   */
  app.get("/api/product-accessories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';
      const accessoryId = req.params.id;

      const [accessory] = await db
        .select()
        .from(productAccessories)
        .where(and(eq(productAccessories.id, accessoryId), eq(productAccessories.tenantId, tenantId)));

      if (!accessory) {
        return res.status(404).json({ error: "Product accessory not found" });
      }

      // Apply pricing visibility filtering
      const settings = await getCompanyPricingSettings(tenantId);
      const filteredAccessory = filterPricingByRole(accessory, userRole, settings || undefined);

      res.json(filteredAccessory);
    } catch (error) {
      console.error("Error fetching product accessory:", error);
      res.status(500).json({ error: "Failed to fetch product accessory" });
    }
  });

  /**
   * Get accessories for a specific product model
   * Accessible to: All authenticated users
   * Pricing filtered by role
   */
  app.get("/api/product-models/:modelId/accessories", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';
      const modelId = req.params.modelId;

      // Verify model exists and belongs to tenant
      const [model] = await db
        .select()
        .from(productModels)
        .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)));

      if (!model) {
        return res.status(404).json({ error: "Product model not found" });
      }

      // Get accessories via compatibility table
      const accessories = await db
        .select({
          accessory: productAccessories,
          compatibility: accessoryModelCompatibility
        })
        .from(accessoryModelCompatibility)
        .innerJoin(
          productAccessories,
          eq(accessoryModelCompatibility.accessoryId, productAccessories.id)
        )
        .where(
          and(
            eq(accessoryModelCompatibility.modelId, modelId),
            eq(productAccessories.tenantId, tenantId)
          )
        );

      // Flatten and apply pricing filtering
      const accessoryList = accessories.map(a => ({
        ...a.accessory,
        isRequired: a.compatibility.isRequired,
        isOptional: a.compatibility.isOptional,
        installationNotes: a.compatibility.installationNotes
      }));

      const settings = await getCompanyPricingSettings(tenantId);
      const filteredAccessories = filterPricingArrayByRole(accessoryList, userRole, settings || undefined);

      res.json(filteredAccessories);
    } catch (error) {
      console.error("Error fetching product accessories:", error);
      res.status(500).json({ error: "Failed to fetch product accessories" });
    }
  });

  /**
   * Create new product accessory
   * Accessible to: Managers and above
   */
  app.post("/api/product-accessories", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const accessoryData = insertProductAccessorySchema.parse({
        ...req.body,
        tenantId,
        status: req.body.status || 'active'
      });

      const [newAccessory] = await db
        .insert(productAccessories)
        .values(accessoryData)
        .returning();

      res.status(201).json(newAccessory);
    } catch (error) {
      console.error("Error creating product accessory:", error);
      res.status(500).json({ error: "Failed to create product accessory" });
    }
  });

  /**
   * Create accessory and link to model
   * Accessible to: Managers and above
   */
  app.post("/api/product-models/:modelId/accessories", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const modelId = req.params.modelId;

      // Verify model exists and belongs to tenant
      const [model] = await db
        .select()
        .from(productModels)
        .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)));

      if (!model) {
        return res.status(404).json({ error: "Product model not found" });
      }

      // Create the accessory
      const accessoryData = insertProductAccessorySchema.parse({
        ...req.body,
        tenantId,
        status: req.body.status || 'active'
      });

      const [newAccessory] = await db
        .insert(productAccessories)
        .values(accessoryData)
        .returning();

      // Create compatibility link
      const compatibilityData = insertAccessoryModelCompatibilitySchema.parse({
        accessoryId: newAccessory.id,
        modelId,
        isRequired: req.body.isRequired || false,
        isOptional: req.body.isOptional || true,
        installationNotes: req.body.installationNotes || null
      });

      await db
        .insert(accessoryModelCompatibility)
        .values(compatibilityData);

      res.status(201).json(newAccessory);
    } catch (error) {
      console.error("Error creating product accessory:", error);
      res.status(500).json({ error: "Failed to create product accessory" });
    }
  });

  /**
   * Update product accessory
   * Accessible to: Managers and above
   */
  app.put("/api/product-accessories/:id", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const accessoryId = req.params.id;

      const [updatedAccessory] = await db
        .update(productAccessories)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(productAccessories.id, accessoryId), eq(productAccessories.tenantId, tenantId)))
        .returning();

      if (!updatedAccessory) {
        return res.status(404).json({ error: "Product accessory not found" });
      }

      res.json(updatedAccessory);
    } catch (error) {
      console.error("Error updating product accessory:", error);
      res.status(500).json({ error: "Failed to update product accessory" });
    }
  });

  /**
   * Patch product accessory (partial update)
   * Accessible to: Managers and above
   */
  app.patch("/api/product-accessories/:id", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const accessoryId = req.params.id;

      const [updatedAccessory] = await db
        .update(productAccessories)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(productAccessories.id, accessoryId), eq(productAccessories.tenantId, tenantId)))
        .returning();

      if (!updatedAccessory) {
        return res.status(404).json({ error: "Product accessory not found" });
      }

      res.json(updatedAccessory);
    } catch (error) {
      console.error("Error updating product accessory:", error);
      res.status(500).json({ error: "Failed to update product accessory" });
    }
  });

  /**
   * Delete product accessory
   * Accessible to: Admins and above
   */
  app.delete("/api/product-accessories/:id", isAuthenticated, requireProductAdmin, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const accessoryId = req.params.id;

      // Delete compatibility links first (if any)
      await db
        .delete(accessoryModelCompatibility)
        .where(eq(accessoryModelCompatibility.accessoryId, accessoryId));

      // Delete the accessory
      const [deletedAccessory] = await db
        .delete(productAccessories)
        .where(and(eq(productAccessories.id, accessoryId), eq(productAccessories.tenantId, tenantId)))
        .returning();

      if (!deletedAccessory) {
        return res.status(404).json({ error: "Product accessory not found" });
      }

      res.json({ message: "Product accessory deleted successfully" });
    } catch (error) {
      console.error("Error deleting product accessory:", error);
      res.status(500).json({ error: "Failed to delete product accessory" });
    }
  });

  /**
   * Get accessory categories
   * Accessible to: All authenticated users
   */
  app.get("/api/product-accessories-meta/categories", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const categories = await db
        .selectDistinct({ category: productAccessories.category })
        .from(productAccessories)
        .where(and(eq(productAccessories.tenantId, tenantId), sql`${productAccessories.category} IS NOT NULL`));

      res.json(categories.map(c => c.category));
    } catch (error) {
      console.error("Error fetching accessory categories:", error);
      res.status(500).json({ error: "Failed to fetch accessory categories" });
    }
  });

  /**
   * Get accessory types
   * Accessible to: All authenticated users
   */
  app.get("/api/product-accessories-meta/types", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const types = await db
        .selectDistinct({ type: productAccessories.accessoryType })
        .from(productAccessories)
        .where(and(eq(productAccessories.tenantId, tenantId), sql`${productAccessories.accessoryType} IS NOT NULL`));

      res.json(types.map(t => t.type));
    } catch (error) {
      console.error("Error fetching accessory types:", error);
      res.status(500).json({ error: "Failed to fetch accessory types" });
    }
  });

  /**
   * Get accessory dashboard stats
   * Accessible to: All authenticated users
   */
  app.get("/api/product-accessories/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const totalAccessoriesResult = await db
        .select({ count: count() })
        .from(productAccessories)
        .where(eq(productAccessories.tenantId, tenantId));

      const activeAccessoriesResult = await db
        .select({ count: count() })
        .from(productAccessories)
        .where(and(eq(productAccessories.tenantId, tenantId), eq(productAccessories.status, 'active')));

      const totalAccessories = totalAccessoriesResult[0]?.count || 0;
      const activeAccessories = activeAccessoriesResult[0]?.count || 0;

      res.json({
        totalAccessories,
        activeAccessories,
        inactiveAccessories: totalAccessories - activeAccessories
      });
    } catch (error) {
      console.error("Error fetching accessory dashboard:", error);
      res.status(500).json({ error: "Failed to fetch accessory dashboard" });
    }
  });
}
