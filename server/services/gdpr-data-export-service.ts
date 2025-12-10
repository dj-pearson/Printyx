/**
 * GDPR Data Export Service
 * Handles personal data export requests for GDPR compliance
 */

import { db } from '../db';
import { eq, and, desc, sql, inArray, gte, lte } from 'drizzle-orm';
import {
  personalDataExports,
  dataExportTemplates,
  insertPersonalDataExportSchema,
  insertDataExportTemplateSchema,
  type PersonalDataExport,
  type InsertPersonalDataExport,
  type DataExportTemplate,
  type InsertDataExportTemplate,
} from '../../shared/gdpr-core-schema';
import { businessRecords, enhancedContacts, users, companies } from '../../shared/schema';
import { auditLogs, dataAccessLogs, gdprRequests } from '../../shared/security-schema';
import { logAuditEvent, sanitizeForAudit, maskSensitiveData } from '../security-compliance';
import crypto from 'crypto';
import { format } from 'date-fns';

// ============= DATA CATEGORIES =============

export const DATA_CATEGORIES = {
  profile: {
    name: 'Profile Information',
    description: 'Basic profile and account information',
    tables: ['users', 'business_records', 'enhanced_contacts'],
  },
  contact: {
    name: 'Contact Information',
    description: 'Email, phone, and address data',
    tables: ['users', 'business_records', 'enhanced_contacts', 'company_contacts'],
  },
  activity: {
    name: 'Activity Data',
    description: 'Login history and system activity',
    tables: ['audit_logs', 'data_access_logs', 'security_sessions'],
  },
  communications: {
    name: 'Communications',
    description: 'Email logs and communication history',
    tables: ['email_logs', 'notes'],
  },
  consent: {
    name: 'Consent Records',
    description: 'Consent preferences and history',
    tables: ['consent_records', 'consent_audit_trail'],
  },
  service: {
    name: 'Service Data',
    description: 'Service tickets and support history',
    tables: ['service_tickets', 'service_notes'],
  },
  financial: {
    name: 'Financial Data',
    description: 'Invoices and payment information',
    tables: ['invoices', 'payments'],
  },
} as const;

export type DataCategory = keyof typeof DATA_CATEGORIES;

// ============= EXPORT SERVICE =============

export class GdprDataExportService {
  /**
   * Create a new data export request
   */
  async createExportRequest(
    tenantId: string,
    data: Omit<InsertPersonalDataExport, 'tenantId' | 'exportNumber' | 'status'>
  ): Promise<PersonalDataExport> {
    const exportNumber = `EXP-${format(new Date(), 'yyyyMMdd')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const [exportRequest] = await db.insert(personalDataExports).values({
      ...data,
      tenantId,
      exportNumber,
      status: 'pending',
    }).returning();

    // Log the export request
    await logAuditEvent({
      tenantId,
      userId: data.requestedBy,
      action: 'CREATE_DATA_EXPORT_REQUEST',
      resource: 'personal_data_exports',
      resourceId: exportRequest.id,
      newValues: { exportNumber, subjectId: data.subjectId, format: data.format },
      ipAddress: data.ipAddress || 'system',
      userAgent: data.userAgent || 'system',
      sessionId: 'system',
      severity: 'high',
      category: 'data_access',
    });

    return exportRequest;
  }

  /**
   * Process a data export request
   */
  async processExportRequest(
    tenantId: string,
    exportId: string,
    processedBy: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Get the export request
    const exportRequest = await db.query.personalDataExports.findFirst({
      where: and(
        eq(personalDataExports.id, exportId),
        eq(personalDataExports.tenantId, tenantId)
      ),
    });

    if (!exportRequest) {
      return { success: false, error: 'Export request not found' };
    }

    if (exportRequest.status !== 'pending') {
      return { success: false, error: `Export request is ${exportRequest.status}` };
    }

    // Update status to processing
    await db.update(personalDataExports)
      .set({
        status: 'processing',
        processingStartedAt: new Date(),
        progress: 0,
        updatedAt: new Date(),
      })
      .where(eq(personalDataExports.id, exportId));

    try {
      // Collect personal data
      const personalData = await this.collectPersonalData(
        tenantId,
        exportRequest.subjectType,
        exportRequest.subjectId,
        exportRequest.includedCategories as DataCategory[] || Object.keys(DATA_CATEGORIES) as DataCategory[],
        exportRequest.excludedCategories as DataCategory[] || [],
        exportRequest.dateRangeStart || undefined,
        exportRequest.dateRangeEnd || undefined
      );

      // Update progress
      await db.update(personalDataExports)
        .set({ progress: 50, updatedAt: new Date() })
        .where(eq(personalDataExports.id, exportId));

      // Format the data
      const formattedData = this.formatExportData(personalData, exportRequest.format || 'json');

      // Calculate file size
      const fileSize = Buffer.byteLength(JSON.stringify(formattedData), 'utf8');

      // Generate download URL (in production, this would upload to cloud storage)
      const downloadUrl = `/api/gdpr/exports/${exportId}/download`;
      const downloadExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Count records
      const recordCount = this.countRecords(personalData);

      // Update export request with results
      await db.update(personalDataExports)
        .set({
          status: 'completed',
          progress: 100,
          processingCompletedAt: new Date(),
          recordCount,
          fileSize,
          downloadUrl,
          downloadExpiry,
          updatedAt: new Date(),
        })
        .where(eq(personalDataExports.id, exportId));

      // Log completion
      await logAuditEvent({
        tenantId,
        userId: processedBy,
        action: 'COMPLETE_DATA_EXPORT',
        resource: 'personal_data_exports',
        resourceId: exportId,
        newValues: { recordCount, fileSize },
        ipAddress: 'system',
        userAgent: 'system',
        sessionId: 'system',
        severity: 'high',
        category: 'data_access',
      });

      return { success: true, data: formattedData };
    } catch (error) {
      // Update status to failed
      await db.update(personalDataExports)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(personalDataExports.id, exportId));

      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Collect personal data across all relevant tables
   */
  async collectPersonalData(
    tenantId: string,
    subjectType: string,
    subjectId: string,
    includedCategories: DataCategory[],
    excludedCategories: DataCategory[],
    dateRangeStart?: Date,
    dateRangeEnd?: Date
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        subjectType,
        subjectId,
        categories: includedCategories.filter(c => !excludedCategories.includes(c)),
        dateRange: dateRangeStart || dateRangeEnd ? {
          start: dateRangeStart?.toISOString(),
          end: dateRangeEnd?.toISOString(),
        } : null,
      },
    };

    const categoriesToInclude = includedCategories.filter(c => !excludedCategories.includes(c));

    // Profile Information
    if (categoriesToInclude.includes('profile')) {
      if (subjectType === 'user') {
        data.user = await db.query.users.findFirst({
          where: and(
            eq(users.tenantId, tenantId),
            eq(users.id, subjectId)
          ),
        });
        // Sanitize sensitive fields
        if (data.user) {
          delete data.user.password;
          delete data.user.hashedPassword;
        }
      }

      if (subjectType === 'contact' || subjectType === 'customer' || subjectType === 'lead') {
        data.businessRecord = await db.query.businessRecords.findFirst({
          where: and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.id, subjectId)
          ),
        });
      }
    }

    // Contact Information
    if (categoriesToInclude.includes('contact')) {
      data.contacts = await db.query.enhancedContacts.findMany({
        where: and(
          eq(enhancedContacts.tenantId, tenantId),
          eq(enhancedContacts.companyId, subjectId)
        ),
      });
    }

    // Activity Data
    if (categoriesToInclude.includes('activity')) {
      const activityConditions = [
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.userId, subjectId),
      ];

      if (dateRangeStart) {
        activityConditions.push(gte(auditLogs.timestamp, dateRangeStart));
      }
      if (dateRangeEnd) {
        activityConditions.push(lte(auditLogs.timestamp, dateRangeEnd));
      }

      data.auditLogs = await db.query.auditLogs.findMany({
        where: and(...activityConditions),
        orderBy: [desc(auditLogs.timestamp)],
        limit: 1000, // Limit for performance
      });

      // Sanitize audit logs
      data.auditLogs = data.auditLogs.map((log: any) => ({
        ...log,
        oldValues: log.oldValues ? sanitizeForAudit(log.oldValues) : null,
        newValues: log.newValues ? sanitizeForAudit(log.newValues) : null,
      }));

      data.dataAccessLogs = await db.query.dataAccessLogs.findMany({
        where: and(
          eq(dataAccessLogs.tenantId, tenantId),
          eq(dataAccessLogs.userId, subjectId)
        ),
        orderBy: [desc(dataAccessLogs.accessedAt)],
        limit: 1000,
      });
    }

    // Consent Records
    if (categoriesToInclude.includes('consent')) {
      // Import consent records dynamically to avoid circular dependencies
      const { consentRecords, consentAuditTrail } = await import('../../shared/gdpr-core-schema');

      data.consentRecords = await db.query.consentRecords?.findMany?.({
        where: and(
          eq(consentRecords.tenantId, tenantId),
          eq(consentRecords.subjectId, subjectId)
        ),
      }) || [];

      if (data.consentRecords.length > 0) {
        const consentIds = data.consentRecords.map((r: any) => r.id);
        data.consentAuditTrail = await db.query.consentAuditTrail?.findMany?.({
          where: and(
            eq(consentAuditTrail.tenantId, tenantId),
            inArray(consentAuditTrail.consentRecordId, consentIds)
          ),
        }) || [];
      }
    }

    // GDPR Requests
    data.gdprRequests = await db.query.gdprRequests.findMany({
      where: and(
        eq(gdprRequests.tenantId, tenantId),
        eq(gdprRequests.subjectId, subjectId)
      ),
    });

    return data;
  }

  /**
   * Format export data based on requested format
   */
  formatExportData(data: Record<string, any>, format: string): any {
    switch (format) {
      case 'json':
        return data;
      case 'csv':
        return this.convertToCsv(data);
      case 'xml':
        return this.convertToXml(data);
      default:
        return data;
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCsv(data: Record<string, any>): Record<string, string> {
    const csvData: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length > 0) {
        const headers = Object.keys(value[0]).join(',');
        const rows = value.map(item =>
          Object.values(item).map(v =>
            typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
          ).join(',')
        );
        csvData[key] = [headers, ...rows].join('\n');
      } else if (typeof value === 'object' && value !== null) {
        csvData[key] = JSON.stringify(value);
      }
    }

    return csvData;
  }

  /**
   * Convert data to XML format
   */
  private convertToXml(data: Record<string, any>): string {
    const escapeXml = (str: string) =>
      str.replace(/[<>&'"]/g, c => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      }[c] || c));

    const toXml = (obj: any, rootName: string = 'data'): string => {
      if (obj === null || obj === undefined) return `<${rootName}/>`;
      if (typeof obj !== 'object') return `<${rootName}>${escapeXml(String(obj))}</${rootName}>`;
      if (Array.isArray(obj)) {
        return obj.map((item, i) => toXml(item, 'item')).join('');
      }

      const children = Object.entries(obj)
        .map(([key, val]) => toXml(val, key))
        .join('');
      return `<${rootName}>${children}</${rootName}>`;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(data, 'personalData')}`;
  }

  /**
   * Count total records in export data
   */
  private countRecords(data: Record<string, any>): number {
    let count = 0;
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) {
        count += value.length;
      } else if (value && typeof value === 'object') {
        count += 1;
      }
    }
    return count;
  }

  /**
   * Get export request by ID
   */
  async getExportRequest(tenantId: string, exportId: string): Promise<PersonalDataExport | null> {
    return await db.query.personalDataExports.findFirst({
      where: and(
        eq(personalDataExports.id, exportId),
        eq(personalDataExports.tenantId, tenantId)
      ),
    }) || null;
  }

  /**
   * List export requests
   */
  async listExportRequests(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      subjectId?: string;
    } = {}
  ): Promise<{ exports: PersonalDataExport[]; total: number }> {
    const { page = 1, limit = 25, status, subjectId } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(personalDataExports.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(personalDataExports.status, status as any));
    }
    if (subjectId) {
      conditions.push(eq(personalDataExports.subjectId, subjectId));
    }

    const whereClause = and(...conditions);

    const [exports, [{ count }]] = await Promise.all([
      db.select()
        .from(personalDataExports)
        .where(whereClause)
        .orderBy(desc(personalDataExports.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql`count(*)` })
        .from(personalDataExports)
        .where(whereClause),
    ]);

    return { exports, total: Number(count) };
  }

  /**
   * Record a download of the export
   */
  async recordDownload(tenantId: string, exportId: string): Promise<void> {
    await db.update(personalDataExports)
      .set({
        downloadCount: sql`${personalDataExports.downloadCount} + 1`,
        lastDownloadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(personalDataExports.id, exportId),
        eq(personalDataExports.tenantId, tenantId)
      ));
  }

  /**
   * Delete expired exports
   */
  async deleteExpiredExports(): Promise<number> {
    const result = await db.delete(personalDataExports)
      .where(
        and(
          eq(personalDataExports.status, 'completed'),
          lte(personalDataExports.downloadExpiry, new Date())
        )
      );

    return result.rowCount || 0;
  }

  // ============= EXPORT TEMPLATES =============

  /**
   * Create export template
   */
  async createTemplate(
    tenantId: string,
    data: Omit<InsertDataExportTemplate, 'tenantId'>
  ): Promise<DataExportTemplate> {
    const [template] = await db.insert(dataExportTemplates).values({
      ...data,
      tenantId,
    }).returning();

    return template;
  }

  /**
   * List export templates
   */
  async listTemplates(tenantId: string): Promise<DataExportTemplate[]> {
    return await db.query.dataExportTemplates.findMany({
      where: and(
        eq(dataExportTemplates.tenantId, tenantId),
        eq(dataExportTemplates.isActive, true)
      ),
      orderBy: [desc(dataExportTemplates.isDefault), desc(dataExportTemplates.createdAt)],
    });
  }

  /**
   * Get default template
   */
  async getDefaultTemplate(tenantId: string): Promise<DataExportTemplate | null> {
    return await db.query.dataExportTemplates.findFirst({
      where: and(
        eq(dataExportTemplates.tenantId, tenantId),
        eq(dataExportTemplates.isDefault, true),
        eq(dataExportTemplates.isActive, true)
      ),
    }) || null;
  }
}

export const gdprDataExportService = new GdprDataExportService();
export default gdprDataExportService;
