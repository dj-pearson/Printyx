/**
 * The service ticket a human approval creates (round 206/207).
 *
 * The agent used to INSERT a "draft" ticket at scoring time with status
 * 'pending_review'. That is not a member of the WF-V-05 vocabulary, and
 * migration 0078's CHECK (NOT VALID, which still rejects every INSERT)
 * refused it, so no predicted-failure ticket was ever created: the insert
 * failed, the error was logged, and approving a prediction dispatched nothing.
 *
 * The ticket is created on APPROVAL instead. That needs no new status, keeps
 * unreviewed guesses out of every ticket list and open-ticket count, and is
 * what the code already said it wanted: "a human approves before a tech rolls".
 * The review state lives on the prediction row, where it always did.
 *
 * Pure, so it can be tested under Node; index.ts does the IO.
 */

export const HIGH_PRIORITY_CONFIDENCE = 0.85;

export interface PredictionForTicket {
  id: string;
  machine_id: string;
  confidence: number | string | null;
  predicted_window_end: string | null;
  signals: { suggested_parts?: unknown } | null;
}

export type TicketPlan =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; code: 'NO_CUSTOMER'; message: string };

export function ticketFromPrediction(
  prediction: PredictionForTicket,
  machine: { customer_id?: string | null } | null,
  input: { tenantId: string; userId: string; now: Date; ticketNumber: string },
): TicketPlan {
  // service_tickets.customer_id is required: a machine nobody owns cannot
  // be dispatched to.
  if (!machine?.customer_id) {
    return {
      ok: false,
      code: 'NO_CUSTOMER',
      message: 'This machine has no customer, so a service ticket cannot be created for it.',
    };
  }
  const confidence = Number(prediction.confidence ?? 0);
  const parts = Array.isArray(prediction.signals?.suggested_parts)
    ? (prediction.signals!.suggested_parts as unknown[]).map(String)
    : [];
  return {
    ok: true,
    payload: {
      tenant_id: input.tenantId,
      customer_id: machine.customer_id,
      equipment_id: prediction.machine_id,
      ticket_number: input.ticketNumber,
      title: 'Predicted failure - approved for dispatch',
      description: `Approved from a predictive-failure prediction (confidence ${(
        (Number.isFinite(confidence) ? confidence : 0) * 100
      ).toFixed(0)}%). Suggested parts: ${parts.join(', ') || 'none'}.`,
      priority: confidence >= HIGH_PRIORITY_CONFIDENCE ? 'high' : 'medium',
      // A dispatchable ticket nobody is assigned to yet.
      status: 'open',
      scheduled_date: prediction.predicted_window_end,
      required_parts: parts,
      created_by: input.userId,
    },
  };
}
