/**
 * Territory Management Service
 * Handles sales territory assignment and management
 */

import { db } from '../db';
import { eq, and, desc, sql, gte, lte, or, inArray } from 'drizzle-orm';
import {
  salesTerritories,
  leadAssignmentRules,
  repCapacity,
  leadAssignmentHistory,
  insertSalesTerritorySchema,
  insertLeadAssignmentRuleSchema,
  insertRepCapacitySchema,
  type SalesTerritory,
  type InsertSalesTerritory,
  type LeadAssignmentRule,
  type InsertLeadAssignmentRule,
  type RepCapacity,
  type InsertRepCapacity,
  type LeadAssignmentHistory,
} from '../../shared/lead-assignment-schema';
import { businessRecords, users } from '../../shared/schema';
import { logAuditEvent } from '../security-compliance';
import crypto from 'crypto';

// ============= TERRITORY TYPES =============

export const TERRITORY_TYPES = {
  geographic: {
    name: 'Geographic',
    description: 'Territory based on location (country, state, city, zip)',
  },
  industry: {
    name: 'Industry',
    description: 'Territory based on industry vertical',
  },
  account_size: {
    name: 'Account Size',
    description: 'Territory based on company size or revenue',
  },
  product_line: {
    name: 'Product Line',
    description: 'Territory based on product focus',
  },
  named_accounts: {
    name: 'Named Accounts',
    description: 'Specific accounts assigned to territory',
  },
} as const;

export type TerritoryType = keyof typeof TERRITORY_TYPES;

// ============= TERRITORY MANAGEMENT SERVICE =============

export class TerritoryManagementService {
  // ============= TERRITORY CRUD OPERATIONS =============

  /**
   * Create a new territory
   */
  async createTerritory(
    tenantId: string,
    data: Omit<InsertSalesTerritory, 'tenantId'>
  ): Promise<SalesTerritory> {
    const [territory] = await db.insert(salesTerritories).values({
      ...data,
      tenantId,
    }).returning();

    await logAuditEvent({
      tenantId,
      userId: data.ownerId || 'system',
      action: 'CREATE_TERRITORY',
      resource: 'sales_territories',
      resourceId: territory.id,
      newValues: { territoryName: data.territoryName, territoryType: data.territoryType },
      ipAddress: 'system',
      userAgent: 'system',
      sessionId: 'system',
      severity: 'medium',
      category: 'data_modification',
    });

    return territory;
  }

  /**
   * Get territory by ID
   */
  async getTerritory(tenantId: string, territoryId: string): Promise<SalesTerritory | null> {
    return await db.query.salesTerritories.findFirst({
      where: and(
        eq(salesTerritories.id, territoryId),
        eq(salesTerritories.tenantId, tenantId)
      ),
    }) || null;
  }

  /**
   * List territories with filters
   */
  async listTerritories(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      ownerId?: string;
      isActive?: boolean;
      search?: string;
    } = {}
  ): Promise<{ territories: SalesTerritory[]; total: number }> {
    const { page = 1, limit = 25, type, ownerId, isActive, search } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(salesTerritories.tenantId, tenantId)];

    if (type) {
      conditions.push(eq(salesTerritories.territoryType, type));
    }
    if (ownerId) {
      conditions.push(eq(salesTerritories.ownerId, ownerId));
    }
    if (isActive !== undefined) {
      conditions.push(eq(salesTerritories.isActive, isActive));
    }
    if (search) {
      conditions.push(sql`${salesTerritories.territoryName} ILIKE ${`%${search}%`}`);
    }

    const whereClause = and(...conditions);

    const [territories, [{ count }]] = await Promise.all([
      db.select()
        .from(salesTerritories)
        .where(whereClause)
        .orderBy(desc(salesTerritories.priority), salesTerritories.territoryName)
        .limit(limit)
        .offset(offset),
      db.select({ count: sql`count(*)` })
        .from(salesTerritories)
        .where(whereClause),
    ]);

    return { territories, total: Number(count) };
  }

  /**
   * Update territory
   */
  async updateTerritory(
    tenantId: string,
    territoryId: string,
    updates: Partial<InsertSalesTerritory>,
    updatedBy?: string
  ): Promise<SalesTerritory> {
    const [updated] = await db.update(salesTerritories)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(salesTerritories.id, territoryId),
        eq(salesTerritories.tenantId, tenantId)
      ))
      .returning();

    await logAuditEvent({
      tenantId,
      userId: updatedBy || 'system',
      action: 'UPDATE_TERRITORY',
      resource: 'sales_territories',
      resourceId: territoryId,
      newValues: updates,
      ipAddress: 'system',
      userAgent: 'system',
      sessionId: 'system',
      severity: 'medium',
      category: 'data_modification',
    });

    return updated;
  }

  /**
   * Delete territory (soft delete)
   */
  async deleteTerritory(tenantId: string, territoryId: string, deletedBy?: string): Promise<void> {
    await this.updateTerritory(tenantId, territoryId, { isActive: false }, deletedBy);
  }

  // ============= TERRITORY ASSIGNMENT =============

  /**
   * Get territory for a lead based on matching criteria
   */
  async findMatchingTerritory(
    tenantId: string,
    leadData: {
      country?: string;
      state?: string;
      city?: string;
      zipCode?: string;
      industry?: string;
      companySize?: number;
      revenue?: number;
      productInterest?: string[];
    }
  ): Promise<SalesTerritory | null> {
    const territories = await db.query.salesTerritories.findMany({
      where: and(
        eq(salesTerritories.tenantId, tenantId),
        eq(salesTerritories.isActive, true)
      ),
      orderBy: [desc(salesTerritories.priority)],
    });

    for (const territory of territories) {
      if (this.matchesTerritory(leadData, territory)) {
        return territory;
      }
    }

    return null;
  }

  /**
   * Check if lead data matches territory rules
   */
  private matchesTerritory(
    leadData: {
      country?: string;
      state?: string;
      city?: string;
      zipCode?: string;
      industry?: string;
      companySize?: number;
      revenue?: number;
      productInterest?: string[];
    },
    territory: SalesTerritory
  ): boolean {
    // Check geographic rules
    const geoRules = territory.geographicRules as any;
    if (geoRules) {
      if (geoRules.countries?.length && !geoRules.countries.includes(leadData.country)) {
        return false;
      }
      if (geoRules.states?.length && !geoRules.states.includes(leadData.state)) {
        return false;
      }
      if (geoRules.cities?.length && !geoRules.cities.includes(leadData.city)) {
        return false;
      }
      if (geoRules.zipCodes?.length && !geoRules.zipCodes.includes(leadData.zipCode)) {
        return false;
      }
    }

    // Check account rules
    const accountRules = territory.accountRules as any;
    if (accountRules) {
      if (accountRules.industries?.length && !accountRules.industries.includes(leadData.industry)) {
        return false;
      }
      if (accountRules.companySizeMin && leadData.companySize && leadData.companySize < accountRules.companySizeMin) {
        return false;
      }
      if (accountRules.companySizeMax && leadData.companySize && leadData.companySize > accountRules.companySizeMax) {
        return false;
      }
      if (accountRules.revenueMin && leadData.revenue && leadData.revenue < accountRules.revenueMin) {
        return false;
      }
      if (accountRules.revenueMax && leadData.revenue && leadData.revenue > accountRules.revenueMax) {
        return false;
      }
    }

    // Check product focus
    if (territory.productFocus?.length && leadData.productInterest?.length) {
      const hasMatch = territory.productFocus.some(p => leadData.productInterest!.includes(p));
      if (!hasMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Assign lead to territory
   */
  async assignLeadToTerritory(
    tenantId: string,
    leadId: string,
    territoryId: string,
    assignedBy?: string
  ): Promise<void> {
    const territory = await this.getTerritory(tenantId, territoryId);
    if (!territory) {
      throw new Error('Territory not found');
    }

    // Update the lead with the territory owner
    if (territory.ownerId) {
      await db.update(businessRecords)
        .set({
          ownerId: territory.ownerId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(businessRecords.id, leadId),
          eq(businessRecords.tenantId, tenantId)
        ));

      // Record assignment history
      await db.insert(leadAssignmentHistory).values({
        tenantId,
        leadId,
        assignedTo: territory.ownerId,
        assignmentReason: 'territory_match',
        assignedBy: assignedBy || 'system',
        assignmentNotes: `Assigned based on territory: ${territory.territoryName}`,
      });
    }

    // Update territory stats
    await db.update(salesTerritories)
      .set({
        activeLeadsCount: sql`${salesTerritories.activeLeadsCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(salesTerritories.id, territoryId));
  }

  // ============= ASSIGNMENT RULES =============

  /**
   * Create assignment rule
   */
  async createAssignmentRule(
    tenantId: string,
    data: Omit<InsertLeadAssignmentRule, 'tenantId'>,
    createdBy?: string
  ): Promise<LeadAssignmentRule> {
    const [rule] = await db.insert(leadAssignmentRules).values({
      ...data,
      tenantId,
      createdBy,
    }).returning();

    return rule;
  }

  /**
   * List assignment rules
   */
  async listAssignmentRules(
    tenantId: string,
    options: { page?: number; limit?: number; isActive?: boolean } = {}
  ): Promise<{ rules: LeadAssignmentRule[]; total: number }> {
    const { page = 1, limit = 25, isActive } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(leadAssignmentRules.tenantId, tenantId)];

    if (isActive !== undefined) {
      conditions.push(eq(leadAssignmentRules.isActive, isActive));
    }

    const whereClause = and(...conditions);

    const [rules, [{ count }]] = await Promise.all([
      db.select()
        .from(leadAssignmentRules)
        .where(whereClause)
        .orderBy(desc(leadAssignmentRules.priority), leadAssignmentRules.ruleName)
        .limit(limit)
        .offset(offset),
      db.select({ count: sql`count(*)` })
        .from(leadAssignmentRules)
        .where(whereClause),
    ]);

    return { rules, total: Number(count) };
  }

  /**
   * Get assignment rule by ID
   */
  async getAssignmentRule(tenantId: string, ruleId: string): Promise<LeadAssignmentRule | null> {
    return await db.query.leadAssignmentRules.findFirst({
      where: and(
        eq(leadAssignmentRules.id, ruleId),
        eq(leadAssignmentRules.tenantId, tenantId)
      ),
    }) || null;
  }

  /**
   * Update assignment rule
   */
  async updateAssignmentRule(
    tenantId: string,
    ruleId: string,
    updates: Partial<InsertLeadAssignmentRule>
  ): Promise<LeadAssignmentRule> {
    const [updated] = await db.update(leadAssignmentRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(leadAssignmentRules.id, ruleId),
        eq(leadAssignmentRules.tenantId, tenantId)
      ))
      .returning();

    return updated;
  }

  /**
   * Delete assignment rule
   */
  async deleteAssignmentRule(tenantId: string, ruleId: string): Promise<void> {
    await this.updateAssignmentRule(tenantId, ruleId, { isActive: false });
  }

  // ============= REP CAPACITY =============

  /**
   * Get or create rep capacity
   */
  async getOrCreateRepCapacity(
    tenantId: string,
    userId: string
  ): Promise<RepCapacity> {
    let capacity = await db.query.repCapacity.findFirst({
      where: and(
        eq(repCapacity.tenantId, tenantId),
        eq(repCapacity.userId, userId)
      ),
    });

    if (!capacity) {
      const [created] = await db.insert(repCapacity).values({
        tenantId,
        userId,
      }).returning();
      capacity = created;
    }

    return capacity;
  }

  /**
   * Update rep capacity
   */
  async updateRepCapacity(
    tenantId: string,
    userId: string,
    updates: Partial<InsertRepCapacity>
  ): Promise<RepCapacity> {
    const [updated] = await db.update(repCapacity)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(repCapacity.tenantId, tenantId),
        eq(repCapacity.userId, userId)
      ))
      .returning();

    return updated;
  }

  /**
   * List rep capacities
   */
  async listRepCapacities(
    tenantId: string,
    options: { page?: number; limit?: number; isAvailable?: boolean } = {}
  ): Promise<{ capacities: RepCapacity[]; total: number }> {
    const { page = 1, limit = 25, isAvailable } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(repCapacity.tenantId, tenantId)];

    if (isAvailable !== undefined) {
      conditions.push(eq(repCapacity.isAvailable, isAvailable));
    }

    const whereClause = and(...conditions);

    const [capacities, [{ count }]] = await Promise.all([
      db.select()
        .from(repCapacity)
        .where(whereClause)
        .orderBy(repCapacity.currentActiveLeads)
        .limit(limit)
        .offset(offset),
      db.select({ count: sql`count(*)` })
        .from(repCapacity)
        .where(whereClause),
    ]);

    return { capacities, total: Number(count) };
  }

  /**
   * Get available rep with lowest load
   */
  async getAvailableRep(
    tenantId: string,
    skills?: string[],
    territoryId?: string
  ): Promise<RepCapacity | null> {
    const conditions = [
      eq(repCapacity.tenantId, tenantId),
      eq(repCapacity.isAvailable, true),
      sql`${repCapacity.currentActiveLeads} < ${repCapacity.maxActiveLeads}`,
    ];

    // Filter by territory if specified
    if (territoryId) {
      const territory = await this.getTerritory(tenantId, territoryId);
      if (territory?.teamMembers?.length) {
        conditions.push(inArray(repCapacity.userId, territory.teamMembers));
      }
    }

    const availableReps = await db.query.repCapacity.findMany({
      where: and(...conditions),
      orderBy: [repCapacity.currentActiveLeads],
      limit: 10,
    });

    // If skills specified, filter by skills
    if (skills?.length && availableReps.length > 0) {
      const matchingRep = availableReps.find(rep => {
        const repSkills = rep.skills || [];
        return skills.some(skill => repSkills.includes(skill));
      });
      if (matchingRep) return matchingRep;
    }

    return availableReps[0] || null;
  }

  // ============= ASSIGNMENT HISTORY =============

  /**
   * Get assignment history for a lead
   */
  async getLeadAssignmentHistory(
    tenantId: string,
    leadId: string
  ): Promise<LeadAssignmentHistory[]> {
    return await db.query.leadAssignmentHistory.findMany({
      where: and(
        eq(leadAssignmentHistory.tenantId, tenantId),
        eq(leadAssignmentHistory.leadId, leadId)
      ),
      orderBy: [desc(leadAssignmentHistory.assignedAt)],
    });
  }

  /**
   * Get assignment history for a rep
   */
  async getRepAssignmentHistory(
    tenantId: string,
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ history: LeadAssignmentHistory[]; total: number }> {
    const { page = 1, limit = 25 } = options;
    const offset = (page - 1) * limit;

    const whereClause = and(
      eq(leadAssignmentHistory.tenantId, tenantId),
      eq(leadAssignmentHistory.assignedTo, userId)
    );

    const [history, [{ count }]] = await Promise.all([
      db.select()
        .from(leadAssignmentHistory)
        .where(whereClause)
        .orderBy(desc(leadAssignmentHistory.assignedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql`count(*)` })
        .from(leadAssignmentHistory)
        .where(whereClause),
    ]);

    return { history, total: Number(count) };
  }

  // ============= STATISTICS =============

  /**
   * Get territory statistics
   */
  async getStats(tenantId: string): Promise<{
    totalTerritories: number;
    activeTerritories: number;
    byType: Record<string, number>;
    totalLeadsAssigned: number;
    unassignedLeads: number;
    repsWithCapacity: number;
  }> {
    const [
      totalResult,
      activeResult,
      byTypeResult,
      leadsAssignedResult,
      unassignedResult,
      repsWithCapacityResult,
    ] = await Promise.all([
      db.select({ count: sql`count(*)` })
        .from(salesTerritories)
        .where(eq(salesTerritories.tenantId, tenantId)),
      db.select({ count: sql`count(*)` })
        .from(salesTerritories)
        .where(and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.isActive, true)
        )),
      db.select({ type: salesTerritories.territoryType, count: sql`count(*)` })
        .from(salesTerritories)
        .where(eq(salesTerritories.tenantId, tenantId))
        .groupBy(salesTerritories.territoryType),
      db.select({ count: sql`sum(${salesTerritories.activeLeadsCount})` })
        .from(salesTerritories)
        .where(eq(salesTerritories.tenantId, tenantId)),
      db.select({ count: sql`count(*)` })
        .from(businessRecords)
        .where(and(
          eq(businessRecords.tenantId, tenantId),
          sql`${businessRecords.ownerId} IS NULL`,
          eq(businessRecords.status, 'lead')
        )),
      db.select({ count: sql`count(*)` })
        .from(repCapacity)
        .where(and(
          eq(repCapacity.tenantId, tenantId),
          eq(repCapacity.isAvailable, true),
          sql`${repCapacity.currentActiveLeads} < ${repCapacity.maxActiveLeads}`
        )),
    ]);

    return {
      totalTerritories: Number(totalResult[0]?.count || 0),
      activeTerritories: Number(activeResult[0]?.count || 0),
      byType: Object.fromEntries(byTypeResult.map(r => [r.type, Number(r.count)])),
      totalLeadsAssigned: Number(leadsAssignedResult[0]?.count || 0),
      unassignedLeads: Number(unassignedResult[0]?.count || 0),
      repsWithCapacity: Number(repsWithCapacityResult[0]?.count || 0),
    };
  }
}

export const territoryManagementService = new TerritoryManagementService();
export default territoryManagementService;
