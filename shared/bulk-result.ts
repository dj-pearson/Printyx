/**
 * What a bulk write reports, measured rather than assumed.
 *
 * THE DEFECT THIS REPLACES (round 132). Five bulk endpoints across both hosts
 * answered `deletedCount: ids.length` - the number of ids the CALLER SENT, not
 * the number of rows the database touched. Every one of them filters by
 * `tenant_id`, so an id belonging to another tenant, or one a colleague deleted
 * thirty seconds earlier, matches nothing and the response still says
 * "Successfully deleted 20 invoices". Round 78 found the same shape in a
 * per-id delete loop that toasted a count of attempts; this is the bulk
 * version, and it is worse in one respect - there is no loop to inspect, so the
 * number looks like it came from the write.
 *
 * None of the three fabrication guards sees it: there is no `|| literal`, no
 * `Math.random()` and no static JSX, because THE SUCCESS IS THE EVIDENCE.
 *
 * The correct pattern was already in this tree twice - `product-models` and
 * `software-products` both take the length of what the delete RETURNED - so
 * this module is the shape rather than the technique: each host obtains the
 * affected ids its own way (`.delete().select('id')` on PostgREST,
 * `.returning({ id })` on Drizzle) and hands them here, which is what makes the
 * two answer identically.
 *
 * WHAT IT REFUSES TO ROUND OFF: the ids that matched nothing are NAMED, not
 * folded into the difference. A caller told "17 of 20" cannot act on it; a
 * caller told which three were already gone can refresh, re-select or stop.
 * That is the rule COP-B00 set for a migration and round 130 for a bulk assign,
 * pointed at a delete.
 */

export type BulkWriteOutcome = {
  /** Rows the database actually changed. */
  affectedCount: number;
  /** Ids that were asked for and matched no row this tenant can reach. */
  notFound: string[];
  /** True when every requested id was affected. */
  complete: boolean;
  /** One line a UI can render without doing arithmetic of its own. */
  message: string;
};

/**
 * @param requestedIds ids the caller asked to act on (already de-duplicated by
 *   the caller's parser; duplicates here are collapsed so the count cannot
 *   exceed the number of distinct rows).
 * @param affectedIds ids the write reported back.
 * @param noun singular noun for the message ('invoice', 'deal', ...).
 * @param verb past-tense verb ('deleted', 'updated').
 */
export function summariseBulkWrite(
  requestedIds: readonly string[],
  affectedIds: readonly string[],
  noun: string,
  verb: string,
): BulkWriteOutcome {
  const requested = [...new Set(requestedIds)];
  const affected = new Set(affectedIds);
  const notFound = requested.filter((id) => !affected.has(id));
  const affectedCount = requested.length - notFound.length;
  const complete = notFound.length === 0;

  const plural = (n: number) => (n === 1 ? noun : `${noun}s`);

  // "Deleted 17 of 20" says what happened; "Successfully deleted 20" does not.
  const message = complete
    ? `${capitalise(verb)} ${affectedCount} ${plural(affectedCount)}`
    : `${capitalise(verb)} ${affectedCount} of ${requested.length} ${plural(requested.length)} - ` +
      `${notFound.length} no longer ${notFound.length === 1 ? 'exists' : 'exist'} or ${
        notFound.length === 1 ? 'is' : 'are'
      } not accessible`;

  return { affectedCount, notFound, complete, message };
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
