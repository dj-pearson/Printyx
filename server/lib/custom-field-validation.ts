/**
 * Custom field value validation (CRMX-003).
 *
 * Object write paths call validateCustomFieldValues to enforce required and
 * typed custom fields before persisting an object's `customFields` jsonb
 * column, keyed by definition.key.
 *
 * This lived in server/routes-custom-fields.ts until PROD-008b retired that
 * module: /api/custom-fields is proxied to supabase/functions/custom-fields/,
 * so every handler in it was shadowed. The validator was NOT — it is called
 * in-process by routes-business-records.ts and would have died silently with
 * the routes around it. It belongs in lib/ regardless.
 */
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  customFieldDefinitions,
  type CustomFieldDefinition,
  type CustomFieldObjectType,
} from '@shared/schema';

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
