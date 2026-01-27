// Tax Rates Edge Function
// Handles tax rate management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rateId = pathParts[1];

    // GET /tax-rates - List tax rates
    if (req.method === 'GET' && !rateId) {
      const country = url.searchParams.get('country');
      const state = url.searchParams.get('state');
      const isActive = url.searchParams.get('isActive');

      let query = admin
        .from('tax_rates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('country', { ascending: true })
        .order('state', { ascending: true });

      if (country) query = query.eq('country', country);
      if (state) query = query.eq('state', state);
      if (isActive === 'true') query = query.eq('is_active', true);

      const { data: rates, error } = await query;

      if (error) {
        console.error('Error fetching tax rates:', error);
        return createCorsResponse({ error: 'Failed to fetch tax rates' }, 500, req);
      }

      return createCorsResponse(rates || [], 200, req);
    }

    // GET /tax-rates/lookup - Look up applicable tax rate
    if (req.method === 'GET' && rateId === 'lookup') {
      const country = url.searchParams.get('country') || 'US';
      const state = url.searchParams.get('state');
      const city = url.searchParams.get('city');
      const zipCode = url.searchParams.get('zipCode');

      // Find most specific matching tax rate
      let query = admin
        .from('tax_rates')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('country', country)
        .eq('is_active', true);

      if (state) query = query.eq('state', state);

      const { data: rates } = await query;

      // Find best match (most specific)
      let bestMatch = null;
      let specificity = 0;

      for (const rate of rates || []) {
        let matchScore = 1; // Country match

        if (rate.state === state) matchScore += 2;
        if (rate.city === city) matchScore += 4;
        if (rate.zip_code === zipCode) matchScore += 8;

        if (matchScore > specificity) {
          specificity = matchScore;
          bestMatch = rate;
        }
      }

      if (!bestMatch) {
        // Return default rate if no match
        return createCorsResponse(
          {
            rate: 0,
            name: 'No Tax',
            components: [],
          },
          200,
          req,
        );
      }

      return createCorsResponse(
        {
          rate: bestMatch.combined_rate || bestMatch.rate,
          name: bestMatch.name,
          components: bestMatch.components || [],
          rateId: bestMatch.id,
        },
        200,
        req,
      );
    }

    // GET /tax-rates/:id - Get single tax rate
    if (req.method === 'GET' && rateId) {
      const { data: rate, error } = await admin
        .from('tax_rates')
        .select('*')
        .eq('id', rateId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Tax rate not found' }, 404, req);
      }

      return createCorsResponse(rate, 200, req);
    }

    // POST /tax-rates - Create tax rate
    if (req.method === 'POST' && !rateId) {
      const body = await req.json();

      // Calculate combined rate from components
      const components = body.components || [];
      const combinedRate =
        components.reduce((sum: number, c: any) => sum + (c.rate || 0), 0) || body.rate || 0;

      const rateData = {
        tenant_id: tenantId,
        name: body.name,
        country: body.country || 'US',
        state: body.state,
        city: body.city,
        zip_code: body.zipCode || body.zip_code,
        rate: body.rate || 0,
        combined_rate: combinedRate,
        components: components,
        is_active: body.isActive !== false,
        effective_date: body.effectiveDate || body.effective_date,
        end_date: body.endDate || body.end_date,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: rate, error } = await admin
        .from('tax_rates')
        .insert(rateData)
        .select()
        .single();

      if (error) {
        console.error('Error creating tax rate:', error);
        return createCorsResponse({ error: 'Failed to create tax rate' }, 500, req);
      }

      return createCorsResponse(rate, 201, req);
    }

    // PUT /tax-rates/:id - Update tax rate
    if (req.method === 'PUT' && rateId) {
      const body = await req.json();

      // Recalculate combined rate if components provided
      let updateData = { ...body, updated_at: new Date().toISOString() };
      if (body.components) {
        updateData.combined_rate = body.components.reduce(
          (sum: number, c: any) => sum + (c.rate || 0),
          0,
        );
      }

      const { data: rate, error } = await admin
        .from('tax_rates')
        .update(updateData)
        .eq('id', rateId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update tax rate' }, 500, req);
      }

      return createCorsResponse(rate, 200, req);
    }

    // POST /tax-rates/calculate - Calculate tax for an amount
    if (req.method === 'POST' && rateId === 'calculate') {
      const body = await req.json();
      const { amount, country, state, city, zipCode, rateIdOverride } = body;

      let taxRate = 0;
      let rateName = 'No Tax';
      let components: any[] = [];

      if (rateIdOverride) {
        // Use specific rate
        const { data: rate } = await admin
          .from('tax_rates')
          .select('*')
          .eq('id', rateIdOverride)
          .single();

        if (rate) {
          taxRate = rate.combined_rate || rate.rate || 0;
          rateName = rate.name;
          components = rate.components || [];
        }
      } else {
        // Look up rate by location
        let query = admin
          .from('tax_rates')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('country', country || 'US')
          .eq('is_active', true);

        if (state) query = query.eq('state', state);

        const { data: rates } = await query;

        // Find best match
        for (const rate of rates || []) {
          if (rate.city === city || rate.zip_code === zipCode || (!rate.city && !rate.zip_code)) {
            taxRate = rate.combined_rate || rate.rate || 0;
            rateName = rate.name;
            components = rate.components || [];
            break;
          }
        }
      }

      const taxAmount = (amount || 0) * (taxRate / 100);

      return createCorsResponse(
        {
          amount,
          taxRate,
          taxAmount,
          totalWithTax: (amount || 0) + taxAmount,
          rateName,
          components: components.map((c: any) => ({
            name: c.name,
            rate: c.rate,
            amount: (amount || 0) * (c.rate / 100),
          })),
        },
        200,
        req,
      );
    }

    // DELETE /tax-rates/:id - Delete tax rate
    if (req.method === 'DELETE' && rateId) {
      const { error } = await admin
        .from('tax_rates')
        .delete()
        .eq('id', rateId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete tax rate' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Tax rate deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in tax-rates function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
