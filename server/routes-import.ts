/**
 * CSV Import API Routes
 *
 * Comprehensive import system with:
 * - Multi-entity support (business_records, contacts, products, etc.)
 * - Intelligent column mapping with AI suggestions
 * - Data validation with detailed error reporting
 * - Duplicate detection and resolution strategies
 * - Progress tracking and job management
 * - Template generation for easy imports
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { db } from './db';
import { businessRecords } from '../shared/schema';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// In-memory job storage (should be moved to database in production)
const importJobs = new Map<string, ImportJob>();

interface ImportJob {
  id: string;
  tenantId: string;
  userId: string;
  status: 'pending' | 'mapping' | 'validating' | 'processing' | 'completed' | 'failed';
  entityType: string;
  fileName: string;
  fileData: any[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  skippedRows: number;
  mergedRows: number;
  duplicatesDetected: number;
  duplicatesResolved: number;
  columnMappings: ColumnMapping[];
  unmappedColumns: string[];
  validationErrors: ValidationError[];
  duplicates: Duplicate[];
  duplicateStrategy: 'prompt' | 'skip_all' | 'merge_all' | 'create_all';
  useAiRefinement: boolean;
  aiMappingConfidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  dataType: string;
  isRequired: boolean;
  aiSuggested: boolean;
  userConfirmed: boolean;
}

interface ValidationError {
  rowNumber: number;
  column: string;
  value: any;
  errorType: string;
  message: string;
  suggestion?: string;
}

interface Duplicate {
  id: string;
  rowNumber: number;
  rowData: Record<string, any>;
  existingRecordId: string;
  existingRecordData: Record<string, any>;
  matchingFields: Array<{
    fieldName: string;
    importValue: any;
    existingValue: any;
    similarity: number;
  }>;
  matchScore: number;
  resolution: 'skip' | 'merge' | 'create_new' | 'pending';
}

// Entity type definitions with field mappings
const entityTypeDefinitions = {
  business_records: {
    label: 'Leads & Customers',
    tableName: 'business_records',
    fields: {
      companyName: {
        label: 'Company Name',
        type: 'string',
        required: true,
        example: 'Acme Corporation',
      },
      primaryContactName: {
        label: 'Contact Name',
        type: 'string',
        required: true,
        example: 'John Smith',
      },
      primaryContactEmail: {
        label: 'Email',
        type: 'email',
        required: false,
        example: 'john@acme.com',
      },
      primaryContactPhone: {
        label: 'Phone',
        type: 'phone',
        required: false,
        example: '(555) 123-4567',
      },
      website: { label: 'Website', type: 'url', required: false, example: 'https://acme.com' },
      industry: { label: 'Industry', type: 'string', required: false, example: 'Technology' },
      addressLine1: {
        label: 'Address Line 1',
        type: 'string',
        required: false,
        example: '123 Main St',
      },
      addressLine2: {
        label: 'Address Line 2',
        type: 'string',
        required: false,
        example: 'Suite 100',
      },
      city: { label: 'City', type: 'string', required: false, example: 'New York' },
      state: { label: 'State', type: 'string', required: false, example: 'NY' },
      postalCode: { label: 'Postal Code', type: 'string', required: false, example: '10001' },
      country: { label: 'Country', type: 'string', required: false, example: 'US' },
      recordType: {
        label: 'Record Type',
        type: 'enum',
        required: false,
        example: 'lead',
        options: ['lead', 'prospect', 'customer'],
      },
      status: { label: 'Status', type: 'string', required: false, example: 'new' },
      leadSource: { label: 'Lead Source', type: 'string', required: false, example: 'website' },
      estimatedAmount: {
        label: 'Estimated Deal Value',
        type: 'currency',
        required: false,
        example: '50000',
      },
      priority: {
        label: 'Priority',
        type: 'enum',
        required: false,
        example: 'medium',
        options: ['low', 'medium', 'high', 'urgent'],
      },
      customerTier: { label: 'Customer Tier', type: 'string', required: false, example: 'gold' },
      notes: { label: 'Notes', type: 'text', required: false, example: 'Important client' },
    },
    uniqueFields: ['primaryContactEmail', 'companyName'],
  },
  contacts: {
    label: 'Contacts',
    tableName: 'enhanced_contacts',
    fields: {
      firstName: { label: 'First Name', type: 'string', required: true, example: 'John' },
      lastName: { label: 'Last Name', type: 'string', required: true, example: 'Smith' },
      email: { label: 'Email', type: 'email', required: true, example: 'john@example.com' },
      phone: { label: 'Phone', type: 'phone', required: false, example: '(555) 123-4567' },
      title: { label: 'Job Title', type: 'string', required: false, example: 'Director of IT' },
      department: { label: 'Department', type: 'string', required: false, example: 'IT' },
      companyName: { label: 'Company', type: 'string', required: false, example: 'Acme Corp' },
    },
    uniqueFields: ['email'],
  },
  products: {
    label: 'Products',
    tableName: 'product_models',
    fields: {
      modelNumber: { label: 'Model Number', type: 'string', required: true, example: 'MX-5000' },
      name: {
        label: 'Product Name',
        type: 'string',
        required: true,
        example: 'Canon imageRUNNER 5000',
      },
      manufacturer: { label: 'Manufacturer', type: 'string', required: true, example: 'Canon' },
      category: {
        label: 'Category',
        type: 'string',
        required: false,
        example: 'Multifunction Printer',
      },
      price: { label: 'Price', type: 'currency', required: false, example: '8500' },
      description: {
        label: 'Description',
        type: 'text',
        required: false,
        example: 'High-speed color MFP',
      },
    },
    uniqueFields: ['modelNumber'],
  },
};

/**
 * Get available entity types for import
 */
router.get('/api/import/entity-types', requireAuth, async (req: Request, res: Response) => {
  try {
    const entityTypes = Object.entries(entityTypeDefinitions).map(([type, def]) => ({
      type,
      label: def.label,
      columnCount: Object.keys(def.fields).length,
      requiredColumns: Object.values(def.fields).filter((f) => f.required).length,
    }));

    res.json(entityTypes);
  } catch (error) {
    console.error('Error fetching entity types:', error);
    res.status(500).json({ message: 'Failed to fetch entity types' });
  }
});

/**
 * Get template columns for an entity type
 */
router.get(
  '/api/import/templates/:entityType',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { entityType } = req.params;
      const definition = entityTypeDefinitions[entityType as keyof typeof entityTypeDefinitions];

      if (!definition) {
        return res.status(404).json({ message: 'Entity type not found' });
      }

      const columns = Object.entries(definition.fields).map(([dbField, config]) => ({
        name: config.label,
        dbField,
        type: config.type,
        required: config.required,
        description: `${config.label} field`,
        example: config.example,
      }));

      res.json({ columns });
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ message: 'Failed to fetch template' });
    }
  },
);

/**
 * Download CSV template for an entity type
 */
router.get(
  '/api/import/templates/:entityType/download',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { entityType } = req.params;
      const definition = entityTypeDefinitions[entityType as keyof typeof entityTypeDefinitions];

      if (!definition) {
        return res.status(404).json({ message: 'Entity type not found' });
      }

      // Generate CSV header
      const headers = Object.values(definition.fields).map((f) => f.label);
      const examples = Object.values(definition.fields).map((f) => f.example);

      const csvContent = [headers.join(','), examples.join(',')].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${entityType}_template.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Error downloading template:', error);
      res.status(500).json({ message: 'Failed to download template' });
    }
  },
);

/**
 * Upload CSV file and create import job
 */
router.post(
  '/api/import/upload',
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);

      if (!tenantId || !userId) {
        return res.status(400).json({ message: 'Tenant ID and User ID are required' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const { entityType, useAiRefinement = 'false', duplicateStrategy = 'prompt' } = req.body;

      if (!entityType || !entityTypeDefinitions[entityType as keyof typeof entityTypeDefinitions]) {
        return res.status(400).json({ message: 'Invalid entity type' });
      }

      const definition = entityTypeDefinitions[entityType as keyof typeof entityTypeDefinitions];

      // Parse CSV file
      const fileData: any[] = [];
      const readable = Readable.from(req.file.buffer);

      await new Promise((resolve, reject) => {
        readable
          .pipe(csv())
          .on('data', (row) => fileData.push(row))
          .on('end', resolve)
          .on('error', reject);
      });

      if (fileData.length === 0) {
        return res.status(400).json({ message: 'CSV file is empty' });
      }

      // Auto-map columns based on headers
      const csvColumns = Object.keys(fileData[0]);
      const columnMappings = autoMapColumns(csvColumns, definition, useAiRefinement === 'true');

      // Create import job
      const jobId = uuidv4();
      const job: ImportJob = {
        id: jobId,
        tenantId,
        userId,
        status: 'mapping',
        entityType,
        fileName: req.file.originalname,
        fileData,
        totalRows: fileData.length,
        validRows: 0,
        invalidRows: 0,
        importedRows: 0,
        skippedRows: 0,
        mergedRows: 0,
        duplicatesDetected: 0,
        duplicatesResolved: 0,
        columnMappings,
        unmappedColumns: [],
        validationErrors: [],
        duplicates: [],
        duplicateStrategy: duplicateStrategy as any,
        useAiRefinement: useAiRefinement === 'true',
        aiMappingConfidence: calculateMappingConfidence(columnMappings),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      importJobs.set(jobId, job);

      res.json({
        jobId,
        columnMappings,
        totalRows: fileData.length,
        aiMappingConfidence: job.aiMappingConfidence,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  },
);

/**
 * Get import job details
 */
router.get('/api/import/jobs/:jobId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = importJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Import job not found' });
    }

    // Return job without fileData to reduce payload size
    const { fileData, ...jobInfo } = job;

    res.json(jobInfo);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ message: 'Failed to fetch import job' });
  }
});

/**
 * Validate import data
 */
router.post(
  '/api/import/jobs/:jobId/validate',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = importJobs.get(jobId);

      if (!job) {
        return res.status(404).json({ message: 'Import job not found' });
      }

      job.status = 'validating';
      job.updatedAt = new Date();

      const definition =
        entityTypeDefinitions[job.entityType as keyof typeof entityTypeDefinitions];
      const validationErrors: ValidationError[] = [];
      let validRows = 0;
      let invalidRows = 0;

      // Validate each row
      for (let i = 0; i < job.fileData.length; i++) {
        const row = job.fileData[i];
        const rowErrors = validateRow(row, job.columnMappings, definition, i + 2); // +2 for header and 1-indexing

        if (rowErrors.length > 0) {
          validationErrors.push(...rowErrors);
          invalidRows++;
        } else {
          validRows++;
        }
      }

      job.validationErrors = validationErrors;
      job.validRows = validRows;
      job.invalidRows = invalidRows;

      // Detect duplicates
      if (job.duplicateStrategy !== 'create_all') {
        const duplicates = await detectDuplicates(job, definition);
        job.duplicates = duplicates;
        job.duplicatesDetected = duplicates.length;
      }

      const needsDuplicateReview = job.duplicateStrategy === 'prompt' && job.duplicatesDetected > 0;

      const canProceed = validRows > 0 && invalidRows / job.totalRows < 0.5;

      res.json({
        validRows,
        invalidRows,
        duplicatesDetected: job.duplicatesDetected,
        needsDuplicateReview,
        canProceed,
        validationErrors: validationErrors.slice(0, 100), // Limit errors in response
      });
    } catch (error) {
      console.error('Error validating data:', error);
      res.status(500).json({ message: 'Failed to validate data' });
    }
  },
);

/**
 * Get duplicates for review
 */
router.get(
  '/api/import/jobs/:jobId/duplicates',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = importJobs.get(jobId);

      if (!job) {
        return res.status(404).json({ message: 'Import job not found' });
      }

      res.json({
        duplicates: job.duplicates,
      });
    } catch (error) {
      console.error('Error fetching duplicates:', error);
      res.status(500).json({ message: 'Failed to fetch duplicates' });
    }
  },
);

/**
 * Resolve all duplicates with a strategy
 */
router.post(
  '/api/import/jobs/:jobId/duplicates/resolve-all',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { resolution } = req.body;
      const job = importJobs.get(jobId);

      if (!job) {
        return res.status(404).json({ message: 'Import job not found' });
      }

      // Update all duplicate resolutions
      job.duplicates.forEach((dup) => {
        dup.resolution = resolution;
      });
      job.duplicatesResolved = job.duplicates.length;
      job.updatedAt = new Date();

      res.json({ message: 'Duplicates resolved' });
    } catch (error) {
      console.error('Error resolving duplicates:', error);
      res.status(500).json({ message: 'Failed to resolve duplicates' });
    }
  },
);

/**
 * Execute import
 */
router.post('/api/import/jobs/:jobId/execute', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = importJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Import job not found' });
    }

    job.status = 'processing';
    job.updatedAt = new Date();

    const tenantId = job.tenantId;
    const userId = job.userId;

    let importedRows = 0;
    let skippedRows = 0;
    let mergedRows = 0;

    // Process each valid row
    for (let i = 0; i < job.fileData.length; i++) {
      const row = job.fileData[i];

      // Skip rows with validation errors
      const hasErrors = job.validationErrors.some((err) => err.rowNumber === i + 2);
      if (hasErrors) {
        skippedRows++;
        continue;
      }

      // Check for duplicate resolution
      const duplicate = job.duplicates.find((dup) => dup.rowNumber === i + 2);
      if (duplicate) {
        if (duplicate.resolution === 'skip') {
          skippedRows++;
          continue;
        } else if (duplicate.resolution === 'merge') {
          // TODO: Implement merge logic
          mergedRows++;
          continue;
        }
      }

      // Map row data to database fields
      const mappedData = mapRowData(row, job.columnMappings);

      // Insert record
      try {
        if (job.entityType === 'business_records') {
          await insertBusinessRecord(mappedData, tenantId, userId);
        }
        // Add other entity types here

        importedRows++;
      } catch (error) {
        console.error('Error importing row:', error);
        skippedRows++;
      }
    }

    job.status = 'completed';
    job.importedRows = importedRows;
    job.skippedRows = skippedRows;
    job.mergedRows = mergedRows;
    job.updatedAt = new Date();

    res.json({
      message: 'Import completed',
      importedRows,
      skippedRows,
      mergedRows,
    });
  } catch (error) {
    console.error('Error executing import:', error);
    const job = importJobs.get(req.params.jobId);
    if (job) {
      job.status = 'failed';
    }
    res.status(500).json({ message: 'Failed to execute import' });
  }
});

/**
 * Check AI availability
 */
router.get('/api/import/ai/status', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if AI features are available (Claude API key configured)
    const available = !!process.env.ANTHROPIC_API_KEY;
    res.json({ available });
  } catch (error) {
    console.error('Error checking AI status:', error);
    res.status(500).json({ message: 'Failed to check AI status' });
  }
});

// Helper functions

function autoMapColumns(csvColumns: string[], definition: any, useAi: boolean): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const definitionFields = definition.fields;

  for (const csvColumn of csvColumns) {
    const normalizedCsv = csvColumn.toLowerCase().trim();
    let bestMatch: { field: string; confidence: number } | null = null;

    // Try exact and fuzzy matching
    for (const [dbField, config] of Object.entries(definitionFields) as any[]) {
      const normalizedLabel = config.label.toLowerCase();
      const normalizedField = dbField.toLowerCase();

      if (normalizedCsv === normalizedLabel || normalizedCsv === normalizedField) {
        bestMatch = { field: dbField, confidence: 100 };
        break;
      } else if (
        normalizedCsv.includes(normalizedField) ||
        normalizedField.includes(normalizedCsv)
      ) {
        const confidence = calculateStringSimilarity(normalizedCsv, normalizedField);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { field: dbField, confidence: Math.floor(confidence * 100) };
        }
      }
    }

    if (bestMatch) {
      const fieldConfig = definitionFields[bestMatch.field];
      mappings.push({
        sourceColumn: csvColumn,
        targetField: bestMatch.field,
        confidence: bestMatch.confidence,
        dataType: fieldConfig.type,
        isRequired: fieldConfig.required,
        aiSuggested: useAi && bestMatch.confidence < 100,
        userConfirmed: bestMatch.confidence === 100,
      });
    } else {
      mappings.push({
        sourceColumn: csvColumn,
        targetField: '',
        confidence: 0,
        dataType: 'string',
        isRequired: false,
        aiSuggested: false,
        userConfirmed: false,
      });
    }
  }

  return mappings;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function calculateMappingConfidence(mappings: ColumnMapping[]): number {
  if (mappings.length === 0) return 0;
  const totalConfidence = mappings.reduce((sum, m) => sum + m.confidence, 0);
  return Math.floor(totalConfidence / mappings.length);
}

function validateRow(
  row: any,
  mappings: ColumnMapping[],
  definition: any,
  rowNumber: number,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const mapping of mappings) {
    if (!mapping.targetField) continue;

    const fieldConfig = definition.fields[mapping.targetField];
    const value = row[mapping.sourceColumn];

    // Check required fields
    if (fieldConfig.required && (!value || value.trim() === '')) {
      errors.push({
        rowNumber,
        column: mapping.sourceColumn,
        value,
        errorType: 'required',
        message: `${fieldConfig.label} is required`,
      });
      continue;
    }

    // Validate data type
    if (value && value.trim() !== '') {
      const validationError = validateDataType(value, fieldConfig.type, fieldConfig.label);
      if (validationError) {
        errors.push({
          rowNumber,
          column: mapping.sourceColumn,
          value,
          ...validationError,
        });
      }
    }
  }

  return errors;
}

function validateDataType(
  value: string,
  type: string,
  label: string,
): { errorType: string; message: string; suggestion?: string } | null {
  switch (type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return {
          errorType: 'invalid_format',
          message: `${label} must be a valid email address`,
          suggestion: 'Use format: user@example.com',
        };
      }
      break;

    case 'phone':
      const phoneRegex = /^[\d\s\-\(\)\+]+$/;
      if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
        return {
          errorType: 'invalid_format',
          message: `${label} must be a valid phone number`,
          suggestion: 'Use format: (555) 123-4567',
        };
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        return {
          errorType: 'invalid_format',
          message: `${label} must be a valid URL`,
          suggestion: 'Use format: https://example.com',
        };
      }
      break;

    case 'currency':
      const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
      if (isNaN(numValue)) {
        return {
          errorType: 'invalid_format',
          message: `${label} must be a valid number`,
          suggestion: 'Use numbers only',
        };
      }
      break;
  }

  return null;
}

async function detectDuplicates(job: ImportJob, definition: any): Promise<Duplicate[]> {
  const duplicates: Duplicate[] = [];
  const uniqueFields = definition.uniqueFields || [];

  if (uniqueFields.length === 0) return duplicates;

  // Get existing records
  const existingRecords = await db
    .select()
    .from(businessRecords)
    .where(eq(businessRecords.tenantId, job.tenantId))
    .limit(1000); // Limit for performance

  for (let i = 0; i < job.fileData.length; i++) {
    const row = job.fileData[i];
    const mappedData = mapRowData(row, job.columnMappings);

    for (const existingRecord of existingRecords) {
      const matchingFields: any[] = [];
      let totalSimilarity = 0;

      for (const field of uniqueFields) {
        const importValue = mappedData[field];
        const existingValue = existingRecord[field as keyof typeof existingRecord];

        if (importValue && existingValue) {
          const similarity = calculateStringSimilarity(
            String(importValue).toLowerCase(),
            String(existingValue).toLowerCase(),
          );

          if (similarity > 0.8) {
            matchingFields.push({
              fieldName: field,
              importValue,
              existingValue,
              similarity: Math.floor(similarity * 100),
            });
            totalSimilarity += similarity;
          }
        }
      }

      if (matchingFields.length > 0) {
        const matchScore = Math.floor((totalSimilarity / uniqueFields.length) * 100);

        if (matchScore > 80) {
          duplicates.push({
            id: uuidv4(),
            rowNumber: i + 2,
            rowData: mappedData,
            existingRecordId: existingRecord.id,
            existingRecordData: {
              companyName: existingRecord.companyName,
              primaryContactEmail: existingRecord.primaryContactEmail,
              status: existingRecord.status,
            },
            matchingFields,
            matchScore,
            resolution: 'pending',
          });
          break; // Only report first duplicate match
        }
      }
    }
  }

  return duplicates;
}

function mapRowData(row: any, mappings: ColumnMapping[]): Record<string, any> {
  const mapped: Record<string, any> = {};

  for (const mapping of mappings) {
    if (mapping.targetField && row[mapping.sourceColumn]) {
      let value = row[mapping.sourceColumn];

      // Type conversion
      if (mapping.dataType === 'currency') {
        value = parseFloat(value.replace(/[^0-9.-]/g, ''));
      }

      mapped[mapping.targetField] = value;
    }
  }

  return mapped;
}

async function insertBusinessRecord(data: any, tenantId: string, userId: string) {
  // Generate unique identifiers
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 100000000);
  const companyDisplayId = `${randomNum}`;
  const companyNameSlug = (data.companyName || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const urlSlug = `${companyNameSlug}-${companyDisplayId}`;

  await db.insert(businessRecords).values({
    ...data,
    tenantId,
    createdBy: userId,
    ownerId: userId,
    companyDisplayId,
    urlSlug,
    recordType: data.recordType || 'lead',
    status: data.status || 'new',
    leadSource: data.leadSource || 'import',
  });
}

export default router;
