import { Router } from 'express';
import { db } from './db';
import { sql, and, eq, gte, lt, count, desc } from 'drizzle-orm';
import { 
  businessRecords, 
  proposals, 
  purchaseOrders, 
  serviceTickets, 
  invoices,
  quotes,
  equipment 
} from '../shared/schema';

const router = Router();

// DoD Validation endpoints for workflow transitions

// Validate quote readiness for proposal creation
router.get('/validate/quote-to-proposal/:quoteId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { quoteId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const errors = [];

    // Check if quote exists and has required fields
    const [quote] = await db
      .select({
        id: quotes.id,
        title: quotes.title,
        businessRecordId: quotes.businessRecordId,
        status: quotes.status,
        totalAmount: quotes.totalAmount,
        description: quotes.description,
        validUntil: quotes.validUntil
      })
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)))
      .limit(1);

    if (!quote) {
      errors.push({ field: 'quote', message: 'Quote not found', action: 'Create quote first' });
      return res.json({ valid: false, errors });
    }

    // Validate required quote fields
    if (!quote.title?.trim()) {
      errors.push({ 
        field: 'title', 
        message: 'Quote title is required',
        action: 'Add quote title',
        actionLink: `/quotes/${quoteId}/edit`
      });
    }

    if (!quote.businessRecordId) {
      errors.push({ 
        field: 'customer', 
        message: 'Customer assignment is required',
        action: 'Assign customer',
        actionLink: `/quotes/${quoteId}/edit`
      });
    }

    if (!quote.totalAmount || quote.totalAmount <= 0) {
      errors.push({ 
        field: 'amount', 
        message: 'Quote amount must be greater than zero',
        action: 'Add pricing',
        actionLink: `/quotes/${quoteId}/pricing`
      });
    }

    if (!quote.description?.trim()) {
      errors.push({ 
        field: 'description', 
        message: 'Quote description is required',
        action: 'Add description',
        actionLink: `/quotes/${quoteId}/edit`
      });
    }

    if (quote.status === 'draft') {
      errors.push({ 
        field: 'status', 
        message: 'Quote must be finalized before creating proposal',
        action: 'Finalize quote',
        actionLink: `/quotes/${quoteId}/finalize`
      });
    }

    // Check if customer exists and is valid
    if (quote.businessRecordId) {
      const [customer] = await db
        .select({ id: businessRecords.id, name: businessRecords.name })
        .from(businessRecords)
        .where(and(
          eq(businessRecords.id, quote.businessRecordId),
          eq(businessRecords.tenantId, tenantId)
        ))
        .limit(1);

      if (!customer) {
        errors.push({ 
          field: 'customer', 
          message: 'Assigned customer not found',
          action: 'Verify customer',
          actionLink: `/customers`
        });
      }
    }

    res.json({ valid: errors.length === 0, errors });

  } catch (error) {
    console.error('Error validating quote for proposal:', error);
    res.status(500).json({ error: 'Validation check failed' });
  }
});

// Validate proposal readiness for contract creation
router.get('/validate/proposal-to-contract/:proposalId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { proposalId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const errors = [];

    // Check if proposal exists and has required fields
    const [proposal] = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        businessRecordId: proposals.businessRecordId,
        status: proposals.status,
        proposalType: proposals.proposalType,
        executiveSummary: proposals.executiveSummary,
        solutionOverview: proposals.solutionOverview,
        investmentSummary: proposals.investmentSummary,
        termsAndConditions: proposals.termsAndConditions
      })
      .from(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)))
      .limit(1);

    if (!proposal) {
      errors.push({ field: 'proposal', message: 'Proposal not found', action: 'Create proposal first' });
      return res.json({ valid: false, errors });
    }

    // Validate required proposal sections
    if (!proposal.executiveSummary?.trim()) {
      errors.push({ 
        field: 'executive_summary', 
        message: 'Executive summary is required for contract generation',
        action: 'Add executive summary',
        actionLink: `/proposals/${proposalId}/edit#executive-summary`
      });
    }

    if (!proposal.solutionOverview?.trim()) {
      errors.push({ 
        field: 'solution_overview', 
        message: 'Solution overview is required for contract generation',
        action: 'Add solution overview',
        actionLink: `/proposals/${proposalId}/edit#solution-overview`
      });
    }

    if (!proposal.investmentSummary?.trim()) {
      errors.push({ 
        field: 'investment_summary', 
        message: 'Investment summary is required for contract generation',
        action: 'Add investment summary',
        actionLink: `/proposals/${proposalId}/edit#investment-summary`
      });
    }

    if (!proposal.termsAndConditions?.trim()) {
      errors.push({ 
        field: 'terms_conditions', 
        message: 'Terms and conditions are required for contract generation',
        action: 'Add terms and conditions',
        actionLink: `/proposals/${proposalId}/edit#terms-conditions`
      });
    }

    if (proposal.status === 'draft') {
      errors.push({ 
        field: 'status', 
        message: 'Proposal must be finalized before creating contract',
        action: 'Finalize proposal',
        actionLink: `/proposals/${proposalId}/finalize`
      });
    }

    res.json({ valid: errors.length === 0, errors });

  } catch (error) {
    console.error('Error validating proposal for contract:', error);
    res.status(500).json({ error: 'Validation check failed' });
  }
});

// Validate purchase order readiness for warehouse release
router.get('/validate/po-to-warehouse/:poId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { poId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const errors = [];

    // Check if PO exists and has required fields
    const [po] = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        supplierId: purchaseOrders.supplierId,
        expectedDate: purchaseOrders.expectedDate,
        approvedDate: purchaseOrders.approvedDate,
        totalAmount: purchaseOrders.totalAmount
      })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)))
      .limit(1);

    if (!po) {
      errors.push({ field: 'purchase_order', message: 'Purchase order not found' });
      return res.json({ valid: false, errors });
    }

    // Validate PO is approved
    if (po.status !== 'approved') {
      errors.push({ 
        field: 'status', 
        message: 'Purchase order must be approved before warehouse release',
        action: 'Approve PO',
        actionLink: `/admin/purchase-orders/${poId}/approve`
      });
    }

    if (!po.approvedDate) {
      errors.push({ 
        field: 'approval_date', 
        message: 'Purchase order approval date is missing',
        action: 'Complete approval process'
      });
    }

    if (!po.expectedDate) {
      errors.push({ 
        field: 'expected_date', 
        message: 'Expected delivery date is required for warehouse planning',
        action: 'Set expected date',
        actionLink: `/admin/purchase-orders/${poId}/edit`
      });
    }

    res.json({ valid: errors.length === 0, errors });

  } catch (error) {
    console.error('Error validating PO for warehouse:', error);
    res.status(500).json({ error: 'Validation check failed' });
  }
});

// Validate service ticket readiness for completion
router.get('/validate/service-completion/:ticketId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { ticketId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const errors = [];

    // Check if service ticket exists and has required fields
    const [ticket] = await db
      .select({
        id: serviceTickets.id,
        ticketNumber: serviceTickets.ticketNumber,
        status: serviceTickets.status,
        technicianId: serviceTickets.technicianId,
        resolutionNotes: serviceTickets.resolutionNotes,
        workPerformed: serviceTickets.workPerformed,
        partsUsed: serviceTickets.partsUsed,
        timeSpent: serviceTickets.timeSpent,
        customerSignature: serviceTickets.customerSignature
      })
      .from(serviceTickets)
      .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)))
      .limit(1);

    if (!ticket) {
      errors.push({ field: 'service_ticket', message: 'Service ticket not found' });
      return res.json({ valid: false, errors });
    }

    // Validate completion requirements
    if (!ticket.resolutionNotes?.trim()) {
      errors.push({ 
        field: 'resolution_notes', 
        message: 'Resolution notes are required for ticket completion',
        action: 'Add resolution notes',
        actionLink: `/service-hub/${ticketId}/complete`
      });
    }

    if (!ticket.workPerformed?.trim()) {
      errors.push({ 
        field: 'work_performed', 
        message: 'Work performed description is required',
        action: 'Document work performed',
        actionLink: `/service-hub/${ticketId}/complete`
      });
    }

    if (!ticket.timeSpent || ticket.timeSpent <= 0) {
      errors.push({ 
        field: 'time_spent', 
        message: 'Time spent must be recorded',
        action: 'Record time spent',
        actionLink: `/service-hub/${ticketId}/time`
      });
    }

    if (!ticket.customerSignature) {
      errors.push({ 
        field: 'customer_signature', 
        message: 'Customer signature is required for completion',
        action: 'Obtain customer signature',
        actionLink: `/service-hub/${ticketId}/signature`
      });
    }

    res.json({ valid: errors.length === 0, errors });

  } catch (error) {
    console.error('Error validating service completion:', error);
    res.status(500).json({ error: 'Validation check failed' });
  }
});

export default router;