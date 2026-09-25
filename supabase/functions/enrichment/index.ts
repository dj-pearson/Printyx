// Enrichment Edge Function
// Alias for data-enrichment endpoints
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { WRITE_BATCH, writeInBatches } from '../_shared/batch-fetch.ts';
import {
  enrichedContactPatch,
  toEnrichedContactRow,
  UNPERSISTED_ENRICHMENT_FIELDS,
} from '../_shared/enriched-contact.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { ilikeAnyFilter } from '../_shared/postgrest-or.ts';

const MAX_PAGE_SIZE = 200;

/** page/limit from the query string, clamped, as a PostgREST range. */
function pageWindow(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50),
  );
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /enrichment, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'enrichment');
    const resource = parts[0];
    const resourceId = parts[1];
    const subResource = parts[2];

    // GET /enrichment/contacts - List enriched contacts
    if (req.method === 'GET' && resource === 'contacts') {
      // Round 190. This answered a bare array of EVERY enriched contact and
      // read only `source`, while DataEnrichment.tsx sends query /
      // prospectingStatus / enrichmentSource / page / limit and reads
      // `.contacts` off the response - so the Contacts tab showed "No contacts
      // found" for every tenant, and its three filters did nothing.
      const { page, limit, from, to } = pageWindow(url);
      const q = url.searchParams.get('query');
      const status = url.searchParams.get('prospectingStatus');
      const source = url.searchParams.get('enrichmentSource') ?? url.searchParams.get('source');

      let query = admin
        .from('enriched_contacts')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (q) {
        query = query.or(
          ilikeAnyFilter(['first_name', 'last_name', 'full_name', 'email', 'company_name'], q),
        );
      }
      if (status) query = query.eq('prospecting_status', status);
      if (source) query = query.eq('enrichment_source', source);

      const { data: contacts, error, count } = await query;
      if (error) {
        return createCorsResponse({ error: 'Failed to fetch enriched contacts' }, 500, req);
      }
      return createCorsResponse(
        { contacts: contacts || [], total: count ?? 0, page, limit },
        200,
        req,
      );
    }

    // PUT /enrichment/contacts/:id - Update enriched contact
    if (req.method === 'PUT' && resource === 'contacts' && resourceId) {
      const body = await req.json();

      // Mapped, not spread. `{ ...body }` lets the caller name every column -
      // tenant_id included, which moves the row to another tenant - and the
      // tenant filter decides WHICH row is written, not what goes into it
      // (COP-M01). The editable set sits beside the importer's mapper so the
      // two cannot drift.
      const patch = enrichedContactPatch(body);
      if (Object.keys(patch).length === 0) {
        return createCorsResponse(
          { error: 'No updatable fields in the request body', code: 'EMPTY_PATCH' },
          400,
          req,
        );
      }

      const { data: contact, error } = await admin
        .from('enriched_contacts')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        return createCorsResponse({ error: 'Failed to update enriched contact' }, 500, req);
      }
      if (!contact) return createCorsResponse({ error: 'Enriched contact not found' }, 404, req);

      return createCorsResponse(contact, 200, req);
    }

    // GET /enrichment/companies - List enriched companies
    if (req.method === 'GET' && resource === 'companies' && !resourceId) {
      // Round 190: same shape defect as contacts - a bare array against a page
      // reading `.companies`, so the Companies tab was always empty.
      const { page, limit, from, to } = pageWindow(url);
      const q = url.searchParams.get('query');

      let query = admin
        .from('enriched_companies')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (q) {
        query = query.or(ilikeAnyFilter(['company_name', 'website', 'primary_domain'], q));
      }

      const { data: companies, error, count } = await query;
      if (error) {
        return createCorsResponse({ error: 'Failed to fetch enriched companies' }, 500, req);
      }
      return createCorsResponse(
        { companies: companies || [], total: count ?? 0, page, limit },
        200,
        req,
      );
    }

    // GET /enrichment/companies/:id
    if (req.method === 'GET' && resource === 'companies' && resourceId) {
      const { data: company, error } = await admin
        .from('enriched_companies')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Company not found' }, 404, req);
      }

      return createCorsResponse(company, 200, req);
    }

    // POST /enrichment/companies
    if (req.method === 'POST' && resource === 'companies') {
      const body = await req.json();

      const { data: company, error } = await admin
        .from('enriched_companies')
        .insert({
          tenant_id: tenantId,
          ...body,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create company' }, 500, req);
      }

      return createCorsResponse(company, 201, req);
    }

    // GET /enrichment/intent - Intent signals
    if (req.method === 'GET' && resource === 'intent') {
      const { data: signals, error } = await admin
        .from('intent_signals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('detected_at', { ascending: false })
        .limit(100);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch intent signals' }, 500, req);
      }

      return createCorsResponse(signals || [], 200, req);
    }

    // GET /enrichment/campaigns
    if (req.method === 'GET' && resource === 'campaigns') {
      const { data: campaigns, error } = await admin
        .from('enrichment_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch campaigns' }, 500, req);
      }

      return createCorsResponse(campaigns || [], 200, req);
    }

    // POST /enrichment/campaigns
    if (req.method === 'POST' && resource === 'campaigns') {
      const body = await req.json();

      const { data: campaign, error } = await admin
        .from('enrichment_campaigns')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          source: body.source,
          criteria: body.criteria || {},
          status: 'pending',
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create campaign' }, 500, req);
      }

      return createCorsResponse(campaign, 201, req);
    }

    // GET /enrichment/analytics
    if (req.method === 'GET' && resource === 'analytics') {
      /**
       * THE PAGE AND THIS ENDPOINT NEVER AGREED (PA-040's shape, live).
       *
       * DataEnrichment.tsx reads `contacts.bySource`, `contacts.byStatus`,
       * `contacts.byLevel` and `companies.byIndustry`, and calls `.map`,
       * `.reduce` and `.find` on each - so it wants ARRAYS of
       * `{ source|status|level|industry, count }` nested under two keys. This
       * sent `{ totalContacts, bySource: {src: n}, byStatus: {st: n} }`: flat,
       * as objects, and missing two of the four. Every read resolved to
       * undefined behind optional chaining, so the whole Analytics tab rendered
       * "No data available" and the three headline cards showed 0 - on a 200,
       * with no error anywhere.
       *
       * Both of the missing breakdowns are real columns
       * (`enriched_contacts.management_level`, `enriched_companies.primary_industry`),
       * so all four are derived rather than dropped.
       */
      const [contacts, companies] = await Promise.all([
        // PAGED. PostgREST caps an unbounded select at its default page size,
        // so a tenant past that got a tally of the first page presented as a
        // total - COP-I01's truncation, on an aggregate where nothing on screen
        // could show it had happened.
        fetchAllRows<Record<string, any>>(() =>
          admin
            .from('enriched_contacts')
            // The columns are enrichment_source and prospecting_status;
            // `source` and `status` do not exist, so this read used to 42703.
            .select('enrichment_source, prospecting_status, management_level')
            .eq('tenant_id', tenantId),
        ),
        fetchAllRows<Record<string, any>>(() =>
          admin.from('enriched_companies').select('primary_industry').eq('tenant_id', tenantId),
        ),
      ]);

      /** Tally one column into the `[{ <key>: value, count }]` the page maps. */
      const tally = (rows: Record<string, any>[], column: string, key: string) => {
        const counts = new Map<string, number>();
        for (const row of rows) {
          const value = (row?.[column] as string | null) ?? 'unknown';
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([value, count]) => ({ [key]: value, count }));
      };

      return createCorsResponse(
        {
          contacts: {
            total: contacts.length,
            bySource: tally(contacts, 'enrichment_source', 'source'),
            byStatus: tally(contacts, 'prospecting_status', 'status'),
            byLevel: tally(contacts, 'management_level', 'level'),
          },
          companies: {
            total: companies.length,
            byIndustry: tally(companies, 'primary_industry', 'industry'),
          },
          unbacked: [
            "management_level is a real column that the importers never fill - toEnrichedContactRow does not map it from either provider - so byLevel reads 'unknown' for every imported contact until something writes it (AUDIT-028).",
          ],
        },
        200,
        req,
      );
    }

    // POST /enrichment/import/zoominfo/contacts
    if (
      req.method === 'POST' &&
      resource === 'import' &&
      resourceId === 'zoominfo' &&
      subResource === 'contacts'
    ) {
      const body = await req.json();
      const contacts = body.contacts || [];
      const imported: any[] = [];
      const failures: string[] = [];

      // PERF-NPLUS1-002: one insert per 200 contacts, not one per contact. An
      // enrichment import is a whole list at once - the round trips were the
      // wall clock. The per-row fallback inside writeInBatches is what keeps
      // the old fault isolation: PostgREST fails the WHOLE statement on one bad
      // row, so batching without it would turn one malformed contact into a
      // lost import, and `failures` still names each one.
      const importedAt = new Date().toISOString();
      imported.push(
        ...(await writeInBatches<any>(
          contacts.map((contact: unknown) =>
            toEnrichedContactRow('zoominfo', contact, tenantId, importedAt),
          ),
          (batch) => admin.from('enriched_contacts').insert(batch).select(),
          WRITE_BATCH,
          (_row, error) => {
            console.error('Error importing enriched contact:', error);
            failures.push((error as { message?: string })?.message ?? String(error));
          },
        )),
      );

      // COP-M01: these inserts named six columns the table does not have, so
      // every one failed — and nothing checked the error, so the endpoint
      // reported "imported 0" and moved on. Failures are surfaced now.
      return createCorsResponse(
        {
          imported: imported.length,
          total: contacts.length,
          failed: failures.length,
          failures: failures.slice(0, 5),
          unpersisted: UNPERSISTED_ENRICHMENT_FIELDS,
        },
        failures.length > 0 && imported.length === 0 ? 500 : 200,
        req,
      );
    }

    // POST /enrichment/import/apollo/contacts
    if (
      req.method === 'POST' &&
      resource === 'import' &&
      resourceId === 'apollo' &&
      subResource === 'contacts'
    ) {
      const body = await req.json();
      const contacts = body.contacts || [];
      const imported: any[] = [];
      const failures: string[] = [];

      // PERF-NPLUS1-002: one insert per 200 contacts, not one per contact. An
      // enrichment import is a whole list at once - the round trips were the
      // wall clock. The per-row fallback inside writeInBatches is what keeps
      // the old fault isolation: PostgREST fails the WHOLE statement on one bad
      // row, so batching without it would turn one malformed contact into a
      // lost import, and `failures` still names each one.
      const importedAt = new Date().toISOString();
      imported.push(
        ...(await writeInBatches<any>(
          contacts.map((contact: unknown) =>
            toEnrichedContactRow('apollo', contact, tenantId, importedAt),
          ),
          (batch) => admin.from('enriched_contacts').insert(batch).select(),
          WRITE_BATCH,
          (_row, error) => {
            console.error('Error importing enriched contact:', error);
            failures.push((error as { message?: string })?.message ?? String(error));
          },
        )),
      );

      // COP-M01: these inserts named six columns the table does not have, so
      // every one failed — and nothing checked the error, so the endpoint
      // reported "imported 0" and moved on. Failures are surfaced now.
      return createCorsResponse(
        {
          imported: imported.length,
          total: contacts.length,
          failed: failures.length,
          failures: failures.slice(0, 5),
          unpersisted: UNPERSISTED_ENRICHMENT_FIELDS,
        },
        failures.length > 0 && imported.length === 0 ? 500 : 200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in enrichment function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
