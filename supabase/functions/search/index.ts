// Search Edge Function
// Handles global search across multiple resources
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
    const query = url.searchParams.get('q') || url.searchParams.get('query');
    const types = url.searchParams.get('types')?.split(',') || [];
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!query || query.length < 2) {
      return createCorsResponse({ error: 'Search query must be at least 2 characters' }, 400, req);
    }

    const searchPattern = `%${query}%`;
    const results: Record<string, any[]> = {};

    // Search customers/leads if requested or no types specified
    if (types.length === 0 || types.includes('customers') || types.includes('leads')) {
      const { data: records } = await admin
        .from('business_records')
        .select('id, company_name, primary_contact_name, record_type, status')
        .eq('tenant_id', tenantId)
        .or(`company_name.ilike.${searchPattern},primary_contact_email.ilike.${searchPattern}`)
        .limit(limit);

      results.businessRecords = records || [];
    }

    // Search contacts
    if (types.length === 0 || types.includes('contacts')) {
      const [leadContacts, customerContacts] = await Promise.all([
        admin
          .from('lead_contacts')
          .select('id, first_name, last_name, email, phone, lead_id')
          .eq('tenant_id', tenantId)
          .or(
            `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`,
          )
          .limit(limit),
        admin
          .from('customer_contacts')
          .select('id, first_name, last_name, email, phone, customer_id')
          .eq('tenant_id', tenantId)
          .or(
            `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`,
          )
          .limit(limit),
      ]);

      results.contacts = [...(leadContacts.data || []), ...(customerContacts.data || [])];
    }

    // Search quotes
    if (types.length === 0 || types.includes('quotes')) {
      const { data: quotes } = await admin
        .from('quotes')
        .select('id, quote_number, title, status, total_amount')
        .eq('tenant_id', tenantId)
        .or(`quote_number.ilike.${searchPattern},title.ilike.${searchPattern}`)
        .limit(limit);

      results.quotes = quotes || [];
    }

    // Search service tickets
    if (types.length === 0 || types.includes('tickets')) {
      const { data: tickets } = await admin
        .from('service_tickets')
        .select('id, ticket_number, title, status')
        .eq('tenant_id', tenantId)
        .or(
          `ticket_number.ilike.${searchPattern},title.ilike.${searchPattern},description.ilike.${searchPattern}`,
        )
        .limit(limit);

      results.tickets = tickets || [];
    }

    // Search equipment
    if (types.length === 0 || types.includes('equipment')) {
      const { data: equipment } = await admin
        .from('equipment')
        .select('id, serial_number, model_number, manufacturer')
        .eq('tenant_id', tenantId)
        .or(
          `serial_number.ilike.${searchPattern},model_number.ilike.${searchPattern},asset_tag.ilike.${searchPattern}`,
        )
        .limit(limit);

      results.equipment = equipment || [];
    }

    // Search projects
    if (types.length === 0 || types.includes('projects')) {
      const { data: projects } = await admin
        .from('projects')
        .select('id, name, description, status')
        .eq('tenant_id', tenantId)
        .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .limit(limit);

      results.projects = projects || [];
    }

    // Search users
    if (types.length === 0 || types.includes('users')) {
      const { data: users } = await admin
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', tenantId)
        .or(
          `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`,
        )
        .limit(limit);

      results.users = users || [];
    }

    // Calculate total results
    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    return createCorsResponse(
      {
        query,
        totalResults,
        results,
      },
      200,
      req,
    );
  } catch (error) {
    console.error('Error in search function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
