// Contacts Edge Function
//
// Two distinct surfaces share this function:
//
//  1. The flat CRM contacts surface — /api/contacts[/:id] — backed by
//     company_contacts, the canonical contact table (see CLAUDE.md, CRMX-002).
//     Contacts.tsx lists it and PhoneInTicketCreator.tsx creates through it.
//  2. The entity-nested surface — /api/leads/:id/contacts and
//     /api/companies/:id/contacts — backed by lead_contacts / customer_contacts.
//
// PROD-008b: the flat surface used to be decided by `pathParts.length > 1`,
// which made every one-segment path indistinguishable from the collection.
// GET /contacts/:id returned the ENTIRE list, PUT and DELETE fell to 405, and
// POST /contacts landed in the entity branch, writing to customer_contacts with
// a null customer_id — the wrong table. The two surfaces are now split on
// segment count up front: a nested path always carries 3+ segments, so 0 or 1
// segment is unambiguously flat.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toCamelShallow } from '../_shared/case.ts';

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

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const rawParts = url.pathname.split('/').filter(Boolean);
    // Normalize: strip function name from path if the relay preserved it
    const pathParts = rawParts[0] === 'contacts' ? rawParts.slice(1) : rawParts;

    // A nested path is always /{leads|companies}/:id/contacts[/:contactId], so it
    // carries 3 or 4 segments. 0 or 1 segment is the flat CRM surface.
    const entityType = pathParts.length > 1 ? pathParts[0] : null; // 'leads' or 'companies'
    const entityId = pathParts.length > 1 ? pathParts[1] : null;
    const contactId = pathParts.length > 3 ? pathParts[3] : null; // If accessing specific contact

    // Individual contributors (role level 1) only ever see their own contacts.
    // Carried over from server/routes-contacts.ts, which applied it to the list
    // and to every single-contact read/write.
    const roleLevel =
      Number(
        (user.app_metadata?.roleLevel as number | undefined) ??
          (user.app_metadata?.role_level as number | undefined) ??
          1,
      ) || 1;
    const ownOnly = roleLevel <= 1;

    // ── Flat CRM contacts surface: /contacts[/:id] over company_contacts ──────
    if (pathParts.length <= 1) {
      const flatId = pathParts.length === 1 ? pathParts[0] : null;

      // GET /contacts — list
      if (req.method === 'GET' && !flatId) {
        const sp = url.searchParams;
        const page = parseInt(sp.get('page') || '1');
        const limit = parseInt(sp.get('limit') || '25');
        const search = sp.get('search') || '';
        // The page sends 'status'/'ownerId'; the older callers sent
        // 'leadStatus'/'contactOwner'. Express accepted both, so both stay.
        const status = sp.get('status') || sp.get('leadStatus') || '';
        const ownerId = sp.get('ownerId') || sp.get('contactOwner') || '';
        const view = sp.get('view') || 'all';
        const createDate = sp.get('createDate') || '';
        const lastActivityDate = sp.get('lastActivityDate') || '';
        const sortByParam = sp.get('sortBy') || 'lastActivityDate';
        const sortOrder = sp.get('sortOrder') || 'desc';

        const columnMapping: Record<string, string> = {
          lastActivityDate: 'last_contact_date',
          lastContactDate: 'last_contact_date',
          nextFollowUpDate: 'next_follow_up_date',
          createdAt: 'created_at',
          updatedAt: 'updated_at',
          firstName: 'first_name',
          lastName: 'last_name',
          companyId: 'company_id',
          ownerId: 'owner_id',
          leadStatus: 'lead_status',
        };
        const sortBy = columnMapping[sortByParam] || sortByParam;
        const offset = (page - 1) * limit;

        let query = admin
          .from('company_contacts')
          .select('*, companies(business_name)', { count: 'exact' })
          .eq('tenant_id', tenantId);

        if (search) {
          query = query.or(
            `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
          );
        }
        if (status && status !== 'all') query = query.eq('lead_status', status);

        // Ownership: the explicit view wins, then the ?ownerId filter, then the
        // role-level floor. 'unassigned' is a null owner, not an id match.
        if (view === 'my') {
          query = query.eq('owner_id', user.id);
        } else if (view === 'unassigned') {
          query = query.is('owner_id', null);
        } else if (ownerId && ownerId !== 'all') {
          query = query.eq('owner_id', ownerId);
        } else if (ownOnly) {
          query = query.eq('owner_id', user.id);
        }

        const since = relativeSince(createDate);
        if (since) {
          query = query.gte('created_at', since.from);
          if (since.to) query = query.lt('created_at', since.to);
        }
        if (lastActivityDate === 'never') {
          query = query.is('last_contact_date', null);
        } else {
          const activity = relativeSince(lastActivityDate);
          if (activity) {
            query = query.gte('last_contact_date', activity.from);
            if (activity.to) query = query.lt('last_contact_date', activity.to);
          }
        }

        query = query
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range(offset, offset + limit - 1);

        const { data: rows, error, count } = await query;

        if (error) {
          console.error('Error fetching contacts:', error);
          return createCorsResponse(
            {
              error: 'Failed to fetch contacts',
              details: error.message,
              code: error.code,
              hint: error.hint,
            },
            500,
            req,
          );
        }

        // Contacts.tsx reads `data.contacts` and camelCase row keys, which is what
        // the Express handler returned. This function returned `data` with raw
        // snake_case rows, so the page rendered an empty list next to a non-zero
        // total. Both keys are present: `data` for the generic auto-unwrap in
        // apiRequest, `contacts` for the page. toCamelShallow is deliberately
        // shallow so the `companies` embed keeps its own snake_case keys.
        const contacts = (rows || []).map((r: Record<string, unknown>) => toCamelShallow(r));
        const total = count || 0;
        return createCorsResponse(
          {
            contacts,
            data: contacts,
            total,
            page,
            limit,
            pages: limit > 0 ? Math.ceil(total / limit) : 0,
          },
          200,
          req,
        );
      }

      // POST /contacts — create
      if (req.method === 'POST' && !flatId) {
        const body = await req.json();
        const lastName = body.lastName ?? body.last_name;
        const companyId = body.companyId ?? body.company_id;
        if (!lastName) {
          return createCorsResponse({ error: 'lastName is required' }, 400, req);
        }
        if (!companyId) {
          return createCorsResponse({ error: 'companyId is required' }, 400, req);
        }

        const row: Record<string, unknown> = {
          tenant_id: tenantId,
          company_id: companyId,
          salutation: body.salutation ?? null,
          first_name: body.firstName ?? body.first_name ?? null,
          last_name: lastName,
          title: body.title ?? null,
          department: body.department ?? null,
          phone: body.phone ?? null,
          mobile: body.mobile ?? null,
          email: body.email ?? null,
          reports_to: body.reportsTo ?? body.reports_to ?? null,
          contact_roles: body.contactRoles ?? body.contact_roles ?? null,
          is_primary_contact: body.isPrimaryContact ?? body.is_primary_contact ?? false,
          lead_status: body.leadStatus ?? body.lead_status ?? 'new',
          owner_id: body.ownerId ?? body.owner_id ?? user.id,
        };

        const { data: created, error } = await admin
          .from('company_contacts')
          .insert(row)
          .select('*')
          .single();

        if (error) {
          console.error('Error creating contact:', error);
          return createCorsResponse(
            { error: 'Failed to create contact', details: error.message },
            500,
            req,
          );
        }
        return createCorsResponse(toCamelShallow(created), 201, req);
      }

      // Everything below addresses one contact by id.
      if (flatId) {
        const { data: existing, error: readError } = await admin
          .from('company_contacts')
          .select('*')
          .eq('id', flatId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (readError) {
          console.error('Error loading contact:', readError);
          return createCorsResponse({ error: 'Failed to load contact' }, 500, req);
        }
        if (!existing) {
          return createCorsResponse({ error: 'Contact not found' }, 404, req);
        }
        if (ownOnly && existing.owner_id !== user.id) {
          return createCorsResponse(
            { error: 'Access denied - you can only access your own contacts' },
            403,
            req,
          );
        }

        if (req.method === 'GET') {
          return createCorsResponse(toCamelShallow(existing), 200, req);
        }

        if (req.method === 'PUT' || req.method === 'PATCH') {
          const body = await req.json();
          const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          const assign = (camel: string, snake: string) => {
            if (body[camel] !== undefined) updates[snake] = body[camel];
            else if (body[snake] !== undefined) updates[snake] = body[snake];
          };
          assign('salutation', 'salutation');
          assign('firstName', 'first_name');
          assign('lastName', 'last_name');
          assign('title', 'title');
          assign('department', 'department');
          assign('phone', 'phone');
          assign('mobile', 'mobile');
          assign('email', 'email');
          assign('reportsTo', 'reports_to');
          assign('contactRoles', 'contact_roles');
          assign('isPrimaryContact', 'is_primary_contact');
          assign('leadStatus', 'lead_status');
          assign('lastContactDate', 'last_contact_date');
          assign('nextFollowUpDate', 'next_follow_up_date');
          assign('ownerId', 'owner_id');
          assign('companyId', 'company_id');

          const { data: updated, error } = await admin
            .from('company_contacts')
            .update(updates)
            .eq('id', flatId)
            .eq('tenant_id', tenantId)
            .select('*')
            .single();

          if (error) {
            console.error('Error updating contact:', error);
            return createCorsResponse(
              { error: 'Failed to update contact', details: error.message },
              500,
              req,
            );
          }
          return createCorsResponse(toCamelShallow(updated), 200, req);
        }

        if (req.method === 'DELETE') {
          const { error } = await admin
            .from('company_contacts')
            .delete()
            .eq('id', flatId)
            .eq('tenant_id', tenantId);

          if (error) {
            console.error('Error deleting contact:', error);
            return createCorsResponse({ error: 'Failed to delete contact' }, 500, req);
          }
          return createCorsResponse({ success: true }, 200, req);
        }
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // Map entity type to table name (for entity-specific requests)
    const tableName = entityType === 'leads' ? 'lead_contacts' : 'customer_contacts';
    const foreignKeyColumn = entityType === 'leads' ? 'lead_id' : 'customer_id';

    if (!entityId && entityType) {
      return createCorsResponse({ error: 'Entity ID is required' }, 400, req);
    }

    // GET /leads/:id/contacts or /companies/:id/contacts - List contacts for specific entity
    if (req.method === 'GET' && entityId && !contactId) {
      const { data: contacts, error } = await admin
        .from(tableName)
        .select('*')
        .eq(foreignKeyColumn, entityId)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false }) // Primary contacts first
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`Error fetching contacts for ${entityType}:`, error);
        return createCorsResponse({ error: 'Failed to fetch contacts' }, 500, req);
      }

      return createCorsResponse(contacts || [], 200, req);
    }

    // GET /leads/:id/contacts/:contactId - Get single contact
    if (req.method === 'GET' && contactId) {
      const { data: contact, error } = await admin
        .from(tableName)
        .select('*')
        .eq('id', contactId)
        .eq(foreignKeyColumn, entityId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching contact:', error);
        return createCorsResponse({ error: 'Contact not found' }, 404, req);
      }

      return createCorsResponse(contact, 200, req);
    }

    // POST /leads/:id/contacts or /companies/:id/contacts - Create contact
    if (req.method === 'POST') {
      const body = await req.json();

      const contactData = {
        tenant_id: tenantId,
        [foreignKeyColumn]: entityId,
        first_name: body.firstName || body.first_name,
        last_name: body.lastName || body.last_name,
        title: body.title || null,
        department: body.department || null,
        phone: body.phone || null,
        email: body.email || null,
        is_primary: body.isPrimary || body.is_primary || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // If this contact is being marked as primary, unmark others
      if (contactData.is_primary) {
        await admin
          .from(tableName)
          .update({ is_primary: false })
          .eq(foreignKeyColumn, entityId)
          .eq('tenant_id', tenantId);
      }

      const { data: contact, error } = await admin
        .from(tableName)
        .insert(contactData)
        .select()
        .single();

      if (error) {
        console.error('Error creating contact:', error);
        return createCorsResponse({ error: 'Failed to create contact', details: error }, 500, req);
      }

      return createCorsResponse(contact, 201, req);
    }

    // PATCH /leads/:id/contacts/:contactId - Update contact
    if ((req.method === 'PATCH' || req.method === 'PUT') && contactId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.firstName || body.first_name)
        updateData.first_name = body.firstName || body.first_name;
      if (body.lastName || body.last_name) updateData.last_name = body.lastName || body.last_name;
      if (body.title !== undefined) updateData.title = body.title;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.isPrimary !== undefined || body.is_primary !== undefined) {
        updateData.is_primary = body.isPrimary || body.is_primary;
      }

      // If this contact is being marked as primary, unmark others
      if (updateData.is_primary) {
        await admin
          .from(tableName)
          .update({ is_primary: false })
          .eq(foreignKeyColumn, entityId)
          .eq('tenant_id', tenantId)
          .neq('id', contactId);
      }

      const { data: contact, error } = await admin
        .from(tableName)
        .update(updateData)
        .eq('id', contactId)
        .eq(foreignKeyColumn, entityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating contact:', error);
        return createCorsResponse({ error: 'Failed to update contact' }, 500, req);
      }

      return createCorsResponse(contact, 200, req);
    }

    // DELETE /leads/:id/contacts/:contactId - Delete contact
    if (req.method === 'DELETE' && contactId) {
      const { error } = await admin
        .from(tableName)
        .delete()
        .eq('id', contactId)
        .eq(foreignKeyColumn, entityId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting contact:', error);
        return createCorsResponse({ error: 'Failed to delete contact' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Contact deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in contacts function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

/**
 * Relative date windows for the ?createDate= / ?lastActivityDate= filters,
 * ported from server/routes-contacts.ts. Returns ISO bounds; `to` is exclusive
 * and only set for 'yesterday'. Unknown values filter nothing, matching the
 * Express switch's default.
 */
function relativeSince(value: string): { from: string; to?: string } | null {
  if (!value) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (value) {
    case 'today':
      return { from: startOfToday.toISOString() };
    case 'yesterday': {
      const yesterday = new Date(startOfToday);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday.toISOString(), to: startOfToday.toISOString() };
    }
    case 'last7days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString() };
    }
    case 'last30days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: d.toISOString() };
    }
    default:
      return null;
  }
}
