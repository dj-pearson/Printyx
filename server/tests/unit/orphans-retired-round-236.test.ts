/**
 * Round 236: five orphaned files, each carrying type errors, were deleted.
 * None had an importer. rbacQueryClient configured TanStack v4 options
 * (`cacheTime`, a query-level `onError`) that v5 ignores, so even mounted its
 * permission toasts would never have fired; billing-analytics-service and
 * pdf-generation-service are named as replaced by the billing edge function;
 * routes-intelligent-alerts and routes-security-compliance were mounted by
 * nothing. intelligent-alerts-service is kept: its containment actions have
 * their own test.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

const GONE = [
  'client/src/lib/rbacQueryClient.ts',
  'server/services/billing-analytics-service.ts',
  'server/services/pdf-generation-service.ts',
  'server/routes-intelligent-alerts.ts',
  'server/routes-security-compliance.ts',
];

describe('round 236 orphan retirement', () => {
  it.each(GONE)('%s stays deleted', (f) => {
    expect(existsSync(f)).toBe(false);
  });

  it('the billing edge function still carries the replacements it names', () => {
    expect(readFileSync('supabase/functions/billing/_pdf.ts', 'utf8')).toMatch(
      /Replaces server\/services\/pdf-generation-service\.ts/,
    );
    expect(existsSync('supabase/functions/billing/handlers/analytics-extra.ts')).toBe(true);
  });

  it('keeps the intelligent-alerts service its own test covers', () => {
    expect(existsSync('server/services/intelligent-alerts-service.ts')).toBe(true);
  });
});
