/**
 * CSV Import Routes
 *
 * API endpoints for the unified CSV import system with:
 * - File upload and validation
 * - Column mapping (auto and manual)
 * - Duplicate detection and resolution
 * - AI-powered refinement (premium feature)
 * - Import execution with progress tracking
 */

import type { Express, Request, Response } from 'express';
import multer from 'multer';
import { resolveTenant, requireTenant, type TenantRequest } from './middleware/tenancy';
import { isAuthenticated } from './replitAuth';
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';
import { requireFeature } from './middleware/subscription';
import { CsvImportService, parseCSVContent, autoMapColumns } from './services/csv-import-service';
import { aiCsvRefinementService } from './services/ai-csv-refinement-service';
import {
  ENTITY_TEMPLATES,
  startImportRequestSchema,
  columnMappingRequestSchema,
  duplicateResolutionRequestSchema,
} from '@shared/csv-import-schema';

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

type ImportRequest = AuthenticatedRequest & TenantRequest;

export function registerCsvImportRoutes(app: Express) {
  // Apply authentication and RBAC context to all import routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/import', isAuthenticated, enhanceUserContext);

  // ============= TEMPLATE ENDPOINTS =============

  /**
   * Get available entity types for import
   */
  app.get(
    '/api/import/entity-types',
    resolveTenant,
    requireTenant,
    async (_req: ImportRequest, res: Response) => {
      try {
        const entityTypes = Object.keys(ENTITY_TEMPLATES).map((type) => ({
          type,
          label: formatEntityLabel(type),
          columnCount: ENTITY_TEMPLATES[type].length,
          requiredColumns: ENTITY_TEMPLATES[type].filter((c) => c.required).length,
        }));

        res.json(entityTypes);
      } catch (error: any) {
        console.error('Error fetching entity types:', error);
        res.status(500).json({ message: 'Failed to fetch entity types' });
      }
    },
  );

  /**
   * Get template columns for an entity type
   */
  app.get(
    '/api/import/templates/:entityType',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { entityType } = req.params;
        const columns = CsvImportService.getTemplateColumns(entityType);

        if (columns.length === 0) {
          return res.status(404).json({ message: `Unknown entity type: ${entityType}` });
        }

        res.json({
          entityType,
          columns,
          requiredColumns: columns.filter((c) => c.required).map((c) => c.name),
        });
      } catch (error: any) {
        console.error('Error fetching template:', error);
        res.status(500).json({ message: 'Failed to fetch template' });
      }
    },
  );

  /**
   * Download CSV template for an entity type
   */
  app.get(
    '/api/import/templates/:entityType/download',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { entityType } = req.params;
        const csvContent = CsvImportService.generateTemplate(entityType);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${entityType}_import_template.csv"`,
        );
        res.send(csvContent);
      } catch (error: any) {
        console.error('Error generating template:', error);
        res.status(500).json({ message: error.message || 'Failed to generate template' });
      }
    },
  );

  // ============= IMPORT JOB ENDPOINTS =============

  /**
   * Start a new import job by uploading a CSV file
   */
  app.post(
    '/api/import/upload',
    resolveTenant,
    requireTenant,
    requirePermission([PERMISSIONS.SALES.LEAD.CREATE, PERMISSIONS.SALES.CUSTOMER.CREATE]),
    upload.single('file'),
    async (req: ImportRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        // Validate request body
        const bodyValidation = startImportRequestSchema.safeParse(req.body);
        if (!bodyValidation.success) {
          return res.status(400).json({
            message: 'Invalid request',
            errors: bodyValidation.error.errors,
          });
        }

        const { entityType, useAiRefinement, duplicateStrategy } = bodyValidation.data;
        const tenantId = req.tenant_id!;
        const userId = req.user?.id || req.session?.user_id;

        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        // Parse CSV content
        const csvContent = req.file.buffer.toString('utf-8');

        // Create import job
        const job = await CsvImportService.createImportJob({
          tenantId,
          userId,
          entityType,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          csvContent,
          useAiRefinement,
          duplicateStrategy,
        });

        res.status(201).json({
          jobId: job.id,
          status: job.status,
          totalRows: job.totalRows,
          columnMappings: job.columnMappings,
          unmappedColumns: job.unmappedColumns,
          message: 'Import job created. Please review column mappings.',
        });
      } catch (error: any) {
        console.error('Error creating import job:', error);
        res.status(500).json({ message: error.message || 'Failed to create import job' });
      }
    },
  );

  /**
   * Preview column mappings for a CSV file (without creating a job)
   */
  app.post(
    '/api/import/preview-mapping',
    resolveTenant,
    requireTenant,
    upload.single('file'),
    async (req: ImportRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const { entityType } = req.body;
        if (!entityType || !ENTITY_TEMPLATES[entityType]) {
          return res.status(400).json({ message: 'Invalid or missing entityType' });
        }

        const csvContent = req.file.buffer.toString('utf-8');
        const { headers, rows, rowCount } = parseCSVContent(csvContent);

        // Auto-map columns
        const { mappings, unmappedColumns, overallConfidence } = autoMapColumns(
          headers,
          entityType,
        );

        res.json({
          totalRows: rowCount,
          headers,
          mappings,
          unmappedColumns,
          overallConfidence,
          sampleData: rows.slice(0, 5), // First 5 rows for preview
        });
      } catch (error: any) {
        console.error('Error previewing mapping:', error);
        res.status(500).json({ message: error.message || 'Failed to preview mapping' });
      }
    },
  );

  /**
   * Get import job status and details
   */
  app.get(
    '/api/import/jobs/:jobId',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId } = req.params;
        const job = await CsvImportService.getImportJob(jobId);

        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        // Verify tenant access
        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        // Don't include raw data in response (can be large)
        const { rawData, transformedData, ...jobInfo } = job;

        res.json({
          ...jobInfo,
          hasRawData: !!rawData,
          hasTransformedData: !!transformedData,
        });
      } catch (error: any) {
        console.error('Error fetching import job:', error);
        res.status(500).json({ message: 'Failed to fetch import job' });
      }
    },
  );

  /**
   * Get all import jobs for the tenant
   */
  app.get(
    '/api/import/jobs',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const tenantId = req.tenant_id!;
        const { entityType, status, limit } = req.query;

        const jobs = await CsvImportService.getImportJobs(tenantId, {
          entityType: entityType as string,
          status: status as string,
          limit: limit ? parseInt(limit as string) : 50,
        });

        // Don't include raw/transformed data in list
        const jobList = jobs.map(({ rawData, transformedData, ...job }) => ({
          ...job,
          hasRawData: !!rawData,
        }));

        res.json(jobList);
      } catch (error: any) {
        console.error('Error fetching import jobs:', error);
        res.status(500).json({ message: 'Failed to fetch import jobs' });
      }
    },
  );

  /**
   * Update column mappings for an import job
   */
  app.put(
    '/api/import/jobs/:jobId/mappings',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId } = req.params;

        const validation = columnMappingRequestSchema.safeParse({
          importJobId: jobId,
          ...req.body,
        });

        if (!validation.success) {
          return res.status(400).json({
            message: 'Invalid request',
            errors: validation.error.errors,
          });
        }

        const job = await CsvImportService.getImportJob(jobId);
        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        // Convert request mappings to full ColumnMapping format
        const existingMappings = (job.columnMappings as any[]) || [];
        const updatedMappings = validation.data.mappings.map((m) => {
          const existing = existingMappings.find((e) => e.sourceColumn === m.sourceColumn);
          return {
            ...existing,
            sourceColumn: m.sourceColumn,
            targetField: m.targetField,
            userConfirmed: m.confirmed,
          };
        });

        await CsvImportService.updateColumnMappings(jobId, updatedMappings);

        res.json({ message: 'Column mappings updated' });
      } catch (error: any) {
        console.error('Error updating mappings:', error);
        res.status(500).json({ message: error.message || 'Failed to update mappings' });
      }
    },
  );

  // ============= VALIDATION ENDPOINTS =============

  /**
   * Validate import data and detect duplicates
   */
  app.post(
    '/api/import/jobs/:jobId/validate',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId } = req.params;
        const job = await CsvImportService.getImportJob(jobId);

        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        if (job.status !== 'validating' && job.status !== 'pending') {
          return res.status(400).json({
            message: `Cannot validate job in ${job.status} status`,
          });
        }

        const result = await CsvImportService.validateImport(jobId);

        res.json({
          jobId,
          ...result,
          canProceed: result.invalidRows === 0 || result.validRows / job.totalRows! >= 0.8,
          needsDuplicateReview: result.duplicatesDetected > 0 && job.duplicateStrategy === 'prompt',
        });
      } catch (error: any) {
        console.error('Error validating import:', error);
        res.status(500).json({ message: error.message || 'Failed to validate import' });
      }
    },
  );

  // ============= DUPLICATE RESOLUTION ENDPOINTS =============

  /**
   * Get pending duplicates for review
   */
  app.get(
    '/api/import/jobs/:jobId/duplicates',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId } = req.params;
        const job = await CsvImportService.getImportJob(jobId);

        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const duplicates = await CsvImportService.getPendingDuplicates(jobId);

        res.json({
          total: duplicates.length,
          duplicates,
        });
      } catch (error: any) {
        console.error('Error fetching duplicates:', error);
        res.status(500).json({ message: 'Failed to fetch duplicates' });
      }
    },
  );

  /**
   * Resolve a single duplicate
   */
  app.post(
    '/api/import/jobs/:jobId/duplicates/:duplicateId/resolve',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId, duplicateId } = req.params;
        const { resolution, mergeStrategy } = req.body;

        const job = await CsvImportService.getImportJob(jobId);
        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const userId = req.user?.id || req.session?.user_id;
        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        if (!['skip', 'merge', 'create_new'].includes(resolution)) {
          return res.status(400).json({ message: 'Invalid resolution type' });
        }

        await CsvImportService.resolveDuplicate({
          duplicateId,
          resolution,
          mergeStrategy,
          userId,
        });

        res.json({ message: 'Duplicate resolved' });
      } catch (error: any) {
        console.error('Error resolving duplicate:', error);
        res.status(500).json({ message: error.message || 'Failed to resolve duplicate' });
      }
    },
  );

  /**
   * Resolve all duplicates with a single action
   */
  app.post(
    '/api/import/jobs/:jobId/duplicates/resolve-all',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId } = req.params;
        const { resolution } = req.body;

        const job = await CsvImportService.getImportJob(jobId);
        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const userId = req.user?.id || req.session?.user_id;
        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        if (!['skip', 'merge', 'create_new'].includes(resolution)) {
          return res.status(400).json({ message: 'Invalid resolution type' });
        }

        const count = await CsvImportService.resolveAllDuplicates({
          jobId,
          resolution,
          userId,
        });

        res.json({ message: `Resolved ${count} duplicates`, count });
      } catch (error: any) {
        console.error('Error resolving duplicates:', error);
        res.status(500).json({ message: error.message || 'Failed to resolve duplicates' });
      }
    },
  );

  // ============= IMPORT EXECUTION ENDPOINTS =============

  /**
   * Execute the import (after validation and duplicate resolution)
   */
  app.post(
    '/api/import/jobs/:jobId/execute',
    resolveTenant,
    requireTenant,
    requirePermission([PERMISSIONS.SALES.LEAD.CREATE, PERMISSIONS.SALES.CUSTOMER.CREATE]),
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId } = req.params;
        const job = await CsvImportService.getImportJob(jobId);

        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        if (!['awaiting_review', 'processing'].includes(job.status as string)) {
          return res.status(400).json({
            message: `Cannot execute job in ${job.status} status. Run validation first.`,
          });
        }

        const result = await CsvImportService.executeImport(jobId);

        res.json({
          jobId,
          status: result.errors.length > 0 && result.imported === 0 ? 'failed' : 'completed',
          ...result,
        });
      } catch (error: any) {
        console.error('Error executing import:', error);
        res.status(500).json({ message: error.message || 'Failed to execute import' });
      }
    },
  );

  /**
   * Cancel an import job
   */
  app.post(
    '/api/import/jobs/:jobId/cancel',
    resolveTenant,
    requireTenant,
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId } = req.params;
        const job = await CsvImportService.getImportJob(jobId);

        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        if (['completed', 'cancelled'].includes(job.status as string)) {
          return res.status(400).json({
            message: `Cannot cancel job in ${job.status} status`,
          });
        }

        await CsvImportService.cancelImport(jobId);

        res.json({ message: 'Import job cancelled' });
      } catch (error: any) {
        console.error('Error cancelling import:', error);
        res.status(500).json({ message: error.message || 'Failed to cancel import' });
      }
    },
  );

  // ============= AI REFINEMENT ENDPOINTS (Premium Feature) =============

  /**
   * Check if AI refinement is available
   */
  app.get(
    '/api/import/ai/status',
    resolveTenant,
    requireTenant,
    async (_req: ImportRequest, res: Response) => {
      try {
        const available = aiCsvRefinementService.isAvailable();
        res.json({
          available,
          message: available
            ? 'AI refinement is available'
            : 'AI refinement requires CLAUDE_API_KEY configuration',
        });
      } catch (error: any) {
        res.status(500).json({ message: 'Failed to check AI status' });
      }
    },
  );

  /**
   * Use AI to map columns (requires ai_csv_import feature)
   */
  app.post(
    '/api/import/ai/map-columns',
    resolveTenant,
    requireTenant,
    requireFeature('ai_csv_import'),
    upload.single('file'),
    async (req: ImportRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const { entityType } = req.body;
        if (!entityType || !ENTITY_TEMPLATES[entityType]) {
          return res.status(400).json({ message: 'Invalid or missing entityType' });
        }

        if (!aiCsvRefinementService.isAvailable()) {
          return res.status(503).json({
            message: 'AI refinement is not available. Please configure CLAUDE_API_KEY.',
          });
        }

        const csvContent = req.file.buffer.toString('utf-8');
        const { headers, rows } = parseCSVContent(csvContent);

        const result = await aiCsvRefinementService.aiMapColumns(
          headers,
          rows.slice(0, 5),
          entityType,
        );

        res.json({
          ...result,
          sampleData: rows.slice(0, 5),
        });
      } catch (error: any) {
        console.error('Error with AI mapping:', error);
        res.status(500).json({ message: error.message || 'AI mapping failed' });
      }
    },
  );

  /**
   * Process an import job with AI refinement
   */
  app.post(
    '/api/import/jobs/:jobId/ai-process',
    resolveTenant,
    requireTenant,
    requireFeature('ai_csv_import'),
    async (req: ImportRequest, res: Response) => {
      try {
        const { jobId } = req.params;
        const job = await CsvImportService.getImportJob(jobId);

        if (!job) {
          return res.status(404).json({ message: 'Import job not found' });
        }

        if (job.tenant_id !== req.tenant_id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        if (!aiCsvRefinementService.isAvailable()) {
          return res.status(503).json({
            message: 'AI refinement is not available',
          });
        }

        const rawData = job.rawData as Record<string, any>[];
        const headers = job.originalHeaders as string[];

        const result = await aiCsvRefinementService.processImportWithAI(
          jobId,
          req.tenant_id!, // Pass tenantId for defense-in-depth isolation
          rawData,
          headers,
          job.entityType,
        );

        res.json({
          jobId,
          mappings: result.mappings,
          issues: result.issues,
          tokensUsed: result.totalTokensUsed,
          estimatedCost: `$${(result.totalTokensUsed * 0.000003).toFixed(4)}`,
        });
      } catch (error: any) {
        console.error('Error with AI processing:', error);
        res.status(500).json({ message: error.message || 'AI processing failed' });
      }
    },
  );
}

// Helper function to format entity type labels
function formatEntityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    business_records: 'Customers & Leads',
    contacts: 'Contacts',
    products: 'Products',
    inventory: 'Inventory Items',
    equipment: 'Equipment',
    opportunities: 'Opportunities',
    service_tickets: 'Service Tickets',
    invoices: 'Invoices',
    contracts: 'Contracts',
  };
  return labels[entityType] || entityType.replace(/_/g, ' ');
}
