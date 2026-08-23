import express from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-enhanced-service');

import {
  technicianTicketSessions,
  ticketPartsRequests,
  workflowSteps,
  insertTechnicianTicketSessionSchema,
  insertTicketPartsRequestSchema,
} from '@shared/enhanced-service-schema';
import { serviceTickets, customers, businessRecords } from '@shared/schema';
import { requireServiceAccess } from './rbac-middleware';
import { CustomerPortalService } from './services/customer-portal-service';
import { billingEngine } from './services/billing-engine-service';
import { updateServiceRequestStatusSchema } from '@shared/customer-portal-schema';

const router = express.Router();
const customerPortalService = new CustomerPortalService();

// ============= SERVICE REQUEST ADMIN MANAGEMENT =============

// Update service request status (ADMIN/DEALER ONLY) - SECURE VERSION
router.put(
  '/service-requests/:requestId/status',
  requireServiceAccess(2),
  async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { requestId } = req.params;
      const userId = req.user?.claims?.sub;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Missing tenant context',
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Missing user authentication',
        });
      }

      // Validate request body using shared schema
      const validationResult = updateServiceRequestStatusSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request parameters',
          errors: validationResult.error.errors,
        });
      }

      // Validate required fields for admin updates
      const statusData = validationResult.data;
      if (!statusData.changedByName) {
        return res.status(400).json({
          success: false,
          message: 'changedByName is required for status updates',
        });
      }

      // Determine user type from RBAC context
      let changedByType: 'dealer_user' | 'system' | 'technician' = 'dealer_user';
      if (req.user.department === 'service' && req.user.roleLevel <= 2) {
        changedByType = 'technician';
      }

      const result = await customerPortalService.updateServiceRequestStatus(
        tenantId,
        requestId,
        statusData,
        changedByType,
        userId,
      );

      res.json({
        success: true,
        data: result,
        message: 'Service request status updated successfully',
      });
    } catch (error) {
      log.error('Error updating service request status:', error);

      if (error instanceof Error && error.message === 'Service request not found') {
        return res.status(404).json({
          success: false,
          message: 'Service request not found',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update service request status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// Get all service requests for admin management (ADMIN/DEALER ONLY)
router.get('/service-requests', requireServiceAccess(2), async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { status, limit = 50, offset = 0 } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing tenant context',
      });
    }

    const requests = await customerPortalService.getAllServiceRequests(tenantId, {
      status,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    log.error('Error fetching service requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get customers for phone-in ticket form
router.get('/customers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { search } = req.query;

    let query = db
      .select({
        id: businessRecords.id,
        companyName: businessRecords.companyName,
        primaryContactName: businessRecords.primaryContactName,
        primaryContactEmail: businessRecords.primaryContactEmail,
        primaryContactPhone: businessRecords.primaryContactPhone,
        // `address` is not a column (dropped — addressLine1 beside it is the real
        // one), and `type` is not either: the real discriminator is `record_type`
        // (lead | customer | former_customer).
        addressLine1: businessRecords.addressLine1,
        city: businessRecords.city,
        state: businessRecords.state,
        type: businessRecords.recordType,
      })
      .from(businessRecords)
      .where(
        and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
      );

    if (search) {
      query = query.where(
        sql`(${businessRecords.companyName} ILIKE ${'%' + search + '%'} OR 
             ${businessRecords.primaryContactName} ILIKE ${'%' + search + '%'} OR
             ${businessRecords.primaryContactPhone} ILIKE ${'%' + search + '%'})`,
      );
    }

    const customers = await query.limit(50);
    res.json(customers);
  } catch (error) {
    log.error('Error fetching customers for phone-in tickets:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Technician check-in to service ticket
router.post('/service-tickets/:ticketId/check-in', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    const technicianId = req.headers['x-user-id'] as string; // Assuming technician ID from auth

    const sessionData = insertTechnicianTicketSessionSchema.parse({
      ...req.body,
      tenantId,
      serviceTicketId: ticketId,
      technicianId,
    });

    // Check if session already exists
    const existingSession = await db
      .select()
      .from(technicianTicketSessions)
      .where(
        and(
          eq(technicianTicketSessions.serviceTicketId, ticketId),
          eq(technicianTicketSessions.technicianId, technicianId),
          sql`${technicianTicketSessions.checkOutTimestamp} IS NULL`,
        ),
      )
      .limit(1);

    if (existingSession.length > 0) {
      return res.json(existingSession[0]);
    }

    // Create new session
    const [session] = await db.insert(technicianTicketSessions).values(sessionData).returning();

    // Update service ticket status
    await db
      .update(serviceTickets)
      .set({
        status: 'on_site',
        updatedAt: new Date(),
      })
      .where(eq(serviceTickets.id, ticketId));

    // Create initial workflow step
    await db.insert(workflowSteps).values({
      tenantId,
      sessionId: session.id,
      stepName: 'initial_assessment',
      stepData: {},
    });

    res.json(session);
  } catch (error) {
    log.error('Error checking in technician:', error);
    res.status(500).json({ error: 'Failed to check in technician' });
  }
});

// Get technician session for ticket
router.get('/service-tickets/:ticketId/session', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const technicianId = req.headers['x-user-id'] as string;

    const session = await db
      .select()
      .from(technicianTicketSessions)
      .where(
        and(
          eq(technicianTicketSessions.serviceTicketId, ticketId),
          eq(technicianTicketSessions.technicianId, technicianId),
          sql`${technicianTicketSessions.checkOutTimestamp} IS NULL`,
        ),
      )
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: 'No active session found' });
    }

    res.json(session[0]);
  } catch (error) {
    log.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Request parts for ticket
router.post('/service-tickets/:ticketId/request-parts', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    const partsData = insertTicketPartsRequestSchema.parse({
      ...req.body,
      tenantId,
      serviceTicketId: ticketId,
    });

    const [partsRequest] = await db.insert(ticketPartsRequests).values(partsData).returning();

    // You might want to send notifications or trigger approval workflows here

    res.json(partsRequest);
  } catch (error) {
    log.error('Error requesting parts:', error);
    res.status(500).json({ error: 'Failed to request parts' });
  }
});

// Get parts requests for ticket
router.get('/service-tickets/:ticketId/parts-requests', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    const partsRequests = await db
      .select()
      .from(ticketPartsRequests)
      .where(
        and(
          eq(ticketPartsRequests.tenantId, tenantId),
          eq(ticketPartsRequests.serviceTicketId, ticketId),
        ),
      )
      .orderBy(desc(ticketPartsRequests.createdAt));

    res.json(partsRequests);
  } catch (error) {
    log.error('Error fetching parts requests:', error);
    res.status(500).json({ error: 'Failed to fetch parts requests' });
  }
});

// Complete service ticket
router.post('/service-tickets/:ticketId/complete', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { sessionId, ...completionData } = req.body;
    const now = new Date();

    // Update session with completion data
    await db
      .update(technicianTicketSessions)
      .set({
        checkOutTimestamp: now,
        issueResolved: completionData.issueResolved !== false,
        followUpRequired: completionData.followUpRequired || false,
        followUpReason: completionData.followUpReason,
        customerSatisfactionRating: completionData.customerSatisfaction,
        customerFeedback: completionData.customerFeedback,
        workflowStep: 'completion',
        updatedAt: now,
      })
      .where(eq(technicianTicketSessions.id, sessionId));

    // Mark completion workflow step
    await db
      .update(workflowSteps)
      .set({
        stepCompleted: now,
        stepData: completionData,
        notes: completionData.notes,
      })
      .where(and(eq(workflowSteps.sessionId, sessionId), eq(workflowSteps.stepName, 'completion')));

    // Update service ticket
    const ticketStatus = completionData.followUpRequired ? 'follow_up_required' : 'completed';

    await db
      .update(serviceTickets)
      .set({
        status: ticketStatus,
        resolvedAt: completionData.followUpRequired ? null : now,
        resolutionNotes: completionData.notes,
        customerSignature: completionData.customerSignature,
        updatedAt: now,
      })
      .where(eq(serviceTickets.id, ticketId));

    // Auto-invoice generation on completion using billing engine service
    if (!completionData.followUpRequired) {
      try {
        const [ticket] = await db
          .select({
            tenantId: serviceTickets.tenantId,
          })
          .from(serviceTickets)
          .where(eq(serviceTickets.id, ticketId))
          .limit(1);

        if (ticket) {
          // Use centralized billing engine service for auto-invoice generation
          await billingEngine.autoGenerateFromServiceTicket(ticketId, ticket.tenantId);
        }
      } catch (invErr) {
        log.error('Auto-invoice generation failed:', invErr);
        // Non-fatal error - ticket completion should succeed even if invoicing fails
      }
    }

    res.json({ success: true, status: ticketStatus });
  } catch (error) {
    log.error('Error completing service ticket:', error);
    res.status(500).json({ error: 'Failed to complete service ticket' });
  }
});

// Customer search endpoint
router.get('/customers/search', async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!searchTerm || (searchTerm as string).length < 2) {
      return res.json([]);
    }

    // `customers` is an alias of businessRecords (shared/schema.ts:1470). None of
    // name/phone/email/address are columns on business_records — the real ones are
    // companyName, primaryContactPhone, primaryContactEmail and addressLine1 — so
    // this query referenced four columns that do not exist and threw at runtime.
    // The PRIMARY contact is the right mapping for a general customer search;
    // billingContact* is the finance-specific pair and would be wrong here.
    // The response keys are kept as name/phone/email/address so the API contract
    // this endpoint already advertises to its callers does not change.
    const searchResults = await db
      .select({
        id: customers.id,
        name: customers.companyName,
        phone: customers.primaryContactPhone,
        email: customers.primaryContactEmail,
        address: customers.addressLine1,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          sql`(
            LOWER(${customers.companyName}) LIKE LOWER(${'%' + searchTerm + '%'}) OR
            LOWER(${customers.primaryContactPhone}) LIKE LOWER(${'%' + searchTerm + '%'}) OR
            LOWER(${customers.primaryContactEmail}) LIKE LOWER(${'%' + searchTerm + '%'})
          )`,
        ),
      )
      .limit(10);

    res.json(searchResults);
  } catch (error) {
    log.error('Error searching customers:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

// Approve parts request
router.post('/parts-requests/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { approvedBy, estimatedCost, vendorId, expectedDeliveryDate } = req.body;

    await db
      .update(ticketPartsRequests)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
        estimatedCost,
        vendorId,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        updatedAt: new Date(),
      })
      .where(eq(ticketPartsRequests.id, requestId));

    res.json({ success: true });
  } catch (error) {
    log.error('Error approving parts request:', error);
    res.status(500).json({ error: 'Failed to approve parts request' });
  }
});

// Reject parts request
router.post('/parts-requests/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectedReason } = req.body;

    await db
      .update(ticketPartsRequests)
      .set({
        status: 'rejected',
        rejectedReason,
        updatedAt: new Date(),
      })
      .where(eq(ticketPartsRequests.id, requestId));

    res.json({ success: true });
  } catch (error) {
    log.error('Error rejecting parts request:', error);
    res.status(500).json({ error: 'Failed to reject parts request' });
  }
});

// Equipment search by company endpoint
router.get('/phone-tickets/equipment/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    // Search equipment for the company - using service tickets as proxy for equipment
    const equipment = await db
      .select({
        id: serviceTickets.id,
        brand: sql`'Canon'`.as('brand'),
        model: sql`'imageRUNNER ADVANCE'`.as('model'),
        serial:
          sql`CONCAT('SN', LPAD(CAST(EXTRACT(epoch FROM ${serviceTickets.createdAt}) AS TEXT), 8, '0'))`.as(
            'serial',
          ),
      })
      .from(serviceTickets)
      .where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.customerId, companyId)))
      .limit(10);

    res.json(equipment);
  } catch (error) {
    log.error('Error fetching equipment for company:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Search contacts by company endpoint
router.get('/phone-tickets/search-contacts/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    // contactName/email/phone/jobTitle are NOT columns on business_records; the real
    // ones are primaryContactName/primaryContactEmail/primaryContactPhone/
    // primaryContactTitle, so this query threw at runtime.
    //
    // KNOWN LIMITATION, left as-is deliberately: despite the name and the .limit(20),
    // this cannot return a contact LIST. It filters business_records by primary key
    // (eq(id, companyId)), so it returns at most ONE row — the company's own primary
    // contact. The canonical contacts table is companyContacts (CLAUDE.md: "contact =
    // companyContacts"), and pointing this endpoint there is the real fix. That is a
    // behavioural change to the response (one row -> N contacts) and belongs to the
    // CRM consolidation work (CRMX-007), not to a typecheck batch. Mapping the columns
    // makes it return REAL data instead of throwing; it does not make it correct.
    const contacts = await db
      .select({
        id: businessRecords.id,
        name: businessRecords.primaryContactName,
        email: businessRecords.primaryContactEmail,
        phone: businessRecords.primaryContactPhone,
        role: businessRecords.primaryContactTitle,
      })
      .from(businessRecords)
      .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.id, companyId)))
      .limit(20);

    res.json(contacts);
  } catch (error) {
    log.error('Error searching contacts:', error);
    res.status(500).json({ error: 'Failed to search contacts' });
  }
});

export default router;
