import express from "express";
import { eq, and, desc, sql, gte, lte, count, avg } from "drizzle-orm";
import { db } from "./db";
import { 
  warehouseKittingOperations,
  fpyMetrics,
  autoInvoiceGeneration,
  insertWarehouseKittingOperationSchema,
  insertFpyMetricSchema,
  insertAutoInvoiceGenerationSchema,
  type WarehouseKittingOperation,
  type FpyMetric,
  type AutoInvoiceGeneration
} from "@shared/warehouse-fpy-schema";
import { serviceTickets, businessRecords } from "@shared/schema";

const router = express.Router();

// Create warehouse kitting operation
router.post("/warehouse-kitting-operations", async (req, res) => {
  try {
    const validatedData = insertWarehouseKittingOperationSchema.parse(req.body);
    const tenantId = req.headers["x-tenant-id"] as string;

    const [operation] = await db
      .insert(warehouseKittingOperations)
      .values({
        ...validatedData,
        tenantId,
      })
      .returning();

    res.json(operation);
  } catch (error) {
    console.error("Error creating warehouse kitting operation:", error);
    res.status(500).json({ error: "Failed to create warehouse kitting operation" });
  }
});

// Get warehouse kitting operations
router.get("/warehouse-kitting-operations", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { status, technician, fromDate, toDate } = req.query;

    let query = db
      .select()
      .from(warehouseKittingOperations)
      .where(eq(warehouseKittingOperations.tenantId, tenantId));

    if (status) {
      query = query.where(eq(warehouseKittingOperations.operationStatus, status as string));
    }

    if (technician) {
      query = query.where(eq(warehouseKittingOperations.assignedTechnician, technician as string));
    }

    if (fromDate) {
      query = query.where(gte(warehouseKittingOperations.createdAt, new Date(fromDate as string)));
    }

    if (toDate) {
      query = query.where(lte(warehouseKittingOperations.createdAt, new Date(toDate as string)));
    }

    const operations = await query.orderBy(desc(warehouseKittingOperations.createdAt));

    res.json(operations);
  } catch (error) {
    console.error("Error fetching warehouse kitting operations:", error);
    res.status(500).json({ error: "Failed to fetch warehouse kitting operations" });
  }
});

// Update warehouse kitting operation
router.patch("/warehouse-kitting-operations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;
    const updates = req.body;

    // Calculate FPY if operation is being completed
    if (updates.operationStatus === 'completed' && !updates.firstPassYield) {
      updates.firstPassYield = !updates.reworkRequired && updates.qualityStatus === 'pass';
    }

    const [operation] = await db
      .update(warehouseKittingOperations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warehouseKittingOperations.id, id),
          eq(warehouseKittingOperations.tenantId, tenantId)
        )
      )
      .returning();

    if (!operation) {
      return res.status(404).json({ error: "Operation not found" });
    }

    res.json(operation);
  } catch (error) {
    console.error("Error updating warehouse kitting operation:", error);
    res.status(500).json({ error: "Failed to update warehouse kitting operation" });
  }
});

// Complete warehouse kitting operation with FPY calculation
router.post("/warehouse-kitting-operations/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;
    const { completedBy, supervisorApproval, notes } = req.body;

    const [operation] = await db
      .select()
      .from(warehouseKittingOperations)
      .where(
        and(
          eq(warehouseKittingOperations.id, id),
          eq(warehouseKittingOperations.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!operation) {
      return res.status(404).json({ error: "Operation not found" });
    }

    // Calculate final FPY
    const firstPassYield = !operation.reworkRequired && 
                          operation.qualityStatus === 'pass' && 
                          operation.reworkCount === 0;

    // Calculate duration
    const startTime = operation.startedAt || operation.createdAt;
    const totalDurationMinutes = Math.round((new Date().getTime() - startTime.getTime()) / (1000 * 60));

    const [updatedOperation] = await db
      .update(warehouseKittingOperations)
      .set({
        operationStatus: 'completed',
        completedBy,
        completedAt: new Date(),
        firstPassYield,
        totalDurationMinutes,
        supervisorApproval: supervisorApproval || false,
        notes: notes || operation.notes,
        updatedAt: new Date(),
      })
      .where(eq(warehouseKittingOperations.id, id))
      .returning();

    res.json(updatedOperation);
  } catch (error) {
    console.error("Error completing warehouse kitting operation:", error);
    res.status(500).json({ error: "Failed to complete warehouse kitting operation" });
  }
});

// Get FPY metrics
router.get("/fpy-metrics", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { period = 'week' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get operations for the period
    const operations = await db
      .select()
      .from(warehouseKittingOperations)
      .where(
        and(
          eq(warehouseKittingOperations.tenantId, tenantId),
          gte(warehouseKittingOperations.createdAt, startDate),
          eq(warehouseKittingOperations.operationStatus, 'completed')
        )
      );

    // Calculate FPY metrics
    const totalOperations = operations.length;
    const firstPassOperations = operations.filter(op => op.firstPassYield).length;
    const fpyPercentage = totalOperations > 0 ? (firstPassOperations / totalOperations) * 100 : 0;

    // Calculate breakdown by technician
    const fpyByTechnician = operations.reduce((acc, op) => {
      const tech = op.assignedTechnician;
      if (!acc[tech]) acc[tech] = { total: 0, firstPass: 0, percentage: 0 };
      acc[tech].total++;
      if (op.firstPassYield) acc[tech].firstPass++;
      acc[tech].percentage = (acc[tech].firstPass / acc[tech].total) * 100;
      return acc;
    }, {} as Record<string, { total: number; firstPass: number; percentage: number }>);

    // Calculate breakdown by equipment type
    const fpyByEquipmentType = operations.reduce((acc, op) => {
      const equipment = op.equipmentModel || 'Unknown';
      if (!acc[equipment]) acc[equipment] = { total: 0, firstPass: 0, percentage: 0 };
      acc[equipment].total++;
      if (op.firstPassYield) acc[equipment].firstPass++;
      acc[equipment].percentage = (acc[equipment].firstPass / acc[equipment].total) * 100;
      return acc;
    }, {} as Record<string, { total: number; firstPass: number; percentage: number }>);

    // Analyze defects
    const allDefects = operations.flatMap(op => op.defectsFound || []);
    const defectCounts = allDefects.reduce((acc, defect) => {
      acc[defect.defectType] = (acc[defect.defectType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topDefectTypes = Object.entries(defectCounts)
      .map(([defectType, count]) => ({
        defectType,
        count,
        percentage: (count / totalOperations) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const reworkOperations = operations.filter(op => op.reworkRequired).length;
    const reworkRate = totalOperations > 0 ? (reworkOperations / totalOperations) * 100 : 0;

    const metrics = {
      period: { start: startDate, end: now },
      totalOperations,
      firstPassOperations,
      fpyPercentage: Math.round(fpyPercentage * 100) / 100,
      fpyByTechnician,
      fpyByEquipmentType,
      topDefectTypes,
      reworkRate: Math.round(reworkRate * 100) / 100,
    };

    res.json(metrics);
  } catch (error) {
    console.error("Error fetching FPY metrics:", error);
    res.status(500).json({ error: "Failed to fetch FPY metrics" });
  }
});

// Trigger auto-invoice generation
router.post("/auto-invoice/:sourceType/:sourceId", async (req, res) => {
  try {
    const { sourceType, sourceId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;
    const { laborHours, laborRate, partsTotal } = req.body;

    // Check if auto-invoice already exists for this source
    const [existingInvoice] = await db
      .select()
      .from(autoInvoiceGeneration)
      .where(
        and(
          eq(autoInvoiceGeneration.tenantId, tenantId),
          eq(autoInvoiceGeneration.sourceType, sourceType),
          eq(autoInvoiceGeneration.sourceId, sourceId)
        )
      )
      .limit(1);

    if (existingInvoice) {
      return res.status(400).json({ error: "Auto-invoice already exists for this source" });
    }

    const totalAmount = (laborHours * laborRate) + (partsTotal || 0);
    const invoiceNumber = `INV-${Date.now()}`;

    const [autoInvoice] = await db
      .insert(autoInvoiceGeneration)
      .values({
        tenantId,
        sourceType,
        sourceId,
        invoiceNumber,
        generationStatus: 'processing',
        laborHours,
        laborRate,
        partsTotal: partsTotal || 0,
        totalAmount,
        triggeredAt: new Date(),
      })
      .returning();

    // In a real implementation, this would trigger actual invoice generation
    // For now, we'll simulate a successful generation
    setTimeout(async () => {
      try {
        await db
          .update(autoInvoiceGeneration)
          .set({
            generationStatus: 'completed',
            completedAt: new Date(),
            issuanceDelayHours: 0.1, // 6 minutes simulation
            invoiceId: `inv_${autoInvoice.id}`,
          })
          .where(eq(autoInvoiceGeneration.id, autoInvoice.id));
      } catch (error) {
        console.error("Error updating auto-invoice status:", error);
      }
    }, 2000); // 2 second delay to simulate processing

    res.json(autoInvoice);
  } catch (error) {
    console.error("Error creating auto-invoice:", error);
    res.status(500).json({ error: "Failed to create auto-invoice" });
  }
});

// Get auto-invoice status
router.get("/auto-invoice/:sourceType/:sourceId", async (req, res) => {
  try {
    const { sourceType, sourceId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    const [autoInvoice] = await db
      .select()
      .from(autoInvoiceGeneration)
      .where(
        and(
          eq(autoInvoiceGeneration.tenantId, tenantId),
          eq(autoInvoiceGeneration.sourceType, sourceType),
          eq(autoInvoiceGeneration.sourceId, sourceId)
        )
      )
      .limit(1);

    if (!autoInvoice) {
      return res.status(404).json({ error: "Auto-invoice not found" });
    }

    res.json(autoInvoice);
  } catch (error) {
    console.error("Error fetching auto-invoice:", error);
    res.status(500).json({ error: "Failed to fetch auto-invoice" });
  }
});

// Get auto-invoice list with filtering
router.get("/auto-invoices", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { status, fromDate, toDate, delayFilter } = req.query;

    let query = db
      .select()
      .from(autoInvoiceGeneration)
      .where(eq(autoInvoiceGeneration.tenantId, tenantId));

    if (status) {
      query = query.where(eq(autoInvoiceGeneration.generationStatus, status as string));
    }

    if (fromDate) {
      query = query.where(gte(autoInvoiceGeneration.triggeredAt, new Date(fromDate as string)));
    }

    if (toDate) {
      query = query.where(lte(autoInvoiceGeneration.triggeredAt, new Date(toDate as string)));
    }

    // Filter for issuance delay > 24 hours
    if (delayFilter === 'gt_24h') {
      query = query.where(sql`${autoInvoiceGeneration.issuanceDelayHours} > 24`);
    }

    const invoices = await query.orderBy(desc(autoInvoiceGeneration.triggeredAt));

    res.json(invoices);
  } catch (error) {
    console.error("Error fetching auto-invoices:", error);
    res.status(500).json({ error: "Failed to fetch auto-invoices" });
  }
});

export default router;