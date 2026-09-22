/**
 * Amending a meter reading (round 122).
 *
 * `PATCH /meter-readings/:id` built its update from a field map whose targets
 * were `black_count`, `color_count`, `black_usage`, `color_usage` and
 * `reading_type` - FIVE COLUMNS THAT DO NOT EXIST. The real ones are
 * `bw_meter_reading`, `color_meter_reading`, `black_copies`, `color_copies`
 * and `reading_method`, and the POST branch twelve lines above carries a
 * comment saying exactly that, because the same six names were fixed there and
 * nobody walked down to the update.
 *
 * An unknown column fails the WHOLE statement, not the one field, so a PATCH
 * that touched any meter value was a 42703 surfaced as a generic 500 - and one
 * that touched only `notes` or `readingDate` worked, which is why it reads as
 * intermittent rather than broken. `check:phantom-cols` could not see it: the
 * payload is a named variable, its documented blind spot, and the same reason
 * the POST's six were invisible. A unit test resolves this module's column list
 * against drizzle's `getTableConfig` instead.
 *
 * THE DELTA IS RECOMPUTED, NEVER LEFT (COP-B05). `black_copies` and
 * `color_copies` DEFAULT TO 0, so a delta left stale after somebody corrects a
 * counter is indistinguishable from a month in which the machine printed
 * nothing - and every volume, cost-per-page and TCO figure downstream inherits
 * it. A counter that ends up LOWER than its previous yields no delta at all
 * rather than a negative one: that is a meter reset or a swapped machine, and a
 * negative page count on an invoice is worse than a blank.
 */

/** Columns a caller may amend. Locked against Drizzle by a unit test. */
export const METER_READING_EDITABLE_COLUMNS = [
  'reading_date',
  'bw_meter_reading',
  'color_meter_reading',
  'scan_meter_reading',
  'fax_meter_reading',
  'large_paper_meter_reading',
  'previous_black_meter',
  'previous_color_meter',
  'reading_method',
  'collection_method',
  'notes',
  'reading_notes',
] as const;

/** Derived from the counters; a caller never sets these directly. */
export const METER_READING_DERIVED_COLUMNS = ['black_copies', 'color_copies'] as const;

/**
 * Accepted request spellings. The camelCase names on the left are what the
 * POST branch already accepts, so the two paths agree about what `blackCount`
 * means (a COUNTER, not a delta) rather than each deciding for itself.
 */
export const METER_READING_FIELD_MAP: Record<string, string> = {
  readingDate: 'reading_date',
  reading_date: 'reading_date',
  bwMeterReading: 'bw_meter_reading',
  bw_meter_reading: 'bw_meter_reading',
  blackCount: 'bw_meter_reading',
  black_count: 'bw_meter_reading',
  colorMeterReading: 'color_meter_reading',
  color_meter_reading: 'color_meter_reading',
  colorCount: 'color_meter_reading',
  color_count: 'color_meter_reading',
  scanMeterReading: 'scan_meter_reading',
  scan_meter_reading: 'scan_meter_reading',
  faxMeterReading: 'fax_meter_reading',
  fax_meter_reading: 'fax_meter_reading',
  largePaperMeterReading: 'large_paper_meter_reading',
  large_paper_meter_reading: 'large_paper_meter_reading',
  previousBlackReading: 'previous_black_meter',
  previousBlackMeter: 'previous_black_meter',
  previous_black_meter: 'previous_black_meter',
  previousColorReading: 'previous_color_meter',
  previousColorMeter: 'previous_color_meter',
  previous_color_meter: 'previous_color_meter',
  readingType: 'reading_method',
  reading_type: 'reading_method',
  readingMethod: 'reading_method',
  reading_method: 'reading_method',
  collectionMethod: 'collection_method',
  collection_method: 'collection_method',
  notes: 'notes',
  readingNotes: 'reading_notes',
  reading_notes: 'reading_notes',
};

/**
 * Columns a caller may never set, even though they are real. `tenant_id` and
 * `id` decide which row this is; the rest are audit and billing state that a
 * meter amendment has no business rewriting.
 */
export const METER_READING_REFUSED_COLUMNS = new Set([
  'id',
  'tenant_id',
  'equipment_id',
  'created_by',
  'created_at',
  'is_verified',
  'verified_by',
  'verified_at',
  'invoice_id',
  'invoice_number',
  'billing_status',
  'billing_amount',
  'adjustment_amount',
]);

export interface MeterReadingUpdatePlan {
  /** Column -> value, ready for PostgREST. Empty when nothing was amendable. */
  plan: Record<string, unknown>;
  /** Keys the caller sent that map to no editable column. */
  ignoredFields: string[];
  /** Keys the caller sent that map to a column they may not set. */
  refusedFields: string[];
  /**
   * Set when a counter was amended and the resulting delta could not be
   * derived, so the stored one is left alone rather than silently kept.
   */
  derivationWarnings: string[];
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Builds the update from what the caller sent, merged over the stored row so
 * the derived deltas can be recomputed. `stored` is the row as PostgREST
 * returns it; pass `{}` only when there is genuinely nothing to merge, which
 * makes every delta underivable and says so.
 */
export function buildMeterReadingUpdate(
  body: Record<string, unknown>,
  stored: Record<string, unknown> = {},
): MeterReadingUpdatePlan {
  const plan: Record<string, unknown> = {};
  const ignoredFields: string[] = [];
  const refusedFields: string[] = [];
  const derivationWarnings: string[] = [];
  const editable = new Set<string>(METER_READING_EDITABLE_COLUMNS);

  for (const [key, value] of Object.entries(body ?? {})) {
    if (value === undefined) continue;
    const column = METER_READING_FIELD_MAP[key];
    if (!column) {
      if (METER_READING_REFUSED_COLUMNS.has(key)) refusedFields.push(key);
      else ignoredFields.push(key);
      continue;
    }
    if (!editable.has(column)) {
      refusedFields.push(key);
      continue;
    }
    plan[column] = value;
  }

  // Recompute a delta only when the counter it belongs to was amended. A PATCH
  // that changes nothing but the notes must not rewrite billing arithmetic.
  const pairs: Array<[string, string, string]> = [
    ['bw_meter_reading', 'previous_black_meter', 'black_copies'],
    ['color_meter_reading', 'previous_color_meter', 'color_copies'],
  ];
  for (const [counterCol, previousCol, deltaCol] of pairs) {
    const counterTouched = counterCol in plan;
    const previousTouched = previousCol in plan;
    if (!counterTouched && !previousTouched) continue;

    const counter = toNumber(counterTouched ? plan[counterCol] : stored[counterCol]);
    const previous = toNumber(previousTouched ? plan[previousCol] : stored[previousCol]);

    if (counter === null || previous === null) {
      derivationWarnings.push(
        `${deltaCol} left unchanged: ${counter === null ? counterCol : previousCol} is not recorded, ` +
          'so the delta cannot be derived from the counters.',
      );
      continue;
    }
    if (counter < previous) {
      // A meter that reads lower than it did is a reset or a swapped machine.
      derivationWarnings.push(
        `${deltaCol} left unchanged: ${counterCol} (${counter}) is lower than ${previousCol} ` +
          `(${previous}), which is a meter reset or a swapped machine, not negative usage.`,
      );
      continue;
    }
    plan[deltaCol] = counter - previous;
  }

  return { plan, ignoredFields, refusedFields, derivationWarnings };
}
