/**
 * PROD-008: the iOS quote list's Send swipe action hit nothing.
 *
 * `POST /api/proposals/:id/send` is what QuoteListView offers on a DRAFT, and
 * afterwards the view model sets the row to `.sent` with today's date. The
 * proposals edge function served status, track-view, email,
 * generate-from-template, share, line-items and comments - not `send` - so the
 * request fell past all of them to the trailing 404 and a rep could not send a
 * quote from their phone.
 *
 * THE GATE IS WHY THIS IS NOT TWO CALLS GLUED TOGETHER. QUOTE-006/016 lived
 * inline in the PATCH /:id/status branch and nowhere else, so a `send` written
 * with its own copy of the policy would have been a way around it rather than a
 * duplicate. The checks below are source-level on purpose: proposals/index.ts
 * imports zod and pdf-lib from esm.sh, which vitest cannot load, and the claim
 * being made - one implementation, two callers, in this order - is a property
 * of the source rather than of a return value.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Comments stripped: an assertion must not match the prose explaining it. */
function stripComments(src: string) {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');
}

const src = stripComments(read('supabase/functions/proposals/index.ts'));
const sendAt = src.indexOf("subMatch[2] === 'send'");
const sendBranch = src.slice(
  sendAt,
  src.indexOf("subMatch[2] === 'generate-from-template'", sendAt),
);

describe('the send branch exists', () => {
  it('routes POST /:id/send', () => {
    expect(sendAt).toBeGreaterThan(-1);
    expect(src).toMatch(/method === 'POST' && subMatch\[2\] === 'send'/);
  });

  it('the iOS client still calls that exact path', () => {
    // If the app moves, this endpoint is serving nobody and the test should say
    // so rather than vouching for a path with no caller.
    const swift = read('ios/Printyx/Core/Network/APIEndpoint.swift');
    expect(swift).toMatch(/\/api\/proposals\/\\\(id\)\/send/);
  });

  it('the swipe action it serves is offered on a draft', () => {
    const view = read('ios/Printyx/Features/Quotes/Views/QuoteListView.swift');
    expect(view).toMatch(/status == \.draft/);
    expect(view).toMatch(/sendProposal\(proposal\)/);
  });
});

describe('order of operations', () => {
  it('the pricing gate runs before anything is emailed', () => {
    // A refusal that runs after the customer has the PDF is not a refusal.
    const gate = sendBranch.indexOf('pricingGateRefusal');
    const email = sendBranch.indexOf('emailProposalPdf');
    expect(gate).toBeGreaterThan(-1);
    expect(email).toBeGreaterThan(gate);
  });

  it('the status moves only after the email succeeds', () => {
    // A quote marked sent that nobody received is worse than an error the rep
    // can act on. Both halves are asserted: the email happens first, AND the
    // failure branch returns before the update - a mutant that merely moved the
    // email later satisfied the first on its own.
    const email = sendBranch.indexOf('emailProposalPdf');
    const bail = sendBranch.indexOf('if (!outcome.ok) return outcome.response!;');
    const update = sendBranch.indexOf("status: 'sent'");
    expect(email).toBeGreaterThan(-1);
    expect(bail).toBeGreaterThan(email);
    expect(update).toBeGreaterThan(bail);
  });

  it('a failed status update reports a send that happened, not a failure', () => {
    // The customer already has the quote at that point, so a 500 here invites
    // the rep to send it twice.
    expect(sendBranch).toMatch(/statusUpdated: false/);
    expect(sendBranch).toMatch(/warning:/);
  });
});

describe('an answered quote does not walk backwards', () => {
  it('accepted and rejected are excluded from the status move', () => {
    // Re-sending is legitimate - a customer asking for the PDF again - and
    // resetting the row to `sent` would erase their answer.
    expect(sendBranch).toMatch(/current !== 'accepted' && current !== 'rejected'/);
  });

  it('the response says whether the status moved', () => {
    expect(sendBranch).toMatch(/statusUpdated: movesToSent/);
  });
});

describe('the email path is one implementation', () => {
  it('sendEmail is called from the shared helper and nowhere else in this function', () => {
    const helperAt = src.indexOf('async function emailProposalPdf');
    const helperEnd = src.indexOf('\n}', src.indexOf('return {\n    ok: true,', helperAt));
    expect(helperAt).toBeGreaterThan(-1);
    const calls = [...src.matchAll(/await sendEmail\(/g)];
    expect(calls.length).toBe(1);
    expect(calls[0].index!).toBeGreaterThan(helperAt);
    expect(calls[0].index!).toBeLessThan(helperEnd);
  });

  it('both the email branch and the send branch go through it', () => {
    const uses = src.match(/await emailProposalPdf\(/g) ?? [];
    expect(uses.length).toBe(2);
  });

  it('a quote with no recipient is refused rather than silently marked sent', () => {
    const helperAt = src.indexOf('async function emailProposalPdf');
    const helper = src.slice(helperAt, src.indexOf('async function ', helperAt + 10));
    expect(helper).toMatch(/NO_RECIPIENT/);
    // And the send branch returns that refusal instead of proceeding.
    expect(sendBranch.indexOf('if (!outcome.ok) return outcome.response!;')).toBeGreaterThan(-1);
  });
});

describe('the pipeline side effects match the status branch', () => {
  it('a send upserts the deal, best effort', () => {
    expect(sendBranch).toMatch(/upsertDealForProposal\(db, proposal, ctx\.userId, ctx\.tenantId\)/);
    expect(sendBranch).toMatch(/catch \(syncError\)/);
  });

  it('it records the same status_sent analytics event', () => {
    expect(sendBranch).toMatch(/event_type: 'status_sent'/);
  });

  it('every write is scoped to the tenant', () => {
    const updateAt = sendBranch.indexOf("status: 'sent'");
    expect(sendBranch.slice(updateAt, updateAt + 320)).toMatch(
      /\.eq\('tenant_id', ctx\.tenantId\)/,
    );
  });
});
