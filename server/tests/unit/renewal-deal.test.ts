// COP-M06: what a renewal draft becomes in the pipeline, and what a nightly
// re-run is allowed to change about it.
//
// Every rule here is one a sweep could get wrong silently: duplicating deals,
// reverting a rep's decision, resurrecting a closed deal, or overwriting the
// outcome the win-rate comparison is built on. None of that is visible to tsc
// and none of it fails loudly in production - it just quietly corrupts a
// pipeline overnight.
import { describe, it, expect } from 'vitest';

import {
  RENEWAL_DEAL_MOTION,
  RENEWAL_DEAL_SOURCE,
  buildRenewalDealInsert,
  buildRenewalDealUpdate,
  renewalDealTitle,
  renewalOutcomeForDealStatus,
  type RenewalDraftFacts,
} from '../../../supabase/functions/_shared/renewal-deal';

const FACTS: RenewalDraftFacts = {
  contractId: 'contract-1',
  customerId: 'account-1',
  companyName: 'Northgate Dental',
  quoteValue: 48250.489,
  contractEndDate: '2026-12-31T00:00:00.000Z',
  assignedSalesRep: 'rep-1',
  isUnderage: true,
  currentMonthlyRevenue: 3100,
  recommendedMonthlyRevenue: 4020.5,
};

const OPTS = { tenantId: 't-1', stageId: 'stage-1', fallbackUserId: 'user-9' };

describe('buildRenewalDealInsert', () => {
  it('lands on the canonical board with the renewal motion and the contract link', () => {
    const row = buildRenewalDealInsert(FACTS, OPTS);
    expect(row.deal_motion).toBe(RENEWAL_DEAL_MOTION);
    expect(row.replaces_contract_id).toBe('contract-1');
    expect(row.stage_id).toBe('stage-1');
    expect(row.source).toBe(RENEWAL_DEAL_SOURCE);
  });

  it('opens the deal without sending anything — the approval gate is untouched', () => {
    const row = buildRenewalDealInsert(FACTS, OPTS);
    expect(row.status).toBe('open');
    expect(String(row.description)).toContain('Nothing has been sent to the customer');
  });

  it('forecasts as pipeline, because nobody has committed a draft they have not read', () => {
    expect(buildRenewalDealInsert(FACTS, OPTS).forecast_category).toBe('pipeline');
  });

  it('rounds the amount to the 2dp the column stores', () => {
    expect(buildRenewalDealInsert(FACTS, OPTS).amount).toBe('48250.49');
  });

  it('carries no amount rather than a zero when the draft has no value', () => {
    expect(buildRenewalDealInsert({ ...FACTS, quoteValue: null }, OPTS).amount).toBeNull();
  });

  it('owns the deal to the account rep, falling back to whoever ran the sweep', () => {
    expect(buildRenewalDealInsert(FACTS, OPTS).owner_id).toBe('rep-1');
    // owner_id is NOT NULL, so an unassigned account must not fail the insert.
    expect(buildRenewalDealInsert({ ...FACTS, assignedSalesRep: null }, OPTS).owner_id).toBe(
      'user-9',
    );
  });

  it('points back at the account through both customer and source record', () => {
    const row = buildRenewalDealInsert(FACTS, OPTS);
    expect(row.customer_id).toBe('account-1');
    expect(row.source_business_record_id).toBe('account-1');
  });

  it('closes on the contract end date', () => {
    expect(buildRenewalDealInsert(FACTS, OPTS).expected_close_date).toBe(
      '2026-12-31T00:00:00.000Z',
    );
  });

  it('explains an underage with the real numbers, and stays quiet without one', () => {
    expect(String(buildRenewalDealInsert(FACTS, OPTS).description)).toContain('3100.00 -> 4020.50');
    expect(
      String(buildRenewalDealInsert({ ...FACTS, isUnderage: false }, OPTS).description),
    ).not.toContain('ahead of the contracted tier');
  });
});

describe('renewalDealTitle', () => {
  it('names the account', () => {
    expect(renewalDealTitle(FACTS)).toBe('Renewal - Northgate Dental');
  });

  it('falls back when the account has no name, rather than rendering "Renewal - null"', () => {
    expect(renewalDealTitle({ ...FACTS, companyName: null })).toBe('Contract renewal');
    expect(renewalDealTitle({ ...FACTS, companyName: '   ' })).toBe('Contract renewal');
  });

  it('fits the 200-character column', () => {
    const long = renewalDealTitle({ ...FACTS, companyName: 'A'.repeat(400) });
    expect(long.length).toBeLessThanOrEqual(200);
  });
});

describe('buildRenewalDealUpdate — a re-run updates, never duplicates', () => {
  const existing = {
    id: 'deal-1',
    status: 'open',
    amount: '48250.49',
    expected_close_date: '2026-12-31T00:00:00.000Z',
    title: 'Renewal - Northgate Dental',
  };

  it('writes nothing when nothing changed, so a nightly sweep is a no-op', () => {
    expect(buildRenewalDealUpdate(FACTS, existing)).toBeNull();
  });

  it('follows the draft on amount, close date and title', () => {
    const patch = buildRenewalDealUpdate({ ...FACTS, quoteValue: 51000 }, existing);
    expect(patch).toEqual({ amount: '51000.00' });

    const moved = buildRenewalDealUpdate(
      { ...FACTS, contractEndDate: '2027-03-31T00:00:00.000Z' },
      existing,
    );
    expect(moved).toEqual({ expected_close_date: '2027-03-31T00:00:00.000Z' });
  });

  it('LEAVES A CLOSED DEAL ALONE — won and lost are the record of what happened', () => {
    expect(
      buildRenewalDealUpdate({ ...FACTS, quoteValue: 999999 }, { ...existing, status: 'won' }),
    ).toBeNull();
    expect(
      buildRenewalDealUpdate({ ...FACTS, quoteValue: 999999 }, { ...existing, status: 'lost' }),
    ).toBeNull();
    // Case is not a licence to overwrite one either.
    expect(
      buildRenewalDealUpdate({ ...FACTS, quoteValue: 999999 }, { ...existing, status: 'Won' }),
    ).toBeNull();
  });

  it('still updates a deal on hold, which is not closed', () => {
    expect(
      buildRenewalDealUpdate({ ...FACTS, quoteValue: 60000 }, { ...existing, status: 'on_hold' }),
    ).toEqual({ amount: '60000.00' });
  });

  it('never touches stage, owner or probability — the rep moved it on purpose', () => {
    const patch = buildRenewalDealUpdate(
      { ...FACTS, quoteValue: 51000, assignedSalesRep: 'someone-else' },
      existing,
    );
    expect(Object.keys(patch ?? {})).toEqual(['amount']);
  });

  it('does not blank an amount the deal already carries', () => {
    expect(buildRenewalDealUpdate({ ...FACTS, quoteValue: null }, existing)).toBeNull();
  });
});

describe('renewalOutcomeForDealStatus', () => {
  it('maps a closed deal to the renewal outcome', () => {
    expect(renewalOutcomeForDealStatus('won')).toBe('won');
    expect(renewalOutcomeForDealStatus('lost')).toBe('lost');
    expect(renewalOutcomeForDealStatus('WON')).toBe('won');
  });

  it('refuses to reset an outcome for an open or reopened deal', () => {
    // A deal reopened after a loss has not un-lost the renewal it came from,
    // and overwriting that would destroy the win-rate comparison's evidence.
    expect(renewalOutcomeForDealStatus('open')).toBeNull();
    expect(renewalOutcomeForDealStatus('on_hold')).toBeNull();
    expect(renewalOutcomeForDealStatus(null)).toBeNull();
    expect(renewalOutcomeForDealStatus(undefined)).toBeNull();
    expect(renewalOutcomeForDealStatus('')).toBeNull();
  });
});
