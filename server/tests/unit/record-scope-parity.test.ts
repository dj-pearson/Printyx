/**
 * WF-R-05: the client's scope ladder matches the server's.
 *
 * client/src/lib/record-scope.ts decides what the list-page toggle OFFERS, and
 * supabase/functions/_shared/scope.ts decides what the server actually grants. The
 * server clamps regardless, so a drift between them is not a security hole - it is
 * a toggle that silently does nothing, which is worse to diagnose. These lock the
 * two together.
 */

import { describe, it, expect } from 'vitest';
import * as client from '../../../client/src/lib/record-scope';
import {
  availableTiers as serverAvailableTiers,
  requestedTier,
  SCOPE_TIERS as SERVER_TIERS,
  tierForLevel as serverTierForLevel,
} from '../../../supabase/functions/_shared/scope';

describe('WF-R-05: client and server agree on the ladder', () => {
  it('lists the same tiers in the same order', () => {
    expect([...client.SCOPE_TIERS]).toEqual([...SERVER_TIERS]);
  });

  it('maps every level to the same tier', () => {
    for (let level = 1; level <= 8; level++) {
      expect(client.tierForLevel(level), `level ${level}`).toBe(serverTierForLevel(level));
    }
  });

  it('offers exactly the tiers the server would grant', () => {
    for (let level = 1; level <= 8; level++) {
      expect(client.availableTiers(level), `level ${level}`).toEqual(
        serverAvailableTiers({ roleLevel: level }),
      );
    }
  });

  it('never defaults to a tier the caller does not hold', () => {
    for (let level = 1; level <= 8; level++) {
      expect(client.availableTiers(level)).toContain(client.defaultTier(level));
    }
    expect(client.defaultTier(1)).toBe('own');
    expect(client.defaultTier(4)).toBe('team');
    expect(client.defaultTier(7)).toBe('company');
  });

  it('gives every tier a label', () => {
    for (const tier of client.SCOPE_TIERS) {
      expect(client.tierLabel(tier), tier).toBeTruthy();
    }
  });
});

describe('WF-R-05: ?scope= can only narrow', () => {
  it('honours a narrower request', () => {
    expect(requestedTier({ roleLevel: 7 }, 'own')).toBe('own');
    expect(requestedTier({ roleLevel: 7 }, 'team')).toBe('team');
  });

  it('refuses a wider one, however it is spelled', () => {
    expect(requestedTier({ roleLevel: 1 }, 'company')).toBe('own');
    expect(requestedTier({ roleLevel: 1 }, 'PLATFORM')).toBe('own');
    expect(requestedTier({ roleLevel: 4 }, 'regional')).toBe('team');
  });

  it('ignores a value that is not a tier', () => {
    expect(requestedTier({ roleLevel: 4 }, 'everything')).toBe('team');
    expect(requestedTier({ roleLevel: 4 }, null)).toBe('team');
    expect(requestedTier({ roleLevel: 4 }, '')).toBe('team');
  });

  it('applies the metadata claim and the query param together, both narrowing', () => {
    expect(requestedTier({ roleLevel: 7, accessScope: 'location' }, 'own')).toBe('own');
    // The claim narrows to location; the param asking to widen back is ignored.
    expect(requestedTier({ roleLevel: 7, accessScope: 'location' }, 'company')).toBe('location');
  });
});
