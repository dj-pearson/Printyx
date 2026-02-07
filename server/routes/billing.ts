/**
 * CONSOLIDATED BILLING ROUTES
 *
 * This file consolidates all billing-related endpoints that were previously
 * scattered across multiple route files:
 * - server/routes-billing.ts (Stripe, payment methods, subscription billing)
 * - server/routes-enhanced-billing.ts (LEAN metrics, auto-invoice status)
 * - server/routes-invoices.ts (Core invoice CRUD operations)
 *
 * All business logic has been extracted to the billing-engine-service.ts for
 * better testability, maintainability, and reusability.
 */

import { Router } from 'express';
import { db } from '../db';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('billing');

import {
  subscriptionPaymentMethods,
  billingHistory,
  tenantSubscriptions,
  invoices,
  invoiceLineItems,
  businessRecords,
  autoInvoiceGeneration,
  billingRules,
  billingDisputes,
  creditMemos,
  insertInvoiceSchema,
  insertBillingRuleSchema,
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte, isNotNull, count } from 'drizzle-orm';
import { z } from 'zod';
import { StripeService, stripe } from '../services/stripe-service';
import { billingEngine } from '../services/billing-engine-service';
import { pdfGenerationService } from '../services/pdf-generation-service';
import { emailService } from '../services/email-service';
import { billingAnalytics } from '../services/billing-analytics-service';

const router = Router();

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Ensure tenant context is available
 */
const requireTenantContext = (req: any, res: any, next: any) => {
  if (!req.tenantId && !req.user?.tenantId) {
    return res.status(401).json({ error: 'No tenant context' });
  }
  req.tenantId = req.tenantId || req.user?.tenantId;
  next();
};

/**
 * Require authentication (placeholder - adjust based on your auth setup)
 */
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.user && !req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const billingAddressSchema = z.object({
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default('US'),
});

const invoiceGenerationSchema = z.object({
  contractId: z.string(),
  billingPeriodStart: z.string().datetime().optional(),
  billingPeriodEnd: z.string().datetime().optional(),
  autoSend: z.boolean().optional(),
});

// =============================================================================
// PAYMENT METHODS
// =============================================================================

/**
 * GET /api/billing/payment-methods
 * List all payment methods for the tenant
 */
router.get('/payment-methods', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    const paymentMethods = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(eq(subscriptionPaymentMethods.tenantId, tenantId))
      .orderBy(
        desc(subscriptionPaymentMethods.isDefault),
        desc(subscriptionPaymentMethods.createdAt),
      );

    res.json(paymentMethods);
  } catch (error) {
    log.error('Failed to fetch payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * POST /api/billing/payment-methods
 * Add a new payment method via Stripe
 */
router.post('/payment-methods', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { paymentMethodId, billingDetails } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    if (!StripeService.isConfigured()) {
      return res.status(501).json({
        error: 'Stripe is not configured',
        message: 'Please set STRIPE_SECRET_KEY environment variable',
      });
    }

    // Get or create Stripe customer for tenant
    const stripeCustomerId = await StripeService.getOrCreateCustomer(tenantId);

    // Attach payment method to customer
    const paymentMethod = await StripeService.addPaymentMethod({
      stripeCustomerId,
      paymentMethodId,
      setAsDefault: true,
    });

    // Check if this is the first payment method
    const existingMethods = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(eq(subscriptionPaymentMethods.tenantId, tenantId));

    const isFirst = existingMethods.length === 0;

    // Store payment method in database
    const [newPaymentMethod] = await db
      .insert(subscriptionPaymentMethods)
      .values({
        tenantId,
        provider: 'stripe',
        stripePaymentMethodId: paymentMethod.id,
        cardBrand: paymentMethod.card?.brand || '',
        cardLast4: paymentMethod.card?.last4 || '',
        cardExpMonth: paymentMethod.card?.exp_month || 0,
        cardExpYear: paymentMethod.card?.exp_year || 0,
        isDefault: isFirst,
        billingDetails: billingDetails || paymentMethod.billing_details,
      })
      .returning();

    res.json({
      message: 'Payment method added successfully',
      paymentMethod: newPaymentMethod,
    });
  } catch (error: any) {
    log.error('Failed to add payment method:', error);
    res.status(500).json({
      error: 'Failed to add payment method',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/billing/payment-methods/:id
 * Remove a payment method
 */
router.delete('/payment-methods/:id', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const paymentMethodId = req.params.id;

    // Verify payment method belongs to tenant
    const [paymentMethod] = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(
        and(
          eq(subscriptionPaymentMethods.id, paymentMethodId),
          eq(subscriptionPaymentMethods.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Don't allow deleting the default payment method if it's the only one
    if (paymentMethod.isDefault) {
      const allMethods = await db
        .select()
        .from(subscriptionPaymentMethods)
        .where(eq(subscriptionPaymentMethods.tenantId, tenantId));

      if (allMethods.length === 1) {
        return res.status(400).json({
          error: 'Cannot delete the only payment method',
          message: 'Add another payment method before deleting this one',
        });
      }
    }

    // Remove from Stripe if configured
    if (StripeService.isConfigured() && paymentMethod.stripePaymentMethodId) {
      try {
        await StripeService.removePaymentMethod(paymentMethod.stripePaymentMethodId);
      } catch (error) {
        log.error('Failed to remove from Stripe:', error);
        // Continue with database deletion even if Stripe fails
      }
    }

    // Delete the payment method from database
    await db
      .delete(subscriptionPaymentMethods)
      .where(eq(subscriptionPaymentMethods.id, paymentMethodId));

    // If it was the default, set another one as default
    if (paymentMethod.isDefault) {
      const [nextMethod] = await db
        .select()
        .from(subscriptionPaymentMethods)
        .where(eq(subscriptionPaymentMethods.tenantId, tenantId))
        .limit(1);

      if (nextMethod) {
        await db
          .update(subscriptionPaymentMethods)
          .set({ isDefault: true })
          .where(eq(subscriptionPaymentMethods.id, nextMethod.id));
      }
    }

    res.json({ message: 'Payment method deleted successfully' });
  } catch (error) {
    log.error('Failed to delete payment method:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// =============================================================================
// INVOICES - CORE CRUD OPERATIONS
// =============================================================================

/**
 * GET /api/billing/invoices
 * List all invoices with comprehensive filtering
 * Combines functionality from routes-billing.ts, routes-enhanced-billing.ts, and routes-invoices.ts
 */
router.get('/invoices', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      status,
      fromDate,
      toDate,
      customerId,
      contractId,
      ticketId,
      filter,
      limit = 50,
      offset = 0,
    } = req.query;

    let query = db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerName: businessRecords.companyName,
        contractId: invoices.contractId,
        ticketId: invoices.externalCustomerId,
        issueDate: invoices.issuedAt,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        balance: invoices.balance,
        paid: invoices.paid,
        status: invoices.status,
        invoiceStatus: invoices.invoiceStatus,
        paymentTerms: invoices.paymentTerms,
        description: invoices.description,
        billingPeriodStart: invoices.billingPeriodStart,
        billingPeriodEnd: invoices.billingPeriodEnd,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id));

    // Build filter conditions
    const conditions = [eq(invoices.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(invoices.invoiceStatus, status as string));
    }

    if (customerId) {
      conditions.push(eq(invoices.customerId, customerId as string));
    }

    if (contractId) {
      conditions.push(eq(invoices.contractId, contractId as string));
    }

    if (ticketId) {
      conditions.push(eq(invoices.externalCustomerId, ticketId as string));
    }

    if (fromDate) {
      conditions.push(gte(invoices.invoiceDate, new Date(fromDate as string)));
    }

    if (toDate) {
      conditions.push(lte(invoices.invoiceDate, new Date(toDate as string)));
    }

    // Special filters (LEAN playbook)
    if (filter === 'overdue') {
      conditions.push(and(eq(invoices.invoiceStatus, 'open'), sql`${invoices.dueDate} < NOW()`)!);
    }

    if (filter === 'recent_auto_generated') {
      conditions.push(
        and(
          isNotNull(invoices.externalCustomerId),
          gte(invoices.createdAt, sql`NOW() - INTERVAL '7 days'`),
        )!,
      );
    }

    const finalQuery = query
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const invoiceResults = await finalQuery;

    // Get total count for pagination
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(invoices)
      .where(and(...conditions));

    res.json({
      invoices: invoiceResults,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < totalCount,
      },
      filters: {
        status,
        customerId,
        contractId,
        ticketId,
        filter,
      },
    });
  } catch (error) {
    log.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/billing/invoices/:id
 * Get invoice by ID with full details
 */
router.get('/invoices/:id', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const invoiceId = req.params.id;

    const [invoice] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerName: businessRecords.companyName,
        customerEmail: businessRecords.email,
        customerPhone: businessRecords.phone,
        contractId: invoices.contractId,
        issueDate: invoices.issuedAt,
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
        paymentNotes: invoices.paymentNotes,
        description: invoices.description,
        notes: invoices.notes,
        billingPeriodStart: invoices.billingPeriodStart,
        billingPeriodEnd: invoices.billingPeriodEnd,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get line items
    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    res.json({
      ...invoice,
      lineItems,
    });
  } catch (error) {
    log.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * POST /api/billing/invoices
 * Create new invoice (manual or from contract)
 */
router.post('/invoices', isAuthenticated, requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.claims?.sub || req.session?.userId;

    // Check if this is contract-based generation
    if (req.body.contractId && req.body.useContractGeneration) {
      const schema = invoiceGenerationSchema.parse(req.body);

      const invoice = await billingEngine.generateInvoiceFromContract(schema.contractId, tenantId, {
        billingPeriodStart: schema.billingPeriodStart
          ? new Date(schema.billingPeriodStart)
          : undefined,
        billingPeriodEnd: schema.billingPeriodEnd ? new Date(schema.billingPeriodEnd) : undefined,
        autoSend: schema.autoSend,
      });

      return res.status(201).json(invoice);
    }

    // Manual invoice creation
    const invoiceData = insertInvoiceSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
      invoiceNumber: req.body.invoiceNumber || `INV-${Date.now()}`,
      status: req.body.status || 'draft',
      invoiceStatus: req.body.invoiceStatus || 'draft',
    });

    const [newInvoice] = await db.insert(invoices).values(invoiceData).returning();

    res.status(201).json(newInvoice);
  } catch (error: any) {
    log.error('Error creating invoice:', error);
    res.status(500).json({
      error: 'Failed to create invoice',
      message: error.message,
    });
  }
});

/**
 * PUT /api/billing/invoices/:id
 * Update invoice
 */
router.put('/invoices/:id', isAuthenticated, requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const invoiceId = req.params.id;

    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .returning();

    if (!updatedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(updatedInvoice);
  } catch (error) {
    log.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

/**
 * DELETE /api/billing/invoices/:id
 * Delete invoice (only drafts)
 */
router.delete('/invoices/:id', isAuthenticated, requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const invoiceId = req.params.id;

    // Check if invoice can be deleted (only drafts can be deleted)
    const [existingInvoice] = await db
      .select({ status: invoices.status, invoiceStatus: invoices.invoiceStatus })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (existingInvoice.status !== 'draft' && existingInvoice.invoiceStatus !== 'draft') {
      return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    }

    // Delete line items first
    await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));

    // Delete invoice
    await db
      .delete(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    log.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

/**
 * PATCH /api/billing/invoices/:id/send
 * POST /api/billing/invoices/:id/email
 * Send invoice via email with PDF attachment
 */
router.patch('/invoices/:id/send', isAuthenticated, requireTenantContext, async (req: any, res) => {
  return handleInvoiceSend(req, res);
});

router.post('/invoices/:id/email', isAuthenticated, requireTenantContext, async (req: any, res) => {
  return handleInvoiceSend(req, res);
});

async function handleInvoiceSend(req: any, res: any) {
  try {
    const tenantId = req.tenantId;
    const invoiceId = req.params.id;
    const { recipientEmail, customMessage, includeAttachment = true } = req.body;

    // Fetch invoice with customer details
    const [invoice] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerName: businessRecords.companyName,
        customerEmail: businessRecords.email,
        totalAmount: invoices.totalAmount,
        total: invoices.total,
        dueDate: invoices.dueDate,
        balance: invoices.balance,
        status: invoices.status,
        invoiceStatus: invoices.invoiceStatus,
      })
      .from(invoices)
      .leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Determine recipient email
    const toEmail = recipientEmail || invoice.customerEmail;
    if (!toEmail) {
      return res.status(400).json({
        error: 'No recipient email available',
        message: 'Please provide a recipient email or ensure customer has an email on file',
      });
    }

    // Generate PDF if attachment requested
    let pdfBuffer: Buffer | undefined;
    if (includeAttachment) {
      pdfBuffer = await pdfGenerationService.generateInvoicePDF(invoiceId, tenantId, {
        watermark: invoice.invoiceStatus === 'draft' ? 'DRAFT' : undefined,
      });
    }

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1F2937; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .invoice-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: bold; }
          .total { font-size: 1.2em; color: #1F2937; font-weight: bold; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice from Printyx</h1>
          </div>
          <div class="content">
            <p>Hello ${invoice.customerName || 'valued customer'},</p>
            ${customMessage ? `<p>${customMessage}</p>` : `<p>Please find attached your invoice for recent services.</p>`}

            <div class="invoice-details">
              <div class="detail-row">
                <span class="detail-label">Invoice Number:</span>
                <span>${invoice.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Due Date:</span>
                <span>${new Date(invoice.dueDate).toLocaleDateString()}</span>
              </div>
              <div class="detail-row total">
                <span class="detail-label">Amount Due:</span>
                <span>$${parseFloat(invoice.balance || invoice.totalAmount || invoice.total || '0').toFixed(2)}</span>
              </div>
            </div>

            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

            <p>Thank you for your business!</p>

            <p>Best regards,<br>The Printyx Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply directly to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Printyx. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const emailResult = await emailService.send({
      to: toEmail,
      subject: `Invoice ${invoice.invoiceNumber} from Printyx`,
      html: emailHtml,
      text: `Invoice ${invoice.invoiceNumber}\n\nAmount Due: $${parseFloat(invoice.balance || invoice.totalAmount || '0').toFixed(2)}\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString()}\n\nPlease see the attached PDF for full invoice details.`,
      from: process.env.BILLING_FROM_EMAIL || 'billing@printyx.com',
    });

    if (!emailResult.success) {
      return res.status(500).json({
        error: 'Failed to send email',
        message: emailResult.error || 'Email service error',
      });
    }

    // Update invoice status to 'sent'
    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        status: 'sent',
        invoiceStatus: 'sent',
        issueDate: invoice.issueDate || new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .returning();

    res.json({
      message: 'Invoice sent successfully',
      invoice: updatedInvoice,
      sentTo: toEmail,
      messageId: emailResult.messageId,
    });
  } catch (error: any) {
    log.error('Error sending invoice:', error);
    res.status(500).json({
      error: 'Failed to send invoice',
      message: error.message,
    });
  }
}

/**
 * PATCH /api/billing/invoices/:id/paid
 * POST /api/billing/invoices/:id/pay
 * Record invoice payment
 */
router.patch('/invoices/:id/paid', isAuthenticated, requireTenantContext, async (req: any, res) => {
  return handlePaymentRecording(req, res);
});

router.post('/invoices/:id/pay', isAuthenticated, requireTenantContext, async (req: any, res) => {
  return handlePaymentRecording(req, res);
});

async function handlePaymentRecording(req: any, res: any) {
  try {
    const tenantId = req.tenantId;
    const invoiceId = req.params.id;
    const { paymentDate, paymentMethod, paymentNotes, amount } = req.body;

    // Get current invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Calculate new paid amount and balance
    const paymentAmount = amount || parseFloat(invoice.balance || invoice.totalAmount);
    const newPaid = parseFloat(invoice.paid || '0') + paymentAmount;
    const newBalance = parseFloat(invoice.totalAmount) - newPaid;
    const newStatus =
      newBalance <= 0 ? 'paid' : newBalance < parseFloat(invoice.totalAmount) ? 'partial' : 'sent';

    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        status: newStatus,
        invoiceStatus: newStatus,
        paid: newPaid.toFixed(2),
        balance: newBalance.toFixed(2),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || 'unknown',
        paymentNotes: paymentNotes || '',
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .returning();

    res.json(updatedInvoice);
  } catch (error) {
    log.error('Error marking invoice as paid:', error);
    res.status(500).json({ error: 'Failed to mark invoice as paid' });
  }
}

/**
 * GET /api/billing/invoices/:id/pdf
 * Download invoice PDF
 */
router.get('/invoices/:id/pdf', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const invoiceId = req.params.id;

    // Verify invoice belongs to tenant
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Determine watermark based on status
    let watermark: string | undefined;
    if (invoice.invoiceStatus === 'draft' || invoice.status === 'draft') {
      watermark = 'DRAFT';
    } else if (invoice.invoiceStatus === 'paid') {
      watermark = 'PAID';
    } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
      watermark = 'OVERDUE';
    }

    // Generate PDF
    const pdfBuffer = await pdfGenerationService.generateInvoicePDF(invoiceId, tenantId, {
      watermark,
    });

    // Set response headers
    const filename = `Invoice-${invoice.invoiceNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    log.error('Failed to download invoice:', error);
    res.status(500).json({
      error: 'Failed to download invoice',
      message: error.message,
    });
  }
});

// =============================================================================
// AUTO-INVOICE GENERATION
// =============================================================================

/**
 * GET /api/billing/auto-invoice-status
 * Get auto-invoice generation status
 */
router.get('/auto-invoice-status', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { sourceId, sourceType = 'service_ticket' } = req.query;

    const conditions = [eq(autoInvoiceGeneration.tenantId, tenantId)];

    if (sourceId) {
      conditions.push(eq(autoInvoiceGeneration.sourceId, sourceId as string));
    }

    if (sourceType) {
      conditions.push(eq(autoInvoiceGeneration.sourceType, sourceType as string));
    }

    const generations = await db
      .select()
      .from(autoInvoiceGeneration)
      .where(and(...conditions))
      .orderBy(desc(autoInvoiceGeneration.triggeredAt));

    res.json(generations);
  } catch (error) {
    log.error('Error fetching auto-invoice status:', error);
    res.status(500).json({ error: 'Failed to fetch auto-invoice status' });
  }
});

/**
 * POST /api/billing/auto-generate
 * Manually trigger auto-invoice generation
 */
router.post('/auto-generate', isAuthenticated, requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { sourceType, sourceId } = req.body;

    if (!sourceType || !sourceId) {
      return res.status(400).json({ error: 'sourceType and sourceId are required' });
    }

    let invoice;

    if (sourceType === 'service_ticket') {
      invoice = await billingEngine.autoGenerateFromServiceTicket(sourceId, tenantId);
    } else if (sourceType === 'warehouse_operation') {
      invoice = await billingEngine.autoGenerateFromWarehouseOperation(sourceId, tenantId);
    } else {
      return res.status(400).json({ error: 'Invalid sourceType' });
    }

    res.status(201).json(invoice);
  } catch (error: any) {
    log.error('Error auto-generating invoice:', error);
    res.status(500).json({
      error: 'Failed to auto-generate invoice',
      message: error.message,
    });
  }
});

// =============================================================================
// BILLING METRICS & ANALYTICS
// =============================================================================

/**
 * GET /api/billing/metrics
 * Get comprehensive billing metrics (LEAN playbook)
 */
router.get('/metrics', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { period = '30' } = req.query;

    const dateRange = {
      start: new Date(Date.now() - parseInt(period as string) * 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    const metrics = await billingEngine.calculateBillingMetrics(tenantId, dateRange);

    res.json({
      period: `${period} days`,
      ...metrics,
    });
  } catch (error) {
    log.error('Error fetching billing metrics:', error);
    res.status(500).json({ error: 'Failed to fetch billing metrics' });
  }
});

/**
 * GET /api/billing/health-score
 * Get billing health score
 */
router.get('/health-score', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    const healthScore = await billingEngine.calculateBillingHealthScore(tenantId);

    res.json(healthScore);
  } catch (error) {
    log.error('Error calculating health score:', error);
    res.status(500).json({ error: 'Failed to calculate health score' });
  }
});

/**
 * GET /api/billing/dashboard
 * Get invoices dashboard stats
 */
router.get('/dashboard', isAuthenticated, requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    const [totalInvoicesResult] = await db
      .select({ count: count() })
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));

    const [paidInvoicesResult] = await db
      .select({
        count: count(),
        totalValue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.invoiceStatus, 'paid')));

    const [pendingInvoicesResult] = await db
      .select({
        count: count(),
        totalValue: sql<number>`COALESCE(SUM(CAST(${invoices.balance} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.invoiceStatus, 'sent')));

    const [overdueInvoicesResult] = await db
      .select({
        count: count(),
        totalValue: sql<number>`COALESCE(SUM(CAST(${invoices.balance} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.invoiceStatus, 'sent'),
          sql`${invoices.dueDate} < CURRENT_DATE`,
        ),
      );

    const totalInvoices = totalInvoicesResult?.count || 0;
    const paidInvoices = paidInvoicesResult?.count || 0;
    const paidValue = paidInvoicesResult?.totalValue || 0;
    const pendingInvoices = pendingInvoicesResult?.count || 0;
    const pendingValue = pendingInvoicesResult?.totalValue || 0;
    const overdueInvoices = overdueInvoicesResult?.count || 0;
    const overdueValue = overdueInvoicesResult?.totalValue || 0;

    res.json({
      totalInvoices,
      paidInvoices,
      paidValue,
      pendingInvoices,
      pendingValue,
      overdueInvoices,
      overdueValue,
      paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
    });
  } catch (error) {
    log.error('Error fetching invoices dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch invoices dashboard' });
  }
});

// =============================================================================
// BILLING INFORMATION
// =============================================================================

/**
 * GET /api/billing/info
 * Get billing address and information
 */
router.get('/info', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    // Get default payment method for billing details
    const [paymentMethod] = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(
        and(
          eq(subscriptionPaymentMethods.tenantId, tenantId),
          eq(subscriptionPaymentMethods.isDefault, true),
        ),
      )
      .limit(1);

    const billingDetails = paymentMethod?.billingDetails as any;

    res.json(billingDetails || null);
  } catch (error) {
    log.error('Failed to fetch billing info:', error);
    res.status(500).json({ error: 'Failed to fetch billing info' });
  }
});

/**
 * PUT /api/billing/address
 * Update billing address
 */
router.put('/address', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const addressData = billingAddressSchema.parse(req.body);

    // Update the default payment method's billing details
    const [paymentMethod] = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(
        and(
          eq(subscriptionPaymentMethods.tenantId, tenantId),
          eq(subscriptionPaymentMethods.isDefault, true),
        ),
      )
      .limit(1);

    if (!paymentMethod) {
      return res.status(404).json({
        error: 'No default payment method found',
        message: 'Add a payment method before updating billing address',
      });
    }

    await db
      .update(subscriptionPaymentMethods)
      .set({
        billingDetails: addressData,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPaymentMethods.id, paymentMethod.id));

    res.json({
      message: 'Billing address updated successfully',
      billingDetails: addressData,
    });
  } catch (error) {
    log.error('Failed to update billing address:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid billing address data',
        details: error.errors,
      });
    }
    res.status(500).json({ error: 'Failed to update billing address' });
  }
});

// =============================================================================
// STRIPE INTEGRATION
// =============================================================================

/**
 * GET /api/billing/stripe/config
 * Get Stripe publishable key for frontend
 */
router.get('/stripe/config', (req: any, res) => {
  try {
    if (!StripeService.isConfigured()) {
      return res.status(501).json({
        error: 'Stripe not configured',
        configured: false,
      });
    }

    const publishableKey = StripeService.getPublishableKey();
    res.json({
      publishableKey,
      configured: true,
    });
  } catch (error: any) {
    log.error('Failed to get Stripe config:', error);
    res.status(500).json({
      error: 'Failed to get Stripe configuration',
      message: error.message,
    });
  }
});

/**
 * POST /api/billing/stripe/setup-intent
 * Create a setup intent for adding payment methods
 */
router.post('/stripe/setup-intent', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    if (!StripeService.isConfigured() || !stripe) {
      return res.status(501).json({
        error: 'Stripe not configured',
      });
    }

    // Get or create Stripe customer
    const stripeCustomerId = await StripeService.getOrCreateCustomer(tenantId);

    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: {
        tenantId,
      },
    });

    res.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error: any) {
    log.error('Failed to create setup intent:', error);
    res.status(500).json({
      error: 'Failed to create setup intent',
      message: error.message,
    });
  }
});

/**
 * POST /api/billing/stripe/webhooks
 * Handle Stripe webhook events
 */
router.post('/stripe/webhooks', async (req: any, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      log.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Verify and construct event
    const event = StripeService.constructWebhookEvent(req.body, signature, webhookSecret);

    // Handle the event
    await StripeService.handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error: any) {
    log.error('Webhook error:', error);
    res.status(400).json({
      error: 'Webhook processing failed',
      message: error.message,
    });
  }
});

// =============================================================================
// BILLING RULES MANAGEMENT
// =============================================================================

/**
 * GET /api/billing/rules
 * List all billing rules for the tenant
 */
router.get('/rules', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { status, ruleType, customerId, contractId, limit = 50, offset = 0 } = req.query;

    // Build filter conditions
    const conditions = [eq(billingRules.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(billingRules.ruleStatus, status as string));
    }

    if (ruleType) {
      conditions.push(eq(billingRules.ruleType, ruleType as string));
    }

    if (customerId) {
      conditions.push(eq(billingRules.customerId, customerId as string));
    }

    if (contractId) {
      conditions.push(eq(billingRules.contractId, contractId as string));
    }

    const rules = await db
      .select()
      .from(billingRules)
      .where(and(...conditions))
      .orderBy(desc(billingRules.priority), desc(billingRules.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count for pagination
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(billingRules)
      .where(and(...conditions));

    res.json({
      rules,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < totalCount,
      },
    });
  } catch (error) {
    log.error('Error fetching billing rules:', error);
    res.status(500).json({ error: 'Failed to fetch billing rules' });
  }
});

/**
 * GET /api/billing/rules/:id
 * Get single billing rule by ID
 */
router.get('/rules/:id', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const ruleId = req.params.id;

    const [rule] = await db
      .select()
      .from(billingRules)
      .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
      .limit(1);

    if (!rule) {
      return res.status(404).json({ error: 'Billing rule not found' });
    }

    res.json(rule);
  } catch (error) {
    log.error('Error fetching billing rule:', error);
    res.status(500).json({ error: 'Failed to fetch billing rule' });
  }
});

/**
 * POST /api/billing/rules
 * Create new billing rule
 */
router.post('/rules', isAuthenticated, requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.claims?.sub || req.session?.userId;

    const ruleData = insertBillingRuleSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
    });

    const [newRule] = await db.insert(billingRules).values(ruleData).returning();

    res.status(201).json(newRule);
  } catch (error: any) {
    log.error('Error creating billing rule:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid billing rule data',
        details: error.errors,
      });
    }
    res.status(500).json({
      error: 'Failed to create billing rule',
      message: error.message,
    });
  }
});

/**
 * PUT /api/billing/rules/:id
 * Update billing rule
 */
router.put('/rules/:id', isAuthenticated, requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const ruleId = req.params.id;

    // Verify rule exists and belongs to tenant
    const [existingRule] = await db
      .select()
      .from(billingRules)
      .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
      .limit(1);

    if (!existingRule) {
      return res.status(404).json({ error: 'Billing rule not found' });
    }

    const [updatedRule] = await db
      .update(billingRules)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
      .returning();

    res.json(updatedRule);
  } catch (error: any) {
    log.error('Error updating billing rule:', error);
    res.status(500).json({
      error: 'Failed to update billing rule',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/billing/rules/:id
 * Delete billing rule (soft delete by setting status to inactive)
 */
router.delete('/rules/:id', isAuthenticated, requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const ruleId = req.params.id;

    // Verify rule exists
    const [existingRule] = await db
      .select()
      .from(billingRules)
      .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
      .limit(1);

    if (!existingRule) {
      return res.status(404).json({ error: 'Billing rule not found' });
    }

    // Soft delete by setting status to inactive
    const [deletedRule] = await db
      .update(billingRules)
      .set({
        ruleStatus: 'inactive',
        updatedAt: new Date(),
      })
      .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
      .returning();

    res.json({
      message: 'Billing rule deactivated successfully',
      rule: deletedRule,
    });
  } catch (error) {
    log.error('Error deleting billing rule:', error);
    res.status(500).json({ error: 'Failed to delete billing rule' });
  }
});

/**
 * PATCH /api/billing/rules/:id/activate
 * Activate a billing rule
 */
router.patch(
  '/rules/:id/activate',
  isAuthenticated,
  requireTenantContext,
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const ruleId = req.params.id;

      const [updatedRule] = await db
        .update(billingRules)
        .set({
          ruleStatus: 'active',
          updatedAt: new Date(),
        })
        .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
        .returning();

      if (!updatedRule) {
        return res.status(404).json({ error: 'Billing rule not found' });
      }

      res.json(updatedRule);
    } catch (error) {
      log.error('Error activating billing rule:', error);
      res.status(500).json({ error: 'Failed to activate billing rule' });
    }
  },
);

/**
 * PATCH /api/billing/rules/:id/deactivate
 * Deactivate a billing rule
 */
router.patch(
  '/rules/:id/deactivate',
  isAuthenticated,
  requireTenantContext,
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const ruleId = req.params.id;

      const [updatedRule] = await db
        .update(billingRules)
        .set({
          ruleStatus: 'inactive',
          updatedAt: new Date(),
        })
        .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
        .returning();

      if (!updatedRule) {
        return res.status(404).json({ error: 'Billing rule not found' });
      }

      res.json(updatedRule);
    } catch (error) {
      log.error('Error deactivating billing rule:', error);
      res.status(500).json({ error: 'Failed to deactivate billing rule' });
    }
  },
);

// =============================================================================
// ADVANCED ANALYTICS
// =============================================================================

/**
 * GET /api/billing/analytics/revenue-forecast
 * Get revenue forecast for upcoming periods
 */
router.get('/analytics/revenue-forecast', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { periods = 3 } = req.query;

    const forecast = await billingAnalytics.forecastRevenue(tenantId, parseInt(periods as string));

    res.json({
      forecast,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    log.error('Error generating revenue forecast:', error);
    res.status(500).json({
      error: 'Failed to generate revenue forecast',
      message: error.message,
    });
  }
});

/**
 * GET /api/billing/analytics/churn-prediction
 * Get customer churn predictions
 */
router.get('/analytics/churn-prediction', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    const predictions = await billingAnalytics.predictChurn(tenantId);

    res.json({
      predictions,
      summary: {
        total: predictions.length,
        critical: predictions.filter((p) => p.riskLevel === 'critical').length,
        high: predictions.filter((p) => p.riskLevel === 'high').length,
        medium: predictions.filter((p) => p.riskLevel === 'medium').length,
        low: predictions.filter((p) => p.riskLevel === 'low').length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    log.error('Error predicting churn:', error);
    res.status(500).json({
      error: 'Failed to predict churn',
      message: error.message,
    });
  }
});

/**
 * GET /api/billing/analytics/lifetime-value
 * Get customer lifetime value calculations
 */
router.get('/analytics/lifetime-value', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { customerId } = req.query;

    const lifetimeValues = await billingAnalytics.calculateLifetimeValue(
      tenantId,
      customerId as string | undefined,
    );

    res.json({
      customers: lifetimeValues,
      summary: {
        totalCustomers: lifetimeValues.length,
        totalHistoricalValue: lifetimeValues.reduce((sum, c) => sum + c.historicalValue, 0),
        totalPredictedValue: lifetimeValues.reduce((sum, c) => sum + c.predictedLifetimeValue, 0),
        averageLifetimeValue:
          lifetimeValues.length > 0
            ? lifetimeValues.reduce((sum, c) => sum + c.predictedLifetimeValue, 0) /
              lifetimeValues.length
            : 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    log.error('Error calculating lifetime value:', error);
    res.status(500).json({
      error: 'Failed to calculate lifetime value',
      message: error.message,
    });
  }
});

export default router;
