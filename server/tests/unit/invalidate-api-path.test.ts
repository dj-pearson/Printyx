import { describe, expect, it } from 'vitest';

/**
 * invalidateApiPath's matching rule, tested in isolation from the QueryClient.
 *
 * The rule exists because TanStack compares a queryKey filter element by
 * element, and element 0 in this app is a whole URL. So a filter of
 * ['/api/rbac'] misses a query keyed ['/api/rbac/roles'] entirely - the
 * mutation reports success and the list on screen never refetches. Four
 * mutations on SalesRepAssignments and the RBAC initialiser shipped that way.
 */
function matches(firstKey: unknown, prefix: string): boolean {
  if (typeof firstKey !== 'string') return false;
  return (
    firstKey === prefix || firstKey.startsWith(`${prefix}/`) || firstKey.startsWith(`${prefix}?`)
  );
}

describe('invalidateApiPath matching', () => {
  it('matches the prefix itself', () => {
    expect(matches('/api/rbac', '/api/rbac')).toBe(true);
  });

  it('matches a sub-path, which an exact key filter does not', () => {
    expect(matches('/api/rbac/roles', '/api/rbac')).toBe(true);
    expect(matches('/api/sales-rep-assignments/reps', '/api/sales-rep-assignments')).toBe(true);
  });

  it('matches a key carrying a query string', () => {
    expect(
      matches('/api/contract-renewal/expiring?days=90', '/api/contract-renewal/expiring'),
    ).toBe(true);
    expect(matches('/api/deal-desk/requests?status=pending', '/api/deal-desk/requests')).toBe(true);
  });

  it('does not match a sibling that merely shares a string prefix', () => {
    // /api/deals must not be swept away by an invalidation of /api/deal
    expect(matches('/api/deals', '/api/deal')).toBe(false);
    expect(matches('/api/rbac-audit', '/api/rbac')).toBe(false);
  });

  it('ignores non-string key elements', () => {
    expect(matches({ page: 1 }, '/api/rbac')).toBe(false);
    expect(matches(undefined, '/api/rbac')).toBe(false);
  });
});
