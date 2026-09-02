/**
 * COP-M04: what a pipeline card shows.
 *
 * `saved_views.board_config` has held `{ cardFields, columnTotals, groupBy }`
 * since migration 0003, and supabase/functions/saved-views reads it, writes it
 * on create and updates it on PATCH. Nothing in the UI ever set or read it, so
 * every board card rendered the same five hardcoded fields and the ten copier
 * columns COP-M04 added to `deals` could not be put on one. BoardOptionsMenu
 * looked like the missing piece and was not: it took a `fields` prop and never
 * used it, and it was an orphan component besides.
 *
 * These helpers mirror crm-columns.ts deliberately - the card-field picker and
 * the column picker are the same problem, and a rep who has learned one should
 * not have to learn the other.
 */
import type { CrmFieldDef } from './crm-object-registry';

/** One card field's persisted state - matches the saved_views.board_config jsonb shape. */
export interface CardFieldEntry {
  field: string;
  label: string;
  position: number;
  format?: string;
}

export type ColumnTotalsMode = 'sum' | 'count' | 'weighted' | 'average' | 'none';

export interface BoardConfig {
  cardFields?: CardFieldEntry[];
  columnTotals?: ColumnTotalsMode;
  groupBy?: string;
}

/**
 * How many fields fit under the title before a card stops being scannable.
 * The board is a glance surface; a card with fifteen rows is a table row that
 * has been turned on its side.
 */
export const MAX_CARD_FIELDS = 6;

export const COLUMN_TOTALS_MODES: ReadonlyArray<{ value: ColumnTotalsMode; label: string }> = [
  { value: 'sum', label: 'Sum of value' },
  { value: 'count', label: 'Count of records' },
  { value: 'weighted', label: 'Weighted (value x probability)' },
  { value: 'average', label: 'Average value' },
  { value: 'none', label: 'No total' },
];

export const DEFAULT_COLUMN_TOTALS: ColumnTotalsMode = 'sum';

/**
 * What a card shows when nobody has configured one. These are the fields the
 * card rendered before it was configurable, so an unconfigured board looks
 * exactly as it did.
 */
export const DEFAULT_CARD_FIELDS: Record<string, string[]> = {
  deals: ['amount', 'companyName', 'expectedCloseDate', 'priority'],
  leads: ['companyName', 'status', 'estimatedAmount'],
};

export function defaultCardFieldsFor(objectType: string, catalog: CrmFieldDef[]): string[] {
  const wanted = DEFAULT_CARD_FIELDS[objectType] ?? [];
  const present = wanted.filter((f) => catalog.some((c) => c.field === f));
  if (present.length > 0) return present;
  return catalog.slice(0, 3).map((c) => c.field);
}

/**
 * The fields to actually render on a card, in order. A saved field that is no
 * longer in the catalog is dropped rather than rendered as a blank row.
 */
export function resolveCardFields(
  catalog: CrmFieldDef[],
  boardConfig: BoardConfig | null | undefined,
  objectType: string,
): CrmFieldDef[] {
  const saved = boardConfig?.cardFields;
  if (saved && saved.length > 0) {
    return saved
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => catalog.find((f) => f.field === c.field))
      .filter((f): f is CrmFieldDef => Boolean(f))
      .slice(0, MAX_CARD_FIELDS);
  }
  return defaultCardFieldsFor(objectType, catalog)
    .map((field) => catalog.find((f) => f.field === field))
    .filter((f): f is CrmFieldDef => Boolean(f));
}

/** One row per catalog field, for the picker: chosen ones first, in card order. */
export interface CardFieldChoice {
  field: string;
  label: string;
  selected: boolean;
}

export function buildWorkingCardFields(
  catalog: CrmFieldDef[],
  boardConfig: BoardConfig | null | undefined,
  objectType: string,
): CardFieldChoice[] {
  const chosen = resolveCardFields(catalog, boardConfig, objectType).map((f) => f.field);
  const chosenSet = new Set(chosen);
  return [
    ...chosen
      .map((field) => catalog.find((f) => f.field === field))
      .filter((f): f is CrmFieldDef => Boolean(f))
      .map((f) => ({ field: f.field, label: f.label, selected: true })),
    ...catalog
      .filter((f) => !chosenSet.has(f.field))
      .map((f) => ({ field: f.field, label: f.label, selected: false })),
  ];
}

/**
 * Add or remove a field. Adding past MAX_CARD_FIELDS is refused rather than
 * silently dropped, so the picker can say why the checkbox did not move.
 */
export function toggleCardField(
  working: CardFieldChoice[],
  field: string,
): { next: CardFieldChoice[]; refused: boolean } {
  const target = working.find((c) => c.field === field);
  if (!target) return { next: working, refused: false };
  if (!target.selected && working.filter((c) => c.selected).length >= MAX_CARD_FIELDS) {
    return { next: working, refused: true };
  }
  const next = working.map((c) => (c.field === field ? { ...c, selected: !c.selected } : c));
  // Selected fields stay at the front, in the order they were chosen.
  return {
    next: [...next.filter((c) => c.selected), ...next.filter((c) => !c.selected)],
    refused: false,
  };
}

/** Move a chosen field up (-1) or down (+1) among the chosen ones. */
export function moveCardField(
  working: CardFieldChoice[],
  field: string,
  direction: -1 | 1,
): CardFieldChoice[] {
  const selected = working.filter((c) => c.selected);
  const rest = working.filter((c) => !c.selected);
  const idx = selected.findIndex((c) => c.field === field);
  if (idx === -1) return working;
  const target = idx + direction;
  if (target < 0 || target >= selected.length) return working;
  const next = [...selected];
  const [moved] = next.splice(idx, 1);
  next.splice(target, 0, moved);
  return [...next, ...rest];
}

/** The picker's state as the jsonb the saved view stores. */
export function toCardFieldEntries(working: CardFieldChoice[]): CardFieldEntry[] {
  return working
    .filter((c) => c.selected)
    .slice(0, MAX_CARD_FIELDS)
    .map((c, i) => ({ field: c.field, label: c.label, position: i }));
}

/**
 * A stage column's total.
 *
 * null when the mode cannot be answered from the rows in hand, rather than 0:
 * an average over no records is not zero, and a weighted total over records
 * that carry no probability is not zero either. The column header renders
 * nothing when this is null.
 */
export function columnTotal(
  records: Array<Record<string, unknown>>,
  mode: ColumnTotalsMode,
): { value: number; kind: 'currency' | 'count' } | null {
  if (mode === 'none') return null;
  if (mode === 'count') return { value: records.length, kind: 'count' };

  const amounts = records
    .map((r) => Number(r.value ?? r.amount ?? r.estimatedAmount ?? r.dealValue))
    .filter((n) => Number.isFinite(n));
  if (amounts.length === 0) return null;

  if (mode === 'sum') return { value: sum(amounts), kind: 'currency' };
  if (mode === 'average') return { value: sum(amounts) / amounts.length, kind: 'currency' };

  // weighted: value x probability, over the records that carry a probability.
  const weighted = records
    .map((r) => {
      const amount = Number(r.value ?? r.amount ?? r.estimatedAmount ?? r.dealValue);
      const probability = Number(r.probability);
      if (!Number.isFinite(amount) || !Number.isFinite(probability)) return null;
      // A probability is stored 0-100. 0.9 would be a nine-tenths of one percent
      // deal, which nobody means, but guessing is worse than reading it as given.
      return amount * (probability / 100);
    })
    .filter((n): n is number => n !== null);
  if (weighted.length === 0) return null;
  return { value: sum(weighted), kind: 'currency' };
}

function sum(values: number[]): number {
  return values.reduce((total, n) => total + n, 0);
}

/**
 * A card field's display string, or null when the record has no value for it.
 * A card row with a blank right-hand side is worse than no row.
 */
export function formatCardValue(
  record: Record<string, unknown>,
  field: CrmFieldDef,
): string | null {
  const raw = record[field.field];
  if (raw === null || raw === undefined || raw === '') return null;

  switch (field.type) {
    case 'currency': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      // COP-M04: four decimals for a cost-per-copy, because the default currency
      // format rounds 0.0085 to 0.01 - a 17% error on the number the deal turns on.
      const cpc = field.format === 'cpc';
      return `$${n.toLocaleString('en-US', {
        minimumFractionDigits: cpc ? 4 : 0,
        maximumFractionDigits: cpc ? 4 : 0,
      })}`;
    }
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return field.format === 'cpc'
        ? n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
        : n.toLocaleString('en-US');
    }
    case 'date': {
      const d = new Date(String(raw));
      return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
    }
    case 'select':
    case 'badge': {
      const match = field.options?.find((o) => o.value === String(raw));
      return match?.label ?? String(raw);
    }
    default:
      return String(raw);
  }
}
