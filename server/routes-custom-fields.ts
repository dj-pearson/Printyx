/**
 * Custom Fields API Routes (CRMX-003)
 *
 * CRUD over custom_field_definitions plus a shared validator that object write
 * paths call to enforce required/typed custom fields. Values themselves live on
 * each object's `customFields` jsonb column, keyed by definition.key.
 */
import type { Express, Request, Response } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import {
  customFieldDefinitions,
  insertCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
  CUSTOM_FIELD_OBJECT_TYPES,
  type CustomFieldDefinition,
  type CustomFieldObjectType,
} from '@shared/schema';

const log = createModuleLogger('routes-custom-fields');

function isValidObjectType(v: unknown): v is CustomFieldObjectType {
  return typeof v === 'string' && (CUSTOM_FIELD_OBJECT_TYPES as readonly string[]).includes(v);
}

/**
 * Validate & normalize a `customFields` payload against active definitions for an
 * object type. Returns the cleaned value map (only known keys, coerced by type).
 * Throws { status, message, details } on validation failure. Call this from the
 * object write paths (deals/leads/contacts/companies POST/PATCH) — CRMX-004 wires
 * the UI, this guards the data.
 */
export async function validateCustomFieldValues(
  tenantId: string,
  objectType: CustomFieldObjectType,
  values: Record<string, unknown> | null | undefined,
): Promise<Record<string, unknown>> {
  const defs = await db
    .select()
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.tenantId, tenantId),
        eq(customFieldDefinitions.objectType, objectType),
        eq(customFieldDefinitions.isActive, true),
      ),
    );

  const input = values ?? {};
  const cleaned: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const def of defs) {
    const raw = input[def.key];
    const provided = raw !== undefined && raw !== null && raw !== '';

    if (!provided) {
      if (def.required) errors[def.key] = `${def.label} is required`;
      else if (def.defaultValue != null && def.defaultValue !== '')
        cleaned[def.key] = coerce(def, def.defaultValue, errors);
      continue;
    }
    cleaned[def.key] = coerce(def, raw, errors);
  }

  if (Object.keys(errors).length > 0) {
    throw { status: 400, message: 'Custom field validation failed', details: errors };
  }
  return cleaned;
}

function coerce(def: CustomFieldDefinition, raw: unknown, errors: Record<string, string>): unknown {
  switch (def.fieldType) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(n)) errors[def.key] = `${def.label} must be a number`;
      return n;
    }
    case 'boolean':
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    case 'date': {
      const d = new Date(raw as string);
      if (Number.isNaN(d.getTime())) errors[def.key] = `${def.label} must be a valid date`;
      return raw;
    }
    case 'email': {
      const ok = z.string().email().safeParse(raw).success;
      if (!ok) errors[def.key] = `${def.label} must be a valid email`;
      return raw;
    }
    case 'url': {
      const ok = z.string().url().safeParse(raw).success;
      if (!ok) errors[def.key] = `${def.label} must be a valid URL`;
      return raw;
    }
    case 'select': {
      const allowed = (def.options ?? []).map((o) => o.value);
      if (allowed.length && !allowed.includes(String(raw)))
        errors[def.key] = `${def.label} must be one of the allowed options`;
      return raw;
    }
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw : [raw];
      const allowed = (def.options ?? []).map((o) => o.value);
      if (allowed.length && !arr.every((v) => allowed.includes(String(v))))
        errors[def.key] = `${def.label} contains a value not in the allowed options`;
      return arr;
    }
    default: // text
      return String(raw);
  }
}

export function registerCustomFieldsRoutes(app: Express) {
  // ─── GET /api/custom-fields?objectType=deals ───────────────────────
  app.get('/api/custom-fields', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const objectType = req.query.objectType as string | undefined;
      const includeInactive = req.query.includeInactive === 'true';

      const conditions = [eq(customFieldDefinitions.tenantId, tenantId)];
      if (objectType) {
        if (!isValidObjectType(objectType)) {
          return res.status(400).json({
            message: `Invalid objectType. Must be one of: ${CUSTOM_FIELD_OBJECT_TYPES.join(', ')}`,
          });
        }
        conditions.push(eq(customFieldDefinitions.objectType, objectType));
      }
      if (!includeInactive) conditions.push(eq(customFieldDefinitions.isActive, true));

      const rows = await db
        .select()
        .from(customFieldDefinitions)
        .where(and(...conditions))
        .orderBy(asc(customFieldDefinitions.sortOrder), asc(customFieldDefinitions.createdAt));

      res.json({ data: rows, total: rows.length });
    } catch (error: any) {
      log.error('Failed to list custom fields:', error);
      res.status(500).json({ message: 'Failed to list custom fields', error: error?.message });
    }
  });

  // ─── POST /api/custom-fields ───────────────────────────────────────
  app.post('/api/custom-fields', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = insertCustomFieldDefinitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: 'Invalid custom field', details: parsed.error.flatten() });
      }

      // select/multiselect must ship options.
      if (
        (parsed.data.fieldType === 'select' || parsed.data.fieldType === 'multiselect') &&
        (!parsed.data.options || parsed.data.options.length === 0)
      ) {
        return res
          .status(400)
          .json({ message: 'select/multiselect fields require at least one option' });
      }

      const [created] = await db
        .insert(customFieldDefinitions)
        .values({ ...parsed.data, tenantId, createdBy: userId ?? null })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res
          .status(409)
          .json({ message: 'A field with this key already exists for this object type' });
      }
      log.error('Failed to create custom field:', error);
      res.status(500).json({ message: 'Failed to create custom field', error: error?.message });
    }
  });

  // ─── PUT/PATCH /api/custom-fields/:id ──────────────────────────────
  const updateHandler = async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = updateCustomFieldDefinitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid update', details: parsed.error.flatten() });
      }

      const [updated] = await db
        .update(customFieldDefinitions)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(
          and(
            eq(customFieldDefinitions.id, req.params.id),
            eq(customFieldDefinitions.tenantId, tenantId),
          ),
        )
        .returning();

      if (!updated) return res.status(404).json({ message: 'Custom field not found' });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update custom field:', error);
      res.status(500).json({ message: 'Failed to update custom field', error: error?.message });
    }
  };
  app.put('/api/custom-fields/:id', isAuthenticated, updateHandler);
  app.patch('/api/custom-fields/:id', isAuthenticated, updateHandler);

  // ─── DELETE /api/custom-fields/:id (soft delete → isActive=false) ──
  app.delete('/api/custom-fields/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const hard = req.query.hard === 'true';
      if (hard) {
        const [deleted] = await db
          .delete(customFieldDefinitions)
          .where(
            and(
              eq(customFieldDefinitions.id, req.params.id),
              eq(customFieldDefinitions.tenantId, tenantId),
            ),
          )
          .returning();
        if (!deleted) return res.status(404).json({ message: 'Custom field not found' });
        return res.json({ success: true, hardDeleted: true });
      }

      const [deactivated] = await db
        .update(customFieldDefinitions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(customFieldDefinitions.id, req.params.id),
            eq(customFieldDefinitions.tenantId, tenantId),
          ),
        )
        .returning();
      if (!deactivated) return res.status(404).json({ message: 'Custom field not found' });
      res.json({ success: true, hardDeleted: false });
    } catch (error: any) {
      log.error('Failed to delete custom field:', error);
      res.status(500).json({ message: 'Failed to delete custom field', error: error?.message });
    }
  });
}
