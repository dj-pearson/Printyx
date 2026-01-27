// Quotes Edge Function
// Handles quote/proposal management with line items
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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
    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const quoteId = pathParts[1];
    const action = pathParts[2]; // 'send', 'accept', 'reject', etc.

    // GET /quotes - List all quotes with filters
    if (req.method === 'GET' && !quoteId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const leadId = url.searchParams.get('leadId') || url.searchParams.get('lead_id');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('quotes')
        .select(
          `
          *,
          customer:business_records!quotes_customer_id_fkey(id, company_name, primary_contact_name, primary_contact_email),
          created_by_user:users!quotes_created_by_fkey(id, first_name, last_name, email)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      if (search) {
        query = query.or(`quote_number.ilike.%${search}%,title.ilike.%${search}%`);
      }

      const { data: quotes, error, count } = await query;

      if (error) {
        console.error('Error fetching quotes:', error);
        return createCorsResponse({ error: 'Failed to fetch quotes' }, 500, req);
      }

      return createCorsResponse(
        {
          data: quotes || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /quotes/:id - Get single quote with line items
    if (req.method === 'GET' && quoteId && !action) {
      const { data: quote, error } = await admin
        .from('quotes')
        .select(
          `
          *,
          customer:business_records!quotes_customer_id_fkey(id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone, address_line1, city, state, postal_code),
          created_by_user:users!quotes_created_by_fkey(id, first_name, last_name, email, phone)
        `,
        )
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching quote:', error);
        return createCorsResponse({ error: 'Quote not found' }, 404, req);
      }

      // Fetch line items
      const { data: lineItems } = await admin
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', quoteId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      return createCorsResponse({ ...quote, lineItems: lineItems || [] }, 200, req);
    }

    // POST /quotes - Create new quote
    if (req.method === 'POST' && !quoteId) {
      const body = await req.json();

      // Generate quote number if not provided
      const quoteNumber = body.quoteNumber || body.quote_number || `QTE-${Date.now()}`;

      // Calculate total from line items
      const lineItems = body.lineItems || body.line_items || [];
      const totalAmount = lineItems.reduce(
        (sum: number, item: any) => sum + parseFloat(item.totalPrice || item.total_price || 0),
        0,
      );

      // Set default valid until (30 days from now)
      const defaultValidUntil = new Date();
      defaultValidUntil.setDate(defaultValidUntil.getDate() + 30);

      const quoteData = {
        tenant_id: tenantId,
        lead_id: body.leadId || body.lead_id || null,
        customer_id: body.customerId || body.customer_id || null,
        quote_number: quoteNumber,
        title: body.title,
        status: body.status || 'draft',
        total_amount: body.totalAmount || body.total_amount || totalAmount,
        valid_until: body.validUntil || body.valid_until || defaultValidUntil.toISOString(),
        terms: body.terms || null,
        notes: body.notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: quote, error } = await admin.from('quotes').insert(quoteData).select().single();

      if (error) {
        console.error('Error creating quote:', error);
        return createCorsResponse({ error: 'Failed to create quote', details: error }, 500, req);
      }

      // Insert line items if provided
      if (lineItems.length > 0) {
        const lineItemsData = lineItems.map((item: any) => ({
          tenant_id: tenantId,
          quote_id: quote.id,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unitPrice || item.unit_price,
          total_price:
            item.totalPrice ||
            item.total_price ||
            (item.quantity || 1) * (item.unitPrice || item.unit_price),
          created_at: new Date().toISOString(),
        }));

        const { error: itemsError } = await admin.from('quote_line_items').insert(lineItemsData);

        if (itemsError) {
          console.error('Error creating quote line items:', itemsError);
          // Note: Quote was created but line items failed
          // You may want to delete the quote or handle this differently
        }
      }

      // Fetch the complete quote with line items
      const { data: completeQuote } = await admin
        .from('quotes')
        .select(
          `
          *,
          lineItems:quote_line_items(*)
        `,
        )
        .eq('id', quote.id)
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(completeQuote || quote, 201, req);
    }

    // POST /quotes/:id/send - Mark quote as sent
    if (req.method === 'POST' && quoteId && action === 'send') {
      const { data: quote, error } = await admin
        .from('quotes')
        .update({
          status: 'sent',
          sent_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error sending quote:', error);
        return createCorsResponse({ error: 'Failed to send quote' }, 500, req);
      }

      return createCorsResponse(quote, 200, req);
    }

    // POST /quotes/:id/accept - Mark quote as accepted
    if (req.method === 'POST' && quoteId && action === 'accept') {
      const { data: quote, error } = await admin
        .from('quotes')
        .update({
          status: 'accepted',
          accepted_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error accepting quote:', error);
        return createCorsResponse({ error: 'Failed to accept quote' }, 500, req);
      }

      return createCorsResponse(quote, 200, req);
    }

    // POST /quotes/:id/reject - Mark quote as rejected
    if (req.method === 'POST' && quoteId && action === 'reject') {
      const body = await req.json();

      const { data: quote, error } = await admin
        .from('quotes')
        .update({
          status: 'rejected',
          notes: body.reason
            ? `${body.notes || ''}\n\nRejection reason: ${body.reason}`
            : body.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error rejecting quote:', error);
        return createCorsResponse({ error: 'Failed to reject quote' }, 500, req);
      }

      return createCorsResponse(quote, 200, req);
    }

    // PATCH /quotes/:id - Update quote
    if ((req.method === 'PATCH' || req.method === 'PUT') && quoteId && !action) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map updatable fields
      if (body.title) updateData.title = body.title;
      if (body.status) updateData.status = body.status;
      if (body.totalAmount !== undefined || body.total_amount !== undefined)
        updateData.total_amount = body.totalAmount || body.total_amount;
      if (body.validUntil || body.valid_until)
        updateData.valid_until = body.validUntil || body.valid_until;
      if (body.terms !== undefined) updateData.terms = body.terms;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.leadId || body.lead_id) updateData.lead_id = body.leadId || body.lead_id;
      if (body.customerId || body.customer_id)
        updateData.customer_id = body.customerId || body.customer_id;

      const { data: quote, error } = await admin
        .from('quotes')
        .update(updateData)
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating quote:', error);
        return createCorsResponse({ error: 'Failed to update quote' }, 500, req);
      }

      // Update line items if provided
      if (body.lineItems || body.line_items) {
        const lineItems = body.lineItems || body.line_items;

        // Delete existing line items
        await admin
          .from('quote_line_items')
          .delete()
          .eq('quote_id', quoteId)
          .eq('tenant_id', tenantId);

        // Insert new line items
        if (lineItems.length > 0) {
          const lineItemsData = lineItems.map((item: any) => ({
            tenant_id: tenantId,
            quote_id: quoteId,
            description: item.description,
            quantity: item.quantity || 1,
            unit_price: item.unitPrice || item.unit_price,
            total_price:
              item.totalPrice ||
              item.total_price ||
              (item.quantity || 1) * (item.unitPrice || item.unit_price),
            created_at: new Date().toISOString(),
          }));

          await admin.from('quote_line_items').insert(lineItemsData);
        }
      }

      // Fetch updated quote with line items
      const { data: completeQuote } = await admin
        .from('quotes')
        .select(
          `
          *,
          lineItems:quote_line_items(*)
        `,
        )
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(completeQuote || quote, 200, req);
    }

    // DELETE /quotes/:id - Delete quote
    if (req.method === 'DELETE' && quoteId) {
      // First delete line items
      await admin
        .from('quote_line_items')
        .delete()
        .eq('quote_id', quoteId)
        .eq('tenant_id', tenantId);

      // Then delete the quote
      const { error } = await admin
        .from('quotes')
        .delete()
        .eq('id', quoteId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting quote:', error);
        return createCorsResponse({ error: 'Failed to delete quote' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Quote deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in quotes function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
