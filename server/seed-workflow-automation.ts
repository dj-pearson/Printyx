import { storage } from './storage';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('seed-workflow-automation');

async function seedWorkflowAutomation() {
  log.info('🔄 Seeding workflow automation data...');

  try {
    // Get test tenant and user
    const tenants = await storage.getAllTenants();
    if (tenants.length === 0) {
      log.error('❌ No tenants found. Please create a tenant first.');
      return;
    }

    const tenantId = tenants[0].id;
    const users = await storage.getUsers(tenantId);
    const userId = users.length > 0 ? users[0].id : 'system';

    log.info(`✅ Using tenant: ${tenantId}`);

    // ==================== Seed Event Registry ====================
    log.info('📋 Seeding workflow event registry...');

    const events = [
      {
        eventName: 'customer_created',
        displayName: 'Customer Created',
        description: 'Triggered when a new customer is added to the system',
        category: 'Customer Management',
        payloadSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            customerName: { type: 'string' },
            email: { type: 'string' },
            contractValue: { type: 'number' },
          },
        },
        examplePayload: {
          customerId: 'cust_123',
          customerName: 'Acme Corp',
          email: 'contact@acme.com',
          contractValue: 15000,
        },
        isActive: true,
      },
      {
        eventName: 'customer_updated',
        displayName: 'Customer Updated',
        description: 'Triggered when customer information is modified',
        category: 'Customer Management',
        payloadSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            changes: { type: 'object' },
          },
        },
        examplePayload: {
          customerId: 'cust_123',
          changes: { status: 'active' },
        },
        isActive: true,
      },
      {
        eventName: 'ticket_created',
        displayName: 'Service Ticket Created',
        description: 'Triggered when a new service ticket is created',
        category: 'Service Management',
        payloadSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string' },
            customerId: { type: 'string' },
            priority: { type: 'string' },
            equipmentId: { type: 'string' },
          },
        },
        examplePayload: {
          ticketId: 'ticket_456',
          customerId: 'cust_123',
          priority: 'high',
          equipmentId: 'eq_789',
        },
        isActive: true,
      },
      {
        eventName: 'maintenance_due',
        displayName: 'Maintenance Due',
        description: 'Triggered when equipment maintenance is due',
        category: 'Service Management',
        payloadSchema: {
          type: 'object',
          properties: {
            equipmentId: { type: 'string' },
            customerId: { type: 'string' },
            dueDate: { type: 'string' },
            maintenanceType: { type: 'string' },
          },
        },
        examplePayload: {
          equipmentId: 'eq_789',
          customerId: 'cust_123',
          dueDate: '2025-12-01',
          maintenanceType: 'preventive',
        },
        isActive: true,
      },
      {
        eventName: 'invoice_generated',
        displayName: 'Invoice Generated',
        description: 'Triggered when a new invoice is generated',
        category: 'Financial Operations',
        payloadSchema: {
          type: 'object',
          properties: {
            invoiceId: { type: 'string' },
            customerId: { type: 'string' },
            amount: { type: 'number' },
            dueDate: { type: 'string' },
          },
        },
        examplePayload: {
          invoiceId: 'inv_101',
          customerId: 'cust_123',
          amount: 2500.0,
          dueDate: '2025-12-15',
        },
        isActive: true,
      },
      {
        eventName: 'quote_approved',
        displayName: 'Quote Approved',
        description: 'Triggered when a quote is approved by a customer',
        category: 'Sales',
        payloadSchema: {
          type: 'object',
          properties: {
            quoteId: { type: 'string' },
            customerId: { type: 'string' },
            totalValue: { type: 'number' },
          },
        },
        examplePayload: {
          quoteId: 'quote_202',
          customerId: 'cust_123',
          totalValue: 18000,
        },
        isActive: true,
      },
      {
        eventName: 'lease_renewal_pending',
        displayName: 'Lease Renewal Pending',
        description: 'Triggered when a lease is approaching its renewal date',
        category: 'Lease Management',
        payloadSchema: {
          type: 'object',
          properties: {
            leaseId: { type: 'string' },
            customerId: { type: 'string' },
            renewalDate: { type: 'string' },
            equipmentCount: { type: 'number' },
          },
        },
        examplePayload: {
          leaseId: 'lease_303',
          customerId: 'cust_123',
          renewalDate: '2026-01-15',
          equipmentCount: 5,
        },
        isActive: true,
      },
      {
        eventName: 'meter_anomaly_detected',
        displayName: 'Meter Anomaly Detected',
        description: 'Triggered when unusual meter readings are detected',
        category: 'Equipment Monitoring',
        payloadSchema: {
          type: 'object',
          properties: {
            equipmentId: { type: 'string' },
            reading: { type: 'number' },
            expectedRange: { type: 'object' },
            anomalyType: { type: 'string' },
          },
        },
        examplePayload: {
          equipmentId: 'eq_789',
          reading: 15000,
          expectedRange: { min: 1000, max: 5000 },
          anomalyType: 'spike',
        },
        isActive: true,
      },
    ];

    for (const event of events) {
      await storage.createEventRegistryEntry(event);
    }

    log.info(`✅ Created ${events.length} workflow events`);

    // ==================== Seed Workflow Templates ====================
    log.info('📋 Seeding workflow templates...');

    const customerOnboardingTemplate = await storage.createWorkflowTemplate({
      name: 'Customer Onboarding Automation',
      description:
        'Automatically onboard new customers with welcome emails, setup tasks, and equipment installation scheduling',
      category: 'Customer Management',
      version: '1.0.0',
      complexity: 'moderate',
      estimatedTimeSaved: 180, // 3 hours per customer
      featured: true,
      definition: {
        triggers: [
          {
            type: 'event',
            eventName: 'customer_created',
            conditions: [
              {
                field: 'contractValue',
                operator: 'greater_than',
                value: 1000,
              },
            ],
          },
        ],
        steps: [
          {
            orderIndex: 0,
            name: 'Send Welcome Email',
            actionType: 'email',
            config: {
              template: 'welcome_customer',
              to: '{{customer.email}}',
              subject: 'Welcome to {{company.name}}!',
            },
          },
          {
            orderIndex: 1,
            name: 'Create Onboarding Checklist',
            actionType: 'create_task',
            config: {
              taskName: 'Customer Onboarding: {{customer.name}}',
              assignTo: 'customer_success_team',
              dueInDays: 7,
            },
          },
          {
            orderIndex: 2,
            name: 'Schedule Equipment Installation',
            actionType: 'schedule_appointment',
            config: {
              type: 'installation',
              durationMinutes: 120,
              assignTo: 'installation_team',
            },
          },
          {
            orderIndex: 3,
            name: 'Update CRM Status',
            actionType: 'update_crm',
            config: {
              stage: 'onboarding_in_progress',
              notifyTeams: ['sales', 'customer_success'],
            },
          },
        ],
      },
      createdBy: userId,
      previewImage: null,
    });

    const maintenanceAlertTemplate = await storage.createWorkflowTemplate({
      name: 'Equipment Maintenance Alert Workflow',
      description:
        'Automatically schedule preventive maintenance, create service tickets, and notify customers',
      category: 'Service Management',
      version: '1.0.0',
      complexity: 'simple',
      estimatedTimeSaved: 120, // 2 hours per maintenance cycle
      featured: true,
      definition: {
        triggers: [
          {
            type: 'event',
            eventName: 'maintenance_due',
          },
        ],
        steps: [
          {
            orderIndex: 0,
            name: 'Check Equipment Status',
            actionType: 'database_update',
            config: {
              query: 'equipment_status',
              conditions: ['meter_reading', 'error_logs'],
            },
          },
          {
            orderIndex: 1,
            name: 'Generate Service Ticket',
            actionType: 'create_ticket',
            config: {
              priority: 'normal',
              type: 'preventive_maintenance',
              autoAssign: true,
            },
          },
          {
            orderIndex: 2,
            name: 'Notify Customer',
            actionType: 'send_notification',
            config: {
              channels: ['email', 'sms'],
              template: 'maintenance_notification',
            },
          },
          {
            orderIndex: 3,
            name: 'Order Parts if Needed',
            actionType: 'order_parts',
            config: {
              checkInventory: true,
              autoOrder: true,
            },
          },
        ],
      },
      createdBy: userId,
      previewImage: null,
    });

    const invoiceProcessingTemplate = await storage.createWorkflowTemplate({
      name: 'Invoice Processing Automation',
      description:
        'Automatically generate, calculate, and send invoices based on meter readings and service calls',
      category: 'Financial Operations',
      version: '1.0.0',
      complexity: 'moderate',
      estimatedTimeSaved: 240, // 4 hours per billing cycle
      featured: true,
      definition: {
        triggers: [
          {
            type: 'schedule',
            cronExpression: '0 0 1 * *', // First day of every month
          },
        ],
        steps: [
          {
            orderIndex: 0,
            name: 'Gather Billing Data',
            actionType: 'database_update',
            config: {
              sources: ['meter_readings', 'service_calls', 'contracts'],
              dateRange: 'last_month',
            },
          },
          {
            orderIndex: 1,
            name: 'Calculate Charges',
            actionType: 'transform_data',
            config: {
              rules: ['tiered_pricing', 'service_charges', 'discounts'],
              validation: 'double_check',
            },
          },
          {
            orderIndex: 2,
            name: 'Generate Invoice',
            actionType: 'generate_invoice',
            config: {
              template: 'standard_invoice',
              format: 'pdf',
            },
          },
          {
            orderIndex: 3,
            name: 'Send to Customer',
            actionType: 'email',
            config: {
              template: 'invoice_email',
              attachInvoice: true,
            },
          },
          {
            orderIndex: 4,
            name: 'Sync to Accounting',
            actionType: 'call_integration',
            config: {
              integration: 'quickbooks',
              syncMode: 'immediate',
            },
          },
        ],
      },
      createdBy: userId,
      previewImage: null,
    });

    const quoteFollowUpTemplate = await storage.createWorkflowTemplate({
      name: 'Quote Follow-up Automation',
      description:
        'Automatically follow up on pending quotes and convert approved quotes to contracts',
      category: 'Sales',
      version: '1.0.0',
      complexity: 'simple',
      estimatedTimeSaved: 90, // 1.5 hours per quote
      featured: false,
      definition: {
        triggers: [
          {
            type: 'event',
            eventName: 'quote_approved',
          },
        ],
        steps: [
          {
            orderIndex: 0,
            name: 'Send Thank You Email',
            actionType: 'email',
            config: {
              template: 'quote_approved_thanks',
              to: '{{customer.email}}',
            },
          },
          {
            orderIndex: 1,
            name: 'Create Contract',
            actionType: 'database_update',
            config: {
              entity: 'contract',
              source: 'quote',
            },
          },
          {
            orderIndex: 2,
            name: 'Create Implementation Tasks',
            actionType: 'create_task',
            config: {
              taskList: 'contract_implementation',
              assignTo: 'implementation_team',
            },
          },
          {
            orderIndex: 3,
            name: 'Update CRM',
            actionType: 'update_crm',
            config: {
              stage: 'closed_won',
              notifyTeams: ['sales'],
            },
          },
        ],
      },
      createdBy: userId,
      previewImage: null,
    });

    log.info('✅ Created 4 workflow templates');

    // ==================== Create Sample Workflow from Template ====================
    log.info('📋 Creating sample workflow from template...');

    const sampleWorkflow = await storage.createWorkflow({
      tenantId,
      name: 'Customer Onboarding - Production',
      description: 'Active customer onboarding workflow for new business customers',
      category: 'Customer Management',
      status: 'active',
      currentVersionId: null,
      isTemplate: false,
      createdBy: userId,
      lastModifiedBy: null,
    });

    // Create workflow version
    const sampleVersion = await storage.createWorkflowVersion({
      workflowId: sampleWorkflow.id,
      version: 1,
      schemaHash: null,
      definition: customerOnboardingTemplate.definition,
      changelog: 'Initial version cloned from Customer Onboarding template',
      createdBy: userId,
    });

    await storage.updateWorkflow(sampleWorkflow.id, {
      currentVersionId: sampleVersion.id,
    });

    // Create trigger for the workflow
    const sampleTrigger = await storage.createWorkflowTrigger({
      workflowId: sampleWorkflow.id,
      type: 'event',
      eventName: 'customer_created',
      webhookPath: null,
      payloadMapping: {
        customerId: '$.customerId',
        customerName: '$.customerName',
        email: '$.email',
        contractValue: '$.contractValue',
      },
      enabled: true,
    });

    // Create trigger conditions
    await storage.createWorkflowCondition({
      triggerId: sampleTrigger.id,
      stepId: null,
      conditionGroup: 'default',
      logicalOperator: 'AND',
      leftOperand: 'contractValue',
      operator: 'greater_than',
      rightOperand: '1000',
      dataType: 'number',
      orderIndex: 0,
    });

    // Create workflow steps
    const steps = [
      {
        name: 'Send Welcome Email',
        actionType: 'email' as const,
        orderIndex: 0,
        config: {
          template: 'welcome_customer',
          to: '{{customer.email}}',
          subject: 'Welcome to Printyx!',
          body: 'Thank you for choosing us for your printing needs.',
        },
      },
      {
        name: 'Create Onboarding Task',
        actionType: 'create_task' as const,
        orderIndex: 1,
        config: {
          taskName: 'Complete customer onboarding',
          assignTo: 'customer_success_team',
          dueInDays: 7,
        },
      },
      {
        name: 'Schedule Installation',
        actionType: 'schedule_appointment' as const,
        orderIndex: 2,
        config: {
          type: 'equipment_installation',
          durationMinutes: 120,
        },
      },
    ];

    for (const step of steps) {
      await storage.createWorkflowStep({
        workflowId: sampleWorkflow.id,
        name: step.name,
        description: null,
        actionType: step.actionType,
        config: step.config,
        orderIndex: step.orderIndex,
        retryEnabled: true,
        maxRetries: 3,
        retryDelaySeconds: 60,
        timeoutSeconds: 300,
        continueOnError: false,
      });
    }

    log.info('✅ Created sample workflow with triggers and steps');

    // ==================== Create Sample Executions ====================
    log.info('📋 Creating sample workflow executions...');

    const execution1 = await storage.createWorkflowExecution({
      workflowId: sampleWorkflow.id,
      workflowVersionId: sampleVersion.id,
      triggerId: sampleTrigger.id,
      tenantId,
      status: 'completed',
      initiatedBy: 'system',
      context: {
        customer: {
          id: 'cust_001',
          name: 'ABC Corporation',
          email: 'contact@abc.com',
        },
      },
      result: { message: 'Workflow executed successfully' },
      error: null,
      startedAt: new Date('2025-11-01T10:00:00Z'),
      completedAt: new Date('2025-11-01T10:05:30Z'),
    });

    await storage.createExecutionEvent({
      executionId: execution1.id,
      stepExecutionId: null,
      eventType: 'execution_started',
      message: 'Workflow execution started',
      eventData: { trigger: 'customer_created' },
    });

    await storage.createExecutionEvent({
      executionId: execution1.id,
      stepExecutionId: null,
      eventType: 'execution_completed',
      message: 'Workflow execution completed successfully',
      eventData: { duration: 330000 },
    });

    const execution2 = await storage.createWorkflowExecution({
      workflowId: sampleWorkflow.id,
      workflowVersionId: sampleVersion.id,
      triggerId: sampleTrigger.id,
      tenantId,
      status: 'failed',
      initiatedBy: 'system',
      context: {
        customer: {
          id: 'cust_002',
          name: 'XYZ Inc',
          email: 'info@xyz.com',
        },
      },
      result: null,
      error: 'Failed to send welcome email: SMTP connection timeout',
      startedAt: new Date('2025-11-01T14:00:00Z'),
      completedAt: new Date('2025-11-01T14:02:15Z'),
    });

    await storage.createExecutionEvent({
      executionId: execution2.id,
      stepExecutionId: null,
      eventType: 'execution_failed',
      message: 'Workflow execution failed',
      eventData: { error: 'SMTP timeout' },
    });

    const execution3 = await storage.createWorkflowExecution({
      workflowId: sampleWorkflow.id,
      workflowVersionId: sampleVersion.id,
      triggerId: null,
      tenantId,
      status: 'running',
      initiatedBy: userId,
      context: {
        customer: {
          id: 'cust_003',
          name: 'Tech Solutions LLC',
          email: 'hello@techsolutions.com',
        },
      },
      result: null,
      error: null,
      startedAt: new Date(),
      completedAt: null,
    });

    await storage.createExecutionEvent({
      executionId: execution3.id,
      stepExecutionId: null,
      eventType: 'execution_started',
      message: 'Workflow execution started manually',
      eventData: { userId },
    });

    log.info('✅ Created 3 sample workflow executions');

    log.info('✅ Workflow automation seeding completed successfully!');
  } catch (error) {
    log.error('❌ Error seeding workflow automation:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedWorkflowAutomation()
    .then(() => {
      log.info('✅ Seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      log.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedWorkflowAutomation };
