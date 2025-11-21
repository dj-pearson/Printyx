import type { Express } from "express";
import { eq, and, desc, sql, count, lt, lte } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  requireProductManager,
  requireProductAdmin,
  requireInventoryManager
} from "./middleware/product-permissions";
import {
  filterPricingByRole,
  filterPricingArrayByRole,
  getCompanyPricingSettings
} from "./services/pricing-service";
import {
  supplies,
  insertSupplySchema,
  type Supply
} from "@shared/schema";

export function registerSuppliesRoutes(app: Express) {
  /**
   * Get all supplies
   * Accessible to: All authenticated users
   * Pricing filtered by role
   */
  app.get("/api/supplies", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';
      const { search, category, inStock, lowStock } = req.query;

      let query = db
        .select()
        .from(supplies)
        .where(eq(supplies.tenantId, tenantId));

      // Apply filters
      if (search) {
        query = query.where(
          sql`${supplies.productName} ILIKE ${`%${search}%`} OR ${supplies.productCode} ILIKE ${`%${search}%`}`
        );
      }

      if (category) {
        query = query.where(eq(supplies.category, category as string));
      }

      if (inStock === 'true') {
        query = query.where(eq(supplies.inStock, true));
      } else if (inStock === 'false') {
        query = query.where(eq(supplies.inStock, false));
      }

      // Low stock filter (inventory below reorder level)
      if (lowStock === 'true') {
        query = query.where(
          sql`${supplies.inventory} <= ${supplies.reorderLevel}`
        );
      }

      const supplyList = await query.orderBy(supplies.productName);

      // Apply pricing visibility filtering
      const settings = await getCompanyPricingSettings(tenantId);
      const filteredSupplies = filterPricingArrayByRole(supplyList, userRole, settings || undefined);

      res.json(filteredSupplies);
    } catch (error) {
      console.error("Error fetching supplies:", error);
      res.status(500).json({ error: "Failed to fetch supplies" });
    }
  });

  /**
   * Get single supply by ID
   * Accessible to: All authenticated users
   * Pricing filtered by role
   */
  app.get("/api/supplies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';
      const supplyId = req.params.id;

      const [supply] = await db
        .select()
        .from(supplies)
        .where(and(eq(supplies.id, supplyId), eq(supplies.tenantId, tenantId)));

      if (!supply) {
        return res.status(404).json({ error: "Supply not found" });
      }

      // Apply pricing visibility filtering
      const settings = await getCompanyPricingSettings(tenantId);
      const filteredSupply = filterPricingByRole(supply, userRole, settings || undefined);

      res.json(filteredSupply);
    } catch (error) {
      console.error("Error fetching supply:", error);
      res.status(500).json({ error: "Failed to fetch supply" });
    }
  });

  /**
   * Create new supply
   * Accessible to: Managers and above
   */
  app.post("/api/supplies", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const supplyData = insertSupplySchema.parse({
        ...req.body,
        tenantId
      });

      const [newSupply] = await db
        .insert(supplies)
        .values(supplyData)
        .returning();

      res.status(201).json(newSupply);
    } catch (error) {
      console.error("Error creating supply:", error);
      res.status(500).json({ error: "Failed to create supply" });
    }
  });

  /**
   * Update supply
   * Accessible to: Managers and above
   */
  app.put("/api/supplies/:id", isAuthenticated, requireProductManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const supplyId = req.params.id;

      const [updatedSupply] = await db
        .update(supplies)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(supplies.id, supplyId), eq(supplies.tenantId, tenantId)))
        .returning();

      if (!updatedSupply) {
        return res.status(404).json({ error: "Supply not found" });
      }

      res.json(updatedSupply);
    } catch (error) {
      console.error("Error updating supply:", error);
      res.status(500).json({ error: "Failed to update supply" });
    }
  });

  /**
   * Patch supply (partial update)
   * Accessible to: Managers and above (for inventory updates)
   * Special handling: Inventory-only updates can be done by inventory managers
   */
  app.patch("/api/supplies/:id", isAuthenticated, requireInventoryManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const supplyId = req.params.id;

      const [updatedSupply] = await db
        .update(supplies)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(supplies.id, supplyId), eq(supplies.tenantId, tenantId)))
        .returning();

      if (!updatedSupply) {
        return res.status(404).json({ error: "Supply not found" });
      }

      res.json(updatedSupply);
    } catch (error) {
      console.error("Error updating supply:", error);
      res.status(500).json({ error: "Failed to update supply" });
    }
  });

  /**
   * Delete supply
   * Accessible to: Admins and above
   */
  app.delete("/api/supplies/:id", isAuthenticated, requireProductAdmin, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const supplyId = req.params.id;

      const [deletedSupply] = await db
        .delete(supplies)
        .where(and(eq(supplies.id, supplyId), eq(supplies.tenantId, tenantId)))
        .returning();

      if (!deletedSupply) {
        return res.status(404).json({ error: "Supply not found" });
      }

      res.json({ message: "Supply deleted successfully" });
    } catch (error) {
      console.error("Error deleting supply:", error);
      res.status(500).json({ error: "Failed to delete supply" });
    }
  });

  /**
   * Get low stock supplies
   * Accessible to: All authenticated users
   * Returns supplies where inventory is at or below reorder level
   */
  app.get("/api/supplies-meta/low-stock", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';

      const lowStockSupplies = await db
        .select()
        .from(supplies)
        .where(
          and(
            eq(supplies.tenantId, tenantId),
            sql`${supplies.inventory} <= ${supplies.reorderLevel}`
          )
        )
        .orderBy(supplies.inventory);

      // Apply pricing visibility filtering
      const settings = await getCompanyPricingSettings(tenantId);
      const filtered = filterPricingArrayByRole(lowStockSupplies, userRole, settings || undefined);

      res.json(filtered);
    } catch (error) {
      console.error("Error fetching low stock supplies:", error);
      res.status(500).json({ error: "Failed to fetch low stock supplies" });
    }
  });

  /**
   * Get out-of-stock supplies
   * Accessible to: All authenticated users
   */
  app.get("/api/supplies-meta/out-of-stock", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user?.role || req.session?.user?.role || 'standard';

      const outOfStockSupplies = await db
        .select()
        .from(supplies)
        .where(
          and(
            eq(supplies.tenantId, tenantId),
            eq(supplies.inStock, false)
          )
        )
        .orderBy(supplies.productName);

      // Apply pricing visibility filtering
      const settings = await getCompanyPricingSettings(tenantId);
      const filtered = filterPricingArrayByRole(outOfStockSupplies, userRole, settings || undefined);

      res.json(filtered);
    } catch (error) {
      console.error("Error fetching out-of-stock supplies:", error);
      res.status(500).json({ error: "Failed to fetch out-of-stock supplies" });
    }
  });

  /**
   * Get supply categories
   * Accessible to: All authenticated users
   */
  app.get("/api/supplies-meta/categories", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const categories = await db
        .selectDistinct({ category: supplies.category })
        .from(supplies)
        .where(and(eq(supplies.tenantId, tenantId), sql`${supplies.category} IS NOT NULL`));

      res.json(categories.map(c => c.category));
    } catch (error) {
      console.error("Error fetching supply categories:", error);
      res.status(500).json({ error: "Failed to fetch supply categories" });
    }
  });

  /**
   * Get supply dashboard stats
   * Accessible to: All authenticated users
   */
  app.get("/api/supplies/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const totalSuppliesResult = await db
        .select({ count: count() })
        .from(supplies)
        .where(eq(supplies.tenantId, tenantId));

      const inStockResult = await db
        .select({ count: count() })
        .from(supplies)
        .where(and(eq(supplies.tenantId, tenantId), eq(supplies.inStock, true)));

      const outOfStockResult = await db
        .select({ count: count() })
        .from(supplies)
        .where(and(eq(supplies.tenantId, tenantId), eq(supplies.inStock, false)));

      const lowStockResult = await db
        .select({ count: count() })
        .from(supplies)
        .where(
          and(
            eq(supplies.tenantId, tenantId),
            sql`${supplies.inventory} <= ${supplies.reorderLevel}`,
            sql`${supplies.inventory} > 0`
          )
        );

      const totalSupplies = totalSuppliesResult[0]?.count || 0;
      const inStock = inStockResult[0]?.count || 0;
      const outOfStock = outOfStockResult[0]?.count || 0;
      const lowStock = lowStockResult[0]?.count || 0;

      res.json({
        totalSupplies,
        inStock,
        outOfStock,
        lowStock,
        needsAttention: outOfStock + lowStock
      });
    } catch (error) {
      console.error("Error fetching supply dashboard:", error);
      res.status(500).json({ error: "Failed to fetch supply dashboard" });
    }
  });

  /**
   * Bulk update inventory levels
   * Accessible to: Inventory Managers and above
   */
  app.patch("/api/supplies/bulk-inventory-update", isAuthenticated, requireInventoryManager, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { updates } = req.body; // Array of { id, inventory, inStock }

      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates must be an array" });
      }

      const results = await Promise.all(
        updates.map(async (update: { id: string; inventory?: number; inStock?: boolean }) => {
          const updateData: any = { updatedAt: new Date() };

          if (update.inventory !== undefined) {
            updateData.inventory = update.inventory;
          }
          if (update.inStock !== undefined) {
            updateData.inStock = update.inStock;
          }

          const [updatedSupply] = await db
            .update(supplies)
            .set(updateData)
            .where(and(eq(supplies.id, update.id), eq(supplies.tenantId, tenantId)))
            .returning();

          return updatedSupply;
        })
      );

      res.json({
        message: `Updated ${results.filter(r => r).length} supplies`,
        updated: results.filter(r => r)
      });
    } catch (error) {
      console.error("Error bulk updating inventory:", error);
      res.status(500).json({ error: "Failed to bulk update inventory" });
    }
  });
}
