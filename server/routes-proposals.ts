import { Router } from "express";
import { db } from "./db.js";
import {
  proposals,
  proposalLineItems,
  proposalTemplates,
  equipmentPackages,
  proposalComments,
  proposalAnalytics,
  proposalApprovals,
  deals,
  dealStages,
  contracts,
  productModels,
  serviceProducts, 
  softwareProducts,
  supplies,
  professionalServices,
  productAccessories
} from "../shared/schema.js";
import { businessRecords, companyContacts } from "../shared/schema.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import puppeteer from 'puppeteer';
import {
  insertProposalSchema,
  insertProposalLineItemSchema,
  insertProposalTemplateSchema,
  insertEquipmentPackageSchema,
  insertProposalCommentSchema,
  insertProposalAnalyticsSchema,
  insertProposalApprovalSchema,
} from "../shared/schema.js";

const router = Router();

// ============= PROPOSAL TEMPLATES =============

// Basic auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  const isAuthenticated =
    req.session?.userId || req.user?.id || req.user?.claims?.sub;
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId:
        req.session.tenantId ||
        process.env.DEMO_TENANT_ID ||
        "550e8400-e29b-41d4-a716-446655440000",
    };
  } else if (!req.user.tenantId && !req.user.id) {
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId:
        req.user.tenantId ||
        req.session?.tenantId ||
        process.env.DEMO_TENANT_ID ||
        "550e8400-e29b-41d4-a716-446655440000",
    };
  }
  next();
};

// Get all proposal templates
router.get("/proposal-templates", requireAuth, async (req: any, res) => {
  try {
    // For now, return empty array since tables don't exist yet
    // Once we run db:push, this will use the actual table
    const templates = [];
    res.json(templates);
  } catch (error) {
    console.error("Error fetching proposal templates:", error);
    res.status(500).json({ error: "Failed to fetch proposal templates" });
  }
});

// Create proposal template
router.post("/proposal-templates", requireAuth, async (req: any, res) => {
  try {
    const validatedData = insertProposalTemplateSchema.parse({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
    });

    const [template] = await db
      .insert(proposalTemplates)
      .values([validatedData])
      .returning();

    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating proposal template:", error);
    res.status(500).json({ error: "Failed to create proposal template" });
  }
});

// Update proposal template
router.put("/proposal-templates/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { updatedAt, ...restData } = req.body;
    
    // Don't manually set updatedAt, let database handle it
    const updateData = restData;

    const [template] = await db
      .update(proposalTemplates)
      .set(updateData)
      .where(
        and(
          eq(proposalTemplates.id, id),
          eq(proposalTemplates.tenantId, req.user.tenantId)
        )
      )
      .returning();

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    console.error("Error updating proposal template:", error);
    res.status(500).json({ error: "Failed to update proposal template" });
  }
});

// ============= EQUIPMENT PACKAGES =============

// Get all equipment packages
router.get("/equipment-packages", requireAuth, async (req: any, res) => {
  try {
    const packages = await db
      .select()
      .from(equipmentPackages)
      .where(eq(equipmentPackages.tenantId, req.user.tenantId))
      .orderBy(equipmentPackages.packageName);

    res.json(packages);
  } catch (error) {
    console.error("Error fetching equipment packages:", error);
    res.status(500).json({ error: "Failed to fetch equipment packages" });
  }
});

// Create equipment package
router.post("/equipment-packages", requireAuth, async (req: any, res) => {
  try {
    const validatedData = insertEquipmentPackageSchema.parse({
      ...req.body,
      tenantId: req.user.tenantId,
    });

    const [package_] = await db
      .insert(equipmentPackages)
      .values([validatedData])
      .returning();

    res.status(201).json(package_);
  } catch (error) {
    console.error("Error creating equipment package:", error);
    res.status(500).json({ error: "Failed to create equipment package" });
  }
});

// ============= PROPOSALS =============

// Get all proposals
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const { status, businessRecordId, filter, days } = req.query as Record<string, string>;

    let baseQuery = db
      .select({
        id: proposals.id,
        proposalNumber: proposals.proposalNumber,
        version: proposals.version,
        title: proposals.title,
        businessRecordId: proposals.businessRecordId,
        proposalType: proposals.proposalType,
        status: proposals.status,
        totalAmount: proposals.totalAmount,
        validUntil: proposals.validUntil,
        sentAt: proposals.sentAt,
        viewedAt: proposals.viewedAt,
        acceptedAt: proposals.acceptedAt,
        createdBy: proposals.createdBy,
        assignedTo: proposals.assignedTo,
        createdAt: proposals.createdAt,
        // Join with business records to get customer info
        customerName: businessRecords.companyName,
        customerEmail: businessRecords.primaryContactEmail,
      })
      .from(proposals)
      .leftJoin(
        businessRecords,
        eq(proposals.businessRecordId, businessRecords.id)
      );

    const conditions: any[] = [eq(proposals.tenantId, req.user.tenantId)];

    if (status) {
      conditions.push(eq(proposals.status, status as string));
    }

    if (businessRecordId) {
      conditions.push(
        eq(proposals.businessRecordId, businessRecordId as string)
      );
    }

    // Aging filter: proposals older than N days
    if (filter === "aging" && days) {
      const n = Number.parseInt(days, 10);
      if (!Number.isNaN(n) && n > 0) {
        conditions.push(sql`${proposals.createdAt} < NOW() - INTERVAL '${n} days'`);
      }
    }

    const query = baseQuery.where(and(...conditions));

    const result = await query.orderBy(desc(proposals.createdAt));

    res.json(result);
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

// Get new proposal template
router.get("/new", requireAuth, async (req: any, res) => {
  try {
    // Return a new proposal template
    const newProposal = {
      id: "new",
      tenantId: req.user.tenantId,
      proposalNumber: "", // Will be generated on save
      version: 1,
      title: "",
      businessRecordId: null,
      proposalType: "quote",
      status: "draft",
      totalAmount: "0",
      validUntil: null,
      sentAt: null,
      viewedAt: null,
      acceptedAt: null,
      createdBy: req.user.id,
      assignedTo: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      customerName: null,
      customerEmail: null,
      customerPhone: null,
      customerAddress: null,
      lineItems: [],
      comments: [],
    };

    res.json(newProposal);
  } catch (error) {
    console.error("Error creating new proposal template:", error);
    res.status(500).json({ error: "Failed to create new proposal template" });
  }
});

// Get proposal by ID with line items
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Get proposal - select all fields directly
    const proposalResult = await db
      .select()
      .from(proposals)
      .where(
        and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId))
      )
      .limit(1);

    if (proposalResult.length === 0) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const proposal = proposalResult[0];

    // Get line items
    const lineItems = await db
      .select()
      .from(proposalLineItems)
      .where(
        and(
          eq(proposalLineItems.proposalId, id),
          eq(proposalLineItems.tenantId, req.user.tenantId)
        )
      )
      .orderBy(proposalLineItems.lineNumber);

    res.json({
      ...proposal,
      lineItems,
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).json({ error: "Failed to fetch proposal" });
  }
});

// Create new proposal
router.post("/", requireAuth, async (req: any, res) => {
  console.log("🚀 POST /api/proposals endpoint hit!");
  try {
    console.log("=== PROPOSAL CREATION DEBUG ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User:", req.user);

    // Generate proposal number
    const proposalNumber = await generateProposalNumber(req.user.tenantId);
    console.log("Generated proposal number:", proposalNumber);

    const dataToValidate = {
      ...req.body,
      tenantId: req.user.tenantId,
      proposalNumber,
      createdBy: req.user.id,
      assignedTo: req.user.id, // Default to creator
      // Convert ISO date string to Date object if validUntil exists
      validUntil: req.body.validUntil
        ? new Date(req.body.validUntil)
        : undefined,
    };
    console.log("Data to validate:", JSON.stringify(dataToValidate, null, 2));

    const validatedData = insertProposalSchema.parse(dataToValidate);
    console.log("Validated data:", JSON.stringify(validatedData, null, 2));

    const [proposal] = await db
      .insert(proposals)
      .values([validatedData])
      .returning();

    console.log("Created proposal:", proposal);

    // If line items provided, add them
    if (req.body.lineItems && req.body.lineItems.length > 0) {
      const lineItemsData = req.body.lineItems.map(
        (item: any, index: number) => ({
          ...item,
          tenantId: req.user.tenantId,
          proposalId: proposal.id,
          lineNumber: item.lineNumber || index + 1,
          itemType: item.itemType || "equipment", // Use provided itemType or default to equipment
        })
      );

      const lineItems = await db
        .insert(proposalLineItems)
        .values(lineItemsData)
        .returning();

      // Calculate totals
      const subtotal = lineItems.reduce(
        (sum, item) => sum + parseFloat(item.totalPrice || "0"),
        0
      );

      // Update proposal with calculated totals
      await db
        .update(proposals)
        .set({
          subtotal: subtotal.toString(),
          totalAmount: subtotal.toString(), // Simple case without tax/discount
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, proposal.id));
    }

    res.status(201).json(proposal);
  } catch (error) {
    console.error("=== PROPOSAL CREATION ERROR ===");
    console.error("Error creating proposal:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    res
      .status(500)
      .json({ error: "Failed to create proposal", details: error.message });
  }
});

// Update proposal
router.put("/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { lineItems: lineItemsToUpdate, updatedAt, ...restData } = req.body;
    
    // Don't manually set updatedAt, let database handle it
    // Convert date strings to proper Date objects for timestamp fields
    const updateData = { ...restData };
    if (updateData.validUntil && typeof updateData.validUntil === 'string') {
      updateData.validUntil = new Date(updateData.validUntil);
    }
    if (updateData.estimatedStartDate && typeof updateData.estimatedStartDate === 'string') {
      updateData.estimatedStartDate = new Date(updateData.estimatedStartDate);
    }
    if (updateData.estimatedEndDate && typeof updateData.estimatedEndDate === 'string') {
      updateData.estimatedEndDate = new Date(updateData.estimatedEndDate);
    }

    const [proposal] = await db
      .update(proposals)
      .set(updateData)
      .where(
        and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId))
      )
      .returning();

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Handle line items if provided
    if (lineItemsToUpdate && lineItemsToUpdate.length > 0) {
      // Delete existing line items
      await db
        .delete(proposalLineItems)
        .where(
          and(
            eq(proposalLineItems.proposalId, id),
            eq(proposalLineItems.tenantId, req.user.tenantId)
          )
        );

      // Insert new line items
      const lineItemsData = lineItemsToUpdate.map(
        (item: any, index: number) => ({
          ...item,
          tenantId: req.user.tenantId,
          proposalId: id,
          lineNumber: item.lineNumber || index + 1,
          itemType: item.itemType || "equipment",
        })
      );

      await db.insert(proposalLineItems).values(lineItemsData);
    }

    res.json(proposal);
  } catch (error) {
    console.error("Error updating proposal:", error);
    res.status(500).json({ error: "Failed to update proposal" });
  }
});

// Update proposal (PATCH) - handles partial updates including line items
router.patch("/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { lineItems: lineItemsToUpdate, ...restData } = req.body;
    
    // Remove updatedAt from body if present and let database handle it
    delete restData.updatedAt;
    
    // Convert date strings to proper Date objects for timestamp fields
    const updateData = { ...restData };
    if (updateData.validUntil && typeof updateData.validUntil === 'string') {
      updateData.validUntil = new Date(updateData.validUntil);
    }
    if (updateData.estimatedStartDate && typeof updateData.estimatedStartDate === 'string') {
      updateData.estimatedStartDate = new Date(updateData.estimatedStartDate);
    }
    if (updateData.estimatedEndDate && typeof updateData.estimatedEndDate === 'string') {
      updateData.estimatedEndDate = new Date(updateData.estimatedEndDate);
    }

    console.log("📝 PATCH /api/proposals/:id - Updating proposal:", id);
    console.log("📝 Update data:", JSON.stringify(updateData, null, 2));
    console.log("📝 Line items to update:", JSON.stringify(lineItemsToUpdate, null, 2));

    const [proposal] = await db
      .update(proposals)
      .set(updateData)
      .where(
        and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId))
      )
      .returning();

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Handle line items if provided
    if (lineItemsToUpdate && lineItemsToUpdate.length > 0) {
      console.log("📦 Updating line items...");

      // Delete existing line items
      await db
        .delete(proposalLineItems)
        .where(
          and(
            eq(proposalLineItems.proposalId, id),
            eq(proposalLineItems.tenantId, req.user.tenantId)
          )
        );

      // Insert new line items
      const lineItemsData = lineItemsToUpdate.map(
        (item: any, index: number) => ({
          ...item,
          tenantId: req.user.tenantId,
          proposalId: id,
          lineNumber: item.lineNumber || index + 1,
          itemType: item.itemType || "equipment",
        })
      );

      console.log("📦 Inserting line items:", JSON.stringify(lineItemsData, null, 2));

      const insertedLineItems = await db
        .insert(proposalLineItems)
        .values(lineItemsData)
        .returning();

      console.log("✅ Successfully inserted", insertedLineItems.length, "line items");
    }

    // Fetch the updated proposal with line items for response
    const updatedProposalWithLineItems = await db
      .select()
      .from(proposals)
      .where(
        and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId))
      )
      .limit(1);

    const updatedLineItems = await db
      .select()
      .from(proposalLineItems)
      .where(
        and(eq(proposalLineItems.proposalId, id), eq(proposalLineItems.tenantId, req.user.tenantId))
      );

    const proposalWithLineItems = {
      ...updatedProposalWithLineItems[0],
      lineItems: updatedLineItems
    };

    console.log("✅ Returning updated proposal with", updatedLineItems.length, "line items");
    res.json(proposalWithLineItems);
  } catch (error) {
    console.error("❌ Error updating proposal:", error);
    res.status(500).json({ error: "Failed to update proposal" });
  }
});

// Update proposal status (sent, viewed, accepted, rejected)
router.patch("/:id/status", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updateData: any = { status, updatedAt: new Date() };

    // Set timestamp based on status
    switch (status) {
      case "sent":
        updateData.sentAt = new Date();
        break;
      case "viewed":
        updateData.viewedAt = new Date();
        break;
      case "accepted":
        updateData.acceptedAt = new Date();
        break;
      case "rejected":
        updateData.rejectedAt = new Date();
        break;
    }

    const [proposal] = await db
      .update(proposals)
      .set(updateData)
      .where(
        and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId))
      )
      .returning();

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Synchronize Sales Pipeline and Contracts
    try {
      if (status === "sent") {
        await upsertDealForProposal(proposal, req.user.id, req.user.tenantId);
      }
      if (status === "accepted") {
        const dealId = await upsertDealForProposal(
          proposal,
          req.user.id,
          req.user.tenantId,
          {
            forceWon: true,
          }
        );
        await createContractFromProposal(
          proposal,
          req.user.tenantId,
          req.user.id
        );
      }
    } catch (syncError) {
      console.error("[PROPOSALS] Sync error (deal/contract):", syncError);
      // Don't fail the status update because of downstream sync
    }

    // Track analytics event
    await db.insert(proposalAnalytics).values([
      {
        proposalId: id,
        eventType: `status_${status}`,
        eventDetails: {
          previousStatus: req.body.previousStatus,
          newStatus: status,
        },
      },
    ]);

    res.json(proposal);
  } catch (error) {
    console.error("Error updating proposal status:", error);
    res.status(500).json({ error: "Failed to update proposal status" });
  }
});

// ============= PROPOSAL LINE ITEMS =============

// Add line item to proposal
router.post("/:proposalId/line-items", requireAuth, async (req: any, res) => {
  try {
    const { proposalId } = req.params;

    // Get current highest line number
    const [{ maxLineNumber }] = await db
      .select({
        maxLineNumber: sql<number>`COALESCE(MAX(${proposalLineItems.lineNumber}), 0)`,
      })
      .from(proposalLineItems)
      .where(
        and(
          eq(proposalLineItems.proposalId, proposalId),
          eq(proposalLineItems.tenantId, req.user.tenantId)
        )
      );

    const validatedData = insertProposalLineItemSchema.parse({
      ...req.body,
      tenantId: req.user.tenantId,
      proposalId,
      lineNumber: maxLineNumber + 1,
    });

    const [lineItem] = await db
      .insert(proposalLineItems)
      .values([validatedData])
      .returning();

    // Recalculate proposal totals
    await recalculateProposalTotals(proposalId, req.user.tenantId);

    res.status(201).json(lineItem);
  } catch (error) {
    console.error("Error adding line item:", error);
    res.status(500).json({ error: "Failed to add line item" });
  }
});

// Update line item
router.put(
  "/:proposalId/line-items/:lineItemId",
  requireAuth,
  async (req: any, res) => {
    try {
      const { proposalId, lineItemId } = req.params;
      const updateData = { ...req.body, updatedAt: new Date() };

      const [lineItem] = await db
        .update(proposalLineItems)
        .set(updateData)
        .where(
          and(
            eq(proposalLineItems.id, lineItemId),
            eq(proposalLineItems.proposalId, proposalId),
            eq(proposalLineItems.tenantId, req.user.tenantId)
          )
        )
        .returning();

      if (!lineItem) {
        return res.status(404).json({ error: "Line item not found" });
      }

      // Recalculate proposal totals
      await recalculateProposalTotals(proposalId, req.user.tenantId);

      res.json(lineItem);
    } catch (error) {
      console.error("Error updating line item:", error);
      res.status(500).json({ error: "Failed to update line item" });
    }
  }
);

// Delete line item
router.delete(
  "/:proposalId/line-items/:lineItemId",
  requireAuth,
  async (req: any, res) => {
    try {
      const { proposalId, lineItemId } = req.params;

      const result = await db
        .delete(proposalLineItems)
        .where(
          and(
            eq(proposalLineItems.id, lineItemId),
            eq(proposalLineItems.proposalId, proposalId),
            eq(proposalLineItems.tenantId, req.user.tenantId)
          )
        );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Line item not found" });
      }

      // Recalculate proposal totals
      await recalculateProposalTotals(proposalId, req.user.tenantId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting line item:", error);
      res.status(500).json({ error: "Failed to delete line item" });
    }
  }
);

// ============= PROPOSAL COMMENTS =============

// Add comment to proposal
router.post("/:proposalId/comments", requireAuth, async (req: any, res) => {
  try {
    const { proposalId } = req.params;

    const validatedData = insertProposalCommentSchema.parse({
      ...req.body,
      tenantId: req.user.tenantId,
      proposalId,
      authorId: req.user.id,
      authorName: req.user.displayName || req.user.email,
    });

    const [comment] = await db
      .insert(proposalComments)
      .values([validatedData])
      .returning();

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// ============= ANALYTICS =============

// Track proposal view
router.post("/:id/track-view", async (req: any, res) => {
  try {
    const { id } = req.params;

    // Update proposal view count and last opened
    await db
      .update(proposals)
      .set({
        openCount: sql`${proposals.openCount} + 1`,
        lastOpenedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id));

    // Track analytics event
    await db.insert(proposalAnalytics).values([
      {
        proposalId: id,
        eventType: "opened",
        eventDetails: {
          deviceType: req.headers["user-agent"],
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error tracking proposal view:", error);
    res.status(500).json({ error: "Failed to track view" });
  }
});

// ============= HELPER FUNCTIONS =============

async function generateProposalNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;

  // Get the latest proposal number for this year
  const [latestProposal] = await db
    .select({ proposalNumber: proposals.proposalNumber })
    .from(proposals)
    .where(
      and(
        eq(proposals.tenantId, tenantId),
        sql`${proposals.proposalNumber} LIKE ${prefix + "%"}`
      )
    )
    .orderBy(desc(proposals.proposalNumber))
    .limit(1);

  let nextNumber = 1;
  if (latestProposal) {
    const currentNumber = parseInt(
      latestProposal.proposalNumber.replace(prefix, "")
    );
    nextNumber = currentNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
}

async function recalculateProposalTotals(proposalId: string, tenantId: string) {
  const lineItems = await db
    .select()
    .from(proposalLineItems)
    .where(
      and(
        eq(proposalLineItems.proposalId, proposalId),
        eq(proposalLineItems.tenantId, tenantId)
      )
    );

  const subtotal = lineItems.reduce(
    (sum, item) => sum + parseFloat(item.totalPrice || "0"),
    0
  );

  // Get current proposal for discount calculation
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)));

  if (proposal) {
    const discountAmount = parseFloat(proposal.discountAmount || "0");
    const taxAmount = parseFloat(proposal.taxAmount || "0");
    const totalAmount = subtotal - discountAmount + taxAmount;

    await db
      .update(proposals)
      .set({
        subtotal: subtotal.toString(),
        totalAmount: totalAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));
  }
}

// ====== CRM Integration Helpers ======

async function getStageIdByName(
  tenantId: string,
  stageName: string
): Promise<string | null> {
  const rows = await db
    .select({ id: dealStages.id })
    .from(dealStages)
    .where(
      and(eq(dealStages.tenantId, tenantId), eq(dealStages.name, stageName))
    )
    .limit(1);
  return rows[0]?.id || null;
}

async function getWonStageId(tenantId: string): Promise<string | null> {
  const rows = await db
    .select({ id: dealStages.id })
    .from(dealStages)
    .where(
      and(eq(dealStages.tenantId, tenantId), eq(dealStages.isWonStage, true))
    )
    .limit(1);
  if (rows[0]?.id) return rows[0].id;
  // Fallback to a stage named "Closed Won"
  const closedWon = await getStageIdByName(tenantId, "Closed Won");
  if (closedWon) return closedWon;
  // Fallback to first stage by sort order
  const first = await db
    .select({ id: dealStages.id })
    .from(dealStages)
    .where(eq(dealStages.tenantId, tenantId))
    .orderBy(asc(dealStages.sortOrder))
    .limit(1);
  return first[0]?.id || null;
}

async function getProposalSentStageId(
  tenantId: string
): Promise<string | null> {
  // Try commonly used names in order
  const names = ["Contract Sent", "Proposal Sent", "Presentation Scheduled"]; // last is a safe mid-pipeline fallback
  for (const name of names) {
    const id = await getStageIdByName(tenantId, name);
    if (id) return id;
  }
  const first = await db
    .select({ id: dealStages.id })
    .from(dealStages)
    .where(eq(dealStages.tenantId, tenantId))
    .orderBy(asc(dealStages.sortOrder))
    .limit(1);
  return first[0]?.id || null;
}

async function upsertDealForProposal(
  proposal: any,
  userId: string,
  tenantId: string,
  options?: { forceWon?: boolean }
): Promise<string | null> {
  // Get customer/company details
  const [customer] = await db
    .select({
      id: businessRecords.id,
      companyName: businessRecords.companyName,
    })
    .from(businessRecords)
    .where(eq(businessRecords.id, proposal.businessRecordId as string));

  const title = `${proposal.title} (${proposal.proposalNumber})`;

  // Try to find an existing deal by title and tenant
  const existing = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.tenantId, tenantId), eq(deals.title, title)))
    .limit(1);

  const stageId = options?.forceWon
    ? await getWonStageId(tenantId)
    : await getProposalSentStageId(tenantId);

  if (!stageId) {
    // If we cannot determine any stage, abort quietly
    return existing[0]?.id || null;
  }

  const numericTotal = proposal.totalAmount
    ? Number(proposal.totalAmount)
    : null;

  if (existing[0]?.id) {
    // Update existing deal
    await db
      .update(deals)
      .set({
        stageId,
        amount: numericTotal?.toString(),
        probability: options?.forceWon ? 100 : 70,
        status: options?.forceWon ? "won" : "open",
        actualCloseDate: options?.forceWon ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(deals.id, existing[0].id), eq(deals.tenantId, tenantId)));
    return existing[0].id;
  }

  // Create new deal
  const [created] = await db
    .insert(deals)
    .values({
      tenantId,
      title,
      description: proposal.executiveSummary || null,
      amount: numericTotal?.toString() || null,
      ownerId: userId,
      customerId: proposal.businessRecordId || null,
      companyName: customer?.companyName || null,
      stageId,
      probability: options?.forceWon ? 100 : 70,
      expectedCloseDate: proposal.validUntil
        ? new Date(proposal.validUntil)
        : null,
      status: options?.forceWon ? "won" : "open",
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: deals.id });

  return created?.id || null;
}

async function generateContractNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CT-${year}-`;
  const [latest] = await db
    .select({ contractNumber: contracts.contractNumber })
    .from(contracts)
    .where(
      and(
        eq(contracts.tenantId, tenantId),
        sql`${contracts.contractNumber} LIKE ${prefix + "%"}`
      )
    )
    .orderBy(desc(contracts.contractNumber))
    .limit(1);
  let next = 1;
  if (latest?.contractNumber) {
    next = parseInt(latest.contractNumber.replace(prefix, "")) + 1;
  }
  return `${prefix}${next.toString().padStart(4, "0")}`;
}

async function createContractFromProposal(
  proposal: any,
  tenantId: string,
  userId: string
): Promise<string | null> {
  try {
    const contractNumber = await generateContractNumber(tenantId);
    const startDate = new Date();
    const endDate = new Date();
    // Default 36-month term
    endDate.setMonth(endDate.getMonth() + 36);

    const [created] = await db
      .insert(contracts)
      .values({
        tenantId,
        customerId: proposal.businessRecordId,
        contractNumber,
        contractType: "cost_per_click",
        startDate,
        endDate,
        autoRenewal: false,
        billingFrequency: "monthly",
        status: "active",
        assignedSalespersonId: userId,
        notes: `Auto-created from proposal ${proposal.proposalNumber}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: contracts.id });
    return created?.id || null;
  } catch (e) {
    console.error("[CONTRACTS] Failed to create contract from proposal:", e);
    return null;
  }
}

// ============= PDF EXPORT FUNCTIONALITY =============

// Helper function to get quote data with all related information
async function getQuoteDataForExport(proposalId: string, tenantId: string) {
  console.log(`🔍 Fetching quote data for proposal ${proposalId}, tenant ${tenantId}`);
  
  const [quote] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)));

  if (!quote) {
    throw new Error(`Quote not found: ${proposalId}`);
  }

  console.log(`📋 Found quote: ${quote.proposalNumber} - ${quote.title}`);

  const lineItems = await db
    .select()
    .from(proposalLineItems)
    .where(and(eq(proposalLineItems.proposalId, proposalId), eq(proposalLineItems.tenantId, tenantId)))
    .orderBy(proposalLineItems.lineNumber);

  console.log(`📦 Found ${lineItems.length} line items`);

  // Get company/customer info
  let company = null;
  let contact = null;
  
  if (quote.businessRecordId) {
    try {
      [company] = await db
        .select()
        .from(businessRecords)
        .where(and(eq(businessRecords.id, quote.businessRecordId), eq(businessRecords.tenantId, tenantId)));
      console.log(`🏢 Found company: ${company?.companyName || 'Unknown'}`);
    } catch (error) {
      console.warn(`Failed to fetch company data for ${quote.businessRecordId}:`, error);
    }
  }

  if (quote.contactId) {
    try {
      [contact] = await db
        .select() 
        .from(companyContacts)
        .where(and(eq(companyContacts.id, quote.contactId), eq(companyContacts.tenantId, tenantId)));
      console.log(`👤 Found contact: ${contact?.firstName} ${contact?.lastName}`);
    } catch (error) {
      console.warn(`Failed to fetch contact data for ${quote.contactId}:`, error);
    }
  }

  return { quote, lineItems, company, contact };
}

// Helper function to get product cost information
async function getProductCostInfo(lineItems: any[], pricingType: string) {
  console.log(`💰 Getting cost info for ${lineItems.length} items with pricing type: ${pricingType}`);
  const costInfo = [];

  for (const item of lineItems) {
    let product = null;
    let costField = null;
    let repPriceField = null;

    // Determine which cost/rep_price fields to use based on pricing type
    if (pricingType === 'new') {
      costField = 'newCost';
      repPriceField = 'newRepPrice';
    } else if (pricingType === 'upgrade') {
      costField = 'upgradeCost';
      repPriceField = 'upgradeRepPrice';
    }

    try {
      // Get product details from appropriate table based on itemType
      if (item.productId && item.itemType === 'product_models') {
        [product] = await db
          .select()
          .from(productModels)
          .where(eq(productModels.id, item.productId));
      } else if (item.productId && item.itemType === 'service_products') {
        [product] = await db
          .select()
          .from(serviceProducts)
          .where(eq(serviceProducts.id, item.productId));
      } else if (item.productId && item.itemType === 'software_products') {
        [product] = await db
          .select()
          .from(softwareProducts)
          .where(eq(softwareProducts.id, item.productId));
      } else if (item.productId && item.itemType === 'supplies') {
        [product] = await db
          .select()
          .from(supplies)
          .where(eq(supplies.id, item.productId));
      } else if (item.productId && item.itemType === 'professional_services') {
        [product] = await db
          .select()
          .from(professionalServices)
          .where(eq(professionalServices.id, item.productId));
      } else if (item.productId && item.itemType === 'product_accessories') {
        [product] = await db
          .select()
          .from(productAccessories)
          .where(eq(productAccessories.id, item.productId));
      }
    } catch (error) {
      console.warn(`Failed to fetch product details for item ${item.id}:`, error);
    }

    // Default values if product not found or fields missing
    const defaultCost = '0.00';
    const defaultPrice = item.unitPrice || '0.00';

    const cost = product && costField && product[costField] ? product[costField] : defaultCost;
    const repPrice = product && repPriceField && product[repPriceField] ? product[repPriceField] : defaultPrice;

    const costNum = parseFloat(cost);
    const repPriceNum = parseFloat(repPrice);
    const margin = repPriceNum > 0 ? ((repPriceNum - costNum) / repPriceNum) * 100 : 0;

    costInfo.push({
      ...item,
      cost: costNum,
      repPrice: repPriceNum,
      margin: margin
    });
  }

  console.log(`💰 Generated cost info for ${costInfo.length} items`);
  return costInfo;
}

// Generate HTML template for quote PDF
function generateQuoteHTML(quote: any, lineItems: any[], company: any, contact: any, isManagerExport = false, costInfo: any[] = []) {
  const currentDate = new Date().toLocaleDateString();
  const validUntil = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'Not specified';
  
  const companyName = company?.companyName || `${company?.firstName || ''} ${company?.lastName || ''}`.trim() || 'Customer';
  const contactName = contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : '';
  
  let lineItemsHTML = '';
  let subtotal = 0;

  if (isManagerExport && costInfo.length > 0) {
    // Manager export with cost information
    lineItemsHTML = costInfo.map(item => {
      const totalPrice = item.quantity * parseFloat(item.unitPrice);
      const totalCost = item.quantity * item.cost;
      subtotal += totalPrice;
      
      return `
        <tr>
          <td class="border-b py-2 px-3 text-left">${item.productName}</td>
          <td class="border-b py-2 px-3 text-center">${item.quantity}</td>
          <td class="border-b py-2 px-3 text-right">$${item.cost.toFixed(2)}</td>
          <td class="border-b py-2 px-3 text-right">$${parseFloat(item.unitPrice).toFixed(2)}</td>
          <td class="border-b py-2 px-3 text-right">$${totalCost.toFixed(2)}</td>
          <td class="border-b py-2 px-3 text-right">$${totalPrice.toFixed(2)}</td>
          <td class="border-b py-2 px-3 text-right">${item.margin.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
  } else {
    // Regular export without cost information
    lineItemsHTML = lineItems.map(item => {
      const totalPrice = item.quantity * parseFloat(item.unitPrice);
      subtotal += totalPrice;
      
      return `
        <tr>
          <td class="border-b py-2 px-3 text-left">${item.productName}</td>
          <td class="border-b py-2 px-3 text-left">${item.description || ''}</td>
          <td class="border-b py-2 px-3 text-center">${item.quantity}</td>
          <td class="border-b py-2 px-3 text-right">$${parseFloat(item.unitPrice).toFixed(2)}</td>
          <td class="border-b py-2 px-3 text-right">$${totalPrice.toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  }

  const taxAmount = parseFloat(quote.taxAmount || '0');
  const discountAmount = parseFloat(quote.discountAmount || '0');
  const total = subtotal + taxAmount - discountAmount;

  const tableHeaders = isManagerExport ? 
    `<tr class="bg-gray-100">
      <th class="border-b-2 py-3 px-3 text-left font-semibold">Product</th>
      <th class="border-b-2 py-3 px-3 text-center font-semibold">Qty</th>
      <th class="border-b-2 py-3 px-3 text-right font-semibold">Cost</th>
      <th class="border-b-2 py-3 px-3 text-right font-semibold">Rep Price</th>
      <th class="border-b-2 py-3 px-3 text-right font-semibold">Total Cost</th>
      <th class="border-b-2 py-3 px-3 text-right font-semibold">Total Price</th>
      <th class="border-b-2 py-3 px-3 text-right font-semibold">Margin</th>
    </tr>` :
    `<tr class="bg-gray-100">
      <th class="border-b-2 py-3 px-3 text-left font-semibold">Product</th>
      <th class="border-b-2 py-3 px-3 text-left font-semibold">Description</th>
      <th class="border-b-2 py-3 px-3 text-center font-semibold">Quantity</th>
      <th class="border-b-2 py-3 px-3 text-right font-semibold">Unit Price</th>
      <th class="border-b-2 py-3 px-3 text-right font-semibold">Total</th>
    </tr>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quote ${quote.proposalNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { background: #1e3a8a; color: white; padding: 30px; margin: -20px -20px 30px -20px; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 5px 0; opacity: 0.9; }
        .quote-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .info-section h3 { margin: 0 0 10px 0; color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .totals { margin-top: 30px; }
        .totals table { width: 300px; margin-left: auto; }
        .totals .total-row { font-weight: bold; background-color: #f9fafb; }
        .manager-note { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; margin-top: 20px; border-radius: 5px; }
        .manager-note h4 { margin: 0 0 10px 0; color: #92400e; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${quote.title}</h1>
        <p>Quote #${quote.proposalNumber} ${isManagerExport ? ' - MANAGER EXPORT WITH COST DETAILS' : ''}</p>
        <p>Generated on ${currentDate}</p>
      </div>

      <div class="quote-info">
        <div class="info-section">
          <h3>Quote Information</h3>
          <p><strong>Status:</strong> ${quote.status}</p>
          <p><strong>Valid Until:</strong> ${validUntil}</p>
          <p><strong>Created:</strong> ${new Date(quote.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="info-section">
          <h3>Customer Information</h3>
          <p><strong>Company:</strong> ${companyName}</p>
          ${contactName ? `<p><strong>Contact:</strong> ${contactName}</p>` : ''}
          ${company?.email ? `<p><strong>Email:</strong> ${company.email}</p>` : ''}
          ${company?.phone ? `<p><strong>Phone:</strong> ${company.phone}</p>` : ''}
        </div>
      </div>

      <h3>Line Items</h3>
      <table>
        ${tableHeaders}
        ${lineItemsHTML}
      </table>

      <div class="totals">
        <table>
          <tr>
            <td>Subtotal:</td>
            <td class="text-right">$${subtotal.toFixed(2)}</td>
          </tr>
          ${discountAmount > 0 ? `
            <tr>
              <td>Discount:</td>
              <td class="text-right">-$${discountAmount.toFixed(2)}</td>
            </tr>
          ` : ''}
          ${taxAmount > 0 ? `
            <tr>
              <td>Tax:</td>
              <td class="text-right">$${taxAmount.toFixed(2)}</td>
            </tr>
          ` : ''}
          <tr class="total-row">
            <td><strong>Total:</strong></td>
            <td class="text-right"><strong>$${total.toFixed(2)}</strong></td>
          </tr>
        </table>
      </div>

      ${isManagerExport ? `
        <div class="manager-note">
          <h4>Manager Export Notice</h4>
          <p>This export includes cost information and profit margins for management review. This document is confidential and should not be shared with customers.</p>
        </div>
      ` : ''}
    </body>
    </html>
  `;
}

// Export PDF endpoint
router.get("/:id/export/pdf", requireAuth, async (req: any, res: any) => {
  let browser = null;
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    console.log(`📄 PDF Export: Starting export for proposal ${id}, tenant ${tenantId}`);

    const { quote, lineItems, company, contact } = await getQuoteDataForExport(id, tenantId);
    
    console.log(`📄 PDF Export: Retrieved quote data - ${lineItems.length} line items`);

    const html = generateQuoteHTML(quote, lineItems, company, contact, false);
    
    console.log(`📄 PDF Export: Generated HTML (${html.length} chars)`);
    
    // Enhanced Puppeteer configuration for Replit environment
    browser = await puppeteer.launch({ 
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ],
      timeout: 30000
    });
    
    const page = await browser.newPage();
    
    // Set viewport and wait for fonts to load
    await page.setViewport({ width: 1200, height: 800 });
    
    console.log(`📄 PDF Export: Setting HTML content`);
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 20000 
    });
    
    console.log(`📄 PDF Export: Generating PDF`);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      timeout: 30000
    });
    
    await browser.close();
    browser = null;
    
    console.log(`📄 PDF Export: Generated PDF (${pdf.length} bytes)`);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Quote-${quote.proposalNumber}.pdf"`,
      'Content-Length': pdf.length.toString()
    });
    
    res.send(pdf);
  } catch (error) {
    console.error('📄 PDF export error:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manager PDF Export endpoint (with cost information)
router.get("/:id/export/manager-pdf", requireAuth, async (req: any, res: any) => {
  let browser = null;
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    console.log(`📊 Manager PDF Export: Starting export for proposal ${id}, tenant ${tenantId}`);

    // Check if user has manager-level access
    const userRole = req.user.role?.toLowerCase() || req.user.roleId?.toLowerCase() || '';
    
    // For admin and manager roles, always allow access
    const isManager = userRole.includes('admin') || 
                     userRole.includes('root') || 
                     userRole.includes('manager') ||
                     userRole.includes('director') ||
                     userRole.includes('supervisor') ||
                     (!['sales_rep', 'salesperson', 'sales'].some(role => userRole.includes(role)));
    
    if (!isManager) {
      console.log(`📊 Manager PDF Export: Access denied for role: ${userRole}`);
      return res.status(403).json({ error: 'Access denied. Manager level access required.' });
    }

    const { quote, lineItems, company, contact } = await getQuoteDataForExport(id, tenantId);
    
    console.log(`📊 Manager PDF Export: Retrieved quote data - ${lineItems.length} line items`);
    
    // Get pricing type - assume 'new' if not available in quote data
    // In a production system, this should be stored with the quote when created
    const pricingType = 'new'; // Default to 'new' pricing for now
    const costInfo = await getProductCostInfo(lineItems, pricingType);

    console.log(`📊 Manager PDF Export: Retrieved cost info for ${costInfo.length} items`);

    const html = generateQuoteHTML(quote, lineItems, company, contact, true, costInfo);
    
    console.log(`📊 Manager PDF Export: Generated HTML (${html.length} chars)`);
    
    // Enhanced Puppeteer configuration for Replit environment
    browser = await puppeteer.launch({ 
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ],
      timeout: 30000
    });
    
    const page = await browser.newPage();
    
    // Set viewport and wait for fonts to load
    await page.setViewport({ width: 1200, height: 800 });
    
    console.log(`📊 Manager PDF Export: Setting HTML content`);
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 20000 
    });
    
    console.log(`📊 Manager PDF Export: Generating PDF`);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      timeout: 30000
    });
    
    await browser.close();
    browser = null;
    
    console.log(`📊 Manager PDF Export: Generated PDF (${pdf.length} bytes)`);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Quote-Manager-${quote.proposalNumber}.pdf"`,
      'Content-Length': pdf.length.toString()
    });
    
    res.send(pdf);
  } catch (error) {
    console.error('📊 Manager PDF export error:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to generate manager PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
