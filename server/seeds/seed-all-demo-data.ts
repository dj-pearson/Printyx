/**
 * MASTER DEMO DATA SEEDER
 *
 * Comprehensive script to seed sample data across ALL modules
 * for testing and demo purposes.
 *
 * Run with: npm run seed:demo
 *
 * Uses DEMO_USER from .env to find the existing demo user and their tenant.
 *
 * Execution order respects foreign key dependencies:
 * 1. Core Infrastructure (tenants, roles, users)
 * 2. Business Foundation (companies, contacts, locations)
 * 3. Products & Equipment
 * 4. Sales & CRM
 * 5. Service & Operations
 * 6. Finance & Billing
 * 7. Advanced Features
 */

import 'dotenv/config';
import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import {
  // Core
  tenants,
  roles,
  users,
  userSettings,
  locations,
  regions,
  teams,

  // Business Records
  companies,
  companyContacts,
  businessRecords,
  enhancedContacts,

  // Products
  productModels,
  productAccessories,
  enhancedProducts,
  professionalServices,
  serviceProducts,
  softwareProducts,
  supplies,
  managedServices,

  // Equipment
  equipment,
  equipmentPackages,

  // Sales & CRM
  opportunities,
  quotes,
  quoteLineItems,
  proposals,
  proposalLineItems,
  deals,
  dealStages,
  dealActivities,
  contracts,
  salesGoals,
  salesTeams,
  salesTeamMembers,

  // Service
  serviceContracts,
  serviceTickets,
  serviceCalls,
  technicians,
  technicianAvailability,
  meterReadings,

  // Inventory
  inventoryItems,
  purchaseOrders,
  purchaseOrderItems,
  vendors,

  // Finance
  invoices,
  invoiceLineItems,
  leases,
  leasePayments,
  accountsPayable,
  accountsReceivable,
  chartOfAccounts,

  // Tasks & Projects
  tasks,
  projects,

  // Activities
  businessRecordActivities,

  // Onboarding
  equipmentOnboardingChecklists,
  onboardingTasks,
} from '@shared/schema';

// Demo user configuration from environment
const DEMO_USER_EMAIL = process.env.DEMO_USER || 'DEMO@TEST.COM';

// These will be set dynamically based on the demo user lookup
let DEMO_TENANT_ID: string;
let DEMO_USER_ID: string;

// Utility for generating IDs
const generateId = (prefix: string, index: number) =>
  `${prefix}-demo-${String(index).padStart(3, '0')}`;

// Look up the demo user and get their tenant ID
async function initializeDemoUser(): Promise<boolean> {
  console.log(`\n🔍 Looking up demo user: ${DEMO_USER_EMAIL}`);

  const [demoUser] = await db
    .select()
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, DEMO_USER_EMAIL.toLowerCase()));

  if (!demoUser) {
    console.error(`❌ Demo user not found: ${DEMO_USER_EMAIL}`);
    console.error('   Make sure the user exists in the database.');
    console.error('   Check your .env file has DEMO_USER set correctly.');
    return false;
  }

  DEMO_USER_ID = demoUser.id;
  DEMO_TENANT_ID = demoUser.tenantId!;

  console.log(`✅ Found demo user: ${demoUser.name || demoUser.email}`);
  console.log(`   User ID: ${DEMO_USER_ID}`);
  console.log(`   Tenant ID: ${DEMO_TENANT_ID}`);

  return true;
}

// Check if demo data already exists for this tenant
async function demoDataExists(): Promise<boolean> {
  // Check if we already have demo companies for this tenant
  const [existingCompany] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.tenantId, DEMO_TENANT_ID), eq(companies.name, 'Acme Corporation')));
  return !!existingCompany;
}

// ============================================================================
// PHASE 1: CORE INFRASTRUCTURE
// ============================================================================

async function seedCoreInfrastructure() {
  console.log('\n📦 Phase 1: Seeding Core Infrastructure...');

  // Note: Using existing tenant from demo user - not creating a new one
  console.log(`  → Using existing tenant: ${DEMO_TENANT_ID}`);

  // Seed Locations
  console.log('  → Creating locations...');
  const locationData = [
    {
      id: generateId('loc', 1),
      name: 'Headquarters',
      address: '123 Main St, New York, NY 10001',
      type: 'headquarters',
    },
    {
      id: generateId('loc', 2),
      name: 'West Coast Office',
      address: '456 Tech Blvd, San Francisco, CA 94102',
      type: 'branch',
    },
    {
      id: generateId('loc', 3),
      name: 'Midwest Distribution',
      address: '789 Industrial Way, Chicago, IL 60601',
      type: 'warehouse',
    },
  ];

  for (const loc of locationData) {
    await db
      .insert(locations)
      .values({
        ...loc,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Regions
  console.log('  → Creating regions...');
  const regionData = [
    { id: generateId('reg', 1), name: 'East Coast', code: 'EAST' },
    { id: generateId('reg', 2), name: 'West Coast', code: 'WEST' },
    { id: generateId('reg', 3), name: 'Midwest', code: 'MID' },
  ];

  for (const reg of regionData) {
    await db
      .insert(regions)
      .values({
        ...reg,
        tenantId: DEMO_TENANT_ID,
      })
      .onConflictDoNothing();
  }

  // Seed Teams
  console.log('  → Creating teams...');
  const teamData = [
    { id: generateId('team', 1), name: 'Sales Team Alpha', type: 'sales' },
    { id: generateId('team', 2), name: 'Service Team Beta', type: 'service' },
    { id: generateId('team', 3), name: 'Support Team', type: 'support' },
  ];

  for (const team of teamData) {
    await db
      .insert(teams)
      .values({
        ...team,
        tenantId: DEMO_TENANT_ID,
      })
      .onConflictDoNothing();
  }

  // Using existing demo user from environment
  console.log(`  → Using existing demo user: ${DEMO_USER_EMAIL}`);

  // Create additional test users for the demo tenant
  console.log('  → Creating additional test users...');
  const additionalUsers = [
    {
      id: generateId('user', 2),
      email: `sales-demo@${DEMO_TENANT_ID}.test`,
      name: 'Sarah Sales',
      department: 'Sales',
    },
    {
      id: generateId('user', 3),
      email: `service-demo@${DEMO_TENANT_ID}.test`,
      name: 'Sam Service',
      department: 'Service',
    },
    {
      id: generateId('user', 4),
      email: `finance-demo@${DEMO_TENANT_ID}.test`,
      name: 'Frank Finance',
      department: 'Finance',
    },
  ];

  for (const user of additionalUsers) {
    await db
      .insert(users)
      .values({
        ...user,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  console.log('  ✅ Core Infrastructure seeded');
}

// ============================================================================
// PHASE 2: BUSINESS FOUNDATION
// ============================================================================

async function seedBusinessFoundation() {
  console.log('\n🏢 Phase 2: Seeding Business Foundation...');

  // Seed Companies
  console.log('  → Creating companies...');
  const companyData = [
    {
      id: generateId('comp', 1),
      name: 'Acme Corporation',
      industry: 'Manufacturing',
      website: 'https://acme.example.com',
      phone: '555-0101',
    },
    {
      id: generateId('comp', 2),
      name: 'TechStart Inc.',
      industry: 'Technology',
      website: 'https://techstart.example.com',
      phone: '555-0102',
    },
    {
      id: generateId('comp', 3),
      name: 'Global Finance LLC',
      industry: 'Finance',
      website: 'https://globalfin.example.com',
      phone: '555-0103',
    },
    {
      id: generateId('comp', 4),
      name: 'Healthcare Solutions',
      industry: 'Healthcare',
      website: 'https://healthsol.example.com',
      phone: '555-0104',
    },
    {
      id: generateId('comp', 5),
      name: 'Education Partners',
      industry: 'Education',
      website: 'https://edupartners.example.com',
      phone: '555-0105',
    },
  ];

  for (const company of companyData) {
    await db
      .insert(companies)
      .values({
        ...company,
        tenantId: DEMO_TENANT_ID,
        status: 'active',
        billingAddress: '123 Business St',
        billingCity: 'New York',
        billingState: 'NY',
        billingZip: '10001',
        billingCountry: 'USA',
      })
      .onConflictDoNothing();
  }

  // Seed Business Records (Leads & Customers)
  console.log('  → Creating business records (leads & customers)...');
  const businessRecordData = [
    // Customers
    {
      id: generateId('br', 1),
      recordType: 'customer',
      companyName: 'Acme Corporation',
      status: 'active',
      companyId: generateId('comp', 1),
    },
    {
      id: generateId('br', 2),
      recordType: 'customer',
      companyName: 'TechStart Inc.',
      status: 'active',
      companyId: generateId('comp', 2),
    },
    {
      id: generateId('br', 3),
      recordType: 'customer',
      companyName: 'Global Finance LLC',
      status: 'active',
      companyId: generateId('comp', 3),
    },
    // Leads
    {
      id: generateId('br', 4),
      recordType: 'lead',
      companyName: 'Prospect Corp',
      status: 'new',
      leadSource: 'website',
    },
    {
      id: generateId('br', 5),
      recordType: 'lead',
      companyName: 'Future Client Inc',
      status: 'qualified',
      leadSource: 'referral',
    },
    {
      id: generateId('br', 6),
      recordType: 'lead',
      companyName: 'Growing Business LLC',
      status: 'contacted',
      leadSource: 'trade_show',
    },
  ];

  for (const record of businessRecordData) {
    await db
      .insert(businessRecords)
      .values({
        ...record,
        tenantId: DEMO_TENANT_ID,
        assignedTo: DEMO_USER_ID,
      })
      .onConflictDoNothing();
  }

  // Seed Company Contacts
  console.log('  → Creating contacts...');
  const contactData = [
    {
      id: generateId('contact', 1),
      companyId: generateId('comp', 1),
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@acme.example.com',
      phone: '555-1001',
      title: 'CEO',
      isPrimary: true,
    },
    {
      id: generateId('contact', 2),
      companyId: generateId('comp', 1),
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@acme.example.com',
      phone: '555-1002',
      title: 'CFO',
      isPrimary: false,
    },
    {
      id: generateId('contact', 3),
      companyId: generateId('comp', 2),
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'mike@techstart.example.com',
      phone: '555-1003',
      title: 'IT Director',
      isPrimary: true,
    },
    {
      id: generateId('contact', 4),
      companyId: generateId('comp', 3),
      firstName: 'Lisa',
      lastName: 'Brown',
      email: 'lisa@globalfin.example.com',
      phone: '555-1004',
      title: 'Operations Manager',
      isPrimary: true,
    },
    {
      id: generateId('contact', 5),
      companyId: generateId('comp', 4),
      firstName: 'David',
      lastName: 'Wilson',
      email: 'david@healthsol.example.com',
      phone: '555-1005',
      title: 'Procurement',
      isPrimary: true,
    },
  ];

  for (const contact of contactData) {
    await db
      .insert(companyContacts)
      .values({
        ...contact,
        tenantId: DEMO_TENANT_ID,
        status: 'active',
      })
      .onConflictDoNothing();
  }

  console.log('  ✅ Business Foundation seeded');
}

// ============================================================================
// PHASE 3: PRODUCTS & EQUIPMENT
// ============================================================================

async function seedProductsAndEquipment() {
  console.log('\n📦 Phase 3: Seeding Products & Equipment...');

  // Seed Product Models
  console.log('  → Creating product models...');
  const productModelData = [
    {
      id: generateId('pm', 1),
      name: 'Canon imageRUNNER C3530i',
      manufacturer: 'Canon',
      category: 'mfp',
      msrp: '4500.00',
      monthlyLease: '125.00',
    },
    {
      id: generateId('pm', 2),
      name: 'Canon imageRUNNER ADVANCE DX C5860i',
      manufacturer: 'Canon',
      category: 'mfp',
      msrp: '12000.00',
      monthlyLease: '350.00',
    },
    {
      id: generateId('pm', 3),
      name: 'Ricoh IM C3500',
      manufacturer: 'Ricoh',
      category: 'mfp',
      msrp: '5200.00',
      monthlyLease: '145.00',
    },
    {
      id: generateId('pm', 4),
      name: 'HP LaserJet Enterprise M507',
      manufacturer: 'HP',
      category: 'printer',
      msrp: '850.00',
      monthlyLease: '35.00',
    },
    {
      id: generateId('pm', 5),
      name: 'Xerox VersaLink C7030',
      manufacturer: 'Xerox',
      category: 'mfp',
      msrp: '6800.00',
      monthlyLease: '195.00',
    },
  ];

  for (const model of productModelData) {
    await db
      .insert(productModels)
      .values({
        ...model,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Product Accessories
  console.log('  → Creating product accessories...');
  const accessoryData = [
    {
      id: generateId('acc', 1),
      accessoryName: 'Finisher SR4110',
      accessoryCode: 'FIN-SR4110',
      category: 'finisher',
      price: '1200.00',
    },
    {
      id: generateId('acc', 2),
      accessoryName: 'Paper Tray PB1130',
      accessoryCode: 'TRAY-PB1130',
      category: 'paper_handling',
      price: '350.00',
    },
    {
      id: generateId('acc', 3),
      accessoryName: 'Staple Cartridge',
      accessoryCode: 'STAPLE-001',
      category: 'supplies',
      price: '45.00',
    },
    {
      id: generateId('acc', 4),
      accessoryName: 'Cabinet Stand Type D',
      accessoryCode: 'CAB-TYPED',
      category: 'furniture',
      price: '280.00',
    },
  ];

  for (const acc of accessoryData) {
    await db
      .insert(productAccessories)
      .values({
        ...acc,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Equipment (deployed machines)
  console.log('  → Creating equipment...');
  const equipmentData = [
    {
      id: generateId('eq', 1),
      serialNumber: 'CAN-2024-001234',
      modelId: generateId('pm', 1),
      companyId: generateId('comp', 1),
      status: 'deployed',
      location: 'Main Office - 2nd Floor',
    },
    {
      id: generateId('eq', 2),
      serialNumber: 'CAN-2024-001235',
      modelId: generateId('pm', 2),
      companyId: generateId('comp', 1),
      status: 'deployed',
      location: 'Main Office - 3rd Floor',
    },
    {
      id: generateId('eq', 3),
      serialNumber: 'RIC-2024-005678',
      modelId: generateId('pm', 3),
      companyId: generateId('comp', 2),
      status: 'deployed',
      location: 'Server Room',
    },
    {
      id: generateId('eq', 4),
      serialNumber: 'HP-2024-009012',
      modelId: generateId('pm', 4),
      companyId: generateId('comp', 3),
      status: 'deployed',
      location: 'Reception',
    },
    {
      id: generateId('eq', 5),
      serialNumber: 'XER-2024-003456',
      modelId: generateId('pm', 5),
      companyId: generateId('comp', 4),
      status: 'in_inventory',
      location: 'Warehouse',
    },
  ];

  for (const eq of equipmentData) {
    await db
      .insert(equipment)
      .values({
        ...eq,
        tenantId: DEMO_TENANT_ID,
      })
      .onConflictDoNothing();
  }

  // Seed Service Products
  console.log('  → Creating service products...');
  await db
    .insert(serviceProducts)
    .values({
      id: generateId('sp', 1),
      tenantId: DEMO_TENANT_ID,
      name: 'Standard Maintenance Agreement',
      description: 'Includes all parts and labor for covered repairs',
      price: '150.00',
      billingFrequency: 'monthly',
      isActive: true,
    })
    .onConflictDoNothing();

  // Seed Professional Services
  console.log('  → Creating professional services...');
  await db
    .insert(professionalServices)
    .values({
      id: generateId('ps', 1),
      tenantId: DEMO_TENANT_ID,
      name: 'Network Setup & Configuration',
      description: 'Complete network integration and configuration',
      hourlyRate: '125.00',
      estimatedHours: 4,
      isActive: true,
    })
    .onConflictDoNothing();

  // Seed Software Products
  console.log('  → Creating software products...');
  await db
    .insert(softwareProducts)
    .values({
      id: generateId('sw', 1),
      tenantId: DEMO_TENANT_ID,
      name: 'Print Management Pro',
      description: 'Enterprise print management and tracking software',
      licenseType: 'subscription',
      monthlyPrice: '75.00',
      isActive: true,
    })
    .onConflictDoNothing();

  // Seed Supplies
  console.log('  → Creating supplies...');
  const supplyData = [
    {
      id: generateId('sup', 1),
      name: 'Black Toner - Canon C3530',
      sku: 'TNR-C3530-BK',
      price: '85.00',
      category: 'toner',
    },
    {
      id: generateId('sup', 2),
      name: 'Cyan Toner - Canon C3530',
      sku: 'TNR-C3530-C',
      price: '95.00',
      category: 'toner',
    },
    {
      id: generateId('sup', 3),
      name: 'Drum Unit - Canon C3530',
      sku: 'DRM-C3530',
      price: '220.00',
      category: 'drum',
    },
    {
      id: generateId('sup', 4),
      name: 'A4 Copy Paper (5000 sheets)',
      sku: 'PPR-A4-5K',
      price: '45.00',
      category: 'paper',
    },
  ];

  for (const supply of supplyData) {
    await db
      .insert(supplies)
      .values({
        ...supply,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  console.log('  ✅ Products & Equipment seeded');
}

// ============================================================================
// PHASE 4: SALES & CRM
// ============================================================================

async function seedSalesAndCRM() {
  console.log('\n💼 Phase 4: Seeding Sales & CRM...');

  // Seed Deal Stages
  console.log('  → Creating deal stages...');
  const stageData = [
    { id: generateId('stage', 1), name: 'Discovery', order: 1, probability: 10, color: '#3B82F6' },
    {
      id: generateId('stage', 2),
      name: 'Qualification',
      order: 2,
      probability: 25,
      color: '#8B5CF6',
    },
    { id: generateId('stage', 3), name: 'Proposal', order: 3, probability: 50, color: '#F59E0B' },
    {
      id: generateId('stage', 4),
      name: 'Negotiation',
      order: 4,
      probability: 75,
      color: '#EF4444',
    },
    {
      id: generateId('stage', 5),
      name: 'Closed Won',
      order: 5,
      probability: 100,
      color: '#22C55E',
    },
    { id: generateId('stage', 6), name: 'Closed Lost', order: 6, probability: 0, color: '#6B7280' },
  ];

  for (const stage of stageData) {
    await db
      .insert(dealStages)
      .values({
        ...stage,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Opportunities
  console.log('  → Creating opportunities...');
  const opportunityData = [
    {
      id: generateId('opp', 1),
      name: 'Acme Fleet Upgrade',
      companyId: generateId('comp', 1),
      value: '45000.00',
      stage: 'proposal',
      probability: 50,
    },
    {
      id: generateId('opp', 2),
      name: 'TechStart New Office Setup',
      companyId: generateId('comp', 2),
      value: '28000.00',
      stage: 'qualification',
      probability: 25,
    },
    {
      id: generateId('opp', 3),
      name: 'Global Finance Expansion',
      companyId: generateId('comp', 3),
      value: '85000.00',
      stage: 'negotiation',
      probability: 75,
    },
    {
      id: generateId('opp', 4),
      name: 'Healthcare Solutions MFP Replacement',
      companyId: generateId('comp', 4),
      value: '32000.00',
      stage: 'discovery',
      probability: 10,
    },
  ];

  for (const opp of opportunityData) {
    await db
      .insert(opportunities)
      .values({
        ...opp,
        tenantId: DEMO_TENANT_ID,
        ownerId: DEMO_USER_ID,
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Deals
  console.log('  → Creating deals...');
  const dealData = [
    {
      id: generateId('deal', 1),
      title: 'Acme 5-Year Service Agreement',
      companyId: generateId('comp', 1),
      stageId: generateId('stage', 3),
      value: '45000.00',
    },
    {
      id: generateId('deal', 2),
      title: 'TechStart Equipment Lease',
      companyId: generateId('comp', 2),
      stageId: generateId('stage', 2),
      value: '28000.00',
    },
    {
      id: generateId('deal', 3),
      title: 'Global Finance Print Fleet',
      companyId: generateId('comp', 3),
      stageId: generateId('stage', 4),
      value: '85000.00',
    },
  ];

  for (const deal of dealData) {
    await db
      .insert(deals)
      .values({
        ...deal,
        tenantId: DEMO_TENANT_ID,
        ownerId: DEMO_USER_ID,
        priority: 'high',
        expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Quotes
  console.log('  → Creating quotes...');
  const quoteData = [
    {
      id: generateId('quote', 1),
      quoteNumber: 'Q-2024-001',
      companyId: generateId('comp', 1),
      status: 'sent',
      subtotal: '15000.00',
      total: '16125.00',
    },
    {
      id: generateId('quote', 2),
      quoteNumber: 'Q-2024-002',
      companyId: generateId('comp', 2),
      status: 'draft',
      subtotal: '8500.00',
      total: '9137.50',
    },
    {
      id: generateId('quote', 3),
      quoteNumber: 'Q-2024-003',
      companyId: generateId('comp', 3),
      status: 'accepted',
      subtotal: '42000.00',
      total: '45150.00',
    },
  ];

  for (const quote of quoteData) {
    await db
      .insert(quotes)
      .values({
        ...quote,
        tenantId: DEMO_TENANT_ID,
        createdBy: DEMO_USER_ID,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Proposals
  console.log('  → Creating proposals...');
  await db
    .insert(proposals)
    .values({
      id: generateId('prop', 1),
      tenantId: DEMO_TENANT_ID,
      title: 'Acme Corporation - Managed Print Services Proposal',
      companyId: generateId('comp', 1),
      contactId: generateId('contact', 1),
      status: 'sent',
      totalValue: '45000.00',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: DEMO_USER_ID,
    })
    .onConflictDoNothing();

  // Seed Contracts
  console.log('  → Creating contracts...');
  const contractData = [
    {
      id: generateId('contract', 1),
      contractNumber: 'CTR-2024-001',
      companyId: generateId('comp', 1),
      type: 'service',
      status: 'active',
      monthlyAmount: '2500.00',
    },
    {
      id: generateId('contract', 2),
      contractNumber: 'CTR-2024-002',
      companyId: generateId('comp', 2),
      type: 'lease',
      status: 'active',
      monthlyAmount: '1800.00',
    },
    {
      id: generateId('contract', 3),
      contractNumber: 'CTR-2024-003',
      companyId: generateId('comp', 3),
      type: 'maintenance',
      status: 'pending',
      monthlyAmount: '3200.00',
    },
  ];

  for (const contract of contractData) {
    await db
      .insert(contracts)
      .values({
        ...contract,
        tenantId: DEMO_TENANT_ID,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Sales Goals
  console.log('  → Creating sales goals...');
  await db
    .insert(salesGoals)
    .values({
      id: generateId('goal', 1),
      tenantId: DEMO_TENANT_ID,
      userId: DEMO_USER_ID,
      name: 'Q1 2024 Revenue Target',
      targetAmount: '250000.00',
      currentAmount: '145000.00',
      period: 'quarterly',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    })
    .onConflictDoNothing();

  console.log('  ✅ Sales & CRM seeded');
}

// ============================================================================
// PHASE 5: SERVICE & OPERATIONS
// ============================================================================

async function seedServiceAndOperations() {
  console.log('\n🔧 Phase 5: Seeding Service & Operations...');

  // Seed Technicians
  console.log('  → Creating technicians...');
  const technicianData = [
    {
      id: generateId('tech', 1),
      userId: generateId('user', 3),
      firstName: 'Mike',
      lastName: 'Turner',
      email: 'mike.turner@printyx.net',
      phone: '555-2001',
      specializations: ['Canon', 'Ricoh'],
    },
    {
      id: generateId('tech', 2),
      firstName: 'Lisa',
      lastName: 'Chen',
      email: 'lisa.chen@printyx.net',
      phone: '555-2002',
      specializations: ['HP', 'Xerox'],
    },
    {
      id: generateId('tech', 3),
      firstName: 'James',
      lastName: 'Wilson',
      email: 'james.wilson@printyx.net',
      phone: '555-2003',
      specializations: ['Canon', 'Xerox', 'Ricoh'],
    },
  ];

  for (const tech of technicianData) {
    await db
      .insert(technicians)
      .values({
        ...tech,
        tenantId: DEMO_TENANT_ID,
        status: 'active',
        hireDate: new Date('2023-01-15'),
      })
      .onConflictDoNothing();
  }

  // Seed Service Contracts
  console.log('  → Creating service contracts...');
  const serviceContractData = [
    {
      id: generateId('sc', 1),
      contractNumber: 'SVC-2024-001',
      companyId: generateId('comp', 1),
      equipmentId: generateId('eq', 1),
      type: 'full_service',
      monthlyRate: '250.00',
      bwAllowance: 10000,
      colorAllowance: 2000,
    },
    {
      id: generateId('sc', 2),
      contractNumber: 'SVC-2024-002',
      companyId: generateId('comp', 2),
      equipmentId: generateId('eq', 3),
      type: 'maintenance',
      monthlyRate: '150.00',
      bwAllowance: 5000,
      colorAllowance: 1000,
    },
  ];

  for (const sc of serviceContractData) {
    await db
      .insert(serviceContracts)
      .values({
        ...sc,
        tenantId: DEMO_TENANT_ID,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Service Tickets
  console.log('  → Creating service tickets...');
  const ticketData = [
    {
      id: generateId('ticket', 1),
      ticketNumber: 'TKT-2024-0001',
      companyId: generateId('comp', 1),
      equipmentId: generateId('eq', 1),
      subject: 'Paper jam in tray 2',
      priority: 'medium',
      status: 'open',
    },
    {
      id: generateId('ticket', 2),
      ticketNumber: 'TKT-2024-0002',
      companyId: generateId('comp', 2),
      equipmentId: generateId('eq', 3),
      subject: 'Error code E002 displayed',
      priority: 'high',
      status: 'in_progress',
    },
    {
      id: generateId('ticket', 3),
      ticketNumber: 'TKT-2024-0003',
      companyId: generateId('comp', 1),
      equipmentId: generateId('eq', 2),
      subject: 'Preventive maintenance due',
      priority: 'low',
      status: 'scheduled',
    },
    {
      id: generateId('ticket', 4),
      ticketNumber: 'TKT-2024-0004',
      companyId: generateId('comp', 3),
      equipmentId: generateId('eq', 4),
      subject: 'Print quality issues',
      priority: 'medium',
      status: 'resolved',
    },
  ];

  for (const ticket of ticketData) {
    await db
      .insert(serviceTickets)
      .values({
        ...ticket,
        tenantId: DEMO_TENANT_ID,
        reportedBy: 'Customer',
        assignedTechnicianId: generateId('tech', 1),
      })
      .onConflictDoNothing();
  }

  // Seed Meter Readings
  console.log('  → Creating meter readings...');
  const meterData = [
    {
      id: generateId('meter', 1),
      equipmentId: generateId('eq', 1),
      bwCount: 45230,
      colorCount: 8450,
      readingDate: new Date(),
    },
    {
      id: generateId('meter', 2),
      equipmentId: generateId('eq', 2),
      bwCount: 128500,
      colorCount: 32100,
      readingDate: new Date(),
    },
    {
      id: generateId('meter', 3),
      equipmentId: generateId('eq', 3),
      bwCount: 67800,
      colorCount: 15200,
      readingDate: new Date(),
    },
    {
      id: generateId('meter', 4),
      equipmentId: generateId('eq', 4),
      bwCount: 23400,
      colorCount: 0,
      readingDate: new Date(),
    },
  ];

  for (const meter of meterData) {
    await db
      .insert(meterReadings)
      .values({
        ...meter,
        tenantId: DEMO_TENANT_ID,
        source: 'manual',
      })
      .onConflictDoNothing();
  }

  // Seed Service Calls
  console.log('  → Creating service calls...');
  await db
    .insert(serviceCalls)
    .values({
      id: generateId('call', 1),
      tenantId: DEMO_TENANT_ID,
      ticketId: generateId('ticket', 1),
      technicianId: generateId('tech', 1),
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'scheduled',
      estimatedDuration: 60,
    })
    .onConflictDoNothing();

  console.log('  ✅ Service & Operations seeded');
}

// ============================================================================
// PHASE 6: FINANCE & BILLING
// ============================================================================

async function seedFinanceAndBilling() {
  console.log('\n💰 Phase 6: Seeding Finance & Billing...');

  // Seed Vendors
  console.log('  → Creating vendors...');
  const vendorData = [
    {
      id: generateId('vendor', 1),
      name: 'Canon USA',
      contactName: 'Account Manager',
      email: 'orders@canon.example.com',
      phone: '800-555-0001',
      type: 'manufacturer',
    },
    {
      id: generateId('vendor', 2),
      name: 'Office Supplies Direct',
      contactName: 'Sales Team',
      email: 'sales@osd.example.com',
      phone: '800-555-0002',
      type: 'distributor',
    },
    {
      id: generateId('vendor', 3),
      name: 'Tech Parts Wholesale',
      contactName: 'Parts Dept',
      email: 'parts@tpw.example.com',
      phone: '800-555-0003',
      type: 'parts',
    },
  ];

  for (const vendor of vendorData) {
    await db
      .insert(vendors)
      .values({
        ...vendor,
        tenantId: DEMO_TENANT_ID,
        status: 'active',
        paymentTerms: 'net30',
      })
      .onConflictDoNothing();
  }

  // Seed Invoices
  console.log('  → Creating invoices...');
  const invoiceData = [
    {
      id: generateId('inv', 1),
      invoiceNumber: 'INV-2024-0001',
      companyId: generateId('comp', 1),
      status: 'paid',
      subtotal: '2500.00',
      tax: '212.50',
      total: '2712.50',
    },
    {
      id: generateId('inv', 2),
      invoiceNumber: 'INV-2024-0002',
      companyId: generateId('comp', 2),
      status: 'sent',
      subtotal: '1800.00',
      tax: '153.00',
      total: '1953.00',
    },
    {
      id: generateId('inv', 3),
      invoiceNumber: 'INV-2024-0003',
      companyId: generateId('comp', 3),
      status: 'overdue',
      subtotal: '3200.00',
      tax: '272.00',
      total: '3472.00',
    },
    {
      id: generateId('inv', 4),
      invoiceNumber: 'INV-2024-0004',
      companyId: generateId('comp', 1),
      status: 'draft',
      subtotal: '4500.00',
      tax: '382.50',
      total: '4882.50',
    },
  ];

  for (const invoice of invoiceData) {
    await db
      .insert(invoices)
      .values({
        ...invoice,
        tenantId: DEMO_TENANT_ID,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Leases
  console.log('  → Creating leases...');
  const leaseData = [
    {
      id: generateId('lease', 1),
      leaseNumber: 'LS-2024-001',
      customerId: generateId('br', 1),
      equipmentId: generateId('eq', 1),
      term: 36,
      monthlyPayment: '450.00',
      totalAmount: '16200.00',
      status: 'active',
      leaseType: 'fmv',
    },
    {
      id: generateId('lease', 2),
      leaseNumber: 'LS-2024-002',
      customerId: generateId('br', 2),
      equipmentId: generateId('eq', 3),
      term: 60,
      monthlyPayment: '289.00',
      totalAmount: '17340.00',
      status: 'active',
      leaseType: 'dollar_buyout',
    },
  ];

  for (const lease of leaseData) {
    await db
      .insert(leases)
      .values({
        ...lease,
        tenantId: DEMO_TENANT_ID,
        leaseName: `Lease for ${lease.leaseNumber}`,
        startDate: new Date(),
        endDate: new Date(Date.now() + lease.term * 30 * 24 * 60 * 60 * 1000),
        paymentFrequency: 'monthly',
        paymentsCompleted: 6,
        totalPaid: String(parseFloat(lease.monthlyPayment) * 6),
      })
      .onConflictDoNothing();
  }

  // Seed Chart of Accounts
  console.log('  → Creating chart of accounts...');
  const accountData = [
    {
      id: generateId('coa', 1),
      accountNumber: '1000',
      accountName: 'Cash',
      accountType: 'asset',
      normalBalance: 'debit',
    },
    {
      id: generateId('coa', 2),
      accountNumber: '1200',
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      normalBalance: 'debit',
    },
    {
      id: generateId('coa', 3),
      accountNumber: '2000',
      accountName: 'Accounts Payable',
      accountType: 'liability',
      normalBalance: 'credit',
    },
    {
      id: generateId('coa', 4),
      accountNumber: '3000',
      accountName: 'Retained Earnings',
      accountType: 'equity',
      normalBalance: 'credit',
    },
    {
      id: generateId('coa', 5),
      accountNumber: '4000',
      accountName: 'Service Revenue',
      accountType: 'revenue',
      normalBalance: 'credit',
    },
    {
      id: generateId('coa', 6),
      accountNumber: '5000',
      accountName: 'Cost of Goods Sold',
      accountType: 'expense',
      normalBalance: 'debit',
    },
  ];

  for (const account of accountData) {
    await db
      .insert(chartOfAccounts)
      .values({
        ...account,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Purchase Orders
  console.log('  → Creating purchase orders...');
  const poData = [
    {
      id: generateId('po', 1),
      poNumber: 'PO-2024-001',
      vendorId: generateId('vendor', 1),
      status: 'received',
      subtotal: '12500.00',
      total: '12500.00',
    },
    {
      id: generateId('po', 2),
      poNumber: 'PO-2024-002',
      vendorId: generateId('vendor', 2),
      status: 'ordered',
      subtotal: '850.00',
      total: '850.00',
    },
    {
      id: generateId('po', 3),
      poNumber: 'PO-2024-003',
      vendorId: generateId('vendor', 3),
      status: 'draft',
      subtotal: '2200.00',
      total: '2200.00',
    },
  ];

  for (const po of poData) {
    await db
      .insert(purchaseOrders)
      .values({
        ...po,
        tenantId: DEMO_TENANT_ID,
        orderDate: new Date(),
        expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: DEMO_USER_ID,
      })
      .onConflictDoNothing();
  }

  // Seed Inventory Items
  console.log('  → Creating inventory items...');
  const inventoryData = [
    {
      id: generateId('inv-item', 1),
      sku: 'TNR-C3530-BK',
      name: 'Black Toner - Canon C3530',
      category: 'toner',
      quantityOnHand: 25,
      reorderPoint: 10,
      unitCost: '65.00',
    },
    {
      id: generateId('inv-item', 2),
      sku: 'TNR-C3530-C',
      name: 'Cyan Toner - Canon C3530',
      category: 'toner',
      quantityOnHand: 18,
      reorderPoint: 8,
      unitCost: '75.00',
    },
    {
      id: generateId('inv-item', 3),
      sku: 'DRM-C3530',
      name: 'Drum Unit - Canon C3530',
      category: 'drum',
      quantityOnHand: 5,
      reorderPoint: 3,
      unitCost: '180.00',
    },
    {
      id: generateId('inv-item', 4),
      sku: 'FUSER-C3530',
      name: 'Fuser Unit - Canon C3530',
      category: 'parts',
      quantityOnHand: 3,
      reorderPoint: 2,
      unitCost: '320.00',
    },
  ];

  for (const item of inventoryData) {
    await db
      .insert(inventoryItems)
      .values({
        ...item,
        tenantId: DEMO_TENANT_ID,
        locationId: generateId('loc', 3),
      })
      .onConflictDoNothing();
  }

  console.log('  ✅ Finance & Billing seeded');
}

// ============================================================================
// PHASE 7: TASKS & ACTIVITIES
// ============================================================================

async function seedTasksAndActivities() {
  console.log('\n📋 Phase 7: Seeding Tasks & Activities...');

  // Seed Tasks
  console.log('  → Creating tasks...');
  const taskData = [
    {
      id: generateId('task', 1),
      title: 'Follow up with Acme on proposal',
      description: 'Call John Smith to discuss the service agreement',
      priority: 'high',
      status: 'pending',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: generateId('task', 2),
      title: 'Prepare quarterly report',
      description: 'Compile Q1 sales and service metrics',
      priority: 'medium',
      status: 'in_progress',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: generateId('task', 3),
      title: 'Schedule preventive maintenance',
      description: 'Contact Healthcare Solutions for PM scheduling',
      priority: 'low',
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: generateId('task', 4),
      title: 'Review new equipment requests',
      description: 'Process pending equipment orders',
      priority: 'medium',
      status: 'completed',
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const task of taskData) {
    await db
      .insert(tasks)
      .values({
        ...task,
        tenantId: DEMO_TENANT_ID,
        assignedTo: DEMO_USER_ID,
        createdBy: DEMO_USER_ID,
      })
      .onConflictDoNothing();
  }

  // Seed Projects
  console.log('  → Creating projects...');
  await db
    .insert(projects)
    .values({
      id: generateId('project', 1),
      tenantId: DEMO_TENANT_ID,
      name: 'Acme Fleet Modernization',
      description: 'Complete equipment upgrade for Acme Corporation',
      status: 'active',
      startDate: new Date(),
      targetEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      ownerId: DEMO_USER_ID,
    })
    .onConflictDoNothing();

  // Seed Business Record Activities
  console.log('  → Creating activities...');
  const activityData = [
    {
      id: generateId('activity', 1),
      businessRecordId: generateId('br', 1),
      type: 'call',
      subject: 'Quarterly review call',
      notes: 'Discussed service satisfaction and upcoming needs',
    },
    {
      id: generateId('activity', 2),
      businessRecordId: generateId('br', 1),
      type: 'email',
      subject: 'Sent proposal PDF',
      notes: 'Emailed updated proposal with new pricing',
    },
    {
      id: generateId('activity', 3),
      businessRecordId: generateId('br', 4),
      type: 'meeting',
      subject: 'Initial discovery meeting',
      notes: 'Met with prospect to understand their print environment',
    },
    {
      id: generateId('activity', 4),
      businessRecordId: generateId('br', 5),
      type: 'note',
      subject: 'Qualification notes',
      notes: 'Budget confirmed, decision timeline is Q2',
    },
  ];

  for (const activity of activityData) {
    await db
      .insert(businessRecordActivities)
      .values({
        ...activity,
        tenantId: DEMO_TENANT_ID,
        createdBy: DEMO_USER_ID,
      })
      .onConflictDoNothing();
  }

  console.log('  ✅ Tasks & Activities seeded');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function seedAllDemoData() {
  console.log('🚀 Starting Demo Data Seeder...\n');
  console.log('='.repeat(60));

  try {
    // First, look up the demo user from environment
    const userFound = await initializeDemoUser();
    if (!userFound) {
      console.error('\n❌ Cannot proceed without a valid demo user.');
      process.exit(1);
    }

    // Check if demo data already exists for this tenant
    const forceFlag = process.argv.includes('--force');
    if ((await demoDataExists()) && !forceFlag) {
      console.log(
        '\n⚠️  Demo data already exists for this tenant. Skipping to prevent duplicates.',
      );
      console.log('   To re-seed, run with --force flag: npm run seed:demo -- --force\n');
      process.exit(0);
    }

    if (forceFlag) {
      console.log('\n⚡ Force flag detected - proceeding with seeding...');
    }

    // Execute phases in order
    await seedCoreInfrastructure();
    await seedBusinessFoundation();
    await seedProductsAndEquipment();
    await seedSalesAndCRM();
    await seedServiceAndOperations();
    await seedFinanceAndBilling();
    await seedTasksAndActivities();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Demo data seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • Using existing tenant: ${DEMO_TENANT_ID}`);
    console.log('   • 3 Locations, 3 Regions, 3 Teams');
    console.log('   • 3 Additional test users');
    console.log('   • 5 Companies, 6 Business Records, 5 Contacts');
    console.log('   • 5 Product Models, 4 Accessories, 5 Equipment');
    console.log('   • 6 Deal Stages, 4 Opportunities, 3 Deals');
    console.log('   • 3 Quotes, 1 Proposal, 3 Contracts');
    console.log('   • 3 Technicians, 2 Service Contracts, 4 Service Tickets');
    console.log('   • 3 Vendors, 4 Invoices, 2 Leases');
    console.log('   • 6 Chart of Accounts, 3 Purchase Orders');
    console.log('   • 4 Inventory Items, 4 Meter Readings');
    console.log('   • 4 Tasks, 1 Project, 4 Activities');
    console.log('\n🔐 Demo User:');
    console.log(`   Email: ${DEMO_USER_EMAIL}`);
    console.log(`   Tenant ID: ${DEMO_TENANT_ID}\n`);
  } catch (error) {
    console.error('\n❌ Error seeding demo data:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run if executed directly
seedAllDemoData();
