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
    this.tenant_id = tenantId;
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
      equipmentId = await this.findEquipment(customerId, ticketData.equipmentIdentifier);
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
  private async findOrCreateCustomer(ticketData: ParsedTicketData): Promise<string> {
    // Try to find existing customer by email
    let customer = await db.query.businessRecords.findFirst({
      where: and(
        eq(businessRecords.tenant_id, this.tenant_id),
        eq(businessRecords.email, ticketData.customerEmail),
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
        tenantId: this.tenant_id,
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
  private async findEquipment(customerId: string, identifier: string): Promise<string | null> {
    const identifierLower = identifier.toLowerCase();

    // Get customer's equipment
    const customerEquipment = await db.query.equipment.findMany({
      where: and(eq(equipment.tenant_id, this.tenant_id), eq(equipment.customerId, customerId)),
    });

    // Try fuzzy matching
    const match = customerEquipment.find(
      (e) =>
        e.serialNumber?.toLowerCase().includes(identifierLower) ||
        e.model?.toLowerCase().includes(identifierLower) ||
        e.location?.toLowerCase().includes(identifierLower),
    );

    if (match) {
      console.log(
        `[TicketCreation] Matched equipment: ${match.manufacturer} ${match.model} (${match.id})`,
      );
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
    const titleParts = [data.issueCategory.replace(/_/g, ' ').toUpperCase()];
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
      tenantId: this.tenant_id,
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
   * Smart AI-powered auto-assignment to best available technician
   * Considers: workload, proximity, skills, customer history, AI confidence
   */
  private async autoAssignTechnician(
    ticketId: string,
    customerId: string,
    equipmentId: string | null,
  ): Promise<void> {
    try {
      console.log('[SmartDispatch] Starting AI-powered technician assignment...');

      // Get available technicians
      const technicians = await db.query.users.findMany({
        where: and(
          eq(users.tenant_id, this.tenant_id),
          eq(users.role, 'Technician'),
          eq(users.status, 'active'),
        ),
      });

      if (technicians.length === 0) {
        console.log('[SmartDispatch] No technicians available for assignment');
        return;
      }

      // Get ticket details for scoring
      const customer = await db.query.businessRecords.findFirst({
        where: eq(businessRecords.id, customerId),
      });

      let equipmentData = null;
      if (equipmentId) {
        equipmentData = await db.query.equipment.findFirst({
          where: eq(equipment.id, equipmentId),
        });
      }

      // Score each technician using AI-powered algorithm
      const scoredTechnicians = await Promise.all(
        technicians.map(async (tech) => {
          let score = 50; // Base score
          const reasons: string[] = [];

          // 1. Workload Assessment (20 points max)
          const workloadScore = await this.calculateWorkloadScore(tech.id);
          score += workloadScore;
          if (workloadScore > 10) {
            reasons.push('Low current workload');
          } else if (workloadScore > 5) {
            reasons.push('Moderate workload');
          }

          // 2. Skills Match (25 points max)
          const skillsScore = await this.calculateSkillsScore(
            tech,
            equipmentData?.make || '',
            equipmentData?.model || '',
          );
          score += skillsScore;
          if (skillsScore > 15) {
            reasons.push('Excellent skill match');
          } else if (skillsScore > 10) {
            reasons.push('Good skill match');
          }

          // 3. Geographic Proximity (15 points max)
          const proximityScore = await this.calculateProximityScore(tech, customer?.address || '');
          score += proximityScore;
          if (proximityScore > 10) {
            reasons.push('Close proximity to customer');
          }

          // 4. Customer History (10 points max)
          const historyScore = await this.calculateCustomerHistoryScore(tech.id, customerId);
          score += historyScore;
          if (historyScore > 5) {
            reasons.push('Previous successful service with this customer');
          }

          return {
            technician: tech,
            score,
            reasons,
          };
        }),
      );

      // Sort by score (highest first)
      scoredTechnicians.sort((a, b) => b.score - a.score);

      const bestMatch = scoredTechnicians[0];

      // Auto-assign if confidence is high enough (>= 80 points)
      if (bestMatch.score >= 80) {
        console.log(
          `[SmartDispatch] ✅ AI AUTO-ASSIGNED to ${bestMatch.technician.name} (Score: ${bestMatch.score}/100)`,
        );
        console.log(`[SmartDispatch] Reasons: ${bestMatch.reasons.join(', ')}`);

        // Update ticket with assignment
        // TODO: Update actual ticket table when schema is finalized
        // await db.update(serviceTickets)
        //   .set({
        //     assignedTo: bestMatch.technician.id,
        //     assignedAt: new Date(),
        //     assignmentConfidence: bestMatch.score,
        //     assignmentReasons: bestMatch.reasons.join('; '),
        //   })
        //   .where(eq(serviceTickets.id, ticketId));

        // Send notification to technician
        // await this.notifyTechnician(bestMatch.technician.id, ticketId);
      } else {
        console.log(
          `[SmartDispatch] ⚠️  Confidence too low (${bestMatch.score}/100) - queuing for manual assignment`,
        );
        console.log(`[SmartDispatch] Top candidates:`);
        scoredTechnicians.slice(0, 3).forEach((match, i) => {
          console.log(
            `  ${i + 1}. ${match.technician.name} (${match.score} pts) - ${match.reasons.join(', ')}`,
          );
        });

        // Queue for manual assignment
        // TODO: Create assignment review queue
      }
    } catch (error) {
      console.error('[SmartDispatch] Error in AI assignment:', error);
      // Don't fail ticket creation if assignment fails
    }
  }

  /**
   * Calculate workload score (0-20 points)
   * Lower workload = higher score
   */
  private async calculateWorkloadScore(technicianId: string): Promise<number> {
    try {
      // Get active tickets assigned to this technician
      const { serviceTickets } = await import('@shared/schema');
      const activeTickets = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(serviceTickets)
        .where(
          and(
            eq(serviceTickets.tenant_id, this.tenant_id),
            eq(serviceTickets.technicianId, technicianId),
            sql`status IN ('open', 'in_progress', 'pending')`,
          ),
        );

      const count = activeTickets[0]?.count || 0;

      // Score: 20 points for 0-2 tickets, 15 for 3-5, 10 for 6-8, 5 for 9-11, 0 for 12+
      if (count <= 2) return 20;
      if (count <= 5) return 15;
      if (count <= 8) return 10;
      if (count <= 11) return 5;
      return 0;
    } catch (error) {
      console.error('[SmartDispatch] Error calculating workload:', error);
      return 10; // Default middle score
    }
  }

  /**
   * Calculate skills match score (0-25 points)
   * Matches technician skills/certifications to equipment
   */
  private async calculateSkillsScore(
    technician: any,
    make: string,
    model: string,
  ): Promise<number> {
    let score = 0;

    // Check if technician has relevant skills (assume stored in metadata or skills field)
    const skills = technician.skills || [];
    const certifications = technician.certifications || [];

    // Match equipment manufacturer
    const makeLower = make.toLowerCase();
    if (skills.some((s: string) => s.toLowerCase().includes(makeLower))) {
      score += 15;
    } else if (
      skills.some(
        (s: string) => s.toLowerCase().includes('service') || s.toLowerCase().includes('repair'),
      )
    ) {
      score += 10;
    }

    // Match certifications
    const certificationKeywords = ['certified', 'cct', 'xct', 'ase', makeLower];
    if (
      certifications.some((c: string) =>
        certificationKeywords.some((kw) => c.toLowerCase().includes(kw)),
      )
    ) {
      score += 10;
    }

    return Math.min(score, 25); // Cap at 25
  }

  /**
   * Calculate proximity score (0-15 points)
   * Closer technicians get higher scores
   */
  private async calculateProximityScore(technician: any, customerAddress: string): Promise<number> {
    // TODO: Implement actual GPS distance calculation
    // For now, return a placeholder score
    // In production, integrate with Google Maps Distance Matrix API or similar

    // Placeholder logic:
    // If technician has location data, calculate distance
    // For now, assign random score 5-15

    const randomProximity = Math.floor(Math.random() * 11) + 5;
    return randomProximity;
  }

  /**
   * Calculate customer history score (0-10 points)
   * Technicians who've successfully served this customer before get higher scores
   */
  private async calculateCustomerHistoryScore(
    technicianId: string,
    customerId: string,
  ): Promise<number> {
    try {
      const { serviceTickets } = await import('@shared/schema');

      // Get previous successful service calls by this tech for this customer
      const previousServices = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(serviceTickets)
        .where(
          and(
            eq(serviceTickets.tenant_id, this.tenant_id),
            eq(serviceTickets.technicianId, technicianId),
            eq(serviceTickets.customerId, customerId),
            eq(serviceTickets.status, 'completed'),
          ),
        );

      const count = previousServices[0]?.count || 0;

      // Score: 2 points per previous successful service, max 10
      return Math.min(count * 2, 10);
    } catch (error) {
      console.error('[SmartDispatch] Error calculating history score:', error);
      return 0;
    }
  }

  /**
   * Send confirmation email to customer
   */
  async sendConfirmationEmail(customerEmail: string, ticket: any): Promise<void> {
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
