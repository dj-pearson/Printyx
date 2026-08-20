import type { Express, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { eq, and, sql, desc, sum, count, gte, lte } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-modular-dashboard');

import {
  businessRecords,
  serviceTickets,
  contracts,
  invoices,
  deals,
  users,
  inventoryItems,
  type User,
} from '@shared/schema';
// Supabase authentication middleware and helpers
import { protectedRoute } from './middleware/supabase-auth';
import { getUserId, getTenantId, getRoleId } from './utils/auth-helpers';
import {
  buildCard,
  formatCurrency,
  parseEnabledParam,
  resolveActiveCards,
  roleCards,
} from './lib/dashboard-cards';

export function registerModularDashboardRoutes(app: Express) {
  // Get available card configurations for a role
  // Protected with Supabase JWT authentication
  app.get('/api/dashboard/card-config', protectedRoute, async (req: Request, res: Response) => {
    try {
      // Get user role from Supabase JWT or database lookup
      const reqAny = req as any;
      const userRole = reqAny.supabaseUser?.role || reqAny.user?.role || 'sales';
      const config = roleCards(userRole);

      res.json({
        role: userRole,
        defaultCards: config.defaultCards,
        availableCards: config.availableCards,
        allCards: [...config.defaultCards, ...config.availableCards],
      });
    } catch (error) {
      log.error('Error fetching card config:', error);
      res.status(500).json({ message: 'Failed to fetch card configuration' });
    }
  });

  // Get user-specific dashboard modules based on role and enabled cards
  // Protected with Supabase JWT authentication
  app.get('/api/dashboard/modules', protectedRoute, async (req: Request, res: Response) => {
    try {
      // Use Supabase auth helpers to get tenant and user context
      const tenantId = getTenantId(req);
      const userId = getUserId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get user role from Supabase JWT or fallback to 'sales'
      const reqAny = req as any;
      const userRole = reqAny.supabaseUser?.role || reqAny.user?.role || 'sales';
      // Get enabled cards from query params
      const enabledCards = parseEnabledParam(req.query.enabled as string | undefined);

      // Role config and the active-card resolution are shared with the edge
      // function, so both backends build the same cards for the same role.
      const { config: roleConfig, activeCards } = resolveActiveCards(userRole, enabledCards);

      const modules = [];

      try {
        const currentMonth = new Date().toISOString().slice(0, 7) + '%';

        // Personal Revenue (for sales roles)
        if (activeCards.includes('personal_revenue')) {
          const revenueResult = await db
            .select({ total: sum(invoices.totalAmount) })
            .from(invoices)
            .where(
              and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
            );

          modules.push(
            buildCard('personal_revenue', formatCurrency(Number(revenueResult[0]?.total || 0))),
          );
        }

        // Personal Deals (for sales roles)
        if (activeCards.includes('personal_deals')) {
          const dealsResult = await db
            .select({ count: count() })
            .from(deals)
            .where(eq(deals.tenantId, tenantId));

          modules.push(buildCard('personal_deals', dealsResult[0]?.count || 0));
        }

        // Personal Leads (for sales roles)
        if (activeCards.includes('personal_leads')) {
          const leadsResult = await db
            .select({ count: count() })
            .from(businessRecords)
            .where(
              and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'lead')),
            );

          modules.push(buildCard('personal_leads', leadsResult[0]?.count || 0));
        }

        // Personal Service Tickets (for technicians)
        if (activeCards.includes('personal_tickets')) {
          const ticketsResult = await db
            .select({ count: count() })
            .from(serviceTickets)
            .where(eq(serviceTickets.tenantId, tenantId));

          modules.push(buildCard('personal_tickets', ticketsResult[0]?.count || 0));
        }

        // Team Revenue (optional for sales)
        if (activeCards.includes('team_revenue')) {
          const teamRevenueResult = await db
            .select({ total: sum(invoices.totalAmount) })
            .from(invoices)
            .where(
              and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
            );

          modules.push(
            buildCard('team_revenue', formatCurrency(Number(teamRevenueResult[0]?.total || 0)), {
              enabled: enabledCards.includes('team_revenue'),
            }),
          );
        }

        // Company Customers (optional for lower roles)
        if (activeCards.includes('company_customers')) {
          const customersResult = await db
            .select({ count: count() })
            .from(businessRecords)
            .where(
              and(
                eq(businessRecords.tenantId, tenantId),
                eq(businessRecords.recordType, 'customer'),
              ),
            );

          modules.push(
            buildCard('company_customers', customersResult[0]?.count || 0, {
              enabled: enabledCards.includes('company_customers'),
            }),
          );
        }

        // Inventory Alerts (optional for operational roles)
        if (activeCards.includes('inventory_alerts')) {
          const lowStockResult = await db
            .select({ count: count() })
            .from(inventoryItems)
            // PROD-014: this said `current_stock <= reorder_point`. There is no
            // current_stock column on inventory_items — the quantity column is
            // quantity_on_hand — so the fragment raised 42703, the surrounding
            // catch swallowed it, and a user who switched this card on got a
            // dashboard showing only "Dashboard Loading... ---", permanently.
            .where(
              and(eq(inventoryItems.tenantId, tenantId), sql`quantity_on_hand <= reorder_point`),
            );

          modules.push(
            buildCard('inventory_alerts', lowStockResult[0]?.count || 0, {
              enabled: enabledCards.includes('inventory_alerts'),
            }),
          );
        }

        // Service Overview (optional for sales and other roles)
        if (activeCards.includes('service_overview')) {
          const [totalTickets, openTickets] = await Promise.all([
            db
              .select({ count: count() })
              .from(serviceTickets)
              .where(eq(serviceTickets.tenantId, tenantId)),

            db
              .select({ count: count() })
              .from(serviceTickets)
              .where(
                and(eq(serviceTickets.tenantId, tenantId), sql`status IN ('open', 'in_progress')`),
              ),
          ]);

          modules.push(
            buildCard('service_overview', openTickets[0]?.count || 0, {
              subtitle: `${totalTickets[0]?.count || 0} total tickets`,
              enabled: enabledCards.includes('service_overview'),
            }),
          );
        }

        // Revenue Overview (for technicians and other roles)
        if (activeCards.includes('revenue_overview')) {
          const revenueResult = await db
            .select({ total: sum(invoices.totalAmount) })
            .from(invoices)
            .where(
              and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
            );

          modules.push(
            buildCard('revenue_overview', formatCurrency(Number(revenueResult[0]?.total || 0)), {
              enabled: enabledCards.includes('revenue_overview'),
            }),
          );
        }

        // Business Overview for Management
        if (activeCards.includes('business_overview')) {
          const [customers, contracts_data, revenue, tickets] = await Promise.all([
            db
              .select({ count: count() })
              .from(businessRecords)
              .where(
                and(
                  eq(businessRecords.tenantId, tenantId),
                  eq(businessRecords.recordType, 'customer'),
                ),
              ),

            db
              .select({ count: count() })
              .from(contracts)
              .where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active'))),

            db
              .select({ total: sum(invoices.totalAmount) })
              .from(invoices)
              .where(
                and(eq(invoices.tenantId, tenantId), sql`created_at >= NOW() - INTERVAL '30 days'`),
              ),

            db
              .select({ count: count() })
              .from(serviceTickets)
              .where(
                and(eq(serviceTickets.tenantId, tenantId), sql`status IN ('open', 'in_progress')`),
              ),
          ]);

          modules.push(
            buildCard('business_overview', 0, {
              data: {
                customers: customers[0]?.count || 0,
                activeContracts: contracts_data[0]?.count || 0,
                monthlyRevenue: Number(revenue[0]?.total || 0),
                pendingTickets: tickets[0]?.count || 0,
              },
            }),
          );
        }

        // A manager's other three default cards. roleCardConfig has always
        // listed them and no branch ever built one, so three quarters of a
        // manager's dashboard was blank here too — not only in production.
        if (activeCards.includes('revenue_summary')) {
          const revenueResult = await db
            .select({ total: sum(invoices.totalAmount) })
            .from(invoices)
            .where(
              and(eq(invoices.tenantId, tenantId), sql`created_at >= NOW() - INTERVAL '30 days'`),
            );
          modules.push(
            buildCard('revenue_summary', formatCurrency(Number(revenueResult[0]?.total || 0))),
          );
        }

        if (activeCards.includes('customer_summary')) {
          const customersResult = await db
            .select({ count: count() })
            .from(businessRecords)
            .where(
              and(
                eq(businessRecords.tenantId, tenantId),
                eq(businessRecords.recordType, 'customer'),
              ),
            );
          modules.push(buildCard('customer_summary', customersResult[0]?.count || 0));
        }

        if (activeCards.includes('service_summary')) {
          const openResult = await db
            .select({ count: count() })
            .from(serviceTickets)
            .where(
              and(eq(serviceTickets.tenantId, tenantId), sql`status IN ('open', 'in_progress')`),
            );
          modules.push(buildCard('service_summary', openResult[0]?.count || 0));
        }
      } catch (queryError) {
        log.error('Error in individual queries:', queryError);
        // If queries fail, provide fallback modules
        modules.push({
          id: 'fallback',
          category: 'sales',
          title: 'Dashboard Loading...',
          value: '---',
          subtitle: 'Data loading in progress',
          icon: 'BarChart3',
        });
      }

      res.json({
        modules: modules.filter(Boolean),
        userRole,
        roleConfig: {
          defaultCards: roleConfig.defaultCards,
          availableCards: roleConfig.availableCards,
          activeCards,
        },
      });
    } catch (error) {
      log.error('Error fetching dashboard modules:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard modules' });
    }
  });
}
