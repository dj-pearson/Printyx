/**
 * CSV serialisation for edge functions.
 *
 * ONE IMPLEMENTATION, RE-EXPORTED - not a copy. The escaping and joining rules
 * were written for the address-book importer (ABK) and live under
 * _shared/address-book/csv.ts with the PARSER they belong beside. That path
 * reads as scoped to one feature and it is not, so anything outside the address
 * book imports it from here instead of either duplicating the rules (there are
 * already two hand-rolled escapers in this tree) or reaching into a neighbour's
 * directory.
 *
 * The rules themselves are the ones that matter and are easy to get subtly
 * wrong: quote a field only when it contains the delimiter, a quote or a
 * newline; double an embedded quote; join records with CRLF.
 */
export { csvEscape, toCsv } from './address-book/csv.ts';
