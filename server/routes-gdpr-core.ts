/**
 * GDPR Core Features API Routes
 * Endpoints for data export, consent management, DPA tracking, and contact deduplication
 */

import { Router, type Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { requireRole } from './rbac-middleware';
import { enhanceUserContext, requireLevel } from './middleware/rbac-route-helper';
import { auditLogMiddleware } from './security-compliance';

// Services
import { gdprDataExportService, DATA_CATEGORIES } from './services/gdpr-data-export-service';
import { consentManagementService, CONSENT_TYPES } from './services/consent-management-service';
import { dpaManagementService, DPA_STATUSES } from './services/dpa-management-service';
import { contactDeduplicationService } from './services/contact-deduplication-service';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-gdpr-core');

// Schemas
import {
  insertPersonalDataExportSchema,
  insertConsentRecordSchema,
  insertDataProcessingAgreementSchema,
  insertDuplicateDetectionRuleSchema,
} from '../shared/gdpr-core-schema';

const router = Router();

// Apply security middleware to all routes
router.use(resolveTenant);
router.use(requireTenant);
router.use(enhanceUserContext);

// ============================================================================
// DATA EXPORT ENDPOINTS
// ============================================================================

/**
 * Get available data categories for export
 */
router.get(
  '/data-export/categories',
  requireRole(['admin', 'compliance_officer', 'manager']),
  async (req: TenantRequest, res: Response) => {
    res.json({ categories: DATA_CATEGORIES });
  },
);

/**
 * Create data export request
 */
router.post(
  '/data-export/requests',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  auditLogMiddleware('CREATE_DATA_EXPORT', 'personal_data_exports', 'high', 'data_access'),
  async (req: TenantRequest, res: Response) => {
    try {
      const exportRequest = await gdprDataExportService.createExportRequest(req.tenantId!, {
        ...req.body,
        requestedBy: req.user!.id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
      });

      res.status(201).json({
        message: 'Data export request created successfully',
        export: exportRequest,
      });
    } catch (error) {
      log.error('Error creating data export request:', error);
      res.status(500).json({ message: 'Failed to create data export request' });
    }
  },
);

/**
 * List data export requests
 */
router.get(
  '/data-export/requests',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit, status, subjectId } = req.query;
      const result = await gdprDataExportService.listExportRequests(req.tenantId!, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string,
        subjectId: subjectId as string,
      });

      res.json(result);
    } catch (error) {
      log.error('Error listing data export requests:', error);
      res.status(500).json({ message: 'Failed to list data export requests' });
    }
  },
);

/**
 * Get data export request by ID
 */
router.get(
  '/data-export/requests/:id',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const exportRequest = await gdprDataExportService.getExportRequest(
        req.tenantId!,
        req.params.id,
      );

      if (!exportRequest) {
        return res.status(404).json({ message: 'Export request not found' });
      }

      res.json(exportRequest);
    } catch (error) {
      log.error('Error fetching data export request:', error);
      res.status(500).json({ message: 'Failed to fetch data export request' });
    }
  },
);

/**
 * Process data export request
 */
router.post(
  '/data-export/requests/:id/process',
  requireRole(['admin', 'compliance_officer']),
  auditLogMiddleware('PROCESS_DATA_EXPORT', 'personal_data_exports', 'high', 'data_access'),
  async (req: TenantRequest, res: Response) => {
    try {
      const result = await gdprDataExportService.processExportRequest(
        req.tenantId!,
        req.params.id,
        req.user!.id,
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({
        message: 'Data export processed successfully',
        data: result.data,
      });
    } catch (error) {
      log.error('Error processing data export:', error);
      res.status(500).json({ message: 'Failed to process data export' });
    }
  },
);

/**
 * Download data export
 */
router.get(
  '/data-export/requests/:id/download',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  auditLogMiddleware('DOWNLOAD_DATA_EXPORT', 'personal_data_exports', 'high', 'data_access'),
  async (req: TenantRequest, res: Response) => {
    try {
      const exportRequest = await gdprDataExportService.getExportRequest(
        req.tenantId!,
        req.params.id,
      );

      if (!exportRequest) {
        return res.status(404).json({ message: 'Export request not found' });
      }

      if (exportRequest.status !== 'completed') {
        return res.status(400).json({ message: 'Export is not ready for download' });
      }

      if (exportRequest.downloadExpiry && exportRequest.downloadExpiry < new Date()) {
        return res.status(410).json({ message: 'Download link has expired' });
      }

      // Record the download
      await gdprDataExportService.recordDownload(req.tenantId!, req.params.id);

      // In a real implementation, you would serve the actual file
      // For now, we'll return the data that was exported
      const result = await gdprDataExportService.processExportRequest(
        req.tenantId!,
        req.params.id,
        req.user!.id,
      );

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="data-export-${req.params.id}.json"`,
      );
      res.json(result.data);
    } catch (error) {
      log.error('Error downloading data export:', error);
      res.status(500).json({ message: 'Failed to download data export' });
    }
  },
);

/**
 * List export templates
 */
router.get(
  '/data-export/templates',
  requireRole(['admin', 'compliance_officer', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const templates = await gdprDataExportService.listTemplates(req.tenantId!);
      res.json({ templates });
    } catch (error) {
      log.error('Error listing export templates:', error);
      res.status(500).json({ message: 'Failed to list export templates' });
    }
  },
);

/**
 * Create export template
 */
router.post(
  '/data-export/templates',
  requireRole(['admin', 'compliance_officer']),
  async (req: TenantRequest, res: Response) => {
    try {
      const template = await gdprDataExportService.createTemplate(req.tenantId!, req.body);
      res.status(201).json({ template });
    } catch (error) {
      log.error('Error creating export template:', error);
      res.status(500).json({ message: 'Failed to create export template' });
    }
  },
);

// ============================================================================
// CONSENT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Get available consent types
 */
router.get('/consent/types', async (req: TenantRequest, res: Response) => {
  res.json({ consentTypes: CONSENT_TYPES });
});

/**
 * Record consent
 */
router.post(
  '/consent',
  auditLogMiddleware('RECORD_CONSENT', 'consent_records', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const consent = await consentManagementService.recordConsent(
        req.tenantId!,
        {
          ...req.body,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
        },
        req.user?.id,
      );

      res.status(201).json({
        message: 'Consent recorded successfully',
        consent,
      });
    } catch (error) {
      log.error('Error recording consent:', error);
      res.status(500).json({ message: 'Failed to record consent' });
    }
  },
);

/**
 * Bulk record consents
 */
router.post(
  '/consent/bulk',
  auditLogMiddleware('BULK_RECORD_CONSENT', 'consent_records', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const { subjectType, subjectId, subjectEmail, consentTypes, ...commonData } = req.body;

      const consents = await consentManagementService.bulkRecordConsents(
        req.tenantId!,
        subjectType,
        subjectId,
        subjectEmail,
        consentTypes,
        {
          ...commonData,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
        },
        req.user?.id,
      );

      res.status(201).json({
        message: 'Consents recorded successfully',
        consents,
      });
    } catch (error) {
      log.error('Error bulk recording consents:', error);
      res.status(500).json({ message: 'Failed to record consents' });
    }
  },
);

/**
 * Withdraw consent
 */
router.post(
  '/consent/:id/withdraw',
  auditLogMiddleware('WITHDRAW_CONSENT', 'consent_records', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const consent = await consentManagementService.withdrawConsent(
        req.tenantId!,
        req.params.id,
        {
          ...req.body,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
        },
        req.user?.id,
      );

      res.json({
        message: 'Consent withdrawn successfully',
        consent,
      });
    } catch (error) {
      log.error('Error withdrawing consent:', error);
      res.status(500).json({ message: 'Failed to withdraw consent' });
    }
  },
);

/**
 * Get consents for a subject
 */
router.get('/consent/subject/:type/:id', async (req: TenantRequest, res: Response) => {
  try {
    const consents = await consentManagementService.getSubjectConsents(
      req.tenantId!,
      req.params.type,
      req.params.id,
    );

    res.json({ consents });
  } catch (error) {
    log.error('Error fetching subject consents:', error);
    res.status(500).json({ message: 'Failed to fetch subject consents' });
  }
});

/**
 * Get consent summary for a subject
 */
router.get('/consent/subject/:id/summary', async (req: TenantRequest, res: Response) => {
  try {
    const summary = await consentManagementService.getConsentSummary(req.tenantId!, req.params.id);

    res.json({ summary });
  } catch (error) {
    log.error('Error fetching consent summary:', error);
    res.status(500).json({ message: 'Failed to fetch consent summary' });
  }
});

/**
 * Check if subject has consent for a type
 */
router.get('/consent/check/:subjectId/:consentType', async (req: TenantRequest, res: Response) => {
  try {
    const hasConsent = await consentManagementService.hasConsent(
      req.tenantId!,
      req.params.subjectId,
      req.params.consentType as any,
    );

    res.json({ hasConsent });
  } catch (error) {
    log.error('Error checking consent:', error);
    res.status(500).json({ message: 'Failed to check consent' });
  }
});

/**
 * List all consents
 */
router.get(
  '/consent',
  requireRole(['admin', 'compliance_officer', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit, status, consentType, subjectType } = req.query;
      const result = await consentManagementService.listConsents(req.tenantId!, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string,
        consentType: consentType as string,
        subjectType: subjectType as string,
      });

      res.json(result);
    } catch (error) {
      log.error('Error listing consents:', error);
      res.status(500).json({ message: 'Failed to list consents' });
    }
  },
);

/**
 * Get consent audit history
 */
router.get(
  '/consent/:id/history',
  requireRole(['admin', 'compliance_officer']),
  async (req: TenantRequest, res: Response) => {
    try {
      const history = await consentManagementService.getConsentHistory(
        req.tenantId!,
        req.params.id,
      );

      res.json({ history });
    } catch (error) {
      log.error('Error fetching consent history:', error);
      res.status(500).json({ message: 'Failed to fetch consent history' });
    }
  },
);

/**
 * Get consent statistics
 */
router.get(
  '/consent/stats',
  requireRole(['admin', 'compliance_officer', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const stats = await consentManagementService.getConsentStats(req.tenantId!);
      res.json(stats);
    } catch (error) {
      log.error('Error fetching consent stats:', error);
      res.status(500).json({ message: 'Failed to fetch consent statistics' });
    }
  },
);

/**
 * List consent templates
 */
router.get(
  '/consent/templates',
  requireRole(['admin', 'compliance_officer']),
  async (req: TenantRequest, res: Response) => {
    try {
      const templates = await consentManagementService.listTemplates(req.tenantId!);
      res.json({ templates });
    } catch (error) {
      log.error('Error listing consent templates:', error);
      res.status(500).json({ message: 'Failed to list consent templates' });
    }
  },
);

/**
 * Create consent template
 */
router.post(
  '/consent/templates',
  requireRole(['admin', 'compliance_officer']),
  async (req: TenantRequest, res: Response) => {
    try {
      const template = await consentManagementService.createTemplate(req.tenantId!, req.body);
      res.status(201).json({ template });
    } catch (error) {
      log.error('Error creating consent template:', error);
      res.status(500).json({ message: 'Failed to create consent template' });
    }
  },
);

// ============================================================================
// DATA PROCESSING AGREEMENTS ENDPOINTS
// ============================================================================

/**
 * Get DPA status definitions
 */
router.get(
  '/dpa/statuses',
  requireRole(['admin', 'compliance_officer', 'legal']),
  async (req: TenantRequest, res: Response) => {
    res.json({ statuses: DPA_STATUSES });
  },
);

/**
 * Create DPA
 */
router.post(
  '/dpa',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware('CREATE_DPA', 'data_processing_agreements', 'high', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.createDpa(req.tenantId!, req.body, req.user!.id);

      res.status(201).json({
        message: 'DPA created successfully',
        dpa,
      });
    } catch (error) {
      log.error('Error creating DPA:', error);
      res.status(500).json({ message: 'Failed to create DPA' });
    }
  },
);

/**
 * List DPAs
 */
router.get(
  '/dpa',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit, status, vendorName, riskLevel, expiringWithinDays } = req.query;
      const result = await dpaManagementService.listDpas(req.tenantId!, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string,
        vendorName: vendorName as string,
        riskLevel: riskLevel as string,
        expiringWithinDays: expiringWithinDays ? Number(expiringWithinDays) : undefined,
      });

      res.json(result);
    } catch (error) {
      log.error('Error listing DPAs:', error);
      res.status(500).json({ message: 'Failed to list DPAs' });
    }
  },
);

/**
 * Get DPA by ID
 */
router.get(
  '/dpa/:id',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.getDpa(req.tenantId!, req.params.id);

      if (!dpa) {
        return res.status(404).json({ message: 'DPA not found' });
      }

      res.json(dpa);
    } catch (error) {
      log.error('Error fetching DPA:', error);
      res.status(500).json({ message: 'Failed to fetch DPA' });
    }
  },
);

/**
 * Update DPA
 */
router.put(
  '/dpa/:id',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware('UPDATE_DPA', 'data_processing_agreements', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.updateDpa(
        req.tenantId!,
        req.params.id,
        req.body,
        req.user!.id,
      );

      res.json({
        message: 'DPA updated successfully',
        dpa,
      });
    } catch (error) {
      log.error('Error updating DPA:', error);
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to update DPA' });
    }
  },
);

/**
 * Submit DPA for review
 */
router.post(
  '/dpa/:id/submit-review',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware(
    'SUBMIT_DPA_REVIEW',
    'data_processing_agreements',
    'medium',
    'data_modification',
  ),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.submitForReview(
        req.tenantId!,
        req.params.id,
        req.user!.id,
      );

      res.json({
        message: 'DPA submitted for review',
        dpa,
      });
    } catch (error) {
      log.error('Error submitting DPA for review:', error);
      res.status(500).json({ message: 'Failed to submit DPA for review' });
    }
  },
);

/**
 * Approve DPA for signature
 */
router.post(
  '/dpa/:id/approve',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware('APPROVE_DPA', 'data_processing_agreements', 'high', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.approveForSignature(
        req.tenantId!,
        req.params.id,
        req.user!.id,
      );

      res.json({
        message: 'DPA approved for signature',
        dpa,
      });
    } catch (error) {
      log.error('Error approving DPA:', error);
      res.status(500).json({ message: 'Failed to approve DPA' });
    }
  },
);

/**
 * Record DPA signatures
 */
router.post(
  '/dpa/:id/sign',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware('SIGN_DPA', 'data_processing_agreements', 'high', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.recordSignatures(
        req.tenantId!,
        req.params.id,
        req.body,
        req.user!.id,
      );

      res.json({
        message: 'Signatures recorded',
        dpa,
      });
    } catch (error) {
      log.error('Error recording signatures:', error);
      res.status(500).json({ message: 'Failed to record signatures' });
    }
  },
);

/**
 * Renew DPA
 */
router.post(
  '/dpa/:id/renew',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware('RENEW_DPA', 'data_processing_agreements', 'high', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.renewDpa(
        req.tenantId!,
        req.params.id,
        {
          newExpirationDate: new Date(req.body.newExpirationDate),
          renewalNotes: req.body.renewalNotes,
        },
        req.user!.id,
      );

      res.json({
        message: 'DPA renewed',
        dpa,
      });
    } catch (error) {
      log.error('Error renewing DPA:', error);
      res.status(500).json({ message: 'Failed to renew DPA' });
    }
  },
);

/**
 * Get expiring DPAs
 */
router.get(
  '/dpa/alerts/expiring',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const withinDays = req.query.days ? Number(req.query.days) : 30;
      const dpas = await dpaManagementService.getExpiringDpas(req.tenantId!, withinDays);

      res.json({ dpas, withinDays });
    } catch (error) {
      log.error('Error fetching expiring DPAs:', error);
      res.status(500).json({ message: 'Failed to fetch expiring DPAs' });
    }
  },
);

/**
 * Get DPAs pending compliance check
 */
router.get(
  '/dpa/alerts/pending-compliance',
  requireRole(['admin', 'compliance_officer']),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpas = await dpaManagementService.getDpasPendingCompliance(req.tenantId!);
      res.json({ dpas });
    } catch (error) {
      log.error('Error fetching DPAs pending compliance:', error);
      res.status(500).json({ message: 'Failed to fetch DPAs pending compliance' });
    }
  },
);

/**
 * Add sub-processor to DPA
 */
router.post(
  '/dpa/:id/subprocessors',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware(
    'ADD_SUBPROCESSOR',
    'data_processing_agreements',
    'medium',
    'data_modification',
  ),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.addSubprocessor(
        req.tenantId!,
        req.params.id,
        req.body,
        req.user!.id,
      );

      res.json({
        message: 'Sub-processor added',
        dpa,
      });
    } catch (error) {
      log.error('Error adding sub-processor:', error);
      res.status(500).json({ message: 'Failed to add sub-processor' });
    }
  },
);

/**
 * Remove sub-processor from DPA
 */
router.delete(
  '/dpa/:id/subprocessors/:name',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware(
    'REMOVE_SUBPROCESSOR',
    'data_processing_agreements',
    'medium',
    'data_modification',
  ),
  async (req: TenantRequest, res: Response) => {
    try {
      const dpa = await dpaManagementService.removeSubprocessor(
        req.tenantId!,
        req.params.id,
        req.params.name,
        req.user!.id,
      );

      res.json({
        message: 'Sub-processor removed',
        dpa,
      });
    } catch (error) {
      log.error('Error removing sub-processor:', error);
      res.status(500).json({ message: 'Failed to remove sub-processor' });
    }
  },
);

/**
 * Create compliance check for DPA
 */
router.post(
  '/dpa/:id/compliance-checks',
  requireRole(['admin', 'compliance_officer']),
  auditLogMiddleware(
    'CREATE_COMPLIANCE_CHECK',
    'dpa_compliance_checks',
    'high',
    'data_modification',
  ),
  async (req: TenantRequest, res: Response) => {
    try {
      const check = await dpaManagementService.createComplianceCheck(req.tenantId!, {
        ...req.body,
        dpaId: req.params.id,
        reviewedBy: req.user!.id,
      });

      res.status(201).json({
        message: 'Compliance check created',
        check,
      });
    } catch (error) {
      log.error('Error creating compliance check:', error);
      res.status(500).json({ message: 'Failed to create compliance check' });
    }
  },
);

/**
 * List compliance checks for DPA
 */
router.get(
  '/dpa/:id/compliance-checks',
  requireRole(['admin', 'compliance_officer', 'legal']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit } = req.query;
      const result = await dpaManagementService.listComplianceChecks(req.tenantId!, req.params.id, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json(result);
    } catch (error) {
      log.error('Error listing compliance checks:', error);
      res.status(500).json({ message: 'Failed to list compliance checks' });
    }
  },
);

/**
 * Get DPA statistics
 */
router.get(
  '/dpa/stats',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const stats = await dpaManagementService.getStats(req.tenantId!);
      res.json(stats);
    } catch (error) {
      log.error('Error fetching DPA stats:', error);
      res.status(500).json({ message: 'Failed to fetch DPA statistics' });
    }
  },
);

// ============================================================================
// CONTACT DEDUPLICATION ENDPOINTS
// ============================================================================

/**
 * Create duplicate detection rule
 */
router.post(
  '/deduplication/rules',
  requireRole(['admin', 'manager']),
  auditLogMiddleware(
    'CREATE_DEDUP_RULE',
    'duplicate_detection_rules',
    'medium',
    'data_modification',
  ),
  async (req: TenantRequest, res: Response) => {
    try {
      const rule = await contactDeduplicationService.createRule(
        req.tenantId!,
        req.body,
        req.user!.id,
      );

      res.status(201).json({
        message: 'Duplicate detection rule created',
        rule,
      });
    } catch (error) {
      log.error('Error creating dedup rule:', error);
      res.status(500).json({ message: 'Failed to create duplicate detection rule' });
    }
  },
);

/**
 * List duplicate detection rules
 */
router.get(
  '/deduplication/rules',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { entityType } = req.query;
      const rules = await contactDeduplicationService.listRules(
        req.tenantId!,
        entityType as string,
      );

      res.json({ rules });
    } catch (error) {
      log.error('Error listing dedup rules:', error);
      res.status(500).json({ message: 'Failed to list duplicate detection rules' });
    }
  },
);

/**
 * Get duplicate detection rule
 */
router.get(
  '/deduplication/rules/:id',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const rule = await contactDeduplicationService.getRule(req.tenantId!, req.params.id);

      if (!rule) {
        return res.status(404).json({ message: 'Rule not found' });
      }

      res.json(rule);
    } catch (error) {
      log.error('Error fetching dedup rule:', error);
      res.status(500).json({ message: 'Failed to fetch duplicate detection rule' });
    }
  },
);

/**
 * Update duplicate detection rule
 */
router.put(
  '/deduplication/rules/:id',
  requireRole(['admin', 'manager']),
  auditLogMiddleware(
    'UPDATE_DEDUP_RULE',
    'duplicate_detection_rules',
    'medium',
    'data_modification',
  ),
  async (req: TenantRequest, res: Response) => {
    try {
      const rule = await contactDeduplicationService.updateRule(
        req.tenantId!,
        req.params.id,
        req.body,
      );

      res.json({
        message: 'Rule updated',
        rule,
      });
    } catch (error) {
      log.error('Error updating dedup rule:', error);
      res.status(500).json({ message: 'Failed to update duplicate detection rule' });
    }
  },
);

/**
 * Find duplicates for a specific record
 */
router.post(
  '/deduplication/find',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { entityType, record, ruleId } = req.body;

      const duplicates = await contactDeduplicationService.findDuplicatesForRecord(
        req.tenantId!,
        entityType,
        record,
        ruleId,
      );

      res.json({ duplicates });
    } catch (error) {
      log.error('Error finding duplicates:', error);
      res.status(500).json({ message: 'Failed to find duplicates' });
    }
  },
);

/**
 * List duplicate matches
 */
router.get(
  '/deduplication/matches',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit, status, entityType, minScore } = req.query;
      const result = await contactDeduplicationService.listMatches(req.tenantId!, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string,
        entityType: entityType as string,
        minScore: minScore ? Number(minScore) : undefined,
      });

      res.json(result);
    } catch (error) {
      log.error('Error listing matches:', error);
      res.status(500).json({ message: 'Failed to list duplicate matches' });
    }
  },
);

/**
 * Resolve duplicate match
 */
router.post(
  '/deduplication/matches/:id/resolve',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('RESOLVE_DUPLICATE', 'duplicate_matches', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const { resolution, notes } = req.body;

      const match = await contactDeduplicationService.resolveMatch(
        req.tenantId!,
        req.params.id,
        resolution,
        req.user!.id,
        notes,
      );

      res.json({
        message: 'Match resolved',
        match,
      });
    } catch (error) {
      log.error('Error resolving match:', error);
      res.status(500).json({ message: 'Failed to resolve duplicate match' });
    }
  },
);

/**
 * Merge records
 */
router.post(
  '/deduplication/merge',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('MERGE_RECORDS', 'contact_merge_history', 'high', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const {
        entityType,
        survivingRecordId,
        mergedRecordId,
        fieldResolutions,
        duplicateMatchId,
        mergeReason,
      } = req.body;

      const history = await contactDeduplicationService.mergeRecords(
        req.tenantId!,
        entityType,
        survivingRecordId,
        mergedRecordId,
        fieldResolutions,
        req.user!.id,
        duplicateMatchId,
        mergeReason,
      );

      res.json({
        message: 'Records merged successfully',
        mergeHistory: history,
      });
    } catch (error) {
      log.error('Error merging records:', error);
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to merge records' });
    }
  },
);

/**
 * Rollback merge
 */
router.post(
  '/deduplication/merge/:id/rollback',
  requireRole(['admin']),
  auditLogMiddleware('ROLLBACK_MERGE', 'contact_merge_history', 'high', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      await contactDeduplicationService.rollbackMerge(
        req.tenantId!,
        req.params.id,
        req.user!.id,
        req.body.reason,
      );

      res.json({ message: 'Merge rolled back successfully' });
    } catch (error) {
      log.error('Error rolling back merge:', error);
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to rollback merge' });
    }
  },
);

/**
 * Get merge history for a record
 */
router.get(
  '/deduplication/merge/history/:recordId',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const history = await contactDeduplicationService.getMergeHistory(
        req.tenantId!,
        req.params.recordId,
      );

      res.json({ history });
    } catch (error) {
      log.error('Error fetching merge history:', error);
      res.status(500).json({ message: 'Failed to fetch merge history' });
    }
  },
);

/**
 * Create duplicate scan job
 */
router.post(
  '/deduplication/scan',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('CREATE_SCAN_JOB', 'duplicate_scan_jobs', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const job = await contactDeduplicationService.createScanJob(
        req.tenantId!,
        {
          ...req.body,
          triggerType: 'manual',
        },
        req.user!.id,
      );

      res.status(201).json({
        message: 'Scan job created',
        job,
      });
    } catch (error) {
      log.error('Error creating scan job:', error);
      res.status(500).json({ message: 'Failed to create scan job' });
    }
  },
);

/**
 * Run scan job
 */
router.post(
  '/deduplication/scan/:id/run',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      // Run the scan job asynchronously
      contactDeduplicationService
        .runScanJob(req.tenantId!, req.params.id)
        .catch((err) => log.error('Scan job error:', err));

      res.json({ message: 'Scan job started' });
    } catch (error) {
      log.error('Error running scan job:', error);
      res.status(500).json({ message: 'Failed to start scan job' });
    }
  },
);

/**
 * List scan jobs
 */
router.get(
  '/deduplication/scan',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit, status } = req.query;
      const result = await contactDeduplicationService.listScanJobs(req.tenantId!, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string,
      });

      res.json(result);
    } catch (error) {
      log.error('Error listing scan jobs:', error);
      res.status(500).json({ message: 'Failed to list scan jobs' });
    }
  },
);

/**
 * Get deduplication statistics
 */
router.get(
  '/deduplication/stats',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const stats = await contactDeduplicationService.getStats(req.tenantId!);
      res.json(stats);
    } catch (error) {
      log.error('Error fetching dedup stats:', error);
      res.status(500).json({ message: 'Failed to fetch deduplication statistics' });
    }
  },
);

export default router;
