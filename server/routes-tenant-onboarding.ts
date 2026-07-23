import { Router } from 'express';
import { TenantOnboardingService } from './services/tenant-onboarding-service';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-tenant-onboarding');

import {
  tenantOnboardingTemplates,
  tenantOnboardingSessions,
  integrationSetupLogs,
  dataImportValidations,
  tenantHealthScores,
  tenantCloneOperations,
  onboardingAnalytics,
  businessRecords,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireRootAdmin } from './routes-root-admin';
// Auth helpers for Supabase JWT + session fallback
import { getUserId, getTenantId } from './utils/auth-helpers';
import { requireAuth } from './replitAuth';

/**
 * TENANT ONBOARDING ROUTES
 *
 * Streamlined tenant setup with industry templates, 8-step wizard,
 * integration automation, and health validation.
 * SECURITY: All routes in this file require root admin authorization (Level 7+).
 *
 * CRITICAL SECURITY NOTE: Tenant provisioning is a platform-level operation
 * that must only be performed by authorized Printyx staff.
 */

const router = Router();

// ============================================================================
// SECURITY MIDDLEWARE - PROTECT ALL ROUTES
// ============================================================================
// Apply authentication and root admin authorization to ALL routes
router.use(requireAuth);
router.use(requireRootAdmin);

// ============================================================================
// ONBOARDING TEMPLATES
// ============================================================================

/**
 * GET /api/tenants/onboarding/templates
 * Get onboarding templates
 */
router.get('/onboarding/templates', async (req, res) => {
  try {
    const { industry, companySize } = req.query;

    const templates = await TenantOnboardingService.getTemplates(
      industry as string | undefined,
      companySize as string | undefined,
    );

    res.json({ templates });
  } catch (error) {
    log.error('Failed to fetch templates:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding templates' });
  }
});

/**
 * POST /api/tenants/onboarding/templates
 * Create an onboarding template
 */
router.post('/onboarding/templates', async (req, res) => {
  try {
    const template = await TenantOnboardingService.createTemplate(req.body);

    res.status(201).json({
      success: true,
      template,
    });
  } catch (error) {
    log.error('Failed to create template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ============================================================================
// ONBOARDING WIZARD
// ============================================================================

/**
 * POST /api/tenants/onboarding/start
 * Start a new onboarding session
 */
router.post('/onboarding/start', async (req, res) => {
  try {
    const { templateId, createdBy } = req.body;

    if (!createdBy) {
      return res.status(400).json({ error: 'createdBy is required' });
    }

    const result = await TenantOnboardingService.startOnboarding({
      templateId,
      createdBy,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to start onboarding:', error);
    res.status(500).json({
      error: 'Failed to start onboarding session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/tenants/onboarding/:sessionId
 * Get onboarding session status
 */
router.get('/onboarding/:sessionId', async (req, res) => {
  try {
    const session = await db.query.tenantOnboardingSessions.findFirst({
      where: eq(tenantOnboardingSessions.id, req.params.sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Onboarding session not found' });
    }

    res.json({ session });
  } catch (error) {
    log.error('Failed to fetch onboarding session:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding session' });
  }
});

/**
 * PUT /api/tenants/onboarding/:sessionId/step/:stepNumber
 * Complete a wizard step
 */
router.put('/onboarding/:sessionId/step/:stepNumber', async (req, res) => {
  try {
    const { stepData } = req.body;
    const stepNumber = parseInt(req.params.stepNumber, 10);

    if (!stepData) {
      return res.status(400).json({ error: 'stepData is required' });
    }

    if (stepNumber < 1 || stepNumber > 8) {
      return res.status(400).json({ error: 'stepNumber must be between 1 and 8' });
    }

    const result = await TenantOnboardingService.completeStep({
      sessionId: req.params.sessionId,
      stepNumber,
      stepData,
    });

    if (result.validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        validationErrors: result.validationErrors,
        session: result.session,
      });
    }

    res.json({
      success: true,
      session: result.session,
      nextStep: result.nextStep,
    });
  } catch (error) {
    log.error('Failed to complete step:', error);
    res.status(500).json({
      error: 'Failed to complete onboarding step',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tenants/onboarding/:sessionId/complete
 * Complete onboarding and activate tenant
 */
router.post('/onboarding/:sessionId/complete', async (req, res) => {
  try {
    const result = await TenantOnboardingService.completeOnboarding({
      sessionId: req.params.sessionId,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to complete onboarding:', error);
    res.status(500).json({
      error: 'Failed to complete onboarding',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// INTEGRATION SETUP
// ============================================================================

/**
 * POST /api/tenants/onboarding/:sessionId/integrations/setup
 * Setup an integration with automation
 */
router.post('/onboarding/:sessionId/integrations/setup', async (req, res) => {
  try {
    const { integrationType, configuration } = req.body;

    if (!integrationType || !configuration) {
      return res.status(400).json({
        error: 'Missing required fields: integrationType, configuration',
      });
    }

    const result = await TenantOnboardingService.setupIntegration({
      sessionId: req.params.sessionId,
      integrationType,
      configuration,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to setup integration:', error);
    res.status(500).json({
      error: 'Failed to setup integration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tenants/:tenantId/integrations/setup
 * Setup an integration for existing tenant
 */
router.post('/:tenantId/integrations/setup', async (req, res) => {
  try {
    const { integrationType, configuration } = req.body;

    if (!integrationType || !configuration) {
      return res.status(400).json({
        error: 'Missing required fields: integrationType, configuration',
      });
    }

    const result = await TenantOnboardingService.setupIntegration({
      tenantId: req.params.tenantId,
      integrationType,
      configuration,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to setup integration:', error);
    res.status(500).json({
      error: 'Failed to setup integration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/integrations
 * Get integration setup logs
 */
router.get('/:tenantId/integrations', async (req, res) => {
  try {
    const integrations = await db.query.integrationSetupLogs.findMany({
      where: eq(integrationSetupLogs.tenantId, req.params.tenantId),
      orderBy: desc(integrationSetupLogs.createdAt),
    });

    res.json({ integrations });
  } catch (error) {
    log.error('Failed to fetch integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integration logs' });
  }
});

// ============================================================================
// DATA IMPORT
// ============================================================================

/**
 * POST /api/tenants/onboarding/:sessionId/import/validate
 * Validate CSV data import for onboarding
 */
router.post('/onboarding/:sessionId/import/validate', async (req, res) => {
  try {
    const { dataType, fileName, fileSize, csvData } = req.body;

    if (!dataType || !fileName || !csvData || !Array.isArray(csvData)) {
      return res.status(400).json({
        error: 'Missing required fields: dataType, fileName, csvData (array)',
      });
    }

    const result = await TenantOnboardingService.importDataWithValidation({
      sessionId: req.params.sessionId,
      dataType,
      fileName,
      fileSize: fileSize || 0,
      csvData,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to validate import:', error);
    res.status(500).json({
      error: 'Failed to validate data import',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tenants/:tenantId/import/validate
 * Validate CSV data import for existing tenant
 */
router.post('/:tenantId/import/validate', async (req, res) => {
  try {
    const { dataType, fileName, fileSize, csvData } = req.body;

    if (!dataType || !fileName || !csvData || !Array.isArray(csvData)) {
      return res.status(400).json({
        error: 'Missing required fields: dataType, fileName, csvData (array)',
      });
    }

    const result = await TenantOnboardingService.importDataWithValidation({
      tenantId: req.params.tenantId,
      dataType,
      fileName,
      fileSize: fileSize || 0,
      csvData,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to validate import:', error);
    res.status(500).json({
      error: 'Failed to validate data import',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/tenants/import/:validationId
 * Get import validation results
 */
router.get('/import/:validationId', async (req, res) => {
  try {
    const validation = await db.query.dataImportValidations.findFirst({
      where: eq(dataImportValidations.id, req.params.validationId),
    });

    if (!validation) {
      return res.status(404).json({ error: 'Validation not found' });
    }

    res.json({ validation });
  } catch (error) {
    log.error('Failed to fetch validation:', error);
    res.status(500).json({ error: 'Failed to fetch validation results' });
  }
});

/**
 * PA-042: onboarding CSV import targets. Only data types whose validated CSV
 * shape can satisfy the target table's NOT NULL columns are insertable. The
 * onboarding auto-mapper (autoMapColumns) only produces a company name + contact
 * / address fields, which cleanly maps to business_records; equipment /
 * contracts / inventory require a customer FK, dates, or name/category that the
 * CSV shape does not carry, so those return an explicit error instead of
 * silently reporting a successful import.
 */
interface ImportTarget {
  table: typeof businessRecords;
  // Translate the auto-mapper field names (columnMappings[*].mappedTo) into real
  // target-table columns, dropping empty values.
  toRow: (mapped: Record<string, unknown>, tenantId: string) => Record<string, unknown>;
}

function assignIfPresent(row: Record<string, unknown>, key: string, value: unknown) {
  if (value != null && String(value).trim() !== '') row[key] = String(value);
}

const IMPORT_TARGETS: Record<string, ImportTarget> = {
  customers: {
    table: businessRecords,
    toRow: (mapped, tenantId) => {
      const row: Record<string, unknown> = {
        tenantId,
        recordType: 'customer',
        status: 'active',
        companyName: String(mapped.companyName ?? '').trim(),
      };
      assignIfPresent(row, 'primaryContactEmail', mapped.email);
      assignIfPresent(row, 'primaryContactPhone', mapped.phone);
      assignIfPresent(row, 'addressLine1', mapped.address);
      assignIfPresent(row, 'city', mapped.city);
      assignIfPresent(row, 'state', mapped.state);
      assignIfPresent(row, 'postalCode', mapped.zipCode);
      return row;
    },
  },
};

/**
 * POST /api/tenants/import/:validationId/execute
 * Execute a validated data import: insert the rows that passed validation into
 * the target table, scoped by tenant, inside a transaction so a partial failure
 * rolls the whole import back. importedRows reflects the real inserted count.
 */
router.post('/import/:validationId/execute', async (req, res) => {
  try {
    const [validation] = await db
      .select()
      .from(dataImportValidations)
      .where(eq(dataImportValidations.id, req.params.validationId))
      .limit(1);

    if (!validation) {
      return res.status(404).json({ error: 'Validation not found' });
    }
    if (validation.importExecuted) {
      return res.status(409).json({ error: 'Import already executed for this validation' });
    }

    const target = IMPORT_TARGETS[validation.dataType];
    if (!target) {
      return res.status(400).json({
        error: `Import execution is not supported for data type "${validation.dataType}"`,
        code: 'UNSUPPORTED_IMPORT_TYPE',
      });
    }

    const tenantId = validation.tenantId || getTenantId(req) || req.body?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'No tenant context for this import' });
    }

    const rawRows = Array.isArray(validation.rawRows) ? validation.rawRows : [];
    const columnMappings = validation.columnMappings ?? {};
    // errors carry 1-based row numbers; those rows failed validation and are skipped.
    const invalidRowNumbers = new Set((validation.errors ?? []).map((e) => e.row));

    const rowsToInsert: Record<string, unknown>[] = [];
    rawRows.forEach((raw, index) => {
      if (invalidRowNumbers.has(index + 1)) return;
      const mapped: Record<string, unknown> = {};
      for (const [csvColumn, mapping] of Object.entries(columnMappings)) {
        if (mapping?.mappedTo) mapped[mapping.mappedTo] = raw[csvColumn];
      }
      rowsToInsert.push(target.toRow(mapped, tenantId));
    });

    let importedRows = 0;
    if (rowsToInsert.length > 0) {
      await db.transaction(async (tx) => {
        await tx
          .insert(target.table)
          .values(rowsToInsert as (typeof businessRecords.$inferInsert)[]);
        importedRows = rowsToInsert.length;
      });
    }

    const failedRows = rawRows.length - importedRows;

    const [updated] = await db
      .update(dataImportValidations)
      .set({
        importExecuted: true,
        importedAt: new Date(),
        importedRows,
        failedRows,
      })
      .where(eq(dataImportValidations.id, req.params.validationId))
      .returning();

    res.json({
      success: true,
      importedRows,
      failedRows,
      validation: updated,
    });
  } catch (error) {
    log.error('Failed to execute import:', error);
    res.status(500).json({ error: 'Failed to execute data import' });
  }
});

// ============================================================================
// HEALTH VALIDATION
// ============================================================================

/**
 * POST /api/tenants/:tenantId/validate-health
 * Run comprehensive health validation
 */
router.post('/:tenantId/validate-health', async (req, res) => {
  try {
    const healthScore = await TenantOnboardingService.validateTenantHealth(req.params.tenantId);

    res.status(201).json({
      success: true,
      healthScore,
    });
  } catch (error) {
    log.error('Failed to validate health:', error);
    res.status(500).json({
      error: 'Failed to validate tenant health',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/health
 * Get tenant health score
 */
router.get('/:tenantId/health', async (req, res) => {
  try {
    const healthScore = await db.query.tenantHealthScores.findFirst({
      where: eq(tenantHealthScores.tenantId, req.params.tenantId),
      orderBy: desc(tenantHealthScores.calculatedAt),
    });

    if (!healthScore) {
      return res.status(404).json({ error: 'Health score not found' });
    }

    res.json({ healthScore });
  } catch (error) {
    log.error('Failed to fetch health score:', error);
    res.status(500).json({ error: 'Failed to fetch health score' });
  }
});

// ============================================================================
// TENANT CLONING
// ============================================================================

/**
 * POST /api/tenants/:tenantId/clone
 * Clone tenant configuration
 */
router.post('/:tenantId/clone', async (req, res) => {
  try {
    const { cloneSettings, modifications, initiatedBy } = req.body;

    if (!cloneSettings || !initiatedBy) {
      return res.status(400).json({
        error: 'Missing required fields: cloneSettings, initiatedBy',
      });
    }

    const result = await TenantOnboardingService.cloneTenant({
      sourceTenantId: req.params.tenantId,
      cloneSettings,
      modifications: modifications || [],
      initiatedBy,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to clone tenant:', error);
    res.status(500).json({
      error: 'Failed to clone tenant',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/tenants/clone/:operationId
 * Get clone operation status
 */
router.get('/clone/:operationId', async (req, res) => {
  try {
    const operation = await db.query.tenantCloneOperations.findFirst({
      where: eq(tenantCloneOperations.id, req.params.operationId),
    });

    if (!operation) {
      return res.status(404).json({ error: 'Clone operation not found' });
    }

    res.json({ operation });
  } catch (error) {
    log.error('Failed to fetch clone operation:', error);
    res.status(500).json({ error: 'Failed to fetch clone operation' });
  }
});

// ============================================================================
// ONBOARDING ANALYTICS
// ============================================================================

/**
 * GET /api/tenants/onboarding/analytics
 * Get onboarding analytics and metrics
 */
router.get('/onboarding/analytics', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    // Get recent analytics record
    const analytics = await db.query.onboardingAnalytics.findFirst({
      where: eq(onboardingAnalytics.period, period as string),
      orderBy: desc(onboardingAnalytics.createdAt),
    });

    // Get summary stats
    const sessions = await db.query.tenantOnboardingSessions.findMany({
      limit: 100,
      orderBy: desc(tenantOnboardingSessions.createdAt),
    });

    const completed = sessions.filter((s) => s.status === 'completed').length;
    const inProgress = sessions.filter((s) => s.status === 'in_progress').length;
    const abandoned = sessions.filter((s) => s.status === 'abandoned').length;

    res.json({
      analytics,
      summary: {
        total: sessions.length,
        completed,
        inProgress,
        abandoned,
        completionRate: sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0,
      },
    });
  } catch (error) {
    log.error('Failed to fetch analytics:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding analytics' });
  }
});

/**
 * GET /api/tenants/onboarding/recent
 * Get recent onboarding sessions
 */
router.get('/onboarding/recent', async (req, res) => {
  try {
    const { limit = 20, status } = req.query;

    const sessions = await db.query.tenantOnboardingSessions.findMany({
      where: status ? eq(tenantOnboardingSessions.status, status as any) : undefined,
      orderBy: desc(tenantOnboardingSessions.createdAt),
      limit: Number(limit),
    });

    res.json({ sessions });
  } catch (error) {
    log.error('Failed to fetch recent sessions:', error);
    res.status(500).json({ error: 'Failed to fetch recent onboarding sessions' });
  }
});

export default router;
