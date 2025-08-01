import {
  users,
  roles,
  teams,
  tenants,
  userCustomerAssignments,
  companies,
  companyContacts,
  leads,
  leadActivities,
  leadContacts,
  leadRelatedRecords,
  quotes,
  quoteLineItems,
  customers,
  equipment,
  contracts,
  serviceTickets,
  inventoryItems,
  technicians,
  meterReadings,
  invoices,
  invoiceLineItems,
  productModels,
  productAccessories,
  cpcRates,
  professionalServices,
  serviceProducts,
  softwareProducts,
  supplies,
  managedServices,
  contractTieredRates,
  vendors,
  accountsPayable,
  accountsReceivable,
  chartOfAccounts,
  purchaseOrders,
  purchaseOrderItems,
  deals,
  dealStages,
  dealActivities,
  type User,
  type UpsertUser,
  type InsertUser,
  type Role,
  type Team,
  type UserCustomerAssignment,
  type Company,
  type InsertCompany,
  type CompanyContact,
  type InsertCompanyContact,
  type Lead,
  type InsertLead,
  type LeadActivity,
  type LeadContact,
  type LeadRelatedRecord,
  type Quote,
  type Customer,
  type Equipment,
  type Contract,
  type ServiceTicket,
  type InventoryItem,
  type Technician,
  type MeterReading,
  type Invoice,
  type ProductModel,
  type ProductAccessory,
  type CpcRate,
  type ProfessionalService,
  type ServiceProduct,
  type SoftwareProduct,
  type Supply,
  type ManagedService,
  type ContractTieredRate,
  type InsertContractTieredRate,
  tasks,
  projects,
  systemAlerts,
  performanceMetrics,
  systemIntegrations,
  type Task,
  type InsertTask,
  type Project,
  type InsertProject,
  type SystemAlert,
  type InsertSystemAlert,
  type PerformanceMetric,
  type InsertPerformanceMetric,
  type SystemIntegration,
  type InsertSystemIntegration,
  type InsertProductModel,
  type InsertProductAccessory,
  type InsertCpcRate,
  type InsertProfessionalService,
  type InsertServiceProduct,
  type InsertSoftwareProduct,
  type InsertSupply,
  type InsertManagedService,
  type Vendor,
  type AccountsPayable,
  type AccountsReceivable,  
  type ChartOfAccount,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type InsertVendor,
  type InsertAccountsPayable,
  type InsertAccountsReceivable,
  type InsertChartOfAccount,
  type InsertPurchaseOrder,
  type InsertPurchaseOrderItem,
  type Deal,
  type InsertDeal,
  type DealStage,
  type InsertDealStage,
  type DealActivity,
  type InsertDealActivity,
  companyPricingSettings,
  productPricing,
  quotePricing,
  quotePricingLineItems,
  type CompanyPricingSetting,
  type InsertCompanyPricingSetting,
  type ProductPricing,
  type InsertProductPricing,
  type QuotePricing,
  type InsertQuotePricing,
  type QuotePricingLineItem,
  type InsertQuotePricingLineItem,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, inArray, sql, desc, asc, like, gte, lte, count, isNull, isNotNull } from "drizzle-orm";
import bcrypt from "bcrypt";

// Interface for storage operations with role-based access control
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Authentication operations
  authenticateUser(email: string, password: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  
  // Tenant operations for platform users
  getAllTenants(): Promise<{ id: string; name: string; domain?: string }[]>;
  
  // Role-based data access operations
  getUserWithRole(id: string): Promise<(User & { role?: Role; team?: Team }) | undefined>;
  getAccessibleCustomers(userId: string, tenantId: string, roleLevel: number, teamId?: string): Promise<Customer[]>;
  getAccessibleLeads(userId: string, tenantId: string, roleLevel: number, teamId?: string): Promise<Lead[]>;
  getAccessibleServiceTickets(userId: string, tenantId: string, roleLevel: number, teamId?: string): Promise<ServiceTicket[]>;
  getAccessibleContracts(userId: string, tenantId: string, roleLevel: number, teamId?: string): Promise<Contract[]>;
  
  // Customer operations
  getCustomers(tenantId: string): Promise<Customer[]>;
  getCustomer(id: string, tenantId: string): Promise<Customer | undefined>;
  createCustomer(customer: Omit<Customer, "id" | "createdAt" | "updatedAt">): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<Customer>, tenantId: string): Promise<Customer | undefined>;
  deleteCustomer(id: string, tenantId: string): Promise<boolean>;
  
  // Company operations (new primary business entity)
  getCompanies(tenantId: string): Promise<Company[]>;
  getCompany(id: string, tenantId: string): Promise<Company | undefined>;
  createCompany(company: Omit<Company, "id" | "createdAt" | "updatedAt">): Promise<Company>;
  updateCompany(id: string, company: Partial<Company>, tenantId: string): Promise<Company | undefined>;
  deleteCompany(id: string, tenantId: string): Promise<boolean>;

  // Company contact operations
  getCompanyContacts(companyId: string, tenantId: string): Promise<CompanyContact[]>;
  getCompanyContact(id: string, tenantId: string): Promise<CompanyContact | undefined>;
  createCompanyContact(contact: Omit<CompanyContact, "id" | "createdAt" | "updatedAt">): Promise<CompanyContact>;
  updateCompanyContact(id: string, contact: Partial<CompanyContact>, tenantId: string): Promise<CompanyContact | undefined>;
  deleteCompanyContact(id: string, tenantId: string): Promise<boolean>;

  // Lead operations (simplified pipeline tracking)
  getLeads(tenantId: string): Promise<Lead[]>;
  getLead(id: string, tenantId: string): Promise<Lead | undefined>;
  createLead(lead: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead>;
  updateLead(id: string, lead: Partial<Lead>, tenantId: string): Promise<Lead | undefined>;
  convertLeadToCustomer(leadId: string, tenantId: string): Promise<Customer>;
  
  // Lead activity/interaction operations
  getLeadActivities(leadId: string, tenantId: string): Promise<LeadActivity[]>;
  createLeadActivity(activity: Omit<LeadActivity, "id" | "createdAt" | "updatedAt">): Promise<LeadActivity>;

  // Contact operations (used for company contacts)
  createContact(contact: Omit<LeadContact, "id" | "createdAt" | "updatedAt">): Promise<LeadContact>;
  getContactsByCompany(companyId: string, tenantId: string): Promise<LeadContact[]>;
  updateContact(contactId: string, contact: Partial<LeadContact>): Promise<LeadContact>;
  deleteContact(contactId: string, tenantId: string): Promise<boolean>;
  
  // Lead contact operations
  getLeadContacts(leadId: string, tenantId: string): Promise<LeadContact[]>;
  createLeadContact(contact: Omit<LeadContact, "id" | "createdAt" | "updatedAt">): Promise<LeadContact>;
  
  // Lead related records operations
  getLeadRelatedRecords(leadId: string, tenantId: string): Promise<LeadRelatedRecord[]>;
  createLeadRelatedRecord(record: Omit<LeadRelatedRecord, "id" | "createdAt">): Promise<LeadRelatedRecord>;
  
  // Quote operations with RBAC
  getQuotes(tenantId: string): Promise<Quote[]>;
  createQuote(quote: Omit<Quote, "id" | "createdAt" | "updatedAt">): Promise<Quote>;
  
  // Equipment operations
  getEquipment(tenantId: string): Promise<Equipment[]>;
  createEquipment(equipment: Omit<Equipment, "id" | "createdAt" | "updatedAt">): Promise<Equipment>;
  
  // Contract operations
  getContracts(tenantId: string): Promise<Contract[]>;
  createContract(contract: Omit<Contract, "id" | "createdAt" | "updatedAt">): Promise<Contract>;
  
  // Service ticket operations with RBAC
  getServiceTickets(tenantId: string): Promise<ServiceTicket[]>;
  createServiceTicket(ticket: Omit<ServiceTicket, "id" | "createdAt" | "updatedAt">): Promise<ServiceTicket>;
  updateServiceTicket(id: string, ticket: Partial<ServiceTicket>, tenantId: string): Promise<ServiceTicket | undefined>;
  
  // Inventory operations
  getInventoryItems(tenantId: string): Promise<InventoryItem[]>;
  createInventoryItem(item: Omit<InventoryItem, "id" | "createdAt" | "updatedAt">): Promise<InventoryItem>;
  
  // Technician operations
  getTechnicians(tenantId: string): Promise<Technician[]>;
  createTechnician(technician: Omit<Technician, "id" | "createdAt" | "updatedAt">): Promise<Technician>;
  
  // Meter reading operations
  getMeterReadings(tenantId: string): Promise<MeterReading[]>;
  createMeterReading(reading: Omit<MeterReading, "id" | "createdAt" | "updatedAt">): Promise<MeterReading>;
  
  // Invoice operations
  getInvoices(tenantId: string): Promise<Invoice[]>;
  createInvoice(invoice: Omit<Invoice, "id" | "createdAt" | "updatedAt">): Promise<Invoice>;
  
  // User-Customer assignments for territory management
  getUserCustomerAssignments(userId: string, tenantId: string): Promise<UserCustomerAssignment[]>;
  createUserCustomerAssignment(assignment: Omit<UserCustomerAssignment, "id" | "createdAt">): Promise<UserCustomerAssignment>;
  
  // Product Management operations
  getProductModels(tenantId: string): Promise<ProductModel[]>;
  getProductModel(id: string, tenantId: string): Promise<ProductModel | undefined>;
  createProductModel(model: InsertProductModel): Promise<ProductModel>;
  updateProductModel(id: string, model: Partial<ProductModel>, tenantId: string): Promise<ProductModel | undefined>;
  
  getProductAccessories(modelId: string, tenantId: string): Promise<ProductAccessory[]>;
  createProductAccessory(accessory: InsertProductAccessory): Promise<ProductAccessory>;
  
  getCpcRates(modelId: string, tenantId: string): Promise<CpcRate[]>;
  createCpcRate(rate: InsertCpcRate): Promise<CpcRate>;
  
  // Contract Tiered Rates operations (for meter billing)
  getContractTieredRates(tenantId: string): Promise<ContractTieredRate[]>;
  getContractTieredRatesByContract(contractId: string): Promise<ContractTieredRate[]>;
  createContractTieredRate(rate: InsertContractTieredRate): Promise<ContractTieredRate>;
  
  // Enhanced meter reading operations
  getMeterReadingsByStatus(tenantId: string, status: string): Promise<MeterReading[]>;
  updateMeterReading(id: string, reading: Partial<MeterReading>, tenantId: string): Promise<MeterReading | undefined>;
  getContract(id: string, tenantId: string): Promise<Contract | undefined>;
  
  // Deal management operations
  getDeals(tenantId: string, stageId?: string, search?: string): Promise<any[]>;
  getDeal(id: string, tenantId: string): Promise<any>;
  createDeal(deal: any): Promise<any>;
  updateDeal(id: string, deal: Partial<any>, tenantId: string): Promise<any>;
  updateDealStage(id: string, stageId: string, tenantId: string): Promise<any>;
  
  // Deal stages operations
  getDealStages(tenantId: string): Promise<any[]>;
  createDealStage(stage: any): Promise<any>;
  updateDealStageById(id: string, stage: Partial<any>, tenantId: string): Promise<any>;
  
  // Deal activities operations
  getDealActivities(dealId: string, tenantId: string): Promise<any[]>;
  createDealActivity(activity: any): Promise<any>;

  // Purchase Order operations
  getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string, tenantId: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, po: Partial<PurchaseOrder>, tenantId: string): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string, tenantId: string): Promise<boolean>;
  
  // Purchase Order Items operations
  getPurchaseOrderItems(purchaseOrderId: string, tenantId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: string, item: Partial<PurchaseOrderItem>, tenantId: string): Promise<PurchaseOrderItem | undefined>;
  deletePurchaseOrderItem(id: string, tenantId: string): Promise<boolean>;
  
  // Vendor operations
  getVendors(tenantId: string): Promise<Vendor[]>;
  getVendor(id: string, tenantId: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<Vendor>, tenantId: string): Promise<Vendor | undefined>;
  deleteVendor(id: string, tenantId: string): Promise<boolean>;

  // Pricing System
  getCompanyPricingSettings(tenantId: string): Promise<CompanyPricingSetting | undefined>;
  updateCompanyPricingSettings(tenantId: string, settings: InsertCompanyPricingSetting): Promise<CompanyPricingSetting>;
  
  getProductPricing(tenantId: string): Promise<ProductPricing[]>;
  getProductPricingByProductId(productId: string, productType: string, tenantId: string): Promise<ProductPricing | undefined>;
  createProductPricing(pricing: InsertProductPricing): Promise<ProductPricing>;
  updateProductPricing(id: string, tenantId: string, pricing: Partial<InsertProductPricing>): Promise<ProductPricing | undefined>;
  deleteProductPricing(id: string, tenantId: string): Promise<boolean>;
  
  getQuotePricing(quoteId: string, tenantId: string): Promise<QuotePricing | undefined>;
  createQuotePricing(pricing: InsertQuotePricing): Promise<QuotePricing>;
  updateQuotePricing(id: string, tenantId: string, pricing: Partial<InsertQuotePricing>): Promise<QuotePricing | undefined>;
  
  getQuotePricingLineItems(quotePricingId: string, tenantId: string): Promise<QuotePricingLineItem[]>;
  createQuotePricingLineItem(lineItem: InsertQuotePricingLineItem): Promise<QuotePricingLineItem>;
  updateQuotePricingLineItem(id: string, tenantId: string, lineItem: Partial<InsertQuotePricingLineItem>): Promise<QuotePricingLineItem | undefined>;
  deleteQuotePricingLineItem(id: string, tenantId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // Update last login time
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return user;
  }

  // Tenant operations for platform users
  async getAllTenants(): Promise<{ id: string; name: string; domain?: string }[]> {
    const result = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        domain: tenants.domain,
      })
      .from(tenants)
      .orderBy(tenants.name);
    
    return result;
  }

  // Enhanced user operations with role information
  async getUserWithRole(id: string): Promise<(User & { role?: Role; team?: Team }) | undefined> {
    const result = await db
      .select({
        user: users,
        role: roles,
        team: teams,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(teams, eq(users.teamId, teams.id))
      .where(eq(users.id, id));

    if (!result.length) return undefined;

    const { user, role, team } = result[0];
    return { ...user, role: role || undefined, team: team || undefined };
  }

  // Role-based data access methods
  async getAccessibleCustomers(userId: string, tenantId: string, roleLevel: number, teamId?: string): Promise<Customer[]> {
    let query = db.select().from(customers).where(eq(customers.tenantId, tenantId));

    // Apply role-based filtering
    if (roleLevel === 1) { // Individual contributor - only assigned customers
      const assignedCustomerIds = await db
        .select({ customerId: userCustomerAssignments.customerId })
        .from(userCustomerAssignments)
        .where(and(
          eq(userCustomerAssignments.userId, userId),
          eq(userCustomerAssignments.tenantId, tenantId)
        ));
      
      if (assignedCustomerIds.length === 0) return [];
      
      query = query.where(inArray(customers.id, assignedCustomerIds.map(a => a.customerId)));
    } else if (roleLevel === 2 && teamId) { // Team lead - team's customers
      const teamUserIds = await db
        .select({ userId: users.id })
        .from(users)
        .where(and(
          eq(users.teamId, teamId),
          eq(users.tenantId, tenantId)
        ));

      const teamCustomerIds = await db
        .select({ customerId: userCustomerAssignments.customerId })
        .from(userCustomerAssignments)
        .where(and(
          inArray(userCustomerAssignments.userId, teamUserIds.map(u => u.userId)),
          eq(userCustomerAssignments.tenantId, tenantId)
        ));

      if (teamCustomerIds.length === 0) return [];
      
      query = query.where(inArray(customers.id, teamCustomerIds.map(a => a.customerId)));
    }
    // Level 3+ (Manager/Director/Admin) see all customers in tenant

    return await query;
  }

  async getAccessibleLeads(userId: string, tenantId: string, roleLevel: number, teamId?: string): Promise<Lead[]> {
    let query = db.select().from(leads).where(eq(leads.tenantId, tenantId));

    if (roleLevel === 1) { // Individual - only assigned leads
      query = query.where(eq(leads.assignedSalespersonId, userId));
    } else if (roleLevel === 2 && teamId) { // Team lead - team's leads
      const teamUserIds = await db
        .select({ userId: users.id })
        .from(users)
        .where(and(
          eq(users.teamId, teamId),
          eq(users.tenantId, tenantId)
        ));

      query = query.where(inArray(leads.assignedSalespersonId, teamUserIds.map(u => u.userId)));
    }

    return await query;
  }

  async getAccessibleServiceTickets(userId: string, tenantId: string, roleLevel: number, teamId?: string): Promise<ServiceTicket[]> {
    let query = db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId));

    if (roleLevel === 1) { // Individual technician - only assigned tickets
      query = query.where(or(
        eq(serviceTickets.assignedTechnicianId, userId),
        eq(serviceTickets.createdBy, userId)
      ));
    } else if (roleLevel === 2 && teamId) { // Team supervisor - team's tickets
      const teamTechnicianIds = await db
        .select({ technicianId: technicians.id })
        .from(technicians)
        .innerJoin(users, eq(technicians.userId, users.id))
        .where(and(
          eq(users.teamId, teamId),
          eq(users.tenantId, tenantId)
        ));

      if (teamTechnicianIds.length > 0) {
        query = query.where(inArray(serviceTickets.assignedTechnicianId, teamTechnicianIds.map(t => t.technicianId)));
      }
    }

    return await query;
  }

  async getAccessibleContracts(userId: string, tenantId: string, roleLevel: number, teamId?: string): Promise<Contract[]> {
    let query = db.select().from(contracts).where(eq(contracts.tenantId, tenantId));

    if (roleLevel === 1) { // Individual sales rep - only assigned contracts
      query = query.where(eq(contracts.assignedSalespersonId, userId));
    } else if (roleLevel === 2 && teamId) { // Team lead - team's contracts
      const teamUserIds = await db
        .select({ userId: users.id })
        .from(users)
        .where(and(
          eq(users.teamId, teamId),
          eq(users.tenantId, tenantId)
        ));

      query = query.where(inArray(contracts.assignedSalespersonId, teamUserIds.map(u => u.userId)));
    }

    return await query;
  }

  // Standard CRUD operations (existing methods with tenant filtering)
  async getCustomers(tenantId: string): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.tenantId, tenantId));
  }

  async getCustomer(id: string, tenantId: string): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
    return customer;
  }

  async createCustomer(customer: Omit<Customer, "id" | "createdAt" | "updatedAt">): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, customer: Partial<Customer>, tenantId: string): Promise<Customer | undefined> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Company operations (new primary business entity)
  async getCompanies(tenantId: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.tenantId, tenantId));
  }

  async getCompany(id: string, tenantId: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)));
    return company;
  }

  async createCompany(company: Omit<Company, "id" | "createdAt" | "updatedAt">): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: string, company: Partial<Company>, tenantId: string): Promise<Company | undefined> {
    const [updatedCompany] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)))
      .returning();
    return updatedCompany;
  }

  async deleteCompany(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(companies)
      .where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Company contact operations
  async getCompanyContacts(companyId: string, tenantId: string): Promise<CompanyContact[]> {
    return await db
      .select()
      .from(companyContacts)
      .where(and(eq(companyContacts.companyId, companyId), eq(companyContacts.tenantId, tenantId)));
  }

  async getCompanyContact(id: string, tenantId: string): Promise<CompanyContact | undefined> {
    const [contact] = await db
      .select()
      .from(companyContacts)
      .where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)));
    return contact;
  }

  async createCompanyContact(contact: Omit<CompanyContact, "id" | "createdAt" | "updatedAt">): Promise<CompanyContact> {
    const [newContact] = await db.insert(companyContacts).values(contact).returning();
    return newContact;
  }

  async updateCompanyContact(id: string, contact: Partial<CompanyContact>, tenantId: string): Promise<CompanyContact | undefined> {
    const [updatedContact] = await db
      .update(companyContacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)))
      .returning();
    return updatedContact;
  }

  async deleteCompanyContact(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(companyContacts)
      .where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Lead operations (simplified pipeline tracking)
  async getLeads(tenantId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.tenantId, tenantId));
  }

  async createLead(lead: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: string, lead: Partial<Lead>, tenantId: string): Promise<Lead | undefined> {
    const [updatedLead] = await db
      .update(leads)
      .set({ ...lead, updatedAt: new Date() })
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
      .returning();
    return updatedLead;
  }

  // Quote operations
  async getQuotes(tenantId: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(eq(quotes.tenantId, tenantId));
  }

  async createQuote(quote: Omit<Quote, "id" | "createdAt" | "updatedAt">): Promise<Quote> {
    const [newQuote] = await db.insert(quotes).values(quote).returning();
    return newQuote;
  }

  // Equipment operations
  async getEquipment(tenantId: string): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.tenantId, tenantId));
  }

  async createEquipment(equipmentData: Omit<Equipment, "id" | "createdAt" | "updatedAt">): Promise<Equipment> {
    const [newEquipment] = await db.insert(equipment).values(equipmentData).returning();
    return newEquipment;
  }

  // Contract operations
  async getContracts(tenantId: string): Promise<Contract[]> {
    return await db.select().from(contracts).where(eq(contracts.tenantId, tenantId));
  }

  async createContract(contract: Omit<Contract, "id" | "createdAt" | "updatedAt">): Promise<Contract> {
    const [newContract] = await db.insert(contracts).values(contract).returning();
    return newContract;
  }

  // Service ticket operations
  async getServiceTickets(tenantId: string): Promise<ServiceTicket[]> {
    return await db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId));
  }

  async createServiceTicket(ticket: Omit<ServiceTicket, "id" | "createdAt" | "updatedAt">): Promise<ServiceTicket> {
    const [newTicket] = await db.insert(serviceTickets).values(ticket).returning();
    return newTicket;
  }

  async updateServiceTicket(id: string, ticket: Partial<ServiceTicket>, tenantId: string): Promise<ServiceTicket | undefined> {
    const [updatedTicket] = await db
      .update(serviceTickets)
      .set({ ...ticket, updatedAt: new Date() })
      .where(and(eq(serviceTickets.id, id), eq(serviceTickets.tenantId, tenantId)))
      .returning();
    return updatedTicket;
  }

  // Inventory operations
  async getInventoryItems(tenantId: string): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId));
  }

  async createInventoryItem(item: Omit<InventoryItem, "id" | "createdAt" | "updatedAt">): Promise<InventoryItem> {
    const [newItem] = await db.insert(inventoryItems).values(item).returning();
    return newItem;
  }

  // Technician operations
  async getTechnicians(tenantId: string): Promise<Technician[]> {
    return await db.select().from(technicians).where(eq(technicians.tenantId, tenantId));
  }

  async createTechnician(technician: Omit<Technician, "id" | "createdAt" | "updatedAt">): Promise<Technician> {
    const [newTechnician] = await db.insert(technicians).values(technician).returning();
    return newTechnician;
  }

  // Meter reading operations
  async getMeterReadings(tenantId: string): Promise<MeterReading[]> {
    return await db.select().from(meterReadings).where(eq(meterReadings.tenantId, tenantId));
  }

  async createMeterReading(reading: Omit<MeterReading, "id" | "createdAt" | "updatedAt">): Promise<MeterReading> {
    const [newReading] = await db.insert(meterReadings).values(reading).returning();
    return newReading;
  }

  async getMeterReadingsByStatus(tenantId: string, status: string): Promise<MeterReading[]> {
    return await db
      .select()
      .from(meterReadings)
      .where(and(
        eq(meterReadings.tenantId, tenantId),
        eq(meterReadings.billingStatus, status)
      ));
  }

  async updateMeterReading(id: string, reading: Partial<MeterReading>, tenantId: string): Promise<MeterReading | undefined> {
    const [updatedReading] = await db
      .update(meterReadings)
      .set({ ...reading, updatedAt: new Date() })
      .where(and(eq(meterReadings.id, id), eq(meterReadings.tenantId, tenantId)))
      .returning();
    return updatedReading;
  }

  async getContract(id: string, tenantId: string): Promise<Contract | undefined> {
    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId)));
    return contract;
  }

  // Invoice operations
  async getInvoices(tenantId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.tenantId, tenantId));
  }

  async createInvoice(invoice: Omit<Invoice, "id" | "createdAt" | "updatedAt">): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  // User-Customer assignment operations for territory management
  async getUserCustomerAssignments(userId: string, tenantId: string): Promise<UserCustomerAssignment[]> {
    return await db
      .select()
      .from(userCustomerAssignments)
      .where(and(
        eq(userCustomerAssignments.userId, userId),
        eq(userCustomerAssignments.tenantId, tenantId)
      ));
  }

  async createUserCustomerAssignment(assignment: Omit<UserCustomerAssignment, "id" | "createdAt">): Promise<UserCustomerAssignment> {
    const [newAssignment] = await db.insert(userCustomerAssignments).values(assignment).returning();
    return newAssignment;
  }

  // Enhanced Lead CRM operations
  async getLead(id: string, tenantId: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)));
    return lead;
  }

  async convertLeadToCustomer(leadId: string, tenantId: string): Promise<Customer> {
    const lead = await this.getLead(leadId, tenantId);
    if (!lead) throw new Error('Lead not found');

    // Create customer from lead data
    const customerData = {
      tenantId,
      name: lead.businessName,
      email: lead.email,
      phone: lead.phone,
      address: `${lead.billingAddress}, ${lead.billingCity}, ${lead.billingState} ${lead.billingZip}`,
      contactPerson: lead.contactName,
      accountValue: lead.estimatedValue || null,
    };

    const [newCustomer] = await db.insert(customers).values(customerData).returning();

    // Update lead status to converted and set customer details
    await this.updateLead(leadId, {
      recordType: 'customer',
      status: 'closed_won',
      customerNumber: newCustomer.id,
      customerSince: new Date(),
    }, tenantId);

    return newCustomer;
  }

  // Lead activity operations
  async getLeadActivities(leadId: string, tenantId: string): Promise<LeadActivity[]> {
    return await db
      .select()
      .from(leadActivities)
      .where(and(eq(leadActivities.leadId, leadId), eq(leadActivities.tenantId, tenantId)))
      .orderBy(sql`${leadActivities.createdAt} DESC`);
  }

  async createLeadActivity(activity: Omit<LeadActivity, "id" | "createdAt" | "updatedAt">): Promise<LeadActivity> {
    const [newActivity] = await db.insert(leadActivities).values(activity).returning();
    return newActivity;
  }

  // Lead contact operations
  async getLeadContacts(leadId: string, tenantId: string): Promise<LeadContact[]> {
    return await db
      .select()
      .from(leadContacts)
      .where(and(eq(leadContacts.leadId, leadId), eq(leadContacts.tenantId, tenantId)));
  }

  async createLeadContact(contact: Omit<LeadContact, "id" | "createdAt" | "updatedAt">): Promise<LeadContact> {
    const [newContact] = await db.insert(leadContacts).values(contact).returning();
    return newContact;
  }

  // Lead related records operations
  async getLeadRelatedRecords(leadId: string, tenantId: string): Promise<LeadRelatedRecord[]> {
    return await db
      .select()
      .from(leadRelatedRecords)
      .where(and(eq(leadRelatedRecords.leadId, leadId), eq(leadRelatedRecords.tenantId, tenantId)));
  }

  async createLeadRelatedRecord(record: Omit<LeadRelatedRecord, "id" | "createdAt">): Promise<LeadRelatedRecord> {
    const [newRecord] = await db.insert(leadRelatedRecords).values(record).returning();
    return newRecord;
  }

  // Product Management Implementation
  async getProductModels(tenantId: string): Promise<ProductModel[]> {
    return await db
      .select()
      .from(productModels)
      .where(eq(productModels.tenantId, tenantId))
      .orderBy(productModels.productName);
  }

  async getProductModel(id: string, tenantId: string): Promise<ProductModel | undefined> {
    const [model] = await db
      .select()
      .from(productModels)
      .where(and(eq(productModels.id, id), eq(productModels.tenantId, tenantId)));
    return model;
  }

  async createProductModel(model: InsertProductModel): Promise<ProductModel> {
    const [result] = await db
      .insert(productModels)
      .values(model)
      .returning();
    return result;
  }

  async updateProductModel(id: string, model: Partial<ProductModel>, tenantId: string): Promise<ProductModel | undefined> {
    const [result] = await db
      .update(productModels)
      .set({ ...model, updatedAt: new Date() })
      .where(and(eq(productModels.id, id), eq(productModels.tenantId, tenantId)))
      .returning();
    return result;
  }

  async getAllProductAccessories(tenantId: string): Promise<ProductAccessory[]> {
    return await db
      .select()
      .from(productAccessories)
      .where(eq(productAccessories.tenantId, tenantId))
      .orderBy(productAccessories.accessoryName);
  }

  async getProductAccessories(modelId: string, tenantId: string): Promise<ProductAccessory[]> {
    return await db
      .select()
      .from(productAccessories)
      .where(and(eq(productAccessories.modelId, modelId), eq(productAccessories.tenantId, tenantId)))
      .orderBy(productAccessories.accessoryName);
  }

  async createProductAccessory(accessory: InsertProductAccessory): Promise<ProductAccessory> {
    const [result] = await db
      .insert(productAccessories)
      .values(accessory)
      .returning();
    return result;
  }

  async updateProductAccessory(id: string, accessory: Partial<ProductAccessory>, tenantId: string): Promise<ProductAccessory | undefined> {
    const [result] = await db
      .update(productAccessories)
      .set({ ...accessory, updatedAt: new Date() })
      .where(and(eq(productAccessories.id, id), eq(productAccessories.tenantId, tenantId)))
      .returning();
    return result;
  }

  async getCpcRates(modelId: string, tenantId: string): Promise<CpcRate[]> {
    return await db
      .select()
      .from(cpcRates)
      .where(and(eq(cpcRates.modelId, modelId), eq(cpcRates.tenantId, tenantId)))
      .orderBy(cpcRates.colorType);
  }

  async createCpcRate(rate: InsertCpcRate): Promise<CpcRate> {
    const [result] = await db
      .insert(cpcRates)
      .values(rate)
      .returning();
    return result;
  }

  // Contract Tiered Rates operations (for meter billing)
  async getContractTieredRates(tenantId: string): Promise<ContractTieredRate[]> {
    return await db
      .select()
      .from(contractTieredRates)
      .where(eq(contractTieredRates.tenantId, tenantId))
      .orderBy(contractTieredRates.sortOrder);
  }

  async getContractTieredRatesByContract(contractId: string): Promise<ContractTieredRate[]> {
    return await db
      .select()
      .from(contractTieredRates)
      .where(eq(contractTieredRates.contractId, contractId))
      .orderBy(contractTieredRates.sortOrder);
  }

  async createContractTieredRate(rate: InsertContractTieredRate): Promise<ContractTieredRate> {
    const [result] = await db
      .insert(contractTieredRates)
      .values(rate)
      .returning();
    return result;
  }

  // ============= TASK MANAGEMENT OPERATIONS =============
  
  async getTasks(tenantId: string, userId?: string): Promise<Task[]> {
    let query = db
      .select()
      .from(tasks)
      .where(eq(tasks.tenantId, tenantId));
    
    if (userId) {
      query = query.where(eq(tasks.assignedTo, userId));
    }
    
    return await query
      .orderBy(desc(tasks.createdAt))
      .limit(50);
  }

  async getTask(id: string, tenantId: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [result] = await db
      .insert(tasks)
      .values(task)
      .returning();
    return result;
  }

  async updateTask(id: string, task: Partial<Task>, tenantId: string): Promise<Task | undefined> {
    const [result] = await db
      .update(tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
      .returning();
    return result;
  }

  async getTaskStats(tenantId: string, userId?: string): Promise<any> {
    let baseQuery = db
      .select({
        status: tasks.status,
        count: sql<number>`COUNT(*)`,
        avgHours: sql<number>`AVG(${tasks.actualHours})`
      })
      .from(tasks)
      .where(eq(tasks.tenantId, tenantId));
    
    if (userId) {
      baseQuery = baseQuery.where(eq(tasks.assignedTo, userId));
    }
    
    const results = await baseQuery.groupBy(tasks.status);
    
    const stats = {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      overdueTasks: 0,
      myTasks: userId ? results.reduce((sum, r) => sum + r.count, 0) : 0,
      avgCompletionTime: 0
    };
    
    results.forEach(result => {
      stats.totalTasks += result.count;
      if (result.status === 'completed') {
        stats.completedTasks = result.count;
        stats.avgCompletionTime = result.avgHours || 0;
      } else if (result.status === 'in_progress') {
        stats.inProgressTasks = result.count;
      }
    });
    
    // Get overdue tasks
    const overdueCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(and(
        eq(tasks.tenantId, tenantId),
        lt(tasks.dueDate, new Date()),
        ne(tasks.status, 'completed')
      ));
    
    stats.overdueTasks = overdueCount[0]?.count || 0;
    
    return stats;
  }

  async getProjects(tenantId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.tenantId, tenantId))
      .orderBy(desc(projects.createdAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [result] = await db
      .insert(projects)
      .values(project)
      .returning();
    return result;
  }

  // ============= PERFORMANCE MONITORING OPERATIONS =============
  
  async getPerformanceMetrics(tenantId?: string): Promise<any> {
    // Get latest metrics grouped by type
    const metrics = await db
      .select({
        metricType: performanceMetrics.metricType,
        value: sql<number>`AVG(${performanceMetrics.value})`,
        unit: performanceMetrics.unit
      })
      .from(performanceMetrics)
      .where(tenantId ? eq(performanceMetrics.tenantId, tenantId) : sql`TRUE`)
      .where(gte(performanceMetrics.timestamp, new Date(Date.now() - 60 * 60 * 1000))) // Last hour
      .groupBy(performanceMetrics.metricType, performanceMetrics.unit);

    const result = {
      avg_response_time: 0,
      total_requests: 0,
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      active_issues: 0
    };

    metrics.forEach(metric => {
      switch (metric.metricType) {
        case 'response_time':
          result.avg_response_time = metric.value;
          break;
        case 'cpu_usage':
          result.cpu_usage = metric.value;
          break;
        case 'memory_usage':
          result.memory_usage = metric.value;
          break;
        case 'disk_usage':
          result.disk_usage = metric.value;
          break;
        case 'throughput':
          result.total_requests = metric.value;
          break;
      }
    });

    // Get active issues count
    const [activeIssues] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(systemAlerts)
      .where(and(
        tenantId ? eq(systemAlerts.tenantId, tenantId) : sql`TRUE`,
        eq(systemAlerts.resolved, false),
        ne(systemAlerts.type, 'info')
      ));

    result.active_issues = activeIssues?.count || 0;

    return result;
  }

  async getSystemAlerts(tenantId?: string): Promise<SystemAlert[]> {
    return await db
      .select()
      .from(systemAlerts)
      .where(tenantId ? eq(systemAlerts.tenantId, tenantId) : sql`TRUE`)
      .where(gte(systemAlerts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))) // Last 24 hours
      .orderBy(desc(systemAlerts.createdAt))
      .limit(10);
  }

  async createSystemAlert(alert: InsertSystemAlert): Promise<SystemAlert> {
    const [result] = await db
      .insert(systemAlerts)
      .values(alert)
      .returning();
    return result;
  }

  async recordPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    const [result] = await db
      .insert(performanceMetrics)
      .values(metric)
      .returning();
    return result;
  }

  // ============= SYSTEM INTEGRATIONS OPERATIONS =============
  
  async getSystemIntegrations(tenantId?: string): Promise<SystemIntegration[]> {
    return await db
      .select()
      .from(systemIntegrations)
      .where(tenantId ? eq(systemIntegrations.tenantId, tenantId) : sql`TRUE`)
      .orderBy(systemIntegrations.name);
  }

  async createSystemIntegration(integration: InsertSystemIntegration): Promise<SystemIntegration> {
    const [result] = await db
      .insert(systemIntegrations)
      .values(integration)
      .returning();
    return result;
  }

  async updateSystemIntegration(id: string, integration: Partial<SystemIntegration>, tenantId?: string): Promise<SystemIntegration | undefined> {
    const [result] = await db
      .update(systemIntegrations)
      .set({ ...integration, updatedAt: new Date() })
      .where(and(
        eq(systemIntegrations.id, id),
        tenantId ? eq(systemIntegrations.tenantId, tenantId) : sql`TRUE`
      ))
      .returning();
    return result;
  }

  // Professional Services
  async getAllProfessionalServices(tenantId: string): Promise<ProfessionalService[]> {
    return await db
      .select()
      .from(professionalServices)
      .where(eq(professionalServices.tenantId, tenantId))
      .orderBy(professionalServices.productName);
  }

  async createProfessionalService(service: InsertProfessionalService): Promise<ProfessionalService> {
    const [result] = await db
      .insert(professionalServices)
      .values(service)
      .returning();
    return result;
  }

  // Service Products
  async getAllServiceProducts(tenantId: string): Promise<ServiceProduct[]> {
    return await db
      .select()
      .from(serviceProducts)
      .where(eq(serviceProducts.tenantId, tenantId))
      .orderBy(serviceProducts.productName);
  }

  async createServiceProduct(service: InsertServiceProduct): Promise<ServiceProduct> {
    const [result] = await db
      .insert(serviceProducts)
      .values(service)
      .returning();
    return result;
  }

  // Software Products
  async getAllSoftwareProducts(tenantId: string): Promise<SoftwareProduct[]> {
    return await db
      .select()
      .from(softwareProducts)
      .where(eq(softwareProducts.tenantId, tenantId))
      .orderBy(softwareProducts.productName);
  }

  async createSoftwareProduct(product: InsertSoftwareProduct): Promise<SoftwareProduct> {
    const [result] = await db
      .insert(softwareProducts)
      .values(product)
      .returning();
    return result;
  }

  // Supplies
  async getAllSupplies(tenantId: string): Promise<Supply[]> {
    return await db
      .select()
      .from(supplies)
      .where(eq(supplies.tenantId, tenantId))
      .orderBy(supplies.productName);
  }

  async createSupply(supply: InsertSupply): Promise<Supply> {
    const [result] = await db
      .insert(supplies)
      .values(supply)
      .returning();
    return result;
  }

  // Managed Services
  async getAllManagedServices(tenantId: string): Promise<ManagedService[]> {
    return await db
      .select()
      .from(managedServices)
      .where(eq(managedServices.tenantId, tenantId))
      .orderBy(managedServices.productName);
  }

  async createManagedService(service: InsertManagedService): Promise<ManagedService> {
    const [result] = await db
      .insert(managedServices)
      .values(service)
      .returning();
    return result;
  }

  // Contact operations (used for company contacts)
  async createContact(contact: Omit<LeadContact, "id" | "createdAt" | "updatedAt">): Promise<LeadContact> {
    const [result] = await db
      .insert(leadContacts)
      .values({
        ...contact,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  async getContactsByCompany(companyId: string, tenantId: string): Promise<LeadContact[]> {
    return await db
      .select()
      .from(leadContacts)
      .where(and(
        eq(leadContacts.leadId, companyId), // Using leadId as companyId for now
        eq(leadContacts.tenantId, tenantId)
      ))
      .orderBy(leadContacts.firstName, leadContacts.lastName);
  }

  async updateContact(contactId: string, contact: Partial<LeadContact>): Promise<LeadContact> {
    const [result] = await db
      .update(leadContacts)
      .set({
        ...contact,
        updatedAt: new Date(),
      })
      .where(eq(leadContacts.id, contactId))
      .returning();
    return result;
  }

  async deleteContact(contactId: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(leadContacts)
      .where(and(
        eq(leadContacts.id, contactId),
        eq(leadContacts.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }

  // ============= ACCOUNTING OPERATIONS =============
  
  // Vendor operations
  async getVendors(tenantId: string): Promise<Vendor[]> {
    return await db.select().from(vendors).where(eq(vendors.tenantId, tenantId));
  }

  async getVendor(id: string, tenantId: string): Promise<Vendor | undefined> {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)));
    return vendor;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: string, vendor: Partial<Vendor>, tenantId: string): Promise<Vendor | undefined> {
    const [updatedVendor] = await db
      .update(vendors)
      .set({ ...vendor, updatedAt: new Date() })
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)))
      .returning();
    return updatedVendor;
  }

  async deleteVendor(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Accounts Payable operations
  async getAccountsPayable(tenantId: string): Promise<AccountsPayable[]> {
    return await db.select().from(accountsPayable).where(eq(accountsPayable.tenantId, tenantId));
  }

  async getAccountPayable(id: string, tenantId: string): Promise<AccountsPayable | undefined> {
    const [ap] = await db
      .select()
      .from(accountsPayable)
      .where(and(eq(accountsPayable.id, id), eq(accountsPayable.tenantId, tenantId)));
    return ap;
  }

  async createAccountsPayable(ap: InsertAccountsPayable): Promise<AccountsPayable> {
    const [newAP] = await db.insert(accountsPayable).values(ap).returning();
    return newAP;
  }

  async updateAccountsPayable(id: string, ap: Partial<AccountsPayable>, tenantId: string): Promise<AccountsPayable | undefined> {
    const [updatedAP] = await db
      .update(accountsPayable)
      .set({ ...ap, updatedAt: new Date() })
      .where(and(eq(accountsPayable.id, id), eq(accountsPayable.tenantId, tenantId)))
      .returning();
    return updatedAP;
  }

  // Accounts Receivable operations
  async getAccountsReceivable(tenantId: string): Promise<AccountsReceivable[]> {
    return await db.select().from(accountsReceivable).where(eq(accountsReceivable.tenantId, tenantId));
  }

  async getAccountReceivable(id: string, tenantId: string): Promise<AccountsReceivable | undefined> {
    const [ar] = await db
      .select()
      .from(accountsReceivable)
      .where(and(eq(accountsReceivable.id, id), eq(accountsReceivable.tenantId, tenantId)));
    return ar;
  }

  async createAccountsReceivable(ar: InsertAccountsReceivable): Promise<AccountsReceivable> {
    const [newAR] = await db.insert(accountsReceivable).values(ar).returning();
    return newAR;
  }

  async updateAccountsReceivable(id: string, ar: Partial<AccountsReceivable>, tenantId: string): Promise<AccountsReceivable | undefined> {
    const [updatedAR] = await db
      .update(accountsReceivable)
      .set({ ...ar, updatedAt: new Date() })
      .where(and(eq(accountsReceivable.id, id), eq(accountsReceivable.tenantId, tenantId)))
      .returning();
    return updatedAR;
  }

  // Chart of Accounts operations
  async getChartOfAccounts(tenantId: string): Promise<ChartOfAccount[]> {
    return await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.tenantId, tenantId));
  }

  async getChartOfAccount(id: string, tenantId: string): Promise<ChartOfAccount | undefined> {
    const [account] = await db
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.tenantId, tenantId)));
    return account;
  }

  async createChartOfAccount(account: InsertChartOfAccount): Promise<ChartOfAccount> {
    const [newAccount] = await db.insert(chartOfAccounts).values(account).returning();
    return newAccount;
  }

  async updateChartOfAccount(id: string, account: Partial<ChartOfAccount>, tenantId: string): Promise<ChartOfAccount | undefined> {
    const [updatedAccount] = await db
      .update(chartOfAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.tenantId, tenantId)))
      .returning();
    return updatedAccount;
  }

  // Purchase Order operations
  async getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId));
  }

  async getPurchaseOrder(id: string, tenantId: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
    return po;
  }

  async createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [newPO] = await db.insert(purchaseOrders).values(po).returning();
    return newPO;
  }

  async updatePurchaseOrder(id: string, po: Partial<PurchaseOrder>, tenantId: string): Promise<PurchaseOrder | undefined> {
    const [updatedPO] = await db
      .update(purchaseOrders)
      .set({ ...po, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))
      .returning();
    return updatedPO;
  }

  async getPurchaseOrderItems(purchaseOrderId: string, tenantId: string): Promise<PurchaseOrderItem[]> {
    return await db
      .select()
      .from(purchaseOrderItems)
      .where(and(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId), eq(purchaseOrderItems.tenantId, tenantId)));
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [newItem] = await db.insert(purchaseOrderItems).values(item).returning();
    return newItem;
  }

  async updatePurchaseOrderItem(id: string, item: Partial<PurchaseOrderItem>, tenantId: string): Promise<PurchaseOrderItem | undefined> {
    const [updatedItem] = await db
      .update(purchaseOrderItems)
      .set(item)
      .where(and(eq(purchaseOrderItems.id, id), eq(purchaseOrderItems.tenantId, tenantId)))
      .returning();
    return updatedItem;
  }

  async deletePurchaseOrder(id: string, tenantId: string): Promise<boolean> {
    // First delete all line items
    await db
      .delete(purchaseOrderItems)
      .where(and(eq(purchaseOrderItems.purchaseOrderId, id), eq(purchaseOrderItems.tenantId, tenantId)));
    
    // Then delete the purchase order
    const result = await db
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
    
    return result.rowCount > 0;
  }

  async deletePurchaseOrderItem(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(purchaseOrderItems)
      .where(and(eq(purchaseOrderItems.id, id), eq(purchaseOrderItems.tenantId, tenantId)));
    
    return result.rowCount > 0;
  }

  // Vendor operations
  async getVendors(tenantId: string): Promise<Vendor[]> {
    return await db
      .select()
      .from(vendors)
      .where(eq(vendors.tenantId, tenantId))
      .orderBy(vendors.companyName);
  }

  async getVendor(id: string, tenantId: string): Promise<Vendor | undefined> {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)));
    return vendor;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: string, vendor: Partial<Vendor>, tenantId: string): Promise<Vendor | undefined> {
    const [updatedVendor] = await db
      .update(vendors)
      .set({ ...vendor, updatedAt: new Date() })
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)))
      .returning();
    return updatedVendor;
  }

  async deleteVendor(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)));
    
    return result.rowCount > 0;
  }

  // Deal management operations
  async getDeals(tenantId: string, stageId?: string, search?: string): Promise<any[]> {
    let query = db
      .select({
        id: deals.id,
        title: deals.title,
        description: deals.description,
        amount: deals.amount,
        companyName: deals.companyName,
        primaryContactName: deals.primaryContactName,
        primaryContactEmail: deals.primaryContactEmail,
        primaryContactPhone: deals.primaryContactPhone,
        source: deals.source,
        dealType: deals.dealType,
        priority: deals.priority,
        expectedCloseDate: deals.expectedCloseDate,
        productsInterested: deals.productsInterested,
        estimatedMonthlyValue: deals.estimatedMonthlyValue,
        notes: deals.notes,
        status: deals.status,
        probability: deals.probability,
        stageId: deals.stageId,
        stageName: dealStages.name,
        stageColor: dealStages.color,
        ownerId: deals.ownerId,
        ownerName: users.firstName,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(dealStages, eq(deals.stageId, dealStages.id))
      .leftJoin(users, eq(deals.ownerId, users.id))
      .where(eq(deals.tenantId, tenantId));

    if (stageId) {
      query = query.where(eq(deals.stageId, stageId));
    }

    if (search) {
      query = query.where(
        or(
          like(deals.title, `%${search}%`),
          like(deals.companyName, `%${search}%`),
          like(deals.primaryContactName, `%${search}%`)
        )
      );
    }

    return await query.orderBy(desc(deals.createdAt));
  }

  async getDeal(id: string, tenantId: string): Promise<any> {
    const [deal] = await db
      .select({
        id: deals.id,
        title: deals.title,
        description: deals.description,
        amount: deals.amount,
        companyName: deals.companyName,
        primaryContactName: deals.primaryContactName,
        primaryContactEmail: deals.primaryContactEmail,
        primaryContactPhone: deals.primaryContactPhone,
        source: deals.source,
        dealType: deals.dealType,
        priority: deals.priority,
        expectedCloseDate: deals.expectedCloseDate,
        productsInterested: deals.productsInterested,
        estimatedMonthlyValue: deals.estimatedMonthlyValue,
        notes: deals.notes,
        status: deals.status,
        probability: deals.probability,
        stageId: deals.stageId,
        stageName: dealStages.name,
        stageColor: dealStages.color,
        ownerId: deals.ownerId,
        ownerName: users.firstName,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(dealStages, eq(deals.stageId, dealStages.id))
      .leftJoin(users, eq(deals.ownerId, users.id))
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)));
    return deal;
  }

  async createDeal(deal: any): Promise<any> {
    // Get the first stage for this tenant as default
    const [defaultStage] = await db
      .select()
      .from(dealStages)
      .where(eq(dealStages.tenantId, deal.tenantId))
      .orderBy(dealStages.sortOrder)
      .limit(1);

    const dealData = {
      ...deal,
      stageId: deal.stageId || defaultStage?.id,
      status: "open",
      probability: 50,
    };

    const [newDeal] = await db.insert(deals).values(dealData).returning();
    return newDeal;
  }

  async updateDeal(id: string, deal: Partial<any>, tenantId: string): Promise<any> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ ...deal, updatedAt: new Date() })
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
      .returning();
    return updatedDeal;
  }

  async updateDealStage(id: string, stageId: string, tenantId: string): Promise<any> {
    // Check if the new stage is a closing stage
    const [stage] = await db
      .select()
      .from(dealStages)
      .where(eq(dealStages.id, stageId));

    const updateData: any = {
      stageId,
      updatedAt: new Date(),
    };

    if (stage?.isClosingStage) {
      updateData.status = stage.isWonStage ? "won" : "lost";
      updateData.actualCloseDate = new Date();
      updateData.probability = stage.isWonStage ? 100 : 0;
    }

    const [updatedDeal] = await db
      .update(deals)
      .set(updateData)
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
      .returning();

    // Create activity record for stage change
    await this.createDealActivity({
      tenantId,
      dealId: id,
      type: "stage_change",
      subject: `Deal moved to ${stage?.name}`,
      description: `Deal stage changed to ${stage?.name}`,
      userId: updatedDeal?.ownerId || "", // In real app, get from request context
      previousValue: JSON.stringify({ stageId: updatedDeal?.stageId }),
      newValue: JSON.stringify({ stageId }),
    });

    return updatedDeal;
  }

  // Deal stages operations
  async getDealStages(tenantId: string): Promise<any[]> {
    return await db
      .select({
        id: dealStages.id,
        tenantId: dealStages.tenantId,
        name: dealStages.name,
        description: dealStages.description,
        color: dealStages.color,
        sortOrder: dealStages.sortOrder,
        isActive: dealStages.isActive,
        isClosingStage: dealStages.isClosingStage,
        isWonStage: dealStages.isWonStage,
        createdAt: dealStages.createdAt,
        updatedAt: dealStages.updatedAt,
      })
      .from(dealStages)
      .where(and(eq(dealStages.tenantId, tenantId), eq(dealStages.isActive, true)))
      .orderBy(dealStages.sortOrder);
  }

  async createDealStage(stage: any): Promise<any> {
    const [newStage] = await db.insert(dealStages).values(stage).returning();
    return newStage;
  }

  async updateDealStageById(id: string, stage: Partial<any>, tenantId: string): Promise<any> {
    const [updatedStage] = await db
      .update(dealStages)
      .set({ ...stage, updatedAt: new Date() })
      .where(and(eq(dealStages.id, id), eq(dealStages.tenantId, tenantId)))
      .returning();
    return updatedStage;
  }

  // Deal activities operations
  async getDealActivities(dealId: string, tenantId: string): Promise<any[]> {
    return await db
      .select({
        id: dealActivities.id,
        type: dealActivities.type,
        subject: dealActivities.subject,
        description: dealActivities.description,
        duration: dealActivities.duration,
        outcome: dealActivities.outcome,
        userId: dealActivities.userId,
        userName: users.firstName,
        createdAt: dealActivities.createdAt,
      })
      .from(dealActivities)
      .leftJoin(users, eq(dealActivities.userId, users.id))
      .where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)))
      .orderBy(desc(dealActivities.createdAt));
  }

  async createDealActivity(activity: any): Promise<any> {
    const [newActivity] = await db.insert(dealActivities).values(activity).returning();
    return newActivity;
  }

  // Pricing System Implementation
  async getCompanyPricingSettings(tenantId: string): Promise<CompanyPricingSetting | undefined> {
    const [settings] = await db
      .select()
      .from(companyPricingSettings)
      .where(and(
        eq(companyPricingSettings.tenantId, tenantId),
        eq(companyPricingSettings.isActive, true)
      ));
    return settings;
  }

  async updateCompanyPricingSettings(tenantId: string, settingsData: InsertCompanyPricingSetting): Promise<CompanyPricingSetting> {
    // Try to update existing settings first
    const existing = await this.getCompanyPricingSettings(tenantId);
    
    if (existing) {
      const [updated] = await db
        .update(companyPricingSettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(companyPricingSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(companyPricingSettings)
        .values({ ...settingsData, tenantId })
        .returning();
      return created;
    }
  }

  async getProductPricing(tenantId: string): Promise<ProductPricing[]> {
    return await db
      .select()
      .from(productPricing)
      .where(eq(productPricing.tenantId, tenantId))
      .orderBy(desc(productPricing.createdAt));
  }

  async getProductPricingByProductId(productId: string, productType: string, tenantId: string): Promise<ProductPricing | undefined> {
    const [pricing] = await db
      .select()
      .from(productPricing)
      .where(and(
        eq(productPricing.productId, productId),
        eq(productPricing.productType, productType),
        eq(productPricing.tenantId, tenantId),
        eq(productPricing.isActive, true)
      ));
    return pricing;
  }

  async createProductPricing(pricingData: InsertProductPricing): Promise<ProductPricing> {
    const [created] = await db
      .insert(productPricing)
      .values(pricingData)
      .returning();
    return created;
  }

  async updateProductPricing(id: string, tenantId: string, pricingData: Partial<InsertProductPricing>): Promise<ProductPricing | undefined> {
    const [updated] = await db
      .update(productPricing)
      .set({ ...pricingData, updatedAt: new Date() })
      .where(and(
        eq(productPricing.id, id),
        eq(productPricing.tenantId, tenantId)
      ))
      .returning();
    return updated;
  }

  async deleteProductPricing(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(productPricing)
      .where(and(
        eq(productPricing.id, id),
        eq(productPricing.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }

  async getQuotePricing(quoteId: string, tenantId: string): Promise<QuotePricing | undefined> {
    const [pricing] = await db
      .select()
      .from(quotePricing)
      .where(and(
        or(
          eq(quotePricing.leadId, quoteId),
          eq(quotePricing.customerId, quoteId),
          eq(quotePricing.quoteNumber, quoteId)
        ),
        eq(quotePricing.tenantId, tenantId)
      ));
    return pricing;
  }

  async createQuotePricing(pricingData: InsertQuotePricing): Promise<QuotePricing> {
    const [created] = await db
      .insert(quotePricing)
      .values(pricingData)
      .returning();
    return created;
  }

  async updateQuotePricing(id: string, tenantId: string, pricingData: Partial<InsertQuotePricing>): Promise<QuotePricing | undefined> {
    const [updated] = await db
      .update(quotePricing)
      .set({ ...pricingData, updatedAt: new Date() })
      .where(and(
        eq(quotePricing.id, id),
        eq(quotePricing.tenantId, tenantId)
      ))
      .returning();
    return updated;
  }

  async getQuotePricingLineItems(quotePricingId: string, tenantId: string): Promise<QuotePricingLineItem[]> {
    return await db
      .select()
      .from(quotePricingLineItems)
      .where(and(
        eq(quotePricingLineItems.quotePricingId, quotePricingId),
        eq(quotePricingLineItems.tenantId, tenantId)
      ))
      .orderBy(asc(quotePricingLineItems.lineNumber));
  }

  async createQuotePricingLineItem(lineItemData: InsertQuotePricingLineItem): Promise<QuotePricingLineItem> {
    const [created] = await db
      .insert(quotePricingLineItems)
      .values(lineItemData)
      .returning();
    return created;
  }

  async updateQuotePricingLineItem(id: string, tenantId: string, lineItemData: Partial<InsertQuotePricingLineItem>): Promise<QuotePricingLineItem | undefined> {
    const [updated] = await db
      .update(quotePricingLineItems)
      .set({ ...lineItemData, updatedAt: new Date() })
      .where(and(
        eq(quotePricingLineItems.id, id),
        eq(quotePricingLineItems.tenantId, tenantId)
      ))
      .returning();
    return updated;
  }

  async deleteQuotePricingLineItem(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(quotePricingLineItems)
      .where(and(
        eq(quotePricingLineItems.id, id),
        eq(quotePricingLineItems.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();