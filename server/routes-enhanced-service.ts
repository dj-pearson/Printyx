import express from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import { 
  phoneInTickets, 
  technicianTicketSessions, 
  ticketPartsRequests,
  workflowSteps,
  insertPhoneInTicketSchema,
  insertTechnicianTicketSessionSchema,
  insertTicketPartsRequestSchema,
  insertWorkflowStepSchema,
  type PhoneInTicket,
  type TechnicianTicketSession,
  type TicketPartsRequest,
} from "@shared/enhanced-service-schema";
import { serviceTickets, customers, businessRecords, autoInvoiceGeneration, insertAutoInvoiceGenerationSchema } from "@shared/schema";

const router = express.Router();

// Create phone-in ticket
router.post("/phone-in-tickets", async (req, res) => {
  try {
    const validatedData = insertPhoneInTicketSchema.parse(req.body);
    const tenantId = req.headers["x-tenant-id"] as string;

    // If customerId is provided, fetch customer info from business_records
    let customerInfo = {};
    if (validatedData.customerId) {
      const [customer] = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          primaryContactName: businessRecords.primaryContactName,
          primaryContactEmail: businessRecords.primaryContactEmail,
          primaryContactPhone: businessRecords.primaryContactPhone,
          address: businessRecords.address,
          addressLine1: businessRecords.addressLine1,
          addressLine2: businessRecords.addressLine2,
          city: businessRecords.city,
          state: businessRecords.state,
          postalCode: businessRecords.postalCode,
        })
        .from(businessRecords)
        .where(and(
          eq(businessRecords.id, validatedData.customerId),
          eq(businessRecords.tenantId, tenantId)
        ))
        .limit(1);

      if (customer) {
        const fullAddress = [
          customer.address || [customer.addressLine1, customer.addressLine2].filter(Boolean).join(', '),
          customer.city,
          customer.state,
          customer.postalCode
        ].filter(Boolean).join(', ');

        customerInfo = {
          customerName: customer.companyName || customer.primaryContactName || 'Unknown Customer',
          locationAddress: fullAddress || validatedData.locationAddress,
          callerName: validatedData.callerName || customer.primaryContactName,
          callerPhone: validatedData.callerPhone || customer.primaryContactPhone,
          callerEmail: validatedData.callerEmail || customer.primaryContactEmail,
        };
      }
    }

    const [phoneTicket] = await db
      .insert(phoneInTickets)
      .values({
        ...validatedData,
        ...customerInfo,
        tenantId,
      })
      .returning();

    // If createServiceTicket is true, convert to service ticket
    if (req.body.createServiceTicket) {
      const ticketNumber = `TK-${Date.now()}`;
      
      const [serviceTicket] = await db
        .insert(serviceTickets)
        .values({
          tenantId,
          customerId: phoneTicket.customerId || 'unknown',
          ticketNumber,
          title: `${phoneTicket.issueCategory.replace('_', ' ')} - ${phoneTicket.customerName}`,
          description: phoneTicket.issueDescription,
          priority: phoneTicket.priority,
          status: 'new',
          customerAddress: phoneTicket.locationAddress,
          customerPhone: phoneTicket.callerPhone,
          workOrderNotes: `
Phone-in ticket details:
- Caller: ${phoneTicket.callerName} (${phoneTicket.callerRole || 'Not specified'})
- Issue Category: ${phoneTicket.issueCategory.replace('_', ' ')}
- Equipment: ${phoneTicket.equipmentBrand || 'Not specified'} ${phoneTicket.equipmentModel || ''}
- Preferred Service Time: ${phoneTicket.preferredServiceTime || 'Not specified'}
- Troubleshooting Attempted: ${phoneTicket.troubleshootingAttempted || 'None specified'}
- Business Impact: ${phoneTicket.businessImpact || 'Not specified'}
- Affected Users: ${phoneTicket.affectedUsers || 'Not specified'}
- Special Instructions: ${phoneTicket.specialInstructions || 'None'}
          `.trim(),
          createdBy: phoneTicket.handledBy,
        })
        .returning();

      // Update phone ticket with conversion info
      await db
        .update(phoneInTickets)
        .set({
          convertedToTicketId: serviceTicket.id,
          convertedAt: new Date(),
        })
        .where(eq(phoneInTickets.id, phoneTicket.id));

      res.json({ phoneTicket, serviceTicket });
    } else {
      res.json({ phoneTicket });
    }
  } catch (error) {
    console.error("Error creating phone-in ticket:", error);
    res.status(500).json({ error: "Failed to create phone-in ticket" });
  }
});

// Get customers for phone-in ticket form
router.get("/customers", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { search } = req.query;
    
    let query = db
      .select({
        id: businessRecords.id,
        companyName: businessRecords.companyName,
        primaryContactName: businessRecords.primaryContactName,
        primaryContactEmail: businessRecords.primaryContactEmail,
        primaryContactPhone: businessRecords.primaryContactPhone,
        address: businessRecords.address,
        addressLine1: businessRecords.addressLine1,
        city: businessRecords.city,
        state: businessRecords.state,
        type: businessRecords.type,
      })
      .from(businessRecords)
      .where(and(
        eq(businessRecords.tenantId, tenantId),
        eq(businessRecords.type, 'customer')
      ));

    if (search) {
      query = query.where(
        sql`(${businessRecords.companyName} ILIKE ${'%' + search + '%'} OR 
             ${businessRecords.primaryContactName} ILIKE ${'%' + search + '%'} OR
             ${businessRecords.primaryContactPhone} ILIKE ${'%' + search + '%'})`
      );
    }

    const customers = await query.limit(50);
    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers for phone-in tickets:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Get phone-in tickets
router.get("/phone-in-tickets", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { limit = "50", offset = "0", converted } = req.query as Record<string, string>;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing x-tenant-id header" });
    }

    const limitNum = Math.min(200, Math.max(1, parseInt(limit || "50", 10)));
    const offsetNum = Math.max(0, parseInt(offset || "0", 10));

    let where = and(eq(phoneInTickets.tenantId, tenantId));
    if (converted === 'true') {
      where = and(where, sql`${phoneInTickets.convertedToTicketId} IS NOT NULL`);
    } else if (converted === 'false') {
      where = and(where, sql`${phoneInTickets.convertedToTicketId} IS NULL`);
    }

    const rows = await db
      .select({
        id: phoneInTickets.id,
        tenantId: phoneInTickets.tenantId,
        callerName: phoneInTickets.callerName,
        callerPhone: phoneInTickets.callerPhone,
        callerEmail: phoneInTickets.callerEmail,
        callerRole: phoneInTickets.callerRole,
        customerId: phoneInTickets.customerId,
        customerName: phoneInTickets.customerName,
        locationAddress: phoneInTickets.locationAddress,
        locationBuilding: phoneInTickets.locationBuilding,
        locationFloor: phoneInTickets.locationFloor,
        locationRoom: phoneInTickets.locationRoom,
        equipmentId: phoneInTickets.equipmentId,
        equipmentBrand: phoneInTickets.equipmentBrand,
        equipmentModel: phoneInTickets.equipmentModel,
        equipmentSerial: phoneInTickets.equipmentSerial,
        issueCategory: phoneInTickets.issueCategory,
        issueDescription: phoneInTickets.issueDescription,
        urgencyLevel: phoneInTickets.urgencyLevel,
        contactMethod: phoneInTickets.contactMethod,
        convertedToTicketId: phoneInTickets.convertedToTicketId,
        convertedAt: phoneInTickets.convertedAt,
        createdAt: phoneInTickets.createdAt,
        updatedAt: phoneInTickets.updatedAt,
      })
      .from(phoneInTickets)
      .where(where)
      .orderBy(desc(phoneInTickets.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching phone-in tickets:", error);
    res.status(500).json({ error: "Failed to fetch phone-in tickets" });
  }
});

// Technician check-in to service ticket
router.post("/service-tickets/:ticketId/check-in", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;
    const technicianId = req.headers["x-user-id"] as string; // Assuming technician ID from auth
    
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
          sql`${technicianTicketSessions.checkOutTimestamp} IS NULL`
        )
      )
      .limit(1);

    if (existingSession.length > 0) {
      return res.json(existingSession[0]);
    }

    // Create new session
    const [session] = await db
      .insert(technicianTicketSessions)
      .values(sessionData)
      .returning();

    // Update service ticket status
    await db
      .update(serviceTickets)
      .set({ 
        status: 'on_site',
        updatedAt: new Date(),
      })
      .where(eq(serviceTickets.id, ticketId));

    // Create initial workflow step
    await db
      .insert(workflowSteps)
      .values({
        tenantId,
        sessionId: session.id,
        stepName: 'initial_assessment',
        stepData: {},
      });

    res.json(session);
  } catch (error) {
    console.error("Error checking in technician:", error);
    res.status(500).json({ error: "Failed to check in technician" });
  }
});

// Get technician session for ticket
router.get("/service-tickets/:ticketId/session", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const technicianId = req.headers["x-user-id"] as string;

    const session = await db
      .select()
      .from(technicianTicketSessions)
      .where(
        and(
          eq(technicianTicketSessions.serviceTicketId, ticketId),
          eq(technicianTicketSessions.technicianId, technicianId),
          sql`${technicianTicketSessions.checkOutTimestamp} IS NULL`
        )
      )
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: "No active session found" });
    }

    res.json(session[0]);
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// Update workflow step
router.post("/technician-sessions/:sessionId/update-step", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { stepName, stepData, notes } = req.body;
    const tenantId = req.headers["x-tenant-id"] as string;

    // Update session workflow step
    await db
      .update(technicianTicketSessions)
      .set({
        workflowStep: stepName,
        updatedAt: new Date(),
      })
      .where(eq(technicianTicketSessions.id, sessionId));

    // Mark previous step as completed
    await db
      .update(workflowSteps)
      .set({
        stepCompleted: new Date(),
        stepData,
        notes,
      })
      .where(
        and(
          eq(workflowSteps.sessionId, sessionId),
          eq(workflowSteps.stepName, stepName),
          sql`${workflowSteps.stepCompleted} IS NULL`
        )
      );

    // Create new step if moving to next step
    const existingStep = await db
      .select()
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.sessionId, sessionId),
          eq(workflowSteps.stepName, stepName)
        )
      )
      .limit(1);

    if (existingStep.length === 0) {
      await db
        .insert(workflowSteps)
        .values({
          tenantId,
          sessionId,
          stepName,
          stepData,
          notes,
        });
    }

    // Update service ticket status based on workflow step
    const statusMapping: { [key: string]: string } = {
      'initial_assessment': 'in-progress',
      'diagnosis': 'in-progress',
      'customer_approval': 'customer_approval',
      'work_execution': 'in-progress',
      'testing': 'testing',
      'completion': 'completed',
    };

    const newStatus = statusMapping[stepName] || 'in-progress';
    
    const session = await db
      .select()
      .from(technicianTicketSessions)
      .where(eq(technicianTicketSessions.id, sessionId))
      .limit(1);

    if (session.length > 0) {
      await db
        .update(serviceTickets)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(serviceTickets.id, session[0].serviceTicketId));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating workflow step:", error);
    res.status(500).json({ error: "Failed to update workflow step" });
  }
});

// Request parts for ticket
router.post("/service-tickets/:ticketId/request-parts", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;
    
    const partsData = insertTicketPartsRequestSchema.parse({
      ...req.body,
      tenantId,
      serviceTicketId: ticketId,
    });

    const [partsRequest] = await db
      .insert(ticketPartsRequests)
      .values(partsData)
      .returning();

    // You might want to send notifications or trigger approval workflows here

    res.json(partsRequest);
  } catch (error) {
    console.error("Error requesting parts:", error);
    res.status(500).json({ error: "Failed to request parts" });
  }
});

// Get parts requests for ticket
router.get("/service-tickets/:ticketId/parts-requests", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    const partsRequests = await db
      .select()
      .from(ticketPartsRequests)
      .where(
        and(
          eq(ticketPartsRequests.tenantId, tenantId),
          eq(ticketPartsRequests.serviceTicketId, ticketId)
        )
      )
      .orderBy(desc(ticketPartsRequests.createdAt));

    res.json(partsRequests);
  } catch (error) {
    console.error("Error fetching parts requests:", error);
    res.status(500).json({ error: "Failed to fetch parts requests" });
  }
});

// Complete service ticket
router.post("/service-tickets/:ticketId/complete", async (req, res) => {
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
      .where(
        and(
          eq(workflowSteps.sessionId, sessionId),
          eq(workflowSteps.stepName, 'completion')
        )
      );

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

    // Auto-invoice generation on completion
    if (!completionData.followUpRequired) {
      try {
        const [ticket] = await db
          .select({
            tenantId: serviceTickets.tenantId,
            customerId: serviceTickets.customerId,
          })
          .from(serviceTickets)
          .where(eq(serviceTickets.id, ticketId))
          .limit(1);

        if (ticket) {
          // Get session data for labor calculations
          const [session] = await db
            .select({
              billableHours: technicianTicketSessions.billableHours,
              partsUsedIds: technicianTicketSessions.partsUsedIds,
            })
            .from(technicianTicketSessions)
            .where(eq(technicianTicketSessions.serviceTicketId, ticketId))
            .limit(1);

          const laborHours = session?.billableHours || 2; // Default 2 hours
          const laborRate = 75; // Default rate, should come from company settings
          const partsTotal = 0; // Calculate from parts used, placeholder for now
          
          const invoiceNumber = `SVC-${Date.now()}`;
          const totalAmount = (Number(laborHours) * laborRate) + partsTotal;

          // Create auto-invoice generation record
          await db
            .insert(autoInvoiceGeneration)
            .values({
              tenantId: ticket.tenantId,
              sourceType: 'service_ticket',
              sourceId: ticketId,
              invoiceNumber,
              generationStatus: 'processing',
              laborHours: laborHours.toString(),
              laborRate: laborRate.toString(),
              partsTotal: partsTotal.toString(),
              totalAmount: totalAmount.toString(),
              triggeredAt: now,
            });
        }
      } catch (invErr) {
        console.error('Auto-invoice generation failed:', invErr);
      }
    }

    res.json({ success: true, status: ticketStatus });
  } catch (error) {
    console.error("Error completing service ticket:", error);
    res.status(500).json({ error: "Failed to complete service ticket" });
  }
});

// Get workflow steps for session
router.get("/technician-sessions/:sessionId/workflow-steps", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    const steps = await db
      .select()
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.tenantId, tenantId),
          eq(workflowSteps.sessionId, sessionId)
        )
      )
      .orderBy(workflowSteps.stepStarted);

    res.json(steps);
  } catch (error) {
    console.error("Error fetching workflow steps:", error);
    res.status(500).json({ error: "Failed to fetch workflow steps" });
  }
});

// Customer search endpoint
router.get("/customers/search", async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const tenantId = req.headers["x-tenant-id"] as string;

    if (!searchTerm || (searchTerm as string).length < 2) {
      return res.json([]);
    }

    const searchResults = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          sql`(
            LOWER(${customers.name}) LIKE LOWER(${'%' + searchTerm + '%'}) OR
            LOWER(${customers.phone}) LIKE LOWER(${'%' + searchTerm + '%'}) OR
            LOWER(${customers.email}) LIKE LOWER(${'%' + searchTerm + '%'})
          )`
        )
      )
      .limit(10);

    res.json(searchResults);
  } catch (error) {
    console.error("Error searching customers:", error);
    res.status(500).json({ error: "Failed to search customers" });
  }
});

// Approve parts request
router.post("/parts-requests/:requestId/approve", async (req, res) => {
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
    console.error("Error approving parts request:", error);
    res.status(500).json({ error: "Failed to approve parts request" });
  }
});

// Reject parts request
router.post("/parts-requests/:requestId/reject", async (req, res) => {
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
    console.error("Error rejecting parts request:", error);
    res.status(500).json({ error: "Failed to reject parts request" });
  }
});

// Convert an existing phone-in ticket to a service ticket
router.post("/phone-in-tickets/:id/convert", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) {
      return res.status(400).json({ error: "Missing x-tenant-id header" });
    }

    const [phoneTicket] = await db
      .select()
      .from(phoneInTickets)
      .where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)))
      .limit(1);

    if (!phoneTicket) {
      return res.status(404).json({ error: "Phone-in ticket not found" });
    }

    if (phoneTicket.convertedToTicketId) {
      return res.status(400).json({ error: "Already converted" });
    }

    const ticketNumber = `TK-${Date.now()}`;
    const [serviceTicket] = await db
      .insert(serviceTickets)
      .values({
        tenantId,
        customerId: phoneTicket.customerId || 'unknown',
        ticketNumber,
        title: `${(phoneTicket.issueCategory || '').toString().replace('_', ' ')} - ${phoneTicket.customerName}`,
        description: phoneTicket.issueDescription,
        priority: phoneTicket.urgencyLevel || 'medium',
        status: 'new',
        customerAddress: phoneTicket.locationAddress,
        customerPhone: phoneTicket.callerPhone,
        workOrderNotes: `Converted from phone-in ticket ${id}`,
        createdBy: phoneTicket.handledBy,
      })
      .returning();

    await db
      .update(phoneInTickets)
      .set({ convertedToTicketId: serviceTicket.id, convertedAt: new Date() })
      .where(eq(phoneInTickets.id, id));

    res.json({ phoneTicket: { ...phoneTicket, convertedToTicketId: serviceTicket.id }, serviceTicket });
  } catch (error) {
    console.error("Error converting phone-in ticket:", error);
    res.status(500).json({ error: "Failed to convert phone-in ticket" });
  }
});

// Equipment search by company endpoint
router.get("/phone-tickets/equipment/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    // Search equipment for the company - using service tickets as proxy for equipment
    const equipment = await db
      .select({
        id: serviceTickets.id,
        brand: sql`'Canon'`.as('brand'),
        model: sql`'imageRUNNER ADVANCE'`.as('model'),
        serial: sql`CONCAT('SN', LPAD(CAST(EXTRACT(epoch FROM ${serviceTickets.createdAt}) AS TEXT), 8, '0'))`.as('serial'),
      })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, tenantId),
          eq(serviceTickets.customerId, companyId)
        )
      )
      .limit(10);

    res.json(equipment);
  } catch (error) {
    console.error("Error fetching equipment for company:", error);
    res.status(500).json({ error: "Failed to fetch equipment" });
  }
});

// Search contacts by company endpoint
router.get("/phone-tickets/search-contacts/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string;

    // Get contacts for the company
    const contacts = await db
      .select({
        id: businessRecords.id,
        name: businessRecords.contactName,
        email: businessRecords.email,
        phone: businessRecords.phone,
        role: businessRecords.jobTitle,
      })
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.id, companyId)
        )
      )
      .limit(20);

    res.json(contacts);
  } catch (error) {
    console.error("Error searching contacts:", error);
    res.status(500).json({ error: "Failed to search contacts" });  
  }
});

export default router;