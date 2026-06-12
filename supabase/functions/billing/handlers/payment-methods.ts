// /billing/payment-methods + /billing/info + /billing/address (EDGE-002a).
//
// Ported from server/routes/billing.ts (consolidated router). Backed by the
// real `subscription_payment_methods` Drizzle table. Rows are mapped to the
// camelCase shape the frontend reads (client/src/pages/Billing.tsx) since the
// Express handlers returned Drizzle camelCase objects.
//
// POST /payment-methods (Stripe attach + get-or-create customer) is NOT ported:
// no frontend caller exists — Billing.tsx only lists and deletes. Stripe detach
// on delete is best-effort via the Stripe REST API when STRIPE_SECRET_KEY is set
// (matches the Express behavior of continuing on Stripe failure).
//
//   GET    /billing/payment-methods     → method[] (camelCase)
//   DELETE /billing/payment-methods/:id → { message }
//   GET    /billing/info                → default method's billingDetails | null
//   PUT    /billing/address             → { message, billingDetails }

import { createCorsResponse } from '../../_shared/cors.ts';
import type { BillingCtx } from './_context.ts';

const TABLE = 'subscription_payment_methods';

// deno-lint-ignore no-explicit-any
function mapPaymentMethod(row: any): Record<string, unknown> {
  return {
    id: row.id,
    type: row.type,
    stripePaymentMethodId: row.stripe_payment_method_id,
    cardBrand: row.card_brand,
    cardLast4: row.card_last4,
    cardExpMonth: row.card_exp_month,
    cardExpYear: row.card_exp_year,
    bankName: row.bank_name,
    bankLast4: row.bank_last4,
    isDefault: row.is_default,
    isActive: row.is_active,
    billingDetails: row.billing_details,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function detachFromStripe(stripePaymentMethodId: string): Promise<void> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/payment_methods/${encodeURIComponent(stripePaymentMethodId)}/detach`,
      { method: 'POST', headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      console.error(`Stripe detach failed (${res.status}):`, (await res.text()).slice(0, 300));
    }
  } catch (err) {
    // Best-effort — continue with the local delete even if Stripe fails.
    console.error('Stripe detach error:', err);
  }
}

export async function handlePaymentMethods(ctx: BillingCtx): Promise<Response | null> {
  const { req, admin, tenantId, parts } = ctx;
  const methodId = parts[1];

  if (req.method === 'GET' && !methodId) {
    const { data, error } = await admin
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment methods:', error);
      return createCorsResponse({ error: 'Failed to fetch payment methods' }, 500, req);
    }
    return createCorsResponse((data || []).map(mapPaymentMethod), 200, req);
  }

  if (req.method === 'DELETE' && methodId) {
    const { data: paymentMethod, error: fetchError } = await admin
      .from(TABLE)
      .select('*')
      .eq('id', methodId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError || !paymentMethod) {
      return createCorsResponse({ error: 'Payment method not found' }, 404, req);
    }

    if (paymentMethod.is_default) {
      const { count } = await admin
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if ((count ?? 0) <= 1) {
        return createCorsResponse(
          {
            error: 'Cannot delete the only payment method',
            message: 'Add another payment method before deleting this one',
          },
          400,
          req,
        );
      }
    }

    if (paymentMethod.stripe_payment_method_id) {
      await detachFromStripe(paymentMethod.stripe_payment_method_id);
    }

    const { error: deleteError } = await admin
      .from(TABLE)
      .delete()
      .eq('id', methodId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('Error deleting payment method:', deleteError);
      return createCorsResponse({ error: 'Failed to delete payment method' }, 500, req);
    }

    // If it was the default, promote another one.
    if (paymentMethod.is_default) {
      const { data: nextMethod } = await admin
        .from(TABLE)
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();
      if (nextMethod) {
        await admin
          .from(TABLE)
          .update({ is_default: true })
          .eq('id', nextMethod.id)
          .eq('tenant_id', tenantId);
      }
    }

    return createCorsResponse({ message: 'Payment method deleted successfully' }, 200, req);
  }

  return null;
}

async function getDefaultMethod(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  // deno-lint-ignore no-explicit-any
): Promise<any | null> {
  const { data } = await admin
    .from(TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function handleBillingInfo(ctx: BillingCtx): Promise<Response | null> {
  const { req, admin, tenantId } = ctx;
  if (req.method !== 'GET') return null;

  const method = await getDefaultMethod(admin, tenantId);
  return createCorsResponse(method?.billing_details ?? null, 200, req);
}

export async function handleBillingAddress(ctx: BillingCtx): Promise<Response | null> {
  const { req, admin, tenantId } = ctx;
  if (req.method !== 'PUT') return null;

  const body = await req.json();
  const required = ['name', 'addressLine1', 'city', 'state', 'postalCode'] as const;
  const missing = required.filter((f) => typeof body[f] !== 'string' || body[f].length === 0);
  if (missing.length > 0) {
    return createCorsResponse(
      { error: 'Invalid billing address data', details: missing.map((f) => `${f} is required`) },
      400,
      req,
    );
  }

  const addressData = {
    name: body.name,
    addressLine1: body.addressLine1,
    addressLine2: body.addressLine2 ?? undefined,
    city: body.city,
    state: body.state,
    postalCode: body.postalCode,
    country: body.country || 'US',
  };

  const method = await getDefaultMethod(admin, tenantId);
  if (!method) {
    return createCorsResponse(
      {
        error: 'No default payment method found',
        message: 'Add a payment method before updating billing address',
      },
      404,
      req,
    );
  }

  const { error } = await admin
    .from(TABLE)
    .update({ billing_details: addressData, updated_at: new Date().toISOString() })
    .eq('id', method.id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error updating billing address:', error);
    return createCorsResponse({ error: 'Failed to update billing address' }, 500, req);
  }

  return createCorsResponse(
    { message: 'Billing address updated successfully', billingDetails: addressData },
    200,
    req,
  );
}
