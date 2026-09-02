/**
 * WF-R-05: the sales surface.
 *
 * Ten sales edge functions contained no role check and no scope filter at all, so
 * a SALES_REP opening /leads, /crm/deals, /quotes or /commission-management saw
 * the whole company's - including, on the commission screen, every colleague's
 * gross pay, quota attainment and payout date.
 *
 * These assertions read each handler's own source for the columns it scopes on,
 * because the interesting failure is scoping the WRONG column: the first cut of
 * WF-R-04 filtered `companies` on owner_id and assigned_sales_rep, which are
 * columns of `business_records`. `companies` has neither, so the account list
 * would have answered 42703 in production.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const read = (p: string) => readFileSync(p, 'utf8');
/** Comments describe the gate as vividly as the code applies it. */
const code = (p: string) =>
  read(p)
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

const SCOPED: [string, string, string[]][] = [
  ['companies', 'supabase/functions/companies/index.ts', ['created_by']],
  ['leads', 'supabase/functions/leads/index.ts', ['owner_id', 'assigned_sales_rep']],
  ['quotes', 'supabase/functions/quotes/index.ts', ['created_by']],
  ['leases', 'supabase/functions/leases/handlers/leases.ts', ['created_by']],
  ['commission', 'supabase/functions/commission/index.ts', ['employee_id']],
];

describe('WF-R-05: the sales list handlers apply the scope', () => {
  for (const [name, file, columns] of SCOPED) {
    it(`${name} scopes on ${columns.join(' / ')}`, () => {
      const src = code(file);
      expect(src, `${name} must resolve a scope`).toMatch(/await resolveScope\(/);
      const call = /applyUserScope\(\s*[\w.]+,\s*(\[[^\]]*\]|'[a-z_]+')/.exec(src);
      expect(call, `${name} must apply it`).not.toBeNull();
      expect([...call![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual(columns);
    });
  }

  it('contracts scopes through the customer, naming no user of its own', () => {
    const src = code('supabase/functions/contracts/index.ts');
    expect(src).toMatch(/await accessibleCustomerIds\(/);
    expect(src).toMatch(/applyCustomerScope\(query, 'customer_id', customers, scope, null\)/);
  });
});

describe('WF-R-05: commission is somebody pay, and is treated as such', () => {
  it('never shows a calculation that belongs to nobody', () => {
    const src = code('supabase/functions/commission/index.ts');
    // Everywhere else an unowned row is shared work. A commission calculation
    // with no employee is a broken row, and showing it to a whole team is worse.
    expect(src).toMatch(/applyUserScope\([\s\S]{0,80}?includeUnowned: false/);
  });

  it('still lets a manager see their reports, via the resolved tier', () => {
    const src = code('supabase/functions/commission/index.ts');
    // The user set comes from resolveScope, not from a hardcoded [user.id].
    expect(src).toMatch(/const scope = await resolveScope\(/);
    expect(src).not.toMatch(/employee_id.*user\.id.*calculations/);
  });
});

describe('WF-R-05: the companies table cannot express ownership', () => {
  // AC2 asked for owner_id / assigned_sales_rep on these two handlers. It is not
  // possible: they serve `companies`, which has 37 columns and names one user,
  // `created_by`. `business_owner` is free text for the CUSTOMER's proprietor.
  // The columns AC2 names belong to `business_records` (CRMX-002's canonical
  // table). This test exists so the next reader does not "fix" it back.
  const schema = read('shared/schema.ts');
  const companiesBlock = (() => {
    const i = schema.search(/pgTable\(\s*'companies'/);
    let depth = 0;
    const start = schema.indexOf('{', i);
    for (let j = start; j < schema.length; j++) {
      if (schema[j] === '{') depth++;
      else if (schema[j] === '}' && --depth === 0) return schema.slice(i, j);
    }
    return '';
  })();

  it('has no owner_id and no assigned_sales_rep', () => {
    expect(companiesBlock).not.toMatch(/'owner_id'/);
    expect(companiesBlock).not.toMatch(/'assigned_sales_rep'/);
    expect(companiesBlock).toMatch(/'created_by'/);
  });

  it('business_records, which does have them, is what customer_id resolves to', () => {
    const i = schema.search(/pgTable\(\s*'business_records'/);
    let depth = 0;
    const start = schema.indexOf('{', i);
    let block = '';
    for (let j = start; j < schema.length; j++) {
      if (schema[j] === '{') depth++;
      else if (schema[j] === '}' && --depth === 0) {
        block = schema.slice(i, j);
        break;
      }
    }
    expect(block).toMatch(/'owner_id'/);
    expect(block).toMatch(/'assigned_sales_rep'/);

    // And the shared helper resolves customers there, not against companies.
    const scopeSrc = code('supabase/functions/_shared/scope.ts');
    expect(scopeSrc).toMatch(/\.from\('business_records'\)/);
    expect(scopeSrc).not.toMatch(/\.from\('companies'\)/);
  });

  it('the two companies-backed handlers keep unowned rows visible at every tier', () => {
    // These lists arrive by import with no creator. Excluding them would empty
    // the primary CRM screen for every rep rather than narrowing it.
    for (const file of [
      'supabase/functions/companies/index.ts',
      'supabase/functions/business-records/index.ts',
    ]) {
      expect(code(file), file).toMatch(/includeUnowned: true/);
    }
  });
});

describe('WF-R-05: every scoped handler honours ?scope=', () => {
  const HANDLERS = [
    'supabase/functions/companies/index.ts',
    'supabase/functions/leads/index.ts',
    'supabase/functions/quotes/index.ts',
    'supabase/functions/contracts/index.ts',
    'supabase/functions/commission/index.ts',
    'supabase/functions/business-records/index.ts',
    'supabase/functions/deals/index.ts',
    'supabase/functions/proposals/index.ts',
    'supabase/functions/service-tickets/index.ts',
    'supabase/functions/invoices/index.ts',
    'supabase/functions/equipment/index.ts',
    'supabase/functions/meter-readings/index.ts',
    'supabase/functions/purchase-orders/index.ts',
    'supabase/functions/tasks/handlers/tasks.ts',
    'supabase/functions/leases/handlers/leases.ts',
  ];

  for (const file of HANDLERS) {
    it(`${file.split('/')[2]} passes the requested scope through`, () => {
      expect(code(file)).toMatch(/requestedScope: url\.searchParams\.get\('scope'\)/);
    });
  }
});
