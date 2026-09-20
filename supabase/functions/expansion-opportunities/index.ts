// Expansion Opportunities Edge Function
//
// SEC-EDGE-001 batch 16. Nine column names here were phantom - name,
// description, potential_value, probability, products, actual_value, won_at,
// lost_at, lost_reason - so the list ORDERED BY a column that does not exist,
// every create and update was a PGRST204, and both the won and lost branches
// failed while answering "Failed to mark opportunity as won/lost", which reads
// as a transient fault rather than a schema mismatch.
//
// The table's own model is richer than what this function assumed, and that is
// what made the names wrong rather than merely misspelled: an opportunity has a
// TYPE and a SOURCE, a TRIGGER_EVENT and an INSIGHT, three separate money
// fields (estimated_mrr / estimated_arr / estimated_one_time_revenue), and a
// CONFIDENCE_LEVEL that is low|medium|high rather than a numeric probability.
// Closing it writes closed_at, actual_revenue and outcome_notes.
//
// THERE IS NO TITLE COLUMN. A caller sending `name` is refused rather than
// having it silently dropped into some other field (COP-B06: a write that
// quietly narrows what it stores turns a schema mismatch into invisible data
// loss). trigger_event is the nearest thing and means something else.
//
// AUDIT-026 is the standing question here: this is a complete renewal feature
// with its own schema that was never wired to a screen, beside a different
// renewal feature that was. Connecting or retiring it is a product call, so the
// columns are corrected and the decision is left open.
// Handles upsell and cross-sell opportunity tracking
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

/**
 * `confidence_level` is low|medium|high and callers may still send the numeric
 * `probability` the old shape used. Coerce by band rather than dropping it, and
 * report the coercion so a caller can see what was stored (COP-B00's rule for
 * mapping free numbers into a vocabulary).
 */
function confidenceFrom(body: Record<string, unknown>): { value: string | null; coerced: boolean } {
  const explicit = body.confidenceLevel ?? body.confidence_level;
  if (typeof explicit === 'string' && explicit) return { value: explicit, coerced: false };
  const probability = Number(body.probability);
  if (!Number.isFinite(probability)) return { value: null, coerced: false };
  if (probability >= 70) return { value: 'high', coerced: true };
  if (probability >= 40) return { value: 'medium', coerced: true };
  return { value: 'low', coerced: true };
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /expansion-opportunities, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'expansion-opportunities');
    const opportunityId = parts[0];
    const action = parts[1];

    // GET /expansion-opportunities - List opportunities
    if (req.method === 'GET' && !opportunityId) {
      const status = url.searchParams.get('status');
      const type = url.searchParams.get('type');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('expansion_opportunities')
        .select('*, customer:customer_id (id, company_name)')
        .eq('tenant_id', tenantId)
        // estimated_arr is the annual figure; potential_value was never a column,
        // so this ORDER BY was a 42703 that took the whole list down.
        .order('estimated_arr', { ascending: false, nullsFirst: false });

      if (status) query = query.eq('status', status);
      if (type) query = query.eq('opportunity_type', type);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: opportunities, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch expansion opportunities' }, 500, req);
      }

      return createCorsResponse(opportunities || [], 200, req);
    }

    // GET /expansion-opportunities/:id - Get single opportunity
    if (req.method === 'GET' && opportunityId && !action) {
      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        .select('*, customer:customer_id (*)')
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Expansion opportunity not found' }, 404, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // POST /expansion-opportunities - Create opportunity
    if (req.method === 'POST' && !opportunityId) {
      const body = await req.json();

      // customer_id and opportunity_type are both NOT NULL, so a 400 naming the
      // field beats a 23502 the caller reads as a server fault.
      const customerId = body.customerId || body.customer_id;
      if (!customerId) {
        return createCorsResponse(
          { error: 'customerId is required', code: 'VALIDATION_ERROR' },
          400,
          req,
        );
      }
      if (body.name) {
        return createCorsResponse(
          {
            error:
              'expansion_opportunities has no title column. Send triggerEvent (what prompted this) or insight (what the data shows) instead.',
            code: 'UNSTORABLE_FIELD',
            field: 'name',
          },
          400,
          req,
        );
      }

      const confidence = confidenceFrom(body);
      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          renewal_id: body.renewalId || body.renewal_id || null,
          owner_id: body.ownerId || body.owner_id || user.id,
          identified_by: body.identifiedBy || body.identified_by || user.id,
          opportunity_type: body.opportunityType || body.opportunity_type || 'upsell',
          opportunity_source: body.opportunitySource || body.opportunity_source || null,
          trigger_event: body.triggerEvent || body.trigger_event || null,
          insight: body.insight || body.description || null,
          estimated_mrr: body.estimatedMrr ?? body.estimated_mrr ?? null,
          estimated_arr: body.estimatedArr ?? body.estimated_arr ?? body.potentialValue ?? null,
          estimated_one_time_revenue:
            body.estimatedOneTimeRevenue ?? body.estimated_one_time_revenue ?? null,
          confidence_level: confidence.value,
          status: body.status || 'identified',
          priority: body.priority || null,
          proposed_products: body.proposedProducts || body.proposed_products || body.products || [],
          proposed_services: body.proposedServices || body.proposed_services || [],
          notes: body.notes || null,
          identified_at: new Date().toISOString(),
          target_close_date: body.targetCloseDate || body.target_close_date,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create expansion opportunity' }, 500, req);
      }

      return createCorsResponse(opportunity, 201, req);
    }

    // PUT /expansion-opportunities/:id - Update opportunity
    if (req.method === 'PUT' && opportunityId && !action) {
      const body = await req.json();

      const confidence = confidenceFrom(body);
      // Only the fields the caller sent: a blanket object nulls every column a
      // partial form omits (COP-B03).
      const patch: Record<string, unknown> = Object.fromEntries(
        Object.entries({
          owner_id: body.ownerId ?? body.owner_id,
          opportunity_type: body.opportunityType ?? body.opportunity_type,
          opportunity_source: body.opportunitySource ?? body.opportunity_source,
          trigger_event: body.triggerEvent ?? body.trigger_event,
          insight: body.insight ?? body.description,
          estimated_mrr: body.estimatedMrr ?? body.estimated_mrr,
          estimated_arr: body.estimatedArr ?? body.estimated_arr ?? body.potentialValue,
          estimated_one_time_revenue:
            body.estimatedOneTimeRevenue ?? body.estimated_one_time_revenue,
          confidence_level: confidence.value ?? undefined,
          status: body.status,
          priority: body.priority,
          proposed_products: body.proposedProducts ?? body.proposed_products ?? body.products,
          proposed_services: body.proposedServices ?? body.proposed_services,
          notes: body.notes,
          target_close_date: body.targetCloseDate ?? body.target_close_date,
        }).filter(([, v]) => v !== undefined),
      );
      patch.updated_at = new Date().toISOString();

      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        .update(patch)
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update expansion opportunity' }, 500, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // POST /expansion-opportunities/:id/won - Mark as won
    if (req.method === 'POST' && opportunityId && action === 'won') {
      const body = await req.json();

      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        // closed_at and actual_revenue are the real columns; there is one
        // closed_at for both outcomes and `status` says which it was.
        .update({
          status: 'won',
          actual_revenue: body.actualRevenue ?? body.actual_revenue ?? body.actualValue ?? null,
          outcome_notes: body.outcomeNotes || body.outcome_notes || null,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to mark opportunity as won' }, 500, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // POST /expansion-opportunities/:id/lost - Mark as lost
    if (req.method === 'POST' && opportunityId && action === 'lost') {
      const body = await req.json();

      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        // There is no lost_reason column: outcome_notes carries why, for both
        // outcomes, and closed_at is when.
        .update({
          status: 'lost',
          outcome_notes: body.reason || body.outcomeNotes || body.outcome_notes || null,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to mark opportunity as lost' }, 500, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // DELETE /expansion-opportunities/:id - Delete opportunity
    if (req.method === 'DELETE' && opportunityId) {
      const { error } = await admin
        .from('expansion_opportunities')
        .delete()
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete expansion opportunity' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Expansion opportunity deleted' },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in expansion-opportunities function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
