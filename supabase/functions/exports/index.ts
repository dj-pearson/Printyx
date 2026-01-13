// Exports Edge Function
// Handles data exports in various formats (CSV, JSON, etc.)
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
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const exportType = pathParts[1]; // 'customers', 'leads', 'quotes', etc.
    const format = url.searchParams.get('format') || 'csv'; // csv, json, xlsx

    // Helper to convert data to CSV
    function toCSV(data: any[]): string {
      if (!data || data.length === 0) return '';

      const headers = Object.keys(data[0]);
      const rows = data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma or newline
            if (value === null || value === undefined) return '';
            const strValue = String(value);
            if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
              return `"${strValue.replace(/"/g, '""')}"`;
            }
            return strValue;
          })
          .join(','),
      );

      return [headers.join(','), ...rows].join('\n');
    }

    // POST /exports/customers - Export customers
    if (req.method === 'POST' && exportType === 'customers') {
      const body = await req.json();
      const filters = body.filters || {};

      let query = admin
        .from('business_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer');

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data: customers, error } = await query;

      if (error) {
        console.error('Error fetching customers for export:', error);
        return createCorsResponse({ error: 'Failed to export customers' }, 500, req);
      }

      if (format === 'csv') {
        const csv = toCSV(customers || []);
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.csv"`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return createCorsResponse(customers || [], 200, req);
    }

    // POST /exports/leads - Export leads
    if (req.method === 'POST' && exportType === 'leads') {
      const body = await req.json();
      const filters = body.filters || {};

      let query = admin
        .from('business_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('record_type', 'lead');

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data: leads, error } = await query;

      if (error) {
        console.error('Error fetching leads for export:', error);
        return createCorsResponse({ error: 'Failed to export leads' }, 500, req);
      }

      if (format === 'csv') {
        const csv = toCSV(leads || []);
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().split('T')[0]}.csv"`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return createCorsResponse(leads || [], 200, req);
    }

    // POST /exports/quotes - Export quotes
    if (req.method === 'POST' && exportType === 'quotes') {
      const body = await req.json();
      const filters = body.filters || {};

      let query = admin.from('quotes').select('*').eq('tenant_id', tenantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data: quotes, error } = await query;

      if (error) {
        console.error('Error fetching quotes for export:', error);
        return createCorsResponse({ error: 'Failed to export quotes' }, 500, req);
      }

      if (format === 'csv') {
        const csv = toCSV(quotes || []);
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="quotes-${new Date().toISOString().split('T')[0]}.csv"`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return createCorsResponse(quotes || [], 200, req);
    }

    // POST /exports/invoices - Export invoices
    if (req.method === 'POST' && exportType === 'invoices') {
      const body = await req.json();
      const filters = body.filters || {};

      let query = admin.from('invoices').select('*').eq('tenant_id', tenantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data: invoices, error } = await query;

      if (error) {
        console.error('Error fetching invoices for export:', error);
        return createCorsResponse({ error: 'Failed to export invoices' }, 500, req);
      }

      if (format === 'csv') {
        const csv = toCSV(invoices || []);
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="invoices-${new Date().toISOString().split('T')[0]}.csv"`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return createCorsResponse(invoices || [], 200, req);
    }

    // POST /exports/activities - Export activities
    if (req.method === 'POST' && exportType === 'activities') {
      const body = await req.json();
      const filters = body.filters || {};

      let query = admin.from('business_record_activities').select('*').eq('tenant_id', tenantId);

      if (filters.activityType) {
        query = query.eq('activity_type', filters.activityType);
      }

      const { data: activities, error } = await query;

      if (error) {
        console.error('Error fetching activities for export:', error);
        return createCorsResponse({ error: 'Failed to export activities' }, 500, req);
      }

      if (format === 'csv') {
        const csv = toCSV(activities || []);
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="activities-${new Date().toISOString().split('T')[0]}.csv"`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return createCorsResponse(activities || [], 200, req);
    }

    return createCorsResponse({ error: 'Invalid export type' }, 400, req);
  } catch (error) {
    console.error('Error in exports function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
