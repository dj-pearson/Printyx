import { db } from './db';
import { eq, and, sql, desc, gte, lt, inArray } from 'drizzle-orm';
import {
  centralizedApolloContacts,
  tenantApolloLeads,
  apolloSearchCache,
  apolloApiUsage,
  CentralizedApolloContact,
  InsertCentralizedApolloContact,
  TenantApolloLead,
  InsertTenantApolloLead,
  ApolloSearchCache,
  InsertApolloSearchCache,
  InsertApolloApiUsage,
} from '@shared/schema';
import crypto from 'crypto';

export class ApolloStorage {
  // ===== Centralized Apollo Contacts =====

  async getCentralizedContact(apolloId: string): Promise<CentralizedApolloContact | null> {
    const [contact] = await db
      .select()
      .from(centralizedApolloContacts)
      .where(eq(centralizedApolloContacts.apolloId, apolloId))
      .limit(1);
    return contact || null;
  }

  async getCentralizedContactsByIds(apolloIds: string[]): Promise<CentralizedApolloContact[]> {
    if (apolloIds.length === 0) return [];
    return await db
      .select()
      .from(centralizedApolloContacts)
      .where(inArray(centralizedApolloContacts.apolloId, apolloIds));
  }

  async createOrUpdateCentralizedContact(
    data: InsertCentralizedApolloContact,
  ): Promise<CentralizedApolloContact> {
    // Check if exists
    const existing = await this.getCentralizedContact(data.apolloId);

    if (existing) {
      // Update existing contact and increment access count
      const [updated] = await db
        .update(centralizedApolloContacts)
        .set({
          ...data,
          accessCount: sql`${centralizedApolloContacts.accessCount} + 1`,
          lastEnrichedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(centralizedApolloContacts.apolloId, data.apolloId))
        .returning();
      return updated;
    }

    // Create new contact
    const [created] = await db.insert(centralizedApolloContacts).values(data).returning();
    return created;
  }

  // ===== Tenant Apollo Leads =====

  async getTenantLeads(
    tenantId: string,
    filters?: {
      status?: string;
      addedToCrm?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<TenantApolloLead[]> {
    const conditions = [eq(tenantApolloLeads.tenant_id, tenantId)];

    if (filters?.status) {
      conditions.push(eq(tenantApolloLeads.status, filters.status));
    }

    if (filters?.addedToCrm !== undefined) {
      conditions.push(eq(tenantApolloLeads.addedToCrm, filters.addedToCrm));
    }

    let query = db
      .select()
      .from(tenantApolloLeads)
      .where(and(...conditions))
      .orderBy(desc(tenantApolloLeads.created_at));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async getTenantLead(id: string, tenantId: string): Promise<TenantApolloLead | null> {
    const [lead] = await db
      .select()
      .from(tenantApolloLeads)
      .where(and(eq(tenantApolloLeads.id, id), eq(tenantApolloLeads.tenant_id, tenantId)))
      .limit(1);
    return lead || null;
  }

  async getTenantLeadByApolloId(
    apolloId: string,
    tenantId: string,
  ): Promise<TenantApolloLead | null> {
    const [lead] = await db
      .select()
      .from(tenantApolloLeads)
      .where(
        and(eq(tenantApolloLeads.apolloId, apolloId), eq(tenantApolloLeads.tenant_id, tenantId)),
      )
      .limit(1);
    return lead || null;
  }

  async createTenantLead(data: InsertTenantApolloLead): Promise<TenantApolloLead> {
    const [created] = await db.insert(tenantApolloLeads).values(data).returning();
    return created;
  }

  async updateTenantLead(
    id: string,
    tenantId: string,
    data: Partial<TenantApolloLead>,
  ): Promise<TenantApolloLead | null> {
    const [updated] = await db
      .update(tenantApolloLeads)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tenantApolloLeads.id, id), eq(tenantApolloLeads.tenant_id, tenantId)))
      .returning();
    return updated || null;
  }

  async markLeadAsViewed(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<TenantApolloLead | null> {
    return await this.updateTenantLead(id, tenantId, {
      status: 'viewed',
      viewedAt: new Date(),
      viewedBy: userId,
    });
  }

  async markLeadAsAddedToCrm(
    id: string,
    tenantId: string,
    userId: string,
    businessRecordId: string,
  ): Promise<TenantApolloLead | null> {
    return await this.updateTenantLead(id, tenantId, {
      status: 'added_to_crm',
      addedToCrm: true,
      addedAt: new Date(),
      addedBy: userId,
      businessRecordId,
    });
  }

  async markLeadAsRejected(
    id: string,
    tenantId: string,
    userId: string,
    reason: string,
  ): Promise<TenantApolloLead | null> {
    return await this.updateTenantLead(id, tenantId, {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedBy: userId,
      rejectionReason: reason,
    });
  }

  // ===== Search Cache =====

  generateSearchHash(filters: any): string {
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    return crypto.createHash('md5').update(filterString).digest('hex');
  }

  async getSearchCache(searchHash: string): Promise<ApolloSearchCache | null> {
    const [cache] = await db
      .select()
      .from(apolloSearchCache)
      .where(
        and(
          eq(apolloSearchCache.searchHash, searchHash),
          gte(apolloSearchCache.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (cache) {
      // Increment hit count
      await db
        .update(apolloSearchCache)
        .set({
          hitCount: sql`${apolloSearchCache.hitCount} + 1`,
          lastAccessedAt: new Date(),
        })
        .where(eq(apolloSearchCache.id, cache.id));
    }

    return cache || null;
  }

  async createSearchCache(data: InsertApolloSearchCache): Promise<ApolloSearchCache> {
    const [created] = await db
      .insert(apolloSearchCache)
      .values(data)
      .onConflictDoUpdate({
        target: apolloSearchCache.searchHash,
        set: {
          resultCount: data.resultCount,
          totalAvailable: data.totalAvailable,
          apolloIds: data.apolloIds,
          expiresAt: data.expiresAt,
          hitCount: sql`${apolloSearchCache.hitCount} + 1`,
          lastAccessedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  async cleanExpiredCache(): Promise<number> {
    const result = await db
      .delete(apolloSearchCache)
      .where(lt(apolloSearchCache.expiresAt, new Date()));
    return result.rowCount || 0;
  }

  // ===== API Usage Tracking =====

  async trackApiUsage(data: InsertApolloApiUsage): Promise<void> {
    await db.insert(apolloApiUsage).values(data);
  }

  async getApiUsageStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCreditsUsed: number;
  }> {
    const [stats] = await db
      .select({
        totalCalls: sql<number>`COUNT(*)`,
        successfulCalls: sql<number>`COUNT(*) FILTER (WHERE ${apolloApiUsage.success} = true)`,
        failedCalls: sql<number>`COUNT(*) FILTER (WHERE ${apolloApiUsage.success} = false)`,
        totalCreditsUsed: sql<number>`SUM(${apolloApiUsage.creditsUsed})`,
      })
      .from(apolloApiUsage)
      .where(
        and(
          eq(apolloApiUsage.tenant_id, tenantId),
          gte(apolloApiUsage.created_at, startDate),
          lt(apolloApiUsage.created_at, endDate),
        ),
      );

    return {
      totalCalls: Number(stats.totalCalls) || 0,
      successfulCalls: Number(stats.successfulCalls) || 0,
      failedCalls: Number(stats.failedCalls) || 0,
      totalCreditsUsed: Number(stats.totalCreditsUsed) || 0,
    };
  }
}

export const apolloStorage = new ApolloStorage();
