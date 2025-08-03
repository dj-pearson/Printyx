import { Router } from "express";
import { db } from "./db.js";
import { 
  proposals, 
  proposalLineItems, 
  proposalTemplates, 
  equipmentPackages,
  proposalComments,
  proposalAnalytics,
  proposalApprovals
} from "../shared/schema.js";
import { businessRecords } from "../shared/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { 
  insertProposalSchema,
  insertProposalLineItemSchema,
  insertProposalTemplateSchema,
  insertEquipmentPackageSchema,
  insertProposalCommentSchema,
  insertProposalAnalyticsSchema,
  insertProposalApprovalSchema
} from "../shared/schema.js";

const router = Router();

// ============= PROPOSAL TEMPLATES =============

// Basic auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || "550e8400-e29b-41d4-a716-446655440000"
    };
  } else if (!req.user.tenantId && !req.user.id) {
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId: req.user.tenantId || req.session?.tenantId || "550e8400-e29b-41d4-a716-446655440000"
    };
  }
  next();
};

// Get all proposal templates
router.get("/proposal-templates", requireAuth, async (req: any, res) => {
  try {
    const templates = await db
      .select()
      .from(proposalTemplates)
      .where(eq(proposalTemplates.tenantId, req.user.tenantId))
      .orderBy(proposalTemplates.templateName);
    
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
      createdBy: req.user.id
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
      .where(and(
        eq(proposalTemplates.id, id),
        eq(proposalTemplates.tenantId, req.user.tenantId)
      ))
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
      tenantId: req.user.tenantId
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
        customerEmail: businessRecords.primaryContactEmail
      })
      .from(proposals)
      .leftJoin(businessRecords, eq(proposals.businessRecordId, businessRecords.id));
    
    const conditions = [eq(proposals.tenantId, req.user.tenantId)];
    
    if (status) {
      conditions.push(eq(proposals.status, status as string));
    }
    
    if (businessRecordId) {
      conditions.push(eq(proposals.businessRecordId, businessRecordId as string));
    }
    
    const query = baseQuery.where(and(...conditions));
    
    const result = await query.orderBy(desc(proposals.createdAt));
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

// Get proposal by ID with line items
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Get proposal with customer info
    const [proposal] = await db
      .select({
        id: proposals.id,
        tenantId: proposals.tenantId,
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
        updatedAt: proposals.updatedAt,
        customerName: businessRecords.companyName,
        customerEmail: businessRecords.primaryContactEmail,
        customerPhone: businessRecords.primaryContactPhone,
        customerAddress: businessRecords.address
      })
      .from(proposals)
      .leftJoin(businessRecords, eq(proposals.businessRecordId, businessRecords.id))
      .where(and(
        eq(proposals.id, id),
        eq(proposals.tenantId, req.user.tenantId)
      ));
    
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    
    // Get line items
    const lineItems = await db
      .select()
      .from(proposalLineItems)
      .where(and(
        eq(proposalLineItems.proposalId, id),
        eq(proposalLineItems.tenantId, req.user.tenantId)
      ))
      .orderBy(proposalLineItems.lineNumber);
    
    // Get comments
    const comments = await db
      .select()
      .from(proposalComments)
      .where(and(
        eq(proposalComments.proposalId, id),
        eq(proposalComments.tenantId, req.user.tenantId)
      ))
      .orderBy(proposalComments.createdAt);
    
    res.json({
      ...proposal,
      lineItems,
      comments
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).json({ error: "Failed to fetch proposal" });
  }
});

// Create new proposal
router.post("/", requireAuth, async (req: any, res) => {
  try {
    // Generate proposal number
    const proposalNumber = await generateProposalNumber(req.user.tenantId);
    
    const validatedData = insertProposalSchema.parse({
      ...req.body,
      tenantId: req.user.tenantId,
      proposalNumber,
      createdBy: req.user.id,
      assignedTo: req.user.id // Default to creator
    });
    
    const [proposal] = await db
      .insert(proposals)
      .values([validatedData])
      .returning();
    
    // If line items provided, add them
    if (req.body.lineItems && req.body.lineItems.length > 0) {
      const lineItemsData = req.body.lineItems.map((item: any, index: number) => ({
        ...item,
        tenantId: req.user.tenantId,
        proposalId: proposal.id,
        lineNumber: index + 1
      }));
      
      const lineItems = await db
        .insert(proposalLineItems)
        .values(lineItemsData)
        .returning();
      
      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => 
        sum + parseFloat(item.totalPrice || "0"), 0
      );
      
      // Update proposal with calculated totals
      await db
        .update(proposals)
        .set({
          subtotal: subtotal.toString(),
          totalAmount: subtotal.toString(), // Simple case without tax/discount
          updatedAt: new Date()
        })
        .where(eq(proposals.id, proposal.id));
    }
    
    res.status(201).json(proposal);
  } catch (error) {
    console.error("Error creating proposal:", error);
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

// Update proposal
router.put("/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.lineItems; // Handle line items separately
    
    const [proposal] = await db
      .update(proposals)
      .set(updateData)
      .where(and(
        eq(proposals.id, id),
        eq(proposals.tenantId, req.user.tenantId)
      ))
      .returning();
    
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
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
      case 'sent':
        updateData.sentAt = new Date();
        break;
      case 'viewed':
        updateData.viewedAt = new Date();
        break;
      case 'accepted':
        updateData.acceptedAt = new Date();
        break;
      case 'rejected':
        updateData.rejectedAt = new Date();
        break;
    }
    
    const [proposal] = await db
      .update(proposals)
      .set(updateData)
      .where(and(
        eq(proposals.id, id),
        eq(proposals.tenantId, req.user.tenantId)
      ))
      .returning();
    
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    
    // Track analytics event
    await db.insert(proposalAnalytics).values([{
      proposalId: id,
      eventType: `status_${status}`,
      eventDetails: { previousStatus: req.body.previousStatus, newStatus: status }
    }]);
    
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
      .select({ maxLineNumber: sql<number>`COALESCE(MAX(${proposalLineItems.lineNumber}), 0)` })
      .from(proposalLineItems)
      .where(and(
        eq(proposalLineItems.proposalId, proposalId),
        eq(proposalLineItems.tenantId, req.user.tenantId)
      ));
    
    const validatedData = insertProposalLineItemSchema.parse({
      ...req.body,
      tenantId: req.user.tenantId,
      proposalId,
      lineNumber: maxLineNumber + 1
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
router.put("/:proposalId/line-items/:lineItemId", requireAuth, async (req: any, res) => {
  try {
    const { proposalId, lineItemId } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    
    const [lineItem] = await db
      .update(proposalLineItems)
      .set(updateData)
      .where(and(
        eq(proposalLineItems.id, lineItemId),
        eq(proposalLineItems.proposalId, proposalId),
        eq(proposalLineItems.tenantId, req.user.tenantId)
      ))
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
});

// Delete line item
router.delete("/:proposalId/line-items/:lineItemId", requireAuth, async (req: any, res) => {
  try {
    const { proposalId, lineItemId } = req.params;
    
    const result = await db
      .delete(proposalLineItems)
      .where(and(
        eq(proposalLineItems.id, lineItemId),
        eq(proposalLineItems.proposalId, proposalId),
        eq(proposalLineItems.tenantId, req.user.tenantId)
      ));
    
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
});

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
      authorName: req.user.displayName || req.user.email
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
        updatedAt: new Date()
      })
      .where(eq(proposals.id, id));
    
    // Track analytics event
    await db.insert(proposalAnalytics).values([{
      proposalId: id,
      eventType: 'opened',
      eventDetails: {
        deviceType: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      }
    }]);
    
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
    .where(and(
      eq(proposals.tenantId, tenantId),
      sql`${proposals.proposalNumber} LIKE ${prefix + '%'}`
    ))
    .orderBy(desc(proposals.proposalNumber))
    .limit(1);
  
  let nextNumber = 1;
  if (latestProposal) {
    const currentNumber = parseInt(latestProposal.proposalNumber.replace(prefix, ''));
    nextNumber = currentNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

async function recalculateProposalTotals(proposalId: string, tenantId: string) {
  const lineItems = await db
    .select()
    .from(proposalLineItems)
    .where(and(
      eq(proposalLineItems.proposalId, proposalId),
      eq(proposalLineItems.tenantId, tenantId)
    ));
  
  const subtotal = lineItems.reduce((sum, item) => 
    sum + parseFloat(item.totalPrice || "0"), 0
  );
  
  // Get current proposal for discount calculation
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(
      eq(proposals.id, proposalId),
      eq(proposals.tenantId, tenantId)
    ));
  
  if (proposal) {
    const discountAmount = parseFloat(proposal.discountAmount || "0");
    const taxAmount = parseFloat(proposal.taxAmount || "0");
    const totalAmount = subtotal - discountAmount + taxAmount;
    
    await db
      .update(proposals)
      .set({
        subtotal: subtotal.toString(),
        totalAmount: totalAmount.toString(),
        updatedAt: new Date()
      })
      .where(eq(proposals.id, proposalId));
  }
}

export default router;