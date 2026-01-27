// Journal Entries Edge Function
// Handles accounting journal entries management
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
    const entryId = pathParts[1];
    const subResource = pathParts[2];

    // GET /journal-entries - List journal entries
    if (req.method === 'GET' && !entryId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;
      const status = url.searchParams.get('status');
      const dateFrom = url.searchParams.get('dateFrom');
      const dateTo = url.searchParams.get('dateTo');

      let query = admin
        .from('journal_entries')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('entry_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (dateFrom) query = query.gte('entry_date', dateFrom);
      if (dateTo) query = query.lte('entry_date', dateTo);

      const { data: entries, error, count } = await query;

      if (error) {
        console.error('Error fetching journal entries:', error);
        return createCorsResponse({ error: 'Failed to fetch entries' }, 500, req);
      }

      return createCorsResponse(
        {
          entries: entries || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
        200,
        req,
      );
    }

    // GET /journal-entries/:id - Get single entry with line items
    if (req.method === 'GET' && entryId && !subResource) {
      const { data: entry, error } = await admin
        .from('journal_entries')
        .select('*')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Journal entry not found' }, 404, req);
      }

      // Get line items
      const { data: lineItems } = await admin
        .from('journal_entry_lines')
        .select(
          `
          *,
          account:account_id (
            id,
            account_number,
            account_name,
            account_type
          )
        `,
        )
        .eq('journal_entry_id', entryId)
        .order('line_number', { ascending: true });

      return createCorsResponse({ ...entry, lineItems: lineItems || [] }, 200, req);
    }

    // POST /journal-entries - Create journal entry
    if (req.method === 'POST' && !entryId) {
      const body = await req.json();
      const { lineItems, ...entryData } = body;

      // Validate debits equal credits
      const totalDebits = (lineItems || []).reduce(
        (sum: number, line: any) => sum + (line.debit || 0),
        0,
      );
      const totalCredits = (lineItems || []).reduce(
        (sum: number, line: any) => sum + (line.credit || 0),
        0,
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return createCorsResponse({ error: 'Debits must equal credits' }, 400, req);
      }

      // Create journal entry
      const { data: entry, error: entryError } = await admin
        .from('journal_entries')
        .insert({
          tenant_id: tenantId,
          entry_number: entryData.entryNumber || entryData.entry_number || `JE-${Date.now()}`,
          entry_date: entryData.entryDate || entryData.entry_date || new Date().toISOString(),
          description: entryData.description,
          reference: entryData.reference,
          status: entryData.status || 'draft',
          total_debit: totalDebits,
          total_credit: totalCredits,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entryError) {
        console.error('Error creating journal entry:', entryError);
        return createCorsResponse({ error: 'Failed to create entry' }, 500, req);
      }

      // Create line items
      if (lineItems && lineItems.length > 0) {
        const lines = lineItems.map((line: any, index: number) => ({
          tenant_id: tenantId,
          journal_entry_id: entry.id,
          line_number: index + 1,
          account_id: line.accountId || line.account_id,
          description: line.description,
          debit: line.debit || 0,
          credit: line.credit || 0,
          created_at: new Date().toISOString(),
        }));

        await admin.from('journal_entry_lines').insert(lines);
      }

      return createCorsResponse(entry, 201, req);
    }

    // PUT /journal-entries/:id - Update journal entry
    if (req.method === 'PUT' && entryId && !subResource) {
      const body = await req.json();
      const { lineItems, ...entryData } = body;

      // Check if entry is editable
      const { data: existingEntry } = await admin
        .from('journal_entries')
        .select('status')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (existingEntry?.status === 'posted') {
        return createCorsResponse({ error: 'Cannot edit posted journal entry' }, 400, req);
      }

      const { data: entry, error } = await admin
        .from('journal_entries')
        .update({ ...entryData, updated_at: new Date().toISOString() })
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update entry' }, 500, req);
      }

      return createCorsResponse(entry, 200, req);
    }

    // POST /journal-entries/:id/post - Post journal entry
    if (req.method === 'POST' && entryId && subResource === 'post') {
      const { data: entry } = await admin
        .from('journal_entries')
        .select('*')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (!entry) {
        return createCorsResponse({ error: 'Journal entry not found' }, 404, req);
      }

      if (entry.status === 'posted') {
        return createCorsResponse({ error: 'Entry already posted' }, 400, req);
      }

      // Update entry status
      const { data: updatedEntry, error } = await admin
        .from('journal_entries')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          posted_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to post entry' }, 500, req);
      }

      // Update account balances would happen here in production

      return createCorsResponse(updatedEntry, 200, req);
    }

    // POST /journal-entries/:id/reverse - Reverse journal entry
    if (req.method === 'POST' && entryId && subResource === 'reverse') {
      const body = await req.json();

      const { data: originalEntry } = await admin
        .from('journal_entries')
        .select('*')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (!originalEntry) {
        return createCorsResponse({ error: 'Journal entry not found' }, 404, req);
      }

      // Create reversing entry
      const { data: reversingEntry, error } = await admin
        .from('journal_entries')
        .insert({
          tenant_id: tenantId,
          entry_number: `${originalEntry.entry_number}-REV`,
          entry_date: body.reversalDate || new Date().toISOString(),
          description: `Reversal of ${originalEntry.entry_number}`,
          reference: originalEntry.id,
          status: 'draft',
          total_debit: originalEntry.total_credit,
          total_credit: originalEntry.total_debit,
          original_entry_id: originalEntry.id,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create reversal' }, 500, req);
      }

      return createCorsResponse(reversingEntry, 201, req);
    }

    // DELETE /journal-entries/:id - Delete draft entry
    if (req.method === 'DELETE' && entryId) {
      const { data: entry } = await admin
        .from('journal_entries')
        .select('status')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (entry?.status === 'posted') {
        return createCorsResponse({ error: 'Cannot delete posted journal entry' }, 400, req);
      }

      // Delete line items first
      await admin.from('journal_entry_lines').delete().eq('journal_entry_id', entryId);

      const { error } = await admin
        .from('journal_entries')
        .delete()
        .eq('id', entryId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete entry' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Entry deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in journal-entries function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
