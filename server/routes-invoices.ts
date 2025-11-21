import type { Express } from "express";
import { eq, and, desc, sql, count, gte, lte, sum } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  invoices,
  businessRecords,
  insertInvoiceSchema,
  type Invoice
} from "@shared/schema";

export function registerInvoicesRoutes(app: Express) {
  // Get all invoices
  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { status, fromDate, toDate, customerId } = req.query;
      
      let query = db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          customerId: invoices.customerId,
          customerName: businessRecords.companyName,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          totalAmount: invoices.totalAmount,
          status: invoices.status,
          paymentTerms: invoices.paymentTerms,
          description: invoices.description,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt
        })
        .from(invoices)
        .leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
        .where(eq(invoices.tenantId, tenantId));

      // Apply filters
      if (status) {
        query = query.where(eq(invoices.status, status as string));
      }

      if (customerId) {
        query = query.where(eq(invoices.customerId, customerId as string));
      }

      if (fromDate) {
        query = query.where(gte(invoices.issueDate, new Date(fromDate as string)));
      }

      if (toDate) {
        query = query.where(lte(invoices.issueDate, new Date(toDate as string)));
      }

      const invoicesList = await query.orderBy(desc(invoices.createdAt));
      res.json(invoicesList);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // Get invoice by ID
  app.get("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const invoiceId = req.params.id;

      const [invoice] = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          customerId: invoices.customerId,
          customerName: businessRecords.companyName,
          customerEmail: businessRecords.email,
          customerPhone: businessRecords.phone,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          totalAmount: invoices.totalAmount,
          status: invoices.status,
          paymentTerms: invoices.paymentTerms,
          description: invoices.description,
          notes: invoices.notes,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt
        })
        .from(invoices)
        .leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  // Create new invoice
  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.claims.sub;

      const invoiceData = insertInvoiceSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId,
        invoiceNumber: req.body.invoiceNumber || `INV-${Date.now()}`,
        status: req.body.status || 'draft'
      });

      const [newInvoice] = await db
        .insert(invoices)
        .values(invoiceData)
        .returning();

      res.status(201).json(newInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Update invoice
  app.put("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const invoiceId = req.params.id;

      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
        .returning();

      if (!updatedInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  // Delete invoice
  app.delete("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const invoiceId = req.params.id;

      // Check if invoice can be deleted (only drafts can be deleted)
      const [existingInvoice] = await db
        .select({ status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

      if (!existingInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (existingInvoice.status !== 'draft') {
        return res.status(400).json({ error: "Only draft invoices can be deleted" });
      }

      const [deletedInvoice] = await db
        .delete(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
        .returning();

      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // Mark invoice as sent
  app.patch("/api/invoices/:id/send", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const invoiceId = req.params.id;

      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          status: 'sent',
          updatedAt: new Date()
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
        .returning();

      if (!updatedInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error sending invoice:", error);
      res.status(500).json({ error: "Failed to send invoice" });
    }
  });

  // Mark invoice as paid
  app.patch("/api/invoices/:id/paid", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const invoiceId = req.params.id;
      const { paymentDate, paymentMethod, paymentNotes } = req.body;

      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          status: 'paid',
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod: paymentMethod || 'unknown',
          paymentNotes: paymentNotes || '',
          updatedAt: new Date()
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
        .returning();

      if (!updatedInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({ error: "Failed to mark invoice as paid" });
    }
  });

  // Get invoices dashboard stats
  app.get("/api/invoices/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const totalInvoicesResult = await db
        .select({ count: count() })
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId));

      const paidInvoicesResult = await db
        .select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`
        })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'paid')));

      const pendingInvoicesResult = await db
        .select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`
        })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'sent')));

      const overdueInvoicesResult = await db
        .select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.status, 'sent'),
            sql`${invoices.dueDate} < CURRENT_DATE`
          )
        );

      const totalInvoices = totalInvoicesResult[0]?.count || 0;
      const paidInvoices = paidInvoicesResult[0]?.count || 0;
      const paidValue = paidInvoicesResult[0]?.totalValue || 0;
      const pendingInvoices = pendingInvoicesResult[0]?.count || 0;
      const pendingValue = pendingInvoicesResult[0]?.totalValue || 0;
      const overdueInvoices = overdueInvoicesResult[0]?.count || 0;
      const overdueValue = overdueInvoicesResult[0]?.totalValue || 0;

      res.json({
        totalInvoices,
        paidInvoices,
        paidValue,
        pendingInvoices,
        pendingValue,
        overdueInvoices,
        overdueValue,
        paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0
      });
    } catch (error) {
      console.error("Error fetching invoices dashboard:", error);
      res.status(500).json({ error: "Failed to fetch invoices dashboard" });
    }
  });

  // Get invoices by status
  app.get("/api/invoices/by-status", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const invoicesByStatus = await db
        .select({
          status: invoices.status,
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`
        })
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId))
        .groupBy(invoices.status);

      res.json(invoicesByStatus);
    } catch (error) {
      console.error("Error fetching invoices by status:", error);
      res.status(500).json({ error: "Failed to fetch invoices by status" });
    }
  });

  // Get revenue by month
  app.get("/api/invoices/revenue-by-month", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { year = new Date().getFullYear() } = req.query;

      const revenueByMonth = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${invoices.paymentDate})`,
          revenue: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
          invoiceCount: count()
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.status, 'paid'),
            sql`EXTRACT(YEAR FROM ${invoices.paymentDate}) = ${year}`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${invoices.paymentDate})`)
        .orderBy(sql`EXTRACT(MONTH FROM ${invoices.paymentDate})`);

      res.json(revenueByMonth);
    } catch (error) {
      console.error("Error fetching revenue by month:", error);
      res.status(500).json({ error: "Failed to fetch revenue by month" });
    }
  });
}