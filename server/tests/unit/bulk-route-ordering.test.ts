// PROD-014: the bulk branches only work if they sit ABOVE the generic :id
// branch of the same method. That ordering IS the fix — a bulk-delete branch
// placed after the :id delete is dead code, and the symptom returns exactly as
// it was: a 200 saying the delete succeeded while nothing was deleted.
//
// Source order is not something a unit test of the handler could observe, so it
// is asserted on the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8');

const CASES = [
  {
    file: 'supabase/functions/product-models/index.ts',
    bulk: "req.method === 'DELETE' && modelId === 'bulk-delete'",
    generic: "req.method === 'DELETE' && modelId) {",
  },
  {
    file: 'supabase/functions/software-products/index.ts',
    bulk: "req.method === 'DELETE' && productId === 'bulk-delete'",
    generic: "req.method === 'DELETE' && productId) {",
  },
  {
    file: 'supabase/functions/invoices/index.ts',
    bulk: "req.method === 'POST' && invoiceId === 'bulk-delete'",
    generic: "req.method === 'POST') {",
  },
  {
    file: 'supabase/functions/invoices/index.ts',
    bulk: "req.method === 'POST' && invoiceId === 'bulk-update'",
    generic: "req.method === 'POST') {",
  },
];

describe('bulk branches precede the generic branch they would fall into', () => {
  it.each(CASES)('$bulk', ({ file, bulk, generic }) => {
    const src = read(file);
    const bulkAt = src.indexOf(bulk);
    const genericAt = src.indexOf(generic);
    expect(bulkAt, `bulk branch missing in ${file}`).toBeGreaterThan(-1);
    expect(genericAt, `generic branch missing in ${file}`).toBeGreaterThan(-1);
    expect(bulkAt).toBeLessThan(genericAt);
  });
});

describe('the bulk branches do what the Express originals do', () => {
  it('scopes every bulk write to the tenant', () => {
    for (const file of [
      'supabase/functions/product-models/index.ts',
      'supabase/functions/software-products/index.ts',
      'supabase/functions/invoices/index.ts',
    ]) {
      const src = read(file);
      for (const chunk of src.split("=== 'bulk-").slice(1)) {
        const branch = chunk.slice(0, 1600);
        expect(branch).toContain("eq('tenant_id', tenantId)");
        expect(branch).toContain("in('id', parsed.ids)");
      }
    }
  });

  it('parses through the shared helper rather than reading body.ids directly', () => {
    for (const file of [
      'supabase/functions/product-models/index.ts',
      'supabase/functions/software-products/index.ts',
      'supabase/functions/invoices/index.ts',
    ]) {
      const src = read(file);
      expect(src).toContain("from '../_shared/bulk-ops.ts'");
      expect(src).not.toMatch(/const \{ ids \} = (await )?(body|req)/);
    }
  });

  it('reports what was actually deleted, not what was asked for', () => {
    // The product catalog deletes select back the ids they removed. Reporting
    // ids.length instead would restate the request and hide a partial delete —
    // a quieter version of the bug being fixed.
    for (const file of [
      'supabase/functions/product-models/index.ts',
      'supabase/functions/software-products/index.ts',
    ]) {
      const src = read(file);
      const at = src.indexOf("=== 'bulk-delete'");
      const branch = src.slice(at, at + 1400);
      expect(branch).toContain(".select('id')");
      expect(branch).toContain('(deleted ?? []).length');
    }
  });

  it("refuses a bulk update whose ids are not all this tenant's", () => {
    const src = read('supabase/functions/invoices/index.ts');
    const at = src.indexOf("invoiceId === 'bulk-update'");
    const branch = src.slice(at, at + 2200);
    expect(branch).toContain('invalidIds');
    expect(branch).toContain('not found or not accessible');
    expect(read('server/routes-bulk-operations.ts')).toContain('not found or not accessible');
  });
});
