// CRM-008: the layout engine, and the three ways a stored layout goes wrong.
//
// A layout is a snapshot of what the product looked like the day an admin
// pressed save. Everything here is about what happens when the product moves
// on and the snapshot does not.
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_LAYOUTS,
  isValidSection,
  mergeLayout,
  resolveLayout,
  type LayoutSection,
} from '@shared/record-layout';

const section = (over: Partial<LayoutSection> = {}): LayoutSection => ({
  sectionId: 's1',
  title: 'Section',
  position: 'left',
  order: 0,
  collapsed: false,
  propertyFields: [{ field: 'amount', label: 'Amount', editable: true }],
  ...over,
});

describe('DEFAULT_LAYOUTS', () => {
  it('ships a complete deal page, so a tenant with no stored row still renders', () => {
    const ids = DEFAULT_LAYOUTS.deals.map((s) => s.sectionId);
    expect(ids).toContain('deal-header');
    expect(ids).toContain('deal-timeline');
    expect(DEFAULT_LAYOUTS.deals.some((s) => s.position === 'right')).toBe(true);
  });

  it('gives every section a unique id, per object type', () => {
    for (const [objectType, sections] of Object.entries(DEFAULT_LAYOUTS)) {
      const ids = sections.map((s) => s.sectionId);
      expect(new Set(ids).size, objectType).toBe(ids.length);
    }
  });
});

describe('mergeLayout — rule 1: stored is authoritative but not total', () => {
  it('returns the shipped layout when nothing is stored', () => {
    expect(mergeLayout(null, 'deals').map((s) => s.sectionId)).toEqual(
      DEFAULT_LAYOUTS.deals.map((s) => s.sectionId),
    );
    expect(mergeLayout([], 'deals')).toHaveLength(DEFAULT_LAYOUTS.deals.length);
  });

  it('KEEPS A SECTION SHIPPED AFTER THE LAYOUT WAS SAVED', () => {
    // The alternative is that adding a section makes it invisible to every
    // tenant that has ever customised a layout, with nothing saying so.
    const stored = [section({ sectionId: 'deal-about', position: 'left', order: 0 })];
    const ids = mergeLayout(stored, 'deals').map((s) => s.sectionId);
    expect(ids).toContain('deal-timeline');
    expect(ids).toContain('deal-header');
  });

  it('appends a newly shipped section AFTER the stored ones in its position', () => {
    // A new section must not reorder a layout somebody arranged on purpose.
    const stored = [
      section({ sectionId: 'deal-contact', position: 'left', order: 0 }),
      section({ sectionId: 'deal-about', position: 'left', order: 1 }),
    ];
    const left = mergeLayout(stored, 'deals')
      .filter((s) => s.position === 'left')
      .sort((a, b) => a.order - b.order)
      .map((s) => s.sectionId);
    expect(left.slice(0, 2)).toEqual(['deal-contact', 'deal-about']);
    expect(left).toContain('deal-copier');
    expect(left.indexOf('deal-copier')).toBeGreaterThan(1);
  });

  it('honours a DELIBERATE removal, which says so with hidden', () => {
    const stored = [section({ sectionId: 'deal-copier', hidden: true })];
    const merged = mergeLayout(stored, 'deals');
    expect(merged.find((s) => s.sectionId === 'deal-copier')?.hidden).toBe(true);
  });

  it('keeps the stored order, position and collapsed state', () => {
    const stored = [
      section({ sectionId: 'deal-copier', position: 'right', order: 7, collapsed: true }),
    ];
    const merged = mergeLayout(stored, 'deals').find((s) => s.sectionId === 'deal-copier');
    expect(merged).toMatchObject({ position: 'right', order: 7, collapsed: true });
  });

  it('falls back to the shipped fields when a stored section carries none', () => {
    // An empty card is worse than the default: it looks like the record is blank.
    const stored = [section({ sectionId: 'deal-about', propertyFields: [] })];
    const merged = mergeLayout(stored, 'deals').find((s) => s.sectionId === 'deal-about');
    expect(merged?.propertyFields.length).toBeGreaterThan(0);
  });

  it('keeps a section the product no longer ships, rather than discarding it here', () => {
    // resolveLayout is what reports it - dropping it in the merge would lose
    // the information that the layout names something unknown.
    const stored = [section({ sectionId: 'deal-retired-in-v2' })];
    expect(mergeLayout(stored, 'deals').map((s) => s.sectionId)).toContain('deal-retired-in-v2');
  });
});

describe('resolveLayout — rules 2 and 3', () => {
  const FIELDS = ['amount', 'source'];

  it('REPORTS a section the page has no renderer for', () => {
    const r = resolveLayout([section({ sectionId: 'ghost' })], ['s1'], FIELDS);
    expect(r.unrenderable).toEqual(['ghost']);
    expect(r.positions.left).toEqual([]);
  });

  it('DROPS AND NAMES a field the record does not carry', () => {
    // A renamed column would otherwise render as blank rows, which reads as
    // "this deal has no data" rather than "this layout is stale".
    const r = resolveLayout(
      [
        section({
          propertyFields: [
            { field: 'amount', label: 'Amount', editable: true },
            { field: 'renamed_last_release', label: 'Gone', editable: true },
          ],
        }),
      ],
      ['s1'],
      FIELDS,
    );
    expect(r.unknownFields).toEqual(['s1.renamed_last_release']);
    expect(r.positions.left[0].propertyFields.map((f) => f.field)).toEqual(['amount']);
  });

  it('checks NOTHING while the record is still loading', () => {
    // An empty field set means "do not check". Reporting every field as
    // unknown on first paint would be a page-wide false alarm.
    const r = resolveLayout([section()], ['s1'], []);
    expect(r.unknownFields).toEqual([]);
    expect(r.positions.left[0].propertyFields).toHaveLength(1);
  });

  it('omits a hidden section without calling it unrenderable', () => {
    const r = resolveLayout([section({ hidden: true })], ['s1'], FIELDS);
    expect(r.positions.left).toEqual([]);
    expect(r.unrenderable).toEqual([]);
  });

  it('orders each position, and ties break deterministically', () => {
    const r = resolveLayout(
      [
        section({ sectionId: 'b', order: 1 }),
        section({ sectionId: 'a', order: 1 }),
        section({ sectionId: 'c', order: 0 }),
      ],
      ['a', 'b', 'c'],
      FIELDS,
    );
    expect(r.positions.left.map((s) => s.sectionId)).toEqual(['c', 'a', 'b']);
  });

  it('separates the four positions', () => {
    const r = resolveLayout(
      [
        section({ sectionId: 'h', position: 'header' }),
        section({ sectionId: 'c', position: 'center' }),
        section({ sectionId: 'r', position: 'right' }),
      ],
      ['h', 'c', 'r'],
      FIELDS,
    );
    expect(r.positions.header.map((s) => s.sectionId)).toEqual(['h']);
    expect(r.positions.center.map((s) => s.sectionId)).toEqual(['c']);
    expect(r.positions.right.map((s) => s.sectionId)).toEqual(['r']);
    expect(r.positions.left).toEqual([]);
  });

  it('resolves the shipped deal layout with nothing left over', () => {
    const merged = mergeLayout(null, 'deals');
    const r = resolveLayout(
      merged,
      merged.map((s) => s.sectionId),
      [],
    );
    expect(r.unrenderable).toEqual([]);
    expect(r.positions.center).toHaveLength(1);
  });
});

describe('isValidSection', () => {
  it('accepts a well-formed section', () => {
    expect(isValidSection(section())).toBe(true);
  });

  it('rejects a bad position, a missing id and a non-array field list', () => {
    expect(isValidSection({ ...section(), position: 'middle' })).toBe(false);
    expect(isValidSection({ ...section(), sectionId: '' })).toBe(false);
    expect(isValidSection({ ...section(), propertyFields: null })).toBe(false);
    expect(isValidSection(null)).toBe(false);
    expect(isValidSection('left')).toBe(false);
  });
});
