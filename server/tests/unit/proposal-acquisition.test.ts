/**
 * WF-C-05: how the deal is paid, and what acceptance creates because of it.
 *
 * Both accept paths - the public /p/:token respond and the internal status
 * change - called createContractFromProposal and nothing else, whatever the
 * proposal said. `leases` carried proposal_id, business_record_id and
 * contract_id columns that no code filled; `proposals.payment_terms` was written
 * by nothing and read by nothing. So a leased fleet was indistinguishable from a
 * cash sale the moment the customer clicked Accept, and the lease that had to
 * exist for billing, renewal and end-of-term never did.
 *
 * The rule these tests exist to hold is the one WF-C-09 established on the
 * contract path one story earlier: `leases` has eleven NOT NULL columns, and a
 * proposal that does not state a term, a monthly payment and a first payment
 * date does NOT get today's date and a 36-month default. It gets no lease and a
 * reason.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import { leases } from '../../../shared/schema';
import {
  ACQUISITION_TYPES,
  FINANCED_ACQUISITION_TYPES,
  addMonths,
  normalizeAcquisitionType,
  planLeaseFromProposal,
} from '../../../shared/lease-draft';

const CTX = {
  tenantId: 'tenant-1',
  contractId: 'contract-1',
  createdBy: 'user-1',
  leaseNumber: 'LS-2026-0001',
};

const proposal = (over: Record<string, unknown> = {}) => ({
  id: 'prop-1',
  title: 'Fleet refresh - 4 MFPs',
  proposal_number: 'PROP-2026-0007',
  business_record_id: 'acct-1',
  acquisition_type: 'lease',
  funding_partner: 'DLL Financial',
  finance_term_months: 60,
  finance_monthly_payment: '412.50',
  first_payment_date: '2026-10-15T00:00:00.000Z',
  ...over,
});

const strip = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

describe('the three acquisition types', () => {
  it('a cash proposal creates the contract and no lease', () => {
    const plan = planLeaseFromProposal(proposal({ acquisition_type: 'cash' }), CTX);
    expect(plan.acquisitionType).toBe('cash');
    expect(plan.row).toBeNull();
    expect(plan.reason).toContain('cash');
  });

  it('a lease proposal drafts the lease from what the rep entered', () => {
    const plan = planLeaseFromProposal(proposal(), CTX);
    expect(plan.acquisitionType).toBe('lease');
    expect(plan.row).toMatchObject({
      tenant_id: 'tenant-1',
      lease_number: 'LS-2026-0001',
      lease_name: 'Fleet refresh - 4 MFPs',
      customer_id: 'acct-1',
      business_record_id: 'acct-1',
      proposal_id: 'prop-1',
      contract_id: 'contract-1',
      status: 'pending',
      monthly_payment: '412.50',
      term: 60,
      lessor_name: 'DLL Financial',
      created_by: 'user-1',
    });
    // 412.50 x 60. Derived, not typed in - the total is the one number a rep
    // would otherwise get wrong by a month.
    expect(plan.row?.total_amount).toBe('24750.00');
  });

  it('a finance proposal drafts a lease too - both put the machine on other paper', () => {
    const plan = planLeaseFromProposal(proposal({ acquisition_type: 'finance' }), CTX);
    expect(plan.acquisitionType).toBe('finance');
    expect(plan.row).not.toBeNull();
    expect(FINANCED_ACQUISITION_TYPES).toEqual(['lease', 'finance']);
  });

  it('a proposal that states nothing is contract-only, not a guessed cash sale', () => {
    for (const value of [null, undefined, '', 'Cash Or Something']) {
      const plan = planLeaseFromProposal(proposal({ acquisition_type: value }), CTX);
      expect(plan.acquisitionType).toBeNull();
      expect(plan.row).toBeNull();
      expect(plan.reason).toContain('does not state');
    }
  });

  it('normalizes case and whitespace, and rejects anything else', () => {
    expect(normalizeAcquisitionType(' Lease ')).toBe('lease');
    expect(normalizeAcquisitionType('FINANCE')).toBe('finance');
    expect(normalizeAcquisitionType('rental')).toBeNull();
    expect(normalizeAcquisitionType(3)).toBeNull();
    expect(ACQUISITION_TYPES).toEqual(['cash', 'lease', 'finance']);
  });
});

describe('incomplete terms produce no lease and a reason', () => {
  it.each([
    ['finance_term_months', 'term in months'],
    ['finance_monthly_payment', 'monthly payment'],
    ['first_payment_date', 'first payment date'],
  ])('refuses when %s is missing', (field, phrase) => {
    const plan = planLeaseFromProposal(proposal({ [field]: null }), CTX);
    expect(plan.row).toBeNull();
    expect(plan.reason).toContain(phrase);
    // The type is still reported, so the contract can carry it.
    expect(plan.acquisitionType).toBe('lease');
  });

  it('names every missing field at once rather than one per attempt', () => {
    const plan = planLeaseFromProposal(
      proposal({ finance_term_months: null, finance_monthly_payment: null }),
      CTX,
    );
    expect(plan.reason).toContain('term in months');
    expect(plan.reason).toContain('monthly payment');
  });

  it('rejects a zero or negative term and a zero payment', () => {
    expect(planLeaseFromProposal(proposal({ finance_term_months: 0 }), CTX).row).toBeNull();
    expect(planLeaseFromProposal(proposal({ finance_term_months: -6 }), CTX).row).toBeNull();
    expect(planLeaseFromProposal(proposal({ finance_monthly_payment: '0' }), CTX).row).toBeNull();
  });

  it('refuses when the proposal has no account, so the lease has no customer', () => {
    const plan = planLeaseFromProposal(proposal({ business_record_id: null }), CTX);
    expect(plan.row).toBeNull();
    expect(plan.reason).toContain('no account');
  });
});

describe('the dates it derives follow from the ones stated', () => {
  it('runs the schedule from the first payment date the rep entered', () => {
    const row = planLeaseFromProposal(proposal({ finance_term_months: 12 }), CTX).row!;
    expect(row.first_payment_date).toBe('2026-10-15T00:00:00.000Z');
    expect(row.start_date).toBe('2026-10-15T00:00:00.000Z');
    // 12 payments: the last is month 11, the term ends at month 12.
    expect(row.last_payment_date).toBe('2027-09-15T00:00:00.000Z');
    expect(row.end_date).toBe('2027-10-15T00:00:00.000Z');
    expect(row.payments_remaining).toBe(12);
  });

  it('clamps to the end of a shorter month instead of rolling into the next', () => {
    // 31 January plus one month is 28 February, not 3 March.
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(addMonths(new Date('2024-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    );
    expect(addMonths(new Date('2026-08-31T00:00:00Z'), 6).toISOString()).toBe(
      '2027-02-28T00:00:00.000Z',
    );
  });

  it('invents no date at all when the first payment is not stated', () => {
    const plan = planLeaseFromProposal(proposal({ first_payment_date: null }), CTX);
    expect(plan.row).toBeNull();
    expect(JSON.stringify(plan)).not.toContain(String(new Date().getFullYear()) + '-');
  });
});

describe('the row it writes is a real leases row', () => {
  const columns = getTableColumns(leases);
  const names = new Set(Object.values(columns).map((c) => c.name));
  const row = planLeaseFromProposal(proposal(), CTX).row!;

  it('names only columns that exist', () => {
    expect(Object.keys(row).filter((k) => !names.has(k))).toEqual([]);
  });

  it('fills every NOT NULL column the table has no default for', () => {
    const missing = Object.values(columns)
      .filter((c) => c.notNull && !c.hasDefault && !c.primary)
      .map((c) => c.name)
      .filter((name) => row[name] === undefined || row[name] === null);
    expect(missing).toEqual([]);
  });

  it('uses the enum values the columns declare', () => {
    expect(['fmv', 'dollar_buyout', 'ten_percent', 'trac', 'operating', 'capital']).toContain(
      row.lease_type,
    );
    expect([
      'pending',
      'active',
      'pending_renewal',
      'renewed',
      'expired',
      'terminated',
      'defaulted',
    ]).toContain(row.status);
  });
});

describe('the accept handler runs it, on both accept paths', () => {
  const handler = strip(readFileSync('supabase/functions/proposals/index.ts', 'utf8'));

  it('carries the acquisition type onto the contract', () => {
    expect(handler).toContain('acquisition_type: acquisitionType');
  });

  it('drafts the lease and links it back to the contract', () => {
    expect(handler).toContain('planLeaseFromProposal(proposal, {');
    expect(handler).toContain("from('leases')");
    expect(handler).toContain('lease_id: lease.id');
  });

  it('never fails an acceptance the customer already made', () => {
    // lastIndexOf: the first occurrence is the import at the top of the file.
    const at = handler.lastIndexOf('planLeaseFromProposal(proposal, {');
    expect(handler.slice(at - 400, at)).toContain('try {');
    expect(handler.slice(at, at + 1600)).toContain('lease_create_failed');
  });

  it('is reached from both the public respond and the internal status change', () => {
    const calls = handler.match(/createContractFromProposal\(/g) ?? [];
    // One definition plus the two call sites.
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts the five new fields on create and update', () => {
    expect(handler).toContain('acquisitionType: ');
    expect(handler).toContain("fundingPartner: 'funding_partner'");
    expect(handler).toContain("financeTermMonths: 'finance_term_months'");
    expect(handler).toContain("financeMonthlyPayment: 'finance_monthly_payment'");
    expect(handler).toContain("firstPaymentDate: 'first_payment_date'");
  });

  it('the Deno copy and the shared twin are the same logic', () => {
    const deno = readFileSync('supabase/functions/proposals/_acquisition.ts', 'utf8');
    const shared = readFileSync('shared/lease-draft.ts', 'utf8');
    expect(strip(deno)).toBe(strip(shared));
  });
});

describe('the surfaces that capture and show it', () => {
  it('the quote builder captures the acquisition and only sends terms when financed', () => {
    const builder = readFileSync('client/src/components/quote-builder/QuoteBuilder.tsx', 'utf8');
    expect(builder).toContain('name="acquisitionType"');
    expect(builder).toContain('acquisitionType: quote.acquisitionType || null');
    // Switching back to cash must not leave a stale term on the row.
    expect(builder).toContain(
      'fundingPartner: isFinanced(quote.acquisitionType) ? quote.fundingPartner || null : null',
    );
  });

  it('LeaseForm pre-fills from ?proposalId= using the same derivation', () => {
    const form = readFileSync('client/src/pages/LeaseForm.tsx', 'utf8');
    expect(form).toContain("get('proposalId')");
    expect(form).toContain("from '@shared/lease-draft'");
    expect(form).toContain('planLeaseFromProposal(');
  });

  it('the deal record shows the acquisition type and the lease', () => {
    const page = readFileSync('client/src/pages/DealDetail.tsx', 'utf8');
    expect(page).toContain('deal.contract?.acquisition_type');
    expect(page).toContain('label="Lease"');
    expect(page).toContain('label="Lessor"');
    const deals = strip(readFileSync('supabase/functions/deals/index.ts', 'utf8'));
    expect(deals).toContain("from('leases')");
    expect(deals).toContain('contract, lease');
  });

  it('the migration is journalled and adds all five columns', () => {
    const sql = readFileSync('drizzle/migrations/0076_wf_c05_proposal_acquisition.sql', 'utf8');
    for (const col of [
      'acquisition_type',
      'funding_partner',
      'finance_term_months',
      'finance_monthly_payment',
      'first_payment_date',
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${col}`);
    }
    expect(readFileSync('drizzle/migrations/meta/_journal.json', 'utf8')).toContain(
      '0076_wf_c05_proposal_acquisition',
    );
  });
});
