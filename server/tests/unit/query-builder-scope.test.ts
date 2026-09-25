/**
 * Round 244: getQueryBuilder copied the user context into a new object and
 * spelled territoryScope as `scope`, so HierarchicalQueryBuilder saw an
 * undefined scope and fell to its default - no accessible locations at all.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db', () => ({ db: {} }));
const { getQueryBuilder } = await import('../../middleware/rbac-route-helper');

describe('getQueryBuilder', () => {
  it('hands the builder the territory scope the user actually has', () => {
    const user = {
      id: 'u1',
      tenantId: 't1',
      territoryScope: 'location',
      locationId: 'loc-1',
    };
    const qb = getQueryBuilder({ user } as never);
    expect(qb?.getMinimumScope()).toBe('location');
  });

  it('answers null with no user', () => {
    expect(getQueryBuilder({} as never)).toBeNull();
  });
});
