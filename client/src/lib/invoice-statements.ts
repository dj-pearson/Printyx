/**
 * "Send Statements" on a customer's invoice list (UI-DEAD-BUTTONS-001).
 *
 * The button had no handler. Each selected invoice is emailed through the
 * billing function's real send (POST /api/billing/invoices/:id/email, the same
 * endpoint the invoice email dialog uses), one at a time, carrying on past a
 * failure. The message reports what was SENT, not what was attempted, and the
 * failures stay selected - bulk-delete.ts's rules, applied to a send.
 *
 * The commonest failure is an invoice whose customer has no email on file, and
 * the server says so; a partial send therefore names what did not go.
 */

export interface StatementSendOutcome {
  sent: string[];
  failed: string[];
}

export async function sendStatements(
  ids: string[],
  send: (id: string) => Promise<unknown>,
): Promise<StatementSendOutcome> {
  const sent: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await send(id);
      sent.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { sent, failed };
}

export function statementSendToast(outcome: StatementSendOutcome): {
  title: string;
  description: string;
  variant?: 'destructive';
} {
  const { sent, failed } = outcome;
  const plural = (n: number) => (n === 1 ? 'invoice' : 'invoices');
  if (sent.length === 0 && failed.length === 0) {
    return { title: 'Nothing selected', description: 'No invoices were selected.' };
  }
  if (failed.length === 0) {
    return {
      title: 'Statements sent',
      description: `Emailed ${sent.length} ${plural(sent.length)}.`,
    };
  }
  if (sent.length === 0) {
    return {
      title: 'Nothing sent',
      description: `None of the ${failed.length} selected ${plural(failed.length)} could be emailed (often no email on file for the customer). They are still selected.`,
      variant: 'destructive',
    };
  }
  return {
    title: 'Some statements not sent',
    description: `Emailed ${sent.length} of ${sent.length + failed.length}. The ${failed.length} not sent ${failed.length === 1 ? 'is' : 'are'} still selected.`,
    variant: 'destructive',
  };
}
