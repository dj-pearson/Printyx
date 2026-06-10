// DoD (Definition of Done) Validation Edge Function
// Validates workflow-transition readiness. Mirrors server/routes-validate.ts so
// the advisory DoDValidationBanner works in production (which hits edge functions
// directly, not Express).
//
// Routes (function name stripped by server.ts before this handler runs):
//   GET /quote-to-proposal/:quoteId
//   GET /proposal-to-contract/:proposalId
//   GET /po-to-warehouse/:poId
//   GET /service-completion/:ticketId
//
// Response shape: { valid: boolean, errors: { field, message, action?, actionLink? }[] }
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

interface ValidationError {
  field: string;
  message: string;
  action?: string;
  actionLink?: string;
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'GET') {
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

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
    const validationType = pathParts[0];
    const recordId = pathParts[1];

    if (!recordId) {
      return createCorsResponse({ error: 'Record ID is required' }, 400, req);
    }

    switch (validationType) {
      case 'quote-to-proposal':
        return await validateQuoteToProposal(admin, tenantId, recordId, req);
      case 'proposal-to-contract':
        return await validateProposalToContract(admin, tenantId, recordId, req);
      case 'po-to-warehouse':
        return await validatePoToWarehouse(admin, tenantId, recordId, req);
      case 'service-completion':
        return await validateServiceCompletion(admin, tenantId, recordId, req);
      default:
        return createCorsResponse({ error: 'Unknown validation type' }, 404, req);
    }
  } catch (error) {
    console.error('Unexpected error in validate function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Validation check failed' },
      500,
      req,
    );
  }
}

// Validate quote readiness for proposal creation
async function validateQuoteToProposal(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  quoteId: string,
  req: Request,
) {
  const errors: ValidationError[] = [];

  const { data: quote } = await admin
    .from('quotes')
    .select('id, title, business_record_id, status, total_amount, description, valid_until')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!quote) {
    errors.push({ field: 'quote', message: 'Quote not found', action: 'Create quote first' });
    return createCorsResponse({ valid: false, errors }, 200, req);
  }

  if (!quote.title?.trim()) {
    errors.push({
      field: 'title',
      message: 'Quote title is required',
      action: 'Add quote title',
      actionLink: `/quotes/${quoteId}/edit`,
    });
  }

  if (!quote.business_record_id) {
    errors.push({
      field: 'customer',
      message: 'Customer assignment is required',
      action: 'Assign customer',
      actionLink: `/quotes/${quoteId}/edit`,
    });
  }

  if (!quote.total_amount || Number(quote.total_amount) <= 0) {
    errors.push({
      field: 'amount',
      message: 'Quote amount must be greater than zero',
      action: 'Add pricing',
      actionLink: `/quotes/${quoteId}/pricing`,
    });
  }

  if (!quote.description?.trim()) {
    errors.push({
      field: 'description',
      message: 'Quote description is required',
      action: 'Add description',
      actionLink: `/quotes/${quoteId}/edit`,
    });
  }

  if (quote.status === 'draft') {
    errors.push({
      field: 'status',
      message: 'Quote must be finalized before creating proposal',
      action: 'Finalize quote',
      actionLink: `/quotes/${quoteId}/finalize`,
    });
  }

  // Confirm the assigned customer exists for this tenant
  if (quote.business_record_id) {
    const { data: customer } = await admin
      .from('business_records')
      .select('id')
      .eq('id', quote.business_record_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!customer) {
      errors.push({
        field: 'customer',
        message: 'Assigned customer not found',
        action: 'Verify customer',
        actionLink: `/customers`,
      });
    }
  }

  return createCorsResponse({ valid: errors.length === 0, errors }, 200, req);
}

// Validate proposal readiness for contract creation
async function validateProposalToContract(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  proposalId: string,
  req: Request,
) {
  const errors: ValidationError[] = [];

  const { data: proposal } = await admin
    .from('proposals')
    .select(
      'id, title, business_record_id, status, proposal_type, executive_summary, solution_overview, investment_summary, terms_and_conditions',
    )
    .eq('id', proposalId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!proposal) {
    errors.push({
      field: 'proposal',
      message: 'Proposal not found',
      action: 'Create proposal first',
    });
    return createCorsResponse({ valid: false, errors }, 200, req);
  }

  if (!proposal.executive_summary?.trim()) {
    errors.push({
      field: 'executive_summary',
      message: 'Executive summary is required for contract generation',
      action: 'Add executive summary',
      actionLink: `/proposals/${proposalId}/edit#executive-summary`,
    });
  }

  if (!proposal.solution_overview?.trim()) {
    errors.push({
      field: 'solution_overview',
      message: 'Solution overview is required for contract generation',
      action: 'Add solution overview',
      actionLink: `/proposals/${proposalId}/edit#solution-overview`,
    });
  }

  if (!proposal.investment_summary?.trim()) {
    errors.push({
      field: 'investment_summary',
      message: 'Investment summary is required for contract generation',
      action: 'Add investment summary',
      actionLink: `/proposals/${proposalId}/edit#investment-summary`,
    });
  }

  if (!proposal.terms_and_conditions?.trim()) {
    errors.push({
      field: 'terms_conditions',
      message: 'Terms and conditions are required for contract generation',
      action: 'Add terms and conditions',
      actionLink: `/proposals/${proposalId}/edit#terms-conditions`,
    });
  }

  if (proposal.status === 'draft') {
    errors.push({
      field: 'status',
      message: 'Proposal must be finalized before creating contract',
      action: 'Finalize proposal',
      actionLink: `/proposals/${proposalId}/finalize`,
    });
  }

  return createCorsResponse({ valid: errors.length === 0, errors }, 200, req);
}

// Validate purchase order readiness for warehouse release
async function validatePoToWarehouse(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  poId: string,
  req: Request,
) {
  const errors: ValidationError[] = [];

  const { data: po } = await admin
    .from('purchase_orders')
    .select('id, po_number, status, supplier_id, expected_date, approved_date, total_amount')
    .eq('id', poId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!po) {
    errors.push({ field: 'purchase_order', message: 'Purchase order not found' });
    return createCorsResponse({ valid: false, errors }, 200, req);
  }

  if (po.status !== 'approved') {
    errors.push({
      field: 'status',
      message: 'Purchase order must be approved before warehouse release',
      action: 'Approve PO',
      actionLink: `/admin/purchase-orders/${poId}/approve`,
    });
  }

  if (!po.approved_date) {
    errors.push({
      field: 'approval_date',
      message: 'Purchase order approval date is missing',
      action: 'Complete approval process',
    });
  }

  if (!po.expected_date) {
    errors.push({
      field: 'expected_date',
      message: 'Expected delivery date is required for warehouse planning',
      action: 'Set expected date',
      actionLink: `/admin/purchase-orders/${poId}/edit`,
    });
  }

  return createCorsResponse({ valid: errors.length === 0, errors }, 200, req);
}

// Validate service ticket readiness for completion
async function validateServiceCompletion(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  ticketId: string,
  req: Request,
) {
  const errors: ValidationError[] = [];

  const { data: ticket } = await admin
    .from('service_tickets')
    .select(
      'id, ticket_number, status, technician_id, resolution_notes, work_performed, parts_used, time_spent, customer_signature',
    )
    .eq('id', ticketId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!ticket) {
    errors.push({ field: 'service_ticket', message: 'Service ticket not found' });
    return createCorsResponse({ valid: false, errors }, 200, req);
  }

  if (!ticket.resolution_notes?.trim()) {
    errors.push({
      field: 'resolution_notes',
      message: 'Resolution notes are required for ticket completion',
      action: 'Add resolution notes',
      actionLink: `/service-hub/${ticketId}/complete`,
    });
  }

  if (!ticket.work_performed?.trim()) {
    errors.push({
      field: 'work_performed',
      message: 'Work performed description is required',
      action: 'Document work performed',
      actionLink: `/service-hub/${ticketId}/complete`,
    });
  }

  if (!ticket.time_spent || Number(ticket.time_spent) <= 0) {
    errors.push({
      field: 'time_spent',
      message: 'Time spent must be recorded',
      action: 'Record time spent',
      actionLink: `/service-hub/${ticketId}/time`,
    });
  }

  if (!ticket.customer_signature) {
    errors.push({
      field: 'customer_signature',
      message: 'Customer signature is required for completion',
      action: 'Obtain customer signature',
      actionLink: `/service-hub/${ticketId}/signature`,
    });
  }

  return createCorsResponse({ valid: errors.length === 0, errors }, 200, req);
}
