/**
 * What a kanban board is NOT showing (COP-I01 AC4).
 *
 * EnhancedPipelineBoard asked for `limit: 500`. The server caps every CRM list
 * at `MAX_CRM_PAGE_SIZE` (200) in `_shared/crm-list-query.ts`, so the board got
 * 200 rows and believed it had asked for and received everything. A tenant with
 * 250 deals was missing 50 from the board, the per-stage badge on every column
 * was wrong, and nothing on the screen said so - the 201st deal simply did not
 * exist as far as the board was concerned.
 *
 * That is the failure this repo keeps naming from other angles: an absence
 * indistinguishable from "that is all there is". A board is the screen a rep
 * uses to decide what to work on, so a silently short one is worse than a slow
 * one.
 *
 * TWO RULES, and the first is the one that was broken:
 *
 *  1. THE CLIENT ASKS FOR WHAT THE SERVER WILL GIVE. `BOARD_PAGE_SIZE` is the
 *     server's own cap, and a parity test asserts it, so the request and the
 *     response agree rather than the client hoping.
 *
 *  2. A TRUNCATED BOARD SAYS SO, with the real total and what to do about it.
 *     The endpoint already returns an exact `count`, filtered the same way the
 *     rows were - it always did, and the board threw it away.
 */

/**
 * The server's cap, mirrored. Locked to `MAX_CRM_PAGE_SIZE` in
 * `supabase/functions/_shared/crm-list-query.ts` by
 * `server/tests/unit/board-truncation.test.ts`, the same way quote-math is
 * locked to its Deno copy: the edge tree cannot import from `shared/`.
 */
export const BOARD_PAGE_SIZE = 200;

export interface BoardTruncation {
  /** Rows the board is rendering. */
  loaded: number;
  /** Rows the filter actually matches, from the endpoint's exact count. */
  total: number;
  /** total - loaded. Always positive when this object exists. */
  hidden: number;
  message: string;
}

/**
 * Describe the gap, or say there isn't one.
 *
 * `total` is nullable because an endpoint that does not return a count cannot
 * be reported on - answering null there is honest, where guessing
 * `loaded === limit ? 'probably more' : 'all'` would claim a truncation on a
 * board that happens to hold exactly 200 deals.
 */
export function boardTruncation(
  loaded: number,
  total: number | null | undefined,
  objectLabel = 'records',
): BoardTruncation | null {
  if (total == null || !Number.isFinite(total)) return null;
  if (!Number.isFinite(loaded) || loaded < 0) return null;
  // A total BELOW the loaded count means the count and the rows disagree -
  // possible when a row is created between the two halves of the query. Nothing
  // is hidden, so nothing is reported.
  if (total <= loaded) return null;

  const hidden = total - loaded;
  return {
    loaded,
    total,
    hidden,
    message:
      `Showing ${loaded.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} ` +
      `${objectLabel}. Column counts and totals cover the ${loaded.toLocaleString('en-US')} ` +
      'loaded, not the whole pipeline - search or filter to narrow it.',
  };
}
