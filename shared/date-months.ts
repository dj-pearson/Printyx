/**
 * Calendar month arithmetic for the Node and browser trees (DATE-SETMONTH-001).
 *
 * ONE IMPLEMENTATION, RE-EXPORTED - not a copy. The functions live in
 * supabase/functions/_shared/date-months.ts because the edge runtime cannot
 * import through the `@shared/*` alias, and that module was written
 * Deno-import-free precisely so anything else can pull it in. A second copy
 * here would need a parity test to stay honest (the gpt5-prompts and quote-math
 * idiom); a re-export needs nothing, because there is only ever one definition.
 *
 * Use this from server/ and client/; edge functions import the original
 * directly with its relative path.
 */
export {
  addMonths,
  daysInMonth,
  monthsBetween,
  startOfNextUtcDay,
  startOfUtcDay,
  subtractMonths,
  termEndDate,
  utcDateOnly,
} from '../supabase/functions/_shared/date-months.ts';
