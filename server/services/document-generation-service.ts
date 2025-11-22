import { db } from "../../db";
import {
  documentTemplates,
  generatedDocuments,
  type DocumentTemplate,
  type InsertGeneratedDocument,
} from "../../shared/document-automation-schema";
import { eq } from "drizzle-orm";
import Handlebars from "handlebars";
import * as fs from "fs/promises";
import * as path from "path";
import { createWriteStream } from "fs";

// We'll use these libraries for document generation:
// - puppeteer: HTML to PDF
// - docx: DOCX generation
// - handlebars: Template rendering

/**
 * Template Rendering Service
 * Handles template compilation and data injection
 */
export class TemplateRenderingService {
  /**
   * Register custom Handlebars helpers
   */
  static registerHelpers() {
    // Date formatting helper
    Handlebars.registerHelper("formatDate", function (date: any, format: string) {
      if (!date) return "";
      const d = new Date(date);

      switch (format) {
        case "short":
          return d.toLocaleDateString();
        case "long":
          return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        case "iso":
          return d.toISOString().split("T")[0];
        default:
          return d.toLocaleDateString();
      }
    });

    // Currency formatting helper
    Handlebars.registerHelper("formatCurrency", function (amount: any) {
      if (amount === null || amount === undefined) return "$0.00";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    });

    // Number formatting helper
    Handlebars.registerHelper("formatNumber", function (num: any, decimals = 0) {
      if (num === null || num === undefined) return "0";
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    });

    // Conditional helpers
    Handlebars.registerHelper("eq", function (a: any, b: any) {
      return a === b;
    });

    Handlebars.registerHelper("gt", function (a: any, b: any) {
      return a > b;
    });

    Handlebars.registerHelper("lt", function (a: any, b: any) {
      return a < b;
    });

    // Array helpers
    Handlebars.registerHelper("join", function (array: any[], separator: string) {
      return array?.join(separator) || "";
    });

    // String helpers
    Handlebars.registerHelper("uppercase", function (str: string) {
      return str?.toUpperCase() || "";
    });

    Handlebars.registerHelper("lowercase", function (str: string) {
      return str?.toLowerCase() || "";
    });

    // Default value helper
    Handlebars.registerHelper("default", function (value: any, defaultValue: any) {
      return value || defaultValue;
    });
  }

  /**
   * Compile and render template with data
   */
  static renderTemplate(templateContent: string, data: any): string {
    // Register helpers if not already done
    this.registerHelpers();

    try {
      const template = Handlebars.compile(templateContent);
      return template(data);
    } catch (error: any) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Fetch data for template based on field mapping
   */
  static async fetchDataContext(
    fieldMapping: Record<string, string>,
    contextIds: {
      businessRecordId?: number;
      quoteId?: number;
      dealId?: number;
      serviceCallId?: number;
      invoiceId?: number;
    },
    tenantId: number
  ): Promise<Record<string, any>> {
    const dataContext: Record<string, any> = {};

    // Fetch business record if needed
    if (contextIds.businessRecordId) {
      const record = await db.query.businessRecords.findFirst({
        where: (records, { eq, and }) =>
          and(
            eq(records.id, contextIds.businessRecordId!),
            eq(records.tenantId, tenantId)
          ),
      });
      if (record) {
        dataContext.businessRecord = record;
        dataContext.customer = record; // Alias
      }
    }

    // Fetch quote if needed
    if (contextIds.quoteId) {
      const quote = await db.query.quotes.findFirst({
        where: (quotes, { eq, and }) =>
          and(
            eq(quotes.id, contextIds.quoteId!),
            eq(quotes.tenantId, tenantId)
          ),
        with: {
          lineItems: true,
        },
      });
      if (quote) {
        dataContext.quote = quote;
      }
    }

    // Fetch deal if needed
    if (contextIds.dealId) {
      const deal = await db.query.deals.findFirst({
        where: (deals, { eq, and }) =>
          and(
            eq(deals.id, contextIds.dealId!),
            eq(deals.tenantId, tenantId)
          ),
      });
      if (deal) {
        dataContext.deal = deal;
      }
    }

    // Fetch service call if needed
    if (contextIds.serviceCallId) {
      const serviceCall = await db.query.serviceCalls.findFirst({
        where: (calls, { eq, and }) =>
          and(
            eq(calls.id, contextIds.serviceCallId!),
            eq(calls.tenantId, tenantId)
          ),
      });
      if (serviceCall) {
        dataContext.serviceCall = serviceCall;
      }
    }

    // Fetch invoice if needed
    if (contextIds.invoiceId) {
      const invoice = await db.query.invoices.findFirst({
        where: (invoices, { eq, and }) =>
          and(
            eq(invoices.id, contextIds.invoiceId!),
            eq(invoices.tenantId, tenantId)
          ),
      });
      if (invoice) {
        dataContext.invoice = invoice;
      }
    }

    // Add utility data
    dataContext.currentDate = new Date().toISOString();
    dataContext.today = new Date().toLocaleDateString();

    return dataContext;
  }
}

/**
 * PDF Generation Service
 * Generates PDFs from HTML using Puppeteer
 */
export class PDFGenerationService {
  /**
   * Generate PDF from HTML content
   */
  static async generatePDF(
    htmlContent: string,
    pageSettings?: any
  ): Promise<Buffer> {
    const puppeteer = require("puppeteer");

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
      });

      const pdfOptions: any = {
        format: pageSettings?.format || "A4",
        margin: pageSettings?.margin || {
          top: "1in",
          right: "1in",
          bottom: "1in",
          left: "1in",
        },
        printBackground: true,
      };

      if (pageSettings?.orientation) {
        pdfOptions.landscape = pageSettings.orientation === "landscape";
      }

      const pdfBuffer = await page.pdf(pdfOptions);

      return pdfBuffer;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Add default styling to HTML
   */
  static wrapHTMLWithStyles(content: string, customStyles?: string): string {
    const defaultStyles = `
      <style>
        @page {
          margin: 1in;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 12pt;
          line-height: 1.6;
          color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
          margin-top: 1em;
          margin-bottom: 0.5em;
          color: #000;
        }
        h1 { font-size: 24pt; }
        h2 { font-size: 20pt; }
        h3 { font-size: 16pt; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .header {
          margin-bottom: 2em;
        }
        .footer {
          margin-top: 2em;
          font-size: 10pt;
          color: #666;
        }
      </style>
    `;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${defaultStyles}
  ${customStyles ? `<style>${customStyles}</style>` : ""}
</head>
<body>
  ${content}
</body>
</html>
    `.trim();
  }
}

/**
 * DOCX Generation Service
 * Generates Word documents
 */
export class DOCXGenerationService {
  /**
   * Generate DOCX from HTML content
   * Note: This is a simplified version. For production, use htmlDocx library
   */
  static async generateDOCX(
    htmlContent: string
  ): Promise<Buffer> {
    // For now, we'll return a placeholder
    // In production, use the htmlDocx library to convert HTML to DOCX
    const placeholder = Buffer.from(
      "DOCX generation requires htmlDocx library to be installed"
    );
    return placeholder;
  }
}

/**
 * Document Generation Service
 * Main orchestrator for document generation
 */
export class DocumentGenerationService {
  /**
   * Generate document from template
   */
  static async generateDocument(
    templateId: number,
    contextIds: {
      businessRecordId?: number;
      quoteId?: number;
      dealId?: number;
      serviceCallId?: number;
      invoiceId?: number;
      workflowId?: number;
      taskId?: number;
    },
    userId: number,
    tenantId: number,
    options?: {
      name?: string;
      format?: "pdf" | "docx" | "html";
      customData?: Record<string, any>;
    }
  ): Promise<number> {
    // Fetch template
    const template = await db.query.documentTemplates.findFirst({
      where: (templates, { eq, and }) =>
        and(
          eq(templates.id, templateId),
          eq(templates.tenantId, tenantId)
        ),
    });

    if (!template) {
      throw new Error("Template not found");
    }

    if (!template.isActive) {
      throw new Error("Template is not active");
    }

    // Fetch data context
    let dataContext = await TemplateRenderingService.fetchDataContext(
      template.fieldMapping as Record<string, string>,
      contextIds,
      tenantId
    );

    // Merge custom data if provided
    if (options?.customData) {
      dataContext = { ...dataContext, ...options.customData };
    }

    // Render template
    const renderedContent = TemplateRenderingService.renderTemplate(
      template.content,
      dataContext
    );

    // Generate document based on format
    const format = options?.format || template.format;
    let filePath: string | null = null;
    let fileBuffer: Buffer | null = null;
    let fileSize = 0;

    if (format === "pdf") {
      const htmlWithStyles = PDFGenerationService.wrapHTMLWithStyles(
        renderedContent,
        template.styles ? JSON.stringify(template.styles) : undefined
      );

      fileBuffer = await PDFGenerationService.generatePDF(
        htmlWithStyles,
        template.pageSettings
      );

      // Save to file
      const fileName = `${Date.now()}-${template.name.replace(/\s+/g, "-")}.pdf`;
      filePath = path.join(process.cwd(), "attached_assets", "generated-documents", fileName);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, fileBuffer);

      fileSize = fileBuffer.length;
    } else if (format === "docx") {
      fileBuffer = await DOCXGenerationService.generateDOCX(renderedContent);

      const fileName = `${Date.now()}-${template.name.replace(/\s+/g, "-")}.docx`;
      filePath = path.join(process.cwd(), "attached_assets", "generated-documents", fileName);

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, fileBuffer);

      fileSize = fileBuffer.length;
    } else {
      // HTML format - save as-is
      const fileName = `${Date.now()}-${template.name.replace(/\s+/g, "-")}.html`;
      filePath = path.join(process.cwd(), "attached_assets", "generated-documents", fileName);

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, renderedContent);

      fileSize = Buffer.byteLength(renderedContent);
    }

    // Create generated document record
    const [generatedDoc] = await db.insert(generatedDocuments).values({
      tenantId,
      templateId: template.id,
      templateVersion: template.version,
      name: options?.name || `${template.name} - ${new Date().toLocaleDateString()}`,
      type: template.type,
      format,
      content: renderedContent,
      filePath,
      fileSize,
      dataContext,
      workflowId: contextIds.workflowId,
      taskId: contextIds.taskId,
      businessRecordId: contextIds.businessRecordId,
      quoteId: contextIds.quoteId,
      dealId: contextIds.dealId,
      serviceCallId: contextIds.serviceCallId,
      generatedBy: userId,
    }).returning();

    // Update template usage
    await db.update(documentTemplates)
      .set({
        usageCount: template.usageCount + 1,
        lastUsedAt: new Date(),
      })
      .where(eq(documentTemplates.id, template.id));

    console.log(`Generated document ${generatedDoc.id} from template ${templateId}`);

    return generatedDoc.id;
  }

  /**
   * Batch generate documents (e.g., for multiple customers)
   */
  static async batchGenerateDocuments(
    templateId: number,
    contextList: Array<{
      businessRecordId?: number;
      quoteId?: number;
      dealId?: number;
      serviceCallId?: number;
      invoiceId?: number;
      workflowId?: number;
      taskId?: number;
    }>,
    userId: number,
    tenantId: number,
    options?: {
      format?: "pdf" | "docx" | "html";
    }
  ): Promise<number[]> {
    const generatedDocIds: number[] = [];

    for (const context of contextList) {
      try {
        const docId = await this.generateDocument(
          templateId,
          context,
          userId,
          tenantId,
          options
        );
        generatedDocIds.push(docId);
      } catch (error: any) {
        console.error(`Failed to generate document for context:`, context, error);
        // Continue with next document
      }
    }

    return generatedDocIds;
  }

  /**
   * Preview template with sample data
   */
  static async previewTemplate(
    templateId: number,
    sampleData: Record<string, any>,
    tenantId: number
  ): Promise<string> {
    const template = await db.query.documentTemplates.findFirst({
      where: (templates, { eq, and }) =>
        and(
          eq(templates.id, templateId),
          eq(templates.tenantId, tenantId)
        ),
    });

    if (!template) {
      throw new Error("Template not found");
    }

    return TemplateRenderingService.renderTemplate(
      template.content,
      sampleData
    );
  }
}
