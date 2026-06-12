import type { Express, Request } from 'express';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, inArray, ne, or } from 'drizzle-orm';
import { db } from './db';
import {
  savedViews,
  savedViewPins,
  createSavedViewBodySchema,
  updateSavedViewBodySchema,
  SAVED_VIEW_OBJECT_TYPES,
  type SavedView,
} from '@shared/saved-views-schema';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { getUserId, getTenantId, isPlatformAdmin, getRoleLevel } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { z } from 'zod';

const log = createModuleLogger('routes-saved-views');

/** Sentinel value in seeded filter definitions, resolved to the requesting user client-side. */
export const CURRENT_USER_TOKEN = '__CURRENT_USER__';

const objectTypeQuerySchema = z.object({
  objectType: z.enum(SAVED_VIEW_OBJECT_TYPES),
});

function isAdmin(req: Request): boolean {
  return isPlatformAdmin(req) || (getRoleLevel(req) ?? 0) >= 7;
}

function validationError(res: import('express').Response, error: z.ZodError) {
  return res.status(400).json({
    message: 'Validation error',
    code: 'VALIDATION_ERROR',
    details: error.flatten(),
  });
}

/**
 * Seed the 3 system default views for a tenant + object type if missing.
 * Idempotent: only inserts when no system views exist for the combination.
 */
async function ensureDefaultViews(tenantId: string, objectType: string): Promise<void> {
  const existing = await db
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(
      and(
        eq(savedViews.tenantId, tenantId),
        eq(savedViews.objectType, objectType),
        eq(savedViews.isSystem, true),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  const defaults = [
    {
      name: 'All Records',
      filterDefinition: [],
      sortConfig: { field: 'createdAt', direction: 'desc' },
      isDefault: true,
    },
    {
      name: 'My Records',
      filterDefinition: [{ field: 'ownerId', operator: 'eq', value: CURRENT_USER_TOKEN }],
      sortConfig: { field: 'createdAt', direction: 'desc' },
      isDefault: false,
    },
    {
      name: 'Recently Modified',
      filterDefinition: [],
      sortConfig: { field: 'updatedAt', direction: 'desc' },
      isDefault: false,
    },
  ];

  await db.insert(savedViews).values(
    defaults.map((view) => ({
      id: randomUUID(),
      tenantId,
      userId: null,
      objectType,
      name: view.name,
      filterDefinition: view.filterDefinition,
      sortConfig: view.sortConfig,
      visibility: 'everyone',
      isDefault: view.isDefault,
      isPinned: true,
      isSystem: true,
    })),
  );
  log.info({ tenantId, objectType }, 'Seeded default saved views');
}

/** A user can access a view if it's their own, shared (team/everyone), or a system default. */
function canAccessView(view: SavedView, userId: string): boolean {
  return view.isSystem || view.userId === userId || view.visibility !== 'private';
}

/** Only the owner or an admin can modify/delete a view. */
function canManageView(view: SavedView, userId: string, admin: boolean): boolean {
  return admin || view.userId === userId;
}

async function getViewForTenant(id: string, tenantId: string): Promise<SavedView | undefined> {
  const [view] = await db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.tenantId, tenantId)))
    .limit(1);
  return view;
}

export function registerSavedViewsRoutes(app: Express) {
  /**
   * GET /api/saved-views?objectType=deals
   * List all views the user can access: own + shared + system defaults.
   * Includes the user's pin state for tab rendering.
   */
  app.get('/api/saved-views', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const parsed = objectTypeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return validationError(res, parsed.error);
      }
      const { objectType } = parsed.data;

      await ensureDefaultViews(tenantId, objectType);

      const views = await db
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.tenantId, tenantId),
            eq(savedViews.objectType, objectType),
            or(
              eq(savedViews.isSystem, true),
              eq(savedViews.userId, userId),
              ne(savedViews.visibility, 'private'),
            ),
          ),
        )
        .orderBy(desc(savedViews.isSystem), asc(savedViews.name));

      const viewIds = views.map((v) => v.id);
      const pins = viewIds.length
        ? await db
            .select()
            .from(savedViewPins)
            .where(and(eq(savedViewPins.userId, userId), inArray(savedViewPins.viewId, viewIds)))
        : [];
      const pinByViewId = new Map(pins.map((p) => [p.viewId, p]));

      return res.json(
        views.map((view) => {
          const pin = pinByViewId.get(view.id);
          return {
            ...view,
            // System views are pinned by default until the user customizes tabs.
            pinned: pin ? true : view.isSystem && view.isPinned,
            pinSortOrder: pin?.sortOrder ?? null,
          };
        }),
      );
    } catch (error) {
      log.error({ err: error }, 'Failed to fetch saved views');
      return res.status(500).json({ message: 'Failed to fetch saved views' });
    }
  });

  /**
   * POST /api/saved-views
   * Create a new view. Visibility 'everyone' requires admin role.
   */
  app.post('/api/saved-views', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const parsed = createSavedViewBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return validationError(res, parsed.error);
      }
      const body = parsed.data;

      if (body.visibility === 'everyone' && !isAdmin(req)) {
        return res.status(403).json({
          message: 'Only admins can create views visible to everyone',
          code: 'FORBIDDEN',
        });
      }

      const [created] = await db
        .insert(savedViews)
        .values({
          id: randomUUID(),
          tenantId,
          userId,
          objectType: body.objectType,
          name: body.name,
          description: body.description ?? null,
          filterDefinition: body.filterDefinition ?? [],
          sortConfig: body.sortConfig ?? null,
          columnConfig: body.columnConfig ?? null,
          boardConfig: body.boardConfig ?? null,
          visibility: body.visibility ?? 'private',
          isDefault: body.isDefault ?? false,
          isSystem: false,
        })
        .returning();

      return res.status(201).json(created);
    } catch (error) {
      log.error({ err: error }, 'Failed to create saved view');
      return res.status(500).json({ message: 'Failed to create saved view' });
    }
  });

  /**
   * PUT /api/saved-views/:id
   * Update a view. Only the owner or an admin may update.
   */
  app.put('/api/saved-views/:id', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const parsed = updateSavedViewBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return validationError(res, parsed.error);
      }
      const body = parsed.data;

      const view = await getViewForTenant(req.params.id, tenantId);
      if (!view || !canAccessView(view, userId)) {
        return res.status(404).json({ message: 'Saved view not found' });
      }
      if (!canManageView(view, userId, isAdmin(req))) {
        return res.status(403).json({
          message: 'Only the view owner or an admin can update this view',
          code: 'FORBIDDEN',
        });
      }
      if (body.visibility === 'everyone' && view.visibility !== 'everyone' && !isAdmin(req)) {
        return res.status(403).json({
          message: 'Only admins can share views with everyone',
          code: 'FORBIDDEN',
        });
      }

      const [updated] = await db
        .update(savedViews)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.filterDefinition !== undefined && { filterDefinition: body.filterDefinition }),
          ...(body.sortConfig !== undefined && { sortConfig: body.sortConfig }),
          ...(body.columnConfig !== undefined && { columnConfig: body.columnConfig }),
          ...(body.boardConfig !== undefined && { boardConfig: body.boardConfig }),
          ...(body.visibility !== undefined && { visibility: body.visibility }),
          ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
          updatedAt: new Date(),
        })
        .where(and(eq(savedViews.id, view.id), eq(savedViews.tenantId, tenantId)))
        .returning();

      return res.json(updated);
    } catch (error) {
      log.error({ err: error }, 'Failed to update saved view');
      return res.status(500).json({ message: 'Failed to update saved view' });
    }
  });

  /**
   * DELETE /api/saved-views/:id
   * Delete a view. Only owner or admin; system default views cannot be deleted.
   */
  app.delete('/api/saved-views/:id', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const view = await getViewForTenant(req.params.id, tenantId);
      if (!view || !canAccessView(view, userId)) {
        return res.status(404).json({ message: 'Saved view not found' });
      }
      if (view.isSystem) {
        return res.status(400).json({
          message: 'System default views cannot be deleted',
          code: 'SYSTEM_VIEW',
        });
      }
      if (!canManageView(view, userId, isAdmin(req))) {
        return res.status(403).json({
          message: 'Only the view owner or an admin can delete this view',
          code: 'FORBIDDEN',
        });
      }

      await db.delete(savedViewPins).where(eq(savedViewPins.viewId, view.id));
      await db
        .delete(savedViews)
        .where(and(eq(savedViews.id, view.id), eq(savedViews.tenantId, tenantId)));

      return res.json({ success: true });
    } catch (error) {
      log.error({ err: error }, 'Failed to delete saved view');
      return res.status(500).json({ message: 'Failed to delete saved view' });
    }
  });

  /**
   * POST /api/saved-views/:id/clone
   * Duplicate an accessible view as a private view owned by the current user.
   */
  app.post('/api/saved-views/:id/clone', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const view = await getViewForTenant(req.params.id, tenantId);
      if (!view || !canAccessView(view, userId)) {
        return res.status(404).json({ message: 'Saved view not found' });
      }

      const name =
        typeof req.body?.name === 'string' && req.body.name.trim()
          ? req.body.name.trim().slice(0, 100)
          : `${view.name} (copy)`.slice(0, 100);

      const [clone] = await db
        .insert(savedViews)
        .values({
          id: randomUUID(),
          tenantId,
          userId,
          objectType: view.objectType,
          name,
          description: view.description,
          filterDefinition: view.filterDefinition,
          sortConfig: view.sortConfig,
          columnConfig: view.columnConfig,
          boardConfig: view.boardConfig,
          visibility: 'private',
          isDefault: false,
          isSystem: false,
        })
        .returning();

      return res.status(201).json(clone);
    } catch (error) {
      log.error({ err: error }, 'Failed to clone saved view');
      return res.status(500).json({ message: 'Failed to clone saved view' });
    }
  });

  /**
   * PUT /api/saved-views/:id/pin
   * Pin a view as a tab for the current user. Optional body: { sortOrder }.
   */
  app.put('/api/saved-views/:id/pin', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const view = await getViewForTenant(req.params.id, tenantId);
      if (!view || !canAccessView(view, userId)) {
        return res.status(404).json({ message: 'Saved view not found' });
      }

      const sortOrder = Number.isInteger(req.body?.sortOrder) ? req.body.sortOrder : 0;

      const [existing] = await db
        .select()
        .from(savedViewPins)
        .where(and(eq(savedViewPins.userId, userId), eq(savedViewPins.viewId, view.id)))
        .limit(1);

      if (existing) {
        await db.update(savedViewPins).set({ sortOrder }).where(eq(savedViewPins.id, existing.id));
      } else {
        await db.insert(savedViewPins).values({
          id: randomUUID(),
          userId,
          viewId: view.id,
          sortOrder,
        });
      }

      return res.json({ success: true, viewId: view.id, sortOrder });
    } catch (error) {
      log.error({ err: error }, 'Failed to pin saved view');
      return res.status(500).json({ message: 'Failed to pin saved view' });
    }
  });

  /**
   * PUT /api/saved-views/:id/unpin
   * Remove a view from the current user's pinned tabs.
   */
  app.put('/api/saved-views/:id/unpin', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const view = await getViewForTenant(req.params.id, tenantId);
      if (!view) {
        return res.status(404).json({ message: 'Saved view not found' });
      }

      await db
        .delete(savedViewPins)
        .where(and(eq(savedViewPins.userId, userId), eq(savedViewPins.viewId, view.id)));

      return res.json({ success: true, viewId: view.id });
    } catch (error) {
      log.error({ err: error }, 'Failed to unpin saved view');
      return res.status(500).json({ message: 'Failed to unpin saved view' });
    }
  });
}
