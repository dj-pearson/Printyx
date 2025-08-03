import type { Express } from "express";
import { db } from "./db";
import { 
  commissionStructures,
  salesRepresentatives,
  commissionTransactions,
  commissionPayments,
  commissionDisputes,
  commissionSummary,
  users,
  businessRecords,
  insertCommissionStructureSchema,
  insertSalesRepresentativeSchema,
  insertCommissionTransactionSchema,
  insertCommissionPaymentSchema,
  insertCommissionDisputeSchema,
  type CommissionStructure,
  type SalesRepresentative,
  type CommissionTransaction,
  type CommissionPayment,
  type CommissionDispute,
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql, count, sum } from "drizzle-orm";
import { isAuthenticated } from "./replitAuth";

export function registerCommissionRoutes(app: Express) {
  
  // ================ COMMISSION METRICS ================
  app.get("/api/commission/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      // Calculate commission metrics
      const [
        totalCommissions,
        pendingPayments,
        activeReps,
        openDisputes,
        monthlyTransactions,
        averageCommissionRate
      ] = await Promise.all([
        // Total commissions this month
        db
          .select({ total: sum(commissionTransactions.commissionAmount) })
          .from(commissionTransactions)
          .where(and(
            eq(commissionTransactions.tenantId, tenantId),
            eq(commissionTransactions.commissionPeriod, currentMonth)
          )),
        
        // Pending payments
        db
          .select({ total: sum(commissionPayments.totalAmount) })
          .from(commissionPayments)
          .where(and(
            eq(commissionPayments.tenantId, tenantId),
            eq(commissionPayments.status, "pending")
          )),
        
        // Active sales reps
        db
          .select({ count: count() })
          .from(salesRepresentatives)
          .where(and(
            eq(salesRepresentatives.tenantId, tenantId),
            eq(salesRepresentatives.isActive, true)
          )),
        
        // Open disputes
        db
          .select({ count: count() })
          .from(commissionDisputes)
          .where(and(
            eq(commissionDisputes.tenantId, tenantId),
            eq(commissionDisputes.status, "open")
          )),
        
        // Monthly transaction count
        db
          .select({ count: count() })
          .from(commissionTransactions)
          .where(and(
            eq(commissionTransactions.tenantId, tenantId),
            eq(commissionTransactions.commissionPeriod, currentMonth)
          )),
        
        // Average commission rate
        db
          .select({ avg: sql<number>`avg(${commissionTransactions.commissionRate})` })
          .from(commissionTransactions)
          .where(and(
            eq(commissionTransactions.tenantId, tenantId),
            eq(commissionTransactions.commissionPeriod, currentMonth)
          ))
      ]);

      res.json({
        totalCommissions: totalCommissions[0]?.total || "0",
        pendingPayments: pendingPayments[0]?.total || "0",
        activeReps: activeReps[0]?.count || 0,
        openDisputes: openDisputes[0]?.count || 0,
        monthlyTransactions: monthlyTransactions[0]?.count || 0,
        averageCommissionRate: averageCommissionRate[0]?.avg || 0,
        period: currentMonth
      });
    } catch (error) {
      console.error("Error fetching commission metrics:", error);
      res.status(500).json({ error: "Failed to fetch commission metrics" });
    }
  });

  // ================ COMMISSION STRUCTURES ================
  app.get("/api/commission/structures", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const structures = await db
        .select({
          id: commissionStructures.id,
          structureName: commissionStructures.structureName,
          structureType: commissionStructures.structureType,
          description: commissionStructures.description,
          basePercentage: commissionStructures.basePercentage,
          minimumAmount: commissionStructures.minimumAmount,
          maximumAmount: commissionStructures.maximumAmount,
          tierStructure: commissionStructures.tierStructure,
          applicableProducts: commissionStructures.applicableProducts,
          applicableServices: commissionStructures.applicableServices,
          effectiveDate: commissionStructures.effectiveDate,
          expirationDate: commissionStructures.expirationDate,
          isActive: commissionStructures.isActive,
          autoCalculate: commissionStructures.autoCalculate,
          requiresApproval: commissionStructures.requiresApproval,
          createdBy: commissionStructures.createdBy,
          createdAt: commissionStructures.createdAt,
        })
        .from(commissionStructures)
        .where(eq(commissionStructures.tenantId, tenantId))
        .orderBy(desc(commissionStructures.createdAt));

      res.json(structures);
    } catch (error) {
      console.error("Error fetching commission structures:", error);
      res.status(500).json({ error: "Failed to fetch commission structures" });
    }
  });

  app.post("/api/commission/structures", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const structureData = insertCommissionStructureSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId,
      });

      const [structure] = await db
        .insert(commissionStructures)
        .values(structureData)
        .returning();

      res.status(201).json(structure);
    } catch (error) {
      console.error("Error creating commission structure:", error);
      res.status(500).json({ error: "Failed to create commission structure" });
    }
  });

  // ================ SALES REPRESENTATIVES ================
  app.get("/api/commission/sales-reps", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const salesReps = await db
        .select({
          id: salesRepresentatives.id,
          userId: salesRepresentatives.userId,
          repName: salesRepresentatives.repName,
          employeeId: salesRepresentatives.employeeId,
          territory: salesRepresentatives.territory,
          primaryCommissionStructureId: salesRepresentatives.primaryCommissionStructureId,
          overrideCommissionStructureId: salesRepresentatives.overrideCommissionStructureId,
          managerId: salesRepresentatives.managerId,
          teamId: salesRepresentatives.teamId,
          quotaAmount: salesRepresentatives.quotaAmount,
          quotaPeriod: salesRepresentatives.quotaPeriod,
          commissionRate: salesRepresentatives.commissionRate,
          splitPercentage: salesRepresentatives.splitPercentage,
          isActive: salesRepresentatives.isActive,
          hireDate: salesRepresentatives.hireDate,
          terminationDate: salesRepresentatives.terminationDate,
          createdAt: salesRepresentatives.createdAt,
          // Join user details
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          // Join manager details
          managerName: sql<string>`CONCAT(manager.first_name, ' ', manager.last_name)`,
        })
        .from(salesRepresentatives)
        .leftJoin(users, eq(salesRepresentatives.userId, users.id))
        .leftJoin(users.as("manager"), eq(salesRepresentatives.managerId, users.as("manager").id))
        .where(eq(salesRepresentatives.tenantId, tenantId))
        .orderBy(salesRepresentatives.repName);

      res.json(salesReps);
    } catch (error) {
      console.error("Error fetching sales representatives:", error);
      res.status(500).json({ error: "Failed to fetch sales representatives" });
    }
  });

  app.post("/api/commission/sales-reps", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const salesRepData = insertSalesRepresentativeSchema.parse({
        ...req.body,
        tenantId,
      });

      const [salesRep] = await db
        .insert(salesRepresentatives)
        .values(salesRepData)
        .returning();

      res.status(201).json(salesRep);
    } catch (error) {
      console.error("Error creating sales representative:", error);
      res.status(500).json({ error: "Failed to create sales representative" });
    }
  });

  // ================ COMMISSION TRANSACTIONS ================
  app.get("/api/commission/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { period, status } = req.query;
      
      let whereConditions = [eq(commissionTransactions.tenantId, tenantId)];
      
      if (period && period !== "all") {
        whereConditions.push(eq(commissionTransactions.commissionPeriod, period as string));
      }
      
      if (status && status !== "all") {
        whereConditions.push(eq(commissionTransactions.status, status as string));
      }
      
      const transactions = await db
        .select({
          id: commissionTransactions.id,
          transactionNumber: commissionTransactions.transactionNumber,
          transactionType: commissionTransactions.transactionType,
          salesRepId: commissionTransactions.salesRepId,
          customerId: commissionTransactions.customerId,
          orderId: commissionTransactions.orderId,
          invoiceId: commissionTransactions.invoiceId,
          contractId: commissionTransactions.contractId,
          saleAmount: commissionTransactions.saleAmount,
          commissionAmount: commissionTransactions.commissionAmount,
          commissionRate: commissionTransactions.commissionRate,
          commissionStructureId: commissionTransactions.commissionStructureId,
          calculationMethod: commissionTransactions.calculationMethod,
          tierLevel: commissionTransactions.tierLevel,
          transactionDate: commissionTransactions.transactionDate,
          commissionPeriod: commissionTransactions.commissionPeriod,
          status: commissionTransactions.status,
          approvedBy: commissionTransactions.approvedBy,
          approvedDate: commissionTransactions.approvedDate,
          isSplitCommission: commissionTransactions.isSplitCommission,
          splitPercentage: commissionTransactions.splitPercentage,
          parentTransactionId: commissionTransactions.parentTransactionId,
          isAdjustment: commissionTransactions.isAdjustment,
          adjustmentReason: commissionTransactions.adjustmentReason,
          originalTransactionId: commissionTransactions.originalTransactionId,
          createdBy: commissionTransactions.createdBy,
          createdAt: commissionTransactions.createdAt,
          // Join sales rep name
          salesRepName: salesRepresentatives.repName,
          // Join customer name
          customerName: businessRecords.companyName,
        })
        .from(commissionTransactions)
        .leftJoin(salesRepresentatives, eq(commissionTransactions.salesRepId, salesRepresentatives.id))
        .leftJoin(businessRecords, eq(commissionTransactions.customerId, businessRecords.id))
        .where(and(...whereConditions))
        .orderBy(desc(commissionTransactions.transactionDate));

      res.json(transactions);
    } catch (error) {
      console.error("Error fetching commission transactions:", error);
      res.status(500).json({ error: "Failed to fetch commission transactions" });
    }
  });

  app.post("/api/commission/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      // Generate transaction number
      const transactionNumber = `COMM-${Date.now()}`;
      
      const transactionData = insertCommissionTransactionSchema.parse({
        ...req.body,
        tenantId,
        transactionNumber,
        createdBy: userId,
      });

      const [transaction] = await db
        .insert(commissionTransactions)
        .values(transactionData)
        .returning();

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating commission transaction:", error);
      res.status(500).json({ error: "Failed to create commission transaction" });
    }
  });

  // ================ COMMISSION PAYMENTS ================
  app.get("/api/commission/payments", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { period } = req.query;
      
      let whereConditions = [eq(commissionPayments.tenantId, tenantId)];
      
      if (period && period !== "all") {
        whereConditions.push(eq(commissionPayments.commissionPeriod, period as string));
      }
      
      const payments = await db
        .select({
          id: commissionPayments.id,
          paymentNumber: commissionPayments.paymentNumber,
          salesRepId: commissionPayments.salesRepId,
          totalAmount: commissionPayments.totalAmount,
          commissionPeriod: commissionPayments.commissionPeriod,
          paymentDate: commissionPayments.paymentDate,
          paymentMethod: commissionPayments.paymentMethod,
          status: commissionPayments.status,
          transactionIds: commissionPayments.transactionIds,
          transactionCount: commissionPayments.transactionCount,
          grossAmount: commissionPayments.grossAmount,
          deductions: commissionPayments.deductions,
          adjustments: commissionPayments.adjustments,
          netAmount: commissionPayments.netAmount,
          processedBy: commissionPayments.processedBy,
          processedDate: commissionPayments.processedDate,
          notes: commissionPayments.notes,
          createdAt: commissionPayments.createdAt,
          // Join sales rep name
          salesRepName: salesRepresentatives.repName,
        })
        .from(commissionPayments)
        .leftJoin(salesRepresentatives, eq(commissionPayments.salesRepId, salesRepresentatives.id))
        .where(and(...whereConditions))
        .orderBy(desc(commissionPayments.createdAt));

      res.json(payments);
    } catch (error) {
      console.error("Error fetching commission payments:", error);
      res.status(500).json({ error: "Failed to fetch commission payments" });
    }
  });

  app.post("/api/commission/payments", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Generate payment number
      const paymentNumber = `PAY-${Date.now()}`;
      
      const paymentData = insertCommissionPaymentSchema.parse({
        ...req.body,
        tenantId,
        paymentNumber,
      });

      const [payment] = await db
        .insert(commissionPayments)
        .values(paymentData)
        .returning();

      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating commission payment:", error);
      res.status(500).json({ error: "Failed to create commission payment" });
    }
  });

  // ================ COMMISSION DISPUTES ================
  app.get("/api/commission/disputes", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const disputes = await db
        .select({
          id: commissionDisputes.id,
          disputeNumber: commissionDisputes.disputeNumber,
          disputeType: commissionDisputes.disputeType,
          salesRepId: commissionDisputes.salesRepId,
          salesRepName: commissionDisputes.salesRepName,
          commissionTransactionId: commissionDisputes.commissionTransactionId,
          disputeAmount: commissionDisputes.disputeAmount,
          disputeDescription: commissionDisputes.disputeDescription,
          priority: commissionDisputes.priority,
          status: commissionDisputes.status,
          resolutionAmount: commissionDisputes.resolutionAmount,
          resolutionDescription: commissionDisputes.resolutionDescription,
          resolvedBy: commissionDisputes.resolvedBy,
          resolvedDate: commissionDisputes.resolvedDate,
          submittedDate: commissionDisputes.submittedDate,
          createdAt: commissionDisputes.createdAt,
        })
        .from(commissionDisputes)
        .where(eq(commissionDisputes.tenantId, tenantId))
        .orderBy(desc(commissionDisputes.createdAt));

      res.json(disputes);
    } catch (error) {
      console.error("Error fetching commission disputes:", error);
      res.status(500).json({ error: "Failed to fetch commission disputes" });
    }
  });

  app.post("/api/commission/disputes", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { 
        dispute_type, 
        sales_rep_id, 
        commission_transaction_id, 
        dispute_amount, 
        dispute_description, 
        priority 
      } = req.body;
      
      // Get sales rep name
      const repQuery = `SELECT rep_name FROM sales_representatives WHERE id = $1 AND tenant_id = $2`;
      const repResult = await db.$client.query(repQuery, [sales_rep_id, tenantId]);
      
      if (repResult.rows.length === 0) {
        return res.status(404).json({ error: "Sales representative not found" });
      }
      
      const sales_rep_name = repResult.rows[0].rep_name;
      const dispute_number = `DISP-${Date.now()}`;
      const submitted_date = new Date().toISOString().split('T')[0];
      
      const query = `
        INSERT INTO commission_disputes (
          tenant_id, dispute_number, dispute_type, sales_rep_id,
          sales_rep_name, commission_transaction_id, dispute_amount,
          dispute_description, priority, submitted_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, dispute_number, dispute_type, sales_rep_id,
        sales_rep_name, commission_transaction_id, dispute_amount,
        dispute_description, priority, submitted_date
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating commission dispute:", error);
      res.status(500).json({ error: "Failed to create commission dispute" });
    }
  });

  // ================ COMMISSION ANALYTICS ================
  app.get("/api/commission/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { period = "current_month" } = req.query;
      
      // Calculate period dates
      const now = new Date();
      let startDate: Date, endDate: Date;
      
      switch (period) {
        case "current_month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case "last_month":
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case "current_quarter":
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          endDate = new Date(now.getFullYear(), quarterStart + 3, 0);
          break;
        case "ytd":
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = now;
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
      
      // Get top performers
      const topPerformers = await db
        .select({
          salesRepId: commissionTransactions.salesRepId,
          salesRepName: salesRepresentatives.repName,
          totalCommissions: sum(commissionTransactions.commissionAmount),
          totalSales: sum(commissionTransactions.saleAmount),
          transactionCount: count(commissionTransactions.id),
          averageCommissionRate: sql<number>`avg(${commissionTransactions.commissionRate})`,
        })
        .from(commissionTransactions)
        .leftJoin(salesRepresentatives, eq(commissionTransactions.salesRepId, salesRepresentatives.id))
        .where(and(
          eq(commissionTransactions.tenantId, tenantId),
          gte(commissionTransactions.transactionDate, startDate),
          lte(commissionTransactions.transactionDate, endDate)
        ))
        .groupBy(commissionTransactions.salesRepId, salesRepresentatives.repName)
        .orderBy(desc(sum(commissionTransactions.commissionAmount)))
        .limit(10);
      
      // Get commission trends (monthly)
      const commissionTrends = await db
        .select({
          period: commissionTransactions.commissionPeriod,
          totalCommissions: sum(commissionTransactions.commissionAmount),
          transactionCount: count(commissionTransactions.id),
        })
        .from(commissionTransactions)
        .where(eq(commissionTransactions.tenantId, tenantId))
        .groupBy(commissionTransactions.commissionPeriod)
        .orderBy(commissionTransactions.commissionPeriod)
        .limit(12);

      res.json({
        topPerformers,
        commissionTrends,
        period,
        startDate,
        endDate,
      });
    } catch (error) {
      console.error("Error fetching commission analytics:", error);
      res.status(500).json({ error: "Failed to fetch commission analytics" });
    }
  });
}