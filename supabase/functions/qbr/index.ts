/**
 * QBR edge function (PROD-010) — port of server/routes-qbr.ts.
 *
 * WHY: /api/qbr had an Express handler and NO edge function, so pages/CustomerQbrs.tsx
 * worked in dev (Express serves it) and hard-404'd in production, where
 * client/src/lib/config.ts getApiUrl() rewrites /api/qbr -> functions.printyx.net/qbr
 * with no Express fallback anywhere in the path.
 *
 * ROUTES (the four the page actually calls, plus the two suppression endpoints
 * the Express handler exposes so the surface does not shrink):
 *   GET   /                 list, ?customerId=&quarter=&status=  -> { data, total }
 *   POST  /generate         { quarter?, customerId? }            -> { quarter, generated, ... }
 *   GET   /suppressions
 *   POST  /suppressions
 *   GET   /:id
 *   PATCH /:id              { status?, sectionOverrides? }
 *   POST  /:id/send
 *
 * SHAPE: the page types QbrReport with camelCase keys (customerId, companyName,
 * pdfUrl, htmlUrl, generatedAt, sentAt) and reads `list.data` / `list.total`.
 * PostgREST returns snake_case, so every row is converted at the boundary with
 * toCamelShallow — deliberately SHALLOW, because `content` is a jsonb column whose
 * inner keys are already camelCase and must not be walked. A deep toCamel would
 * rewrite keys inside the deck payload, including sectionOverrides, which the
 * review dialog round-trips.
 *
 * KNOWN DIVERGENCE — PDF: Express renders the deck PDF with Playwright/Chromium,
 * which cannot run in a Deno edge function, so generate here produces the HTML
 * artifact and leaves pdf_url NULL. This is a deliberate, disclosed degradation
 * rather than a silent one:
 *   - it is not a new code path — the Express generator already treats the PDF as
 *     best-effort and saves with a null pdf_url whenever Chromium is unavailable;
 *   - the page already handles it, rendering "Not available" for a null pdfUrl;
 *   - and it strictly improves on today's production behavior, which is a 404 for
 *     the entire page.
 * The response carries pdfAvailable:false so the gap is visible to any caller
 * rather than being inferable only from a null column. Restoring PDFs means
 * rendering them outside the edge runtime (a Node worker or a render service).
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamelShallow } from '../_shared/case.ts';
import { assembleContent, renderHtml, currentQuarter } from './content.ts';

const QUARTER_RE = /^\d{4}-Q[1-4]$/;
const PATCH_STATUSES = new Set(['draft', 'reviewed']);

/** Row -> the camelCase shape CustomerQbrs.tsx types. */
const toReport = (row: Record<string, unknown>, companyName: string | null = null) => ({
  ...toCamelShallow(row),
  companyName,
});

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
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // The dispatcher strips segment 0 before the handler runs, so this must be
    // idempotent — see _shared/path.ts and the CLAUDE.md edge-path section.
    const { parts } = normalizePath(url.pathname, 'qbr');
    const first = parts[0];
    const second = parts[1];
    const method = req.method.toUpperCase();

    // --- POST /generate --------------------------------------------------
    // Literal segments are matched BEFORE the /:id routes; otherwise 'generate'
    // and 'suppressions' would be read as report ids.
    if (method === 'POST' && first === 'generate') {
      return await handleGenerate(req, admin, tenantId, user.id);
    }

    // --- /suppressions ---------------------------------------------------
    if (first === 'suppressions') {
      if (method === 'GET') {
        const { data, error } = await admin
          .from('qbr_suppressions')
          .select('id, customer_id, reason, created_at')
          .eq('tenant_id', tenantId);
        if (error) throw error;

        const names = await companyNames(
          admin,
          tenantId,
          (data ?? []).map((r: Record<string, unknown>) => String(r.customer_id)),
        );
        const rows = (data ?? []).map((r: Record<string, unknown>) => ({
          ...toCamelShallow(r),
          companyName: names.get(String(r.customer_id)) ?? null,
        }));
        return createCorsResponse({ data: rows, total: rows.length }, 200, req);
      }

      if (method === 'POST') {
        const body = await safeJson(req);
        const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
        if (!customerId) {
          return createCorsResponse(
            { message: 'Invalid input', errors: { customerId: 'required' } },
            400,
            req,
          );
        }
        const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

        const { data, error } = await admin
          .from('qbr_suppressions')
          .insert({
            tenant_id: tenantId,
            customer_id: customerId,
            reason,
            created_by_user_id: user.id,
          })
          .select()
          .maybeSingle();
        // The table has a unique (tenant, customer) index; a conflict means the
        // customer is already suppressed, which Express reports as success.
        if (error && !isUniqueViolation(error)) throw error;
        return createCorsResponse(
          data ? toCamelShallow(data) : { customerId, alreadySuppressed: true },
          201,
          req,
        );
      }
    }

    // --- GET / (list) ----------------------------------------------------
    if (method === 'GET' && !first) {
      let query = admin.from('qbr_reports').select('*').eq('tenant_id', tenantId);

      const customerId = url.searchParams.get('customerId');
      const quarter = url.searchParams.get('quarter');
      const status = url.searchParams.get('status');
      if (customerId) query = query.eq('customer_id', customerId);
      if (quarter) query = query.eq('quarter', quarter);
      if (status) query = query.eq('status', status);

      const { data, error } = await query.order('generated_at', { ascending: false }).limit(500);
      if (error) throw error;

      const names = await companyNames(
        admin,
        tenantId,
        (data ?? []).map((r: Record<string, unknown>) => String(r.customer_id)),
      );
      const rows = (data ?? []).map((r: Record<string, unknown>) =>
        toReport(r, names.get(String(r.customer_id)) ?? null),
      );
      return createCorsResponse({ data: rows, total: rows.length }, 200, req);
    }

    // --- POST /:id/send --------------------------------------------------
    if (method === 'POST' && first && second === 'send') {
      const { data, error } = await admin
        .from('qbr_reports')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_by_user_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', first)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return createCorsResponse({ message: 'QBR report not found' }, 404, req);
      return createCorsResponse(toReport(data), 200, req);
    }

    // --- GET /:id --------------------------------------------------------
    if (method === 'GET' && first) {
      const { data, error } = await admin
        .from('qbr_reports')
        .select('*')
        .eq('id', first)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return createCorsResponse({ message: 'QBR report not found' }, 404, req);

      const names = await companyNames(admin, tenantId, [String(data.customer_id)]);
      return createCorsResponse(
        toReport(data, names.get(String(data.customer_id)) ?? null),
        200,
        req,
      );
    }

    // --- PATCH /:id ------------------------------------------------------
    if (method === 'PATCH' && first) {
      const body = await safeJson(req);

      const status = body.status as string | undefined;
      if (status !== undefined && !PATCH_STATUSES.has(status)) {
        return createCorsResponse(
          { message: 'Invalid input', errors: { status: 'must be draft or reviewed' } },
          400,
          req,
        );
      }
      const overrides = body.sectionOverrides;
      if (overrides !== undefined && !isStringRecord(overrides)) {
        return createCorsResponse(
          { message: 'Invalid input', errors: { sectionOverrides: 'must be a string map' } },
          400,
          req,
        );
      }

      const { data: existing, error: readErr } = await admin
        .from('qbr_reports')
        .select('content')
        .eq('id', first)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!existing) return createCorsResponse({ message: 'QBR report not found' }, 404, req);

      // Merge, never replace: the rep edits one section at a time and the others
      // must survive, matching the Express handler.
      const currentContent = (existing.content as Record<string, unknown> | null) ?? {};
      const mergedContent = overrides
        ? {
            ...currentContent,
            sectionOverrides: {
              ...((currentContent.sectionOverrides as Record<string, string> | undefined) ?? {}),
              ...overrides,
            },
          }
        : currentContent;

      const { data, error } = await admin
        .from('qbr_reports')
        .update({
          ...(status ? { status } : {}),
          content: mergedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', first)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return createCorsResponse(toReport(data ?? {}), 200, req);
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('qbr function error:', message);
    return createCorsResponse({ message: 'QBR request failed', error: message }, 500, req);
  }
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

async function handleGenerate(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  userId: string,
): Promise<Response> {
  const body = await safeJson(req);

  const quarter = typeof body.quarter === 'string' ? body.quarter : currentQuarter();
  if (!QUARTER_RE.test(quarter)) {
    return createCorsResponse(
      { message: 'Invalid input', errors: { quarter: 'quarter must be like 2026-Q2' } },
      400,
      req,
    );
  }
  const requestedCustomerId =
    typeof body.customerId === 'string' && body.customerId ? body.customerId : null;

  // Suppressed customers never get a deck.
  const { data: suppressions } = await admin
    .from('qbr_suppressions')
    .select('customer_id')
    .eq('tenant_id', tenantId);
  const suppressed = new Set(
    (suppressions ?? []).map((s: Record<string, unknown>) => String(s.customer_id)),
  );

  // Target set: the requested customer, or every active customer holding an
  // active contract (same rule as Express).
  let targetIds: string[];
  if (requestedCustomerId) {
    targetIds = [requestedCustomerId];
  } else {
    const { data: activeContracts } = await admin
      .from('contracts')
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');
    const withContract = new Set(
      (activeContracts ?? []).map((c: Record<string, unknown>) => String(c.customer_id)),
    );
    if (withContract.size === 0) {
      targetIds = [];
    } else {
      const { data: customers } = await admin
        .from('business_records')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer')
        .eq('status', 'active')
        .in('id', Array.from(withContract));
      targetIds = (customers ?? []).map((c: Record<string, unknown>) => String(c.id));
    }
  }

  let generated = 0;
  let skippedSuppressed = 0;
  let skippedNoContract = 0;

  for (const customerId of targetIds) {
    if (suppressed.has(customerId)) {
      skippedSuppressed++;
      continue;
    }
    // An explicitly requested customer still has to hold an active contract.
    if (requestedCustomerId) {
      const { data: hasContract } = await admin
        .from('contracts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .limit(1);
      if (!hasContract || hasContract.length === 0) {
        skippedNoContract++;
        continue;
      }
    }

    const content = await assembleContent(admin, tenantId, customerId, quarter);
    const html = renderHtml(content);
    const htmlUrl = await uploadArtifact(
      admin,
      new TextEncoder().encode(html),
      `qbr/${tenantId}/${customerId}-${quarter}.html`,
      'text/html',
    );

    // onConflictDoUpdate over the (tenant, customer, quarter) unique index:
    // regenerating a quarter must overwrite that deck, not add a duplicate.
    const { error } = await admin.from('qbr_reports').upsert(
      {
        tenant_id: tenantId,
        customer_id: customerId,
        quarter,
        status: 'draft',
        content,
        pdf_url: null,
        html_url: htmlUrl,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,customer_id,quarter' },
    );
    if (error) throw error;
    generated++;
  }

  void userId;
  return createCorsResponse(
    {
      quarter,
      generated,
      skippedSuppressed,
      skippedNoContract,
      // Surfaced so the missing PDF is explicit rather than only inferable from a
      // null pdfUrl — see the PDF note in this file's header.
      pdfAvailable: false,
    },
    200,
    req,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** customerId -> companyName. business_records is the canonical company table. */
async function companyNames(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  customerIds: string[],
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(customerIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await admin
    .from('business_records')
    .select('id, company_name')
    .eq('tenant_id', tenantId)
    .in('id', unique);
  return new Map(
    (data ?? []).map((r: Record<string, unknown>) => [
      String(r.id),
      (r.company_name as string) ?? null,
    ]),
  );
}

/**
 * Best-effort artifact upload to Supabase Storage. ANY failure returns null so the
 * report still saves with a null URL, exactly as the Express implementation does —
 * a storage outage must not lose a generated deck.
 */
async function uploadArtifact(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  bytes: Uint8Array,
  path: string,
  contentType: string,
): Promise<string | null> {
  try {
    const bucket = Deno.env.get('QBR_STORAGE_BUCKET') || 'qbr-artifacts';
    const { error } = await admin.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true });
    if (error) return null;
    const { data } = admin.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const isStringRecord = (v: unknown): v is Record<string, string> =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.values(v as Record<string, unknown>).every((x) => typeof x === 'string');

const isUniqueViolation = (e: unknown): boolean =>
  !!e && typeof e === 'object' && (e as { code?: string }).code === '23505';
