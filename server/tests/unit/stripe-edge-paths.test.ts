/**
 * The payment surface has to exist on the host the browser can reach
 * (PROD-STRIPE-001).
 *
 * Seven Stripe paths lived only in server/routes-subscriptions.ts. That router
 * serves dev, where /api/subscriptions is unproxied; in production getApiUrl
 * rewrites the prefix to the functions host, so checkout, the customer portal,
 * setup-intent, preview-upgrade, checkout-session verification and even the
 * publishable key all 404'd. Nobody could subscribe or change a card.
 *
 * Two things are locked here. The Stripe REST encoder, because everything the
 * edge function sends Stripe goes through it and a wrongly flattened nested
 * parameter is a 400 from Stripe rather than a type error. And the presence of
 * each ported route, because the edge tree is outside the tsc project - a
 * branch that is deleted or renamed fails nowhere else.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toStripeForm } from '../../../supabase/functions/_shared/stripe.ts';

const repo = join(__dirname, '../../..');
const edgeSrc = readFileSync(join(repo, 'supabase/functions/subscriptions/index.ts'), 'utf8');
const hookSrc = readFileSync(join(repo, 'client/src/hooks/useSubscription.ts'), 'utf8');

describe('toStripeForm', () => {
  it('flattens nested objects into Stripe bracket notation', () => {
    expect(toStripeForm({ metadata: { tenantId: 't1', billingCycle: 'annual' } }).toString()).toBe(
      'metadata%5BtenantId%5D=t1&metadata%5BbillingCycle%5D=annual',
    );
  });

  it('indexes arrays, including arrays of objects', () => {
    const form = toStripeForm({ line_items: [{ price: 'price_x', quantity: 2 }] });
    expect(decodeURIComponent(form.toString())).toBe(
      'line_items[0][price]=price_x&line_items[0][quantity]=2',
    );
  });

  it('drops undefined and null rather than sending them as strings', () => {
    // Stripe reads "undefined" as a literal value, so an omitted optional has
    // to be absent from the body, not present and empty.
    const form = toStripeForm({ email: undefined, name: null, customer: 'cus_1' });
    expect(form.toString()).toBe('customer=cus_1');
  });

  it('encodes booleans and numbers the way the Stripe API expects', () => {
    const form = toStripeForm({ automatic_tax: { enabled: false }, quantity: 3 });
    expect(decodeURIComponent(form.toString())).toBe('automatic_tax[enabled]=false&quantity=3');
  });
});

describe('subscriptions edge function serves every Stripe path the hook calls', () => {
  const routes: Array<[string, RegExp]> = [
    ['GET /stripe/config', /secondSegment === 'stripe' && thirdSegment === 'config'/],
    ['POST /checkout', /req\.method === 'POST' && secondSegment === 'checkout' && !thirdSegment/],
    [
      'POST /checkout/addon',
      /req\.method === 'POST' && secondSegment === 'checkout' && thirdSegment === 'addon'/,
    ],
    ['GET /checkout/session/:id', /thirdSegment === 'session' &&\s*parts\[2\]/],
    ['POST /portal', /req\.method === 'POST' && secondSegment === 'portal'/],
    ['POST /setup-intent', /req\.method === 'POST' && secondSegment === 'setup-intent'/],
    ['GET /preview-upgrade', /req\.method === 'GET' && secondSegment === 'preview-upgrade'/],
  ];

  for (const [name, pattern] of routes) {
    it(`has a branch for ${name}`, () => {
      expect(pattern.test(edgeSrc)).toBe(true);
    });
  }

  it('reads the publishable key from the edge environment, not a hardcoded value', () => {
    expect(edgeSrc).toContain('getStripePublishableKey()');
    expect(edgeSrc).not.toMatch(/pk_(test|live)_/);
  });

  it('never embeds a Stripe secret key', () => {
    expect(edgeSrc).not.toMatch(/sk_(test|live)_/);
  });
});

describe('the hooks and the edge branches agree on response keys', () => {
  // A correct URL answering the wrong keys is a second breakage on the same
  // call - the plans branch shipped `{ data: plans }` against a hook reading
  // `{ plans, features }` and looked fixed. Each pair below is a key the hook
  // destructures and the key the edge function sends.
  const pairs: Array<[string, string]> = [
    ['publishableKey', 'publishableKey'],
    ['sessionUrl', 'sessionUrl'],
    ['clientSecret', 'clientSecret'],
    ['prorationAmount', 'prorationAmount'],
    ['paymentStatus', 'paymentStatus'],
  ];

  for (const [hookKey, edgeKey] of pairs) {
    it(`${hookKey} is sent by the edge function`, () => {
      expect(hookSrc).toContain(hookKey);
      expect(edgeSrc).toContain(edgeKey);
    });
  }
});

describe('the Stripe webhook stays on Express', () => {
  it('is not reimplemented in the subscriptions edge function', () => {
    // INTEG-WEBHOOK-001 mounted the receiver at /api/webhooks/stripe ahead of
    // the proxy precisely because a provider POST carries no JWT and this
    // function calls auth.getUser() before routing. A webhook branch here
    // would answer 401 and Stripe would retry into the same wall.
    const withoutComments = edgeSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/secondSegment === 'webhooks'/);
    expect(withoutComments).not.toContain('STRIPE_WEBHOOK_SECRET');
  });
});
