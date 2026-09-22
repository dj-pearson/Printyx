/**
 * Renewal draft -> pipeline deal (COP-M06).
 *
 * Pure. The renewal auto-quote generator produced good drafts on a page of
 * their own, outside the pipeline, and reps do not work there - so the drafts
 * went unseen. This module decides what deal a draft becomes, and what a
 * regeneration is allowed to change about a deal that already exists.
 *
 * Three decisions live here rather than inline in the generator, because each
 * one is a rule somebody will want to argue with and a rule nobody can see
 * inside a 200-line loop:
 *
 *  1. A REGENERATION UPDATES, IT NEVER DUPLICATES (AC4). The natural key is
 *     (tenant, replacesContractId, dealMotion='renewal') - one renewal deal per
 *     contract - so no new column is needed to carry the link. `deals` knowing
 *     which contract it replaces is COP-M04's own field doing its job.
 *
 *  2. A CLOSED DEAL IS LEFT ALONE. A won renewal that the generator re-scans
 *     must not have its amount rewritten or be dragged back to open: the deal
 *     is the record of what happened, and the sweep is a suggestion.
 *
 *  3. THE UPDATE IS NARROW. Amount, close date and title follow the draft
 *     because they are the draft's own facts. Stage, owner and probability do
 *     NOT: a rep who moved the deal or reassigned it has made a decision, and a
 *     nightly sweep that reverts it is worse than one that never ran.
 *
 * Creating a deal is NOT sending a quote (AC3). Nothing here sets a proposal,
 * a share token or a status other than open - the rep's approval gate is
 * exactly where it was.
 */

/** COP-M04 vocabulary. A renewal deal is identified by this, not by its title. */
export const RENEWAL_DEAL_MOTION = 'renewal';

/** deals.source, so a renewal deal is distinguishable from a hand-created one. */
export const RENEWAL_DEAL_SOURCE = 'renewal_autoquote';

export interface RenewalDraftFacts {
  contractId: string;
  customerId: string | null;
  companyName?: string | null;
  /** Annualized recommended contract value. */
  quoteValue?: number | null;
  contractEndDate?: string | null;
  assignedSalesRep?: string | null;
  isUnderage?: boolean | null;
  currentMonthlyRevenue?: number | null;
  recommendedMonthlyRevenue?: number | null;
}

export interface ExistingRenewalDeal {
  id: string;
  status?: string | null;
  amount?: string | number | null;
  expected_close_date?: string | null;
  title?: string | null;
}

/** deals.amount is decimal(12,2); a raw float would be rounded by the database anyway. */
function toAmount(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function renewalDealTitle(facts: RenewalDraftFacts): string {
  const who = facts.companyName?.trim();
  // 200 is the column's limit; a long account name must not fail the insert.
  return (who ? `Renewal - ${who}` : 'Contract renewal').slice(0, 200);
}

function renewalDealDescription(facts: RenewalDraftFacts): string {
  const lines = [
    'Drafted by the renewal auto-quote sweep from the last 12 months of metered usage.',
  ];
  if (facts.isUnderage) {
    const from = facts.currentMonthlyRevenue;
    const to = facts.recommendedMonthlyRevenue;
    lines.push(
      from != null && to != null
        ? `Usage is running ahead of the contracted tier: ${from.toFixed(2)} -> ${to.toFixed(2)} per month at the re-tiered rates.`
        : 'Usage is running ahead of the contracted tier.',
    );
  }
  lines.push('Nothing has been sent to the customer. Review the draft before quoting.');
  return lines.join('\n');
}

/**
 * The row to INSERT for a draft that has no deal yet.
 *
 * `ownerId` falls back to whoever ran the sweep because deals.owner_id is NOT
 * NULL and a contract whose account carries no assigned rep would otherwise
 * fail the insert - a renewal nobody owns is still better surfaced than
 * dropped, and the fallback is visible on the record rather than guessed at.
 */
export function buildRenewalDealInsert(
  facts: RenewalDraftFacts,
  opts: { tenantId: string; stageId: string; fallbackUserId: string },
): Record<string, unknown> {
  return {
    tenant_id: opts.tenantId,
    title: renewalDealTitle(facts),
    description: renewalDealDescription(facts),
    amount: toAmount(facts.quoteValue ?? null),
    owner_id: facts.assignedSalesRep || opts.fallbackUserId,
    customer_id: facts.customerId,
    company_name: facts.companyName ?? null,
    // A customer IS a business record here, so the deal points back at the
    // account the same way a deal created from a lead does.
    source_business_record_id: facts.customerId,
    stage_id: opts.stageId,
    status: 'open',
    expected_close_date: facts.contractEndDate ?? null,
    source: RENEWAL_DEAL_SOURCE,
    deal_type: 'Renewal',
    deal_motion: RENEWAL_DEAL_MOTION,
    // Nobody has forecast this. 'pipeline' is the honest bucket for a draft the
    // rep has not looked at, and COP-B11 scores it as such.
    forecast_category: 'pipeline',
    replaces_contract_id: facts.contractId,
    created_by_id: opts.fallbackUserId,
  };
}

/**
 * What a regeneration may change about a deal that already exists, or null when
 * it must not touch it at all.
 *
 * Returns only the keys that actually differ, so a sweep over unchanged
 * contracts writes nothing and does not bump updated_at on every deal in the
 * pipeline every night.
 */
export function buildRenewalDealUpdate(
  facts: RenewalDraftFacts,
  existing: ExistingRenewalDeal,
): Record<string, unknown> | null {
  const status = String(existing.status ?? 'open').toLowerCase();
  // Rule 2: a closed deal is the record of what happened.
  if (status === 'won' || status === 'lost') return null;

  const patch: Record<string, unknown> = {};

  const amount = toAmount(facts.quoteValue ?? null);
  if (amount != null && String(existing.amount ?? '') !== amount) {
    patch.amount = amount;
  }

  const close = facts.contractEndDate ?? null;
  if (close && (existing.expected_close_date ?? null) !== close) {
    patch.expected_close_date = close;
  }

  const title = renewalDealTitle(facts);
  if (existing.title !== title) {
    patch.title = title;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * AC5. A renewal's outcome is tracked on the draft, and the rep now works the
 * deal, so the deal's close is what has to reach the draft.
 *
 * Only won and lost map. 'open' and 'on_hold' return null rather than resetting
 * an outcome to pending: a deal reopened after a loss has not un-lost the
 * renewal it was drafted from, and overwriting the record of that would lose
 * the only evidence the win-rate comparison is built on.
 */
export function renewalOutcomeForDealStatus(
  status: string | null | undefined,
): 'won' | 'lost' | null {
  const value = String(status ?? '').toLowerCase();
  if (value === 'won') return 'won';
  if (value === 'lost') return 'lost';
  return null;
}

/**
 * AC5, the write half. Push a deal's close onto the renewal draft it came from.
 *
 * Called from BOTH places a deal's status changes - PATCH /deals/:id and the
 * pipeline board's move endpoint - because the board is where reps actually
 * close deals and the direct PATCH is the API path. Wiring only one of them is
 * how CRMX-008a's trigger seam came to fire for nobody.
 *
 * Matched on `replaces_contract_id`, the same natural key the upsert uses, so a
 * deal that is not a renewal matches nothing and costs one indexed read.
 *
 * Never throws: a renewal's win-rate bookkeeping must not fail the close of a
 * deal worth six figures.
 */
export async function syncRenewalOutcomeFromDeal(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  deal: {
    status?: string | null;
    replaces_contract_id?: string | null;
    deal_motion?: string | null;
  },
): Promise<'won' | 'lost' | null> {
  try {
    const contractId = deal?.replaces_contract_id;
    if (!contractId || deal?.deal_motion !== RENEWAL_DEAL_MOTION) return null;

    const outcome = renewalOutcomeForDealStatus(deal.status);
    if (!outcome) return null;

    const { error } = await admin
      .from('renewal_auto_quotes')
      .update({
        outcome,
        outcome_at: new Date().toISOString(),
        outcome_note: `Set from the linked pipeline deal closing ${outcome}.`,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      // Only a draft still awaiting an answer. A renewal a rep already marked
      // won or lost by hand keeps their answer - they had the conversation.
      .eq('outcome', 'pending');
    if (error) throw new Error(error.message);
    return outcome;
  } catch (err) {
    console.error('[RENEWAL] outcome sync failed:', (err as Error).message);
    return null;
  }
}
