/**
 * Dashboard Core Routes
 *
 * Consolidated dashboard routes extracted from routes.ts monolith.
 *
 * Covers:
 * - GET /api/dashboard/metrics
 * - GET /api/dashboard/recent-tickets
 * - GET /api/dashboard/top-customers
 * - GET /api/dashboard/alerts
 */

import type { Express } from 'express';
import { db } from './db';
import { and, eq, sql, desc, asc } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-dashboards-core');

import {
  businessRecords,
  contracts,
  invoices,
  serviceTickets,
  inventoryItems,
} from '@shared/schema';

export function registerDashboardsCoreRoutes(app: Express) {
  // ─── Dashboard Metrics ─────────────────────────────────────────────

  app.get('/api/dashboard/metrics', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Real dashboard metrics from database
      const [customerCount, contractCount, monthlyRevenue, openTicketCount] = await Promise.all([
        // Total customers count
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(businessRecords)
          .where(
            and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
          ),

        // Active contracts count
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(contracts)
          .where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active'))),

        // Monthly revenue from invoices (current month)
        db
          .select({
            total: sql<number>`coalesce(sum(${invoices.totalAmount}::numeric), 0)::numeric`,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              sql`date_trunc('month', ${invoices.createdAt}) = date_trunc('month', current_date)`,
            ),
          ),

        // Open service tickets count
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(serviceTickets)
          .where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.status, 'open'))),
      ]);

      const metrics = {
        totalCustomers: customerCount[0]?.count || 0,
        activeContracts: contractCount[0]?.count || 0,
        monthlyRevenue: Number(monthlyRevenue[0]?.total || 0),
        openTickets: openTicketCount[0]?.count || 0,
        recentGrowth: 0, // Calculate based on historical data if needed
      };

      res.json(metrics);
    } catch (error) {
      log.error('Error fetching dashboard metrics:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
    }
  });

  // ─── Recent Tickets ────────────────────────────────────────────────

  app.get('/api/dashboard/recent-tickets', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Real recent tickets from database
      const tickets = await db
        .select({
          id: serviceTickets.id,
          title: serviceTickets.title,
          status: serviceTickets.status,
          priority: serviceTickets.priority,
          customer: businessRecords.companyName,
          createdAt: serviceTickets.createdAt,
          description: serviceTickets.description,
        })
        .from(serviceTickets)
        .leftJoin(businessRecords, eq(serviceTickets.customerId, businessRecords.id))
        .where(eq(serviceTickets.tenantId, tenantId))
        .orderBy(desc(serviceTickets.createdAt))
        .limit(10);

      res.json(tickets);
    } catch (error) {
      log.error('Error fetching recent tickets:', error);
      res.status(500).json({ message: 'Failed to fetch recent tickets' });
    }
  });

  // ─── Top Customers ─────────────────────────────────────────────────

  app.get('/api/dashboard/top-customers', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Real top customers from database based on contract values
      const customers = await db
        .select({
          id: businessRecords.id,
          name: businessRecords.companyName,
          accountValue: sql<number>`coalesce(sum(${contracts.monthlyBase}::numeric), 0)::numeric`,
          contractsCount: sql<number>`count(${contracts.id})::int`,
        })
        .from(businessRecords)
        .leftJoin(contracts, eq(businessRecords.id, contracts.customerId))
        .where(
          and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
        )
        .groupBy(businessRecords.id, businessRecords.companyName)
        .orderBy(desc(sql`coalesce(sum(${contracts.monthlyBase}::numeric), 0)`))
        .limit(10);

      res.json(
        customers.map((customer) => ({
          ...customer,
          accountValue: Number(customer.accountValue || 0),
        })),
      );
    } catch (error) {
      log.error('Error fetching top customers:', error);
      res.status(500).json({ message: 'Failed to fetch top customers' });
    }
  });

  // ─── Dashboard Alerts ──────────────────────────────────────────────

  app.get('/api/dashboard/alerts', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Real alerts from database - low stock items
      const lowStockItems = await db
        .select({
          id: inventoryItems.id,
          name: inventoryItems.itemDescription,
          category: inventoryItems.itemCategory,
          currentStock: inventoryItems.quantityOnHand,
          minThreshold: inventoryItems.reorderPoint,
        })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.tenantId, tenantId), sql`quantity_on_hand <= reorder_point`))
        .orderBy(asc(inventoryItems.quantityOnHand))
        .limit(20);

      const alerts = lowStockItems.map((item) => ({
        id: item.id,
        type: 'low_stock',
        severity: 'medium',
        title: `Low Stock: ${item.name}`,
        message: `${item.name} is running low (${item.currentStock} remaining, reorder at ${item.minThreshold})`,
        category: item.category,
        timestamp: new Date().toISOString(),
      }));

      res.json(alerts);
    } catch (error) {
      log.error('Error fetching alerts:', error);
      res.status(500).json({ message: 'Failed to fetch alerts' });
    }
  });
}
