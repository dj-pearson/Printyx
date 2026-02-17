/**
 * Record Layout Config API Routes
 * CRUD endpoints for configurable record page layouts per object type.
 * Part of CRM-008: Configurable record page layout engine.
 */
import type { Express, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { recordLayoutConfigs } from '@shared/schema';

const log = createModuleLogger('routes-record-layout');

export function registerRecordLayoutRoutes(app: Express) {
  // GET /api/record-layout-config
  app.get('/api/record-layout-config', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const objectType = req.query.objectType as string;
      if (!objectType) {
        return res.status(400).json({ message: 'objectType query parameter is required' });
      }

      const configs = await db
        .select()
        .from(recordLayoutConfigs)
        .where(
          and(
            eq(recordLayoutConfigs.tenantId, tenantId),
            eq(recordLayoutConfigs.objectType, objectType as any),
          ),
        );

      // Return role-specific config or default (roleId = null)
      const roleId = req.query.roleId as string | undefined;
      const roleConfig = roleId ? configs.find((c) => c.roleId === roleId) : null;
      const defaultConfig = configs.find((c) => !c.roleId);

      res.json(roleConfig ?? defaultConfig ?? null);
    } catch (error: any) {
      log.error('Failed to fetch record layout config:', error);
      res.status(500).json({ message: 'Failed to fetch record layout config' });
    }
  });

  // PUT /api/record-layout-config
  app.put('/api/record-layout-config', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const schema = z.object({
        objectType: z.enum(['deals', 'leads', 'contacts', 'companies', 'opportunities']),
        roleId: z.string().optional(),
        layoutSections: z.array(z.object({
          sectionId: z.string(),
          title: z.string(),
          position: z.enum(['header', 'left', 'center', 'right']),
          order: z.number(),
          propertyFields: z.array(z.object({
            field: z.string(),
            label: z.string(),
            editable: z.boolean(),
          })),
          collapsed: z.boolean(),
        })),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      // Upsert: find existing and update, or create new
      const existing = await db
        .select()
        .from(recordLayoutConfigs)
        .where(
          and(
            eq(recordLayoutConfigs.tenantId, tenantId),
            eq(recordLayoutConfigs.objectType, parsed.data.objectType),
          ),
        );

      const match = existing.find((c) =>
        (parsed.data.roleId ? c.roleId === parsed.data.roleId : !c.roleId),
      );

      if (match) {
        const [updated] = await db
          .update(recordLayoutConfigs)
          .set({
            layoutSections: parsed.data.layoutSections as any,
            updatedAt: new Date(),
          })
          .where(eq(recordLayoutConfigs.id, match.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db
          .insert(recordLayoutConfigs)
          .values({
            tenantId,
            objectType: parsed.data.objectType,
            roleId: parsed.data.roleId ?? null,
            layoutSections: parsed.data.layoutSections as any,
          })
          .returning();
        res.status(201).json(created);
      }
    } catch (error: any) {
      log.error('Failed to update record layout config:', error);
      res.status(500).json({ message: 'Failed to update record layout config' });
    }
  });

  log.info('✅ Record Layout Config routes registered');
}
