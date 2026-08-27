/**
 * Response shapes for the billing surface read by client/src/pages/Billing.tsx
 * (CR-034). Transcribed from the handlers, not from what the page reads.
 *
 * Invoices are not here: they go through normalizeInvoices() and are already
 * described by NormalizedInvoice in client/src/lib/invoice-normalize.ts.
 */

/**
 * GET /api/trial/status — served by Express only
 * (server/routes-trial.ts -> TrialManagementService.getTrialStatus).
 *
 * The two Date fields are serialized as ISO strings over the wire. There is no
 * `trial_end`, no `trialEnd` and no `is_trialing` on this response; the page
 * used to reach for all three.
 */
export interface TrialStatusResponse {
  userId: string;
  tenantId: string;
  trialStartDate: string;
  trialEndDate: string;
  daysRemaining: number;
  status: 'active' | 'expired' | 'converted';
}

/**
 * GET /api/billing/info — the default payment method's `billing_details` jsonb,
 * or null when the tenant has no default method
 * (supabase/functions/billing/handlers/payment-methods.ts:handleBillingInfo).
 *
 * The object is whatever PUT /billing/address last wrote, which is the camelCase
 * shape below. NULL IS A REAL ANSWER and has to survive to the render: it is how
 * "no billing address on file" is expressed.
 */
export interface BillingAddress {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}
