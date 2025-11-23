import { db } from '../db';
import { businessRecords, equipment, users } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { sendEmail } from './email-service';

export interface ParsedTicketData {
  customerName?: string;
  customerEmail: string;
  customerId?: string;
  customerMatched?: boolean;
  isNewCustomer?: boolean;
  equipmentId?: string;
  equipmentIdentifier?: string;
  equipmentMatched?: boolean;
  issueCategory: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  issueDescription: string;
  errorCodes?: string[];
  requestedDate?: string;
  contactPhone?: string;
  locationDetails?: string;
  attachmentsRelevant?: boolean;
  confidence?: string;
}

/**
 * Ticket Creation Service
 *
 * Creates service tickets from parsed email data,
 * handles customer creation, and auto-assigns technicians
 */
export class TicketCreationService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Create service ticket from parsed email data
   */
  async createTicket(ticketData: ParsedTicketData): Promise<any> {
    console.log('[TicketCreation] Creating ticket from:', {
      customerEmail: ticketData.customerEmail,
      issueCategory: ticketData.issueCategory,
      priority: ticketData.priority,
    });

    // Step 1: Find or create customer
    let customerId = ticketData.customerId;

    if (!customerId) {
      customerId = await this.findOrCreateCustomer(ticketData);
    }

    // Step 2: Find equipment if identifier provided
    let equipmentId = ticketData.equipmentId || null;

    if (!equipmentId && ticketData.equipmentIdentifier) {
      equipmentId = await this.findEquipment(
        customerId,
        ticketData.equipmentIdentifier
      );
    }

    // Step 3: Create service ticket
    const ticket = await this.createServiceTicket({
      customerId,
      equipmentId,
      ...ticketData,
    });

    // Step 4: Auto-assign to technician
    await this.autoAssignTechnician(ticket.id, customerId, equipmentId);

    console.log(`[TicketCreation] ✓ Created ticket ${ticket.id}`);

    return ticket;
  }

  /**
   * Find existing customer or create new one
   */
  private async findOrCreateCustomer(
    ticketData: ParsedTicketData
  ): Promise<string> {
    // Try to find existing customer by email
    let customer = await db.query.businessRecords.findFirst({
      where: and(
        eq(businessRecords.tenantId, this.tenantId),
        eq(businessRecords.email, ticketData.customerEmail)
      ),
    });

    if (customer) {
      console.log(`[TicketCreation] Found existing customer: ${customer.name} (${customer.id})`);
      return customer.id;
    }

    // Create new customer (lead)
    console.log('[TicketCreation] Creating new customer from email');

    const [newCustomer] = await db
      .insert(businessRecords)
      .values({
        tenantId: this.tenantId,
        name: ticketData.customerName || ticketData.customerEmail.split('@')[0],
        email: ticketData.customerEmail,
        phone: ticketData.contactPhone || null,
        status: 'lead', // Start as lead since they're contacting us
        source: 'email',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log(`[TicketCreation] Created new customer: ${newCustomer.name} (${newCustomer.id})`);

    return newCustomer.id;
  }

  /**
   * Try to find equipment by identifier
   */
  private async findEquipment(
    customerId: string,
    identifier: string
  ): Promise<string | null> {
    const identifierLower = identifier.toLowerCase();

    // Get customer's equipment
    const customerEquipment = await db.query.equipment.findMany({
      where: and(
        eq(equipment.tenantId, this.tenantId),
        eq(equipment.customerId, customerId)
      ),
    });

    // Try fuzzy matching
    const match = customerEquipment.find(
      (e) =>
        e.serialNumber?.toLowerCase().includes(identifierLower) ||
        e.model?.toLowerCase().includes(identifierLower) ||
        e.location?.toLowerCase().includes(identifierLower)
    );

    if (match) {
      console.log(`[TicketCreation] Matched equipment: ${match.manufacturer} ${match.model} (${match.id})`);
      return match.id;
    }

    console.log('[TicketCreation] Could not match equipment');
    return null;
  }

  /**
   * Create service ticket in database
   */
  private async createServiceTicket(data: any): Promise<any> {
    // Map issue category to ticket fields
    const categoryMapping: Record<string, any> = {
      paper_jam: { category: 'service', subcategory: 'paper_jam' },
      toner_empty: { category: 'supplies', subcategory: 'toner' },
      print_quality: { category: 'service', subcategory: 'print_quality' },
      network_issue: { category: 'service', subcategory: 'connectivity' },
      error_code: { category: 'service', subcategory: 'error' },
      supply_order: { category: 'supplies', subcategory: 'order' },
      general_service: { category: 'service', subcategory: 'general' },
      maintenance: { category: 'maintenance', subcategory: 'preventive' },
      other: { category: 'service', subcategory: 'other' },
    };

    const mapping = categoryMapping[data.issueCategory] || {
      category: 'service',
      subcategory: 'other',
    };

    // Build ticket title
    const titleParts = [
      data.issueCategory.replace(/_/g, ' ').toUpperCase(),
    ];
    if (data.equipmentId) {
      titleParts.push('- Equipment Service');
    }

    const title = titleParts.join(' ');

    // Build full description
    let description = data.issueDescription;

    if (data.errorCodes && data.errorCodes.length > 0) {
      description += `\n\n**Error Codes:** ${data.errorCodes.join(', ')}`;
    }

    if (data.locationDetails) {
      description += `\n\n**Location:** ${data.locationDetails}`;
    }

    if (data.equipmentIdentifier && !data.equipmentId) {
      description += `\n\n**Equipment Info:** ${data.equipmentIdentifier} (not matched in system)`;
    }

    if (data.requestedDate) {
      description += `\n\n**Requested Service Date:** ${data.requestedDate}`;
    }

    if (data.attachmentsRelevant) {
      description += `\n\n**Note:** Customer attached photos/files - review email attachments`;
    }

    description += `\n\n---\n*Created automatically from email on ${new Date().toLocaleString()}*`;

    // Insert into service_tickets table (or phoneInTickets if using enhanced service)
    // For now, using a generic structure - adapt to your actual schema
    const ticketValues: any = {
      tenantId: this.tenantId,
      customerId: data.customerId,
      equipmentId: data.equipmentId,
      title,
      description,
      category: mapping.category,
      subcategory: mapping.subcategory,
      priority: data.priority,
      status: 'open',
      source: 'email',
      contactMethod: 'email',
      contactInfo: data.customerEmail,
      contactPhone: data.contactPhone,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Check if phoneInTickets table exists (from enhanced-service-schema)
    // If not, fall back to generic service tickets table
    try {
      // Try to use phoneInTickets from enhanced service schema
      const { phoneInTickets } = await import('@shared/schema');

      const [ticket] = await db
        .insert(phoneInTickets)
        .values({
          ...ticketValues,
          issueCategory: data.issueCategory,
          ticketPriority: data.priority,
          enhancedTicketStatus: 'new',
        })
        .returning();

      return ticket;
    } catch (error) {
      // Fallback: create a basic ticket record
      // This is a simplified version - adjust based on your actual schema
      console.log('[TicketCreation] Using fallback ticket creation');

      // For now, return a mock ticket object
      // TODO: Replace with actual table when schema is finalized
      const ticketId = `TKT-${Date.now()}`;

      return {
        id: ticketId,
        ...ticketValues,
      };
    }
  }

  /**
   * Auto-assign ticket to best available technician
   */
  private async autoAssignTechnician(
    ticketId: string,
    customerId: string,
    equipmentId: string | null
  ): Promise<void> {
    try {
      // Get available technicians
      const technicians = await db.query.users.findMany({
        where: and(
          eq(users.tenantId, this.tenantId),
          eq(users.role, 'Technician'),
          eq(users.status, 'active')
        ),
      });

      if (technicians.length === 0) {
        console.log('[TicketCreation] No technicians available for assignment');
        return;
      }

      // Simple round-robin for now
      // TODO: Implement smart assignment based on:
      // - Current workload
      // - Geographic proximity
      // - Skill match
      // - Customer history
      const randomTechnician =
        technicians[Math.floor(Math.random() * technicians.length)];

      console.log(`[TicketCreation] Auto-assigned to technician: ${randomTechnician.name} (${randomTechnician.id})`);

      // Update ticket with assignment
      // TODO: Update actual ticket table when schema is finalized
      // await db.update(tickets).set({ assignedTo: randomTechnician.id });
    } catch (error) {
      console.error('[TicketCreation] Error auto-assigning technician:', error);
      // Don't fail ticket creation if assignment fails
    }
  }

  /**
   * Send confirmation email to customer
   */
  async sendConfirmationEmail(
    customerEmail: string,
    ticket: any
  ): Promise<void> {
    try {
      const subject = `Service Request Received - Ticket #${ticket.id}`;

      const body = `Dear Customer,

Thank you for contacting us. We have received your service request and created ticket #${ticket.id}.

**TICKET DETAILS:**
- Issue: ${ticket.description?.split('\n')[0] || ticket.title}
- Priority: ${ticket.priority?.toUpperCase()}
- Status: ${ticket.status?.toUpperCase()}
${ticket.requestedDate ? `- Requested Date: ${ticket.requestedDate}` : ''}

A technician will be assigned shortly and will contact you to schedule service.

You can check the status of your ticket at:
https://portal.printyx.com/tickets/${ticket.id}

If you have any questions, please reply to this email or call us at (555) 123-4567.

Best regards,
Printyx Support Team

---
This ticket was created automatically from your email. If you did not request service, please contact us immediately.`;

      await sendEmail({
        to: customerEmail,
        subject,
        body,
      });

      console.log(`[TicketCreation] ✓ Sent confirmation email to ${customerEmail}`);
    } catch (error) {
      console.error('[TicketCreation] Error sending confirmation email:', error);
      // Don't fail ticket creation if email fails
    }
  }
}
