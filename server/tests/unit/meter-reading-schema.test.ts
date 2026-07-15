import { describe, it, expect } from 'vitest';
import { insertMeterReadingSchema } from '@shared/schema';

/**
 * PA-035 regression guard: creating a meter reading 500'd because the POST
 * handler parsed insertMeterReadingSchema WITHOUT injecting the server-owned
 * NOT NULL `tenant_id` (the schema omits only id/createdAt/updatedAt, so
 * tenantId is required by the parse). The handler now injects tenantId (and
 * createdBy) before parsing. This locks the "tenantId is server-required"
 * contract in without needing a live database.
 */
function missingPaths(input: unknown): string[] {
  const result = insertMeterReadingSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((i) => i.path.join('.'));
}

describe('insertMeterReadingSchema server-injected fields (PA-035)', () => {
  it('requires tenantId — a body without it fails to parse (the original 500 cause)', () => {
    const paths = missingPaths({ equipmentId: 'eq-1', readingDate: new Date() });
    expect(paths).toContain('tenantId');
  });

  it('no longer reports tenantId missing once the handler injects it', () => {
    const withTenant = missingPaths({
      equipmentId: 'eq-1',
      readingDate: new Date(),
      tenantId: 'tenant-1',
    });
    expect(withTenant).not.toContain('tenantId');
  });

  it('accepts an injected createdBy without adding it as a required-field error', () => {
    const paths = missingPaths({
      equipmentId: 'eq-1',
      readingDate: new Date(),
      tenantId: 'tenant-1',
      createdBy: 'user-1',
    });
    expect(paths).not.toContain('tenantId');
    expect(paths).not.toContain('createdBy');
  });
});
