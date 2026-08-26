/**
 * Demo data set, shared by the CLI seeder and the admin seed endpoint.
 *
 * This lived twice — once in server/seeds/seed-all-demo-data.ts and once inline in
 * server/routes/admin-seed-routes.ts — as two byte-identical copies of 1,300 lines.
 * They carried the same defects because they were copied, and fixing one left the
 * other broken. There is one copy now; both callers import it.
 *
 * Every insert here is bound to the REAL Drizzle columns. That matters more than it
 * looks: drizzle's `.values()` walks the TABLE's columns and picks each one out of
 * the object, so a key the table does not have is DROPPED without a word — the row
 * inserts, just empty, or it dies on a NOT NULL the dropped key was meant to fill.
 * Spreading a data row into `.values({ ...row, tenantId })` also turns off tsc's
 * excess-property check for everything the spread carries, so the compiler cannot
 * see it either. `npm run check:spread-insert-keys` is what watches this now.
 */
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';

import {
  users,
  locations,
  regions,
  teams,
  companies,
  companyContacts,
  businessRecords,
  productModels,
  productAccessories,
  professionalServices,
  serviceProducts,
  softwareProducts,
  supplies,
  equipment,
  opportunities,
  quotes,
  proposals,
  deals,
  dealStages,
  contracts,
  salesGoals,
  serviceContracts,
  serviceTickets,
  serviceCalls,
  technicians,
  meterReadings,
  inventoryItems,
  purchaseOrders,
  vendors,
  invoices,
  leases,
  chartOfAccounts,
  tasks,
  projects,
  businessRecordActivities,
} from '../../shared/schema';
import { pipelineStages, pipelineTemplates } from '../../shared/pipeline-configuration-schema';

const log = createModuleLogger('demo-data');

export type DemoSeedContext = { tenantId: string; userId: string };
export type DemoSeedCounts = Record<string, number>;

/** Stable ids so re-seeding the same tenant is idempotent. */
export const generateId = (prefix: string, index: number) =>
  `${prefix}-demo-${String(index).padStart(3, '0')}`;

/** True when this tenant already carries the demo set. */
export async function demoDataExists(tenantId: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), eq(companies.businessName, 'Acme Corporation')));
  return !!existing;
}

// ============================================================================
// PHASE 1: CORE INFRASTRUCTURE
// ============================================================================

async function seedCoreInfrastructure(ctx: DemoSeedContext, results: DemoSeedCounts) {
  log.info('\n📦 Phase 1: Seeding Core Infrastructure...');

  // Note: Using existing tenant from demo user - not creating a new one
  log.info(`  → Using existing tenant: ${ctx.tenantId}`);

  // Seed Locations
  log.info('  → Creating locations...');
  // `code` is NOT NULL on locations and was missing; `type` is not a column at all
  // (the real one is `location_type`). So this seed could never insert a location.
  // The code values follow the column's own documented convention ("DT", "NORTH").
  const locationData = [
    {
      id: generateId('loc', 1),
      name: 'Headquarters',
      code: 'HQ',
      address: '123 Main St, New York, NY 10001',
      locationType: 'headquarters',
      isHeadquarters: true,
    },
    {
      id: generateId('loc', 2),
      name: 'West Coast Office',
      code: 'WEST',
      address: '456 Tech Blvd, San Francisco, CA 94102',
      locationType: 'branch',
    },
    {
      id: generateId('loc', 3),
      name: 'Midwest Distribution',
      code: 'MIDW',
      address: '789 Industrial Way, Chicago, IL 60601',
      locationType: 'warehouse',
    },
  ];

  for (const loc of locationData) {
    await db
      .insert(locations)
      .values({
        ...loc,
        tenantId: ctx.tenantId,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Regions
  log.info('  → Creating regions...');
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
        tenantId: ctx.tenantId,
      })
      .onConflictDoNothing();
  }

  // Seed Teams
  log.info('  → Creating teams...');
  // `department` is NOT NULL on teams; `type` is not a column. Renamed onto the real
  // column rather than re-inventing the values. NOTE: 'support' is outside the
  // column's documented vocabulary (sales, service, admin, finance, purchasing) —
  // the column is a plain varchar with no CHECK, so it inserts, but it is flagged
  // here rather than silently rewritten to 'service'.
  const teamData = [
    { id: generateId('team', 1), name: 'Sales Team Alpha', department: 'sales' },
    { id: generateId('team', 2), name: 'Service Team Beta', department: 'service' },
    { id: generateId('team', 3), name: 'Support Team', department: 'support' },
  ];

  for (const team of teamData) {
    await db
      .insert(teams)
      .values({
        ...team,
        tenantId: ctx.tenantId,
      })
      .onConflictDoNothing();
  }

  // Create additional test users for the demo tenant
  log.info('  → Creating additional test users...');
  // `users` has first_name/last_name and no `name` or `department` column; both were
  // being dropped on the floor by drizzle, leaving every demo user nameless.
  const additionalUsers = [
    {
      id: generateId('user', 2),
      email: `sales-demo@${ctx.tenantId}.test`,
      firstName: 'Sarah',
      lastName: 'Sales',
      role: 'sales',
    },
    {
      id: generateId('user', 3),
      email: `service-demo@${ctx.tenantId}.test`,
      firstName: 'Sam',
      lastName: 'Service',
      role: 'service',
    },
    {
      id: generateId('user', 4),
      email: `finance-demo@${ctx.tenantId}.test`,
      firstName: 'Frank',
      lastName: 'Finance',
      role: 'finance',
    },
    {
      id: generateId('user', 5),
      email: `tech-demo@${ctx.tenantId}.test`,
      firstName: 'Tess',
      lastName: 'Technician',
      role: 'service',
    },
  ];

  for (const user of additionalUsers) {
    await db
      .insert(users)
      .values({
        ...user,
        tenantId: ctx.tenantId,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  Object.assign(results, {
    locations: locationData.length,
    regions: regionData.length,
    teams: teamData.length,
    users: additionalUsers.length,
  });

  log.info('  ✅ Core Infrastructure seeded');
}

// ============================================================================
// PHASE 2: BUSINESS FOUNDATION
// ============================================================================

async function seedBusinessFoundation(ctx: DemoSeedContext, results: DemoSeedCounts) {
  log.info('\n🏢 Phase 2: Seeding Business Foundation...');

  // Seed Companies
  log.info('  → Creating companies...');
  const companyData = [
    {
      id: generateId('comp', 1),
      businessName: 'Acme Corporation',
      industry: 'Manufacturing',
      website: 'https://acme.example.com',
      phone: '555-0101',
    },
    {
      id: generateId('comp', 2),
      businessName: 'TechStart Inc.',
      industry: 'Technology',
      website: 'https://techstart.example.com',
      phone: '555-0102',
    },
    {
      id: generateId('comp', 3),
      businessName: 'Global Finance LLC',
      industry: 'Finance',
      website: 'https://globalfin.example.com',
      phone: '555-0103',
    },
    {
      id: generateId('comp', 4),
      businessName: 'Healthcare Solutions',
      industry: 'Healthcare',
      website: 'https://healthsol.example.com',
      phone: '555-0104',
    },
    {
      id: generateId('comp', 5),
      businessName: 'Education Partners',
      industry: 'Education',
      website: 'https://edupartners.example.com',
      phone: '555-0105',
    },
  ];

  for (const company of companyData) {
    await db
      .insert(companies)
      .values({
        // `companies` has no status or billing_country column.
        ...company,
        tenantId: ctx.tenantId,
        billingAddress: '123 Business St',
        billingCity: 'New York',
        billingState: 'NY',
        billingZip: '10001',
      })
      .onConflictDoNothing();
  }

  // Seed Business Records (Leads & Customers)
  log.info('  → Creating business records (leads & customers)...');
  // business_records is the canonical account table (docs/crm-canonical-model.md), so it
  // carries the company name itself and has no companyId FK back to the legacy `companies`
  // table. It also has no `assignedTo` — the owner column is ownerId — and created_by is
  // NOT NULL. Records 7 and 8 exist so every seeded company has a customer record, which
  // is what equipment.customer_id points at.
  const businessRecordData = [
    // Customers
    {
      id: generateId('br', 1),
      recordType: 'customer',
      companyName: 'Acme Corporation',
      status: 'active',
    },
    {
      id: generateId('br', 2),
      recordType: 'customer',
      companyName: 'TechStart Inc.',
      status: 'active',
    },
    {
      id: generateId('br', 3),
      recordType: 'customer',
      companyName: 'Global Finance LLC',
      status: 'active',
    },
    {
      id: generateId('br', 7),
      recordType: 'customer',
      companyName: 'Healthcare Solutions',
      status: 'active',
    },
    {
      id: generateId('br', 8),
      recordType: 'customer',
      companyName: 'Education Partners',
      status: 'active',
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
        tenantId: ctx.tenantId,
        ownerId: ctx.userId,
        createdBy: ctx.userId,
      })
      .onConflictDoNothing();
  }

  // Seed Company Contacts
  log.info('  → Creating contacts...');
  const contactData = [
    {
      id: generateId('contact', 1),
      companyId: generateId('comp', 1),
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@acme.example.com',
      phone: '555-1001',
      title: 'CEO',
      isPrimaryContact: true,
    },
    {
      id: generateId('contact', 2),
      companyId: generateId('comp', 1),
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@acme.example.com',
      phone: '555-1002',
      title: 'CFO',
      isPrimaryContact: false,
    },
    {
      id: generateId('contact', 3),
      companyId: generateId('comp', 2),
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'mike@techstart.example.com',
      phone: '555-1003',
      title: 'IT Director',
      isPrimaryContact: true,
    },
    {
      id: generateId('contact', 4),
      companyId: generateId('comp', 3),
      firstName: 'Lisa',
      lastName: 'Brown',
      email: 'lisa@globalfin.example.com',
      phone: '555-1004',
      title: 'Operations Manager',
      isPrimaryContact: true,
    },
    {
      id: generateId('contact', 5),
      companyId: generateId('comp', 4),
      firstName: 'David',
      lastName: 'Wilson',
      email: 'david@healthsol.example.com',
      phone: '555-1005',
      title: 'Procurement',
      isPrimaryContact: true,
    },
  ];

  for (const contact of contactData) {
    await db
      .insert(companyContacts)
      .values({
        // company_contacts has leadStatus, not a plain `status` column.
        ...contact,
        tenantId: ctx.tenantId,
      })
      .onConflictDoNothing();
  }

  Object.assign(results, {
    companies: companyData.length,
    businessRecords: businessRecordData.length,
    contacts: contactData.length,
  });

  log.info('  ✅ Business Foundation seeded');
}

// ============================================================================
// PHASE 3: PRODUCTS & EQUIPMENT
// ============================================================================

async function seedProductsAndEquipment(ctx: DemoSeedContext, results: DemoSeedCounts) {
  log.info('\n📦 Phase 3: Seeding Products & Equipment...');

  // Seed Product Models
  log.info('  → Creating product models...');
  // product_models keys on product_code + product_name (both NOT NULL) and has no
  // monthly-lease column — lease rates live on the quote/contract, not the catalogue.
  const productModelData = [
    {
      id: generateId('pm', 1),
      productCode: 'CAN-IRC3530I',
      productName: 'Canon imageRUNNER C3530i',
      manufacturer: 'Canon',
      category: 'mfp',
      msrp: '4500.00',
    },
    {
      id: generateId('pm', 2),
      productCode: 'CAN-IRADXC5860I',
      productName: 'Canon imageRUNNER ADVANCE DX C5860i',
      manufacturer: 'Canon',
      category: 'mfp',
      msrp: '12000.00',
    },
    {
      id: generateId('pm', 3),
      productCode: 'RIC-IMC3500',
      productName: 'Ricoh IM C3500',
      manufacturer: 'Ricoh',
      category: 'mfp',
      msrp: '5200.00',
    },
    {
      id: generateId('pm', 4),
      productCode: 'HP-LJEM507',
      productName: 'HP LaserJet Enterprise M507',
      manufacturer: 'HP',
      category: 'printer',
      msrp: '850.00',
    },
    {
      id: generateId('pm', 5),
      productCode: 'XER-VLC7030',
      productName: 'Xerox VersaLink C7030',
      manufacturer: 'Xerox',
      category: 'mfp',
      msrp: '6800.00',
    },
  ];

  for (const model of productModelData) {
    await db
      .insert(productModels)
      .values({
        ...model,
        tenantId: ctx.tenantId,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Product Accessories
  log.info('  → Creating product accessories...');
  const accessoryData = [
    {
      id: generateId('acc', 1),
      accessoryName: 'Finisher SR4110',
      accessoryCode: 'FIN-SR4110',
      category: 'finisher',
      standardRepPrice: '1200.00',
    },
    {
      id: generateId('acc', 2),
      accessoryName: 'Paper Tray PB1130',
      accessoryCode: 'TRAY-PB1130',
      category: 'paper_handling',
      standardRepPrice: '350.00',
    },
    {
      id: generateId('acc', 3),
      accessoryName: 'Staple Cartridge',
      accessoryCode: 'STAPLE-001',
      category: 'supplies',
      standardRepPrice: '45.00',
    },
    {
      id: generateId('acc', 4),
      accessoryName: 'Cabinet Stand Type D',
      accessoryCode: 'CAB-TYPED',
      category: 'furniture',
      standardRepPrice: '280.00',
    },
  ];

  for (const acc of accessoryData) {
    await db
      .insert(productAccessories)
      .values({
        ...acc,
        tenantId: ctx.tenantId,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Equipment (deployed machines)
  log.info('  → Creating equipment...');
  // `equipment` has no product-model FK: the model is free text (model_number +
  // manufacturer). Its owner column is customer_id and points at business_records,
  // not at the legacy `companies` table. Status is equipment_status, location is
  // location_description (see the MeterReadings note in CLAUDE.md — same table).
  const equipmentData = [
    {
      id: generateId('eq', 1),
      serialNumber: 'CAN-2024-001234',
      modelNumber: 'Canon imageRUNNER C3530i',
      manufacturer: 'Canon',
      customerId: generateId('br', 1),
      equipmentStatus: 'deployed',
      locationDescription: 'Main Office - 2nd Floor',
    },
    {
      id: generateId('eq', 2),
      serialNumber: 'CAN-2024-001235',
      modelNumber: 'Canon imageRUNNER ADVANCE DX C5860i',
      manufacturer: 'Canon',
      customerId: generateId('br', 1),
      equipmentStatus: 'deployed',
      locationDescription: 'Main Office - 3rd Floor',
    },
    {
      id: generateId('eq', 3),
      serialNumber: 'RIC-2024-005678',
      modelNumber: 'Ricoh IM C3500',
      manufacturer: 'Ricoh',
      customerId: generateId('br', 2),
      equipmentStatus: 'deployed',
      locationDescription: 'Server Room',
    },
    {
      id: generateId('eq', 4),
      serialNumber: 'HP-2024-009012',
      modelNumber: 'HP LaserJet Enterprise M507',
      manufacturer: 'HP',
      customerId: generateId('br', 3),
      equipmentStatus: 'deployed',
      locationDescription: 'Reception',
    },
    {
      id: generateId('eq', 5),
      serialNumber: 'XER-2024-003456',
      modelNumber: 'Xerox VersaLink C7030',
      manufacturer: 'Xerox',
      customerId: generateId('br', 7),
      equipmentStatus: 'in_inventory',
      locationDescription: 'Warehouse',
    },
  ];

  for (const eq of equipmentData) {
    await db
      .insert(equipment)
      .values({
        ...eq,
        tenantId: ctx.tenantId,
      })
      .onConflictDoNothing();
  }

  // Seed Service Products
  log.info('  → Creating service products...');
  await db
    .insert(serviceProducts)
    .values({
      id: generateId('sp', 1),
      tenantId: ctx.tenantId,
      productCode: 'SVC-STD-MA',
      productName: 'Standard Maintenance Agreement',
      description: 'Includes all parts and labor for covered repairs',
      newRepPrice: '150.00',
      paymentType: 'monthly',
      isActive: true,
    })
    .onConflictDoNothing();

  // Seed Professional Services
  log.info('  → Creating professional services...');
  await db
    .insert(professionalServices)
    .values({
      id: generateId('ps', 1),
      tenantId: ctx.tenantId,
      productCode: 'PS-NET-SETUP',
      productName: 'Network Setup & Configuration',
      description: 'Complete network integration and configuration',
      summary: 'Typical engagement: 4 hours',
      units: 'hour',
      newRepPrice: '125.00',
      isActive: true,
    })
    .onConflictDoNothing();

  // Seed Software Products
  log.info('  → Creating software products...');
  await db
    .insert(softwareProducts)
    .values({
      id: generateId('sw', 1),
      tenantId: ctx.tenantId,
      productCode: 'SW-PMP',
      productName: 'Print Management Pro',
      description: 'Enterprise print management and tracking software',
      productType: 'subscription',
      standardRepPrice: '75.00',
      isActive: true,
    })
    .onConflictDoNothing();

  // Seed Supplies
  log.info('  → Creating supplies...');
  // The whole product family (supplies / service / professional / software) shares the
  // product_code + product_name shape; none of them has name/sku/price/category.
  const supplyData = [
    {
      id: generateId('sup', 1),
      productName: 'Black Toner - Canon C3530',
      productCode: 'TNR-C3530-BK',
      newRepPrice: '85.00',
      productType: 'toner',
    },
    {
      id: generateId('sup', 2),
      productName: 'Cyan Toner - Canon C3530',
      productCode: 'TNR-C3530-C',
      newRepPrice: '95.00',
      productType: 'toner',
    },
    {
      id: generateId('sup', 3),
      productName: 'Drum Unit - Canon C3530',
      productCode: 'DRM-C3530',
      newRepPrice: '220.00',
      productType: 'drum',
    },
    {
      id: generateId('sup', 4),
      productName: 'A4 Copy Paper (5000 sheets)',
      productCode: 'PPR-A4-5K',
      newRepPrice: '45.00',
      productType: 'paper',
    },
  ];

  for (const supply of supplyData) {
    await db
      .insert(supplies)
      .values({
        ...supply,
        tenantId: ctx.tenantId,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  Object.assign(results, {
    productModels: productModelData.length,
    accessories: accessoryData.length,
    equipment: equipmentData.length,
    serviceProducts: 1,
    professionalServices: 1,
    softwareProducts: 1,
    supplies: supplyData.length,
  });

  log.info('  ✅ Products & Equipment seeded');
}

// ============================================================================
// PHASE 4: SALES & CRM
// ============================================================================

async function seedSalesAndCRM(ctx: DemoSeedContext, results: DemoSeedCounts) {
  log.info('\n💼 Phase 4: Seeding Sales & CRM...');

  // Seed Deal Stages
  log.info('  → Creating deal stages...');
  // deal_stages orders by sort_order and has no probability column; what it does carry
  // is isClosingStage / isWonStage, which is what the pipeline reads.
  const stageData = [
    { id: generateId('stage', 1), name: 'Discovery', sortOrder: 1, color: '#3B82F6' },
    { id: generateId('stage', 2), name: 'Qualification', sortOrder: 2, color: '#8B5CF6' },
    { id: generateId('stage', 3), name: 'Proposal', sortOrder: 3, color: '#F59E0B' },
    { id: generateId('stage', 4), name: 'Negotiation', sortOrder: 4, color: '#EF4444' },
    {
      id: generateId('stage', 5),
      name: 'Closed Won',
      sortOrder: 5,
      color: '#22C55E',
      isClosingStage: true,
      isWonStage: true,
    },
    {
      id: generateId('stage', 6),
      name: 'Closed Lost',
      sortOrder: 6,
      color: '#6B7280',
      isClosingStage: true,
      isWonStage: false,
    },
  ];

  for (const stage of stageData) {
    await db
      .insert(dealStages)
      .values({
        ...stage,
        tenantId: ctx.tenantId,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // COP-M07: mirror them into the canonical pipeline_stages, keyed back through
  // legacy_stage_id as CRMX-005 established.
  //
  // Without this a seeded tenant has deal_stages and ZERO pipeline_stages, so
  // every surface bound to the canonical model sees nothing. It used to be
  // covered by a lazy bootstrap inside the pipeline-config edge function, but
  // that bootstrap omitted the NOT NULL pipeline_type and so could never
  // succeed — see the note there. Seeding both means a demo tenant is in the
  // state the rest of the model assumes, and the stage-resolution check has
  // something real to verify.
  log.info('  → Mirroring deal stages into the canonical pipeline...');
  const [template] = await db
    .insert(pipelineTemplates)
    .values({
      id: generateId('pipeline-template', 1),
      tenantId: ctx.tenantId,
      name: 'Default Sales Pipeline',
      pipelineType: 'new_business',
      isActive: true,
      isDefault: true,
      createdBy: ctx.userId,
    })
    .onConflictDoNothing()
    .returning();

  const templateId = template?.id ?? generateId('pipeline-template', 1);

  for (const [index, stage] of stageData.entries()) {
    const isWon = 'isWonStage' in stage && stage.isWonStage === true;
    const isClosing = 'isClosingStage' in stage && stage.isClosingStage === true;
    await db
      .insert(pipelineStages)
      .values({
        id: generateId('pipeline-stage', index + 1),
        tenantId: ctx.tenantId,
        pipelineTemplateId: templateId,
        name: stage.name,
        displayName: stage.name,
        color: stage.color,
        order: stage.sortOrder,
        isFinalStage: isClosing,
        isClosedWon: isWon,
        isClosedLost: isClosing && !isWon,
        // 100 / 0 on the closed stages, a neutral 50 elsewhere: deal_stages has
        // no probability column to carry over, so anything finer would be made up.
        defaultProbability: isWon ? 100 : isClosing ? 0 : 50,
        includeInForecast: true,
        isActive: true,
        legacyStageId: stage.id,
      })
      .onConflictDoNothing();
  }

  // Seed Opportunities
  log.info('  → Creating opportunities...');
  // opportunities is the Salesforce-shaped table: opportunity_name / account_id /
  // amount / stage_name / close_date. There is no expectedCloseDate.
  const opportunityData = [
    {
      id: generateId('opp', 1),
      opportunityName: 'Acme Fleet Upgrade',
      accountId: generateId('br', 1),
      accountName: 'Acme Corporation',
      amount: '45000.00',
      stageName: 'proposal',
      probability: 50,
    },
    {
      id: generateId('opp', 2),
      opportunityName: 'TechStart New Office Setup',
      accountId: generateId('br', 2),
      accountName: 'TechStart Inc.',
      amount: '28000.00',
      stageName: 'qualification',
      probability: 25,
    },
    {
      id: generateId('opp', 3),
      opportunityName: 'Global Finance Expansion',
      accountId: generateId('br', 3),
      accountName: 'Global Finance LLC',
      amount: '85000.00',
      stageName: 'negotiation',
      probability: 75,
    },
    {
      id: generateId('opp', 4),
      opportunityName: 'Healthcare Solutions MFP Replacement',
      accountId: generateId('br', 7),
      accountName: 'Healthcare Solutions',
      amount: '32000.00',
      stageName: 'discovery',
      probability: 10,
    },
  ];

  for (const opp of opportunityData) {
    await db
      .insert(opportunities)
      .values({
        ...opp,
        tenantId: ctx.tenantId,
        ownerId: ctx.userId,
        closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Deals
  log.info('  → Creating deals...');
  // deals: amount (not value), customerId (not companyId), createdById is NOT NULL.
  const dealData = [
    {
      id: generateId('deal', 1),
      title: 'Acme 5-Year Service Agreement',
      customerId: generateId('br', 1),
      companyName: 'Acme Corporation',
      stageId: generateId('stage', 3),
      amount: '45000.00',
    },
    {
      id: generateId('deal', 2),
      title: 'TechStart Equipment Lease',
      customerId: generateId('br', 2),
      companyName: 'TechStart Inc.',
      stageId: generateId('stage', 2),
      amount: '28000.00',
    },
    {
      id: generateId('deal', 3),
      title: 'Global Finance Print Fleet',
      customerId: generateId('br', 3),
      companyName: 'Global Finance LLC',
      stageId: generateId('stage', 4),
      amount: '85000.00',
    },
  ];

  for (const deal of dealData) {
    await db
      .insert(deals)
      .values({
        ...deal,
        tenantId: ctx.tenantId,
        ownerId: ctx.userId,
        createdById: ctx.userId,
        priority: 'high',
        expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Quotes
  log.info('  → Creating quotes...');
  // quotes stores only the header total (total_amount, NOT NULL) plus a NOT NULL title;
  // there is no subtotal column — line-level money lives on quote_line_items.
  const quoteData = [
    {
      id: generateId('quote', 1),
      quoteNumber: 'Q-2024-001',
      title: 'Acme Corporation - Fleet Upgrade',
      customerId: generateId('br', 1),
      status: 'sent',
      totalAmount: '16125.00',
    },
    {
      id: generateId('quote', 2),
      quoteNumber: 'Q-2024-002',
      title: 'TechStart Inc. - New Office Setup',
      customerId: generateId('br', 2),
      status: 'draft',
      totalAmount: '9137.50',
    },
    {
      id: generateId('quote', 3),
      quoteNumber: 'Q-2024-003',
      title: 'Global Finance LLC - Print Fleet',
      customerId: generateId('br', 3),
      status: 'accepted',
      totalAmount: '45150.00',
    },
  ];

  for (const quote of quoteData) {
    await db
      .insert(quotes)
      .values({
        ...quote,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Proposals
  log.info('  → Creating proposals...');
  await db
    .insert(proposals)
    .values({
      id: generateId('prop', 1),
      tenantId: ctx.tenantId,
      proposalNumber: 'PROP-2024-001',
      proposalType: 'standard',
      title: 'Acme Corporation - Managed Print Services Proposal',
      businessRecordId: generateId('br', 1),
      contactId: generateId('contact', 1),
      status: 'sent',
      totalAmount: '45000.00',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: ctx.userId,
      assignedTo: ctx.userId,
    })
    .onConflictDoNothing();

  // Seed Contracts
  log.info('  → Creating contracts...');
  // `contracts` is the thin meter-billing contract: customer_id, monthly_base and the
  // per-copy rates. It has no contract-type column (service_contracts does).
  const contractData = [
    {
      id: generateId('contract', 1),
      contractNumber: 'CTR-2024-001',
      customerId: generateId('br', 1),
      status: 'active',
      monthlyBase: '2500.00',
      blackRate: '0.0125',
      colorRate: '0.0850',
    },
    {
      id: generateId('contract', 2),
      contractNumber: 'CTR-2024-002',
      customerId: generateId('br', 2),
      status: 'active',
      monthlyBase: '1800.00',
      blackRate: '0.0110',
      colorRate: '0.0790',
    },
    {
      id: generateId('contract', 3),
      contractNumber: 'CTR-2024-003',
      customerId: generateId('br', 3),
      status: 'pending',
      monthlyBase: '3200.00',
      blackRate: '0.0135',
      colorRate: '0.0900',
    },
  ];

  for (const contract of contractData) {
    await db
      .insert(contracts)
      .values({
        ...contract,
        tenantId: ctx.tenantId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Sales Goals
  log.info('  → Creating sales goals...');
  await db
    .insert(salesGoals)
    .values({
      // sales_goals is ACTIVITY-count based: goal_type is an enum of calls / emails /
      // meetings / reachouts / proposals / new_opportunities / demos / follow_ups, and
      // the target is target_count. There is no revenue goal type and no
      // targetAmount / currentAmount / name column, so the old '$250k revenue' goal
      // could not be expressed here at all.
      id: generateId('goal', 1),
      tenantId: ctx.tenantId,
      assignedToUserId: ctx.userId,
      assignedBy: ctx.userId,
      goalType: 'new_opportunities',
      targetCount: 40,
      notes: 'Q1 2024 target: 40 new opportunities',
      period: 'quarterly',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    })
    .onConflictDoNothing();

  Object.assign(results, {
    dealStages: stageData.length,
    // COP-M07: the canonical mirror. Counted separately from dealStages, because
    // demo-data-seed-shape.test.ts asserts the summary accounts for every insert
    // the seeder issues — a summary that under-reports is how a silent write
    // goes unnoticed.
    pipelineTemplates: 1,
    pipelineStages: stageData.length,
    opportunities: opportunityData.length,
    deals: dealData.length,
    quotes: quoteData.length,
    proposals: 1,
    contracts: contractData.length,
    salesGoals: 1,
  });

  log.info('  ✅ Sales & CRM seeded');
}

// ============================================================================
// PHASE 5: SERVICE & OPERATIONS
// ============================================================================

async function seedServiceAndOperations(ctx: DemoSeedContext, results: DemoSeedCounts) {
  log.info('\n🔧 Phase 5: Seeding Service & Operations...');

  // Seed Technicians
  log.info('  → Creating technicians...');
  const technicianData = [
    {
      id: generateId('tech', 1),
      userId: generateId('user', 3),
      firstName: 'Mike',
      lastName: 'Turner',
      email: 'mike.turner@printyx.net',
      phone: '555-2001',
      skills: ['Canon', 'Ricoh'],
    },
    {
      id: generateId('tech', 2),
      userId: generateId('user', 4),
      firstName: 'Lisa',
      lastName: 'Chen',
      email: 'lisa.chen@printyx.net',
      phone: '555-2002',
      skills: ['HP', 'Xerox'],
    },
    {
      id: generateId('tech', 3),
      userId: generateId('user', 5),
      firstName: 'James',
      lastName: 'Wilson',
      email: 'james.wilson@printyx.net',
      phone: '555-2003',
      skills: ['Canon', 'Xerox', 'Ricoh'],
    },
  ];

  for (const tech of technicianData) {
    await db
      .insert(technicians)
      .values({
        // technicians: user_id is NOT NULL, skills (not specializations), and
        // availability is the isActive/isAvailable pair — there is no status or
        // hire_date column.
        ...tech,
        tenantId: ctx.tenantId,
        isActive: true,
        isAvailable: true,
      })
      .onConflictDoNothing();
  }

  // Seed Service Contracts
  log.info('  → Creating service contracts...');
  const serviceContractData = [
    {
      id: generateId('sc', 1),
      contractNumber: 'SVC-2024-001',
      customerId: generateId('br', 1),
      equipmentId: generateId('eq', 1),
      contractType: 'full_service',
      monthlyBaseRate: '250.00',
      baseVolumeBw: 10000,
      baseVolumeColor: 2000,
    },
    {
      id: generateId('sc', 2),
      contractNumber: 'SVC-2024-002',
      customerId: generateId('br', 2),
      equipmentId: generateId('eq', 3),
      contractType: 'maintenance',
      monthlyBaseRate: '150.00',
      baseVolumeBw: 5000,
      baseVolumeColor: 1000,
    },
  ];

  for (const sc of serviceContractData) {
    await db
      .insert(serviceContracts)
      .values({
        ...sc,
        tenantId: ctx.tenantId,
        contractStatus: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Service Tickets
  log.info('  → Creating service tickets...');
  const ticketData = [
    {
      id: generateId('ticket', 1),
      ticketNumber: 'TKT-2024-0001',
      customerId: generateId('br', 1),
      equipmentId: generateId('eq', 1),
      title: 'Paper jam in tray 2',
      priority: 'medium',
      status: 'open',
    },
    {
      id: generateId('ticket', 2),
      ticketNumber: 'TKT-2024-0002',
      customerId: generateId('br', 2),
      equipmentId: generateId('eq', 3),
      title: 'Error code E002 displayed',
      priority: 'high',
      status: 'in_progress',
    },
    {
      id: generateId('ticket', 3),
      ticketNumber: 'TKT-2024-0003',
      customerId: generateId('br', 1),
      equipmentId: generateId('eq', 2),
      title: 'Preventive maintenance due',
      priority: 'low',
      status: 'scheduled',
    },
    {
      id: generateId('ticket', 4),
      ticketNumber: 'TKT-2024-0004',
      customerId: generateId('br', 3),
      equipmentId: generateId('eq', 4),
      title: 'Print quality issues',
      priority: 'medium',
      status: 'resolved',
    },
  ];

  for (const ticket of ticketData) {
    await db
      .insert(serviceTickets)
      .values({
        // service_tickets: title (not subject), customer_id, created_by NOT NULL.
        // There is no reportedBy column.
        ...ticket,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
        assignedTechnicianId: generateId('tech', 1),
      })
      .onConflictDoNothing();
  }

  // Seed Meter Readings
  log.info('  → Creating meter readings...');
  const meterData = [
    {
      id: generateId('meter', 1),
      equipmentId: generateId('eq', 1),
      bwMeterReading: 45230,
      colorMeterReading: 8450,
      readingDate: new Date(),
    },
    {
      id: generateId('meter', 2),
      equipmentId: generateId('eq', 2),
      bwMeterReading: 128500,
      colorMeterReading: 32100,
      readingDate: new Date(),
    },
    {
      id: generateId('meter', 3),
      equipmentId: generateId('eq', 3),
      bwMeterReading: 67800,
      colorMeterReading: 15200,
      readingDate: new Date(),
    },
    {
      id: generateId('meter', 4),
      equipmentId: generateId('eq', 4),
      bwMeterReading: 23400,
      colorMeterReading: 0,
      readingDate: new Date(),
    },
  ];

  for (const meter of meterData) {
    await db
      .insert(meterReadings)
      .values({
        // meter_readings: bw_meter_reading / color_meter_reading (CLAUDE.md BATCH 8),
        // reading_method rather than source, created_by NOT NULL.
        ...meter,
        tenantId: ctx.tenantId,
        readingMethod: 'manual',
        createdBy: ctx.userId,
      })
      .onConflictDoNothing();
  }

  // Seed Service Calls
  log.info('  → Creating service calls...');
  await db
    .insert(serviceCalls)
    .values({
      // service_calls is the E-Automate-shaped call log: it keys off customer_id +
      // call_date and has no ticket FK, no scheduledDate and no duration estimate.
      id: generateId('call', 1),
      tenantId: ctx.tenantId,
      serviceCallNumber: 'SC-2024-0001',
      customerId: generateId('br', 1),
      equipmentId: generateId('eq', 1),
      assignedTechnicianId: generateId('tech', 1),
      callDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      callType: 'repair',
      callStatus: 'scheduled',
    })
    .onConflictDoNothing();

  Object.assign(results, {
    technicians: technicianData.length,
    serviceContracts: serviceContractData.length,
    serviceTickets: ticketData.length,
    meterReadings: meterData.length,
    serviceCalls: 1,
  });

  log.info('  ✅ Service & Operations seeded');
}

// ============================================================================
// PHASE 6: FINANCE & BILLING
// ============================================================================

async function seedFinanceAndBilling(ctx: DemoSeedContext, results: DemoSeedCounts) {
  log.info('\n💰 Phase 6: Seeding Finance & Billing...');

  // Seed Vendors
  log.info('  → Creating vendors...');
  // `vendors` has no vendorType/category column and no status string — see the two
  // vendor CRUD pages fixed in CLAUDE.md BATCH 7/10, same table, same phantom shape.
  const vendorData = [
    {
      id: generateId('vendor', 1),
      vendorName: 'Canon USA',
      primaryContactName: 'Account Manager',
      email: 'orders@canon.example.com',
      phone: '800-555-0001',
      vendorNotes: 'Manufacturer',
    },
    {
      id: generateId('vendor', 2),
      vendorName: 'Office Supplies Direct',
      primaryContactName: 'Sales Team',
      email: 'sales@osd.example.com',
      phone: '800-555-0002',
      vendorNotes: 'Distributor',
    },
    {
      id: generateId('vendor', 3),
      vendorName: 'Tech Parts Wholesale',
      primaryContactName: 'Parts Dept',
      email: 'parts@tpw.example.com',
      phone: '800-555-0003',
      vendorNotes: 'Parts supplier',
    },
  ];

  for (const vendor of vendorData) {
    await db
      .insert(vendors)
      .values({
        ...vendor,
        tenantId: ctx.tenantId,
        isActive: true,
        paymentTerms: 'net30',
      })
      .onConflictDoNothing();
  }

  // Seed Invoices
  log.info('  → Creating invoices...');
  const invoiceData = [
    {
      id: generateId('inv', 1),
      invoiceNumber: 'INV-2024-0001',
      customerId: generateId('br', 1),
      invoiceStatus: 'paid',
      subtotalAmount: '2500.00',
      taxAmount: '212.50',
      totalAmount: '2712.50',
    },
    {
      id: generateId('inv', 2),
      invoiceNumber: 'INV-2024-0002',
      customerId: generateId('br', 2),
      invoiceStatus: 'sent',
      subtotalAmount: '1800.00',
      taxAmount: '153.00',
      totalAmount: '1953.00',
    },
    {
      id: generateId('inv', 3),
      invoiceNumber: 'INV-2024-0003',
      customerId: generateId('br', 3),
      invoiceStatus: 'overdue',
      subtotalAmount: '3200.00',
      taxAmount: '272.00',
      totalAmount: '3472.00',
    },
    {
      id: generateId('inv', 4),
      invoiceNumber: 'INV-2024-0004',
      customerId: generateId('br', 1),
      invoiceStatus: 'draft',
      subtotalAmount: '4500.00',
      taxAmount: '382.50',
      totalAmount: '4882.50',
    },
  ];

  for (const invoice of invoiceData) {
    await db
      .insert(invoices)
      .values({
        // The real money columns are subtotal_amount / tax_amount / total_amount /
        // amount_paid / balance_due, and the state column is invoice_status
        // (see the billing note in CLAUDE.md). created_by is NOT NULL.
        ...invoice,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }

  // Seed Leases
  log.info('  → Creating leases...');
  const leaseData = [
    {
      id: generateId('lease', 1),
      leaseNumber: 'LS-2024-001',
      customerId: generateId('br', 1),
      equipmentIds: [generateId('eq', 1)],
      term: 36,
      monthlyPayment: '450.00',
      totalAmount: '16200.00',
      status: 'active' as const,
      leaseType: 'fmv' as const,
    },
    {
      id: generateId('lease', 2),
      leaseNumber: 'LS-2024-002',
      customerId: generateId('br', 2),
      equipmentIds: [generateId('eq', 3)],
      term: 60,
      monthlyPayment: '289.00',
      totalAmount: '17340.00',
      status: 'active' as const,
      leaseType: 'dollar_buyout' as const,
    },
  ];

  for (const lease of leaseData) {
    await db
      .insert(leases)
      .values({
        // leases holds an equipment_ids ARRAY, not a single equipmentId, and has no
        // payment_frequency column (payment_day_of_month + monthly_payment cover it).
        // first/last payment date and created_by are all NOT NULL.
        ...lease,
        tenantId: ctx.tenantId,
        leaseName: `Lease for ${lease.leaseNumber}`,
        createdBy: ctx.userId,
        startDate: new Date(),
        endDate: new Date(Date.now() + lease.term * 30 * 24 * 60 * 60 * 1000),
        firstPaymentDate: new Date(),
        lastPaymentDate: new Date(Date.now() + lease.term * 30 * 24 * 60 * 60 * 1000),
        paymentDayOfMonth: 1,
        paymentsCompleted: 6,
        totalPaid: String(parseFloat(lease.monthlyPayment) * 6),
      })
      .onConflictDoNothing();
  }

  // Seed Chart of Accounts
  log.info('  → Creating chart of accounts...');
  // The real column is `account_code` (NOT NULL), not `accountNumber`, and
  // `normalBalance` is not a column at all (chart_of_accounts carries debit_balance /
  // credit_balance instead). The dropped normalBalance value was pure derivation of
  // accountType anyway (asset/expense → debit, liability/equity/revenue → credit),
  // so no information is lost by removing it.
  const accountData = [
    {
      id: generateId('coa', 1),
      accountCode: '1000',
      accountName: 'Cash',
      accountType: 'asset',
    },
    {
      id: generateId('coa', 2),
      accountCode: '1200',
      accountName: 'Accounts Receivable',
      accountType: 'asset',
    },
    {
      id: generateId('coa', 3),
      accountCode: '2000',
      accountName: 'Accounts Payable',
      accountType: 'liability',
    },
    {
      id: generateId('coa', 4),
      accountCode: '3000',
      accountName: 'Retained Earnings',
      accountType: 'equity',
    },
    {
      id: generateId('coa', 5),
      accountCode: '4000',
      accountName: 'Service Revenue',
      accountType: 'revenue',
    },
    {
      id: generateId('coa', 6),
      accountCode: '5000',
      accountName: 'Cost of Goods Sold',
      accountType: 'expense',
    },
  ];

  for (const account of accountData) {
    await db
      .insert(chartOfAccounts)
      .values({
        ...account,
        tenantId: ctx.tenantId,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Seed Purchase Orders
  log.info('  → Creating purchase orders...');
  const poData = [
    {
      id: generateId('po', 1),
      poNumber: 'PO-2024-001',
      vendorId: generateId('vendor', 1),
      status: 'received',
      subtotal: '12500.00',
      totalAmount: '12500.00',
    },
    {
      id: generateId('po', 2),
      poNumber: 'PO-2024-002',
      vendorId: generateId('vendor', 2),
      status: 'ordered',
      subtotal: '850.00',
      totalAmount: '850.00',
    },
    {
      id: generateId('po', 3),
      poNumber: 'PO-2024-003',
      vendorId: generateId('vendor', 3),
      status: 'draft',
      subtotal: '2200.00',
      totalAmount: '2200.00',
    },
  ];

  for (const po of poData) {
    await db
      .insert(purchaseOrders)
      .values({
        // purchase_orders: total_amount + expected_date, and requested_by is NOT NULL.
        ...po,
        tenantId: ctx.tenantId,
        orderDate: new Date(),
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        requestedBy: ctx.userId,
        createdBy: ctx.userId,
      })
      .onConflictDoNothing();
  }

  // Seed Inventory Items
  log.info('  → Creating inventory items...');
  const inventoryData = [
    {
      id: generateId('inv-item', 1),
      partNumber: 'TNR-C3530-BK',
      name: 'Black Toner - Canon C3530',
      category: 'toner',
      quantityOnHand: 25,
      reorderPoint: 10,
      unitCost: '65.00',
    },
    {
      id: generateId('inv-item', 2),
      partNumber: 'TNR-C3530-C',
      name: 'Cyan Toner - Canon C3530',
      category: 'toner',
      quantityOnHand: 18,
      reorderPoint: 8,
      unitCost: '75.00',
    },
    {
      id: generateId('inv-item', 3),
      partNumber: 'DRM-C3530',
      name: 'Drum Unit - Canon C3530',
      category: 'drum',
      quantityOnHand: 5,
      reorderPoint: 3,
      unitCost: '180.00',
    },
    {
      id: generateId('inv-item', 4),
      partNumber: 'FUSER-C3530',
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
        // inventory_items stores a free-text warehouse_location, not a locations FK,
        // and the identifier column is part_number rather than sku.
        ...item,
        tenantId: ctx.tenantId,
        warehouseLocation: 'Warehouse',
      })
      .onConflictDoNothing();
  }

  Object.assign(results, {
    vendors: vendorData.length,
    invoices: invoiceData.length,
    leases: leaseData.length,
    chartOfAccounts: accountData.length,
    purchaseOrders: poData.length,
    inventoryItems: inventoryData.length,
  });

  log.info('  ✅ Finance & Billing seeded');
}

// ============================================================================
// PHASE 7: TASKS & ACTIVITIES
// ============================================================================

async function seedTasksAndActivities(ctx: DemoSeedContext, results: DemoSeedCounts) {
  log.info('\n📋 Phase 7: Seeding Tasks & Activities...');

  // Seed Tasks
  log.info('  → Creating tasks...');
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
        tenantId: ctx.tenantId,
        assignedTo: ctx.userId,
        createdBy: ctx.userId,
      })
      .onConflictDoNothing();
  }

  // Seed Projects
  log.info('  → Creating projects...');
  await db
    .insert(projects)
    .values({
      // projects has end_date (not targetEndDate) and created_by (not ownerId).
      id: generateId('project', 1),
      tenantId: ctx.tenantId,
      name: 'Acme Fleet Modernization',
      description: 'Complete equipment upgrade for Acme Corporation',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      createdBy: ctx.userId,
    })
    .onConflictDoNothing();

  // Seed Business Record Activities
  log.info('  → Creating activities...');
  // `type`/`notes` are not columns on business_record_activities — the real ones are
  // `activity_type` (NOT NULL) and `description`. Identical defect to the copy of
  // this seed in server/routes/admin-seed-routes.ts; both are fixed together.
  const activityData = [
    {
      id: generateId('activity', 1),
      businessRecordId: generateId('br', 1),
      activityType: 'call',
      subject: 'Quarterly review call',
      description: 'Discussed service satisfaction and upcoming needs',
    },
    {
      id: generateId('activity', 2),
      businessRecordId: generateId('br', 1),
      activityType: 'email',
      subject: 'Sent proposal PDF',
      description: 'Emailed updated proposal with new pricing',
    },
    {
      id: generateId('activity', 3),
      businessRecordId: generateId('br', 4),
      activityType: 'meeting',
      subject: 'Initial discovery meeting',
      description: 'Met with prospect to understand their print environment',
    },
    {
      id: generateId('activity', 4),
      businessRecordId: generateId('br', 5),
      activityType: 'note',
      subject: 'Qualification notes',
      description: 'Budget confirmed, decision timeline is Q2',
    },
  ];

  for (const activity of activityData) {
    await db
      .insert(businessRecordActivities)
      .values({
        ...activity,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      })
      .onConflictDoNothing();
  }

  Object.assign(results, {
    tasks: taskData.length,
    projects: 1,
    activities: activityData.length,
  });

  log.info('  ✅ Tasks & Activities seeded');
}

/** Seed every phase in FK order. Returns the row count per entity. */
export async function seedDemoData(ctx: DemoSeedContext): Promise<DemoSeedCounts> {
  const results: DemoSeedCounts = {};
  await seedCoreInfrastructure(ctx, results);
  await seedBusinessFoundation(ctx, results);
  await seedProductsAndEquipment(ctx, results);
  await seedSalesAndCRM(ctx, results);
  await seedServiceAndOperations(ctx, results);
  await seedFinanceAndBilling(ctx, results);
  await seedTasksAndActivities(ctx, results);
  return results;
}
