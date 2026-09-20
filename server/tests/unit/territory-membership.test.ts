/**
 * COP-B09 AC3: reps see their territory by default; managers roll up.
 *
 * Only the roll-up half was built - a manager could read across every
 * territory, and nothing defaulted a rep to their own, so a rep had to know
 * the filter existed and pick their territory out of a list to see their own
 * plays. Doing the other half needs an answer to "which territory is this
 * person's", and `sales_territories` carries three relationships that look
 * like one from a distance.
 *
 * The distinctions are the tests. Conflating `manager_id` with ownership is
 * the defect that would arrive first and would be almost invisible: the more
 * senior the person, the narrower their view, which reads as working.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  resolveTerritoryFilter,
  territoryMembership,
  type TerritoryMembershipRow,
} from '../../../shared/territory-membership';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');

const rows: TerritoryMembershipRow[] = [
  { id: 't-north', ownerId: 'u-dana', teamMembers: ['u-sam'], managerId: 'u-mgr' },
  { id: 't-south', ownerId: 'u-sam', teamMembers: [], managerId: 'u-mgr' },
  { id: 't-west', ownerId: 'u-lee', teamMembers: null, managerId: 'u-dana' },
  { id: 't-retired', ownerId: 'u-dana', teamMembers: [], managerId: 'u-mgr', isActive: false },
  // A territory nobody owns yet. Realistic, and the case that makes the
  // blank-caller guard load-bearing: without it, an empty user id compares
  // equal to this row's empty owner and claims it.
  { id: 't-unowned', ownerId: null, teamMembers: null, managerId: null },
];

describe('territoryMembership', () => {
  it('counts the primary rep as owning their territory', () => {
    const m = territoryMembership(rows, 'u-dana');
    expect(m.owned).toEqual(['t-north']);
    expect(m.defaultTerritoryIds).toContain('t-north');
  });

  it('counts an additional rep listed in team_members', () => {
    const m = territoryMembership(rows, 'u-sam');
    expect(m.owned).toEqual(['t-south']);
    expect(m.member).toEqual(['t-north']);
    expect(m.defaultTerritoryIds.sort()).toEqual(['t-north', 't-south']);
  });

  it('does NOT let a manager relationship narrow the default view', () => {
    // The whole point: a manager over four territories must not open the
    // radar filtered to those four and read it as their own pipeline.
    const m = territoryMembership(rows, 'u-mgr');
    expect(m.managed.sort()).toEqual(['t-north', 't-south']);
    expect(m.defaultTerritoryIds).toEqual([]);
    expect(m.role).toBe('manager');
  });

  it('a selling manager defaults to their own book and can still reach the rest', () => {
    // u-dana owns north and manages west.
    const m = territoryMembership(rows, 'u-dana');
    expect(m.defaultTerritoryIds).toEqual(['t-north']);
    expect(m.allTerritoryIds.sort()).toEqual(['t-north', 't-west']);
    expect(m.role).toBe('both');
  });

  it('an inactive territory binds nobody', () => {
    // t-retired names u-dana as owner; a closed territory must not pin them.
    const m = territoryMembership(rows, 'u-dana');
    expect(m.owned).not.toContain('t-retired');
    expect(m.allTerritoryIds).not.toContain('t-retired');
  });

  it('a person in no territory has no default and no role', () => {
    const m = territoryMembership(rows, 'u-nobody');
    expect(m.defaultTerritoryIds).toEqual([]);
    expect(m.role).toBe('none');
  });

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace'],
  ])('a %s user id matches nothing rather than everything', (userId) => {
    // An anonymous or unresolved caller must not inherit somebody book.
    expect(territoryMembership(rows, userId).allTerritoryIds).toEqual([]);
  });
});

describe('resolveTerritoryFilter', () => {
  const rep = territoryMembership(rows, 'u-dana');
  const manager = territoryMembership(rows, 'u-mgr');
  const nobody = territoryMembership(rows, 'u-nobody');

  it('falls back to the rep own territories when nothing is asked for', () => {
    expect(resolveTerritoryFilter(null, rep)).toEqual({
      territoryIds: ['t-north'],
      source: 'default',
    });
  });

  it('lets an explicit request win, so nobody is trapped in a default', () => {
    expect(resolveTerritoryFilter('t-west', rep)).toEqual({
      territoryIds: ['t-west'],
      source: 'requested',
    });
  });

  it("treats 'all' as the roll-up, not as a territory named all", () => {
    expect(resolveTerritoryFilter('all', rep)).toEqual({ territoryIds: null, source: 'requested' });
  });

  it('does NOT narrow a manager or a person with no territory', () => {
    // Filtering to nothing would show an empty board, which reads as "no work"
    // rather than "no territory recorded".
    expect(resolveTerritoryFilter(null, manager).territoryIds).toBeNull();
    expect(resolveTerritoryFilter(null, nobody).territoryIds).toBeNull();
    expect(resolveTerritoryFilter(null, nobody).source).toBe('none');
  });
});

describe('the endpoints use it', () => {
  const territoriesFn = read('supabase/functions/sales-territories/index.ts');
  const radarFn = read('supabase/functions/opportunity-radar/index.ts');

  it('the territories function SELECTS team_members, which it used to omit', () => {
    // Bound to the column list, not the file: the /mine branch below also
    // mentions `team_members` when mapping rows, so a file-wide toContain is
    // satisfied while the select that feeds it has dropped the column. Without
    // it in the SELECT, "whose territory is this" can only ever answer the
    // primary owner and every additional rep resolves to nothing.
    const start = territoriesFn.indexOf('const TERRITORY_COLUMNS');
    expect(start).toBeGreaterThan(-1);
    // COMMENTS STRIPPED FIRST. The declaration carries a comment saying
    // `team_members` was absent from this list, so an unstripped assertion
    // matches its own explanation and passes with the column deleted -
    // caught by mutation testing, and the fifth time this trap has fired in
    // this repo.
    const columnList = territoriesFn
      .slice(start, territoriesFn.indexOf(';', start))
      .replace(/\/\/[^\n]*/g, '');
    expect(columnList).toContain('team_members');
  });

  it('GET /mine is matched before the /:id branch', () => {
    const mineAt = territoriesFn.indexOf("territoryId === 'mine'");
    const idAt = territoriesFn.indexOf("if (req.method === 'GET' && territoryId) {");
    expect(mineAt).toBeGreaterThan(-1);
    // Otherwise 'mine' is read as a uuid and answers 404 (SUPA-024).
    expect(mineAt).toBeLessThan(idAt);
  });

  it('the radar defaults to the caller territory and reports which it used', () => {
    expect(radarFn).toContain('resolveTerritoryFilter(');
    expect(radarFn).toContain('territorySource');
    expect(radarFn).toContain('territoryRole: membership.role');
  });

  it('and matches a play against the resolved SET, not one id', () => {
    // A rep can work two territories; matching one id would drop the other.
    expect(radarFn).toContain('wanted.has(String(resolved.territory.id))');
  });
});
