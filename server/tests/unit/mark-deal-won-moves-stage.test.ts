/**
 * WF-C-02: marking a deal won must move it, not just relabel it.
 *
 * CrmDealsPage's Mark Won and DealDetail's Won button both did
 * PUT /api/deals/:id { status, actualCloseDate } and nothing else. The board
 * groups strictly by stageId, so the deal stayed in whatever column it was in
 * while both tables said Won - two views of one deal disagreeing, and the one a
 * manager forecasts from was the wrong one. It also meant Closed Won never fired
 * deal.stage_changed even after WF-C-01, because that dispatch is on the move
 * endpoint.
 *
 * This is a source-level test rather than a rendered one. What broke was WHICH
 * ENDPOINT the button calls, and a component test that mocks apiRequest asserts
 * the same string with more machinery. Both pages are checked, because the defect
 * existed in both and only one was in the story.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/** Comments stripped: these files explain the old behaviour, and an absence
 *  assertion that matches its own explanation reports the explanation as the bug. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const DEALS_PAGE = 'client/src/pages/CrmDealsPage.tsx';
const DEAL_DETAIL = 'client/src/pages/DealDetail.tsx';

describe('WF-C-02: closing a deal goes through the move endpoint', () => {
  it('the deals table posts to /pipeline-config/deals/:id/move', () => {
    expect(code(DEALS_PAGE)).toMatch(/pipeline-config\/deals\/\$\{id\}\/move/);
  });

  it('the deal page posts to it too — the same defect lived in both', () => {
    const src = code(DEAL_DETAIL);
    const moves = src.match(/pipeline-config\/deals\/\$\{dealId\}\/move/g) ?? [];
    // The stage-advance control and Mark Won/Lost.
    expect(moves.length).toBeGreaterThanOrEqual(2);
  });

  it('neither page writes a bare won/lost status any more', () => {
    for (const path of [DEALS_PAGE, DEAL_DETAIL]) {
      const src = code(path);
      // Anchored on what follows, so a `(status: 'won' | 'lost')` TYPE ANNOTATION
      // is not read as a status write. The first version of this matched both and
      // reported the parameter type of the fixed code as the defect.
      expect(src, `${path} still patches status directly`).not.toMatch(
        /status:\s*'(won|lost)'\s*[,}\n]/,
      );
      expect(src, `${path} still sets actualCloseDate from the client`).not.toMatch(
        /actualCloseDate:\s*new Date/,
      );
    }
  });

  it('both resolve the target stage from the board rather than guessing a name', () => {
    for (const path of [DEALS_PAGE, DEAL_DETAIL]) {
      const src = code(path);
      expect(src).toContain('/api/pipeline-config/board');
      expect(src).toMatch(/isClosedWon/);
      expect(src).toMatch(/isClosedLost/);
    }
  });

  it('both refuse rather than fall back when the pipeline has no closing stage', () => {
    for (const path of [DEALS_PAGE, DEAL_DETAIL]) {
      // The point is that there is no silent fallback to a status patch: a
      // pipeline with no Closed Won stage is a configuration problem, and writing
      // a status the board cannot show is what produced the disagreement.
      expect(code(path)).toMatch(/no Closed \$\{?/);
    }
  });

  it('the deals table invalidates /api/deals, which the board query keys sit under', () => {
    // EnhancedPipelineBoard keys its board query as [apiEndpoint, 'board', ...],
    // so invalidating the ['/api/deals'] prefix refreshes the column the deal just
    // left and the one it landed in, with no page refresh.
    expect(code(DEALS_PAGE)).toMatch(/invalidateQueries\(\{\s*queryKey:\s*\['\/api\/deals'\]/);
  });
});
