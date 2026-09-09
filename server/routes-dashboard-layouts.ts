/**
 * Dashboard Layouts API Routes
 *
 * Endpoints for managing user dashboard layouts:
 * - Save and retrieve custom dashboard configurations
 * - Default layouts per user
 * - Widget data fetching
 */

import type { Express, Request, Response } from 'express';
import { eq, and, desc, sql, count, isNull, or } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { resolveTenant, requireTenant, type TenantRequest } from './middleware/tenancy';
import { dashboardLayouts } from '@shared/reporting-schema';
import { businessRecords, opportunities, equipment } from '@shared/schema';
// Auth helpers for Supabase JWT + session fallback
import { getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-dashboard-layouts');

type DashboardRequest = Request & TenantRequest & { user?: any; session?: any };

interface WidgetInstance {
  id: string;
  definitionId: string;
  size: 'small' | 'medium' | 'large' | 'full';
  visible: boolean;
  order: number;
  config?: Record<string, any>;
}

interface DashboardLayoutPayload {
  name: string;
  widgets: WidgetInstance[];
  isDefault: boolean;
}

export function registerDashboardLayoutsRoutes(app: Express) {
  // Apply middleware
  app.use('/api/dashboard', resolveTenant, requireTenant);

  /**
   * Get the user's default dashboard layout
   */
  app.get(
    '/api/dashboard/layouts/default',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const userId = getUserId(req);

        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        // Get user's default layout
        const [layout] = await db
          .select()
          .from(dashboardLayouts)
          .where(
            and(
              eq(dashboardLayouts.tenantId, tenantId),
              eq(dashboardLayouts.userId, userId),
              eq(dashboardLayouts.isDefault, true),
              eq(dashboardLayouts.isActive, true),
            ),
          )
          .limit(1);

        if (!layout) {
          // Return default layout if none exists
          return res.json({
            name: 'Default Dashboard',
            widgets: [],
            isDefault: true,
          });
        }

        res.json({
          id: layout.id,
          name: layout.name,
          description: layout.description,
          widgets: layout.widgets,
          isDefault: layout.isDefault,
          createdAt: layout.createdAt,
          updatedAt: layout.updatedAt,
        });
      } catch (error: any) {
        log.error('Error fetching default layout:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard layout' });
      }
    },
  );

  /**
   * Get all user's dashboard layouts
   */
  app.get(
    '/api/dashboard/layouts',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const userId = getUserId(req);

        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        // Get user's layouts + public tenant layouts
        const layouts = await db
          .select({
            id: dashboardLayouts.id,
            name: dashboardLayouts.name,
            description: dashboardLayouts.description,
            isDefault: dashboardLayouts.isDefault,
            isPublic: dashboardLayouts.isPublic,
            createdAt: dashboardLayouts.createdAt,
            updatedAt: dashboardLayouts.updatedAt,
          })
          .from(dashboardLayouts)
          .where(
            and(
              eq(dashboardLayouts.tenantId, tenantId),
              eq(dashboardLayouts.isActive, true),
              or(eq(dashboardLayouts.userId, userId), eq(dashboardLayouts.isPublic, true)),
            ),
          )
          .orderBy(desc(dashboardLayouts.isDefault), desc(dashboardLayouts.updatedAt));

        res.json(layouts);
      } catch (error: any) {
        log.error('Error fetching layouts:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard layouts' });
      }
    },
  );

  /**
   * Save a dashboard layout
   */
  app.post(
    '/api/dashboard/layouts',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const userId = getUserId(req);

        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        const { name, widgets, isDefault }: DashboardLayoutPayload = req.body;

        if (!name || !widgets) {
          return res.status(400).json({ message: 'Name and widgets are required' });
        }

        // If setting as default, unset other defaults
        if (isDefault) {
          await db
            .update(dashboardLayouts)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(dashboardLayouts.tenantId, tenantId),
                eq(dashboardLayouts.userId, userId),
                eq(dashboardLayouts.isDefault, true),
              ),
            );
        }

        // Check if user already has this layout
        const [existingLayout] = await db
          .select()
          .from(dashboardLayouts)
          .where(
            and(
              eq(dashboardLayouts.tenantId, tenantId),
              eq(dashboardLayouts.userId, userId),
              eq(dashboardLayouts.name, name),
            ),
          )
          .limit(1);

        let savedLayout;

        if (existingLayout) {
          // Update existing layout
          [savedLayout] = await db
            .update(dashboardLayouts)
            .set({
              widgets,
              layout: { gridCols: 4 },
              isDefault: isDefault ?? existingLayout.isDefault,
              updatedAt: new Date(),
            })
            .where(eq(dashboardLayouts.id, existingLayout.id))
            .returning();
        } else {
          // Create new layout
          [savedLayout] = await db
            .insert(dashboardLayouts)
            .values({
              tenantId,
              userId,
              name,
              widgets,
              layout: { gridCols: 4 },
              isDefault: isDefault ?? true,
              isPublic: false,
              isActive: true,
              createdBy: userId,
            })
            .returning();
        }

        res.status(existingLayout ? 200 : 201).json({
          id: savedLayout.id,
          name: savedLayout.name,
          message: existingLayout ? 'Dashboard layout updated' : 'Dashboard layout created',
        });
      } catch (error: any) {
        log.error('Error saving layout:', error);
        res.status(500).json({ message: 'Failed to save dashboard layout' });
      }
    },
  );

  /**
   * Delete a dashboard layout
   */
  app.delete(
    '/api/dashboard/layouts/:id',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const userId = getUserId(req);
        const layoutId = req.params.id;

        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        // Soft delete - just mark as inactive
        const [deleted] = await db
          .update(dashboardLayouts)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(dashboardLayouts.id, layoutId),
              eq(dashboardLayouts.tenantId, tenantId),
              eq(dashboardLayouts.userId, userId),
            ),
          )
          .returning();

        if (!deleted) {
          return res.status(404).json({ message: 'Layout not found or access denied' });
        }

        res.json({ message: 'Dashboard layout deleted' });
      } catch (error: any) {
        log.error('Error deleting layout:', error);
        res.status(500).json({ message: 'Failed to delete dashboard layout' });
      }
    },
  );

  // ============= WIDGET DATA ENDPOINTS =============

  /**
   * Get dashboard metrics
   */
  app.get(
    '/api/dashboard/metrics/:type',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const { type } = req.params;

        // WHY EVERY `change` IS NULL, and four of these six have no value either.
        //
        // This endpoint feeds the role-based dashboard's stat cards and the widgets
        // CustomDashboard offers, and it used to answer with typed-in numbers:
        // revenue was the string '$125,432' with 12.5% growth, tickets 23 at -3.1%,
        // inventory-alerts 7, renewals 12, and every single `change` - including on
        // the two metrics that DO count real rows - was a literal (12.5, 5.2, 8.3).
        // Nothing anywhere computes a prior-period comparison, so a percentage change
        // is not a degraded measurement, it is an invention. Per the rule this repo
        // already applies to fabricated operational values, an unbacked claim is
        // removed rather than faked, and the response names what it cannot answer so
        // an absence is not read as zero.
        //
        // The three counts removed rather than derived ARE derivable - service_tickets,
        // inventory_items against reorder_point, contracts by end date - and that is
        // DASH-METRICS-001, not arithmetic to guess at here.
        let result: any = { value: null, change: null, unbacked: ['change'] };

        switch (type) {
          case 'revenue': {
            result = {
              value: null,
              change: null,
              unbacked: ['value', 'change'],
              reason: 'No revenue roll-up is computed here. Billing owns invoice totals.',
            };
            break;
          }

          case 'customers': {
            const [countResult] = await db
              .select({ count: count() })
              .from(businessRecords)
              .where(
                and(
                  eq(businessRecords.tenantId, tenantId),
                  eq(businessRecords.recordType, 'customer'),
                  eq(businessRecords.status, 'active'),
                ),
              );
            result = { value: countResult?.count || 0, change: null, unbacked: ['change'] };
            break;
          }

          case 'opportunities': {
            const [oppResult] = await db
              .select({
                count: count(),
                total: sql<number>`COALESCE(SUM(${opportunities.amount}), 0)`,
              })
              .from(opportunities)
              .where(
                and(
                  eq(opportunities.tenantId, tenantId),
                  sql`${opportunities.stageName} NOT IN ('Closed Won', 'Closed Lost')`,
                ),
              );
            result = {
              value: `$${Number(oppResult?.total || 0).toLocaleString()}`,
              count: oppResult?.count || 0,
              change: null,
              unbacked: ['change'],
            };
            break;
          }

          case 'tickets': {
            result = {
              value: null,
              change: null,
              unbacked: ['value', 'change'],
              reason: 'Open-ticket counts are not rolled up here. See DASH-METRICS-001.',
            };
            break;
          }

          case 'inventory-alerts': {
            result = {
              value: null,
              change: null,
              unbacked: ['value', 'change'],
              reason: 'Below-reorder-point counts are not computed here. See DASH-METRICS-001.',
            };
            break;
          }

          case 'renewals': {
            result = {
              value: null,
              change: null,
              unbacked: ['value', 'change'],
              reason: 'Upcoming renewals are not computed here. See DASH-METRICS-001.',
            };
            break;
          }

          default:
            return res.status(404).json({ message: `Unknown metric type: ${type}` });
        }

        res.json(result);
      } catch (error: any) {
        log.error('Error fetching metric:', error);
        res.status(500).json({ message: 'Failed to fetch metric' });
      }
    },
  );

  /**
   * Get chart data
   */
  app.get(
    '/api/dashboard/charts/:type',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const { type } = req.params;

        let data: any[] = [];
        let unbacked: string | null = null;

        switch (type) {
          case 'pipeline': {
            const stages = await db
              .select({
                stage: opportunities.stageName,
                count: count(),
                total: sql<number>`COALESCE(SUM(${opportunities.amount}), 0)`,
              })
              .from(opportunities)
              .where(eq(opportunities.tenantId, tenantId))
              .groupBy(opportunities.stageName);

            data = stages.map((s) => ({
              name: s.stage || 'Unknown',
              value: Number(s.total) || 0,
              count: s.count,
            }));
            break;
          }

          case 'revenue-trend': {
            // Six months of invented revenue, rendered as a trend line. A chart is a
            // claim about a shape over time; drawn over typed-in points it asserts
            // something specific and false. Empty until DASH-METRICS-001 derives it.
            data = [];
            unbacked = 'No monthly revenue series is computed. Billing owns invoice totals.';
            break;
          }

          case 'customer-distribution': {
            const industries = await db
              .select({
                industry: businessRecords.industry,
                count: count(),
              })
              .from(businessRecords)
              .where(
                and(
                  eq(businessRecords.tenantId, tenantId),
                  eq(businessRecords.recordType, 'customer'),
                ),
              )
              .groupBy(businessRecords.industry)
              .limit(10);

            data = industries.map((i) => ({
              name: i.industry || 'Other',
              value: i.count,
            }));
            break;
          }

          case 'service-metrics': {
            data = [];
            unbacked = 'Ticket counts by status are not rolled up here. See DASH-METRICS-001.';
            break;
          }

          default:
            return res.status(404).json({ message: `Unknown chart type: ${type}` });
        }

        res.json(unbacked ? { data, unbacked } : { data });
      } catch (error: any) {
        log.error('Error fetching chart data:', error);
        res.status(500).json({ message: 'Failed to fetch chart data' });
      }
    },
  );

  /**
   * Get activity feed
   */
  app.get(
    '/api/dashboard/activity',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        // Was five invented events naming a customer, an invoice number and a
        // dollar amount. business_record_activities is the real feed and this
        // endpoint does not read it; see DASH-METRICS-001.
        res.json({
          items: [],
          unbacked:
            'No activity feed is assembled here. business_record_activities holds the real events.',
        });
      } catch (error: any) {
        log.error('Error fetching activity:', error);
        res.status(500).json({ message: 'Failed to fetch activity' });
      }
    },
  );

  /**
   * Get urgent items
   */
  app.get(
    '/api/dashboard/urgent',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        // Was four invented incidents, one of them marked critical. A dashboard
        // that shows a critical item nobody reported is worse than an empty one:
        // it spends attention, and an empty list here reads as "nothing is wrong"
        // when the truth is that nothing is being checked.
        res.json({
          items: [],
          unbacked:
            'Urgent items are not derived here. routes-operations-extended derives four real alert families.',
        });
      } catch (error: any) {
        log.error('Error fetching urgent items:', error);
        res.status(500).json({ message: 'Failed to fetch urgent items' });
      }
    },
  );

  /**
   * Get user's tasks
   */
  app.get(
    '/api/dashboard/my-tasks',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        // Was four invented tasks, one already ticked. The tasks tables are real
        // and this endpoint does not read them; see DASH-METRICS-001.
        res.json({
          items: [],
          unbacked: 'This does not read the tasks tables.',
        });
      } catch (error: any) {
        log.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Failed to fetch tasks' });
      }
    },
  );

  /**
   * Get team performance
   */
  app.get(
    '/api/dashboard/team-performance',
    isAuthenticated,
    async (req: DashboardRequest, res: Response) => {
      try {
        // Was five invented people with invented revenue and a leaderboard rank.
        // A sales leaderboard is a statement about named colleagues; typed in, it is
        // the least defensible thing on this page.
        res.json({
          items: [],
          unbacked: 'No per-rep attainment is computed here. See DASH-METRICS-001.',
        });
      } catch (error: any) {
        log.error('Error fetching team performance:', error);
        res.status(500).json({ message: 'Failed to fetch team performance' });
      }
    },
  );
}
