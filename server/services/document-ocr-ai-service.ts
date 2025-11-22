import Anthropic from "@anthropic-ai/sdk";
import { createWorker } from "tesseract.js";
import * as fs from "fs/promises";
import * as path from "path";
import { db } from "../../db";
import { documentUploads, documentFieldMappings } from "../../shared/document-automation-schema";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface OCRResult {
  text: string;
  confidence: number;
  error?: string;
}

export interface AIFieldExtractionResult {
  extractedFields: Record<string, {
    value: any;
    confidence: "high" | "medium" | "low" | "manual";
    source: string;
    reasoning?: string;
  }>;
  suggestedMapping?: Record<string, string>;
  issues?: string[];
  requiresReview: boolean;
}

/**
 * OCR Service - Extract text from images and PDFs
 */
export class OCRService {
  private static worker: any = null;

  /**
   * Initialize Tesseract.js worker
   */
  private static async initWorker() {
    if (!this.worker) {
      this.worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
    }
    return this.worker;
  }

  /**
   * Perform OCR on an image file
   */
  static async extractTextFromImage(filePath: string): Promise<OCRResult> {
    try {
      const worker = await this.initWorker();
      const { data } = await worker.recognize(filePath);

      return {
        text: data.text,
        confidence: Math.round(data.confidence),
      };
    } catch (error: any) {
      console.error("OCR Error:", error);
      return {
        text: "",
        confidence: 0,
        error: error.message,
      };
    }
  }

  /**
   * Perform OCR on a PDF file (convert to images first)
   */
  static async extractTextFromPDF(filePath: string): Promise<OCRResult> {
    // For PDFs, we'd typically use pdf-parse or pdf2pic to convert to images
    // then run OCR on each page. For now, return placeholder
    try {
      // Import pdf-parse dynamically
      const pdfParse = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);

      return {
        text: pdfData.text,
        confidence: 85, // PDF text extraction is generally reliable
      };
    } catch (error: any) {
      console.error("PDF OCR Error:", error);
      return {
        text: "",
        confidence: 0,
        error: error.message,
      };
    }
  }

  /**
   * Determine file type and extract text accordingly
   */
  static async extractText(filePath: string, fileType: string): Promise<OCRResult> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf' || fileType === 'application/pdf') {
      return this.extractTextFromPDF(filePath);
    } else if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp'].includes(ext)) {
      return this.extractTextFromImage(filePath);
    } else {
      return {
        text: "",
        confidence: 0,
        error: `Unsupported file type: ${ext}`,
      };
    }
  }

  /**
   * Cleanup worker
   */
  static async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * AI Field Extraction Service - Use Claude to intelligently extract and map fields
 */
export class AIFieldExtractionService {
  /**
   * Extract structured fields from document text using Claude AI
   */
  static async extractFields(
    documentText: string,
    targetEntityType: string,
    fieldMappingId?: number,
    customPrompt?: string
  ): Promise<AIFieldExtractionResult> {
    try {
      // Get field mapping configuration if provided
      let fieldMapping = null;
      if (fieldMappingId) {
        fieldMapping = await db.query.documentFieldMappings.findFirst({
          where: eq(documentFieldMappings.id, fieldMappingId),
        });
      }

      // Build the AI prompt
      const systemPrompt = this.buildSystemPrompt(targetEntityType, fieldMapping);
      const userPrompt = customPrompt || this.buildDefaultPrompt(documentText, targetEntityType);

      // Call Claude API
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      // Parse the response
      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Claude");
      }

      const result = JSON.parse(content.text);

      // Validate and structure the result
      return {
        extractedFields: result.fields || {},
        suggestedMapping: result.mapping || {},
        issues: result.issues || [],
        requiresReview: result.requiresReview !== false, // Default to true
      };
    } catch (error: any) {
      console.error("AI Field Extraction Error:", error);
      return {
        extractedFields: {},
        requiresReview: true,
        issues: [`AI extraction failed: ${error.message}`],
      };
    }
  }

  /**
   * Build system prompt for Claude
   */
  private static buildSystemPrompt(
    targetEntityType: string,
    fieldMapping: any
  ): string {
    const basePrompt = `You are an expert document processing AI that extracts structured data from documents.

Your task is to analyze document text and extract relevant fields for a ${targetEntityType} entity.

IMPORTANT: Your response must be valid JSON with this exact structure:
{
  "fields": {
    "fieldName": {
      "value": "extracted value",
      "confidence": "high" | "medium" | "low",
      "source": "reference to where in document this was found",
      "reasoning": "brief explanation of extraction"
    }
  },
  "mapping": {
    "extractedFieldName": "targetEntityFieldName"
  },
  "issues": ["any problems or ambiguities found"],
  "requiresReview": true | false
}

Guidelines:
- Extract fields with HIGH confidence only when explicitly stated in the document
- Use MEDIUM confidence for reasonable inferences
- Use LOW confidence for guesses or unclear data
- Set requiresReview to true if any critical fields are missing or have low confidence
- Include source references (line numbers, sections) for traceability
- Provide clear reasoning for complex extractions`;

    if (fieldMapping?.targetFields) {
      const targetFieldsDesc = JSON.stringify(fieldMapping.targetFields, null, 2);
      return `${basePrompt}

TARGET FIELDS SCHEMA:
${targetFieldsDesc}

Extract values that match these target fields. Use the exact field names in your mapping.`;
    }

    return basePrompt;
  }

  /**
   * Build default user prompt
   */
  private static buildDefaultPrompt(
    documentText: string,
    targetEntityType: string
  ): string {
    const commonFields: Record<string, string[]> = {
      purchase_order: [
        "po_number",
        "vendor_name",
        "vendor_address",
        "order_date",
        "delivery_date",
        "total_amount",
        "items",
        "contact_person",
        "phone",
        "email",
      ],
      quote: [
        "quote_number",
        "customer_name",
        "customer_address",
        "quote_date",
        "expiration_date",
        "total_amount",
        "items",
        "terms",
        "contact_person",
      ],
      invoice: [
        "invoice_number",
        "customer_name",
        "invoice_date",
        "due_date",
        "total_amount",
        "items",
        "payment_terms",
        "billing_address",
      ],
      contract: [
        "contract_number",
        "parties",
        "effective_date",
        "expiration_date",
        "contract_value",
        "terms",
        "signatures",
      ],
      business_record: [
        "company_name",
        "contact_name",
        "address",
        "city",
        "state",
        "zip",
        "phone",
        "email",
        "website",
        "industry",
      ],
    };

    const expectedFields = commonFields[targetEntityType] || [];
    const fieldsDesc = expectedFields.length > 0
      ? `\n\nExpected fields for ${targetEntityType}: ${expectedFields.join(", ")}`
      : "";

    return `Analyze the following document and extract structured data.${fieldsDesc}

DOCUMENT TEXT:
${documentText}

Extract all relevant fields, determine confidence levels, and suggest appropriate mappings to the target entity.`;
  }

  /**
   * Validate extracted fields against target schema
   */
  static async validateExtractedFields(
    extractedFields: Record<string, any>,
    targetEntityType: string,
    fieldMappingId?: number
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get field mapping for validation rules
    let fieldMapping = null;
    if (fieldMappingId) {
      fieldMapping = await db.query.documentFieldMappings.findFirst({
        where: eq(documentFieldMappings.id, fieldMappingId),
      });
    }

    // Apply validation rules if available
    if (fieldMapping?.validationRules) {
      const rules = fieldMapping.validationRules as Record<string, any>;

      for (const [field, value] of Object.entries(extractedFields)) {
        const rule = rules[field];
        if (rule) {
          // Required field check
          if (rule.required && !value.value) {
            errors.push(`Required field '${field}' is missing`);
          }

          // Type validation
          if (rule.type && value.value) {
            const actualType = typeof value.value;
            if (actualType !== rule.type) {
              errors.push(`Field '${field}' expected type ${rule.type}, got ${actualType}`);
            }
          }

          // Pattern validation
          if (rule.pattern && value.value) {
            const regex = new RegExp(rule.pattern);
            if (!regex.test(value.value)) {
              warnings.push(`Field '${field}' doesn't match expected pattern`);
            }
          }

          // Confidence check
          if (value.confidence === "low") {
            warnings.push(`Field '${field}' has low confidence, please review`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Apply field transformations based on mapping rules
   */
  static async transformFields(
    extractedFields: Record<string, any>,
    fieldMappingId: number
  ): Promise<Record<string, any>> {
    const fieldMapping = await db.query.documentFieldMappings.findFirst({
      where: eq(documentFieldMappings.id, fieldMappingId),
    });

    if (!fieldMapping?.transformationRules) {
      return extractedFields;
    }

    const transformedFields: Record<string, any> = {};
    const rules = fieldMapping.transformationRules as Record<string, any>;

    for (const [field, value] of Object.entries(extractedFields)) {
      const rule = rules[field];
      let transformedValue = value.value;

      if (rule) {
        // Apply transformations
        if (rule.uppercase) {
          transformedValue = transformedValue?.toString().toUpperCase();
        }
        if (rule.lowercase) {
          transformedValue = transformedValue?.toString().toLowerCase();
        }
        if (rule.trim) {
          transformedValue = transformedValue?.toString().trim();
        }
        if (rule.dateFormat) {
          // Parse and reformat date
          const date = new Date(transformedValue);
          if (!isNaN(date.getTime())) {
            transformedValue = date.toISOString();
          }
        }
        if (rule.numberFormat) {
          // Parse number
          transformedValue = parseFloat(transformedValue);
        }
      }

      transformedFields[field] = {
        ...value,
        value: transformedValue,
      };
    }

    return transformedFields;
  }
}

/**
 * Document Processing Orchestrator
 * Coordinates OCR and AI field extraction
 */
export class DocumentProcessingService {
  /**
   * Process uploaded document: OCR + AI extraction
   */
  static async processDocument(
    uploadId: number,
    tenantId: number
  ): Promise<void> {
    try {
      // Get document upload record
      const upload = await db.query.documentUploads.findFirst({
        where: eq(documentUploads.id, uploadId),
      });

      if (!upload || upload.tenantId !== tenantId) {
        throw new Error("Document not found");
      }

      // Step 1: OCR
      console.log(`Starting OCR for document ${uploadId}`);
      await db.update(documentUploads)
        .set({ ocrStatus: "processing" })
        .where(eq(documentUploads.id, uploadId));

      const ocrResult = await OCRService.extractText(
        upload.filePath,
        upload.fileType
      );

      await db.update(documentUploads)
        .set({
          ocrText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
          ocrStatus: ocrResult.error ? "failed" : "completed",
          ocrError: ocrResult.error,
          ocrProcessedAt: new Date(),
        })
        .where(eq(documentUploads.id, uploadId));

      if (ocrResult.error || !ocrResult.text) {
        throw new Error(`OCR failed: ${ocrResult.error}`);
      }

      // Step 2: AI Field Extraction
      console.log(`Starting AI field extraction for document ${uploadId}`);

      const aiResult = await AIFieldExtractionService.extractFields(
        ocrResult.text,
        upload.targetEntityType || "unknown",
        undefined, // Could pass fieldMappingId here
        undefined  // Could pass custom prompt here
      );

      // Step 3: Validate extracted fields
      const validation = await AIFieldExtractionService.validateExtractedFields(
        aiResult.extractedFields,
        upload.targetEntityType || "unknown"
      );

      // Update document upload with AI results
      await db.update(documentUploads)
        .set({
          aiExtractedFields: aiResult.extractedFields,
          aiFieldMapping: aiResult.suggestedMapping,
          aiProcessedAt: new Date(),
          requiresReview: aiResult.requiresReview || !validation.isValid,
          isProcessed: true,
        })
        .where(eq(documentUploads.id, uploadId));

      console.log(`Document ${uploadId} processed successfully`);
    } catch (error: any) {
      console.error(`Document processing failed for ${uploadId}:`, error);

      await db.update(documentUploads)
        .set({
          ocrStatus: "failed",
          ocrError: error.message,
          aiError: error.message,
        })
        .where(eq(documentUploads.id, uploadId));

      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  static async cleanup() {
    await OCRService.cleanup();
  }
}
