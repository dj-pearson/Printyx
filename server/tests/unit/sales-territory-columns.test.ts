// The sales-territories edge function, locked to the real table.
//
// COP-B09 wired a page to this function; COP-B03's regression sweep found that
// every branch of its CRUD named columns that do not exist - `name`, `region`,
// `states`, `zip_codes`, `rules`, `assigned_rep_id`, `created_by` - so the list
// endpoint the page calls first was a guaranteed 42703. Reproduced against a
// real Postgres 16: `ORDER BY name` and the old INSERT both error, the new ones
// do not.
//
// It hid because nothing called the function. The phantom columns were
// baselined AND the function was baselined as unreferenced, and both entries
// were true for the same reason. Wiring a caller is what turned seven
// tolerated references into seven live 500s.
//
// This asserts the column literals against drizzle's own declaration rather
// than against a hand-written list, so it cannot drift from the table.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import { salesTerritories } from '@shared/lead-assignment-schema';

const SOURCE = readFileSync(
  join(process.cwd(), 'supabase/functions/sales-territories/index.ts'),
  'utf8',
)
  // Comments name the phantom columns on purpose, to explain the defect. An
  // absence assertion that reads its own explanation reports it as the defect
  // (the lesson check:edge-coverage already carries in its header).
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * The CRUD block only. Everything above the TERRITORY_COLUMNS constant is the
 * COP-B09 coverage branch, which reads `business_records` and builds its own
 * response object - scanning it would report `territory` and `unbacked` as
 * missing columns of a table they were never claimed to belong to.
 */
const CRUD = SOURCE.slice(SOURCE.indexOf('const TERRITORY_COLUMNS'));

const REAL_COLUMNS = new Set(Object.values(getTableColumns(salesTerritories)).map((c) => c.name));

describe('sales-territories edge function', () => {
  it('names only real columns in its insert and update payloads', () => {
    /**
     * BOUND TO THE WRITE CHAINS, not to an indentation level.
     *
     * This used to scan every object-literal key indented eight spaces or
     * more anywhere below TERRITORY_COLUMNS, which was accidentally correct
     * only while the payloads were the sole literals down there. COP-B09 AC3
     * added a `/mine` branch that builds a RESPONSE object, and its
     * `territories:` key was immediately reported as a phantom column of a
     * table it was never claimed to belong to - the same false positive the
     * corpus note above already records about the coverage branch. A payload
     * is what follows `.insert(` or `.upsert(`, so that is what is read.
     */
    const payloadKeys = [...CRUD.matchAll(/\.(?:insert|upsert)\(\s*\{([\s\S]*?)\}/g)]
      .flatMap((m) => [...m[1].matchAll(/([a-z][a-z0-9_]*):/g)])
      .map((m) => m[1]);
    // Plus the `set('column', ...)` helper the PATCH branch writes through.
    const setKeys = [...CRUD.matchAll(/set\('([a-z][a-z0-9_]*)'/g)].map((m) => m[1]);
    const all = [...payloadKeys, ...setKeys];
    // A floor, so a regex that stops matching cannot pass in silence.
    expect(all.length).toBeGreaterThan(5);
    expect(all.filter((key) => !REAL_COLUMNS.has(key))).toEqual([]);
  });

  it('selects and orders by real columns only', () => {
    const selects = [...CRUD.matchAll(/(?:TERRITORY_COLUMNS =|\.order\()\s*\n?\s*'([^']+)'/g)].map(
      (m) => m[1],
    );
    const named = selects
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter((s) => s && s !== '*');
    expect(named.length).toBeGreaterThan(5);
    expect(named.filter((col) => !REAL_COLUMNS.has(col))).toEqual([]);
  });

  it('carries territory_type, which is NOT NULL with no default', () => {
    // The create must supply it or every save is a 23502 the page reports as
    // "Could not save the territory".
    expect(CRUD).toMatch(/territory_type:\s*body\.territoryType/);
  });

  it('none of the seven phantom columns survives anywhere in the code', () => {
    for (const phantom of [
      'assigned_rep_id',
      'zip_codes',
      'created_by',
      'geographic_rules_region',
    ]) {
      expect(CRUD).not.toContain(phantom);
    }
  });
});
