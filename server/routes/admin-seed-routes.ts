/**
 * Admin Seed Routes
 * API endpoints to trigger demo data seeding from the web UI
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('admin-seed-routes');

import {
  users,
  roles,
  tenants,
  companies,
  companyContacts,
  businessRecords,
  productModels,
  productAccessories,
  equipment,
  professionalServices,
  serviceProducts,
  softwareProducts,
  supplies,
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
  vendors,
  invoices,
  leases,
  chartOfAccounts,
  purchaseOrders,
  inventoryItems,
  tasks,
  projects,
  businessRecordActivities,
  locations,
  regions,
  teams,
} from '@shared/schema';
import { getUserId, getTenantId } from '../utils/auth-helpers';

const router = Router();

// Utility for generating IDs
const generateId = (prefix: string, index: number) =>
  `${prefix}-demo-${String(index).padStart(3, '0')}`;

/**
 * Middleware to require admin access (level 5+ or canAccessAllTenants)
 * Uses database lookup to verify role, similar to requireRootAdmin
 */
const requireSeedAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user with role information from database
    const userWithRole = await db
      .select({
        userId: users.id,
        email: users.email,
        tenantId: users.tenantId,
        roleId: users.roleId,
        roleName: roles.name,
        roleCode: roles.code,
        roleLevel: roles.level,
        canAccessAllTenants: roles.canAccessAllTenants,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithRole.length) {
      return res.status(403).json({ error: 'User not found' });
    }

    const user = userWithRole[0];

    // Check if user has admin level (5+) or can access all tenants
    // Level 5 = Company Admin, System Admin
    // Level 6 = Platform Support
    // Level 7 = Root Admin
    const roleLevel = user.roleLevel || 0;
    const canAccess = roleLevel >= 5 || user.canAccessAllTenants;

    if (!canAccess) {
      return res.status(403).json({
        error: 'Admin access required',
        message: 'You need Company Admin level (5) or higher to seed demo data',
        currentLevel: roleLevel,
      });
    }

    // Add user info to request for later use
    (req as any).seedUser = {
      id: user.userId,
      email: user.email,
      tenantId: user.tenantId || getTenantId(req),
      roleLevel: roleLevel,
      roleName: user.roleName,
      roleCode: user.roleCode,
      canAccessAllTenants: user.canAccessAllTenants,
    };

    next();
  } catch (error: any) {
    log.error('[Seed] Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed', message: error.message });
  }
};

/**
 * GET /api/admin/seed/status
 * Check if demo data exists for the current tenant
 */
router.get('/status', requireSeedAdmin, async (req: Request, res: Response) => {
  try {
    const seedUser = (req as any).seedUser;

    if (!seedUser?.tenantId) {
      return res.status(400).json({ error: 'No tenant context - user must belong to a tenant' });
    }

    // Check for existing demo data
    const [existingCompany] = await db
      .select()
      .from(companies)
      .where(
        and(eq(companies.tenantId, seedUser.tenantId), eq(companies.name, 'Acme Corporation')),
      );

    const hasData = !!existingCompany;

    res.json({
      tenantId: seedUser.tenantId,
      userId: seedUser.id,
      userEmail: seedUser.email,
      roleLevel: seedUser.roleLevel,
      roleName: seedUser.roleName,
      hasDemoData: hasData,
      message: hasData
        ? 'Demo data already exists for this tenant'
        : 'No demo data found - ready to seed',
    });
  } catch (error: any) {
    log.error('[Seed] Error checking seed status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/seed/demo
 * Seed demo data for the current tenant
 */
router.post('/demo', requireSeedAdmin, async (req: Request, res: Response) => {
  try {
    const seedUser = (req as any).seedUser;

    if (!seedUser?.id || !seedUser?.tenantId) {
      return res.status(400).json({ error: 'No tenant context - user must belong to a tenant' });
    }

    const DEMO_TENANT_ID = seedUser.tenantId;
    const DEMO_USER_ID = seedUser.id;
    const force = req.body.force === true;

    log.info(`[Seed] Starting demo data seeding for tenant: ${DEMO_TENANT_ID}`);
    log.info(
      `[Seed] User: ${seedUser.email} (${DEMO_USER_ID}) - Role: ${seedUser.roleName} (Level ${seedUser.roleLevel})`,
    );

    // Check if demo data already exists
    const [existingCompany] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.tenantId, DEMO_TENANT_ID), eq(companies.name, 'Acme Corporation')));

    if (existingCompany && !force) {
      return res.status(400).json({
        error: 'Demo data already exists',
        message: 'Use force: true to re-seed',
        hasDemoData: true,
      });
    }

    const results: Record<string, number> = {};

    // ========== PHASE 1: CORE INFRASTRUCTURE ==========
    log.info('[Seed] Phase 1: Core Infrastructure...');

    // Locations
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
        .values({ ...loc, tenantId: DEMO_TENANT_ID, isActive: true })
        .onConflictDoNothing();
    }
    results.locations = locationData.length;

    // Regions
    const regionData = [
      { id: generateId('reg', 1), name: 'East Coast', code: 'EAST' },
      { id: generateId('reg', 2), name: 'West Coast', code: 'WEST' },
      { id: generateId('reg', 3), name: 'Midwest', code: 'MID' },
    ];
    for (const reg of regionData) {
      await db
        .insert(regions)
        .values({ ...reg, tenantId: DEMO_TENANT_ID })
        .onConflictDoNothing();
    }
    results.regions = regionData.length;

    // Teams
    const teamData = [
      { id: generateId('team', 1), name: 'Sales Team Alpha', type: 'sales' },
      { id: generateId('team', 2), name: 'Service Team Beta', type: 'service' },
      { id: generateId('team', 3), name: 'Support Team', type: 'support' },
    ];
    for (const team of teamData) {
      await db
        .insert(teams)
        .values({ ...team, tenantId: DEMO_TENANT_ID })
        .onConflictDoNothing();
    }
    results.teams = teamData.length;

    // ========== PHASE 2: BUSINESS FOUNDATION ==========
    log.info('[Seed] Phase 2: Business Foundation...');

    // Companies
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
    results.companies = companyData.length;

    // Business Records (Leads & Customers)
    const businessRecordData = [
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
    results.businessRecords = businessRecordData.length;

    // Contacts
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
        .values({ ...contact, tenantId: DEMO_TENANT_ID, status: 'active' })
        .onConflictDoNothing();
    }
    results.contacts = contactData.length;

    // ========== PHASE 3: PRODUCTS & EQUIPMENT ==========
    log.info('[Seed] Phase 3: Products & Equipment...');

    // Product Models
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
        .values({ ...model, tenantId: DEMO_TENANT_ID, isActive: true })
        .onConflictDoNothing();
    }
    results.productModels = productModelData.length;

    // Product Accessories
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
        .values({ ...acc, tenantId: DEMO_TENANT_ID, isActive: true })
        .onConflictDoNothing();
    }
    results.accessories = accessoryData.length;

    // Equipment
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
        .values({ ...eq, tenantId: DEMO_TENANT_ID })
        .onConflictDoNothing();
    }
    results.equipment = equipmentData.length;

    // Supplies
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
        .values({ ...supply, tenantId: DEMO_TENANT_ID, isActive: true })
        .onConflictDoNothing();
    }
    results.supplies = supplyData.length;

    // ========== PHASE 4: SALES & CRM ==========
    log.info('[Seed] Phase 4: Sales & CRM...');

    // Deal Stages
    const stageData = [
      {
        id: generateId('stage', 1),
        name: 'Discovery',
        order: 1,
        probability: 10,
        color: '#3B82F6',
      },
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
      {
        id: generateId('stage', 6),
        name: 'Closed Lost',
        order: 6,
        probability: 0,
        color: '#6B7280',
      },
    ];
    for (const stage of stageData) {
      await db
        .insert(dealStages)
        .values({ ...stage, tenantId: DEMO_TENANT_ID, isActive: true })
        .onConflictDoNothing();
    }
    results.dealStages = stageData.length;

    // Opportunities
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
    results.opportunities = opportunityData.length;

    // Quotes
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
    results.quotes = quoteData.length;

    // Contracts
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
    results.contracts = contractData.length;

    // ========== PHASE 5: SERVICE & OPERATIONS ==========
    log.info('[Seed] Phase 5: Service & Operations...');

    // Technicians
    const technicianData = [
      {
        id: generateId('tech', 1),
        firstName: 'Mike',
        lastName: 'Turner',
        email: 'mike.turner@example.com',
        phone: '555-2001',
        specializations: ['Canon', 'Ricoh'],
      },
      {
        id: generateId('tech', 2),
        firstName: 'Lisa',
        lastName: 'Chen',
        email: 'lisa.chen@example.com',
        phone: '555-2002',
        specializations: ['HP', 'Xerox'],
      },
      {
        id: generateId('tech', 3),
        firstName: 'James',
        lastName: 'Wilson',
        email: 'james.wilson@example.com',
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
    results.technicians = technicianData.length;

    // Service Contracts
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
    results.serviceContracts = serviceContractData.length;

    // Service Tickets
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
    results.serviceTickets = ticketData.length;

    // Meter Readings
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
        .values({ ...meter, tenantId: DEMO_TENANT_ID, source: 'manual' })
        .onConflictDoNothing();
    }
    results.meterReadings = meterData.length;

    // ========== PHASE 6: FINANCE & BILLING ==========
    log.info('[Seed] Phase 6: Finance & Billing...');

    // Vendors
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
        .values({ ...vendor, tenantId: DEMO_TENANT_ID, status: 'active', paymentTerms: 'net30' })
        .onConflictDoNothing();
    }
    results.vendors = vendorData.length;

    // Invoices
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
    results.invoices = invoiceData.length;

    // Leases
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
    results.leases = leaseData.length;

    // Chart of Accounts
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
        .values({ ...account, tenantId: DEMO_TENANT_ID, isActive: true })
        .onConflictDoNothing();
    }
    results.chartOfAccounts = accountData.length;

    // Purchase Orders
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
    results.purchaseOrders = poData.length;

    // Inventory Items
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
        .values({ ...item, tenantId: DEMO_TENANT_ID, locationId: generateId('loc', 3) })
        .onConflictDoNothing();
    }
    results.inventoryItems = inventoryData.length;

    // ========== PHASE 7: TASKS & ACTIVITIES ==========
    log.info('[Seed] Phase 7: Tasks & Activities...');

    // Tasks
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
    results.tasks = taskData.length;

    // Activities
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
        .values({ ...activity, tenantId: DEMO_TENANT_ID, createdBy: DEMO_USER_ID })
        .onConflictDoNothing();
    }
    results.activities = activityData.length;

    log.info('[Seed] ✅ Demo data seeding completed!');

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
      tenantId: DEMO_TENANT_ID,
      userId: DEMO_USER_ID,
      results,
    });
  } catch (error: any) {
    log.error('[Seed] ❌ Error seeding demo data:', error);
    res.status(500).json({
      error: 'Failed to seed demo data',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/seed/roles
 * List all available roles (no auth required - for bootstrapping)
 */
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const allRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        code: roles.code,
        level: roles.level,
        department: roles.department,
        roleType: roles.roleType,
        canAccessAllTenants: roles.canAccessAllTenants,
        canManageUsers: roles.canManageUsers,
        description: roles.description,
      })
      .from(roles)
      .orderBy(roles.level);

    res.json({
      roles: allRoles,
      adminRoles: allRoles.filter((r) => (r.level || 0) >= 5),
      message: 'Use POST /api/admin/seed/assign-role to assign a role',
    });
  } catch (error: any) {
    log.error('[Seed] Error listing roles:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/seed/my-role
 * Check the current user's role assignment
 */
router.get('/my-role', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userWithRole = await db
      .select({
        userId: users.id,
        email: users.email,
        tenantId: users.tenantId,
        roleId: users.roleId,
        legacyRole: users.role,
        roleName: roles.name,
        roleCode: roles.code,
        roleLevel: roles.level,
        canAccessAllTenants: roles.canAccessAllTenants,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithRole.length) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    const user = userWithRole[0];
    const hasAdminRole = (user.roleLevel || 0) >= 5 || user.canAccessAllTenants;

    res.json({
      ...user,
      hasAdminRole,
      canSeedData: hasAdminRole,
      message: hasAdminRole
        ? 'You have admin access and can seed demo data'
        : 'You need an admin role (level 5+) to seed demo data. Use POST /api/admin/seed/assign-role to assign yourself a role.',
    });
  } catch (error: any) {
    log.error('[Seed] Error checking user role:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/seed/assign-role
 * Assign a role to a user
 *
 * Bootstrap mode: If you have no role yet, you can assign yourself an admin role
 * Admin mode: If you're already an admin (level 5+), you can assign roles to anyone
 */
router.post('/assign-role', async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { roleId, targetUserId } = req.body;

    if (!roleId) {
      return res.status(400).json({
        error: 'roleId is required',
        hint: 'Use GET /api/admin/seed/roles to see available roles',
      });
    }

    // Get the role being assigned
    const [targetRole] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);

    if (!targetRole) {
      return res.status(404).json({
        error: 'Role not found',
        roleId,
        hint: 'Use GET /api/admin/seed/roles to see available roles',
      });
    }

    // Get current user's role
    const [currentUser] = await db
      .select({
        userId: users.id,
        email: users.email,
        tenantId: users.tenantId,
        roleId: users.roleId,
        roleLevel: roles.level,
        canAccessAllTenants: roles.canAccessAllTenants,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, currentUserId))
      .limit(1);

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found in database' });
    }

    const currentRoleLevel = currentUser.roleLevel || 0;
    const isCurrentAdmin = currentRoleLevel >= 5 || currentUser.canAccessAllTenants;
    const userIdToUpdate = targetUserId || currentUserId;
    const isSelfAssignment = userIdToUpdate === currentUserId;

    // Authorization logic
    if (!isCurrentAdmin) {
      // Bootstrap mode: Allow self-assignment if user has no role
      if (!isSelfAssignment) {
        return res.status(403).json({
          error: 'You need admin access to assign roles to other users',
          currentLevel: currentRoleLevel,
        });
      }

      // Allow self-assignment for bootstrapping (first admin scenario)
      log.info(`[Seed] Bootstrap mode: User ${currentUserId} assigning themselves role ${roleId}`);
    } else {
      // Admin can assign roles, but warn if assigning higher level
      const targetRoleLevel = targetRole.level || 0;
      if (targetRoleLevel > currentRoleLevel && !currentUser.canAccessAllTenants) {
        log.warn(
          `[Seed] Warning: User ${currentUserId} (level ${currentRoleLevel}) assigning higher role (level ${targetRoleLevel})`,
        );
      }
    }

    // Perform the role assignment
    await db.update(users).set({ roleId: roleId }).where(eq(users.id, userIdToUpdate));

    // Get updated user info
    const [updatedUser] = await db
      .select({
        userId: users.id,
        email: users.email,
        roleId: users.roleId,
        roleName: roles.name,
        roleLevel: roles.level,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userIdToUpdate))
      .limit(1);

    log.info(
      `[Seed] Role assigned: User ${userIdToUpdate} now has role ${roleId} (${targetRole.name})`,
    );

    res.json({
      success: true,
      message: `Role "${targetRole.name}" assigned successfully`,
      user: updatedUser,
      canNowSeedData: (targetRole.level || 0) >= 5 || targetRole.canAccessAllTenants,
      nextStep:
        (targetRole.level || 0) >= 5
          ? 'You can now use POST /api/admin/seed/demo to seed demo data'
          : 'You need a higher role level to seed demo data',
    });
  } catch (error: any) {
    log.error('[Seed] Error assigning role:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
