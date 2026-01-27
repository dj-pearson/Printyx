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
import { businessRecords, opportunities, equipment, contacts } from '@shared/schema';
// Auth helpers for Supabase JWT + session fallback
import { getUserId } from './utils/auth-helpers';

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
        const tenantId = req.tenant_id!;
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
              eq(dashboardLayouts.tenant_id, tenantId),
              eq(dashboardLayouts.user_id, userId),
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
          createdAt: layout.created_at,
          updatedAt: layout.updated_at,
        });
      } catch (error: any) {
        console.error('Error fetching default layout:', error);
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
        const tenantId = req.tenant_id!;
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
            createdAt: dashboardLayouts.created_at,
            updatedAt: dashboardLayouts.updated_at,
          })
          .from(dashboardLayouts)
          .where(
            and(
              eq(dashboardLayouts.tenant_id, tenantId),
              eq(dashboardLayouts.isActive, true),
              or(eq(dashboardLayouts.user_id, userId), eq(dashboardLayouts.isPublic, true)),
            ),
          )
          .orderBy(desc(dashboardLayouts.isDefault), desc(dashboardLayouts.updated_at));

        res.json(layouts);
      } catch (error: any) {
        console.error('Error fetching layouts:', error);
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
        const tenantId = req.tenant_id!;
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
                eq(dashboardLayouts.tenant_id, tenantId),
                eq(dashboardLayouts.user_id, userId),
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
              eq(dashboardLayouts.tenant_id, tenantId),
              eq(dashboardLayouts.user_id, userId),
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
        console.error('Error saving layout:', error);
        res.status(500).json({ message: error.message || 'Failed to save dashboard layout' });
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
        const tenantId = req.tenant_id!;
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
              eq(dashboardLayouts.tenant_id, tenantId),
              eq(dashboardLayouts.user_id, userId),
            ),
          )
          .returning();

        if (!deleted) {
          return res.status(404).json({ message: 'Layout not found or access denied' });
        }

        res.json({ message: 'Dashboard layout deleted' });
      } catch (error: any) {
        console.error('Error deleting layout:', error);
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
        const tenantId = req.tenant_id!;
        const { type } = req.params;

        let result: any = { value: 0, change: 0 };

        switch (type) {
          case 'revenue': {
            // Mock data - replace with actual query
            result = { value: '$125,432', change: 12.5 };
            break;
          }

          case 'customers': {
            const [countResult] = await db
              .select({ count: count() })
              .from(businessRecords)
              .where(
                and(
                  eq(businessRecords.tenant_id, tenantId),
                  eq(businessRecords.recordType, 'customer'),
                  eq(businessRecords.status, 'active'),
                ),
              );
            result = { value: countResult?.count || 0, change: 5.2 };
            break;
          }

          case 'opportunities': {
            const [oppResult] = await db
              .select({
                count: count(),
                total: sql<number>`COALESCE(SUM(value), 0)`,
              })
              .from(opportunities)
              .where(
                and(
                  eq(opportunities.tenant_id, tenantId),
                  sql`${opportunities.stage} NOT IN ('Closed Won', 'Closed Lost')`,
                ),
              );
            result = {
              value: `$${Number(oppResult?.total || 0).toLocaleString()}`,
              count: oppResult?.count || 0,
              change: 8.3,
            };
            break;
          }

          case 'tickets': {
            // Mock data - replace with actual query
            result = { value: 23, change: -3.1 };
            break;
          }

          case 'inventory-alerts': {
            // Mock data - replace with actual query
            result = { value: 7, change: 0 };
            break;
          }

          case 'renewals': {
            // Mock data - replace with actual query
            result = { value: 12, change: 0 };
            break;
          }

          default:
            return res.status(404).json({ message: `Unknown metric type: ${type}` });
        }

        res.json(result);
      } catch (error: any) {
        console.error('Error fetching metric:', error);
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
        const tenantId = req.tenant_id!;
        const { type } = req.params;

        let data: any[] = [];

        switch (type) {
          case 'pipeline': {
            const stages = await db
              .select({
                stage: opportunities.stage,
                count: count(),
                total: sql<number>`COALESCE(SUM(value), 0)`,
              })
              .from(opportunities)
              .where(eq(opportunities.tenant_id, tenantId))
              .groupBy(opportunities.stage);

            data = stages.map((s) => ({
              name: s.stage || 'Unknown',
              value: Number(s.total) || 0,
              count: s.count,
            }));
            break;
          }

          case 'revenue-trend': {
            // Mock data - replace with actual query
            data = [
              { month: 'Jan', revenue: 45000 },
              { month: 'Feb', revenue: 52000 },
              { month: 'Mar', revenue: 48000 },
              { month: 'Apr', revenue: 61000 },
              { month: 'May', revenue: 55000 },
              { month: 'Jun', revenue: 67000 },
            ];
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
                  eq(businessRecords.tenant_id, tenantId),
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
            // Mock data - replace with actual query
            data = [
              { status: 'Open', count: 15 },
              { status: 'In Progress', count: 23 },
              { status: 'Pending', count: 8 },
              { status: 'Resolved', count: 45 },
            ];
            break;
          }

          default:
            return res.status(404).json({ message: `Unknown chart type: ${type}` });
        }

        res.json({ data });
      } catch (error: any) {
        console.error('Error fetching chart data:', error);
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
        // Mock data - replace with actual activity log query
        const items = [
          { id: 1, text: "New customer 'Acme Corp' added", time: '2 min ago' },
          { id: 2, text: 'Invoice #1234 paid ($5,432)', time: '1 hour ago' },
          { id: 3, text: 'Service ticket #456 resolved', time: '3 hours ago' },
          { id: 4, text: "Deal 'Enterprise Contract' won", time: '5 hours ago' },
          { id: 5, text: 'Equipment PM scheduled', time: 'Yesterday' },
        ];

        res.json({ items });
      } catch (error: any) {
        console.error('Error fetching activity:', error);
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
        // Mock data - replace with actual urgent items query
        const items = [
          { id: 1, title: 'Critical server issue at Client ABC', priority: 'critical' },
          { id: 2, title: 'Customer escalation - billing dispute', priority: 'high' },
          { id: 3, title: 'Contract expiring in 3 days', priority: 'high' },
          { id: 4, title: 'Low toner alert - 5 devices', priority: 'medium' },
        ];

        res.json({ items });
      } catch (error: any) {
        console.error('Error fetching urgent items:', error);
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
        // Mock data - replace with actual tasks query
        const items = [
          { id: 1, title: 'Follow up with prospect', done: false, dueDate: 'Today' },
          { id: 2, title: 'Submit weekly report', done: false, dueDate: 'Tomorrow' },
          { id: 3, title: 'Review contract draft', done: true, dueDate: 'Yesterday' },
          { id: 4, title: 'Schedule customer meeting', done: false, dueDate: 'This week' },
        ];

        res.json({ items });
      } catch (error: any) {
        console.error('Error fetching tasks:', error);
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
        // Mock data - replace with actual team performance query
        const items = [
          { id: 1, name: 'John Smith', value: '$125,000', rank: 1 },
          { id: 2, name: 'Jane Doe', value: '$98,000', rank: 2 },
          { id: 3, name: 'Bob Johnson', value: '$87,000', rank: 3 },
          { id: 4, name: 'Alice Brown', value: '$76,000', rank: 4 },
          { id: 5, name: 'Charlie Wilson', value: '$65,000', rank: 5 },
        ];

        res.json({ items });
      } catch (error: any) {
        console.error('Error fetching team performance:', error);
        res.status(500).json({ message: 'Failed to fetch team performance' });
      }
    },
  );
}
