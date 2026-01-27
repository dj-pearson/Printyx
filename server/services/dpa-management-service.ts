/**
 * Data Processing Agreement (DPA) Management Service
 * Handles DPA tracking, compliance checks, and vendor management
 */

import { db } from '../db';
import { eq, and, desc, sql, gte, lte, or, isNull } from 'drizzle-orm';
import {
  dataProcessingAgreements,
  dpaComplianceChecks,
  insertDataProcessingAgreementSchema,
  insertDpaComplianceCheckSchema,
  type DataProcessingAgreement,
  type InsertDataProcessingAgreement,
  type DpaComplianceCheck,
  type InsertDpaComplianceCheck,
} from '../../shared/gdpr-core-schema';
import { logAuditEvent } from '../security-compliance';
import crypto from 'crypto';
import { format, addDays } from 'date-fns';

// ============= DPA STATUS DEFINITIONS =============

export const DPA_STATUSES = {
  draft: {
    name: 'Draft',
    description: 'Agreement is being drafted',
    allowedTransitions: ['pending_review', 'terminated'],
  },
  pending_review: {
    name: 'Pending Review',
    description: 'Awaiting internal review',
    allowedTransitions: ['draft', 'pending_signature', 'terminated'],
  },
  pending_signature: {
    name: 'Pending Signature',
    description: 'Awaiting signatures from both parties',
    allowedTransitions: ['pending_review', 'active', 'terminated'],
  },
  active: {
    name: 'Active',
    description: 'Agreement is in force',
    allowedTransitions: ['expired', 'terminated', 'renewed'],
  },
  expired: {
    name: 'Expired',
    description: 'Agreement has expired',
    allowedTransitions: ['renewed'],
  },
  terminated: {
    name: 'Terminated',
    description: 'Agreement has been terminated',
    allowedTransitions: [],
  },
  renewed: {
    name: 'Renewed',
    description: 'Agreement has been renewed',
    allowedTransitions: ['active', 'terminated'],
  },
} as const;

export type DpaStatus = keyof typeof DPA_STATUSES;

// ============= DPA MANAGEMENT SERVICE =============

export class DpaManagementService {
  // ============= DPA CRUD OPERATIONS =============

  /**
   * Create a new DPA
   */
  async createDpa(
    tenantId: string,
    data: Omit<InsertDataProcessingAgreement, 'tenantId' | 'agreementNumber'>,
    createdBy?: string,
  ): Promise<DataProcessingAgreement> {
    const agreementNumber = `DPA-${format(new Date(), 'yyyyMMdd')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const [dpa] = await db
      .insert(dataProcessingAgreements)
      .values({
        ...data,
        tenantId,
        agreementNumber,
        createdBy,
      })
      .returning();

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId: createdBy || 'system',
      action: 'CREATE_DPA',
      resource: 'data_processing_agreements',
      resourceId: dpa.id,
      newValues: { agreementNumber, vendorName: data.vendorName, status: data.status },
      ipAddress: 'system',
      userAgent: 'system',
      sessionId: 'system',
      severity: 'medium',
      category: 'data_modification',
    });

    return dpa;
  }

  /**
   * Get DPA by ID
   */
  async getDpa(tenantId: string, dpaId: string): Promise<DataProcessingAgreement | null> {
    return (
      (await db.query.dataProcessingAgreements.findFirst({
        where: and(
          eq(dataProcessingAgreements.id, dpaId),
          eq(dataProcessingAgreements.tenantId, tenantId),
        ),
      })) || null
    );
  }

  /**
   * Update DPA
   */
  async updateDpa(
    tenantId: string,
    dpaId: string,
    updates: Partial<InsertDataProcessingAgreement>,
    updatedBy?: string,
  ): Promise<DataProcessingAgreement> {
    const existing = await this.getDpa(tenantId, dpaId);
    if (!existing) {
      throw new Error('DPA not found');
    }

    // Validate status transition if status is being updated
    if (updates.status && updates.status !== existing.status) {
      const currentStatusConfig = DPA_STATUSES[existing.status as DpaStatus];
      if (!currentStatusConfig.allowedTransitions.includes(updates.status as any)) {
        throw new Error(`Cannot transition from ${existing.status} to ${updates.status}`);
      }
    }

    const [updated] = await db
      .update(dataProcessingAgreements)
      .set({
        ...updates,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dataProcessingAgreements.id, dpaId),
          eq(dataProcessingAgreements.tenantId, tenantId),
        ),
      )
      .returning();

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId: updatedBy || 'system',
      action: 'UPDATE_DPA',
      resource: 'data_processing_agreements',
      resourceId: dpaId,
      oldValues: { status: existing.status },
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
   * List DPAs with filters and pagination
   */
  async listDpas(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      vendorName?: string;
      riskLevel?: string;
      expiringWithinDays?: number;
    } = {},
  ): Promise<{ dpas: DataProcessingAgreement[]; total: number }> {
    const { page = 1, limit = 25, status, vendorName, riskLevel, expiringWithinDays } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(dataProcessingAgreements.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(dataProcessingAgreements.status, status as any));
    }
    if (vendorName) {
      conditions.push(sql`${dataProcessingAgreements.vendorName} ILIKE ${`%${vendorName}%`}`);
    }
    if (riskLevel) {
      conditions.push(eq(dataProcessingAgreements.riskLevel, riskLevel as any));
    }
    if (expiringWithinDays) {
      const futureDate = addDays(new Date(), expiringWithinDays);
      conditions.push(
        and(
          eq(dataProcessingAgreements.status, 'active'),
          lte(dataProcessingAgreements.expirationDate, futureDate),
          gte(dataProcessingAgreements.expirationDate, new Date()),
        ),
      );
    }

    const whereClause = and(...conditions);

    const [dpas, [{ count }]] = await Promise.all([
      db
        .select()
        .from(dataProcessingAgreements)
        .where(whereClause)
        .orderBy(desc(dataProcessingAgreements.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)` })
        .from(dataProcessingAgreements)
        .where(whereClause),
    ]);

    return { dpas, total: Number(count) };
  }

  /**
   * Delete DPA (soft delete by setting status to terminated)
   */
  async deleteDpa(tenantId: string, dpaId: string, deletedBy?: string): Promise<void> {
    await this.updateDpa(tenantId, dpaId, { status: 'terminated' }, deletedBy);
  }

  // ============= DPA LIFECYCLE MANAGEMENT =============

  /**
   * Submit DPA for review
   */
  async submitForReview(
    tenantId: string,
    dpaId: string,
    submittedBy?: string,
  ): Promise<DataProcessingAgreement> {
    return await this.updateDpa(tenantId, dpaId, { status: 'pending_review' }, submittedBy);
  }

  /**
   * Approve DPA and move to pending signature
   */
  async approveForSignature(
    tenantId: string,
    dpaId: string,
    approvedBy?: string,
  ): Promise<DataProcessingAgreement> {
    return await this.updateDpa(tenantId, dpaId, { status: 'pending_signature' }, approvedBy);
  }

  /**
   * Record signatures and activate DPA
   */
  async recordSignatures(
    tenantId: string,
    dpaId: string,
    signatures: {
      ourSignatory?: string;
      ourSignatureDate?: Date;
      vendorSignatory?: string;
      vendorSignatureDate?: Date;
    },
    activatedBy?: string,
  ): Promise<DataProcessingAgreement> {
    const updates: Partial<InsertDataProcessingAgreement> = {
      ...signatures,
    };

    // If both parties have signed, activate the DPA
    if (signatures.ourSignatureDate && signatures.vendorSignatureDate) {
      updates.status = 'active';
    }

    return await this.updateDpa(tenantId, dpaId, updates, activatedBy);
  }

  /**
   * Renew DPA
   */
  async renewDpa(
    tenantId: string,
    dpaId: string,
    renewalData: {
      newExpirationDate: Date;
      renewalNotes?: string;
    },
    renewedBy?: string,
  ): Promise<DataProcessingAgreement> {
    const existing = await this.getDpa(tenantId, dpaId);
    if (!existing) {
      throw new Error('DPA not found');
    }

    return await this.updateDpa(
      tenantId,
      dpaId,
      {
        status: 'renewed',
        expirationDate: renewalData.newExpirationDate,
        renewalDate: new Date(),
      },
      renewedBy,
    );
  }

  /**
   * Get DPAs expiring soon
   */
  async getExpiringDpas(
    tenantId: string,
    withinDays: number = 30,
  ): Promise<DataProcessingAgreement[]> {
    const futureDate = addDays(new Date(), withinDays);

    return await db.query.dataProcessingAgreements.findMany({
      where: and(
        eq(dataProcessingAgreements.tenantId, tenantId),
        eq(dataProcessingAgreements.status, 'active'),
        lte(dataProcessingAgreements.expirationDate, futureDate),
        gte(dataProcessingAgreements.expirationDate, new Date()),
      ),
      orderBy: [dataProcessingAgreements.expirationDate],
    });
  }

  /**
   * Expire old DPAs
   */
  async expireDpas(): Promise<number> {
    const result = await db
      .update(dataProcessingAgreements)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dataProcessingAgreements.status, 'active'),
          lte(dataProcessingAgreements.expirationDate, new Date()),
        ),
      );

    return result.rowCount || 0;
  }

  // ============= COMPLIANCE CHECKS =============

  /**
   * Create a compliance check
   */
  async createComplianceCheck(
    tenantId: string,
    data: Omit<InsertDpaComplianceCheck, 'tenantId'>,
  ): Promise<DpaComplianceCheck> {
    const [check] = await db
      .insert(dpaComplianceChecks)
      .values({
        ...data,
        tenantId,
      })
      .returning();

    // Update DPA with last check date
    await db
      .update(dataProcessingAgreements)
      .set({
        riskAssessmentDate: data.checkDate,
        updatedAt: new Date(),
      })
      .where(eq(dataProcessingAgreements.id, data.dpaId));

    return check;
  }

  /**
   * Get compliance check by ID
   */
  async getComplianceCheck(tenantId: string, checkId: string): Promise<DpaComplianceCheck | null> {
    return (
      (await db.query.dpaComplianceChecks.findFirst({
        where: and(eq(dpaComplianceChecks.id, checkId), eq(dpaComplianceChecks.tenantId, tenantId)),
      })) || null
    );
  }

  /**
   * List compliance checks for a DPA
   */
  async listComplianceChecks(
    tenantId: string,
    dpaId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ checks: DpaComplianceCheck[]; total: number }> {
    const { page = 1, limit = 25 } = options;
    const offset = (page - 1) * limit;

    const whereClause = and(
      eq(dpaComplianceChecks.tenantId, tenantId),
      eq(dpaComplianceChecks.dpaId, dpaId),
    );

    const [checks, [{ count }]] = await Promise.all([
      db
        .select()
        .from(dpaComplianceChecks)
        .where(whereClause)
        .orderBy(desc(dpaComplianceChecks.checkDate))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)` })
        .from(dpaComplianceChecks)
        .where(whereClause),
    ]);

    return { checks, total: Number(count) };
  }

  /**
   * Update compliance check
   */
  async updateComplianceCheck(
    tenantId: string,
    checkId: string,
    updates: Partial<InsertDpaComplianceCheck>,
  ): Promise<DpaComplianceCheck> {
    const [updated] = await db
      .update(dpaComplianceChecks)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(dpaComplianceChecks.id, checkId), eq(dpaComplianceChecks.tenantId, tenantId)))
      .returning();

    return updated;
  }

  /**
   * Get DPAs with pending compliance checks
   */
  async getDpasPendingCompliance(tenantId: string): Promise<DataProcessingAgreement[]> {
    // Get DPAs that haven't been checked in over a year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return await db.query.dataProcessingAgreements.findMany({
      where: and(
        eq(dataProcessingAgreements.tenantId, tenantId),
        eq(dataProcessingAgreements.status, 'active'),
        or(
          isNull(dataProcessingAgreements.riskAssessmentDate),
          lte(dataProcessingAgreements.riskAssessmentDate, oneYearAgo),
        ),
      ),
      orderBy: [dataProcessingAgreements.riskAssessmentDate],
    });
  }

  // ============= SUB-PROCESSOR MANAGEMENT =============

  /**
   * Add sub-processor to DPA
   */
  async addSubprocessor(
    tenantId: string,
    dpaId: string,
    subprocessor: {
      name: string;
      purpose: string;
      location: string;
    },
    addedBy?: string,
  ): Promise<DataProcessingAgreement> {
    const dpa = await this.getDpa(tenantId, dpaId);
    if (!dpa) {
      throw new Error('DPA not found');
    }

    const currentSubprocessors = (dpa.subprocessors as any[]) || [];
    const newSubprocessor = {
      ...subprocessor,
      approvalDate: new Date().toISOString(),
    };

    return await this.updateDpa(
      tenantId,
      dpaId,
      {
        subprocessors: [...currentSubprocessors, newSubprocessor] as any,
      },
      addedBy,
    );
  }

  /**
   * Remove sub-processor from DPA
   */
  async removeSubprocessor(
    tenantId: string,
    dpaId: string,
    subprocessorName: string,
    removedBy?: string,
  ): Promise<DataProcessingAgreement> {
    const dpa = await this.getDpa(tenantId, dpaId);
    if (!dpa) {
      throw new Error('DPA not found');
    }

    const currentSubprocessors = (dpa.subprocessors as any[]) || [];
    const filteredSubprocessors = currentSubprocessors.filter(
      (s: any) => s.name !== subprocessorName,
    );

    return await this.updateDpa(
      tenantId,
      dpaId,
      {
        subprocessors: filteredSubprocessors as any,
      },
      removedBy,
    );
  }

  // ============= STATISTICS =============

  /**
   * Get DPA statistics
   */
  async getStats(tenantId: string): Promise<{
    totalDpas: number;
    byStatus: Record<string, number>;
    byRiskLevel: Record<string, number>;
    expiringIn30Days: number;
    pendingCompliance: number;
  }> {
    const thirtyDaysFromNow = addDays(new Date(), 30);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [totalResult, byStatusResult, byRiskResult, expiringResult, pendingComplianceResult] =
      await Promise.all([
        db
          .select({ count: sql`count(*)` })
          .from(dataProcessingAgreements)
          .where(eq(dataProcessingAgreements.tenantId, tenantId)),
        db
          .select({ status: dataProcessingAgreements.status, count: sql`count(*)` })
          .from(dataProcessingAgreements)
          .where(eq(dataProcessingAgreements.tenantId, tenantId))
          .groupBy(dataProcessingAgreements.status),
        db
          .select({ riskLevel: dataProcessingAgreements.riskLevel, count: sql`count(*)` })
          .from(dataProcessingAgreements)
          .where(eq(dataProcessingAgreements.tenantId, tenantId))
          .groupBy(dataProcessingAgreements.riskLevel),
        db
          .select({ count: sql`count(*)` })
          .from(dataProcessingAgreements)
          .where(
            and(
              eq(dataProcessingAgreements.tenantId, tenantId),
              eq(dataProcessingAgreements.status, 'active'),
              lte(dataProcessingAgreements.expirationDate, thirtyDaysFromNow),
              gte(dataProcessingAgreements.expirationDate, new Date()),
            ),
          ),
        db
          .select({ count: sql`count(*)` })
          .from(dataProcessingAgreements)
          .where(
            and(
              eq(dataProcessingAgreements.tenantId, tenantId),
              eq(dataProcessingAgreements.status, 'active'),
              or(
                isNull(dataProcessingAgreements.riskAssessmentDate),
                lte(dataProcessingAgreements.riskAssessmentDate, oneYearAgo),
              ),
            ),
          ),
      ]);

    return {
      totalDpas: Number(totalResult[0]?.count || 0),
      byStatus: Object.fromEntries(byStatusResult.map((r) => [r.status, Number(r.count)])),
      byRiskLevel: Object.fromEntries(
        byRiskResult.map((r) => [r.riskLevel || 'unknown', Number(r.count)]),
      ),
      expiringIn30Days: Number(expiringResult[0]?.count || 0),
      pendingCompliance: Number(pendingComplianceResult[0]?.count || 0),
    };
  }
}

export const dpaManagementService = new DpaManagementService();
export default dpaManagementService;
