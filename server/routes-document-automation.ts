import express, { type Request, Response } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-document-automation');

import {
  documentTemplates,
  generatedDocuments,
  documentUploads,
  documentFieldMappings,
  documentWorkflowActions,
  documentNotifications,
  insertDocumentTemplateSchema,
  insertDocumentUploadSchema,
  insertDocumentFieldMappingSchema,
} from '../shared/document-automation-schema';
import { eq, and, desc } from 'drizzle-orm';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DocumentGenerationService } from './services/document-generation-service';
import {
  DocumentProcessingService,
  AIFieldExtractionService,
} from './services/document-ocr-ai-service';

const router = express.Router();

// Helper to get user ID from request (supports Supabase JWT and session)
const getUserId = (req: Request): string | undefined => {
  const reqAny = req as any;
  return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.userId;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'attached_assets', 'document-uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/tiff'];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  },
});

/**
 * DOCUMENT TEMPLATES
 */

// Get all templates
router.get('/api/document-templates', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const templates = await db.query.documentTemplates.findMany({
      where: (t, { eq, and, or }) =>
        and(or(eq(t.tenantId, tenantId), eq(t.isPublic, true)), eq(t.isActive, true)),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    res.json(templates);
  } catch (error: any) {
    log.error('Error fetching templates:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// Get single template
router.get('/api/document-templates/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const template = await db.query.documentTemplates.findFirst({
      where: (t, { eq, and, or }) =>
        and(eq(t.id, parseInt(id)), or(eq(t.tenantId, tenantId), eq(t.isPublic, true))),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error: any) {
    log.error('Error fetching template:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// Create template
router.post('/api/document-templates', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = getUserId(req);

    const validatedData = insertDocumentTemplateSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
    });

    const [template] = await db.insert(documentTemplates).values(validatedData).returning();

    res.status(201).json(template);
  } catch (error: any) {
    log.error('Error creating template:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update template
router.put('/api/document-templates/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const template = await db.query.documentTemplates.findFirst({
      where: (t, { eq, and }) => and(eq(t.id, parseInt(id)), eq(t.tenantId, tenantId)),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const [updated] = await db
      .update(documentTemplates)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(documentTemplates.id, parseInt(id)))
      .returning();

    res.json(updated);
  } catch (error: any) {
    log.error('Error updating template:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete template (soft delete)
router.delete('/api/document-templates/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const template = await db.query.documentTemplates.findFirst({
      where: (t, { eq, and }) => and(eq(t.id, parseInt(id)), eq(t.tenantId, tenantId)),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await db
      .update(documentTemplates)
      .set({ isActive: false })
      .where(eq(documentTemplates.id, parseInt(id)));

    res.json({ success: true });
  } catch (error: any) {
    log.error('Error deleting template:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// Preview template
router.post('/api/document-templates/:id/preview', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { sampleData } = req.body;

    const preview = await DocumentGenerationService.previewTemplate(
      parseInt(id),
      sampleData || {},
      tenantId,
    );

    res.json({ preview });
  } catch (error: any) {
    log.error('Error previewing template:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DOCUMENT GENERATION
 */

// Generate document from template
router.post('/api/documents/generate', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = getUserId(req);
    const {
      templateId,
      businessRecordId,
      quoteId,
      dealId,
      serviceCallId,
      invoiceId,
      workflowId,
      taskId,
      name,
      format,
      customData,
    } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }

    const documentId = await DocumentGenerationService.generateDocument(
      templateId,
      {
        businessRecordId,
        quoteId,
        dealId,
        serviceCallId,
        invoiceId,
        workflowId,
        taskId,
      },
      userId,
      tenantId,
      {
        name,
        format,
        customData,
      },
    );

    const document = await db.query.generatedDocuments.findFirst({
      where: eq(generatedDocuments.id, documentId),
    });

    res.status(201).json(document);
  } catch (error: any) {
    log.error('Error generating document:', error);
    res.status(400).json({ error: error.message });
  }
});

// Batch generate documents
router.post('/api/documents/batch-generate', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = getUserId(req);
    const { templateId, contextList, format } = req.body;

    if (!templateId || !contextList || !Array.isArray(contextList)) {
      return res.status(400).json({ error: 'templateId and contextList are required' });
    }

    const documentIds = await DocumentGenerationService.batchGenerateDocuments(
      templateId,
      contextList,
      userId,
      tenantId,
      { format },
    );

    const documents = await db.query.generatedDocuments.findMany({
      where: (d, { inArray }) => inArray(d.id, documentIds),
    });

    res.status(201).json(documents);
  } catch (error: any) {
    log.error('Error batch generating documents:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get generated documents
router.get('/api/documents/generated', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { workflowId, taskId, businessRecordId, type } = req.query;

    const conditions: any = { tenantId };

    if (workflowId) conditions.workflowId = parseInt(workflowId as string);
    if (taskId) conditions.taskId = parseInt(taskId as string);
    if (businessRecordId) conditions.businessRecordId = parseInt(businessRecordId as string);
    if (type) conditions.type = type;

    const documents = await db.query.generatedDocuments.findMany({
      where: (d, { eq, and }) => {
        const clauses = Object.entries(conditions).map(([key, value]) =>
          eq(d[key as keyof typeof d], value),
        );
        return and(...clauses);
      },
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });

    res.json(documents);
  } catch (error: any) {
    log.error('Error fetching generated documents:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// Download generated document
router.get('/api/documents/generated/:id/download', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const document = await db.query.generatedDocuments.findFirst({
      where: (d, { eq, and }) => and(eq(d.id, parseInt(id)), eq(d.tenantId, tenantId)),
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.filePath) {
      return res.status(400).json({ error: 'Document file not available' });
    }

    // Update download tracking
    await db
      .update(generatedDocuments)
      .set({
        downloadedCount: document.downloadedCount + 1,
        lastDownloadedAt: new Date(),
      })
      .where(eq(generatedDocuments.id, parseInt(id)));

    // Send file
    res.download(document.filePath, document.name);
  } catch (error: any) {
    log.error('Error downloading document:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

/**
 * DOCUMENT UPLOADS & OCR
 */

// Upload document for OCR processing
router.post('/api/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = getUserId(req);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { targetEntityType, targetEntityId, workflowId, taskId, fieldMappingId } = req.body;

    const uploadData = {
      tenantId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path,
      targetEntityType,
      targetEntityId: targetEntityId ? parseInt(targetEntityId) : undefined,
      workflowId: workflowId ? parseInt(workflowId) : undefined,
      taskId: taskId ? parseInt(taskId) : undefined,
      uploadedBy: userId,
    };

    const [upload] = await db.insert(documentUploads).values(uploadData).returning();

    // Trigger OCR and AI processing in background
    DocumentProcessingService.processDocument(upload.id, tenantId).catch((error) => {
      log.error(`Background processing failed for upload ${upload.id}:`, error);
    });

    res.status(201).json(upload);
  } catch (error: any) {
    log.error('Error uploading document:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get upload status
router.get('/api/documents/uploads/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const upload = await db.query.documentUploads.findFirst({
      where: (u, { eq, and }) => and(eq(u.id, parseInt(id)), eq(u.tenantId, tenantId)),
    });

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    res.json(upload);
  } catch (error: any) {
    log.error('Error fetching upload:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// Get all uploads
router.get('/api/documents/uploads', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const uploads = await db.query.documentUploads.findMany({
      where: (u, { eq }) => eq(u.tenantId, tenantId),
      orderBy: (u, { desc }) => [desc(u.createdAt)],
    });

    res.json(uploads);
  } catch (error: any) {
    log.error('Error fetching uploads:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// Approve/review uploaded document
router.post('/api/documents/uploads/:id/review', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = getUserId(req);
    const { id } = req.params;
    const { approved, notes } = req.body;

    const upload = await db.query.documentUploads.findFirst({
      where: (u, { eq, and }) => and(eq(u.id, parseInt(id)), eq(u.tenantId, tenantId)),
    });

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    await db
      .update(documentUploads)
      .set({
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: notes,
        requiresReview: !approved,
      })
      .where(eq(documentUploads.id, parseInt(id)));

    res.json({ success: true });
  } catch (error: any) {
    log.error('Error reviewing upload:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

/**
 * FIELD MAPPINGS
 */

// Get field mappings
router.get('/api/document-field-mappings', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const mappings = await db.query.documentFieldMappings.findMany({
      where: (m, { eq, and }) => and(eq(m.tenantId, tenantId), eq(m.isActive, true)),
      orderBy: (m, { desc }) => [desc(m.createdAt)],
    });

    res.json(mappings);
  } catch (error: any) {
    log.error('Error fetching field mappings:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// Create field mapping
router.post('/api/document-field-mappings', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = getUserId(req);

    const validatedData = insertDocumentFieldMappingSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
    });

    const [mapping] = await db.insert(documentFieldMappings).values(validatedData).returning();

    res.status(201).json(mapping);
  } catch (error: any) {
    log.error('Error creating field mapping:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * AI FIELD EXTRACTION (Manual trigger)
 */

// Extract fields from text using AI
router.post('/api/documents/ai-extract', async (req: Request, res: Response) => {
  try {
    const { text, targetEntityType, fieldMappingId, customPrompt } = req.body;

    if (!text || !targetEntityType) {
      return res.status(400).json({ error: 'text and targetEntityType are required' });
    }

    const result = await AIFieldExtractionService.extractFields(
      text,
      targetEntityType,
      fieldMappingId,
      customPrompt,
    );

    res.json(result);
  } catch (error: any) {
    log.error('Error extracting fields:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
