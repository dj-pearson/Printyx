// Documents Edge Function (PROD-013)
//
// Production counterpart to server/routes-documents.ts (mounted at
// /api/documents). That domain had no edge function, so DocumentBuilder.tsx
// could not list, create or export purchase agreements in production.
//
// Routes (the dispatcher strips the function-name segment first):
//   GET  /          list the tenant's documents, oldest first
//   POST /          create one
//   GET  /:id       fetch one
//   POST /:id/pdf   render the agreement
//
// Table is documents (migration 0000). DocumentBuilder reads camelCase
// (doc.agreementNumber, doc.includeServiceContract, doc.monthlyBase), so rows
// convert on the way out and bodies map to real columns on the way in.
//
// The /pdf route returns HTML, not a PDF — that is what the Express handler has
// always done ("in production you would use a library like puppeteer"). The
// behaviour is reproduced rather than quietly changed, and the filename now says
// .html so the download is not mislabelled.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { generateDocumentHtml } from '../_shared/document-html.ts';

type Row = Record<string, any>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function camelRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

// Writable columns per the migration 0000 DDL. id, tenant_id, created_by,
// updated_by and the timestamps are set by the handler.
const DOCUMENT_COLUMNS = new Set([
  'customer_id',
  'document_number',
  'document_type',
  'agreement_number',
  'buyer_name',
  'buyer_address',
  'ship_to_name',
  'ship_to_address',
  'po_number',
  'order_date',
  'line_items',
  'include_service_contract',
  'service_term',
  'service_start_date',
  'auto_renewal',
  'minimum_black_prints',
  'minimum_color_prints',
  'black_rate',
  'color_rate',
  'monthly_base',
  'include_consumables',
  'include_black_supplies',
  'include_color_supplies',
  'payment_terms',
  'warranty_terms',
  'special_terms',
  'authorized_signer_title',
  'customer_name',
  'status',
]);

function toColumns(body: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body || {})) {
    const column = DOCUMENT_COLUMNS.has(k) ? k : toSnake(k);
    if (DOCUMENT_COLUMNS.has(column)) out[column] = v;
  }
  return out;
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

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'documents');

    const documentId = parts[0];
    const action = parts[1];

    if (!documentId) {
      if (req.method === 'GET') {
        const { data, error } = await admin
          .from('documents')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true });
        if (error) throw new Error(error.message);
        return createCorsResponse(((data as Row[]) || []).map(camelRow), 200, req);
      }

      if (req.method === 'POST') {
        const body = (await req.json()) as Row;
        const values = toColumns(body);

        // customer_id, document_number and document_type are NOT NULL. The last
        // two are derived exactly as the Express handler derives them, so a body
        // that works in dev works here.
        if (!values.customer_id) {
          return createCorsResponse({ message: 'customerId is required' }, 400, req);
        }
        values.document_number =
          values.document_number || body.agreementNumber || `DOC-${Date.now()}`;
        values.document_type =
          values.document_type ||
          (values.include_service_contract ? 'purchase_service' : 'purchase_only');

        const { data, error } = await admin
          .from('documents')
          .insert({
            ...values,
            tenant_id: tenantId,
            created_by: user.id,
            updated_by: user.id,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return createCorsResponse(camelRow(data as Row), 201, req);
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    const loadDocument = async (): Promise<Row | null> => {
      const { data } = await admin
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return (data as Row) || null;
    };

    if (!action && req.method === 'GET') {
      const document = await loadDocument();
      if (!document) {
        return createCorsResponse({ message: 'Document not found' }, 404, req);
      }
      return createCorsResponse(camelRow(document), 200, req);
    }

    if (action === 'pdf' && req.method === 'POST') {
      const document = await loadDocument();
      if (!document) {
        return createCorsResponse({ message: 'Document not found' }, 404, req);
      }

      const html = generateDocumentHtml(camelRow(document));
      return new Response(html, {
        status: 200,
        headers: {
          ...getCorsHeaders(req.headers.get('origin')),
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="document-${document.id}.html"`,
        },
      });
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[DOCUMENTS] error:', error);
    return createCorsResponse({ message: (error as Error).message || 'Request failed' }, 500, req);
  }
}
