// business-records Edge Function
// Backwards-compatible wrapper that delegates to the companies table
// Maintains the same response format expected by existing callers
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Convert camelCase request body keys to snake_case for DB compatibility
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function normalizeBodyToSnake(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

// Map a companies row to the business_records response format expected by frontend
function mapCompanyToBusinessRecord(company: any): any {
  return {
    ...company,
    // Map company fields to business_records field names
    companyName: company.business_name,
    company_name: company.business_name,
    name: company.business_name,
    primaryContactName: company.company_contacts?.[0]?.first_name
      ? `${company.company_contacts[0].first_name} ${company.company_contacts[0].last_name || ''}`.trim()
      : null,
    primary_contact_name: company.company_contacts?.[0]?.first_name
      ? `${company.company_contacts[0].first_name} ${company.company_contacts[0].last_name || ''}`.trim()
      : null,
    primaryContactEmail: company.company_contacts?.[0]?.email || company.email,
    primary_contact_email: company.company_contacts?.[0]?.email || company.email,
    primaryContactPhone: company.company_contacts?.[0]?.phone || company.phone,
    primary_contact_phone: company.company_contacts?.[0]?.phone || company.phone,
    contactName: company.company_contacts?.[0]?.first_name
      ? `${company.company_contacts[0].first_name} ${company.company_contacts[0].last_name || ''}`.trim()
      : null,
    email: company.email,
    phone: company.phone,
    city: company.billing_city,
    state: company.billing_state,
    address: company.billing_address,
    address_line1: company.billing_address,
    postal_code: company.billing_zip,
    status: company.activity || 'active',
    recordType: company.business_record_type?.toLowerCase() || 'customer',
    record_type: company.business_record_type || 'Customer',
    lead_status: company.activity,
    customer_number: company.customer_number,
    industry: company.industry,
    website: company.website,
  };
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Edge functions receive paths without the function name prefix
  // e.g., /business-records/123/activities becomes /123/activities
  const recordId = pathParts[0]; // The UUID or 'stats'
  const subResource = pathParts[1]; // activities, contacts, overview, etc.

  try {
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

    // Resolve tenant ID: x-tenant-id header → app_metadata → user_metadata → DB lookup
    let tenantId =
      req.headers.get('x-tenant-id') ||
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      // Fallback: look up tenant from public.users
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      tenantId = dbUser?.tenant_id;
    }

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();

    if (req.method === 'GET') {
      // Handle stats/overview endpoint
      if (recordId === 'stats') {
        // GET /business-records/stats or /business-records/stats/overview
        // Return counts by type from companies table
        const { count: leadsCount } = await admin
          .from('companies')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('business_record_type', 'Lead');

        const { count: customersCount } = await admin
          .from('companies')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('business_record_type', 'Customer');

        const { count: prospectsCount } = await admin
          .from('companies')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('business_record_type', 'Prospect');

        const { count: totalCount } = await admin
          .from('companies')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        const { count: dealsCount } = await admin
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['open', 'on_hold']);

        const { count: contactsCount } = await admin
          .from('company_contacts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        return createCorsResponse(
          {
            leads: leadsCount || 0,
            customers: customersCount || 0,
            prospects: prospectsCount || 0,
            deals: dealsCount || 0,
            contacts: contactsCount || 0,
            total: totalCount || 0,
            byType: {
              lead: leadsCount || 0,
              customer: customersCount || 0,
              prospect: prospectsCount || 0,
            },
          },
          200,
          req,
        );
      }

      // Handle sub-resources
      if (subResource === 'activities' && recordId) {
        // Query activities by either business_record_id OR company_id
        const { data: activities, error } = await admin
          .from('business_record_activities')
          .select('*')
          .or(`business_record_id.eq.${recordId},company_id.eq.${recordId}`)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching activities:', error);
          return createCorsResponse({ error: 'Failed to fetch activities' }, 500, req);
        }

        return createCorsResponse(activities || [], 200, req);
      }

      if (subResource === 'contacts' && recordId) {
        // Fetch contacts for a company
        const { data: contacts, error } = await admin
          .from('company_contacts')
          .select('*')
          .eq('company_id', recordId)
          .eq('tenant_id', tenantId)
          .order('is_primary', { ascending: false });

        if (error) {
          console.error('Error fetching contacts:', error);
          return createCorsResponse({ error: 'Failed to fetch contacts' }, 500, req);
        }

        return createCorsResponse(contacts || [], 200, req);
      }

      if (recordId && !subResource) {
        // Getting a single record by ID - query companies table
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
          .eq('id', recordId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (company) {
          return createCorsResponse(mapCompanyToBusinessRecord(company), 200, req);
        }

        // Fallback: try business_records table for unmigrated records
        const { data: record, error: brError } = await admin
          .from('business_records')
          .select('*')
          .eq('id', recordId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (record) {
          return createCorsResponse(record, 200, req);
        }

        return createCorsResponse({ error: 'Record not found' }, 404, req);
      } else {
        // List records from companies table
        const recordType =
          url.searchParams.get('recordType') || url.searchParams.get('record_type');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');
        const ownerId = url.searchParams.get('ownerId') || url.searchParams.get('owner_id');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = admin
          .from('companies')
          .select('*, company_contacts(*)', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (recordType) {
          // Map common recordType values to business_record_type
          const typeMap: Record<string, string> = {
            lead: 'Lead',
            customer: 'Customer',
            prospect: 'Prospect',
            former_customer: 'Former Customer',
          };
          const mappedType = typeMap[recordType.toLowerCase()] || recordType;
          query = query.eq('business_record_type', mappedType);
        }

        if (status) {
          query = query.eq('activity', status);
        }

        if (ownerId) {
          query = query.eq('created_by', ownerId);
        }

        if (search) {
          query = query.or(
            `business_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,customer_number.ilike.%${search}%,industry.ilike.%${search}%,billing_city.ilike.%${search}%`,
          );
        }

        query = query.range(offset, offset + limit - 1);

        const { data: companies, error, count } = await query;

        if (error) {
          console.error('Error fetching companies for business-records:', error);
          return createCorsResponse({ error: 'Failed to fetch records' }, 500, req);
        }

        const records = (companies || []).map(mapCompanyToBusinessRecord);

        return createCorsResponse(
          {
            records,
            pagination: {
              total: count || 0,
              limit,
              offset,
              hasMore: offset + (companies?.length || 0) < (count || 0),
            },
          },
          200,
          req,
        );
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();

      // Handle POST to /business-records/:id/activities
      if (subResource === 'activities' && recordId) {
        const activityData = {
          tenant_id: tenantId,
          company_id: recordId,
          activity_type: body.activity_type,
          subject: body.activity_subject || body.subject || `${body.activity_type} activity`,
          description: body.notes || body.description,
          direction: body.direction,
          email_from: body.email_from,
          email_to: body.email_to,
          email_cc: body.email_cc,
          call_duration: body.activity_duration || body.call_duration,
          call_outcome: body.activity_outcome || body.call_outcome,
          scheduled_date: body.activity_date || body.scheduled_date,
          completed_date: body.completed_date,
          due_date: body.due_date,
          outcome: body.outcome,
          next_action: body.next_action,
          follow_up_date: body.follow_up_date,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newActivity, error } = await admin
          .from('business_record_activities')
          .insert(activityData)
          .select('*')
          .single();

        if (error) {
          console.error('Error creating activity:', error);
          return createCorsResponse(
            { error: 'Failed to create activity', details: error },
            500,
            req,
          );
        }

        return createCorsResponse(newActivity, 201, req);
      }

      // Handle POST to /business-records/:id/status
      if (subResource === 'status' && recordId) {
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (body.status) {
          updateData.activity = body.status;
        }

        const { data: updated, error } = await admin
          .from('companies')
          .update(updateData)
          .eq('id', recordId)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) {
          console.error('Error updating status:', error);
          return createCorsResponse({ error: 'Failed to update status' }, 500, req);
        }

        return createCorsResponse(mapCompanyToBusinessRecord(updated), 200, req);
      }

      // Handle regular business record creation - create in companies table
      const companyData = {
        tenant_id: tenantId,
        business_name: body.companyName || body.company_name || body.name || body.businessName,
        phone: body.phone,
        email: body.email || body.primaryContactEmail || body.primary_contact_email,
        website: body.website,
        billing_address: body.address || body.addressLine1 || body.address_line1 || body.billing_address,
        billing_city: body.city || body.billing_city,
        billing_state: body.state || body.billing_state,
        billing_zip: body.postalCode || body.postal_code || body.zip || body.billing_zip,
        industry: body.industry,
        activity: body.status || body.lead_status || 'new',
        business_record_type: body.recordType || body.record_type || 'Lead',
        description: body.notes || body.description,
        customer_number: body.customerNumber || body.customer_number,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: company, error } = await admin
        .from('companies')
        .insert(companyData)
        .select()
        .single();

      if (error) {
        console.error('Error creating company (via business-records):', error);
        return createCorsResponse({ error: 'Failed to create record', details: error }, 500, req);
      }

      // Create primary contact if contact info was provided
      const contactFirstName = body.primaryContactName?.split(' ')[0] || body.primary_contact_name?.split(' ')[0] || body.contactName?.split(' ')[0];
      const contactLastName = body.primaryContactName?.split(' ').slice(1).join(' ') || body.primary_contact_name?.split(' ').slice(1).join(' ') || body.contactName?.split(' ').slice(1).join(' ');

      if (contactFirstName) {
        await admin.from('company_contacts').insert({
          tenant_id: tenantId,
          company_id: company.id,
          first_name: contactFirstName,
          last_name: contactLastName || '',
          email: body.primaryContactEmail || body.primary_contact_email || body.contactEmail,
          phone: body.primaryContactPhone || body.primary_contact_phone || body.contactPhone,
          is_primary: true,
          created_at: new Date().toISOString(),
        });
      }

      return createCorsResponse(mapCompanyToBusinessRecord(company), 201, req);
    }

    if ((req.method === 'PATCH' || req.method === 'PUT') && recordId) {
      const body = await req.json();

      // Handle status sub-resource
      if (subResource === 'status') {
        const { data: updated, error } = await admin
          .from('companies')
          .update({
            activity: body.status || body.lead_status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recordId)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) {
          console.error('Error updating status:', error);
          return createCorsResponse({ error: 'Failed to update status' }, 500, req);
        }

        return createCorsResponse(mapCompanyToBusinessRecord(updated), 200, req);
      }

      // General update
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map common fields
      if (body.companyName || body.company_name || body.name) {
        updateData.business_name = body.companyName || body.company_name || body.name;
      }
      if (body.phone) updateData.phone = body.phone;
      if (body.email) updateData.email = body.email;
      if (body.website) updateData.website = body.website;
      if (body.industry) updateData.industry = body.industry;
      if (body.status || body.lead_status) updateData.activity = body.status || body.lead_status;
      if (body.recordType || body.record_type) updateData.business_record_type = body.recordType || body.record_type;
      if (body.city || body.billing_city) updateData.billing_city = body.city || body.billing_city;
      if (body.state || body.billing_state) updateData.billing_state = body.state || body.billing_state;
      if (body.address || body.billing_address) updateData.billing_address = body.address || body.billing_address;
      if (body.postalCode || body.postal_code || body.billing_zip) {
        updateData.billing_zip = body.postalCode || body.postal_code || body.billing_zip;
      }
      if (body.description || body.notes) updateData.description = body.description || body.notes;

      const { data: updated, error } = await admin
        .from('companies')
        .update(updateData)
        .eq('id', recordId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating company (via business-records):', error);
        return createCorsResponse({ error: 'Failed to update record' }, 500, req);
      }

      return createCorsResponse(mapCompanyToBusinessRecord(updated), 200, req);
    }

    if (req.method === 'DELETE' && recordId) {
      const { error } = await admin
        .from('companies')
        .delete()
        .eq('id', recordId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting company (via business-records):', error);
        return createCorsResponse({ error: 'Failed to delete record' }, 500, req);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Business records function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
