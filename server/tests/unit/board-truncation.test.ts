/**
 * The board was silently short (COP-I01 AC4).
 *
 * EnhancedPipelineBoard asked for `limit: 500`. Every CRM list endpoint caps at
 * `MAX_CRM_PAGE_SIZE` (200) in `_shared/crm-list-query.ts`, so the board got 200
 * rows and believed it had everything: a tenant with 250 deals was missing 50,
 * the per-stage badge on every column was wrong, and the column money totals
 * were computed over a subset. Nothing on screen said so.
 *
 * The endpoint always returned an exact `total`, filtered the same way the rows
 * were. The board threw it away.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOARD_PAGE_SIZE, boardTruncation } from '../../../shared/board-truncation';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const BOARD = read('client/src/components/crm/EnhancedPipelineBoard.tsx');
/** Comments blanked, for absence assertions only. */
const CODE = BOARD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
/**
 * The same source with runs of whitespace collapsed. Prettier decides where a
 * call wraps, so an assertion written against the unwrapped form starts failing
 * the day an argument gets long enough - which is what happened here.
 */
const FLAT = CODE.replace(/\s+/g, ' ');

describe('the client asks for what the server will give', () => {
  it('BOARD_PAGE_SIZE is the server cap, read from the server', () => {
    // A hand-copied constant drifts the day somebody raises the cap. Parse it.
    const spec = read('supabase/functions/_shared/crm-list-query.ts');
    const serverCap = Number(/export const MAX_CRM_PAGE_SIZE = (\d+)/.exec(spec)?.[1]);
    expect(serverCap).toBeGreaterThan(0);
    expect(BOARD_PAGE_SIZE).toBe(serverCap);
  });

  it('the board requests it rather than a number of its own', () => {
    expect(FLAT).toContain('limit: String(BOARD_PAGE_SIZE)');
    expect(CODE).not.toContain("limit: '500'");
  });
});

describe('a truncated board says what it is not showing', () => {
  it('reports the gap with both numbers', () => {
    const t = boardTruncation(200, 1431, 'deals');
    expect(t).not.toBeNull();
    expect(t!.hidden).toBe(1231);
    expect(t!.message).toContain('200 of 1,431 deals');
  });

  it('says nothing when everything is loaded', () => {
    expect(boardTruncation(200, 200, 'deals')).toBeNull();
    expect(boardTruncation(12, 12)).toBeNull();
  });

  it('says nothing when the endpoint sent no count', () => {
    // Guessing `loaded === limit ? 'probably more' : 'all'` would claim a
    // truncation on a board that happens to hold exactly 200 deals.
    expect(boardTruncation(200, null)).toBeNull();
    expect(boardTruncation(200, undefined)).toBeNull();
  });

  it('says nothing when the count is BELOW the rows', () => {
    // The count and the rows are two reads; a row created between them makes
    // total < loaded. Nothing is hidden, so nothing is reported.
    expect(boardTruncation(200, 199)).toBeNull();
  });

  it('warns that the column counts describe the subset', () => {
    // The badge on each column and the money total under it are both computed
    // over what loaded. Saying only "showing 200 of 1,431" would leave a rep
    // reading those as pipeline figures.
    const t = boardTruncation(200, 1431, 'deals');
    expect(t!.message).toContain('Column counts and totals');
  });

  it('tells the rep what to do about it', () => {
    expect(boardTruncation(200, 400, 'deals')!.message).toMatch(/search or filter/);
  });

  it('refuses nonsense rather than rendering it', () => {
    expect(boardTruncation(-1, 100)).toBeNull();
    expect(boardTruncation(Number.NaN, 100)).toBeNull();
    expect(boardTruncation(10, Number.NaN)).toBeNull();
  });

  it('the board renders the notice', () => {
    expect(FLAT).toContain('boardTruncation( records.length');
    expect(CODE).toContain('{truncation.message}');
  });

  it('a bare-array response carries no count and claims none', () => {
    expect(CODE).toContain('return { records: result, total: null };');
  });
});

describe('the stage move tells the truth about whether it worked', () => {
  it('the success toast is on the mutation, not the drag handler', () => {
    // It used to fire immediately after .mutate(), so a failed move showed
    // "Stage updated" AND "Failed to update stage" - two contradictory toasts,
    // with the optimistic one read as the outcome.
    const handlerStart = CODE.indexOf('const handleDragEnd');
    const handlerEnd = CODE.indexOf('const boardNavRef');
    const handler = CODE.slice(handlerStart, handlerEnd);
    expect(handler).toContain('stageChangeMutation.mutate(');
    expect(handler).not.toContain('Stage updated');
    expect(FLAT).toContain('onSuccess: (_data, { stageLabel }) => {');
  });

  it('still rolls back optimistically on failure', () => {
    // AC3: the card never waits on the round trip, and a failure puts it back.
    expect(CODE).toContain('onMutate:');
    expect(CODE).toContain('context.previousData');
    expect(CODE).toContain("title: 'Failed to update stage'");
  });

  it('the optimistic write targets the shape the query now returns', () => {
    // The query used to resolve to a bare array and now resolves to
    // { records, total }. An onMutate still mapping over the old shape would
    // write undefined into the cache and blank the board on every drag.
    expect(FLAT).toContain('records: old.records.map((r) =>');
  });

  it('and the same key the query reads', () => {
    // PA-040's shape: an optimistic update written to a key nothing reads is
    // not optimism, it is a no-op that looks like one.
    const keys = [
      ...CODE.matchAll(/\[config\.apiEndpoint, 'board', \{ search, \.\.\.activeFilters \}\]/g),
    ];
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });
});
