// Universal Search Edge Function (COP-I05 / PROD-010)
//
// Production counterpart to server/routes-universal-search.ts. Before this
// existed the ⌘K command palette called /api/universal-search, which only
// Express served — so global search returned a 404 in production.
//
// Response is the FLAT, relevance-sorted array the palette consumes:
//   SearchResult[]  (see client/src/components/layout/command-palette.tsx)
//
// Column names here were taken from the migration DDL, not from the Express
// route: that route had been written against a `deals` shape (name/value/
// stage/business_record_id) that does not exist, and the same repair is
// applied on both sides.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type ResultType =
  | 'customer'
  | 'lead'
  | 'deal'
  | 'activity'
  | 'quote'
  | 'invoice'
  | 'equipment'
  | 'contract';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  path?: string;
  metadata?: { value?: string; status?: string; date?: string };
  relevance: number;
}

// PostgREST's filter grammar is comma/paren delimited and unescapable inside
// an `or(...)` group, so these characters are stripped from the term rather
// than passed through. A search for "a,b" therefore matches "ab" — acceptable
// for a type-ahead, and far better than a malformed filter returning a 400.
function sanitize(term: string): string {
  return term.replace(/[,()."'\\*]/g, ' ').trim();
}

function money(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : `$${n.toLocaleString()}`;
}

function shortDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

function join(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' • ');
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  // The dispatcher strips the function-name segment, so this handler serves the
  // root path only; anything deeper is not a route this function has.
  const { parts } = normalizePath(url.pathname, 'universal-search');
  if (parts.length > 0) {
    return createCorsResponse({ error: 'Not found' }, 404, req);
  }

  if (req.method !== 'GET') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const user = userData.user;
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      null;

    if (!tenantId) {
      return createCorsResponse({ error: 'Tenant ID required' }, 400, req);
    }

    const rawQuery = url.searchParams.get('q') || '';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);
    const query = sanitize(rawQuery);

    // Matches the Express route: under two characters is noise, not an error.
    if (query.length < 2) {
      return createCorsResponse([], 200, req);
    }

    const normalizedQuery = query.toLowerCase();
    const like = `*${query}*`;
    const admin = createSupabaseServiceClient();

    const scoped = (table: string) =>
      admin.from(table).select('*').eq('tenant_id', tenantId).limit(limit);

    // Business records first: its ids feed the account-name match on every
    // entity that hangs off customer_id.
    const { data: recordRows, error: recordError } = await scoped('business_records').or(
      [
        `company_name.ilike.${like}`,
        `primary_contact_name.ilike.${like}`,
        `primary_contact_email.ilike.${like}`,
        `primary_contact_phone.ilike.${like}`,
      ].join(','),
    );

    if (recordError) {
      console.error('[UNIVERSAL-SEARCH] business_records failed:', recordError.message);
    }

    const records = (recordRows as Record<string, any>[]) || [];
    const matchedRecordIds = records.map((r) => String(r.id));
    // `customer_id.in.()` is not valid PostgREST, so the clause is only added
    // when there is at least one id to match.
    const accountClause = matchedRecordIds.length
      ? `,customer_id.in.(${matchedRecordIds.join(',')})`
      : '';

    // Optional tables degrade to no rows rather than failing the whole search,
    // same contract as the Express route.
    const safe = async <T>(label: string, run: () => Promise<T[]>): Promise<T[]> => {
      try {
        return await run();
      } catch (error) {
        console.warn(`[UNIVERSAL-SEARCH] ${label} unavailable:`, (error as Error).message);
        return [];
      }
    };

    const rowsOf = async (table: string, orClause: string): Promise<Record<string, any>[]> => {
      const { data, error } = await scoped(table).or(orClause);
      if (error) throw new Error(error.message);
      return (data as Record<string, any>[]) || [];
    };

    const businessRecordGroup: SearchResult[] = records.map((record) => {
      const isLead = record.record_type === 'lead';
      const title = record.company_name || record.primary_contact_name || 'Unnamed';
      let relevance = 10;
      if (
        String(record.company_name || '')
          .toLowerCase()
          .includes(normalizedQuery)
      )
        relevance += 5;
      if (
        String(record.primary_contact_name || '')
          .toLowerCase()
          .includes(normalizedQuery)
      )
        relevance += 3;
      return {
        id: `${isLead ? 'lead' : 'customer'}-${record.id}`,
        type: isLead ? 'lead' : 'customer',
        title,
        subtitle: join([
          record.primary_contact_name,
          record.primary_contact_email,
          record.primary_contact_phone,
        ]),
        path: record.url_slug
          ? `/${isLead ? 'leads' : 'customers'}/${record.url_slug}`
          : `/${isLead ? 'leads' : 'customers'}?id=${record.id}`,
        metadata: {
          status: record.status || undefined,
          value: money(record.estimated_deal_value),
        },
        relevance,
      };
    });

    const [dealGroup, activityGroup, quoteGroup, invoiceGroup, equipmentGroup, contractGroup] =
      await Promise.all([
        safe<SearchResult>('deals', async () => {
          const rows = await rowsOf(
            'deals',
            `title.ilike.${like},company_name.ilike.${like}${accountClause}`,
          );
          return rows.map((deal) => {
            let relevance = 8;
            if (
              String(deal.title || '')
                .toLowerCase()
                .includes(normalizedQuery)
            )
              relevance += 5;
            return {
              id: `deal-${deal.id}`,
              type: 'deal' as const,
              title: deal.title || 'Unnamed Deal',
              subtitle: join([
                deal.company_name,
                shortDateLabel('Close', deal.expected_close_date),
              ]),
              path: `/deals?id=${deal.id}`,
              metadata: { value: money(deal.amount), status: deal.status || undefined },
              relevance,
            };
          });
        }),

        safe<SearchResult>('activities', async () => {
          const rows = await rowsOf(
            'business_record_activities',
            `subject.ilike.${like},description.ilike.${like}`,
          );
          return rows.map((activity) => ({
            id: `activity-${activity.id}`,
            type: 'activity' as const,
            title: activity.subject || activity.activity_type || 'Activity',
            subtitle: join([shortDateLabel('Due', activity.due_date)]),
            path: `/activities?id=${activity.id}`,
            metadata: { status: activity.outcome || undefined },
            relevance: 6,
          }));
        }),

        safe<SearchResult>('quotes', async () => {
          const rows = await rowsOf(
            'quotes',
            `quote_number.ilike.${like},title.ilike.${like}${accountClause}`,
          );
          return rows.map((quote) => ({
            id: `quote-${quote.id}`,
            type: 'quote' as const,
            title: `Quote ${quote.quote_number || quote.id}`,
            subtitle: join([quote.title, shortDateLabel('Valid until', quote.valid_until)]),
            path: `/quotes?id=${quote.id}`,
            metadata: { value: money(quote.total_amount), status: quote.status || undefined },
            relevance: 7,
          }));
        }),

        safe<SearchResult>('invoices', async () => {
          const rows = await rowsOf(
            'invoices',
            `invoice_number.ilike.${like},po_number.ilike.${like}${accountClause}`,
          );
          return rows.map((invoice) => ({
            id: `invoice-${invoice.id}`,
            type: 'invoice' as const,
            title: `Invoice ${invoice.invoice_number || invoice.id}`,
            subtitle: join([shortDateLabel('Date', invoice.invoice_date)]),
            path: `/invoices?id=${invoice.id}`,
            metadata: {
              value: money(invoice.total_amount),
              status: invoice.invoice_type || undefined,
            },
            relevance: 7,
          }));
        }),

        safe<SearchResult>('equipment', async () => {
          const rows = await rowsOf(
            'equipment',
            [
              `serial_number.ilike.${like}`,
              `asset_tag.ilike.${like}`,
              `model_number.ilike.${like}`,
              `manufacturer.ilike.${like}`,
              `description.ilike.${like}`,
            ].join(',') + accountClause,
          );
          return rows.map((equip) => ({
            id: `equipment-${equip.id}`,
            type: 'equipment' as const,
            title:
              [equip.manufacturer, equip.model_number].filter(Boolean).join(' ') ||
              equip.serial_number ||
              'Unknown Equipment',
            subtitle: join([equip.serial_number ? `S/N: ${equip.serial_number}` : null]),
            // A serial hit resolves to the owning account, which is what the rep
            // wants — the equipment list filtered to one machine is a dead end.
            path: equip.customer_id
              ? `/customers/${equip.customer_id}`
              : `/equipment?id=${equip.id}`,
            metadata: { status: equip.equipment_status || undefined },
            relevance:
              String(equip.serial_number || '').toLowerCase() === normalizedQuery ||
              String(equip.asset_tag || '').toLowerCase() === normalizedQuery
                ? 12
                : 6,
          }));
        }),

        safe<SearchResult>('contracts', async () => {
          const rows = await rowsOf('contracts', `contract_number.ilike.${like}${accountClause}`);
          return rows.map((contract) => ({
            id: `contract-${contract.id}`,
            type: 'contract' as const,
            title: contract.contract_number ? `Contract ${contract.contract_number}` : 'Contract',
            subtitle: join([shortDateLabel('Ends', contract.end_date)]),
            path: contract.customer_id
              ? `/customers/${contract.customer_id}`
              : `/contracts?id=${contract.id}`,
            metadata: {
              status: contract.status || undefined,
              value: contract.monthly_base ? String(contract.monthly_base) : undefined,
              date: contract.end_date ? new Date(contract.end_date).toISOString() : undefined,
            },
            relevance:
              String(contract.contract_number || '').toLowerCase() === normalizedQuery ? 12 : 6,
          }));
        }),
      ]);

    // Concatenated in entity order so equal-relevance ties break the same way
    // the Express route breaks them, then sorted and capped.
    const results = [
      ...businessRecordGroup,
      ...dealGroup,
      ...activityGroup,
      ...quoteGroup,
      ...invoiceGroup,
      ...equipmentGroup,
      ...contractGroup,
    ]
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    return createCorsResponse(results, 200, req);
  } catch (error) {
    console.error('[UNIVERSAL-SEARCH] error:', error);
    return createCorsResponse({ error: 'Search failed' }, 500, req);
  }
}

function shortDateLabel(label: string, value: unknown): string | null {
  const d = shortDate(value);
  return d ? `${label}: ${d}` : null;
}
