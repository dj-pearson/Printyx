import { db } from './db';
import { workflowEventRegistry } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('seed-workflow-events');

/**
 * Seed Workflow Event Registry
 *
 * Populates the event registry with common business events that can trigger workflows.
 * These events cover typical dealer operations including contracts, quotes, orders,
 * customers, service calls, and invoicing.
 */

const eventDefinitions = [
  // ==================== Contract Events ====================
  {
    eventName: 'contract.signed',
    displayName: 'Contract Signed',
    description: 'Triggered when a new contract is signed by a customer',
    category: 'Contracts',
    payloadSchema: {
      type: 'object',
      properties: {
        contractId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        monthlyValue: { type: 'number' },
        annualValue: { type: 'number' },
        equipmentIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['contractId', 'customerId'],
    },
    examplePayload: {
      contractId: 'contract-123',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      startDate: '2025-02-01',
      endDate: '2028-01-31',
      monthlyValue: 1500,
      annualValue: 18000,
      equipmentIds: ['equip-1', 'equip-2'],
    },
  },
  {
    eventName: 'contract.renewed',
    displayName: 'Contract Renewed',
    description: 'Triggered when an existing contract is renewed',
    category: 'Contracts',
    payloadSchema: {
      type: 'object',
      properties: {
        contractId: { type: 'string' },
        previousContractId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        renewalDate: { type: 'string', format: 'date' },
        newEndDate: { type: 'string', format: 'date' },
        monthlyValue: { type: 'number' },
      },
      required: ['contractId', 'customerId'],
    },
    examplePayload: {
      contractId: 'contract-789',
      previousContractId: 'contract-123',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      renewalDate: '2025-02-01',
      newEndDate: '2028-01-31',
      monthlyValue: 1650,
    },
  },
  {
    eventName: 'contract.expiring',
    displayName: 'Contract Expiring Soon',
    description: 'Triggered when a contract is approaching expiration (typically 90 days)',
    category: 'Contracts',
    payloadSchema: {
      type: 'object',
      properties: {
        contractId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        endDate: { type: 'string', format: 'date' },
        daysUntilExpiration: { type: 'number' },
        monthlyValue: { type: 'number' },
      },
      required: ['contractId', 'customerId', 'endDate'],
    },
    examplePayload: {
      contractId: 'contract-123',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      endDate: '2025-05-01',
      daysUntilExpiration: 90,
      monthlyValue: 1500,
    },
  },

  // ==================== Quote Events ====================
  {
    eventName: 'quote.submitted',
    displayName: 'Quote Submitted',
    description: 'Triggered when a quote is created and submitted',
    category: 'Sales',
    payloadSchema: {
      type: 'object',
      properties: {
        quoteId: { type: 'string' },
        quoteNumber: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        totalAmount: { type: 'number' },
        margin: { type: 'number' },
        marginPercent: { type: 'number' },
        marginColor: { type: 'string', enum: ['green', 'yellow', 'red'] },
        products: { type: 'array' },
        createdBy: { type: 'string' },
      },
      required: ['quoteId', 'customerId', 'totalAmount'],
    },
    examplePayload: {
      quoteId: 'quote-123',
      quoteNumber: 'Q-2025-001',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      totalAmount: 45000,
      margin: 5000,
      marginPercent: 11.1,
      marginColor: 'yellow',
      products: ['printer-1', 'printer-2'],
      createdBy: 'user-789',
    },
  },
  {
    eventName: 'quote.approved',
    displayName: 'Quote Approved',
    description: 'Triggered when a quote is approved by management',
    category: 'Sales',
    payloadSchema: {
      type: 'object',
      properties: {
        quoteId: { type: 'string' },
        customerId: { type: 'string' },
        approvedBy: { type: 'string' },
        approvalDate: { type: 'string', format: 'date' },
      },
      required: ['quoteId', 'customerId'],
    },
    examplePayload: {
      quoteId: 'quote-123',
      customerId: 'customer-456',
      approvedBy: 'manager-123',
      approvalDate: '2025-02-01',
    },
  },
  {
    eventName: 'quote.low_margin',
    displayName: 'Quote with Low Margin',
    description: 'Triggered when a quote is submitted with margin in yellow or red zone',
    category: 'Sales',
    payloadSchema: {
      type: 'object',
      properties: {
        quoteId: { type: 'string' },
        quoteNumber: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        totalAmount: { type: 'number' },
        margin: { type: 'number' },
        marginPercent: { type: 'number' },
        marginColor: { type: 'string', enum: ['yellow', 'red'] },
        createdBy: { type: 'string' },
      },
      required: ['quoteId', 'customerId', 'marginColor'],
    },
    examplePayload: {
      quoteId: 'quote-456',
      quoteNumber: 'Q-2025-002',
      customerId: 'customer-789',
      customerName: 'Tech Solutions Inc',
      totalAmount: 35000,
      margin: 1500,
      marginPercent: 4.3,
      marginColor: 'red',
      createdBy: 'user-789',
    },
  },

  // ==================== Customer Events ====================
  {
    eventName: 'customer.created',
    displayName: 'New Customer Created',
    description: 'Triggered when a new customer record is created',
    category: 'CRM',
    payloadSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        contactEmail: { type: 'string' },
        contactPhone: { type: 'string' },
        address: { type: 'string' },
        assignedTo: { type: 'string' },
        source: { type: 'string' },
        createdBy: { type: 'string' },
      },
      required: ['customerId', 'customerName'],
    },
    examplePayload: {
      customerId: 'customer-123',
      customerName: 'New Corp LLC',
      contactEmail: 'contact@newcorp.com',
      contactPhone: '555-1234',
      address: '123 Main St, City, ST 12345',
      assignedTo: 'sales-rep-456',
      source: 'website',
      createdBy: 'user-789',
    },
  },
  {
    eventName: 'lead.converted',
    displayName: 'Lead Converted to Customer',
    description: 'Triggered when a lead is converted to a customer',
    category: 'CRM',
    payloadSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        convertedBy: { type: 'string' },
        conversionDate: { type: 'string', format: 'date' },
        dealValue: { type: 'number' },
      },
      required: ['leadId', 'customerId'],
    },
    examplePayload: {
      leadId: 'lead-123',
      customerId: 'customer-456',
      customerName: 'Converted Corp',
      convertedBy: 'sales-rep-789',
      conversionDate: '2025-02-01',
      dealValue: 50000,
    },
  },

  // ==================== Order Events ====================
  {
    eventName: 'order.created',
    displayName: 'Order Created',
    description: 'Triggered when a new order is created',
    category: 'Orders',
    payloadSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        orderNumber: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        totalAmount: { type: 'number' },
        products: { type: 'array' },
        orderDate: { type: 'string', format: 'date' },
        estimatedDeliveryDate: { type: 'string', format: 'date' },
      },
      required: ['orderId', 'customerId', 'totalAmount'],
    },
    examplePayload: {
      orderId: 'order-123',
      orderNumber: 'ORD-2025-001',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      totalAmount: 45000,
      products: ['printer-1', 'printer-2'],
      orderDate: '2025-02-01',
      estimatedDeliveryDate: '2025-02-15',
    },
  },
  {
    eventName: 'order.shipped',
    displayName: 'Order Shipped',
    description: 'Triggered when an order is shipped',
    category: 'Orders',
    payloadSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        customerId: { type: 'string' },
        trackingNumber: { type: 'string' },
        carrier: { type: 'string' },
        shipDate: { type: 'string', format: 'date' },
        estimatedDeliveryDate: { type: 'string', format: 'date' },
      },
      required: ['orderId', 'customerId'],
    },
    examplePayload: {
      orderId: 'order-123',
      customerId: 'customer-456',
      trackingNumber: '1Z999AA10123456784',
      carrier: 'UPS',
      shipDate: '2025-02-08',
      estimatedDeliveryDate: '2025-02-12',
    },
  },
  {
    eventName: 'order.delivered',
    displayName: 'Order Delivered',
    description: 'Triggered when an order is delivered to customer',
    category: 'Orders',
    payloadSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        customerId: { type: 'string' },
        deliveryDate: { type: 'string', format: 'date' },
        signedBy: { type: 'string' },
      },
      required: ['orderId', 'customerId', 'deliveryDate'],
    },
    examplePayload: {
      orderId: 'order-123',
      customerId: 'customer-456',
      deliveryDate: '2025-02-12',
      signedBy: 'John Doe',
    },
  },

  // ==================== Service Events ====================
  {
    eventName: 'service_call.created',
    displayName: 'Service Call Created',
    description: 'Triggered when a new service call is created',
    category: 'Service',
    payloadSchema: {
      type: 'object',
      properties: {
        serviceCallId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        equipmentId: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        issueDescription: { type: 'string' },
        createdBy: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
      required: ['serviceCallId', 'customerId', 'equipmentId'],
    },
    examplePayload: {
      serviceCallId: 'service-123',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      equipmentId: 'equip-789',
      priority: 'high',
      issueDescription: 'Paper jam and error code E101',
      createdBy: 'user-123',
      createdAt: '2025-02-01T10:30:00Z',
    },
  },
  {
    eventName: 'service_call.completed',
    displayName: 'Service Call Completed',
    description: 'Triggered when a service call is completed',
    category: 'Service',
    payloadSchema: {
      type: 'object',
      properties: {
        serviceCallId: { type: 'string' },
        customerId: { type: 'string' },
        technicianId: { type: 'string' },
        technicianName: { type: 'string' },
        completedAt: { type: 'string', format: 'date-time' },
        resolutionNotes: { type: 'string' },
        partsUsed: { type: 'array' },
        laborHours: { type: 'number' },
      },
      required: ['serviceCallId', 'customerId', 'completedAt'],
    },
    examplePayload: {
      serviceCallId: 'service-123',
      customerId: 'customer-456',
      technicianId: 'tech-789',
      technicianName: 'Mike Johnson',
      completedAt: '2025-02-01T14:30:00Z',
      resolutionNotes: 'Cleared paper jam and replaced fuser unit',
      partsUsed: ['fuser-unit-123'],
      laborHours: 1.5,
    },
  },
  {
    eventName: 'equipment.installed',
    displayName: 'Equipment Installed',
    description: 'Triggered when equipment installation is completed',
    category: 'Service',
    payloadSchema: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        modelNumber: { type: 'string' },
        serialNumber: { type: 'string' },
        installationDate: { type: 'string', format: 'date' },
        installedBy: { type: 'string' },
        contractId: { type: 'string' },
      },
      required: ['equipmentId', 'customerId', 'installationDate'],
    },
    examplePayload: {
      equipmentId: 'equip-123',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      modelNumber: 'MX-5070V',
      serialNumber: 'SN123456789',
      installationDate: '2025-02-01',
      installedBy: 'tech-789',
      contractId: 'contract-123',
    },
  },

  // ==================== Invoice Events ====================
  {
    eventName: 'invoice.generated',
    displayName: 'Invoice Generated',
    description: 'Triggered when a new invoice is generated',
    category: 'Billing',
    payloadSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        invoiceNumber: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        totalAmount: { type: 'number' },
        dueDate: { type: 'string', format: 'date' },
        lineItems: { type: 'array' },
        generatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['invoiceId', 'customerId', 'totalAmount'],
    },
    examplePayload: {
      invoiceId: 'invoice-123',
      invoiceNumber: 'INV-2025-001',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      totalAmount: 1500,
      dueDate: '2025-03-01',
      lineItems: [{ description: 'Monthly MPS Service', amount: 1500 }],
      generatedAt: '2025-02-01T00:00:00Z',
    },
  },
  {
    eventName: 'invoice.paid',
    displayName: 'Invoice Paid',
    description: 'Triggered when an invoice is marked as paid',
    category: 'Billing',
    payloadSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        customerId: { type: 'string' },
        paymentAmount: { type: 'number' },
        paymentMethod: { type: 'string' },
        paymentDate: { type: 'string', format: 'date' },
        paymentReference: { type: 'string' },
      },
      required: ['invoiceId', 'customerId', 'paymentAmount'],
    },
    examplePayload: {
      invoiceId: 'invoice-123',
      customerId: 'customer-456',
      paymentAmount: 1500,
      paymentMethod: 'ACH',
      paymentDate: '2025-02-15',
      paymentReference: 'ACH-20250215-001',
    },
  },
  {
    eventName: 'invoice.overdue',
    displayName: 'Invoice Overdue',
    description: 'Triggered when an invoice passes its due date without payment',
    category: 'Billing',
    payloadSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        invoiceNumber: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        totalAmount: { type: 'number' },
        dueDate: { type: 'string', format: 'date' },
        daysOverdue: { type: 'number' },
      },
      required: ['invoiceId', 'customerId', 'daysOverdue'],
    },
    examplePayload: {
      invoiceId: 'invoice-123',
      invoiceNumber: 'INV-2025-001',
      customerId: 'customer-456',
      customerName: 'Acme Corp',
      totalAmount: 1500,
      dueDate: '2025-03-01',
      daysOverdue: 5,
    },
  },
];

async function seedWorkflowEvents() {
  log.info('🌱 Seeding workflow event registry...');

  try {
    for (const eventDef of eventDefinitions) {
      // Check if event already exists
      const existing = await db.query.workflowEventRegistry.findFirst({
        where: eq(workflowEventRegistry.eventName, eventDef.eventName),
      });

      if (existing) {
        log.info(`  ⏭️  Skipping ${eventDef.displayName} (already exists)`);
        continue;
      }

      // Insert event
      await db.insert(workflowEventRegistry).values({
        eventName: eventDef.eventName,
        displayName: eventDef.displayName,
        description: eventDef.description,
        category: eventDef.category,
        payloadSchema: eventDef.payloadSchema as any,
        examplePayload: eventDef.examplePayload as any,
        isActive: true,
      });

      log.info(`  ✅ Created ${eventDef.displayName}`);
    }

    log.info(`\n✨ Successfully seeded ${eventDefinitions.length} workflow events!`);
  } catch (error) {
    log.error('❌ Error seeding workflow events:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedWorkflowEvents()
    .then(() => process.exit(0))
    .catch((error) => {
      log.error(error);
      process.exit(1);
    });
}

export { seedWorkflowEvents };
