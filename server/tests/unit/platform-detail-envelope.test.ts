import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The platform CRM list endpoints answer with an ENVELOPE - { deals, pagination },
 * { activities, pagination }, { healthScores, pagination } - while the contacts
 * endpoint next door returns a bare array. Both conventions live in the same
 * feature.
 *
 * PlatformBusinessRecordDetail and PlatformDealDetail were typed and read as if
 * every one returned an array. `deals.length` on an object is undefined,
 * `undefined > 0` is false, so the Deals, Activities and Health tabs rendered
 * their empty states no matter how much data the tenant had. Nothing threw and
 * nothing logged - the page looked like a record with no history.
 *
 * QUERYKEY-001 fixed the URLs these ask for and added the businessRecordId
 * filter server-side. The shape was a second layer underneath and stayed broken,
 * which is why this test asserts the two halves agree rather than just that the
 * page compiles.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const RECORD_DETAIL = strip(
  readFileSync('client/src/pages/PlatformBusinessRecordDetail.tsx', 'utf8'),
);
const DEAL_DETAIL = strip(readFileSync('client/src/pages/PlatformDealDetail.tsx', 'utf8'));
const DEALS_FN = strip(readFileSync('supabase/functions/platform-deals/index.ts', 'utf8'));
const ACTIVITIES_FN = strip(
  readFileSync('supabase/functions/platform-activities/index.ts', 'utf8'),
);
const CS_FN = strip(readFileSync('supabase/functions/platform-cs/index.ts', 'utf8'));

describe('platform detail pages read the shape their endpoints send', () => {
  it('the endpoints still answer with an envelope', () => {
    // If one of these ever returns a bare array the page must change with it,
    // which is the whole point of asserting both sides here.
    expect(DEALS_FN).toMatch(/deals:\s*deals\s*\|\|\s*\[\]/);
    expect(ACTIVITIES_FN).toMatch(/activities:\s*activities\s*\|\|\s*\[\]/);
    expect(CS_FN).toMatch(/healthScores:/);
  });

  it('the record detail page reads the named keys, not the response itself', () => {
    expect(RECORD_DETAIL).toMatch(/useQuery<\{\s*deals:\s*Deal\[\]\s*\}>/);
    expect(RECORD_DETAIL).toMatch(/useQuery<\{\s*activities:\s*ActivityItem\[\]\s*\}>/);
    expect(RECORD_DETAIL).toContain('dealsResponse?.deals');
    expect(RECORD_DETAIL).toContain('activitiesResponse?.activities');
    expect(RECORD_DETAIL).toContain('healthResponse?.healthScores');
  });

  it('the deal detail page reads the named key', () => {
    expect(DEAL_DETAIL).toMatch(/useQuery<\{\s*activities:\s*ActivityItem\[\]\s*\}>/);
    expect(DEAL_DETAIL).toContain('activitiesResponse?.activities');
  });

  it('never types a platform list query as a bare array again', () => {
    for (const src of [RECORD_DETAIL, DEAL_DETAIL]) {
      expect(src).not.toMatch(/useQuery<Deal\[\]>/);
      expect(src).not.toMatch(/useQuery<ActivityItem\[\]>/);
    }
  });

  it('contacts stays a bare array - the two conventions really do coexist', () => {
    expect(RECORD_DETAIL).toMatch(/useQuery<Contact\[\]>/);
  });
});
