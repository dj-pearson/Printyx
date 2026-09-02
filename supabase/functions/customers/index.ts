// Customers Edge Function - Companies Architecture
// Handles customer relationship operations (customers table links to companies)
// Updated Jan 13, 2026 - Now uses companies as single source of truth
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamel, toCamelShallow } from '../_shared/case.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Resolve tenant ID from the verified JWT (canonical). The x-tenant-id header
    // is only a fallback and must NEVER override the JWT tenant — otherwise any
    // authenticated user can read/write another tenant by spoofing the header.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { error: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }
    let tenantId = jwtTenantId || headerTenantId;

    if (!tenantId) {
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      if (dbUser?.tenant_id) {
        tenantId = dbUser.tenant_id;
      } else if (user.email) {
        const { data: emailUser } = await admin2
          .from('users')
          .select('tenant_id')
          .ilike('email', user.email)
          .limit(1)
          .maybeSingle();
        tenantId = emailUser?.tenant_id;
      }
    }

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'customers');
    const customerId = parts[0];
    // PA-020: the sub-segment used to be dropped entirely, so every Customer
    // Detail tab - invoices, equipment, service history, financials, supplies -
    // got the CUSTOMER OBJECT back instead of its list, at 200. A page mapping
    // over an object renders nothing and reports no error.
    const subResource = parts[1];

    // Every method, not just GET (PA-021). This used to be GET-only, so a
    // POST to /customers/:id/supply-orders fell through to the create-customer
    // branch below and wrote a junk `companies` row from the order payload,
    // answering 201 - and the UI reported "Supply order created successfully".
    // Nothing in Express served that path either, so production was the only
    // host where the button did anything, and what it did was wrong.
    if (customerId && subResource) {
      return await handleSubResource(req, admin, tenantId, customerId, parts.slice(1), url);
    }

    // GET /customers - List all companies from companies table
    if (req.method === 'GET' && !customerId) {
      const search = url.searchParams.get('search');
      const status = url.searchParams.get('status');
      const recordType =
        url.searchParams.get('recordType') || url.searchParams.get('business_record_type');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Query companies table (single source of truth)
      let query = admin
        .from('companies')
        .select('*, company_contacts(*)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('activity', status);
      }

      if (recordType) {
        query = query.eq('business_record_type', recordType);
      }

      if (search) {
        // `companies` has no email column — email lives on company_contacts — so
        // naming it here made EVERY customer search a 42703. Email search is kept
        // by resolving matching contacts to their company ids first.
        const safe = search.replace(/[,()]/g, ' ');
        const clauses = [
          `business_name.ilike.%${safe}%`,
          `phone.ilike.%${safe}%`,
          `customer_number.ilike.%${safe}%`,
        ];
        const { data: contactMatches } = await admin
          .from('company_contacts')
          .select('company_id')
          .eq('tenant_id', tenantId)
          .ilike('email', `%${safe}%`)
          .limit(200);
        const companyIds = [
          ...new Set((contactMatches ?? []).map((c: any) => c.company_id).filter(Boolean)),
        ];
        if (companyIds.length > 0) {
          clauses.push(`id.in.(${companyIds.join(',')})`);
        }
        query = query.or(clauses.join(','));
      }

      const { data: companies, error, count } = await query;

      if (error) {
        console.error('[CUSTOMERS] Error fetching customers:', error);
        return createCorsResponse({ error: 'Failed to fetch customers' }, 500, req);
      }

      console.log(
        `[CUSTOMERS] Query returned ${companies?.length || 0} companies for tenant ${tenantId}`,
      );

      // Map to expected frontend format
      const records = (companies || []).map((company: any) => {
        const contactData = company.company_contacts?.[0] || {};
        return {
          ...company,
          companyName: company.business_name,
          primaryContactName: contactData.first_name
            ? `${contactData.first_name} ${contactData.last_name || ''}`.trim()
            : null,
          // No `|| company.email` fallback: companies has no email column.
          primaryContactEmail: contactData.email ?? null,
          primaryContactPhone: contactData.phone || company.phone,
          city: company.billing_city,
          state: company.billing_state,
          status: company.activity || 'active',
          recordType: company.business_record_type?.toLowerCase() || 'customer',
        };
      });

      // Return plain array — iOS JSONDecoder expects [BusinessRecord] directly
      return createCorsResponse(records, 200, req);
    }

    // GET /customers/:id - Get single company/customer by ID
    if (req.method === 'GET' && customerId) {
      // Query from companies table (single source of truth)
      const { data: company, error } = await admin
        .from('companies')
        .select(
          `
          *,
          company_contacts(*),
          leads(*),
          customers(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .or(`id.eq.${customerId},customer_number.eq.${customerId}`)
        .limit(1)
        .single();

      if (error || !company) {
        console.error('Error fetching customer:', error);
        return createCorsResponse({ error: 'Customer not found' }, 404, req);
      }

      // Get recent activities (check both company_id and business_record_id for migration support)
      const { data: activities } = await admin
        .from('business_record_activities')
        .select('*')
        .or(`company_id.eq.${company.id},business_record_id.eq.${company.id}`)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Map company fields to expected frontend format
      const contactData = company.company_contacts?.[0] || {};
      const response = {
        ...company,
        // Map to expected field names
        companyName: company.business_name,
        primaryContactName: contactData.first_name
          ? `${contactData.first_name} ${contactData.last_name || ''}`.trim()
          : null,
        // No `|| company.email` fallback: companies has no email column.
        primaryContactEmail: contactData.email ?? null,
        primaryContactPhone: contactData.phone || company.phone,
        city: company.billing_city,
        state: company.billing_state,
        status: company.activity || 'active',
        recordType: company.business_record_type?.toLowerCase() || 'customer',
        activities: activities || [],
      };

      return createCorsResponse(response, 200, req);
    }

    // POST /customers - Create new customer in business_records
    if (req.method === 'POST') {
      const body = await req.json();

      // Generate unique identifiers
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 100000000);
      const companyDisplayId = `${randomNum}`;
      const companyNameSlug = (body.companyName || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const urlSlug = `${companyNameSlug}-${companyDisplayId}`;
      const customerNumber = `CUST-${timestamp}-${randomNum}`;

      const customerData = {
        tenant_id: tenantId,
        record_type: 'customer',
        status: body.status || 'active',

        // Company information
        company_name: body.companyName,
        company_display_id: companyDisplayId,
        url_slug: urlSlug,
        customer_number: customerNumber,
        website: body.website,
        industry: body.industry,
        company_size: body.companySize,

        // Primary contact
        primary_contact_name: body.primaryContactName,
        primary_contact_email: body.primaryContactEmail,
        primary_contact_phone: body.primaryContactPhone,
        primary_contact_title: body.primaryContactTitle,

        // Address
        address_line1: body.addressLine1,
        address_line2: body.addressLine2,
        city: body.city,
        state: body.state,
        postal_code: body.postalCode,
        country: body.country || 'US',

        // Customer management
        priority: body.priority || 'medium',
        customer_tier: body.customerTier,
        assigned_sales_rep: body.assignedSalesRep,
        // AUDIT-037: the columns are `source` and `estimated_deal_value`, not
        // lead_source and estimated_amount, and `tags` does not exist at all -
        // so creating a customer through this function 42703'd every time.
        source: body.leadSource || 'website',
        estimated_deal_value: body.estimatedDealValue ? parseFloat(body.estimatedDealValue) : null,
        probability: body.probability ? parseInt(body.probability) : 100,

        // Notes and metadata
        notes: body.notes,
        customer_since: new Date().toISOString(),
        created_by: user.id,
        owner_id: body.ownerId || user.id,
        created_at: new Date().toISOString(),
      };

      const { data: customer, error } = await admin
        .from('business_records')
        .insert(customerData)
        .select()
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        return createCorsResponse(
          { error: 'Failed to create customer', details: error.message },
          500,
          req,
        );
      }

      // Log activity
      await admin.from('business_record_activities').insert({
        business_record_id: customer.id,
        tenant_id: tenantId,
        activity_type: 'record_created',
        description: `Customer created: ${body.companyName}`,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(customer, 201, req);
    }

    // PATCH /customers/:id - Update customer record in business_records
    if ((req.method === 'PATCH' || req.method === 'PUT') && customerId) {
      const body = await req.json();

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Map frontend field names to database column names
      if (body.companyName) updateData.company_name = body.companyName;
      if (body.status) updateData.status = body.status;
      if (body.website) updateData.website = body.website;
      if (body.industry) updateData.industry = body.industry;
      if (body.companySize) updateData.company_size = body.companySize;
      if (body.primaryContactName) updateData.primary_contact_name = body.primaryContactName;
      if (body.primaryContactEmail) updateData.primary_contact_email = body.primaryContactEmail;
      if (body.primaryContactPhone) updateData.primary_contact_phone = body.primaryContactPhone;
      if (body.primaryContactTitle) updateData.primary_contact_title = body.primaryContactTitle;
      if (body.addressLine1) updateData.address_line1 = body.addressLine1;
      if (body.addressLine2) updateData.address_line2 = body.addressLine2;
      if (body.city) updateData.city = body.city;
      if (body.state) updateData.state = body.state;
      if (body.postalCode) updateData.postal_code = body.postalCode;
      if (body.country) updateData.country = body.country;
      if (body.priority) updateData.priority = body.priority;
      if (body.customerTier) updateData.customer_tier = body.customerTier;
      if (body.assignedSalesRep) updateData.assigned_sales_rep = body.assignedSalesRep;
      if (body.leadSource) updateData.source = body.leadSource;
      if (body.notes !== undefined) updateData.notes = body.notes;
      // `tags` is not a column on business_records, so it is not written. It was
      // here, which meant any edit that sent tags lost the whole update.

      const { data: customer, error } = await admin
        .from('business_records')
        .update(updateData)
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer')
        .select()
        .single();

      if (error) {
        console.error('Error updating customer:', error);
        return createCorsResponse({ error: 'Failed to update customer' }, 500, req);
      }

      // Log activity
      await admin.from('business_record_activities').insert({
        business_record_id: customer.id,
        tenant_id: tenantId,
        activity_type: 'record_updated',
        description: `Customer updated: ${customer.company_name}`,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(customer, 200, req);
    }

    // DELETE /customers/:id - Delete customer record from business_records
    if (req.method === 'DELETE' && customerId) {
      const { error } = await admin
        .from('business_records')
        .delete()
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer');

      if (error) {
        console.error('Error deleting customer:', error);
        return createCorsResponse({ error: 'Failed to delete customer' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Customer deleted successfully' },
        200,
        req,
      );
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in customers function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── Customer detail sub-resources (PA-020) ─────────────────────────────────
//
// The Customer Detail tabs each fetch /api/customers/:id/<thing>. Before this,
// the handler read the id and ignored the sub-segment, so every tab received
// the customer object at 200 - a page that maps over it renders an empty list
// and reports nothing wrong. No Express route covered financial-summary,
// payments, aging, supply-orders or activities either, so those five were dead
// in dev as well.
//
// Every query is scoped to BOTH tenant and customer. Rows go through toCamel
// because these components read camelCase (invoiceNumber, balanceDue,
// serialNumber) and PostgREST answers snake_case.
//
// WHAT IS NOT BACKED, named rather than invented: there is no `payments` table
// in any schema or migration. Payment history is derived from invoices that
// record an amount_paid, which gives a real date and amount but no method and
// no cheque number; the response says so in `unbacked` and the fields are null.

// deno-lint-ignore no-explicit-any
type Admin = any;

const SUB_RESOURCE_TABLES: Record<string, string> = {
  invoices: 'invoices',
  equipment: 'equipment',
  contracts: 'contracts',
  'service-tickets': 'service_tickets',
  'service-calls': 'service_calls',
  'supply-orders': 'customer_supply_orders',
};

/** Numeric columns arrive from PostgREST as strings; sum them as numbers. */
function num(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/** Days between a due date and now; negative means not yet due. */
function daysOverdue(dueDate: unknown, now: number): number {
  const due = new Date(String(dueDate ?? '')).getTime();
  if (!Number.isFinite(due)) return 0;
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

async function handleSubResource(
  req: Request,
  admin: Admin,
  tenantId: string,
  customerId: string,
  // The whole tail, because one sub-resource is two segments: the Customer
  // Detail meter-readings tab calls /metrics/history.
  segments: string[],
  url: URL,
): Promise<Response> {
  const subResource = segments[0];

  if (req.method !== 'GET') {
    // Creating a supply order is not merely unimplemented here - it is not
    // expressible against the schema as the form stands. customer_supply_orders
    // is an order HEADER (order_number NOT NULL UNIQUE, delivery_address jsonb
    // NOT NULL, customer_portal_user_id NOT NULL referencing a portal login)
    // with its line items in customer_supply_order_items, while the dialog
    // posts a single {supplyId, quantity, unitPrice, totalPrice, orderType,
    // notes} - not one of which is a column - and a status of 'pending', which
    // is not in the supply_order_status enum. A staff-side order also has no
    // portal user to satisfy the NOT NULL FK. So this answers 501 rather than
    // dropping the unknown keys and writing a header nobody can fulfil.
    if (req.method === 'POST' && subResource === 'supply-orders') {
      return createCorsResponse(
        {
          error: 'Creating a supply order from the customer record is not implemented',
          code: 'NOT_IMPLEMENTED',
        },
        501,
        req,
      );
    }
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 1000);

  const table = SUB_RESOURCE_TABLES[subResource];
  if (table) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error(`Error fetching customer ${subResource}:`, error);
      return createCorsResponse({ error: `Failed to fetch ${subResource}` }, 500, req);
    }
    return createCorsResponse(toCamel(data ?? []), 200, req);
  }

  if (subResource === 'activities') {
    // business_record_activities keys off business_record_id, not customer_id -
    // a customer IS a business record here, and the id is the same value.
    const { data, error } = await admin
      .from('business_record_activities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('business_record_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Error fetching customer activities:', error);
      return createCorsResponse({ error: 'Failed to fetch activities' }, 500, req);
    }
    return createCorsResponse(toCamel(data ?? []), 200, req);
  }

  // The three derived views below all read the same invoice set. PostgREST has
  // no SUM, so the arithmetic happens here.
  if (
    subResource === 'financial-summary' ||
    subResource === 'aging' ||
    subResource === 'payments'
  ) {
    const { data, error } = await admin
      .from('invoices')
      .select(
        'id, invoice_number, invoice_date, due_date, total_amount, amount_paid, balance_due, invoice_status, paid_date',
      )
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .limit(2000);
    if (error) {
      console.error(`Error fetching invoices for ${subResource}:`, error);
      return createCorsResponse({ error: `Failed to fetch ${subResource}` }, 500, req);
    }
    const invoices = data ?? [];

    if (subResource === 'payments') {
      const payments = invoices
        .filter((i: Record<string, unknown>) => num(i.amount_paid) > 0)
        .map((i: Record<string, unknown>) => ({
          id: i.id,
          paymentDate: i.paid_date ?? null,
          amount: num(i.amount_paid),
          invoiceNumber: i.invoice_number ?? null,
          // No payments table exists, so these are unknown rather than empty.
          paymentMethod: null,
          checkNumber: null,
          notes: null,
        }))
        .sort((a: { paymentDate: unknown }, b: { paymentDate: unknown }) =>
          String(b.paymentDate ?? '').localeCompare(String(a.paymentDate ?? '')),
        );
      return createCorsResponse(
        {
          payments,
          unbacked: [
            'paymentMethod and checkNumber: there is no payments table, so a payment is only visible as an invoice amount_paid',
          ],
        },
        200,
        req,
      );
    }

    if (subResource === 'aging') {
      const now = Date.now();
      const buckets = { current: 0, thirtyDays: 0, sixtyDays: 0, ninetyDays: 0, overNinety: 0 };
      for (const invoice of invoices as Record<string, unknown>[]) {
        const outstanding = num(invoice.balance_due);
        if (outstanding <= 0) continue;
        const age = daysOverdue(invoice.due_date, now);
        if (age <= 0) buckets.current += outstanding;
        else if (age <= 30) buckets.thirtyDays += outstanding;
        else if (age <= 60) buckets.sixtyDays += outstanding;
        else if (age <= 90) buckets.ninetyDays += outstanding;
        else buckets.overNinety += outstanding;
      }
      const totalOutstanding = Object.values(buckets).reduce((sum, v) => sum + v, 0);
      return createCorsResponse({ ...buckets, totalOutstanding }, 200, req);
    }

    // financial-summary
    let totalBilled = 0;
    let totalPaid = 0;
    let balanceDue = 0;
    let lastPaymentDate: string | null = null;
    let lastPaymentAmount: number | null = null;
    const paymentLags: number[] = [];
    for (const invoice of invoices as Record<string, unknown>[]) {
      totalBilled += num(invoice.total_amount);
      totalPaid += num(invoice.amount_paid);
      balanceDue += num(invoice.balance_due);
      const paidAt = invoice.paid_date ? String(invoice.paid_date) : null;
      if (paidAt) {
        if (!lastPaymentDate || paidAt > lastPaymentDate) {
          lastPaymentDate = paidAt;
          lastPaymentAmount = num(invoice.amount_paid);
        }
        const issued = new Date(String(invoice.invoice_date ?? '')).getTime();
        const settled = new Date(paidAt).getTime();
        if (Number.isFinite(issued) && Number.isFinite(settled) && settled >= issued) {
          paymentLags.push((settled - issued) / (1000 * 60 * 60 * 24));
        }
      }
    }

    // The customer's own credit limit, when the record carries one.
    const { data: record } = await admin
      .from('business_records')
      .select('credit_limit')
      .eq('tenant_id', tenantId)
      .eq('id', customerId)
      .maybeSingle();
    const creditLimit = record?.credit_limit == null ? null : num(record.credit_limit);

    return createCorsResponse(
      {
        totalBilled,
        totalPaid,
        balanceDue,
        // Null, not 0: no settled invoice means no average, and 0 days reads as
        // a customer who pays instantly.
        averagePaymentDays:
          paymentLags.length > 0
            ? Math.round(paymentLags.reduce((sum, d) => sum + d, 0) / paymentLags.length)
            : null,
        creditLimit,
        availableCredit: creditLimit == null ? null : creditLimit - balanceDue,
        lastPaymentDate,
        lastPaymentAmount,
      },
      200,
      req,
    );
  }

  // GET /customers/:id/metrics/history - the meter-readings tab (PA-021).
  //
  // The Express handler this replaces filtered device_registrations by
  // tenant_id ONLY, despite the column device_registrations.customer_id
  // existing and its own comment saying "get all devices for this customer".
  // So every customer's meter-readings tab showed the WHOLE TENANT's fleet,
  // labelled with whichever customer was open. Nothing errored and the numbers
  // looked real, which is why it survived. This filters on customer_id.
  if (subResource === 'metrics' && segments[1] === 'history') {
    const { data: devices, error: deviceError } = await admin
      .from('device_registrations')
      .select('id, device_name, serial_number, model')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('last_seen', { ascending: false });
    if (deviceError) {
      console.error('Error fetching customer devices:', deviceError);
      return createCorsResponse({ error: 'Failed to fetch customer devices' }, 500, req);
    }

    const deviceRows = devices ?? [];
    // No devices means no readings; asking PostgREST for `in.()` is a syntax
    // error, so return the empty timeline rather than issuing the query.
    if (deviceRows.length === 0) {
      return createCorsResponse(
        { customerId, timeline: [], totalDevices: 0, totalReadings: 0 },
        200,
        req,
      );
    }

    const { data: metrics, error: metricError } = await admin
      .from('device_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .in(
        'device_id',
        deviceRows.map((d: any) => d.id),
      )
      .order('collection_timestamp', { ascending: false })
      .limit(limit);
    if (metricError) {
      console.error('Error fetching customer metrics history:', metricError);
      return createCorsResponse({ error: 'Failed to fetch customer metrics history' }, 500, req);
    }

    const byDevice = new Map<string, unknown[]>();
    for (const metric of metrics ?? []) {
      const key = String((metric as any).device_id);
      if (!byDevice.has(key)) byDevice.set(key, []);
      // toner_levels, paper_levels and raw_data are jsonb of arbitrary shape;
      // a deep converter would rewrite keys inside them.
      byDevice.get(key)!.push(toCamelShallow(metric as Record<string, unknown>));
    }

    return createCorsResponse(
      {
        customerId,
        timeline: deviceRows.map((device: any) => ({
          deviceId: device.id,
          deviceName: device.device_name,
          serialNumber: device.serial_number,
          model: device.model,
          readings: byDevice.get(String(device.id)) ?? [],
        })),
        totalDevices: deviceRows.length,
        totalReadings: (metrics ?? []).length,
      },
      200,
      req,
    );
  }

  return createCorsResponse(
    { error: `Unknown customer sub-resource: ${segments.join('/')}` },
    404,
    req,
  );
}
