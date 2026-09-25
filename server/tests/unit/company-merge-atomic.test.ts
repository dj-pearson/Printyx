/**
 * Round 246: mergeCompanies moved every contact and activity to the survivor,
 * then logged merge history with column names contact_merge_history does not
 * have and without its required entity_type / surviving_record_id /
 * merged_record_id. The insert always failed - after the moves and before the
 * duplicates were deleted, outside any transaction - so a merge left the
 * duplicates in place with their records moved away. merged_by is also a NOT
 * NULL uuid, and the CLI defaulted it to 'cli-user'.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { getTableConfig } from 'drizzle-orm/pg-core';

const touched: string[] = [];
vi.mock('../../db', () => ({
  db: new Proxy(
    {},
    {
      get: (_t, k) => {
        touched.push(String(k));
        throw new Error('db used');
      },
    },
  ),
}));
const { mergeCompanies } = await import('../../services/company-deduplication-service');
const { contactMergeHistory } = await import('../../../shared/gdpr-core-schema');

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const SRC = strip(readFileSync('server/services/company-deduplication-service.ts', 'utf8'));
const fn = SRC.slice(
  SRC.indexOf('export async function mergeCompanies'),
  SRC.indexOf('export async function runDeduplication'),
);

describe('mergeCompanies', () => {
  it('refuses a merge with no user uuid before touching the database', async () => {
    for (const who of [undefined, 'system', 'cli-user']) {
      const r = await mergeCompanies('s', ['d'], 't', who);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/uuid/);
    }
    expect(touched).toEqual([]);
  });

  it('does every write inside one transaction', () => {
    const tx = fn.slice(fn.indexOf('db.transaction('));
    expect(fn.indexOf('db.transaction(')).toBeGreaterThan(-1);
    for (const w of [
      '.update(companyContacts)',
      '.update(businessRecordActivities)',
      '.update(enhancedContacts)',
      '.insert(contactMergeHistory)',
      '.delete(companies)',
    ]) {
      expect(tx, w).toContain(w);
    }
    expect(tx).not.toMatch(/await db\s*\.\s*(update|insert|delete)\b/);
  });

  it('logs history with real columns, every required one supplied', () => {
    const camel = (n: string) => n.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const cols = getTableConfig(contactMergeHistory).columns;
    const known = new Set(cols.map((c) => camel(c.name)));
    const required = cols.filter((c) => c.notNull && !c.hasDefault).map((c) => camel(c.name));
    const payload = fn.slice(
      fn.indexOf('.insert(contactMergeHistory).values({'),
      fn.indexOf('.delete(companies)'),
    );
    const keys = [...payload.matchAll(/^\s{8,12}([a-zA-Z]+)[:,]/gm)].map((m) => m[1]);
    expect(keys.filter((k) => !known.has(k))).toEqual([]);
    for (const r of required) expect(keys, r).toContain(r);
  });

  it('the CLI no longer defaults the merging user', () => {
    const cli = readFileSync('server/cli/company-dedup-cli.ts', 'utf8');
    expect(cli).not.toMatch(/'cli-user'\)/);
    expect(cli).toMatch(/requiredOption\('-u, --user <id>'/);
  });
});
