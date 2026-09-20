// Managed Services Edge Function
// Handles managed print services contracts and monitoring
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { importCatalogCsv, readUploadedCsv } from '../_shared/catalog-import-runner.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { normalizePath } from '../_shared/path.ts';
import { denyWithoutPermission } from '../_shared/rbac.ts';
import { isMissingTableError } from '../_shared/postgrest-errors.ts';
import { addMonths, startOfUtcDay } from '../_shared/date-months.ts';

/**
 * The third of the catalogue family, after product-models and
 * software-products (SEC-EDGE-001). Adding, editing, importing or deleting a
 * managed-service product changes what every rep can put on a quote and at what
 * price, and /managed-services is minLevel 3 while /import/products names this
 * exact permission. A permission rather than a level, matching the two
 * siblings: the seeder has a code that means precisely this.
 *
 * READS STAY OPEN ON PURPOSE. The quote builder's ProductTypeSelector calls
 * GET / to populate its picker, and that surface is sales.quote.create with no
 * minLevel - gating the read would break quoting for every rep.
 */
const WRITE_PERMISSION = 'operations.inventory.manage';

/**
 * Segments that name a sub-resource rather than a product id, so `/:id` does
 * not swallow them.
 */
const RESERVED_SEGMENTS = new Set([
  'import',
  'contracts',
  'usage',
  'meter-reading',
  'dashboard',
  'billing',
]);

/**
 * FOUR OF THIS FUNCTION'S FIVE TABLES DO NOT EXIST.
 *
 * `managed_services_contracts`, `mps_covered_devices`, `mps_meter_readings` and
 * `mps_billing_records` are in no Drizzle schema and no migration - all four
 * sit in docs/phantom-tables-baseline.json against this file - so every
 * contract, usage, meter-reading, billing and dashboard branch is a 42P01. No
 * client tree calls any of them either, so nothing is broken today; what was
 * wrong is that a missing relation surfaced as a 500 ("Failed to fetch
 * contracts"), which reads as an outage rather than as a feature that was never
 * built. 503 says the request is well formed and will work once the tables
 * exist.
 */
function relationMissing(req: Request, feature: string) {
  return createCorsResponse(
    {
      error: `${feature} is not available`,
      code: 'RELATION_MISSING',
      message:
        'The managed-services contract tables (managed_services_contracts, mps_covered_devices, mps_meter_readings, mps_billing_records) exist in no schema or migration. The product catalogue on this prefix works; the contract lifecycle was never built.',
    },
    503,
    req,
  );
}

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /managed-services, making this correct whether or not the prefix survived.
    const { parts: pathParts } = normalizePath(url.pathname, 'managed-services');
    const endpoint = pathParts[0];

    // Gate placed AFTER the path parse so the write branches below cannot be
    // reached before it, and before any branch reads a body.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const denied = await denyWithoutPermission(admin, user, WRITE_PERMISSION);
      if (denied) return createCorsResponse(denied, 403, req);
    }

    // ====================================================================
    // POST /managed-services/import - bulk CSV import
    //
    // PROD-014: this existed only on Express, so catalog import 404'd in
    // production. The spec, the CSV parser and the row validation are shared
    // with the client and Express, so the same file imports identically on
    // either backend. It must precede the generic POST create branch, or the
    // upload is treated as a single product. Reads the path segment directly
    // rather than the id variable below, which is declared after this point —
    // naming it here is a temporal-dead-zone ReferenceError at runtime that no
    // bundler flags.
    // ====================================================================
    if (req.method === 'POST' && pathParts[0] === 'import') {
      const csvText = await readUploadedCsv(req);
      if (!csvText) {
        return createCorsResponse({ message: 'No file uploaded' }, 400, req);
      }
      const outcome = await importCatalogCsv(admin, 'managed-services', tenantId, csvText);
      return createCorsResponse(outcome, 200, req);
    }
    const contractId = pathParts[1];

    // ====================================================================
    // The BARE prefix (WF-G-05). /managed-services is a routed page and its
    // list and create calls hit the prefix itself - `useQuery(['/api/managed-
    // services'])` and `apiRequest('/api/managed-services', 'POST', data)`.
    // Every branch below requires a named segment, so both fell through to the
    // 404 at the bottom: the page showed nothing and "Managed service created
    // successfully" was a toast over a request that never landed.
    //
    // check:edge-path-coverage could not see this, because it keyed on a named
    // segment and a bare call has none. That is the gap WF-G-05 closed, and
    // this is what it found.
    //
    // These serve `managed_services` - the product catalogue rows the page
    // renders - not `managed_service_contracts`, which is what /contracts
    // below is about. Two different tables behind one prefix.
    // ====================================================================
    if (req.method === 'GET' && !endpoint) {
      const { data, error } = await admin
        .from('managed_services')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('product_name', { ascending: true });

      if (error) {
        console.error('Error listing managed services:', error);
        return createCorsResponse({ error: 'Failed to fetch managed services' }, 500, req);
      }
      return createCorsResponse(data ?? [], 200, req);
    }

    if (req.method === 'POST' && !endpoint) {
      const body = await req.json().catch(() => ({}));

      // product_code and product_name are NOT NULL. The form collects both, so
      // a missing one is a 400 rather than a 23502 the page cannot read.
      const productCode = body.productCode ?? body.product_code;
      const productName = body.productName ?? body.product_name;
      if (!productCode || !productName) {
        return createCorsResponse({ error: 'productCode and productName are required' }, 400, req);
      }

      // Only real columns. Drizzle would drop an unknown key silently; PostgREST
      // answers PGRST204, which is louder but still reaches the user as
      // "failed to create" with no reason.
      const row: Record<string, unknown> = {
        tenant_id: tenantId,
        product_code: productCode,
        product_name: productName,
        category: body.category ?? null,
        service_type: body.serviceType ?? body.service_type ?? null,
        service_level: body.serviceLevel ?? body.service_level ?? null,
        description: body.description ?? null,
        summary: body.summary ?? null,
        support_hours: body.supportHours ?? body.support_hours ?? null,
        response_time: body.responseTime ?? body.response_time ?? null,
        includes_hardware: body.includesHardware ?? body.includes_hardware ?? false,
        remote_mgmt: body.remoteMgmt ?? body.remote_mgmt ?? false,
        onsite_support: body.onsiteSupport ?? body.onsite_support ?? false,
        is_active: body.isActive ?? body.is_active ?? true,
        available_for_all: body.availableForAll ?? body.available_for_all ?? false,
        repost_edit: body.repostEdit ?? body.repost_edit ?? null,
        sales_rep_credit: body.salesRepCredit ?? body.sales_rep_credit ?? null,
        funding: body.funding ?? null,
        lease: body.lease ?? null,
        payment_type: body.paymentType ?? body.payment_type ?? null,
      };

      const { data, error } = await admin
        .from('managed_services')
        .insert(row)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error creating managed service:', error);
        return createCorsResponse(
          { error: 'Failed to create managed service', message: error.message },
          500,
          req,
        );
      }
      return createCorsResponse(data, 201, req);
    }

    // ====================================================================
    // PATCH / PUT / DELETE /managed-services/:id
    //
    // NEITHER EXISTED, AND THE PAGE CALLS BOTH. ManagedServices.tsx is routed,
    // deletes a service with `DELETE /api/managed-services/:id`, and bulk
    // deletes by looping that call - while this function had no `/:id` branch
    // at all, so both fell through to the 404 at the bottom. `/api/managed-
    // services` is not in crmProxies, so Express served the working PATCH and
    // DELETE on every developer machine and production had neither: the usual
    // dual-host split running the usual way round.
    //
    // The bulk path was the worse half. It wrapped each call in `catch {}` and
    // then toasted "Deleted N managed services" regardless, so a rep selecting
    // twenty products in production was told all twenty were gone and none
    // were. That toast is fixed on the page in the same change.
    //
    // Fields are mapped EXPLICITLY, never `{ ...body }` (COP-M01): a spread
    // lets the caller name every column, including tenant_id, id and the
    // timestamps, and `.eq('tenant_id', ...)` decides which ROW is written,
    // not what is written into it.
    // ====================================================================
    const serviceId = endpoint && !RESERVED_SEGMENTS.has(endpoint) ? endpoint : null;

    if ((req.method === 'PATCH' || req.method === 'PUT') && serviceId) {
      const body = await req.json().catch(() => ({}));

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const set = (column: string, ...candidates: unknown[]) => {
        const value = candidates.find((v) => v !== undefined);
        if (value !== undefined) patch[column] = value;
      };
      // Same column set the create branch writes, minus tenant_id - a partial
      // form must not null the columns it left out, so only what the caller
      // sent is written.
      set('product_code', body.productCode, body.product_code);
      set('product_name', body.productName, body.product_name);
      set('category', body.category);
      set('service_type', body.serviceType, body.service_type);
      set('service_level', body.serviceLevel, body.service_level);
      set('description', body.description);
      set('summary', body.summary);
      set('support_hours', body.supportHours, body.support_hours);
      set('response_time', body.responseTime, body.response_time);
      set('includes_hardware', body.includesHardware, body.includes_hardware);
      set('remote_mgmt', body.remoteMgmt, body.remote_mgmt);
      set('onsite_support', body.onsiteSupport, body.onsite_support);
      set('is_active', body.isActive, body.is_active);
      set('available_for_all', body.availableForAll, body.available_for_all);
      set('repost_edit', body.repostEdit, body.repost_edit);
      set('sales_rep_credit', body.salesRepCredit, body.sales_rep_credit);
      set('funding', body.funding);
      set('lease', body.lease);
      set('payment_type', body.paymentType, body.payment_type);

      if (Object.keys(patch).length === 1) {
        // Only updated_at: nothing the caller sent is writable here. A 200 that
        // bumped the timestamp and reported success would be COP-M01's silent
        // no-op (200 having changed nothing).
        return createCorsResponse(
          { error: 'No updatable fields in the request body', code: 'EMPTY_PATCH' },
          400,
          req,
        );
      }

      const { data: updated, error } = await admin
        .from('managed_services')
        .update(patch)
        .eq('id', serviceId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating managed service:', error);
        return createCorsResponse(
          { error: 'Failed to update managed service', message: error.message },
          500,
          req,
        );
      }
      if (!updated) {
        return createCorsResponse({ error: 'Managed service not found' }, 404, req);
      }
      return createCorsResponse(updated, 200, req);
    }

    if (req.method === 'DELETE' && serviceId) {
      // The tenant filter is the authorization, not the id: uuids travel in
      // URLs, exports and support tickets, and hard-to-guess is not a check
      // (SEC-TENANT-005). `select` so a miss is a 404 rather than a silent
      // success, which is exactly what the bulk loop used to report.
      const { data: removed, error } = await admin
        .from('managed_services')
        .delete()
        .eq('id', serviceId)
        .eq('tenant_id', tenantId)
        .select('id');

      if (error) {
        console.error('Error deleting managed service:', error);
        return createCorsResponse(
          { error: 'Failed to delete managed service', message: error.message },
          500,
          req,
        );
      }
      if (!removed || removed.length === 0) {
        return createCorsResponse({ error: 'Managed service not found' }, 404, req);
      }
      return createCorsResponse({ success: true, id: serviceId }, 200, req);
    }

    // GET /managed-services/contracts - List MPS contracts
    if (req.method === 'GET' && endpoint === 'contracts' && !contractId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('managed_services_contracts')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: contracts, error } = await query;

      if (error) {
        console.error('Error fetching managed services contracts:', error);
        if (isMissingTableError(error)) return relationMissing(req, 'MPS contracts');
        return createCorsResponse({ error: 'Failed to fetch contracts' }, 500, req);
      }

      return createCorsResponse(contracts || [], 200, req);
    }

    // GET /managed-services/contracts/:id - Get single contract
    if (req.method === 'GET' && endpoint === 'contracts' && contractId) {
      const { data: contract, error } = await admin
        .from('managed_services_contracts')
        .select('*')
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (isMissingTableError(error)) return relationMissing(req, 'MPS contracts');
        return createCorsResponse({ error: 'Contract not found' }, 404, req);
      }

      // Get covered devices
      const { data: devices } = await admin
        .from('mps_covered_devices')
        .select(
          `
          *,
          equipment:equipment_id (*)
        `,
        )
        .eq('contract_id', contractId);

      // Get billing history
      const { data: billing } = await admin
        .from('mps_billing_records')
        .select('*')
        .eq('contract_id', contractId)
        .order('billing_date', { ascending: false })
        .limit(12);

      return createCorsResponse(
        {
          ...contract,
          devices: devices || [],
          billingHistory: billing || [],
        },
        200,
        req,
      );
    }

    // POST /managed-services/contracts - Create contract
    if (req.method === 'POST' && endpoint === 'contracts') {
      const body = await req.json();

      const contractData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        contract_number: body.contractNumber || body.contract_number || `MPS-${Date.now()}`,
        contract_type: body.contractType || body.contract_type || 'cost_per_page',
        status: body.status || 'draft',
        start_date: body.startDate || body.start_date,
        end_date: body.endDate || body.end_date,
        billing_frequency: body.billingFrequency || body.billing_frequency || 'monthly',
        base_fee: body.baseFee || body.base_fee || 0,
        mono_rate: body.monoRate || body.mono_rate,
        color_rate: body.colorRate || body.color_rate,
        included_mono_pages: body.includedMonoPages || body.included_mono_pages || 0,
        included_color_pages: body.includedColorPages || body.included_color_pages || 0,
        overage_mono_rate: body.overageMonoRate || body.overage_mono_rate,
        overage_color_rate: body.overageColorRate || body.overage_color_rate,
        supplies_included: body.suppliesIncluded !== false,
        service_included: body.serviceIncluded !== false,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: contract, error } = await admin
        .from('managed_services_contracts')
        .insert(contractData)
        .select()
        .single();

      if (error) {
        console.error('Error creating MPS contract:', error);
        if (isMissingTableError(error)) return relationMissing(req, 'MPS contracts');
        return createCorsResponse({ error: 'Failed to create contract' }, 500, req);
      }

      return createCorsResponse(contract, 201, req);
    }

    // PUT /managed-services/contracts/:id - Update contract
    if (req.method === 'PUT' && endpoint === 'contracts' && contractId) {
      const body = await req.json();

      const { data: contract, error } = await admin
        .from('managed_services_contracts')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) return relationMissing(req, 'MPS contracts');
        return createCorsResponse({ error: 'Failed to update contract' }, 500, req);
      }

      return createCorsResponse(contract, 200, req);
    }

    // GET /managed-services/usage - Get usage statistics
    if (req.method === 'GET' && endpoint === 'usage') {
      const contractIdParam = url.searchParams.get('contractId');
      const month = url.searchParams.get('month');

      let query = admin
        .from('mps_meter_readings')
        .select(
          `
          *,
          device:device_id (
            id,
            serial_number,
            model
          )
        `,
        )
        .eq('tenant_id', tenantId);

      if (contractIdParam) query = query.eq('contract_id', contractIdParam);

      /**
       * `?month=` WAS READ AND THEN IGNORED - the value was pulled off the
       * query string and never used, so asking for one month returned the most
       * recent hundred readings from any month and looked like an answer. A
       * filter that appears to work beats a missing one for damage (COP-M01).
       *
       * `reading_date` holds a CALENDAR DATE in a timestamp column, so the
       * bounds are snapped to a UTC day and the upper one is exclusive
       * (DATE-LOCAL-002); an inclusive 23:59:59.999 is a real instant a row can
       * exceed.
       */
      if (month) {
        const start = new Date(`${month}-01T00:00:00.000Z`);
        if (Number.isNaN(start.getTime())) {
          return createCorsResponse(
            { error: 'month must be formatted YYYY-MM', code: 'VALIDATION' },
            400,
            req,
          );
        }
        const from = startOfUtcDay(start);
        query = query.gte('reading_date', from.toISOString());
        // Snapped explicitly. addMonths preserves the time of day, so on a
        // value that is already UTC midnight this is a no-op - but
        // check:calendar-date-bounds cannot see through the helper, and a
        // bound whose snapping a reader has to derive is one edit away from
        // being wrong.
        query = query.lt('reading_date', startOfUtcDay(addMonths(from, 1)).toISOString());
      }

      const { data: readings, error: readingsError } = await query
        .order('reading_date', { ascending: false })
        .limit(100);

      if (readingsError) {
        // The error was discarded here, so a table that does not exist answered
        // 200 with an empty array - indistinguishable from a contract nobody
        // has submitted a reading against (AUDIT-028).
        if (isMissingTableError(readingsError)) return relationMissing(req, 'MPS usage');
        console.error('Error fetching MPS usage:', readingsError);
        return createCorsResponse({ error: 'Failed to fetch usage' }, 500, req);
      }

      return createCorsResponse(readings || [], 200, req);
    }

    // POST /managed-services/meter-reading - Record meter reading
    if (req.method === 'POST' && endpoint === 'meter-reading') {
      const body = await req.json();

      const { data: reading, error } = await admin
        .from('mps_meter_readings')
        .insert({
          tenant_id: tenantId,
          contract_id: body.contractId || body.contract_id,
          device_id: body.deviceId || body.device_id,
          mono_count: body.monoCount || body.mono_count || 0,
          color_count: body.colorCount || body.color_count || 0,
          reading_date: body.readingDate || body.reading_date || new Date().toISOString(),
          reading_source: body.readingSource || body.reading_source || 'manual',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) return relationMissing(req, 'MPS meter readings');
        return createCorsResponse({ error: 'Failed to record meter reading' }, 500, req);
      }

      return createCorsResponse(reading, 201, req);
    }

    // GET /managed-services/dashboard - Get MPS dashboard data
    if (req.method === 'GET' && endpoint === 'dashboard') {
      /**
       * ALL THREE READS DISCARDED THEIR ERRORS, over three tables that do not
       * exist, and the response coalesced every count with `|| 0` - so this
       * answered 200 with a dashboard of zeroes on every call. That is the
       * exact failure mode CLAUDE.md names: the symptom is not an error, it is
       * a screen saying the business has no contracts, no devices and no
       * revenue.
       */
      const [contracts, devices, billing] = await Promise.all([
        admin
          .from('managed_services_contracts')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        admin
          .from('mps_covered_devices')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        admin
          .from('mps_billing_records')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('billing_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const failure = [contracts.error, devices.error, billing.error].find(Boolean);
      if (failure) {
        if (isMissingTableError(failure)) return relationMissing(req, 'The MPS dashboard');
        console.error('Error building MPS dashboard:', failure);
        return createCorsResponse({ error: 'Failed to build dashboard' }, 500, req);
      }

      const monthlyRevenue = (billing.data || []).reduce(
        (sum: number, r: any) => sum + (r.total_amount || 0),
        0,
      );

      return createCorsResponse(
        {
          totalContracts: contracts.count ?? 0,
          totalDevices: devices.count ?? 0,
          monthlyRevenue,
          // Nothing measures an MPS alert - there is no table, no derivation
          // and no writer - so this is null rather than a 0 that reads as "no
          // problems" (AUDIT-028).
          alertCount: null,
          unbacked: [
            'alertCount is not measured: no managed-services alert table, derivation or writer exists.',
          ],
        },
        200,
        req,
      );
    }

    // POST /managed-services/billing/generate - Generate billing
    if (req.method === 'POST' && endpoint === 'billing' && pathParts[2] === 'generate') {
      const body = await req.json();

      // In production, this would calculate actual billing based on meter readings
      const { data: billing, error } = await admin
        .from('mps_billing_records')
        .insert({
          tenant_id: tenantId,
          contract_id: body.contractId || body.contract_id,
          billing_date: new Date().toISOString(),
          billing_period_start: body.periodStart || body.billing_period_start,
          billing_period_end: body.periodEnd || body.billing_period_end,
          mono_pages: body.monoPages || 0,
          color_pages: body.colorPages || 0,
          base_fee: body.baseFee || 0,
          page_charges: body.pageCharges || 0,
          overage_charges: body.overageCharges || 0,
          total_amount: body.totalAmount || 0,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) return relationMissing(req, 'MPS billing');
        return createCorsResponse({ error: 'Failed to generate billing' }, 500, req);
      }

      return createCorsResponse(billing, 201, req);
    }

    // DELETE /managed-services/contracts/:id - Delete contract
    if (req.method === 'DELETE' && endpoint === 'contracts' && contractId) {
      const { error } = await admin
        .from('managed_services_contracts')
        .delete()
        .eq('id', contractId)
        .eq('tenant_id', tenantId);

      if (error) {
        if (isMissingTableError(error)) return relationMissing(req, 'MPS contracts');
        return createCorsResponse({ error: 'Failed to delete contract' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Contract deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in managed-services function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
