import type { Express } from "express";
import { eq, and, desc, sql, count, like } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  productModels,
  masterProductModels,
  insertProductModelSchema,
  type ProductModel
} from "@shared/schema";

export function registerProductModelsRoutes(app: Express) {
  // Get all product models
  app.get("/api/product-models", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
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
          updatedAt: productModels.updatedAt
        })
        .from(productModels)
        .where(eq(productModels.tenantId, tenantId));

      // Apply filters
      if (search) {
        query = query.where(
          sql`${productModels.productName} ILIKE ${`%${search}%`} OR ${productModels.productCode} ILIKE ${`%${search}%`}`
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
      console.error("Error fetching product models:", error);
      res.status(500).json({ error: "Failed to fetch product models" });
    }
  });

  // Get product model by ID
  app.get("/api/product-models/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const modelId = req.params.id;

      const [model] = await db
        .select()
        .from(productModels)
        .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)));

      if (!model) {
        return res.status(404).json({ error: "Product model not found" });
      }

      res.json(model);
    } catch (error) {
      console.error("Error fetching product model:", error);
      res.status(500).json({ error: "Failed to fetch product model" });
    }
  });

  // Create new product model
  app.post("/api/product-models", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const modelData = insertProductModelSchema.parse({
        ...req.body,
        tenantId,
        status: req.body.status || 'active'
      });

      const [newModel] = await db
        .insert(productModels)
        .values(modelData)
        .returning();

      res.status(201).json(newModel);
    } catch (error) {
      console.error("Error creating product model:", error);
      res.status(500).json({ error: "Failed to create product model" });
    }
  });

  // Update product model
  app.put("/api/product-models/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const modelId = req.params.id;

      const [updatedModel] = await db
        .update(productModels)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)))
        .returning();

      if (!updatedModel) {
        return res.status(404).json({ error: "Product model not found" });
      }

      res.json(updatedModel);
    } catch (error) {
      console.error("Error updating product model:", error);
      res.status(500).json({ error: "Failed to update product model" });
    }
  });

  // Delete product model
  app.delete("/api/product-models/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const modelId = req.params.id;

      const [deletedModel] = await db
        .delete(productModels)
        .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)))
        .returning();

      if (!deletedModel) {
        return res.status(404).json({ error: "Product model not found" });
      }

      res.json({ message: "Product model deleted successfully" });
    } catch (error) {
      console.error("Error deleting product model:", error);
      res.status(500).json({ error: "Failed to delete product model" });
    }
  });

  // Get product categories
  app.get("/api/product-models/categories", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const categories = await db
        .selectDistinct({ category: productModels.category })
        .from(productModels)
        .where(and(eq(productModels.tenantId, tenantId), sql`${productModels.category} IS NOT NULL`));

      res.json(categories.map(c => c.category));
    } catch (error) {
      console.error("Error fetching product categories:", error);
      res.status(500).json({ error: "Failed to fetch product categories" });
    }
  });

  // Get manufacturers
  app.get("/api/product-models/manufacturers", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const manufacturers = await db
        .selectDistinct({ manufacturer: productModels.manufacturer })
        .from(productModels)
        .where(and(eq(productModels.tenantId, tenantId), sql`${productModels.manufacturer} IS NOT NULL`));

      res.json(manufacturers.map(m => m.manufacturer));
    } catch (error) {
      console.error("Error fetching manufacturers:", error);
      res.status(500).json({ error: "Failed to fetch manufacturers" });
    }
  });

  // Get low stock models
  app.get("/api/product-models/low-stock", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const lowStockModels = await db
        .select()
        .from(productModels)
        .where(
          and(
            eq(productModels.tenantId, tenantId),
            sql`${productModels.stockQuantity} <= ${productModels.reorderLevel}`
          )
        )
        .orderBy(productModels.stockQuantity);

      res.json(lowStockModels);
    } catch (error) {
      console.error("Error fetching low stock models:", error);
      res.status(500).json({ error: "Failed to fetch low stock models" });
    }
  });

  // Get product models dashboard stats
  app.get("/api/product-models/dashboard", isAuthenticated, async (req: any, res) => {
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
            sql`${productModels.stockQuantity} <= ${productModels.reorderLevel}`
          )
        );

      const totalValueResult = await db
        .select({ 
          totalValue: sql<number>`COALESCE(SUM(${productModels.price} * ${productModels.stockQuantity}), 0)`
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
        averageValue: totalModels > 0 ? totalValue / totalModels : 0
      });
    } catch (error) {
      console.error("Error fetching product models dashboard:", error);
      res.status(500).json({ error: "Failed to fetch product models dashboard" });
    }
  });

  // Bulk update stock quantities
  app.patch("/api/product-models/bulk-stock-update", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { updates } = req.body; // Array of { id, stockQuantity }

      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates must be an array" });
      }

      const results = await Promise.all(
        updates.map(async (update: { id: string; stockQuantity: number }) => {
          const [updatedModel] = await db
            .update(productModels)
            .set({
              stockQuantity: update.stockQuantity,
              updatedAt: new Date()
            })
            .where(and(eq(productModels.id, update.id), eq(productModels.tenantId, tenantId)))
            .returning();

          return updatedModel;
        })
      );

      res.json({
        message: `Updated ${results.filter(r => r).length} product models`,
        updated: results.filter(r => r)
      });
    } catch (error) {
      console.error("Error bulk updating stock:", error);
      res.status(500).json({ error: "Failed to bulk update stock" });
    }
  });
}