/**
 * DASHBOARD CUSTOMIZATION ROUTES
 * Manage layouts, widgets, and user preferences
 */

import { Router } from 'express';
import { db } from './db';
import { eq, and, or } from 'drizzle-orm';
import { dashboardLayouts, userDashboardPreferences, dashboardWidgets, dashboardSnapshots } from '@shared/schema-dashboard';

const router = Router();

/**
 * GET /api/dashboard/widgets
 * Get all available dashboard widgets with role filtering
 */
router.get('/widgets', async (req, res) => {
  try {
    const userRole = (req as any).user?.role;
    
    let query = db.select().from(dashboardWidgets).where(eq(dashboardWidgets.isActive, true));
    
    const widgets = await query;
    
    // Filter by role if applicable
    const filtered = widgets.filter(widget => {
      if (!widget.applicableRoles || widget.applicableRoles.length === 0) return true;
      if (userRole && Array.isArray(widget.applicableRoles)) {
        return (widget.applicableRoles as string[]).includes(userRole);
      }
      return false;
    });
    
    res.json({ data: filtered });
  } catch (error) {
    console.error('Error fetching widgets:', error);
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

/**
 * GET /api/dashboard/layouts
 * Get dashboard layouts for current user and their role
 */
router.get('/layouts', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const roleId = (req as any).user?.roleId;
    const tenantId = (req as any).tenantId;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get user's custom layout and role default layout
    const layouts = await db
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.tenantId, tenantId),
          or(
            eq(dashboardLayouts.userId, userId),
            eq(dashboardLayouts.roleId, roleId || '')
          )
        )
      );
    
    res.json({ data: layouts });
  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({ error: 'Failed to fetch layouts' });
  }
});

/**
 * GET /api/dashboard/layout/:layoutId
 * Get a specific layout
 */
router.get('/layout/:layoutId', async (req, res) => {
  try {
    const { layoutId } = req.params;
    const tenantId = (req as any).tenantId;
    
    const layout = await db
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.id, layoutId),
          eq(dashboardLayouts.tenantId, tenantId)
        )
      )
      .limit(1);
    
    if (!layout.length) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    res.json({ data: layout[0] });
  } catch (error) {
    console.error('Error fetching layout:', error);
    res.status(500).json({ error: 'Failed to fetch layout' });
  }
});

/**
 * POST /api/dashboard/layout
 * Create a new dashboard layout
 */
router.post('/layout', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId;
    const { name, description, widgets, columns = 12, isDefault = false, roleId } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const layout = await db.insert(dashboardLayouts).values({
      name,
      description,
      tenantId,
      userId,
      roleId,
      widgets: widgets || [],
      columns,
      isDefault,
      isUserCustom: !roleId,
    }).returning();
    
    res.status(201).json({ data: layout[0] });
  } catch (error) {
    console.error('Error creating layout:', error);
    res.status(500).json({ error: 'Failed to create layout' });
  }
});

/**
 * PATCH /api/dashboard/layout/:layoutId
 * Update a dashboard layout
 */
router.patch('/layout/:layoutId', async (req, res) => {
  try {
    const { layoutId } = req.params;
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId;
    const { name, description, widgets, columns } = req.body;
    
    const updates: any = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (widgets) updates.widgets = widgets;
    if (columns) updates.columns = columns;
    updates.updatedAt = new Date();
    
    // Verify ownership
    const layout = await db
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.id, layoutId),
          eq(dashboardLayouts.tenantId, tenantId)
        )
      )
      .limit(1);
    
    if (!layout.length) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    const updated = await db
      .update(dashboardLayouts)
      .set(updates)
      .where(eq(dashboardLayouts.id, layoutId))
      .returning();
    
    res.json({ data: updated[0] });
  } catch (error) {
    console.error('Error updating layout:', error);
    res.status(500).json({ error: 'Failed to update layout' });
  }
});

/**
 * DELETE /api/dashboard/layout/:layoutId
 * Delete a dashboard layout
 */
router.delete('/layout/:layoutId', async (req, res) => {
  try {
    const { layoutId } = req.params;
    const tenantId = (req as any).tenantId;
    
    await db
      .delete(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.id, layoutId),
          eq(dashboardLayouts.tenantId, tenantId)
        )
      );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting layout:', error);
    res.status(500).json({ error: 'Failed to delete layout' });
  }
});

/**
 * GET /api/dashboard/preferences
 * Get user dashboard preferences
 */
router.get('/preferences', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId;
    
    let prefs = await db
      .select()
      .from(userDashboardPreferences)
      .where(
        and(
          eq(userDashboardPreferences.userId, userId),
          eq(userDashboardPreferences.tenantId, tenantId)
        )
      )
      .limit(1);
    
    if (!prefs.length) {
      // Create default preferences
      const created = await db
        .insert(userDashboardPreferences)
        .values({
          userId,
          tenantId,
        })
        .returning();
      prefs = created;
    }
    
    res.json({ data: prefs[0] });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PATCH /api/dashboard/preferences
 * Update user dashboard preferences
 */
router.patch('/preferences', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId;
    const { activeLayoutId, refreshInterval, theme, showGridLines, compactMode, globalFilters, widgetStates } = req.body;
    
    const updates: any = {};
    if (activeLayoutId) updates.activeLayoutId = activeLayoutId;
    if (refreshInterval) updates.refreshInterval = refreshInterval;
    if (theme) updates.theme = theme;
    if (showGridLines !== undefined) updates.showGridLines = showGridLines;
    if (compactMode !== undefined) updates.compactMode = compactMode;
    if (globalFilters) updates.globalFilters = globalFilters;
    if (widgetStates) updates.widgetStates = widgetStates;
    updates.updatedAt = new Date();
    
    const updated = await db
      .update(userDashboardPreferences)
      .set(updates)
      .where(
        and(
          eq(userDashboardPreferences.userId, userId),
          eq(userDashboardPreferences.tenantId, tenantId)
        )
      )
      .returning();
    
    res.json({ data: updated[0] || {} });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/dashboard/snapshot
 * Save a dashboard layout snapshot
 */
router.post('/snapshot', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { layoutId, name, description } = req.body;
    
    if (!layoutId || !name) {
      return res.status(400).json({ error: 'layoutId and name are required' });
    }
    
    // Get current layout
    const layout = await db
      .select()
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.id, layoutId))
      .limit(1);
    
    if (!layout.length) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    const snapshot = await db
      .insert(dashboardSnapshots)
      .values({
        userId,
        layoutId,
        name,
        description,
        layoutSnapshot: layout[0],
      })
      .returning();
    
    res.status(201).json({ data: snapshot[0] });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

/**
 * GET /api/dashboard/snapshots/:layoutId
 * Get snapshots for a layout
 */
router.get('/snapshots/:layoutId', async (req, res) => {
  try {
    const { layoutId } = req.params;
    const userId = (req as any).user?.id;
    
    const snapshots = await db
      .select()
      .from(dashboardSnapshots)
      .where(
        and(
          eq(dashboardSnapshots.layoutId, layoutId),
          eq(dashboardSnapshots.userId, userId)
        )
      );
    
    res.json({ data: snapshots });
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

export default router;
