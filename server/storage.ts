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
  type InsertProductModel,
  type InsertProductAccessory,
  type InsertCpcRate,
  type InsertProfessionalService,
  type InsertServiceProduct,
  type InsertSoftwareProduct,
  type InsertSupply,
  type InsertManagedService,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, inArray, sql } from "drizzle-orm";
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
}

export const storage = new DatabaseStorage();