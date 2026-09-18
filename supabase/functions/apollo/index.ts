// Apollo Edge Function
// Handles Apollo.io lead enrichment and search integration
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

/**
 * Put one cached Apollo contact into the CRM (WF-S-05).
 *
 * The contact is READ FROM THE CACHE, never taken from the request. The page
 * sends only an id, and accepting a contactData body instead would let any
 * authenticated caller write arbitrary rows into business_records under the
 * Apollo source - which is what the unreachable branch below used to do.
 *
 * Three refusals, all 400 rather than 500, because each is something the caller
 * can act on: the contact is not in the cache, this tenant has already added
 * it, or a business record with that email exists. The last is per TENANT: the
 * Express original checked business_records.email with no tenant filter, so one
 * tenant having the contact blocked every other tenant from adding it.
 */
// deno-lint-ignore no-explicit-any
async function addContactToCrm(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  userId: string,
  apolloContactId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { data: contact, error: contactError } = await admin
    .from('centralized_apollo_contacts')
    .select('*')
    .eq('apollo_id', apolloContactId)
    .maybeSingle();

  if (contactError) {
    console.error('Error reading Apollo contact:', contactError);
    return { status: 500, body: { error: 'Failed to read contact' } };
  }
  if (!contact) return { status: 404, body: { error: 'Contact not found' } };

  const { data: existingLead } = await admin
    .from('tenant_apollo_leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('apollo_id', apolloContactId)
    .maybeSingle();

  if (existingLead?.added_to_crm) {
    return {
      status: 400,
      body: {
        error: 'Lead already added to CRM',
        businessRecordId: existingLead.business_record_id,
      },
    };
  }

  if (contact.email) {
    const { data: duplicate } = await admin
      .from('business_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('primary_contact_email', contact.email)
      .limit(1)
      .maybeSingle();

    if (duplicate) {
      return {
        status: 400,
        body: {
          error: 'Contact with this email already exists in CRM',
          existingRecordId: duplicate.id,
        },
      };
    }
  }

  // THE CONTACT'S DETAILS WERE BEING THROWN AWAY, and not only in production.
  // The Express handler this replaces wrote firstName, lastName, email,
  // jobTitle, linkedinUrl and leadSource through Drizzle, and business_records
  // has NONE of those six - it has primary_contact_name, primary_contact_email,
  // primary_contact_title and source. Drizzle iterates the TABLE's columns and
  // picks each one out of the object, so an unknown key is dropped with no
  // error: every lead added from Apollo landed with a company name, a website
  // and an industry, and no way to contact the person. That is the dev path,
  // the one that "worked".
  //
  // check:phantom-cols caught linkedin_url here because PostgREST would 42703
  // on it; the other five were only visible by reading the table. A column list
  // is worth more than a passing insert.
  //
  // linkedin_url has no home on this table and is NOT smuggled into a notes
  // field: quietly relocating a value is how the original defect reads to the
  // next person. It is named in the response instead.
  const contactName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
    contact.name ||
    null;

  const { data: record, error: insertError } = await admin
    .from('business_records')
    .insert({
      tenant_id: tenantId,
      record_type: 'lead',
      status: 'new',
      company_name: contact.organization_name || 'Unknown Company',
      website: contact.website_url,
      industry: contact.industry,
      employee_count: contact.employee_count,
      primary_contact_name: contactName,
      primary_contact_email: contact.email ?? null,
      primary_contact_phone: Array.isArray(contact.phone_numbers)
        ? (contact.phone_numbers[0] ?? null)
        : null,
      primary_contact_title: contact.title ?? null,
      source: 'Apollo.io',
      created_by: userId,
      owner_id: userId,
    })
    .select()
    .maybeSingle();

  if (insertError || !record) {
    console.error('Error creating business record from Apollo contact:', insertError);
    return {
      status: 500,
      body: { error: 'Failed to add lead to CRM', message: insertError?.message },
    };
  }

  // The tenant-side ledger, so a second add reports "already added" rather than
  // creating a second record. Its failure is logged and not fatal: the lead IS
  // in the CRM at this point, and refusing here would leave the caller thinking
  // otherwise.
  const ledger = {
    tenant_id: tenantId,
    apollo_contact_id: contact.id,
    apollo_id: apolloContactId,
    status: 'added_to_crm',
    added_to_crm: true,
    business_record_id: record.id,
    discovered_via: 'apollo_search',
    added_at: new Date().toISOString(),
    added_by: userId,
  };
  const { error: ledgerError } = existingLead
    ? await admin
        .from('tenant_apollo_leads')
        .update(ledger)
        .eq('id', existingLead.id)
        .eq('tenant_id', tenantId)
    : await admin.from('tenant_apollo_leads').insert(ledger);
  if (ledgerError) {
    console.error('Apollo lead ledger write failed (record was created):', ledgerError.message);
  }

  return {
    status: 201,
    body: {
      success: true,
      businessRecord: record,
      message: 'Lead successfully added to CRM',
      // Said plainly rather than dropped. business_records has no column for it.
      unbacked: contact.linkedin_url ? ['LinkedIn URL is not stored on a business record.'] : [],
    },
  };
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /apollo, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'apollo');
    const endpoint = parts[0];
    const resourceId = parts[1];

    // POST /apollo/search - Search for leads
    if (req.method === 'POST' && endpoint === 'search') {
      const body = await req.json();

      // Check for cached results
      const { data: cached } = await admin
        .from('apollo_search_cache')
        .select('*')
        .eq('search_hash', JSON.stringify(body))
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return createCorsResponse(
          {
            contacts: cached.results || [],
            pagination: cached.pagination,
            fromCache: true,
          },
          200,
          req,
        );
      }

      // Return placeholder - actual Apollo API integration would go here
      return createCorsResponse(
        {
          contacts: [],
          pagination: { page: 1, perPage: 25, totalEntries: 0, totalPages: 0 },
          fromCache: false,
          message: 'Apollo API integration required',
        },
        200,
        req,
      );
    }

    // POST /apollo/enrich - Enrich a contact
    if (req.method === 'POST' && endpoint === 'enrich') {
      const body = await req.json();
      const { email, linkedinUrl } = body;

      // Check cache first
      if (email) {
        const { data: cached } = await admin
          .from('apollo_contacts')
          .select('*')
          .eq('email', email)
          .single();

        if (cached) {
          return createCorsResponse({ contact: cached, fromCache: true }, 200, req);
        }
      }

      return createCorsResponse(
        {
          contact: null,
          fromCache: false,
          message: 'Apollo API enrichment required',
        },
        200,
        req,
      );
    }

    // POST /apollo/add-to-crm - Add Apollo contact to CRM
    // ====================================================================
    // ADD TO CRM (WF-S-05)
    //
    // THIS BRANCH COULD NEVER FIRE. It tested `endpoint === 'add-to-crm'`,
    // where endpoint is parts[0], while the page calls
    // POST /apollo/leads/:contactId/add-to-crm - so parts[0] is 'leads' and the
    // condition was false on every request. It also expected an { apolloId,
    // contactData } body, and the page sends NO body at all: the contact is
    // already in the centralised cache and the id is in the URL. Two
    // independent mismatches on one endpoint, which is why "the branch exists"
    // was never the same as "the endpoint works".
    //
    // The shape below is the one the page actually calls, and the contact is
    // read from `centralized_apollo_contacts` rather than trusted from a body -
    // a client-supplied contactData would let any caller write whatever they
    // liked into business_records under the Apollo source.
    // ====================================================================
    if (req.method === 'POST' && endpoint === 'leads' && resourceId && parts[2] === 'add-to-crm') {
      const result = await addContactToCrm(admin, tenantId, user.id, resourceId);
      return createCorsResponse(result.body, result.status, req);
    }

    // POST /apollo/leads/bulk-add - the same thing per id, reporting each
    //
    // Per row rather than one insert, because the duplicate and
    // already-added checks are per contact and a bulk insert would either skip
    // them or fail the whole batch on one collision. The response names what
    // happened to EACH id: a count of successes with no count of failures is
    // the AUDIT-038 shape, and here a silent skip looks exactly like a contact
    // that was already in the CRM.
    if (req.method === 'POST' && endpoint === 'leads' && resourceId === 'bulk-add') {
      const body = await req.json().catch(() => ({}));
      const contactIds: string[] = Array.isArray(body.contactIds) ? body.contactIds : [];
      if (contactIds.length === 0) {
        return createCorsResponse({ error: 'contactIds is required' }, 400, req);
      }

      const added: string[] = [];
      const skipped: { contactId: string; reason: string }[] = [];
      for (const contactId of contactIds) {
        const result = await addContactToCrm(admin, tenantId, user.id, contactId);
        if (result.status === 200 || result.status === 201) added.push(contactId);
        else
          skipped.push({
            contactId,
            reason: (result.body as { error?: string }).error ?? 'Unknown error',
          });
      }

      return createCorsResponse(
        { added: added.length, skipped: skipped.length, addedIds: added, skippedDetail: skipped },
        200,
        req,
      );
    }

    // GET /apollo/stats - the same rows /usage reads, counted over 30 days
    if (req.method === 'GET' && endpoint === 'stats') {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows, error } = await admin
        .from('apollo_api_usage')
        .select('success, credits_used')
        .eq('tenant_id', tenantId)
        .gte('created_at', since);

      if (error) {
        console.error('Error reading Apollo usage stats:', error);
        return createCorsResponse({ error: 'Failed to get stats' }, 500, req);
      }

      // PostgREST has no COUNT(*) FILTER, so the window is read and counted
      // here - the same arithmetic apolloStorage.getApiUsageStats did in SQL.
      const usage = rows ?? [];
      return createCorsResponse(
        {
          totalCalls: usage.length,
          successfulCalls: usage.filter((r: any) => r.success === true).length,
          failedCalls: usage.filter((r: any) => r.success === false).length,
          totalCreditsUsed: usage.reduce((sum: number, r: any) => sum + (r.credits_used || 0), 0),
          periodDays: 30,
        },
        200,
        req,
      );
    }

    // The legacy body-driven shape, kept for any caller that still sends one.
    if (req.method === 'POST' && endpoint === 'add-to-crm') {
      const body = await req.json();
      const { apolloId, contactData } = body;

      // Create business record from Apollo data
      const businessRecordData = {
        tenant_id: tenantId,
        company_name: contactData.organizationName || 'Unknown',
        primary_contact_name: contactData.name,
        primary_contact_email: contactData.email,
        primary_contact_phone: contactData.phoneNumbers?.[0],
        website: contactData.websiteUrl,
        industry: contactData.industry,
        employee_count: contactData.employeeCount,
        source: 'apollo',
        // AUDIT-037: `source_id` is not a column. business_records keeps
        // foreign ids in the external_* family, and a contact pulled from
        // Apollo enters as a lead, so external_lead_id is where its id belongs.
        external_lead_id: apolloId,
        status: 'lead',
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: record, error } = await admin
        .from('business_records')
        .insert(businessRecordData)
        .select()
        .single();

      if (error) {
        console.error('Error adding Apollo contact to CRM:', error);
        return createCorsResponse({ error: 'Failed to add to CRM' }, 500, req);
      }

      // Update Apollo tenant lead status
      await admin.from('apollo_tenant_leads').upsert({
        tenant_id: tenantId,
        apollo_id: apolloId,
        status: 'added_to_crm',
        added_to_crm: true,
        business_record_id: record.id,
        updated_at: new Date().toISOString(),
      });

      return createCorsResponse({ success: true, businessRecord: record }, 201, req);
    }

    // GET /apollo/usage - Get API usage stats
    if (req.method === 'GET' && endpoint === 'usage') {
      const { data: usage } = await admin
        .from('apollo_api_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      const totalCredits =
        usage?.reduce((sum: number, u: any) => sum + (u.credits_used || 0), 0) || 0;

      return createCorsResponse(
        {
          usage: usage || [],
          totalCreditsUsed: totalCredits,
        },
        200,
        req,
      );
    }

    // GET /apollo/saved-searches - Get saved searches
    if (req.method === 'GET' && endpoint === 'saved-searches') {
      const { data: searches } = await admin
        .from('apollo_saved_searches')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      return createCorsResponse(searches || [], 200, req);
    }

    // POST /apollo/saved-searches - Save a search
    if (req.method === 'POST' && endpoint === 'saved-searches') {
      const body = await req.json();

      const { data: search, error } = await admin
        .from('apollo_saved_searches')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          filters: body.filters,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to save search' }, 500, req);
      }

      return createCorsResponse(search, 201, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in apollo function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
