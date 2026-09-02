/**
 * Who may send a quote that breaks the pricing policy (WF-C-04).
 *
 * Split out of index.ts as a PURE module for the reason a dozen siblings in this
 * tree carry in their headers: index.ts imports zod and pdf-lib from esm.sh, which
 * vitest cannot load, so anything left in there can only ever be asserted by
 * reading the file. The decision this makes is the security-relevant part, so it
 * is here where a test can drive it.
 *
 * WHAT IT REPLACED. The gate's bypass was `body.approved`, set by QuoteBuilder from
 * the SENDER'S OWN isManager flag - the server asked the caller whether the caller
 * was allowed. Anyone able to post JSON could send any quote, and a rep whose
 * deal-desk exception had genuinely been approved still could not, because approval
 * only moved approval_requests.status.
 */

/** As much of the auth context as this decision reads. */
export interface SendGateUser {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Does this caller need approval to send an off-policy quote?
 *
 * A LEVEL check, with the role string as a fallback for a token issued before
 * WF-R-03 started writing the claim. The string match ALONE had a hole: it tested
 * for names ending in 'sales_rep', so ACCOUNT_EXECUTIVE and SOLUTIONS_CONSULTANT -
 * individual contributors at levels 3 and 2 in migration 0072 - matched nothing and
 * skipped the guardrail entirely. Level 4 is where the approval ladder starts, the
 * same line purchase-orders draws for approving an order.
 */
export function needsPricingApproval(user: SendGateUser | null | undefined): boolean {
  const meta = user?.app_metadata ?? {};
  const level = meta.roleLevel ?? meta.role_level;
  if (typeof level === 'number' && Number.isFinite(level)) {
    return level < 4;
  }

  const rawRole = String(meta.role ?? user?.user_metadata?.role ?? '').toLowerCase();
  const salesOnly = ['sales_rep', 'salesperson', 'sales'];
  return salesOnly.some((r) => rawRole === r || rawRole.endsWith(r));
}

/**
 * Has the deal desk approved this specific proposal's pricing?
 *
 * The stamp is written only by the deal-desk function's FINAL-approve branch and
 * cleared on reject or request_changes, so an exception that swung back stops
 * granting a bypass.
 */
export function hasPricingApproval(
  proposal: { pricing_approval_id?: unknown } | null | undefined,
): boolean {
  const id = proposal?.pricing_approval_id;
  return typeof id === 'string' && id.length > 0;
}

/** True when the policy gate should run at all for this send. */
export function pricingGateApplies(
  user: SendGateUser | null | undefined,
  proposal: { pricing_approval_id?: unknown } | null | undefined,
): boolean {
  return needsPricingApproval(user) && !hasPricingApproval(proposal);
}
