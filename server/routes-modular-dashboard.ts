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

// Role-based card permissions and availability
const roleCardConfig = {
  sales: {
    defaultCards: ['personal_revenue', 'personal_deals', 'personal_leads'],
    availableCards: ['team_revenue', 'company_customers', 'inventory_alerts', 'service_overview']
  },
  sales_rep: {
    defaultCards: ['personal_revenue', 'personal_deals', 'personal_leads'],  
    availableCards: ['team_revenue', 'company_customers', 'inventory_alerts']
  },
  technician: {
    defaultCards: ['personal_tickets', 'response_time', 'completion_rate'],
    availableCards: ['team_tickets', 'company_customers', 'inventory_alerts', 'revenue_overview']
  },
  service_manager: {
    defaultCards: ['team_tickets', 'response_time', 'completion_rate', 'technician_performance'],
    availableCards: ['company_revenue', 'company_customers', 'inventory_alerts']
  },
  manager: {
    defaultCards: ['business_overview', 'revenue_summary', 'customer_summary', 'service_summary'],
    availableCards: [] // Managers get all cards by default
  },
  admin: {
    defaultCards: ['business_overview', 'revenue_summary', 'customer_summary', 'service_summary'],
    availableCards: [] // Admins get all cards by default
  }
};

export function registerModularDashboardRoutes(app: Express) {
  // Get available card configurations for a role
  app.get("/api/dashboard/card-config", async (req: any, res) => {
    try {
      const userRole = req.user?.role || 'sales';
      const config = roleCardConfig[userRole] || roleCardConfig.sales;
      
      res.json({
        role: userRole,
        defaultCards: config.defaultCards,
        availableCards: config.availableCards,
        allCards: [...config.defaultCards, ...config.availableCards]
      });
    } catch (error) {
      console.error("Error fetching card config:", error);
      res.status(500).json({ message: "Failed to fetch card configuration" });
    }
  });

  // Get user-specific dashboard modules based on role and enabled cards
  app.get("/api/dashboard/modules", async (req: any, res) => {
    try {
      // Try multiple ways to get tenant ID from the request
      const tenantId = req.user?.tenantId || req.tenantId || '1d4522ad-b3d8-4018-8890-f9294b2efbe6';
      const userId = req.user?.id;
      
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Get user role and enabled cards from query params
      const userRole = req.user?.role || 'sales';
      const enabledCards = req.query.enabled ? req.query.enabled.split(',') : [];
      
      // Get role configuration
      const roleConfig = roleCardConfig[userRole] || roleCardConfig.sales;
      const activeCards = [...roleConfig.defaultCards, ...enabledCards.filter(card => 
        roleConfig.availableCards.includes(card)
      )];
      
      const modules = [];

      try {
        const currentMonth = new Date().toISOString().slice(0, 7) + '%';
        
        // Personal Revenue (for sales roles)
        if (activeCards.includes('personal_revenue')) {
          const revenueResult = await db.select({ total: sum(invoices.totalAmount) })
            .from(invoices)
            .where(and(
              eq(invoices.tenantId, tenantId),
              sql`created_at::text LIKE ${currentMonth}`
            ));

          modules.push({
            id: 'personal_revenue',
            category: 'sales',
            title: 'Monthly Revenue',
            value: `$${Number(revenueResult[0]?.total || 0).toLocaleString()}`,
            subtitle: 'This month',
            icon: 'DollarSign',
            cardType: 'personal'
          });
        }

        // Personal Deals (for sales roles)
        if (activeCards.includes('personal_deals')) {
          const dealsResult = await db.select({ count: count() })
            .from(deals)
            .where(eq(deals.tenantId, tenantId));

          modules.push({
            id: 'personal_deals',
            category: 'sales', 
            title: 'My Deals',
            value: dealsResult[0]?.count || 0,
            subtitle: 'Active opportunities',
            icon: 'Target',
            cardType: 'personal'
          });
        }

        // Personal Leads (for sales roles)
        if (activeCards.includes('personal_leads')) {
          const leadsResult = await db.select({ count: count() })
            .from(businessRecords)
            .where(and(
              eq(businessRecords.tenantId, tenantId),
              eq(businessRecords.recordType, 'lead')
            ));

          modules.push({
            id: 'personal_leads',
            category: 'sales',
            title: 'My Leads',
            value: leadsResult[0]?.count || 0,
            subtitle: 'New prospects',
            icon: 'Users',
            cardType: 'personal'
          });
        }

        // Personal Service Tickets (for technicians)
        if (activeCards.includes('personal_tickets')) {
          const ticketsResult = await db.select({ count: count() })
            .from(serviceTickets)
            .where(eq(serviceTickets.tenantId, tenantId));

          modules.push({
            id: 'personal_tickets',
            category: 'service',
            title: 'My Tickets',
            value: ticketsResult[0]?.count || 0,
            subtitle: 'Assigned to me',
            icon: 'Wrench',
            cardType: 'personal'
          });
        }

        // Team Revenue (optional for sales)
        if (activeCards.includes('team_revenue')) {
          const teamRevenueResult = await db.select({ total: sum(invoices.totalAmount) })
            .from(invoices)
            .where(and(
              eq(invoices.tenantId, tenantId),
              sql`created_at::text LIKE ${currentMonth}`
            ));

          modules.push({
            id: 'team_revenue',
            category: 'sales',
            title: 'Team Revenue',
            value: `$${Number(teamRevenueResult[0]?.total || 0).toLocaleString()}`,
            subtitle: 'This month - all team',
            icon: 'DollarSign',
            cardType: 'team',
            enabled: enabledCards.includes('team_revenue')
          });
        }

        // Company Customers (optional for lower roles)
        if (activeCards.includes('company_customers')) {
          const customersResult = await db.select({ count: count() })
            .from(businessRecords)
            .where(and(
              eq(businessRecords.tenantId, tenantId),
              eq(businessRecords.recordType, 'customer')
            ));

          modules.push({
            id: 'company_customers',
            category: 'management',
            title: 'Total Customers',
            value: customersResult[0]?.count || 0,
            subtitle: 'Company-wide',
            icon: 'Users',
            cardType: 'company',
            enabled: enabledCards.includes('company_customers')
          });
        }

        // Inventory Alerts (optional for operational roles)
        if (activeCards.includes('inventory_alerts')) {
          const lowStockResult = await db.select({ count: count() })
            .from(inventoryItems)
            .where(and(
              eq(inventoryItems.tenantId, tenantId),
              sql`current_stock <= reorder_point`
            ));

          modules.push({
            id: 'inventory_alerts',
            category: 'operations',
            title: 'Low Stock Items',
            value: lowStockResult[0]?.count || 0,
            subtitle: 'Need reordering',
            icon: 'AlertCircle',
            cardType: 'operational',
            enabled: enabledCards.includes('inventory_alerts')
          });
        }

        // Service Overview (optional for sales and other roles)
        if (activeCards.includes('service_overview')) {
          const [totalTickets, openTickets] = await Promise.all([
            db.select({ count: count() })
              .from(serviceTickets)
              .where(eq(serviceTickets.tenantId, tenantId)),
              
            db.select({ count: count() })
              .from(serviceTickets)
              .where(and(
                eq(serviceTickets.tenantId, tenantId),
                sql`status IN ('open', 'in_progress')`
              ))
          ]);

          modules.push({
            id: 'service_overview',
            category: 'service',
            title: 'Service Overview',
            value: openTickets[0]?.count || 0,
            subtitle: `${totalTickets[0]?.count || 0} total tickets`,
            icon: 'Wrench',
            cardType: 'departmental',
            enabled: enabledCards.includes('service_overview')
          });
        }

        // Revenue Overview (for technicians and other roles)
        if (activeCards.includes('revenue_overview')) {
          const revenueResult = await db.select({ total: sum(invoices.totalAmount) })
            .from(invoices)
            .where(and(
              eq(invoices.tenantId, tenantId),
              sql`created_at::text LIKE ${currentMonth}`
            ));

          modules.push({
            id: 'revenue_overview',
            category: 'management',
            title: 'Company Revenue',
            value: `$${Number(revenueResult[0]?.total || 0).toLocaleString()}`,
            subtitle: 'This month',
            icon: 'DollarSign',
            cardType: 'company',
            enabled: enabledCards.includes('revenue_overview')
          });
        }

        // Business Overview for Management
        if (activeCards.includes('business_overview')) {
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

          modules.push({
            id: 'business_overview',
            category: 'management',
            title: 'Business Overview',
            data: {
              customers: customers[0]?.count || 0,
              activeContracts: contracts_data[0]?.count || 0,
              monthlyRevenue: Number(revenue[0]?.total || 0),
              pendingTickets: tickets[0]?.count || 0
            },
            icon: 'BarChart3',
            cardType: 'executive'
          });
        }

      } catch (queryError) {
        console.error("Error in individual queries:", queryError);
        // If queries fail, provide fallback modules
        modules.push({
          id: 'fallback',
          category: 'sales',
          title: 'Dashboard Loading...',
          value: '---',
          subtitle: 'Data loading in progress',
          icon: 'BarChart3'
        });
      }

      res.json({ 
        modules, 
        userRole,
        roleConfig: {
          defaultCards: roleConfig.defaultCards,
          availableCards: roleConfig.availableCards,
          activeCards
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard modules:", error);
      res.status(500).json({ message: "Failed to fetch dashboard modules" });
    }
  });
}