import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { db } from '../db';
import { equipment, businessRecords } from '@shared/schema';
import { eq, or, like, and } from 'drizzle-orm';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Zod schema for parsed ticket data
 */
const TicketDataSchema = z.object({
  customerName: z.string().optional().describe('Customer or company name'),
  customerEmail: z.string().email().describe('Customer email address'),
  equipmentIdentifier: z
    .string()
    .optional()
    .describe('Serial number, model, or location description of the equipment'),
  issueCategory: z
    .enum([
      'paper_jam',
      'toner_empty',
      'print_quality',
      'network_issue',
      'error_code',
      'supply_order',
      'general_service',
      'maintenance',
      'other',
    ])
    .describe('Category of the issue'),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .describe('Priority level based on urgency and business impact'),
  issueDescription: z
    .string()
    .describe('Clear, concise description of the issue'),
  errorCodes: z
    .array(z.string())
    .optional()
    .describe('Any error codes mentioned in the email'),
  requestedDate: z
    .string()
    .optional()
    .describe('When customer wants service (ISO date format)'),
  contactPhone: z.string().optional().describe('Contact phone number if provided'),
  locationDetails: z
    .string()
    .optional()
    .describe('Building, floor, room number, or other location details'),
  attachmentsRelevant: z
    .boolean()
    .describe('Whether attachments should be reviewed by technician'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('AI confidence level in the parsing'),
});

export type TicketData = z.infer<typeof TicketDataSchema>;

export interface EmailData {
  from: string;
  subject: string;
  body: string;
  attachments: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
  }>;
}

/**
 * AI Email Parser Service
 *
 * Uses Claude AI to parse email content into structured ticket data
 */
export class AIEmailParserService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Parse email content into structured ticket data using Claude AI
   */
  async parseEmail(email: EmailData): Promise<TicketData> {
    // Get context from database
    const context = await this.getContextForParsing(email.from);

    // Build prompt for Claude
    const prompt = this.buildPrompt(email, context);

    try {
      // Call Claude API
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent parsing
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract JSON from response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Extract JSON from Claude's response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[AIParser] No JSON found in Claude response:', content.text);
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate with Zod
      const ticketData = TicketDataSchema.parse(parsed);

      // Enhance with database lookups
      const enhanced = await this.enhanceTicketData(ticketData, context);

      return enhanced;
    } catch (error) {
      console.error('[AIParser] Error parsing email:', error);
      // Fallback: Create basic ticket
      return this.createFallbackTicket(email);
    }
  }

  /**
   * Build prompt for Claude with email content and context
   */
  private buildPrompt(email: EmailData, context: any): string {
    const equipmentContext =
      context.equipment.length > 0
        ? context.equipment
            .map(
              (e: any) =>
                `- ${e.manufacturer || 'Unknown'} ${e.model || 'Unknown'}, Serial: ${e.serialNumber || 'N/A'}, Location: ${e.location || 'N/A'}`
            )
            .join('\n')
        : 'No equipment found for this customer';

    const customerContext = context.customer
      ? `Name: ${context.customer.name || email.from}\nPhone: ${context.customer.phone || 'Not on file'}\nEmail: ${context.customer.email || email.from}`
      : `New customer - Email: ${email.from}`;

    return `You are a service ticket parser for a managed print services (MPS) company. Your job is to parse customer service request emails into structured ticket data.

**EMAIL DETAILS:**
From: ${email.from}
Subject: ${email.subject}
Body:
${email.body}

${email.attachments.length > 0 ? `\n**ATTACHMENTS:** ${email.attachments.length} file(s)\n${email.attachments.map((a) => `- ${a.filename || 'Unnamed'} (${a.contentType || 'unknown'}, ${a.size || 0} bytes)`).join('\n')}` : ''}

**CUSTOMER CONTEXT:**
${customerContext}

**CUSTOMER'S EQUIPMENT:**
${equipmentContext}

**INSTRUCTIONS:**
1. Extract all relevant information from the email
2. Identify the equipment (match by serial number, model, or location if possible)
3. Categorize the issue type:
   - paper_jam: Paper jams or feed issues
   - toner_empty: Toner or ink needs replacement
   - print_quality: Poor print quality, streaks, fading
   - network_issue: Cannot print, offline, network connectivity
   - error_code: Device showing error code or message
   - supply_order: Customer requesting supplies (toner, paper, etc.)
   - general_service: Routine service or maintenance
   - maintenance: Scheduled preventive maintenance
   - other: Anything else

4. Determine priority level:
   - **urgent**: Device completely down, business is stopped
   - **high**: Device not working properly, affecting multiple users
   - **medium**: Issue exists but workarounds available
   - **low**: Routine service, supply order, non-critical

5. Extract any error codes mentioned (e.g., E202-0001, SC542, etc.)
6. Note if customer requested a specific date/time for service
7. Extract contact phone if mentioned
8. Note location details (building, floor, room)
9. Determine if attachments (photos of error screens, etc.) are relevant for the technician

10. Assess your confidence in the parsing:
    - **high**: Clear information, matched equipment, obvious issue category
    - **medium**: Some ambiguity but reasonable assumptions made
    - **low**: Limited information, unclear issue, or new customer

**IMPORTANT:**
- Be thorough but concise in the issue description
- If equipment cannot be matched, still provide identifying information mentioned in the email
- Always provide a reasonable priority based on business impact
- Return ONLY valid JSON, no other text or explanation

**OUTPUT FORMAT (JSON only):**
{
  "customerName": "string or omit",
  "customerEmail": "email address",
  "equipmentIdentifier": "string or omit",
  "issueCategory": "one of the categories above",
  "priority": "low | medium | high | urgent",
  "issueDescription": "clear summary of the issue",
  "errorCodes": ["array of strings"] or omit,
  "requestedDate": "ISO date string" or omit,
  "contactPhone": "string" or omit,
  "locationDetails": "string" or omit,
  "attachmentsRelevant": true or false,
  "confidence": "high | medium | low"
}

Parse the email above and return ONLY the JSON:`;
  }

  /**
   * Get customer and equipment context for AI
   */
  private async getContextForParsing(fromEmail: string): Promise<any> {
    // Extract domain from email
    const domain = fromEmail.split('@')[1]?.toLowerCase();

    // Find customer by email or email domain
    const customer = await db.query.businessRecords.findFirst({
      where: or(
        eq(businessRecords.email, fromEmail),
        domain ? like(businessRecords.email, `%@${domain}`) : undefined
      ),
    });

    let equipmentList: any[] = [];

    if (customer) {
      // Get customer's equipment (limit to 20 to not overwhelm the prompt)
      equipmentList = await db.query.equipment.findMany({
        where: and(
          eq(equipment.tenantId, this.tenantId),
          eq(equipment.customerId, customer.id)
        ),
        limit: 20,
      });
    }

    return {
      customer,
      equipment: equipmentList,
    };
  }

  /**
   * Enhance parsed data with database lookups
   */
  private async enhanceTicketData(
    ticketData: TicketData,
    context: any
  ): Promise<TicketData> {
    const enhanced: any = { ...ticketData };

    // If equipment identifier provided, try to match
    if (ticketData.equipmentIdentifier && context.equipment.length > 0) {
      const identifier = ticketData.equipmentIdentifier.toLowerCase();

      // Try to find matching equipment
      const match = context.equipment.find(
        (e: any) =>
          e.serialNumber?.toLowerCase().includes(identifier) ||
          e.model?.toLowerCase().includes(identifier) ||
          e.location?.toLowerCase().includes(identifier)
      );

      if (match) {
        enhanced.equipmentId = match.id;
        enhanced.equipmentMatched = true;
      }
    }

    // Add customer ID if found
    if (context.customer) {
      enhanced.customerId = context.customer.id;
      enhanced.customerMatched = true;
      // Use customer name from database if not provided in email
      if (!ticketData.customerName && context.customer.name) {
        enhanced.customerName = context.customer.name;
      }
    } else {
      enhanced.customerMatched = false;
      enhanced.isNewCustomer = true;
    }

    return enhanced as TicketData;
  }

  /**
   * Create fallback ticket if AI parsing fails
   */
  private createFallbackTicket(email: EmailData): TicketData {
    return {
      customerEmail: email.from,
      issueCategory: 'other',
      priority: 'medium',
      issueDescription: `Email Subject: ${email.subject}\n\n${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}`,
      attachmentsRelevant: email.attachments.length > 0,
      confidence: 'low',
    } as TicketData;
  }
}
