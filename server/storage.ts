import {
  users,
  tenants,
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
  type Tenant,
  type InsertTenant,
  type Customer,
  type InsertCustomer,
  type Equipment,
  type InsertEquipment,
  type Contract,
  type InsertContract,
  type ServiceTicket,
  type InsertServiceTicket,
  type InventoryItem,
  type InsertInventoryItem,
  type Technician,
  type InsertTechnician,
  type MeterReading,
  type InsertMeterReading,
  type Invoice,
  type InsertInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, sum, sql } from "drizzle-orm";

export interface IStorage {
  // User operations - required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  
  // Customer operations
  getCustomers(tenantId: string): Promise<Customer[]>;
  getCustomer(id: string, tenantId: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>, tenantId: string): Promise<Customer>;
  
  // Equipment operations
  getEquipment(tenantId: string): Promise<Equipment[]>;
  getEquipmentByCustomer(customerId: string, tenantId: string): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, equipment: Partial<InsertEquipment>, tenantId: string): Promise<Equipment>;
  
  // Contract operations
  getContracts(tenantId: string): Promise<Contract[]>;
  getContract(id: string, tenantId: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>, tenantId: string): Promise<Contract>;
  
  // Service ticket operations
  getServiceTickets(tenantId: string): Promise<ServiceTicket[]>;
  getServiceTicket(id: string, tenantId: string): Promise<ServiceTicket | undefined>;
  createServiceTicket(ticket: InsertServiceTicket): Promise<ServiceTicket>;
  updateServiceTicket(id: string, ticket: Partial<InsertServiceTicket>, tenantId: string): Promise<ServiceTicket>;
  
  // Inventory operations
  getInventoryItems(tenantId: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string, tenantId: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>, tenantId: string): Promise<InventoryItem>;
  
  // Technician operations
  getTechnicians(tenantId: string): Promise<Technician[]>;
  getTechnician(id: string, tenantId: string): Promise<Technician | undefined>;
  createTechnician(technician: InsertTechnician): Promise<Technician>;
  updateTechnician(id: string, technician: Partial<InsertTechnician>, tenantId: string): Promise<Technician>;
  
  // Meter billing operations
  getMeterReadings(tenantId: string): Promise<MeterReading[]>;
  getMeterReadingsByEquipment(equipmentId: string, tenantId: string): Promise<MeterReading[]>;
  createMeterReading(reading: InsertMeterReading): Promise<MeterReading>;
  getLatestMeterReading(equipmentId: string, tenantId: string): Promise<MeterReading | undefined>;
  
  // Invoice operations
  getInvoices(tenantId: string): Promise<Invoice[]>;
  getInvoice(id: string, tenantId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>, tenantId: string): Promise<Invoice>;
  getInvoiceLineItems(invoiceId: string, tenantId: string): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(lineItem: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  
  // Billing calculations
  calculateMeterBilling(contractId: string, meterReadingId: string, tenantId: string): Promise<{
    blackCopies: number;
    colorCopies: number;
    blackAmount: number;
    colorAmount: number;
    totalAmount: number;
  }>;
  generateInvoiceFromMeterReadings(contractId: string, billingPeriodStart: Date, billingPeriodEnd: Date, tenantId: string): Promise<Invoice>;
  
  // Dashboard analytics
  getDashboardMetrics(tenantId: string): Promise<{
    monthlyRevenue: number;
    activeContracts: number;
    openTickets: number;
    avgResponseTime: number;
  }>;
  
  getRecentServiceTickets(tenantId: string, limit?: number): Promise<ServiceTicket[]>;
  getTopCustomers(tenantId: string, limit?: number): Promise<Array<Customer & { monthlyRevenue: number; contractCount: number }>>;
  getLowStockAlerts(tenantId: string): Promise<InventoryItem[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations - required for Replit Auth
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
  
  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async createTenant(tenantData: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(tenantData).returning();
    return tenant;
  }
  
  // Customer operations
  async getCustomers(tenantId: string): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.tenantId, tenantId)).orderBy(asc(customers.name));
  }

  async getCustomer(id: string, tenantId: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
    return customer;
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(customerData).returning();
    return customer;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>, tenantId: string): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({ ...customerData, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
      .returning();
    return customer;
  }
  
  // Equipment operations
  async getEquipment(tenantId: string): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.tenantId, tenantId)).orderBy(asc(equipment.model));
  }

  async getEquipmentByCustomer(customerId: string, tenantId: string): Promise<Equipment[]> {
    return await db.select().from(equipment).where(and(eq(equipment.customerId, customerId), eq(equipment.tenantId, tenantId)));
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [equipmentItem] = await db.insert(equipment).values(equipmentData).returning();
    return equipmentItem;
  }

  async updateEquipment(id: string, equipmentData: Partial<InsertEquipment>, tenantId: string): Promise<Equipment> {
    const [equipmentItem] = await db
      .update(equipment)
      .set({ ...equipmentData, updatedAt: new Date() })
      .where(and(eq(equipment.id, id), eq(equipment.tenantId, tenantId)))
      .returning();
    return equipmentItem;
  }
  
  // Contract operations
  async getContracts(tenantId: string): Promise<Contract[]> {
    return await db.select().from(contracts).where(eq(contracts.tenantId, tenantId)).orderBy(desc(contracts.startDate));
  }

  async getContract(id: string, tenantId: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId)));
    return contract;
  }

  async createContract(contractData: InsertContract): Promise<Contract> {
    const [contract] = await db.insert(contracts).values(contractData).returning();
    return contract;
  }

  async updateContract(id: string, contractData: Partial<InsertContract>, tenantId: string): Promise<Contract> {
    const [contract] = await db
      .update(contracts)
      .set({ ...contractData, updatedAt: new Date() })
      .where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId)))
      .returning();
    return contract;
  }
  
  // Service ticket operations
  async getServiceTickets(tenantId: string): Promise<ServiceTicket[]> {
    return await db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId)).orderBy(desc(serviceTickets.createdAt));
  }

  async getServiceTicket(id: string, tenantId: string): Promise<ServiceTicket | undefined> {
    const [ticket] = await db.select().from(serviceTickets).where(and(eq(serviceTickets.id, id), eq(serviceTickets.tenantId, tenantId)));
    return ticket;
  }

  async createServiceTicket(ticketData: InsertServiceTicket): Promise<ServiceTicket> {
    // Generate ticket number
    const count = await db.$count(serviceTickets, eq(serviceTickets.tenantId, ticketData.tenantId));
    const ticketNumber = `T${String(count + 1).padStart(5, '0')}`;
    
    const [ticket] = await db.insert(serviceTickets).values({
      ...ticketData,
      ticketNumber,
    }).returning();
    return ticket;
  }

  async updateServiceTicket(id: string, ticketData: Partial<InsertServiceTicket>, tenantId: string): Promise<ServiceTicket> {
    const [ticket] = await db
      .update(serviceTickets)
      .set({ ...ticketData, updatedAt: new Date() })
      .where(and(eq(serviceTickets.id, id), eq(serviceTickets.tenantId, tenantId)))
      .returning();
    return ticket;
  }
  
  // Inventory operations
  async getInventoryItems(tenantId: string): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId)).orderBy(asc(inventoryItems.name));
  }

  async getInventoryItem(id: string, tenantId: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)));
    return item;
  }

  async createInventoryItem(itemData: InsertInventoryItem): Promise<InventoryItem> {
    const [item] = await db.insert(inventoryItems).values(itemData).returning();
    return item;
  }

  async updateInventoryItem(id: string, itemData: Partial<InsertInventoryItem>, tenantId: string): Promise<InventoryItem> {
    const [item] = await db
      .update(inventoryItems)
      .set({ ...itemData, updatedAt: new Date() })
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)))
      .returning();
    return item;
  }
  
  // Technician operations
  async getTechnicians(tenantId: string): Promise<Technician[]> {
    return await db.select().from(technicians).where(eq(technicians.tenantId, tenantId));
  }

  async getTechnician(id: string, tenantId: string): Promise<Technician | undefined> {
    const [technician] = await db.select().from(technicians).where(and(eq(technicians.id, id), eq(technicians.tenantId, tenantId)));
    return technician;
  }

  async createTechnician(technicianData: InsertTechnician): Promise<Technician> {
    const [technician] = await db.insert(technicians).values(technicianData).returning();
    return technician;
  }

  async updateTechnician(id: string, technicianData: Partial<InsertTechnician>, tenantId: string): Promise<Technician> {
    const [technician] = await db
      .update(technicians)
      .set({ ...technicianData, updatedAt: new Date() })
      .where(and(eq(technicians.id, id), eq(technicians.tenantId, tenantId)))
      .returning();
    return technician;
  }

  // Meter billing operations
  async getMeterReadings(tenantId: string): Promise<MeterReading[]> {
    return await db.select().from(meterReadings)
      .where(eq(meterReadings.tenantId, tenantId))
      .orderBy(desc(meterReadings.readingDate));
  }

  async getMeterReadingsByEquipment(equipmentId: string, tenantId: string): Promise<MeterReading[]> {
    return await db.select().from(meterReadings)
      .where(and(eq(meterReadings.equipmentId, equipmentId), eq(meterReadings.tenantId, tenantId)))
      .orderBy(desc(meterReadings.readingDate));
  }

  async createMeterReading(readingData: InsertMeterReading): Promise<MeterReading> {
    // Get the latest reading for this equipment to calculate copies
    const latestReading = await this.getLatestMeterReading(readingData.equipmentId, readingData.tenantId);
    
    const blackCopies = latestReading 
      ? Math.max(0, readingData.blackMeter - latestReading.blackMeter)
      : readingData.blackMeter;
    
    const colorCopies = latestReading 
      ? Math.max(0, readingData.colorMeter - latestReading.colorMeter)
      : readingData.colorMeter;

    const [reading] = await db.insert(meterReadings).values({
      ...readingData,
      previousBlackMeter: latestReading?.blackMeter || 0,
      previousColorMeter: latestReading?.colorMeter || 0,
      blackCopies,
      colorCopies,
    }).returning();

    // Update equipment's current meter readings
    await db.update(equipment)
      .set({
        blackMeter: readingData.blackMeter,
        colorMeter: readingData.colorMeter,
        lastMeterReading: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(equipment.id, readingData.equipmentId), eq(equipment.tenantId, readingData.tenantId)));

    return reading;
  }

  async getLatestMeterReading(equipmentId: string, tenantId: string): Promise<MeterReading | undefined> {
    const [reading] = await db.select().from(meterReadings)
      .where(and(eq(meterReadings.equipmentId, equipmentId), eq(meterReadings.tenantId, tenantId)))
      .orderBy(desc(meterReadings.readingDate))
      .limit(1);
    return reading;
  }

  // Invoice operations
  async getInvoices(tenantId: string): Promise<Invoice[]> {
    return await db.select().from(invoices)
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string, tenantId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
    return invoice;
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(invoiceData).returning();
    return invoice;
  }

  async updateInvoice(id: string, invoiceData: Partial<InsertInvoice>, tenantId: string): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({ ...invoiceData, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    return invoice;
  }

  async getInvoiceLineItems(invoiceId: string, tenantId: string): Promise<InvoiceLineItem[]> {
    return await db.select().from(invoiceLineItems)
      .where(and(eq(invoiceLineItems.invoiceId, invoiceId), eq(invoiceLineItems.tenantId, tenantId)))
      .orderBy(asc(invoiceLineItems.createdAt));
  }

  async createInvoiceLineItem(lineItemData: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [lineItem] = await db.insert(invoiceLineItems).values(lineItemData).returning();
    return lineItem;
  }

  // Billing calculations
  async calculateMeterBilling(contractId: string, meterReadingId: string, tenantId: string): Promise<{
    blackCopies: number;
    colorCopies: number;
    blackAmount: number;
    colorAmount: number;
    totalAmount: number;
  }> {
    // Get contract details
    const contract = await this.getContract(contractId, tenantId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Get meter reading
    const [reading] = await db.select().from(meterReadings)
      .where(and(eq(meterReadings.id, meterReadingId), eq(meterReadings.tenantId, tenantId)));
    
    if (!reading) {
      throw new Error('Meter reading not found');
    }

    const blackRate = parseFloat(contract.blackRate || '0');
    const colorRate = parseFloat(contract.colorRate || '0');
    
    const blackAmount = reading.blackCopies * blackRate;
    const colorAmount = reading.colorCopies * colorRate;
    const totalAmount = blackAmount + colorAmount + parseFloat(contract.monthlyBase || '0');

    return {
      blackCopies: reading.blackCopies,
      colorCopies: reading.colorCopies,
      blackAmount: Math.round(blackAmount * 100) / 100,
      colorAmount: Math.round(colorAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  async generateInvoiceFromMeterReadings(
    contractId: string, 
    billingPeriodStart: Date, 
    billingPeriodEnd: Date, 
    tenantId: string
  ): Promise<Invoice> {
    // Get contract details
    const contract = await this.getContract(contractId, tenantId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Get all meter readings for this contract in the billing period
    const readings = await db.select({
      meterReading: meterReadings,
      equipment: equipment,
    })
    .from(meterReadings)
    .innerJoin(equipment, eq(meterReadings.equipmentId, equipment.id))
    .where(and(
      eq(meterReadings.contractId, contractId),
      eq(meterReadings.tenantId, tenantId),
      sql`${meterReadings.readingDate} >= ${billingPeriodStart}`,
      sql`${meterReadings.readingDate} <= ${billingPeriodEnd}`
    ));

    // Calculate totals
    let totalBlackCopies = 0;
    let totalColorCopies = 0;
    let totalBlackAmount = 0;
    let totalColorAmount = 0;

    const blackRate = parseFloat(contract.blackRate || '0');
    const colorRate = parseFloat(contract.colorRate || '0');
    const monthlyBase = parseFloat(contract.monthlyBase || '0');

    readings.forEach(({ meterReading }) => {
      totalBlackCopies += meterReading.blackCopies;
      totalColorCopies += meterReading.colorCopies;
      totalBlackAmount += meterReading.blackCopies * blackRate;
      totalColorAmount += meterReading.colorCopies * colorRate;
    });

    const totalAmount = totalBlackAmount + totalColorAmount + monthlyBase;

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}`;
    const dueDate = new Date(billingPeriodEnd);
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from billing period end

    // Create invoice
    const invoice = await this.createInvoice({
      tenantId,
      customerId: contract.customerId,
      contractId,
      invoiceNumber,
      billingPeriodStart,
      billingPeriodEnd,
      monthlyBase: monthlyBase.toString(),
      blackCopiesTotal: totalBlackCopies,
      colorCopiesTotal: totalColorCopies,
      blackAmount: totalBlackAmount.toString(),
      colorAmount: totalColorAmount.toString(),
      totalAmount: totalAmount.toString(),
      status: 'draft',
      dueDate,
      createdBy: 'system', // TODO: Get from authenticated user
    });

    // Create line items
    if (monthlyBase > 0) {
      await this.createInvoiceLineItem({
        tenantId,
        invoiceId: invoice.id,
        equipmentId: readings[0]?.equipment.id || '', // Use first equipment as reference
        description: 'Monthly Base Fee',
        quantity: 1,
        rate: monthlyBase.toString(),
        amount: monthlyBase.toString(),
        lineType: 'base',
      });
    }

    if (totalBlackCopies > 0) {
      await this.createInvoiceLineItem({
        tenantId,
        invoiceId: invoice.id,
        equipmentId: readings[0]?.equipment.id || '',
        description: `Black & White Copies (${totalBlackCopies} @ $${blackRate})`,
        quantity: totalBlackCopies,
        rate: blackRate.toString(),
        amount: totalBlackAmount.toString(),
        lineType: 'meter',
      });
    }

    if (totalColorCopies > 0) {
      await this.createInvoiceLineItem({
        tenantId,
        invoiceId: invoice.id,
        equipmentId: readings[0]?.equipment.id || '',
        description: `Color Copies (${totalColorCopies} @ $${colorRate})`,
        quantity: totalColorCopies,
        rate: colorRate.toString(),
        amount: totalColorAmount.toString(),
        lineType: 'meter',
      });
    }

    return invoice;
  }
  
  // Dashboard analytics
  async getDashboardMetrics(tenantId: string): Promise<{
    monthlyRevenue: number;
    activeContracts: number;
    openTickets: number;
    avgResponseTime: number;
  }> {
    const [contractsCount] = await db
      .select({ count: count() })
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active')));

    const [ticketsCount] = await db
      .select({ count: count() })
      .from(serviceTickets)
      .where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.status, 'open')));

    // Calculate monthly revenue (sum of monthly base from active contracts)
    const [revenueSum] = await db
      .select({ revenue: sum(contracts.monthlyBase) })
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active')));

    return {
      monthlyRevenue: Number(revenueSum?.revenue || 0),
      activeContracts: contractsCount.count,
      openTickets: ticketsCount.count,
      avgResponseTime: 2.4, // Mock value - would need actual calculation based on ticket resolution times
    };
  }

  async getRecentServiceTickets(tenantId: string, limit = 10): Promise<ServiceTicket[]> {
    return await db
      .select()
      .from(serviceTickets)
      .where(eq(serviceTickets.tenantId, tenantId))
      .orderBy(desc(serviceTickets.createdAt))
      .limit(limit);
  }

  async getTopCustomers(tenantId: string, limit = 5): Promise<Array<Customer & { monthlyRevenue: number; contractCount: number }>> {
    const result = await db
      .select({
        id: customers.id,
        tenantId: customers.tenantId,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        address: customers.address,
        contactPerson: customers.contactPerson,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        monthlyRevenue: sum(contracts.monthlyBase),
        contractCount: count(contracts.id),
      })
      .from(customers)
      .leftJoin(contracts, and(eq(contracts.customerId, customers.id), eq(contracts.status, 'active')))
      .where(eq(customers.tenantId, tenantId))
      .groupBy(customers.id)
      .orderBy(desc(sum(contracts.monthlyBase)))
      .limit(limit);

    return result.map(row => ({
      ...row,
      monthlyRevenue: Number(row.monthlyRevenue || 0),
      contractCount: row.contractCount,
    }));
  }

  async getLowStockAlerts(tenantId: string): Promise<InventoryItem[]> {
    return await db
      .select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.tenantId, tenantId),
        sql`${inventoryItems.currentStock} <= ${inventoryItems.reorderPoint}`
      ));
  }

  // Enhanced Service Dispatch Methods
  async assignTicketToTechnician(ticketId: string, technicianId: string, scheduledDate: Date, tenantId: string): Promise<ServiceTicket> {
    const [ticket] = await db
      .update(serviceTickets)
      .set({ 
        assignedTechnicianId: technicianId,
        scheduledDate,
        status: 'assigned',
        updatedAt: new Date()
      })
      .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)))
      .returning();

    return ticket;
  }

  async findOptimalTechnician(requiredSkills: string[], scheduledDate: Date, tenantId: string): Promise<Technician | null> {
    // Find technicians with matching skills who are available
    const availableTechnicians = await db
      .select()
      .from(technicians)
      .where(
        and(
          eq(technicians.tenantId, tenantId),
          eq(technicians.isActive, true),
          eq(technicians.isAvailable, true)
        )
      );

    // Filter by skills (simple matching for demo)
    const matchingTechnicians = availableTechnicians.filter(tech => 
      requiredSkills.every(skill => tech.skills?.includes(skill))
    );

    return matchingTechnicians.length > 0 ? matchingTechnicians[0] : null;
  }
}

export const storage = new DatabaseStorage();
