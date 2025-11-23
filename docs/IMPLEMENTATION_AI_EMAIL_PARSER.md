# AI Email-to-Ticket Parser - Implementation Plan

**Project:** Automated Email-to-Ticket Conversion System
**Timeline:** 3-4 weeks
**Priority:** P0 (Quick Win - Immediate Time Savings)
**Status:** Planning

---

## Executive Summary

An intelligent system that monitors a dedicated email inbox (e.g., service@company.com), uses AI to parse customer service requests, and automatically creates structured service tickets. This "quick win" project delivers immediate time savings (2-4 hours/day) with minimal development effort.

**Key Benefits:**
- Eliminates manual ticket entry (saves 5-10 minutes per ticket)
- 24/7 availability (customers can report issues anytime)
- Consistent data quality (AI extracts structured information)
- Faster response times (tickets created instantly)
- Multi-language support (AI handles Spanish, French, etc.)
- ROI: $15-30K/year in time savings, pays for itself in < 1 month

---

## System Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────┐
│              Customer Email Clients                      │
│  (Gmail, Outlook, Apple Mail, etc.)                      │
└────────────────┬─────────────────────────────────────────┘
                 │ Sends email to service@company.com
                 │
┌────────────────▼─────────────────────────────────────────┐
│           Email Server (IMAP/Exchange)                   │
│  - Receives customer emails                             │
│  - Stores in inbox                                      │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │ IMAP/Graph API polling (every 60 seconds)
                 │
┌────────────────▼─────────────────────────────────────────┐
│        Email Monitor Service (Node.js)                   │
│  - Polls inbox for new emails                           │
│  - Filters processed emails                             │
│  - Extracts email content and attachments               │
│  - Passes to AI parser                                  │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │ Email content + context
                 │
┌────────────────▼─────────────────────────────────────────┐
│         AI Parser Service (Node.js)                      │
│  - Calls Claude API with email content                  │
│  - Provides context (equipment list, customers)         │
│  - Extracts structured ticket data                      │
│  - Handles images (OCR if needed)                       │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │ Structured ticket data
                 │
┌────────────────▼─────────────────────────────────────────┐
│        Ticket Creation Service (Node.js)                 │
│  - Validates extracted data                             │
│  - Creates service ticket in database                   │
│  - Assigns to appropriate technician                    │
│  - Attaches email as reference                          │
│  - Sends confirmation email to customer                 │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │ Ticket created
                 │
┌────────────────▼─────────────────────────────────────────┐
│         Printyx Platform Database                        │
│  - service_tickets table                                │
│  - equipment table (for lookups)                        │
│  - customers table (for matching)                       │
└──────────────────────────────────────────────────────────┘
                 │
                 │
┌────────────────▼─────────────────────────────────────────┐
│         Notifications & Updates                          │
│  - Email customer with ticket number                    │
│  - Notify assigned technician                           │
│  - Update dashboard                                     │
│  - WebSocket update for real-time UI                   │
└──────────────────────────────────────────────────────────┘
```

### Technology Stack

```json
{
  "email-monitor": {
    "language": "Node.js 20 LTS",
    "libraries": [
      "imap",
      "mailparser",
      "@microsoft/microsoft-graph-client"
    ],
    "purpose": "Monitor inbox and fetch emails"
  },
  "ai-parser": {
    "language": "Node.js 20 LTS",
    "libraries": [
      "@anthropic-ai/sdk (already integrated)",
      "zod (already integrated)"
    ],
    "purpose": "AI-powered email parsing"
  },
  "ticket-creation": {
    "language": "Node.js 20 LTS",
    "existing": "Leverage existing service ticket routes",
    "purpose": "Create tickets and send notifications"
  }
}
```

---

## Implementation Details

### Phase 1: Email Monitoring (Week 1)

#### Email Connection Options

**Option 1: IMAP (Most Common)**
- Works with Gmail, Outlook.com, most email providers
- Requires IMAP enabled and app password
- Library: `imap` or `imap-simple`

**Option 2: Microsoft Graph API (Enterprise)**
- Best for Microsoft 365 / Exchange Online
- OAuth 2.0 authentication
- Library: `@microsoft/microsoft-graph-client` (already integrated)

**Option 3: Gmail API (Google Workspace)**
- OAuth 2.0 authentication
- Pub/Sub for instant notifications (optional)
- Library: `googleapis` (already integrated)

**Recommendation:** Support all three, start with IMAP for simplicity.

#### Email Monitor Service

**File:** `server/services/email-monitor-service.ts`

```typescript
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { db } from '../db';
import { processedEmails } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  tlsOptions?: { rejectUnauthorized: boolean };
}

export class EmailMonitorService {
  private imap: Imap;
  private config: EmailConfig;
  private isConnected = false;

  constructor(config: EmailConfig) {
    this.config = config;
    this.imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: config.tlsOptions,
      authTimeout: 10000,
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        this.isConnected = true;
        console.log('IMAP connected');
        resolve();
      });

      this.imap.once('error', (err: Error) => {
        console.error('IMAP error:', err);
        reject(err);
      });

      this.imap.connect();
    });
  }

  async checkForNewEmails(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for unread emails
        this.imap.search(['UNSEEN'], async (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (results.length === 0) {
            console.log('No new emails');
            resolve();
            return;
          }

          console.log(`Found ${results.length} new emails`);

          const fetch = this.imap.fetch(results, {
            bodies: '',
            markSeen: true, // Mark as read after processing
          });

          fetch.on('message', (msg) => {
            msg.on('body', async (stream) => {
              try {
                const parsed = await simpleParser(stream);
                await this.processEmail(parsed);
              } catch (error) {
                console.error('Email processing error:', error);
              }
            });
          });

          fetch.once('error', reject);
          fetch.once('end', resolve);
        });
      });
    });
  }

  private async processEmail(email: any): Promise<void> {
    const emailId = email.messageId;

    // Check if already processed (idempotency)
    const existing = await db.query.processedEmails.findFirst({
      where: eq(processedEmails.emailId, emailId),
    });

    if (existing) {
      console.log(`Email ${emailId} already processed`);
      return;
    }

    // Extract email content
    const from = email.from?.text || '';
    const subject = email.subject || '';
    const textBody = email.text || '';
    const htmlBody = email.html || '';
    const attachments = email.attachments || [];

    console.log(`Processing email from: ${from}, subject: ${subject}`);

    // Pass to AI parser
    const aiParserService = new AIEmailParserService();
    const ticketData = await aiParserService.parseEmail({
      from,
      subject,
      body: textBody || htmlBody,
      attachments,
    });

    // Create ticket
    const ticketService = new TicketCreationService();
    const ticket = await ticketService.createTicket(ticketData);

    // Send confirmation email
    await ticketService.sendConfirmationEmail(from, ticket);

    // Mark as processed
    await db.insert(processedEmails).values({
      emailId,
      from,
      subject,
      ticketId: ticket.id,
      processedAt: new Date(),
    });

    console.log(`Ticket ${ticket.id} created from email ${emailId}`);
  }

  async disconnect(): Promise<void> {
    this.imap.end();
    this.isConnected = false;
  }
}

// Singleton instance with polling
let emailMonitor: EmailMonitorService | null = null;

export function startEmailMonitor(config: EmailConfig) {
  if (emailMonitor) {
    console.log('Email monitor already running');
    return;
  }

  emailMonitor = new EmailMonitorService(config);

  // Poll every 60 seconds
  setInterval(async () => {
    try {
      await emailMonitor!.checkForNewEmails();
    } catch (error) {
      console.error('Email check failed:', error);
      // Reconnect on error
      emailMonitor = new EmailMonitorService(config);
    }
  }, 60000); // 60 seconds

  console.log('Email monitor started');
}
```

#### Configuration

**Environment Variables** (add to `.env`):
```bash
# Email monitoring
EMAIL_MONITOR_ENABLED=true
EMAIL_HOST=imap.gmail.com
EMAIL_PORT=993
EMAIL_USER=service@company.com
EMAIL_PASSWORD=app_password_here
EMAIL_TLS=true
```

**Start in Server** (`server/index.ts`):
```typescript
import { startEmailMonitor } from './services/email-monitor-service';

// After server starts
if (process.env.EMAIL_MONITOR_ENABLED === 'true') {
  startEmailMonitor({
    host: process.env.EMAIL_HOST!,
    port: parseInt(process.env.EMAIL_PORT || '993'),
    user: process.env.EMAIL_USER!,
    password: process.env.EMAIL_PASSWORD!,
    tls: process.env.EMAIL_TLS === 'true',
  });
}
```

---

### Phase 2: AI Parsing (Week 2)

#### AI Parser Service

**File:** `server/services/ai-email-parser-service.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { db } from '../db';
import { equipment, customers } from '@shared/schema';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Zod schema for parsed ticket data
const TicketDataSchema = z.object({
  customerName: z.string().optional(),
  customerEmail: z.string().email(),
  equipmentIdentifier: z.string().optional().describe('Serial number, model, or location description'),
  issueCategory: z.enum([
    'paper_jam',
    'toner_empty',
    'print_quality',
    'network_issue',
    'error_code',
    'supply_order',
    'general_service',
    'other'
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  issueDescription: z.string().describe('Clear description of the issue'),
  errorCodes: z.array(z.string()).optional().describe('Any error codes mentioned'),
  requestedDate: z.string().optional().describe('When customer wants service (ISO date)'),
  contactPhone: z.string().optional(),
  locationDetails: z.string().optional().describe('Building, floor, room number'),
  attachmentsRelevant: z.boolean().describe('Whether attachments should be reviewed'),
});

type TicketData = z.infer<typeof TicketDataSchema>;

export interface EmailData {
  from: string;
  subject: string;
  body: string;
  attachments: any[];
}

export class AIEmailParserService {
  /**
   * Parse email content into structured ticket data using Claude AI
   */
  async parseEmail(email: EmailData): Promise<TicketData> {
    // Get context from database
    const context = await this.getContextForParsing(email.from);

    // Prepare prompt for Claude
    const prompt = this.buildPrompt(email, context);

    try {
      // Call Claude API
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
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

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate with Zod
      const ticketData = TicketDataSchema.parse(parsed);

      // Enhance with database lookups
      const enhanced = await this.enhanceTicketData(ticketData, context);

      return enhanced;
    } catch (error) {
      console.error('AI parsing error:', error);
      // Fallback: Create basic ticket
      return this.createFallbackTicket(email);
    }
  }

  /**
   * Build prompt for Claude with email content and context
   */
  private buildPrompt(email: EmailData, context: any): string {
    return `You are a service ticket parser for a copier/printer service company. Parse the following customer email into structured ticket data.

EMAIL DETAILS:
From: ${email.from}
Subject: ${email.subject}
Body:
${email.body}

CONTEXT (Customer's Equipment):
${context.equipment.length > 0 ? context.equipment.map((e: any) =>
  `- ${e.manufacturer} ${e.model}, Serial: ${e.serialNumber}, Location: ${e.location}`
).join('\n') : 'No equipment found for this customer'}

CUSTOMER INFORMATION:
${context.customer ? `Name: ${context.customer.name}, Phone: ${context.customer.phone}` : 'New customer'}

INSTRUCTIONS:
1. Extract all relevant information from the email
2. Identify the equipment (match by serial number, model, or location if possible)
3. Categorize the issue type
4. Determine priority (urgent if device is down, high if affecting work, medium for general service, low for routine)
5. Extract any error codes mentioned
6. Note if customer requested specific date/time
7. Return your response as JSON matching this schema:

{
  "customerName": "string (optional)",
  "customerEmail": "email",
  "equipmentIdentifier": "string (serial, model, or description, optional)",
  "issueCategory": "paper_jam | toner_empty | print_quality | network_issue | error_code | supply_order | general_service | other",
  "priority": "low | medium | high | urgent",
  "issueDescription": "string (clear summary)",
  "errorCodes": ["string array, optional"],
  "requestedDate": "ISO date string, optional",
  "contactPhone": "string, optional",
  "locationDetails": "string (building/floor/room, optional)",
  "attachmentsRelevant": boolean
}

Return ONLY the JSON, no other text.`;
  }

  /**
   * Get customer and equipment context for AI
   */
  private async getContextForParsing(fromEmail: string): Promise<any> {
    // Find customer by email
    const customer = await db.query.customers.findFirst({
      where: eq(customers.email, fromEmail),
    });

    let equipmentList: any[] = [];

    if (customer) {
      // Get customer's equipment
      equipmentList = await db.query.equipment.findMany({
        where: eq(equipment.customerId, customer.id),
        limit: 20, // Don't overwhelm the prompt
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
    // If equipment identifier provided, try to match
    if (ticketData.equipmentIdentifier && context.equipment.length > 0) {
      const identifier = ticketData.equipmentIdentifier.toLowerCase();

      // Try to find matching equipment
      const match = context.equipment.find((e: any) =>
        e.serialNumber?.toLowerCase().includes(identifier) ||
        e.model?.toLowerCase().includes(identifier) ||
        e.location?.toLowerCase().includes(identifier)
      );

      if (match) {
        // Add equipment ID to ticket data (will be used in ticket creation)
        (ticketData as any).equipmentId = match.id;
      }
    }

    // Add customer ID if found
    if (context.customer) {
      (ticketData as any).customerId = context.customer.id;
    }

    return ticketData;
  }

  /**
   * Create fallback ticket if AI parsing fails
   */
  private createFallbackTicket(email: EmailData): TicketData {
    return {
      customerEmail: email.from,
      issueCategory: 'other',
      priority: 'medium',
      issueDescription: `Email Subject: ${email.subject}\n\n${email.body.substring(0, 500)}`,
      attachmentsRelevant: email.attachments.length > 0,
    };
  }
}
```

#### Claude API Prompt Engineering

**Key Techniques:**
- **Few-Shot Examples:** Include 2-3 example emails and their parsed output
- **Strict JSON Schema:** Define exact output format
- **Context Awareness:** Provide customer's equipment list
- **Error Handling:** Graceful degradation if parsing fails
- **Confidence Scoring:** Ask Claude to indicate confidence level

**Optimized Prompt Template:**
```typescript
const SYSTEM_PROMPT = `You are an expert service ticket parser for managed print services. You excel at:
- Identifying copier/printer issues from customer descriptions
- Extracting equipment identifiers (serial numbers, models, locations)
- Categorizing issues accurately
- Determining appropriate priority levels
- Extracting error codes and technical details

Always return valid JSON. If uncertain, use "other" category and explain in description.`;
```

---

### Phase 3: Ticket Creation (Week 3)

#### Ticket Creation Service

**File:** `server/services/ticket-creation-service.ts`

```typescript
import { db } from '../db';
import { serviceTickets, equipment, customers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from './email-service';
import { assignTicketToTechnician } from './dispatch-service';

export class TicketCreationService {
  async createTicket(ticketData: any): Promise<any> {
    // Find or create customer
    let customer = await db.query.customers.findFirst({
      where: eq(customers.email, ticketData.customerEmail),
    });

    if (!customer) {
      // Create new customer
      const [newCustomer] = await db.insert(customers).values({
        name: ticketData.customerName || ticketData.customerEmail,
        email: ticketData.customerEmail,
        phone: ticketData.contactPhone,
        tenantId: 'default', // TODO: Determine tenant from email domain
      }).returning();

      customer = newCustomer;
    }

    // Find equipment if identifier provided
    let equipmentId: string | null = null;

    if (ticketData.equipmentId) {
      equipmentId = ticketData.equipmentId;
    } else if (ticketData.equipmentIdentifier) {
      // Try fuzzy matching
      const potentialEquipment = await db.query.equipment.findMany({
        where: eq(equipment.customerId, customer.id),
      });

      // Simple fuzzy match (could be improved)
      const identifier = ticketData.equipmentIdentifier.toLowerCase();
      const match = potentialEquipment.find(e =>
        e.serialNumber?.toLowerCase().includes(identifier) ||
        e.model?.toLowerCase().includes(identifier) ||
        e.location?.toLowerCase().includes(identifier)
      );

      if (match) {
        equipmentId = match.id;
      }
    }

    // Create service ticket
    const [ticket] = await db.insert(serviceTickets).values({
      customerId: customer.id,
      equipmentId,
      title: `${ticketData.issueCategory.replace('_', ' ')} - ${customer.name}`,
      description: ticketData.issueDescription,
      category: ticketData.issueCategory,
      priority: ticketData.priority,
      status: 'open',
      errorCodes: ticketData.errorCodes,
      requestedDate: ticketData.requestedDate,
      locationDetails: ticketData.locationDetails,
      source: 'email',
      tenantId: customer.tenantId,
      createdAt: new Date(),
    }).returning();

    // Auto-assign to technician
    await assignTicketToTechnician(ticket.id);

    return ticket;
  }

  async sendConfirmationEmail(customerEmail: string, ticket: any): Promise<void> {
    const subject = `Service Ticket Created: #${ticket.id}`;
    const body = `
Dear Customer,

Thank you for contacting us. We have received your service request and created ticket #${ticket.id}.

TICKET DETAILS:
- Issue: ${ticket.description}
- Priority: ${ticket.priority.toUpperCase()}
- Status: ${ticket.status.toUpperCase()}
${ticket.requestedDate ? `- Requested Date: ${ticket.requestedDate}` : ''}

A technician will be assigned shortly and will contact you to schedule service.

You can check the status of your ticket at:
https://portal.printyx.com/tickets/${ticket.id}

If you have any questions, please reply to this email or call us at (555) 123-4567.

Best regards,
Printyx Support Team

--
This ticket was created automatically from your email. If you did not request service, please contact us immediately.
    `;

    await sendEmail({
      to: customerEmail,
      subject,
      body,
    });
  }
}
```

#### Auto-Assignment Logic

**File:** `server/services/dispatch-service.ts` (extend existing)

```typescript
/**
 * Automatically assign ticket to best available technician
 */
export async function assignTicketToTechnician(ticketId: string): Promise<void> {
  const ticket = await db.query.serviceTickets.findFirst({
    where: eq(serviceTickets.id, ticketId),
    with: {
      customer: true,
      equipment: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Get available technicians (not on vacation, with capacity)
  const technicians = await db.query.users.findMany({
    where: and(
      eq(users.role, 'Technician'),
      eq(users.tenantId, ticket.tenantId),
      eq(users.status, 'active')
    ),
  });

  // Scoring algorithm
  let bestTechnician = null;
  let bestScore = -Infinity;

  for (const tech of technicians) {
    let score = 0;

    // Factor 1: Current workload (fewer tickets = higher score)
    const currentTickets = await db.query.serviceTickets.findMany({
      where: and(
        eq(serviceTickets.assignedTo, tech.id),
        eq(serviceTickets.status, 'open')
      ),
    });
    score += (10 - currentTickets.length) * 10; // Max 100 points

    // Factor 2: Geographic proximity (if location data available)
    // TODO: Implement distance calculation

    // Factor 3: Skill match (if equipment requires specific skills)
    // TODO: Check technician skills vs equipment type

    // Factor 4: Customer history (assign to same tech if possible)
    const previousTickets = await db.query.serviceTickets.findMany({
      where: and(
        eq(serviceTickets.customerId, ticket.customerId),
        eq(serviceTickets.assignedTo, tech.id)
      ),
      limit: 1,
    });

    if (previousTickets.length > 0) {
      score += 50; // Bonus for continuity
    }

    if (score > bestScore) {
      bestScore = score;
      bestTechnician = tech;
    }
  }

  if (bestTechnician) {
    await db.update(serviceTickets)
      .set({ assignedTo: bestTechnician.id })
      .where(eq(serviceTickets.id, ticketId));

    // Notify technician
    // TODO: Send notification via email/SMS/push
    console.log(`Ticket ${ticketId} assigned to ${bestTechnician.name}`);
  } else {
    console.warn(`No available technician found for ticket ${ticketId}`);
  }
}
```

---

### Phase 4: Testing & Refinement (Week 4)

#### Testing Strategy

**Unit Tests:**
```typescript
// test/ai-email-parser.test.ts
import { AIEmailParserService } from '../server/services/ai-email-parser-service';

describe('AIEmailParserService', () => {
  it('should parse paper jam email correctly', async () => {
    const parser = new AIEmailParserService();

    const result = await parser.parseEmail({
      from: 'john@acmecorp.com',
      subject: 'Printer jammed',
      body: 'Our Canon copier on the 3rd floor is jammed again. Error E202-0001. Need help ASAP.',
      attachments: [],
    });

    expect(result.issueCategory).toBe('paper_jam');
    expect(result.priority).toBe('high');
    expect(result.errorCodes).toContain('E202-0001');
  });

  it('should handle toner request', async () => {
    const parser = new AIEmailParserService();

    const result = await parser.parseEmail({
      from: 'mary@company.com',
      subject: 'Need toner',
      body: 'We need black toner for the Xerox in the main office.',
      attachments: [],
    });

    expect(result.issueCategory).toBe('supply_order');
    expect(result.priority).toBe('medium');
  });
});
```

**Integration Tests:**
```typescript
// test/email-to-ticket-flow.test.ts
describe('Email to Ticket Flow', () => {
  it('should create ticket from email end-to-end', async () => {
    // 1. Simulate email arrival
    // 2. Monitor service processes it
    // 3. AI parses it
    // 4. Ticket is created
    // 5. Customer receives confirmation
    // 6. Technician is notified
  });
});
```

**Manual Testing Checklist:**
- [ ] Paper jam emails
- [ ] Toner/supply requests
- [ ] Error code issues
- [ ] Print quality problems
- [ ] Network/connectivity issues
- [ ] General service requests
- [ ] Emails with attachments (photos of issues)
- [ ] Emails from new customers
- [ ] Emails from existing customers
- [ ] Urgent vs routine requests
- [ ] Multi-language emails (Spanish, French)
- [ ] Malformed emails (missing info)

#### Monitoring & Observability

**Metrics to Track:**
```typescript
// Prometheus metrics
const emailsProcessedCounter = new Counter({
  name: 'emails_processed_total',
  help: 'Total emails processed',
  labelNames: ['status'], // success, failed, skipped
});

const aiParsingDuration = new Histogram({
  name: 'ai_parsing_duration_seconds',
  help: 'Time to parse email with AI',
  buckets: [0.5, 1, 2, 5, 10],
});

const ticketCreationDuration = new Histogram({
  name: 'ticket_creation_duration_seconds',
  help: 'Time to create ticket from parsed data',
  buckets: [0.1, 0.5, 1, 2],
});
```

**Logging:**
```typescript
// Structured logging
logger.info('Email processed', {
  emailId: email.messageId,
  from: email.from,
  subject: email.subject,
  ticketId: ticket.id,
  duration: processingTime,
  aiConfidence: parsedData.confidence,
});
```

**Alerting:**
- Email parsing failures (> 5% failure rate)
- IMAP connection failures
- AI API errors
- Ticket creation failures
- Long processing times (> 10 seconds)

---

## Advanced Features (Post-MVP)

### Feature 1: Multi-Language Support

**Implementation:**
- Claude natively supports multiple languages
- No changes needed to prompt for basic support
- For better accuracy, detect language and include in prompt:

```typescript
import { franc } from 'franc';

const language = franc(email.body);
const languagePrompt = language === 'spa'
  ? '\n\nNote: This email is in Spanish. Parse accordingly.'
  : '';
```

### Feature 2: Attachment Processing

**Image Analysis:**
- Upload images to Claude API (supports image input)
- Extract information from photos (error screen, meter reading, etc.)
- OCR for text in images

```typescript
// Enhanced prompt with image
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 2000,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imageBase64,
          },
        },
      ],
    },
  ],
});
```

### Feature 3: Smart Follow-Up Detection

**Goal:** Detect if email is a follow-up to existing ticket

```typescript
// In prompt, include recent tickets
const recentTickets = await db.query.serviceTickets.findMany({
  where: and(
    eq(serviceTickets.customerEmail, email.from),
    gte(serviceTickets.createdAt, daysAgo(7))
  ),
});

// Ask Claude if this is a follow-up
const isFollowUp = // ... AI determines this

if (isFollowUp) {
  // Add note to existing ticket instead of creating new one
  await addTicketNote(existingTicketId, email.body);
}
```

### Feature 4: Sentiment Analysis

**Goal:** Detect angry/frustrated customers for priority escalation

```typescript
// Add to prompt
"Also analyze the customer's sentiment (frustrated, angry, neutral, satisfied) and indicate if this requires immediate attention."

// If sentiment is "angry" or "frustrated", escalate priority
if (ticketData.sentiment === 'angry') {
  ticketData.priority = 'urgent';
  // Notify manager
}
```

### Feature 5: Auto-Response Templates

**Goal:** Send intelligent auto-responses based on issue type

```typescript
const autoResponses = {
  toner_empty: `We've received your toner request. We'll ship black toner today and it should arrive by ${tomorrow()}.`,

  paper_jam: `We've received your paper jam report. A technician will contact you within 2 hours to schedule service.`,

  supply_order: `Your supply request has been received. We'll process your order and provide tracking information within 4 hours.`,
};

const autoResponse = autoResponses[ticketData.issueCategory];
if (autoResponse) {
  await sendEmail({
    to: email.from,
    subject: `Re: ${email.subject}`,
    body: autoResponse,
  });
}
```

### Feature 6: Learning & Improvement

**Goal:** Improve parsing accuracy over time

```typescript
// Admin UI to review and correct AI parsing
// Store corrections for future training

interface ParsingCorrection {
  emailId: string;
  aiParsedData: TicketData;
  correctedData: TicketData;
  correctionReason: string;
}

// Periodically analyze corrections to improve prompts
// Could fine-tune Claude model (future) with corrections
```

---

## Database Schema

### New Tables

```typescript
// shared/email-parser-schema.ts
import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const processedEmails = pgTable('processed_emails', {
  id: text('id').primaryKey(),
  emailId: text('email_id').notNull().unique(), // Message-ID header
  from: text('from').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  ticketId: text('ticket_id').references(() => serviceTickets.id),
  parsedData: jsonb('parsed_data'), // Store AI parsing result
  processingStatus: text('processing_status').notNull(), // success, failed, skipped
  processingError: text('processing_error'),
  processedAt: timestamp('processed_at').defaultNow(),
  tenantId: text('tenant_id').notNull(),
});

export const parsingCorrections = pgTable('parsing_corrections', {
  id: text('id').primaryKey(),
  emailId: text('email_id').notNull(),
  aiParsedData: jsonb('ai_parsed_data').notNull(),
  correctedData: jsonb('corrected_data').notNull(),
  correctionReason: text('correction_reason'),
  correctedBy: text('corrected_by').notNull(), // User ID
  correctedAt: timestamp('corrected_at').defaultNow(),
});

export const emailMonitorConfig = pgTable('email_monitor_config', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  emailAddress: text('email_address').notNull(),
  protocol: text('protocol').notNull(), // imap, graph, gmail
  host: text('host'),
  port: integer('port'),
  username: text('username'),
  encryptedPassword: text('encrypted_password'),
  oauthRefreshToken: text('oauth_refresh_token'),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

---

## Admin UI

### Configuration Page

**Location:** `client/src/pages/settings/email-parser.tsx`

**Features:**
- Enable/disable email monitoring
- Configure email account (IMAP, Microsoft, Gmail)
- Test connection
- View processed emails log
- Review parsing accuracy
- Correct AI parsing mistakes
- View metrics (emails processed, success rate, avg processing time)
- Manage auto-response templates

**Mockup:**
```
┌────────────────────────────────────────────────┐
│  Email to Ticket Parser Configuration         │
├────────────────────────────────────────────────┤
│                                                │
│  Status: ● ENABLED                             │
│  Last Check: 2 minutes ago                     │
│  Emails Processed Today: 47                    │
│  Success Rate: 96%                             │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  Email Account Configuration             │  │
│  │                                          │  │
│  │  Protocol: [IMAP ▼]                     │  │
│  │  Host: imap.gmail.com                   │  │
│  │  Port: 993                              │  │
│  │  Username: service@company.com          │  │
│  │  Password: ********                     │  │
│  │                                          │  │
│  │  [Test Connection] [Save Changes]       │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  Recent Processed Emails                 │  │
│  │                                          │  │
│  │  ✓ john@acme.com - Paper jam - 5m ago   │  │
│  │  ✓ mary@corp.com - Toner order - 12m    │  │
│  │  ✗ bob@test.com - Parsing failed - 1h   │  │
│  │  ✓ alice@biz.com - Service call - 2h    │  │
│  │                                          │  │
│  │  [View All Logs]                         │  │
│  └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

---

## Security Considerations

### Email Credentials Storage

**Never store plaintext passwords!**

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key

function encryptPassword(password: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptPassword(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### OAuth 2.0 (Preferred for Microsoft/Google)

```typescript
// Use OAuth instead of passwords for better security
// Store refresh tokens encrypted
// Rotate tokens regularly
```

### Email Validation

**Prevent abuse:**
- Whitelist sender domains (only accept from known customers)
- Rate limiting (max 100 emails/hour per customer)
- Spam detection (reject emails with spam characteristics)
- Attachment size limits (max 25MB total)

### GDPR Compliance

- Store email content only as long as needed (auto-delete after 90 days)
- Provide data export for customers
- Honor deletion requests

---

## Cost Analysis

### AI API Costs

**Claude Sonnet 4.5 Pricing:**
- Input: $3 per million tokens
- Output: $15 per million tokens

**Typical Email:**
- Prompt: ~1,500 tokens (email + context + instructions)
- Response: ~300 tokens (JSON output)
- **Cost per email: ~$0.009 (less than 1 cent)**

**Monthly Costs (1000 emails):**
- 1000 emails × $0.009 = **$9/month**

**Annual Costs (12,000 emails):**
- 12,000 emails × $0.009 = **$108/year**

**Extremely cost-effective!**

### Email Hosting

**IMAP (Existing Email):** $0 (use existing service@company email)

**Dedicated Email Service:**
- Google Workspace: $6/user/month
- Microsoft 365: $6/user/month

---

## ROI Calculation

### Time Savings

**Current Process:**
- Average time to manually create ticket: 5-8 minutes
- Admin handling 20-30 tickets/day
- Time spent: 2-4 hours/day

**With AI Parser:**
- Average time: < 30 seconds (automated)
- Admin only handles failed parses (5%)
- Time spent: 10-15 minutes/day

**Time Saved:**
- 2-4 hours/day × $20/hour (admin wage) = **$40-80/day**
- **$10,000-$20,000/year in labor costs**

### Improved Response Time

- **Current:** 1-4 hours (during business hours only)
- **With AI:** < 5 minutes (24/7)
- **Impact:** Higher customer satisfaction, reduced churn

### Reduced Errors

- **Current:** 10-15% of manually created tickets have errors (wrong equipment, priority, etc.)
- **With AI:** 95%+ accuracy
- **Impact:** Fewer miscommunications, better service

### ROI Summary

**Investment:**
- Development: $15,000 (1 developer, 4 weeks)
- AI API costs: $108/year
- **Total Year 1: $15,108**

**Savings:**
- Labor: $10,000-$20,000/year
- Improved efficiency: $5,000/year (reduced errors, faster response)
- **Total Annual Benefit: $15,000-$25,000**

**Payback Period:** 9-12 months
**3-Year ROI:** 200-400%

---

## Success Metrics

### Accuracy Metrics
- **Parsing Success Rate:** Target 95%+
- **Equipment Matching Accuracy:** Target 90%+
- **Category Classification Accuracy:** Target 92%+
- **Priority Assignment Accuracy:** Target 85%+

### Efficiency Metrics
- **Average Processing Time:** < 30 seconds
- **Time Saved per Ticket:** 4-7 minutes
- **Admin Time Saved:** 2-4 hours/day

### Quality Metrics
- **Customer Satisfaction:** +15% improvement in ticket creation experience
- **Response Time:** < 5 minutes (vs 1-4 hours previously)
- **Ticket Quality:** 95%+ complete information on first pass

### Adoption Metrics
- **Emails Processed:** Target 80% of inbound service requests within 3 months
- **Fallback Rate:** < 5% (emails that require manual intervention)

---

## Rollout Plan

### Week 1: Internal Testing
- Deploy to staging environment
- Test with synthetic emails
- Invite 3-5 admin users to test
- Fix critical bugs

### Week 2: Pilot (Limited Rollout)
- Enable for 10% of customers
- Monitor closely
- Gather feedback
- Iterate on prompts

### Week 3: Beta (Expanded Rollout)
- Enable for 50% of customers
- A/B test (email parser vs manual for comparison)
- Measure metrics
- Refine auto-assignment logic

### Week 4: General Availability
- Enable for 100% of customers
- Announce feature to customers
- Provide documentation
- Celebrate launch! 🎉

---

## Support & Training

### Admin Training
- 30-minute training video
- Quick start guide (PDF)
- FAQ document
- Practice emails for testing

### Customer Communication
- Announcement email: "New way to request service"
- Include email address: service@company.com
- Instructions: "Just send an email describing your issue"
- Set expectations: "You'll receive a ticket number within minutes"

---

## Future Enhancements

**Phase 2 (Future):**
1. **SMS/Text Message Parser:** Accept service requests via SMS
2. **Voice-to-Text:** Call transcription and auto-ticket creation
3. **WhatsApp Integration:** Accept tickets via WhatsApp
4. **Slack Integration:** Internal team can create tickets via Slack
5. **AI-Powered Triage:** Predict which tickets need urgent attention
6. **Automatic Parts Ordering:** AI identifies part numbers and orders automatically
7. **Customer Self-Service Portal:** Integrated with email parser for unified experience

---

## Conclusion

The AI Email-to-Ticket Parser is a high-ROI, quick-win project that delivers immediate value. With minimal development effort (3-4 weeks) and low ongoing costs (~$10/month for AI), it saves 2-4 hours of admin time per day and provides 24/7 ticket creation capability.

**Key Success Factors:**
- Robust email monitoring (handle connection failures gracefully)
- Accurate AI parsing (continuously improve prompts based on corrections)
- Reliable ticket creation (validate data, handle edge cases)
- Excellent customer communication (confirmations, updates)

**Next Steps:**
1. Set up development environment
2. Configure test email account
3. Build email monitor service
4. Integrate Claude AI parser
5. Create comprehensive test suite
6. Deploy to staging for internal testing

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-23 | Claude | Initial implementation plan |

