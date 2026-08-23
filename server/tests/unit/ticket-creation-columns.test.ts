/**
 * QUALITY-002 — creating a ticket from an inbound email writes real columns.
 *
 * server/index.ts starts the email monitors at boot, so this service runs in
 * production on every parsed support email. It was written against a schema
 * that isn't there:
 *
 *   business_records got `name`, `email` and `source` on insert — the columns
 *   are company_name, primary_contact_email and lead_source — and created_by,
 *   which is NOT NULL, was never supplied. Drizzle drops unknown keys silently,
 *   so the statement reduced to a NOT NULL violation: no customer could be
 *   created from an email at all.
 *
 *   equipment was matched on .model and .location (model_number,
 *   location_description), users were filtered on a `status` column that does
 *   not exist (is_active), and the technician's name was read off a `name`
 *   column (first_name/last_name).
 *
 *   the confirmation email was sent as { to, subject, body }. EmailMessage has
 *   no `body` — it takes html and optional text — so the message went out with
 *   no content.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  queries: [] as { text: string; values: unknown[] }[],
  emails: [] as Record<string, unknown>[],
}));

vi.mock('../../db', async () => {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const schema = await import('../../../shared/schema');
  const client = {
    // node-postgres is query(config, values): the parameters are the second
    // argument. Asserting on the SQL text alone is useless for an insert, because
    // drizzle names EVERY column of the table and writes `default` for the ones
    // you did not set — so a dropped key still shows up in the column list.
    query: async (config: { text: string }, values?: unknown[]) => {
      state.queries.push({ text: config.text, values: values ?? [] });
      return { rows: [], rowCount: 0 };
    },
  };
  return { db: drizzle({ client: client as never, schema }) };
});

vi.mock('../../services/email-service', () => ({
  sendEmail: async (message: Record<string, unknown>) => {
    state.emails.push(message);
    return { success: true, messageId: 'stub' };
  },
}));

import { TicketCreationService } from '../../services/ticket-creation-service';

const sql = () => state.queries.map((q) => q.text).join('\n');

beforeEach(() => {
  state.queries = [];
  state.emails = [];
});

describe('QUALITY-002: the email-to-ticket path uses real columns', () => {
  it('inserts a new business record with the columns the table has', async () => {
    const service = new TicketCreationService('11111111-1111-4111-8111-111111111111');
    // No existing customer comes back from the stub, so this takes the create path.
    await service
      .createTicket({
        customerEmail: 'ops@acme.example.com',
        customerName: 'Acme Corporation',
        contactPhone: '555-0101',
        issueCategory: 'hardware',
        priority: 'high',
        issueDescription: 'Fuser error E002',
      })
      .catch(() => undefined); // the stub returns no rows, so later steps bail

    const insert = state.queries.find((q) => q.text.startsWith('insert into "business_records"'));
    expect(insert, 'no business_records insert was issued').toBeTruthy();

    // The values are what proves the keys landed. A key the table does not have
    // is dropped, and its column comes out as `default` with no parameter — so a
    // missing value here is exactly the old bug.
    expect(insert!.values, 'company name was dropped').toContain('Acme Corporation');
    expect(insert!.values, 'contact email was dropped').toContain('ops@acme.example.com');
    expect(insert!.values, 'contact phone was dropped').toContain('555-0101');
    expect(insert!.values, 'record type was dropped').toContain('lead');
    // created_by is NOT NULL; without it the statement could not have run at all.
    expect(insert!.values, 'created_by was dropped').toContain('system');
    // The drizzle property is `leadSource` but the SQL column is plain `source`,
    // which is why writing `source:` on the object did nothing.
    expect(insert!.values, 'lead source was dropped').toContain('email');
  });

  it('reads the customer equipment scoped to the tenant', async () => {
    const service = new TicketCreationService('11111111-1111-4111-8111-111111111111');
    await service
      .createTicket({
        customerId: '22222222-2222-4222-8222-222222222222',
        customerEmail: 'ops@acme.example.com',
        equipmentIdentifier: 'CAN-2024-001234',
        issueCategory: 'hardware',
        priority: 'low',
        issueDescription: 'Paper jam',
      })
      .catch(() => undefined);

    // The fuzzy match itself runs in memory over the returned rows, so what is
    // checkable here is that the read happened and was scoped to the tenant.
    const equipmentRead = state.queries.find((q) => q.text.includes('"equipment"'));
    expect(equipmentRead).toBeTruthy();
    expect(equipmentRead!.text).toContain('tenant_id');
    expect(equipmentRead!.values).toContain('11111111-1111-4111-8111-111111111111');
  });

  it('never emits an empty operand, which is what an undefined column compiles to', async () => {
    const service = new TicketCreationService('11111111-1111-4111-8111-111111111111');
    await service
      .createTicket({
        customerEmail: 'ops@acme.example.com',
        issueCategory: 'hardware',
        priority: 'medium',
        issueDescription: 'Streaking on colour output',
      })
      .catch(() => undefined);

    expect(sql()).not.toMatch(/(and|or|where)\s{2,}=/);
  });
});

describe('QUALITY-002: the confirmation email carries its content', () => {
  it('sends html and text, not a `body` the mailer would ignore', async () => {
    const service = new TicketCreationService('11111111-1111-4111-8111-111111111111');
    await service.sendConfirmationEmail('ops@acme.example.com', {
      id: 'TKT-2024-0001',
      title: 'Fuser error E002',
      priority: 'high',
      status: 'open',
    });

    expect(state.emails).toHaveLength(1);
    const [message] = state.emails;
    expect(message).not.toHaveProperty('body');
    expect(typeof message.html).toBe('string');
    expect(typeof message.text).toBe('string');
    expect(String(message.html).length).toBeGreaterThan(0);
    expect(String(message.text)).toContain('TKT-2024-0001');
    expect(String(message.subject)).toContain('TKT-2024-0001');
  });

  it('escapes the plain-text body before embedding it in html', async () => {
    const service = new TicketCreationService('11111111-1111-4111-8111-111111111111');
    await service.sendConfirmationEmail('ops@acme.example.com', {
      id: 'tk-2',
      title: '<script>alert(1)</script>',
      priority: 'low',
      status: 'open',
    });

    const html = String(state.emails[0].html);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
