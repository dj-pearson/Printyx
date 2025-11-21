import express from "express";
import { eq, and, count, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { 
  businessRecords, 
  quotes, 
  proposals, 
  serviceTickets, 
  purchaseOrders,
  warehouseKittingOperations
} from "@shared/schema";

const router = express.Router();

// Validate quote readiness for proposal creation
router.get("/validate/quote-to-proposal/:quoteId", async (req, res) => {
  try {
    const { quoteId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    // Check if quote has required items and contact info
    const [quote] = await db
      .select({
        id: quotes.id,
        customerId: quotes.customerId,
        totalAmount: quotes.totalAmount,
        status: quotes.status,
        lineItems: quotes.lineItems,
      })
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          eq(quotes.id, quoteId)
        )
      )
      .limit(1);

    if (!quote) {
      return res.status(404).json({ 
        valid: false, 
        errors: ["Quote not found"] 
      });
    }

    const errors: string[] = [];
    
    // Validate quote has items
    if (!quote.lineItems || (Array.isArray(quote.lineItems) && quote.lineItems.length === 0)) {
      errors.push("Quote must have at least one line item");
    }

    // Validate total amount is greater than zero
    if (!quote.totalAmount || parseFloat(quote.totalAmount) <= 0) {
      errors.push("Quote must have a total amount greater than zero");
    }

    // Validate customer exists and has contact info
    if (quote.customerId) {
      const [customer] = await db
        .select({
          contactName: businessRecords.contactName,
          email: businessRecords.email,
          phone: businessRecords.phone,
        })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.id, quote.customerId)
          )
        )
        .limit(1);

      if (!customer) {
        errors.push("Customer not found for this quote");
      } else {
        if (!customer.contactName) {
          errors.push("Customer must have a contact name");
        }
        if (!customer.email && !customer.phone) {
          errors.push("Customer must have either email or phone contact information");
        }
      }
    } else {
      errors.push("Quote must be associated with a customer");
    }

    res.json({
      valid: errors.length === 0,
      errors,
      quoteId,
      nextAction: errors.length === 0 ? "CREATE_PROPOSAL" : "FIX_REQUIREMENTS"
    });

  } catch (error) {
    console.error("Error validating quote for proposal:", error);
    res.status(500).json({ error: "Failed to validate quote" });
  }
});

// Validate proposal readiness for contract generation
router.get("/validate/proposal-to-contract/:proposalId", async (req, res) => {
  try {
    const { proposalId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    const [proposal] = await db
      .select({
        id: proposals.id,
        status: proposals.status,
        content: proposals.content,
        sections: proposals.sections,
        branding: proposals.branding,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.tenantId, tenantId),
          eq(proposals.id, proposalId)
        )
      )
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ 
        valid: false, 
        errors: ["Proposal not found"] 
      });
    }

    const errors: string[] = [];
    
    // Validate proposal has required sections
    const requiredSections = ['executive_summary', 'solution_overview', 'pricing', 'terms'];
    const sections = proposal.sections as any[] || [];
    
    for (const requiredSection of requiredSections) {
      const sectionExists = sections.some(s => s.type === requiredSection && s.content);
      if (!sectionExists) {
        errors.push(`Proposal missing required section: ${requiredSection.replace('_', ' ')}`);
      }
    }

    // Validate branding is applied
    if (!proposal.branding) {
      errors.push("Proposal must have branding/template applied");
    }

    // Validate content exists
    if (!proposal.content || (typeof proposal.content === 'string' && proposal.content.trim().length < 100)) {
      errors.push("Proposal content must be substantial (at least 100 characters)");
    }

    res.json({
      valid: errors.length === 0,
      errors,
      proposalId,
      nextAction: errors.length === 0 ? "GENERATE_CONTRACT" : "COMPLETE_PROPOSAL"
    });

  } catch (error) {
    console.error("Error validating proposal for contract:", error);
    res.status(500).json({ error: "Failed to validate proposal" });
  }
});

// Validate purchase order readiness for warehouse release
router.get("/validate/po-to-warehouse/:poId", async (req, res) => {
  try {
    const { poId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    const [po] = await db
      .select({
        id: purchaseOrders.id,
        status: purchaseOrders.status,
        approvedDate: purchaseOrders.approvedDate,
        vendorId: purchaseOrders.vendorId,
        totalAmount: purchaseOrders.totalAmount,
        lineItems: purchaseOrders.lineItems,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          eq(purchaseOrders.id, poId)
        )
      )
      .limit(1);

    if (!po) {
      return res.status(404).json({ 
        valid: false, 
        errors: ["Purchase order not found"] 
      });
    }

    const errors: string[] = [];
    
    // Validate PO is approved
    if (po.status !== 'approved') {
      errors.push("Purchase order must be approved before warehouse release");
    }

    // Validate approval date exists
    if (!po.approvedDate) {
      errors.push("Purchase order must have an approved date");
    }

    // Validate vendor is set
    if (!po.vendorId) {
      errors.push("Purchase order must have a vendor assigned");
    }

    // Validate has line items
    if (!po.lineItems || (Array.isArray(po.lineItems) && po.lineItems.length === 0)) {
      errors.push("Purchase order must have line items");
    }

    // Validate total amount
    if (!po.totalAmount || parseFloat(po.totalAmount) <= 0) {
      errors.push("Purchase order must have a valid total amount");
    }

    res.json({
      valid: errors.length === 0,
      errors,
      poId,
      nextAction: errors.length === 0 ? "RELEASE_TO_WAREHOUSE" : "COMPLETE_PO_REQUIREMENTS"
    });

  } catch (error) {
    console.error("Error validating PO for warehouse:", error);
    res.status(500).json({ error: "Failed to validate purchase order" });
  }
});

// Validate warehouse kitting readiness for delivery
router.get("/validate/kitting-to-delivery/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    const [operation] = await db
      .select({
        id: warehouseKittingOperations.id,
        operationStatus: warehouseKittingOperations.operationStatus,
        qualityStatus: warehouseKittingOperations.qualityStatus,
        defectsFound: warehouseKittingOperations.defectsFound,
        itemsProcessed: warehouseKittingOperations.itemsProcessed,
      })
      .from(warehouseKittingOperations)
      .where(
        and(
          eq(warehouseKittingOperations.tenantId, tenantId),
          eq(warehouseKittingOperations.id, operationId)
        )
      )
      .limit(1);

    if (!operation) {
      return res.status(404).json({ 
        valid: false, 
        errors: ["Warehouse operation not found"] 
      });
    }

    const errors: string[] = [];
    
    // Validate operation is completed
    if (operation.operationStatus !== 'completed') {
      errors.push("Warehouse kitting operation must be completed");
    }

    // Validate quality check passed
    if (operation.qualityStatus !== 'pass') {
      errors.push("Warehouse kitting must pass quality check");
    }

    // Validate items were processed
    if (!operation.itemsProcessed || operation.itemsProcessed <= 0) {
      errors.push("Warehouse operation must have processed items");
    }

    // Validate no critical defects
    if (operation.defectsFound && operation.defectsFound > 0) {
      errors.push(`Warehouse operation has ${operation.defectsFound} defects that must be resolved`);
    }

    res.json({
      valid: errors.length === 0,
      errors,
      operationId,
      nextAction: errors.length === 0 ? "SCHEDULE_DELIVERY" : "RESOLVE_QUALITY_ISSUES"
    });

  } catch (error) {
    console.error("Error validating kitting for delivery:", error);
    res.status(500).json({ error: "Failed to validate warehouse operation" });
  }
});

// Get validation summary for entire order workflow
router.get("/validate/order-workflow/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    // This would typically involve checking multiple steps
    // For now, return a summary structure
    const workflow = {
      orderId,
      steps: [
        { name: "Quote Creation", status: "completed", canProceed: true },
        { name: "Proposal Generation", status: "completed", canProceed: true },
        { name: "Contract Signing", status: "pending", canProceed: false, blockers: ["Awaiting customer signature"] },
        { name: "Purchase Order", status: "not_started", canProceed: false, blockers: ["Contract must be signed first"] },
        { name: "Warehouse Kitting", status: "not_started", canProceed: false, blockers: ["PO must be approved first"] },
        { name: "Delivery", status: "not_started", canProceed: false, blockers: ["Kitting must be completed first"] },
      ],
      overallStatus: "blocked",
      nextAction: "Complete contract signing",
      estimatedCompletionDays: 7
    };

    res.json(workflow);

  } catch (error) {
    console.error("Error getting order workflow validation:", error);
    res.status(500).json({ error: "Failed to get workflow validation" });
  }
});

export default router;