/**
 * PDF GENERATION SERVICE
 *
 * Generates professional PDF documents for:
 * - Invoices
 * - Credit memos
 * - Billing statements
 * - Reports
 *
 * Uses PDFKit for PDF generation with proper formatting,
 * company branding, and table layouts.
 */

import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  invoices,
  invoiceLineItems,
  businessRecords,
  users,
  type Invoice,
  type InvoiceLineItem,
} from '@shared/schema';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface InvoiceWithDetails extends Invoice {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  lineItems?: InvoiceLineItem[];
}

export interface PDFGenerationOptions {
  includeNotes?: boolean;
  includePaymentTerms?: boolean;
  watermark?: string; // 'DRAFT', 'PAID', 'OVERDUE', etc.
  companyLogo?: string; // URL or base64
}

export interface CompanyInfo {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
}

// =============================================================================
// PDF GENERATION SERVICE CLASS
// =============================================================================

class PDFGenerationService {

  // ===========================================================================
  // INVOICE PDF GENERATION
  // ===========================================================================

  /**
   * Generate invoice PDF as a buffer
   */
  async generateInvoicePDF(
    invoiceId: string,
    tenantId: string,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    // 1. Fetch invoice with all details
    const invoice = await this.fetchInvoiceWithDetails(invoiceId, tenantId);

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // 2. Fetch company information
    const companyInfo = await this.fetchCompanyInfo(tenantId);

    // 3. Generate PDF
    return this.createInvoicePDF(invoice, companyInfo, options);
  }

  /**
   * Generate invoice PDF as a readable stream
   */
  async generateInvoicePDFStream(
    invoiceId: string,
    tenantId: string,
    options: PDFGenerationOptions = {}
  ): Promise<Readable> {
    const invoice = await this.fetchInvoiceWithDetails(invoiceId, tenantId);

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const companyInfo = await this.fetchCompanyInfo(tenantId);

    return this.createInvoicePDFStream(invoice, companyInfo, options);
  }

  // ===========================================================================
  // CORE PDF CREATION
  // ===========================================================================

  /**
   * Create invoice PDF document and return as buffer
   */
  private async createInvoicePDF(
    invoice: InvoiceWithDetails,
    companyInfo: CompanyInfo,
    options: PDFGenerationOptions
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = this.createInvoicePDFDocument(invoice, companyInfo, options);

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.end();
    });
  }

  /**
   * Create invoice PDF document and return as stream
   */
  private createInvoicePDFStream(
    invoice: InvoiceWithDetails,
    companyInfo: CompanyInfo,
    options: PDFGenerationOptions
  ): Readable {
    return this.createInvoicePDFDocument(invoice, companyInfo, options);
  }

  /**
   * Create the actual PDF document
   */
  private createInvoicePDFDocument(
    invoice: InvoiceWithDetails,
    companyInfo: CompanyInfo,
    options: PDFGenerationOptions
  ): PDFKit.PDFDocument {
    const doc = new PDFDocument({
      size: 'letter',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: companyInfo.name,
        Subject: `Invoice for ${invoice.customerName || 'Customer'}`,
        Creator: 'Printyx Billing System',
      },
    });

    // Add watermark if specified
    if (options.watermark) {
      this.addWatermark(doc, options.watermark);
    }

    // Header section
    this.renderHeader(doc, companyInfo, invoice);

    // Bill To section
    this.renderBillTo(doc, invoice);

    // Invoice details
    this.renderInvoiceDetails(doc, invoice);

    // Line items table
    this.renderLineItemsTable(doc, invoice);

    // Totals section
    this.renderTotals(doc, invoice);

    // Notes and payment terms
    if (options.includeNotes !== false && invoice.notes) {
      this.renderNotes(doc, invoice.notes);
    }

    if (options.includePaymentTerms !== false) {
      this.renderPaymentTerms(doc, invoice);
    }

    // Footer
    this.renderFooter(doc, companyInfo);

    return doc;
  }

  // ===========================================================================
  // PDF RENDERING SECTIONS
  // ===========================================================================

  /**
   * Render header with company info and logo
   */
  private renderHeader(
    doc: PDFKit.PDFDocument,
    companyInfo: CompanyInfo,
    invoice: InvoiceWithDetails
  ): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Company name (large, bold)
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(companyInfo.name, 50, 50, { width: pageWidth / 2 });

    // Company details (smaller)
    doc
      .fontSize(10)
      .font('Helvetica')
      .moveDown(0.3);

    if (companyInfo.address) {
      doc.text(companyInfo.address);
    }
    if (companyInfo.city && companyInfo.state && companyInfo.zip) {
      doc.text(`${companyInfo.city}, ${companyInfo.state} ${companyInfo.zip}`);
    }
    if (companyInfo.phone) {
      doc.text(`Phone: ${companyInfo.phone}`);
    }
    if (companyInfo.email) {
      doc.text(`Email: ${companyInfo.email}`);
    }

    // "INVOICE" title on the right side
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('INVOICE', pageWidth / 2 + 50, 50, {
        width: pageWidth / 2,
        align: 'right',
      });

    // Invoice status badge
    const status = invoice.invoiceStatus || invoice.status || 'draft';
    this.renderStatusBadge(doc, status, pageWidth);

    doc.moveDown(3);
  }

  /**
   * Render status badge
   */
  private renderStatusBadge(
    doc: PDFKit.PDFDocument,
    status: string,
    pageWidth: number
  ): void {
    const statusColors: Record<string, string> = {
      draft: '#6B7280',
      sent: '#3B82F6',
      paid: '#10B981',
      partial: '#F59E0B',
      overdue: '#EF4444',
      cancelled: '#6B7280',
    };

    const color = statusColors[status.toLowerCase()] || '#6B7280';
    const statusText = status.toUpperCase();

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(color)
      .text(statusText, pageWidth / 2 + 50, 90, {
        width: pageWidth / 2,
        align: 'right',
      })
      .fillColor('#000000'); // Reset to black
  }

  /**
   * Render "Bill To" section
   */
  private renderBillTo(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceWithDetails
  ): void {
    const startY = doc.y;

    // Bill To section (left side)
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('BILL TO:', 50, startY);

    doc
      .fontSize(10)
      .font('Helvetica')
      .moveDown(0.3)
      .text(invoice.customerName || 'N/A', 50);

    if (invoice.customerEmail) {
      doc.text(invoice.customerEmail, 50);
    }
    if (invoice.customerPhone) {
      doc.text(invoice.customerPhone, 50);
    }

    doc.moveDown(1);
  }

  /**
   * Render invoice details (number, date, due date, etc.)
   */
  private renderInvoiceDetails(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceWithDetails
  ): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = 180;

    doc
      .fontSize(10)
      .font('Helvetica-Bold');

    // Invoice number
    doc.text('Invoice Number:', pageWidth / 2 + 50, startY, { continued: true });
    doc
      .font('Helvetica')
      .text(`  ${invoice.invoiceNumber}`, { align: 'right' });

    // Issue date
    doc
      .font('Helvetica-Bold')
      .text('Issue Date:', pageWidth / 2 + 50, startY + 15, { continued: true });
    doc
      .font('Helvetica')
      .text(`  ${this.formatDate(invoice.invoiceDate || invoice.issueDate)}`, { align: 'right' });

    // Due date
    doc
      .font('Helvetica-Bold')
      .text('Due Date:', pageWidth / 2 + 50, startY + 30, { continued: true });
    doc
      .font('Helvetica')
      .text(`  ${this.formatDate(invoice.dueDate)}`, { align: 'right' });

    // Payment terms
    if (invoice.paymentTerms) {
      doc
        .font('Helvetica-Bold')
        .text('Payment Terms:', pageWidth / 2 + 50, startY + 45, { continued: true });
      doc
        .font('Helvetica')
        .text(`  ${this.formatPaymentTerms(invoice.paymentTerms)}`, { align: 'right' });
    }

    // Billing period
    if (invoice.billingPeriodStart && invoice.billingPeriodEnd) {
      doc
        .font('Helvetica-Bold')
        .text('Billing Period:', pageWidth / 2 + 50, startY + 60, { continued: true });
      doc
        .font('Helvetica')
        .text(
          `  ${this.formatDate(invoice.billingPeriodStart)} - ${this.formatDate(invoice.billingPeriodEnd)}`,
          { align: 'right' }
        );
    }

    doc.moveDown(2);
  }

  /**
   * Render line items table
   */
  private renderLineItemsTable(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceWithDetails
  ): void {
    const tableTop = doc.y + 20;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const colWidths = {
      description: pageWidth * 0.45,
      quantity: pageWidth * 0.15,
      unitPrice: pageWidth * 0.20,
      total: pageWidth * 0.20,
    };

    // Table header
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1F2937');

    let xPos = 50;
    doc.text('Description', xPos, tableTop);
    xPos += colWidths.description;
    doc.text('Quantity', xPos, tableTop, { width: colWidths.quantity, align: 'center' });
    xPos += colWidths.quantity;
    doc.text('Unit Price', xPos, tableTop, { width: colWidths.unitPrice, align: 'right' });
    xPos += colWidths.unitPrice;
    doc.text('Amount', xPos, tableTop, { width: colWidths.total, align: 'right' });

    // Header line
    doc
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .moveTo(50, tableTop + 15)
      .lineTo(50 + pageWidth, tableTop + 15)
      .stroke();

    // Line items
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#000000');

    let yPos = tableTop + 25;
    const lineItems = invoice.lineItems || [];

    for (const item of lineItems) {
      // Check if we need a new page
      if (yPos > doc.page.height - 150) {
        doc.addPage();
        yPos = 50;
      }

      xPos = 50;

      // Description
      doc.text(item.description || 'Item', xPos, yPos, {
        width: colWidths.description - 5,
        ellipsis: true,
      });

      // Quantity
      xPos += colWidths.description;
      doc.text(
        item.quantity || '1',
        xPos,
        yPos,
        { width: colWidths.quantity, align: 'center' }
      );

      // Unit price
      xPos += colWidths.quantity;
      doc.text(
        this.formatCurrency(item.unitPrice),
        xPos,
        yPos,
        { width: colWidths.unitPrice, align: 'right' }
      );

      // Total
      xPos += colWidths.unitPrice;
      doc.text(
        this.formatCurrency(item.total),
        xPos,
        yPos,
        { width: colWidths.total, align: 'right' }
      );

      yPos += 20;
    }

    // Bottom line
    doc
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .moveTo(50, yPos)
      .lineTo(50 + pageWidth, yPos)
      .stroke();

    doc.y = yPos + 10;
  }

  /**
   * Render totals section
   */
  private renderTotals(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceWithDetails
  ): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rightColX = pageWidth * 0.65 + 50;
    const valueColX = pageWidth * 0.85 + 50;
    const valueColWidth = pageWidth * 0.15;

    let yPos = doc.y + 10;

    doc.fontSize(10).font('Helvetica');

    // Subtotal
    if (invoice.subtotal) {
      doc.text('Subtotal:', rightColX, yPos);
      doc.text(
        this.formatCurrency(invoice.subtotal),
        valueColX,
        yPos,
        { width: valueColWidth, align: 'right' }
      );
      yPos += 20;
    }

    // Tax
    if (invoice.tax && parseFloat(invoice.tax) > 0) {
      doc.text('Tax:', rightColX, yPos);
      doc.text(
        this.formatCurrency(invoice.tax),
        valueColX,
        yPos,
        { width: valueColWidth, align: 'right' }
      );
      yPos += 20;
    }

    // Total line
    doc
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .moveTo(rightColX, yPos)
      .lineTo(50 + pageWidth, yPos)
      .stroke();

    yPos += 10;

    // Total (bold and larger)
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Total:', rightColX, yPos);
    doc.text(
      this.formatCurrency(invoice.totalAmount || invoice.total),
      valueColX,
      yPos,
      { width: valueColWidth, align: 'right' }
    );

    yPos += 25;

    // Amount paid
    if (invoice.paid && parseFloat(invoice.paid) > 0) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Amount Paid:', rightColX, yPos);
      doc.text(
        this.formatCurrency(invoice.paid),
        valueColX,
        yPos,
        { width: valueColWidth, align: 'right' }
      );
      yPos += 20;
    }

    // Balance due
    if (invoice.balance && parseFloat(invoice.balance) !== 0) {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#EF4444')
        .text('Balance Due:', rightColX, yPos);
      doc.text(
        this.formatCurrency(invoice.balance),
        valueColX,
        yPos,
        { width: valueColWidth, align: 'right' }
      );
      doc.fillColor('#000000');
    }

    doc.y = yPos + 30;
  }

  /**
   * Render notes section
   */
  private renderNotes(doc: PDFKit.PDFDocument, notes: string): void {
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Notes:', 50);

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(notes, 50, doc.y, {
        width: doc.page.width - 100,
        align: 'left',
      });

    doc.moveDown(1);
  }

  /**
   * Render payment terms section
   */
  private renderPaymentTerms(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceWithDetails
  ): void {
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Payment Terms:', 50);

    const terms = this.formatPaymentTerms(invoice.paymentTerms || 'net30');

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Payment is due ${terms.toLowerCase()}`, 50);

    doc.moveDown(1);
  }

  /**
   * Render footer with page numbers and additional info
   */
  private renderFooter(
    doc: PDFKit.PDFDocument,
    companyInfo: CompanyInfo
  ): void {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 50;

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(
        'Thank you for your business!',
        50,
        footerY,
        { align: 'center', width: doc.page.width - 100 }
      );

    if (companyInfo.website) {
      doc.text(
        companyInfo.website,
        50,
        footerY + 12,
        { align: 'center', width: doc.page.width - 100 }
      );
    }

    doc.fillColor('#000000');
  }

  /**
   * Add watermark (DRAFT, PAID, etc.)
   */
  private addWatermark(doc: PDFKit.PDFDocument, text: string): void {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    doc.save();

    doc
      .fontSize(80)
      .font('Helvetica-Bold')
      .fillColor('#E5E7EB')
      .opacity(0.3)
      .rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] })
      .text(text, 0, pageHeight / 2 - 40, {
        width: pageWidth,
        align: 'center',
      });

    doc.restore();
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Fetch invoice with all related details
   */
  private async fetchInvoiceWithDetails(
    invoiceId: string,
    tenantId: string
  ): Promise<InvoiceWithDetails | null> {
    // Fetch invoice
    const [invoice] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerName: businessRecords.companyName,
        customerEmail: businessRecords.email,
        customerPhone: businessRecords.phone,
        contractId: invoices.contractId,
        issueDate: invoices.issueDate,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        subtotal: invoices.subtotal,
        totalAmount: invoices.totalAmount,
        total: invoices.total,
        balance: invoices.balance,
        paid: invoices.paid,
        tax: invoices.tax,
        status: invoices.status,
        invoiceStatus: invoices.invoiceStatus,
        paymentTerms: invoices.paymentTerms,
        paymentDate: invoices.paymentDate,
        paymentMethod: invoices.paymentMethod,
        description: invoices.description,
        notes: invoices.notes,
        billingPeriodStart: invoices.billingPeriodStart,
        billingPeriodEnd: invoices.billingPeriodEnd,
        tenantId: invoices.tenantId,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      return null;
    }

    // Fetch line items
    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    return {
      ...invoice,
      lineItems,
    } as InvoiceWithDetails;
  }

  /**
   * Fetch company information for the tenant
   */
  private async fetchCompanyInfo(tenantId: string): Promise<CompanyInfo> {
    // This would fetch from a tenant settings table
    // For now, return default values
    return {
      name: 'Printyx',
      address: '123 Business St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      phone: '(555) 123-4567',
      email: 'billing@printyx.com',
      website: 'www.printyx.com',
      taxId: '12-3456789',
    };
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: string | number | null | undefined): string {
    if (amount === null || amount === undefined) return '$0.00';

    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  }

  /**
   * Format payment terms for display
   */
  private formatPaymentTerms(terms: string): string {
    const termsMap: Record<string, string> = {
      net30: 'Net 30 days',
      net15: 'Net 15 days',
      net60: 'Net 60 days',
      due_on_receipt: 'Due on receipt',
      net7: 'Net 7 days',
      net10: 'Net 10 days',
      net45: 'Net 45 days',
      net90: 'Net 90 days',
    };

    return termsMap[terms] || terms;
  }
}

// Export singleton instance
export const pdfGenerationService = new PDFGenerationService();
export { PDFGenerationService };
