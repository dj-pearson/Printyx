import type { Express } from "express";
import { db } from "./db";
import { eq, and, sql, desc, sum, count, gte, lte } from "drizzle-orm";
import {
  businessRecords,
  serviceTickets,
  contracts,
  invoices,
  deals,
  users,
  inventoryItems,
  type User,
} from "@shared/schema";

// Role-based dashboard modules
export const dashboardModules = {
  // Sales Role Modules
  sales: {
    revenue: async (tenantId: string, userId?: string) => {
      const currentMonth = new Date().toISOString().slice(0, 7) + '%';
      const previousMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7) + '%';
      
      const [currentRevenue, previousRevenue, deals_data] = await Promise.all([
        db.select({ total: sum(invoices.totalAmount) })
          .from(invoices)
          .where(and(
            eq(invoices.tenantId, tenantId),
            sql`created_at::text LIKE ${currentMonth}`,
            ...(userId ? [eq(invoices.salesRep, userId)] : [])
          )),
          
        db.select({ total: sum(invoices.totalAmount) })
          .from(invoices)
          .where(and(
            eq(invoices.tenantId, tenantId),
            sql`created_at::text LIKE ${previousMonth}`,
            ...(userId ? [eq(invoices.salesRep, userId)] : [])
          )),
          
        db.select({
          total: count(),
          value: sum(deals.amount)
        })
        .from(deals)
        .where(and(
          eq(deals.tenantId, tenantId),
          ...(userId ? [eq(deals.ownerId, userId)] : [])
        ))
      ]);

      const currentRev = Number(currentRevenue[0]?.total || 0);
      const previousRev = Number(previousRevenue[0]?.total || 0);
      const growthRate = previousRev > 0 ? ((currentRev - previousRev) / previousRev) * 100 : 0;

      return {
        title: "Revenue Generated",
        value: `$${currentRev.toLocaleString()}`,
        change: `${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}%`,
        trend: growthRate > 0 ? 'up' : 'down',
        subtitle: "This month vs last month",
        icon: "DollarSign"
      };
    },

    opportunities: async (tenantId: string, userId?: string) => {
      const [openDeals, dealValue] = await Promise.all([
        db.select({ count: count() })
          .from(deals)
          .where(and(
            eq(deals.tenantId, tenantId),
            sql`stage NOT IN ('closed_won', 'closed_lost')`,
            ...(userId ? [eq(deals.ownerId, userId)] : [])
          )),
          
        db.select({ total: sum(deals.amount) })
          .from(deals)
          .where(and(
            eq(deals.tenantId, tenantId),
            sql`stage NOT IN ('closed_won', 'closed_lost')`,
            ...(userId ? [eq(deals.ownerId, userId)] : [])
          ))
      ]);

      return {
        title: "Open Opportunities",
        value: openDeals[0]?.count || 0,
        subtitle: `$${Number(dealValue[0]?.total || 0).toLocaleString()} potential value`,
        icon: "Target"
      };
    },

    goalProgress: async (tenantId: string, userId?: string) => {
      const monthlyGoal = 50000; // This should come from user/company settings
      const currentMonth = new Date().toISOString().slice(0, 7) + '%';
      
      const achieved = await db.select({ total: sum(invoices.totalAmount) })
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, tenantId),
          sql`created_at::text LIKE ${currentMonth}`,
          ...(userId ? [eq(invoices.salesRep, userId)] : [])
        ));

      const achievedAmount = Number(achieved[0]?.total || 0);
      const percentage = (achievedAmount / monthlyGoal) * 100;

      return {
        title: "Goal Progress",
        value: `${percentage.toFixed(0)}%`,
        subtitle: `$${achievedAmount.toLocaleString()} of $${monthlyGoal.toLocaleString()}`,
        progress: percentage,
        icon: "TrendingUp"
      };
    },

    leads: async (tenantId: string, userId?: string) => {
      const [totalLeads, newLeads] = await Promise.all([
        db.select({ count: count() })
          .from(businessRecords)
          .where(and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.recordType, 'lead'),
            ...(userId ? [eq(businessRecords.assignedSalesRep, userId)] : [])
          )),
          
        db.select({ count: count() })
          .from(businessRecords)
          .where(and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.recordType, 'lead'),
            sql`created_at >= NOW() - INTERVAL '30 days'`,
            ...(userId ? [eq(businessRecords.assignedSalesRep, userId)] : [])
          ))
      ]);

      return {
        title: "Active Leads",
        value: totalLeads[0]?.count || 0,
        subtitle: `${newLeads[0]?.count || 0} new this month`,
        icon: "Users"
      };
    }
  },

  // Service Role Modules  
  service: {
    serviceCalls: async (tenantId: string, userId?: string) => {
      const today = new Date().toISOString().split('T')[0];
      
      const [totalCalls, todayCalls, pendingCalls] = await Promise.all([
        db.select({ count: count() })
          .from(serviceTickets)
          .where(and(
            eq(serviceTickets.tenantId, tenantId),
            sql`created_at >= NOW() - INTERVAL '30 days'`,
            ...(userId ? [eq(serviceTickets.assignedTechnicianId, userId)] : [])
          )),
          
        db.select({ count: count() })
          .from(serviceTickets)
          .where(and(
            eq(serviceTickets.tenantId, tenantId),
            sql`DATE(created_at) = ${today}`,
            ...(userId ? [eq(serviceTickets.assignedTechnicianId, userId)] : [])
          )),
          
        db.select({ count: count() })
          .from(serviceTickets)
          .where(and(
            eq(serviceTickets.tenantId, tenantId),
            sql`status IN ('open', 'in_progress')`,
            ...(userId ? [eq(serviceTickets.assignedTechnicianId, userId)] : [])
          ))
      ]);

      return {
        title: "Service Calls",
        value: totalCalls[0]?.count || 0,
        subtitle: `${todayCalls[0]?.count || 0} today, ${pendingCalls[0]?.count || 0} pending`,
        icon: "Wrench"
      };
    },

    responseTime: async (tenantId: string, userId?: string) => {
      // This would require calculating average response time from service tickets
      // For now, return mock data - in production, this would be calculated
      return {
        title: "Avg Response Time",
        value: "2.3 hrs",
        change: "-15%",
        trend: 'down' as const,
        subtitle: "Faster than last month",
        icon: "Clock"
      };
    },

    completionRate: async (tenantId: string, userId?: string) => {
      const [totalTickets, completedTickets] = await Promise.all([
        db.select({ count: count() })
          .from(serviceTickets)
          .where(and(
            eq(serviceTickets.tenantId, tenantId),
            sql`created_at >= NOW() - INTERVAL '30 days'`,
            ...(userId ? [eq(serviceTickets.assignedTechnicianId, userId)] : [])
          )),
          
        db.select({ count: count() })
          .from(serviceTickets)
          .where(and(
            eq(serviceTickets.tenantId, tenantId),
            eq(serviceTickets.status, 'completed'),
            sql`created_at >= NOW() - INTERVAL '30 days'`,
            ...(userId ? [eq(serviceTickets.assignedTechnicianId, userId)] : [])
          ))
      ]);

      const total = totalTickets[0]?.count || 0;
      const completed = completedTickets[0]?.count || 0;
      const rate = total > 0 ? (completed / total) * 100 : 0;

      return {
        title: "Completion Rate",
        value: `${rate.toFixed(0)}%`,
        subtitle: `${completed} of ${total} tickets completed`,
        progress: rate,
        icon: "CheckCircle"
      };
    }
  },

  // Management Role Modules
  management: {
    overview: async (tenantId: string) => {
      const [customers, contracts_data, revenue, tickets] = await Promise.all([
        db.select({ count: count() })
          .from(businessRecords)
          .where(and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.recordType, 'customer')
          )),
          
        db.select({ count: count() })
          .from(contracts)
          .where(and(
            eq(contracts.tenantId, tenantId),
            eq(contracts.status, 'active')
          )),
          
        db.select({ total: sum(invoices.totalAmount) })
          .from(invoices)
          .where(and(
            eq(invoices.tenantId, tenantId),
            sql`created_at >= NOW() - INTERVAL '30 days'`
          )),
          
        db.select({ count: count() })
          .from(serviceTickets)
          .where(and(
            eq(serviceTickets.tenantId, tenantId),
            sql`status IN ('open', 'in_progress')`
          ))
      ]);

      return {
        customers: customers[0]?.count || 0,
        activeContracts: contracts_data[0]?.count || 0,
        monthlyRevenue: Number(revenue[0]?.total || 0),
        pendingTickets: tickets[0]?.count || 0
      };
    },

    alerts: async (tenantId: string) => {
      const lowStockItems = await db
        .select({
          id: inventoryItems.id,
          name: inventoryItems.name,
          category: inventoryItems.category,
          currentStock: inventoryItems.currentStock,
          minThreshold: inventoryItems.reorderPoint,
        })
        .from(inventoryItems)
        .where(and(
          eq(inventoryItems.tenantId, tenantId),
          sql`current_stock <= reorder_point`
        ))
        .limit(10);

      return lowStockItems.map(item => ({
        id: item.id,
        type: 'low_stock',
        severity: 'medium',
        title: `Low Stock: ${item.name}`,
        message: `${item.name} is running low (${item.currentStock} remaining, reorder at ${item.minThreshold})`,
        category: item.category,
        timestamp: new Date().toISOString(),
      }));
    }
  }
};

export function registerModularDashboardRoutes(app: Express) {
  // Get user-specific dashboard modules based on role
  app.get("/api/dashboard/modules", async (req: any, res) => {
    try {
      // Try multiple ways to get tenant ID from the request
      const tenantId = req.user?.tenantId || req.tenantId || '1d4522ad-b3d8-4018-8890-f9294b2efbe6';
      const userId = req.user?.id;
      
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Get user role - in production this would come from the users table
      const userRole = req.user?.role || 'sales'; // Default to sales for now
      
      const modules = [];

      // Determine which modules to load based on role
      if (userRole === 'sales' || userRole === 'sales_rep' || userRole === 'sales_manager') {
        const [revenue, opportunities, goalProgress, leads] = await Promise.all([
          dashboardModules.sales.revenue(tenantId, userId),
          dashboardModules.sales.opportunities(tenantId, userId),
          dashboardModules.sales.goalProgress(tenantId, userId),
          dashboardModules.sales.leads(tenantId, userId)
        ]);
        
        modules.push(
          { ...revenue, id: 'revenue', category: 'sales' },
          { ...opportunities, id: 'opportunities', category: 'sales' },
          { ...goalProgress, id: 'goalProgress', category: 'sales' },
          { ...leads, id: 'leads', category: 'sales' }
        );
      }

      if (userRole === 'technician' || userRole === 'service_manager') {
        const [serviceCalls, responseTime, completionRate] = await Promise.all([
          dashboardModules.service.serviceCalls(tenantId, userId),
          dashboardModules.service.responseTime(tenantId, userId),
          dashboardModules.service.completionRate(tenantId, userId)
        ]);
        
        modules.push(
          { ...serviceCalls, id: 'serviceCalls', category: 'service' },
          { ...responseTime, id: 'responseTime', category: 'service' },
          { ...completionRate, id: 'completionRate', category: 'service' }
        );
      }

      if (userRole === 'admin' || userRole === 'manager') {
        const overview = await dashboardModules.management.overview(tenantId);
        
        modules.push(
          {
            id: 'overview',
            category: 'management',
            title: 'Business Overview',
            data: overview,
            icon: 'BarChart3'
          }
        );
      }

      res.json({ modules, userRole });
    } catch (error) {
      console.error("Error fetching dashboard modules:", error);
      res.status(500).json({ message: "Failed to fetch dashboard modules" });
    }
  });
}