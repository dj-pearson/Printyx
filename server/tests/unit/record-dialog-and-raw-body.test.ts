/**
 * The create-or-edit dialog, and a guard that was reading half its class.
 *
 * FOUR CATALOGUE PAGES GOT THE DIALOG WRONG IN THREE WAYS, because each was
 * written by copying the last: ManagedServices and ProfessionalServices had an
 * Edit button whose `setSelected(row)` nothing read, Supplies had the same, and
 * EnhancedProductAccessories DID read it but its Add button did not clear it -
 * so opening Add after a cancelled Edit left the form populated with the
 * previous row and submitted a PATCH against it under a dialog headed "Add New
 * Accessory". That last one is the worst of the three: it looks like a
 * prefilled duplicate and silently edits.
 *
 * `useRecordDialog` resets the mode and the form together, so no opening path
 * can inherit the previous one.
 *
 * SEPARATELY, `check:raw-body-writes` matched LINE BY LINE. `.update({ ...body`
 * had to be on one line, and prettier breaks it onto two the moment the literal
 * has a second key - which it always does, because `updated_at` is always
 * there. Eleven sites had been invisible since the guard shipped, including
 * `supplies:update:supplies`, which this round maps.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordDialogTransition } from '../../../client/src/hooks/use-record-dialog';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

interface Row {
  id: string;
}

describe('the dialog cannot inherit the previous mode', () => {
  it('create opens empty, in create mode, and resets the form to nothing', () => {
    // `resetWith: undefined` means EMPTY IT, which is not the same as not
    // resetting - conflating the two is how Add after an Edit kept the previous
    // row's values on screen under a dialog headed "Add New".
    expect(recordDialogTransition<Row>('create')).toEqual({
      open: true,
      editing: null,
      resetWith: undefined,
    });
  });

  it('edit carries the row into BOTH the mode and the form reset', () => {
    expect(recordDialogTransition<Row>('edit', { id: 'a' })).toEqual({
      open: true,
      editing: { id: 'a' },
      resetWith: { id: 'a' },
    });
  });

  it('close clears the target, so a cancelled edit cannot survive it', () => {
    // The real sequence behind the accessories defect: edit, cancel, add.
    expect(recordDialogTransition<Row>('close')).toEqual({
      open: false,
      editing: null,
      resetWith: undefined,
    });
  });

  it('no action leaves the mode and the form disagreeing', () => {
    // The property, stated once over every action: editing is non-null exactly
    // when the form was reset WITH a row.
    for (const [action, row] of [
      ['create', undefined],
      ['edit', { id: 'a' }],
      ['close', undefined],
    ] as const) {
      const t = recordDialogTransition<Row>(action, row as Row | undefined);
      expect({ action, agrees: (t.editing !== null) === (t.resetWith !== undefined) }).toEqual({
        action,
        agrees: true,
      });
    }
  });

  it('the hook has ONE application site, so no path can skip the reset', () => {
    // Three separate bodies is how four pages ended up with three different
    // bugs; the source check is the part a pure test cannot make.
    const HOOK = strip(read('client/src/hooks/use-record-dialog.ts'));
    expect(HOOK.match(/reset\(next\.resetWith\)/g) ?? []).toHaveLength(1);
    for (const fn of ['startCreate', 'startEdit', 'close']) {
      expect({
        fn,
        viaApply: new RegExp(`const ${fn} = useCallback\\(.{0,60}apply\\(`, 's').test(HOOK),
      }).toEqual({
        fn,
        viaApply: true,
      });
    }
  });

  it('dialogProps handles the close half only', () => {
    // Every opening path goes through startCreate or startEdit, which set the
    // mode submit reads; an onOpenChange(true) that bypassed them would open
    // the dialog in whatever mode was last used.
    const HOOK = strip(read('client/src/hooks/use-record-dialog.ts'));
    expect(HOOK).toMatch(/onOpenChange: \(next: boolean\) => \{\s*if \(!next\) close\(\);/);
  });
});

describe('the pages that had the copies now use it', () => {
  const PAGES = [
    'client/src/pages/Supplies.tsx',
    'client/src/pages/EnhancedProductAccessories.tsx',
  ];

  it('each drives its dialog through the hook, with no hand-rolled state left', () => {
    for (const p of PAGES) {
      const src = strip(read(p));
      expect({ p, hook: src.includes('useRecordDialog<') }).toEqual({ p, hook: true });
      expect({ p, props: src.includes('{...dialog.dialogProps}') }).toEqual({ p, props: true });
      // The old state and its setter must be gone, or two sources of truth
      // disagree about which mode the form is in.
      expect({ p, stale: /setDialogOpen\(/.test(src) }).toEqual({ p, stale: false });
    }
  });

  it('Add goes through startCreate on both, not straight to open', () => {
    for (const p of PAGES) {
      const src = strip(read(p));
      expect({ p, add: src.includes('dialog.startCreate') }).toEqual({ p, add: true });
    }
  });

  it("Supplies' Edit button is wired rather than setting dead state", () => {
    const src = strip(read('client/src/pages/Supplies.tsx'));
    expect(src).toContain('dialog.startEdit(supply)');
    expect(src).not.toMatch(/setSelectedSupply\(/);
    expect(src).toContain("apiRequest(`/api/supplies/${id}`, 'PATCH', data)");
  });

  it('submit branches on the hook, so editing never creates a duplicate', () => {
    expect(strip(read('client/src/pages/Supplies.tsx'))).toMatch(/if \(dialog\.editing\)/);
    expect(strip(read('client/src/pages/EnhancedProductAccessories.tsx'))).toMatch(
      /if \(dialog\.isEditing\)/,
    );
  });
});

describe('the supplies update path', () => {
  const FN = strip(read('supabase/functions/supplies/index.ts'));

  it('accepts PATCH as well as PUT, because Express serves PATCH', () => {
    // One verb each meant one host always 404'd.
    expect(FN).toMatch(/req\.method === 'PUT' \|\| req\.method === 'PATCH'/);
    expect(read('server/routes-products-crud.ts')).toMatch(
      /app\.patch\(\s*\n?\s*'\/api\/supplies\/:id'/,
    );
  });

  it('maps columns instead of spreading the body', () => {
    const at = FN.indexOf("req.method === 'PUT' || req.method === 'PATCH'");
    const branch = FN.slice(at, FN.indexOf("subResource === 'adjust'"));
    expect(branch).not.toMatch(/\.\.\.body/);
    expect(branch).toContain("set('product_code'");
    expect(branch).toContain("set('price_book_id'");
    expect(branch).toContain("eq('tenant_id', tenantId)");
  });

  it('an empty patch is a 400, not a 200 that bumps updated_at', () => {
    expect(FN).toContain('EMPTY_PATCH');
  });
});

describe('the raw-body guard reads the whole class now', () => {
  const GUARD = read('scripts/check-raw-body-writes.mjs');
  const BASELINE = JSON.parse(read('docs/raw-body-writes-baseline.json'));

  it('matches across newlines rather than line by line', () => {
    // The single-line requirement is what hid eleven sites: prettier breaks the
    // spread onto its own line whenever the literal has a second key.
    expect(GUARD).toMatch(/while \(\(match = SPREAD\.exec\(src\)\) !== null\)/);
    expect(GUARD).not.toMatch(/SPREAD\.exec\(lines\[i\]\)/);
  });

  it('the baseline records WHY it grew, so the jump is not read as a regression', () => {
    expect(BASELINE.count).toBe(BASELINE.writes.length);
    expect(BASELINE.note).toMatch(/BECAUSE THE GUARD GOT BETTER/);
  });

  it('an --update-baseline keeps a note somebody wrote', () => {
    /**
     * The writer regenerated the default note every time, so the explanation
     * above - the one thing stopping a reader taking the jump for a regression
     * - was discarded by the next tighten. It cost two rounds before this test
     * caught it. A generated file that throws away the prose in it is a
     * generated file nobody can annotate.
     */
    expect(GUARD).toMatch(/note: existingNote \?\? DEFAULT_NOTE/);
    expect(GUARD).toMatch(/const existingNote = \(\) =>|const existingNote = \(\(\) => \{/);
  });

  it('supplies is fixed rather than baselined', () => {
    expect(BASELINE.writes).not.toContain('supabase/functions/supplies/index.ts:update:supplies');
  });
});
