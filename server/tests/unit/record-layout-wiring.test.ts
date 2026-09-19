// CRM-008: the two joints where the layout engine meets the rest of the app.
//
// Both were real defects before this story, and neither is visible to tsc,
// because a layout section is a STRING and so is a PATCH field name.
//
//  1. An editable field the write path does not accept answers 200 and changes
//     nothing. `nextFollowUpDate` and the three primary-contact fields were in
//     exactly that state - real columns, read everywhere, absent from the
//     deals PATCH field map - so making them editable without fixing the map
//     would have shipped a form that silently discards what a rep types.
//
//  2. A section the default layout names and the page supplies no slot for
//     renders as nothing. The engine reports it rather than swallowing it,
//     but a shipped layout should never be in that state to begin with.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import { DEFAULT_LAYOUTS } from '@shared/record-layout';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const DEALS_FN = read('supabase/functions/deals/index.ts');
const DEAL_PAGE = read('client/src/pages/DealDetail.tsx');

/** The camelCase keys PATCH /api/deals/:id actually maps onto a column. */
const patchableDealFields = (() => {
  const block = DEALS_FN.slice(
    DEALS_FN.indexOf('const BULK_FIELD_MAP'),
    DEALS_FN.indexOf('};', DEALS_FN.indexOf('const BULK_FIELD_MAP')),
  );
  return new Set([...block.matchAll(/^\s+([A-Za-z][A-Za-z0-9]*):\s*'/gm)].map((m) => m[1]));
})();

describe('every editable field on the default deal layout can actually be saved', () => {
  it('has a non-trivial field map to check against', () => {
    // Guards the extraction itself: a regex that matches nothing would make
    // the assertion below pass while proving nothing.
    expect(patchableDealFields.size).toBeGreaterThan(20);
    expect(patchableDealFields.has('amount')).toBe(true);
  });

  it('maps every editable field onto a column', () => {
    const editable = DEFAULT_LAYOUTS.deals.flatMap((s) =>
      s.propertyFields.filter((f) => f.editable).map((f) => f.field),
    );
    expect(editable.length).toBeGreaterThan(5);
    expect(editable.filter((f) => !patchableDealFields.has(f))).toEqual([]);
  });

  it('includes the four that were missing before this story', () => {
    for (const field of [
      'nextFollowUpDate',
      'primaryContactName',
      'primaryContactEmail',
      'primaryContactPhone',
    ]) {
      expect(patchableDealFields.has(field), field).toBe(true);
    }
  });
});

describe('the deal page supplies a slot for every default section that needs one', () => {
  it('names every content section in its slots map', () => {
    const slotBlock = DEAL_PAGE.slice(DEAL_PAGE.indexOf('slots={{'));
    const needsSlot = DEFAULT_LAYOUTS.deals
      .filter((s) => s.propertyFields.length === 0)
      .map((s) => s.sectionId);
    expect(needsSlot.length).toBeGreaterThan(3);
    expect(needsSlot.filter((id) => !slotBlock.includes(`'${id}'`))).toEqual([]);
  });

  it('renders through the engine rather than its own three-column grid', () => {
    expect(DEAL_PAGE).toContain('<RecordPageLayout');
    expect(DEAL_PAGE).toContain('<RecordStageBar');
  });
});

describe('the Express router this replaced is gone', () => {
  it('is not registered anywhere', () => {
    // It could never run in production - /api/record-layout-config was
    // Express-only and unproxied - and nothing called it.
    const registry = read('server/routes-registry.ts').replace(/\/\/.*$/gm, '');
    expect(registry).not.toContain('registerRecordLayoutRoutes');
  });

  it('is proxied to the edge function on both hosts', () => {
    expect(read('server/middleware/edge-function-proxy.ts')).toContain(
      "'/api/record-layout-config': 'record-layout-config'",
    );
  });
});
