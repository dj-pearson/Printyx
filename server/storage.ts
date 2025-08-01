import {
  users,
  roles,
  teams,
  tenants,
  userCustomerAssignments,
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
  type User,
  type UpsertUser,
  type InsertUser,
  type Role,
  type Team,
  type UserCustomerAssignment,
  type Lead,
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
  
  // Lead operations with RBAC
  getLeads(tenantId: string): Promise<Lead[]>;
  getLead(id: string, tenantId: string): Promise<Lead | undefined>;
  createLead(lead: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead>;
  updateLead(id: string, lead: Partial<Lead>, tenantId: string): Promise<Lead | undefined>;
  convertLeadToCustomer(leadId: string, tenantId: string): Promise<Customer>;
  
  // Lead activity/interaction operations
  getLeadActivities(leadId: string, tenantId: string): Promise<LeadActivity[]>;
  createLeadActivity(activity: Omit<LeadActivity, "id" | "createdAt" | "updatedAt">): Promise<LeadActivity>;
  
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

  // Lead operations
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
}

export const storage = new DatabaseStorage();