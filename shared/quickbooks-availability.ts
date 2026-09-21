/**
 * What the QuickBooks integration can honestly answer, and why it is so little.
 *
 * NOTHING ANYWHERE WRITES A QUICKBOOKS CONNECTION TO A TABLE (round 126). The
 * Express OAuth callback stores the access token, the refresh token and the
 * company id in `req.session`, under its own comment "Store connection details
 * (in a real app, save to database)". The edge function reads a table called
 * `integrations`, which is in no Drizzle schema and no migration - it has sat
 * in docs/phantom-tables-baseline.json against that file the whole time - and
 * `quickbooks_mappings` beside it is phantom too. So there is no credential
 * store, on either host, and the two failures compounded into one screen that
 * reads as a settled fact:
 *
 *   GET /quickbooks/status DISCARDED its error and answered
 *   `{ connected: false }` at 200. A 42P01 on every call, rendered as a red
 *   "Not connected" badge and a Connect button. That is the most misleading
 *   default available here, because it invites a dealer to run an OAuth flow
 *   the edge function already refuses with a 501 - and if they are already
 *   connected on the Express host, it tells them they are not.
 *
 * AND BOTH HOSTS REPORTED A SYNC THAT PERSISTS NOTHING, which is the half that
 * costs data rather than confidence:
 *
 *   The edge branches insert a `pending` row into integration_sync_logs,
 *   discard that insert's error too, and answer
 *   `{ success: true, message: 'Customer sync initiated' }` beside a comment
 *   saying "In production, this would call the QuickBooks API". No call is
 *   made.
 *
 *   The Express branches are more convincing and end the same way: they really
 *   do call Intuit, really do transform the customers, then
 *   `// In a real implementation, save to database here` and answer
 *   "Successfully synced 412 customers". A real count, off a real API call,
 *   with no row written - so a developer testing in dev sees a number and
 *   believes the integration works.
 *
 * Three guards watch fabricated READS and none watches this: there is no
 * `|| literal`, no Math.random and no static JSX. The success IS the evidence
 * (MEETINGS-READS-001).
 *
 * TWO CODES, BECAUSE THEY ARE TWO DIFFERENT GAPS and collapsing them would
 * tell a reader the wrong thing about what has to be built:
 *
 *   CONNECTION_NOT_STORED - there is no table behind a connection, so nothing
 *   can be read about one. Fixing it means a credential store plus moving the
 *   OAuth state off the session (the reason /connect already 501s).
 *
 *   SYNC_NOT_IMPLEMENTED - the persistence step was never written. This one is
 *   true even once a connection exists, so it must not hide behind the first.
 *
 * 501, not 503. 503 says the relation is missing and the request will work
 * once it exists (the `isMissingTableError` convention); here the feature was
 * never built, which is what `/quickbooks/connect` already answers and what
 * the two codes below say out loud.
 */

export const QUICKBOOKS_CONNECTION_NOT_STORED = 'QUICKBOOKS_CONNECTION_NOT_STORED';
export const QUICKBOOKS_SYNC_NOT_IMPLEMENTED = 'QUICKBOOKS_SYNC_NOT_IMPLEMENTED';

export type QuickbooksGap = {
  error: string;
  code: string;
  details: string;
};

export const CONNECTION_GAP: QuickbooksGap = {
  error: 'QuickBooks connections are not stored',
  code: QUICKBOOKS_CONNECTION_NOT_STORED,
  details:
    'The OAuth callback keeps the access and refresh tokens in the Express session and writes ' +
    'no row; the tables this endpoint reads (`integrations`, `quickbooks_mappings`) exist in no ' +
    'schema and no migration. Nothing can be read about a connection until a credential store ' +
    'exists, which is the same prerequisite GET /quickbooks/connect names.',
};

export const SYNC_GAP: QuickbooksGap = {
  error: 'QuickBooks sync does not persist anything',
  code: QUICKBOOKS_SYNC_NOT_IMPLEMENTED,
  details:
    'The edge branches never called Intuit and the Express branches called it and discarded the ' +
    'result, so both reported a completed sync that wrote no row. The step that stores what ' +
    'comes back was never written, and this is true whether or not a connection exists.',
};

/** The entity types a sync would cover once one exists. */
export const QUICKBOOKS_SYNC_ENTITIES = ['customers', 'items', 'invoices', 'payments'] as const;

export function isSyncEntity(value: string | undefined): boolean {
  return (QUICKBOOKS_SYNC_ENTITIES as readonly string[]).includes(value ?? '');
}

/**
 * The status body when nothing can be read about a connection.
 *
 * `connected` is NULL rather than false, because false is a measurement -
 * "we looked and you are not connected" - and this endpoint cannot look. The
 * page renders the `unavailable` block instead of a Connect button, so a
 * dealer is told why rather than sent into a flow that refuses them.
 */
export function unavailableStatus(): {
  connected: null;
  companyId: null;
  tokenValid: null;
  unavailable: QuickbooksGap;
} {
  return { connected: null, companyId: null, tokenValid: null, unavailable: CONNECTION_GAP };
}
