// Stripe REST client for the edge runtime (PROD-STRIPE-001).
//
// WHICH HOST HOLDS THE STRIPE CREDENTIALS, and why it is both of them.
//
// The browser cannot reach Express in production. `getApiUrl` rewrites
// /api/<segment> straight to functions.printyx.net, so every interactive
// payment path - starting a checkout, opening the customer portal, adding a
// card, previewing an upgrade, reading the publishable key - has to be served
// by an edge function or it is served by nothing. Those paths live here.
//
// The Stripe WEBHOOK stays on Express at /api/webhooks/stripe, where
// INTEG-WEBHOOK-001 put it and mounted it ahead of the proxy: a provider POST
// carries no JWT, and every edge function calls auth.getUser() before routing,
// so a webhook sent to the functions host gets 401 and Stripe retries into the
// same wall. Moving it here would break it.
//
// So the split is deliberate: interactive paths on the edge, webhook on
// Express, and BOTH environments hold the same Stripe secret. They must be the
// same Stripe ACCOUNT - a checkout created against one account emits events a
// receiver configured for another cannot verify, and the subscription would
// never activate. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in the edge
// environment to the same values Express already has; STRIPE_WEBHOOK_SECRET is
// Express-only and is not read here.
//
// No SDK. The Stripe npm package is a Node library; the idiom already in this
// tree (billing/handlers/payment-methods.ts) is a form-encoded fetch against
// api.stripe.com, and that is what this module generalises.

const STRIPE_API = 'https://api.stripe.com/v1';

export class StripeError extends Error {
  readonly status: number;
  readonly stripeCode?: string;

  constructor(message: string, status: number, stripeCode?: string) {
    super(message);
    this.name = 'StripeError';
    this.status = status;
    this.stripeCode = stripeCode;
  }
}

export function getStripeSecretKey(): string | null {
  return Deno.env.get('STRIPE_SECRET_KEY') || null;
}

export function isStripeConfigured(): boolean {
  return !!getStripeSecretKey();
}

export function getStripePublishableKey(): string | null {
  return Deno.env.get('STRIPE_PUBLISHABLE_KEY') || null;
}

/**
 * Flatten a nested object into Stripe's bracketed form encoding.
 *
 *   { line_items: [{ price: 'p', quantity: 1 }], metadata: { tenantId: 't' } }
 *     -> line_items[0][price]=p&line_items[0][quantity]=1&metadata[tenantId]=t
 *
 * undefined and null values are dropped rather than sent as the strings
 * "undefined"/"null", which Stripe would take literally.
 */
export function toStripeForm(
  value: unknown,
  prefix = '',
  out: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  if (value === undefined || value === null) return out;

  if (Array.isArray(value)) {
    value.forEach((item, i) => toStripeForm(item, `${prefix}[${i}]`, out));
    return out;
  }

  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      toStripeForm(item, prefix ? `${prefix}[${key}]` : key, out);
    }
    return out;
  }

  if (prefix) out.append(prefix, String(value));
  return out;
}

interface StripeRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

export async function stripeRequest<T = Record<string, unknown>>(
  path: string,
  options: StripeRequestOptions = {},
): Promise<T> {
  const key = getStripeSecretKey();
  if (!key) throw new StripeError('Stripe is not configured', 503);

  const { method = 'GET', body, query } = options;
  const qs = query ? toStripeForm(query).toString() : '';
  const url = `${STRIPE_API}${path}${qs ? `?${qs}` : ''}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  let payload: string | undefined;
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = toStripeForm(body).toString();
  }

  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();

  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new StripeError(`Stripe returned unparseable body (${res.status})`, 502);
  }

  if (!res.ok) {
    const err = (parsed.error || {}) as { message?: string; code?: string };
    throw new StripeError(
      err.message || `Stripe request failed (${res.status})`,
      res.status,
      err.code,
    );
  }

  return parsed as T;
}

export interface StripeCheckoutSession {
  id: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  customer_email?: string | null;
  // deno-lint-ignore no-explicit-any
  customer?: any;
  // deno-lint-ignore no-explicit-any
  subscription?: any;
  metadata?: Record<string, string> | null;
}

export interface StripeInvoicePreview {
  subtotal?: number | null;
  total?: number | null;
  amount_due?: number | null;
  currency?: string | null;
}

/**
 * Resolve the tenant's Stripe customer, creating one on first use.
 *
 * The canonical home is `tenants.metadata.stripeCustomerId` - that is where
 * server/services/stripe-service.ts writes it, and the Express webhook reads
 * the same place, so the two hosts must not disagree. A subscription row's
 * `stripe_customer_id` is read as a fallback (rows written by the webhook from
 * a Stripe-side event carry it) and is refreshed whenever this creates one.
 */
export async function getOrCreateStripeCustomer(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  userEmail?: string | null,
): Promise<string> {
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, name, metadata')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !tenant) throw new StripeError('Tenant not found', 404);

  const metadata = (tenant.metadata || {}) as Record<string, unknown>;
  if (typeof metadata.stripeCustomerId === 'string' && metadata.stripeCustomerId) {
    return metadata.stripeCustomerId;
  }

  const { data: subscription } = await admin
    .from('tenant_subscriptions')
    .select('id, stripe_customer_id')
    .eq('tenant_id', tenantId)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (subscription?.stripe_customer_id) {
    await admin
      .from('tenants')
      .update({ metadata: { ...metadata, stripeCustomerId: subscription.stripe_customer_id } })
      .eq('id', tenantId);
    return subscription.stripe_customer_id;
  }

  let email = userEmail || null;
  if (!email) {
    const { data: anyUser } = await admin
      .from('users')
      .select('email')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    email = anyUser?.email || null;
  }

  const customer = await stripeRequest<{ id: string }>('/customers', {
    method: 'POST',
    body: {
      email: email || undefined,
      name: tenant.name || undefined,
      metadata: { tenantId },
    },
  });

  await admin
    .from('tenants')
    .update({ metadata: { ...metadata, stripeCustomerId: customer.id } })
    .eq('id', tenantId);

  return customer.id;
}

/**
 * The URL the customer comes back to. CLIENT_URL is the deployed frontend
 * origin; there is no request-derived default because the Origin header is
 * attacker-controlled and these URLs end up inside a Stripe session.
 */
export function clientBaseUrl(): string {
  return (Deno.env.get('CLIENT_URL') || 'https://printyx.net').replace(/\/+$/, '');
}
