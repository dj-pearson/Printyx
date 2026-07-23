/**
 * PA-035 — regression guard: insert schemas used with `.parse(req.body)` must
 * NOT require server-injected NOT NULL columns (tenantId / createdBy).
 *
 * The bug (same class as the meter-readings 500): a route does
 *   const data = insertXSchema.parse(req.body);
 *   db.insert(x).values({ ...data, tenantId, createdBy });   // injected here
 * but insertXSchema (from createInsertSchema) makes tenantId/createdBy REQUIRED
 * because those columns are NOT NULL. The client never sends them, so
 * .parse(req.body) throws before the injection ever runs — every create 500s.
 *
 * The fix is `.omit({ tenantId: true[, createdBy: true] })` before .parse. These
 * tests assert, on the REAL schemas, that (a) the base schema required the field
 * and (b) the omit removes it, so a client body without it parses cleanly.
 */
import { describe, it, expect } from 'vitest';
import type { AnyZodObject, ZodIssue } from 'zod';
import {
  insertKnowledgeCategorySchema,
  insertKnowledgeArticleSchema,
  insertArticleFeedbackSchema,
  insertManufacturerIntegrationSchema,
  insertPhoneInTicketSchema,
  insertWarehouseKittingOperationSchema,
} from '@shared/schema';

const cases: Array<{ name: string; schema: AnyZodObject; omit: Record<string, true> }> = [
  {
    name: 'insertKnowledgeCategorySchema',
    schema: insertKnowledgeCategorySchema,
    omit: { tenantId: true, createdBy: true },
  },
  {
    name: 'insertKnowledgeArticleSchema',
    schema: insertKnowledgeArticleSchema,
    omit: { tenantId: true, createdBy: true },
  },
  {
    name: 'insertArticleFeedbackSchema',
    schema: insertArticleFeedbackSchema,
    omit: { tenantId: true },
  },
  {
    name: 'insertManufacturerIntegrationSchema',
    schema: insertManufacturerIntegrationSchema,
    omit: { tenantId: true },
  },
  {
    name: 'insertPhoneInTicketSchema',
    schema: insertPhoneInTicketSchema,
    omit: { tenantId: true },
  },
  {
    name: 'insertWarehouseKittingOperationSchema',
    schema: insertWarehouseKittingOperationSchema,
    omit: { tenantId: true },
  },
];

describe('PA-035: server-injected columns are omitted from insert-parse schemas', () => {
  for (const { name, schema, omit } of cases) {
    describe(name, () => {
      const omitted = schema.omit(omit);

      for (const field of Object.keys(omit)) {
        it(`base schema exposes '${field}' (createInsertSchema included the NOT NULL column)`, () => {
          expect(schema.shape).toHaveProperty(field);
        });

        it(`omit removes '${field}' from the parse contract`, () => {
          expect(omitted.shape).not.toHaveProperty(field);
        });

        it(`parsing an empty object no longer reports a '${field}' issue after omit`, () => {
          const base = schema.safeParse({});
          const after = omitted.safeParse({});
          const baseHasField =
            !base.success && base.error.issues.some((i: ZodIssue) => i.path[0] === field);
          const afterHasField =
            !after.success && after.error.issues.some((i: ZodIssue) => i.path[0] === field);
          // The base required it (the bug); after omit it is no longer demanded.
          expect(baseHasField).toBe(true);
          expect(afterHasField).toBe(false);
        });
      }
    });
  }
});
