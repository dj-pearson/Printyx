/**
 * Build a PostgREST `or()` filter from a caller's search term without letting
 * the term rewrite the filter (round 151).
 *
 * The `or()` grammar is comma- and paren-delimited, and 30-odd edge functions
 * built it by interpolation - `.or(`title.ilike.%${search}%,...`)` - straight
 * from a query parameter. Two consequences, one of them common:
 *
 *   - A term containing a comma or a parenthesis produced a malformed filter
 *     and a 400 or a 500. "Smith, Jones & Co" is an ordinary company name, so
 *     searching for a real customer by their real name failed.
 *   - A crafted term could add clauses of its own: `x%,id.not.is.null` turns
 *     "title contains x" into "title contains x OR the row has an id". The
 *     tenant filter survives, because PostgREST ANDs `.eq()` with the `or()`,
 *     but any narrowing the `or()` was doing does not.
 *
 * Two earlier fixes stripped the reserved characters instead
 * (sanitizeSearchTerm in crm-list-query.ts). That stops both failures and
 * also stops the search working: "Smith, Jones" becomes "Smith  Jones" and
 * matches nothing. PostgREST accepts a DOUBLE-QUOTED value inside a logic
 * tree, with `"` and `\` escaped by a backslash, so the term can be kept
 * whole. That is what this does. The quoting rule is the one
 * _shared/scope.ts already uses for its in-lists.
 */

/** Longest term that goes into a filter; a search box does not need more. */
export const MAX_OR_TERM_LENGTH = 200;

/** Quote one value for use inside a PostgREST logic tree. */
export function quoteOrValue(value: string): string {
  return `"${value.replace(/["\\]/g, (c) => '\\' + c)}"`;
}

/**
 * `col1.ilike."%term%",col2.ilike."%term%"` - the drop-in for the interpolated
 * form. An empty term gives `%%`, which is what the interpolated form produced
 * too; callers already skip the filter when the box is empty.
 */
export function ilikeAnyFilter(columns: readonly string[], raw: unknown): string {
  if (columns.length === 0) throw new Error('ilikeAnyFilter needs at least one column');
  const term = String(raw ?? '')
    .trim()
    .slice(0, MAX_OR_TERM_LENGTH);
  const value = quoteOrValue(`%${term}%`);
  return columns.map((c) => `${c}.ilike.${value}`).join(',');
}
