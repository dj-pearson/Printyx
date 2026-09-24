/**
 * Round 245: updateServiceRequestStatus logged its activity with
 * activityType / relatedEntityType / relatedEntityId - none of them columns of
 * customer_portal_activity_log. Drizzle drops unknown keys, so the NOT NULL
 * `action` went in empty, the insert failed, and the transaction rolled back
 * the status update it was logging.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { customerPortalActivityLog } from '../../../shared/customer-portal-schema';

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const columns = getTableConfig(customerPortalActivityLog).columns;
const known = new Set(columns.map((c) => camel(c.name)));
const required = columns.filter((c) => c.notNull && !c.hasDefault).map((c) => camel(c.name));

const src = readFileSync('server/services/customer-portal-service.ts', 'utf8');
const payloads = [
  ...src.matchAll(/insert\(customerPortalActivityLog\)\.values\(\{([\s\S]*?)\}\);/g),
].map((m) => m[1]);
const keysOf = (body: string) => [...body.matchAll(/^\s*([a-zA-Z]+)\s*[:,]/gm)].map((m) => m[1]);

describe('customer_portal_activity_log inserts', () => {
  it('finds the inserts', () => {
    expect(payloads.length).toBeGreaterThanOrEqual(2);
  });

  it('name only real columns and supply every required one', () => {
    for (const body of payloads) {
      const keys = keysOf(body);
      expect(
        keys.filter((k) => !known.has(k)),
        body,
      ).toEqual([]);
      for (const r of required) expect(keys, `${r} in ${body}`).toContain(r);
    }
  });
});
