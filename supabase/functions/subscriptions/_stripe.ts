// Stripe REST client for Deno edge functions.
//
// The edge runtime has no Stripe SDK; the established repo pattern
// (supabase/functions/billing/handlers/payment-methods.ts) calls the Stripe REST
// API directly with `fetch` + a Bearer secret key. This module generalizes that
// into typed helpers used by the subscriptions Stripe flow (checkout, portal,
// setup-intent, invoice preview, webhook signature verification).

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured');
    this.name = 'StripeNotConfiguredError';
  }
}

export class StripeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'StripeApiError';
    this.status = status;
  }
}

export function isStripeConfigured(): boolean {
  return !!Deno.env.get('STRIPE_SECRET_KEY');
}

export function getPublishableKey(): string | null {
  return Deno.env.get('STRIPE_PUBLISHABLE_KEY') || null;
}

type FormValue = string | number | boolean | null | undefined | FormObject | FormValue[];
interface FormObject {
  [key: string]: FormValue;
}

/**
 * Flattens a nested object into Stripe's bracket-notation form encoding.
 * e.g. { line_items: [{ price: 'p', quantity: 1 }] }
 *   -> line_items[0][price]=p&line_items[0][quantity]=1
 */
function encodeForm(obj: FormObject, prefix = ''): string[] {
  const pairs: string[] = [];
  for (const [k, raw] of Object.entries(obj)) {
    if (raw === undefined || raw === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(raw)) {
      raw.forEach((item, i) => {
        const arrKey = `${key}[${i}]`;
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          pairs.push(...encodeForm(item as FormObject, arrKey));
        } else {
          pairs.push(`${encodeURIComponent(arrKey)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof raw === 'object') {
      pairs.push(...encodeForm(raw as FormObject, key));
    } else {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(raw))}`);
    }
  }
  return pairs;
}

async function stripeRequest(
  method: 'GET' | 'POST',
  path: string,
  params?: FormObject,
): Promise<Record<string, unknown>> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new StripeNotConfiguredError();

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  let url = `https://api.stripe.com/v1/${path}`;
  let body: string | undefined;

  if (params && Object.keys(params).length > 0) {
    const encoded = encodeForm(params).join('&');
    if (method === 'GET') {
      url += `?${encoded}`;
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = encoded;
    }
  }

  const res = await fetch(url, { method, headers, body });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error as { message?: string } | undefined)?.message;
    throw new StripeApiError(err || `Stripe API error (${res.status})`, res.status);
  }
  return json;
}

interface StripeMetadata {
  [k: string]: string;
}

/**
 * Resolve a tenant's Stripe customer id, creating one if needed.
 *
 * NOTE (drift): the legacy StripeService persisted the customer id on
 * `tenants.metadata.stripeCustomerId`, but the `tenants` Drizzle table has no
 * `metadata` column. We use the REAL `tenant_subscriptions.stripe_customer_id`
 * column as the source of truth instead, and stamp it onto the active
 * subscription row when one exists. For brand-new checkouts (no subscription yet)
 * the customer is created with metadata.tenantId so the webhook can backfill it.
 */
export async function getOrCreateCustomer(
  admin: {
    from: (t: string) => any;
  },
  tenantId: string,
  email?: string | null,
): Promise<string> {
  // Reuse an existing customer id from any subscription row for this tenant.
  const { data: existing } = await admin
    .from('tenant_subscriptions')
    .select('id, stripe_customer_id')
    .eq('tenant_id', tenantId)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id as string;
  }

  const customer = await stripeRequest('POST', 'customers', {
    email: email || undefined,
    metadata: { tenantId },
  });
  const customerId = customer.id as string;

  // Persist onto the most recent subscription row, if any.
  const { data: latestSub } = await admin
    .from('tenant_subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSub?.id) {
    await admin
      .from('tenant_subscriptions')
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', latestSub.id);
  }

  return customerId;
}

export async function getExistingCustomerId(
  admin: { from: (t: string) => any },
  tenantId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('tenant_subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.stripe_customer_id as string) || null;
}

export interface CheckoutSessionParams {
  customer: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: StripeMetadata;
}

export async function createCheckoutSession(p: CheckoutSessionParams) {
  const params: FormObject = {
    mode: 'subscription',
    customer: p.customer,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    allow_promotion_codes: true,
    line_items: [{ price: p.priceId, quantity: 1 }],
    metadata: p.metadata,
    subscription_data:
      p.trialDays && p.trialDays > 0 ? { trial_period_days: p.trialDays } : undefined,
  };
  return stripeRequest('POST', 'checkout/sessions', params);
}

export interface OneTimeCheckoutParams {
  customer: string;
  priceId: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
  metadata?: StripeMetadata;
}

export async function createOneTimeCheckoutSession(p: OneTimeCheckoutParams) {
  const params: FormObject = {
    mode: 'payment',
    customer: p.customer,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    line_items: [{ price: p.priceId, quantity: p.quantity }],
    metadata: p.metadata,
  };
  return stripeRequest('POST', 'checkout/sessions', params);
}

export async function retrieveCheckoutSession(sessionId: string) {
  return stripeRequest('GET', `checkout/sessions/${encodeURIComponent(sessionId)}`, {
    'expand[0]': 'subscription',
  });
}

export async function createPortalSession(customer: string, returnUrl: string) {
  return stripeRequest('POST', 'billing_portal/sessions', {
    customer,
    return_url: returnUrl,
  });
}

export async function createSetupIntent(customer: string, metadata?: StripeMetadata) {
  return stripeRequest('POST', 'setup_intents', {
    customer,
    'payment_method_types[0]': 'card',
    metadata,
  });
}

/** Preview the proration invoice for switching a subscription to a new price. */
export async function previewUpcomingInvoice(
  customer: string,
  subscriptionId: string,
  newPriceId: string,
) {
  const sub = (await stripeRequest(
    'GET',
    `subscriptions/${encodeURIComponent(subscriptionId)}`,
  )) as { items?: { data?: Array<{ id: string }> } };
  const itemId = sub.items?.data?.[0]?.id;
  const params: FormObject = {
    customer,
    subscription: subscriptionId,
    subscription_items: [itemId ? { id: itemId, price: newPriceId } : { price: newPriceId }],
  };
  return stripeRequest('GET', 'invoices/upcoming', params);
}

/**
 * Verify a Stripe webhook signature without the SDK using Web Crypto.
 * Mirrors stripe.webhooks.constructEvent: parses the `t`/`v1` parts of the
 * Stripe-Signature header and HMAC-SHA256s `${timestamp}.${payload}`.
 */
export async function verifyWebhookSignature(
  payload: string,
  sigHeader: string,
  toleranceSeconds = 300,
): Promise<Record<string, unknown>> {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new StripeNotConfiguredError();

  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return [kv.slice(0, idx), kv.slice(idx + 1)];
    }),
  );
  const timestamp = parts['t'];
  const expectedSig = parts['v1'];
  if (!timestamp || !expectedSig) {
    throw new Error('Invalid Stripe-Signature header');
  }

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(`${timestamp}.${payload}`));
  const computed = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (computed.length !== expectedSig.length || computed !== expectedSig) {
    throw new Error('Webhook signature verification failed');
  }

  // Replay protection: reject events outside the tolerance window. Date.now() is
  // fine in the edge runtime (this is not a deterministic workflow script).
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - Number(timestamp)) > toleranceSeconds) {
    throw new Error('Webhook timestamp outside tolerance');
  }

  return JSON.parse(payload) as Record<string, unknown>;
}
