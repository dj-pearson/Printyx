/**
 * Consent Management Service
 * Handles consent collection, tracking, and management for GDPR compliance
 */

import { db } from '../db';
import { eq, and, desc, sql, inArray, isNull, or, gte, lte } from 'drizzle-orm';
import {
  consentRecords,
  consentAuditTrail,
  consentPreferencesTemplate,
  insertConsentRecordSchema,
  insertConsentAuditTrailSchema,
  insertConsentPreferencesTemplateSchema,
  type ConsentRecord,
  type InsertConsentRecord,
  type ConsentAuditTrail,
  type ConsentPreferencesTemplate,
  type InsertConsentPreferencesTemplate,
} from '../../shared/gdpr-core-schema';
import { logAuditEvent } from '../security-compliance';
import crypto from 'crypto';

// ============= CONSENT TYPES CONFIGURATION =============

export const CONSENT_TYPES = {
  marketing_email: {
    name: 'Marketing Emails',
    description: 'Receive promotional emails and newsletters',
    defaultLegalBasis: 'consent',
    requiresExplicitConsent: true,
  },
  marketing_sms: {
    name: 'Marketing SMS',
    description: 'Receive promotional text messages',
    defaultLegalBasis: 'consent',
    requiresExplicitConsent: true,
  },
  marketing_phone: {
    name: 'Marketing Calls',
    description: 'Receive promotional phone calls',
    defaultLegalBasis: 'consent',
    requiresExplicitConsent: true,
  },
  data_processing: {
    name: 'Data Processing',
    description: 'Allow processing of personal data for service delivery',
    defaultLegalBasis: 'contract',
    requiresExplicitConsent: false,
  },
  profiling: {
    name: 'Profiling',
    description: 'Allow automated profiling for personalization',
    defaultLegalBasis: 'consent',
    requiresExplicitConsent: true,
  },
  analytics: {
    name: 'Analytics',
    description: 'Allow usage analytics and improvement tracking',
    defaultLegalBasis: 'legitimate_interests',
    requiresExplicitConsent: false,
  },
  third_party_sharing: {
    name: 'Third-Party Sharing',
    description: 'Allow sharing data with trusted partners',
    defaultLegalBasis: 'consent',
    requiresExplicitConsent: true,
  },
  newsletters: {
    name: 'Newsletters',
    description: 'Receive company newsletters',
    defaultLegalBasis: 'consent',
    requiresExplicitConsent: true,
  },
  product_updates: {
    name: 'Product Updates',
    description: 'Receive product and service updates',
    defaultLegalBasis: 'legitimate_interests',
    requiresExplicitConsent: false,
  },
  transactional: {
    name: 'Transactional Communications',
    description: 'Receive order confirmations and service notifications',
    defaultLegalBasis: 'contract',
    requiresExplicitConsent: false,
  },
  research: {
    name: 'Research & Surveys',
    description: 'Participate in research and customer surveys',
    defaultLegalBasis: 'consent',
    requiresExplicitConsent: true,
  },
  automated_decisions: {
    name: 'Automated Decisions',
    description: 'Allow automated decision-making that affects you',
    defaultLegalBasis: 'consent',
    requiresExplicitConsent: true,
  },
} as const;

export type ConsentType = keyof typeof CONSENT_TYPES;

// ============= CONSENT MANAGEMENT SERVICE =============

export class ConsentManagementService {
  /**
   * Record a new consent
   */
  async recordConsent(
    tenantId: string,
    data: Omit<InsertConsentRecord, 'tenantId' | 'status'>,
    actorId?: string,
  ): Promise<ConsentRecord> {
    // Check for existing consent of same type for this subject
    const existingConsent = await db.query.consentRecords.findFirst({
      where: and(
        eq(consentRecords.tenantId, tenantId),
        eq(consentRecords.subjectId, data.subjectId),
        eq(consentRecords.consentType, data.consentType),
        or(eq(consentRecords.status, 'given'), eq(consentRecords.status, 'pending')),
      ),
    });

    if (existingConsent) {
      // Update existing consent
      return await this.updateConsent(
        tenantId,
        existingConsent.id,
        { status: 'given', givenAt: new Date() },
        actorId,
        'Updated existing consent',
      );
    }

    // Create new consent record
    const [consent] = await db
      .insert(consentRecords)
      .values({
        ...data,
        tenantId,
        status: 'given',
        givenAt: new Date(),
      })
      .returning();

    // Create audit trail entry
    await this.createAuditEntry(tenantId, consent.id, {
      action: 'created',
      previousStatus: null,
      newStatus: 'given',
      newValues: data,
      changedBy: actorId,
      changedByType: actorId ? 'user' : 'subject',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      reason: 'New consent recorded',
    });

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId: actorId || data.subjectId,
      action: 'RECORD_CONSENT',
      resource: 'consent_records',
      resourceId: consent.id,
      newValues: { consentType: data.consentType, status: 'given' },
      ipAddress: data.ipAddress || 'unknown',
      userAgent: data.userAgent || 'unknown',
      sessionId: 'system',
      severity: 'medium',
      category: 'data_modification',
    });

    return consent;
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    tenantId: string,
    consentId: string,
    withdrawalData: {
      reason?: string;
      method?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    actorId?: string,
  ): Promise<ConsentRecord> {
    const existingConsent = await db.query.consentRecords.findFirst({
      where: and(eq(consentRecords.id, consentId), eq(consentRecords.tenantId, tenantId)),
    });

    if (!existingConsent) {
      throw new Error('Consent record not found');
    }

    if (existingConsent.status === 'withdrawn') {
      throw new Error('Consent already withdrawn');
    }

    const [updatedConsent] = await db
      .update(consentRecords)
      .set({
        status: 'withdrawn',
        withdrawnAt: new Date(),
        withdrawalReason: withdrawalData.reason,
        withdrawalMethod: withdrawalData.method,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(consentRecords.id, consentId))
      .returning();

    // Create audit trail entry
    await this.createAuditEntry(tenantId, consentId, {
      action: 'withdrawn',
      previousStatus: existingConsent.status as any,
      newStatus: 'withdrawn',
      previousValues: { status: existingConsent.status },
      newValues: { status: 'withdrawn', withdrawalReason: withdrawalData.reason },
      changedBy: actorId,
      changedByType: actorId ? 'user' : 'subject',
      ipAddress: withdrawalData.ipAddress,
      userAgent: withdrawalData.userAgent,
      reason: withdrawalData.reason || 'Consent withdrawn by subject',
    });

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId: actorId || existingConsent.subjectId,
      action: 'WITHDRAW_CONSENT',
      resource: 'consent_records',
      resourceId: consentId,
      oldValues: { status: existingConsent.status },
      newValues: { status: 'withdrawn', reason: withdrawalData.reason },
      ipAddress: withdrawalData.ipAddress || 'unknown',
      userAgent: withdrawalData.userAgent || 'unknown',
      sessionId: 'system',
      severity: 'medium',
      category: 'data_modification',
    });

    return updatedConsent;
  }

  /**
   * Update consent record
   */
  async updateConsent(
    tenantId: string,
    consentId: string,
    updates: Partial<Pick<InsertConsentRecord, 'status' | 'expiresAt' | 'notes' | 'givenAt'>>,
    actorId?: string,
    reason?: string,
  ): Promise<ConsentRecord> {
    const existingConsent = await db.query.consentRecords.findFirst({
      where: and(eq(consentRecords.id, consentId), eq(consentRecords.tenantId, tenantId)),
    });

    if (!existingConsent) {
      throw new Error('Consent record not found');
    }

    const [updatedConsent] = await db
      .update(consentRecords)
      .set({
        ...updates,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(consentRecords.id, consentId))
      .returning();

    // Create audit trail entry
    await this.createAuditEntry(tenantId, consentId, {
      action: 'updated',
      previousStatus: existingConsent.status as any,
      newStatus: (updates.status as any) || (existingConsent.status as any),
      previousValues: existingConsent,
      newValues: updates,
      changedBy: actorId,
      changedByType: actorId ? 'user' : 'system',
      reason,
    });

    return updatedConsent;
  }

  /**
   * Get consent records for a subject
   */
  async getSubjectConsents(
    tenantId: string,
    subjectType: string,
    subjectId: string,
  ): Promise<ConsentRecord[]> {
    return await db.query.consentRecords.findMany({
      where: and(
        eq(consentRecords.tenantId, tenantId),
        eq(consentRecords.subjectType, subjectType),
        eq(consentRecords.subjectId, subjectId),
      ),
      orderBy: [desc(consentRecords.createdAt)],
    });
  }

  /**
   * Get active consent for a specific type
   */
  async getActiveConsent(
    tenantId: string,
    subjectId: string,
    consentType: ConsentType,
  ): Promise<ConsentRecord | null> {
    return (
      (await db.query.consentRecords.findFirst({
        where: and(
          eq(consentRecords.tenantId, tenantId),
          eq(consentRecords.subjectId, subjectId),
          eq(consentRecords.consentType, consentType),
          eq(consentRecords.status, 'given'),
          or(isNull(consentRecords.expiresAt), gte(consentRecords.expiresAt, new Date())),
        ),
      })) || null
    );
  }

  /**
   * Check if subject has given consent for a specific type
   */
  async hasConsent(
    tenantId: string,
    subjectId: string,
    consentType: ConsentType,
  ): Promise<boolean> {
    const consent = await this.getActiveConsent(tenantId, subjectId, consentType);
    return consent !== null;
  }

  /**
   * Get consent status summary for a subject
   */
  async getConsentSummary(
    tenantId: string,
    subjectId: string,
  ): Promise<
    Record<ConsentType, { status: string; givenAt: Date | null; expiresAt: Date | null }>
  > {
    const consents = await db.query.consentRecords.findMany({
      where: and(eq(consentRecords.tenantId, tenantId), eq(consentRecords.subjectId, subjectId)),
      orderBy: [desc(consentRecords.createdAt)],
    });

    const summary: Record<
      string,
      { status: string; givenAt: Date | null; expiresAt: Date | null }
    > = {};

    // Initialize all consent types with 'not_given' status
    for (const type of Object.keys(CONSENT_TYPES)) {
      summary[type] = { status: 'not_given', givenAt: null, expiresAt: null };
    }

    // Update with actual consent records (most recent first due to ordering)
    for (const consent of consents) {
      if (!summary[consent.consentType] || summary[consent.consentType].status === 'not_given') {
        // Check if consent is expired
        let status = consent.status;
        if (consent.status === 'given' && consent.expiresAt && consent.expiresAt < new Date()) {
          status = 'expired';
        }
        summary[consent.consentType] = {
          status,
          givenAt: consent.givenAt,
          expiresAt: consent.expiresAt,
        };
      }
    }

    return summary as Record<
      ConsentType,
      { status: string; givenAt: Date | null; expiresAt: Date | null }
    >;
  }

  /**
   * Bulk record consents
   */
  async bulkRecordConsents(
    tenantId: string,
    subjectType: string,
    subjectId: string,
    subjectEmail: string | undefined,
    consentTypes: ConsentType[],
    commonData: {
      source: string;
      sourceDetails?: string;
      ipAddress?: string;
      userAgent?: string;
      consentText?: string;
      version?: string;
    },
    actorId?: string,
  ): Promise<ConsentRecord[]> {
    const results: ConsentRecord[] = [];

    for (const consentType of consentTypes) {
      const consent = await this.recordConsent(
        tenantId,
        {
          subjectType,
          subjectId,
          subjectEmail,
          consentType,
          legalBasis: CONSENT_TYPES[consentType].defaultLegalBasis as any,
          source: commonData.source as any,
          sourceDetails: commonData.sourceDetails,
          ipAddress: commonData.ipAddress,
          userAgent: commonData.userAgent,
          consentText: commonData.consentText,
          version: commonData.version,
        },
        actorId,
      );
      results.push(consent);
    }

    return results;
  }

  /**
   * Bulk withdraw consents
   */
  async bulkWithdrawConsents(
    tenantId: string,
    subjectId: string,
    consentTypes: ConsentType[],
    withdrawalData: {
      reason?: string;
      method?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    actorId?: string,
  ): Promise<ConsentRecord[]> {
    const results: ConsentRecord[] = [];

    for (const consentType of consentTypes) {
      const activeConsent = await this.getActiveConsent(tenantId, subjectId, consentType);
      if (activeConsent) {
        const withdrawn = await this.withdrawConsent(
          tenantId,
          activeConsent.id,
          withdrawalData,
          actorId,
        );
        results.push(withdrawn);
      }
    }

    return results;
  }

  /**
   * Create audit trail entry
   */
  private async createAuditEntry(
    tenantId: string,
    consentRecordId: string,
    data: Partial<Omit<ConsentAuditTrail, 'id' | 'tenantId' | 'consentRecordId' | 'changedAt'>>,
  ): Promise<void> {
    await db.insert(consentAuditTrail).values({
      tenantId,
      consentRecordId,
      ...data,
    } as any);
  }

  /**
   * Get consent audit history
   */
  async getConsentHistory(tenantId: string, consentId: string): Promise<ConsentAuditTrail[]> {
    return await db.query.consentAuditTrail.findMany({
      where: and(
        eq(consentAuditTrail.tenantId, tenantId),
        eq(consentAuditTrail.consentRecordId, consentId),
      ),
      orderBy: [desc(consentAuditTrail.changedAt)],
    });
  }

  /**
   * List all consent records with pagination
   */
  async listConsents(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      consentType?: string;
      subjectType?: string;
    } = {},
  ): Promise<{ consents: ConsentRecord[]; total: number }> {
    const { page = 1, limit = 25, status, consentType, subjectType } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(consentRecords.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(consentRecords.status, status as any));
    }
    if (consentType) {
      conditions.push(eq(consentRecords.consentType, consentType as any));
    }
    if (subjectType) {
      conditions.push(eq(consentRecords.subjectType, subjectType));
    }

    const whereClause = and(...conditions);

    const [consents, [{ count }]] = await Promise.all([
      db
        .select()
        .from(consentRecords)
        .where(whereClause)
        .orderBy(desc(consentRecords.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)` })
        .from(consentRecords)
        .where(whereClause),
    ]);

    return { consents, total: Number(count) };
  }

  /**
   * Expire old consents
   */
  async expireConsents(): Promise<number> {
    const result = await db
      .update(consentRecords)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(and(eq(consentRecords.status, 'given'), lte(consentRecords.expiresAt, new Date())));

    return result.rowCount || 0;
  }

  // ============= CONSENT TEMPLATES =============

  /**
   * Create consent preferences template
   */
  async createTemplate(
    tenantId: string,
    data: Omit<InsertConsentPreferencesTemplate, 'tenantId'>,
  ): Promise<ConsentPreferencesTemplate> {
    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await db
        .update(consentPreferencesTemplate)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(consentPreferencesTemplate.tenantId, tenantId),
            eq(consentPreferencesTemplate.isDefault, true),
          ),
        );
    }

    const [template] = await db
      .insert(consentPreferencesTemplate)
      .values({
        ...data,
        tenantId,
      })
      .returning();

    return template;
  }

  /**
   * List consent templates
   */
  async listTemplates(tenantId: string): Promise<ConsentPreferencesTemplate[]> {
    return await db.query.consentPreferencesTemplate.findMany({
      where: and(
        eq(consentPreferencesTemplate.tenantId, tenantId),
        eq(consentPreferencesTemplate.isActive, true),
      ),
      orderBy: [
        desc(consentPreferencesTemplate.isDefault),
        desc(consentPreferencesTemplate.createdAt),
      ],
    });
  }

  /**
   * Get default template
   */
  async getDefaultTemplate(tenantId: string): Promise<ConsentPreferencesTemplate | null> {
    return (
      (await db.query.consentPreferencesTemplate.findFirst({
        where: and(
          eq(consentPreferencesTemplate.tenantId, tenantId),
          eq(consentPreferencesTemplate.isDefault, true),
          eq(consentPreferencesTemplate.isActive, true),
        ),
      })) || null
    );
  }

  /**
   * Get consent statistics
   */
  async getConsentStats(tenantId: string): Promise<{
    totalRecords: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    recentWithdrawals: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalResult, byStatusResult, byTypeResult, withdrawalsResult] = await Promise.all([
      db
        .select({ count: sql`count(*)` })
        .from(consentRecords)
        .where(eq(consentRecords.tenantId, tenantId)),
      db
        .select({ status: consentRecords.status, count: sql`count(*)` })
        .from(consentRecords)
        .where(eq(consentRecords.tenantId, tenantId))
        .groupBy(consentRecords.status),
      db
        .select({ type: consentRecords.consentType, count: sql`count(*)` })
        .from(consentRecords)
        .where(eq(consentRecords.tenantId, tenantId))
        .groupBy(consentRecords.consentType),
      db
        .select({ count: sql`count(*)` })
        .from(consentRecords)
        .where(
          and(
            eq(consentRecords.tenantId, tenantId),
            eq(consentRecords.status, 'withdrawn'),
            gte(consentRecords.withdrawnAt, thirtyDaysAgo),
          ),
        ),
    ]);

    return {
      totalRecords: Number(totalResult[0]?.count || 0),
      byStatus: Object.fromEntries(byStatusResult.map((r) => [r.status, Number(r.count)])),
      byType: Object.fromEntries(byTypeResult.map((r) => [r.type, Number(r.count)])),
      recentWithdrawals: Number(withdrawalsResult[0]?.count || 0),
    };
  }
}

export const consentManagementService = new ConsentManagementService();
export default consentManagementService;
