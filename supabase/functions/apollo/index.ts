// Apollo Edge Function
// Handles Apollo.io lead enrichment and search integration
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { CredentialVaultError, encryptSecret, readSecret } from '../_shared/credential-envelope.ts';
import {
  ApolloApiError,
  describeApolloFailure,
  enrichPerson,
  maskApiKey,
  searchHash,
  searchPeople,
  transformApolloContact,
  verifyApiKey,
  type ApolloSearchFilters,
} from '../_shared/apollo-client.ts';

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

/**
 * The tenant's Apollo API key, or null when none is configured (WF-S-05).
 *
 * `api_key` comes back DECRYPTED, so every caller below reads plaintext and
 * nothing else in this file needs to know about the vault (SEC-CRED-VAULT-001).
 * A row written before that story carries no envelope prefix and readSecret
 * hands it back unchanged, which is what stops a working integration breaking
 * on the deploy; the next save re-encrypts it. The same envelope is read on the
 * Node side by server/apollo-client.ts, which is why one format was the whole
 * point - see server/services/credential-envelope.ts.
 */
// deno-lint-ignore no-explicit-any
async function readApolloCredential(admin: any, tenantId: string) {
  const { data, error } = await admin
    .from('integration_credentials')
    .select('id, api_key, status, config, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('provider', 'apollo')
    .maybeSingle();
  if (error) throw new Error(`Failed to read Apollo credential: ${error.message}`);
  if (!data) return null;
  return { ...data, api_key: await readSecret(data.api_key) };
}

/**
 * One row in `apollo_api_usage`. Never throws: a failed usage write must not
 * turn a successful search into an error, and a failed search already has its
 * own answer.
 */
// deno-lint-ignore no-explicit-any
async function trackUsage(admin: any, row: Record<string, unknown>) {
  const { error } = await admin.from('apollo_api_usage').insert({
    ...row,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('Apollo usage tracking failed:', error.message);
}

/**
 * Merge each cached contact with what THIS tenant has done with it.
 *
 * One read for the whole page rather than one per contact: the Express
 * original issued a getTenantLeadByApolloId per row, so a 25-result page was 26
 * round trips.
 */
// deno-lint-ignore no-explicit-any
async function withTenantStatus(admin: any, tenantId: string, contacts: any[]) {
  if (contacts.length === 0) return [];
  const ids = contacts.map((c) => c.apollo_id).filter(Boolean);
  const { data: leads } = await admin
    .from('tenant_apollo_leads')
    .select('id, apollo_id, status, added_to_crm')
    .eq('tenant_id', tenantId)
    .in('apollo_id', ids);

  const byApolloId = new Map<string, any>();
  for (const lead of leads ?? []) byApolloId.set(lead.apollo_id, lead);

  return contacts.map((contact) => {
    const lead = byApolloId.get(contact.apollo_id);
    return {
      ...contact,
      tenantStatus: lead?.status ?? 'new',
      addedToCrm: lead?.added_to_crm ?? false,
      tenantLeadId: lead?.id ?? null,
    };
  });
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

    /**
     * SEC-EDGE-001. Storing, verifying and deleting a third-party API CREDENTIAL. Anyone
     * who can write one can point the tenant's enrichment at an account they
     * control, and anyone who can delete one can break enrichment for everybody.
     *
     * The gate is on the WRITE branches, not the function: searching and reading enrichment results is a rep's
     * own work.
     * A LEVEL check rather than a permission code (SEC-EDGE-002).
     */
    const requireManager = () => {
      requireRoleLevel(
        {
          userId: user.id,
          tenantId,
          email: user.email,
          jwt: jwt ?? '',
          supabaseUser: user,
        } as AuthContext,
        ROLE_LEVEL.MANAGER,
      );
    };
    const denyManager = (err: unknown) => {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            error: 'Managing Apollo credentials requires a manager role',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    };

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

    // ====================================================================
    // CREDENTIALS (WF-S-05 AC3)
    //
    // Four endpoints ApolloCredentialManager has always called and that
    // existed on Express alone, so the panel 404'd in production - nobody
    // could configure an Apollo key on the host that serves it.
    // ====================================================================

    // GET /apollo/credentials - configured?, masked, never the key itself
    if (req.method === 'GET' && endpoint === 'credentials') {
      const credential = await readApolloCredential(admin, tenantId);
      if (!credential) return createCorsResponse({ configured: false }, 200, req);

      return createCorsResponse(
        {
          configured: true,
          id: credential.id,
          status: credential.status,
          createdAt: credential.created_at,
          updatedAt: credential.updated_at,
          apiKeyMasked: maskApiKey(credential.api_key),
          config: credential.config,
        },
        200,
        req,
      );
    }

    // POST /apollo/credentials/verify - test a key before or after saving
    if (req.method === 'POST' && endpoint === 'credentials' && resourceId === 'verify') {
      try {
        requireManager();
      } catch (err) {
        return denyManager(err);
      }
      const body = await req.json().catch(() => ({}));
      let testKey: string | null =
        typeof body?.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : null;

      if (!testKey) {
        const credential = await readApolloCredential(admin, tenantId);
        testKey = credential?.api_key ? String(credential.api_key) : null;
        if (!testKey) {
          return createCorsResponse(
            { valid: false, error: 'No API key configured. Save an API key first.' },
            400,
            req,
          );
        }
      }

      const startedAt = Date.now();
      try {
        await verifyApiKey(testKey);
        const responseTimeMs = Date.now() - startedAt;
        await trackUsage(admin, {
          tenant_id: tenantId,
          endpoint: '/v1/mixed_people/search',
          method: 'POST',
          request_params: { verify: true },
          status_code: 200,
          success: true,
          credits_used: 1,
          response_time_ms: responseTimeMs,
          user_id: user.id,
        });
        return createCorsResponse(
          { valid: true, message: 'API key is valid and working', responseTimeMs },
          200,
          req,
        );
      } catch (err) {
        await trackUsage(admin, {
          tenant_id: tenantId,
          endpoint: '/v1/mixed_people/search',
          method: 'POST',
          request_params: { verify: true },
          status_code: err instanceof ApolloApiError ? err.status : 500,
          success: false,
          error_message: (err as Error)?.message ?? String(err),
          credits_used: 0,
          response_time_ms: Date.now() - startedAt,
          user_id: user.id,
        });
        // 200 with valid:false, matching what the panel reads: a rejected key
        // is an answer to the question asked, not a failure of the request.
        return createCorsResponse(describeApolloFailure(err), 200, req);
      }
    }

    // POST /apollo/credentials - save or replace this tenant's key
    if (req.method === 'POST' && endpoint === 'credentials' && !resourceId) {
      try {
        requireManager();
      } catch (err) {
        return denyManager(err);
      }
      const body = await req.json().catch(() => ({}));
      const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
      if (!apiKey) {
        return createCorsResponse({ error: 'API key is required' }, 400, req);
      }

      const existing = await readApolloCredential(admin, tenantId);
      const now = new Date().toISOString();

      // Fail the save rather than store the key in the clear. With no master
      // key in the edge environment this endpoint is the one that stops
      // working, which is the point: a 503 naming the variable is recoverable,
      // a plaintext key that nobody is told about is not.
      let storedKey: string;
      try {
        storedKey = await encryptSecret(apiKey);
      } catch (err) {
        console.error('Apollo credential encryption failed:', err);
        return createCorsResponse(
          {
            error:
              err instanceof CredentialVaultError
                ? 'Credential vault is not configured on this deployment (PRINTYX_CREDENTIAL_VAULT_KEY). The API key was not saved.'
                : 'Failed to save credentials',
          },
          503,
          req,
        );
      }

      if (existing) {
        const { data: updated, error } = await admin
          .from('integration_credentials')
          .update({
            api_key: storedKey,
            status: 'active',
            updated_by: user.id,
            updated_at: now,
            config: { ...(existing.config ?? {}), lastUpdated: now, updatedBy: user.id },
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId)
          .select('id')
          .maybeSingle();
        if (error) {
          console.error('Apollo credential update failed:', error);
          return createCorsResponse({ error: 'Failed to save credentials' }, 500, req);
        }
        return createCorsResponse(
          { success: true, message: 'Apollo.io API key updated', credentialId: updated?.id },
          200,
          req,
        );
      }

      const { data: created, error } = await admin
        .from('integration_credentials')
        .insert({
          tenant_id: tenantId,
          provider: 'apollo',
          integration_name: 'Apollo.io Lead Enrichment',
          api_key: storedKey,
          status: 'active',
          created_by: user.id,
          updated_by: user.id,
          config: { createdAt: now, createdBy: user.id },
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .maybeSingle();
      if (error) {
        console.error('Apollo credential insert failed:', error);
        return createCorsResponse({ error: 'Failed to save credentials' }, 500, req);
      }
      return createCorsResponse(
        { success: true, message: 'Apollo.io API key saved', credentialId: created?.id },
        201,
        req,
      );
    }

    // DELETE /apollo/credentials/:id
    if (req.method === 'DELETE' && endpoint === 'credentials' && resourceId) {
      try {
        requireManager();
      } catch (err) {
        return denyManager(err);
      }
      const { error } = await admin
        .from('integration_credentials')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .eq('provider', 'apollo');
      if (error) {
        console.error('Apollo credential delete failed:', error);
        return createCorsResponse({ error: 'Failed to delete credentials' }, 500, req);
      }
      return createCorsResponse(
        { success: true, message: 'Apollo.io credentials removed' },
        200,
        req,
      );
    }

    // ====================================================================
    // SEARCH (WF-S-05 AC3)
    //
    // This branch used to answer `{ contacts: [], message: 'Apollo API
    // integration required' }` at status 200 - a successful-looking empty
    // result, which reads as "no matches" rather than "not implemented". It
    // also looked the cache up by `search_hash = JSON.stringify(body)`, while
    // apollo_search_cache.search_hash holds a DIGEST, so the cache could never
    // hit even once the rest worked.
    //
    // apollo_search_cache has no tenant_id by design: the contact cache is
    // platform-wide, which is the whole point of centralized_apollo_contacts.
    // What is per tenant is the lead ledger, merged in afterwards.
    // ====================================================================
    if (req.method === 'POST' && endpoint === 'search') {
      const filters = ((await req.json().catch(() => ({}))) ?? {}) as ApolloSearchFilters;
      const perPage = filters.perPage || 25;
      const page = filters.page || 1;
      const hash = await searchHash(filters);

      const { data: cached } = await admin
        .from('apollo_search_cache')
        .select('*')
        .eq('search_hash', hash)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached?.apollo_ids?.length) {
        const { data: contacts } = await admin
          .from('centralized_apollo_contacts')
          .select('*')
          .in('apollo_id', cached.apollo_ids as string[]);

        await admin
          .from('apollo_search_cache')
          .update({
            hit_count: (cached.hit_count ?? 1) + 1,
            last_accessed_at: new Date().toISOString(),
          })
          .eq('id', cached.id);

        const total = cached.total_available ?? 0;
        return createCorsResponse(
          {
            contacts: await withTenantStatus(admin, tenantId, contacts ?? []),
            pagination: {
              page,
              perPage,
              totalEntries: total,
              totalPages: Math.ceil(total / perPage),
            },
            fromCache: true,
          },
          200,
          req,
        );
      }

      const credential = await readApolloCredential(admin, tenantId);
      if (!credential?.api_key) {
        // 400, not an empty list: the rep needs to know a key is missing, and
        // an empty 200 is exactly how this endpoint used to lie.
        return createCorsResponse(
          {
            error: 'No Apollo.io API key configured for this tenant.',
            code: 'APOLLO_NOT_CONFIGURED',
          },
          400,
          req,
        );
      }

      const startedAt = Date.now();
      let apollo;
      try {
        apollo = await searchPeople(String(credential.api_key), filters);
      } catch (err) {
        await trackUsage(admin, {
          tenant_id: tenantId,
          endpoint: '/v1/mixed_people/search',
          method: 'POST',
          request_params: filters,
          status_code: err instanceof ApolloApiError ? err.status : 500,
          success: false,
          error_message: (err as Error)?.message ?? String(err),
          credits_used: 0,
          response_time_ms: Date.now() - startedAt,
          user_id: user.id,
        });
        const status = err instanceof ApolloApiError ? err.status : 502;
        return createCorsResponse(
          { error: 'Failed to search leads', message: (err as Error)?.message ?? String(err) },
          status === 401 || status === 403 ? 400 : 502,
          req,
        );
      }

      await trackUsage(admin, {
        tenant_id: tenantId,
        endpoint: '/v1/mixed_people/search',
        method: 'POST',
        request_params: filters,
        status_code: 200,
        success: true,
        credits_used: 1,
        response_time_ms: Date.now() - startedAt,
        user_id: user.id,
      });

      const rows = apollo.people.map(transformApolloContact);
      if (rows.length > 0) {
        const { error: upsertError } = await admin.from('centralized_apollo_contacts').upsert(
          rows.map((r) => ({ ...r, last_enriched_at: new Date().toISOString() })),
          { onConflict: 'apollo_id' },
        );
        if (upsertError) {
          console.error('Apollo contact cache write failed:', upsertError.message);
        }
      }

      const { error: cacheError } = await admin.from('apollo_search_cache').upsert(
        {
          search_hash: hash,
          search_filters: filters,
          result_count: rows.length,
          total_available: apollo.pagination.total_entries,
          apollo_ids: rows.map((r) => r.apollo_id),
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          api_credits_used: 1,
          last_accessed_at: new Date().toISOString(),
        },
        { onConflict: 'search_hash' },
      );
      if (cacheError) console.error('Apollo search cache write failed:', cacheError.message);

      return createCorsResponse(
        {
          contacts: await withTenantStatus(admin, tenantId, rows),
          pagination: {
            page: apollo.pagination.page,
            perPage: apollo.pagination.per_page,
            totalEntries: apollo.pagination.total_entries,
            totalPages: apollo.pagination.total_pages,
          },
          fromCache: false,
        },
        200,
        req,
      );
    }

    // ====================================================================
    // ENRICH (WF-S-05 AC3)
    //
    // Was a placeholder too, and read `apollo_contacts` - a table that is in no
    // schema and no migration. The cache is `centralized_apollo_contacts`.
    // ====================================================================
    if (req.method === 'POST' && endpoint === 'enrich') {
      const body = await req.json().catch(() => ({}));
      const email = typeof body?.email === 'string' ? body.email.trim() : '';
      const linkedinUrl = typeof body?.linkedinUrl === 'string' ? body.linkedinUrl.trim() : '';

      if (!email && !linkedinUrl) {
        return createCorsResponse({ error: 'email or linkedinUrl is required' }, 400, req);
      }

      if (email) {
        const { data: cachedContact } = await admin
          .from('centralized_apollo_contacts')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        if (cachedContact) {
          return createCorsResponse({ contact: cachedContact, fromCache: true }, 200, req);
        }
      }

      const credential = await readApolloCredential(admin, tenantId);
      if (!credential?.api_key) {
        return createCorsResponse(
          {
            error: 'No Apollo.io API key configured for this tenant.',
            code: 'APOLLO_NOT_CONFIGURED',
          },
          400,
          req,
        );
      }

      const startedAt = Date.now();
      let person;
      try {
        person = await enrichPerson(String(credential.api_key), {
          email: email || undefined,
          linkedin_url: linkedinUrl || undefined,
          first_name: body?.firstName || undefined,
          last_name: body?.lastName || undefined,
          organization_name: body?.organizationName || undefined,
        });
      } catch (err) {
        await trackUsage(admin, {
          tenant_id: tenantId,
          endpoint: '/v1/people/match',
          method: 'POST',
          request_params: { email, linkedinUrl },
          status_code: err instanceof ApolloApiError ? err.status : 500,
          success: false,
          error_message: (err as Error)?.message ?? String(err),
          credits_used: 0,
          response_time_ms: Date.now() - startedAt,
          user_id: user.id,
        });
        return createCorsResponse(
          { error: 'Failed to enrich contact', message: (err as Error)?.message ?? String(err) },
          502,
          req,
        );
      }

      await trackUsage(admin, {
        tenant_id: tenantId,
        endpoint: '/v1/people/match',
        method: 'POST',
        request_params: { email, linkedinUrl },
        status_code: 200,
        success: true,
        credits_used: person ? 1 : 0,
        response_time_ms: Date.now() - startedAt,
        user_id: user.id,
      });

      if (!person) {
        return createCorsResponse({ contact: null, fromCache: false }, 200, req);
      }

      const row = transformApolloContact(person);
      const { data: stored, error: storeError } = await admin
        .from('centralized_apollo_contacts')
        .upsert({ ...row, last_enriched_at: new Date().toISOString() }, { onConflict: 'apollo_id' })
        .select()
        .maybeSingle();
      if (storeError) console.error('Apollo enrich cache write failed:', storeError.message);

      return createCorsResponse({ contact: stored ?? row, fromCache: false }, 200, req);
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

    // THE LEGACY BODY-DRIVEN /add-to-crm BRANCH IS GONE (WF-S-05).
    //
    // It wrote to `apollo_tenant_leads`, which is not a table - the ledger is
    // `tenant_apollo_leads`, declared in shared/apollo-schema.ts - so its
    // upsert was a 42P01 on every call it ever received. No client tree sends
    // that shape either: the page posts /leads/:contactId/add-to-crm with no
    // body, which the branch above serves. Kept as a note rather than deleted
    // silently, because "accepts a contactData body" is the thing not to
    // reintroduce: it would let any authenticated caller write arbitrary rows
    // into business_records under the Apollo source.

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

    // SAVED SEARCHES ARE GONE TOO (WF-S-05). Both branches queried
    // `apollo_saved_searches`, which is in no Drizzle schema and no migration,
    // and no client tree calls either one - so the GET was a 42P01 dressed as
    // an empty list (`searches || []` swallowed the error) and the POST was a
    // 500. A feature with no table and no caller is deleted rather than
    // wired, per the AUDIT-016 rule.

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
