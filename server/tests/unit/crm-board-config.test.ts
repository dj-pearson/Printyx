/**
 * COP-M04. What a pipeline card shows, and what a stage column totals.
 *
 * `saved_views.board_config` shipped in migration 0003 with `cardFields`,
 * `columnTotals` and `groupBy`, and supabase/functions/saved-views has always
 * read it, written it on create and updated it on PATCH. Nothing in the UI ever
 * set or read it, so every card rendered the same fixed five fields and the ten
 * copier columns this story added to `deals` could reach the table and not the
 * board. BoardOptionsMenu looked like the missing half and was not: it declared
 * a `fields` prop it never used, and nothing imported the file.
 *
 * The assertions below are about the two rules that are easy to get wrong: a
 * total that cannot be computed must not read as zero, and a field the record
 * has no value for must not render as a labelled blank.
 *
 * Comments are stripped before any absence assertion.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_COLUMN_TOTALS,
  MAX_CARD_FIELDS,
  buildWorkingCardFields,
  columnTotal,
  defaultCardFieldsFor,
  formatCardValue,
  moveCardField,
  resolveCardFields,
  toCardFieldEntries,
  toggleCardField,
} from '../../../client/src/lib/crm-board-config';
import { getCrmObjectConfig } from '../../../client/src/lib/crm-object-registry';

const repo = join(__dirname, '..', '..', '..');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const deals = getCrmObjectConfig('deals');

describe('card fields', () => {
  it('defaults to the fields the card rendered before it was configurable', () => {
    const fields = resolveCardFields(deals.fields, null, 'deals');
    expect(fields.map((f) => f.field)).toEqual([
      'amount',
      'companyName',
      'expectedCloseDate',
      'priority',
    ]);
  });

  it('every default is a real field on the object', () => {
    for (const objectType of ['deals', 'leads'] as const) {
      const config = getCrmObjectConfig(objectType);
      for (const field of defaultCardFieldsFor(objectType, config.fields)) {
        expect(
          config.fields.map((f) => f.field),
          objectType,
        ).toContain(field);
      }
    }
  });

  it('puts the copier fields within reach of a card', () => {
    // The whole point of AC4's third clause: a rep working lease rollovers can
    // put buyout exposure on the card instead of opening every deal.
    const config = {
      cardFields: [
        { field: 'leaseBuyoutExposure', label: 'Buyout Exposure', position: 0 },
        { field: 'dealMotion', label: 'Motion', position: 1 },
      ],
    };
    expect(resolveCardFields(deals.fields, config, 'deals').map((f) => f.field)).toEqual([
      'leaseBuyoutExposure',
      'dealMotion',
    ]);
  });

  it('honours the saved order, not the order the array happens to be in', () => {
    const config = {
      cardFields: [
        { field: 'dealMotion', label: 'Motion', position: 5 },
        { field: 'amount', label: 'Amount', position: 1 },
      ],
    };
    expect(resolveCardFields(deals.fields, config, 'deals').map((f) => f.field)).toEqual([
      'amount',
      'dealMotion',
    ]);
  });

  it('drops a saved field the object no longer has, rather than rendering a blank row', () => {
    const config = {
      cardFields: [
        { field: 'amount', label: 'Amount', position: 0 },
        { field: 'fieldThatWasDeleted', label: 'Gone', position: 1 },
      ],
    };
    expect(resolveCardFields(deals.fields, config, 'deals').map((f) => f.field)).toEqual([
      'amount',
    ]);
  });

  it('caps what a card can carry', () => {
    const config = {
      cardFields: deals.fields.map((f, i) => ({ field: f.field, label: f.label, position: i })),
    };
    expect(resolveCardFields(deals.fields, config, 'deals')).toHaveLength(MAX_CARD_FIELDS);
  });
});

describe('the card-field picker', () => {
  it('lists the chosen fields first, then everything else', () => {
    const working = buildWorkingCardFields(deals.fields, null, 'deals');
    const selected = working.filter((c) => c.selected).map((c) => c.field);
    expect(selected).toEqual(['amount', 'companyName', 'expectedCloseDate', 'priority']);
    expect(working).toHaveLength(deals.fields.length);
    expect(working.slice(0, selected.length).every((c) => c.selected)).toBe(true);
  });

  it('refuses the field past the cap instead of silently dropping it', () => {
    let working = buildWorkingCardFields(deals.fields, null, 'deals');
    const spare = working.filter((c) => !c.selected).map((c) => c.field);
    for (const field of spare.slice(0, MAX_CARD_FIELDS - 4)) {
      working = toggleCardField(working, field).next;
    }
    expect(working.filter((c) => c.selected)).toHaveLength(MAX_CARD_FIELDS);

    const attempt = toggleCardField(working, spare[MAX_CARD_FIELDS - 4]);
    expect(attempt.refused).toBe(true);
    expect(attempt.next).toBe(working);
  });

  it('removing is never refused', () => {
    const working = buildWorkingCardFields(deals.fields, null, 'deals');
    const result = toggleCardField(working, 'amount');
    expect(result.refused).toBe(false);
    expect(result.next.find((c) => c.field === 'amount')?.selected).toBe(false);
  });

  it('reorders only within the chosen set', () => {
    const working = buildWorkingCardFields(deals.fields, null, 'deals');
    const moved = moveCardField(working, 'companyName', -1);
    expect(toCardFieldEntries(moved).map((c) => c.field)).toEqual([
      'companyName',
      'amount',
      'expectedCloseDate',
      'priority',
    ]);
  });

  it('will not move the first field up or the last one down', () => {
    const working = buildWorkingCardFields(deals.fields, null, 'deals');
    expect(moveCardField(working, 'amount', -1)).toBe(working);
    expect(moveCardField(working, 'priority', 1)).toBe(working);
  });

  it('numbers positions from zero on save', () => {
    const working = buildWorkingCardFields(deals.fields, null, 'deals');
    expect(toCardFieldEntries(working).map((c) => c.position)).toEqual([0, 1, 2, 3]);
  });
});

describe('column totals', () => {
  const withValues = [
    { value: 1000, probability: 50 },
    { value: 3000, probability: 25 },
  ];

  it('defaults to the sum, which is what the board showed before', () => {
    expect(DEFAULT_COLUMN_TOTALS).toBe('sum');
    expect(columnTotal(withValues, 'sum')).toEqual({ value: 4000, kind: 'currency' });
  });

  it('counts records even when none of them carry a value', () => {
    expect(columnTotal([{}, {}, {}], 'count')).toEqual({ value: 3, kind: 'count' });
  });

  it('answers null - not zero - when no record carries a value', () => {
    // A stage of deals nobody has priced is not a stage worth $0. The header
    // renders nothing for null.
    expect(columnTotal([{ title: 'Acme' }], 'sum')).toBeNull();
    expect(columnTotal([], 'average')).toBeNull();
  });

  it('averages over the records that have a value', () => {
    expect(columnTotal(withValues, 'average')).toEqual({ value: 2000, kind: 'currency' });
  });

  it('weights by probability, and is null when nothing carries one', () => {
    expect(columnTotal(withValues, 'weighted')).toEqual({ value: 1250, kind: 'currency' });
    expect(columnTotal([{ value: 1000 }], 'weighted')).toBeNull();
  });

  it('reads a genuine zero as a value, not as absent', () => {
    // `r.value || r.amount || 0`, which this replaced, treats 0 as missing and
    // falls through to the next key.
    expect(columnTotal([{ value: 0 }, { value: 500 }], 'sum')).toEqual({
      value: 500,
      kind: 'currency',
    });
    expect(columnTotal([{ value: 0 }], 'sum')).toEqual({ value: 0, kind: 'currency' });
  });

  it('shows nothing at all in "none" mode', () => {
    expect(columnTotal(withValues, 'none')).toBeNull();
  });
});

describe('card values', () => {
  const field = (name: string) => deals.fields.find((f) => f.field === name)!;

  it('renders no row for a field the record has no value for', () => {
    expect(formatCardValue({}, field('amount'))).toBeNull();
    expect(formatCardValue({ incumbentVendor: '' }, field('incumbentVendor'))).toBeNull();
  });

  it('renders a cost per copy at four decimals', () => {
    // toLocaleString defaults to three, so 0.0085 becomes 0.009 - a 17% error on
    // the number a copier deal turns on.
    expect(formatCardValue({ targetCpcBlack: 0.0085 }, field('targetCpcBlack'))).toBe('0.0085');
  });

  it('reads a decimal that arrived as a string, which is how PostgREST sends it', () => {
    expect(formatCardValue({ leaseBuyoutExposure: '12500.00' }, field('leaseBuyoutExposure'))).toBe(
      '$12,500',
    );
  });

  it('shows the label of a closed vocabulary, not its stored value', () => {
    expect(formatCardValue({ dealMotion: 'lease_rollover' }, field('dealMotion'))).toBe(
      'Lease Rollover',
    );
  });

  it('falls back to the raw value for a code nobody has added a label for', () => {
    expect(formatCardValue({ dealMotion: 'something_new' }, field('dealMotion'))).toBe(
      'something_new',
    );
  });

  it('keeps a zero volume, because zero pages a month is a fact about the fleet', () => {
    expect(formatCardValue({ currentMonthlyVolumeBw: 0 }, field('currentMonthlyVolumeBw'))).toBe(
      '0',
    );
  });
});

describe('the board is wired to the column that was already there', () => {
  const board = strip(
    readFileSync(join(repo, 'client/src/components/crm/EnhancedPipelineBoard.tsx'), 'utf8'),
  );
  const menu = strip(
    readFileSync(join(repo, 'client/src/components/crm/BoardOptionsMenu.tsx'), 'utf8'),
  );
  const shell = strip(
    readFileSync(join(repo, 'client/src/components/crm/CrmIndexShell.tsx'), 'utf8'),
  );

  it('renders the options menu, so the component is no longer an orphan', () => {
    expect(board).toContain('BoardOptionsMenu');
    expect(board).toMatch(/from '@\/components\/crm\/BoardOptionsMenu'/);
  });

  it('persists to saved_views.board_config through the shell', () => {
    expect(shell).toContain('boardConfig: config');
    expect(shell).toContain('activeView?.boardConfig');
  });

  it('the picker actually reads the fields it is handed', () => {
    // The version this replaced took a `fields` prop and never referenced it.
    expect(menu).toContain('buildWorkingCardFields(fields');
  });

  it('has no inert control left in the menu', () => {
    // A select with no onValueChange and a switch that writes only to local
    // state read as configuration and configured nothing.
    expect(menu).not.toContain('defaultValue="newest"');
    expect(menu).not.toContain('applyForEveryone');
  });

  it('no longer hardcodes the card rows', () => {
    expect(board).toContain('cardFields.map');
    expect(board).not.toContain('{/* Deal value */}');
  });

  it('opens the record when a card is clicked', () => {
    // onViewDetail was declared on the card and passed by nobody, so clicking a
    // card and choosing "View Details" both did nothing.
    expect(board).toContain('onViewDetail={openDetail}');
    expect(board).toContain('config.detailPath');
  });
});

describe('saved views round-trip in the case the UI reads', () => {
  const fn = strip(readFileSync(join(repo, 'supabase/functions/saved-views/index.ts'), 'utf8'));
  const hook = strip(readFileSync(join(repo, 'client/src/hooks/useSavedViews.ts'), 'utf8'));

  it('answers camelCase, because that is what every consumer types', () => {
    // The function returned the raw PostgREST row while useSavedViews types
    // columnConfig/boardConfig/filterDefinition/sortConfig/isDefault/
    // isSystemView. All six resolved to undefined, so selecting a view applied
    // no filter and no sort, saved columns never came back, no view was ever
    // the default, and a system view showed a delete button. The WRITE side was
    // right all along, which is what made it look like nothing saved.
    for (const key of [
      'columnConfig',
      'boardConfig',
      'filterDefinition',
      'sortConfig',
      'isDefault',
      'isSystemView',
    ]) {
      expect(hook, key).toContain(key);
    }
    expect(fn).toContain('camelRows(result)');
    expect(fn).toContain('camelRows(view)');
    expect(fn).toContain('camelRows(created)');
    expect(fn).toContain('camelRows(updated)');
  });

  it('converts the top level only, so jsonb keys survive', () => {
    // filterDefinition[].value is arbitrary user data, and a filter on the
    // custom field cf_lease_end must not come back as cfLeaseEnd.
    expect(fn).toContain('toCamelShallow');
    expect(fn).not.toMatch(/\btoCamel\(/);
  });

  it('still writes the columns snake_case, which was never the broken half', () => {
    expect(fn).toContain('board_config: body.boardConfig');
    expect(fn).toContain('update.board_config = body.boardConfig');
  });
});
