/**
 * COP-E02 cannot retire the Sales Pipeline board yet, and this records why.
 *
 * The story's AC3 says no records may become invisible when the two
 * non-canonical boards go. That is not satisfiable today, because the boards do
 * not read the same TABLE:
 *
 *   /crm/leads (canonical)     -> /api/business-records -> `companies`
 *   /sales-pipeline            -> /api/sales-pipeline   -> `business_records`
 *
 * COP-B00 named this contradiction and it is still open. Both tables have live
 * writers, so the split runs in both directions: an account created through the
 * CRM list lands in `companies` and never appears on the pipeline board, and a
 * lead created by `public-booking` - a prospect self-scheduling a meeting -
 * lands in `business_records` and never appears on the canonical Leads list.
 *
 * These assertions are designed to FAIL once COP-B00 reconciles the two, which
 * is the point: the day both surfaces read one table, the retirement this story
 * asks for becomes safe and this file should be deleted with it. Same treatment
 * as server/tests/unit/payment-audit-not-wired.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Every table a function hands to PostgREST, comments stripped. */
function tablesIn(path: string): Set<string> {
  const src = read(path)
    .replace(/(?<!:)\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set([...src.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]));
}

describe('the two CRM boards read different tables', () => {
  const canonical = tablesIn('supabase/functions/business-records/index.ts');
  const pipeline = tablesIn('supabase/functions/sales-pipeline/index.ts');

  it('has a corpus to check', () => {
    expect(canonical.size).toBeGreaterThan(2);
    expect(pipeline.size).toBeGreaterThan(0);
  });

  it('the canonical CRM list reads companies', () => {
    // Its own header calls it "a backwards-compatible wrapper that delegates to
    // the companies table".
    expect(canonical.has('companies')).toBe(true);
  });

  it('the Sales Pipeline board reads business_records', () => {
    expect(pipeline.has('business_records')).toBe(true);
    expect(pipeline.has('companies')).toBe(false);
  });

  it('both tables have live writers, so the split runs both ways', () => {
    // A prospect self-scheduling through the public booking page becomes a
    // business_records row, which the canonical Leads list cannot show.
    const booking = read('supabase/functions/public-booking/index.ts');
    expect(booking).toContain("from('business_records')");
    expect(booking).toMatch(/record_type: 'lead'/);

    // An account created through the CRM list becomes a companies row, which
    // the pipeline board cannot show.
    const crmWrite = read('supabase/functions/business-records/index.ts');
    expect(crmWrite).toMatch(
      /from\('companies'\)\s*\n?\s*\.insert\(|business_record_type: body\.recordType/,
    );
  });
});

describe('COP-E02 leaves both boards routed until that is settled', () => {
  it('keeps the pages', () => {
    // Deleting them per AC5 would make records invisible per AC3. The two ACs
    // are in tension only because the tables have not been reconciled.
    for (const page of ['ProspectsPage', 'SalesPipelineWorkflow']) {
      expect(existsSync(join(ROOT, `client/src/pages/${page}.tsx`))).toBe(true);
    }
  });

  it('states the dependency where somebody deleting them would look', () => {
    const board = read('client/src/pages/SalesPipelineWorkflow.tsx');
    expect(board).toContain('COP-B00');
  });

  it('has no canonical board for prospects to redirect to either', () => {
    // AC4 wants /prospects redirected to the canonical board with a preset
    // view. The leads config is pinned to record_type lead, and the companies
    // config has no board at all, so there is nowhere to send it.
    const registry = read('client/src/lib/crm-object-registry.ts');
    const leads = registry.slice(
      registry.indexOf("objectType: 'leads'"),
      registry.indexOf("objectType: 'contacts'"),
    );
    expect(leads).toContain("recordType: 'lead'");
    const companies = registry.slice(registry.indexOf("objectType: 'companies'"));
    expect(companies).not.toMatch(/hasBoardView:\s*true/);
  });
});
