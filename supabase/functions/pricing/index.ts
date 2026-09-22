// Pricing Edge Function
// Handles product pricing, company settings, and price calculations
import { getCorsHeaders } from '../_shared/cors.ts';
import { toCsv } from '../_shared/csv.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { calculateRepCost, canEditDealerCost, canSeeDealerCost } from '../_shared/pricing-math.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import {
  buildCompanyPricingSettingsUpdate,
  toCompanyPricingSettings,
} from '../../../shared/company-pricing-settings.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID from JWT metadata
    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Server strips function name, so /pricing/company-settings becomes /company-settings
    const resource = pathParts[0]; // 'settings', 'products', 'company-settings', etc.
    const resourceId = pathParts[1];
    const action = pathParts[2]; // 'bulk-update', etc.

    // The role the pricing gates read. Managers and above see dealer cost,
    // margin reports and approvals — the same map and the same level as
    // server/services/pricing-service.ts, via the shared copy.
    const userRole =
      ((user.app_metadata?.role ?? user.user_metadata?.role) as string | undefined) ?? 'standard';

    // ========================================================================
    // POST /pricing/calculate-rep-cost
    //
    // PROD-014: Express-only, so the rep-cost preview on the product pricing
    // form 404'd in production. The markup precedence (product markup, then a
    // category override, then the company default) comes from the shared copy,
    // because reordering it silently reprices a catalog.
    // ========================================================================
    if (req.method === 'POST' && resource === 'calculate-rep-cost') {
      const body = await req.json().catch(() => ({}));
      const rawDealerCost = body.dealerCost ?? body.dealer_cost;
      const dealerCost = Number.parseFloat(String(rawDealerCost ?? ''));

      if (!rawDealerCost || !Number.isFinite(dealerCost)) {
        return createCorsResponse({ error: 'Valid dealer cost required' }, 400, req);
      }

      const { data: settings } = await admin
        .from('company_pricing_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const rawMarkup = body.markupPercentage ?? body.markup_percentage;
      const markupPercentage =
        rawMarkup === undefined || rawMarkup === null || rawMarkup === ''
          ? null
          : Number.parseFloat(String(rawMarkup));

      const repCost = calculateRepCost(
        dealerCost,
        markupPercentage,
        settings,
        body.productCategory ?? body.product_category,
      );

      return createCorsResponse(
        {
          dealerCost,
          repCost,
          markupPercentage: rawMarkup ?? settings?.default_markup_percentage,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /pricing/approvals/pending
    //
    // PROD-014: Express-only, so the approvals badge and the dashboard widget
    // had nothing in production. The body is [{ approval, requestedBy }], which
    // is what both components destructure.
    // ========================================================================
    if (req.method === 'GET' && resource === 'approvals' && resourceId === 'pending') {
      if (!canSeeDealerCost(userRole)) {
        return createCorsResponse({ error: 'Insufficient permissions' }, 403, req);
      }

      const { data, error } = await admin
        .from('price_change_approvals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('requested_date', { ascending: false });

      if (error) {
        console.error('Error fetching pending approvals:', error);
        return createCorsResponse({ error: 'Failed to fetch pending approvals' }, 500, req);
      }

      const rows = data ?? [];
      const requesterIds = [
        ...new Set(rows.map((r: Record<string, unknown>) => r.requested_by).filter(Boolean)),
      ];
      const byId = new Map<string, Record<string, unknown>>();
      if (requesterIds.length) {
        const { data: people } = await admin
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', requesterIds as string[]);
        for (const person of people ?? []) byId.set(person.id, person);
      }

      // camelCase, because the widgets read approval.requestedDate and
      // requestedBy.firstName straight off the row.
      const pending = rows.map((row: Record<string, any>) => {
        const person = byId.get(row.requested_by) ?? null;
        return {
          approval: {
            id: row.id,
            status: row.status,
            requestedDate: row.requested_date,
            requestedPrice: row.requested_price,
            originalPrice: row.original_price,
            discountPercentage: row.discount_percentage,
            requestReason: row.request_reason,
          },
          requestedBy: person
            ? {
                firstName: (person as Record<string, unknown>).first_name,
                lastName: (person as Record<string, unknown>).last_name,
                email: (person as Record<string, unknown>).email,
              }
            : null,
        };
      });

      return createCorsResponse(pending, 200, req);
    }

    // ========================================================================
    // PATCH /pricing/approval/:id - approve or reject
    // ========================================================================
    if ((req.method === 'PATCH' || req.method === 'PUT') && resource === 'approval' && resourceId) {
      if (!canSeeDealerCost(userRole)) {
        return createCorsResponse(
          { error: 'Insufficient permissions to approve pricing' },
          403,
          req,
        );
      }

      const body = await req.json().catch(() => ({}));
      const status = body.status;
      if (!['approved', 'rejected'].includes(status)) {
        return createCorsResponse({ error: "Status must be 'approved' or 'rejected'" }, 400, req);
      }

      const nowIso = new Date().toISOString();
      const update: Record<string, unknown> = {
        status,
        approved_by: user.id,
        approved_date: nowIso,
        updated_at: nowIso,
      };
      // Only one of the two is recorded, matching Express: a rejection reason on
      // an approved row would read as a rejected one later.
      if (status === 'approved') update.approval_notes = body.approvalNotes ?? null;
      else update.rejection_reason = body.rejectionReason ?? null;

      const { data: updated, error } = await admin
        .from('price_change_approvals')
        .update(update)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error updating approval status:', error);
        return createCorsResponse({ error: 'Failed to update approval status' }, 500, req);
      }
      if (!updated) {
        return createCorsResponse({ error: 'Approval not found' }, 404, req);
      }

      return createCorsResponse(updated, 200, req);
    }

    // ========================================================================
    // GET /pricing/margin-report
    //
    // PROD-014: Express-only, so MarginTrendsWidget had no data in production.
    // The numbers are STORED on enhanced_quote_pricing (total_margin_amount,
    // total_margin_percentage) rather than recomputed here — recomputing would
    // put a third margin formula in the codebase, which is how the two that
    // disagreed with shared/quote-math.ts got there.
    // ========================================================================
    // GET /pricing/margin-report and /pricing/margin-report/export
    //
    // PLATFORM-EXPORT-001 found the export path existed on Express ONLY, so it
    // worked in dev and 404'd in production the moment getApiUrl sent
    // /api/pricing to this function. Same report, same filters, two
    // representations - sharing the branch is what keeps them from drifting
    // into two different definitions of "margin".
    if (
      req.method === 'GET' &&
      resource === 'margin-report' &&
      (!resourceId || resourceId === 'export')
    ) {
      if (!canSeeDealerCost(userRole)) {
        return createCorsResponse(
          { error: 'Insufficient permissions to view margin report' },
          403,
          req,
        );
      }

      let query = admin
        .from('enhanced_quote_pricing')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      const quoteId = url.searchParams.get('quoteId');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const salesRepId = url.searchParams.get('salesRepId');
      if (quoteId) query = query.eq('id', quoteId);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);
      if (salesRepId) query = query.eq('created_by', salesRepId);

      const { data: quotes, error } = await query;
      if (error) {
        console.error('Error building margin report:', error);
        return createCorsResponse({ error: 'Failed to generate margin report' }, 500, req);
      }

      const rows = quotes ?? [];
      const repIds = [
        ...new Set(rows.map((q: Record<string, unknown>) => q.created_by).filter(Boolean)),
      ];
      const repById = new Map<string, Record<string, unknown>>();
      if (repIds.length) {
        const { data: people } = await admin
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', repIds as string[]);
        for (const person of people ?? []) repById.set(person.id, person);
      }

      const num = (v: unknown) => {
        const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
        return Number.isFinite(n) ? n : 0;
      };

      const report = rows.map((quote: Record<string, any>) => {
        const rep = repById.get(quote.created_by) as Record<string, unknown> | undefined;
        const repName = rep
          ? [rep.first_name, rep.last_name].filter(Boolean).join(' ') || (rep.email as string) || ''
          : '';
        return {
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          quoteDate: quote.created_at,
          salesRep: repName,
          totalDealerCost: num(quote.total_dealer_cost),
          totalRepCost: num(quote.total_rep_cost),
          totalCustomerPrice: num(quote.total_customer_price),
          totalMargin: num(quote.total_margin_amount),
          marginPercentage: num(quote.total_margin_percentage),
          totalRepMargin: num(quote.total_rep_margin_amount),
          repMarginPercentage: num(quote.total_rep_margin_percentage),
        };
      });

      if (resourceId === 'export') {
        const headers = [
          'Quote Number',
          'Date',
          'Sales Rep',
          'Total Dealer Cost',
          'Total Rep Cost',
          'Total Customer Price',
          'Total Margin ($)',
          'Margin %',
          'Rep Margin ($)',
          'Rep Margin %',
        ];
        // A blank cell for a missing quote number, never the string
        // "undefined"; the numbers are already coerced by num() above, where a
        // non-numeric column reads as 0 rather than NaN.
        const csv = toCsv([
          headers,
          ...report.map((r) => [
            String(r.quoteNumber ?? ''),
            r.quoteDate ? String(r.quoteDate).slice(0, 10) : '',
            r.salesRep,
            r.totalDealerCost.toFixed(2),
            r.totalRepCost.toFixed(2),
            r.totalCustomerPrice.toFixed(2),
            r.totalMargin.toFixed(2),
            r.marginPercentage.toFixed(1),
            r.totalRepMargin.toFixed(2),
            r.repMarginPercentage.toFixed(1),
          ]),
        ]);
        const stamp = new Date().toISOString().slice(0, 10);
        return new Response(csv, {
          status: 200,
          headers: {
            ...getCorsHeaders(req.headers.get('Origin')),
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="margin-report-${stamp}.csv"`,
          },
        });
      }

      return createCorsResponse({ count: report.length, report }, 200, req);
    }

    /**
     * GET /pricing/settings and /pricing/company-settings
     *
     * THE ROW IS BOOTSTRAPPED, not faked. This branch used to answer a
     * hand-written defaults object for a tenant with no row, using five key
     * names the table has never had - so the page showed a 20% discount
     * ceiling while `supabase/functions/proposals` read the table, found no
     * row, and enforced nothing. A displayed ceiling that no quote is checked
     * against is worse than a blank.
     *
     * The insert supplies `tenant_id` and nothing else, so Postgres applies
     * the declared column defaults and there is no second copy of the ceiling
     * here to drift from the schema. `tenant_id` is UNIQUE, so a concurrent
     * bootstrap conflicts rather than duplicating, and the re-read below is
     * what that race lands on.
     */
    if (req.method === 'GET' && (resource === 'company-settings' || resource === 'settings')) {
      const { data: settings, error } = await admin
        .from('company_pricing_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching company pricing settings:', error);
        return createCorsResponse({ error: 'Failed to fetch pricing settings' }, 500, req);
      }

      if (settings) {
        return createCorsResponse(toCompanyPricingSettings(settings), 200, req);
      }

      const { data: created, error: createError } = await admin
        .from('company_pricing_settings')
        .insert({ tenant_id: tenantId })
        .select()
        .single();

      if (createError) {
        // A concurrent bootstrap won the unique index; read what it wrote
        // rather than reporting a failure the caller cannot act on.
        const { data: raced } = await admin
          .from('company_pricing_settings')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (raced) return createCorsResponse(toCompanyPricingSettings(raced), 200, req);

        console.error('Error creating company pricing settings:', createError);
        return createCorsResponse({ error: 'Failed to create pricing settings' }, 500, req);
      }

      return createCorsResponse(toCompanyPricingSettings(created), 200, req);
    }

    /**
     * PUT/PATCH /pricing/settings and POST/PUT/PATCH /pricing/company-settings
     *
     * POST on `company-settings` is the spelling PricingManagement.tsx uses
     * and it had no branch at all, so that dialog's Save answered 405 in
     * production with no error handler on the mutation - nothing happened and
     * nothing said so.
     *
     * GATED, because this row decides what every rep in the tenant may
     * discount and whether they see dealer cost - the party the policy checks
     * editing the policy. `canEditDealerCost` is what the Express half already
     * required of the same write.
     */
    if (
      (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST') &&
      (resource === 'settings' || resource === 'company-settings') &&
      !resourceId
    ) {
      if (!canEditDealerCost(userRole)) {
        return createCorsResponse(
          { error: 'Insufficient permissions to edit pricing settings', code: 'INSUFFICIENT_ROLE' },
          403,
          req,
        );
      }

      const body = await req.json().catch(() => ({}));
      const plan = buildCompanyPricingSettingsUpdate(body);

      if (Object.keys(plan.set).length === 0) {
        return createCorsResponse(
          {
            error: 'No writable pricing settings in request',
            code: 'NO_WRITABLE_FIELDS',
            ignoredFields: plan.ignoredFields,
            refusedFields: plan.refusedFields,
          },
          400,
          req,
        );
      }

      const { data: settings, error } = await admin
        .from('company_pricing_settings')
        .upsert(
          { tenant_id: tenantId, ...plan.set, updated_at: new Date().toISOString() },
          { onConflict: 'tenant_id' },
        )
        .select()
        .single();

      if (error) {
        console.error('Error updating company pricing settings:', error);
        return createCorsResponse({ error: 'Failed to update pricing settings' }, 500, req);
      }

      return createCorsResponse(
        {
          ...toCompanyPricingSettings(settings),
          ignoredFields: plan.ignoredFields,
          refusedFields: plan.refusedFields,
        },
        200,
        req,
      );
    }

    // GET /pricing/products - List all product pricing with filters
    if (req.method === 'GET' && resource === 'products' && !resourceId) {
      const productType =
        url.searchParams.get('productType') || url.searchParams.get('product_type');
      const isActive = url.searchParams.get('isActive') || url.searchParams.get('is_active');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('product_pricing')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (productType) {
        query = query.eq('product_type', productType);
      }

      if (isActive !== null && isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      const { data: pricing, error, count } = await query;

      if (error) {
        console.error('Error fetching product pricing:', error);
        return createCorsResponse({ error: 'Failed to fetch product pricing' }, 500, req);
      }

      return createCorsResponse(
        {
          data: pricing || [],
          total: count || 0,
        },
        200,
        req,
      );
    }

    // GET /pricing/products/:id - Get single product pricing
    if (req.method === 'GET' && resource === 'products' && resourceId) {
      const { data: pricing, error } = await admin
        .from('product_pricing')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching product pricing:', error);
        return createCorsResponse({ error: 'Product pricing not found' }, 404, req);
      }

      return createCorsResponse(pricing, 200, req);
    }

    // POST /pricing/products - Create product pricing
    if (req.method === 'POST' && resource === 'products' && !action) {
      const body = await req.json();

      const pricingData = {
        tenant_id: tenantId,
        product_id: body.productId || body.product_id,
        product_type: body.productType || body.product_type || 'model',
        dealer_cost: body.dealerCost || body.dealer_cost,
        company_markup_percentage:
          body.companyMarkupPercentage !== undefined
            ? body.companyMarkupPercentage
            : body.company_markup_percentage,
        company_price: body.companyPrice || body.company_price,
        minimum_sale_price:
          body.minimumSalePrice !== undefined ? body.minimumSalePrice : body.minimum_sale_price,
        suggested_retail_price:
          body.suggestedRetailPrice !== undefined
            ? body.suggestedRetailPrice
            : body.suggested_retail_price,
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        effective_date: body.effectiveDate || body.effective_date || new Date().toISOString(),
        expiration_date: body.expirationDate || body.expiration_date || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: pricing, error } = await admin
        .from('product_pricing')
        .insert(pricingData)
        .select()
        .single();

      if (error) {
        console.error('Error creating product pricing:', error);
        return createCorsResponse(
          { error: 'Failed to create product pricing', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(pricing, 201, req);
    }

    // POST /pricing/products/bulk-update - Bulk update product pricing
    if (req.method === 'POST' && resource === 'products' && resourceId === 'bulk-update') {
      const body = await req.json();
      const { updates } = body;

      if (!updates || !Array.isArray(updates)) {
        return createCorsResponse({ error: 'updates array is required' }, 400, req);
      }

      const results = [];

      for (const update of updates) {
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        // Map fields
        if (update.dealerCost !== undefined || update.dealer_cost !== undefined)
          updateData.dealer_cost = update.dealerCost || update.dealer_cost;
        if (
          update.companyMarkupPercentage !== undefined ||
          update.company_markup_percentage !== undefined
        )
          updateData.company_markup_percentage =
            update.companyMarkupPercentage || update.company_markup_percentage;
        if (update.companyPrice !== undefined || update.company_price !== undefined)
          updateData.company_price = update.companyPrice || update.company_price;
        if (update.minimumSalePrice !== undefined || update.minimum_sale_price !== undefined)
          updateData.minimum_sale_price = update.minimumSalePrice || update.minimum_sale_price;
        if (
          update.suggestedRetailPrice !== undefined ||
          update.suggested_retail_price !== undefined
        )
          updateData.suggested_retail_price =
            update.suggestedRetailPrice || update.suggested_retail_price;
        if (update.isActive !== undefined || update.is_active !== undefined)
          updateData.is_active = update.isActive !== undefined ? update.isActive : update.is_active;

        const { data: pricing, error } = await admin
          .from('product_pricing')
          .update(updateData)
          .eq('product_id', update.productId || update.product_id)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (!error && pricing) {
          results.push(pricing);
        }
      }

      return createCorsResponse({ updated: results.length, results }, 200, req);
    }

    // PATCH /pricing/products/:id - Update product pricing
    if ((req.method === 'PATCH' || req.method === 'PUT') && resource === 'products' && resourceId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map fields
      if (body.dealerCost !== undefined || body.dealer_cost !== undefined)
        updateData.dealer_cost = body.dealerCost || body.dealer_cost;
      if (
        body.companyMarkupPercentage !== undefined ||
        body.company_markup_percentage !== undefined
      )
        updateData.company_markup_percentage =
          body.companyMarkupPercentage || body.company_markup_percentage;
      if (body.companyPrice !== undefined || body.company_price !== undefined)
        updateData.company_price = body.companyPrice || body.company_price;
      if (body.minimumSalePrice !== undefined || body.minimum_sale_price !== undefined)
        updateData.minimum_sale_price = body.minimumSalePrice || body.minimum_sale_price;
      if (body.suggestedRetailPrice !== undefined || body.suggested_retail_price !== undefined)
        updateData.suggested_retail_price =
          body.suggestedRetailPrice || body.suggested_retail_price;
      if (body.isActive !== undefined || body.is_active !== undefined)
        updateData.is_active = body.isActive !== undefined ? body.isActive : body.is_active;
      if (body.effectiveDate || body.effective_date)
        updateData.effective_date = body.effectiveDate || body.effective_date;
      if (body.expirationDate !== undefined || body.expiration_date !== undefined)
        updateData.expiration_date = body.expirationDate || body.expiration_date;

      const { data: pricing, error } = await admin
        .from('product_pricing')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating product pricing:', error);
        return createCorsResponse({ error: 'Failed to update product pricing' }, 500, req);
      }

      return createCorsResponse(pricing, 200, req);
    }

    // DELETE /pricing/products/:id - Delete product pricing
    if (req.method === 'DELETE' && resource === 'products' && resourceId) {
      const { error } = await admin
        .from('product_pricing')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting product pricing:', error);
        return createCorsResponse({ error: 'Failed to delete product pricing' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Product pricing deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in pricing function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
