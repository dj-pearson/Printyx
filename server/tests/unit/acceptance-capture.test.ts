/**
 * Customer acceptance at delivery and installation (WF-L-07).
 *
 * The only signature capability in the tree was field-service's
 * service_signatures handler, and the whole function had no caller in any of
 * the seven client trees - so "the customer signed for it" was a claim with no
 * record behind it. Nothing captured a delivery checklist at all.
 *
 * AND THE HANDLER COULD NOT HAVE WORKED. Its map wrote ticket_id, customer_id,
 * technician_id, signer_role, signature_image_url, signature_data and
 * document_type; the real columns are service_ticket_id, signer_title,
 * signature_data_url and signature_type, and there is no customer or technician
 * column at all. check:phantom-cols saw none of it: this handler passes its
 * table and column names to a GENERIC CRUD HELPER as an options object, and
 * that guard resolves a literal against the table its call chain is on. A
 * helper taking an options object has no chain to read.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCEPTANCE_AGREEMENT as EDGE_AGREEMENT,
  acceptanceRequirements,
  checklistBlockers as edgeBlockers,
} from '../../../supabase/functions/_shared/acceptance.ts';
import {
  ACCEPTANCE_AGREEMENT as CLIENT_AGREEMENT,
  checklistBlockers as clientBlockers,
} from '../../../client/src/lib/acceptance.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

describe('the checklist gate', () => {
  it('an unanswered required item BLOCKS, because null is not a pass', () => {
    // A checklist where every unanswered box counts as satisfied is the same as
    // no checklist.
    expect(
      edgeBlockers([{ item_name: 'Power verified', is_required: true, passed: null }]),
    ).toEqual(['Power verified']);
  });

  it('a failed required item blocks too', () => {
    expect(
      edgeBlockers([{ item_name: 'Network reachable', is_required: true, passed: false }]),
    ).toEqual(['Network reachable']);
  });

  it('an OPTIONAL item never blocks, answered or not', () => {
    expect(
      edgeBlockers([
        { item_name: 'Left a manual', is_required: false, passed: null },
        { item_name: 'Tidied packaging', is_required: false, passed: false },
      ]),
    ).toEqual([]);
  });

  it('a passed required item clears', () => {
    expect(edgeBlockers([{ item_name: 'Power', is_required: true, passed: true }])).toEqual([]);
  });

  it('names an item with no name rather than reporting a blank blocker', () => {
    expect(edgeBlockers([{ is_required: true, passed: null }])).toEqual(['Unnamed item']);
  });

  it('reads the snake_case row PostgREST returns', () => {
    expect(
      acceptanceRequirements({
        signature_data_url: 'data:image/png;base64,x',
        signer_name: 'A',
        signature_type: 'installation',
      }),
    ).toEqual(['acceptance_signed']);
  });
});

describe('the evidence WF-L-13 will check', () => {
  const signed = (type: string) => ({
    signature_data_url: 'data:image/png;base64,x',
    signer_name: 'Dana Reid',
    signature_type: type,
  });

  it('a delivery signature is NOT an acceptance', () => {
    // Two separate events: a driver collects a signature at the door, the
    // customer accepts the installed unit afterwards. Conflating them is
    // exactly what this keeps out of the data.
    expect(acceptanceRequirements(signed('delivery'))).toEqual(['delivery_signature_collected']);
    expect(acceptanceRequirements(signed('installation'))).toEqual(['acceptance_signed']);
  });

  it('a signature with no image satisfies nothing', () => {
    expect(acceptanceRequirements({ signer_name: 'A', signature_type: 'installation' })).toEqual(
      [],
    );
  });

  it('a signature with no signer satisfies nothing', () => {
    expect(
      acceptanceRequirements({ signature_data_url: 'data:x', signature_type: 'installation' }),
    ).toEqual([]);
  });

  it('a service or training signature satisfies neither lifecycle requirement', () => {
    expect(acceptanceRequirements(signed('service'))).toEqual([]);
    expect(acceptanceRequirements(signed('training'))).toEqual([]);
  });

  it('answers nothing for a row that is not there', () => {
    expect(acceptanceRequirements(null)).toEqual([]);
  });
});

describe('the two copies of the agreement agree', () => {
  it('word for word', () => {
    // It is what the customer READS above the pad and what is STORED on the
    // row. Two versions would mean the record does not say what they saw.
    expect(CLIENT_AGREEMENT).toBe(EDGE_AGREEMENT);
  });

  it('and the blocker rule behaves the same on both sides', () => {
    const items = [
      { item_name: 'a', is_required: true, passed: null },
      { item_name: 'b', is_required: true, passed: true },
      { item_name: 'c', is_required: false, passed: false },
    ];
    expect(clientBlockers(items)).toEqual(edgeBlockers(items));
  });
});

describe('the handler writes columns service_signatures has', () => {
  const src = code('supabase/functions/field-service/handlers/signatures.ts');

  it('names none of the seven that do not exist', () => {
    for (const phantom of [
      "'ticket_id'",
      "'customer_id'",
      "'technician_id'",
      "'signer_role'",
      "'signature_image_url'",
      "'signature_data'",
      "'document_type'",
    ]) {
      expect(src, phantom).not.toContain(phantom);
    }
  });

  it('names the ones it does', () => {
    for (const real of [
      "'service_ticket_id'",
      "'signer_title'",
      "'signature_data_url'",
      "'signature_type'",
    ]) {
      expect(src, real).toContain(real);
    }
  });

  it('refuses a signature that is OF nothing', () => {
    // Without a ticket or an installation it is a picture with a name on it,
    // and nothing can ever find it again.
    expect(src).toContain('service_ticket_id or installation_id is required');
  });

  it('reads the user agent from the request, not from the body', () => {
    // It is part of what a signature is as evidence, so a caller must not be
    // able to claim a different one.
    expect(src).toContain("req.headers.get('user-agent')");
  });

  it('checks the NOT NULL columns itself rather than letting Postgres answer', () => {
    expect(src).toContain('Missing required field(s)');
  });
});

describe('the acceptance screen', () => {
  const page = code('client/src/pages/DeliveryAcceptance.tsx');

  it('will not submit without a name, a signature and a clear checklist', () => {
    expect(page).toContain(
      'signerName.trim().length > 0 && Boolean(signature) && blockers.length === 0',
    );
  });

  it('saves the checklist BEFORE the signature', () => {
    // A signature must never exist without the results it attests to.
    const submit = page.slice(page.indexOf('mutationFn: async ()'));
    expect(submit.indexOf('installation-checklists')).toBeLessThan(
      submit.indexOf('service-signatures'),
    );
  });

  it('is routed and reachable from the technician surface', () => {
    expect(code('client/src/App.tsx')).toContain('/acceptance/:installationId');
    expect(code('client/src/pages/MobileFieldService.tsx')).toContain('/acceptance/${item.id}');
  });

  it('draws with pointer events and blocks the browser scroll gesture', () => {
    // On a tablet, without touch-none a drag scrolls the page and the customer's
    // signature comes out as a single dot.
    const pad = code('client/src/components/field/SignaturePad.tsx');
    expect(pad).toContain('onPointerDown');
    expect(pad).toContain('touch-none');
    expect(pad).toContain('devicePixelRatio');
  });
});

describe('a signature is findable afterwards', () => {
  it('the customer detail equipment tab renders the records', () => {
    expect(code('client/src/pages/CustomerDetail.tsx')).toContain('<AcceptanceRecords');
  });

  it('one request, not one per installation', () => {
    // service_signatures has no customer column, so the join has to happen
    // somewhere; this is the only place it happens once.
    const handler = code('supabase/functions/field-service/handlers/acceptance.ts');
    expect(handler).toContain('fetchInBatches');
    expect(handler).toContain("from('installations')");
  });

  it('counts items ANSWERED, not completed', () => {
    const handler = code('supabase/functions/field-service/handlers/acceptance.ts');
    expect(handler).toContain('checklistAnswered');
    expect(handler).toContain('i.passed !== null && i.passed !== undefined');
  });

  it('shows three states per item, because unanswered is not a pass', () => {
    expect(code('client/src/components/field/AcceptanceRecords.tsx')).toContain("'unanswered'");
  });
});

describe('both hosts run the same handler', () => {
  it('/api/field-service is proxied', () => {
    expect(read('server/middleware/edge-function-proxy.ts')).toMatch(
      /'\/api\/field-service':\s*'field-service'/,
    );
  });

  it('the Express router it shadows answers 401 regardless', () => {
    // Every handler there reads req.session.user, which nothing assigns
    // (SEC-SESSION-001) - and it mounts at the /api root, a different prefix.
    expect(read('server/routes/field-service-routes.ts')).toContain('req.session?.user?.tenantId');
  });
});
