import { Router } from "express";
import { eq, and, desc, ne } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";

// Simple auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
  
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || req.user?.tenantId
    };
  }
  
  next();
};
import {
  customerNumberConfig,
  customerNumberHistory,
  businessRecords,
  companies,
  insertCustomerNumberConfigSchema,
  insertCustomerNumberHistorySchema,
} from "../shared/schema";

const router = Router();

// Customer Number Generation Service
class CustomerNumberService {
  /**
   * Generate next customer number based on configuration
   */
  static async generateCustomerNumber(tenantId: string, userId?: string): Promise<string> {
    // Get active configuration for tenant
    const configs = await db
      .select()
      .from(customerNumberConfig)
      .where(
        and(
          eq(customerNumberConfig.tenantId, tenantId),
          eq(customerNumberConfig.isActive, true)
        )
      )
      .limit(1);

    let config = configs[0];

    // Create default configuration if none exists
    if (!config) {
      const defaultConfig = {
        tenantId,
        prefix: "CUST",
        currentSequence: 1000,
        sequenceLength: 4,
        separatorChar: "-",
        isActive: true,
      };

      const [newConfig] = await db
        .insert(customerNumberConfig)
        .values(defaultConfig)
        .returning();
      config = newConfig;
    }

    // Generate the customer number
    const paddedSequence = config.currentSequence
      .toString()
      .padStart(config.sequenceLength, "0");
    
    const customerNumber = `${config.prefix}${config.separatorChar || ""}${paddedSequence}`;

    // Update the sequence number for next use
    await db
      .update(customerNumberConfig)
      .set({ 
        currentSequence: config.currentSequence + 1,
        updatedAt: new Date()
      })
      .where(eq(customerNumberConfig.id, config.id));

    return customerNumber;
  }

  /**
   * Assign customer number to a business record or company
   */
  static async assignCustomerNumber(
    tenantId: string,
    customerId: string,
    customerNumber: string,
    configId: string,
    userId?: string
  ): Promise<void> {
    // Record in history
    await db.insert(customerNumberHistory).values({
      tenantId,
      customerId,
      customerNumber,
      configId,
      generatedBy: userId,
    });

    // Update business record with customer number
    await db
      .update(businessRecords)
      .set({ 
        customerNumber,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(businessRecords.id, customerId),
          eq(businessRecords.tenantId, tenantId)
        )
      );
  }

  /**
   * Convert lead to customer and assign customer number
   */
  static async convertLeadToCustomerWithNumber(
    tenantId: string,
    leadId: string,
    userId?: string
  ): Promise<{ customerNumber: string; customerId: string }> {
    // Generate customer number
    const customerNumber = await this.generateCustomerNumber(tenantId, userId);

    // Update lead to customer status
    await db
      .update(businessRecords)
      .set({
        recordType: "customer",
        status: "active",
        customerNumber,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(businessRecords.id, leadId),
          eq(businessRecords.tenantId, tenantId)
        )
      );

    // Get configuration for history
    const config = await db
      .select()
      .from(customerNumberConfig)
      .where(
        and(
          eq(customerNumberConfig.tenantId, tenantId),
          eq(customerNumberConfig.isActive, true)
        )
      )
      .limit(1);

    if (config[0]) {
      // Record in history
      await db.insert(customerNumberHistory).values({
        tenantId,
        customerId: leadId,
        customerNumber,
        configId: config[0].id,
        generatedBy: userId,
      });
    }

    return { customerNumber, customerId: leadId };
  }
}

// Get customer number configuration
router.get("/config", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;

    const configs = await db
      .select()
      .from(customerNumberConfig)
      .where(eq(customerNumberConfig.tenantId, tenantId))
      .orderBy(desc(customerNumberConfig.createdAt));

    res.json(configs);
  } catch (error) {
    console.error("Error fetching customer number config:", error);
    res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

// Create or update customer number configuration
router.post("/config", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;
    const userId = req.session?.userId || req.user?.id;
    const validatedData = insertCustomerNumberConfigSchema.parse({
      ...req.body,
      tenantId,
    });

    // Deactivate existing configurations if this is being set as active
    if (validatedData.isActive) {
      await db
        .update(customerNumberConfig)
        .set({ isActive: false })
        .where(eq(customerNumberConfig.tenantId, tenantId));
    }

    const [config] = await db
      .insert(customerNumberConfig)
      .values(validatedData)
      .returning();

    res.json(config);
  } catch (error) {
    console.error("Error creating customer number config:", error);
    res.status(500).json({ error: "Failed to create configuration" });
  }
});

// Update customer number configuration
router.put("/config/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;
    const { id } = req.params;

    // Validate that this config belongs to the tenant
    const existing = await db
      .select()
      .from(customerNumberConfig)
      .where(
        and(
          eq(customerNumberConfig.id, id),
          eq(customerNumberConfig.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    // Deactivate other configurations if this is being set as active
    if (req.body.isActive) {
      await db
        .update(customerNumberConfig)
        .set({ isActive: false })
        .where(
          and(
            eq(customerNumberConfig.tenantId, tenantId),
            ne(customerNumberConfig.id, id)
          )
        );
    }

    const [updated] = await db
      .update(customerNumberConfig)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(customerNumberConfig.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error updating customer number config:", error);
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

// Generate a new customer number (without assigning)
router.post("/generate", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;
    const userId = req.session?.userId || req.user?.id;

    const customerNumber = await CustomerNumberService.generateCustomerNumber(
      tenantId,
      userId
    );

    res.json({ customerNumber });
  } catch (error) {
    console.error("Error generating customer number:", error);
    res.status(500).json({ error: "Failed to generate customer number" });
  }
});

// Assign customer number to existing customer
router.post("/assign", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;
    const userId = req.session?.userId || req.user?.id;
    const { customerId, customerNumber } = req.body;

    if (!customerId || !customerNumber) {
      return res.status(400).json({ 
        error: "customerId and customerNumber are required" 
      });
    }

    // Get active configuration
    const config = await db
      .select()
      .from(customerNumberConfig)
      .where(
        and(
          eq(customerNumberConfig.tenantId, tenantId),
          eq(customerNumberConfig.isActive, true)
        )
      )
      .limit(1);

    if (!config[0]) {
      return res.status(400).json({ 
        error: "No active customer number configuration found" 
      });
    }

    await CustomerNumberService.assignCustomerNumber(
      tenantId,
      customerId,
      customerNumber,
      config[0].id,
      userId
    );

    res.json({ success: true, customerNumber, customerId });
  } catch (error) {
    console.error("Error assigning customer number:", error);
    res.status(500).json({ error: "Failed to assign customer number" });
  }
});

// Convert lead to customer with automatic customer number generation
router.post("/convert-lead/:leadId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;
    const userId = req.session?.userId || req.user?.id;
    const { leadId } = req.params;

    const result = await CustomerNumberService.convertLeadToCustomerWithNumber(
      tenantId,
      leadId,
      userId
    );

    res.json(result);
  } catch (error) {
    console.error("Error converting lead to customer:", error);
    res.status(500).json({ error: "Failed to convert lead to customer" });
  }
});

// Get customer number history
router.get("/history", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;

    const history = await db
      .select({
        id: customerNumberHistory.id,
        customerNumber: customerNumberHistory.customerNumber,
        generatedAt: customerNumberHistory.generatedAt,
        generatedBy: customerNumberHistory.generatedBy,
        customerId: customerNumberHistory.customerId,
        configId: customerNumberHistory.configId,
      })
      .from(customerNumberHistory)
      .where(eq(customerNumberHistory.tenantId, tenantId))
      .orderBy(desc(customerNumberHistory.generatedAt))
      .limit(100);

    res.json(history);
  } catch (error) {
    console.error("Error fetching customer number history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Preview customer number format
router.post("/preview", async (req: any, res) => {
  try {
    const { prefix, separatorChar, sequenceLength, currentSequence } = req.body;

    const paddedSequence = (currentSequence || 1000)
      .toString()
      .padStart(sequenceLength || 4, "0");
    
    const preview = `${prefix || "CUST"}${separatorChar || "-"}${paddedSequence}`;

    res.json({ 
      preview,
      nextNumbers: [
        `${prefix || "CUST"}${separatorChar || "-"}${(currentSequence || 1000).toString().padStart(sequenceLength || 4, "0")}`,
        `${prefix || "CUST"}${separatorChar || "-"}${(currentSequence + 1 || 1001).toString().padStart(sequenceLength || 4, "0")}`,
        `${prefix || "CUST"}${separatorChar || "-"}${(currentSequence + 2 || 1002).toString().padStart(sequenceLength || 4, "0")}`,
      ]
    });
  } catch (error) {
    console.error("Error previewing customer number:", error);
    res.status(500).json({ error: "Failed to preview customer number" });
  }
});

export { router as customerNumberRoutes, CustomerNumberService };