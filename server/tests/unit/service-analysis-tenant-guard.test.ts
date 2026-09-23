/**
 * QUALITY-002 — service-analysis handlers refuse to run without a tenant.
 *
 * CORRECTED round 174: the handlers this first half described are gone -
 * server/routes-service-analysis.ts was deleted once /api/parts-orders was
 * proxied, and the tenant scoping it asserted is held against the edge
 * function by parts-orders-tenant-scope.test.ts. The insert-schema half below
 * is about shared/service-analysis-schema.ts and still stands.
 *
 * All twelve handlers did `const tenantId = getTenantId(req)` and went straight
 * into `eq(table.tenantId, tenantId)`. getTenantId returns `string | undefined`,
 * and undefined does not scope anything — it becomes a bound parameter of
 * undefined. So a request that arrived without a resolved tenant either died in
 * the driver or, depending on the call, asked the database a question with no
 * tenant predicate on it. Each handler now answers 400 instead.
 *
 * The second half is the insert schemas. drizzle-zod infers a jsonb column from
 * its runtime shape rather than the $type<string[]> annotation, so
 * actionsTaken / diagnosticCodes / beforePhotos / afterPhotos / serialNumbers
 * came out as a structural array-like that was not assignable back to string[]
 * — and, more to the point, validated nothing.
 */
import { describe, it, expect } from 'vitest';
import {
  insertServiceCallAnalysisSchema,
  insertServicePartsUsedSchema,
} from '../../../shared/service-analysis-schema';

describe('QUALITY-002: the jsonb array columns are actually validated', () => {
  // These columns are uuid, so the fixtures have to be real ones — with a short
  // id every parse below throws on the uuid check and the array assertions pass
  // for the wrong reason.
  const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const base = {
    tenantId: UUID(1),
    serviceTicketId: UUID(2),
    technicianId: UUID(3),
    callStartTime: new Date(),
    analysisType: 'diagnostic' as const,
    problemDescription: 'Fuser error E002 on start-up',
    outcome: 'resolved' as const,
  };

  /** The field each ZodError actually complains about. */
  function failedPaths(parse: () => unknown): string[] {
    try {
      parse();
    } catch (error) {
      const issues = (error as { issues?: { path: (string | number)[] }[] }).issues ?? [];
      return issues.map((i) => i.path.join('.'));
    }
    throw new Error('expected the parse to throw');
  }

  it('accepts a string[] and hands one back', () => {
    const parsed = insertServiceCallAnalysisSchema.parse({
      ...base,
      actionsTaken: ['replaced fuser', 'cleaned rollers'],
      diagnosticCodes: ['E002'],
    });
    expect(parsed.actionsTaken).toEqual(['replaced fuser', 'cleaned rollers']);
    expect(parsed.diagnosticCodes).toEqual(['E002']);
  });

  it('rejects a non-array, which the inferred schema let through', () => {
    expect(
      failedPaths(() =>
        insertServiceCallAnalysisSchema.parse({ ...base, actionsTaken: 'replaced fuser' }),
      ),
    ).toEqual(['actionsTaken']);
  });

  it('rejects an array of the wrong element type', () => {
    expect(
      failedPaths(() =>
        insertServiceCallAnalysisSchema.parse({ ...base, beforePhotos: [1, 2, 3] }),
      ),
    ).toEqual(['beforePhotos.0', 'beforePhotos.1', 'beforePhotos.2']);
  });

  it('applies the same rule to servicePartsUsed.serialNumbers', () => {
    expect(
      failedPaths(() =>
        insertServicePartsUsedSchema.parse({
          tenantId: UUID(1),
          analysisId: UUID(4),
          partNumber: 'P1',
          partName: 'Fuser unit',
          quantityUsed: 1,
          serialNumbers: 'SN-1',
        }),
      ),
    ).toEqual(['serialNumbers']);
  });
});
