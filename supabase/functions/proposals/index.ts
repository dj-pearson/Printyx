// Proposals Edge Function
// Handles comprehensive proposal management with templates, sections, and analytics
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const proposalId = pathParts[1];
    const subResource = pathParts[2]; // 'line-items', 'sections', 'comments', 'analytics'

    // GET /proposals - List proposals
    if (req.method === 'GET' && !proposalId) {
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('proposals')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,proposal_number.ilike.%${search}%`);
      }

      const { data: proposals, error, count } = await query;

      if (error) {
        console.error('Error fetching proposals:', error);
        return createCorsResponse({ error: 'Failed to fetch proposals' }, 500, req);
      }

      return createCorsResponse(
        {
          data: proposals || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /proposals/:id - Get single proposal
    if (req.method === 'GET' && proposalId && !subResource) {
      const { data: proposal, error } = await admin
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching proposal:', error);
        return createCorsResponse({ error: 'Proposal not found' }, 404, req);
      }

      return createCorsResponse(proposal, 200, req);
    }

    // GET /proposals/:id/line-items - Get proposal line items
    if (req.method === 'GET' && proposalId && subResource === 'line-items') {
      const { data: lineItems, error } = await admin
        .from('proposal_line_items')
        .select('*')
        .eq('proposal_id', proposalId)
        .eq('tenant_id', tenantId)
        .order('line_number', { ascending: true });

      if (error) {
        console.error('Error fetching proposal line items:', error);
        return createCorsResponse({ error: 'Failed to fetch line items' }, 500, req);
      }

      return createCorsResponse(lineItems || [], 200, req);
    }

    // GET /proposals/:id/sections - Get proposal sections
    if (req.method === 'GET' && proposalId && subResource === 'sections') {
      const { data: sections, error } = await admin
        .from('proposal_sections')
        .select('*')
        .eq('proposal_id', proposalId)
        .eq('tenant_id', tenantId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error fetching proposal sections:', error);
        return createCorsResponse({ error: 'Failed to fetch sections' }, 500, req);
      }

      return createCorsResponse(sections || [], 200, req);
    }

    // GET /proposals/:id/comments - Get proposal comments
    if (req.method === 'GET' && proposalId && subResource === 'comments') {
      const { data: comments, error } = await admin
        .from('proposal_comments')
        .select('*')
        .eq('proposal_id', proposalId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching proposal comments:', error);
        return createCorsResponse({ error: 'Failed to fetch comments' }, 500, req);
      }

      return createCorsResponse(comments || [], 200, req);
    }

    // GET /proposals/:id/analytics - Get proposal analytics
    if (req.method === 'GET' && proposalId && subResource === 'analytics') {
      const { data: analytics, error } = await admin
        .from('proposal_analytics')
        .select('*')
        .eq('proposal_id', proposalId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching proposal analytics:', error);
        return createCorsResponse({ error: 'Failed to fetch analytics' }, 500, req);
      }

      return createCorsResponse(analytics || [], 200, req);
    }

    // POST /proposals - Create proposal
    if (req.method === 'POST' && !proposalId) {
      const body = await req.json();

      // Generate proposal number if not provided
      const proposalNumber =
        body.proposalNumber ||
        body.proposal_number ||
        `PROP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const proposalData = {
        tenant_id: tenantId,
        proposal_number: proposalNumber,
        title: body.title,
        status: body.status || 'draft',
        opportunity_id: body.opportunityId || body.opportunity_id || null,
        account_id: body.accountId || body.account_id || null,
        contact_id: body.contactId || body.contact_id || null,
        template_id: body.templateId || body.template_id || null,
        subtotal: body.subtotal || 0,
        tax_amount: body.taxAmount || body.tax_amount || 0,
        total_amount: body.totalAmount || body.total_amount || 0,
        valid_until: body.validUntil || body.valid_until || null,
        terms: body.terms || null,
        notes: body.notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: proposal, error } = await admin
        .from('proposals')
        .insert(proposalData)
        .select()
        .single();

      if (error) {
        console.error('Error creating proposal:', error);
        return createCorsResponse({ error: 'Failed to create proposal', details: error }, 500, req);
      }

      return createCorsResponse(proposal, 201, req);
    }

    // POST /proposals/:id/line-items - Add line item
    if (req.method === 'POST' && proposalId && subResource === 'line-items') {
      const body = await req.json();

      const lineItemData = {
        tenant_id: tenantId,
        proposal_id: proposalId,
        line_number: body.lineNumber || body.line_number || 1,
        product_id: body.productId || body.product_id || null,
        description: body.description,
        quantity: body.quantity || 1,
        unit_price: body.unitPrice || body.unit_price || 0,
        discount: body.discount || 0,
        tax_rate: body.taxRate || body.tax_rate || 0,
        subtotal: body.subtotal || 0,
        tax_amount: body.taxAmount || body.tax_amount || 0,
        total: body.total || 0,
      };

      const { data: lineItem, error } = await admin
        .from('proposal_line_items')
        .insert(lineItemData)
        .select()
        .single();

      if (error) {
        console.error('Error creating line item:', error);
        return createCorsResponse({ error: 'Failed to create line item' }, 500, req);
      }

      return createCorsResponse(lineItem, 201, req);
    }

    // POST /proposals/:id/comments - Add comment
    if (req.method === 'POST' && proposalId && subResource === 'comments') {
      const body = await req.json();

      const commentData = {
        tenant_id: tenantId,
        proposal_id: proposalId,
        user_id: user.id,
        comment: body.comment,
        is_internal:
          body.isInternal !== undefined
            ? body.isInternal
            : body.is_internal !== undefined
              ? body.is_internal
              : false,
        created_at: new Date().toISOString(),
      };

      const { data: comment, error } = await admin
        .from('proposal_comments')
        .insert(commentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating comment:', error);
        return createCorsResponse({ error: 'Failed to create comment' }, 500, req);
      }

      return createCorsResponse(comment, 201, req);
    }

    // PATCH /proposals/:id - Update proposal
    if ((req.method === 'PATCH' || req.method === 'PUT') && proposalId && !subResource) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        title: 'title',
        status: 'status',
        subtotal: 'subtotal',
        taxAmount: 'tax_amount',
        totalAmount: 'total_amount',
        validUntil: 'valid_until',
        terms: 'terms',
        notes: 'notes',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: proposal, error } = await admin
        .from('proposals')
        .update(updateData)
        .eq('id', proposalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating proposal:', error);
        return createCorsResponse({ error: 'Failed to update proposal' }, 500, req);
      }

      return createCorsResponse(proposal, 200, req);
    }

    // DELETE /proposals/:id - Delete proposal
    if (req.method === 'DELETE' && proposalId && !subResource) {
      const { error } = await admin
        .from('proposals')
        .delete()
        .eq('id', proposalId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting proposal:', error);
        return createCorsResponse({ error: 'Failed to delete proposal' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Proposal deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Invalid proposal endpoint' }, 400, req);
  } catch (error) {
    console.error('Error in proposals function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
