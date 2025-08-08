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
} from "../shared/schema.js";
import { businessRecords } from "../shared/schema.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
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
    const updateData = { ...req.body, updatedAt: new Date() };

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
    const { status, businessRecordId } = req.query;

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

    const conditions = [eq(proposals.tenantId, req.user.tenantId)];

    if (status) {
      conditions.push(eq(proposals.status, status as string));
    }

    if (businessRecordId) {
      conditions.push(
        eq(proposals.businessRecordId, businessRecordId as string)
      );
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
    const updateData = { ...req.body, updatedAt: new Date() };
    const lineItemsToUpdate = updateData.lineItems;
    delete updateData.lineItems; // Handle line items separately

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
    const updateData = { ...req.body, updatedAt: new Date() };
    const lineItemsToUpdate = updateData.lineItems;
    delete updateData.lineItems; // Handle line items separately

    console.log("📝 PATCH /api/proposals/:id - Updating proposal:", id);
    console.log("📝 Update data:", updateData);
    console.log("📝 Line items to update:", lineItemsToUpdate);

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

      console.log("📦 Inserting line items:", lineItemsData);

      const insertedLineItems = await db
        .insert(proposalLineItems)
        .values(lineItemsData)
        .returning();

      console.log("✅ Inserted line items:", insertedLineItems);
    }

    res.json(proposal);
  } catch (error) {
    console.error("Error updating proposal:", error);
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

export default router;
