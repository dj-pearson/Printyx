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

/**
 * The lead half of AC10 (added with the LeadDetail rewrite).
 *
 * A third joint, and it had failed the same silent way as the other two: the
 * leads layout named `estimatedAmount` and `leadSource`, which are the DRIZZLE
 * field names, while GET /leads/:id returns the raw row - it is the one read
 * path in that function with no toCamel - and the page normalises it to
 * `estimatedDealValue` and `source`. Both fields resolved to nothing.
 *
 * So the contract is between the layout and the PAGE'S NORMALIZER, not between
 * the layout and the schema. Nothing typechecks it: one side is a string
 * literal in shared/, the other an object literal in a .tsx.
 */
const LEAD_PAGE = read('client/src/pages/LeadDetail.tsx');
/**
 * Comments blanked, for the absence assertions only. The page header explains
 * that the `editForm` bulk save was removed, and the first version of the test
 * below matched that explanation and reported it as the defect - the trap
 * CLAUDE.md records for check:edge-coverage, which has now fired here too.
 */
const LEAD_CODE = LEAD_PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** The keys the page's normalizer puts on the record it hands the engine. */
const leadRecordKeys = (() => {
  const start = LEAD_PAGE.indexOf('const lead = rawData');
  const block = LEAD_PAGE.slice(start, LEAD_PAGE.indexOf(': null;', start));
  return new Set([...block.matchAll(/^\s+([A-Za-z][A-Za-z0-9]*):\s*rawData\./gm)].map((m) => m[1]));
})();

describe('the lead layout names fields the lead page actually produces', () => {
  it('has a non-trivial normalizer to check against', () => {
    // The extraction guard the deals block above already carries: a regex that
    // matched nothing would make the next assertion pass while proving nothing.
    expect(leadRecordKeys.size).toBeGreaterThan(15);
    expect(leadRecordKeys.has('companyName')).toBe(true);
  });

  it('every field resolves to a normalised key or a pass-through column', () => {
    // `...rawData` carries every column through, so a single-word snake-free
    // column (status, industry, city) is present without being normalised.
    const passThrough = new Set([
      'status',
      'industry',
      'website',
      'source',
      'priority',
      'city',
      'state',
      'territory',
      'probability',
    ]);
    const missing = DEFAULT_LAYOUTS.leads.flatMap((s) =>
      s.propertyFields
        .map((f) => f.field)
        .filter((f) => !leadRecordKeys.has(f) && !passThrough.has(f)),
    );
    expect(missing).toEqual([]);
  });

  it('does not name the two that were broken', () => {
    const fields = DEFAULT_LAYOUTS.leads.flatMap((s) => s.propertyFields.map((f) => f.field));
    expect(fields).not.toContain('estimatedAmount');
    expect(fields).not.toContain('leadSource');
    expect(fields).toContain('estimatedDealValue');
    expect(fields).toContain('source');
  });

  it('every editable lead field is one the write path can store', () => {
    // COP-M01: PUT /leads/:id maps camelCase through
    // _shared/business-record-write.ts. A field it cannot resolve comes back in
    // ignoredFields, which the page now surfaces - but a SHIPPED layout should
    // never put a rep in that position.
    const writer = read('supabase/functions/_shared/business-record-write.ts');
    const columns = new Set([...writer.matchAll(/^\s+'([a-z_0-9]+)',$/gm)].map((m) => m[1]));
    const aliases = new Set(
      [...writer.matchAll(/^\s+([a-z0-9]+):\s*'[a-z_]+',$/gm)].map((m) => m[1]),
    );
    expect(columns.size).toBeGreaterThan(80);

    const snake = (f: string) => f.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    const unstorable = DEFAULT_LAYOUTS.leads.flatMap((s) =>
      s.propertyFields
        .filter((f) => f.editable)
        .map((f) => f.field)
        .filter((f) => !columns.has(snake(f)) && !aliases.has(f.toLowerCase())),
    );
    expect(unstorable).toEqual([]);
  });
});

describe('the lead page renders through the engine', () => {
  it('uses RecordPageLayout rather than its own grid', () => {
    expect(LEAD_PAGE).toContain('<RecordPageLayout');
    expect(LEAD_PAGE).toContain('objectType="leads"');
  });

  it('supplies a slot for every default section that has no fields', () => {
    const slotBlock = LEAD_PAGE.slice(LEAD_PAGE.indexOf('slots={{'));
    for (const section of DEFAULT_LAYOUTS.leads) {
      if (section.propertyFields.length > 0) continue;
      expect(slotBlock.slice(0, 400), section.sectionId).toContain(`'${section.sectionId}'`);
    }
  });

  it('saves one field at a time instead of a bulk editForm', () => {
    // The 30-key editForm posted every field in one body and, because
    // PUT /leads/:id spread that body into PostgREST, answered "Failed to
    // update lead" in production every time (COP-M01).
    expect(LEAD_CODE).toContain('onFieldSave');
    expect(LEAD_CODE).not.toContain('editForm');
    expect(LEAD_CODE).not.toContain('setIsEditing');
  });

  it('tells the rep when the server did not store what they typed', () => {
    // The endpoint reports ignoredFields/refusedFields. Dropping that on the
    // floor would put the page back where COP-B06 started: a narrowing nobody
    // can see.
    expect(LEAD_PAGE).toContain('ignoredFields');
    expect(LEAD_PAGE).toContain('refusedFields');
  });
});
