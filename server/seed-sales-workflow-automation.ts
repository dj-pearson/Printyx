import { db } from './db';
import {
  workflows,
  workflowVersions,
  workflowTriggers,
  workflowStepsAutomation,
  workflowTemplates,
  handoffTaskTemplates,
  renewalPlaybooks,
  leadAssignmentRules,
  salesTerritories,
  type InsertWorkflowTemplate,
  type InsertHandoffTaskTemplate,
  type InsertRenewalPlaybook,
  type InsertLeadAssignmentRule,
  type InsertSalesTerritory,
} from '@shared/schema';

export async function seedSalesWorkflowAutomation() {
  console.log('🚀 Seeding sales workflow automation...');

  try {
    // Get a test tenant (for demo purposes)
    const tenants = await db.query.tenants.findMany({ limit: 1 });
    if (tenants.length === 0) {
      console.error('❌ No tenants found. Please create a tenant first.');
      return;
    }

    const tenantId = tenants[0].id;
    console.log(`✅ Using tenant: ${tenantId}`);

    // ==================== Seed Sales Territories ====================
    console.log('📍 Seeding sales territories...');

    const eastCoastTerritory = await db
      .insert(salesTerritories)
      .values({
        tenantId,
        territoryName: 'East Coast',
        territoryCode: 'EC-001',
        description: 'Eastern seaboard states',
        territoryType: 'geographic',
        geographicRules: {
          states: [
            'NY',
            'NJ',
            'PA',
            'MD',
            'VA',
            'NC',
            'SC',
            'GA',
            'FL',
            'MA',
            'CT',
            'RI',
            'NH',
            'ME',
            'VT',
          ],
        },
        isActive: true,
        priority: 10,
        monthlyQuota: '150000.00',
      })
      .returning();

    const westCoastTerritory = await db
      .insert(salesTerritories)
      .values({
        tenantId,
        territoryName: 'West Coast',
        territoryCode: 'WC-001',
        description: 'Western states',
        territoryType: 'geographic',
        geographicRules: {
          states: ['CA', 'OR', 'WA', 'NV', 'AZ'],
        },
        isActive: true,
        priority: 10,
        monthlyQuota: '200000.00',
      })
      .returning();

    const enterpriseTerritory = await db
      .insert(salesTerritories)
      .values({
        tenantId,
        territoryName: 'Enterprise Accounts',
        territoryCode: 'ENT-001',
        description: 'Large enterprise customers (500+ employees)',
        territoryType: 'account_size',
        accountRules: {
          companySizeMin: 500,
          revenueMin: 50000000,
        },
        isActive: true,
        priority: 20,
        monthlyQuota: '500000.00',
      })
      .returning();

    console.log(`✅ Created ${3} sales territories`);

    // ==================== Seed Lead Assignment Rules ====================
    console.log('🎯 Seeding lead assignment rules...');

    await db.insert(leadAssignmentRules).values({
      tenantId,
      ruleName: 'Enterprise Lead Assignment',
      description: 'Assign enterprise-level leads to specialized team',
      assignmentType: 'territory',
      criteria: {
        companySize: { min: 500 },
        dealSize: { min: 50000 },
      },
      territoryId: enterpriseTerritory[0].id,
      priority: 100,
      isActive: true,
      respectCapacityLimits: true,
      assignImmediately: true,
      escalationEnabled: true,
      escalateAfterMinutes: 30,
    });

    await db.insert(leadAssignmentRules).values({
      tenantId,
      ruleName: 'West Coast Geographic Assignment',
      description: 'Route western US leads to West Coast team',
      assignmentType: 'territory',
      criteria: {
        geography: {
          states: ['CA', 'OR', 'WA', 'NV', 'AZ'],
        },
      },
      territoryId: westCoastTerritory[0].id,
      priority: 50,
      isActive: true,
      respectCapacityLimits: true,
      assignImmediately: true,
    });

    await db.insert(leadAssignmentRules).values({
      tenantId,
      ruleName: 'East Coast Geographic Assignment',
      description: 'Route eastern US leads to East Coast team',
      assignmentType: 'territory',
      criteria: {
        geography: {
          states: [
            'NY',
            'NJ',
            'PA',
            'MD',
            'VA',
            'NC',
            'SC',
            'GA',
            'FL',
            'MA',
            'CT',
            'RI',
            'NH',
            'ME',
            'VT',
          ],
        },
      },
      territoryId: eastCoastTerritory[0].id,
      priority: 50,
      isActive: true,
      respectCapacityLimits: true,
      assignImmediately: true,
    });

    await db.insert(leadAssignmentRules).values({
      tenantId,
      ruleName: 'High-Score Lead Priority Assignment',
      description: 'Immediately assign high-scoring leads to available rep',
      assignmentType: 'round_robin',
      criteria: {
        leadScore: { min: 80 },
      },
      priority: 90,
      isActive: true,
      respectCapacityLimits: false, // Override capacity for hot leads
      assignImmediately: true,
      escalationEnabled: true,
      escalateAfterMinutes: 15,
    });

    console.log(`✅ Created 4 lead assignment rules`);

    // ==================== Seed Handoff Task Templates ====================
    console.log('📋 Seeding handoff task templates...');

    await db.insert(handoffTaskTemplates).values({
      tenantId,
      templateName: 'New Customer Onboarding Checklist',
      handoffType: 'new_customer',
      description: 'Standard tasks for onboarding a new customer after contract signing',
      tasks: [
        {
          taskName: 'Complete Account Profile',
          description: 'Fill in all customer details, contacts, and preferences',
          assignToRole: 'sales_rep',
          category: 'account_setup',
          isRequired: true,
          orderIndex: 0,
          dueInDays: 1,
        },
        {
          taskName: 'Assign Customer Success Manager',
          description: 'Identify and assign the appropriate CSM based on account size and needs',
          assignToRole: 'sales_manager',
          category: 'account_setup',
          isRequired: true,
          orderIndex: 1,
          dueInDays: 1,
        },
        {
          taskName: 'Schedule Kickoff Call',
          description: 'Schedule introductory call with customer, sales rep, and CSM',
          assignToRole: 'csm',
          category: 'account_setup',
          isRequired: true,
          orderIndex: 2,
          dueInDays: 3,
          dependencies: ['Assign Customer Success Manager'],
        },
        {
          taskName: 'Setup Billing in Accounting System',
          description: 'Create customer in QuickBooks and configure billing schedule',
          assignToRole: 'billing',
          category: 'billing',
          isRequired: true,
          orderIndex: 3,
          dueInDays: 2,
        },
        {
          taskName: 'Conduct Site Survey',
          description: 'Visit customer site to assess installation requirements',
          assignToRole: 'tech',
          category: 'technical',
          isRequired: true,
          orderIndex: 4,
          dueInDays: 5,
        },
        {
          taskName: 'Schedule Equipment Delivery',
          description: 'Coordinate delivery date with customer and warehouse',
          assignToRole: 'implementation',
          category: 'technical',
          isRequired: true,
          orderIndex: 5,
          dueInDays: 7,
          dependencies: ['Conduct Site Survey'],
        },
        {
          taskName: 'Schedule Installation',
          description: 'Book installation technicians and coordinate with customer',
          assignToRole: 'implementation',
          category: 'technical',
          isRequired: true,
          orderIndex: 6,
          dueInDays: 10,
          dependencies: ['Schedule Equipment Delivery'],
        },
        {
          taskName: 'Setup Training Session',
          description: 'Schedule user training for customer team',
          assignToRole: 'csm',
          category: 'training',
          isRequired: true,
          orderIndex: 7,
          dueInDays: 14,
          dependencies: ['Schedule Installation'],
        },
        {
          taskName: 'Activate Customer Portal Access',
          description: 'Provision customer portal accounts for all users',
          assignToRole: 'implementation',
          category: 'account_setup',
          isRequired: false,
          orderIndex: 8,
          dueInDays: 3,
        },
        {
          taskName: 'Complete Handoff Documentation',
          description:
            'Document all account details, special requirements, and customer preferences',
          assignToRole: 'sales_rep',
          category: 'documentation',
          isRequired: true,
          orderIndex: 9,
          dueInDays: 2,
        },
      ],
      isActive: true,
      isDefault: true,
    });

    await db.insert(handoffTaskTemplates).values({
      tenantId,
      templateName: 'Expansion Sale Handoff',
      handoffType: 'expansion',
      description: 'Tasks for handling expansion sales to existing customers',
      tasks: [
        {
          taskName: 'Update Account Profile',
          description: 'Add new equipment and service details to existing account',
          assignToRole: 'sales_rep',
          category: 'account_setup',
          isRequired: true,
          orderIndex: 0,
          dueInDays: 1,
        },
        {
          taskName: 'Notify Assigned CSM',
          description: 'Alert current CSM about expansion and updated contract terms',
          assignToRole: 'sales_rep',
          category: 'account_setup',
          isRequired: true,
          orderIndex: 1,
          dueInDays: 1,
        },
        {
          taskName: 'Update Billing Terms',
          description: 'Modify billing in accounting system to reflect new contract value',
          assignToRole: 'billing',
          category: 'billing',
          isRequired: true,
          orderIndex: 2,
          dueInDays: 2,
        },
        {
          taskName: 'Schedule Equipment Delivery',
          description: 'Coordinate delivery of additional equipment',
          assignToRole: 'implementation',
          category: 'technical',
          isRequired: true,
          orderIndex: 3,
          dueInDays: 5,
        },
        {
          taskName: 'Schedule Installation',
          description: 'Book installation for new equipment',
          assignToRole: 'tech',
          category: 'technical',
          isRequired: true,
          orderIndex: 4,
          dueInDays: 7,
          dependencies: ['Schedule Equipment Delivery'],
        },
      ],
      isActive: true,
      isDefault: false,
    });

    console.log(`✅ Created 2 handoff task templates`);

    // ==================== Seed Renewal Playbooks ====================
    console.log('🔄 Seeding renewal playbooks...');

    await db.insert(renewalPlaybooks).values({
      tenantId,
      playbookName: 'Standard 90-Day Renewal Playbook',
      description: 'Standard renewal process for contracts >$10k with 90-day lead time',
      triggerConditions: {
        daysBeforeRenewal: 90,
        contractValueMin: 10000,
        riskLevel: ['low', 'medium'],
      },
      steps: [
        {
          stepName: 'Schedule QBR',
          description: 'Schedule Quarterly Business Review with customer stakeholders',
          orderIndex: 0,
          daysBeforeRenewal: 90,
          assignToRole: 'csm',
          actionType: 'meeting',
          isRequired: true,
        },
        {
          stepName: 'Analyze Usage Data',
          description: 'Review meter readings and usage patterns to identify upsell opportunities',
          orderIndex: 1,
          daysBeforeRenewal: 75,
          assignToRole: 'csm',
          actionType: 'call',
          isRequired: true,
        },
        {
          stepName: 'Prepare Renewal Proposal',
          description: 'Create renewal proposal with recommended equipment and pricing',
          orderIndex: 2,
          daysBeforeRenewal: 60,
          assignToRole: 'account_executive',
          actionType: 'send_proposal',
          isRequired: true,
        },
        {
          stepName: 'Send Renewal Proposal',
          description: 'Email renewal proposal to decision makers',
          orderIndex: 3,
          daysBeforeRenewal: 60,
          assignToRole: 'account_executive',
          actionType: 'email',
          isRequired: true,
        },
        {
          stepName: 'Follow-Up Call',
          description: 'Call to discuss proposal and address questions',
          orderIndex: 4,
          daysBeforeRenewal: 50,
          assignToRole: 'account_executive',
          actionType: 'call',
          isRequired: true,
        },
        {
          stepName: 'Negotiation Meeting',
          description: 'Schedule meeting to negotiate final terms if needed',
          orderIndex: 5,
          daysBeforeRenewal: 40,
          assignToRole: 'account_executive',
          actionType: 'meeting',
          isRequired: false,
        },
        {
          stepName: 'Send Contract for Signature',
          description: 'Send renewal contract via DocuSign',
          orderIndex: 6,
          daysBeforeRenewal: 30,
          assignToRole: 'account_executive',
          actionType: 'send_proposal',
          isRequired: true,
          completionCriteria: 'Contract signed',
        },
        {
          stepName: 'Final Reminder',
          description: 'Send final reminder if contract not yet signed',
          orderIndex: 7,
          daysBeforeRenewal: 15,
          assignToRole: 'account_executive',
          actionType: 'email',
          isRequired: true,
        },
      ],
      isActive: true,
      isDefault: true,
    });

    await db.insert(renewalPlaybooks).values({
      tenantId,
      playbookName: 'At-Risk Customer Renewal Playbook',
      description: 'Intensive renewal process for at-risk customers',
      triggerConditions: {
        daysBeforeRenewal: 120,
        riskLevel: ['high', 'critical'],
      },
      steps: [
        {
          stepName: 'Executive Escalation',
          description: 'Alert executive team about at-risk renewal',
          orderIndex: 0,
          daysBeforeRenewal: 120,
          assignToRole: 'executive',
          actionType: 'email',
          isRequired: true,
        },
        {
          stepName: 'Customer Health Assessment',
          description: 'Conduct thorough review of customer satisfaction and pain points',
          orderIndex: 1,
          daysBeforeRenewal: 110,
          assignToRole: 'csm',
          actionType: 'call',
          isRequired: true,
        },
        {
          stepName: 'Executive QBR',
          description: 'Schedule QBR with executive sponsors from both sides',
          orderIndex: 2,
          daysBeforeRenewal: 100,
          assignToRole: 'executive',
          actionType: 'meeting',
          isRequired: true,
        },
        {
          stepName: 'Address Pain Points',
          description: 'Create action plan to address identified issues',
          orderIndex: 3,
          daysBeforeRenewal: 90,
          assignToRole: 'csm',
          actionType: 'call',
          isRequired: true,
        },
        {
          stepName: 'Weekly Check-Ins',
          description: 'Establish weekly touchpoints with customer',
          orderIndex: 4,
          daysBeforeRenewal: 80,
          assignToRole: 'csm',
          actionType: 'call',
          isRequired: true,
        },
        {
          stepName: 'Custom Renewal Proposal',
          description: 'Prepare tailored proposal addressing customer concerns',
          orderIndex: 5,
          daysBeforeRenewal: 60,
          assignToRole: 'account_executive',
          actionType: 'send_proposal',
          isRequired: true,
        },
        {
          stepName: 'Executive Close Call',
          description: 'Final meeting with executive involvement if needed',
          orderIndex: 6,
          daysBeforeRenewal: 30,
          assignToRole: 'executive',
          actionType: 'meeting',
          isRequired: false,
        },
      ],
      isActive: true,
      isDefault: false,
    });

    await db.insert(renewalPlaybooks).values({
      tenantId,
      playbookName: 'Quick Touch Renewal (Under $5k)',
      description: 'Streamlined renewal process for smaller contracts',
      triggerConditions: {
        daysBeforeRenewal: 60,
        contractValueMax: 5000,
      },
      steps: [
        {
          stepName: 'Send Renewal Notice',
          description: 'Email automated renewal notice with current terms',
          orderIndex: 0,
          daysBeforeRenewal: 60,
          assignToRole: 'csm',
          actionType: 'email',
          isRequired: true,
        },
        {
          stepName: 'Follow-Up Call',
          description: 'Quick call to confirm renewal interest',
          orderIndex: 1,
          daysBeforeRenewal: 45,
          assignToRole: 'csm',
          actionType: 'call',
          isRequired: true,
        },
        {
          stepName: 'Send Contract',
          description: 'Send renewal contract for signature',
          orderIndex: 2,
          daysBeforeRenewal: 30,
          assignToRole: 'csm',
          actionType: 'send_proposal',
          isRequired: true,
        },
        {
          stepName: 'Final Reminder',
          description: 'Send reminder if not signed',
          orderIndex: 3,
          daysBeforeRenewal: 10,
          assignToRole: 'csm',
          actionType: 'email',
          isRequired: true,
        },
      ],
      isActive: true,
      isDefault: false,
    });

    console.log(`✅ Created 3 renewal playbooks`);

    // ==================== Seed Workflow Templates ====================
    console.log('⚙️ Seeding workflow templates...');

    await db.insert(workflowTemplates).values({
      name: 'Lead Speed-to-Response Automation',
      description:
        'Automatically assign and alert reps when new leads arrive for immediate follow-up',
      category: 'Sales',
      version: '1.0.0',
      complexity: 'simple',
      estimatedTimeSaved: 120,
      featured: true,
      definition: {
        triggers: [
          {
            type: 'event',
            eventName: 'lead_created',
          },
        ],
        steps: [
          {
            orderIndex: 0,
            name: 'Assign Lead to Territory',
            actionType: 'call_integration',
            config: {
              integration: 'lead_assignment_engine',
              assignImmediately: true,
            },
          },
          {
            orderIndex: 1,
            name: 'Send SMS Alert to Rep',
            actionType: 'sms',
            config: {
              to: '{{assignedRep.phone}}',
              message:
                'New lead assigned: {{lead.name}} from {{lead.company}}. Contact within 5 minutes!',
            },
          },
          {
            orderIndex: 2,
            name: 'Create Follow-Up Task',
            actionType: 'create_task',
            config: {
              taskName: 'First Contact: {{lead.name}}',
              assignTo: '{{assignedRep.id}}',
              dueInMinutes: 15,
              priority: 'high',
            },
          },
          {
            orderIndex: 3,
            name: 'Send Welcome Email to Lead',
            actionType: 'email',
            config: {
              to: '{{lead.email}}',
              template: 'lead_welcome',
              subject: 'Thanks for your interest in {{company.name}}',
            },
          },
        ],
      },
    });

    await db.insert(workflowTemplates).values({
      name: 'Contract Signed to Onboarding Handoff',
      description: 'Automatically initiate handoff checklist when contract is signed',
      category: 'Customer Management',
      version: '1.0.0',
      complexity: 'moderate',
      estimatedTimeSaved: 180,
      featured: true,
      definition: {
        triggers: [
          {
            type: 'event',
            eventName: 'contract_signed',
          },
        ],
        steps: [
          {
            orderIndex: 0,
            name: 'Create Handoff Checklist',
            actionType: 'call_integration',
            config: {
              integration: 'sales_handoff',
              action: 'create_checklist',
              handoffType: 'new_customer',
              useTemplate: true,
            },
          },
          {
            orderIndex: 1,
            name: 'Notify Implementation Team',
            actionType: 'email',
            config: {
              to: 'implementation@company.com',
              subject: 'New Customer Onboarding: {{customer.name}}',
              template: 'new_customer_handoff',
            },
          },
          {
            orderIndex: 2,
            name: 'Update CRM Stage',
            actionType: 'update_crm',
            config: {
              stage: 'onboarding',
              status: 'active_customer',
            },
          },
          {
            orderIndex: 3,
            name: 'Schedule Kickoff Call',
            actionType: 'schedule_appointment',
            config: {
              type: 'kickoff_call',
              durationMinutes: 60,
              daysOut: 3,
              attendees: ['sales_rep', 'csm', 'customer_contact'],
            },
          },
        ],
      },
    });

    await db.insert(workflowTemplates).values({
      name: 'Renewal Alert System',
      description: 'Automated alerts and playbook activation for upcoming contract renewals',
      category: 'Customer Success',
      version: '1.0.0',
      complexity: 'moderate',
      estimatedTimeSaved: 240,
      featured: true,
      definition: {
        triggers: [
          {
            type: 'schedule',
            cronExpression: '0 9 * * *', // Daily at 9 AM
          },
        ],
        steps: [
          {
            orderIndex: 0,
            name: 'Identify Renewals in Next 90 Days',
            actionType: 'database_update',
            config: {
              query: 'contracts_expiring_soon',
              daysAhead: 90,
            },
          },
          {
            orderIndex: 1,
            name: 'Calculate Renewal Risk',
            actionType: 'call_integration',
            config: {
              integration: 'renewal_management',
              action: 'calculate_risk',
            },
          },
          {
            orderIndex: 2,
            name: 'Assign Renewal Playbook',
            actionType: 'call_integration',
            config: {
              integration: 'renewal_management',
              action: 'assign_playbook',
              autoMatch: true,
            },
          },
          {
            orderIndex: 3,
            name: 'Send Alert to Account Owner',
            actionType: 'email',
            config: {
              to: '{{renewal.ownerId}}',
              subject: 'Renewal Alert: {{customer.name}} - {{renewal.daysUntilRenewal}} days',
              template: 'renewal_alert',
            },
          },
          {
            orderIndex: 4,
            name: 'Create Renewal Tasks',
            actionType: 'create_task',
            config: {
              createFromPlaybook: true,
              assignTo: '{{renewal.ownerId}}',
            },
          },
        ],
      },
    });

    console.log(`✅ Created 3 workflow templates`);

    console.log('✅ Sales workflow automation seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding sales workflow automation:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedSalesWorkflowAutomation()
    .then(() => {
      console.log('✅ Seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedSalesWorkflowAutomation };
