/**
 * WF-C-05: how the deal is paid, and what acceptance creates because of it.
 *
 * Acceptance always called createContractFromProposal and never created a lease,
 * whatever the proposal said. `leases` carries proposal_id, business_record_id
 * and contract_id columns that nothing filled, `payment_terms` on the proposal
 * was written by nothing and read by nothing, and both the public /p/:token
 * accept and the internal status change ran the same cash-only path. A leased
 * fleet was indistinguishable from a cash sale the moment the customer clicked
 * Accept.
 *
 * The Deno copy the accept handler runs. shared/lease-draft.ts is the
 * Node/browser twin, imported by LeaseForm's ?proposalId= prefill so the draft a
 * rep sees is the draft the server would have written, and locked to this file by
 * server/tests/unit/proposal-acquisition.test.ts. Everything here is pure: the
 * caller does the IO.
 *
 * WHAT THIS WILL NOT DO. `leases` has eleven NOT NULL columns, five of them
 * dates and amounts. A lease is planned only when the proposal actually states a
 * term, a monthly payment and a first payment date; short of that the plan is
 * declined WITH A REASON rather than filled in with today's date and a 36-month
 * default nobody agreed to - the exact fabrication WF-C-09 removed from the
 * contract path one story earlier. Everything the plan does derive follows
 * arithmetically from those three stated values.
 */

export const ACQUISITION_TYPES = ['cash', 'lease', 'finance'] as const;
export type AcquisitionType = (typeof ACQUISITION_TYPES)[number];

/** The two that put a machine on somebody else's paper. */
export const FINANCED_ACQUISITION_TYPES: AcquisitionType[] = ['lease', 'finance'];

export function normalizeAcquisitionType(value: unknown): AcquisitionType | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return (ACQUISITION_TYPES as readonly string[]).includes(v) ? (v as AcquisitionType) : null;
}

export interface ProposalAcquisitionFields {
  id?: string | null;
  title?: string | null;
  proposal_number?: string | null;
  business_record_id?: string | null;
  acquisition_type?: unknown;
  funding_partner?: unknown;
  finance_term_months?: unknown;
  finance_monthly_payment?: unknown;
  first_payment_date?: unknown;
  total_amount?: unknown;
}

export interface LeasePlanContext {
  tenantId: string;
  contractId: string | null;
  createdBy: string;
  leaseNumber: string;
}

export interface LeasePlan {
  acquisitionType: AcquisitionType | null;
  /** The leases row to insert, or null when no lease should be created. */
  row: Record<string, unknown> | null;
  /** Why not, in words a rep can act on. Absent when a row is planned. */
  reason?: string;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The same day-of-month N months on, clamped to the end of a shorter month. */
export function addMonths(from: Date, months: number): Date {
  const day = from.getUTCDate();
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function planLeaseFromProposal(
  proposal: ProposalAcquisitionFields,
  ctx: LeasePlanContext,
): LeasePlan {
  const acquisitionType = normalizeAcquisitionType(proposal.acquisition_type);

  if (!acquisitionType) {
    return {
      acquisitionType: null,
      row: null,
      reason: 'the proposal does not state how the deal is paid, so only the contract was created',
    };
  }
  if (acquisitionType === 'cash') {
    return { acquisitionType, row: null, reason: 'cash sale - a contract, no lease' };
  }

  const term = toNumber(proposal.finance_term_months);
  const monthly = toNumber(proposal.finance_monthly_payment);
  const firstPayment = toDate(proposal.first_payment_date);

  const missing: string[] = [];
  if (!term || term < 1) missing.push('term in months');
  if (monthly === null || monthly <= 0) missing.push('monthly payment');
  if (!firstPayment) missing.push('first payment date');
  if (missing.length > 0) {
    // Every one of these is NOT NULL on `leases`. Defaulting them would put a
    // term and a payment schedule nobody agreed to in front of a customer.
    return {
      acquisitionType,
      row: null,
      reason: `the ${acquisitionType} terms are incomplete (${missing.join(', ')}), so no lease was created`,
    };
  }

  const months = Math.round(term as number);
  const start = firstPayment as Date;
  const lastPayment = addMonths(start, months - 1);
  const end = addMonths(start, months);
  const customerId = proposal.business_record_id ?? null;
  if (!customerId) {
    return {
      acquisitionType,
      row: null,
      reason: 'the proposal has no account, so the lease would have no customer',
    };
  }

  return {
    acquisitionType,
    row: {
      tenant_id: ctx.tenantId,
      lease_number: ctx.leaseNumber,
      lease_name: proposal.title || `Lease for ${proposal.proposal_number ?? 'proposal'}`,
      customer_id: customerId,
      business_record_id: customerId,
      proposal_id: proposal.id ?? null,
      contract_id: ctx.contractId,
      // fmv is the column default and the commonest structure. The rep corrects
      // it in LeaseForm; the row is 'pending' precisely because it is a draft.
      lease_type: 'fmv',
      status: 'pending',
      total_amount: ((monthly as number) * months).toFixed(2),
      monthly_payment: (monthly as number).toFixed(2),
      term: months,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      first_payment_date: start.toISOString(),
      last_payment_date: lastPayment.toISOString(),
      lessor_name:
        typeof proposal.funding_partner === 'string' && proposal.funding_partner.trim()
          ? proposal.funding_partner.trim()
          : null,
      payments_remaining: months,
      created_by: ctx.createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}
