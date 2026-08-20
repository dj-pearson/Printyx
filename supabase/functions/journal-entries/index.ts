// Journal Entries Edge Function
//
// PROD-008 convergence. This is what production runs for /api/journal-entries;
// Express (server/routes-financial.ts) served dev. The two disagreed on almost
// everything, and every disagreement broke the live page:
//
//   - LIST: Express returned a bare array, this returned { entries, pagination }.
//     JournalEntries.tsx does `(response || []).map(...)`, so the page threw a
//     TypeError in production and rendered nothing.
//   - CREATE: this summed a `lineItems` array the frontend never sends, so the
//     totals came out 0/0, the debits-equal-credits check passed trivially, and
//     every entry was written with total_debit = 0 and total_credit = 0. The
//     amounts the user typed were discarded. journal_entry_lines does not exist
//     in any schema or migration - the line-item model was never real.
//   - UPDATE: the page sends PATCH; only PUT was implemented, so every edit 404'd.
//   - POST /:id/post and /:id/reverse wrote posted_at, posted_by and
//     original_entry_id, none of which are columns on the flat header-level
//     table in shared/journal-entries-schema.ts. Both were an unconditional
//     42703. They now write only real columns and name what they cannot store.
//
// Validation lives in _shared/journal-entry-contract.ts and is locked to the
// Express zod schema by server/tests/unit/journal-entry-contract-parity.test.ts.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  parseJournalEntry,
  parseJournalEntryPatch,
  toJournalEntryColumns,
} from '../_shared/journal-entry-contract.ts';

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
      return createCorsResponse({ message: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant context required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'journal-entries');
    const entryId = parts[0];
    const subResource = parts[1];

    // GET /journal-entries - list.
    //
    // Returns a BARE ARRAY, ordered created_at desc, matching Express and what
    // JournalEntries.tsx maps over. The status/date filters are additive and
    // optional; the page sends none of them.
    if (req.method === 'GET' && !entryId) {
      const status = url.searchParams.get('status');
      const dateFrom = url.searchParams.get('dateFrom');
      const dateTo = url.searchParams.get('dateTo');

      let query = admin
        .from('journal_entries')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (dateFrom) query = query.gte('entry_date', dateFrom);
      if (dateTo) query = query.lte('entry_date', dateTo);

      const { data: entries, error } = await query;

      if (error) {
        console.error('Error fetching journal entries:', error);
        return createCorsResponse({ message: 'Failed to fetch journal entries' }, 500, req);
      }

      return createCorsResponse(entries || [], 200, req);
    }

    // GET /journal-entries/:id
    if (req.method === 'GET' && entryId && !subResource) {
      const { data: entry, error } = await admin
        .from('journal_entries')
        .select('*')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !entry) {
        return createCorsResponse({ message: 'Journal entry not found' }, 404, req);
      }

      return createCorsResponse(entry, 200, req);
    }

    // POST /journal-entries - create a balanced entry.
    if (req.method === 'POST' && !entryId) {
      const body = await req.json().catch(() => null);
      const parsed = parseJournalEntry(body);
      if (!parsed.ok) {
        return createCorsResponse(
          { message: 'Invalid journal entry', errors: parsed.errors },
          400,
          req,
        );
      }

      const { data: entry, error } = await admin
        .from('journal_entries')
        .insert({
          tenant_id: tenantId,
          ...toJournalEntryColumns(parsed.value),
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating journal entry:', error);
        return createCorsResponse({ message: 'Failed to create journal entry' }, 500, req);
      }

      return createCorsResponse(entry, 201, req);
    }

    // PATCH|PUT /journal-entries/:id. PATCH is what the page sends; PUT is kept
    // so the older callers that used it keep working.
    if ((req.method === 'PATCH' || req.method === 'PUT') && entryId && !subResource) {
      const body = await req.json().catch(() => null);
      const parsed = parseJournalEntryPatch(body);
      if (!parsed.ok) {
        return createCorsResponse(
          { message: 'Invalid journal entry', errors: parsed.errors },
          400,
          req,
        );
      }

      const { data: existing } = await admin
        .from('journal_entries')
        .select('status')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (!existing) {
        return createCorsResponse({ message: 'Journal entry not found' }, 404, req);
      }
      if (existing.status === 'posted') {
        return createCorsResponse({ message: 'Cannot edit a posted journal entry' }, 400, req);
      }

      const { data: entry, error } = await admin
        .from('journal_entries')
        .update({ ...toJournalEntryColumns(parsed.value), updated_at: new Date().toISOString() })
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating journal entry:', error);
        return createCorsResponse({ message: 'Failed to update journal entry' }, 500, req);
      }

      return createCorsResponse(entry, 200, req);
    }

    // POST /journal-entries/:id/post
    if (req.method === 'POST' && entryId && subResource === 'post') {
      const { data: entry } = await admin
        .from('journal_entries')
        .select('status')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (!entry) {
        return createCorsResponse({ message: 'Journal entry not found' }, 404, req);
      }
      if (entry.status === 'posted') {
        return createCorsResponse({ message: 'Entry already posted' }, 400, req);
      }

      const { data: updated, error } = await admin
        .from('journal_entries')
        .update({ status: 'posted', updated_at: new Date().toISOString() })
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error posting journal entry:', error);
        return createCorsResponse({ message: 'Failed to post journal entry' }, 500, req);
      }

      return createCorsResponse(
        {
          ...updated,
          unpersisted: [
            'postedAt / postedBy: journal_entries has no posted_at or posted_by column, so the posting time and actor are not recorded',
          ],
        },
        200,
        req,
      );
    }

    // POST /journal-entries/:id/reverse - create the mirrored draft entry.
    if (req.method === 'POST' && entryId && subResource === 'reverse') {
      const body = await req.json().catch(() => ({}));

      const { data: original } = await admin
        .from('journal_entries')
        .select('*')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (!original) {
        return createCorsResponse({ message: 'Journal entry not found' }, 404, req);
      }

      const { data: reversal, error } = await admin
        .from('journal_entries')
        .insert({
          tenant_id: tenantId,
          entry_number: `${original.entry_number}-REV`,
          entry_date: body?.reversalDate || new Date().toISOString().slice(0, 10),
          description: `Reversal of ${original.entry_number}`,
          // There is no original_entry_id column, so `reference` carries the
          // link. It is the only column that can.
          reference: original.id,
          status: 'draft',
          total_debit: original.total_credit,
          total_credit: original.total_debit,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error reversing journal entry:', error);
        return createCorsResponse({ message: 'Failed to create reversal' }, 500, req);
      }

      return createCorsResponse(
        {
          ...reversal,
          unpersisted: [
            'originalEntryId: journal_entries has no original_entry_id column; the reversal points at its original through `reference` and the -REV entry number',
          ],
        },
        201,
        req,
      );
    }

    // DELETE /journal-entries/:id - drafts only.
    if (req.method === 'DELETE' && entryId) {
      const { data: entry } = await admin
        .from('journal_entries')
        .select('status')
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .single();

      if (!entry) {
        return createCorsResponse({ message: 'Journal entry not found' }, 404, req);
      }
      if (entry.status === 'posted') {
        return createCorsResponse({ message: 'Cannot delete a posted journal entry' }, 400, req);
      }

      const { error } = await admin
        .from('journal_entries')
        .delete()
        .eq('id', entryId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting journal entry:', error);
        return createCorsResponse({ message: 'Failed to delete journal entry' }, 500, req);
      }

      return createCorsResponse({ message: 'Journal entry deleted' }, 200, req);
    }

    return createCorsResponse({ message: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in journal-entries function:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
